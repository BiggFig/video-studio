import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { chromium } from "playwright";
import { compileResearch, stageDigest, type Research } from "./research";
import { compileUiDocuments, uiDesignConstraints, uiDesignRequest, uiTypingElementIds, validateUiActions, validateUiBundle, type UiAction, type UiDocument } from "./ui-reconstruction";
import { UI_TRANSPORT_VERSION } from "./model-format";
import { assertLaunchWorkflowDepth, inspectLaunchResult, launchSequenceInventory } from "./workflow-depth";
import { buildWorkflowContext, workflowTaskEvidence, WORKFLOW_COHERENCE_V2_POLICY } from "./workflow-coherence";
import { scriptConstraints, type Script } from "./scripting";
import { expectedUiState } from "./ui-state";
import { uiActionBehaviorIssues } from "./script-ui-behavior";
import { uiDocumentHtml, uiEvaluatorSource } from "./ui-composition";
import { PipelineError, type Evidence, type Plan, type WorkerInput } from "./types";
import { inspectMotionProject, prepareMotionProject, serveMotionProject } from "./motion-render";
import { mediaEnvironment } from "./media";
import { motionBrowserArgs, motionBrowserPath } from "./motion-browser";
import { applyShotDirector } from "./shot-director";

const input: WorkerInput = { jobId: "literal-preview", ownerId: "fixture", mode: "url", productUrl: "https://mail.example/", videoType: "launch", format: "16:9", files: [] };
const evidence: Evidence = { text: "Developers can author an email template and preview changes automatically. Try the editor.", assets: [{ id: "editor", path: "assets/editor.png", kind: "image", usage: "output", rights: "Synthetic source fixture", width: 1000, height: 600 }] };
function fixture() {
  const claim = (text: string) => ({ text, basis: "explicit", evidenceIds: ["fact-1"] });
  const research = compileResearch(input, evidence, {
    sufficientEvidence: true, reason: "Observed assignment, template and matching preview with documented authoring capability", product: "Email editor", summary: "Preview a name edit", facts: [{ evidenceId: "fact-1", kind: "feature", label: "Automatic template preview" }],
    visuals: [{ assetId: "editor", description: "Code and email preview", role: "product_ui", showsProductUi: true, supportsFactIds: ["fact-1"] }],
    story: { primaryAudience: claim("Developers"), problem: null, mechanism: { ...claim("Edit the name in code"), steps: [{ action: "Edit the name", evidenceId: "fact-1", assetId: "editor" }] }, outcome: claim("Preview the greeting"), differentiator: null, cta: claim("Try the editor") },
    documentTargets: [{ id: "greeting", sourceAssetIds: ["editor"], capabilityFactIds: ["fact-1"], goal: "Demonstrate one illustrative name edit and the matching greeting preview.", workflow: {
      version: 1, observedStart: { sourceAssetId: "editor", description: "Code assignment, template interpolation and matching greeting are visible." }, actions: [{ kind: "type", sourceAssetId: "editor", control: "username = 'Steve',", evidenceId: "fact-1" }],
      result: { kind: "reactive-preview", sourceAssetId: "editor", surface: "Hello Steve,", change: "Preview the name substituted into the documented template.", basis: "illustrative", evidenceId: "fact-1", contentDerivation: { kind: "literal-preview", sourceAssetId: "editor", codeText: "username = 'Steve',", propertyName: "username", beforeLiteral: "Steve", afterLiteral: "Ada", templateText: "Hello {username},", outputBefore: "Hello Steve,", outputAfter: "Hello Ada,", context: ["welcome.tsx"] } },
    } }], limitations: ["The edit is an illustrative reconstruction, not an executed authenticated session."],
  }, "a".repeat(64), { version: 3, workflowSelection: true });
  const element = (id: string, text: string, x: number, y: number): UiDocument["elements"][number] => ({ id, text, type: "text", rect: { x, y, width: .42, height: .1 }, sourceRect: { x, y, width: .42, height: .1 }, styleId: "body", textBasis: "source-ui", sourceAssetId: "editor", initiallyVisible: true });
  const elements = [element("code", "username = 'Steve',", .04, .3), element("template", "Hello {username},", .04, .55), element("preview", "Hello Steve,", .54, .3), element("file", "welcome.tsx", .04, .08)];
  const document: UiDocument = {
    id: "greeting", sourceAssetIds: ["editor"], capabilityFactIds: ["fact-1"], viewport: { width: 1000, height: 600 }, styles: [{ id: "body", fill: "transparent", color: "#eeeeee", borderColor: "transparent", fontSize: 26, fontWeight: 400, radius: 0 }], elements,
    states: [{ id: "observed", basis: "observed", sourceAssetId: "editor", evidenceIds: ["fact-1"], visibleElementIds: elements.map(element => element.id), selectedElementIds: [], textValues: [] }, { id: "previewed", basis: "illustrative", evidenceIds: ["fact-1"], visibleElementIds: elements.map(element => element.id), selectedElementIds: [], textValues: [{ elementId: "code", text: "username = 'Ada',", textBasis: "example-content" }, { elementId: "preview", text: "Hello Ada,", textBasis: "example-content" }] }],
    terminalResult: { version: 2, beforeStateId: "observed", afterStateId: "previewed", trigger: { kind: "code-edit-complete", elementId: "code", text: "username = 'Ada',", evidenceId: "fact-1" }, resultElementIds: ["preview"], evidenceIds: ["fact-1"] },
    previewBinding: { kind: "literal-preview", codeElementId: "code", templateElementId: "template", resultElementId: "preview", contextElementIds: ["file"], evidenceIds: ["fact-1"] },
  };
  const actions: UiAction[] = [{ kind: "type", atFrame: 30, durationFrames: 30, targetId: "code", text: "username = 'Ada',", evidenceId: "fact-1" }, { kind: "state", atFrame: 60, durationFrames: 1, stateId: "previewed", evidenceId: "fact-1" }];
  return { research, document, actions };
}
function compile(document: UiDocument, research: Research) {
  return compileUiDocuments({ transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Synthetic source-bound fixture", documentsById: { greeting: document } }, input, evidence, research, { requireLaunchResult: true });
}
function scriptFor(document: UiDocument, actions: UiAction[]): Script {
  const script: Script = { version: 3, jobId: input.jobId, evidenceSha256: "a".repeat(64), researchSha256: "b".repeat(64), sufficientEvidence: true, reason: "", product: "Email editor", summary: "", accent: "#ffffff", background: "dark", musicPrompt: "", sfxPrompt: "", assumptions: [], uiDocuments: [document], scenes: [{ assetId: "editor", evidenceId: "fact-1", headline: "Edit a name. Preview the greeting.", detail: "", durationSeconds: 7, sourceInSeconds: 0, preserveAudio: false, purpose: "", referenceTechnique: "", storyRole: "mechanism", presentation: { template: "proof", theme: "dark", transition: "cut", visual: { kind: "ui-demo", documentId: document.id, actions } } }] };
  script.uiSha256 = stageDigest({ version: 1, jobId: script.jobId, evidenceSha256: script.evidenceSha256, researchSha256: script.researchSha256, documents: script.uiDocuments });
  return script;
}
const rejected = (error: unknown) => error instanceof PipelineError;

test("source-bound literal preview preserves observed text roles and exposes only the exact illustrative edit", () => {
  const { research, document, actions } = fixture(), before = JSON.stringify(document), stage = compile(document, research), bundle = { documents: stage.documents, sha256: stageDigest(stage) };
  assert.equal(JSON.stringify(document), before); assert.deepEqual(stage.documents, [document]); validateUiBundle(bundle, input, evidence, research);
  assert.equal(inspectLaunchResult(document).ready, true); assert.equal(document.elements[0].type, "text"); assert.deepEqual(uiTypingElementIds(document), ["code"]);
  assert.equal(uiDesignConstraints(research, { requireLaunchResult: true }).targets[0].literalPreview, true);
  assert.deepEqual(scriptConstraints(research, evidence, bundle)!.uiDocuments![0].editableElementIds, ["code"]);
  assert.match(uiDesignRequest(research, evidence, research.documentTargets![0], 6000, { requireLaunchResult: true }).prompt, /Do not reclassify static code as an observed input/);
  const [sequence] = launchSequenceInventory([document]);
  assert.equal(sequence.initialContextAllowsDirectClick, false); assert.equal(sequence.directStartActions, undefined); assert.deepEqual(sequence.reactiveStartActions?.map(action => action.kind), ["type", "state"]);
  validateUiActions(document, actions); assert.deepEqual(uiActionBehaviorIssues(document, actions, { rejectImplicitTypedReset: true, rejectUnsupportedGraphicCreation: true }), []);
  assert.equal(assertLaunchWorkflowDepth(scriptFor(document, actions)).length, 1);
});

test("reactive result requires visible timed typing of its exact bound code before the result", () => {
  const { document, actions } = fixture();
  for (const invalid of [
    [actions[1]],
    [{ ...actions[0], kind: "pointer" as const, text: undefined }, actions[1]],
    [{ ...actions[0], kind: "click" as const, text: undefined }, actions[1]],
    [{ ...actions[0], text: "username = 'Other'," }, actions[1]],
    [{ ...actions[0], targetId: "template" }, actions[1]],
    [{ ...actions[0], durationFrames: 0 }, actions[1]],
    [actions[0], { ...actions[1], atFrame: 59 }],
  ]) assert.throws(() => { validateUiActions(document, invalid); assertLaunchWorkflowDepth(scriptFor(document, invalid)); });
  const initial = expectedUiState(document, actions, 29), typing = expectedUiState(document, actions, 45), typed = expectedUiState(document, actions, 60), result = expectedUiState(document, actions, 61);
  assert.equal(initial.elements.code.text, "username = 'Steve',"); assert.notEqual(typing.elements.code.text, initial.elements.code.text); assert.equal(typing.elements.code.typing, true);
  assert.equal(typed.elements.code.text, "username = 'Ada',"); assert.equal(typed.elements.preview.text, "Hello Steve,"); assert.equal(result.elements.preview.text, "Hello Ada,");
  assert.equal(result.basis, "illustrative"); assert.equal(result.pointer.clickProgress, 0);
  const evaluate = runInNewContext(`(${uiEvaluatorSource()})`);
  for (const frame of [0, 29, 30, 45, 60, 61, 120, 61, 45, 0]) assert.equal(JSON.stringify(evaluate(document, actions, frame)), JSON.stringify(expectedUiState(document, actions, frame)));
});

test("versioned literal transport derives only redundant references and preserves all authored content", () => {
  const { research, document } = fixture(), compact = structuredClone(document);
  delete compact.previewBinding; delete compact.terminalResult; const original = JSON.stringify(compact);
  assert.deepEqual(compile(compact, research).documents, [document]); assert.equal(JSON.stringify(compact), original);
  assert.match(uiDesignRequest(research, evidence, research.documentTargets![0], 6000, { requireLaunchResult: true }).prompt, /Omit previewBinding and terminalResult/);
  for (const mutate of [
    (d: UiDocument) => { d.elements.push({ ...d.elements[0], id: "ambiguous-code" }); d.states.forEach(state => state.visibleElementIds.push("ambiguous-code")); },
    (d: UiDocument) => { d.states[1].textValues[1].text = "An invented output"; },
    (d: UiDocument) => { d.states[1].textValues = []; },
    (d: UiDocument) => { d.states.reverse(); },
    (d: UiDocument) => { d.states[0].sourceAssetId = "another-source"; },
    (d: UiDocument) => { d.previewBinding = document.previewBinding; },
  ]) { const changed = structuredClone(compact); mutate(changed); const before = JSON.stringify(changed); assert.throws(() => compile(changed, research), rejected); assert.equal(JSON.stringify(changed), before); }
  assert.throws(() => compileUiDocuments({ sufficientEvidence: true, reason: "Legacy unmarked transport", documents: [compact] }, input, evidence, research, { requireLaunchResult: true }), rejected, "unmarked transport never acquires derived semantics");
});

test("semantic evidence retains the illustrative binding and only the preview as a postcondition", () => {
  const { document, actions } = fixture(), context = buildWorkflowContext(scriptFor(document, actions));
  assert.equal(context.documents[0].illustrativeLabel, "Illustrative code preview"); assert.deepEqual(context.documents[0].previewBinding, document.previewBinding);
  const task = workflowTaskEvidence(context)[0]; assert.equal(task.observableExtent, "result-candidate"); assert.deepEqual(task.postconditions.flatMap(value => value.elements.map(element => element.elementId)), ["preview"]);
  assert.match(WORKFLOW_COHERENCE_V2_POLICY, /not an editable website control or an executed authenticated session/);
  const skipped = workflowTaskEvidence(buildWorkflowContext(scriptFor(document, [actions[1]])))[0]; assert.equal(skipped.postconditions.length, 0);
});

test("literal preview rejects unbound, fabricated, contradictory or unrelated content even with recomputed hashes", () => {
  const changes: [string, (document: UiDocument) => void][] = [
    ["observed input claim", document => { document.elements[0].type = "input"; }],
    ["wrong observed assignment", document => { document.elements[0].text = "username = 'Alex',"; }],
    ["wrong template", document => { document.elements[1].text = "Welcome {username},"; }],
    ["wrong initial greeting", document => { document.elements[2].text = "Hello ACME,"; }],
    ["wrong changed greeting", document => { document.states[1].textValues[1].text = "Hello ACME,"; }],
    ["unbound literal", document => { document.states[1].textValues[0].text = "username = 'Other',"; }],
    ["fabricated source text", document => { document.states[1].textValues[1].textBasis = "source-ui"; }],
    ["changed template", document => { document.states[1].textValues.push({ elementId: "template", text: "Welcome {username},", textBasis: "example-content" }); }],
    ["changed context", document => { document.states[1].textValues.push({ elementId: "file", text: "sent.tsx", textBasis: "example-content" }); }],
    ["hidden context", document => { document.states[1].visibleElementIds.pop(); }],
    ["unrelated email", document => { document.elements.push({ ...document.elements[2], id: "signoff", text: "The ACME Team" }); document.states.forEach(state => state.visibleElementIds.push("signoff")); }],
    ["observed result", document => { document.states[1].basis = "observed"; document.states[1].sourceAssetId = "editor"; }],
    ["missing binding", document => { delete document.previewBinding; }],
    ["wrong result target", document => { document.terminalResult!.resultElementIds = ["code"]; }],
    ["fake CTA trigger", document => { if (document.terminalResult?.version === 2) document.terminalResult.trigger.elementId = "file"; }],
  ];
  for (const [name, change] of changes) { const { research, document } = fixture(); change(document); assert.throws(() => compile(document, research), rejected, name); }
  const { research, document } = fixture(), stage = compile(document, research); stage.documents[0].states[1].textValues[1].text = "Hello ACME,";
  assert.throws(() => validateUiBundle({ documents: stage.documents, sha256: stageDigest(stage) }, input, evidence, research), rejected);
  const absent = fixture(); delete absent.research.documentTargets![0].workflow!.result.contentDerivation; assert.throws(() => compile(absent.document, absent.research), rejected);
});

test("rendered code remains text, uses monospace and visibly labels illustrative provenance", () => {
  const { document } = fixture(), html = uiDocumentHtml(document, 0, { width: 1000, height: 600 });
  assert.match(html, /ui-text ui-code-example[^>]*data-ui-element="code"[^>]*data-ui-type="text"/);
  assert.match(html, /font-family:monospace/); assert.match(html, /username = &#39;Steve&#39;,/);
  assert.match(html, /class="ui-demo-label"[^>]*>Illustrative code preview<\/div>/); assert.doesNotMatch(html, /<input|ui-input/);
  const legacy = structuredClone(document); delete legacy.previewBinding; delete legacy.terminalResult;
  assert.doesNotMatch(uiDocumentHtml(legacy, 0, { width: 1000, height: 600 }), /Illustrative code preview|ui-code-example|font-family:monospace/);
});

test("actual production browser keeps preview disclosure visible and code/result replay correct in all placements", { skip: process.env.STUDIO_UI_LAYOUT_INTEGRATION !== "1", timeout: 120_000 }, async t => {
  const temporaryRoot = await realpath(tmpdir());
  const directory = process.env.STUDIO_REACTIVE_PROOF_DIR ? resolve(process.env.STUDIO_REACTIVE_PROOF_DIR) : await mkdtemp(join(temporaryRoot, "studio-reactive-proof-"));
  await mkdir(directory, { recursive: true });
  await mkdir(join(directory, "assets"), { recursive: true });
  // A copied source placeholder satisfies project packaging only. This test
  // renders HTML and makes no screenshot-fidelity or automatic-acceptance claim.
  await writeFile(join(directory, "assets/editor.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  if (!process.env.STUDIO_REACTIVE_PROOF_DIR) t.after(async () => { const actual = await realpath(directory), rel = relative(temporaryRoot, actual); assert.ok(!isAbsolute(rel) && !rel.startsWith("..") && rel.startsWith("studio-reactive-proof-")); await rm(actual, { recursive: true, force: true }); });
  const browser = await chromium.launch({ headless: true, executablePath: motionBrowserPath(), args: motionBrowserArgs, env: mediaEnvironment() });
  t.after(() => browser.close());
  for (const [placement, [width, height]] of [[1920, 1080], [1080, 1350], [1080, 1920], [1080, 1080]].entries()) for (const directed of [false, true]) {
    const { document, actions, research } = fixture(); compile(document, research);
    const plan: Plan = { version: 1, job_id: input.jobId, mode: "create", renderer: "hyperframes", output: { width, height, fps: 30, duration_frames: 210 }, product: "Illustrative renderer fixture", summary: "Offline renderer verification only", accent: "#ffffff", background: "dark", assets: evidence.assets, uiDocuments: [document], scenes: [{ id: "scene-1", start_frame: 0, duration_frames: 210, asset_id: "editor", source_in_seconds: 0, playback_rate: 1, preserve_audio: false, fit: "contain", purpose: "Renderer test", reference_technique: "", headline: "Edit. Preview.", detail: "", evidence: evidence.text, evidence_id: "fact-1", effects: [], presentation: { template: "proof", theme: "dark", transition: "cut", visual: { kind: "ui-demo", documentId: document.id, actions } } }], captions: [], audio: [], music_prompt: "", sfx_prompt: "", assumptions: ["Synthetic renderer fixture; not an automatic URL-video acceptance pass."] };
    if (directed) {
      const claim = { text: "Developers", basis: "explicit" as const, evidenceIds: ["fact-1"] };
      plan.story = research.story;
      plan.production = { researchSha256: stageDigest(research), evidenceSha256: research.evidenceSha256, scriptSha256: "c".repeat(64) };
      plan.production.uiSha256 = stageDigest({ version: 1, jobId: plan.job_id, evidenceSha256: plan.production.evidenceSha256, researchSha256: plan.production.researchSha256, documents: plan.uiDocuments });
      plan.creativeDirection = { version: 1, product: plan.product, researchSha256: plan.production.researchSha256, evidenceSha256: plan.production.evidenceSha256, briefSha256: "d".repeat(64), audience: claim, mechanism: claim, outcome: claim, cta: claim, workflow: [{ action: "Edit the name", assetId: "editor", evidenceId: "fact-1" }], brand: null, concept: "focus", evidenceId: "fact-1", evidence: evidence.text };
      plan.scenes[0].direction = { version: 2, job: "action", motion: "focus", continuityKey: "ui:greeting" };
      applyShotDirector(plan);
    }
    const project = await prepareMotionProject(plan, directory, placement * 2 + (directed ? 2 : 1)), server = await serveMotionProject(project.root, project.paths.map(path => path.slice(project.directory.length + 1)));
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    try {
      await page.goto(server.origin, { waitUntil: "load" }); await page.evaluate("window.__studioReady");
      for (const frame of [29, 45, 90, 45, 29, 90]) {
        await page.evaluate(`window.__studio.seekFrame(${frame})`);
        const state = expectedUiState(document, actions, frame);
        assert.equal(await page.locator('[data-ui-element="code"] [data-ui-text]').textContent(), state.elements.code.text);
        assert.equal(await page.locator('[data-ui-element="preview"] [data-ui-text]').textContent(), state.elements.preview.text);
        const label = await page.locator(".ui-demo-label").evaluate(element => {
          const bounds = element.getBoundingClientRect(), style = getComputedStyle(element);
          let painted = style.visibility === "visible" && style.display !== "none" && Number(style.opacity) > 0, clipped = false;
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            const css = getComputedStyle(parent), box = parent.getBoundingClientRect();
            painted &&= css.visibility === "visible" && css.display !== "none" && Number(css.opacity) > 0;
            if ([css.overflowX, css.overflowY].some(value => ["hidden", "clip"].includes(value)) && (bounds.left < box.left - 1 || bounds.right > box.right + 1 || bounds.top < box.top - 1 || bounds.bottom > box.bottom + 1)) clipped = true;
          }
          return { painted, clipped, left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: bounds.width, height: bounds.height, fontSize: Number.parseFloat(style.fontSize) };
        });
        assert.equal(label.painted, true); assert.equal(label.clipped, false); assert.ok(label.left >= 0 && label.top >= 0 && label.right <= width && label.bottom <= height && label.width > 0 && label.height > 0 && label.fontSize >= 26);
        assert.equal(await page.locator(".ui-camera-clip").evaluate(element => getComputedStyle(element).overflow), "hidden");
        assert.equal(await page.locator(".ui-demo-stage").evaluate(element => getComputedStyle(element).overflow), "visible");
        assert.match(await page.locator('[data-ui-element="code"]').evaluate(element => getComputedStyle(element).fontFamily), /monospace/);
        if (process.env.STUDIO_REACTIVE_PROOF_DIR) await page.screenshot({ path: join(directory, `${directed ? "directed-" : ""}${width}x${height}-${frame === 29 ? "before" : frame === 45 ? "typing" : "after"}.png`) });
      }
    } finally { await page.close(); await server.close(); }
    await inspectMotionProject(plan, directory, project);
  }
});
