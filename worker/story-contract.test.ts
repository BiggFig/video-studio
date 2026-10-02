import test,{type TestContext} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,dirname,resolve} from "node:path";
import {compileResearch,sourceFacts,stageDigest} from "./research";
import {compileScript,scriptVisibleText,scriptVisibleWords} from "./scripting";
import {brandFromEvidence,compilePlan} from "./planning";
import {PipelineError,type Evidence,type Hooks,type WorkerInput} from "./types";

const input:WorkerInput={jobId:"story-contract",ownerId:"fixture",mode:"url",productUrl:"https://example.com",videoType:"launch",format:"16:9",files:[]};
const hooks:Hooks={persist:async()=>{},state:async()=>{},complete:async()=>{}};
function fixture(){
  const evidence:Evidence={text:["Atlas helps researchers organize notes.","Create linked notes to connect ideas.","The graph reveals relationships between notes.","Keep research in local files.","Download Atlas for your desktop.","A free personal plan is available.","Your knowledge stays private on your device.","Scattered notes make relationships hard to find."].join("\n\n"),assets:[
    {id:"editor",path:"assets/editor.png",preview:"assets/editor.png",kind:"image",usage:"output",rights:"Actual source fixture",width:1200,height:800,provenance:{pageUrl:"https://example.com",pageKind:"homepage",method:"element",role:"product-ui-candidate"}},
    {id:"graph",path:"assets/graph.png",preview:"assets/graph.png",kind:"image",usage:"output",rights:"Actual source fixture",width:1200,height:800},
    {id:"pricing",path:"assets/pricing.png",kind:"image",usage:"output",rights:"Actual marketing fixture",width:1200,height:800},
    {id:"logo",path:"assets/logo.png",kind:"image",usage:"output",rights:"Observed real logo",width:120,height:120,provenance:{pageUrl:"https://example.com",pageKind:"homepage",method:"element",role:"brand-logo"}},
  ],brand:{version:1,sourceUrl:"https://example.com",title:"Atlas",language:"en",headings:[],callsToAction:["Download Atlas"],colors:[{value:"rgb(250, 250, 250)",role:"background",selector:"body"},{value:"rgb(25, 25, 25)",role:"text",selector:"h1"},{value:"rgb(83, 40, 170)",role:"accent",selector:"a.download"}],typography:[],logoAssetIds:["logo"],limitations:[]}};
  const claim=(text:string,id:string,basis:"explicit"|"inferred"="explicit")=>({text,basis,evidenceIds:[id]});
  const rawResearch={sufficientEvidence:true,reason:"Visible editor and graph support the mechanism",product:"Atlas",summary:"Connected notes for researchers",facts:sourceFacts(evidence).map((fact,index)=>({evidenceId:fact.id,label:fact.text,kind:["audience","feature","benefit","benefit","cta","pricing","feature","problem"][index]})),story:{primaryAudience:claim("researchers","fact-1"),problem:claim("Scattered notes","fact-8"),mechanism:{...claim("Link notes and inspect their relationships","fact-2"),steps:[{action:"Link notes",evidenceId:"fact-2",assetId:"editor"},{action:"Inspect connections",evidenceId:"fact-3",assetId:"graph"}]},outcome:claim("See relationships between notes","fact-3"),differentiator:claim("Keep knowledge private","fact-7"),cta:claim("Download Atlas","fact-5")},visuals:[
    {assetId:"editor",description:"Actual note editor",role:"product_ui",showsProductUi:true,supportsFactIds:["fact-1","fact-2","fact-4","fact-7"],regions:[{id:"linked-note",rect:{x:.1,y:.15,width:.7,height:.7},supportsFactIds:["fact-2"]}]},
    {assetId:"graph",description:"Actual graph UI",role:"product_ui",showsProductUi:true,supportsFactIds:["fact-3"]},
    {assetId:"pricing",description:"Public pricing page",role:"marketing",showsProductUi:false,supportsFactIds:["fact-6"]},
    {assetId:"logo",description:"Observed brand logo",role:"brand",showsProductUi:false,supportsFactIds:["fact-1"]},
  ],limitations:["The screenshots show capability, not a performed interaction."]};
  const scene=(storyRole:string,headline:string,evidenceId:string,assetId:string,template:string,durationSeconds=3)=>({storyRole,headline,detail:"",evidenceId,assetId,durationSeconds,sourceInSeconds:0,preserveAudio:false,purpose:"Grounded narrative beat",referenceTechnique:"Supported purposeful reveal",presentation:{template,theme:"light",transition:"cut"} as Record<string,unknown>});
  const rawScript={sufficientEvidence:true,reason:"Grounded mechanism and outcome",product:"Atlas",summary:"A concise product story",accent:"#ff0000",background:"dark",musicPrompt:"Restrained original instrumental texture",sfxPrompt:"Soft interface reveal",assumptions:[],scenes:[scene("problem","For researchers: scattered notes?","fact-8","editor","hook"),scene("product","Connected thinking","fact-1","editor","brand"),scene("mechanism","Link your notes","fact-2","editor","proof",5),scene("outcome","See the connections","fact-3","graph","proof",5),scene("differentiator","Keep knowledge yours","fact-7","editor","features"),scene("cta","Download Atlas","fact-5","editor","cta")]};
  rawScript.scenes[2].presentation.visual={kind:"focus",regionId:"linked-note"};
  rawScript.scenes[3].presentation.visual={kind:"showcase"};
  rawScript.scenes[4].presentation.visual={kind:"connections",nodes:[{label:"Private",evidenceId:"fact-7"},{label:"Local",evidenceId:"fact-4"}]};
  return{evidence,rawResearch,rawScript};
}
async function workspace(t:TestContext){const prefix=join(tmpdir(),"studio-story-"),root=await mkdtemp(prefix);await mkdir(join(root,"analysis"));t.after(async()=>{if(dirname(resolve(root))!==resolve(tmpdir())||!root.startsWith(prefix))throw new Error("Unsafe fixture cleanup");await rm(root,{recursive:true,force:true});});return root;}
const research=(value:ReturnType<typeof fixture>)=>compileResearch(input,value.evidence,value.rawResearch,"a".repeat(64));
const code=(expected:string)=>(error:unknown)=>error instanceof PipelineError&&error.code===expected;

test("new research records a canonical strategy while missing strategy and unknown narrative bindings fail closed",()=>{
  const value=fixture(),result=research(value);assert.equal(result.version,2);assert.deepEqual(result.story,value.rawResearch.story);
  assert.ok(result.facts.every(fact=>sourceFacts(value.evidence).find(source=>source.id===fact.evidenceId)?.text===fact.quote));
  const missing={...value.rawResearch,story:undefined};assert.throws(()=>compileResearch(input,value.evidence,missing,"a".repeat(64)),/grounded story/);
  assert.throws(()=>compileResearch(input,value.evidence,{...missing,version:1},"a".repeat(64)),/grounded story/);
  value.rawResearch.story.primaryAudience.evidenceIds=["fact-999"];assert.throws(()=>research(value),/absent from the selected/);
});
test("inferred audience targeting stays labeled; invented mechanisms and logo-only proof cannot become product evidence",()=>{
  const value=fixture();value.rawResearch.story.primaryAudience.basis="inferred";const result=research(value);assert.equal(result.story?.primaryAudience?.basis,"inferred");
  compileScript(value.rawScript,input,value.evidence,result);
  value.rawScript.scenes[0].headline="Researchers already use Atlas";assert.throws(()=>compileScript(value.rawScript,input,value.evidence,result),/inferred targeting/);
  value.rawResearch.story.mechanism.basis="inferred";assert.throws(()=>research(value),/explicit source/);
  const logo=fixture();logo.rawResearch.visuals[3].role="product_ui";logo.rawResearch.visuals[3].showsProductUi=true;assert.throws(()=>research(logo),/contradicts its source/);
  const pricing=fixture();pricing.evidence.assets[2].provenance={pageUrl:"https://example.com/pricing",pageKind:"pricing",method:"viewport",role:"marketing"};pricing.rawResearch.visuals[2].role="product_ui";pricing.rawResearch.visuals[2].showsProductUi=true;
  assert.throws(()=>research(pricing),/contradicts its source/);
  const homepage=fixture();homepage.evidence.assets[0].provenance={pageUrl:"https://example.com",pageKind:"homepage",method:"viewport",role:"marketing"};assert.equal(research(homepage).visuals[0].role,"product_ui");
});
test("demonstrative launch needs actual UI, not a marketing or pricing substitute",()=>{
  const value=fixture();for(const visual of value.rawResearch.visuals){visual.role="marketing";visual.showsProductUi=false;delete visual.regions;}
  assert.throws(()=>research(value),error=>code("insufficient_product_evidence")(error)&&(error as PipelineError).status==="needs_input");
  const valid=fixture(),confirmed=research(valid);valid.rawScript.scenes[2].presentation={template:"features",theme:"light",transition:"cut"};
  assert.throws(()=>compileScript(valid.rawScript,input,valid.evidence,confirmed),code("insufficient_product_evidence"));
  const extra=fixture(),verified=research(extra);extra.rawScript.scenes[1].storyRole="mechanism";extra.rawScript.scenes[1].evidenceId="fact-2";
  assert.throws(()=>compileScript(extra.rawScript,input,extra.evidence,verified),code("insufficient_product_evidence"));
});
test("current scripts require mechanism, outcome, exactly one final CTA and visible audience",()=>{
  for(const change of [
    (value:ReturnType<typeof fixture>)=>{value.rawScript.scenes[2].storyRole="product";},
    (value:ReturnType<typeof fixture>)=>{value.rawScript.scenes[3].storyRole="product";},
    (value:ReturnType<typeof fixture>)=>{value.rawScript.scenes[4].storyRole="cta";},
    (value:ReturnType<typeof fixture>)=>{value.rawScript.scenes[0].headline="A brighter future";},
  ]){const value=fixture(),confirmed=research(value);change(value);assert.throws(()=>compileScript(value.rawScript,input,value.evidence,confirmed),code("invalid_generated_script"));}
});
test("visible-word accounting includes nodes and repeat branding, deduplicates actual brand headline, and rejects dense scripts",()=>{
  const value=fixture(),confirmed=research(value),script=compileScript(value.rawScript,input,value.evidence,confirmed);
  const words=scriptVisibleWords(script);assert.ok(words<=42);assert.deepEqual(scriptVisibleText(script.product,script.scenes[4]),["Keep knowledge yours","Private","Local"]);
  const brand={...script.scenes[1],headline:"  ATLAS  ",detail:""};assert.deepEqual(scriptVisibleText(script.product,brand),["Atlas"]);
  for(const scene of value.rawScript.scenes)scene.detail="Additional explanatory words that should not all appear";
  assert.throws(()=>compileScript(value.rawScript,input,value.evidence,confirmed),/exceeds 48 words/);
  const prices=fixture();prices.rawScript.scenes[0].headline="For researchers: free notes";prices.rawScript.scenes[5].headline="Download free";
  assert.throws(()=>compileScript(prices.rawScript,input,prices.evidence,research(prices)),/repeat pricing/);
});
test("focus resolves only researched still regions; changed coordinates and unknown bindings are rejected",()=>{
  const value=fixture(),confirmed=research(value),original=JSON.stringify(value.rawScript),script=compileScript(value.rawScript,input,value.evidence,confirmed);
  assert.equal(JSON.stringify(value.rawScript),original);const focus=script.scenes[2].presentation!.visual!;assert.equal(focus.kind,"focus");if(focus.kind==="focus")assert.deepEqual(focus.region,value.rawResearch.visuals[0].regions![0].rect);
  value.rawScript.scenes[2].presentation.visual={kind:"focus",regionId:"linked-note",region:{x:0,y:0,width:.2,height:.2}};assert.throws(()=>compileScript(value.rawScript,input,value.evidence,confirmed),/does not match/);
  value.rawScript.scenes[2].presentation.visual={kind:"focus",regionId:"invented"};assert.throws(()=>compileScript(value.rawScript,input,value.evidence,confirmed),/does not match/);
  const invalid=fixture();invalid.rawResearch.visuals[0].regions![0].supportsFactIds=["fact-6"];assert.throws(()=>research(invalid),/focus region/);
  const legacy=compileResearch(input,value.evidence,value.rawResearch,"b".repeat(64),{legacy:true});assert.throws(()=>compileScript(value.rawScript,input,value.evidence,legacy),/Legacy scripts/);
});
test("second panels and explanatory nodes bind canonical facts without inventing extra visible copy",async t=>{
  const value=fixture(),confirmed=research(value);value.rawScript.scenes[2].presentation.visual={kind:"panels",secondaryAssetId:"graph",secondaryEvidenceId:"fact-3"};
  const script=compileScript(value.rawScript,input,value.evidence,confirmed),root=await workspace(t),plan=await compilePlan(input,value.evidence,script,hooks,root);
  const panels=plan.scenes[2].presentation!.visual!;assert.equal(panels.kind,"panels");if(panels.kind==="panels")assert.equal(panels.secondaryEvidence,confirmed.facts.find(fact=>fact.evidenceId==="fact-3")!.quote);
  const nodes=plan.scenes[4].presentation!.visual!;assert.equal(nodes.kind,"connections");if(nodes.kind==="connections")assert.ok(nodes.nodes.every(node=>node.evidence===confirmed.facts.find(fact=>fact.evidenceId===node.evidenceId)!.quote));
  assert.deepEqual(plan.story,confirmed.story);assert.equal(plan.scenes[2].storyRole,"mechanism");assert.ok(plan.output.duration_frames/30>=20&&plan.output.duration_frames/30<=28);
  const audit=JSON.parse(await readFile(join(root,"analysis/copy-audit.json"),"utf8"));assert.equal(audit.visibleWords,scriptVisibleWords(script));assert.equal(audit.scriptSha256,stageDigest(script));
  value.rawScript.scenes[2].presentation.visual={kind:"panels",secondaryAssetId:"pricing",secondaryEvidenceId:"fact-6"};assert.throws(()=>compileScript(value.rawScript,input,value.evidence,confirmed),/second panel/);
});
test("brand compilation uses observed colors and genuine raster logo, with readable neutral fallbacks",async t=>{
  const value=fixture(),confirmed=research(value),script=compileScript(value.rawScript,input,value.evidence,confirmed),root=await workspace(t),plan=await compilePlan(input,value.evidence,script,hooks,root);
  assert.deepEqual(plan.brand,{background:"#fafafa",foreground:"#191919",accent:"#5328aa",sourceUrl:"https://example.com",logoAssetId:"logo"});assert.equal(plan.accent,"#5328aa");assert.equal(plan.background,"light");assert.notEqual(plan.accent,script.accent);
  value.evidence.brand!.colors=[{value:"rgb(15, 15, 15)",role:"background",selector:"body"},{value:"rgb(238, 238, 238)",role:"text",selector:"body"},{value:"rgb(255, 255, 255)",role:"accent",selector:"a"},{value:"rgb(124, 58, 237)",role:"accent",selector:"a"}];
  assert.equal(brandFromEvidence(value.evidence)!.accent,"#7c3aed");
  value.evidence.brand!.colors=[{value:"rgba(0, 0, 0, 0)",role:"background",selector:"body"},{value:"color(display-p3 1 0 0)",role:"accent",selector:"a"}];value.evidence.brand!.logoAssetIds=["pricing"];
  const fallback=brandFromEvidence(value.evidence)!;assert.equal(fallback.background,"#f8f9fb");assert.equal(fallback.foreground,"#151517");assert.equal(fallback.logoAssetId,undefined);
});
