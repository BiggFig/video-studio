import { randomUUID } from "node:crypto";
import { Sandbox } from "@vercel/sandbox";
import { getVercelOidcToken } from "@vercel/functions/oidc";
import { acceptingJobs, limits, requiredEnv } from "./config";
import { claimNextJob, checkpointJob, failJob, heartbeatJob, type JobRow } from "./jobs";
import { workerToken } from "./worker-auth";
import { resolveRuntimePin, RuntimePinError } from "./runtime-pin";
import { ExecutionBudgetError, remainingExecutionSeconds, resolveExecutionBudget } from "./execution-budget";
import { dispatchErrorSummary, type LaunchStage } from "./dispatch-error";
import { workerNetworkPolicy } from "./sandbox-policy";
import type { WorkerInput } from "../../worker/types";
import workerBundle from "../generated/worker-bundle.json";
export async function stopWorker(name:unknown,jobId:string) {
  if(typeof name!=="string"||!name.startsWith(`video-studio-job-${jobId}-`)) return;
  try { const sandbox=await Sandbox.get({name,resume:false}); await sandbox.stop(); }
  catch { console.warn("Worker cleanup will be retried or limited by its deadline"); }
}
async function launchJob(job:JobRow,onStage:(stage:LaunchStage)=>void) {
  const leaseToken=job.lease_token!;
  onStage("runtime_pin");
  const pin=resolveRuntimePin(job,workerBundle,process.env.WORKER_SNAPSHOT_ID);
  onStage("execution_budget");
  const executionBudget=resolveExecutionBudget(job,process.env.BETA_MAX_WORKER_SECONDS,Date.now());
  remainingExecutionSeconds(executionBudget,Date.now());
  // Persist both together before allocation; a retry cannot reset either production constraint.
  onStage("runtime_checkpoint");
  await checkpointJob(job.id,leaseToken,"reading",{...pin,...executionBudget});
  onStage("input_preparation");
  const appUrl=requiredEnv("APP_URL").replace(/\/$/,"");
  await stopWorker(job.checkpoint.sandboxName,job.id);
  const endpoint=`${appUrl}/api/internal/jobs/${job.id}`;
  const callbackToken=workerToken(job.id,leaseToken);
  const resume=Object.fromEntries(Object.keys(job.artifacts).map(p=>[p,`${endpoint}/artifact?path=${encodeURIComponent(p)}`]));
  const input:WorkerInput={jobId:job.id,ownerId:job.user_id,...job.input,runtimeHash:pin.runtimeHash,runtimeId:pin.snapshotId,deadlineAt:executionBudget.deadlineAt,
    files:job.uploads.map(f=>({id:f.id,name:f.name,kind:f.kind,mimeType:f.contentType,size:Number(f.size),url:`${endpoint}/artifact?upload=${f.id}`})),
    resume,limits:limits(),budgets:{maxDurationSeconds:300,maxModelCalls:10,maxRepairPasses:2,maxAudioGenerations:2,maxModelInputTokens:200_000,maxModelOutputTokens:30_000}};
  const allocationSeconds=remainingExecutionSeconds(executionBudget,Date.now());
  onStage("allocation");
  const sandbox=await Sandbox.create({name:`video-studio-job-${job.id}-${job.attempts}`,source:{type:"snapshot",snapshotId:pin.snapshotId},persistent:false,resources:{vcpus:4},timeout:allocationSeconds*1000,
    networkPolicy:workerNetworkPolicy()});
  try {
    onStage("sandbox_checkpoint");
    remainingExecutionSeconds(executionBudget,Date.now());
    await checkpointJob(job.id,leaseToken,"reading",{sandboxName:sandbox.name,runtimeVersion:"video-studio-0.2.0"});
    onStage("source_upload");
    const files=workerBundle.map(file=>({path:`/vercel/sandbox/${file.path}`,content:Buffer.from(file.content)}));
    await sandbox.writeFiles(files);
    onStage("lease_refresh");
    await heartbeatJob(job.id,leaseToken,180);
    onStage("provider_configuration");
    const env:Record<string,string>={WORKER_CALLBACK_URL:`${endpoint}/checkpoint`,PIPELINE_CALLBACK_TOKEN:callbackToken,ELEVENLABS_API_KEY:requiredEnv("ELEVENLABS_API_KEY"),ANTHROPIC_MODEL:process.env.ANTHROPIC_MODEL??"claude-sonnet-4-6",AI_GATEWAY_MODEL:process.env.AI_GATEWAY_MODEL??"anthropic/claude-sonnet-4.6",NODE_ENV:"production"};
    if(process.env.ANTHROPIC_API_KEY) env.ANTHROPIC_API_KEY=process.env.ANTHROPIC_API_KEY;
    else if(process.env.AI_GATEWAY_API_KEY) env.AI_GATEWAY_API_KEY=process.env.AI_GATEWAY_API_KEY;
    else env.VERCEL_OIDC_TOKEN=await getVercelOidcToken();
    // Provisioning, bundle upload and token acquisition all consume the same original allowance.
    input.budgets!.maxWallSeconds=remainingExecutionSeconds(executionBudget,Date.now());
    onStage("input_upload");
    await sandbox.writeFiles([{path:"/vercel/sandbox/job/input.json",content:Buffer.from(JSON.stringify(input))}]);
    onStage("command_start");
    const commandSeconds=remainingExecutionSeconds(executionBudget,Date.now());
    await sandbox.runCommand({cmd:"node",args:["--import","tsx","worker/index.ts","--input","/vercel/sandbox/job/input.json","--workspace","/vercel/sandbox/job","--checkpoint-url",`${endpoint}/checkpoint`],cwd:"/vercel/sandbox",env,detached:true,timeoutMs:commandSeconds*1000});
  } catch(error) { await sandbox.stop().catch(()=>{}); throw error; }
}
export async function dispatchJobs() {
  if(!acceptingJobs()||!process.env.WORKER_SNAPSHOT_ID||!process.env.WORKER_SECRET) return {dispatched:0};
  let dispatched=0;
  const maximum=Math.min(2,Math.max(1,Number(process.env.BETA_GLOBAL_CONCURRENCY??2)));
  for(let index=0;index<maximum;index++) {
    const job=await claimNextJob({workerId:randomUUID(),globalConcurrency:maximum,userConcurrency:1,leaseSeconds:180,maxAttempts:3});
    if(!job) break;
    let stage:LaunchStage="runtime_pin";
    try { await launchJob(job,next=>{stage=next;}); dispatched++; }
    catch(error) {
      console.error("Worker dispatch failed",{jobId:job.id,...dispatchErrorSummary(error,stage)});
      if(error instanceof ExecutionBudgetError) await stopWorker(job.checkpoint.sandboxName,job.id);
      await failJob(job.id,job.lease_token!,error instanceof RuntimePinError||error instanceof ExecutionBudgetError?{code:error.code,message:error.message,action:error.action,status:"needs_review",retryable:false}:{code:"WORKER_START_FAILED",message:"The render worker could not start.",action:"The studio will retry automatically. If this continues, try again later.",retryable:true});
    }
  }
  return {dispatched};
}
