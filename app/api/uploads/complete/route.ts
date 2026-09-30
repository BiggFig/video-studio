import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { apiError, assertSameOrigin, json, readJson } from "@/lib/server/http";
import { ownedUpload, verifyUpload } from "@/lib/server/uploads";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const user = await requireUser();
    const { uploadId } = z.object({ uploadId: z.string().uuid() }).strict().parse(await readJson(request));
    return json({ upload: await verifyUpload(await ownedUpload(uploadId, user.id)) });
  } catch (error) { return apiError(error); }
}
