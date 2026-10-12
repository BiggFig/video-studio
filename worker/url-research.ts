import type { Page } from "playwright";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isIP } from "node:net";
import { publicAddress } from "./security";
import { writeJson } from "./media";
import type { Asset } from "./types";
import type { GuideCatalog, GuideChoice } from "./guide-selection";

export interface ResearchAnchor { href: string; text: string; download?: boolean; index?: number }
export interface ResearchLink { url: string; kind: "pricing" | "features" | "docs" | "demo"; anchorText: string; anchorIndex?: number }
const forbidden = new Set(["login", "logout", "signin", "signout", "signup", "register", "registration", "account", "accounts", "user", "users", "portal", "console", "auth", "oauth", "sso", "checkout", "cart", "billing", "download", "downloads", "api", "graphql", "rpc", "admin", "dashboard", "app", "settings", "profile", "session", "sessions", "password", "reset", "token", "callback", "payment", "payments", "subscribe", "unsubscribe", "purchase", "delete", "remove", "cancel", "invite", "invitations", "redirect", "redir"]);

/** Syntactic policy only. safeDownload still validates public DNS/IPs on every hop. */
export function researchDestination(raw: string, homepage: string): string | null {
  try {
    if (!raw || raw.length > 2048 || /[\x00-\x20\\]/.test(raw)) return null;
    const home = new URL(homepage), url = new URL(raw, home);
    const baseHost = home.hostname.toLowerCase().replace(/^www\./, ""), targetHost = url.hostname.toLowerCase().replace(/^www\./, "");
    const relatedHttps = url.protocol === "https:" && (targetHost === baseHost || targetHost.endsWith(`.${baseHost}`));
    if (!["https:", "http:"].includes(url.protocol) || (url.origin !== home.origin && !relatedHttps) || url.username || url.password || (url.port && !["80", "443"].includes(url.port))) return null;
    if (targetHost !== baseHost && targetHost.slice(0, -(baseHost.length + 1)).split(".").some(part => forbidden.has(part))) return null;
    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || (isIP(host) && !publicAddress(host))) return null;
    url.hash = "";
    if (url.href.includes("?")) return null;
    let path = url.pathname;
    for (let i = 0; i < 3 && /%[\da-f]{2}/i.test(path); i++) path = decodeURIComponent(path);
    if (/%|[\\?;\x00-\x20]/.test(path)) return null;
    // /user-docs is a public documentation namespace, not a /user account route.
    // Only that complete first segment is exempt; all nested auth/action words
    // and the existing origin, query, redirect and public-address guards remain.
    const words = path.toLowerCase().replace(/^\/user-docs(?=\/|$)/,"/docs").split(/[^a-z0-9]+/).filter(Boolean);
    if (words.some(word => forbidden.has(word)) || /(?:^|\/)(?:sign|log)[-_/]?(?:in|out|up)(?:\/|$)/i.test(path)) return null;
    if (/\.(?:pdf|zip|exe|dmg|msi|apk|mp4|mov|webm|mp3|wav|png|jpe?g|webp|svg|gif|css|js|json|xml|csv)$/i.test(path)) return null;
    return url.href;
  } catch { return null; }
}

const identity = (url: string) => { const value = new URL(url); return value.origin + value.pathname.replace(/\/+$/, ""); };

/** Only observed links qualify; text selects a topic, never instructions to execute. */
export function selectResearchLinks(homepage: string, anchors: readonly ResearchAnchor[]): ResearchLink[] {
  const candidates: ResearchLink[] = [], seen = new Set<string>();
  let home: string;
  try { home = identity(homepage); } catch { return []; }
  for (const anchor of anchors.slice(0, 300)) {
    if (anchor.download) continue;
    const url = researchDestination(anchor.href, homepage), text = anchor.text.replace(/\s+/g, " ").trim().slice(0, 120);
    if (!url || !text || identity(url) === home || seen.has(identity(url))) continue;
    const pricing = /\b(?:pricing|plans?)\b/i.test(text), features = /\b(?:features?|products?|platform|capabilities|overview)\b/i.test(text);
    const demo = /\b(?:demo|examples?|tour)\b/i.test(text) || /^(?:interactive |live |try )?playground\b/i.test(text), docs = /\b(?:docs?|documentation|help|guides?|tutorials?|knowledge\s*base|help\s*center)\b/i.test(text);
    if (!pricing && !features && !demo && !docs) continue;
    seen.add(identity(url));
    candidates.push({ url, kind: pricing ? "pricing" : demo ? "demo" : docs ? "docs" : "features", anchorText: text, anchorIndex: anchor.index });
  }
  const documentationPriority = (link: ResearchLink) => link.kind !== "docs" ? 0 : /\b(?:developer|api|sdk)\b/i.test(link.anchorText) ? 2 : /\b(?:help|user\s+(?:guide|docs?|documentation)|knowledge\s*base|getting started)\b/i.test(link.anchorText) ? 0 : 1;
  candidates.sort((a, b) => documentationPriority(a) - documentationPriority(b) || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  // Homepage visuals already supply appearance. Documentation is the stronger
  // next source for the actual action/result contract; a demo remains fallback.
  const visual = candidates.find(link => link.kind === "docs") || candidates.find(link => link.kind === "demo");
  const selected = (visual ? [visual, candidates.find(link => link.kind === "features") || candidates.find(link => link.kind === "pricing")] :
    [candidates.find(link => link.kind === "features"), candidates.find(link => link.kind === "pricing")]).filter((link): link is ResearchLink => !!link);
  for (const candidate of candidates) if (selected.length < 2 && !selected.includes(candidate)) selected.push(candidate);
  return selected.slice(0, 2);
}

/** Prefer an observed task guide for the second existing followup slot. */
export function selectDocumentationFollowup(homepage: string, current: string, anchors: readonly ResearchAnchor[], hints: string): ResearchLink | undefined {
  const terms = new Set((hints.toLowerCase().match(/[a-z]{4,}/g) || []).filter(word => !new Set(["with","your","from","that","this","have","more","product","features","platform","software","documentation","learn"]).has(word)));
  const seen = new Set<string>();
  const candidates: { link: ResearchLink; actionPriority: number; overlap: number }[] = [];
  for(const anchor of anchors.slice(0,300)){
    if(anchor.download)continue;
    const url=researchDestination(anchor.href,homepage),text=anchor.text.replace(/\s+/g," ").trim().slice(0,120);
    if(!url||!text||[identity(homepage),identity(current)].includes(identity(url))||seen.has(identity(url)))continue;
    seen.add(identity(url));
    const path=new URL(url).pathname;
    if(!/(?:^|\/)(?:docs?|user-docs|help|guides?|tutorials?|knowledge-base)(?:\/|$)/i.test(path))continue;
    if(/\b(?:install|installation|docker|self.host|hosting|developer|api|sdk|changelog|release notes|contribut|license|billing)\b/i.test(text+" "+path))continue;
    const action=/\b(?:creat(?:e|ing)|build(?:ing)?|edit(?:ing)?|filter(?:ing)?|segment(?:ing)?|send(?:ing)?|publish(?:ing)?|organiz(?:e|ing)|add(?:ing)?|apply(?:ing)?|configur(?:e|ing)|connect(?:ing)?|import(?:ing)?|export(?:ing)?|set(?:ting)? up)\b/i.test(text);
    const procedure=/\b(?:how to|using)\b/i.test(text);
    const task=action||procedure||/\b(?:creat\w*|build\w*|edit\w*|filter\w*|segment\w*|send\w*|publish\w*|workflow\w*|automat\w*|form\w*|view\w*|row\w*|column\w*|field\w*|organize\w*|getting started|quickstart)\b/i.test(text);
    if(!task)continue;
    const words=new Set(text.toLowerCase().match(/[a-z]{4,}/g)||[]);
    const overlap=[...words].filter(word=>terms.has(word)).length;
    // Homepage prose often repeats feature names. It cannot outweigh a guide
    // naming a user action when we need evidence of controls and consequences.
    // Overlap still selects the more relevant guide within an action tier.
    candidates.push({link:{url,kind:"docs",anchorText:text,anchorIndex:anchor.index},actionPriority:action?2:procedure?1:0,overlap});
  }
  return candidates.sort((a,b)=>b.actionPriority-a.actionPriority||b.overlap-a.overlap||a.link.url.localeCompare(b.link.url))[0]?.link;
}

export interface ResearchSourceRecord {
  kind: "homepage" | "pricing" | "features" | "docs" | "demo"; requestedUrl: string; url?: string; title?: string;
  discoveredOn?: string; anchorText?: string; anchorIndex?: number;
  status: "captured" | "failed" | "skipped"; textPath?: string; imagePath?: string; textCharacters?: number; reason?: string;
  timings?: { phase: string; startedAt: string; elapsedMs: number; remainingActiveMs: number; status: "completed" | "failed" }[];
  guideSelection?: { status: "skipped"; reason: "capture-time-exhausted"; remainingActiveMs: number; minimumActiveMs: number };
}

/** A timed-out DOM operation owns no reusable page: close it and await settlement. */
export async function boundedResearchDom<T>(page: Page, timeoutMs: number, phase: string, operation: () => Promise<T>): Promise<T> {
  const started = Date.now(), limit = Math.max(1, Math.floor(timeoutMs));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pending = Promise.resolve().then(operation);
  const outcome = pending.then(value => ({ kind: "value" as const, value }), error => ({ kind: "error" as const, error }));
  const expired = new Promise<{ kind: "timeout" }>(resolve => { timer = setTimeout(() => resolve({ kind: "timeout" }), limit); });
  try {
    const result = await Promise.race([outcome, expired]);
    if (result.kind === "timeout" || Date.now() - started >= limit) {
      // Closing interrupts a blocked evaluation/title read at the browser, not
      // just our wait for it. Do not start another capture while it is pending.
      await page.close({ runBeforeUnload: false, reason: `Research ${phase} deadline` }).catch(() => {});
      await outcome;
      throw new Error(`Research ${phase} exceeded its ${limit}ms DOM deadline; capture page closed`);
    }
    if (result.kind === "error") throw result.error;
    return result.value;
  } finally { if (timer) clearTimeout(timer); }
}

export interface ResearchHeading { text: string; followingText: string }
/** Retain introductory context and a real procedural section, without rewriting source claims. */
export function researchPageExcerpt(pageUrl: string, title: string, body: string, headings: readonly ResearchHeading[], limit = 7500): string {
  const header = `Source page: ${pageUrl}\nTitle: ${title}\n`, available = Math.max(0, limit - header.length);
  if (body.length <= available || available < 2000) return (header + body).slice(0, limit);
  const introduction = Math.min(1800, Math.floor(available / 3)), separator = "\n\n[Intervening source text omitted]\n\n";
  const action = /^(?:how to\b|step.by.step\b|getting started\b|creat(?:e|ing)\b|build(?:ing)?\b|configur(?:e|ing)\b|set(?:ting)? up\b|add(?:ing)?\b|edit(?:ing)?\b|publish(?:ing)?\b|filter(?:ing)?\b|segment(?:ing)?\b|send(?:ing)?\b|test(?:ing)?\b|using\b)/i;
  const candidates = headings.slice(0, 80).flatMap(heading => {
    if (!action.test(heading.text) || heading.text.length > 200 || heading.followingText.length < 40) return [];
    let offset = -1;
    while ((offset = body.indexOf(heading.text, offset + 1)) >= 0) {
      const end = offset + heading.text.length;
      if ((offset && body[offset - 1] !== "\n") || (body[end] && body[end] !== "\n")) continue;
      // A table of contents repeats headings but not their observed paragraph.
      if (!body.slice(end, end + 1400).includes(heading.followingText)) continue;
      return offset >= introduction ? [{ offset, priority: /^(?:how to|step.by.step)\b/i.test(heading.text) ? 1 : 0 }] : [];
    }
    return [];
  }).sort((a, b) => b.priority - a.priority || a.offset - b.offset);
  const focus = candidates[0]?.offset;
  // The ordinary prefix already retains an early procedural section.
  if (focus === undefined || focus < available / 2) return (header + body).slice(0, limit);
  return (header + body.slice(0, introduction) + separator + body.slice(focus, focus + available - introduction - separator.length)).slice(0, limit);
}

/** The model may choose only IDs in this bounded, observed documentation catalog. */
export function observedGuideCatalog(homepageUrl:string,discoveredOn:string,anchors:readonly ResearchAnchor[]):GuideCatalog {
  const catalog:GuideCatalog={version:1,homepageUrl,discoveredOn,entries:[]},seen=new Set<string>();
  for(const [index,anchor] of anchors.slice(0,300).entries()){
    const url=researchDestination(anchor.href,homepageUrl),anchorText=anchor.text.replace(/\s+/g," ").trim().slice(0,120);
    if(anchor.download||!url||!anchorText||[identity(homepageUrl),identity(discoveredOn)].includes(identity(url))||seen.has(identity(url)))continue;
    if(!/(?:^|\/)(?:docs?|user-docs|help|guides?|tutorials?|knowledge-base)(?:\/|$)/i.test(new URL(url).pathname))continue;
    seen.add(identity(url));
    const entry={id:`guide-${index+1}`,url,anchorText,anchorIndex:anchor.index??index};
    if(Buffer.byteLength(JSON.stringify({...catalog,entries:[...catalog.entries,entry]}),"utf8")>24000)continue;
    catalog.entries.push(entry);if(catalog.entries.length>=64)break;
  }
  return catalog;
}

export const MINIMUM_GUIDE_CAPTURE_MS = 12000;
export const RESEARCH_TEXT_WRITE_LIMIT_MS = 30000;

/** Keep actual capture time distinct from bounded local persistence and selector waits. */
export class ResearchCaptureClock {
  private started:number;private paused=0;private persisted=0;
  constructor(private now:()=>number=Date.now){this.started=now();}
  get elapsedMs(){return this.now()-this.started;}
  get selectionWaitMs(){return this.paused;}
  get persistedTextWaitMs(){return this.persisted;}
  get activeMs(){return this.elapsedMs-this.paused-this.persisted;}
  get remainingActiveMs(){return Math.max(0,30000-this.activeMs);}
  get canSelectGuide(){return this.remainingActiveMs>=MINIMUM_GUIDE_CAPTURE_MS;}
  remaining(maximum:number){const ms=30000-this.activeMs;if(ms<=0)throw new Error("Research scheduling limit reached");return Math.min(ms,maximum);}
  creditPersistedText(milliseconds:number){if(!Number.isFinite(milliseconds)||milliseconds<0||milliseconds>RESEARCH_TEXT_WRITE_LIMIT_MS)throw new Error("Invalid bounded source-text persistence time");this.persisted+=milliseconds;}
  async handoff<T>(operation:()=>Promise<T>):Promise<T>{const start=this.now();try{return await operation();}finally{this.paused+=this.now()-start;}}
}

type ResearchTextWriter = (path:string,text:string,options:{signal:AbortSignal})=>Promise<void>;
/** Only these two bounded source files qualify for local-I/O clock credit. */
export async function persistResearchText(workspace:string,index:number,excerpt:string,clock:ResearchCaptureClock,writer:ResearchTextWriter=writeFile,timeoutMs=RESEARCH_TEXT_WRITE_LIMIT_MS):Promise<void>{
  if(![1,2].includes(index)||excerpt.length>7500)throw new Error("Invalid bounded research text artifact");
  const limit=Number.isFinite(timeoutMs)?Math.min(RESEARCH_TEXT_WRITE_LIMIT_MS,Math.max(1,Math.floor(timeoutMs))):RESEARCH_TEXT_WRITE_LIMIT_MS;
  const controller=new AbortController(),started=clock.elapsedMs,timer=setTimeout(()=>controller.abort(),limit);
  try{
    // Native writeFile cancellation is best effort: await settlement even after
    // abort, so a partial write is never checkpointed or left racing capture.
    await writer(join(workspace,`analysis/research-page-${index}.txt`),excerpt,{signal:controller.signal});
    const elapsed=clock.elapsedMs-started;
    if(controller.signal.aborted||elapsed>limit)throw new Error("Research source-text persistence exceeded its local I/O deadline");
    clock.creditPersistedText(elapsed);
  }finally{clearTimeout(timer);}
}

export async function enrichProductResearch(page: Page, workspace: string, options: {
  homepageUrl: string; homepageTitle: string; homepageText: string;
  resolvedUrl: (browserUrl: string) => string;
  captureVisuals?: (page: Page, url: string, kind: ResearchLink["kind"], index: number, schedulingMs: number) => Promise<{ assets: Asset[]; artifactPaths: string[] }>;
  chooseGuide?: (context:{catalog:GuideCatalog;text:string;assets:Asset[];artifactPaths:string[]})=>Promise<GuideChoice>;
  checkpointGuide?: (choice:GuideChoice,catalog:GuideCatalog,selected?:ResearchLink)=>Promise<void>;
}): Promise<{ text: string; assets: Asset[]; artifactPaths: string[];guideProposal?:GuideChoice }> {
  if(options.chooseGuide&&!options.checkpointGuide)throw new Error("A guide selector requires a durable followup checkpoint");
  const clock=new ResearchCaptureClock();let guideProposal:GuideChoice|undefined,fatalHandoff=false;
  let text = options.homepageText.slice(0, 30_000);
  const assets: Asset[] = [], artifactPaths: string[] = [], sources: ResearchSourceRecord[] = [{ kind: "homepage", requestedUrl: options.homepageUrl, url: options.resolvedUrl(options.homepageUrl), title: options.homepageTitle, status: "captured", textPath: "analysis/product-source.txt", textCharacters: text.length }];
  const remaining = (maximum: number) => clock.remaining(maximum);
  const phase = async <T>(record: ResearchSourceRecord, name: string, operation: () => Promise<T>): Promise<T> => {
    const start = Date.now(), timing = { phase: name, startedAt: new Date(start).toISOString(), elapsedMs: 0, remainingActiveMs: Math.max(0, 30000 - clock.activeMs), status: "completed" as "completed" | "failed" };
    (record.timings ??= []).push(timing);
    try { return await operation(); }
    catch (error) { timing.status = "failed"; throw error; }
    finally { timing.elapsedMs = Date.now() - start; }
  };
  try {
    const anchors = await phase(sources[0], "homepage-link-discovery", () => boundedResearchDom(page, remaining(2000), "homepage link discovery", () => page.locator("a[href]").evaluateAll(nodes => nodes.slice(0, 300).map((node, index) => {
      const anchor = node as HTMLAnchorElement, box = anchor.getBoundingClientRect(), style = getComputedStyle(anchor);
      return { href: anchor.href.slice(0, 2049), text: style.display === "none" || style.visibility === "hidden" || !box.width || !box.height ? "" : anchor.innerText.slice(0, 120), download: anchor.hasAttribute("download"), index };
    }))));
    const links=selectResearchLinks(options.homepageUrl,anchors).map(link=>({...link,discoveredOn:options.homepageUrl}));
    for (let index=0; index<Math.min(2,links.length); index++) {
      const link=links[index];
      const record: ResearchSourceRecord = { kind: link.kind, requestedUrl: link.url, discoveredOn: link.discoveredOn, anchorText: link.anchorText, anchorIndex: link.anchorIndex, status: "skipped" };
      sources.push(record);
      if (clock.activeMs >= 30000) { record.reason = "Research scheduling limit reached"; continue; }
      try {
        // Deferred analytics or third-party scripts can hold DOMContentLoaded
        // after a useful server-rendered guide is readable. The guarded main
        // document must commit, then readable body evidence must appear.
        await phase(record, "navigation", () => page.goto(link.url, { waitUntil: "commit", timeout: remaining(12_000) }));
        await phase(record, "readable-body", () => page.waitForFunction(() => !!document.body && document.body.innerText.trim().length >= 150, undefined, { timeout: remaining(3500) }));
        await phase(record, "network-settle", () => page.waitForLoadState("networkidle", { timeout: remaining(2000) })).catch(() => {});
        const actualUrl = options.resolvedUrl(page.url());
        if (!researchDestination(actualUrl, options.homepageUrl)) throw new Error("Research page left the permitted public product hosts or path");
        record.url = actualUrl;
        const handoffPage = index === 0 && link.kind === "docs";
        const snapshot = await phase(record, "source-dom-snapshot", () => boundedResearchDom(page, remaining(2000), "source DOM snapshot", () => page.evaluate(({includeHeadings, includeAnchors}) => {
          const body = (document.body?.innerText || "").trim(), title = document.title.slice(0, 500);
          const headings: ResearchHeading[] = includeHeadings ? Array.from(document.querySelectorAll("h2,h3,h4")).slice(0, 80).map(node => {
            let followingText = "";
            for (let next = node.nextElementSibling, i = 0; next && i < 5; next = next.nextElementSibling, i++) {
              const observed = (next as HTMLElement).innerText?.trim() || "";
              if (!/^H[1-6]$/.test(next.tagName) && observed.length >= 40) { followingText = observed.slice(0, 180); break; }
            }
            return { text: (node as HTMLElement).innerText.trim().slice(0, 201), followingText };
          }) : [];
          const anchors: ResearchAnchor[] = includeAnchors ? Array.from(document.querySelectorAll("a[href]")).slice(0, 300).map((node, index) => {
            const anchor = node as HTMLAnchorElement, box = anchor.getBoundingClientRect(), style = getComputedStyle(anchor);
            return { href: anchor.href.slice(0, 2049), text: style.display === "none" || style.visibility === "hidden" || !box.width || !box.height ? "" : anchor.innerText.slice(0, 120), download: anchor.hasAttribute("download"), index };
          }) : [];
          return { body, title, headings, anchors };
        }, {includeHeadings:link.kind === "docs",includeAnchors:handoffPage})));
        const { body, headings } = snapshot; record.title = snapshot.title;
        if (body.length < 150 || /^(access denied|checking your browser|just a moment)/i.test(body)) throw new Error("Research page did not expose enough readable public product information");
        const allowance = Math.min(7500, 45_000 - text.length - 2);
        const excerpt = researchPageExcerpt(actualUrl, record.title, body, headings, allowance);
        const textPath = `analysis/research-page-${index + 1}.txt`;
        await phase(record, "text-persistence", () => persistResearchText(workspace,index+1,excerpt,clock));
        artifactPaths.push(textPath); text += "\n\n" + excerpt;
        Object.assign(record, { status: "captured", textPath, textCharacters: excerpt.length });
        // Use the caller's remaining focused-asset capacity and shared safe downloader.
        if (options.captureVisuals && link.kind !== "pricing") {
          try { const focused = await phase(record, "focused-images", () => options.captureVisuals!(page, actualUrl, link.kind, index + 1, remaining(7000))); assets.push(...focused.assets); artifactPaths.push(...focused.artifactPaths); }
          catch (error) { record.reason = `Text retained; focused visuals unavailable: ${error instanceof Error ? error.message.slice(0, 250) : "capture failed"}`; }
        }
        try {
          // Preserve the first documentation page for its next guide navigation.
          // Optional animation/style work must not close that handoff page.
          if (!handoffPage) await phase(record, "viewport-prepare", () => boundedResearchDom(page, remaining(1500), "viewport preparation", async () => {
            await page.evaluate(() => { window.scrollTo(0, 0); for (const animation of document.getAnimations()) { try { if (animation.effect?.getComputedTiming().iterations !== Infinity) animation.finish(); } catch {} } });
            await page.addStyleTag({ content: "*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}" });
          }));
          const imagePath = `assets/research-page-${index + 1}.jpg`;
          await phase(record, "viewport-image", () => page.screenshot({ path: join(workspace, imagePath), type: "jpeg", quality: 90, timeout: remaining(2500) }));
          const viewport = page.viewportSize();
          if (!viewport) throw new Error("Research capture viewport dimensions are unavailable");
          record.imagePath = imagePath; artifactPaths.push(imagePath);
          assets.push({ id: `research-page-${index + 1}`, path: imagePath, preview: imagePath, kind: "image", usage: "output", width: viewport.width, height: viewport.height, source: actualUrl, rights: "Viewport capture of a public page linked by the submitted product page; not an authenticated application recording.",
            provenance: { pageUrl: actualUrl, pageKind: link.kind, method: "viewport", role: "marketing", sectionHeading: record.title } });
        } catch (error) { record.reason = `Text retained; picture unavailable: ${error instanceof Error ? error.message.slice(0, 300) : "capture failed"}`; }
        if(index===0&&link.kind==="docs"){
          const nested=snapshot.anchors;
          if(options.chooseGuide){
            if(!clock.canSelectGuide){
              record.guideSelection={status:"skipped",reason:"capture-time-exhausted",remainingActiveMs:clock.remainingActiveMs,minimumActiveMs:MINIMUM_GUIDE_CAPTURE_MS};
              // No model proposal or evidence approval was obtained. Retain the
              // actual prefix and skip a guide call that cannot use its answer.
              links.splice(1);continue;
            }
            if(page.isClosed())throw new Error("Research guide handoff page closed before selection");fatalHandoff=true;
            const catalog=observedGuideCatalog(options.homepageUrl,actualUrl,nested);
            await clock.handoff(async()=>{
              const choice=await options.chooseGuide!({catalog:structuredClone(catalog),text,assets:[...assets],artifactPaths:[...artifactPaths]});
              let selected:ResearchLink|undefined;
              if(choice.decision==="capture-guide"){
                const entry=catalog.entries.find(entry=>entry.id===choice.guideId);
                if(!entry||researchDestination(entry.url,options.homepageUrl)!==entry.url)throw new Error("The selected guide does not match an observed permitted catalog entry");
                selected={url:entry.url,kind:"docs",anchorText:entry.anchorText,anchorIndex:entry.anchorIndex};
              }else if(!["use-current","insufficient"].includes(choice.decision))throw new Error("The guide selection decision is invalid");
              await options.checkpointGuide!(choice,catalog,selected);
              guideProposal=choice;
              if(selected)links[1]={...selected,discoveredOn:actualUrl};else links.splice(1);
            });
            fatalHandoff=false;
          }else{
            const followup=selectDocumentationFollowup(options.homepageUrl,actualUrl,nested,options.homepageText);
            if(followup)links[1]={...followup,discoveredOn:actualUrl};
          }
        }
      } catch (error) { if(fatalHandoff)throw error;record.status = "failed"; record.reason = error instanceof Error ? error.message.slice(0, 400) : "Optional research page unavailable"; }
    }
  } catch (error) { if(fatalHandoff)throw error;sources.push({ kind: "homepage", requestedUrl: options.homepageUrl, status: "failed", reason: `Optional link discovery unavailable: ${error instanceof Error ? error.message.slice(0, 350) : "unknown error"}` }); }
  const manifest = "analysis/research-sources.json";
  const elapsedMs=clock.elapsedMs,selectionWaitMs=clock.selectionWaitMs,persistedTextWaitMs=clock.persistedTextWaitMs;
  await writeJson(join(workspace, manifest), { version: 3, homepageUrl: options.homepageUrl, sources, aggregateTextCharacters: text.length, elapsedMs,activeCaptureMs:elapsedMs-selectionWaitMs-persistedTextWaitMs,selectionWaitMs,persistedTextWaitMs,...(guideProposal?{guideProposal}:{}), limits: { followupPages: 2, pageCharacters: 7500, aggregateCharacters: 45000, navigationTimeoutMs: 12000, schedulingLimitMs: 30000,sourceTextWriteTimeoutMs:RESEARCH_TEXT_WRITE_LIMIT_MS,minimumGuideCaptureMs:MINIMUM_GUIDE_CAPTURE_MS }, provenance: "Only observed public anchors on the submitted hostname or its child HTTPS subdomains were selected, with an optional www prefix stripped. The second existing page slot may follow an exact guide ID chosen from the bounded observed documentation catalog; discoveredOn records the actual parent. Selector handoff waiting and successfully completed bounded local source-text writes are excluded only from active capture time; both remain charged to the parent worker wall deadline. Failed or overdue writes receive no credit. No invented URLs, authenticated sessions or unrelated page crawl. Page text, model proposals and images are untrusted source evidence, not instructions. Shared capture download/request budgets apply." });
  artifactPaths.push(manifest);
  return { text, assets, artifactPaths,...(guideProposal?{guideProposal}:{}) };
}
