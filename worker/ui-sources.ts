import type { Page } from "playwright";
import type { Asset } from "./types";

export interface UiSource {
  id: string; assetId: string; basis: "dom" | "pixels";
  context: "marketing-example" | "public-demo" | "user-supplied";
  pageUrl?: string; rootSelector?: string; width: number; height: number;
  elements: {
    id: string; role: "panel" | "text" | "button" | "input" | "tab" | "list-item" | "link" | "icon" | "node";
    rect: { x: number; y: number; width: number; height: number };
    text?: string; selector?: string; state?: { selected?: boolean; expanded?: boolean; disabled?: boolean };
    style?: { color?: string; backgroundColor?: string; borderColor?: string; borderRadius?: number; fontFamily?: string; fontSize?: number; fontWeight?: string; lineHeight?: number };
  }[];
  limitations: string[];
}
const round = (n: number, places = 4) => Math.round(n * 10 ** places) / 10 ** places;
const clean = (value: unknown, length: number) => typeof value === "string" ? value.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim().slice(0, length) : "";
export function uiHexColor(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  if (/^#[\da-f]{6}$/i.test(value)) return value.toLowerCase();
  const rgb = value.match(/^rgba?\(\s*(\d+(?:\.\d+)?)[, ]+\s*(\d+(?:\.\d+)?)[, ]+\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
  if (!rgb || (rgb[4] !== undefined && Number(rgb[4]) !== 1)) return;
  const channels = rgb.slice(1, 4).map(Number);
  if (channels.some(n => !Number.isFinite(n) || n < 0 || n > 255)) return;
  return "#" + channels.map(n => Math.round(n).toString(16).padStart(2, "0")).join("");
}
/** One shared allowance across homepage and followup panels; no new capture/network budget. */
export class UiSourceBudget {
  sources: UiSource[] = [];
  add(source: UiSource) {
    if (this.sources.length >= 3 || this.sources.some(item => item.assetId === source.assetId)) return false;
    const bounded = { ...source, elements: source.elements.slice(0, 48) };
    // Each source leaves room for the other two; a large overview must not starve a focused control example.
    while ((Buffer.byteLength(JSON.stringify(bounded), "utf8") > 9800 || Buffer.byteLength(JSON.stringify([...this.sources, bounded]), "utf8") > 30_000) && bounded.elements.length) bounded.elements.pop();
    if (bounded.elements.length < source.elements.length) bounded.limitations = [...source.limitations, "Visible element inventory was shortened to the shared metadata limit."];
    while ((Buffer.byteLength(JSON.stringify(bounded), "utf8") > 9800 || Buffer.byteLength(JSON.stringify([...this.sources, bounded]), "utf8") > 30_000) && bounded.elements.length) bounded.elements.pop();
    if (Buffer.byteLength(JSON.stringify([...this.sources, bounded]), "utf8") > 30_000) return false;
    if (!bounded.elements.length) bounded.basis = "pixels";
    this.sources.push(bounded); return true;
  }
}

interface DomObservation {
  width: number; height: number;
  elements: { role: UiSource["elements"][number]["role"]; rect: UiSource["elements"][number]["rect"]; text?: string; selector: string; state: UiSource["elements"][number]["state"]; style: Record<string, string> }[];
}
/** Validate observed data again outside the browser; site text is never executable content. */
export function uiSourceFromObservation(asset: Asset, selector: string, observed?: DomObservation): UiSource {
  const elements: UiSource["elements"] = [];
  for (const raw of observed?.elements.slice(0, 96) || []) {
    if (!Object.values(raw.rect).every(Number.isFinite) || raw.rect.x < 0 || raw.rect.y < 0 || raw.rect.width <= 0 || raw.rect.height <= 0 || raw.rect.x + raw.rect.width > 1.0001 || raw.rect.y + raw.rect.height > 1.0001) continue;
    const x = round(raw.rect.x), y = round(raw.rect.y), rect = { x, y, width: round(Math.min(1 - x, raw.rect.width)), height: round(Math.min(1 - y, raw.rect.height)) };
    if (rect.width <= 0 || rect.height <= 0) continue;
    const style: NonNullable<UiSource["elements"][number]["style"]> = {};
    for (const key of ["color", "backgroundColor", "borderColor"] as const) { const color = uiHexColor(raw.style[key]); if (color && (key !== "borderColor" || parseFloat(raw.style.borderWidth) > 0)) style[key] = color; }
    for (const key of ["borderRadius", "fontSize", "lineHeight"] as const) { const value = raw.style[key]; if (/^\d+(?:\.\d+)?px$/.test(value)) { const number = parseFloat(value); if (number <= 256) style[key] = round(number, 2); } }
    const families = (raw.style.fontFamily || "").split(",").slice(0, 5).map(family => clean(family, 80).replace(/["']/g, ""));
    while (families.join(", ").length > 120) families.pop();
    const family = families.join(", ");
    if (/^[\w ,.-]+$/.test(family)) style.fontFamily = family;
    if (/^[1-9]00$|^[1-9]\d{0,2}$|^1000$/.test(raw.style.fontWeight)) style.fontWeight = raw.style.fontWeight;
    const text = clean(raw.text, 160), state: NonNullable<UiSource["elements"][number]["state"]> = {};
    for (const key of ["selected", "expanded", "disabled"] as const) if (typeof raw.state?.[key] === "boolean") state[key] = raw.state[key];
    elements.push({ id: `element-${elements.length}`, role: raw.role, rect, ...(text ? { text } : {}), selector: clean(raw.selector, 320), ...(Object.keys(state).length ? { state } : {}), style });
    if (elements.length >= 48) break;
  }
  return { id: `ui-${asset.id}`, assetId: asset.id, basis: elements.length > 1 ? "dom" : "pixels", context: asset.provenance?.pageKind === "demo" ? "public-demo" : asset.provenance ? "marketing-example" : "user-supplied",
    ...(asset.provenance ? { pageUrl: asset.provenance.pageUrl } : {}), ...(selector ? { rootSelector: selector.slice(0, 1200) } : {}), width: asset.width, height: asset.height,
    elements: elements.length > 1 ? elements : [], limitations: ["One public captured state only; no product interaction was performed or verified.", "Styles describe displayed public elements, not an official design system; fonts may require a local fallback.", ...(elements.length > 1 ? ["Only visible text and bounded element geometry were retained. Form values, editable text, handlers and raw HTML were excluded.", "Nested DOM records can overlap. They are source references, not instructions to render every record."] : ["This asset has no inspectable UI element inventory. Its pixels require visual research; no controls or text were guessed."])] };
}

/** Called on the already guarded page at its original captured panel; no navigation/clicks/requests. */
export async function captureUiSource(page: Page, asset: Asset, selector: string): Promise<UiSource> {
  const observed = await page.evaluate<DomObservation>(`(() => {
    const root=document.querySelector(${JSON.stringify(selector)});if(!root)return {width:0,height:0,elements:[]};
    const outer=root.getBoundingClientRect(),elements=[];if(!outer.width||!outer.height)return {width:0,height:0,elements};
    for(let ancestor=root;ancestor;ancestor=ancestor.parentElement){const s=getComputedStyle(ancestor);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return {width:outer.width,height:outer.height,elements};}
    const nodes=[root,...Array.from(root.querySelectorAll('*')).slice(0,400)];
    const path=node=>{const parts=[];let current=node;while(current&&current!==root&&parts.length<10){const tag=current.tagName.toLowerCase(),siblings=Array.from(current.parentElement?.children||[]).filter(n=>n.tagName===current.tagName);parts.unshift(siblings.length>1?tag+':nth-of-type('+(siblings.indexOf(current)+1)+')':tag);current=current.parentElement;}return current===root?(parts.length?':scope > '+parts.join(' > '):':scope'):'';};
    for(const node of nodes){
      if(node.closest('script,style,noscript,template,textarea,[contenteditable]:not([contenteditable="false"])')||node.matches('input[type=password],input[type=hidden]'))continue;
      const box=node.getBoundingClientRect(),s=getComputedStyle(node);if(!box.width||!box.height||s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)continue;
      let visible=true,ancestor=node.parentElement;for(let depth=0;ancestor&&depth<15;depth++,ancestor=ancestor.parentElement){const a=getComputedStyle(ancestor);if(a.display==='none'||a.visibility==='hidden'||Number(a.opacity)===0){visible=false;break;}if(ancestor===root)break;}if(!visible)continue;
      // Keep only whole visible elements; partially clipped text is not a faithful inventory.
      let left=outer.left,top=outer.top,right=outer.right,bottom=outer.bottom;ancestor=node.parentElement;
      for(let depth=0;ancestor&&ancestor!==root&&depth<15;depth++,ancestor=ancestor.parentElement){const a=getComputedStyle(ancestor),b=ancestor.getBoundingClientRect();if(/hidden|auto|scroll|clip/.test(a.overflowX)){left=Math.max(left,b.left);right=Math.min(right,b.right);}if(/hidden|auto|scroll|clip/.test(a.overflowY)){top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom);}}
      if(box.left<left-.5||box.top<top-.5||box.right>right+.5||box.bottom>bottom+.5)continue;
      const tag=node.tagName.toLowerCase(),aria=node.getAttribute('role');
      const own=Array.from(node.childNodes).map(n=>n.nodeType===Node.TEXT_NODE?n.textContent:n.nodeType===Node.ELEMENT_NODE&&/^(SPAN|STRONG|B|EM|I|CODE)$/.test(n.tagName)&&!n.querySelector('input,textarea,[contenteditable]')&&getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden'&&Number(getComputedStyle(n).opacity)!==0?n.textContent:'').join('').replace(/\\s+/g,' ').trim().slice(0,160);
      let role=node===root?'panel':tag==='input'?'input':tag==='button'||aria==='button'?'button':aria==='tab'?'tab':tag==='a'?'link':tag==='li'||aria==='option'?'list-item':tag==='svg'||tag==='img'?'icon':own?'text':null;
      if(!role){if(node.children.length&&s.backgroundColor!=='rgba(0, 0, 0, 0)'&&box.width>=80&&box.height>=40)role='panel';else continue;}
      const state={};for(const key of ['selected','expanded','disabled']){const value=node.getAttribute('aria-'+key);if(value==='true'||value==='false')state[key]=value==='true';}
      elements.push({role,rect:{x:Math.max(0,(box.left-outer.left)/outer.width),y:Math.max(0,(box.top-outer.top)/outer.height),width:Math.min(box.width,outer.right-box.left)/outer.width,height:Math.min(box.height,outer.bottom-box.top)/outer.height},...(own&&tag!=='input'?{text:own}:{}),selector:path(node),state,style:{color:s.color,backgroundColor:s.backgroundColor,borderColor:s.borderColor,borderWidth:s.borderWidth,borderRadius:s.borderRadius,fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight}});
      if(elements.length>=96)break;
    }
    return {width:outer.width,height:outer.height,elements};
  })()`);
  return uiSourceFromObservation(asset, selector, observed);
}
