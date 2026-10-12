import type { Page } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { frameIndex, probe, writeJson } from "./media";
import { safeDestination } from "./security";
import type { Asset } from "./types";
import { captureUiSource, uiSourceFromObservation, type UiSource, type UiSourceBudget } from "./ui-sources";

/** Complete public-page product images, with conservative selection and recorded provenance. */
export interface ProductImageCandidate {
  url: string;
  selector: string;
  alt: string;
  classes: string;
  naturalWidth: number;
  naturalHeight: number;
  displayedWidth: number;
  displayedHeight: number;
  declaredWidth: number;
  declaredHeight: number;
  visible: boolean;
  /** A CSS-visible source link whose raster/layout has not loaded, not observed UI pixels. */
  unloadedSource?: boolean;
  /** Explicit DOM attribute used for discovery; dimensions remain unconfirmed until decode. */
  sourceAttribute?: string;
}
export interface ProductImageDownload { bytes: Buffer; contentType: string; url: string }
/** Inject safeDownload through the existing shared CaptureDownloadBudget.run(). */
export type ProductImageDownloader = (url: string, maxBytes: number) => Promise<ProductImageDownload>;
export interface ProductVisualOptions {
  download: ProductImageDownloader;
  prefix?: string;
  pageKind?: NonNullable<Asset["provenance"]>["pageKind"];
  maxPanels?: number;
  maxAssets?: number;
  maxAttempts?: number;
  maxTotalBytes?: number;
  maxFileBytes?: number;
  /** Do not start another candidate after this scheduling limit. Not a hard in-flight timeout. */
  schedulingLimitMs?: number;
  uiSources?: UiSourceBudget;
}
interface SourceRecord {
  selector: string; url: string; alt: string; status: "accepted" | "skipped";
  method?: "element" | "source-image"; sectionHeading?: string;
  sourceAttribute?: string;
  reason?: string; originalPath?: string; outputPath?: string; previewPath?: string; sha256?: string;
  sourceWidth?: number; sourceHeight?: number; outputWidth?: number; outputHeight?: number; previewWidth?: number; previewHeight?: number;
  captureState?: "paused-current-frame"; pausedAnimations?: number;
}

export interface ProductPanelCandidate {
  selector: string; clues: string; heading: string; visible: boolean;
  x: number; y: number; width: number; height: number; children: number; media: number;
  mechanismAdjacent?: boolean; controls?: number; editableControls?: number;
  /** Bounded observations, not inferred product behavior. */
  contextClues?: string; ownHeading?: string; textSample?: string; controlLabels?: string[];
  interfaceElements?: number; largeMedia?: number;
}
const panelHint = /(?:^|[\s_-])(?:app|application|screenshot|screen|demo|editor|workspace|canvas|graph|kanban|interface|mockup|preview|window|ui)(?:$|[\s_-])/i;
// Tailwind sizing classes describe the page layout, not an application screen.
const screenUtility = /(?:^|\s)(?:[a-z0-9-]+:)*(?:(?:min|max)-)?(?:w|h)-screen(?:-[a-z0-9-]+)?(?=\s|$)/gi;
const marketingControl = /^(?:start(?: your)?(?: free)? trial|sign ?up|log ?in|get started|contact(?: us| sales)?|book(?: a)? demo|learn more|read more|see pricing|view plans|buy now|subscribe)(?:\b|$)/i;

function panelIsProduct(candidate: ProductPanelCandidate) {
  const clues = candidate.clues.replace(screenUtility, " ");
  if (!panelHint.test(clues)) return false;
  if (/logo|testimonial|pricing|cookie|consent|login|sign[-_ ]?in/i.test(clues)) return false;
  // A nested class may be neutral while its enclosing section explicitly sells plans.
  const independentUi = !!(candidate.editableControls || candidate.interfaceElements || candidate.largeMedia);
  if (/(?:^|[\s_-])(?:cookie|consent)(?:$|[\s_-])/i.test(candidate.contextClues || "")) return false;
  if (!independentUi && /(?:^|[\s_-])(?:pricing|testimonials?)(?:$|[\s_-])/i.test(candidate.contextClues || "")) return false;
  const heading = candidate.ownHeading ?? candidate.heading;
  if (/^(?:why (?:use|choose)|benefits(?: of)?\b|trusted by\b|customer stories\b|testimonials?\b|(?:simple |transparent )?pricing\b|(?:choose|compare|pick|find) (?:your |our |a |the )?plans?\b|.*\bplans? that\b)/i.test(heading)) return false;
  const text = candidate.textSample || "";
  const priceCount = (text.match(/(?:[$€£]\s*\d|\d\s*(?:USD|EUR|GBP))/g) || []).length;
  if (priceCount >= 2 && /(?:per\s+(?:month|year)|\/\s*(?:month|year)|billed\s+(?:monthly|annually))/i.test(text) && /(?:free trial|sign ?up|choose (?:a |your )?plan|contact sales)/i.test(text)) return false;
  // CTA buttons alone are marketing, even when a wrapper calls itself a demo.
  if (candidate.controlLabels?.length && candidate.controlLabels.every(label => marketingControl.test(label)) &&
      !candidate.editableControls && !candidate.interfaceElements && !candidate.largeMedia) return false;
  return true;
}
/** Candidate labels are discovery hints only; downstream visual research must confirm real UI. */
export function rankProductPanelCandidates(input: ProductPanelCandidate[]) {
  const ranked = input.slice(0, 100).filter(candidate => candidate.visible && panelIsProduct(candidate) &&
    candidate.width >= 260 && candidate.height >= 170 && candidate.width <= 2000 && candidate.height <= 1500 &&
    candidate.width * candidate.height >= 120_000 && candidate.width / candidate.height >= .35 && candidate.width / candidate.height <= 4 &&
    (candidate.children >= 3 || candidate.media > 0))
    .sort((a, b) => Number(!!(b.interfaceElements || b.editableControls || b.largeMedia)) - Number(!!(a.interfaceElements || a.editableControls || a.largeMedia)) || b.width * b.height - a.width * a.height || a.selector.localeCompare(b.selector));
  // One feature-adjacent control example outranks area; preserve large overview proof next.
  const mechanism = ranked.filter(candidate => candidate.mechanismAdjacent && (candidate.controls || 0) > 0)
    .sort((a, b) => Number(!!b.editableControls) - Number(!!a.editableControls) || a.selector.localeCompare(b.selector))[0];
  const selected: ProductPanelCandidate[] = [];
  for (const candidate of mechanism ? [mechanism, ...ranked.filter(item => item !== mechanism)] : ranked) {
    const overlaps = selected.some(other => {
      const width = Math.max(0, Math.min(candidate.x + candidate.width, other.x + other.width) - Math.max(candidate.x, other.x));
      const height = Math.max(0, Math.min(candidate.y + candidate.height, other.y + other.height) - Math.max(candidate.y, other.y));
      return width * height / Math.min(candidate.width * candidate.height, other.width * other.height) > .8;
    });
    if (!overlaps) selected.push(candidate);
    if (selected.length === 4) break;
  }
  return selected;
}

export async function observeProductPanels(page: Page): Promise<ProductPanelCandidate[]> {
  return page.evaluate(({ hintSource, utilitySource }) => {
    const hint = new RegExp(hintSource, "i"), utility = new RegExp(utilitySource, "gi");
    // Object methods remain self-contained when tsx serializes this browser callback.
    const helpers = {
      clean(text: string | null | undefined, limit: number) { return (text || "").replace(/\s+/g, " ").trim().slice(0, limit); },
      shown(node: Element) { const box = node.getBoundingClientRect(), style = getComputedStyle(node); return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0; },
    };
    const result: ProductPanelCandidate[] = [];
    const nodes = Array.from(document.querySelectorAll("figure,section,[role=img],[class],[id],[aria-label]")).slice(0, 1800);
    for (const node of nodes) {
      const clues = [node.id, node.getAttribute("class"), node.getAttribute("aria-label")].join(" ").slice(0, 600);
      if (!hint.test(clues.replace(utility, " "))) continue;
      const box = node.getBoundingClientRect();
      if (box.width < 260 || box.height < 170 || !helpers.shown(node)) continue;
      const parts: string[] = [];
      let item: Element | null = node;
      while (item && item !== document.documentElement && parts.length < 20) {
        if (item.id) { parts.unshift("#" + CSS.escape(item.id)); break; }
        const tag = item.tagName.toLowerCase(), siblings: Element[] = item.parentElement ? Array.from(item.parentElement.children).filter(s => s.tagName === item!.tagName) : [];
        parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(item) + 1})` : tag); item = item.parentElement;
      }
      let section: Element | null = node, heading = "", mechanismAdjacent = false;
      for (let i = 0; section && i < 5; i++, section = section.parentElement) {
        const title = section.querySelector("h2,h3,h4,dt"), bounds = section.getBoundingClientRect();
        if (title && bounds.width <= Math.max(box.width * 1.5, 850) && bounds.height <= box.height + 350) {
          heading = helpers.clean(title.textContent, 160);
          mechanismAdjacent = /\b(create|write|link|connect|find|search|organize|edit|compare|select|build|visualize|manage|track|share)\b/i.test(helpers.clean(section.querySelector("dd,p")?.textContent, 600)); break;
        }
      }
      const context: string[] = [];
      for (let parent = node.parentElement, i = 0; parent && i < 3 && !["BODY", "MAIN", "HTML"].includes(parent.tagName); parent = parent.parentElement, i++) {
        context.push([parent.id, parent.getAttribute("class"), parent.getAttribute("aria-label")].join(" ").slice(0, 200));
      }
      const controls = Array.from(node.querySelectorAll("input,button,select,textarea,[contenteditable=true],[role=button],[role=option],[role=tab]")).slice(0, 64).filter(helpers.shown);
      const editable = controls.filter(control => control.matches("textarea,[contenteditable=true],input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]):not([type=password])"));
      const interfaceElements = Array.from(node.querySelectorAll("[role=application],[role=grid],[role=tree],[role=tablist],[role=toolbar],table,canvas,textarea,[contenteditable=true]")).slice(0, 64).filter(helpers.shown).length;
      const media = Array.from(node.querySelectorAll("img,svg,canvas,video")).slice(0, 64).filter(helpers.shown);
      const largeMedia = media.filter(element => { const bounds = element.getBoundingClientRect(); return bounds.width >= 260 && bounds.height >= 170 && bounds.width * bounds.height >= box.width * box.height * .25; }).length;
      result.push({ selector: parts.join(" > ").slice(0, 1200), clues, heading, ownHeading: helpers.clean(node.querySelector("h1,h2,h3,h4,dt")?.textContent, 160), contextClues: context.join(" ").slice(0, 600),
        textSample: helpers.clean((node as HTMLElement).innerText, 1800), controlLabels: controls.map(control => helpers.clean(control.getAttribute("aria-label") || (control as HTMLElement).innerText || control.getAttribute("placeholder"), 80)).filter(Boolean).slice(0, 12),
        mechanismAdjacent, controls: controls.length, editableControls: editable.length, interfaceElements, largeMedia,
        visible: true, x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height, children: node.children.length, media: media.length });
      if (result.length >= 100) break;
    }
    return result;
  }, { hintSource: panelHint.source, utilitySource: screenUtility.source });
}

/** Freeze the current rendered state, never finish an animation or reveal hidden UI.
 * Playwright's animations:'disabled' changes finite/infinite animation state and
 * restores it before returning pixels. Hold our pause through both inventory
 * observations instead, and reject a concurrently mutating public example.
 */
export async function captureProductPanelState(page: Page, asset: Asset, selector: string, path: string, timeoutMs: number): Promise<{ source: UiSource; pausedAnimations: number }> {
  const deadline = Date.now() + Math.max(1, Math.min(3000, timeoutMs));
  const remaining = () => { const value = deadline - Date.now(); if (value <= 0) throw new Error("Product panel capture exceeded its existing 3-second allowance"); return value; };
  const held = await page.evaluateHandle<{ settle(ms: number): Promise<void>; begin(): { x: number; y: number; width: number; height: number; pausedAnimations: number }; verify(): void; restore(): void }>(`(async () => {
    const root=document.querySelector(${JSON.stringify(selector)});if(!root)throw Error('Product panel disappeared');
    root.scrollIntoView({behavior:'instant',block:'center',inline:'center'});
    // Allow the scroll event and its next layout to apply before observing the
    // current frame. This neither completes nor resets an animation.
    let firstFrame,secondFrame,timer;
    try{await Promise.race([new Promise(resolve=>{firstFrame=requestAnimationFrame(()=>{secondFrame=requestAnimationFrame(resolve);});}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Product panel scroll exceeded capture allowance')),${remaining()});})]);}
    finally{clearTimeout(timer);cancelAnimationFrame(firstFrame);cancelAnimationFrame(secondFrame);}
    const animations=document.getAnimations();if(animations.length>256)throw Error('Product panel animation observation exceeds its bounded allowance');
    const running=animations.filter(animation=>animation.playState==='running');
    const observers=[],changes=[],ancestors=[];let changed=false,bounds=null;
    const record=records=>{if(records.length)changed=true;for(const item of records){if(changes.length>=6)break;const location=item.target===root?'root':root.contains(item.target)?'child':'ancestor';let detail='';if(location==='ancestor'&&item.attributeName==='class'){const tokens=value=>(value||'').split(/\\s+/).filter(token=>/^[a-zA-Z0-9_-]{1,48}$/.test(token)).slice(0,6).join(' ');let depth=0,node=root;while(node&&node!==item.target&&depth<33){node=node.parentElement;depth++;}detail=':'+item.target.tagName+'@'+depth+':['+tokens(item.oldValue)+']>['+tokens(item.target.getAttribute('class'))+']';}changes.push(item.type+':'+(item.attributeName||'content')+':'+location+detail);}};
    const rect=()=>{const box=root.getBoundingClientRect();return [box.x+scrollX,box.y+scrollY,box.width,box.height];};
    const restore=()=>{for(const observer of observers)observer.disconnect();for(const animation of running){try{if(animation.playState==='paused')animation.play();}catch{}}};
    try{
      for(const animation of running)animation.pause();
    }catch(error){restore();throw error;}
    return {
      async settle(ms){
        const end=performance.now()+ms;let timer;
        try{await Promise.race([Promise.all(running.map(animation=>animation.ready)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Product panel animation pause exceeded capture allowance')),ms);})]);}finally{clearTimeout(timer);}
        // Public pages often remove scroll-state classes on a delayed scroll-end
        // timer. Wait for actual quiet, without guessing any website class name.
        // This consumes the existing capture allowance, never extends it.
        await new Promise((resolve,reject)=>{
          const quietObservers=[];let quietTimer,limitTimer,done=false;
          const cleanup=()=>{clearTimeout(quietTimer);clearTimeout(limitTimer);removeEventListener('scroll',touch,true);for(const observer of quietObservers)observer.disconnect();};
          const finish=error=>{if(done)return;done=true;cleanup();if(error)reject(error);else resolve();};
          const touch=()=>{clearTimeout(quietTimer);quietTimer=setTimeout(()=>finish(),300);};
          try{
            const observer=new MutationObserver(touch);observer.observe(root,{subtree:true,attributes:true,childList:true,characterData:true});quietObservers.push(observer);
            let parent=root.parentElement;for(let count=0;parent&&count<32;count++,parent=parent.parentElement){const ancestorObserver=new MutationObserver(touch);ancestorObserver.observe(parent,{attributes:true});quietObservers.push(ancestorObserver);}
            if(parent)throw Error('Product panel ancestor observation exceeds its bounded allowance');
            addEventListener('scroll',touch,true);
            limitTimer=setTimeout(()=>finish(Error('Product panel did not settle within its bounded capture allowance')),Math.max(1,Math.min(900,end-performance.now())));touch();
          }catch(error){finish(error);}
        });
      },
      begin(){
        if(!root.isConnected)throw Error('Product panel disappeared');bounds=rect();
        const observer=new MutationObserver(record);observer.observe(root,{subtree:true,attributes:true,childList:true,characterData:true});observers.push(observer);
        // Reassigning the identical ancestor class/style is a DOM mutation but
        // cannot change descendant styling. Any actual transition, including
        // A-to-B-to-A within one callback, remains a rejected mutation.
        let parent=root.parentElement;for(let count=0;parent&&count<32;count++,parent=parent.parentElement){const node=parent,observe=records=>record(records.filter(item=>item.oldValue!==node.getAttribute(item.attributeName)));const ancestorObserver=new MutationObserver(observe);ancestorObserver.observe(node,{attributes:true,attributeOldValue:true});observers.push(ancestorObserver);ancestors.push({observer:ancestorObserver,observe});}
        if(parent)throw Error('Product panel ancestor observation exceeds its bounded allowance');
        if(bounds[0]<0||bounds[1]<0)throw Error('Product panel is partially outside the capturable page');
        return {x:bounds[0],y:bounds[1],width:bounds[2],height:bounds[3],pausedAnimations:running.length};
      },
      verify(){
        record(observers[0].takeRecords());for(const ancestor of ancestors)ancestor.observe(ancestor.observer.takeRecords());
        if(changed||!root.isConnected||document.querySelector(${JSON.stringify(selector)})!==root)throw Error('Product panel changed during paired pixel and DOM capture: '+changes.join(','));
        if(rect().some((value,index)=>Math.abs(value-bounds[index])>.1))throw Error('Product panel geometry changed during paired capture');
        for(const animation of document.getAnimations()){
          const target=animation.effect&&animation.effect.target;
          if(animation.playState==='running'&&target instanceof Element&&(root.contains(target)||target.contains(root)))throw Error('Product panel animation changed during paired capture');
        }
      },
      restore
    };
  })()`);
  try {
    await held.evaluate((state, ms) => state.settle(ms), remaining());
    const measured = await held.evaluate(state => state.begin());
    if (measured.width < 260 || measured.height < 170 || measured.width > 2000 || measured.height > 1500) throw new Error("Product panel dimensions changed or are unusable");
    const observedAsset = { ...asset, width: measured.width, height: measured.height };
    remaining(); const before = await captureUiSource(page, observedAsset, selector);
    // An element screenshot performs a second automatic scroll after its own
    // stability wait. Capture the observed document rectangle directly instead;
    // Chromium clips these actual pixels without scrolling/resizing the page.
    await page.screenshot({ path, type: "jpeg", quality: 92, fullPage: true, clip: { x: measured.x, y: measured.y, width: measured.width, height: measured.height }, animations: "allow", caret: "initial", timeout: remaining() });
    remaining(); const after = await captureUiSource(page, observedAsset, selector);
    await held.evaluate(state => state.verify()); remaining();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Product panel inventory changed during paired capture");
    return { source: after, pausedAnimations: measured.pausedAnimations };
  } finally { await held.evaluate(state => state.restore()).catch(() => {}); await held.dispose().catch(() => {}); }
}

async function productPanels(page: Page, workspace: string, pageUrl: string, prefix: string, pageKind: NonNullable<Asset["provenance"]>["pageKind"], limit: number, deadline: number, uiSources?: UiSourceBudget) {
  const candidates = await observeProductPanels(page);
  const assets: Asset[] = [], artifactPaths: string[] = [], sources: SourceRecord[] = [];
  for (const candidate of rankProductPanelCandidates(candidates)) {
    if (assets.length >= limit || Date.now() >= deadline) break;
    const record: SourceRecord = { selector: candidate.selector, url: pageUrl, alt: candidate.heading, sectionHeading: candidate.heading, method: "element", status: "skipped" }; sources.push(record);
    try {
      const id = `${prefix}-panel-${assets.length}`, path = `assets/${id}.jpg`, preview = `analysis/${id}.jpg`;
      const asset: Asset = { id, path, preview, kind: "image", usage: "output", width: candidate.width, height: candidate.height, source: pageUrl,
        rights: "Unaltered current-frame element capture of a public product-related panel; active animations were temporarily paused through matching pixel and DOM observation, then resumed. A visual candidate, not an authenticated workflow or proof of interaction.",
        provenance: { pageUrl, pageKind, method: "element", role: pageKind === "pricing" ? "marketing" : "product-ui-candidate", selector: candidate.selector, sectionHeading: candidate.heading } };
      const captured = await captureProductPanelState(page, asset, candidate.selector, join(workspace, path), Math.max(1, Math.min(3000, deadline - Date.now())));
      const media = await probe(join(workspace, path));
      if (!media.video || media.width < 260 || media.height < 170 || media.width > 2000 || media.height > 1500) throw new Error("Product panel dimensions changed or are unusable");
      if (Math.abs(media.width - captured.source.width) > 2 || Math.abs(media.height - captured.source.height) > 2) throw new Error("Product panel screenshot clipped the observed source rectangle");
      const width = Math.max(2, Math.floor(Math.min(1600, 1600 * media.width / media.height) / 2) * 2);
      await frameIndex(join(workspace, path), join(workspace, preview), 0, width);
      const previewMedia = await probe(join(workspace, preview));
      asset.width = media.width; asset.height = media.height;
      assets.push(asset);
      if (uiSources && uiSources.sources.length < 3) {
        uiSources.add({ ...captured.source, width: media.width, height: media.height });
      }
      artifactPaths.push(path, preview);Object.assign(record,{status:"accepted",captureState:"paused-current-frame",pausedAnimations:captured.pausedAnimations,outputPath:path,previewPath:preview,outputWidth:media.width,outputHeight:media.height,previewWidth:previewMedia.width,previewHeight:previewMedia.height});
    } catch (error) { record.reason = error instanceof Error ? error.message.slice(0,300) : "Product panel unavailable"; }
  }
  return { assets, artifactPaths, sources };
}
export interface ProductVisualResult {
  assets: Asset[];
  /** Originals, normalized visuals, analysis previews, and provenance; checkpoint these together. */
  artifactPaths: string[];
  diagnostics: {
    pageUrl: string; inspectedElements: number; eligibleCandidates: number; attempts: number;
    reservedBytes: number; downloadedBytes: number; elapsedMs: number; schedulingLimitReached: boolean;
    timePolicy: string; sources: SourceRecord[];
  };
}

function positiveInteger(value: number | undefined, fallback: number, ceiling: number) {
  return Number.isFinite(value) && value! > 0 ? Math.min(ceiling, Math.floor(value!)) : fallback;
}
function reasonableRaster(width: number, height: number) {
  const ratio = width / height;
  return width > 0 && height > 0 && Math.min(width, height) >= 260 && Math.max(width, height) >= 640 && width * height >= 220_000 && width * height <= 40_000_000 && ratio >= 0.35 && ratio <= 4;
}
function publicProtocol(url: string) {
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password && parsed.href.length <= 2048;
  } catch { return false; }
}

/** Pure ranking only. All selected URLs are revalidated and pinned by the downloader. */
export function rankProductImageCandidates(input: ProductImageCandidate[]) {
  const seen = new Set<string>();
  const positive = /screenshot|screen[-_ ]?shot|dashboard|workspace|interface|editor|product[-_ ]?(preview|image)|app[-_ ]?(preview|screen)|browser|desktop|mobile|canvas|kanban|whiteboard|publish|diagram|graph|preview|demo|workflow|automation|node[-_ ]?(?:history|details)/i;
  const negative = /(?:^|[\s/_\-.])(logo|icon|avatar|badge|sprite|headshot|portrait|testimonial)(?:$|[\s/_\-.])/i;
  return input.slice(0, 200).flatMap((candidate) => {
    if ((!candidate.visible && !candidate.unloadedSource) || !publicProtocol(candidate.url)) return [];
    const width = candidate.naturalWidth || candidate.declaredWidth, height = candidate.naturalHeight || candidate.declaredHeight;
    const unmeasured = !candidate.naturalWidth && !candidate.naturalHeight && (!width || !height);
    // An unloaded article image often has only alt-text layout and no declared
    // dimensions. Its explicit URL may be tried within the same attempt/byte
    // caps; only the decoded raster below can qualify it as captured evidence.
    if (!unmeasured && (!reasonableRaster(width, height) || candidate.displayedWidth < 220 || candidate.displayedHeight < 140)) return [];
    if (unmeasured && ((width > 0 && width < 260) || (height > 0 && height < 260))) return [];
    const clues = `${candidate.alt} ${candidate.url} ${candidate.classes}`;
    if (negative.test(clues) || !positive.test(clues)) return [];
    const url = new URL(candidate.url); url.hash = "";
    if (seen.has(url.href)) return []; seen.add(url.href);
    const score = (positive.test(candidate.alt) ? 4 : 0) + (positive.test(url.pathname) ? 3 : 0) + (positive.test(candidate.classes) ? 1 : 0) + (unmeasured ? 0 : Math.min(2, (width * height) / 1_000_000));
    return [{ ...candidate, url: url.href, score }];
  }).sort((a, b) => b.score - a.score).slice(0, 12);
}

/** Observe exact linked sources without waiting for or triggering a lazy loader. */
export async function observeProductImages(page: Page): Promise<ProductImageCandidate[]> {
  return page.locator("img").evaluateAll((nodes) => nodes.slice(0, 200).map((node) => {
    const image = node as HTMLImageElement, box = image.getBoundingClientRect(), style = getComputedStyle(image);
    const parts: string[] = [];
    let item: Element | null = image;
    while (item && item !== document.documentElement && parts.length < 20) {
      const tag = item.tagName.toLowerCase();
      if (item.id) { parts.unshift(`#${CSS.escape(item.id)}`); break; }
      const siblings: Element[] = item.parentElement ? Array.from(item.parentElement.children).filter((sibling) => sibling.tagName === item!.tagName) : [];
      parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(item) + 1})` : tag);
      item = item.parentElement;
    }
    const loaded = image.naturalWidth > 0 && image.naturalHeight > 0;
    const cssVisible = style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
    let ancestryVisible = cssVisible;
    // Pending <img> elements can be 0×0 before their alt text or raster loads.
    // Check the bounded ancestor chain so this never reclassifies hidden DOM
    // content as visible; only its explicit source may be fetched and decoded.
    let ancestor = image.parentElement;
    for (let depth = 0; ancestryVisible && ancestor && depth < 24; depth++, ancestor = ancestor.parentElement) {
      const ancestorStyle = getComputedStyle(ancestor);
      if (ancestorStyle.display === "none" || ancestorStyle.visibility === "hidden" || Number(ancestorStyle.opacity) === 0) ancestryVisible = false;
    }
    if (ancestor) ancestryVisible = false;
    const unloadedSource = !image.naturalWidth && !image.naturalHeight && ancestryVisible;
    // These attributes hold actual URLs, never templates or inferred filenames.
    const sources = loaded ? [["currentSrc", image.currentSrc], ["src", image.getAttribute("src")]] :
      [["data-src", image.getAttribute("data-src")], ["data-original", image.getAttribute("data-original")], ["data-lazy-src", image.getAttribute("data-lazy-src")], ["currentSrc", image.currentSrc], ["src", image.getAttribute("src")]];
    let url = "", sourceAttribute = "";
    for (const [attribute, raw] of sources) {
      if (!raw || raw.length > 2048) continue;
      try {
        const resolved = new URL(raw, document.baseURI);
        if (!["http:", "https:"].includes(resolved.protocol) || resolved.username || resolved.password || resolved.href.length > 2048) continue;
        url = resolved.href; sourceAttribute = attribute!; break;
      } catch { /* Invalid observed attributes do not create a candidate. */ }
    }
    return { url, sourceAttribute, unloadedSource, selector: parts.join(" > ").slice(0, 1200), alt: image.alt.slice(0, 500), classes: `${image.className} ${image.parentElement?.className || ""}`.slice(0, 600), naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, displayedWidth: box.width, displayedHeight: box.height, declaredWidth: Number(image.getAttribute("width")), declaredHeight: Number(image.getAttribute("height")), visible: ancestryVisible && box.width > 0 && box.height > 0 };
  }));
}

export function rasterExtension(bytes: Buffer, contentType: string): "png" | "jpg" | "webp" | null {
  const type = contentType.split(";", 1)[0].trim().toLowerCase();
  // Object-storage uploads often retain this generic MIME type. Accept only a
  // recognized raster signature; the decoder below still verifies codec, size,
  // static duration and complete normalization before it can become evidence.
  const binary = type === "application/octet-stream";
  if ((binary || type === "image/png") && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if ((binary || ["image/jpeg", "image/jpg"].includes(type)) && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpg";
  if ((binary || type === "image/webp") && bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

/**
 * Retrieve complete, page-linked raster images instead of cutting them at viewport edges.
 * The passed page must already use captureProduct's guarded routes and blocked service workers.
 * The downloader MUST wrap safeDownload in the same CaptureDownloadBudget used for that page.
 * Limits bound assets, attempts and reserved bytes. In-flight networking uses safeDownload's
 * existing inactivity timeout; decoding and total execution retain the outer worker limits.
 * This helper intentionally does not promise an independent hard wall-clock deadline.
 */
export async function extractProductVisuals(page: Page, workspace: string, pageUrl: string, options: ProductVisualOptions): Promise<ProductVisualResult> {
  const started = Date.now();
  const prefix = options.prefix || "product", pageKind = options.pageKind || "homepage";
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(prefix)) throw new Error("Invalid product visual artifact prefix");
  const maxAssets = positiveInteger(options.maxAssets, 4, 4), maxAttempts = positiveInteger(options.maxAttempts, 6, 8);
  const maxFileBytes = positiveInteger(options.maxFileBytes, 8_000_000, 8_000_000), maxTotalBytes = positiveInteger(options.maxTotalBytes, 24_000_000, 32_000_000);
  const schedulingLimit = positiveInteger(options.schedulingLimitMs, 20_000, 45_000);
  const elements = await observeProductImages(page);
  const candidates = rankProductImageCandidates(elements);
  const result: ProductVisualResult = { assets: [], artifactPaths: [], diagnostics: { pageUrl, inspectedElements: elements.length, eligibleCandidates: candidates.length, attempts: 0, reservedBytes: 0, downloadedBytes: 0, elapsedMs: 0, schedulingLimitReached: false, timePolicy: "20-second default scheduling limit; existing safeDownload inactivity timeout and outer worker wall limit remain authoritative for in-flight work.", sources: [] } };
  const hashes = new Set<string>();
  await mkdir(join(workspace, "assets"), { recursive: true });
  await mkdir(join(workspace, "analysis"), { recursive: true });
  if ((options.maxPanels ?? 2) > 0 && pageKind !== "pricing") {
    try { const panels = await productPanels(page, workspace, pageUrl, prefix, pageKind, Math.min(3,maxAssets,options.maxPanels ?? 2), started + schedulingLimit, options.uiSources);
      result.assets.push(...panels.assets);result.artifactPaths.push(...panels.artifactPaths);result.diagnostics.sources.push(...panels.sources);
    } catch (error) { result.diagnostics.sources.push({ selector: "", url: pageUrl, alt: "", method: "element", status: "skipped", reason: error instanceof Error ? error.message.slice(0,300) : "Optional product panels unavailable" }); }
  }
  for (const candidate of candidates) {
    if (result.assets.length >= maxAssets || result.diagnostics.attempts >= maxAttempts || result.diagnostics.reservedBytes >= maxTotalBytes) break;
    if (Date.now() - started >= schedulingLimit) { result.diagnostics.schedulingLimitReached = true; break; }
    const reservation = Math.min(maxFileBytes, maxTotalBytes - result.diagnostics.reservedBytes);
    const source: SourceRecord = { selector: candidate.selector, url: candidate.url, alt: candidate.alt, sourceAttribute: candidate.sourceAttribute, method: "source-image", status: "skipped" };
    result.diagnostics.sources.push(source);
    result.diagnostics.attempts++;
    result.diagnostics.reservedBytes += reservation;
    try {
      await safeDestination(candidate.url);
      const download = await options.download(candidate.url, reservation);
      if (download.bytes.length > reservation) throw new Error("Source image exceeds its byte reservation");
      result.diagnostics.downloadedBytes += download.bytes.length;
      // Successful transfers release unused local capacity; failed transfers retain the reservation.
      result.diagnostics.reservedBytes -= reservation - download.bytes.length;
      await safeDestination(download.url);
      source.url = download.url;
      const extension = rasterExtension(download.bytes, download.contentType);
      if (!extension) throw new Error("Not a supported PNG, JPEG, or WebP with matching content type and header");
      const sha256 = createHash("sha256").update(download.bytes).digest("hex");
      if (hashes.has(sha256)) throw new Error("Duplicate source image bytes");
      const index = result.diagnostics.attempts - 1;
      const original = `assets/${prefix}-original-${index}.${extension}`, normalized = `assets/${prefix}-image-${index}.jpg`, preview = `analysis/${prefix}-image-${index}.jpg`;
      await writeFile(join(workspace, original), download.bytes);
      result.artifactPaths.push(original);
      const media = await probe(join(workspace, original));
      if (!media.video || !["png", "mjpeg", "webp"].includes(media.video.codec_name) || !reasonableRaster(media.width, media.height) || media.duration > 0.1) throw new Error("Decoded image dimensions/type do not describe a usable complete static product visual");
      await frameIndex(join(workspace, original), join(workspace, normalized), 0, 2560);
      const output = await probe(join(workspace, normalized));
      if (!output.video || !output.width || !output.height) throw new Error("Normalized product visual is unreadable");
      // Bound both analysis dimensions without reducing the image used by the renderer.
      const previewWidth = Math.max(2, Math.floor(Math.min(1600, 1600 * media.width / media.height) / 2) * 2);
      await frameIndex(join(workspace, original), join(workspace, preview), 0, previewWidth);
      const previewMedia = await probe(join(workspace, preview));
      if (!previewMedia.video || !previewMedia.width || !previewMedia.height || Math.max(previewMedia.width, previewMedia.height) > 1600) throw new Error("Product analysis preview exceeds its dimension limit or is unreadable");
      hashes.add(sha256);
      result.artifactPaths.push(normalized, preview);
      result.assets.push({ id: `${prefix}-image-${index}`, path: normalized, preview, kind: "image", usage: "output", width: output.width, height: output.height, rights: "Complete image linked by a public product page; a visual candidate, not an authenticated application recording.", source: download.url,
        provenance: { pageUrl, pageKind, method: "source-image", role: pageKind === "pricing" ? "marketing" : "product-ui-candidate", selector: candidate.selector, assetUrl: download.url, sectionHeading: candidate.alt.slice(0,160) } });
      options.uiSources?.add(uiSourceFromObservation(result.assets.at(-1)!, ""));
      Object.assign(source, { status: "accepted", originalPath: original, outputPath: normalized, previewPath: preview, sha256, sourceWidth: media.width, sourceHeight: media.height, outputWidth: output.width, outputHeight: output.height, previewWidth: previewMedia.width, previewHeight: previewMedia.height });
    } catch (error) {
      source.reason = error instanceof Error ? error.message.slice(0, 350) : "Source image could not be used";
    }
  }
  result.diagnostics.elapsedMs = Date.now() - started;
  const manifest = `analysis/${prefix}-visuals.json`;
  await writeJson(join(workspace, manifest), result.diagnostics);
  result.artifactPaths.push(manifest);
  return result;
}
