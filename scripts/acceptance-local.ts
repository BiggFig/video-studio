/** Explicitly opted-in, paid local acceptance. Never proves production queue/storage access. */
import { createHash } from "node:crypto";
import { mkdir,readFile,readdir,realpath,stat } from "node:fs/promises";
import { isAbsolute,relative,resolve,join } from "node:path";
import { runPipeline } from "../worker/index";
import { cancelCommands,hash,json,writeJson } from "../worker/media";
import { Providers } from "../worker/providers";
import { compilePlan,makePlan,preparePlanRepair,prepareRetainedPlanRepair } from "../worker/planning";
import { loadCompletedProductionStages } from "../worker/scripting";
import { parseReview } from "../worker/quality";
import { RepairBudget } from "../worker/repairs";
import { safePath } from "../worker/security";
import { localFixtureInput } from "./local-fixture-input";
import { acceptanceInputIdentity,validateAcceptanceResume,type AcceptanceManifest,type AcceptanceStages } from "./acceptance-identity";
import { PipelineError,type Evidence,type Hooks,type Plan,type WorkerInput } from "../worker/types";

async function main(){
  if(!process.argv.includes("--run-paid"))throw new Error("This invokes paid providers. Explicitly pass --run-paid --url <public product URL> --workspace <ignored .local folder>.");
  if(process.env.WORKER_CALLBACK_URL||process.env.PIPELINE_CALLBACK_TOKEN)throw new Error("Local acceptance must not receive production worker callbacks or tokens.");
  const flag=(name:string)=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined;};
  const url=flag("--url"),fixturePath=flag("--fixture"),directory=flag("--workspace");if((!url&&!fixturePath)||(url&&fixturePath)||!directory)throw new Error("Exactly one of --url or --fixture, plus --workspace, is required.");
  const fixture=fixturePath?await localFixtureInput(fixturePath):undefined;
  const workspace=resolve(directory),localRoot=resolve(".local");
  if(!workspace.startsWith(localRoot+"\\")&&!workspace.startsWith(localRoot+"/"))throw new Error("Acceptance files must be stored below the ignored .local directory.");
  const existing:string[]=await readdir(workspace).catch(()=>[] as string[]);
  if(existing.length&&!process.argv.includes("--resume"))throw new Error("The acceptance folder is not empty. Explicit --resume is required to reuse its checkpoints.");
  if(!existing.length&&process.argv.includes("--resume"))throw new Error("No original acceptance checkpoints exist in this folder; reuse is prohibited.");
  if(existing.includes("acceptance-retained-review-repair.json"))throw new Error("This recovery attempt already consumed or reserved a retained-review repair. Further resume is prohibited; retain its aggregate budget and inspect the terminal evidence.");
  await mkdir(workspace,{recursive:true});
  const actualRelative=relative(await realpath(localRoot),await realpath(workspace));
  if(!actualRelative||actualRelative.startsWith("..")||isAbsolute(actualRelative))throw new Error("Acceptance workspace must not escape the ignored local directory through a symlink.");
  const runtimeFiles:string[]=[];
  async function collect(dir:string){for(const entry of await readdir(dir,{withFileTypes:true})){const file=join(dir,entry.name);if(entry.isDirectory()&&!entry.name.startsWith(".")&&entry.name!=="__pycache__")await collect(file);else if(entry.isFile()&&!entry.name.endsWith(".test.ts")&&!entry.name.startsWith("smoke-")&&/\.(ts|py|md|json|html|css|js|txt)$/.test(entry.name))runtimeFiles.push(file);}}
  await collect("worker");await collect("skills/video-studio");runtimeFiles.push("package-lock.json","scripts/acceptance-local.ts","scripts/acceptance-identity.ts","scripts/local-fixture-input.ts");runtimeFiles.sort();
  const runtimeDigest=createHash("sha256");for(const file of runtimeFiles)runtimeDigest.update(file.replaceAll("\\","/")).update(await readFile(file));
  const input:WorkerInput={jobId:fixture?"local-acceptance-prd":"local-acceptance-url",ownerId:"local-acceptance-operator",...(fixture?.input||{mode:"url",productUrl:new URL(url!).href,videoType:"launch",format:"auto",files:[]}),runtimeHash:runtimeDigest.digest("hex"),runtimeId:`local-${process.platform}-${process.version}`,budgets:{maxDurationSeconds:300,maxModelCalls:10,maxModelInputTokens:200000,maxModelOutputTokens:30000,maxAudioGenerations:2,maxRepairPasses:2,maxWallSeconds:1800}};
  if(process.env.VIDEO_STUDIO_SKILL_PATH&&resolve(process.env.VIDEO_STUDIO_SKILL_PATH)!==resolve("skills/video-studio"))throw new Error("Local acceptance must use the skill directory included in its runtime hash.");
  // Validate before overwriting provenance or allowing retained-review repairs.
  // Historical evidence under a different runtime remains untouched.
  const verified=existing.length?await validateAcceptanceResume(workspace,input,fixture?.provenance||null):undefined;
  const manifestPath=join(workspace,"acceptance-artifacts.json"),historyPath=join(workspace,"acceptance-stages.json");
  const manifest:AcceptanceManifest=verified?.manifest||{};
  const stages:AcceptanceStages=verified?.stages||[];
  const provenance={kind:"local-provider-acceptance",paidProviders:true,productionQueueVerified:false,productionPrivateStorageVerified:false,productionOwnerAccessVerified:false,input,inputIdentity:verified?.inputIdentity||acceptanceInputIdentity(input,fixture?.provenance||null),localFixture:fixture?.provenance||null,startedAt:verified?.startedAt||new Date().toISOString(),resumedAt:verified?new Date().toISOString():undefined,retainedReviewRepair:null as null|{reviewPath:string;reviewSha256:string;repairPassesConsumed:number;reusedAsPassedCheck:false;retainedPlanResponse?:{path:string;sha256:string}}};
  const hooks:Hooks={
    async persist(paths){for(const path of [...new Set(paths)]){const full=safePath(workspace,path),info=await stat(full);if(!info.isFile()||info.size===0)throw new Error(`Invalid persisted artifact: ${path}`);manifest[path]={sha256:await hash(full),size:info.size,verifiedAt:new Date().toISOString()};}await writeJson(manifestPath,manifest);},
    async state(status,checkpoint){const entry={status,at:new Date().toISOString(),checkpoint};stages.push(entry);await writeJson(historyPath,stages);console.log(JSON.stringify(entry));},
    async complete(result){if(!result.quality.passed||Object.values(result.quality.checks).some(check=>!check.passed||!check.performed))throw new Error("Unchecked output cannot pass local acceptance");await writeJson(join(workspace,"acceptance-result.json"),{...provenance,status:"local_quality_passed",finishedAt:new Date().toISOString(),result});stages.push({status:"local_quality_passed",at:new Date().toISOString()});await writeJson(historyPath,stages);}
  };
  const repairBudget=new RepairBudget(workspace,input,hooks);await repairBudget.init();
  const deadline=Date.parse(provenance.startedAt)+(input.budgets!.maxWallSeconds??1800)*1000;
  if(deadline-Date.now()<60000)throw new Error("The original acceptance wall-time allowance has expired or has less than 60 seconds remaining; recovery cannot reset it.");
  await writeJson(join(workspace,"acceptance-provenance.json"),provenance);
  const timer=setTimeout(()=>{cancelCommands();console.error("Local acceptance exceeded its original cumulative 1800 second wall-time ceiling");process.exit(124);},Math.max(1,deadline-Date.now()));timer.unref();
  try{
    const repairReview=flag("--repair-from-review");
    if(repairReview){
      if(!process.argv.includes("--resume"))throw new Error("A retained review repair requires explicit --resume.");
      const repairPath=join(workspace,"acceptance-retained-review-repair.json");
      if(await stat(repairPath).catch(()=>null))throw new Error("This local recovery already reserved its retained-review repair; inspect it before another run.");
      const reviewPath=safePath(workspace,repairReview),raw=await readFile(reviewPath,"utf8"),review=parseReview(JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,"")));
      const findings=review.findings.filter(f=>f.repair);if(!findings.some(f=>f.severity!=="minor"))throw new Error("The retained review does not contain an actionable major finding.");
      const plan=await json<Plan>(join(workspace,"plan.json"));
      const evidence=await json<Evidence>(join(workspace,"analysis/evidence.json")),retainedPlan=flag("--repair-plan-response");
      const repair={plan,findings};
      let performRepair:()=>Promise<Plan>,retainedPlanResponse:{path:string;sha256:string}|undefined;
      if(retainedPlan){
        const saved=await readFile(safePath(workspace,retainedPlan),"utf8"),response=JSON.parse(saved.replace(/^```(?:json)?\s*|\s*```$/g,""));
        retainedPlanResponse={path:retainedPlan,sha256:createHash("sha256").update(saved).digest("hex")};
        performRepair=plan.production?await prepareRetainedPlanRepair(input,evidence,response,hooks,workspace,repair):()=>compilePlan(input,evidence,response,hooks,workspace,repair);
      }else{
        // Read completed stages before initializing a provider, and preflight the
        // complete paid repair/QC cycle before consuming its durable repair slot.
        const completed=plan.production?await loadCompletedProductionStages(input,evidence,workspace,plan):undefined;
        const providers=new Providers(workspace,input,hooks);await providers.init(resolve("skills/video-studio"));
        performRepair=completed?await preparePlanRepair(input,evidence,completed.research,providers,hooks,workspace,repair):()=>makePlan(input,evidence,providers,hooks,workspace,repair);
      }
      await repairBudget.execute(`Retained review: ${findings.map(f=>f.message).join("; ")}`,async()=>{
        provenance.retainedReviewRepair={reviewPath:repairReview,reviewSha256:await hash(reviewPath),repairPassesConsumed:1,reusedAsPassedCheck:false,...(retainedPlanResponse?{retainedPlanResponse}:{})};await writeJson(join(workspace,"acceptance-provenance.json"),provenance);
        await writeJson(repairPath,{status:"reserved",reviewPath:repairReview,reviewSha256:await hash(reviewPath),findings,reusedAsPassedCheck:false,repairPassesConsumed:1});
        await writeJson(join(workspace,"acceptance-before-repair-plan.json"),plan);
        return performRepair();
      });
      await writeJson(repairPath,{status:"applied",reviewPath:repairReview,reviewSha256:await hash(reviewPath),findings,reusedAsPassedCheck:false,repairPassesConsumed:1,remainingRepairPasses:Math.max(0,(input.budgets!.maxRepairPasses??2)-repairBudget.consumed)});
    }
    const result=await runPipeline(input,workspace,hooks,fixture?.dependencies);console.log(JSON.stringify({status:"local_quality_passed",workspace,videoPath:join(workspace,result.videoPath),posterPath:join(workspace,result.posterPath),durationSeconds:result.durationSeconds,width:result.width,height:result.height,productionQueueAndStorageVerified:false}));}
  catch(error){const issue=error instanceof PipelineError?error:null;const failure={...provenance,status:issue?.status||"failed",finishedAt:new Date().toISOString(),error:{code:issue?.code||"local_execution_failed",message:error instanceof Error?error.message:"Unknown failure",action:issue?.action||"Inspect retained local evidence before a bounded retry."}};await writeJson(join(workspace,"acceptance-result.json"),failure);console.error(JSON.stringify({status:failure.status,error:failure.error,workspace}));process.exitCode=1;}
  finally{clearTimeout(timer);}
}
void main().catch(error=>{console.error(error instanceof Error?error.message:"Local acceptance failed to start");process.exitCode=1;});
