/** Local acceptance transport only. Never imported by the production CLI or API. */
import { readFile,realpath,stat } from "node:fs/promises";
import { dirname,extname,isAbsolute,relative,resolve } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { safePath } from "../worker/security";
import type { IngestDependencies } from "../worker/ingest";
import type { WorkerInput } from "../worker/types";

const fixtureSchema=z.object({mode:z.literal("prd"),videoType:z.enum(["launch","feature-demo"]),format:z.enum(["auto","16:9","9:16","1:1"]),files:z.array(z.object({path:z.string(),kind:z.enum(["prd","asset","reference"]),size_bytes:z.number().int().positive(),sha256:z.string().regex(/^[a-f0-9]{64}$/)})).min(2).max(12)});
const mime=(path:string)=>({".md":"text/markdown",".txt":"text/plain",".pdf":"application/pdf",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".mp4":"video/mp4",".webm":"video/webm",".mov":"video/quicktime"}[extname(path).toLowerCase()]||"application/octet-stream");
export async function localFixtureInput(manifestPath:string){
  const file=resolve(manifestPath),root=await realpath(dirname(file)),raw=await readFile(file),manifest=fixtureSchema.parse(JSON.parse(raw.toString("utf8")));
  const sources=new Map<string,{path:string;sha256:string;size:number;contentType:string}>(),files:WorkerInput["files"]=[];
  for(const [index,item]of manifest.files.entries()){
    const path=await realpath(safePath(root,item.path)),rel=relative(root,path);if(rel.startsWith("..")||isAbsolute(rel))throw new Error("Fixture symlink escapes its manifest directory");
    const info=await stat(path);if(!info.isFile()||info.size!==item.size_bytes)throw new Error("Fixture size differs from its manifest");
    const bytes=await readFile(path);if(createHash("sha256").update(bytes).digest("hex")!==item.sha256)throw new Error("Fixture hash differs from its manifest");
    const url=`https://local-acceptance.invalid/fixture/${index}`,contentType=mime(item.path);sources.set(url,{path,sha256:item.sha256,size:item.size_bytes,contentType});
    files.push({id:`local-${index}`,name:item.path.split("/").at(-1)!,kind:item.kind,url,mimeType:contentType,size:item.size_bytes});
  }
  const readInput:NonNullable<IngestDependencies["readInput"]>=async(url,maxBytes)=>{
    const source=sources.get(url);if(!source)throw new Error("Unmapped local fixture URL");
    const bytes=await readFile(source.path);if(bytes.length>maxBytes||bytes.length!==source.size)throw new Error("Fixture exceeds download limit or changed size");
    if(createHash("sha256").update(bytes).digest("hex")!==source.sha256)throw new Error("Fixture changed after verification");
    return{bytes,contentType:source.contentType,url,status:200,browserHeaders:{}};
  };
  return{input:{mode:manifest.mode,videoType:manifest.videoType,format:manifest.format,files},dependencies:{readInput},provenance:{transport:"verified-local-fixture-bytes",manifestPath:file,manifestSha256:createHash("sha256").update(raw).digest("hex"),productionUploadTransportVerified:false,files:manifest.files}};
}
