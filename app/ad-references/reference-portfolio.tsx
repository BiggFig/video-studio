'use client';

import { useState } from 'react';
import type { AdReference, HookType } from '@/lib/ad-references/types';
import { hookLabels } from '@/lib/ad-references/types';
import { observedDate, timecode } from '@/lib/ad-references/format';
import styles from './page.module.css';

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}<span aria-hidden="true">↗</span><span className="visually-hidden"> (opens in a new tab)</span></a>;
}

function ReferenceCard({ reference, index }: { reference: AdReference; index: number }) {
  const heading = `${reference.id}-title`;
  return <article className={styles.card} id={reference.id} aria-labelledby={heading}>
    <div className={styles.cardHeading}>
      <div className={styles.advertiser}><span className={styles.cardIndex}>{(index + 1).toString().padStart(2, '0')}</span>{reference.advertiser}</div>
      <span className={styles.sourceBadge}>{reference.sourceType === 'direct-meta' ? 'Meta Ad Library' : 'Ad archive'}</span>
    </div>
    {reference.poster ? <figure className={styles.storyboard}>
      {/* Local, coordinator-approved criticism excerpts only; never remote video or tracking embeds. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <a href={reference.poster.src} target="_blank" rel="noopener noreferrer" aria-label={`Enlarge storyboard for ${reference.advertiser}: ${reference.title}`}>
        <img src={reference.poster.src} alt={reference.poster.alt} loading="lazy" decoding="async" />
      </a>
      <figcaption>{reference.poster.caption} <a href={reference.poster.src} target="_blank" rel="noopener noreferrer">Enlarge storyboard ↗</a></figcaption>
    </figure> : <div className={styles.textPreview}>
      <span className={styles.previewLabel}>The opening / {timecode(reference.hook.startSeconds)}–{timecode(reference.hook.endSeconds)}</span>
      <p>{reference.hook.description}</p>
      <span className={styles.previewFoot}>Text study · Watch the original at its source <span aria-hidden="true">↗</span></span>
    </div>}
    <div className={styles.cardBody}>
      <div className={styles.cardMeta}><span>{hookLabels[reference.hook.type]}</span><span>{timecode(reference.durationSeconds)} video</span></div>
      <h2 id={heading}>{reference.title}</h2>
      <div className={styles.hookNote}><h3>The hook <span>{timecode(reference.hook.startSeconds)}–{timecode(reference.hook.endSeconds)}</span></h3><p>{reference.hook.description}</p></div>
      <div className={styles.mechanism}><h3>What drives the idea</h3><p>{reference.mechanism}</p></div>
      <details className={styles.breakdown}>
        <summary><span>Scene-by-scene breakdown <small>{reference.scenes.length} scenes</small></span><span className={styles.disclosure} aria-hidden="true">+</span></summary>
        <div className={styles.breakdownBody}>
          <p className={styles.timingNote}>{reference.observation.method === 'sampled-frames' ? 'Sampled visual timing; scene boundaries are approximate.' : 'Observed scene timing; refer to the original for exact cuts.'}</p>
          <ol className={styles.timeline}>
            {reference.scenes.map((scene, sceneIndex) => <li key={scene.id}>
              <div className={styles.sceneMarker} aria-hidden="true">{(sceneIndex + 1).toString().padStart(2, '0')}</div>
              <div className={styles.sceneBody}><span className={styles.timecode}>{timecode(scene.startSeconds)}–{timecode(scene.endSeconds)}</span><h3>{scene.title}</h3><p>{scene.visual}</p>
                {scene.copy ? <blockquote>{scene.copy}</blockquote> : null}
                <dl><div><dt>Motion &amp; edit</dt><dd>{scene.motion}</dd></div><div><dt>Story job</dt><dd>{scene.purpose}</dd></div></dl>
              </div>
            </li>)}
          </ol>
          <section className={styles.apply} aria-labelledby={`${reference.id}-apply`}><h3 id={`${reference.id}-apply`}>How we apply it</h3><ol>{reference.howWeApply.map((idea, ideaIndex) => <li key={ideaIndex}>{idea}</li>)}</ol></section>
          <section className={styles.observation} aria-labelledby={`${reference.id}-observation`}><h3 id={`${reference.id}-observation`}>What we reviewed</h3><p>{reference.observation.coverage}</p><p>{reference.observation.audioReviewed ? 'Audio was reviewed.' : 'Audio was not reviewed; these notes concern the visuals.'}</p>{reference.observation.limitations.length ? <ul>{reference.observation.limitations.map((limitation, limitationIndex) => <li key={limitationIndex}>{limitation}</li>)}</ul> : null}</section>
        </div>
      </details>
      <div className={styles.provenance}>
        <p><time dateTime={reference.observedAt}>Observed {observedDate(reference.observedAt)}</time><span>Status: {reference.statusObserved}</span></p>
        <div className={styles.sourceLinks}>
          <ExternalLink href={reference.sourceUrl}>{reference.sourceType === 'direct-meta' ? 'Open Meta source' : 'Open archive source'}</ExternalLink>
          {reference.metaLibraryUrl && reference.metaLibraryUrl !== reference.sourceUrl ? <ExternalLink href={reference.metaLibraryUrl}>Meta Ad Library</ExternalLink> : null}
          {reference.videoUrl && reference.videoUrl !== reference.sourceUrl ? <ExternalLink href={reference.videoUrl}>Watch at source</ExternalLink> : null}
          <a className={styles.permalink} href={`#${reference.id}`} aria-label={`Link to ${reference.advertiser}: ${reference.title}`}>#</a>
        </div>
      </div>
    </div>
  </article>;
}

export function ReferencePortfolio({ references }: { references: AdReference[] }) {
  const [brand, setBrand] = useState('all');
  const [hook, setHook] = useState<HookType | 'all'>('all');
  const brands = [...new Set(references.map(reference => reference.advertiser))].sort((a, b) => a.localeCompare(b));
  const hooks = (Object.keys(hookLabels) as HookType[]).filter(type => references.some(reference => reference.hook.type === type));
  const filtered = references.filter(reference => (brand === 'all' || reference.advertiser === brand) && (hook === 'all' || reference.hook.type === hook));
  const active = brand !== 'all' || hook !== 'all';

  return <section className={styles.collection} aria-labelledby="collection-title">
    <div className={styles.collectionHeader}><div><p className={styles.eyebrow}>The collection</p><h2 id="collection-title">Open. Observe. Unpack.</h2></div><p aria-live="polite" aria-atomic="true">{filtered.length} of {references.length} references</p></div>
    {references.length ? <div className={styles.filters}>
      <label>Advertiser<select value={brand} onChange={event => setBrand(event.target.value)}><option value="all">All advertisers</option>{brands.map(advertiser => <option key={advertiser} value={advertiser}>{advertiser}</option>)}</select></label>
      <label>Opening approach<select value={hook} onChange={event => setHook(event.target.value as HookType | 'all')}><option value="all">All hook types</option>{hooks.map(type => <option key={type} value={type}>{hookLabels[type]}</option>)}</select></label>
      {active ? <button type="button" className={styles.clearFilters} onClick={() => { setBrand('all'); setHook('all'); }}>Clear filters <span aria-hidden="true">×</span></button> : null}
    </div> : null}
    {filtered.length ? <div className={styles.grid}>{filtered.map(reference => <ReferenceCard key={reference.id} reference={reference} index={references.indexOf(reference)} />)}</div> : <div className={styles.empty}>
      <span className={styles.emptyMark} aria-hidden="true">{references.length ? '↺' : '…'}</span>
      <h3>{references.length ? 'No references in this combination.' : 'The reference shelf is being assembled.'}</h3>
      <p>{references.length ? 'Try another advertiser or opening approach to continue exploring.' : 'Source links, observed hooks, and scene notes will appear here after review. There are no placeholder ads in the collection.'}</p>
      {references.length ? <button className={styles.primaryLink} type="button" onClick={() => { setBrand('all'); setHook('all'); }}>Show all references <span aria-hidden="true">↗</span></button> : <a className={styles.primaryLink} href="/launch-tests">Explore our product films <span aria-hidden="true">↗</span></a>}
    </div>}
  </section>;
}
