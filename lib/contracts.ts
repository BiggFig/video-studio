export type InputMode = "url" | "prd";
export type VideoType = "launch" | "feature-demo";
export type OutputFormat = "auto" | "16:9" | "9:16" | "1:1";
export type UploadKind = "prd" | "asset" | "reference";
export type JobStatus = "queued" | "reading" | "planning" | "rendering" | "checking" | "ready" | "needs_input" | "needs_review" | "failed" | "cancelled";
export interface StudioUser { id: string; email: string; name: string; isAdmin: boolean }
export interface UploadRecord { id: string; name: string; size: number; contentType: string; kind: UploadKind }
export interface CreateJobInput { mode: InputMode; productUrl?: string; videoType: VideoType; format: OutputFormat; uploadIds: string[]; referenceUrl?: string; idempotencyKey: string }
export interface JobSummary { id: string; title: string; status: JobStatus; mode: InputMode; videoType: VideoType; format: OutputFormat; createdAt: string; updatedAt: string; startedAt: string | null; completedAt: string | null; durationSeconds: number | null; width: number | null; height: number | null; error: {code: string; message: string; action: string} | null; }
export interface JobDetail extends JobSummary { productUrl: string | null; uploads: UploadRecord[]; stages: {stage: string; at: string}[]; qualityPassed: boolean; }
export interface StudioLimits { maxFiles: number; maxFileBytes: number; maxTotalBytes: number; maxPrdBytes: number; maxReferenceBytes: number; maxSourceDurationSeconds: number; maxReferenceDurationSeconds: number; maxActiveJobs: number; maxJobsPerDay: number; retentionDays: number }
export interface SessionResponse { user: StudioUser | null; configured: boolean; acceptingJobs: boolean; limits: StudioLimits }
export const STAGES = ["queued", "reading", "planning", "rendering", "checking", "ready"] as const;
export const STAGE_LABELS: Record<JobStatus, string> = {queued: "Queued", reading: "Reading product and assets", planning: "Planning video", rendering: "Building and rendering", checking: "Checking quality", ready: "Ready", needs_input: "A little more to work with", needs_review: "Quality check needs attention", failed: "Couldn’t finish this video", cancelled: "Cancelled"};
