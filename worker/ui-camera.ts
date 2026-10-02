import type { UiAction, UiDocument } from "./ui-reconstruction";

export const UI_CAMERA_RETURN_FRAMES = 12;
export const UI_CAMERA_MAX_ZOOM = 1.45;
type CameraAction = { kind?: string; atFrame: number; durationFrames: number };
export function uiCameraEndFrame(actions: CameraAction[]) {
  const last=actions.reduce((end,action)=>Math.max(end,action.atFrame+action.durationFrames),0);
  return last+(actions.some(action=>["pointer","type","click","select"].includes(action.kind||""))?UI_CAMERA_RETURN_FRAMES:0);
}
export function uiStageViewport(width:number,height:number,compact=false){
  const portrait=height>width,square=height===width,left=portrait?Math.round(width*.07):64,top=compact?(portrait?330:square?210:180):(portrait?480:square?290:255);
  return{left,top,width:width-2*left,height:height-top-(portrait?100:56)};
}
export interface UiCameraFrame { x:number;y:number;scale:number;targetId:string|null;phase:"wide"|"focus"|"return" }

/** Self-contained, replayable camera; embedded verbatim beside the trusted UI state evaluator. */
export function expectedUiCamera(document:UiDocument,actions:UiAction[],frame:number,viewport:{width:number;height:number},directed=false):UiCameraFrame {
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

export const uiCameraEvaluatorSource=()=>expectedUiCamera.toString();
