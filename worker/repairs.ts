import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { hash,writeJson } from "./media";
import { PipelineError,type Hooks,type WorkerInput } from "./types";

const digest=z.string().regex(/^[a-f0-9]{64}$/);
const journalSchema=z.object({version:z.literal(1),jobId:z.string(),maxRepairs:z.number().int().min(0).max(2),entries:z.array(z.object({pass:z.number().int().min(1).max(2),status:z.enum(["reserved","applied"]),reason:z.string().max(16000),reservedAt:z.string(),previousPlanSha256:digest,appliedAt:z.string().optional(),planSha256:digest.optional()})).max(2)});
type Journal=z.infer<typeof journalSchema>;
const blocked=(code:string,message:string)=>new PipelineError(code,message,"Ask the administrator to inspect the retained repair ledger and provider response before recovery. No additional repair was charged.","needs_review");

/** A repair is consumed before any paid planning or plan mutation can begin. */
export class RepairBudget {
  private relative="analysis/repair-ledger.json";
  private journal:Journal;
  private initialized=false;
  constructor(private workspace:string,input:WorkerInput,private hooks:Hooks){this.journal={version:1,jobId:input.jobId,maxRepairs:input.budgets?.maxRepairPasses??2,entries:[]};}
  get consumed(){return this.journal.entries.length;}
  get descriptions(){return this.journal.entries.map(entry=>`Pass ${entry.pass} (${entry.status}): ${entry.reason}`);}
  async init(){
    let raw:string;
    try{raw=await readFile(join(this.workspace,this.relative),"utf8");}
    catch(error){if(error instanceof Error&&"code"in error&&error.code==="ENOENT"){this.initialized=true;return;}throw blocked("repair_state_unreadable","The saved repair allowance could not be read.");}
    let saved:Journal;try{saved=journalSchema.parse(JSON.parse(raw));}catch{throw blocked("repair_state_unreadable","The saved repair allowance is invalid.");}
    if(saved.jobId!==this.journal.jobId||saved.maxRepairs!==this.journal.maxRepairs||saved.entries.length>saved.maxRepairs||saved.entries.some((entry,index)=>entry.pass!==index+1))throw blocked("repair_state_changed","The saved repair allowance does not match this job.");
    this.journal=saved;
    if(saved.entries.some(entry=>entry.status==="reserved"))throw blocked("repair_interrupted","A repair was reserved but its completed plan was not confirmed. Repeating the paid repair was prevented.");
    const last=saved.entries.at(-1);
    if(last){let actual:string;try{actual=await hash(join(this.workspace,"plan.json"));}catch{throw blocked("repair_plan_changed","The last repaired plan is missing or unreadable.");}if(!last.planSha256||!last.appliedAt||actual!==last.planSha256)throw blocked("repair_plan_changed","The retained plan does not match the last confirmed repair.");}
    this.initialized=true;
  }
  private async persist(){await writeJson(join(this.workspace,this.relative),this.journal);await this.hooks.persist([this.relative]);}
  async execute<T>(reason:string,perform:()=>Promise<T>):Promise<T>{
    if(!this.initialized)throw new Error("RepairBudget.init must complete before reserving a repair");
    if(this.journal.entries.some(entry=>entry.status==="reserved"))throw blocked("repair_interrupted","A reserved repair has not completed. Repeating it was prevented.");
    if(this.consumed>=this.journal.maxRepairs)throw blocked("repair_budget","This job has consumed its complete repair allowance.");
    const entry:Journal["entries"][number]={pass:this.consumed+1,status:"reserved",reason:reason.slice(0,16000),reservedAt:new Date().toISOString(),previousPlanSha256:await hash(join(this.workspace,"plan.json"))};
    this.journal.entries.push(entry);await this.persist();
    const result=await perform();
    entry.planSha256=await hash(join(this.workspace,"plan.json"));entry.appliedAt=new Date().toISOString();entry.status="applied";await this.persist();
    return result;
  }
}
