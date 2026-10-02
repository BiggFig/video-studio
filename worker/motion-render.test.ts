import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,mkdir,writeFile,rm,realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join,relative,isAbsolute } from "node:path";
import { runInNewContext } from "node:vm";
import type { Plan } from "./types";
import { motionHtml,presentation,motionSampleFrames,transitionFrames } from "./motion-composition";
import { confinedMotionAsset,serveMotionProject } from "./motion-render";
import { expectedReviewCalls,requiresStyleReview,assessReferenceStyle } from "./quality";
import { motionTimingForPresentation } from "./motion-timing";

function fixture():Plan{return{version:1,job_id:"test",mode:"create",renderer:"ffmpeg",output:{width:1920,height:1080,fps:30,duration_frames:720},product:"Source <script>alert(1)</script>",summary:"",accent:"#123456",background:"light",assets:[{id:"real",path:"assets/real.png",kind:"image",usage:"output",rights:"fixture",width:1920,height:1080}],scenes:(["hook","brand","proof","features","offer","cta"]as const).map((template,index)=>({id:`scene-${index}`,start_frame:index*120,duration_frames:120,asset_id:"real",source_in_seconds:0,playback_rate:1,preserve_audio:false,fit:"contain",purpose:"test",reference_technique:"",headline:"An evidenced headline",detail:"An evidenced short detail",evidence:"exact source",effects:[],presentation:{template,theme:template==="brand"||template==="cta"?"dark":"light",transition:index===0?"iris":index===1?"lift":index===4?"expand":"cut",cards:template==="features"||template==="offer"?[{title:"Source fact",body:"An exact factual explanation.",evidenceId:"fact-1",evidence:"exact source"}]:undefined}})),captions:[],audio:[],music_prompt:"",sfx_prompt:"",assumptions:[]};}
test("trusted motion composition escapes source text and permits only local allowlisted visuals",()=>{
 const plan=fixture(),html=motionHtml(plan,{real:"assets/media-0.png"});
 assert.ok(!html.includes("Source <script>"));assert.ok(html.includes("&lt;"));assert.match(html,/seekFrame/);assert.match(html,/paused:true/);assert.equal((html.match(/<section /g)||[]).length,6);assert.equal((html.match(/<img /g)||[]).length,1);assert.match(html,/data-evidence-id="fact-1"/);assert.match(html,/connect-src 'none'/);
 assert.throws(()=>motionHtml(plan,{real:"https://attacker.test/image.png"}));assert.throws(()=>motionHtml(plan,{real:"../private.png"}));plan.assets[0].usage="reference";assert.throws(()=>motionHtml(plan,{real:"assets/media.png"}),/confined output/);
});
test("brand removes only the repeated product line and cardless offers use the centered stage",()=>{
 const plan=fixture();plan.product="Obsidian";plan.scenes[1].headline="  OBSIDIAN  ";plan.scenes[4].presentation!.cards=undefined;plan.scenes[5].headline="Get Obsidian";
 const html=motionHtml(plan,{real:"assets/media-0.png"}),sections=html.match(/<section\b[\s\S]*?<\/section>/g)!;
 assert.doesNotMatch(sections[1],/class="brand-line"/);assert.match(sections[1],/class="brand-name"/);assert.match(sections[1],/An evidenced short detail/);
 assert.match(sections[5],/class="brand-line" data-essential>Get Obsidian<\/h1>/);
 assert.match(sections[4],/class="scene offer light offer-solo"/);assert.doesNotMatch(sections[4],/<img|<video|class="cards/);
 plan.scenes[1].headline="Obsidian for teams";plan.scenes[4].presentation!.cards=[{title:"Real offer",body:"Source terms",evidenceId:"fact-1"}];
 const distinct=motionHtml(plan,{real:"assets/media-0.png"}).match(/<section\b[\s\S]*?<\/section>/g)!;
 assert.match(distinct[1],/class="brand-line" data-essential>Obsidian for teams/);assert.doesNotMatch(distinct[4],/offer-solo/);assert.match(distinct[4],/class="cards single"/);
 // The layout transform belongs to the heading wrapper; GSAP animates its children.
 assert.match(html,/\.hook \.heading,\.offer-solo \.heading\{top:50%;transform:translateY\(-50%\)\}/);
});
test("compact feature cards require every body empty and never alter offers or mixed cards",()=>{
 const plan=fixture();plan.scenes[3].presentation!.cards=[{title:"Links",body:"",evidenceId:"fact-1"},{title:"Graph",body:" \n ",evidenceId:"fact-2"},{title:"Plugins",body:"",evidenceId:"fact-3"}];
 plan.scenes[4].presentation!.cards=[{title:"Verified free offer",body:"",evidenceId:"fact-4"}];
 const sections=motionHtml(plan,{real:"assets/media-0.png"}).match(/<section\b[\s\S]*?<\/section>/g)!;
 assert.match(sections[3],/class="cards  titles-only"/);assert.equal((sections[3].match(/<h2 data-essential>/g)||[]).length,3);assert.doesNotMatch(sections[3],/<p data-essential>/);assert.doesNotMatch(sections[4],/titles-only/);
 plan.scenes[3].presentation!.cards![1].body="An actual supported detail.";
 const mixed=motionHtml(plan,{real:"assets/media-0.png"}).match(/<section\b[\s\S]*?<\/section>/g)!;
 assert.doesNotMatch(mixed[3],/titles-only/);assert.match(mixed[3],/<p data-essential>An actual supported detail\.<\/p>/);
});
test("generated seek API stays in the intended source frame after browser microsecond quantization",async()=>{
 const plan=fixture();plan.assets[0].kind="video";plan.scenes[2].source_in_seconds=1;
 const html=motionHtml(plan,{real:"assets/video.mp4"}),script=html.slice(html.lastIndexOf("<script>")+8,html.lastIndexOf("</script>"));
 let current=0;const listeners:(()=>void)[]=[];
 const video={readyState:2,muted:true,pause(){},addEventListener(type:string,callback:()=>void){if(type==="seeked")listeners.push(callback);},get currentTime(){return current;},set currentTime(value:number){current=Math.floor(value*1e6)/1e6;queueMicrotask(()=>listeners.splice(0).forEach(fn=>fn()));}};
 const timeline={set(){return this;},fromTo(){return this;},pause(){return this;},seek(){return this;}};
 const browser:{__studioReady?:Promise<unknown>;__studio?:{seekFrame(frame:number):Promise<void>}}={};
 runInNewContext(script,{window:browser,document:{fonts:{load:async()=>[{}],ready:Promise.resolve(),check:()=>true},images:[],getElementById:(id:string)=>id==="video-2"?video:null},gsap:{timeline:()=>timeline},setTimeout,clearTimeout});
 await browser.__studioReady;await browser.__studio!.seekFrame(350);
 assert.ok(current>=140/30&&current<141/30,`Expected source frame140, got ${current}`);
 await browser.__studio!.seekFrame(270);assert.ok(current>=2&&current<2+1/30);
 await browser.__studio!.seekFrame(350);assert.ok(current>=140/30&&current<141/30);
});
test("motion seams stay inside integer scene bounds and final CTA holds",()=>{
 const plan=fixture();for(const [i,scene]of plan.scenes.entries()){const samples=motionSampleFrames(scene,plan,i);assert.equal(samples.length,4);assert.equal(samples[0],scene.start_frame);assert.equal(samples[3],scene.start_frame+scene.duration_frames-1);assert.ok(samples.every(n=>Number.isInteger(n)&&n>=scene.start_frame&&n<scene.start_frame+scene.duration_frames));assert.ok(samples[2]<scene.start_frame+scene.duration_frames-transitionFrames(scene,plan,i));}
 assert.equal(transitionFrames(plan.scenes[5],plan,5),0);assert.equal(expectedReviewCalls(plan),3);assert.equal(expectedReviewCalls({...plan,scenes:plan.scenes.slice(0,5)}),3);
});
test("source speech forces a visible proof scene with no covering transition",()=>{
 const plan=fixture(),scene=plan.scenes[0];scene.preserve_audio=true;assert.equal(presentation(scene,plan).template,"proof");assert.equal(presentation(scene,plan).transition,"cut");assert.equal(transitionFrames(scene,plan,0),0);
});
test("reading samples follow the final essential reveal and default motion style is a required review",()=>{
 const plan=fixture();for(const [index,scene]of plan.scenes.entries()){const sample=motionSampleFrames(scene,plan,index)[2];assert.ok(sample>=scene.start_frame+motionTimingForPresentation(scene.presentation,!!scene.detail).entryFrames);}
 assert.equal(requiresStyleReview(plan,{}),true);assert.deepEqual(assessReferenceStyle([{referenceStyleReviewed:true,referenceStylePassed:false}]),{performed:true,passed:false});
 plan.scenes=plan.scenes.map(({presentation:_,...scene})=>scene);assert.equal(requiresStyleReview(plan,{}),false);plan.renderer="hyperframes";assert.equal(requiresStyleReview(plan,{}),true);
});
test("composition local server is an exact file allowlist and supports source-video range seeks",async t=>{
 const temporary=await realpath(tmpdir()),workspace=await mkdtemp(join(temporary,"studio-motion-"));
 t.after(async()=>{const actual=await realpath(workspace),rel=relative(temporary,actual);assert.ok(!isAbsolute(rel)&&!rel.startsWith("..")&&rel.startsWith("studio-motion-"));await rm(actual,{recursive:true,force:true});});
 await mkdir(join(workspace,"assets"));await writeFile(join(workspace,"index.html"),"public composition");await writeFile(join(workspace,"secret.txt"),"not served");await writeFile(join(workspace,"assets/video.mp4"),Buffer.from("0123456789"));
 await assert.rejects(confinedMotionAsset(workspace,"../secret.txt"));
 const server=await serveMotionProject(workspace,["index.html","assets/video.mp4"]);t.after(()=>server.close());
 assert.equal(await(await fetch(server.origin)).text(),"public composition");assert.equal((await fetch(server.origin+"/secret.txt")).status,404);assert.equal((await fetch(server.origin+"/assets/%2e%2e/secret.txt")).status,404);
 const range=await fetch(server.origin+"/assets/video.mp4",{headers:{Range:"bytes=2-5"}});assert.equal(range.status,206);assert.equal(await range.text(),"2345");assert.equal((await fetch(server.origin+"/assets/video.mp4",{headers:{Range:"bytes=30-"}})).status,416);
});
