/** Non-production renderer acceptance fixture. No provider calls or delivery. */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve,join } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { command,ffmpeg,probe,writeJson } from "./media";
import { dimensions } from "./planning";
import { render } from "./render";
import type { Hooks,Plan } from "./types";

async function main(){
  const outIndex=process.argv.indexOf("--out"),workspace=resolve(outIndex>=0?process.argv[outIndex+1]:".worker-smoke");
  for(const folder of ["assets","analysis","project","renders"])await mkdir(join(workspace,folder),{recursive:true});
  const browser=await chromium.launch({headless:true});
  try{const page=await browser.newPage({viewport:{width:1440,height:960}});await page.setContent('<html><body style="margin:0;background:#f5f6fa;font-family:Arial;color:#222"><div style="padding:60px"><b style="color:#556df6;font-size:28px">STUDIO TEST FIXTURE</b><h1 style="font-size:66px;letter-spacing:-3px">Everything in one place.</h1><p style="font-size:28px">A synthetic test screen, never presented as a real product.</p><div style="display:flex;gap:28px;margin-top:50px"><div style="background:white;border-radius:24px;padding:40px;width:500px"><h2>Projects</h2><p>Launch assets</p><p>Product announcement</p><p>Feature demo</p></div><div style="background:#e9eaff;border-radius:24px;padding:40px;width:500px"><h2>Ready to share</h2><p>Clear preview and organized files</p></div></div></div></body></html>');await page.screenshot({path:join(workspace,"assets/screen.jpg"),type:"jpeg",quality:95});}finally{await browser.close();}
  await command(ffmpeg,["-v","error","-y","-f","lavfi","-i","sine=frequency=220:duration=10","-af","volume=0.2","-c:a","libmp3lame",join(workspace,"assets/music.mp3")]);
  await command(ffmpeg,["-v","error","-y","-f","lavfi","-i","sine=frequency=880:duration=1.2","-af","afade=t=out:st=0.3:d=0.9,volume=0.1","-c:a","libmp3lame",join(workspace,"assets/sfx.mp3")]);
  const hooks:Hooks={persist:async()=>{},state:async()=>{},complete:async()=>{throw new Error("Smoke fixtures cannot be delivered");}};
  const plan:Plan={version:1,job_id:"renderer-smoke-fixture",mode:"create",renderer:"ffmpeg",output:{...dimensions("16:9"),fps:30,duration_frames:300},product:"Studio test fixture",summary:"Deterministic renderer fixture; not a customer output",accent:"#5969ed",background:"light",assets:[{id:"screen",path:"assets/screen.jpg",kind:"image",usage:"output",rights:"Synthetic test fixture",width:1440,height:960},{id:"music",path:"assets/music.mp3",kind:"audio",usage:"output",rights:"Synthetic sine-wave test",width:0,height:0,duration_seconds:10,has_audio:true},{id:"sfx",path:"assets/sfx.mp3",kind:"audio",usage:"output",rights:"Synthetic sine-wave test",width:0,height:0,duration_seconds:1.2,has_audio:true}],scenes:[{id:"scene-1",start_frame:0,duration_frames:150,asset_id:"screen",source_in_seconds:0,playback_rate:1,preserve_audio:false,fit:"contain",purpose:"fixture",reference_technique:"",headline:"A place for every project.",detail:"An actual renderer smoke test.",evidence:"Synthetic test fixture",effects:[]},{id:"scene-2",start_frame:150,duration_frames:150,asset_id:"screen",source_in_seconds:0,playback_rate:1,preserve_audio:false,fit:"contain",purpose:"fixture",reference_technique:"",headline:"Ready for the next step.",detail:"Ten seconds. Every frame verified.",evidence:"Synthetic test fixture",effects:[]}],captions:[],audio:[{asset_id:"music",start_frame:0,duration_frames:300,source_in_seconds:0,playback_rate:1,gain_db:-6,role:"music"},{asset_id:"sfx",start_frame:150,duration_frames:36,source_in_seconds:0,playback_rate:1,gain_db:-12,role:"sfx"}],music_prompt:"fixture",sfx_prompt:"fixture",assumptions:[]};
  const results=[];
  for(const [i,format]of(["16:9","9:16","1:1"]as const).entries()){
    Object.assign(plan.output,dimensions(format));await writeJson(join(workspace,`plan-${i}.json`),plan);const output=await render(plan,workspace,hooks,i),actual=await probe(join(workspace,output));await command(ffmpeg,["-v","error","-xerror","-i",join(workspace,output),"-f","null","-"]);assert.equal(actual.width,plan.output.width);assert.equal(actual.height,plan.output.height);assert.equal(actual.video.codec_name,"h264");assert.equal(actual.audio.codec_name,"aac");assert.ok(Math.abs(actual.duration-10)<0.15);results.push({format,output,width:actual.width,height:actual.height,duration:actual.duration,decoded:true});
  }
  await writeFile(join(workspace,"smoke-result.json"),JSON.stringify({fixture:true,results},null,2));console.log(JSON.stringify({fixture:true,results}));
}
void main();
