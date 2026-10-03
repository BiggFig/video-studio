import { workflowInputReserve, workflowOutputLimit, workflowSceneLimit } from "./workflow-coherence";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { hash, writeJson } from "./media";
import { safePath } from "./security";
import { PipelineError, type Evidence, type Hooks, type WorkerInput } from "./types";
import type { Providers } from "./providers";
import { assertResearchRetryUnused, compileResearchWithRetry, type ResearchRequest } from "./research-review";
import { hasResearchPixels, persistResearchReadiness, researchAssets, researchReadiness } from "./research-readiness";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const factId = z.string().regex(/^fact-\d+$/);
const factKind = z.enum(["product", "audience", "problem", "feature", "benefit", "pricing", "cta", "planned", "limitation"]);
const factSelection = z.object({ evidenceId: factId, kind: factKind, kinds: z.array(factKind).max(9).optional(), label: z.string().min(1).max(140) });
const storyClaim = z.object({ text: z.string().min(1).max(160), basis: z.enum(["explicit", "inferred"]), evidenceIds: z.array(factId).min(1).max(3) });
export const storySchema = z.object({
  primaryAudience: storyClaim.extend({ text: z.string().min(1).max(80) }).nullable(),
  problem: storyClaim.nullable(),
  mechanism: storyClaim.extend({ steps: z.array(z.object({ action: z.string().min(1).max(80), evidenceId: factId, assetId: z.string().min(1) })).min(1).max(3) }).nullable(),
  outcome: storyClaim.nullable(), differentiator: storyClaim.nullable(), cta: storyClaim.nullable(),
});
export type ResearchStory = z.infer<typeof storySchema>;
const regionSchema = z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/), rect: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().min(0.05).max(1), height: z.number().min(0.05).max(1) }).refine(rect => rect.x + rect.width <= 1.000001 && rect.y + rect.height <= 1.000001, "Focus region exceeds its actual source"), supportsFactIds: z.array(factId).min(1).max(6) });
const visualSchema = z.object({ assetId: z.string(), description: z.string().min(1).max(500), supportsFactIds: z.array(factId).max(12), showsProductUi: z.boolean(), role: z.enum(["product_ui", "marketing", "brand", "other"]).optional(), regions: z.array(regionSchema).max(3).optional() });
export const documentTargetSchema = z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/), sourceAssetIds: z.array(z.string().min(1)).min(1).max(2), capabilityFactIds: z.array(factId).min(1).max(4), goal: z.string().min(1).max(240) }).strict();
const researchDraftSchema = z.object({
  sufficientEvidence: z.boolean(), reason: z.string().max(1000), product: z.string().min(1).max(48),
  summary: z.string().min(1).max(600),
  facts: z.array(factSelection).min(1).max(24),
  visuals: z.array(visualSchema).min(1).max(16), story: storySchema.optional(), documentTargets: z.array(documentTargetSchema).min(1).max(2).optional(),
  limitations: z.array(z.string().min(1).max(500)).max(16),
});
export const researchSchema = researchDraftSchema.extend({
  version: z.union([z.literal(1), z.literal(2), z.literal(3)]), jobId: z.string(), evidenceSha256: digest,
  facts: z.array(factSelection.extend({ kinds: z.array(factKind).min(1).max(9).optional(), quote: z.string().min(1).max(900) })).min(1).max(24),
});
export type Research = z.infer<typeof researchSchema>;

/** Director notes never establish source truth. The complete provider response is retained separately. */
function boundedResearchMetadata(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const value = raw as Record<string, unknown>, bound = (text: unknown, max: number) => typeof text === "string" ? text.slice(0, max) : text;
  return {
    ...value, reason: bound(value.reason, 1000), summary: bound(value.summary, 600),
    facts: Array.isArray(value.facts) ? value.facts.map(fact => fact && typeof fact === "object" && !Array.isArray(fact) ? { ...fact, label: bound(fact.label, 140) } : fact) : value.facts,
    visuals: Array.isArray(value.visuals) ? value.visuals.map(visual => visual && typeof visual === "object" && !Array.isArray(visual) ? { ...visual, description: bound(visual.description, 500) } : visual) : value.visuals,
    ...(Array.isArray(value.documentTargets) ? { documentTargets: value.documentTargets.map(target => target && typeof target === "object" && !Array.isArray(target) ? { ...target, goal: bound(target.goal, 240) } : target) } : {}),
    limitations: Array.isArray(value.limitations) ? value.limitations.map(note => bound(note, 500)) : value.limitations,
  };
}

export function evidenceCatalog(text: string) {
  const passages: string[] = [];
  for (const paragraph of text.split(/\r?\n\s*\r?\n/)) for (let offset = 0; offset < paragraph.length; offset += 900) {
    const passage = paragraph.slice(offset, offset + 900).trim(); if (passage.length >= 3) passages.push(passage);
  }
  return passages.map((text, index) => ({ id: `fact-${index + 1}`, text }));
}
export function sourceFacts(evidence: Evidence) {
  return evidenceCatalog(evidence.text + "\n\n" + evidence.assets.filter(a => a.usage === "output").map(a => a.transcript?.text || "").join("\n\n"));
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}
export const stageDigest = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
export const stageFailure = (message: string) => new PipelineError("production_stage_changed", message, "Ask the administrator to inspect the retained research, script and source records. Repeating paid work was prevented.", "needs_review");

/** Bind source bytes as well as text/metadata; a reused filename is not source identity. */
export async function evidenceIdentity(input: WorkerInput, evidence: Evidence, workspace: string) {
  const paths = [...new Set(evidence.assets.flatMap(asset => [asset.path, ...(asset.preview ? [asset.preview] : [])]))].sort();
  const files = await Promise.all(paths.map(async path => ({ path, sha256: await hash(safePath(workspace, path)) })));
  return stageDigest({ input: { jobId: input.jobId, ownerId: input.ownerId, mode: input.mode, productUrl: input.productUrl, videoType: input.videoType, format: input.format }, evidence, files });
}
async function optionalJson(path: string) {
  try { return JSON.parse(await readFile(path, "utf8")) as unknown; }
  catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined; throw stageFailure("A saved production stage is unreadable."); }
}
const stageStateSchema = z.object({ version: z.literal(1), stage: z.string(), binding: digest, status: z.enum(["reserved", "completed"]), artifactSha256: digest.optional() });

function completedStage<T>(name: "research" | "script" | "ui", binding: string, schema: z.ZodType<T>, saved: unknown, stateRaw: unknown, validate: (value: T) => void): T {
  const state = stageStateSchema.safeParse(stateRaw), parsed = schema.safeParse(saved);
  if (!state.success || state.data.stage !== name || state.data.binding !== binding || state.data.status !== "completed" || !parsed.success || state.data.artifactSha256 !== stageDigest(parsed.data)) throw stageFailure(`The retained ${name} stage is incomplete or does not match this job.`);
  validate(parsed.data); return parsed.data;
}

/** Recovery may read confirmed stages, but must never reserve or regenerate a missing stage. */
export async function loadCompletedStage<T>(name: "research" | "script" | "ui", binding: string, schema: z.ZodType<T>, workspace: string, validate: (value: T) => void): Promise<T> {
  const [saved, state] = await Promise.all([optionalJson(join(workspace, `analysis/${name}.json`)), optionalJson(join(workspace, `analysis/${name}-state.json`))]);
  return completedStage(name, binding, schema, saved, state, validate);
}

/** The reservation is durable before a paid call. Ambiguous stage completion never repeats it. */
export async function durableStage<T>(name: "research" | "script" | "ui", binding: string, schema: z.ZodType<T>, workspace: string, hooks: Hooks, generate: () => Promise<T>, validate: (value: T) => void): Promise<T> {
  const artifact = `analysis/${name}.json`, statePath = `analysis/${name}-state.json`;
  const [saved, stateRaw] = await Promise.all([optionalJson(join(workspace, artifact)), optionalJson(join(workspace, statePath))]);
  if (saved !== undefined || stateRaw !== undefined) {
    return completedStage(name, binding, schema, saved, stateRaw, validate);
  }
  const state = { version: 1 as const, stage: name, binding, status: "reserved" as const };
  await writeJson(join(workspace, statePath), state); await hooks.persist([statePath]);
  const result = schema.parse(await generate()); validate(result);
  await writeJson(join(workspace, artifact), result); await hooks.persist([artifact]);
  await writeJson(join(workspace, statePath), { ...state, status: "completed", artifactSha256: stageDigest(result) }); await hooks.persist([statePath]);
  return result;
}

export function validateResearch(research: Research, input: WorkerInput, evidence: Evidence, evidenceSha256: string) {
  if (research.jobId !== input.jobId || research.evidenceSha256 !== evidenceSha256) throw stageFailure("The research belongs to different source evidence.");
  const facts = new Map(sourceFacts(evidence).map(fact => [fact.id, fact.text])), ids = new Set(research.facts.map(f => f.evidenceId));
  if (ids.size !== research.facts.length) throw stageFailure("Retained research contains duplicate source fact IDs.");
  if (research.facts.some(f => !facts.has(f.evidenceId))) throw stageFailure("Research selected an unknown source fact ID.");
  if (research.facts.some(f => facts.get(f.evidenceId) !== f.quote)) throw stageFailure("A retained research quote differs from its canonical source passage.");
  if (research.facts.some(f => f.kinds && (!f.kinds.includes(f.kind) || new Set(f.kinds).size !== f.kinds.length))) throw stageFailure("Retained research has inconsistent fact categories.");
  if (new Set(research.visuals.map(v => v.assetId)).size !== research.visuals.length || research.visuals.some(v => !evidence.assets.some(a => a.id === v.assetId && a.usage === "output") || v.supportsFactIds.some(id => !facts.has(id)))) throw stageFailure("Research uses an unavailable visual or unknown source fact binding.");
  if (research.version >= 2) {
    if (!research.story || research.visuals.some(visual => !visual.role)) throw stageFailure("The current research contract requires a grounded story and classified visual evidence.");
    for (const visual of research.visuals) {
      const asset = evidence.assets.find(value => value.id === visual.assetId)!;
      if ((visual.role === "product_ui") !== visual.showsProductUi || (visual.role === "product_ui" && (asset.kind === "audio" || asset.provenance?.role === "brand-logo" || (asset.provenance?.pageKind === "pricing" && asset.provenance.method === "viewport")))) throw stageFailure("The product UI classification contradicts its source evidence.");
      if (visual.regions?.length && (visual.role !== "product_ui" || asset.kind !== "image" || new Set(visual.regions.map(region => region.id)).size !== visual.regions.length || visual.regions.some(region => region.supportsFactIds.some(id => !visual.supportsFactIds.includes(id))))) throw stageFailure("A focus region is not bound to a confirmed still product UI and its source facts.");
    }
    for (const [role, claim] of Object.entries(research.story)) if (claim) {
      if (new Set(claim.evidenceIds).size !== claim.evidenceIds.length || claim.evidenceIds.some(id => !ids.has(id))) throw stageFailure("A story claim uses a fact absent from the selected canonical research.");
      if (!["primaryAudience", "problem", "outcome"].includes(role) && claim.basis !== "explicit") throw stageFailure("Product mechanisms, differentiators and calls to action require explicit source evidence.");
    }
    for (const step of research.story.mechanism?.steps || []) {
      const visual = research.visuals.find(value => value.assetId === step.assetId);
      if (!ids.has(step.evidenceId) || !visual?.supportsFactIds.includes(step.evidenceId)) throw stageFailure("A product mechanism step lacks a selected fact and matching source visual.");
    }
    if (!research.story.primaryAudience || !research.story.mechanism || !research.story.outcome || !research.story.cta) throw new PipelineError("insufficient_product_evidence", "The source does not establish an audience, product mechanism, outcome and usable next step.", "Supply product information and actual UI screenshots or a recording showing the main workflow.", "needs_input");
    if (!research.visuals.some(visual => visual.role === "product_ui" && visual.showsProductUi && research.story!.mechanism!.steps.some(step => step.assetId === visual.assetId && visual.supportsFactIds.includes(step.evidenceId)))) throw new PipelineError("insufficient_product_evidence", "No confirmed product UI demonstrates the researched mechanism.", "Supply actual product UI screenshots or a screen recording. A pricing page or logo cannot substitute for a product demonstration.", "needs_input");
  }
  if (research.version === 3) {
    const targets = research.documentTargets;
    if (!targets?.length || new Set(targets.map(target => target.id)).size !== targets.length) throw stageFailure("Current research requires unique UI documentation targets before scripting.");
    for (const target of targets) {
      if (new Set(target.sourceAssetIds).size !== target.sourceAssetIds.length || new Set(target.capabilityFactIds).size !== target.capabilityFactIds.length) throw stageFailure("UI documentation targets require distinct sources and capability facts.");
      const visuals = target.sourceAssetIds.map(id => research.visuals.find(visual => visual.assetId === id));
      if (visuals.some(visual => !visual || visual.role !== "product_ui" || !visual.showsProductUi)) throw stageFailure("Only confirmed actual product UI can be selected for reconstruction.");
      if (target.capabilityFactIds.some(id => !ids.has(id) || !visuals.some(visual => visual!.supportsFactIds.includes(id)))) throw stageFailure("The UI documentation target has a capability without matching selected source evidence.");
      if (!research.story?.mechanism?.steps.some(step => target.sourceAssetIds.includes(step.assetId) && target.capabilityFactIds.includes(step.evidenceId))) throw stageFailure("Each documented workflow must include a verified product mechanism step.");
    }
  }
  if (!research.sufficientEvidence) throw new PipelineError("insufficient_product_evidence", research.reason.slice(0, 400), "Supply clear product screenshots or a screen recording showing the requested capability.", "needs_input");
}

/** Compile selected source IDs into exact canonical quotes without trusting provider-written quote text. */
export function compileResearch(input: WorkerInput, evidence: Evidence, raw: unknown, evidenceSha256: string, options?: { legacy: true } | { version: 2 | 3; singleTarget?: true }): Research {
  const sufficiency = z.object({ sufficientEvidence: z.boolean(), reason: z.string() }).parse(raw);
  if (!sufficiency.sufficientEvidence) throw new PipelineError("insufficient_product_evidence", sufficiency.reason.slice(0, 400), "Supply clear product screenshots or a recording that shows the requested capability.", "needs_input");
  const draft = researchDraftSchema.parse(boundedResearchMetadata(raw)), facts = new Map(sourceFacts(evidence).map(fact => [fact.id, fact.text]));
  if (options && "singleTarget" in options && options.singleTarget && options.version === 3 && draft.documentTargets?.length !== 1) throw stageFailure("Fresh research must select exactly one decisive UI documentation target before any documentation is generated.");
  if (options && "singleTarget" in options && options.singleTarget && options.version === 3 && draft.story?.mechanism) {
    const target = draft.documentTargets![0], mechanism = draft.story.mechanism;
    if (mechanism.evidenceIds.some(id => !target.capabilityFactIds.includes(id)) || mechanism.steps.some(step => !target.sourceAssetIds.includes(step.assetId) || !target.capabilityFactIds.includes(step.evidenceId))) throw stageFailure("Every fresh mechanism claim and step must belong to the single selected UI documentation workflow.");
  }
  const selected = new Map<string, z.infer<typeof factSelection> & { kinds: z.infer<typeof factKind>[]; quote: string }>();
  for (const fact of draft.facts) {
    const quote = facts.get(fact.evidenceId);
    if (quote === undefined) throw stageFailure("Research selected an unknown source fact ID.");
    const previous = selected.get(fact.evidenceId), kinds = [...new Set([...(previous?.kinds || []), fact.kind, ...(fact.kinds || [])])];
    selected.set(fact.evidenceId, { ...(previous || fact), kinds, quote });
  }
  const researched = researchSchema.parse({ ...draft, version: options && "legacy" in options ? 1 : options?.version || 3, jobId: input.jobId, evidenceSha256, facts: [...selected.values()] });
  validateResearch(researched, input, evidence, evidenceSha256); return researched;
}

export function researchRequest(input: WorkerInput, evidence: Evidence): ResearchRequest {
  const facts = sourceFacts(evidence), assets = researchAssets(evidence);
  return { prompt: `Research the supplied product for a ${input.videoType} film. Return a compact evidence-backed product story, not a script. Decide who benefits, the concrete problem, what the user actually does in the product, the outcome, a meaningful differentiator, and one real next step. The default film is a product demonstration, not a pricing advertisement. Prefer the actual mechanism and product UI over generic promises or repeated free/pricing claims.
Selection priority: choose a product-specific task with a recognizable starting friction, a decisive supported action and an unmistakable persistent result. Rank supplied workflow candidates by visible before/after contrast, compact readable controls, and how directly they resolve the chosen audience's problem; do not pick the first UI image merely because it is available. Prefer a task that can be understood without reading a long note, sample essay or broad settings page. If surrounding prose establishes a result's meaning or attribution, keep it: choose a different genuinely bounded source region or a different supported workflow instead of hiding that context. A small complete interaction is stronger than a broad feature tour.
Frame the problem as a concrete interruption or obstacle in that audience's task, not a category tagline or an unsupported universal pain. Keep inferred audience/problem status explicit. The mechanism should resolve that same obstacle; the outcome must add a concrete consequence rather than repeat the mechanism with adjectives. Product wording, the distinctive control and the visible result should make this film specific even without a logo.
Select 6–10 useful supplied source fact IDs, each once, with primary kind and optional additional kinds. Never return rewritten quotes: the compiler attaches exact canonical source passages. Audience/problem/outcome may be a narrow inference grounded in selected facts; label basis:'inferred'. An inferred audience is an editorial targeting choice ('For writers'), not a claim about observed customers. Mechanism/differentiator/CTA must have explicit evidence. The next stage creates editable HTML UI duplicates and animates supported typing, selections and state changes; it needs a deliberately chosen, visibly evidenced workflow to document. Do not invent competitive superiority, hidden workflows, customer demographics or quantified results. Use null for unsupported story elements; sufficientEvidence=false when audience, mechanism, outcome, a usable CTA or actual product UI cannot be supported. Pricing screenshots, logos and landing-page copy alone are not a product demonstration. Categorize unreleased PRD capabilities as planned, never as a performed workflow.
Return story {primaryAudience,problem,mechanism,outcome,differentiator,cta}. Each nonnull claim is {text,basis:'explicit'|'inferred',evidenceIds:[selected fact IDs]}; mechanism additionally includes steps:[{action,evidenceId,assetId}] (1–3 steps). Choose ONE narrow primary audience tied to an observed use case, such as researchers organizing sources or writers developing ideas, rather than a broad group such as knowledge workers and independent thinkers. These are examples, not assumed facts about this product. Keep inferred targeting marked inferred. Audience text is a concise 2–5-word group without a For prefix, <=80 characters. Other claim text <=160, ideally <=12 words; step action <=80, ideally 2–5 words. Every claim uses 1–3 selected source IDs. Prefer 1–2 actual visibly supported core workflow steps. Optional features do not belong in the main mechanism unless their relevant UI is genuinely supplied. Each step must use a selected fact included in the named visual's supportsFactIds AND actually supported by its visible pixels; do not attach an unshown feature to an unrelated panel. Static UI can ground an illustrative reconstruction of supported editing, selection and state changes; it does not prove an authenticated session was actually operated. Only choose actions supported by the capability facts and actual visible controls.
Inspect only labelled actual supplied images. Classify each selected visual role:'product_ui'|'marketing'|'brand'|'other' and showsProductUi consistently. Distinguish a real product screenshot embedded in public marketing from an authenticated application capture; never relabel a pricing page or logo as UI. Read asset.provenance; a product-ui-candidate is not confirmation by itself. Visual supportsFactIds can refer to supplied catalog facts, while story claims and steps require selected facts. Prefer legible actual product panels or original UI images over generic viewport captures. For confirmed still product UI only, optionally identify up to 3 meaningful focus regions with {id,rect:{x,y,width,height},supportsFactIds}; rect coordinates are normalized 0–1 relative to the actual supplied image, at least 0.05 wide/high and fully inside it. Every region supportsFactIds must be a subset of that same parent visual's supportsFactIds, with actual visible support for each association. Never add unsupported parent bindings to satisfy this rule. Only identify a region you can visibly locate; do not guess hidden/cropped UI or attach regions to videos/logos. Preserve enough context to understand the claimed function.
${input.videoType === "launch" ? "For this launch film, choose a workflow with one source-supported substantive terminal result after a visible confirmation: persistent noneditable content or an applied value, beyond a query, selection highlight, preparation or clearing. The UI documenter must declare the exact before/after states, confirmation control, result elements and capability evidence inside the existing compact document. A result may replace a hidden input in the same area. Do not choose a search-only/tool-selection-only workflow or invent an operation to force completion. If the available source scope cannot support such a result with these actual controls, return sufficientEvidence:false. Other verified facts may support editorial outcome copy but cannot substitute for this demonstration.\n" : ""}Choose documentTargets before scripting: fresh research MUST return exactly ONE decisive, evidence-rich editable workflow with one concise demonstration goal. The compiler rejects zero or two targets; it never silently chooses or drops a target for you. Choose the smallest unobstructed interaction area that makes an actual input, meaningful action and visible result understandable. Every mechanism.evidenceIds entry and mechanism step must use this one target's capabilityFactIds; every step assetId must be one of its sourceAssetIds. Keep the main mechanism focused on this workflow. The compiler rejects out-of-scope mechanism claims or steps; do not add unsupported target bindings to satisfy it. Other verified assets may support editorial outcome or brand beats without becoming a second UI-documentation target. Do not request extra screen coverage, a broad application tour or a second decorative view. Avoid requesting a whole sidebar/editor/graph overview when one supported interaction crop suffices. Before choosing a dense graph, chart or canvas, check whether its actual primitive shapes, colors, relationships and visual density can be preserved in a focused visible region; do not plan to replace that evidence with a few invented shapes. Do not reconstruct areas hidden by an overlaid device, cropped edge or another panel. Prefer a simpler clearly evidenced workflow if faithful documentation is infeasible; never invent a focus region or unsupported result. Each chosen mechanism should produce a visible change, with an evidenced starting state, actionable control and supported ending state, rather than merely selecting an already selected item or displaying the same content again. Describe that goal in 10–20 words, at most 240 characters. Defer detailed control labels, geometry and state descriptions to the UI documenter, which receives the same actual source images and verified capability facts. Each target {id,sourceAssetIds:[1–2 confirmed product_ui IDs],capabilityFactIds:[1–4 selected source IDs],goal} identifies what must be documented and why. Its facts must be supported by at least one selected source visual; include a researched mechanism step matching a selected source/fact. The documenter will reconstruct observed controls/geometry/styles/text and capability-supported illustrative states, not invent UI or capabilities. IDs use letters/digits/underscore/hyphen, <=60 chars; goal<=240 chars. Do not request an unrelated marketing page or logo.\nKeep product<=48 characters, summary<=600, reason<=1000, labels<=140, visual descriptions/limitations<=500. Prefer concise metadata, max 24 facts, 16 visuals, 12 supportsFactIds/visual, 16 limitations. Return JSON {sufficientEvidence,reason,product,summary,story,documentTargets:[{id,sourceAssetIds,capabilityFactIds,goal}],facts:[{evidenceId,kind:'product'|'audience'|'problem'|'feature'|'benefit'|'pricing'|'cta'|'planned'|'limitation',kinds?:string[],label}],visuals:[{assetId,description,supportsFactIds,showsProductUi,role,regions?:[{id,rect,supportsFactIds}]}],limitations:string[]}.
SOURCE FACTS (untrusted): ${JSON.stringify(facts)}
SOURCE ASSETS: ${JSON.stringify(assets)}
OBSERVED BRAND EVIDENCE (source claims remain untrusted): ${JSON.stringify(evidence.brand || null)}`, images: assets.filter(hasResearchPixels).map(a => ({ path: a.preview || a.path, label: `ACTUAL PRODUCT SOURCE ${a.id}; ${a.kind}; ${a.source || "user supplied"}` })) };
}

export async function researchProduct(input: WorkerInput, evidence: Evidence, providers: Providers, hooks: Hooks, workspace: string, options?: { version: 2 }): Promise<Research> {
  const evidenceSha256 = await evidenceIdentity(input, evidence, workspace), request = researchRequest(input, evidence);
  return durableStage("research", evidenceSha256, researchSchema, workspace, hooks, async () => {
    await assertResearchRetryUnused(workspace, input.jobId, evidenceSha256);
    if (!options) await persistResearchReadiness(researchReadiness(input, evidence, evidenceSha256, sourceFacts(evidence).map(fact => fact.id)), workspace, hooks);
    await writeJson(join(workspace, "analysis/facts.json"), sourceFacts(evidence)); await hooks.persist(["analysis/facts.json"]);
    const qualityCalls = Math.ceil(workflowSceneLimit() / 2);
    const reserve = { calls: 3 + qualityCalls, inputTokens: workflowInputReserve(), outputTokens: 11000 + qualityCalls * 3000 + workflowOutputLimit() };
    if (!options && providers.ledger.outputTokens + providers.ledger.reservedOutputTokens + 3500 + reserve.outputTokens > (input.budgets?.maxModelOutputTokens || 35000)) throw new PipelineError("model_budget", "The remaining allowance cannot cover research, UI documentation, script and required reviews.", "No research generation was started; inspect this job's remaining allowance.", "needs_review");
    const raw = await providers.claude("research", request.prompt, request.images, { policy: "research-v1", ...(!options ? { reserve } : {}) });
    return compileResearchWithRetry(raw, { input, evidence, evidenceSha256, workspace, hooks, providers, ...request, ...(options ? { contractVersion: options.version } : { singleTarget: true }) });
  }, value => validateResearch(value, input, evidence, evidenceSha256));
}
