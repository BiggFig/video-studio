import { z } from "zod";
import type { Evidence } from "./types";
import { literalPreviewCandidates } from "./literal-preview-candidates";

const sourceId = z.string().min(1).max(100), factId = z.string().regex(/^fact-\d+$/);
export const literalPreviewSchema = z.object({
  kind: z.literal("literal-preview"), sourceAssetId: sourceId,
  codeText: z.string().min(1).max(160), propertyName: z.string().regex(/^[A-Za-z_$][A-Za-z0-9_$]{0,39}$/),
  beforeLiteral: z.string().min(1).max(40), afterLiteral: z.string().min(1).max(40),
  templateText: z.string().min(1).max(160), outputBefore: z.string().min(1).max(160), outputAfter: z.string().min(1).max(160),
  context: z.array(z.string().min(1).max(160)).min(1).max(4),
}).strict();
export type LiteralPreview = z.infer<typeof literalPreviewSchema>;

/** An illustrative string substitution, never evaluation of website JavaScript. */
export function literalPreviewValues(witness: LiteralPreview): { codeAfter: string; outputAfter: string } | undefined {
  const safeLiteral = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,39}$/u;
  if (!safeLiteral.test(witness.beforeLiteral) || !safeLiteral.test(witness.afterLiteral) || witness.beforeLiteral === witness.afterLiteral) return;
  // Accept one observed named string assignment, with its whitespace/quote
  // style preserved. Do not parse object expressions, escapes or executable code.
  const match = /^(\s*)([A-Za-z_$][A-Za-z0-9_$]*)(\s*=\s*)(["'])([^"'\\\r\n]*)(\4)(\s*[,;]?\s*)$/.exec(witness.codeText);
  if (!match || match[2] !== witness.propertyName || match[5] !== witness.beforeLiteral) return;
  const token = `{${witness.propertyName}}`, parts = witness.templateText.split(token);
  if (parts.length !== 2 || /[{}]/.test(parts.join("")) || witness.outputBefore !== parts.join(witness.beforeLiteral) || witness.outputAfter !== parts.join(witness.afterLiteral)) return;
  if (witness.context.some(value => !value.trim()) || new Set(witness.context).size !== witness.context.length) return;
  return { codeAfter: `${match[1]}${match[2]}${match[3]}${match[4]}${witness.afterLiteral}${match[6]}${match[7]}`, outputAfter: witness.outputAfter };
}
/** A bounded selection proposal, never additional evidence or an executed session. */
export const researchWorkflowSchema = z.object({
  version: z.literal(1),
  observedStart: z.object({ sourceAssetId: sourceId, description: z.string().min(1).max(240) }).strict(),
  actions: z.array(z.object({
    kind: z.enum(["type", "click", "select"]), sourceAssetId: sourceId,
    control: z.string().min(1).max(80), evidenceId: factId,
    sourceElementId: z.string().min(1).max(100).optional(),
  }).strict()).min(1).max(3),
  result: z.object({
    kind: z.enum(["committed-content", "applied-view", "reactive-preview"]), sourceAssetId: sourceId,
    surface: z.string().min(1).max(80), change: z.string().min(1).max(140),
    basis: z.enum(["observed", "illustrative"]), evidenceId: factId,
    valueDerivation: z.object({
      kind: z.literal("selected-row-count"), sourceAssetId: sourceId,
      rowLabel: z.string().min(1).max(80), rowValue: z.string().min(1).max(32), sourceMetricLabel: z.string().min(1).max(80),
      outputLabel: z.string().min(1).max(80), outputBefore: z.string().min(1).max(32),
      context: z.array(z.string().min(1).max(160)).min(1).max(4),
    }).strict().optional(),
    contentDerivation: literalPreviewSchema.optional(),
  }).strict(),
}).strict();
export type ResearchWorkflow = z.infer<typeof researchWorkflowSchema>;
type Target = { sourceAssetIds: string[]; capabilityFactIds: string[]; workflow?: ResearchWorkflow };
type Visual = { assetId: string; supportsFactIds: string[] };
export type ResearchWorkflowIssue = { code: "workflow_declaration_required" | "workflow_source_binding" | "workflow_fact_binding" | "workflow_confirmation_required" | "workflow_control_binding" | "workflow_control_role" | "workflow_control_disabled" | "workflow_control_already_selected" | "workflow_value_derivation" | "workflow_content_derivation" | "workflow_applied_view_proof_required"; path: (string | number)[] };
const controlRoles = new Set(["button", "tab", "list-item", "node"]);
const textKey = (text: string) => text.normalize("NFKC").replace(/\s+/g, " ").trim();
const countValue = (value: string) => {
  if (!/^(?:(?:0|[1-9]\d*)|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d+)?[kKmMbB]?$/.test(value)) return NaN;
  const multiplier = ({ k: 1e3, m: 1e6, b: 1e9 } as Record<string, number>)[value.slice(-1).toLowerCase()] || 1;
  return Number(value.replace(/,/g, "").replace(/[kKmMbB]$/, "")) * multiplier;
};

export function researchWorkflowIssues(target: Target, evidence: Evidence, visuals: Visual[], required: boolean, launch: boolean, requireAppliedViewProof = false): ResearchWorkflowIssue[] {
  const workflow = target.workflow;
  if (!workflow) return required ? [{ code: "workflow_declaration_required", path: ["workflow"] }] : [];
  const issues: ResearchWorkflowIssue[] = [];
  const add = (code: ResearchWorkflowIssue["code"], path: (string | number)[]) => issues.push({ code, path: ["workflow", ...path] });
  const source = (id: string, path: (string | number)[]) => { if (!target.sourceAssetIds.includes(id)) add("workflow_source_binding", path); };
  const fact = (id: string, assetId: string, path: (string | number)[]) => {
    if (!target.capabilityFactIds.includes(id) || !visuals.find(visual => visual.assetId === assetId)?.supportsFactIds.includes(id)) add("workflow_fact_binding", path);
  };
  source(workflow.observedStart.sourceAssetId, ["observedStart", "sourceAssetId"]);
  workflow.actions.forEach((action, index) => {
    const path = ["actions", index];
    source(action.sourceAssetId, [...path, "sourceAssetId"]); fact(action.evidenceId, action.sourceAssetId, [...path, "evidenceId"]);
    const observations = (evidence.uiSources || []).filter(source => source.assetId === action.sourceAssetId);
    // Missing bounded DOM coverage is not proof that a photographed control is
    // absent. A supplied element ID, however, must resolve to that exact source.
    const observed = action.sourceElementId ? observations.flatMap(source => source.elements).find(element => element.id === action.sourceElementId) : undefined;
    if (action.sourceElementId && (!observed || (observed.text && textKey(observed.text) !== textKey(action.control)))) add("workflow_control_binding", [...path, "sourceElementId"]);
    if (!observed) return;
    const illustrativeCode = workflow.result.kind === "reactive-preview" && workflow.result.contentDerivation && literalPreviewValues(workflow.result.contentDerivation) && observed.role === "text" && textKey(observed.text || "") === textKey(workflow.result.contentDerivation.codeText);
    if (action.kind === "type" ? observed.role !== "input" && !illustrativeCode : !controlRoles.has(observed.role)) add("workflow_control_role", [...path, "kind"]);
    // Captured state constrains the starting gesture. An earlier supported
    // input/selection may enable or change a later control; UI review must prove
    // that intervening state instead of treating the still as a permanent lock.
    if (index === 0 && observed.state?.disabled) add("workflow_control_disabled", [...path, "sourceElementId"]);
    if (index === 0 && action.kind === "select" && observed.state?.selected) add("workflow_control_already_selected", [...path, "kind"]);
  });
  source(workflow.result.sourceAssetId, ["result", "sourceAssetId"]);
  fact(workflow.result.evidenceId, workflow.result.sourceAssetId, ["result", "evidenceId"]);
  const derivation = workflow.result.valueDerivation;
  // Fresh contract only: a promise that an illustrated dashboard changes does
  // not supply its new values. Retained unmarked research keeps its prior rules.
  if (requireAppliedViewProof && workflow.result.kind === "applied-view" && workflow.result.basis === "illustrative" && !derivation)
    add("workflow_applied_view_proof_required", ["result", "valueDerivation"]);
  if (derivation) {
    const action = workflow.actions[0], rowCount = countValue(derivation.rowValue), beforeCount = countValue(derivation.outputBefore);
    if (workflow.result.basis !== "illustrative" || workflow.result.kind !== "applied-view" || workflow.actions.length !== 1 || !["click", "select"].includes(action.kind) ||
      derivation.sourceAssetId !== workflow.observedStart.sourceAssetId || derivation.sourceAssetId !== workflow.result.sourceAssetId || derivation.sourceAssetId !== action.sourceAssetId ||
      textKey(action.control) !== textKey(derivation.rowLabel) || !Number.isSafeInteger(rowCount) || !Number.isSafeInteger(beforeCount) || rowCount >= beforeCount ||
      derivation.context.some(value => !value.trim()) || new Set(derivation.context).size !== derivation.context.length)
      add("workflow_value_derivation", ["result", "valueDerivation"]);
  }
  const content = workflow.result.contentDerivation;
  if (content || workflow.result.kind === "reactive-preview") {
    const action = workflow.actions[0];
    if (!content || !literalPreviewValues(content) || derivation || workflow.result.kind !== "reactive-preview" || workflow.result.basis !== "illustrative" || workflow.actions.length !== 1 || action.kind !== "type" ||
      content.sourceAssetId !== workflow.observedStart.sourceAssetId || content.sourceAssetId !== workflow.result.sourceAssetId || content.sourceAssetId !== action.sourceAssetId || textKey(action.control) !== textKey(content.codeText))
      add("workflow_content_derivation", ["result", "contentDerivation"]);
    if (content) {
      // A chosen known DOM correspondence is narrower than a pixel-only
      // proposal. Its tuple and context must be copied from that same panel;
      // missing inventory elsewhere never proves something absent in pixels.
      const related = literalPreviewCandidates(evidence.uiSources || [], 4).filter(candidate => candidate.sourceAssetId === content.sourceAssetId && (action.sourceElementId === candidate.sourceElementIds.code || (content.codeText === candidate.codeText && action.control === candidate.codeText)));
      if (related.length && !related.some(candidate => candidate.codeText === content.codeText && candidate.propertyName === content.propertyName && candidate.beforeLiteral === content.beforeLiteral && candidate.templateText === content.templateText && candidate.outputBefore === content.outputBefore && content.context.every(text => candidate.contextChoices.some(choice => choice.text === text))))
        add("workflow_content_derivation", ["result", "contentDerivation"]);
    }
  }
  if (launch && workflow.result.kind !== "reactive-preview" && !["click", "select"].includes(workflow.actions.at(-1)!.kind)) add("workflow_confirmation_required", ["actions", workflow.actions.length - 1, "kind"]);
  return issues;
}

/** Reuse bounded captured metadata; neither infer an input nor promote a source. */
export function researchControlInventory(evidence: Evidence, assetIds: Set<string>) {
  return (evidence.uiSources || []).filter(source => assetIds.has(source.assetId)).map(source => ({
    assetId: source.assetId, basis: source.basis, context: source.context,
    controls: source.elements.filter(element => element.role === "input" || controlRoles.has(element.role)).slice(0, 12).map(element => ({ id: element.id, role: element.role, ...(element.text ? { text: element.text } : {}), ...(element.state ? { state: element.state } : {}) })),
    meaning: "Partial observed inventory only; absence is not negative evidence. Pixels and capability passages remain required.",
  }));
}
