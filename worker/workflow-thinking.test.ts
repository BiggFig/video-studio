import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { Providers, type ClaudeOptions } from "./providers";
import { PipelineError, type Hooks, type WorkerInput } from "./types";
import { workflowInputReserve, workflowOutputLimit, workflowSceneLimit, WORKFLOW_THINKING } from "./workflow-coherence";

const input: WorkerInput = { jobId: "offline-thinking", ownerId: "operator", mode: "url", productUrl: "https://example.com", videoType: "launch", format: "auto", files: [], budgets: { maxModelCalls: 10, maxModelInputTokens: 200000, maxModelOutputTokens: 30000 } };
const options = (version: 1 | 2 = 2): ClaudeOptions => ({ policy: version === 1 ? "workflow-coherence-v1" : "workflow-coherence-v2", maxOutputTokens: workflowOutputLimit(version), workflowConstraints: { version, contextSha256: "a".repeat(64), sceneIds: ["scene-2"], ...(version === 2 ? { obligationIds: ["scene-2-task"] } : {}) } });
const failure = (code: string) => (error: unknown) => error instanceof PipelineError && error.code === code;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const response = (outputTokens = 1300) => new Response(JSON.stringify({ model: "claude-sonnet-4-6", usage: { input_tokens: 1000, output_tokens: outputTokens, output_tokens_details: { thinking_tokens: 1024 } }, content: [{ type: "thinking", thinking: "PRIVATE_THINKING_MUST_NOT_PERSIST", signature: "PRIVATE_SIGNATURE" }, { type: "text", text: '{"ok":true}' }] }));

async function setup(t: TestContext, direct = true, persist: Hooks["persist"] = async () => {}) {
  for (const key of ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "AI_GATEWAY_API_KEY", "AI_GATEWAY_MODEL", "VERCEL_OIDC_TOKEN"]) {
    const old = process.env[key]; delete process.env[key]; t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
  }
  process.env[direct ? "ANTHROPIC_API_KEY" : "AI_GATEWAY_API_KEY"] = "offline-no-network";
  const root = await realpath(tmpdir()), path = await mkdtemp(join(root, "video-studio-thinking-"));
  t.after(async () => { const actual = await realpath(path); if (resolve(path) !== resolve(actual) || dirname(actual) !== root || !basename(actual).startsWith("video-studio-thinking-")) throw new Error("Unsafe test cleanup"); await rm(actual, { recursive: true, force: true }); });
  const providers = new Providers(path, input, { persist, state: async () => {}, complete: async () => {} }); providers.skillHash = "f".repeat(64);
  return { providers, path };
}

test("v2 exact counter, paid body and durable audit bind thinking; all billed output counts, thinking never persists", async t => {
  const { providers, path } = await setup(t); let counted = "", generated = "";
  const reserve = { calls: 3, inputTokens: 45000, outputTokens: 9000 };
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).endsWith("count_tokens")) { counted = String(init?.body); assert.deepEqual(JSON.parse(counted).thinking, WORKFLOW_THINKING); return new Response('{"input_tokens":1000}'); }
    generated = String(init?.body); const body = JSON.parse(generated);
    assert.equal(body.max_tokens, 2048); assert.equal("temperature" in body, false);
    const { max_tokens: _max, ...countInput } = body; assert.deepEqual(countInput, JSON.parse(counted));
    const audit = JSON.parse(await readFile(join(path, "analysis/model-1-workflow-coherence-budget.json"), "utf8"));
    assert.equal(audit.status, "reserved"); assert.deepEqual(audit.thinking, WORKFLOW_THINKING); assert.equal(audit.inputRequestHash, digest(counted)); assert.equal(audit.requestHash, digest(generated));
    assert.deepEqual(audit.reservation, { inputTokens: 2174, outputTokens: 2048 }); assert.deepEqual(audit.followupQualityReserve, reserve); assert.equal(providers.ledger.reservedOutputTokens, 2048);
    return response();
  });
  const perform = await providers.prepareClaude("workflow-coherence", "Offline bounded context", [], { ...options(), reserve });
  assert.equal(generated, ""); assert.deepEqual(await perform(), { ok: true });
  assert.equal(providers.ledger.outputTokens, 1300); assert.equal(providers.ledger.modelCalls, 1); assert.equal(providers.ledger.providerRequests[0].units, 2300);
  assert.equal(providers.ledger.reservedOutputTokens, 0);
  for (const relative of ["ledger.json", ...(await readdir(join(path, "analysis"))).map(name => `analysis/${name}`)]) {
    const value = await readFile(join(path, relative), "utf8"); assert.equal(value.includes("PRIVATE_THINKING"), false); assert.equal(value.includes("PRIVATE_SIGNATURE"), false);
  }
  assert.equal(await readFile(join(path, "analysis/model-1-workflow-coherence.json"), "utf8"), '{"ok":true}');
});

test("thinking accepts only documented native4.5/4.6 model IDs, including structured final JSON", async t => {
  const { providers } = await setup(t); let count = 0;
  t.mock.method(globalThis, "fetch", async (_url: RequestInfo | URL, init?: RequestInit) => { count++; const body = JSON.parse(String(init?.body)); assert.deepEqual(body.thinking, WORKFLOW_THINKING); assert.equal(body.output_config.format.type, "json_schema"); return new Response('{"input_tokens":1000}'); });
  for (const model of ["claude-sonnet-4-6", "claude-opus-4-6", "claude-sonnet-4-5-20250929", "claude-opus-4-5-20251101"]) { providers.model = model; await providers.prepareClaude("workflow-coherence", "fixture", [], options()); }
  assert.equal(count, 4); assert.equal(providers.ledger.modelCalls, 0);
  for (const model of ["claude-sonnet-4-7", "claude-opus-5", "claude-haiku-4-5", "claude-sonnet-4-6-unknown", "anthropic/claude-sonnet-4.6"]) { providers.model = model; await assert.rejects(providers.prepareClaude("workflow-coherence", "fixture", [], options()), failure("workflow_model_unsupported")); }
  assert.equal(count, 4);
});

test("known Gateway models retain bounded thinking and conservative input accounting, v1 remains unchanged", async t => {
  const { providers, path } = await setup(t, false); let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    calls++; assert.equal(String(url), "https://ai-gateway.vercel.sh/v1/messages"); const body = JSON.parse(String(init?.body));
    if (calls === 1) {
      assert.deepEqual(body.thinking, WORKFLOW_THINKING); assert.equal("temperature" in body, false); assert.equal(body.max_tokens, 2048);
      const audit = JSON.parse(await readFile(join(path, "analysis/model-1-workflow-coherence-budget.json"), "utf8"));
      assert.equal(audit.estimate.method, "conservative-fallback"); assert.equal(audit.estimate.fallbackReason, "gateway"); assert.deepEqual(audit.thinking, WORKFLOW_THINKING); assert.ok(audit.reservation.inputTokens <= workflowInputReserve());
      const { max_tokens: _max, ...countInput } = body; assert.equal(audit.inputRequestHash, digest(JSON.stringify(countInput))); assert.equal(audit.requestHash, digest(String(init?.body)));
      return response();
    }
    assert.equal("thinking" in body, false); assert.equal(body.temperature, 0); assert.equal(body.max_tokens, 768); return response(100);
  });
  const originalModel = providers.model; providers.model = "anthropic/claude-sonnet-4.7";
  await assert.rejects(providers.prepareClaude("workflow-coherence", "fixture", [], options()), failure("workflow_model_unsupported")); assert.equal(calls, 0);
  providers.model = originalModel;
  assert.deepEqual(await (await providers.prepareClaude("workflow-coherence", "fixture", [], options()))(), { ok: true }); assert.equal(calls, 1); assert.equal(providers.ledger.outputTokens, 1300);
  assert.deepEqual(await (await providers.prepareClaude("workflow-coherence", "fixture", [], options(1)))(), { ok: true }); assert.equal(calls, 2); assert.equal(providers.ledger.outputTokens, 1400);
});

test("full2048 thinking allocation must fit after mandatory reserves, with no counter or reservation on failure", async t => {
  const { providers } = await setup(t); let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return new Response('{"input_tokens":1000}'); });
  const reserve = { calls: 3, inputTokens: 1, outputTokens: 9000 };
  providers.ledger.outputTokens = 18953;
  await assert.rejects(providers.prepareClaude("workflow-coherence", "fixture", [], { ...options(), reserve }), failure("model_budget"));
  providers.ledger.outputTokens = 0;
  await assert.rejects(providers.prepareClaude("workflow-coherence", "fixture", [], { ...options(), maxOutputTokens: 1025 }), failure("model_budget"));
  assert.equal(calls, 0); assert.equal(providers.ledger.modelCalls, 0); assert.equal(providers.ledger.reservedOutputTokens, 0);
  providers.ledger.outputTokens = 18952;
  await providers.prepareClaude("workflow-coherence", "fixture", [], { ...options(), reserve }); assert.equal(calls, 1);
  assert.equal(workflowOutputLimit(1), 768); assert.equal(workflowOutputLimit(), 2048); assert.equal(workflowSceneLimit(1), 8); assert.equal(workflowSceneLimit(), 6);
});

test("thinking generation never starts if durable reservation persistence fails", async t => {
  const { providers } = await setup(t, true, async paths => { if (paths.some(path => path.endsWith("-budget.json"))) throw new Error("offline checkpoint failure"); }); let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL) => { calls++; assert.ok(String(url).endsWith("count_tokens")); return new Response('{"input_tokens":1000}'); });
  const perform = await providers.prepareClaude("workflow-coherence", "fixture", [], options());
  await assert.rejects(perform(), /offline checkpoint failure/); assert.equal(calls, 1); assert.equal(providers.ledger.reservedOutputTokens, 2048);
  await assert.rejects(providers.prepareClaude("workflow-coherence", "fixture", [], options()), failure("model_reservation_unresolved"));
});

test("billed thinking above total reservation leaves durable violation and prevents another paid step", async t => {
  const { providers, path } = await setup(t); let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL) => { calls++; return String(url).endsWith("count_tokens") ? new Response('{"input_tokens":1000}') : response(2049); });
  await assert.rejects((await providers.prepareClaude("workflow-coherence", "fixture", [], options()))(), failure("model_usage_exceeded"));
  const ledger = JSON.parse(await readFile(join(path, "ledger.json"), "utf8")); assert.equal(ledger.outputTokens, 2049); assert.equal(ledger.providerRequests.at(-1).units, 0);
  const restored = new Providers(path, input, { persist: async () => {}, state: async () => {}, complete: async () => {} }); restored.ledger = ledger;
  await assert.rejects(restored.prepareClaude("workflow-coherence", "fixture", [], options()), failure("model_usage_exceeded")); assert.equal(calls, 2);
  assert.ok(workflowInputReserve(2) > workflowInputReserve(1));
});
