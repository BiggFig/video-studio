import { after } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { acceptingJobs } from "@/lib/server/config";
import { ApiError, apiError, assertSameOrigin, json, readJson } from "@/lib/server/http";
import { createJob, jobDetail, listJobs } from "@/lib/server/jobs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const user = await requireUser(); return json({ jobs: await listJobs(user.id) }); }
  catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    if (!acceptingJobs()) throw new ApiError(503, "BETA_PAUSED", "Video generation is paused while we finish hosted verification. You can explore the studio now.");
    const job = await createJob(user.id, await readJson(request));
    after(async () => { try { const { dispatchJobs } = await import("@/lib/server/dispatch"); await dispatchJobs(); } catch { console.error("Background dispatch deferred to queue recovery"); } });
    return json({ job: jobDetail(job) }, 201);
  } catch (error) { return apiError(error); }
}
