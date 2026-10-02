import test from "node:test";
import assert from "node:assert/strict";
import { assessBenchmark, requiredArtifacts } from "../scripts/engine-benchmark";

const checks = ["technical", "timeline", "motion_integrity", "reference_exclusion", "readability", "claims", "real_visuals", "render_integrity", "storytelling", "ui_fidelity", "ui_behavior", "reference_style", "audio"];
const completed = () => ({ provenance: { kind: "local-provider-acceptance", paidProviders: true, localFixture: null, input: { mode: "url", productUrl: "https://product.example/", runtimeHash: "a".repeat(64) } }, result: { status: "local_quality_passed", result: { videoPath: "renders/final.mp4" } }, qc: { passed: true, status: "passed", findings: [] as { severity: string }[], checks: Object.fromEntries(checks.map(name => [name, { passed: true, performed: true }])) }, ledger: { modelCalls: 5, providerRequests: ["research", "ui-design", "script", "review"].map(operation => ({ operation })) }, stages: [{ status: "local_quality_passed" }], verifiedArtifacts: ["renders/final.mp4", ...requiredArtifacts], integrityFailures: [] as string[] });

test("a fully verified local pipeline remains distinct from deployment or artistic certification", () => {
  const result = assessBenchmark(completed());
  assert.equal(result.automaticLocalPass, true); assert.equal(result.productionVerified, false); assert.equal(result.creativeQuality, "requires-separate-human-review");
});
test("valid MP4s and manual studies cannot masquerade as automatic URL success", () => {
  const manual = completed(); manual.provenance.kind = "visual_study"; manual.ledger.providerRequests = [];
  assert.equal(assessBenchmark(manual).automaticLocalPass, false);
  const incomplete = completed(); incomplete.result.status = "needs_review";
  assert.equal(assessBenchmark(incomplete).automaticLocalPass, false);
  const assisted=completed();
  assert.equal(assessBenchmark({...assisted,provenance:{...assisted.provenance,retainedReviewRepair:{reviewPath:"retained.json"}}}).automaticLocalPass,false);
  assert.equal(assessBenchmark({...assisted,result:{...assisted.result,retainedReviewRepair:{retainedPlanResponse:{path:"authored.json"}}}}).automaticLocalPass,false);
});
test("tampered artifacts, missing checks and unchecked audio fail even when the summary says passed", () => {
  for (const change of ["hash", "missing", "audio", "finding", "lineage"]) {
    const run = completed();
    if (change === "hash") run.integrityFailures.push("Final video hash changed");
    if (change === "missing") delete run.qc.checks.ui_behavior;
    if (change === "audio") run.qc.checks.audio.performed = false;
    if (change === "finding") run.qc.findings.push({ severity: "major" });
    if (change === "lineage") run.verifiedArtifacts = run.verifiedArtifacts.filter(path=>path!=="analysis/script.json");
    assert.equal(assessBenchmark(run).automaticLocalPass, false, change);
  }
});
