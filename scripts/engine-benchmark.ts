/** Read-only acceptance reporting. Does not start providers, alter jobs, or turn fixtures into passes. */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { safePath } from "../worker/security";
import { stageDigest } from "../worker/research";

export const benchmarkCases = [
  { id: "obsidian", url: "https://obsidian.md/", purpose: "Public product UI and linked-note workflow; repeat the previously failing source with a fresh job.", expected: "A complete supported workflow or an explicit retained failure." },
  { id: "excalidraw", url: "https://excalidraw.com/", purpose: "A different public canvas workflow; verify that a working interface is not mistaken for sufficient product/audience evidence.", expected: "Grounded drawing workflow if supported; otherwise actionable missing-evidence result." },
  { id: "insufficient", url: "https://example.com/", purpose: "No software workflow or product interface to demonstrate.", expected: "needs_input before UI documentation, scripting and audio." },
] as const;

const requiredChecks = ["technical", "timeline", "motion_integrity", "reference_exclusion", "readability", "claims", "real_visuals", "render_integrity", "storytelling", "ui_fidelity", "ui_behavior", "reference_style", "audio"];
export const requiredArtifacts = ["analysis/evidence.json", "analysis/research.json", "analysis/ui.json", "analysis/creative-brief.json", "analysis/script.json", "plan.json", "qc.json", "ledger.json"];
type RecordValue = Record<string, any>;
export function assessBenchmark(input: { provenance: RecordValue | null; result: RecordValue | null; qc: RecordValue | null; ledger: RecordValue | null; script?: RecordValue | null; plan?: RecordValue | null; recipeCatalog?: RecordValue | null; stages: RecordValue[]; verifiedArtifacts: string[]; integrityFailures: string[] }) {
  const { provenance, result, qc, ledger, stages } = input;
  const reasons = [...input.integrityFailures];
  if (provenance?.kind !== "local-provider-acceptance" || provenance?.paidProviders !== true || provenance?.localFixture || provenance?.input?.mode !== "url" || !provenance?.input?.productUrl || !/^[a-f0-9]{64}$/.test(provenance?.input?.runtimeHash || "")) reasons.push("Not a runtime-pinned provider-backed URL acceptance.");
  if (provenance?.retainedReviewRepair || result?.retainedReviewRepair) reasons.push("An operator-assisted retained-review repair cannot count as automatic URL success.");
  const operations = new Set((ledger?.providerRequests || []).map((request: RecordValue) => request.operation));
  if (!["research", "ui-design", "script", "review"].every(operation => operations.has(operation))) reasons.push("Required automatic research, UI, script or review calls are missing.");
  if (result?.status !== "local_quality_passed" || !stages.some(stage => stage.status === "local_quality_passed")) reasons.push("The pipeline did not complete its acceptance path.");
  const failedChecks = requiredChecks.filter(name => qc?.checks?.[name]?.passed !== true || qc?.checks?.[name]?.performed !== true);
  if (qc?.passed !== true || qc?.status !== "passed" || failedChecks.length || (qc?.findings || []).some((finding: RecordValue) => finding.severity !== "minor")) reasons.push("Required delivered-file quality evidence is missing or failed.");
  const video = result?.result?.videoPath;
  if (!video || !input.verifiedArtifacts.includes(video) || requiredArtifacts.some(path=>!input.verifiedArtifacts.includes(path))) reasons.push("Final video or required source, stage, plan, QC and usage artifacts are not verified against persisted hashes.");
  const recipeHash = input.script?.shotRecipeSha256;
  if (recipeHash !== undefined || input.plan?.production?.shotRecipeSha256 !== undefined || input.recipeCatalog) {
    if (!/^[a-f0-9]{64}$/.test(recipeHash || "") || input.plan?.production?.shotRecipeSha256 !== recipeHash || !input.recipeCatalog || stageDigest(input.recipeCatalog) !== recipeHash || !input.verifiedArtifacts.includes("analysis/shot-recipes.json")) reasons.push("The directed shot catalogue is missing, changed, or not bound to both the script and plan.");
  }
  return { automaticLocalPass: reasons.length === 0, productionVerified: false, creativeQuality: "requires-separate-human-review", status: result?.status || "incomplete", failure: result?.error || null, reasons, failedChecks, sourceUrl: provenance?.input?.productUrl || null, runtimeHash: provenance?.input?.runtimeHash || null, usage: ledger ? { modelCalls: ledger.modelCalls, inputTokens: ledger.inputTokens, outputTokens: ledger.outputTokens, audioGenerations: ledger.audioGenerations, asrSeconds: ledger.asrSeconds } : null, stages: stages.map(stage => ({ status: stage.status, at: stage.at, stage: stage.checkpoint?.stage })), retainedDrafts: input.verifiedArtifacts.filter(path=>/^renders\/draft-\d+\.mp4$/.test(path)), verifiedArtifacts: input.verifiedArtifacts };
}

export async function benchmarkReport(workspace: string) {
  async function json(path: string) { try { return JSON.parse(await readFile(safePath(workspace, path), "utf8")); } catch { return null; } }
  const [provenance, result, qc, ledger, stages, manifest, script, plan, recipeCatalog] = await Promise.all(["acceptance-provenance.json", "acceptance-result.json", "qc.json", "ledger.json", "acceptance-stages.json", "acceptance-artifacts.json", "analysis/script.json", "plan.json", "analysis/shot-recipes.json"].map(json));
  const verifiedArtifacts: string[] = [], integrityFailures: string[] = [];
  const paths = [...requiredArtifacts, ...(recipeCatalog || script?.shotRecipeSha256 !== undefined || plan?.production?.shotRecipeSha256 !== undefined ? ["analysis/shot-recipes.json"] : []), ...Object.keys(manifest||{}).filter(path=>/^renders\/draft-\d+\.mp4$/.test(path)), ...(typeof result?.result?.videoPath === "string" ? [result.result.videoPath] : [])];
  for (const path of paths) {
    if (!manifest?.[path]) continue;
    try { const bytes = await readFile(safePath(workspace, path)); if (bytes.length !== manifest[path].size || createHash("sha256").update(bytes).digest("hex") !== manifest[path].sha256) throw Error("hash"); verifiedArtifacts.push(path); }
    catch { integrityFailures.push(`Persisted artifact missing or changed: ${path}`); }
  }
  return assessBenchmark({ provenance, result, qc, ledger, script, plan, recipeCatalog, stages: Array.isArray(stages) ? stages : [], verifiedArtifacts, integrityFailures });
}

async function main() {
  const workspace = resolve(process.argv[2] || ""), local = relative(resolve(".local"), workspace);
  if (!local || local.startsWith("..") || isAbsolute(local)) throw Error("Pass an existing acceptance workspace under .local; this report never runs paid providers.");
  const report = await benchmarkReport(workspace);
  await writeFile(safePath(workspace, "benchmark-report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main().catch(error => { console.error(error); process.exitCode = 1; });
