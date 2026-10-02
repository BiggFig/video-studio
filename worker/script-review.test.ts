import test,{type TestContext} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve,dirname} from "node:path";
import {compileResearch,sourceFacts} from "./research";
import {scriptConstraints,scriptRequest,prepareScriptRepair,writeScript} from "./scripting";
import {compileScriptWithRetry,SCRIPT_RETRY_PATH,SCRIPT_REJECTION_PATH,scriptCorrectionAllowance,type ScriptRetryOptions} from "./script-review";
import {PipelineError,type Evidence,type WorkerInput,type Hooks} from "./types";
import type {Providers} from "./providers";
const input:WorkerInput={jobId:"script-correction",ownerId:"fixture",mode:"url",productUrl:"https://example.com",videoType:"launch",format:"16:9",files:[],budgets:{maxModelCalls:10,maxModelOutputTokens:30000,maxModelInputTokens:200000}};
const evidence:Evidence={text:"Notes for writers.\n\nLink notes.\n\nSee connections.\n\nDownload Atlas.",assets:[{id:"ui",path:"assets/ui.png",kind:"image",usage:"output",rights:"Test source",width:1000,height:800}]};
const claim=(text:string,id:string,basis="explicit")=>({text,basis,evidenceIds:[id]});
const research=compileResearch(input,evidence,{sufficientEvidence:true,reason:"Visible notes",product:"Atlas",summary:"Linked notes",facts:sourceFacts(evidence).map(f=>({evidenceId:f.id,kind:"feature",label:f.text})),visuals:[{assetId:"ui",description:"Notes UI",supportsFactIds:["fact-2","fact-3"],showsProductUi:true,role:"product_ui"}],story:{primaryAudience:claim("writers","fact-1","inferred"),problem:null,mechanism:{...claim("Link notes","fact-2"),steps:[{action:"Link notes",evidenceId:"fact-2",assetId:"ui"}]},outcome:claim("See connections","fact-3"),differentiator:null,cta:claim("Download Atlas","fact-4")},limitations:[]},"a".repeat(64),{version:2});
const hooks:Hooks={persist:async()=>{},state:async()=>{},complete:async()=>{}};
const expectedConstraints={assetIds:["ui"],selectedFactIds:["fact-1","fact-2","fact-3","fact-4"],roleEvidenceIds:{problem:[],product:["fact-1","fact-2","fact-3","fact-4"],mechanism:["fact-2"],outcome:["fact-3"],differentiator:[],cta:["fact-4"]}};
function draft(){return{sufficientEvidence:true,reason:"Supported",product:"Atlas",summary:"A short film",accent:"#336699",background:"light",musicPrompt:"Soft original instrumental texture",sfxPrompt:"A quiet soft reveal",assumptions:[],scenes:[
  {storyRole:"mechanism",assetId:"ui",headline:"For writers: link notes",detail:"",evidenceId:"fact-2",durationSeconds:6,sourceInSeconds:0,preserveAudio:false,purpose:"Main workflow",referenceTechnique:"Actual proof",presentation:{template:"proof",theme:"light",transition:"cut"}},
  {storyRole:"outcome",assetId:"ui",headline:"See connections",detail:"",evidenceId:"fact-3",durationSeconds:5,sourceInSeconds:0,preserveAudio:false,purpose:"Outcome",referenceTechnique:"Actual proof",presentation:{template:"proof",theme:"light",transition:"cut"}},
  {storyRole:"cta",assetId:"ui",headline:"Download",detail:"",evidenceId:"fact-4",durationSeconds:4,sourceInSeconds:0,preserveAudio:false,purpose:"Next step",referenceTechnique:"Brand",presentation:{template:"cta",theme:"dark",transition:"cut"}},
]};}
function invalid(){const raw:Record<string,unknown>=draft();raw.scenes=draft().scenes.map(scene=>({...scene,detail:null,sourceInSeconds:null,presentation:{template:scene.presentation.template,theme:"light",outgoing:"cut"}}));return raw;}
async function setup(t:TestContext,response:unknown=draft(),maxScenes=3){
  const prefix=join(tmpdir(),"script-response-test-"),workspace=await mkdtemp(prefix);await mkdir(join(workspace,"analysis"));
  t.after(async()=>{if(dirname(resolve(workspace))!==resolve(tmpdir())||!workspace.startsWith(prefix))throw new Error("Unsafe cleanup");await rm(workspace,{recursive:true,force:true});});
  let calls=0,prepared=0,prompt="";const events:string[]=[];
  const providers={ledger:{modelCalls:3,inputTokens:30000,outputTokens:7000,reservedInputTokens:0,reservedOutputTokens:0},prepareClaude:async(purpose:string,text:string,images:unknown,policy:unknown)=>{prepared++;prompt=text;assert.equal(purpose,"script");assert.deepEqual(images,[]);assert.deepEqual(policy,{policy:"script-v1",reserve:{calls:Math.ceil(maxScenes/2),inputTokens:0,outputTokens:Math.ceil(maxScenes/2)*3000},scriptConstraints:{...expectedConstraints,maxScenes}});return async()=>{calls++;events.push("paid");return response;};}} as unknown as Providers;
  const options:ScriptRetryOptions={input,evidence,research,workspace,providers,hooks:{persist:async paths=>{events.push(...paths);}},prompt:scriptRequest(input,evidence,research)};
  return{options,events,get calls(){return calls;},get prepared(){return prepared;},get prompt(){return prompt;}};
}
const blocked=(e:unknown)=>e instanceof PipelineError&&e.code==="production_stage_changed";
test("initial script correction persists before generation, binds exact research, and keeps strict facts and audience",async t=>{
  const f=await setup(t),raw=invalid();const result=await compileScriptWithRetry(raw,f.options);assert.equal(result.researchSha256,JSON.parse(await readFile(join(f.options.workspace,SCRIPT_RETRY_PATH),"utf8")).researchSha256);assert.deepEqual(f.events,[SCRIPT_REJECTION_PATH,SCRIPT_RETRY_PATH,"paid",SCRIPT_RETRY_PATH]);assert.equal(f.calls,1);assert.match(f.prompt,/requiredAudienceCopy.*For writers/);assert.match(f.prompt,/exact field presentation.transition/);assert.ok(f.prompt.startsWith(f.options.prompt));await assert.rejects(compileScriptWithRetry(raw,f.options),blocked);assert.equal(f.calls,1);
});
test("valid, absent and explicit-insufficient responses never consume a correction",async t=>{
  for(const raw of[draft(),undefined,{sufficientEvidence:false,reason:null}]){const f=await setup(t);if(raw===undefined)await assert.rejects(compileScriptWithRetry(raw,f.options),blocked);else if(!raw.sufficientEvidence)await assert.rejects(compileScriptWithRetry(raw,f.options),e=>e instanceof PipelineError&&e.status==="needs_input");else await compileScriptWithRetry(raw,f.options);assert.equal(f.prepared,0);}
});
test("semantic correction cannot shorten audience, change role evidence or exceed 48 visible words",async t=>{
  for(const mutate of[(raw:ReturnType<typeof draft>)=>{raw.scenes[0].headline="For people: link notes";},(raw:ReturnType<typeof draft>)=>{raw.scenes[1].evidenceId="fact-2";},(raw:ReturnType<typeof draft>)=>{for(const scene of raw.scenes)scene.detail="one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen";}]){const bad=draft();mutate(bad);const f=await setup(t,bad);await assert.rejects(compileScriptWithRetry(invalid(),f.options),e=>e instanceof PipelineError&&e.code==="invalid_generated_script");assert.equal(JSON.parse(await readFile(join(f.options.workspace,SCRIPT_RETRY_PATH),"utf8")).outcome,"invalid");await assert.rejects(compileScriptWithRetry(draft(),f.options),blocked);assert.equal(f.calls,1);}
});
test("budgets and provider preflight deny before marker or paid closure",async t=>{
  for(const budget of[{maxModelCalls:5},{maxModelOutputTokens:17999}]){const f=await setup(t);f.options.input={...input,budgets:{...input.budgets,...budget}};await assert.rejects(compileScriptWithRetry(invalid(),f.options),e=>e instanceof PipelineError&&e.code==="model_budget");assert.equal(f.prepared,0);assert.ok(JSON.parse(await readFile(join(f.options.workspace,SCRIPT_REJECTION_PATH),"utf8")).diagnostics);await assert.rejects(readFile(join(f.options.workspace,SCRIPT_RETRY_PATH)),{code:"ENOENT"});}
  const f=await setup(t);f.options.providers.prepareClaude=async()=>{throw new Error("Exact input cap reached");};await assert.rejects(compileScriptWithRetry(invalid(),f.options),/Exact input/);assert.equal(f.calls,0);
});
test("checkpoint interruption, corrupt marker and wrong research never permit a restart generation",async t=>{
  const f=await setup(t);f.options.hooks.persist=async paths=>{if(paths.includes(SCRIPT_RETRY_PATH))throw new Error("Lost checkpoint");};await assert.rejects(compileScriptWithRetry(invalid(),f.options),/Lost checkpoint/);assert.equal(f.calls,0);await assert.rejects(compileScriptWithRetry(draft(),f.options),blocked);
  for(const content of["{bad",JSON.stringify({...JSON.parse(await readFile(join(f.options.workspace,SCRIPT_RETRY_PATH),"utf8")),researchSha256:"b".repeat(64)})]){const next=await setup(t);await writeFile(join(next.options.workspace,SCRIPT_RETRY_PATH),content);await assert.rejects(compileScriptWithRetry(invalid(),next.options),blocked);assert.equal(next.prepared,0);}
});
test("initial integration can correct once and confirmed stage resumes; repairs never call response helper",async t=>{
  const f=await setup(t);let initial=0,corrections=0;const providers={...f.options.providers,claude:async(_purpose:string,_prompt:string,_images:unknown,options:unknown)=>{assert.deepEqual(options,{policy:"script-v1",scriptConstraints:expectedConstraints});initial++;return invalid();},prepareClaude:async(_purpose:string,_prompt:string,_images:unknown,options:unknown)=>{assert.deepEqual(options,{policy:"script-v1",reserve:{calls:2,inputTokens:0,outputTokens:6000},scriptConstraints:{...expectedConstraints,maxScenes:3}});return async()=>{corrections++;return draft();};}} as unknown as Providers;
  const result=await writeScript(input,evidence,research,providers,hooks,f.options.workspace);assert.deepEqual(await writeScript(input,evidence,research,providers,hooks,f.options.workspace),result);assert.equal(initial,1);assert.equal(corrections,1);
  const bad=await setup(t);await assert.rejects(compileScriptWithRetry(invalid(),{...bad.options,repair:{} as never}),blocked);assert.equal(bad.prepared,0);
  const repair=await prepareScriptRepair(input,evidence,research,{prepareClaude:async(_purpose:string,_prompt:string,_images:unknown,options:unknown)=>{assert.deepEqual(options,{policy:"script-v1",reserve:{calls:0,inputTokens:0,outputTokens:0},scriptConstraints:expectedConstraints});return async()=>invalid();}} as unknown as Providers,hooks,bad.options.workspace,{plan:{scenes:result.scenes,output:{duration_frames:450}},findings:[]} as never,{calls:0,inputTokens:0,outputTokens:0});await assert.rejects(repair());await assert.rejects(readFile(join(bad.options.workspace,SCRIPT_RETRY_PATH)),{code:"ENOENT"});
});

test("v2 grammar constraints preserve role-specific facts and include mechanism step facts without expanding other roles",()=>{
  const changed=structuredClone(research);changed.story!.mechanism!.steps.push({action:"Inspect relationships",evidenceId:"fact-3",assetId:"ui"});
  changed.story!.mechanism!.steps.push({...changed.story!.mechanism!.steps[0]});
  const constraints=scriptConstraints(changed,evidence)!;
  assert.deepEqual(constraints.roleEvidenceIds.mechanism,["fact-2","fact-3"]);
  assert.deepEqual(constraints.roleEvidenceIds.outcome,["fact-3"]);
  assert.deepEqual(constraints.roleEvidenceIds.cta,["fact-4"]);
  assert.deepEqual(constraints.roleEvidenceIds.problem,[]);
  assert.deepEqual(constraints.roleEvidenceIds.product,["fact-1","fact-2","fact-3","fact-4"]);
  assert.equal(scriptConstraints({...research,version:1},evidence),undefined);
});

test("asset grammar permits only researched non-audio output assets and never mutates canonical inputs",()=>{
  const changed=structuredClone(research),sources=structuredClone(evidence);
  for(const id of["reference","sound","missing"]){changed.visuals.push({...research.visuals[0],assetId:id});}
  sources.assets.push({...evidence.assets[0],id:"reference",usage:"reference"},{...evidence.assets[0],id:"sound",kind:"audio"},{...evidence.assets[0],id:"unselected"});
  const before=JSON.stringify({changed,sources});
  assert.deepEqual(scriptConstraints(changed,sources)!.assetIds,["ui"]);
  assert.equal(JSON.stringify({changed,sources}),before);
});


test("correction reserves all batches for a hard legal scene ceiling without enlarging budgets",async t=>{
  assert.deepEqual(scriptCorrectionAllowance({scenes:Array(5).fill({})},3,true),{maxScenes:5,reserve:{calls:3,inputTokens:0,outputTokens:9000}});
  assert.equal(scriptCorrectionAllowance({scenes:[{},{}]},3,true).maxScenes,4);
  assert.equal(scriptCorrectionAllowance({scenes:Array(10).fill({})},3,true).reserve.calls,4);
  const f=await setup(t,draft(),5);f.options.providers.ledger.outputTokens=13035;f.options.providers.ledger.modelCalls=5;
  const raw=invalid();raw.scenes=[...raw.scenes as object[],{},{}];
  await compileScriptWithRetry(raw,f.options);
  assert.equal(f.calls,1);
  const marker=JSON.parse(await readFile(join(f.options.workspace,SCRIPT_RETRY_PATH),"utf8"));
  assert.equal(marker.maxScenes,5);assert.equal(marker.qualityReviewCalls,3);
});

test("a corrected response cannot expand beyond reserved QC capacity even on a permissive transport",async t=>{
  const larger=draft();larger.scenes.splice(1,0,{...larger.scenes[0],headline:"Link another note"});
  const f=await setup(t,larger);
  await assert.rejects(compileScriptWithRetry(invalid(),f.options),e=>e instanceof PipelineError&&/reserved quality-review scene allowance/.test(e.message));
  assert.equal(f.calls,1);
  assert.equal(JSON.parse(await readFile(join(f.options.workspace,SCRIPT_RETRY_PATH),"utf8")).outcome,"invalid");
  await assert.rejects(compileScriptWithRetry(draft(),f.options),blocked);assert.equal(f.calls,1);
});

test("rejection evidence persistence failure prevents correction preparation and spending",async t=>{
  const f=await setup(t);f.options.hooks.persist=async paths=>{if(paths.includes(SCRIPT_REJECTION_PATH))throw Error("Rejection checkpoint lost");};
  await assert.rejects(compileScriptWithRetry(invalid(),f.options),/Rejection checkpoint lost/);
  assert.equal(f.prepared,0);assert.equal(f.calls,0);
  await assert.rejects(readFile(join(f.options.workspace,SCRIPT_RETRY_PATH)),{code:"ENOENT"});
});
