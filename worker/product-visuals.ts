import type { Page } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { frameIndex, probe, writeJson } from "./media";
import { safeDestination } from "./security";
import type { Asset } from "./types";

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
}
interface SourceRecord {
  selector: string; url: string; alt: string; status: "accepted" | "skipped";
  method?: "element" | "source-image"; sectionHeading?: string;
  reason?: string; originalPath?: string; outputPath?: string; previewPath?: string; sha256?: string;
  sourceWidth?: number; sourceHeight?: number; outputWidth?: number; outputHeight?: number; previewWidth?: number; previewHeight?: number;
}

export interface ProductPanelCandidate {
  selector: string; clues: string; heading: string; visible: boolean;
  x: number; y: number; width: number; height: number; children: number; media: number;
}
/** Candidate labels are discovery hints only; downstream visual research must confirm real UI. */
export function rankProductPanelCandidates(input: ProductPanelCandidate[]) {
  const clues = /(?:^|[\s_-])(?:app|application|screenshot|screen|demo|editor|workspace|canvas|graph|kanban|interface|mockup|preview|window)(?:$|[\s_-])/i;
  const ranked = input.slice(0, 100).filter(candidate => candidate.visible && clues.test(candidate.clues) &&
    !/logo|testimonial|pricing|cookie|consent|login|sign[-_ ]?in/i.test(candidate.clues) &&
    candidate.width >= 260 && candidate.height >= 170 && candidate.width <= 2000 && candidate.height <= 1500 &&
    candidate.width * candidate.height >= 120_000 && candidate.width / candidate.height >= .35 && candidate.width / candidate.height <= 4 &&
    (candidate.children >= 3 || candidate.media > 0))
    .sort((a, b) => b.width * b.height - a.width * a.height || a.selector.localeCompare(b.selector));
  const selected: ProductPanelCandidate[] = [];
  for (const candidate of ranked) {
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

async function productPanels(page: Page, workspace: string, pageUrl: string, prefix: string, pageKind: NonNullable<Asset["provenance"]>["pageKind"], limit: number, deadline: number) {
  const candidates = await page.evaluate<ProductPanelCandidate[]>(`(() => {
    const result=[];const nodes=Array.from(document.querySelectorAll('figure,section,[role=img],[class],[id],[aria-label]')).slice(0,1800);
    for(const node of nodes){
      const clues=[node.id,node.getAttribute('class'),node.getAttribute('aria-label')].join(' ').slice(0,600);
      if(!/(?:^|[\\s_-])(?:app|application|screenshot|screen|demo|editor|workspace|canvas|graph|kanban|interface|mockup|preview|window)(?:$|[\\s_-])/i.test(clues))continue;
      const box=node.getBoundingClientRect(),style=getComputedStyle(node);if(box.width<260||box.height<170)continue;
      const parts=[];let item=node;while(item&&item!==document.documentElement&&parts.length<20){if(item.id){parts.unshift('#'+CSS.escape(item.id));break;}const tag=item.tagName.toLowerCase(),siblings=item.parentElement?Array.from(item.parentElement.children).filter(s=>s.tagName===item.tagName):[];parts.unshift(siblings.length>1?tag+':nth-of-type('+(siblings.indexOf(item)+1)+')':tag);item=item.parentElement;}
      let section=node,heading='';for(let i=0;section&&i<5;i++,section=section.parentElement){const title=section.querySelector('h1,h2,h3');if(title){heading=title.textContent.replace(/\\s+/g,' ').trim().slice(0,160);break;}}
      result.push({selector:parts.join(' > ').slice(0,1200),clues,heading,visible:style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0,x:box.x+scrollX,y:box.y+scrollY,width:box.width,height:box.height,children:node.children.length,media:node.querySelectorAll('img,svg,canvas,video').length});if(result.length>=100)break;
    }return result;
  })()`);
  const assets: Asset[] = [], artifactPaths: string[] = [], sources: SourceRecord[] = [];
  for (const candidate of rankProductPanelCandidates(candidates)) {
    if (assets.length >= limit || Date.now() >= deadline) break;
    const record: SourceRecord = { selector: candidate.selector, url: pageUrl, alt: candidate.heading, sectionHeading: candidate.heading, method: "element", status: "skipped" }; sources.push(record);
    try {
      const id = `${prefix}-panel-${assets.length}`, path = `assets/${id}.jpg`, preview = `analysis/${id}.jpg`;
      await page.locator(candidate.selector).screenshot({ path: join(workspace, path), type: "jpeg", quality: 92, timeout: Math.max(1, Math.min(3000, deadline - Date.now())) });
      const media = await probe(join(workspace, path));
      if (!media.video || media.width < 260 || media.height < 170 || media.width > 2000 || media.height > 1500) throw new Error("Product panel dimensions changed or are unusable");
      const width = Math.max(2, Math.floor(Math.min(1600, 1600 * media.width / media.height) / 2) * 2);
      await frameIndex(join(workspace, path), join(workspace, preview), 0, width);
      const previewMedia = await probe(join(workspace, preview));
      assets.push({ id, path, preview, kind: "image", usage: "output", width: media.width, height: media.height, source: pageUrl,
        rights: "Unaltered element capture of a product-related panel published on a public page; a visual candidate, not an authenticated workflow or proof of interaction.",
        provenance: { pageUrl, pageKind, method: "element", role: pageKind === "pricing" ? "marketing" : "product-ui-candidate", selector: candidate.selector, sectionHeading: candidate.heading } });
      artifactPaths.push(path, preview);Object.assign(record,{status:"accepted",outputPath:path,previewPath:preview,outputWidth:media.width,outputHeight:media.height,previewWidth:previewMedia.width,previewHeight:previewMedia.height});
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
  const positive = /screenshot|screen[-_ ]?shot|dashboard|workspace|interface|editor|product[-_ ]?(preview|image)|app[-_ ]?(preview|screen)|browser|desktop|mobile|canvas|kanban|whiteboard|publish|diagram|graph|preview|demo/i;
  const negative = /(?:^|[\s/_\-.])(logo|icon|avatar|badge|sprite|headshot|portrait|testimonial)(?:$|[\s/_\-.])/i;
  return input.slice(0, 200).flatMap((candidate) => {
    if (!candidate.visible || !publicProtocol(candidate.url) || candidate.displayedWidth < 220 || candidate.displayedHeight < 140) return [];
    const width = candidate.naturalWidth || candidate.declaredWidth, height = candidate.naturalHeight || candidate.declaredHeight;
    if (!reasonableRaster(width, height)) return [];
    const clues = `${candidate.alt} ${candidate.url} ${candidate.classes}`;
    if (negative.test(clues) || !positive.test(clues)) return [];
    const url = new URL(candidate.url); url.hash = "";
    if (seen.has(url.href)) return []; seen.add(url.href);
    const score = (positive.test(candidate.alt) ? 4 : 0) + (positive.test(url.pathname) ? 3 : 0) + (positive.test(candidate.classes) ? 1 : 0) + Math.min(2, (width * height) / 1_000_000);
    return [{ ...candidate, url: url.href, score }];
  }).sort((a, b) => b.score - a.score).slice(0, 12);
}

function rasterExtension(bytes: Buffer, contentType: string): "png" | "jpg" | "webp" | null {
  const type = contentType.split(";", 1)[0].trim().toLowerCase();
  if (type === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (["image/jpeg", "image/jpg"].includes(type) && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpg";
  if (type === "image/webp" && bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") return "webp";
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
  const elements = await page.locator("img").evaluateAll((nodes) => nodes.slice(0, 200).map((node) => {
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
    return { url: (image.currentSrc || image.src).slice(0, 2049), selector: parts.join(" > ").slice(0, 1200), alt: image.alt.slice(0, 500), classes: `${image.className} ${image.parentElement?.className || ""}`.slice(0, 600), naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, displayedWidth: box.width, displayedHeight: box.height, declaredWidth: Number(image.getAttribute("width")), declaredHeight: Number(image.getAttribute("height")), visible: style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && box.width > 0 && box.height > 0 };
  }));
  const candidates = rankProductImageCandidates(elements);
  const result: ProductVisualResult = { assets: [], artifactPaths: [], diagnostics: { pageUrl, inspectedElements: elements.length, eligibleCandidates: candidates.length, attempts: 0, reservedBytes: 0, downloadedBytes: 0, elapsedMs: 0, schedulingLimitReached: false, timePolicy: "20-second default scheduling limit; existing safeDownload inactivity timeout and outer worker wall limit remain authoritative for in-flight work.", sources: [] } };
  const hashes = new Set<string>();
  await mkdir(join(workspace, "assets"), { recursive: true });
  await mkdir(join(workspace, "analysis"), { recursive: true });
  if ((options.maxPanels ?? 2) > 0 && pageKind !== "pricing") {
    try { const panels = await productPanels(page, workspace, pageUrl, prefix, pageKind, Math.min(2,maxAssets,options.maxPanels ?? 2), started + schedulingLimit);
      result.assets.push(...panels.assets);result.artifactPaths.push(...panels.artifactPaths);result.diagnostics.sources.push(...panels.sources);
    } catch (error) { result.diagnostics.sources.push({ selector: "", url: pageUrl, alt: "", method: "element", status: "skipped", reason: error instanceof Error ? error.message.slice(0,300) : "Optional product panels unavailable" }); }
  }
  for (const candidate of candidates) {
    if (result.assets.length >= maxAssets || result.diagnostics.attempts >= maxAttempts || result.diagnostics.reservedBytes >= maxTotalBytes) break;
    if (Date.now() - started >= schedulingLimit) { result.diagnostics.schedulingLimitReached = true; break; }
    const reservation = Math.min(maxFileBytes, maxTotalBytes - result.diagnostics.reservedBytes);
    const source: SourceRecord = { selector: candidate.selector, url: candidate.url, alt: candidate.alt, method: "source-image", status: "skipped" };
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
