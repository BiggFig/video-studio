import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { ApiError } from "./http";
import { requiredEnv } from "./config";

export function hashToken(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function randomToken() { return randomBytes(32).toString("base64url"); }
export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function signToken(token: string) {
  return `${token}.${createHmac("sha256", requiredEnv("SESSION_SECRET")).update(token).digest("base64url")}`;
}
export function verifyToken(value: string | undefined): string | null {
  if (!value || value.length > 256) return null;
  const [token, signature, extra] = value.split(".");
  if (!token || !signature || extra || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return safeEqual(signToken(token), value) ? token : null;
}

// Fast input rejection. DNS and every redirect must additionally be checked by the isolated worker.
export function publicUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new ApiError(400, "INVALID_URL", "Enter a complete public HTTPS URL."); }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !host.includes(".") || isIP(host) || host === "localhost" || /\.(localhost|local|internal|test|invalid|example)$/.test(host) || /(^|\.)metadata\./.test(host)) {
    throw new ApiError(400, "UNSUPPORTED_URL", "Use a public HTTPS website without a custom port or sign-in credentials.");
  }
  if (value.length > 2048) throw new ApiError(400, "INVALID_URL", "This URL is too long.");
  url.hash = "";
  return url.toString();
}

export function privateBlobUrl(value: string, expectedPath?: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port || !/^[a-z0-9-]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname) || (expectedPath !== undefined && decodeURIComponent(url.pathname.slice(1)) !== expectedPath)) {
    throw new ApiError(400, "INVALID_STORAGE_OBJECT", "This file could not be verified. Upload it again.");
  }
  return url;
}
