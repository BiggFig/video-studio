import { PipelineError,type WorkerInput } from "./types";

/** Attempts cannot extend the absolute job deadline pinned by dispatch. */
export function workerTimeRemainingMs(input:Pick<WorkerInput,"budgets"|"deadlineAt">,now=Date.now()){
  const seconds=input.budgets?.maxWallSeconds??1800;
  if(!Number.isFinite(seconds)||seconds<=0||seconds>3600)throw new PipelineError("invalid_deadline","The worker time allowance is invalid.","Ask the administrator to check the dispatch time budget.");
  let remaining=seconds*1000;
  if(input.deadlineAt!==undefined){
    const absolute=Date.parse(input.deadlineAt);
    if(typeof input.deadlineAt!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(input.deadlineAt)||!Number.isFinite(absolute)||new Date(absolute).toISOString()!==(input.deadlineAt.includes(".")?input.deadlineAt:input.deadlineAt.replace("Z",".000Z")))throw new PipelineError("invalid_deadline","The worker received an invalid absolute deadline.","Ask the administrator to restore the pinned job deadline.");
    remaining=Math.min(remaining,absolute-now);
  }
  if(remaining<=0)throw new PipelineError("time_budget","This job has reached its total processing time limit.","The retained draft needs an internal review. A retry cannot extend the original deadline.","needs_review");
  return remaining;
}
