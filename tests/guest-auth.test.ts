import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { enterGuestSession, sessionCookieOptions, type GuestSessionPorts } from "../lib/server/auth";
import { ApiError } from "../lib/server/http";
import { hashToken, verifyToken } from "../lib/server/security";

process.env.SESSION_SECRET = "guest-auth-test-only-secret-at-least-32-characters";
const request = (headers: Record<string, string> = {}) => new Request("https://studio.example.org/api/auth/guest", { method: "POST", headers: { Origin: "https://studio.example.org", "x-vercel-forwarded-for": "203.0.113.12", ...headers }, body: JSON.stringify({ isAdmin: true, ownerId: "caller-chosen-owner", email: "owner@example.org" }) });
function fixture() {
  const queries: { sql: string; params: unknown[] }[] = [], cookies: string[] = [], limits: unknown[][] = [];
  const ports: GuestSessionPorts = {
    configured: () => true, current: async () => null,
    limit: async (...args) => { limits.push(args); },
    execute: async (sql, params) => { queries.push({ sql, params }); return [{ id: randomUUID(), email: String(params[0]), name: "Guest", is_admin: false, job_allowance: 3 }]; },
    writeCookie: async signed => { cookies.push(signed); },
  };
  return { ports, queries, cookies, limits };
}

test("new guest sessions have distinct private identities, opaque cookies and no caller-controlled role", async () => {
  const { ports, queries, cookies, limits } = fixture();
  const first = await enterGuestSession(request(), ports), second = await enterGuestSession(request(), ports);
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.email, second.email);
  assert.equal(first.isAdmin, false);
  assert.equal(second.isAdmin, false);
  assert.match(first.email, /^guest-[a-f0-9-]+@guest\.invalid$/);
  assert.equal(queries.length, 2, "Each new identity/session uses exactly one query.");
  for (let i = 0; i < queries.length; i++) {
    assert.equal(queries[i].params.length, 2);
    assert.equal(queries[i].params[0], i ? second.email : first.email);
    const raw = verifyToken(cookies[i]); assert.ok(raw);
    assert.equal(queries[i].params[1], hashToken(raw));
    assert.notEqual(queries[i].params[1], raw);
    assert.equal(cookies[i].includes(first.id), false);
  }
  assert.deepEqual(limits, [["guest:203.0.113.12", 10, 3600], ["guest:203.0.113.12", 10, 3600]]);
  assert.deepEqual(sessionCookieOptions(true), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 2592000 });
});

test("existing valid guest or owner sessions are reused without new allowance, identity, rate charge or cookie", async () => {
  for (const isAdmin of [false, true]) {
    const { ports, queries, cookies, limits } = fixture();
    const existing = { id: randomUUID(), email: "existing@example.org", name: "Existing", isAdmin };
    ports.current = async () => existing;
    assert.equal(await enterGuestSession(request(), ports), existing);
    assert.equal(queries.length + cookies.length + limits.length, 0);
  }
});

test("cross-origin and missing configuration fail before creating an identity", async () => {
  const { ports, queries, cookies, limits } = fixture();
  await assert.rejects(enterGuestSession(request({ Origin: "https://untrusted.invalid" }), ports), (error: unknown) => error instanceof ApiError && error.status === 403);
  ports.configured = () => false;
  await assert.rejects(enterGuestSession(request(), ports), (error: unknown) => error instanceof ApiError && error.status === 503);
  assert.equal(queries.length + cookies.length + limits.length, 0);
});

test("rate limits, lookup failures and transaction failures never mint a session cookie", async () => {
  for (const stage of ["current", "limit", "execute"] as const) {
    const { ports, cookies, queries } = fixture();
    ports[stage] = async () => { throw new Error(`test ${stage} unavailable`); };
    await assert.rejects(enterGuestSession(request(), ports));
    assert.equal(cookies.length, 0);
    assert.equal(queries.length, 0);
  }
});

test("unexpected database identity, role, allowance or empty result cannot establish guest access", async () => {
  for (const override of [{ is_admin: true }, { job_allowance: 20 }, { email: "owner@example.org" }, { id: "bad-id" }, null]) {
    const { ports, cookies } = fixture();
    ports.execute = async (_sql, params) => override === null ? [] : [{ id: randomUUID(), email: String(params[0]), name: "Guest", is_admin: false, job_allowance: 3, ...override }];
    await assert.rejects(enterGuestSession(request(), ports), (error: unknown) => error instanceof ApiError && error.code === "GUEST_SESSION_UNAVAILABLE");
    assert.equal(cookies.length, 0);
  }
});
