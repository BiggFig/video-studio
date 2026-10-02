import test from "node:test";
import assert from "node:assert/strict";
import { uiActionBehaviorIssues } from "./script-ui-behavior";
import type { UiAction, UiDocument } from "./ui-reconstruction";

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
