import Link from "next/link";

export function Brand({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return <Link className={`brand${compact ? " brand-compact" : ""}`} href={href} aria-label="Video Studio home">
    <span className="brand-mark" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M5 6.5a2 2 0 0 1 3-1.73l13 7.5a1 1 0 0 1 0 1.73l-13 7.5a2 2 0 0 1-3-1.73V6.5Z" fill="currentColor"/><path d="M10 8.8v8.4" stroke="var(--brand-cutout)" strokeWidth="2" strokeLinecap="round"/></svg></span>
    <span>Video Studio<span className="brand-beta">Beta</span></span>
  </Link>;
}

export function FilmArtwork({ compact = false }: { compact?: boolean }) {
  return <div className={`film-artwork${compact ? " compact" : ""}`} aria-hidden="true">
    <div className="art-orbit art-orbit-one"/><div className="art-orbit art-orbit-two"/>
    <div className="art-product-window"><div className="art-window-toolbar"><i/><i/><i/><span>your next big thing</span></div>
      <div className="art-window-body"><div className="art-mini-sidebar"><b/><i/><i/><i/></div><div className="art-mini-content"><div className="art-mini-eyebrow"/><div className="art-mini-title"/><div className="art-mini-title short"/><div className="art-mini-cards"><span/><span/><span/></div><div className="art-mini-chart"><i/><i/><i/><i/><i/><i/><i/></div></div></div>
    </div>
    <div className="art-title-card"><span>Good products.</span><strong>Great entrances.</strong><div className="art-title-line"/></div>
    <div className="art-cursor"><svg width="23" height="27" viewBox="0 0 23 27" fill="none"><path d="M2 2 21 15l-10 2-5 8L2 2Z" fill="white" stroke="#8270C8" strokeWidth="2" strokeLinejoin="round"/></svg></div>
    <span className="art-caption">A little context. A lot of possibility.</span>
  </div>;
}
