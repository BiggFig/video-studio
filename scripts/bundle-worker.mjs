import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const files=[];
async function visit(dir) {
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const filename=path.posix.join(dir,entry.name);
    if(entry.isDirectory()&&!entry.name.startsWith('.')&&entry.name!=='__pycache__') await visit(filename);
    else if(entry.isFile()&&!entry.name.endsWith('.test.ts')&&!entry.name.startsWith('smoke-')&&/\.(ts|py|md|json|html|css|js|txt)$/.test(entry.name)) files.push({path:filename,content:await readFile(filename,'utf8')});
  }
}
await visit('worker'); await visit('skills/video-studio');
files.push({path:'lib/contracts.ts',content:await readFile('lib/contracts.ts','utf8')});
await mkdir('lib/generated',{recursive:true});
await writeFile('lib/generated/worker-bundle.json',JSON.stringify(files));
console.log(`Bundled ${files.length} worker and skill files.`);
