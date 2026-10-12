import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { modelErrorDiagnostic, Providers } from "./providers";
import { PipelineError, type Hooks, type WorkerInput } from "./types";

const input: WorkerInput = { jobId: "offline-provider-error", ownerId: "operator", mode: "url", productUrl: "https://example.com", videoType: "launch", format: "auto", files: [], budgets: { maxModelCalls: 10, maxModelInputTokens: 200000, maxModelOutputTokens: 30000 } };
const secret = "PRIVATE_REQUEST_CREDENTIAL_AND_CONTENT";
const errorResponse = (message: string, status = 400) => new Response(JSON.stringify({ error: { type: "invalid_request_error", message } }), { status, headers: { "x-private": secret } });

test("model error diagnostics retain only fixed classifications and allowlisted types from native or wrapped errors", async () => {
  for (const payload of [
    { error: { type: "invalid_request_error", message: `Schema is too complex for compilation. ${secret}`, request: secret }, private: secret },
    { error: { message: "Provider returned error", metadata: { raw: JSON.stringify({ error: { type: "invalid_request_error", message: `Schema is too complex for compilation. ${secret}` } }), provider_name: secret, error_type: "invalid_request" } } },
  ]) {
    const diagnostic = await modelErrorDiagnostic(new Response(JSON.stringify(payload), { status: 400, headers: { "x-secret": secret } }));
    assert.equal(diagnostic.category, "schema_compilation"); assert.equal(diagnostic.httpStatus, 400); assert.equal(diagnostic.bodyStatus, "parsed");
    assert.ok(diagnostic.errorTypes?.includes("invalid_request_error")); assert.equal(JSON.stringify(diagnostic).includes(secret), false);
    assert.equal("message" in diagnostic, false); assert.equal("headers" in diagnostic, false);
  }
});

test("unknown provider prose and types are never persisted, even when they resemble credentials or private reasoning", async () => {
  const diagnostic = await modelErrorDiagnostic(new Response(JSON.stringify({ error: { type: secret, code: secret, message: secret, metadata: { raw: secret, provider_code: secret } }, error_type: secret }), { status: 401 }));
  assert.equal(diagnostic.category, "unclassified"); assert.equal(diagnostic.errorTypes, undefined); assert.equal(JSON.stringify(diagnostic).includes(secret), false);
});

test("known error classes use fixed safe summaries instead of echoing provider payloads", async () => {
  for (const [message, category] of [["Invalid JSON schema", "schema_unsupported"], ["thinking is not supported", "thinking_unsupported"], ["budget_tokens must be less than max_tokens", "thinking_budget"], ["prompt is too long", "context_limit"], ["image base64 is invalid", "image_invalid"]]) {
    const diagnostic = await modelErrorDiagnostic(errorResponse(`${message}: ${secret}`)); assert.equal(diagnostic.category, category); assert.equal(JSON.stringify(diagnostic).includes(secret), false);
  }
});

test("error reading is bounded, cancels oversized bodies and rejects incomplete or unavailable data", async () => {
  let pulls = 0, cancelled = false;
  const oversized = new ReadableStream<Uint8Array>({ pull(controller) { pulls++; controller.enqueue(new Uint8Array(16385)); }, cancel() { cancelled = true; } });
  assert.equal((await modelErrorDiagnostic(new Response(oversized, { status: 400 }))).bodyStatus, "oversized");
  assert.equal(cancelled, true); assert.ok(pulls <= 2);
  assert.equal((await modelErrorDiagnostic(errorResponse("x").clone())).bodyStatus, "parsed");
  assert.equal((await modelErrorDiagnostic(new Response('{"error":', { status: 400 }))).bodyStatus, "not-json");
  assert.equal((await modelErrorDiagnostic(new Response(null, { status: 400 }))).bodyStatus, "empty");
  assert.equal((await modelErrorDiagnostic(new Response("", { status: 400 }))).bodyStatus, "empty");
  const unavailable = new ReadableStream({ start(controller) { controller.error(new Error(secret)); } });
  const diagnostic = await modelErrorDiagnostic(new Response(unavailable, { status: 400 })); assert.equal(diagnostic.bodyStatus, "unavailable"); assert.equal(JSON.stringify(diagnostic).includes(secret), false);
});

test("stalled error streams cannot delay failure beyond the bounded timeout", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] }); let cancelled = false;
  const pending = modelErrorDiagnostic(new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status: 400 }));
  t.mock.timers.tick(5000); assert.equal((await pending).bodyStatus, "timed-out"); assert.equal(cancelled, true);
});

async function setup(t: TestContext, persist: Hooks["persist"] = async () => {}) {
  for (const key of ["MODEL_PROVIDER", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "OPENROUTER_API_KEY", "OPENROUTER_MODEL"]) { const old = process.env[key]; delete process.env[key]; t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; }); }
  Object.assign(process.env, { MODEL_PROVIDER: "openrouter", OPENROUTER_API_KEY: "offline-router-key" });
  const root = await realpath(tmpdir()), path = await mkdtemp(join(root, "video-studio-provider-error-"));
  t.after(async () => { const actual = await realpath(path); if (resolve(path) !== resolve(actual) || dirname(actual) !== root || !basename(actual).startsWith("video-studio-provider-error-")) throw new Error("Unsafe test cleanup"); await rm(actual, { recursive: true, force: true }); });
  const providers = new Providers(path, input, { persist, state: async () => {}, complete: async () => {} }); providers.skillHash = "f".repeat(64);
  return { providers, path };
}

for (const status of [400, 429, 503]) test(`HTTP ${status} checkpoints safe diagnostics without releasing uncertain usage or issuing another call`, async t => {
  const persisted: string[][] = []; const { providers, path } = await setup(t, async paths => { persisted.push(paths); }); let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return errorResponse(`Schema is too complex for compilation. ${secret}`, status); });
  await assert.rejects(providers.claude("research", "synthetic fixture", [], { policy: "research-v1" }), error => { assert.ok(error instanceof PipelineError); assert.equal(error.code, "model_unavailable"); assert.equal(error.retryable, status === 429 || status >= 500); assert.equal(error.status, status === 400 ? "needs_review" : "failed"); assert.match(error.message, /complexity limit/); assert.equal(error.message.includes(secret), false); if (status === 400) { assert.match(error.action, /must fix.*schema/); assert.doesNotMatch(error.action, /Try again later/); } return true; });
  assert.equal(calls, 1); assert.equal(providers.ledger.modelCalls, 1); assert.equal(providers.ledger.outputTokens, 0); assert.equal(providers.ledger.reservedOutputTokens, 3500); assert.ok(providers.ledger.reservedInputTokens > 0);
  const auditText = await readFile(join(path, "analysis/model-1-research-budget.json"), "utf8"), audit = JSON.parse(auditText);
  assert.equal(audit.status, "http-error"); assert.equal(audit.diagnostic.category, "schema_compilation"); assert.equal(audit.usage, undefined); assert.equal(auditText.includes(secret), false);
  assert.deepEqual(persisted.at(-1), ["analysis/model-1-research-budget.json"]);
  await assert.rejects(providers.prepareClaude("research", "synthetic fixture", [], { policy: "research-v1" }), error => error instanceof PipelineError && error.code === "model_reservation_unresolved"); assert.equal(calls, 1);
});

test("failed diagnostic persistence retains reservations and cannot trigger a duplicate generation", async t => {
  let budgetWrites = 0; const { providers } = await setup(t, async paths => { if (paths.some(path => path.endsWith("-budget.json")) && ++budgetWrites === 2) throw new Error("offline diagnostic checkpoint failure"); }); let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return errorResponse("Invalid JSON schema"); });
  await assert.rejects(providers.claude("research", "synthetic fixture", [], { policy: "research-v1" }), /offline diagnostic checkpoint failure/);
  assert.equal(calls, 1); assert.equal(providers.ledger.reservedOutputTokens, 3500);
  await assert.rejects(providers.prepareClaude("research", "synthetic fixture", [], { policy: "research-v1" }), error => error instanceof PipelineError && error.code === "model_reservation_unresolved"); assert.equal(calls, 1);
});

test("unsupported structured schemas require an internal fix without suggesting another submission", async t => {
  const { providers } = await setup(t);
  t.mock.method(globalThis, "fetch", async () => errorResponse("Invalid JSON schema", 422));
  await assert.rejects(providers.claude("research", "synthetic fixture", [], { policy: "research-v1" }), error => { assert.ok(error instanceof PipelineError); assert.equal(error.status, "needs_review"); assert.equal(error.retryable, false); assert.match(error.action, /must fix.*schema/); assert.doesNotMatch(error.action, /Try again later|saved/); return true; });
  assert.equal(providers.ledger.modelCalls, 1); assert.equal(providers.ledger.reservedOutputTokens, 3500);
});
