import type { InputMode, JobStatus, OutputFormat, StudioLimits, VideoType } from "../lib/contracts";

export type FileInput = { id: string; name: string; kind: "prd" | "asset" | "reference"; url: string; mimeType: string; size?: number };
export interface WorkerInput {
  jobId: string; ownerId: string; mode: InputMode; productUrl?: string; videoType: VideoType;
  format: OutputFormat; files: FileInput[]; referenceUrl?: string;
  resume?: Record<string, string>;
  runtimeHash?: string; runtimeId?: string;
  deadlineAt?: string;
  limits?: StudioLimits;
  budgets?: { maxDurationSeconds?: number; maxModelCalls?: number; maxRepairPasses?: number; maxWallSeconds?: number; maxAudioGenerations?: number; maxModelInputTokens?: number; maxModelOutputTokens?: number };
}
export interface Asset {
  id: string; path: string; kind: "image" | "video" | "audio"; usage: "output" | "reference";
  rights: string; width: number; height: number; duration_seconds?: number; has_audio?: boolean;
  preview?: string; transcript?: Transcript; source?: string;
}
export interface Transcript { text: string; words: { text: string; start: number; end: number; type: string }[] }
export interface Evidence { text: string; assets: Asset[]; reference?: { aspect: number; description: unknown; measurements: unknown }; capturedUrl?: string }
export interface Presentation {
  template: "hook" | "brand" | "proof" | "features" | "offer" | "cta";
  theme: "light" | "dark";
  transition: "cut" | "iris" | "lift" | "expand";
  /** Informational graphics, never invented application controls. Quotes are bound by the compiler. */
  cards?: { title: string; body: string; evidenceId: string; evidence?: string }[];
}
export interface Scene {
  id: string; start_frame: number; duration_frames: number; asset_id: string; source_in_seconds: number;
  playback_rate: 1; preserve_audio: boolean; fit: "contain"; purpose: string; reference_technique: string;
  headline: string; detail: string; evidence: string; effects: { type: string; implementation: string }[];
  presentation?: Presentation;
}
export interface Plan {
  version: 1; job_id: string; mode: "create"; renderer: "ffmpeg" | "hyperframes";
  output: { width: number; height: number; fps: 30; duration_frames: number };
  product: string; summary: string; accent: string; background: "light" | "dark";
  assets: Asset[]; scenes: Scene[]; captions: never[];
  audio: { asset_id: string; start_frame: number; duration_frames: number; source_in_seconds: number; playback_rate: 1; gain_db: number; role: "music" | "sfx" }[];
  music_prompt: string; sfx_prompt: string; assumptions: string[];
  production?: { researchSha256: string; scriptSha256: string; evidenceSha256: string };
}
export interface Finding { severity: "critical" | "major" | "minor"; sceneId?: string; timeSeconds?: number; message: string; repair?: "shorten_copy" | "simplify_copy" | "change_asset" | "extend_hold" }
export interface QC { status: "passed" | "needs_review"; passed: boolean; checks: Record<string,{passed:boolean;performed:boolean;evidence:string}>; technical: Record<string, unknown>; visual: unknown; audio: unknown; findings: Finding[]; repairs: string[]; evidence: string[] }
export interface AudioFailure {
  attempt: number; httpStatus: number; code: string | null; type: string | null; requestId: string | null;
  classification: "rate_limit" | "quota" | "access" | "unknown"; receivedAt: number; retryAfterMs: number | null;
}
export interface AudioAttempts { attempts: number; requestHash: string; failures: AudioFailure[] }
export type AudioLedgerEntry =
  | ({ status: "reserved" | "completed"; path: string; hash: string } & Partial<AudioAttempts>)
  | ({ status: "retry_wait"; path: string; hash: ""; nextAttemptAt: number } & AudioAttempts)
  | ({ status: "rejected"; path: string; hash: "" } & AudioAttempts);
export interface Ledger { modelCalls: number; inputTokens: number; outputTokens: number; reservedInputTokens: number; reservedOutputTokens: number; audioGenerations: number; asrSeconds: number; providerRequests: { provider: string; operation: string; requestId: string | null; units: number; unit: string; model?:string; songId?:string|null }[]; audio: Record<string, AudioLedgerEntry> }
export interface PipelineResult { videoPath: string; posterPath: string; quality: QC; durationSeconds: number; width: number; height: number; costUsd: number | null; versions: Record<string, string> }
export interface Hooks { persist(paths: string[]): Promise<void>; state(status: JobStatus, checkpoint?: Record<string, unknown>): Promise<void>; complete(result: PipelineResult): Promise<void> }
export class PipelineError extends Error {
  constructor(public code: string, message: string, public action: string, public status: "needs_input" | "needs_review" | "failed" = "failed", public retryable = false) { super(message); }
}
