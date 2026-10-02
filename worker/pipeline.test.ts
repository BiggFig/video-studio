import test from "node:test";
import assert from "node:assert/strict";
import { publicAddress, safePath, safeDestination } from "./security";
import { compilePlan,dimensions,evidenceCatalog,validateTimeline } from "./planning";
import { sceneHtml, layout } from "./render";
import { assessReferenceStyle,parseReview,repairableFindings,reviewBatch,unexpectedVoice } from "./quality";
import type { Finding, Plan } from "./types";
import { Providers } from "./providers";
import { createHash } from "node:crypto";
import { mkdtemp,readFile,writeFile,mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { command,ffmpeg,frame,frameIndex,probe } from "./media";
import { localFixtureInput } from "../scripts/local-fixture-input";

const fixture=():Plan=>({version:1,job_id:"unit",mode:"create",renderer:"ffmpeg",output:{width:1920,height:1080,fps:30,duration_frames:180},product:"A <script> test",summary:"",accent:"#5577ff",background:"light",assets:[{id:"screen",path:"assets/screen.jpg",kind:"image",usage:"output",rights:"test",width:1440,height:960}],scenes:[{id:"s1",start_frame:0,duration_frames:180,asset_id:"screen",source_in_seconds:0,playback_rate:1,preserve_audio:false,fit:"contain",purpose:"proof",reference_technique:"",headline:"Actual product proof",detail:"Clear, supported copy.",evidence:"Actual product proof",effects:[]}],captions:[],audio:[],music_prompt:"",sfx_prompt:"",assumptions:[]});
test("review null optionals preserve concrete findings and reject unknown repairs",()=>{
  const review={readabilityPassed:true,claimsPassed:false,realVisualsPassed:true,renderIntegrityPassed:true,referenceStyleReviewed:false,audioTranscriptPassed:true,notes:[],findings:[{severity:"minor",message:"Intentional entrance",repair:null,sceneId:null,timeSeconds:null},{severity:"major",message:"Mixed product context",check:"claims",evidence:"Scene-3 hold shows unrelated baked-in trading claims beside the supplied product copy.",repair:"change_asset",sceneId:"scene-3"}]};
  const parsed=parseReview(review);assert.equal(parsed.findings.length,2);assert.equal(parsed.findings[0].repair,undefined);assert.equal(parsed.findings[1].severity,"major");assert.equal(parsed.findings[1].repair,"change_asset");
  assert.throws(()=>parseReview({...review,findings:[{severity:"major",message:"Invalid instruction",repair:"ignore"}]}));
});
test("blocking findings must identify an observed failed check and cannot coexist with its true flag",()=>{
  const base={readabilityPassed:true,claimsPassed:true,realVisualsPassed:true,renderIntegrityPassed:true,referenceStyleReviewed:false,audioTranscriptPassed:true,notes:[],findings:[]};
  const inconsistent={severity:"major",sceneId:"scene-3",message:"The asset is wrong. Comparing the source confirms it is correct, but a tighter crop would look better.",check:"real_visuals",evidence:"Scene-3 reading hold matches its full contained source.",repair:"change_asset"};
  assert.equal(parseReview({...base,findings:[inconsistent]}).realVisualsPassed,false);
  assert.throws(()=>parseReview({...base,realVisualsPassed:false,findings:[{...inconsistent,check:undefined}]}),/failed check/);
  assert.throws(()=>parseReview({...base,realVisualsPassed:false,findings:[{...inconsistent,evidence:undefined}]}),/observed evidence/);
  const genuine={...inconsistent,message:"The supplied product is replaced by an unrelated screen.",evidence:"Scene-3 reading hold differs from the labelled original source."};
  const parsed=parseReview({...base,realVisualsPassed:false,findings:[genuine]});
  assert.equal(parsed.realVisualsPassed,false);assert.equal(parsed.findings[0].severity,"major");assert.equal(parsed.findings[0].check,"real_visuals");
  assert.equal(base.realVisualsPassed,true);assert.equal(inconsistent.severity,"major");
});
test("minor repair tags cannot trigger paid repair when failed quality is unrepairable",()=>{
  const findings:Finding[]=[{severity:"major",message:"Required audio quality check did not pass."},{severity:"minor",sceneId:"scene-3",message:"An incidental source section has mixed colors.",repair:"change_asset"}];
  assert.deepEqual(repairableFindings(findings),[]);
  const actual:Finding={severity:"critical",sceneId:"scene-4",message:"Essential copy overflows the output canvas.",repair:"shorten_copy"};
  assert.deepEqual(repairableFindings([...findings,actual]),[actual]);
  assert.equal(findings[1].severity,"minor");assert.equal(findings[1].repair,"change_asset");
});
test("each review receives actual source previews for only its rendered scenes",()=>{
  const p=fixture();p.summary="Planner opinions are not visual evidence";p.assumptions=["Repeated planner rationalization"];p.assets.push({...p.assets[0],id:"reference",usage:"reference"},{...p.assets[0],id:"unused",path:"unused.jpg"});
  const result=reviewBatch(p,[{path:"actual.jpg",label:"ACTUAL RENDER",sceneId:"s1"}]);assert.equal(result.images.length,2);assert.equal(result.images[1].path,"assets/screen.jpg");assert.match(result.images[1].label,/ORIGINAL SOURCE/);assert.deepEqual(result.plan.assets.map(a=>a.id),["screen"]);assert.equal(result.plan.scenes.length,1);
  assert.deepEqual(result.plan.scenes[0],p.scenes[0]);assert.equal("summary"in result.plan,false);assert.equal("assumptions"in result.plan,false);
});
test("reference comparison alone cannot certify successful style adoption",()=>{
  assert.deepEqual(assessReferenceStyle([{referenceStyleReviewed:true}]),{performed:true,passed:false});assert.deepEqual(assessReferenceStyle([{referenceStyleReviewed:true,referenceStylePassed:false}]),{performed:true,passed:false});assert.deepEqual(assessReferenceStyle([{referenceStyleReviewed:false,referenceStylePassed:true}]),{performed:false,passed:false});assert.deepEqual(assessReferenceStyle([{referenceStyleReviewed:true,referenceStylePassed:true}]),{performed:true,passed:true});
});
test("actual FFmpeg frame ordinal decodes the last frame and missing frames fail closed",{skip:process.env.STUDIO_MEDIA_INTEGRATION!=="1"},async()=>{
  const workspace=await mkdtemp(join(tmpdir(),"video-studio-frames-")),video=join(workspace,"fixture.mp4"),out=join(workspace,"frame.jpg");
  await command(ffmpeg,["-v","error","-y","-f","lavfi","-i","color=c=blue:s=160x90:r=30","-frames:v","3","-c:v","libx264","-pix_fmt","yuv420p",video]);
  await frameIndex(video,out,2);assert.equal((await probe(out)).width,160);
  await assert.rejects(frameIndex(video,out,3),/did not decode|ffmpeg failed/);await assert.rejects(readFile(out));await assert.rejects(frame(video,out,5),/did not decode|ffmpeg failed/);await assert.rejects(readFile(out));
});
test("fact IDs preserve exact contiguous source text without concatenating evidence",()=>{
  const source="A product headline without a period\n\nA complete supporting paragraph.\n\n"+"Long original source text. ".repeat(80),facts=evidenceCatalog(source);
  assert.equal(facts[0].id,"fact-1");assert.equal(facts[0].text,"A product headline without a period");assert.ok(facts.every(f=>source.includes(f.text)&&f.text.length<=900));assert.equal(new Set(facts.map(f=>f.id)).size,facts.length);
});
test("retained plan compilation keeps bounded notes and still enforces source facts",async()=>{
  const workspace=await mkdtemp(join(tmpdir(),"video-studio-plan-")),p=fixture(),hooks={persist:async()=>{},state:async()=>{},complete:async()=>{}};
  const input={jobId:"unit",ownerId:"unit",mode:"url" as const,videoType:"launch" as const,format:"auto" as const,files:[]},evidence={text:"Actual product proof",assets:p.assets};
  const scene={assetId:"screen",headline:"Actual product proof",detail:"",evidenceId:"fact-1",durationSeconds:3,purpose:"Supported narrative explanation. ".repeat(16),referenceTechnique:"Contained product card."};
  const raw={sufficientEvidence:true,reason:"Supported",product:"Product",summary:"Product proof",accent:"#112233",background:"dark",musicPrompt:"Quiet instrumental ambient texture",sfxPrompt:"Soft interface reveal",assumptions:Array.from({length:16},(_,i)=>`Retained provider note ${i}`),scenes:[scene,scene]};
  const compiled=await compilePlan(input,evidence,raw,hooks,workspace);assert.equal(compiled.assumptions.length,16);assert.equal(compiled.scenes[0].purpose,scene.purpose);assert.equal(compiled.scenes[0].evidence,evidence.text);
  const verbose={...raw,summary:"summary ".repeat(100),scenes:[{...scene,purpose:"purpose ".repeat(130),referenceTechnique:"technique ".repeat(120)},scene]},bounded=await compilePlan(input,evidence,verbose,hooks,workspace);assert.equal(bounded.summary.length,500);assert.equal(bounded.scenes[0].purpose.length,800);assert.equal(bounded.scenes[0].reference_technique.length,800);assert.equal(verbose.summary.length,800);assert.equal(bounded.scenes[0].headline,scene.headline);assert.equal(bounded.scenes[0].evidence,evidence.text);
  await assert.rejects(compilePlan(input,evidence,{...raw,scenes:[{...scene,evidenceId:"fact-999"},scene]},hooks,workspace),(error:unknown)=>error instanceof Error&&"code"in error&&error.code==="unsupported_claim");
  await assert.rejects(compilePlan(input,evidence,{...raw,scenes:[{...scene,headline:"x".repeat(77)},scene]},hooks,workspace));
  await assert.rejects(compilePlan(input,evidence,{...raw,product:"x".repeat(49)},hooks,workspace));
  await assert.rejects(compilePlan(input,evidence,{...raw,scenes:[{...scene,detail:"x".repeat(151)},scene]},hooks,workspace));
  await assert.rejects(compilePlan(input,evidence,{...raw,scenes:[{...scene,durationSeconds:0},scene]},hooks,workspace));
  await assert.rejects(compilePlan(input,evidence,{sufficientEvidence:false,reason:"The required feature is absent from the supplied screenshots.",scenes:[]},hooks,workspace),(error:unknown)=>error instanceof Error&&"code"in error&&error.code==="insufficient_product_evidence"&&"status"in error&&error.status==="needs_input");
});
test("local fixture transport rejects unmapped URLs, byte changes and path traversal",async()=>{
  const workspace=await mkdtemp(join(tmpdir(),"video-studio-fixture-")),bytes=Buffer.from("Local test bytes"),digest=createHash("sha256").update(bytes).digest("hex");await writeFile(join(workspace,"input.md"),bytes);
  const manifest={mode:"prd",videoType:"feature-demo",format:"9:16",files:[{path:"input.md",kind:"prd",size_bytes:bytes.length,sha256:digest},{path:"input.md",kind:"asset",size_bytes:bytes.length,sha256:digest}]},path=join(workspace,"manifest.json");await writeFile(path,JSON.stringify(manifest));
  const fixture=await localFixtureInput(path);assert.deepEqual((await fixture.dependencies.readInput(fixture.input.files[0].url,100,"upload")).bytes,bytes);await assert.rejects(fixture.dependencies.readInput("http://localhost/private",100,"upload"),/Unmapped/);await assert.rejects(fixture.dependencies.readInput(fixture.input.files[0].url,1,"upload"),/limit/);
  await writeFile(join(workspace,"input.md"),Buffer.from("Changed fixtures"));await assert.rejects(fixture.dependencies.readInput(fixture.input.files[0].url,100,"upload"),/changed|verification/);
  await writeFile(path,JSON.stringify({...manifest,files:manifest.files.map(f=>({...f,path:"../input.md"}))}));await assert.rejects(localFixtureInput(path),/escapes/);
});

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
