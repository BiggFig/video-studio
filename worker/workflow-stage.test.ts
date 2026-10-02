import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { compileResearch, sourceFacts, stageDigest } from "./research";
import { compileUiDocuments, type UiDocument } from "./ui-reconstruction";
import { compileScript, prepareScriptRepair, scriptBinding, validateScript, writeScript } from "./scripting";
import { compilePlan } from "./planning";
import { compileScriptWithRetry, SCRIPT_RETRY_PATH, SCRIPT_REJECTION_PATH } from "./script-review";
import { buildShotRecipeCatalog, RECIPE_SCRIPT_TRANSPORT_VERSION } from "./shot-recipes";
import { buildWorkflowContext, parseWorkflowVerdict, workflowTaskEvidence, type WorkflowContext } from "./workflow-coherence";
import { assertWorkflowUnstarted, gateWorkflowScript, loadWorkflowScript, validatePlanWorkflowCoherence, verifyScriptWorkflowBinding, workflowArtifactPaths, WorkflowCoherenceRejected } from "./workflow-stage";
import { PipelineError, type Evidence, type Hooks, type WorkerInput } from "./types";
import type { Providers } from "./providers";
import { motionTimingForPresentation } from "./motion-timing";

const input: WorkerInput = { jobId: "workflow-fixture", ownerId: "fixture", mode: "url", productUrl: "https://example.com/", videoType: "feature-demo", format: "16:9", files: [], budgets: { maxModelCalls: 10, maxModelInputTokens: 200000, maxModelOutputTokens: 30000 } };
const evidence: Evidence = { text: "Notes for writers.\n\nEdit notes.\n\nOrganize ideas.\n\nDownload Atlas.", assets: [{ id: "editor", kind: "image", usage: "output", path: "assets/editor.png", width: 1000, height: 600, rights: "Fixture source" }] };
const hooks: Hooks = { state: async () => {}, persist: async () => {}, complete: async () => {} };
const rect = { x: .1, y: .1, width: .8, height: .8 };
function fixture(launchResult = false) {
  const claim = (text: string, id: string) => ({ text, basis: "explicit", evidenceIds: [id] });
  const research = compileResearch(input, evidence, { sufficientEvidence: true, reason: "Visible editor", product: "Atlas", summary: "Editable notes", facts: sourceFacts(evidence).map(fact => ({ evidenceId: fact.id, kind: "feature", label: fact.text })), visuals: [{ assetId: "editor", role: "product_ui", showsProductUi: true, description: "Actual editor", supportsFactIds: ["fact-2", "fact-3"] }], story: { primaryAudience: claim("writers", "fact-1"), problem: null, mechanism: { ...claim("Edit notes", "fact-2"), steps: [{ action: "Edit notes", evidenceId: "fact-2", assetId: "editor" }] }, outcome: claim("Organize ideas", "fact-3"), differentiator: null, cta: claim("Download Atlas", "fact-4") }, documentTargets: [{ id: "notes", sourceAssetIds: ["editor"], capabilityFactIds: ["fact-2"], goal: "Edit one note" }], limitations: [] }, "a".repeat(64));
  const document: UiDocument = { id: "notes", sourceAssetIds: ["editor"], capabilityFactIds: ["fact-2"], viewport: { width: 1000, height: 600 }, styles: [{ id: "body", fill: "#ffffff", color: "#111111", borderColor: "#dddddd", fontSize: 18, fontWeight: 400, radius: 8 }], elements: [{ id: "note", type: "textarea", rect, sourceRect: rect, sourceAssetId: "editor", styleId: "body", text: "Draft", textBasis: "source-ui", initiallyVisible: true }], states: [{ id: "editing", basis: "observed", sourceAssetId: "editor", evidenceIds: ["fact-2"], visibleElementIds: ["note"], selectedElementIds: [], textValues: [] }] };
  if (launchResult) {
    const base = document.elements[0];
    document.elements.push({ ...base, id: "apply", type: "button", text: "Apply", rect: { x: .1, y: .9, width: .2, height: .08 }, sourceRect: { x: .1, y: .9, width: .2, height: .08 } }, { ...base, id: "result", type: "text", initiallyVisible: false, text: "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty" });
    document.states[0].visibleElementIds.push("apply");
    document.states.push({ id: "completed", basis: "observed", sourceAssetId: "editor", evidenceIds: ["fact-2"], visibleElementIds: ["result"], selectedElementIds: [], textValues: [] });
    document.terminalResult = { version: 1, beforeStateId: "editing", afterStateId: "completed", confirmationElementId: "apply", resultElementIds: ["result"], evidenceIds: ["fact-2"] };
  }
  const stage = compileUiDocuments({ sufficientEvidence: true, reason: "Observed", documents: [document] }, input, evidence, research), ui = { documents: stage.documents, sha256: stageDigest(stage) };
  const catalog = buildShotRecipeCatalog(research, evidence, ui);
  const combinations = [
    ["product", "fact-2", "brand", "none", "Atlas", "context", "reveal"],
    ["mechanism", "fact-2", "proof", "ui-demo", "Edit a note", "action", "focus"],
    ["outcome", "fact-3", "features", "none", "Organize ideas", "result", "hold"],
    ["cta", "fact-4", "cta", "none", "Download", "cta", "hold"],
  ];
  const raw = { transportVersion: RECIPE_SCRIPT_TRANSPORT_VERSION, sufficientEvidence: true, reason: "Source supported", product: "Atlas", summary: "A concise note workflow", accent: "#444444", background: "light", musicPrompt: "Restrained original instrumental texture", sfxPrompt: "A soft interface accent", assumptions: [], creativeDirection: { concept: "focus", evidenceId: "fact-2" }, scenes: combinations.map(([role, fact, template, visual, headline, job, motion]) => {
    const recipe = catalog.recipes.find(recipe => recipe.storyRole === role && recipe.evidenceId === fact && recipe.template === template && recipe.visual.kind === visual); assert.ok(recipe);
    return { recipeId: recipe.id, headline, detail: "", durationSeconds: 5, sourceInSeconds: 0, preserveAudio: false, purpose: "Grounded beat", referenceTechnique: "Supported motion", direction: { job, motion }, presentation: { theme: "light", transition: "cut", cards: [], nodes: [], actions: visual === "ui-demo" ? [{ kind: "type", atFrame: 30, durationFrames: 60, targetId: "note", stateId: "", text: "New note", evidenceId: "fact-2" }] : [] } };
  }) };
  if (launchResult) raw.scenes[1].presentation.actions.push({ kind: "click", atFrame: 100, durationFrames: 6, targetId: "apply", stateId: "", text: "", evidenceId: "fact-2" }, { kind: "state", atFrame: 110, durationFrames: 1, stateId: "completed", targetId: "", text: "", evidenceId: "fact-2" });
  return { research, ui, raw, script: compileScript(raw, input, evidence, research, undefined, ui, { requireDirection: true, requireRecipes: true }) };
}
async function setup(t: TestContext) {
  const prefix = join(tmpdir(), "workflow-stage-"), workspace = await mkdtemp(prefix); await mkdir(join(workspace, "analysis"));
  t.after(async () => { if (dirname(resolve(workspace)) !== resolve(tmpdir()) || !workspace.startsWith(prefix)) throw new Error("Unsafe fixture cleanup"); await rm(workspace, { recursive: true, force: true }); });
  const events: string[] = [], ledger = { modelCalls: 3, inputTokens: 25000, outputTokens: 5000, reservedInputTokens: 0, reservedOutputTokens: 0 };
  return { workspace, events, ledger, hooks: { ...hooks, persist: async (paths: string[]) => { events.push(...paths); } } };
}
const taskAnswers = (context: WorkflowContext) => ({ taskEntitlementVersion: 1, tasks: workflowTaskEvidence(context).map(scene => ({ sceneId: scene.sceneId, promiseExcerpt: scene.promiseCopy[0], requiredResult: "query", resultAnswer: "visible-result", postconditionIds: [] })) });
function verdict(context: WorkflowContext, passed = true) {
  if (context.version === 2) return { ...taskAnswers(context), contextSha256: context.sha256, assessments: context.obligations!.map((obligation, index) => ({ obligationId: obligation.id, status: !passed && index === 0 ? "contradictory" : "supported", reason: !passed && index === 0 ? "The fixture result does not support its stated completion." : "The documented edit supports this fixture's visible task and context." })) };
  return { contextSha256: context.sha256, scenes: context.scenes.map(scene => ({ sceneId: scene.sceneId, passed })), findings: passed ? [] : [{ severity: "major", sceneId: context.scenes[0].sceneId, actionId: "final", elementIds: ["note"], code: "context_contradiction", message: "The visible result does not support the stated completion." }] };
}
const qc = { calls: 2, inputTokens: 0, outputTokens: 6000 };
const blocked = (error: unknown) => error instanceof PipelineError && error.code === "production_stage_changed";

test("launch omission uses only the existing script correction before semantic review and keeps its result hold", async t => {
  const f = fixture(true), w = await setup(t), launch = { ...input, videoType: "launch" as const }, raw = structuredClone(f.raw);
  raw.scenes[1].presentation.actions.splice(1);
  let corrections = 0, reviews = 0;
  const context = buildWorkflowContext(f.script, f.ui);
  const providers = { ledger: w.ledger, prepareClaude: async (purpose: string, prompt: string) => {
    if (purpose === "script") { assert.ok(prompt.startsWith("LAUNCH SEQUENCE CORRECTION:")); assert.match(prompt, /declared_terminal_result_not_demonstrated/); assert.ok(prompt.indexOf('"afterStateId":"completed"') < prompt.indexOf("Immutable source")); assert.match(prompt, /required outcome scene with result\/payoff direction/); return async () => { corrections++; return f.raw; }; }
    return async () => { reviews++; return verdict(context); };
  } } as unknown as Providers;
  const options = { ...w, input: launch, evidence, research: f.research, providers, prompt: "Immutable source", ui: f.ui, directed: true, recipes: true, workflow: true as const };
  const approved = await compileScriptWithRetry(raw, options);
  assert.equal(corrections, 1); assert.equal(reviews, 1); assert.equal(approved.workflowCoherence!.requireLaunchResult, true);
  const diagnostic = JSON.parse(await readFile(join(w.workspace, SCRIPT_REJECTION_PATH), "utf8"));
  assert.equal(diagnostic.diagnostics.launchDepth.code, "declared_terminal_result_not_demonstrated"); assert.equal(diagnostic.diagnostics.workflow, undefined);
  const plan = await compilePlan(launch, evidence, approved, w.hooks, w.workspace), scene = plan.scenes[1], motion = motionTimingForPresentation(scene.presentation!, false);
  assert.ok(scene.duration_frames >= 228 + motion.entryFrames + motion.exitFrames, "Observed 20-word result retains its full reading hold after camera settlement");
  await validatePlanWorkflowCoherence(plan, w.workspace);
  // Two authored input words plus twenty source-ui result words use the same
  // deduplicated copy and frame formula on compilation and restoration.
  const minimum = Math.ceil(((22 * 32 + 120) * 30) / 100) + motion.entryFrames + motion.exitFrames;
  assert.equal(scene.duration_frames, minimum);
  for (const delta of [0, 30, -1]) {
    const restored = structuredClone(plan); restored.scenes[1].duration_frames = minimum + delta;
    let frame = 0; for (const shot of restored.scenes) { shot.start_frame = frame; frame += shot.duration_frames; } restored.output.duration_frames = frame;
    if (delta < 0) await assert.rejects(validatePlanWorkflowCoherence(restored, w.workspace), /complete reading hold after camera settlement/);
    else await validatePlanWorkflowCoherence(restored, w.workspace);
  }
  const stripped = structuredClone(approved); delete stripped.workflowCoherence!.requireLaunchResult;
  await assert.rejects(compilePlan(launch, evidence, stripped, w.hooks, w.workspace, { plan, findings: [] }), /launch-result requirement/);
  await assert.rejects(compileScriptWithRetry(raw, options), blocked); assert.equal(corrections, 1); assert.equal(reviews, 1);
});

test("a missing immutable launch result spends neither script correction nor semantic review", async t => {
  const f = fixture(), w = await setup(t); let calls = 0;
  const providers = { ledger: w.ledger, prepareClaude: async () => { calls++; throw Error("No provider work"); } } as unknown as Providers;
  await assert.rejects(compileScriptWithRetry(f.raw, { ...w, input: { ...input, videoType: "launch" }, evidence, research: f.research, providers, prompt: "Immutable source", ui: f.ui, directed: true, recipes: true, workflow: true }), error => error instanceof PipelineError && error.code === "insufficient_launch_result");
  assert.equal(calls, 0); await assert.rejects(readFile(join(w.workspace, SCRIPT_RETRY_PATH)), { code: "ENOENT" });
});

test("unsupported generated speed qualifiers use one correction and are checked before semantic review", async t => {
  for (const fixed of [true, false]) {
    const f = fixture(), w = await setup(t), bad = structuredClone(f.raw); bad.scenes[1].headline = "Edit a note instantly";
    let corrections = 0, reviews = 0;
    const providers = { ledger: w.ledger, prepareClaude: async (purpose: string, prompt: string) => {
      if (purpose === "script") { assert.match(prompt, /speedQualifierIssues/); assert.match(prompt, /unsupported_source_speed_qualifier/); return async () => { corrections++; return fixed ? f.raw : bad; }; }
      return async () => { reviews++; return verdict(buildWorkflowContext(f.script, f.ui)); };
    } } as unknown as Providers;
    const options = { ...w, input, evidence, research: f.research, providers, prompt: "Immutable source", ui: f.ui, directed: true, recipes: true, workflow: true as const };
    if (fixed) await compileScriptWithRetry(bad, options);
    else await assert.rejects(compileScriptWithRetry(bad, options), error => error instanceof PipelineError && error.code === "invalid_generated_script");
    assert.equal(corrections, 1); assert.equal(reviews, fixed ? 1 : 0);
    const diagnostic = JSON.parse(await readFile(join(w.workspace, SCRIPT_REJECTION_PATH), "utf8"));
    assert.ok(diagnostic.diagnostics.speedQualifierIssues.some((issue: { evidenceId: string }) => issue.evidenceId === "fact-2"));
    await assert.rejects(compileScriptWithRetry(bad, options), blocked); assert.equal(corrections, 1);
  }
});

test("generated repairs reject unsupported speed copy before review while retained compilation stays compatible", async t => {
  const f = fixture(), w = await setup(t);
  const original = await gateWorkflowScript(f.script, { ...w, input, ui: f.ui, reserve: qc, providers: { ledger: w.ledger, prepareClaude: async () => async () => verdict(buildWorkflowContext(f.script, f.ui)) } as unknown as Providers });
  const plan = await compilePlan(input, evidence, original, w.hooks, w.workspace), bad = structuredClone(f.raw); bad.scenes[1].headline = "Edit a note immediately";
  // Historical parsing alone does not acquire this new generation-only rule.
  assert.equal(compileScript(bad, input, evidence, f.research, { plan, findings: [] }, f.ui).scenes[1].headline, bad.scenes[1].headline);
  let generated = 0, reviews = 0;
  const providers = { ledger: w.ledger, prepareClaude: async (purpose: string) => {
    if (purpose !== "script") { reviews++; throw Error("Invalid copy must not reach semantic preflight"); }
    return async () => { generated++; return bad; };
  } } as unknown as Providers;
  const perform = await prepareScriptRepair(input, evidence, f.research, providers, w.hooks, w.workspace, { plan, findings: [] }, qc, f.ui);
  await assert.rejects(perform(), error => error instanceof PipelineError && error.code === "invalid_generated_script");
  assert.equal(generated, 1); assert.equal(reviews, 0);
  await assert.rejects(readFile(join(w.workspace, SCRIPT_RETRY_PATH)), { code: "ENOENT" });
});

test("a backward outcome spends only the existing script correction before semantic review", async t => {
  const f = fixture(true), w = await setup(t), launch = { ...input, videoType: "launch" as const }, raw = structuredClone(f.raw);
  const catalog = buildShotRecipeCatalog(f.research, evidence, f.ui), proof = catalog.recipes.find(recipe => recipe.storyRole === "outcome" && recipe.evidenceId === "fact-3" && recipe.template === "proof" && recipe.visual.kind === "showcase");
  assert.ok(proof); raw.scenes[2].recipeId = proof.id;
  let corrections = 0, reviews = 0;
  const providers = { ledger: w.ledger, prepareClaude: async (purpose: string, prompt: string) => {
    if (purpose === "script") { assert.ok(prompt.startsWith("OUTCOME CONTINUITY CORRECTION:")); assert.match(prompt, /"sceneId":"scene-3"/); assert.match(prompt, /"sourceAssetIds":\["editor"\]/); return async () => { corrections++; return f.raw; }; }
    return async () => { reviews++; return verdict(buildWorkflowContext(f.script, f.ui)); };
  } } as unknown as Providers;
  const options = { ...w, input: launch, evidence, research: f.research, providers, prompt: "Immutable source", ui: f.ui, directed: true, recipes: true, workflow: true as const };
  const approved = await compileScriptWithRetry(raw, options);
  assert.equal(corrections, 1); assert.equal(reviews, 1); assert.equal(approved.workflowCoherence!.requireOutcomeContinuity, true);
  const diagnostic = JSON.parse(await readFile(join(w.workspace, SCRIPT_REJECTION_PATH), "utf8"));
  assert.equal(diagnostic.diagnostics.outcomeContinuity.code, "outcome_continuity"); assert.equal(diagnostic.diagnostics.workflow, undefined);
  assert.equal(JSON.parse(await readFile(join(w.workspace, SCRIPT_RETRY_PATH), "utf8")).outcome, "valid");
  const plan = await compilePlan(launch, evidence, approved, w.hooks, w.workspace);
  await validatePlanWorkflowCoherence(plan, w.workspace);
  const stripped = structuredClone(approved); delete stripped.workflowCoherence!.requireOutcomeContinuity;
  await assert.rejects(compilePlan(launch, evidence, stripped, w.hooks, w.workspace, { plan, findings: [] }), /launch-result requirement/);
  const strippedPlan = structuredClone(plan); delete strippedPlan.production!.workflowCoherence!.requireOutcomeContinuity;
  await assert.rejects(validatePlanWorkflowCoherence(strippedPlan, w.workspace), blocked);
  await assert.rejects(compileScriptWithRetry(raw, options), blocked); assert.equal(corrections, 1); assert.equal(reviews, 1);
  const [markerPath, artifactPath] = workflowArtifactPaths(approved.workflowCoherence!);
  for (const path of [markerPath, artifactPath]) {
    const bytes = await readFile(join(w.workspace, path), "utf8"), value = JSON.parse(bytes); delete value.requireOutcomeContinuity;
    await writeFile(join(w.workspace, path), JSON.stringify(value));
    await assert.rejects(loadWorkflowScript(approved.workflowCoherence!, w.workspace), blocked);
    await writeFile(join(w.workspace, path), bytes);
  }
});

test("launch repairs retain both new continuity and historical absence without upgrading the parent", async t => {
  for (const required of [false, true]) {
    const f = fixture(true), w = await setup(t), launch = { ...input, videoType: "launch" as const };
    const original = await gateWorkflowScript(f.script, { ...w, input: launch, ui: f.ui, reserve: qc, requireOutcomeContinuity: required, providers: { ledger: w.ledger, prepareClaude: async () => async () => verdict(buildWorkflowContext(f.script, f.ui)) } as unknown as Providers });
    const plan = await compilePlan(launch, evidence, original, w.hooks, w.workspace), changed = structuredClone(f.raw); changed.scenes[0].durationSeconds -= 1;
    const proposed = compileScript(changed, launch, evidence, f.research, { plan, findings: [] }, f.ui);
    const providers = { ledger: w.ledger, prepareClaude: async (purpose: string) => async () => purpose === "script" ? changed : verdict(buildWorkflowContext(proposed, f.ui)) } as unknown as Providers;
    const perform = await prepareScriptRepair(launch, evidence, f.research, providers, w.hooks, w.workspace, { plan, findings: [] }, qc, f.ui), repaired = await perform();
    assert.equal(repaired.workflowCoherence!.requireOutcomeContinuity, required ? true : undefined);
    const final = await compilePlan(launch, evidence, repaired, w.hooks, w.workspace, { plan, findings: [] });
    await validatePlanWorkflowCoherence(final, w.workspace);
  }
});

test("workflow review preflights, durably reserves, persists exact pass and verifies immutable script", async t => {
  const f = fixture(), w = await setup(t), context = buildWorkflowContext(f.script, f.ui), before = JSON.stringify(f.script);
  const providers = { ledger: w.ledger, prepareClaude: async (_purpose: string, _prompt: string, _images: unknown, options: any) => { w.events.push("preflight"); assert.equal(options.maxOutputTokens, 2048); assert.deepEqual(options.reserve, qc); return async () => { w.events.push("paid"); return verdict(context); }; } } as unknown as Providers;
  const script = await gateWorkflowScript(f.script, { ...w, input, providers, ui: f.ui, reserve: qc });
  const paths = workflowArtifactPaths(script.workflowCoherence!);
  assert.deepEqual(w.events, ["preflight", paths[0], "paid", paths[1], paths[0]]);
  assert.equal(JSON.stringify(f.script), before); await verifyScriptWorkflowBinding(script, w.workspace, f.ui); assert.deepEqual(await loadWorkflowScript(script.workflowCoherence!, w.workspace), script);
  const changed = structuredClone(script); changed.scenes[1].headline = "Completed automatically"; await assert.rejects(verifyScriptWorkflowBinding(changed, w.workspace, f.ui), blocked);
  const alteredBinding = structuredClone(script); alteredBinding.workflowCoherence!.verdictSha256 = "b".repeat(64); await assert.rejects(verifyScriptWorkflowBinding(alteredBinding, w.workspace, f.ui), blocked);
  await assert.rejects(gateWorkflowScript(f.script, { ...w, input, providers, ui: f.ui, reserve: qc }), blocked);
  await rm(join(w.workspace, paths[1])); await assert.rejects(verifyScriptWorkflowBinding(script, w.workspace, f.ui), blocked);
});

test("budget and exact request denial occur before workflow marker or model call", async t => {
  for (const budgets of [{ maxModelCalls: 5 }, { maxModelOutputTokens: 13047 }]) {
    const f = fixture(), w = await setup(t); let prepared = 0;
    const providers = { ledger: w.ledger, prepareClaude: async () => { prepared++; throw new Error("Unexpected preflight"); } } as unknown as Providers;
    await assert.rejects(gateWorkflowScript(f.script, { ...w, input: { ...input, budgets: { ...input.budgets, ...budgets } }, providers, ui: f.ui, reserve: qc }), error => error instanceof PipelineError && error.code === "model_budget");
    assert.equal(prepared, 0); assert.deepEqual(await readdir(join(w.workspace, "analysis")), []);
  }
  const f = fixture(), w = await setup(t), providers = { ledger: w.ledger, prepareClaude: async () => { throw new Error("Exact input cap"); } } as unknown as Providers;
  await assert.rejects(gateWorkflowScript(f.script, { ...w, input, providers, ui: f.ui, reserve: qc }), /Exact input/); assert.deepEqual(await readdir(join(w.workspace, "analysis")), []);
});

test("orphan artifact, pending checkpoint and malformed paid verdict cannot be replayed", async t => {
  for (const failure of ["orphan", "checkpoint", "schema"]) {
    const f = fixture(), w = await setup(t), context = buildWorkflowContext(f.script, f.ui); let paid = 0, prepared = 0;
    const providers = { ledger: w.ledger, prepareClaude: async () => { prepared++; return async () => { paid++; return { ...verdict(context), scenes: [] }; }; } } as unknown as Providers;
    if (failure === "orphan") await writeFile(join(w.workspace, `analysis/workflow-coherence-${context.sha256}.json`), "{}");
    if (failure === "checkpoint") w.hooks.persist = async () => { throw new Error("Checkpoint lost"); };
    await assert.rejects(gateWorkflowScript(f.script, { ...w, input, providers, ui: f.ui, reserve: qc }));
    assert.equal(paid, failure === "schema" ? 1 : 0); assert.equal(prepared, failure === "orphan" ? 0 : 1);
    await assert.rejects(gateWorkflowScript(f.script, { ...w, input, providers, ui: f.ui, reserve: qc }), blocked);
    await assert.rejects(assertWorkflowUnstarted(w.workspace), blocked); assert.equal(paid, failure === "schema" ? 1 : 0);
  }
});

test("uncertain obligations remain a consumed failed review and cannot be approved on restore", async t => {
  const f = fixture(), w = await setup(t), context = buildWorkflowContext(f.script, f.ui); let calls = 0;
  const response = { ...taskAnswers(context), contextSha256: context.sha256, assessments: context.obligations!.map((obligation, index) => ({ obligationId: obligation.id, status: index === 0 ? "uncertain" : "supported", reason: index === 0 ? "The retained context cannot establish this proposed result." : "The fixture edit supports the remaining task." })) };
  const providers = { ledger: w.ledger, prepareClaude: async () => async () => { calls++; return response; } } as unknown as Providers;
  await assert.rejects(gateWorkflowScript(f.script, { ...w, input, providers, ui: f.ui, reserve: qc }), error => error instanceof PipelineError && error.code === "workflow_coherence_uncertain" && !(error instanceof WorkflowCoherenceRejected));
  const binding = { version: 2 as const, contextSha256: context.sha256, scriptSha256: context.bindings.scriptSha256, verdictSha256: stageDigest(parseWorkflowVerdict(response, context)) };
  const [markerPath, artifactPath] = workflowArtifactPaths(binding);
  assert.equal(JSON.parse(await readFile(join(w.workspace, markerPath), "utf8")).outcome, "failed");
  await assert.rejects(loadWorkflowScript(binding, w.workspace));
  // Even consistent outer hashes and forged aggregate flags cannot override an uncertain assessment.
  const artifact = JSON.parse(await readFile(join(w.workspace, artifactPath), "utf8"));
  artifact.verdict.passed = true; artifact.verdict.scenes.forEach((scene: { passed: boolean }) => { scene.passed = true; }); artifact.verdict.findings = [];
  const forged = { ...binding, verdictSha256: stageDigest(artifact.verdict) };
  await writeFile(join(w.workspace, artifactPath), JSON.stringify(artifact));
  const marker = JSON.parse(await readFile(join(w.workspace, markerPath), "utf8")); marker.outcome = "passed"; marker.verdictSha256 = forged.verdictSha256;
  await writeFile(join(w.workspace, markerPath), JSON.stringify(marker));
  await assert.rejects(loadWorkflowScript(forged, w.workspace));
  await assert.rejects(gateWorkflowScript(f.script, { ...w, input, providers, ui: f.ui, reserve: qc }), blocked); assert.equal(calls, 1);
});

test("uncertain or mixed obligation judgments never spend the initial script correction allowance", async t => {
  for (const mixed of [false, true]) {
    const f = fixture(), w = await setup(t), raw = structuredClone(f.raw);
    if (mixed) raw.scenes.splice(2, 0, structuredClone(raw.scenes[1]));
    const script = compileScript(raw, input, evidence, f.research, undefined, f.ui), context = buildWorkflowContext(script, f.ui);
    let reviews = 0, corrections = 0;
    const response = { ...taskAnswers(context), contextSha256: context.sha256, assessments: context.obligations!.map((obligation, index) => ({ obligationId: obligation.id, status: index === 0 ? "uncertain" : mixed ? "contradictory" : "supported", reason: index === 0 ? "The exact result cannot be established from retained context." : "The fixture contains a separate contradicted result." })) };
    const providers = { ledger: w.ledger, prepareClaude: async (purpose: string) => {
      if (purpose === "script") { corrections++; throw Error("Uncertain judgment must not spend a correction"); }
      return async () => { reviews++; return response; };
    } } as unknown as Providers;
    const options = { ...w, input, evidence, research: f.research, providers, prompt: "Immutable fixture evidence", ui: f.ui, directed: true, recipes: true, workflow: true as const };
    await assert.rejects(compileScriptWithRetry(raw, options), error => error instanceof PipelineError && error.code === "workflow_coherence_uncertain");
    assert.equal(reviews, 1); assert.equal(corrections, 0);
    const marker = JSON.parse(await readFile(join(w.workspace, `analysis/workflow-coherence-${context.sha256}-state.json`), "utf8"));
    const saved = JSON.parse(await readFile(join(w.workspace, `analysis/workflow-coherence-${context.sha256}.json`), "utf8"));
    assert.equal(marker.status, "completed"); assert.equal(marker.outcome, "failed"); assert.equal(saved.verdict.passed, false);
    assert.ok(saved.verdict.assessments.some((assessment: { status: string }) => assessment.status === "uncertain"));
    if (mixed) assert.ok(saved.verdict.assessments.some((assessment: { status: string }) => assessment.status === "contradictory"));
    await assert.rejects(readFile(join(w.workspace, SCRIPT_RETRY_PATH)), { code: "ENOENT" });
    await assert.rejects(compileScriptWithRetry(raw, options), blocked); assert.equal(reviews, 1); assert.equal(corrections, 0);
  }
});

test("task uncertainty remains non-correctable even when raw obligation flags pass or contradict", async t => {
  for (const contradiction of [false, true]) {
    const f = fixture(), w = await setup(t), context = buildWorkflowContext(f.script, f.ui), response = verdict(context, !contradiction);
    if (!("tasks" in response) || !response.tasks) throw new Error("Missing fresh fixture tasks");
    response.tasks[0].resultAnswer = "uncertain";
    let reviews = 0, corrections = 0;
    const providers = { ledger: w.ledger, prepareClaude: async (purpose: string) => {
      if (purpose === "script") { corrections++; throw Error("Task uncertainty cannot spend a correction"); }
      return async () => { reviews++; return response; };
    } } as unknown as Providers;
    const options = { ...w, input, evidence, research: f.research, providers, prompt: "Immutable fixture evidence", ui: f.ui, directed: true, recipes: true, workflow: true as const };
    await assert.rejects(compileScriptWithRetry(f.raw, options), error => error instanceof PipelineError && error.code === "workflow_coherence_uncertain" && !(error instanceof WorkflowCoherenceRejected));
    const saved = JSON.parse(await readFile(join(w.workspace, `analysis/workflow-coherence-${context.sha256}.json`), "utf8"));
    const marker = JSON.parse(await readFile(join(w.workspace, `analysis/workflow-coherence-${context.sha256}-state.json`), "utf8"));
    assert.equal(marker.outcome, "failed"); assert.equal(saved.verdict.passed, false); assert.equal(saved.verdict.tasks[0].resultAnswer, "uncertain");
    assert.ok(saved.verdict.assessments.every((value: { status: string }) => value.status !== "uncertain"));
    assert.equal(saved.verdict.assessments[0].status, contradiction ? "contradictory" : "supported");
    await assert.rejects(readFile(join(w.workspace, SCRIPT_RETRY_PATH)), { code: "ENOENT" });
    await assert.rejects(compileScriptWithRetry(f.raw, options), blocked); assert.equal(reviews, 1); assert.equal(corrections, 0);
  }
});

test("semantic failure can consume only existing script correction and must pass a new exact-context review", async t => {
  for (const succeeds of [true, false]) {
    const f = fixture(), w = await setup(t); let reviews = 0, corrections = 0;
    const corrected = structuredClone(f.raw); corrected.scenes[1].headline = "Write a note";
    const contexts = [buildWorkflowContext(f.script, f.ui), buildWorkflowContext(compileScript(corrected, input, evidence, f.research, undefined, f.ui), f.ui)];
    const providers = { ledger: w.ledger, prepareClaude: async (purpose: string, prompt: string, _images: unknown, options: any) => {
      if (purpose === "script") { assert.match(prompt, /TRUSTED VALIDATION DIAGNOSTICS.*workflow/); assert.equal(options.reserve.calls, 3); assert.equal(options.reserve.outputTokens, 8048); return async () => { corrections++; w.ledger.modelCalls++; return corrected; }; }
      assert.equal(purpose, "workflow-coherence"); return async () => { const index = reviews++; w.ledger.modelCalls++; return verdict(contexts[index], index === 1 && succeeds); };
    } } as unknown as Providers;
    const options = { ...w, input, evidence, research: f.research, providers, prompt: "Source-bound original script request", ui: f.ui, directed: true, recipes: true, workflow: true as const };
    if (succeeds) { const result = await compileScriptWithRetry(f.raw, options); assert.ok(result.workflowCoherence); await verifyScriptWorkflowBinding(result, w.workspace, f.ui); }
    else await assert.rejects(compileScriptWithRetry(f.raw, options), WorkflowCoherenceRejected);
    assert.equal(reviews, 2); assert.equal(corrections, 1);
    assert.equal(JSON.parse(await readFile(join(w.workspace, SCRIPT_RETRY_PATH), "utf8")).outcome, succeeds ? "valid" : "invalid");
    await assert.rejects(compileScriptWithRetry(f.raw, options), blocked); assert.equal(reviews, 2);
  }
});

test("fresh script stage commits only reviewed scripts and resumes without another model call", async t => {
  const f = fixture(), w = await setup(t); let generated = 0, reviews = 0;
  const providers = { ledger: w.ledger, claude: async (_purpose: string, _prompt: string, _images: unknown, options: any) => { generated++; assert.equal(options.reserve.calls, 4); assert.equal(options.reserve.outputTokens, 11048); assert.equal(options.scriptConstraints.maxScenes, 6); return f.raw; }, prepareClaude: async () => async () => { reviews++; return verdict(buildWorkflowContext(f.script, f.ui)); } } as unknown as Providers;
  const result = await writeScript(input, evidence, f.research, providers, w.hooks, w.workspace, f.ui);
  assert.ok(result.workflowCoherence); assert.deepEqual(await writeScript(input, evidence, f.research, providers, w.hooks, w.workspace, f.ui), result);
  assert.equal(generated, 1); assert.equal(reviews, 1);
  const retained = JSON.parse(await readFile(join(w.workspace, "analysis/script-state.json"), "utf8")); assert.equal(retained.status, "completed");
});

test("confirmed legacy directed stages remain readable and orphan workflow evidence blocks fresh script spending", async t => {
  const f = fixture(), w = await setup(t); let calls = 0;
  const providers = { ledger: w.ledger, claude: async () => { calls++; throw new Error("Unexpected paid generation"); } } as unknown as Providers;
  await writeFile(join(w.workspace, "analysis/script.json"), JSON.stringify(f.script));
  await writeFile(join(w.workspace, "analysis/script-state.json"), JSON.stringify({ version: 1, stage: "script", status: "completed", binding: scriptBinding(input, f.research, f.ui, true, f.script.shotRecipeSha256), artifactSha256: stageDigest(f.script) }));
  assert.deepEqual(await writeScript(input, evidence, f.research, providers, w.hooks, w.workspace, f.ui), f.script); assert.equal(calls, 0);
  const fresh = await setup(t); await writeFile(join(fresh.workspace, `analysis/workflow-coherence-${"b".repeat(64)}.json`), "{}");
  await assert.rejects(writeScript(input, evidence, f.research, providers, fresh.hooks, fresh.workspace, f.ui), blocked); assert.equal(calls, 0);
});

test("malformed or ambiguous workflow reviews never consume script correction", async t => {
  for (const failure of ["schema", "checkpoint", "orphan"]) {
    const f = fixture(), w = await setup(t); let corrections = 0, reviews = 0;
    const context = buildWorkflowContext(f.script, f.ui);
    if (failure === "orphan") await writeFile(join(w.workspace, `analysis/workflow-coherence-${context.sha256}.json`), "{}");
    if (failure === "checkpoint") w.hooks.persist = async () => { throw new Error("Checkpoint failure"); };
    const providers = { ledger: w.ledger, prepareClaude: async (purpose: string) => {
      if (purpose === "script") { corrections++; throw new Error("Unexpected correction"); }
      return async () => { reviews++; return { contextSha256: context.sha256, scenes: [], findings: [] }; };
    } } as unknown as Providers;
    await assert.rejects(compileScriptWithRetry(f.raw, { ...w, input, evidence, research: f.research, providers, prompt: "Source scope", ui: f.ui, directed: true, recipes: true, workflow: true }));
    assert.equal(corrections, 0); assert.equal(reviews, failure === "schema" ? 1 : 0);
    await assert.rejects(readFile(join(w.workspace, SCRIPT_RETRY_PATH)), { code: "ENOENT" });
  }
});

test("a schema correction followed by a negative workflow verdict cannot acquire another correction", async t => {
  const f = fixture(), w = await setup(t), invalid = structuredClone(f.raw); invalid.scenes[0].headline = "x".repeat(77);
  let corrections = 0, reviews = 0;
  const providers = { ledger: w.ledger, prepareClaude: async (purpose: string) => purpose === "script" ? async () => { corrections++; return f.raw; } : async () => { reviews++; return verdict(buildWorkflowContext(f.script, f.ui), false); } } as unknown as Providers;
  const options = { ...w, input, evidence, research: f.research, providers, prompt: "Source scope", ui: f.ui, directed: true, recipes: true, workflow: true as const };
  await assert.rejects(compileScriptWithRetry(invalid, options), WorkflowCoherenceRejected);
  assert.equal(corrections, 1); assert.equal(reviews, 1); assert.equal(JSON.parse(await readFile(join(w.workspace, SCRIPT_RETRY_PATH), "utf8")).outcome, "invalid");
  await assert.rejects(compileScriptWithRetry(f.raw, options), blocked); assert.equal(corrections, 1);
});

test("a gate-tagged repair reserves review input and rechecks a duration-only script against the same UI", async t => {
  const f = fixture(), w = await setup(t); let reviews = 0;
  const initialProvider = { ledger: w.ledger, prepareClaude: async () => async () => verdict(buildWorkflowContext(f.script, f.ui)) } as unknown as Providers;
  const original = await gateWorkflowScript(f.script, { ...w, input, providers: initialProvider, ui: f.ui, reserve: qc });
  const plan = await compilePlan(input, evidence, original, w.hooks, w.workspace);
  const stripped = structuredClone(original); delete stripped.workflowCoherence;
  await assert.rejects(compilePlan(input, evidence, stripped, w.hooks, w.workspace, { plan, findings: [] }), blocked);
  let invoked = 0;
  const denied = { ledger: w.ledger, prepareClaude: async (_purpose: string, _prompt: string, _images: unknown, options: any) => { assert.ok(options.reserve.inputTokens > 32768); if (options.reserve.inputTokens > 32768) throw new PipelineError("model_budget", "The script and its required review cannot fit remaining input", "Inspect retained script", "needs_review"); return async () => { invoked++; return f.raw; }; } } as unknown as Providers;
  await assert.rejects(prepareScriptRepair(input, evidence, f.research, denied, w.hooks, w.workspace, { plan, findings: [] }, qc, f.ui), error => error instanceof PipelineError && error.code === "model_budget"); assert.equal(invoked, 0);
  const changed = structuredClone(f.raw); changed.scenes[0].durationSeconds = 4;
  const repairedScript = compileScript(changed, input, evidence, f.research, { plan, findings: [] }, f.ui);
  assert.notEqual(buildWorkflowContext(repairedScript, f.ui).sha256, original.workflowCoherence!.contextSha256);
  const providers = { ledger: w.ledger, prepareClaude: async (purpose: string, _prompt: string, _images: unknown, options: any) => {
    if (purpose === "script") { assert.equal(options.reserve.calls, 3); assert.equal(options.reserve.outputTokens, 8048); assert.equal(options.scriptConstraints.maxScenes, 6); assert.ok(options.reserve.inputTokens > 32768); return async () => changed; }
    return async () => { reviews++; return verdict(buildWorkflowContext(repairedScript, f.ui)); };
  } } as unknown as Providers;
  const repair = await prepareScriptRepair(input, evidence, f.research, providers, w.hooks, w.workspace, { plan, findings: [] }, qc, f.ui), repaired = await repair();
  const final = await compilePlan(input, evidence, repaired, w.hooks, w.workspace, { plan, findings: [] });
  await validatePlanWorkflowCoherence(final, w.workspace); assert.equal(reviews, 1);
  const modified = structuredClone(final); modified.scenes[1].headline = "A different result";
  await assert.rejects(validatePlanWorkflowCoherence(modified, w.workspace), blocked);
});

test("workflow gates require their full versioned output plus downstream reserve before a marker or invocation", async t => {
  for (const version of [1, 2] as const) for (const affordable of [false, true]) {
    const f = fixture(), w = await setup(t), allocation = version === 1 ? 768 : 2048;
    w.ledger.reservedOutputTokens = 100;
    const exactCap = w.ledger.outputTokens + w.ledger.reservedOutputTokens + allocation + qc.outputTokens;
    const context = buildWorkflowContext(f.script, f.ui, version); let prepared = 0, invoked = 0;
    const providers = { ledger: w.ledger, prepareClaude: async (_purpose: string, _prompt: string, _images: unknown, options: any) => {
      prepared++; assert.equal(options.maxOutputTokens, allocation); assert.deepEqual(options.reserve, qc);
      return async () => { invoked++; return verdict(context); };
    } } as unknown as Providers;
    const run = () => gateWorkflowScript(f.script, { ...w, input: { ...input, budgets: { ...input.budgets, maxModelOutputTokens: exactCap - Number(!affordable) } }, providers, ui: f.ui, reserve: qc, version });
    if (affordable) { assert.equal((await run()).workflowCoherence!.version, version); assert.equal(prepared, 1); assert.equal(invoked, 1); }
    else { await assert.rejects(run(), error => error instanceof PipelineError && error.code === "model_budget"); assert.equal(prepared, 0); assert.equal(invoked, 0); assert.deepEqual(await readdir(join(w.workspace, "analysis")), []); }
  }
});

test("fresh script generation and correction retain the full v2 gate allowance at the exact output boundary", async t => {
  for (const correction of [false, true]) for (const affordable of [false, true]) {
    const f = fixture(), w = await setup(t); let generated = 0, reviewed = 0;
    const qcOutput = correction ? 6000 : 9000, exactCap = w.ledger.outputTokens + 5000 + 2048 + qcOutput;
    const providers = { ledger: w.ledger,
      claude: async (_purpose: string, _prompt: string, _images: unknown, options: any) => { generated++; assert.equal(options.reserve.outputTokens, qcOutput + 2048); return f.raw; },
      prepareClaude: async (purpose: string, _prompt: string, _images: unknown, options: any) => {
        if (purpose === "script") { assert.equal(options.reserve.outputTokens, qcOutput + 2048); return async () => { generated++; return f.raw; }; }
        assert.equal(options.maxOutputTokens, 2048); return async () => { reviewed++; return verdict(buildWorkflowContext(f.script, f.ui)); };
      },
    } as unknown as Providers;
    const limitedInput = { ...input, budgets: { ...input.budgets, maxModelOutputTokens: exactCap - Number(!affordable) } };
    const invalid = structuredClone(f.raw); invalid.scenes[0].headline = "x".repeat(77);
    const run = () => correction ? compileScriptWithRetry(invalid, { ...w, input: limitedInput, evidence, research: f.research, providers, prompt: "Source scope", ui: f.ui, directed: true, recipes: true, workflow: true }) : writeScript(limitedInput, evidence, f.research, providers, w.hooks, w.workspace, f.ui);
    if (affordable) { assert.equal((await run()).workflowCoherence!.version, 2); assert.equal(generated, 1); assert.equal(reviewed, 1); }
    else { await assert.rejects(run(), error => error instanceof PipelineError && error.code === "model_budget"); assert.equal(generated, 0); assert.equal(reviewed, 0); await assert.rejects(readFile(join(w.workspace, SCRIPT_RETRY_PATH)), { code: "ENOENT" }); assert.ok(!(await readdir(join(w.workspace, "analysis"))).some(path => path.startsWith("workflow-coherence-"))); }
  }
});

test("v2 rejects seven scenes before review, during correction and on saved proof validation while v1 stays compatible", async t => {
  const f = fixture(), raw = structuredClone(f.raw);
  raw.scenes.splice(1, 0, ...Array.from({ length: 3 }, () => structuredClone(raw.scenes[0])));
  const legacy = compileScript(raw, input, evidence, f.research, undefined, f.ui);
  assert.equal(legacy.scenes.length, 7);
  assert.throws(() => compileScript(raw, input, evidence, f.research, undefined, f.ui, { requireDirection: true, requireRecipes: true, maxScenes: 6 }), /scene allowance/);
  const w = await setup(t); let prepared = 0;
  const providers = { ledger: w.ledger, prepareClaude: async () => { prepared++; throw Error("No paid review for oversized v2"); } } as unknown as Providers;
  await assert.rejects(gateWorkflowScript(legacy, { ...w, input, providers, ui: f.ui, reserve: qc }), /six-scene/);
  assert.equal(prepared, 0); assert.deepEqual(await readdir(join(w.workspace, "analysis")), []);
  const retry = await setup(t); let corrections = 0, reviews = 0;
  const correcting = { ledger: retry.ledger, prepareClaude: async (purpose: string, _prompt: string, _images: unknown, options: any) => {
    if (purpose !== "script") { reviews++; throw Error("Oversized correction must not reach review"); }
    assert.equal(options.scriptConstraints.maxScenes, 6); assert.equal(options.reserve.calls, 4); assert.equal(options.reserve.outputTokens, 11048);
    return async () => { corrections++; return raw; };
  } } as unknown as Providers;
  await assert.rejects(compileScriptWithRetry(raw, { ...retry, input, evidence, research: f.research, providers: correcting, prompt: "Source scope", ui: f.ui, directed: true, recipes: true, workflow: true }), /scene allowance/);
  assert.equal(corrections, 1); assert.equal(reviews, 0); assert.equal(JSON.parse(await readFile(join(retry.workspace, SCRIPT_RETRY_PATH), "utf8")).outcome, "invalid");
  for (const version of [1, 2] as const) {
    const saved = await setup(t), context = buildWorkflowContext(legacy, f.ui, version), checked = parseWorkflowVerdict(verdict(context), context);
    const binding = { version, contextSha256: context.sha256, scriptSha256: context.bindings.scriptSha256, verdictSha256: stageDigest(checked) };
    const [markerPath, artifactPath] = workflowArtifactPaths(binding);
    await writeFile(join(saved.workspace, artifactPath), JSON.stringify({ version: 1, script: legacy, context, verdict: checked }));
    await writeFile(join(saved.workspace, markerPath), JSON.stringify({ version: 1, jobId: legacy.jobId, ...context.bindings, contextSha256: context.sha256, status: "completed", outcome: "passed", verdictSha256: binding.verdictSha256 }));
    if (version === 1) { await verifyScriptWorkflowBinding({ ...legacy, workflowCoherence: binding }, saved.workspace, f.ui); }
    else { await assert.rejects(loadWorkflowScript(binding, saved.workspace), /six-scene/); assert.throws(() => validateScript({ ...legacy, workflowCoherence: binding }, input, evidence, f.research, undefined, f.ui), /six-scene/); }
  }
});

test("retained v1 repairs keep the v1 review contract and never acquire v2 implicitly", async t => {
  const f=fixture(),w=await setup(t),originalContext=buildWorkflowContext(f.script,f.ui,1);
  const initialProvider={ledger:w.ledger,prepareClaude:async (_purpose:string,_prompt:string,_images:unknown,options:any)=>{assert.equal(options.policy,"workflow-coherence-v1");assert.equal(options.workflowConstraints.version,1);assert.equal(options.maxOutputTokens,768);return async()=>verdict(originalContext);}} as unknown as Providers;
  const original=await gateWorkflowScript(f.script,{...w,input,providers:initialProvider,ui:f.ui,reserve:qc,version:1}),plan=await compilePlan(input,evidence,original,w.hooks,w.workspace);
  const changed=structuredClone(f.raw);changed.scenes[0].durationSeconds=4;
  const proposed=compileScript(changed,input,evidence,f.research,{plan,findings:[]},f.ui),context=buildWorkflowContext(proposed,f.ui,1);
  const provider={ledger:w.ledger,prepareClaude:async(purpose:string,_prompt:string,_images:unknown,options:any)=>{if(purpose==="script"){assert.equal(options.reserve.outputTokens,6768);assert.equal(options.scriptConstraints.maxScenes,undefined);return async()=>changed;}assert.equal(options.policy,"workflow-coherence-v1");assert.equal(options.workflowConstraints.version,1);assert.equal(options.maxOutputTokens,768);return async()=>verdict(context);}} as unknown as Providers;
  const generate=await prepareScriptRepair(input,evidence,f.research,provider,w.hooks,w.workspace,{plan,findings:[]},qc,f.ui),repaired=await generate();
  assert.equal(repaired.workflowCoherence!.version,1);
  const compiled=await compilePlan(input,evidence,repaired,w.hooks,w.workspace,{plan,findings:[]});await validatePlanWorkflowCoherence(compiled,w.workspace);
});

test("saved trial7 v1 script and plan proof remain byte-identical and readable",async t=>{
  const root=resolve(".local/engine-batch-acceptance-20261002g");
  let originalScript:string;
  try{originalScript=await readFile(join(root,"analysis/script.json"),"utf8");}catch(error){if(error instanceof Error&&"code" in error&&error.code==="ENOENT"){t.skip("Saved local trial7 is unavailable");return;}throw error;}
  const script=JSON.parse(originalScript);assert.equal(script.workflowCoherence.version,1);
  const names=["analysis/script.json","plan.json",...workflowArtifactPaths(script.workflowCoherence)],before=await Promise.all(names.map(name=>readFile(join(root,name),"utf8")));
  await verifyScriptWorkflowBinding(script,root);await validatePlanWorkflowCoherence(JSON.parse(before[1]),root);
  assert.deepEqual(await Promise.all(names.map(name=>readFile(join(root,name),"utf8"))),before);
});
