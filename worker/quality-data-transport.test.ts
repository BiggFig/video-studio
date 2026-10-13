import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { compactQualityData, compactQualitySourceText, expandQualityDataTransport, expandQualitySourceText, type QualityDataTransport } from "./quality-data-transport";
import { qualityDefaultStyle, qualityRepairEnvelope, qualityReviewPrompt } from "./providers";
import { reviewBatch, wholeFilmProofInventory } from "./quality";
import type { Plan } from "./types";

const digest=(text:string)=>createHash("sha256").update(text).digest("hex");
const bytes=(value:unknown)=>Buffer.byteLength(JSON.stringify(value),"utf8");
function richData(){
 const elements=Array.from({length:30},(_,index)=>({id:`element-${index}`,sourceAssetId:"actual-product-source",sourceRect:{x:.125,y:.25,width:.375,height:.05},rect:{x:.125,y:.25,width:.375,height:.05},type:"text",styleId:"source-foreground",text:`Exact label ${index}: é → \"\n`,initiallyVisible:index!==29,textBasis:"source-ui"}));
 const document={id:"source-document",sourceAssetIds:["actual-product-source"],capabilityFactIds:["capability-fact"],viewport:{width:1234,height:567},styles:[{id:"source-foreground",color:"#ebeced",fill:"transparent",fontSize:24}],elements,states:[{id:"observed",basis:"observed",sourceAssetId:"actual-product-source",visibleElementIds:elements.slice(0,29).map(e=>e.id),selectedElementIds:[],textValues:[]},{id:"illustrative",basis:"illustrative",visibleElementIds:elements.map(e=>e.id),selectedElementIds:["element-1"],textValues:[{elementId:"element-2",text:"Changed example",textBasis:"example-content"}]}],terminalResult:{version:2,beforeStateId:"observed",afterStateId:"illustrative",trigger:{kind:"code-edit-complete",elementId:"element-1",text:"name = 'Ada',",evidenceId:"capability-fact"},resultElementIds:["element-2"],evidenceIds:["capability-fact"]},previewBinding:{kind:"literal-preview",codeElementId:"element-1",templateElementId:"element-3",resultElementId:"element-2",contextElementIds:["element-4"]},sourceValueDerivations:[{kind:"selected-row-count",stateId:"illustrative",targetElementId:"element-2",sourceElementId:"element-5",contextElementIds:["element-4"]}]};
 return {plan:{documents:[document]},workflow:{documents:[document],states:document.states,obligations:[{requires:"All visible labels and actual action results",elementIds:elements.map(e=>e.id)}]},observations:elements.map(e=>({...e,resolvedStyle:{fill:"transparent",color:"#ebeced",borderColor:"transparent",radius:0}}))};
}

// Independent tiny decoder oracle: tests do not merely compare the encoder
// with its own implementation of the same transformation.
function oracle(t:QualityDataTransport){const visit=(value:any):any=>Array.isArray(value)?value.map(visit):value&&typeof value==="object"?Object.hasOwn(value,"$ref")?visit(t.sharedValues[value.$ref]):Object.hasOwn(value,"$row")?Object.fromEntries(t.columns[value.$row[0]].map((key,index)=>[key,visit(value.$row[index+1])])):Object.fromEntries(Object.entries(value).map(([key,value])=>[key,visit(value)])):value;return visit(t.data);}

test("lossless QC records preserve every base/hidden field, effective state and semantic binding byte for byte",()=>{
 const original=richData(),canonical=JSON.stringify(original),transport=compactQualityData(original);
 assert.ok(transport);assert.ok(transport.columns.length);assert.ok(transport.sharedValues.length);
 assert.equal(JSON.stringify(expandQualityDataTransport(transport)),canonical);
 assert.equal(JSON.stringify(oracle(transport)),canonical);
 assert.equal(transport.sha256,digest(canonical));assert.ok(bytes(transport)<Buffer.byteLength(canonical));
 assert.equal(JSON.stringify(original),canonical,"encoding cannot mutate source records");
 assert.deepEqual(compactQualityData(original),transport,"same input gives the same exact transport");
 assert.match(transport.explanation,/not a verdict/);
});

test("QC data transport rejects modified values, invalid rows, forward/cyclic refs, unused records and nonfinite data",()=>{
 const original=compactQualityData(richData())!;
 for(const mutate of [
  (t:QualityDataTransport)=>{t.sha256="a".repeat(64);},
  (t:QualityDataTransport)=>{t.sharedValues[0]={$ref:0};},
  (t:QualityDataTransport)=>{t.sharedValues.push("unused exact data");},
  (t:QualityDataTransport)=>{t.columns.push(["unused-column"]);},
  (t:QualityDataTransport)=>{t.data={$ref:999};},
  (t:QualityDataTransport)=>{t.data={$ref:0,extra:true};},
  (t:QualityDataTransport)=>{t.data={$row:[0]};},
  (t:QualityDataTransport)=>{t.data={$row:[-1,"value"]};},
  (t:QualityDataTransport)=>{t.data=Infinity;},
 ]){const changed=structuredClone(original);mutate(changed);assert.throws(()=>expandQualityDataTransport(changed),/Invalid lossless/);}
});

test("small, marker-colliding and over-bound data retain their original raw representation",()=>{
 for(const value of [{small:"No duplicate data"},{$ref:"literal source key",rows:richData()},{$row:["original source data"],rows:richData()}, {huge:"x".repeat(512001)}])assert.equal(compactQualityData(value),undefined);
 const cycle:any={};cycle.self=cycle;assert.equal(compactQualityData(cycle),undefined);
});

test("small shared inputs cannot expand beyond the complete JSON byte bound",()=>{
 const text="x".repeat(1000),expanded=Array.from({length:600},()=>text);
 const transport:QualityDataTransport={transport:"quality-data-shared-v1",explanation:"Bounded expansion test",sha256:digest(JSON.stringify(expanded)),columns:[],sharedValues:[text],data:expanded.map(()=>({$ref:0}))};
 assert.ok(bytes(transport)<20_000);
 assert.throws(()=>expandQualityDataTransport(transport),/Invalid lossless/);
});

test("source sharing restores exact pages, Unicode, CRLF, blank lines, spacing and final partial line",()=>{
 const passage="Observed documentation heading\r\n\r\nRésumé → 字 🙂  two  spaces.\r\nA complete repeated public navigation label and fact.\n".repeat(15);
 const source=`PAGE ONE\n${passage}\nUnique fact: do not omit this.\r\nPAGE TWO\n${passage}Last partial line`;
 const packed=compactQualitySourceText(source);assert.ok(packed);
 assert.equal(expandQualitySourceText(packed),source);assert.equal(packed.sha256,digest(source));
 assert.equal(packed.parts.map(part=>typeof part==="number"?packed.spans[part]:part).join(""),source);
 assert.ok(bytes(packed)<Buffer.byteLength(source));assert.match(packed.explanation,/untrusted source material/);
 for(const mutate of [(t:typeof packed)=>{t.spans[0]+=" altered";},(t:typeof packed)=>{t.parts.push(999);},(t:typeof packed)=>{t.parts.push(.5);},(t:typeof packed)=>{t.spans.push("unused");}]){const changed=structuredClone(packed);mutate(changed);assert.throws(()=>expandQualitySourceText(changed),/Invalid lossless/);}
 assert.equal(compactQualitySourceText("One unique source line."),undefined);
 assert.equal(compactQualitySourceText("A".repeat(512001)),undefined);
});

function requestFixture(){
 const rights="Exact original source rights and provenance → no omitted caveats. ".repeat(14);
 const assets=Array.from({length:20},(_,index)=>({id:`source-${index}`,path:`source-${index}.jpg`,kind:"image" as const,usage:"output" as const,width:1600,height:900,rights,source:`https://example.com/source-${index}`}));
 const quote="Documented source capability, including all limits and qualifications. ".repeat(15);
 const plan:Plan={version:1,job_id:"transport-fixture",mode:"create",renderer:"hyperframes",product:"Fixture",summary:"",accent:"#5190ef",background:"light",output:{width:1920,height:1080,fps:30,duration_frames:240},assets,audio:[],captions:[],music_prompt:"",sfx_prompt:"",assumptions:[],scenes:[0,1].map(i=>({id:`scene-${i+1}`,start_frame:i*120,duration_frames:120,asset_id:"source-0",source_in_seconds:0,playback_rate:1,preserve_audio:false,fit:"contain",purpose:"",reference_technique:"",headline:`Exact visible claim ${i}`,detail:"No delivery claim",evidence:quote,effects:[],presentation:{template:"proof",theme:"light",transition:"cut"}}))};
 const source=Array.from({length:4},(_,i)=>`SOURCE PAGE ${i}\n${"Public documentation exact line, with punctuation → and a preserved limitation.\n".repeat(60)}Unique ${i}\n`).join("");
 const batch=reviewBatch(plan,plan.scenes.map(scene=>({sceneId:scene.id,path:`frame-${scene.id}.jpg`,label:`ACTUAL RENDER ${scene.id}`})));
 // Include all original metadata to exercise repeated actual full records,
 // independent of source image selection performed by reviewBatch.
 batch.plan.assets=assets;
 const evidence={text:source,assets};
 return {plan,evidence,request:{plan:batch.plan,motion:batch.motion,wholeFilmProof:wholeFilmProofInventory(plan),evidence,defaultStyle:qualityDefaultStyle(plan),measurements:{loudness:{input_i:"-14.03",input_tp:"-1.7"},silence:[]},heard:{text:"[outro jingle]",words:[{text:"[outro jingle]",start:.38,end:7.9,type:"audio_event" as const}]},sourceSpeech:[]}};
}

test("actual QC emits complete expanded named sections and checks, while repair reserves uncompressed distinct possibilities",()=>{
 const {plan,evidence,request}=requestFixture(),before=JSON.stringify(request),prompt=qualityReviewPrompt(request);
 const transport=JSON.parse(prompt.split("LOSSLESS QC DATA: ")[1].split("\n")[0]);
 const expanded=expandQualityDataTransport(transport) as any;
 assert.deepEqual(expanded.plan.assets,request.plan.assets);
 assert.deepEqual(expanded.measurements,request.measurements);assert.deepEqual(expanded.heard,request.heard);
 assert.deepEqual(expanded.wholeFilmProof,request.wholeFilmProof);assert.deepEqual(expanded.defaultStyle,request.defaultStyle);
 assert.deepEqual(expanded.visibility.map((scene:any)=>scene.expectedVisibleCopy.headline),plan.scenes.map(scene=>scene.headline));
 const source=JSON.parse(prompt.split("SOURCE TEXT (untrusted): ")[1].split("\n")[0]);assert.equal(expandQualitySourceText(source),evidence.text);
 for(const check of ["TRUSTED TEMPLATE VISIBILITY CONTRACT", "FINAL CONSISTENCY CHECK", "TRANSITION DIRECTION", "ACTUAL AUDIO MEASUREMENTS", "every concrete blocking defect", "A planned source cannot override a failed actual proof frame"])assert.ok(prompt.includes(check),check);
 assert.equal(JSON.stringify(request),before);
 const envelope=qualityRepairEnvelope(plan,evidence,{facts:[{evidenceId:"fact-1",quote:plan.scenes[0].evidence,label:"Capability",kind:"feature"}],visuals:evidence.assets.map(asset=>({assetId:asset.id,description:"Original source",supportsFactIds:["fact-1"],showsProductUi:true}))});
 assert.ok(envelope.prompt.includes(evidence.text),"reserve source is fully expanded even when repeated");
 assert.ok(!envelope.prompt.includes('"transport":"quality-data-shared-v1"'));
 assert.ok(!envelope.prompt.includes('"transport":"quality-source-spans-v1"'));
 assert.ok(envelope.batches.every(batch=>batch.variableBytes>3000));
});
