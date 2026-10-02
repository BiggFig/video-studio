import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { compileResearch, researchProduct, sourceFacts, stageDigest, validateResearch, type Research } from "./research";
import { compileScript, loadCompletedProductionStages, validateScript, writeScript, type Script } from "./scripting";
import { compilePlan, prepareRetainedPlanRepair } from "./planning";
import { Providers } from "./providers";
import { RepairBudget } from "./repairs";
import { PipelineError, type Evidence, type Hooks, type WorkerInput } from "./types";

const input: WorkerInput = { jobId: "research-test", ownerId: "private-owner", mode: "url", productUrl: "https://example.com", videoType: "launch", format: "16:9", files: [] };
const evidence: Evidence = { text: "Orbit organizes your notes.\n\nShare documents with your team.\n\nThe free plan is available today.", assets: [{ id: "screen", path: "assets/screen.jpg", preview: "assets/screen.jpg", kind: "image", usage: "output", rights: "Supplied fixture", width: 1440, height: 960 }] };
const hooks: Hooks = { persist: async () => {}, state: async () => {}, complete: async () => {} };
const draft = () => ({ sufficientEvidence: true, reason: "Actual facts and product visual", product: "Orbit", summary: "Grounded notes software", story: {primaryAudience:{text:"teams",basis:"inferred",evidenceIds:["fact-2"]},problem:null,mechanism:{text:"Organize notes",basis:"explicit",evidenceIds:["fact-1"],steps:[{action:"Organize notes",evidenceId:"fact-1",assetId:"screen"}]},outcome:{text:"Share documents with your team",basis:"explicit",evidenceIds:["fact-2"]},differentiator:null,cta:{text:"Share documents",basis:"explicit",evidenceIds:["fact-2"]}}, facts: [{ evidenceId: "fact-1", kind: "feature", label: "Organize notes" }, { evidenceId: "fact-2", kind: "benefit", label: "Share with a team" }, { evidenceId: "fact-3", kind: "pricing", label: "Free plan" }], visuals: [{ assetId: "screen", description: "Actual notes workspace", supportsFactIds: ["fact-1", "fact-2"], showsProductUi: true,role:"product_ui" }], limitations: ["Only the supplied visible product workflow is verified."] });
const scriptDraft = () => ({ sufficientEvidence: true, reason: "Supported", product: "Orbit", summary: "A grounded film", accent: "#4477cc", background: "light", musicPrompt: "Subtle instrumental texture, no vocals", sfxPrompt: "Soft interface reveal", assumptions: [], scenes: [
  { storyRole:"mechanism",assetId: "screen", headline: "For teams: Organize notes", detail: "", evidenceId: "fact-1", durationSeconds: 4, sourceInSeconds: 0, preserveAudio: false, purpose: "Actual proof", referenceTechnique: "Contained product reveal", presentation: { template: "proof", theme: "light", transition: "cut" } },
  { storyRole:"outcome",assetId: "screen", headline: "Work together", detail: "", evidenceId: "fact-2", durationSeconds: 5, sourceInSeconds: 0, preserveAudio: false, purpose: "Verified benefits", referenceTechnique: "Informational cards", presentation: { template: "features", theme: "light", transition: "cut", cards: [{ title: "Share documents", body: "With your team", evidenceId: "fact-2" }] } },
  { storyRole:"cta",assetId:"screen",headline:"Share documents",detail:"",evidenceId:"fact-2",durationSeconds:4,sourceInSeconds:0,preserveAudio:false,purpose:"One supported next step",referenceTechnique:"Held brand",presentation:{template:"cta",theme:"dark",transition:"cut"}},
] });
async function workspace() { const path = await mkdtemp(join(tmpdir(), "video-studio-research-")); await mkdir(join(path, "assets")); await writeFile(join(path, "assets/screen.jpg"), "Exact source bytes; provider mocked"); return path; }
const isStageFailure = (error: unknown) => error instanceof PipelineError && error.code === "production_stage_changed";
const invalidResearchProvider = (raw: unknown) => ({
  ledger: { modelCalls: 1, inputTokens: 1000, outputTokens: 1000, reservedInputTokens: 0, reservedOutputTokens: 0 },
  claude: async () => raw, prepareClaude: async () => async () => raw,
}) as unknown as Providers;

test("research binds exact source quotes and bytes and reuses only its confirmed durable stage", async () => {
  const root = await workspace(); let calls = 0; const events: string[] = [];
  const provider = { claude: async (purpose: string, _prompt: string, _images: unknown, options: unknown) => { assert.equal(purpose, "research"); assert.deepEqual(options, { policy: "research-v1" }); calls++; return draft(); } } as unknown as Providers;
  const localHooks = { ...hooks, persist: async (paths: string[]) => { events.push(...paths); } };
  const result = await researchProduct(input, evidence, provider, localHooks, root);
  assert.equal(result.facts[1].quote, "Share documents with your team.");
  assert.ok(events.indexOf("analysis/research-state.json") < events.indexOf("analysis/research.json"));
  assert.deepEqual(await researchProduct(input, evidence, provider, localHooks, root), result); assert.equal(calls, 1);
  await writeFile(join(root, "assets/screen.jpg"), "Replaced image under same filename");
  await assert.rejects(researchProduct(input, evidence, provider, localHooks, root), isStageFailure); assert.equal(calls, 1);
});

test("verbose research notes are bounded without changing raw evidence or durable fact and visual bindings", async () => {
  const root = await workspace(), raw = draft(); let calls = 0;
  raw.reason = "The verified source supports this scope. ".repeat(40);
  raw.summary = "Supported product description and relevant context. ".repeat(20);
  raw.facts = raw.facts.map(fact => ({ ...fact, label: `${fact.label}. Additional descriptive context. `.repeat(12) }));
  raw.visuals[0].description = "The actual captured workspace contains visible product evidence and source details. ".repeat(12);
  raw.limitations = ["Unverified authenticated workflows are not demonstrated by this public source. ".repeat(12)];
  const original = JSON.stringify(raw), rawPath = "analysis/model-1-research.json";
  const provider = { claude: async () => { calls++; await writeFile(join(root, rawPath), original); return raw; } } as unknown as Providers;
  const result = await researchProduct(input, evidence, provider, hooks, root);
  assert.equal(result.reason, raw.reason.slice(0, 1000)); assert.equal(result.summary, raw.summary.slice(0, 600));
  assert.deepEqual(result.facts.map(fact => ({ id: fact.evidenceId, kind: fact.kind, label: fact.label, quote: fact.quote })), raw.facts.map((fact, i) => ({ id: fact.evidenceId, kind: fact.kind, label: fact.label.slice(0, 140), quote: evidence.text.split("\n\n")[i] })));
  assert.deepEqual(result.visuals, raw.visuals.map(visual => ({ ...visual, description: visual.description.slice(0, 500) })));
  assert.deepEqual(result.limitations, raw.limitations.map(note => note.slice(0, 500)));
  assert.equal(result.product, raw.product); assert.equal(JSON.stringify(raw), original);
  assert.equal(await readFile(join(root, rawPath), "utf8"), original);
  assert.deepEqual(await researchProduct(input, evidence, provider, hooks, root), result); assert.equal(calls, 1);
  const invalid = structuredClone(raw); invalid.visuals[0].supportsFactIds.push("fact-999");
  const invalidRoot = await workspace();
  await assert.rejects(researchProduct(input, evidence, invalidResearchProvider(invalid), hooks, invalidRoot), isStageFailure);
  await assert.rejects(readFile(join(invalidRoot, "analysis/research.json")));
});

test("pure research compilation coalesces selected IDs, retains supplied categories and binds only canonical source quotes", () => {
  const base = draft(), digest = "b".repeat(64);
  const raw = { ...base, facts: [
    { ...base.facts[0], kinds: [], quote: "An invented model quote must never establish source truth." },
    { ...base.facts[0], kind: "benefit", label: "A second category for the same passage" },
    { ...base.facts[2], kind: "benefit", kinds: ["pricing"], quote: "A made-up discount" },
  ] };
  const original = JSON.stringify(raw), research = compileResearch(input, evidence, raw, digest, {legacy:true});
  assert.equal(JSON.stringify(raw), original); assert.deepEqual(research.facts.map(f => f.evidenceId), ["fact-1", "fact-3"]);
  assert.equal(research.facts[0].kind, "feature"); assert.deepEqual(research.facts[0].kinds, ["feature", "benefit"]);
  assert.equal(research.facts[1].kind, "benefit"); assert.deepEqual(research.facts[1].kinds, ["benefit", "pricing"]);
  assert.ok(research.facts.every(f => sourceFacts(evidence).find(source => source.id === f.evidenceId)?.text === f.quote));
  // A visual may refer to another real catalog passage without selecting it for the script.
  assert.deepEqual(research.visuals[0].supportsFactIds, ["fact-1", "fact-2"]);
  const script = { ...scriptDraft(), version: 1, jobId: input.jobId, researchSha256: stageDigest(research), evidenceSha256: digest } as Script;
  script.scenes=script.scenes.slice(0,2); // Explicit legacy pricing fixture.
  assert.throws(() => validateScript(script, input, evidence, research), /supported presentation, fact or source visual/);
  script.scenes[1] = { ...script.scenes[1], headline: "Free plan", evidenceId: "fact-3", presentation: { template: "offer", theme: "light", transition: "cut", cards: [{ title: "Free plan", body: "Available today", evidenceId: "fact-3" }] } };
  validateScript(script, input, evidence, research); // Supplied pricing category survives coalescence.
  assert.throws(() => compileResearch(input, evidence, { ...raw, facts: [...raw.facts, { ...base.facts[0], evidenceId: "fact-999" }] }, digest, {legacy:true}), /unknown source fact ID/);
  assert.throws(() => compileResearch(input, evidence, { ...raw, visuals: [{ ...base.visuals[0], supportsFactIds: ["fact-999"] }] }, digest, {legacy:true}), /unknown source fact binding/);
  const changed = structuredClone(research); changed.facts[0].quote = "Changed after compilation";
  assert.throws(() => validateResearch(changed, input, evidence, digest), /differs from its canonical source passage/);
});

test("a supplied pricing category never turns a non-price source quote into an offer", () => {
  const raw = draft();
  const research = compileResearch(input, evidence, { ...raw, facts: raw.facts.map(f => f.evidenceId === "fact-2" ? { ...f, kinds: ["benefit", "pricing"] } : f) }, "c".repeat(64), {legacy:true});
  const script = { ...scriptDraft(), version: 1, jobId: input.jobId, researchSha256: stageDigest(research), evidenceSha256: research.evidenceSha256 } as Script;
  script.scenes[1].presentation = { template: "offer", theme: "light", transition: "cut" };
  assert.throws(() => validateScript(script, input, evidence, research), /actual source pricing/);
  script.scenes[1].evidenceId = "fact-3";
  script.scenes[1].presentation.cards = [{ title: "A false deal", body: "", evidenceId: "fact-2" }];
  assert.throws(() => validateScript(script, input, evidence, research), /Every offer card/);
});

test("research rejects an unknown quote or reference-only asset instead of treating it as proof", async () => {
  for (const raw of [{ ...draft(), facts: [{ evidenceId: "fact-999", kind: "feature", label: "Invented" }] }, { ...draft(), visuals: [{ ...draft().visuals[0], assetId: "reference" }] }]) {
    const root = await workspace(), provider = invalidResearchProvider(raw);
    await assert.rejects(researchProduct(input, evidence, provider, hooks, root), isStageFailure);
    await assert.rejects(readFile(join(root, "analysis/research.json")));
  }
});

test("unconfirmed or corrupt stage state cannot replay paid research", async () => {
  const root = await workspace(); let calls = 0; let reserved = "";
  const provider = { claude: async () => { calls++; throw new Error("Provider response lost"); } } as unknown as Providers;
  const localHooks = { ...hooks, persist: async (paths: string[]) => { if (paths.includes("analysis/research-state.json")) reserved = await readFile(join(root, paths[0]), "utf8"); } };
  await assert.rejects(researchProduct(input, evidence, provider, localHooks, root), /response lost/);
  assert.equal(JSON.parse(reserved).status, "reserved");
  await assert.rejects(researchProduct(input, evidence, provider, localHooks, root), isStageFailure); assert.equal(calls, 1);
  await writeFile(join(root, "analysis/research-state.json"), "{broken");
  await assert.rejects(researchProduct(input, evidence, provider, localHooks, root), isStageFailure); assert.equal(calls, 1);
});

test("script is bound to verified research and cards retain exact evidence through plan compilation", async () => {
  const root = await workspace(); let calls = 0;
  const provider = { claude: async (purpose: string) => { calls++; return purpose === "research" ? draft() : scriptDraft(); } } as unknown as Providers;
  const research = await researchProduct(input, evidence, provider, hooks, root);
  const script = await writeScript(input, evidence, research, provider, hooks, root);
  assert.equal(script.researchSha256, stageDigest(research));
  const plan = await compilePlan(input, evidence, script, hooks, root);
  assert.equal(plan.scenes[1].presentation?.cards?.[0].evidence, "Share documents with your team.");
  assert.equal(plan.production?.scriptSha256, stageDigest(script));
  assert.ok(plan.scenes[1].duration_frames >= Math.ceil(((7 * 32 + 120) * 30) / 100) + 18);
  assert.deepEqual(await writeScript(input, evidence, research, provider, hooks, root), script); assert.equal(calls, 2);
  const changed = { ...research, summary: "Changed research without regenerating script" };
  await assert.rejects(writeScript(input, evidence, changed, provider, hooks, root), isStageFailure); assert.equal(calls, 2);
});

test("an insufficient-evidence script returns actionable needs_input before requiring successful scene fields", async () => {
  const root = await workspace();
  const provider = { claude: async (purpose: string) => purpose === "research" ? draft() : { sufficientEvidence: false, reason: "The supplied page has no visible product workflow." } } as unknown as Providers;
  const research = await researchProduct(input, evidence, provider, hooks, root);
  await assert.rejects(writeScript(input, evidence, research, provider, hooks, root), error => error instanceof PipelineError && error.code === "insufficient_product_evidence" && error.status === "needs_input" && error.message.includes("no visible product workflow"));
  await assert.rejects(readFile(join(root, "analysis/script.json")));
});

test("pure script compilation bounds descriptive notes while preserving every visible, timing, source and audio field", () => {
  const research = compileResearch(input, evidence, draft(), "d".repeat(64)), raw = { ...scriptDraft(), assumptions: ["Uncertainty and production notes. ".repeat(40)] };
  raw.summary = "Non-rendered script explanation. ".repeat(30);
  for (const scene of raw.scenes) { scene.purpose = "Narrative purpose. ".repeat(60); scene.referenceTechnique = "Supported motion description. ".repeat(40); }
  const original = JSON.stringify(raw), compiled = compileScript(raw, input, evidence, research);
  assert.equal(compiled.summary, raw.summary.slice(0, 500)); assert.deepEqual(compiled.assumptions, raw.assumptions.map(note => note.slice(0, 1000)));
  assert.deepEqual(compiled.scenes, raw.scenes.map(scene => ({ ...scene, purpose: scene.purpose.slice(0, 800), referenceTechnique: scene.referenceTechnique.slice(0, 800) })));
  assert.equal(compiled.product, raw.product); assert.equal(compiled.musicPrompt, raw.musicPrompt); assert.equal(compiled.sfxPrompt, raw.sfxPrompt);
  assert.equal(compiled.accent, raw.accent); assert.equal(compiled.background, raw.background);
  assert.equal(compiled.researchSha256, stageDigest(research)); assert.equal(compiled.evidenceSha256, research.evidenceSha256);
  assert.equal(JSON.stringify(raw), original); validateScript(compiled, input, evidence, research);
});

test("generated script contract violations stay strict and actionable after metadata normalization", () => {
  const research = compileResearch(input, evidence, draft(), "e".repeat(64));
  const invalid = [
    (raw: ReturnType<typeof scriptDraft>) => { raw.scenes[0].headline = "x".repeat(77); },
    (raw: ReturnType<typeof scriptDraft>) => { raw.scenes[0].detail = "x".repeat(151); },
    (raw: ReturnType<typeof scriptDraft>) => { raw.scenes[1].presentation.cards![0].title = "x".repeat(45); },
    (raw: ReturnType<typeof scriptDraft>) => { raw.scenes[1].presentation.cards![0].body = "x".repeat(101); },
    (raw: ReturnType<typeof scriptDraft>) => { raw.product = "x".repeat(49); },
    (raw: ReturnType<typeof scriptDraft>) => { raw.scenes[0].durationSeconds = 301; },
    (raw: ReturnType<typeof scriptDraft>) => { raw.musicPrompt = "x".repeat(1001); },
    (raw: ReturnType<typeof scriptDraft>) => { raw.sfxPrompt = "x".repeat(401); },
  ];
  for (const change of invalid) {
    const raw = scriptDraft(); raw.summary = "Long harmless note. ".repeat(40); change(raw); const original = JSON.stringify(raw);
    assert.throws(() => compileScript(raw, input, evidence, research), error => error instanceof PipelineError && error.code === "invalid_generated_script" && error.status === "needs_review" && error.action.includes("retained script response"));
    assert.equal(JSON.stringify(raw), original);
  }
  const unknown = scriptDraft(); unknown.scenes[0].evidenceId = "fact-999";
  assert.throws(() => compileScript(unknown, input, evidence, research), isStageFailure);
  const altered = structuredClone(research); altered.facts[0].quote = "A rewritten claim";
  assert.throws(() => compileScript(scriptDraft(), input, evidence, altered), /canonical source passage/);
});

test("retained raw repair is rebound to completed stages and persisted before its repaired plan is confirmed", async () => {
  const root = await workspace(); let calls = 0;
  const provider = { claude: async (purpose: string) => { calls++; return purpose === "research" ? draft() : scriptDraft(); } } as unknown as Providers;
  const research = await researchProduct(input, evidence, provider, hooks, root);
  const originalScript = await writeScript(input, evidence, research, provider, hooks, root);
  const plan = await compilePlan(input, evidence, originalScript, hooks, root);
  const originalPlanBytes = await readFile(join(root, "plan.json"), "utf8"), scriptBytes = await readFile(join(root, "analysis/script.json"), "utf8");
  const raw = scriptDraft(); raw.scenes[1].headline = "Share documents";
  const repair = { plan, findings: [{ severity: "major" as const, message: "Use the supported source wording.", repair: "simplify_copy" as const }] };
  const persisted: string[] = [], localHooks = { ...hooks, persist: async (paths: string[]) => { persisted.push(...paths); } };
  // The old local recovery path must fail without touching plan, storyboard or the journal.
  for (const unsafe of [raw, { ...originalScript, evidenceSha256: "f".repeat(64) }, { ...originalScript, jobId: "other-job" }]) await assert.rejects(compilePlan(input, evidence, unsafe, localHooks, root, repair), isStageFailure);
  assert.equal(await readFile(join(root, "plan.json"), "utf8"), originalPlanBytes); assert.equal(persisted.length, 0);
  const perform = await prepareRetainedPlanRepair(input, evidence, raw, localHooks, root, repair);
  assert.equal(await readFile(join(root, "plan.json"), "utf8"), originalPlanBytes); assert.equal(persisted.length, 0);
  await assert.rejects(readFile(join(root, "analysis/repair-ledger.json")));
  const budget = new RepairBudget(root, input, localHooks); await budget.init();
  const repaired = await budget.execute("Retained source-grounded response", perform);
  const savedScriptPath = persisted.find(path => path.startsWith("analysis/script-repair-retained-"))!;
  assert.ok(savedScriptPath); assert.ok(persisted.indexOf(savedScriptPath) < persisted.indexOf("plan.json"));
  assert.equal(persisted[0], "analysis/repair-ledger.json"); assert.equal(persisted.at(-1), "analysis/repair-ledger.json");
  const savedScript = JSON.parse(await readFile(join(root, savedScriptPath), "utf8"));
  assert.equal(repaired.production?.scriptSha256, stageDigest(savedScript));
  assert.equal(repaired.production?.researchSha256, stageDigest(research)); assert.equal(repaired.production?.evidenceSha256, research.evidenceSha256);
  assert.equal(repaired.scenes[1].headline, "Share documents"); assert.equal(await readFile(join(root, "analysis/script.json"), "utf8"), scriptBytes);
  assert.equal(calls, 2); // No repeated research, script generation, or other provider request.
  const resumed = new RepairBudget(root, input, hooks); await resumed.init(); assert.equal(resumed.consumed, 1);
  assert.deepEqual(await loadCompletedProductionStages(input, evidence, root, repaired), { research, script: originalScript });
});

test("retained repair preflight fails without mutations when a completed stage or its source cannot be verified", async () => {
  for (const mutation of ["missing-research", "missing-script-state", "corrupt-script", "changed-source"] as const) {
    const root = await workspace(); let calls = 0;
    const provider = { claude: async (purpose: string) => { calls++; return purpose === "research" ? draft() : scriptDraft(); } } as unknown as Providers;
    const research = await researchProduct(input, evidence, provider, hooks, root);
    const script = await writeScript(input, evidence, research, provider, hooks, root);
    const plan = await compilePlan(input, evidence, script, hooks, root);
    if (mutation === "missing-research") { await unlink(join(root, "analysis/research.json")); await unlink(join(root, "analysis/research-state.json")); }
    if (mutation === "missing-script-state") await unlink(join(root, "analysis/script-state.json"));
    if (mutation === "corrupt-script") await writeFile(join(root, "analysis/script.json"), "{broken");
    if (mutation === "changed-source") await writeFile(join(root, "assets/screen.jpg"), "Different visual source");
    const before = await readFile(join(root, "plan.json"), "utf8"), files = (await readdir(join(root, "analysis"))).sort();
    const persisted: string[] = [];
    await assert.rejects(prepareRetainedPlanRepair(input, evidence, scriptDraft(), { ...hooks, persist: async paths => { persisted.push(...paths); } }, root, { plan, findings: [] }), isStageFailure);
    assert.equal(await readFile(join(root, "plan.json"), "utf8"), before); assert.deepEqual((await readdir(join(root, "analysis"))).sort(), files);
    assert.deepEqual(persisted, []); assert.equal(calls, 2);
  }
});

test("script rejects invented offers, unknown card facts, invisible proof and missing actual feature UI", () => {
  const rawResearch = { ...draft(), version: 1, jobId: input.jobId, evidenceSha256: "a".repeat(64), facts: draft().facts.map((fact, i) => ({ ...fact, quote: evidence.text.split("\n\n")[i] })) } as Research;
  const base = { ...scriptDraft(), version: 1, jobId: input.jobId, evidenceSha256: rawResearch.evidenceSha256, researchSha256: stageDigest(rawResearch) } as Script;
  validateScript(base, input, evidence, rawResearch);
  const offer = structuredClone(base); offer.scenes[1].presentation = { template: "offer", theme: "light", transition: "expand" };
  assert.throws(() => validateScript(offer, input, evidence, rawResearch), /actual source pricing/);
  offer.scenes[1].evidenceId = "fact-3"; validateScript(offer, input, evidence, rawResearch);
  const fakeCard = structuredClone(base); fakeCard.scenes[1].presentation!.cards![0].evidenceId = "fact-999";
  assert.throws(() => validateScript(fakeCard, input, evidence, rawResearch), /absent from the verified research/);
  const hidden = structuredClone(base); hidden.scenes[0].presentation!.template = "brand";
  assert.throws(() => validateScript(hidden, input, evidence, rawResearch), /real visual proof/);
  const marketing = { ...rawResearch, visuals: rawResearch.visuals.map(v => ({ ...v, showsProductUi: false })) };
  assert.throws(() => validateScript({ ...base, researchSha256: stageDigest(marketing) }, { ...input, videoType: "feature-demo" }, evidence, marketing), /real visual proof/);
});

test("typography based on a spoken recording uses its real preview without duplicating or trimming speech", async () => {
  const root = await workspace(), raw = scriptDraft();
  const sources: Evidence = { text: evidence.text, assets: [{ ...evidence.assets[0], id: "recording", kind: "video", path: "assets/recording.mp4", duration_seconds: 6, has_audio: true, transcript: { text: "A complete supported spoken thought.", words: [{ text: "thought", start: 5, end: 6, type: "word" }] } }] };
  const typography = { ...raw.scenes[0], assetId: "recording", presentation: { template: "brand", theme: "dark", transition: "lift" } };
  const proof = { ...raw.scenes[0], assetId: "recording", durationSeconds: 6, preserveAudio: true, presentation: { template: "proof", theme: "light", transition: "iris" } };
  const plan = await compilePlan(input, sources, { ...raw, scenes: [typography, proof] }, hooks, root);
  assert.equal(plan.scenes[0].asset_id, "recording-typography-still"); assert.equal(plan.scenes[0].preserve_audio, false);
  const preview = plan.assets.find(a => a.id === plan.scenes[0].asset_id)!; assert.equal(preview.path, sources.assets[0].preview); assert.equal(preview.kind, "image");
  assert.equal(plan.scenes[1].asset_id, "recording"); assert.equal(plan.scenes[1].duration_frames, 180); assert.equal(plan.scenes[1].preserve_audio, true); assert.equal(plan.scenes[1].presentation?.transition, "cut");
  assert.equal(sources.assets.length, 1); assert.equal(sources.assets[0].kind, "video");
});

test("offer cards each require classified real pricing and compile with exact quotes and reading time", async () => {
  const root = await workspace();
  const research = compileResearch(input,evidence,draft(),"f".repeat(64),{legacy:true});
  const script = { ...scriptDraft(), version: 1, jobId: input.jobId, evidenceSha256: research.evidenceSha256, researchSha256: stageDigest(research) } as Script;
  script.scenes=script.scenes.slice(0,2);
  script.scenes[1] = { ...script.scenes[1], headline: "Free plan", detail: "Available today", evidenceId: "fact-3", durationSeconds: 2, presentation: { template: "offer", theme: "light", transition: "expand", cards: [{ title: "Free plan", body: "Available today", evidenceId: "fact-3" }] } };
  validateScript(script, input, evidence, research);
  const plan = await compilePlan(input, evidence, script, hooks, root);
  assert.equal(plan.renderer, "hyperframes");
  assert.equal(plan.scenes[1].presentation?.cards?.[0].evidence, "The free plan is available today.");
  assert.equal(plan.scenes[1].duration_frames, Math.ceil(((8 * 32 + 120) * 30) / 100) + 25); // Last scene has no outgoing transition.
  const unsupported = structuredClone(script); unsupported.scenes[1].presentation!.cards![0].evidenceId = "fact-2";
  assert.throws(() => validateScript(unsupported, input, evidence, research), /Every offer card/);
  await assert.rejects(compilePlan(input, evidence, unsupported, hooks, root), /offer card has no actual pricing/);
  const misclassified = { ...research, facts: research.facts.map(f => f.evidenceId === "fact-3" ? { ...f, kind: "benefit" as const, kinds: ["benefit" as const] } : f) };
  assert.throws(() => validateScript({ ...script, researchSha256: stageDigest(misclassified) }, input, evidence, misclassified), /actual source pricing/);
});

test("readable holds include brand text after the actual final entrance and before the complete exit", async () => {
  const root = await workspace(), raw = scriptDraft();
  const brand = { ...raw.scenes[0], headline: "Work together", detail: "Start today", durationSeconds: 2, presentation: { template: "brand", theme: "dark", transition: "lift" } };
  const plan = await compilePlan(input, evidence, { ...raw, product: "Atlas for Software Product Teams", scenes: [brand, raw.scenes[0]] }, hooks, root);
  const words = "Atlas for Software Product Teams Work together Start today".split(" ").length;
  assert.equal(plan.scenes[0].duration_frames, Math.ceil(((words * 32 + 120) * 30) / 100) + 39 + 12);
  assert.equal(plan.scenes[0].duration_frames - 39 - 12, Math.ceil(((words * 32 + 120) * 30) / 100));
});

function environment(t: TestContext) {
  const previous = process.env.ANTHROPIC_API_KEY; process.env.ANTHROPIC_API_KEY = "mock-only";
  t.after(() => { if (previous === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = previous; });
}
test("repair preflight leaves capacity for all QC batches and sends no generation when the cycle cannot fit", async t => {
  environment(t); const root = await workspace(); await mkdir(join(root, "analysis"));
  const provider = new Providers(root, { ...input, budgets: { maxModelCalls: 10, maxModelInputTokens: 200000, maxModelOutputTokens: 30000 } }, hooks);
  provider.ledger.modelCalls = 8; provider.ledger.inputTokens = 188424; provider.ledger.outputTokens = 13783;
  const raw = scriptDraft(), plan = await compilePlan(input, evidence, { ...raw, scenes: [...raw.scenes, ...raw.scenes, ...raw.scenes] }, hooks, root);
  const research = { ...draft(), facts: draft().facts.map((fact, i) => ({ ...fact, quote: evidence.text.split("\n\n")[i] })) } as Pick<Research, "facts" | "visuals">;
  let network = 0; t.mock.method(globalThis, "fetch", async () => { network++; throw new Error("No request expected"); });
  await assert.rejects(async () => {
    const reserve = await provider.qualityRepairReserve(plan, evidence, research);
    await provider.prepareClaude("script", "Repair existing film", [], { policy: "script-v1", reserve });
  }, error => error instanceof PipelineError && error.code === "model_budget");
  assert.equal(network, 0); assert.equal(provider.ledger.modelCalls, 8); assert.equal(provider.ledger.reservedInputTokens, 0);
});
test("prepared repair counts before reservation, withholds QC tokens and cannot execute twice", async t => {
  environment(t); const root = await workspace(), provider = new Providers(root, { ...input, budgets: { maxModelCalls: 10, maxModelInputTokens: 200000, maxModelOutputTokens: 30000 } }, hooks);
  let generations = 0;
  t.mock.method(globalThis, "fetch", async (url: unknown, options: RequestInit) => {
    if (String(url).endsWith("count_tokens")) return new Response(JSON.stringify({ input_tokens: 1000 }));
    generations++; assert.equal(JSON.parse(String(options.body)).max_tokens, 5000);
    return new Response(JSON.stringify({ content: [{ type: "text", text: '{"ok":true}' }], usage: { input_tokens: 1000, output_tokens: 30 } }));
  });
  const generate = await provider.prepareClaude("script", "Repair with actual facts", [], { policy: "script-v1", reserve: { calls: 3, inputTokens: 54000, outputTokens: 9000 } });
  assert.equal(provider.ledger.modelCalls, 0); assert.equal(generations, 0);
  assert.deepEqual(await generate(), { ok: true });
  const audit = JSON.parse(await readFile(join(root, "analysis/model-1-script-budget.json"), "utf8"));
  assert.equal(audit.remainingBefore.inputTokens, 146000); assert.equal(audit.followupQualityReserve.calls, 3); assert.equal(audit.systemPolicy, "script-v1");
  await assert.rejects(generate(), error => error instanceof PipelineError && error.code === "model_preflight_changed"); assert.equal(generations, 1);
});
