import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { decodeModelJson } from "./model-json";
import { compileResearch, loadCompletedStage, researchProduct, researchRequest, researchSchema, stageDigest, validateResearch, type Research } from "./research";
import { researchReadiness } from "./research-readiness";
import { compileResearchWithRetry, researchResponseDiagnostics, RESEARCH_RETRY_PATH } from "./research-review";
import { researchWorkflowIssues, type ResearchWorkflow } from "./research-workflow";
import { workflowInputReserve, workflowOutputLimit, workflowSceneLimit } from "./workflow-coherence";
import type { Providers } from "./providers";
import { PipelineError, type Evidence, type WorkerInput } from "./types";

const fixture = JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/research-applied-view/plausible-v17.json"), "utf8")) as { evidence: Evidence; rawText: string; canonical: Research; state: { binding: string; artifactSha256: string } };
const input: WorkerInput = { jobId: "local-acceptance-url", ownerId: "offline-fixture", mode: "url", productUrl: "https://plausible.io/", videoType: "launch", format: "16:9", files: [], budgets: { maxModelCalls: 10, maxModelInputTokens: 200000, maxModelOutputTokens: 30000 } };
const prior = { version: 3 as const, singleTarget: true as const, workflowSelection: true as const };
const fresh = { ...prior, appliedViewProof: true as const };
const code = "workflow_applied_view_proof_required";
const rejected = (expected = code) => (error: unknown) => error instanceof PipelineError && error.code === "production_stage_changed" && error.message.includes(expected);
const raw = () => decodeModelJson(fixture.rawText);
function google(): Research {
  // Counterfactual source-supported proposal, never a repair of the failed run.
  const research = structuredClone(fixture.canonical), assetId = "product-image-0";
  research.documentTargets = [{ id: "google-visitors", sourceAssetIds: [assetId], capabilityFactIds: ["fact-61"], goal: "Select Google and inspect its observed visitor count with the same date and site.", workflow: {
    version: 1, observedStart: { sourceAssetId: assetId, description: "plausible.io, Last 91 days, UNIQUE VISITORS 952k and Google Visitors 73.4k." },
    actions: [{ kind: "click", sourceAssetId: assetId, control: "Google", evidenceId: "fact-61" }],
    result: { kind: "applied-view", sourceAssetId: assetId, surface: "UNIQUE VISITORS", change: "Illustratively copy the observed Google visitor count into the corresponding summary.", basis: "illustrative", evidenceId: "fact-61", valueDerivation: { kind: "selected-row-count", sourceAssetId: assetId, rowLabel: "Google", rowValue: "73.4k", sourceMetricLabel: "Visitors", outputLabel: "UNIQUE VISITORS", outputBefore: "952k", context: ["plausible.io", "Last 91 days"] } },
  } }];
  research.visuals.find(visual => visual.assetId === assetId)!.supportsFactIds.push("fact-61");
  research.story!.mechanism = { text: "Select Google to inspect its visitors", basis: "explicit", evidenceIds: ["fact-61"], steps: [{ action: "Click Google", assetId, evidenceId: "fact-61" }] };
  return research;
}
const compile = (value: unknown) => compileResearch(input, fixture.evidence, value, fixture.state.binding, fresh);
async function workspace(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "research-applied-view-")); await mkdir(join(root, "analysis"));
  t.after(async () => { assert.equal(dirname(resolve(root)), resolve(tmpdir())); assert.ok(root.startsWith(join(tmpdir(), "research-applied-view-"))); await rm(root, { recursive: true, force: true }); });
  return root;
}

test("retained Plausible v17 unsupported metrics fail fresh research before UI with exact correction diagnostics", () => {
  const original = JSON.stringify(fixture), response = raw();
  let error: PipelineError | undefined;
  try { compile(response); } catch (caught) { assert.ok(rejected()(caught)); error = caught as PipelineError; }
  assert.ok(error);
  assert.deepEqual(researchResponseDiagnostics(response, fixture.evidence, error, true, true, true, true), [{ code, path: ["documentTargets", 0, "workflow", "result", "valueDerivation"] }]);
  const marked = { ...structuredClone(fixture.canonical), appliedViewProofVersion: 1 as const };
  assert.throws(() => validateResearch(marked, input, fixture.evidence, fixture.state.binding), rejected());
  const readiness = researchReadiness(input, fixture.evidence, fixture.state.binding, ["fact-61"], marked);
  assert.equal(readiness.status, "needs_input"); assert.equal(readiness.appliedViewProofVersion, 1); assert.ok(readiness.issues.some(issue => issue.code === code));
  assert.equal(JSON.stringify(fixture), original);
});

test("fresh Google73.4k witness retains exact values and all existing derivation checks", () => {
  const proposal = google(), before = JSON.stringify(proposal), result = compile(proposal);
  assert.equal(result.appliedViewProofVersion, 1); assert.equal(result.workflowSelectionVersion, 1);
  assert.deepEqual(result.documentTargets![0].workflow, proposal.documentTargets![0].workflow);
  assert.equal(researchReadiness(input, fixture.evidence, fixture.state.binding, ["fact-61"], result).status, "ready_for_documentation");
  for (const mutate of [
    (w: ResearchWorkflow) => { delete w.result.valueDerivation; },
    (w: ResearchWorkflow) => { w.result.valueDerivation!.rowValue = "48k%"; },
    (w: ResearchWorkflow) => { w.result.valueDerivation!.outputBefore = "73.4k"; },
    (w: ResearchWorkflow) => { w.result.valueDerivation!.rowLabel = "Apply filter"; },
    (w: ResearchWorkflow) => { w.result.valueDerivation!.sourceAssetId = "research-2-image-2"; },
    (w: ResearchWorkflow) => { w.result.valueDerivation!.context.push("Last 91 days"); },
    (w: ResearchWorkflow) => { w.actions.push({ ...w.actions[0] }); },
  ]) { const changed = google(); mutate(changed.documentTargets![0].workflow!); assert.throws(() => compile(changed), error => rejected()(error) || rejected("workflow_value_derivation")(error)); }
  assert.equal(JSON.stringify(proposal), before);
});

test("observed and literal paths retain prior checks; marker cannot be applied to incompatible contracts", () => {
  const observed = google(); delete observed.documentTargets![0].workflow!.result.valueDerivation; observed.documentTargets![0].workflow!.result.basis = "observed";
  // Structural comparison only: source-state/semantic QC still must establish an actual after capture.
  const old = compileResearch(input, fixture.evidence, observed, fixture.state.binding, prior), current = compile(observed);
  const { appliedViewProofVersion: _marker, ...rest } = current; assert.deepEqual(rest, old);
  observed.documentTargets![0].workflow!.result.sourceAssetId = "unknown";
  assert.throws(() => compile(observed), rejected("workflow_source_binding"));
  const literal: ResearchWorkflow = { version: 1, observedStart: { sourceAssetId: "sample", description: "Synthetic exact name assignment and greeting" }, actions: [{ kind: "type", sourceAssetId: "sample", control: "name = 'Ada',", evidenceId: "fact-1" }], result: { kind: "reactive-preview", sourceAssetId: "sample", surface: "Greeting", change: "Illustrative literal substitution", basis: "illustrative", evidenceId: "fact-1", contentDerivation: { kind: "literal-preview", sourceAssetId: "sample", codeText: "name = 'Ada',", propertyName: "name", beforeLiteral: "Ada", afterLiteral: "Mina", templateText: "Hello {name}", outputBefore: "Hello Ada", outputAfter: "Hello Mina", context: ["Welcome template"] } } };
  const target = { workflow: literal, sourceAssetIds: ["sample"], capabilityFactIds: ["fact-1"] }, evidence: Evidence = { text: "Authors edit the template name to change its greeting.", assets: [] }, visuals = [{ assetId: "sample", supportsFactIds: ["fact-1"] }];
  assert.deepEqual(researchWorkflowIssues(target, evidence, visuals, true, true, true), []);
  for (const mutation of [
    (r: Research) => { r.version = 2; },
    (r: Research) => { delete r.workflowSelectionVersion; },
  ]) { const changed = compile(google()); mutation(changed); assert.throws(() => validateResearch(changed, input, fixture.evidence, fixture.state.binding), /contract requires version 3/); }
  assert.throws(() => validateResearch(compile(google()), { ...input, videoType: "feature-demo" }, fixture.evidence, fixture.state.binding), /proof contract requires/);
});

test("retained v17 raw and canonical restore unchanged; stripping a fresh marker breaks its saved stage hash", async t => {
  const root = await workspace(t), old = compileResearch(input, fixture.evidence, raw(), fixture.state.binding, prior);
  assert.equal(old.appliedViewProofVersion, undefined); assert.deepEqual(old, fixture.canonical); assert.equal(stageDigest(old), fixture.state.artifactSha256);
  const restore = () => loadCompletedStage("research", fixture.state.binding, researchSchema, root, value => validateResearch(value, input, fixture.evidence, fixture.state.binding));
  const saved = JSON.stringify(fixture.canonical);
  await writeFile(join(root, "analysis/research.json"), saved); await writeFile(join(root, "analysis/research-state.json"), JSON.stringify(fixture.state));
  assert.deepEqual(await restore(), fixture.canonical); assert.equal(await readFile(join(root, "analysis/research.json"), "utf8"), saved);
  const current = compile(google()); await writeFile(join(root, "analysis/research.json"), JSON.stringify(current)); await writeFile(join(root, "analysis/research-state.json"), JSON.stringify({ ...fixture.state, artifactSha256: stageDigest(current) }));
  assert.deepEqual(await restore(), current);
  delete current.appliedViewProofVersion; await writeFile(join(root, "analysis/research.json"), JSON.stringify(current));
  await assert.rejects(restore(), /retained research stage is incomplete or does not match/);
});

test("fresh production uses its existing single correction and unchanged reserve for the unsupported view", async t => {
  const root = await workspace(t), response = raw(), events: string[] = [], assets = [...new Set(fixture.evidence.assets.flatMap(asset => [asset.path, ...(asset.preview ? [asset.preview] : [])]))];
  for (const path of assets) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), "Offline identity placeholder; no image interpretation in this transport test."); }
  const qualityCalls = Math.ceil(workflowSceneLimit() / 2), reserve = { calls: 3 + qualityCalls, inputTokens: workflowInputReserve(), outputTokens: 11000 + qualityCalls * 3000 + workflowOutputLimit() };
  const provider = {
    ledger: { modelCalls: 0, inputTokens: 0, outputTokens: 0, reservedInputTokens: 0, reservedOutputTokens: 0, audioGenerations: 0, asrSeconds: 0, providerRequests: [], audio: {} },
    claude: async (purpose: string, _prompt: string, _images: unknown, options: unknown) => { assert.equal(purpose, "research"); assert.deepEqual(options, { policy: "research-v2", reserve }); events.push("initial"); return response; },
    prepareClaude: async (purpose: string, prompt: string, _images: unknown, options: unknown) => {
      assert.equal(purpose, "research"); assert.match(prompt, /workflow_applied_view_proof_required/); assert.deepEqual(options, { policy: "research-v2", reserve });
      return async () => { events.push("correction"); return google(); };
    },
  } as unknown as Providers;
  const hooks = { state: async () => {}, complete: async () => {}, persist: async (paths: string[]) => { if (paths.includes(RESEARCH_RETRY_PATH)) events.push("retry-checkpoint"); } };
  const result = await researchProduct(input, fixture.evidence, provider, hooks, root);
  assert.equal(result.appliedViewProofVersion, 1); assert.deepEqual(events, ["initial", "retry-checkpoint", "correction", "retry-checkpoint"]);
  assert.equal(JSON.parse(await readFile(join(root, RESEARCH_RETRY_PATH), "utf8")).outcome, "valid");
  assert.deepEqual(await researchProduct(input, fixture.evidence, provider, hooks, root), result); assert.equal(events.filter(value => value === "initial").length, 1);
  await assert.rejects(compileResearchWithRetry(response, { input, evidence: fixture.evidence, evidenceSha256: result.evidenceSha256, workspace: root, hooks, providers: provider, ...researchRequest(input, fixture.evidence), singleTarget: true, workflowSelection: true, appliedViewProof: true }), /already consumed/);
  assert.equal(events.filter(value => value === "correction").length, 1);
});
