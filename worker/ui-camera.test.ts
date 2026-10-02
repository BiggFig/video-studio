import test from "node:test";
import assert from "node:assert/strict";
import {runInNewContext} from "node:vm";
import {expectedUiCamera,uiCameraEndFrame,uiCameraEvaluatorSource,uiStageViewport} from "./ui-camera";
import type {UiDocument,UiAction} from "./ui-reconstruction";

const document:UiDocument={id:"camera",sourceAssetIds:["source"],capabilityFactIds:["fact-1"],viewport:{width:1000,height:600},styles:[],states:[],elements:[{id:"input",type:"input",rect:{x:.08,y:.15,width:.65,height:.12},sourceRect:{x:.08,y:.15,width:.65,height:.12},styleId:"body",text:"Query",textBasis:"source-ui",sourceAssetId:"source",initiallyVisible:true},{id:"choice",type:"list-item",rect:{x:.08,y:.3,width:.38,height:.08},sourceRect:{x:.08,y:.3,width:.38,height:.08},styleId:"body",text:"Result",textBasis:"source-ui",sourceAssetId:"source",initiallyVisible:true}]};
const actions:UiAction[]=[{kind:"type",atFrame:42,durationFrames:54,targetId:"input",text:"Example",evidenceId:"fact-1"},{kind:"pointer",atFrame:108,durationFrames:24,targetId:"choice",evidenceId:"fact-1"},{kind:"click",atFrame:144,durationFrames:12,targetId:"choice",evidenceId:"fact-1"}];
test("camera establishes context, follows only real action targets, and restores a stable full result",()=>{
 const viewport=uiStageViewport(1920,1080);
 assert.deepEqual(expectedUiCamera(document,actions,29,viewport),{x:0,y:0,scale:1,targetId:null,phase:"wide"});
 const input=expectedUiCamera(document,actions,70,viewport);assert.equal(input.targetId,"input");assert.equal(input.scale,1.45);assert.notEqual(input.y,0);
 const choice=expectedUiCamera(document,actions,132,viewport);assert.equal(choice.targetId,"choice");assert.notDeepEqual(choice,input);
 assert.equal(expectedUiCamera(document,actions,160,viewport).phase,"return");assert.deepEqual(expectedUiCamera(document,actions,168,viewport),{x:0,y:0,scale:1,targetId:null,phase:"wide"});
 assert.equal(uiCameraEndFrame(actions),168);assert.equal(uiCameraEndFrame([{kind:"state",atFrame:30,durationFrames:6}]),36);
});
test("all integer frames retain active controls inside each aspect ratio, with bounded camera travel",()=>{
 for(const [width,height]of [[1920,1080],[1080,1920],[1080,1080]]){const viewport=uiStageViewport(width,height),fit=Math.min(viewport.width/1000,viewport.height/600),dw=1000*fit,dh=600*fit;
  for(let frame=0;frame<200;frame++){const camera=expectedUiCamera(document,actions,frame,viewport);assert.ok(camera.scale>=1&&camera.scale<=1.45);if(camera.targetId){const rect=document.elements.find(element=>element.id===camera.targetId)!.rect,left=viewport.width/2+(rect.x-.5)*dw*camera.scale+camera.x,top=viewport.height/2+(rect.y-.5)*dh*camera.scale+camera.y;assert.ok(left>=-1e-6&&top>=-1e-6&&left+rect.width*dw*camera.scale<=viewport.width+1e-6&&top+rect.height*dh*camera.scale<=viewport.height+1e-6,`${width}x${height} frame${frame}`);}}
 }
});
test("camera reverse/repeated seeks and embedded browser evaluator agree without mutable state",()=>{
 const before=JSON.stringify({document,actions}),viewport=uiStageViewport(1920,1080),middle=expectedUiCamera(document,actions,115,viewport),embedded=runInNewContext(`(${uiCameraEvaluatorSource()})`);
 expectedUiCamera(document,actions,190,viewport);assert.deepEqual(expectedUiCamera(document,actions,115,viewport),middle);assert.equal(JSON.stringify(embedded(document,actions,115,viewport)),JSON.stringify(middle));assert.equal(JSON.stringify({document,actions}),before);
 assert.throws(()=>expectedUiCamera(document,[{...actions[0],targetId:"missing"}],70,viewport),/target missing/);assert.throws(()=>expectedUiCamera(document,actions,-1,viewport),/Invalid/);
});
