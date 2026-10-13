import type { UiAction, UiDocument } from "./ui-reconstruction";
import type { Plan, Scene } from "./types";
import { expectedUiState } from "./ui-state";

export const UI_CAMERA_RETURN_FRAMES = 12;
export const UI_CAMERA_MAX_ZOOM = 1.45;
type CameraAction = { kind?: string; atFrame: number; durationFrames: number };
export function uiCameraEndFrame(actions: CameraAction[]) {
  const last=actions.reduce((end,action)=>Math.max(end,action.atFrame+action.durationFrames),0);
  return last+(actions.some(action=>["pointer","type","click","select"].includes(action.kind||""))?UI_CAMERA_RETURN_FRAMES:0);
}
export function uiStageViewport(width:number,height:number,compact=false,shotDirected=false,illustrativePreview=false){
  const disclosureReserve=illustrativePreview?40:0;
  if(shotDirected){
    const portrait=height/width>1.45,feed=height>width&&!portrait;
    const left=Math.round(width*((portrait||feed) ? .07 : .05)),top=portrait?(compact?330:440):feed?(compact?230:330):(compact?185:270),bottom=portrait?220:feed?110:64;
    return{left,top,width:width-2*left,height:height-top-bottom-disclosureReserve};
  }
  const portrait=height>width,square=height===width,left=portrait?Math.round(width*.07):64,top=compact?(portrait?330:square?210:180):(portrait?480:square?290:255);
  return{left,top,width:width-2*left,height:height-top-(portrait?100:56)-disclosureReserve};
}

/** Shared with the directed UI CSS; none of these values measure product UI. */
export function directedUiCopyMetrics(width:number,height:number){
  const portrait=height>width,square=height===width;
  return{top:portrait?130:70,side:portrait?Math.round(width*.07):64,headlineFont:portrait?64:square?48:56,headlineLineHeight:1.06,audienceFont:portrait?32:30,audienceLineHeight:1.25,audienceGap:22,detailFont:portrait?34:square?30:34,detailLineHeight:1.32,detailGap:26,productGap:32};
}

/** Conservative layout allowance, not a font measurement or a readability pass.
 * Exact wrapped glyph bounds remain subject to the unchanged browser gates. */
function copyLineAllowance(text:string,fontSize:number,width:number){
  let lines=1,used=0;
  for(const word of text.trim().split(/\s+/)){
    const advance=Array.from(word).length*fontSize*1.2,space=used?fontSize*.5:0;
    if(used&&used+space+advance>width){lines++;used=advance;}else used+=space+advance;
  }
  return lines;
}

/** First-UI copy reserves its own band only on the new saved layout contract. */
export function sceneUiStageViewport(plan:Plan,scene:Scene){
  const visual=scene.presentation?.visual,document=visual?.kind==="ui-demo"?plan.uiDocuments?.find(value=>value.id===visual.documentId):undefined;
  const base=uiStageViewport(plan.output.width,plan.output.height,!scene.detail,!!scene.shotDirection,!!document?.previewBinding);
  if(plan.shotDirector?.uiCopyBandVersion!==1||!scene.shotDirection||scene.direction?.version!==2||visual?.kind!=="ui-demo"||scene.start_frame!==0||!plan.audienceLabel)return base;
  const metric=directedUiCopyMetrics(plan.output.width,plan.output.height),width=plan.output.width-2*metric.side;
  const audience=copyLineAllowance(plan.audienceLabel,metric.audienceFont,width)*metric.audienceFont*metric.audienceLineHeight+metric.audienceGap;
  const headline=copyLineAllowance(scene.headline,metric.headlineFont,width)*metric.headlineFont*metric.headlineLineHeight;
  const detail=scene.detail?metric.detailGap+copyLineAllowance(scene.detail,metric.detailFont,Math.min(1300,width))*metric.detailFont*metric.detailLineHeight:0;
  const top=Math.max(base.top,Math.ceil(metric.top+audience+headline+detail+metric.productGap)),height=base.height-(top-base.top);
  if(height<=0)throw new Error("The directed UI copy leaves no product viewport; shorter authored copy is required");
  return{...base,top,height};
}
export interface UiCameraShot { atFrame:number;moveFrames:number;job:"establish"|"input"|"context"|"commit"|"result";targetIds:string[];contextIds?:string[];maxZoom?:number }
export interface UiCameraTrack { shots:UiCameraShot[] }
export interface UiCameraContinuation { camera:UiCameraFrame;viewport:{left:number;top:number;width:number;height:number};moveFrames:number }
export interface UiCameraFrame { x:number;y:number;scale:number;targetId:string|null;phase:"wide"|"focus"|"return";targetIds?:string[];shotJob?:UiCameraShot["job"];settled?:boolean }

/** Explicit shot targets replace future-action unions only on the new saved contract. */
export function expectedSemanticUiCamera(document:UiDocument,track:UiCameraTrack,frame:number,viewport:{width:number;height:number}):UiCameraFrame {
  if(!Number.isInteger(frame)||frame<0||!Number.isFinite(viewport.width)||!Number.isFinite(viewport.height)||viewport.width<=0||viewport.height<=0||!track.shots.length||track.shots.length>32)throw new Error("Invalid semantic UI camera track or viewport");
  const fit=Math.min(viewport.width/document.viewport.width,viewport.height/document.viewport.height),width=document.viewport.width*fit,height=document.viewport.height*fit;
  const wide={x:0,y:0,scale:1},ease=(progress:number)=>{const p=Math.max(0,Math.min(1,progress));return p<.5?4*p**3:1-(-2*p+2)**3/2;};
  let from={...wide},to={...wide},start=0,duration=0,active:UiCameraShot|undefined,previous=-1;
  for(const shot of track.shots){
    if(!Number.isInteger(shot.atFrame)||shot.atFrame<0||shot.atFrame<=previous||!Number.isInteger(shot.moveFrames)||shot.moveFrames<0||shot.moveFrames>30||!["establish","input","context","commit","result"].includes(shot.job))throw new Error("Invalid semantic UI camera shot timing");
    previous=shot.atFrame;
    const ids=[...new Set([...shot.targetIds,...shot.contextIds||[]])],targets=ids.map(id=>document.elements.find(element=>element.id===id));
    if(targets.some(target=>!target)||(!targets.length&&shot.job!=="establish"))throw new Error("Semantic UI camera target missing");
    if(shot.maxZoom!==undefined&&(!Number.isFinite(shot.maxZoom)||shot.maxZoom<1||shot.maxZoom>4.2))throw new Error("Semantic UI camera zoom outside supported range");
    if(frame<shot.atFrame)continue;
    const progress=duration?ease((shot.atFrame-start)/duration):1;
    from={x:from.x+(to.x-from.x)*progress,y:from.y+(to.y-from.y)*progress,scale:from.scale+(to.scale-from.scale)*progress};
    to={...wide};
    if(targets.length&&shot.job!=="establish"){
      const bounds={left:Math.min(...targets.map(target=>target!.rect.x)),top:Math.min(...targets.map(target=>target!.rect.y)),right:Math.max(...targets.map(target=>target!.rect.x+target!.rect.width)),bottom:Math.max(...targets.map(target=>target!.rect.y+target!.rect.height))};
      const maxZoom=shot.maxZoom??({input:3.2,context:1.6,commit:4.2,result:2.4}[shot.job]||1),margin=32;
      const scale=Math.max(1,Math.min(maxZoom,(viewport.width-2*margin)/((bounds.right-bounds.left)*width),(viewport.height-2*margin)/((bounds.bottom-bounds.top)*height)));
      // The selected group owns the frame. Source geometry/text are never reflowed.
      // Centering this group may intentionally crop unrelated application chrome.
      const centerX=(bounds.left+bounds.right)/2,centerY=(bounds.top+bounds.bottom)/2;
      const limitX=Math.abs(width*scale-viewport.width)/2,limitY=Math.abs(height*scale-viewport.height)/2;
      const x=-(centerX-.5)*width*scale,y=-(centerY-.5)*height*scale;
      to={x:Math.max(-limitX,Math.min(limitX,x)),y:Math.max(-limitY,Math.min(limitY,y)),scale};
      // Keep the entire essential group inside even when letterboxing limits travel.
      const padX=Math.min(margin,Math.max(0,(viewport.width-(bounds.right-bounds.left)*width*scale)/2)),padY=Math.min(margin,Math.max(0,(viewport.height-(bounds.bottom-bounds.top)*height*scale)/2));
      to.x=Math.max(-viewport.width/2+padX-(bounds.left-.5)*width*scale,Math.min(viewport.width/2-padX-(bounds.right-.5)*width*scale,to.x));
      to.y=Math.max(-viewport.height/2+padY-(bounds.top-.5)*height*scale,Math.min(viewport.height/2-padY-(bounds.bottom-.5)*height*scale,to.y));
    }
    start=shot.atFrame;duration=shot.moveFrames;active=shot;
  }
  const progress=duration?ease((frame-start)/duration):1,settled=frame>=start+duration;
  return{x:from.x+(to.x-from.x)*progress,y:from.y+(to.y-from.y)*progress,scale:from.scale+(to.scale-from.scale)*progress,targetId:active?.targetIds[0]||null,targetIds:active?[...new Set([...active.targetIds,...active.contextIds||[]])]:[],phase:active&&active.job!=="establish"?"focus":"wide",shotJob:active?.job||"establish",settled};
}

export function uiCameraSampleFrames(track:UiCameraTrack,durationFrames:number):number[]{
  return [...new Set(track.shots.flatMap(shot=>[shot.atFrame,shot.atFrame+Math.floor(shot.moveFrames/2),shot.atFrame+shot.moveFrames]).concat(durationFrames-1).filter(frame=>frame>=0&&frame<durationFrames))].sort((a,b)=>a-b);
}

/** Continue the same UI in a new composition without cloning its labels or state. */
export function applyUiCameraContinuation(document:UiDocument,camera:UiCameraFrame,frame:number,viewport:{left:number;top:number;width:number;height:number},continuation?:UiCameraContinuation):UiCameraFrame {
  if(!continuation||frame>=continuation.moveFrames)return camera;
  const old=continuation.viewport,oldFit=Math.min(old.width/document.viewport.width,old.height/document.viewport.height),fit=Math.min(viewport.width/document.viewport.width,viewport.height/document.viewport.height);
  const from={x:old.left+old.width/2+continuation.camera.x-viewport.left-viewport.width/2,y:old.top+old.height/2+continuation.camera.y-viewport.top-viewport.height/2,scale:continuation.camera.scale*oldFit/fit};
  const p=Math.max(0,Math.min(1,frame/continuation.moveFrames)),ease=p*p*(3-2*p);
  return{...camera,x:from.x+(camera.x-from.x)*ease,y:from.y+(camera.y-from.y)*ease,scale:from.scale+(camera.scale-from.scale)*ease,settled:false};
}
export const uiCameraContinuationEvaluatorSource=()=>applyUiCameraContinuation.toString();

/** A matching label is insufficient: all visible/hidden document values must agree. */
export function uiCameraContinuation(plan:Plan,index:number):UiCameraContinuation|undefined {
  const scene=plan.scenes[index],previous=plan.scenes[index-1],match=previous?.shotDirection?.exit;
  if(!scene?.shotDirection||match?.kind!=="object-match")return undefined;
  const current=scene.presentation?.visual,prior=previous.presentation?.visual;
  if(match.nextSceneId!==scene.id||current?.kind!=="ui-demo"||prior?.kind!=="ui-demo"||current.documentId!==prior.documentId||match.documentId!==current.documentId)throw new Error("Shared UI transition lacks its exact adjacent document");
  const document=plan.uiDocuments?.find(value=>value.id===current.documentId);if(!document)throw new Error("Shared UI transition document missing");
  const end=expectedUiState(document,prior.actions,previous.duration_frames-1),start=expectedUiState(document,current.actions,0);
  for(const id of Object.keys(end.elements)){const a=end.elements[id],b=start.elements[id];if(!b||a.text!==b.text||a.textBasis!==b.textBasis||a.visible!==b.visible||a.selected!==b.selected)throw new Error("Shared UI transition would reset product state");}
  if(!match.subjectIds?.length||match.subjectIds.some(id=>!start.elements[id]?.visible))throw new Error("Shared UI transition subject missing");
  const viewport=sceneUiStageViewport(plan,previous);
  const camera=applyUiCameraContinuation(document,expectedUiCamera(document,prior.actions,previous.duration_frames-1,viewport,true,previous.shotDirection!.camera),previous.duration_frames-1,viewport,uiCameraContinuation(plan,index-1));
  return{camera,viewport,moveFrames:12};
}

/** Self-contained, replayable camera; embedded verbatim beside the trusted UI state evaluator. */
export function expectedUiCamera(document:UiDocument,actions:UiAction[],frame:number,viewport:{width:number;height:number},directed=false,track?:UiCameraTrack):UiCameraFrame {
  if(track)return expectedSemanticUiCamera(document,track,frame,viewport);
  if(!Number.isInteger(frame)||frame<0||!Number.isFinite(viewport.width)||!Number.isFinite(viewport.height)||viewport.width<=0||viewport.height<=0)throw new Error("Invalid UI camera frame or viewport");
  const fit=Math.min(viewport.width/document.viewport.width,viewport.height/document.viewport.height),width=document.viewport.width*fit,height=document.viewport.height*fit;
  const targets=actions.filter(action=>action.targetId).map(action=>document.elements.find(element=>element.id===action.targetId));if(targets.some(target=>!target))throw new Error("UI camera target missing");
  const context=targets.length?{left:Math.min(...targets.map(target=>target!.rect.x)),top:Math.min(...targets.map(target=>target!.rect.y)),right:Math.max(...targets.map(target=>target!.rect.x+target!.rect.width)),bottom:Math.max(...targets.map(target=>target!.rect.y+target!.rect.height))}:{left:0,top:0,right:1,bottom:1};
  const wide={x:0,y:0,scale:1};
  let from={...wide},to={...wide},start=0,duration=1,targetId:string|null=null,phase:UiCameraFrame["phase"]="wide",last=0,focused=false;
  for(const action of actions){
    last=Math.max(last,action.atFrame+action.durationFrames);
    if(!["pointer","type","click","select"].includes(action.kind))continue;
    focused=true;if(frame<action.atFrame)continue;
    const element=document.elements.find(element=>element.id===action.targetId);if(!element)throw new Error("UI camera target missing");
    const r=element.rect,scale=Math.max(1,Math.min(1.45,(viewport.width-48)/((context.right-context.left)*width),(viewport.height-48)/((context.bottom-context.top)*height)));
    const x=-(r.x+r.width/2-.5)*width*scale,y=-(r.y+r.height/2-.5)*height*scale;
    // Keep the document within spare space or cover the clipped viewport when enlarged.
    // This prevents drift into empty space while preserving the complete active control.
    const limitX=Math.abs(width*scale-viewport.width)/2,limitY=Math.abs(height*scale-viewport.height)/2;
    const next={x:Math.max(-viewport.width/2-(context.left-.5)*width*scale,Math.min(viewport.width/2-(context.right-.5)*width*scale,Math.max(-limitX,Math.min(limitX,x)))),y:Math.max(-viewport.height/2-(context.top-.5)*height*scale,Math.min(viewport.height/2-(context.bottom-.5)*height*scale,Math.max(-limitY,Math.min(limitY,y)))),scale};
    const progress=Math.max(0,Math.min(1,(action.atFrame-start)/duration)),ease=progress<.5?4*progress**3:1-(-2*progress+2)**3/2;
    from={x:from.x+(to.x-from.x)*ease,y:from.y+(to.y-from.y)*ease,scale:from.scale+(to.scale-from.scale)*ease};to=next;start=action.atFrame;duration=Math.max(1,directed&&action.kind!=="click"?action.durationFrames:Math.min(12,action.kind==="click"?Math.floor(action.durationFrames/2):action.durationFrames));targetId=element.id;phase=scale>1.000001?"focus":"wide";
  }
  if(focused&&frame>=last){const progress=Math.max(0,Math.min(1,(last-start)/duration)),ease=progress<.5?4*progress**3:1-(-2*progress+2)**3/2;from={x:from.x+(to.x-from.x)*ease,y:from.y+(to.y-from.y)*ease,scale:from.scale+(to.scale-from.scale)*ease};to=wide;start=last;duration=12;phase=frame>=last+12?"wide":"return";if(phase==="wide")targetId=null;}
  const progress=Math.max(0,Math.min(1,(frame-start)/duration)),ease=progress<.5?4*progress**3:1-(-2*progress+2)**3/2;
  return{x:from.x+(to.x-from.x)*ease,y:from.y+(to.y-from.y)*ease,scale:from.scale+(to.scale-from.scale)*ease,targetId,phase};
}

export const uiCameraEvaluatorSource=()=>`(()=>{const __name=(value)=>value;const expectedSemanticUiCamera=${expectedSemanticUiCamera.toString()};return (${expectedUiCamera.toString()});})()`;
