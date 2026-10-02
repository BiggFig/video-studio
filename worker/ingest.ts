import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { audioMeasurements, command, ffmpeg, frame, mediaEnvironment, probe, writeJson } from "./media";
import { safeDownload } from "./security";
import { PipelineError, type Asset, type BrandEvidence, type Evidence, type Hooks, type WorkerInput } from "./types";
import type { Providers } from "./providers";
import { extractProductVisuals } from "./product-visuals";
import { enrichProductResearch, researchDestination } from "./url-research";
import { extractBrandEvidence } from "./brand-evidence";

export function callbackAuth() { const url=process.env.WORKER_CALLBACK_URL; const token=process.env.PIPELINE_CALLBACK_TOKEN; return url && token ? {origin:new URL(url).origin,token}:undefined; }

/** At most four downloads, with byte capacity reserved before any connection. */
export class CaptureDownloadBudget {
  private used=0;private reserved=0;private active=0;
  private waiting:{resolve:(amount:number)=>void;reject:(reason:Error)=>void}[]=[];
  constructor(private total=55_000_000,private perRequest=8_000_000,private concurrency=4){}
  private pump(){
    while(this.waiting.length&&this.active<this.concurrency){
      const available=this.total-this.used-this.reserved;
      if(available<=0){if(this.active===0)for(const waiter of this.waiting.splice(0))waiter.reject(new Error("Capture download budget exhausted"));return;}
      const amount=Math.min(this.perRequest,available);this.reserved+=amount;this.active++;this.waiting.shift()!.resolve(amount);
    }
  }
  async run<T extends {bytes:Buffer}>(download:(maxBytes:number)=>Promise<T>):Promise<T>{
    const amount=await new Promise<number>((resolve,reject)=>{this.waiting.push({resolve,reject});this.pump();});
    try{const result=await download(amount);if(result.bytes.length>amount)throw new Error("Capture download exceeded its reservation");this.used+=result.bytes.length;return result;}
    catch(error){this.used+=amount;throw error;} // Unknown partial transfers consume their full reservation.
    finally{this.reserved-=amount;this.active--;this.pump();}
  }
}

function parserFailure(error:unknown,kind:"prd"|"visual"|"reference"):never {
  if(error instanceof PipelineError)throw error;
  if(error instanceof Error&&"code"in error&&["ENOENT","EACCES","EPERM"].includes(String(error.code)))throw new PipelineError("media_runtime_unavailable","A required document or media reader is unavailable.","Ask the beta administrator to restore the worker's document and media tools.");
  if(kind==="prd")throw new PipelineError("prd_unreadable","The PDF could not be read. It may be damaged, encrypted, or unsupported.","Export an unencrypted, text-based PDF, or upload the PRD as UTF-8 Markdown or plain text.","needs_input");
  if(kind==="reference")throw new PipelineError("reference_unusable","The reference file is not a readable video.","Upload a working MP4 or WebM reference video directly.","needs_input");
  throw new PipelineError("unusable_visual","A product asset could not be decoded as a usable image or video.","Re-export the asset as PNG, JPEG, WebP, MP4, MOV, or WebM and upload it again.","needs_input");
}

export async function downloadInput(url:string,maxBytes:number,kind:"upload"|"reference",auth?:ReturnType<typeof callbackAuth>){
  try{return await safeDownload(url,maxBytes,auth);}
  catch(error){
    if(error instanceof Error&&error.message.includes("exceeds download limit"))throw new PipelineError("input_size","The input file exceeds its download limit.","Upload a smaller file within the limits shown in the form.","needs_input");
    if(error instanceof PipelineError&&["unsafe_url","invalid_url","redirect_limit"].includes(error.code))throw error;
    if(kind==="reference")throw new PipelineError("reference_unreachable","The reference video could not be retrieved from that link.","Upload the reference video directly, or use a reachable public MP4/WebM file URL.","needs_input");
    throw new PipelineError("upload_unavailable","An uploaded file could not yet be retrieved.","The studio will retry automatically. If this continues, ask the beta administrator to check the uploaded file.","failed",true);
  }
}

export function requireDirectReference(contentType:string){
  if(!contentType.trim().toLowerCase().startsWith("video/"))throw new PipelineError("reference_not_direct","This reference link does not return a supported video file.","Upload the reference video directly, or use a public MP4/WebM file URL.","needs_input");
}

export async function extractPrd(bytes:Buffer,workspace:string,index:number,expectedPdf=false,runDocumentReader:typeof command=command):Promise<{path:string;text:string}>{
  const isPdf=bytes.subarray(0,5).toString()==="%PDF-";
  if(expectedPdf&&!isPdf)throw new PipelineError("prd_unreadable","The uploaded PDF does not contain a valid PDF header.","Re-export a text-based PDF, or upload UTF-8 Markdown or plain text.","needs_input");
  const path=`assets/prd-${index}.${isPdf?"pdf":"txt"}`;await writeFile(join(workspace,path),bytes);
  let text:string;
  if(isPdf){
    const extracted=`analysis/prd-${index}.txt`;
    try{await runDocumentReader(process.env.PDFTOTEXT_PATH||"pdftotext",["-layout","-enc","UTF-8",join(workspace,path),join(workspace,extracted)]);text=(await readFile(join(workspace,extracted),"utf8")).slice(0,50000);}
    catch(error){return parserFailure(error,"prd");}
  }else{
    try{text=new TextDecoder("utf-8",{fatal:true}).decode(bytes).slice(0,50000);if(/[\x00-\x08\x0b\x0e-\x1f]/.test(text))throw new Error("Binary control characters");}
    catch{throw new PipelineError("prd_not_text","The PRD is not a readable UTF-8 text document.","Upload a text-based PDF, or save the Markdown/plain-text PRD as UTF-8.","needs_input");}
  }
  if(text.trim().length<100)throw new PipelineError("prd_insufficient_text",isPdf?"The PDF does not contain enough extractable product text. It may contain only scanned pages.":"The PRD does not contain enough readable product information.","Supply a text-based PRD describing the product and its features; for a scanned PDF, export an OCR text version first.","needs_input");
  return{path,text};
}

export interface IngestDependencies { readInput?:typeof downloadInput }
export async function ingest(input:WorkerInput,workspace:string,providers:Providers,hooks:Hooks,dependencies:IngestDependencies={}):Promise<Evidence> {
  const evidence:Evidence={text:"",assets:[]};
  const readInput=dependencies.readInput||downloadInput;
  const limits=input.limits||{maxFiles:12,maxFileBytes:250*1024*1024,maxTotalBytes:500*1024*1024,maxPrdBytes:15*1024*1024,maxReferenceBytes:100*1024*1024,maxSourceDurationSeconds:300,maxReferenceDurationSeconds:180};
  if(input.files.length>limits.maxFiles) throw new PipelineError("too_many_files","Too many input files.",`Upload at most ${limits.maxFiles} files.`,"needs_input");
  for(const folder of ["assets","analysis","project","renders"]) await mkdir(join(workspace,folder),{recursive:true});
  let totalBytes=0;
  for(const [index,file] of input.files.entries()) {
    const max=file.kind==="prd"?limits.maxPrdBytes:file.kind==="reference"?limits.maxReferenceBytes:limits.maxFileBytes;
    const downloaded=await readInput(file.url,max,"upload",callbackAuth()); totalBytes+=downloaded.bytes.length;
    if(totalBytes>limits.maxTotalBytes) throw new PipelineError("input_size","The combined inputs exceed the job limit.","Supply fewer or smaller files.","needs_input");
    if(file.kind==="prd") {
      const document=await extractPrd(downloaded.bytes,workspace,index,file.mimeType==="application/pdf"||/\.pdf$/i.test(file.name));evidence.text+=document.text;
      await hooks.persist([document.path]); continue;
    }
    const extension=file.mimeType.includes("png")?"png":file.mimeType.includes("webp")?"webp":file.mimeType.includes("jpeg")?"jpg":file.mimeType.includes("webm")?"webm":file.mimeType.includes("quicktime")?"mov":"mp4";
    const relative=`assets/input-${index}.${extension}`; await writeFile(join(workspace,relative),downloaded.bytes);
    const asset=await ingestMedia(relative,`input-${index}`,file.kind==="reference"?"reference":"output",workspace,providers,file.kind==="reference"?limits.maxReferenceDurationSeconds:limits.maxSourceDurationSeconds);
    evidence.assets.push(asset); await hooks.persist([relative,asset.preview!,...(asset.kind==="image"?[asset.path]:[])]);
  }
  if(input.mode==="url") {
    if(!input.productUrl) throw new PipelineError("missing_url","A product URL is required.","Enter a public product URL.","needs_input");
    const captured=await captureProduct(input.productUrl,workspace); evidence.text=captured.text; evidence.assets.push(...captured.assets); evidence.capturedUrl=captured.url;evidence.brand=captured.brand;
    await hooks.persist(captured.artifactPaths);
  } else if(evidence.text.trim().length<100 || !evidence.assets.some(a=>a.usage==="output")) throw new PipelineError("insufficient_prd","The PRD needs readable product information and at least one usable visual.","Upload a text-based PRD plus product screenshots or a screen recording.","needs_input");
  if(input.referenceUrl) {
    const downloaded=await readInput(input.referenceUrl,limits.maxReferenceBytes,"reference");
    requireDirectReference(downloaded.contentType);
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
    const description=await providers.claude("reference",`Analyze these actual reference frames plus measured cut and audio-event data. Describe observed typography, palette, frame layout, narrative functions, pacing and motion cues (label motion inferred where stills cannot establish it). Sound descriptions must be grounded in supplied measured audio events; no guessed instruments/BPM. Return JSON {pacing, typography, palette, framing, motion, sound, uncertain, observations:[{timeSeconds,trait}]}. Reference is analysis-only; output must never reuse its imagery, copy, voices, or soundtrack. Measurements: ${JSON.stringify(measurements)}`,frames,{policy:"reference-v1"});
    evidence.reference={aspect:reference.width/reference.height,description,measurements}; await writeJson(join(workspace,"analysis/style.json"),evidence.reference); await hooks.persist(["analysis/style.json",...frames.map(f=>f.path)]);
  }
  if(!evidence.assets.some(a=>a.usage==="output")) throw new PipelineError("no_visuals","No usable product visuals were found.","Upload product screenshots or a screen recording.","needs_input");
  await writeJson(join(workspace,"analysis/evidence.json"),evidence); await hooks.persist(["analysis/evidence.json"]); return evidence;
}

export async function ingestMedia(relative:string,id:string,usage:"output"|"reference",workspace:string,providers:Providers,limit:number):Promise<Asset> {
  let media:Awaited<ReturnType<typeof probe>>;
  try{media=await probe(join(workspace,relative));}catch(error){return parserFailure(error,usage==="reference"?"reference":"visual");}
  if(!media.video || media.width<100 || media.height<100 || media.width*media.height>40_000_000){
    if(usage==="reference")throw new PipelineError("reference_unusable","The reference does not contain a usable video picture.","Upload a working MP4 or WebM reference video directly.","needs_input");
    throw new PipelineError("unusable_visual","An asset is not a supported image or video.","Supply PNG, JPEG, WebP, MP4, MOV, or WebM product visuals.","needs_input");
  }
  const still=["png","mjpeg","webp"].includes(media.video.codec_name) && media.duration<0.1;
  if(!still && (!Number.isFinite(media.duration)||media.duration<=0||media.duration>limit)) throw new PipelineError("source_duration",`A video exceeds the ${limit}-second source limit.`,"Trim the source video before uploading it.","needs_input");
  if(usage==="reference"&&still)throw new PipelineError("reference_type","The reference must be a video.","Upload a short MP4 or WebM reference video.","needs_input");
  const preview=`analysis/${id}.jpg`;
  let outputPath=relative;
  try{
    await frame(join(workspace,relative),join(workspace,preview),still?0:Math.min(1,media.duration/2));
    if(still) { outputPath=`assets/${id}-normalized.jpg`; await frame(join(workspace,relative),join(workspace,outputPath),0,2560); }
  }catch(error){return parserFailure(error,usage==="reference"?"reference":"visual");}
  const asset:Asset={id,path:outputPath,kind:still?"image":"video",usage,rights:"User supplied for this private production; reference is analysis only.",width:media.width,height:media.height,duration_seconds:still?undefined:media.duration,has_audio:!!media.audio,preview};
  if(media.audio) { const audio=`analysis/${id}-audio.mp3`;try{await command(ffmpeg,["-v","error","-y","-i",join(workspace,relative),"-vn","-ac","1","-ar","16000","-b:a","48k",join(workspace,audio)]);}catch(error){return parserFailure(error,usage==="reference"?"reference":"visual");}asset.transcript=await providers.transcribe(audio,media.duration); }
  return asset;
}

export async function captureProduct(url:string,workspace:string,dependencies:{download?:typeof safeDownload;downloadBudget?:CaptureDownloadBudget}={}):Promise<{text:string;assets:Asset[];url:string;brand?:BrandEvidence;artifactPaths:string[]}> {
  let browser:Awaited<ReturnType<typeof chromium.launch>>;
  try{browser=await chromium.launch({headless:true,args:["--disable-dev-shm-usage"],env:mediaEnvironment()});}catch{throw new PipelineError("media_runtime_unavailable","The product capture browser is unavailable.","Ask the beta administrator to restore the worker's Chromium runtime.");}
  try {
    const context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1,serviceWorkers:"block",acceptDownloads:false,ignoreHTTPSErrors:false,reducedMotion:"reduce"});
    let bytes=0,requests=0;
    const downloads=dependencies.downloadBudget||new CaptureDownloadBudget(),download=dependencies.download||safeDownload;
    const documentUrls=new Map<string,string>();let researchHomepage:string|null=null;
    const diagnostics:{errors:string[];blocked:string[]}={errors:[],blocked:[]};
    await context.route("**/*",async route=>{
      try {
        if(route.request().method()!=="GET" || ["media","websocket"].includes(route.request().resourceType()) || ++requests>500) { await route.abort(); return; }
        const policy=researchHomepage&&route.request().resourceType()==="document"?(destination:URL)=>!!researchDestination(destination.href,researchHomepage!):undefined;
        const result=await downloads.run(maxBytes=>download(route.request().url(),maxBytes,undefined,0,policy)); bytes+=result.bytes.length;
        if(route.request().resourceType()==="document")documentUrls.set(route.request().url(),result.url);
        await route.fulfill({status:result.status,contentType:result.contentType,headers:result.browserHeaders,body:result.bytes});
      } catch(error) { diagnostics.blocked.push(`${route.request().url().slice(0,200)}: ${error instanceof Error?error.message:"request failed"}`); await route.abort(); }
    });
    await context.routeWebSocket("**/*",socket=>socket.close());
    const page=await context.newPage();
    page.on("pageerror",error=>diagnostics.errors.push(error.message.slice(0,500)));
    try {await page.goto(url,{waitUntil:"domcontentloaded",timeout:45000});await page.waitForLoadState("networkidle",{timeout:10000}).catch(()=>{});} catch {throw new PipelineError("product_unreachable","The product page could not be opened.","Use a public marketing page, or submit a PRD and product screenshots.","needs_input");}
    let source:string;
    try{source=await page.locator("body").innerText({timeout:10000});}catch{throw new PipelineError("product_inaccessible","The page does not expose readable product information.","Supply a public product page, or a PRD with screenshots.","needs_input");}
    if(source.trim().length<150 || /^(access denied|checking your browser|just a moment)/i.test(source.trim())) throw new PipelineError("product_inaccessible","The page does not expose enough readable product information.","Supply a public product page, or a PRD with screenshots.","needs_input");
    const homepageUrl=documentUrls.get(page.url())||page.url(),homepageTitle=(await page.title()).slice(0,500);
    let text=(homepageTitle+"\n"+source).slice(0,30000); await writeFile(join(workspace,"analysis/product-source.txt"),text);
    await page.waitForTimeout(1500);
    await page.evaluate(()=>{for(const animation of document.getAnimations()){try{if(animation.effect?.getComputedTiming().iterations!==Infinity)animation.finish();}catch{}}});
    // Keep completed animation styles. animation:none would reset opacity-based
    // entrances to their hidden base state and capture an apparently blank page.
    await page.addStyleTag({content:"*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}"});
    const height=await page.evaluate(()=>document.documentElement.scrollHeight), assets:Asset[]=[];
    for(let i=0;i<Math.min(2,Math.ceil(height/820));i++) {
      await page.evaluate(y=>window.scrollTo(0,y),i*820); await page.waitForTimeout(250);
      const path=`assets/product-capture-${i}.jpg`; await page.screenshot({path:join(workspace,path),type:"jpeg",quality:90});
      assets.push({id:`capture-${i}`,path,kind:"image",usage:"output",rights:"Accurate viewport capture of the submitted public marketing page; not an authenticated product workflow.",width:1440,height:960,preview:path,source:homepageUrl,
        provenance:{pageUrl:homepageUrl,pageKind:"homepage",method:"viewport",role:"marketing",sectionHeading:homepageTitle}});
    }
    const artifactPaths=assets.map(a=>a.path).concat("analysis/product-source.txt","analysis/capture-diagnostics.json");
    let brand:BrandEvidence|undefined;
    try{const branding=await extractBrandEvidence(page,workspace,homepageUrl);brand=branding.brand;assets.push(...branding.assets);artifactPaths.push(...branding.artifactPaths);}
    catch(error){diagnostics.errors.push(`Optional public brand extraction unavailable: ${error instanceof Error?error.message.slice(0,350):"unknown error"}`);}
    let focusedAssets=0;
    const focusedDownload=async(source:string,maxBytes:number)=>{
        if(++requests>500)throw new Error("Capture request budget exhausted");
        const result=await downloads.run(reservation=>download(source,Math.min(maxBytes,reservation)));bytes+=result.bytes.length;return result;
    };
    try{
      const originals=await extractProductVisuals(page,workspace,homepageUrl,{download:focusedDownload,maxAssets:3,maxPanels:2});
      focusedAssets+=originals.assets.length;assets.push(...originals.assets);artifactPaths.push(...originals.artifactPaths);
    }catch(error){diagnostics.errors.push(`Complete product image extraction unavailable: ${error instanceof Error?error.message.slice(0,400):"unknown error"}`);}
    researchHomepage=homepageUrl;
    const research=await enrichProductResearch(page,workspace,{homepageUrl,homepageTitle,homepageText:text,resolvedUrl:browserUrl=>documentUrls.get(browserUrl)||browserUrl,
      captureVisuals:async(researchPage,pageUrl,pageKind,index,schedulingMs)=>{
        if(focusedAssets>=4)return{assets:[],artifactPaths:[]};
        const result=await extractProductVisuals(researchPage,workspace,pageUrl,{download:focusedDownload,maxAssets:4-focusedAssets,maxPanels:1,prefix:`research-${index}`,pageKind,schedulingLimitMs:schedulingMs});
        focusedAssets+=result.assets.length;return result;
      }});
    text=research.text;assets.push(...research.assets);artifactPaths.push(...research.artifactPaths);
    await writeJson(join(workspace,"analysis/capture-diagnostics.json"),{...diagnostics,requests,bytes});
    return{text,assets,brand,url:homepageUrl,artifactPaths:[...new Set(artifactPaths)]};
  } finally {await browser.close();}
}
