import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { compileResearch, researchProduct, researchRequest, researchTemporalClaimIssues, stageDigest, validateResearch } from "./research";
import { researchResponseDiagnostics, RESEARCH_RETRY_PATH } from "./research-review";
import { assembleUiLiteralReview, createUiLiteralSeed, UI_LITERAL_REVIEW_VERSION } from "./ui-literal-seed";
import { compileUiDocuments } from "./ui-reconstruction";
import { compileScript, launchOpeningIssues, scriptRequest } from "./scripting";
import { compileScriptWithRetry, scriptCorrectionDiagnostics, SCRIPT_RETRY_PATH } from "./script-review";
import { compilePlan, validateTimeline } from "./planning";
import { expectedUiState } from "./ui-state";
import { workflowInputReserve, workflowOutputLimit, workflowSceneLimit } from "./workflow-coherence";
import type { Providers } from "./providers";
import { PipelineError, type Evidence, type Hooks, type WorkerInput } from "./types";

const input: WorkerInput = { jobId: "grounded-preview", ownerId: "fixture", mode: "url", productUrl: "https://example.com/", videoType: "launch", format: "16:9", files: [], budgets: { maxModelCalls: 10, maxModelInputTokens: 200000, maxModelOutputTokens: 30000 } };
const prior = { version: 3 as const, singleTarget: true as const, workflowSelection: true as const, appliedViewProof: true as const };
const fresh = { ...prior, sourceTemporalClaims: true as const };
const identity = "a".repeat(64), code = "unsupported_research_temporal_qualifier";
const hooks: Hooks = { persist: async () => {}, state: async () => {}, complete: async () => {} };
const claim = (text: string) => ({ text, basis: "explicit" as const, evidenceIds: ["fact-1"] });
function fixture() {
  const evidence: Evidence = { text: "Create message templates using named properties and preview their greetings. Try the editor.\n\nPublish a public page instantly.", assets: [{ id: "editor", path: "assets/editor.png", kind: "image", usage: "output", width: 1000, height: 600, rights: "Synthetic test fixture" }], uiSources: [{ id: "editor-ui", assetId: "editor", basis: "dom", context: "marketing-example", width: 1000, height: 600, limitations: ["One public static state."], elements: [
    { id: "name", text: "name = 'Ada',", rect: { x: .05, y: .2, width: .36, height: .06 }, selector: ":scope > pre > div:nth-of-type(1)", codeContainer: ":scope > pre" },
    { id: "template", text: "Hello {name},", rect: { x: .05, y: .4, width: .36, height: .06 }, selector: ":scope > pre > div:nth-of-type(2)", codeContainer: ":scope > pre" },
    { id: "greeting", text: "Hello Ada,", rect: { x: .55, y: .4, width: .36, height: .06 }, selector: ":scope > aside > p" },
    { id: "context", text: "Welcome message", rect: { x: .55, y: .2, width: .36, height: .06 }, selector: ":scope > aside > h2" },
  ].map(element => ({ ...element, role: "text" as const, style: { fontSize: 18, fontWeight: "400", color: "#eeeeee", backgroundColor: "transparent", effectiveBackgroundColor: "#111111", borderRadius: 0 } })) }] };
  const raw = { sufficientEvidence: true, reason: "Static correspondence supports an illustrative greeting edit.", product: "Example", summary: "A name edit and its matching greeting.", facts: [{ evidenceId: "fact-1", kind: "feature", label: "Template authoring" }, { evidenceId: "fact-2", kind: "feature", label: "Publication" }], visuals: [{ assetId: "editor", description: "Named property, template and matching greeting", role: "product_ui", showsProductUi: true, supportsFactIds: ["fact-1"] }], story: { primaryAudience: claim("Developers"), problem: { ...claim("Check the greeting's name"), basis: "inferred" }, mechanism: { ...claim("Edit a template name"), steps: [{ action: "Edit the name", evidenceId: "fact-1", assetId: "editor" }] }, outcome: claim("The greeting matches the name"), differentiator: null, cta: claim("Try the editor") }, documentTargets: [{ id: "greeting-edit", sourceAssetIds: ["editor"], capabilityFactIds: ["fact-1"], goal: "Illustrate a name edit and its matching greeting.", workflow: { version: 1, observedStart: { sourceAssetId: "editor", description: "Static code, template and a matching greeting" }, actions: [{ kind: "type", control: "name = 'Ada',", sourceAssetId: "editor", sourceElementId: "name", evidenceId: "fact-1" }], result: { kind: "reactive-preview", sourceAssetId: "editor", surface: "Hello Ada,", change: "The greeting uses the illustrated replacement name", basis: "illustrative", evidenceId: "fact-1", contentDerivation: { kind: "literal-preview", sourceAssetId: "editor", codeText: "name = 'Ada',", propertyName: "name", beforeLiteral: "Ada", afterLiteral: "Mina", templateText: "Hello {name},", outputBefore: "Hello Ada,", outputAfter: "Hello Mina,", context: ["Welcome message"] } } } }], limitations: ["No performed interaction or live preview timing was observed."] };
  return { evidence, raw };
}
const compile = (f: ReturnType<typeof fixture>) => compileResearch(input, f.evidence, f.raw, identity, fresh);
async function workspace(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "research-grounding-")); await mkdir(join(root, "assets")); await mkdir(join(root, "analysis"));
  await writeFile(join(root, "assets/editor.png"), "Offline source identity; no image interpretation is performed here.");
  t.after(async () => { assert.equal(dirname(resolve(root)), resolve(tmpdir())); assert.ok(root.startsWith(join(tmpdir(), "research-grounding-"))); await rm(root, { recursive: true, force: true }); });
  return root;
}

test("fresh timing claims bind each exact field to its own canonical passages, not another product capability", () => {
  const f = fixture();
  // The v18 failure shape: an observed static correspondence was called live/instant.
  f.raw.reason = "The source supports live preview.";
  f.raw.summary = "Edit with instant rendered preview.";
  f.raw.story.mechanism.text = "Edit with instant rendered preview";
  f.raw.story.mechanism.steps[0].action = "The preview updates immediately";
  f.raw.documentTargets[0].goal = "See the preview update instantly.";
  f.raw.documentTargets[0].workflow.result.change = "The preview updates in real time";
  const before = JSON.stringify(f), historical = compileResearch(input, f.evidence, f.raw, identity, prior);
  const expected = [["reason"], ["summary"], ["story", "mechanism", "text"], ["story", "mechanism", "steps", 0, "action"], ["documentTargets", 0, "goal"], ["documentTargets", 0, "workflow", "result", "change"]];
  assert.deepEqual(researchTemporalClaimIssues(historical).map(issue => issue.path), expected);
  let rejected: PipelineError | undefined;
  try { compile(f); } catch (error) { assert.ok(error instanceof PipelineError && error.message.includes(code)); rejected = error; }
  assert.ok(rejected);
  assert.deepEqual(researchResponseDiagnostics(f.raw, f.evidence, rejected, true, true, true, true, true), expected.map(path => ({ code, path })));
  assert.deepEqual(researchResponseDiagnostics(f.raw, f.evidence, rejected, true, true, true, true), [{ code: "binding_constraint", path: [] }]);
  assert.equal(JSON.stringify(f), before);
  // The new internal option does not reinterpret any old raw or saved research contract.
  assert.deepEqual(compileResearch(input, f.evidence, f.raw, identity, prior), historical);
  validateResearch(historical, input, f.evidence, identity);
  assert.equal(stageDigest(historical), stageDigest(compileResearch(input, f.evidence, f.raw, identity, prior)));
});

test("qualifier families require their own bound passage; live names/events and copied example text are not globally banned", () => {
  const f = fixture();
  f.evidence.text = "Create templates with a live preview that renders instantly and updates immediately. Try the editor.\n\nPublish a public page instantly.";
  f.raw.story.mechanism.text = "Edit with live preview"; f.raw.story.mechanism.steps[0].action = "Preview renders instantly";
  f.raw.documentTargets[0].workflow.result.change = "The greeting updates immediately";
  assert.deepEqual(researchTemporalClaimIssues(compile(f)), []);
  const isolated = fixture(); isolated.raw.product = "Instant"; isolated.raw.reason = "Go live with a message for live events.";
  isolated.raw.summary = "Live chat is the editorial topic, not a preview-speed promise.";
  assert.deepEqual(researchTemporalClaimIssues(compile(isolated)), []);
  const wrongFamily = fixture(); wrongFamily.evidence.text = "Create templates with immediate preview updates. Try the editor.\n\nPublish a page instantly.";
  wrongFamily.raw.story.mechanism.text = "Instant preview";
  assert.throws(() => compile(wrongFamily), error => error instanceof PipelineError && error.message.includes(code));
  const unselected = fixture(); unselected.raw.story.mechanism.text = "Instant preview";
  // Adding the word to a fact label, a limitation or unbound source text is insufficient.
  unselected.raw.facts[0].label = "Instant template authoring"; unselected.raw.limitations.push("Another feature publishes instantly.");
  assert.throws(() => compile(unselected), error => error instanceof PipelineError && error.message.includes(code));
  const lexicalOnly = fixture(); lexicalOnly.evidence.text = "Preview is not instant; unrelated publication is instant. Create templates. Try the editor."; lexicalOnly.raw.facts.pop(); lexicalOnly.raw.story.mechanism.text = "Instant preview";
  assert.deepEqual(researchTemporalClaimIssues(compile(lexicalOnly)), [], "word eligibility does not replace independent semantic review");
});

test("fresh production spends only its existing single correction for timing claims and restores the completed stage without another call", async t => {
  const root = await workspace(t), f = fixture(), bad = structuredClone(f.raw); bad.story.mechanism.text = "Edit with instant rendered preview";
  const calls: string[] = [], qualityCalls = Math.ceil(workflowSceneLimit() / 2);
  const reserve = { calls: 3 + qualityCalls, inputTokens: workflowInputReserve(), outputTokens: 11000 + qualityCalls * 3000 + workflowOutputLimit() };
  const providers = { ledger: { modelCalls: 1, inputTokens: 500, outputTokens: 300, reservedInputTokens: 0, reservedOutputTokens: 0 },
    claude: async (_purpose: string, _prompt: string, _images: unknown, options: unknown) => { calls.push("initial"); assert.deepEqual(options, { policy: "research-v2", reserve }); return bad; },
    prepareClaude: async (_purpose: string, prompt: string, _images: unknown, options: unknown) => { assert.match(prompt, /unsupported_research_temporal_qualifier/); assert.match(prompt, /\["story","mechanism","text"\]/); assert.deepEqual(options, { policy: "research-v2", reserve }); return async () => { calls.push("correction"); return f.raw; }; },
  } as unknown as Providers;
  const result = await researchProduct(input, f.evidence, providers, hooks, root);
  assert.deepEqual(calls, ["initial", "correction"]); assert.equal(result.story!.mechanism!.text, f.raw.story.mechanism.text);
  const marker = JSON.parse(await readFile(join(root, RESEARCH_RETRY_PATH), "utf8"));
  assert.equal(marker.status, "completed"); assert.equal(marker.outcome, "valid"); assert.deepEqual(marker.diagnostics, [{ code, path: ["story", "mechanism", "text"] }]);
  assert.deepEqual(await researchProduct(input, f.evidence, providers, hooks, root), result); assert.deepEqual(calls, ["initial", "correction"]);
});

test("a compact source-bound edit advances the changed greeting without trimming the compiler's result or reading holds", async t => {
  const f = fixture(), research = compileResearch(input, f.evidence, f.raw, identity, { version: 3, singleTarget: true, workflowSelection: true, sourceTemporalClaims: true }), seed = createUiLiteralSeed(research, f.evidence, research.documentTargets![0])!; assert.ok(seed);
  const document = assembleUiLiteralReview({ transportVersion: UI_LITERAL_REVIEW_VERSION, seedSha256: seed.sha256, sufficientEvidence: true, reason: "Synthetic source correspondence", presentation: [] }, seed, research, f.evidence, research.documentTargets![0]);
  const stage = compileUiDocuments({ sufficientEvidence: true, reason: "Synthetic source correspondence", documents: [document] }, input, f.evidence, research, { requireLaunchResult: true }), ui = { documents: stage.documents, sha256: stageDigest(stage) };
  const shot = (storyRole: string, headline: string, template: string, job: string, motion: string, durationSeconds: number, visual?: unknown) => ({ storyRole, assetId: "editor", evidenceId: "fact-1", headline, detail: "", durationSeconds, sourceInSeconds: 0, preserveAudio: false, purpose: "Synthetic source-bound comparison", referenceTechnique: "Existing supported motion", direction: { job, motion }, presentation: { template, theme: "dark", transition: "cut", ...(visual ? { visual } : {}) } });
  const actions = (delayed: boolean) => [{ kind: "type" as const, targetId: "name", text: "name = 'Mina',", atFrame: delayed ? 60 : 30, durationFrames: delayed ? 54 : 24, evidenceId: "fact-1" }, { kind: "state" as const, stateId: "seed-illustrative", atFrame: delayed ? 150 : 54, durationFrames: 1, evidenceId: "fact-1" }];
  const draft = (slow: boolean) => ({ sufficientEvidence: true, reason: "Supported illustrative edit", product: "Example", summary: "One edit and matching greeting", accent: "#111111", background: "dark", musicPrompt: "An original instrumental pulse with a readable result hold", sfxPrompt: "One restrained interface accent", assumptions: ["Offline counterfactual; not a model-generated acceptance."], creativeDirection: { concept: "focus", evidenceId: "fact-1" }, scenes: [
    shot("problem", "Wrong name?", "hook", "hook", "reveal", slow ? 3 : 2),
    ...(slow ? [shot("product", "Example templates", "proof", "context", "reveal", 3.5, { kind: "showcase" })] : []),
    shot("mechanism", "Example: edit the name", "proof", "action", "focus", slow ? 9 : 2, { kind: "ui-demo", documentId: document.id, actions: actions(slow) }),
    shot("outcome", "The greeting matches", "features", "payoff", "reveal", slow ? 3.5 : 2),
    shot("cta", "Try the editor", "cta", "cta", "hold", slow ? 5 : 2),
  ] });
  const slowRaw = draft(true), fastRaw = draft(false), before = JSON.stringify(fastRaw);
  const slowScript = compileScript(slowRaw, input, f.evidence, research, undefined, ui, { requireDirection: true, requireSourceSpeedQualifiers: true });
  const fastScript = compileScript(fastRaw, input, f.evidence, research, undefined, ui, { requireDirection: true, requireSourceSpeedQualifiers: true });
  const slow = await compilePlan(input, f.evidence, slowScript, hooks, await workspace(t)), fast = await compilePlan(input, f.evidence, fastScript, hooks, await workspace(t));
  const slowUi = slow.scenes.find(scene => scene.presentation?.visual?.kind === "ui-demo")!, fastUi = fast.scenes.find(scene => scene.presentation?.visual?.kind === "ui-demo")!;
  assert.deepEqual({ slow: { start: slowUi.start_frame, firstAction: slowUi.start_frame + 60, result: slowUi.start_frame + 151, duration: slow.output.duration_frames }, fast: { start: fastUi.start_frame, firstAction: fastUi.start_frame + 30, result: fastUi.start_frame + 55, duration: fast.output.duration_frames } }, { slow: { start: 199, firstAction: 259, result: 350, duration: 724 }, fast: { start: 94, firstAction: 124, result: 149, duration: 425 } }, "compiled frame positions include required reading/entrance/result holds, not just requested seconds");
  assert.ok(fastUi.start_frame + 55 < slowUi.start_frame + 151 - 120, "the changed value arrives over four seconds earlier");
  assert.ok(fast.output.duration_frames < slow.output.duration_frames); assert.ok(fast.scenes.at(-1)!.duration_frames > 60, "short requests never truncate CTA reading/entrance");
  assert.ok(fastUi.shotDirection!.resultHold!.endFrame - fastUi.shotDirection!.resultHold!.startFrame >= 45);
  assert.deepEqual(validateTimeline(fast), []); assert.equal(JSON.stringify(fastRaw), before);
  assert.equal(expectedUiState(document, actions(false), 54).elements.greeting.text, "Hello Ada,");
  assert.equal(expectedUiState(document, actions(false), 55).elements.greeting.text, "Hello Mina,");
  assert.equal(fastScript.workflowCoherence, undefined, "offline compilation does not forge the still-required paid semantic approval");
  const prompt = scriptRequest(input, f.evidence, research, undefined, ui, true);
  assert.match(prompt, /first proof beat must perform the meaningful operation/); assert.match(prompt, /not a claim of actual live latency/); assert.match(prompt, /compiler extends it for every visible word/);
  assert.doesNotMatch(prompt, /optional 36-frame gap/);
  assert.match(researchRequest(input, f.evidence).prompt, /Authoring does not demonstrate delivery/);

  const openingCode = "launch_action_after_static_setup", freshScript = { requireDirection: true, requireSourceSpeedQualifiers: true, requireEarlyLaunchAction: true };
  const bumper = draft(true); bumper.scenes[1].durationSeconds = 3; bumper.scenes[1].presentation = { template: "brand", theme: "dark", transition: "cut" };
  const originalBumper = JSON.stringify(bumper), historical = compileScript(bumper, input, f.evidence, research, undefined, ui, { requireDirection: true });
  await t.test("fresh v19-shaped hook3s plus brand3s fails while the same early UI actions and safe holds remain valid", () => {
    assert.deepEqual(launchOpeningIssues(historical.scenes), [{ code: openingCode, path: ["scenes", 1], firstActionableSceneIndex: 2 }]);
    let error: PipelineError | undefined;
    try { compileScript(bumper, input, f.evidence, research, undefined, ui, freshScript); } catch (caught) { assert.ok(caught instanceof PipelineError && caught.message.includes(openingCode)); error = caught; }
    assert.ok(error);
    assert.deepEqual(scriptCorrectionDiagnostics(bumper, error, research, f.evidence, ui, true, true).openingIssues, launchOpeningIssues(historical.scenes));
    assert.deepEqual(compileScript(fastRaw, input, f.evidence, research, undefined, ui, freshScript), fastScript);
    assert.equal(JSON.stringify(bumper), originalBumper); assert.equal(stageDigest(compileScript(bumper, input, f.evidence, research, undefined, ui, { requireDirection: true })), stageDigest(historical));
    assert.deepEqual(launchOpeningIssues([fastScript.scenes[1]]), [], "an already-actionable opener is not forced to wait for another beat");
    assert.deepEqual(launchOpeningIssues([{ presentation: { visual: { kind: "ui-demo", actions: [{ kind: "pointer" }] } } }]), [{ code: openingCode, path: ["scenes", 1], firstActionableSceneIndex: null }]);
    const pointer = draft(false); pointer.scenes[1].presentation.visual = { kind: "ui-demo", documentId: document.id, actions: [{ kind: "pointer", atFrame: 30, durationFrames: 18, targetId: "name", evidenceId: "fact-1" }] };
    assert.throws(() => compileScript(pointer, input, f.evidence, research, undefined, ui, freshScript), /supported UI action|creative concept/);
    const unchanged = draft(false); unchanged.scenes[1].presentation.visual = { kind: "ui-demo", documentId: document.id, actions: [{ kind: "state", atFrame: 30, durationFrames: 1, stateId: "seed-observed", evidenceId: "fact-1" }] };
    assert.throws(() => compileScript(unchanged, input, f.evidence, research, undefined, ui, freshScript), /ineffective|creative concept/);
  });

  await t.test("launch repairs preserve an early parent without upgrading historical delayed or feature-demo parents", async () => {
    const earlyFive = draft(true), context = earlyFive.scenes.splice(1, 1)[0]; earlyFive.scenes.splice(3, 0, context);
    const parentScript = compileScript(earlyFive, input, f.evidence, research, undefined, ui, freshScript);
    const parent = await compilePlan(input, f.evidence, parentScript, hooks, await workspace(t)), parentHash = stageDigest(parent);
    const repair = { plan: parent, findings: [] };
    assert.throws(() => compileScript(bumper, input, f.evidence, research, repair, ui), error => error instanceof PipelineError && error.message.includes(openingCode));
    assert.deepEqual(launchOpeningIssues(compileScript(earlyFive, input, f.evidence, research, repair, ui).scenes), []);
    assert.equal(stageDigest(parent), parentHash);
    const delayedParent = await compilePlan(input, f.evidence, historical, hooks, await workspace(t)), delayedHash = stageDigest(delayedParent);
    assert.equal(stageDigest(compileScript(bumper, input, f.evidence, research, { plan: delayedParent, findings: [] }, ui)), stageDigest(historical));
    assert.equal(stageDigest(delayedParent), delayedHash);
    assert.equal(launchOpeningIssues(compileScript(bumper, { ...input, videoType: "feature-demo" }, f.evidence, research, repair, ui).scenes)[0].firstActionableSceneIndex, 2);
  });

  await t.test("opening rejection uses the same single durable script correction and exact existing reserve", async () => {
    const root = await workspace(t), events: string[] = [];
    const providers = { ledger: { modelCalls: 3, inputTokens: 30000, outputTokens: 4000, reservedInputTokens: 0, reservedOutputTokens: 0 }, prepareClaude: async (_purpose: string, prompt: string, _images: unknown, options: { reserve: unknown }) => {
      assert.match(prompt, /launch_action_after_static_setup/); assert.match(prompt, /firstActionableSceneIndex":2/);
      assert.deepEqual(options.reserve, { calls: 3, inputTokens: 0, outputTokens: 9000 });
      return async () => { events.push("corrected response"); return fastRaw; };
    } } as unknown as Providers;
    const options = { input, evidence: f.evidence, research, workspace: root, providers, hooks, prompt, ui, directed: true, requireEarlyLaunchAction: true };
    const corrected = await compileScriptWithRetry(bumper, options);
    assert.deepEqual(corrected, fastScript); assert.deepEqual(events, ["corrected response"]); assert.equal(corrected.workflowCoherence, undefined, "production still separately requires its semantic review");
    const marker = JSON.parse(await readFile(join(root, SCRIPT_RETRY_PATH), "utf8")); assert.equal(marker.status, "completed"); assert.equal(marker.outcome, "valid");
    await assert.rejects(compileScriptWithRetry(bumper, options), /correction is already consumed/); assert.deepEqual(events, ["corrected response"]);
    await assert.rejects(compileScriptWithRetry(bumper, { ...options, repair: {} as never }), /repair cannot acquire/);
    assert.equal(JSON.stringify(bumper), originalBumper);
  });
});
