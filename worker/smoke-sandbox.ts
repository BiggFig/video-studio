/** Developer acceptance runner. Executes synthetic media fixtures in the pinned Linux worker. */
import { Sandbox } from "@vercel/sandbox";
import { readdir,readFile,writeFile,mkdir } from "node:fs/promises";
import { join } from "node:path";

async function main(){
  const snapshot=process.env.WORKER_SNAPSHOT_ID||JSON.parse(await readFile(".local/worker-snapshot.json","utf8")).id;
  const sandbox=await Sandbox.create({name:`video-studio-render-smoke-${Date.now()}`,source:{type:"snapshot",snapshotId:snapshot},persistent:false,resources:{vcpus:4},timeout:10*60_000});
  try{
    const workerFiles=(await readdir("worker")).filter(p=>p.endsWith(".ts")&&!p.includes("sandbox")&&(!p.endsWith(".test.ts")||p==="pdf-ingest.test.ts"));
    await sandbox.writeFiles(await Promise.all(workerFiles.map(async path=>({path:`/vercel/sandbox/worker/${path}`,content:await readFile(join("worker",path))}))));
    const result=await sandbox.runCommand({cmd:"node",args:["--import","tsx","worker/smoke-render.ts","--out","/vercel/sandbox/smoke"],cwd:"/vercel/sandbox",timeoutMs:8*60_000});
    console.log(await result.stdout());if(result.exitCode!==0)throw new Error((await result.stderr()).slice(-4000));
    const documents=await sandbox.runCommand({cmd:"env",args:["STUDIO_PDF_INTEGRATION=1","node","--import","tsx","--test","worker/pdf-ingest.test.ts"],cwd:"/vercel/sandbox",timeoutMs:60_000});
    const documentOutput=await documents.stdout();console.log(documentOutput);if(documents.exitCode!==0)throw new Error((await documents.stderr()).slice(-4000));
    await sandbox.runCommand({cmd:"ffmpeg",args:["-v","error","-y","-ss","2","-i","/vercel/sandbox/smoke/renders/draft-0.mp4","-frames:v","1","/vercel/sandbox/smoke/landscape.jpg"]});
    await sandbox.runCommand({cmd:"ffmpeg",args:["-v","error","-y","-ss","2","-i","/vercel/sandbox/smoke/renders/draft-1.mp4","-frames:v","1","/vercel/sandbox/smoke/vertical.jpg"]});
    await mkdir(".worker-smoke/linux",{recursive:true});
    await writeFile(".worker-smoke/linux/pdf-ingest.txt",documentOutput);
    for(const path of ["smoke-result.json","landscape.jpg","vertical.jpg","renders/draft-0.mp4","renders/draft-1.mp4","renders/draft-2.mp4"]){const buffer=await sandbox.readFileToBuffer({path:`/vercel/sandbox/smoke/${path}`});if(!buffer)throw new Error("Expected smoke artifact missing");await writeFile(join(".worker-smoke/linux",path.replace("renders/","")),buffer);}
    console.log("Linux renderer smoke artifacts saved in .worker-smoke/linux");
  }finally{await sandbox.stop();}
}
void main().catch(error=>{console.error(error instanceof Error?error.message:"Sandbox smoke failed");process.exitCode=1;});
