/** Correct only authored-pilot metadata after proving the render plan is unchanged. */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { tallyPilot } from '../studies/tally-director';
import { stageDigest } from '../worker/research';

async function main() {
  const root = resolve('.local/director-pilot-20261012');
  const names = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
  const repairs: { workspace: string; scriptPath: string; planSha256: string; beforeSha256: string; afterSha256: string; changed: boolean }[] = [];
  const pending: { scriptPath: string; script: string; original: string; planPath: string; planBytes: string }[] = [];
  const byteHash = (text: string) => createHash('sha256').update(text).digest('hex');
  for (const name of names) {
    if (!/^(landscape|feed|reels)(-baseline)?$/.test(name)) continue;
    const workspace = join(root, name), planPath = join(workspace, 'plan.json'), scriptPath = join(workspace, 'analysis/script.json');
    let planBytes: string, original: string;
    try { [planBytes, original] = await Promise.all([readFile(planPath, 'utf8'), readFile(scriptPath, 'utf8')]); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
    const savedPlan = JSON.parse(planBytes), savedScript = JSON.parse(original);
    if (savedScript.kind !== 'human-directed-pilot' || savedScript.automaticUrlAcceptance !== false || !savedScript.sourceHashes) throw Error(`Not an authored pilot: ${name}`);
    const format = name.startsWith('landscape') ? '16:9' : name.startsWith('feed') ? '4:5' : '9:16';
    const { plan, authoredScript } = tallyPilot(format, savedScript.sourceHashes, !name.endsWith('-baseline'));
    // Never rewrite a plan or repair metadata for different render content.
    if (JSON.stringify(plan) !== JSON.stringify(savedPlan)) throw Error(`Refusing repair: regenerated plan differs from saved plan in ${name}`);
    if (stageDigest(authoredScript) !== savedPlan.production.scriptSha256) throw Error(`Refusing repair: corrected script does not match saved binding in ${name}`);
    const script = JSON.stringify(authoredScript, null, 2);
    pending.push({ scriptPath, script, original, planPath, planBytes });
    repairs.push({ workspace, scriptPath, planSha256: byteHash(planBytes), beforeSha256: byteHash(original), afterSha256: byteHash(script), changed: original !== script });
  }
  // Validate every candidate before changing any file. Recheck snapshots to avoid
  // overwriting a concurrently rebuilt pilot workspace.
  for (const item of pending) {
    if (await readFile(item.planPath, 'utf8') !== item.planBytes || await readFile(item.scriptPath, 'utf8') !== item.original) throw Error(`Pilot changed during verification: ${item.planPath}`);
  }
  for (const item of pending) if (item.original !== item.script) await writeFile(item.scriptPath, item.script);
  const report = { correctedAt: new Date().toISOString(), reason: 'Separate authored script from compiled director scene metadata. Regenerated and saved plan JSON are identical; render content is unchanged.', automaticRuntimeChanged: false, repairs };
  const reportPath = join(root, 'authored-script-metadata-repair.json');
  let history: unknown[] = [];
  try {
    const previous = JSON.parse(await readFile(reportPath, 'utf8'));
    history = Array.isArray(previous.runs) ? previous.runs : [previous];
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  await writeFile(reportPath, JSON.stringify({ runs: [...history, report] }, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
