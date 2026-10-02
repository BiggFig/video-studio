import { expectedUiState, type UiFrameState } from "./ui-state";
import type { UiAction, UiDocument } from "./ui-reconstruction";

export type UiBehaviorIssue = { actionIndex: number; code: "typing_has_no_net_change" | "state_has_no_visible_change" | "selection_has_no_visible_change" | "chosen_result_requires_confirmation" | "state_resets_typed_input" | "unsupported_graphic_creation" };

/** Resolve actual CSS values, excluding invisible provenance/selection metadata. */
function visibleState(document: UiDocument, frame: UiFrameState) {
  return document.elements.filter(element => frame.elements[element.id].visible).map(element => {
    const state = frame.elements[element.id], base = document.styles.find(style => style.id === element.styleId)!;
    if (element.type === "edge") return { id: element.id, stroke: base.color.toLowerCase() }; // SVG strokes do not consume selected CSS.
    const style = state.selected && element.selectedStyleId ? document.styles.find(style => style.id === element.selectedStyleId)! : base;
    const surface = { fill: style.fill.toLowerCase(), borderColor: style.borderColor.toLowerCase() };
    const radius = surface.fill !== "transparent" || surface.borderColor !== "transparent" ? Math.min(style.radius, element.rect.width * document.viewport.width / 2, element.rect.height * document.viewport.height / 2) : 0;
    return { id: element.id, text: state.text, ...surface, radius, ...(state.text ? { color: style.color.toLowerCase(), fontSize: style.fontSize, fontWeight: style.fontWeight } : {}) };
  });
}

/** Compare the same immutable document's rendered state, not state/selection labels.
 * Element identity binds its unchanged geometry and DOM order. Pointer position
 * is editorial; a visible input's caret and optional text provenance still matter.
 */
export function sameEffectiveUiState(document: UiDocument, left: UiFrameState, right: UiFrameState, options: { includeTextBasis?: boolean } = {}): boolean {
  if (JSON.stringify(visibleState(document, left)) !== JSON.stringify(visibleState(document, right))) return false;
  return document.elements.filter(element => left.elements[element.id].visible).every(element => {
    const a = left.elements[element.id], b = right.elements[element.id];
    // overflow:hidden clips glyphs even when both the fill and border are
    // transparent. Keep this stricter equality separate from no-op detection.
    const clippedRadius = (state: typeof a) => {
      const style = document.styles.find(style => style.id === (state.selected && element.selectedStyleId ? element.selectedStyleId : element.styleId))!;
      return Math.min(style.radius, element.rect.width * document.viewport.width / 2, element.rect.height * document.viewport.height / 2);
    };
    const sameTextClip = element.type === "edge" || !a.text || clippedRadius(a) === clippedRadius(b);
    return sameTextClip && a.typing === b.typing && (!options.includeTextBasis || a.textBasis === b.textBasis);
  });
}

/** A click may confirm an unhighlighted control. Only its selected colors may
 * differ from the declared preselection; every other visible fact remains exact.
 */
export function sameUiClickConfirmationContext(document: UiDocument, actual: UiFrameState, declared: UiFrameState, targetId: string): boolean {
  if (sameEffectiveUiState(document, actual, declared, { includeTextBasis: true })) return true;
  const element = document.elements.find(element => element.id === targetId), a = actual.elements[targetId], b = declared.elements[targetId];
  if (!element || !a?.visible || !b?.visible || a.selected || !b.selected) return false;
  const base = document.styles.find(style => style.id === element.styleId)!, selected = document.styles.find(style => style.id === (element.selectedStyleId || element.styleId))!;
  const radius = (value: number) => Math.min(value, element.rect.width * document.viewport.width / 2, element.rect.height * document.viewport.height / 2);
  if (base.fontSize !== selected.fontSize || base.fontWeight !== selected.fontWeight || radius(base.radius) !== radius(selected.radius)) return false;
  const withoutTargetHighlight = { ...declared, elements: { ...declared.elements, [targetId]: { ...b, selected: false } } };
  return sameEffectiveUiState(document, actual, withoutTargetHighlight, { includeTextBasis: true });
}
const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.join(" ") || "";
const graphicTypes = new Set<UiDocument["elements"][number]["type"]>(["panel", "node", "edge", "icon"]);
const controlTypes = new Set<UiDocument["elements"][number]["type"]>(["input", "textarea", "button", "tab", "list-item"]);
function containsRect(outer: UiDocument["elements"][number]["rect"], inner: UiDocument["elements"][number]["rect"]) {
  const epsilon = 1e-9;
  return inner.x + epsilon >= outer.x && inner.y + epsilon >= outer.y && inner.x + inner.width <= outer.x + outer.width + epsilon && inner.y + inner.height <= outer.y + outer.height + epsilon;
}
function isContentContainer(document: UiDocument, candidate: UiDocument["elements"][number], frame: UiFrameState) {
  if (candidate.type !== "panel") return false;
  return document.elements.some(child => {
    const value = frame.elements[child.id];
    if (child.id === candidate.id || !value.visible || child.type === "edge" || !containsRect(candidate.rect, child.rect)) return false;
    if (value.text.trim()) return true;
    if (!controlTypes.has(child.type)) return false;
    const style = document.styles.find(style => style.id === (value.selected && child.selectedStyleId ? child.selectedStyleId : child.styleId))!;
    return style.fill.toLowerCase() !== "transparent" || style.borderColor.toLowerCase() !== "transparent";
  });
}

/** Assumes the existing structural/action validator has already checked IDs and ordering. */
export function uiActionBehaviorIssues(document: UiDocument, actions: UiAction[], options: { rejectImplicitTypedReset?: boolean; rejectUnsupportedGraphicCreation?: boolean } = {}): UiBehaviorIssue[] {
  const issues: UiBehaviorIssue[] = [], confirmedChoices = new Set<string>(), typedValues = new Map<string, string>();
  for (const [actionIndex, action] of actions.entries()) {
    if (options.rejectUnsupportedGraphicCreation && action.kind === "state" && document.states.find(state => state.id === action.stateId)!.basis === "illustrative") {
      const prior = expectedUiState(document, actions.slice(0, actionIndex), action.atFrame);
      const next = expectedUiState(document, actions.slice(0, actionIndex + 1), action.atFrame + action.durationFrames);
      // The current action vocabulary has no draw/create gesture. A declared
      // display snapshot cannot manufacture one. Panels containing real visible
      // content/controls are ordinary UI containers, not standalone graphics.
      if (document.elements.some(element => graphicTypes.has(element.type) && !prior.elements[element.id].visible && next.elements[element.id].visible && !next.elements[element.id].text.trim() && !isContentContainer(document, element, next))) issues.push({ actionIndex, code: "unsupported_graphic_creation" });
    }
    if (options.rejectImplicitTypedReset) {
      // Isolate the prefix: a following action at this exact end frame must not
      // conceal the state transition's own effect on an authored input.
      const prior = expectedUiState(document, actions.slice(0, actionIndex), action.atFrame);
      const next = expectedUiState(document, actions.slice(0, actionIndex + 1), action.atFrame + action.durationFrames);
      if (action.kind === "type") typedValues.set(action.targetId!, next.elements[action.targetId!].text);
      if (action.kind === "state") {
        const destination = document.states.find(state => state.id === action.stateId)!;
        let reset = false;
        for (const [id, typed] of typedValues) {
          const beforeInput = prior.elements[id], afterInput = next.elements[id];
          const explicit = destination.textValues.some(value => value.elementId === id);
          if (beforeInput.visible && afterInput.visible && beforeInput.text === typed && afterInput.text !== typed && !explicit) reset = true;
          // Explicit mutations (including clearing) and a hidden final input are
          // legitimate declared states; never carry typed text into them.
          if (!beforeInput.visible || !afterInput.visible || afterInput.text !== typed) typedValues.delete(id);
        }
        if (reset) issues.push({ actionIndex, code: "state_resets_typed_input" });
      }
    }
    const before = expectedUiState(document, actions, action.atFrame - 1), after = expectedUiState(document, actions, action.atFrame + action.durationFrames);
    if (action.kind === "type" && before.elements[action.targetId!].text === after.elements[action.targetId!].text) issues.push({ actionIndex, code: "typing_has_no_net_change" });
    if ((action.kind === "state" || action.kind === "select") && JSON.stringify(visibleState(document, before)) === JSON.stringify(visibleState(document, after))) issues.push({ actionIndex, code: action.kind === "state" ? "state_has_no_visible_change" : "selection_has_no_visible_change" });
    const target = document.elements.find(element => element.id === action.targetId);
    if ((action.kind === "click" || action.kind === "select") && target?.type === "list-item" && before.elements[target.id].visible) confirmedChoices.add(target.id);
    if (action.kind !== "state") continue;
    // Narrow causal rule: choosing a displayed list item and replacing that list
    // with its text needs an explicit confirmation. Unrelated automatic updates,
    // graph changes and observed snapshots do not acquire a generic click rule.
    const newTexts = document.elements.filter(element => element.type !== "edge" && after.elements[element.id].visible && (!before.elements[element.id].visible || before.elements[element.id].text !== after.elements[element.id].text)).map(element => words(after.elements[element.id].text));
    const chosen = document.elements.filter(element => element.type === "list-item" && before.elements[element.id].visible && !after.elements[element.id].visible && words(before.elements[element.id].text) && newTexts.some(text => (` ${text} `).includes(` ${words(before.elements[element.id].text)} `)));
    if (chosen.length && !chosen.some(element => confirmedChoices.has(element.id))) issues.push({ actionIndex, code: "chosen_result_requires_confirmation" });
    if (chosen.length) confirmedChoices.clear();
  }
  return issues;
}
