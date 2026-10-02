import { chromium } from "playwright";
import { mkdir,writeFile,readFile,copyFile,realpath,stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { dirname,extname,isAbsolute,join,relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { command,ffmpeg,frameIndex,hash,mediaEnvironment,probe,writeJson } from "./media";
import { safePath } from "./security";
import { motionHtml,motionSampleFrames,presentation,transitionFrames,MOTION_RENDERER_VERSION } from "./motion-composition";
import { geistFontBase64 } from "./assets/geist-font";
import { motionBrowserArgs,motionBrowserPath } from "./motion-browser";
import { motionAssetIds,motionUsage } from "./motion-assets";
import { logoGeometryMatches } from "./motion-primitives";
import { expectedUiState,uiActionSampleFrames } from "./ui-state";
import { expectedUiCamera,uiStageViewport } from "./ui-camera";
import { assessUiTextCollisions,browserUiLayoutMeasurement } from "./ui-document-layout";
import { PipelineError,type Hooks,type Plan } from "./types";

const require=createRequire(import.meta.url);
const here=dirname(fileURLToPath(import.meta.url));
export async function confinedMotionAsset(workspace:string,path:string){
  const root=await realpath(workspace),file=await realpath(safePath(root,path)),rel=relative(root,file);
  if(rel.startsWith("..")||isAbsolute(rel)||(await stat(file)).isFile()!==true)throw new Error("Motion asset escapes workspace or is not a file");
  return file;
}
export async function prepareMotionProject(plan:Plan,workspace:string,pass:number){
  const directory=`project/motion-${pass}`,root=join(workspace,directory),assets:Record<string,string>={},paths:string[]=[],sourceHashes:Record<string,string>={};
  await mkdir(join(root,"assets"),{recursive:true});
  for(const id of motionAssetIds(plan)){
    const asset=plan.assets.find(a=>a.id===id);
    if(!asset||asset.usage!=="output"||!["image","video"].includes(asset.kind))throw new Error("Motion renderer rejected non-output visual");
    const source=await confinedMotionAsset(workspace,asset.path),extension=extname(source).toLowerCase();
    if(![".png",".jpg",".jpeg",".webp",".mp4",".mov",".webm"].includes(extension))throw new Error("Unsupported normalized motion source format");
    const target=`assets/media-${Object.keys(assets).length}${extension}`;await copyFile(source,join(root,target));assets[id]=target;sourceHashes[id]=await hash(source);paths.push(`${directory}/${target}`);
  }
  await writeFile(join(root,"assets/Geist.woff2"),Buffer.from(geistFontBase64,"base64"));
  await copyFile(require.resolve("gsap/dist/gsap.min.js"),join(root,"assets/gsap.min.js"));
  await copyFile(join(here,"assets/Geist-LICENSE.txt"),join(root,"assets/Geist-LICENSE.txt"));
  await writeFile(join(root,"index.html"),motionHtml(plan,assets));
  await writeJson(join(root,"timeline.json"),{version:MOTION_RENDERER_VERSION,output:plan.output,sourceHashes,...(plan.uiDocuments?{uiDocuments:plan.uiDocuments}:{}),scenes:plan.scenes.map((s,i)=>({id:s.id,startFrame:s.start_frame,durationFrames:s.duration_frames,...motionUsage(s,plan),...(s.presentation?.visual?.kind==="ui-demo"?{actions:s.presentation.visual.actions,actionSamples:uiActionSampleFrames(s)}:{}),transitionFrames:transitionFrames(s,plan,i),samples:motionSampleFrames(s,plan,i)}))});
  await writeFile(join(root,"README.txt"),"Editable HTML motion composition. Serve this directory with a local static server; open index.html. All assets are local. In the browser console await window.__studioReady; await window.__studio.seekFrame(90). Every frame uses a paused GSAP timeline at 30 fps. Preview playback may advance this API, but export does not use wall-clock time. Source visuals are unmodified local copies. UI demonstrations use source-grounded HTML reconstructions and illustrative interactions; they are not recordings of an actual session. Their document, actions and source hashes are retained in timeline.json and plan.json. No audio is included in this picture composition; the retained production audio mix is applied separately.\n");
  paths.push(...["assets/Geist.woff2","assets/Geist-LICENSE.txt","assets/gsap.min.js","index.html","timeline.json","README.txt"].map(p=>`${directory}/${p}`));
  return {directory,root,paths,sourceHashes};
}
/** An exact allowlist, not a general filesystem server. Supports video range seeks. */
export async function serveMotionProject(root:string,relativePaths:string[]){
  const allowed=new Map<string,string>();for(const path of relativePaths)allowed.set("/"+path,await confinedMotionAsset(root,path));
  const server=createServer(async(req,res)=>{try{
    const path=new URL(req.url||"/","http://localhost").pathname,file=allowed.get(path==="/"?"/index.html":path);
    if(req.method!=="GET"||!file){res.writeHead(404).end();return;}
    const size=(await stat(file)).size,extension=extname(file),mime=({".html":"text/html; charset=utf-8",".js":"application/javascript",".woff2":"font/woff2",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".mp4":"video/mp4",".mov":"video/quicktime",".webm":"video/webm"} as Record<string,string>)[extension]||"application/octet-stream";
    const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||""),start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),size-1):size-1;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start<0||end>=size){res.writeHead(416).end();return;}
    res.writeHead(range?206:200,{"Content-Type":mime,"Content-Length":end-start+1,"Accept-Ranges":"bytes",...(range?{"Content-Range":`bytes ${start}-${end}/${size}`}:{})});createReadStream(file,{start,end}).on("error",()=>res.destroy()).pipe(res);
  }catch{res.writeHead(500).end();}});
  await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
  const address=server.address();if(!address||typeof address==="string")throw new Error("Local composition server failed");
  return {origin:`http://127.0.0.1:${address.port}`,close:async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
export async function inspectMotionProject(plan:Plan,workspace:string,project:Awaited<ReturnType<typeof prepareMotionProject>>){
  const server=await serveMotionProject(project.root,project.paths.map(p=>p.slice(project.directory.length+1)));
  let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
  const findings:unknown[]=[],screenshots:string[]=[];
  try{
    browser=await chromium.launch({headless:true,executablePath:motionBrowserPath(),args:motionBrowserArgs,env:mediaEnvironment()});
    const page=await browser.newPage({viewport:{width:plan.output.width,height:plan.output.height},deviceScaleFactor:1});
    await page.route("**/*",route=>new URL(route.request().url()).origin===server.origin?route.continue():route.abort());
    await page.goto(server.origin);await page.evaluate(()=>((window as unknown as {__studioReady:Promise<unknown>}).__studioReady));
    const seek=async(frame:number)=>page.evaluate(async n=>{await (window as unknown as {__studio:{seekFrame(frame:number):Promise<void>}}).__studio.seekFrame(n);},frame);
    for(const [index,scene]of plan.scenes.entries()){
      const hold=motionSampleFrames(scene,plan,index)[2];await seek(hold);
      const inspection=await page.locator(`#scene-${index} [data-essential]`).evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return{text:e.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,font:Number.parseFloat(getComputedStyle(e).fontSize),overflow:e.scrollWidth>e.clientWidth+2};}));
      const boundsPassed=inspection.length>0&&inspection.every(r=>r.x>=32&&r.y>=32&&r.right<=plan.output.width-32&&r.bottom<=plan.output.height-32&&!r.overflow&&r.font>=26);
      const overlaps=inspection.some((a,i)=>inspection.slice(i+1).some(b=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>3&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>3));
      const proof=await page.locator(`#scene-${index} [data-proof]`).evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
      const proofOverlap=proof.some(a=>inspection.some(b=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>3&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>3));
      const logos=await page.locator(`#scene-${index} [data-brand-mark]`).evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,decoded:(e as HTMLImageElement).complete&&(e as HTMLImageElement).naturalWidth>0};}));
      const logoAsset=plan.assets.find(asset=>asset.id===motionUsage(scene,plan).logoAssetId);
      const logoBounds=logos.every(r=>r.decoded&&r.x>=32&&r.y>=32&&r.right<=plan.output.width-32&&r.bottom<=plan.output.height-32&&!!logoAsset&&logoGeometryMatches(logoAsset,plan.output.width,r));
      const logoOverlap=logos.some(a=>inspection.some(b=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>3&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>3));
      findings.push({scene:scene.id,frame:hold,...motionUsage(scene,plan),inspection,proof,logos,boundsPassed,overlaps,proofOverlap,logoBounds,logoOverlap,passed:boundsPassed&&!overlaps&&!proofOverlap&&logoBounds&&!logoOverlap});
      await writeJson(join(workspace,"analysis/layout.json"),findings);
      if(!boundsPassed||overlaps||proofOverlap||!logoBounds||logoOverlap)throw new PipelineError("copy_overflow","Essential motion copy or branding does not fit a readable, non-overlapping hold.","The retained composition needs shorter copy or an internal layout repair.","needs_review");
      const screenshot=`${project.directory}/hold-${index}.png`;await page.screenshot({path:join(workspace,screenshot)});screenshots.push(screenshot);
      const visual=scene.presentation?.visual;
      if(visual?.kind==="ui-demo"){
        const document=plan.uiDocuments!.find(document=>document.id===visual.documentId)!;
        for(const frame of [...new Set([scene.start_frame,scene.start_frame+Math.min(29,scene.duration_frames-1),...uiActionSampleFrames(scene),hold])]){
          await seek(frame);const expected=expectedUiState(document,visual.actions,frame-scene.start_frame),camera=expectedUiCamera(document,visual.actions,frame-scene.start_frame,uiStageViewport(plan.output.width,plan.output.height,!scene.detail),!!(plan.creativeDirection&&scene.direction&&!scene.preserve_audio));
          const actual=await page.locator(`#ui-document-${index}`).evaluate(container=>{const v=container.parentElement!.getBoundingClientRect(),matrix=new DOMMatrix(getComputedStyle(container).transform);return{stateId:(container as HTMLElement).dataset.uiState,basis:(container as HTMLElement).dataset.uiBasis,camera:{x:matrix.e,y:matrix.f,scale:matrix.a},viewport:{left:v.left,top:v.top,right:v.right,bottom:v.bottom},elements:[...container.querySelectorAll('[data-ui-element]')].map(element=>{const node=element as HTMLElement,text=node.querySelector('[data-ui-text]'),bounds=node.getBoundingClientRect();return{id:node.dataset.uiElement!,text:text?.textContent||"",textBasis:node.dataset.textBasis,visible:node.style.visibility==="visible",selected:node.dataset.selected==="true",typing:node.dataset.typing==="true",overflow:!!text&&(node.scrollWidth>node.clientWidth+2||node.scrollHeight>node.clientHeight+2),font:Number.parseFloat(getComputedStyle(node).fontSize),left:bounds.left,top:bounds.top,right:bounds.right,bottom:bounds.bottom};})};});
          const matches=actual.stateId===expected.stateId&&actual.basis===expected.basis&&actual.elements.length===document.elements.length&&actual.elements.every(value=>{const state=expected.elements[value.id];return !!state&&state.text===value.text&&state.textBasis===value.textBasis&&state.visible===value.visible&&state.selected===value.selected&&state.typing===value.typing;});
          const targetIds=new Set(visual.actions.flatMap(action=>action.targetId?[action.targetId]:[])),viewport=actual.viewport;
          const inside=(value:{left:number;top:number;right:number;bottom:number})=>value.left>=viewport.left-2&&value.top>=viewport.top-2&&value.right<=viewport.right+2&&value.bottom<=viewport.bottom+2;
          const readable=actual.elements.every(value=>!value.visible||((!value.text||(!value.overflow&&value.font>=16))&&((camera.phase!=="wide"&&!targetIds.has(value.id))||inside(value))));
          const cameraMatches=Math.abs(actual.camera.x-camera.x)<.001&&Math.abs(actual.camera.y-camera.y)<.001&&Math.abs(actual.camera.scale-camera.scale)<.00001;
          const cameraBounds=viewport.left>=24&&viewport.top>=24&&viewport.right<=plan.output.width-24&&viewport.bottom<=plan.output.height-24&&!inspection.some(copy=>Math.min(viewport.right,copy.right)-Math.max(viewport.left,copy.x)>3&&Math.min(viewport.bottom,copy.bottom)-Math.max(viewport.top,copy.y)>3);
          const textCollisions=plan.production?.workflowCoherence?.version===2?assessUiTextCollisions(await page.locator(`#ui-document-${index}`).evaluate(browserUiLayoutMeasurement),{documentId:document.id,stateId:expected.stateId,layout:scene.detail?"with-detail":"compact"}):[];
          findings.push({scene:scene.id,frame,uiDocumentId:document.id,expected,camera,actual,matches,readable,cameraMatches,cameraBounds,...(plan.production?.workflowCoherence?.version===2?{textCollisions}:{}),passed:matches&&readable&&cameraMatches&&cameraBounds&&textCollisions.length===0});await writeJson(join(workspace,"analysis/layout.json"),findings);
          if(textCollisions.length)throw new PipelineError("ui_text_collision","Distinct reconstructed UI labels overlap in a rendered action or hold.","Inspect the retained text-pair measurements. Preserve source wording and separate the actual text bounds; no layout was changed automatically.","needs_review");
          if(!matches||!readable||!cameraMatches||!cameraBounds)throw new PipelineError("ui_state_mismatch","The reconstructed UI did not reach its planned readable frame state and camera bounds.","Inspect the retained document, frame state and layout measurements.","needs_review");
          const sample=`${project.directory}/ui-${index}-${frame}.png`;await page.screenshot({path:join(workspace,sample)});screenshots.push(sample);
        }
      }
    }
    // Seek away and back: identical pixels prove the same clock can be replayed.
    const frame=Math.min(45,plan.output.duration_frames-1);await seek(frame);const first=await page.screenshot();await seek(plan.output.duration_frames-1);await seek(frame);const again=await page.screenshot();
    const digest=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex"),deterministic=digest(first)===digest(again);
    await writeJson(join(workspace,`${project.directory}/seek-check.json`),{frame,first:digest(first),repeated:digest(again),deterministic});
    if(!deterministic)throw new PipelineError("nondeterministic_motion","Repeated frame seeking produced different pixels.","The motion composition requires an internal renderer repair.","needs_review");
    return [...screenshots,`${project.directory}/seek-check.json`];
  }finally{try{await browser?.close();}finally{await server.close();}}
}
export async function renderMotionPicture(plan:Plan,workspace:string,pass:number,hooks?:Hooks){
  const started=Date.now(),project=await prepareMotionProject(plan,workspace,pass),raw=`${project.directory}/picture-raw.mp4`,path=`${project.directory}/picture.mp4`;
  await hooks?.persist(project.paths);
  let inspected:string[]=[];
  try{inspected=await inspectMotionProject(plan,workspace,project);}catch(error){if(await stat(join(workspace,"analysis/layout.json")).catch(()=>null))await hooks?.persist(["analysis/layout.json"]);throw error;}
  await hooks?.persist([...inspected,"analysis/layout.json"]);
  const args=["--import","tsx",join(here,"motion-cli.ts"),"render",project.root,"--fps","30","--quality","delivery","--workers","1","--crf","19","--video-frame-format","png","--no-browser-gpu","--frames-cache-dir","off","--output",join(workspace,raw)];
  let log:string;try{log=await command(process.execPath,args,1_200_000);}catch(error){await writeFile(join(project.root,"render.log"),String(error));await hooks?.persist([`${project.directory}/render.log`]);throw error;}
  await writeFile(join(project.root,"render.log"),log);await hooks?.persist([`${project.directory}/render.log`]);
  if(/sub_timeline_readiness_timeout|\[Browser:ERROR\]|correctness warnings/i.test(log))throw new PipelineError("motion_runtime_failed","The HTML rendering runtime reported a readiness or asset error.","Inspect the saved composition and render log; this output is not deliverable.","needs_review");
  // Hyperframes owns every visual frame. Audio remains owned by the existing mix.
  await command(ffmpeg,["-v","error","-y","-i",join(workspace,raw),"-map","0:v:0","-an","-c:v","copy","-movflags","+faststart",join(workspace,path)]);
  const media=await probe(join(workspace,path)),frames=Number(media.video?.nb_frames);
  if(media.width!==plan.output.width||media.height!==plan.output.height||media.video?.codec_name!=="h264"||media.video?.pix_fmt!=="yuv420p"||frames!==plan.output.duration_frames||Math.abs(media.duration-plan.output.duration_frames/30)>.05)throw new PipelineError("motion_export_mismatch","The HTML renderer did not produce the exact planned video frames.","Inspect the retained composition and render log.","needs_review");
  const comparisons=[];
  for(const [index,scene]of plan.scenes.entries()){
    const frame=motionSampleFrames(scene,plan,index)[2],decoded=`${project.directory}/decoded-hold-${index}.png`;
    await frameIndex(join(workspace,path),join(workspace,decoded),frame,plan.output.width);
    const result=await command(ffmpeg,["-hide_banner","-i",join(workspace,decoded),"-i",join(project.root,`hold-${index}.png`),"-filter_complex","[0:v]format=yuv420p[actual];[1:v]format=yuv420p[expected];[actual][expected]ssim","-frames:v","1","-f","null","-"]);
    const score=Number(/All:([0-9.]+)/.exec(result)?.[1]);comparisons.push({scene:scene.id,frame,ssim:score,passed:Number.isFinite(score)&&score>=.97});inspected.push(decoded);
    for(const actionFrame of uiActionSampleFrames(scene)){
      const actionDecoded=`${project.directory}/decoded-ui-${index}-${actionFrame}.png`;await frameIndex(join(workspace,path),join(workspace,actionDecoded),actionFrame,plan.output.width);
      const log=await command(ffmpeg,["-hide_banner","-i",join(workspace,actionDecoded),"-i",join(project.root,`ui-${index}-${actionFrame}.png`),"-filter_complex","[0:v]format=yuv420p[actual];[1:v]format=yuv420p[expected];[actual][expected]ssim","-frames:v","1","-f","null","-"]),ssim=Number(/All:([0-9.]+)/.exec(log)?.[1]);
      comparisons.push({scene:scene.id,frame:actionFrame,ssim,passed:Number.isFinite(ssim)&&ssim>=.97});inspected.push(actionDecoded);
    }
  }
  const report={renderer:MOTION_RENDERER_VERSION,hyperframes:"0.8.97",gsap:"3.14.2",planSha256:createHash("sha256").update(JSON.stringify(plan)).digest("hex"),elapsedSeconds:(Date.now()-started)/1000,frames,width:media.width,height:media.height,duration:media.duration,sourceHashes:project.sourceHashes,comparisons,passed:comparisons.every(x=>x.passed),localFontLoaded:true,localImagesDecoded:true,composition:project.directory};
  await writeJson(join(project.root,"render-report.json"),report);await writeJson(join(workspace,"analysis/motion.json"),report);
  await hooks?.persist([...inspected,`${project.directory}/render-report.json`,"analysis/motion.json"]);
  if(!report.passed)throw new PipelineError("motion_capture_mismatch","Decoded motion frames differ from the verified HTML composition holds.","Inspect the saved decoded holds, original HTML holds, and render report.","needs_review");
  return {path,artifacts:[...project.paths,...inspected,`${project.directory}/render.log`,`${project.directory}/render-report.json`,"analysis/motion.json"],directory:project.directory};
}
