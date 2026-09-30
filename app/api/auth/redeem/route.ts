import { z } from "zod";
import { redeemInvitation } from "@/lib/server/auth";
import { apiError, assertSameOrigin, json, readJson } from "@/lib/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { token } = z.object({ token: z.string().trim().min(20, "Enter the invitation code you received.").max(256) }).strict().parse(await readJson(request, 1024));
    return json({ user: await redeemInvitation(token, request) });
  } catch (error) { return apiError(error); }
}
