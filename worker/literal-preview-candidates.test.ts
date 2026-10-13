import test from "node:test";
import assert from "node:assert/strict";
import { literalPreviewCandidates } from "./literal-preview-candidates";
import { researchRequest } from "./research";
import type { UiSource } from "./ui-sources";
import type { Evidence, WorkerInput } from "./types";
import { researchWorkflowIssues, type ResearchWorkflow } from "./research-workflow";

function source(): UiSource {
  const line = (id: string, text: string, index: number): UiSource["elements"][number] => ({ id, role: "text", text, selector: `:scope > pre > div:nth-of-type(${index})`, codeContainer: ":scope > pre", rect: { x: .05, y: .04 * index, width: .4, height: .03 } });
  return { id: "ui-editor", assetId: "editor", basis: "dom", context: "marketing-example", width: 1000, height: 700, limitations: [], elements: [
    line("assignment", "recipient = 'Mina',", 1), line("template", "Dear {recipient},", 2),
    line("wrong-heading", "Welcome to <strong>{company}</strong>, {recipient}!", 3),
    { id: "output", role: "text", text: "Dear Mina,", selector: ":scope > aside > p", rect: { x: .6, y: .1, width: .3, height: .06 } },
    { id: "heading", role: "text", text: "Welcome to Example, user!", selector: ":scope > aside > h2", rect: { x: .6, y: .02, width: .3, height: .06 } },
  ] };
}

test("literal candidates bind one exact observed code/template/preview tuple without proposing edits or claims", () => {
  const candidate = literalPreviewCandidates([source()])[0];
  assert.deepEqual({ ...candidate, id: undefined }, { id: undefined, sourceAssetId: "editor", sourceElementIds: { code: "assignment", template: "template", output: "output" }, codeText: "recipient = 'Mina',", propertyName: "recipient", beforeLiteral: "Mina", templateText: "Dear {recipient},", outputBefore: "Dear Mina,", contextChoices: [{ elementId: "heading", text: "Welcome to Example, user!" }] });
  assert.match(candidate.id, /^literal-[a-f0-9]{16}$/);
  assert.deepEqual(literalPreviewCandidates([source()]), [candidate]);
  const changed = source(); changed.elements[3].id = "another-output";
  assert.notEqual(literalPreviewCandidates([changed])[0].id, candidate.id);
});

test("candidates never join sources, containers, mismatching outputs or ambiguous declarations", () => {
  const withoutOutput = source(); withoutOutput.elements.splice(3, 1);
  const onlyOutput = source(); onlyOutput.assetId = "different-source"; onlyOutput.elements = [onlyOutput.elements[3]];
  assert.deepEqual(literalPreviewCandidates([withoutOutput, onlyOutput]), []);
  for (const change of [
    (s: UiSource) => { s.elements[1].codeContainer = ":scope > pre:nth-of-type(2)"; },
    (s: UiSource) => { s.elements[3].text = "Dear another person,"; },
    (s: UiSource) => { s.elements.push({ ...s.elements[0], id: "duplicate" }); },
    (s: UiSource) => { s.elements.push({ ...s.elements[3], id: "duplicate" }); },
    (s: UiSource) => { s.elements[3].codeContainer = ":scope > pre"; },
    (s: UiSource) => { s.elements[3].selector = ":scope > pre > div"; },
    (s: UiSource) => { s.basis = "pixels"; },
  ]) { const s = source(); change(s); assert.deepEqual(literalPreviewCandidates([s]), []); }
});

test("candidate parser rejects execution, escapes, multiple interpolation, markup and truncated fragments", () => {
  for (const code of ["recipient = getName()", "recipient = 'Mi\\na'", "const recipient = 'Mina'", "recipient = 'Mina', extra = 1", "5recipient = 'Mina',"]) {
    const s = source(); s.elements[0].text = code; assert.deepEqual(literalPreviewCandidates([s]), []);
  }
  for (const template of ["{recipient} {company}", "{recipient} {recipient}", "<b>{recipient}</b>", "{recipient}", "${recipient}"]) {
    const s = source(); s.elements[1].text = template; s.elements[3].text = template.replaceAll("{recipient}", "Mina");
    assert.deepEqual(literalPreviewCandidates([s]), []);
  }
  const old = source(); delete old.elements[0].codeContainer; delete old.elements[1].codeContainer;
  assert.deepEqual(literalPreviewCandidates([old]), [], "legacy truncated pre inventory is not promoted to line evidence");
});

test("candidate discovery stays bounded and stable across source inventory order", () => {
  const sources = Array.from({ length: 6 }, (_, i) => ({ ...source(), assetId: `source-${i}` }));
  const forward = literalPreviewCandidates(sources);
  assert.equal(forward.length, 3); assert.deepEqual(literalPreviewCandidates([...sources].reverse()), forward);
  const s = source(); s.elements = [...Array.from({ length: 48 }, (_, i) => ({ ...s.elements[4], id: `heading-${i}` })), ...s.elements];
  assert.deepEqual(literalPreviewCandidates([s]), []);
});

test("context choices are exact unchanged same-panel text and never invent a page-wide filename or changed-name label", () => {
  const s = source();
  s.elements.push({ ...s.elements[0], id: "company", text: "organization = 'Example'," }, { ...s.elements[4], id: "dependent", text: "Mina's workspace" });
  const choices = literalPreviewCandidates([s])[0].contextChoices;
  assert.deepEqual(choices, [{ elementId: "company", text: "organization = 'Example'," }, { elementId: "heading", text: "Welcome to Example, user!" }]);
  assert.ok(!JSON.stringify(choices).includes("workspace"));
  s.elements = s.elements.filter(element => ["assignment", "template", "output"].includes(element.id));
  assert.deepEqual(literalPreviewCandidates([s]), [], "no observed unchanged context means no self-contained candidate");
});

test("context eligibility rejects duplicate source strings instead of choosing the first and preserves complete ancestor labels", () => {
  const s = source(), heading = s.elements[4];
  s.elements.push({ ...heading, id: "nested-brand", text: "Example", selector: heading.selector + " > strong", rect: { x: .7, y: .03, width: .1, height: .03 } });
  const expected = [{ elementId: "heading", text: "Welcome to Example, user!" }];
  assert.deepEqual(literalPreviewCandidates([s])[0].contextChoices, expected, "the complete actual ancestor represents its own inline fragment once");
  s.elements[s.elements.length - 1].selector = heading.selector + "-other > strong";
  assert.deepEqual(literalPreviewCandidates([s])[0].contextChoices, [...expected, { elementId: "nested-brand", text: "Example" }], "selector prefix is not an ancestry boundary");
  s.elements.push({ ...s.elements[s.elements.length - 1], id: "second-brand", selector: ":scope > aside > p > strong", rect: { x: .7, y: .3, width: .1, height: .03 } });
  assert.deepEqual(literalPreviewCandidates([s])[0].contextChoices, expected, "two distinct owners are ambiguous even when only one is offered first");
  const tailDuplicate = source(); tailDuplicate.elements.push(...Array.from({ length: 43 }, (_, index) => ({ ...heading, id: `unrelated-${index}`, text: `Unrelated ${index}` })), { ...heading, id: "duplicate-outside-prefix" });
  assert.ok(tailDuplicate.elements.length > 48);
  assert.ok(!literalPreviewCandidates([tailDuplicate])[0]?.contextChoices.some(choice => choice.text === heading.text), "full inventory counts include records beyond candidate discovery prefix");
  for (const index of [0, 1, 3]) {
    const coreDuplicate = source(); coreDuplicate.elements.push({ ...coreDuplicate.elements[index], id: "another-owner", selector: ":scope > other > p", codeContainer: undefined });
    assert.deepEqual(literalPreviewCandidates([coreDuplicate]), [], "candidate core joins obey the same exact source-wide uniqueness as seeds");
  }
});

test("fresh candidate offers cap unchanged anchors at three while canonical verification retains four", () => {
  const s = source();
  for (let index = 0; index < 5; index++) s.elements.push({ ...s.elements[4], id: `context-${index}`, text: `Observed context ${index}`, selector: `:scope > aside > p:nth-of-type(${index + 2})`, rect: { x: .6, y: .2 + index * .1, width: .3, height: .06 } });
  const before = JSON.stringify(s), offered = literalPreviewCandidates([s])[0], canonical = literalPreviewCandidates([s], 4)[0];
  assert.equal(offered.contextChoices.length, 3); assert.equal(canonical.contextChoices.length, 4); assert.deepEqual(offered.contextChoices, canonical.contextChoices.slice(0, 3)); assert.equal(JSON.stringify(s), before);
});

test("clipped code containers, their ancestors and unmarked code fragments cannot become independent context",()=>{
  const s=source(),original=structuredClone(s);
  s.elements.push(
    {...s.elements[0],id:"complete-declaration",text:"const WelcomeMessage = ({",selector:":scope > pre > div:nth-of-type(4)"},
    {...s.elements[4],id:"clipped-pre",text:"1import { Body, Button, Column, Container, Head, Heading } from 'mail-ui'; 2import * as React",selector:":scope > pre",rect:{x:0,y:0,width:.5,height:1}},
    {...s.elements[4],id:"ancestor",text:"A truncated aggregate of the editor and preview",selector:":scope",rect:{x:0,y:0,width:1,height:1}},
    {...s.elements[4],id:"unmarked-fragment",text:"A clipped syntax descendant",selector:":scope > pre > div:nth-of-type(6) > span"},
    {...s.elements[4],id:"independent-preview",text:"Preview context",selector:":scope > preview",rect:{x:.6,y:.3,width:.3,height:.1}},
  );
  const before=JSON.stringify(s),candidate=literalPreviewCandidates([s])[0];
  assert.deepEqual(candidate.contextChoices,[{elementId:"complete-declaration",text:"const WelcomeMessage = ({"},{elementId:"heading",text:"Welcome to Example, user!"},{elementId:"independent-preview",text:"Preview context"}]);
  assert.equal(JSON.stringify(s),before);assert.deepEqual(candidate.sourceElementIds,literalPreviewCandidates([original])[0].sourceElementIds);
  s.elements=s.elements.filter(e=>!["complete-declaration","heading","independent-preview"].includes(e.id));
  assert.deepEqual(literalPreviewCandidates([s]),[],"aggregate-only context cannot satisfy the source witness");
});

test("known candidate tuple and context mismatches fail early without treating missing DOM as absence", () => {
  const workflow: ResearchWorkflow = { version: 1, observedStart: { sourceAssetId: "editor", description: "Observed code and preview" }, actions: [{ kind: "type", sourceAssetId: "editor", control: "recipient = 'Mina',", sourceElementId: "assignment", evidenceId: "fact-1" }], result: { kind: "reactive-preview", sourceAssetId: "editor", surface: "Greeting", change: "Illustrative name substitution", basis: "illustrative", evidenceId: "fact-1", contentDerivation: { kind: "literal-preview", sourceAssetId: "editor", codeText: "recipient = 'Mina',", propertyName: "recipient", beforeLiteral: "Mina", afterLiteral: "Sam", templateText: "Dear {recipient},", outputBefore: "Dear Mina,", outputAfter: "Dear Sam,", context: ["Welcome to Example, user!"] } } };
  const check = (w: ResearchWorkflow, sources = [source()]) => researchWorkflowIssues({ sourceAssetIds: ["editor"], capabilityFactIds: ["fact-1"], workflow: w }, { uiSources: sources } as Evidence, [{ assetId: "editor", supportsFactIds: ["fact-1"] }], true, true);
  assert.deepEqual(check(workflow), []);
  for (const mutate of [
    (w: ResearchWorkflow) => { w.result.contentDerivation!.context = ["page-wide-filename.tsx"]; },
    (w: ResearchWorkflow) => { const c = w.result.contentDerivation!; c.templateText = "Welcome {recipient}!"; c.outputBefore = "Welcome Mina!"; c.outputAfter = "Welcome Sam!"; },
    (w: ResearchWorkflow) => { delete w.actions[0].sourceElementId; w.result.contentDerivation!.context = ["invented heading"]; },
  ]) { const changed = structuredClone(workflow); mutate(changed); assert.ok(check(changed).some(issue => issue.code === "workflow_content_derivation")); }
  const pixelOnly = structuredClone(workflow); delete pixelOnly.actions[0].sourceElementId; pixelOnly.result.contentDerivation!.context = ["Other context visible in original pixels"];
  assert.deepEqual(check(pixelOnly, []), [], "pixel-only context remains subject to original UI/source review, not invented negative evidence");
});

test("research receives exact candidates only for supplied assets and keeps capability and fact closure explicit", () => {
  const evidence = { text: "An observed authoring capability.", assets: [{ id: "editor", usage: "output", kind: "image", width: 1000, height: 700, path: "assets/editor.jpg", rights: "Fixture" }], uiSources: [source()] } as Evidence;
  const input = { videoType: "launch" } as WorkerInput;
  const prompt = researchRequest(input, evidence).prompt;
  assert.ok(prompt.includes(JSON.stringify(literalPreviewCandidates(evidence.uiSources!))));
  assert.match(prompt, /observed BEFORE assignment/); assert.match(prompt, /Static correspondence does not establish automatic, live or instant updates/);
  assert.match(prompt, /check this closure/);
  evidence.assets = [];
  assert.match(researchRequest(input, evidence).prompt, /SAME-SOURCE LITERAL CANDIDATES[^\n]*: \[\]/);
});
