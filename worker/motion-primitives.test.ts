import test from "node:test";
import assert from "node:assert/strict";
import { motionUsage,motionAssetIds,resolvePresentation } from "./motion-assets";
import { motionHtml,motionSampleFrames } from "./motion-composition";
import { motionTimingForPresentation } from "./motion-timing";
import { focusCamera,motionPalette,logoDimensions,logoGeometryMatches } from "./motion-primitives";
import type { Plan,Scene } from "./types";

function fixture():Plan{
 const base={kind:"image" as const,usage:"output" as const,rights:"Synthetic test source",width:1600,height:1000};
 const scene:Scene={id:"one",start_frame:0,duration_frames:150,asset_id:"main",source_in_seconds:0,playback_rate:1,preserve_audio:false,fit:"contain",purpose:"Fixture",reference_technique:"",headline:"Actual source",detail:"",evidence:"Exact fixture fact",effects:[],presentation:{template:"proof",theme:"dark",transition:"cut",visual:{kind:"panels",secondaryAssetId:"second",secondaryEvidenceId:"fact-2",secondaryEvidence:"This quote is grounding only"}}};
 return{version:1,job_id:"fixture",mode:"create",renderer:"hyperframes",output:{width:1920,height:1080,fps:30,duration_frames:150},product:"Fixture",summary:"",accent:"#7855dd",background:"dark",brand:{logoAssetId:"logo",background:"#111018",foreground:"#f5f4fb",accent:"#7855dd",sourceUrl:"https://example.com"},assets:[{...base,id:"main",path:"assets/main.png"},{...base,id:"second",path:"assets/second.png"},{...base,id:"logo",path:"assets/logo.png",width:200,height:200}],scenes:[scene],captions:[],audio:[],music_prompt:"",sfx_prompt:"",assumptions:[]};
}
const sources={main:"assets/main.png",second:"assets/second.png",logo:"assets/logo.png"};

test("observed wordmarks retain their aspect and never upscale beyond twice their real pixels",()=>{
 assert.deepEqual(logoDimensions({width:126,height:22},1920),{width:252,height:44});
 assert.equal(logoGeometryMatches({width:126,height:22},1920,{width:252,height:44}),true);
 assert.equal(logoGeometryMatches({width:126,height:22},1920,{width:252,height:48}),false);
 assert.equal(logoGeometryMatches({width:126,height:22},1920,{width:420,height:73.333}),false);
 assert.equal(logoGeometryMatches({width:12,height:4},1920,{width:24,height:8}),false);
 assert.deepEqual(logoDimensions({width:200,height:200},1080),{width:150,height:150});
 const large=logoDimensions({width:1600,height:200},1080);assert.equal(large.width,420);assert.equal(large.width/large.height,8);
 assert.throws(()=>logoDimensions({width:0,height:22},1080));
});

test("shared usage includes secondary proof and real brand marks without treating typography provenance as proof",()=>{
 const plan=fixture(),scene=plan.scenes[0];assert.deepEqual(motionUsage(scene,plan).proofAssetIds,["main","second"]);assert.deepEqual(motionAssetIds(plan),["main","second"]);
 scene.presentation={template:"brand",theme:"dark",transition:"cut"};const usage=motionUsage(scene,plan);assert.deepEqual(usage.proofAssetIds,[]);assert.deepEqual(usage.visibleAssetIds,["logo"]);assert.deepEqual(usage.copiedAssetIds,["main","logo"]);assert.equal(usage.logoAssetId,"logo");
});
test("speech remains full source proof with no panels, camera crop or covering exit",()=>{
 const plan=fixture(),scene=plan.scenes[0];scene.preserve_audio=true;scene.presentation!.transition="iris";const p=resolvePresentation(scene,plan);assert.equal(p.template,"proof");assert.equal(p.transition,"cut");assert.equal(p.visual,undefined);assert.deepEqual(motionUsage(scene,plan).visibleAssetIds,["main"]);
});
test("focus math preserves source aspect, contains the exact fact region and caps the camera at threefold",()=>{
 const asset={kind:"image" as const,width:1600,height:1000},viewport={width:1200,height:700},region={x:.7,y:.4,width:.15,height:.2},camera=focusCamera(asset,viewport,region);
 assert.equal(camera.from.width/camera.from.height,1.6);assert.equal(camera.to.width/camera.to.height,1.6);assert.ok(camera.to.width<=camera.from.width*3);
 assert.ok(camera.to.left+region.x*camera.to.width>=-.001);assert.ok(camera.to.left+(region.x+region.width)*camera.to.width<=viewport.width+.001);
 assert.ok(camera.to.top+region.y*camera.to.height>=-.001);assert.ok(camera.to.top+(region.y+region.height)*camera.to.height<=viewport.height+.001);
 assert.throws(()=>focusCamera({...asset,kind:"video"},viewport,region),/still/);assert.throws(()=>focusCamera(asset,viewport,{...region,x:.99}),/outside/);
});
test("focus needs compiled region; secondary panels and logos remain confined output assets",()=>{
 const plan=fixture(),scene=plan.scenes[0];scene.presentation!.visual={kind:"focus",regionId:"region-1"};assert.throws(()=>motionHtml(plan,sources),/compiled/);
 scene.presentation!.visual={kind:"focus",regionId:"region-1",region:{x:.1,y:.1,width:.7,height:.7}};assert.match(motionHtml(plan,sources),/focus-image/);plan.assets[0].kind="video";assert.throws(()=>motionHtml(plan,sources),/still/);plan.assets[0].kind="image";
 scene.presentation!.visual={kind:"panels",secondaryAssetId:"second",secondaryEvidenceId:"fact-2"};plan.assets[1].usage="reference";assert.throws(()=>motionHtml(plan,sources),/confined/);plan.assets[1].usage="output";
 scene.presentation={template:"brand",theme:"dark",transition:"cut"};assert.throws(()=>motionHtml(plan,{...sources,logo:"https://example.com/logo.png"}),/confined/);
});
test("connection labels alone are rendered, escaped and fact-bound; quotes are not screen copy",()=>{
 const plan=fixture(),scene=plan.scenes[0];scene.presentation={template:"features",theme:"dark",transition:"cut",visual:{kind:"connections",nodes:[{label:"Notes <script>",evidenceId:"fact-1",evidence:"Grounding text only"},{label:"Links",evidenceId:"fact-2"},{label:"Connections",evidenceId:"fact-3"}]}};
 assert.deepEqual(motionUsage(scene,plan).extraCopy,["Notes <script>","Links","Connections"]);assert.deepEqual(motionUsage(scene,plan).visibleAssetIds,[]);
 const html=motionHtml(plan,sources);assert.match(html,/Explanatory graphic, not application UI/);assert.match(html,/Notes &lt;script&gt;/);assert.doesNotMatch(html,/Grounding text only/);assert.equal((html.match(/class="connection-edge"/g)||[]).length,2);assert.equal((html.match(/class="connection-node"/g)||[]).length,3);
 scene.presentation.cards=[{title:"Ambiguous second mechanism",body:"",evidenceId:"fact-4"}];assert.throws(()=>motionHtml(plan,sources),/connection graphic/);
});
test("primitive settlement precedes reading samples while observed color input cannot become CSS",()=>{
 const plan=fixture(),scene=plan.scenes[0];for(const [kind,frames]of Object.entries({showcase:30,focus:36,panels:34,connections:42})){assert.equal(motionTimingForPresentation({template:"proof",transition:"cut",visual:{kind}},false).entryFrames,frames);}
 scene.presentation!.visual={kind:"showcase"};assert.ok(motionSampleFrames(scene,plan,0)[2]>=30);
 assert.equal(motionPalette(plan,"dark").accent,"#7855dd");assert.equal(motionPalette(plan,"light").background,"#f5f4fb");
 plan.brand!.accent="red; background:url(https://example.com)";assert.throws(()=>motionHtml(plan,sources),/hex/);
});
