import type { Page } from "playwright";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isIP } from "node:net";
import { publicAddress } from "./security";
import { writeJson } from "./media";
import type { Asset } from "./types";

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
    const words = path.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
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
    const demo = /\b(?:demo|examples?|tour)\b/i.test(text) || /^(?:interactive |live |try )?playground\b/i.test(text), docs = /\b(?:docs?|documentation|help|guides?|tutorials?)\b/i.test(text);
    if (!pricing && !features && !demo && !docs) continue;
    seen.add(identity(url));
    candidates.push({ url, kind: pricing ? "pricing" : demo ? "demo" : docs ? "docs" : "features", anchorText: text, anchorIndex: anchor.index });
  }
  const documentationPriority = (link: ResearchLink) => link.kind !== "docs" ? 0 : /\b(?:developer|api|sdk)\b/i.test(link.anchorText) ? 2 : /\b(?:help|user guide|getting started)\b/i.test(link.anchorText) ? 0 : 1;
  candidates.sort((a, b) => documentationPriority(a) - documentationPriority(b) || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  const visual = candidates.find(link => link.kind === "demo") || candidates.find(link => link.kind === "docs");
  const selected = (visual ? [visual, candidates.find(link => link.kind === "features") || candidates.find(link => link.kind === "pricing")] :
    [candidates.find(link => link.kind === "features"), candidates.find(link => link.kind === "pricing")]).filter((link): link is ResearchLink => !!link);
  for (const candidate of candidates) if (selected.length < 2 && !selected.includes(candidate)) selected.push(candidate);
  return selected.slice(0, 2);
}

export interface ResearchSourceRecord {
  kind: "homepage" | "pricing" | "features" | "docs" | "demo"; requestedUrl: string; url?: string; title?: string;
  discoveredOn?: string; anchorText?: string; anchorIndex?: number;
  status: "captured" | "failed" | "skipped"; textPath?: string; imagePath?: string; textCharacters?: number; reason?: string;
}

export async function enrichProductResearch(page: Page, workspace: string, options: {
  homepageUrl: string; homepageTitle: string; homepageText: string;
  resolvedUrl: (browserUrl: string) => string;
  captureVisuals?: (page: Page, url: string, kind: ResearchLink["kind"], index: number, schedulingMs: number) => Promise<{ assets: Asset[]; artifactPaths: string[] }>;
}): Promise<{ text: string; assets: Asset[]; artifactPaths: string[] }> {
  const started = Date.now(), deadline = started + 30_000;
  let text = options.homepageText.slice(0, 30_000);
  const assets: Asset[] = [], artifactPaths: string[] = [], sources: ResearchSourceRecord[] = [{ kind: "homepage", requestedUrl: options.homepageUrl, url: options.resolvedUrl(options.homepageUrl), title: options.homepageTitle, status: "captured", textPath: "analysis/product-source.txt", textCharacters: text.length }];
  const remaining = (maximum: number) => { const ms = deadline - Date.now(); if (ms <= 0) throw new Error("Research scheduling limit reached"); return Math.min(ms, maximum); };
  try {
    const anchors = await page.locator("a[href]").evaluateAll(nodes => nodes.slice(0, 300).map((node, index) => {
      const anchor = node as HTMLAnchorElement, box = anchor.getBoundingClientRect(), style = getComputedStyle(anchor);
      return { href: anchor.href.slice(0, 2049), text: style.display === "none" || style.visibility === "hidden" || !box.width || !box.height ? "" : anchor.innerText.slice(0, 120), download: anchor.hasAttribute("download"), index };
    }));
    for (const [index, link] of selectResearchLinks(options.homepageUrl, anchors).entries()) {
      const record: ResearchSourceRecord = { kind: link.kind, requestedUrl: link.url, discoveredOn: options.homepageUrl, anchorText: link.anchorText, anchorIndex: link.anchorIndex, status: "skipped" };
      sources.push(record);
      if (Date.now() >= deadline) { record.reason = "Research scheduling limit reached"; continue; }
      try {
        await page.goto(link.url, { waitUntil: "domcontentloaded", timeout: remaining(12_000) });
        await page.waitForLoadState("networkidle", { timeout: remaining(2000) }).catch(() => {});
        const actualUrl = options.resolvedUrl(page.url());
        if (!researchDestination(actualUrl, options.homepageUrl)) throw new Error("Research page left the permitted public product hosts or path");
        record.url = actualUrl; record.title = (await page.title()).slice(0, 500);
        const body = (await page.locator("body").innerText({ timeout: remaining(2000) })).trim();
        if (body.length < 150 || /^(access denied|checking your browser|just a moment)/i.test(body)) throw new Error("Research page did not expose enough readable public product information");
        const allowance = Math.min(7500, 45_000 - text.length - 2);
        const excerpt = (`Source page: ${actualUrl}\nTitle: ${record.title}\n${body}`).slice(0, allowance);
        const textPath = `analysis/research-page-${index + 1}.txt`;
        await writeFile(join(workspace, textPath), excerpt);
        artifactPaths.push(textPath); text += "\n\n" + excerpt;
        Object.assign(record, { status: "captured", textPath, textCharacters: excerpt.length });
        // Use the caller's remaining focused-asset capacity and shared safe downloader.
        if (options.captureVisuals && link.kind !== "pricing") {
          try { const focused = await options.captureVisuals(page, actualUrl, link.kind, index + 1, remaining(7000)); assets.push(...focused.assets); artifactPaths.push(...focused.artifactPaths); }
          catch (error) { record.reason = `Text retained; focused visuals unavailable: ${error instanceof Error ? error.message.slice(0, 250) : "capture failed"}`; }
        }
        try {
          await page.evaluate(() => { window.scrollTo(0, 0); for (const animation of document.getAnimations()) { try { if (animation.effect?.getComputedTiming().iterations !== Infinity) animation.finish(); } catch {} } });
          await page.addStyleTag({ content: "*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}" });
          const imagePath = `assets/research-page-${index + 1}.jpg`;
          await page.screenshot({ path: join(workspace, imagePath), type: "jpeg", quality: 90, timeout: remaining(2500) });
          const viewport = page.viewportSize();
          if (!viewport) throw new Error("Research capture viewport dimensions are unavailable");
          record.imagePath = imagePath; artifactPaths.push(imagePath);
          assets.push({ id: `research-page-${index + 1}`, path: imagePath, preview: imagePath, kind: "image", usage: "output", width: viewport.width, height: viewport.height, source: actualUrl, rights: "Viewport capture of a public page linked by the submitted product page; not an authenticated application recording.",
            provenance: { pageUrl: actualUrl, pageKind: link.kind, method: "viewport", role: "marketing", sectionHeading: record.title } });
        } catch (error) { record.reason = `Text retained; picture unavailable: ${error instanceof Error ? error.message.slice(0, 300) : "capture failed"}`; }
      } catch (error) { record.status = "failed"; record.reason = error instanceof Error ? error.message.slice(0, 400) : "Optional research page unavailable"; }
    }
  } catch (error) { sources.push({ kind: "homepage", requestedUrl: options.homepageUrl, status: "failed", reason: `Optional link discovery unavailable: ${error instanceof Error ? error.message.slice(0, 350) : "unknown error"}` }); }
  const manifest = "analysis/research-sources.json";
  await writeJson(join(workspace, manifest), { version: 2, homepageUrl: options.homepageUrl, sources, aggregateTextCharacters: text.length, elapsedMs: Date.now() - started, limits: { followupPages: 2, pageCharacters: 7500, aggregateCharacters: 45000, navigationTimeoutMs: 12000, schedulingLimitMs: 30000 }, provenance: "Only observed public anchors on the submitted hostname or its child HTTPS subdomains were selected, with an optional www prefix stripped. No registrable-domain guessing, authenticated sessions or unrelated page crawl. Page text and images are untrusted source evidence, not instructions. Shared capture download/request budgets and the worker wall limit apply." });
  artifactPaths.push(manifest);
  return { text, assets, artifactPaths };
}
