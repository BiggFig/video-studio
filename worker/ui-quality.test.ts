import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { assessUiDemonstration, motionIntegrityPassed, parseReview, reviewBatch, wholeFilmProofInventory } from "./quality";
import { motionSampleFrames } from "./motion-composition";
import { qualityDefaultStyle, qualityRepairEnvelope, qualityReviewPrompt, qualitySceneVisibility } from "./providers";
import { uiActionSampleFrames } from "./ui-state";
import type { Evidence, Plan } from "./types";

function fixture() {
  const source={id:"editor-source",path:"assets/editor.jpg",kind:"image" as const,usage:"output" as const,width:1000,height:600,rights:"Provided product UI"};
  const document={id:"linking",sourceAssetIds:[source.id],capabilityFactIds:["fact-1"],viewport:{width:1000,height:600},styles:[{id:"editor",fill:"#111111",color:"#ffffff",borderColor:"#333333",fontSize:24,fontWeight:400,radius:8}],elements:[{id:"note",type:"textarea" as const,rect:{x:.1,y:.1,width:.8,height:.8},styleId:"editor",text:"",textBasis:"source-ui" as const,sourceAssetId:source.id,sourceRect:{x:.1,y:.1,width:.8,height:.8},initiallyVisible:true}],states:[{id:"open",basis:"observed" as const,sourceAssetId:source.id,evidenceIds:["fact-1"],visibleElementIds:["note"],selectedElementIds:[],textValues:[]}]};
  const plan:Plan={version:1,job_id:"ui-quality",mode:"create",renderer:"hyperframes",output:{width:1920,height:1080,fps:30,duration_frames:300},product:"Notes",summary:"",accent:"#7755cc",background:"dark",assets:[source],uiDocuments:[document],captions:[],audio:[],music_prompt:"Instrumental",sfx_prompt:"Click",assumptions:[],scenes:[{id:"scene-1",start_frame:0,duration_frames:300,asset_id:source.id,source_in_seconds:0,playback_rate:1,preserve_audio:false,fit:"contain",purpose:"Demonstrate a supported example",reference_technique:"Typing",headline:"Connect your notes",detail:"",evidence:"Link related notes.",effects:[],presentation:{template:"proof",theme:"dark",transition:"cut",visual:{kind:"ui-demo",documentId:"linking",actions:[{kind:"type",atFrame:30,durationFrames:60,targetId:"note",text:"Reading ideas",evidenceId:"fact-1"}]}}}]};
  const evidence:Evidence={text:"Link related notes.",assets:[source]};
  const research={facts:[{evidenceId:"fact-1",kind:"feature" as const,label:"Links",quote:"Link related notes."}],visuals:[{assetId:source.id,description:"Editor",supportsFactIds:["fact-1"],showsProductUi:true,role:"product_ui" as const}]};
  return{plan,evidence,research};
}

test("a reconstruction review requires its source but never asserts source pixels are rendered",()=>{
  const {plan,evidence}=fixture(),batch=reviewBatch(plan,[{sceneId:"scene-1",path:"analysis/action.jpg",label:"ACTUAL RENDER action completion"}]);
  batch.plan.audienceLabel="For writers developing ideas";
  assert.equal(batch.motion[0].realMediaVisible,false);
  assert.equal(batch.images.length,2);
  assert.equal(batch.plan.uiDocuments?.length,1);
  const visibility=qualitySceneVisibility(batch.plan,batch.motion)[0];
  assert.equal(visibility.sourceMedia.role,"reconstruction-reference");
  assert.equal(visibility.expectedVisibleCopy.audienceLabel,"For writers developing ideas");
  assert.deepEqual(visibility.requiredProofAssetIds,[]);
  assert.deepEqual(visibility.reconstruction?.sourceAssetIds,["editor-source"]);
  const prompt=qualityReviewPrompt({plan:batch.plan,motion:batch.motion,wholeFilmProof:wholeFilmProofInventory(plan),evidence,defaultStyle:qualityDefaultStyle(plan),measurements:null,heard:null,sourceSpeech:[]});
  assert.match(prompt,/uiReconstructionReviewed/);assert.match(prompt,/every labelled UI action sample/);
  assert.throws(()=>qualitySceneVisibility({...batch.plan,uiDocuments:[]},batch.motion),/missing/);
  assert.throws(()=>qualitySceneVisibility(batch.plan,[{...batch.motion[0],realMediaVisible:true}]),/contradicts/);
});

test("UI quality is fail-closed for missing, unperformed or failed fidelity and behavior",()=>{
  const passed={uiReconstructionReviewed:true,uiReconstructionPassed:true,uiBehaviorReviewed:true,uiBehaviorPassed:true};
  assert.deepEqual(assessUiDemonstration([passed]),{fidelity:{performed:true,passed:true},behavior:{performed:true,passed:true}});
  assert.equal(assessUiDemonstration([]).fidelity.passed,false);
  assert.equal(assessUiDemonstration([{}]).behavior.performed,false);
  assert.equal(assessUiDemonstration([passed,{...passed,uiBehaviorPassed:false}]).behavior.passed,false);
  assert.equal(assessUiDemonstration([{...passed,uiReconstructionReviewed:false}]).fidelity.passed,false);
  const review={...passed,readabilityPassed:true,claimsPassed:true,realVisualsPassed:true,renderIntegrityPassed:true,referenceStyleReviewed:true,referenceStylePassed:true,audioTranscriptPassed:true,notes:[],findings:[{severity:"major",check:"ui_behavior",message:"The typed result never appears.",evidence:"The action-completion frame remains empty."}]};
  assert.equal(parseReview(review).uiBehaviorPassed,false);
  assert.equal(parseReview({...review,uiBehaviorPassed:false}).findings.length,1);
});

test("every action outcome is sampled and repair allowance includes all ten possible frames per scene",()=>{
  const {plan,evidence,research}=fixture();
  assert.deepEqual(uiActionSampleFrames(plan.scenes[0]),[90]);
  plan.scenes.push({...plan.scenes[0],id:"scene-2",start_frame:300});plan.output.duration_frames=600;
  const envelope=qualityRepairEnvelope(plan,evidence,research);
  assert.equal(envelope.batches.length,1);
  assert.equal(envelope.batches[0].renderedImages,20);
  assert.ok(envelope.prompt.includes('"uiDocuments"'));
  assert.ok(envelope.batches[0].variableBytes>6*160*2);
});

test("export integrity requires every UI action comparison as well as every scene hold",()=>{
  const {plan}=fixture(),scene=plan.scenes[0];
  const comparisons=[motionSampleFrames(scene,plan,0)[2],...uiActionSampleFrames(scene)].map(frame=>({scene:scene.id,frame,passed:true,ssim:.99}));
  const report={passed:true,localFontLoaded:true,localImagesDecoded:true,frames:plan.output.duration_frames,planSha256:createHash("sha256").update(JSON.stringify(plan)).digest("hex"),comparisons};
  const seek={deterministic:true};
  assert.equal(motionIntegrityPassed(plan,report,seek),true);
  assert.equal(motionIntegrityPassed(plan,{...report,comparisons:comparisons.slice(0,1)},seek),false);
  assert.equal(motionIntegrityPassed(plan,{...report,comparisons:[comparisons[0],comparisons[0]]},seek),false);
  assert.equal(motionIntegrityPassed(plan,{...report,comparisons:[comparisons[0],{...comparisons[1],ssim:.8}]},seek),false);
  assert.equal(motionIntegrityPassed(plan,report,{deterministic:false}),false);
  delete scene.presentation!.visual;
  const legacy={...report,planSha256:createHash("sha256").update(JSON.stringify(plan)).digest("hex"),comparisons:[{scene:scene.id,frame:motionSampleFrames(scene,plan,0)[2],passed:true,ssim:.99}]};
  assert.equal(motionIntegrityPassed(plan,legacy,seek),true);
});

test("directed export integrity requires the exact camera/action union and independent hold multiplicity",()=>{
  const {plan}=fixture(),scene=plan.scenes[0];
  scene.start_frame=120;plan.output.duration_frames=420;
  const hold=motionSampleFrames(scene,plan,0)[2],window={startFrame:0,endFrame:300,enterFrames:0};
  scene.shotDirection={version:1,subjectIds:["note"],copyRole:"support",camera:{shots:[
    {atFrame:0,moveFrames:0,job:"establish",targetIds:[]},
    {atFrame:78,moveFrames:12,job:"input",targetIds:["note"]},
    {atFrame:hold-scene.start_frame,moveFrames:0,job:"result",targetIds:["note"]},
  ]},actionWindow:{startFrame:30,endFrame:90},resultHold:{startFrame:90,endFrame:300},layers:{copy:{...window},cursor:{...window},product:{...window},material:{...window}},exit:{kind:"cut"}};
  // Renderer emits one hold, then unique action/camera frames. Frame210 is both
  // the completed type and settled camera; the independent hold appears twice.
  const frames=[hold,120,198,204,210,hold,419];
  const comparisons=frames.map(frame=>({scene:scene.id,frame,passed:true,ssim:.986272}));
  const report={passed:true,localFontLoaded:true,localImagesDecoded:true,frames:plan.output.duration_frames,planSha256:createHash("sha256").update(JSON.stringify(plan)).digest("hex"),comparisons};
  const seek={deterministic:true},before=JSON.stringify({plan,report,seek});
  assert.equal(motionIntegrityPassed(plan,report,seek),true);
  assert.equal(comparisons.filter(value=>value.frame===210).length,1);
  assert.equal(comparisons.filter(value=>value.frame===hold).length,2);
  for(const invalid of [
    comparisons.filter(value=>value.frame!==198),
    [...comparisons,comparisons[1]],
    comparisons.map((value,index)=>index===2?comparisons[1]:value),
    comparisons.map((value,index)=>index===2?{...value,frame:199}:value),
    comparisons.map((value,index)=>index===2?{...value,ssim:.969999}:value),
    comparisons.map((value,index)=>index===2?{...value,ssim:NaN}:value),
    comparisons.map((value,index)=>index===2?{...value,passed:false}:value),
    comparisons.slice(1),
  ])assert.equal(motionIntegrityPassed(plan,{...report,comparisons:invalid},seek),false);
  assert.equal(motionIntegrityPassed(plan,{...report,comparisons:[...comparisons].reverse()},seek),true);
  assert.equal(motionIntegrityPassed(plan,{...report,planSha256:"0".repeat(64)},seek),false);
  assert.equal(motionIntegrityPassed(plan,{...report,frames:419},seek),false);
  assert.equal(motionIntegrityPassed(plan,{...report,localFontLoaded:false},seek),false);
  assert.equal(motionIntegrityPassed(plan,{...report,localImagesDecoded:false},seek),false);
  assert.equal(JSON.stringify({plan,report,seek}),before,"validation never rewrites the plan or retained proof");
});
