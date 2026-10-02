import { createHash } from "node:crypto";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { z } from "zod";
import { safePath } from "../worker/security";
import type { WorkerInput } from "../worker/types";

const digest = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.string().refine(value => Number.isFinite(Date.parse(value)));
const inputSchema = z.object({
  jobId: z.string().min(1), ownerId: z.string().min(1), mode: z.enum(["url", "prd"]),
  productUrl: z.string().url().optional(), referenceUrl: z.string().url().optional(),
  videoType: z.enum(["launch", "feature-demo"]), format: z.enum(["auto", "16:9", "9:16", "1:1"]),
  files: z.array(z.object({ id: z.string(), name: z.string(), kind: z.enum(["prd", "asset", "reference"]), url: z.string().url(), mimeType: z.string(), size: z.number().nonnegative().optional() })),
  runtimeHash: sha, runtimeId: z.string().min(1),
  budgets: z.record(z.string(), z.number().finite().nonnegative()),
  limits: z.record(z.string(), z.number().finite().nonnegative()).optional(),
});
const fixtureSchema = z.object({
  transport: z.literal("verified-local-fixture-bytes"), manifestSha256: sha,
  productionUploadTransportVerified: z.literal(false),
  files: z.array(z.object({ path: z.string(), kind: z.enum(["prd", "asset", "reference"]), size_bytes: z.number().int().positive(), sha256: sha })),
});
const manifestSchema = z.record(z.string(), z.object({ sha256: sha, size: z.number().int().positive(), verifiedAt: timestamp }));
const stagesSchema = z.array(z.object({ status: z.string(), at: timestamp, checkpoint: z.unknown().optional() }));
const counter = z.number().finite().nonnegative();
const ledgerSchema = z.object({
  modelCalls: counter.int(), inputTokens: counter.int(), outputTokens: counter.int(), reservedInputTokens: counter.int(), reservedOutputTokens: counter.int(),
  audioGenerations: counter.int(), asrSeconds: counter,
  providerRequests: z.array(z.object({ provider: z.string(), operation: z.string(), requestId: z.string().nullable(), units: counter, unit: z.string() })),
  audio: z.record(z.string(), z.object({ status: z.enum(["reserved", "completed"]), path: z.string(), hash: z.string() })),
});
export type AcceptanceManifest = z.infer<typeof manifestSchema>;
export type AcceptanceStages = z.infer<typeof stagesSchema>;

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
function parse<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(`Saved acceptance ${label} is invalid; retain this workspace and start a separate run.`);
  return result.data;
}
async function readJson(path: string, label: string): Promise<unknown> {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch { throw new Error(`Saved acceptance ${label} is missing or unreadable; reuse is prohibited.`); }
}

/** URLs, output choices, declared budgets and exact fixture content all belong to one run. */
export function acceptanceInputIdentity(raw: WorkerInput | unknown, fixture: unknown): string {
  const { runtimeHash: _, runtimeId: __, ...input } = parse(inputSchema, raw, "input");
  const source = fixture == null ? null : parse(fixtureSchema, fixture, "fixture");
  if (input.mode === "prd" && !source) throw new Error("Saved PRD acceptance has no verifiable fixture manifest.");
  if (input.mode === "url" && (!input.productUrl || source)) throw new Error("Saved URL acceptance has inconsistent source evidence.");
  return digest(JSON.stringify(canonical({ input, fixture: source })));
}

/** Read-only preflight: never silently repairs, rehashes or overwrites old evidence. */
export async function validateAcceptanceResume(workspace: string, input: WorkerInput, fixture: unknown) {
  const root = await realpath(workspace);
  const provenance = parse(z.object({
    kind: z.literal("local-provider-acceptance"), paidProviders: z.literal(true),
    productionQueueVerified: z.literal(false), productionPrivateStorageVerified: z.literal(false), productionOwnerAccessVerified: z.literal(false),
    input: inputSchema, localFixture: z.unknown(), startedAt: timestamp,
    inputIdentity: sha.optional(), retainedReviewRepair: z.unknown().optional(),
  }).passthrough(), await readJson(join(root, "acceptance-provenance.json"), "provenance"), "provenance");
  if (provenance.retainedReviewRepair != null) throw new Error("This workspace already reserved a retained-review repair; further recovery is prohibited.");
  const identity = acceptanceInputIdentity(input, fixture);
  const previousIdentity = acceptanceInputIdentity(provenance.input, provenance.localFixture);
  if (identity !== previousIdentity || (provenance.inputIdentity && provenance.inputIdentity !== previousIdentity)) throw new Error("Acceptance input differs from the original run; use a separate workspace.");
  if (provenance.input.runtimeHash !== input.runtimeHash || provenance.input.runtimeId !== input.runtimeId) throw new Error("Acceptance runtime differs from the original run; no repair or provider call is permitted.");
  const resultPath = join(root, "acceptance-result.json");
  if (await stat(resultPath).catch(() => null)) {
    const result = parse(z.object({ status: z.string() }), await readJson(resultPath, "result"), "result");
    if (result.status === "local_quality_passed") throw new Error("Completed acceptance evidence is immutable; use a separate workspace.");
  }
  const manifest = parse(manifestSchema, await readJson(join(root, "acceptance-artifacts.json"), "artifact manifest"), "artifact manifest");
  for (const path of ["job.json", "versions.json", "ledger.json"]) if (!manifest[path]) throw new Error(`Saved acceptance lacks a verified ${path}; reuse is prohibited.`);
  for (const [path, expected] of Object.entries(manifest)) {
    let bytes: Buffer;
    try {
      const full = await realpath(safePath(root, path)), rel = relative(root, full);
      if (!rel || rel.startsWith("..") || isAbsolute(rel) || !(await stat(full)).isFile()) throw new Error("Unconfined artifact");
      bytes = await readFile(full);
    } catch { throw new Error(`Saved acceptance artifact is unavailable or outside its workspace: ${path}`); }
    if (bytes.length !== expected.size || digest(bytes) !== expected.sha256) throw new Error(`Saved acceptance artifact changed after persistence: ${path}`);
  }
  // These are read directly as caches by the pipeline, even without a manifest entry.
  for (const path of ["analysis/evidence.json", "analysis/research.json", "analysis/research-state.json", "analysis/script.json", "analysis/script-state.json", "analysis/repair-ledger.json", "plan.json"]) if (await stat(join(root, path)).catch(() => null)) {
    if (!manifest[path]) throw new Error(`Unverified reusable acceptance artifact: ${path}`);
  }
  for (const name of await readdir(join(root, "analysis")).catch(() => [] as string[])) {
    if (/^transcript-.*\.json$/.test(name) && !manifest[`analysis/${name}`]) throw new Error(`Unverified reusable acceptance transcript: ${name}`);
  }
  const versions = parse(z.record(z.string(), z.string()), await readJson(join(root, "versions.json"), "runtime record"), "runtime record");
  if (versions.runtimeHash !== input.runtimeHash || versions.runtimeId !== input.runtimeId || !versions.skill || versions.pipeline !== "1.0.0") throw new Error("Saved acceptance runtime record does not match the pinned run.");
  const ledger = parse(ledgerSchema, await readJson(join(root, "ledger.json"), "provider ledger"), "provider ledger");
  for (const audio of Object.values(ledger.audio)) if (audio.status === "completed" && (!manifest[audio.path] || manifest[audio.path].sha256 !== audio.hash)) throw new Error("Completed paid audio lacks its verified original artifact.");
  const stages = parse(stagesSchema, await readJson(join(root, "acceptance-stages.json"), "stage history"), "stage history");
  return { manifest, stages, inputIdentity: identity, startedAt: provenance.startedAt };
}
