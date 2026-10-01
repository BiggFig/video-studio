import test,{type TestContext} from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,readFile,realpath,rm,writeFile } from "node:fs/promises";
import { basename,dirname,join,resolve } from "node:path";
import { tmpdir } from "node:os";
import { RepairBudget } from "./repairs";
import { writeJson } from "./media";
import { PipelineError,type Hooks,type WorkerInput } from "./types";

const input:WorkerInput={jobId:"repair-test",ownerId:"operator",mode:"url",productUrl:"https://example.com",videoType:"launch",format:"auto",files:[],budgets:{maxRepairPasses:2}};
const issue=(code:string)=>(error:unknown)=>error instanceof PipelineError&&error.code===code&&error.status==="needs_review";
const hooks=(persist:Hooks["persist"]=async()=>{}):Hooks=>({persist,state:async()=>{},complete:async()=>{}});
async function workspace(t:TestContext){
  const root=await realpath(tmpdir()),path=await mkdtemp(join(root,"video-studio-repairs-"));
  t.after(async()=>{const target=await realpath(path);if(resolve(target)!==resolve(path)||dirname(target)!==root||!basename(target).startsWith("video-studio-repairs-"))throw new Error("Test cleanup target escaped its registered temporary directory");await rm(target,{recursive:true,force:true});});
  await writeJson(join(path,"plan.json"),{scene:"original"});return path;
}

test("repair reservation reaches durable hooks before paid work and records the resulting plan",async(t)=>{
  const path=await workspace(t),events:string[]=[];
  const budget=new RepairBudget(path,input,hooks(async paths=>{assert.deepEqual(paths,["analysis/repair-ledger.json"]);const journal=JSON.parse(await readFile(join(path,paths[0]),"utf8"));events.push(journal.entries.at(-1).status);}));await budget.init();
  await budget.execute("Change a concrete asset",async()=>{events.push("provider");await writeJson(join(path,"plan.json"),{scene:"repaired"});return 42;});
  assert.deepEqual(events,["reserved","provider","applied"]);assert.equal(budget.consumed,1);assert.match(budget.descriptions[0],/Pass 1 \(applied\)/);
});
test("consumed repairs survive retries and a third paid repair cannot run",async(t)=>{
  const path=await workspace(t);let calls=0;
  for(let attempt=0;attempt<2;attempt++){const budget=new RepairBudget(path,input,hooks());await budget.init();assert.equal(budget.consumed,attempt);await budget.execute("Targeted repair",async()=>{calls++;await writeJson(join(path,"plan.json"),{revision:calls});});}
  const restored=new RepairBudget(path,input,hooks());await restored.init();assert.equal(restored.consumed,2);await assert.rejects(restored.execute("Extra repair",async()=>{calls++;}),issue("repair_budget"));assert.equal(calls,2);
});
test("failed reservation checkpoint prevents the provider callback and retries fail closed",async(t)=>{
  const path=await workspace(t);let calls=0;const budget=new RepairBudget(path,input,hooks(async()=>{throw new Error("durable store unavailable");}));await budget.init();
  await assert.rejects(budget.execute("Repair",async()=>{calls++;}),/durable store unavailable/);assert.equal(calls,0);
  await assert.rejects(new RepairBudget(path,input,hooks()).init(),issue("repair_interrupted"));
});
test("interruption during paid repair cannot reset the reservation on restart",async(t)=>{
  const path=await workspace(t);let calls=0;const budget=new RepairBudget(path,input,hooks());await budget.init();
  await assert.rejects(budget.execute("Repair",async()=>{calls++;throw new Error("provider connection interrupted");}),/provider connection interrupted/);
  await assert.rejects(new RepairBudget(path,input,hooks()).init(),issue("repair_interrupted"));assert.equal(calls,1);
});
test("a plan uploaded without its applied journal still resumes as unresolved",async(t)=>{
  const path=await workspace(t);let durableJournal="",saves=0;const budget=new RepairBudget(path,input,hooks(async()=>{saves++;if(saves===2)throw new Error("application checkpoint interrupted");durableJournal=await readFile(join(path,"analysis/repair-ledger.json"),"utf8");}));await budget.init();
  await assert.rejects(budget.execute("Repair",async()=>{await writeJson(join(path,"plan.json"),{revision:1});}),/application checkpoint interrupted/);
  // Restore the last acknowledged remote artifact, as a retry would.
  await writeFile(join(path,"analysis/repair-ledger.json"),durableJournal);await assert.rejects(new RepairBudget(path,input,hooks()).init(),issue("repair_interrupted"));
});
test("corrupt journals, changed allowances and altered repaired plans never silently reset",async(t)=>{
  const path=await workspace(t),budget=new RepairBudget(path,input,hooks());await budget.init();await budget.execute("Repair",async()=>{await writeJson(join(path,"plan.json"),{revision:1});});
  await assert.rejects(new RepairBudget(path,{...input,budgets:{maxRepairPasses:1}},hooks()).init(),issue("repair_state_changed"));
  await writeJson(join(path,"plan.json"),{revision:"unexpected"});await assert.rejects(new RepairBudget(path,input,hooks()).init(),issue("repair_plan_changed"));
  await writeFile(join(path,"analysis/repair-ledger.json"),"{broken");await assert.rejects(new RepairBudget(path,input,hooks()).init(),issue("repair_state_unreadable"));
});
