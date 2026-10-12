import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Research } from "./research";
import { PipelineError, type Evidence } from "./types";
import { decodeUiTransport, terminalDeclarationIssues, uiDesignRequest, uiDocumentSchema, validateUiActions, validateUiDocuments, type UiDocument } from "./ui-reconstruction";

function scope(document: UiDocument) {
  const research: Research = { version: 3, sufficientEvidence: true, reason: "Offline terminal reference fixture", summary: "Offline terminal reference fixture", jobId: "terminal-fixture", evidenceSha256: "a".repeat(64), product: "Fixture", facts: document.capabilityFactIds.map(evidenceId => ({ evidenceId, kind: "feature", label: "Observed operation", quote: "Observed operation and its result." })), limitations: [], documentTargets: [{ id: document.id, sourceAssetIds: document.sourceAssetIds, capabilityFactIds: document.capabilityFactIds, goal: "Open a chooser and confirm its option" }], visuals: document.sourceAssetIds.map(assetId => ({ assetId, role: "product_ui", showsProductUi: true, description: "Observed fixture", supportsFactIds: document.capabilityFactIds })) };
  const evidence: Evidence = { text: "Observed operation and its result.", assets: document.sourceAssetIds.map(id => ({ id, path: `assets/${id}.jpg`, kind: "image", usage: "output", width: 900, height: 560, rights: "Offline source fixture" })) };
  return { research, evidence };
}
function document(): UiDocument {
  const rect = { x: .1, y: .1, width: .8, height: .2 };
  const base = { rect, sourceRect: rect, sourceAssetId: "source", styleId: "plain", textBasis: "source-ui" as const };
  return { id: "chooser", sourceAssetIds: ["source"], capabilityFactIds: ["fact-1"], viewport: { width: 500, height: 300 }, styles: [{ id: "plain", fill: "#ffffff", color: "#111111", borderColor: "transparent", fontSize: 18, fontWeight: 400, radius: 0 }], elements: [
    { ...base, id: "open", type: "button", text: "Choose", initiallyVisible: true },
    { ...base, id: "choice", type: "list-item", text: "Alex", initiallyVisible: false },
    { ...base, id: "result", type: "text", text: "Saved Alex", textBasis: "example-content", initiallyVisible: false },
  ], states: [
    { id: "initial", basis: "observed", sourceAssetId: "source", evidenceIds: ["fact-1"], visibleElementIds: ["open"], selectedElementIds: [], textValues: [] },
    { id: "choices", basis: "observed", sourceAssetId: "source", evidenceIds: ["fact-1"], visibleElementIds: ["choice"], selectedElementIds: [], textValues: [] },
    { id: "completed", basis: "illustrative", evidenceIds: ["fact-1"], visibleElementIds: ["result"], selectedElementIds: [], textValues: [] },
  ], terminalResult: { version: 1, beforeStateId: "choices", afterStateId: "completed", confirmationElementId: "choice", resultElementIds: ["result"], evidenceIds: ["fact-1"] } };
}

test("retained Plausible v11 names the unavailable confirmation without changing or accepting its response", () => {
  const bytes = readFileSync(join(process.cwd(), "tests/fixtures/ui-terminal/plausible-v11.json"), "utf8"), raw = JSON.parse(bytes), before = JSON.stringify(raw);
  const decoded = decodeUiTransport(raw) as { documentsById: Record<string, UiDocument> }, doc = uiDocumentSchema.parse(decoded.documentsById["sources-segmentation"]), { research, evidence } = scope(doc);
  assert.deepEqual(terminalDeclarationIssues(doc), [{ code: "trigger_not_visible_before", stateId: "state-channels", elementId: "row-twitter" }]);
  assert.throws(() => validateUiDocuments([doc], research, evidence), error => error instanceof PipelineError && error.code === "production_stage_changed" && error.message.includes('"trigger_not_visible_before"') && error.message.includes('"row-twitter"'));
  assert.equal(JSON.stringify(raw), before);
  assert.equal(readFileSync(join(process.cwd(), "tests/fixtures/ui-terminal/plausible-v11.json"), "utf8"), bytes);
});

test("a real prerequisite snapshot may precede final confirmation without replacing the observed initial state", () => {
  const doc = document(), { research, evidence } = scope(doc), before = JSON.stringify(doc);
  assert.deepEqual(terminalDeclarationIssues(doc), []);
  assert.doesNotThrow(() => validateUiDocuments([doc], research, evidence));
  assert.doesNotThrow(() => validateUiActions(doc, [
    { kind: "click", targetId: "open", atFrame: 30, durationFrames: 6, evidenceId: "fact-1" },
    { kind: "state", stateId: "choices", atFrame: 40, durationFrames: 1, evidenceId: "fact-1" },
    { kind: "click", targetId: "choice", atFrame: 50, durationFrames: 6, evidenceId: "fact-1" },
    { kind: "state", stateId: "completed", atFrame: 60, durationFrames: 1, evidenceId: "fact-1" },
  ]));
  doc.terminalResult!.beforeStateId = "initial";
  assert.deepEqual(terminalDeclarationIssues(doc), [{ code: "trigger_not_visible_before", stateId: "initial", elementId: "choice" }]);
  assert.throws(() => validateUiDocuments([doc], research, evidence), /trigger_not_visible_before/);
  doc.terminalResult!.beforeStateId = "choices";
  assert.equal(JSON.stringify(doc), before);
});

test("specific terminal diagnostics preserve all former state, element and capability rejection gates", () => {
  const changes: [string, (doc: UiDocument) => void][] = [
    ["missing_before_state", doc => { doc.terminalResult!.beforeStateId = "missing"; }],
    ["missing_after_state", doc => { doc.terminalResult!.afterStateId = "missing"; }],
    ["identical_result_states", doc => { doc.terminalResult!.afterStateId = "choices"; }],
    ["missing_trigger", doc => { doc.terminalResult!.confirmationElementId = "missing"; }],
    ["trigger_not_visible_before", doc => { doc.states[1].visibleElementIds = []; }],
    ["duplicate_result_elements", doc => { doc.terminalResult!.resultElementIds.push("result"); }],
    ["missing_result_element", doc => { doc.terminalResult!.resultElementIds = ["missing"]; }],
    ["result_not_visible_after", doc => { doc.states[2].visibleElementIds = []; }],
    ["duplicate_result_evidence", doc => { doc.terminalResult!.evidenceIds.push("fact-1"); }],
    ["unsupported_result_evidence", doc => { doc.terminalResult!.evidenceIds = ["fact-99"]; }],
    ["result_evidence_missing_after", doc => { doc.capabilityFactIds.push("fact-2"); doc.terminalResult!.evidenceIds = ["fact-2"]; }],
  ];
  for (const [code, change] of changes) {
    const doc = document(); change(doc); const before = JSON.stringify(doc), { research, evidence } = scope(doc);
    assert.ok(terminalDeclarationIssues(doc).some(issue => issue.code === code), code);
    assert.throws(() => validateUiDocuments([doc], research, evidence), error => error instanceof PipelineError && error.code === "production_stage_changed", code);
    assert.equal(JSON.stringify(doc), before);
  }
});

test("literal-preview trigger visibility remains mandatory and terminal absence keeps legacy behavior", () => {
  const doc = document();
  doc.terminalResult = { version: 2, beforeStateId: "initial", afterStateId: "completed", trigger: { kind: "code-edit-complete", elementId: "choice", text: "name = 'Ada'", evidenceId: "fact-1" }, resultElementIds: ["result"], evidenceIds: ["fact-1"] };
  assert.deepEqual(terminalDeclarationIssues(doc), [{ code: "trigger_not_visible_before", stateId: "initial", elementId: "choice" }]);
  delete doc.terminalResult;
  assert.deepEqual(terminalDeclarationIssues(doc), []);
  const { research, evidence } = scope(doc); assert.doesNotThrow(() => validateUiDocuments([doc], research, evidence));
});

test("generation explains prerequisite visibility and incompatible source contexts without authorizing invented states", () => {
  const doc = document(), { research, evidence } = scope(doc), before = JSON.stringify({ research, evidence });
  const request = uiDesignRequest(research, evidence, research.documentTargets![0], 6000, { requireLaunchResult: true });
  assert.match(request.prompt, /beforeStateId is the complete snapshot immediately BEFORE the final confirmation, not necessarily states\[0\]/);
  assert.match(request.prompt, /A control appearing only in afterStateId cannot cause that state/);
  assert.match(request.prompt, /Compare site\/account identity, date range, active filters and view settings/);
  assert.match(request.prompt, /proportional bar, colored row background or hover is not proof of an active selection/);
  assert.match(request.prompt, /existing 4-state limit/);
  assert.match(request.prompt, /return sufficientEvidence:false/);
  assert.equal(JSON.stringify({ research, evidence }), before);
});
