import test from "node:test";
import assert from "node:assert/strict";
import {
  configuredExecutionSeconds, ExecutionBudgetError, hasServerCheckpointField,
  remainingExecutionSeconds, resolveExecutionBudget, SERVER_CHECKPOINT_FIELDS,
} from "../lib/server/execution-budget";

const started = Date.parse("2026-09-30T12:00:00.123Z");
const fresh = () => ({ checkpoint: {}, artifacts: {} });
const budget = () => resolveExecutionBudget(fresh(), "1800", started);
function budgetError(code: ExecutionBudgetError["code"]) {
  return (error: unknown) => error instanceof ExecutionBudgetError && error.code === code && error.status === "needs_review" && error.retryable === false;
}

test("first allocation receives one explicit absolute production window", () => {
  const original = fresh();
  assert.deepEqual(resolveExecutionBudget(original, "900", started), {
    executionStartedAt: "2026-09-30T12:00:00.123Z", deadlineAt: "2026-09-30T12:15:00.123Z",
  });
  assert.deepEqual(original, fresh(), "Resolution is pure; dispatch must persist the returned window before allocation");
  assert.equal(remainingExecutionSeconds(budget(), started), 1800);
});

test("retried jobs spend only their original remaining time, including the gap between attempts", () => {
  const pinned = budget();
  const job = { checkpoint: { ...pinned, runtimeHash: "original-runtime" }, artifacts: { "ledger.json": {} } };
  const second = resolveExecutionBudget(job, "1800", started + 700_000);
  const third = resolveExecutionBudget(job, "1800", started + 1_500_000);
  assert.deepEqual(second, pinned);
  assert.deepEqual(third, pinned);
  assert.equal(remainingExecutionSeconds(second, started + 700_000), 1100);
  assert.equal(remainingExecutionSeconds(third, started + 1_500_000), 300);
});

test("configuration changes cannot extend or replace an existing job's deadline", () => {
  const pinned = resolveExecutionBudget(fresh(), "300", started);
  const job = { checkpoint: { ...pinned }, artifacts: {} };
  for (const setting of ["60", "900", "1800", undefined]) {
    const resumed = resolveExecutionBudget(job, setting, started + 120_000);
    assert.deepEqual(resumed, pinned);
    assert.equal(remainingExecutionSeconds(resumed, started + 120_000), 180);
  }
});

test("provisioning and upload time reduce launch allowance and fractional seconds never round up", () => {
  const pinned = budget();
  const allocationSeconds = remainingExecutionSeconds(pinned, started + 1_001);
  const workerSeconds = remainingExecutionSeconds(pinned, started + 36_010);
  const commandSeconds = remainingExecutionSeconds(pinned, started + 36_999);
  assert.equal(allocationSeconds, 1798);
  assert.equal(workerSeconds, 1763);
  assert.equal(commandSeconds, 1763);
  assert.ok(started + 36_999 + commandSeconds * 1000 <= Date.parse(pinned.deadlineAt));
});

test("an expired or sub-minute remainder cannot allocate or launch another worker", () => {
  const pinned = budget();
  assert.equal(remainingExecutionSeconds(pinned, started + 1_740_000), 60);
  for (const elapsed of [1_740_001, 1_799_999, 1_800_000, 2_000_000]) {
    assert.throws(() => remainingExecutionSeconds(pinned, started + elapsed), budgetError("EXECUTION_BUDGET_EXHAUSTED"));
  }
});

test("existing artifacts and runtime metadata without a deadline fail closed", () => {
  assert.throws(() => resolveExecutionBudget({ checkpoint: {}, artifacts: { "versions.json": {} } }, "1800", started), budgetError("EXECUTION_BUDGET_INVALID"));
  for (const field of SERVER_CHECKPOINT_FIELDS) {
    assert.throws(() => resolveExecutionBudget({ checkpoint: { [field]: null }, artifacts: {} }, "1800", started), budgetError("EXECUTION_BUDGET_INVALID"), `Missing or corrupt record: ${field}`);
  }
});

test("corrupt, reversed, future, overlong and incomplete saved execution windows fail closed", () => {
  const pinned = budget();
  const records = [
    { executionStartedAt: pinned.executionStartedAt }, { deadlineAt: pinned.deadlineAt },
    { ...pinned, executionStartedAt: started }, { ...pinned, deadlineAt: null },
    { ...pinned, deadlineAt: "invalid" }, { ...pinned, deadlineAt: "September 30, 2026 12:30:00" },
    { ...pinned, deadlineAt: pinned.executionStartedAt },
    { ...pinned, deadlineAt: new Date(started - 1000).toISOString() },
    { ...pinned, deadlineAt: new Date(started + 1_801_000).toISOString() },
    { ...pinned, deadlineAt: new Date(started + 1_800_001).toISOString() },
    { ...pinned, deadlineAt: new Date(started + 59_000).toISOString() },
    { executionStartedAt: new Date(started + 1000).toISOString(), deadlineAt: new Date(started + 301_000).toISOString() },
  ];
  for (const checkpoint of records) {
    assert.throws(() => resolveExecutionBudget({ checkpoint, artifacts: {} }, "1800", started), budgetError("EXECUTION_BUDGET_INVALID"));
  }
  assert.throws(() => remainingExecutionSeconds(pinned, started - 1), budgetError("EXECUTION_BUDGET_INVALID"), "Clock reversal must not add time");
});

test("production configuration and clock values must be finite whole values in bounds", () => {
  assert.equal(configuredExecutionSeconds(undefined), 1800);
  assert.equal(configuredExecutionSeconds("60"), 60);
  for (const value of ["", " ", "NaN", "Infinity", "59", "0", "-10", "60.5", "1801", "3600", "ten"]) {
    assert.throws(() => configuredExecutionSeconds(value), budgetError("EXECUTION_BUDGET_CONFIG"));
    assert.throws(() => resolveExecutionBudget({ checkpoint: { ...budget() }, artifacts: {} }, value, started), budgetError("EXECUTION_BUDGET_CONFIG"));
  }
  for (const now of [NaN, Infinity, -1, started + 0.5, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => resolveExecutionBudget(fresh(), "1800", now), budgetError("EXECUTION_BUDGET_INVALID"));
  }
});

test("worker callbacks cannot replace or clear execution, runtime, sandbox or operator measurement fields", () => {
  assert.equal(hasServerCheckpointField({ stage: "render", progress: 2 }), false);
  for (const field of ["executionStartedAt", "deadlineAt", "snapshotId", "runtimeHash", "runtimeBundleHash", "runtimeVersion", "runtimeId", "sandboxName", "operatorMeasurements"]) {
    for (const value of [null, undefined, "replacement"]) assert.equal(hasServerCheckpointField({ [field]: value }), true, field);
  }
});
