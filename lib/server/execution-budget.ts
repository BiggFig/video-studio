export const MIN_EXECUTION_SECONDS = 60;
export const MAX_EXECUTION_SECONDS = 1800;

/** These values are written by the dispatcher, never by a worker callback. */
export const SERVER_CHECKPOINT_FIELDS = [
  "sandboxName", "snapshotId", "runtimeVersion", "runtimeBundleHash", "runtimeHash", "runtimeId",
  "executionStartedAt", "deadlineAt",
] as const;

export function hasServerCheckpointField(checkpoint: Record<string, unknown>) {
  return SERVER_CHECKPOINT_FIELDS.some((field) => field in checkpoint);
}

export interface ExecutionBudget {
  executionStartedAt: string;
  deadlineAt: string;
}

export class ExecutionBudgetError extends Error {
  readonly name = "ExecutionBudgetError";
  readonly status = "needs_review";
  readonly retryable = false;
  constructor(
    readonly code: "EXECUTION_BUDGET_CONFIG" | "EXECUTION_BUDGET_INVALID" | "EXECUTION_BUDGET_EXHAUSTED",
    message: string,
    readonly action: string,
  ) { super(message); }
}

export function configuredExecutionSeconds(value: string | undefined): number {
  const seconds = value === undefined ? MAX_EXECUTION_SECONDS : Number(value);
  if (!Number.isSafeInteger(seconds) || seconds < MIN_EXECUTION_SECONDS || seconds > MAX_EXECUTION_SECONDS) {
    throw new ExecutionBudgetError("EXECUTION_BUDGET_CONFIG", "The studio's production time limit is invalid.", "Ask the administrator to set BETA_MAX_WORKER_SECONDS to a whole number from 60 to 1800.");
  }
  return seconds;
}

function invalidBudget(): never {
  throw new ExecutionBudgetError("EXECUTION_BUDGET_INVALID", "The saved job does not have a valid original execution deadline.", "Ask the administrator to inspect the saved job. Submit a new video if its original execution record cannot be restored.");
}

function timestamp(value: unknown): number {
  if (typeof value !== "string") return invalidBudget();
  const milliseconds = Date.parse(value);
  if (!Number.isSafeInteger(milliseconds) || new Date(milliseconds).toISOString() !== value) return invalidBudget();
  return milliseconds;
}

function validateBudget(budget: ExecutionBudget, now: number) {
  if (!Number.isSafeInteger(now) || now < 0) return invalidBudget();
  const started = timestamp(budget.executionStartedAt), deadline = timestamp(budget.deadlineAt);
  const duration = deadline - started;
  if (started < 0 || started > now || duration < MIN_EXECUTION_SECONDS * 1000 || duration > MAX_EXECUTION_SECONDS * 1000 || duration % 1000 !== 0) return invalidBudget();
  return deadline;
}

/** Resolve once before compute; retries retain the original window even when configuration changes. */
export function resolveExecutionBudget(
  job: { checkpoint: Record<string, unknown>; artifacts: Record<string, unknown> },
  configuredSeconds: string | undefined,
  now: number,
): ExecutionBudget {
  const seconds = configuredExecutionSeconds(configuredSeconds);
  const saved = job.checkpoint;
  const hasBudget = "executionStartedAt" in saved || "deadlineAt" in saved;
  if (hasBudget) {
    const budget = { executionStartedAt: saved.executionStartedAt, deadlineAt: saved.deadlineAt } as ExecutionBudget;
    validateBudget(budget, now);
    return budget;
  }
  // A pre-existing runtime/artifact record must never silently receive a new allowance.
  if (Object.keys(job.artifacts).length || hasServerCheckpointField(saved)) return invalidBudget();
  if (!Number.isSafeInteger(now) || now < 0 || !Number.isFinite(new Date(now + seconds * 1000).getTime())) return invalidBudget();
  const budget = { executionStartedAt: new Date(now).toISOString(), deadlineAt: new Date(now + seconds * 1000).toISOString() };
  validateBudget(budget, now);
  return budget;
}

/** Round down so the SDK and worker never gain time from fractional seconds. */
export function remainingExecutionSeconds(budget: ExecutionBudget, now: number): number {
  const seconds = Math.floor((validateBudget(budget, now) - now) / 1000);
  if (seconds < MIN_EXECUTION_SECONDS) {
    throw new ExecutionBudgetError("EXECUTION_BUDGET_EXHAUSTED", "This video has used its production time allowance.", "Submit a new video with a smaller source or ask the studio owner to review this job.");
  }
  return seconds;
}
