import type { Plan, Scene } from "./types";

/** Trusted staging surrounds evidence. These surfaces never become product UI. */
export type DirectionFrame = { x:number;y:number;scale:number;lightX:number;lightY:number;rotation:number;settled:boolean };
export type DirectedShot = { concept:"focus"|"connect"|"consolidate";job:string;motion:string;from:{x:number;y:number};to:{x:number;y:number};travelFrames:number;continues:boolean };

export function directedShot(plan:Plan,scene:Scene,index:number):DirectedShot|undefined {
  if(!plan.creativeDirection||!scene.direction||scene.preserve_audio)return undefined;
  if(plan.creativeDirection.version!==1||scene.direction.version!==1||!["focus","connect","consolidate"].includes(plan.creativeDirection.concept)||!["hook","context","action","result","payoff","cta"].includes(scene.direction.job)||!["reveal","focus","connect","consolidate","hold"].includes(scene.direction.motion))throw new Error("Unsupported trusted shot direction");
  const concept=plan.creativeDirection.concept,job=scene.direction.job;
  const anchor=(role:string)=>({hook:{x:68,y:62},context:{x:80,y:72},action:{x:78,y:74},result:{x:83,y:78},payoff:{x:30,y:70},cta:{x:50,y:68}}[role]||{x:72,y:72});
  const previous=plan.scenes[index-1],continues=!!(previous?.direction&&scene.direction.continuityKey&&previous.direction.continuityKey===scene.direction.continuityKey&&!previous.preserve_audio);
  const to=anchor(job),from=continues?anchor(previous.direction!.job):{x:to.x-12,y:to.y+9};
  const visual=scene.presentation?.visual;
  const actionEnd=visual?.kind==="ui-demo"?visual.actions.reduce((last,action)=>Math.max(last,action.atFrame+action.durationFrames),0):0;
  // Decorative motion can accompany actions; it stops before the stable reading outcome.
  const travelFrames=scene.direction.motion==="hold"?18:Math.min(Math.max(24,actionEnd||Math.round(scene.duration_frames*.40)),Math.max(18,scene.duration_frames-45));
  return{concept,job,motion:scene.direction.motion,from,to,travelFrames,continues};
}

/** Frame-only material clock. Identical seeks cannot accumulate transforms or noise. */
export function expectedDirectionFrame(shot:DirectedShot,frame:number):DirectionFrame {
  if(!Number.isInteger(frame)||frame<0||shot.travelFrames<1)throw new Error("Invalid directed frame");
  const p=Math.min(1,frame/shot.travelFrames),ease=p*p*(3-2*p);
  return{x:shot.from.x+(shot.to.x-shot.from.x)*ease,y:shot.from.y+(shot.to.y-shot.from.y)*ease,scale:shot.continues?1:1.10-.10*ease,lightX:shot.continues?61:24+37*ease,lightY:shot.continues?34:18+16*ease,rotation:shot.continues?5:-14+19*ease,settled:p===1};
}
export const directionEvaluatorSource=()=>expectedDirectionFrame.toString();

export function directionMarkup(_shot:DirectedShot,index:number){
  return`<div class="directed-atmosphere" data-designed-stage aria-hidden="true"><div class="direction-wash"></div><div class="direction-grain"></div><div class="direction-material" id="direction-material-${index}"><i class="direction-volume"></i><i class="direction-rim"></i><i class="direction-orbit"></i></div><svg class="direction-thread" viewBox="0 0 1000 700" preserveAspectRatio="none"><path d="M-50 580 C160 580 140 300 430 340 S710 120 1060 240"/></svg><div class="direction-floor"></div></div>`;
}

export const directedCss=`
.scene.directed{isolation:isolate;background:var(--stage-bg);color:var(--stage-fg)}
.directed-atmosphere{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none}
.direction-wash{position:absolute;inset:0;background:radial-gradient(ellipse at 78% 74%,color-mix(in srgb,var(--accent) 13%,transparent),transparent 55%),linear-gradient(130deg,color-mix(in srgb,var(--stage-fg) 3%,transparent),transparent 47%)}
.direction-grain{position:absolute;inset:0;opacity:.035;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.62' numOctaves='3' seed='17' stitchTiles='stitch'/%3E%3C/filter%3E%3Cpath fill='%23888' filter='url(%23g)' d='M0 0h160v160H0z'/%3E%3C/svg%3E");mix-blend-mode:soft-light}
.direction-material{position:absolute;width:62%;height:94%;left:0;top:0;transform:translate(-50%,-50%);opacity:.66;will-change:transform}
.direction-volume{position:absolute;inset:9%;border-radius:50%;background:radial-gradient(ellipse at var(--light-x,24%) var(--light-y,18%),#ffffff70 0%,#ffffff14 19%,transparent 37%),radial-gradient(ellipse at 64% 67%,color-mix(in srgb,var(--accent) 44%,transparent),transparent 65%);box-shadow:inset 0 1px 1px #ffffff50,inset 0 -42px 80px color-mix(in srgb,var(--accent) 10%,transparent);filter:blur(1px)}
.direction-rim{position:absolute;inset:8%;border:1px solid color-mix(in srgb,var(--accent) 23%,transparent);border-radius:50%;box-shadow:0 -1px 1px #ffffff90,inset 0 1px 1px #ffffff55;transform:rotate(-18deg) scaleY(.78)}
.direction-orbit{position:absolute;inset:1%;border:1px solid color-mix(in srgb,var(--stage-fg) 7%,transparent);border-radius:50%;transform:rotate(12deg) scaleY(.78)}
.direction-thread{position:absolute;inset:0;width:100%;height:100%;opacity:0;fill:none;stroke:color-mix(in srgb,var(--accent) 19%,transparent);stroke-width:1.2}
.direction-floor{position:absolute;left:8%;right:8%;height:1px;bottom:8%;background:linear-gradient(90deg,transparent,var(--line),transparent);box-shadow:0 30px 80px 35px color-mix(in srgb,var(--accent) 4%,transparent)}
.direction-connect .direction-thread{opacity:1}.direction-connect .direction-volume{border-radius:36%;filter:blur(22px)}
.direction-consolidate .direction-volume{border-radius:15%;transform:rotate(-9deg);box-shadow:14px 18px 0 color-mix(in srgb,var(--accent) 7%,transparent),28px 36px 0 color-mix(in srgb,var(--accent) 4%,transparent),inset 0 1px 1px #ffffff70}
.direction-consolidate .direction-rim,.direction-consolidate .direction-orbit{border-radius:15%;transform:rotate(-9deg)}
.directed .heading,.directed .brand-group,.directed .cards,.directed .connection-graphic,.directed .proof-media,.directed .ui-demo-stage{z-index:2}
.directed .hook-planes{display:none}.directed .info-card,.directed .connection-node{background:linear-gradient(135deg,color-mix(in srgb,var(--surface) 95%,white),var(--surface));border:1px solid var(--line);box-shadow:inset 0 1px 0 #ffffff48,0 22px 60px #00000012,0 4px 12px #00000008}
.directed .info-card.featured{background:var(--accent);color:var(--accent-text)}
.directed .word,.directed .letter{will-change:transform,opacity;backface-visibility:hidden}
.directed .proof-media:not(.proof-panels),.directed .source-panel{filter:drop-shadow(0 22px 30px #00000015)}
.directed .ui-demo-stage{box-shadow:0 34px 85px #00000020,0 4px 16px #00000012;outline:1px solid var(--line)}
.directed .ui-document{box-shadow:none}
.directed .connection-node{border-radius:32px}.directed .connection-edge{stroke-width:3;filter:drop-shadow(0 3px 8px color-mix(in srgb,var(--accent) 18%,transparent))}
`;

/** Separate choreography tracks stay within existing entry/reading windows. */
export function directedTimeline(tl:any,root:string,scene:any,start:number){
 const immediateRender=false,hold=scene.directed.motion==="hold";
 tl.fromTo(root+' .word',{y:hold?12:42,opacity:0,clipPath:'inset(0% 0% 100% 0%)'},{y:0,opacity:1,clipPath:'inset(0% 0% 0% 0%)',duration:.36,stagger:{amount:.18},ease:'power3.out',immediateRender},start+.06);
 tl.fromTo(root+' .letter',{y:hold?14:34,opacity:0,rotateX:hold?0:-22},{y:0,opacity:1,rotateX:0,duration:.28,stagger:{amount:.33},ease:'power3.out',immediateRender},start+.05);
 tl.fromTo(root+' .detail',{y:16,opacity:0},{y:0,opacity:1,duration:.36,ease:'power2.out',immediateRender},start+.25);
 tl.fromTo(root+' .audience-label',{y:10,opacity:0},{y:0,opacity:1,duration:.36,ease:'power2.out',immediateRender},start+.06);
 tl.fromTo(root+' .brand-line',{y:14,opacity:0},{y:0,opacity:1,duration:.35,ease:'power2.out',immediateRender},start+.65);
 tl.fromTo(root+' .brand-pill',{y:10,scale:.98,opacity:0},{y:0,scale:1,opacity:1,duration:.34,ease:'power2.out',immediateRender},start+.95);
 tl.fromTo(root+' .brand-logo',{y:18,scale:.90,opacity:0},{y:0,scale:1,opacity:1,duration:.62,ease:'power3.out',immediateRender},start+.08);
 // Outer stage finishes before the first legal UI action at frame30.
 tl.fromTo(root+' .ui-demo-stage',{y:38,scale:.96,rotateX:3,opacity:0},{y:0,scale:1,rotateX:0,opacity:1,duration:.70,ease:'power3.out',immediateRender},start+.12);
 if(scene.visual==='focus'){
  tl.set(root+' .proof-media',{y:0,scale:1,opacity:1},start);
  tl.fromTo(root+' .focus-image',scene.focus.from,{...scene.focus.to,duration:1,ease:'power2.inOut',immediateRender},start+.12);
 }else if(scene.visual==='panels'){
  tl.set(root+' .proof-media',{y:0,scale:1,opacity:1},start);
  tl.fromTo(root+' .source-panel',{x:(i:number)=>i%2?48:-48,y:22,scale:.95,opacity:0},{x:0,y:0,scale:1,opacity:1,duration:.60,stagger:.24,ease:'power3.out',immediateRender},start+.18);
 }else tl.fromTo(root+' .proof-media',{y:hold?14:38,scale:hold?.99:.94,rotateY:hold?0:-4,opacity:0},{y:0,scale:1,rotateY:0,opacity:1,duration:scene.visual==='showcase'?.72:.5,ease:'power3.out',immediateRender},start+(scene.visual==='showcase'?.12:.2));
 tl.fromTo(root+' .connection-node',{y:24,scale:.92,opacity:0},{y:0,scale:1,opacity:1,duration:.45,stagger:.18,ease:'power3.out',immediateRender},start+.18);
 tl.fromTo(root+' .connection-edge',{strokeDashoffset:1},{strokeDashoffset:0,duration:.55,stagger:.24,ease:'power2.inOut',immediateRender},start+.35);
 tl.fromTo(root+' .info-card',{y:32,scale:.97,opacity:0},{y:0,scale:1,opacity:1,duration:.4,stagger:.12,ease:'power3.out',immediateRender},start+.42);
}
export const directedTimelineSource=()=>directedTimeline.toString();
