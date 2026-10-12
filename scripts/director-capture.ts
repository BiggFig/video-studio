/** Read-only public source reconnaissance. No models, accounts or product mutations. */
import { mkdir } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { captureProduct } from '../worker/ingest';
import { writeJson } from '../worker/media';

async function main() {
  const [url, directory] = process.argv.slice(2);
  if (!url || !directory) throw Error('Pass a public URL and an empty .local workspace.');
  const source = new URL(url), workspace = resolve(directory), rel = relative(resolve('.local'), workspace);
  if (source.protocol !== 'https:' || !rel || rel.startsWith('..') || isAbsolute(rel)) throw Error('Use HTTPS and a workspace inside .local.');
  await mkdir(workspace); await mkdir(join(workspace, 'analysis')); await mkdir(join(workspace, 'assets'));
  try {
    const captured = await captureProduct(source.href, workspace);
    const evidence = {text:captured.text, assets:captured.assets, brand:captured.brand, uiSources:captured.uiSources, capturedUrl:captured.url};
    await writeJson(join(workspace, 'analysis/evidence.json'), evidence);
    const summary = {url:source.href,resolvedUrl:captured.url,status:'captured',modelCalls:0,mutations:0,textCharacters:captured.text.length,assets:captured.assets.map(a=>({id:a.id,width:a.width,height:a.height,role:a.provenance?.role,page:a.provenance?.pageUrl})),uiSources:captured.uiSources.map(s=>({assetId:s.assetId,elements:s.elements.length,basis:s.basis})),notAutomaticVideoAcceptance:true};
    await writeJson(join(workspace,'capture-summary.json'),summary); console.log(JSON.stringify(summary));
  } catch(error) {
    const failure={url:source.href,status:'capture_failed',message:error instanceof Error?error.message:'Capture failed',modelCalls:0,mutations:0};
    await writeJson(join(workspace,'capture-summary.json'),failure); console.log(JSON.stringify(failure)); process.exitCode=1;
  }
}
void main().catch(error=>{console.error(error.message);process.exitCode=1;});
