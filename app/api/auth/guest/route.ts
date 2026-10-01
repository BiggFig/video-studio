import { enterGuestSession } from "@/lib/server/auth";
import { apiError, json } from "@/lib/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try { return json({ user: await enterGuestSession(request) }); }
  catch (error) { return apiError(error); }
}
