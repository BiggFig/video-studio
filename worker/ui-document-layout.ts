import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { geistFontBase64 } from "./assets/geist-font";
import { mediaEnvironment } from "./media";
import { motionBrowserArgs, motionBrowserPath } from "./motion-browser";
import { uiStageViewport } from "./ui-camera";
import { uiCompositionCss, uiDocumentHtml } from "./ui-composition";
import { uiDocumentSchema, type UiDocument } from "./ui-reconstruction";
import { expectedUiState, type UiFrameState } from "./ui-state";
import { PipelineError } from "./types";

export type UiLayoutVariant = "compact" | "with-detail";
export type UiLayoutCode = "text_overflow" | "text_too_small" | "text_collision" | "element_outside_viewport" | "invalid_metrics";
export interface UiLayoutMetrics {
  fontSize:number; lineHeight:number; clientWidth:number; clientHeight:number; scrollWidth:number; scrollHeight:number;
  left:number; top:number; right:number; bottom:number;
  viewportLeft:number; viewportTop:number; viewportRight:number; viewportBottom:number;
  overlapWidth:number; overlapHeight:number;
}
export interface UiLayoutIssue {
  documentId:string; stateId:string; elementId:string; layout:UiLayoutVariant; code:UiLayoutCode;
  otherElementId?:string;
  metrics:Partial<UiLayoutMetrics>;
}
export interface UiTextBounds { left:number;top:number;right:number;bottom:number }
export interface UiLayoutMeasurement { elementId:string; visible:boolean; hasText:boolean; metrics:Omit<UiLayoutMetrics,"overlapWidth"|"overlapHeight">; textBounds?:UiTextBounds[] }
export interface UiLayoutReport {
  version:1; completed:boolean; passed:boolean; width:number; height:number; checkedStates:number; checkedElements:number;
  infrastructureFailure?:boolean;
  issueCount:number; issuesTruncated:boolean; issues:UiLayoutIssue[];
  stateChecks:{documentId:string;stateId:string;layout:UiLayoutVariant;visibleElements:number;issueCount:number;passed:boolean}[];
}
export interface UiLayoutResult { passed:boolean; reportPath:string; artifactPaths:string[]; issues:UiLayoutIssue[] }
export interface UiLayoutOptions { workspace:string; width:number; height:number; reportName:string }

const MAX_ISSUES=64, MAX_FAILURE_IMAGES=4, WALL_MS=45_000;
const metricKeys:(keyof UiLayoutMeasurement["metrics"])[]=["fontSize","lineHeight","clientWidth","clientHeight","scrollWidth","scrollHeight","left","top","right","bottom","viewportLeft","viewportTop","viewportRight","viewportBottom"];
const validNumber=(value:unknown):value is number=>typeof value==="number"&&Number.isFinite(value)&&Math.abs(value)<=1_000_000;

/** The same wide-state readability/bounds tolerances used by scene preflight. */
export function assessUiLayoutElement(value:UiLayoutMeasurement,context:Omit<UiLayoutIssue,"code"|"metrics">):UiLayoutIssue[]{
  if(!value.visible)return[];
  const metrics:Partial<UiLayoutMetrics>={};
  for(const key of metricKeys)if(validNumber(value.metrics[key]))metrics[key]=Math.round(value.metrics[key]*1000)/1000;
  // SVG edges carry no text and may legitimately report line-height:normal. Scene
  // preflight applies only bounds to empty structural elements, not font/readability.
  const required=value.hasText?metricKeys:metricKeys.filter(key=>["left","top","right","bottom","viewportLeft","viewportTop","viewportRight","viewportBottom"].includes(key));
  if(required.some(key=>!validNumber(value.metrics[key])))return[{...context,code:"invalid_metrics",metrics}];
  const m=value.metrics,codes:UiLayoutCode[]=[];
  if(value.hasText&&(m.scrollWidth>m.clientWidth+2||m.scrollHeight>m.clientHeight+2))codes.push("text_overflow");
  if(value.hasText&&m.fontSize<16)codes.push("text_too_small");
  if(m.left<m.viewportLeft-2||m.top<m.viewportTop-2||m.right>m.viewportRight+2||m.bottom>m.viewportBottom+2)codes.push("element_outside_viewport");
  return codes.map(code=>({...context,code,metrics}));
}

/** Full snapshots, including selected styles and overrides; earlier states cannot leak. */
export function uiDocumentLayoutStates(document:UiDocument):{stateId:string;state:UiFrameState}[]{
  return document.states.map(state=>({stateId:state.id,state:expectedUiState(document,[{kind:"state",atFrame:30,durationFrames:1,stateId:state.id,evidenceId:state.evidenceIds[0]}],31)}));
}

/** Compare browser text-run bounds, never element/background rectangles or blank space. */
export function assessUiTextCollisions(values:UiLayoutMeasurement[],context:{documentId:string;stateId:string;layout:UiLayoutVariant}):UiLayoutIssue[]{
  const visible=values.filter(value=>value.visible&&value.hasText),issues:UiLayoutIssue[]=[];
  if(values.length>48||visible.some(value=>!Array.isArray(value.textBounds)||value.textBounds.length>1024)||visible.reduce((sum,value)=>sum+value.textBounds!.length,0)>8192)throw new Error("UI layout browser metrics are invalid");
  for(const value of visible)for(const rect of value.textBounds!)if(![rect.left,rect.top,rect.right,rect.bottom].every(validNumber)||rect.right<rect.left||rect.bottom<rect.top)throw new Error("UI layout browser metrics are invalid");
  for(let a=0;a<visible.length;a++)for(let b=a+1;b<visible.length;b++){
    let overlap:{width:number;height:number}|undefined;
    for(const first of visible[a].textBounds||[]){
      for(const second of visible[b].textBounds||[]){
        const width=Math.min(first.right,second.right)-Math.max(first.left,second.left),height=Math.min(first.bottom,second.bottom)-Math.max(first.top,second.top);
        // Range font boxes are not exact raster ink; allow 2px edge contact,
        // matching the existing overflow/bounds tolerance.
        if(width>2&&height>2){overlap={width,height};break;}
      }
      if(overlap)break;
    }
    if(overlap)issues.push({...context,elementId:visible[a].elementId,otherElementId:visible[b].elementId,code:"text_collision",metrics:{overlapWidth:Math.round(overlap.width*1000)/1000,overlapHeight:Math.round(overlap.height*1000)/1000}});
  }
  return issues;
}

/** Self-contained trusted browser callback shared by document and final-frame checks. */
export function measureUiLayout(container:Element):UiLayoutMeasurement[]{
  type Rect={left:number;top:number;right:number;bottom:number};
  const rect=(value:DOMRect):Rect=>({left:value.left,top:value.top,right:value.right,bottom:value.bottom});
  const intersect=(a:Rect,b:Rect):Rect|undefined=>{const r={left:Math.max(a.left,b.left),top:Math.max(a.top,b.top),right:Math.min(a.right,b.right),bottom:Math.min(a.bottom,b.bottom)};return r.right>r.left&&r.bottom>r.top?r:undefined;};
  const subtract=(a:Rect,b:Rect):Rect[]=>{
    const cut=intersect(a,b);if(!cut)return[a];
    return[{left:a.left,top:a.top,right:a.right,bottom:cut.top},{left:a.left,top:cut.bottom,right:a.right,bottom:a.bottom},{left:a.left,top:cut.top,right:cut.left,bottom:cut.bottom},{left:cut.right,top:cut.top,right:a.right,bottom:cut.bottom}].filter(r=>r.right>r.left&&r.bottom>r.top);
  };
  const alpha=(color:string)=>{const match=/^rgba?\(([^)]+)\)$/.exec(color);return match?(match[1].split(",").length===4?Number(match[1].split(",")[3]):1):0;};
  const viewport=container.parentElement!.getBoundingClientRect(),clip=intersect(rect(viewport),rect(container.getBoundingClientRect()));
  const nodes=[...container.querySelectorAll<HTMLElement>("[data-ui-element]")].map(node=>({node,bounds:node.getBoundingClientRect(),style:getComputedStyle(node)}));
  if(nodes.length>48)throw new Error("UI layout text measurement exceeds its bound");
  let ancestorPainted=true;
  for(let ancestor:Element|null=container;ancestor;ancestor=ancestor.parentElement){const style=getComputedStyle(ancestor);if(style.visibility!=="visible"||style.display==="none"||Number(style.opacity)===0)ancestorPainted=false;}
  return nodes.map(({node,bounds,style},index)=>{
    const text=node.querySelector("[data-ui-text]"),visible=ancestorPainted&&style.visibility==="visible"&&style.display!=="none"&&Number(style.opacity)>0;
    let textBounds:Rect[]=[];
    if(visible&&text&&alpha(style.color)>0&&clip){
      const ownClip=intersect(clip,rect(bounds)),walker=document.createTreeWalker(text,NodeFilter.SHOW_TEXT);
      if(ownClip)for(let child=walker.nextNode();child;child=walker.nextNode()){
        // Non-whitespace runs avoid treating an element, a stretched flex span,
        // inter-word blanks, or the gap between wrapped lines as text coverage.
        for(const match of child.textContent!.matchAll(/\S+/gu)){
          const range=document.createRange();range.setStart(child,match.index!);range.setEnd(child,match.index!+match[0].length);
          for(const fragment of range.getClientRects()){const bounded=intersect(rect(fragment),ownClip);if(bounded)textBounds.push(bounded);}
        }
      }
      // Later opaque surfaces may legitimately cover earlier source text (e.g.
      // a dropdown). Only guaranteed opaque strips of rounded boxes occlude;
      // transparent panels and all element backgrounds never become text pairs.
      for(const later of nodes.slice(index+1)){
        if(later.style.visibility!=="visible"||later.style.display==="none"||Number(later.style.opacity)!==1||alpha(later.style.backgroundColor)!==1)continue;
        const scale=later.bounds.width/later.node.offsetWidth,edge=Math.max(Number.parseFloat(later.style.borderLeftWidth),Number.parseFloat(later.style.borderTopWidth))*scale;
        const r={left:later.bounds.left+edge,top:later.bounds.top+edge,right:later.bounds.right-edge,bottom:later.bounds.bottom-edge};
        const radius=Math.min(Math.max(...[later.style.borderTopLeftRadius,later.style.borderTopRightRadius,later.style.borderBottomLeftRadius,later.style.borderBottomRightRadius].map(value=>Number.parseFloat(value)*scale)),(r.right-r.left)/2,(r.bottom-r.top)/2);
        for(const solid of[{...r,left:r.left+radius,right:r.right-radius},{...r,top:r.top+radius,bottom:r.bottom-radius}])if(solid.right>solid.left&&solid.bottom>solid.top){textBounds=textBounds.flatMap(fragment=>subtract(fragment,solid));if(textBounds.length>1024)throw new Error("UI layout text measurement exceeds its bound");}
      }
    }
    return{elementId:node.dataset.uiElement!,visible,hasText:!!text?.textContent,textBounds,metrics:{fontSize:Number.parseFloat(style.fontSize),lineHeight:Number.parseFloat(style.lineHeight),clientWidth:node.clientWidth,clientHeight:node.clientHeight,scrollWidth:node.scrollWidth,scrollHeight:node.scrollHeight,left:bounds.left,top:bounds.top,right:bounds.right,bottom:bounds.bottom,viewportLeft:viewport.left,viewportTop:viewport.top,viewportRight:viewport.right,viewportBottom:viewport.bottom}};
  });
}

/** Name annotations emitted by tsx are local to this trusted callback, never a page global. */
export const browserUiLayoutMeasurement: (container:Element)=>UiLayoutMeasurement[]=new Function(`return (container)=>{const __name=value=>value;return (${measureUiLayout.toString()})(container);}`)();

/** Invalid browser measurements must not become repairable when diagnostics saturate. */
export function recordUiLayoutState(report:UiLayoutReport,measurements:UiLayoutMeasurement[],context:{documentId:string;stateId:string;layout:UiLayoutVariant}):UiLayoutIssue[]{
  const issues=[...measurements.flatMap(value=>assessUiLayoutElement(value,{...context,elementId:value.elementId})),...assessUiTextCollisions(measurements,context)];
  if(issues.some(issue=>issue.code==="invalid_metrics"))throw new Error("UI layout browser metrics are invalid");
  report.checkedStates++;report.checkedElements+=measurements.filter(value=>value.visible).length;report.issueCount+=issues.length;
  report.issues.push(...issues.slice(0,Math.max(0,MAX_ISSUES-report.issues.length)));
  report.stateChecks.push({...context,visibleElements:measurements.filter(value=>value.visible).length,issueCount:issues.length,passed:issues.length===0});
  return issues;
}

function documentHtml(document:UiDocument,width:number,height:number,compact:boolean){
  const viewport=uiStageViewport(width,height,compact);
  // Only trusted CSS/font bytes and escaped uiDocumentHtml enter this page. No script tags.
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; script-src 'none'; connect-src 'none'; img-src 'none'; media-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"><style>@font-face{font-family:Studio;src:url('data:font/woff2;base64,${geistFontBase64}') format('woff2');font-weight:100 900;font-style:normal;font-display:block}*{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#0b0b0c;font-family:Studio,Arial,sans-serif;--line:#262626;--stage-bg:#0f0f0f;--accent:#7c3aed}${uiCompositionCss}.ui-demo-stage{left:${viewport.left}px;top:${viewport.top}px;width:${viewport.width}px;height:${viewport.height}px;opacity:1;overflow:hidden;border-radius:18px}.ui-document{transform-origin:50% 50%}.ui-pointer{display:none}</style></head><body>${uiDocumentHtml(document,0,viewport)}</body></html>`;
}

function checkInput(documents:UiDocument[],options:UiLayoutOptions){
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(options.reportName))throw new Error("Invalid UI layout report name");
  if(![[1920,1080],[1080,1920],[1080,1080]].some(([width,height])=>width===options.width&&height===options.height))throw new Error("Unsupported UI layout canvas");
  // Parse at call time: ui-reconstruction may import this inspector for its durable stage.
  const parsed=uiDocumentSchema.array().min(1).max(2).parse(documents);
  if(new Set(parsed.map(document=>document.id)).size!==parsed.length)throw new Error("Duplicate UI layout document");
  for(const document of parsed){
    if(Buffer.byteLength(JSON.stringify(document),"utf8")>32_000)throw new Error("UI layout document exceeds its bound");
    const ids=new Set(document.elements.map(element=>element.id));
    if(ids.size!==document.elements.length||new Set(document.states.map(state=>state.id)).size!==document.states.length)throw new Error("Duplicate UI layout identity");
    for(const state of document.states)if([...state.visibleElementIds,...state.selectedElementIds,...state.textValues.map(value=>value.elementId)].some(id=>!ids.has(id)))throw new Error("UI layout state references a missing element");
  }
  return parsed;
}

/**
 * Early geometry gate only, not source-fidelity/transition QC. Inspect both permitted UI
 * stages because scripting has not yet chosen whether the scene includes detail copy.
 * Every declared state is checked without changing text, styles, geometry or provenance.
 */
export async function inspectUiDocumentLayout(documents:UiDocument[],options:UiLayoutOptions):Promise<UiLayoutResult>{
  const parsed=checkInput(documents,options),reportPath=`analysis/${options.reportName}.json`,artifactPaths:string[]=[];
  await mkdir(join(options.workspace,"analysis"),{recursive:true});
  if(await stat(join(options.workspace,reportPath)).catch(()=>null))throw new Error("UI layout report already exists");
  let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;void browser?.close().catch(()=>{});},WALL_MS);timer.unref();
  const report:UiLayoutReport={version:1,completed:false,passed:false,width:options.width,height:options.height,checkedStates:0,checkedElements:0,issueCount:0,issuesTruncated:false,issues:[],stateChecks:[]};
  try{
    browser=await chromium.launch({headless:true,executablePath:motionBrowserPath(),args:motionBrowserArgs,env:mediaEnvironment(),timeout:20_000});
    const context=await browser.newContext({viewport:{width:options.width,height:options.height},deviceScaleFactor:1,serviceWorkers:"block"});
    await context.route("**/*",route=>route.abort());
    const page=await context.newPage();page.setDefaultTimeout(8_000);page.setDefaultNavigationTimeout(8_000);
    for(const uiDocument of parsed)for(const compact of [true,false]){
      if(timedOut)throw new Error("UI layout deadline exceeded");
      const layout:UiLayoutVariant=compact?"compact":"with-detail";
      await page.setContent(documentHtml(uiDocument,options.width,options.height,compact),{waitUntil:"load"});
      const loaded=await page.evaluate(async()=>{const faces=await document.fonts.load('16px Studio');await document.fonts.ready;return faces.length>0&&document.fonts.check('16px Studio');});
      if(!loaded)throw new Error("Trusted UI font did not load");
      for(const {stateId,state}of uiDocumentLayoutStates(uiDocument)){
        if(timedOut)throw new Error("UI layout deadline exceeded");
        await page.evaluate(frame=>{
          const container=document.getElementById("ui-document-0")!;
          for(const node of container.querySelectorAll<HTMLElement>("[data-ui-element]")){
            const value=frame.elements[node.dataset.uiElement!];
            if(!value)throw new Error("Missing trusted UI state element");
            node.style.visibility=value.visible?"visible":"hidden";node.dataset.selected=String(value.selected);node.dataset.typing="false";node.dataset.textBasis=value.textBasis;
            const text=node.querySelector("[data-ui-text]");if(text)text.textContent=value.text;
          }
        },state);
        const measurements=await page.locator("#ui-document-0").evaluate(browserUiLayoutMeasurement);
        if(measurements.length!==uiDocument.elements.length||measurements.some(value=>!uiDocument.elements.some(element=>element.id===value.elementId)))throw new Error("UI layout measurement inventory changed");
        const issues=recordUiLayoutState(report,measurements,{documentId:uiDocument.id,stateId,layout});
        if(issues.length&&artifactPaths.length<MAX_FAILURE_IMAGES){
          const path=`analysis/${options.reportName}-failure-${artifactPaths.length+1}.png`;
          if(await stat(join(options.workspace,path)).catch(()=>null))throw new Error("UI layout evidence already exists");
          await page.screenshot({path:join(options.workspace,path)});artifactPaths.push(path);
        }
      }
    }
    if(timedOut)throw new Error("UI layout deadline exceeded");
    report.completed=true;report.passed=report.issueCount===0;report.issuesTruncated=report.issueCount>report.issues.length;
    await writeFile(join(options.workspace,reportPath),JSON.stringify(report,null,2),{flag:"wx"});artifactPaths.push(reportPath);
    return{passed:report.passed,reportPath,artifactPaths,issues:report.issues};
  }catch{
    report.completed=false;report.passed=false;report.infrastructureFailure=true;report.issuesTruncated=report.issueCount>report.issues.length;
    // Retain any trustworthy prior measurements, explicitly incomplete. Never
    // return this report as a repairable geometry refusal or overwrite old audit.
    await writeFile(join(options.workspace,reportPath),JSON.stringify(report,null,2),{flag:"wx"}).catch(()=>{});
    throw new PipelineError("ui_layout_unavailable","The trusted UI layout inspection could not complete.","Inspect the local browser/font runtime and retained artifacts before resuming. No layout pass was recorded.","needs_review");
  }finally{clearTimeout(timer);await browser?.close().catch(()=>{});}
}
