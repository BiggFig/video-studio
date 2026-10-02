import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { compileResearch, sourceFacts, stageDigest } from "./research";
import { compileUiDocuments, type UiDocument } from "./ui-reconstruction";
import { compileScript, prepareScriptRepair, scriptBinding, writeScript } from "./scripting";
import { compilePlan } from "./planning";
import { compileScriptWithRetry, SCRIPT_RETRY_PATH } from "./script-review";
import { buildShotRecipeCatalog, RECIPE_SCRIPT_TRANSPORT_VERSION } from "./shot-recipes";
import { buildWorkflowContext, type WorkflowContext } from "./workflow-coherence";
import { assertWorkflowUnstarted, gateWorkflowScript, loadWorkflowScript, validatePlanWorkflowCoherence, verifyScriptWorkflowBinding, workflowArtifactPaths, WorkflowCoherenceRejected } from "./workflow-stage";
import { PipelineError, type Evidence, type Hooks, type WorkerInput } from "./types";
import type { Providers } from "./providers";

const input: WorkerInput = { jobId: "workflow-fixture", ownerId: "fixture", mode: "url", productUrl: "https://example.com/", videoType: "launch", format: "16:9", files: [], budgets: { maxModelCalls: 10, maxModelInputTokens: 200000, maxModelOutputTokens: 30000 } };
const evidence: Evidence = { text: "Notes for writers.\n\nEdit notes.\n\nOrganize ideas.\n\nDownload Atlas.", assets: [{ id: "editor", kind: "image", usage: "output", path: "assets/editor.png", width: 1000, height: 600, rights: "Fixture source" }] };
const hooks: Hooks = { state: async () => {}, persist: async () => {}, complete: async () => {} };
const rect = { x: .1, y: .1, width: .8, height: .8 };
function fixture() {
  const claim = (text: string, id: string) => ({ text, basis: "explicit", evidenceIds: [id] });
  const research = compileResearch(input, evidence, { sufficientEvidence: true, reason: "Visible editor", product: "Atlas", summary: "Editable notes", facts: sourceFacts(evidence).map(fact => ({ evidenceId: fact.id, kind: "feature", label: fact.text })), visuals: [{ assetId: "editor", role: "product_ui", showsProductUi: true, description: "Actual editor", supportsFactIds: ["fact-2", "fact-3"] }], story: { primaryAudience: claim("writers", "fact-1"), problem: null, mechanism: { ...claim("Edit notes", "fact-2"), steps: [{ action: "Edit notes", evidenceId: "fact-2", assetId: "editor" }] }, outcome: claim("Organize ideas", "fact-3"), differentiator: null, cta: claim("Download Atlas", "fact-4") }, documentTargets: [{ id: "notes", sourceAssetIds: ["editor"], capabilityFactIds: ["fact-2"], goal: "Edit one note" }], limitations: [] }, "a".repeat(64));
  const document: UiDocument = { id: "notes", sourceAssetIds: ["editor"], capabilityFactIds: ["fact-2"], viewport: { width: 1000, height: 600 }, styles: [{ id: "body", fill: "#ffffff", color: "#111111", borderColor: "#dddddd", fontSize: 18, fontWeight: 400, radius: 8 }], elements: [{ id: "note", type: "textarea", rect, sourceRect: rect, sourceAssetId: "editor", styleId: "body", text: "Draft", textBasis: "source-ui", initiallyVisible: true }], states: [{ id: "editing", basis: "observed", sourceAssetId: "editor", evidenceIds: ["fact-2"], visibleElementIds: ["note"], selectedElementIds: [], textValues: [] }] };
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
  return { research, ui, raw, script: compileScript(raw, input, evidence, research, undefined, ui, { requireDirection: true, requireRecipes: true }) };
}
async function setup(t: TestContext) {
  const prefix = join(tmpdir(), "workflow-stage-"), workspace = await mkdtemp(prefix); await mkdir(join(workspace, "analysis"));
  t.after(async () => { if (dirname(resolve(workspace)) !== resolve(tmpdir()) || !workspace.startsWith(prefix)) throw new Error("Unsafe fixture cleanup"); await rm(workspace, { recursive: true, force: true }); });
  const events: string[] = [], ledger = { modelCalls: 3, inputTokens: 25000, outputTokens: 5000, reservedInputTokens: 0, reservedOutputTokens: 0 };
  return { workspace, events, ledger, hooks: { ...hooks, persist: async (paths: string[]) => { events.push(...paths); } } };
}
function verdict(context: WorkflowContext, passed = true) { return { contextSha256: context.sha256, scenes: context.scenes.map(scene => ({ sceneId: scene.sceneId, passed })), findings: passed ? [] : [{ severity: "major", sceneId: context.scenes[0].sceneId, actionId: "final", elementIds: ["note"], code: "context_contradiction", message: "The visible result does not support the stated completion." }] }; }
const qc = { calls: 2, inputTokens: 0, outputTokens: 6000 };
const blocked = (error: unknown) => error instanceof PipelineError && error.code === "production_stage_changed";

test("workflow review preflights, durably reserves, persists exact pass and verifies immutable script", async t => {
  const f = fixture(), w = await setup(t), context = buildWorkflowContext(f.script, f.ui), before = JSON.stringify(f.script);
  const providers = { ledger: w.ledger, prepareClaude: async (_purpose: string, _prompt: string, _images: unknown, options: any) => { w.events.push("preflight"); assert.equal(options.maxOutputTokens, 768); assert.deepEqual(options.reserve, qc); return async () => { w.events.push("paid"); return verdict(context); }; } } as unknown as Providers;
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
  for (const budgets of [{ maxModelCalls: 5 }, { maxModelOutputTokens: 11767 }]) {
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

test("semantic failure can consume only existing script correction and must pass a new exact-context review", async t => {
  for (const succeeds of [true, false]) {
    const f = fixture(), w = await setup(t); let reviews = 0, corrections = 0;
    const corrected = structuredClone(f.raw); corrected.scenes[1].headline = "Write a note";
    const contexts = [buildWorkflowContext(f.script, f.ui), buildWorkflowContext(compileScript(corrected, input, evidence, f.research, undefined, f.ui), f.ui)];
    const providers = { ledger: w.ledger, prepareClaude: async (purpose: string, prompt: string, _images: unknown, options: any) => {
      if (purpose === "script") { assert.match(prompt, /TRUSTED VALIDATION DIAGNOSTICS.*workflow/); assert.equal(options.reserve.calls, 3); assert.equal(options.reserve.outputTokens, 6768); return async () => { corrections++; w.ledger.modelCalls++; return corrected; }; }
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
  const providers = { ledger: w.ledger, claude: async (_purpose: string, _prompt: string, _images: unknown, options: any) => { generated++; assert.equal(options.reserve.calls, 5); assert.equal(options.reserve.outputTokens, 12768); return f.raw; }, prepareClaude: async () => async () => { reviews++; return verdict(buildWorkflowContext(f.script, f.ui)); } } as unknown as Providers;
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
    if (purpose === "script") { assert.equal(options.reserve.calls, 3); assert.equal(options.reserve.outputTokens, 6768); assert.ok(options.reserve.inputTokens > 32768); return async () => changed; }
    return async () => { reviews++; return verdict(buildWorkflowContext(repairedScript, f.ui)); };
  } } as unknown as Providers;
  const repair = await prepareScriptRepair(input, evidence, f.research, providers, w.hooks, w.workspace, { plan, findings: [] }, qc, f.ui), repaired = await repair();
  const final = await compilePlan(input, evidence, repaired, w.hooks, w.workspace, { plan, findings: [] });
  await validatePlanWorkflowCoherence(final, w.workspace); assert.equal(reviews, 1);
  const modified = structuredClone(final); modified.scenes[1].headline = "A different result";
  await assert.rejects(validatePlanWorkflowCoherence(modified, w.workspace), blocked);
});
