'use client';

import { useState } from 'react';
import type { Film, LabManifest, Media, Placement, Shot } from './types';
import styles from './page.module.css';

export const placementLabels: Record<Placement, string> = { landscape: 'Landscape · 16:9', feed: 'Feed · 4:5', reels: 'Vertical · 9:16' };
const statusLabels = { complete: 'Complete', 'in-progress': 'In progress', review: 'Ready for review', pending: 'Next', external: 'Needs viewers' };

function initializePlayer(video: HTMLVideoElement | null) {
  if (!video) return;
  video.defaultMuted = true;
  video.muted = true;
  return () => video.pause();
}

export function MediaPlayer({ media, label }: { media: Media; label: string }) {
  const [failed, setFailed] = useState(false);
  if (media.status !== 'ready' || !media.src || failed) return <div className={styles.pendingMedia} role="status"><span aria-hidden="true">▤</span><strong>{failed ? 'This film could not load' : 'This film is not rendered yet'}</strong><p>{failed ? 'Try reloading the page.' : 'The completed export will appear here after rendering and checks.'}</p></div>;
  return <video ref={initializePlayer} onError={() => setFailed(true)} className={styles.video} controls muted playsInline preload="metadata" poster={media.poster} width={media.width} height={media.height} aria-label={label}>
    <source src={media.src} type="video/mp4" />
    <a href={media.src}>Open this film</a>
  </video>;
}

export function PlacementButtons({ placement, setPlacement }: { placement: Placement; setPlacement: (value: Placement) => void }) {
  return <div className={styles.segmented} role="group" aria-label="Video placement">{(Object.keys(placementLabels) as Placement[]).map(value => <button key={value} type="button" aria-pressed={placement === value} onClick={() => setPlacement(value)}>{placementLabels[value]}</button>)}</div>;
}

function FormPreview({ filled = false, close = false, editing = false }: { filled?: boolean; close?: boolean; editing?: boolean }) {
  return <div className={`${styles.mockForm} ${close ? styles.mockClose : ''}`}><span className={styles.mockBrand}>Tally</span><strong>Project enquiry</strong><div><span>Your name</span><p>{filled ? 'Ada' : 'Your answer'}</p></div>{editing ? <div><span>Add a question</span><p>Type / to insert a block</p></div> : <div><span>Your email</span><p>{filled ? 'ada@example.com' : 'Your answer'}</p></div>}<div><span>What do you need?</span><p>{filled ? 'A new landing page' : 'Your answer'}</p></div>{filled && <b className={styles.mockButton}>Submit →</b>}</div>;
}

function ShotFrame({ shot, placement, name }: { shot: Shot; placement: Placement; name: string }) {
  return <div className={`${styles.boardFrame} ${styles[placement]}`} aria-label={`Concept sketch for ${shot.title}. ${shot.copy}`}>
    <span className={styles.frameCorner}>{name} / {shot.start.toFixed(1)}s</span>
    <div className={styles.frameContent}>
      {shot.view === 'fragments' ? <><div className={styles.fragments}><span>What’s your email?</span><span>What do you need?</span><span>One more thing…</span></div><strong className={styles.hook}>Still taking<br />client briefs<br />in DMs?</strong></> : null}
      {shot.view === 'editor' ? <><h3>Build it like a doc.</h3><FormPreview editing /></> : null}
      {shot.view === 'input' ? <><h3>Build it like a doc.</h3><div className={styles.inputDetail}><span>Project enquiry / next question</span><strong>/email<span className={styles.caret} /></strong><div>✉ <b>Email</b><span>↵</span></div></div></> : null}
      {shot.view === 'publish' ? <><h3>Build it like a doc.</h3><div className={styles.publishDetail}><span>Project enquiry</span><b className={styles.blueButton}>Publish <i aria-hidden="true">↖</i></b></div></> : null}
      {shot.view === 'respondent' ? <><h3>Ask once.<br />Get the details.</h3><FormPreview filled close /></> : null}
      {shot.view === 'confirmation' ? <><h3>Ask once.<br />Get the details.</h3><div className={styles.confirmation}><span aria-hidden="true">✓</span><strong>Thanks for completing<br />this form!</strong><small>Made with Tally</small></div></> : null}
      {shot.view === 'brief' ? <><h3>The brief.<br />In one place.</h3><div className={styles.brief}><small>Example brief</small><strong>Ada</strong><span>ada@example.com</span><p>A new landing page</p></div></> : null}
      {shot.view === 'cta' ? <div className={styles.ctaFrame}><span>Tally</span><h3>Create a<br />free form</h3><small>tally.so</small></div> : null}
      {shot.view === 'generic' ? <div className={styles.ctaFrame}><span>{name}</span><h3>{shot.copy}</h3><small>{shot.subject}</small></div> : null}
    </div>
    <span className={styles.sketchLabel}>Storyboard sketch · not a rendered frame</span>
  </div>;
}

function Storyboard({ film, placement }: { film: Film; placement: Placement }) {
  const [selected, setSelected] = useState(0);
  const shot = film.shots[selected] ?? film.shots[0];
  return <div className={styles.storyboard}>
    <div className={styles.shotList} role="group" aria-label="Choose a storyboard view">{film.shots.map((item, index) => <button key={item.id} type="button" aria-pressed={shot.id === item.id} onClick={() => setSelected(index)}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{item.title}</strong><small>{item.start.toFixed(2)}–{item.end.toFixed(2)}s</small></div><span aria-hidden="true">↗</span></button>)}</div>
    <div className={styles.selectedShot}>
      <ShotFrame shot={shot} placement={placement} name={film.name} />
      <div className={styles.shotDetails} aria-live="polite"><div className={styles.shotHeading}><h3>{shot.title}</h3><span>{shot.start.toFixed(2)}–{shot.end.toFixed(2)}s</span></div><p className={styles.shotCopy}>“{shot.copy}”</p><dl><div><dt>Camera</dt><dd>{shot.framing}</dd></div><div><dt>Action</dt><dd>{shot.action}</dd></div><div><dt>Consequence</dt><dd>{shot.result}</dd></div><div><dt>Continuity</dt><dd>{shot.transition}</dd></div></dl>{shot.sourceIds.length > 0 ? <div className={styles.sourceLinks}><span>Product evidence</span>{shot.sourceIds.map(id => { const source = film.sources.find(item => item.id === id); return source ? <a key={id} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a> : null; })}</div> : <p className={styles.smallNote}>An editorial problem illustration. It does not depict a product integration.</p>}</div>
    </div>
  </div>;
}

function EarlierFilm({ film, placement }: { film: Film; placement: Placement }) {
  const [open, setOpen] = useState(false);
  const media = film.baseline[placement];
  return <details className={styles.archive} onToggle={event => setOpen(event.currentTarget.open)}><summary>Compare the earlier film <span>Historical comparison</span></summary>{open && <div><p>{media.note}</p><div className={styles.archivePlayer}><MediaPlayer key={`${film.id}-${placement}-${media.src}`} media={media} label={`${film.name} earlier film, ${placementLabels[placement]}`} /></div>{media.status === 'ready' && media.src && <a className={styles.textLink} href={media.src} download>Download earlier film ↓</a>}</div>}</details>;
}

export function DirectionLab({ manifest }: { manifest: LabManifest }) {
  const [filmId, setFilmId] = useState(manifest.films[0].id);
  const [placement, setPlacement] = useState<Placement>('landscape');
  const film = manifest.films.find(item => item.id === filmId) ?? manifest.films[0];
  const completed = manifest.steps.filter(step => step.status === 'complete').length;
  return <main id="main-content" className={styles.page}>
    <header className={styles.header}><a href="/" className={styles.brand}>Video Studio <span aria-hidden="true">●</span></a><div className={styles.headerTopline}><p className={styles.eyebrow}>Direction lab / October 2026</p><span className={styles.pill}>Work in progress</span></div><h1>One story.<br /><span>Every view matters.</span></h1><p className={styles.intro}>A more deliberate camera. Objects that carry the story. A result you can understand with the sound off. Start with one Tally film, then prove the same direction works from a URL.</p><nav className={styles.nav} aria-label="Direction lab sections"><a href="#storyboard">Review the storyboard ↗</a><a href="#compare">Compare the films</a><a href="#progress">Track the work</a></nav></header>
    <section id="storyboard" className={styles.section} aria-labelledby="storyboard-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>01 / The pilot</p><h2 id="storyboard-title">{film.promise}</h2></div><span className={styles.pill}>{film.approval}</span></div>{manifest.films.length > 1 && <label className={styles.filmSelect}>Product<select value={filmId} onChange={event => setFilmId(event.target.value)}>{manifest.films.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<p className={styles.sectionIntro}>{film.audience}. {film.treatment}</p><div className={styles.boardToolbar}><PlacementButtons placement={placement} setPlacement={setPlacement} /><span>{film.shots.length} views · {film.duration} seconds</span></div><Storyboard key={film.id} film={film} placement={placement} /><div className={styles.reviewNote}><strong>{film.approval.startsWith('Approved') ? 'The approved storyboard guides the render.' : 'The storyboard is the review point.'}</strong><p>{film.approval.startsWith('Approved') ? 'These composition sketches record the approved story and intended actions. Animation, readability and export checks remain separate from storyboard approval.' : 'These are composition sketches and intended actions. Review the story, framing and transitions before the final render. Actual animation, readability and export checks follow.'}</p><a href="/direction-lab/manifest.json" download>Download the storyboard and work status ↓</a></div></section>
    <section id="compare" className={styles.section} aria-labelledby="compare-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>02 / Watch with sound off</p><h2 id="compare-title">A clear comparison.</h2></div><a className={styles.textLink} href={`/direction-lab/viewer?film=${film.id}`}>Open the viewer test ↗</a></div><PlacementButtons placement={placement} setPlacement={setPlacement} /><div className={styles.comparison}>{([{ label: film.control ? 'Matched control' : 'Previous film', media: (film.control ?? film.baseline)[placement] }, { label: 'New direction', media: film.placements[placement] }]).map(item => <article key={item.label}><div className={styles.playerLabel}><h3>{item.label}</h3><span>{placementLabels[placement]}</span></div><div className={styles.playerStage}><MediaPlayer key={`${film.id}-${placement}-${item.label}-${item.media.src}`} media={item.media} label={`${film.name} ${item.label.toLowerCase()}, ${placementLabels[placement]}`} /></div><p>{item.media.note}</p>{item.media.status === 'ready' && item.media.src && <a className={styles.textLink} href={item.media.src} download>Download this film ↓</a>}</article>)}</div>{film.control && <EarlierFilm film={film} placement={placement} />}<p className={styles.smallNote}>The matched pair holds the story, product actions, duration and soundtrack fixed while changing camera framing, composition, layer timing and materials together. Players start muted. Film controls let you replay and review sound separately. Existing showcase films are individually directed studies; they are not proof of automatic generation.</p></section>
    <section className={styles.section} aria-labelledby="benchmark-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>03 / What the references teach</p><h2 id="benchmark-title">Borrow the mechanism.</h2></div><span className={styles.pill}>8 films inspected</span></div><div className={styles.benchmarks}>{manifest.benchmarks.map(benchmark => <article key={benchmark.name}><span>{benchmark.name} · {benchmark.range}</span><h3>{benchmark.technique}</h3><p>{benchmark.purpose}</p><a className={styles.textLink} href={benchmark.url} target="_blank" rel="noreferrer">Original source ↗</a></article>)}</div><p className={styles.smallNote}>Reference ranges are approximate. The private scene atlas contains 729 visual samples and 163 annotated view ranges. Downloaded reference films are not republished here.</p></section>
    <section id="progress" className={styles.section} aria-labelledby="progress-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>04 / The implementation</p><h2 id="progress-title">From pilot to pipeline.</h2></div><span className={styles.pill}>{completed} of {manifest.steps.length} complete</span></div><ol className={styles.checklist}>{manifest.steps.map(step => <li key={step.number}><span className={styles.stepNumber}>{step.status === 'complete' ? '✓' : String(step.number).padStart(2, '0')}</span><div><h3>{step.title}</h3><p>{step.detail}</p></div><span className={styles.status} data-status={step.status}>{statusLabels[step.status]}</span></li>)}</ol><div className={styles.generalization}>{manifest.generalization.map(item => <article key={item.title}><span>{item.status}</span><h3>{item.title}</h3><p>{item.detail}</p></article>)}</div></section>
    <section className={styles.section} aria-labelledby="test-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>05 / Evidence before a verdict</p><h2 id="test-title">Make the test fair.</h2></div></div><div className={styles.testGrid}><article><h3>Can a new viewer explain it?</h3><p>Show the film once at phone size, muted, without the storyboard. Ask five people unfamiliar with the work who it is for, what happened, what changed and what they should do next. Target four clear responses out of five.</p><p>The viewer page saves responses on that browser and downloads them for review. No survey has been completed by opening this page.</p><a className={styles.textLink} href={`/direction-lab/viewer?film=${film.id}`}>Open the unprompted viewer test ↗</a></article><article><h3>Does it lead to useful action?</h3><p>Compare one creative change at a time. Hold audience, placement, offer, landing page and attribution constant. Read early attention alongside qualified sign-ups and activation; a higher view count alone is not a win.</p><p>Organic and paid results are separate. Paid testing needs an agreed budget before launch.</p><a className={styles.textLink} href="/direction-lab/test-plan.md" download>Download the experiment plan ↓</a></article></div></section>
    <footer className={styles.footer}><p>Original illustrative product studies, not official brand campaigns. Product sources and check dates are recorded in the storyboard metadata; last updated {manifest.updated}. Example contact details are fictional. Approval, render, technical review and audience results remain separate states.</p><div><a href="/launch-tests">Previous launch studies ↗</a><a href="/ad-references">Ad research ↗</a><a href="#main-content">Back to top ↑</a></div></footer>
  </main>;
}
