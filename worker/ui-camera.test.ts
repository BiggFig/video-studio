import test from "node:test";
import assert from "node:assert/strict";
import {runInNewContext} from "node:vm";
import {expectedUiCamera,uiCameraEndFrame,uiCameraEvaluatorSource,uiStageViewport,uiCameraSampleFrames,applyUiCameraContinuation,uiCameraContinuationEvaluatorSource,uiCameraContinuation,type UiCameraTrack} from "./ui-camera";
import type {UiDocument,UiAction} from "./ui-reconstruction";
import type {Plan} from "./types";

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

const semanticDocument:UiDocument={...document,elements:[
 {...document.elements[0],id:"input",rect:{x:.12,y:.19,width:.40,height:.12}},
 {...document.elements[1],id:"commit",rect:{x:.73,y:.75,width:.18,height:.10}},
 {...document.elements[1],id:"result",rect:{x:.14,y:.25,width:.56,height:.30}},
]};
const semanticTrack:UiCameraTrack={shots:[
 {atFrame:0,moveFrames:0,job:"establish",targetIds:[]},
 {atFrame:24,moveFrames:12,job:"input",targetIds:["input"]},
 {atFrame:96,moveFrames:15,job:"context",targetIds:["input","commit"]},
 {atFrame:126,moveFrames:12,job:"commit",targetIds:["commit"]},
 {atFrame:162,moveFrames:18,job:"result",targetIds:["result"]},
]};
test("semantic shots isolate input and commit without future target unions, then hold the result",()=>{
 const view=uiStageViewport(1920,1080,true,true);
 const input=expectedUiCamera(semanticDocument,actions,48,view,true,semanticTrack),commit=expectedUiCamera(semanticDocument,actions,144,view,true,semanticTrack);
 assert.ok(input.scale>2,"input receives an actual close-up");assert.ok(commit.scale>3,"small commit control owns the frame");
 assert.deepEqual(input.targetIds,["input"]);assert.deepEqual(commit.targetIds,["commit"]);
 assert.ok(commit.x<input.x&&commit.y<input.y,"camera travels to the real button position");
 const result=expectedUiCamera(semanticDocument,actions,180,view,true,semanticTrack);
 for(let frame=180;frame<240;frame++)assert.deepEqual(expectedUiCamera(semanticDocument,actions,frame,view,true,semanticTrack),result,"complete result hold has no automatic return");
 assert.equal(result.shotJob,"result");assert.equal(result.settled,true);
});
test("semantic camera keeps each settled essential group inside independently composed placements",()=>{
 const placements=[[1920,1080],[1080,1350],[1080,1920]],stageHeights=new Set<number>();
 for(const [width,height]of placements){
  const view=uiStageViewport(width,height,true,true),fit=Math.min(view.width/1000,view.height/600);stageHeights.add(view.height);
  assert.ok(view.left>=32&&view.top>=32&&view.left+view.width<=width-32&&view.top+view.height<=height-32);
  for(let frame=0;frame<240;frame++){
   const camera=expectedUiCamera(semanticDocument,actions,frame,view,true,semanticTrack);assert.ok(camera.scale>=1&&camera.scale<=4.2);
   if(!camera.settled)continue;
   for(const id of camera.targetIds||[]){const r=semanticDocument.elements.find(e=>e.id===id)!.rect,left=view.width/2+(r.x-.5)*1000*fit*camera.scale+camera.x,top=view.height/2+(r.y-.5)*600*fit*camera.scale+camera.y;
    assert.ok(left>=-1e-6&&top>=-1e-6&&left+r.width*1000*fit*camera.scale<=view.width+1e-6&&top+r.height*600*fit*camera.scale<=view.height+1e-6,`${width}x${height} frame ${frame} ${id}`);
    assert.ok(20*fit*camera.scale>=16,"source type remains readable at effective output scale");
   }
  }
 }
 assert.equal(stageHeights.size,3,"feed and reels have separate compositions");
});
test("semantic camera uses the same frame evaluator in browser and reverse seeks with no document mutations",()=>{
 const before=JSON.stringify({semanticDocument,semanticTrack}),embedded=runInNewContext(`(${uiCameraEvaluatorSource()})`),view=uiStageViewport(1080,1350,true,true);
 for(const frame of [0,24,30,36,145,180,239,31,145,0])assert.equal(JSON.stringify(embedded(semanticDocument,actions,frame,view,true,semanticTrack)),JSON.stringify(expectedUiCamera(semanticDocument,actions,frame,view,true,semanticTrack)));
 assert.equal(JSON.stringify({semanticDocument,semanticTrack}),before);
 assert.deepEqual(uiCameraSampleFrames(semanticTrack,240),[0,24,30,36,96,103,111,126,132,138,162,171,180,239]);
 for(const track of [{shots:[{...semanticTrack.shots[1],targetIds:["invented"]}]},{shots:[{...semanticTrack.shots[1],maxZoom:20}]},{shots:[semanticTrack.shots[1],semanticTrack.shots[0]]}])assert.throws(()=>expectedUiCamera(semanticDocument,actions,40,view,true,track));
});
test("object-match preserves exact source coordinates across placement changes and stays replayable",()=>{
 const from=uiStageViewport(1920,1080,false,true),to=uiStageViewport(1920,1080,true,true),previous=expectedUiCamera(semanticDocument,actions,200,from,true,semanticTrack),next=expectedUiCamera(semanticDocument,actions,0,to,true,semanticTrack),continuation={camera:previous,viewport:from,moveFrames:12};
 const start=applyUiCameraContinuation(semanticDocument,next,0,to,continuation),oldFit=Math.min(from.width/1000,from.height/600),newFit=Math.min(to.width/1000,to.height/600),r=semanticDocument.elements[2].rect;
 const position=(view:typeof from,camera:typeof previous,fit:number)=>({x:view.left+view.width/2+(r.x-.5)*1000*fit*camera.scale+camera.x,y:view.top+view.height/2+(r.y-.5)*600*fit*camera.scale+camera.y,width:r.width*1000*fit*camera.scale});
 const a=position(from,previous,oldFit),b=position(to,start,newFit);for(const key of ["x","y","width"] as const)assert.ok(Math.abs(a[key]-b[key])<.000001,key);
 assert.deepEqual(applyUiCameraContinuation(semanticDocument,next,12,to,continuation),next);
 const embedded=runInNewContext(`(${uiCameraContinuationEvaluatorSource()})`);
 for(const frame of [0,11,5,0,12,6])assert.equal(JSON.stringify(embedded(semanticDocument,next,frame,to,continuation)),JSON.stringify(applyUiCameraContinuation(semanticDocument,next,frame,to,continuation)));
});
test("object-match refuses unchanged-button disguises when neighboring input would reset",()=>{
 const doc:UiDocument={...semanticDocument,states:[{id:"initial",basis:"observed",sourceAssetId:"source",evidenceIds:["fact-1"],visibleElementIds:["input","commit","result"],selectedElementIds:[],textValues:[]}]};
 const direction={version:1,subjectIds:["input","commit"],camera:semanticTrack,exit:{kind:"object-match",documentId:doc.id,subjectIds:["commit"],nextSceneId:"next"}};
 const scene={id:"first",duration_frames:240,detail:"",presentation:{visual:{kind:"ui-demo",documentId:doc.id,actions:[]}},shotDirection:direction};
 const plan={output:{width:1920,height:1080},uiDocuments:[doc],scenes:[scene,{...scene,id:"next",shotDirection:{...direction,exit:{kind:"cut"}}}]} as unknown as Plan;
 assert.ok(uiCameraContinuation(plan,1));
 plan.scenes[0].presentation!.visual={kind:"ui-demo",documentId:doc.id,actions:[{kind:"type",atFrame:30,durationFrames:30,targetId:"input",text:"A changed query",evidenceId:"fact-1"}]};
 assert.throws(()=>uiCameraContinuation(plan,1),/reset product state/);
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

test("directed camera continues through typing and settles to the same full result without changing legacy motion",()=>{
 const viewport=uiStageViewport(1920,1080),embedded=runInNewContext(`(${uiCameraEvaluatorSource()})`);
 const legacy=expectedUiCamera(document,actions,70,viewport);
 const early=expectedUiCamera(document,actions,55,viewport,true),later=expectedUiCamera(document,actions,70,viewport,true);
 assert.notDeepEqual(early,later);assert.ok(later.scale<=legacy.scale);
 assert.deepEqual(expectedUiCamera(document,actions,168,viewport,true),{x:0,y:0,scale:1,targetId:null,phase:"wide"});
 assert.deepEqual(expectedUiCamera(document,actions,70,viewport),legacy);
 for(const [width,height]of [[1920,1080],[1080,1920],[1080,1080]]){
  const view=uiStageViewport(width,height),fit=Math.min(view.width/1000,view.height/600),dw=1000*fit,dh=600*fit;
  for(let frame=0;frame<200;frame++){
   const camera=expectedUiCamera(document,actions,frame,view,true);assert.equal(JSON.stringify(embedded(document,actions,frame,view,true)),JSON.stringify(camera));
   assert.ok(camera.scale>=1&&camera.scale<=1.45);
   if(camera.targetId){const r=document.elements.find(element=>element.id===camera.targetId)!.rect,left=view.width/2+(r.x-.5)*dw*camera.scale+camera.x,top=view.height/2+(r.y-.5)*dh*camera.scale+camera.y;assert.ok(left>=-1e-6&&top>=-1e-6&&left+r.width*dw*camera.scale<=view.width+1e-6&&top+r.height*dh*camera.scale<=view.height+1e-6,`directed ${width}x${height} frame${frame}`);}
  }
 }
});
