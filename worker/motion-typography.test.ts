import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,mkdir,writeFile,rm,realpath } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join,relative,isAbsolute } from "node:path";
import { chromium } from "playwright";
import { prepareMotionProject,serveMotionProject,inspectMotionProject } from "./motion-render";
import { motionBrowserArgs,motionBrowserPath } from "./motion-browser";
import { motionHtml } from "./motion-composition";
import { mediaEnvironment } from "./media";
import type { Plan,Scene } from "./types";

function fixture(width=1920,height=1080):Plan {
 const scene:Scene={id:"outcome",start_frame:0,duration_frames:120,asset_id:"source",source_in_seconds:0,playback_rate:1,preserve_audio:false,fit:"contain",purpose:"Editorial outcome",reference_technique:"",headline:"Your next action is ready",detail:"Keep the handoff clear for your team.",evidence:"Synthetic renderer fixture",effects:[],direction:{version:2,job:"payoff",motion:"hold"},presentation:{template:"features",theme:"light",transition:"cut"},shotDirection:{version:1,subjectIds:[],copyRole:"headline",camera:{shots:[]},actionWindow:null,resultHold:null,layers:{copy:{startFrame:0,endFrame:120,enterFrames:9},cursor:{startFrame:0,endFrame:0,enterFrames:0},product:{startFrame:8,endFrame:120,enterFrames:12},material:{startFrame:0,endFrame:120,enterFrames:18}},exit:{kind:"cut"}}};
 return {version:1,job_id:"typography-fixture",mode:"create",renderer:"hyperframes",output:{width,height,fps:30,duration_frames:120},product:"Fixture",summary:"",accent:"#5190ef",background:"light",brand:{background:"#ffffff",foreground:"#070810",accent:"#5190ef",sourceUrl:"https://example.com/"},creativeDirection:{version:1,concept:"focus"} as Plan["creativeDirection"],shotDirector:{version:1,visualSystem:{family:"workbench",material:"paper",corners:"rounded"}} as Plan["shotDirector"],assets:[{id:"source",path:"assets/source.png",kind:"image",usage:"output",rights:"Synthetic test fixture",width:1,height:1}],scenes:[scene],captions:[],audio:[],music_prompt:"",sfx_prompt:"",assumptions:[]};
}

test("typography payoff is opt-in and leaves cards, connections and legacy exports in their layouts",()=>{
 const base=fixture(),render=(plan:Plan)=>motionHtml(plan,{source:"assets/source.png"});
 const section=(html:string)=>html.match(/<section[^>]+>/)![0];
 assert.match(section(render(base)),/ typography-only/);
 for(const change of [
  (plan:Plan)=>{delete plan.shotDirector;delete plan.scenes[0].shotDirection;},
  (plan:Plan)=>{plan.scenes[0].presentation!.cards=[{title:"Ready",body:"For the next step",evidenceId:"fact-1"}];},
  (plan:Plan)=>{plan.scenes[0].presentation!.visual={kind:"connections",nodes:[{label:"Source",evidenceId:"fact-1"},{label:"Destination",evidenceId:"fact-2"}]};},
  (plan:Plan)=>{plan.scenes[0].presentation!.template="proof";plan.scenes[0].presentation!.visual={kind:"showcase"};},
 ]){const plan=structuredClone(base);change(plan);assert.doesNotMatch(section(render(plan)),/ typography-only/);}
});

test("typography outcomes stay centered, source-colored and readable in all four export formats",async t=>{
 const executablePath=motionBrowserPath();if(!existsSync(executablePath)){t.skip("Install the pinned Chromium to verify production motion layout");return;}
 const temporary=await realpath(tmpdir()),workspace=await mkdtemp(join(temporary,"studio-typography-"));
 t.after(async()=>{const actual=await realpath(workspace),rel=relative(temporary,actual);assert.ok(!isAbsolute(rel)&&!rel.startsWith("..")&&rel.startsWith("studio-typography-"));await rm(actual,{recursive:true,force:true});});
 await mkdir(join(workspace,"assets"));await mkdir(join(workspace,"analysis"));await writeFile(join(workspace,"assets/source.png"),Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2nQAAAAASUVORK5CYII=","base64"));
 const browser=await chromium.launch({headless:true,executablePath,args:motionBrowserArgs,env:mediaEnvironment()});t.after(()=>browser.close());
 for(const [index,[width,height]] of [[1920,1080],[1080,1350],[1080,1920],[1080,1080]].entries()){
  const plan=fixture(width,height),project=await prepareMotionProject(plan,workspace,index),server=await serveMotionProject(project.root,project.paths.map(path=>path.slice(project.directory.length+1)));
  try{
   const page=await browser.newPage({viewport:{width,height}});await page.goto(server.origin);await page.evaluate(()=>(window as any).__studioReady);
   const seek=(frame:number)=>page.evaluate(n=>(window as any).__studio.seekFrame(n),frame);
   const inspect=()=>page.locator("#scene-0").evaluate(scene=>{
    const heading=scene.querySelector(".heading")!,title=scene.querySelector("h1")!,style=getComputedStyle(scene),titleStyle=getComputedStyle(title),bounds=heading.getBoundingClientRect();
    return {bounds:bounds.toJSON(),font:parseFloat(titleStyle.fontSize),scale:new DOMMatrix(titleStyle.transform).a,title:title.textContent,detail:scene.querySelector('.detail')!.textContent,background:style.backgroundColor,color:style.color,accent:getComputedStyle(title,'::after').backgroundColor,artifacts:scene.querySelectorAll('.cards,.connection-graphic,[data-proof],.ui-document').length,essentials:[...scene.querySelectorAll('[data-essential]')].map(element=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,overflow:element.scrollWidth>element.clientWidth+2};})};
   });
   await seek(1);const early=await inspect();await seek(45);const held=await inspect();
   assert.ok(early.scale>1.05&&held.scale===1,`${width}×${height}: impact must settle in the reading hold`);
   assert.ok(Math.abs(held.bounds.y+held.bounds.height/2-height/2)<1,"message group must occupy the vertical center");
   assert.ok(held.font>=106,"outcome must use deliberate display typography");
   assert.equal(held.title,plan.scenes[0].headline);assert.equal(held.detail,plan.scenes[0].detail);
   assert.equal(held.background,"rgb(255, 255, 255)");assert.equal(held.color,"rgb(7, 8, 16)");assert.equal(held.accent,"rgb(81, 144, 239)");assert.equal(held.artifacts,0);
   for(const r of held.essentials)assert.ok(r.x>=32&&r.y>=32&&r.right<=width-32&&r.bottom<=height-32&&!r.overflow,`${width}×${height}: readable safe bounds`);
   await seek(119);await seek(1);assert.deepEqual(await inspect(),early,"entrance must replay identically");await seek(45);assert.deepEqual(await inspect(),held,"held typography must replay identically");await page.close();
  }finally{await server.close();}
  // Run the production readability, overlap and deterministic seek gate too.
  await inspectMotionProject(plan,workspace,project);
 }
});
