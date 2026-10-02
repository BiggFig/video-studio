import { buildWorkflowContext, workflowTaskEvidence } from "./workflow-coherence";
import { workflowInputReserve } from "./workflow-coherence";
import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { compileResearch, evidenceIdentity, researchRequest, researchProduct, sourceFacts, stageDigest } from "./research";
import { compileResearchWithRetry } from "./research-review";
import { compileScript, loadCompletedProductionStages, scriptConstraints, scriptVisibleWords, validateScript, writeScript } from "./scripting";
import { compilePlan, prepareRetainedPlanRepair } from "./planning";
import { buildUiDocuments as buildUiDocumentsCurrent, compileUiDocuments, decodeUiTransport, loadUiDocuments, MAX_UI_RADIUS, uiActionSchema, uiDesignConstraints, uiDesignRequest, uiDocumentReadiness, UI_READINESS_PATH, UI_LAYOUT_RETRY_PATH, uiDocumentSchema, uiExampleCopy, validateUiActions, validateUiBundle, type UiDocumentDependencies, type UiAction, type UiDocument, type UiDocumentBundle } from "./ui-reconstruction";
import { constrainedScriptSchema, constrainedUiSchema, scriptOutputConfig, UI_TRANSPORT_VERSION } from "./model-format";
import { buildShotRecipeCatalog, RECIPE_SCRIPT_TRANSPORT_VERSION } from "./shot-recipes";
import type { Providers } from "./providers";
import { PipelineError, type Evidence, type Hooks, type WorkerInput } from "./types";

// Existing editable/query fixtures exercise demo mode; fresh launch result requirements are tested separately below.
const input: WorkerInput = { jobId: "editable-ui", ownerId: "fixture", mode: "url", productUrl: "https://example.com", videoType: "feature-demo", format: "16:9", files: [], budgets: { maxModelCalls: 10, maxModelInputTokens: 200000, maxModelOutputTokens: 30000 } };
const hooks: Hooks = { persist: async () => {}, state: async () => {}, complete: async () => {} };
const passedLayout: NonNullable<UiDocumentDependencies["inspectLayout"]> = async (_documents, options) => {
  const reportPath = `analysis/${options.reportName}.json`;
  await writeFile(join(options.workspace, reportPath), JSON.stringify({ passed: true, issues: [] }));
  return { passed: true, reportPath, artifactPaths: [reportPath], issues: [] };
};

async function layoutCorrectionFixture(t: TestContext, initialUsage = 3000) {
  const root = await workspace(t), { research } = fixture(), original = document(), corrected = document();
  original.elements[0].rect.height = .1; corrected.elements[0].rect.height = .2;
  const keyed = (doc: UiDocument) => ({ transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Exact source scope", documentsById: { notes: doc } });
  const raw = keyed(original), correctedRaw = keyed(corrected), before = JSON.stringify(raw), events: string[] = [];
  const ledger = { modelCalls: 1, inputTokens: 1000, outputTokens: 1000, reservedInputTokens: 0, reservedOutputTokens: 0 };
  let initialCalls = 0, prepared = 0, correctedCalls = 0, inspections = 0;
  const localHooks = { ...hooks, persist: async (paths: string[]) => { events.push(...paths); } };
  const providers = { ledger, claude: async () => { initialCalls++; ledger.modelCalls++; ledger.outputTokens += initialUsage; return raw; }, prepareClaude: async (_purpose: string, prompt: string, images: { path: string }[], options: any) => {
    prepared++; events.push("prepared");
    assert.equal(_purpose, "ui-design"); assert.match(prompt, /UNTRUSTED MODEL OUTPUT/); assert.match(prompt, /TRUSTED MEASURED DIAGNOSTICS/);
    assert.deepEqual(images, uiDesignRequest(research, evidence, research.documentTargets![0], 6000).images);
    assert.deepEqual(options.reserve, { calls: 5, inputTokens: workflowInputReserve(), outputTokens: 16048 });
    assert.equal(options.maxOutputTokens, 6000 - initialUsage);
    assert.deepEqual(options.uiConstraints, uiDesignConstraints(research));
    await assert.rejects(readFile(join(root, UI_LAYOUT_RETRY_PATH)), { code: "ENOENT" });
    return async () => {
      correctedCalls++; events.push("corrected-call");
      assert.equal(JSON.parse(await readFile(join(root, UI_LAYOUT_RETRY_PATH), "utf8")).status, "reserved");
      assert.ok(events.includes(UI_LAYOUT_RETRY_PATH));
      ledger.modelCalls++; ledger.outputTokens += Math.min(2500, options.maxOutputTokens);
      return correctedRaw;
    };
  } } as unknown as Providers;
  const inspectLayout: NonNullable<UiDocumentDependencies["inspectLayout"]> = async (documents, options) => {
    const passed = ++inspections > 1, reportPath = `analysis/${options.reportName}.json`;
    const issues = passed ? [] : [{ code: "text_overflow" as const, documentId: documents[0].id, stateId: documents[0].states[0].id, elementId: documents[0].elements[0].id, layout: "compact" as const, metrics: { fontSize: 18, clientHeight: 10, scrollHeight: 24 } }];
    await writeFile(join(root, reportPath), JSON.stringify({ passed, issues })); events.push(`inspect:${options.reportName}`);
    return { passed, reportPath, artifactPaths: [reportPath], issues };
  };
  const run = (dependencies: UiDocumentDependencies = { inspectLayout }) => buildUiDocuments(input, evidence, research, providers, localHooks, root, dependencies);
  return { root, research, raw, correctedRaw, before, ledger, events, providers, localHooks, inspectLayout, run, get initialCalls() { return initialCalls; }, get prepared() { return prepared; }, get correctedCalls() { return correctedCalls; }, get inspections() { return inspections; } };
}
const buildUiDocuments: typeof buildUiDocumentsCurrent = (input, evidence, research, providers, hooks, workspace, dependencies) => buildUiDocumentsCurrent(input, evidence, research, providers, hooks, workspace, { inspectLayout: passedLayout, ...dependencies });

test("measured UI layout gets one preflighted correction, retains both reports and preserves the original response", async t => {
  const f = await layoutCorrectionFixture(t), bundle = await f.run();
  assert.deepEqual(bundle!.documents, [f.correctedRaw.documentsById.notes]);
  assert.equal(f.initialCalls, 1); assert.equal(f.correctedCalls, 1); assert.equal(f.prepared, 1); assert.equal(f.inspections, 2);
  assert.equal(f.ledger.outputTokens, 6500); assert.equal(JSON.stringify(f.raw), f.before);
  const marker = JSON.parse(await readFile(join(f.root, UI_LAYOUT_RETRY_PATH), "utf8"));
  assert.equal(marker.status, "completed"); assert.equal(marker.outcome, "valid"); assert.equal(marker.outputAllocation, 3000);
  assert.equal(marker.originalResponseSha256, stageDigest(f.raw)); assert.equal(marker.originalDocumentSha256, stageDigest(f.raw.documentsById.notes));
  const report = JSON.parse(await readFile(join(f.root, UI_READINESS_PATH), "utf8")), target = report.targets[0];
  assert.equal(target.initialLayout.passed, false); assert.equal(target.correctedLayout.passed, true);
  assert.notEqual(target.initialLayout.reportPath, target.correctedLayout.reportPath);
  assert.equal(target.initialLayout.documentSha256, stageDigest(f.raw.documentsById.notes));
  assert.equal(target.correctedLayout.documentSha256, stageDigest(f.correctedRaw.documentsById.notes));
  assert.equal(target.responseSha256, stageDigest(f.raw)); assert.equal(target.correctedResponseSha256, stageDigest(f.correctedRaw));
  const initial = await readFile(join(f.root, target.initialLayout.reportPath), "utf8");
  assert.equal(JSON.parse(initial).passed, false); assert.equal(marker.layoutReportSha256, stageDigest(JSON.parse(initial)));
  assert.ok(f.events.indexOf("prepared") < f.events.indexOf(UI_LAYOUT_RETRY_PATH));
  assert.ok(f.events.indexOf(UI_LAYOUT_RETRY_PATH) < f.events.indexOf("corrected-call"));
  assert.deepEqual(await f.run({ inspectLayout: async () => { throw Error("Completed stage must not be inspected again"); } }), bundle);
  assert.equal(f.initialCalls, 1); assert.equal(f.correctedCalls, 1);
});

test("a measured text collision retains both valid element IDs through the existing single correction", async t => {
  for (const otherElementId of ["graph-tab", "missing", "note"]) {
    const f = await layoutCorrectionFixture(t); let preparedPrompt = "";
    const prepare = f.providers.prepareClaude;
    f.providers.prepareClaude = async (...args) => { preparedPrompt = args[1]; return prepare(...args); };
    const inspectLayout: NonNullable<UiDocumentDependencies["inspectLayout"]> = async (documents, options) => {
      const result = await f.inspectLayout(documents, options);
      if (!result.passed) { result.issues = [{ code: "text_collision", documentId: documents[0].id, stateId: "editing", elementId: "note", otherElementId, layout: "compact", metrics: { overlapWidth: 32, overlapHeight: 14 } }]; await writeFile(join(f.root, result.reportPath), JSON.stringify(result)); }
      return result;
    };
    if (otherElementId === "graph-tab") { await f.run({ inspectLayout }); assert.equal(f.correctedCalls, 1); assert.match(preparedPrompt, /"otherElementId":"graph-tab"/); assert.match(preparedPrompt, /"overlapHeight":14/); assert.equal(JSON.stringify(f.raw), f.before); }
    else { await assert.rejects(f.run({ inspectLayout }), error => error instanceof PipelineError && error.code === "production_stage_changed"); assert.equal(f.prepared, 0); assert.equal(f.correctedCalls, 0); }
  }
});

test("exhausted UI allocation and rejected exact provider preflight cannot reserve or spend a correction", async t => {
  for (const initialUsage of [5489, 6000]) {
    const f = await layoutCorrectionFixture(t, initialUsage);
    await assert.rejects(f.run(), error => error instanceof PipelineError && error.code === "model_budget");
    assert.equal(f.initialCalls, 1); assert.equal(f.prepared, 0); assert.equal(f.correctedCalls, 0);
    await assert.rejects(readFile(join(f.root, UI_LAYOUT_RETRY_PATH)), { code: "ENOENT" });
  }
  for (const message of ["Exact input allowance exhausted", "Remaining call ceiling protects required script and reviews"]) {
    const f = await layoutCorrectionFixture(t); let preflights = 0;
    f.providers.prepareClaude = async (_purpose, _prompt, _images, options) => { preflights++; assert.deepEqual(options?.reserve, { calls: 5, inputTokens: workflowInputReserve(), outputTokens: 16048 }); throw new PipelineError("model_budget", message, "Inspect retained allowance", "needs_review"); };
    await assert.rejects(f.run(), error => error instanceof PipelineError && error.code === "model_budget");
    assert.equal(preflights, 1); assert.equal(f.correctedCalls, 0);
    await assert.rejects(readFile(join(f.root, UI_LAYOUT_RETRY_PATH)), { code: "ENOENT" });
  }
});

test("schema, provenance, missing transport, insufficient evidence and uncertain initial responses never get layout correction", async t => {
  for (const failure of ["schema", "scope", "text", "transport", "insufficient", "uncertain"] as const) {
    const f = await layoutCorrectionFixture(t);
    if (failure === "schema") f.raw.documentsById.notes.styles[0].fontSize = -1;
    if (failure === "scope") f.raw.documentsById.notes.capabilityFactIds = ["fact-4"];
    if (failure === "text") f.raw.documentsById.notes = hiddenResultDocument();
    if (failure === "transport") delete (f.raw as Partial<typeof f.raw>).transportVersion;
    if (failure === "insufficient") f.raw.sufficientEvidence = false;
    if (failure === "uncertain") f.providers.claude = async () => { throw new Error("Provider response lost"); };
    await assert.rejects(f.run());
    assert.equal(f.prepared, 0); assert.equal(f.correctedCalls, 0); assert.equal(f.inspections, 0);
    await assert.rejects(readFile(join(f.root, UI_LAYOUT_RETRY_PATH)), { code: "ENOENT" });
  }
});

test("inspection infrastructure errors and nonfinite metrics never become paid geometry corrections", async t => {
  for (const failure of ["browser", "metrics"] as const) {
    const f = await layoutCorrectionFixture(t);
    const inspectLayout: NonNullable<UiDocumentDependencies["inspectLayout"]> = async (documents, options) => {
      if (failure === "browser") throw new PipelineError("ui_layout_unavailable", "Browser unavailable", "Inspect runtime", "needs_review");
      const result = await f.inspectLayout(documents, options);
      result.issues[0].code = "invalid_metrics" as any;
      return result;
    };
    await assert.rejects(f.run({ inspectLayout }), error => error instanceof PipelineError && error.code === "ui_layout_unavailable");
    assert.equal(f.prepared, 0); assert.equal(f.correctedCalls, 0);
    await assert.rejects(readFile(join(f.root, UI_LAYOUT_RETRY_PATH)), { code: "ENOENT" });
  }
});

test("a returned invalid correction or a second measured failure is consumed and cannot repeat", async t => {
  for (const failure of ["layout", "schema", "scope", "text", "transport"] as const) {
    const f = await layoutCorrectionFixture(t);
    if (failure === "schema") f.correctedRaw.documentsById.notes.viewport.width = 0;
    if (failure === "scope") f.correctedRaw.documentsById.notes.sourceAssetIds = ["missing"];
    if (failure === "text") f.correctedRaw.documentsById.notes = hiddenResultDocument();
    if (failure === "transport") delete (f.correctedRaw as Partial<typeof f.correctedRaw>).transportVersion;
    const inspectLayout: NonNullable<UiDocumentDependencies["inspectLayout"]> = async (documents, options) => {
      const result = await f.inspectLayout(documents, options);
      if (!result.issues.length && failure === "layout") {
        const failed = { ...result, passed: false, issues: [{ code: "text_overflow" as const, documentId: documents[0].id, stateId: documents[0].states[0].id, elementId: documents[0].elements[0].id, layout: "compact" as const, metrics: { scrollHeight: 100, clientHeight: 10 } }] };
        await writeFile(join(options.workspace, result.reportPath), JSON.stringify(failed)); return failed;
      }
      return result;
    };
    await assert.rejects(f.run({ inspectLayout })); assert.equal(f.correctedCalls, 1);
    const saved = await readFile(join(f.root, UI_LAYOUT_RETRY_PATH), "utf8"); assert.equal(JSON.parse(saved).outcome, "invalid");
    await assert.rejects(f.run(), blocked); assert.equal(f.initialCalls, 1); assert.equal(f.correctedCalls, 1);
    assert.equal(await readFile(join(f.root, UI_LAYOUT_RETRY_PATH), "utf8"), saved);
    assert.equal(JSON.stringify(f.raw), f.before);
  }
});

test("orphan markers and interrupted correction checkpoints never restart UI spending", async t => {
  for (const marker of ["{corrupt", JSON.stringify({ status: "reserved" }), JSON.stringify({ status: "completed", outcome: "valid" })]) {
    const f = await layoutCorrectionFixture(t); await writeFile(join(f.root, UI_LAYOUT_RETRY_PATH), marker);
    await assert.rejects(f.run(), blocked); assert.equal(f.initialCalls, 0); assert.equal(f.prepared, 0);
  }
  for (const failure of ["marker-checkpoint", "provider-uncertain", "completion-checkpoint"] as const) {
    const f = await layoutCorrectionFixture(t); let markerSaves = 0;
    const originalPersist = f.localHooks.persist;
    f.localHooks.persist = async paths => { if (paths.includes(UI_LAYOUT_RETRY_PATH) && ++markerSaves === (failure === "marker-checkpoint" ? 1 : failure === "completion-checkpoint" ? 2 : 99)) throw Error("Checkpoint lost"); await originalPersist(paths); };
    if (failure === "provider-uncertain") f.providers.prepareClaude = async () => async () => { throw Error("Correction response lost"); };
    await assert.rejects(f.run(), /lost/);
    const before = f.initialCalls;
    await assert.rejects(f.run(), blocked); assert.equal(f.initialCalls, before);
    if (failure === "marker-checkpoint") assert.equal(f.correctedCalls, 0);
  }
});

test("a two-target correction retains the untouched target allocation and refuses actual UI usage over6000", async t => {
  const root = await workspace(t), { research, documents } = twoTargets(), ledger = { modelCalls: 1, outputTokens: 1000, reservedOutputTokens: 0 };
  let initialCalls = 0, corrections = 0, inspections = 0;
  const response = (doc: UiDocument) => ({ transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Scoped", documentsById: { [doc.id]: doc } });
  const providers = { ledger, claude: async (_purpose: string, _prompt: string, _images: unknown, options: any) => {
    const index = initialCalls++; assert.equal(options.maxOutputTokens, 3000);
    ledger.modelCalls++; ledger.outputTokens += index ? 3000 : 1500; return response(documents[index]);
  }, prepareClaude: async (_purpose: string, _prompt: string, _images: unknown, options: any) => {
    assert.equal(options.maxOutputTokens, 1500); assert.deepEqual(options.reserve, { calls: 6, inputTokens: workflowInputReserve(), outputTokens: 19048 });
    return async () => { corrections++; ledger.modelCalls++; ledger.outputTokens += 1500; return response(documents[0]); };
  } } as unknown as Providers;
  const inspectLayout: NonNullable<UiDocumentDependencies["inspectLayout"]> = async (docs, options) => {
    const result = await passedLayout(docs, options);
    if (++inspections === 1) {
      result.passed = false; result.issues = [{ code: "text_overflow", documentId: docs[0].id, stateId: docs[0].states[0].id, elementId: docs[0].elements[0].id, layout: "compact", metrics: { clientHeight: 10, scrollHeight: 24 } }];
      await writeFile(join(root, result.reportPath), JSON.stringify(result));
    }
    return result;
  };
  assert.deepEqual((await buildUiDocuments(input, evidence, research, providers, hooks, root, { inspectLayout }))!.documents, documents);
  assert.equal(initialCalls, 2); assert.equal(corrections, 1); assert.equal(ledger.outputTokens - 1000, 6000);
  const over = await layoutCorrectionFixture(t), prepare = over.providers.prepareClaude.bind(over.providers);
  over.providers.prepareClaude = async (...args) => { const execute = await prepare(...args); return async <T>() => { const response = await execute(); over.ledger.outputTokens += 501; return response as T; }; };
  await assert.rejects(over.run(), error => error instanceof PipelineError && error.code === "model_budget");
  assert.equal(JSON.parse(await readFile(join(over.root, UI_LAYOUT_RETRY_PATH), "utf8")).status, "reserved");
  await assert.rejects(readFile(join(over.root, "analysis/ui.json")), { code: "ENOENT" });
});
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
  const providers = { ledger: { outputTokens: 2000, reservedOutputTokens: 0 }, claude: async (purpose: string, prompt: string, images: { path: string }[], options: unknown) => { calls++; assert.equal(purpose, "ui-design"); assert.match(prompt, /actual product UI/); assert.equal(images.length, 2); assert.deepEqual(options, { policy: "ui-design-v1", reserve: { calls: 5, inputTokens: workflowInputReserve(), outputTokens: 16048 }, maxOutputTokens: 6000, uiConstraints: { targets: [{ id: "notes", sourceAssetIds: ["editor", "graph"], capabilityFactIds: ["fact-2", "fact-3"] }] } }); return { transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Observed", documentsById: { notes: document() } }; } } as unknown as Providers;
  const bundle = await buildUiDocuments(input, evidence, research, providers, localHooks, root); assert.ok(bundle); validateUiBundle(bundle, input, evidence, research);
  assert.deepEqual(events.filter(path => !["analysis/ui-source-readiness.json", UI_READINESS_PATH].includes(path) && !path.startsWith("analysis/ui-layout-")), ["analysis/ui-state.json", "analysis/ui.json", "analysis/ui-state.json"]);
  assert.deepEqual(await buildUiDocuments(input, evidence, research, providers, hooks, root), bundle); assert.equal(calls, 1);
  const saved = JSON.parse(await readFile(join(root, "analysis/ui.json"), "utf8")); saved.documents[0].elements[0].text = "Tampered"; await writeFile(join(root, "analysis/ui.json"), JSON.stringify(saved));
  await assert.rejects(loadUiDocuments(input, evidence, research, root), blocked); assert.equal(calls, 1);
  const stopped = await workspace(t); const failing = { ...providers, claude: async () => { throw new Error("Response lost"); } } as unknown as Providers;
  await assert.rejects(buildUiDocuments(input, evidence, research, failing, hooks, stopped), /Response lost/);
  await assert.rejects(buildUiDocuments(input, evidence, research, providers, hooks, stopped), blocked); assert.equal(calls, 1);
});
test("the complete mocked v3 sequence binds its workflow review and forbids an unreviewed retained repair", async t => {
  const root = await workspace(t), calls: string[] = [];
  const base = scriptRaw(), currentScript = { ...base, creativeDirection: { concept: "focus", evidenceId: "fact-2" }, scenes: [
    { ...base.scenes[0], storyRole: "product", headline: "Atlas", presentation: { template: "brand", theme: "dark", transition: "cut" }, direction: { job: "context", motion: "reveal" } },
    ...base.scenes.map((scene, index) => ({ ...scene, ...(index === 1 ? { presentation: { ...scene.presentation, visual: { kind: "showcase" } } } : {}), direction: [{ job: "action", motion: "focus" }, { job: "result", motion: "hold" }, { job: "cta", motion: "hold" }][index] })),
  ] };
  let recipeResponse: unknown;
  const providers = { ledger: { modelCalls: 0, outputTokens: 0, reservedOutputTokens: 0 }, claude: async (purpose: string) => { calls.push(purpose); return purpose === "research" ? researchRaw() : purpose === "ui-design" ? { transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Actual UI", documentsById: { notes: document() } } : recipeResponse; }, prepareClaude: async (purpose: string, _prompt: string, _images: unknown, options: any) => { assert.equal(purpose, "workflow-coherence"); return async () => { calls.push(purpose); return { taskEntitlementVersion: 1, tasks: workflowTaskEvidence(buildWorkflowContext(compileScript(recipeResponse, input, evidence, research, undefined, ui), ui)).map(scene => ({ sceneId: scene.sceneId, promiseExcerpt: scene.promiseCopy[0], requiredResult: "query", resultAnswer: "visible-result", postconditionIds: [] })), contextSha256: options.workflowConstraints.contextSha256, assessments: buildWorkflowContext(compileScript(recipeResponse, input, evidence, research, undefined, ui), ui).obligations!.map(obligation => ({ obligationId: obligation.id, status: "supported", reason: "The fixture edit supports its visible note task and surrounding context." })) }; }; } } as unknown as Providers;
  const research = await researchProduct(input, evidence, providers, hooks, root), ui = await buildUiDocuments(input, evidence, research, providers, hooks, root);
  const catalog = buildShotRecipeCatalog(research, evidence, ui!);
  recipeResponse = { ...currentScript, transportVersion: RECIPE_SCRIPT_TRANSPORT_VERSION, scenes: currentScript.scenes.map(scene => {
    const { storyRole, assetId, evidenceId, presentation, ...copy } = scene;
    const visual = (presentation as { visual?: { kind: string; actions?: UiAction[] } }).visual;
    const recipe = catalog.recipes.find(recipe => recipe.storyRole === storyRole && recipe.assetId === assetId && recipe.evidenceId === evidenceId && recipe.template === presentation.template && recipe.visual.kind === (visual?.kind || "none"));
    assert.ok(recipe);
    return { ...copy, recipeId: recipe.id, presentation: { theme: presentation.theme, transition: presentation.transition, cards: [], nodes: [], actions: (visual?.actions || []).map(action => ({ targetId: "", stateId: "", text: "", ...action })) } };
  }) };
  const script = await writeScript(input, evidence, research, providers, hooks, root, ui), plan = await compilePlan(input, evidence, script, hooks, root);
  assert.deepEqual(calls, ["research", "ui-design", "script", "workflow-coherence"]);
  const restored = await loadCompletedProductionStages(input, evidence, root, plan); assert.deepEqual(restored.ui, ui);
  assert.ok(plan.production?.workflowCoherence);
  await assert.rejects(prepareRetainedPlanRepair(input, evidence, recipeResponse, hooks, root, { plan, findings: [] }), /cannot bypass/);
  const changed = structuredClone(plan); changed.uiDocuments![0].elements[0].text = "Altered controls"; await assert.rejects(prepareRetainedPlanRepair(input, evidence, recipeResponse, hooks, root, { plan: changed, findings: [] }), blocked);
});
test("new research correction reserves the mandatory UI call/output while the UI stage refuses unaffordable work", async t => {
  const root = await workspace(t), research = fixture().research; let called = 0;
  const providers = { ledger: { modelCalls: 1, outputTokens: 0, reservedOutputTokens: 0 }, prepareClaude: async (_purpose: string, _prompt: string, _images: unknown, options: unknown) => { assert.deepEqual(options, { policy: "research-v1", reserve: { calls: 7, inputTokens: 0, outputTokens: 23000 } }); return async () => { called++; return researchRaw(); }; } } as unknown as Providers;
  const bad = researchRaw(); bad.documentTargets[0].capabilityFactIds = ["fact-4"];
  await compileResearchWithRetry(bad, { input, evidence, evidenceSha256: research.evidenceSha256, workspace: root, providers, hooks, prompt: "Same original research request", images: [] }); assert.equal(called, 1);
  const poor = await workspace(t); let uiCalls = 0;
  await assert.rejects(buildUiDocuments(input, evidence, research, { ledger: { outputTokens: 7953, reservedOutputTokens: 0 }, claude: async () => { uiCalls++; } } as unknown as Providers, hooks, poor), error => error instanceof PipelineError && error.code === "model_budget"); assert.equal(uiCalls, 0);
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
    assert.deepEqual(options, { policy: "ui-design-v1", reserve: { calls: index ? 5 : 6, inputTokens: workflowInputReserve(), outputTokens: index ? 16048 : 19048 }, maxOutputTokens: 3000, uiConstraints: { targets: [{ id: target.id, sourceAssetIds: target.sourceAssetIds, capabilityFactIds: target.capabilityFactIds }] } });
    assert.equal(JSON.parse(await readFile(join(root, "analysis/ui-state.json"), "utf8")).status, "reserved");
    await assert.rejects(readFile(join(root, "analysis/ui.json")), { code: "ENOENT" });
    ledger.modelCalls++; ledger.outputTokens += 3000;
    return { transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Observed target", documentsById: { [target.id]: documents[index] } };
  } } as unknown as Providers;
  const bundle = await buildUiDocuments(input, evidence, research, providers, { ...hooks, persist: async paths => { events.push(...paths); } }, root);
  assert.ok(bundle); assert.equal(calls, 2); assert.equal(ledger.outputTokens, 8000);
  assert.deepEqual(bundle.documents, documents); validateUiBundle(bundle, input, evidence, research);
  assert.deepEqual(events.filter(path => !["analysis/ui-source-readiness.json", UI_READINESS_PATH].includes(path) && !path.startsWith("analysis/ui-layout-")), ["analysis/ui-state.json", "analysis/ui.json", "analysis/ui-state.json"]);
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
      assert.deepEqual(options.reserve, { calls: index ? 5 : 6, inputTokens: workflowInputReserve(), outputTokens: index ? 16048 : 19048 });
      assert.equal(ledger.outputTokens + allocation + options.reserve.outputTokens, startOutput + 22048);
      ledger.outputTokens += index ? allocation : firstUsage;
      return { transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Observed target", documentsById: { [documents[index].id]: documents[index] } };
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
    const providers = { ledger, claude: async () => { calls++; ledger.outputTokens += delta; return { transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Observed", documentsById: { notes: documents[0] } }; } } as unknown as Providers;
    await assert.rejects(buildUiDocuments(input, evidence, research, providers, hooks, root), error => error instanceof PipelineError && error.code === "model_budget");
    assert.equal(calls, 1); await assert.rejects(buildUiDocuments(input, evidence, research, providers, hooks, root), blocked); assert.equal(calls, 1);
  }
  const root = await workspace(t), { research, documents } = twoTargets(); let calls = 0;
  const ledger = { outputTokens: 2000, reservedOutputTokens: 0 };
  const providers = { ledger, claude: async () => { const index = calls++; ledger.outputTokens += index ? 3835 : 2166; return { transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Observed", documentsById: { [documents[index].id]: documents[index] } }; } } as unknown as Providers;
  await assert.rejects(buildUiDocuments(input, evidence, research, providers, hooks, root), error => error instanceof PipelineError && error.code === "model_budget");
  assert.equal(calls, 2); await assert.rejects(readFile(join(root, "analysis/ui.json")), { code: "ENOENT" });
  await assert.rejects(buildUiDocuments(input, evidence, research, providers, hooks, root), blocked); assert.equal(calls, 2);
});

test("UI documentation preserves the full v2 review and three quality batches at the exact global output cap", async t => {
  for (const targetCount of [1, 2]) for (const affordable of [false, true]) {
    const root = await workspace(t), scoped = targetCount === 2 ? twoTargets() : { research: fixture().research, documents: [document()] };
    const ledger = { outputTokens: 7952, reservedOutputTokens: 0 }; let calls = 0;
    const providers = { ledger, claude: async (_purpose: string, _prompt: string, _images: unknown, options: any) => {
      const doc = scoped.documents[calls++];
      assert.equal(options.reserve.outputTokens, 16048 + (scoped.documents.length - calls) * 3000);
      assert.equal(options.maxOutputTokens, 6000 / scoped.documents.length);
      ledger.outputTokens += options.maxOutputTokens;
      return { transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Observed source", documentsById: { [doc.id]: doc } };
    } } as unknown as Providers;
    const run = () => buildUiDocuments({ ...input, budgets: { ...input.budgets, maxModelOutputTokens: 30000 - Number(!affordable) } }, evidence, scoped.research, providers, hooks, root);
    if (affordable) { assert.ok(await run()); assert.equal(calls, targetCount); assert.equal(ledger.outputTokens + 16048, 30000); }
    else { await assert.rejects(run(), error => error instanceof PipelineError && error.code === "model_budget"); assert.equal(calls, 0); }
  }
});

test("exhausted job output and invalid initial accounting cannot start a UI request", async t => {
  for (const outputTokens of [7953, -1, NaN, Infinity, 0.5]) {
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
      return { transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Observed target", documentsById: { [doc.id]: doc } };
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
    const response = kind === "refusal" ? { sufficientEvidence: false, reason: "Required UI is unreadable" } : kind === "array" ? { transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Wrong transport", documents: [doc] } : { transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Observed", documentsById: { notes: doc, ...(kind === "extra-key" ? { "graph-view": documents[1] } : {}) } };
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
  const raw = { transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Observed", documentsById: { notes: structuredClone(documents[0]) } };
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
  const providers = { ledger: { outputTokens: 0, reservedOutputTokens: 0 }, claude: async () => ({ transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Observed", documentsById: { notes: doc } }) } as unknown as Providers;
  await buildUiDocuments(input, evidence, research, providers, hooks, root);
  const report = JSON.parse(await readFile(join(root, UI_READINESS_PATH), "utf8"));
  assert.equal(report.status, "ready_for_script"); assert.match(report.meaning, /actual browser layout checks/); assert.match(report.meaning, /independent quality review/);
  assert.equal(report.targets[0].documentSha256, stageDigest(doc)); assert.equal(report.targets[0].elementCount, 3);
  assert.deepEqual(report.targets[0].states[0].editableElementIds, ["note"]);
  const hidden = structuredClone(doc); hidden.elements.push({ ...hidden.elements[0], id: "hidden-input", initiallyVisible: false });
  assert.match(uiDocumentReadiness(hidden).warnings[0], /hidden in every documented state/);
});

function pixelDraft() {
  const doc = document();
  for (const element of doc.elements) element.rect = { x: element.rect.x * doc.viewport.width, y: element.rect.y * doc.viewport.height, width: element.rect.width * doc.viewport.width, height: element.rect.height * doc.viewport.height };
  return { transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "pixels", sufficientEvidence: true, reason: "Explicit integer layout coordinates", documentsById: { notes: doc } };
}

function hiddenResultDocument() {
  const doc = document();
  doc.elements[0].text = "[[I thin]]";
  doc.elements[1].type = "list-item"; doc.elements[1].text = "I think therefore I am";
  doc.elements[2].type = "text"; doc.elements[2].sourceAssetId = "editor"; doc.elements[2].text = "[[I think therefore I am]]";
  doc.states = [doc.states[0], { id: "linked", basis: "illustrative", evidenceIds: ["fact-2"], visibleElementIds: ["idea"], selectedElementIds: [], textValues: [] }];
  return doc;
}
const freshDocumentResponse = (doc: UiDocument) => ({ transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Documented workflow", documents: [doc] });

test("fresh UI provenance rejects composed hidden base and repeated override strings while legacy bytes remain valid", () => {
  const { research } = fixture();
  for (const override of [false, true]) {
    const doc = hiddenResultDocument();
    if (override) doc.states[1].textValues = [{ elementId: "idea", text: doc.elements[2].text, textBasis: "source-ui" }];
    const raw = freshDocumentResponse(doc), before = JSON.stringify(raw);
    assert.throws(() => compileUiDocuments(raw, input, evidence, research), /Newly composed input or results must be example-content/);
    const { transportVersion: _transport, coordinateSpace: _space, ...legacy } = raw;
    assert.deepEqual(compileUiDocuments(legacy, input, evidence, research).documents, [doc]);
    assert.equal(JSON.stringify(raw), before);
    doc.elements[2].textBasis = "example-content";
    if (override) doc.states[1].textValues[0].textBasis = "example-content";
    assert.deepEqual(compileUiDocuments(raw, input, evidence, research).documents, [doc]);
  }
});

test("fresh UI provenance preserves exact observed and selected DOM reuse, but cannot borrow other sources or hidden observed overrides", () => {
  const { research } = fixture();
  const reused = hiddenResultDocument(); reused.elements[2].text = reused.elements[1].text;
  assert.deepEqual(compileUiDocuments(freshDocumentResponse(reused), input, evidence, research).documents, [reused]);
  reused.elements[2].text = "";
  assert.doesNotThrow(() => compileUiDocuments(freshDocumentResponse(reused), input, evidence, research));
  const doc = hiddenResultDocument(), supplied = structuredClone(evidence);
  supplied.uiSources = [{ id: "dom-editor", assetId: "editor", basis: "dom", context: "marketing-example", width: 1000, height: 600, elements: [{ id: "result", role: "text", rect: doc.elements[2].sourceRect, text: doc.elements[2].text }], limitations: [] }];
  assert.doesNotThrow(() => compileUiDocuments(freshDocumentResponse(doc), input, supplied, research));
  supplied.uiSources[0].assetId = "unselected-source";
  assert.throws(() => compileUiDocuments(freshDocumentResponse(doc), input, supplied, research), /exactly reuse observed visible text/);
  const overridden = hiddenResultDocument();
  overridden.elements[2].text = overridden.elements[0].text;
  overridden.states[0].textValues = [{ elementId: "note", text: "Actual observed replacement", textBasis: "source-ui" }];
  assert.throws(() => compileUiDocuments(freshDocumentResponse(overridden), input, evidence, research), /exactly reuse observed visible text/);
  overridden.elements[2].text = "Actual observed replacement";
  assert.doesNotThrow(() => compileUiDocuments(freshDocumentResponse(overridden), input, evidence, research));
});

test("new UI provenance is checked before stage completion and remains a consumed failed stage", async t => {
  const root = await workspace(t), { research } = fixture(); let calls = 0;
  const raw = { ...freshDocumentResponse(hiddenResultDocument()), documentsById: { notes: hiddenResultDocument() } };
  const { documents: _documents, ...keyed } = raw;
  const providers = { ledger: { outputTokens: 0, reservedOutputTokens: 0 }, claude: async () => { calls++; return keyed; } } as unknown as Providers;
  await assert.rejects(buildUiDocuments(input, evidence, research, providers, hooks, root), /Newly composed input or results must be example-content/);
  const report = JSON.parse(await readFile(join(root, UI_READINESS_PATH), "utf8"));
  assert.equal(report.status, "stopped"); assert.equal(report.targets[0].status, "failed");
  await assert.rejects(readFile(join(root, "analysis/ui.json")), { code: "ENOENT" });
  await assert.rejects(buildUiDocuments(input, evidence, research, providers, hooks, root), blocked); assert.equal(calls, 1);
});

test("UI reading allowance counts later visible examples and overrides, excluding unreachable or overridden base text", async t => {
  const doc = document(), result = "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty";
  doc.elements[0].text = "Unused base content"; doc.elements[0].textBasis = "example-content";
  doc.states[0].textValues = [{ elementId: "note", text: "Research note", textBasis: "source-ui" }];
  doc.elements[2].text = result; doc.elements[2].textBasis = "example-content";
  doc.states[1].basis = "illustrative";
  doc.states[1].textValues = [{ elementId: "note", text: "Hidden override", textBasis: "example-content" }];
  doc.states[2].textValues[0].text = "Unreachable state text";
  const stateAction: UiAction = { kind: "state", stateId: "relationships", atFrame: 30, durationFrames: 30, evidenceId: "fact-3" };
  assert.deepEqual(uiExampleCopy(doc, [stateAction]), [result]);
  assert.deepEqual(uiExampleCopy(doc, []), []);
  assert.deepEqual(uiExampleCopy(doc, [{ ...actions()[0], text: "Typed example" }, { ...stateAction, atFrame: 90 }]), [result, "Typed example"]);
  const { research } = fixture(), stage = compileUiDocuments({ sufficientEvidence: true, reason: "Examples", documents: [doc] }, input, evidence, research), ui = { documents: stage.documents, sha256: stageDigest(stage) };
  const script = compileScript(scriptRaw(), input, evidence, research, undefined, ui), plan = await compilePlan(input, evidence, script, hooks, await workspace(t));
  assert.ok(plan.scenes[1].duration_frames >= 228 + 60, "20 example words need their complete reading hold after the state action ends");
});

test("explicit pixel transport normalizes layout exactly once and preserves every source, style, state and input object", () => {
  const { research, stage } = fixture(), raw = pixelDraft(), before = JSON.stringify(raw);
  const compiled = compileUiDocuments(raw, input, evidence, research);
  assert.deepEqual(compiled.documents, stage.documents);
  assert.equal(JSON.stringify(raw), before);
  assert.deepEqual(compiled.documents[0].elements.map(element => element.sourceRect), raw.documentsById.notes.elements.map(element => element.sourceRect));
  const decoded = decodeUiTransport(raw); assert.deepEqual(decodeUiTransport(decoded), decoded);
  assert.deepEqual(compileUiDocuments({ transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Normalized", documents: [document()] }, input, evidence, research).documents, stage.documents);
  const { transportVersion: _version, coordinateSpace: _space, ...undeclared } = raw;
  assert.throws(() => compileUiDocuments(undeclared, input, evidence, research), error => error instanceof PipelineError && error.code === "invalid_ui_document");
});

test("pixel transport rejects missing or mixed units, overflow and pixel sourceRects without guessing or clamping", () => {
  const { research } = fixture();
  for (const mutate of [
    (raw: ReturnType<typeof pixelDraft>) => { delete (raw as Partial<typeof raw>).transportVersion; },
    (raw: ReturnType<typeof pixelDraft>) => { delete (raw as Partial<typeof raw>).coordinateSpace; },
    (raw: ReturnType<typeof pixelDraft>) => { raw.transportVersion = "unknown-version"; },
    (raw: ReturnType<typeof pixelDraft>) => { raw.coordinateSpace = "normalized"; },
    (raw: ReturnType<typeof pixelDraft>) => { raw.documentsById.notes.elements[1].rect = document().elements[1].rect; },
    (raw: ReturnType<typeof pixelDraft>) => { raw.documentsById.notes.elements[0].rect.x = 999; },
    (raw: ReturnType<typeof pixelDraft>) => { raw.documentsById.notes.elements[0].rect.width = 0; },
    (raw: ReturnType<typeof pixelDraft>) => { raw.documentsById.notes.elements[0].rect.x = -1; },
    (raw: ReturnType<typeof pixelDraft>) => { raw.documentsById.notes.elements[0].rect.y = .5; },
    (raw: ReturnType<typeof pixelDraft>) => { raw.documentsById.notes.elements[0].sourceRect.width = 1000; },
  ]) {
    const raw = pixelDraft(); mutate(raw); const before = JSON.stringify(raw);
    assert.throws(() => compileUiDocuments(raw, input, evidence, research), error => error instanceof PipelineError && error.code === "invalid_ui_document");
    assert.equal(JSON.stringify(raw), before);
  }
});

test("fresh research corrects two targets once without dropping facts, while canonical retained two-target research stays valid", async t => {
  const root = await workspace(t), two = twoTargets().research, before = JSON.stringify(two); let initial = 0, corrections = 0;
  assert.equal(compileResearch(input, evidence, two, two.evidenceSha256).documentTargets!.length, 2);
  assert.throws(() => compileResearch(input, evidence, two, two.evidenceSha256, { version: 3, singleTarget: true }), /exactly one decisive/);
  const unscoped = { ...two, documentTargets: [two.documentTargets![0]] };
  assert.throws(() => compileResearch(input, evidence, unscoped, two.evidenceSha256, { version: 3, singleTarget: true }), /Every fresh mechanism claim and step/);
  const corrected = researchRaw();
  const reserve = { policy: "research-v1", reserve: { calls: 6, inputTokens: workflowInputReserve(), outputTokens: 22048 } };
  const providers = { ledger: { modelCalls: 1, outputTokens: 1000, reservedOutputTokens: 0 }, claude: async (_purpose: string, _prompt: string, _images: unknown, options: unknown) => { assert.deepEqual(options, reserve); initial++; return two; }, prepareClaude: async (_purpose: string, prompt: string, _images: unknown, options: unknown) => {
    assert.match(prompt, /single_target_required/); assert.match(prompt, /exactly one decisive input\/action\/result/);
    assert.deepEqual(options, reserve);
    return async () => { corrections++; return corrected; };
  } } as unknown as Providers;
  const result = await researchProduct(input, evidence, providers, hooks, root);
  assert.equal(result.documentTargets!.length, 1); assert.deepEqual(result.facts.map(fact => ({ id: fact.evidenceId, quote: fact.quote })), two.facts.map(fact => ({ id: fact.evidenceId, quote: fact.quote })));
  assert.equal(JSON.stringify(two), before); assert.equal(initial, 1); assert.equal(corrections, 1);
  assert.deepEqual(await researchProduct(input, evidence, providers, hooks, root), result); assert.equal(initial, 1); assert.equal(corrections, 1);
  const marker = JSON.parse(await readFile(join(root, "analysis/research-response-retry.json"), "utf8"));
  assert.equal(marker.outcome, "valid"); assert.ok(marker.diagnostics.some((diagnostic: { code: string }) => diagnostic.code === "single_target_required"));
});

function launchDocument(): UiDocument {
  const doc = document();
  doc.elements[1].type = "list-item"; doc.elements[1].text = "Research note";
  doc.elements[2] = { ...doc.elements[2], type: "text", sourceAssetId: "editor", rect: { ...doc.elements[0].rect }, sourceRect: { ...doc.elements[0].sourceRect }, text: "[[Research note]]", textBasis: "example-content" };
  doc.states = [doc.states[0], { id: "linked", basis: "illustrative", evidenceIds: ["fact-2"], visibleElementIds: ["idea"], selectedElementIds: [], textValues: [] }];
  doc.terminalResult = { version: 1, beforeStateId: "editing", afterStateId: "linked", confirmationElementId: "graph-tab", resultElementIds: ["idea"], evidenceIds: ["fact-2"] };
  return doc;
}
const launchInput: WorkerInput = { ...input, videoType: "launch" };
const currentUiRaw = (doc: UiDocument) => ({ transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Source-bound content insertion", documentsById: { [doc.id]: doc } });

test("fresh launch grammar and research require one source-supported terminal result without adding a call or scope", () => {
  const research = compileResearch(launchInput, evidence, researchRaw(), "a".repeat(64));
  const constraints = uiDesignConstraints(research, { requireLaunchResult: true });
  const grammar = constrainedUiSchema(constraints) as any, documentShape = grammar.properties.documentsById.properties.notes;
  assert.ok(documentShape.required.includes("terminalResult"));
  assert.deepEqual(documentShape.properties.terminalResult.properties.evidenceIds.items.enum, ["fact-2", "fact-3"]);
  assert.deepEqual(documentShape.properties.terminalResult.required, ["version", "beforeStateId", "afterStateId", "confirmationElementId", "resultElementIds", "evidenceIds"]);
  assert.equal((constrainedUiSchema(uiDesignConstraints(research)) as any).properties.documentsById.properties.notes.properties.terminalResult, undefined);
  const request = uiDesignRequest(research, evidence, research.documentTargets![0], 6000, { requireLaunchResult: true });
  assert.match(request.prompt, /terminalResult/); assert.match(request.prompt, /Query changes, selection styling, preparation.*clearing alone are insufficient/);
  assert.match(request.prompt, /same existing states\/elements\/output allowance/); assert.match(request.prompt, /return sufficientEvidence:false; finding or selection alone/);
  assert.match(researchRequest(launchInput, evidence).prompt, /persistent noneditable content or an applied value/);
  assert.ok(!researchRequest(input, evidence).prompt.includes("For this launch film, choose a workflow"));
});

test("terminal declarations preserve exact normalized/pixel documents, while legacy absence remains compatible", () => {
  const research = compileResearch(launchInput, evidence, researchRaw(), "a".repeat(64)), doc = launchDocument(), raw = currentUiRaw(doc), before = JSON.stringify(raw);
  const compiled = compileUiDocuments(raw, launchInput, evidence, research, { requireLaunchResult: true });
  assert.deepEqual(compiled.documents[0], doc); assert.equal(JSON.stringify(raw), before);
  const pixels = structuredClone(raw); pixels.coordinateSpace = "pixels";
  for (const element of pixels.documentsById.notes.elements) element.rect = { x: element.rect.x * doc.viewport.width, y: element.rect.y * doc.viewport.height, width: element.rect.width * doc.viewport.width, height: element.rect.height * doc.viewport.height };
  const pixelBefore = JSON.stringify(pixels), decoded = compileUiDocuments(pixels, launchInput, evidence, research, { requireLaunchResult: true });
  assert.deepEqual(decoded, compiled); assert.equal(JSON.stringify(pixels), pixelBefore);
  const missing = document(); assert.ok(compileUiDocuments(currentUiRaw(missing), launchInput, evidence, research));
  assert.throws(() => compileUiDocuments(currentUiRaw(missing), launchInput, evidence, research, { requireLaunchResult: true }), error => error instanceof PipelineError && error.code === "insufficient_launch_result" && error.status === "needs_input");
  assert.notEqual(stageDigest(compiled), stageDigest(compileUiDocuments(currentUiRaw(missing), launchInput, evidence, research)));
});

test("terminal result references cannot borrow another fact, source, element or state", () => {
  const research = compileResearch(launchInput, evidence, researchRaw(), "a".repeat(64));
  for (const mutate of [
    (doc: UiDocument) => { doc.terminalResult!.beforeStateId = "missing"; },
    (doc: UiDocument) => { doc.terminalResult!.afterStateId = "editing"; },
    (doc: UiDocument) => { doc.terminalResult!.confirmationElementId = "idea"; },
    (doc: UiDocument) => { doc.terminalResult!.resultElementIds = ["missing"]; },
    (doc: UiDocument) => { doc.terminalResult!.resultElementIds = ["idea", "idea"]; },
    (doc: UiDocument) => { doc.terminalResult!.evidenceIds = ["fact-4"]; },
    (doc: UiDocument) => { doc.terminalResult!.evidenceIds = ["fact-3"]; },
    (doc: UiDocument) => { doc.elements[2].sourceAssetId = "unselected"; },
    (doc: UiDocument) => { doc.elements[2].textBasis = "source-ui"; },
  ]) { const doc = launchDocument(); mutate(doc); assert.throws(() => compileUiDocuments(currentUiRaw(doc), launchInput, evidence, research, { requireLaunchResult: true }), blocked); }
});

test("fresh launch missing, selection-only, unchanged and clear-only results stop once before layout or correction", async t => {
  for (const kind of ["missing", "query", "selection", "unchanged", "clear"] as const) {
    const root = await workspace(t), research = compileResearch(launchInput, evidence, researchRaw(), await evidenceIdentity(launchInput, evidence, root));
    const doc = launchDocument();
    if (kind === "missing") delete doc.terminalResult;
    if (kind === "query" || kind === "selection") doc.elements[2].type = kind === "query" ? "input" : "list-item";
    if (kind === "unchanged") { doc.elements[2].initiallyVisible = true; doc.elements[2].textBasis = "source-ui"; doc.states[0].visibleElementIds.push("idea"); }
    if (kind === "clear") doc.elements[2].text = "";
    const raw = currentUiRaw(doc), original = JSON.stringify(raw); let calls = 0, corrections = 0, layouts = 0;
    const providers = { ledger: { outputTokens: 1000, reservedOutputTokens: 0 }, claude: async (_purpose: string, _prompt: string, _images: unknown, options: any) => { calls++; assert.equal(options.maxOutputTokens, 6000); assert.deepEqual(options.reserve, { calls: 5, inputTokens: workflowInputReserve(), outputTokens: 16048 }); assert.equal(options.uiConstraints.requireLaunchResult, true); return raw; }, prepareClaude: async () => { corrections++; throw Error("No depth correction is permitted"); } } as unknown as Providers;
    const dependencies: UiDocumentDependencies = { inspectLayout: async (...args) => { layouts++; return passedLayout(...args); } };
    await assert.rejects(buildUiDocumentsCurrent(launchInput, evidence, research, providers, hooks, root, dependencies), error => error instanceof PipelineError && error.code === "insufficient_launch_result" && error.status === "needs_input");
    assert.equal(calls, 1); assert.equal(corrections, 0); assert.equal(layouts, 0); assert.equal(JSON.stringify(raw), original);
    const report = JSON.parse(await readFile(join(root, UI_READINESS_PATH), "utf8"));
    assert.equal(report.status, "stopped"); assert.equal(report.targets[0].terminalResult.ready, false); assert.equal(report.targets[0].responseSha256, stageDigest(raw)); assert.equal(report.targets[0].validation.code, "insufficient_launch_result");
    await assert.rejects(readFile(join(root, UI_LAYOUT_RETRY_PATH)), { code: "ENOENT" });
    await assert.rejects(buildUiDocumentsCurrent(launchInput, evidence, research, providers, hooks, root, dependencies), blocked); assert.equal(calls, 1);
  }
});

test("fresh source-bound insertion persists exact terminal readiness and reuses completed UI without another call", async t => {
  const root = await workspace(t), research = compileResearch(launchInput, evidence, researchRaw(), await evidenceIdentity(launchInput, evidence, root)), doc = launchDocument(); let calls = 0;
  const providers = { ledger: { outputTokens: 1000, reservedOutputTokens: 0 }, claude: async () => { calls++; return currentUiRaw(doc); } } as unknown as Providers;
  const bundle = await buildUiDocuments(launchInput, evidence, research, providers, hooks, root);
  assert.deepEqual(bundle!.documents[0], doc); assert.equal(calls, 1);
  const report = JSON.parse(await readFile(join(root, UI_READINESS_PATH), "utf8"));
  assert.equal(report.status, "ready_for_script"); assert.deepEqual(report.targets[0].terminalResult, { ready: true, issues: [], result: doc.terminalResult });
  assert.deepEqual(await loadUiDocuments(launchInput, evidence, research, root), bundle);
  assert.deepEqual(await buildUiDocuments(launchInput, evidence, research, providers, hooks, root, { inspectLayout: async () => { throw Error("No completed-stage reinspection"); } }), bundle); assert.equal(calls, 1);
});

test("completed legacy launch UI without declaration loads byte-for-byte without new source or layout work", async t => {
  const root = await workspace(t), research = compileResearch(launchInput, evidence, researchRaw(), await evidenceIdentity(launchInput, evidence, root));
  const stage = compileUiDocuments(currentUiRaw(document()), launchInput, evidence, research), binding = stageDigest({ jobId: launchInput.jobId, researchSha256: stageDigest(research), evidenceSha256: research.evidenceSha256 });
  await writeFile(join(root, "analysis/ui.json"), JSON.stringify(stage));
  await writeFile(join(root, "analysis/ui-state.json"), JSON.stringify({ version: 1, stage: "ui", binding, status: "completed", artifactSha256: stageDigest(stage) }));
  const before = await readFile(join(root, "analysis/ui.json"), "utf8");
  const providers = { claude: async () => { throw Error("No historical regeneration"); } } as unknown as Providers;
  const bundle = await buildUiDocumentsCurrent(launchInput, evidence, research, providers, hooks, root, { inspectLayout: async () => { throw Error("No historical reinspection"); } });
  assert.deepEqual(bundle?.documents, stage.documents); assert.equal(await readFile(join(root, "analysis/ui.json"), "utf8"), before);
});


test("retained multi-target research needs one genuine terminal result rather than manufacturing one per document", () => {
  const research = compileResearch(launchInput, evidence, researchRaw(), "a".repeat(64));
  const scoped = { ...research, documentTargets: [...research.documentTargets!, { ...research.documentTargets![0], id: "secondary" }] };
  const other = { ...document(), id: "secondary" };
  const raw = { sufficientEvidence: true, reason: "Retained two-target scope", documents: [launchDocument(), other] };
  assert.deepEqual(compileUiDocuments(raw, launchInput, evidence, scoped, { requireLaunchResult: true }).documents, raw.documents);
  assert.throws(() => compileUiDocuments({ ...raw, documents: [document(), other] }, launchInput, evidence, scoped, { requireLaunchResult: true }), error => error instanceof PipelineError && error.code === "insufficient_launch_result");
});


test("retained two-target launch generation requires the first result and leaves supporting target grammar ordinary", async t => {
  for (const supported of [true, false]) {
    const root = await workspace(t), scoped = twoTargets();
    const rawResearch = researchRaw(); rawResearch.documentTargets = scoped.research.documentTargets!;
    rawResearch.story.mechanism.steps.push({ action: "Explore relationships", evidenceId: "fact-3", assetId: "graph" });
    const research = compileResearch(launchInput, evidence, rawResearch, await evidenceIdentity(launchInput, evidence, root));
    const first = launchDocument(); first.sourceAssetIds = ["editor"]; first.capabilityFactIds = ["fact-2"];
    if (!supported) delete first.terminalResult;
    const documents = [first, scoped.documents[1]], original = JSON.stringify(documents), ledger = { outputTokens: 1000, reservedOutputTokens: 0 };
    let calls = 0, corrections = 0;
    const providers = { ledger, claude: async (_purpose: string, prompt: string, _images: unknown, options: any) => {
      const index = calls++, target = research.documentTargets![index], shape = constrainedUiSchema(options.uiConstraints) as any;
      assert.equal(options.maxOutputTokens, 3000); assert.deepEqual(options.reserve, { calls: index ? 5 : 6, inputTokens: workflowInputReserve(), outputTokens: index ? 16048 : 19048 });
      assert.deepEqual(options.uiConstraints, { targets: [uiDesignConstraints(research).targets[index]], ...(!index ? { requireLaunchResult: true } : {}) });
      assert.equal(!!shape.properties.documentsById.properties[target.id].properties.terminalResult, index === 0);
      assert.equal(prompt.includes("FRESH LAUNCH RESULT REQUIREMENT"), index === 0);
      assert.equal(prompt.includes("document the honest finding or selection step instead"), index === 1);
      ledger.outputTokens += 3000;
      return { ...currentUiRaw(documents[index]), documentsById: { [target.id]: documents[index] } };
    }, prepareClaude: async () => { corrections++; throw Error("No result correction"); } } as unknown as Providers;
    if (supported) {
      const bundle = await buildUiDocuments(launchInput, evidence, research, providers, hooks, root);
      assert.deepEqual(bundle!.documents, documents); assert.equal(calls, 2); assert.equal(ledger.outputTokens, 7000);
      const report = JSON.parse(await readFile(join(root, UI_READINESS_PATH), "utf8"));
      assert.equal(report.status, "ready_for_script"); assert.equal(report.targets[0].terminalResult.ready, true); assert.equal(report.targets[1].terminalResult.ready, false);
    } else {
      await assert.rejects(buildUiDocuments(launchInput, evidence, research, providers, hooks, root), error => error instanceof PipelineError && error.code === "insufficient_launch_result");
      assert.equal(calls, 1); const report = JSON.parse(await readFile(join(root, UI_READINESS_PATH), "utf8")); assert.equal(report.status, "stopped"); assert.equal(report.targets[1].status, "pending");
    }
    assert.equal(corrections, 0); assert.equal(JSON.stringify(documents), original);
  }
});
