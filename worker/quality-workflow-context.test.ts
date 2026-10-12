import test from "node:test";
import assert from "node:assert/strict";
import { stageDigest } from "./research";
import { workflowObligations, type WorkflowContext, type WorkflowSnapshot } from "./workflow-coherence";
import { qualityWorkflowContext } from "./quality-workflow-context";

function fixture(version: 1 | 2 = 2): WorkflowContext {
  const visible: WorkflowSnapshot["visible"] = Array.from({ length: 14 }, (_, i) => ({
    elementId: `element-${i}`, text: `Exact source label ${i}: "one" → two`, textBasis: "source-ui", selected: false,
    resolvedStyleId: "normal", type: "text", rect: { x: 0.1, y: i / 20, width: 0.7, height: 0.04 },
    appearance: { fill: "#ffffff", color: "#111111", borderColor: "#999999", radius: 4 },
  }));
  const changed = structuredClone(visible);
  changed[0] = { ...changed[0], text: "Changed example", textBasis: "example-content", selected: true, resolvedStyleId: "selected" };
  const snapshots: WorkflowSnapshot[] = [visible, visible, changed, changed].map((items, i) => ({ id: i === 3 ? "final" : `snapshot-${i}`, localFrame: i * 30, stateId: i < 2 ? "before" : "after", basis: i < 2 ? "observed" : "illustrative", evidenceIds: ["fact-1"], visible: structuredClone(items) }));
  const scenes: WorkflowContext["scenes"] = [{ sceneId: "scene-1", documentId: "document", actions: [{ id: "action-1", kind: "click", atFrame: 30, durationFrames: 6, targetId: "element-0", evidenceId: "fact-1" }, { id: "action-2", kind: "state", atFrame: 60, durationFrames: 1, stateId: "after", evidenceId: "fact-1" }], snapshots }];
  const body = { version, bindings: { scriptSha256: "a".repeat(64), researchSha256: "b".repeat(64), evidenceSha256: "c".repeat(64), uiSha256: "d".repeat(64) }, product: "Source product", beats: [{ sceneId: "scene-1", headline: "Exact visible claim", detail: "", assetId: "source", template: "proof", visualKind: "ui-demo", cards: [], connectionLabels: [] }], documents: [], scenes, ...(version === 2 ? { obligations: workflowObligations(scenes) } : {}) };
  return { ...body, sha256: stageDigest(body) };
}

test("QC interning round-trips complete effective context without changing source or states", () => {
  const original = fixture(), before = JSON.stringify(original), packed = JSON.parse(qualityWorkflowContext(original));
  const restored = { ...packed.context, scenes: packed.context.scenes.map((scene: Record<string, unknown> & { snapshots: { visibleRecordIds: number[] }[] }) => ({ ...scene, snapshots: scene.snapshots.map(({ visibleRecordIds, ...snapshot }) => ({ ...snapshot, visible: visibleRecordIds.map(index => packed.visibleRecords[index]) })) })) };
  assert.deepEqual(restored, original);
  assert.equal(JSON.stringify(original), before);
  assert.equal(packed.visibleRecords.length, 15);
  assert.ok(Buffer.byteLength(JSON.stringify(packed)) < Buffer.byteLength(before) * 0.65);
  assert.deepEqual(restored.scenes[0].snapshots[2].visible[0], original.scenes[0].snapshots[2].visible[0]);
});

test("QC interning distinguishes identical labels with changed appearance, geometry and provenance", () => {
  const context = fixture();
  const altered = context.scenes[0].snapshots[2].visible[1];
  altered.appearance!.color = "#222222";
  altered.rect!.x = 0.2;
  altered.textBasis = "example-content";
  context.obligations = workflowObligations(context.scenes);
  const { sha256: _old, ...body } = context;
  context.sha256 = stageDigest(body);
  const packed = JSON.parse(qualityWorkflowContext(context));
  const initial = packed.context.scenes[0].snapshots[0].visibleRecordIds[1];
  const after = packed.context.scenes[0].snapshots[2].visibleRecordIds[1];
  assert.notEqual(initial, after);
  assert.deepEqual(packed.visibleRecords[after], altered);
  assert.equal(packed.visibleRecords[initial].text, altered.text);
});

test("QC transport preserves legacy JSON and rejects tampered context before packing", () => {
  const legacy = fixture(1);
  assert.equal(qualityWorkflowContext(legacy), JSON.stringify(legacy));
  const changed = fixture(); changed.scenes[0].snapshots[0].visible[0].text = "Tampered";
  assert.throws(() => qualityWorkflowContext(changed), /hash changed/);
});

test("small all-unique snapshots retain canonical JSON when pooling would enlarge the request", () => {
  const context = fixture();
  context.scenes[0].snapshots.forEach((snapshot, index) => {
    snapshot.visible = [{ ...snapshot.visible[0], text: `Unique visible text ${index}` }];
  });
  context.obligations = workflowObligations(context.scenes);
  const { sha256: _old, ...body } = context;
  context.sha256 = stageDigest(body);
  const canonical = JSON.stringify(context);
  assert.equal(qualityWorkflowContext(context), canonical);
  assert.ok(context.scenes[0].snapshots.every((snapshot, index) => snapshot.visible[0].text === `Unique visible text ${index}`));
});
