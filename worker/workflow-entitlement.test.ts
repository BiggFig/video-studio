import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { stageDigest } from "./research";
import type { Script } from "./scripting";
import type { UiDocument } from "./ui-reconstruction";
import { PipelineError } from "./types";
import { buildWorkflowContext, parseWorkflowVerdict, prepareWorkflowCoherence, validateWorkflowVerdict, workflowReadableContext, workflowTaskEvidence, type WorkflowContext } from "./workflow-coherence";
import { loadWorkflowScript } from "./workflow-stage";
import { workflowOutputSchema } from "./model-format";

// A product-neutral observed picker and explicitly illustrative completion.
// These tests prove extraction/enforcement, not a mocked model's comprehension.
function picker(headline = "Choose recipient", outcome = "", complete = false): Script {
  const rect = { x: .1, y: .1, width: .8, height: .15 }, source = "observed-picker";
  const element = (id: string, type: UiDocument["elements"][number]["type"], text: string, y: number, visible = true) => ({ id, type, rect: { ...rect, y }, sourceRect: { ...rect, y }, sourceAssetId: source, styleId: "plain", text, textBasis: "source-ui" as const, initiallyVisible: visible });
  const doc: UiDocument = { id: "recipient-picker", sourceAssetIds: [source], capabilityFactIds: ["fact-1"], viewport: { width: 500, height: 400 }, styles: [{ id: "plain", fill: "#111111", color: "#ffffff", borderColor: "transparent", fontSize: 16, fontWeight: 400, radius: 0 }, { id: "selected", fill: "#444444", color: "#ffffff", borderColor: "transparent", fontSize: 16, fontWeight: 400, radius: 0 }], elements: [element("label", "text", "Recipient", .01), element("query", "input", "", .2), { ...element("choice", "list-item", "Alex Rivera", .4), selectedStyleId: "selected" }, { ...element("result", "text", "Sent to Alex Rivera", .65, false), textBasis: "example-content" }], states: [
    { id: "initial", basis: "observed", sourceAssetId: source, evidenceIds: ["fact-1"], visibleElementIds: ["label", "query", "choice"], selectedElementIds: [], textValues: [] },
    { id: "selected", basis: "illustrative", evidenceIds: ["fact-1"], visibleElementIds: ["label", "query", "choice"], selectedElementIds: ["choice"], textValues: [{ elementId: "query", text: "Alex", textBasis: "example-content" }] },
    { id: "sent", basis: "illustrative", evidenceIds: ["fact-1"], visibleElementIds: ["label", "result"], selectedElementIds: [], textValues: [] },
  ] };
  const common = { assetId: source, headline, detail: "", evidenceId: "fact-1", durationSeconds: 6, sourceInSeconds: 0, preserveAudio: false, purpose: "Fixture", referenceTechnique: "Fixture" };
  const script = { version: 3, jobId: "entitlement-fixture", sufficientEvidence: true, reason: "Observed picker", product: "Mail", summary: "Offline assertion test", accent: "#ffffff", background: "dark", musicPrompt: "unused", sfxPrompt: "unused", assumptions: [], researchSha256: "a".repeat(64), evidenceSha256: "b".repeat(64), uiDocuments: [doc], scenes: [{ ...common, storyRole: "mechanism", presentation: { template: "proof", theme: "dark", transition: "cut", visual: { kind: "ui-demo", documentId: doc.id, actions: [{ kind: "type", atFrame: 30, durationFrames: 12, targetId: "query", text: "Alex", evidenceId: "fact-1" }, { kind: "click", atFrame: 50, durationFrames: 8, targetId: "choice", evidenceId: "fact-1" }, { kind: "state", atFrame: 70, durationFrames: 1, stateId: complete ? "sent" : "selected", evidenceId: "fact-1" }] } } }, ...(outcome ? [{ ...common, headline: outcome, storyRole: "outcome", presentation: { template: "features", theme: "dark", transition: "cut" } }] : [])] } as Script;
  bind(script); return script;
}
function bind(script: Script) { script.uiSha256 = stageDigest({ version: 1, jobId: script.jobId, evidenceSha256: script.evidenceSha256, researchSha256: script.researchSha256, documents: script.uiDocuments }); }
function answer(context: WorkflowContext, requiredResult: "inspect" | "query" | "selection" | "committed-change", excerpt?: string) {
  return { contextSha256: context.sha256, assessments: context.obligations!.map(obligation => ({ obligationId: obligation.id, status: "supported", reason: "Mock assessment for deterministic contract testing only." })), taskEntitlementVersion: 1, tasks: workflowTaskEvidence(context).map(scene => ({ sceneId: scene.sceneId, promiseExcerpt: excerpt || scene.promiseCopy[0], requiredResult, resultAnswer: "visible-result", postconditionIds: scene.postconditions.map(result => result.id) })) };
}
const invalid = (error: unknown) => error instanceof PipelineError && error.code === "invalid_workflow_coherence";

test("selecting a recipient cannot entitle sending, but honest recipient selection remains legal", () => {
  const select = buildWorkflowContext(picker()), send = buildWorkflowContext(picker("Send a message"));
  assert.equal(workflowTaskEvidence(send)[0].observableExtent, "selection-only");
  assert.deepEqual(workflowTaskEvidence(send)[0].postconditions, []);
  const raw = answer(send, "committed-change"), original = structuredClone(raw), negative = parseWorkflowVerdict(raw, send);
  assert.equal(negative.passed, false); assert.equal(negative.findings[0].code, "unsupported_result");
  assert.equal(negative.normalizations.length, 1); assert.deepEqual(raw, original);
  assert.deepEqual(validateWorkflowVerdict(negative, send), negative);
  assert.equal(parseWorkflowVerdict(answer(select, "selection"), select).passed, true);
});

test("a following completion claim cannot borrow a weaker selection headline", () => {
  const context = buildWorkflowContext(picker("Choose recipient", "Message sent")), evidence = workflowTaskEvidence(context)[0];
  assert.deepEqual(evidence.followingOutcomeCopy, ["Message sent"]);
  const raw = answer(context, "committed-change", "Message sent");
  assert.equal(parseWorkflowVerdict(raw, context).passed, false);
  assert.ok(workflowReadableContext(context).includes('"followingOutcomeCopy":["Message sent"]'));
});

test("a persistent value after actual confirmation supplies a candidate, not a semantic waiver", () => {
  const context = buildWorkflowContext(picker("Send a message", "Message sent", true)), [evidence] = workflowTaskEvidence(context);
  assert.equal(evidence.observableExtent, "result-candidate");
  assert.deepEqual(evidence.postconditions, [{ id: "scene-1-result-3", actionId: "action-3", confirmationActionId: "action-2", elements: [{ elementId: "result", type: "text", before: null, after: "Sent to Alex Rivera" }] }]);
  const raw = answer(context, "committed-change"); assert.equal(parseWorkflowVerdict(raw, context).passed, true);
  raw.assessments[0].status = "contradictory"; assert.equal(parseWorkflowVerdict(raw, context).passed, false);
});

test("selection, query punctuation, reset, empty surfaces and menu closure never become commitment evidence", () => {
  for (const variant of ["punctuation", "reset", "closed", "surface", "unconfirmed"] as const) {
    const script = picker("Send a message"), doc = script.uiDocuments![0], selected = doc.states[1], visual = script.scenes[0].presentation!.visual!;
    assert.equal(visual.kind, "ui-demo"); if (visual.kind !== "ui-demo") throw new Error("Fixture");
    if (variant === "punctuation") selected.textValues[0].text = "[[Alex]]";
    if (variant === "reset") { doc.elements.find(e => e.id === "query")!.text = "Original"; selected.textValues[0].text = "Original"; }
    if (variant === "closed") selected.visibleElementIds = ["label", "query"];
    if (variant === "surface") { doc.elements.push({ ...doc.elements[0], id: "background", type: "panel", text: "", initiallyVisible: false }); selected.visibleElementIds.push("background"); }
    if (variant === "unconfirmed") { visual.actions[1] = { ...visual.actions[1], kind: "pointer" }; visual.actions[2].stateId = "sent"; }
    bind(script); assert.deepEqual(workflowTaskEvidence(buildWorkflowContext(script))[0].postconditions, [], variant);
  }
});

test("a confirmed explicit clearing of a previously nonempty input remains an actual result candidate", () => {
  const script = picker("Clear the search"), doc = script.uiDocuments![0];
  doc.elements.find(element => element.id === "query")!.text = "Previous search";
  doc.states[1].textValues[0].text = ""; bind(script);
  const context = buildWorkflowContext(script), evidence = workflowTaskEvidence(context)[0];
  assert.deepEqual(evidence.postconditions[0].elements, [{ elementId: "query", type: "input", before: "Alex", after: "" }]);
  assert.equal(parseWorkflowVerdict(answer(context, "committed-change"), context).passed, true);
  doc.states[1].visibleElementIds = ["label", "choice"]; bind(script);
  assert.deepEqual(workflowTaskEvidence(buildWorkflowContext(script))[0].postconditions, [], "An invisible clear supplies no visible commitment evidence");
});

test("fresh answers require complete task coverage, exact copy and valid own-scene postconditions", async () => {
  const context = buildWorkflowContext(picker()), raw = answer(context, "selection");
  for (const change of [
    (value: any) => { delete value.tasks; }, (value: any) => { value.tasks = []; }, (value: any) => { value.tasks.push(value.tasks[0]); },
    (value: any) => { value.tasks[0].sceneId = "scene-2"; }, (value: any) => { value.tasks[0].promiseExcerpt = "Fabricated promise"; },
    (value: any) => { value.tasks[0].postconditionIds = ["scene-1-result-3"]; }, (value: any) => { value.taskEntitlementVersion = 2; },
  ]) { const altered = structuredClone(raw); change(altered); assert.throws(() => parseWorkflowVerdict(altered, context, { requireTaskEntitlement: true }), invalid); }
  const { tasks: _tasks, taskEntitlementVersion: _version, ...legacy } = raw;
  assert.equal(parseWorkflowVerdict(legacy, context).passed, true);
  const perform = await prepareWorkflowCoherence(context, { prepareClaude: async <T>(_p: string, _r: string, _i: unknown[] = [], options?: any) => { assert.equal(options.workflowConstraints.taskEntitlementVersion, 1); assert.equal(options.maxOutputTokens, 2048); return async () => legacy as T; } });
  await assert.rejects(perform(), invalid);
  const schema = workflowOutputSchema({ version: 2, contextSha256: context.sha256, sceneIds: ["scene-1"], obligationIds: context.obligations!.map(o => o.id), taskEntitlementVersion: 1 }) as any;
  assert.ok(schema.required.includes("tasks")); assert.ok(!JSON.stringify(schema).includes("anyOf"));
});

test("uncertain task answer never becomes a pass and saved aggregate tampering is detected", () => {
  const context = buildWorkflowContext(picker()), raw = answer(context, "selection"); raw.tasks[0].resultAnswer = "uncertain";
  const verdict = parseWorkflowVerdict(raw, context); assert.equal(verdict.passed, false);
  assert.ok(verdict.normalizations[0].includes("uncertain"));
  assert.throws(() => validateWorkflowVerdict({ ...verdict, passed: true }, context), invalid);
});

test("retained trial h negative and unchanged legacy proof, plus honest copy counterexample", { skip: process.env.STUDIO_WORKFLOW_RETAINED_TEST !== "1" }, async () => {
  const root = join(process.cwd(), ".local/engine-batch-acceptance-20261002h"), path = join(root, "analysis/script.json"), bytes = await readFile(path), script = JSON.parse(bytes.toString()) as Script;
  const context = buildWorkflowContext(script), [evidence] = workflowTaskEvidence(context);
  assert.equal(context.sha256, script.workflowCoherence!.contextSha256);
  assert.deepEqual(await loadWorkflowScript(script.workflowCoherence!, root), script);
  assert.equal(evidence.observableExtent, "selection-only"); assert.deepEqual(evidence.postconditions, []);
  assert.equal(parseWorkflowVerdict(answer(context, "committed-change", "Type [[ to link any note"), context).passed, false);
  const control = structuredClone(script); delete control.workflowCoherence;
  control.scenes.find(scene => scene.presentation?.visual?.kind === "ui-demo")!.headline = "Find a related note";
  const positive = buildWorkflowContext(control); assert.equal(parseWorkflowVerdict(answer(positive, "selection"), positive).passed, true);
  assert.deepEqual(positive.scenes, context.scenes); assert.notEqual(positive.sha256, context.sha256);
  assert.deepEqual(await readFile(path), bytes);
});
