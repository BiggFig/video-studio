import { createInvitation, invitationSchema, rateLimit, requireAdmin } from "@/lib/server/auth";
import { apiError, assertSameOrigin, json, readJson } from "@/lib/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireAdmin();
    await rateLimit(`invites:${user.id}`, 30, 3600);
    return json({ invitation: await createInvitation(invitationSchema.parse(await readJson(request))) }, 201);
  } catch (error) { return apiError(error); }
}
