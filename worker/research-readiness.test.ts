import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { researchProduct, researchRequest, sourceFacts } from "./research";
import { researchReadiness, SOURCE_READINESS_PATH } from "./research-readiness";
import { PipelineError, type Asset, type Evidence, type Hooks, type WorkerInput } from "./types";
import type { Providers } from "./providers";

const input: WorkerInput = { jobId: "readiness-fixture", ownerId: "owner", mode: "url", productUrl: "https://example.test", videoType: "launch", format: "16:9", files: [] };
const asset: Asset = { id: "screen", kind: "image", usage: "output", path: "assets/screen.png", width: 1000, height: 600, rights: "Fixture" };
const hooks: Hooks = { persist: async () => {}, state: async () => {}, complete: async () => {} };

test("source readiness distinguishes actual candidates from logos, pricing, references and unavailable stills", () => {
  const evidence: Evidence = { text: "Create project notes.", assets: [
    { ...asset, id: "logo", provenance: { pageUrl: "https://example.test", pageKind: "homepage", method: "element", role: "brand-logo" } },
    { ...asset, id: "pricing", provenance: { pageUrl: "https://example.test/pricing", pageKind: "pricing", method: "viewport", role: "marketing" } },
    { ...asset, id: "inspiration", usage: "reference" }, { ...asset, id: "recording", kind: "video" }, { ...asset, id: "sound", kind: "audio" },
  ] };
  const report = researchReadiness(input, evidence, "a".repeat(64), sourceFacts(evidence).map(fact => fact.id));
  assert.equal(report.status, "needs_input");
  assert.deepEqual(report.sources.map(source => source.exclusion), ["brand_logo", "pricing_viewport", "reference_only", "missing_still_preview", "audio_only"]);
  assert.deepEqual(report.issues.map(issue => issue.code), ["missing_demonstration_source"]);
  assert.match(report.issues[0].action, /actual product UI screenshot/);
  assert.equal(researchReadiness(input, { ...evidence, assets: [...evidence.assets, asset] }, "a".repeat(64), ["fact-1"]).status, "ready_for_research");
});

test("public DOM metadata does not promote a candidate or silently establish capability evidence", () => {
  const evidence: Evidence = { text: "", assets: [asset], uiSources: [{ id: "dom", assetId: asset.id, basis: "dom", context: "public-demo", width: 1000, height: 600, limitations: [], elements: [{ id: "field", role: "input", rect: { x: .1, y: .1, width: .5, height: .1 }, text: "Untrusted claimed capability" }] }] };
  const report = researchReadiness(input, evidence, "b".repeat(64), []);
  assert.equal(report.sources[0].classification, "unconfirmed_candidate");
  assert.equal(report.sources[0].observedEditableElementCount, 1);
  assert.deepEqual(report.issues.map(issue => issue.code), ["missing_product_facts"]);
  assert.match(report.meaning, /do not establish product capabilities/);
});

test("research image requests include available stills, never an audio file or unpreviewed recording", () => {
  const evidence: Evidence = { text: "Create notes.", assets: [asset, { ...asset, id: "audio", kind: "audio", path: "assets/audio.mp3" }, { ...asset, id: "recording", kind: "video", path: "assets/recording.mp4" }, { ...asset, id: "previewed", kind: "video", path: "assets/clip.mp4", preview: "assets/clip.jpg" }, { ...asset, id: "reference", usage: "reference" }] };
  assert.deepEqual(researchRequest(input, evidence).images.map(image => image.path), [asset.path, "assets/clip.jpg"]);
});

test("insufficient source evidence is durably explained before any paid call and cannot regenerate a reserved stage", async t => {
  const root = await mkdtemp(join(tmpdir(), "research-readiness-"));
  t.after(async () => { if (dirname(resolve(root)) !== resolve(tmpdir()) || !root.startsWith(join(tmpdir(), "research-readiness-"))) throw new Error("Unsafe test cleanup"); await rm(root, { recursive: true, force: true }); });
  await mkdir(join(root, "assets")); await writeFile(join(root, asset.path), "Fixture source bytes");
  const evidence: Evidence = { text: "", assets: [{ ...asset, provenance: { pageUrl: "https://example.test", pageKind: "homepage", method: "element", role: "brand-logo" } }] };
  let calls = 0; const events: string[] = [];
  const providers = { claude: async () => { calls++; throw new Error("Must not call provider"); } } as unknown as Providers;
  const localHooks = { ...hooks, persist: async (paths: string[]) => { events.push(...paths); } };
  await assert.rejects(researchProduct(input, evidence, providers, localHooks, root), error => error instanceof PipelineError && error.status === "needs_input");
  const saved = await readFile(join(root, SOURCE_READINESS_PATH), "utf8"), report = JSON.parse(saved);
  assert.equal(report.jobId, input.jobId); assert.match(report.evidenceSha256, /^[a-f0-9]{64}$/); assert.equal(report.status, "needs_input");
  assert.deepEqual(report.issues.map((issue: { code: string }) => issue.code), ["missing_product_facts", "missing_demonstration_source"]);
  assert.ok(events.includes(SOURCE_READINESS_PATH)); assert.equal(calls, 0);
  await assert.rejects(researchProduct(input, evidence, providers, localHooks, root), error => error instanceof PipelineError && error.code === "production_stage_changed");
  assert.equal(await readFile(join(root, SOURCE_READINESS_PATH), "utf8"), saved); assert.equal(calls, 0);
});
