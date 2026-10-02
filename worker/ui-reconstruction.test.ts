import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { compileResearch, evidenceIdentity, researchProduct, sourceFacts, stageDigest } from "./research";
import { compileResearchWithRetry } from "./research-review";
import { compileScript, loadCompletedProductionStages, scriptConstraints, scriptVisibleWords, validateScript, writeScript } from "./scripting";
import { compilePlan, prepareRetainedPlanRepair } from "./planning";
import { buildUiDocuments, compileUiDocuments, loadUiDocuments, MAX_UI_RADIUS, uiActionSchema, uiDesignConstraints, uiDesignRequest, uiDocumentReadiness, UI_READINESS_PATH, uiDocumentSchema, validateUiActions, validateUiBundle, type UiAction, type UiDocument, type UiDocumentBundle } from "./ui-reconstruction";
import { constrainedScriptSchema, constrainedUiSchema, scriptOutputConfig } from "./model-format";
import type { Providers } from "./providers";
import { PipelineError, type Evidence, type Hooks, type WorkerInput } from "./types";

const input: WorkerInput = { jobId: "editable-ui", ownerId: "fixture", mode: "url", productUrl: "https://example.com", videoType: "launch", format: "16:9", files: [], budgets: { maxModelCalls: 10, maxModelInputTokens: 200000, maxModelOutputTokens: 30000 } };
const hooks: Hooks = { persist: async () => {}, state: async () => {}, complete: async () => {} };
const evidence: Evidence = { text: "Atlas organizes sources for researchers.\n\nEdit notes and link ideas.\n\nSee relationships in a graph.\n\nDownload Atlas.", assets: ["editor", "graph"].map(id => ({ id, path: `assets/${id}.png`, kind: "image", usage: "output", rights: "Actual fixture source", width: 1000, height: 600 })) };
const claim = (text: string, fact: string) => ({ text, basis: "explicit", evidenceIds: [fact] });
function researchRaw() {
  return { sufficientEvidence: true, reason: "Documented note workflow", product: "Atlas", summary: "Connected notes", facts: sourceFacts(evidence).map(fact => ({ evidenceId: fact.id, kind: "feature", label: fact.text })), story: { primaryAudience: claim("researchers", "fact-1"), problem: null, mechanism: { ...claim("Edit and link notes", "fact-2"), steps: [{ action: "Edit notes", evidenceId: "fact-2", assetId: "editor" }] }, outcome: claim("See relationships", "fact-3"), differentiator: null, cta: claim("Download Atlas", "fact-4") }, visuals: [{ assetId: "editor", description: "Actual note editor", role: "product_ui", showsProductUi: true, supportsFactIds: ["fact-2"] }, { assetId: "graph", description: "Actual graph", role: "product_ui", showsProductUi: true, supportsFactIds: ["fact-3"] }], documentTargets: [{ id: "notes", sourceAssetIds: ["editor", "graph"], capabilityFactIds: ["fact-2", "fact-3"], goal: "Document the editable note and supported graph outcome." }], limitations: [] };
}
function document(): UiDocument {
  const rect = { x: .1, y: .1, width: .8, height: .8 };
  return { id: "notes", sourceAssetIds: ["editor", "graph"], capabilityFactIds: ["fact-2", "fact-3"], viewport: { width: 1000, height: 600 }, styles: [{ id: "body", fill: "#ffffff", color: "#111111", borderColor: "#dddddd", fontSize: 18, fontWeight: 400, radius: 8 }], elements: [
    { id: "note", type: "textarea", rect, styleId: "body", text: "Research note", textBasis: "source-ui", sourceAssetId: "editor", sourceRect: rect, initiallyVisible: true },
    { id: "graph-tab", type: "tab", rect: { x: .1, y: .01, width: .2, height: .08 }, styleId: "body", text: "Graph", textBasis: "source-ui", sourceAssetId: "editor", sourceRect: { x: .1, y: .01, width: .2, height: .08 }, initiallyVisible: true },
    { id: "idea", type: "node", rect: { x: .4, y: .4, width: .2, height: .1 }, styleId: "body", text: "Research", textBasis: "source-ui", sourceAssetId: "graph", sourceRect: { x: .4, y: .4, width: .2, height: .1 }, initiallyVisible: false },
  ], states: [
    { id: "editing", basis: "observed", sourceAssetId: "editor", evidenceIds: ["fact-2"], visibleElementIds: ["note", "graph-tab"], selectedElementIds: [], textValues: [] },
    { id: "relationships", basis: "observed", sourceAssetId: "graph", evidenceIds: ["fact-3"], visibleElementIds: ["idea"], selectedElementIds: [], textValues: [] },
    { id: "example-note", basis: "illustrative", evidenceIds: ["fact-2"], visibleElementIds: ["note", "graph-tab"], selectedElementIds: ["note"], textValues: [{ elementId: "note", text: "Link ideas", textBasis: "example-content" }] },
  ] };
}
const actions = (): UiAction[] => [{ kind: "type", atFrame: 30, durationFrames: 60, targetId: "note", text: "Link ideas", evidenceId: "fact-2" }];
function scriptRaw() {
  const scene = (role: string, headline: string, fact: string, asset: string, visual?: unknown) => ({ storyRole: role, assetId: asset, headline, detail: "", evidenceId: fact, durationSeconds: 4, sourceInSeconds: 0, preserveAudio: false, purpose: "Source-grounded workflow", referenceTechnique: "Editable UI reproduction", presentation: { template: role === "cta" ? "cta" : "proof", theme: "light", transition: "cut", ...(visual ? { visual } : {}) } });
  return { sufficientEvidence: true, reason: "Actual documented UI", product: "Atlas", summary: "A concise workflow", accent: "#444444", background: "light", musicPrompt: "Restrained original instrumental texture", sfxPrompt: "A soft interface accent", assumptions: [], scenes: [scene("mechanism", "Edit connected notes", "fact-2", "editor", { kind: "ui-demo", documentId: "notes", actions: actions() }), scene("outcome", "See relationships", "fact-3", "graph", { kind: "ui-demo", documentId: "notes", actions: [{ kind: "state", stateId: "relationships", atFrame: 30, durationFrames: 30, evidenceId: "fact-3" }] }), scene("cta", "Download", "fact-4", "editor")] };
}
function flatScriptRaw() {
  const base = scriptRaw();
  return { ...base, transportVersion: "flat-script-v1", scenes: base.scenes.map(scene => {
    const { storyRole, evidenceId, presentation, ...rest } = scene;
    const original = (presentation.visual || { kind: "none" }) as Record<string, any>;
    return { ...rest, storyEvidence: `${storyRole}:${evidenceId}`, presentation: { ...presentation, cards: [], visual: { kind: "none", regionId: "", secondaryAssetId: "", secondaryEvidenceId: "", nodes: [], documentId: "", actions: [], ...original, ...(original.actions ? { actions: original.actions.map((action: UiAction) => ({ targetId: "", stateId: "", text: "", ...action })) } : {}) } } };
  }) };
}
async function workspace(t: TestContext) {
  const prefix = join(tmpdir(), "studio-ui-document-"), path = await mkdtemp(prefix);
  await mkdir(join(path, "analysis")); await mkdir(join(path, "assets"));
  for (const asset of evidence.assets) await writeFile(join(path, asset.path), `Exact source ${asset.id}; provider mocked`);
  t.after(async () => { if (dirname(resolve(path)) !== resolve(tmpdir()) || !path.startsWith(prefix)) throw new Error("Unsafe fixture cleanup"); await rm(path, { recursive: true, force: true }); });
  return path;
}
function fixture() {
  const research = compileResearch(input, evidence, researchRaw(), "a".repeat(64));
  const stage = compileUiDocuments({ sufficientEvidence: true, reason: "Verified", documents: [document()] }, input, evidence, research);
  const ui = { documents: stage.documents, sha256: stageDigest(stage) };
  return { research, stage, ui };
}
const blocked = (error: unknown) => error instanceof PipelineError && error.code === "production_stage_changed";

test("fresh research must choose actual UI targets before reconstruction, while explicit retained v2 remains readable", () => {
  const raw = researchRaw(), research = compileResearch(input, evidence, raw, "a".repeat(64)); assert.equal(research.version, 3);
  assert.throws(() => compileResearch(input, evidence, { ...raw, documentTargets: undefined }, "a".repeat(64)), /documentation targets/);
  assert.equal(compileResearch(input, evidence, { ...raw, documentTargets: undefined }, "a".repeat(64), { version: 2 }).version, 2);
  raw.documentTargets[0].capabilityFactIds = ["fact-4"]; assert.throws(() => compileResearch(input, evidence, raw, "a".repeat(64)), /without matching selected source/);
});
test("UI document compiler preserves source references and rejects unknown controls, stale regions, invented labels and oversized payloads", () => {
  const { research } = fixture(), raw = { sufficientEvidence: true, reason: "Documented", documents: [document()] };
  const original = JSON.stringify(raw); compileUiDocuments(raw, input, evidence, research); assert.equal(JSON.stringify(raw), original);
  for (const mutate of [
    (doc: UiDocument) => { doc.sourceAssetIds = ["missing"]; },
    (doc: UiDocument) => { doc.elements[0].sourceAssetId = "pricing"; },
    (doc: UiDocument) => { doc.elements[0].rect.width = 1; },
    (doc: UiDocument) => { doc.elements.push({ ...doc.elements[0] }); },
    (doc: UiDocument) => { doc.states[0].visibleElementIds = ["invented"]; },
    (doc: UiDocument) => { doc.states[2].textValues = [{ elementId: "graph-tab", text: "Automatic AI research", textBasis: "example-content" }]; },
    (doc: UiDocument) => { doc.states[2].textValues = [{ elementId: "note", text: "New product capability", textBasis: "source-ui" }]; },
    (doc: UiDocument) => { doc.elements[0].text = "x".repeat(161); },
  ]) { const doc = document(); mutate(doc); assert.throws(() => compileUiDocuments({ ...raw, documents: [doc] }, input, evidence, research)); }
  const oversized = document();
  oversized.elements = Array.from({ length: 48 }, (_, index) => ({ ...oversized.elements[0], id: `text-${index}`, text: "漢".repeat(160) }));
  oversized.states = [{ ...oversized.states[0], visibleElementIds: oversized.elements.map(element => element.id), textValues: oversized.elements.slice(0, 24).map(element => ({ elementId: element.id, text: element.text, textBasis: "source-ui" as const })) }];
  assert.ok(Buffer.byteLength(JSON.stringify(oversized), "utf8") > 32000);
  assert.throws(() => compileUiDocuments({ ...raw, documents: [oversized] }, input, evidence, research), /bounded editable payload/);
  assert.throws(() => compileUiDocuments({ sufficientEvidence: false, reason: "Unreadable source" }, input, evidence, research), error => error instanceof PipelineError && error.status === "needs_input");
});

test("ordinary finite pill radii preserve the raw document while source and capability scope remain strict", () => {
  const { research } = fixture();
  for (const radius of [0, 99, 999, MAX_UI_RADIUS]) {
    const doc = document(); doc.styles[0].radius = radius;
    const raw = { sufficientEvidence: true, reason: "Observed pill geometry", documents: [doc] }, before = JSON.stringify(raw);
    assert.equal(compileUiDocuments(raw, input, evidence, research).documents[0].styles[0].radius, radius);
    assert.equal(JSON.stringify(raw), before);
  }
  for (const radius of [-1, MAX_UI_RADIUS + 1, NaN, Infinity, -Infinity]) {
    const doc = document(); doc.styles[0].radius = radius;
    assert.throws(() => compileUiDocuments({ sufficientEvidence: true, reason: "Invalid geometry", documents: [doc] }, input, evidence, research), error => error instanceof PipelineError && error.code === "invalid_ui_document");
  }
  for (const change of [
    (doc: UiDocument) => { doc.sourceAssetIds[1] = "another-source"; },
    (doc: UiDocument) => { doc.capabilityFactIds.push("fact-1"); },
    (doc: UiDocument) => { doc.capabilityFactIds.pop(); },
    (doc: UiDocument) => { doc.capabilityFactIds = ["fact-2", "fact-2"]; },
    (doc: UiDocument) => { doc.states[0].evidenceIds.push("fact-1"); },
  ]) {
    const doc = document(); doc.styles[0].radius = 99; change(doc);
    assert.throws(() => compileUiDocuments({ sufficientEvidence: true, reason: "Valid radius cannot expand capability scope", documents: [doc] }, input, evidence, research), blocked);
  }
});

test("keyed UI responses compile to the unchanged durable array without losing exact target identity or scope", () => {
  const { research } = fixture(), doc = document(), second = structuredClone(doc); second.id = "second-notes";
  const two = { ...research, documentTargets: [...research.documentTargets!, { ...research.documentTargets![0], id: second.id }] };
  // Reversed transport key order must not change canonical target order or persisted document identity.
  const raw = { sufficientEvidence: true, reason: "Actual source UI", documentsById: { [second.id]: second, [doc.id]: doc } }, before = JSON.stringify(raw);
  const stage = compileUiDocuments(raw, input, evidence, two);
  assert.deepEqual(stage.documents, [doc, second]); assert.equal(JSON.stringify(raw), before);
  assert.deepEqual(stage, compileUiDocuments({ sufficientEvidence: true, reason: raw.reason, documents: [doc, second] }, input, evidence, two));
  for (const change of [
    (value: typeof raw) => { delete value.documentsById[second.id]; },
    (value: typeof raw) => { value.documentsById.extra = doc; },
    (value: typeof raw) => { value.documentsById[doc.id].id = second.id; },
    (value: typeof raw) => { value.documentsById[doc.id].capabilityFactIds.push("fact-1"); },
    (value: typeof raw) => { value.documentsById[doc.id].states[0].evidenceIds.push("fact-1"); },
  ]) {
    const changed = structuredClone(raw); change(changed);
    assert.throws(() => compileUiDocuments(changed, input, evidence, two), blocked);
  }
  assert.throws(() => compileUiDocuments({ ...raw, documents: [doc, second] }, input, evidence, two), error => error instanceof PipelineError && error.code === "invalid_ui_document");
});
test("timed actions require visible typed controls, source capabilities, bounded sequential frames and complete state references", () => {
  const doc = document(); validateUiActions(doc, actions());
  for (const action of [
    { ...actions()[0], atFrame: 0 }, { ...actions()[0], durationFrames: 0 }, { ...actions()[0], durationFrames: 11 }, { ...actions()[0], targetId: "idea" },
    { ...actions()[0], targetId: "graph-tab" }, { ...actions()[0], evidenceId: "fact-4" }, { ...actions()[0], text: "x".repeat(161) },
    { kind: "state", stateId: "invented", atFrame: 30, durationFrames: 20, evidenceId: "fact-2" },
  ] as UiAction[]) assert.throws(() => validateUiActions(doc, [action]));
  assert.throws(() => validateUiActions(doc, [{ kind: "click", atFrame: 30, durationFrames: 5, targetId: "graph-tab", evidenceId: "fact-2" }]));
  assert.throws(() => validateUiActions(doc, [...actions(), { kind: "click", targetId: "graph-tab", atFrame: 89, durationFrames: 10, evidenceId: "fact-2" }]), /overlap/);
  validateUiActions(doc, [{ kind: "state", stateId: "relationships", atFrame: 30, durationFrames: 20, evidenceId: "fact-3" }, { kind: "select", targetId: "idea", atFrame: 50, durationFrames: 10, evidenceId: "fact-3" }]);
  assert.throws(() => uiActionSchema.parse({ ...actions()[0], javascript: "fetch('/secret')" }));
  assert.throws(() => uiDocumentSchema.parse({ ...doc, html: "<script>run()</script>" }));
});
test("v3 script embeds immutable documents, uses trusted audience copy, and requires an active reconstructed mechanism", async t => {
  const { research, ui } = fixture(), raw = scriptRaw(), script = compileScript(raw, input, evidence, research, undefined, ui);
  assert.equal(script.audienceLabel, "For researchers"); assert.equal(script.uiSha256, ui.sha256); assert.deepEqual(script.uiDocuments, ui.documents);
  assert.equal(scriptVisibleWords(script), scriptVisibleWords({ ...script, audienceLabel: undefined }) + 2);
  const altered = structuredClone(script); altered.audienceLabel = "For everyone"; assert.throws(() => validateScript(altered, input, evidence, research, undefined, ui), /audience label/);
  altered.audienceLabel = script.audienceLabel; altered.uiDocuments![0].elements[0].text = "Changed"; assert.throws(() => validateScript(altered, input, evidence, research, undefined, ui), /changed its verified UI/);
  const screenshot = scriptRaw(); delete screenshot.scenes[0].presentation.visual; assert.throws(() => compileScript(screenshot, input, evidence, research, undefined, ui), /editable reconstruction/);
  const pointer = scriptRaw(); pointer.scenes[0].presentation.visual = { kind: "ui-demo", documentId: "notes", actions: [{ kind: "pointer", atFrame: 30, durationFrames: 30, targetId: "note", evidenceId: "fact-2" }] }; assert.throws(() => compileScript(pointer, input, evidence, research, undefined, ui), /not just a pointer/);
  const root = await workspace(t), plan = await compilePlan(input, evidence, script, hooks, root);
  assert.equal(plan.audienceLabel, script.audienceLabel); assert.deepEqual(plan.uiDocuments, ui.documents); assert.equal(plan.production?.uiSha256, ui.sha256);
  assert.ok(plan.scenes[0].duration_frames >= 90 + Math.ceil((5 * .32 + 1.2) * 30));
  const fake = structuredClone(script); fake.scenes[0].assetId = "outside-document"; await assert.rejects(compilePlan(input, evidence, fake, hooks, root));
});

test("flat script transport preserves exact citations, visible copy and actions without accepting conflicting defaults", () => {
  const { research, ui } = fixture(), raw = flatScriptRaw(), before = JSON.stringify(raw);
  assert.deepEqual(compileScript(raw, input, evidence, research, undefined, ui), compileScript(scriptRaw(), input, evidence, research, undefined, ui));
  assert.equal(JSON.stringify(raw), before);
  for (const change of [
    (value: ReturnType<typeof flatScriptRaw>) => { value.scenes[1].storyEvidence = "outcome:fact-2"; },
    (value: ReturnType<typeof flatScriptRaw>) => { value.scenes[0].presentation.visual.regionId = "not-applicable"; },
    (value: ReturnType<typeof flatScriptRaw>) => { value.scenes[0].presentation.visual.actions[0].stateId = "editing"; },
    (value: ReturnType<typeof flatScriptRaw>) => { value.scenes[1].presentation.visual.actions[0].text = "An unrequested claim"; },
    (value: ReturnType<typeof flatScriptRaw>) => { value.scenes[0].presentation.visual.actions[0].targetId = "graph-tab"; },
    (value: ReturnType<typeof flatScriptRaw>) => { value.scenes[0].presentation.visual.actions[0].durationFrames = 0; },
    (value: ReturnType<typeof flatScriptRaw>) => { value.scenes[2].presentation.visual.documentId = "notes"; },
  ]) { const changed = flatScriptRaw(); change(changed); assert.throws(() => compileScript(changed, input, evidence, research, undefined, ui)); }
  const conflicting = flatScriptRaw(); Object.assign(conflicting.scenes[0], { storyRole: "product", evidenceId: "fact-1" });
  assert.throws(() => compileScript(conflicting, input, evidence, research, undefined, ui));
});
test("UI stage persists reservation, document and completion in order, reuses valid bytes and refuses incomplete or changed stages", async t => {
  const root = await workspace(t), research = compileResearch(input, evidence, researchRaw(), await evidenceIdentity(input, evidence, root)); let calls = 0;
  const events: string[] = [], localHooks = { ...hooks, persist: async (paths: string[]) => { events.push(...paths); } };
  const providers = { ledger: { outputTokens: 2000, reservedOutputTokens: 0 }, claude: async (purpose: string, prompt: string, images: { path: string }[], options: unknown) => { calls++; assert.equal(purpose, "ui-design"); assert.match(prompt, /actual product UI/); assert.equal(images.length, 2); assert.deepEqual(options, { policy: "ui-design-v1", reserve: { calls: 5, inputTokens: 0, outputTokens: 17000 }, maxOutputTokens: 6000, uiConstraints: { targets: [{ id: "notes", sourceAssetIds: ["editor", "graph"], capabilityFactIds: ["fact-2", "fact-3"] }] } }); return { sufficientEvidence: true, reason: "Observed", documentsById: { notes: document() } }; } } as unknown as Providers;
  const bundle = await buildUiDocuments(input, evidence, research, providers, localHooks, root); assert.ok(bundle); validateUiBundle(bundle, input, evidence, research);
  assert.deepEqual(events.filter(path => !["analysis/ui-source-readiness.json", UI_READINESS_PATH].includes(path)), ["analysis/ui-state.json", "analysis/ui.json", "analysis/ui-state.json"]);
  assert.deepEqual(await buildUiDocuments(input, evidence, research, providers, hooks, root), bundle); assert.equal(calls, 1);
  const saved = JSON.parse(await readFile(join(root, "analysis/ui.json"), "utf8")); saved.documents[0].elements[0].text = "Tampered"; await writeFile(join(root, "analysis/ui.json"), JSON.stringify(saved));
  await assert.rejects(loadUiDocuments(input, evidence, research, root), blocked); assert.equal(calls, 1);
  const stopped = await workspace(t); const failing = { ...providers, claude: async () => { throw new Error("Response lost"); } } as unknown as Providers;
  await assert.rejects(buildUiDocuments(input, evidence, research, failing, hooks, stopped), /Response lost/);
  await assert.rejects(buildUiDocuments(input, evidence, research, providers, hooks, stopped), blocked); assert.equal(calls, 1);
});
test("the complete mocked v3 sequence and retained repair keep the same UI bundle and all canonical stage bindings", async t => {
  const root = await workspace(t), calls: string[] = [];
  const base = scriptRaw(), currentScript = { ...base, creativeDirection: { concept: "focus", evidenceId: "fact-2" }, scenes: [
    { ...base.scenes[0], storyRole: "product", headline: "Atlas", presentation: { template: "brand", theme: "dark", transition: "cut" }, direction: { job: "context", motion: "reveal" } },
    ...base.scenes.map((scene, index) => ({ ...scene, direction: [{ job: "action", motion: "focus" }, { job: "result", motion: "hold" }, { job: "cta", motion: "hold" }][index] })),
  ] };
  const providers = { ledger: { modelCalls: 0, outputTokens: 0, reservedOutputTokens: 0 }, claude: async (purpose: string) => { calls.push(purpose); return purpose === "research" ? researchRaw() : purpose === "ui-design" ? { sufficientEvidence: true, reason: "Actual UI", documentsById: { notes: document() } } : currentScript; } } as unknown as Providers;
  const research = await researchProduct(input, evidence, providers, hooks, root), ui = await buildUiDocuments(input, evidence, research, providers, hooks, root);
  const script = await writeScript(input, evidence, research, providers, hooks, root, ui), plan = await compilePlan(input, evidence, script, hooks, root);
  assert.deepEqual(calls, ["research", "ui-design", "script"]);
  const restored = await loadCompletedProductionStages(input, evidence, root, plan); assert.deepEqual(restored.ui, ui);
  const perform = await prepareRetainedPlanRepair(input, evidence, currentScript, hooks, root, { plan, findings: [] }), repaired = await perform();
  assert.equal(repaired.production?.uiSha256, ui!.sha256); assert.deepEqual(repaired.uiDocuments, ui!.documents);
  const changed = structuredClone(plan); changed.uiDocuments![0].elements[0].text = "Altered controls"; await assert.rejects(prepareRetainedPlanRepair(input, evidence, currentScript, hooks, root, { plan: changed, findings: [] }), blocked);
});
test("new research correction reserves the mandatory UI call/output while the UI stage refuses unaffordable work", async t => {
  const root = await workspace(t), research = fixture().research; let called = 0;
  const providers = { ledger: { modelCalls: 1, outputTokens: 0, reservedOutputTokens: 0 }, prepareClaude: async (_purpose: string, _prompt: string, _images: unknown, options: unknown) => { assert.deepEqual(options, { policy: "research-v1", reserve: { calls: 7, inputTokens: 0, outputTokens: 23000 } }); return async () => { called++; return researchRaw(); }; } } as unknown as Providers;
  const bad = researchRaw(); bad.documentTargets[0].capabilityFactIds = ["fact-4"];
  await compileResearchWithRetry(bad, { input, evidence, evidenceSha256: research.evidenceSha256, workspace: root, providers, hooks, prompt: "Same original research request", images: [] }); assert.equal(called, 1);
  const poor = await workspace(t); let uiCalls = 0;
  await assert.rejects(buildUiDocuments(input, evidence, research, { ledger: { outputTokens: 7001, reservedOutputTokens: 0 }, claude: async () => { uiCalls++; } } as unknown as Providers, hooks, poor), error => error instanceof PipelineError && error.code === "model_budget"); assert.equal(uiCalls, 0);
});
test("dynamic UI grammar restricts document, element, editable target and state IDs and requires UI mechanism presentation", () => {
  const { research, ui } = fixture(), constraints = scriptConstraints(research, evidence, ui)!;
  assert.deepEqual(constraints.uiDocuments, [{ id: "notes", elementIds: ["note", "graph-tab", "idea"], editableElementIds: ["note"], stateIds: ["editing", "relationships", "example-note"], capabilityFactIds: ["fact-2", "fact-3"] }]);
  const schema = constrainedScriptSchema(constraints) as any, scene = schema.properties.scenes.items;
  assert.ok(scene.properties.storyEvidence.enum.includes("mechanism:fact-2"));
  assert.ok(!scene.properties.storyEvidence.enum.includes("outcome:fact-2"));
  const visual = scene.properties.presentation.properties.visual; assert.deepEqual(visual.properties.documentId.enum, ["", "notes"]);
  assert.deepEqual(visual.properties.actions.items.properties.targetId.enum, ["", "note", "graph-tab", "idea"]);
  assert.ok(scriptOutputConfig("claude-sonnet-4-6", true, "ui-design-v1")); assert.equal(scriptOutputConfig("claude-sonnet-4-6", false, "ui-design-v1"), undefined);
  const before = JSON.stringify(research), design = uiDesignConstraints(research);
  design.targets[0].capabilityFactIds.push("fact-1"); assert.equal(JSON.stringify(research), before);
});

function twoTargets() {
  const raw = researchRaw(), note = document(), graph = document();
  raw.story.mechanism.steps.push({ action: "Explore relationships", evidenceId: "fact-3", assetId: "graph" });
  raw.documentTargets = [
    { id: "notes", sourceAssetIds: ["editor"], capabilityFactIds: ["fact-2"], goal: "Document the actual editable note." },
    { id: "graph-view", sourceAssetIds: ["graph"], capabilityFactIds: ["fact-3"], goal: "Document the supported graph outcome." },
  ];
  note.sourceAssetIds = ["editor"]; note.capabilityFactIds = ["fact-2"];
  note.elements = note.elements.filter(element => element.sourceAssetId === "editor");
  note.states = note.states.filter(state => state.id !== "relationships");
  graph.id = "graph-view"; graph.sourceAssetIds = ["graph"]; graph.capabilityFactIds = ["fact-3"];
  graph.elements = graph.elements.filter(element => element.sourceAssetId === "graph").map(element => ({ ...element, initiallyVisible: true }));
  graph.states = [graph.states[1]];
  return { research: compileResearch(input, evidence, raw, "a".repeat(64)), documents: [note, graph] };
}

test("two UI targets use separate exact keyed calls within one 6000-token allocation and one durable stage", async t => {
  const root = await workspace(t), { research, documents } = twoTargets(), before = JSON.stringify(research), events: string[] = [];
  const ledger = { modelCalls: 1, outputTokens: 2000, reservedOutputTokens: 0 };
  let calls = 0;
  const providers = { ledger, claude: async (purpose: string, prompt: string, images: { path: string }[], options: unknown) => {
    const index = calls++, target = research.documentTargets![index];
    assert.equal(purpose, "ui-design"); assert.match(prompt, /This call has 3000 output tokens/);
    assert.ok(prompt.includes(`ASSIGNED TARGET: ${JSON.stringify(target)}`));
    assert.deepEqual(images.map(image => image.path), [`assets/${index ? "graph" : "editor"}.png`]);
    assert.deepEqual(options, { policy: "ui-design-v1", reserve: { calls: index ? 5 : 6, inputTokens: 0, outputTokens: index ? 17000 : 20000 }, maxOutputTokens: 3000, uiConstraints: { targets: [{ id: target.id, sourceAssetIds: target.sourceAssetIds, capabilityFactIds: target.capabilityFactIds }] } });
    assert.equal(JSON.parse(await readFile(join(root, "analysis/ui-state.json"), "utf8")).status, "reserved");
    await assert.rejects(readFile(join(root, "analysis/ui.json")), { code: "ENOENT" });
    ledger.modelCalls++; ledger.outputTokens += 3000;
    return { sufficientEvidence: true, reason: "Observed target", documentsById: { [target.id]: documents[index] } };
  } } as unknown as Providers;
  const bundle = await buildUiDocuments(input, evidence, research, providers, { ...hooks, persist: async paths => { events.push(...paths); } }, root);
  assert.ok(bundle); assert.equal(calls, 2); assert.equal(ledger.outputTokens, 8000);
  assert.deepEqual(bundle.documents, documents); validateUiBundle(bundle, input, evidence, research);
  assert.deepEqual(events.filter(path => !["analysis/ui-source-readiness.json", UI_READINESS_PATH].includes(path)), ["analysis/ui-state.json", "analysis/ui.json", "analysis/ui-state.json"]);
  assert.equal(JSON.stringify(research), before);
  assert.deepEqual(await buildUiDocuments(input, evidence, research, providers, hooks, root), bundle); assert.equal(calls, 2);
});

test("the final UI target receives unused actual output while total UI usage stays at 6000", async t => {
  for (const firstUsage of [0, 2166, 3000]) {
    const root = await workspace(t), { research, documents } = twoTargets(), startOutput = 2000;
    const ledger = { outputTokens: startOutput, reservedOutputTokens: 0 }; let calls = 0;
    const providers = { ledger, claude: async (_purpose: string, prompt: string, _images: unknown, options: { maxOutputTokens: number; reserve: { calls: number; inputTokens: number; outputTokens: number } }) => {
      const index = calls++, allocation = index ? 6000 - firstUsage : 3000;
      assert.equal(options.maxOutputTokens, allocation); assert.ok(allocation <= 6000);
      assert.ok(prompt.includes(`This call has ${allocation} output tokens`));
      assert.deepEqual(options.reserve, { calls: index ? 5 : 6, inputTokens: 0, outputTokens: index ? 17000 : 20000 });
      assert.equal(ledger.outputTokens + allocation + options.reserve.outputTokens, startOutput + 23000);
      ledger.outputTokens += index ? allocation : firstUsage;
      return { sufficientEvidence: true, reason: "Observed target", documentsById: { [documents[index].id]: documents[index] } };
    } } as unknown as Providers;
    const bundle = await buildUiDocuments(input, evidence, research, providers, hooks, root);
    assert.deepEqual(bundle?.documents, documents); assert.equal(calls, 2); assert.equal(ledger.outputTokens - startOutput, 6000);
    await buildUiDocuments(input, evidence, research, providers, hooks, root); assert.equal(calls, 2);
  }
});

test("invalid or over-cap UI usage fails closed without replenishing a partial stage", async t => {
  for (const delta of [-1, 0.5, NaN, Infinity, 3001, 6001]) {
    const root = await workspace(t), { research, documents } = twoTargets(); let calls = 0;
    const ledger = { outputTokens: 2000, reservedOutputTokens: 0 };
    const providers = { ledger, claude: async () => { calls++; ledger.outputTokens += delta; return { sufficientEvidence: true, reason: "Observed", documentsById: { notes: documents[0] } }; } } as unknown as Providers;
    await assert.rejects(buildUiDocuments(input, evidence, research, providers, hooks, root), error => error instanceof PipelineError && error.code === "model_budget");
    assert.equal(calls, 1); await assert.rejects(buildUiDocuments(input, evidence, research, providers, hooks, root), blocked); assert.equal(calls, 1);
  }
  const root = await workspace(t), { research, documents } = twoTargets(); let calls = 0;
  const ledger = { outputTokens: 2000, reservedOutputTokens: 0 };
  const providers = { ledger, claude: async () => { const index = calls++; ledger.outputTokens += index ? 3835 : 2166; return { sufficientEvidence: true, reason: "Observed", documentsById: { [documents[index].id]: documents[index] } }; } } as unknown as Providers;
  await assert.rejects(buildUiDocuments(input, evidence, research, providers, hooks, root), error => error instanceof PipelineError && error.code === "model_budget");
  assert.equal(calls, 2); await assert.rejects(readFile(join(root, "analysis/ui.json")), { code: "ENOENT" });
  await assert.rejects(buildUiDocuments(input, evidence, research, providers, hooks, root), blocked); assert.equal(calls, 2);
});

test("exhausted job output and invalid initial accounting cannot start a UI request", async t => {
  for (const outputTokens of [7001, -1, NaN, Infinity, 0.5]) {
    const root = await workspace(t), { research } = twoTargets(); let calls = 0;
    const providers = { ledger: { outputTokens, reservedOutputTokens: 0 }, claude: async () => { calls++; } } as unknown as Providers;
    await assert.rejects(buildUiDocuments(input, evidence, research, providers, hooks, root), error => error instanceof PipelineError && error.code === "model_budget");
    assert.equal(calls, 0);
  }
});

test("a partial two-target UI stage cannot repeat after a lost or invalid second response", async t => {
  for (const failure of ["lost", "invalid"] as const) {
    const root = await workspace(t), { research, documents } = twoTargets(); let calls = 0;
    const providers = { ledger: { outputTokens: 2000, reservedOutputTokens: 0 }, claude: async () => {
      const index = calls++;
      if (index === 1 && failure === "lost") throw new Error("Second target response lost");
      const doc = structuredClone(documents[index]);
      if (index === 1) doc.capabilityFactIds = ["fact-2"];
      return { sufficientEvidence: true, reason: "Observed target", documentsById: { [doc.id]: doc } };
    } } as unknown as Providers;
    await assert.rejects(buildUiDocuments(input, evidence, research, providers, hooks, root), failure === "lost" ? /Second target response lost/ : blocked);
    assert.equal(calls, 2); assert.equal(JSON.parse(await readFile(join(root, "analysis/ui-state.json"), "utf8")).status, "reserved");
    await assert.rejects(readFile(join(root, "analysis/ui.json")), { code: "ENOENT" });
    await assert.rejects(buildUiDocuments(input, evidence, research, providers, hooks, root), blocked); assert.equal(calls, 2);
  }
});

test("wrong target keys and borrowed capabilities stop before another UI call", async t => {
  for (const kind of ["extra-key", "scope", "array", "refusal"] as const) {
    const root = await workspace(t), { research, documents } = twoTargets(); let calls = 0;
    const doc = structuredClone(documents[0]); if (kind === "scope") doc.capabilityFactIds.push("fact-3");
    const response = kind === "refusal" ? { sufficientEvidence: false, reason: "Required UI is unreadable" } : kind === "array" ? { sufficientEvidence: true, reason: "Wrong transport", documents: [doc] } : { sufficientEvidence: true, reason: "Observed", documentsById: { notes: doc, ...(kind === "extra-key" ? { "graph-view": documents[1] } : {}) } };
    const providers = { ledger: { outputTokens: 0, reservedOutputTokens: 0 }, claude: async () => { calls++; return response; } } as unknown as Providers;
    await assert.rejects(buildUiDocuments(input, evidence, research, providers, hooks, root), error => error instanceof PipelineError && (kind === "refusal" ? error.status === "needs_input" : ["production_stage_changed", "invalid_ui_document"].includes(error.code)));
    assert.equal(calls, 1);
    await assert.rejects(buildUiDocuments(input, evidence, research, providers, hooks, root), blocked); assert.equal(calls, 1);
  }
});

test("selected source styles are optional, preserved exactly and must resolve inside the immutable document", () => {
  const { research } = fixture(), legacy = document(), before = JSON.stringify(legacy);
  assert.deepEqual(uiDocumentSchema.parse(legacy), legacy);
  assert.deepEqual(compileUiDocuments({ sufficientEvidence: true, reason: "Legacy source", documents: [legacy] }, input, evidence, research).documents[0], legacy);
  assert.equal(JSON.stringify(legacy), before);
  const doc = document();
  doc.styles.push({ ...doc.styles[0], id: "selected-gray", fill: "#444444", color: "#eeeeee", borderColor: "#555555" });
  doc.elements[1].selectedStyleId = "selected-gray";
  const raw = { sufficientEvidence: true, reason: "Observed selected tab", documents: [doc] }, unchanged = JSON.stringify(raw);
  const stage = compileUiDocuments(raw, input, evidence, research);
  assert.deepEqual(stage.documents[0], doc); assert.equal(JSON.stringify(raw), unchanged);
  const altered = structuredClone(doc); altered.elements[1].selectedStyleId = "missing-style";
  assert.throws(() => compileUiDocuments({ ...raw, documents: [altered] }, input, evidence, research), /documented source style/);
  altered.elements[1].selectedStyleId = ""; assert.equal(uiDocumentSchema.safeParse(altered).success, false);
  const grammar = constrainedUiSchema({ targets: [uiDesignConstraints(research).targets[0]] }) as any;
  const element = grammar.properties.documentsById.properties.notes.properties.elements.items;
  assert.equal(element.properties.selectedStyleId.type, "string");
  assert.equal(element.required.includes("selectedStyleId"), false); assert.equal(element.additionalProperties, false);
});

test("typing requires the documented editable control to be visible before selection, including a supported preselection state", () => {
  const { research } = fixture(), doc = document();
  doc.elements[0].initiallyVisible = false;
  doc.states[0].visibleElementIds = ["graph-tab"];
  doc.states.push({ id: "preselection", basis: "illustrative", evidenceIds: ["fact-2"], visibleElementIds: ["note", "graph-tab"], selectedElementIds: [], textValues: [{ elementId: "note", text: "", textBasis: "example-content" }] });
  const stage = compileUiDocuments({ sufficientEvidence: true, reason: "Documented editable preselection", documents: [doc] }, input, evidence, research);
  assert.throws(() => validateUiActions(stage.documents[0], actions()), /absent or hidden/);
  validateUiActions(stage.documents[0], [
    { kind: "state", stateId: "preselection", atFrame: 30, durationFrames: 1, evidenceId: "fact-2" },
    { kind: "type", targetId: "note", text: "Link ideas", atFrame: 32, durationFrames: 12, evidenceId: "fact-2" },
    { kind: "select", targetId: "graph-tab", atFrame: 45, durationFrames: 1, evidenceId: "fact-2" },
    { kind: "state", stateId: "relationships", atFrame: 46, durationFrames: 1, evidenceId: "fact-3" },
  ]);
  const unknown = structuredClone(doc); unknown.states[3].visibleElementIds.push("invented-input");
  assert.throws(() => compileUiDocuments({ sufficientEvidence: true, reason: "Unsupported input", documents: [unknown] }, input, evidence, research), /missing, duplicate/);
});

test("target briefs preserve exact authorized quotes and pixels without repeating another target's facts or DOM", () => {
  const { research } = twoTargets(), target = research.documentTargets![0];
  const supplied = structuredClone(evidence);
  supplied.assets[0].transcript = { text: "Unrelated audio passage must not be repeated as target evidence", words: [] };
  supplied.uiSources = [{ id: "dom-editor", assetId: "editor", basis: "dom", context: "marketing-example", width: 1000, height: 600, rootSelector: "#private-source-selector", elements: [{ id: "e1", role: "input", rect: { x: .1, y: .1, width: .5, height: .1 }, selector: "#source-only-path", text: "Exact observed text" }], limitations: ["Only one observed state."] }, { id: "dom-graph", assetId: "graph", basis: "pixels", context: "marketing-example", width: 1000, height: 600, elements: [], limitations: ["OTHER TARGET DOM"] }];
  const before = JSON.stringify({ research, supplied }), request = uiDesignRequest(research, supplied, target, 3000);
  const context = JSON.parse(request.prompt.split("VERIFIED TARGET SCOPE (only these canonical capability passages are authorized): ")[1].split("\nSELECTED SOURCES:")[0]);
  assert.deepEqual(context.capabilities, research.facts.filter(fact => target.capabilityFactIds.includes(fact.evidenceId)));
  assert.deepEqual(context.mechanismSteps, research.story!.mechanism!.steps.filter(step => target.sourceAssetIds.includes(step.assetId)));
  assert.deepEqual(request.images, [{ path: "assets/editor.png", label: "ACTUAL DOCUMENTATION SOURCE editor" }]);
  assert.match(request.prompt, /8–12 workflow-critical elements/); assert.match(request.prompt, /20%.*closing JSON/);
  assert.match(request.prompt, /Exact observed text/);
  for (const excluded of ["OTHER TARGET DOM", "#private-source-selector", "#source-only-path", supplied.assets[0].transcript.text, research.facts.find(fact => fact.evidenceId === "fact-3")!.quote]) assert.ok(!request.prompt.includes(excluded));
  assert.equal(JSON.stringify({ research, supplied }), before);
});

test("UI readiness persists exact source scope and actionable failed validation before another target can be charged", async t => {
  const root = await workspace(t), { research, documents } = twoTargets(); let calls = 0;
  const raw = { sufficientEvidence: true, reason: "Observed", documentsById: { notes: structuredClone(documents[0]) } };
  raw.documentsById.notes.elements[0].textBasis = "example-content";
  const original = JSON.stringify(raw), events: string[] = [];
  const providers = { ledger: { outputTokens: 2000, reservedOutputTokens: 0 }, claude: async () => {
    calls++;
    const sourceReport = JSON.parse(await readFile(join(root, "analysis/ui-source-readiness.json"), "utf8"));
    assert.equal(sourceReport.status, "ready_for_documentation"); assert.equal(sourceReport.researchSha256, stageDigest(research));
    const report = JSON.parse(await readFile(join(root, UI_READINESS_PATH), "utf8"));
    assert.equal(report.targets[0].status, "requested"); assert.equal(report.targets[0].outputAllocation, 3000);
    assert.ok(events.includes(UI_READINESS_PATH)); return raw;
  } } as unknown as Providers;
  await assert.rejects(buildUiDocuments(input, evidence, research, providers, { ...hooks, persist: async paths => { events.push(...paths); } }, root), blocked);
  const saved = await readFile(join(root, UI_READINESS_PATH), "utf8"), report = JSON.parse(saved);
  assert.equal(report.status, "stopped"); assert.equal(report.targets[0].status, "failed"); assert.equal(report.targets[1].status, "pending");
  assert.equal(report.targets[0].responseSha256, stageDigest(raw)); assert.equal(report.targets[0].validation.code, "production_stage_changed");
  assert.match(report.targets[0].validation.reason, /observed UI state/); assert.equal(calls, 1); assert.equal(JSON.stringify(raw), original);
  await assert.rejects(buildUiDocuments(input, evidence, research, providers, hooks, root), blocked);
  assert.equal(await readFile(join(root, UI_READINESS_PATH), "utf8"), saved); assert.equal(calls, 1);
});

test("missing selected still pixels and failed readiness persistence stop before UI generation", async t => {
  for (const failure of ["missing-preview", "persist"] as const) {
    const root = await workspace(t), { research } = fixture(), supplied = structuredClone(evidence); let calls = 0;
    if (failure === "missing-preview") supplied.assets[0].kind = "video";
    const providers = { ledger: { outputTokens: 0, reservedOutputTokens: 0 }, claude: async () => { calls++; } } as unknown as Providers;
    const localHooks = { ...hooks, persist: async (paths: string[]) => { if (failure === "persist" && paths.includes(UI_READINESS_PATH)) throw new Error("Readiness checkpoint unavailable"); } };
    await assert.rejects(buildUiDocuments(input, supplied, research, providers, localHooks, root), error => failure === "persist" ? error instanceof Error && error.message === "Readiness checkpoint unavailable" : error instanceof PipelineError && error.status === "needs_input");
    assert.equal(calls, 0);
  }
});

test("successful document readiness distinguishes visible editing from hidden controls without certifying pixel fidelity", async t => {
  const root = await workspace(t), { research } = fixture(), doc = document();
  const providers = { ledger: { outputTokens: 0, reservedOutputTokens: 0 }, claude: async () => ({ sufficientEvidence: true, reason: "Observed", documentsById: { notes: doc } }) } as unknown as Providers;
  await buildUiDocuments(input, evidence, research, providers, hooks, root);
  const report = JSON.parse(await readFile(join(root, UI_READINESS_PATH), "utf8"));
  assert.equal(report.status, "ready_for_script"); assert.match(report.meaning, /independent rendered quality review/);
  assert.equal(report.targets[0].documentSha256, stageDigest(doc)); assert.equal(report.targets[0].elementCount, 3);
  assert.deepEqual(report.targets[0].states[0].editableElementIds, ["note"]);
  const hidden = structuredClone(doc); hidden.elements.push({ ...hidden.elements[0], id: "hidden-input", initiallyVisible: false });
  assert.match(uiDocumentReadiness(hidden).warnings[0], /hidden in every documented state/);
});
