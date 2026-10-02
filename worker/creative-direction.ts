import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { writeJson } from "./media";
import { stageDigest, stageFailure, type Research } from "./research";
import { PipelineError, type Evidence, type Hooks, type Plan, type Presentation } from "./types";

const factId = z.string().regex(/^fact-\d+$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const claim = z.object({ text: z.string().min(1).max(160), basis: z.enum(["explicit", "inferred"]), evidenceIds: z.array(factId).min(1).max(3) }).strict();
export const creativeConceptSchema = z.enum(["focus", "connect", "consolidate"]);
export const shotJobSchema = z.enum(["hook", "context", "action", "result", "payoff", "cta"]);
export const shotMotionSchema = z.enum(["reveal", "focus", "connect", "consolidate", "hold"]);
export const directionSelectionSchema = z.object({ concept: creativeConceptSchema, evidenceId: factId }).strict();
export const shotSelectionSchema = z.object({ job: shotJobSchema, motion: shotMotionSchema }).strict();
export const shotDirectionSchema = shotSelectionSchema.extend({ version: z.literal(1), continuityKey: z.string().min(1).max(300).optional() }).strict();
const brandSchema = z.object({ sourceUrl: z.string(), colors: z.array(z.object({ value: z.string(), role: z.enum(["accent", "background", "text"]) }).strict()), logoAssetIds: z.array(z.string()) }).strict();
const workflowSchema = z.array(z.object({ action: z.string().min(1).max(80), evidenceId: factId, assetId: z.string().min(1) }).strict()).min(1).max(3);
const conceptOptionSchema = z.object({ concept: creativeConceptSchema, evidenceIds: z.array(factId).min(1).max(24), meaning: z.string().max(350) }).strict();
export const creativeBriefSchema = z.object({
  version: z.literal(1), product: z.string().min(1).max(48), researchSha256: digest, evidenceSha256: digest,
  audience: claim, mechanism: claim, outcome: claim, cta: claim, workflow: workflowSchema,
  brand: brandSchema.nullable(), concepts: z.array(conceptOptionSchema).min(1).max(3),
}).strict();
export const creativeDirectionSchema = creativeBriefSchema.omit({ concepts: true }).extend({
  briefSha256: digest, concept: creativeConceptSchema, evidenceId: factId, evidence: z.string().min(1).max(900),
}).strict();
export type CreativeBrief = z.infer<typeof creativeBriefSchema>;
export type CreativeDirection = z.infer<typeof creativeDirectionSchema>;
export type ShotDirection = z.infer<typeof shotDirectionSchema>;
export type ShotSelection = z.infer<typeof shotSelectionSchema>;
export const CREATIVE_BRIEF_PATH = "analysis/creative-brief.json";
const invalid = (message: string) => new PipelineError("invalid_generated_script", message, "Inspect the retained creative brief and script. Keep the same supported product story and source bindings.", "needs_review");

/** Deterministic, source-bound options for the existing script call; never a new paid stage. */
export function buildCreativeBrief(research: Research, evidence: Evidence): CreativeBrief {
  const story = research.story;
  if (!story?.primaryAudience || !story.mechanism || !story.outcome || !story.cta) throw stageFailure("A creative brief requires the verified audience, workflow, outcome and CTA.");
  const selected = new Map(research.facts.map(fact => [fact.evidenceId, fact]));
  const mechanisms = [...new Set([...story.mechanism.evidenceIds, ...story.mechanism.steps.map(step => step.evidenceId)])];
  if (mechanisms.some(id => !selected.has(id))) throw stageFailure("The creative brief has an unselected workflow fact.");
  const concepts: CreativeBrief["concepts"] = [{ concept: "focus", evidenceIds: mechanisms, meaning: "Establish this actual product, focus attention on its documented action, then return to the complete readable result. The chosen input/control remains the same object." }];
  const relationship = research.facts.filter(fact => /\b(link(?:s|ed|ing)?|connect(?:s|ed|ing|ion|ions)?|relationship(?:s)?|graph|network)\b/i.test(fact.quote)).map(fact => fact.evidenceId);
  if (relationship.length && research.facts.length >= 2) concepts.push({ concept: "connect", evidenceIds: relationship, meaning: "Draw a relationship between two or three individually source-bound informational nodes. This is an explanatory diagram, not an invented application state or decorative network." });
  const grouping = research.facts.filter(fact => /\b(organiz(?:e|es|ed|ing|ation)|organis(?:e|es|ed|ing|ation)|centraliz(?:e|ed|es)|unif(?:y|ied)|collect(?:s|ed|ion|ing)?|consolidat(?:e|es|ed|ion)|one place|all.in.one)\b/i.test(fact.quote)).map(fact => fact.evidenceId);
  const stills = research.visuals.filter(visual => visual.showsProductUi && visual.role === "product_ui" && evidence.assets.some(asset => asset.id === visual.assetId && asset.kind === "image" && asset.usage === "output"));
  const groupingProof = grouping.filter(id => stills.some(visual => visual.supportsFactIds.includes(id)));
  if (groupingProof.length && stills.length >= 2) concepts.push({ concept: "consolidate", evidenceIds: groupingProof, meaning: "Bring two distinct intact, verified product panels into a shared composition. Their original data stays separate; convergence does not imply an undocumented merge or workflow." });
  const { steps: workflow, ...mechanism } = story.mechanism;
  const source = evidence.brand;
  return creativeBriefSchema.parse({ version: 1, product: research.product, researchSha256: stageDigest(research), evidenceSha256: research.evidenceSha256, audience: story.primaryAudience, mechanism, outcome: story.outcome, cta: story.cta, workflow,
    brand: source ? { sourceUrl: source.sourceUrl, colors: source.colors.map(({ value, role }) => ({ value, role })), logoAssetIds: source.logoAssetIds.filter(id => evidence.assets.some(asset => asset.id === id && asset.usage === "output" && asset.provenance?.role === "brand-logo")) } : null, concepts });
}

/** A saved deterministic brief is immutable; persistence must finish before script spending. */
export async function persistCreativeBrief(brief: CreativeBrief, workspace: string, hooks: Pick<Hooks, "persist">) {
  let saved: unknown;
  try { saved = JSON.parse(await readFile(join(workspace, CREATIVE_BRIEF_PATH), "utf8")); }
  catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw stageFailure("The retained creative brief is unreadable."); }
  if (saved !== undefined && stageDigest(saved) !== stageDigest(brief)) throw stageFailure("The retained creative brief belongs to changed source evidence or direction policy.");
  if (saved === undefined) await writeJson(join(workspace, CREATIVE_BRIEF_PATH), brief);
  await hooks.persist([CREATIVE_BRIEF_PATH]);
}

export function compileCreativeDirection(selection: unknown, research: Research, evidence: Evidence): CreativeDirection {
  const parsed = directionSelectionSchema.safeParse(selection);
  if (!parsed.success) throw invalid("Choose exactly one supported creative concept and its eligible source fact.");
  const brief = buildCreativeBrief(research, evidence), { concept, evidenceId } = parsed.data;
  if (!brief.concepts.some(option => option.concept === concept && option.evidenceIds.includes(evidenceId))) throw invalid("The selected creative concept is not eligible for its product evidence and available visual primitives.");
  const { concepts: _concepts, ...bound } = brief;
  return creativeDirectionSchema.parse({ ...bound, briefSha256: stageDigest(brief), concept, evidenceId, evidence: research.facts.find(fact => fact.evidenceId === evidenceId)!.quote });
}

interface DirectedScene { storyRole?: string; assetId: string; evidenceId: string; preserveAudio: boolean; presentation?: Presentation; direction?: ShotSelection | ShotDirection }
const roleJobs: Record<string, ShotDirection["job"][]> = { problem: ["hook"], product: ["context"], mechanism: ["action", "result"], outcome: ["result", "payoff"], differentiator: ["payoff"], cta: ["cta"] };
/** Derived identity is a visual motif only. It never carries or fabricates product UI state. */
export function compileShotDirection(scene: DirectedScene): ShotDirection {
  const raw = shotSelectionSchema.safeParse(scene.direction && { job: scene.direction.job, motion: scene.direction.motion });
  if (!raw.success || !roleJobs[scene.storyRole || ""]?.includes(raw.data.job)) throw invalid("Every directed shot needs a job matching its grounded narrative role.");
  const { job, motion } = raw.data, visual = scene.presentation?.visual;
  if (scene.preserveAudio && motion !== "hold") throw invalid("Preserved source speech requires a stable directed shot with motion hold.");
  if (job === "cta" && motion !== "hold") throw invalid("The final directed CTA must use a stable hold.");
  if (motion === "focus" && !["ui-demo", "focus", "showcase"].includes(visual?.kind || "")) throw invalid("Focus motion requires an actual UI demonstration, verified crop or product showcase.");
  if (motion === "connect" && visual?.kind !== "connections") throw invalid("Connect motion requires source-bound informational connection nodes.");
  if (motion === "consolidate" && visual?.kind !== "panels") throw invalid("Consolidate motion requires two intact verified product panels.");
  const continuityKey = visual?.kind === "ui-demo" ? `ui:${visual.documentId}` : visual?.kind === "panels" ? `panels:${scene.assetId}:${visual.secondaryAssetId}` : scene.presentation?.template === "proof" && visual?.kind !== "connections" ? `asset:${scene.assetId}` : undefined;
  return shotDirectionSchema.parse({ version: 1, job, motion, ...(continuityKey ? { continuityKey } : {}) });
}

export function validateDirectedStory(direction: CreativeDirection | undefined, scenes: DirectedScene[], research: Research, evidence: Evidence, previous?: { creativeDirection?: CreativeDirection }) {
  if (!direction) {
    if (scenes.some(scene => scene.direction) || previous?.creativeDirection) throw stageFailure("A script cannot drop its immutable creative direction or add unbound shot motion.");
    return;
  }
  if (previous && !previous.creativeDirection) throw stageFailure("A repair cannot upgrade a retained legacy film to a different directed renderer contract.");
  const expected = compileCreativeDirection({ concept: direction.concept, evidenceId: direction.evidenceId }, research, evidence);
  if (stageDigest(direction) !== stageDigest(expected) || (previous?.creativeDirection && stageDigest(previous.creativeDirection) !== stageDigest(direction))) throw stageFailure("The script changed its source-bound creative direction.");
  for (const scene of scenes) if (stageDigest(scene.direction) !== stageDigest(compileShotDirection(scene))) throw stageFailure("A shot changed its compiled motion or source continuity identity.");
  if (!scenes.some(scene => {
    const visual = scene.presentation?.visual;
    const facts = [scene.evidenceId, ...(visual?.kind === "connections" ? visual.nodes.map(node => node.evidenceId) : visual?.kind === "panels" ? [visual.secondaryEvidenceId] : [])];
    return scene.direction?.motion === direction.concept && facts.includes(direction.evidenceId);
  })) throw invalid("At least one shot must execute the selected creative concept with its cited product fact and supported visual primitive.");
  if (!scenes.some(scene => scene.direction?.job === "action") || !scenes.some(scene => ["result", "payoff"].includes(scene.direction?.job || ""))) throw invalid("Directed films require a concrete action and a distinct result or payoff job.");
  if (!["hook", "context"].includes(scenes[0]?.direction?.job || "")) throw invalid("A directed film must open with its audience problem or actual product context.");
}

/** Read-only restart guard: rebind direction and scene identities to retained verified research. */
export function validatePlanCreativeDirection(plan: Plan, research: Research, evidence: Evidence) {
  if (plan.creativeDirection && plan.scenes.some(scene => !scene.evidence_id || research.facts.find(fact => fact.evidenceId === scene.evidence_id)?.quote !== scene.evidence)) throw stageFailure("A directed plan lost its canonical shot evidence binding.");
  validateDirectedStory(plan.creativeDirection, plan.scenes.map(scene => ({ storyRole: scene.storyRole, assetId: scene.asset_id, evidenceId: scene.evidence_id || "", preserveAudio: scene.preserve_audio, presentation: scene.presentation, direction: scene.direction })), research, evidence);
}
