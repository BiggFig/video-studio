import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import type { StudioUser } from "../contracts";
import { authConfigured } from "./config";
import { query } from "./db";
import { ApiError, assertSameOrigin } from "./http";
import { hashToken, randomToken, signToken, verifyToken } from "./security";

const cookieName = "studio_session";
type UserRow = { id: string; email: string; name: string; is_admin: boolean };
const publicUser = (row: UserRow): StudioUser => ({ id: row.id, email: row.email, name: row.name, isAdmin: row.is_admin });
export const sessionCookieOptions = (production = process.env.NODE_ENV === "production") => ({ httpOnly: true, secure: production, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 30 });
async function writeSessionCookie(signedToken: string) { (await cookies()).set(cookieName, signedToken, sessionCookieOptions()); }

export async function currentUser(): Promise<StudioUser | null> {
  if (!authConfigured()) return null;
  const token = verifyToken((await cookies()).get(cookieName)?.value);
  if (!token) return null;
  const rows = await query<UserRow>(`SELECT u.id,u.email,u.name,u.is_admin FROM studio_sessions s JOIN studio_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.disabled_at IS NULL`, [hashToken(token)]);
  return rows[0] ? publicUser(rows[0]) : null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new ApiError(401, "SIGN_IN_REQUIRED", "Open the studio to start your private workspace.");
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

type GuestRow = UserRow & { job_allowance: number };
export interface GuestSessionPorts {
  configured(): boolean;
  current(): Promise<StudioUser | null>;
  limit(bucket: string, maximum: number, seconds: number): Promise<void>;
  execute(sql: string, params: unknown[]): Promise<GuestRow[]>;
  writeCookie(signedToken: string): Promise<void>;
}
const guestPorts: GuestSessionPorts = {
  configured: authConfigured, current: currentUser, limit: rateLimit,
  execute: (sql, params) => query<GuestRow>(sql, params), writeCookie: writeSessionCookie,
};

/** Public access creates a private identity; clients never select an owner or role. */
export async function enterGuestSession(request: Request, ports: GuestSessionPorts = guestPorts): Promise<StudioUser> {
  assertSameOrigin(request);
  if (!ports.configured()) throw new ApiError(503, "STUDIO_NOT_CONFIGURED", "Studio access is being set up. Please check back soon.");
  const existing = await ports.current();
  if (existing) return existing;
  const forwarded = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "";
  const candidate = forwarded.split(",")[0].trim();
  await ports.limit(`guest:${isIP(candidate) ? candidate : "unknown"}`, 10, 3600);
  const sessionToken = randomToken(), signedToken = signToken(sessionToken);
  const email = `guest-${randomUUID()}@guest.invalid`;
  // One SQL statement commits the unique non-admin identity and session together.
  // No conflict update or caller-supplied identity can attach a guest to an owner.
  const rows = await ports.execute(`WITH guest AS (
    INSERT INTO studio_users(email,name,is_admin,job_allowance)
    VALUES($1,'Guest',false,3) RETURNING id,email,name,is_admin,job_allowance
  ), session AS (
    INSERT INTO studio_sessions(token_hash,user_id,expires_at)
    SELECT $2,id,now()+interval '30 days' FROM guest RETURNING user_id
  ) SELECT guest.* FROM guest JOIN session ON session.user_id=guest.id`, [email, hashToken(sessionToken)]);
  const guest = rows[0];
  if (rows.length !== 1 || !guest || guest.email !== email || guest.is_admin !== false || guest.job_allowance !== 3 || !z.string().uuid().safeParse(guest.id).success) {
    throw new ApiError(503, "GUEST_SESSION_UNAVAILABLE", "Your workspace could not be opened. Please try again.");
  }
  await ports.writeCookie(signedToken);
  return publicUser(guest);
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
  await writeSessionCookie(signToken(sessionToken));
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
