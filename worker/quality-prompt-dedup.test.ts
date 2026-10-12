import test from "node:test";
import assert from "node:assert/strict";
import { qualityUiDocumentTransport,qualityReviewPrompt,qualityDefaultStyle } from "./providers";
import { reviewBatch,wholeFilmProofInventory,orderQualityReviewRequests } from "./quality";
import { stageDigest } from "./research";
import { workflowObligations,type WorkflowContext,type WorkflowSnapshot } from "./workflow-coherence";
import type { UiDocument } from "./ui-reconstruction";
import type { Plan } from "./types";

/** Serialization fixture: compiler semantics are checked separately. Exercise
 * all metadata, including base fields absent from effective visible snapshots. */
function fixture(){
 const elements:UiDocument["elements"]=Array.from({length:20},(_,i)=>({id:`element-${i}`,type:i===19?"edge":i===0?"button":"text",rect:{x:.05+(i%2)*.5,y:.05+Math.floor(i/2)*.08,width:.35,height:.06},sourceRect:{x:.05+(i%2)*.5,y:.05+Math.floor(i/2)*.08,width:.35,height:.06},styleId:"normal",selectedStyleId:"selected",text:`Exact source label ${i}`,textBasis:"source-ui",sourceAssetId:"source",initiallyVisible:i!==18,...(i===19?{fromId:"element-0",toId:"element-1"}:{})}));
 const visible=elements.filter(e=>e.initiallyVisible).map(e=>e.id);
 const document:UiDocument={id:"document",sourceAssetIds:["source"],capabilityFactIds:["fact-1"],viewport:{width:1000,height:800},styles:[{id:"normal",fill:"#ffffff",color:"#111111",borderColor:"#eeeeee",fontSize:24,fontWeight:400,radius:4},{id:"selected",fill:"#eeeeee",color:"#111111",borderColor:"#999999",fontSize:24,fontWeight:500,radius:4}],elements,states:[{id:"before",basis:"observed",sourceAssetId:"source",evidenceIds:["fact-1"],visibleElementIds:visible,selectedElementIds:[],textValues:[]},{id:"after",basis:"illustrative",evidenceIds:["fact-1"],visibleElementIds:elements.map(e=>e.id),selectedElementIds:["element-0"],textValues:[{elementId:"element-1",text:"Changed exact example",textBasis:"example-content"}]}],terminalResult:{version:1,beforeStateId:"before",afterStateId:"after",confirmationElementId:"element-0",resultElementIds:["element-1"],evidenceIds:["fact-1"]},sourceValueDerivations:[{kind:"selected-row-count",stateId:"after",targetElementId:"element-1",sourceElementId:"element-2",sourceLabelElementId:"element-0",sourceMetricLabelElementId:"element-3",targetLabelElementId:"element-4",confirmationElementId:"element-0",contextElementIds:["element-5"],evidenceIds:["fact-1"]}]};
 return {document,context:contextFor(document)};
}
function contextFor(document:UiDocument):WorkflowContext{
 const snapshots:WorkflowSnapshot[]=document.states.map((state,index)=>({id:index?"final":"initial",localFrame:index*60,stateId:state.id,basis:state.basis,evidenceIds:state.evidenceIds,visible:document.elements.filter(e=>state.visibleElementIds.includes(e.id)).map(e=>({elementId:e.id,text:state.textValues.find(v=>v.elementId===e.id)?.text||e.text,textBasis:state.textValues.find(v=>v.elementId===e.id)?.textBasis||e.textBasis,selected:state.selectedElementIds.includes(e.id),resolvedStyleId:state.selectedElementIds.includes(e.id)?e.selectedStyleId!:e.styleId,type:e.type,rect:e.rect,appearance:{fill:"#ffffff",color:"#111111",borderColor:"#eeeeee",radius:4}}))}));
 const scenes:WorkflowContext["scenes"]=[{sceneId:"scene-1",documentId:document.id,actions:[],snapshots}];
 const body:Omit<WorkflowContext,"sha256">={version:2,bindings:{scriptSha256:"a".repeat(64),researchSha256:"b".repeat(64),evidenceSha256:"c".repeat(64),uiSha256:stageDigest([document])},product:"Fixture",beats:[{sceneId:"scene-1",headline:"Exact claim",detail:"",assetId:"source",template:"proof",visualKind:"ui-demo",documentId:document.id,cards:[],connectionLabels:[]}],documents:[{id:document.id,sha256:stageDigest(document),sourceAssetIds:document.sourceAssetIds,capabilityFactIds:document.capabilityFactIds,styles:document.styles,elements:document.elements.map(({id,type,rect,sourceAssetId,sourceRect,fromId,toId})=>({id,type,rect,sourceAssetId,sourceRect,...(fromId?{fromId}:{}),...(toId?{toId}:{})}))}],scenes,obligations:workflowObligations(scenes)};
 return {...body,sha256:stageDigest(body)};
}
function expand(transport:any,context:WorkflowContext):UiDocument[]{
 if(Array.isArray(transport))return transport;
 assert.equal(transport.transport,"ui-documents-workflow-shared-v1");
 return transport.documents.map((entry:any)=>{
  const shared=context.documents.find(d=>d.id===entry.workflowDocumentId)!;
  const document={...entry.metadata,sourceAssetIds:shared.sourceAssetIds,capabilityFactIds:shared.capabilityFactIds,styles:shared.styles,elements:entry.elements.map(({workflowElementId,base}:any)=>({...shared.elements.find(e=>e.id===workflowElementId),...base}))};
  assert.equal(stageDigest(document),shared.sha256);return document;
 });
}

test("shared QC UI records round-trip complete base/hidden states, provenance and ordinary derivation bindings",()=>{
 const {document,context}=fixture(),before=JSON.stringify({document,context}),transport=qualityUiDocumentTransport([document],context);
 assert.ok(!Array.isArray(transport));assert.deepEqual(expand(transport,context),[document]);
 assert.equal(JSON.stringify({document,context}),before);assert.ok(JSON.stringify(transport).length<JSON.stringify([document]).length);
 const restored=expand(transport,context)[0];assert.deepEqual(restored.sourceValueDerivations,document.sourceValueDerivations);assert.deepEqual(restored.terminalResult,document.terminalResult);assert.equal(restored.elements[18].initiallyVisible,false);assert.equal(restored.elements[18].text,"Exact source label 18");assert.equal(restored.elements[19].fromId,"element-0");
});

test("shared QC UI records retain literal preview binding and exact version2 trigger",()=>{
 const {document}=fixture();delete document.sourceValueDerivations;
 document.previewBinding={kind:"literal-preview",codeElementId:"element-0",templateElementId:"element-1",resultElementId:"element-2",contextElementIds:["element-3"],evidenceIds:["fact-1"]};
 document.terminalResult={version:2,beforeStateId:"before",afterStateId:"after",trigger:{kind:"code-edit-complete",elementId:"element-0",text:"name = 'Ada',",evidenceId:"fact-1"},resultElementIds:["element-2"],evidenceIds:["fact-1"]};
 const context=contextFor(document);assert.deepEqual(expand(qualityUiDocumentTransport([document],context),context),[document]);
});

test("sharing never substitutes mismatched records, stale hashes or missing context",()=>{
 const {document,context}=fixture();assert.deepEqual(qualityUiDocumentTransport([document]),[document]);
 for(const mutate of [
  (c:WorkflowContext)=>{c.documents[0].styles[0].color="#ff0000";},
  (c:WorkflowContext)=>{c.documents[0].elements[0].sourceRect.x=.2;},
  (c:WorkflowContext)=>{c.documents[0].elements.pop();},
  (c:WorkflowContext)=>{c.documents[0].sourceAssetIds=["another-source"];},
  (c:WorkflowContext)=>{c.documents[0].capabilityFactIds=["fact-2"];},
  (c:WorkflowContext)=>{c.documents[0].sha256="f".repeat(64);},
 ]){const changed=structuredClone(context);mutate(changed);const {sha256:_hash,...body}=changed;changed.sha256=stageDigest(body);assert.deepEqual(qualityUiDocumentTransport([document],changed),[document]);}
 const tampered=structuredClone(context);tampered.documents[0].styles[0].color="#ff0000";assert.throws(()=>qualityUiDocumentTransport([document],tampered),/hash changed/);
 const small=structuredClone(document);small.elements=small.elements.slice(0,1);small.states.forEach(s=>{s.visibleElementIds=["element-0"];s.textValues=[];});delete small.sourceValueDerivations;delete small.terminalResult;
 assert.deepEqual(qualityUiDocumentTransport([small],contextFor(small)),[small],"an expanded small request keeps canonical bytes");
});

test("QC emits creative/brand/story/default records once and pools only identical full source quotes",()=>{
 const claim={text:"Exact grounded claim",basis:"explicit" as const,evidenceIds:["fact-1"]};
 const plan:Plan={version:1,job_id:"dedup",mode:"create",renderer:"hyperframes",product:"Fixture",summary:"",accent:"#5190ef",background:"light",brand:{background:"#ffffff",foreground:"#111111",accent:"#5190ef",sourceUrl:"https://example.com/"},story:{primaryAudience:claim,problem:claim,mechanism:{...claim,steps:[{action:"Do the action",evidenceId:"fact-1",assetId:"source"}]},outcome:claim,differentiator:null,cta:claim},creativeDirection:{version:1,concept:"focus",evidence:"Exact creative evidence"} as Plan["creativeDirection"],output:{width:1920,height:1080,fps:30,duration_frames:240},assets:[{id:"source",path:"source.jpg",kind:"image",usage:"output",width:1000,height:600,rights:"Fixture"}],audio:[],captions:[],music_prompt:"",sfx_prompt:"",assumptions:[],scenes:[0,1].map(i=>({id:`scene-${i+1}`,start_frame:i*120,duration_frames:120,asset_id:"source",source_in_seconds:0,playback_rate:1,preserve_audio:false,fit:"contain",purpose:"",reference_technique:"",headline:`Exact visible claim ${i}`,detail:"",evidence:"A complete exact source quote with punctuation and Unicode →. ".repeat(12),effects:[],presentation:{template:"features",theme:"light",transition:"cut"}}))};
 const batch=reviewBatch(plan,plan.scenes.map(s=>({sceneId:s.id,path:`${s.id}.jpg`,label:`ACTUAL RENDER ${s.id}`}))),defaultStyle=qualityDefaultStyle(plan);
 const request={plan:batch.plan,motion:batch.motion,wholeFilmProof:wholeFilmProofInventory(plan),evidence:{text:"All original source text remains here.",assets:plan.assets},defaultStyle,measurements:null,heard:null,sourceSpeech:[]};
 const original=JSON.stringify(request),prompt=qualityReviewPrompt(request),grounding=JSON.parse(prompt.split("PLAN TIMING AND SOURCE GROUNDING: ")[1].split("\n")[0]);
 for(const value of [plan.brand,plan.story,plan.creativeDirection,defaultStyle])assert.equal(prompt.split(JSON.stringify(value)).length-1,1);
 assert.equal(grounding.sourceQuotes.values.length,1);
 assert.deepEqual(grounding.scenes.map((s:any)=>grounding.sourceQuotes.values[s.evidenceQuoteIndex]),plan.scenes.map(s=>s.evidence));
 assert.ok(prompt.includes(request.evidence.text));assert.equal(JSON.stringify(request),original);
});

test("UI-first QC ordering preserves original complete groups and the exact remaining retry inventory",()=>{
 const requests=[false,true,false,true].map((hasUi,index)=>({groupId:`group-${index+1}`,hasUi,sceneIds:[`scene-${index*2+1}`,`scene-${index*2+2}`],prompt:`Complete unchanged prompt ${index}`,images:Array.from({length:hasUi?11:8},(_,frame)=>({path:`group-${index+1}-frame-${frame}.jpg`,label:`Exact original action/frame label ${frame}`}))}));
 const before=JSON.stringify(requests),ordered=orderQualityReviewRequests(requests);
 assert.deepEqual(ordered.map(request=>request.groupId),["group-2","group-4","group-1","group-3"]);
 assert.equal(JSON.stringify(requests),before);assert.equal(ordered.length,requests.length);
 for(const request of requests)assert.equal(ordered.filter(item=>item===request).length,1);
 assert.deepEqual(ordered.slice(1),[requests[3],requests[0],requests[2]],"schema correction reserves the complete new remainder");
 assert.deepEqual(orderQualityReviewRequests(requests.filter(request=>!request.hasUi)),[requests[0],requests[2]]);
});
