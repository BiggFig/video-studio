import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { stageDigest, type Research } from "./research";
import { compileScript, scriptRequest, type Script } from "./scripting";
import type { UiDocument } from "./ui-reconstruction";
import { assertLaunchWorkflowDepth, assertLaunchOutcomeContinuity, inspectLaunchResult, launchResultCopy, launchSequenceInventory, LaunchDepthRejected, LaunchOutcomeRejected, type TerminalResult } from "./workflow-depth";
import { buildWorkflowContext, workflowTaskEvidence } from "./workflow-coherence";
import { gateWorkflowScript, loadWorkflowScript } from "./workflow-stage";
import { PipelineError, type Evidence, type WorkerInput } from "./types";
import type { Providers } from "./providers";
import { sameEffectiveUiState, sameUiClickConfirmationContext } from "./script-ui-behavior";
import { expectedUiState } from "./ui-state";
import { buildShotRecipeCatalog, launchOutcomeRecipeGuidance } from "./shot-recipes";
import { workflowArtifactPaths } from "./workflow-stage";

function fixture(complete = true) {
  const rect = { x: .1, y: .1, width: .8, height: .1 }, source = "source";
  const element = (id: string, type: UiDocument["elements"][number]["type"], text: string, y: number, visible = true) => ({ id, type, text, rect: { ...rect, y }, sourceRect: { ...rect, y }, sourceAssetId: source, styleId: "plain", textBasis: "example-content" as const, initiallyVisible: visible });
  const terminalResult: TerminalResult = { version: 1, beforeStateId: "initial", afterStateId: "completed", confirmationElementId: "choice", resultElementIds: ["result"], evidenceIds: ["fact-1"] };
  const document: UiDocument & { terminalResult: TerminalResult } = { id: "picker", sourceAssetIds: [source], capabilityFactIds: ["fact-1"], viewport: { width: 500, height: 400 }, styles: [{ id: "plain", fill: "#ffffff", color: "#111111", borderColor: "transparent", fontSize: 16, fontWeight: 400, radius: 0 }], elements: [element("label", "text", "Related item", .01), element("query", "input", "", .2), element("choice", "list-item", "Example item", .4), element("result", "text", "Example item added", .2, false)], states: [
    { id: "initial", basis: "observed", sourceAssetId: source, evidenceIds: ["fact-1"], visibleElementIds: ["label", "query", "choice"], selectedElementIds: [], textValues: [] },
    { id: "selected", basis: "illustrative", evidenceIds: ["fact-1"], visibleElementIds: ["label", "query", "choice"], selectedElementIds: ["choice"], textValues: [{ elementId: "query", text: "Example", textBasis: "example-content" }] },
    { id: "completed", basis: "illustrative", evidenceIds: ["fact-1"], visibleElementIds: ["label", "result"], selectedElementIds: [], textValues: [] },
  ], terminalResult };
  const common = { assetId: source, headline: "Add a related item", detail: "", evidenceId: "fact-1", durationSeconds: 6, sourceInSeconds: 0, preserveAudio: false, purpose: "Offline test", referenceTechnique: "Offline test" };
  document.styles.push({ ...document.styles[0], id: "selected", fill: "#dddddd" }); document.elements[2].selectedStyleId = "selected";
  const script = { version: 3, jobId: "depth-fixture", sufficientEvidence: true, reason: "Offline test", product: "Atlas", summary: "Offline test", accent: "#ffffff", background: "dark", musicPrompt: "unused", sfxPrompt: "unused", assumptions: [], researchSha256: "a".repeat(64), evidenceSha256: "b".repeat(64), uiDocuments: [document], scenes: [{ ...common, storyRole: "mechanism", presentation: { template: "proof", theme: "dark", transition: "cut", visual: { kind: "ui-demo", documentId: document.id, actions: [{ kind: "type", atFrame: 30, durationFrames: 12, targetId: "query", text: "Example", evidenceId: "fact-1" }, { kind: "click", atFrame: 50, durationFrames: 8, targetId: "choice", evidenceId: "fact-1" }, { kind: "state", atFrame: 70, durationFrames: 1, stateId: complete ? "completed" : "selected", evidenceId: "fact-1" }] } } }, { ...common, headline: "Keep related ideas together", storyRole: "outcome", presentation: { template: "features", theme: "dark", transition: "cut" } }] } as Script;
  script.uiSha256 = stageDigest({ version: 1, jobId: script.jobId, evidenceSha256: script.evidenceSha256, researchSha256: script.researchSha256, documents: script.uiDocuments });
  return { script, document, ui: { documents: [document], sha256: script.uiSha256 } };
}
const actions = (script: Script) => { const visual = script.scenes[0].presentation!.visual!; if (visual.kind !== "ui-demo") throw new Error("Fixture"); return visual.actions; };
const code = (expected: string) => (error: unknown) => error instanceof PipelineError && error.code === expected;

test("a source-bound noneditable insertion can replace the former query location", () => {
  const f = fixture(); assert.equal(inspectLaunchResult(f.document).ready, true);
  assert.deepEqual(assertLaunchWorkflowDepth(f.script), [{ sceneId: "scene-1", documentId: "picker", confirmationActionId: "action-2", resultActionId: "action-3", result: f.document.terminalResult }]);
});

test("completed UI source pixels cannot become a later outcome, result or payoff proof", () => {
  for (const variant of ["showcase", "focus", "secondary-panel", "result", "payoff"] as const) {
    const f = fixture(), scene = f.script.scenes[1];
    scene.presentation = { template: "proof", theme: "dark", transition: "cut", visual: variant === "focus" ? { kind: "focus", regionId: "known", region: { x: 0, y: 0, width: 1, height: 1 } } : variant === "secondary-panel" ? { kind: "panels", secondaryAssetId: "source", secondaryEvidenceId: "fact-1" } : { kind: "showcase" } };
    if (variant === "secondary-panel") scene.assetId = "different";
    if (variant === "result" || variant === "payoff") { scene.storyRole = "differentiator"; scene.direction = { version: 1, job: variant, motion: "hold", continuityKey: "source" }; }
    const before = JSON.stringify(f.script);
    assert.throws(() => assertLaunchOutcomeContinuity(f.script), error => {
      assert.ok(error instanceof LaunchOutcomeRejected);
      assert.deepEqual(error.diagnostics.issues, [{ sceneId: "scene-2", completedSceneId: "scene-1", documentId: "picker", sourceAssetIds: ["source"], code: "outcome_reuses_preworkflow_source" }]);
      return true;
    });
    assert.equal(JSON.stringify(f.script), before);
  }
});

test("editorial outcomes and different supported proof do not rewind the completed UI", () => {
  const editorial = fixture(); assert.equal(assertLaunchOutcomeContinuity(editorial.script).completedWorkflows.length, 1);
  const different = fixture(); different.script.scenes[1].assetId = "different";
  different.script.scenes[1].presentation = { template: "proof", theme: "dark", transition: "cut", visual: { kind: "showcase" } };
  assert.equal(assertLaunchOutcomeContinuity(different.script).completedWorkflows.length, 1);
  const before = fixture(); before.script.scenes[1].presentation = { template: "proof", theme: "dark", transition: "cut", visual: { kind: "showcase" } };
  before.script.scenes.reverse(); assert.equal(assertLaunchOutcomeContinuity(before.script).completedWorkflows.length, 1);
});

test("a differently named before-state retains exact context beyond optional clicked-control colors", () => {
  for (const variant of ["no-selected-style", "identical-selected-style", "styled", "query", "basis", "hidden-label"] as const) {
    const f = fixture(), declared = f.document.states[1]; f.document.terminalResult.beforeStateId = declared.id;
    if (variant === "identical-selected-style") f.document.styles[1] = { ...f.document.styles[0], id: "selected" };
    else if (variant !== "styled") delete f.document.elements[2].selectedStyleId;
    if (variant === "styled") { f.document.elements[0].selectedStyleId = "selected"; declared.selectedElementIds.push("label"); }
    if (variant === "query") declared.textValues[0].text = "Different query";
    if (variant === "basis") declared.textValues[0].textBasis = "source-ui";
    if (variant === "hidden-label") declared.visibleElementIds = declared.visibleElementIds.filter(id => id !== "label");
    if (variant === "no-selected-style" || variant === "identical-selected-style") assert.equal(assertLaunchWorkflowDepth(f.script).length, 1, variant);
    else assert.throws(() => assertLaunchWorkflowDepth(f.script), LaunchDepthRejected, variant);
  }
  // Authored typing under the documented ID retains the pre-existing contract.
  assert.equal(assertLaunchWorkflowDepth(fixture().script).length, 1);
});

test("an optional clicked-control prehighlight cannot hide font, clipping, reverse selection or context changes", () => {
  const f = fixture(), initial = expectedUiState(f.document, [], 0), declared = structuredClone(initial);
  declared.stateId = "hover"; declared.elements.choice.selected = true;
  assert.equal(sameUiClickConfirmationContext(f.document, initial, declared, "choice"), true);
  assert.equal(sameUiClickConfirmationContext(f.document, declared, initial, "choice"), false, "Only absent prehighlight is optional");
  for (const field of ["fontSize", "fontWeight", "radius"] as const) {
    const doc = structuredClone(f.document); doc.styles[1][field] += field === "fontWeight" ? 100 : 1;
    assert.equal(sameUiClickConfirmationContext(doc, initial, declared, "choice"), false, field);
  }
  for (const variant of ["text", "basis", "hidden", "caret", "other-selection"] as const) {
    const other = structuredClone(declared), doc = structuredClone(f.document);
    if (variant === "text") other.elements.choice.text = "Different item";
    if (variant === "basis") other.elements.choice.textBasis = "source-ui";
    if (variant === "hidden") other.elements.choice.visible = false;
    if (variant === "caret") other.elements.choice.typing = true;
    if (variant === "other-selection") { doc.elements[0].selectedStyleId = "selected"; other.elements.label.selected = true; }
    assert.equal(sameUiClickConfirmationContext(doc, initial, other, "choice"), false, variant);
  }
});

test("a genuine before-context mismatch reports exact IDs and only a permitted visible state step", () => {
  const f = fixture(); f.document.terminalResult.beforeStateId = "selected";
  f.document.states[1].textValues.push({ elementId: "label", text: "Choose the related item", textBasis: "example-content" });
  assert.throws(() => assertLaunchWorkflowDepth(f.script), error => {
    assert.ok(error instanceof LaunchDepthRejected);
    const [issue] = error.diagnostics.sequenceIssues;
    assert.equal(issue.code, "before_state_mismatch"); assert.equal(issue.sceneId, "scene-1");
    assert.deepEqual(issue.declaration, f.document.terminalResult);
    assert.equal(issue.actualPreconfirmationStateId, "initial"); assert.equal(issue.confirmationActionId, "action-2");
    assert.ok(issue.mismatchedElementIds!.includes("label"));
    assert.deepEqual(issue.permittedMissingStep, { kind: "state", stateId: "selected", evidenceId: "fact-1", insertBeforeActionId: "action-2", reason: "documented_visible_state_change" });
    return true;
  });
});

test("equivalence ignores pointer and hidden values but retains visible provenance and caret", () => {
  const f = fixture(), initial = expectedUiState(f.document, [], 0), candidate = structuredClone(initial);
  candidate.stateId = "other-name"; candidate.pointer = { visible: true, x: .4, y: .8, clickProgress: 1 };
  candidate.elements.result.text = "Hidden value"; candidate.elements.result.textBasis = "source-ui";
  assert.equal(sameEffectiveUiState(f.document, initial, candidate, { includeTextBasis: true }), true);
  candidate.elements.query.typing = true;
  assert.equal(sameEffectiveUiState(f.document, initial, candidate, { includeTextBasis: true }), false);
  candidate.elements.query.typing = false; candidate.elements.query.textBasis = "source-ui";
  assert.equal(sameEffectiveUiState(f.document, initial, candidate, { includeTextBasis: true }), false);
  candidate.elements.query.textBasis = initial.elements.query.textBasis; candidate.elements.choice.visible = false;
  assert.equal(sameEffectiveUiState(f.document, initial, candidate, { includeTextBasis: true }), false);
});

test("transparent text with a different clamped clipping radius is not an equivalent before-state", () => {
  const f = fixture(); f.document.terminalResult.beforeStateId = "selected";
  f.document.styles[0].fill = "transparent"; f.document.styles[0].borderColor = "transparent";
  f.document.styles[1] = { ...f.document.styles[0], id: "selected", radius: 12 };
  assert.throws(() => assertLaunchWorkflowDepth(f.script), LaunchDepthRejected);
  // CSS clamps oversized values to the same actual half-height radius.
  f.document.styles[0].radius = 100; f.document.styles[1].radius = 1000;
  assert.equal(assertLaunchWorkflowDepth(f.script).length, 1);
});

test("terminal result reading copy includes observed text as well as illustrative text", () => {
  const f = fixture();
  for (const textBasis of ["source-ui", "example-content"] as const) { f.document.elements[3].textBasis = textBasis; assert.deepEqual(launchResultCopy(f.document), ["Example item added"]); }
});

test("selection-only is an honest semantic task but insufficient launch demonstration depth", () => {
  const f = fixture(false), before = JSON.stringify(f.script);
  assert.throws(() => assertLaunchWorkflowDepth(f.script), LaunchDepthRejected);
  assert.equal(workflowTaskEvidence(buildWorkflowContext(f.script))[0].observableExtent, "selection-only");
  assert.equal(JSON.stringify(f.script), before);
});

test("query values, clear-only, selectable labels and punctuation do not become launch results", () => {
  for (const kind of ["input", "textarea", "list-item", "clear", "punctuation", "nested", "already-visible"] as const) {
    const f = fixture(), result = f.document.elements.find(element => element.id === "result")!;
    if (["input", "textarea", "list-item"].includes(kind)) result.type = kind as typeof result.type;
    if (kind === "clear") result.text = "";
    if (kind === "nested") { f.document.states[2].visibleElementIds.push("choice"); result.rect = { ...f.document.elements[2].rect }; }
    if (kind === "punctuation" || kind === "already-visible") { f.document.states[0].visibleElementIds.push("result"); result.initiallyVisible = true; f.document.states[2].textValues.push({ elementId: "result", text: kind === "punctuation" ? "[[Example item added]]" : result.text, textBasis: "example-content" }); }
    assert.equal(inspectLaunchResult(f.document).ready, false, kind);
    assert.throws(() => assertLaunchWorkflowDepth(f.script), code("insufficient_launch_result"), kind);
  }
});

test("missing/source-mismatched declarations fail readiness instead of manufacturing a verdict", () => {
  for (const variant of ["missing", "evidence", "target", "state", "source"] as const) {
    const f = fixture();
    if (variant === "missing") delete (f.document as { terminalResult?: TerminalResult }).terminalResult;
    if (variant === "evidence") f.document.terminalResult.evidenceIds = ["not-documented"];
    if (variant === "target") f.document.terminalResult.confirmationElementId = "query";
    if (variant === "state") f.document.terminalResult.beforeStateId = "absent";
    if (variant === "source") f.document.elements[3].sourceAssetId = "other-source";
    assert.equal(inspectLaunchResult(f.document).ready, false, variant);
  }
});

test("actual confirmation, changed value and exact terminal persistence are mandatory", () => {
  for (const variant of ["pointer", "wrong-target", "wrong-evidence", "result-before-click", "leave-terminal", "type-after-confirm"] as const) {
    const f = fixture(), list = actions(f.script);
    if (variant === "pointer") list[1].kind = "pointer";
    if (variant === "wrong-target") list[1].targetId = "query";
    if (variant === "wrong-evidence") list[2].evidenceId = "fact-other";
    if (variant === "result-before-click") { list[1] = { kind: "state", atFrame: 50, durationFrames: 1, stateId: "completed", evidenceId: "fact-1" }; list[2] = { kind: "click", atFrame: 70, durationFrames: 6, targetId: "choice", evidenceId: "fact-1" }; }
    if (variant === "leave-terminal") { f.document.states.push({ ...f.document.states[2], id: "reopened" }); list.push({ kind: "state", atFrame: 90, durationFrames: 1, stateId: "reopened", evidenceId: "fact-1" }); }
    if (variant === "type-after-confirm") list.splice(2, 0, { kind: "type", atFrame: 59, durationFrames: 12, targetId: "query", text: "Other", evidenceId: "fact-1" });
    assert.throws(() => assertLaunchWorkflowDepth(f.script), LaunchDepthRejected, variant);
  }
});

async function workspace(t: TestContext) {
  const prefix = join(tmpdir(), "workflow-depth-"), path = await mkdtemp(prefix); await mkdir(join(path, "analysis"));
  t.after(async () => { if (dirname(resolve(path)) !== resolve(tmpdir()) || !path.startsWith(prefix)) throw Error("Unsafe cleanup"); await rm(path, { recursive: true, force: true }); }); return path;
}
const input: WorkerInput = { jobId: "depth-fixture", ownerId: "fixture", mode: "url", productUrl: "https://example.com", videoType: "launch", format: "16:9", files: [] };
const ledger = { modelCalls: 0, inputTokens: 0, outputTokens: 0, reservedInputTokens: 0, reservedOutputTokens: 0 };
const hooks = { persist: async () => {} }, reserve = { calls: 1, inputTokens: 0, outputTokens: 3000 };

test("depth rejection precedes semantic preflight, model spending and workflow reservation", async t => {
  const f = fixture(false), path = await workspace(t); let calls = 0;
  const providers = { ledger, prepareClaude: async () => { calls++; throw Error("No paid work permitted"); } } as unknown as Providers;
  await assert.rejects(gateWorkflowScript(f.script, { input, workspace: path, ui: f.ui, hooks, providers, reserve }), LaunchDepthRejected);
  assert.equal(calls, 0); assert.deepEqual(await readdir(join(path, "analysis")), []);
});

test("outcome continuity rejection precedes semantic preflight and review reservation", async t => {
  const f = fixture(), path = await workspace(t); let calls = 0;
  f.script.scenes[1].presentation = { template: "proof", theme: "dark", transition: "cut", visual: { kind: "showcase" } };
  const providers = { ledger, prepareClaude: async () => { calls++; throw Error("No paid work permitted"); } } as unknown as Providers;
  await assert.rejects(gateWorkflowScript(f.script, { input, workspace: path, ui: f.ui, hooks, providers, reserve }), LaunchOutcomeRejected);
  assert.equal(calls, 0); assert.deepEqual(await readdir(join(path, "analysis")), []);
});

test("new approvals bind launch requirement and exact result; flag stripping and changed states cannot load", async t => {
  const f = fixture(), path = await workspace(t), context = buildWorkflowContext(f.script, f.ui);
  const providers = { ledger, prepareClaude: async () => async () => ({ contextSha256: context.sha256, assessments: context.obligations!.map(obligation => ({ obligationId: obligation.id, status: "supported", reason: "Mocked verdict only; this test measures durable binding." })), taskEntitlementVersion: 1, tasks: workflowTaskEvidence(context).map(scene => ({ sceneId: scene.sceneId, promiseExcerpt: scene.promiseCopy[0], requiredResult: "committed-change", resultAnswer: "visible-result", postconditionIds: scene.postconditions.map(result => result.id) })) }) } as unknown as Providers;
  const approved = await gateWorkflowScript(f.script, { input, workspace: path, ui: f.ui, hooks, providers, reserve });
  assert.equal(approved.workflowCoherence!.requireLaunchResult, true);
  assert.equal(approved.workflowCoherence!.requireOutcomeContinuity, true);
  assert.deepEqual(await loadWorkflowScript(approved.workflowCoherence!, path), approved);
  const stripped = { ...approved.workflowCoherence! }; delete stripped.requireLaunchResult;
  await assert.rejects(loadWorkflowScript(stripped, path), code("production_stage_changed"));
  const strippedContinuity = { ...approved.workflowCoherence! }; delete strippedContinuity.requireOutcomeContinuity;
  await assert.rejects(loadWorkflowScript(strippedContinuity, path), code("production_stage_changed"));
});

test("retained k raw response is rejected only by the new continuity contract; old proof and catalogue stay unchanged", { skip: process.env.STUDIO_WORKFLOW_RETAINED_TEST !== "1" }, async () => {
  const root = join(process.cwd(), ".local/engine-batch-acceptance-20261002k"), paths = ["acceptance-provenance.json", "analysis/evidence.json", "analysis/research.json", "analysis/ui.json", "analysis/model-4-script.json", "analysis/script.json", "analysis/shot-recipes.json"];
  const bytes = await Promise.all(paths.map(path => readFile(join(root, path)))), values = bytes.map(value => JSON.parse(value.toString()));
  const input = values[0].input as WorkerInput, evidence = values[1] as Evidence, research = values[2] as Research, ui = { documents: values[3].documents as UiDocument[], sha256: stageDigest(values[3]) };
  const script = compileScript(values[4], input, evidence, research, undefined, ui, { requireDirection: true, requireRecipes: true, maxScenes: 6 });
  assert.equal(assertLaunchWorkflowDepth(script, ui).length, 1);
  assert.throws(() => assertLaunchOutcomeContinuity(script, ui), error => {
    assert.ok(error instanceof LaunchOutcomeRejected);
    assert.deepEqual(error.diagnostics.issues, [{ sceneId: "scene-4", completedSceneId: "scene-3", documentId: "wikilink-autocomplete", sourceAssetIds: ["product-panel-0"], code: "outcome_reuses_preworkflow_source" }]); return true;
  });
  const catalog = buildShotRecipeCatalog(research, evidence, ui), originalCatalog = JSON.stringify(catalog);
  assert.deepEqual(catalog, values[6]);
  const guidance = launchOutcomeRecipeGuidance(catalog, ui);
  assert.ok(guidance.rawProofRestrictions.some(value => value.cannotFollowCompletedDocumentIds.includes("wikilink-autocomplete")));
  assert.equal(JSON.stringify(catalog), originalCatalog);
  const editorial = structuredClone(values[4]), replacement = catalog.recipes.find(recipe => recipe.storyRole === "outcome" && recipe.template === "features" && recipe.evidenceId === script.scenes[3].evidenceId);
  assert.ok(replacement, "The immutable catalogue already offers a grounded editorial outcome");
  editorial.scenes[3].recipeId = replacement.id;
  const manualControl = compileScript(editorial, input, evidence, research, undefined, ui, { requireDirection: true, requireRecipes: true, maxScenes: 6 });
  assert.equal(assertLaunchOutcomeContinuity(manualControl, ui).completedWorkflows.length, 1);
  const saved = values[5] as Script; assert.equal(saved.workflowCoherence!.requireOutcomeContinuity, undefined);
  const proofPaths = workflowArtifactPaths(saved.workflowCoherence!), proofBytes = await Promise.all(proofPaths.map(path => readFile(join(root, path))));
  assert.deepEqual(await loadWorkflowScript(saved.workflowCoherence!, root), saved);
  for (const [index, path] of paths.entries()) assert.deepEqual(await readFile(join(root, path)), bytes[index]);
  for (const [index, path] of proofPaths.entries()) assert.deepEqual(await readFile(join(root, path)), proofBytes[index]);
});

test("retained h remains selection-only; actual insertion control meets only structural depth", { skip: process.env.STUDIO_WORKFLOW_RETAINED_TEST !== "1" }, async () => {
  const hPath = join(process.cwd(), ".local/engine-batch-acceptance-20261002h/analysis/script.json"), hBytes = await readFile(hPath), h = JSON.parse(hBytes.toString()) as Script;
  assert.throws(() => assertLaunchWorkflowDepth(h), code("insufficient_launch_result"));
  const controlPath = join(process.cwd(), ".local/workflow-obligations-20261002b/cases/02-obsidian-correct-attribution/script.json"), bytes = await readFile(controlPath), control = JSON.parse(bytes.toString()) as Script;
  const doc = control.uiDocuments!.find(document => document.elements.some(element => element.id === "result-text"))!;
  assert.ok(doc); doc.terminalResult = { version: 1, beforeStateId: doc.states[0].id, afterStateId: "state-link-created", confirmationElementId: "item-1", resultElementIds: ["result-text"], evidenceIds: ["fact-10"] };
  assert.equal(inspectLaunchResult(doc).ready, true); assert.ok(assertLaunchWorkflowDepth(control).length);
  assert.deepEqual(await readFile(hPath), hBytes); assert.deepEqual(await readFile(controlPath), bytes);
});

test("unchanged trial i initial and corrected responses compile and reach their equivalent-before terminal result", { skip: process.env.STUDIO_WORKFLOW_RETAINED_TEST !== "1" }, async () => {
  const root = join(process.cwd(), ".local/engine-batch-acceptance-20261002i"), paths = ["acceptance-provenance.json", "analysis/evidence.json", "analysis/research.json", "analysis/ui.json", "analysis/model-3-script.json", "analysis/model-4-script.json"];
  const bytes = await Promise.all(paths.map(path => readFile(join(root, path)))), values = bytes.map(value => JSON.parse(value.toString()));
  const input = values[0].input as WorkerInput, evidence = values[1] as Evidence, research = values[2] as Research, stage = values[3], ui = { documents: stage.documents as UiDocument[], sha256: stageDigest(stage) };
  for (const raw of values.slice(4)) {
    const script = compileScript(raw, input, evidence, research, undefined, ui, { requireDirection: true, requireRecipes: true, maxScenes: 6 });
    const demonstrated = assertLaunchWorkflowDepth(script, ui); assert.equal(demonstrated.length, 1);
    const result = demonstrated[0], doc = ui.documents.find(document => document.id === result.documentId)!;
    const scene = script.scenes[Number(result.sceneId.split("-")[1]) - 1], visual = scene.presentation!.visual!;
    assert.equal(visual.kind, "ui-demo"); if (visual.kind !== "ui-demo") throw Error("Fixture UI missing");
    const confirmation = Number(result.confirmationActionId.split("-")[1]) - 1, action = visual.actions[confirmation];
    const before = expectedUiState(doc, visual.actions.slice(0, confirmation), action.atFrame);
    assert.notEqual(before.stateId, doc.terminalResult!.beforeStateId);
    const declared = expectedUiState(doc, [{ kind: "state", atFrame: 0, durationFrames: 1, stateId: doc.terminalResult!.beforeStateId, evidenceId: doc.capabilityFactIds[0] }], 1);
    assert.equal(sameEffectiveUiState(doc, before, declared, { includeTextBasis: true }), true);
    assert.equal(result.result.afterStateId, "state-completed");
  }
  for (const [index, path] of paths.entries()) assert.deepEqual(await readFile(join(root, path)), bytes[index]);
});

test("trial j direct click and a labelled manual hover control reach the same result; missing-outcome correction stays invalid", { skip: process.env.STUDIO_WORKFLOW_RETAINED_TEST !== "1" }, async () => {
  const root = join(process.cwd(), ".local/engine-batch-acceptance-20261002j"), paths = ["acceptance-provenance.json", "analysis/evidence.json", "analysis/research.json", "analysis/ui.json", "analysis/model-3-script.json", "analysis/model-4-script.json"];
  const bytes = await Promise.all(paths.map(path => readFile(join(root, path)))), values = bytes.map(value => JSON.parse(value.toString()));
  const input = values[0].input as WorkerInput, evidence = values[1] as Evidence, research = values[2] as Research, stage = values[3], ui = { documents: stage.documents as UiDocument[], sha256: stageDigest(stage) };
  const options = { requireDirection: true, requireRecipes: true, maxScenes: 6 };
  const original = compileScript(values[4], input, evidence, research, undefined, ui, options), result = assertLaunchWorkflowDepth(original, ui);
  assert.equal(result.length, 1); assert.equal(result[0].result.afterStateId, "state-result");
  const inventory = launchSequenceInventory(ui.documents); assert.equal(inventory[0].initialContextAllowsDirectClick, true);
  const prompt = scriptRequest(input, evidence, research, undefined, ui, true, true);
  assert.ok(prompt.startsWith("MANDATORY LAUNCH SEQUENCE:")); assert.ok(prompt.indexOf('"beforeStateId":"state-hover"') < prompt.indexOf("Write the on-screen script"));
  // Explicitly authored offline control only: never overwrite either provider response.
  const manual = structuredClone(values[4]), scene = manual.scenes.find((scene: any) => scene.presentation.actions.some((action: any) => action.kind === "click")), actions = scene.presentation.actions, clickIndex = actions.findIndex((action: any) => action.kind === "click"), atFrame = actions[clickIndex].atFrame;
  for (const action of actions.slice(clickIndex)) action.atFrame += 1;
  actions.splice(clickIndex, 0, { kind: "state", stateId: "state-hover", targetId: "", text: "", atFrame, durationFrames: 1, evidenceId: "fact-10" });
  assert.equal(assertLaunchWorkflowDepth(compileScript(manual, input, evidence, research, undefined, ui, options), ui).length, 1);
  assert.throws(() => compileScript(values[5], input, evidence, research, undefined, ui, options), /distinct result or payoff job/);
  for (const [index, path] of paths.entries()) assert.deepEqual(await readFile(join(root, path)), bytes[index]);
});
