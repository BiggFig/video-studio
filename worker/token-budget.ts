/**
 * Anthropic's count is an estimate, not a guaranteed upper bound. Our policy
 * reserves 15% plus 1,024 tokens above that estimate, then verifies actual usage.
 * https://platform.claude.com/docs/en/build-with-claude/token-counting
 * The free counter receives the exact model/system/messages used for generation.
 * Gateway and unavailable/invalid counters retain the byte/pixel fallback.
 */
export const TOKEN_COUNT_MARGIN = { numerator: 115, denominator: 100, fixedTokens: 1024 } as const;
export const TOKEN_COUNT_TIMEOUT_MS = 20_000;
export const TOKEN_BUDGET_VIOLATION = "token_budget_exceeded";
const MAX_COUNT_RESPONSE_BYTES = 16_384;

export interface InputReservation {
  method: "anthropic-count-tokens" | "conservative-fallback";
  inputTokens: number;
  countedInputTokens?: number;
  countRequestId?: string | null;
  fallbackReason?: string;
}

export function countedReservation(count: unknown): number | undefined {
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) return;
  const reserved = Math.ceil(count * TOKEN_COUNT_MARGIN.numerator / TOKEN_COUNT_MARGIN.denominator) + TOKEN_COUNT_MARGIN.fixedTokens;
  return Number.isSafeInteger(reserved) ? reserved : undefined;
}

async function smallJson(response: Response): Promise<unknown> {
  if (Number(response.headers.get("content-length")) > MAX_COUNT_RESPONSE_BYTES || !response.body) throw new Error("Invalid count response");
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_COUNT_RESPONSE_BYTES) { await reader.cancel(); throw new Error("Count response exceeds limit"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function inputReservation(
  exactInputBody: string, conservativeTokens: number, directHeaders?: Record<string, string>,
): Promise<InputReservation> {
  const fallback = (reason: string): InputReservation => ({ method: "conservative-fallback", inputTokens: conservativeTokens, fallbackReason: reason });
  if (!directHeaders) return fallback("gateway");
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages/count_tokens", {
      method: "POST", headers: directHeaders, body: exactInputBody,
      signal: AbortSignal.timeout(TOKEN_COUNT_TIMEOUT_MS), redirect: "error",
    });
    if (!response.ok) { await response.body?.cancel(); return fallback(`http-${response.status}`); }
    let data: unknown;
    try { data = await smallJson(response); } catch { return fallback("invalid-response"); }
    const count = data && typeof data === "object" && "input_tokens" in data ? data.input_tokens : undefined;
    const reserved = countedReservation(count);
    if (reserved === undefined) return fallback("invalid-response");
    return {
      method: "anthropic-count-tokens", inputTokens: reserved, countedInputTokens: count as number,
      countRequestId: response.headers.get("request-id") || response.headers.get("x-request-id"),
    };
  } catch {
    // Do not retain provider bodies, request payloads, credentials or exception text.
    return fallback("counter-unavailable");
  }
}

export function modelUsage(value: unknown): { inputTokens: number; outputTokens: number } | undefined {
  if (!value || typeof value !== "object" || !("input_tokens" in value) || !("output_tokens" in value)) return;
  const inputTokens = value.input_tokens, outputTokens = value.output_tokens;
  if (typeof inputTokens !== "number" || typeof outputTokens !== "number" || !Number.isSafeInteger(inputTokens) || !Number.isSafeInteger(outputTokens) || inputTokens < 0 || outputTokens < 0) return;
  return { inputTokens, outputTokens };
}

export function usageViolations(usage: { inputTokens: number; outputTokens: number }, reserved: { inputTokens: number; outputTokens: number }, totals: { inputTokens: number; outputTokens: number }, limits: { inputTokens: number; outputTokens: number }): string[] {
  const violations: string[] = [];
  if (usage.inputTokens > reserved.inputTokens) violations.push("input-reservation-exceeded");
  if (usage.outputTokens > reserved.outputTokens) violations.push("output-reservation-exceeded");
  if (totals.inputTokens > limits.inputTokens) violations.push("input-job-cap-exceeded");
  if (totals.outputTokens > limits.outputTokens) violations.push("output-job-cap-exceeded");
  return violations;
}
