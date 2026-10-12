import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { constrainedUiSchema, UI_TRANSPORT_VERSION } from "./model-format";
import { compileUiDocuments, decodeUiTransport, uiDesignConstraints, uiDesignRequest, type UiDocument } from "./ui-reconstruction";
import { inspectLaunchResult } from "./workflow-depth";
import { stageDigest, type Research } from "./research";
import { PipelineError, type Evidence, type WorkerInput } from "./types";

// Actual unsuccessful provider answers, preserved as JSON values. No source
// images, account data or credentials are included. The original file digest
// and ignored workspace path identify each retained local response.
const failures: { product: string; sourcePath: string; responseSha256: string; response: any }[] = JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/ui-generation-failures.json"), "utf8"));
const input: WorkerInput = { jobId: "ui-generation-regression", ownerId: "fixture", mode: "url", productUrl: "https://example.com", videoType: "launch", format: "16:9", files: [] };

/** Minimal canonical source bindings isolate UI validation from research prose. */
function context(response: any) {
  const document = Object.values((decodeUiTransport(response) as { documentsById: Record<string, UiDocument> }).documentsById)[0];
  const count = Math.max(...document.capabilityFactIds.map(id => Number(id.slice(5))));
  const passages = Array.from({ length: count }, (_, index) => `Synthetic canonical capability passage ${index + 1}.`);
  const evidence: Evidence = { text: passages.join("\n\n"), assets: document.sourceAssetIds.map(id => ({ id, path: `assets/${id}.jpg`, kind: "image", usage: "output", rights: "Synthetic binding for retained model regression", width: 1200, height: 800 })) };
  const fact = document.capabilityFactIds[0], claim = { text: "Fixture claim", basis: "explicit" as const, evidenceIds: [fact] };
  const research: Research = {
    version: 3, jobId: input.jobId, evidenceSha256: "a".repeat(64), sufficientEvidence: true, reason: "Fixture bindings", product: "Fixture", summary: "Retained response regression", limitations: [],
    facts: document.capabilityFactIds.map(evidenceId => ({ evidenceId, kind: "feature", quote: passages[Number(evidenceId.slice(5)) - 1], label: "Selected capability" })),
    story: { primaryAudience: claim, problem: null, mechanism: { ...claim, steps: [{ action: "Fixture action", evidenceId: fact, assetId: document.sourceAssetIds[0] }] }, outcome: claim, differentiator: null, cta: claim },
    visuals: document.sourceAssetIds.map(assetId => ({ assetId, role: "product_ui", showsProductUi: true, supportsFactIds: [...document.capabilityFactIds], description: "Selected original source" })),
    documentTargets: [{ id: document.id, sourceAssetIds: [...document.sourceAssetIds], capabilityFactIds: [...document.capabilityFactIds], goal: "Validate the same selected UI target." }],
  };
  return { document, evidence, research };
}

test("UI grammar permits refusal without requiring a fabricated target or terminal result", () => {
  const { research, evidence } = context(failures[0].response);
  const constraints = uiDesignConstraints(research, { requireLaunchResult: true }), shape = constrainedUiSchema(constraints) as any;
  const refusal = { transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "pixels", sufficientEvidence: false, reason: "The source shows output but no supported confirmation.", documentsById: {} };
  assert.deepEqual(shape.properties.documentsById.required, []);
  assert.equal(shape.properties.documentsById.additionalProperties, false);
  assert.deepEqual(Object.keys(shape.properties.documentsById.properties), constraints.targets.map(target => target.id));
  assert.ok(shape.properties.documentsById.properties[constraints.targets[0].id].required.includes("terminalResult"));
  assert.throws(() => compileUiDocuments(refusal, input, evidence, research, { requireLaunchResult: true }), error => error instanceof PipelineError && error.code === "insufficient_product_evidence" && error.status === "needs_input");
  // Optional grammar keys cannot turn an empty or wrong-target success into an accepted stage.
  for (const documentsById of [{}, { unrelated: Object.values(failures[0].response.documentsById)[0] }]) {
    assert.throws(() => compileUiDocuments({ ...refusal, sufficientEvidence: true, documentsById }, input, evidence, research, { requireLaunchResult: true }), error => error instanceof PipelineError && ["invalid_ui_document", "production_stage_changed"].includes(error.code));
  }
});

for (const failure of failures) test(`retained ${failure.product} generation remains rejected with unchanged provenance and terminal guards`, () => {
  const { document, evidence, research } = context(failure.response), digest = stageDigest(failure.response);
  assert.match(failure.responseSha256, /^[a-f0-9]{64}$/);
  assert.throws(() => compileUiDocuments(failure.response, input, evidence, research, { requireLaunchResult: true }), failure.product === "baserow" ? /relationship must connect two documented source nodes/ : /Illustrative UI text marked source-ui/);
  const terminal = inspectLaunchResult(document);
  if (failure.product === "resend") assert.deepEqual(terminal.issues, ["visible_supported_confirmation_required", "nonquery_nonselection_result_required"]);
  if (failure.product === "baserow") {
    assert.deepEqual(terminal.issues, ["nonquery_nonselection_result_required"]);
    assert.equal(document.elements.find(element => element.id === "el-add-branch")?.type, "button");
    assert.equal(document.elements.find(element => element.id === "el-live-status")?.text, "● Automation is Live");
  }
  // Structural result readiness is intentionally not semantic approval: these
  // mismatched filter examples still stop at the independent source-text gate.
  if (failure.product === "plausible") assert.equal(terminal.ready, true);
  assert.equal(stageDigest(failure.response), digest);
});

test("copied visible preview stays observed without becoming a newly completed result", () => {
  const { document, evidence, research } = context(failures.find(failure => failure.product === "resend")!.response);
  // A separate source snapshot fixture models the already-visible split pane.
  // It is not a correction written into the retained provider answer/workspace.
  const observed: UiDocument = { ...document, elements: document.elements.map(element => ({ ...element, initiallyVisible: true })), states: [{ ...document.states[0], visibleElementIds: document.elements.map(element => element.id) }] };
  delete observed.terminalResult;
  const response = { transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Observe the complete existing split pane", documentsById: { [observed.id]: observed } };
  const compiled = compileUiDocuments(response, input, evidence, research);
  assert.equal(compiled.documents[0].elements.find(element => element.id === "preview-heading")?.textBasis, "source-ui");
  assert.throws(() => compileUiDocuments(response, input, evidence, research, { requireLaunchResult: true }), error => error instanceof PipelineError && error.code === "insufficient_launch_result");
});

test("UI request prioritizes source snapshots and supported completion while retaining exact assigned evidence", () => {
  for (const failure of failures) {
    const { research, evidence } = context(failure.response), before = stageDigest({ research, evidence });
    const request = uiDesignRequest(research, evidence, research.documentTargets![0], 6000, { requireLaunchResult: true });
    assert.ok(request.prompt.startsWith("DOCUMENT EVIDENCE BEFORE CHOREOGRAPHY"));
    assert.match(request.prompt, /static source plus explicit documentation may support an illustrative alternate state/);
    assert.match(request.prompt, /Do not hide existing output/);
    assert.match(request.prompt, /documentsById:\{\}/);
    assert.match(request.prompt, /never rename its type to node/);
    assert.match(request.prompt, /elements of type text, never a toggle, button, node, input/);
    assert.ok(request.prompt.includes(`ASSIGNED TARGET: ${JSON.stringify(research.documentTargets![0])}`));
    assert.deepEqual(request.images.map(image => image.path), evidence.assets.map(asset => asset.path));
    assert.equal(stageDigest({ research, evidence }), before);
  }
});

test("v2 exact absence sentinels compile to identical sparse ordinary documents without coercing other values", () => {
  const { document, evidence, research } = context(failures.find(failure => failure.product === "resend")!.response);
  const observed: UiDocument = { ...document, elements: document.elements.map(element => ({ ...element, initiallyVisible: true })), states: [{ ...document.states[0], visibleElementIds: document.elements.map(element => element.id) }] };
  delete observed.terminalResult;
  observed.states.push({ ...structuredClone(observed.states[0]), id: "illustrative", basis: "illustrative", sourceAssetId: undefined });
  delete observed.states[1].sourceAssetId;
  const header = { transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Exact transport equality" };
  const sparse = { ...header, documentsById: { [observed.id]: observed } };
  const sentinelDocument = JSON.parse(JSON.stringify(observed));
  for (const element of sentinelDocument.elements) for (const key of ["fromId", "toId", "selectedStyleId"]) if (!(key in element)) element[key] = "";
  sentinelDocument.states[1].sourceAssetId = "";
  const sentinel = { ...header, documentsById: { [observed.id]: sentinelDocument } }, before = JSON.stringify(sentinel);
  assert.deepEqual(compileUiDocuments(sentinel, input, evidence, research), compileUiDocuments(sparse, input, evidence, research));
  assert.equal(JSON.stringify(sentinel), before);
  assert.deepEqual(decodeUiTransport(sentinel), decodeUiTransport(sparse));
  for (const [name, mutate] of [
    ["nonempty unknown style", (doc: any) => { doc.elements[0].selectedStyleId = "missing"; }],
    ["nonempty nonedge endpoint", (doc: any) => { doc.elements[0].fromId = "missing"; }],
    ["whitespace endpoint", (doc: any) => { doc.elements[0].toId = " "; }],
    ["null style", (doc: any) => { doc.elements[0].selectedStyleId = null; }],
    ["missing observed source", (doc: any) => { doc.states[0].sourceAssetId = ""; }],
    ["missing element source", (doc: any) => { doc.elements[0].sourceAssetId = ""; }],
    ["unknown state source", (doc: any) => { doc.states[1].sourceAssetId = "unknown"; }],
  ] as const) {
    const invalid = structuredClone(sentinel); mutate(invalid.documentsById[observed.id]);
    assert.throws(() => compileUiDocuments(invalid, input, evidence, research), name);
  }
  const legacy = { sufficientEvidence: true, reason: "Legacy sentinels are not permitted", documents: [sentinelDocument] };
  assert.equal(decodeUiTransport(legacy), legacy); assert.throws(() => compileUiDocuments(legacy, input, evidence, research));
});
