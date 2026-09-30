import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { audioMeasurements, command, ffmpeg, frame, mediaEnvironment, probe, writeJson } from "./media";
import { safeDownload } from "./security";
import { PipelineError, type Asset, type Evidence, type Hooks, type WorkerInput } from "./types";
import type { Providers } from "./providers";

export function callbackAuth() { const url=process.env.WORKER_CALLBACK_URL; const token=process.env.PIPELINE_CALLBACK_TOKEN; return url && token ? {origin:new URL(url).origin,token}:undefined; }
export async function ingest(input:WorkerInput,workspace:string,providers:Providers,hooks:Hooks):Promise<Evidence> {
  const evidence:Evidence={text:"",assets:[]};
  const limits=input.limits||{maxFiles:12,maxFileBytes:250*1024*1024,maxTotalBytes:500*1024*1024,maxPrdBytes:15*1024*1024,maxReferenceBytes:100*1024*1024,maxSourceDurationSeconds:300,maxReferenceDurationSeconds:180};
  if(input.files.length>limits.maxFiles) throw new PipelineError("too_many_files","Too many input files.",`Upload at most ${limits.maxFiles} files.`,"needs_input");
  for(const folder of ["assets","analysis","project","renders"]) await mkdir(join(workspace,folder),{recursive:true});
  let totalBytes=0;
  for(const [index,file] of input.files.entries()) {
    const max=file.kind==="prd"?limits.maxPrdBytes:file.kind==="reference"?limits.maxReferenceBytes:limits.maxFileBytes;
    const downloaded=await safeDownload(file.url,max,callbackAuth()); totalBytes+=downloaded.bytes.length;
    if(totalBytes>limits.maxTotalBytes) throw new PipelineError("input_size","The combined inputs exceed the job limit.","Supply fewer or smaller files.","needs_input");
    if(file.kind==="prd") {
      const isPdf=downloaded.bytes.subarray(0,5).toString()==="%PDF-";
      const relative=`assets/prd-${index}.${isPdf?"pdf":"txt"}`; await writeFile(join(workspace,relative),downloaded.bytes);
      if(isPdf) {
        const extracted=`analysis/prd-${index}.txt`; await command("pdftotext",["-layout","-enc","UTF-8",join(workspace,relative),join(workspace,extracted)]);
        evidence.text+=(await readFile(join(workspace,extracted),"utf8")).slice(0,50000);
      } else { if(downloaded.bytes.includes(0)) throw new PipelineError("prd_not_text","The PRD is not a readable text document.","Upload a text-based PDF, Markdown, or plain-text PRD.","needs_input"); evidence.text+=downloaded.bytes.toString("utf8").slice(0,50000); }
      await hooks.persist([relative]); continue;
    }
    const extension=file.mimeType.includes("png")?"png":file.mimeType.includes("webp")?"webp":file.mimeType.includes("jpeg")?"jpg":file.mimeType.includes("webm")?"webm":file.mimeType.includes("quicktime")?"mov":"mp4";
    const relative=`assets/input-${index}.${extension}`; await writeFile(join(workspace,relative),downloaded.bytes);
    const asset=await ingestMedia(relative,`input-${index}`,file.kind==="reference"?"reference":"output",workspace,providers,file.kind==="reference"?limits.maxReferenceDurationSeconds:limits.maxSourceDurationSeconds);
    evidence.assets.push(asset); await hooks.persist([relative,asset.preview!,...(asset.kind==="image"?[asset.path]:[])]);
  }
  if(input.mode==="url") {
    if(!input.productUrl) throw new PipelineError("missing_url","A product URL is required.","Enter a public product URL.","needs_input");
    const captured=await captureProduct(input.productUrl,workspace); evidence.text=captured.text; evidence.assets.push(...captured.assets); evidence.capturedUrl=captured.url;
    await hooks.persist(captured.assets.map(a=>a.path).concat("analysis/product-source.txt","analysis/capture-diagnostics.json"));
  } else if(evidence.text.trim().length<100 || !evidence.assets.some(a=>a.usage==="output")) throw new PipelineError("insufficient_prd","The PRD needs readable product information and at least one usable visual.","Upload a text-based PRD plus product screenshots or a screen recording.","needs_input");
  if(input.referenceUrl) {
    const downloaded=await safeDownload(input.referenceUrl,limits.maxReferenceBytes);
    if(!downloaded.contentType.startsWith("video/")) throw new PipelineError("reference_not_direct","This reference link does not return a supported video file.","Upload the reference video directly, or use a public MP4/WebM file URL.","needs_input");
    const relative="assets/reference-download.mp4"; await writeFile(join(workspace,relative),downloaded.bytes);
    evidence.assets.push(await ingestMedia(relative,"reference","reference",workspace,providers,limits.maxReferenceDurationSeconds)); await hooks.persist([relative]);
  }
  const reference=evidence.assets.find(a=>a.usage==="reference");
  if(reference) {
    if(reference.kind!=="video") throw new PipelineError("reference_type","The reference must be a video.","Upload a short MP4 or WebM reference video.","needs_input");
    const frames: {path:string;label:string}[]=[];
    for(let i=0;i<8;i++) { const time=Math.min((reference.duration_seconds||1)-0.1,i*(reference.duration_seconds||1)/8); const path=`analysis/reference-${i}.jpg`; await frame(join(workspace,reference.path),join(workspace,path),time,1200); frames.push({path,label:`REFERENCE ONLY frame at ${time.toFixed(2)}s`}); }
    const cutOutput=await command(ffmpeg,["-hide_banner","-i",join(workspace,reference.path),"-vf","select='gt(scene,0.3)',showinfo","-an","-f","null","-"],180_000);
    const cuts=[...cutOutput.matchAll(/pts_time:([0-9.]+)/g)].map(m=>Number(m[1]));
    const sound=reference.has_audio?await audioMeasurements(join(workspace,reference.path)):null;
    const measurements={duration:reference.duration_seconds,width:reference.width,height:reference.height,cutTimes:cuts,audio:sound,transcript:reference.transcript};
    const description=await providers.claude("reference",`Analyze these actual reference frames plus measured cut and audio-event data. Describe observed typography, palette, frame layout, narrative functions, pacing and motion cues (label motion inferred where stills cannot establish it). Sound descriptions must be grounded in supplied measured audio events; no guessed instruments/BPM. Return JSON {pacing, typography, palette, framing, motion, sound, uncertain, observations:[{timeSeconds,trait}]}. Reference is analysis-only; output must never reuse its imagery, copy, voices, or soundtrack. Measurements: ${JSON.stringify(measurements)}`,frames);
    evidence.reference={aspect:reference.width/reference.height,description,measurements}; await writeJson(join(workspace,"analysis/style.json"),evidence.reference); await hooks.persist(["analysis/style.json",...frames.map(f=>f.path)]);
  }
  if(!evidence.assets.some(a=>a.usage==="output")) throw new PipelineError("no_visuals","No usable product visuals were found.","Upload product screenshots or a screen recording.","needs_input");
  await writeJson(join(workspace,"analysis/evidence.json"),evidence); await hooks.persist(["analysis/evidence.json"]); return evidence;
}

async function ingestMedia(relative:string,id:string,usage:"output"|"reference",workspace:string,providers:Providers,limit:number):Promise<Asset> {
  const media=await probe(join(workspace,relative));
  if(!media.video || media.width<100 || media.height<100 || media.width*media.height>40_000_000) throw new PipelineError("unusable_visual","An asset is not a supported image or video.","Supply PNG, JPEG, WebP, MP4, MOV, or WebM product visuals.","needs_input");
  const still=["png","mjpeg","webp"].includes(media.video.codec_name) && media.duration<0.1;
  if(!still && (!Number.isFinite(media.duration)||media.duration<=0||media.duration>limit)) throw new PipelineError("source_duration",`A video exceeds the ${limit}-second source limit.`,"Trim the source video before uploading it.","needs_input");
  const preview=`analysis/${id}.jpg`; await frame(join(workspace,relative),join(workspace,preview),still?0:Math.min(1,media.duration/2));
  let outputPath=relative;
  if(still) { outputPath=`assets/${id}-normalized.jpg`; await frame(join(workspace,relative),join(workspace,outputPath),0,2560); }
  const asset:Asset={id,path:outputPath,kind:still?"image":"video",usage,rights:"User supplied for this private production; reference is analysis only.",width:media.width,height:media.height,duration_seconds:still?undefined:media.duration,has_audio:!!media.audio,preview};
  if(media.audio) { const audio=`analysis/${id}-audio.mp3`; await command(ffmpeg,["-v","error","-y","-i",join(workspace,relative),"-vn","-ac","1","-ar","16000","-b:a","48k",join(workspace,audio)]); asset.transcript=await providers.transcribe(audio,media.duration); }
  return asset;
}

export async function captureProduct(url:string,workspace:string):Promise<{text:string;assets:Asset[];url:string}> {
  const browser=await chromium.launch({headless:true,args:["--disable-dev-shm-usage"],env:mediaEnvironment()});
  try {
    const context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1,serviceWorkers:"block",acceptDownloads:false,ignoreHTTPSErrors:false,reducedMotion:"reduce"});
    let bytes=0,requests=0;
    const diagnostics:{errors:string[];blocked:string[]}={errors:[],blocked:[]};
    await context.route("**/*",async route=>{
      try {
        if(route.request().method()!=="GET" || ["media","websocket"].includes(route.request().resourceType()) || ++requests>500) { await route.abort(); return; }
        const result=await safeDownload(route.request().url(),8_000_000); bytes+=result.bytes.length;
        if(bytes>55_000_000) {await route.abort();return;}
        await route.fulfill({status:result.status,contentType:result.contentType,headers:result.browserHeaders,body:result.bytes});
      } catch(error) { diagnostics.blocked.push(`${route.request().url().slice(0,200)}: ${error instanceof Error?error.message:"request failed"}`); await route.abort(); }
    });
    await context.routeWebSocket("**/*",socket=>socket.close());
    const page=await context.newPage();
    page.on("pageerror",error=>diagnostics.errors.push(error.message.slice(0,500)));
    try {await page.goto(url,{waitUntil:"domcontentloaded",timeout:45000});await page.waitForLoadState("networkidle",{timeout:10000}).catch(()=>{});} catch {throw new PipelineError("product_unreachable","The product page could not be opened.","Use a public marketing page, or submit a PRD and product screenshots.","needs_input");}
    const source=await page.locator("body").innerText({timeout:10000});
    if(source.trim().length<150 || /^(access denied|checking your browser|just a moment)/i.test(source.trim())) throw new PipelineError("product_inaccessible","The page does not expose enough readable product information.","Supply a public product page, or a PRD with screenshots.","needs_input");
    const text=(await page.title())+"\n"+source.slice(0,45000); await writeFile(join(workspace,"analysis/product-source.txt"),text);
    await page.waitForTimeout(1500);
    await page.evaluate(()=>{for(const animation of document.getAnimations()){try{if(animation.effect?.getComputedTiming().iterations!==Infinity)animation.finish();}catch{}}});
    // Keep completed animation styles. animation:none would reset opacity-based
    // entrances to their hidden base state and capture an apparently blank page.
    await page.addStyleTag({content:"*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}"});
    const height=await page.evaluate(()=>document.documentElement.scrollHeight), assets:Asset[]=[];
    for(let i=0;i<Math.min(4,Math.ceil(height/820));i++) {
      await page.evaluate(y=>window.scrollTo(0,y),i*820); await page.waitForTimeout(250);
      const path=`assets/product-capture-${i}.jpg`; await page.screenshot({path:join(workspace,path),type:"jpeg",quality:90});
      assets.push({id:`capture-${i}`,path,kind:"image",usage:"output",rights:"Accurate capture of the submitted public product page for the requested video.",width:1440,height:960,preview:path,source:url});
    }
    await writeJson(join(workspace,"analysis/capture-diagnostics.json"),{...diagnostics,requests,bytes});
    return{text,assets,url:page.url()};
  } finally {await browser.close();}
}
