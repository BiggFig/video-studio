import type { Plan, Presentation, Scene } from "./types";

/** One renderer contract shared by composition, source checks, QC and reservations. */
export function resolvePresentation(scene:Scene,plan:Pick<Plan,"background">):Presentation {
 const value=scene.presentation||{template:"proof",theme:plan.background,transition:"cut"};
 if(!["hook","brand","proof","features","offer","cta"].includes(value.template)||!["light","dark"].includes(value.theme)||!["cut","iris","lift","expand"].includes(value.transition)||(value.cards?.length||0)>3)throw new Error("Unsupported motion presentation");
 if(scene.preserve_audio)return {...value,template:"proof",transition:"cut",cards:undefined,visual:undefined};
 const visual=value.visual;
 if(visual){
  if(visual.kind==="connections"){
   if(value.template!=="features"||value.cards?.length||visual.nodes.length<2||visual.nodes.length>3||visual.nodes.some(node=>!node.label.trim()||!node.evidenceId))throw new Error("Unsupported explanatory connection graphic");
  }else if(value.template!=="proof"||!["showcase","focus","panels","ui-demo"].includes(visual.kind))throw new Error("A product treatment requires a proof scene");
  if(visual.kind==="focus"){
   const r=visual.region;
   if(!visual.regionId||!r||Object.values(r).some(v=>!Number.isFinite(v))||r.x<0||r.y<0||r.width<=0||r.height<=0||r.x+r.width>1.000001||r.y+r.height>1.000001)throw new Error("Focus region must be compiled from bounded source evidence");
  }
  if(visual.kind==="panels"&&(!visual.secondaryAssetId||!visual.secondaryEvidenceId))throw new Error("A second proof panel needs source and fact bindings");
 }
 return value;
}

export function motionUsage(scene:Scene,plan:Pick<Plan,"background"|"brand"|"uiDocuments">){
 const presentation=resolvePresentation(scene,plan),visual=presentation.visual;
 const uiDocumentId=visual?.kind==="ui-demo"?visual.documentId:null,document=uiDocumentId?plan.uiDocuments?.find(document=>document.id===uiDocumentId):undefined;
 if(uiDocumentId&&!document)throw new Error("A UI demonstration needs a compiled source-bound document");
 const reconstructionSourceAssetIds=document?.sourceAssetIds||[];
 const proofAssetIds=presentation.template==="proof"&&!uiDocumentId?[scene.asset_id,...(visual?.kind==="panels"?[visual.secondaryAssetId]:[])]:[];
 const logoAssetId=["brand","cta"].includes(presentation.template)?plan.brand?.logoAssetId||null:null;
 const visibleAssetIds=[...new Set([...proofAssetIds,...(logoAssetId?[logoAssetId]:[])])];
 return {presentation,proofAssetIds,logoAssetId,visibleAssetIds,reconstructionSourceAssetIds,uiDocumentId,copiedAssetIds:[...new Set([scene.asset_id,...visibleAssetIds,...reconstructionSourceAssetIds])],extraCopy:visual?.kind==="connections"?visual.nodes.map(node=>node.label):[]};
}

export const motionAssetIds=(plan:Pick<Plan,"scenes"|"background"|"brand"|"uiDocuments">)=>[...new Set(plan.scenes.flatMap(scene=>motionUsage(scene,plan).copiedAssetIds))];
