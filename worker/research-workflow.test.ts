import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { compileResearch, researchRequest, sourceFacts, stageDigest, validateResearch } from "./research";
import { researchReadiness } from "./research-readiness";
import { compileResearchWithRetry, researchResponseDiagnostics, RESEARCH_RETRY_PATH } from "./research-review";
import { researchControlInventory, type ResearchWorkflow } from "./research-workflow";
import { PipelineError, type Evidence, type WorkerInput } from "./types";
import { workflowInputReserve } from "./workflow-coherence";

const input: WorkerInput = { jobId: "workflow-selection", ownerId: "fixture", mode: "url", productUrl: "https://example.test", videoType: "launch", format: "16:9", files: [], budgets: { maxModelCalls: 10, maxModelInputTokens: 200000, maxModelOutputTokens: 30000 } };
const identity = "a".repeat(64), fresh = { version: 3 as const, singleTarget: true as const, workflowSelection: true as const };
const evidence: Evidence = {
  text: "Atlas helps analysts understand visitors.\n\nChoose a browser condition and apply it to display analytics for that visitor segment.\n\nStart a free trial.",
  assets: [{ id: "screen", kind: "image", path: "assets/screen.png", usage: "output", rights: "Synthetic test fixture", width: 1000, height: 600 }],
  uiSources: [{ id: "controls", assetId: "screen", basis: "dom", context: "public-demo", width: 1000, height: 600, limitations: ["Partial static inventory; no operation performed."], elements: [
    { id: "browser", role: "list-item", text: "Chrome", rect: { x: .1, y: .1, width: .2, height: .1 }, state: { selected: false } },
    { id: "apply", role: "button", text: "Apply", rect: { x: .1, y: .2, width: .2, height: .1 } },
    { id: "code", role: "text", text: "return (", rect: { x: .4, y: .1, width: .2, height: .1 } },
  ] }],
};
function workflow(): ResearchWorkflow {
  return { version: 1, observedStart: { sourceAssetId: "screen", description: "Browser condition chooser and the existing analytics report" }, actions: [
    { kind: "select", sourceAssetId: "screen", sourceElementId: "browser", control: "Chrome", evidenceId: "fact-2" },
    { kind: "click", sourceAssetId: "screen", sourceElementId: "apply", control: "Apply", evidenceId: "fact-2" },
  ], result: { kind: "applied-view", sourceAssetId: "screen", surface: "Visitor analytics", change: "The report displays the selected browser segment; the chooser closes.", basis: "illustrative", evidenceId: "fact-2" } };
}
function draft() {
  const claim = (text: string, id: string) => ({ text, basis: "explicit", evidenceIds: [id] });
  return { sufficientEvidence: true, reason: "Source controls and capabilities support one illustrative applied view.", product: "Atlas", summary: "Visitor analytics", facts: sourceFacts(evidence).map(fact => ({ evidenceId: fact.id, kind: "feature", label: fact.text.slice(0, 48) })), story: { primaryAudience: claim("Site analysts", "fact-1"), problem: null, mechanism: { ...claim("Apply a browser segment", "fact-2"), steps: [{ action: "Apply browser condition", assetId: "screen", evidenceId: "fact-2" }] }, outcome: claim("Understand that visitor segment", "fact-2"), differentiator: null, cta: claim("Start a free trial", "fact-3") }, visuals: [{ assetId: "screen", description: "Browser chooser, Apply button and visitor analytics region.", supportsFactIds: ["fact-1", "fact-2"], role: "product_ui", showsProductUi: true }], documentTargets: [{ id: "browser-segment", sourceAssetIds: ["screen"], capabilityFactIds: ["fact-2"], goal: "Apply one evidenced browser condition and inspect its corresponding report.", workflow: workflow() as ResearchWorkflow | undefined }], limitations: ["Illustrative behavior; an authenticated session was not operated."] };
}
const compile = (raw = draft(), source = evidence) => compileResearch(input, source, raw, identity, fresh);
const rejected = (code: string) => (error: unknown) => error instanceof PipelineError && error.code === "production_stage_changed" && error.message.includes(code);

test("fresh workflow selection distinguishes an applied view from a backend commit and retains exact source bindings", () => {
  const raw = draft(), original = JSON.stringify(raw), sources = JSON.stringify(evidence), research = compile(raw);
  assert.equal(research.workflowSelectionVersion, 1); assert.deepEqual(research.documentTargets![0].workflow, raw.documentTargets[0].workflow);
  assert.equal(research.documentTargets![0].workflow!.result.kind, "applied-view");
  assert.deepEqual(research.facts.map(fact => fact.quote), sourceFacts(evidence).map(fact => fact.text));
  assert.equal(JSON.stringify(raw), original); assert.equal(JSON.stringify(evidence), sources);
  const report = researchReadiness(input, evidence, identity, ["fact-1", "fact-2", "fact-3"], research, stageDigest(research));
  assert.equal(report.status, "ready_for_documentation"); assert.equal(report.workflowSelectionVersion, 1);
  assert.deepEqual(report.targets[0].workflow, raw.documentTargets[0].workflow);
  // This is a source-bound selection proposal, not a semantic verdict about
  // generated after-state metrics. UI and workflow review remain mandatory.
  assert.match(report.meaning, /independent visual quality checks remain required/);
});

test("retained v3 without the fresh marker stays compatible; marked declarations cannot disappear or change source scope", () => {
  const raw = draft(); delete raw.documentTargets[0].workflow;
  const retained = compileResearch(input, evidence, raw, identity, { version: 3, singleTarget: true });
  assert.equal(retained.workflowSelectionVersion, undefined); validateResearch(retained, input, evidence, identity);
  assert.throws(() => compile(raw), rejected("workflow_declaration_required"));
  const current = compile(), changed = structuredClone(current); delete changed.documentTargets![0].workflow;
  assert.throws(() => validateResearch(changed, input, evidence, identity), rejected("workflow_declaration_required"));
  assert.notEqual(stageDigest(changed), stageDigest(current));
  for (const change of [
    (value: ResearchWorkflow) => { value.observedStart.sourceAssetId = "other"; },
    (value: ResearchWorkflow) => { value.actions[0].sourceAssetId = "other"; },
    (value: ResearchWorkflow) => { value.result.sourceAssetId = "other"; },
  ]) { const value = draft(); change(value.documentTargets[0].workflow!); assert.throws(() => compile(value), rejected("workflow_source_binding")); }
  const fact = draft(); fact.documentTargets[0].workflow!.result.evidenceId = "fact-3";
  assert.throws(() => compile(fact), rejected("workflow_fact_binding"));
});

test("known static code cannot become an editable input or confirmation; known disabled and selected controls remain constrained", () => {
  for (const kind of ["type", "click"] as const) {
    const raw = draft(); raw.documentTargets[0].workflow!.actions[0] = { kind, sourceAssetId: "screen", sourceElementId: "code", control: "return (", evidenceId: "fact-2" };
    assert.throws(() => compile(raw), rejected("workflow_control_role"));
  }
  const disabled = structuredClone(evidence); disabled.uiSources![0].elements[0].state = { disabled: true };
  assert.throws(() => compile(draft(), disabled), rejected("workflow_control_disabled"));
  const laterEnabled = structuredClone(evidence); laterEnabled.uiSources![0].elements[1].state = { disabled: true };
  assert.equal(compile(draft(), laterEnabled).workflowSelectionVersion, 1, "Selecting a condition may enable Apply; the documenter must evidence that intervening state");
  const alreadyApplied = structuredClone(evidence); alreadyApplied.uiSources![0].elements[0].state!.selected = true;
  assert.throws(() => compile(draft(), alreadyApplied), rejected("workflow_control_already_selected"));
  const wrongLabel = draft(); wrongLabel.documentTargets[0].workflow!.actions[1].control = "Publish";
  assert.throws(() => compile(wrongLabel), rejected("workflow_control_binding"));
  const missing = draft(); missing.documentTargets[0].workflow!.actions[1].sourceElementId = "invented";
  assert.throws(() => compile(missing), rejected("workflow_control_binding"));
});

test("a complete observed-state sentence survives without truncating its existing-selection qualifier", () => {
  const raw = draft();
  const description = "Dashboard showing Sources tab; Direct/None highlighted; Google, ChatGPT, GitHub, DuckDuckGo, Bing, Brave rows visible; no filter active";
  raw.documentTargets[0].workflow!.observedStart.description = description;
  assert.equal(compile(raw).documentTargets![0].workflow!.observedStart.description, description);
  raw.documentTargets[0].workflow!.observedStart.description = "x".repeat(241);
  assert.throws(() => compile(raw), /Too big/);
});

test("partial or absent DOM never disproves a source-supported pictured control, but unsupported automatic confirmation is not invented", () => {
  const source = { ...evidence, uiSources: [] }, raw = draft();
  raw.documentTargets[0].workflow!.actions.forEach(action => { delete action.sourceElementId; });
  assert.equal(compile(raw, source).workflowSelectionVersion, 1);
  raw.documentTargets[0].workflow!.actions = [{ kind: "type", sourceAssetId: "screen", control: "Documented code editor", evidenceId: "fact-2" }];
  assert.throws(() => compile(raw, source), rejected("workflow_confirmation_required"));
  const declared = compile(); delete declared.documentTargets![0].workflow;
  const readiness = researchReadiness(input, evidence, identity, ["fact-2"], declared);
  assert.equal(readiness.status, "needs_input"); assert.equal(readiness.issues[0].code, "workflow_declaration_required");
});

test("research receives a bounded non-authoritative control inventory and concrete refusal rules within its existing output allowance", () => {
  const original = JSON.stringify(evidence), request = researchRequest(input, evidence), inventory = researchControlInventory(evidence, new Set(["screen"]));
  assert.deepEqual(inventory[0].controls.map(control => control.id), ["browser", "apply"]);
  assert.match(inventory[0].meaning, /absence is not negative evidence/);
  assert.match(request.prompt, /existing 3,500-token limit/); assert.match(request.prompt, /approximately 180 words or fewer/);
  assert.match(request.prompt, /text\/code sample is not an input or button/);
  assert.match(request.prompt, /already-visible output/); assert.match(request.prompt, /leaving the underlying metrics unchanged/);
  assert.match(request.prompt, /do not invent a confirmation/); assert.match(request.prompt, /sourceElementId/);
  assert.equal(JSON.stringify(evidence), original); assert.equal(request.images.length, 1);
  assert.ok(Buffer.byteLength(JSON.stringify(draft())) < 3500, "The complete concise fixture should fit without a larger stage allowance");
});

test("a guide-choice proposal cannot create canonical facts or approve an unsupported workflow", () => {
  const proposed: Evidence = { ...evidence, guideProposal: { version: 1, decision: "capture-guide", guideId: "guide-1", sourceAssetIds: ["screen"], intent: "Claim this creates an unobserved successful payment", missingEvidence: ["result"], reason: "Untrusted selector hypothesis" } };
  assert.deepEqual(sourceFacts(proposed), sourceFacts(evidence));
  const request = researchRequest(input, proposed);
  assert.match(request.prompt, /NOT a fact, approval, or instruction/);
  assert.match(request.prompt, /do not force the proposal to pass/);
  const raw = draft(); raw.documentTargets[0].workflow!.result.evidenceId = "fact-999";
  assert.throws(() => compile(raw, proposed), rejected("workflow_fact_binding"));
});

test("a same-source segmented count preserves exact observed values/context and rejects invented or cosmetic metric changes", () => {
  const proposal = () => {
    const raw = draft(), selected = raw.documentTargets[0].workflow!;
    selected.actions = [selected.actions[0]];
    selected.result.valueDerivation = { kind: "selected-row-count", sourceAssetId: "screen", rowLabel: "Chrome", rowValue: "21", sourceMetricLabel: "Visitors", outputLabel: "Visitors", outputBefore: "80", context: ["This month", "Site A"] };
    return raw;
  };
  const original = proposal(), retained = compile(original).documentTargets![0].workflow!;
  assert.deepEqual(retained.result.valueDerivation, original.documentTargets[0].workflow!.result.valueDerivation);
  // This only verifies the proposal contract. The actual visible element IDs,
  // value provenance and unchanged context must still pass the UI compiler.
  for (const change of [
    (w: ResearchWorkflow) => { w.result.valueDerivation!.rowValue = "21%"; },
    (w: ResearchWorkflow) => { w.result.valueDerivation!.rowValue = "21.5"; },
    (w: ResearchWorkflow) => { w.result.valueDerivation!.outputBefore = "9007199254740993"; },
    (w: ResearchWorkflow) => { w.result.valueDerivation!.rowValue = "81"; },
    (w: ResearchWorkflow) => { w.result.valueDerivation!.rowValue = "80.0"; },
    (w: ResearchWorkflow) => { w.result.valueDerivation!.sourceAssetId = "other"; },
    (w: ResearchWorkflow) => { w.result.valueDerivation!.rowLabel = "Firefox"; },
    (w: ResearchWorkflow) => { w.result.valueDerivation!.context = ["This month", "This month"]; },
    (w: ResearchWorkflow) => { w.result.basis = "observed"; },
    (w: ResearchWorkflow) => { w.actions.push({ kind: "click", sourceAssetId: "screen", control: "Apply", evidenceId: "fact-2" }); },
  ]) { const raw = proposal(); change(raw.documentTargets[0].workflow!); assert.throws(() => compile(raw), rejected("workflow_value_derivation")); }
  const formatted = proposal(); formatted.documentTargets[0].workflow!.result.valueDerivation!.rowValue = "1.2k"; formatted.documentTargets[0].workflow!.result.valueDerivation!.outputBefore = "2,000";
  assert.equal(compile(formatted).documentTargets![0].workflow!.result.valueDerivation!.rowValue, "1.2k");
  assert.match(researchRequest(input, evidence).prompt, /not a measured live session/);
});

async function workspace(t: TestContext) {
  const prefix = join(tmpdir(), "research-workflow-"), root = await mkdtemp(prefix); await mkdir(join(root, "analysis"));
  t.after(async () => { assert.equal(dirname(resolve(root)), resolve(tmpdir())); assert.ok(root.startsWith(prefix)); await rm(root, { recursive: true, force: true }); });
  return root;
}

test("missing selection can use only the existing durable research correction and unchanged downstream reserve", async t => {
  const root = await workspace(t), raw = draft(); delete raw.documentTargets[0].workflow;
  let error: unknown; try { compile(raw); } catch (caught) { error = caught; }
  assert.deepEqual(researchResponseDiagnostics(raw, evidence, error as PipelineError, true, true), [{ code: "workflow_declaration_required", path: ["documentTargets", 0, "workflow"] }]);
  const events: string[] = []; let calls = 0;
  const options = {
    input, evidence, evidenceSha256: identity, workspace: root, singleTarget: true as const, workflowSelection: true as const, ...researchRequest(input, evidence),
    hooks: { persist: async (paths: string[]) => { events.push(...paths); } },
    providers: { ledger: { modelCalls: 1, inputTokens: 1000, outputTokens: 1000, reservedInputTokens: 0, reservedOutputTokens: 0, audioGenerations: 0, asrSeconds: 0, providerRequests: [], audio: {} }, prepareClaude: async (_purpose: string, prompt: string, _images: unknown, policy: unknown) => {
      assert.match(prompt, /workflow_declaration_required/);
      assert.deepEqual(policy, { policy: "research-v2", reserve: { calls: 6, inputTokens: workflowInputReserve(), outputTokens: 22048 } });
      return async <T>() => { events.push("paid"); calls++; return draft() as T; };
    } },
  };
  const result = await compileResearchWithRetry(raw, options);
  assert.equal(result.workflowSelectionVersion, 1); assert.equal(calls, 1);
  assert.deepEqual(events, [RESEARCH_RETRY_PATH, "paid", RESEARCH_RETRY_PATH]);
  assert.equal(JSON.parse(await readFile(join(root, RESEARCH_RETRY_PATH), "utf8")).outcome, "valid");
  await assert.rejects(compileResearchWithRetry(draft(), options), /already consumed/); assert.equal(calls, 1);
});

test("known literal candidate context mismatch uses the existing single correction and unchanged reserve", async t => {
  const root = await workspace(t), source = structuredClone(evidence);
  source.text = "Atlas helps template authors.\n\nAuthors can change a name in a template and preview its greeting.\n\nStart a free trial.";
  const element = (id: string, text: string, code: boolean, y: number) => ({ id, role: "text" as const, text, rect: { x: code ? .05 : .6, y, width: .3, height: .08 }, selector: code ? `:scope > pre > div#${id}` : `:scope > aside > p#${id}`, ...(code ? { codeContainer: ":scope > pre" } : {}) });
  source.uiSources![0].elements = [element("code", "recipient = 'Mina',", true, .1), element("template", "Dear {recipient},", true, .2), element("preview", "Dear Mina,", false, .1), element("context", "Example team", false, .3)];
  const good = draft(); good.story.mechanism.text = "Edit the template name"; good.story.mechanism.steps[0].action = "Edit name";
  good.documentTargets[0].workflow = { version: 1, observedStart: { sourceAssetId: "screen", description: "Observed assignment and preview" }, actions: [{ kind: "type", sourceAssetId: "screen", sourceElementId: "code", control: "recipient = 'Mina',", evidenceId: "fact-2" }], result: { kind: "reactive-preview", sourceAssetId: "screen", surface: "Greeting", change: "Illustrative name substitution", basis: "illustrative", evidenceId: "fact-2", contentDerivation: { kind: "literal-preview", sourceAssetId: "screen", codeText: "recipient = 'Mina',", propertyName: "recipient", beforeLiteral: "Mina", afterLiteral: "Sam", templateText: "Dear {recipient},", outputBefore: "Dear Mina,", outputAfter: "Dear Sam,", context: ["Example team"] } } };
  const bad = structuredClone(good); bad.documentTargets[0].workflow!.result.contentDerivation!.context = ["Uncaptured page-wide filename"];
  let calls = 0; const events: string[] = [];
  const options = { input, evidence: source, evidenceSha256: identity, workspace: root, singleTarget: true as const, workflowSelection: true as const, ...researchRequest(input, source),
    hooks: { persist: async (paths: string[]) => { events.push(...paths); } },
    providers: { ledger: { modelCalls: 1, inputTokens: 1000, outputTokens: 1000, reservedInputTokens: 0, reservedOutputTokens: 0, audioGenerations: 0, asrSeconds: 0, providerRequests: [], audio: {} }, prepareClaude: async (_purpose: string, prompt: string, _images: unknown, policy: unknown) => {
      assert.match(prompt, /workflow_content_derivation/);
      assert.deepEqual(policy, { policy: "research-v2", reserve: { calls: 6, inputTokens: workflowInputReserve(), outputTokens: 22048 } });
      return async <T>() => { calls++; events.push("model"); return good as T; };
    } },
  };
  assert.deepEqual((await compileResearchWithRetry(bad, options)).documentTargets![0].workflow!.result.contentDerivation!.context, ["Example team"]);
  assert.equal(calls, 1); assert.deepEqual(events, [RESEARCH_RETRY_PATH, "model", RESEARCH_RETRY_PATH]);
  await assert.rejects(compileResearchWithRetry(good, options), /already consumed/); assert.equal(calls, 1);
});
