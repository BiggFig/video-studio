/** Copy only verified, reviewed pilot exports into the public comparison gallery. */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { command, ffmpeg, hash, probe, writeJson } from '../worker/media';
import { stageDigest } from '../worker/research';

async function main() {
  const baseline = process.argv.includes('--baseline');
  const requested = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  const placements = requested.length ? requested : ['landscape', 'feed', 'reels'];
  const dimensions: Record<string, [number, number]> = { landscape: [1920, 1080], feed: [1080, 1350], reels: [1080, 1920] };
  if (placements.some(placement => !dimensions[placement])) throw Error('Expected landscape, feed or reels');
  const json = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
  const manifestPath = resolve('public/direction-lab/manifest.json'), manifest = await json(manifestPath);
  const film = manifest.films.find((entry: {id: string}) => entry.id === 'tally');
  if (!film) throw Error('Tally gallery metadata missing');
  const prepared = [];
  for (const placement of placements) {
    const workspace = resolve('.local/director-pilot-20261012', placement + (baseline ? '-baseline' : ''));
    const [result, plan, motion, layout, rewind, script] = await Promise.all(['result.json', 'plan.json', 'analysis/motion.json', 'analysis/layout.json', 'rewind.json', 'analysis/script.json'].map(path => json(join(workspace, path))));
    const video = join(workspace, 'renders/final.mp4'), poster = join(workspace, 'poster.jpg');
    const metadata = await probe(video), [width, height] = dimensions[placement];
    if (!result.technicalPassed || result.baseline !== baseline || result.sha256 !== await hash(video)) throw Error(`${placement}: final file verification failed`);
    if (stageDigest(script) !== plan.production?.scriptSha256) throw Error(`${placement}: authored source script binding failed`);
    if (baseline) {
      const treatmentScript = await json(resolve('.local/director-pilot-20261012', placement, 'analysis/script.json'));
      if (stageDigest(script) !== stageDigest(treatmentScript)) throw Error(`${placement}: control uses a different script`);
    }
    if (!result.semanticReviewPerformed) throw Error(`${placement}: inspect the actual export before publishing`);
    if (motion.planSha256 !== createHash('sha256').update(JSON.stringify(plan)).digest('hex') || !motion.passed || !motion.comparisons?.length || motion.comparisons.some((check: {passed: boolean}) => !check.passed)) throw Error(`${placement}: source/HTML/export binding failed`);
    if (!layout.length || layout.some((check: {passed: boolean}) => !check.passed) || rewind.length < 28 || rewind.some((check: {passed: boolean; domIdentical: boolean; ssim: number}) => !check.passed || !check.domIdentical || !Number.isFinite(check.ssim) || check.ssim < .97)) throw Error(`${placement}: layout or replay verification failed`);
    if (metadata.width !== width || metadata.height !== height || Number(metadata.video?.nb_frames) !== 720 || Math.abs(metadata.duration - 24) > .1 || !metadata.audio) throw Error(`${placement}: delivery metadata failed`);
    await command(ffmpeg, ['-v', 'error', '-xerror', '-i', video, '-f', 'null', '-']);
    const audioHash = (await command(ffmpeg, ['-v', 'error', '-i', video, '-map', '0:a:0', '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-'])).trim();
    const soundtrackHash = (await command(ffmpeg, ['-v', 'error', '-i', resolve('public/launch-tests/media/tally.mp4'), '-map', '0:a:0', '-c', 'copy', '-t', '24', '-f', 'hash', '-hash', 'sha256', '-'])).trim();
    if (audioHash !== soundtrackHash) throw Error(`${placement}: soundtrack differs from the matched control source`);
    prepared.push({placement, workspace, video, poster, width, height, result, motion, audioHash, scriptSha256: plan.production.scriptSha256, replaySamples: rewind.length, byteIdenticalSamples: rewind.filter((check: {identical: boolean}) => check.identical).length, minimumReplaySsim: Math.min(...rewind.map((check: {ssim: number}) => check.ssim))});
  }
  await mkdir(resolve('public/direction-lab/media'), {recursive: true});
  for (const item of prepared) {
    const name = `tally-${baseline ? 'control' : 'director'}-${item.placement}`;
    await copyFile(item.video, resolve(`public/direction-lab/media/${name}.mp4`));
    await copyFile(item.poster, resolve(`public/direction-lab/media/${name}.jpg`));
    film[baseline ? 'control' : 'placements'][item.placement] = {status: 'ready', src: `/direction-lab/media/${name}.mp4`, poster: `/direction-lab/media/${name}.jpg`, width: item.width, height: item.height, note: baseline ? '24-second matched source plan and soundtrack; prior director treatment (camera, layers and materials).' : 'Approved authored pilot through the shared engine. Separate composition for this placement.'};
    await writeJson(resolve(`public/direction-lab/media/${name}.json`), {kind: 'authored-pilot-shared-engine', automaticUrlAcceptance: false, sha256: item.result.sha256, durationSeconds: 24, width: item.width, height: item.height, frames: 720, renderer: item.motion.renderer, planSha256: item.motion.planSha256, scriptSha256: item.scriptSha256, htmlExportSamples: item.motion.comparisons.length, replaySamples: item.replaySamples, byteIdenticalSamples: item.byteIdenticalSamples, minimumReplaySsim: item.minimumReplaySsim, exactReplayDom: true, audioPacketHash: item.audioHash, auditoryReviewPerformed: item.result.auditoryReviewPerformed, semanticReviewPerformed: true});
  }
  if (!baseline && Object.values(film.placements).every((media: any) => media.status === 'ready')) film.approval = 'Approved storyboard · Three verified exports';
  await writeJson(manifestPath, manifest);
  console.log(JSON.stringify({published: prepared.map(item => item.placement), baseline}));
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
