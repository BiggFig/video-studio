import test from "node:test";
import assert from "node:assert/strict";
import { publicAddress, safePath, safeDestination } from "./security";
import { dimensions, validateTimeline } from "./planning";
import { sceneHtml, layout } from "./render";
import { unexpectedVoice } from "./quality";
import type { Plan } from "./types";
import { Providers } from "./providers";
import { createHash } from "node:crypto";
import { mkdtemp,readFile,writeFile,mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixture=():Plan=>({version:1,job_id:"unit",mode:"create",renderer:"ffmpeg",output:{width:1920,height:1080,fps:30,duration_frames:180},product:"A <script> test",summary:"",accent:"#5577ff",background:"light",assets:[{id:"screen",path:"assets/screen.jpg",kind:"image",usage:"output",rights:"test",width:1440,height:960}],scenes:[{id:"s1",start_frame:0,duration_frames:180,asset_id:"screen",source_in_seconds:0,playback_rate:1,preserve_audio:false,fit:"contain",purpose:"proof",reference_technique:"",headline:"Actual product proof",detail:"Clear, supported copy.",evidence:"Actual product proof",effects:[]}],captions:[],audio:[],music_prompt:"",sfx_prompt:"",assumptions:[]});

test("public ingestion rejects loopback, metadata, LAN and mapped IPv6",async()=>{
  for(const address of ["127.0.0.1","10.1.1.1","172.16.0.1","192.168.1.1","169.254.169.254","100.64.0.1","::1","::ffff:127.0.0.1","fe80::1","fc00::1","ff02::1","2001:db8::1"])assert.equal(publicAddress(address),false,address);
  assert.equal(publicAddress("8.8.8.8"),true);assert.equal(publicAddress("2606:4700:4700::1111"),true);
  for(const url of ["http://127.0.0.1","http://2130706433","http://0x7f000001","http://[::1]","file:///etc/passwd","https://user:pass@example.com","http://example.com:3000"])await assert.rejects(safeDestination(url));
});
test("artifact paths cannot escape workspace",()=>{
  for(const name of ["../secret","assets/../../secret","C:/secret","/etc/passwd","assets\\..\\secret","a\0b"])assert.throws(()=>safePath(process.cwd(),name));
  assert.ok(safePath(process.cwd(),"assets/real.jpg").endsWith("real.jpg"));
});
test("auto adopts supported reference ratio and explicit choices win",()=>{
  assert.deepEqual(dimensions("auto"),{width:1920,height:1080});assert.deepEqual(dimensions("auto",0.56),{width:1080,height:1920});assert.deepEqual(dimensions("auto",1),{width:1080,height:1080});assert.deepEqual(dimensions("16:9",0.56),{width:1920,height:1080});
});
test("timeline rejects gaps, reference output and source overrun",()=>{
  const p=fixture();assert.deepEqual(validateTimeline(p),[]);p.scenes[0].start_frame=1;assert.ok(validateTimeline(p).length);p.scenes[0].start_frame=0;p.assets[0].usage="reference";assert.ok(validateTimeline(p).length);p.assets[0].usage="output";p.assets[0].kind="video";p.assets[0].duration_seconds=1;assert.ok(validateTimeline(p).length);
});
test("audio source ranges and reveal cues remain within the authoritative timeline",()=>{
  const p=fixture();p.scenes[0].duration_frames=90;p.scenes.push({...p.scenes[0],id:"s2",start_frame:90});
  p.assets.push({id:"effect",path:"effect.mp3",kind:"audio",usage:"output",rights:"test",width:0,height:0,has_audio:true,duration_seconds:1.2});
  p.audio=[{asset_id:"effect",start_frame:90,duration_frames:36,source_in_seconds:0,playback_rate:1,gain_db:-12,role:"sfx"}];assert.deepEqual(validateTimeline(p),[]);
  p.audio[0].start_frame=170;assert.ok(validateTimeline(p).some(e=>e.includes("out-of-output")));p.audio[0].start_frame=100;assert.ok(validateTimeline(p).some(e=>e.includes("intended scene")));p.audio[0].start_frame=90;p.audio[0].source_in_seconds=1;assert.ok(validateTimeline(p).some(e=>e.includes("source range overflow")));
});
test("one preserved speech scene does not permit generated voices elsewhere",()=>{
  const p=fixture();p.scenes[0].duration_frames=90;p.scenes[0].preserve_audio=true;p.scenes.push({...p.scenes[0],id:"s2",start_frame:90,preserve_audio:false});
  const result=unexpectedVoice(p,{text:"hello unexpected",words:[{text:"hello",start:1,end:1.5,type:"word"},{text:"unexpected",start:4,end:4.5,type:"word"},{text:"singing",start:5,end:5.5,type:"audio_event"},{text:"music",start:3,end:6,type:"audio_event"}]});assert.deepEqual(result.map(w=>w.text),["unexpected","singing"]);
});
test("untrusted product strings cannot create composition markup",()=>{
  const p=fixture(),html=sceneHtml(p,p.scenes[0],0);assert.ok(html.includes("A &lt;script&gt; test"));assert.ok(!html.includes("<script>"));
  for(const format of ["16:9","9:16","1:1"] as const){Object.assign(p.output,dimensions(format));const l=layout(p);assert.ok(l.x>40&&l.y>40&&l.x+l.width<p.output.width&&l.y+l.height<p.output.height);}
});

test("an interrupted paid audio reservation never repeats generation",async()=>{
  const workspace=await mkdtemp(join(tmpdir(),"video-studio-ledger-"));await mkdir(join(workspace,"assets"));
  const hooks={persist:async()=>{},state:async()=>{},complete:async()=>{}};
  const providers=new Providers(workspace,{jobId:"test",ownerId:"test",mode:"url",productUrl:"https://example.com",videoType:"launch",format:"auto",files:[]},hooks);
  const key=createHash("sha256").update(JSON.stringify({kind:"music",prompt:"calm instrumental",duration:30,version:1})).digest("hex");
  providers.ledger.audio[key]={status:"reserved",path:"assets/pending.mp3",hash:""};providers.ledger.audioGenerations=1;
  await assert.rejects(providers.audio("music","calm instrumental",30),(error:unknown)=>error instanceof Error&&"code"in error&&error.code==="audio_payment_uncertain");
  assert.equal(providers.ledger.audioGenerations,1);
});

test("durable usage reservation happens before any paid provider request",async()=>{
  const workspace=await mkdtemp(join(tmpdir(),"video-studio-ledger-"));let persisted=false;
  const providers=new Providers(workspace,{jobId:"test",ownerId:"test",mode:"url",videoType:"launch",format:"auto",files:[],budgets:{maxModelCalls:1}},{persist:async paths=>{assert.deepEqual(paths,["ledger.json"]);const ledger=JSON.parse(await readFile(join(workspace,"ledger.json"),"utf8"));assert.equal(ledger.modelCalls,1);persisted=true;throw new Error("checkpoint unavailable");},state:async()=>{},complete:async()=>{}});
  await assert.rejects(providers.claude("test","never call provider"),/checkpoint unavailable/);assert.equal(persisted,true);assert.equal(providers.ledger.modelCalls,1);
  await assert.rejects(providers.claude("test","never call provider"),(error:unknown)=>error instanceof Error&&"code"in error&&error.code==="model_budget");
});
test("model reservations reject an over-budget request before a provider call",async()=>{
  const workspace=await mkdtemp(join(tmpdir(),"video-studio-budget-"));let saved=false;
  const providers=new Providers(workspace,{jobId:"test",ownerId:"test",mode:"url",videoType:"launch",format:"auto",files:[],budgets:{maxModelInputTokens:100,maxModelOutputTokens:1000}},{persist:async()=>{saved=true;},state:async()=>{},complete:async()=>{}});
  await assert.rejects(providers.claude("test","evidence"),(error:unknown)=>error instanceof Error&&"code"in error&&error.code==="model_budget");assert.equal(saved,false);assert.equal(providers.ledger.modelCalls,0);
});
test("Claude max_tokens is clipped to remaining output allowance and usage reconciles",async()=>{
  const workspace=await mkdtemp(join(tmpdir(),"video-studio-budget-"));await mkdir(join(workspace,"analysis"));const original=globalThis.fetch;let requestedMax=0;
  const providers=new Providers(workspace,{jobId:"test",ownerId:"test",mode:"url",videoType:"launch",format:"auto",files:[],budgets:{maxModelOutputTokens:1500}},{persist:async()=>{},state:async()=>{},complete:async()=>{}});providers.ledger.outputTokens=900;
  globalThis.fetch=(async(_url,options)=>{requestedMax=JSON.parse(String(options?.body)).max_tokens;assert.equal(providers.ledger.reservedOutputTokens,600);assert.ok(providers.ledger.reservedInputTokens>0);return new Response(JSON.stringify({model:"fixture-model",content:[{type:"text",text:'{"ok":true}'}],usage:{input_tokens:200,output_tokens:20}}),{status:200});}) as typeof fetch;
  try{assert.deepEqual(await providers.claude("test","fixture evidence"),{ok:true});assert.equal(requestedMax,600);assert.equal(providers.ledger.outputTokens,920);assert.equal(providers.ledger.inputTokens,200);assert.equal(providers.ledger.reservedInputTokens,0);assert.equal(providers.ledger.reservedOutputTokens,0);}finally{globalThis.fetch=original;}
});
