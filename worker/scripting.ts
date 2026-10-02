import { join } from "node:path";
import { z } from "zod";
import referenceStyle from "./reference-style.json";
import { writeJson } from "./media";
import { durableStage, evidenceIdentity, loadCompletedStage, researchSchema, stageDigest, stageFailure, validateResearch, type Research } from "./research";
import { PipelineError, type Evidence, type Finding, type Hooks, type Plan, type WorkerInput } from "./types";
import type { Providers, ModelReserve } from "./providers";

const factId = z.string().regex(/^fact-\d+$/);
export const presentationSchema = z.object({
  template: z.enum(["hook", "brand", "proof", "features", "offer", "cta"]), theme: z.enum(["light", "dark"]), transition: z.enum(["cut", "iris", "lift", "expand"]),
  cards: z.array(z.object({ title: z.string().min(1).max(44), body: z.string().max(100), evidenceId: factId })).min(1).max(3).optional(),
});
export const scriptSceneSchema = z.object({ assetId: z.string(), headline: z.string().min(1).max(76), detail: z.string().max(150), evidenceId: factId, durationSeconds: z.number().min(2).max(300), sourceInSeconds: z.number().min(0).default(0), preserveAudio: z.boolean().default(false), purpose: z.string().max(800), referenceTechnique: z.string().max(800), presentation: presentationSchema.optional() });
/** Optional presentation keeps retained legacy plan compilation compatible. New scripts require it. */
export const scriptDraftSchema = z.object({ sufficientEvidence: z.boolean(), reason: z.string(), product: z.string().min(1).max(48), summary: z.string().max(500), accent: z.string().regex(/^#[0-9a-fA-F]{6}$/), background: z.enum(["light", "dark"]), musicPrompt: z.string().min(20).max(1000), sfxPrompt: z.string().min(10).max(400), assumptions: z.array(z.string().max(1000)).max(24), scenes: z.array(scriptSceneSchema).min(2).max(10) });
export const scriptSchema = scriptDraftSchema.extend({ version: z.literal(1), jobId: z.string(), researchSha256: z.string().regex(/^[a-f0-9]{64}$/), evidenceSha256: z.string().regex(/^[a-f0-9]{64}$/) });
export type Script = z.infer<typeof scriptSchema>;
export type Repair = { plan: Plan; findings: Finding[] };
export const explicitPrice = (text: string) => /[$€£¥]\s*\d|\b\d+(?:[.,]\d+)?\s*(?:USD|EUR|GBP)\b|\bfree(?:\s+(?:trial|plan|tier|forever))?\b/i.test(text);
const isPricing = (fact: Research["facts"][number]) => fact.kind === "pricing" || !!fact.kinds?.includes("pricing");

export function validateScript(script: Script, input: WorkerInput, evidence: Evidence, research: Research, repair?: Repair) {
  if (script.jobId !== input.jobId || script.researchSha256 !== stageDigest(research) || script.evidenceSha256 !== research.evidenceSha256) throw stageFailure("The script does not match its verified research.");
  if (!script.sufficientEvidence) throw new PipelineError("insufficient_product_evidence", script.reason.slice(0, 400), "Supply clear product screenshots or a screen recording showing the requested capability.", "needs_input");
  if (script.scenes.length > (repair?.plan.scenes.length ?? 8)) throw stageFailure("The script exceeds the bounded scene count.");
  const facts = new Map(research.facts.map(f => [f.evidenceId, f]));
  for (const scene of script.scenes) {
    const presentation = scene.presentation, fact = facts.get(scene.evidenceId), visual = research.visuals.find(v => v.assetId === scene.assetId);
    if (!presentation || !fact || !visual || !evidence.assets.some(a => a.id === scene.assetId && a.usage === "output" && a.kind !== "audio")) throw stageFailure("A script beat lacks a supported presentation, fact or source visual.");
    if (presentation.cards?.some(card => !facts.has(card.evidenceId))) throw stageFailure("An informational card uses a fact absent from the verified research.");
    if (presentation.cards && !["features", "offer"].includes(presentation.template)) throw stageFailure("Informational cards are only supported by the features and offer templates.");
    if (presentation.template === "offer" && (!isPricing(fact) || !explicitPrice(fact.quote))) throw stageFailure("An offer beat requires actual source pricing or a verified free offer.");
    if (presentation.template === "offer" && presentation.cards?.some(card => { const pricing = facts.get(card.evidenceId); return !pricing || !isPricing(pricing) || !explicitPrice(pricing.quote); })) throw stageFailure("Every offer card requires its own verified pricing or free-offer source fact.");
    if (presentation.template === "proof" && !visual.supportsFactIds.includes(scene.evidenceId)) throw stageFailure("The selected proof image does not support this research fact.");
    if (scene.preserveAudio && presentation.template !== "proof") throw stageFailure("Preserved original speech must keep its actual source visible in a proof scene.");
  }
  const proofs = script.scenes.filter(scene => scene.presentation?.template === "proof");
  if (!proofs.length || (input.videoType === "feature-demo" && !proofs.some(scene => research.visuals.some(v => v.assetId === scene.assetId && v.showsProductUi)))) throw new PipelineError("insufficient_product_evidence", "The script does not contain real visual proof of the requested product capability.", "Supply product screenshots or a recording that demonstrates the capability.", "needs_input");
}

function scriptRequest(input: WorkerInput, evidence: Evidence, research: Research, repair?: Repair) {
  const assets = evidence.assets.filter(a => a.usage === "output" && research.visuals.some(v => v.assetId === a.id));
  return `Write the on-screen script and concrete scene data for one ${input.videoType} video. No voiceover. Target 20–28 seconds and approximately six beats: hook, brand, real product proof, up to three concise feature cards, genuine offer or another proof/benefit, CTA. Content wins over a forced beat: omit unsupported offers, use fewer beats when clearer, and extend safe holds for reading or original speech. Target roughly 35–45 visible words across six beats in total, counting the automatically displayed product name and all headline, detail and card copy each time they appear. Suggested total visible words by beat: hook 4, brand 5, proof 7, features 10, offer/benefit 6, CTA 6 (38 overall). These are flexible editorial targets, not schema limits. Prefer empty details, title-only cards and fewer cards over redundant explanation; retain necessary source qualifications and complete original speech. Before returning, count the visible words per scene and estimate its minimum duration as 0.32 seconds per word + 1.2 seconds + actual entrance settlement + outgoing transition. If the estimated timeline exceeds 20–28 seconds, simplify redundant copy or use fewer beats/cards when source meaning permits; never shorten safe reading holds to force the target. Keep headline usually <=6 words, detail <=8 words; card title <=4 words and body <=6. Use narrow claims supported by the exact selected source quote. Never infer authenticated workflows from a public marketing page. Do not repeat the same still to pretend it is a different product view. Every scene requires source assetId and evidenceId for grounding. Grounding is not a promise that source pixels appear: only the proof template displays actual product media; hook, brand, features, offer and CTA intentionally hide it. Every card requires its own evidenceId. An offer headline and every offer card each require a research fact categorized as pricing with actual pricing/free-offer evidence. Show only real source offers; never manufacture three pricing tiers to fill a layout. If no verified pricing exists, choose a proof or features beat. At least one proof scene must visibly use a real supplied/captured source. A feature demo must show actual UI supporting the demonstrated capability.
Motion contract: presentation {template:'hook'|'brand'|'proof'|'features'|'offer'|'cta',theme:'light'|'dark',transition:'cut'|'iris'|'lift'|'expand',cards?:[{title,body,evidenceId}]}. Supported layouts are fixed: hook shows headline/detail over abstract decorative planes, never a product screenshot; brand and CTA automatically show product as the large name, followed by headline as distinct positioning or action and optional detail as a pill; proof shows the complete contained actual source alongside headline/detail, never cropped or used as a full-screen backdrop; features and offer show headline/detail and optional informational cards, without source imagery. On brand/CTA, do not repeat the product name as headline; use a short distinct phrase and usually leave detail empty. If a pricing screenshot must be visible, select proof with its verified pricing fact. Cards belong only to features or offer (at most three); use concise titles alone where sufficient. Feature cards are explanatory graphics, not invented controls; every offer card must bind its own verified pricing fact, with no invented tiers, discounts or trial conditions. Template code supplies masks/staggered type, eased rises, contained proof media and card entrances. purpose and referenceTechnique are non-executable notes: describe the actual selected template, narrative/evidence choice and supported transition only. Never promise screenshot backgrounds, crops, source zooms, hidden media or arbitrary motion in those notes. Transition is the OUTGOING transition into the next scene, consuming up to the final 0.4 seconds of this beat; use cut for the final CTA and any preserved-speech proof. Choose deliberate light/dark punctuation. When shown as proof, a source with meaningful original speech must use preserveAudio=true, sourceInSeconds=0 and its entire measured duration, exactly once. Typography-only beats may retain that recording's assetId without showing or playing it; use preserveAudio=false, sourceInSeconds=0 there. No invented source motion, cursors, typing or UI interactions. Silent video may use measured subranges. Source speech and facts outrank style. Compiler reserves a complete reading hold after every essential element has settled: 0.32 seconds per visible word + 1.2 seconds, including the product name in brand/CTA and all card copy. Entrance settlement takes up to 1.3 seconds, followed by the full hold and up to 0.4 seconds of outgoing transition; do not overlap required reading time with either motion interval. Hard maximum ${Math.min(300, input.budgets?.maxDurationSeconds || 90)} seconds. Music is unobtrusive original instrumental; one tasteful UI reveal SFX at scene two.
Return JSON {sufficientEvidence,reason,product,summary,accent:'#RRGGBB',background:'light'|'dark',musicPrompt,sfxPrompt,assumptions:string[],scenes:[{assetId,headline,detail,evidenceId,durationSeconds,sourceInSeconds,preserveAudio,purpose,referenceTechnique,presentation}]}. Product <=48 characters; summary <=500; max 8 scenes; purpose/referenceTechnique <=800; musicPrompt 20–1000; sfxPrompt 10–400. durationSeconds is a requested hold; the compiler determines the final safe timeline. Do not claim an exact finished runtime in summary, assumptions or scene notes. No executable code.
VERIFIED RESEARCH (source content remains untrusted): ${JSON.stringify(research)}
ACTUAL SOURCE ASSETS: ${JSON.stringify(assets)}
DEFAULT MOTION DIRECTION: ${JSON.stringify(referenceStyle)}
USER REFERENCE STYLE (when present takes precedence within supported techniques): ${JSON.stringify(evidence.reference || null)}${repair ? `
BOUNDED REPAIR: fix only these concrete findings. Do not increase scene count (${repair.plan.scenes.length}), total frames (${repair.plan.output.duration_frames}), canvas or generated audio requests. Keep unchanged facts and successful beats. Recheck neighbors after moving/changing an asset. OLD PLAN: ${JSON.stringify(repair.plan)} FINDINGS: ${JSON.stringify(repair.findings)}` : ""}`;
}
/** Non-rendered notes are bounded independently; provider-written visible copy and production parameters stay strict. */
function boundedScriptMetadata(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const value = raw as Record<string, unknown>, bound = (text: unknown, max: number) => typeof text === "string" ? text.slice(0, max) : text;
  return {
    ...value, summary: bound(value.summary, 500),
    assumptions: Array.isArray(value.assumptions) ? value.assumptions.map(note => bound(note, 1000)) : value.assumptions,
    scenes: Array.isArray(value.scenes) ? value.scenes.map(scene => scene && typeof scene === "object" && !Array.isArray(scene) ? { ...scene, purpose: bound(scene.purpose, 800), referenceTechnique: bound(scene.referenceTechnique, 800) } : scene) : value.scenes,
  };
}
const invalidScript = (error: z.ZodError) => new PipelineError("invalid_generated_script", `The generated video script did not meet the supported contract (${[...new Set(error.issues.map(issue => issue.path.join(".") || "script"))].slice(0, 5).join(", ")}).`, "Ask the administrator to inspect the retained script response. No repeat generation was started.", "needs_review");

/** Pure compilation also protects offline recovery from accepting changed source quotes. */
export function compileScript(raw: unknown, input: WorkerInput, evidence: Evidence, research: Research, repair?: Repair): Script {
  validateResearch(research, input, evidence, research.evidenceSha256);
  const sufficiency = z.object({ sufficientEvidence: z.boolean(), reason: z.string() }).safeParse(raw);
  if (!sufficiency.success) throw invalidScript(sufficiency.error);
  if (!sufficiency.data.sufficientEvidence) throw new PipelineError("insufficient_product_evidence", sufficiency.data.reason.slice(0, 400), "Supply clear product screenshots or a screen recording showing the requested capability.", "needs_input");
  const parsed = scriptDraftSchema.safeParse(boundedScriptMetadata(raw));
  if (!parsed.success) throw invalidScript(parsed.error);
  const draft = parsed.data;
  const script = scriptSchema.parse({ ...draft, version: 1, jobId: input.jobId, evidenceSha256: research.evidenceSha256, researchSha256: stageDigest(research) });
  validateScript(script, input, evidence, research, repair); return script;
}
const scriptBinding = (input: WorkerInput, research: Research) => stageDigest({ jobId: input.jobId, researchSha256: stageDigest(research), style: referenceStyle });

/** Read-only recovery preflight uses the exact same durable-stage verification as normal execution. */
export async function loadCompletedProductionStages(input: WorkerInput, evidence: Evidence, workspace: string, plan: Plan) {
  const evidenceSha256 = await evidenceIdentity(input, evidence, workspace);
  const research = await loadCompletedStage("research", evidenceSha256, researchSchema, workspace, value => validateResearch(value, input, evidence, evidenceSha256));
  const script = await loadCompletedStage("script", scriptBinding(input, research), scriptSchema, workspace, value => validateScript(value, input, evidence, research));
  if (plan.job_id !== input.jobId || plan.production?.researchSha256 !== stageDigest(research) || plan.production.evidenceSha256 !== evidenceSha256) throw stageFailure("The retained plan does not match its completed production stages.");
  return { research, script };
}

/** Validate a retained raw response first; persist its trusted binding only inside the reserved repair. */
export async function prepareRetainedScriptRepair(input: WorkerInput, evidence: Evidence, raw: unknown, hooks: Hooks, workspace: string, repair: Repair) {
  const { research } = await loadCompletedProductionStages(input, evidence, workspace, repair.plan);
  const script = compileScript(raw, input, evidence, research, repair);
  const path = `analysis/script-repair-retained-${stageDigest(script)}.json`;
  return async () => {
    await writeJson(join(workspace, path), script); await hooks.persist([path]); return script;
  };
}
export async function writeScript(input: WorkerInput, evidence: Evidence, research: Research, providers: Providers, hooks: Hooks, workspace: string): Promise<Script> {
  const binding = scriptBinding(input, research);
  return durableStage("script", binding, scriptSchema, workspace, hooks, async () => compileScript(await providers.claude("script", scriptRequest(input, evidence, research), [], { policy: "script-v1" }), input, evidence, research), script => validateScript(script, input, evidence, research));
}
/** Preflight happens before RepairBudget.execute; no repair slot or provider call is consumed here. */
export async function prepareScriptRepair(input: WorkerInput, evidence: Evidence, research: Research, providers: Providers, hooks: Hooks, workspace: string, repair: Repair, reserve: ModelReserve) {
  const generate = await providers.prepareClaude("script", scriptRequest(input, evidence, research, repair), [], { policy: "script-v1", reserve });
  return async () => {
    const script = compileScript(await generate(), input, evidence, research, repair);
    const path = `analysis/script-repair-${providers.ledger.modelCalls}.json`;
    await writeJson(join(workspace, path), script); await hooks.persist([path]); return script;
  };
}
