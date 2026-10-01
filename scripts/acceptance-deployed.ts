/** Prepared acceptance runner. --plan is offline; every other phase requires --execute.
 * Execution flags are not authorization. Run mutating phases only after the user
 * has approved the exact account, generation and interruption actions involved.
 */
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, rename, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { resolve, join, relative, isAbsolute, extname, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import { del, get, list } from "@vercel/blob";
import { upload } from "@vercel/blob/client";
import { Sandbox } from "@vercel/sandbox";
import { database, query } from "../lib/server/db";
import { createInvitation } from "../lib/server/auth";
import { mediaEnvironment } from "../worker/media";
import type { JobRow } from "../lib/server/jobs";
import type { CreateJobInput, JobDetail, SessionResponse, StudioUser, UploadRecord } from "../lib/contracts";

const root = resolve(".local/deployed-acceptance");
const stateFile = join(root, "state.json");
type Identity = { email: string; allowance: number; invitationId?: string; token?: string; userId?: string; cookie?: string; revoked?: boolean };
type Evidence = { name: string; performed: boolean; passed: boolean; at: string; detail?: string };
type SavedUpload = UploadRecord & { pathname: string; sha256: string; ready: boolean };
type RunState = { version: 1; runId: string; origin: string; primary: Identity; secondary?: Identity; jobs: Record<string, { id?: string; idempotencyKey: string; uploadIds: string[]; uploads?: SavedUpload[]; reservationAttempts?: Record<string, string>; specHash: string }>; evidence: Evidence[]; interruption?: { jobId: string; attempts: number; runtimeHash: unknown; audio: Record<string, { hash: string; status: string }>; generations: number; requestedAt: string }; closedConfirmed?: boolean };
const flag = (name: string) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

export function confinedPath(base: string, value: string) {
  const result = resolve(base, value); const rel = relative(base, result);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("Acceptance file must be inside its designated ignored directory.");
  return result;
}
export function acceptancePlan() {
  return {
    mode: "offline-plan", mutationsPerformed: false,
    primary: { admin: false, allowance: 2, invitationDays: 7 },
    secondary: { createdByDefault: false, admin: false, allowance: 0, requiresSeparateApproval: true },
    cases: ["URL launch, Auto, no assets", "PRD feature demo, vertical, real assets, optional supplied reference"],
    execution: "Explicit --execute required; pending approval must be resolved before any mutation. This runner never uploads worker source or enables generation.",
    interruption: "Only its recorded QA sandbox, after both generated audio assets are durably completed; natural lease expiry and cron recovery.",
    cleanup: "Revoke only recorded QA identities, sessions and invitations; cancel their remaining jobs. Purge is a separate explicit phase. Never touches the real owner.",
    completion: "Ready + all performed QC, owned preview/range/download, full decoded MP4, optional second-owner denials, recorded recovery, and confirmed beta closed. Missing checks remain unperformed.",
    state: ".local/deployed-acceptance/state.json (contains tokens; ignored; never print or attach)",
  };
}
async function save(state: RunState) {
  await mkdir(root, { recursive: true });
  await writeFile(`${stateFile}.tmp`, JSON.stringify(state, null, 2), { mode: 0o600 });
  await rename(`${stateFile}.tmp`, stateFile);
  await writeFile(join(root, "report.json"), JSON.stringify({ runId: state.runId, origin: state.origin, evidence: state.evidence, secondIdentityPerformed: Boolean(state.secondary?.userId), closedConfirmed: state.closedConfirmed ?? false }, null, 2));
}
function record(state: RunState, name: string, passed: boolean, detail?: string, performed = true) {
  state.evidence.push({ name, passed, performed, at: new Date().toISOString(), ...(detail ? { detail } : {}) });
}
async function api(state: RunState, path: string, identity?: Identity, body?: unknown, headers: Record<string, string> = {}) {
  if (!path.startsWith("/api/") || path.startsWith("//")) throw new Error("Only studio API paths are allowed.");
  return fetch(`${state.origin}${path}`, { method: body === undefined ? "GET" : "POST", redirect: "error", headers: { ...(identity?.cookie ? { Cookie: identity.cookie } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json", Origin: state.origin }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(90_000) });
}
async function expect(response: Response, status: number) {
  if (response.status !== status) throw new Error(`Acceptance HTTP status ${response.status}; expected ${status}.`);
  return response;
}
async function scopedUser(identity: Identity) {
  if (!identity.userId || !identity.email.endsWith("@acceptance.invalid")) throw new Error("No recorded QA identity is available.");
  const rows = await query<{ id: string }>("SELECT id FROM studio_users WHERE id=$1 AND email=$2 AND is_admin=false", [identity.userId, identity.email]);
  if (!rows[0]) throw new Error("The stored identity is not a matching non-admin QA account.");
}
async function provision(state: RunState, role: "primary" | "secondary") {
  const identity = role === "primary" ? state.primary : state.secondary ??= { email: `qa-${state.runId}-secondary@acceptance.invalid`, allowance: 0 };
  if (identity.userId || identity.revoked) throw new Error("This QA identity was already provisioned or revoked; do not create a duplicate.");
  await save(state); // Save the exact generated email before creating anything externally.
  if (!identity.invitationId) {
    const existing = await query<{ id: string }>("SELECT id FROM studio_invitations WHERE email=$1", [identity.email]);
    if (existing.length) throw new Error("An invitation creation already committed for this exact QA email. Revoke the ambiguous invitation before approving a replacement.");
    const invite = await createInvitation({ email: identity.email, name: `Acceptance ${role}`, jobAllowance: identity.allowance });
    identity.invitationId = invite.id; identity.token = invite.token; await save(state);
  }
  const response = await expect(await api(state, "/api/auth/redeem", undefined, { token: identity.token }), 200);
  const cookie = response.headers.get("set-cookie") ?? "";
  identity.cookie = cookie.match(/(?:^|,\s*)(studio_session=[^;]+)/)?.[1];
  const user = (await response.json() as { user: StudioUser }).user;
  if (!identity.cookie || !/httponly/i.test(cookie) || !/secure/i.test(cookie) || user.isAdmin || user.email !== identity.email) throw new Error("Deployed QA session did not meet the identity or cookie requirements.");
  identity.userId = user.id; await save(state);
  await expect(await api(state, "/api/auth/redeem", undefined, { token: identity.token }), 401);
  await scopedUser(identity);
  record(state, `${role}: non-admin single-use invite and secure session`, true);
}
const specSchema = z.object({ mode: z.enum(["url", "prd"]), productUrl: z.string().url().optional(), videoType: z.enum(["launch", "feature-demo"]), format: z.enum(["auto", "16:9", "9:16", "1:1"]), referenceUrl: z.string().url().optional(), files: z.array(z.object({ path: z.string(), kind: z.enum(["prd", "asset", "reference"]), contentType: z.string() }).strict()).max(12).default([]) }).strict();
async function submit(state: RunState) {
  if (!process.argv.includes("--allow-paid")) throw new Error("Submission requires separately approved paid acceptance and --allow-paid.");
  await scopedUser(state.primary);
  const session = await (await expect(await api(state, "/api/session", state.primary), 200)).json() as SessionResponse;
  if (!session.acceptingJobs) throw new Error("The deployment is closed. A separately approved generation-enablement operation is required; the harness will not bypass it.");
  const label = flag("--case");
  if (!["url-launch", "prd-feature-demo"].includes(label ?? "")) throw new Error("Choose --case url-launch or prd-feature-demo.");
  const specPath = confinedPath(root, flag("--spec") ?? "missing");
  const spec = specSchema.parse(JSON.parse(await readFile(specPath, "utf8")));
  if (label === "url-launch" && (spec.mode !== "url" || spec.videoType !== "launch" || spec.format !== "auto" || spec.files.length)) throw new Error("URL acceptance must exercise URL alone, launch and Auto.");
  if (label === "prd-feature-demo" && (spec.mode !== "prd" || spec.videoType !== "feature-demo" || spec.format !== "9:16" || !spec.files.some(f => f.kind === "prd") || !spec.files.some(f => f.kind === "asset"))) throw new Error("PRD acceptance requires feature demo, vertical and real product assets.");
  const specHash = hash(JSON.stringify(spec));
  const job = state.jobs[label!] ??= { idempotencyKey: randomUUID(), uploadIds: [], specHash };
  if (job.specHash !== specHash) throw new Error("A saved acceptance case cannot change inputs under its idempotency key.");
  await save(state);
  job.uploads ??= [];
  job.reservationAttempts ??= {};
  for (let index = 0; index < spec.files.length; index++) {
    const file = spec.files[index]; const path = confinedPath(join(root, "inputs"), file.path);
    if (!/\.(?:png|jpe?g|webp|mp4|mov|webm|pdf|md|txt)$/i.test(extname(path))) throw new Error("Only intentional product/media inputs may be uploaded.");
    const info = await stat(path); if (!info.isFile() || info.size > session.limits.maxFileBytes) throw new Error("Input file is unavailable or oversized.");
    const bytes = await readFile(path); const sha256 = hash(bytes);
    let reserved = job.uploads[index];
    if (reserved && reserved.sha256 !== sha256) throw new Error("A saved source changed. Do not reuse the submission's idempotency key for different file bytes.");
    if (reserved?.ready) continue;
    if (!reserved) {
      if (job.reservationAttempts[String(index)]) throw new Error("Upload preparation has an ambiguous saved outcome. Inspect the exact QA reservation before retrying; no replacement was created.");
      job.reservationAttempts[String(index)] = new Date().toISOString(); await save(state);
      const prepared = await (await expect(await api(state, "/api/uploads/prepare", state.primary, { name: basename(path), size: info.size, contentType: file.contentType, kind: file.kind }), 201)).json() as { upload: UploadRecord & { pathname: string } };
      reserved = { ...prepared.upload, sha256, ready: false };
      job.uploads[index] = reserved; job.uploadIds[index] = reserved.id;
      await save(state); // Persist the assigned ID before sending any object bytes.
    } else {
      // A previous transfer may have completed even if its response was lost.
      const completion = await api(state, "/api/uploads/complete", state.primary, { uploadId: reserved.id });
      if (completion.status === 200) { reserved.ready = true; await save(state); continue; }
      if (completion.status !== 503) throw new Error("The saved upload cannot be recovered; do not manufacture a new reservation on an ambiguous retry.");
    }
    try {
      await upload(reserved.pathname, bytes, { access: "private", contentType: reserved.contentType, handleUploadUrl: `${state.origin}/api/uploads`, headers: { Cookie: state.primary.cookie!, Origin: state.origin }, clientPayload: JSON.stringify({ uploadId: reserved.id }), multipart: info.size > 4_000_000 });
    } catch {
      // Existing immutable object or a lost response: verify that exact reservation.
      await expect(await api(state, "/api/uploads/complete", state.primary, { uploadId: reserved.id }), 200);
    }
    await expect(await api(state, "/api/uploads/complete", state.primary, { uploadId: reserved.id }), 200);
    reserved.ready = true; await save(state);
  }
  const { files: _, ...fields } = spec;
  const input: CreateJobInput = { ...fields, uploadIds: job.uploadIds, idempotencyKey: job.idempotencyKey };
  const first = await (await expect(await api(state, "/api/jobs", state.primary, input), 201)).json() as { job: JobDetail };
  job.id = first.job.id; await save(state);
  const duplicate = await (await expect(await api(state, "/api/jobs", state.primary, input), 201)).json() as { job: JobDetail };
  if (duplicate.job.id !== job.id) throw new Error("Duplicate submission created another job.");
  record(state, `${label}: real API submission and idempotency`, true);
}
async function ownedRows(state: RunState) {
  await scopedUser(state.primary);
  const ids = Object.values(state.jobs).map(job => job.id).filter((id): id is string => Boolean(id));
  return ids.length ? query<JobRow>("SELECT * FROM studio_jobs WHERE user_id=$1 AND id=ANY($2::uuid[])", [state.primary.userId, ids]) : [];
}
async function status(state: RunState) {
  const rows = await ownedRows(state);
  for (const job of rows) {
    await expect(await api(state, `/api/jobs/${job.id}`, state.primary), 200);
    await expect(await api(state, `/api/jobs/${job.id}`), 401);
    if (state.secondary?.cookie) {
      await expect(await api(state, `/api/jobs/${job.id}`, state.secondary), 404);
      await expect(await api(state, `/api/jobs/${job.id}/media?kind=video`, state.secondary), 404);
      for (const upload of job.uploads) await expect(await api(state, "/api/uploads/complete", state.secondary, { uploadId: upload.id }), 404);
      record(state, "Second owner denied job, source upload and output access", true);
    } else record(state, "Second owner isolation", false, "Requires a separately approved second identity; isolated-schema tests are partial evidence only.", false);
    record(state, `Job ${job.id}: owner access and anonymous denial`, true, `Observed state: ${job.status}; attempts: ${job.attempts}`);
  }
  await expect(await api(state, "/api/uploads/prepare", state.primary, { name: "blocked.png", size: 10, contentType: "image/png", kind: "asset" }, { Origin: "https://untrusted.invalid" }), 403);
  record(state, "Cross-origin upload preparation denied", true);
  console.log(JSON.stringify({ phase: "status", jobs: rows.map(job => ({ id: job.id, status: job.status, attempts: job.attempts, qualityPassed: job.quality_passed })) }));
}
async function ledger(job: JobRow) {
  const artifact = job.artifacts["ledger.json"]; if (!artifact) throw new Error("The job has no durable ledger yet.");
  const result = await get(artifact.url, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) throw new Error("The durable ledger is unavailable.");
  if (artifact.size > 256_000) throw new Error("The ledger is unexpectedly large.");
  return await new Response(result.stream).json() as { audioGenerations: number; audio: Record<string, { hash: string; status: string }> };
}
async function interrupt(state: RunState) {
  if (!process.argv.includes("--allow-interruption")) throw new Error("Stopping QA compute requires approved interruption and --allow-interruption.");
  if (state.interruption) throw new Error("This run has already requested its single interruption.");
  const target = flag("--job"); const job = (await ownedRows(state)).find(row => row.id === target);
  if (!job || job.attempts !== 1 || !["rendering", "checking"].includes(job.status)) throw new Error("Interrupt only the recorded QA job's first rendering/checking attempt.");
  const saved = await ledger(job);
  if (saved.audioGenerations !== 2 || Object.keys(saved.audio).length !== 2 || Object.values(saved.audio).some(audio => audio.status !== "completed" || !audio.hash)) throw new Error("Wait until both paid audio artifacts are durably completed before interrupting.");
  const name = job.checkpoint.sandboxName;
  if (typeof name !== "string" || !name.startsWith(`video-studio-job-${job.id}-`)) throw new Error("The recorded sandbox is not scoped to this QA job.");
  state.interruption = { jobId: job.id, attempts: job.attempts, runtimeHash: job.checkpoint.runtimeHash, audio: saved.audio, generations: saved.audioGenerations, requestedAt: new Date().toISOString() }; await save(state);
  await (await Sandbox.get({ name, resume: false })).stop();
  record(state, "QA worker interruption requested", true, "Only the exact recorded QA sandbox was stopped. Lease expiry and production cron must perform recovery.");
}
async function decode(file: string) {
  const executable = process.env.FFMPEG_PATH || "ffmpeg";
  await new Promise<void>((done, reject) => {
    const child = spawn(executable, ["-v", "error", "-xerror", "-i", file, "-map", "0:v:0", "-map", "0:a:0", "-f", "null", "-"], { shell: false, windowsHide: true, stdio: "ignore", env: mediaEnvironment() });
    const timer = setTimeout(() => { child.kill(); reject(new Error("Downloaded MP4 decode exceeded its deadline.")); }, 240_000);
    child.once("error", () => { clearTimeout(timer); reject(new Error("FFmpeg is unavailable for downloaded-file verification.")); });
    child.once("close", code => { clearTimeout(timer); code === 0 ? done() : reject(new Error("The downloaded MP4 failed full-file audio/video decoding.")); });
  });
}
async function delivery(state: RunState) {
  const jobs = await ownedRows(state);
  if (!jobs.length) throw new Error("There are no recorded QA jobs to verify.");
  for (const job of jobs) {
    if (job.status !== "ready" || !job.quality_passed || job.quality?.passed !== true) throw new Error("A QA job is not ready with passed quality. No delivery check will be claimed.");
    const preview = await expect(await api(state, `/api/jobs/${job.id}/media?kind=video`, state.primary, undefined, { Range: "bytes=0-1023" }), 206);
    if (!preview.headers.get("content-range")?.startsWith("bytes 0-1023/")) throw new Error("The owner preview did not support the expected byte range.");
    if ((await preview.arrayBuffer()).byteLength !== 1024) throw new Error("Preview range returned an unexpected byte count.");
    const poster = await expect(await api(state, `/api/jobs/${job.id}/media?kind=poster`, state.primary), 200); await poster.body?.cancel();
    const response = await expect(await api(state, `/api/jobs/${job.id}/media?kind=video&download=1`, state.primary), 200);
    if (!response.body || !response.headers.get("content-disposition")?.includes("attachment")) throw new Error("The final MP4 is not downloadable.");
    const directory = join(root, "downloads"); await mkdir(directory, { recursive: true });
    const file = join(directory, `${job.id}.mp4`); let bytes = 0; const digest = createHash("sha256");
    const bound = new Transform({ transform(chunk: Buffer, _encoding, callback) { bytes += chunk.length; if (bytes > 800 * 1024 * 1024) return callback(new Error("Download exceeded the acceptance storage bound.")); digest.update(chunk); callback(null, chunk); } });
    await pipeline(Readable.fromWeb(response.body as never), bound, createWriteStream(file, { mode: 0o600 }));
    await decode(file);
    record(state, `Job ${job.id}: private preview, poster and decoded download`, true, `Downloaded ${bytes} bytes; SHA-256 ${digest.digest("hex")}. Browser playback inspection remains a separate visual check.`);
    if (state.interruption?.jobId === job.id) {
      const current = await ledger(job); const previous = state.interruption;
      if (job.attempts <= previous.attempts || job.checkpoint.runtimeHash !== previous.runtimeHash || current.audioGenerations !== previous.generations || Object.entries(previous.audio).some(([key, audio]) => current.audio[key]?.hash !== audio.hash || current.audio[key]?.status !== "completed")) throw new Error("Recovery did not preserve the pinned runtime and completed paid audio.");
      record(state, "Interrupted QA worker recovered with identical audio and no extra generation", true);
    }
  }
  await status(state);
}
async function purgePrefix(prefix: string) {
  for (let page = 0; page < 10; page++) {
    const result = await list({ prefix, limit: 500 });
    const urls = result.blobs.filter(blob => blob.pathname.startsWith(prefix)).map(blob => blob.url);
    if (urls.length) await del(urls); if (!result.hasMore) return;
  }
  throw new Error("QA cleanup exceeded its bounded page count; run the same exact cleanup again.");
}
async function revoke(state: RunState, purge: boolean) {
  for (const identity of [state.primary, state.secondary].filter((item): item is Identity => Boolean(item))) {
    const role = identity === state.primary ? "primary" : "secondary";
    if (identity.email !== `qa-${state.runId}-${role}@acceptance.invalid`) throw new Error("Cleanup identity does not match this exact recorded QA run.");
    if (!identity.userId) {
      // Redemption can commit remotely while its HTTP response is lost locally.
      const recovered = await query<{ id: string }>("SELECT id FROM studio_users WHERE email=$1 AND is_admin=false", [identity.email]);
      if (recovered[0]) { identity.userId = recovered[0].id; await save(state); }
    }
    // Expire invitations first, including the precise generated email saved
    // before creation if a crash prevented saving the returned invitation ID.
    await query("UPDATE studio_invitations SET expires_at=LEAST(expires_at,now()) WHERE email=$1 AND email LIKE 'qa-%@acceptance.invalid'", [identity.email]);
    if (identity.userId) {
      await scopedUser(identity);
      const db = database();
      await db.transaction([
        db.query("UPDATE studio_users SET disabled_at=now() WHERE id=$1 AND email=$2 AND is_admin=false", [identity.userId, identity.email]),
        db.query("DELETE FROM studio_sessions WHERE user_id=$1", [identity.userId]),
      ]);
      identity.cookie = undefined; identity.token = undefined; identity.revoked = true; await save(state);
      const jobs = await query<JobRow>("SELECT * FROM studio_jobs WHERE user_id=$1", [identity.userId]);
      for (const job of jobs) {
        await query("UPDATE studio_jobs SET status=CASE WHEN status IN ('queued','reading','planning','rendering','checking') THEN 'cancelled' ELSE status END,lease_token=NULL,lease_expires_at=NULL WHERE id=$1 AND user_id=$2", [job.id, identity.userId]);
        const name = job.checkpoint.sandboxName;
        if (typeof name === "string" && name.startsWith(`video-studio-job-${job.id}-`) && ["reading", "planning", "rendering", "checking"].includes(job.status)) {
          try { await (await Sandbox.get({ name, resume: false })).stop(); }
          catch (error) { if (!(error && typeof error === "object" && "status" in error && error.status === 404)) throw new Error("QA access is revoked, but stopping its recorded sandbox still needs operator verification."); }
        }
        if (purge) {
          const grants = await query<{ recent: boolean }>("SELECT EXISTS(SELECT 1 FROM studio_artifact_reservations WHERE job_id=$1 AND created_at>now()-interval '16 minutes') AS recent", [job.id]);
          if (grants[0].recent) throw new Error("QA access is revoked. Wait at least 16 minutes after the most recent upload grant before purging objects.");
          await purgePrefix(`jobs/${job.id}/`); await query("DELETE FROM studio_jobs WHERE id=$1 AND user_id=$2", [job.id, identity.userId]);
        }
      }
      if (purge) {
        const pending = await query<{ recent: boolean }>("SELECT EXISTS(SELECT 1 FROM studio_uploads WHERE user_id=$1 AND GREATEST(created_at,coalesce(verified_at,created_at))>now()-interval '16 minutes') AS recent", [identity.userId]);
        if (pending[0].recent) throw new Error("QA access is revoked. Wait at least 16 minutes after the most recent source upload before purging objects.");
        await purgePrefix(`uploads/${identity.userId}/`); await query("DELETE FROM studio_uploads WHERE user_id=$1", [identity.userId]);
      }
    }
    identity.cookie = undefined; identity.token = undefined; identity.revoked = true;
    record(state, `${identity === state.primary ? "Primary" : "Secondary"} QA access revoked${purge ? "; artifacts purged" : ""}`, true);
    await save(state);
  }
}
async function confirmClosed(state: RunState) {
  const session = await (await expect(await api(state, "/api/session"), 200)).json() as SessionResponse;
  state.closedConfirmed = !session.acceptingJobs;
  record(state, "Deployed generation returned to closed beta", state.closedConfirmed);
  if (!state.closedConfirmed) throw new Error("Generation is still enabled. The operator must restore BETA_ACCEPTING_JOBS=false and redeploy before acceptance cleanup is complete.");
}
async function main() {
  const phase = flag("--phase") ?? "plan";
  if (phase === "plan") { console.log(JSON.stringify(acceptancePlan(), null, 2)); return; }
  if (!process.argv.includes("--execute")) throw new Error("Prepared only. Run a mutating phase only after its exact pending approval is resolved, then pass --execute.");
  let state: RunState;
  try { state = JSON.parse(await readFile(stateFile, "utf8")); }
  catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw new Error("The saved acceptance state is unreadable. Preserve it for cleanup instead of creating a new run.");
    if (phase !== "provision") throw new Error("No recorded acceptance run exists.");
    const origin = new URL(flag("--origin") ?? "").origin;
    if (!origin.startsWith("https://")) throw new Error("Deployed acceptance requires an explicit HTTPS --origin.");
    const runId = randomUUID();
    state = { version: 1, runId, origin, primary: { email: `qa-${runId}-primary@acceptance.invalid`, allowance: 2 }, jobs: {}, evidence: [] };
  }
  try {
    if (phase === "provision") await provision(state, "primary");
    else if (phase === "provision-second") {
      if (!process.argv.includes("--second-identity-approved")) throw new Error("A second identity is outside the original single-account approval. Separate approval and --second-identity-approved are required.");
      await provision(state, "secondary");
    } else if (phase === "submit") await submit(state);
    else if (phase === "status") await status(state);
    else if (phase === "interrupt") await interrupt(state);
    else if (phase === "delivery") await delivery(state);
    else if (phase === "revoke" || phase === "purge") { await revoke(state, phase === "purge"); await confirmClosed(state); }
    else if (phase === "confirm-closed") await confirmClosed(state);
    else throw new Error("Unknown acceptance phase.");
    await save(state);
    console.log(JSON.stringify({ phase, completed: true, runId: state.runId, evidenceCount: state.evidence.length, report: ".local/deployed-acceptance/report.json" }));
  } catch (error) {
    record(state, `${phase}: stopped`, false, error instanceof Error ? error.name : "UnknownError"); await save(state);
    // Do not automatically create users, retry paid work, stop other sandboxes,
    // change hosting settings, or print provider errors/tokens on failure.
    console.error(JSON.stringify({ phase, completed: false, reason: error instanceof Error && error.message.startsWith("Acceptance HTTP") ? error.message : "Phase stopped; inspect this script's preconditions and ignored evidence. If generation was enabled, restore BETA_ACCEPTING_JOBS=false and redeploy, then run confirm-closed." }));
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main().catch(() => { console.error("Acceptance did not start. No cloud mutation is performed in the default plan phase."); process.exitCode = 1; });
