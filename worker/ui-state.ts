import type { UiDocument,UiAction } from "./ui-reconstruction";
import type { Scene } from "./types";

export interface UiFrameState {
 stateId:string;basis:string;
 elements:Record<string,{text:string;textBasis:"source-ui"|"example-content";visible:boolean;selected:boolean;typing:boolean}>;
 pointer:{visible:boolean;x:number;y:number;clickProgress:number};
}

/** Self-contained trusted function: the same implementation is embedded in HTML. */
export function expectedUiState(document:UiDocument,actions:UiAction[],localFrame:number):UiFrameState {
 if(!Number.isInteger(localFrame)||localFrame<0)throw new Error("UI frame must be a nonnegative integer");
 const elements:UiFrameState["elements"]=Object.create(null);
 for(const element of document.elements)elements[element.id]={text:element.text,textBasis:element.textBasis,visible:element.initiallyVisible,selected:false,typing:false};
 const initial=document.states[0];
 if(!initial)throw new Error("UI document needs an initial state");
 for(const element of document.elements){elements[element.id].visible=initial.visibleElementIds.includes(element.id);elements[element.id].selected=initial.selectedElementIds.includes(element.id);}
 for(const value of initial.textValues){elements[value.elementId].text=value.text;elements[value.elementId].textBasis=value.textBasis;}
 let stateId=initial.id,basis:string=initial.basis;
 const pointer={visible:false,x:.5,y:.85,clickProgress:0};
 for(const action of actions){
  if(localFrame<action.atFrame)break;
  const end=action.atFrame+action.durationFrames,progress=action.durationFrames===0?1:Math.max(0,Math.min(1,(localFrame-action.atFrame)/action.durationFrames));
  let target:UiDocument["elements"][number]|undefined;
  for(const element of document.elements)if(element.id===action.targetId)target=element;
  if(action.kind==="pointer"){
   if(!target)throw new Error("UI pointer target missing");
   const eased=1-(1-progress)**3;pointer.x+=(target.rect.x+target.rect.width/2-pointer.x)*eased;pointer.y+=(target.rect.y+target.rect.height/2-pointer.y)*eased;pointer.visible=true;pointer.clickProgress=0;
  }else if(action.kind==="click"){
   if(!target)throw new Error("UI click target missing");
   pointer.x=target.rect.x+target.rect.width/2;pointer.y=target.rect.y+target.rect.height/2;pointer.visible=true;pointer.clickProgress=progress<1?Math.sin(progress*Math.PI):0;
  }else if(action.kind==="type"){
   if(!target)throw new Error("UI typing target missing");
   const characters=Array.from(action.text||"");elements[target.id].text=characters.slice(0,Math.floor(characters.length*progress)).join("");elements[target.id].textBasis="example-content";elements[target.id].typing=progress<1;basis="illustrative";
  }else if(action.kind==="select"){
   if(!target)throw new Error("UI selection target missing");
   if(localFrame>=end){for(const element of document.elements)elements[element.id].selected=element.id===target.id;basis="illustrative";}
  }else if(action.kind==="state"&&localFrame>=end){
   let snapshot:UiDocument["states"][number]|undefined;for(const candidate of document.states)if(candidate.id===action.stateId)snapshot=candidate;
   if(!snapshot)throw new Error("UI state target missing");
   stateId=snapshot.id;basis=snapshot.basis;
   for(const element of document.elements)elements[element.id]={text:element.text,textBasis:element.textBasis,visible:snapshot.visibleElementIds.includes(element.id),selected:snapshot.selectedElementIds.includes(element.id),typing:false};
   for(const value of snapshot.textValues){elements[value.elementId].text=value.text;elements[value.elementId].textBasis=value.textBasis;}
  }
 }
 return{stateId,basis,elements,pointer};
}

/** Absolute action samples: click midpoint shows the pulse; other actions show their result. */
export function uiActionSampleFrames(scene:Scene):number[]{
 const visual=scene.presentation?.visual;if(visual?.kind!=="ui-demo")return[];
 return [...new Set(visual.actions.map(action=>scene.start_frame+Math.min(scene.duration_frames-1,action.atFrame+(action.kind==="click"?Math.floor(action.durationFrames/2):action.durationFrames))))].sort((a,b)=>a-b);
}
