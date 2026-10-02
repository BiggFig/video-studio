import { join } from "node:path";
import { audioMeasurements, command, ffmpeg, probe, writeJson } from "./media";
import { PipelineError, type Hooks, type Plan, type Scene } from "./types";
import { validateTimeline } from "./planning";
import { renderMotionPicture } from "./motion-render";
import { soundDirectionReport } from "./audio-direction";

const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export function layout(plan:Plan) {
  const {width:w,height:h}=plan.output;
  if(w>h) return {x:760,y:168,width:1060,height:750,textX:100,textY:270,textWidth:580,font:70,detail:28};
  if(h>w) return {x:70,y:720,width:940,height:1090,textX:76,textY:226,textWidth:900,font:88,detail:34};
  return {x:64,y:460,width:952,height:554,textX:70,textY:130,textWidth:940,font:66,detail:27};
}
export function sceneHtml(plan:Plan,scene:Scene,index:number):string {
  const l=layout(plan),dark=plan.background==="dark",bg=dark?"#111216":"#f8f8fa",fg=dark?"#f7f7f8":"#171719",muted=dark?"#aeb1bb":"#62646c";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;width:${plan.output.width}px;height:${plan.output.height}px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;background:${bg};color:${fg}}.brand{position:absolute;top:64px;left:${l.textX}px;font-size:23px;letter-spacing:.09em;font-weight:600;max-width:700px}.dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:${plan.accent};margin-right:12px}.copy{position:absolute;left:${l.textX}px;top:${l.textY}px;width:${l.textWidth}px}h1{font-size:${l.font}px;line-height:1.035;letter-spacing:-.045em;margin:0;font-weight:700;overflow-wrap:break-word}p{font-size:${l.detail}px;line-height:1.4;letter-spacing:-.015em;color:${muted};margin:28px 0 0;max-width:100%}.card{position:absolute;left:${l.x-14}px;top:${l.y-14}px;width:${l.width+28}px;height:${l.height+28}px;border-radius:30px;background:${dark?"#202229":"#fff"};box-shadow:0 30px 70px ${dark?"#0009":"#19264318"};border:1px solid ${dark?"#ffffff12":"#0000000d"}}.number{position:absolute;bottom:52px;left:${l.textX}px;color:${muted};font-size:17px;letter-spacing:.15em}.line{height:4px;width:54px;background:${plan.accent};border-radius:3px;margin-bottom:28px}</style></head><body><div class="brand"><span class="dot"></span>${escape(plan.product)}</div><div class="copy"><div class="line"></div><h1 data-essential>${escape(scene.headline)}</h1>${scene.detail?`<p data-essential>${escape(scene.detail)}</p>`:""}</div><div class="card"></div><div class="number">${String(index+1).padStart(2,"0")} / ${String(plan.scenes.length).padStart(2,"0")}</div></body></html>`;
}
export async function render(plan:Plan,workspace:string,hooks:Hooks,pass:number):Promise<string> {
  const timelineErrors=validateTimeline(plan);if(timelineErrors.length)throw new PipelineError("invalid_render_timeline",timelineErrors.join("; "),"The retained plan requires an internal timeline repair.","needs_review");
  const picture=await renderMotionPicture(plan,workspace,pass,hooks),silent=picture.path;
  await writeJson(join(workspace,"analysis/sound-direction.json"),soundDirectionReport(plan));
  await hooks.persist(["analysis/sound-direction.json"]);
  const audioInputs:{path:string;start:number;duration:number;source:number;gain:number;role:string}[]=plan.audio.map(a=>({path:plan.assets.find(x=>x.id===a.asset_id)!.path,start:a.start_frame/30,duration:a.duration_frames/30,source:a.source_in_seconds,gain:a.gain_db,role:a.role}));
  for(const scene of plan.scenes.filter(s=>s.preserve_audio)) audioInputs.push({path:plan.assets.find(a=>a.id===scene.asset_id)!.path,start:scene.start_frame/30,duration:scene.duration_frames/30,source:scene.source_in_seconds,gain:0,role:"speech"});
  const mixArgs=["-v","error","-y"],filters:string[]=[];
  const speechRanges=audioInputs.filter(a=>a.role==="speech");
  const stemMeasurements:{role:string;start:number;duration:number;lufs:number}[]=[];
  // Normalize music and original speech independently before ducking. A fixed
  // volume ratio alone cannot keep music below a very quiet supplied recording.
  for(const [i,a]of audioInputs.entries())if(a.role==="music"||a.role==="speech"){
    const raw=`project/stem-${i}-raw.wav`,normalized=`project/stem-${i}.wav`;
    await command(ffmpeg,["-v","error","-y","-ss",String(a.source),"-i",join(workspace,a.path),"-t",String(a.duration),"-vn","-ac","2","-ar","48000","-c:a","pcm_s16le",join(workspace,raw)]);
    const rawLevels=(await audioMeasurements(join(workspace,raw))).loudness;
    if(!rawLevels||!Number.isFinite(Number(rawLevels.input_i)))throw new PipelineError("invalid_audio_stem","A required music or speech stem is silent.","Supply a usable recording or contact the beta administrator.","needs_review");
    const target=a.role==="speech"?-16:-20;
    // First-pass measurements must target the same loudness as the second pass.
    const measurementText=await command(ffmpeg,["-hide_banner","-i",join(workspace,raw),"-af",`loudnorm=I=${target}:TP=-3:LRA=11:print_format=json`,"-f","null","-"]);
    const match=measurementText.match(/\{\s*"input_i"[\s\S]*?\}/);if(!match)throw new Error("Stem loudness measurement unavailable");const m=JSON.parse(match[0]);
    const normalizer=`loudnorm=I=${target}:TP=-3:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,volume=${a.gain}dB`;
    await command(ffmpeg,["-v","error","-y","-i",join(workspace,raw),"-af",normalizer,"-ar","48000","-c:a","pcm_s16le",join(workspace,normalized)]);
    const measured=await audioMeasurements(join(workspace,normalized));const lufs=Number(measured.loudness?.input_i);if(!Number.isFinite(lufs))throw new Error("Normalized stem is silent");
    stemMeasurements.push({role:a.role,start:a.start,duration:a.duration,lufs});a.path=normalized;a.source=0;a.gain=0;
  }
  const musicStem=stemMeasurements.find(s=>s.role==="music");
  const speechBalance=stemMeasurements.filter(s=>s.role==="speech").map(s=>({start:s.start,speechLufs:s.lufs,musicLufsBeforeDuck:musicStem?.lufs,duckDb:20*Math.log10(0.18),marginDb:s.lufs-((musicStem?.lufs??Infinity)+20*Math.log10(0.18))}));
  if(speechBalance.some(s=>s.marginDb<12))throw new PipelineError("speech_balance","Music could overpower the supplied speech after normalization.","The retained audio mix requires internal review.","needs_review");
  await writeJson(join(workspace,"analysis/audio-stems.json"),{stems:stemMeasurements,speechBalance,minimumSpeechMarginDb:12,method:"Independent measured two-pass stem normalization followed by music ducking; integrated LUFS comparison."});
  for(const [i,a] of audioInputs.entries()) {
    mixArgs.push("-i",join(workspace,a.path));
    const duck=a.role==="music"&&speechRanges.length?`,volume='${speechRanges.map(s=>`if(between(t,${s.start},${s.start+s.duration}),0.18,`).join("")}1${")".repeat(speechRanges.length)}':eval=frame`:"";
    const fade=a.role==="music"?`,afade=t=in:st=0:d=0.6,afade=t=out:st=${Math.max(0,a.duration-1.2)}:d=1.2`:a.role==="sfx"?(plan.creativeDirection?`,afade=t=in:st=0:d=0.025,afade=t=out:st=${Math.max(0,a.duration-.2)}:d=${Math.min(.2,a.duration)}`:",afade=t=out:st=0.8:d=0.4"):"";
    filters.push(`[${i}:a]atrim=start=${a.source}:duration=${a.duration},asetpts=PTS-STARTPTS,aresample=48000,volume=${a.gain}dB${duck}${fade},adelay=${Math.round(a.start*1000)}|${Math.round(a.start*1000)}[a${i}]`);
  }
  filters.push(audioInputs.map((_,i)=>`[a${i}]`).join("")+`amix=inputs=${audioInputs.length}:normalize=0:duration=longest,apad,atrim=duration=${plan.output.duration_frames/30}[mix]`);
  const premix="project/premix.wav"; mixArgs.push("-filter_complex",filters.join(";"),"-map","[mix]","-c:a","pcm_s16le",join(workspace,premix)); await command(ffmpeg,mixArgs);
  const measured=await audioMeasurements(join(workspace,premix));await writeJson(join(workspace,"analysis/premix-audio.json"),measured);
  const m=measured.loudness;
  if(!m||!Number.isFinite(Number(m.input_i))) throw new PipelineError("silent_audio","The composed audio track is silent or invalid.","Ask the beta administrator to review audio generation.","needs_review");
  const normalize=`loudnorm=I=-14:TP=-1:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  const out=`renders/draft-${pass}.mp4`;await command(ffmpeg,["-v","error","-y","-i",join(workspace,silent),"-i",join(workspace,premix),"-map","0:v:0","-map","1:a:0","-c:v","copy","-af",normalize,"-c:a","aac","-b:a","192k","-ar","48000","-t",String(plan.output.duration_frames/30),"-movflags","+faststart",join(workspace,out)]);
  const result=await probe(join(workspace,out));if(!result.audio||!result.video)throw new Error("Renderer did not produce audio and video streams");
  await writeJson(join(workspace,"project/composition.json"),{version:2,renderer:"video-studio-html-motion",plan:"../plan.json",motionProject:picture.directory,audioInputs,filters,output:out});
  await hooks.persist([out,"analysis/layout.json","analysis/premix-audio.json","analysis/audio-stems.json","project/composition.json",...picture.artifacts,...audioInputs.filter(a=>a.path.startsWith("project/")).map(a=>a.path)]);
  return out;
}
