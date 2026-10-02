import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { buildShotRecipeCatalog, MAX_SHOT_RECIPES, MAX_SHOT_RECIPE_BYTES, persistShotRecipes, RECIPE_SCRIPT_TRANSPORT_VERSION, SHOT_RECIPES_PATH, shotRecipeConcepts, validatePlanShotRecipes } from "./shot-recipes";
import { compileResearch, sourceFacts, stageDigest } from "./research";
import { compileUiDocuments, type UiDocument } from "./ui-reconstruction";
import { compileScript, decodeScriptTransport, scriptBinding, scriptConstraints, validateScript } from "./scripting";
import { compilePlan } from "./planning";
import { constrainedScriptSchema } from "./model-format";
import type { Evidence, Hooks, WorkerInput } from "./types";

const input: WorkerInput = { jobId: "recipe-fixture", ownerId: "fixture", mode: "url", productUrl: "https://example.com", videoType: "launch", format: "16:9", files: [] };
const hooks: Hooks = { persist: async () => {}, state: async () => {}, complete: async () => {} };
const claim = (text: string, evidenceId: string) => ({ text, basis: "explicit", evidenceIds: [evidenceId] });
function fixture() {
  const evidence: Evidence = { text: "Organize sources for researchers.\n\nEdit notes and link ideas.\n\nSee relationships in a graph.\n\nDownload Atlas and keep your notes.", assets: ["editor", "graph"].map(id => ({ id, path: `assets/${id}.png`, kind: "image", usage: "output", rights: "Synthetic fixture", width: 1000, height: 600 })) };
  const research = compileResearch(input, evidence, { sufficientEvidence: true, reason: "Synthetic source fixture", product: "Atlas", summary: "Connected notes", facts: sourceFacts(evidence).map(fact => ({ evidenceId: fact.id, kind: "feature", label: fact.text })), story: { primaryAudience: claim("researchers", "fact-1"), problem: claim("Organize sources", "fact-1"), mechanism: { ...claim("Edit notes", "fact-2"), steps: [{ action: "Edit note", evidenceId: "fact-2", assetId: "editor" }] }, outcome: { ...claim("Keep connected notes", "fact-3"), evidenceIds: ["fact-3", "fact-4"] }, differentiator: null, cta: claim("Download Atlas", "fact-4") }, visuals: [{ assetId: "editor", description: "Editor", role: "product_ui", showsProductUi: true, supportsFactIds: ["fact-1", "fact-2"], regions: [{ id: "editor-input", rect: { x: .1, y: .1, width: .8, height: .8 }, supportsFactIds: ["fact-2"] }] }, { assetId: "graph", description: "Graph", role: "product_ui", showsProductUi: true, supportsFactIds: ["fact-3"] }], documentTargets: [{ id: "notes", sourceAssetIds: ["editor"], capabilityFactIds: ["fact-2"], goal: "Edit notes" }], limitations: [] }, "a".repeat(64));
  const rect = { x: .1, y: .1, width: .8, height: .8 };
  const doc: UiDocument = { id: "notes", sourceAssetIds: ["editor"], capabilityFactIds: ["fact-2"], viewport: { width: 1000, height: 600 }, styles: [{ id: "body", fill: "#ffffff", color: "#111111", borderColor: "#dddddd", fontSize: 18, fontWeight: 400, radius: 8 }], elements: [{ id: "input", type: "textarea", rect, styleId: "body", text: "A research note", textBasis: "source-ui", sourceAssetId: "editor", sourceRect: rect, initiallyVisible: true }], states: [{ id: "initial", basis: "observed", sourceAssetId: "editor", evidenceIds: ["fact-2"], visibleElementIds: ["input"], selectedElementIds: [], textValues: [] }] };
  const stage = compileUiDocuments({ sufficientEvidence: true, reason: "Fixture", documents: [doc] }, input, evidence, research), ui = { documents: stage.documents, sha256: stageDigest(stage) };
  const catalog = buildShotRecipeCatalog(research, evidence, ui);
  const chosen = [catalog.recipes.find(r => r.storyRole === "product" && r.evidenceId === "fact-1" && r.template === "brand")!, catalog.recipes.find(r => r.storyRole === "mechanism")!, catalog.recipes.find(r => r.storyRole === "outcome" && r.evidenceId === "fact-3" && r.visual.kind === "showcase")!, catalog.recipes.find(r => r.storyRole === "cta")!];
  const raw = { transportVersion: RECIPE_SCRIPT_TRANSPORT_VERSION, sufficientEvidence: true, reason: "Supported", product: "Atlas", summary: "One workflow", accent: "#6633bb", background: "light", musicPrompt: "A restrained instrumental texture", sfxPrompt: "One soft reveal", assumptions: [], creativeDirection: { concept: "focus", evidenceId: "fact-2" }, scenes: chosen.map((r, i) => ({ recipeId: r.id, headline: ["Atlas organizes ideas", "Link your notes", "See relationships", "Download"][i], detail: "", durationSeconds: 5, sourceInSeconds: 0, preserveAudio: false, purpose: "Supported shot", referenceTechnique: "Purposeful motion", direction: { job: ["context", "action", "result", "cta"][i], motion: ["reveal", "focus", "hold", "hold"][i] }, presentation: { theme: "light", transition: "cut", cards: [], nodes: [], actions: i === 1 ? [{ kind: "type", atFrame: 30, durationFrames: 18, targetId: "input", stateId: "", text: "Linked notes", evidenceId: "fact-2" }] : [] } })) };
  return { evidence, research, ui, catalog, raw };
}
async function workspace(t: TestContext) { const prefix = join(tmpdir(), "shot-recipes-"), path = await mkdtemp(prefix); await mkdir(join(path, "analysis")); t.after(async () => { if (dirname(resolve(path)) !== resolve(tmpdir()) || !path.startsWith(prefix)) throw Error("Unsafe cleanup"); await rm(path, { recursive: true, force: true }); }); return path; }

test("bounded recipes cannot express trial-4 hook/showcase or an unsupported outcome proof", () => {
  const f = fixture(), recipes = f.catalog.recipes;
  assert.ok(recipes.length <= MAX_SHOT_RECIPES); assert.ok(Buffer.byteLength(JSON.stringify(f.catalog)) <= MAX_SHOT_RECIPE_BYTES);
  assert.deepEqual(buildShotRecipeCatalog(f.research, f.evidence, f.ui), f.catalog);
  assert.equal(recipes.some(r => r.template === "hook" && r.visual.kind === "showcase"), false);
  assert.equal(recipes.some(r => r.storyRole === "outcome" && r.assetId === "graph" && r.evidenceId === "fact-4" && r.template === "proof"), false);
  assert.ok(recipes.some(r => r.storyRole === "outcome" && r.evidenceId === "fact-4" && r.template === "features"));
  for (const role of ["mechanism", "outcome", "cta"]) assert.ok(recipes.some(r => r.storyRole === role));
  assert.deepEqual(shotRecipeConcepts(f.catalog, f.research, f.evidence, f.ui).map(c => c.concept), ["focus", "connect", "consolidate"]);
  assert.ok(recipes.some(r => r.visual.kind === "focus" && r.assetId === "editor" && r.evidenceId === "fact-2"));
});

test("selector grammar has no combinatorial alternatives or independent binding overrides", () => {
  const f = fixture(), schema: any = constrainedScriptSchema(scriptConstraints(f.research, f.evidence, f.ui, true, true)!);
  assert.deepEqual(schema.properties.transportVersion.enum, [RECIPE_SCRIPT_TRANSPORT_VERSION]);
  assert.deepEqual(schema.properties.scenes.items.properties.recipeId.enum, f.catalog.recipes.map(r => r.id));
  for (const key of ["assetId", "evidenceId", "storyEvidence", "storyRole"]) assert.equal(schema.properties.scenes.items.properties[key], undefined);
  for (const key of ["template", "visual"]) assert.equal(schema.properties.scenes.items.properties.presentation.properties[key], undefined);
  assert.doesNotMatch(JSON.stringify(schema), /anyOf|oneOf/);
  assert.ok(JSON.stringify(schema).length < 15000);
});

test("unknown recipes, extra provenance overrides and unused payloads reject without changing raw output", () => {
  for (const mutate of [(raw: any) => { raw.scenes[0].recipeId = `shot-${"0".repeat(24)}`; }, (raw: any) => { raw.scenes[0].assetId = "graph"; }, (raw: any) => { raw.scenes[0].presentation.template = "proof"; }, (raw: any) => { raw.scenes[0].presentation.actions = raw.scenes[1].presentation.actions; }]) {
    const f = fixture(); mutate(f.raw); const before = JSON.stringify(f.raw);
    assert.throws(() => compileScript(f.raw, input, f.evidence, f.research, undefined, f.ui, { requireRecipes: true }));
    assert.equal(JSON.stringify(f.raw), before);
  }
  const f = fixture(), changed = structuredClone(f.research); changed.summary += " revised";
  assert.throws(() => decodeScriptTransport(f.raw, changed, f.evidence, f.ui), /unknown or belongs/);
});

test("trusted decode reaches real plan compilation and keeps immutable repair/restart provenance", async t => {
  const f = fixture(), script = compileScript(f.raw, input, f.evidence, f.research, undefined, f.ui, { requireDirection: true, requireRecipes: true });
  assert.equal(script.shotRecipeSha256, stageDigest(f.catalog));
  const path = await workspace(t), plan = await compilePlan(input, f.evidence, script, hooks, path);
  assert.equal(plan.production!.shotRecipeSha256, script.shotRecipeSha256); assert.equal(plan.scenes[1].presentation!.visual!.kind, "ui-demo");
  validatePlanShotRecipes(plan, f.research, f.evidence, f.ui);
  compileScript(f.raw, input, f.evidence, f.research, { plan, findings: [] }, f.ui);
  const changed = structuredClone(plan); changed.scenes[2].evidence_id = "fact-4";
  assert.throws(() => validatePlanShotRecipes(changed, f.research, f.evidence, f.ui), /changed its trusted recipe/);
  changed.production!.shotRecipeSha256 = "b".repeat(64);
  assert.throws(() => validatePlanShotRecipes(changed, f.research, f.evidence, f.ui), /changed its source-bound shot/);
  const decoded: any = decodeScriptTransport(f.raw, f.research, f.evidence, f.ui); decoded.scenes.forEach((scene: any) => delete scene.recipeId);
  const legacy = compileScript(decoded, input, f.evidence, f.research, undefined, f.ui);
  assert.equal(legacy.shotRecipeSha256, undefined);
  assert.throws(() => compileScript(decoded, input, f.evidence, f.research, { plan, findings: [] }, f.ui), /requires its trusted shot-recipe/);
  const oldPlan = await compilePlan(input, f.evidence, legacy, hooks, path);
  assert.throws(() => compileScript(f.raw, input, f.evidence, f.research, { plan: oldPlan, findings: [] }, f.ui), /cannot upgrade/);
  assert.notEqual(scriptBinding(input, f.research, f.ui, true), scriptBinding(input, f.research, f.ui, true, script.shotRecipeSha256));
  const wrong = structuredClone(script); wrong.scenes[2].presentation!.template = "hook";
  assert.throws(() => validateScript(wrong, input, f.evidence, f.research, undefined, f.ui), /changed its trusted recipe/);
});

test("catalogue persistence is immutable and completes before spending; failed saves propagate", async t => {
  const f = fixture(), path = await workspace(t); let saved = false;
  await persistShotRecipes(f.catalog, path, { persist: async paths => { assert.deepEqual(paths, [SHOT_RECIPES_PATH]); saved = true; } });
  assert.ok(saved); assert.deepEqual(JSON.parse(await readFile(join(path, SHOT_RECIPES_PATH), "utf8")), f.catalog);
  await assert.rejects(persistShotRecipes({ ...f.catalog, evidenceSha256: "b".repeat(64) }, path, hooks), /changed its verified sources/);
  await assert.rejects(persistShotRecipes(f.catalog, path, { persist: async () => { throw Error("lost checkpoint"); } }), /lost checkpoint/);
});

test("late eligible concept facts retain an executable anchor while core roles cannot be crowded out", () => {
  const f = fixture();
  f.evidence.text = f.evidence.text.replace("Organize sources", "Gather sources");
  f.research.facts[0].quote = f.research.facts[0].quote.replace("Organize sources", "Gather sources");
  for (let i = 5; i <= 24; i++) {
    const quote = i === 24 ? "Organize every record in one place." : `A supported source feature ${i}.`;
    f.evidence.text += `\n\n${quote}`;
    f.research.facts.push({ evidenceId: `fact-${i}`, quote, label: quote, kind: "feature" });
    f.research.visuals[0].supportsFactIds.push(`fact-${i}`);
  }
  const catalog = buildShotRecipeCatalog(f.research, f.evidence, f.ui), options = shotRecipeConcepts(catalog, f.research, f.evidence, f.ui);
  assert.ok(catalog.recipes.length <= MAX_SHOT_RECIPES);
  for (const role of ["mechanism", "outcome", "cta"]) assert.ok(catalog.recipes.some(recipe => recipe.storyRole === role));
  assert.ok(options.find(option => option.concept === "focus")!.evidenceIds.includes("fact-2"));
  assert.ok(options.find(option => option.concept === "consolidate")!.evidenceIds.includes("fact-24"));
  assert.ok(catalog.recipes.some(recipe => recipe.visual.kind === "panels" && recipe.evidenceId === "fact-24"));
});

test("verified typography video previews survive restart but forged aliases and speech UI recipes fail", async t => {
  const f = fixture(); Object.assign(f.evidence.assets[0], { kind: "video", preview: "analysis/editor-preview.jpg", duration_seconds: 60 });
  delete f.research.visuals[0].regions;
  f.ui.sha256 = stageDigest({ version: 1, jobId: input.jobId, evidenceSha256: f.research.evidenceSha256, researchSha256: stageDigest(f.research), documents: f.ui.documents });
  const catalog = buildShotRecipeCatalog(f.research, f.evidence, f.ui);
  for (const scene of f.raw.scenes) {
    const previous = f.catalog.recipes.find(recipe => recipe.id === scene.recipeId)!;
    scene.recipeId = catalog.recipes.find(recipe => recipe.storyRole === previous.storyRole && recipe.assetId === previous.assetId && recipe.evidenceId === previous.evidenceId && recipe.template === previous.template && stageDigest(recipe.visual) === stageDigest(previous.visual))!.id;
  }
  const script = compileScript(f.raw, input, f.evidence, f.research, undefined, f.ui), plan = await compilePlan(input, f.evidence, script, hooks, await workspace(t));
  assert.equal(plan.scenes[0].asset_id, "editor-typography-still");
  validatePlanShotRecipes(plan, f.research, f.evidence, f.ui);
  plan.assets.find(asset => asset.id === plan.scenes[0].asset_id)!.path = "assets/unrelated.png";
  assert.throws(() => validatePlanShotRecipes(plan, f.research, f.evidence, f.ui), /trusted recipe/);
  f.evidence.assets[0].transcript = { text: "Original speech", words: [{ text: "Original", start: 0, end: 1, type: "word" }] };
  assert.throws(() => buildShotRecipeCatalog(f.research, f.evidence, f.ui), /required bounded shot recipes/);
});

test("recipe selection does not waive copy or effective UI action validation", () => {
  const f = fixture(); f.raw.scenes[1].presentation.actions[0].text = "A research note";
  assert.throws(() => compileScript(f.raw, input, f.evidence, f.research, undefined, f.ui), /typing_has_no_net_change/);
  const words = fixture(); words.raw.scenes[0].detail = "word ".repeat(20); words.raw.scenes[3].detail = "word ".repeat(20);
  assert.throws(() => compileScript(words.raw, input, words.evidence, words.research, undefined, words.ui), /48 words/);
  const old = fixture(), legacy: any = decodeScriptTransport(old.raw, old.research, old.evidence, old.ui); legacy.scenes.forEach((scene: any) => delete scene.recipeId);
  assert.throws(() => compileScript(legacy, input, old.evidence, old.research, undefined, old.ui, { requireRecipes: true }), /trusted shot-recipe transport/);
});
