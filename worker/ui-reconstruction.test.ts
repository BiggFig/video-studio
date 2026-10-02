import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { compileResearch, evidenceIdentity, researchProduct, sourceFacts, stageDigest } from "./research";
import { compileResearchWithRetry } from "./research-review";
import { compileScript, loadCompletedProductionStages, scriptConstraints, scriptVisibleWords, validateScript, writeScript } from "./scripting";
import { compilePlan, prepareRetainedPlanRepair } from "./planning";
import { buildUiDocuments, compileUiDocuments, loadUiDocuments, uiActionSchema, uiDocumentSchema, validateUiActions, validateUiBundle, type UiAction, type UiDocument, type UiDocumentBundle } from "./ui-reconstruction";
import { constrainedScriptSchema, scriptOutputConfig } from "./model-format";
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
test("UI stage persists reservation, document and completion in order, reuses valid bytes and refuses incomplete or changed stages", async t => {
  const root = await workspace(t), research = compileResearch(input, evidence, researchRaw(), await evidenceIdentity(input, evidence, root)); let calls = 0;
  const events: string[] = [], localHooks = { ...hooks, persist: async (paths: string[]) => { events.push(...paths); } };
  const providers = { ledger: { outputTokens: 2000, reservedOutputTokens: 0 }, claude: async (purpose: string, prompt: string, images: { path: string }[], options: unknown) => { calls++; assert.equal(purpose, "ui-design"); assert.match(prompt, /actual product UI/); assert.equal(images.length, 2); assert.deepEqual(options, { policy: "ui-design-v1", reserve: { calls: 5, inputTokens: 0, outputTokens: 17000 } }); return { sufficientEvidence: true, reason: "Observed", documents: [document()] }; } } as unknown as Providers;
  const bundle = await buildUiDocuments(input, evidence, research, providers, localHooks, root); assert.ok(bundle); validateUiBundle(bundle, input, evidence, research);
  assert.deepEqual(events, ["analysis/ui-state.json", "analysis/ui.json", "analysis/ui-state.json"]);
  assert.deepEqual(await buildUiDocuments(input, evidence, research, providers, hooks, root), bundle); assert.equal(calls, 1);
  const saved = JSON.parse(await readFile(join(root, "analysis/ui.json"), "utf8")); saved.documents[0].elements[0].text = "Tampered"; await writeFile(join(root, "analysis/ui.json"), JSON.stringify(saved));
  await assert.rejects(loadUiDocuments(input, evidence, research, root), blocked); assert.equal(calls, 1);
  const stopped = await workspace(t); const failing = { ...providers, claude: async () => { throw new Error("Response lost"); } } as unknown as Providers;
  await assert.rejects(buildUiDocuments(input, evidence, research, failing, hooks, stopped), /Response lost/);
  await assert.rejects(buildUiDocuments(input, evidence, research, providers, hooks, stopped), blocked); assert.equal(calls, 1);
});
test("the complete mocked v3 sequence and retained repair keep the same UI bundle and all canonical stage bindings", async t => {
  const root = await workspace(t), calls: string[] = [];
  const providers = { ledger: { modelCalls: 0, outputTokens: 0, reservedOutputTokens: 0 }, claude: async (purpose: string) => { calls.push(purpose); return purpose === "research" ? researchRaw() : purpose === "ui-design" ? { sufficientEvidence: true, reason: "Actual UI", documents: [document()] } : scriptRaw(); } } as unknown as Providers;
  const research = await researchProduct(input, evidence, providers, hooks, root), ui = await buildUiDocuments(input, evidence, research, providers, hooks, root);
  const script = await writeScript(input, evidence, research, providers, hooks, root, ui), plan = await compilePlan(input, evidence, script, hooks, root);
  assert.deepEqual(calls, ["research", "ui-design", "script"]);
  const restored = await loadCompletedProductionStages(input, evidence, root, plan); assert.deepEqual(restored.ui, ui);
  const perform = await prepareRetainedPlanRepair(input, evidence, scriptRaw(), hooks, root, { plan, findings: [] }), repaired = await perform();
  assert.equal(repaired.production?.uiSha256, ui!.sha256); assert.deepEqual(repaired.uiDocuments, ui!.documents);
  const changed = structuredClone(plan); changed.uiDocuments![0].elements[0].text = "Altered controls"; await assert.rejects(prepareRetainedPlanRepair(input, evidence, scriptRaw(), hooks, root, { plan: changed, findings: [] }), blocked);
});
test("new research correction reserves the mandatory UI call/output while the UI stage refuses unaffordable work", async t => {
  const root = await workspace(t), research = fixture().research; let called = 0;
  const providers = { ledger: { modelCalls: 1, outputTokens: 0, reservedOutputTokens: 0 }, prepareClaude: async (_purpose: string, _prompt: string, _images: unknown, options: unknown) => { assert.deepEqual(options, { policy: "research-v1", reserve: { calls: 6, inputTokens: 0, outputTokens: 23000 } }); return async () => { called++; return researchRaw(); }; } } as unknown as Providers;
  const bad = researchRaw(); bad.documentTargets[0].capabilityFactIds = ["fact-4"];
  await compileResearchWithRetry(bad, { input, evidence, evidenceSha256: research.evidenceSha256, workspace: root, providers, hooks, prompt: "Same original research request", images: [] }); assert.equal(called, 1);
  const poor = await workspace(t); let uiCalls = 0;
  await assert.rejects(buildUiDocuments(input, evidence, research, { ledger: { outputTokens: 7001, reservedOutputTokens: 0 }, claude: async () => { uiCalls++; } } as unknown as Providers, hooks, poor), error => error instanceof PipelineError && error.code === "model_budget"); assert.equal(uiCalls, 0);
});
test("dynamic UI grammar restricts document, element, editable target and state IDs and requires UI mechanism presentation", () => {
  const { research, ui } = fixture(), constraints = scriptConstraints(research, evidence, ui)!;
  assert.deepEqual(constraints.uiDocuments, [{ id: "notes", elementIds: ["note", "graph-tab", "idea"], editableElementIds: ["note"], stateIds: ["editing", "relationships", "example-note"], capabilityFactIds: ["fact-2", "fact-3"] }]);
  const schema = constrainedScriptSchema(constraints) as any, mechanism = schema.properties.scenes.items.anyOf.find((value: any) => value.properties.storyRole.enum[0] === "mechanism");
  assert.equal(mechanism.properties.presentation.$ref, "#/$defs/uiPresentation");
  const visual = schema.$defs.uiPresentation.properties.visual.anyOf[0]; assert.deepEqual(visual.properties.documentId.enum, ["notes"]);
  const typing = visual.properties.actions.items.anyOf.find((value: any) => value.properties.kind.enum[0] === "type"); assert.deepEqual(typing.properties.targetId.enum, ["note"]);
  assert.ok(scriptOutputConfig("claude-sonnet-4-6", true, "ui-design-v1")); assert.equal(scriptOutputConfig("claude-sonnet-4-6", false, "ui-design-v1"), undefined);
});
