import type { Plan, Scene, Presentation } from "./types";
import { motionTimingForPresentation } from "./motion-timing";
import { motionUsage,resolvePresentation } from "./motion-assets";
import { focusCamera,motionPalette,logoDimensions } from "./motion-primitives";

export const MOTION_RENDERER_VERSION = "html-motion/2.1.1";
export const MOTION_FPS = 30;
export type { Presentation } from "./types";
export const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const jsonScript=(value:unknown)=>JSON.stringify(value).replace(/</g,"\\u003c").replace(/\u2028/g,"\\u2028").replace(/\u2029/g,"\\u2029");
export const sameVisibleText=(left:string,right:string)=>left.trim().replace(/\s+/g," ").toLowerCase()===right.trim().replace(/\s+/g," ").toLowerCase();

/** Missing presentation on retained plans remains a real-media proof layout. */
export function presentation(scene:Scene,plan:Plan):Presentation {
  return resolvePresentation(scene,plan);
}
export function transitionFrames(scene:Scene,plan:Plan,index:number){return index===plan.scenes.length-1||presentation(scene,plan).transition==="cut"?0:Math.min(12,Math.floor(scene.duration_frames/5));}
export function motionSampleFrames(scene:Scene,plan:Plan,index:number){
  const outgoing=transitionFrames(scene,plan,index),settled=motionTimingForPresentation(presentation(scene,plan),!!scene.detail).entryFrames;
  const hold=Math.min(scene.duration_frames-outgoing-1,settled+Math.floor((scene.duration_frames-outgoing-settled)/2));
  return [scene.start_frame,scene.start_frame+Math.min(12,scene.duration_frames-1),scene.start_frame+Math.max(0,hold),scene.start_frame+scene.duration_frames-1];
}
export function motionGeometry(plan:Plan){
  const {width:w,height:h}=plan.output,portrait=h>w,square=h===w;
  return {w,h,pad:Math.round(w*(portrait?.07:.075)),head:portrait?82:square?68:82,body:portrait?34:square?30:34,brand:portrait?102:square?116:150,cardTitle:portrait?39:square?32:40,cardBody:portrait?31:square?27:30,headerY:portrait?150:square?92:112,mediaY:portrait?620:square?370:335,mediaBottom:portrait?130:square?80:95,portrait,square};
}

/** All markup is trusted code. Provider text becomes escaped text, never scripts or CSS. */
export function motionHtml(plan:Plan,media:Record<string,string>):string {
  const g=motionGeometry(plan),scenes=plan.scenes.map((scene,index)=>({scene,index,p:presentation(scene,plan)}));
  const viewport={left:g.portrait?g.pad:64,top:g.portrait?480:g.square?290:255,width:g.w-2*(g.portrait?g.pad:64),height:g.h-(g.portrait?480:g.square?290:255)-(g.portrait?100:56)};
  const focusByIndex:Record<number,ReturnType<typeof focusCamera>>={};
  const checkedAsset=(id:string)=>{const asset=plan.assets.find(a=>a.id===id),src=media[id];if(!asset||asset.usage!=="output"||!["image","video"].includes(asset.kind)||!src||!/^assets\/[a-zA-Z0-9._-]+$/.test(src))throw new Error("Motion scene lacks a confined output asset");return{asset,src};};
  const blocks=scenes.map(({scene,index,p})=>{
    const {asset,src}=checkedAsset(scene.asset_id),usage=motionUsage(scene,plan),visual=p.visual,palette=motionPalette(plan,p.theme);
    const dark=p.theme==="dark",brand=p.template==="brand"||p.template==="cta",cards=p.cards||[],showMedia=p.template==="proof";
    const showBrandHeadline=brand&&!sameVisibleText(scene.headline,plan.product);
    const titleOnlyFeatures=p.template==="features"&&cards.length>0&&cards.every(card=>!card.body.trim());
    const text=(value:string,letters=false)=>value.split(letters?"":/\s+/).map(x=>`<span class="${letters?"letter":"word"}">${escapeHtml(x===" "?"\u00a0":x)}</span>`).join(letters?"":" ");
    const cardHtml=cards.map((card,i)=>`<article class="info-card ${p.template==="offer"&&i===Math.floor(cards.length/2)?"featured":""}" data-evidence-id="${escapeHtml(card.evidenceId)}"><div class="card-number" aria-hidden="true">${String(i+1).padStart(2,"0")}</div><h2 data-essential>${escapeHtml(card.title)}</h2>${card.body&&!titleOnlyFeatures?`<p data-essential>${escapeHtml(card.body)}</p>`:""}</article>`).join("");
    const primaryMedia=asset.kind==="video"?`<video id="video-${index}" class="clip" src="${src}" data-start="${scene.start_frame/30}" data-duration="${scene.duration_frames/30}" data-media-start="${scene.source_in_seconds}" data-track-index="${index+1}" preload="auto" muted playsinline></video>`:`<img src="${src}" alt="${escapeHtml(plan.product)} source visual">`;
    let mediaHtml=showMedia?`<div class="proof-media" data-proof data-asset-id="${escapeHtml(scene.asset_id)}">${primaryMedia}</div>`:"";
    if(visual?.kind==="focus"){
      const camera=focusCamera(asset,viewport,visual.region!);focusByIndex[index]=camera;
      mediaHtml=`<div class="proof-media focus-viewport" data-proof data-asset-id="${escapeHtml(scene.asset_id)}" data-region-id="${escapeHtml(visual.regionId)}"><img class="focus-image" src="${src}" alt="${escapeHtml(plan.product)} actual source focus" style="width:${camera.from.width}px;height:${camera.from.height}px;left:${camera.from.left}px;top:${camera.from.top}px"></div>`;
    }
    if(visual?.kind==="panels"){
      const secondary=checkedAsset(visual.secondaryAssetId);if(secondary.asset.kind!=="image")throw new Error("The second proof panel must be a real still image");
      mediaHtml=`<div class="proof-media proof-panels"><div class="source-panel" data-proof data-asset-id="${escapeHtml(scene.asset_id)}">${primaryMedia}</div><div class="source-panel" data-proof data-asset-id="${escapeHtml(visual.secondaryAssetId)}"><img src="${secondary.src}" alt="Second actual product source"></div></div>`;
    }
    let logoHtml="";if(usage.logoAssetId){const logo=checkedAsset(usage.logoAssetId);if(logo.asset.kind!=="image")throw new Error("The observed logo must be a raster image");const size=logoDimensions(logo.asset,g.w);logoHtml=`<img class="brand-logo" style="width:${size.width}px;height:${size.height}px" data-brand-mark data-asset-id="${escapeHtml(usage.logoAssetId)}" src="${logo.src}" alt="${escapeHtml(plan.product)} logo">`;}
    let connections="";
    if(visual?.kind==="connections"){
      const width=g.w-2*g.pad,height=g.portrait?920:420,nodes=visual.nodes,nodeWidth=g.portrait?Math.min(700,width):g.square?260:390,nodeHeight=g.portrait?150:130;
      const positions=nodes.map((_,i)=>({x:g.portrait?width/2:nodeWidth/2+i*(width-nodeWidth)/(nodes.length-1),y:g.portrait?nodeHeight/2+i*(height-nodeHeight)/(nodes.length-1):height/2+(i%2? -45:45)}));
      const paths=positions.slice(1).map((point,i)=>{const from=positions[i];return`<path class="connection-edge" pathLength="1" d="M ${from.x} ${from.y} C ${g.portrait?from.x:(from.x+point.x)/2} ${g.portrait?(from.y+point.y)/2:from.y}, ${g.portrait?point.x:(from.x+point.x)/2} ${g.portrait?(from.y+point.y)/2:point.y}, ${point.x} ${point.y}"/>`;}).join("");
      connections=`<div class="connection-graphic" aria-label="Explanatory graphic, not application UI" data-explanatory-graphic style="height:${height}px"><svg viewBox="0 0 ${width} ${height}" aria-hidden="true">${paths}</svg>${nodes.map((node,i)=>`<div class="connection-node" data-evidence-id="${escapeHtml(node.evidenceId)}" style="left:${positions[i].x-nodeWidth/2}px;top:${positions[i].y-nodeHeight/2}px;width:${nodeWidth}px;height:${nodeHeight}px"><span data-essential>${escapeHtml(node.label)}</span></div>`).join("")}</div>`;
    }
    const colorStyle=`--stage-bg:${palette.background};--stage-fg:${palette.foreground};--accent:${palette.accent};--muted:${palette.muted};--surface:${palette.surface};--line:${palette.line};--accent-text:${palette.accentText}`;
    const nextColor=scenes[index+1]?motionPalette(plan,scenes[index+1].p.theme).background:palette.background;
    return `<section id="scene-${index}" class="scene ${p.template} ${dark?"dark":"light"}${p.template==="offer"&&!cards.length?" offer-solo":""}${titleOnlyFeatures?" compact-features":""}${plan.brand?" branded":""}${visual?` treatment-${visual.kind}`:""}" data-scene-id="${escapeHtml(scene.id)}" data-template="${p.template}" style="${colorStyle}">
      ${brand?`<div class="brand-group">${logoHtml}<div class="brand-name" data-essential>${text(plan.product,true)}</div>${showBrandHeadline?`<h1 class="brand-line" data-essential>${escapeHtml(scene.headline)}</h1>`:""}${scene.detail?`<p class="brand-pill" data-essential>${escapeHtml(scene.detail)}</p>`:""}</div>`:`<div class="heading"><h1 data-essential>${text(scene.headline)}</h1>${scene.detail?`<p class="detail" data-essential>${escapeHtml(scene.detail)}</p>`:""}</div>`}
      ${p.template==="hook"?`<div class="hook-planes" aria-hidden="true"><i></i><i></i><i></i></div>`:""}
      ${cards.length?`<div class="cards ${cards.length===1?"single":""}${titleOnlyFeatures?" titles-only":""}">${cardHtml}</div>`:""}${mediaHtml}${connections}
      <div class="outgoing" aria-hidden="true" style="background:${nextColor}"></div>
    </section>`;
  }).join("\n");
  const config=scenes.map(({scene,index,p})=>({index,start:scene.start_frame/30,duration:scene.duration_frames/30,template:p.template,visual:p.visual?.kind,focus:focusByIndex[index],transition:p.transition,transitionSeconds:transitionFrames(scene,plan,index)/30,source:scene.source_in_seconds,preserveAudio:scene.preserve_audio}));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${g.w},height=${g.h}"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; media-src 'self' blob:; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(plan.product)} — editable motion composition</title><script src="assets/gsap.min.js"></script><style>
@font-face{font-family:Studio;src:url('assets/Geist.woff2') format('woff2');font-weight:100 900;font-style:normal;font-display:block}*{box-sizing:border-box}html,body{margin:0;width:${g.w}px;height:${g.h}px;overflow:hidden;background:#0b0b0c;font-family:Studio,Arial,sans-serif}#root{position:relative;width:100%;height:100%;overflow:hidden;background:#f8f9fb}.scene{position:absolute;inset:0;overflow:hidden;visibility:hidden}.light{background:#f8f9fb;color:#111214}.dark{background:#0b0b0c;color:#fafafa}.heading{position:absolute;top:${g.headerY}px;left:${g.pad}px;right:${g.pad}px;text-align:center;z-index:2}h1{font-size:${g.head}px;font-weight:720;line-height:1.06;letter-spacing:-.055em;margin:0;overflow-wrap:break-word}.word,.letter{display:inline-block}.word,.letter,.detail,.brand-line,.brand-pill,.proof-media,.info-card,.hook-planes i{opacity:0}.detail{max-width:1300px;margin:26px auto 0;font-size:${g.body}px;line-height:1.32;letter-spacing:-.025em;color:#65666b}.dark .detail{color:#b9bac0}.proof-media{position:absolute;top:${g.mediaY}px;bottom:${g.mediaBottom}px;left:${g.pad}px;right:${g.pad}px;display:flex;align-items:center;justify-content:center}.proof-media img,.proof-media video{display:block;width:100%;height:100%;object-fit:contain;border-radius:8px}.brand-group{position:absolute;left:${g.pad}px;right:${g.pad}px;top:50%;transform:translateY(-50%);text-align:center}.brand-name{font-size:${g.brand}px;line-height:1.05;font-weight:760;letter-spacing:-.065em;overflow-wrap:break-word}.brand-line{font-size:${g.body+8}px;line-height:1.25;letter-spacing:-.03em;font-weight:460;margin:38px auto 0;max-width:1400px}.brand-pill{display:table;max-width:90%;margin:48px auto 0;padding:18px 30px;border-radius:999px;background:#f8f9fb;color:#111214;font-size:${Math.max(27,g.body-3)}px;line-height:1.28;font-weight:600;letter-spacing:-.02em}.light .brand-pill{background:#111214;color:#fff}.cards{position:absolute;left:${g.pad}px;right:${g.pad}px;top:${g.portrait?660:g.square?370:385}px;bottom:${g.portrait?140:g.square?95:140}px;display:flex;gap:${g.portrait?24:32}px;align-items:stretch}.info-card{min-width:0;flex:1;background:#fff;color:#111214;border:1px solid #11121410;border-radius:24px;box-shadow:0 16px 40px #1216240c;padding:${g.portrait?32:42}px;display:flex;flex-direction:column;justify-content:center}.info-card.featured{background:#111214;color:#fff;transform-origin:center}.card-number{font-size:22px;letter-spacing:.08em;color:#777a80;margin-bottom:38px}.info-card h2{font-size:${g.cardTitle}px;line-height:1.12;letter-spacing:-.045em;font-weight:670;margin:0;overflow-wrap:break-word}.info-card p{font-size:${g.cardBody}px;line-height:1.38;letter-spacing:-.018em;color:#65666b;margin:28px 0 0;overflow-wrap:break-word}.featured p,.featured .card-number{color:#bfc1c5}.cards.single{max-width:${g.portrait?900:1100}px;margin:0 auto}.hook .heading{top:${g.portrait?350:g.square?260:320}px}.hook .cards{top:${g.portrait?820:g.square?530:615}px;bottom:${g.portrait?180:g.square?90:130}px}.hook .info-card{padding:28px}.hook .card-number{display:none}.hook .info-card h2{font-size:${g.cardTitle-4}px}.hook .info-card p{font-size:${g.cardBody-2}px;margin-top:14px}.hook-planes{position:absolute;width:78%;height:49%;left:11%;top:24%;opacity:.65;z-index:0}.hook-planes i{position:absolute;inset:0;border:1px solid #1418240c;border-radius:30px;background:#fff;box-shadow:0 18px 55px #19243b0a}.hook-planes i:nth-child(1){transform:translate(-26px,-32px) rotate(-3deg)}.hook-planes i:nth-child(2){transform:translate(24px,-14px) rotate(2deg)}.hook-planes i:nth-child(3){transform:translate(0,16px)}.hook .heading,.hook .cards{z-index:2}.outgoing{position:absolute;inset:0;z-index:100;visibility:hidden;pointer-events:none;transform-origin:50% 58%}
.hook .heading,.offer-solo .heading{top:50%;transform:translateY(-50%)}.hook .heading{left:16%;right:16%}.hook-planes{top:50%;height:${g.portrait?38:g.square?42:38}%;transform:translateY(-50%)}
${g.portrait?`.cards{flex-direction:column}.info-card{padding:28px 40px}.card-number{margin-bottom:16px}.info-card p{margin-top:14px}.hook .cards{top:850px}`:""}
.compact-features{display:flex;flex-direction:column;justify-content:center;padding:${g.pad}px;gap:${g.portrait?100:110}px}.compact-features .heading{position:relative;top:auto;left:auto;right:auto;flex:0 0 auto}.compact-features .cards{position:relative;top:auto;bottom:auto;left:auto;right:auto;flex:0 0 auto;width:100%;align-items:center;justify-content:center}.cards.titles-only .info-card{flex:${g.portrait?"0 0 auto":"1"};width:${g.portrait?"100%":"auto"};height:auto;min-height:${g.portrait?190:g.square?240:250}px;padding:${g.portrait?"34px 40px":"40px"}}.cards.titles-only .card-number{margin-bottom:22px}.cards.titles-only h2{font-size:${g.portrait?45:g.square?40:54}px}
.branded{background:var(--stage-bg);color:var(--stage-fg)}.branded .detail,.branded .brand-line,.branded .card-number,.branded .info-card p{color:var(--muted)}.branded .info-card,.branded .hook-planes i{background:var(--surface);color:var(--stage-fg);border-color:var(--line)}.branded .info-card.featured,.branded .brand-pill{background:var(--accent);color:var(--accent-text)}.branded .featured p,.branded .featured .card-number{color:inherit}.brand-logo{display:block;object-fit:contain;width:${g.portrait?150:g.square?130:150}px;height:${g.portrait?150:g.square?130:150}px;margin:0 auto 32px;opacity:0;filter:drop-shadow(0 16px 42px color-mix(in srgb,var(--accent) 30%,transparent))}.branded .brand-name{font-weight:750}.branded .brand-line{margin-top:30px}
.treatment-showcase,.treatment-focus,.treatment-panels{perspective:1600px}.treatment-showcase .heading,.treatment-focus .heading,.treatment-panels .heading{top:${g.portrait?130:70}px;text-align:${g.portrait?"center":"left"}}.treatment-showcase h1,.treatment-focus h1,.treatment-panels h1{font-size:${g.portrait?72:g.square?58:68}px}.treatment-showcase .detail,.treatment-focus .detail,.treatment-panels .detail{margin:20px 0 0;max-width:100%}.treatment-showcase .proof-media,.treatment-focus .proof-media,.treatment-panels .proof-media{left:${viewport.left}px;right:auto;top:${viewport.top}px;bottom:auto;width:${viewport.width}px;height:${viewport.height}px;transform-origin:50% 55%}.treatment-showcase .proof-media{filter:drop-shadow(0 28px 44px color-mix(in srgb,var(--accent) 13%,transparent))}.treatment-showcase .proof-media img,.treatment-showcase .proof-media video{border-radius:14px}.focus-viewport{display:block;overflow:hidden;border:1px solid var(--line);border-radius:20px;background:var(--surface);box-shadow:0 20px 64px color-mix(in srgb,var(--accent) 13%,transparent)}.proof-media .focus-image{position:absolute;max-width:none;object-fit:fill;border-radius:0}.proof-panels{display:flex;flex-direction:${g.portrait?"column":"row"};gap:28px}.source-panel{min-width:0;min-height:0;flex:1;display:flex;align-items:center;justify-content:center;padding:14px;border:1px solid var(--line);border-radius:22px;background:var(--surface);box-shadow:0 16px 38px #00000014;opacity:0;overflow:hidden}.source-panel img,.source-panel video{object-fit:contain}
.treatment-connections{display:flex;flex-direction:column;justify-content:center;padding:${g.pad}px;gap:${g.portrait?76:70}px}.treatment-connections .heading{position:relative;top:auto;left:auto;right:auto;flex:0 0 auto}.connection-graphic{position:relative;width:100%;flex:0 0 auto}.connection-graphic svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.connection-edge{stroke:var(--accent);stroke-width:4;fill:none;stroke-dasharray:1;stroke-dashoffset:1;stroke-linecap:round}.connection-node{position:absolute;display:flex;align-items:center;justify-content:center;padding:20px;border:1px solid var(--line);border-radius:24px;background:var(--surface);box-shadow:0 18px 60px color-mix(in srgb,var(--accent) 12%,transparent);opacity:0}.connection-node span{font-size:${g.portrait?42:g.square?36:44}px;line-height:1.12;letter-spacing:-.04em;font-weight:650;text-align:center;overflow-wrap:break-word;color:var(--stage-fg)}
</style></head><body><main id="root" data-composition-id="main" data-start="0" data-duration="${plan.output.duration_frames/30}" data-width="${g.w}" data-height="${g.h}" data-fps="30">${blocks}</main><script>
window.__studioReady=(async()=>{
 await document.fonts.load('600 32px Studio');await document.fonts.ready;
 if(!document.fonts.check('600 32px Studio'))throw new Error('Required local font unavailable');
 await Promise.all(Array.from(document.images).map(image=>image.decode()));
 const scenes=${jsonScript(config)},tl=gsap.timeline({paused:true});
 for(const scene of scenes){const root='#scene-'+scene.index,start=scene.start,end=start+scene.duration;
  tl.set(root,{autoAlpha:1},start);tl.set(root,{autoAlpha:0},end);
  tl.fromTo(root+' .word',{y:28,opacity:0},{y:0,opacity:1,duration:.36,stagger:{amount:.18},ease:'power3.out',immediateRender:false},start+.06);
  tl.fromTo(root+' .letter',{y:22,opacity:0},{y:0,opacity:1,duration:.28,stagger:{amount:.33},ease:'power2.out',immediateRender:false},start+.05);
  tl.fromTo(root+' .detail',{y:14,opacity:0},{y:0,opacity:1,duration:.36,ease:'power2.out',immediateRender:false},start+.25);
  tl.fromTo(root+' .brand-line',{y:14,opacity:0},{y:0,opacity:1,duration:.35,ease:'power2.out',immediateRender:false},start+.65);
  tl.fromTo(root+' .brand-pill',{y:12,scale:.96,opacity:0},{y:0,scale:1,opacity:1,duration:.34,ease:'power2.out',immediateRender:false},start+.95);
  tl.fromTo(root+' .brand-logo',{y:18,scale:.88,clipPath:'inset(100% 0 0 0)',opacity:0},{y:0,scale:1,clipPath:'inset(0% 0 0 0)',opacity:1,duration:.62,ease:'power3.out',immediateRender:false},start+.08);
  if(scene.preserveAudio)tl.set(root+' .proof-media',{y:0,scale:1,opacity:1},start);
  else if(scene.visual==='showcase')tl.fromTo(root+' .proof-media',{y:32,rotateY:-7,scale:.94,opacity:0},{y:0,rotateY:0,scale:1,opacity:1,duration:.72,ease:'power3.out',immediateRender:false},start+.12);
  else if(scene.visual==='focus'){
   tl.set(root+' .proof-media',{y:0,scale:1,opacity:1},start);
   tl.fromTo(root+' .focus-image',scene.focus.from,{...scene.focus.to,duration:1,ease:'power2.inOut',immediateRender:false},start+.12);
  }else if(scene.visual==='panels'){
   tl.set(root+' .proof-media',{y:0,scale:1,opacity:1},start);
   tl.fromTo(root+' .source-panel',{y:34,scale:.965,opacity:0},{y:0,scale:1,opacity:1,duration:.6,stagger:.24,ease:'power3.out',immediateRender:false},start+.18);
  }else tl.fromTo(root+' .proof-media',{y:28,scale:.985,opacity:0},{y:0,scale:1,opacity:1,duration:.5,ease:'power3.out',immediateRender:false},start+.2);
  tl.fromTo(root+' .connection-node',{y:24,scale:.97,opacity:0},{y:0,scale:1,opacity:1,duration:.45,stagger:.18,ease:'power3.out',immediateRender:false},start+.18);
  tl.fromTo(root+' .connection-edge',{strokeDashoffset:1},{strokeDashoffset:0,duration:.55,stagger:.24,ease:'power2.inOut',immediateRender:false},start+.35);
  tl.fromTo(root+' .info-card',{y:30,opacity:0},{y:0,opacity:1,duration:.4,stagger:.12,ease:'power3.out',immediateRender:false},start+.42);
  tl.fromTo(root+' .hook-planes i',{y:24,opacity:0},{y:0,opacity:1,duration:.5,stagger:.12,ease:'power3.out',immediateRender:false},start);
  if(scene.transitionSeconds){const target=root+' .outgoing',at=end-scene.transitionSeconds;tl.set(target,{autoAlpha:1},at);
   if(scene.transition==='iris')tl.fromTo(target,{clipPath:'circle(0% at 50% 58%)'},{clipPath:'circle(150% at 50% 58%)',duration:scene.transitionSeconds,ease:'power2.in',immediateRender:false},at);
   if(scene.transition==='lift')tl.fromTo(target,{yPercent:100},{yPercent:0,duration:scene.transitionSeconds,ease:'power3.inOut',immediateRender:false},at);
   if(scene.transition==='expand')tl.fromTo(target,{scaleX:.20,scaleY:.35,borderRadius:32},{scaleX:1,scaleY:1,borderRadius:0,duration:scene.transitionSeconds,ease:'power3.inOut',immediateRender:false},at);
  }
 }
 tl.set({}, {},${plan.output.duration_frames/30});tl.pause(0);window.__timelines={main:tl};
 window.__studio={version:${jsonScript(MOTION_RENDERER_VERSION)},durationFrames:${plan.output.duration_frames},fps:30,seekFrame:async(frame)=>{
  if(!Number.isInteger(frame)||frame<0||frame>=${plan.output.duration_frames})throw new Error('Frame outside composition');
  tl.seek(frame/30,false);for(const scene of scenes){const video=document.getElementById('video-'+scene.index);if(!video)continue;video.pause();video.muted=true;const time=frame/30;if(time<scene.start||time>=scene.start+scene.duration)continue;const target=scene.source+(frame-Math.round(scene.start*30))/30+.00001;
   if(video.readyState<1)await new Promise((resolve,reject)=>{video.addEventListener('loadedmetadata',resolve,{once:true});video.addEventListener('error',reject,{once:true})});
   if(Math.abs(video.currentTime-target)>.00001)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Source seek timeout')),10000);video.addEventListener('seeked',()=>{clearTimeout(timer);resolve()},{once:true});video.currentTime=target;});
  }return frame;
 }};return window.__studio;
})();
</script></body></html>`;
}
