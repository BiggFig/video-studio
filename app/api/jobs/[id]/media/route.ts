import { requireUser } from "@/lib/server/auth";
import { requiredEnv } from "@/lib/server/config";
import { ApiError, apiError } from "@/lib/server/http";
import { ownedJob } from "@/lib/server/jobs";
import { privateBlobUrl } from "@/lib/server/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const job = await ownedJob((await context.params).id, user.id);
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") ?? "video";
    if (kind !== "video" && kind !== "poster") throw new ApiError(400, "INVALID_MEDIA", "Choose the video or preview image.");
    if (job.status !== "ready" || !job.quality_passed) throw new ApiError(404, "VIDEO_NOT_READY", "This video is not ready for delivery yet.");
    const object = kind === "poster" ? job.poster : job.video;
    if (!object) throw new ApiError(404, "MEDIA_NOT_FOUND", "This file could not be found.");
    privateBlobUrl(object.url, object.pathname);
    const headers = new Headers({ Authorization: `Bearer ${requiredEnv("BLOB_READ_WRITE_TOKEN")}` });
    const range = request.headers.get("range");
    if (range) {
      if (!/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${object.size}`, "Cache-Control": "private, no-store" } });
      headers.set("Range", range);
    }
    const response = await fetch(object.url, { headers, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(270_000) });
    if (response.status === 416) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${object.size}`, "Cache-Control": "private, no-store" } });
    if (!response.ok) throw new ApiError(503, "MEDIA_UNAVAILABLE", "This video is temporarily unavailable. Please try again.");
    const outputHeaders = new Headers({ "Content-Type": object.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes", "Content-Security-Policy": "default-src 'none'" });
    for (const header of ["content-length", "content-range", "etag"]) { const value = response.headers.get(header); if (value) outputHeaders.set(header, value); }
    if (url.searchParams.get("download") === "1") outputHeaders.set("Content-Disposition", `attachment; filename="video-studio-${job.id}.${kind === "video" ? "mp4" : object.contentType === "image/png" ? "png" : "jpg"}"`);
    return new Response(response.body, { status: response.status, headers: outputHeaders });
  } catch (error) { return apiError(error); }
}
