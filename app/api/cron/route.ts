import { timingSafeEqual } from "node:crypto";
import { dispatchJobs } from "@/lib/server/dispatch";
import { json, apiError } from "@/lib/server/http";
import { cleanupExpiredJobs } from "@/lib/server/retention";
export const runtime="nodejs";
export const maxDuration=300;
export async function GET(request:Request) {
  const supplied=Buffer.from(request.headers.get("authorization")??"");
  const expected=Buffer.from(`Bearer ${process.env.CRON_SECRET??""}`);
  if(!process.env.CRON_SECRET||supplied.length!==expected.length||!timingSafeEqual(supplied,expected)) return json({error:{message:"Unauthorized"}},401);
  try { const result=await dispatchJobs(); const cleanup=await cleanupExpiredJobs(3); return json({...result,cleanup}); } catch(error) {return apiError(error);}
}
