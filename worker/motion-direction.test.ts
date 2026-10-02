import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { directedShot,expectedDirectionFrame,directionEvaluatorSource,directedTimeline } from "./motion-direction";
import { motionHtml } from "./motion-composition";
import { motionTimingForPresentation } from "./motion-timing";
import type { Plan,Scene } from "./types";

function fixture():Plan{
 const scene:Scene={id:"one",start_frame:0,duration_frames:150,asset_id:"real",source_in_seconds:0,playback_rate:1,preserve_audio:false,fit:"contain",purpose:"Fixture",reference_technique:"",headline:"A source-bound workflow",detail:"",evidence:"Exact fixture",effects:[],presentation:{template:"proof",theme:"light",transition:"cut",visual:{kind:"showcase"}},direction:{version:1,job:"context",motion:"focus",continuityKey:"asset:real"}};
 return {version:1,job_id:"directed-fixture",mode:"create",renderer:"hyperframes",output:{width:1920,height:1080,fps:30,duration_frames:300},product:"Example",summary:"",accent:"#7452cc",background:"light",creativeDirection:{version:1,concept:"focus"} as Plan["creativeDirection"],assets:[{id:"real",path:"assets/real.png",kind:"image",usage:"output",rights:"Synthetic fixture",width:1600,height:1000}],scenes:[scene,{...structuredClone(scene),id:"two",start_frame:150,direction:{version:1,job:"result",motion:"hold",continuityKey:"asset:real"}}],captions:[],audio:[],music_prompt:"",sfx_prompt:"",assumptions:[]};
}

test("materials activate only on directed plans and never alter speech shots or legacy scene markup",()=>{
 const plan=fixture(),scene=plan.scenes[0];assert.ok(directedShot(plan,scene,0));
 const html=motionHtml(plan,{real:"assets/real.png"});assert.equal((html.match(/data-designed-stage/g)||[]).length,2);assert.equal((html.match(/data-proof data-asset-id="real"/g)||[]).length,2);assert.match(html,/A<\/span> <span class="word">source-bound/);
 delete plan.creativeDirection;assert.equal(directedShot(plan,scene,0),undefined);assert.equal((motionHtml(plan,{real:"assets/real.png"}).match(/data-designed-stage/g)||[]).length,0);
 plan.creativeDirection=fixture().creativeDirection;scene.preserve_audio=true;assert.equal(directedShot(plan,scene,0),undefined);
 scene.preserve_audio=false;(plan.creativeDirection as any).concept='red; background:url(https://untrusted.test)';assert.throws(()=>motionHtml(plan,{real:"assets/real.png"}),/Unsupported/);
});

test("material continuity requires adjacent actual identity and stops completely before the reading outcome",()=>{
 const plan=fixture(),first=directedShot(plan,plan.scenes[0],0)!,second=directedShot(plan,plan.scenes[1],1)!;
 assert.equal(second.continues,true);
 const end=expectedDirectionFrame(first,149),start=expectedDirectionFrame(second,0);
 assert.deepEqual({x:start.x,y:start.y,scale:start.scale,rotation:start.rotation,lightX:start.lightX,lightY:start.lightY},{x:end.x,y:end.y,scale:end.scale,rotation:end.rotation,lightX:end.lightX,lightY:end.lightY});
 assert.notDeepEqual(expectedDirectionFrame(first,12),expectedDirectionFrame(first,40));
 assert.deepEqual(expectedDirectionFrame(first,first.travelFrames),expectedDirectionFrame(first,149));
 plan.scenes[1].direction!.continuityKey="asset:other";assert.equal(directedShot(plan,plan.scenes[1],1)!.continues,false);
});

test("browser material evaluator is identical for arbitrary reverse seeks without mutating the plan",()=>{
 const plan=fixture(),before=JSON.stringify(plan),shot=directedShot(plan,plan.scenes[0],0)!,embedded=runInNewContext(`(${directionEvaluatorSource()})`);
 for(const frame of [0,60,12,149,60,0])assert.equal(JSON.stringify(embedded(shot,frame)),JSON.stringify(expectedDirectionFrame(shot,frame)));
 assert.equal(JSON.stringify(plan),before);assert.throws(()=>expectedDirectionFrame(shot,-1),/Invalid/);
});

test("separate designed entrances do not consume the existing essential-reading window",()=>{
 for(const template of ["brand","proof","features"]){
  const tracks:{selector:string;duration:number;stagger:number;at:number}[]=[];
  const tl={set(){},fromTo(selector:string,_from:unknown,to:any,at:number){const stagger=typeof to.stagger==="number"?to.stagger*2:to.stagger?.amount||0;tracks.push({selector,duration:to.duration,stagger,at});}};
  directedTimeline(tl,"#scene",{directed:{motion:"reveal"},visual:template==="proof"?"showcase":undefined},0);
  const selectors=template==="brand"?["letter","brand-line","brand-pill","brand-logo"]:template==="proof"?["word","detail","proof-media"]:["word","detail","info-card"];
  const relevant=tracks.filter(track=>selectors.some(selector=>track.selector.endsWith(' .'+selector)));
  const entry=motionTimingForPresentation({template,transition:"cut",cards:template==="features"?[1,2,3]:undefined,visual:template==="proof"?{kind:"showcase"}:undefined},true).entryFrames;
  assert.ok(relevant.every(track=>Math.ceil((track.at+track.duration+track.stagger)*30-.00001)<=entry),`${template} entry ${entry}`);
 }
});
