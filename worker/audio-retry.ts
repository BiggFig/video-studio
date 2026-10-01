import { PipelineError, type AudioFailure } from "./types";

// Only explicit documented rejection codes permit another POST. HTTP 429 alone
// is not enough to classify a historical or malformed response safely.
// https://elevenlabs.io/docs/eleven-api/resources/errors
// https://elevenlabs.io/docs/help-center/technical/api-error-code-429
export const MAX_AUDIO_ATTEMPTS = 3;
export const MAX_AUDIO_ERROR_BYTES = 16_384;
const RATE_CODES = new Set(["rate_limit_exceeded", "concurrent_limit_exceeded", "too_many_concurrent_requests", "system_busy"]);
const ACCESS_CODES = new Set(["invalid_api_key", "missing_api_key", "unauthorized", "forbidden", "insufficient_permissions", "workspace_access_denied", "feature_not_available", "subscription_required", "model_access_denied"]);
const token = (value: unknown, max: number): string | null => typeof value === "string" && value.length <= max && /^[A-Za-z0-9_.:-]+$/.test(value) ? value : null;

export function classifyAudioFailure(httpStatus: number, code: string | null, type: string | null): AudioFailure["classification"] {
  if (httpStatus === 402 || code === "insufficient_credits" || code === "quota_exceeded") return "quota";
  if (httpStatus === 401 || httpStatus === 403 || (code !== null && ACCESS_CODES.has(code))) return "access";
  if (httpStatus === 429 && code !== null && RATE_CODES.has(code) && (type === null || type === "rate_limit_error")) return "rate_limit";
  return "unknown";
}

/** RFC 9110: seconds or HTTP-date. Invalid values never become a zero delay. */
export function retryAfterMs(value: string | null, now: number): number | null {
  if (!value) return null;
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    const delay = Number(text) * 1000;
    // A valid but enormous delay must stop this job, never fall back to seconds.
    return Number.isSafeInteger(delay) && delay >= 0 && Number.isSafeInteger(now + delay) ? delay : Number.MAX_SAFE_INTEGER - now;
  }
  if (text.length > 128) return null;
  // Avoid Date.parse accepting unrelated strings such as "-1" or "1.5".
  if (!/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(text)) return null;
  const date = Date.parse(text);
  return Number.isSafeInteger(date) ? Math.max(0, date - now) : null;
}

async function errorJson(response: Response): Promise<unknown> {
  if (!response.body || Number(response.headers.get("content-length")) > MAX_AUDIO_ERROR_BYTES) { await response.body?.cancel(); throw new Error("Invalid error body"); }
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_AUDIO_ERROR_BYTES) { await reader.cancel(); throw new Error("Oversized error body"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** Retain identifiers, never provider messages, source prompts, keys or exception text. */
export async function audioFailure(response: Response, attempt: number, receivedAt: number): Promise<AudioFailure> {
  let code: string | null = null, type: string | null = null, bodyRequestId: string | null = null;
  try {
    const body = await errorJson(response);
    const detail = body && typeof body === "object" && "detail" in body ? body.detail : undefined;
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      // A supplied modern code is authoritative, even if malformed/unknown.
      code = token("code" in detail ? detail.code : "status" in detail ? detail.status : undefined, 128);
      type = token("type" in detail ? detail.type : undefined, 128);
      bodyRequestId = token("request_id" in detail ? detail.request_id : undefined, 512);
      if ("type" in detail && type === null) code = null;
    }
  } catch { /* An unreadable error cannot authorize a retry. */ }
  return {
    attempt, httpStatus: response.status, code, type,
    requestId: token(response.headers.get("request-id"), 512) || token(response.headers.get("x-request-id"), 512) || bodyRequestId,
    classification: classifyAudioFailure(response.status, code, type), receivedAt,
    retryAfterMs: retryAfterMs(response.headers.get("retry-after"), receivedAt),
  };
}

export function nextAudioAttemptAt(failure: AudioFailure, random = Math.random()): number {
  const backoff = 5000 * 2 ** (failure.attempt - 1) + Math.floor(Math.max(0, Math.min(1, random)) * 1000);
  return failure.receivedAt + Math.max(backoff, failure.retryAfterMs ?? 0);
}

export function audioFailureError(classification: AudioFailure["classification"], waitingForDeadline = false): PipelineError {
  if (classification === "rate_limit") return new PipelineError("audio_rate_limited", waitingForDeadline ? "The audio provider's retry delay exceeds this job's remaining processing time." : "The audio provider remained rate-limited after bounded retries.", "Your plan and completed audio were retained. Ask the administrator to review provider capacity before recovering this job.", "needs_review");
  if (classification === "quota") return new PipelineError("audio_quota_exceeded", "The audio provider rejected the request because its credit allowance is exhausted.", "Ask the administrator to check the audio account's credits and spending limits. The retained plan and completed audio do not need regeneration.", "needs_review");
  if (classification === "access") return new PipelineError("audio_access_denied", "The audio provider denied access to this generation request.", "Ask the administrator to check the API key, subscription, and music/sound-effect permissions. The retained plan and completed audio do not need regeneration.", "needs_review");
  return uncertainAudioError();
}

export function uncertainAudioError(): PipelineError {
  return new PipelineError("audio_payment_uncertain", "An audio request has an unresolved outcome or checkpoint.", "Ask the administrator to inspect the retained request and recover any provider output before retrying. Automatic repeated generation was prevented; a reservation does not prove billing.", "needs_review");
}
