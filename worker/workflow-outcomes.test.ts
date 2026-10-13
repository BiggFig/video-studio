import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Script } from "./scripting";
import { stageDigest } from "./research";
import { PipelineError } from "./types";
import { assertWorkflowContext, buildWorkflowContext, parseWorkflowVerdict, prepareWorkflowCoherence, scopeWorkflowContext, validateWorkflowVerdict, workflowCoherenceRequest, workflowPromiseEvidence, workflowOutputLimit, workflowReadableContext, WORKFLOW_CONTEXT_MAX_BYTES, WORKFLOW_MAX_OBLIGATIONS, type WorkflowContext } from "./workflow-coherence";
import { workflowOutputSchema } from "./model-format";

// This actual retained response missed an outcome. Offline responses below test
// coverage and normalization, never claim a mock understands product semantics.
const retained = JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/workflow-outcomes/baserow-v10.json"), "utf8"));
const script = () => structuredClone(retained.script) as Script;
const current = (value = script()) => buildWorkflowContext(value, undefined, 2, 1);
// Smaller synthetic control for combinatorial bounds; the retained regression
// above always uses the complete original document and source bindings.
function smallScript() {
  const value = script(), document = value.uiDocuments![0], keep = new Set(["el-li-email", "el-email-node-label"]);
  document.elements = document.elements.filter(element => keep.has(element.id));
  for (const state of document.states) {
    state.visibleElementIds = state.visibleElementIds.filter(id => keep.has(id));
    state.selectedElementIds = state.selectedElementIds.filter(id => keep.has(id));
    state.textValues = state.textValues.filter(text => keep.has(text.elementId));
  }
  document.terminalResult!.resultElementIds = ["el-email-node-label"];
  value.uiSha256 = stageDigest({ version: 1, jobId: value.jobId, evidenceSha256: value.evidenceSha256, researchSha256: value.researchSha256, documents: value.uiDocuments });
  return value;
}
const invalid = (error: unknown) => error instanceof PipelineError && error.code === "invalid_workflow_coherence";
const answer = (context: WorkflowContext) => ({
  contextSha256: context.sha256,
  assessments: context.obligations!.map(obligation => ({ obligationId: obligation.id, status: "supported", reason: "Offline coverage fixture; not a model semantic acceptance." })),
  taskEntitlementVersion: 2,
  tasks: workflowPromiseEvidence(context).map(promise => ({ obligationId: promise.obligationId, promiseExcerpt: promise.promiseCopy[0], requiredResult: "committed-change", resultAnswer: "visible-result", postconditionIds: promise.postconditions.map(result => result.id) })),
});

test("actual Baserow v10 pass remains legacy-readable but cannot satisfy fresh outcome coverage", () => {
  const legacy = buildWorkflowContext(script());
  assert.equal(legacy.sha256, retained.contextSha256);
  assert.equal(validateWorkflowVerdict(retained.verdict, legacy).passed, true);
  const context = current(), outcome = context.obligations!.find(obligation => obligation.kind === "outcome")!;
  assert.deepEqual({ id: outcome.id, sceneId: outcome.sceneId, outcomeSceneId: outcome.outcomeSceneId, promiseCopy: outcome.promiseCopy }, { id: "scene-3-outcome-4", sceneId: "scene-3", outcomeSceneId: "scene-4", promiseCopy: ["Automation fires on every new row"] });
  assert.equal(context.obligations!.length, legacy.obligations!.length + 1);
  assert.notEqual(context.sha256, legacy.sha256);
  const { assessments, tasks } = retained.verdict;
  assert.equal(tasks[0].promiseExcerpt, "Add an email action in one click");
  assert.throws(() => parseWorkflowVerdict({ contextSha256: context.sha256, assessments, tasks, taskEntitlementVersion: 1 }, context), invalid);
});

test("outcome cannot borrow the weaker preceding headline or disappear behind complete assessments", () => {
  const context = current(), raw = answer(context);
  for (const mutate of [
    (value: any) => value.tasks.pop(),
    (value: any) => { value.tasks[1].obligationId = value.tasks[0].obligationId; },
    (value: any) => { value.tasks[1].promiseExcerpt = value.tasks[0].promiseExcerpt; },
    (value: any) => { value.tasks[1].postconditionIds = ["scene-4-result-2"]; },
    (value: any) => { delete value.tasks; delete value.taskEntitlementVersion; },
    (value: any) => { value.assessments = value.assessments.filter((row: any) => !row.obligationId.includes("-outcome-")); },
  ]) { const changed = structuredClone(raw); mutate(changed); assert.throws(() => parseWorkflowVerdict(changed, context), invalid); }
});

test("separate preparation-only or uncertain outcome blocks a supported add-action task", () => {
  const context = current();
  for (const resultAnswer of ["preparation-only", "uncertain"]) {
    const raw = answer(context), original = structuredClone(raw);
    raw.tasks[1].resultAnswer = resultAnswer; raw.tasks[1].postconditionIds = [];
    const review = parseWorkflowVerdict(raw, context);
    if (review.version !== 2) throw Error("Expected v2 fixture");
    assert.equal(review.passed, false); assert.equal(review.findings.length, 1);
    assert.equal(review.findings[0].sceneId, "scene-3"); assert.equal(review.findings[0].code, "unsupported_result");
    assert.match(review.normalizations[0], /scene-3-outcome-4/);
    assert.equal(review.assessments[0].status, original.assessments[0].status);
    assert.deepEqual(validateWorkflowVerdict(review, context), review);
    assert.throws(() => validateWorkflowVerdict({ ...review, passed: true }, context), invalid);
  }
});

test("honest narrower outcome can pass without a product-specific verb classifier", () => {
  const value = script(); value.scenes[3].headline = "Email action added to the canvas";
  const context = current(value), raw = answer(context);
  assert.equal(parseWorkflowVerdict(raw, context).passed, true);
  assert.equal(raw.tasks[1].promiseExcerpt, value.scenes[3].headline);
  assert.equal(context.scenes[0].snapshots.at(-1)!.visible.some(element => element.text === "Send an email"), true);
  // A candidate is necessary structural evidence, not automatic meaning proof.
  raw.assessments.find(assessment => assessment.obligationId === "scene-3-outcome-4")!.status = "contradictory";
  assert.equal(parseWorkflowVerdict(raw, context).passed, false);
});

test("every following outcome retains all visible copy and scopes to its own preceding UI", () => {
  const value = smallScript(), secondUi = structuredClone(value.scenes[2]), secondOutcome = structuredClone(value.scenes[3]);
  secondOutcome.headline = "Second workflow result";
  value.scenes.splice(4, 0, secondUi, secondOutcome);
  value.scenes[3].detail = "Including the stated condition";
  value.scenes[3].presentation!.cards = [{ title: "Required card", body: "Its full claim", evidenceId: value.scenes[3].evidenceId }];
  const context = current(value), promises = workflowPromiseEvidence(context);
  assert.deepEqual(promises.map(promise => [promise.obligationId, promise.sceneId]), [["scene-3-task", "scene-3"], ["scene-3-outcome-4", "scene-3"], ["scene-5-task", "scene-5"], ["scene-5-outcome-6", "scene-5"]]);
  assert.deepEqual(promises[1].promiseCopy, ["Automation fires on every new row", "Including the stated condition", "Required card", "Its full claim"]);
  const scoped = scopeWorkflowContext(context, ["scene-3"])!;
  assert.equal(scoped.outcomeObligationVersion, 1);
  assert.deepEqual(workflowPromiseEvidence(scoped).map(promise => promise.obligationId), ["scene-3-task", "scene-3-outcome-4"]);
  assert.equal(scoped.beats.length, context.beats.length);
});

test("outcomes count against unchanged eight obligations and oversized work stops before provider preflight", async () => {
  const value = smallScript(); value.scenes.pop(); value.scenes.splice(4, 0, ...Array.from({ length: 5 }, () => structuredClone(value.scenes[3])));
  assert.equal(current(value).obligations!.length, WORKFLOW_MAX_OBLIGATIONS);
  value.scenes.splice(4, 0, structuredClone(value.scenes[3]));
  let prepared = 0;
  await assert.rejects(async () => prepareWorkflowCoherence(current(value), { prepareClaude: async () => { prepared++; throw Error("Unexpected provider call"); } }), error => error instanceof PipelineError && error.code === "workflow_complexity");
  assert.equal(prepared, 0); assert.equal(workflowOutputLimit(2), 2048);
});

test("recomputed context hashes cannot hide removed or rebound outcome obligations", () => {
  for (const mutate of [(context: WorkflowContext) => { context.obligations!.splice(1, 1); }, (context: WorkflowContext) => { context.obligations![1].promiseCopy = ["A weaker promise"]; }, (context: WorkflowContext) => { context.obligations![1].outcomeSceneId = "scene-5"; }]) {
    const changed = current(); mutate(changed); const { sha256: _hash, ...body } = changed; changed.sha256 = stageDigest(body);
    assert.throws(() => assertWorkflowContext(changed), invalid);
  }
});

test("fresh request grammar requires per-promise answers inside the existing policy and budget", async () => {
  const context = current(), reserve = { calls: 2, inputTokens: 12000, outputTokens: 6000 };
  const invoke = await prepareWorkflowCoherence(context, { prepareClaude: async <T>(_purpose: string, prompt: string, _images = [], options?: any) => {
    assert.equal(options.policy, "workflow-coherence-v2"); assert.equal(options.maxOutputTokens, 2048); assert.deepEqual(options.reserve, reserve);
    assert.equal(options.workflowConstraints.taskEntitlementVersion, 2);
    const schema = workflowOutputSchema(options.workflowConstraints) as any;
    assert.deepEqual(schema.properties.tasks.items.properties.obligationId.enum, ["scene-3-task", "scene-3-outcome-4"]);
    assert.equal(schema.properties.tasks.items.properties.sceneId, undefined);
    assert.equal(JSON.stringify(schema).includes("anyOf"), false);
    assert.match(prompt, /REQUIRED OUTCOME BEAT scene-4/); assert.match(prompt, /An added unconfigured action is not proof of execution/);
    return async () => answer(context) as T;
  } }, reserve);
  assert.equal((await invoke()).passed, true);
  assert.match(workflowCoherenceRequest(context), /taskEntitlementVersion:2/);
});

test("complete retained Baserow plus new outcome fits unchanged readback ceiling and expands exactly", () => {
  const context = current(), before = JSON.stringify(context), readback = workflowReadableContext(context);
  const prefix = "COMPLETE EFFECTIVE WORKFLOW CONTEXT (lossless indexed records when smaller): ";
  const packed = JSON.parse(readback.slice(readback.indexOf(prefix) + prefix.length));
  assert.equal(packed.transport, "workflow-context-interned-v1");
  const restored = { ...packed.context, scenes: packed.context.scenes.map((scene: any) => ({ ...scene, snapshots: scene.snapshots.map(({ visibleRecordIds, ...snapshot }: any) => ({ ...snapshot, visible: visibleRecordIds.map((index: number) => packed.visibleRecords[index]) })) })) };
  assert.deepEqual(restored, context);
  assert.equal(JSON.stringify(context), before);
  assert.ok(Buffer.byteLength(readback, "utf8") <= WORKFLOW_CONTEXT_MAX_BYTES);
  assert.deepEqual(restored.obligations, context.obligations);
  assert.equal(restored.outcomeObligationVersion, 1);
});
