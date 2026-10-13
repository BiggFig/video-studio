import test from "node:test";
import assert from "node:assert/strict";
import { compileResearch, stageDigest, type Research } from "./research";
import { compileUiDocuments, uiDesignConstraints, uiDesignRequest, validateUiBundle, type UiDocument } from "./ui-reconstruction";
import { constrainedUiSchema, UI_TRANSPORT_VERSION } from "./model-format";
import { inspectLaunchResult } from "./workflow-depth";
import { PipelineError, type Evidence, type WorkerInput } from "./types";

const input: WorkerInput = { jobId: "source-value", ownerId: "fixture", mode: "url", productUrl: "https://analytics.example/", videoType: "launch", format: "16:9", files: [] };
const evidence: Evidence = { text: "Site owners can click a source row to segment the report for the existing date and filters. Try the analytics demo.", assets: [{ id: "dashboard", path: "assets/dashboard.png", kind: "image", usage: "output", rights: "Synthetic source fixture", width: 1000, height: 600 }] };
function fixture() {
  const claim = (text: string) => ({ text, basis: "explicit", evidenceIds: ["fact-1"] });
  const research = compileResearch(input, evidence, {
    sufficientEvidence: true, reason: "Observed row and documented segmentation", product: "Analytics", summary: "Segment the current report", facts: [{ evidenceId: "fact-1", kind: "feature", label: "Source row segmentation" }],
    visuals: [{ assetId: "dashboard", description: "Source row and visitors summary", role: "product_ui", showsProductUi: true, supportsFactIds: ["fact-1"] }],
    story: { primaryAudience: claim("Site owners"), problem: null, mechanism: { ...claim("Select the source row"), steps: [{ action: "Click Twitter", evidenceId: "fact-1", assetId: "dashboard" }] }, outcome: claim("Inspect source visitors"), differentiator: null, cta: claim("Try the demo") },
    documentTargets: [{ id: "traffic", sourceAssetIds: ["dashboard"], capabilityFactIds: ["fact-1"], goal: "Select one source while retaining the date and current UTM filter.", workflow: {
      version: 1, observedStart: { sourceAssetId: "dashboard", description: "Current report already contains a UTM filter and date range." }, actions: [{ kind: "click", sourceAssetId: "dashboard", control: "Twitter", evidenceId: "fact-1" }],
      result: { kind: "applied-view", sourceAssetId: "dashboard", surface: "UNIQUE VISITORS", change: "Copy the observed selected row count into the summary.", basis: "illustrative", evidenceId: "fact-1", valueDerivation: { kind: "selected-row-count", sourceAssetId: "dashboard", rowLabel: "Twitter", rowValue: "70", sourceMetricLabel: "Visitors", outputLabel: "UNIQUE VISITORS", outputBefore: "101", context: ["Last 30 days", "UTM Medium: social", "example.com"] } },
    } }], limitations: ["The result is an illustrative reconstruction, not an executed authenticated session."],
  }, "a".repeat(64), { version: 3, workflowSelection: true });
  const element = (id: string, text: string, x: number, y: number, width: number, type: UiDocument["elements"][number]["type"] = "text"): UiDocument["elements"][number] => ({ id, text, type, rect: { x, y, width, height: .07 }, sourceRect: { x, y, width, height: .07 }, styleId: "body", textBasis: "source-ui", sourceAssetId: "dashboard", initiallyVisible: true });
  const elements = [element("summary-label", "UNIQUE VISITORS", .1, .25, .35), element("summary", "101", .1, .33, .2), element("row", "Twitter", .1, .6, .3, "list-item"), element("row-count", "70", .45, .6, .1), element("date", "Last 30 days", .1, .05, .3), element("filter", "UTM Medium: social", .45, .05, .4), element("site", "example.com", .1, .14, .3), element("metric-label", "Visitors", .45, .5, .2)];
  const document: UiDocument = {
    id: "traffic", sourceAssetIds: ["dashboard"], capabilityFactIds: ["fact-1"], viewport: { width: 1000, height: 600 }, styles: [{ id: "body", fill: "#ffffff", color: "#111111", borderColor: "transparent", fontSize: 24, fontWeight: 400, radius: 0 }], elements,
    states: [{ id: "observed", basis: "observed", sourceAssetId: "dashboard", evidenceIds: ["fact-1"], visibleElementIds: elements.map(element => element.id), selectedElementIds: ["filter"], textValues: [] }, { id: "segmented", basis: "illustrative", evidenceIds: ["fact-1"], visibleElementIds: elements.map(element => element.id), selectedElementIds: ["filter", "row"], textValues: [{ elementId: "summary", text: "70", textBasis: "source-ui" }] }],
    terminalResult: { version: 1, beforeStateId: "observed", afterStateId: "segmented", confirmationElementId: "row", resultElementIds: ["summary"], evidenceIds: ["fact-1"] },
    sourceValueDerivations: [{ kind: "selected-row-count", stateId: "segmented", targetElementId: "summary", sourceElementId: "row-count", sourceLabelElementId: "row", sourceMetricLabelElementId: "metric-label", targetLabelElementId: "summary-label", confirmationElementId: "row", contextElementIds: ["date", "filter", "site"], evidenceIds: ["fact-1"] }],
  };
  return { research, document };
}
function compile(document: UiDocument, research: Research) {
  return compileUiDocuments({ transportVersion: UI_TRANSPORT_VERSION, coordinateSpace: "normalized", sufficientEvidence: true, reason: "Synthetic source-bound fixture", documentsById: { traffic: document } }, input, evidence, research, { requireLaunchResult: true });
}
const rejected = (error: unknown) => error instanceof PipelineError;

test("one observed row count can drive an illustrative source-bound summary with context retained", () => {
  const { research, document } = fixture(), before = JSON.stringify(document), stage = compile(document, research);
  assert.equal(JSON.stringify(document), before); assert.deepEqual(stage.documents, [document]);
  assert.equal(stage.documents[0].states[1].textValues[0].textBasis, "source-ui");
  assert.equal(inspectLaunchResult(document).ready, true);
  validateUiBundle({ documents: stage.documents, sha256: stageDigest(stage) }, input, evidence, research);
  const constraints = uiDesignConstraints(research, { requireLaunchResult: true });
  assert.equal(constraints.targets[0].sourceValueDerivation, true);
  const schema = constrainedUiSchema(constraints) as any, target = schema.properties.documentsById.properties.traffic;
  assert.equal(target.properties.sourceValueDerivations, undefined);
  assert.equal(target.properties.terminalResult, undefined);
  assert.match(uiDesignRequest(research, evidence, research.documentTargets![0], 6000, { requireLaunchResult: true }).prompt, /No invented metrics|Never change secondary metrics/);
});

test("versioned row transport derives exact redundant references without repairing authored values or ambiguous labels", () => {
  const { research, document } = fixture(), compact = structuredClone(document);
  delete compact.sourceValueDerivations; delete compact.terminalResult; const original = JSON.stringify(compact);
  assert.deepEqual(compile(compact, research).documents, [document]); assert.equal(JSON.stringify(compact), original);
  assert.match(uiDesignRequest(research, evidence, research.documentTargets![0], 6000, { requireLaunchResult: true }).prompt, /omit sourceValueDerivations and terminalResult/);
  for (const mutate of [
    (d: UiDocument) => { d.elements.push({ ...d.elements.find(element => element.id === "row-count")!, id: "ambiguous-count" }); d.states.forEach(state => state.visibleElementIds.push("ambiguous-count")); },
    (d: UiDocument) => { d.states[1].textValues[0].text = "900"; },
    (d: UiDocument) => { d.states[1].textValues = []; },
    (d: UiDocument) => { d.states.reverse(); },
    (d: UiDocument) => { d.states[0].sourceAssetId = "another-source"; },
    (d: UiDocument) => { d.terminalResult = document.terminalResult; },
  ]) { const changed = structuredClone(compact); mutate(changed); const before = JSON.stringify(changed); assert.throws(() => compile(changed, research), rejected); assert.equal(JSON.stringify(changed), before); }
  assert.throws(() => compileUiDocuments({ sufficientEvidence: true, reason: "Legacy unmarked transport", documents: [compact] }, input, evidence, research, { requireLaunchResult: true }), rejected);
});

test("copied-count permission cannot bypass exact source, observed labels, context, result or selected control", () => {
  const changes: [string, (document: UiDocument) => void][] = [
    ["invented number", document => { document.states[1].textValues[0].text = "99"; }],
    ["example metric", document => { document.states[1].textValues[0].textBasis = "example-content"; }],
    ["hidden source count", document => { document.elements[3].initiallyVisible = false; document.states.forEach(state => state.visibleElementIds = state.visibleElementIds.filter(id => id !== "row-count")); }],
    ["wrong observed total", document => { document.elements[1].text = "102"; }],
    ["wrong observed row", document => { document.elements[2].text = "Facebook"; }],
    ["wrong summary label", document => { document.elements[0].text = "PAGEVIEWS"; }],
    ["wrong row metric label", document => { document.elements[7].text = "Pageviews"; }],
    ["metric label borrowed from summary", document => { document.sourceValueDerivations![0].sourceMetricLabelElementId = "summary-label"; }],
    ["other source", document => { document.elements[3].sourceAssetId = "different-dashboard"; }],
    ["reordered context", document => { document.sourceValueDerivations![0].contextElementIds.reverse(); }],
    ["missing context", document => { document.sourceValueDerivations![0].contextElementIds.pop(); }],
    ["fabricated date", document => { document.states[1].textValues.push({ elementId: "date", text: "Yesterday", textBasis: "example-content" }); }],
    ["dropped filter", document => { document.states[1].visibleElementIds = document.states[1].visibleElementIds.filter(id => id !== "filter"); }],
    ["changed source metric label", document => { document.states[1].textValues.push({ elementId: "metric-label", text: "Pageviews", textBasis: "example-content" }); }],
    ["changed row count", document => { document.states[1].textValues.push({ elementId: "row-count", text: "0", textBasis: "example-content" }); }],
    ["static text confirmation", document => { document.elements[2].type = "text"; }],
    ["same result and row count", document => { document.sourceValueDerivations![0].targetElementId = "row-count"; }],
    ["already selected row", document => { document.states[0].selectedElementIds.push("row"); }],
    ["dropped existing selection", document => { document.states[1].selectedElementIds = ["row"]; }],
    ["invented selection", document => { document.states[1].selectedElementIds.push("date"); }],
    ["observed final claim", document => { document.states[1].basis = "observed"; document.states[1].sourceAssetId = "dashboard"; }],
    ["wrong terminal control", document => { document.terminalResult!.confirmationElementId = "filter"; }],
    ["wrong terminal output", document => { document.terminalResult!.resultElementIds = ["row-count"]; }],
    ["result inside row", document => { document.elements[1].rect = { ...document.elements[2].rect }; }],
    ["unrelated evidence", document => { document.sourceValueDerivations![0].evidenceIds = ["fact-2"]; }],
    ["additional state", document => { document.states.push({ ...structuredClone(document.states[1]), id: "extra" }); }],
  ];
  for (const [name, change] of changes) { const { research, document } = fixture(); change(document); assert.throws(() => compile(document, research), rejected, name); }
});

test("derived views exclude unchanged unrelated metrics, rows, prose and graphical data but permit empty structural panels", () => {
  for (const [type, text] of [["text", "200"], ["text", "Another dashboard metric"], ["list-item", "Facebook"], ["button", "Export"], ["icon", ""], ["node", ""], ["text", ""]] as const) {
    const { research, document } = fixture();
    document.elements.push({ ...document.elements[0], id: "unrelated", type, text });
    document.states.forEach(state => state.visibleElementIds.push("unrelated"));
    assert.throws(() => compile(document, research), rejected, `${type}:${text}`);
  }
  const { research, document } = fixture();
  document.elements.push({ ...document.elements[0], id: "container", type: "panel", text: "" });
  document.states.forEach(state => state.visibleElementIds.push("container"));
  assert.deepEqual(compile(document, research).documents, [document]);
  document.elements.at(-1)!.text = "200";
  assert.throws(() => compile(document, research), rejected);
});

test("the cross-element exception requires both research witness and document binding and leaves old rules unchanged", () => {
  for (const absent of ["research", "document", "both"] as const) {
    const { research, document } = fixture();
    if (absent !== "document") delete research.documentTargets![0].workflow!.result.valueDerivation;
    if (absent !== "research") delete document.sourceValueDerivations;
    assert.throws(() => compile(document, research), rejected, absent);
  }
  const { research, document } = fixture(); delete research.documentTargets![0].workflow!.result.valueDerivation; delete document.sourceValueDerivations;
  document.states.pop(); delete document.terminalResult;
  const legacy = compileUiDocuments({ sufficientEvidence: true, reason: "Existing observed source", documents: [document] }, input, evidence, research);
  assert.deepEqual(legacy.documents, [document]);
  const grammar = constrainedUiSchema(uiDesignConstraints(research)) as any;
  assert.equal(grammar.properties.documentsById.properties.traffic.properties.sourceValueDerivations, undefined);
});

test("retained derivation validation rejects changed proof even with a recomputed UI stage hash", () => {
  const { research, document } = fixture(), stage = compile(document, research);
  stage.documents[0].states[1].textValues[0].text = "71";
  assert.throws(() => validateUiBundle({ documents: stage.documents, sha256: stageDigest(stage) }, input, evidence, research), rejected);
  const altered = fixture(); altered.research.documentTargets![0].workflow!.actions[0].control = "Other source";
  assert.throws(() => compile(altered.document, altered.research), rejected);
});
