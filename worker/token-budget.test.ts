import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { Providers } from "./providers";
import { countedReservation, inputReservation, modelUsage, TOKEN_BUDGET_VIOLATION, TOKEN_COUNT_TIMEOUT_MS, usageViolations } from "./token-budget";
import { PipelineError, type Hooks, type WorkerInput } from "./types";

const input: WorkerInput = { jobId: "budget-test", ownerId: "operator", mode: "url", productUrl: "https://example.com", videoType: "launch", format: "auto", files: [], budgets: { maxModelCalls: 10, maxModelInputTokens: 200_000, maxModelOutputTokens: 30_000 } };
const issue = (code: string) => (error: unknown) => error instanceof PipelineError && error.code === code && error.status === "needs_review";
const result = (inputTokens = 1000, outputTokens = 25) => new Response(JSON.stringify({ model: "fixture-model", content: [{ type: "text", text: '{"ok":true}' }], usage: { input_tokens: inputTokens, output_tokens: outputTokens } }), { headers: { "request-id": "fixture-generation" } });
const countResult = (count: unknown = 1000) => new Response(JSON.stringify({ input_tokens: count }), { headers: { "request-id": "fixture-count" } });
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const mockFetch = (t: TestContext, implementation: (url: string, options: RequestInit) => Promise<Response>) => t.mock.method(globalThis, "fetch", (url: RequestInfo | URL, options?: RequestInit) => implementation(String(url), options || {}));
function environment(t: TestContext, direct = true) {
  for (const key of ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "AI_GATEWAY_API_KEY", "AI_GATEWAY_MODEL", "VERCEL_OIDC_TOKEN", "ELEVENLABS_API_KEY"]) {
    const previous = process.env[key]; delete process.env[key];
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  process.env[direct ? "ANTHROPIC_API_KEY" : "AI_GATEWAY_API_KEY"] = "test-only-no-network";
  process.env.ELEVENLABS_API_KEY = "test-only-no-network";
}
async function workspace(t: TestContext) {
  const root = await realpath(tmpdir()), path = await mkdtemp(join(root, "video-studio-token-budget-"));
  t.after(async () => { const target = await realpath(path); if (resolve(target) !== resolve(path) || dirname(target) !== root || !basename(target).startsWith("video-studio-token-budget-")) throw new Error("Test cleanup target escaped its registered temporary directory"); await rm(target, { recursive: true, force: true }); });
  return path;
}
const hooks = (persist: Hooks["persist"] = async () => {}): Hooks => ({ persist, state: async () => {}, complete: async () => {} });

test("counter margins and usage require nonnegative safe integers", () => {
  assert.equal(countedReservation(0), 1024); assert.equal(countedReservation(1000), 2174); assert.equal(countedReservation(1001), 2176);
  for (const invalid of [-1, 1.5, "100", null, NaN, Infinity, Number.MAX_SAFE_INTEGER]) assert.equal(countedReservation(invalid), undefined);
  assert.deepEqual(modelUsage({ input_tokens: 0, output_tokens: 0 }), { inputTokens: 0, outputTokens: 0 });
  for (const invalid of [-1, 1.5, "100", null, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(modelUsage({ input_tokens: invalid, output_tokens: 1 }), undefined);
  assert.deepEqual(usageViolations({ inputTokens: 11, outputTokens: 8 }, { inputTokens: 10, outputTokens: 7 }, { inputTokens: 101, outputTokens: 51 }, { inputTokens: 100, outputTokens: 50 }), ["input-reservation-exceeded", "output-reservation-exceeded", "input-job-cap-exceeded", "output-job-cap-exceeded"]);
});

test("counter sends the exact structured model, system and base64 images with a bounded signal", async (t) => {
  const body = JSON.stringify({ model: "exact-model", system: "pinned instructions", messages: [{ role: "user", content: [{ type: "text", text: "SOURCE" }, { type: "image", source: { type: "base64", media_type: "image/png", data: "ZmFrZS10ZXN0LWltYWdl" } }] }] });
  mockFetch(t, async (url, options) => { assert.equal(url, "https://api.anthropic.com/v1/messages/count_tokens"); assert.equal(options.body, body); assert.ok(options.signal instanceof AbortSignal); assert.equal(options.redirect, "error"); return countResult(); });
  const estimate = await inputReservation(body, 50_000, { "x-api-key": "dummy-test-key" });
  assert.equal(TOKEN_COUNT_TIMEOUT_MS, 20_000); assert.deepEqual(estimate, { method: "anthropic-count-tokens", inputTokens: 2174, countedInputTokens: 1000, countRequestId: "fixture-count" });
});

test("direct counting allows a supported request while persisting exact hashes and bounds before generation", async (t) => {
  environment(t); const path = await workspace(t), persisted = new Map<string, string>(), events: string[] = [];
  const providers = new Providers(path, { ...input, budgets: { ...input.budgets, maxModelInputTokens: 3000, maxModelOutputTokens: 1500 } }, hooks(async paths => { for (const p of paths) persisted.set(p, await readFile(join(path, p), "utf8")); events.push(paths[0]); }));
  providers.ledger.outputTokens = 900; let countBody = "", generationBody = "";
  mockFetch(t, async (url, options) => {
    if (String(url).endsWith("count_tokens")) { countBody = String(options.body); assert.equal(providers.ledger.modelCalls, 0); events.push("count"); return countResult(); }
    generationBody = String(options.body); events.push("generate"); assert.equal(providers.ledger.modelCalls, 1);
    const audit = JSON.parse(persisted.get("analysis/model-1-review-budget.json")!); const ledger = JSON.parse(persisted.get("ledger.json")!);
    assert.equal(audit.estimate.countedInputTokens, 1000); assert.equal(audit.reservation.inputTokens, 2174); assert.equal(audit.requestHash, digest(generationBody)); assert.equal(audit.inputRequestHash, digest(countBody)); assert.equal(ledger.reservedInputTokens, 2174); assert.equal(ledger.reservedOutputTokens, 600); assert.equal(JSON.parse(generationBody).max_tokens, 600);
    return result(1003);
  });
  assert.deepEqual(await providers.claude("review", "long source evidence ".repeat(500)), { ok: true });
  const generation = JSON.parse(generationBody); assert.deepEqual(JSON.parse(countBody), { model: generation.model, system: generation.system, messages: generation.messages });
  assert.deepEqual(events.slice(0, 4), ["count", "ledger.json", "analysis/model-1-review-budget.json", "generate"]);
  assert.equal(providers.ledger.modelCalls, 1); assert.equal(providers.ledger.inputTokens, 1003); assert.equal(providers.ledger.outputTokens, 925); assert.equal(providers.ledger.reservedInputTokens, 0); assert.equal(providers.ledger.reservedOutputTokens, 0);
  const saved = persisted.get("analysis/model-1-review-budget.json")!; assert.equal(JSON.parse(saved).status, "completed"); assert.ok(!saved.includes("long source evidence")); assert.ok(!saved.includes("test-only-no-network"));
});

test("a count above remaining allowance rejects generation without charging a model call", async (t) => {
  environment(t); const path = await workspace(t); let requests = 0, checkpoints = 0;
  const providers = new Providers(path, input, hooks(async () => { checkpoints++; })); providers.ledger.inputTokens = 198_000;
  mockFetch(t, async url => { requests++; assert.match(String(url), /count_tokens$/); return countResult(); });
  await assert.rejects(providers.claude("review", "supported evidence"), issue("model_budget")); assert.equal(requests, 1); assert.equal(checkpoints, 0); assert.equal(providers.ledger.modelCalls, 0);
});

test("counter transport, HTTP, malformed and oversized responses retain the conservative fallback", async (t) => {
  const cases = [
    { response: () => new Response("unavailable", { status: 503 }), reason: "http-503" },
    { response: () => { throw new Error("sensitive exception must not be retained"); }, reason: "counter-unavailable" },
    { response: () => countResult(-1), reason: "invalid-response" },
    { response: () => countResult(1.1), reason: "invalid-response" },
    { response: () => countResult("100"), reason: "invalid-response" },
    { response: () => new Response("{broken"), reason: "invalid-response" },
    { response: () => new Response("x".repeat(17_000)), reason: "invalid-response" },
  ];
  for (const entry of cases) {
    const mock = mockFetch(t, async () => entry.response());
    assert.deepEqual(await inputReservation("{}", 75_000, {}), { method: "conservative-fallback", inputTokens: 75_000, fallbackReason: entry.reason }); mock.mock.restore();
  }
});

test("Gateway never contacts the direct counter and preserves the byte-based reservation", async (t) => {
  environment(t, false); const path = await workspace(t), providers = new Providers(path, input, hooks()); let calls = 0;
  mockFetch(t, async (url, options) => {
    calls++; assert.equal(url, "https://ai-gateway.vercel.sh/v1/messages"); const body = JSON.parse(String(options.body)), prompt = body.messages[0].content[0].text;
    assert.equal(providers.ledger.reservedInputTokens, Buffer.byteLength(body.system + prompt, "utf8") + 1024); return result();
  });
  await providers.claude("review", "source evidence"); assert.equal(calls, 1); const audit = JSON.parse(await readFile(join(path, "analysis/model-1-review-budget.json"), "utf8")); assert.equal(audit.estimate.fallbackReason, "gateway");
});

test("an unavailable direct counter cannot turn an oversized request into an allowed generation", async (t) => {
  environment(t); const path = await workspace(t), providers = new Providers(path, { ...input, budgets: { ...input.budgets, maxModelInputTokens: 3000 } }, hooks()); let calls = 0;
  mockFetch(t, async url => { calls++; assert.match(String(url), /count_tokens$/); return new Response(null, { status: 503 }); });
  await assert.rejects(providers.claude("review", "x".repeat(4000)), issue("model_budget")); assert.equal(calls, 1); assert.equal(providers.ledger.modelCalls, 0);
});

for (const failedPath of ["ledger.json", "analysis/model-1-review-budget.json"]) test(`pre-generation checkpoint failure at ${failedPath} prevents paid generation`, async (t) => {
  environment(t); const path = await workspace(t); let generationCalls = 0;
  const providers = new Providers(path, input, hooks(async paths => { if (paths.includes(failedPath)) throw new Error("checkpoint unavailable"); }));
  mockFetch(t, async url => { if (String(url).endsWith("count_tokens")) return countResult(); generationCalls++; throw new Error("Unexpected paid request"); });
  await assert.rejects(providers.claude("review", "source evidence"), /checkpoint unavailable/); assert.equal(generationCalls, 0); assert.equal(providers.ledger.reservedInputTokens, 2174);
  await assert.rejects(providers.claude("review", "source evidence"), issue("model_reservation_unresolved")); assert.equal(generationCalls, 0);
});

test("usage above the estimate is recorded honestly and a durable marker stops all further providers", async (t) => {
  environment(t); const path = await workspace(t), providers = new Providers(path, input, hooks()); let requests = 0;
  mockFetch(t, async url => { requests++; return String(url).endsWith("count_tokens") ? countResult() : result(2175); });
  await assert.rejects(providers.claude("review", "evidence"), issue("model_usage_exceeded")); assert.equal(providers.ledger.inputTokens, 2175); assert.equal(providers.ledger.reservedInputTokens, 0);
  const saved = JSON.parse(await readFile(join(path, "ledger.json"), "utf8")); assert.equal(saved.providerRequests.at(-1).operation, TOKEN_BUDGET_VIOLATION); assert.equal(saved.providerRequests.at(-1).units, 0);
  const audit = JSON.parse(await readFile(join(path, "analysis/model-1-review-budget.json"), "utf8")); assert.deepEqual(audit.violations, ["input-reservation-exceeded"]); assert.equal(audit.usage.inputTokens, 2175);
  assert.equal(await readFile(join(path, "analysis/model-1-review.json"), "utf8"), '{"ok":true}');
  await assert.rejects(providers.claude("review", "evidence"), issue("model_usage_exceeded"));
  await assert.rejects(providers.audio("sfx", "quiet", 1), issue("model_usage_exceeded")); await assert.rejects(providers.transcribe("unused.mp3", 1), issue("model_usage_exceeded"));
  await assert.rejects(new Providers(path, input, hooks()).init(resolve("skills/video-studio")), issue("model_usage_exceeded")); assert.equal(requests, 2);
});

test("actual input/output above global caps remains recorded rather than silently clamped", async (t) => {
  environment(t); const path = await workspace(t), providers = new Providers(path, { ...input, budgets: { ...input.budgets, maxModelInputTokens: 3000, maxModelOutputTokens: 600 } }, hooks());
  mockFetch(t, async url => String(url).endsWith("count_tokens") ? countResult() : result(3001, 601));
  await assert.rejects(providers.claude("review", "evidence"), issue("model_usage_exceeded")); assert.equal(providers.ledger.inputTokens, 3001); assert.equal(providers.ledger.outputTokens, 601);
  const audit = JSON.parse(await readFile(join(path, "analysis/model-1-review-budget.json"), "utf8")); assert.deepEqual(audit.violations, ["input-reservation-exceeded", "output-reservation-exceeded", "input-job-cap-exceeded", "output-job-cap-exceeded"]);
});

test("failed post-response checkpoint stops the current adapter and restored unresolved reservations", async (t) => {
  environment(t); const path = await workspace(t); let durable = "", ledgerSaves = 0, requests = 0;
  const providers = new Providers(path, input, hooks(async paths => { if (!paths.includes("ledger.json")) return; if (++ledgerSaves === 2) throw new Error("usage checkpoint interrupted"); durable = await readFile(join(path, "ledger.json"), "utf8"); }));
  mockFetch(t, async url => { requests++; return String(url).endsWith("count_tokens") ? countResult() : result(); });
  await assert.rejects(providers.claude("review", "evidence"), /usage checkpoint interrupted/);
  await assert.rejects(providers.claude("review", "evidence"), issue("model_reservation_unresolved"));
  // A retry downloads the last acknowledged remote ledger, not the newer local file.
  await writeFile(join(path, "ledger.json"), durable); const restored = new Providers(path, input, hooks());
  await assert.rejects(restored.init(resolve("skills/video-studio")), issue("model_reservation_unresolved"));
  await assert.rejects(restored.claude("review", "evidence"), issue("model_reservation_unresolved")); assert.equal(requests, 2);
});

test("invalid usage retains its reservation and a corrupt usage ledger never resets the budget", async (t) => {
  environment(t); const path = await workspace(t), providers = new Providers(path, input, hooks()); let requests = 0;
  mockFetch(t, async url => { requests++; return String(url).endsWith("count_tokens") ? countResult() : result(-1, 20); });
  await assert.rejects(providers.claude("review", "evidence"), issue("missing_model_usage")); assert.equal(providers.ledger.inputTokens, 0); assert.equal(providers.ledger.reservedInputTokens, 2174);
  await assert.rejects(providers.claude("review", "evidence"), issue("model_reservation_unresolved")); assert.equal(requests, 2);
  await writeFile(join(path, "ledger.json"), "{broken"); await assert.rejects(new Providers(path, input, hooks()).init(resolve("skills/video-studio")), issue("model_ledger_unreadable"));
});
