import { Sandbox } from "@vercel/sandbox";
import { mkdir, readFile, writeFile } from "node:fs/promises";

async function main() {
  const baseIndex = process.argv.indexOf("--base-snapshot"), baseSnapshot = baseIndex < 0 ? undefined : process.argv[baseIndex + 1];
  if(baseIndex >= 0 && (!baseSnapshot || !/^snap_[A-Za-z0-9]+$/.test(baseSnapshot))) throw new Error("A valid --base-snapshot ID is required.");
  const sandbox = await Sandbox.create({name: `video-studio-runtime-${Date.now()}`, ...(baseSnapshot ? {source:{type:"snapshot" as const,snapshotId:baseSnapshot}} : {image:"vercel/sandbox/universal"}), persistent: false, timeout: 15 * 60_000, resources: {vcpus: 2}});
  try {
    const packages = ["playwright", "tsx", "zod", "@vercel/blob", "hyperframes", "gsap"];
    const dependencies: Record<string,string> = {};
    for (const name of packages) dependencies[name] = JSON.parse(await readFile(`node_modules/${name}/package.json`, "utf8")).version;
    await sandbox.writeFiles([{path:"/vercel/sandbox/package.json", content:Buffer.from(JSON.stringify({private:true,type:"module",dependencies}))}]);
    for (const command of [
      {cmd:"apt-get",args:["update"],sudo:true},
      {cmd:"apt-get",args:["install","-y","ffmpeg","poppler-utils","python3","fonts-inter"],sudo:true},
      {cmd:"npm",args:["install","--omit=dev","--no-audit","--no-fund"],cwd:"/vercel/sandbox"},
      {cmd:"npx",args:["playwright","install","--with-deps","chromium"],cwd:"/vercel/sandbox"},
      {cmd:"node",args:["node_modules/hyperframes/bin/hyperframes.mjs","browser","ensure"],cwd:"/vercel/sandbox"},
    ]) {
      const result = await sandbox.runCommand(command);
      console.log(`${command.cmd} ${command.args[0]}: ${result.exitCode}`);
      if (result.exitCode !== 0) throw new Error((await result.stderr()).slice(-2000));
    }
    const snapshot = await sandbox.snapshot();
    await mkdir(".local", {recursive:true});
    await writeFile(".local/worker-snapshot.json", JSON.stringify({id:snapshot.snapshotId,dependencies,baseSnapshot:baseSnapshot??null,createdAt:new Date().toISOString()},null,2));
    console.log(`Worker snapshot ready: ${snapshot.snapshotId}`);
  } finally { await sandbox.stop().catch(()=>{}); }
}
main().catch(error=>{console.error(error instanceof Error ? error.message : "Snapshot setup failed");process.exitCode=1;});
