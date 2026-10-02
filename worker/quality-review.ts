import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { PipelineError, type Hooks } from "./types";

const RETRY_PATH = "analysis/quality-schema-retry.json";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const issueCodes = ["invalid_type", "too_big", "too_small", "invalid_format", "not_multiple_of", "unrecognized_keys", "invalid_union", "invalid_key", "invalid_element", "invalid_value", "custom"] as const;
const diagnosticSchema = z.object({ code: z.enum(issueCodes), path: z.array(z.union([z.string().max(40), z.number().int().nonnegative().max(10000)])).max(3) });
const markerSchema = z.object({
  version: z.literal(1), jobId: z.string().min(1).max(100),
  status: z.enum(["reserved", "completed"]), reservedAt: z.string().datetime(),
  promptSha256: hashSchema, imageManifestSha256: hashSchema, rejectedValueSha256: hashSchema,
  diagnostics: z.array(diagnosticSchema).min(1).max(24),
  completedAt: z.string().datetime().optional(), outcome: z.enum(["valid", "invalid"]).optional(),
}).strict().superRefine((marker, context) => {
  if ((marker.status === "completed") !== (!!marker.completedAt && !!marker.outcome)) context.addIssue({ code: "custom", message: "Incomplete review retry state" });
  if (marker.status === "reserved" && (marker.completedAt || marker.outcome)) context.addIssue({ code: "custom", message: "Invalid reserved review state" });
});
type Marker = z.infer<typeof markerSchema>;
export interface ReviewImage { path: string; label: string }
interface ReviewRetryOptions<T> {
  workspace: string; jobId: string; prompt: string; images: ReviewImage[];
  hooks: Pick<Hooks, "persist">;
  parse: (raw: unknown) => T;
  /** Must protect all remaining mandatory reviews before returning a paid-call closure. */
  prepareRetry: (prompt: string, images: ReviewImage[]) => Promise<() => Promise<unknown>>;
}

const blocked = (message: string) => new PipelineError("invalid_quality_review", message,
  "Ask the administrator to inspect the retained review and draft. No findings were waived; the bounded review retry cannot be repeated.", "needs_review");
const topFields = new Set(["readabilityPassed", "claimsPassed", "realVisualsPassed", "renderIntegrityPassed", "referenceStyleReviewed", "referenceStylePassed", "audioTranscriptPassed", "findings", "notes"]);
const findingFields = new Set(["severity", "sceneId", "timeSeconds", "message", "check", "evidence", "repair"]);

/** Never feed a model untrusted validator messages, received values, or arbitrary keys. */
function safeDiagnostics(error: z.ZodError): z.infer<typeof diagnosticSchema>[] {
  return error.issues.slice(0, 24).map(issue => {
    const path = issue.path;
    const index = path[1];
    const validIndex = typeof index === "number" && Number.isSafeInteger(index) && index >= 0 && index <= 10000;
    const allowed = path.length === 0 ||
      (path.length === 1 && typeof path[0] === "string" && topFields.has(path[0])) ||
      (path.length === 2 && (path[0] === "findings" || path[0] === "notes") && validIndex) ||
      (path.length === 3 && path[0] === "findings" && validIndex && typeof path[2] === "string" && findingFields.has(path[2]));
    return { code: issueCodes.includes(issue.code) ? issue.code : "custom", path: allowed ? path as (string | number)[] : [] };
  });
}

async function readRetryMarker(workspace: string, jobId: string): Promise<Marker | undefined> {
  let existing: string;
  try { existing = await readFile(join(workspace, RETRY_PATH), "utf8"); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw blocked("The saved quality review allowance could not be read.");
  }
  let marker: Marker;
  try { if (existing.length > 16384) throw new Error("Oversized retry state"); marker = markerSchema.parse(JSON.parse(existing)); }
  catch { throw blocked("The saved quality review allowance is invalid."); }
  if (marker.jobId !== jobId) throw blocked("The saved quality review allowance does not match this job.");
  return marker;
}

/** Check before probe, transcription or model work; restart cannot bypass a stopped retry. */
export async function assertQualityRetryState(workspace: string, jobId: string): Promise<void> {
  const marker = await readRetryMarker(workspace, jobId);
  if (marker?.status === "reserved") throw blocked("A quality re-review was reserved but its completion was not confirmed.");
  if (marker?.outcome === "invalid") throw blocked("The saved quality re-review failed validation and cannot be repeated.");
  // A valid schema result may still require a content repair. Its schema retry
  // remains consumed, while the repaired film must receive ordinary full QC.
}

/** One schema re-review for the entire job, separate from content/plan repairs. */
export async function reviewWithSchemaRetry<T>(raw: unknown, options: ReviewRetryOptions<T>): Promise<T> {
  let rejected: z.ZodError;
  try { return options.parse(raw); } catch (error) { if (!(error instanceof z.ZodError)) throw error; rejected = error; }
  const path = join(options.workspace, RETRY_PATH);
  const existing = await readRetryMarker(options.workspace, options.jobId);
  if (existing) {
    throw blocked(existing.status === "reserved" ? "A quality re-review was reserved but its completion was not confirmed." : "This job has already used its bounded quality re-review.");
  }
  const diagnostics = safeDiagnostics(rejected);
  const retryPrompt = `${options.prompt}\n\nREVIEW RESPONSE VALIDATION\nThe prior response did not satisfy the required review schema. Independently review the same supplied evidence again and return a complete internally consistent response. These diagnostics describe response structure, not defects in the video. A valid failing review is acceptable: retain every supported blocking finding and its failed check. Do not change a verdict, waive a finding, or lower a quality standard merely to satisfy validation. Do not infer new evidence from these diagnostics.\nValidation codes and paths: ${JSON.stringify(diagnostics)}`;
  // Budget preflight may fail without consuming the one retry or making a paid call.
  const perform = await options.prepareRetry(retryPrompt, options.images);
  const marker = markerSchema.parse({ version: 1, jobId: options.jobId, status: "reserved", reservedAt: new Date().toISOString(),
    promptSha256: digest(options.prompt), imageManifestSha256: digest(JSON.stringify(options.images)),
    rejectedValueSha256: digest(JSON.stringify(raw) ?? "undefined"), diagnostics });
  // Exclusive creation also prevents simultaneous invocations from claiming twice.
  try { await writeFile(path, JSON.stringify(marker, null, 2) + "\n", { flag: "wx" }); }
  catch { throw blocked("The quality re-review allowance could not be reserved exactly once."); }
  await options.hooks.persist([RETRY_PATH]);
  const retried = await perform();
  let review: T;
  try { review = options.parse(retried); }
  catch (error) {
    if (!(error instanceof z.ZodError)) throw error;
    await complete("invalid");
    throw blocked("The quality reviewer returned incomplete or contradictory findings again.");
  }
  await complete("valid");
  return review;

  async function complete(outcome: "valid" | "invalid") {
    const completed: Marker = { ...marker, status: "completed", outcome, completedAt: new Date().toISOString() };
    await writeFile(path, JSON.stringify(completed, null, 2) + "\n");
    await options.hooks.persist([RETRY_PATH]);
  }
}
