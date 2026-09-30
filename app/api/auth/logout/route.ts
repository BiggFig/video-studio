import { logout } from "@/lib/server/auth";
import { apiError, assertSameOrigin, json } from "@/lib/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try { assertSameOrigin(request); await logout(); return json({ ok: true }); }
  catch (error) { return apiError(error); }
}
