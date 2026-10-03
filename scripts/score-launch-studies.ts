/** Explicitly opted-in instrumental scoring for the three authored launch studies. */
import { mkdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Providers } from '../worker/providers';
import { hash, writeJson } from '../worker/media';
import type { Hooks, WorkerInput } from '../worker/types';

const prompts: Record<string,string> = {
  linear: 'A precise, high-end software launch score, 24 seconds. Tight dry electronic percussion, warm deep restrained bass, glassy plucked arpeggio in a minor mode, sophisticated minimal techno at approximately 120 BPM. Crisp opening impact, forward energy immediately; small lift at 6 seconds for delegation, restrained pulse beneath the 9–13 second product result, brighter harmonic reveal at 14 seconds, final confident resolve at 21 seconds and clean tail by 24 seconds. No trailer braams, no epic orchestra, no ambient pad wash. Elegant technical confidence.',
  tally: 'Playful premium product launch instrumental, 24 seconds. Tactile wooden clicks, soft punchy drums, rounded marimba/plucked synth melody, nimble warm bass, approximately 120 BPM. Bright and clever like folded lemon-yellow paper. Immediate crisp opening, small ticking phrase during typing at 7–11 seconds, cheerful resolving chord for a form confirmation around 15 seconds, light confident logo close at 21 seconds and musical tail by 24 seconds. Stylish, restrained, joyful; no ukulele, no corporate stock-music strumming, no huge cinematic risers.',
  todoist: 'Warm, nimble modern productivity product launch instrumental, 24 seconds. Soft analog keys, dry hand-clap and fingertip percussion, crisp plucked notes, rounded warm bass, approximately 115 BPM. Opening feels like scattered thoughts finding a rhythm, develop a clear melodic pulse by 3 seconds, quiet rhythmic space for task typing around 6–10 seconds, satisfying harmonic resolution at 14 seconds when the task is organized, spacious uplift at 18 seconds then elegant complete logo ending by 24 seconds. Human and assured, no generic ambient wash or overblown trailer sounds.',
};
async function main(){
  if(!process.argv.includes('--run-paid'))throw new Error('Explicit --run-paid required; one music generation per named film.');
  const id=process.argv[2]; if(!prompts[id])throw new Error('Choose linear, tally or todoist');
  const workspace=resolve('.local/launch-films-20261003',id); await mkdir(join(workspace,'assets'),{recursive:true});
  const reservationPath=join(workspace,'score-request.json');
  let reservation: {startedAt:string;deadlineAt:string;prompt:string;durationSeconds:number};
  try{reservation=JSON.parse(await readFile(reservationPath,'utf8'));}
  catch(error){if(!(error instanceof Error&&'code'in error&&error.code==='ENOENT'))throw error;
    const now=Date.now(); reservation={startedAt:new Date(now).toISOString(),deadlineAt:new Date(now+600000).toISOString(),prompt:prompts[id],durationSeconds:24}; await writeJson(reservationPath,reservation);}
  if(reservation.prompt!==prompts[id]||reservation.durationSeconds!==24)throw new Error('Scoring request changed; retain original paid reservation.');
  const input:WorkerInput={jobId:`authored-launch-${id}`,ownerId:'local-operator',mode:'prd',videoType:'launch',format:'16:9',files:[],deadlineAt:reservation.deadlineAt,budgets:{maxAudioGenerations:1,maxModelCalls:0,maxModelInputTokens:0,maxModelOutputTokens:0,maxWallSeconds:600}};
  const hooks:Hooks={async persist(paths){for(const path of paths)if(!(await stat(join(workspace,path))).size)throw new Error('Empty persisted audio artifact');},async state(){},async complete(){throw new Error('This script cannot complete automatic acceptance');}};
  const providers=new Providers(workspace,input,hooks);await providers.init(resolve('skills/video-studio'));
  const path=await providers.audio('music',reservation.prompt,reservation.durationSeconds);
  await writeJson(join(workspace,'music.json'),{path,sha256:await hash(join(workspace,path)),provider:'ElevenLabs',instrumental:true,requestedDurationSeconds:24,prompt:reservation.prompt,paidAudioGenerations:providers.ledger.audioGenerations,auditoryReviewPerformed:false});
  console.log(JSON.stringify({id,status:'music_saved',audioGenerations:providers.ledger.audioGenerations}));
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Scoring failed');process.exitCode=1;});
