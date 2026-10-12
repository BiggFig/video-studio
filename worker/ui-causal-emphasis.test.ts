import test from "node:test";
import assert from "node:assert/strict";
import { causalUnderlineRect, compileUiCausalEmphasis, expectedUiCausalEmphasis } from "./ui-causal-emphasis";
import type { UiAction, UiDocument } from "./ui-reconstruction";

function fixture() {
  const document: UiDocument = {
    id: "literal", viewport: { width: 600, height: 300 }, sourceAssetIds: ["source"], capabilityFactIds: ["fact-1"], styles: [],
    elements: ["code", "template", "result"].map((id, index) => ({ id, type: "text", text: ["name = 'Ada'", "Hello {name}", "Hello Ada"][index], textBasis: "source-ui", styleId: "body", sourceAssetId: "source", initiallyVisible: true, rect: { x: .1 + index * .3, y: .3, width: .25, height: .1 }, sourceRect: { x: .1 + index * .3, y: .3, width: .25, height: .1 } })),
    states: [{ id: "before", basis: "observed", sourceAssetId: "source", evidenceIds: ["fact-1"], visibleElementIds: ["code", "template", "result"], selectedElementIds: [], textValues: [] }, { id: "after", basis: "illustrative", evidenceIds: ["fact-1"], visibleElementIds: ["code", "template", "result"], selectedElementIds: [], textValues: [{ elementId: "code", text: "name = 'Mina'", textBasis: "example-content" }, { elementId: "result", text: "Hello Mina", textBasis: "example-content" }] }],
    previewBinding: { kind: "literal-preview", codeElementId: "code", templateElementId: "template", resultElementId: "result", contextElementIds: [], evidenceIds: ["fact-1"] },
    terminalResult: { version: 2, beforeStateId: "before", afterStateId: "after", trigger: { kind: "code-edit-complete", elementId: "code", text: "name = 'Mina'", evidenceId: "fact-1" }, resultElementIds: ["result"], evidenceIds: ["fact-1"] },
  };
  const actions: UiAction[] = [{ kind: "type", targetId: "code", text: "name = 'Mina'", evidenceId: "fact-1", atFrame: 30, durationFrames: 24 }, { kind: "state", stateId: "after", evidenceId: "fact-1", atFrame: 60, durationFrames: 1 }];
  return { document, actions, hold: { startFrame: 73, endFrame: 150 } };
}

test("editorial direction refuses ambiguous edits, unchanged results and unavailable gutters", () => {
  const good = fixture(); assert.ok(compileUiCausalEmphasis(good.document, good.actions, good.hold));
  for (const change of [
    (v: ReturnType<typeof fixture>) => { v.actions.unshift({ ...v.actions[0], atFrame: 0 }); },
    (v: ReturnType<typeof fixture>) => { v.actions.push({ ...v.actions[1], atFrame: 90 }); },
    (v: ReturnType<typeof fixture>) => { v.actions[0].text = "Invented"; },
    (v: ReturnType<typeof fixture>) => { v.document.states[1].textValues[1].text = "Hello Ada"; },
    (v: ReturnType<typeof fixture>) => { v.hold.startFrame = 72; },
    (v: ReturnType<typeof fixture>) => { v.document.elements[0].rect.y = .9; },
    (v: ReturnType<typeof fixture>) => { v.document.elements.push({ ...v.document.elements[2], id: "neighbor", rect: { x: .1, y: .405, width: .3, height: .1 } }); },
  ]) { const value = fixture(); change(value); assert.equal(compileUiCausalEmphasis(value.document, value.actions, value.hold), undefined); }
  const rect = causalUnderlineRect(good.document, "code")!;
  assert.ok(rect.y > good.document.elements[0].rect.y + good.document.elements[0].rect.height);
  assert.ok(rect.width <= good.document.elements[0].rect.width);
});

test("editorial frame evaluation is bounded, seek-independent and settled before reading", () => {
  const value = fixture(), track = compileUiCausalEmphasis(value.document, value.actions, value.hold)!;
  const frames = [29, 30, 35, 53, 54, 60, 61, 66, 67, 72, 73, 149, 150], states = frames.map(frame => expectedUiCausalEmphasis(track, frame));
  for (const [index, frame] of frames.entries()) { expectedUiCausalEmphasis(track, 150); assert.deepEqual(expectedUiCausalEmphasis(track, frame), states[index]); }
  assert.equal(states[5].result.opacity, 0); assert.equal(states[6].result.opacity, 1); assert.equal(states[10].result.opacity, .55);
  assert.deepEqual(states[10], states[11]); assert.equal(states[12].result.opacity, 0);
  assert.throws(() => expectedUiCausalEmphasis(track, -1)); assert.throws(() => expectedUiCausalEmphasis(track, 1.5));
});
