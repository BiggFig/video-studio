import { PipelineError } from "./types";

export function assertCompatibleRuntime(previous: Record<string, string>, current: Record<string, string>) {
  if (["skill", "pipeline", "runtimeHash", "runtimeId"].some(key => !previous[key] || previous[key] !== current[key])) {
    throw new PipelineError("runtime_changed", "This saved job uses a different production runtime.", "Ask the administrator to restore the original worker deployment and snapshot.", "needs_review");
  }
}
