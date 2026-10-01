import test from "node:test";
import assert from "node:assert/strict";
import { assertSameOrigin, readJson } from "../lib/server/http";
import { privateBlobUrl, publicUrl, randomToken, signToken, verifyToken } from "../lib/server/security";
import { assertFileSignature, validateUploadInput } from "../lib/server/uploads";
import { assertQualityPassed, createJobSchema, REQUIRED_QUALITY_CHECKS } from "../lib/server/jobs";
import { splitSql } from "../db/split-sql";

test("signed sessions reject malformed, altered, and unsigned bearer values", () => {
  process.env.SESSION_SECRET = "test-only-secret-with-at-least-32-characters";
  const token = randomToken(); const signed = signToken(token);
  assert.equal(verifyToken(signed), token);
  assert.equal(verifyToken(`${signed.slice(0, -1)}!`), null);
  assert.equal(verifyToken(token), null);
  assert.equal(verifyToken(`${signed}.ignored`), null);
});

test("URL submission rejects internal hosts, IP obfuscation and credentials", () => {
  for (const value of ["file:///etc/passwd", "http://example.org", "https://127.1", "https://2130706433", "https://0x7f000001", "https://[::1]", "https://10.1.2.3", "https://metadata.google.internal", "https://service.local", "https://user:pass@example.org", "https://example.org:444"]) assert.throws(() => publicUrl(value), value);
  assert.equal(publicUrl("https://www.vercel.com/product#section"), "https://www.vercel.com/product");
});

test("storage fetches cannot escape private Blob hosts or exact object paths", () => {
  assert.equal(privateBlobUrl("https://abc123.private.blob.vercel-storage.com/jobs/123/final.mp4", "jobs/123/final.mp4").hostname, "abc123.private.blob.vercel-storage.com");
  for (const value of ["https://abc123.public.blob.vercel-storage.com/x", "https://abc123.private.blob.vercel-storage.com.attacker.org/x", "http://abc123.private.blob.vercel-storage.com/x", "https://user:pass@abc123.private.blob.vercel-storage.com/x"]) assert.throws(() => privateBlobUrl(value));
  assert.throws(() => privateBlobUrl("https://abc.private.blob.vercel-storage.com/uploads/another-user/file.png", "uploads/owner/file.png"));
});

test("authenticated mutations require same-origin browser requests", () => {
  const local = "https://studio.example.org/api/jobs";
  assert.doesNotThrow(() => assertSameOrigin(new Request(local, { headers: { origin: "https://studio.example.org" } })));
  assert.throws(() => assertSameOrigin(new Request(local)));
  assert.throws(() => assertSameOrigin(new Request(local, { headers: { origin: "https://attacker.org", "sec-fetch-site": "cross-site" } })));
  assert.doesNotThrow(() => assertSameOrigin(new Request("http://localhost:3000/api/jobs", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000", "sec-fetch-site": "same-origin" } })));
});

test("file allowlist rejects dangerous content and misleading extensions", () => {
  assert.throws(() => validateUploadInput({ name: "document.svg", size: 100, contentType: "image/svg+xml", kind: "asset" }));
  assert.throws(() => validateUploadInput({ name: "screen.png", size: 100, contentType: "text/html", kind: "asset" }));
  assert.throws(() => validateUploadInput({ name: "../screen.png", size: 100, contentType: "image/png", kind: "asset" }));
  assert.throws(() => assertFileSignature("image/png", Buffer.from("<html>untrusted</html>")));
  assert.throws(() => assertFileSignature("text/plain", Buffer.from([0, 1, 2, 3])));
  assert.doesNotThrow(() => assertFileSignature("image/png", Buffer.from([137,80,78,71,13,10,26,10,0])));
  assert.doesNotThrow(() => assertFileSignature("text/markdown", Buffer.from("# Product\nA real product.")));
});

test("unknown/deferred job controls and duplicate uploads are not accepted", () => {
  const input = { mode: "url", productUrl: "https://vercel.com", videoType: "launch", format: "auto", uploadIds: [], idempotencyKey: "07f4c3c0-7c61-4eb9-a9e1-7c55b8d2a8d9" };
  assert.equal(createJobSchema.safeParse({ ...input, voiceover: true }).success, false);
  assert.equal(createJobSchema.safeParse({ ...input, uploadIds: [input.idempotencyKey, input.idempotencyKey] }).success, false);
  assert.equal(createJobSchema.safeParse({ ...input, mode: "prd" }).success, false);
});

test("unchecked or incomplete quality reports cannot unlock delivery", () => {
  assert.throws(() => assertQualityPassed({ passed: true }));
  const checks = Object.fromEntries(REQUIRED_QUALITY_CHECKS.map(name => [name, { performed: true, passed: true }]));
  assert.doesNotThrow(() => assertQualityPassed({ passed: true, checks }));
  assert.throws(() => assertQualityPassed({ passed: true, checks: { ...checks, claims: { passed: true, performed: false } } }));
});

test("request body limits apply to chunked requests without content-length", async () => {
  const request = new Request("https://example.org", { method: "POST", body: JSON.stringify({ data: "x".repeat(200) }), headers: { "Content-Type": "application/json" } });
  await assert.rejects(readJson(request, 50), /too large/);
});

test("migration splits statements but retains procedural transactions intact", () => {
  const statements = splitSql("-- semicolon; in comment\nCREATE TABLE a(x text); CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $$ BEGIN INSERT INTO a VALUES('semi;colon'); END $$;");
  assert.equal(statements.length, 2);
  assert.match(statements[1], /semi;colon/);
});
