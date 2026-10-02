import type { Plan } from "./types";

export interface SoundCue { sceneId: string; event: "reveal" | "interaction-result" | "legacy-reveal"; startFrame: number; durationFrames: number; gainDb: number }

/** Reuses one licensed generated effect. No new audio calls or inferred beat detection. */
export function soundCues(plan: Plan): SoundCue[] {
  if (!plan.creativeDirection) return plan.scenes[1] ? [{ sceneId: plan.scenes[1].id, event: "legacy-reveal", startFrame: plan.scenes[1].start_frame, durationFrames: 36, gainDb: -12 }] : [];
  const candidates: SoundCue[] = [];
  const reveal = plan.scenes.find(scene => !scene.preserve_audio && scene.direction?.motion === "reveal" && scene.direction.job === "context")
    ?? plan.scenes.find(scene => !scene.preserve_audio && scene.direction?.motion === "reveal");
  if (reveal) candidates.push({ sceneId: reveal.id, event: "reveal", startFrame: reveal.start_frame + Math.min(12, reveal.duration_frames - 1), durationFrames: 30, gainDb: -15 });
  for (const scene of plan.scenes) {
    const visual = scene.presentation?.visual;
    if (scene.preserve_audio || !scene.direction || visual?.kind !== "ui-demo") continue;
    const result = visual.actions.filter(action => action.kind === "state" || action.kind === "select").at(-1);
    if (result) candidates.push({ sceneId: scene.id, event: "interaction-result", startFrame: scene.start_frame + result.atFrame + result.durationFrames, durationFrames: 24, gainDb: -19 });
  }
  const accepted: SoundCue[] = [];
  for (const cue of candidates.sort((a, b) => a.startFrame - b.startFrame)) {
    const scene = plan.scenes.find(scene => scene.id === cue.sceneId)!;
    cue.durationFrames = Math.min(cue.durationFrames, scene.start_frame + scene.duration_frames - cue.startFrame, plan.output.duration_frames - cue.startFrame);
    if (cue.durationFrames < 6 || !Number.isInteger(cue.startFrame) || cue.startFrame < 0 || accepted.some(previous => cue.startFrame - previous.startFrame < 90)) continue;
    if (plan.scenes.some(speech => speech.preserve_audio && cue.startFrame < speech.start_frame + speech.duration_frames && cue.startFrame + cue.durationFrames > speech.start_frame)) continue;
    accepted.push(cue);
    if (accepted.length === 3) break;
  }
  return accepted;
}

/** Recompile timing after allowed scene-duration repairs; asset identity stays fixed. */
export function alignAudioToPlan(plan: Plan, audio: Plan["audio"]): Plan["audio"] {
  if (!plan.creativeDirection) return audio.map(layer => ({ ...layer, start_frame: layer.role === "sfx" ? plan.scenes[1].start_frame : 0, duration_frames: layer.role === "music" ? plan.output.duration_frames : layer.duration_frames }));
  const music = audio.filter(layer => layer.role === "music").map(layer => ({ ...layer, start_frame: 0, duration_frames: plan.output.duration_frames }));
  // A quiet repair can remove all scheduled cues without discarding the one
  // generated effect. Later repairs reuse that saved asset without another call.
  const retainedEffect=plan.assets.find(asset=>asset.id==="generated-sfx"&&asset.kind==="audio"&&asset.usage==="output"&&asset.has_audio);
  const effect = audio.find(layer => layer.role === "sfx") ?? (retainedEffect?{asset_id:retainedEffect.id,start_frame:0,duration_frames:36,source_in_seconds:0,playback_rate:1 as const,gain_db:-12,role:"sfx" as const}:undefined);
  if (!effect) return music;
  return [...music, ...soundCues(plan).map(cue => ({ ...effect, start_frame: cue.startFrame, duration_frames: cue.durationFrames, source_in_seconds: 0, gain_db: cue.gainDb }))];
}

export function soundCueIssues(plan: Plan): string[] {
  if (!plan.creativeDirection || !plan.audio.length) return [];
  const expected = soundCues(plan), actual = plan.audio.filter(layer => layer.role === "sfx");
  if (actual.length !== expected.length || actual.some((layer, i) => layer.start_frame !== expected[i].startFrame || layer.duration_frames !== expected[i].durationFrames || layer.gain_db !== expected[i].gainDb || layer.source_in_seconds !== 0 || layer.asset_id !== actual[0].asset_id)) return ["Directed sound cues do not match their compiled reveal/action events"];
  return [];
}

export const soundDirectionReport = (plan: Plan) => ({ version: 1, mode: plan.creativeDirection ? "directed-events" : "legacy-reveal", cues: soundCues(plan), generatedEffectCount: new Set(plan.audio.filter(layer => layer.role === "sfx").map(layer => layer.asset_id)).size, humanListeningPerformed: false, beatDetectionPerformed: false });
