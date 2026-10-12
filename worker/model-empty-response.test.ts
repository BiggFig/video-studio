import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Providers, ModelJsonResponseError, confirmedResearchJsonFailure, type AudioRuntime } from "./providers";
import { compileResearchWithRetry, RESEARCH_RETRY_PATH } from "./research-review";
import { researchProduct } from "./research";
import { PipelineError, type Hooks, type WorkerInput } from "./types";

const input: WorkerInput = { jobId: "empty-response", ownerId: "fixture", mode: "url", productUrl: "https://example.test", videoType: "launch", format: "16:9", files: [], budgets: { maxModelCalls: 10, maxModelInputTokens: 200000, maxModelOutputTokens: 30000 } };
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const privateBlocks = [{ type: "thinking", thinking: "PRIVATE_REASONING", signature: "PRIVATE_SIGNATURE" }, { type: "redacted_thinking", data: "PRIVATE_REDACTED" }];
type Reply = { content: unknown[]; output?: number; stop?: string };
async function setup(t: TestContext, replies: Reply[], fail?: (path: string, value: any) => void) {
  for (const key of ["MODEL_PROVIDER", "OPENROUTER_API_KEY", "OPENROUTER_MODEL"]) { const previous = process.env[key]; delete process.env[key]; t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; }); }
  Object.assign(process.env, { MODEL_PROVIDER: "openrouter", OPENROUTER_API_KEY: "offline-only-key", OPENROUTER_MODEL: "anthropic/claude-opus-4.6" });
  const prefix = join(tmpdir(), "model-empty-response-"), workspace = await mkdtemp(prefix);
  t.after(async () => { if (dirname(resolve(workspace)) !== resolve(tmpdir()) || !workspace.startsWith(prefix)) throw new Error("Unsafe fixture cleanup"); await rm(workspace, { recursive: true, force: true }); });
  const persisted: { path: string; value: any }[] = [];
  const hooks: Hooks = { state: async () => {}, complete: async () => {}, persist: async paths => {
    for (const path of paths) { assert.ok((await stat(join(workspace, path))).size > 0, "Artifact guard remains strict"); const text = await readFile(join(workspace, path), "utf8"); let value: any; try { value = JSON.parse(text); } catch { value = text; } fail?.(path, value); persisted.push({ path, value }); }
  } };
  const runtime: AudioRuntime = { now: Date.now, random: Math.random, sleep: async () => {}, probe: async () => ({ width: 1000, height: 600 }) as Awaited<ReturnType<AudioRuntime["probe"]>>, measurements: async () => { throw new Error("No audio in this fixture"); } };
  const providers = new Providers(workspace, input, hooks, runtime), bodies: any[] = [];
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(url), "https://openrouter.ai/api/v1/messages"); assert.ok(bodies.length < replies.length, "No extra request allowed");
    const body = JSON.parse(String(init?.body)), reply = replies[bodies.length]; bodies.push(body);
    return new Response(JSON.stringify({ id: `offline-${bodies.length}`, model: body.model, stop_reason: reply.stop || "max_tokens", usage: { input_tokens: 1000, output_tokens: reply.output ?? 3500 }, content: reply.content }));
  });
  return { workspace, providers, hooks, persisted, bodies };
}
const researchCall = (providers: Providers) => providers.claude("research", "Return research-flat-v1 JSON.", [], { policy: "research-v2" });
async function captured(promise: Promise<unknown>) { try { await promise; assert.fail("Expected a response failure"); } catch (error) { return error; } }

for (const content of [[], privateBlocks]) test(`completed ${content.length ? "all-thinking" : "empty"} response retains usage and an authenticated nonempty metadata artifact`, async t => {
  const fixture = await setup(t, [{ content }]), { providers, workspace } = fixture;
  const error = await captured(researchCall(providers)); assert.ok(error instanceof ModelJsonResponseError); assert.match(error.message, /without returning response text/);
  assert.equal(await confirmedResearchJsonFailure(error, workspace, "research-v2"), "");
  const audit = JSON.parse(await readFile(join(workspace, "analysis/model-1-research-budget.json"), "utf8")), metadata = JSON.parse(await readFile(join(workspace, "analysis/model-1-research-empty.json"), "utf8"));
  assert.equal(audit.status, "completed"); assert.deepEqual(audit.usage, { inputTokens: 1000, outputTokens: 3500 }); assert.equal(audit.stopReason, "max_tokens"); assert.equal(audit.responseTextBytes, 0);
  assert.deepEqual(metadata, { version: 1, kind: "empty-model-text", textBytes: 0, textSha256: hash(""), requestHash: audit.requestHash, stopReason: "max_tokens" });
  assert.equal(metadata.requestHash, hash(JSON.stringify(fixture.bodies[0])));
  await assert.rejects(readFile(join(workspace, "analysis/model-1-research.json")), { code: "ENOENT" });
  assert.equal(providers.ledger.outputTokens, 3500); assert.equal(providers.ledger.inputTokens, 1000); assert.equal(providers.ledger.reservedOutputTokens, 0); assert.equal(providers.ledger.reservedInputTokens, 0);
  assert.ok(fixture.persisted.findIndex(entry => entry.path.endsWith("-budget.json") && entry.value.status === "completed") < fixture.persisted.findIndex(entry => entry.path.endsWith("-empty.json")));
  for (const path of ["ledger.json", ...(await readdir(join(workspace, "analysis"))).map(name => `analysis/${name}`)]) { const saved = await readFile(join(workspace, path), "utf8"); for (const secret of ["PRIVATE_REASONING", "PRIVATE_SIGNATURE", "PRIVATE_REDACTED", "offline-only-key"]) assert.equal(saved.includes(secret), false); }
});

test("empty receipts reject changed metadata, wrong identity, forged and restored errors", async t => {
  const { providers, workspace } = await setup(t, [{ content: privateBlocks }]); const error = await captured(researchCall(providers));
  assert.ok(error instanceof ModelJsonResponseError);
  const path = join(workspace, "analysis/model-1-research-empty.json"), text = await readFile(path, "utf8"), altered = JSON.parse(text); altered.requestHash = "0".repeat(64);
  await writeFile(path, JSON.stringify(altered)); await assert.rejects(confirmedResearchJsonFailure(error, workspace, "research-v2"), ModelJsonResponseError);
  await writeFile(path, text); assert.equal(await confirmedResearchJsonFailure(error, workspace, "research-v2"), "");
  await assert.rejects(confirmedResearchJsonFailure(error, workspace + "-other", "research-v2"), ModelJsonResponseError);
  await assert.rejects(confirmedResearchJsonFailure(error, workspace, "research-v1"), ModelJsonResponseError);
  await assert.rejects(confirmedResearchJsonFailure(new ModelJsonResponseError(true), workspace, "research-v2"), ModelJsonResponseError);
  const restored = Object.assign(new ModelJsonResponseError(true), JSON.parse(JSON.stringify(error))); await assert.rejects(confirmedResearchJsonFailure(restored, workspace, "research-v2"), ModelJsonResponseError);
  providers.ledger.outputTokens++; await assert.rejects(confirmedResearchJsonFailure(error, workspace, "research-v2"), ModelJsonResponseError);
});

for (const checkpoint of ["ledger", "audit", "metadata"] as const) test(`failed ${checkpoint} persistence cannot authorize an empty-response correction`, async t => {
  const fixture = await setup(t, [{ content: privateBlocks }], (path, value) => {
    if (checkpoint === "ledger" && path === "ledger.json" && value.outputTokens === 3500 || checkpoint === "audit" && path.endsWith("-budget.json") && value.status === "completed" || checkpoint === "metadata" && path.endsWith("-empty.json")) throw new Error("Checkpoint failed");
  });
  const error = await captured(researchCall(fixture.providers)); assert.match(String(error), /Checkpoint failed/); assert.equal(error instanceof ModelJsonResponseError, false);
  assert.equal(await confirmedResearchJsonFailure(error, fixture.workspace, "research-v2"), undefined);
  assert.equal(fixture.providers.ledger.outputTokens, 3500); assert.equal(fixture.providers.ledger.reservedOutputTokens, 0); assert.equal(fixture.bodies.length, 1);
  await assert.rejects(confirmedResearchJsonFailure(new ModelJsonResponseError(true), fixture.workspace, "research-v2"), ModelJsonResponseError);
  if (checkpoint === "metadata") assert.equal(JSON.parse(await readFile(join(fixture.workspace, "analysis/model-1-research-budget.json"), "utf8")).status, "completed");
  if (checkpoint === "ledger") await assert.rejects(researchCall(fixture.providers), error => error instanceof PipelineError && error.code === "model_reservation_unresolved");
});

test("two completed empty research responses use the one correction and retain all billed usage without a third attempt", async t => {
  const fixture = await setup(t, [{ content: privateBlocks }, { content: privateBlocks }]), initial = await captured(researchCall(fixture.providers));
  const options = { input, evidence: { text: "No extra source facts", assets: [] }, evidenceSha256: "a".repeat(64), workspace: fixture.workspace, hooks: fixture.hooks, providers: fixture.providers, prompt: "Return research-flat-v1 JSON.", images: [], singleTarget: true as const, workflowSelection: true as const };
  await assert.rejects(compileResearchWithRetry(initial, options), ModelJsonResponseError);
  assert.equal(fixture.bodies.length, 2); assert.equal(fixture.providers.ledger.outputTokens, 7000); assert.equal(fixture.providers.ledger.inputTokens, 2000); assert.equal(fixture.providers.ledger.reservedOutputTokens, 0);
  const marker = JSON.parse(await readFile(join(fixture.workspace, RESEARCH_RETRY_PATH), "utf8")); assert.equal(marker.status, "completed"); assert.equal(marker.outcome, "invalid"); assert.deepEqual(marker.diagnostics, [{ code: "invalid_json", path: [] }]);
  assert.equal(marker.rejectedValueSha256, hash(JSON.stringify(""))); assert.equal(marker.correctedValueSha256, hash(JSON.stringify("")));
  for (const index of [1, 2]) { const audit = JSON.parse(await readFile(join(fixture.workspace, `analysis/model-${index}-research-budget.json`), "utf8")); assert.equal(audit.stopReason, "max_tokens"); assert.equal(audit.responseTextBytes, 0); assert.equal(audit.status, "completed"); }
  await assert.rejects(compileResearchWithRetry(initial, options), /already consumed/); assert.equal(fixture.bodies.length, 2);
  const restoredProviders = new Providers(fixture.workspace, input, fixture.hooks); restoredProviders.ledger = JSON.parse(await readFile(join(fixture.workspace, "ledger.json"), "utf8"));
  await assert.rejects(compileResearchWithRetry(new ModelJsonResponseError(true), { ...options, providers: restoredProviders }), /already consumed/); assert.equal(fixture.bodies.length, 2);
});

test("nonresearch emptiness cannot authorize research correction and unknown stop prose is excluded", async t => {
  const fixture = await setup(t, [{ content: privateBlocks, output: 100, stop: "PRIVATE_UNKNOWN_STOP_REASON" }]);
  const error = await captured(fixture.providers.claude("reference", "fixture", [], { policy: "reference-v1" })); assert.ok(error instanceof PipelineError && error.code === "model_empty_response");
  assert.equal(await confirmedResearchJsonFailure(error, fixture.workspace, "research-v2"), undefined);
  for (const name of ["model-1-reference-budget.json", "model-1-reference-empty.json"]) { const text = await readFile(join(fixture.workspace, "analysis", name), "utf8"); assert.equal(text.includes("PRIVATE_UNKNOWN_STOP_REASON"), false); assert.equal(JSON.parse(text).stopReason, "unknown"); }
});

test("explicit refusals, non-final turns and unknown empty stops never enter research correction", async t => {
  for (const [stop, code, content] of [
    ["refusal", "model_refused", []], ["refusal", "model_refused", [{ type: "text", text: '{"sufficientEvidence":true}' }]],
    ["tool_use", "model_incomplete_response", []], ["pause_turn", "model_incomplete_response", []], ["PRIVATE_STOP", "model_empty_response", []],
  ] as const) {
    const fixture = await setup(t, [{ content: [...content], stop, output: 100 }]);
    await mkdir(join(fixture.workspace, "assets")); await writeFile(join(fixture.workspace, "assets/source.png"), "Source bytes; image probing is mocked");
    const evidence = { text: "The product offers an editor.", assets: [{ id: "source", kind: "image" as const, path: "assets/source.png", usage: "output" as const, rights: "Synthetic fixture", width: 1000, height: 600 }] };
    const error = await captured(researchProduct(input, evidence, fixture.providers, fixture.hooks, fixture.workspace));
    assert.ok(error instanceof PipelineError && error.code === code && !error.retryable); assert.equal(error instanceof ModelJsonResponseError, false);
    assert.equal(await confirmedResearchJsonFailure(error, fixture.workspace, "research-v2"), undefined);
    assert.equal(fixture.bodies.length, 1); assert.equal(fixture.providers.ledger.outputTokens, 100); assert.equal(fixture.providers.ledger.reservedOutputTokens, 0);
    await assert.rejects(readFile(join(fixture.workspace, RESEARCH_RETRY_PATH)), { code: "ENOENT" });
    const audit = JSON.parse(await readFile(join(fixture.workspace, "analysis/model-1-research-budget.json"), "utf8")); assert.equal(audit.status, "completed"); assert.equal(audit.stopReason, stop === "PRIVATE_STOP" ? "unknown" : stop);
  }
});

test("nonempty text keeps its exact raw bytes and public completion metadata", async t => {
  const raw = '{"copy":"こんにちは"}', fixture = await setup(t, [{ content: [...privateBlocks, { type: "text", text: raw }], output: 100, stop: "end_turn" }]);
  assert.deepEqual(await researchCall(fixture.providers), { copy: "こんにちは" });
  assert.equal(await readFile(join(fixture.workspace, "analysis/model-1-research.json"), "utf8"), raw);
  const audit = JSON.parse(await readFile(join(fixture.workspace, "analysis/model-1-research-budget.json"), "utf8")); assert.equal(audit.responseTextBytes, Buffer.byteLength(raw)); assert.equal(audit.stopReason, "end_turn");
  await assert.rejects(readFile(join(fixture.workspace, "analysis/model-1-research-empty.json")), { code: "ENOENT" });
});

test("failed empty response checkpoints leave the durable research stage reserved on process restoration", async t => {
  for (const checkpoint of ["audit", "metadata"] as const) {
    const fixture = await setup(t, [{ content: privateBlocks }], (path, value) => { if (checkpoint === "audit" && path.endsWith("-budget.json") && value.status === "completed" || checkpoint === "metadata" && path.endsWith("-empty.json")) throw new Error("Response checkpoint lost"); });
    await mkdir(join(fixture.workspace, "assets")); await writeFile(join(fixture.workspace, "assets/source.png"), "Source bytes; image probing is mocked");
    const evidence = { text: "The product offers an editor.", assets: [{ id: "source", kind: "image" as const, path: "assets/source.png", usage: "output" as const, rights: "Synthetic fixture", width: 1000, height: 600 }] };
    await assert.rejects(researchProduct(input, evidence, fixture.providers, fixture.hooks, fixture.workspace), /Response checkpoint lost/);
    assert.equal(JSON.parse(await readFile(join(fixture.workspace, "analysis/research-state.json"), "utf8")).status, "reserved");
    await assert.rejects(readFile(join(fixture.workspace, RESEARCH_RETRY_PATH)), { code: "ENOENT" });
    const restored = new Providers(fixture.workspace, input, fixture.hooks); restored.ledger = JSON.parse(await readFile(join(fixture.workspace, "ledger.json"), "utf8"));
    await assert.rejects(researchProduct(input, evidence, restored, fixture.hooks, fixture.workspace), error => error instanceof PipelineError && error.code === "production_stage_changed");
    assert.equal(fixture.bodies.length, 1); assert.equal(restored.ledger.outputTokens, 3500); assert.equal(restored.ledger.reservedOutputTokens, 0);
  }
});

test("an empty response exceeding its reserved output remains budget-exceeded and cannot become a correction receipt", async t => {
  const fixture = await setup(t, [{ content: privateBlocks, output: 3501 }]), error = await captured(researchCall(fixture.providers));
  assert.ok(error instanceof PipelineError && error.code === "model_usage_exceeded"); assert.equal(error instanceof ModelJsonResponseError, false);
  const audit = JSON.parse(await readFile(join(fixture.workspace, "analysis/model-1-research-budget.json"), "utf8")); assert.equal(audit.status, "budget-exceeded"); assert.deepEqual(audit.violations, ["output-reservation-exceeded"]); assert.equal(audit.responseTextBytes, 0);
  assert.equal(fixture.providers.ledger.outputTokens, 3501); assert.equal(await confirmedResearchJsonFailure(error, fixture.workspace, "research-v2"), undefined);
  await assert.rejects(researchCall(fixture.providers), error => error instanceof PipelineError && error.code === "model_usage_exceeded"); assert.equal(fixture.bodies.length, 1);
});
