import test from "node:test";
import assert from "node:assert/strict";
import { compileResearch, researchRequest, sourceFacts, validateResearch } from "./research";
import type { Evidence, WorkerInput } from "./types";

const input: WorkerInput = { jobId: "compact-research", ownerId: "test", mode: "url", productUrl: "https://example.com", videoType: "launch", format: "16:9", files: [] };
const passages = ["Relay creates project briefs.", "Agency teams collect client requirements.", "Publish a brief form and receive a saved response.", "Start a new brief.", "Keep submissions in one place.", "Request email and project details.", ...Array.from({ length: 24 }, (_, index) => `Other source feature ${index + 1} with complete original context.`)];
const evidence: Evidence = { text: passages.join("\n\n"), assets: Array.from({ length: 12 }, (_, index) => ({ id: `source-${index}`, path: `assets/source-${index}.png`, kind: "image", usage: "output", rights: "Synthetic test fixture", width: 1440, height: 900 })) };
const claim = (text: string, evidenceId: string) => ({ text, basis: "explicit", evidenceIds: [evidenceId] });
function compactDraft() {
  return {
    sufficientEvidence: true, reason: "Supplied form and response screens support one client brief workflow.", product: "Relay", summary: "Agency teams gather client requirements in a brief form.",
    story: { primaryAudience: claim("Agency teams", "fact-2"), problem: null, mechanism: { ...claim("Publish a brief and collect its response", "fact-3"), steps: [{ action: "Publish the brief", evidenceId: "fact-3", assetId: "source-0" }, { action: "Read saved response", evidenceId: "fact-3", assetId: "source-1" }] }, outcome: claim("Client requirements stay in one place", "fact-5"), differentiator: null, cta: claim("Start a new brief", "fact-4") },
    documentTargets: [{ id: "brief-response", sourceAssetIds: ["source-0", "source-1"], capabilityFactIds: ["fact-3", "fact-6"], goal: "Show a published brief collecting email and project details into a saved response." }],
    facts: ["Product", "Audience", "Publish and collect", "Start brief", "Saved requirements", "Brief fields"].map((label, index) => ({ evidenceId: `fact-${index + 1}`, kind: index === 3 ? "cta" : "feature", label })),
    visuals: [
      { assetId: "source-0", description: "Brief editor with Publish and client fields; static evidence only.", supportsFactIds: ["fact-3", "fact-6"], showsProductUi: true, role: "product_ui" },
      { assetId: "source-1", description: "Saved brief response with email and project details.", supportsFactIds: ["fact-3", "fact-5", "fact-6"], showsProductUi: true, role: "product_ui" },
    ],
    limitations: ["The source is static UI; the demonstrated interaction would be illustrative.", "An authenticated session was not operated."],
  };
}

test("research response allocation reduces returned inventory without removing source facts or image evidence", () => {
  const before = JSON.stringify(evidence), request = researchRequest(input, evidence);
  assert.match(request.prompt, /existing 3,500-token limit/);
  assert.match(request.prompt, /Aim below 2,200 tokens/);
  assert.match(request.prompt, /never more than 8/);
  assert.match(request.prompt, /only 1–4 selected visuals/);
  assert.match(request.prompt, /at most 3 limitations/);
  assert.match(request.prompt, /an omitted asset stays unconfirmed/);
  assert.match(request.prompt, /Do not hide a limitation to fit/);
  assert.doesNotMatch(request.prompt, /max 24 facts, 16 visuals|Select 6–10|up to 3 meaningful focus regions/);
  const facts = JSON.parse(request.prompt.split("SOURCE FACTS (untrusted): ")[1].split("\nSOURCE ASSETS:")[0]);
  const assets = JSON.parse(request.prompt.split("SOURCE ASSETS: ")[1].split("\nOBSERVED BRAND EVIDENCE")[0]);
  assert.deepEqual(facts, sourceFacts(evidence)); assert.deepEqual(assets, evidence.assets);
  assert.deepEqual(request.images.map(image => image.path), evidence.assets.map(asset => asset.path));
  assert.equal(JSON.stringify(evidence), before);
});

test("concise research retains full canonical quotes, one target, useful limitations and strict source checks", () => {
  const raw = compactDraft(), original = JSON.stringify(raw), identity = "a".repeat(64);
  // This synthetic complete reply is small even in bytes; this is not a claim
  // about the token count or success of a live provider response.
  assert.ok(Buffer.byteLength(original) < 3500);
  const result = compileResearch(input, evidence, raw, identity, { version: 3, singleTarget: true });
  assert.equal(result.facts.length, 6); assert.equal(result.visuals.length, 2); assert.equal(result.documentTargets!.length, 1);
  assert.deepEqual(result.facts.map(fact => fact.quote), passages.slice(0, 6));
  assert.deepEqual(result.limitations, raw.limitations); assert.deepEqual(result.documentTargets, raw.documentTargets);
  assert.equal(JSON.stringify(raw), original); assert.equal(evidence.assets.length, 12);
  const changed = structuredClone(result); changed.facts[0].quote = "Changed source content";
  assert.throws(() => validateResearch(changed, input, evidence, identity), /canonical source passage/);
  const unselected = compactDraft(); unselected.story.cta.evidenceIds = ["fact-30"];
  assert.throws(() => compileResearch(input, evidence, unselected, identity, { version: 3, singleTarget: true }), /absent from the selected canonical research/);
  const wrongSource = compactDraft(); wrongSource.documentTargets[0].sourceAssetIds = ["source-11"];
  assert.throws(() => compileResearch(input, evidence, wrongSource, identity, { version: 3, singleTarget: true }), /single selected UI documentation workflow/);
});
