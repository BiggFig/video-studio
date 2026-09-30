import { currentUser } from "@/lib/server/auth";
import { acceptingJobs, authConfigured, limits } from "@/lib/server/config";
import { apiError, json } from "@/lib/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return json({ user: await currentUser(), configured: authConfigured(), acceptingJobs: acceptingJobs(), limits: limits() }); }
  catch (error) { return apiError(error); }
}
