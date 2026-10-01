import { z } from "zod";
import type { Ledger } from "./types";
import { classifyAudioFailure, MAX_AUDIO_ATTEMPTS } from "./audio-retry";

const counter = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const seconds = z.number().finite().nonnegative();
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const identifier = z.string().min(1).max(512);
const receipt = z.object({
  provider: z.enum(["anthropic", "vercel-ai-gateway", "elevenlabs"]),
  operation: z.string().min(1).max(128),
  requestId: identifier.nullable(),
  units: seconds,
  unit: z.enum(["tokens", "seconds"]),
  model: identifier.optional(),
  songId: identifier.nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.provider === "elevenlabs") {
    if (value.unit !== "seconds") context.addIssue({ code: "custom", message: "Audio receipt must use seconds" });
  } else if (value.unit !== "tokens" || !Number.isSafeInteger(value.units) || !value.model) {
    context.addIssue({ code: "custom", message: "Model receipt needs integer token units and a model" });
  }
});
const audioPath = z.string().regex(/^assets\/(music|sfx)-[a-f0-9]{16}\.mp3$/);
const safeIdentifier = z.string().min(1).max(512).regex(/^[A-Za-z0-9_.:-]+$/);
const failure = z.object({
  attempt: counter.min(1).max(MAX_AUDIO_ATTEMPTS), httpStatus: counter.min(400).max(599),
  code: safeIdentifier.max(128).nullable(), type: safeIdentifier.max(128).nullable(), requestId: safeIdentifier.nullable(),
  classification: z.enum(["rate_limit", "quota", "access", "unknown"]), receivedAt: counter, retryAfterMs: counter.nullable(),
}).strict().superRefine((value, context) => {
  if (value.classification !== classifyAudioFailure(value.httpStatus, value.code, value.type)) context.addIssue({ code: "custom", message: "Audio rejection classification does not match its provider evidence" });
  if (value.retryAfterMs !== null && !Number.isSafeInteger(value.receivedAt + value.retryAfterMs)) context.addIssue({ code: "custom", message: "Audio retry time exceeds the supported range" });
});
const attempts = { attempts: counter.min(1).max(MAX_AUDIO_ATTEMPTS), requestHash: digest, failures: z.array(failure).max(MAX_AUDIO_ATTEMPTS) };
const optionalAttempts = { attempts: attempts.attempts.optional(), requestHash: digest.optional(), failures: attempts.failures.optional() };
const audioEntry = z.discriminatedUnion("status", [
  z.object({ status: z.literal("reserved"), path: audioPath, hash: z.literal(""), ...optionalAttempts }).strict(),
  z.object({ status: z.literal("completed"), path: audioPath, hash: digest, ...optionalAttempts }).strict(),
  z.object({ status: z.literal("retry_wait"), path: audioPath, hash: z.literal(""), nextAttemptAt: counter, ...attempts }).strict(),
  z.object({ status: z.literal("rejected"), path: audioPath, hash: z.literal(""), ...attempts }).strict(),
]).superRefine((value, context) => {
  if (value.attempts === undefined && value.requestHash === undefined && value.failures === undefined) return; // Unchanged legacy entries.
  if (value.attempts === undefined || value.requestHash === undefined || value.failures === undefined) {
    context.addIssue({ code: "custom", message: "Audio attempt accounting must be complete" }); return;
  }
  const failures = value.failures;
  if (failures.some((item, index) => item.attempt !== index + 1 || (index < failures.length - 1 && item.classification !== "rate_limit"))) context.addIssue({ code: "custom", message: "Audio attempts are not a consecutive sequence of confirmed rate-limit rejections" });
  const terminal = value.status === "retry_wait" || value.status === "rejected";
  if (failures.length !== value.attempts - (terminal ? 0 : 1) && !(value.status === "reserved" && failures.length === value.attempts && failures.at(-1)?.classification === "unknown")) context.addIssue({ code: "custom", message: "Audio attempt count does not match retained outcomes" });
  if (!terminal && failures.slice(0, value.attempts - 1).some(item => item.classification !== "rate_limit")) context.addIssue({ code: "custom", message: "Audio work followed an unresolved rejection" });
  if (value.status === "retry_wait") {
    const last = failures.at(-1);
    if (!last || last.classification !== "rate_limit" || value.nextAttemptAt < last.receivedAt + (last.retryAfterMs ?? 0)) context.addIssue({ code: "custom", message: "Audio retry is not backed by a confirmed rejection and provider delay" });
  }
  if (value.status === "rejected" && !["quota", "access"].includes(failures.at(-1)?.classification ?? "")) context.addIssue({ code: "custom", message: "Audio rejection needs a confirmed quota/access outcome" });
});
const ledgerSchema = z.object({
  modelCalls: counter,
  inputTokens: counter,
  outputTokens: counter,
  reservedInputTokens: counter,
  reservedOutputTokens: counter,
  audioGenerations: counter,
  asrSeconds: seconds,
  providerRequests: z.array(receipt),
  audio: z.record(digest, audioEntry),
}).strict().superRefine((value, context) => {
  for (const [key, audio] of Object.entries(value.audio)) {
    if (!audio.path.endsWith(`-${key.slice(0, 16)}.mp3`)) context.addIssue({ code: "custom", path: ["audio", key, "path"], message: "Audio path does not match its reservation key" });
  }
});

/** Persisted accounting is authoritative: never coerce, default, or repair it during restore. */
export function parseProviderLedger(value: unknown): Ledger {
  return ledgerSchema.parse(value);
}
