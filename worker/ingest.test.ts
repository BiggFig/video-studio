import test from "node:test";
import assert from "node:assert/strict";
import { mkdir,mkdtemp,readFile,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { assertGuideSupportsResearch,assertNoPartialGuideCapture,CaptureRequestBudget,CaptureDownloadBudget,captureProduct,downloadInput,extractPrd,GUIDE_FOLLOWUP_STATE_PATH,ingest,ingestMedia,isSpeculativePrefetch,requireDirectReference,usesAdaptiveGuideSelection } from "./ingest";
import { GUIDE_PREFIX_PATH,GUIDE_CATALOG_PATH,GUIDE_SELECTION_PATH,GUIDE_SELECTION_STATE_PATH,type GuideChoice } from "./guide-selection";
import { PipelineError,type WorkerInput,type Hooks } from "./types";
import type { Providers } from "./providers";
import { command,ffmpeg } from "./media";

async function fixture(){const path=await mkdtemp(join(tmpdir(),"video-studio-ingest-"));await mkdir(join(path,"assets"));await mkdir(join(path,"analysis"));return path;}
function issue(code:string,status:"needs_input"|"needs_review"|"failed"="needs_input",retryable=false){return(error:unknown)=>{assert.ok(error instanceof PipelineError);assert.equal(error.code,code);assert.equal(error.status,status);assert.equal(error.retryable,retryable);assert.ok(error.action.length>15);return true;};}
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

test("main document priority bypasses waiting resources but preserves four slots, FIFO classes and reservations",async()=>{
  const budget=new CaptureDownloadBudget(800,80,4),started:string[]=[],releases=new Map<string,()=>void>();
  const download=(name:string,priority:"document"|"resource"="resource")=>budget.run(async amount=>{
    started.push(name);assert.equal(amount,80);assert.ok(budget.snapshot().active<=4);assert.ok(budget.snapshot().usedBytes+budget.snapshot().reservedBytes<=800);
    await new Promise<void>(resolve=>releases.set(name,resolve));return{bytes:Buffer.alloc(10)};
  },priority);
  const active=Array.from({length:4},(_,index)=>download(`active-${index}`));
  const pending=[download("resource-1"),download("document-1","document"),download("resource-2"),download("document-2","document")];
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(started,["active-0","active-1","active-2","active-3"]);
  assert.deepEqual(budget.snapshot(),{active:4,pending:4,usedBytes:0,reservedBytes:320});
  for(let index=0;index<4;index++){
    releases.get(`active-${index}`)!();await active[index];await new Promise(resolve=>setImmediate(resolve));
  }
  assert.deepEqual(started.slice(4),["document-1","document-2","resource-1","resource-2"]);
  for(const name of started.slice(4))releases.get(name)!();await Promise.all(pending);
  assert.deepEqual(budget.snapshot(),{active:0,pending:0,usedBytes:80,reservedBytes:0});
});

test("only explicit speculative headers are blocked, not current-page RSC or ordinary requests",()=>{
  for(const headers of [{Purpose:"prefetch"},{"Sec-Purpose":"prefetch;prerender"},{"Next-Router-Prefetch":"1"},{"next-router-segment-prefetch":"/_tree"}])assert.equal(isSpeculativePrefetch(headers),true);
  for(const headers of [{},{RSC:"1"},{Purpose:"prefetching"},{"Sec-Purpose":"navigation"},{"next-router-prefetch":"0"},{"next-router-segment-prefetch":"0"}])assert.equal(isSpeculativePrefetch(headers),false);
});

test("ordinary subresources cannot consume the existing request allowance reserved for source documents and focused images",()=>{
  const budget=new CaptureRequestBudget();
  for(let i=0;i<468;i++)assert.equal(budget.admit("resource"),true);
  for(let i=0;i<500;i++)assert.equal(budget.admit("resource"),false);
  for(let i=0;i<3;i++)assert.equal(budget.admit("document"),true);
  for(let i=0;i<24;i++)assert.equal(budget.admit("focused"),true);
  assert.equal(budget.snapshot().requests,495);
  for(let i=0;i<5;i++)assert.equal(budget.admit("focused"),true);
  for(const kind of ["document","focused","resource"] as const)assert.equal(budget.admit(kind),false);
  assert.equal(budget.snapshot().requests,500);assert.equal(budget.snapshot().ordinaryRequests,468);
});

test("partial guide artifacts stop recapture before browser/network/selector work and insufficient evidence stops research",async()=>{
  for(const marker of [GUIDE_PREFIX_PATH,GUIDE_CATALOG_PATH,GUIDE_SELECTION_PATH,GUIDE_SELECTION_STATE_PATH,GUIDE_FOLLOWUP_STATE_PATH]){
    const path=await fixture();await writeFile(join(path,marker),"{}");let touched=false;
    await assert.rejects(assertNoPartialGuideCapture(path),issue("partial_guide_capture","needs_review"));
    await assert.rejects(captureProduct("https://product.example/",path,{persist:async()=>{touched=true;},download:async()=>{touched=true;throw Error("must not download");},guideSelection:async()=>{touched=true;throw Error("must not select");}}),issue("partial_guide_capture","needs_review"));
    assert.equal(touched,false);
  }
  const choice:GuideChoice={version:1,decision:"insufficient",guideId:"",sourceAssetIds:[],intent:"",missingEvidence:[],reason:"No matching control and guide."};
  assert.throws(()=>assertGuideSupportsResearch({text:"Saved prefix",assets:[],guideProposal:choice}),issue("insufficient_product_evidence"));
});

test("feature-demo URL ingestion preserves deterministic capture without a paid guide selector",async()=>{
  const workspace=await fixture(),persisted:string[]=[];
  const input:WorkerInput={jobId:"feature-capture",ownerId:"fixture",mode:"url",productUrl:"https://product.example/",videoType:"feature-demo",format:"16:9",files:[]};
  const hooks:Hooks={persist:async paths=>{persisted.push(...paths);},state:async()=>{},complete:async()=>{}};
  let captures=0;
  const evidence=await ingest(input,workspace,noProviders,hooks,{captureProduct:async(url,path,options)=>{
    captures++;assert.equal(url,input.productUrl);assert.equal(path,workspace);assert.equal(options?.guideSelection,undefined);assert.equal(options?.persist,undefined);
    return{url,text:"Existing feature demonstration capture.",assets:[{id:"capture-0",path:"assets/feature.png",kind:"image",usage:"output",rights:"Public source",width:800,height:600}],artifactPaths:[],uiSources:[]};
  }});
  assert.equal(captures,1);assert.equal(evidence.guideProposal,undefined);assert.ok(persisted.includes("analysis/evidence.json"));
});

test("uploaded product visuals retain existing URL enrichment while reference-only launches remain adaptive",()=>{
  const input:WorkerInput={jobId:"supplemented-capture",ownerId:"fixture",mode:"url",productUrl:"https://product.example/",videoType:"launch",format:"16:9",files:[]};
  const asset:WorkerInput["files"][number]={id:"product-screen",name:"product.png",kind:"asset",url:"https://uploads.example/product.png",mimeType:"image/png"};
  const reference:WorkerInput["files"][number]={id:"reference",name:"reference.mp4",kind:"reference",url:"https://uploads.example/reference.mp4",mimeType:"video/mp4"};
  assert.equal(usesAdaptiveGuideSelection(input),true);
  assert.equal(usesAdaptiveGuideSelection({...input,files:[asset]}),false);
  assert.equal(usesAdaptiveGuideSelection({...input,files:[reference,asset]}),false);
  assert.equal(usesAdaptiveGuideSelection({...input,files:[reference]}),true);
  const linkedReference:WorkerInput={...input,referenceUrl:reference.url};assert.equal(usesAdaptiveGuideSelection(linkedReference),true);
  assert.equal(usesAdaptiveGuideSelection({...input,videoType:"feature-demo"}),false);
  assert.equal(usesAdaptiveGuideSelection({...input,mode:"prd"}),false);
});

test("actual adaptive capture checkpoints prefix and exact guide before navigation while reserving a final UI inventory slot",{skip:!integration,timeout:45000},async()=>{
  const path=await fixture(),homepage="https://product.example/",requests:string[]=[],events:string[]=[];
  const panel=(id:string)=>`<div id='${id}' class='app-editor' style='width:800px;height:300px;background:#eee'><h2>Editor ${id}</h2><p>Compose a message.</p><button>Publish</button><p>Published message</p></div>`;
  const result=await captureProduct(homepage,path,{persist:async paths=>{for(const file of paths)await readFile(join(path,file));if(paths.includes(GUIDE_FOLLOWUP_STATE_PATH))events.push("checkpoint");else events.push("prefix");},guideSelection:async({evidence,catalog})=>{
    events.push("select");assert.ok(events.includes("prefix"));assert.ok(evidence.text.includes("Documentation index"));assert.equal(evidence.uiSources?.length,2);
    assert.ok(evidence.assets.some(asset=>asset.provenance?.pageKind==="docs"));
    const selected=catalog.entries.find(entry=>entry.url===homepage+"docs/workflow")!;assert.ok(selected);
    await new Promise(resolve=>setTimeout(resolve,5));
    return{version:1,decision:"capture-guide",guideId:selected.id,sourceAssetIds:["product-panel-0"],intent:"Publish the composed message",missingEvidence:["action","result"],reason:"This guide explains the visible Publish control."};
  },download:async(raw,maximum,_auth,_redirect,policy)=>{
    assert.ok(!policy||policy(new URL(raw)));requests.push(raw);
    if(raw===homepage+"docs/workflow"){assert.equal(events.at(-1),"checkpoint");const marker=JSON.parse(await readFile(join(path,GUIDE_FOLLOWUP_STATE_PATH),"utf8"));assert.equal(marker.selectedUrl,raw);events.push("guide");}
    const contents=raw===homepage?`<a href='/docs'>Documentation</a><a href='/pricing'>Pricing</a>${panel("one")}${panel("two")}`:raw===homepage+"docs"?`<h1>Documentation index</h1><a href='/docs/integration'>Integration sending</a><a href='/docs/workflow'>Publish a composed message</a>${panel("index")}`:panel("result");
    const bytes=Buffer.from(`<html><title>Product</title><body>${contents}<p>${"Documented product operation. ".repeat(20)}</p></body></html>`);assert.ok(bytes.length<=maximum);return{bytes,url:raw,status:200,contentType:"text/html",browserHeaders:{}};
  }});
  assert.deepEqual(requests,[homepage,homepage+"docs",homepage+"docs/workflow"]);
  assert.deepEqual(events.slice(-3),["select","checkpoint","guide"]);
  assert.equal(result.guideProposal?.decision,"capture-guide");assert.equal(result.assets.filter(asset=>asset.provenance?.role==="product-ui-candidate").length,4);
  assert.equal(result.uiSources.length,3);assert.ok(result.uiSources.some(source=>source.assetId==="research-2-panel-0"));
  const manifest=JSON.parse(await readFile(join(path,"analysis/research-sources.json"),"utf8"));
  assert.equal(manifest.sources.length,3);assert.equal(manifest.sources[2].status,"captured");assert.ok(manifest.selectionWaitMs>=5);assert.ok(manifest.activeCaptureMs<=30000);
  assert.ok(Number.isFinite(manifest.persistedTextWaitMs)&&manifest.persistedTextWaitMs>=0&&manifest.persistedTextWaitMs<=2*30000);
  assert.equal(manifest.elapsedMs,manifest.activeCaptureMs+manifest.selectionWaitMs+manifest.persistedTextWaitMs);
});

test("adaptive guide noncapture decisions and failed checkpoints never fall back to unrelated pricing",{skip:!integration,timeout:45000},async()=>{
  for(const decision of ["use-current","insufficient","checkpoint-failure","invalid-id","fetch-failure"] as const){
    const path=await fixture(),homepage="https://product.example/",requests:string[]=[];
    const operation=captureProduct(homepage,path,{persist:async paths=>{if(decision==="checkpoint-failure"&&paths.includes(GUIDE_FOLLOWUP_STATE_PATH))throw Error("checkpoint unavailable");},guideSelection:async({catalog})=>{
      const capture=["checkpoint-failure","invalid-id","fetch-failure"].includes(decision);
      return{version:1,decision:capture?"capture-guide":decision as "use-current"|"insufficient",guideId:capture?decision==="invalid-id"?"invented":catalog.entries[0].id:"",sourceAssetIds:capture?["capture-0"]:[],intent:capture?"Inspect visible result":"",missingEvidence:capture?["result"]:[],reason:"Bounded selection fixture."};
    },download:async(raw,_maximum,_auth,_redirect,policy)=>{
      assert.ok(!policy||policy(new URL(raw)));requests.push(raw);if(decision==="fetch-failure"&&raw===homepage+"docs/result")throw Error("Guide unavailable");
      const links=raw===homepage?"<a href='/docs'>Documentation</a><a href='/pricing'>Pricing</a>":"<a href='/docs/result'>Result guide</a>";
      const bytes=Buffer.from(`<html><title>Product</title><body>${links}<p>${"Visible public product evidence. ".repeat(20)}</p></body></html>`);return{bytes,url:raw,status:200,contentType:"text/html",browserHeaders:{}};
    }});
    if(decision==="checkpoint-failure"||decision==="invalid-id")await assert.rejects(operation,/checkpoint unavailable|unavailable observed guide/);
    else {const result=await operation;assert.equal(result.guideProposal?.decision,decision==="fetch-failure"?"capture-guide":decision);const manifest=JSON.parse(await readFile(join(path,"analysis/research-sources.json"),"utf8"));if(decision==="fetch-failure")assert.equal(manifest.sources[2].status,"failed");else assert.equal(manifest.sources.length,2);}
    assert.ok(!requests.includes(homepage+"pricing"));assert.deepEqual(requests,decision==="fetch-failure"?[homepage,homepage+"docs",homepage+"docs/result"]:[homepage,homepage+"docs"]);
  }
});

test("actual capture rejects delayed speculative fetches before reservation and retains selected research documents",{skip:!integration,timeout:45000},async()=>{
  const path=await fixture(),homepage="https://product.example/",requested:string[]=[],budget=new CaptureDownloadBudget(1_000_000,100_000,4);
  let transferred=0;
  const result=await captureProduct(homepage,path,{downloadBudget:budget,download:async(raw,maximum,_auth,_redirect,policy)=>{
    requested.push(raw);assert.ok(!policy||policy(new URL(raw)),"selected documents retain the public destination guard");
    if(raw.includes("/speculative/"))await new Promise(resolve=>setTimeout(resolve,250));
    const isHome=raw===homepage,isCurrent=raw.includes("/current-state");
    const script=isHome?`<script>for(let i=0;i<520;i++)fetch('/speculative/'+i+'?_rsc=fixture',{headers:i%2?{'Next-Router-Prefetch':'1',RSC:'1'}:{Purpose:'prefetch'}}).catch(()=>{});fetch('/current-state?_rsc=needed',{headers:{RSC:'1'}}).catch(()=>{});</script>`:"";
    const bytes=Buffer.from(isCurrent?"Current page data":`<html><head><title>Public product fixture</title></head><body><h1>${isHome?"Product":"Guide"}</h1>${isHome?"<a href='/docs'>Documentation</a><a href='/pricing'>Pricing</a>":""}<p>${"Public product controls and the documented visible result. ".repeat(20)}</p>${script}</body></html>`);
    assert.ok(bytes.length<=maximum);transferred+=bytes.length;return{bytes,url:raw,status:200,contentType:isCurrent?"text/plain":"text/html",browserHeaders:{}};
  }});
  assert.ok(!requested.some(url=>url.includes("/speculative/")),"no speculative request reaches the downloader or reserves bytes");
  assert.ok(requested.includes(homepage+"current-state?_rsc=needed"),"ordinary RSC fetches remain available to the displayed page");
  assert.ok(requested.includes(homepage+"docs")&&requested.includes(homepage+"pricing"));
  const manifest=JSON.parse(await readFile(join(path,"analysis/research-sources.json"),"utf8"));
  assert.deepEqual(manifest.sources.map((source:{status:string})=>source.status),["captured","captured","captured"]);
  const diagnostics=JSON.parse(await readFile(join(path,"analysis/capture-diagnostics.json"),"utf8"));
  assert.equal(diagnostics.scheduling.blockedPrefetches,520);
  assert.equal(diagnostics.bytes,transferred);assert.equal(diagnostics.scheduling.usedBytes,transferred);
  assert.ok(diagnostics.requests<=500);assert.ok(diagnostics.scheduling.documentTimings.length<=8);assert.ok(diagnostics.scheduling.resourceTimings.length<=16);
  assert.deepEqual(diagnostics.scheduling.documentTimings.map((timing:{url:string})=>timing.url),[homepage,homepage+"docs",homepage+"pricing"]);
  assert.ok([...diagnostics.scheduling.documentTimings,...diagnostics.scheduling.resourceTimings].every(timing=>timing.queueMs>=0&&timing.downloadMs>=0&&timing.state==="downloaded"&&!timing.url.includes("?")));
  assert.ok(result.text.includes("Source page: "+homepage+"docs"));
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
