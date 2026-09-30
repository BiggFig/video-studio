import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { requiredEnv } from "./config";
import { ApiError } from "./http";
import { assertJobLease } from "./jobs";

export function signWorkerValue(value: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${body}.${createHmac("sha256", requiredEnv("WORKER_SECRET")).update(body).digest("base64url")}`;
}
export function readWorkerValue(token: string): Record<string, unknown> {
  if (token.length > 8192) throw new ApiError(401,"INVALID_WORKER_TOKEN","Worker authorization expired.");
  const [body,signature,extra] = token.split(".");
  if (!body || !signature || extra) throw new ApiError(401,"INVALID_WORKER_TOKEN","Worker authorization expired.");
  const expected = createHmac("sha256", requiredEnv("WORKER_SECRET")).update(body).digest();
  const actual = Buffer.from(signature,"base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual,expected)) throw new ApiError(401,"INVALID_WORKER_TOKEN","Worker authorization expired.");
  const payload = JSON.parse(Buffer.from(body,"base64url").toString("utf8"));
  if (typeof payload.expires !== "number" || payload.expires < Date.now()) throw new ApiError(401,"INVALID_WORKER_TOKEN","Worker authorization expired.");
  return payload;
}
export function workerToken(jobId:string,leaseToken:string) {
  return signWorkerValue({purpose:"worker",jobId,leaseToken,expires:Date.now()+35*60_000});
}
export async function authenticateWorker(request:Request,jobId:string) {
  if (!z.string().uuid().safeParse(jobId).success) throw new ApiError(404,"JOB_NOT_FOUND","Job not found.");
  const token = request.headers.get("authorization")?.replace(/^Bearer /,"") ?? "";
  const value = readWorkerValue(token);
  if (value.purpose !== "worker" || value.jobId !== jobId || typeof value.leaseToken !== "string") throw new ApiError(403,"WORKER_SCOPE","Worker cannot access this job.");
  const job = await assertJobLease(jobId,value.leaseToken);
  return {job,leaseToken:value.leaseToken};
}
export function artifactPath(value:string) {
  if (!/^[a-zA-Z0-9_./-]{1,300}$/.test(value) || value.startsWith("/") || value.split("/").some(p=>!p||p==="."||p==="..")) throw new ApiError(400,"INVALID_ARTIFACT_PATH","Invalid artifact path.");
  return value;
}
