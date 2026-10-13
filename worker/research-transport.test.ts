import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { decodeResearchTransport } from "./research-transport";
import { compileResearch, researchRequest, stageDigest } from "./research";
import { compileResearchWithRetry, researchResponseDiagnostics, RESEARCH_RETRY_PATH } from "./research-review";
import { PipelineError, type Evidence, type WorkerInput, type Ledger } from "./types";
import type { Providers } from "./providers";

const input: WorkerInput = { jobId: "flat-research", ownerId: "fixture", mode: "url", productUrl: "https://example.test", videoType: "launch", format: "16:9", files: [], budgets: { maxModelCalls: 10, maxModelInputTokens: 200000, maxModelOutputTokens: 30000 } };
const evidence: Evidence = { text: "Atlas helps analysts understand visitors.\n\nChoose a cohort row to filter its visitor count.\n\nStart a free trial.", assets: [{ id: "screen", kind: "image", path: "assets/screen.png", usage: "output", rights: "Synthetic fixture", width: 1000, height: 600 }] };
const identity = "a".repeat(64), fresh = { version: 3 as const, singleTarget: true as const, workflowSelection: true as const };
function flat(): any {
  return {
    transportVersion: "research-flat-v1", sufficientEvidence: true, reason: "An illustrative applied view is supported.", product: "Atlas",
    documentTargets: [{ id: "segment", sourceAssetIds: ["screen"], capabilityFactIds: ["fact-2"], goal: "Select a documented cohort and inspect its visitor count.", observedStartSourceAssetId: "screen", observedStartDescription: "Cohort rows and visitor summary", actions: [{ kind: "click", sourceAssetId: "screen", control: "Chrome", evidenceId: "fact-2", sourceElementId: "" }], resultKind: "applied-view", resultSourceAssetId: "screen", resultSurface: "Visitor count", resultChange: "The selected cohort visitor count appears.", resultBasis: "illustrative", resultEvidenceId: "fact-2", valueDerivations: [], contentDerivations: [] }],
    facts: [1, 2, 3].map(id => ({ evidenceId: `fact-${id}`, kind: "feature", kinds: [], label: `Source ${id}` })),
    visuals: [{ assetId: "screen", description: "Cohort rows and visitor summary", supportsFactIds: ["fact-1", "fact-2"], showsProductUi: true, role: "product_ui", regions: [] }],
    claims: [{ role: "primaryAudience", text: "Analysts", basis: "explicit", evidenceIds: ["fact-1"] }, { role: "mechanism", text: "Select a cohort", basis: "explicit", evidenceIds: ["fact-2"] }, { role: "outcome", text: "Understand that cohort", basis: "explicit", evidenceIds: ["fact-2"] }, { role: "cta", text: "Start a free trial", basis: "explicit", evidenceIds: ["fact-3"] }],
    mechanismSteps: [{ action: "Select cohort", evidenceId: "fact-2", assetId: "screen" }], summary: "Visitor analytics", limitations: ["Illustrative interaction; no authenticated session was operated."],
  };
}
function nested(): any {
  return {
    sufficientEvidence: true, reason: "An illustrative applied view is supported.", product: "Atlas",
    documentTargets: [{ id: "segment", sourceAssetIds: ["screen"], capabilityFactIds: ["fact-2"], goal: "Select a documented cohort and inspect its visitor count.", workflow: { version: 1, observedStart: { sourceAssetId: "screen", description: "Cohort rows and visitor summary" }, actions: [{ kind: "click", sourceAssetId: "screen", control: "Chrome", evidenceId: "fact-2" }], result: { kind: "applied-view", sourceAssetId: "screen", surface: "Visitor count", change: "The selected cohort visitor count appears.", basis: "illustrative", evidenceId: "fact-2" } } }],
    facts: [1, 2, 3].map(id => ({ evidenceId: `fact-${id}`, kind: "feature", label: `Source ${id}` })),
    visuals: [{ assetId: "screen", description: "Cohort rows and visitor summary", supportsFactIds: ["fact-1", "fact-2"], showsProductUi: true, role: "product_ui" }],
    story: { primaryAudience: { text: "Analysts", basis: "explicit", evidenceIds: ["fact-1"] }, problem: null, mechanism: { text: "Select a cohort", basis: "explicit", evidenceIds: ["fact-2"], steps: [{ action: "Select cohort", evidenceId: "fact-2", assetId: "screen" }] }, outcome: { text: "Understand that cohort", basis: "explicit", evidenceIds: ["fact-2"] }, differentiator: null, cta: { text: "Start a free trial", basis: "explicit", evidenceIds: ["fact-3"] } },
    summary: "Visitor analytics", limitations: ["Illustrative interaction; no authenticated session was operated."],
  };
}
const row = () => ({ kind: "selected-row-count" as const, sourceAssetId: "screen", rowLabel: "Chrome", rowValue: "21", sourceMetricLabel: "Visitors", outputLabel: "Unique visitors", outputBefore: "80", context: ["Last 30 days"] });
const literal = () => ({ kind: "literal-preview" as const, sourceAssetId: "screen", codeText: "recipient = 'Mina  Rao',", propertyName: "recipient", beforeLiteral: "Mina  Rao", afterLiteral: "Ada", templateText: "Hello {recipient},", outputBefore: "Hello Mina  Rao,", outputAfter: "Hello Ada,", context: ["Welcome email"] });

test("flat research restores only nesting and exact absence while canonical hashes match the equivalent legacy draft", () => {
  const raw = flat(), before = JSON.stringify(raw), expected = nested();
  assert.deepEqual(decodeResearchTransport(raw), expected);
  assert.equal(JSON.stringify(raw), before);
  const current = compileResearch(input, evidence, raw, identity, fresh), legacy = compileResearch(input, evidence, expected, identity, fresh);
  assert.deepEqual(current, legacy); assert.equal(stageDigest(current), stageDigest(legacy));
  assert.strictEqual(decodeResearchTransport(expected), expected);
  assert.strictEqual(decodeResearchTransport(legacy), legacy);
  raw.documentTargets[0].actions[0].evidenceId = "fact-999";
  assert.throws(() => compileResearch(input, evidence, raw, identity, fresh), /workflow_fact_binding/);
  raw.documentTargets[0].actions[0].evidenceId = "fact-2"; raw.documentTargets[0].actions[0].sourceElementId = " ";
  assert.equal((decodeResearchTransport(raw) as any).documentTargets[0].workflow.actions[0].sourceElementId, " ");
  assert.throws(() => compileResearch(input, evidence, raw, identity, fresh), /workflow_control_binding/);
  raw.documentTargets[0].actions[0].sourceElementId = "";
  raw.documentTargets[0].observedStartDescription = "x".repeat(241);
  assert.equal((decodeResearchTransport(raw) as any).documentTargets[0].workflow.observedStart.description, raw.documentTargets[0].observedStartDescription);
  assert.throws(() => compileResearch(input, evidence, raw, identity, fresh), /Too big/);
});

test("witnesses, nonempty IDs, regions, kinds and literal whitespace survive unchanged", () => {
  for (const witness of [row(), literal()]) {
    const raw = flat(), target = raw.documentTargets[0];
    raw.facts[0].kinds = ["product", "feature"];
    raw.visuals[0].regions = [{ id: "focus", rect: { x: .1, y: .2, width: .7, height: .5 }, supportsFactIds: ["fact-2"] }];
    target.actions[0].sourceElementId = "observed-code";
    if (witness.kind === "literal-preview") { target.resultKind = "reactive-preview"; target.contentDerivations = [witness]; target.actions[0].kind = "type"; target.actions[0].control = witness.codeText; }
    else target.valueDerivations = [witness];
    const before = JSON.stringify(raw), decoded = decodeResearchTransport(raw) as any;
    assert.deepEqual(decoded.documentTargets[0].workflow.result[witness.kind === "literal-preview" ? "contentDerivation" : "valueDerivation"], witness);
    assert.equal(decoded.documentTargets[0].workflow.actions[0].sourceElementId, "observed-code");
    assert.deepEqual(decoded.visuals[0].regions, raw.visuals[0].regions); assert.deepEqual(decoded.facts[0].kinds, raw.facts[0].kinds);
    assert.equal(JSON.stringify(raw), before);
  }
});

test("strict flat transport rejects duplicate roles, stray steps, mixed shapes and conflicting or unused witnesses", () => {
  for (const change of [
    (raw: any) => raw.claims.push({ ...raw.claims[0] }),
    (raw: any) => raw.claims = raw.claims.filter((claim: any) => claim.role !== "mechanism"),
    (raw: any) => raw.transportVersion = "research-flat-v2",
    (raw: any) => raw.story = nested().story,
    (raw: any) => raw.claims[0].role = "system",
    (raw: any) => raw.documentTargets[0].actions[0].sourceElementId = null,
    (raw: any) => delete raw.documentTargets[0].actions[0].sourceElementId,
    (raw: any) => raw.documentTargets[0].workflow = nested().documentTargets[0].workflow,
    (raw: any) => raw.documentTargets[0].valueDerivations = [row(), row()],
    (raw: any) => { raw.documentTargets[0].valueDerivations = [row()]; raw.documentTargets[0].contentDerivations = [literal()]; },
    (raw: any) => raw.documentTargets[0].contentDerivations = [literal()],
    (raw: any) => { raw.documentTargets[0].resultKind = "committed-content"; raw.documentTargets[0].valueDerivations = [row()]; },
  ]) { const raw = flat(); change(raw); assert.throws(() => decodeResearchTransport(raw), z.ZodError); }
  const missing = flat(); missing.claims = missing.claims.filter((claim: any) => claim.role !== "mechanism"); missing.mechanismSteps = [];
  assert.equal((decodeResearchTransport(missing) as any).story.mechanism, null);
  assert.throws(() => compileResearch(input, evidence, missing, identity, fresh), error => error instanceof PipelineError && error.code === "insufficient_product_evidence");
});

test("strict flat refusals contain no discarded content and legacy sparse refusals remain unchanged", () => {
  const raw = { transportVersion: "research-flat-v1", sufficientEvidence: false, reason: "The source does not establish a result.", product: "", documentTargets: [], facts: [], visuals: [], claims: [], mechanismSteps: [], summary: "", limitations: [] };
  const isRefusal = (error: unknown) => error instanceof PipelineError && error.code === "insufficient_product_evidence" && error.message === raw.reason;
  assert.throws(() => compileResearch(input, evidence, raw, identity, fresh), isRefusal);
  assert.throws(() => compileResearch(input, evidence, { sufficientEvidence: false, reason: raw.reason }, identity, fresh), isRefusal);
  for (const extra of [{ product: "placeholder" }, { claims: flat().claims }, { documentTargets: flat().documentTargets }, { limitations: ["discarded claim"] }, { reason: " " }]) assert.throws(() => decodeResearchTransport({ ...raw, ...extra }), z.ZodError);
});

test("correction diagnostics use decoded canonical bindings and preserve bounded flat structural paths", () => {
  const raw = flat(); raw.documentTargets[0].actions[0].evidenceId = "fact-999";
  let failure: any; try { compileResearch(input, evidence, raw, identity, fresh); } catch (error) { failure = error; }
  const diagnostics = researchResponseDiagnostics(raw, evidence, failure, true, true);
  assert.ok(diagnostics.some(value => value.code === "workflow_fact_binding"));
  assert.ok(!diagnostics.some(value => ["workflow_declaration_required", "single_target_required"].includes(value.code)));
  raw.documentTargets[0].actions[0].evidenceId = "fact-2"; raw.claims.push({ ...raw.claims[0] });
  try { compileResearch(input, evidence, raw, identity, fresh); } catch (error) { failure = error; }
  assert.deepEqual(researchResponseDiagnostics(raw, evidence, failure, true, true), [{ code: "custom", path: ["claims", 4, "role"] }]);
});

test("flat corrections retain the exact rejected response and consume the existing single allowance", async t => {
  const prefix = join(tmpdir(), "flat-research-retry-"), workspace = await mkdtemp(prefix); await mkdir(join(workspace, "analysis"));
  t.after(async () => { if (dirname(resolve(workspace)) !== resolve(tmpdir()) || !workspace.startsWith(prefix)) throw new Error("Unsafe fixture cleanup"); await rm(workspace, { recursive: true, force: true }); });
  const rejected = flat(); rejected.claims.push({ ...rejected.claims[0] });
  const usage: Ledger = { modelCalls: 1, inputTokens: 1000, outputTokens: 1000, reservedInputTokens: 0, reservedOutputTokens: 0, audioGenerations: 0, asrSeconds: 0, providerRequests: [], audio: {} };
  let calls = 0, prompt = "";
  const providers = { ledger: usage, prepareClaude: async (_purpose: string, request: string, _images: unknown, options: any) => {
    assert.equal(options.policy, "research-v2"); assert.equal(options.reserve.calls, 6); assert.equal(options.reserve.outputTokens, 22048);
    prompt = request; return async () => { calls++; return flat(); };
  } } as unknown as Providers;
  const options = { input, evidence, evidenceSha256: identity, workspace, providers, hooks: { persist: async () => {} }, prompt: "original prompt", images: [], singleTarget: true as const, workflowSelection: true as const };
  const compiled = await compileResearchWithRetry(rejected, options);
  assert.equal(compiled.workflowSelectionVersion, 1); assert.equal(calls, 1);
  const marker = JSON.parse(await readFile(join(workspace, RESEARCH_RETRY_PATH), "utf8"));
  assert.equal(marker.rejectedValueSha256, createHash("sha256").update(JSON.stringify(rejected)).digest("hex"));
  assert.equal(marker.correctedValueSha256, createHash("sha256").update(JSON.stringify(flat())).digest("hex"));
  assert.equal(marker.outcome, "valid"); assert.ok(prompt.includes(JSON.stringify(rejected))); assert.match(prompt, /same research-flat-v1 transport/);
  await assert.rejects(compileResearchWithRetry(flat(), options), /already consumed/); assert.equal(calls, 1);
});

test("fresh launch prompt names flat fields and refusal; feature and legacy prompts remain nested", () => {
  const prompt = researchRequest(input, evidence).prompt;
  assert.match(prompt, /RESEARCH RESPONSE TRANSPORT/); assert.match(prompt, /sourceElementId:\"\"/); assert.match(prompt, /empty documentTargets,facts,visuals,claims,mechanismSteps,limitations/);
  assert.doesNotMatch(prompt, /null for all six story claims|Omit optional sourceElementId entirely|Return story \{|Return JSON \{sufficientEvidence/);
  assert.doesNotMatch(researchRequest({ ...input, videoType: "feature-demo" }, evidence).prompt, /RESEARCH RESPONSE TRANSPORT/);
  assert.doesNotMatch(researchRequest(input, evidence, { flatTransport: false }).prompt, /RESEARCH RESPONSE TRANSPORT/);
});
