import type { UiDocument } from "./ui-reconstruction";
import { expectedUiState } from "./ui-state";

const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const color=(value:string)=>{if(!/^(?:#[a-f\d]{6}|transparent)$/i.test(value))throw new Error("UI style colors must be trusted hex values");return value;};
const number=(value:number,min:number,max:number)=>{if(!Number.isFinite(value)||value<min||value>max)throw new Error("UI geometry exceeds the supported range");return value;};

export function uiDocumentHtml(document:UiDocument,index:number,viewport:{width:number;height:number}){
 const scale=Math.min(viewport.width/document.viewport.width,viewport.height/document.viewport.height),width=document.viewport.width*scale,height=document.viewport.height*scale;
 const content=document.elements.map(element=>{
  const style=document.styles.find(style=>style.id===element.styleId);if(!style)throw new Error("UI element style missing");
  const r=element.rect,css=`left:${number(r.x,0,1)*100}%;top:${number(r.y,0,1)*100}%;width:${number(r.width,.001,1)*100}%;height:${number(r.height,.001,1)*100}%;background:${color(style.fill)};color:${color(style.color)};border-color:${color(style.borderColor)};border-radius:${number(style.radius,0,100)*scale}px;font-size:${number(style.fontSize,4,120)*scale}px;font-weight:${number(style.fontWeight,100,900)}`;
  if(element.type==="edge"){
   const from=document.elements.find(value=>value.id===element.fromId),to=document.elements.find(value=>value.id===element.toId);if(!from||!to)throw new Error("UI graph edge references missing nodes");
   return`<svg class="ui-edge" data-ui-element="${escape(element.id)}" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"><line x1="${(from.rect.x+from.rect.width/2)*1000}" y1="${(from.rect.y+from.rect.height/2)*1000}" x2="${(to.rect.x+to.rect.width/2)*1000}" y2="${(to.rect.y+to.rect.height/2)*1000}" stroke="${color(style.color)}" stroke-width="2"/></svg>`;
  }
  return`<div class="ui-element ui-${escape(element.type)}" data-ui-element="${escape(element.id)}" data-ui-type="${escape(element.type)}" data-text-basis="${escape(element.textBasis)}" style="${css}"><span data-ui-text>${escape(element.text)}</span><i class="ui-caret" aria-hidden="true"></i></div>`;
 }).join("");
 return`<div class="ui-demo-stage" data-ui-reconstruction="${escape(document.id)}" role="img" aria-label="Source-grounded reconstructed product workflow"><div class="ui-document" id="ui-document-${index}" style="width:${width}px;height:${height}px">${content}<div class="ui-pointer" aria-hidden="true"><svg viewBox="0 0 28 36"><path d="M 3 2 L 3 28 L 10 22 L 16 34 L 22 31 L 16 20 L 26 19 Z" fill="white" stroke="#191919" stroke-width="2"/></svg><i></i></div></div></div>`;
}

export const uiCompositionCss=`.ui-demo-stage{position:absolute;display:flex;align-items:center;justify-content:center;opacity:0;perspective:1800px}.ui-document{position:relative;flex:none;overflow:hidden;border:1px solid var(--line);border-radius:18px;box-shadow:0 30px 90px #00000045;background:var(--stage-bg);font-family:Studio,Arial,sans-serif;isolation:isolate}.ui-element{position:absolute;overflow:hidden;display:flex;align-items:center;border:1px solid transparent;line-height:1.3;white-space:pre-wrap;overflow-wrap:break-word;letter-spacing:-.015em;padding:0 .55em}.ui-panel{padding:0}.ui-text,.ui-textarea{display:block;padding:0}.ui-input{align-items:center;padding:0}.ui-node,.ui-icon{justify-content:center;padding:0}.ui-node{border-radius:999px!important}.ui-element[data-selected=true]{box-shadow:inset 0 0 0 2px var(--accent);background:color-mix(in srgb,var(--accent) 22%,transparent)!important}.ui-text[data-selected=true] [data-ui-text],.ui-textarea[data-selected=true] [data-ui-text]{background:color-mix(in srgb,var(--accent) 36%,transparent)}.ui-edge{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.ui-caret{display:none;position:relative;flex:none;width:2px;height:1.12em;background:currentColor;margin-left:2px;vertical-align:text-bottom}.ui-element[data-typing=true] .ui-caret{display:inline-block}.ui-pointer{position:absolute;width:28px;height:36px;z-index:99;filter:drop-shadow(0 3px 4px #00000070);pointer-events:none}.ui-pointer svg{width:100%;height:100%}.ui-pointer i{position:absolute;left:-17px;top:-17px;width:40px;height:40px;border:3px solid var(--accent);border-radius:50%;opacity:0}.ui-demo-label{position:absolute;right:36px;bottom:18px;font-size:18px;line-height:1;color:var(--muted);letter-spacing:.02em}`;

/** Trusted evaluator source has no model-authored code or closure dependencies. */
export const uiEvaluatorSource=()=>expectedUiState.toString();
