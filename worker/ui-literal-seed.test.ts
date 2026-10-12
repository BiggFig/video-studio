import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { readFileSync } from "node:fs";
import { assembleUiLiteralReview, createUiLiteralSeed, UI_LITERAL_REVIEW_VERSION, uiLiteralReviewRequest, type UiLiteralSeed } from "./ui-literal-seed";
import { compileResearch, stageDigest } from "./research";
import { buildUiDocuments, compileUiDocuments, loadUiDocuments, validateUiBundle, validateUiDocuments, type UiDocumentDependencies } from "./ui-reconstruction";
import { constrainedUiSchema, UI_TRANSPORT_VERSION } from "./model-format";
import { inspectUiDocumentLayout } from "./ui-document-layout";
import { expectedUiState } from "./ui-state";
import type { UiSource } from "./ui-sources";
import { PipelineError, type Evidence, type Hooks, type WorkerInput } from "./types";
import type { Providers } from "./providers";
import { literalPreviewCandidates } from "./literal-preview-candidates";

// Exact relevant strings and source regions from the retained v15 public
// Resend panel. The fact passage is synthetic and makes no production claim.
const source: UiSource = { id: "ui-editor", assetId: "editor", basis: "dom", context: "marketing-example", width: 1030, height: 651, limitations: ["One public static state."], elements: [
  { id: "element-1", role: "text", text: "username = 'Steve',", rect: { x: .0447, y: .1246, width: .1468, height: .02 }, selector: ":scope > pre > div:nth-of-type(2)", codeContainer: ":scope > pre" },
  { id: "element-5", role: "text", text: "Hello {username},", rect: { x: .0447, y: .74, width: .2027, height: .02 }, selector: ":scope > pre > div:nth-of-type(5)", codeContainer: ":scope > pre" },
  { id: "element-10", role: "text", text: "Hello Steve,", rect: { x: .5631, y: .3686, width: .3689, height: .0369 }, selector: ":scope > aside > p" },
  { id: "element-17", role: "text", text: "const WelcomeEmail = ({", rect: { x: .0447, y: .1, width: .1608, height: .02 }, selector: ":scope > pre > div:nth-of-type(1)", codeContainer: ":scope > pre" },
  { id: "element-7", role: "text", text: "company = 'ACME',", rect: { x: .0447, y: .1492, width: .1328, height: .02 }, selector: ":scope > pre > div:nth-of-type(3)", codeContainer: ":scope > pre" },
  { id: "element-2", role: "text", text: "Welcome to ACME, user!", rect: { x: .5631, y: .2708, width: .3689, height: .0517 }, selector: ":scope > aside > h1" },
  { id: "element-11", role: "text", text: "Welcome to <strong>{company}</strong>, {username}!", rect: { x: .0447, y: .6662, width: .4335, height: .02 }, selector: ":scope > pre > div:nth-of-type(4)", codeContainer: ":scope > pre" },
].map(element => ({ ...element, role: "text" as const, style: { fontSize: element.id === "element-2" ? 24 : element.id === "element-10" ? 14 : 12, fontWeight: "400", color: "#ebeced", backgroundColor: "transparent", effectiveBackgroundColor: "#101010", borderRadius: 0 } })) };

function fixture() {
  const input: WorkerInput = { jobId: "literal-seed", ownerId: "fixture", mode: "url", productUrl: "https://mail.example/", videoType: "launch", format: "16:9", files: [], budgets: { maxModelCalls: 10, maxModelInputTokens: 200000, maxModelOutputTokens: 30000 } };
  const evidence: Evidence = { text: "Developers can author an email template and preview changes automatically. Try the editor.", assets: [{ id: "editor", path: "assets/editor.png", kind: "image", usage: "output", rights: "Public source transcription and synthetic test capability", width: 1030, height: 651 }], uiSources: [structuredClone(source)] };
  const claim = (text: string) => ({ text, basis: "explicit", evidenceIds: ["fact-1"] });
  const research = compileResearch(input, evidence, { sufficientEvidence: true, reason: "Static literal correspondence supports an illustrative edit", product: "Email editor", summary: "Preview a name edit", facts: [{ evidenceId: "fact-1", kind: "feature", label: "Template authoring" }], visuals: [{ assetId: "editor", description: "Code and matching preview", role: "product_ui", showsProductUi: true, supportsFactIds: ["fact-1"] }], story: { primaryAudience: claim("Developers"), problem: null, mechanism: { ...claim("Edit the name"), steps: [{ action: "Edit the name", evidenceId: "fact-1", assetId: "editor" }] }, outcome: claim("Preview the greeting"), differentiator: null, cta: claim("Try the editor") }, documentTargets: [{ id: "greeting", sourceAssetIds: ["editor"], capabilityFactIds: ["fact-1"], goal: "Illustrate one name edit and matching greeting.", workflow: { version: 1, observedStart: { sourceAssetId: "editor", description: "Static code and matching greeting" }, actions: [{ kind: "type", control: "username = 'Steve',", sourceAssetId: "editor", sourceElementId: "element-1", evidenceId: "fact-1" }], result: { kind: "reactive-preview", sourceAssetId: "editor", surface: "Hello Steve,", change: "The declared literal appears in the greeting", basis: "illustrative", evidenceId: "fact-1", contentDerivation: { kind: "literal-preview", sourceAssetId: "editor", codeText: "username = 'Steve',", propertyName: "username", beforeLiteral: "Steve", afterLiteral: "Alex", templateText: "Hello {username},", outputBefore: "Hello Steve,", outputAfter: "Hello Alex,", context: ["const WelcomeEmail = ({", "company = 'ACME',", "Welcome to ACME, user!"] } } } }], limitations: ["Illustrative substitution; no executed or authenticated session."] }, "a".repeat(64), { version: 3, workflowSelection: true });
  const target = research.documentTargets![0];
  return { input, evidence, research, target };
}
const reviewFor = (seed: UiLiteralSeed) => ({ transportVersion: UI_LITERAL_REVIEW_VERSION, seedSha256: seed.sha256, sufficientEvidence: true, reason: "The source supports this illustrative correspondence.", presentation: seed.slots.map(slot => ({ slotId: slot.id, color: slot.property === "color" ? "#ebeced" : slot.allowTransparent ? "transparent" : "#101010" })) });
const hooks: Hooks = { persist: async () => {}, state: async () => {}, complete: async () => {} };
async function workspace(t: TestContext) { const base = await realpath(tmpdir()), path = await mkdtemp(join(base, "studio-ui-seed-")); await mkdir(join(path, "analysis")); t.after(async () => { const rel = relative(base, await realpath(path)); assert.ok(!isAbsolute(rel) && !rel.startsWith("..") && rel.startsWith("studio-ui-seed-")); await rm(path, { recursive: true, force: true }); }); return path; }
const passedLayout: NonNullable<UiDocumentDependencies["inspectLayout"]> = async (_documents, options) => { const reportPath = `analysis/${options.reportName}.json`; await writeFile(join(options.workspace, reportPath), JSON.stringify({ passed: true, issues: [] })); return { passed: true, reportPath, artifactPaths: [reportPath], issues: [] }; };
function counterfactualV16Fixture() {
  const captured: UiSource = JSON.parse(readFileSync(new URL("../tests/fixtures/resend-v16-ui-source.json", import.meta.url), "utf8")), f = fixture();
  f.evidence.uiSources = [captured]; f.evidence.assets[0].id = captured.assetId;
  f.research.visuals[0].assetId = captured.assetId; f.research.story!.mechanism!.steps[0].assetId = captured.assetId;
  f.target.sourceAssetIds = [captured.assetId]; f.target.workflow!.observedStart.sourceAssetId = captured.assetId; f.target.workflow!.actions[0].sourceAssetId = captured.assetId; f.target.workflow!.result.sourceAssetId = captured.assetId; f.target.workflow!.result.contentDerivation!.sourceAssetId = captured.assetId;
  return { ...f, captured, candidate: literalPreviewCandidates([captured])[0] };
}

test("exact v15 source bindings seed each string once, preserve its real region and change only code/output", () => {
  const f = fixture(), before = JSON.stringify(f), seed = createUiLiteralSeed(f.research, f.evidence, f.target)!;
  assert.ok(seed); assert.equal(seed.slots.length, 0);
  const document = assembleUiLiteralReview(reviewFor(seed), seed, f.research, f.evidence, f.target);
  validateUiDocuments([document], f.research, f.evidence);
  assert.equal(document.elements.filter(element => element.text === "Welcome to ACME, user!").length, 1);
  assert.deepEqual(document.elements.find(element => element.id === "element-2")!.sourceRect, source.elements.find(element => element.id === "element-2")!.rect);
  assert.equal(document.elements.some(element => element.id === "element-11"), false);
  assert.deepEqual(document.previewBinding!.contextElementIds, ["element-17", "element-7", "element-2"]);
  assert.deepEqual(document.states[1].textValues.map(value => [value.elementId, value.text, value.textBasis]), [["element-1", "username = 'Alex',", "example-content"], ["element-10", "Hello Alex,", "example-content"]]);
  assert.deepEqual(document.states[0].visibleElementIds, document.states[1].visibleElementIds);
  assert.ok(document.styles.every(style => style.fill !== "#ffffff"));
  assert.equal(JSON.stringify(f), before);
  const compiled = compileUiDocuments({ sufficientEvidence: true, reason: "Reviewed source seed", documents: [document] }, f.input, f.evidence, f.research, { requireLaunchResult: true });
  validateUiBundle({ documents: compiled.documents, sha256: stageDigest(compiled) }, f.input, f.evidence, f.research);
  const actions = [{ kind: "type" as const, targetId: "element-1", text: "username = 'Alex',", atFrame: 30, durationFrames: 30, evidenceId: "fact-1" }, { kind: "state" as const, stateId: "seed-illustrative", atFrame: 60, durationFrames: 1, evidenceId: "fact-1" }];
  assert.equal(expectedUiState(document, actions, 0).elements["element-10"].text, "Hello Steve,");
  assert.equal(expectedUiState(document, actions, 61).elements["element-10"].text, "Hello Alex,");
  assert.equal(expectedUiState(document, actions, 0).elements["element-10"].text, "Hello Steve,");
});

test("a review cannot rewrite locked content, wrong source regions, styles, states or seed identity", () => {
  const f = fixture(), seed = createUiLiteralSeed(f.research, f.evidence, f.target)!, review = reviewFor(seed), document = assembleUiLiteralReview(review, seed, f.research, f.evidence, f.target);
  for (const raw of [{ ...review, seedSha256: "b".repeat(64) }, { ...review, elements: [] }, { ...review, presentation: [{ slotId: "seed-style-0-fill", color: "#ffffff" }] }, { ...review, transportVersion: UI_TRANSPORT_VERSION }]) assert.throws(() => assembleUiLiteralReview(raw, seed, f.research, f.evidence, f.target), PipelineError);
  for (const mutate of [
    (d: typeof document) => { d.elements.find(element => element.id === "element-2")!.sourceRect = source.elements.find(element => element.id === "element-11")!.rect; },
    (d: typeof document) => { d.elements.push({ ...d.elements.find(element => element.id === "element-2")!, id: "duplicate-heading" }); },
    (d: typeof document) => { d.styles[0].fill = "#ffffff"; },
    (d: typeof document) => { d.states[1].textValues[1].text = "An invented result"; },
    (d: typeof document) => { d.elements[1].rect.x += .01; },
  ]) { const changed = structuredClone(document); mutate(changed); assert.throws(() => validateUiDocuments([changed], f.research, f.evidence), PipelineError); }
  const changedSeed = structuredClone(seed); changedSeed.observed[0].text = "wrong";
  assert.throws(() => assembleUiLiteralReview(review, changedSeed, f.research, f.evidence, f.target), PipelineError);
  const changedEvidence = structuredClone(f.evidence); changedEvidence.uiSources![0].elements[0].style!.color = "#ffffff";
  assert.throws(() => validateUiDocuments([document], f.research, changedEvidence), PipelineError);
});

test("only genuinely unknown colors become independent exact review slots; conflicting known backdrops never do", () => {
  const f = fixture(); for (const element of f.evidence.uiSources![0].elements) { delete element.style!.backgroundColor; delete element.style!.effectiveBackgroundColor; if (!element.codeContainer) delete element.style!.color; }
  const seed = createUiLiteralSeed(f.research, f.evidence, f.target)!; assert.ok(seed); assert.ok(seed.slots.length > 0);
  const panelSlots = seed.slots.filter(slot => !slot.allowTransparent && slot.property === "fill"); assert.equal(panelSlots.length, 2, "unknown panes do not acquire a false shared color");
  const review = reviewFor(seed), document = assembleUiLiteralReview(review, seed, f.research, f.evidence, f.target); validateUiDocuments([document], f.research, f.evidence);
  for (const presentation of [review.presentation.slice(1), [...review.presentation, review.presentation[0]], review.presentation.map((value, index) => index === 0 ? { ...value, slotId: "undeclared" } : value), review.presentation.map(value => panelSlots.some(slot => slot.id === value.slotId) ? { ...value, color: "transparent" } : value)]) assert.throws(() => assembleUiLiteralReview({ ...review, presentation }, seed, f.research, f.evidence, f.target), PipelineError);
  const conflict = fixture(); conflict.evidence.uiSources![0].elements[0].style!.effectiveBackgroundColor = "#ffffff"; assert.equal(createUiLiteralSeed(conflict.research, conflict.evidence, conflict.target), undefined);
  const mixed = fixture(); delete mixed.evidence.uiSources![0].elements[0].style!.effectiveBackgroundColor; assert.equal(createUiLiteralSeed(mixed.research, mixed.evidence, mixed.target), undefined);
});

test("missing or ambiguous source inventory never manufactures a seed; refusal cannot carry choices", () => {
  const f = fixture(); const seed = createUiLiteralSeed(f.research, f.evidence, f.target)!;
  assert.throws(() => assembleUiLiteralReview({ ...reviewFor(seed), sufficientEvidence: false }, seed, f.research, f.evidence, f.target), (error: unknown) => error instanceof PipelineError && error.code === "insufficient_product_evidence");
  assert.equal(createUiLiteralSeed(f.research, { ...f.evidence, uiSources: [] }, f.target), undefined);
  const ambiguous = structuredClone(f.evidence); ambiguous.uiSources![0].elements.push({ ...ambiguous.uiSources![0].elements.find(element => element.id === "element-2")!, id: "another-heading", rect: { x: .2, y: .8, width: .2, height: .1 } });
  assert.equal(createUiLiteralSeed(f.research, ambiguous, f.target), undefined);
  const wrong = structuredClone(f.target); wrong.workflow!.actions[0].sourceElementId = "element-11"; assert.equal(createUiLiteralSeed(f.research, f.evidence, wrong), undefined);
});

test("v16 nested and repeated ACME records are never proposed as context; the complete source-backed seed remains selectable", () => {
  const f = fixture(), s = f.evidence.uiSources![0];
  // Exact extra regions recorded by the v16 capture. Both are inline emphasis,
  // and the heading's complete text already supplies its relevant context.
  s.elements.push(
    { id: "element-8", role: "text", text: "ACME", selector: ":scope > aside > h1 > strong", rect: { x: .7454, y: .2754, width: .0686, height: .0415 }, style: { fontSize: 24, fontWeight: "700", backgroundColor: "transparent" } },
    { id: "element-19", role: "text", text: "ACME", selector: ":scope > aside > div > p > strong", rect: { x: .7914, y: .4363, width: .04, height: .0246 }, style: { fontSize: 14, fontWeight: "700", backgroundColor: "transparent" } },
  );
  const before = JSON.stringify(s), candidate = literalPreviewCandidates([s])[0];
  assert.deepEqual(candidate.contextChoices.map(choice => choice.text), ["const WelcomeEmail = ({", "company = 'ACME',", "Welcome to ACME, user!"]);
  assert.equal(JSON.stringify(s), before);
  const seed = createUiLiteralSeed(f.research, f.evidence, f.target)!; assert.ok(seed);
  const reviewed = assembleUiLiteralReview(reviewFor(seed), seed, f.research, f.evidence, f.target); validateUiDocuments([reviewed], f.research, f.evidence);
  assert.ok(reviewed.sourceSeed); assert.equal(seed.slots.length, 0, "all captured known styles stay locked rather than becoming model overrides");
  assert.deepEqual(seed.observed.map(record => record.style), ["element-1", "element-5", "element-10", "element-17", "element-7", "element-2"].map(id => s.elements.find(element => element.id === id)!.style));
  const unsupported = structuredClone(f.target); unsupported.workflow!.result.contentDerivation!.context.push("ACME");
  assert.equal(createUiLiteralSeed(f.research, f.evidence, unsupported), undefined, "completed v16 witness is not silently pruned or repaired");
});

test("counterfactual fresh witness from the full unchanged v16 inventory forms a locked seed; it is not a repaired v16 result", () => {
  const f = counterfactualV16Fixture(), { captured, candidate } = f, original = JSON.stringify(captured);
  assert.deepEqual(candidate.contextChoices, [{ elementId: "element-17", text: "const WelcomeEmail = ({" }, { elementId: "element-7", text: "company = 'ACME'," }, { elementId: "element-2", text: "Welcome to ACME, user!" }]);
  // This independently constructed future witness selects only offered exact
  // context. It never edits the saved v16 research, response, ledger or result.
  for (let mask = 1; mask < 2 ** candidate.contextChoices.length; mask++) {
    const witness = structuredClone(f.target); witness.workflow!.result.contentDerivation!.context = candidate.contextChoices.filter((_choice, index) => mask & (1 << index)).map(choice => choice.text);
    assert.ok(createUiLiteralSeed(f.research, f.evidence, witness), `every exact offered subset can form a seed (${mask})`);
  }
  f.target.workflow!.result.contentDerivation!.context = candidate.contextChoices.slice(0, 3).map(choice => choice.text);
  const seed = createUiLiteralSeed(f.research, f.evidence, f.target)!; assert.ok(seed); assert.equal(seed.slots.length, 3);
  for (const observed of seed.observed) { const exact = captured.elements.find(element => element.id === observed.sourceElementId)!; assert.equal(observed.text, exact.text); assert.deepEqual(observed.sourceRect, exact.rect); assert.deepEqual(observed.style, exact.style); }
  const code = seed.document.elements.find(element => element.id === "element-1")!, style = seed.document.styles.find(style => style.id === code.styleId)!;
  assert.equal(style.color, "#ebeced"); assert.equal(style.fill, "transparent"); assert.equal(style.fontSize, 12);
  const codePanel = seed.document.elements.find(element => element.id === "seed-code-surface")!; assert.equal(seed.document.styles.find(style => style.id === codePanel.styleId)!.fill, "#000000");
  assert.equal(seed.slots.filter(slot => slot.property === "color").length, 2, "uncertain preview colors remain explicit review obligations");
  assert.equal(JSON.stringify(captured), original);
});

test("tiny native review grammar exposes no writable source fields and binds hash/slots", () => {
  const f = fixture(), seed = createUiLiteralSeed(f.research, f.evidence, f.target)!, constraints = { targets: [{ id: f.target.id, sourceAssetIds: ["editor"], capabilityFactIds: ["fact-1"], literalPreview: true as const }], seedReview: { seedSha256: seed.sha256, slotIds: seed.slots.map(slot => slot.id) } };
  const schema = constrainedUiSchema(constraints) as any;
  assert.deepEqual(Object.keys(schema.properties), ["transportVersion", "seedSha256", "sufficientEvidence", "reason", "presentation"]);
  assert.deepEqual(schema.properties.seedSha256.enum, [seed.sha256]); assert.deepEqual(schema.required, Object.keys(schema.properties)); assert.equal(schema.additionalProperties, false);
  assert.ok(JSON.stringify(schema).length < 1600); assert.doesNotMatch(JSON.stringify(schema), /sourceRect|documentsById|textValues/);
  const request = uiLiteralReviewRequest(seed, f.research, f.evidence, f.target, 6000); assert.match(request.prompt, /one public static state/); assert.match(request.prompt, /never permission to default the UI to white/); assert.equal(request.images.length, 1);
});

test("mandatory paid UI review preserves reserve and persists seed before call; restore retains exact document", async t => {
  const f = fixture(), path = await workspace(t), seed = createUiLiteralSeed(f.research, f.evidence, f.target)!, events: string[] = [];
  const ledger = { modelCalls: 1, inputTokens: 1000, outputTokens: 1000, reservedInputTokens: 0, reservedOutputTokens: 0 }; let calls = 0;
  const providers = { ledger, claude: async (purpose: string, prompt: string, _images: unknown, options: any) => { calls++; events.push("call"); assert.equal(purpose, "ui-design"); assert.equal(options.policy, "ui-design-v1"); assert.equal(options.maxOutputTokens, 6000); assert.equal(options.reserve.calls, 5); assert.equal(options.reserve.outputTokens, 16048); assert.equal(options.uiConstraints.seedReview.seedSha256, seed.sha256); assert.ok(events.includes("analysis/ui-literal-seed-0-greeting.json")); assert.equal(JSON.parse(await readFile(join(path, "analysis/ui-literal-seed-0-greeting.json"), "utf8")).sha256, seed.sha256); assert.match(prompt, /LOCKED SEED/); ledger.modelCalls++; ledger.outputTokens += 200; return reviewFor(seed); }, prepareClaude: async () => { assert.fail("seed review never becomes generic layout repair"); } } as unknown as Providers;
  const localHooks = { ...hooks, persist: async (paths: string[]) => { events.push(...paths); } };
  const built = (await buildUiDocuments(f.input, f.evidence, f.research, providers, localHooks, path, { inspectLayout: passedLayout }))!;
  const saved = await readFile(join(path, "analysis/ui.json"), "utf8");
  assert.deepEqual(await loadUiDocuments(f.input, f.evidence, f.research, path), built); assert.deepEqual(await buildUiDocuments(f.input, f.evidence, f.research, providers, localHooks, path, { inspectLayout: passedLayout }), built);
  assert.equal(calls, 1); assert.equal(await readFile(join(path, "analysis/ui.json"), "utf8"), saved);
  const stripped = JSON.parse(saved); delete stripped.documents[0].sourceSeed;
  await writeFile(join(path, "analysis/ui.json"), JSON.stringify(stripped));
  await assert.rejects(loadUiDocuments(f.input, f.evidence, f.research, path), PipelineError, "removing the marker cannot reuse the saved completion hash");
  await writeFile(join(path, "analysis/ui.json"), saved);
  const changed = structuredClone(f.evidence); changed.uiSources![0].elements[0].style!.color = "#ffffff";
  await assert.rejects(loadUiDocuments(f.input, changed, f.research, path), PipelineError);
});

test("malformed seed review and failed layout stop without generic fallback or another call", async t => {
  for (const badLayout of [false, true]) {
    const f = fixture(), path = await workspace(t), seed = createUiLiteralSeed(f.research, f.evidence, f.target)!; let calls = 0;
    const providers = { ledger: { modelCalls: 1, inputTokens: 1000, outputTokens: 1000, reservedInputTokens: 0, reservedOutputTokens: 0 }, claude: async () => { calls++; return badLayout ? reviewFor(seed) : { transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Cannot bypass selected seed", documentsById: {} }; }, prepareClaude: async () => { assert.fail("No correction or fallback for locked seed"); } } as unknown as Providers;
    const inspectLayout: NonNullable<UiDocumentDependencies["inspectLayout"]> = async (_documents, options) => { const reportPath = `analysis/${options.reportName}.json`; await writeFile(join(path, reportPath), JSON.stringify({ passed: false, issues: [] })); return { passed: false, reportPath, artifactPaths: [reportPath], issues: [] }; };
    await assert.rejects(buildUiDocuments(f.input, f.evidence, f.research, providers, hooks, path, { inspectLayout }), (error: unknown) => error instanceof PipelineError && error.code === (badLayout ? "ui_layout_invalid" : "invalid_ui_document"));
    await assert.rejects(buildUiDocuments(f.input, f.evidence, f.research, providers, hooks, path, { inspectLayout }), PipelineError); assert.equal(calls, 1);
  }
});

test("source-seeded before/after remain readable in every production format in actual Chromium", { skip: process.env.STUDIO_UI_LAYOUT_INTEGRATION !== "1", timeout: 120000 }, async t => {
  const f = fixture(), path = await workspace(t), seed = createUiLiteralSeed(f.research, f.evidence, f.target)!, document = assembleUiLiteralReview(reviewFor(seed), seed, f.research, f.evidence, f.target);
  for (const [width, height] of [[1920, 1080], [1080, 1350], [1080, 1920], [1080, 1080]]) {
    const report = await inspectUiDocumentLayout([document], { workspace: path, width, height, reportName: `literal-seed-${width}-${height}` });
    assert.deepEqual(report.issues, [], `${width}x${height}: ${JSON.stringify(report.issues)}`); assert.equal(report.passed, true);
  }
});

test("counterfactual full four-context v16 seed including the complete paragraph passes actual landscape and portrait layout", { skip: process.env.STUDIO_UI_LAYOUT_INTEGRATION !== "1", timeout: 120000 }, async t => {
  const f = counterfactualV16Fixture(), path = await workspace(t);
  f.target.workflow!.result.contentDerivation!.context = literalPreviewCandidates([f.captured], 4)[0].contextChoices.map(choice => choice.text);
  const seed = createUiLiteralSeed(f.research, f.evidence, f.target)!; assert.ok(seed);
  const document = assembleUiLiteralReview(reviewFor(seed), seed, f.research, f.evidence, f.target);
  assert.ok(document.elements.some(element => element.id === "element-15" && element.text === f.captured.elements.find(element => element.id === "element-15")!.text));
  for (const [width, height] of [[1920, 1080], [1080, 1920]]) {
    const report = await inspectUiDocumentLayout([document], { workspace: path, width, height, reportName: `counterfactual-v16-context-${width}-${height}` });
    assert.deepEqual(report.issues, [], `${width}x${height}: ${JSON.stringify(report.issues)}`); assert.equal(report.passed, true);
  }
});

test("counterfactual three-context offer from actual v16 source passes landscape and portrait layout", { skip: process.env.STUDIO_UI_LAYOUT_INTEGRATION !== "1", timeout: 120000 }, async t => {
  const f = counterfactualV16Fixture(), path = await workspace(t);
  f.target.workflow!.result.contentDerivation!.context = f.candidate.contextChoices.map(choice => choice.text);
  assert.equal(f.target.workflow!.result.contentDerivation!.context.length, 3);
  const seed = createUiLiteralSeed(f.research, f.evidence, f.target)!, document = assembleUiLiteralReview(reviewFor(seed), seed, f.research, f.evidence, f.target);
  assert.ok(document.sourceSeed); assert.equal(document.elements.some(element => ["element-8", "element-15", "element-19"].includes(element.id)), false);
  for (const [width, height] of [[1920, 1080], [1080, 1920]]) {
    const report = await inspectUiDocumentLayout([document], { workspace: path, width, height, reportName: `counterfactual-v16-three-context-${width}-${height}` });
    assert.deepEqual(report.issues, [], `${width}x${height}: ${JSON.stringify(report.issues)}`); assert.equal(report.passed, true);
  }
});

test("retained legitimate four-context seed restores its exact completed bytes despite fresh three-anchor offer", async t => {
  const f = counterfactualV16Fixture(), path = await workspace(t);
  f.target.workflow!.result.contentDerivation!.context = literalPreviewCandidates([f.captured], 4)[0].contextChoices.map(choice => choice.text);
  assert.equal(f.target.workflow!.result.contentDerivation!.context.length, 4);
  const seed = createUiLiteralSeed(f.research, f.evidence, f.target)!, document = assembleUiLiteralReview(reviewFor(seed), seed, f.research, f.evidence, f.target);
  const stage = compileUiDocuments({ sufficientEvidence: true, reason: "Counterfactual prior four-context review", documents: [document] }, f.input, f.evidence, f.research, { requireLaunchResult: true });
  const saved = JSON.stringify(stage), binding = stageDigest({ jobId: f.input.jobId, researchSha256: stageDigest(f.research), evidenceSha256: f.research.evidenceSha256 });
  await writeFile(join(path, "analysis/ui.json"), saved); await writeFile(join(path, "analysis/ui-state.json"), JSON.stringify({ version: 1, stage: "ui", binding, status: "completed", artifactSha256: stageDigest(stage) }));
  const loaded = await loadUiDocuments(f.input, f.evidence, f.research, path);
  assert.deepEqual(loaded.documents, stage.documents); assert.equal(loaded.sha256, stageDigest(stage)); assert.equal(await readFile(join(path, "analysis/ui.json"), "utf8"), saved);
  assert.equal(literalPreviewCandidates([f.captured])[0].contextChoices.length, 3);
});
