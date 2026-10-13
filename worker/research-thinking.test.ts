import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { Providers, RESEARCH_THINKING, ModelJsonResponseError, type ClaudeOptions } from "./providers";
import type { ModelProviderName } from "./model-provider";
import { scriptOutputConfig } from "./model-format";
import { compileResearchWithRetry, RESEARCH_RETRY_PATH } from "./research-review";
import { PipelineError, type Hooks, type WorkerInput } from "./types";

const input: WorkerInput = { jobId: "offline-research-thinking", ownerId: "operator", mode: "url", productUrl: "https://example.com", videoType: "launch", format: "auto", files: [], budgets: { maxModelCalls: 10, maxModelInputTokens: 200000, maxModelOutputTokens: 30000 } };
const options: ClaudeOptions = { policy: "research-v2" };
const failure = (code: string) => (error: unknown) => error instanceof PipelineError && error.code === code && error.status === "needs_review";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const response = (outputTokens = 1600, model = "claude-sonnet-4-6") => new Response(JSON.stringify({ model, usage: { input_tokens: 1000, output_tokens: outputTokens, output_tokens_details: { thinking_tokens: 1024 } }, content: [{ type: "thinking", thinking: "PRIVATE_RESEARCH_THINKING", signature: "PRIVATE_RESEARCH_SIGNATURE" }, { type: "redacted_thinking", data: "PRIVATE_REDACTED_RESEARCH" }, { type: "text", text: '{"ok":true}' }] }));

async function setup(t: TestContext, provider: ModelProviderName = "anthropic", persist: Hooks["persist"] = async () => {}) {
  for (const key of ["MODEL_PROVIDER", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "AI_GATEWAY_API_KEY", "AI_GATEWAY_MODEL", "VERCEL_OIDC_TOKEN", "OPENROUTER_API_KEY", "OPENROUTER_MODEL"]) {
    const old = process.env[key]; delete process.env[key]; t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
  }
  Object.assign(process.env, { MODEL_PROVIDER: provider, ANTHROPIC_API_KEY: "offline-direct-key", AI_GATEWAY_API_KEY: "offline-gateway-key", OPENROUTER_API_KEY: "offline-router-key" });
  const root = await realpath(tmpdir()), path = await mkdtemp(join(root, "video-studio-research-thinking-"));
  t.after(async () => { const actual = await realpath(path); if (resolve(path) !== resolve(actual) || dirname(actual) !== root || !basename(actual).startsWith("video-studio-research-thinking-")) throw new Error("Unsafe test cleanup"); await rm(actual, { recursive: true, force: true }); });
  const providers = new Providers(path, input, { persist, state: async () => {}, complete: async () => {} }); providers.skillHash = "f".repeat(64);
  return { providers, path };
}

for (const counterAvailable of [true, false]) test(`direct research v2 prompted JSON count, generation and audit bind explicitly disabled research thinking; counter ${counterAvailable ? "available" : "fallback"}`, async t => {
  const { providers, path } = await setup(t); let counted = "", generated = "";
  const reserve = { calls: 6, inputTokens: 45000, outputTokens: 22048 };
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers); assert.equal(headers.get("x-api-key"), "offline-direct-key"); assert.equal(headers.has("authorization"), false);
    assert.equal(init?.redirect, "error"); assert.ok(init?.signal instanceof AbortSignal);
    if (String(url).endsWith("count_tokens")) {
      counted = String(init?.body); assert.deepEqual(JSON.parse(counted).thinking, { type: "disabled" }); assert.equal("output_config" in JSON.parse(counted), false);
      assert.equal(providers.ledger.modelCalls, 0); return counterAvailable ? new Response('{"input_tokens":1000}') : new Response(null, { status: 503 });
    }
    assert.equal(String(url), "https://api.anthropic.com/v1/messages");
    generated = String(init?.body); const body = JSON.parse(generated);
    assert.equal(body.max_tokens, 3500); assert.equal(body.temperature, 0); assert.equal("output_config" in body, false);
    assert.match(body.system, /Policy: research-v2\./); assert.match(body.system, /UNTRUSTED EVIDENCE/);
    const { max_tokens: _max, temperature: _temperature, ...countInput } = body; assert.deepEqual(countInput, JSON.parse(counted));
    const audit = JSON.parse(await readFile(join(path, "analysis/model-1-research-budget.json"), "utf8"));
    assert.equal(audit.status, "reserved"); assert.equal(audit.systemPolicy, "research-v2"); assert.deepEqual(audit.thinking, RESEARCH_THINKING);
    assert.equal(audit.responseFormat, "prompted-json"); assert.equal("responseTransport" in audit, false);
    assert.equal(audit.inputRequestHash, digest(counted)); assert.equal(audit.requestHash, digest(generated));
    const expectedInput = counterAvailable ? 2174 : Buffer.byteLength(body.system + "Actual source evidence", "utf8") + 1024 + Buffer.byteLength(JSON.stringify({ thinking: RESEARCH_THINKING }), "utf8");
    assert.deepEqual(audit.reservation, { inputTokens: expectedInput, outputTokens: 3500 }); assert.deepEqual(audit.followupQualityReserve, reserve);
    assert.deepEqual(audit.limits, { inputTokens: 200000, outputTokens: 30000 }); assert.equal(providers.ledger.reservedOutputTokens, 3500);
    return response();
  });
  const perform = await providers.prepareClaude("research", "Actual source evidence", [], { ...options, reserve });
  assert.equal(generated, ""); assert.deepEqual(await perform(), { ok: true });
  assert.equal(providers.ledger.outputTokens, 1600); assert.equal(providers.ledger.modelCalls, 1); assert.equal(providers.ledger.providerRequests[0].units, 2600);
  assert.equal(providers.ledger.reservedInputTokens, 0); assert.equal(providers.ledger.reservedOutputTokens, 0);
  const audit = JSON.parse(await readFile(join(path, "analysis/model-1-research-budget.json"), "utf8")); assert.equal(audit.status, "completed"); assert.deepEqual(audit.usage, { inputTokens: 1000, outputTokens: 1600 });
  for (const relative of ["ledger.json", ...(await readdir(join(path, "analysis"))).map(name => `analysis/${name}`)]) {
    const value = await readFile(join(path, relative), "utf8");
    for (const privateText of ["PRIVATE_RESEARCH_THINKING", "PRIVATE_RESEARCH_SIGNATURE", "PRIVATE_REDACTED_RESEARCH", "offline-direct-key"]) assert.equal(value.includes(privateText), false);
  }
  assert.equal(await readFile(join(path, "analysis/model-1-research.json"), "utf8"), '{"ok":true}');
});

test("research v2 is scoped to research and accepts only the existing native Sonnet/Opus 4.5/4.6 model IDs", async t => {
  const { providers } = await setup(t); let counted = 0;
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    counted++; assert.ok(String(url).endsWith("count_tokens")); const body = JSON.parse(String(init?.body)); assert.deepEqual(body.thinking, RESEARCH_THINKING); assert.equal("output_config" in body, false); return new Response('{"input_tokens":1000}');
  });
  for (const model of ["claude-sonnet-4-6", "claude-opus-4-6", "claude-sonnet-4-5", "claude-opus-4-5", "claude-sonnet-4-5-20250929", "claude-opus-4-5-20251101"]) {
    providers.model = model; await providers.prepareClaude("research", "fixture", [], options);
  }
  assert.equal(counted, 6); assert.equal(providers.ledger.modelCalls, 0);
  for (const model of ["claude-sonnet-4-7", "claude-opus-5", "claude-haiku-4-5", "claude-sonnet-4-6-unknown", "anthropic/claude-sonnet-4.6"]) {
    providers.model = model; await assert.rejects(providers.prepareClaude("research", "fixture", [], options), failure("research_model_unsupported"));
  }
  await assert.rejects(providers.prepareClaude("script", "fixture", [], options), /restricted to research/); assert.equal(counted, 6);
});

for (const provider of ["vercel-ai-gateway", "openrouter"] as const) for (const model of ["anthropic/claude-sonnet-4.6", "anthropic/claude-opus-4.6"]) test(`research v2 ${model} on ${provider} retains explicitly disabled research thinking, account isolation and conservative exact-body audit`, async t => {
  const { providers, path } = await setup(t, provider); let calls = 0;
  const endpoint = provider === "openrouter" ? "https://openrouter.ai/api/v1/messages" : "https://ai-gateway.vercel.sh/v1/messages";
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    calls++; assert.equal(String(url), endpoint); const headers = new Headers(init?.headers);
    assert.equal(headers.get("authorization"), provider === "openrouter" ? "Bearer offline-router-key" : "Bearer offline-gateway-key"); assert.equal(headers.has("x-api-key"), false);
    const body = JSON.parse(String(init?.body)); assert.deepEqual(body.thinking, RESEARCH_THINKING); assert.equal(body.max_tokens, 3500); assert.equal(body.temperature, 0);
    assert.equal(body.model, model); assert.equal("fallbacks" in body, false); assert.equal("models" in body, false);
    if (provider === "openrouter") assert.deepEqual(body.provider, { require_parameters: true }); else assert.equal("provider" in body, false);
    assert.equal("output_config" in body, false);
    const audit = JSON.parse(await readFile(join(path, "analysis/model-1-research-budget.json"), "utf8"));
    assert.equal(audit.provider, provider); assert.equal(audit.estimate.method, "conservative-fallback"); assert.equal(audit.estimate.fallbackReason, provider === "openrouter" ? "openrouter" : "gateway");
    assert.equal(audit.responseFormat, "prompted-json"); assert.equal("responseTransport" in audit, false);
    const { max_tokens: _max, temperature: _temperature, ...countInput } = body; assert.equal(audit.inputRequestHash, digest(JSON.stringify(countInput))); assert.equal(audit.requestHash, digest(String(init?.body)));
    const expectedInput = Buffer.byteLength(body.system + "fixture", "utf8") + 1024 + Buffer.byteLength(JSON.stringify({ thinking: RESEARCH_THINKING }), "utf8") + (provider === "openrouter" ? Buffer.byteLength(JSON.stringify({ provider: { require_parameters: true } }), "utf8") : 0);
    assert.equal(audit.reservation.inputTokens, expectedInput); assert.equal(audit.reservation.outputTokens, 3500); return response(1600, model);
  });
  for (const model of ["anthropic/claude-sonnet-4.5", "anthropic/claude-opus-4.5", "anthropic/claude-sonnet-4.6", "anthropic/claude-opus-4.6"]) {
    providers.model = model; await providers.prepareClaude("research", "fixture", [], options);
  }
  for (const model of ["anthropic/claude-sonnet-4.7", "anthropic/claude-haiku-4.5", "claude-sonnet-4-6", "anthropic/claude-sonnet-4.6:thinking"]) {
    providers.model = model; await assert.rejects(providers.prepareClaude("research", "fixture", [], options), failure("research_model_unsupported"));
  }
  assert.equal(calls, 0); providers.model = model;
  assert.deepEqual(await providers.claude("research", "fixture", [], options), { ok: true }); assert.equal(calls, 1); assert.equal(providers.ledger.outputTokens, 1600);
});

test("research v2 needs the full 3500 output after mandatory reserves, with no counter or reservation on failure", async t => {
  const { providers } = await setup(t); let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL) => { calls++; assert.ok(String(url).endsWith("count_tokens")); return new Response('{"input_tokens":1000}'); });
  const reserve = { calls: 6, inputTokens: 45000, outputTokens: 22048 };
  providers.ledger.outputTokens = 4453;
  await assert.rejects(providers.prepareClaude("research", "fixture", [], { ...options, reserve }), failure("model_budget"));
  providers.ledger.outputTokens = 0;
  for (const maxOutputTokens of [1, 1025, 2048, 3499]) await assert.rejects(providers.prepareClaude("research", "fixture", [], { ...options, reserve, maxOutputTokens }), failure("model_budget"));
  await assert.rejects(providers.prepareClaude("research", "fixture", [], { ...options, maxOutputTokens: 3501 }), /Invalid stage output allocation/);
  providers.ledger.modelCalls = 4;
  await assert.rejects(providers.prepareClaude("research", "fixture", [], { ...options, reserve }), failure("model_budget"));
  providers.ledger.modelCalls = 0; assert.equal(calls, 0); assert.equal(providers.ledger.reservedOutputTokens, 0);
  providers.ledger.outputTokens = 4452;
  await providers.prepareClaude("research", "fixture", [], { ...options, reserve, maxOutputTokens: 3500 }); assert.equal(calls, 1); assert.equal(providers.ledger.modelCalls, 0);
});

test("research v2 keeps mandatory input reserve and never generates when the exact count cannot fit", async t => {
  const { providers } = await setup(t); let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL) => { calls++; assert.ok(String(url).endsWith("count_tokens")); return new Response('{"input_tokens":1000}'); });
  await assert.rejects(providers.prepareClaude("research", "fixture", [], { ...options, reserve: { calls: 6, inputTokens: 197827, outputTokens: 22048 } }), failure("model_budget"));
  assert.equal(calls, 1); assert.equal(providers.ledger.modelCalls, 0); assert.equal(providers.ledger.reservedInputTokens, 0);
});

test("research v1 retains its existing no-thinking and bounded-clamping behavior", async t => {
  const { providers, path } = await setup(t); let generated = false; providers.ledger.outputTokens = 29400;
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)); assert.equal("thinking" in body, false); assert.equal("output_config" in body, false);
    if (String(url).endsWith("count_tokens")) return new Response('{"input_tokens":1000}');
    generated = true; assert.equal(body.temperature, 0); assert.equal(body.max_tokens, 600); return response(100);
  });
  assert.deepEqual(await providers.claude("research", "fixture", [], { policy: "research-v1" }), { ok: true }); assert.equal(generated, true);
  const audit = JSON.parse(await readFile(join(path, "analysis/model-1-research-budget.json"), "utf8")); assert.equal("thinking" in audit, false); assert.equal(audit.reservation.outputTokens, 600);
});

test("OpenRouter research HTTP400 retains its one reservation and cannot retry or resume with changed format selection", async t => {
  const { providers, path } = await setup(t, "openrouter"); let calls = 0;
  providers.model = "anthropic/claude-opus-4.6";
  t.mock.method(globalThis, "fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
    calls++; const body = JSON.parse(String(init?.body));
    assert.equal("output_config" in body, false); assert.equal(body.max_tokens, 3500);
    return new Response(JSON.stringify({ error: { type: "invalid_request_error", message: "Schema is too complex for compilation." } }), { status: 400 });
  });
  await assert.rejects(providers.claude("research", "fixture", [], options), failure("model_unavailable"));
  assert.equal(calls, 1); assert.equal(providers.ledger.modelCalls, 1); assert.equal(providers.ledger.outputTokens, 0);
  assert.equal(providers.ledger.reservedOutputTokens, 3500); assert.ok(providers.ledger.reservedInputTokens > 0);
  const audit = JSON.parse(await readFile(join(path, "analysis/model-1-research-budget.json"), "utf8"));
  assert.equal(audit.status, "http-error"); assert.equal(audit.diagnostic.category, "schema_compilation");
  assert.equal(audit.responseFormat, "prompted-json");
  await assert.rejects(providers.prepareClaude("research", "fixture", [], options), failure("model_reservation_unresolved"));
  const restored = new Providers(path, input, { persist: async () => {}, state: async () => {}, complete: async () => {} });
  restored.ledger = JSON.parse(await readFile(join(path, "ledger.json"), "utf8"));
  await assert.rejects(restored.prepareClaude("research", "fixture", [], options), failure("model_reservation_unresolved"));
  assert.equal(calls, 1);
});

test("OpenRouter initial research and its single confirmed JSON correction both use prompted JSON with complete reservations", async t => {
  const { providers, path } = await setup(t, "openrouter"); let calls = 0;
  const prompt = "Return research-flat-v1 JSON from only the supplied evidence.", hooks: Hooks = { persist: async () => {}, state: async () => {}, complete: async () => {} };
  const refusal = { transportVersion: "research-flat-v1", sufficientEvidence: false, reason: "No source supports an actual workflow.", product: "", documentTargets: [], facts: [], visuals: [], claims: [], mechanismSteps: [], summary: "", limitations: [] };
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    calls++; assert.equal(String(url), "https://openrouter.ai/api/v1/messages");
    const request = String(init?.body), body = JSON.parse(request);
    assert.equal("output_config" in body, false); assert.equal(body.max_tokens, 3500); assert.deepEqual(body.thinking, RESEARCH_THINKING);
    if (calls === 2) assert.match(body.messages[0].content.at(-1).text, /RESEARCH RESPONSE CORRECTION/);
    const audit = JSON.parse(await readFile(join(path, `analysis/model-${calls}-research-budget.json`), "utf8"));
    const { max_tokens: _max, temperature: _temperature, ...countInput } = body;
    assert.equal(audit.responseFormat, "prompted-json"); assert.equal(audit.requestHash, digest(request)); assert.equal(audit.inputRequestHash, digest(JSON.stringify(countInput)));
    const expectedInput = Buffer.byteLength(body.system + body.messages[0].content.at(-1).text, "utf8") + 1024 + Buffer.byteLength(JSON.stringify({ thinking: RESEARCH_THINKING }), "utf8") + Buffer.byteLength(JSON.stringify({ provider: { require_parameters: true } }), "utf8");
    assert.equal(audit.reservation.inputTokens, expectedInput); assert.equal(audit.reservation.outputTokens, 3500);
    assert.equal(audit.followupQualityReserve.calls, 6); assert.equal(audit.followupQualityReserve.outputTokens, 22048); assert.ok(audit.followupQualityReserve.inputTokens > 0);
    return new Response(JSON.stringify({ model: body.model, usage: { input_tokens: 1000, output_tokens: 50 }, content: [{ type: "text", text: calls === 1 ? '{"sufficientEvidence":true}}' : JSON.stringify(refusal) }] }));
  });
  const reserve = { calls: 6, inputTokens: 45000, outputTokens: 22048 };
  const raw = await providers.claude("research", prompt, [], { ...options, reserve }).catch(error => error);
  assert.ok(raw instanceof ModelJsonResponseError);
  const retry = { input, evidence: { text: "No product facts available.", assets: [] }, evidenceSha256: "b".repeat(64), workspace: path, hooks, providers, prompt, images: [], singleTarget: true as const, workflowSelection: true as const };
  await assert.rejects(compileResearchWithRetry(raw, retry), error => error instanceof PipelineError && error.code === "insufficient_product_evidence");
  assert.equal(calls, 2); assert.equal(providers.ledger.modelCalls, 2); assert.equal(providers.ledger.reservedInputTokens, 0); assert.equal(providers.ledger.reservedOutputTokens, 0);
  const marker = JSON.parse(await readFile(join(path, RESEARCH_RETRY_PATH), "utf8")); assert.equal(marker.status, "completed"); assert.equal(marker.outcome, "invalid");
  await assert.rejects(compileResearchWithRetry(raw, retry), /already consumed/); assert.equal(calls, 2);
});

test("OpenRouter keeps native UI, script, workflow and guide grammars outside research-v2", async t => {
  const { providers, path } = await setup(t, "openrouter"); providers.model = "anthropic/claude-opus-4.6"; let calls = 0;
  const cases: { purpose: string; options: ClaudeOptions }[] = [
    { purpose: "ui-design", options: { policy: "ui-design-v1", uiConstraints: { targets: [{ id: "editor", sourceAssetIds: ["screen"], capabilityFactIds: ["fact-1"] }] } } },
    { purpose: "script", options: { policy: "script-v1" } },
    { purpose: "workflow-coherence", options: { policy: "workflow-coherence-v2", workflowConstraints: { contextSha256: "a".repeat(64), sceneIds: ["scene-1"], version: 2, obligationIds: ["scene-1-task"] } } },
    { purpose: "guide-selection", options: { policy: "guide-selection-v1", guideConstraints: { guideIds: ["guide-1"], sourceAssetIds: ["screen"] } } },
  ];
  t.mock.method(globalThis, "fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
    const current = cases[calls++], body = JSON.parse(String(init?.body));
    assert.deepEqual(body.output_config, scriptOutputConfig("claude-opus-4-6", true, current.options.policy, current.options.scriptConstraints, current.options.uiConstraints, current.options.workflowConstraints, current.options.guideConstraints));
    assert.ok(body.output_config); assert.deepEqual(body.provider, { require_parameters: true });
    const audit = JSON.parse(await readFile(join(path, `analysis/model-${calls}-${current.purpose}-budget.json`), "utf8")); assert.equal("responseFormat" in audit, false);
    return response(100, body.model);
  });
  for (const current of cases) await providers.claude(current.purpose, "fixture", [], current.options);
  assert.equal(calls, cases.length);
});

test("research thinking does not generate after a failed durable reservation checkpoint", async t => {
  const { providers } = await setup(t, "anthropic", async paths => { if (paths.some(path => path.endsWith("-budget.json"))) throw new Error("offline checkpoint failure"); }); let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL) => { calls++; assert.ok(String(url).endsWith("count_tokens")); return new Response('{"input_tokens":1000}'); });
  const perform = await providers.prepareClaude("research", "fixture", [], options);
  await assert.rejects(perform(), /offline checkpoint failure/); assert.equal(calls, 1); assert.equal(providers.ledger.reservedOutputTokens, 3500);
  await assert.rejects(providers.prepareClaude("research", "fixture", [], options), failure("model_reservation_unresolved"));
});

test("research billed thinking exceeding 3500 remains recorded and stops later provider work", async t => {
  const { providers, path } = await setup(t); let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL) => { calls++; return String(url).endsWith("count_tokens") ? new Response('{"input_tokens":1000}') : response(3501); });
  await assert.rejects(providers.claude("research", "fixture", [], options), failure("model_usage_exceeded"));
  const ledger = JSON.parse(await readFile(join(path, "ledger.json"), "utf8")); assert.equal(ledger.outputTokens, 3501); assert.equal(ledger.providerRequests.at(-1).units, 0);
  const audit = JSON.parse(await readFile(join(path, "analysis/model-1-research-budget.json"), "utf8")); assert.deepEqual(audit.violations, ["output-reservation-exceeded"]);
  const restored = new Providers(path, input, { persist: async () => {}, state: async () => {}, complete: async () => {} }); restored.ledger = ledger;
  await assert.rejects(restored.prepareClaude("research", "fixture", [], options), failure("model_usage_exceeded")); assert.equal(calls, 2);
});
