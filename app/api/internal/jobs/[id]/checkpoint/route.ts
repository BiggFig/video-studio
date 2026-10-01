import { after } from "next/server";
import { z } from "zod";
import { authenticateWorker } from "@/lib/server/worker-auth";
import { checkpointJob, completeJob, failJob, heartbeatJob } from "@/lib/server/jobs";
import { stopWorker, dispatchJobs } from "@/lib/server/dispatch";
import { apiError, ApiError, json, readJson } from "@/lib/server/http";
import { hasServerCheckpointField } from "@/lib/server/execution-budget";
export const runtime="nodejs";
export const maxDuration=120;
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    const {id}=await context.params;
    const {job,leaseToken}=await authenticateWorker(request,id);
    const data=await readJson(request,512_000);
    if(data.result) {
      const result=z.object({videoPath:z.string(),posterPath:z.string(),quality:z.record(z.string(),z.unknown()),durationSeconds:z.number(),width:z.number(),height:z.number(),costUsd:z.number().nullable(),versions:z.record(z.string(),z.string()).optional()}).parse(data.result);
      const video=job.artifacts[result.videoPath],poster=job.artifacts[result.posterPath];
      if(!video||!poster) throw new ApiError(422,"OUTPUT_NOT_STORED","Final outputs must be stored before delivery.");
      await completeJob(id,leaseToken,{...result,video,poster});
      after(async()=>{await stopWorker(job.checkpoint.sandboxName,id);await dispatchJobs();});
      return json({ok:true});
    }
    if(data.error) {
      const failure=z.object({code:z.string(),message:z.string(),action:z.string(),retryable:z.boolean().optional(),status:z.enum(["failed","needs_input","needs_review"]).optional()}).parse(data.error);
      await failJob(id,leaseToken,{...failure,status:failure.status??(["needs_input","needs_review"].includes(data.status)?data.status:"failed")});
      after(async()=>{await stopWorker(job.checkpoint.sandboxName,id);await dispatchJobs();});
      return json({ok:true});
    }
    await heartbeatJob(id,leaseToken,180);
    if(data.status && data.status!=="heartbeat") {
      const status=z.enum(["reading","planning","rendering","checking"]).parse(data.status);
      const checkpoint=z.record(z.string(),z.unknown()).parse(data.checkpoint??{});
      if (hasServerCheckpointField(checkpoint)) throw new ApiError(400,"RESERVED_CHECKPOINT_FIELD","Worker checkpoint contains a reserved field.");
      await checkpointJob(id,leaseToken,status,checkpoint);
    }
    return json({ok:true});
  } catch(error) {return apiError(error);}
}
