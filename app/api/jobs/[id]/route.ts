import { requireUser } from "@/lib/server/auth";
import { apiError, json } from "@/lib/server/http";
import { jobDetail, ownedJob } from "@/lib/server/jobs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(); return json({ job: jobDetail(await ownedJob((await context.params).id, user.id)) }); }
  catch (error) { return apiError(error); }
}
