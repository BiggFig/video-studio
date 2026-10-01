import test from "node:test";
import assert from "node:assert/strict";
import { workerTimeRemainingMs } from "./deadline";
import { PipelineError } from "./types";
import { runPipeline } from "./index";
import type { WorkerInput } from "./types";

test("worker uses the smaller attempt allowance and absolute remaining time",()=>{
  const now=Date.parse("2026-10-01T00:00:00.000Z");
  assert.equal(workerTimeRemainingMs({budgets:{maxWallSeconds:1800},deadlineAt:"2026-10-01T00:05:00.000Z"},now),300000);
  assert.equal(workerTimeRemainingMs({budgets:{maxWallSeconds:60},deadlineAt:"2026-10-01T00:05:00.000Z"},now),60000);
  assert.equal(workerTimeRemainingMs({budgets:{maxWallSeconds:1800},deadlineAt:"2026-10-01T00:05:00.000Z"},now+240000),60000);
  assert.equal(workerTimeRemainingMs({},now),1800000);
});
test("expired or invalid deadline stops before hooks, ingestion or provider work",async()=>{
  const input:WorkerInput={jobId:"expired",ownerId:"test",mode:"url",productUrl:"https://example.com",videoType:"launch",format:"auto",files:[],deadlineAt:"2000-01-01T00:00:00.000Z"};
  let called=false;const hooks={persist:async()=>{called=true;},state:async()=>{called=true;},complete:async()=>{called=true;}};
  await assert.rejects(runPipeline(input,"should-never-be-created",hooks),(error:unknown)=>error instanceof PipelineError&&error.code==="time_budget");assert.equal(called,false);
  assert.throws(()=>workerTimeRemainingMs({deadlineAt:"not-a-deadline"}),(error:unknown)=>error instanceof PipelineError&&error.code==="invalid_deadline");
  assert.throws(()=>workerTimeRemainingMs({deadlineAt:"2026-02-30T00:00:00.000Z"}),(error:unknown)=>error instanceof PipelineError&&error.code==="invalid_deadline");
});
