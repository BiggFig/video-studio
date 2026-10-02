import { z } from "zod";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { writeJson } from "./media";
import { PipelineError, type Asset, type Evidence, type Finding, type Hooks, type Plan, type Presentation, type WorkerInput } from "./types";
import type { Providers } from "./providers";
import { evidenceCatalog, researchProduct, stageDigest, stageFailure, type Research } from "./research";
import { explicitPrice, prepareRetainedScriptRepair, prepareScriptRepair, scriptDraftSchema, scriptSchema, writeScript } from "./scripting";
import { motionTimingForPresentation } from "./motion-timing";
export { evidenceCatalog } from "./research";

const directorSchema=scriptDraftSchema;
const normalize=(s:string)=>s.toLowerCase().replace(/\s+/g," ").trim();

export function dimensions(format:WorkerInput["format"],referenceAspect?:number) {
  const selected=format==="auto"?(referenceAspect ? referenceAspect>1.25?"16:9":referenceAspect<0.8?"9:16":"1:1" :"16:9"):format;
  return selected==="9:16"?{width:1080,height:1920}:selected==="1:1"?{width:1080,height:1080}:{width:1920,height:1080};
}
export async function makePlan(input:WorkerInput,evidence:Evidence,providers:Providers,hooks:Hooks,workspace:string,repair?:{plan:Plan;findings:Finding[]}):Promise<Plan> {
  const research=await researchProduct(input,evidence,providers,hooks,workspace);
  if(repair)return(await preparePlanRepair(input,evidence,research,providers,hooks,workspace,repair))();
  const script=await writeScript(input,evidence,research,providers,hooks,workspace);
  return compilePlan(input,evidence,script,hooks,workspace);
}
export async function preparePlanRepair(input:WorkerInput,evidence:Evidence,research:Research,providers:Providers,hooks:Hooks,workspace:string,repair:{plan:Plan;findings:Finding[]}) {
  const reserve=await providers.qualityRepairReserve(repair.plan,evidence,research);
  const generate=await prepareScriptRepair(input,evidence,research,providers,hooks,workspace,repair,reserve);
  return async()=>compilePlan(input,evidence,await generate(),hooks,workspace,repair);
}
export async function prepareRetainedPlanRepair(input:WorkerInput,evidence:Evidence,raw:unknown,hooks:Hooks,workspace:string,repair:{plan:Plan;findings:Finding[]}) {
  const persistScript=await prepareRetainedScriptRepair(input,evidence,raw,hooks,workspace,repair);
  return async()=>compilePlan(input,evidence,await persistScript(),hooks,workspace,repair);
}
/** Compile a provider response through the same grounding/timeline gates, also for retained-response recovery. */
export async function compilePlan(input:WorkerInput,evidence:Evidence,raw:unknown,hooks:Hooks,workspace:string,repair?:{plan:Plan;findings:Finding[]}):Promise<Plan> {
  if(repair?.plan.production){
    const script=scriptSchema.safeParse(raw),previous=repair.plan.production;
    if(!script.success||repair.plan.job_id!==input.jobId||script.data.jobId!==input.jobId||script.data.researchSha256!==previous.researchSha256||script.data.evidenceSha256!==previous.evidenceSha256)throw stageFailure("A production-bound plan requires a repaired script verified against the same research and evidence.");
  }
  const assets=evidence.assets.filter(a=>a.usage==="output"),source=evidence.text+"\n\n"+assets.map(a=>a.transcript?.text||"").join("\n\n"),facts=evidenceCatalog(source);
  const sufficiency=z.object({sufficientEvidence:z.boolean(),reason:z.string()}).parse(raw);
  if(!sufficiency.sufficientEvidence) throw new PipelineError("insufficient_product_evidence",sufficiency.reason.slice(0,400),"Supply clear product screenshots or a screen recording that shows the requested feature.","needs_input");
  // These fields never render or establish source truth. Keep their bounded
  // summaries without discarding a valid plan; the provider's full raw response
  // is retained independently. Visible copy, fact IDs and timing stay strict.
  const metadata=raw as Record<string,unknown>,bound=(value:unknown,max:number)=>typeof value==="string"?value.slice(0,max):value;
  const bounded={...metadata,summary:bound(metadata.summary,500),scenes:Array.isArray(metadata.scenes)?metadata.scenes.map(scene=>scene&&typeof scene==="object"?{...scene,purpose:bound(scene.purpose,800),referenceTechnique:bound(scene.referenceTechnique,800)}:scene):metadata.scenes};
  const draft=directorSchema.parse(bounded);
  if(repair&&draft.scenes.length>repair.plan.scenes.length)throw new PipelineError("repair_scene_budget","A repair cannot increase this job's reserved quality-review batches.","Ask the administrator to inspect the retained script.","needs_review");
  const output={...dimensions(input.format,evidence.reference?.aspect),fps:30 as const,duration_frames:0};
  const sourceText=normalize(source);
  const usedSpeech=new Set<string>();
  const stillBindings:Asset[]=[];
  const scenes=draft.scenes.map((s,i)=>{
    let asset=assets.find(a=>a.id===s.assetId); if(!asset) throw new Error("Plan references an unavailable or reference-only asset");
    const fact=facts.find(f=>f.id===s.evidenceId);
    if(!fact||!sourceText.includes(normalize(fact.text))) throw new PipelineError("unsupported_claim","The plan included a claim without a matching source quote.","Supply more specific product information.","needs_review");
    let presentation:Presentation|undefined;
    if(s.presentation){
      if(s.presentation.template==="offer"&&!explicitPrice(fact.text))throw new PipelineError("unsupported_claim","The offer scene has no actual pricing or free-offer evidence.","Supply the product's current offer or omit this scene.","needs_review");
      if(s.presentation.cards&&!["features","offer"].includes(s.presentation.template))throw new Error("Only feature and offer scenes support informational cards");
      presentation={...s.presentation,cards:s.presentation.cards?.map(card=>{
        const evidence=facts.find(f=>f.id===card.evidenceId)?.text;
        if(!evidence)throw new PipelineError("unsupported_claim","An informational card references an unavailable source fact.","Supply the missing feature evidence.","needs_review");
        if(s.presentation!.template==="offer"&&!explicitPrice(evidence))throw new PipelineError("unsupported_claim","An offer card has no actual pricing or free-offer evidence.","Use only pricing explicitly supported by the supplied product source.","needs_review");
        if((card.title+" "+card.body).trim().split(/\s+/).length>16)throw new Error("Card copy exceeds readable bounds");
        return{...card,evidence};
      })};
      if(s.preserveAudio)presentation.transition="cut";
    }
    // Typography retains source provenance without replaying a spoken recording.
    // A real saved preview also keeps the shared media validator's source bounds honest.
    if(presentation&&presentation.template!=="proof"&&asset.kind==="video"){
      if(s.preserveAudio||s.sourceInSeconds!==0||!asset.preview)throw new Error("Typography requires a still source preview and cannot consume recording audio");
      const id=`${asset.id}-typography-still`,existing=stillBindings.find(a=>a.id===id);
      if(assets.some(a=>a.id===id))throw new Error("Typography source binding collides with an existing asset");
      const original=asset;
      asset=existing||{id,path:original.preview!,preview:original.preview,kind:"image",usage:"output",rights:`${original.rights} Actual saved preview of ${original.id}; typography provenance only, not an invented product screen.`,width:original.width,height:original.height,source:original.source};
      if(!existing)stillBindings.push(asset);
    }
    const brandWords=presentation&&["brand","cta"].includes(presentation.template)?draft.product:"";
    const words=(brandWords+" "+s.headline+" "+s.detail+" "+(presentation?.cards||[]).map(card=>card.title+" "+card.body).join(" ")).trim().split(/\s+/).length;
    if(s.headline.split(/\s+/).length>11 || s.detail.split(/\s+/).length>24) throw new Error("Copy exceeds readable scene bounds");
    const speech=!!asset.transcript?.words.some(w=>w.type==="word");
    if(presentation&&s.preserveAudio&&presentation.template!=="proof")throw new Error("Original speech requires visible proof media");
    if(speech && (!s.preserveAudio || s.sourceInSeconds!==0 || Math.abs(s.durationSeconds-(asset.duration_seconds||0))>0.04 || usedSpeech.has(asset.id))) throw new PipelineError("speech_cut","The plan would cut or duplicate original speech.","Supply a shorter product recording or screenshots.","needs_review");
    if(speech) usedSpeech.add(asset.id);
    // Still holds may be serialized as rounded seconds during repair; nearest-frame
    // quantization avoids adding a frame each time. Reading and source speech never round down.
    const requestedFrames=asset.kind==="image"?Math.round(s.durationSeconds*30):Math.ceil(s.durationSeconds*30);
    // Hundredths keep exact reading boundaries (20 words = 228 frames) from
    // gaining a frame through binary floating-point addition before Math.ceil.
    const motion=presentation?motionTimingForPresentation(presentation,!!s.detail):{entryFrames:0,exitFrames:0};
    const readingFrames=Math.ceil(((words*32+120)*30)/100)+motion.entryFrames+(i===draft.scenes.length-1?0:motion.exitFrames);
    const duration=Math.max(requestedFrames,readingFrames,speech?Math.ceil((asset.duration_seconds||0)*30):0);
    if(asset.kind==="video" && s.sourceInSeconds+duration/30>(asset.duration_seconds||0)+0.04) throw new Error("Planned scene exceeds actual source duration");
    if(s.preserveAudio&&!asset.has_audio) throw new Error("Plan requests audio absent from source");
    const scene={id:`scene-${i+1}`,start_frame:output.duration_frames,duration_frames:duration,asset_id:asset.id,source_in_seconds:s.sourceInSeconds,playback_rate:1 as const,preserve_audio:s.preserveAudio,fit:"contain" as const,purpose:s.purpose,reference_technique:s.referenceTechnique,headline:s.headline,detail:s.detail,evidence:fact.text,evidence_id:fact.id,...(presentation?{presentation}:{}),effects:[{type:"reveal",implementation:presentation?`Trusted frame-driven HTML ${presentation.template} template; ${presentation.transition} outgoing transition; grounded typography/cards and contained actual proof media.`:"FFmpeg eased vertical card entrance and restrained scene fade; whole actual source remains contained."}]}; output.duration_frames+=duration; return scene;
  });
  if(output.duration_frames/30>Math.min(300,input.budgets?.maxDurationSeconds||90) || (repair&&output.duration_frames>repair.plan.output.duration_frames)) throw new PipelineError("duration_budget","The plan exceeds this job's duration budget.","Supply a shorter, focused recording or screenshots.","needs_review");
  const plan:Plan={version:1,job_id:input.jobId,mode:"create",renderer:scenes.some(scene=>scene.presentation)?"hyperframes":"ffmpeg",output,product:draft.product,summary:draft.summary,accent:draft.accent,background:draft.background,assets:[...evidence.assets,...stillBindings],scenes,captions:[],audio:[],music_prompt:repair?.plan.music_prompt||draft.musicPrompt,sfx_prompt:repair?.plan.sfx_prompt||draft.sfxPrompt,assumptions:draft.assumptions};
  const binding=z.object({researchSha256:z.string().regex(/^[a-f0-9]{64}$/),evidenceSha256:z.string().regex(/^[a-f0-9]{64}$/)}).safeParse(raw);
  if(binding.success)plan.production={...binding.data,scriptSha256:stageDigest(raw)};
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
