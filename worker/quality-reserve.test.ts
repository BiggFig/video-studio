import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { Providers, qualityAudioEnvelope, qualityDefaultStyle, qualityOriginalSourceLabel, qualityRepairEnvelope, qualityReviewPrompt, qualitySceneVisibility, type AudioRuntime, type QualityRequest } from "./providers";
import { assessStoryClarity, parseReview, realVisualsPassed, reviewBatch, wholeFilmProofInventory } from "./quality";
import { PipelineError, type Asset, type Evidence, type Hooks, type Plan, type Transcript, type WorkerInput } from "./types";

const input: WorkerInput = { jobId: "quality-budget", ownerId: "fixture", mode: "url", productUrl: "https://example.com", videoType: "launch", format: "auto", files: [], budgets: { maxModelCalls: 10, maxModelInputTokens: 200_000, maxModelOutputTokens: 30_000 } };
const hooks: Hooks = { persist: async () => {}, state: async () => {}, complete: async () => {} };
const issue = (error: unknown) => error instanceof PipelineError && error.code === "model_budget" && error.status === "needs_review";
const asset = (id: string, width: number, height: number): Asset => ({ id, path: `${id}.jpg`, preview: `${id}.jpg`, kind: "image", usage: "output", width, height, rights: "Public marketing image", source: `https://example.com/${id}.jpg` });
const visual = (assetId: string) => ({ assetId, description: "Actual fixture source", supportsFactIds: ["fact-1"], showsProductUi: true });
function fixture(sceneCount = 6, source = "Verified product facts.") {
  const assets = [asset("old-small", 640, 360), asset("new-proof", 1600, 1200), asset("another-proof", 1600, 900)];
  const evidence: Evidence = { text: source, assets };
  const research = { facts: [{ evidenceId: "fact-1", quote: "Verified product facts.", label: "Product", kind: "feature" as const }], visuals: assets.map(a => visual(a.id)) };
  const scenes: Plan["scenes"] = Array.from({ length: sceneCount }, (_, i) => ({ id: `scene-${i + 1}`, start_frame: i * 150, duration_frames: 150, asset_id: assets[0].id, source_in_seconds: 0, playback_rate: 1, preserve_audio: false, fit: "contain", purpose: "Retained direction", reference_technique: "Calm entrance", headline: "A product", detail: "Real proof", evidence: research.facts[0].quote, effects: [], presentation: { template: "proof", theme: "light", transition: "cut" } }));
  const plan: Plan = { version: 1, job_id: input.jobId, mode: "create", renderer: "hyperframes", output: { width: 1920, height: 1080, fps: 30, duration_frames: sceneCount * 150 }, product: "Product", summary: "", accent: "#2266aa", background: "light", assets, scenes, captions: [], audio: [], music_prompt: "Original instrumental", sfx_prompt: "A small original sound", assumptions: [] };
  return { plan, evidence, research };
}
async function workspace(t: TestContext) {
  const root = await realpath(tmpdir()), path = await mkdtemp(join(root, "studio-quality-reserve-"));
  await mkdir(join(path, "analysis"));
  t.after(async () => { const target = await realpath(path); if (resolve(target) !== resolve(path) || dirname(target) !== root || !basename(target).startsWith("studio-quality-reserve-")) throw new Error("Unsafe test cleanup path"); await rm(target, { recursive: true, force: true }); });
  return path;
}
function environment(t: TestContext, direct = false) {
  for (const key of ["ANTHROPIC_API_KEY", "AI_GATEWAY_API_KEY", "VERCEL_OIDC_TOKEN"]) {
    const previous = process.env[key]; delete process.env[key];
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  process.env[direct ? "ANTHROPIC_API_KEY" : "AI_GATEWAY_API_KEY"] = "test-only-no-network";
}
async function provider(t: TestContext, value: ReturnType<typeof fixture>, config = input) {
  const path = await workspace(t), dimensions = new Map(value.evidence.assets.map(a => [a.preview || a.path, { width: a.width, height: a.height }]));
  for (const relative of dimensions.keys()) await writeFile(join(path, relative), "explicitly mocked image bytes");
  const runtime: AudioRuntime = { now: () => 0, sleep: async () => {}, random: () => 0, measurements: async () => ({ loudness: null, silence: [] }), probe: async path => {
    const size = dimensions.get(basename(path)); assert.ok(size, `Unexpected probed source: ${path}`);
    return { ...size, raw: {}, video: {}, audio: undefined, duration: 0 };
  } };
  const providers = new Providers(path, config, hooks, runtime); providers.skillHash = "a".repeat(64);
  return { providers, path, dimensions };
}
function context(value: ReturnType<typeof fixture>, count = 2): QualityRequest {
  const samples = value.plan.scenes.slice(0, count).flatMap(scene => Array.from({ length: 4 }, (_, i) => ({ sceneId: scene.id, path: `frame-${scene.id}-${i}.jpg`, label: `ACTUAL RENDER ${scene.id}, frame ${i} / nominal 0.000 seconds (reading hold; essential copy and proof must be complete and readable)` })));
  const batch = reviewBatch(value.plan, samples);
  return { plan: batch.plan, motion: batch.motion, wholeFilmProof: wholeFilmProofInventory(value.plan), evidence: value.evidence, defaultStyle: qualityDefaultStyle(value.plan), measurements: { loudness: { input_i: "-14.0" }, silence: [] }, heard: { text: "", words: [] }, sourceSpeech: value.plan.scenes.filter(s => s.preserve_audio).map(s => ({ scene: s.id, transcript: value.plan.assets.find(a => a.id === s.asset_id)?.transcript })) };
}

test("45k source and replacement imagery fit the shared upper envelope, including maximum escaped copy", async t => {
  environment(t); t.mock.method(globalThis, "fetch", async () => { throw new Error("No network expected for Gateway preflight"); });
  const value = fixture(2, "A".repeat(45_000)), { providers, path, dimensions } = await provider(t, value);
  // A large unrelated reference must never enter the source-image reserve.
  value.evidence.assets.push({ ...asset("reference-only", 9000, 9000), usage: "reference" });
  const reserve = await providers.qualityRepairReserve(value.plan, value.evidence, value.research);
  assert.ok(reserve.inputTokens > 45_000 + 18_000); assert.equal(reserve.calls, 1); assert.equal(reserve.outputTokens, 3000);
  value.plan.product = "\0".repeat(48);
  for (const [i, scene] of value.plan.scenes.entries()) {
    scene.asset_id = value.evidence.assets[i + 1].id; scene.headline = "\0".repeat(76); scene.detail = "\0".repeat(150);
    scene.presentation = { template: "features", theme: "light", transition: "expand", cards: Array.from({ length: 3 }, () => ({ title: "\0".repeat(44), body: "\0".repeat(100), evidenceId: "fact-1", evidence: value.research.facts[0].quote })) };
  }
  const actual = context(value), images = value.plan.scenes.flatMap(scene => Array.from({ length: 4 }, (_, i) => ({ path: `frame-${scene.id}-${i}.jpg`, label: `ACTUAL RENDER ${scene.id}, frame ${i} / nominal 0.000 seconds (reading hold; essential copy and proof must be complete and readable)` })));
  for (const image of images) { dimensions.set(image.path, { width: 1600, height: 900 }); await writeFile(join(path, image.path), "mock frame"); }
  images.push(...value.plan.scenes.map(s => ({ path: value.plan.assets.find(a => a.id === s.asset_id)!.preview!, label: qualityOriginalSourceLabel(s.asset_id,[s.id]) })));
  // A real prepare+mock response writes the estimator's actual audit; no provider
  // request leaves this process. Its fallback must fit the earlier held allowance.
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ content: [{ type: "text", text: "{}" }], usage: { input_tokens: 1000, output_tokens: 20 } })));
  await providers.claude("review", qualityReviewPrompt(actual), images, { policy: "quality-review-v1" });
  const audit = JSON.parse(await readFile(join(path, "analysis/model-1-review-budget.json"), "utf8"));
  assert.ok(audit.reservation.inputTokens <= reserve.inputTokens, `${audit.reservation.inputTokens} > ${reserve.inputTokens}`);
  assert.equal(audit.estimate.method, "conservative-fallback");
});

test("eligible replacement images are reserved while adding smaller unused candidates does not inflate every batch", async t => {
  environment(t); const value = fixture(), { providers, path } = await provider(t, value);
  const full = await providers.qualityRepairReserve(value.plan, value.evidence, value.research);
  const smallResearch = { ...value.research, visuals: [visual("old-small")] };
  const small = await providers.qualityRepairReserve(value.plan, value.evidence, smallResearch);
  assert.ok(full.inputTokens > small.inputTokens);
  value.evidence.assets.push(asset("tiny", 1, 1)); value.research.visuals.push(visual("tiny")); await writeFile(join(path, "tiny.jpg"), "tiny");
  // The test seam needs to know the newly allowed tiny image dimensions.
  const again = await provider(t, value);
  assert.deepEqual(await again.providers.qualityRepairReserve(value.plan, value.evidence, value.research), full);
});

test("directed review receives the creative choice and reserves every shot's maximum continuity metadata", () => {
  const value=fixture(2), legacy=qualityRepairEnvelope(value.plan,value.evidence,value.research);
  const claim={text:"Verified product facts.",basis:"explicit" as const,evidenceIds:["fact-1"]};
  value.plan.creativeDirection={version:1,product:"Product",researchSha256:"b".repeat(64),evidenceSha256:"c".repeat(64),audience:claim,mechanism:claim,outcome:claim,cta:claim,workflow:[{action:"Focus the actual UI",evidenceId:"fact-1",assetId:"old-small"}],brand:null,briefSha256:"a".repeat(64),concept:"focus",evidenceId:"fact-1",evidence:"Verified product facts."};
  for(const scene of value.plan.scenes)scene.direction={version:1,job:"action",motion:"focus",continuityKey:"\0".repeat(300)};
  const request=context(value), envelope=qualityRepairEnvelope(value.plan,value.evidence,value.research);
  assert.deepEqual(request.plan.creativeDirection,value.plan.creativeDirection);
  assert.match(qualityReviewPrompt(request),/CREATIVE DIRECTION:/);
  assert.match(qualityReviewPrompt(request),/continuityKey/);
  assert.ok(envelope.prompt.includes(JSON.stringify(value.plan.creativeDirection)));
  const actualAdded=Buffer.byteLength(JSON.stringify(value.plan.scenes.map(s=>({direction:s.direction}))));
  assert.ok(envelope.batches[0].variableBytes-legacy.batches[0].variableBytes>=actualAdded-3);
});

test("small direct count cannot shrink the fallback guarantee and 45k multi-page repair refuses before generation", async t => {
  environment(t, true); const value = fixture(6, "A".repeat(45_000)), { providers } = await provider(t, value);
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, options?: RequestInit) => { requests++; assert.match(String(url), /count_tokens$/); const body = JSON.parse(String(options?.body)); assert.match(body.system, /quality-review-v1/); if(requests===1)assert.ok(body.messages[0].content[0].text.includes(value.evidence.text)); return new Response(JSON.stringify({ input_tokens: 10 })); });
  const reserve = await providers.qualityRepairReserve(value.plan, value.evidence, value.research);
  assert.ok(reserve.inputTokens > input.budgets!.maxModelInputTokens!);
  await assert.rejects(providers.prepareClaude("script", "Repair this draft", [], { policy: "script-v1", reserve }), issue);
  assert.equal(providers.ledger.modelCalls, 0); assert.equal(providers.ledger.inputTokens, 0);
  assert.ok(requests <= 2); // Counter only; no generation, reservation or paid repair.
  delete process.env.ANTHROPIC_API_KEY;
  assert.deepEqual(await providers.qualityRepairReserve(value.plan, value.evidence, value.research), reserve);
});

test("a modest valid repair remains preflightable under unchanged caps and odd scene counts reserve one final scene", async t => {
  environment(t); t.mock.method(globalThis, "fetch", async () => { throw new Error("No external calls"); });
  const value = fixture(5), { providers } = await provider(t, value);
  providers.ledger.modelCalls = 3; providers.ledger.inputTokens = 20_000; providers.ledger.outputTokens = 2000;
  const reserve = await providers.qualityRepairReserve(value.plan, value.evidence, value.research);
  assert.equal(reserve.calls, 3); assert.equal(reserve.outputTokens, 9000);
  assert.ok(reserve.inputTokens < input.budgets!.maxModelInputTokens! - providers.ledger.inputTokens, `Reserve ${reserve.inputTokens} must fit the unchanged remaining allowance`);
  assert.equal(typeof await providers.prepareClaude("script", "A bounded repair request", [], { policy: "script-v1", reserve }), "function");
  assert.equal(providers.ledger.modelCalls, 3); assert.equal(providers.ledger.reservedInputTokens, 0);
  assert.deepEqual(qualityRepairEnvelope(value.plan, value.evidence, value.research).batches.map(b => b.scenes), [2, 2, 1]);
});

test("audio evidence is complete inside its source-derived envelope and oversized retained audio refuses before counting", async t => {
  environment(t, true); let calls = 0; t.mock.method(globalThis, "fetch", async () => { calls++; throw new Error("Must fail before provider access"); });
  const value = fixture(2), transcript: Transcript = { text: "Complete source sentence.", words: [{ text: "Complete source sentence.", start: 0, end: 3, type: "word" }] };
  value.evidence.assets[0].transcript = transcript; value.plan.scenes[0].preserve_audio = true;
  const request = context(value); request.heard = transcript;
  assert.ok(qualityReviewPrompt(request).includes(JSON.stringify(transcript)));
  request.heard = { text: "x".repeat(qualityAudioEnvelope(value.evidence)), words: [] };
  assert.throws(() => qualityReviewPrompt(request), issue);
  const { providers, path } = await provider(t, value);
  await writeFile(join(path, "qc.json"), JSON.stringify({ audio: { transcript: request.heard, measurements: request.measurements } }));
  await assert.rejects(providers.qualityRepairReserve(value.plan, value.evidence, value.research), issue);
  assert.equal(calls, 0); assert.equal(providers.ledger.modelCalls, 0);
});

test("compact actual QC prompt retains visible cards, source identity and full speech, without repeated director notes", () => {
  const value = fixture(2), request = context(value);
  request.plan.scenes[0].presentation = { template: "features", theme: "dark", transition: "iris", cards: [{ title: "Real feature", body: "Grounded detail", evidenceId: "fact-1", evidence: "Exact quote" }] };
  request.motion[0].presentation = request.plan.scenes[0].presentation;
  request.motion[0].realMediaVisible = false;
  const prompt = qualityReviewPrompt(request);
  assert.ok(!prompt.includes("Retained direction")); assert.ok(!prompt.includes("Calm entrance"));
  assert.equal(prompt.split("Exact quote").length - 1, 1);
  assert.ok(prompt.includes("https://example.com/old-small.jpg")); assert.ok(prompt.includes('"start_frame":0'));
  assert.ok(prompt.includes('"template":"features"')); assert.ok(prompt.includes('"evidenceId":"fact-1"'));
});

test("trusted visibility separates exact rendered copy from full grounding evidence and rejects false media flags", () => {
  const value=fixture(6),templates=["hook","brand","proof","features","offer","cta"] as const;
  for(const [i,scene]of value.plan.scenes.entries())scene.presentation={template:templates[i],theme:"light",transition:"cut"};
  value.plan.scenes[3].presentation!.cards=[{title:"Actual card",body:"Visible explanation",evidenceId:"fact-1",evidence:"Grounding quote, not copy"}];
  const request=context(value,6),visibility=qualitySceneVisibility(request.plan,request.motion);
  assert.deepEqual(visibility.map(s=>s.sourceMedia.expectedVisible),[false,false,true,false,false,false]);
  assert.deepEqual(visibility.map(s=>s.sourceMedia.role),["grounding-only","grounding-only","required-proof","grounding-only","grounding-only","grounding-only"]);
  assert.deepEqual(visibility.map(s=>s.expectedVisibleCopy.product),[undefined,"Product",undefined,undefined,undefined,"Product"]);
  assert.deepEqual(visibility[3].expectedVisibleCopy.cards,[{title:"Actual card",body:"Visible explanation"}]);
  assert.ok(!JSON.stringify(visibility).includes("Grounding quote"));
  const batch=reviewBatch(value.plan,value.plan.scenes.map(s=>({sceneId:s.id,path:`${s.id}.jpg`,label:"ACTUAL RENDER"})));
  assert.equal(batch.plan.assets.length,1);assert.equal(batch.images.at(-1)!.path,"old-small.jpg");
  assert.equal(batch.images.at(-1)!.label,qualityOriginalSourceLabel("old-small",value.plan.scenes.map(s=>s.id)));
  value.plan.scenes[1].headline="  PRODUCT  ";value.plan.scenes[5].headline="Get Product";
  const deduplicated=qualitySceneVisibility(request.plan,request.motion);
  assert.equal(deduplicated[1].expectedVisibleCopy.headline,undefined);
  assert.equal(deduplicated[1].expectedVisibleCopy.product,"Product");
  assert.equal(deduplicated[5].expectedVisibleCopy.headline,"Get Product");
  request.motion[2].realMediaVisible=false;
  assert.throws(()=>qualityReviewPrompt(request),error=>error instanceof PipelineError&&error.code==="invalid_quality_review");
});

test("whole-film proof outside a typography batch is context only and never overrides failed or missing proof", () => {
  const value=fixture(6);
  for(const scene of value.plan.scenes)scene.presentation={template:"cta",theme:"dark",transition:"cut"};
  value.plan.scenes[2].presentation={template:"proof",theme:"light",transition:"cut"};
  const request=context(value),inventory=wholeFilmProofInventory(value.plan);
  assert.ok(request.motion.every(s=>!s.realMediaVisible));
  assert.deepEqual(inventory,{totalScenes:6,plannedProofScenes:[{sceneId:"scene-3",assetId:"old-small",startFrame:300,durationFrames:150}]});
  assert.ok(qualityReviewPrompt(request).includes(JSON.stringify(inventory)));
  assert.equal(realVisualsPassed([{realVisualsPassed:true},{realVisualsPassed:false},{realVisualsPassed:true}],inventory),false);
  assert.equal(realVisualsPassed([{realVisualsPassed:true},{realVisualsPassed:true},{realVisualsPassed:true}],inventory),true);
  assert.equal(realVisualsPassed([],inventory),false);
  value.plan.scenes[2].presentation.template="offer";
  assert.equal(realVisualsPassed([{realVisualsPassed:true}],wholeFilmProofInventory(value.plan)),false);
});

test("title-only cards retain explicit empty bodies and full source quotes without inventing required copy", () => {
  const value=fixture(2),scene=value.plan.scenes[0];
  scene.presentation={template:"features",theme:"light",transition:"cut",cards:[
    {title:"Links",body:"",evidenceId:"fact-1",evidence:"The original source explains how links connect notes."},
    {title:"Graph",body:"Explore connections",evidenceId:"fact-1",evidence:"The original source describes a graph."},
  ]};
  const request=context(value),visibility=qualitySceneVisibility(request.plan,request.motion),prompt=qualityReviewPrompt(request);
  assert.deepEqual(visibility[0].expectedVisibleCopy.cards,[{title:"Links",body:""},{title:"Graph",body:"Explore connections"}]);
  assert.equal(prompt.split('"body":""').length-1,1);
  assert.ok(prompt.includes(scene.presentation.cards![0].evidence!));
  assert.ok(!JSON.stringify(visibility).includes("The original source"));
  const flags={readabilityPassed:true,claimsPassed:true,realVisualsPassed:true,renderIntegrityPassed:true,referenceStyleReviewed:true,referenceStylePassed:true,audioTranscriptPassed:true,notes:[]};
  const missingRequiredBody={severity:"major",check:"readability",sceneId:scene.id,timeSeconds:2,message:"The required Graph body is missing at the reading hold.",evidence:"Hold frame 60 lacks the required Explore connections text.",repair:"extend_hold"};
  assert.equal(parseReview({...flags,findings:[missingRequiredBody]}).readabilityPassed,false);
  assert.deepEqual(parseReview({...flags,readabilityPassed:false,findings:[missingRequiredBody]}).findings,[missingRequiredBody]);
});

test("incoming seams come from the preceding full-film scene, while cuts retain independent entry timing", () => {
  const value=fixture(6);
  value.plan.scenes[1].presentation={template:"brand",theme:"dark",transition:"lift"};
  value.plan.scenes[2].presentation={template:"proof",theme:"light",transition:"cut"};
  value.plan.scenes[3].presentation={template:"features",theme:"light",transition:"cut",cards:[{title:"Links",body:"",evidenceId:"fact-1",evidence:"Verified product facts."}]};
  const selected=value.plan.scenes.slice(2,4),batch=reviewBatch(value.plan,selected.map(s=>({sceneId:s.id,path:`${s.id}.jpg`,label:"ACTUAL RENDER"})));
  assert.deepEqual(batch.motion.map(s=>s.incomingTransition),[{fromSceneId:"scene-2",kind:"lift",frames:12},{fromSceneId:"scene-3",kind:"cut",frames:0}]);
  assert.deepEqual(batch.motion.map(s=>s.outgoingTransitionFrames),[0,0]);
  assert.deepEqual(batch.motion.map(s=>s.entrySettledByFrame),[321,475]);
  const request={...context(value),plan:batch.plan,motion:batch.motion},prompt=qualityReviewPrompt(request);
  assert.ok(prompt.includes(JSON.stringify(batch.motion[0].incomingTransition)));
  assert.ok(prompt.includes('"entrySettledByFrame":475'));
  const first=reviewBatch(value.plan,[{sceneId:"scene-1",path:"first.jpg",label:"ACTUAL RENDER"}]);
  assert.deepEqual(first.motion[0].incomingTransition,{fromSceneId:null,kind:"none",frames:0});
});

test("same-film remainder reserve covers complete exact future requests, images and output under fallback", async t => {
  environment(t); const value=fixture(2),{providers,path}=await provider(t,value);
  const requests=[{prompt:qualityReviewPrompt(context(value)),images:[{path:"new-proof.jpg",label:qualityOriginalSourceLabel("new-proof",["scene-1"])}]},{prompt:"A complete final batch with unchanged source evidence.",images:[{path:"another-proof.jpg",label:"ACTUAL RENDER final hold"}]}];
  t.mock.method(globalThis,"fetch",async()=>{throw new Error("Gateway reserve must be offline");});
  const reserve=await providers.qualityRemainderReserve(requests);
  assert.equal(reserve.calls,2);assert.equal(reserve.outputTokens,6000);assert.equal(providers.ledger.modelCalls,0);
  t.mock.method(globalThis,"fetch",async()=>new Response(JSON.stringify({content:[{type:"text",text:"{}"}],usage:{input_tokens:1000,output_tokens:20}})));
  let reservedInputs=0;
  for(const [i,request]of requests.entries()){
    await providers.claude("review",request.prompt,request.images,{policy:"quality-review-v1"});
    const audit=JSON.parse(await readFile(join(path,`analysis/model-${i+1}-review-budget.json`),"utf8"));
    reservedInputs+=audit.reservation.inputTokens;
    assert.equal(audit.reservation.outputTokens,3000);
  }
  assert.equal(reserve.inputTokens,reservedInputs);
});

test("schema re-review preserves future calls and full output rather than shrinking a charged review", async t => {
  environment(t);const value=fixture(2),{providers}=await provider(t,value);
  t.mock.method(globalThis,"fetch",async()=>{throw new Error("No provider request expected");});
  const requests=[{prompt:"Required final batch",images:[]}];
  providers.ledger.modelCalls=9;
  await assert.rejects(providers.qualityRemainderReserve(requests),issue);
  providers.ledger.modelCalls=4;providers.ledger.outputTokens=24_001;
  await assert.rejects(providers.qualityRemainderReserve(requests),issue);
  assert.equal(providers.ledger.modelCalls,4);
  providers.ledger.outputTokens=24_000;
  const reserve=await providers.qualityRemainderReserve(requests);
  assert.equal(reserve.outputTokens,3000);
  assert.equal(typeof await providers.prepareClaude("review","Fresh complete review",[],{policy:"quality-review-v1",reserve}),"function");
  assert.equal(providers.ledger.modelCalls,4);assert.equal(providers.ledger.reservedOutputTokens,0);
});


test("story checks require performed review and reject contradictory passing findings", () => {
  assert.deepEqual(assessStoryClarity([]),{performed:false,passed:false});
  assert.deepEqual(assessStoryClarity([{storyClarityPassed:true}]),{performed:false,passed:false});
  assert.deepEqual(assessStoryClarity([{storyClarityReviewed:true,storyClarityPassed:true},{storyClarityReviewed:true,storyClarityPassed:false}]),{performed:true,passed:false});
  assert.deepEqual(assessStoryClarity([{storyClarityReviewed:true,storyClarityPassed:true}]),{performed:true,passed:true});
  const review={readabilityPassed:true,claimsPassed:true,realVisualsPassed:true,renderIntegrityPassed:true,referenceStyleReviewed:true,referenceStylePassed:true,audioTranscriptPassed:true,storyClarityReviewed:true,storyClarityPassed:true,notes:[],findings:[{severity:"major",check:"storytelling",message:"Mechanism is not explained.",evidence:"Scene-1 hold shows only a price, with no named product action."}]};
  assert.equal(parseReview(review).storyClarityPassed,false);
  assert.equal(parseReview({...review,storyClarityPassed:false}).findings[0].check,"storytelling");
});

test("multi-source proof, real logo and connection copy reach their actual QC batches", () => {
  const value=fixture(3),claim={text:"Connect your ideas",basis:"explicit" as const,evidenceIds:["fact-1"]};
  value.plan.story={primaryAudience:{...claim,text:"For writers",basis:"inferred"},problem:claim,mechanism:{...claim,steps:[{action:"Link notes",assetId:"old-small",evidenceId:"fact-1"}]},outcome:claim,differentiator:claim,cta:claim};
  value.plan.brand={logoAssetId:"another-proof",background:"#111111",foreground:"#ffffff",accent:"#8855cc",sourceUrl:"https://example.com"};
  value.plan.scenes[0].storyRole="mechanism";
  value.plan.scenes[0].presentation!.visual={kind:"panels",secondaryAssetId:"new-proof",secondaryEvidenceId:"fact-1",secondaryEvidence:"Canonical secondary quote"};
  value.plan.scenes[1].presentation={template:"cta",theme:"light",transition:"cut"};
  value.plan.scenes[1].storyRole="cta";
  value.plan.scenes[2].presentation={template:"features",theme:"dark",transition:"cut",visual:{kind:"connections",nodes:[{label:"Capture",evidenceId:"fact-1",evidence:"Canonical first node quote"},{label:"Connect",evidenceId:"fact-1",evidence:"Canonical second node quote"}]}};
  const request=context(value,3),visibility=qualitySceneVisibility(request.plan,request.motion);
  assert.deepEqual(visibility[0].requiredProofAssetIds,["old-small","new-proof"]);
  assert.equal(visibility[1].requiredLogoAssetId,"another-proof");
  assert.deepEqual(visibility[2].expectedVisibleCopy.connectionLabels,["Capture","Connect"]);
  assert.ok(!JSON.stringify(visibility[2]).includes("Canonical first node quote"));
  assert.equal(request.plan.brand,value.plan.brand);assert.equal(request.plan.story,value.plan.story);
  assert.equal(request.plan.assets.length,3);
  const prompt=qualityReviewPrompt(request);
  assert.ok(prompt.includes("Canonical secondary quote"));assert.ok(prompt.includes("Canonical first node quote"));
  assert.match(prompt,/PRODUCT STORY:/);assert.match(prompt,/storyClarityReviewed=true/);
  assert.deepEqual(wholeFilmProofInventory(value.plan).storyRoles?.slice(0,2),[{sceneId:"scene-1",role:"mechanism"},{sceneId:"scene-2",role:"cta"}]);
  request.motion[0].presentation={template:"proof",theme:"light",transition:"cut",visual:{kind:"showcase"}};
  assert.throws(()=>qualitySceneVisibility(request.plan,request.motion),/contradicts/);
});

test("QC batches retain omitted wide-logo metadata without adding a source image or requiring visible pixels", () => {
  const value=fixture(1),scene=value.plan.scenes[0],logo=asset("logo",630,110);
  value.plan.assets.push(logo);
  value.plan.brand={logoAssetId:logo.id,background:"#111111",foreground:"#ffffff",accent:"#8855cc",sourceUrl:"https://example.com"};
  scene.presentation={template:"cta",theme:"dark",transition:"cut"};
  scene.direction={version:2,job:"cta",motion:"hold"};
  const samples=[{sceneId:scene.id,path:"actual-hold.jpg",label:"ACTUAL RENDER reading hold"}];
  const batch=reviewBatch(value.plan,samples),visibility=qualitySceneVisibility(batch.plan,batch.motion)[0];
  assert.deepEqual(batch.plan.assets.find(a=>a.id===logo.id),logo);
  assert.equal(visibility.requiredLogoAssetId,null);
  assert.deepEqual(visibility.requiredProofAssetIds,[]);
  assert.equal(visibility.expectedVisibleCopy.product,value.plan.product);
  assert.equal(batch.images.length,2); // One rendered sample and the scene's grounding source.
  assert.ok(!batch.images.some(image=>image.path===logo.path));
  // Losing the metadata would reproduce the original false visible-logo demand.
  assert.equal(qualitySceneVisibility({...batch.plan,assets:batch.plan.assets.filter(a=>a.id!==logo.id)},batch.motion)[0].requiredLogoAssetId,logo.id);
  scene.direction.version=1;
  const legacy=reviewBatch(value.plan,samples);
  assert.equal(qualitySceneVisibility(legacy.plan,legacy.motion)[0].requiredLogoAssetId,logo.id);
  assert.ok(legacy.images.some(image=>image.path===logo.path));
  scene.direction.version=2;logo.width=110;
  const icon=reviewBatch(value.plan,samples);
  assert.equal(qualitySceneVisibility(icon.plan,icon.motion)[0].requiredLogoAssetId,logo.id);
  assert.ok(icon.images.some(image=>image.path===logo.path));
});

test("new story repair reserve includes two originals per scene and an observed logo outside research visuals", async t => {
  environment(t);const value=fixture(2),claim={text:"Use the product",basis:"explicit" as const,evidenceIds:["fact-1"]};
  value.plan.story={primaryAudience:claim,problem:claim,mechanism:{...claim,steps:[{action:"Use it",assetId:"old-small",evidenceId:"fact-1"}]},outcome:claim,differentiator:claim,cta:claim};
  value.plan.brand={logoAssetId:"logo",background:"#111111",foreground:"#ffffff",accent:"#8855cc",sourceUrl:"https://example.com"};
  const logo=asset("logo",600,200);value.plan.assets.push(logo);
  value.evidence.brand={version:1,sourceUrl:"https://example.com",title:"Product",headings:[],callsToAction:[],colors:[],typography:[],logoAssetIds:["logo"],limitations:[]};
  const envelope=qualityRepairEnvelope(value.plan,value.evidence,value.research);
  assert.deepEqual(envelope.batches.map(b=>b.sourceImages),[4]);
  assert.ok(envelope.eligible.some(a=>a.id==="logo"));
  const {providers}=await provider(t,value);
  const reserve=await providers.qualityRepairReserve(value.plan,value.evidence,value.research);
  assert.equal(reserve.calls,1);assert.ok(reserve.inputTokens>0);
  for(const scene of value.plan.scenes)scene.presentation!.visual={kind:"panels",secondaryAssetId:"new-proof",secondaryEvidenceId:"fact-1",secondaryEvidence:value.research.facts[0].quote};
  const actualBytes=Buffer.byteLength(qualityReviewPrompt(context(value)),"utf8");
  assert.ok(actualBytes<=Buffer.byteLength(envelope.prompt,"utf8")+envelope.batches[0].variableBytes);
});


test("repair envelope retains every legal repeated event-only source transcript", () => {
  const value=fixture(4),source=value.evidence.assets[0];
  source.kind="video";source.has_audio=true;source.duration_seconds=20;
  source.transcript={text:"Instrumental source ambience.",words:Array.from({length:100},(_,i)=>({text:"A nonverbal atmospheric background event.",start:i/10,end:i/10+.05,type:"audio_event"}))};
  for(const scene of value.plan.scenes)scene.preserve_audio=true;
  const envelope=qualityRepairEnvelope(value.plan,value.evidence,value.research),request=context(value);
  assert.equal(request.sourceSpeech.length,4);
  const actual=Buffer.byteLength(qualityReviewPrompt(request),"utf8");
  assert.ok(actual<=Buffer.byteLength(envelope.prompt,"utf8")+envelope.batches[0].variableBytes,`${actual} exceeded retained transcript reserve`);
});
