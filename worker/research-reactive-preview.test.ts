import test from "node:test";
import assert from "node:assert/strict";
import { literalPreviewValues, researchWorkflowIssues, researchWorkflowSchema, type LiteralPreview, type ResearchWorkflow } from "./research-workflow";
import type { Evidence } from "./types";

const witness = (): LiteralPreview => ({ kind: "literal-preview", sourceAssetId: "screen", codeText: "  username = 'Ada',", propertyName: "username", beforeLiteral: "Ada", afterLiteral: "Sam", templateText: "Hello {username},", outputBefore: "Hello Ada,", outputAfter: "Hello Sam,", context: ["Welcome email"] });
const proposal = (): ResearchWorkflow => ({ version: 1, observedStart: { sourceAssetId: "screen", description: "Code and its matching greeting preview" }, actions: [{ kind: "type", sourceAssetId: "screen", sourceElementId: "code", control: "  username = 'Ada',", evidenceId: "fact-1" }], result: { kind: "reactive-preview", sourceAssetId: "screen", surface: "Greeting", change: "The greeting reflects the illustrated name edit", basis: "illustrative", evidenceId: "fact-1", contentDerivation: witness() } });
const evidence: Evidence = { text: "Author an email template with code.", assets: [], uiSources: [{ id: "source", assetId: "screen", basis: "dom", context: "marketing-example", width: 800, height: 600, limitations: [], elements: [{ id: "code", role: "text", text: "  username = 'Ada',", rect: { x: .1, y: .1, width: .3, height: .1 } }] }] };
const issues = (workflow: ResearchWorkflow) => researchWorkflowIssues({ sourceAssetIds: ["screen"], capabilityFactIds: ["fact-1"], workflow }, evidence, [{ assetId: "screen", supportsFactIds: ["fact-1"] }], true, true);

test("a source-backed illustrative code edit substitutes one literal without inventing a confirmation control", () => {
  const raw = proposal(), before = JSON.stringify(raw);
  assert.deepEqual(literalPreviewValues(witness()), { codeAfter: "  username = 'Sam',", outputAfter: "Hello Sam," });
  assert.deepEqual(issues(researchWorkflowSchema.parse(raw)), []);
  assert.equal(JSON.stringify(raw), before);
  const double = { ...witness(), codeText: 'username="Ada";' };
  assert.equal(literalPreviewValues(double)?.codeAfter, 'username="Sam";');
});

test("string derivation rejects executable expressions, mismatched templates, unrelated output and ambiguous substitutions", () => {
  const changes: ((value: LiteralPreview) => void)[] = [
    value => { value.codeText = "username = run()"; },
    value => { value.codeText = "username = 'Ada'; send()"; },
    value => { value.codeText = "other = 'Ada'"; },
    value => { value.afterLiteral = "Ada"; },
    value => { value.afterLiteral = "Sam\nSend"; },
    value => { value.afterLiteral = "Sam');send()"; },
    value => { value.templateText = "Hello {username} {username},"; },
    value => { value.templateText = "Hello {unrelated},"; },
    value => { value.templateText = "Hello {username}, {company}"; },
    value => { value.outputBefore = "Hello user,"; },
    value => { value.outputAfter = "Email sent successfully"; },
    value => { value.context = ["Welcome email", "Welcome email"]; },
  ];
  for (const mutate of changes) { const value = witness(); mutate(value); assert.equal(literalPreviewValues(value), undefined, JSON.stringify(value)); }
});

test("the reactive exception cannot promote arbitrary code or click shortcuts into a completed workflow", () => {
  const changes: ((value: ResearchWorkflow) => void)[] = [
    value => { value.result.basis = "observed"; },
    value => { value.actions[0].kind = "click"; },
    value => { value.actions[0].control = "Get Started"; },
    value => { value.actions.push({ ...value.actions[0], kind: "click" }); },
    value => { value.result.contentDerivation!.sourceAssetId = "other"; },
    value => { delete value.result.contentDerivation; },
    value => { value.result.kind = "committed-content"; },
  ];
  for (const mutate of changes) { const value = proposal(); mutate(value); assert.ok(issues(value).some(issue => issue.code === "workflow_content_derivation")); }
  const ordinary = proposal(); ordinary.result.kind = "committed-content"; delete ordinary.result.contentDerivation;
  assert.ok(issues(ordinary).some(issue => issue.code === "workflow_control_role"));
  assert.ok(issues(ordinary).some(issue => issue.code === "workflow_confirmation_required"));
});
