import type { Script } from "./scripting";
import type { UiAction, UiDocument, UiDocumentBundle } from "./ui-reconstruction";
import { expectedUiState, type UiFrameState } from "./ui-state";
import { PipelineError } from "./types";
import { uiExampleCopy, validateUiActions } from "./ui-reconstruction";
import { motionTimingForPresentation } from "./motion-timing";
import { sameEffectiveUiState, sameUiClickConfirmationContext, uiActionBehaviorIssues } from "./script-ui-behavior";

export interface TerminalResult {
  version: 1;
  beforeStateId: string;
  afterStateId: string;
  confirmationElementId: string;
  resultElementIds: string[];
  evidenceIds: string[];
}
export interface LaunchResultInspection { ready: boolean; issues: string[]; result?: TerminalResult }
export interface LaunchDepthEvidence { sceneId: string; documentId: string; confirmationActionId: string; resultActionId: string; result: TerminalResult }
export interface LaunchSequenceIssue {
  sceneId: string | null;
  documentId: string;
  declaration: TerminalResult;
  code: "document_not_demonstrated" | "terminal_state_action_missing" | "result_evidence_mismatch" | "confirmation_action_missing" | "confirmation_evidence_mismatch" | "confirmation_not_visible" | "before_state_mismatch" | "result_has_no_material_change" | "terminal_result_not_persistent";
  resultActionId?: string;
  confirmationActionId?: string;
  actualPreconfirmationStateId?: string;
  mismatchedElementIds?: string[];
  permittedMissingStep?: { kind: "state"; stateId: string; evidenceId: string; insertBeforeActionId: string; reason: "documented_visible_state_change" };
}
type DocumentWithResult = UiDocument & { terminalResult?: TerminalResult };
const content = (text: string) => text.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, "");
const confirmationTypes = new Set(["button", "list-item", "tab", "node"]);
const choices = new Set(["list-item", "tab", "node", "input", "textarea"]);
const snapshot = (document: UiDocument, stateId: string) => expectedUiState(document, [{ kind: "state", atFrame: 0, durationFrames: 1, stateId, evidenceId: document.capabilityFactIds[0] }], 1);
const contains = (outer: UiDocument["elements"][number]["rect"], inner: UiDocument["elements"][number]["rect"]) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width + 1e-8 && inner.y + inner.height <= outer.y + outer.height + 1e-8;
const outsideChoices = (document: UiDocument, elementId: string, state: UiFrameState) => {
  const element = document.elements.find(element => element.id === elementId)!;
  return !document.elements.some(other => other.id !== element.id && choices.has(other.type) && state.elements[other.id]?.visible && contains(other.rect, element.rect));
};

/** A minimum demonstrated-result contract, never a semantic or visual-quality verdict. */
export function inspectLaunchResult(document: DocumentWithResult): LaunchResultInspection {
  const result = document.terminalResult, issues: string[] = [];
  if (!result) return { ready: false, issues: ["terminal_result_declaration_required"] };
  const before = document.states.find(state => state.id === result.beforeStateId), after = document.states.find(state => state.id === result.afterStateId);
  const unique = (ids: string[]) => ids.length >= 1 && ids.length <= 4 && new Set(ids).size === ids.length;
  if (result.version !== 1 || !before || !after || before.id === after.id || !unique(result.resultElementIds) || !unique(result.evidenceIds)) return { ready: false, issues: ["invalid_terminal_result_declaration"] };
  if (!result.evidenceIds.every(id => document.capabilityFactIds.includes(id) && after.evidenceIds.includes(id))) issues.push("terminal_result_capability_binding");
  const control = document.elements.find(element => element.id === result.confirmationElementId);
  if (!control || !confirmationTypes.has(control.type) || !before.visibleElementIds.includes(control.id) || !document.sourceAssetIds.includes(control.sourceAssetId)) issues.push("visible_supported_confirmation_required");
  const prior = snapshot(document, before.id), next = snapshot(document, after.id), initial = expectedUiState(document, [], 0);
  for (const id of result.resultElementIds) {
    const element = document.elements.find(element => element.id === id), value = next.elements[id], old = prior.elements[id];
    if (!element || element.type !== "text" || !document.sourceAssetIds.includes(element.sourceAssetId) || !value?.visible || !content(value.text) || !outsideChoices(document, id, next)) { issues.push("nonquery_nonselection_result_required"); continue; }
    if ((old.visible && content(old.text) === content(value.text)) || (initial.elements[id].visible && content(initial.elements[id].text) === content(value.text))) issues.push("substantive_new_result_required");
  }
  return { ready: issues.length === 0, issues: [...new Set(issues)], ...(issues.length ? {} : { result }) };
}

/** Result reading time is required regardless of observed/example provenance. */
export function launchResultCopy(document: DocumentWithResult): string[] {
  const inspection = inspectLaunchResult(document);
  if (!inspection.result) return [];
  const state = snapshot(document, inspection.result.afterStateId);
  return inspection.result.resultElementIds.map(id => state.elements[id].text);
}

/** Shared fresh-compile and restore minimum; includes camera settlement and outgoing seam. */
export function launchResultReadingFrames(document: DocumentWithResult, scene: Pick<Script["scenes"][number], "detail" | "presentation">, editorialWords: number, lastScene: boolean, countWords: (text: string) => number): number {
  const visual = scene.presentation?.visual;
  if (visual?.kind !== "ui-demo") throw new Error("Launch result reading requires a UI scene");
  const uiWords = [...new Set([...uiExampleCopy(document, visual.actions), ...launchResultCopy(document)])].reduce((sum, text) => sum + countWords(text), 0);
  const motion = motionTimingForPresentation(scene.presentation, !!scene.detail);
  return Math.ceil(((Math.max(editorialWords, uiWords) * 32 + 120) * 30) / 100) + motion.entryFrames + (lastScene ? 0 : motion.exitFrames);
}

export class LaunchDepthRejected extends PipelineError {
  constructor(public readonly diagnostics: { code: string; documentIds: string[]; sequenceIssues: LaunchSequenceIssue[] }) {
    super("insufficient_launch_depth", "The launch script does not execute its declared result sequence.", "Inspect the exact state, confirmation and result IDs in the retained depth diagnostics. Preserve the required outcome/payoff and CTA beats; adjust only permitted script actions against the immutable UI documents.", "needs_review");
  }
}

function permittedBeforeStep(document: UiDocument, actions: UiAction[], confirmation: number, result: TerminalResult): LaunchSequenceIssue["permittedMissingStep"] {
  const state = document.states.find(state => state.id === result.beforeStateId)!;
  const evidenceId = state.evidenceIds.find(id => result.evidenceIds.includes(id));
  if (!evidenceId) return;
  const atFrame = actions[confirmation]?.atFrame || 30, prefix = actions.slice(0, confirmation), step: UiAction = { kind: "state", stateId: state.id, atFrame, durationFrames: 1, evidenceId };
  try {
    validateUiActions(document, [...prefix, step]);
    if (uiActionBehaviorIssues(document, [...prefix, step], { rejectImplicitTypedReset: true, rejectUnsupportedGraphicCreation: true }).length) return;
  } catch { return; }
  return { kind: "state", stateId: state.id, evidenceId, insertBeforeActionId: `action-${confirmation + 1}`, reason: "documented_visible_state_change" };
}

/** Compact trusted sequence IDs; never model instructions or invented UI actions. */
export function launchSequenceInventory(documents: UiDocument[]) {
  return documents.flatMap(document => {
    const inspection = inspectLaunchResult(document); if (!inspection.result) return [];
    const result = inspection.result, initial = expectedUiState(document, [], 0), declared = snapshot(document, result.beforeStateId);
    const initialContextAllowsDirectClick = initial.stateId === result.beforeStateId || sameUiClickConfirmationContext(document, initial, declared, result.confirmationElementId);
    // This inventory offers source-bound actions, not automatic edits to a draft.
    // Validate a legal timing example before exposing timing-free instructions.
    let directStartActions: Omit<UiAction, "atFrame" | "durationFrames">[] | undefined;
    if (initialContextAllowsDirectClick) {
      const candidate: UiAction[] = [{ kind: "click", atFrame: 30, durationFrames: 6, targetId: result.confirmationElementId, evidenceId: result.evidenceIds[0] }, { kind: "state", atFrame: 42, durationFrames: 1, stateId: result.afterStateId, evidenceId: result.evidenceIds[0] }];
      try {
        validateUiActions(document, candidate);
        if (!uiActionBehaviorIssues(document, candidate, { rejectImplicitTypedReset: true, rejectUnsupportedGraphicCreation: true }).length) directStartActions = candidate.map(({ atFrame: _atFrame, durationFrames: _durationFrames, ...action }) => action);
      } catch { /* An unavailable direct sequence must not be advertised. */ }
    }
    return [{ documentId: document.id, ...result, initialStateId: initial.stateId, initialContextAllowsDirectClick, ...(directStartActions ? { directStartActions } : {}) }];
  });
}

export const launchDepthInstruction = "Demonstrate at least one declared terminalResult in one continuous ui-demo scene. When initialContextAllowsDirectClick is true, the initial context already satisfies the before-context: directly click confirmationElementId, then apply afterStateId using its evidenceIds. No visit to beforeStateId is required. Prefer the trusted directStartActions when supplied; author their legal timing without adding a cosmetic or no-op state visit. Otherwise reach the documented before-context through a genuinely visible supported change before confirming. Preserve the exact afterStateId and resultElementIds through the final reading hold. Pointer-only, query entry, option highlighting or clearing alone cannot satisfy this minimum launch requirement. Never invent a selected style or change documents. If no supported complete sequence exists, return sufficientEvidence:false.";

export function launchSequenceRequest(documents: UiDocument[]): string {
  return `MANDATORY LAUNCH SEQUENCE: ${launchDepthInstruction} These are immutable document IDs, not new states. The direct-click exception permits only the named clicked control's optional selected colors; all surrounding text, visibility and styling must match the documented context. Preserve a separate required outcome/result-or-payoff beat and the final CTA; fixing UI choreography is not a reason to delete story roles. Respect all action, copy, reading and frame limits. SOURCE-BOUND SEQUENCES: ${JSON.stringify(launchSequenceInventory(documents))}\n`;
}

/** Require actual scheduled confirmation -> declared result, persistent through all later states. */
export function assertLaunchWorkflowDepth(script: Pick<Script, "scenes" | "uiDocuments">, ui?: UiDocumentBundle): LaunchDepthEvidence[] {
  const documents = ui?.documents || script.uiDocuments || [], ready = documents.map(document => ({ document, inspection: inspectLaunchResult(document) })).filter(item => item.inspection.ready);
  if (!ready.length) throw new PipelineError("insufficient_launch_result", "The source-bound UI documents do not contain a substantive completed result for a launch film.", "Supply source UI and capability evidence supporting a persistent non-query result after confirmation. Selection-only and clear-only demonstrations are insufficient for this launch format.", "needs_input");
  const evidence: LaunchDepthEvidence[] = [], sequenceIssues: LaunchSequenceIssue[] = [], used = new Set<string>();
  script.scenes.forEach((scene, sceneIndex) => {
    const visual = scene.presentation?.visual;
    if (visual?.kind !== "ui-demo") return;
    const item = ready.find(item => item.document.id === visual.documentId);
    if (!item) return;
    const document = item.document, result = item.inspection.result!, actions = visual.actions;
    used.add(document.id);
    const issue = (code: LaunchSequenceIssue["code"], details: Partial<LaunchSequenceIssue> = {}) => sequenceIssues.push({ sceneId: `scene-${sceneIndex + 1}`, documentId: document.id, declaration: result, code, ...details });
    const frames = actions.map((action, index) => expectedUiState(document, actions.slice(0, index + 1), action.atFrame + action.durationFrames));
    if (!actions.some(action => action.kind === "state" && action.stateId === result.afterStateId)) issue("terminal_state_action_missing");
    for (let index = 0; index < actions.length; index++) {
      const action = actions[index];
      if (action.kind !== "state" || action.stateId !== result.afterStateId) continue;
      const resultActionId = `action-${index + 1}`;
      if (!result.evidenceIds.includes(action.evidenceId)) { issue("result_evidence_mismatch", { resultActionId }); continue; }
      let confirmation = index - 1;
      while (confirmation >= 0 && actions[confirmation].kind === "pointer") confirmation--;
      const confirm = actions[confirmation];
      if (!confirm || !["click", "select"].includes(confirm.kind) || confirm.targetId !== result.confirmationElementId) { issue("confirmation_action_missing", { resultActionId }); continue; }
      const confirmationActionId = `action-${confirmation + 1}`;
      const before = confirmation ? frames[confirmation - 1] : expectedUiState(document, [], 0), after = frames[index];
      const context = { resultActionId, confirmationActionId, actualPreconfirmationStateId: before.stateId };
      if (!result.evidenceIds.includes(confirm.evidenceId)) { issue("confirmation_evidence_mismatch", context); continue; }
      // A documented hover/selection snapshot may have a different ID yet paint
      // exactly like the current state. Requiring that no-op action would conflict
      // with the behavior gate. Same-ID authored typing retains its existing rule.
      if (!before.elements[result.confirmationElementId]?.visible) { issue("confirmation_not_visible", context); continue; }
      const declared = snapshot(document, result.beforeStateId);
      const equivalentBefore = confirm.kind === "click" ? sameUiClickConfirmationContext(document, before, declared, result.confirmationElementId) : sameEffectiveUiState(document, before, declared, { includeTextBasis: true });
      if (before.stateId !== result.beforeStateId && !equivalentBefore) {
        const mismatchedElementIds = document.elements.filter(element => !sameEffectiveUiState({ ...document, elements: [element] }, before, declared, { includeTextBasis: true })).map(element => element.id);
        const permittedMissingStep = permittedBeforeStep(document, actions, confirmation, result);
        issue("before_state_mismatch", { ...context, mismatchedElementIds, ...(permittedMissingStep ? { permittedMissingStep } : {}) }); continue;
      }
      const actualChange = result.resultElementIds.every(id => after.elements[id]?.visible && content(after.elements[id].text) && (!before.elements[id]?.visible || content(before.elements[id].text) !== content(after.elements[id].text)) && outsideChoices(document, id, after));
      const persistent = frames.slice(index).every(frame => frame.stateId === result.afterStateId) && result.resultElementIds.every(id => frames.slice(index).every(frame => frame.elements[id]?.visible && frame.elements[id].text === after.elements[id].text && outsideChoices(document, id, frame)));
      if (!actualChange) issue("result_has_no_material_change", context);
      if (!persistent) issue("terminal_result_not_persistent", context);
      if (actualChange && persistent) evidence.push({ sceneId: `scene-${sceneIndex + 1}`, documentId: document.id, confirmationActionId, resultActionId, result });
    }
  });
  for (const item of ready) if (!used.has(item.document.id)) sequenceIssues.push({ sceneId: null, documentId: item.document.id, declaration: item.inspection.result!, code: "document_not_demonstrated" });
  if (!evidence.length) throw new LaunchDepthRejected({ code: "declared_terminal_result_not_demonstrated", documentIds: ready.map(item => item.document.id), sequenceIssues });
  return evidence;
}

export interface LaunchOutcomeIssue { sceneId: string; completedSceneId: string; documentId: string; sourceAssetIds: string[]; code: "outcome_reuses_preworkflow_source" }
export class LaunchOutcomeRejected extends PipelineError {
  constructor(public readonly diagnostics: { code: "outcome_continuity"; issues: LaunchOutcomeIssue[] }) {
    super("launch_outcome_continuity", "An outcome beat replays the source capture behind an already completed UI workflow.", "Keep the completed workflow and required outcome beat. Use a source-grounded editorial outcome or genuinely different supported proof; a raw source image does not inherit the reconstructed terminal state.", "needs_review");
  }
}

/** Raw proof still shows the captured source, never the state of an earlier HTML demo. */
export function assertLaunchOutcomeContinuity(script: Pick<Script, "scenes" | "uiDocuments">, ui?: UiDocumentBundle) {
  const completed = assertLaunchWorkflowDepth(script, ui), documents = ui?.documents || script.uiDocuments || [], issues: LaunchOutcomeIssue[] = [];
  for (const [index, scene] of script.scenes.entries()) {
    if (scene.storyRole !== "outcome" && !["result", "payoff"].includes(scene.direction?.job || "")) continue;
    const presentation = scene.presentation, visual = presentation?.visual;
    if (presentation?.template !== "proof" || visual?.kind === "ui-demo") continue;
    const rawAssetIds = [scene.assetId, ...(visual?.kind === "panels" ? [visual.secondaryAssetId] : [])];
    for (const earlier of completed.filter(value => Number(value.sceneId.slice(6)) - 1 < index)) {
      const document = documents.find(document => document.id === earlier.documentId)!;
      const sourceAssetIds = [...new Set(rawAssetIds.filter(id => document.sourceAssetIds.includes(id)))];
      if (sourceAssetIds.length) issues.push({ sceneId: `scene-${index + 1}`, completedSceneId: earlier.sceneId, documentId: document.id, sourceAssetIds, code: "outcome_reuses_preworkflow_source" });
    }
  }
  if (issues.length) throw new LaunchOutcomeRejected({ code: "outcome_continuity", issues });
  return { version: 1 as const, completedWorkflows: completed.map(value => ({ sceneId: value.sceneId, documentId: value.documentId })) };
}
