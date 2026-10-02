import { join } from "node:path";
import { writeJson } from "./media";
import { PipelineError, type Asset, type Evidence, type Hooks, type WorkerInput } from "./types";
import type { Research } from "./research";

export const SOURCE_READINESS_PATH = "analysis/research-readiness.json";
export const TARGET_READINESS_PATH = "analysis/ui-source-readiness.json";
export const researchAssets = (evidence: Evidence) => evidence.assets.filter(asset => asset.usage === "output").slice(0, 16);
/** A recording is inspectable here only through its separately captured still, never as an image file. */
export const hasResearchPixels = (asset: Asset) => asset.kind === "image" || (asset.kind === "video" && !!asset.preview);
const exclusion = (asset: Asset) => {
  if (asset.usage !== "output") return "reference_only";
  if (asset.kind === "audio") return "audio_only";
  if (!hasResearchPixels(asset)) return "missing_still_preview";
  if (![asset.width, asset.height].every(value => Number.isFinite(value) && value > 0)) return "invalid_dimensions";
  if (asset.provenance?.role === "brand-logo") return "brand_logo";
  if (asset.provenance?.pageKind === "pricing" && asset.provenance.method === "viewport") return "pricing_viewport";
  return null;
};
export interface ReadinessIssue { code: string; assetId?: string; targetId?: string; action: string }
export function researchReadiness(input: WorkerInput, evidence: Evidence, evidenceSha256: string, factIds: string[], research?: Research, researchSha256?: string) {
  const requestedIds = new Set(researchAssets(evidence).map(asset => asset.id));
  const sources = evidence.assets.map(asset => {
    const reason = exclusion(asset) || (!research && !requestedIds.has(asset.id) ? "research_inventory_limit" : null);
    const visual = research?.visuals.find(visual => visual.assetId === asset.id);
    const observed = (evidence.uiSources || []).filter(source => source.assetId === asset.id);
    return {
      assetId: asset.id, width: asset.width, height: asset.height, kind: asset.kind,
      provenance: asset.provenance || null, hasStillPixels: hasResearchPixels(asset), exclusion: reason,
      classification: reason ? "ineligible" : visual?.role === "product_ui" && visual.showsProductUi ? "research_confirmed_ui" : "unconfirmed_candidate",
      observedElementCount: observed.reduce((count, source) => count + source.elements.length, 0),
      observedEditableElementCount: observed.reduce((count, source) => count + source.elements.filter(element => element.role === "input").length, 0),
    };
  });
  const issues: ReadinessIssue[] = [];
  if (!factIds.length) issues.push({ code: "missing_product_facts", action: "Supply product descriptions or a PRD explaining the main workflow, its benefit and a next step." });
  if (!research && !sources.some(source => !source.exclusion)) issues.push({ code: "missing_demonstration_source", action: "Supply a clear actual product UI screenshot. A logo, pricing page, audio file or recording without a still preview cannot establish an editable demonstration." });
  const targets = (research?.documentTargets || []).map(target => {
    for (const assetId of target.sourceAssetIds) {
      const source = sources.find(source => source.assetId === assetId);
      if (!source || source.exclusion || source.classification !== "research_confirmed_ui") issues.push({ code: source?.exclusion || "unconfirmed_target_source", assetId, targetId: target.id, action: "Provide a legible still screenshot of this exact workflow; preserve its selected capability facts and source identity." });
    }
    return { id: target.id, sourceAssetIds: [...target.sourceAssetIds], capabilityFactIds: [...target.capabilityFactIds], goal: target.goal };
  });
  return {
    version: 1 as const, jobId: input.jobId, evidenceSha256, ...(researchSha256 ? { researchSha256 } : {}),
    phase: research ? "before_ui_documentation" : "before_research",
    status: issues.length ? "needs_input" : research ? "ready_for_documentation" : "ready_for_research",
    meaning: "Structural source readiness only. Candidate pixels and public DOM do not establish product capabilities; canonical research bindings and independent visual quality checks remain required.",
    factIds: [...factIds], sources, targets, issues,
  };
}
export async function persistResearchReadiness(report: ReturnType<typeof researchReadiness>, workspace: string, hooks: Hooks) {
  const path = report.phase === "before_research" ? SOURCE_READINESS_PATH : TARGET_READINESS_PATH;
  await writeJson(join(workspace, path), report); await hooks.persist([path]);
  if (report.issues.length) throw new PipelineError("insufficient_product_evidence", "The captured source is not ready for a supported product demonstration.", report.issues[0].action, "needs_input");
}
