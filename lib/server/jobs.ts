import { z } from "zod";
import type { CreateJobInput, JobDetail, JobStatus, JobSummary, UploadRecord } from "../contracts";
import { limits } from "./config";
import { query } from "./db";
import { ApiError } from "./http";
import { hashToken, privateBlobUrl, publicUrl } from "./security";

export interface JobArtifact { pathname: string; url: string; contentType: string; size: number; sha256?: string; reservationId?: string }
export interface WorkerUpload extends UploadRecord { pathname: string; url: string }
export interface JobRow {
  id: string; user_id: string; idempotency_key: string; input_hash: string; title: string; status: JobStatus;
  input: CreateJobInput; uploads: WorkerUpload[]; stages: { stage: string; at: string }[];
  checkpoint: Record<string, unknown>; artifacts: Record<string, JobArtifact>; runtime_version: string; skill_version: string;
  attempts: number; lease_token: string | null; lease_expires_at: string | null; worker_id: string | null;
  video: JobArtifact | null; poster: JobArtifact | null; quality: Record<string, unknown> | null; quality_passed: boolean;
  duration_seconds: number | null; width: number | null; height: number | null; cost_usd: number | string | null;
  error: { code: string; message: string; action: string } | null;
  created_at: string; updated_at: string; started_at: string | null; completed_at: string | null; expires_at: string;
}

export const createJobSchema = z.object({
  mode: z.enum(["url", "prd"]), productUrl: z.string().max(2048).optional(),
  videoType: z.enum(["launch", "feature-demo"]).default("launch"),
  format: z.enum(["auto", "16:9", "9:16", "1:1"]).default("auto"),
  uploadIds: z.array(z.string().uuid()).max(30).default([]),
  referenceUrl: z.string().max(2048).optional(), idempotencyKey: z.string().uuid(),
}).strict().superRefine((input, ctx) => {
  if (input.mode === "url" && !input.productUrl?.trim()) ctx.addIssue({ code: "custom", path: ["productUrl"], message: "Add your public product URL." });
  if (input.mode === "prd" && input.productUrl) ctx.addIssue({ code: "custom", path: ["productUrl"], message: "Use a product URL or a PRD, one at a time." });
  if (new Set(input.uploadIds).size !== input.uploadIds.length) ctx.addIssue({ code: "custom", path: ["uploadIds"], message: "Remove duplicate uploaded files." });
});

const iso = (value: string | Date | null) => value === null ? null : new Date(value).toISOString();
export function jobSummary(row: JobRow): JobSummary {
  return { id: row.id, title: row.title, status: row.status, mode: row.input.mode, videoType: row.input.videoType, format: row.input.format,
    createdAt: iso(row.created_at)!, updatedAt: iso(row.updated_at)!, startedAt: iso(row.started_at), completedAt: iso(row.completed_at),
    durationSeconds: row.duration_seconds, width: row.width, height: row.height, error: row.error };
}
export function jobDetail(row: JobRow): JobDetail {
  return { ...jobSummary(row), productUrl: row.input.productUrl ?? null,
    uploads: row.uploads.map(({ id, name, size, contentType, kind }) => ({ id, name, size: Number(size), contentType, kind })),
    stages: row.stages, qualityPassed: row.quality_passed };
}

export async function listJobs(userId: string) {
  return (await query<JobRow>("SELECT * FROM studio_jobs WHERE user_id=$1 AND expires_at>now() ORDER BY created_at DESC LIMIT 100", [userId])).map(jobSummary);
}
export async function ownedJob(id: string, userId: string) {
  if (!z.string().uuid().safeParse(id).success) throw new ApiError(404, "JOB_NOT_FOUND", "This video could not be found.");
  const rows = await query<JobRow>("SELECT * FROM studio_jobs WHERE id=$1 AND user_id=$2 AND expires_at>now()", [id, userId]);
  if (!rows[0]) throw new ApiError(404, "JOB_NOT_FOUND", "This video could not be found.");
  return rows[0];
}

const submissionErrors: Record<string, [number, string, string]> = {
  IDEMPOTENCY_CONFLICT: [409, "This submission was already used for another video.", "Refresh the form and submit again."],
  BETA_ALLOWANCE: [429, "You have used your beta video allowance.", "Ask the studio owner for additional access."],
  DAILY_LIMIT: [429, "You have reached today's video limit.", "Please try again tomorrow."],
  ACTIVE_LIMIT: [429, "Your studio is already working on the maximum number of videos.", "Wait for one of your videos to finish."],
  UPLOAD_UNAVAILABLE: [400, "One of your uploaded files is unavailable.", "Upload the missing file again before submitting."],
  UPLOAD_LIMIT: [400, "The uploaded files exceed this beta's limits.", "Remove some files or use smaller recordings."],
  PRD_REQUIREMENTS: [400, "Add one PRD and at least one product image or recording.", "Upload a text PDF, Markdown, or plain-text PRD, plus a visual asset."],
  UNEXPECTED_PRD: [400, "PRDs are supported in the PRD input mode.", "Switch to PRD mode or remove the PRD file."],
  REFERENCE_LIMIT: [400, "Use one reference per video.", "Choose a reference link or a reference upload."],
  ACCOUNT_DISABLED: [403, "Your beta access is currently unavailable.", "Contact the studio owner."],
};

export async function createJob(userId: string, rawInput: unknown): Promise<JobRow> {
  const input: CreateJobInput = createJobSchema.parse(rawInput);
  input.uploadIds = [...input.uploadIds].sort();
  if (input.productUrl) input.productUrl = publicUrl(input.productUrl.trim());
  if (input.referenceUrl?.trim()) input.referenceUrl = publicUrl(input.referenceUrl.trim()); else delete input.referenceUrl;
  const budget = limits();
  const title = input.productUrl ? new URL(input.productUrl).hostname.replace(/^www\./, "") : input.videoType === "launch" ? "Product launch" : "Feature demo";
  const { idempotencyKey, ...canonicalInput } = input;
  try {
    const rows = await query<JobRow>("SELECT * FROM studio_create_job($1,$2,$3,$4,$5::jsonb,$6::uuid[],$7,$8,$9,$10,$11,$12,$13)",
      [userId, idempotencyKey, hashToken(JSON.stringify(canonicalInput)), title, JSON.stringify(input), input.uploadIds, budget.maxActiveJobs, budget.maxJobsPerDay, budget.maxFiles, budget.maxTotalBytes, budget.retentionDays, process.env.WORKER_RUNTIME_VERSION ?? "video-studio-0.2.0", process.env.VIDEO_STUDIO_SKILL_VERSION ?? "mvp-2026-09-30"]);
    return rows[0];
  } catch (error) {
    if (error instanceof Error) {
      const entry = Object.entries(submissionErrors).find(([code]) => error.message.includes(code));
      if (entry) throw new ApiError(entry[1][0], entry[0], entry[1][1], entry[1][2]);
    }
    throw error;
  }
}

export async function claimNextJob(options: { workerId: string; maxAttempts?: number; leaseSeconds?: number; globalConcurrency?: number; userConcurrency?: number }): Promise<JobRow | null> {
  const { workerId, maxAttempts = 3, leaseSeconds = 180, globalConcurrency = 2, userConcurrency = 1 } = options;
  const rows = await query<JobRow>("SELECT * FROM studio_claim_job($1,$2,$3,$4,$5)", [workerId, maxAttempts, leaseSeconds, globalConcurrency, userConcurrency]);
  return rows[0] ?? null;
}
export async function getJobForWorker(id: string, leaseToken?: string): Promise<JobRow | null> {
  if (leaseToken) return assertJobLease(id, leaseToken);
  const rows = await query<JobRow>("SELECT * FROM studio_jobs WHERE id=$1", [id]);
  return rows[0] ?? null;
}
export async function assertJobLease(id: string, leaseToken: string): Promise<JobRow> {
  if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(leaseToken).success) throw new ApiError(409, "LEASE_LOST", "This worker no longer owns the video job.");
  const rows = await query<JobRow>(`SELECT * FROM studio_jobs WHERE ${activeLease}`, [id, leaseToken]);
  if (!rows[0]) throw new ApiError(409, "LEASE_LOST", "This worker no longer owns the video job.");
  return rows[0];
}
async function leaseMutation(sql: string, params: unknown[]): Promise<JobRow> {
  const rows = await query<JobRow>(sql, params);
  if (!rows[0]) throw new ApiError(409, "LEASE_LOST", "This worker no longer owns the video job.");
  return rows[0];
}
const activeLease = "id=$1 AND lease_token=$2 AND lease_expires_at>now() AND expires_at>now() AND status IN ('reading','planning','rendering','checking')";
export async function heartbeatJob(id: string, leaseToken: string, leaseSeconds = 180): Promise<JobRow> {
  return leaseMutation(`UPDATE studio_jobs SET lease_expires_at=now()+make_interval(secs=>$3),updated_at=now() WHERE ${activeLease} RETURNING *`, [id, leaseToken, leaseSeconds]);
}
export async function checkpointJob(id: string, leaseToken: string, stage: "reading" | "planning" | "rendering" | "checking", checkpoint: Record<string, unknown> = {}): Promise<JobRow> {
  z.enum(["reading", "planning", "rendering", "checking"]).parse(stage);
  if (JSON.stringify(checkpoint).length > 256_000) throw new ApiError(413, "CHECKPOINT_TOO_LARGE", "Save large checkpoint files as artifacts.");
  return leaseMutation(`UPDATE studio_jobs SET status=$3,checkpoint=checkpoint||$4::jsonb,stages=CASE WHEN status<>$3 THEN stages||jsonb_build_array(jsonb_build_object('stage',$3::text,'at',now())) ELSE stages END,updated_at=now() WHERE ${activeLease} RETURNING *`, [id, leaseToken, stage, JSON.stringify(checkpoint)]);
}
export async function reserveJobArtifact(id: string, leaseToken: string, input: { path: string; pathname: string; size: number; contentType: string }): Promise<{ grantId: string }> {
  validateRelativePath(input.path);
  if (!input.pathname.startsWith(`jobs/${id}/`) || input.pathname.includes("..") || !Number.isSafeInteger(input.size) || input.size <= 0 || !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(input.contentType)) throw new ApiError(400, "INVALID_ARTIFACT", "Invalid job artifact reservation.");
  try {
    const rows = await query<{ id: string }>("SELECT id FROM studio_reserve_artifact($1,$2,$3,$4,$5,$6)", [id, leaseToken, input.path, input.pathname, input.size, input.contentType]);
    return { grantId: rows[0].id };
  } catch (error) {
    if (error instanceof Error && error.message.includes("ARTIFACT_BUDGET")) throw new ApiError(413, "ARTIFACT_BUDGET", "The job has reached its storage budget.");
    if (error instanceof Error && error.message.includes("LEASE_LOST")) throw new ApiError(409, "LEASE_LOST", "This worker no longer owns the video job.");
    throw error;
  }
}
export async function recordJobArtifact(id: string, leaseToken: string, relativePath: string, artifact: JobArtifact, reservationId?: string): Promise<JobRow> {
  validateArtifact(id, artifact);
  validateRelativePath(relativePath);
  if (!z.string().uuid().safeParse(reservationId).success) throw new ApiError(400, "ARTIFACT_RESERVATION_REQUIRED", "Reserve this artifact before uploading it.");
  try {
    const rows = await query<JobRow>("SELECT * FROM studio_complete_artifact($1,$2,$3,$4,$5::jsonb)", [id, leaseToken, reservationId, relativePath, JSON.stringify(artifact)]);
    return rows[0];
  } catch (error) {
    if (error instanceof Error && error.message.includes("LEASE_LOST")) throw new ApiError(409, "LEASE_LOST", "This worker no longer owns the video job.");
    if (error instanceof Error && /ARTIFACT_MISMATCH|ARTIFACT_SUPERSEDED/.test(error.message)) throw new ApiError(409, "ARTIFACT_MISMATCH", "This artifact no longer matches its reserved upload.");
    throw error;
  }
}
function validateRelativePath(relativePath: string) {
  if (relativePath.length > 512 || relativePath.startsWith("/") || relativePath.includes("\\") || relativePath.split("/").some(segment => !segment || segment === "." || segment === "..")) throw new ApiError(400, "INVALID_ARTIFACT_PATH", "Invalid artifact path.");
}
function validateArtifact(id: string, artifact: JobArtifact) {
  if (!artifact.pathname.startsWith(`jobs/${id}/`) || !Number.isSafeInteger(artifact.size) || artifact.size <= 0) throw new ApiError(400, "INVALID_ARTIFACT", "Invalid job artifact.");
  privateBlobUrl(artifact.url, artifact.pathname);
}

export const REQUIRED_QUALITY_CHECKS = ["technical", "timeline", "readability", "claims", "real_visuals", "reference_exclusion", "audio", "render_integrity"] as const;
export function assertQualityPassed(quality: Record<string, unknown>) {
  const checks = quality.checks as Record<string, { passed?: boolean; performed?: boolean }> | undefined;
  if (quality.passed !== true || !checks || REQUIRED_QUALITY_CHECKS.some(name => checks[name]?.passed !== true || checks[name]?.performed !== true)) throw new ApiError(422, "QUALITY_NOT_PASSED", "Every required quality check must pass before delivery.");
}
export async function completeJob(id: string, leaseToken: string, output: { video: JobArtifact; poster: JobArtifact; quality: Record<string, unknown>; costUsd: number | null; durationSeconds: number; width: number; height: number }): Promise<JobRow> {
  assertQualityPassed(output.quality); validateArtifact(id, output.video); validateArtifact(id, output.poster);
  if (output.video.contentType !== "video/mp4" || !["image/jpeg", "image/png"].includes(output.poster.contentType)) throw new ApiError(422, "INVALID_OUTPUT", "The output needs an MP4 and preview image.");
  if (!Number.isFinite(output.durationSeconds) || output.durationSeconds <= 0 || output.durationSeconds > 300 || (output.costUsd !== null && (!Number.isFinite(output.costUsd) || output.costUsd < 0)) || !["1920x1080", "1080x1920", "1080x1080"].includes(`${output.width}x${output.height}`)) throw new ApiError(422, "INVALID_OUTPUT", "The output does not meet the video delivery requirements.");
  return leaseMutation(`UPDATE studio_jobs SET status='ready',video=$3::jsonb,poster=$4::jsonb,quality=$5::jsonb,quality_passed=true,cost_usd=GREATEST(cost_usd,$6),duration_seconds=$7,width=$8,height=$9,completed_at=now(),updated_at=now(),lease_token=NULL,lease_expires_at=NULL,worker_id=NULL,error=NULL,stages=stages||jsonb_build_array(jsonb_build_object('stage','ready','at',now())) WHERE ${activeLease} AND status='checking' AND (input->>'format' IN ('auto',$10)) RETURNING *`, [id, leaseToken, JSON.stringify(output.video), JSON.stringify(output.poster), JSON.stringify(output.quality), output.costUsd, output.durationSeconds, output.width, output.height, output.width === output.height ? "1:1" : output.width > output.height ? "16:9" : "9:16"]);
}
export async function failJob(id: string, leaseToken: string, failure: { code: string; message: string; action: string; retryable?: boolean; status?: "failed" | "needs_input" | "needs_review"; maxAttempts?: number; quality?: Record<string, unknown>; costUsd?: number | null }): Promise<JobRow> {
  const { maxAttempts = 3, status = "failed" } = failure;
  const error = { code: failure.code.slice(0, 80), message: failure.message.slice(0, 1000), action: failure.action.slice(0, 1000) };
  return leaseMutation(`UPDATE studio_jobs SET status=CASE WHEN $3 AND attempts<$4 THEN 'queued' ELSE $5 END,error=$6::jsonb,quality=coalesce($7::jsonb,quality),cost_usd=GREATEST(cost_usd,$8),lease_token=NULL,lease_expires_at=NULL,worker_id=NULL,updated_at=now(),available_at=now()+make_interval(secs=>LEAST(300,30*attempts)),completed_at=CASE WHEN $3 AND attempts<$4 THEN NULL ELSE now() END WHERE ${activeLease} RETURNING *`, [id, leaseToken, failure.retryable ?? false, maxAttempts, status, JSON.stringify(error), failure.quality ? JSON.stringify(failure.quality) : null, failure.costUsd ?? null]);
}
