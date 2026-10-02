/** Explicitly synthetic local renderer verification. No provider calls or delivery. */
import { mkdir,readdir } from "node:fs/promises";
import { resolve,join } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { command,ffmpeg,frameIndex,probe,writeJson } from "./media";
import { render } from "./render";
import { dimensions } from "./planning";
import { motionSampleFrames } from "./motion-composition";
import type { Hooks,Plan } from "./types";
import { serveMotionProject } from "./motion-render";
import { motionBrowserArgs,motionBrowserPath } from "./motion-browser";

async function main(){
 const arg=(name:string,fallback:string)=>process.argv.includes(name)?process.argv[process.argv.indexOf(name)+1]:fallback;
 const workspace=resolve(arg("--out",".local/motion-smoke")),format=arg("--format","16:9") as "16:9"|"9:16"|"1:1";
 for(const dir of ["assets","analysis","project","renders"])await mkdir(join(workspace,dir),{recursive:true});
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1600,height:900}});await page.setContent('<html><body style="margin:0;background:#f4f5f8;font-family:Arial;color:#151619;padding:70px"><p style="font-size:23px;letter-spacing:4px">SYNTHETIC RENDERER FIXTURE</p><h1 style="font-size:62px;letter-spacing:-3px">Your project, in focus.</h1><p style="font-size:26px">Original test artwork. Not a real product screenshot.</p><div style="display:flex;gap:24px;margin-top:60px"><div style="background:white;border-radius:20px;padding:36px;flex:1;height:300px"><h2 style="font-size:34px">Source evidence</h2><p style="font-size:25px">This entire image must remain visible.</p><p style="font-size:22px">LEFT EDGE · TOP EDGE</p></div><div style="background:#111214;color:white;border-radius:20px;padding:36px;flex:1"><h2 style="font-size:34px">Actual motion</h2><p style="font-size:25px">Frame-seekable HTML.</p><p style="font-size:22px">RIGHT EDGE · BOTTOM EDGE</p></div></div></body></html>');await page.screenshot({path:join(workspace,"assets/source.png")});
 }finally{await browser.close();}
 await command(ffmpeg,["-v","error","-y","-f","lavfi","-i","sine=frequency=220:duration=24","-af","volume=0.15","-c:a","libmp3lame",join(workspace,"assets/music.mp3")]);
 await command(ffmpeg,["-v","error","-y","-f","lavfi","-i","sine=frequency=880:duration=1.2","-af","afade=t=out:st=0.3:d=0.9,volume=0.1","-c:a","libmp3lame",join(workspace,"assets/sfx.mp3")]);
 const roles=["hook","brand","proof","features","offer","cta"]as const,heads=["A story worth showing.","Clear ideas. Real evidence.","Keep the whole picture.","Made from source facts.","Three useful building blocks.","Make the next frame count."],details=["A synthetic motion test.","An original local renderer fixture.","The source image stays fully contained.","Informational cards, revealed in sequence.","No invented price or product interaction.","This is a test film, not customer delivery."],cards=[{title:"Grounded copy",body:"Visible words come from the test plan.",evidenceId:"fixture-copy",evidence:"Synthetic plan"},{title:"Local visuals",body:"Every visual asset stays inside this project.",evidenceId:"fixture-assets",evidence:"Synthetic plan"},{title:"Exact timing",body:"Thirty frames define every second.",evidenceId:"fixture-clock",evidence:"Synthetic plan"}];
 const plan:Plan={version:1,job_id:"motion-renderer-fixture",mode:"create",renderer:"ffmpeg",output:{...dimensions(format),fps:30,duration_frames:720},product:"Frame Studio",summary:"Synthetic renderer verification",accent:"#5577ff",background:"light",assets:[{id:"source",path:"assets/source.png",kind:"image",usage:"output",rights:"Original synthetic fixture",width:1600,height:900},{id:"music",path:"assets/music.mp3",kind:"audio",usage:"output",rights:"Synthetic test tone",width:0,height:0,duration_seconds:24,has_audio:true},{id:"sfx",path:"assets/sfx.mp3",kind:"audio",usage:"output",rights:"Synthetic test tone",width:0,height:0,duration_seconds:1.2,has_audio:true}],scenes:roles.map((template,index)=>({id:`scene-${index+1}`,start_frame:index*120,duration_frames:120,asset_id:"source",source_in_seconds:0,playback_rate:1,preserve_audio:false,fit:"contain",purpose:"Synthetic fixture",reference_technique:"Six beat minimal type and real media sequence",headline:heads[index],detail:details[index],evidence:"Synthetic fixture only",effects:[],presentation:{template,theme:template==="brand"||template==="cta"?"dark":"light",transition:index===0?"iris":index===1?"lift":index===4?"expand":"cut",cards:index===3||index===4?cards:undefined}})),captions:[],audio:[{asset_id:"music",start_frame:0,duration_frames:720,source_in_seconds:0,playback_rate:1,gain_db:-6,role:"music"},{asset_id:"sfx",start_frame:120,duration_frames:36,source_in_seconds:0,playback_rate:1,gain_db:-12,role:"sfx"}],music_prompt:"Synthetic test tone",sfx_prompt:"Synthetic test tone",assumptions:[]};
 const moving=process.argv.includes("--source-video");
 if(moving){
  await command(ffmpeg,["-v","error","-y","-f","lavfi","-i","testsrc2=s=800x450:r=30:d=6","-c:v","libx264","-crf","16","-pix_fmt","yuv420p",join(workspace,"assets/moving.mp4")]);
  plan.assets.push({id:"moving",path:"assets/moving.mp4",preview:"assets/source.png",kind:"video",usage:"output",rights:"FFmpeg synthetic moving test pattern",width:800,height:450,duration_seconds:6,has_audio:false});plan.scenes[2].asset_id="moving";plan.scenes[2].source_in_seconds=1;
 }
 const persisted:string[]=[];const hooks:Hooks={persist:async paths=>{persisted.push(...paths);},state:async()=>{},complete:async()=>{throw new Error("Smoke fixtures cannot be delivered");}};
 await writeJson(join(workspace,"plan.json"),plan);const started=Date.now(),video=await render(plan,workspace,hooks,0),actual=await probe(join(workspace,video));
 await command(ffmpeg,["-v","error","-xerror","-i",join(workspace,video),"-f","null","-"],180_000);
 assert.equal(actual.width,plan.output.width);assert.equal(actual.height,plan.output.height);assert.equal(actual.video.nb_frames,String(plan.output.duration_frames));assert.equal(actual.video.codec_name,"h264");assert.equal(actual.audio.codec_name,"aac");
 for(const [index,scene]of plan.scenes.entries())for(const [sample,frame]of motionSampleFrames(scene,plan,index).entries())await frameIndex(join(workspace,video),join(workspace,`analysis/rendered-${index}-${sample}.jpg`),frame,960);
 await command(ffmpeg,["-v","error","-y","-i",join(workspace,video),"-vf","fps=2,scale=480:-2,tile=6x8","-frames:v","1",join(workspace,"analysis/contact-sheet.jpg")]);
 const movingEvidence=[];
 if(moving){
  const directory=join(workspace,"project/motion-0"),server=await serveMotionProject(directory,["index.html",...(await readdir(join(directory,"assets"))).map(name=>`assets/${name}`)]),browser=await chromium.launch({headless:true,executablePath:motionBrowserPath(),args:motionBrowserArgs});
  try{const page=await browser.newPage({viewport:{width:plan.output.width,height:plan.output.height}});await page.goto(server.origin);await page.evaluate(()=>(window as unknown as {__studioReady:Promise<unknown>}).__studioReady);
   for(const localFrame of [30,70,110]){const frame=plan.scenes[2].start_frame+localFrame,expected=`analysis/video-expected-${localFrame}.png`,decoded=`analysis/video-decoded-${localFrame}.png`;
    const actualTime=await page.evaluate(async frame=>{await (window as unknown as {__studio:{seekFrame(n:number):Promise<void>}}).__studio.seekFrame(frame);return(document.querySelector('#video-2')as HTMLVideoElement).currentTime;},frame);assert.ok(Math.abs(actualTime-(1+localFrame/30))<.001);
    await page.screenshot({path:join(workspace,expected)});await frameIndex(join(workspace,video),join(workspace,decoded),frame,plan.output.width);
    const log=await command(ffmpeg,["-hide_banner","-i",join(workspace,decoded),"-i",join(workspace,expected),"-filter_complex","[0:v]format=yuv420p[actual];[1:v]format=yuv420p[expected];[actual][expected]ssim","-frames:v","1","-f","null","-"]),ssim=Number(/All:([0-9.]+)/.exec(log)?.[1]);assert.ok(ssim>=.97,`Video source offset mismatch at ${frame}: ${ssim}`);movingEvidence.push({frame,sourceSeconds:actualTime,ssim,passed:true});
   }
  }finally{await browser.close();await server.close();}
 }
 const report={syntheticFixture:true,providerCalls:0,qualityCertification:false,format,video,width:actual.width,height:actual.height,frames:Number(actual.video.nb_frames),duration:actual.duration,decoded:true,movingEvidence,elapsedSeconds:(Date.now()-started)/1000,persisted};await writeJson(join(workspace,"smoke-result.json"),report);console.log(JSON.stringify({...report,persistedCount:persisted.length,persisted:undefined}));
}
void main();
