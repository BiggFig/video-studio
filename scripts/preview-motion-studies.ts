/** Local-only reference review. Never publishes the downloaded reference footage. */
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Script } from 'node:vm';
import { serveMotionProject } from '../worker/motion-render';
import { comparisonViewer } from '../studies/viewer';
import { originalStudy } from '../studies/original';
import { elevenlabsStudy } from '../studies/elevenlabs';
import { clickupStudy } from '../studies/clickup';
import { receptionStudy } from '../studies/reception';

async function main() {
  const root = resolve('.local/reference-replication/renders');
  const studies = [receptionStudy, clickupStudy, elevenlabsStudy, originalStudy];
  const paths = ['index.html'];
  for (const study of studies) {
    const result = JSON.parse(await readFile(join(root, study.id, 'result.json'), 'utf8'));
    if (!result.technicalPassed || result.durationFrames !== study.durationFrames) throw new Error(`Render ${study.id} before previewing`);
    const html = comparisonViewer(study);
    new Script(html.split('<script>')[1].split('</script>')[0]);
    await writeFile(join(root, study.id, 'compare.html'), html);
    paths.push(...['compare.html', 'replication.mp4', 'reference-selection.mp4', 'comparison.mp4', 'poster.jpg', 'project/index.html', 'project/assets/Geist.woff2', 'project/assets/gsap.min.js'].map(path => `${study.id}/${path}`));
  }
  await writeFile(join(root, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Video Studio · Motion studies</title><style>
@font-face{font-family:Studio;src:url('reception/project/assets/Geist.woff2');font-weight:100 900}*{box-sizing:border-box}body{margin:0;background:#f5f5f7;color:#171719;font-family:Studio,Arial,sans-serif}main{max-width:1380px;margin:64px auto;padding:0 32px}h1{font-size:52px;line-height:1.08;font-weight:600;letter-spacing:-.055em;max-width:900px;margin:0 0 20px}p{color:#6e6e73;line-height:1.65;max-width:880px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:40px}a{color:inherit;text-decoration:none;background:#fff;border:1px solid #e5e5e8;border-radius:22px;overflow:hidden;transition:box-shadow .15s}a:hover{box-shadow:0 10px 35px #0001}img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#000}section{padding:22px 26px}h2{font-size:20px;letter-spacing:-.03em;margin:0 0 10px;font-weight:600}small{color:#6e6e73}footer{margin:36px 0;font-size:14px;color:#6e6e73;line-height:1.7}@media(max-width:750px){main{margin:32px auto;padding:0 18px}h1{font-size:38px}.grid{grid-template-columns:1fr}}</style></head><body><main><h1>From reference frames<br>to editable motion.</h1><p>Four manually authored reconstructions rendered by the Video Studio engine. Open a study to play the original and our version together, or inspect them one frame at a time.</p><div class="grid">${studies.map(study => `<a href="${study.id}/compare.html"><img src="${study.id}/poster.jpg" alt="${study.id} reconstruction"><section><h2>${study.title}</h2><small>${(study.durationFrames / 30).toFixed(2)} seconds · 1920 × 1080 · 30 fps</small></section></a>`).join('')}</div><footer>4,228 source frames inspected across four films. These are silent visual studies, with original footage shown only for comparison. Generated pictures use HTML, CSS and SVG. Automatic URL-to-film generation has not been established by these studies.</footer></main></body></html>`);
  const server = await serveMotionProject(root, paths);
  console.log(JSON.stringify({ url: server.origin, scope: 'local reference review' }));
  const close = async () => { await server.close(); process.exit(0); };
  process.on('SIGINT', close); process.on('SIGTERM', close);
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
