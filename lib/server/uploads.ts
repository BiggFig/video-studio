import { randomUUID } from "node:crypto";
import { head } from "@vercel/blob";
import { z } from "zod";
import type { UploadKind, UploadRecord } from "../contracts";
import { limits, requiredEnv } from "./config";
import { query } from "./db";
import { ApiError } from "./http";
import { privateBlobUrl } from "./security";

export interface UploadRow { id: string; user_id: string; pathname: string; blob_url: string | null; name: string; size: number | string; content_type: string; kind: UploadKind; status: "pending" | "ready" | "rejected" | "deleted"; expires_at: string }
export const uploadSchema = z.object({ name: z.string().trim().min(1).max(160), size: z.number().int().positive(), contentType: z.string().max(100), kind: z.enum(["prd", "asset", "reference"]) }).strict();
const fileTypes: Record<string, { contentType: string; kinds: UploadKind[] }> = {
  png: { contentType: "image/png", kinds: ["asset"] }, jpg: { contentType: "image/jpeg", kinds: ["asset"] }, jpeg: { contentType: "image/jpeg", kinds: ["asset"] }, webp: { contentType: "image/webp", kinds: ["asset"] },
  mp4: { contentType: "video/mp4", kinds: ["asset", "reference"] }, mov: { contentType: "video/quicktime", kinds: ["asset", "reference"] }, webm: { contentType: "video/webm", kinds: ["asset", "reference"] },
  pdf: { contentType: "application/pdf", kinds: ["prd"] }, md: { contentType: "text/markdown", kinds: ["prd"] }, txt: { contentType: "text/plain", kinds: ["prd"] },
};
export function uploadRecord(row: UploadRow): UploadRecord { return { id: row.id, name: row.name, size: Number(row.size), contentType: row.content_type, kind: row.kind }; }

export function validateUploadInput(rawInput: unknown) {
  const input = uploadSchema.parse(rawInput);
  if (/[\x00-\x1f\x7f/\\]/.test(input.name)) throw new ApiError(400, "INVALID_FILENAME", "Rename the file without special characters.");
  const extension = input.name.split(".").pop()?.toLowerCase() ?? "";
  const type = fileTypes[extension];
  if (!type || !type.kinds.includes(input.kind)) throw new ApiError(400, "UNSUPPORTED_FILE", "Use PNG, JPEG, WebP, MP4, MOV or WebM visuals, or a PDF, Markdown or text PRD.");
  const declared = input.contentType.split(";")[0].toLowerCase();
  if (declared && declared !== "application/octet-stream" && declared !== type.contentType && !(extension === "md" && ["text/plain", "text/x-markdown"].includes(declared))) throw new ApiError(400, "FILE_TYPE_MISMATCH", "The file type doesn't match its extension. Export it again and retry.");
  input.contentType = type.contentType;
  const budget = limits();
  const maximum = input.kind === "prd" ? budget.maxPrdBytes : input.kind === "reference" ? budget.maxReferenceBytes : budget.maxFileBytes;
  if (input.size > maximum) throw new ApiError(413, "FILE_TOO_LARGE", `This file exceeds the ${Math.floor(maximum / 1024 / 1024)} MB limit.`, "Use a smaller file or shorter recording.");
  return { input, extension };
}

export async function prepareUpload(userId: string, rawInput: unknown) {
  const { input, extension } = validateUploadInput(rawInput);
  const budget = limits();
  const id = randomUUID();
  const pathname = `uploads/${userId}/${id}.${extension}`;
  try {
    const rows = await query<UploadRow>("SELECT * FROM studio_prepare_upload($1,$2,$3,$4,$5,$6,$7,$8,$9)", [id, userId, pathname, input.name, input.size, input.contentType, input.kind, budget.maxFiles * 3, budget.maxTotalBytes * 3]);
    return { ...uploadRecord(rows[0]), pathname };
  } catch (error) {
    if (error instanceof Error && error.message.includes("UPLOAD_RATE_LIMIT")) throw new ApiError(429, "UPLOAD_RATE_LIMIT", "You have reached the upload limit for this hour.", "Wait an hour before uploading more files.");
    throw error;
  }
}

export async function ownedUpload(id: string, userId: string) {
  if (!z.string().uuid().safeParse(id).success) throw new ApiError(404, "UPLOAD_NOT_FOUND", "This upload could not be found.");
  const rows = await query<UploadRow>("SELECT * FROM studio_uploads WHERE id=$1 AND user_id=$2 AND status IN ('pending','ready') AND expires_at>now()", [id, userId]);
  if (!rows[0]) throw new ApiError(404, "UPLOAD_NOT_FOUND", "This upload could not be found.");
  return rows[0];
}

export function assertFileSignature(contentType: string, bytes: Uint8Array) {
  const data = Buffer.from(bytes);
  let valid = false;
  if (contentType === "image/png") valid = data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  else if (contentType === "image/jpeg") valid = data[0] === 255 && data[1] === 216 && data[2] === 255;
  else if (contentType === "image/webp") valid = data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
  else if (contentType === "application/pdf") valid = data.toString("ascii", 0, 5) === "%PDF-";
  else if (contentType === "video/mp4" || contentType === "video/quicktime") valid = data.toString("ascii", 4, 8) === "ftyp" || (contentType === "video/quicktime" && ["wide", "mdat", "moov"].includes(data.toString("ascii", 4, 8)));
  else if (contentType === "video/webm") valid = data.subarray(0, 4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
  else if (contentType === "text/plain" || contentType === "text/markdown") {
    // Prefix may end partway through a Unicode sequence; streaming decoding accepts that.
    try { const text = new TextDecoder("utf-8", { fatal: true }).decode(data, { stream: true }); valid = text.trim().length > 0 && !/[\x00-\x08\x0e-\x1f]/.test(text); } catch { valid = false; }
  }
  if (!valid) throw new ApiError(400, "UNREADABLE_FILE", "This file doesn't contain a supported document, image or recording.", "Export the file in a supported format and upload it again.");
}

export async function verifyUpload(row: UploadRow): Promise<UploadRecord> {
  if (row.status === "ready") return uploadRecord(row);
  const metadata = await head(row.pathname);
  privateBlobUrl(metadata.url, row.pathname);
  if (metadata.size !== Number(row.size) || metadata.contentType.split(";")[0] !== row.content_type) {
    await query("UPDATE studio_uploads SET status='rejected' WHERE id=$1 AND status='pending'", [row.id]);
    throw new ApiError(400, "FILE_MISMATCH", "The uploaded file did not match its declared size or type.", "Upload the file again.");
  }
  const response = await fetch(metadata.url, { headers: { Authorization: `Bearer ${requiredEnv("BLOB_READ_WRITE_TOKEN")}`, Range: "bytes=0-65535" }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok || !response.body) throw new ApiError(503, "UPLOAD_NOT_READY", "The upload is still being saved. Try again in a moment.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let count = 0;
  while (count < 65536) { const { done, value } = await reader.read(); if (done) break; chunks.push(value.subarray(0, 65536 - count)); count += value.byteLength; }
  await reader.cancel();
  try { assertFileSignature(row.content_type, Buffer.concat(chunks)); }
  catch (error) { await query("UPDATE studio_uploads SET status='rejected' WHERE id=$1 AND status='pending'", [row.id]); throw error; }
  const rows = await query<UploadRow>("UPDATE studio_uploads SET status='ready',blob_url=$2,verified_at=now() WHERE id=$1 AND status IN ('pending','ready') AND expires_at>now() RETURNING *", [row.id, metadata.url]);
  if (!rows[0]) throw new ApiError(410, "UPLOAD_EXPIRED", "This upload has expired. Upload it again.");
  return uploadRecord(rows[0]);
}
