import test from "node:test";
import assert from "node:assert/strict";
import { alignAudioToPlan, soundCues, soundCueIssues } from "./audio-direction";
import type { Plan } from "./types";

function fixture(): Plan {
  return { output: { duration_frames: 900, fps: 30, width: 1920, height: 1080 }, creativeDirection: { version: 1 }, scenes: [
    { id: "intro", start_frame: 0, duration_frames: 150, direction: { job: "hook", motion: "hold" } },
    { id: "product", start_frame: 150, duration_frames: 150, direction: { job: "context", motion: "reveal" } },
    { id: "workflow", start_frame: 300, duration_frames: 450, direction: { job: "action", motion: "focus" }, presentation: { visual: { kind: "ui-demo", actions: [{ kind: "click", atFrame: 40, durationFrames: 12 }, { kind: "select", atFrame: 70, durationFrames: 12 }, { kind: "state", atFrame: 120, durationFrames: 15 }] } } },
    { id: "close", start_frame: 750, duration_frames: 150, direction: { job: "cta", motion: "hold" } },
  ], assets: [], audio: [] } as unknown as Plan;
}
const audio: Plan["audio"] = [{ asset_id: "music", start_frame: 0, duration_frames: 900, source_in_seconds: 0, playback_rate: 1, gain_db: -6, role: "music" }, { asset_id: "effect", start_frame: 150, duration_frames: 36, source_in_seconds: 0, playback_rate: 1, gain_db: -12, role: "sfx" }];

test("sound follows the reveal and last completed UI result rather than every click", () => {
  const plan = fixture(), cues = soundCues(plan);
  assert.deepEqual(cues.map(cue => [cue.event, cue.startFrame]), [["reveal", 162], ["interaction-result", 435]]);
  plan.audio = alignAudioToPlan(plan, audio);
  assert.deepEqual(soundCueIssues(plan), []);
  assert.equal(new Set(plan.audio.filter(layer => layer.role === "sfx").map(layer => layer.asset_id)).size, 1);
  plan.audio[2].start_frame -= 1;
  assert.equal(soundCueIssues(plan).length, 1);
});

test("duration repairs move cues with their event and preserve generated asset identity", () => {
  const plan = fixture(); plan.scenes[1].start_frame += 60; plan.scenes[2].start_frame += 60; plan.scenes[3].start_frame += 60; plan.output.duration_frames += 60;
  const mapped = alignAudioToPlan(plan, audio);
  assert.equal(mapped[0].duration_frames, 960);
  assert.deepEqual(mapped.slice(1).map(layer => layer.start_frame), [222, 495]);
  assert.deepEqual(mapped.map(layer => layer.asset_id), ["music", "effect", "effect"]);
  assert.equal(audio[1].start_frame, 150);
});

test("quiet speech scenes suppress effects and the cue tail cannot cross a scene boundary", () => {
  const plan = fixture(); plan.scenes[1].preserve_audio = true; plan.scenes[2].preserve_audio = true;
  assert.deepEqual(soundCues(plan), []);
  plan.scenes[2].preserve_audio = false;
  const visual = plan.scenes[2].presentation!.visual!;
  if (visual.kind !== "ui-demo") throw Error("fixture");
  visual.actions = [{ kind: "state", atFrame: 426, durationFrames: 15, stateId: "result", evidenceId: "fact-1" }];
  assert.equal(soundCues(plan)[0].durationFrames, 9);
  visual.actions[0].atFrame = 433;
  assert.deepEqual(soundCues(plan), []);
});

test("legacy audio remains byte-equivalent to the previous second-scene scheduling", () => {
  const plan = fixture(); delete plan.creativeDirection;
  assert.deepEqual(alignAudioToPlan(plan, audio), audio);
  assert.deepEqual(soundCueIssues({ ...plan, audio }), []);
  assert.deepEqual(soundCues(plan).map(cue => cue.startFrame), [150]);
});

test("quiet repairs retain an unused generated effect for later cues without another audio call", () => {
  const plan=fixture();
  plan.assets.push({id:"generated-sfx",path:"assets/sfx.mp3",kind:"audio",usage:"output",rights:"Generated",width:0,height:0,duration_seconds:1.2,has_audio:true});
  plan.scenes[1].direction!.motion="hold";
  plan.scenes[2].presentation!.visual=undefined;
  plan.audio=alignAudioToPlan(plan,audio);
  assert.equal(plan.audio.length,1);
  plan.scenes[1].direction!.motion="reveal";
  plan.audio=alignAudioToPlan(plan,plan.audio);
  assert.equal(plan.audio[1].asset_id,"generated-sfx");
  assert.equal(plan.audio[1].start_frame,162);
  assert.deepEqual(soundCueIssues(plan),[]);
});
