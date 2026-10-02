import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { expectedUiState,uiActionSampleFrames } from "./ui-state";
import { uiEvaluatorSource,uiDocumentHtml,uiCompositionCss } from "./ui-composition";
import { motionTimingForPresentation,uiActionEndFrame } from "./motion-timing";
import { motionHtml } from "./motion-composition";
import { motionUsage } from "./motion-assets";
import type { UiAction,UiDocument } from "./ui-reconstruction";
import type { Plan,Scene } from "./types";

function fixture(){
 const rect={x:.1,y:.2,width:.7,height:.15};
 const document:UiDocument={id:"source-ui",sourceAssetIds:["source"],capabilityFactIds:["fact-1"],viewport:{width:800,height:500},styles:[{id:"body",fill:"#202020",color:"#eeeeee",borderColor:"#404040",fontSize:24,fontWeight:400,radius:8}],elements:[
  {id:"input",type:"input",rect,styleId:"body",text:"Observed value",textBasis:"source-ui",sourceAssetId:"source",sourceRect:rect,initiallyVisible:true},
  {id:"choice",type:"list-item",rect:{...rect,y:.4},styleId:"body",text:"Actual choice",textBasis:"source-ui",sourceAssetId:"source",sourceRect:rect,initiallyVisible:true},
  {id:"result",type:"text",rect:{...rect,y:.6},styleId:"body",text:"Result",textBasis:"source-ui",sourceAssetId:"source",sourceRect:rect,initiallyVisible:false},
 ],states:[{id:"observed",basis:"observed",sourceAssetId:"source",evidenceIds:["fact-1"],visibleElementIds:["input","choice"],selectedElementIds:[],textValues:[]},{id:"result-state",basis:"illustrative",evidenceIds:["fact-1"],visibleElementIds:["result"],selectedElementIds:["result"],textValues:[{elementId:"result",text:"Example note",textBasis:"example-content"}]}]};
 const actions:UiAction[]=[{kind:"pointer",atFrame:30,durationFrames:15,targetId:"input",evidenceId:"fact-1"},{kind:"type",atFrame:45,durationFrames:30,targetId:"input",text:"A😀B",evidenceId:"fact-1"},{kind:"pointer",atFrame:75,durationFrames:15,targetId:"choice",evidenceId:"fact-1"},{kind:"click",atFrame:90,durationFrames:12,targetId:"choice",evidenceId:"fact-1"},{kind:"select",atFrame:102,durationFrames:6,targetId:"choice",evidenceId:"fact-1"},{kind:"state",atFrame:108,durationFrames:12,stateId:"result-state",evidenceId:"fact-1"}];
 return {document,actions};
}
function planFixture(document:UiDocument,actions:UiAction[]):Plan{return{version:1,job_id:"test",mode:"create",renderer:"hyperframes",output:{width:1920,height:1080,fps:30,duration_frames:210},product:"Fixture",summary:"",accent:"#7855dd",background:"dark",assets:[{id:"source",path:"assets/source.png",kind:"image",usage:"output",rights:"Fixture",width:800,height:500}],uiDocuments:[document],scenes:[{id:"ui-scene",start_frame:0,duration_frames:210,asset_id:"source",source_in_seconds:0,playback_rate:1,preserve_audio:false,fit:"contain",purpose:"Test",reference_technique:"",headline:"Actual workflow",detail:"",evidence:"Source capability",effects:[],presentation:{template:"proof",theme:"dark",transition:"cut",visual:{kind:"ui-demo",documentId:document.id,actions}}}],captions:[],audio:[],music_prompt:"",sfx_prompt:"",assumptions:[]};}

test("UI frame replay preserves observed baseline, types Unicode deterministically and never mutates its source",()=>{
 const {document,actions}=fixture(),before=JSON.stringify({document,actions});
 assert.equal(expectedUiState(document,actions,0).elements.input.text,"Observed value");
 assert.equal(expectedUiState(document,actions,55).elements.input.text,"A");
 assert.equal(expectedUiState(document,actions,65).elements.input.text,"A😀");
 assert.equal(expectedUiState(document,actions,75).elements.input.text,"A😀B");
 const middle=expectedUiState(document,actions,65);expectedUiState(document,actions,180);assert.deepEqual(expectedUiState(document,actions,65),middle);assert.equal(JSON.stringify({document,actions}),before);
 const browser=runInNewContext(`(${uiEvaluatorSource()})`);assert.equal(JSON.stringify(browser(document,actions,65)),JSON.stringify(middle));
});
test("pointer/click/select and full snapshot changes reach precise frame boundaries",()=>{
 const {document,actions}=fixture();assert.equal(expectedUiState(document,actions,29).pointer.visible,false);
 assert.ok(Math.abs(expectedUiState(document,actions,45).pointer.x-.45)<1e-12);assert.ok(expectedUiState(document,actions,96).pointer.clickProgress>.99);
 assert.equal(expectedUiState(document,actions,107).elements.choice.selected,false);assert.equal(expectedUiState(document,actions,108).elements.choice.selected,true);
 assert.equal(expectedUiState(document,actions,119).stateId,"observed");const result=expectedUiState(document,actions,120);assert.equal(result.stateId,"result-state");assert.equal(result.elements.input.visible,false);assert.equal(result.elements.result.text,"Example note");assert.equal(result.elements.result.selected,true);
 assert.equal(expectedUiState(document,[{kind:"type",atFrame:30,durationFrames:0,targetId:"input",text:"Instant",evidenceId:"fact-1"}],30).elements.input.text,"Instant");
});
test("UI samples include the click pulse and every other result, with full action-tail settlement",()=>{
 const {document,actions}=fixture(),plan=planFixture(document,actions),scene=plan.scenes[0];scene.start_frame=300;
 assert.equal(uiActionEndFrame(actions),120);assert.equal(motionTimingForPresentation(scene.presentation,false).entryFrames,132);
 assert.deepEqual(uiActionSampleFrames(scene),[345,375,390,396,408,420]);scene.duration_frames=100;assert.deepEqual(uiActionSampleFrames(scene),[345,375,390,396,399]);
 assert.equal(expectedUiState(document,actions,29).stateId,"observed");assert.ok(expectedUiState(document,actions,96).pointer.clickProgress>.99);
 assert.deepEqual(uiActionSampleFrames({...scene,presentation:undefined}),[]);
});
test("effective frame/text provenance follows typing and selection and resets only with a full observed snapshot",()=>{
 const {document,actions}=fixture();assert.equal(expectedUiState(document,actions,0).elements.input.textBasis,"source-ui");assert.equal(expectedUiState(document,actions,65).basis,"illustrative");assert.equal(expectedUiState(document,actions,65).elements.input.textBasis,"example-content");
 const selection=expectedUiState(document,[{kind:"select",atFrame:30,durationFrames:6,targetId:"choice",evidenceId:"fact-1"}],36);assert.equal(selection.basis,"illustrative");assert.equal(selection.elements.choice.textBasis,"source-ui");
 const restored=expectedUiState(document,[...actions,{kind:"state",atFrame:132,durationFrames:6,stateId:"observed",evidenceId:"fact-1"}],138);assert.equal(restored.basis,"observed");assert.equal(restored.elements.input.text,"Observed value");assert.equal(restored.elements.input.textBasis,"source-ui");
});
test("editable DOM is escaped and reconstructed sources are never reported as rendered source pixels",()=>{
 const {document,actions}=fixture();document.elements[0].text='</script><script>alert("bad")</script>';const plan=planFixture(document,actions),html=motionHtml(plan,{source:"assets/source.png"});
 assert.doesNotMatch(html,/<img|<video|<script>alert/);assert.match(html,/data-ui-element="input"/);assert.match(html,/\u005cu003c\/script>/);assert.match(html,/textContent=value.text/);assert.match(html,/eventCallback\('onUpdate'/);
 const usage=motionUsage(plan.scenes[0],plan);assert.deepEqual(usage.proofAssetIds,[]);assert.deepEqual(usage.visibleAssetIds,[]);assert.deepEqual(usage.reconstructionSourceAssetIds,["source"]);assert.deepEqual(usage.copiedAssetIds,["source"]);
 document.styles[0].fill='url(https://example.com)';assert.throws(()=>uiDocumentHtml(document,0,{width:1000,height:600}),/trusted hex/);
});
test("trusted audience label appears only at absolute frame zero, including partial review plans",()=>{
 const {document,actions}=fixture(),plan=planFixture(document,actions);plan.audienceLabel='For writers <developing ideas>';
 assert.match(motionHtml(plan,{source:'assets/source.png'}),/class="audience-label" data-essential>For writers &lt;developing ideas&gt;/);
 plan.scenes[0].start_frame=300;assert.doesNotMatch(motionHtml(plan,{source:'assets/source.png'}),/class="audience-label" data-essential/);
});

test("large CSS pill radii resolve to the element bounds without changing source geometry",()=>{
 const {document}=fixture();document.styles[0].radius=999;
 const before=JSON.stringify(document),html=uiDocumentHtml(document,0,{width:800,height:500});
 assert.match(html,/border-radius:37\.5px/);assert.equal(JSON.stringify(document),before);
 document.styles[0].radius=Number.POSITIVE_INFINITY;
 assert.throws(()=>uiDocumentHtml(document,0,{width:800,height:500}),/supported range/);
});

test("selection preserves observed styling instead of imposing the video brand color",()=>{
 const {document}=fixture();document.styles.push({...document.styles[0],id:"selected",fill:"#343434",borderColor:"#565656",fontWeight:600});
 document.elements[1].selectedStyleId="selected";
 const before=JSON.stringify(document),html=uiDocumentHtml(document,0,{width:800,height:500});
 assert.match(html,/data-ui-element="choice"[^>]*--ui-selected-fill:#343434/);
 assert.match(html,/data-ui-element="input"[^>]*--ui-selected-fill:#202020/);
 assert.doesNotMatch(uiCompositionCss,/data-selected[^}]+var\(--accent\)/);
 assert.equal(JSON.stringify(document),before);
 document.elements[1].selectedStyleId="missing";assert.throws(()=>uiDocumentHtml(document,0,{width:800,height:500}),/selected style missing/);
});
