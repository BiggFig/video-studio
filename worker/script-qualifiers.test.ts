import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sourceSpeedQualifierIssues } from "./script-qualifiers";
import { compileScript, loadCompletedProductionStages, type Script } from "./scripting";
import { stageDigest, type Research } from "./research";
import { verifyScriptWorkflowBinding, validatePlanWorkflowCoherence, workflowArtifactPaths } from "./workflow-stage";
import { PipelineError, type Evidence, type Plan, type WorkerInput } from "./types";
import type { UiDocumentBundle } from "./ui-reconstruction";

const facts: Pick<Research, "facts"> = { facts: [
  { evidenceId: "fact-1", kind: "feature", label: "Links", quote: "Create connections between your notes. Link ideas, people and books." },
  { evidenceId: "fact-2", kind: "feature", label: "Publish", quote: "Publish your notes instantly from the app." },
  { evidenceId: "fact-3", kind: "feature", label: "Sync", quote: "Changes receive immediate updates." },
  { evidenceId: "fact-4", kind: "feature", label: "Instant search", quote: "Thinking, Fast and Slow" },
] };
type CopyScene = Parameters<typeof sourceSpeedQualifierIssues>[0][number];
const scene = (headline: string, evidenceId = "fact-1", detail = ""): CopyScene => ({ headline, detail, evidenceId });

test("speed eligibility binds each scene field to its own exact quote, never another selected fact or label", () => {
  const scenes = [scene("Link notes instantly"), scene("Find books", "fact-4", "Immediate results")];
  const before = JSON.stringify({ scenes, facts });
  assert.deepEqual(sourceSpeedQualifierIssues(scenes, facts), [
    { code: "unsupported_source_speed_qualifier", path: ["scenes", 0, "headline"], evidenceId: "fact-1", family: "instant" },
    { code: "unsupported_source_speed_qualifier", path: ["scenes", 1, "detail"], evidenceId: "fact-4", family: "immediate" },
  ]);
  assert.equal(JSON.stringify({ scenes, facts }), before);
  assert.equal(sourceSpeedQualifierIssues([scene("Instant search", "fact-4")], facts).length, 1);
  assert.equal(sourceSpeedQualifierIssues([scene("Publish instantly", "fact-999")], facts).length, 1);
});

test("only the two exact qualifier families are checked, with separate case-insensitive whole-word eligibility", () => {
  assert.deepEqual(sourceSpeedQualifierIssues([
    scene("Instant publishing", "fact-2", "PUBLISH INSTANTLY"),
    scene("Immediately updated", "fact-3", "Immediate updates"),
    scene("Fast, quick and real-time: Thinking, Fast and Slow"),
    scene("Instantaneous immediacy, noninstantly, instant_thing, preimmediate"),
  ], facts), []);
  assert.deepEqual(sourceSpeedQualifierIssues([scene("Immediate publishing", "fact-2"), scene("Instant updates", "fact-3")], facts).map(issue => issue.family), ["immediate", "instant"]);
  assert.equal(sourceSpeedQualifierIssues([scene("(INSTANTLY)! / immediately.")], facts).length, 2);
});

test("cards and connection nodes use their own fact rather than the surrounding scene fact", () => {
  const cards: CopyScene = { ...scene("Publish instantly", "fact-2"), presentation: { template: "features", theme: "light", transition: "cut", cards: [
    { title: "Instant links", body: "Immediately connected", evidenceId: "fact-1" },
    { title: "Publish instantly", body: "", evidenceId: "fact-2" },
  ] } };
  const nodes: CopyScene = { ...scene("Connections"), presentation: { template: "features", theme: "light", transition: "cut", visual: { kind: "connections", nodes: [
    { label: "Instant publication", evidenceId: "fact-2" },
    { label: "Instant links", evidenceId: "fact-1" },
  ] } } };
  const issues = sourceSpeedQualifierIssues([cards, nodes], facts);
  assert.deepEqual(issues.map(issue => issue.path), [
    ["scenes", 0, "presentation", "cards", 0, "title"],
    ["scenes", 0, "presentation", "cards", 0, "body"],
    ["scenes", 1, "presentation", "visual", "nodes", 1, "label"],
  ]);
  assert.ok(issues.every(issue => issue.evidenceId === "fact-1"));
});

test("a matching word is lexical eligibility only and cannot certify a claim's semantic meaning", () => {
  const qualified: Pick<Research, "facts"> = { facts: [{ ...facts.facts[0], quote: "Links are not instant; Publish is instant." }] };
  // Deliberately not entailment: the independent source/semantic QC must reject this claim.
  assert.deepEqual(sourceSpeedQualifierIssues([scene("Instant links")], qualified), []);
});

test("retained m fails the fresh gate, a labelled remove-only control passes, and historical proof remains byte-identical", { skip: process.env.STUDIO_WORKFLOW_RETAINED_TEST !== "1" }, async () => {
  const workspace = join(process.cwd(), ".local/engine-batch-acceptance-20261002m");
  const paths = ["acceptance-provenance.json", "analysis/evidence.json", "analysis/research.json", "analysis/ui.json", "analysis/model-3-script.json", "analysis/script.json", "plan.json", "analysis/shot-recipes.json", "analysis/script-state.json"];
  const before = await Promise.all(paths.map(path => readFile(join(workspace, path))));
  const values = before.map(bytes => JSON.parse(bytes.toString()));
  const input = values[0].input as WorkerInput, evidence = values[1] as Evidence, research = values[2] as Research;
  const ui: UiDocumentBundle = { documents: values[3].documents, sha256: stageDigest(values[3]) };
  const raw = values[4], saved = values[5] as Script, plan = values[6] as Plan;
  const proofPaths = workflowArtifactPaths(saved.workflowCoherence!);
  const proofBytes = await Promise.all(proofPaths.map(path => readFile(join(workspace, path))));
  const options = { requireDirection: true, requireRecipes: true, maxScenes: 6 };
  const historical = compileScript(raw, input, evidence, research, undefined, ui, options);
  assert.deepEqual(sourceSpeedQualifierIssues(historical.scenes, research), [{ code: "unsupported_source_speed_qualifier", path: ["scenes", 2, "headline"], evidenceId: "fact-10", family: "instant" }]);
  assert.match(evidence.text, /publish.*instantly/i);
  assert.doesNotMatch(research.facts.find(fact => fact.evidenceId === "fact-10")!.quote, /\b(?:instant(?:ly)?|immediate(?:ly)?)\b/i);
  assert.throws(() => compileScript(raw, input, evidence, research, undefined, ui, { ...options, requireSourceSpeedQualifiers: true }), error => error instanceof PipelineError && error.code === "invalid_generated_script");
  // Explicit manual offline counterexample, never a provider artifact rewrite or new approval.
  const manual = structuredClone(raw);
  assert.ok(manual.scenes[2].headline.endsWith(" instantly"));
  manual.scenes[2].headline = manual.scenes[2].headline.slice(0, -" instantly".length);
  const compiled = compileScript(manual, input, evidence, research, undefined, ui, { ...options, requireSourceSpeedQualifiers: true });
  assert.deepEqual(sourceSpeedQualifierIssues(compiled.scenes, research), []);
  assert.equal(compiled.shotRecipeSha256, historical.shotRecipeSha256);
  assert.equal(compiled.workflowCoherence, undefined);
  await verifyScriptWorkflowBinding(saved, workspace, ui);
  await validatePlanWorkflowCoherence(plan, workspace);
  assert.deepEqual((await loadCompletedProductionStages(input, evidence, workspace, plan)).script, saved);
  for (const [index, path] of paths.entries()) assert.deepEqual(await readFile(join(workspace, path)), before[index]);
  for (const [index, path] of proofPaths.entries()) assert.deepEqual(await readFile(join(workspace, path)), proofBytes[index]);
});
