/** Reproducible authored pilot through the same compiler/camera/HTML renderer as URL jobs. */
import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';
import { tallyPilot, tallyPilotSources } from '../studies/tally-director';
import { prepareMotionProject, inspectMotionProject, renderMotionPicture, serveMotionProject } from '../worker/motion-render';
import { motionBrowserArgs, motionBrowserPath } from '../worker/motion-browser';
import { hash, writeJson, command, ffmpeg, frameIndex, probe, audioMeasurements, mediaEnvironment } from '../worker/media';
import { persistShotDirector } from '../worker/shot-director';

async function main(){
  const format=process.argv[2] as '16:9'|'4:5'|'9:16';
  if(!['16:9','4:5','9:16'].includes(format))throw Error('Choose 16:9,4:5,9:16');
  const legacy=process.argv.includes('--baseline'), render=process.argv.includes('--render'), key=format==='16:9'?'landscape':format==='4:5'?'feed':'reels';
  const workspace=resolve('.local/director-pilot-20261012',`${key}${legacy?'-baseline':''}`);
  for(const dir of ['assets','analysis','project','renders','frames'])await mkdir(join(workspace,dir),{recursive:true});
  const hashes:Record<string,string>={};
  for(const source of tallyPilotSources){hashes[source.id]=await hash(resolve(source.path));await copyFile(resolve(source.path),join(workspace,`assets/${source.id}.${source.path.split('.').at(-1)}`));}
  const {plan,evidence,research,authoredScript}=tallyPilot(format,hashes,!legacy);
  await writeJson(join(workspace,'plan.json'),plan);await writeJson(join(workspace,'analysis/evidence.json'),evidence);await writeJson(join(workspace,'analysis/research.json'),research);await writeJson(join(workspace,'analysis/script.json'),authoredScript);
  const hooks={persist:async()=>{}};await persistShotDirector(plan,workspace,hooks);
  const project=await prepareMotionProject(plan,workspace,0);
  await inspectMotionProject(plan,workspace,project);
  const server=await serveMotionProject(project.root,project.paths.map(p=>p.slice(project.directory.length+1)));
  let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
  try{
    browser=await chromium.launch({headless:true,executablePath:motionBrowserPath(),args:motionBrowserArgs,env:mediaEnvironment()});
    const page=await browser.newPage({viewport:{width:plan.output.width,height:plan.output.height}});
    await page.goto(server.origin);await page.evaluate(()=> (window as any).__studioReady);
    const frames=[0,18,60,91,125,164,175,221,238,290,315,350,395,442,447,452,458,459,460,461,464,470,472,485,530,580,650,719];
    for(const frame of frames){await page.evaluate(n=>(window as any).__studio.seekFrame(n),frame);await page.screenshot({path:join(workspace,'frames',`${frame}.png`)});}
    const snapshot=()=>page.evaluate(()=>({
      html:Array.from(document.querySelectorAll('.scene'),element=>element.outerHTML),
      elements:Array.from(document.querySelectorAll('.scene, .scene *'),element=>({
        id:element.id,rect:element.getBoundingClientRect().toJSON(),
        computed:['transform','opacity','visibility','clip-path','left','top','width','height','color','background-color','font-size'].map(key=>[key,getComputedStyle(element).getPropertyValue(key)])
      }))
    }));
    const stateHash=(value:string)=>createHash('sha256').update(value).digest('hex');
    const checks=[];
    for(const frame of frames){
      await page.evaluate(n=>(window as any).__studio.seekFrame(n),frame);const a=await page.screenshot(),firstState=JSON.stringify(await snapshot());
      await page.evaluate(n=>(window as any).__studio.seekFrame(n),frame?0:719);await page.evaluate(n=>(window as any).__studio.seekFrame(n),frame);const b=await page.screenshot(),secondState=JSON.stringify(await snapshot());
      const identical=a.equals(b),domIdentical=firstState===secondState;let ssim=1;
      if(!identical||!domIdentical){
        const first=join(workspace,'frames',`replay-${frame}-before.png`),second=join(workspace,'frames',`replay-${frame}-after.png`);
        await writeFile(first,a);await writeFile(second,b);
        await writeFile(join(workspace,'frames',`replay-${frame}-before.json`),firstState);await writeFile(join(workspace,'frames',`replay-${frame}-after.json`),secondState);
        const comparison=await command(ffmpeg,['-hide_banner','-i',first,'-i',second,'-filter_complex','[0:v]format=yuv420p[actual];[1:v]format=yuv420p[expected];[actual][expected]ssim','-frames:v','1','-f','null','-']);
        ssim=Number(/All:([0-9.]+)/.exec(comparison)?.[1]);
      }
      // Chromium may vary an antialiased edge without changing source state or
      // geometry. Retain byte failures and require exact DOM plus the existing
      // production export SSIM threshold; semantic drift never passes.
      checks.push({frame,identical,domIdentical,ssim,firstStateSha256:stateHash(firstState),secondStateSha256:stateHash(secondState),passed:domIdentical&&Number.isFinite(ssim)&&ssim>=.97});
    }
    await writeJson(join(workspace,'rewind.json'),checks);if(checks.some(c=>!c.passed))throw Error('Pilot reverse seek mismatch');
  }finally{await browser?.close();await server.close();}
  const provenance={kind:'authored-pilot-shared-engine',automaticUrlAcceptance:false,format,sourceHashes:hashes,durationFrames:720,providerCalls:0,baseline:legacy,sourceGeometry:'Illustrative enlarged composition; documented controls and example data, not an exact captured session.'};
  await writeJson(join(workspace,'provenance.json'),provenance);
  if(render){
    const result=await renderMotionPicture(plan,workspace,0), picture=join(workspace,result.path), output=join(workspace,'renders/final.mp4');
    const audioSource=resolve('public/launch-tests/media/tally.mp4');
    // Both controlled versions use the byte-identical owned24-second track.
    // It already has a musical ending; no loop seam or new provider request.
    const original=await probe(audioSource);if(Math.abs(original.duration-24)>.1||!original.audio)throw Error('Expected original24-second Tally soundtrack');
    await command(ffmpeg,['-v','error','-y','-i',picture,'-i',audioSource,'-map','0:v:0','-map','1:a:0','-c','copy','-t','24','-movflags','+faststart',output]);
    await command(ffmpeg,['-v','error','-xerror','-i',output,'-f','null','-']);
    const metadata=await probe(output),levels=await audioMeasurements(output);
    if(metadata.width!==plan.output.width||metadata.height!==plan.output.height||Number(metadata.video?.nb_frames)!==720||!metadata.audio)throw Error('Final pilot metadata failed');
    await frameIndex(output,join(workspace,'poster.jpg'),238,plan.output.width);
    await writeJson(join(workspace,'result.json'),{...provenance,video:output,sha256:await hash(output),width:metadata.width,height:metadata.height,technicalPassed:true,audioSourceSha256:await hash(audioSource),audioLevels:levels,auditoryReviewPerformed:false,semanticReviewPerformed:false});
  }
  console.log(JSON.stringify({workspace,format,rendered:render,preview:project.root}));
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
