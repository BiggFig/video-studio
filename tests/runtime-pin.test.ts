import test from "node:test";
import assert from "node:assert/strict";
import { resolveRuntimePin, RuntimePinError } from "../lib/server/runtime-pin";
import { assertCompatibleRuntime } from "../worker/runtime";

const bundle = [{ path: "worker/index.ts", content: "pinned runtime" }, { path: "skills/video-studio/SKILL.md", content: "pinned skill" }];
test("runtime pin binds exact worker source, skill and immutable snapshot", () => {
  const pin = resolveRuntimePin({ checkpoint: {}, artifacts: {} }, bundle, "snapshot-original");
  assert.match(pin.runtimeHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(resolveRuntimePin({ checkpoint: { ...pin }, artifacts: { "plan.json": {} } }, [...bundle].reverse(), "snapshot-new"), pin, "Retries use the saved snapshot even when deployment defaults change");
  assert.throws(() => resolveRuntimePin({ checkpoint: { ...pin }, artifacts: {} }, [{ ...bundle[0], content: "changed code" }, bundle[1]], "snapshot-original"), RuntimePinError);
  assert.throws(() => resolveRuntimePin({ checkpoint: { ...pin, snapshotId: "changed snapshot" }, artifacts: {} }, bundle), RuntimePinError);
  assert.throws(() => resolveRuntimePin({ checkpoint: {}, artifacts: { "ledger.json": {} } }, bundle, "snapshot-original"), RuntimePinError);
  assert.throws(() => resolveRuntimePin({ checkpoint: {}, artifacts: {} }, bundle), RuntimePinError);
});

test("worker rejects missing or different saved runtime identity before reusing checkpoints", () => {
  const version = { skill: "skill-digest", pipeline: "1.0.0", runtimeHash: "runtime-digest", runtimeId: "snapshot-original" };
  assert.doesNotThrow(() => assertCompatibleRuntime(version, { ...version }));
  assert.throws(() => assertCompatibleRuntime({ skill: version.skill, pipeline: version.pipeline }, version), /different production runtime/);
  assert.throws(() => assertCompatibleRuntime(version, { ...version, runtimeHash: "different-code" }), /different production runtime/);
  assert.throws(() => assertCompatibleRuntime(version, { ...version, runtimeId: "different-snapshot" }), /different production runtime/);
});
