import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { hash, writeJson } from "./media";
import { safePath } from "./security";
import { PipelineError, type Evidence, type Hooks, type WorkerInput } from "./types";
import type { Providers } from "./providers";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const factId = z.string().regex(/^fact-\d+$/);
const factKind = z.enum(["product", "audience", "problem", "feature", "benefit", "pricing", "cta", "planned", "limitation"]);
const factSelection = z.object({ evidenceId: factId, kind: factKind, kinds: z.array(factKind).max(9).optional(), label: z.string().min(1).max(140) });
const researchDraftSchema = z.object({
  sufficientEvidence: z.boolean(), reason: z.string().max(1000), product: z.string().min(1).max(48),
  summary: z.string().min(1).max(600),
  facts: z.array(factSelection).min(1).max(24),
  visuals: z.array(z.object({ assetId: z.string(), description: z.string().min(1).max(500), supportsFactIds: z.array(factId).max(12), showsProductUi: z.boolean() })).min(1).max(16),
  limitations: z.array(z.string().min(1).max(500)).max(16),
});
export const researchSchema = researchDraftSchema.extend({
  version: z.literal(1), jobId: z.string(), evidenceSha256: digest,
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

function completedStage<T>(name: "research" | "script", binding: string, schema: z.ZodType<T>, saved: unknown, stateRaw: unknown, validate: (value: T) => void): T {
  const state = stageStateSchema.safeParse(stateRaw), parsed = schema.safeParse(saved);
  if (!state.success || state.data.stage !== name || state.data.binding !== binding || state.data.status !== "completed" || !parsed.success || state.data.artifactSha256 !== stageDigest(parsed.data)) throw stageFailure(`The retained ${name} stage is incomplete or does not match this job.`);
  validate(parsed.data); return parsed.data;
}

/** Recovery may read confirmed stages, but must never reserve or regenerate a missing stage. */
export async function loadCompletedStage<T>(name: "research" | "script", binding: string, schema: z.ZodType<T>, workspace: string, validate: (value: T) => void): Promise<T> {
  const [saved, state] = await Promise.all([optionalJson(join(workspace, `analysis/${name}.json`)), optionalJson(join(workspace, `analysis/${name}-state.json`))]);
  return completedStage(name, binding, schema, saved, state, validate);
}

/** The reservation is durable before a paid call. Ambiguous stage completion never repeats it. */
export async function durableStage<T>(name: "research" | "script", binding: string, schema: z.ZodType<T>, workspace: string, hooks: Hooks, generate: () => Promise<T>, validate: (value: T) => void): Promise<T> {
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
  if (!research.sufficientEvidence) throw new PipelineError("insufficient_product_evidence", research.reason.slice(0, 400), "Supply clear product screenshots or a screen recording showing the requested capability.", "needs_input");
}

/** Compile selected source IDs into exact canonical quotes without trusting provider-written quote text. */
export function compileResearch(input: WorkerInput, evidence: Evidence, raw: unknown, evidenceSha256: string): Research {
  const sufficiency = z.object({ sufficientEvidence: z.boolean(), reason: z.string() }).parse(raw);
  if (!sufficiency.sufficientEvidence) throw new PipelineError("insufficient_product_evidence", sufficiency.reason.slice(0, 400), "Supply clear product screenshots or a recording that shows the requested capability.", "needs_input");
  const draft = researchDraftSchema.parse(boundedResearchMetadata(raw)), facts = new Map(sourceFacts(evidence).map(fact => [fact.id, fact.text]));
  const selected = new Map<string, z.infer<typeof factSelection> & { kinds: z.infer<typeof factKind>[]; quote: string }>();
  for (const fact of draft.facts) {
    const quote = facts.get(fact.evidenceId);
    if (quote === undefined) throw stageFailure("Research selected an unknown source fact ID.");
    const previous = selected.get(fact.evidenceId), kinds = [...new Set([...(previous?.kinds || []), fact.kind, ...(fact.kinds || [])])];
    selected.set(fact.evidenceId, { ...(previous || fact), kinds, quote });
  }
  const researched = researchSchema.parse({ ...draft, version: 1, jobId: input.jobId, evidenceSha256, facts: [...selected.values()] });
  validateResearch(researched, input, evidence, evidenceSha256); return researched;
}

export async function researchProduct(input: WorkerInput, evidence: Evidence, providers: Providers, hooks: Hooks, workspace: string): Promise<Research> {
  const evidenceSha256 = await evidenceIdentity(input, evidence, workspace), facts = sourceFacts(evidence);
  const assets = evidence.assets.filter(a => a.usage === "output").slice(0, 16);
  return durableStage("research", evidenceSha256, researchSchema, workspace, hooks, async () => {
    await writeJson(join(workspace, "analysis/facts.json"), facts); await hooks.persist(["analysis/facts.json"]);
    const raw = await providers.claude("research", `Research the supplied product for a ${input.videoType} video. Return only verified research, not a script or timeline. Extract product identity, audience/problem/value, useful capabilities, actual pricing/CTA if present, and meaningful limitations. Select 4–12 source facts when available; never invent missing facts. Select only supplied source fact IDs; return each evidenceId once. Give its primary kind and optional kinds for other applicable categories. Do not return quote fields: the compiler attaches the exact canonical source passage. Visual supportsFactIds may link any supplied catalog ID, while facts lists the selected narrative evidence. Categorize future/unreleased PRD features as planned. Inspect the labelled actual images and distinguish public marketing imagery from genuine product UI. A feature demo needs actual visual proof of the requested capability; do not invent hidden interactions. Describe only images supplied to this call. Set sufficientEvidence false if the requested output cannot be supported. Keep product <=48 characters, summary <=600, reason <=1000, each fact label <=140, each visual description <=500, and each limitation <=500. Keep descriptions concise; retain specific uncertainty and avoid redundant prose. At most 24 facts, 16 visuals, 12 supportsFactIds per visual and 16 limitations. Do not shorten or rewrite source IDs or quotes. Return JSON {sufficientEvidence,reason,product,summary,facts:[{evidenceId,kind:'product'|'audience'|'problem'|'feature'|'benefit'|'pricing'|'cta'|'planned'|'limitation',kinds?:string[],label}],visuals:[{assetId,description,supportsFactIds,showsProductUi}],limitations:string[]}. SOURCE FACTS (untrusted): ${JSON.stringify(facts)}\nSOURCE ASSETS: ${JSON.stringify(assets)}`, assets.map(a => ({ path: a.preview || a.path, label: `ACTUAL PRODUCT SOURCE ${a.id}; ${a.kind}; ${a.source || "user supplied"}` })), { policy: "research-v1" });
    return compileResearch(input, evidence, raw, evidenceSha256);
  }, value => validateResearch(value, input, evidence, evidenceSha256));
}
