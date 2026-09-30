import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

export const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
export const ffprobe = process.env.FFPROBE_PATH || "ffprobe";
export function mediaEnvironment():Record<string,string>&{NODE_ENV:"development"|"production"|"test"}{return {...Object.fromEntries(Object.entries(process.env).filter((entry):entry is [string,string]=>typeof entry[1]==="string"&&!/KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL/i.test(entry[0]))),NODE_ENV:process.env.NODE_ENV||"production"};}
const activeChildren=new Set<ReturnType<typeof spawn>>();
export function cancelCommands(){for(const child of activeChildren)child.kill("SIGKILL");}
export async function command(binary: string, args: string[], timeout = 180_000): Promise<string> {
  return new Promise((done,reject) => {
    const child = spawn(binary,args,{shell:false,windowsHide:true,stdio:["ignore","pipe","pipe"],env:mediaEnvironment()});
    activeChildren.add(child);
    let text = "", settled = false;
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`${binary} exceeded its time limit`)); },timeout);
    const collect = (data: Buffer) => { text = (text + data.toString()).slice(-2_000_000); };
    child.stdout.on("data",collect); child.stderr.on("data",collect);
    child.on("error", error => { activeChildren.delete(child); if (!settled) { settled=true; clearTimeout(timer); reject(error); } });
    child.on("close", code => { activeChildren.delete(child); if (!settled) { settled=true; clearTimeout(timer); if(code === 0) done(text); else reject(new Error(`${binary} failed (${code}): ${text.slice(-5000)}`)); } });
  });
}
export async function writeJson(path: string, data: unknown) { await mkdir(dirname(path),{recursive:true}); await writeFile(path, JSON.stringify(data,null,2)); }
export async function json<T>(path: string): Promise<T> { return JSON.parse(await readFile(path,"utf8")) as T; }
export async function hash(path: string) { return createHash("sha256").update(await readFile(path)).digest("hex"); }
export async function probe(path: string) {
  const data = JSON.parse(await command(ffprobe,["-v","error","-show_streams","-show_format","-of","json",path]));
  const video = data.streams?.find((s: {codec_type:string}) => s.codec_type === "video");
  const audio = data.streams?.find((s: {codec_type:string}) => s.codec_type === "audio");
  return { raw:data, video, audio, width: Number(video?.width || 0), height:Number(video?.height || 0), duration:Number(data.format?.duration || video?.duration || 0) };
}
export async function frame(path: string, out: string, at: number, maxWidth=1600) {
  await mkdir(dirname(out),{recursive:true});
  await command(ffmpeg,["-v","error","-y","-ss",String(Math.max(0,at)),"-i",path,"-frames:v","1","-vf",`scale='min(${maxWidth},iw)':-2`,"-q:v","2",out]);
}
export async function audioMeasurements(path: string) {
  const raw = await command(ffmpeg,["-hide_banner","-i",path,"-vn","-af","loudnorm=I=-14:TP=-1:LRA=11:print_format=json,silencedetect=n=-45dB:d=1","-f","null","-"],180_000);
  const match = raw.match(/\{\s*"input_i"[\s\S]*?\}/);
  return { loudness:match ? JSON.parse(match[0]) : null, silence:raw.split(/\r?\n/).filter(x => x.includes("silence_start") || x.includes("silence_end")) };
}
export async function doctor(workspace: string, skillRoot: string) {
  const versions: Record<string,string> = {node:process.version,renderer:"video-studio-html-ffmpeg/1.0.0"};
  versions.ffmpeg=(await command(ffmpeg,["-version"])).split(/\r?\n/)[0];
  versions.ffprobe=(await command(ffprobe,["-version"])).split(/\r?\n/)[0];
  const output = await command(process.env.PYTHON_PATH || "python3",[join(skillRoot,"scripts","video_tool.py"),"doctor"]);
  if(JSON.parse(output).ok!==true)throw new Error("The pinned skill media doctor did not pass");
  await writeFile(join(workspace,"analysis","doctor.txt"),output);
  return versions;
}
