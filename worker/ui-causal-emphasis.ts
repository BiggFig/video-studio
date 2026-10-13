import type { UiAction, UiDocument } from "./ui-reconstruction";
import { expectedUiState } from "./ui-state";

/** Editorial ink, never a product selection/control or an extra state change. */
export interface UiCausalEmphasisTrack {
  version: 1;
  input: { elementId: string; startFrame: number; completeFrame: number };
  result: { elementId: string; startFrame: number; settleFrame: number; endFrame: number };
}

/** Direction is available only for the unique, already validated literal relation. */
export function compileUiCausalEmphasis(document: UiDocument, actions: UiAction[], hold: { startFrame: number; endFrame: number }): UiCausalEmphasisTrack | undefined {
  const binding = document.previewBinding, terminal = document.terminalResult;
  if (!binding || terminal?.version !== 2 || terminal.trigger.elementId !== binding.codeElementId || terminal.resultElementIds.length !== 1 || terminal.resultElementIds[0] !== binding.resultElementId) return;
  const edits = actions.filter(action => action.kind === "type" && action.targetId === binding.codeElementId);
  const results = actions.filter(action => action.kind === "state" && action.stateId === terminal.afterStateId);
  if (edits.length !== 1 || results.length !== 1) return;
  const edit = edits[0], result = results[0], completeFrame = edit.atFrame + edit.durationFrames, resultFrame = result.atFrame + result.durationFrames;
  if (edit.text !== terminal.trigger.text || edit.evidenceId !== terminal.trigger.evidenceId || result.atFrame < completeFrame || hold.startFrame < resultFrame + 12 || hold.endFrame <= hold.startFrame) return;
  // Never emphasize a future result or a later reset of the same relation.
  if (actions.some(action => action.atFrame > result.atFrame && action.kind !== "pointer")) return;
  const before = expectedUiState(document, actions, resultFrame - 1), after = expectedUiState(document, actions, resultFrame);
  if (!before.elements[binding.codeElementId]?.visible || !after.elements[binding.codeElementId]?.visible || !after.elements[binding.resultElementId]?.visible || before.elements[binding.resultElementId]?.text === after.elements[binding.resultElementId]?.text) return;
  for (const id of [binding.codeElementId, binding.resultElementId]) {
    const element = document.elements.find(value => value.id === id);
    if (!element || !causalUnderlineRect(document, id)) return;
  }
  return { version: 1, input: { elementId: binding.codeElementId, startFrame: edit.atFrame, completeFrame }, result: { elementId: binding.resultElementId, startFrame: resultFrame, settleFrame: resultFrame + 12, endFrame: hold.endFrame } };
}

/** Confine the editorial underline to an empty gutter beneath its exact subject. */
export function causalUnderlineRect(document: UiDocument, elementId: string) {
  const element = document.elements.find(value => value.id === elementId);
  if (!element) return;
  const r = element.rect, rect = { x: r.x, y: r.y + r.height + 3 / document.viewport.height, width: Math.min(r.width, 100 / document.viewport.width), height: 3 / document.viewport.height };
  if (rect.y + rect.height > 1) return;
  if (document.elements.some(other => other.id !== elementId && other.type !== "panel" && other.rect.x < rect.x + rect.width && other.rect.x + other.rect.width > rect.x && other.rect.y < rect.y + rect.height && other.rect.y + other.rect.height > rect.y)) return;
  return rect;
}

/** Self-contained frame evaluator; embeds unchanged in the trusted renderer. */
export function expectedUiCausalEmphasis(track: UiCausalEmphasisTrack, frame: number) {
  if (!Number.isInteger(frame) || frame < 0) throw new Error("Editorial emphasis requires a nonnegative integer frame");
  const inputAge = frame - track.input.startFrame, resultAge = frame - track.result.startFrame;
  const active = frame < track.result.endFrame;
  const inputReveal = Math.max(0, Math.min(1, (inputAge + 1) / 6));
  const resultReveal = Math.max(0, Math.min(1, (resultAge + 1) / 6));
  return {
    input: { opacity: active && inputAge >= 0 ? .85 * Math.max(0, Math.min(1, 1 - resultAge / 6)) : 0, reveal: inputReveal },
    result: { opacity: active && resultAge >= 0 ? 1 - .45 * Math.max(0, Math.min(1, (resultAge - 6) / 6)) : 0, reveal: resultReveal },
    settled: frame >= track.result.settleFrame,
  };
}

export const uiCausalEmphasisEvaluatorSource = () => expectedUiCausalEmphasis.toString();
