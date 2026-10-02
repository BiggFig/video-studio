/** Explicitly synthetic renderer verification: no model, audio provider or delivery. */
import assert from "node:assert/strict";
import { mkdir,readFile,readdir } from "node:fs/promises";
import { resolve,join } from "node:path";
import { chromium } from "playwright";
import { command,ffmpeg,frameIndex,probe,writeJson } from "./media";
import { render } from "./render";
import { dimensions } from "./planning";
import { motionSampleFrames } from "./motion-composition";
import { motionAssetIds } from "./motion-assets";
import { serveMotionProject } from "./motion-render";
import { motionBrowserArgs,motionBrowserPath } from "./motion-browser";
import type { Hooks,Plan,Presentation } from "./types";

async function main(){
 const arg=(key:string,fallback:string)=>process.argv.includes(key)?process.argv[process.argv.indexOf(key)+1]:fallback;
 const workspace=resolve(arg("--out",".local/primitive-smoke")),format=arg("--format","16:9")as"16:9"|"9:16"|"1:1";
 for(const directory of ["assets","analysis","project","renders"])await mkdir(join(workspace,directory),{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:motionBrowserPath(),args:motionBrowserArgs});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  await page.setContent('<body style="margin:0;background:#15131c;color:#fff;font-family:Arial;padding:60px"><p style="font-size:24px;color:#b6a6ff">SYNTHETIC SOURCE / RENDERER TEST</p><h1 style="font-size:58px">Original test artwork</h1><div style="display:flex;gap:40px"><div style="width:740px;height:650px;background:#252230;border-radius:20px;padding:40px"><h2 style="font-size:42px">Complete source</h2><p style="font-size:32px">The full composition starts here.</p><div style="width:300px;height:260px;background:#7855dd;border-radius:24px"></div></div><div style="width:600px;height:650px;background:#ede9fb;color:#17121f;border-radius:20px;padding:40px"><h2 style="font-size:42px">Verified focus area</h2><p style="font-size:32px">A saved source region.</p><div style="width:400px;height:280px;background:linear-gradient(135deg,#7855dd,#b8a6fc);border-radius:24px"></div></div></div></body>');await page.screenshot({path:join(workspace,"assets/source.png")});
  await page.setContent('<body style="margin:0;background:#efeafb;color:#181022;font-family:Arial;padding:70px"><p style="font-size:24px">SECOND SYNTHETIC SOURCE</p><h1 style="font-size:64px">A separate original image</h1><div style="display:flex;gap:40px;margin-top:70px"><div style="width:420px;height:450px;border-radius:200px;background:#7855dd"></div><div style="width:850px;height:450px;border-radius:24px;background:#231734;color:white;padding:50px;font-size:40px">SOURCE TWO<br><br>No invented product interaction.</div></div></body>');await page.screenshot({path:join(workspace,"assets/secondary.png")});
  await page.setViewportSize({width:200,height:200});await page.setContent('<body style="margin:0;background:transparent;display:grid;place-items:center;height:200px"><div style="width:150px;height:150px;background:#7855dd;border-radius:36px;display:grid;place-items:center;color:white;font:700 100px Arial">F</div></body>');await page.screenshot({path:join(workspace,"assets/logo.png"),omitBackground:true});
 }finally{await browser.close();}
 await command(ffmpeg,["-v","error","-y","-f","lavfi","-i","testsrc2=s=800x450:r=30:d=6","-c:v","libx264","-crf","16","-pix_fmt","yuv420p",join(workspace,"assets/moving.mp4")]);
 await command(ffmpeg,["-v","error","-y","-f","lavfi","-i","sine=frequency=220:duration=24","-af","volume=0.15","-c:a","libmp3lame",join(workspace,"assets/music.mp3")]);
 await command(ffmpeg,["-v","error","-y","-f","lavfi","-i","sine=frequency=880:duration=1.2","-af","afade=t=out:st=0.3:d=0.9,volume=0.1","-c:a","libmp3lame",join(workspace,"assets/sfx.mp3")]);
 const presentations:Presentation[]=[{template:"brand",theme:"dark",transition:"lift"},{template:"proof",theme:"dark",transition:"cut",visual:{kind:"showcase"}},{template:"proof",theme:"light",transition:"cut",visual:{kind:"focus",regionId:"synthetic-region",region:{x:.55,y:.23,width:.4,height:.65}}},{template:"proof",theme:"dark",transition:"cut",visual:{kind:"panels",secondaryAssetId:"secondary",secondaryEvidenceId:"synthetic-secondary",secondaryEvidence:"Original synthetic image two"}},{template:"features",theme:"dark",transition:"iris",visual:{kind:"connections",nodes:[{label:"Source",evidenceId:"synthetic-source"},{label:"Evidence",evidenceId:"synthetic-evidence"},{label:"Story",evidenceId:"synthetic-story"}]}},{template:"cta",theme:"dark",transition:"cut"}];
 const headings=["Real source. Purposeful motion.","An actual moving source.","Focus on the evidence.","Two real source panels.","Explain the connection.","A synthetic renderer fixture."];
 const plan:Plan={version:1,job_id:"synthetic-primitives",mode:"create",renderer:"hyperframes",output:{...dimensions(format),fps:30,duration_frames:720},product:"Fixture",summary:"Explicitly synthetic primitive verification",accent:"#7855dd",background:"dark",brand:{logoAssetId:"logo",background:"#15131c",foreground:"#f3f0fa",accent:"#7855dd",sourceUrl:"https://example.invalid/synthetic"},assets:[{id:"source",path:"assets/source.png",preview:"assets/source.png",kind:"image",usage:"output",rights:"Original synthetic fixture",width:1600,height:1000},{id:"secondary",path:"assets/secondary.png",preview:"assets/secondary.png",kind:"image",usage:"output",rights:"Original synthetic fixture",width:1600,height:1000},{id:"logo",path:"assets/logo.png",preview:"assets/logo.png",kind:"image",usage:"output",rights:"Original synthetic fixture mark",width:200,height:200},{id:"moving",path:"assets/moving.mp4",preview:"assets/source.png",kind:"video",usage:"output",rights:"FFmpeg synthetic test pattern",width:800,height:450,duration_seconds:6,has_audio:false},{id:"music",path:"assets/music.mp3",kind:"audio",usage:"output",rights:"Synthetic test tone",width:0,height:0,duration_seconds:24,has_audio:true},{id:"sfx",path:"assets/sfx.mp3",kind:"audio",usage:"output",rights:"Synthetic test tone",width:0,height:0,duration_seconds:1.2,has_audio:true}],scenes:presentations.map((presentation,index)=>({id:`scene-${index+1}`,start_frame:index*120,duration_frames:120,asset_id:index===1?"moving":"source",source_in_seconds:index===1?1:0,playback_rate:1,preserve_audio:false,fit:"contain",purpose:"Synthetic fixture, not customer evidence",reference_technique:"Trusted bounded primitive",headline:headings[index],detail:"",evidence:"Synthetic fixture only",effects:[],presentation})),captions:[],audio:[{asset_id:"music",start_frame:0,duration_frames:720,source_in_seconds:0,playback_rate:1,gain_db:-6,role:"music"},{asset_id:"sfx",start_frame:120,duration_frames:36,source_in_seconds:0,playback_rate:1,gain_db:-12,role:"sfx"}],music_prompt:"Synthetic test tone",sfx_prompt:"Synthetic test tone",assumptions:[]};
 const hooks:Hooks={persist:async()=>{},state:async()=>{},complete:async()=>{throw new Error("Synthetic fixtures cannot deliver");}};
 await writeJson(join(workspace,"plan.json"),plan);const started=Date.now(),video=await render(plan,workspace,hooks,0),actual=await probe(join(workspace,video));
 await command(ffmpeg,["-v","error","-xerror","-i",join(workspace,video),"-f","null","-"],180000);assert.equal(Number(actual.video.nb_frames),720);assert.equal(actual.video.codec_name,"h264");assert.equal(actual.audio.codec_name,"aac");
 for(const [index,scene]of plan.scenes.entries())for(const [sample,frame]of motionSampleFrames(scene,plan,index).entries())await frameIndex(join(workspace,video),join(workspace,`analysis/scene-${index+1}-${sample}.jpg`),frame,960);
 await command(ffmpeg,["-v","error","-y","-i",join(workspace,video),"-vf","fps=2,scale=480:-2,tile=6x8","-frames:v","1",join(workspace,"analysis/contact-sheet.jpg")]);
 const directory=join(workspace,"project/motion-0"),server=await serveMotionProject(directory,["index.html",...(await readdir(join(directory,"assets"))).map(name=>`assets/${name}`)]),checkBrowser=await chromium.launch({headless:true,executablePath:motionBrowserPath(),args:motionBrowserArgs});
 const comparisons=[];
 try{
  const page=await checkBrowser.newPage({viewport:{width:plan.output.width,height:plan.output.height}});await page.goto(server.origin);await page.evaluate(()=>(window as unknown as {__studioReady:Promise<unknown>}).__studioReady);
  for(const frame of [150,190,230,250,265,285,390,410,430,490,505,525]){
   await page.evaluate(async n=>{await(window as unknown as {__studio:{seekFrame(n:number):Promise<void>}}).__studio.seekFrame(n);},frame);
   const expected=join(workspace,`analysis/expected-${frame}.png`),decoded=join(workspace,`analysis/decoded-${frame}.png`);await page.screenshot({path:expected});await frameIndex(join(workspace,video),decoded,frame,plan.output.width);
   const log=await command(ffmpeg,["-hide_banner","-i",decoded,"-i",expected,"-filter_complex","[0:v]format=yuv420p[actual];[1:v]format=yuv420p[expected];[actual][expected]ssim","-frames:v","1","-f","null","-"]),score=Number(/All:([0-9.]+)/.exec(log)?.[1]);assert.ok(score>=.97,`Motion clock mismatch at${frame}: ${score}`);comparisons.push({frame,ssim:score});
  }
 }finally{await checkBrowser.close();await server.close();}
 const motion=JSON.parse(await readFile(join(workspace,"analysis/motion.json"),"utf8"));assert.deepEqual(Object.keys(motion.sourceHashes).sort(),motionAssetIds(plan).sort());
 const result={syntheticFixture:true,providerCalls:0,qualityCertification:false,format,video,frames:720,width:actual.width,height:actual.height,duration:actual.duration,fullDecode:true,holdComparisons:motion.comparisons,movingFocusPanelsAndConnectionsComparisons:comparisons,elapsedSeconds:(Date.now()-started)/1000};await writeJson(join(workspace,"smoke-result.json"),result);console.log(JSON.stringify(result));
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
