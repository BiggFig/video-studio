import { mkdir, readFile, writeFile, copyFile, stat, readdir } from "node:fs/promises";
import { resolve, join, extname, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { put } from "@vercel/blob/client";
import { PipelineError, type Evidence, type Hooks, type PipelineResult, type Plan, type WorkerInput } from "./types";
import { safeDownload, safePath } from "./security";
import { cancelCommands, command, doctor, frame, hash, json, probe, writeJson } from "./media";
import { Providers } from "./providers";
import { callbackAuth, ingest,type IngestDependencies } from "./ingest";
import { makePlan, savePlan, validateTimeline } from "./planning";
import { render } from "./render";
import { quality, repairableFindings } from "./quality";
import { assertCompatibleRuntime } from "./runtime";
import { RepairBudget } from "./repairs";
import { workerTimeRemainingMs } from "./deadline";

const runtimeInputSchema=z.object({runtimeHash:z.string().regex(/^[a-f0-9]{64}$/).optional(),runtimeId:z.string().min(1).max(256).optional(),deadlineAt:z.string().max(64).optional()});

const limitsSchema=z.object({maxFiles:z.number().int().min(1).max(30),maxFileBytes:z.number().positive().max(1024*1024*1024),maxTotalBytes:z.number().positive().max(2*1024*1024*1024),maxPrdBytes:z.number().positive().max(30*1024*1024),maxReferenceBytes:z.number().positive().max(250*1024*1024),maxSourceDurationSeconds:z.number().positive().max(600),maxReferenceDurationSeconds:z.number().positive().max(300),maxActiveJobs:z.number(),maxJobsPerDay:z.number(),retentionDays:z.number()});
const inputSchema=z.object({jobId:z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),ownerId:z.string().min(1).max(100),mode:z.enum(["url","prd"]),productUrl:z.string().url().optional(),videoType:z.enum(["launch","feature-demo"]),format:z.enum(["auto","16:9","9:16","1:1"]),referenceUrl:z.string().url().optional(),files:z.array(z.object({id:z.string(),name:z.string().max(200),kind:z.enum(["prd","asset","reference"]),url:z.string().url(),mimeType:z.string(),size:z.number().optional()})).max(30),resume:z.record(z.string(),z.string().url()).optional(),limits:limitsSchema.optional(),budgets:z.object({maxDurationSeconds:z.number().min(10).max(300).optional(),maxModelCalls:z.number().int().min(1).max(12).optional(),maxRepairPasses:z.number().int().min(0).max(2).optional(),maxWallSeconds:z.number().int().min(60).max(3600).optional(),maxAudioGenerations:z.number().int().min(2).max(4).optional(),maxModelInputTokens:z.number().int().max(200000).optional(),maxModelOutputTokens:z.number().int().max(50000).optional()}).optional()});

const contentType=(path:string)=>({".mp4":"video/mp4",".mp3":"audio/mpeg",".wav":"audio/wav",".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp",".json":"application/json",".html":"text/html",".md":"text/markdown",".pdf":"application/pdf",".txt":"text/plain"}[extname(path)]||"application/octet-stream");
export function remoteHooks(input:WorkerInput,workspace:string):Hooks {
  const callback=process.env.WORKER_CALLBACK_URL,token=process.env.PIPELINE_CALLBACK_TOKEN;
  if(!callback||!token)throw new Error("WORKER_CALLBACK_URL and PIPELINE_CALLBACK_TOKEN are required for durable production");
  const base=callback.replace(/\/checkpoint\/?$/,"").replace(/\/$/,"");
  const headers={Authorization:`Bearer ${token}`,"content-type":"application/json"};
  async function post(path:string,body:unknown) {
    const response=await fetch(`${base}/${path}`,{method:"POST",headers,body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
    if(!response.ok)throw new PipelineError("checkpoint_unavailable",`Durable checkpoint could not be saved (${response.status}).`,"The worker will retry from its last confirmed checkpoint.","failed",response.status>=500);
    return response.json();
  }
  return {
    async persist(paths) {
      for(const path of [...new Set(paths)]) {
        const full=safePath(workspace,path),info=await stat(full),type=contentType(path);
        const prepared=await post("artifact",{operation:"prepare",path,size:info.size,contentType:type,sha256:await hash(full)});
        // Random suffix and overwrite behavior are bound into the scoped token.
        const uploaded=await put(prepared.pathname,await readFile(full),{access:"private",token:prepared.clientToken,multipart:info.size>4_000_000,contentType:type});
        await post("artifact",{operation:"complete",path,url:uploaded.url,grant:prepared.grant});
      }
    },
    async state(status,checkpoint) {await post("checkpoint",{status,checkpoint});},
    async complete(result) {await post("checkpoint",{status:"ready",result});}
  };
}

export async function runPipeline(raw:WorkerInput,workspace:string,hooks:Hooks,dependencies:IngestDependencies={}):Promise<PipelineResult> {
  const input={...inputSchema.parse(raw),...runtimeInputSchema.parse(raw)},started=Date.now();
  const maxWall=workerTimeRemainingMs(input,started);
  if(process.env.WORKER_CALLBACK_URL&&(!input.runtimeHash||!input.runtimeId)) throw new PipelineError("runtime_unpinned","The worker did not receive a pinned production runtime.","Ask the administrator to restore the worker deployment configuration.","needs_review");
  workspace=resolve(workspace);await mkdir(workspace,{recursive:true});
  for(const folder of ["assets","analysis","project","renders"])await mkdir(join(workspace,folder),{recursive:true});
  const deadline=()=>{if(Date.now()-started>=maxWall)throw new PipelineError("time_budget","The video reached its processing time limit.","The retained draft needs an internal review.","needs_review");};
  // Restored artifacts come from authenticated app URLs only; never arbitrary
  // user-controlled filesystem paths or an untrusted source's instructions.
  if(input.resume)for(const [path,url] of Object.entries(input.resume)) {
    const full=safePath(workspace,path),auth=callbackAuth();
    if(!auth||new URL(url).origin!==auth.origin)throw new Error("Resume URL is not on the authenticated artifact origin");
    const data=await safeDownload(url,850_000_000,auth);await mkdir(dirname(full),{recursive:true});await writeFile(full,data.bytes);
  }
  const skillRoot=resolve(process.env.VIDEO_STUDIO_SKILL_PATH||join(process.cwd(),"skills/video-studio"));
  const providers=new Providers(workspace,input,hooks);await providers.init(skillRoot);
  const versions={...await doctor(workspace,skillRoot),model:providers.model,skill:providers.skillHash,pipeline:"1.0.0",runtimeHash:input.runtimeHash??"local-unpinned",runtimeId:input.runtimeId??"local"};
  try {const previous=await json<Record<string,string>>(join(workspace,"versions.json"));assertCompatibleRuntime(previous,versions);}catch(error){if(error instanceof PipelineError)throw error;if(input.resume?.["versions.json"])throw new PipelineError("runtime_changed","The saved runtime record is unreadable.","Ask the administrator to restore the original runtime record.","needs_review");}
  const repairBudget=new RepairBudget(workspace,input,hooks);await repairBudget.init();
  await writeJson(join(workspace,"versions.json"),versions);
  await writeJson(join(workspace,"job.json"),{...input,files:input.files.map(({url:_,...f})=>f),resume:undefined,startedAt:new Date(started).toISOString(),automatic:true,mode:"create",input_mode:input.mode});
  await hooks.persist(["job.json","versions.json","analysis/doctor.txt"]);
  deadline();
  await hooks.state("reading",{stage:"ingest"});
  let evidence:Evidence;
  try {evidence=await json<Evidence>(join(workspace,"analysis/evidence.json"));}catch{evidence=await ingest(input,workspace,providers,hooks,dependencies);}
  deadline();await hooks.state("planning",{stage:"plan"});
  let plan:Plan;
  try{plan=await json<Plan>(join(workspace,"plan.json"));if(validateTimeline(plan).length)throw new Error("Stored plan failed validation");}catch{if(repairBudget.consumed)throw new PipelineError("repair_plan_changed","The retained repaired plan failed timeline validation.","Ask the administrator to restore the last confirmed repaired plan; no new planning call was made.","needs_review");plan=await makePlan(input,evidence,providers,hooks,workspace);}
  if(!plan.audio.length) {
    const music=await providers.audio("music",plan.music_prompt,plan.output.duration_frames/30),sfx=await providers.audio("sfx",plan.sfx_prompt,1.2);
    const musicProbe=await probe(join(workspace,music)),sfxProbe=await probe(join(workspace,sfx));
    plan.assets.push({id:"generated-music",path:music,kind:"audio",usage:"output",rights:"Generated using the configured ElevenLabs account; instrumental-only request.",width:0,height:0,duration_seconds:musicProbe.duration,has_audio:true},{id:"generated-sfx",path:sfx,kind:"audio",usage:"output",rights:"Generated using the configured ElevenLabs account; no speech requested.",width:0,height:0,duration_seconds:sfxProbe.duration,has_audio:true});
    plan.audio=[{asset_id:"generated-music",start_frame:0,duration_frames:plan.output.duration_frames,source_in_seconds:0,playback_rate:1,gain_db:-6,role:"music"},{asset_id:"generated-sfx",start_frame:plan.scenes[1].start_frame,duration_frames:36,source_in_seconds:0,playback_rate:1,gain_db:-12,role:"sfx"}];
    await savePlan(plan,workspace,hooks);
  }
  const validation=await command(process.env.PYTHON_PATH||"python3",["-X","utf8",join(skillRoot,"scripts/video_tool.py"),"validate",join(workspace,"plan.json")]);
  await writeFile(join(workspace,"analysis/plan-validation.json"),validation); await hooks.persist(["analysis/plan-validation.json"]);
  let qc;let draft="";
  const repairMax=input.budgets?.maxRepairPasses??2;
  while(true) {
    const pass=repairBudget.consumed;
    deadline();await hooks.state("rendering",{stage:"render",repairPass:pass});
    try {draft=await render(plan,workspace,hooks,pass);}catch(error){
      if(error instanceof PipelineError&&error.code==="copy_overflow"&&pass<repairMax) {const findings=[{severity:"major" as const,message:error.message,repair:"shorten_copy" as const}];plan=await repairBudget.execute("Shorten overflowing copy before rendering",()=>makePlan(input,evidence,providers,hooks,workspace,{plan,findings}));continue;}throw error;
    }
    deadline();await hooks.state("checking",{stage:"quality",repairPass:pass,draft});
    qc=await quality(plan,evidence,draft,workspace,providers,hooks,repairBudget.descriptions);
    if(qc.passed)break;
    const repairable=repairableFindings(qc.findings);
    if(pass===repairMax||!repairable.length)throw new PipelineError("quality_failed","The video did not pass every required quality check.","The draft and specific quality findings were retained for the beta administrator.","needs_review");
    plan=await repairBudget.execute(repairable.map(f=>f.message).join("; "),()=>makePlan(input,evidence,providers,hooks,workspace,{plan,findings:repairable}));
  }
  if(!qc?.passed)throw new PipelineError("quality_incomplete","The required checks could not complete.","The retained draft needs internal review.","needs_review");
  const videoPath="renders/final.mp4",posterPath="renders/poster.jpg";await copyFile(join(workspace,draft),join(workspace,videoPath));await frame(join(workspace,videoPath),join(workspace,posterPath),Math.min(2,plan.scenes[0].duration_frames/60),plan.output.width);
  const result:PipelineResult={videoPath,posterPath,quality:qc,durationSeconds:plan.output.duration_frames/30,width:plan.output.width,height:plan.output.height,costUsd:null,versions};
  await writeJson(join(workspace,"result.json"),{job_id:input.jobId,status:"completed",...result,observedUsage:providers.ledger,assumptions:plan.assumptions,unmetRequests:[],costNote:"Provider usage and request IDs retained. Monetary totals are unknown until actual provider and compute billing are reconciled."});
  await hooks.persist([videoPath,posterPath,"result.json"]);await hooks.complete(result);return result;
}

async function main() {
  const inputArg=process.argv.indexOf("--input"),workspaceArg=process.argv.indexOf("--workspace");
  if(inputArg<0||workspaceArg<0)throw new Error("Usage: tsx worker/index.ts --input /job/input.json --workspace /job");
  const input=await json<WorkerInput>(resolve(process.argv[inputArg+1])),workspace=resolve(process.argv[workspaceArg+1]);
  const hooks=remoteHooks(input,workspace);
  let timer:ReturnType<typeof setTimeout>|undefined;
  let heartbeating=false,heartbeatFailures=0;
  const heartbeat=setInterval(async()=>{
    if(heartbeating)return;heartbeating=true;
    try{const response=await fetch(process.env.WORKER_CALLBACK_URL!,{method:"POST",headers:{Authorization:`Bearer ${process.env.PIPELINE_CALLBACK_TOKEN}`,"content-type":"application/json"},body:JSON.stringify({status:"heartbeat"}),signal:AbortSignal.timeout(20000)});if(response.status===409){cancelCommands();console.error("Worker lease lost; stopping immediately");process.exit(3);}if(!response.ok)throw new Error("Heartbeat rejected");heartbeatFailures=0;}catch{if(++heartbeatFailures>=3){cancelCommands();console.error("Worker lease could not be confirmed; stopping");process.exit(3);}}finally{heartbeating=false;}
  },25000);heartbeat.unref();
  try {timer=setTimeout(()=>{cancelCommands();console.error("Worker hard time limit exceeded");process.exit(124);},workerTimeRemainingMs(input));timer.unref();await runPipeline(input,workspace,hooks);console.log(JSON.stringify({jobId:input.jobId,status:"ready"}));}
  catch(error) {
    const issue=error instanceof PipelineError?error:new PipelineError("production_failed","The video could not complete this production step.","Retry with clearer source assets, or contact the beta administrator.");
    const detail={code:issue.code,message:issue.message,action:issue.action,retryable:issue.retryable};
    await writeJson(join(workspace,"result.json"),{job_id:input.jobId,status:issue.status,error:detail});
    try{await hooks.persist(["result.json"]);await fetch(process.env.WORKER_CALLBACK_URL!,{method:"POST",headers:{Authorization:`Bearer ${process.env.PIPELINE_CALLBACK_TOKEN}`,"content-type":"application/json"},body:JSON.stringify({status:issue.status,error:detail}),signal:AbortSignal.timeout(30000)});}catch{}
    console.error(JSON.stringify({jobId:input.jobId,...detail,diagnostic:error instanceof Error?error.message.slice(0,1000):"Unknown error"}));process.exitCode=1;
  } finally {if(timer)clearTimeout(timer);clearInterval(heartbeat);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)void main();
