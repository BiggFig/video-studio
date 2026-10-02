import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, realpath, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname,isAbsolute, join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { assessUiLayoutElement, assessUiTextCollisions, browserUiLayoutMeasurement, inspectUiDocumentLayout, recordUiLayoutState, uiDocumentLayoutStates, type UiLayoutMeasurement, type UiLayoutReport } from "./ui-document-layout";
import { chromium } from "playwright";
import { geistFontBase64 } from "./assets/geist-font";
import { motionBrowserArgs,motionBrowserPath } from "./motion-browser";
import { mediaEnvironment } from "./media";
import { prepareMotionProject,inspectMotionProject } from "./motion-render";
import { motionAssetIds } from "./motion-assets";
import type { Plan } from "./types";
import type { UiDocument } from "./ui-reconstruction";

const context={documentId:"doc",stateId:"observed",elementId:"label",layout:"compact" as const};
function measured():UiLayoutMeasurement{return{elementId:"label",visible:true,hasText:true,textBounds:[],metrics:{fontSize:16,lineHeight:20.8,clientWidth:100,clientHeight:24,scrollWidth:100,scrollHeight:24,left:10,top:10,right:110,bottom:34,viewportLeft:0,viewportTop:0,viewportRight:200,viewportBottom:200}};}
const codes=(value:UiLayoutMeasurement)=>assessUiLayoutElement(value,context).map(issue=>issue.code);
const paragraph="In Meditations on First Philosophy the philosopher René Descartes describes a series of doubts about the nature of reality, arriving at the famous phrase:";
function fixture():UiDocument{return{id:"document",sourceAssetIds:["source"],capabilityFactIds:["fact-1"],viewport:{width:500,height:385},styles:[{id:"text",fill:"transparent",color:"#eeeeee",borderColor:"transparent",fontSize:16,fontWeight:400,radius:0},{id:"large",fill:"#333333",color:"#eeeeee",borderColor:"transparent",fontSize:36,fontWeight:400,radius:0}],elements:[{id:"label",type:"text",rect:{x:22/500,y:18/385,width:456/500,height:28/385},styleId:"text",selectedStyleId:"large",text:"Source label",textBasis:"source-ui",sourceAssetId:"source",sourceRect:{x:0,y:0,width:1,height:.3},initiallyVisible:true}],states:[{id:"observed",basis:"observed",sourceAssetId:"source",evidenceIds:["fact-1"],visibleElementIds:["label"],selectedElementIds:[],textValues:[]}]};}
const integration={skip:process.env.STUDIO_UI_LAYOUT_INTEGRATION!=="1"?"Set STUDIO_UI_LAYOUT_INTEGRATION=1 with the pinned local Chromium":false,timeout:120_000};
async function workspace(t:{after:(fn:()=>Promise<void>)=>void}){const root=await realpath(tmpdir()),directory=await mkdtemp(join(root,"studio-ui-layout-"));t.after(async()=>{const path=await realpath(directory),rel=relative(root,path);assert.ok(!isAbsolute(rel)&&!rel.startsWith("..")&&rel.startsWith("studio-ui-layout-"));await rm(path,{recursive:true,force:true});});return directory;}

test("UI layout uses the scene preflight's exact text and viewport thresholds",()=>{
 const value=measured();value.metrics.scrollHeight=26;value.metrics.scrollWidth=102;assert.deepEqual(codes(value),[]);
 value.metrics.scrollHeight=26.01;assert.deepEqual(codes(value),["text_overflow"]);
 value.metrics.scrollHeight=24;value.metrics.fontSize=15.999;assert.deepEqual(codes(value),["text_too_small"]);
 value.metrics.fontSize=16;value.metrics.left=-2;value.metrics.right=202;assert.deepEqual(codes(value),[]);
 value.metrics.left=-2.001;assert.deepEqual(codes(value),["element_outside_viewport"]);
});

test("empty SVG elements require finite bounds but never a text line height; invisible states do not create false failures",()=>{
 const edge=measured();edge.hasText=false;edge.metrics.lineHeight=NaN;edge.metrics.fontSize=0;edge.metrics.scrollHeight=900;assert.deepEqual(codes(edge),[]);
 edge.metrics.right=NaN;const [issue]=assessUiLayoutElement(edge,context);assert.equal(issue.code,"invalid_metrics");assert.equal("right" in issue.metrics,false);assert.equal("lineHeight" in issue.metrics,false);
 const hidden=measured();hidden.visible=false;hidden.metrics.fontSize=2;hidden.metrics.left=-100;assert.deepEqual(codes(hidden),[]);
 const text=measured();text.metrics.lineHeight=NaN;assert.deepEqual(codes(text),["invalid_metrics"]);
});

test("safe diagnostics contain only bounded numeric metrics and trusted identities",()=>{
 const value=measured();value.metrics.scrollHeight=70.123456;const issue=assessUiLayoutElement(value,context)[0];
 assert.equal(issue.metrics.scrollHeight,70.123);assert.deepEqual(Object.keys(issue).sort(),["code","documentId","elementId","layout","metrics","stateId"]);
 assert.ok(Object.values(issue.metrics).every(value=>Number.isFinite(value)));assert.equal(JSON.stringify(issue).includes("Source label"),false);
 value.metrics.left=1e9;assert.equal(assessUiLayoutElement(value,context)[0].code,"invalid_metrics");
});

test("text collision pairs use actual fragments, ignore empty space/hidden backgrounds and retain safe bounded diagnostics",()=>{
 const a=measured(),b=measured();b.elementId="folder";
 a.textBounds=[{left:10,top:10,right:80,bottom:26},{left:10,top:36,right:60,bottom:52}];
 b.textBounds=[{left:20,top:28,right:50,bottom:34}];
 assert.deepEqual(assessUiTextCollisions([a,b],context),[]); // Inside the element, between painted lines.
 b.textBounds=[{left:20,top:23.12345,right:50,bottom:35}];
 assert.deepEqual(assessUiTextCollisions([a,b],context),[{documentId:"doc",stateId:"observed",layout:"compact",elementId:"label",otherElementId:"folder",code:"text_collision",metrics:{overlapWidth:30,overlapHeight:2.877}}]);
 b.textBounds=[{left:20,top:25,right:50,bottom:35}];assert.deepEqual(assessUiTextCollisions([a,b],context),[]);
 b.textBounds=a.textBounds;b.visible=false;assert.deepEqual(assessUiTextCollisions([a,b],context),[]);
 b.visible=true;b.hasText=false;assert.deepEqual(assessUiTextCollisions([a,b],context),[]);
 b.hasText=true;delete b.textBounds;assert.throws(()=>assessUiTextCollisions([a,b],context),/browser metrics/);
 b.textBounds=Array(1025).fill(a.textBounds![0]);assert.throws(()=>assessUiTextCollisions([a,b],context),/browser metrics/);
 b.textBounds=[{left:1e9,top:0,right:1e9+1,bottom:30}];assert.throws(()=>assessUiTextCollisions([a,b],context),/browser metrics/);
 b.textBounds=[{left:NaN,top:0,right:50,bottom:30}];assert.throws(()=>assessUiTextCollisions([a,b],context),/browser metrics/);
});

test("invalid metrics remain infrastructure failure after more than64 ordinary diagnostics",()=>{
 const report:UiLayoutReport={version:1,completed:false,passed:false,width:1920,height:1080,checkedStates:0,checkedElements:0,issueCount:0,issuesTruncated:false,issues:[],stateChecks:[]};
 const values=Array.from({length:33},(_,index)=>{const value=measured();value.elementId=`label-${index}`;value.metrics.fontSize=8;value.metrics.scrollHeight=100;return value;});
 recordUiLayoutState(report,values,{documentId:"doc",stateId:"first",layout:"compact"});assert.equal(report.issues.length,64);assert.equal(report.issueCount,66);
 const invalid=measured();invalid.metrics.left=NaN;
 assert.throws(()=>recordUiLayoutState(report,[invalid],{documentId:"doc",stateId:"later",layout:"compact"}),/browser metrics are invalid/);
 assert.equal(report.checkedStates,1);assert.equal(report.completed,false);assert.equal(report.passed,false);
});

test("every documented state resolves full text/selection/visibility snapshots without leaking or mutating source data",()=>{
 const doc=fixture();doc.states.push({id:"selected",basis:"illustrative",evidenceIds:["fact-1"],visibleElementIds:["label"],selectedElementIds:["label"],textValues:[{elementId:"label",text:"Illustrative input",textBasis:"example-content"}]},{id:"reset",basis:"illustrative",evidenceIds:["fact-1"],visibleElementIds:["label"],selectedElementIds:[],textValues:[]},{id:"hidden",basis:"illustrative",evidenceIds:["fact-1"],visibleElementIds:[],selectedElementIds:[],textValues:[]});
 const before=JSON.stringify(doc),states=uiDocumentLayoutStates(doc);assert.equal(states.length,4);assert.equal(states[1].state.elements.label.text,"Illustrative input");assert.equal(states[1].state.elements.label.selected,true);assert.equal(states[2].state.elements.label.text,"Source label");assert.equal(states[2].state.elements.label.selected,false);assert.equal(states[3].state.elements.label.visible,false);assert.equal(JSON.stringify(doc),before);
});

test("unsafe report names, unsupported geometry and oversized inventory fail before browser or filesystem work",async()=>{
 const options={workspace:"must-not-exist",reportName:"../outside",width:1920,height:1080};
 await assert.rejects(inspectUiDocumentLayout([fixture()],options),/report name/);
 await assert.rejects(inspectUiDocumentLayout([fixture()],{...options,reportName:"valid",width:NaN}),/canvas/);
 await assert.rejects(inspectUiDocumentLayout([fixture(),fixture(),fixture()],{...options,reportName:"valid"}));
 const invalid=fixture();invalid.states[0].visibleElementIds=["missing"];await assert.rejects(inspectUiDocumentLayout([invalid],{...options,reportName:"valid"}),/missing element/);
});

test("actual Chromium checks every state and both detail layouts in landscape, vertical and square",integration,async t=>{
 const directory=await workspace(t),doc=fixture();doc.states.push({id:"long",basis:"illustrative",evidenceIds:["fact-1"],visibleElementIds:["label"],selectedElementIds:[],textValues:[{elementId:"label",text:paragraph,textBasis:"example-content"}]},{id:"large",basis:"illustrative",evidenceIds:["fact-1"],visibleElementIds:["label"],selectedElementIds:["label"],textValues:[]},{id:"hidden",basis:"illustrative",evidenceIds:["fact-1"],visibleElementIds:[],selectedElementIds:[],textValues:[{elementId:"label",text:paragraph,textBasis:"example-content"}]});
 const before=JSON.stringify(doc);
 for(const [width,height]of [[1920,1080],[1080,1920],[1080,1080]]){
  const result=await inspectUiDocumentLayout([doc],{workspace:directory,width,height,reportName:`states-${width}-${height}`});assert.equal(result.passed,false);
  const report=JSON.parse(await readFile(join(directory,result.reportPath),"utf8")) as UiLayoutReport;assert.equal(report.checkedStates,8);
  for(const layout of ["compact","with-detail"]){assert.ok(report.stateChecks.find(state=>state.stateId==="observed"&&state.layout===layout)?.passed);assert.equal(report.stateChecks.find(state=>state.stateId==="long"&&state.layout===layout)?.passed,false);assert.equal(report.stateChecks.find(state=>state.stateId==="large"&&state.layout===layout)?.passed,false);assert.ok(report.stateChecks.find(state=>state.stateId==="hidden"&&state.layout===layout)?.passed);}
  assert.ok(result.issues.some(issue=>issue.stateId==="long"&&issue.code==="text_overflow"));assert.ok(result.issues.some(issue=>issue.stateId==="large"&&issue.code==="text_overflow"));assert.ok(result.artifactPaths.length<=5);
 }
 assert.equal(JSON.stringify(doc),before);
});

test("actual Chromium accepts visible source circles and SVG edges with normal line height",integration,async t=>{
 const directory=await workspace(t),doc=fixture();doc.styles.push({id:"dot",fill:"#ffffff",color:"#aaaaaa",borderColor:"transparent",fontSize:16,fontWeight:400,radius:1000});
 for(const [id,x]of [["a",.25],["b",.65]]as const)doc.elements.push({id,type:"node",rect:{x,y:.5,width:.03,height:.04},styleId:"dot",text:"",textBasis:"source-ui",sourceAssetId:"source",sourceRect:{x,y:.5,width:.03,height:.04},initiallyVisible:true});
 doc.elements.push({id:"edge",type:"edge",rect:{x:.2,y:.4,width:.6,height:.2},styleId:"dot",text:"",textBasis:"source-ui",sourceAssetId:"source",sourceRect:{x:.2,y:.4,width:.6,height:.2},initiallyVisible:true,fromId:"a",toId:"b"});doc.states[0].visibleElementIds.push("a","b","edge");
 const result=await inspectUiDocumentLayout([doc],{workspace:directory,width:1920,height:1080,reportName:"valid-svg"});assert.equal(result.passed,true);assert.deepEqual(result.issues,[]);
});

test("actual Chromium treats markup-looking source text as inert and never loads source asset URLs",integration,async t=>{
 const directory=await workspace(t),doc=fixture();doc.elements[0].text='<img src="https://invalid.example/x" onerror="alert(1)">';doc.elements[0].rect.height=.35;
 doc.sourceAssetIds=["https://invalid.example/source.png"];doc.elements[0].sourceAssetId=doc.sourceAssetIds[0];doc.states[0].sourceAssetId=doc.sourceAssetIds[0];
 const result=await inspectUiDocumentLayout([doc],{workspace:directory,width:1920,height:1080,reportName:"inert-text"});assert.equal(result.passed,true);
});

test("browser infrastructure failure produces an incomplete report and never a geometry result",integration,async t=>{
 const directory=await workspace(t),original=process.env.HYPERFRAMES_BROWSER_PATH;process.env.HYPERFRAMES_BROWSER_PATH=join(directory,"missing-browser.exe");
 try{await assert.rejects(inspectUiDocumentLayout([fixture()],{workspace:directory,width:1920,height:1080,reportName:"unavailable"}),(error:any)=>error.code==="ui_layout_unavailable"&&error.status==="needs_review");}finally{if(original===undefined)delete process.env.HYPERFRAMES_BROWSER_PATH;else process.env.HYPERFRAMES_BROWSER_PATH=original;}
 const report=JSON.parse(await readFile(join(directory,"analysis/unavailable.json"),"utf8")) as UiLayoutReport;assert.equal(report.completed,false);assert.equal(report.passed,false);assert.equal(report.infrastructureFailure,true);
});

test("saved trial5 exact UI fails before scripting; copied 48→72 box passes without rewriting source artifacts",{...integration,skip:process.env.STUDIO_UI_LAYOUT_INTEGRATION!=="1"?integration.skip:process.env.STUDIO_UI_LAYOUT_TRIAL5!=="1"?"Set STUDIO_UI_LAYOUT_TRIAL5=1 to inspect the retained local trial5 document":false},async t=>{
 const directory=await workspace(t),source=resolve('.local/engine-batch-acceptance-20261002e/analysis/ui.json'),bytes=await readFile(source),digest=(data:Buffer)=>createHash('sha256').update(data).digest('hex');
 const documents=(JSON.parse(bytes.toString()) as {documents:UiDocument[]}).documents;const before=JSON.stringify(documents);
 const invalid=await inspectUiDocumentLayout(documents,{workspace:directory,width:1920,height:1080,reportName:"actual-trial5"});assert.equal(invalid.passed,false);assert.ok(invalid.issues.some(issue=>issue.elementId==="prose-line1"&&issue.code==="text_overflow"));
 const copy=structuredClone(documents),paragraph=copy[0].elements.find(element=>element.id==="prose-line1")!;assert.equal(paragraph.rect.height*copy[0].viewport.height,48);paragraph.rect.height=72/copy[0].viewport.height;
 const valid=await inspectUiDocumentLayout(copy,{workspace:directory,width:1920,height:1080,reportName:"copied-height-only"});assert.equal(valid.passed,true);assert.equal(copy[0].styles.find(style=>style.id===paragraph.styleId)!.fontSize,16);assert.equal(JSON.stringify(documents),before);assert.equal(digest(await readFile(source)),digest(bytes));
 await assert.rejects(inspectUiDocumentLayout(copy,{workspace:directory,width:1920,height:1080,reportName:"copied-height-only"}),/already exists/);assert.ok((await stat(join(directory,invalid.reportPath))).size>0);
});


test("actual text runs allow multiline source labels, contained backgrounds and opaque source overlays",integration,async t=>{
 const directory=await workspace(t),doc=fixture();
 doc.elements[0].rect={x:.08,y:.10,width:.8,height:.7};doc.elements[0].text="First source line\nSecond source line";
 const label={...doc.elements[0],id:"separate-label",text:"Separate label",rect:{x:.1,y:.4,width:.7,height:.1}};
 doc.elements.unshift({...doc.elements[0],id:"background",type:"panel",text:"",rect:{x:0,y:0,width:1,height:1},styleId:"large"});
 doc.elements.push(label);doc.states[0].visibleElementIds=doc.elements.map(element=>element.id);
 // Element/span rectangles overlap; actual source text does not.
 const clean=await inspectUiDocumentLayout([doc],{workspace:directory,width:1920,height:1080,reportName:"multiline-layered"});assert.equal(clean.passed,true);
 doc.styles.push({...doc.styles[0],id:"opaque",fill:"#222222"});
 doc.elements.push({...label,id:"overlay",text:"",type:"panel",styleId:"opaque",rect:{...label.rect,x:.08,width:.8,height:.15}},{...label,id:"overlay-label",text:"Visible replacement"});
 doc.states[0].visibleElementIds=doc.elements.map(element=>element.id);
 const overlay=await inspectUiDocumentLayout([doc],{workspace:directory,width:1920,height:1080,reportName:"opaque-source-overlay"});assert.equal(overlay.passed,true);
 // Transparent source layering cannot conceal a real text collision.
 doc.elements.find(element=>element.id==="overlay")!.styleId="text";
 const collision=await inspectUiDocumentLayout([doc],{workspace:directory,width:1920,height:1080,reportName:"transparent-source-overlay"});assert.equal(collision.passed,false);assert.ok(collision.issues.some(issue=>issue.code==="text_collision"&&issue.elementId==="separate-label"&&issue.otherElementId==="overlay-label"));
});

test("retained h title/folder collisions reject in all aspect layouts; separate title lines pass without changing original evidence",{...integration,skip:process.env.STUDIO_UI_LAYOUT_INTEGRATION!=="1"?integration.skip:process.env.STUDIO_UI_LAYOUT_TRIAL_H!=="1"?"Set STUDIO_UI_LAYOUT_TRIAL_H=1 to inspect retained local trial h":false},async t=>{
 const directory=await workspace(t),source=resolve(".local/engine-batch-acceptance-20261002h/analysis/ui.json"),bytes=await readFile(source),documents=(JSON.parse(bytes.toString()) as {documents:UiDocument[]}).documents,before=JSON.stringify(documents);
 for(const [width,height]of [[1920,1080],[1080,1920],[1080,1080]]){
  const reportName=`trial-h-${width}-${height}`,result=await inspectUiDocumentLayout(documents,{workspace:directory,width,height,reportName});assert.equal(result.passed,false);
  const report=JSON.parse(await readFile(join(directory,result.reportPath),"utf8")) as UiLayoutReport;assert.equal(report.checkedStates,4);
  for(const state of documents[0].states)for(const layout of ["compact","with-detail"]){
   const pairs=result.issues.filter(issue=>issue.code==="text_collision"&&issue.stateId===state.id&&issue.layout===layout).map(issue=>[issue.elementId,issue.otherElementId]);
   assert.deepEqual(pairs,[["item-3","item-3-folder"],["item-4","item-4-folder"]]);
  }
  const copy=structuredClone(documents);for(const id of ["item-3","item-4"])copy[0].elements.find(element=>element.id===id)!.rect.height=20/copy[0].viewport.height;
  const spaced=await inspectUiDocumentLayout(copy,{workspace:directory,width,height,reportName:`${reportName}-separate-lines`});assert.equal(spaced.passed,true,JSON.stringify(spaced.issues));
 }
 assert.equal(JSON.stringify(documents),before);assert.deepEqual(await readFile(source),bytes);
});


test("shared actual-frame measurement follows typed text and camera scale, ignoring an opacity-zero intro",integration,async()=>{
 const browser=await chromium.launch({headless:true,executablePath:motionBrowserPath(),args:motionBrowserArgs,env:mediaEnvironment()});
 try {
  const page=await browser.newPage({viewport:{width:1000,height:700}});await page.route("**/*",route=>route.abort());
  await page.setContent(`<style>@font-face{font-family:Studio;src:url(data:font/woff2;base64,${geistFontBase64})}*{box-sizing:border-box}#viewport{width:900px;height:600px;overflow:hidden}#ui{width:500px;height:300px;position:relative;transform-origin:0 0}.label{position:absolute;width:300px;height:40px;font:24px/1.3 Studio;white-space:pre-wrap;overflow:hidden;background:transparent}</style><div id="viewport"><div id="ui"><div class="label" style="left:20px;top:30px" data-ui-element="input"><span data-ui-text>Hi</span></div><div class="label" style="left:95px;top:30px" data-ui-element="neighbor"><span data-ui-text>Neighbor</span></div></div></div>`);
  await page.evaluate(async()=>{await document.fonts.load("24px Studio");await document.fonts.ready;});
  const read=()=>page.locator("#ui").evaluate(browserUiLayoutMeasurement);
  assert.deepEqual(assessUiTextCollisions(await read(),context),[]);
  await page.locator('[data-ui-element="input"] [data-ui-text]').evaluate(node=>{node.textContent="Typed result";});
  const normal=assessUiTextCollisions(await read(),context);assert.equal(normal.length,1);
  await page.locator("#ui").evaluate(node=>{(node as HTMLElement).style.transform="translate(30px, 20px) scale(1.5)";});
  const scaled=assessUiTextCollisions(await read(),context);assert.equal(scaled.length,1);assert.ok(Math.abs(scaled[0].metrics.overlapHeight!-normal[0].metrics.overlapHeight!*1.5)<.1);
  await page.locator("#viewport").evaluate(node=>{(node as HTMLElement).style.opacity="0";});assert.deepEqual(assessUiTextCollisions(await read(),context),[]);
 }finally{await browser.close();}
});

test("final v2 motion preflight rejects retained h collisions on real action frames without touching source files",{...integration,skip:process.env.STUDIO_UI_LAYOUT_INTEGRATION!=="1"?integration.skip:process.env.STUDIO_UI_LAYOUT_TRIAL_H!=="1"?"Set STUDIO_UI_LAYOUT_TRIAL_H=1 to inspect retained local trial h":false},async t=>{
 const directory=await workspace(t),source=resolve(".local/engine-batch-acceptance-20261002h"),planBytes=await readFile(join(source,"plan.json")),plan=JSON.parse(planBytes.toString()) as Plan;
 await mkdir(join(directory,"analysis"));
 for(const id of motionAssetIds(plan)){
  const asset=plan.assets.find(asset=>asset.id===id)!,original=resolve(source,asset.path),copy=resolve(directory,asset.path);
  assert.ok(!relative(source,original).startsWith("..")&&!relative(directory,copy).startsWith(".."));await mkdir(dirname(copy),{recursive:true});await copyFile(original,copy);
 }
 const project=await prepareMotionProject(plan,directory,0);
 await assert.rejects(inspectMotionProject(plan,directory,project),(error:any)=>error.code==="ui_text_collision");
 const rows=JSON.parse(await readFile(join(directory,"analysis/layout.json"),"utf8")),bad=rows.find((row:any)=>row.textCollisions?.length);
 assert.ok(bad);assert.ok(bad.textCollisions.some((issue:any)=>issue.elementId==="item-3"&&issue.otherElementId==="item-3-folder"));assert.ok(bad.frame>plan.scenes.find(scene=>scene.id===bad.scene)!.start_frame);
 assert.deepEqual(await readFile(join(source,"plan.json")),planBytes);
});
