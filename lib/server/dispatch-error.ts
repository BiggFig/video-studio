import { APIError } from "@vercel/sandbox";

export type LaunchStage = "runtime_pin" | "execution_budget" | "runtime_checkpoint" | "input_preparation" | "allocation" | "sandbox_checkpoint" | "source_upload" | "lease_refresh" | "provider_configuration" | "input_upload" | "command_start";

function machineValue(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(value) ? value : undefined;
}

/** Only log classified metadata; SDK messages, response bodies and headers may contain secrets. */
export function dispatchErrorSummary(error: unknown, stage: LaunchStage) {
  if (error instanceof APIError) {
    const data: unknown = error.json;
    const details = data && typeof data === "object" && "error" in data ? data.error : undefined;
    const code = details && typeof details === "object" && "code" in details ? machineValue(details.code) : undefined;
    const status = error.response.status;
    return { stage, type: "SandboxAPIError", ...(Number.isInteger(status) && status >= 100 && status <= 599 ? { httpStatus: status } : {}), ...(code ? { code } : {}) };
  }
  return { stage, type: error instanceof Error ? machineValue(error.name) ?? "Error" : "Unknown" };
}
