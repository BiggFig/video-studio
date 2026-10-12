import test from 'node:test';
import assert from 'node:assert/strict';
import { tallyPilot } from '../studies/tally-director';
import { stageDigest } from '../worker/research';

test('pilot authored scripts remain identical across control and direction and match their saved plan binding', () => {
  const hashes = { editor: 'a'.repeat(64), form: 'b'.repeat(64), thanks: 'c'.repeat(64) };
  for (const format of ['16:9', '4:5', '9:16'] as const) {
    const directed = tallyPilot(format, hashes, true);
    const control = tallyPilot(format, hashes, false);
    const savedScript = JSON.parse(JSON.stringify(directed.authoredScript)) as { scenes: Record<string, unknown>[] };
    assert.equal(stageDigest(savedScript), directed.plan.production!.scriptSha256, format);
    assert.equal(stageDigest(control.authoredScript), control.plan.production!.scriptSha256, format);
    assert.ok(directed.plan.scenes.some(scene => scene.shotDirection));
    assert.ok(savedScript.scenes.every(scene => !('shotDirection' in scene)));
    assert.deepEqual(savedScript, control.authoredScript, format);
  }
});
