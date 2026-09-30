import { requireUser } from "@/lib/server/auth";
import { apiError, assertSameOrigin, json, readJson } from "@/lib/server/http";
import { prepareUpload } from "@/lib/server/uploads";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try { assertSameOrigin(request); const user = await requireUser(); return json({ upload: await prepareUpload(user.id, await readJson(request)) }, 201); }
  catch (error) { return apiError(error); }
}
