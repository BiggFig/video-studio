/** Shared integer-frame timing budget for trusted HTML templates at 30fps. */
export const uiActionEndFrame=(actions:{atFrame:number;durationFrames:number}[])=>actions.reduce((last,action)=>Math.max(last,action.atFrame+action.durationFrames),0);
export function motionTimingForPresentation(presentation:{template:string;transition:string;cards?:unknown[];visual?:{kind:string;actions?:{atFrame:number;durationFrames:number}[]}}|undefined,detailPresent:boolean):{entryFrames:number;exitFrames:number}{
  if(!presentation)return {entryFrames:21,exitFrames:0};
  const {template,cards,transition}=presentation;
  const cardFrames=cards?.length?Math.ceil((82+12*(cards.length-1))*30/100):0;
  const primitiveFrames=presentation.visual?.kind==="ui-demo"?Math.max(30,uiActionEndFrame(presentation.visual.actions||[])):({showcase:30,focus:36,panels:34,connections:42}as Record<string,number>)[presentation.visual?.kind||""]||0;
  const entryFrames=Math.max(primitiveFrames,template==="brand"||template==="cta"?(detailPresent?39:30):template==="proof"?21:Math.max(19,cardFrames));
  return {entryFrames,exitFrames:transition==="cut"?0:12};
}
