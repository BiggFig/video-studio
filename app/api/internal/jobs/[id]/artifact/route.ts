import { randomUUID } from "node:crypto";
import { head, get } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { z } from "zod";
import { authenticateWorker, artifactPath, signWorkerValue, readWorkerValue } from "@/lib/server/worker-auth";
import { recordJobArtifact, reserveJobArtifact } from "@/lib/server/jobs";
import { ApiError, apiError, json, readJson } from "@/lib/server/http";
import { privateBlobUrl } from "@/lib/server/security";
export const runtime = "nodejs";
export const maxDuration = 60;
type Context = {params:Promise<{id:string}>};
export async function POST(request:Request,context:Context) {
  try {
    const {id} = await context.params;
    const {job,leaseToken} = await authenticateWorker(request,id);
    const data = await readJson(request);
    if (data.operation === "prepare") {
      const body = z.object({operation:z.literal("prepare"),path:z.string(),size:z.number().int().positive().max(800*1024*1024),contentType:z.string().max(120)}).parse(data);
      artifactPath(body.path);
      const pathname = `jobs/${id}/${randomUUID()}/${body.path}`;
      const {grantId} = await reserveJobArtifact(id,leaseToken,{path:body.path,pathname,size:body.size,contentType:body.contentType});
      const clientToken = await generateClientTokenFromReadWriteToken({pathname,maximumSizeInBytes:body.size,allowedContentTypes:[body.contentType],addRandomSuffix:false,allowOverwrite:false,validUntil:Date.now()+15*60_000});
      const grant = signWorkerValue({purpose:"artifact",jobId:id,leaseToken,grantId,path:body.path,pathname,size:body.size,contentType:body.contentType,expires:Date.now()+15*60_000});
      return json({clientToken,pathname,grant});
    }
    const body = z.object({operation:z.literal("complete"),path:z.string(),url:z.string().url(),grant:z.string()}).parse(data);
    const grant = readWorkerValue(body.grant);
    if (grant.purpose!=="artifact" || grant.jobId!==id || grant.leaseToken!==leaseToken || grant.path!==body.path || typeof grant.pathname!=="string" || typeof grant.grantId!=="string") throw new ApiError(403,"INVALID_GRANT","Artifact authorization invalid.");
    privateBlobUrl(body.url,grant.pathname);
    const blob = await head(body.url);
    if (blob.size!==grant.size || blob.contentType!==grant.contentType || blob.pathname!==grant.pathname) throw new ApiError(422,"ARTIFACT_MISMATCH","Uploaded artifact did not match its grant.");
    const artifact={url:blob.url,pathname:blob.pathname,size:blob.size,contentType:blob.contentType};
    await recordJobArtifact(id,leaseToken,body.path,artifact,grant.grantId);
    return json(artifact);
  } catch(error) { return apiError(error); }
}
export async function GET(request:Request,context:Context) {
  try {
    const {id}=await context.params;
    const {job}=await authenticateWorker(request,id);
    const url = new URL(request.url);
    const uploadId=url.searchParams.get("upload");
    const item = uploadId ? job.uploads.find(u=>u.id===uploadId) : job.artifacts[artifactPath(url.searchParams.get("path")??"")];
    if (!item) throw new ApiError(404,"ARTIFACT_NOT_FOUND","Artifact not found.");
    const blob = await get(item.url,{access:"private",useCache:false});
    if (!blob || blob.statusCode !== 200) throw new ApiError(404,"ARTIFACT_NOT_FOUND","Artifact not found.");
    return new Response(blob.stream,{headers:{"Content-Type":item.contentType,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  } catch(error) { return apiError(error); }
}
