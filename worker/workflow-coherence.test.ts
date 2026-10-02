import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { stageDigest } from "./research";
import type { Script } from "./scripting";
import type { UiDocument } from "./ui-reconstruction";
import { PipelineError, type Plan, type WorkerInput } from "./types";
import { Providers, WORKFLOW_COHERENCE_POLICY, qualityReviewPrompt, qualityRepairEnvelope, type QualityRequest } from "./providers";
import { reviewBatch, wholeFilmProofInventory, parseReview } from "./quality";
import { scriptOutputConfig, workflowOutputSchema } from "./model-format";
import { assertWorkflowContext, buildPlanWorkflowContext, buildWorkflowContext, parseWorkflowVerdict, planWorkflowProjection, prepareWorkflowCoherence, scopeWorkflowContext, validateWorkflowVerdict, workflowCoherenceRequest, workflowReadableContext, workflowInputReserve, workflowProjection, workflowScriptSha256, workflowOutputLimit, WORKFLOW_CONTEXT_MAX_BYTES, workflowTaskEvidence } from "./workflow-coherence";

// Source text and action sequence reproduced from the public Obsidian trial6
// evidence. This reduced offline fixture tests extraction/enforcement, not a
// claim that a mocked reviewer has independently understood its meaning.
const paragraph = "In Meditations on First Philosophy the philosopher René Descartes describes a series of doubts about the nature of reality, arriving at the famous phrase:";
function fixture() {
  const rect = { x: .1, y: .1, width: .8, height: .1 };
  const element = (id: string, type: UiDocument["elements"][number]["type"], text: string, visible = true): UiDocument["elements"][number] => ({ id, type, text, textBasis: "source-ui", rect, sourceRect: rect, sourceAssetId: "product-panel-0", styleId: "text", initiallyVisible: visible });
  const document: UiDocument = { id: "wikilink-autocomplete", sourceAssetIds: ["product-panel-0"], capabilityFactIds: ["fact-10", "fact-12"], viewport: { width: 500, height: 385 }, styles: [{ id: "text", fill: "transparent", color: "#eeeeee", borderColor: "transparent", fontSize: 16, fontWeight: 400, radius: 0 }, { id: "selected", fill: "#3d3d3d", color: "#eeeeee", borderColor: "#404040", fontSize: 14, fontWeight: 400, radius: 4 }], elements: [element("note-body", "text", paragraph), element("input-wikilink", "input", "[[I thin]]"), { ...element("item-1", "list-item", "I think therefore I am"), selectedStyleId: "selected" }, element("item-2", "list-item", "Just think about it"), element("item-3", "list-item", "Thinking, Fast and Slow"), { ...element("result-text", "text", "[[Thinking, Fast and Slow]]", false), textBasis: "example-content" }], states: [{ id: "state-autocomplete-open", basis: "observed", sourceAssetId: "product-panel-0", evidenceIds: ["fact-10", "fact-12"], visibleElementIds: ["note-body", "input-wikilink", "item-1", "item-2", "item-3"], selectedElementIds: [], textValues: [] }, { id: "state-link-created", basis: "illustrative", evidenceIds: ["fact-10", "fact-12"], visibleElementIds: ["note-body", "result-text"], selectedElementIds: [], textValues: [] }, { id: "unused", basis: "illustrative", evidenceIds: ["fact-10"], visibleElementIds: ["result-text"], selectedElementIds: [], textValues: [{ elementId: "result-text", text: "UNUSED STATE MUST NOT BECOME EVIDENCE", textBasis: "example-content" }] }] };
  const common = { assetId: "product-panel-0", detail: "", evidenceId: "fact-10", durationSeconds: 4, sourceInSeconds: 0, preserveAudio: false, purpose: "", referenceTechnique: "" };
  const script: Script = { version: 3, jobId: "coherence-fixture", evidenceSha256: "a".repeat(64), researchSha256: "b".repeat(64), sufficientEvidence: true, reason: "", product: "Obsidian", summary: "", accent: "#7c3aed", background: "dark", musicPrompt: "Instrumental fixture only", sfxPrompt: "Soft fixture sound", assumptions: [], uiDocuments: [document], scenes: [
    { ...common, headline: "Obsidian links them", storyRole: "product", presentation: { template: "brand", theme: "dark", transition: "cut" } },
    { ...common, durationSeconds: 9, headline: "Type [[ — connect any note", storyRole: "mechanism", presentation: { template: "proof", theme: "dark", transition: "cut", visual: { kind: "ui-demo", documentId: document.id, actions: [{ kind: "type", atFrame: 30, durationFrames: 18, targetId: "input-wikilink", text: "[[Thinking]]", evidenceId: "fact-12" }, { kind: "click", atFrame: 54, durationFrames: 8, targetId: "item-3", evidenceId: "fact-10" }, { kind: "state", atFrame: 66, durationFrames: 1, stateId: "state-link-created", evidenceId: "fact-10" }] } } },
    { ...common, headline: "Download now", storyRole: "cta", presentation: { template: "cta", theme: "dark", transition: "cut" } },
  ] };
  bindUi(script);
  return script;
}
function bindUi(script: Script) { script.uiSha256 = stageDigest({ version: 1, jobId: script.jobId, evidenceSha256: script.evidenceSha256, researchSha256: script.researchSha256, documents: script.uiDocuments }); }
function asPlan(script: Script): Plan {
  let frame = 0;
  const scenes = script.scenes.map((scene, index) => { const start = frame; frame += Math.ceil(scene.durationSeconds * 30) + 10; return { id: `scene-${index + 1}`, recipeId: scene.recipeId, start_frame: start, duration_frames: frame - start, asset_id: scene.assetId, source_in_seconds: scene.sourceInSeconds, playback_rate: 1 as const, preserve_audio: scene.preserveAudio, fit: "contain" as const, headline: scene.headline, detail: scene.detail, evidence: "Compiler supplied exact source quote", evidence_id: scene.evidenceId, purpose: scene.purpose, reference_technique: scene.referenceTechnique, effects: [], presentation: structuredClone(scene.presentation), storyRole: scene.storyRole, direction: scene.direction }; });
  return { version: 1, job_id: script.jobId, mode: "create", renderer: "hyperframes", output: { width: 1920, height: 1080, fps: 30, duration_frames: frame }, product: script.product, summary: script.summary, accent: script.accent, background: script.background, story: script.story, creativeDirection: script.creativeDirection, audienceLabel: script.audienceLabel, uiDocuments: structuredClone(script.uiDocuments), assets: [], scenes, audio: [], captions: [], music_prompt: script.musicPrompt, sfx_prompt: script.sfxPrompt, assumptions: [], production: { evidenceSha256: script.evidenceSha256, researchSha256: script.researchSha256, uiSha256: script.uiSha256, scriptSha256: workflowScriptSha256(script), shotRecipeSha256: script.shotRecipeSha256 } };
}
const pass = (context: ReturnType<typeof buildWorkflowContext>): any => context.version === 1
  ? { contextSha256: context.sha256, scenes: context.scenes.map(scene => ({ sceneId: scene.sceneId, passed: true })), findings: [] }
  : { contextSha256: context.sha256, assessments: context.obligations!.map(obligation => ({ obligationId: obligation.id, status: "supported", reason: "Offline fixture assessment; this does not certify model accuracy." })) };
const freshPass = (context: ReturnType<typeof buildWorkflowContext>) => ({ ...pass(context), ...(context.version === 2 ? { taskEntitlementVersion: 1, tasks: workflowTaskEvidence(context).map(scene => ({ sceneId: scene.sceneId, promiseExcerpt: scene.promiseCopy[0], requiredResult: scene.postconditions.length ? "committed-change" : scene.observableExtent === "selection-only" ? "selection" : scene.observableExtent === "query-only" ? "query" : "inspect", resultAnswer: "visible-result", postconditionIds: scene.postconditions.map(result => result.id) })) } : {}) });
const negative = (context: ReturnType<typeof buildWorkflowContext>) => {
  const raw = pass(context), target = context.obligations!.find(obligation => obligation.kind === "content")!;
  raw.assessments.find((value: any) => value.obligationId === target.id).status = "contradictory";
  raw.assessments.find((value: any) => value.obligationId === target.id).reason = "The inserted book title falsely completes the persistent famous-phrase attribution.";
  return raw;
};
const issue = (code = "invalid_workflow_coherence") => (error: unknown) => error instanceof PipelineError && error.code === code && error.status === "needs_review";

test("trial6 sequence retains surrounding observed prose and illustrative result together", () => {
  const script = fixture(), before = structuredClone(script), context = buildWorkflowContext(script), scene = context.scenes[0];
  assert.deepEqual(script, before);
  assert.deepEqual(scene.snapshots.map(snapshot => snapshot.id), ["initial", "action-1", "action-2", "action-3", "final"]);
  const final = scene.snapshots.at(-1)!;
  assert.equal(final.visible.find(element => element.elementId === "note-body")!.text, paragraph);
  assert.equal(final.visible.find(element => element.elementId === "note-body")!.textBasis, "source-ui");
  assert.equal(final.visible.find(element => element.elementId === "result-text")!.text, "[[Thinking, Fast and Slow]]");
  assert.equal(final.visible.find(element => element.elementId === "result-text")!.textBasis, "example-content");
  assert.equal(scene.snapshots[1].visible.find(element => element.elementId === "input-wikilink")!.text, "[[Thinking]]");
  assert.equal(JSON.stringify(context).includes("UNUSED STATE MUST NOT BECOME EVIDENCE"), false);
  assert.equal(context.documents[0].sha256, stageDigest(script.uiDocuments![0]));
  assert.equal(final.visible.find(element => element.elementId === "result-text")!.type, "text");
  assert.deepEqual(final.visible.find(element => element.elementId === "result-text")!.rect, script.uiDocuments![0].elements.at(-1)!.rect);
  assert.deepEqual(scene.snapshots[3].changes!.added, ["result-text"]);
  assert.deepEqual(scene.snapshots[1].changes!.textChanged, [{ elementId: "input-wikilink", from: "[[I thin]]", to: "[[Thinking]]" }]);
  const readback = workflowReadableContext(context), last = readback.slice(readback.lastIndexOf("SNAPSHOT final"));
  assert.ok(last.includes(paragraph)); assert.ok(last.includes("[[Thinking, Fast and Slow]]")); assert.match(last, /\[result-text\] text; left=/);
});

test("a selection-only alternative stays incomplete without forcing a menu position", () => {
  const script = fixture(), doc = script.uiDocuments![0], visual = script.scenes[1].presentation!.visual!;
  assert.equal(visual.kind, "ui-demo"); if (visual.kind !== "ui-demo") return;
  // The coherent choice is intentionally the third item in this separate fixture.
  [doc.elements[2].text, doc.elements[4].text] = [doc.elements[4].text, doc.elements[2].text];
  delete doc.elements[2].selectedStyleId; doc.elements[4].selectedStyleId = "selected";
  visual.actions = [{ kind: "type", atFrame: 30, durationFrames: 18, targetId: "input-wikilink", text: "[[I think]]", evidenceId: "fact-12" }, { kind: "select", atFrame: 54, durationFrames: 8, targetId: "item-3", evidenceId: "fact-10" }];
  script.scenes[1].headline = "Find and choose a related note"; bindUi(script);
  const context = buildWorkflowContext(script), final = context.scenes[0].snapshots.at(-1)!;
  assert.equal(final.visible.find(element => element.elementId === "item-3")!.selected, true);
  assert.equal(final.visible.find(element => element.elementId === "item-3")!.resolvedStyleId, "selected");
  assert.equal(final.visible.some(element => element.elementId === "result-text"), false);
  assert.equal(parseWorkflowVerdict(pass(context), context).passed, true); // mocked verdict contract only
  assert.deepEqual(context.obligations!.map(obligation => obligation.kind), ["task"]);
});

test("focused content questions retain exact surrounding prose before the full readback without asserting a relation", () => {
  const context = buildWorkflowContext(fixture()), obligation = context.obligations!.find(value => value.kind === "content")!;
  assert.equal(obligation.snapshotId, "action-3"); assert.deepEqual(obligation.elementIds, ["result-text"]); assert.deepEqual(obligation.contextElementIds, ["note-body"]);
  const readable = workflowReadableContext(context), focused = readable.slice(0, readable.indexOf("SOURCE BINDINGS /"));
  assert.ok(focused.includes(paragraph)); assert.ok(focused.includes("[[Thinking, Fast and Slow]]")); assert.ok(focused.includes('"type":"text"')); assert.ok(focused.includes('"rect":'));
  assert.ok(!("expectedStatus" in obligation)); assert.ok(!("assertedRelation" in obligation));
  const alternative = fixture(); alternative.uiDocuments![0].elements[0].text = "Further reading:"; bindUi(alternative);
  const changed = buildWorkflowContext(alternative), readback = workflowReadableContext(changed);
  assert.deepEqual(changed.obligations, context.obligations); assert.notEqual(changed.sha256, context.sha256); assert.ok(readback.includes("Further reading:"));
  // Same structural candidate; only a real semantic evaluator can judge this different meaning.
});

test("intermediate contradictory content remains a required decision after a later result replaces it", () => {
  const script = fixture(), doc = script.uiDocuments![0], visual = script.scenes[1].presentation!.visual!;
  if (visual.kind !== "ui-demo") throw new Error("Fixture missing workflow");
  doc.states[2] = { id: "later-result", basis: "illustrative", evidenceIds: ["fact-10"], visibleElementIds: ["note-body", "result-text"], selectedElementIds: [], textValues: [{ elementId: "result-text", text: "[[I think therefore I am]]", textBasis: "example-content" }] };
  visual.actions.push({ kind: "state", atFrame: 90, durationFrames: 1, stateId: "later-result", evidenceId: "fact-10" }); bindUi(script);
  const context = buildWorkflowContext(script), raw = pass(context), contents = context.obligations!.filter(value => value.kind === "content");
  assert.deepEqual(contents.map(value => value.snapshotId), ["action-3", "action-4"]);
  raw.assessments.find((value: any) => value.obligationId === contents[0].id).status = "contradictory";
  assert.equal(parseWorkflowVerdict(raw, context).passed, false); assert.equal(parseWorkflowVerdict(raw, context).findings[0].actionId, "action-3");
  const readable = workflowReadableContext(context); assert.ok(readable.includes("[[Thinking, Fast and Slow]]")); assert.ok(readable.includes("[[I think therefore I am]]"));
});

test("all eight negative obligations survive normalization and larger workflows stop before provider preparation", async () => {
  const script = fixture(), doc = script.uiDocuments![0], uiScene = script.scenes[1], visual = uiScene.presentation!.visual!;
  // A compact valid fixture isolates the eight-decision bound from byte limits.
  doc.elements = doc.elements.filter(element => !element.id.startsWith("item-"));
  doc.states[0].visibleElementIds = ["note-body", "input-wikilink"];
  if (visual.kind !== "ui-demo") throw new Error("Missing fixture workflow");
  visual.actions[1].targetId = "input-wikilink"; bindUi(script);
  script.scenes = Array.from({ length: 4 }, () => structuredClone(uiScene));
  const context = buildWorkflowContext(script), raw = pass(context); assert.equal(context.obligations!.length, 8);
  for (const assessment of raw.assessments) assessment.status = "contradictory";
  const verdict = parseWorkflowVerdict(raw, context); assert.equal(verdict.findings.length, 8); assert.equal(verdict.passed, false);
  assert.deepEqual(validateWorkflowVerdict(verdict, context), verdict);
  script.scenes.push(structuredClone(uiScene)); let prepared = false;
  const providers = { prepareClaude: async <T>() => { prepared = true; return async () => ({}) as T; } };
  await assert.rejects(async () => prepareWorkflowCoherence(buildWorkflowContext(script), providers), issue("workflow_complexity")); assert.equal(prepared, false);
});

test("tampering with obligation coverage cannot be hidden by recomputing the context hash", () => {
  const context = buildWorkflowContext(fixture()), modified = structuredClone(context); modified.obligations!.pop();
  const { sha256: _hash, ...body } = modified; modified.sha256 = stageDigest(body);
  assert.throws(() => assertWorkflowContext(modified), issue());
});

test("an entirely empty final UI state stops before any unbound paid result assessment", async () => {
  const script = fixture(); script.uiDocuments![0].states[1].visibleElementIds = []; bindUi(script);
  let prepared = false;
  const providers = { prepareClaude: async <T>() => { prepared = true; return async () => ({}) as T; } };
  await assert.rejects(async () => prepareWorkflowCoherence(buildWorkflowContext(script), providers), issue("workflow_complexity"));
  assert.equal(prepared, false);
  assert.equal(buildWorkflowContext(script, undefined, 1).version, 1); // Legacy context remains byte-compatible.
});

test("adjacent action boundaries preserve the prior completed value, not next action reset", () => {
  const script = fixture(), visual = script.scenes[1].presentation!.visual!;
  if (visual.kind !== "ui-demo") return;
  visual.actions = [visual.actions[0], { ...visual.actions[0], atFrame: 48, text: "[[Other]]" }];
  const scene = buildWorkflowContext(script).scenes[0];
  assert.equal(scene.snapshots[1].visible.find(element => element.elementId === "input-wikilink")!.text, "[[Thinking]]");
  assert.equal(scene.snapshots[2].visible.find(element => element.elementId === "input-wikilink")!.text, "[[Other]]");
});

test("strict obligation coverage derives every failure without a model umbrella pass", () => {
  const context = buildWorkflowContext(fixture()), raw = negative(context), snapshot = structuredClone(raw), verdict = parseWorkflowVerdict(raw, context);
  assert.deepEqual(raw, snapshot); assert.equal(verdict.passed, false); assert.equal(verdict.scenes[0].passed, false);
  assert.equal(verdict.findings[0].actionId, "action-3"); assert.deepEqual(verdict.findings[0].elementIds, ["result-text", "note-body"]);
  assert.deepEqual(validateWorkflowVerdict(verdict, context), verdict);
  for (const mutate of [
    (v: any) => { v.assessments = []; }, (v: any) => { v.assessments.push(v.assessments[0]); },
    (v: any) => { v.assessments[0].obligationId = "scene-99-task"; }, (v: any) => { v.assessments[0].status = "passed"; },
    (v: any) => { v.assessments[0].reason = " "; }, (v: any) => { v.assessments[0].reason = "x".repeat(241); },
    (v: any) => { v.contextSha256 = "0".repeat(64); }, (v: any) => { v.passed = true; },
    (v: any) => { v.scenes = [{ sceneId: "scene-2", passed: true }]; },
  ]) { const bad = structuredClone(raw); mutate(bad); assert.throws(() => parseWorkflowVerdict(bad, context), issue()); }
  const uncertain = pass(context); uncertain.assessments[0].status = "uncertain";
  assert.equal(parseWorkflowVerdict(uncertain, context).passed, false);
  assert.throws(() => validateWorkflowVerdict({ ...verdict, passed: true }, context), issue());
  assert.throws(() => validateWorkflowVerdict({ ...verdict, findings: [] }, context), issue());
  const changed = structuredClone(verdict); changed.scenes[0].passed = true;
  assert.throws(() => validateWorkflowVerdict(changed, context), issue());
});

test("v2 accepts a complete240-character reason unchanged but rejects241", () => {
  const context = buildWorkflowContext(fixture()), raw = negative(context);
  raw.assessments[0].reason = "x".repeat(240);
  const verdict = parseWorkflowVerdict(raw, context);
  assert.equal(verdict.version, 2);
  if (verdict.version !== 2) throw new Error("Wrong fixture contract");
  assert.equal(verdict.assessments[0].reason, raw.assessments[0].reason); assert.equal(verdict.passed, false);
  assert.deepEqual(validateWorkflowVerdict(verdict, context), verdict);
  raw.assessments[0].reason += "x";
  assert.throws(() => parseWorkflowVerdict(raw, context), issue());
});

test("missing second UI-scene obligation cannot certify a partial review", () => {
  const script = fixture(); script.scenes.splice(2, 0, structuredClone(script.scenes[1]));
  const context = buildWorkflowContext(script), raw = pass(context); raw.assessments.pop();
  assert.throws(() => parseWorkflowVerdict(raw, context), issue());
  assert.equal(parseWorkflowVerdict(pass(context), context).scenes.length, 2);
});

test("source, action, timing and copy changes invalidate exact script approval; key order does not", () => {
  const script = fixture(), original = buildWorkflowContext(script);
  const reverse = (value: any): any => Array.isArray(value) ? value.map(reverse) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverse(item)])) : value;
  assert.equal(buildWorkflowContext(reverse(script)).sha256, original.sha256);
  assert.equal(buildWorkflowContext({ ...script, workflowCoherence: { version: 1, contextSha256: original.sha256, verdictSha256: "c".repeat(64), scriptSha256: workflowScriptSha256(script) } }).sha256, original.sha256);
  for (const mutate of [
    (s: Script) => { s.scenes[1].headline = "Now linked"; }, (s: Script) => { s.scenes[1].durationSeconds += 1; },
    (s: Script) => { s.scenes[1].presentation!.transition = "lift"; }, (s: Script) => { const visual = s.scenes[1].presentation!.visual; if (visual?.kind === "ui-demo") visual.actions[0].text = "[[New]]"; },
    (s: Script) => { s.uiDocuments![0].elements[0].text = "Different context"; bindUi(s); },
    (s: Script) => { s.uiDocuments![0].styles[0].fontWeight = 500; bindUi(s); },
  ]) { const changed = structuredClone(script); mutate(changed); const context = buildWorkflowContext(changed); assert.notEqual(context.sha256, original.sha256); assert.throws(() => parseWorkflowVerdict(pass(original), context), issue()); }
  const stale = structuredClone(script); stale.uiDocuments![0].elements[0].text = "Changed without rebinding";
  assert.throws(() => buildWorkflowContext(stale), issue());
});

test("Plan preserves exact semantic projection despite hold extension and verified preview alias", () => {
  const script = fixture(), plan = asPlan(script);
  assert.deepEqual(planWorkflowProjection(plan), workflowProjection(script));
  assert.equal(buildPlanWorkflowContext(plan).sha256, buildWorkflowContext(script).sha256);
  script.scenes[0].assetId = "recording"; plan.scenes[0].asset_id = "recording-typography-still";
  plan.assets = [{ id: "recording", path: "assets/recording.mp4", preview: "analysis/recording.jpg", kind: "video", usage: "output", rights: "fixture", width: 800, height: 600 }, { id: "recording-typography-still", path: "analysis/recording.jpg", kind: "image", usage: "output", rights: "fixture", width: 800, height: 600 }];
  plan.production!.scriptSha256 = workflowScriptSha256(script);
  assert.deepEqual(planWorkflowProjection(plan), workflowProjection(script));
  assert.equal(buildPlanWorkflowContext(plan).sha256, buildWorkflowContext(script).sha256);
  plan.assets[1].path = "assets/unrelated.jpg"; assert.throws(() => planWorkflowProjection(plan), issue());
});

test("whole-film editorial cards and connections remain visible evidence and bind approval", () => {
  const script = fixture(); script.scenes[2].presentation = { template: "features", theme: "dark", transition: "cut", cards: [{ title: "Supported title", body: "Complete body text", evidenceId: "fact-10" }], visual: { kind: "connections", nodes: [{ label: "Ideas", evidenceId: "fact-10" }, { label: "Notes", evidenceId: "fact-12" }] } };
  const context = buildWorkflowContext(script), plan = asPlan(script);
  plan.scenes[2].presentation!.cards![0].evidence = "Compiler supplied quote";
  const visual = plan.scenes[2].presentation!.visual!; if (visual.kind === "connections") visual.nodes[0].evidence = "Another exact quote";
  assert.deepEqual(context.beats[2].cards, [{ title: "Supported title", body: "Complete body text", evidenceId: "fact-10" }]);
  assert.deepEqual(context.beats[2].connectionLabels, ["Ideas", "Notes"]);
  assert.deepEqual(planWorkflowProjection(plan), workflowProjection(script));
  script.scenes[2].presentation.cards![0].body = "Contradictory altered outcome";
  assert.notEqual(buildWorkflowContext(script).sha256, context.sha256);
});

test("bounded complete evidence fails rather than clipping oversized visible context", () => {
  const script = fixture(), original = buildWorkflowContext(script), tampered = structuredClone(original);
  for (const state of tampered.scenes[0].snapshots) state.visible.find(element => element.elementId === "note-body")!.text = "x".repeat(WORKFLOW_CONTEXT_MAX_BYTES);
  const { sha256: _hash, ...body } = tampered; tampered.sha256 = stageDigest(body);
  assert.throws(() => assertWorkflowContext(tampered), issue("workflow_context_budget"));
  tampered.sha256 = original.sha256; assert.throws(() => assertWorkflowContext(tampered), issue());
});

test("QC scoping retains adjacent beat copy without certifying out-of-batch UI", () => {
  const script = fixture(); script.scenes.splice(2, 0, structuredClone(script.scenes[1]));
  const context = buildWorkflowContext(script), scoped = scopeWorkflowContext(context, ["scene-1", "scene-2"])!;
  assert.equal(scoped.scenes.length, 1); assert.equal(scoped.beats.length, 4);
  assert.deepEqual(scoped.beats, context.beats); assert.notEqual(scoped.sha256, context.sha256);
  assert.equal(scopeWorkflowContext(context, ["scene-1", "scene-4"]), undefined);
  assert.throws(() => scopeWorkflowContext(context, ["unknown"]), issue());
});

test("final QC receives exact context, rejects stale actions, and reserves its entire bounded payload", () => {
  const script = fixture(), plan = asPlan(script), full = buildPlanWorkflowContext(plan), workflowContext = scopeWorkflowContext(full, ["scene-1", "scene-2"])!;
  const asset = { id: "product-panel-0", path: "source.jpg", kind: "image" as const, usage: "output" as const, rights: "Offline public-source fixture", width: 500, height: 385 };
  plan.assets = [asset];
  const batch = reviewBatch(plan, [{ sceneId: "scene-1", path: "unused-1.jpg", label: "fixture" }, { sceneId: "scene-2", path: "unused-2.jpg", label: "fixture" }]);
  const evidence = { text: "Links create connections between notes.", assets: [asset] };
  const request: QualityRequest = { plan: batch.plan, motion: batch.motion, evidence, wholeFilmProof: wholeFilmProofInventory(plan), measurements: {}, heard: { text: "", words: [] }, sourceSpeech: [], defaultStyle: null, workflowContext };
  const plain = qualityReviewPrompt({ ...request, workflowContext: undefined }), withContext = qualityReviewPrompt(request);
  assert.ok(withContext.includes(JSON.stringify(workflowContext)));
  assert.ok(withContext.includes(paragraph));
  const bad = structuredClone(request); const visual = bad.plan.scenes[1].presentation!.visual;
  if (visual?.kind === "ui-demo") visual.actions[0].text = "Changed after context was prepared";
  assert.throws(() => qualityReviewPrompt(bad), error => error instanceof PipelineError && error.code === "invalid_quality_review");
  const research = { facts: [{ evidenceId: "fact-10", quote: evidence.text, label: "Links", kind: "feature" as const }], visuals: [{ assetId: asset.id, description: "Original UI", supportsFactIds: ["fact-10"], showsProductUi: true }] };
  const legacyEnvelope = qualityRepairEnvelope(plan, evidence, research);
  plan.production!.workflowCoherence = { version: 1, contextSha256: full.sha256, scriptSha256: full.bindings.scriptSha256, verdictSha256: "d".repeat(64) };
  const gatedEnvelope = qualityRepairEnvelope(plan, evidence, research);
  assert.ok(gatedEnvelope.batches[0].variableBytes - legacyEnvelope.batches[0].variableBytes >= Buffer.byteLength(withContext, "utf8") - Buffer.byteLength(plain, "utf8"));
  assert.equal(gatedEnvelope.batches[0].variableBytes - legacyEnvelope.batches[0].variableBytes, WORKFLOW_CONTEXT_MAX_BYTES + 2048);
  const review = parseReview({ readabilityPassed: true, claimsPassed: true, realVisualsPassed: true, renderIntegrityPassed: true, referenceStyleReviewed: true, referenceStylePassed: true, audioTranscriptPassed: true, uiBehaviorReviewed: true, uiBehaviorPassed: true, findings: [{ severity: "major", check: "ui_behavior", sceneId: "scene-2", evidence: "Final rendered note-body and result-text read as a false attribution.", message: "The inserted title contradicts its persistent source sentence." }], notes: [] });
  assert.equal(review.uiBehaviorPassed, false); assert.equal(review.findings.length, 1);
});

test("prepare is separate from invoke, text-only, scoped2048 total output and unchanged downstream reserve", async () => {
  const context = buildWorkflowContext(fixture()), reserve = { calls: 3, inputTokens: 45_000, outputTokens: 9000 }; let prepared = false, invoked = false;
  const providers = { prepareClaude: async <T>(purpose: string, prompt: string, images: unknown[] = [], options?: any) => { prepared = true; assert.equal(purpose, "workflow-coherence"); assert.deepEqual(images, []); assert.deepEqual(options.reserve, reserve); assert.equal(options.maxOutputTokens, 2048); assert.equal(options.policy, "workflow-coherence-v2"); assert.deepEqual(options.workflowConstraints.sceneIds, ["scene-2"]); assert.ok(prompt.includes(paragraph)); return async () => { invoked = true; return freshPass(context) as T; }; } };
  const perform = await prepareWorkflowCoherence(context, providers, reserve); assert.equal(prepared, true); assert.equal(invoked, false);
  assert.equal((await perform()).passed, true); assert.equal(invoked, true);
});

test("workflow structured grammar is flat and IDs are bounded; Gateway keeps local validation", () => {
  const constraints = { contextSha256: "a".repeat(64), sceneIds: ["scene-2"], obligationIds: ["scene-2-task"] }, schema = workflowOutputSchema(constraints) as any;
  assert.deepEqual(schema.properties.contextSha256.enum, [constraints.contextSha256]);
  assert.equal(schema.additionalProperties, false); assert.ok(!JSON.stringify(schema).includes("anyOf"));
  assert.deepEqual(schema.properties.assessments.items.required, ["obligationId", "status", "reason"]); assert.equal(schema.properties.scenes, undefined);
  assert.deepEqual(scriptOutputConfig("claude-sonnet-4-6", true, "workflow-coherence-v2", undefined, undefined, constraints)?.format.schema, schema);
  assert.equal(scriptOutputConfig("anthropic/claude-sonnet-4.6", false, "workflow-coherence-v1", undefined, undefined, constraints), undefined);
  assert.throws(() => workflowOutputSchema({ ...constraints, sceneIds: ["scene-2", "scene-2"] }));
});

test("legacy context, normalized verdict and standalone retained review keep their original contract", async () => {
  const script = fixture(), old = buildWorkflowContext(script, undefined, 1), current = buildWorkflowContext(script), raw = pass(old);
  assert.equal(old.version, 1); assert.equal(current.version, 2); assert.notEqual(old.sha256, current.sha256);
  assert.equal(old.scenes[0].snapshots[0].visible[0].type, undefined); assert.equal(old.scenes[0].snapshots[1].changes, undefined);
  assert.equal(validateWorkflowVerdict(parseWorkflowVerdict(raw, old), old).version, 1);
  assert.throws(() => parseWorkflowVerdict({ ...raw, contextSha256: current.sha256 }, current), issue());
  const perform = await prepareWorkflowCoherence(old, { prepareClaude: async <T>(_purpose: string, prompt: string, _images = [], options?: any) => {
    assert.equal(options.policy, "workflow-coherence-v1"); assert.equal(options.workflowConstraints.version, 1); assert.equal(options.maxOutputTokens, 768);
    assert.ok(prompt.includes('scenes:[{sceneId,passed}]')); assert.equal(prompt.includes('assessments:['), false);
    const schema = scriptOutputConfig("claude-sonnet-4-6", true, options.policy, undefined, undefined, options.workflowConstraints)!.format.schema as any;
    assert.equal(schema.properties.scenes.items.properties.content, undefined);
    return async () => raw as T;
  } });
  assert.equal((await perform()).version, 1);
});

async function temporary(t: TestContext) {
  const root = await realpath(tmpdir()), path = await mkdtemp(join(root, "video-studio-workflow-"));
  t.after(async () => { const checked = await realpath(path); if (resolve(checked) !== resolve(path) || dirname(checked) !== root || !basename(checked).startsWith("video-studio-workflow-")) throw new Error("Unsafe test cleanup path"); await rm(checked, { recursive: true, force: true }); });
  return path;
}
test("real provider adapter counts exact thinking request, persists2048 reservation, and fallback fits future reserve", async t => {
  const path = await temporary(t), context = buildWorkflowContext(fixture()), keys = ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "ELEVENLABS_API_KEY"];
  for (const key of keys) { const old = process.env[key]; t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; }); }
  process.env.ANTHROPIC_API_KEY = "offline-mock-only"; process.env.ELEVENLABS_API_KEY = "offline-mock-only"; process.env.ANTHROPIC_MODEL = "claude-sonnet-4-6";
  const input: WorkerInput = { jobId: "workflow-adapter", ownerId: "test", mode: "url", productUrl: "https://example.com", videoType: "launch", format: "auto", files: [], budgets: { maxModelCalls: 10, maxModelInputTokens: 200000, maxModelOutputTokens: 30000 } };
  const providers = new Providers(path, input, { persist: async () => {}, state: async () => {}, complete: async () => {} }); providers.skillHash = "f".repeat(64);
  let countBody: any, generation = 0;
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    if (String(url).endsWith("count_tokens")) { countBody = body; return new Response("count unavailable", { status: 503 }); }
    generation++; assert.equal(body.max_tokens, workflowOutputLimit()); assert.match(body.system, /independent semantic reviewer/);
    assert.deepEqual(body.thinking, { type: "enabled", budget_tokens: 1024 }); assert.equal("temperature" in body, false);
    const { max_tokens: _tokens, temperature: _temperature, ...inputBody } = body; assert.deepEqual(inputBody, countBody);
    const audit = JSON.parse(await readFile(join(path, "analysis/model-1-workflow-coherence-budget.json"), "utf8"));
    assert.equal(audit.status, "reserved"); assert.equal(audit.reservation.outputTokens, 2048); assert.equal(audit.systemPolicy, "workflow-coherence-v2"); assert.ok(audit.reservation.inputTokens <= workflowInputReserve());
    return new Response(JSON.stringify({ model: "claude-sonnet-4-6", usage: { input_tokens: 1000, output_tokens: 100 }, content: [{ type: "text", text: JSON.stringify(freshPass(context)) }] }));
  });
  const perform = await prepareWorkflowCoherence(context, providers, { calls: 3, inputTokens: 45000, outputTokens: 9000 }); assert.equal(generation, 0);
  assert.equal((await perform()).passed, true); assert.equal(generation, 1); assert.equal(providers.ledger.modelCalls, 1);
  const maximumGrammar = { output_config: { format: { type: "json_schema", schema: workflowOutputSchema({ contextSha256: "f".repeat(64), sceneIds: Array.from({ length: 10 }, (_, i) => `scene-${i + 1}`), obligationIds: Array.from({length:8},(_,i)=>`scene-${i+10}-content-6`) }) } } };
  const promptOverhead = Buffer.byteLength(workflowCoherenceRequest(context), "utf8") - Buffer.byteLength(workflowReadableContext(context), "utf8");
  const boundedFallback = WORKFLOW_CONTEXT_MAX_BYTES + promptOverhead + Buffer.byteLength(WORKFLOW_COHERENCE_POLICY + `\nPolicy: workflow-coherence-v1. Pinned unified skill SHA-256: ${"f".repeat(64)}.` + JSON.stringify(maximumGrammar), "utf8") + 1024;
  assert.ok(workflowInputReserve() >= boundedFallback);
});

test("retained actual trial6 script/plan extraction is identical without modifying artifacts", { skip: process.env.STUDIO_WORKFLOW_RETAINED_TEST !== "1" }, async () => {
  const root = join(process.cwd(), ".local/engine-batch-acceptance-20261002f"), scriptBytes = await readFile(join(root, "analysis/script.json")), planBytes = await readFile(join(root, "plan.json"));
  const script = JSON.parse(scriptBytes.toString()), plan = JSON.parse(planBytes.toString()), context = buildWorkflowContext(script);
  assert.equal(buildPlanWorkflowContext(plan).sha256, context.sha256);
  const final = context.scenes.find(scene => scene.sceneId === "scene-3")!.snapshots.at(-1)!;
  assert.equal(final.visible.find(element => element.elementId === "note-body")!.text, paragraph);
  assert.equal(final.visible.find(element => element.elementId === "result-text")!.text, "[[Thinking, Fast and Slow]]");
  assert.deepEqual(await readFile(join(root, "analysis/script.json")), scriptBytes); assert.deepEqual(await readFile(join(root, "plan.json")), planBytes);
});

test("all retained semantic controls preserve v1 hashes and expose v2 final text and shape deltas within32KiB", { skip: process.env.STUDIO_WORKFLOW_RETAINED_TEST !== "1" }, async () => {
  for (const name of ["01-obsidian-original-bad", "02-obsidian-coherent-control", "03-excal-original-causal-defect"]) {
    const base = join(process.cwd(), ".local/workflow-semantic-20261002/cases", name), bytes = await readFile(join(base, "script.json"));
    const script = JSON.parse(bytes.toString()), old = JSON.parse(await readFile(join(base, "context.json"), "utf8")), verdict = JSON.parse(await readFile(join(base, "verdict.json"), "utf8"));
    const legacy = buildWorkflowContext(script, undefined, 1), context = buildWorkflowContext(script), text = workflowReadableContext(context);
    assert.equal(legacy.sha256, old.sha256); assert.equal(validateWorkflowVerdict(verdict, legacy).version, 1);
    assert.ok(Buffer.byteLength(JSON.stringify(context)) <= WORKFLOW_CONTEXT_MAX_BYTES); assert.ok(Buffer.byteLength(text) <= WORKFLOW_CONTEXT_MAX_BYTES);
    if (name.startsWith("03")) {
      const scene = context.scenes[0], clicked = scene.snapshots.find(s => s.id === "action-2")!, result = scene.snapshots.find(s => s.id === "action-3")!;
      assert.deepEqual(clicked.changes!.added, []); assert.deepEqual(clicked.changes!.appearanceChanged, []);
      assert.ok(result.changes!.added.includes("rect-ghost")); assert.ok(result.changes!.appearanceChanged.includes("btn-rect"));
      const rectangle = result.visible.find(e => e.elementId === "rect-ghost")!;
      assert.equal(rectangle.type, "panel"); assert.equal(rectangle.text, ""); assert.ok(rectangle.rect!.y > .3); assert.ok(rectangle.appearance!.borderColor !== "transparent");
      assert.ok(text.includes("[rect-ghost] panel; left="));
      const obligation = context.obligations!.find(value => value.kind === "causal" && value.elementIds.includes("rect-ghost"));
      assert.ok(obligation); assert.equal(obligation.snapshotId, "action-3"); assert.deepEqual(obligation.actionIds, ["action-1", "action-2", "action-3"]);
      assert.equal(context.obligations!.some(value => value.kind === "causal" && value.snapshotId === "action-2"), false);
    }
    assert.deepEqual(await readFile(join(base, "script.json")), bytes);
  }
});

test("retained first obligation response parses as a rejection without changing the failed run", { skip: process.env.STUDIO_WORKFLOW_RETAINED_TEST !== "1" }, async () => {
  const base = join(process.cwd(), ".local/workflow-obligations-20261002"), casePath = join(base, "cases/01-obsidian-retained-wrong-attribution");
  const paths = [join(casePath, "context.json"), join(casePath, "raw-response.json"), join(casePath, "failed.json"), join(base, "report.json"), join(base, "ledgers/group-1/analysis/model-1-workflow-coherence.json")];
  const original = await Promise.all(paths.map(path => readFile(path)));
  const context = JSON.parse(original[0].toString()), raw = JSON.parse(original[1].toString()), verdict = parseWorkflowVerdict(raw, context);
  assert.equal(verdict.version, 2); assert.equal(verdict.passed, false); assert.ok(verdict.findings.length >= 2);
  if (verdict.version !== 2) throw new Error("Wrong retained contract");
  const content = context.obligations.find((value: any) => value.kind === "content"), causal = context.obligations.find((value: any) => value.kind === "causal");
  assert.equal(verdict.assessments.find(value => value.obligationId === content.id)!.status, "contradictory");
  assert.equal(verdict.assessments.find(value => value.obligationId === causal.id)!.status, "supported");
  for (const assessment of verdict.assessments) assert.equal(assessment.reason, raw.assessments.find((value: any) => value.obligationId === assessment.obligationId).reason);
  assert.ok(verdict.assessments.some(value => value.reason.length > 160));
  assert.deepEqual(validateWorkflowVerdict(verdict, context), verdict);
  assert.deepEqual(await Promise.all(paths.map(path => readFile(path))), original);
});
