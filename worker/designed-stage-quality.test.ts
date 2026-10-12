import test from "node:test";
import assert from "node:assert/strict";
import { directedCss, designedStageForScene, maximumDesignedStageDescription } from "./motion-direction";
import { motionHtml } from "./motion-composition";
import { qualityDefaultStyle, qualityRepairEnvelope, qualityReviewPrompt } from "./providers";
import { reviewBatch, wholeFilmProofInventory } from "./quality";
import type { Evidence, Plan, Scene } from "./types";

function fixture():Plan {
 const scene:Scene={id:"scene-1",start_frame:0,duration_frames:150,asset_id:"source",source_in_seconds:0,playback_rate:1,preserve_audio:false,fit:"contain",purpose:"Show actual source",reference_technique:"",headline:"A useful workflow",detail:"",evidence:"Observed capability",effects:[],presentation:{template:"proof",theme:"dark",transition:"cut",visual:{kind:"showcase"}},direction:{version:2,job:"action",motion:"focus",continuityKey:"source"},shotDirection:{version:1,subjectIds:["asset:source"],copyRole:"headline",camera:{shots:[]},actionWindow:null,resultHold:null,layers:{copy:{startFrame:0,endFrame:150,enterFrames:9},cursor:{startFrame:0,endFrame:0,enterFrames:0},product:{startFrame:8,endFrame:150,enterFrames:12},material:{startFrame:2,endFrame:150,enterFrames:18}},exit:{kind:"cut"}}};
 return {version:1,job_id:"stage-fixture",mode:"create",renderer:"hyperframes",output:{width:1920,height:1080,fps:30,duration_frames:300},product:"Example",summary:"",accent:"#7755aa",background:"dark",creativeDirection:{version:1,concept:"focus"} as Plan["creativeDirection"],shotDirector:{version:1,visualSystem:{family:"workbench",material:"ink",corners:"rounded"}} as Plan["shotDirector"],scenes:[scene,{...structuredClone(scene),id:"scene-2",start_frame:150}],assets:[{id:"source",path:"assets/source.jpg",kind:"image",usage:"output",rights:"Fixture",width:1600,height:900}],audio:[],captions:[],music_prompt:"",sfx_prompt:"",assumptions:[]};
}
const samples=(plan:Plan)=>plan.scenes.map(scene=>({sceneId:scene.id,path:`${scene.id}.jpg`,label:"ACTUAL RENDER reading hold"}));
const request=(plan:Plan)=>{const batch=reviewBatch(plan,samples(plan));return {plan:batch.plan,motion:batch.motion,wholeFilmProof:wholeFilmProofInventory(plan),evidence:{text:"Observed capability",assets:plan.assets} satisfies Evidence,defaultStyle:qualityDefaultStyle(plan),measurements:null,heard:null,sourceSpeech:[]};};

test("quality stage facts describe the active grid and material CSS without treating them as product evidence",()=>{
 const plan=fixture(),description=designedStageForScene(plan,plan.scenes[0],0)!;
 assert.match(description,/1px grid lines repeat every 100px at 0\.14 opacity/);assert.match(description,/1px bottom axis/);assert.match(description,/opacity is 0\.08/);
 assert.match(directedCss,/\.system-workbench \.shot-ground\{[^}]*var\(--line\) 1px[^}]*background-size:100px 100px;opacity:\.14/);
 assert.match(directedCss,/\.shot-axis\{[^}]*height:1px/);assert.match(directedCss,/\.shot-material i\{[^}]*border:1px solid/);
 assert.match(directedCss,/\.shot-directed\.job-action \.shot-material,\.shot-directed\.job-result \.shot-material\{opacity:\.08/);
 const html=motionHtml(plan,{source:"assets/source.jpg"});assert.match(html,/<section[^>]*job-action[^>]*system-workbench/);assert.match(html,/data-stage-version="shot-1"/);
 const actual=request(plan);assert.equal(actual.motion[0].designedStage,description);
 const prompt=qualityReviewPrompt(actual);assert.ok(prompt.includes(JSON.stringify(description)));assert.match(prompt,/not product UI or proof of a pass/);assert.match(prompt,/unexpected deviations, flicker, clipping, or obstruction/);assert.match(prompt,/remain blocking/);
 plan.scenes[0].direction!.job="context";assert.match(designedStageForScene(plan,plan.scenes[0],0)!,/opacity is 0\.32/);
});

test("stage facts follow actual activation and never invent a grid for another system or legacy scene",()=>{
 const plan=fixture();
 for(const family of ["editorial","relationships"] as const){plan.shotDirector!.visualSystem.family=family;assert.doesNotMatch(designedStageForScene(plan,plan.scenes[0],0)!,/grid/);}
 delete plan.scenes[0].shotDirection;
 assert.match(designedStageForScene(plan,plan.scenes[0],0)!,/material sheets and accent corner are hidden/);
 plan.scenes[0].direction!.version=1;plan.creativeDirection!.concept="connect";assert.match(designedStageForScene(plan,plan.scenes[0],0)!,/curved connecting thread/);
 plan.scenes[0].preserve_audio=true;assert.equal(designedStageForScene(plan,plan.scenes[0],0),undefined);assert.ok(!("designedStage" in reviewBatch(plan,samples(plan)).motion[0]));
 delete plan.creativeDirection;
 const nondirected=request(plan);assert.ok(nondirected.motion.every(item=>!("designedStage" in item)));assert.doesNotMatch(qualityReviewPrompt(nondirected),/DESIGNED EDITORIAL STAGE|designedStage/);
});

test("every legal active-stage description and its exact actual review prompt fit the repair reserve",()=>{
 const plan=fixture(),evidence={text:"Observed capability",assets:plan.assets},research={facts:[{evidenceId:"fact-1",quote:"Observed capability",label:"Capability",kind:"feature" as const}],visuals:[{assetId:"source",description:"Actual source",supportsFactIds:["fact-1"],showsProductUi:true}]};
 const bytes=(value:unknown)=>Buffer.byteLength(JSON.stringify(value),"utf8");
 for(const version of [1,2] as const)for(const job of ["hook","context","action","result","payoff","cta"] as const)for(const family of [undefined,"editorial","workbench","relationships"] as const)for(const concept of ["focus","connect","consolidate"] as const){
  const current=structuredClone(plan);current.creativeDirection!.concept=concept;
  for(const scene of current.scenes){scene.direction!.version=version;scene.direction!.job=job;if(family)current.shotDirector!.visualSystem.family=family;else delete scene.shotDirection;}
  const actual=request(current),envelope=qualityRepairEnvelope(current,evidence,research);
  for(const motion of actual.motion)assert.ok(bytes(motion.designedStage)<=bytes(maximumDesignedStageDescription));
  const promptBytes=Buffer.byteLength(qualityReviewPrompt(actual),"utf8");
  assert.ok(promptBytes<=Buffer.byteLength(envelope.prompt,"utf8")+envelope.batches[0].variableBytes,`${version}/${job}/${family}/${concept} exceeded repair envelope`);
 }
});
