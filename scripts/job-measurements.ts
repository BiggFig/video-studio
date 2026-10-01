/** Operator records only. Default/validation commands are offline; cloud writes require --apply. */
import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";

const root = resolve(".local/job-measurements");
class MeasurementError extends Error {}
const uuid = z.string().uuid().transform(value => value.toLowerCase());
const time = z.string().datetime();
const text = z.string().trim().min(1).max(2000);
const money = z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/, "Use a nonnegative USD decimal string with at most six decimal places.");
const invoice = z.object({ provider: text, invoiceReference: text, lineReference: text, allocationMethod: text, reviewedBy: text, reviewedAt: time }).strict();
const component = z.object({ amountUsd: money.nullable(), evidence: invoice.nullable() }).strict().refine(value => (value.amountUsd === null) === (value.evidence === null), "A known amount, including zero, requires invoice evidence; an unknown amount must remain null.");
export const measurementSchema = z.object({
  version: z.literal(1), jobId: uuid, ownerId: uuid, createdAt: time,
  currency: z.literal("USD"), costScope: z.literal("all_job_attempts"),
  costs: z.object({ model: component, audioAndTranscription: component, compute: component, storageAndDelivery: component }).strict(),
  publishability: z.object({ judgment: z.enum(["publishable", "minor_changes", "not_publishable"]), reviewerKind: z.enum(["tester", "operator"]), reviewedBy: text, reviewedAt: time, evidenceReference: text, notes: text }).strict().nullable(),
}).strict();
export type JobMeasurement = z.infer<typeof measurementSchema>;

export function parseMeasurement(value: unknown): JobMeasurement { return measurementSchema.parse(value); }
export function newMeasurement(jobId: string, ownerId: string, createdAt = new Date().toISOString()): JobMeasurement {
  const unknown = () => ({ amountUsd: null, evidence: null });
  return parseMeasurement({ version: 1, jobId, ownerId, createdAt, currency: "USD", costScope: "all_job_attempts", costs: { model: unknown(), audioAndTranscription: unknown(), compute: unknown(), storageAndDelivery: unknown() }, publishability: null });
}
function micros(value: string): bigint { const [whole, fraction = ""] = value.split("."); return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0")); }
function dollars(value: bigint): string { return `${value / 1_000_000n}.${String(value % 1_000_000n).padStart(6, "0")}`; }
export function measurementSummary(raw: unknown) {
  const record = parseMeasurement(raw), entries = Object.entries(record.costs);
  const unknownComponents = entries.filter(([, value]) => value.amountUsd === null).map(([name]) => name);
  const known = entries.reduce((total, [, value]) => total + (value.amountUsd === null ? 0n : micros(value.amountUsd)), 0n);
  return { jobId: record.jobId, ownerId: record.ownerId, currency: record.currency, costScope: record.costScope,
    actualTotalUsd: unknownComponents.length ? null : dollars(known), knownSubtotalUsd: dollars(known), unknownComponents,
    publishability: record.publishability ? { judgment: record.publishability.judgment, reviewerKind: record.publishability.reviewerKind } : null,
    ownerMatchVerified: false, databaseUpdated: false };
}
export function assertApplyIdentity(record: JobMeasurement, jobId: string | undefined, ownerId: string | undefined) {
  const expectedJob = uuid.safeParse(jobId), expectedOwner = uuid.safeParse(ownerId);
  if (!expectedJob.success || !expectedOwner.success || expectedJob.data !== record.jobId || expectedOwner.data !== record.ownerId) throw new MeasurementError("Apply requires --job and --owner to exactly match this record.");
  if (!record.publishability && measurementSummary(record).actualTotalUsd === null) throw new MeasurementError("There is no completed cost reconciliation or publishability judgment to apply.");
}
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function readRecord(name: string) {
  if (!name.endsWith(".json")) throw new MeasurementError("Choose a JSON record inside .local/job-measurements.");
  const base = await realpath(root), file = await realpath(resolve(base, name)), rel = relative(base, file);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new MeasurementError("Measurement records must remain inside their ignored directory.");
  return parseMeasurement(JSON.parse(await readFile(file, "utf8")));
}
async function retainedAudit(record: JobMeasurement) {
  const recordSha256 = digest(record), directory = join(root, "audit");
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${record.jobId}-${recordSha256}.json`);
  try { await writeFile(path, JSON.stringify({ recordSha256, preparedAt: new Date().toISOString(), record }, null, 2), { flag: "wx", mode: 0o600 }); }
  catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) throw error;
    const existing = JSON.parse(await readFile(path, "utf8"));
    if (existing.recordSha256 !== recordSha256 || digest(existing.record) !== recordSha256) throw new MeasurementError("The existing local audit record is inconsistent; no database write is permitted.");
  }
  return { recordSha256, directory };
}
type ReconciliationRow = { id: string; user_id: string; status: string; cost_usd: string | null };
type Receipt = { recordSha256: string; appliedAt: string; jobId: string; ownerId: string; status: string; actualTotalUsd: string | null };
export interface MeasurementApplyPorts {
  retainAudit(record: JobMeasurement): Promise<unknown>;
  query(sql: string, params: unknown[]): Promise<ReconciliationRow[]>;
  writeReceipt(receipt: Receipt): Promise<void>;
}
export async function applyMeasurement(raw: unknown, ports: MeasurementApplyPorts) {
  const record = parseMeasurement(raw);
  assertApplyIdentity(record, record.jobId, record.ownerId);
  // Preserve the exact evidence before a possibly ambiguous network outcome.
  await ports.retainAudit(record);
  const recordSha256 = digest(record);
  const total = measurementSummary(record).actualTotalUsd;
  const rows = await ports.query(`
    UPDATE studio_jobs SET
      cost_usd=COALESCE($3::numeric,cost_usd),
      checkpoint=CASE WHEN coalesce(checkpoint->'operatorMeasurements','[]'::jsonb) @> jsonb_build_array(jsonb_build_object('recordSha256',$4::text)) THEN checkpoint
        ELSE jsonb_set(checkpoint,'{operatorMeasurements}',coalesce(checkpoint->'operatorMeasurements','[]'::jsonb)||jsonb_build_array(jsonb_build_object('recordSha256',$4::text,'record',$5::jsonb,'appliedAt',now())),true) END
    WHERE id=$1::uuid AND user_id=$2::uuid AND status IN ('ready','failed','needs_input','needs_review','cancelled')
      AND (cost_usd IS NULL OR $3::numeric IS NULL OR cost_usd=$3::numeric)
    RETURNING id,user_id,status,cost_usd`, [record.jobId, record.ownerId, total, recordSha256, JSON.stringify(record)]);
  if (rows.length !== 1) throw new MeasurementError("No record applied: exact owner/job was absent, job is active, or an existing reconciled cost conflicts. Inspect the saved audit record before retrying.");
  if (rows[0].id !== record.jobId || rows[0].user_id !== record.ownerId || !["ready", "failed", "needs_input", "needs_review", "cancelled"].includes(rows[0].status)) throw new MeasurementError("The reconciliation result does not match the exact terminal job; no successful receipt was recorded.");
  await ports.writeReceipt({ recordSha256, appliedAt: new Date().toISOString(), jobId: rows[0].id, ownerId: rows[0].user_id, status: rows[0].status, actualTotalUsd: rows[0].cost_usd });
  return { ...measurementSummary(record), actualTotalUsd: rows[0].cost_usd, ownerMatchVerified: true, databaseUpdated: true, recordSha256 };
}
async function apply(record: JobMeasurement) {
  return applyMeasurement(record, {
    retainAudit: retainedAudit,
    query: async (sql, params) => { const { query } = await import("../lib/server/db"); return query<ReconciliationRow>(sql, params); },
    writeReceipt: async receipt => { await writeFile(join(root, "audit", `${receipt.jobId}-${receipt.recordSha256}.receipt.json`), JSON.stringify(receipt, null, 2), { mode: 0o600 }); },
  });
}

export async function runMeasurements(args: string[]) {
  const flag = (name: string) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
  const phase = flag("--phase") ?? "plan";
  if (phase === "plan") return { mode: "offline", databaseUpdated: false, phases: ["init", "validate", "report", "apply"], records: ".local/job-measurements", unknownCost: null, applyRequires: "--apply --job UUID --owner UUID; explicit operator authorization and DATABASE_URL; terminal jobs only" };
  if (phase === "init") {
    const record = newMeasurement(flag("--job") ?? "", flag("--owner") ?? "");
    await mkdir(root, { recursive: true });
    await writeFile(join(root, `${record.jobId}.json`), JSON.stringify(record, null, 2), { flag: "wx", mode: 0o600 });
    return { created: `.local/job-measurements/${record.jobId}.json`, ...measurementSummary(record) };
  }
  if (!["validate", "report", "apply"].includes(phase)) throw new MeasurementError("Choose plan, init, validate, report, or apply.");
  if (phase === "apply" && !args.includes("--apply")) throw new MeasurementError("Database writes require explicit --apply; validate and report remain offline.");
  const record = await readRecord(flag("--file") ?? "");
  if (phase !== "apply") return measurementSummary(record);
  assertApplyIdentity(record, flag("--job"), flag("--owner"));
  return apply(record);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void runMeasurements(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
  // Validation/provider/DB internals can contain private material. Keep diagnostics categorical.
  console.error(JSON.stringify({ completed: false, reason: error instanceof z.ZodError ? "Measurement schema is invalid. Check dates, UUIDs, required invoice evidence, and USD decimal strings." : error instanceof MeasurementError ? error.message : "Measurement operation failed; inspect the ignored audit record before any retry." }));
  process.exitCode = 1;
});
