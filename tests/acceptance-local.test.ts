import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { acceptanceInputIdentity, validateAcceptanceResume } from "../scripts/acceptance-identity";
import type { WorkerInput } from "../worker/types";

const input: WorkerInput = { jobId: "local-acceptance-url", ownerId: "local-acceptance-operator", mode: "url", productUrl: "https://example.com/a", videoType: "launch", format: "auto", files: [], runtimeHash: "a".repeat(64), runtimeId: "local-test", budgets: { maxModelCalls: 10, maxRepairPasses: 2, maxWallSeconds: 1800 } };
async function savedRun(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "video-studio-acceptance-"));
  t.after(async () => { const rel = relative(tmpdir(), root); if (!rel.startsWith("video-studio-acceptance-") || rel.startsWith("..") || isAbsolute(rel)) throw new Error("Unsafe test cleanup"); await rm(root, { recursive: true, force: true }); });
  const provenance = { kind: "local-provider-acceptance", paidProviders: true, productionQueueVerified: false, productionPrivateStorageVerified: false, productionOwnerAccessVerified: false, input, localFixture: null, startedAt: "2026-09-30T12:00:00Z", retainedReviewRepair: null };
  await writeFile(join(root, "acceptance-provenance.json"), JSON.stringify(provenance));
  await writeFile(join(root, "acceptance-stages.json"), JSON.stringify([{ status: "planning", at: "2026-09-30T12:01:00Z" }]));
  const manifest: Record<string, { sha256: string; size: number; verifiedAt: string }> = {};
  async function artifact(path: string, data: unknown) { const bytes = Buffer.from(typeof data === "string" ? data : JSON.stringify(data)); await writeFile(join(root, path), bytes); manifest[path] = { sha256: createHash("sha256").update(bytes).digest("hex"), size: bytes.length, verifiedAt: "2026-09-30T12:01:00Z" }; await writeFile(join(root, "acceptance-artifacts.json"), JSON.stringify(manifest)); }
  await artifact("job.json", input);
  await artifact("versions.json", { runtimeHash: input.runtimeHash, runtimeId: input.runtimeId, skill: "skill-hash", pipeline: "1.0.0" });
  await artifact("ledger.json", { modelCalls: 1, inputTokens: 20, outputTokens: 10, reservedInputTokens: 0, reservedOutputTokens: 0, audioGenerations: 0, asrSeconds: 0, providerRequests: [], audio: {} });
  return { root, artifact };
}

test("resume accepts intact original provenance and rejects different semantic inputs without rewriting evidence", async t => {
  const { root } = await savedRun(t), before = await readFile(join(root, "acceptance-provenance.json"));
  const verified = await validateAcceptanceResume(root, input, null);
  assert.equal(verified.startedAt, "2026-09-30T12:00:00Z");
  for (const changed of [{ productUrl: "https://example.com/b" }, { format: "9:16" as const }, { budgets: { ...input.budgets, maxModelCalls: 12 } }]) await assert.rejects(validateAcceptanceResume(root, { ...input, ...changed }, null), /input differs/);
  await assert.rejects(validateAcceptanceResume(root, { ...input, runtimeHash: "b".repeat(64) }, null), /runtime differs/);
  assert.deepEqual(await readFile(join(root, "acceptance-provenance.json")), before);
});

test("resume fails closed for tampered, truncated and missing provider accounting", async t => {
  const { root, artifact } = await savedRun(t);
  await writeFile(join(root, "ledger.json"), "{");
  await assert.rejects(validateAcceptanceResume(root, input, null), /changed after persistence/);
  await artifact("ledger.json", "{");
  await assert.rejects(validateAcceptanceResume(root, input, null), /ledger is missing or unreadable/);
  await artifact("ledger.json", { modelCalls: -1 });
  await assert.rejects(validateAcceptanceResume(root, input, null), /ledger is invalid/);
  await rm(join(root, "ledger.json"));
  await assert.rejects(validateAcceptanceResume(root, input, null), /artifact is unavailable/);
});

test("resume preserves completed evidence and rejects untracked plan caches", async t => {
  const { root } = await savedRun(t);
  await writeFile(join(root, "plan.json"), "{}");
  await assert.rejects(validateAcceptanceResume(root, input, null), /Unverified reusable/);
  await rm(join(root, "plan.json"));
  const final = JSON.stringify({ status: "local_quality_passed", result: { videoPath: "renders/final.mp4" } });
  await writeFile(join(root, "acceptance-result.json"), final);
  await assert.rejects(validateAcceptanceResume(root, input, null), /Completed acceptance evidence is immutable/);
  assert.equal(await readFile(join(root, "acceptance-result.json"), "utf8"), final);
});

test("PRD resume identity binds verified fixture bytes even when local file URLs are identical", () => {
  const prd = { ...input, mode: "prd" as const, productUrl: undefined };
  const fixture = { transport: "verified-local-fixture-bytes", productionUploadTransportVerified: false, manifestSha256: "c".repeat(64), files: [{ path: "prd.md", kind: "prd", size_bytes: 123, sha256: "d".repeat(64) }] };
  assert.notEqual(acceptanceInputIdentity(prd, fixture), acceptanceInputIdentity(prd, { ...fixture, manifestSha256: "e".repeat(64) }));
  assert.throws(() => acceptanceInputIdentity(prd, null), /no verifiable fixture/);
});
