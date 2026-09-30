import { randomUUID } from "node:crypto";
import { Sandbox } from "@vercel/sandbox";
import { getVercelOidcToken } from "@vercel/functions/oidc";
import { acceptingJobs, limits, requiredEnv } from "./config";
import { claimNextJob, checkpointJob, failJob, heartbeatJob, type JobRow } from "./jobs";
import { workerToken } from "./worker-auth";
import { resolveRuntimePin, RuntimePinError } from "./runtime-pin";
import type { WorkerInput } from "../../worker/types";
import workerBundle from "../generated/worker-bundle.json";
export async function stopWorker(name:unknown,jobId:string) {
  if(typeof name!=="string"||!name.startsWith(`video-studio-job-${jobId}-`)) return;
  try { const sandbox=await Sandbox.get({name,resume:false}); await sandbox.stop(); }
  catch { console.warn("Worker cleanup will be retried or limited by its deadline"); }
}
async function launchJob(job:JobRow) {
  const leaseToken=job.lease_token!;
  const pin=resolveRuntimePin(job,workerBundle,process.env.WORKER_SNAPSHOT_ID);
  // Save the pin before compute allocation so interrupted dispatches preserve it.
  await checkpointJob(job.id,leaseToken,"reading",{...pin});
  const appUrl=requiredEnv("APP_URL").replace(/\/$/,"");
  await stopWorker(job.checkpoint.sandboxName,job.id);
  const endpoint=`${appUrl}/api/internal/jobs/${job.id}`;
  const callbackToken=workerToken(job.id,leaseToken);
  const resume=Object.fromEntries(Object.keys(job.artifacts).map(p=>[p,`${endpoint}/artifact?path=${encodeURIComponent(p)}`]));
  const input:WorkerInput={jobId:job.id,ownerId:job.user_id,...job.input,runtimeHash:pin.runtimeHash,runtimeId:pin.snapshotId,
    files:job.uploads.map(f=>({id:f.id,name:f.name,kind:f.kind,mimeType:f.contentType,size:Number(f.size),url:`${endpoint}/artifact?upload=${f.id}`})),
    resume,limits:limits(),budgets:{maxDurationSeconds:300,maxModelCalls:10,maxRepairPasses:2,maxWallSeconds:Math.min(1800,Number(process.env.BETA_MAX_WORKER_SECONDS??1800)),maxAudioGenerations:2,maxModelInputTokens:200_000,maxModelOutputTokens:30_000}};
  const sandbox=await Sandbox.create({name:`video-studio-job-${job.id}-${job.attempts}`,source:{type:"snapshot",snapshotId:pin.snapshotId},persistent:false,resources:{vcpus:4},timeout:Math.min(1800,Number(process.env.BETA_MAX_WORKER_SECONDS??1800))*1000,
    networkPolicy:{allow:["*"],subnets:{deny:["0.0.0.0/8","10.0.0.0/8","100.64.0.0/10","127.0.0.0/8","169.254.0.0/16","172.16.0.0/12","192.168.0.0/16","224.0.0.0/4","::1/128","fc00::/7","fe80::/10"]}}});
  try {
    await checkpointJob(job.id,leaseToken,"reading",{sandboxName:sandbox.name,runtimeVersion:"video-studio-0.2.0"});
    const files=[...workerBundle.map(file=>({path:`/vercel/sandbox/${file.path}`,content:Buffer.from(file.content)})),{path:"/vercel/sandbox/job/input.json",content:Buffer.from(JSON.stringify(input))}];
    await sandbox.writeFiles(files);
    await heartbeatJob(job.id,leaseToken,180);
    const env:Record<string,string>={WORKER_CALLBACK_URL:`${endpoint}/checkpoint`,PIPELINE_CALLBACK_TOKEN:callbackToken,ELEVENLABS_API_KEY:requiredEnv("ELEVENLABS_API_KEY"),ANTHROPIC_MODEL:process.env.ANTHROPIC_MODEL??"claude-sonnet-4-6",AI_GATEWAY_MODEL:process.env.AI_GATEWAY_MODEL??"anthropic/claude-sonnet-4.6",NODE_ENV:"production"};
    if(process.env.ANTHROPIC_API_KEY) env.ANTHROPIC_API_KEY=process.env.ANTHROPIC_API_KEY;
    else if(process.env.AI_GATEWAY_API_KEY) env.AI_GATEWAY_API_KEY=process.env.AI_GATEWAY_API_KEY;
    else env.VERCEL_OIDC_TOKEN=await getVercelOidcToken();
    await sandbox.runCommand({cmd:"node",args:["--import","tsx","worker/index.ts","--input","/vercel/sandbox/job/input.json","--workspace","/vercel/sandbox/job","--checkpoint-url",`${endpoint}/checkpoint`],cwd:"/vercel/sandbox",env,detached:true,timeoutMs:input.budgets!.maxWallSeconds!*1000});
  } catch(error) { await sandbox.stop().catch(()=>{}); throw error; }
}
export async function dispatchJobs() {
  if(!acceptingJobs()||!process.env.WORKER_SNAPSHOT_ID||!process.env.WORKER_SECRET) return {dispatched:0};
  let dispatched=0;
  const maximum=Math.min(2,Math.max(1,Number(process.env.BETA_GLOBAL_CONCURRENCY??2)));
  for(let index=0;index<maximum;index++) {
    const job=await claimNextJob({workerId:randomUUID(),globalConcurrency:maximum,userConcurrency:1,leaseSeconds:180,maxAttempts:3});
    if(!job) break;
    try { await launchJob(job); dispatched++; }
    catch(error) {
      console.error("Worker dispatch failed",{jobId:job.id,type:error instanceof Error?error.name:"Unknown"});
      await failJob(job.id,job.lease_token!,error instanceof RuntimePinError?{code:error.code,message:error.message,action:error.action,status:"needs_review",retryable:false}:{code:"WORKER_START_FAILED",message:"The render worker could not start.",action:"The studio will retry automatically. If this continues, try again later.",retryable:true});
    }
  }
  return {dispatched};
}
