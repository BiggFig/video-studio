import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public action?: string) { super(message); }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

export function apiError(error: unknown): Response {
  if (error instanceof ApiError) return json({ error: { code: error.code, message: error.message, action: error.action } }, error.status);
  if (error instanceof ZodError) return json({ error: { code: "INVALID_INPUT", message: error.issues[0]?.message ?? "Check your submission." } }, 400);
  // Do not disclose provider responses, SQL, tokens, or uploaded source content.
  console.error("API request failed", { type: error instanceof Error ? error.name : "UnknownError" });
  return json({ error: { code: "SERVICE_UNAVAILABLE", message: "The studio is temporarily unavailable. Please try again in a moment." } }, 503);
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  // Next's development server may normalize request.url to localhost even when
  // the browser connects through 127.0.0.1. Host preserves the routed authority.
  const host = request.headers.get("host");
  const actual = host ? new URL(`${requestUrl.protocol}//${host}`).origin : requestUrl.origin;
  const configured = process.env.APP_URL ? new URL(process.env.APP_URL).origin : null;
  if (!origin || (origin !== actual && origin !== configured) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ApiError(403, "INVALID_ORIGIN", "Refresh this page and try again.");
  }
}

export async function readJson(request: Request, maxBytes = 32_768) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new ApiError(415, "INVALID_CONTENT_TYPE", "Send a JSON request.");
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) throw new ApiError(413, "REQUEST_TOO_LARGE", "This request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "INVALID_JSON", "This request is empty.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new ApiError(413, "REQUEST_TOO_LARGE", "This request is too large."); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "INVALID_JSON", "This request is not valid JSON.");
  }
}
