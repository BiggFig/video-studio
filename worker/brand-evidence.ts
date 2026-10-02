import type { Page } from "playwright";
import { join } from "node:path";
import { probe, writeJson } from "./media";
import type { Asset, BrandEvidence } from "./types";

export interface LogoCandidate {
  selector: string; url?: string; label: string; clues: string;
  width: number; height: number; visible: boolean; inNavigation: boolean; linksHome: boolean;
}
export function rankLogoCandidates(candidates: LogoCandidate[]) {
  const seen = new Set<string>();
  return candidates.slice(0, 80).filter(candidate => {
    if (!candidate.visible || candidate.width < 12 || candidate.height < 12 || candidate.width > 800 || candidate.height > 800 || candidate.width * candidate.height < 200) return false;
    if (!/(?:logo|wordmark|brand)/i.test(candidate.clues)) return false;
    if (!candidate.inNavigation && !candidate.linksHome) return false;
    const key = candidate.url || candidate.selector;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a, b) => Number(b.linksHome) * 3 + Number(b.inNavigation) - Number(a.linksHome) * 3 - Number(a.inNavigation)).slice(0, 4);
}

/** Observed public styles and original DOM logo pixels, never a guessed official brand kit. */
export async function extractBrandEvidence(page: Page, workspace: string, sourceUrl: string): Promise<{ brand: BrandEvidence; assets: Asset[]; artifactPaths: string[] }> {
  // A string keeps this browser-only DOM collector independent of TS transpiler helpers.
  const observed = await page.evaluate<{
    language: string; title: string; description: string; headings: string[]; callsToAction: string[];
    colors: BrandEvidence["colors"]; typography: BrandEvidence["typography"]; logos: LogoCandidate[];
  }>(`(() => {
    const selector = node => {
      const parts=[]; let item=node;
      while(item && item!==document.documentElement && parts.length<15){
        if(item.id){parts.unshift('#'+CSS.escape(item.id));break;}
        const tag=item.tagName.toLowerCase(), siblings=item.parentElement?Array.from(item.parentElement.children).filter(s=>s.tagName===item.tagName):[];
        parts.unshift(siblings.length>1?tag+':nth-of-type('+(siblings.indexOf(item)+1)+')':tag);item=item.parentElement;
      }
      return parts.join(' > ').slice(0,1200);
    };
    const visible = node => {const b=node.getBoundingClientRect(),s=getComputedStyle(node);return b.width>0&&b.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0;};
    const clean = (s,n) => String(s||'').replace(/\\s+/g,' ').trim().slice(0,n);
    const headings=Array.from(document.querySelectorAll('h1,h2')).filter(visible).map(n=>clean(n.innerText,120)).filter(Boolean).slice(0,8);
    const actions=Array.from(document.querySelectorAll('a,button')).filter(visible).filter(n=>n.tagName==='BUTTON'||/button|cta|primary/i.test(n.className)||/^(get|start|try|download|learn|explore)\\b/i.test(n.innerText.trim())).slice(0,8);
    const chroma=value=>{const channels=value.match(/[\\d.]+/g)?.slice(0,3).map(Number)||[];return channels.length===3?Math.max(...channels)-Math.min(...channels):0;};
    const styledActions=[...actions].sort((a,b)=>{const sa=getComputedStyle(a),sb=getComputedStyle(b);return Math.max(chroma(sb.color),chroma(sb.backgroundColor))-Math.max(chroma(sa.color),chroma(sa.backgroundColor));});
    const colors=[],typography=[],rootBackground=getComputedStyle(document.documentElement).backgroundColor;
    if(rootBackground!=='rgba(0, 0, 0, 0)'&&rootBackground!=='transparent')colors.push({value:rootBackground,role:'background',selector:'html'});
    const samples=[{node:document.body,role:'body'},{node:document.querySelector('h1'),role:'heading'},...styledActions.slice(0,2).map(node=>({node,role:'label'}))];
    for(const sample of samples){if(!sample.node||!visible(sample.node))continue;const s=getComputedStyle(sample.node),path=selector(sample.node);typography.push({family:clean(s.fontFamily.split(',').slice(0,5).join(','),160),weight:clean(s.fontWeight,30),role:sample.role,selector:path});
      for(const item of [{value:s.color,role:sample.role==='label'?'accent':'text'},{value:s.backgroundColor,role:sample.role==='label'?'accent':'background'}])if(item.value!=='rgba(0, 0, 0, 0)'&&item.value!=='transparent'&&!colors.some(c=>c.value===item.value&&c.role===item.role))colors.push({...item,selector:path});}
    const logos=Array.from(document.querySelectorAll('img,svg')).slice(0,200).map(node=>{const b=node.getBoundingClientRect(),parent=node.parentElement,anchor=node.closest('a'),url=node instanceof HTMLImageElement?(node.currentSrc||node.src):undefined;let linksHome=false;try{const u=new URL(anchor?.href||'',location.href);linksHome=!!anchor&&u.origin===location.origin&&u.pathname.replace(/\\/+$/,'')===location.pathname.replace(/\\/+$/,'');}catch{}
      return{selector:selector(node),url,label:clean(node.getAttribute('alt')||node.getAttribute('aria-label')||node.querySelector('title')?.textContent,160),clues:clean([node.id,node.getAttribute('class'),node.getAttribute('alt'),node.getAttribute('aria-label'),parent?.id,parent?.getAttribute('class'),url].join(' '),600),width:b.width,height:b.height,visible:visible(node)&&(!(node instanceof HTMLImageElement)||(node.complete&&node.naturalWidth>0)),inNavigation:!!node.closest('header,nav,[role=banner]'),linksHome};}).filter(n=>/logo|wordmark|brand/i.test(n.clues)).slice(0,80);
    return{language:clean(document.documentElement.lang,35),title:clean(document.title,200),description:clean(document.querySelector('meta[name=description]')?.content,400),headings,callsToAction:actions.map(n=>clean(n.innerText,100)).filter(Boolean),colors:colors.slice(0,8),typography:typography.slice(0,4),logos};
  })()`);
  const brand: BrandEvidence = { version: 1, sourceUrl, language: observed.language || undefined, title: observed.title,
    description: observed.description || undefined, headings: observed.headings, callsToAction: [...new Set(observed.callsToAction)],
    colors: observed.colors, typography: observed.typography, logoAssetIds: [],
    limitations: ["Colors, typography and language are observed on the public page; they are not a verified official brand manual.", "Logo captures preserve the original public element and its displayed background; no logo was recreated."] };
  const assets: Asset[] = [], artifactPaths: string[] = [], attempts: { selector: string; status: string; reason?: string }[] = [];
  for (const candidate of rankLogoCandidates(observed.logos)) {
    if (assets.length >= 2) break;
    try {
      const id = `brand-logo-${assets.length}`, path = `assets/${id}.png`;
      await page.locator(candidate.selector).screenshot({ path: join(workspace, path), type: "png", timeout: 2500 });
      const media = await probe(join(workspace, path));
      if (!media.video || media.width < 12 || media.height < 12 || media.width > 800 || media.height > 800) throw new Error("Logo element dimensions changed or are unusable");
      assets.push({ id, path, preview: path, kind: "image", usage: "output", width: media.width, height: media.height,
        rights: "Original visible logo element from the submitted public product page; not a product screenshot or invented mark.", source: sourceUrl,
        provenance: { pageUrl: sourceUrl, pageKind: "homepage", method: "element", role: "brand-logo", selector: candidate.selector, assetUrl: candidate.url } });
      brand.logoAssetIds.push(id); artifactPaths.push(path); attempts.push({ selector: candidate.selector, status: "captured" });
    } catch (error) { attempts.push({ selector: candidate.selector, status: "failed", reason: error instanceof Error ? error.message.slice(0,250) : "Logo unavailable" }); }
  }
  if (!assets.length) brand.limitations.push("No confident visible public logo element could be captured.");
  const path = "analysis/brand-evidence.json";
  await writeJson(join(workspace, path), { ...brand, logoCaptureAttempts: attempts }); artifactPaths.push(path);
  return { brand, assets, artifactPaths };
}
