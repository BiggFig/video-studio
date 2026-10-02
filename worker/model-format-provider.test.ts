import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { Providers } from "./providers";
import { SCRIPT_OUTPUT_SCHEMA, constrainedScriptSchema, type ScriptConstraints } from "./model-format";
import type { Hooks, WorkerInput } from "./types";

const input: WorkerInput = { jobId: "format-test", ownerId: "fixture", mode: "url", productUrl: "https://example.com", videoType: "launch", format: "auto", files: [], budgets: { maxModelCalls: 10, maxModelInputTokens: 200000, maxModelOutputTokens: 30000 } };
const hooks: Hooks = { persist: async () => {}, state: async () => {}, complete: async () => {} };
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const constraints: ScriptConstraints = { assetIds: ["editor", "graph"], selectedFactIds: ["fact-8", "fact-9", "fact-16"], roleEvidenceIds: { product: ["fact-8"], mechanism: ["fact-16"], outcome: ["fact-8", "fact-9"], cta: ["fact-8"] } };
async function fixture(t: TestContext) {
  for (const key of ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "AI_GATEWAY_API_KEY", "AI_GATEWAY_MODEL", "VERCEL_OIDC_TOKEN"]) {
    const previous = process.env[key]; delete process.env[key];
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  process.env.ANTHROPIC_API_KEY = "test-only-no-network";
  process.env.ANTHROPIC_MODEL = "claude-sonnet-4-6";
  const parent = await realpath(tmpdir()), workspace = await mkdtemp(join(parent, "video-studio-model-format-"));
  t.after(async () => { const target = await realpath(workspace); if (resolve(target) !== resolve(workspace) || dirname(target) !== parent || !basename(target).startsWith("video-studio-model-format-")) throw new Error("Unsafe test cleanup"); await rm(target, { recursive: true, force: true }); });
  return { workspace, providers: new Providers(workspace, input, hooks) };
}

for (const constrained of [false, true]) for (const counterAvailable of [true, false]) test(`${constrained ? "constrained" : "base"} script transport preserves schema in exact count, generation and audit; counter ${counterAvailable ? "available" : "fallback"}`, async t => {
  const { workspace, providers } = await fixture(t);
  const prompt = "Grounded source évidence";
  let counted = "", generated = "", requests = 0;
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, options?: RequestInit) => {
    requests++;
    if (String(url) === "https://api.anthropic.com/v1/messages/count_tokens") {
      counted = String(options?.body);
      return counterAvailable ? new Response(JSON.stringify({ input_tokens: 1000 })) : new Response(null, { status: 503 });
    }
    assert.equal(String(url), "https://api.anthropic.com/v1/messages");
    generated = String(options?.body);
    const body = JSON.parse(generated), { max_tokens, temperature, ...countInput } = body;
    assert.deepEqual(JSON.parse(counted), countInput);
    assert.deepEqual(body.output_config, { format: { type: "json_schema", schema: constrained ? constrainedScriptSchema(constraints) : SCRIPT_OUTPUT_SCHEMA } });
    assert.equal(max_tokens, 5000); assert.equal(temperature, 0);
    const saved = JSON.parse(await readFile(join(workspace, "analysis/model-1-script-budget.json"), "utf8"));
    assert.equal(saved.requestHash, digest(generated)); assert.equal(saved.inputRequestHash, digest(counted));
    const expected = counterAvailable ? 2174 : Buffer.byteLength(body.system + prompt, "utf8") + 1024 + Buffer.byteLength(JSON.stringify({ output_config: body.output_config }), "utf8");
    assert.equal(saved.reservation.inputTokens, expected);
    assert.equal(providers.ledger.reservedInputTokens, expected);
    assert.deepEqual(saved.limits, { inputTokens: 200000, outputTokens: 30000 });
    return new Response(JSON.stringify({ model: body.model, content: [{ type: "text", text: "{}" }], usage: { input_tokens: 1000, output_tokens: 20 } }));
  });
  await providers.claude("script", prompt, [], { policy: "script-v1", ...(constrained ? { scriptConstraints: constraints } : {}) });
  assert.equal(requests, 2); assert.equal(providers.ledger.modelCalls, 1);
  assert.equal(providers.ledger.inputTokens, 1000); assert.equal(providers.ledger.reservedInputTokens, 0);
});
