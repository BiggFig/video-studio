import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { writeJson } from "./media";
import { stageDigest, stageFailure } from "./research";
import { expectedUiState } from "./ui-state";
import { validateUiActions, type UiDocument } from "./ui-reconstruction";
import type { UiCameraTrack } from "./ui-camera";
import { compileUiCausalEmphasis, type UiCausalEmphasisTrack } from "./ui-causal-emphasis";
import type { Evidence, Hooks, Plan, Scene } from "./types";

export const SHOT_DIRECTOR_PATH = "analysis/shot-director.json";
type Window = { startFrame: number; endFrame: number };
export interface ShotSceneDirection {
  version: 1;
  subjectIds: string[];
  copyRole: "headline" | "support" | "quiet";
  camera: UiCameraTrack;
  actionWindow: Window | null;
  resultHold: Window | null;
  causalEmphasis?: UiCausalEmphasisTrack;
  layers: { copy: Window & { enterFrames: number }; cursor: Window & { enterFrames: number }; product: Window & { enterFrames: number }; material: Window & { enterFrames: number } };
  exit: { kind: "cut" | "object-match"; documentId?: string; subjectIds?: string[]; nextSceneId?: string; stateSha256?: string };
}
export interface ShotDirectorMetadata {
  version: 1;
  /** Absent on retained directors: their original isolated input/result framing stays unchanged. */
  literalContextVersion?: 1;
  /** Absent on retained directors: no new editorial ink is added on restore. */
  literalEmphasisVersion?: 1;
  source: { researchSha256: string; evidenceSha256: string; scriptSha256: string; uiSha256: string };
  output: Plan["output"];
  brief: {
    audienceMoment: { text: string; evidenceIds: string[] };
    visualArgument: { action: string; result: string; evidenceIds: string[] };
    recurringSubjects: string[];
    contrast: ("scale" | "density" | "motion-rest")[];
  };
  visualSystem: {
    family: "editorial" | "workbench" | "relationships";
    material: "paper" | "ink" | "glass";
    depth: "flat" | "layered";
    corners: "square" | "rounded";
    palette: { background: string; foreground: string; accent: string };
    paletteSource: string | null;
    typography: { family: string; weight: string; role: string; selector: string }[];
  };
  media: { assetId: string; kind: string; source: string | null; rights: string; role: "product-ui" | "brand-logo" | "source-media" }[];
  unavailableTreatments: string[];
}

const unique = <T>(values: T[]) => [...new Set(values)];
const endOf = (scene: Scene) => scene.presentation?.visual?.kind === "ui-demo" ? Math.max(...scene.presentation.visual.actions.map(action => action.atFrame + action.durationFrames)) : 0;

/** New plans reserve an actual result move plus a quiet 1.5s hold. Old plans never call this. */
export const requiredDirectorFrames = (presentation: Scene["presentation"], finalScene = false) => presentation?.visual?.kind === "ui-demo" ? Math.max(...presentation.visual.actions.map(action => action.atFrame + action.durationFrames)) + 57 + (!finalScene && presentation.transition !== "cut" ? 12 : 0) : 0;

function sceneDirection(scene: Scene, document?: UiDocument, finalScene = false, literalContextVersion = 0, literalEmphasisVersion = 0): ShotSceneDirection {
  const duration = scene.duration_frames, visual = scene.presentation?.visual;
  const base: ShotSceneDirection = {
    version: 1, subjectIds: [`asset:${scene.asset_id}`], copyRole: scene.direction?.job === "action" ? "support" : "headline",
    camera: { shots: [] }, actionWindow: null, resultHold: null,
    layers: { copy: { startFrame: 0, endFrame: duration, enterFrames: 9 }, cursor: { startFrame: 0, endFrame: 0, enterFrames: 0 }, product: { startFrame: 8, endFrame: duration, enterFrames: 12 }, material: { startFrame: 0, endFrame: duration, enterFrames: 18 } },
    exit: { kind: "cut" },
  };
  if (visual?.kind !== "ui-demo") return base;
  if (!document || !document.sourceAssetIds.includes(scene.asset_id) || !document.capabilityFactIds.includes(scene.evidence_id || "")) throw stageFailure("The shot director requires the exact source-bound UI document and scene capability.");
  validateUiActions(document, visual.actions);
  const last = endOf(scene);
  const exitFrames = !finalScene && scene.presentation!.transition !== "cut" ? Math.min(12, Math.floor(duration / 5)) : 0;
  if (last + 57 > duration - exitFrames) throw stageFailure("The directed UI result requires a complete camera move and at least 45 readable frames after actions finish and before the outgoing transition.");
  const preview = literalContextVersion === 1 && document.terminalResult?.version === 2 ? document.previewBinding : undefined;
  const causalIds = preview ? unique([preview.codeElementId, preview.templateElementId, preview.resultElementId, ...preview.contextElementIds]) : [];
  // The literal compiler limits text to this exact witnessed relation. Keep its
  // containing structural panels too, so no partial pane edge appears to be a
  // different layout. No unrelated source screenshot/chrome becomes a subject.
  const structuralIds = preview ? document.elements.filter(element => element.type === "panel" && !element.text && causalIds.some(id => {
    const child = document.elements.find(value => value.id === id)!;
    return child && element.rect.x <= child.rect.x && element.rect.y <= child.rect.y && element.rect.x + element.rect.width >= child.rect.x + child.rect.width && element.rect.y + element.rect.height >= child.rect.y + child.rect.height;
  })).map(element => element.id) : [];
  const contextAt = (frame: number, targets: string[]) => {
    const state = expectedUiState(document, visual.actions, frame);
    return unique([...causalIds, ...structuralIds]).filter(id => state.elements[id]?.visible && !targets.includes(id));
  };
  const shots: UiCameraTrack["shots"] = [{ atFrame: 0, moveFrames: 0, job: "establish", targetIds: [] }];
  const targeted = visual.actions.filter(action => action.targetId);
  for (const [index, action] of targeted.entries()) {
    const job = action.kind === "type" ? "input" : action.kind === "click" || action.kind === "select" ? "commit" : "context";
    // A pointer may precede the click: approach its destination before travel,
    // without adding/reordering any product operations or exposing future state.
    const actionIndex = visual.actions.indexOf(action), priorAction = visual.actions[actionIndex - 1];
    const atFrame = Math.max(0, action.atFrame - 12, priorAction ? priorAction.atFrame + priorAction.durationFrames : 0);
    shots.push({ atFrame, moveFrames: Math.max(0, Math.min(12, action.atFrame - atFrame)), job, targetIds: [action.targetId!], contextIds: contextAt(atFrame, [action.targetId!]) });
    const next = targeted[index + 1];
    if (action.kind === "type" && next && next.atFrame - (action.atFrame + action.durationFrames) >= 36 && !visual.actions.some(between => between.kind === "state" && between.atFrame >= action.atFrame + action.durationFrames && between.atFrame < next.atFrame)) {
      const after = action.atFrame + action.durationFrames;
      const state = expectedUiState(document, visual.actions, after);
      shots.push({ atFrame: after, moveFrames: 12, job: "context", targetIds: [action.targetId!], contextIds: unique([...(state.elements[next.targetId!]?.visible ? [next.targetId!] : []), ...contextAt(after, [action.targetId!])]) });
    }
  }
  for (const action of visual.actions.filter(action => action.kind === "state")) {
    const atFrame = action.atFrame + action.durationFrames, state = expectedUiState(document, visual.actions, atFrame);
    const snapshot = document.states.find(candidate => candidate.id === action.stateId)!;
    const changedIds = snapshot.textValues.map(value => value.elementId).filter(id => state.elements[id]?.visible);
    const targetIds = changedIds.length ? changedIds : document.elements.filter(element => state.elements[element.id].visible).map(element => element.id);
    if (targetIds.length) shots.push({ atFrame, moveFrames: 12, job: "context", targetIds, contextIds: contextAt(atFrame, targetIds) });
  }
  const final = expectedUiState(document, visual.actions, last);
  const declaredResult = document.terminalResult && final.stateId === document.terminalResult.afterStateId ? document.terminalResult.resultElementIds : [];
  const lastState = [...visual.actions].reverse().find(action => action.kind === "state");
  const changed = lastState ? document.states.find(state => state.id === lastState.stateId)?.textValues.map(value => value.elementId) || [] : [];
  // Clicking an unchanged control (for example Publish) is not the result.
  // Without an explicit result declaration/value, show the intact final UI.
  const identified = unique((declaredResult.length ? declaredResult : changed).filter(id => final.elements[id]?.visible));
  const resultIds = identified.length ? identified : document.elements.filter(element => final.elements[element.id].visible).map(element => element.id);
  if (!resultIds.length) throw stageFailure("The directed result contains no visible source-bound object.");
  const contextIds = contextAt(last, resultIds);
  const beforeResult = expectedUiState(document, visual.actions, Math.max(0, last - 1));
  const previousShot = [...shots].filter(shot => shot.atFrame < last).sort((a, b) => a.atFrame - b.atFrame).at(-1);
  const previousSubjects = previousShot ? [...previousShot.targetIds, ...(previousShot.contextIds || [])] : [];
  // A replacement screen has no object to follow. Cut only when all result
  // subjects become visible now and the previous focus disappears; traveling
  // from the old control would expose an empty crop of the new state.
  const replacesSubject = resultIds.every(id => !beforeResult.elements[id]?.visible) && previousSubjects.length > 0 && previousSubjects.every(id => !final.elements[id]?.visible);
  // A whole source screen is an honest fallback when no visible semantic result
  // can be isolated. It must not become a fabricated success badge.
  shots.push({ atFrame: last, moveFrames: replacesSubject ? 0 : 12, job: "result", targetIds: resultIds, contextIds });
  // A state end may equal the next operation's start or the final result.
  // One shot owns each frame; prefer the next active control, then the result.
  const ordered = shots.sort((a, b) => a.atFrame - b.atFrame || ({ establish: 0, context: 1, input: 2, commit: 3, result: 4 }[a.job] - { establish: 0, context: 1, input: 2, commit: 3, result: 4 }[b.job]));
  base.camera = { shots: ordered.filter((shot, index) => ordered[index + 1]?.atFrame !== shot.atFrame) };
  base.subjectIds = unique([...targeted.map(action => action.targetId!), ...resultIds, ...contextIds]);
  base.actionWindow = { startFrame: visual.actions[0].atFrame, endFrame: last };
  base.resultHold = { startFrame: last + 12, endFrame: duration - exitFrames };
  if (literalContextVersion === 1 && literalEmphasisVersion === 1) {
    const emphasis = compileUiCausalEmphasis(document, visual.actions, base.resultHold);
    if (emphasis) base.causalEmphasis = emphasis;
  }
  base.layers.cursor = { startFrame: targeted[0]?.atFrame ?? 0, endFrame: last, enterFrames: 0 };
  base.layers.product = { startFrame: 0, endFrame: duration, enterFrames: 12 };
  base.copyRole = "quiet";
  return base;
}

function visibleObject(document: UiDocument, scene: Scene, frame: number, ids: string[]) {
  const visual = scene.presentation!.visual!;
  if (visual.kind !== "ui-demo") throw stageFailure("A shared object requires an editable document.");
  const state = expectedUiState(document, visual.actions, frame);
  return ids.map(id => ({ id, ...state.elements[id] })).map(({ typing: _typing, ...object }) => object);
}

/** Deterministic direction, compiled only after script/source/workflow validation. No model call or code generation. */
export interface ShotDirectorOptions { literalContextVersion: 0 | 1; literalEmphasisVersion?: 0 | 1 }
export function buildDirectorPlan(plan: Plan, evidence?: Evidence, options?: ShotDirectorOptions): { metadata: ShotDirectorMetadata; scenes: ShotSceneDirection[] } {
  const binding = plan.production, story = plan.story;
  const literalContextVersion = options?.literalContextVersion ?? (plan.shotDirector ? plan.shotDirector.literalContextVersion ?? 0 : 1);
  const literalEmphasisVersion = options ? options.literalEmphasisVersion ?? 0 : plan.shotDirector ? plan.shotDirector.literalEmphasisVersion ?? 0 : 1;
  if (literalContextVersion !== 0 && literalContextVersion !== 1) throw stageFailure("The saved result framing version is unsupported.");
  if (literalEmphasisVersion !== 0 && literalEmphasisVersion !== 1) throw stageFailure("The saved editorial emphasis version is unsupported.");
  if (!binding?.uiSha256 || !plan.creativeDirection || !story?.primaryAudience || !story.mechanism || !story.outcome) throw stageFailure("The shot director requires a verified current script, audience, action, result and immutable UI binding.");
  if (binding.uiSha256 !== stageDigest({ version: 1, jobId: plan.job_id, evidenceSha256: binding.evidenceSha256, researchSha256: binding.researchSha256, documents: plan.uiDocuments })) throw stageFailure("The shot director UI no longer matches its immutable source binding.");
  const scenes = plan.scenes.map((scene, index) => { const visual = scene.presentation?.visual; return sceneDirection(scene, visual?.kind === "ui-demo" ? plan.uiDocuments?.find(document => document.id === visual.documentId) : undefined, index === plan.scenes.length - 1, literalContextVersion, literalEmphasisVersion); });
  for (let index = 0; index < scenes.length - 1; index++) {
    const current = plan.scenes[index], next = plan.scenes[index + 1], from = current.presentation?.visual, to = next.presentation?.visual;
    if (from?.kind !== "ui-demo" || to?.kind !== "ui-demo" || from.documentId !== to.documentId) continue;
    const document = plan.uiDocuments!.find(document => document.id === from.documentId)!;
    const ids = scenes[index].subjectIds.filter(id => scenes[index + 1].subjectIds.includes(id));
    const shared = ids.filter(id => {
      const a = visibleObject(document, current, current.duration_frames - 1, [id]), b = visibleObject(document, next, 0, [id]);
      return a[0].visible && b[0].visible && stageDigest(a) === stageDigest(b);
    });
    // Require the complete semantic subject, not a coincidentally unchanged
    // button that would conceal a reset of the typed input/result beside it.
    const visibleIds = document.elements.map(element => element.id);
    const completeStateMatches = stageDigest(visibleObject(document, current, current.duration_frames - 1, visibleIds)) === stageDigest(visibleObject(document, next, 0, visibleIds));
    if (completeStateMatches && shared.length && shared.length === ids.length && ids.length === scenes[index].subjectIds.length) {
      scenes[index].exit = { kind: "object-match", documentId: document.id, subjectIds: shared, nextSceneId: next.id, stateSha256: stageDigest(visibleObject(document, current, current.duration_frames - 1, shared)) };
      if (scenes[index].resultHold) scenes[index].resultHold!.endFrame = current.duration_frames;
    }
  }
  const brand = plan.brand, concept = plan.creativeDirection.concept;
  const family = concept === "connect" ? "relationships" : plan.scenes.some(scene => scene.presentation?.visual?.kind === "ui-demo") ? "workbench" : "editorial";
  const radii = (plan.uiDocuments || []).flatMap(document => document.styles.map(style => style.radius));
  const corners = radii.length && radii.filter(radius => radius >= 8).length / radii.length >= .5 ? "rounded" : "square";
  const uiAssets = new Set((plan.uiDocuments || []).flatMap(document => document.sourceAssetIds));
  const media = plan.assets.filter(asset => asset.usage === "output" && asset.kind !== "audio").map(asset => ({ assetId: asset.id, kind: asset.kind, source: asset.source || asset.provenance?.assetUrl || asset.provenance?.pageUrl || null, rights: asset.rights, role: (uiAssets.has(asset.id) ? "product-ui" : asset.provenance?.role === "brand-logo" ? "brand-logo" : "source-media") as ShotDirectorMetadata["media"][number]["role"] }));
  return { metadata: {
    version: 1, ...(literalContextVersion === 1 ? { literalContextVersion: 1 as const } : {}), ...(literalEmphasisVersion === 1 ? { literalEmphasisVersion: 1 as const } : {}), source: { researchSha256: binding.researchSha256, evidenceSha256: binding.evidenceSha256, scriptSha256: binding.scriptSha256, uiSha256: binding.uiSha256 }, output: { ...plan.output },
    brief: { audienceMoment: { text: story.problem?.text || story.primaryAudience.text, evidenceIds: unique([...story.primaryAudience.evidenceIds, ...(story.problem?.evidenceIds || [])]) }, visualArgument: { action: story.mechanism.text, result: story.outcome.text, evidenceIds: unique([...story.mechanism.evidenceIds, ...story.outcome.evidenceIds]) }, recurringSubjects: unique(plan.scenes.flatMap((scene, i) => scenes[i].subjectIds.map(id => scene.presentation?.visual?.kind === "ui-demo" ? `ui:${scene.presentation.visual.documentId}:${id}` : id))), contrast: ["scale", "density", "motion-rest"] },
    visualSystem: { family, material: plan.background === "dark" ? "ink" : corners === "rounded" ? "glass" : "paper", depth: family === "editorial" ? "flat" : "layered", corners, palette: { background: brand?.background || (plan.background === "dark" ? "#111111" : "#ffffff"), foreground: brand?.foreground || (plan.background === "dark" ? "#ffffff" : "#111111"), accent: plan.accent }, paletteSource: brand?.sourceUrl || null, typography: (evidence?.brand?.typography || plan.shotDirector?.visualSystem.typography || []).map(value => ({ ...value })) },
    media, unavailableTreatments: ["Human-plus-product requires verified permissioned human footage; generic source media is not assumed to contain a customer.", "Photographic stages and dimensional assets require separately classified, source-bound media; this version uses only documented product surfaces."],
  }, scenes };
}

const record = (plan: Plan) => ({ ...plan.shotDirector, scenes: plan.scenes.map(scene => ({ sceneId: scene.id, direction: scene.shotDirection })) });
export function applyShotDirector(plan: Plan, evidence?: Evidence, options?: ShotDirectorOptions): Plan {
  const directed = buildDirectorPlan(plan, evidence, options);
  plan.shotDirector = directed.metadata;
  plan.scenes.forEach((scene, index) => { scene.shotDirection = directed.scenes[index]; });
  plan.production!.shotDirectorVersion = 1;
  plan.production!.shotDirectorSha256 = stageDigest(record(plan));
  return plan;
}

/** Render/restart guard: missing, tampered or silently upgraded direction is rejected. */
export function validatePlanShotDirector(plan: Plan) {
  if (!plan.shotDirector) {
    if (plan.production?.shotDirectorVersion || plan.production?.shotDirectorSha256 || plan.scenes.some(scene => scene.shotDirection)) throw stageFailure("The saved shot director contract is missing.");
    return;
  }
  if (plan.shotDirector.version !== 1 || plan.production?.shotDirectorVersion !== 1 || plan.production.shotDirectorSha256 !== stageDigest(record(plan))) throw stageFailure("The saved shot director contract changed.");
  const expected = buildDirectorPlan(plan);
  if (stageDigest(expected.metadata) !== stageDigest(plan.shotDirector) || stageDigest(expected.scenes) !== stageDigest(plan.scenes.map(scene => scene.shotDirection))) throw stageFailure("The shot director no longer matches its source, timeline, subjects or supported operations.");
}

export async function persistShotDirector(plan: Plan, workspace: string, hooks: Pick<Hooks, "persist">) {
  if (!plan.shotDirector) return;
  validatePlanShotDirector(plan);
  await writeJson(join(workspace, SHOT_DIRECTOR_PATH), record(plan));
  const clean = (text: string) => text.replace(/[|\r\n]/g, " ");
  const board = `# ${clean(plan.product)} — shot storyboard\n\nDirector v1 · ${plan.output.width} × ${plan.output.height} · ${plan.output.fps} fps\n\nAudience moment: ${clean(plan.shotDirector.brief.audienceMoment.text)}\n\nAction: ${clean(plan.shotDirector.brief.visualArgument.action)}\n\nResult: ${clean(plan.shotDirector.brief.visualArgument.result)}\n\nVisual system: ${plan.shotDirector.visualSystem.family} / ${plan.shotDirector.visualSystem.material}. Source palette: ${plan.shotDirector.visualSystem.paletteSource || "neutral fallback"}.\n\n` + plan.scenes.map(scene => {
    const directed = scene.shotDirection!;
    return `## ${scene.id}: ${clean(scene.headline)}\n\n${clean(scene.purpose)}\n\nSource: ${scene.asset_id} · ${scene.evidence_id}\n\nCopy role: ${directed.copyRole}. Exit: ${directed.exit.kind}.\n\n` + (directed.camera.shots.length ? `| Time in film | Framing | Subject IDs | Camera travel |\n|---|---|---|---|\n` + directed.camera.shots.map(shot => `| ${((scene.start_frame + shot.atFrame) / 30).toFixed(2)}s | ${shot.job} | ${[...shot.targetIds, ...(shot.contextIds || [])].join(", ") || "whole interface"} | ${shot.moveFrames} frames |`).join("\n") : "Editorial/source-media composition; no invented UI controls.") + `\n\n` + (directed.resultHold ? `Quiet result: ${((scene.start_frame + directed.resultHold.startFrame) / 30).toFixed(2)}–${((scene.start_frame + directed.resultHold.endFrame) / 30).toFixed(2)}s.\n\n` : "");
  }).join("\n");
  await writeFile(join(workspace, "SHOT-STORYBOARD.md"), board);
  await hooks.persist([SHOT_DIRECTOR_PATH, "SHOT-STORYBOARD.md"]);
}
