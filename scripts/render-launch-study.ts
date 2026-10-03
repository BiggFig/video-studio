/** Art-directed launch films. Uses the product's HTML/GSAP/Hyperframes runtime;
 * never describes authored footage as automatic URL-to-video acceptance. */
import { copyFile, mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Script } from 'node:vm';
import { chromium } from 'playwright';
import { studyHtml, validateStudy } from '../studies/composition';
import type { MotionStudy } from '../studies/types';
import { geistFontBase64 } from '../worker/assets/geist-font';
import { serveMotionProject } from '../worker/motion-render';
import { motionBrowserArgs, motionBrowserPath } from '../worker/motion-browser';
import { audioMeasurements, command, ffmpeg, frameIndex, hash, mediaEnvironment, probe, writeJson } from '../worker/media';
import { writeExtremePercussion } from './launch-percussion';

async function main() {
  const id = process.argv[2];
  if (!['linear', 'tally', 'todoist'].includes(id)) throw new Error('Choose linear, tally or todoist');
  const extreme = process.argv.includes('--extreme');
  const sourceName = `launch-${id}${extreme ? '-extreme' : ''}.ts`;
  const mod = await import(pathToFileURL(resolve('studies', sourceName)).href);
  const study = mod[`${id}Study`] as MotionStudy;
  validateStudy(study); new Script(study.script);
  const workspace = resolve(extreme ? '.local/launch-extreme-20261003' : '.local/launch-films-20261003', id), root = join(workspace, 'project');
  const html = studyHtml(study), finish = process.argv.includes('--finish');
  if (finish && await readFile(join(root, 'index.html'), 'utf8') !== html) throw new Error('Source changed; rerender before finishing');
  await mkdir(join(root, 'assets'), { recursive: true });
  await mkdir(join(workspace, 'frames'), { recursive: true });
  await writeFile(join(root, 'assets/Geist.woff2'), Buffer.from(geistFontBase64, 'base64'));
  await copyFile(createRequire(import.meta.url).resolve('gsap/dist/gsap.min.js'), join(root, 'assets/gsap.min.js'));
  await copyFile(resolve('worker/assets/Geist-LICENSE.txt'), join(root, 'assets/Geist-LICENSE.txt'));
  await writeFile(join(root, 'index.html'), html);
  await copyFile(resolve('studies', sourceName), join(workspace, 'authored-study.ts'));
  const metadata = { id, variant: extreme ? 'extreme' : 'original', title: study.title, width: study.width, height: study.height, fps: 30,
    durationFrames: study.durationFrames, durationSeconds: study.durationFrames / 30,
    renderer: 'Hyperframes 0.8.97 / GSAP 3.14.2 / trusted HTML', manuallyAuthored: true,
    automaticUrlGenerationVerified: false, sourcePixelsInGeneratedPicture: false,
    htmlSha256: createHash('sha256').update(html).digest('hex'), notes: study.notes };
  await writeJson(join(workspace, 'study.json'), metadata);
  const samples = [...new Set([0, ...study.reviewFrames, study.durationFrames - 1])].sort((a,b) => a-b);
  const server = await serveMotionProject(root, ['index.html', 'assets/gsap.min.js', 'assets/Geist.woff2']);
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const errors: string[] = [], checks: {frame:number;deterministic:boolean}[] = [];
  try {
    browser = await chromium.launch({ headless: true, executablePath: motionBrowserPath(), args: motionBrowserArgs, env: mediaEnvironment() });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === server.origin ? route.continue() : route.abort());
    await page.goto(server.origin);
    await page.waitForFunction(() => typeof (window as unknown as {__studioReady:unknown}).__studioReady !== 'undefined');
    await page.evaluate(() => (window as unknown as {__studioReady:Promise<unknown>}).__studioReady);
    const seek = (frame:number) => page.evaluate(n => (window as unknown as {__studio:{seekFrame(n:number):Promise<void>}}).__studio.seekFrame(n), frame);
    for (const frame of samples) { await seek(frame); await page.screenshot({path:join(workspace,'frames',`html-${String(frame).padStart(4,'0')}.png`)}); }
    for (const frame of [0, samples[Math.floor(samples.length / 2)], study.durationFrames - 1]) {
      await seek(frame); const before = createHash('sha256').update(await page.screenshot()).digest('hex');
      await seek(frame === 0 ? study.durationFrames - 1 : 0); await seek(frame);
      checks.push({frame, deterministic: before === createHash('sha256').update(await page.screenshot()).digest('hex')});
    }
    if (errors.length || checks.some(c => !c.deterministic)) throw new Error(JSON.stringify({errors,checks}));
    await writeJson(join(workspace,'preflight.json'),{passed:true,errors,checks,samples});
  } finally { await browser?.close(); await server.close(); }
  if (process.argv.includes('--render') || finish) {
    const picture = join(workspace, 'picture.mp4');
    if (!finish) {
      const log = await command(process.execPath, ['--import','tsx',resolve('worker/motion-cli.ts'),'render',root,'--fps','30','--quality','delivery','--workers','1','--crf','18','--video-frame-format','png','--no-browser-gpu','--frames-cache-dir','off','--output',picture],1_200_000);
      await writeFile(join(workspace,'render.log'),log);
    }
    const retainedLog=await readFile(join(workspace,'render.log'),'utf8');
    if (/sub_timeline_readiness_timeout|\[Browser:ERROR\]|correctness warnings/i.test(retainedLog)) throw new Error('Render correctness warning; inspect log');
    const measured=await probe(picture);
    if(measured.width!==1920||measured.height!==1080||Number(measured.video?.nb_frames)!==study.durationFrames||measured.video?.codec_name!=='h264'||measured.video?.pix_fmt!=='yuv420p')throw new Error('Rendered picture metadata mismatch');
    await command(ffmpeg,['-v','error','-xerror','-i',picture,'-f','null','-']);
    const comparisons=[];
    for(const frame of samples){
      const decoded=join(workspace,'frames',`decoded-${String(frame).padStart(4,'0')}.png`);
      await frameIndex(picture,decoded,frame,1920);
      const log=await command(ffmpeg,['-hide_banner','-i',decoded,'-i',join(workspace,'frames',`html-${String(frame).padStart(4,'0')}.png`),'-filter_complex','[0:v]format=yuv420p[a];[1:v]format=yuv420p[b];[a][b]ssim','-frames:v','1','-f','null','-']);
      const ssim=Number(/All:([0-9.]+)/.exec(log)?.[1]); comparisons.push({frame,ssim,passed:Number.isFinite(ssim)&&ssim>=.97});
    }
    await writeJson(join(workspace,'export-comparisons.json'),comparisons);
    if(comparisons.some(c=>!c.passed))throw new Error('Export differs from authored HTML');
    const musicManifest=JSON.parse(await readFile(join(workspace,'music.json'),'utf8'));
    const music=join(workspace,musicManifest.path);
    if(await hash(music)!==musicManifest.sha256)throw new Error('Music source hash changed');
    const duration=study.durationFrames/30, output=join(workspace,'final.mp4');
    // Providers can pad a musically complete score with several silent seconds.
    // Preserve the original bytes, fit only an evidenced trailing silent tail,
    // and record the pitch-preserving tempo adjustment in the export manifest.
    const sourceLevels=await audioMeasurements(music), sourceProbe=await probe(music);
    const silence=sourceLevels.silence.join('\n');
    const starts=[...silence.matchAll(/silence_start:\s*([\d.]+)/g)].map(m=>Number(m[1]));
    const ends=[...silence.matchAll(/silence_end:\s*([\d.]+)/g)].map(m=>Number(m[1]));
    const lastStart=starts.at(-1), lastEnd=ends.at(-1);
    const trailing=lastStart!==undefined&&lastEnd!==undefined&&Math.abs(lastEnd-sourceProbe.duration)<.2&&duration-lastStart>1;
    const sourceEnd=trailing?Math.min(duration,lastStart+.12):duration;
    const tempo=trailing && !extreme?sourceEnd/(duration-.15):1;
    if(tempo<.75||tempo>1)throw new Error('Score needs an authored audio repair beyond the bounded tempo fit');
    const audioFit={sourceEndSeconds:sourceEnd,tempo,pitchPreserved:true,trailingSilenceFitted:trailing,sourceMeasurements:sourceLevels};
    let percussion;
    if (extreme) {
      percussion = await writeExtremePercussion(workspace, id, duration);
      await command(ffmpeg,['-v','error','-y','-i',picture,'-i',music,'-i',percussion.path,
        '-filter_complex',`[1:a]atrim=duration=${sourceEnd},asetpts=PTS-STARTPTS,apad,atrim=duration=${duration},loudnorm=I=-15:TP=-2:LRA=7[m];[2:a]volume=0.75[p];[m][p]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.9:level=false,afade=t=in:d=0.008,afade=t=out:st=${duration-.18}:d=0.18,loudnorm=I=-12:TP=-1.5:LRA=6[a]`,
        '-map','0:v:0','-map','[a]','-c:v','copy','-c:a','aac','-b:a','256k','-ar','48000','-t',String(duration),'-movflags','+faststart',output]);
    } else {
      await command(ffmpeg,['-v','error','-y','-i',picture,'-i',music,'-map','0:v:0','-map','1:a:0','-c:v','copy','-af',`atrim=duration=${sourceEnd},asetpts=PTS-STARTPTS,atempo=${tempo},apad,atrim=duration=${duration},afade=t=in:d=0.08,afade=t=out:st=${duration-.8}:d=0.8,loudnorm=I=-17:TP=-1.5:LRA=9`,'-c:a','aac','-b:a','192k','-ar','48000','-t',String(duration),'-movflags','+faststart',output]);
    }
    const final=await probe(output); await command(ffmpeg,['-v','error','-xerror','-i',output,'-f','null','-']);
    if(!final.audio||Number(final.video?.nb_frames)!==study.durationFrames||Math.abs(final.duration-duration)>.1)throw new Error('Final audiovisual metadata mismatch');
    const levels=await audioMeasurements(output);
    if(!levels.loudness||!Number.isFinite(Number(levels.loudness.input_i))||Number(levels.loudness.input_tp)>-.5)throw new Error('Invalid final soundtrack levels');
    if(extreme&&(Number(levels.loudness.input_i)<-14||Number(levels.loudness.input_i)>-10||levels.silence.length||Number(final.audio.channels)!==2))throw new Error('Extreme mix failed loudness, continuity or stereo check');
    const posterFrame: Record<string,number> = extreme ? {linear:30,tally:30,todoist:30} : {linear:395,tally:555,todoist:408};
    await frameIndex(output,join(workspace,'poster.jpg'),posterFrame[id],1920);
    await writeJson(join(workspace,'qc.json'),{technicalPassed:true,decoded:true,comparisons,levels,audioFit,percussion,deterministicChecks:checks,auditoryReviewPerformed:false,semanticVisualReview:'Separate human/agent review required; export SSIM compares HTML with encoded pixels only.'});
    await writeJson(join(workspace,'result.json'),{...metadata,status:'authored_launch_film',technicalPassed:true,videoPath:output,sha256:await hash(output),audioSource:musicManifest,audioFit,percussion,automaticAcceptancePassed:false});
  }
  console.log(JSON.stringify({id,workspace,frames:study.durationFrames,rendered:process.argv.includes('--render')||finish}));
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
