import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compilePlan, validateTimeline } from "./planning";
import type { Asset, Evidence, Hooks, WorkerInput } from "./types";

const input: WorkerInput = { jobId: "timing", ownerId: "unit", mode: "prd", videoType: "feature-demo", format: "16:9", files: [] };
const hooks: Hooks = { persist: async () => {}, state: async () => {}, complete: async () => {} };
const image: Asset = { id: "screen", path: "assets/screen.jpg", kind: "image", usage: "output", rights: "Original test fixture", width: 1440, height: 960 };
const evidence = (assets: Asset[] = [image]): Evidence => ({ text: "Product evidence for the actual capability.", assets });
const scene = (durationSeconds: number, options: Record<string, unknown> = {}) => ({ assetId: "screen", headline: "Product evidence", detail: "", evidenceId: "fact-1", durationSeconds, sourceInSeconds: 0, preserveAudio: false, purpose: "Show actual product evidence", referenceTechnique: "Contained image", ...options });
const draft = (scenes: ReturnType<typeof scene>[]) => ({ sufficientEvidence: true, reason: "Actual product evidence", product: "Product", summary: "A grounded demo", accent: "#112233", background: "dark", musicPrompt: "Quiet instrumental ambient texture", sfxPrompt: "Soft interface reveal", assumptions: [], scenes });
const workspace = () => mkdtemp(join(tmpdir(), "video-studio-plan-timing-"));

test("three-decimal still durations preserve the original 1081-frame repair instead of adding frames", async () => {
  const frames = [152, 219, 190, 161, 209, 150];
  const original = await compilePlan(input, evidence(), draft(frames.map(n => scene(n / 30))), hooks, await workspace());
  const rounded = [5.067, 7.3, 6.333, 5.367, 6.967, 5];
  const repaired = await compilePlan(input, evidence(), draft(rounded.map(n => scene(n))), hooks, await workspace(), { plan: original, findings: [] });
  assert.deepEqual(repaired.scenes.map(s => s.duration_frames), frames);
  assert.equal(repaired.output.duration_frames, 1081);
  assert.deepEqual(validateTimeline(repaired), []);
  assert.deepEqual(repaired.scenes.map(s => s.start_frame), [0, 152, 371, 561, 722, 931]);
});

test("still requests round to the nearest frame while reading time always rounds up", async () => {
  const readingCopy = { headline: "One two three four five", detail: "Six seven eight nine" };
  const plan = await compilePlan(input, evidence(), draft([scene(5.016), scene(5.017), scene(3, readingCopy)]), hooks, await workspace());
  assert.deepEqual(plan.scenes.map(s => s.duration_frames), [150, 151, 123]);
  assert.ok(plan.scenes[2].duration_frames / 30 >= 9 * 0.32 + 1.2);
  const shorter = await compilePlan(input, evidence(), draft([scene(3), scene(3)]), hooks, await workspace());
  await assert.rejects(compilePlan(input, evidence(), draft([scene(3, readingCopy), scene(3)]), hooks, await workspace(), { plan: shorter, findings: [] }), (error: unknown) => error instanceof Error && "code" in error && error.code === "duration_budget");
});

test("video requests still round up and cannot overrun the measured source", async () => {
  const video: Asset = { ...image, id: "clip", kind: "video", path: "assets/clip.mp4", duration_seconds: 7, has_audio: false };
  const sources = evidence([image, video]);
  const plan = await compilePlan(input, sources, draft([scene(5.067, { assetId: "clip" }), scene(3)]), hooks, await workspace());
  assert.equal(plan.scenes[0].duration_frames, 153);
  assert.deepEqual(validateTimeline(plan), []);
  await assert.rejects(compilePlan(input, sources, draft([scene(5.067, { assetId: "clip", sourceInSeconds: 2 }), scene(3)]), hooks, await workspace()), /exceeds actual source duration/);
});

test("preserved speech covers the full measured clip even when provider seconds round slightly down", async () => {
  const video: Asset = { ...image, id: "speech", kind: "video", path: "assets/speech.mp4", duration_seconds: 5.034, has_audio: true, transcript: { text: "Complete spoken thought", words: [{ text: "thought", start: 4.8, end: 5.034, type: "word" }] } };
  const sources = evidence([image, video]), fullSpeech = scene(5.033, { assetId: "speech", preserveAudio: true });
  const plan = await compilePlan(input, sources, draft([fullSpeech, scene(3)]), hooks, await workspace());
  assert.equal(plan.scenes[0].duration_frames, 152);
  assert.ok(plan.scenes[0].duration_frames / 30 >= video.duration_seconds!);
  assert.deepEqual(validateTimeline(plan), []);
  for (const invalid of [{ preserveAudio: false }, { sourceInSeconds: 0.01 }, { durationSeconds: 4.9 }]) {
    await assert.rejects(compilePlan(input, sources, draft([{ ...fullSpeech, ...invalid }, scene(3)]), hooks, await workspace()), (error: unknown) => error instanceof Error && "code" in error && error.code === "speech_cut");
  }
  await assert.rejects(compilePlan(input, sources, draft([fullSpeech, fullSpeech]), hooks, await workspace()), (error: unknown) => error instanceof Error && "code" in error && error.code === "speech_cut");
});
