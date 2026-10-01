import test from "node:test";
import assert from "node:assert/strict";
import { mkdir,mkdtemp,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CaptureDownloadBudget,captureProduct,downloadInput,extractPrd,ingestMedia,requireDirectReference } from "./ingest";
import { PipelineError } from "./types";
import type { Providers } from "./providers";
import { command,ffmpeg } from "./media";

async function fixture(){const path=await mkdtemp(join(tmpdir(),"video-studio-ingest-"));await mkdir(join(path,"assets"));await mkdir(join(path,"analysis"));return path;}
function issue(code:string,status:"needs_input"|"failed"="needs_input",retryable=false){return(error:unknown)=>{assert.ok(error instanceof PipelineError);assert.equal(error.code,code);assert.equal(error.status,status);assert.equal(error.retryable,retryable);assert.ok(error.action.length>15);return true;};}
const noProviders=new Proxy({}, {get(){throw new Error("An invalid input must never reach a paid provider");}}) as Providers;
const integration=process.env.STUDIO_INGEST_INTEGRATION==="1";

test("plain PRD rejects binary, invalid UTF-8 and insufficient text",async()=>{
  const path=await fixture();for(const bytes of [Buffer.from([0,1,2,3]),Buffer.from([0xff,0xfe,0xfd])])await assert.rejects(extractPrd(bytes,path,0),issue("prd_not_text"));
  await assert.rejects(extractPrd(Buffer.from("# Product\nNot enough detail."),path,0),issue("prd_insufficient_text"));
  const text="# Acme\n"+"Acme organizes product projects and release plans in one shared workspace. ".repeat(3);assert.equal((await extractPrd(Buffer.from(text),path,0)).text,text);
});
test("a file advertised as PDF rejects invalid PDF bytes before invoking a parser",async()=>{
  await assert.rejects(extractPrd(Buffer.from("This is ordinary text, not a PDF."),await fixture(),0,true),issue("prd_unreadable"));
});
test("PDF nonzero parser exit is actionable input failure (simulated parser response)",async()=>{
  await assert.rejects(extractPrd(Buffer.from("%PDF-1.7\nbroken\n%%EOF"),await fixture(),0,true,async()=>{throw new Error("pdftotext failed (1): damaged PDF");}),issue("prd_unreadable"));
});
test("textless PDF extraction is rejected (simulated extraction, actual text policy)",async()=>{
  await assert.rejects(extractPrd(Buffer.from("%PDF-1.7\nfixture\n%%EOF"),await fixture(),0,true,async(_binary,args)=>{await writeFile(args.at(-1)!,"\f\n  \n");return "";}),issue("prd_insufficient_text"));
});
test("missing PDF executable is an administrator/runtime failure, not bad input",async()=>{
  const path=await fixture(),old=process.env.PDFTOTEXT_PATH;process.env.PDFTOTEXT_PATH=join(path,"reader-not-installed.exe");
  try{await assert.rejects(extractPrd(Buffer.from("%PDF-1.7\nfixture\n%%EOF"),path,0,true),issue("media_runtime_unavailable","failed"));}finally{if(old===undefined)delete process.env.PDFTOTEXT_PATH;else process.env.PDFTOTEXT_PATH=old;}
});
test("actual FFprobe rejects corrupt product visual and corrupt reference bytes",{skip:!integration},async()=>{
  const path=await fixture();await writeFile(join(path,"assets/corrupt.mp4"),Buffer.from("not a real MP4 file"));
  await assert.rejects(ingestMedia("assets/corrupt.mp4","bad","output",path,noProviders,300),issue("unusable_visual"));
  await assert.rejects(ingestMedia("assets/corrupt.mp4","bad-ref","reference",path,noProviders,180),issue("reference_unusable"));
});
test("actual audio-only media cannot be accepted as reference video",{skip:!integration},async()=>{
  const path=await fixture();await command(ffmpeg,["-v","error","-y","-f","lavfi","-i","sine=frequency=200:duration=1","-c:a","pcm_s16le",join(path,"assets/audio.wav")]);
  await assert.rejects(ingestMedia("assets/audio.wav","audio-reference","reference",path,noProviders,180),issue("reference_unusable"));
});
test("unsafe reference destinations remain rejected by the real SSRF guard",async()=>{
  await assert.rejects(downloadInput("http://127.0.0.1/private.mp4",1000,"reference"),issue("unsafe_url"));
});
test("nonvideo direct-reference content types produce an upload fallback",()=>{
  for(const type of ["text/html; charset=utf-8","image/png","application/json","application/octet-stream"])assert.throws(()=>requireDirectReference(type),issue("reference_not_direct"));
  requireDirectReference("video/mp4");
});
test("capture downloader reserves capacity before starting and bounds concurrency",async()=>{
  const budget=new CaptureDownloadBudget(120,80,2),releases:(()=>void)[]=[],reservations:number[]=[];
  const download=(bytes:number)=>budget.run(async amount=>{reservations.push(amount);await new Promise<void>(resolve=>releases.push(resolve));assert.ok(bytes<=amount);return{bytes:Buffer.alloc(bytes)};});
  const first=download(20),second=download(40),third=download(60);
  await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(reservations,[80,40]);assert.equal(releases.length,2);
  releases[0]();await first;await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(reservations,[80,40,60]);
  releases[1]();releases[2]();await Promise.all([second,third]);let started=false;
  await assert.rejects(budget.run(async()=>{started=true;return{bytes:Buffer.alloc(1)};}),/budget exhausted/);assert.equal(started,false);
});
test("failed capture transfers retain their full reservation instead of over-downloading",async()=>{
  const budget=new CaptureDownloadBudget(80,80,1);await assert.rejects(budget.run(async()=>{throw new Error("transfer interrupted");}),/transfer interrupted/);
  await assert.rejects(budget.run(async()=>({bytes:Buffer.alloc(1)})),/budget exhausted/);
});

test("actual unreachable reference DNS returns direct-upload guidance",{skip:!integration,timeout:30000},async()=>{
  await assert.rejects(downloadInput("https://video-studio-unreachable.invalid/reference.mp4",1000,"reference"),issue("reference_unreachable"));
});
test("actual private-upload DNS/transport failure retains bounded queue retry",{skip:!integration,timeout:30000},async()=>{
  await assert.rejects(downloadInput("https://video-studio-unreachable.invalid/upload.mp4",1000,"upload"),issue("upload_unavailable","failed",true));
});
test("actual public HTML response is not accepted as reference footage",{skip:!integration,timeout:30000},async()=>{
  const response=await downloadInput("https://example.com",100000,"reference");assert.throws(()=>requireDirectReference(response.contentType),issue("reference_not_direct"));
});
test("actual Chromium capture returns actionable error for an inaccessible product URL",{skip:!integration,timeout:60000},async()=>{
  await assert.rejects(captureProduct("https://video-studio-unreachable.invalid",await fixture()),issue("product_unreachable"));
});
