/** Developer acceptance runner. Synthetic fixtures only; no provider calls or delivery. */
import { Sandbox } from "@vercel/sandbox";
import { createHash } from "node:crypto";
import { readFile,writeFile,mkdir } from "node:fs/promises";
import { join } from "node:path";

async function main(){
  const snapshot=process.env.WORKER_SNAPSHOT_ID||JSON.parse(await readFile(".local/worker-snapshot.json","utf8")).id;
  const bundle=JSON.parse(await readFile("lib/generated/worker-bundle.json","utf8")) as {path:string;content:string}[];
  const extras=["worker/smoke-motion.ts","worker/pdf-ingest.test.ts"];
  const movingOnly=process.argv.includes("--moving-only"),localRoot=movingOnly?".worker-smoke/linux-motion-source-final":".worker-smoke/linux-motion";
  const sandbox=await Sandbox.create({name:`video-studio-motion-smoke-${Date.now()}`,source:{type:"snapshot",snapshotId:snapshot},persistent:false,resources:{vcpus:4},timeout:25*60_000});
  try{
    await sandbox.writeFiles([...bundle.map(file=>({path:`/vercel/sandbox/${file.path}`,content:Buffer.from(file.content)})),...await Promise.all(extras.map(async path=>({path:`/vercel/sandbox/${path}`,content:await readFile(path)})))]);
    const reports:unknown[]=[];
    for(const [name,format]of movingOnly?[["moving","16:9"]]:[["landscape","16:9"],["vertical","9:16"],["square","1:1"],["moving","16:9"]]){
      const output=`/vercel/sandbox/smoke-${name}`,local=join(localRoot,name);
      const result=await sandbox.runCommand({cmd:"node",args:["--import","tsx","worker/smoke-motion.ts","--out",output,"--format",format,...(name==="moving"?["--source-video"]:[])],cwd:"/vercel/sandbox",timeoutMs:7*60_000});
      console.log(await result.stdout());
      if(result.exitCode!==0){
        const diagnostic=["analysis/layout.json","project/motion-0/render-report.json","project/motion-0/render.log","project/motion-0/picture-raw.mp4",...Array.from({length:6},(_,index)=>`project/motion-0/hold-${index}.png`),...Array.from({length:6},(_,index)=>`project/motion-0/decoded-hold-${index}.png`)];
        for(const path of diagnostic){const buffer=await sandbox.readFileToBuffer({path:`${output}/${path}`}).catch(()=>null);if(buffer){await mkdir(join(local,path,".."),{recursive:true});await writeFile(join(local,path),buffer);}}
        throw new Error((await result.stderr()).slice(-4000));
      }
      for(const path of ["smoke-result.json","plan.json","analysis/contact-sheet.jpg","analysis/layout.json","renders/draft-0.mp4","project/motion-0/seek-check.json","project/motion-0/render-report.json"]){
        const buffer=await sandbox.readFileToBuffer({path:`${output}/${path}`});
        if(!buffer)throw new Error(`Expected smoke artifact missing: ${path}`);
        await mkdir(join(local,path,".."),{recursive:true});await writeFile(join(local,path),buffer);
        if(path==="smoke-result.json")reports.push(JSON.parse(buffer.toString("utf8")));
      }
      console.log(`Linux ${format} HTML motion render verified and retrieved.`);
    }
    const documents=await sandbox.runCommand({cmd:"env",args:["STUDIO_PDF_INTEGRATION=1","node","--import","tsx","--test","worker/pdf-ingest.test.ts"],cwd:"/vercel/sandbox",timeoutMs:60_000});
    const documentOutput=await documents.stdout();console.log(documentOutput);if(documents.exitCode!==0)throw new Error((await documents.stderr()).slice(-4000));
    await writeFile(join(localRoot,"pdf-ingest.txt"),documentOutput);
    await writeFile(join(localRoot,"report.json"),JSON.stringify({snapshot,bundleSha256:createHash("sha256").update(JSON.stringify(bundle)).digest("hex"),reports},null,2));
    console.log(`Linux HTML motion smoke artifacts saved in ${localRoot}`);
  }finally{await sandbox.stop();}
}
void main().catch(error=>{console.error(error instanceof Error?error.message:"Sandbox smoke failed");process.exitCode=1;});
