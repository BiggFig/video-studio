import type { Plan, Scene } from "./types";

/** Trusted staging surrounds evidence. These surfaces never become product UI. */
export type DirectionFrame = { x:number;y:number;scale:number;lightX:number;lightY:number;rotation:number;settled:boolean };
export type DirectedShot = { version:1|2;concept:"focus"|"connect"|"consolidate";job:string;motion:string;from:{x:number;y:number};to:{x:number;y:number};travelFrames:number;continues:boolean;system?:"editorial"|"workbench"|"relationships";materialStartFrame?:number };

export function directedShot(plan:Plan,scene:Scene,index:number):DirectedShot|undefined {
  if(!plan.creativeDirection||!scene.direction||scene.preserve_audio)return undefined;
  if(plan.creativeDirection.version!==1||![1,2].includes(scene.direction.version)||!["focus","connect","consolidate"].includes(plan.creativeDirection.concept)||!["hook","context","action","result","payoff","cta"].includes(scene.direction.job)||!["reveal","focus","connect","consolidate","hold"].includes(scene.direction.motion))throw new Error("Unsupported trusted shot direction");
  const version=scene.direction.version,concept=plan.creativeDirection.concept,job=scene.direction.job;
  const anchor=(role:string)=>version===2?({hook:{x:88,y:74},context:{x:79,y:73},action:{x:90,y:56},result:{x:86,y:69},payoff:{x:12,y:78},cta:{x:89,y:88}}[role]||{x:88,y:74}):({hook:{x:68,y:62},context:{x:80,y:72},action:{x:78,y:74},result:{x:83,y:78},payoff:{x:30,y:70},cta:{x:50,y:68}}[role]||{x:72,y:72});
  const previous=plan.scenes[index-1],continues=!!(previous?.direction&&scene.direction.continuityKey&&previous.direction.continuityKey===scene.direction.continuityKey&&!previous.preserve_audio);
  const to=anchor(job),from=continues?anchor(previous.direction!.job):{x:to.x-12,y:to.y+9};
  const visual=scene.presentation?.visual;
  const actionEnd=visual?.kind==="ui-demo"?visual.actions.reduce((last,action)=>Math.max(last,action.atFrame+action.durationFrames),0):0;
  // Decorative motion can accompany actions; it stops before the stable reading outcome.
  const travelFrames=scene.direction.motion==="hold"?18:Math.min(Math.max(24,actionEnd||Math.round(scene.duration_frames*.40)),Math.max(18,scene.duration_frames-45));
  if(scene.shotDirection){
    const system=plan.shotDirector?.visualSystem;
    if(!system||!["editorial","workbench","relationships"].includes(system.family)||!["paper","ink","glass"].includes(system.material)||!["square","rounded"].includes(system.corners))throw new Error("Unsupported shot visual system");
    return{version,concept,job,motion:scene.direction.motion,from,to,travelFrames:Math.max(1,Math.min(travelFrames,scene.shotDirection.resultHold?.startFrame??travelFrames)-scene.shotDirection.layers.material.startFrame),continues,system:system.family,materialStartFrame:scene.shotDirection.layers.material.startFrame};
  }
  return{version,concept,job,motion:scene.direction.motion,from,to,travelFrames,continues};
}

// These finite descriptions track the renderer branches below. They describe
// intentional stage paint, never certify the sampled pixels or product UI.
const stageDescriptions={
 workbench:"Workbench stage: horizontal and vertical 1px grid lines repeat every 100px at 0.14 opacity; a 1px bottom axis and three overlapping rounded material panels with 1px outlines sit behind the content.",
 editorial:"Editorial stage: a faint diagonal ground wash, a 1px bottom axis and two offset flat rectangular material shapes sit behind the content.",
 relationships:"Relationships stage: a faint diagonal ground wash, a 1px bottom axis and three concentric elliptical material shapes with 2px outlines and an accent center sit behind the content.",
 legacy:"Material stage: faint gradient wash and deterministic grain, shaded volume, thin rim/orbit outlines and a horizontal floor line sit behind the content.",
 legacyConnect:"Material connect stage: faint gradient wash and deterministic grain, blurred volume, thin rim/orbit outlines, a curved connecting thread and a horizontal floor line sit behind the content.",
 legacyConsolidate:"Material consolidate stage: faint gradient wash and deterministic grain, stacked rectangular volume, thin rectangular rim/orbit outlines and a horizontal floor line sit behind the content.",
 paper:"Paper stage: a faint diagonal wash, 1px top axis, three overlapping sheets with thin outlines and a small accent corner sit behind the content.",
 paperContext:"Paper context stage: a faint diagonal wash, three large outlined transparent sheets and a small accent corner sit behind the content; the axis is hidden.",
 paperAction:"Paper action/result stage: a faint diagonal wash and 1px bottom axis sit behind the content; material sheets and accent corner are hidden.",
 paperPayoff:"Paper payoff stage: a faint diagonal wash, 1px top axis, one translucent accent sheet and a small accent corner sit behind the content.",
 paperCta:"Paper CTA stage: a faint diagonal wash, 1px bottom axis, two overlapping accent/background cutout sheets and a small accent corner sit behind the content.",
} as const;
const stageOpacity={quiet:" Material group opacity is 0.08 for this action/result scene.",normal:" Material group opacity is 0.32 for this scene."} as const;
function describeDesignedStage(shot:DirectedShot):string {
 if(shot.system)return stageDescriptions[shot.system]+stageOpacity[shot.version===2&&["action","result"].includes(shot.job)?"quiet":"normal"];
 if(shot.version===1)return stageDescriptions[shot.concept==="connect"?"legacyConnect":shot.concept==="consolidate"?"legacyConsolidate":"legacy"];
 return stageDescriptions[shot.job==="context"?"paperContext":["action","result"].includes(shot.job)?"paperAction":shot.job==="payoff"?"paperPayoff":shot.job==="cta"?"paperCta":"paper"];
}
export function designedStageForScene(plan:Plan,scene:Scene,index:number):string|undefined {
 const shot=directedShot(plan,scene,index);return shot?describeDesignedStage(shot):undefined;
}
/** Exact maximum of the finite legal descriptors, including JSON escaping. */
export const maximumDesignedStageDescription=[...Object.values(stageDescriptions),...(["workbench","editorial","relationships"] as const).flatMap(family=>Object.values(stageOpacity).map(opacity=>stageDescriptions[family]+opacity))].reduce((a,b)=>JSON.stringify(a).length>=JSON.stringify(b).length?a:b,"");

/** Frame-only material clock. Identical seeks cannot accumulate transforms or noise. */
export function expectedDirectionFrame(shot:DirectedShot,frame:number):DirectionFrame {
  if(!Number.isInteger(frame)||frame<0||shot.travelFrames<1)throw new Error("Invalid directed frame");
  const p=Math.max(0,Math.min(1,(frame-(shot.materialStartFrame||0))/shot.travelFrames)),ease=p*p*(3-2*p);
  if(shot.version===2)return{x:shot.from.x+(shot.to.x-shot.from.x)*ease,y:shot.from.y+(shot.to.y-shot.from.y)*ease,scale:shot.continues?1:1.06-.06*ease,lightX:61,lightY:34,rotation:shot.continues?0:-4+4*ease,settled:p===1};
  return{x:shot.from.x+(shot.to.x-shot.from.x)*ease,y:shot.from.y+(shot.to.y-shot.from.y)*ease,scale:shot.continues?1:1.10-.10*ease,lightX:shot.continues?61:24+37*ease,lightY:shot.continues?34:18+16*ease,rotation:shot.continues?5:-14+19*ease,settled:p===1};
}
export const directionEvaluatorSource=()=>expectedDirectionFrame.toString();

export function directionMarkup(_shot:DirectedShot,index:number){
  if(_shot.system)return`<div class="shot-atmosphere" data-designed-stage data-stage-version="shot-1" aria-hidden="true"><div class="shot-ground"></div><div class="shot-axis"></div><div class="direction-material shot-material" id="direction-material-${index}"><i></i><i></i><i></i></div></div>`;
  if(_shot.version===2)return`<div class="editorial-atmosphere editorial-${_shot.job}" data-designed-stage data-stage-version="2" aria-hidden="true"><div class="editorial-paper"></div><div class="editorial-axis"></div><div class="direction-material editorial-material" id="direction-material-${index}"><i class="editorial-sheet"></i><i class="editorial-sheet"></i><i class="editorial-sheet"></i></div><div class="editorial-corner"></div></div>`;
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
.editorial-atmosphere{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none}
.editorial-paper{position:absolute;inset:0;background:linear-gradient(115deg,color-mix(in srgb,var(--stage-fg) 3%,transparent),transparent 65%)}
.editorial-axis{position:absolute;left:7.5%;right:7.5%;top:10%;height:1px;background:var(--line)}
.editorial-material{width:46%;height:70%;opacity:1}
.editorial-sheet{position:absolute;inset:12%;border:1px solid color-mix(in srgb,var(--stage-fg) 17%,transparent);border-radius:4px;background:linear-gradient(145deg,color-mix(in srgb,var(--surface) 92%,var(--stage-fg)),var(--surface));box-shadow:0 38px 90px #00000012,inset 0 1px 0 #ffffff70;transform:rotate(-12deg)}
.editorial-sheet:nth-child(2){transform:translate(12%,12%) rotate(-4deg);background:var(--accent);border-color:transparent;opacity:.9}
.editorial-sheet:nth-child(3){transform:translate(26%,24%) rotate(4deg);background:var(--stage-bg);box-shadow:0 16px 50px #00000016}
.editorial-corner{position:absolute;width:12px;height:12px;left:7.5%;bottom:8%;background:var(--accent)}
.editorial-context .editorial-material{width:72%;height:130%;opacity:.32}.editorial-context .editorial-sheet{background:transparent;box-shadow:none;border-width:1px}.editorial-context .editorial-sheet:nth-child(2){background:transparent;border-color:var(--accent);opacity:1}.editorial-context .editorial-axis{display:none}
.editorial-action .editorial-material,.editorial-result .editorial-material{display:none}.editorial-action .editorial-axis,.editorial-result .editorial-axis{top:auto;bottom:7%;left:3.3%;right:3.3%}.editorial-action .editorial-corner,.editorial-result .editorial-corner{display:none}
.editorial-payoff .editorial-material{width:42%;height:105%;opacity:.16}.editorial-payoff .editorial-sheet{transform:rotate(12deg);background:var(--accent);border:0;box-shadow:none}.editorial-payoff .editorial-sheet:nth-child(2),.editorial-payoff .editorial-sheet:nth-child(3){display:none}
.editorial-cta .editorial-axis{top:auto;bottom:16%}.editorial-cta .editorial-material{width:58%;height:80%}.editorial-cta .editorial-sheet{border:0;box-shadow:none;background:var(--accent);transform:rotate(-18deg)}.editorial-cta .editorial-sheet:nth-child(2){background:var(--stage-bg);transform:translate(-4%,-12%) rotate(-18deg)}.editorial-cta .editorial-sheet:nth-child(3){display:none}
.directed-v2 .hook-planes{display:none}.directed-v2 .ui-demo-stage{outline:none;box-shadow:none;border-radius:0}.directed-v2 .ui-document{border:1px solid #ffffff20;border-radius:10px;box-shadow:0 20px 54px #00000018}
.directed-v2 .connection-node{border-radius:8px;background:var(--stage-bg);box-shadow:0 16px 42px #00000020,inset 0 1px 0 #ffffff12}.directed-v2 .connection-edge{stroke-width:5;filter:none}
.shot-atmosphere{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none}
.shot-ground{position:absolute;inset:0;background:linear-gradient(120deg,color-mix(in srgb,var(--stage-fg) 3%,transparent),transparent 72%)}
.shot-axis{position:absolute;left:5%;right:5%;bottom:6%;height:1px;background:var(--line)}
.shot-material{width:60%;height:105%;opacity:.32}
.shot-material i{position:absolute;inset:20%;border:1px solid var(--line)}
.system-editorial .shot-material i{border:0;background:color-mix(in srgb,var(--stage-fg) 7%,transparent);transform:rotate(-9deg)}
.system-editorial .shot-material i:nth-child(2){inset:28% 16% 12% 28%;background:color-mix(in srgb,var(--accent) 9%,transparent)}
.system-editorial .shot-material i:nth-child(3){display:none}
.system-workbench .shot-ground{background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:100px 100px;opacity:.14}
.system-workbench .shot-material i{border-radius:22px;box-shadow:0 28px 60px #0000000d;transform:rotate(-5deg);background:var(--surface)}
.system-workbench .shot-material i:nth-child(2){transform:translate(12%,12%) rotate(1deg)}
.system-workbench .shot-material i:nth-child(3){transform:translate(24%,24%) rotate(7deg)}
.system-relationships .shot-material i{border-radius:50%;border-width:2px;transform:scaleX(1.6) rotate(-30deg);background:none}
.system-relationships .shot-material i:nth-child(2){inset:30%;transform:scaleX(1.6) rotate(30deg)}
.system-relationships .shot-material i:nth-child(3){inset:42%;border-color:var(--accent);background:var(--accent)}
.shot-directed.job-action .shot-material,.shot-directed.job-result .shot-material{opacity:.08}
.shot-directed .ui-demo-stage{outline:none;box-shadow:none;background:transparent;border-radius:0}
.scene.shot-directed .ui-document{will-change:auto}
.scene.shot-directed .ui-demo-stage{perspective:none}
.shot-directed .word,.shot-directed .letter,.shot-directed .direction-material{will-change:auto;backface-visibility:visible}
.shot-directed .ui-pointer{transform-origin:3px 2px}
.shot-directed .ui-pointer i{left:-11px;top:-12px;width:28px;height:28px;border-width:2px}
.shot-directed.corners-square .ui-document{border-radius:8px}.shot-directed.corners-rounded .ui-document{border-radius:22px}
.shot-directed.material-paper .ui-document{box-shadow:0 24px 70px #00000012;border-color:var(--line)}
.shot-directed.material-ink .ui-document{box-shadow:0 26px 80px #00000050;border-color:var(--line)}
.shot-directed.material-glass .ui-document{box-shadow:0 20px 60px #00000018,0 1px 0 #ffffff60 inset;border-color:var(--line)}
`;

/** Separate choreography tracks stay within existing entry/reading windows. */
export function directedTimeline(tl:any,root:string,scene:any,start:number){
 const immediateRender=false,hold=scene.directed.motion==="hold";
 if(scene.shotDirection){
  const animate=(selector:string,from:unknown,to:Record<string,unknown>,at:number)=>tl.fromTo(selector,from,{...to,force3D:false},at);
  const layers=scene.shotDirection.layers,copy=start+layers.copy.startFrame/30,copyDuration=Math.min(.3,(layers.copy.enterFrames??9)/30),product=start+layers.product.startFrame/30,productDuration=Math.min(.4,(layers.product.enterFrames??12)/30);
  tl.set(root+' .heading, '+root+' .brand-group',{opacity:1},copy);
  animate(root+' .shot-atmosphere',{opacity:0},{opacity:1,duration:(layers.material.enterFrames??18)/30,ease:'power2.out',immediateRender},start+layers.material.startFrame/30);
  animate(root+' .word',{y:24,opacity:0,clipPath:'inset(0 0 100% 0)'},{y:0,opacity:1,clipPath:'inset(0 0 0% 0)',duration:copyDuration,stagger:{amount:.12},ease:'power4.out',immediateRender},copy);
  animate(root+' .letter',{y:20,opacity:0},{y:0,opacity:1,duration:copyDuration,stagger:{amount:.20},ease:'power3.out',immediateRender},copy);
  animate(root+' .detail',{y:12,opacity:0},{y:0,opacity:1,duration:copyDuration,ease:'power3.out',immediateRender},copy+.18);
  animate(root+' .audience-label',{y:8,opacity:0},{y:0,opacity:1,duration:copyDuration,ease:'power3.out',immediateRender},copy);
  animate(root+' .brand-line',{y:20,opacity:0},{y:0,opacity:1,duration:copyDuration,ease:'power4.out',immediateRender},copy+.16);
  animate(root+' .brand-pill',{y:10,opacity:0},{y:0,opacity:1,duration:copyDuration,ease:'power3.out',immediateRender},copy+.45);
  animate(root+' .brand-logo',{y:10,opacity:0},{y:0,opacity:1,duration:copyDuration,ease:'power3.out',immediateRender},copy);
  if(scene.ui?.continuation)tl.set(root+' .ui-demo-stage',{y:0,scale:1,opacity:1},start);
  else animate(root+' .ui-demo-stage',{y:16,scale:.985,opacity:0},{y:0,scale:1,opacity:1,duration:productDuration,ease:'power3.out',immediateRender},product);
  if(scene.visual==='focus'){tl.set(root+' .proof-media',{y:0,scale:1,opacity:1},product);animate(root+' .focus-image',scene.focus.from,{...scene.focus.to,duration:.8,ease:'power2.inOut',immediateRender},product+.08);}
  else if(scene.visual==='panels'){tl.set(root+' .proof-media',{y:0,scale:1,opacity:1},product);animate(root+' .source-panel',{x:(i:number)=>i%2?70:-70,opacity:0},{x:0,opacity:1,duration:productDuration,stagger:.18,ease:'power4.out',immediateRender},product);}
  else animate(root+' .proof-media',{y:26,scale:.97,opacity:0},{y:0,scale:1,opacity:1,duration:productDuration,ease:'power4.out',immediateRender},product);
  animate(root+' .connection-node',{y:20,scale:.96,opacity:0},{y:0,scale:1,opacity:1,duration:productDuration,stagger:.12,ease:'power3.out',immediateRender},product);
  animate(root+' .connection-edge',{strokeDashoffset:1},{strokeDashoffset:0,duration:.45,stagger:.22,ease:'power2.inOut',immediateRender},product+.24);
  animate(root+' .info-card',{x:(i:number)=>scene.template==='hook'?(i%2?80:-80):0,y:scene.template==='hook'?0:20,opacity:0},{x:0,y:0,opacity:1,duration:productDuration,stagger:.12,ease:'power3.out',immediateRender},product+.12);
  // Opacity is local to the layer. Inherited visibility from an initially hidden
  // scene must never become GSAP's cached "before" value during reverse seeks.
  tl.set(root+' .heading, '+root+' .brand-group',{opacity:0},start+layers.copy.endFrame/30);
  tl.set(root+' .ui-demo-stage, '+root+' .proof-media, '+root+' .cards, '+root+' .connection-graphic',{opacity:0},start+layers.product.endFrame/30);
  tl.set(root+' .shot-atmosphere',{opacity:0},start+layers.material.endFrame/30);
  return;
 }
 if(scene.directed.version===2){
  const job=scene.directed.job,side=job==="hook"||job==="cta",action=job==="action"||job==="result";
  // Every essential entrance still finishes within the original timing contract.
  tl.fromTo(root+' .word',{x:side?-32:0,y:side?0:24,opacity:0,clipPath:'inset(0% 100% 0% 0%)'},{x:0,y:0,opacity:1,clipPath:'inset(0% 0% 0% 0%)',duration:.32,stagger:{amount:.16},ease:'power4.out',immediateRender},start+.04);
  tl.fromTo(root+' .letter',{y:26,opacity:0,rotateX:-18},{y:0,opacity:1,rotateX:0,duration:.30,stagger:{amount:.26},ease:'power3.out',immediateRender},start+.04);
  tl.fromTo(root+' .detail',{x:side?-16:0,y:side?0:14,opacity:0},{x:0,y:0,opacity:1,duration:.32,ease:'power3.out',immediateRender},start+.24);
  tl.fromTo(root+' .audience-label',{y:8,opacity:0},{y:0,opacity:1,duration:.24,ease:'power2.out',immediateRender},start+.02);
  tl.fromTo(root+' .brand-line',{y:24,opacity:0,clipPath:'inset(0% 0% 100% 0%)'},{y:0,opacity:1,clipPath:'inset(0% 0% 0% 0%)',duration:.40,ease:'power4.out',immediateRender},start+.18);
  tl.fromTo(root+' .brand-pill',{y:12,opacity:0},{y:0,opacity:1,duration:.32,ease:'power2.out',immediateRender},start+.50);
  tl.fromTo(root+' .brand-logo',{y:10,opacity:0},{y:0,opacity:1,duration:.40,ease:'power3.out',immediateRender},start+.04);
  tl.fromTo(root+' .ui-demo-stage',{y:28,scale:.985,opacity:0},{y:0,scale:1,opacity:1,duration:.66,ease:'power3.out',immediateRender},start+.10);
  if(scene.visual==='focus'){tl.set(root+' .proof-media',{y:0,scale:1,opacity:1},start);tl.fromTo(root+' .focus-image',scene.focus.from,{...scene.focus.to,duration:1,ease:'power2.inOut',immediateRender},start+.12);}
  else if(scene.visual==='panels'){tl.set(root+' .proof-media',{y:0,scale:1,opacity:1},start);tl.fromTo(root+' .source-panel',{x:(i:number)=>i%2?90:-90,y:(i:number)=>i%2?20:-20,scale:.96,opacity:0},{x:0,y:0,scale:1,opacity:1,duration:.54,stagger:.22,ease:'power3.out',immediateRender},start+.14);}
  else tl.fromTo(root+' .proof-media',{y:action?24:40,scale:.975,opacity:0},{y:0,scale:1,opacity:1,duration:scene.visual==='showcase'?.62:.50,ease:'power3.out',immediateRender},start+.10);
  tl.fromTo(root+' .connection-node',{x:(i:number)=>i%2?70:-70,scale:.94,opacity:0},{x:0,scale:1,opacity:1,duration:.42,stagger:.17,ease:'power4.out',immediateRender},start+.12);
  tl.fromTo(root+' .connection-edge',{strokeDashoffset:1},{strokeDashoffset:0,duration:.50,stagger:.24,ease:'power2.inOut',immediateRender},start+.36);
  tl.fromTo(root+' .info-card',{x:(i:number)=>i%2?36:-36,y:20,opacity:0},{x:0,y:0,opacity:1,duration:.38,stagger:.12,ease:'power3.out',immediateRender},start+.38);
  return;
 }
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
// tsx/esbuild may annotate inline GSAP value functions with this identity helper.
// Keep the serialized timeline self-contained in the trusted browser document.
export const directedTimelineSource=()=>`(()=>{const __name=(value)=>value;return (${directedTimeline.toString()});})()`;
