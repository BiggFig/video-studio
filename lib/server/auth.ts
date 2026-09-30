import { cookies } from "next/headers";
import { z } from "zod";
import type { StudioUser } from "../contracts";
import { authConfigured } from "./config";
import { query } from "./db";
import { ApiError } from "./http";
import { hashToken, randomToken, signToken, verifyToken } from "./security";

const cookieName = "studio_session";
type UserRow = { id: string; email: string; name: string; is_admin: boolean };
const publicUser = (row: UserRow): StudioUser => ({ id: row.id, email: row.email, name: row.name, isAdmin: row.is_admin });

export async function currentUser(): Promise<StudioUser | null> {
  if (!authConfigured()) return null;
  const token = verifyToken((await cookies()).get(cookieName)?.value);
  if (!token) return null;
  const rows = await query<UserRow>(`SELECT u.id,u.email,u.name,u.is_admin FROM studio_sessions s JOIN studio_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.disabled_at IS NULL`, [hashToken(token)]);
  return rows[0] ? publicUser(rows[0]) : null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new ApiError(401, "SIGN_IN_REQUIRED", "Use your invitation to sign in to the private beta.");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) throw new ApiError(403, "ADMIN_REQUIRED", "This action is only available to the studio owner.");
  return user;
}

export async function rateLimit(bucket: string, maximum: number, seconds: number) {
  const rows = await query<{ count: number }>(`INSERT INTO studio_rate_limits(bucket,count,expires_at) VALUES($1,1,now()+make_interval(secs=>$2)) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN studio_rate_limits.expires_at<=now() THEN 1 ELSE studio_rate_limits.count+1 END,expires_at=CASE WHEN studio_rate_limits.expires_at<=now() THEN now()+make_interval(secs=>$2) ELSE studio_rate_limits.expires_at END RETURNING count`, [hashToken(bucket), seconds]);
  if (rows[0].count > maximum) throw new ApiError(429, "TOO_MANY_REQUESTS", "Please wait a few minutes before trying again.");
}

async function bootstrapOwner() {
  const token = process.env.BETA_OWNER_INVITE_TOKEN;
  const email = process.env.BETA_OWNER_EMAIL?.trim().toLowerCase();
  if (!token || !email) return;
  if (token.length < 32 || !z.string().email().safeParse(email).success) throw new Error("Invalid beta owner invitation configuration");
  // Never refresh or reissue an already-consumed bootstrap invitation.
  await query(`INSERT INTO studio_invitations(token_hash,email,name,is_admin,job_allowance,expires_at) VALUES($1,$2,$3,true,100,now()+interval '90 days') ON CONFLICT(token_hash) DO NOTHING`, [hashToken(token), email, process.env.BETA_OWNER_NAME ?? "Studio owner"]);
}

export async function redeemInvitation(token: string, request: Request) {
  if (!authConfigured()) throw new ApiError(503, "STUDIO_NOT_CONFIGURED", "Private beta access is being set up. Please check back soon.");
  await rateLimit(`redeem:${request.headers.get("x-vercel-forwarded-for")?.split(",")[0] ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown"}`, 10, 900);
  await bootstrapOwner();
  const sessionToken = randomToken();
  let rows: UserRow[];
  try { rows = await query<UserRow>("SELECT * FROM studio_redeem_invitation($1,$2)", [hashToken(token.trim()), hashToken(sessionToken)]); }
  catch (error) {
    if (error instanceof Error && /INVITE_INVALID|ACCOUNT_DISABLED/.test(error.message)) throw new ApiError(401, "INVITE_INVALID", "This invitation has expired or has already been used. Ask the studio owner for a new one.");
    throw error;
  }
  if (!rows[0]) throw new ApiError(401, "INVITE_INVALID", "This invitation is no longer available.");
  (await cookies()).set(cookieName, signToken(sessionToken), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return publicUser(rows[0]);
}

export async function logout() {
  const jar = await cookies();
  const token = authConfigured() ? verifyToken(jar.get(cookieName)?.value) : null;
  if (token) await query("DELETE FROM studio_sessions WHERE token_hash=$1", [hashToken(token)]);
  jar.delete(cookieName);
}

export const invitationSchema = z.object({ email: z.string().email().max(254), name: z.string().trim().min(1).max(80), jobAllowance: z.number().int().min(1).max(100).default(20) }).strict();
export async function createInvitation(input: z.infer<typeof invitationSchema>) {
  const token = randomToken();
  const rows = await query<{ id: string; expires_at: string }>(`INSERT INTO studio_invitations(token_hash,email,name,job_allowance,expires_at) VALUES($1,$2,$3,$4,now()+interval '7 days') RETURNING id,expires_at`, [hashToken(token), input.email.toLowerCase(), input.name, input.jobAllowance]);
  return { id: rows[0].id, token, email: input.email, expiresAt: rows[0].expires_at };
}
