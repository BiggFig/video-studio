import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { decodeModelJson } from "./model-json";
import { Providers } from "./providers";
import { PipelineError, type WorkerInput } from "./types";

// Verbatim preamble from the retained v5 correction, with a small semantic
// payload so this transport regression does not depend on ignored job files.
const correctionPrefix = "I need to fix the validation errors:\n1. `mechanism_outside_target` - fact-66 is in mechanism evidenceIds but not in target's capabilityFactIds\n2. `story_fact_not_selected` - fact-13 and fact-60 used in story but not in facts selection; fact-3 and fact-25 used in CTA but not selected\n\nI'll add fact-60 to selected facts, replace fact-13 with fact-58 in primaryAudience, replace fact-3/fact-25 with selected CTA facts, and remove fact-66 from mechanism evidenceIds (keeping it only in outcome where it's editorial).\n\n";
const payload = { sufficientEvidence: true, reason: "Preserve exact source bindings.", facts: [{ evidenceId: "fact-60", kind: "problem" }], limitations: ["No authenticated session was performed."] };

test("strict JSON and complete whole fences preserve exact data and primitive types", () => {
  for (const value of [payload, [payload], false, null, 0, "source-ui"]) {
    const json = JSON.stringify(value);
    for (const raw of [json, `\n${json}\n`, `\`\`\`json\n${json}\n\`\`\``, `\`\`\`\r\n${json}\r\n\`\`\``]) assert.deepEqual(decodeModelJson(raw), value);
  }
});

test("a retained correction-shaped prose preamble permits only the one complete object", () => {
  assert.deepEqual(decodeModelJson(correctionPrefix + JSON.stringify(payload)), payload);
  assert.deepEqual(decodeModelJson(`Here is the complete response:\n\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``), payload);
  const literal = { text: 'Quoted "braces } { [ ]" and \\ escapes stay data; ``` is literal.', nested: [{ value: "\n{}" }], passed: "true" };
  assert.deepEqual(decodeModelJson("The result follows.\n" + JSON.stringify(literal)), literal);
  assert.deepEqual(decodeModelJson(`\`\`\`json\n${JSON.stringify(literal)}\n\`\`\``), literal);
});

test("ambiguous prefixes, alternate roots, malformed content and substantive suffixes fail closed", () => {
  const rejected = [
    "", "Only commentary.", 'Response: {"ok":true', 'Response: {"ok":tru}',
    'Response: {"ok":true,}', 'Response: {"text":"unterminated}',
    'Response: {"text":"bad\\x escape"}', 'Response: {"ok":true} trailing prose',
    'Response: {"ok":true} {}', 'Response: {"ok":true}\nfalse',
    'Response: {"ok":true}\n[1]', 'Response: {"ok":true};',
    'First {} then {"ok":true}', 'First [1] then {"ok":true}',
    'The earlier result was } then {"ok":true}', 'The field [0] changes. {"ok":true}',
    '"Earlier answer"\n{"ok":true}', 'Here is "another root"\n{"ok":true}',
    'Here is the result:\nnull\nCorrected:\n{"ok":true}',
    'Here is the result:\nfalse then corrected:\n{"ok":true}',
    'Here is the result:\n42\nCorrected:\n{"ok":true}',
    'Here is the result:\n-1.5e2; corrected:\n{"ok":true}',
    'Previous response: null\nCorrected output:\n{"ok":true}',
    'Previous response: true\nCorrected output:\n{"ok":true}',
    'Previous response = false\nCorrected output:\n{"ok":true}',
    'Previous response: -1.5e2\nCorrected output:\n{"ok":true}',
    'true\n{"ok":true}', '0\n{"ok":true}',
    'Response: [{"ok":true}]', 'Response: null',
    '```json\n{"ok":true}', '```json\n{}\n```\nMore text',
    '```json\n{}\n```\n```json\n{}\n```', '```javascript\n({ok:true})\n```',
    'An earlier {} answer.\n```json\n{}\n```',
    '```json\n{} {}\n```', '```json\n{"unfinished":\n```',
  ];
  for (const raw of rejected) assert.throws(() => decodeModelJson(raw), Error, raw);
});

async function providerFixture(t: TestContext) {
  for (const key of ["MODEL_PROVIDER", "OPENROUTER_API_KEY", "OPENROUTER_MODEL"]) {
    const previous = process.env[key]; delete process.env[key];
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  Object.assign(process.env, { MODEL_PROVIDER: "openrouter", OPENROUTER_API_KEY: "offline-parser-fixture" });
  const root = await realpath(tmpdir()), workspace = await mkdtemp(join(root, "video-studio-model-json-"));
  t.after(async () => { const actual = await realpath(workspace); if (resolve(actual) !== resolve(workspace) || dirname(actual) !== root || !basename(actual).startsWith("video-studio-model-json-")) throw Error("Unsafe test cleanup"); await rm(actual, { recursive: true, force: true }); });
  const input: WorkerInput = { jobId: "offline-decoder", ownerId: "fixture", mode: "url", productUrl: "https://example.com", videoType: "launch", format: "auto", files: [], budgets: { maxModelCalls: 10, maxModelInputTokens: 200000, maxModelOutputTokens: 30000 } };
  return { workspace, providers: new Providers(workspace, input, { persist: async () => {}, state: async () => {}, complete: async () => {} }) };
}

for (const failure of ["none", "malformed", "budget"] as const) test(`provider decoding preserves raw response and accounting: ${failure}`, async t => {
  const { workspace, providers } = await providerFixture(t);
  const raw = correctionPrefix + (failure === "malformed" ? '{"sufficientEvidence":true' : JSON.stringify(payload));
  const usage = { input_tokens: failure === "budget" ? 100000 : 1000, output_tokens: 1500 };
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL) => {
    calls++; assert.equal(String(url), "https://openrouter.ai/api/v1/messages");
    return new Response(JSON.stringify({ id: "offline-response", model: "anthropic/claude-sonnet-4.6", content: [{ type: "text", text: raw }], usage }));
  });
  const generate = providers.claude("research", "Inspect supplied evidence.", [], { policy: "research-v1" });
  if (failure === "none") assert.deepEqual(await generate, payload);
  else await assert.rejects(generate, (error: unknown) => error instanceof PipelineError && error.code === (failure === "budget" ? "model_usage_exceeded" : "invalid_model_output"));
  assert.equal(calls, 1); assert.equal(providers.ledger.modelCalls, 1);
  assert.equal(providers.ledger.inputTokens, usage.input_tokens); assert.equal(providers.ledger.outputTokens, usage.output_tokens);
  assert.equal(providers.ledger.reservedInputTokens, 0); assert.equal(providers.ledger.reservedOutputTokens, 0);
  assert.equal(await readFile(join(workspace, "analysis/model-1-research.json"), "utf8"), raw);
  const audit = JSON.parse(await readFile(join(workspace, "analysis/model-1-research-budget.json"), "utf8"));
  assert.equal(audit.status, failure === "budget" ? "budget-exceeded" : "completed");
  assert.deepEqual(audit.usage, { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens });
});
