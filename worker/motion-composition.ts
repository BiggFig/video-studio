import type { Plan, Scene } from "./types";
import { motionTimingForPresentation } from "./motion-timing";

export const MOTION_RENDERER_VERSION = "html-motion/2.0.2";
export const MOTION_FPS = 30;
export type Presentation = {template:"hook"|"brand"|"proof"|"features"|"offer"|"cta";theme:"light"|"dark";transition:"cut"|"iris"|"lift"|"expand";cards?:{title:string;body:string;evidenceId:string;evidence?:string}[]};
export const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const jsonScript=(value:unknown)=>JSON.stringify(value).replace(/</g,"\\u003c").replace(/\u2028/g,"\\u2028").replace(/\u2029/g,"\\u2029");
export const sameVisibleText=(left:string,right:string)=>left.trim().replace(/\s+/g," ").toLowerCase()===right.trim().replace(/\s+/g," ").toLowerCase();

/** Missing presentation on retained plans remains a real-media proof layout. */
export function presentation(scene:Scene,plan:Plan):Presentation {
  const value=(scene as Scene&{presentation?:Presentation}).presentation;
  const result:Presentation=value||{template:"proof",theme:plan.background,transition:"cut"};
  if(!["hook","brand","proof","features","offer","cta"].includes(result.template)||!["light","dark"].includes(result.theme)||!["cut","iris","lift","expand"].includes(result.transition)||(result.cards?.length||0)>3)throw new Error("Unsupported motion presentation");
  // A supplied speaking recording must remain visible for its entire scene.
  return scene.preserve_audio?{...result,template:"proof",transition:"cut",cards:undefined}:result;
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
  const blocks=scenes.map(({scene,index,p})=>{
    const asset=plan.assets.find(a=>a.id===scene.asset_id),src=media[scene.asset_id];
    if(!asset||asset.usage!=="output"||!["image","video"].includes(asset.kind)||!src||!/^assets\/[a-zA-Z0-9._-]+$/.test(src))throw new Error("Motion scene lacks a confined output asset");
    const dark=p.theme==="dark",brand=p.template==="brand"||p.template==="cta",cards=p.cards||[],showMedia=p.template==="proof";
    const showBrandHeadline=brand&&!sameVisibleText(scene.headline,plan.product);
    const titleOnlyFeatures=p.template==="features"&&cards.length>0&&cards.every(card=>!card.body.trim());
    const text=(value:string,letters=false)=>value.split(letters?"":/\s+/).map(x=>`<span class="${letters?"letter":"word"}">${escapeHtml(x===" "?"\u00a0":x)}</span>`).join(letters?"":" ");
    const cardHtml=cards.map((card,i)=>`<article class="info-card ${p.template==="offer"&&i===Math.floor(cards.length/2)?"featured":""}" data-evidence-id="${escapeHtml(card.evidenceId)}"><div class="card-number" aria-hidden="true">${String(i+1).padStart(2,"0")}</div><h2 data-essential>${escapeHtml(card.title)}</h2>${card.body&&!titleOnlyFeatures?`<p data-essential>${escapeHtml(card.body)}</p>`:""}</article>`).join("");
    const mediaHtml=showMedia?`<div class="proof-media" data-proof>${asset.kind==="video"?`<video id="video-${index}" class="clip" src="${src}" data-start="${scene.start_frame/30}" data-duration="${scene.duration_frames/30}" data-media-start="${scene.source_in_seconds}" data-track-index="${index+1}" preload="auto" muted playsinline></video>`:`<img src="${src}" alt="${escapeHtml(plan.product)} source visual">`}</div>`:"";
    return `<section id="scene-${index}" class="scene ${p.template} ${dark?"dark":"light"}${p.template==="offer"&&!cards.length?" offer-solo":""}${titleOnlyFeatures?" compact-features":""}" data-scene-id="${escapeHtml(scene.id)}" data-template="${p.template}">
      ${brand?`<div class="brand-group"><div class="brand-name" data-essential>${text(plan.product,true)}</div>${showBrandHeadline?`<h1 class="brand-line" data-essential>${escapeHtml(scene.headline)}</h1>`:""}${scene.detail?`<p class="brand-pill" data-essential>${escapeHtml(scene.detail)}</p>`:""}</div>`:`<div class="heading"><h1 data-essential>${text(scene.headline)}</h1>${scene.detail?`<p class="detail" data-essential>${escapeHtml(scene.detail)}</p>`:""}</div>`}
      ${p.template==="hook"?`<div class="hook-planes" aria-hidden="true"><i></i><i></i><i></i></div>`:""}
      ${cards.length?`<div class="cards ${cards.length===1?"single":""}${titleOnlyFeatures?" titles-only":""}">${cardHtml}</div>`:""}${mediaHtml}
      <div class="outgoing" aria-hidden="true" style="background:${scenes[index+1]?.p.theme==="dark"?"#0b0b0c":"#f8f9fb"}"></div>
    </section>`;
  }).join("\n");
  const config=scenes.map(({scene,index,p})=>({index,start:scene.start_frame/30,duration:scene.duration_frames/30,template:p.template,transition:p.transition,transitionSeconds:transitionFrames(scene,plan,index)/30,source:scene.source_in_seconds,preserveAudio:scene.preserve_audio}));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${g.w},height=${g.h}"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; media-src 'self' blob:; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(plan.product)} — editable motion composition</title><script src="assets/gsap.min.js"></script><style>
@font-face{font-family:Studio;src:url('assets/Geist.woff2') format('woff2');font-weight:100 900;font-style:normal;font-display:block}*{box-sizing:border-box}html,body{margin:0;width:${g.w}px;height:${g.h}px;overflow:hidden;background:#0b0b0c;font-family:Studio,Arial,sans-serif}#root{position:relative;width:100%;height:100%;overflow:hidden;background:#f8f9fb}.scene{position:absolute;inset:0;overflow:hidden;visibility:hidden}.light{background:#f8f9fb;color:#111214}.dark{background:#0b0b0c;color:#fafafa}.heading{position:absolute;top:${g.headerY}px;left:${g.pad}px;right:${g.pad}px;text-align:center;z-index:2}h1{font-size:${g.head}px;font-weight:720;line-height:1.06;letter-spacing:-.055em;margin:0;overflow-wrap:break-word}.word,.letter{display:inline-block}.word,.letter,.detail,.brand-line,.brand-pill,.proof-media,.info-card,.hook-planes i{opacity:0}.detail{max-width:1300px;margin:26px auto 0;font-size:${g.body}px;line-height:1.32;letter-spacing:-.025em;color:#65666b}.dark .detail{color:#b9bac0}.proof-media{position:absolute;top:${g.mediaY}px;bottom:${g.mediaBottom}px;left:${g.pad}px;right:${g.pad}px;display:flex;align-items:center;justify-content:center}.proof-media img,.proof-media video{display:block;width:100%;height:100%;object-fit:contain;border-radius:8px}.brand-group{position:absolute;left:${g.pad}px;right:${g.pad}px;top:50%;transform:translateY(-50%);text-align:center}.brand-name{font-size:${g.brand}px;line-height:1.05;font-weight:760;letter-spacing:-.065em;overflow-wrap:break-word}.brand-line{font-size:${g.body+8}px;line-height:1.25;letter-spacing:-.03em;font-weight:460;margin:38px auto 0;max-width:1400px}.brand-pill{display:table;max-width:90%;margin:48px auto 0;padding:18px 30px;border-radius:999px;background:#f8f9fb;color:#111214;font-size:${Math.max(27,g.body-3)}px;line-height:1.28;font-weight:600;letter-spacing:-.02em}.light .brand-pill{background:#111214;color:#fff}.cards{position:absolute;left:${g.pad}px;right:${g.pad}px;top:${g.portrait?660:g.square?370:385}px;bottom:${g.portrait?140:g.square?95:140}px;display:flex;gap:${g.portrait?24:32}px;align-items:stretch}.info-card{min-width:0;flex:1;background:#fff;color:#111214;border:1px solid #11121410;border-radius:24px;box-shadow:0 16px 40px #1216240c;padding:${g.portrait?32:42}px;display:flex;flex-direction:column;justify-content:center}.info-card.featured{background:#111214;color:#fff;transform-origin:center}.card-number{font-size:22px;letter-spacing:.08em;color:#777a80;margin-bottom:38px}.info-card h2{font-size:${g.cardTitle}px;line-height:1.12;letter-spacing:-.045em;font-weight:670;margin:0;overflow-wrap:break-word}.info-card p{font-size:${g.cardBody}px;line-height:1.38;letter-spacing:-.018em;color:#65666b;margin:28px 0 0;overflow-wrap:break-word}.featured p,.featured .card-number{color:#bfc1c5}.cards.single{max-width:${g.portrait?900:1100}px;margin:0 auto}.hook .heading{top:${g.portrait?350:g.square?260:320}px}.hook .cards{top:${g.portrait?820:g.square?530:615}px;bottom:${g.portrait?180:g.square?90:130}px}.hook .info-card{padding:28px}.hook .card-number{display:none}.hook .info-card h2{font-size:${g.cardTitle-4}px}.hook .info-card p{font-size:${g.cardBody-2}px;margin-top:14px}.hook-planes{position:absolute;width:78%;height:49%;left:11%;top:24%;opacity:.65;z-index:0}.hook-planes i{position:absolute;inset:0;border:1px solid #1418240c;border-radius:30px;background:#fff;box-shadow:0 18px 55px #19243b0a}.hook-planes i:nth-child(1){transform:translate(-26px,-32px) rotate(-3deg)}.hook-planes i:nth-child(2){transform:translate(24px,-14px) rotate(2deg)}.hook-planes i:nth-child(3){transform:translate(0,16px)}.hook .heading,.hook .cards{z-index:2}.outgoing{position:absolute;inset:0;z-index:100;visibility:hidden;pointer-events:none;transform-origin:50% 58%}
.hook .heading,.offer-solo .heading{top:50%;transform:translateY(-50%)}.hook .heading{left:16%;right:16%}.hook-planes{top:50%;height:${g.portrait?38:g.square?42:38}%;transform:translateY(-50%)}
${g.portrait?`.cards{flex-direction:column}.info-card{padding:28px 40px}.card-number{margin-bottom:16px}.info-card p{margin-top:14px}.hook .cards{top:850px}`:""}
.compact-features{display:flex;flex-direction:column;justify-content:center;padding:${g.pad}px;gap:${g.portrait?100:110}px}.compact-features .heading{position:relative;top:auto;left:auto;right:auto;flex:0 0 auto}.compact-features .cards{position:relative;top:auto;bottom:auto;left:auto;right:auto;flex:0 0 auto;width:100%;align-items:center;justify-content:center}.cards.titles-only .info-card{flex:${g.portrait?"0 0 auto":"1"};width:${g.portrait?"100%":"auto"};height:auto;min-height:${g.portrait?190:g.square?240:250}px;padding:${g.portrait?"34px 40px":"40px"}}.cards.titles-only .card-number{margin-bottom:22px}.cards.titles-only h2{font-size:${g.portrait?45:g.square?40:54}px}
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
  if(scene.preserveAudio)tl.set(root+' .proof-media',{y:0,scale:1,opacity:1},start);
  else tl.fromTo(root+' .proof-media',{y:28,scale:.985,opacity:0},{y:0,scale:1,opacity:1,duration:.5,ease:'power3.out',immediateRender:false},start+.2);
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
