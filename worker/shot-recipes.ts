import { stageDigest, stageFailure, type Research } from "./research";
import { buildCreativeBrief } from "./creative-direction";
import type { Evidence, Plan, Presentation } from "./types";
import type { UiDocumentBundle } from "./ui-reconstruction";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { writeJson } from "./media";
import type { Hooks } from "./types";

export const RECIPE_SCRIPT_TRANSPORT_VERSION = "flat-script-v3";
export const SHOT_RECIPES_PATH = "analysis/shot-recipes.json";
export const MAX_SHOT_RECIPES = 64;
export const MAX_SHOT_RECIPE_BYTES = 32000;
export type RecipeRole = "problem" | "product" | "mechanism" | "outcome" | "differentiator" | "cta";
type RecipeVisual = { kind: "none" | "showcase" | "connections" } | { kind: "focus"; regionId: string } | { kind: "panels"; secondaryAssetId: string; secondaryEvidenceId: string } | { kind: "ui-demo"; documentId: string };
export interface ShotRecipe { id: string; storyRole: RecipeRole; assetId: string; evidenceId: string; template: Presentation["template"]; visual: RecipeVisual }
export interface ShotRecipeCatalog { version: 1; researchSha256: string; evidenceSha256: string; uiSha256: string; recipes: ShotRecipe[] }

/** Guidance beside the immutable catalogue; does not change recipe IDs or saved hashes. */
export function launchOutcomeRecipeGuidance(catalog: ShotRecipeCatalog, ui: UiDocumentBundle) {
  return {
    editorialOutcomeRecipeIds: catalog.recipes.filter(recipe => recipe.storyRole === "outcome" && recipe.template !== "proof").map(recipe => recipe.id),
    rawProofRestrictions: catalog.recipes.filter(recipe => ["outcome", "differentiator"].includes(recipe.storyRole) && recipe.template === "proof" && recipe.visual.kind !== "ui-demo").flatMap(recipe => {
      const ids = [recipe.assetId, ...(recipe.visual.kind === "panels" ? [recipe.visual.secondaryAssetId] : [])];
      const documentIds = ui.documents.filter(document => ids.some(id => document.sourceAssetIds.includes(id))).map(document => document.id);
      return documentIds.length ? [{ recipeId: recipe.id, cannotFollowCompletedDocumentIds: documentIds }] : [];
    }),
  };
}
const roles: RecipeRole[] = ["problem", "product", "mechanism", "outcome", "differentiator", "cta"];
const quota: Record<RecipeRole, number> = { problem: 8, product: 16, mechanism: 8, outcome: 12, differentiator: 12, cta: 4 };
const sorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
const speech = (asset: Evidence["assets"][number]) => asset.transcript?.words.some(word => word.type === "word");

export async function persistShotRecipes(catalog: ShotRecipeCatalog, workspace: string, hooks: Pick<Hooks, "persist">) {
  let existing: unknown;
  try { existing = JSON.parse(await readFile(join(workspace, SHOT_RECIPES_PATH), "utf8")); }
  catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw stageFailure("The retained shot catalogue is unreadable."); }
  if (existing !== undefined && stageDigest(existing) !== stageDigest(catalog)) throw stageFailure("The retained shot catalogue changed its verified sources or recipe policy.");
  if (existing === undefined) await writeJson(join(workspace, SHOT_RECIPES_PATH), catalog);
  await hooks.persist([SHOT_RECIPES_PATH]);
}

/** Finite trusted combinations, never a model-generated provenance repair. */
export function buildShotRecipeCatalog(research: Research, evidence: Evidence, ui: UiDocumentBundle): ShotRecipeCatalog {
  if (research.version !== 3 || !ui?.documents.length) throw stageFailure("Shot recipes require verified UI documentation and current research.");
  const selected = new Set(research.facts.map(fact => fact.evidenceId));
  const assets = evidence.assets.filter(asset => asset.usage === "output" && asset.kind !== "audio" && research.visuals.some(visual => visual.assetId === asset.id)).sort((a, b) => a.id.localeCompare(b.id));
  const visible = (id: string) => research.visuals.find(visual => visual.assetId === id)!;
  const productAssets = assets.filter(asset => visible(asset.id).role === "product_ui" && visible(asset.id).showsProductUi);
  const editorialAssets = assets.filter(asset => asset.kind === "image" || !!asset.preview);
  const base = { version: 1 as const, researchSha256: stageDigest(research), evidenceSha256: research.evidenceSha256, uiSha256: ui.sha256 };
  const recipes: ShotRecipe[] = [];
  const options = buildCreativeBrief(research, evidence).concepts;
  for (const role of roles) {
    const ids = sorted((role === "product" ? [...selected] : [...(research.story?.[role]?.evidenceIds || []), ...(role === "mechanism" ? research.story?.mechanism?.steps.map(step => step.evidenceId) || [] : [])]).filter(id => selected.has(id)));
    const groups: Omit<ShotRecipe, "id">[][] = Array.from({ length: 6 }, () => []);
    for (const evidenceId of ids) {
      const common = { storyRole: role, evidenceId };
      if (role === "mechanism") {
        for (const step of research.story?.mechanism?.steps || []) for (const document of ui.documents) {
          const asset = productAssets.find(asset => asset.id === step.assetId);
          if (step.evidenceId === evidenceId && asset && !speech(asset) && visible(asset.id).supportsFactIds.includes(evidenceId) && document.sourceAssetIds.includes(asset.id) && document.capabilityFactIds.includes(evidenceId)) groups[0].push({ ...common, assetId: asset.id, template: "proof", visual: { kind: "ui-demo", documentId: document.id } });
        }
        continue;
      }
      const editorial = editorialAssets.find(asset => visible(asset.id).supportsFactIds.includes(evidenceId)) || editorialAssets.find(asset => visible(asset.id).role === "brand") || editorialAssets[0];
      if (editorial) {
        const template = role === "problem" ? "hook" : role === "product" ? "brand" : role === "cta" ? "cta" : "features";
        groups[0].push({ ...common, assetId: editorial.id, template, visual: { kind: "none" } });
        if (role !== "cta" && selected.size >= 2) groups[4].push({ ...common, assetId: editorial.id, template: "features", visual: { kind: "connections" } });
      }
      if (role === "cta") continue;
      for (const asset of productAssets.filter(asset => visible(asset.id).supportsFactIds.includes(evidenceId))) {
        groups[1].push({ ...common, assetId: asset.id, template: "proof", visual: { kind: speech(asset) ? "none" : "showcase" } });
        if (asset.kind !== "image") continue;
        for (const region of visible(asset.id).regions || []) if (region.supportsFactIds.includes(evidenceId)) groups[2].push({ ...common, assetId: asset.id, template: "proof", visual: { kind: "focus", regionId: region.id } });
        const secondary = productAssets.find(other => other.kind === "image" && other.id !== asset.id && visible(other.id).supportsFactIds.some(id => selected.has(id)));
        if (secondary) groups[3].push({ ...common, assetId: asset.id, template: "proof", visual: { kind: "panels", secondaryAssetId: secondary.id, secondaryEvidenceId: sorted(visible(secondary.id).supportsFactIds.filter(id => selected.has(id)))[0] } });
      }
    }
    const focusIds = options.find(option => option.concept === "focus")?.evidenceIds || [], groupingIds = options.find(option => option.concept === "consolidate")?.evidenceIds || [];
    for (const group of groups) group.sort((a, b) => {
      const priority = (recipe: Omit<ShotRecipe, "id">) => recipe.visual.kind === "panels" ? Number(groupingIds.includes(recipe.evidenceId) || groupingIds.includes(recipe.visual.secondaryEvidenceId)) : Number(focusIds.includes(recipe.evidenceId));
      return priority(b) - priority(a) || stageDigest(a).localeCompare(stageDigest(b));
    });
    // Reserve one slot for each available treatment before filling another.
    // Core narrative roles have separate quotas, so optional product choices
    // cannot consume their slots. Selection is stable under source array order.
    const seen = new Set<string>(); let count = 0;
    for (let round = 0; count < quota[role] && groups.some(group => round < group.length); round++) for (const group of groups) {
      const recipe = group[round]; if (!recipe || count >= quota[role]) continue;
      const key = stageDigest(recipe); if (seen.has(key)) continue; seen.add(key);
      recipes.push({ id: `shot-${stageDigest({ ...base, recipe }).slice(0, 24)}`, ...recipe }); count++;
    }
  }
  if (recipes.length > MAX_SHOT_RECIPES || !["mechanism", "outcome", "cta"].every(role => recipes.some(recipe => recipe.storyRole === role)) || !recipes.some(recipe => ["problem", "product"].includes(recipe.storyRole))) throw stageFailure("The verified sources cannot supply the required bounded shot recipes.");
  const catalog = { ...base, recipes };
  if (new Set(recipes.map(recipe => recipe.id)).size !== recipes.length || Buffer.byteLength(JSON.stringify(catalog), "utf8") > MAX_SHOT_RECIPE_BYTES) throw stageFailure("The trusted shot catalogue exceeds its identity or size bounds.");
  return catalog;
}

/** Advertise only concepts executable with a selected recipe, including action facts. */
export function shotRecipeConcepts(catalog: ShotRecipeCatalog, research: Research, evidence: Evidence, ui: UiDocumentBundle) {
  return buildCreativeBrief(research, evidence).concepts.map(option => ({ ...option, evidenceIds: option.evidenceIds.filter(id => catalog.recipes.some(recipe => {
    const visual = recipe.visual;
    if (option.concept === "connect") return recipe.visual.kind === "connections";
    if (option.concept === "consolidate") return recipe.visual.kind === "panels" && (recipe.evidenceId === id || recipe.visual.secondaryEvidenceId === id);
    if (!["ui-demo", "showcase", "focus"].includes(recipe.visual.kind)) return false;
    return recipe.evidenceId === id || (visual.kind === "ui-demo" && ui.documents.some(document => document.id === visual.documentId && document.capabilityFactIds.includes(id)) && research.visuals.some(visual => visual.assetId === recipe.assetId && visual.supportsFactIds.includes(id)));
  })) })).filter(option => option.evidenceIds.length);
}

export function assertRecipeScene(catalog: ShotRecipeCatalog, scene: { recipeId?: string; storyRole?: string; assetId: string; evidenceId: string; presentation?: Presentation }) {
  const recipe = catalog.recipes.find(recipe => recipe.id === scene.recipeId), visual = scene.presentation?.visual;
  const binding = visual?.kind === "ui-demo" ? { kind: visual.kind, documentId: visual.documentId } : visual?.kind === "focus" ? { kind: visual.kind, regionId: visual.regionId } : visual?.kind === "panels" ? { kind: visual.kind, secondaryAssetId: visual.secondaryAssetId, secondaryEvidenceId: visual.secondaryEvidenceId } : { kind: visual?.kind || "none" };
  if (!recipe || scene.storyRole !== recipe.storyRole || scene.assetId !== recipe.assetId || scene.evidenceId !== recipe.evidenceId || scene.presentation?.template !== recipe.template || stageDigest(binding) !== stageDigest(recipe.visual)) throw stageFailure("A compiled shot changed its trusted recipe source, fact, role or visual binding.");
}

export function validatePlanShotRecipes(plan: Plan, research: Research, evidence: Evidence, ui?: UiDocumentBundle) {
  if (!plan.production?.shotRecipeSha256) {
    if (plan.scenes.some(scene => scene.recipeId)) throw stageFailure("A legacy plan cannot acquire unbound shot recipes.");
    return;
  }
  if (!ui || !plan.creativeDirection) throw stageFailure("A recipe plan requires its immutable UI and creative direction.");
  const catalog = buildShotRecipeCatalog(research, evidence, ui);
  if (stageDigest(catalog) !== plan.production.shotRecipeSha256) throw stageFailure("The plan changed its source-bound shot catalogue.");
  for (const scene of plan.scenes) {
    const recipe = catalog.recipes.find(recipe => recipe.id === scene.recipeId), source = evidence.assets.find(asset => asset.id === recipe?.assetId), asset = plan.assets.find(asset => asset.id === scene.asset_id);
    const alias = recipe && recipe.template !== "proof" && source?.kind === "video" && source.preview && scene.asset_id === `${source.id}-typography-still` && asset?.kind === "image" && asset.usage === "output" && asset.path === source.preview;
    assertRecipeScene(catalog, { recipeId: scene.recipeId, storyRole: scene.storyRole, assetId: alias ? source.id : scene.asset_id, evidenceId: scene.evidence_id || "", presentation: scene.presentation });
  }
}
