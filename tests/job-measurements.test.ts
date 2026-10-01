import test from "node:test";
import assert from "node:assert/strict";
import { applyMeasurement, assertApplyIdentity, measurementSummary, newMeasurement, parseMeasurement, runMeasurements, type MeasurementApplyPorts } from "../scripts/job-measurements";

const job = "f1ca8e75-4c91-408a-a2b0-fb31c847096a", owner = "fdb2aa43-babb-44fb-93ef-d5175d1e88c3";
const evidence = { provider: "Test invoice fixture", invoiceReference: "fixture-invoice", lineReference: "row-2", allocationMethod: "Test-only exact attributed charge; not a real cost assertion", reviewedBy: "test", reviewedAt: "2026-09-30T12:00:00Z" };

test("unknown invoices and publishability stay unknown, and partial cost is never a total", () => {
  const record = newMeasurement(job, owner);
  assert.equal(measurementSummary(record).actualTotalUsd, null);
  assert.equal(measurementSummary(record).publishability, null);
  record.costs.model = { amountUsd: "0.012345", evidence };
  const summary = measurementSummary(record);
  assert.equal(summary.actualTotalUsd, null);
  assert.equal(summary.knownSubtotalUsd, "0.012345");
  assert.equal(summary.unknownComponents.length, 3);
  assert.throws(() => assertApplyIdentity(record, job, owner), /no completed cost/);
});

test("known zero requires invoice evidence and unsupported currencies/rates cannot masquerade as actual cost", () => {
  const record = newMeasurement(job, owner);
  record.costs.compute = { amountUsd: "0", evidence: null };
  assert.throws(() => parseMeasurement(record));
  record.costs.compute = { amountUsd: "0", evidence };
  assert.doesNotThrow(() => parseMeasurement(record));
  assert.throws(() => parseMeasurement({ ...record, currency: "EUR" }));
  for (const amountUsd of ["-1", "1e3", "NaN", "0.1234567", 1]) assert.throws(() => parseMeasurement({ ...record, costs: { ...record.costs, model: { amountUsd, evidence } } }));
});

test("invoice-backed component totals use exact decimal arithmetic across all attempts", () => {
  const record = newMeasurement(job, owner);
  record.costs = { model: { amountUsd: "0.1", evidence }, audioAndTranscription: { amountUsd: "0.2", evidence }, compute: { amountUsd: "0.000001", evidence }, storageAndDelivery: { amountUsd: "0", evidence } };
  assert.equal(measurementSummary(record).actualTotalUsd, "0.300001");
  assert.equal(measurementSummary(record).costScope, "all_job_attempts");
  assert.doesNotThrow(() => assertApplyIdentity(record, job, owner));
  assert.throws(() => assertApplyIdentity(record, owner, owner), /exactly match/);
  assert.throws(() => assertApplyIdentity(record, job, job), /exactly match/);
});

test("operator judgment is explicitly distinguished from tester feedback and requires review evidence", () => {
  const record = newMeasurement(job, owner);
  record.publishability = { judgment: "not_publishable", reviewerKind: "operator", reviewedBy: "test", reviewedAt: "2026-09-30T12:00:00Z", evidenceReference: "fixture-review", notes: "Test-only assessment; no customer output reviewed." };
  assert.deepEqual(measurementSummary(record).publishability, { judgment: "not_publishable", reviewerKind: "operator" });
  assert.equal(measurementSummary(record).actualTotalUsd, null);
  assert.doesNotThrow(() => assertApplyIdentity(record, job, owner));
  assert.throws(() => parseMeasurement({ ...record, publishability: { ...record.publishability, evidenceReference: "" } }));
});

test("default CLI and missing apply flag cannot reach database reconciliation", async () => {
  const result = await runMeasurements([]);
  assert.equal("mode" in result && result.mode, "offline");
  assert.equal(result.databaseUpdated, false);
  await assert.rejects(runMeasurements(["--phase", "apply", "--file", "not-read.json"]), /explicit --apply/);
});

function judgedRecord() {
  const record = newMeasurement(job, owner, "2026-09-30T12:00:00Z");
  record.publishability = { judgment: "not_publishable", reviewerKind: "operator", reviewedBy: "test", reviewedAt: "2026-09-30T12:00:00Z", evidenceReference: "fixture-review", notes: "Synthetic test record only." };
  return record;
}
test("mocked apply retains audit before one query, passes exact identities and null unknown cost, then writes receipt", async () => {
  const record = judgedRecord(), events: string[] = [], calls: unknown[][] = [];
  const ports: MeasurementApplyPorts = {
    retainAudit: async saved => { assert.deepEqual(saved, record); events.push("audit"); },
    query: async (_sql, params) => { events.push("query"); calls.push(params); return [{ id: job, user_id: owner, status: "ready", cost_usd: "1.250000" }]; },
    writeReceipt: async receipt => { events.push("receipt"); assert.equal(receipt.actualTotalUsd, "1.250000"); },
  };
  const first = await applyMeasurement(record, ports);
  assert.deepEqual(events, ["audit", "query", "receipt"]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(0, 3), [job, owner, null]);
  assert.deepEqual(JSON.parse(String(calls[0][4])), record);
  const second = await applyMeasurement(record, ports);
  assert.equal(second.recordSha256, first.recordSha256, "An identical retry must supply the same audit identity; SQL idempotency requires separate database verification.");
});

test("uppercase UUID input and CLI identities use canonical audit IDs and accept a lowercase database response", async () => {
  const record = judgedRecord(), uppercase = { ...record, jobId: job.toUpperCase(), ownerId: owner.toUpperCase() };
  const parsed = parseMeasurement(uppercase);
  assert.equal(parsed.jobId, job);
  assert.equal(parsed.ownerId, owner);
  assert.doesNotThrow(() => assertApplyIdentity(parsed, uppercase.jobId, uppercase.ownerId));
  assert.throws(() => assertApplyIdentity(parsed, uppercase.ownerId, uppercase.ownerId), /exactly match/);
  let receipts = 0;
  const ports: MeasurementApplyPorts = {
    retainAudit: async saved => { assert.equal(saved.jobId, job); assert.equal(saved.ownerId, owner); },
    query: async (_sql, params) => { assert.deepEqual(params.slice(0, 2), [job, owner]); return [{ id: job, user_id: owner, status: "ready", cost_usd: null }]; },
    writeReceipt: async receipt => { assert.equal(receipt.jobId, job); assert.equal(receipt.ownerId, owner); receipts++; },
  };
  const canonical = await applyMeasurement(record, ports);
  const result = await applyMeasurement(uppercase, ports);
  assert.equal(result.databaseUpdated, true);
  assert.equal(result.recordSha256, canonical.recordSha256, "UUID casing must not create a different audit identity.");
  assert.equal(receipts, 2, "Both mocked successful updates must produce receipts.");
});

test("mocked missing, multiple, mismatched or active results never produce a successful receipt", async () => {
  const row = { id: job, user_id: owner, status: "ready", cost_usd: null };
  for (const rows of [[], [row, row], [{ ...row, user_id: job }], [{ ...row, status: "rendering" }]]) {
    let receipts = 0;
    await assert.rejects(applyMeasurement(judgedRecord(), { retainAudit: async () => {}, query: async () => rows, writeReceipt: async () => { receipts++; } }));
    assert.equal(receipts, 0);
  }
});

test("audit failure prevents the query and an ambiguous query failure retains evidence without a success receipt", async () => {
  let queries = 0, audits = 0, receipts = 0;
  await assert.rejects(applyMeasurement(judgedRecord(), { retainAudit: async () => { throw new Error("fixture audit failure"); }, query: async () => { queries++; return []; }, writeReceipt: async () => { receipts++; } }));
  assert.equal(queries, 0);
  await assert.rejects(applyMeasurement(judgedRecord(), { retainAudit: async () => { audits++; }, query: async () => { queries++; throw new Error("fixture response lost"); }, writeReceipt: async () => { receipts++; } }));
  assert.equal(audits, 1);
  assert.equal(queries, 1);
  assert.equal(receipts, 0);
});
