/** Offline design laboratory. No provider, database, deployment or production-job calls. */
import { copyFile, mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Script } from 'node:vm';
import { chromium } from 'playwright';
import { studyHtml, validateStudy } from '../studies/composition';
import { comparisonViewer } from '../studies/viewer';
import type { MotionStudy } from '../studies/types';
import { geistFontBase64 } from '../worker/assets/geist-font';
import { serveMotionProject } from '../worker/motion-render';
import { motionBrowserArgs, motionBrowserPath } from '../worker/motion-browser';
import { command, ffmpeg, frameIndex, hash, mediaEnvironment, probe, writeJson } from '../worker/media';

async function main() {
const require = createRequire(import.meta.url);
const id = process.argv[2];
if (!['elevenlabs', 'clickup', 'original', 'reception'].includes(id)) throw new Error('Choose elevenlabs, clickup, original or reception');
const module = await import(pathToFileURL(resolve('studies', id + '.ts')).href);
const study = module[id + 'Study'] as MotionStudy;
validateStudy(study);
new Script(study.script, { filename: 'authored-study-script.js' });
const workspace = resolve('.local/reference-replication/renders', id);
const root = join(workspace, 'project');
if (process.argv.includes('--finish') && await readFile(join(root, 'index.html'), 'utf8') !== studyHtml(study)) throw new Error('Authored HTML changed; a full rerender is required');
await mkdir(join(root, 'assets'), { recursive: true });
await mkdir(join(workspace, 'frames'), { recursive: true });
await writeFile(join(root, 'assets/Geist.woff2'), Buffer.from(geistFontBase64, 'base64'));
await copyFile(require.resolve('gsap/dist/gsap.min.js'), join(root, 'assets/gsap.min.js'));
await copyFile(resolve('worker/assets/Geist-LICENSE.txt'), join(root, 'assets/Geist-LICENSE.txt'));
await writeFile(join(root, 'index.html'), studyHtml(study));
await copyFile(resolve('studies', id + '.ts'), join(workspace, 'authored-study.ts'));
const reference = resolve(study.reference.path);
const refProbe = await probe(reference);
if (study.reference.startSeconds + study.reference.durationSeconds > refProbe.duration + 1 / 30) throw new Error('Reference selection exceeds source');
const metadata = {
  id, title: study.title, renderer: 'Hyperframes 0.8.97 / GSAP 3.14.2 / trusted HTML',
  width: study.width, height: study.height, fps: study.fps, durationFrames: study.durationFrames,
  reference: { ...study.reference, sha256: await hash(reference) },
  manuallyAuthored: true, sourcePixelsInGeneratedPicture: false, paidCalls: 0,
  audio: 'Silent visual study; soundtrack replication and listening review not performed.',
  notes: study.notes, reviewFrames: study.reviewFrames,
};
await writeJson(join(workspace, 'study.json'), metadata);
await writeFile(join(root, 'README.txt'), 'Editable, manually authored reference study. This uses the same pinned Hyperframes and GSAP runtime as Video Studio. It is not an automatic URL-to-film result. Serve the folder locally, then await window.__studioReady and call await window.__studio.seekFrame(90). The generated picture contains no original reference video or screenshot pixels. Reference footage is present only in separately labelled comparison artifacts. No audio is included.\n');
const server = await serveMotionProject(root, ['index.html', 'assets/gsap.min.js', 'assets/Geist.woff2']);
const errors: string[] = [];
const samples = [...new Set([0, ...study.reviewFrames, study.durationFrames - 1])].sort((a, b) => a - b);
const browser = await chromium.launch({ headless: true, executablePath: motionBrowserPath(), args: motionBrowserArgs, env: mediaEnvironment() });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === server.origin ? route.continue() : route.abort());
  await page.goto(server.origin);
  if (errors.length) throw new Error(errors.join('\n'));
  await page.waitForFunction(() => typeof (window as unknown as { __studioReady: unknown }).__studioReady !== 'undefined', undefined, { timeout: 5000 });
  await page.evaluate(() => (window as unknown as { __studioReady: Promise<unknown> }).__studioReady);
  const seek = (frame: number) => page.evaluate(n => (window as unknown as { __studio: { seekFrame(n: number): Promise<void> } }).__studio.seekFrame(n), frame);
  for (const frame of samples) {
    await seek(frame);
    await page.screenshot({ path: join(workspace, 'frames', `html-${String(frame).padStart(4, '0')}.png`) });
  }
  const checks = [];
  for (const frame of [0, samples[Math.floor(samples.length / 2)], study.durationFrames - 1]) {
    await seek(frame);
    const before = createHash('sha256').update(await page.screenshot()).digest('hex');
    await seek(frame === 0 ? study.durationFrames - 1 : 0);
    await seek(frame);
    const after = createHash('sha256').update(await page.screenshot()).digest('hex');
    checks.push({ frame, deterministic: before === after });
  }
  if (errors.length || checks.some(check => !check.deterministic)) throw new Error(JSON.stringify({ errors, checks }));
  await writeJson(join(workspace, 'preflight.json'), { passed: true, errors, checks, samples });
  const header = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 50;
    const context = canvas.getContext('2d')!; context.fillStyle = '#111113'; context.fillRect(0, 0, 1920, 50);
    context.font = '500 23px Studio'; context.fillStyle = '#fff';
    context.fillText('REFERENCE', 28, 33); context.fillText('OUR HTML ENGINE · MANUALLY AUTHORED', 988, 33);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await writeFile(join(workspace, 'comparison-header.png'), Buffer.from(header, 'base64'));
} finally { await browser.close(); await server.close(); }

if (process.argv.includes('--render') || process.argv.includes('--finish')) {
  const output = join(workspace, 'replication.mp4');
  if (!process.argv.includes('--finish')) {
  const log = await command(process.execPath, ['--import', 'tsx', resolve('worker/motion-cli.ts'), 'render', root, '--fps', '30', '--quality', 'delivery', '--workers', '1', '--crf', '18', '--video-frame-format', 'png', '--no-browser-gpu', '--frames-cache-dir', 'off', '--output', output], 1_200_000);
  await writeFile(join(workspace, 'render.log'), log);
  if (/sub_timeline_readiness_timeout|\[Browser:ERROR\]|correctness warnings/i.test(log)) throw new Error('Hyperframes reported a runtime correctness problem');
  }
  const rendered = await probe(output);
  if (rendered.width !== 1920 || rendered.height !== 1080 || Number(rendered.video?.nb_frames) !== study.durationFrames || rendered.video?.codec_name !== 'h264' || rendered.video?.pix_fmt !== 'yuv420p') throw new Error('Render metadata mismatch');
  await command(ffmpeg, ['-v', 'error', '-i', output, '-f', 'null', '-']);
  const comparisons = [];
  for (const frame of samples) {
    const decoded = join(workspace, 'frames', `decoded-${String(frame).padStart(4, '0')}.png`);
    await frameIndex(output, decoded, frame, 1920);
    const expected = join(workspace, 'frames', `html-${String(frame).padStart(4, '0')}.png`);
    const ssimLog = await command(ffmpeg, ['-hide_banner', '-i', decoded, '-i', expected, '-filter_complex', '[0:v]format=yuv420p[a];[1:v]format=yuv420p[b];[a][b]ssim', '-frames:v', '1', '-f', 'null', '-']);
    const ssim = Number(/All:([0-9.]+)/.exec(ssimLog)?.[1]);
    comparisons.push({ frame, ssim, passed: Number.isFinite(ssim) && ssim >= .97 });
  }
  await writeJson(join(workspace, 'qc.json'), { technicalPassed: comparisons.every(check => check.passed), decoded: true, comparisons, referenceSimilarity: 'Human visual comparison required; export SSIM is not a reference-similarity score.', audioReviewed: false });
  if (comparisons.some(check => !check.passed)) throw new Error('Export differs from the editable HTML');
  if (refProbe.video?.avg_frame_rate !== '30/1') throw new Error('Reference comparison requires the audited native 30fps source');
  const referenceStart = Math.round(study.reference.startSeconds * 30);
  await command(ffmpeg, ['-v', 'error', '-y', '-i', reference, '-an', '-vf', `trim=start_frame=${referenceStart}:end_frame=${referenceStart + study.durationFrames},setpts=PTS-STARTPTS,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=white`, '-frames:v', String(study.durationFrames), '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(workspace, 'reference-selection.mp4')]);
  await command(ffmpeg, ['-v', 'error', '-y', '-i', join(workspace, 'reference-selection.mp4'), '-i', output, '-loop', '1', '-framerate', '30', '-i', join(workspace, 'comparison-header.png'), '-filter_complex', '[0:v]scale=960:540[a];[1:v]scale=960:540[b];[a][b]hstack=inputs=2[paired];[2:v][paired]vstack=inputs=2[v]', '-map', '[v]', '-an', '-frames:v', String(study.durationFrames), '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(workspace, 'comparison.mp4')]);
  const posterFrames: Record<string, number> = { original: 332, elevenlabs: 404, clickup: 273, reception: 234 };
  await frameIndex(output, join(workspace, 'poster.jpg'), posterFrames[id], 1920);
  await command(ffmpeg, ['-v', 'error', '-i', join(workspace, 'comparison.mp4'), '-f', 'null', '-']);
  await writeFile(join(workspace, 'compare.html'), comparisonViewer(study));
  await writeJson(join(workspace, 'result.json'), { ...metadata, status: 'visual_study', technicalPassed: true, outputs: ['replication.mp4', 'comparison.mp4', 'reference-selection.mp4', 'poster.jpg', 'project/index.html'], automaticGenerationVerified: false });
}
console.log(JSON.stringify({ study: id, workspace, duration: study.durationFrames / 30, reviewFrames: samples.length, rendered: process.argv.includes('--render') || process.argv.includes('--finish') }));
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
