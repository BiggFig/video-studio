import test from "node:test";
import assert from "node:assert/strict";
import legacyDirection from "./reference-style.json";
import { directionForContractVersion, launchDirection } from "./launch-direction";
import { scriptBinding, scriptRequest } from "./scripting";
import { stageDigest, type Research } from "./research";
import { qualityDefaultStyle } from "./providers";
import type { Evidence, WorkerInput } from "./types";

const input: WorkerInput = { jobId: "direction-test", ownerId: "fixture", mode: "url", videoType: "launch", format: "16:9", files: [] };
const evidence: Evidence = { text: "Link notes.", assets: [{ id: "screen", path: "screen.png", kind: "image", usage: "output", rights: "Fixture", width: 1000, height: 600 }] };
const research = (version: 1 | 2 | 3): Research => ({ version, jobId: input.jobId, evidenceSha256: "a".repeat(64), sufficientEvidence: true, reason: "Fixture", product: "Atlas", summary: "Notes", facts: [{ evidenceId: "fact-1", kind: "feature", label: "Link notes", quote: "Link notes." }], visuals: [{ assetId: "screen", description: "Notes UI", supportsFactIds: ["fact-1"], showsProductUi: true, role: "product_ui" }], limitations: [] });

test("legacy research keeps the exact former script binding and reference profile", () => {
  for (const version of [1, 2] as const) {
    const value = research(version);
    assert.deepEqual(directionForContractVersion(version), legacyDirection);
    assert.equal(scriptBinding(input, value), stageDigest({ jobId: input.jobId, researchSha256: stageDigest(value), style: legacyDirection }));
  }
  assert.deepEqual(qualityDefaultStyle({ renderer: "hyperframes", scenes: [] }), { id: legacyDirection.id, description: legacyDirection.target.description, design: legacyDirection.design, motion: legacyDirection.motion });
  assert.equal(qualityDefaultStyle({ renderer: "ffmpeg", scenes: [] }), null);
});

test("v3 script binding and quality review select the same causal direction without fixed beat slots", () => {
  const value = research(3), ui = { documents: [], sha256: "b".repeat(64) };
  assert.equal(scriptBinding(input, value, ui), stageDigest({ jobId: input.jobId, researchSha256: stageDigest(value), style: launchDirection, uiSha256: ui.sha256 }));
  assert.notEqual(scriptBinding(input, value, ui), stageDigest({ jobId: input.jobId, researchSha256: stageDigest(value), style: legacyDirection, uiSha256: ui.sha256 }));
  const prompt = scriptRequest(input, evidence, value);
  const serialized = prompt.split("DEFAULT MOTION DIRECTION: ")[1].split("\nUSER REFERENCE STYLE")[0];
  assert.deepEqual(JSON.parse(serialized), launchDirection);
  assert.equal(Object.hasOwn(JSON.parse(serialized), "beats"), false);
  assert.equal(Object.hasOwn(JSON.parse(serialized).target, "sceneCount"), false);
  const review = qualityDefaultStyle({ renderer: "hyperframes", scenes: [], production: { researchSha256: "a".repeat(64), scriptSha256: "b".repeat(64), evidenceSha256: "c".repeat(64), uiSha256: ui.sha256 } });
  assert.equal(review?.id, launchDirection.id); assert.deepEqual(review?.motion, launchDirection.motion);
  assert.equal(review?.description, launchDirection.target.description);
});
