import type { Page } from "playwright";
import type { Asset } from "./types";

export interface UiSource {
  id: string; assetId: string; basis: "dom" | "pixels";
  context: "marketing-example" | "public-demo" | "user-supplied";
  pageUrl?: string; rootSelector?: string; width: number; height: number;
  elements: {
    id: string; role: "panel" | "text" | "button" | "input" | "tab" | "list-item" | "link" | "icon" | "node";
    rect: { x: number; y: number; width: number; height: number };
    text?: string; selector?: string; codeContainer?: string; state?: { selected?: boolean; expanded?: boolean; disabled?: boolean };
    style?: { color?: string; backgroundColor?: string; effectiveBackgroundColor?: string; borderColor?: string; borderRadius?: number; fontFamily?: string; fontSize?: number; fontWeight?: string; lineHeight?: number };
  }[];
  limitations: string[];
}
const round = (n: number, places = 4) => Math.round(n * 10 ** places) / 10 ** places;
const clean = (value: unknown, length: number) => typeof value === "string" ? value.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim().slice(0, length) : "";

type ObservableElement = Pick<UiSource["elements"][number], "role" | "rect" | "text" | "selector" | "codeContainer">;
/** A prefix of this order keeps semantic and spatial coverage when bytes run out. */
export function selectUiSourceElements<T extends ObservableElement>(elements: T[], limit: number): T[] {
  const priority = (element: T) => ["button", "input", "tab", "list-item", "link"].includes(element.role) ? 0 : element.codeContainer ? (/^[A-Za-z_$][\w$]*\s*=\s*["'][^"'\\]+["']\s*[,;]?$/.test(element.text || "") || /^[^<>{}]*\{[A-Za-z_$][\w$]*\}[^<>{}]*$/.test(element.text || "") ? .5 : 2.5) : element.role === "text" ? 1 : element.role === "panel" ? 2 : 3;
  const contains = (outer: T, inner: T) => outer.rect.x <= inner.rect.x + .001 && outer.rect.y <= inner.rect.y + .001 && outer.rect.x + outer.rect.width >= inner.rect.x + inner.rect.width - .001 && outer.rect.y + outer.rect.height >= inner.rect.y + inner.rect.height - .001;
  const ancestor = (outer: T, inner: T) => !!outer.selector && !!inner.selector && inner.selector.startsWith(outer.selector + " > ");
  const distinct = elements.filter((element, index) => !elements.some((other, otherIndex) => {
    if (index === otherIndex || !contains(other, element)) return false;
    // Never collapse identical labels in different places. Only redundant text
    // inside its actual recorded ancestor (or the exact same box) is redundant.
    const exactBox = contains(element, other), sameText = !!element.text && element.text === other.text;
    if (element.role === "text" && sameText && (ancestor(other, element) || (exactBox && !ancestor(element, other) && (priority(other) < priority(element) || otherIndex < index)))) return true;
    return element.role === "panel" && other.role === "panel" && exactBox && !element.text && !other.text && otherIndex < index;
  }));
  const root = distinct.find(element => element.selector === ":scope" && element.role === "panel"), selected: T[] = root ? [root] : [];
  const buckets: T[][] = Array.from({ length: 9 }, () => []);
  for (const element of distinct) {
    if (element === root) continue;
    const x = Math.min(2, Math.max(0, Math.floor((element.rect.x + element.rect.width / 2) * 3))), y = Math.min(2, Math.max(0, Math.floor((element.rect.y + element.rect.height / 2) * 3)));
    buckets[y * 3 + x].push(element);
  }
  for (const bucket of buckets) bucket.sort((a, b) => priority(a) - priority(b));
  while (selected.length < limit && buckets.some(bucket => bucket.length)) for (const bucket of buckets) if (bucket.length && selected.length < limit) selected.push(bucket.shift()!);
  return selected.slice(0, limit);
}
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
    const bounded = { ...source, elements: selectUiSourceElements(source.elements, 48) };
    // Each source leaves room for the other two; a large overview must not starve a focused control example.
    while ((Buffer.byteLength(JSON.stringify(bounded), "utf8") > 9800 || Buffer.byteLength(JSON.stringify([...this.sources, bounded]), "utf8") > 30_000) && bounded.elements.length) bounded.elements.pop();
    if (bounded.elements.length < source.elements.length) bounded.limitations = [...source.limitations, "Visible element inventory was shortened to the shared metadata limit."];
    while ((Buffer.byteLength(JSON.stringify(bounded), "utf8") > 9800 || Buffer.byteLength(JSON.stringify([...this.sources, bounded]), "utf8") > 30_000) && bounded.elements.length) bounded.elements.pop();
    if (Buffer.byteLength(JSON.stringify(bounded), "utf8") > 9800 || Buffer.byteLength(JSON.stringify([...this.sources, bounded]), "utf8") > 30_000) return false;
    if (!bounded.elements.length) bounded.basis = "pixels";
    this.sources.push(bounded); return true;
  }
}

interface DomObservation {
  width: number; height: number;
  elements: { role: UiSource["elements"][number]["role"]; rect: UiSource["elements"][number]["rect"]; text?: string; selector: string; codeContainer?: string; state: UiSource["elements"][number]["state"]; style: Record<string, string> }[];
}
/** Validate observed data again outside the browser; site text is never executable content. */
export function uiSourceFromObservation(asset: Asset, selector: string, observed?: DomObservation): UiSource {
  const elements: UiSource["elements"] = [];
  for (const raw of observed?.elements.slice(0, 96) || []) {
    if (!["panel", "text", "button", "input", "tab", "list-item", "link", "icon", "node"].includes(raw.role)) continue;
    if (!Object.values(raw.rect).every(Number.isFinite) || raw.rect.x < 0 || raw.rect.y < 0 || raw.rect.width <= 0 || raw.rect.height <= 0 || raw.rect.x + raw.rect.width > 1.0001 || raw.rect.y + raw.rect.height > 1.0001) continue;
    const x = round(raw.rect.x), y = round(raw.rect.y), rect = { x, y, width: round(Math.min(1 - x, raw.rect.width)), height: round(Math.min(1 - y, raw.rect.height)) };
    if (rect.width <= 0 || rect.height <= 0) continue;
    const style: NonNullable<UiSource["elements"][number]["style"]> = {};
    for (const key of ["color", "backgroundColor", "effectiveBackgroundColor", "borderColor"] as const) { const color = uiHexColor(raw.style[key]); if (color && (key !== "borderColor" || parseFloat(raw.style.borderWidth) > 0)) style[key] = color; }
    if (raw.style.backgroundColor === "transparent") style.backgroundColor = "transparent";
    for (const key of ["borderRadius", "fontSize", "lineHeight"] as const) { const value = raw.style[key]; if (/^\d+(?:\.\d+)?px$/.test(value)) { const number = parseFloat(value); if (number <= 256) style[key] = round(number, 2); } }
    const families = (raw.style.fontFamily || "").split(",").slice(0, 5).map(family => clean(family, 80).replace(/["']/g, ""));
    while (families.join(", ").length > 120) families.pop();
    const family = families.join(", ");
    if (/^[\w ,.-]+$/.test(family)) style.fontFamily = family;
    if (/^[1-9]00$|^[1-9]\d{0,2}$|^1000$/.test(raw.style.fontWeight)) style.fontWeight = raw.style.fontWeight;
    const exactCode = raw.role === "text" && raw.codeContainer && typeof raw.text === "string" && raw.text.trim().length <= 160 && !/[\x00-\x1f\x7f]/.test(raw.text.trim()) ? raw.text.trim() : "";
    const text = exactCode || clean(raw.text, 160), state: NonNullable<UiSource["elements"][number]["state"]> = {};
    for (const key of ["selected", "expanded", "disabled"] as const) if (typeof raw.state?.[key] === "boolean") state[key] = raw.state[key];
    const codeContainer = exactCode ? clean(raw.codeContainer, 320) : "";
    elements.push({ id: `element-${elements.length}`, role: raw.role, rect, ...(text ? { text } : {}), selector: clean(raw.selector, 320), ...(codeContainer ? { codeContainer } : {}), ...(Object.keys(state).length ? { state } : {}), style });
  }
  const selected = selectUiSourceElements(elements, 48);
  return { id: `ui-${asset.id}`, assetId: asset.id, basis: selected.length > 1 ? "dom" : "pixels", context: asset.provenance?.pageKind === "demo" ? "public-demo" : asset.provenance ? "marketing-example" : "user-supplied",
    ...(asset.provenance ? { pageUrl: asset.provenance.pageUrl } : {}), ...(selector ? { rootSelector: selector.slice(0, 1200) } : {}), width: asset.width, height: asset.height,
    elements: selected.length > 1 ? selected : [], limitations: ["One public captured state only; no product interaction was performed or verified.", "Styles describe displayed public elements, not an official design system; fonts may require a local fallback.", ...(selected.length > 1 ? ["Only visible text and bounded element geometry were retained. Form values, editable text, handlers and raw HTML were excluded.", "Inventory samples semantic controls and spatial regions; redundant nested text is omitted. Records are source references, not a complete layout or instructions to render every record."] : ["This asset has no inspectable UI element inventory. Its pixels require visual research; no controls or text were guessed."])] };
}

/** Called on the already guarded page at its original captured panel; no navigation/clicks/requests. */
export async function captureUiSource(page: Page, asset: Asset, selector: string): Promise<UiSource> {
  const observed = await page.evaluate<DomObservation>(`(() => {
    const root=document.querySelector(${JSON.stringify(selector)});if(!root)return {width:0,height:0,elements:[]};
    const outer=root.getBoundingClientRect(),elements=[];if(!outer.width||!outer.height)return {width:0,height:0,elements};
    for(let ancestor=root;ancestor;ancestor=ancestor.parentElement){const s=getComputedStyle(ancestor);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return {width:outer.width,height:outer.height,elements};}
    const __name=value=>value,select=${selectUiSourceElements.toString()};
    // Resolve browser-supported computed colors into bounded sRGB bytes. This
    // reads no image, CSS rule, form value or URL and never executes site code.
    // Alpha mixtures/gradients remain unknown instead of becoming light UI.
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
    const paint=canvas.getContext('2d',{willReadFrequently:true,colorSpace:'srgb'}),colors=new Map();
    const color=value=>{
      if(typeof value!=='string'||value.length>160||!paint||!CSS.supports('color',value))return '';
      const alpha=/\\/\\s*([\\d.]+)(%)?\\s*\\)$/.exec(value)||(/^rgba\\(/.test(value)?/,\\s*([\\d.]+)(%)?\\s*\\)$/.exec(value):null);
      if(alpha){const opacity=Number(alpha[1])/(alpha[2]?100:1);if(opacity!==0&&opacity!==1)return '';}
      if(colors.has(value))return colors.get(value);
      paint.clearRect(0,0,1,1);paint.fillStyle=value;paint.fillRect(0,0,1,1);
      const rgba=paint.getImageData(0,0,1,1).data,result=rgba[3]===255?'#'+Array.from(rgba).slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join(''):rgba[3]===0?'transparent':'';
      if(colors.size<1600)colors.set(value,result);return result;
    };
    const background=node=>{
      let found='',blocked=false,current=node;
      for(let depth=0;current&&depth<15;depth++,current=current.parentElement){
        const s=getComputedStyle(current);
        if(Number(s.opacity)!==1||s.filter!=='none'||s.backdropFilter!=='none'||s.mixBlendMode!=='normal')return {opaque:false,color:''};
        if(!found&&!blocked){
          if(s.backgroundImage!=='none')blocked=true;
          else {const value=color(s.backgroundColor);if(value&&value!=='transparent')found=value;else if(value!=='transparent')blocked=true;}
        }
      }
      return current?{opaque:false,color:''}:{opaque:true,color:blocked?'':found};
    };
    // Keep the existing 400-node geometry allowance, but spread it across the
    // subtree. Hundreds of early syntax spans cannot hide a later control.
    // Whole rendered lines, never individual syntax tokens. Only inspect static
    // pre/code children; normal privacy and clipping checks still apply below.
    const codeLines=new Set(Array.from(root.querySelectorAll('pre > div,pre > span,pre > code > div,pre > code > span')).filter(node=>/block|flex|grid/.test(getComputedStyle(node).display)));
    const eligible=Array.from(root.querySelectorAll('*')).filter(node=>{
      const code=node.closest('pre,code');if(code&&code!==node&&!codeLines.has(node))return false;
      const control=node.parentElement?.closest('button,a,[role=button],[role=tab],[role=option]');
      return !control||control===root||!root.contains(control);
    });
    const sample=(items,count)=>count<=0?[]:items.length<=count?items:count===1?[items[0]]:Array.from({length:count},(_,i)=>items[Math.floor(i*(items.length-1)/(count-1))]);
    const chosen=new Set([root]);
    const groups=[
      [eligible.filter(node=>node.matches('input,button,select,[role=button],[role=tab],[role=option],a,li')),120],
      [eligible.filter(node=>codeLines.has(node)),80],
      [eligible.filter(node=>node.matches('h1,h2,h3,h4,h5,h6,p,label,dt,dd,pre,code,th,td')),160],
      [eligible.filter(node=>!node.children.length),40]
    ];
    for(const [group,allowance] of groups)for(const node of sample(group.filter(node=>!chosen.has(node)),Math.min(allowance,400-chosen.size)))chosen.add(node);
    for(const node of sample(eligible.filter(node=>!chosen.has(node)),400-chosen.size))chosen.add(node);
    const nodes=[...chosen];
    const path=node=>{const parts=[];let current=node;while(current&&current!==root&&parts.length<10){const tag=current.tagName.toLowerCase(),siblings=Array.from(current.parentElement?.children||[]).filter(n=>n.tagName===current.tagName);parts.unshift(siblings.length>1?tag+':nth-of-type('+(siblings.indexOf(current)+1)+')':tag);current=current.parentElement;}return current===root?(parts.length?':scope > '+parts.join(' > '):':scope'):'';};
    const visibleText=(node,skip=null,complete=false)=>{
      let text='',visited=0;
      let truncated=false;const max=complete?161:160;
      const visit=(parent,depth)=>{if(depth>15||visited>=256||text.length>=max){truncated=true;return;}for(const child of parent.childNodes){
        if(child===skip)continue;if(++visited>256||text.length>=max){truncated=true;break;}
        if(child.nodeType===Node.TEXT_NODE){if(child.textContent.length>max-text.length)truncated=true;text+=child.textContent.slice(0,max-text.length);continue;}
        if(child.nodeType!==Node.ELEMENT_NODE)continue;
        const style=getComputedStyle(child);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)continue;
        if(!(child.matches('span,strong,b,em,i,code,br')||(node.matches('pre,code')&&child.tagName==='DIV'))||child.closest('[contenteditable]:not([contenteditable="false"])')){if(complete){truncated=true;return;}continue;}
        if(complete&&((/hidden|auto|scroll|clip/.test(style.overflowX)&&child.scrollWidth>child.clientWidth)||(/hidden|auto|scroll|clip/.test(style.overflowY)&&child.scrollHeight>child.clientHeight))){truncated=true;return;}
        const block=child.tagName==='BR'||!/^inline/.test(style.display);if(complete&&block){truncated=true;return;}if(block)text+=' ';visit(child,depth+1);if(block)text+=' ';
      }};
      visit(node,0);if(complete)return truncated||text.length>160||/[\\x00-\\x1f\\x7f]/.test(text.trim())?'':text.trim();return text.replace(/\\s+/g,' ').trim().slice(0,160);
    };
    const gutter=node=>{
      const first=node.firstElementChild;if(!first||!/^\\d+$/.test(first.textContent||'')||getComputedStyle(first).userSelect!=='none')return null;
      const siblings=Array.from(node.parentElement.children),index=siblings.indexOf(node),number=Number(first.textContent);
      // Decorative gutters must agree across at least three consecutive lines;
      // a leading numeric literal inside code is never stripped by a regex.
      const start=Math.max(0,Math.min(index-1,siblings.length-3)),nearby=siblings.slice(start,start+3);
      return nearby.length===3&&nearby.every((line,i)=>{const value=line.firstElementChild;return codeLines.has(line)&&value&&getComputedStyle(value).userSelect==='none'&&/^\\d+$/.test(value.textContent||'')&&Number(value.textContent)===number+start+i-index;})?first:null;
    };
    for(const node of nodes){
      if(node.closest('script,style,noscript,template,textarea,[contenteditable]:not([contenteditable="false"])')||node.matches('input[type=password],input[type=hidden]'))continue;
      const line=codeLines.has(node),skip=line?gutter(node):null;
      let box=node.getBoundingClientRect();const s=getComputedStyle(node);if(!box.width||!box.height||s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)continue;
      if(line){const range=document.createRange();range.selectNodeContents(node);if(skip)range.setStartAfter(skip);box=range.getBoundingClientRect();if(!box.width||!box.height)continue;}
      let visible=true,ancestor=node.parentElement;for(let depth=0;ancestor&&depth<15;depth++,ancestor=ancestor.parentElement){const a=getComputedStyle(ancestor);if(a.display==='none'||a.visibility==='hidden'||Number(a.opacity)===0){visible=false;break;}if(ancestor===root)break;}if(!visible)continue;
      // Keep only whole visible elements; partially clipped text is not a faithful inventory.
      let left=outer.left,top=outer.top,right=outer.right,bottom=outer.bottom;ancestor=node.parentElement;
      for(let depth=0;ancestor&&ancestor!==root&&depth<15;depth++,ancestor=ancestor.parentElement){const a=getComputedStyle(ancestor),b=ancestor.getBoundingClientRect();if(/hidden|auto|scroll|clip/.test(a.overflowX)){left=Math.max(left,b.left);right=Math.min(right,b.right);}if(/hidden|auto|scroll|clip/.test(a.overflowY)){top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom);}}
      if(box.left<left-.5||box.top<top-.5||box.right>right+.5||box.bottom>bottom+.5)continue;
      const tag=node.tagName.toLowerCase(),aria=node.getAttribute('role');
      const own=node===root?'':visibleText(node,skip,line);if(line&&!own)continue;
      let role=node===root?'panel':tag==='input'||tag==='select'?'input':tag==='button'||aria==='button'?'button':aria==='tab'?'tab':tag==='a'?'link':tag==='li'||aria==='option'?'list-item':tag==='svg'||tag==='img'?'icon':own?'text':null;
      if(!role){if(node.children.length&&s.backgroundColor!=='rgba(0, 0, 0, 0)'&&box.width>=80&&box.height>=40)role='panel';else continue;}
      const state={};for(const key of ['selected','expanded','disabled']){const value=node.getAttribute('aria-'+key);if(value==='true'||value==='false')state[key]=value==='true';}
      if(node.matches(':disabled'))state.disabled=true;
      const backdrop=background(node),foreground=backdrop.opaque?color(s.color):'';
      elements.push({role,rect:{x:Math.max(0,(box.left-outer.left)/outer.width),y:Math.max(0,(box.top-outer.top)/outer.height),width:Math.min(box.width,outer.right-box.left)/outer.width,height:Math.min(box.height,outer.bottom-box.top)/outer.height},...(own&&role!=='input'?{text:own}:{}),selector:path(node),...(line?{codeContainer:path(node.closest('pre'))}:{}),state,style:{color:foreground==='transparent'?'':foreground,backgroundColor:backdrop.opaque&&s.backgroundImage==='none'?color(s.backgroundColor):'',effectiveBackgroundColor:backdrop.color,borderColor:backdrop.opaque?color(s.borderColor):'',borderWidth:s.borderWidth,borderRadius:s.borderRadius,fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight}});
    }
    return {width:outer.width,height:outer.height,elements:select(elements,96)};
  })()`);
  return uiSourceFromObservation(asset, selector, observed);
}
