import { createHash } from "node:crypto";

interface BundledFile { path: string; content: string }
export interface RuntimePin { snapshotId: string; runtimeBundleHash: string; runtimeHash: string }
export class RuntimePinError extends Error {
  readonly code = "RUNTIME_CHANGED";
  readonly action = "Restore the original worker deployment and snapshot, or submit a new video with the current runtime.";
}
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

/** Resolve the original job runtime before allocating compute or making paid calls. */
export function resolveRuntimePin(job: { checkpoint: Record<string, unknown>; artifacts: Record<string, unknown> }, bundle: BundledFile[], configuredSnapshot?: string): RuntimePin {
  const runtimeBundleHash = digest(JSON.stringify([...bundle].sort((a, b) => a.path.localeCompare(b.path))));
  const saved = job.checkpoint;
  const pinnedSnapshot = typeof saved.snapshotId === "string" ? saved.snapshotId : undefined;
  const hasArtifacts = Object.keys(job.artifacts).length > 0;
  if ((hasArtifacts || saved.runtimeHash || saved.runtimeBundleHash) && (!pinnedSnapshot || typeof saved.runtimeBundleHash !== "string" || typeof saved.runtimeHash !== "string")) {
    throw new RuntimePinError("The saved job does not identify a complete production runtime. Its artifacts cannot be reused safely.");
  }
  if (saved.runtimeBundleHash && saved.runtimeBundleHash !== runtimeBundleHash) throw new RuntimePinError("The worker or skill source changed after this video started. The saved job needs its original production runtime.");
  const snapshotId = pinnedSnapshot ?? configuredSnapshot;
  if (!snapshotId) throw new RuntimePinError("The job's production snapshot is unavailable.");
  const runtimeHash = digest(`video-studio-runtime-v1\0${runtimeBundleHash}\0${snapshotId}`);
  if (saved.runtimeHash && saved.runtimeHash !== runtimeHash) throw new RuntimePinError("The recorded worker runtime does not match its pinned source and snapshot.");
  return { snapshotId, runtimeBundleHash, runtimeHash };
}
