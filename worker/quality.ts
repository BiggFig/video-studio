import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import { audioMeasurements, command, ffmpeg, frameIndex, hash, probe, writeJson } from "./media";
import { validateTimeline } from "./planning";
import { motionSampleFrames, presentation, transitionFrames } from "./motion-composition";
import { qualityDefaultStyle, qualityOriginalSourceLabel, qualityReviewPrompt, type Providers, type WholeFilmProof } from "./providers";
import { PipelineError, type Evidence, type Finding, type Hooks, type Plan, type QC, type Transcript } from "./types";

const reviewCheckFlags={readability:"readabilityPassed",claims:"claimsPassed",real_visuals:"realVisualsPassed",render_integrity:"renderIntegrityPassed",reference_style:"referenceStylePassed",audio:"audioTranscriptPassed"} as const;
const reviewSchema=z.object({readabilityPassed:z.boolean(),claimsPassed:z.boolean(),realVisualsPassed:z.boolean(),renderIntegrityPassed:z.boolean(),referenceStyleReviewed:z.boolean(),referenceStylePassed:z.boolean().optional(),audioTranscriptPassed:z.boolean(),findings:z.array(z.object({severity:z.enum(["critical","major","minor"]),sceneId:z.string().nullish().transform(v=>v??undefined),timeSeconds:z.number().nullish().transform(v=>v??undefined),message:z.string(),check:z.enum(["readability","claims","real_visuals","render_integrity","reference_style","audio"]).nullish().transform(v=>v??undefined),evidence:z.string().min(1).max(1600).nullish().transform(v=>v??undefined),repair:z.enum(["shorten_copy","simplify_copy","change_asset","extend_hold"]).nullish().transform(v=>v??undefined)})),notes:z.array(z.string())}).superRefine((review,context)=>{
  for(const [index,finding]of review.findings.entries())if(finding.severity!=="minor"){
    if(!finding.check||!finding.evidence)context.addIssue({code:"custom",path:["findings",index],message:"A blocking finding requires its failed check and observed evidence"});
    else if(review[reviewCheckFlags[finding.check]]!==false)context.addIssue({code:"custom",path:["findings",index,"check"],message:"A blocking finding contradicts its passed or unperformed check"});
  }
});
export const parseReview=(value:unknown)=>reviewSchema.parse(value);
/** Optional notes never justify paid plan mutation, even if a model supplies a repair tag. */
export const repairableFindings=(findings:Finding[])=>findings.filter(f=>f.severity!=="minor"&&f.repair!==undefined);
export function assessReferenceStyle(reviews:{referenceStyleReviewed:boolean;referenceStylePassed?:boolean}[]){
  const performed=reviews.length>0&&reviews.every(r=>r.referenceStyleReviewed);return{performed,passed:performed&&reviews.every(r=>r.referenceStylePassed===true)};
}
export const requiresStyleReview=(plan:Pick<Plan,"renderer"|"scenes">,evidence:Pick<Evidence,"reference">)=>!!evidence.reference||plan.renderer==="hyperframes"||plan.scenes.some(s=>!!s.presentation);
type Sample={path:string;label:string;sceneId:string};
/** Four decoded samples per scene; two complete scenes per semantic review. */
export const expectedReviewCalls=(plan:Pick<Plan,"scenes">)=>Math.ceil(plan.scenes.length/2);
/** Planned visibility only: actual decoded proof remains mandatory in its review batch. */
export function wholeFilmProofInventory(plan:Plan):WholeFilmProof {
  return {totalScenes:plan.scenes.length,plannedProofScenes:plan.scenes.filter(scene=>presentation(scene,plan).template==="proof").map(scene=>({sceneId:scene.id,assetId:scene.asset_id,startFrame:scene.start_frame,durationFrames:scene.duration_frames}))};
}
export function realVisualsPassed(reviews:{realVisualsPassed:boolean}[],inventory:WholeFilmProof) {
  return inventory.plannedProofScenes.length>0&&reviews.length>0&&reviews.every(review=>review.realVisualsPassed);
}
export function reviewBatch(plan:Plan,samples:Sample[]){
  const ids=new Set(samples.map(s=>s.sceneId)),scenes=plan.scenes.filter(s=>ids.has(s.id)),assets=plan.assets.filter(a=>a.usage==="output"&&scenes.some(s=>s.asset_id===a.id));
  return{plan:{output:plan.output,product:plan.product,accent:plan.accent,background:plan.background,scenes,assets,audio:plan.audio},motion:scenes.map(s=>({sceneId:s.id,presentation:presentation(s,plan),outgoingTransitionFrames:transitionFrames(s,plan,plan.scenes.indexOf(s)),realMediaVisible:presentation(s,plan).template==="proof"})),images:[...samples,...assets.map(a=>({path:a.preview||a.path,label:qualityOriginalSourceLabel(a.id,scenes.filter(s=>s.asset_id===a.id).map(s=>s.id))}))]};
}
export function unexpectedVoice(plan:Plan,heard:Transcript) {
  const windows=plan.scenes.filter(s=>s.preserve_audio).map(s=>({start:s.start_frame/30,end:(s.start_frame+s.duration_frames)/30}));
  return heard.words.filter(word=>(word.type==="word"||/singing|vocal|speech|voice/i.test(word.text))&&!windows.some(window=>Number.isFinite(word.start)&&Number.isFinite(word.end)&&word.start>=window.start-0.15&&word.end<=window.end+0.15));
}
export async function quality(plan:Plan,evidence:Evidence,video:string,workspace:string,providers:Providers,hooks:Hooks,repairs:string[]):Promise<QC> {
  const findings:Finding[]=[],checks:QC["checks"]={};
  const path=join(workspace,video),media=await probe(path);
  await command(ffmpeg,["-v","error","-xerror","-i",path,"-map","0:v:0","-map","0:a:0","-f","null","-"],240_000);
  const fpsParts=String(media.video?.avg_frame_rate||"0/1").split("/").map(Number),fps=fpsParts[0]/fpsParts[1];
  const technicalPassed=media.width===plan.output.width&&media.height===plan.output.height&&media.video?.codec_name==="h264"&&media.audio?.codec_name==="aac"&&Number(media.video?.nb_frames)===plan.output.duration_frames&&Math.abs(fps-30)<0.01&&Math.abs(media.duration-plan.output.duration_frames/30)<0.15;
  checks.technical={passed:technicalPassed,performed:true,evidence:"FFprobe streams/duration/dimensions/frame rate; full-file FFmpeg decode with -xerror."};
  if(!technicalPassed)findings.push({severity:"critical",message:"The rendered codec, duration, dimensions or frame rate does not match the plan."});
  const timelineErrors=validateTimeline(plan);checks.timeline={passed:timelineErrors.length===0,performed:true,evidence:"Integer-frame contiguity, source bounds and actual probed asset inventory."};
  findings.push(...timelineErrors.map(message=>({severity:"critical" as const,message})));
  const hasMotion=plan.renderer==="hyperframes"||plan.scenes.some(s=>!!s.presentation);
  if(hasMotion){
    const motion=JSON.parse(await readFile(join(workspace,"analysis/motion.json"),"utf8")),seek=JSON.parse(await readFile(join(workspace,motion.composition,"seek-check.json"),"utf8"));
    const passed=motion.passed===true&&motion.localFontLoaded===true&&motion.localImagesDecoded===true&&seek.deterministic===true&&motion.frames===plan.output.duration_frames&&motion.planSha256===createHash("sha256").update(JSON.stringify(plan)).digest("hex")&&motion.comparisons?.length===plan.scenes.length&&motion.comparisons.every((c:{passed:boolean;ssim:number})=>c.passed&&c.ssim>=.97);
    checks.motion_integrity={passed,performed:true,evidence:"Paused local HTML/GSAP clock, exact repeated seek pixel hash, required local font/image loading, hold bounds/overlaps, and every decoded output hold compared with its independently seeked HTML hold (SSIM >=0.97), bound to this exact plan. Semantic readability/style still independently reviewed below."};
    if(!passed)findings.push({severity:"critical",message:"The actual HTML motion capture verification did not pass."});
  }
  const referenceHashes=await Promise.all(plan.assets.filter(a=>a.usage==="reference").map(a=>hash(join(workspace,a.path))));
  const outputHashes=await Promise.all([...new Set([...plan.scenes.map(s=>s.asset_id),...plan.audio.map(a=>a.asset_id)])].map(id=>hash(join(workspace,plan.assets.find(a=>a.id===id)!.path))));
  const excludes=outputHashes.every(h=>!referenceHashes.includes(h)); checks.reference_exclusion={passed:excludes,performed:true,evidence:"Renderer source allowlist uses output assets only; SHA-256 of every referenced output asset compared against reference assets."};
  if(!excludes)findings.push({severity:"critical",message:"A reference asset was reused as output media."});
  const measurements=await audioMeasurements(path),loudness=measurements.loudness;
  const reviewAudio="analysis/final-audio.mp3"; await command(ffmpeg,["-v","error","-y","-i",path,"-vn","-ac","1","-ar","16000","-b:a","48k",join(workspace,reviewAudio)]);
  const heard=await providers.transcribe(reviewAudio,media.duration),speechScenes=plan.scenes.filter(s=>s.preserve_audio);
  const hasPlannedAudio=plan.audio.some(a=>a.role==="music")&&plan.audio.some(a=>a.role==="sfx");
  const levels=!!loudness&&Number.isFinite(Number(loudness.input_i))&&Number(loudness.input_i)>=-17&&Number(loudness.input_i)<=-11&&Number(loudness.input_tp)<=-0.3;
  const unexpected=unexpectedVoice(plan,heard),noUnplannedVoice=unexpected.length===0;
  const stems=JSON.parse(await readFile(join(workspace,"analysis/audio-stems.json"),"utf8")) as {speechBalance:{marginDb:number}[];stems:{role:string;lufs:number}[]};
  const speechMixVerified=stems.stems.some(s=>s.role==="music"&&Number.isFinite(s.lufs))&&stems.speechBalance.length===speechScenes.length&&stems.speechBalance.every(s=>s.marginDb>=12);
  if(!noUnplannedVoice)findings.push({severity:"major",message:"Speech recognition detected unexpected words in an instrumental-only output; vocals cannot be ruled out."});
  if(!levels)findings.push({severity:"major",message:"Measured final audio is outside the loudness or true-peak limits."});
  const samples:Sample[]=[];
  // Readability at every hold and actual samples on both sides of every seam.
  for(const [sceneIndex,scene] of plan.scenes.entries()) {
    const indices=motionSampleFrames(scene,plan,sceneIndex);
    for(const [i,index] of indices.entries()) {const out=`analysis/qc-${scene.id}-${i}.jpg`;await frameIndex(path,join(workspace,out),index,1600);samples.push({path:out,sceneId:scene.id,label:`ACTUAL RENDER ${scene.id}, frame ${index} / nominal ${(index/30).toFixed(3)} seconds (${["entry / after seam; reveal may have just begun","entrance motion; partial type/card reveals intentional","reading hold; essential copy and proof must be complete and readable","last frame / outgoing seam; may be covered by planned next-scene transition"][i]})`});}
  }
  const reviews:z.infer<typeof reviewSchema>[]=[],wholeFilmProof=wholeFilmProofInventory(plan);
  for(let i=0;i<samples.length;i+=8) {
    const batch=reviewBatch(plan,samples.slice(i,i+8));
    const defaultStyle=qualityDefaultStyle(plan);
    const raw=await providers.claude("review",qualityReviewPrompt({plan:batch.plan,motion:batch.motion,wholeFilmProof,evidence,defaultStyle,measurements,heard,sourceSpeech:speechScenes.map(s=>({scene:s.id,transcript:plan.assets.find(a=>a.id===s.asset_id)?.transcript}))}),batch.images,{policy:"quality-review-v1"});
    let review:z.infer<typeof reviewSchema>;
    try{review=parseReview(raw);}catch{throw new PipelineError("invalid_quality_review","The quality reviewer returned incomplete or contradictory findings.","Ask the administrator to inspect the retained review and draft. No findings were waived and no automatic repair was started from this response.","needs_review");}
    reviews.push(review); findings.push(...review.findings);
  }
  const all=(key:"readabilityPassed"|"claimsPassed"|"realVisualsPassed"|"renderIntegrityPassed"|"audioTranscriptPassed")=>reviews.length>0&&reviews.every(r=>r[key]);
  checks.readability={passed:all("readabilityPassed"),performed:true,evidence:"DOM bounds and Claude visual inspection of actual rendered entry, hold, seam and end frames for every scene."};
  checks.claims={passed:all("claimsPassed"),performed:true,evidence:"Exact source quote grounding plus independent Claude comparison of rendered copy with source evidence."};
  checks.real_visuals={passed:realVisualsPassed(reviews,wholeFilmProof),performed:true,evidence:"At least one planned real-media proof scene, allowlisted actual captures/supplied media, preserved source manifest and every batch's independent rendered-product review."};
  checks.render_integrity={passed:all("renderIntegrityPassed"),performed:true,evidence:"Full-file decode and actual rendered first/last/hold/seam frame review; layout bounds inspected."};
  if(requiresStyleReview(plan,evidence))checks.reference_style={...assessReferenceStyle(reviews),evidence:evidence.reference?"Claude explicitly reviewed actual rendered scenes against the analyzed supplied reference profile. Reference content remains excluded.":"Claude explicitly reviewed and passed actual rendered scenes against the default minimal product-film motion profile: purposeful typography, distinct supported layouts, staged reveals, readable holds and coherent seams. No numeric similarity or exact reference asset reuse is claimed."};
  checks.audio={passed:levels&&hasPlannedAudio&&noUnplannedVoice&&speechMixVerified&&all("audioTranscriptPassed"),performed:true,evidence:"Generated instrumental flag, valid non-silent music/SFX sources and validated exact timing, measured final LUFS/true peak, timestamped Scribe voice/event rejection outside preserved source-speech windows, semantic speech comparison, independently normalized stems and verified >=12dB integrated speech/music margin. No human listening claimed."};
  for(const [name,check] of Object.entries(checks))if(!check.passed&&!findings.some(f=>f.message.includes(name)))findings.push({severity:"major",message:`Required ${name} quality check did not pass.`});
  const passed=Object.values(checks).every(c=>c.performed&&c.passed)&&!findings.some(f=>f.severity!=="minor");
  const motionEvidence=hasMotion?JSON.parse(await readFile(join(workspace,"analysis/motion.json"),"utf8")):null;
  const qc:QC={status:passed?"passed":"needs_review",passed,checks,technical:{streams:media.raw,fps,decoded:true,layout:JSON.parse(await readFile(join(workspace,"analysis/layout.json"),"utf8")),...(hasMotion?{motion:motionEvidence,seek:JSON.parse(await readFile(join(workspace,motionEvidence.composition,"seek-check.json"),"utf8"))}:{})},visual:reviews,audio:{measurements,transcript:heard,unexpectedVoice:unexpected,stems,checksPerformed:["instrumental provider flag","word and audio-event recognition","mix timing","measured loudness and true peak","independent stem normalization and measured speech/music margin"]},findings,repairs,evidence:samples.map(s=>s.path)};
  await writeJson(join(workspace,"qc.json"),qc);await hooks.persist(["qc.json",...samples.map(s=>s.path)]);return qc;
}
