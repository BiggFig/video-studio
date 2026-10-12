import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyShotDirector, buildDirectorPlan, persistShotDirector, requiredDirectorFrames, validatePlanShotDirector } from "./shot-director";
import { stageDigest } from "./research";
import { expectedSemanticUiCamera, uiStageViewport } from "./ui-camera";
import { expectedUiState } from "./ui-state";
import type { UiDocument } from "./ui-reconstruction";
import type { Plan, Scene } from "./types";

function fixture(): Plan {
  const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
  const element = (id: string, type: UiDocument["elements"][number]["type"], text: string, box: ReturnType<typeof rect>, initiallyVisible = true): UiDocument["elements"][number] => ({ id, type, text, rect: box, sourceRect: box, sourceAssetId: "source", styleId: "body", textBasis: "source-ui", initiallyVisible });
  const doc: UiDocument = { id: "form", sourceAssetIds: ["source"], capabilityFactIds: ["fact-1"], viewport: { width: 1000, height: 600 }, styles: [{ id: "body", fill: "#ffffff", color: "#111111", borderColor: "#cccccc", fontSize: 18, fontWeight: 400, radius: 4 }],
    elements: [element("name", "input", "Name", rect(.12, .2, .4, .08)), element("submit", "button", "Submit", rect(.7, .7, .17, .09)), element("answer", "text", "Client brief", rect(.2, .3, .6, .3), false)],
    states: [{ id: "empty", basis: "observed", sourceAssetId: "source", evidenceIds: ["fact-1"], visibleElementIds: ["name", "submit"], selectedElementIds: [], textValues: [] }, { id: "submitted", basis: "illustrative", evidenceIds: ["fact-1"], visibleElementIds: ["answer"], selectedElementIds: [], textValues: [{ elementId: "answer", text: "Ada · Website", textBasis: "example-content" }] }],
    terminalResult: { version: 1, beforeStateId: "empty", afterStateId: "submitted", confirmationElementId: "submit", resultElementIds: ["answer"], evidenceIds: ["fact-1"] },
  };
  const scene: Scene = { id: "scene-1", start_frame: 0, duration_frames: 210, asset_id: "source", source_in_seconds: 0, playback_rate: 1, preserve_audio: false, fit: "contain", purpose: "Complete the client brief", reference_technique: "Control to consequence", headline: "A complete brief", detail: "", evidence_id: "fact-1", evidence: "Create and submit client forms.", effects: [], direction: { version: 2, job: "action", motion: "focus", continuityKey: "ui:form" }, presentation: { template: "proof", theme: "light", transition: "cut", visual: { kind: "ui-demo", documentId: "form", actions: [{ kind: "type", atFrame: 30, durationFrames: 24, targetId: "name", text: "Ada", evidenceId: "fact-1" }, { kind: "click", atFrame: 100, durationFrames: 12, targetId: "submit", evidenceId: "fact-1" }, { kind: "state", atFrame: 115, durationFrames: 1, stateId: "submitted", evidenceId: "fact-1" }] } } };
  const claim = { text: "Design teams", basis: "explicit" as const, evidenceIds: ["fact-1"] };
  const plan: Plan = { version: 1, job_id: "director-test", mode: "create", renderer: "hyperframes", output: { width: 1920, height: 1080, fps: 30, duration_frames: 210 }, product: "Example", summary: "One source-bound workflow", accent: "#555555", background: "light", story: { primaryAudience: claim, problem: null, mechanism: { ...claim, text: "Create and submit client forms", steps: [{ action: "Submit", assetId: "source", evidenceId: "fact-1" }] }, outcome: { ...claim, text: "Read the client brief" }, differentiator: null, cta: { ...claim, text: "Create a form" } },
    creativeDirection: { version: 1, product: "Example", researchSha256: "a".repeat(64), evidenceSha256: "b".repeat(64), briefSha256: "c".repeat(64), audience: claim, mechanism: claim, outcome: claim, cta: claim, workflow: [{ action: "Submit", assetId: "source", evidenceId: "fact-1" }], brand: null, concept: "focus", evidenceId: "fact-1", evidence: scene.evidence }, uiDocuments: [doc], assets: [{ id: "source", path: "assets/source.png", kind: "image", usage: "output", width: 1000, height: 600, rights: "Synthetic fixture only", source: "https://example.test/form" }], scenes: [scene], captions: [], audio: [], music_prompt: "Not generated", sfx_prompt: "Not generated", assumptions: [], production: { researchSha256: "a".repeat(64), evidenceSha256: "b".repeat(64), scriptSha256: "c".repeat(64) } };
  bindUi(plan); return plan;
}
function bindUi(plan: Plan) { plan.production!.uiSha256 = stageDigest({ version: 1, jobId: plan.job_id, evidenceSha256: plan.production!.evidenceSha256, researchSha256: plan.production!.researchSha256, documents: plan.uiDocuments }); }

function literalFixture(): Plan {
  const plan = fixture(), doc = plan.uiDocuments![0], scene = plan.scenes[0];
  doc.id = "preview"; doc.viewport = { width: 520, height: 240 }; doc.styles[0].fontSize = 12;
  const element = (id: string, text: string, x: number, y: number, width: number, height: number, type: "text" | "panel" = "text") => ({ id, type, text, rect: { x, y, width, height }, sourceRect: { x, y, width, height }, sourceAssetId: "source", styleId: "body", textBasis: "source-ui" as const, initiallyVisible: true });
  // Same compact two-pane geometry as the real failed shot, with generic copy.
  doc.elements = [element("code-pane", "", .038, .083, .443, .767, "panel"), element("definition", "const Greeting = ({", .061, .15, .396, .158), element("code", "name = 'Ada',", .061, .375, .396, .092), element("template", "Hello {name},", .061, .692, .396, .092), element("preview-pane", "", .519, .083, .443, .592, "panel"), element("heading", "Welcome, user!", .542, .15, .396, .2875), element("greeting", "Hello Ada,", .542, .504, .396, .104)];
  const visible = doc.elements.map(element => element.id);
  doc.states = [{ id: "before", basis: "observed", sourceAssetId: "source", evidenceIds: ["fact-1"], visibleElementIds: visible, selectedElementIds: [], textValues: [] }, { id: "after", basis: "illustrative", evidenceIds: ["fact-1"], visibleElementIds: visible, selectedElementIds: [], textValues: [{ elementId: "code", text: "name = 'Mina',", textBasis: "example-content" }, { elementId: "greeting", text: "Hello Mina,", textBasis: "example-content" }] }];
  doc.previewBinding = { kind: "literal-preview", codeElementId: "code", templateElementId: "template", resultElementId: "greeting", contextElementIds: ["definition", "heading"], evidenceIds: ["fact-1"] };
  doc.terminalResult = { version: 2, beforeStateId: "before", afterStateId: "after", trigger: { kind: "code-edit-complete", elementId: "code", text: "name = 'Mina',", evidenceId: "fact-1" }, resultElementIds: ["greeting"], evidenceIds: ["fact-1"] };
  scene.duration_frames = 270; plan.output.duration_frames = 270;
  scene.presentation!.visual = { kind: "ui-demo", documentId: "preview", actions: [{ kind: "type", atFrame: 30, durationFrames: 54, targetId: "code", text: "name = 'Mina',", evidenceId: "fact-1" }, { kind: "state", atFrame: 90, durationFrames: 1, stateId: "after", evidenceId: "fact-1" }] };
  bindUi(plan); return plan;
}

test("fresh literal camera preserves both causal panes before, throughout typing and through the result hold in every format", () => {
  for (const [width, height] of [[1920, 1080], [1080, 1080], [1080, 1350], [1080, 1920]]) {
    const plan = literalFixture(), original = structuredClone(plan.scenes[0].presentation); Object.assign(plan.output, { width, height });
    applyShotDirector(plan); validatePlanShotDirector(plan);
    assert.equal(plan.shotDirector!.literalContextVersion, 1);
    const scene = plan.scenes[0], doc = plan.uiDocuments![0], track = scene.shotDirection!.camera;
    assert.deepEqual(scene.presentation, original); assert.deepEqual(scene.shotDirection!.resultHold, { startFrame: 103, endFrame: 270 });
    assert.equal(track.shots.find(shot => shot.job === "input")!.targetIds[0], "code");
    assert.equal(track.shots.at(-1)!.targetIds[0], "greeting"); assert.equal(track.shots.at(-1)!.moveFrames, 12);
    const view = uiStageViewport(width, height, true, true, true), fit = Math.min(view.width / doc.viewport.width, view.height / doc.viewport.height);
    for (let frame = 24; frame < scene.duration_frames; frame++) {
      const camera = expectedSemanticUiCamera(doc, track, frame, view);
      for (const element of doc.elements) {
        const r = element.rect, left = view.width / 2 + (r.x - .5) * doc.viewport.width * fit * camera.scale + camera.x, top = view.height / 2 + (r.y - .5) * doc.viewport.height * fit * camera.scale + camera.y;
        assert.ok(left >= -.001 && top >= -.001 && left + r.width * doc.viewport.width * fit * camera.scale <= view.width + .001 && top + r.height * doc.viewport.height * fit * camera.scale <= view.height + .001, `${width}x${height} frame${frame} ${element.id}`);
        if (element.text) assert.ok(doc.styles[0].fontSize * fit * camera.scale >= 16);
      }
    }
  }
});

test("retained literal framing and repair selection retain absence, hashes and isolated poses", () => {
  const legacy = applyShotDirector(literalFixture(), undefined, { literalContextVersion: 0 }), saved = JSON.stringify(legacy), hash = legacy.production!.shotDirectorSha256;
  assert.equal(legacy.shotDirector!.literalContextVersion, undefined); validatePlanShotDirector(legacy); assert.equal(JSON.stringify(legacy), saved);
  assert.deepEqual(buildDirectorPlan(legacy).scenes, legacy.scenes.map(scene => scene.shotDirection));
  applyShotDirector(legacy); assert.equal(legacy.production!.shotDirectorSha256, hash);
  const repaired = literalFixture(); applyShotDirector(repaired, undefined, { literalContextVersion: legacy.shotDirector!.literalContextVersion ?? 0 });
  assert.deepEqual(repaired.scenes[0].shotDirection!.camera, legacy.scenes[0].shotDirection!.camera);
  const oldCamera = expectedSemanticUiCamera(legacy.uiDocuments![0], legacy.scenes[0].shotDirection!.camera, 269, uiStageViewport(1920, 1080, true, true, true)); assert.equal(oldCamera.scale, 2.4);
  const fresh = applyShotDirector(literalFixture()), changed = structuredClone(fresh); delete changed.shotDirector!.literalContextVersion;
  assert.throws(() => validatePlanShotDirector(changed));
});

test("literal framing includes only visible bound context and containing panels", () => {
  const plan = literalFixture(), doc = plan.uiDocuments![0];
  doc.elements.push({ ...doc.elements[5], id: "future", initiallyVisible: false }, { ...doc.elements[5], id: "unrelated", text: "Unrelated", rect: { x: .9, y: .9, width: .05, height: .05 } });
  doc.previewBinding!.contextElementIds.push("future"); doc.states[1].visibleElementIds = [...doc.states[1].visibleElementIds, "future"]; bindUi(plan);
  const track = buildDirectorPlan(plan).scenes[0].camera;
  assert.ok(!track.shots.find(shot => shot.job === "input")!.contextIds!.includes("future"));
  assert.ok(track.shots.at(-1)!.contextIds!.includes("future"));
  assert.ok(track.shots.every(shot => !shot.contextIds?.includes("unrelated")));
});

test("director compiles causal close-ups and quiet consequence without changing product actions", () => {
  const plan = fixture(), original = structuredClone(plan.scenes[0].presentation), directed = buildDirectorPlan(plan).scenes[0];
  assert.deepEqual(directed.camera.shots.map(shot => shot.job), ["establish", "input", "context", "commit", "result"]);
  assert.deepEqual(directed.camera.shots.at(-1)!.targetIds, ["answer"]);
  assert.equal(directed.resultHold!.startFrame, 128);
  assert.ok(directed.resultHold!.endFrame - directed.resultHold!.startFrame >= 45);
  assert.deepEqual(plan.scenes[0].presentation, original);
  assert.notEqual(directed.layers.copy.enterFrames, directed.layers.material.enterFrames);
  assert.equal(requiredDirectorFrames(plan.scenes[0].presentation), 173);
  assert.deepEqual(buildDirectorPlan(plan), buildDirectorPlan(plan));
});

test("source, subject, timing and renderer-version tampering stop before rendering", () => {
  const plan = applyShotDirector(fixture()); validatePlanShotDirector(plan);
  for (const change of [
    (p: Plan) => { p.scenes[0].shotDirection!.camera.shots[1].targetIds = ["invented-control"]; },
    (p: Plan) => { p.scenes[0].duration_frames++; },
    (p: Plan) => { p.uiDocuments![0].elements[0].text = "Unsupported control"; },
    (p: Plan) => { delete p.shotDirector; },
    (p: Plan) => { delete p.production!.shotDirectorVersion; },
  ]) { const changed = structuredClone(plan); change(changed); assert.throws(() => validatePlanShotDirector(changed)); }
  const short = fixture(); short.scenes[0].duration_frames = 172;
  assert.throws(() => applyShotDirector(short), /45 readable frames/);
});

test("an unchanged commit button never substitutes for the final product result", () => {
  const plan = fixture(), document = plan.uiDocuments![0], visual = plan.scenes[0].presentation!.visual!;
  delete document.terminalResult;
  if (visual.kind !== "ui-demo") throw Error("Fixture visual changed");
  visual.actions = [{ kind: "click", atFrame: 30, durationFrames: 12, targetId: "submit", evidenceId: "fact-1" }];
  bindUi(plan);
  const direction = buildDirectorPlan(plan).scenes[0];
  assert.deepEqual(direction.camera.shots.find(shot => shot.job === "commit")!.targetIds, ["submit"]);
  assert.deepEqual(direction.camera.shots.at(-1)!.targetIds, ["name", "submit"]);
  assert.equal(direction.camera.shots.at(-1)!.moveFrames, 12);
});

test("replacement results cut at state completion without revealing hidden future UI", () => {
  const plan = fixture(), document = plan.uiDocuments![0], visual = plan.scenes[0].presentation!.visual!;
  if (visual.kind !== "ui-demo") throw Error("Fixture visual changed");
  const directed = buildDirectorPlan(plan).scenes[0], result = directed.camera.shots.at(-1)!;
  assert.equal(result.atFrame, 116);
  assert.equal(result.moveFrames, 0);
  assert.equal(expectedUiState(document, visual.actions, 115).elements.answer.visible, false);
  assert.equal(expectedUiState(document, visual.actions, 116).elements.answer.visible, true);
  for (const [width, height] of [[1920, 1080], [1080, 1350], [1080, 1920]]) {
    const viewport = uiStageViewport(width, height, true, true);
    const before = expectedSemanticUiCamera(document, directed.camera, 115, viewport);
    const after = expectedSemanticUiCamera(document, directed.camera, 116, viewport);
    assert.equal(before.targetId, "submit");
    assert.equal(after.targetId, "answer");
    assert.equal(after.settled, true);
    assert.deepEqual(after, expectedSemanticUiCamera(document, directed.camera, 127, viewport));
  }
  // Revealing a result beside a retained control still has an object to follow.
  document.states[1].visibleElementIds.push("submit"); bindUi(plan);
  assert.equal(buildDirectorPlan(plan).scenes[0].camera.shots.at(-1)!.moveFrames, 12);
});

test("outgoing masks cannot consume the required quiet result hold", () => {
  const plan = fixture(), first = plan.scenes[0];
  first.presentation!.transition = "iris";
  assert.equal(requiredDirectorFrames(first.presentation), 185);
  assert.equal(requiredDirectorFrames(first.presentation, true), 173);
  const next = structuredClone(first); next.id = "scene-2"; next.start_frame = 185; next.presentation!.transition = "cut";
  plan.scenes.push(next); first.duration_frames = 184;
  assert.throws(() => buildDirectorPlan(plan), /before the outgoing transition/);
  first.duration_frames = 185; plan.output.duration_frames = 395;
  const hold = buildDirectorPlan(plan).scenes[0].resultHold!;
  assert.deepEqual(hold, { startFrame: 128, endFrame: 173 });
  assert.equal(hold.endFrame - hold.startFrame, 45);
});

test("camera never leaves unfinished typing or anticipates a control hidden until state completion", () => {
  const plan = fixture(), visual = plan.scenes[0].presentation!.visual!;
  if (visual.kind !== "ui-demo") throw Error("Fixture visual changed");
  visual.actions[1].atFrame = 54;
  const commit = buildDirectorPlan(plan).scenes[0].camera.shots.find(shot => shot.job === "commit")!;
  assert.equal(commit.atFrame, 54);
  assert.equal(commit.moveFrames, 0);
  const doc = plan.uiDocuments![0];
  doc.elements[1].initiallyVisible = false;
  doc.states[0].visibleElementIds = ["name"];
  doc.states.push({ id: "ready", basis: "illustrative", evidenceIds: ["fact-1"], visibleElementIds: ["name", "submit"], selectedElementIds: [], textValues: [{ elementId: "name", text: "Ada", textBasis: "example-content" }] });
  visual.actions.splice(1, 0, { kind: "state", atFrame: 54, durationFrames: 1, stateId: "ready", evidenceId: "fact-1" });
  visual.actions[2].atFrame = 55;
  bindUi(plan);
  const shots = buildDirectorPlan(plan).scenes[0].camera.shots;
  assert.equal(shots.find(shot => shot.job === "commit")!.atFrame, 55);
  assert.ok(shots.filter(shot => [...shot.targetIds, ...(shot.contextIds || [])].includes("submit")).every(shot => shot.atFrame >= 55));
});

test("retained legacy plans keep absence of direction; all three placements bind independently", () => {
  const legacy = fixture(); validatePlanShotDirector(legacy); assert.equal(legacy.shotDirector, undefined);
  const hashes = new Set<string>();
  for (const [width, height] of [[1920, 1080], [1080, 1350], [1080, 1920]]) {
    const plan = fixture(); Object.assign(plan.output, { width, height }); applyShotDirector(plan); validatePlanShotDirector(plan);
    hashes.add(plan.production!.shotDirectorSha256!); assert.equal(plan.shotDirector!.output.height, height);
  }
  assert.equal(hashes.size, 3);
});

test("a cosmetic unchanged button cannot hide a reset of the carried result", () => {
  const plan = fixture(), scene = plan.scenes[0];
  const second = structuredClone(scene); second.id = "scene-2"; second.start_frame = scene.duration_frames; plan.scenes.push(second); plan.output.duration_frames *= 2;
  const directed = buildDirectorPlan(plan);
  assert.equal(directed.scenes[0].exit.kind, "cut");
});

test("object matching requires the same complete UI state and semantic subject at both boundaries", () => {
  const plan = fixture();
  for (const scene of plan.scenes) if (scene.presentation?.visual?.kind === "ui-demo") scene.presentation.visual.actions = [{ kind: "pointer", atFrame: 30, durationFrames: 12, targetId: "name", evidenceId: "fact-1" }];
  const next = structuredClone(plan.scenes[0]); next.id = "scene-2"; next.start_frame = 210; plan.scenes.push(next); plan.output.duration_frames = 420;
  const directed = buildDirectorPlan(plan);
  assert.equal(directed.scenes[0].exit.kind, "object-match");
  assert.equal(directed.scenes[0].exit.nextSceneId, "scene-2");
  assert.deepEqual(directed.scenes[0].exit.subjectIds, ["name", "submit"]);
  plan.uiDocuments![0].elements.push({ ...plan.uiDocuments![0].elements[2], id: "hidden-result" }); bindUi(plan);
  assert.equal(buildDirectorPlan(plan).scenes[0].exit.kind, "object-match");
});

test("unclassified media never grants human footage or photography; source palette is unchanged", () => {
  const plan = fixture(); plan.brand = { background: "#fafafa", foreground: "#111111", accent: "#0055aa", sourceUrl: "https://example.test" }; plan.accent = plan.brand.accent;
  const result = buildDirectorPlan(plan);
  assert.deepEqual(result.metadata.visualSystem.palette, { background: "#fafafa", foreground: "#111111", accent: "#0055aa" });
  assert.equal(result.metadata.media[0].role, "product-ui");
  assert.equal(result.metadata.unavailableTreatments.length, 2);
  assert.equal(result.metadata.visualSystem.material, "paper");
});

test("persisted storyboard and director describe the exact saved composition before audio", async () => {
  const path = await mkdtemp(join(tmpdir(), "shot-director-")), plan = applyShotDirector(fixture()), paths: string[] = [];
  await persistShotDirector(plan, path, { persist: async p => { paths.push(...p); } });
  const saved = JSON.parse(await readFile(join(path, "analysis/shot-director.json"), "utf8"));
  assert.equal(saved.source.scriptSha256, plan.production!.scriptSha256);
  assert.deepEqual(saved.scenes[0].direction.camera, plan.scenes[0].shotDirection!.camera);
  assert.match(await readFile(join(path, "SHOT-STORYBOARD.md"), "utf8"), /Quiet result: 4.27/);
  assert.deepEqual(paths, ["analysis/shot-director.json", "SHOT-STORYBOARD.md"]);
});
