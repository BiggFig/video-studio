import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { rateLimit, requireUser } from "@/lib/server/auth";
import { ApiError, apiError, assertSameOrigin, json, readJson } from "@/lib/server/http";
import { privateBlobUrl } from "@/lib/server/security";
import { ownedUpload, verifyUpload } from "@/lib/server/uploads";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await readJson(request) as HandleUploadBody;
    return json(await handleUpload({
      body, request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        assertSameOrigin(request);
        const user = await requireUser();
        await rateLimit(`upload-tokens:${user.id}`, 100, 3600);
        const { uploadId } = z.object({ uploadId: z.string().uuid() }).strict().parse(JSON.parse(clientPayload ?? "{}"));
        const upload = await ownedUpload(uploadId, user.id);
        if (upload.status !== "pending" || upload.pathname !== pathname) throw new ApiError(403, "UPLOAD_NOT_ALLOWED", "Prepare a new upload before sending this file.");
        return { allowedContentTypes: [upload.content_type], maximumSizeInBytes: Number(upload.size), validUntil: Date.now() + 15 * 60_000, addRandomSuffix: false, allowOverwrite: false, cacheControlMaxAge: 60, tokenPayload: JSON.stringify({ uploadId: upload.id, userId: user.id }) };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // handleUpload validates the provider signature before reaching this callback.
        const { uploadId, userId } = z.object({ uploadId: z.string().uuid(), userId: z.string().uuid() }).parse(JSON.parse(tokenPayload ?? "{}"));
        const upload = await ownedUpload(uploadId, userId);
        if (blob.pathname !== upload.pathname) throw new ApiError(400, "UPLOAD_PATH_MISMATCH", "Upload path mismatch.");
        privateBlobUrl(blob.url, upload.pathname);
        await verifyUpload(upload);
      },
    }));
  } catch (error) { return apiError(error); }
}
