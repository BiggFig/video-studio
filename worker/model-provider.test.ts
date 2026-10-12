import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { Providers } from "./providers";
import { resolveModelProvider } from "./model-provider";
import { parseProviderLedger } from "./provider-ledger";
import { PipelineError, type WorkerInput } from "./types";
import { WORKFLOW_THINKING } from "./workflow-coherence";

const input: WorkerInput = { jobId: "offline-openrouter", ownerId: "operator", mode: "url", productUrl: "https://example.com", videoType: "launch", format: "auto", files: [], budgets: { maxModelCalls: 10, maxModelInputTokens: 200000, maxModelOutputTokens: 30000 } };
const hooks = { persist: async () => {}, state: async () => {}, complete: async () => {} };
const errorCode = (code: string) => (error: unknown) => error instanceof PipelineError && error.code === code;
const response = (usage: unknown = { input_tokens: 1000, output_tokens: 1300 }) => new Response(JSON.stringify({ id: "gen-test-only", model: "anthropic/claude-sonnet-4.6", usage, content: [{ type: "thinking", thinking: "PRIVATE_THOUGHT", signature: "PRIVATE_SIGNATURE" }, { type: "text", text: '{"ok":true}' }] }));
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
function environment(t: TestContext) {
  for (const key of ["MODEL_PROVIDER", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "AI_GATEWAY_API_KEY", "AI_GATEWAY_MODEL", "VERCEL_OIDC_TOKEN", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "ELEVENLABS_API_KEY"]) {
    const previous = process.env[key]; delete process.env[key];
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  Object.assign(process.env, { MODEL_PROVIDER: "openrouter", OPENROUTER_API_KEY: "fake-openrouter-test-key", ANTHROPIC_API_KEY: "stale-direct-test-key", AI_GATEWAY_API_KEY: "unused-gateway-test-key", ELEVENLABS_API_KEY: "fake-audio-test-key" });
}
async function workspace(t: TestContext) {
  const root = await realpath(tmpdir()), path = await mkdtemp(join(root, "video-studio-openrouter-"));
  t.after(async () => { const actual = await realpath(path); if (resolve(actual) !== resolve(path) || dirname(actual) !== root || !basename(actual).startsWith("video-studio-openrouter-")) throw Error("Unsafe test cleanup"); await rm(actual, { recursive: true, force: true }); });
  return path;
}

test("explicit provider selection is authoritative; implicit existing priority and model IDs remain unchanged", () => {
  const env = { ANTHROPIC_API_KEY: "direct", AI_GATEWAY_API_KEY: "gateway", VERCEL_OIDC_TOKEN: "oidc", OPENROUTER_API_KEY: "router" };
  assert.equal(resolveModelProvider(env).provider, "anthropic");
  assert.equal(resolveModelProvider({ ...env, ANTHROPIC_API_KEY: undefined }).credential, "gateway");
  assert.equal(resolveModelProvider({ VERCEL_OIDC_TOKEN: "oidc", OPENROUTER_API_KEY: "router" }).provider, "vercel-ai-gateway");
  const router = resolveModelProvider({ ...env, MODEL_PROVIDER: "openrouter" });
  assert.deepEqual(router, { provider: "openrouter", model: "anthropic/claude-sonnet-4.6", credential: "router", endpoint: "https://openrouter.ai/api/v1/messages", direct: false });
  assert.equal(resolveModelProvider({ OPENROUTER_API_KEY: "router" }).provider, "openrouter");
  assert.equal(resolveModelProvider({ ...env, MODEL_PROVIDER: "anthropic" }).model, "claude-sonnet-4-6");
  assert.equal(resolveModelProvider({ ...env, MODEL_PROVIDER: "vercel-ai-gateway" }).credential, "gateway");
  assert.equal(resolveModelProvider({ ANTHROPIC_API_KEY: "direct", MODEL_PROVIDER: "openrouter" }).credential, undefined);
  assert.throws(() => resolveModelProvider({ ...env, MODEL_PROVIDER: "typo" }), errorCode("provider_not_configured"));
});

test("OpenRouter preserves bounded thinking, exact schemas and durable accounting without using stale direct credentials", async t => {
  environment(t); const path = await workspace(t), providers = new Providers(path, input, hooks); providers.skillHash = "a".repeat(64);
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, options?: RequestInit) => {
    calls++; assert.equal(String(url), "https://openrouter.ai/api/v1/messages");
    const headers = new Headers(options?.headers); assert.equal(headers.get("authorization"), "Bearer fake-openrouter-test-key"); assert.equal(headers.has("x-api-key"), false); assert.equal(options?.redirect, "error");
    const body = JSON.parse(String(options?.body));
    assert.equal(body.model, "anthropic/claude-sonnet-4.6"); assert.equal(body.max_tokens, 2048); assert.deepEqual(body.thinking, WORKFLOW_THINKING); assert.equal("temperature" in body, false);
    assert.deepEqual(body.provider, { require_parameters: true }); assert.equal("fallbacks" in body, false); assert.equal("models" in body, false);
    assert.equal(body.output_config.format.type, "json_schema"); assert.deepEqual(body.output_config.format.schema.properties.contextSha256.enum, ["b".repeat(64)]);
    const audit = JSON.parse(await readFile(join(path, "analysis/model-1-workflow-coherence-budget.json"), "utf8"));
    assert.equal(audit.status, "reserved"); assert.equal(audit.provider, "openrouter"); assert.equal(audit.estimate.fallbackReason, "openrouter"); assert.equal(audit.requestHash, digest(String(options?.body))); assert.equal(audit.reservation.outputTokens, 2048);
    assert.equal(providers.ledger.reservedInputTokens, audit.reservation.inputTokens); assert.equal(providers.ledger.modelCalls, 1);
    return response();
  });
  const options = { policy: "workflow-coherence-v2" as const, workflowConstraints: { version: 2 as const, contextSha256: "b".repeat(64), sceneIds: ["scene-2"], obligationIds: ["scene-2-task"] }, reserve: { calls: 3, inputTokens: 45000, outputTokens: 9000 } };
  const perform = await providers.prepareClaude("workflow-coherence", "Offline context", [], options); assert.equal(calls, 0);
  assert.deepEqual(await perform(), { ok: true }); assert.equal(calls, 1); assert.equal(providers.ledger.outputTokens, 1300); assert.equal(providers.ledger.reservedOutputTokens, 0);
  assert.equal(providers.ledger.providerRequests[0].provider, "openrouter"); assert.equal(providers.ledger.providerRequests[0].requestId, "gen-test-only");
  assert.deepEqual(parseProviderLedger(JSON.parse(await readFile(join(path, "ledger.json"), "utf8"))), providers.ledger);
  const restored = new Providers(path, input, hooks); await restored.init(resolve("skills/video-studio")); assert.equal(restored.ledger.modelCalls, 1);
  for (const file of ["ledger.json", ...(await readdir(join(path, "analysis"))).map(name => `analysis/${name}`)]) {
    const content = await readFile(join(path, file), "utf8"); for (const secret of ["fake-openrouter-test-key", "stale-direct-test-key", "PRIVATE_THOUGHT", "PRIVATE_SIGNATURE"]) assert.equal(content.includes(secret), false);
  }
});

test("OpenRouter script grammar and required future-review reserve use the same conservative route", async t => {
  environment(t); const path = await workspace(t), providers = new Providers(path, input, hooks); let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, options?: RequestInit) => {
    calls++; assert.equal(String(url), "https://openrouter.ai/api/v1/messages"); const body = JSON.parse(String(options?.body));
    assert.equal(body.output_config.format.type, "json_schema"); assert.equal(body.max_tokens, 5000); assert.equal(body.temperature, 0); assert.equal("thinking" in body, false); return response({ input_tokens: 1000, output_tokens: 25 });
  });
  const reserve = await providers.qualityRemainderReserve([{ prompt: "Future evidence", images: [] }]); assert.equal(calls, 0); assert.equal(reserve.calls, 1); assert.equal(reserve.outputTokens, 3000); assert.ok(reserve.inputTokens > 1024);
  assert.deepEqual(await providers.claude("script", "Source grounded script", [], { policy: "script-v1", reserve }), { ok: true }); assert.equal(calls, 1);
});

test("OpenRouter missing credentials, unsupported thinking and exhausted allowances fail before any request", async t => {
  environment(t); const path = await workspace(t); let calls = 0; t.mock.method(globalThis, "fetch", async () => { calls++; throw Error("No network expected"); });
  delete process.env.OPENROUTER_API_KEY;
  await assert.rejects(new Providers(path, input, hooks).claude("research", "evidence", [], { policy: "research-v1" }), errorCode("provider_not_configured"));
  process.env.OPENROUTER_API_KEY = "fake-openrouter-test-key";
  const providers = new Providers(path, input, hooks); providers.model = "anthropic/claude-haiku-4.5";
  await assert.rejects(providers.prepareClaude("workflow-coherence", "evidence", [], { policy: "workflow-coherence-v2" }), errorCode("workflow_model_unsupported"));
  providers.model = "anthropic/claude-sonnet-4.6"; providers.ledger.outputTokens = 29900;
  await assert.rejects(providers.claude("research", "evidence", [], { policy: "research-v1" }), errorCode("model_budget")); assert.equal(calls, 0); assert.equal(providers.ledger.modelCalls, 0);
});

for (const failure of ["http", "missing-usage", "overrun"] as const) test(`OpenRouter ${failure} preserves existing failure and resume guards`, async t => {
  environment(t); const path = await workspace(t), providers = new Providers(path, input, hooks); let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return failure === "http" ? new Response("No retry", { status: 429 }) : failure === "missing-usage" ? new Response('{"content":[{"type":"text","text":"{}"}]}') : response({ input_tokens: 100000, output_tokens: 25 }); });
  const initial = failure === "http" ? "model_unavailable" : failure === "missing-usage" ? "missing_model_usage" : "model_usage_exceeded";
  const blocked = failure === "overrun" ? "model_usage_exceeded" : "model_reservation_unresolved";
  await assert.rejects(providers.claude("research", "evidence", [], { policy: "research-v1" }), errorCode(initial));
  await assert.rejects(providers.claude("research", "evidence", [], { policy: "research-v1" }), errorCode(blocked));
  await assert.rejects(new Providers(path, input, hooks).init(resolve("skills/video-studio")), errorCode(blocked));
  assert.equal(calls, 1); assert.equal(providers.ledger.modelCalls, 1);
  if (failure !== "overrun") { assert.ok(providers.ledger.reservedInputTokens > 0); assert.equal(providers.ledger.reservedOutputTokens, 3500); }
});
