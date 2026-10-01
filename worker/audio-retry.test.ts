import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { audioFailure, classifyAudioFailure, MAX_AUDIO_ATTEMPTS, nextAudioAttemptAt, retryAfterMs } from "./audio-retry";
import { parseProviderLedger } from "./provider-ledger";
import { Providers, type AudioRuntime } from "./providers";
import { PipelineError, type Hooks, type WorkerInput } from "./types";

const input: WorkerInput = { jobId: "audio-retry-test", ownerId: "unit", mode: "url", videoType: "launch", format: "auto", files: [], budgets: { maxAudioGenerations: 2, maxWallSeconds: 1800 } };
const issue = (code: string) => (error: unknown) => error instanceof PipelineError && error.code === code && error.status === "needs_review";
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const key = (kind = "music", prompt = "calm", duration = 20) => digest(JSON.stringify({ kind, prompt, duration, version: 1 }));
const response = (code = "system_busy", status = 429, headers: Record<string, string> = {}) => new Response(JSON.stringify({ detail: { code, type: status === 429 ? "rate_limit_error" : status === 402 ? "payment_required" : "authorization_error", request_id: "fixture-body-id", message: "DO-NOT-RETAIN-private-prompt-or-secret" } }), { status, headers });
const mockFetch = (t: TestContext, implementation: (url: string, options: RequestInit) => Promise<Response>) => t.mock.method(globalThis, "fetch", (url: RequestInfo | URL, options?: RequestInit) => implementation(String(url), options || {}));
const hooks = (persist: Hooks["persist"] = async () => {}): Hooks => ({ persist, state: async () => {}, complete: async () => {} });
function clock() {
  let now = Date.UTC(2026, 9, 1, 12); const sleeps: number[] = [];
  const runtime: AudioRuntime = {
    now: () => now, random: () => 0, sleep: async ms => { sleeps.push(ms); now += ms; },
    // Unit fixtures exercise accounting, not media quality or real provider generation.
    probe: async () => ({ raw: {}, audio: { codec_type: "audio" }, video: undefined, width: 0, height: 0, duration: 20 }),
    measurements: async () => ({ loudness: { input_i: "-14" }, silence: [] }),
  };
  return { runtime, sleeps, advance: (ms: number) => { now += ms; } };
}
async function workspace(t: TestContext) {
  const root = await realpath(tmpdir()), path = await mkdtemp(join(root, "video-studio-audio-retry-"));
  await mkdir(join(path, "assets"));
  t.after(async () => { const target = await realpath(path); if (resolve(target) !== resolve(path) || dirname(target) !== root || !basename(target).startsWith("video-studio-audio-retry-")) throw new Error("Test cleanup escaped its registered directory"); await rm(target, { recursive: true, force: true }); });
  return path;
}
function environment(t: TestContext) {
  for (const name of ["ANTHROPIC_API_KEY", "ELEVENLABS_API_KEY"]) {
    const previous = process.env[name]; process.env[name] = "test-only-no-network";
    t.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous; });
  }
}

test("Retry-After accepts seconds/HTTP dates and never treats invalid text as immediate retry", () => {
  const now = Date.UTC(2026, 9, 1, 12);
  assert.equal(retryAfterMs("12", now), 12_000); assert.equal(retryAfterMs("0", now), 0);
  assert.equal(retryAfterMs(new Date(now + 45_000).toUTCString(), now), 45_000);
  assert.equal(retryAfterMs(new Date(now - 10_000).toUTCString(), now), 0);
  assert.equal(retryAfterMs("99999999999999999999", now), Number.MAX_SAFE_INTEGER - now);
  for (const value of [null, "", "-1", "1.5", "Infinity", "October 1 2026", "secret".repeat(50)]) assert.equal(retryAfterMs(value, now), null);
});

test("only documented confirmed 429 codes qualify; quota/access take precedence", () => {
  for (const code of ["system_busy", "rate_limit_exceeded", "concurrent_limit_exceeded", "too_many_concurrent_requests"]) {
    assert.equal(classifyAudioFailure(429, code, "rate_limit_error"), "rate_limit");
    assert.equal(classifyAudioFailure(429, code, null), "rate_limit");
    assert.equal(classifyAudioFailure(500, code, "rate_limit_error"), "unknown");
    assert.equal(classifyAudioFailure(429, code, "unknown_type"), "unknown");
  }
  assert.equal(classifyAudioFailure(429, "quota_exceeded", null), "quota");
  assert.equal(classifyAudioFailure(402, null, null), "quota");
  assert.equal(classifyAudioFailure(403, "system_busy", "rate_limit_error"), "access");
  assert.equal(classifyAudioFailure(429, "model_access_denied", null), "access");
  assert.equal(classifyAudioFailure(429, null, null), "unknown");
});

test("bounded error parsing retains only safe identifiers and modern code takes precedence", async () => {
  const rejected = await audioFailure(response("system_busy", 429, { "request-id": "fixture-header-id", "retry-after": "12" }), 1, 1000);
  assert.deepEqual(rejected, { attempt: 1, httpStatus: 429, code: "system_busy", type: "rate_limit_error", requestId: "fixture-header-id", classification: "rate_limit", receivedAt: 1000, retryAfterMs: 12000 });
  assert.equal(nextAudioAttemptAt(rejected, 0), 13000);
  assert.ok(!JSON.stringify(rejected).includes("DO-NOT-RETAIN"));
  const legacy = await audioFailure(new Response(JSON.stringify({ detail: { status: "too_many_concurrent_requests" } }), { status: 429 }), 1, 1000);
  assert.equal(legacy.classification, "rate_limit");
  for (const body of ["{broken", "x".repeat(17000), JSON.stringify({ detail: { code: "unknown", status: "system_busy" } }), JSON.stringify({ detail: { code: "system_busy", type: 7 } }), JSON.stringify({ detail: { code: "private source text\n", request_id: "unsafe\nsecret" } })]) {
    const failure = await audioFailure(new Response(body, { status: 429 }), 1, 1000); assert.equal(failure.classification, "unknown");
    assert.ok(!JSON.stringify(failure).includes("private source"));
  }
  const broken = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error("private transport detail")); } });
  assert.equal((await audioFailure(new Response(broken, { status: 429 }), 1, 1000)).classification, "unknown");
});

test("two confirmed rejections then success use one logical slot and reuse completed bytes", async t => {
  environment(t); const path = await workspace(t), time = clock(), events: string[] = [], bodies: string[] = []; let calls = 0;
  const providers = new Providers(path, input, hooks(async paths => { events.push(paths[0]); if (paths[0] === "ledger.json") parseProviderLedger(JSON.parse(await readFile(join(path, "ledger.json"), "utf8"))); }), time.runtime);
  mockFetch(t, async (url, options) => {
    calls++; bodies.push(String(options.body)); assert.match(url, /\/music\?/); assert.equal(options.redirect, "error"); assert.ok(options.signal instanceof AbortSignal);
    const durable = JSON.parse(await readFile(join(path, "ledger.json"), "utf8")); assert.equal(durable.audio[key()].status, "reserved"); assert.equal(durable.audio[key()].attempts, calls); assert.equal(durable.audioGenerations, 1);
    return calls < 3 ? response("system_busy", 429, { "retry-after": calls === 1 ? "12" : "0" }) : new Response(Buffer.alloc(2048, 7), { headers: { "song-id": "song-fixture", "request-id": "request-fixture" } });
  });
  const result = await providers.audio("music", "calm", 20);
  assert.equal(await providers.audio("music", "calm", 20), result); assert.equal(calls, 3); assert.equal(new Set(bodies).size, 1);
  assert.deepEqual(time.sleeps, [12000, 10000]); assert.equal(providers.ledger.audioGenerations, 1);
  assert.equal(providers.ledger.audio[key()].attempts, 3); assert.equal(providers.ledger.audio[key()].failures?.length, 2);
  assert.equal(providers.ledger.providerRequests.length, 1); assert.equal(providers.ledger.providerRequests[0].units, 20);
  assert.ok(events.indexOf(result) < events.lastIndexOf("ledger.json"));
  const saved = await readFile(join(path, "ledger.json"), "utf8"); assert.ok(!saved.includes("DO-NOT-RETAIN")); assert.ok(!saved.includes("test-only-no-network"));
});

test("three rejections exhaust a durable attempt cap without consuming another generation slot", async t => {
  environment(t); const path = await workspace(t), time = clock(); let calls = 0;
  const providers = new Providers(path, input, hooks(), time.runtime);
  mockFetch(t, async () => { calls++; return response(); });
  await assert.rejects(providers.audio("music", "calm", 20), issue("audio_rate_limited"));
  const restored = new Providers(path, input, hooks(), time.runtime); await restored.init(resolve("skills/video-studio"));
  await assert.rejects(restored.audio("music", "calm", 20), issue("audio_rate_limited"));
  assert.equal(calls, MAX_AUDIO_ATTEMPTS); assert.equal(restored.ledger.audioGenerations, 1); assert.deepEqual(time.sleeps, [5000, 10000]);
});

test("restart from confirmed retry state honors the saved wake time and exact request hash", async t => {
  environment(t); const path = await workspace(t), time = clock(); let calls = 0, durable = "";
  const providers = new Providers(path, input, hooks(async () => { durable = await readFile(join(path, "ledger.json"), "utf8"); }), { ...time.runtime, sleep: async () => { throw new Error("worker stopped during wait"); } });
  mockFetch(t, async () => { calls++; return calls === 1 ? response("system_busy", 429, { "retry-after": "25" }) : new Response(Buffer.alloc(2048, 8)); });
  await assert.rejects(providers.audio("music", "calm", 20), /worker stopped during wait/);
  assert.equal(JSON.parse(durable).audio[key()].status, "retry_wait"); time.advance(10000);
  const restored = new Providers(path, input, hooks(), time.runtime); await restored.init(resolve("skills/video-studio"));
  await restored.audio("music", "calm", 20); assert.equal(calls, 2); assert.deepEqual(time.sleeps, [15000]); assert.equal(restored.ledger.audioGenerations, 1);
  await writeFile(join(path, "ledger.json"), durable);
  const changed = new Providers(path, input, hooks(), time.runtime); await changed.init(resolve("skills/video-studio")); changed.ledger.audio[key()].requestHash = "f".repeat(64);
  await assert.rejects(changed.audio("music", "calm", 20), issue("audio_request_changed")); assert.equal(calls, 2);
});

test("Retry-After beyond the absolute deadline stops without an early retry or new allowance", async t => {
  const path = await workspace(t), time = clock(); let calls = 0;
  const providers = new Providers(path, { ...input, deadlineAt: new Date(time.runtime.now() + 20000).toISOString() }, hooks(), time.runtime);
  mockFetch(t, async () => { calls++; return response("system_busy", 429, { "retry-after": "21" }); });
  await assert.rejects(providers.audio("music", "calm", 20), issue("audio_rate_limited")); assert.equal(calls, 1); assert.deepEqual(time.sleeps, []);
  assert.equal(providers.ledger.audioGenerations, 1); assert.equal(providers.ledger.audio[key()].status, "retry_wait");
});

test("a deadline reached during pre-request persistence prevents the POST", async t => {
  const path = await workspace(t), time = clock(), providers = new Providers(path, { ...input, budgets: { ...input.budgets, maxWallSeconds: 1 } }, hooks(async () => { time.advance(1000); }), time.runtime);
  const network = mockFetch(t, async () => { throw new Error("POST must not start after deadline"); });
  await assert.rejects(providers.audio("music", "calm", 20), issue("time_budget")); assert.equal(network.mock.callCount(), 0);
});

test("quota/access failures persist actionable terminal outcomes and never retry", async t => {
  environment(t);
  for (const [status, code, expected] of [[402, "insufficient_credits", "audio_quota_exceeded"], [403, "model_access_denied", "audio_access_denied"], [429, "quota_exceeded", "audio_quota_exceeded"]] as const) {
    const path = await workspace(t), time = clock(), providers = new Providers(path, input, hooks(), time.runtime);
    const network = mockFetch(t, async () => response(code, status));
    await assert.rejects(providers.audio("music", "calm", 20), issue(expected));
    const restored = new Providers(path, input, hooks(), time.runtime); await restored.init(resolve("skills/video-studio"));
    await assert.rejects(restored.audio("music", "calm", 20), issue(expected)); assert.equal(network.mock.callCount(), 1); assert.deepEqual(time.sleeps, []); network.mock.restore();
  }
});

test("ambiguous transport, 5xx, malformed 429 and incomplete success retain unresolved reservations", async t => {
  environment(t);
  for (const make of [() => { throw new Error("private network exception"); }, () => response("system_busy", 503), () => new Response("{broken", { status: 429 }), () => new Response(new Uint8Array(1)), () => new Response(new ReadableStream({ start(controller) { controller.error(new Error("lost body")); } }))]) {
    const path = await workspace(t), time = clock(), providers = new Providers(path, input, hooks(), time.runtime);
    const network = mockFetch(t, async () => make());
    await assert.rejects(providers.audio("music", "calm", 20), issue("audio_payment_uncertain"));
    const restored = new Providers(path, input, hooks(), time.runtime); await restored.init(resolve("skills/video-studio"));
    await assert.rejects(restored.audio("music", "calm", 20), issue("audio_payment_uncertain")); assert.equal(network.mock.callCount(), 1); assert.deepEqual(time.sleeps, []); network.mock.restore();
  }
});

test("failed preflight checkpoint prevents every provider POST", async t => {
  const path = await workspace(t), time = clock(), providers = new Providers(path, input, hooks(async () => { throw new Error("checkpoint failed"); }), time.runtime);
  const network = mockFetch(t, async () => { throw new Error("No provider call authorized"); });
  await assert.rejects(providers.audio("music", "calm", 20), /checkpoint failed/);
  await assert.rejects(providers.audio("music", "calm", 20), issue("audio_payment_uncertain")); assert.equal(network.mock.callCount(), 0);
});

test("failed rejection checkpoint prevents retry both in memory and from last durable reservation", async t => {
  environment(t); const path = await workspace(t), time = clock(); let durable = "", saves = 0;
  const providers = new Providers(path, input, hooks(async () => { if (++saves === 2) throw new Error("rejection checkpoint failed"); durable = await readFile(join(path, "ledger.json"), "utf8"); }), time.runtime);
  const network = mockFetch(t, async () => response());
  await assert.rejects(providers.audio("music", "calm", 20), /rejection checkpoint failed/);
  await assert.rejects(providers.audio("music", "calm", 20), issue("audio_payment_uncertain"));
  await writeFile(join(path, "ledger.json"), durable); const restored = new Providers(path, input, hooks(), time.runtime); await restored.init(resolve("skills/video-studio"));
  await assert.rejects(restored.audio("music", "calm", 20), issue("audio_payment_uncertain")); assert.equal(network.mock.callCount(), 1);
});

test("legacy reserved entries stay blocked and legacy completed entries remain reusable", async t => {
  const path = await workspace(t), time = clock(), providers = new Providers(path, input, hooks(), time.runtime), relative = `assets/music-${key().slice(0, 16)}.mp3`;
  const network = mockFetch(t, async () => { throw new Error("Legacy resume must not regenerate"); });
  providers.ledger.audioGenerations = 1; providers.ledger.audio[key()] = { status: "reserved", path: relative, hash: "" };
  providers.ledger = parseProviderLedger(providers.ledger); await assert.rejects(providers.audio("music", "calm", 20), issue("audio_payment_uncertain"));
  const bytes = Buffer.alloc(2048, 9); await writeFile(join(path, relative), bytes);
  providers.ledger.audio[key()] = { status: "completed", path: relative, hash: digest(bytes) }; providers.ledger = parseProviderLedger(providers.ledger);
  assert.equal(await providers.audio("music", "calm", 20), relative); assert.equal(network.mock.callCount(), 0); assert.equal(providers.ledger.audioGenerations, 1);
});

test("audio allowance still caps distinct logical assets even after rate-limit retries", async t => {
  const path = await workspace(t), time = clock(), providers = new Providers(path, input, hooks(), time.runtime); providers.ledger.audioGenerations = 2;
  const network = mockFetch(t, async () => { throw new Error("No remaining audio generation slot"); });
  await assert.rejects(providers.audio("music", "new asset", 20), issue("audio_budget")); assert.equal(network.mock.callCount(), 0);
});
