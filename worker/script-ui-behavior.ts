import { expectedUiState, type UiFrameState } from "./ui-state";
import type { UiAction, UiDocument } from "./ui-reconstruction";

export type UiBehaviorIssue = { actionIndex: number; code: "typing_has_no_net_change" | "state_has_no_visible_change" | "selection_has_no_visible_change" | "chosen_result_requires_confirmation" };

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
const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.join(" ") || "";

/** Assumes the existing structural/action validator has already checked IDs and ordering. */
export function uiActionBehaviorIssues(document: UiDocument, actions: UiAction[]): UiBehaviorIssue[] {
  const issues: UiBehaviorIssue[] = [], confirmedChoices = new Set<string>();
  for (const [actionIndex, action] of actions.entries()) {
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
