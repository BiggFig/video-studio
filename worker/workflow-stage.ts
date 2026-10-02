import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { stageDigest, stageFailure } from "./research";
import type { Script } from "./scripting";
import type { UiDocumentBundle } from "./ui-reconstruction";
import type { ModelReserve, Providers } from "./providers";
import { PipelineError, type Hooks, type Plan, type WorkerInput } from "./types";
import { buildPlanWorkflowContext, buildWorkflowContext, planWorkflowProjection, prepareWorkflowCoherence, validateWorkflowVerdict, workflowInputReserve, workflowOutputLimit, workflowSceneLimit, workflowProjection, workflowVerdictSchema, type WorkflowVerdict } from "./workflow-coherence";
import { assertLaunchWorkflowDepth, assertLaunchOutcomeContinuity, launchResultReadingFrames } from "./workflow-depth";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const workflowBindingSchema = z.object({ version: z.union([z.literal(1), z.literal(2)]), contextSha256: hash, verdictSha256: hash, scriptSha256: hash, requireLaunchResult: z.literal(true).optional(), requireOutcomeContinuity: z.literal(true).optional() }).strict();
export type WorkflowBinding = z.infer<typeof workflowBindingSchema>;
const markerSchema = z.object({ version: z.literal(1), jobId: z.string(), contextSha256: hash, scriptSha256: hash, evidenceSha256: hash, researchSha256: hash, uiSha256: hash, requireLaunchResult: z.literal(true).optional(), requireOutcomeContinuity: z.literal(true).optional(), status: z.enum(["reserved", "completed"]), outcome: z.enum(["passed", "failed"]).optional(), verdictSha256: hash.optional() }).strict().superRefine((value, context) => {
  if (value.status === "completed" ? !value.outcome || !value.verdictSha256 : !!value.outcome || !!value.verdictSha256) context.addIssue({ code: "custom", message: "Incomplete workflow review marker" });
});
const paths = (contextSha256: string) => ({ marker: `analysis/workflow-coherence-${contextSha256}-state.json`, artifact: `analysis/workflow-coherence-${contextSha256}.json` });
export const workflowArtifactPaths = (binding: WorkflowBinding) => Object.values(paths(workflowBindingSchema.parse(binding).contextSha256));
const missing = (error: unknown) => error instanceof Error && "code" in error && error.code === "ENOENT";
export const workflowReserve = (reserve: ModelReserve, version: 1 | 2 = 2): ModelReserve => ({ ...reserve, calls: reserve.calls + 1, inputTokens: reserve.inputTokens + workflowInputReserve(version), outputTokens: reserve.outputTokens + workflowOutputLimit(version) });
const assertWorkflowScenes = (script: Pick<Script, "scenes">, version: 1 | 2) => {
  if (version === 2 && script.scenes.length > workflowSceneLimit(version)) throw stageFailure("The v2 workflow exceeds its six-scene, three-quality-review allowance.");
};

/** Initial generation cannot precede an orphaned or ambiguous prior review. */
export async function assertWorkflowUnstarted(workspace: string) {
  let files: string[];
  try { files = await readdir(join(workspace, "analysis")); } catch (error) { if (missing(error)) return; throw stageFailure("The retained workflow review state cannot be read."); }
  if (files.some(file => /^workflow-coherence-.*(?:-state)?\.json$/.test(file))) throw stageFailure("A prior workflow review already exists without a completed script stage.");
}

export class WorkflowCoherenceRejected extends PipelineError {
  constructor(public readonly verdict: WorkflowVerdict) {
    super("workflow_incoherent", "The proposed UI actions or outcome copy do not form a source-supported workflow.", "Inspect the retained workflow findings. Change only the script if the existing documented states support an honest demonstration; otherwise supply clearer source evidence.", "needs_review");
  }
}

/** Exact request preflight precedes an exclusive durable claim; no semantic-review retry. */
export async function gateWorkflowScript(script: Script, options: { input: WorkerInput; workspace: string; hooks: Pick<Hooks, "persist">; providers: Pick<Providers, "prepareClaude" | "ledger">; ui: UiDocumentBundle; reserve: ModelReserve; version?: 1 | 2; requireLaunchResult?: boolean; requireOutcomeContinuity?: boolean }): Promise<Script> {
  if (script.workflowCoherence) throw stageFailure("A generated script cannot supply its own workflow approval.");
  assertWorkflowScenes(script, options.version || 2);
  const requireLaunchResult = options.requireLaunchResult ?? ((options.version || 2) === 2 && options.input.videoType === "launch");
  const launchDepth = requireLaunchResult ? assertLaunchWorkflowDepth(script, options.ui) : undefined;
  const requireOutcomeContinuity = options.requireOutcomeContinuity ?? requireLaunchResult;
  if (requireOutcomeContinuity && !requireLaunchResult) throw stageFailure("Outcome continuity requires its launch-result contract.");
  const outcomeContinuity = requireOutcomeContinuity ? assertLaunchOutcomeContinuity(script, options.ui) : undefined;
  const depthBinding = { ...(requireLaunchResult ? { requireLaunchResult: true as const } : {}), ...(requireOutcomeContinuity ? { requireOutcomeContinuity: true as const } : {}) };
  const context = buildWorkflowContext(script, options.ui, options.version || 2), names = paths(context.sha256);
  for (const path of Object.values(names)) {
    try { await readFile(join(options.workspace, path)); throw stageFailure("This exact workflow review is already consumed or its completion is unconfirmed."); } catch (error) { if (!missing(error)) throw error; }
  }
  const ledger = options.providers.ledger, reserve = options.reserve;
  if (ledger.modelCalls + 1 + reserve.calls > Math.min(options.input.budgets?.maxModelCalls || 10, 12) || ledger.outputTokens + ledger.reservedOutputTokens + workflowOutputLimit(context.version) + reserve.outputTokens > (options.input.budgets?.maxModelOutputTokens || 35000)) throw new PipelineError("model_budget", "The remaining allowance cannot cover the complete workflow review and its required quality reviews.", "Inspect the retained script. No workflow model call was started.", "needs_review");
  const perform = await prepareWorkflowCoherence(context, options.providers, reserve);
  const marker = markerSchema.parse({ version: 1, jobId: script.jobId, ...context.bindings, ...depthBinding, contextSha256: context.sha256, status: "reserved" });
  try { await writeFile(join(options.workspace, names.marker), JSON.stringify(marker, null, 2) + "\n", { flag: "wx" }); } catch { throw stageFailure("The workflow review could not be reserved exactly once."); }
  await options.hooks.persist([names.marker]);
  const verdict = await perform();
  validateWorkflowVerdict(verdict, context);
  const verdictSha256 = stageDigest(verdict);
  await writeFile(join(options.workspace, names.artifact), JSON.stringify({ version: 1, script, context, verdict, ...depthBinding, ...(launchDepth ? { launchDepth } : {}), ...(outcomeContinuity ? { outcomeContinuity } : {}) }, null, 2) + "\n", { flag: "wx" });
  await options.hooks.persist([names.artifact]);
  await writeFile(join(options.workspace, names.marker), JSON.stringify({ ...marker, status: "completed", outcome: verdict.passed ? "passed" : "failed", verdictSha256 }, null, 2) + "\n");
  await options.hooks.persist([names.marker]);
  if (verdict.version === 2 && (verdict.assessments.some(assessment => assessment.status === "uncertain") || verdict.tasks?.some(task => task.resultAnswer === "uncertain"))) throw new PipelineError("workflow_coherence_uncertain", "The workflow reviewer could not establish every required semantic result.", "Inspect the retained obligation assessments and supply clearer evidence. An uncertain review cannot trigger a paid script correction.", "needs_review");
  if (!verdict.passed) throw new WorkflowCoherenceRejected(verdict);
  return { ...script, workflowCoherence: { version: context.version, contextSha256: context.sha256, scriptSha256: context.bindings.scriptSha256, verdictSha256, ...depthBinding } };
}

/** Pure binding check also used by script compilation and repair validation. */
export function assertScriptWorkflowBinding(script: Script, ui?: UiDocumentBundle): void {
  if (!script.workflowCoherence) return;
  assertWorkflowScenes(script, script.workflowCoherence.version);
  const binding = workflowBindingSchema.parse(script.workflowCoherence), context = buildWorkflowContext(script, ui, binding.version);
  if (binding.requireLaunchResult) assertLaunchWorkflowDepth(script, ui);
  if (binding.requireOutcomeContinuity) { if (!binding.requireLaunchResult) throw stageFailure("Outcome continuity lost its launch-result requirement."); assertLaunchOutcomeContinuity(script, ui); }
  if (binding.contextSha256 !== context.sha256 || binding.scriptSha256 !== context.bindings.scriptSha256) throw stageFailure("The script changed after its workflow coherence review.");
}

/** Read-only validation of an immutable, passed review and its exact reviewed script. */
export async function loadWorkflowScript(binding: WorkflowBinding, workspace: string): Promise<Script> {
  const verified = workflowBindingSchema.parse(binding), names = paths(verified.contextSha256);
  let saved: { script: Script; context: unknown; verdict: unknown; requireLaunchResult?: true; launchDepth?: unknown; requireOutcomeContinuity?: true; outcomeContinuity?: unknown }, marker: z.infer<typeof markerSchema>;
  try {
    saved = JSON.parse(await readFile(join(workspace, names.artifact), "utf8"));
    marker = markerSchema.parse(JSON.parse(await readFile(join(workspace, names.marker), "utf8")));
  } catch { throw stageFailure("The saved workflow verdict or its completion marker cannot be verified."); }
  const script = { ...saved.script, workflowCoherence: verified }, context = buildWorkflowContext(script, undefined, verified.version);
  assertWorkflowScenes(script, verified.version);
  const verdict = workflowVerdictSchema.parse(saved.verdict);
  if (saved.requireLaunchResult !== verified.requireLaunchResult || marker.requireLaunchResult !== verified.requireLaunchResult || (verified.requireLaunchResult && (saved.launchDepth === undefined || stageDigest(saved.launchDepth) !== stageDigest(assertLaunchWorkflowDepth(script))))) throw stageFailure("The saved workflow approval changed its launch-result requirement or demonstrated result.");
  if (saved.requireOutcomeContinuity !== verified.requireOutcomeContinuity || marker.requireOutcomeContinuity !== verified.requireOutcomeContinuity || (verified.requireOutcomeContinuity && (saved.outcomeContinuity === undefined || stageDigest(saved.outcomeContinuity) !== stageDigest(assertLaunchOutcomeContinuity(script))))) throw stageFailure("The saved workflow approval changed its outcome continuity requirement.");
  validateWorkflowVerdict(verdict, context);
  if (stageDigest(saved.context) !== stageDigest(context) || !verdict.passed || stageDigest(verdict) !== verified.verdictSha256 || marker.status !== "completed" || marker.outcome !== "passed" || marker.verdictSha256 !== verified.verdictSha256 || marker.contextSha256 !== context.sha256 || marker.scriptSha256 !== context.bindings.scriptSha256 || marker.jobId !== script.jobId || marker.evidenceSha256 !== script.evidenceSha256 || marker.researchSha256 !== script.researchSha256 || marker.uiSha256 !== script.uiSha256) throw stageFailure("The saved workflow review is incomplete, failed or belongs to different script evidence.");
  assertScriptWorkflowBinding(script);
  return script;
}

export async function verifyScriptWorkflowBinding(script: Script, workspace: string, ui?: UiDocumentBundle): Promise<void> {
  if (!script.workflowCoherence) return;
  assertScriptWorkflowBinding(script, ui);
  const saved = await loadWorkflowScript(script.workflowCoherence, workspace);
  if (stageDigest(saved) !== stageDigest(script)) throw stageFailure("The completed workflow verdict does not approve this exact script.");
}

/** Compiler-neutral content must match the passed original or repaired script exactly. */
export async function validatePlanWorkflowCoherence(plan: Plan, workspace: string): Promise<void> {
  const binding = plan.production?.workflowCoherence;
  if (!binding) return;
  const saved = await loadWorkflowScript(binding, workspace), context = buildPlanWorkflowContext(plan, binding.scriptSha256, binding.version);
  if (plan.job_id !== saved.jobId || plan.production!.scriptSha256 !== stageDigest(saved) || stageDigest(workflowProjection(saved)) !== stageDigest(planWorkflowProjection(plan)) || context.sha256 !== binding.contextSha256 || context.bindings.scriptSha256 !== binding.scriptSha256) throw stageFailure("The compiled plan changed its reviewed script, actions or UI context.");
  if (binding.requireLaunchResult) {
    // Defer this import: scripting's schemas depend on this stage and the UI schema.
    const { scriptVisibleText, visibleWordCount } = await import("./scripting");
    for (const [index, scene] of plan.scenes.entries()) {
      const visual = scene.presentation?.visual;
      if (visual?.kind !== "ui-demo") continue;
      const document = saved.uiDocuments?.find(document => document.id === visual.documentId);
      if (!document) throw stageFailure("The launch-result plan lost its reviewed UI document.");
      const words = scriptVisibleText(saved.product, saved.scenes[index], index === 0 ? saved.audienceLabel : undefined).reduce((sum, text) => sum + visibleWordCount(text), 0);
      const minimum = launchResultReadingFrames(document, scene, words, index === plan.scenes.length - 1, visibleWordCount);
      if (!Number.isSafeInteger(scene.duration_frames) || scene.duration_frames < minimum) throw stageFailure("The restored launch-result scene is shorter than its complete reading hold after camera settlement.");
    }
  }
}
