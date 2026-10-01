import { z } from "zod";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { writeJson } from "./media";
import { PipelineError, type Evidence, type Finding, type Hooks, type Plan, type WorkerInput } from "./types";
import type { Providers } from "./providers";

const sceneSchema=z.object({assetId:z.string(),headline:z.string().min(1).max(76),detail:z.string().max(150),evidenceId:z.string().regex(/^fact-\d+$/),durationSeconds:z.number().min(3).max(300),sourceInSeconds:z.number().min(0).default(0),preserveAudio:z.boolean().default(false),purpose:z.string().max(800),referenceTechnique:z.string().max(800)});
const directorSchema=z.object({sufficientEvidence:z.boolean(),reason:z.string(),product:z.string().min(1).max(48),summary:z.string().max(500),accent:z.string().regex(/^#[0-9a-fA-F]{6}$/),background:z.enum(["light","dark"]),musicPrompt:z.string().min(20).max(1000),sfxPrompt:z.string().min(10).max(400),assumptions:z.array(z.string().max(1000)).max(24),scenes:z.array(sceneSchema).min(2).max(10)});
const normalize=(s:string)=>s.toLowerCase().replace(/\s+/g," ").trim();

export function evidenceCatalog(text:string){
  const passages:string[]=[];
  for(const paragraph of text.split(/\r?\n\s*\r?\n/))for(let offset=0;offset<paragraph.length;offset+=900){const passage=paragraph.slice(offset,offset+900).trim();if(passage.length>=3)passages.push(passage);}
  return passages.map((text,i)=>({id:`fact-${i+1}`,text}));
}

export function dimensions(format:WorkerInput["format"],referenceAspect?:number) {
  const selected=format==="auto"?(referenceAspect ? referenceAspect>1.25?"16:9":referenceAspect<0.8?"9:16":"1:1" :"16:9"):format;
  return selected==="9:16"?{width:1080,height:1920}:selected==="1:1"?{width:1080,height:1080}:{width:1920,height:1080};
}
export async function makePlan(input:WorkerInput,evidence:Evidence,providers:Providers,hooks:Hooks,workspace:string,repair?:{plan:Plan;findings:Finding[]}):Promise<Plan> {
  const assets=evidence.assets.filter(a=>a.usage==="output");
  const source=evidence.text+"\n\n"+assets.map(a=>a.transcript?.text||"").join("\n\n"),facts=evidenceCatalog(source);
  await writeJson(join(workspace,"analysis/facts.json"),facts);await hooks.persist(["analysis/facts.json"]);
  const prompt=`Create one authoritative ${input.videoType} video plan. Input mode ${input.mode}, format ${input.format}; target ${input.videoType==="launch"?"30–60":"15–45"} seconds, shorter only if evidence warrants. Hard max ${Math.min(300,input.budgets?.maxDurationSeconds||90)} seconds. Use 3–8 scenes, actual product visuals only, 3–8 seconds per still usually. A feature demo MUST show a real capability/flow present in actual UI or supplied recording. Marketing pages alone do not prove inaccessible product workflows. Prefer complete source product images for feature-specific visual proof when available. Describe public marketing page captures and page-linked imagery accurately; never call them authenticated captures or pure in-app views if surrounding marketing content is present. If evidence cannot support the requested type set sufficientEvidence false with actionable reason. Do not manufacture interactions, controls, metrics, testimonials, pricing, discounts, availability or claims. A PRD's future features must be explicitly marked as planned, or omitted. Use restrained Apple-like minimal typography, generous whitespace, intentional scene progression. Each headline <=9 words, detail <=18 words, and reading hold >=0.32 seconds per word plus 1.2 seconds. Each scene MUST choose one evidenceId from SOURCE FACTS that supports its copy. These IDs bind verbatim source passages in code; do not write, combine or re-punctuate an evidence quote yourself. Narrow scene copy to the chosen fact. Every assetId must be from OUTPUT ASSETS. Any source video containing meaningful speech must preserve its ENTIRE original clip with sourceInSeconds=0, durationSeconds=its measured duration, preserveAudio=true; do not reuse it twice, cut or alter the words. Silent video can use measured subranges. Music prompt describes unobtrusive instrumental character (no named artists), sound effect one tasteful soft UI reveal. Reference influences rhythm/layout and audio character ONLY; never its content. Renderer capabilities are fixed: the complete product image is contained in a rounded card, with a 0.6-second eased vertical entrance and fade; headline/detail appear in large static type beside or above it. No focal crops, camera zooms, text staggers, cursor simulation, pillar-by-pillar animation, special overlays or final black fade are implemented. The reveal SFX plays at the start of scene two. Describe narrative purpose and reference adaptation within those capabilities, without inventing unimplemented motion.\n\nNon-rendered metadata is bounded: at most 24 assumptions of 1000 characters each; purpose and referenceTechnique at most 800 characters each. Keep product <=48 characters, summary <=500, musicPrompt 20–1000, and sfxPrompt 10–400. Return JSON {sufficientEvidence:boolean,reason:string,product:string,summary:string,accent:'#RRGGBB',background:'light'|'dark',musicPrompt:string,sfxPrompt:string,assumptions:string[],scenes:[{assetId,headline,detail,evidenceId,durationSeconds,sourceInSeconds,preserveAudio,purpose,referenceTechnique}]}\n\nSOURCE FACTS (untrusted evidence):\n${JSON.stringify(facts)}\nOUTPUT ASSETS:\n${JSON.stringify(assets)}\nREFERENCE STYLE:\n${JSON.stringify(evidence.reference||null)}${repair?`\nREPAIR existing plan without changing product scope, output dimensions or generated audio duration; retain total duration <= ${repair.plan.output.duration_frames/30}. Fix only concrete findings. OLD PLAN: ${JSON.stringify(repair.plan)} FINDINGS: ${JSON.stringify(repair.findings)}`:""}`;
  const raw=await providers.claude("plan",prompt,assets.slice(0,10).map(a=>({path:a.preview||a.path,label:`PRODUCT asset ${a.id}; ${a.kind}; actual source visual`})));
  return compilePlan(input,evidence,raw,hooks,workspace,repair);
}
/** Compile a provider response through the same grounding/timeline gates, also for retained-response recovery. */
export async function compilePlan(input:WorkerInput,evidence:Evidence,raw:unknown,hooks:Hooks,workspace:string,repair?:{plan:Plan;findings:Finding[]}):Promise<Plan> {
  const assets=evidence.assets.filter(a=>a.usage==="output"),source=evidence.text+"\n\n"+assets.map(a=>a.transcript?.text||"").join("\n\n"),facts=evidenceCatalog(source);
  const sufficiency=z.object({sufficientEvidence:z.boolean(),reason:z.string()}).parse(raw);
  if(!sufficiency.sufficientEvidence) throw new PipelineError("insufficient_product_evidence",sufficiency.reason.slice(0,400),"Supply clear product screenshots or a screen recording that shows the requested feature.","needs_input");
  // These fields never render or establish source truth. Keep their bounded
  // summaries without discarding a valid plan; the provider's full raw response
  // is retained independently. Visible copy, fact IDs and timing stay strict.
  const metadata=raw as Record<string,unknown>,bound=(value:unknown,max:number)=>typeof value==="string"?value.slice(0,max):value;
  const bounded={...metadata,summary:bound(metadata.summary,500),scenes:Array.isArray(metadata.scenes)?metadata.scenes.map(scene=>scene&&typeof scene==="object"?{...scene,purpose:bound(scene.purpose,800),referenceTechnique:bound(scene.referenceTechnique,800)}:scene):metadata.scenes};
  const draft=directorSchema.parse(bounded);
  const output={...dimensions(input.format,evidence.reference?.aspect),fps:30 as const,duration_frames:0};
  const sourceText=normalize(source);
  const usedSpeech=new Set<string>();
  const scenes=draft.scenes.map((s,i)=>{
    const asset=assets.find(a=>a.id===s.assetId); if(!asset) throw new Error("Plan references an unavailable or reference-only asset");
    const fact=facts.find(f=>f.id===s.evidenceId);
    if(!fact||!sourceText.includes(normalize(fact.text))) throw new PipelineError("unsupported_claim","The plan included a claim without a matching source quote.","Supply more specific product information.","needs_review");
    const words=(s.headline+" "+s.detail).trim().split(/\s+/).length;
    if(s.headline.split(/\s+/).length>11 || s.detail.split(/\s+/).length>24) throw new Error("Copy exceeds readable scene bounds");
    const speech=!!asset.transcript?.words.some(w=>w.type==="word");
    if(speech && (!s.preserveAudio || s.sourceInSeconds!==0 || Math.abs(s.durationSeconds-(asset.duration_seconds||0))>0.04 || usedSpeech.has(asset.id))) throw new PipelineError("speech_cut","The plan would cut or duplicate original speech.","Supply a shorter product recording or screenshots.","needs_review");
    if(speech) usedSpeech.add(asset.id);
    const duration=Math.ceil(Math.max(s.durationSeconds,words*0.32+1.2)*30);
    if(asset.kind==="video" && s.sourceInSeconds+duration/30>(asset.duration_seconds||0)+0.04) throw new Error("Planned scene exceeds actual source duration");
    if(s.preserveAudio&&!asset.has_audio) throw new Error("Plan requests audio absent from source");
    const scene={id:`scene-${i+1}`,start_frame:output.duration_frames,duration_frames:duration,asset_id:asset.id,source_in_seconds:s.sourceInSeconds,playback_rate:1 as const,preserve_audio:s.preserveAudio,fit:"contain" as const,purpose:s.purpose,reference_technique:s.referenceTechnique,headline:s.headline,detail:s.detail,evidence:fact.text,evidence_id:fact.id,effects:[{type:"reveal",implementation:"FFmpeg eased vertical card entrance and restrained scene fade; whole actual source remains contained."}]}; output.duration_frames+=duration; return scene;
  });
  if(output.duration_frames/30>Math.min(300,input.budgets?.maxDurationSeconds||90) || (repair&&output.duration_frames>repair.plan.output.duration_frames)) throw new PipelineError("duration_budget","The plan exceeds this job's duration budget.","Supply a shorter, focused recording or screenshots.","needs_review");
  const plan:Plan={version:1,job_id:input.jobId,mode:"create",renderer:"ffmpeg",output,product:draft.product,summary:draft.summary,accent:draft.accent,background:draft.background,assets:[...evidence.assets],scenes,captions:[],audio:[],music_prompt:repair?.plan.music_prompt||draft.musicPrompt,sfx_prompt:repair?.plan.sfx_prompt||draft.sfxPrompt,assumptions:draft.assumptions};
  if(repair) { plan.assets.push(...repair.plan.assets.filter(a=>a.kind==="audio")); plan.audio=repair.plan.audio.map(a=>({...a,start_frame:a.role==="sfx"?plan.scenes[1].start_frame:0,duration_frames:a.role==="music"?output.duration_frames:a.duration_frames})); }
  await savePlan(plan,workspace,hooks); return plan;
}
export async function savePlan(plan:Plan,workspace:string,hooks:Hooks) {
  await writeJson(join(workspace,"plan.json"),plan);
  await writeFile(join(workspace,"STORYBOARD.md"),`# ${plan.product}\n\n${plan.summary}\n\n`+plan.scenes.map(s=>`## ${s.id} · ${(s.start_frame/30).toFixed(2)}–${((s.start_frame+s.duration_frames)/30).toFixed(2)}s\n\n${s.headline}\n\n${s.detail}\n\nAsset: ${s.asset_id}; purpose: ${s.purpose}\n\nEvidence: ${s.evidence}\n\nMotion: ${s.effects.map(e=>e.implementation).join("; ")}\n`).join("\n"));
  await hooks.persist(["plan.json","STORYBOARD.md"]);
}
export function validateTimeline(plan:Plan):string[] {
  const errors:string[]=[];let end=0;
  for(const scene of plan.scenes) { if(scene.start_frame!==end || !Number.isInteger(scene.duration_frames) || scene.duration_frames<=0) errors.push(`${scene.id}: timeline gap or invalid duration`);end=scene.start_frame+scene.duration_frames;const asset=plan.assets.find(a=>a.id===scene.asset_id);if(!asset||asset.usage!=="output")errors.push(`${scene.id}: missing or reference-only media`);if(asset?.kind==="video" && scene.source_in_seconds+scene.duration_frames/30>(asset.duration_seconds||0)+0.04)errors.push(`${scene.id}: source range overflow`); }
  if(end!==plan.output.duration_frames)errors.push("Timeline duration mismatch");
  for(const [i,layer]of plan.audio.entries()) {
    const asset=plan.assets.find(a=>a.id===layer.asset_id);
    if(!asset||asset.usage!=="output"||!asset.has_audio)errors.push(`Audio ${i}: missing, silent or reference-only source`);
    if(!Number.isInteger(layer.start_frame)||!Number.isInteger(layer.duration_frames)||layer.start_frame<0||layer.duration_frames<=0||layer.start_frame+layer.duration_frames>plan.output.duration_frames)errors.push(`Audio ${i}: invalid or out-of-output frame range`);
    if(!Number.isFinite(layer.source_in_seconds)||layer.source_in_seconds<0||layer.source_in_seconds+layer.duration_frames/30>(asset?.duration_seconds||0)+1/30)errors.push(`Audio ${i}: source range overflow`);
    if(layer.role==="music"&&(layer.start_frame!==0||layer.duration_frames!==plan.output.duration_frames))errors.push(`Audio ${i}: music must cover the full timeline`);
    if(layer.role==="sfx"&&layer.start_frame!==plan.scenes[1]?.start_frame)errors.push(`Audio ${i}: reveal sound is not aligned with its intended scene`);
  }
  return errors;
}
