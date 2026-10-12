import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,mkdir,writeFile,rm,realpath } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join,relative,isAbsolute } from "node:path";
import { chromium } from "playwright";
import { prepareMotionProject,serveMotionProject } from "./motion-render";
import { motionBrowserArgs,motionBrowserPath } from "./motion-browser";
import { command,ffmpeg,mediaEnvironment } from "./media";
import type { Plan,Scene } from "./types";
import type { UiDocument } from "./ui-reconstruction";

test("directed copy, UI and materials survive arbitrary browser seeks without invisible holds or duplicate objects",async t=>{
 const executablePath=motionBrowserPath();if(!existsSync(executablePath)){t.skip("Install the pinned Playwright Chromium to run visual clock regression");return;}
 const temporary=await realpath(tmpdir()),workspace=await mkdtemp(join(temporary,"studio-director-browser-"));
 t.after(async()=>{const actual=await realpath(workspace),rel=relative(temporary,actual);assert.ok(!isAbsolute(rel)&&!rel.startsWith("..")&&rel.startsWith("studio-director-browser-"));await rm(actual,{recursive:true,force:true});});
 await mkdir(join(workspace,"assets"));await writeFile(join(workspace,"assets/source.png"),Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2nQAAAAASUVORK5CYII=","base64"));
 const document:UiDocument={id:"same-document",sourceAssetIds:["source"],capabilityFactIds:["fact-1"],viewport:{width:1000,height:600},styles:[{id:"body",fill:"#ffffff",color:"#151515",borderColor:"#dddddd",fontSize:30,fontWeight:500,radius:8}],elements:[
  {id:"input",type:"input",rect:{x:.12,y:.25,width:.55,height:.16},sourceRect:{x:.12,y:.25,width:.55,height:.16},styleId:"body",text:"The same example",textBasis:"example-content",sourceAssetId:"source",initiallyVisible:true},
  {id:"commit",type:"button",rect:{x:.68,y:.58,width:.20,height:.15},sourceRect:{x:.68,y:.58,width:.20,height:.15},styleId:"body",text:"Continue",textBasis:"source-ui",sourceAssetId:"source",initiallyVisible:true},
 ],states:[{id:"initial",basis:"illustrative",evidenceIds:["fact-1"],visibleElementIds:["input","commit"],selectedElementIds:[],textValues:[]}]};
 const scene:Scene={id:"first",start_frame:0,duration_frames:120,asset_id:"source",source_in_seconds:0,playback_rate:1,preserve_audio:false,fit:"contain",purpose:"Browser clock fixture",reference_technique:"",headline:"Follow the same object",detail:"",evidence:"Fixture",effects:[],direction:{version:2,job:"action",motion:"focus",continuityKey:"ui:same-document"},presentation:{template:"proof",theme:"light",transition:"cut",visual:{kind:"ui-demo",documentId:document.id,actions:[{kind:"click",atFrame:36,durationFrames:12,targetId:"commit",evidenceId:"fact-1"}]}},shotDirection:{version:1,subjectIds:["input","commit"],copyRole:"quiet",camera:{shots:[{atFrame:0,moveFrames:0,job:"establish",targetIds:[]},{atFrame:24,moveFrames:12,job:"commit",targetIds:["commit"]},{atFrame:48,moveFrames:12,job:"result",targetIds:["input","commit"]}]},actionWindow:{startFrame:36,endFrame:48},resultHold:{startFrame:60,endFrame:120},layers:{copy:{startFrame:0,endFrame:120,enterFrames:9},cursor:{startFrame:36,endFrame:48,enterFrames:0},product:{startFrame:0,endFrame:120,enterFrames:12},material:{startFrame:0,endFrame:120,enterFrames:18}},exit:{kind:"object-match",documentId:document.id,subjectIds:["input","commit"],nextSceneId:"second",stateSha256:"fixture"}}};
 const plan:Plan={version:1,job_id:"browser-fixture",mode:"create",renderer:"hyperframes",output:{width:1080,height:1350,fps:30,duration_frames:240},product:"Fixture",summary:"",accent:"#151515",background:"light",creativeDirection:{version:1,concept:"focus"} as Plan["creativeDirection"],shotDirector:{version:1,visualSystem:{family:"workbench",material:"paper",corners:"rounded"}} as Plan["shotDirector"],assets:[{id:"source",path:"assets/source.png",kind:"image",usage:"output",rights:"Synthetic test fixture",width:1,height:1}],uiDocuments:[document],scenes:[scene,{...structuredClone(scene),id:"second",start_frame:120,headline:"A stable readable result",shotDirection:{...structuredClone(scene.shotDirection!),exit:{kind:"cut"}}}],captions:[],audio:[],music_prompt:"",sfx_prompt:"",assumptions:[]};
 const project=await prepareMotionProject(plan,workspace,0),server=await serveMotionProject(project.root,project.paths.map(path=>path.slice(project.directory.length+1)));t.after(()=>server.close());
 const browser=await chromium.launch({headless:true,executablePath,args:motionBrowserArgs,env:mediaEnvironment()});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1080,height:1350}});await page.goto(server.origin);await page.evaluate(()=>(window as any).__studioReady);
 const seek=(frame:number)=>page.evaluate(n=>(window as any).__studio.seekFrame(n),frame);
 const snapshot=(frame:number)=>page.evaluate(frame=>{
  const active=window.document.getElementById(`scene-${Math.floor(frame/120)}`)!;
  return {comparison:{
   html:active.outerHTML,
   elements:[active,...active.querySelectorAll('*')].map(element=>({
    id:element.id,rect:element.getBoundingClientRect().toJSON(),
    computed:['transform','opacity','visibility','clip-path','left','top','width','height','color','background-color','font-size'].map(key=>[key,getComputedStyle(element).getPropertyValue(key)])
   })),
   // A never-visited hidden scene has no GSAP inline styles yet. Compare its
   // visibility and exact UI state while retaining its full HTML for diagnosis.
   sceneVisibility:Array.from(window.document.querySelectorAll('.scene'),element=>{const style=getComputedStyle(element);return{id:element.id,visible:style.visibility==='visible'&&Number(style.opacity)>0};}),
   uiState:Array.from(window.document.querySelectorAll('.ui-document'),element=>element.outerHTML)
  },allSceneHtml:Array.from(window.document.querySelectorAll('.scene'),element=>element.outerHTML)};
 },frame);
 const samples=[18,30,42,60,90,119,120,126,138,162,180,210,239];
 for(const frame of samples){
  await seek(frame);const first=await page.screenshot(),firstSnapshot=await snapshot(frame),firstState=JSON.stringify(firstSnapshot.comparison);await seek(frame<120?239:0);await seek(frame);const second=await page.screenshot(),secondSnapshot=await snapshot(frame),secondState=JSON.stringify(secondSnapshot.comparison);
  const identical=first.equals(second),domIdentical=firstState===secondState;let ssim=1;
  if(!identical||!domIdentical){
   const retained=join(process.cwd(),'.local','director-browser-replay');await mkdir(retained,{recursive:true});const evidence=await mkdtemp(join(retained,`frame-${frame}-`));
   const firstPath=join(evidence,'before.png'),secondPath=join(evidence,'after.png');
   await Promise.all([writeFile(firstPath,first),writeFile(secondPath,second),writeFile(join(evidence,'before.json'),JSON.stringify(firstSnapshot)),writeFile(join(evidence,'after.json'),JSON.stringify(secondSnapshot))]);
   const log=await command(ffmpeg,['-hide_banner','-i',firstPath,'-i',secondPath,'-filter_complex','[0:v]format=yuv420p[actual];[1:v]format=yuv420p[expected];[actual][expected]ssim','-frames:v','1','-f','null','-']);
   ssim=Number(/All:([0-9.]+)/.exec(log)?.[1]);await writeFile(join(evidence,'comparison.json'),JSON.stringify({frame,identical,domIdentical,ssim,threshold:.97,passed:domIdentical&&Number.isFinite(ssim)&&ssim>=.97},null,2));t.diagnostic(`Replay evidence: ${evidence}; exact DOM ${domIdentical}; SSIM ${ssim}`);
  }
  // Keep the production export threshold: Chromium can round a composited
  // background channel by one unit despite identical DOM and camera state.
  assert.ok(domIdentical,`frame ${frame} changes DOM, state or geometry after reverse seek`);
  assert.ok(Number.isFinite(ssim)&&ssim>=.97,`frame ${frame} changes visible pixels after reverse seek (SSIM ${ssim})`);
  const current=Math.floor(frame/120),visibility=await page.locator(`#scene-${current} .heading`).evaluate(element=>{let opacity=1;for(let node:Element|null=element;node;node=node.parentElement)opacity*=Number(getComputedStyle(node).opacity);return{opacity,visibility:getComputedStyle(element).visibility};});
  assert.ok(visibility.opacity>.99&&visibility.visibility==="visible",`copy disappeared at frame ${frame}`);
  const visibleStages=await page.locator(".ui-demo-stage").evaluateAll(elements=>elements.filter(element=>{let opacity=1;for(let node:Element|null=element;node;node=node.parentElement)opacity*=Number(getComputedStyle(node).opacity);return opacity>.99;}).length);
  assert.equal(visibleStages,1,`shared document duplicated at frame ${frame}`);
 }
 await seek(42);const pointer=await page.locator("#ui-document-0 .ui-pointer").boundingBox(),ring=await page.locator("#ui-document-0 .ui-pointer i").boundingBox();assert.ok(pointer&&pointer.width<=44.81&&pointer.height<=57.61&&ring&&ring.width<=50&&ring.height<=50,"camera magnifies the cursor over its label");
 await seek(119);const before=await page.locator('#ui-document-0 [data-ui-element="input"]').boundingBox();await seek(120);const after=await page.locator('#ui-document-1 [data-ui-element="input"]').boundingBox();assert.ok(before&&after);for(const key of ["x","y","width","height"] as const)assert.ok(Math.abs(before[key]-after[key])<.01,`shared object jumps at ${key}`);
});
