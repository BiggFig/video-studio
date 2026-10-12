import { z } from "zod";
import { researchWorkflowSchema } from "./research-workflow";

export const RESEARCH_TRANSPORT_VERSION = "research-flat-v1";
const text = z.string(), texts = z.array(text);
const roles = ["primaryAudience", "problem", "mechanism", "outcome", "differentiator", "cta"] as const;
const factKind = z.enum(["product", "audience", "problem", "feature", "benefit", "pricing", "cta", "planned", "limitation"]);
const claimSchema = z.object({ role: z.enum(roles), text, basis: z.enum(["explicit", "inferred"]), evidenceIds: texts }).strict();
const result = researchWorkflowSchema.shape.result.shape;
const targetSchema = z.object({
  id: text, sourceAssetIds: texts, capabilityFactIds: texts, goal: text,
  observedStartSourceAssetId: text, observedStartDescription: text,
  actions: z.array(z.object({ kind: z.enum(["type", "click", "select"]), sourceAssetId: text, control: text, evidenceId: text, sourceElementId: text }).strict()),
  resultKind: result.kind, resultSourceAssetId: text, resultSurface: text, resultChange: text, resultBasis: result.basis, resultEvidenceId: text,
  valueDerivations: z.array(result.valueDerivation.unwrap()).max(1),
  contentDerivations: z.array(result.contentDerivation.unwrap()).max(1),
}).strict().superRefine((target, context) => {
  if (target.valueDerivations.length && (target.contentDerivations.length || target.resultKind !== "applied-view")) context.addIssue({ code: "custom", path: ["valueDerivations"], message: "Unused or conflicting value derivation" });
  if (target.contentDerivations.length && target.resultKind !== "reactive-preview") context.addIssue({ code: "custom", path: ["contentDerivations"], message: "Unused content derivation" });
});
const flatSchema = z.object({
  transportVersion: z.literal(RESEARCH_TRANSPORT_VERSION), sufficientEvidence: z.boolean(), reason: text, product: text,
  documentTargets: z.array(targetSchema),
  facts: z.array(z.object({ evidenceId: text, kind: factKind, kinds: z.array(factKind), label: text }).strict()),
  visuals: z.array(z.object({ assetId: text, description: text, supportsFactIds: texts, showsProductUi: z.boolean(), role: z.enum(["product_ui", "marketing", "brand", "other"]), regions: z.array(z.object({ id: text, rect: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).strict(), supportsFactIds: texts }).strict()) }).strict()),
  claims: z.array(claimSchema),
  mechanismSteps: z.array(z.object({ action: text, evidenceId: text, assetId: text }).strict()),
  summary: text, limitations: texts,
}).strict().superRefine((draft, context) => {
  const seen = new Set<string>();
  for (const [index, claim] of draft.claims.entries()) {
    if (seen.has(claim.role)) context.addIssue({ code: "custom", path: ["claims", index, "role"], message: "Duplicate claim role" });
    seen.add(claim.role);
  }
  if (draft.mechanismSteps.length && !seen.has("mechanism")) context.addIssue({ code: "custom", path: ["mechanismSteps"], message: "Steps require a mechanism claim" });
  if (!draft.sufficientEvidence) {
    for (const field of ["product", "summary"] as const) if (draft[field] !== "") context.addIssue({ code: "custom", path: [field], message: "Refusal content must be empty" });
    for (const field of ["documentTargets", "facts", "visuals", "claims", "mechanismSteps", "limitations"] as const) if (draft[field].length) context.addIssue({ code: "custom", path: [field], message: "Refusal content must be empty" });
    if (!draft.reason.trim()) context.addIssue({ code: "custom", path: ["reason"], message: "Refusal needs a reason" });
  }
});

/** Restore only the declared shape. No source, string, claim, state or evidence
 * is inferred; canonical compilation still owns all semantic/bound checks.
 * Unmarked legacy drafts and saved canonical stages are not upgraded. */
export function decodeResearchTransport(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !("transportVersion" in raw)) return raw;
  const draft = flatSchema.parse(raw);
  const story = Object.fromEntries(roles.map(role => {
    const selected = draft.claims.find(claim => claim.role === role);
    if (!selected) return [role, null];
    const { role: _role, ...claim } = selected;
    return [role, role === "mechanism" ? { ...claim, steps: draft.mechanismSteps } : claim];
  }));
  return {
    sufficientEvidence: draft.sufficientEvidence, reason: draft.reason, product: draft.product,
    documentTargets: draft.documentTargets.map(target => ({
      id: target.id, sourceAssetIds: target.sourceAssetIds, capabilityFactIds: target.capabilityFactIds, goal: target.goal,
      workflow: {
        version: 1,
        observedStart: { sourceAssetId: target.observedStartSourceAssetId, description: target.observedStartDescription },
        actions: target.actions.map(({ sourceElementId, ...action }) => ({ ...action, ...(sourceElementId === "" ? {} : { sourceElementId }) })),
        result: { kind: target.resultKind, sourceAssetId: target.resultSourceAssetId, surface: target.resultSurface, change: target.resultChange, basis: target.resultBasis, evidenceId: target.resultEvidenceId,
          ...(target.valueDerivations.length ? { valueDerivation: target.valueDerivations[0] } : {}),
          ...(target.contentDerivations.length ? { contentDerivation: target.contentDerivations[0] } : {}),
        },
      },
    })),
    facts: draft.facts.map(({ kinds, ...fact }) => ({ ...fact, ...(kinds.length ? { kinds } : {}) })),
    visuals: draft.visuals.map(({ regions, ...visual }) => ({ ...visual, ...(regions.length ? { regions } : {}) })),
    story, summary: draft.summary, limitations: draft.limitations,
  };
}

export const RESEARCH_TRANSPORT_GUIDANCE = `RESEARCH RESPONSE TRANSPORT: Return only the all-required research-flat-v1 shape. The narrative rules describe canonical concepts, not additional output keys. Do not emit nested story, target.workflow or target.result objects.
Return {transportVersion:'research-flat-v1',sufficientEvidence,reason,product,documentTargets,facts,visuals,claims,mechanismSteps,summary,limitations}. documentTargets contains {id,sourceAssetIds,capabilityFactIds,goal,observedStartSourceAssetId,observedStartDescription,actions,resultKind,resultSourceAssetId,resultSurface,resultChange,resultBasis,resultEvidenceId,valueDerivations,contentDerivations}. Each action is {kind,sourceAssetId,control,evidenceId,sourceElementId}; use sourceElementId:"" only when no observed ID is available. valueDerivations and contentDerivations each contain zero or one complete witness in the shapes described above; never supply both, and use [] when absent. resultKind is committed-content, applied-view or reactive-preview; resultBasis is observed or illustrative. Workflow version 1 is restored locally, not emitted.
claims contains each supported role at most once as {role,text,basis,evidenceIds}; roles are primaryAudience,problem,mechanism,outcome,differentiator,cta. Omit unsupported roles from the array; missing roles become canonical null. mechanismSteps contains the mechanism's {action,evidenceId,assetId} steps and must be [] when no mechanism claim exists. No null values or placeholder claims. facts require {evidenceId,kind,kinds,label}; kinds:[] means no additional categories. visuals require {assetId,description,supportsFactIds,showsProductUi,role,regions}; regions:[] means no focus regions. Existing source IDs, facts, exact witness strings, geometry and bounds remain unchanged; this transport supplies no evidence.
If evidence is insufficient, return sufficientEvidence:false with an honest reason, product:"", summary:"", and empty documentTargets,facts,visuals,claims,mechanismSteps,limitations arrays. Never fabricate success content to fill a refusal. Complete the exact shape inside the same response allocation.`;
