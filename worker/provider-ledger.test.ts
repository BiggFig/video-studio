import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseProviderLedger } from "./provider-ledger";
import { Providers } from "./providers";
import { PipelineError, type Hooks, type Ledger, type WorkerInput } from "./types";

const key = "a".repeat(64), hash = "b".repeat(64);
const initial = (): Ledger => ({ modelCalls: 0, inputTokens: 0, outputTokens: 0, reservedInputTokens: 0, reservedOutputTokens: 0, audioGenerations: 0, asrSeconds: 0, providerRequests: [], audio: {} });
const completed = (): Ledger => ({ ...initial(), modelCalls: 1, inputTokens: 1000, outputTokens: 50, audioGenerations: 1, asrSeconds: 30.333333, providerRequests: [
  { provider: "anthropic", operation: "review", requestId: "req-fixture", units: 1050, unit: "tokens", model: "fixture-model" },
  { provider: "elevenlabs", operation: "music", requestId: null, units: 30.3333333333, unit: "seconds", songId: null },
], audio: { [key]: { status: "completed", path: `assets/music-${key.slice(0, 16)}.mp3`, hash } } });
const input: WorkerInput = { jobId: "ledger-test", ownerId: "unit", mode: "url", videoType: "launch", format: "auto", files: [] };
const hooks: Hooks = { persist: async () => { throw new Error("Ledger restore must not write checkpoints"); }, state: async () => {}, complete: async () => {} };
const unreadable = (error: unknown) => error instanceof PipelineError && error.code === "model_ledger_unreadable" && error.status === "needs_review";

function offline(t: TestContext) {
  for (const name of ["ANTHROPIC_API_KEY", "ELEVENLABS_API_KEY"]) {
    const previous = process.env[name]; process.env[name] = "test-only-no-provider-calls";
    t.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous; });
  }
  return t.mock.method(globalThis, "fetch", async () => { throw new Error("Provider calls are forbidden in ledger restore tests"); });
}

test("complete persisted ledgers retain exact accounting, fractional audio seconds, and reservations", () => {
  const ledger = completed();
  assert.deepEqual(parseProviderLedger(ledger), ledger);
  const pending = { ...initial(), modelCalls: 2, reservedInputTokens: 2048, reservedOutputTokens: 7000, audioGenerations: 1, audio: { [key]: { status: "reserved", path: `assets/sfx-${key.slice(0, 16)}.mp3`, hash: "" } } };
  assert.deepEqual(parseProviderLedger(pending), pending);
  assert.deepEqual(parseProviderLedger(initial()), initial());
});

test("all persisted counters are required nonnegative safe integers without coercion or defaults", () => {
  for (const root of [null, [], "ledger", {}, { inputTokens: null }, { ...initial(), extra: true }]) assert.throws(() => parseProviderLedger(root));
  for (const field of ["modelCalls", "inputTokens", "outputTokens", "reservedInputTokens", "reservedOutputTokens", "audioGenerations"]) {
    const missing = { ...initial() } as Record<string, unknown>; delete missing[field];
    assert.throws(() => parseProviderLedger(missing), `missing ${field}`);
    for (const value of [null, undefined, "0", -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => parseProviderLedger({ ...initial(), [field]: value }), `${field}: ${String(value)}`);
  }
  for (const field of ["asrSeconds", "providerRequests", "audio"]) {
    const missing = { ...initial() } as Record<string, unknown>; delete missing[field]; assert.throws(() => parseProviderLedger(missing));
  }
  for (const value of [null, "0", -0.1, NaN, Infinity]) assert.throws(() => parseProviderLedger({ ...initial(), asrSeconds: value }));
});

test("receipts require supported units, finite usage, and valid identity fields", () => {
  const receipt = completed().providerRequests[0];
  for (const invalid of [null, {}, { ...receipt, provider: "unknown" }, { ...receipt, units: -1 }, { ...receipt, units: 1.5 }, { ...receipt, units: Infinity }, { ...receipt, unit: "seconds" }, { ...receipt, model: undefined }, { ...receipt, requestId: undefined }, { ...receipt, requestId: 42 }, { ...receipt, operation: "" }, { ...receipt, songId: false }, { ...receipt, provider: "elevenlabs" }]) {
    assert.throws(() => parseProviderLedger({ ...initial(), providerRequests: [invalid] }));
  }
  for (const value of [null, {}, "receipts"]) assert.throws(() => parseProviderLedger({ ...initial(), providerRequests: value }));
  assert.doesNotThrow(() => parseProviderLedger({ ...initial(), providerRequests: [{ ...receipt, provider: "vercel-ai-gateway", operation: "token_budget_exceeded", units: 0 }] }));
});

test("audio records reject invalid statuses, incomplete hashes, and unsafe or mismatched paths", () => {
  const record = completed().audio[key];
  for (const invalid of [null, {}, { ...record, status: "pending" }, { ...record, hash: "" }, { ...record, hash: "not-a-digest" }, { ...record, status: "reserved" }, { ...record, path: "../music.mp3" }, { ...record, path: "C:/music.mp3" }, { ...record, path: "assets/music-cccccccccccccccc.mp3" }]) {
    assert.throws(() => parseProviderLedger({ ...initial(), audio: { [key]: invalid } }));
  }
  for (const value of [null, [], { invalidKey: record }]) assert.throws(() => parseProviderLedger({ ...initial(), audio: value }));
});

test("Providers.init restores complete ledgers unchanged and keeps ENOENT as a fresh start", async (t) => {
  const network = offline(t), path = await mkdtemp(join(tmpdir(), "video-studio-ledger-restore-"));
  const fresh = new Providers(path, input, hooks); await fresh.init(resolve("skills/video-studio"));
  assert.deepEqual(fresh.ledger, initial());
  const saved = JSON.stringify(completed()); await writeFile(join(path, "ledger.json"), saved);
  const restored = new Providers(path, input, hooks); await restored.init(resolve("skills/video-studio"));
  assert.deepEqual(restored.ledger, completed());
  assert.equal(await readFile(join(path, "ledger.json"), "utf8"), saved);
  assert.equal(network.mock.callCount(), 0);
});

test("structured corruption blocks initialization and further adapter calls without resetting allowance", async (t) => {
  const network = offline(t), path = await mkdtemp(join(tmpdir(), "video-studio-ledger-corrupt-"));
  const invalidLedgers = [null, {}, { ...completed(), inputTokens: null }, { ...completed(), reservedInputTokens: -2048 }, { ...completed(), providerRequests: [null] }, { ...completed(), audio: { [key]: { status: "completed", path: "../outside.mp3", hash } } }];
  for (const invalid of invalidLedgers) {
    const saved = JSON.stringify(invalid); await writeFile(join(path, "ledger.json"), saved);
    const providers = new Providers(path, input, hooks), original = providers.ledger;
    await assert.rejects(providers.init(resolve("skills/video-studio")), unreadable);
    assert.equal(providers.ledger, original, "Never assign a malformed ledger");
    await assert.rejects(providers.claude("plan", "must not call"), unreadable);
    await assert.rejects(providers.audio("music", "must not call", 30), unreadable);
    await assert.rejects(providers.transcribe("unused.mp3", 30), unreadable);
    assert.equal(await readFile(join(path, "ledger.json"), "utf8"), saved);
  }
  assert.equal(network.mock.callCount(), 0);
});
