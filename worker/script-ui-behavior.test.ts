import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { uiActionBehaviorIssues } from "./script-ui-behavior";
import type { UiAction, UiDocument } from "./ui-reconstruction";
import { validateScript } from "./scripting";
import { compileScriptWithRetry, SCRIPT_RETRY_PATH, scriptCorrectionDiagnostics } from "./script-review";
import { stageDigest } from "./research";
import { PipelineError } from "./types";
import type { Providers } from "./providers";

function document(): UiDocument {
  const rect={x:.1,y:.1,width:.7,height:.1},style={id:"base",fill:"#222222",color:"#eeeeee",borderColor:"transparent",fontSize:16,fontWeight:400,radius:4};
  return {id:"editor",sourceAssetIds:["source"],capabilityFactIds:["fact-1"],viewport:{width:800,height:600},styles:[style,{...style,id:"selected",fill:"#444444"}],elements:[
    {id:"input",type:"input",rect,sourceRect:rect,sourceAssetId:"source",styleId:"base",text:"[[I thin]]",textBasis:"source-ui",initiallyVisible:true},
    {id:"choice",type:"list-item",rect:{...rect,y:.3},sourceRect:rect,sourceAssetId:"source",styleId:"base",selectedStyleId:"selected",text:"I think therefore I am",textBasis:"source-ui",initiallyVisible:true},
    {id:"result",type:"text",rect,sourceRect:rect,sourceAssetId:"source",styleId:"base",text:"[[I think therefore I am]]",textBasis:"example-content",initiallyVisible:false},
  ],states:[
    {id:"initial",basis:"observed",sourceAssetId:"source",evidenceIds:["fact-1"],visibleElementIds:["input","choice"],selectedElementIds:[],textValues:[]},
    {id:"hover",basis:"illustrative",evidenceIds:["fact-1"],visibleElementIds:["input","choice"],selectedElementIds:["choice"],textValues:[]},
    {id:"chosen",basis:"illustrative",evidenceIds:["fact-1"],visibleElementIds:["result"],selectedElementIds:[],textValues:[]},
  ]};
}
const type=(text:string):UiAction=>({kind:"type",targetId:"input",atFrame:30,durationFrames:18,text,evidenceId:"fact-1"});
const state=(stateId:string,atFrame=60):UiAction=>({kind:"state",stateId,atFrame,durationFrames:8,evidenceId:"fact-1"});
const click:UiAction={kind:"click",targetId:"choice",atFrame:50,durationFrames:6,evidenceId:"fact-1"};

test("typing is compared with the effective prior input, not static document text",()=>{
  assert.deepEqual(uiActionBehaviorIssues(document(),[type("[[I thin]]")]),[{actionIndex:0,code:"typing_has_no_net_change"}]);
  assert.deepEqual(uiActionBehaviorIssues(document(),[type("[[New idea]]")]),[]);
  const doc=document();doc.states.push({...doc.states[0],id:"different",basis:"illustrative",textValues:[{elementId:"input",text:"[[New idea]]",textBasis:"example-content"}]});
  assert.equal(uiActionBehaviorIssues(doc,[state("different",30),{...type("[[New idea]]"),atFrame:40}]).at(-1)?.code,"typing_has_no_net_change");
});
test("state and select require rendered style/text/visibility changes, not metadata",()=>{
  assert.equal(uiActionBehaviorIssues(document(),[state("initial")])[0].code,"state_has_no_visible_change");
  assert.deepEqual(uiActionBehaviorIssues(document(),[state("hover")]),[]);
  for(const identical of[false,true]){
    const doc=document();if(identical)doc.styles[1]={...doc.styles[0],id:"selected"};else delete doc.elements[1].selectedStyleId;
    assert.equal(uiActionBehaviorIssues(doc,[state("hover")])[0].code,"state_has_no_visible_change");
    assert.equal(uiActionBehaviorIssues(doc,[{kind:"select",targetId:"choice",atFrame:30,durationFrames:6,evidenceId:"fact-1"}])[0].code,"selection_has_no_visible_change");
  }
});
test("a chosen list result needs the actual choice confirmed; unrelated automatic results do not",()=>{
  const doc=document(),snapshot=JSON.stringify(doc);
  assert.equal(uiActionBehaviorIssues(doc,[state("chosen")])[0].code,"chosen_result_requires_confirmation");
  assert.deepEqual(uiActionBehaviorIssues(doc,[click,state("chosen")]),[]);
  assert.deepEqual(uiActionBehaviorIssues(doc,[{...click,kind:"select"},state("chosen")]),[]);
  assert.equal(uiActionBehaviorIssues(doc,[{...click,kind:"pointer"},state("chosen")])[0].code,"chosen_result_requires_confirmation");
  assert.equal(JSON.stringify(doc),snapshot);
  doc.elements[2].text="Different supported automatic state";
  assert.deepEqual(uiActionBehaviorIssues(doc,[state("chosen")]),[]);
});

test("fresh state actions cannot implicitly roll a still-visible typed input back to inherited source text",()=>{
  const doc=document();delete doc.elements[1].selectedStyleId;
  const actions=[type("[[I think"),state("hover",54),{...click,atFrame:66},state("chosen",80)],before=JSON.stringify({doc,actions});
  assert.deepEqual(uiActionBehaviorIssues(doc,actions,{rejectImplicitTypedReset:true}),[{actionIndex:1,code:"state_resets_typed_input"}]);
  assert.deepEqual(uiActionBehaviorIssues(doc,actions),[]); // Existing retained contract remains readable.
  assert.equal(JSON.stringify({doc,actions}),before);
  // A next action at the exact transition boundary must not conceal the rollback.
  const boundary=[type("[[I think"),state("hover",54),{...type("[[Different"),atFrame:62}];
  assert.ok(uiActionBehaviorIssues(doc,boundary,{rejectImplicitTypedReset:true}).some(issue=>issue.actionIndex===1&&issue.code==="state_resets_typed_input"));
});

test("explicit typed-value preservation, clearing or replacement and hidden completed inputs remain valid",()=>{
  for(const text of["[[I think","","[[Another note]]"]){
    const doc=document();doc.states[1].textValues=[{elementId:"input",text,textBasis:"example-content"}];
    const before=JSON.stringify(doc);
    assert.deepEqual(uiActionBehaviorIssues(doc,[type("[[I think"),state("hover")],{rejectImplicitTypedReset:true}),[]);
    assert.equal(JSON.stringify(doc),before);
  }
  assert.deepEqual(uiActionBehaviorIssues(document(),[type("[[I think"),click,state("chosen")],{rejectImplicitTypedReset:true}),[]);
  // A source state transition without preceding authored typing is outside this rule.
  assert.deepEqual(uiActionBehaviorIssues(document(),[state("hover")],{rejectImplicitTypedReset:true}),[]);
});

test("an explicitly preserved typed value stays protected from a later implicit reset",()=>{
  const doc=document();doc.states.push({...doc.states[1],id:"preserve",textValues:[{elementId:"input",text:"[[I think",textBasis:"example-content"}]});
  const actions=[type("[[I think"),state("preserve",50),state("hover",70)];
  assert.deepEqual(uiActionBehaviorIssues(doc,actions,{rejectImplicitTypedReset:true}),[{actionIndex:2,code:"state_resets_typed_input"}]);
  doc.states[3].textValues[0].text=""; // An explicit clear ends this authored typed value.
  assert.equal(uiActionBehaviorIssues(doc,actions,{rejectImplicitTypedReset:true}).some(issue=>issue.code==="state_resets_typed_input"),false);
});

const strictGraphics = { rejectUnsupportedGraphicCreation: true };
function graphicDocument(type: "panel" | "node" | "edge" | "icon" = "panel") {
  const doc = document(), rect = { x: .6, y: .6, width: .3, height: .3 };
  doc.elements.push({ id: "new-surface", type, rect, sourceRect: rect, sourceAssetId: "source", styleId: "base", text: "", textBasis: "source-ui", initiallyVisible: false });
  doc.states.push({ id: "next", basis: "illustrative", evidenceIds: ["fact-1"], visibleElementIds: ["input", "choice", "new-surface"], selectedElementIds: [], textValues: [] });
  return doc;
}

test("fresh illustrative states cannot create an empty graphic through clicks, pointer movement or state names", () => {
  for (const type of ["panel", "node", "edge", "icon"] as const) {
    const doc = graphicDocument(type), actions = [click, state("next")], before = JSON.stringify({ doc, actions });
    assert.deepEqual(uiActionBehaviorIssues(doc, actions, strictGraphics), [{ actionIndex: 1, code: "unsupported_graphic_creation" }]);
    assert.deepEqual(uiActionBehaviorIssues(doc, actions), []);
    assert.equal(JSON.stringify({ doc, actions }), before);
    doc.states[3].id = "created-by-a-supported-operation"; actions[1].stateId = doc.states[3].id;
    assert.equal(uiActionBehaviorIssues(doc, actions, strictGraphics)[0].code, "unsupported_graphic_creation");
  }
  const doc = graphicDocument(), actions = [click, state("next"), state("hover", 68)];
  assert.ok(uiActionBehaviorIssues(doc, actions, strictGraphics).some(issue => issue.actionIndex === 1 && issue.code === "unsupported_graphic_creation"));
});

test("ordinary delayed selection, existing graphics, observed states and nonempty glyphs keep compatibility", () => {
  assert.deepEqual(uiActionBehaviorIssues(document(), [click, state("hover")], strictGraphics), []);
  for (const variant of ["already-visible", "observed", "glyph"] as const) {
    const doc = graphicDocument(variant === "glyph" ? "icon" : "panel");
    if (variant === "already-visible") { doc.elements[3].initiallyVisible = true; doc.states[0].visibleElementIds.push("new-surface"); doc.states[3].selectedElementIds = ["choice"]; }
    if (variant === "observed") { doc.states[3].basis = "observed"; doc.states[3].sourceAssetId = "source"; }
    if (variant === "glyph") doc.elements[3].text = "+";
    assert.deepEqual(uiActionBehaviorIssues(doc, [state("next")], strictGraphics), []);
  }
});

test("new panels can contain complete visible text or painted controls, but empty or overlapping panels cannot certify graphics", () => {
  for (const type of ["text", "input", "textarea", "button", "tab", "list-item"] as const) {
    const doc = graphicDocument(), rect = { x: .64, y: .64, width: .2, height: .1 };
    doc.elements.push({ id: "content", type, rect, sourceRect: rect, sourceAssetId: "source", styleId: "base", text: type === "text" ? "Choose an item" : "", textBasis: "source-ui", initiallyVisible: false });
    doc.states[3].visibleElementIds.push("content");
    assert.deepEqual(uiActionBehaviorIssues(doc, [state("next")], strictGraphics), []);
    doc.elements[4].rect.x = .85; // Overlap is not complete containment.
    assert.equal(uiActionBehaviorIssues(doc, [state("next")], strictGraphics)[0].code, "unsupported_graphic_creation");
  }
  for (const variant of ["empty-panel", "hidden-text", "invisible-control"] as const) {
    const doc = graphicDocument(), rect = { x: .64, y: .64, width: .2, height: .1 };
    doc.elements.push({ id: "content", type: variant === "empty-panel" ? "panel" : variant === "hidden-text" ? "text" : "input", rect, sourceRect: rect, sourceAssetId: "source", styleId: "base", text: variant === "hidden-text" ? "Hidden" : "", textBasis: "source-ui", initiallyVisible: false });
    if (variant !== "hidden-text") doc.states[3].visibleElementIds.push("content");
    if (variant === "invisible-control") { doc.styles.push({ ...doc.styles[0], id: "invisible", fill: "transparent", borderColor: "transparent" }); doc.elements[4].styleId = "invisible"; }
    assert.equal(uiActionBehaviorIssues(doc, [state("next")], strictGraphics)[0].code, "unsupported_graphic_creation");
  }
});

test("retained canvas example fails the fresh graphic preflight with an actionable correction path and unchanged source bytes", async t => {
  const root = resolve(".local/engine-batch-acceptance-canvas-20261002"), names = ["analysis/script.json", "analysis/research.json", "analysis/evidence.json", "analysis/ui.json", "acceptance-result.json", "analysis/model-3-script.json"];
  let before: string[];
  try { before = await Promise.all(names.map(name => readFile(join(root, name), "utf8"))); }
  catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") { t.skip("Saved local canvas evidence is unavailable"); return; } throw error; }
  const [script, research, evidence, uiStage, result, raw] = before.map(text => JSON.parse(text)), ui = { documents: uiStage.documents, sha256: stageDigest(uiStage) };
  const sceneIndex = script.scenes.findIndex((scene: { presentation?: { visual?: { kind: string } } }) => scene.presentation?.visual?.kind === "ui-demo"), visual = script.scenes[sceneIndex].presentation.visual;
  const doc = ui.documents.find((doc: UiDocument) => doc.id === visual.documentId);
  assert.deepEqual(uiActionBehaviorIssues(doc, visual.actions, strictGraphics), [{ actionIndex: 2, code: "unsupported_graphic_creation" }]);
  validateScript(script, result.input, evidence, research, undefined, ui); // Retained contract remains readable.
  let rejection: PipelineError | undefined;
  try { validateScript(script, result.input, evidence, research, undefined, ui, { freshDirected: true }); } catch (error) { if (error instanceof PipelineError) rejection = error; else throw error; }
  assert.ok(rejection); assert.match(rejection.message, /unsupported_graphic_creation/);
  const diagnostics = scriptCorrectionDiagnostics(raw, rejection, research, evidence, ui, true);
  assert.ok(diagnostics.behaviorIssues.some(issue => issue.code === "unsupported_graphic_creation" && JSON.stringify(issue.path) === JSON.stringify(["scenes", sceneIndex, "presentation", "visual", "actions", 2])));
  const repair = { plan: { scenes: script.scenes, creativeDirection: script.creativeDirection, uiDocuments: ui.documents, production: { uiSha256: ui.sha256, shotRecipeSha256: script.shotRecipeSha256, workflowCoherence: { version: 2 } } }, findings: [] };
  assert.throws(() => validateScript(script, result.input, evidence, research, repair as never, ui), error => error instanceof PipelineError && /unsupported_graphic_creation/.test(error.message));
  // The one existing correction can honestly stop for insufficient evidence; it cannot replenish.
  const prefix = join(tmpdir(), "graphic-correction-test-"), workspace = await mkdtemp(prefix);
  await mkdir(join(workspace, "analysis"));
  t.after(async () => { if (dirname(resolve(workspace)) !== resolve(tmpdir()) || !workspace.startsWith(prefix)) throw new Error("Unsafe cleanup"); await rm(workspace, { recursive: true, force: true }); });
  let calls = 0;
  const providers = { ledger: { modelCalls: 3, inputTokens: 20000, outputTokens: 5000, reservedInputTokens: 0, reservedOutputTokens: 0 }, prepareClaude: async (purpose: string, prompt: string) => {
    assert.equal(purpose, "script"); assert.match(prompt, /unsupported_graphic_creation/);
    return async () => { calls++; return { sufficientEvidence: false, reason: "Current documented actions cannot create this result." }; };
  } } as unknown as Providers;
  const options = { input: result.input, research, evidence, ui, workspace, prompt: "Use unchanged verified sources.", hooks: { persist: async () => {} }, providers, directed: true, recipes: true, workflow: true as const };
  await assert.rejects(compileScriptWithRetry(raw, options), error => error instanceof PipelineError && error.status === "needs_input");
  assert.equal(calls, 1);
  const marker = JSON.parse(await readFile(join(workspace, SCRIPT_RETRY_PATH), "utf8"));
  assert.equal(marker.status, "completed"); assert.equal(marker.outcome, "invalid");
  await assert.rejects(compileScriptWithRetry(raw, options), error => error instanceof PipelineError && error.code === "production_stage_changed");
  assert.equal(calls, 1);
  assert.deepEqual(await Promise.all(names.map(name => readFile(join(root, name), "utf8"))), before);
});
