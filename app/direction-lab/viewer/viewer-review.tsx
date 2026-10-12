'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { ViewerFilm, Placement } from '../types';
import { MediaPlayer, PlacementButtons, placementLabels } from '../review';
import styles from '../page.module.css';

const STORAGE_KEY = 'video-studio-direction-review-v1';
type Response = { schema: 1; id: string; savedAt: string; film: string; version: 'baseline' | 'directed' | 'control'; placement: Placement; media: string; participant: string; unfamiliar: string; viewing: string; audience: string; action: string; result: string; cta: string; confusing: string };

function readResponses(value: string | null): Response[] {
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error('Invalid saved response data');
  if (!parsed.every(item => Boolean(item && typeof item === 'object' && item.schema === 1 && typeof item.id === 'string' && typeof item.savedAt === 'string' && typeof item.film === 'string' && typeof item.media === 'string' && ['baseline', 'directed', 'control'].includes(item.version) && ['landscape', 'feed', 'reels'].includes(item.placement) && ['participant', 'unfamiliar', 'viewing', 'audience', 'action', 'result', 'cta', 'confusing'].every(key => typeof item[key] === 'string')))) throw new Error('Invalid saved response data');
  return parsed as Response[];
}

export function ViewerReview({ film }: { film: ViewerFilm }) {
  const [placement, setPlacement] = useState<Placement>('reels');
  const [version, setVersion] = useState<'baseline' | 'directed' | 'control'>('directed');
  const [responses, setResponses] = useState<Response[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [status, setStatus] = useState('');
  const media = version === 'directed' ? film.placements[placement] : version === 'control' && film.control ? film.control[placement] : film.baseline[placement];
  const ready = media.status === 'ready' && Boolean(media.src);
  useEffect(() => {
    try { setResponses(readResponses(localStorage.getItem(STORAGE_KEY))); setStorageReady(true); }
    catch { setStatus('Saved responses could not be read. New answers can still be downloaded directly; existing data will not be overwritten.'); }
  }, []);

  function download(items: Response[]) {
    const blob = new Blob([JSON.stringify({ schema: 1, exportedAt: new Date().toISOString(), note: 'Unscored viewer responses saved in this browser. Self-reported viewing conditions; no outcome or ad-performance claim.', responses: items }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'direction-lab-viewer-responses.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !media.src) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const answer = (key: string) => String(values.get(key) ?? '').trim();
    const response: Response = { schema: 1, id: crypto.randomUUID(), savedAt: new Date().toISOString(), film: film.id, version, placement, media: media.src, participant: answer('participant'), unfamiliar: answer('unfamiliar'), viewing: answer('viewing'), audience: answer('audience'), action: answer('action'), result: answer('result'), cta: answer('cta'), confusing: answer('confusing') };
    if (!response.participant || !response.audience || !response.action || !response.result || !response.cta) { setStatus('Please answer each required question. “Not sure” is a useful answer.'); return; }
    if (!storageReady) { download([response]); setStatus('This response was downloaded. It was not saved in browser storage.'); form.reset(); return; }
    try {
      // Re-read at write time so responses from another tab are not discarded.
      const updated = [...readResponses(localStorage.getItem(STORAGE_KEY)), response];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); setResponses(updated);
      setStatus('Response saved on this device. Download the responses to share them with the reviewer.'); form.reset();
    } catch { download([response]); setStatus('Browser storage was unavailable. This response was downloaded instead.'); }
  }

  return <main id="main-content" className={`${styles.page} ${styles.viewerPage}`}>
    <a href="/" className={styles.brand}>Video Studio <span aria-hidden="true">●</span></a>
    <header className={styles.viewerIntro}><p className={styles.eyebrow}>Viewer test</p><h1>Watch once.<br />Tell us what you understood.</h1><p>Please watch the chosen film without sound. Answer from what you saw, without opening the storyboard or receiving an explanation. There are no hints; “not sure” is useful feedback.</p></header>
    <div className={styles.viewerControls}><label className={styles.filmSelect}>Version<select value={version} onChange={event => { setVersion(event.target.value as 'baseline' | 'directed' | 'control'); setStatus(''); }}>{film.control && <option value="control">A · Matched control</option>}<option value="directed">B · New direction</option><option value="baseline">Earlier film · Historical comparison</option></select></label><PlacementButtons placement={placement} setPlacement={value => { setPlacement(value); setStatus(''); }} /></div>
    <div className={styles.playerStage}><MediaPlayer key={`${version}-${placement}-${media.src}`} media={media} label={`Film ${version === 'baseline' ? 'earlier' : version === 'control' ? 'A' : 'B'}, ${placementLabels[placement]}`} /></div>
    <p className={styles.smallNote}>This player starts muted. The film may be replayed, but please record whether you watched once or more than once. Use a phone for the vertical and feed versions.</p>
    <form className={styles.survey} onSubmit={save} key={`${film.id}-${version}-${placement}`}><h2>In your own words.</h2><p>Responses stay in this browser until downloaded. Use a participant code, not your name or email. Required questions accept “not sure.”</p>
      <label>Participant code<input name="participant" placeholder="For example, viewer-01" maxLength={60} required autoComplete="off" /></label>
      <label>Were you unfamiliar with this video and the project behind it?<select name="unfamiliar" required defaultValue=""><option value="" disabled>Select one</option><option value="yes">Yes</option><option value="no">No</option><option value="unsure">Not sure</option></select></label>
      <label>How did you watch?<select name="viewing" required defaultValue=""><option value="" disabled>Select one</option><option value="once-muted-phone">Once, muted, on a phone</option><option value="once-muted-desktop">Once, muted, on a larger screen</option><option value="replayed-muted">More than once, muted</option><option value="sound-on">With sound on</option><option value="other">Another way</option></select></label>
      <label>Who is this for?<textarea name="audience" maxLength={1500} required /></label>
      <label>What did the person or product do?<textarea name="action" maxLength={1500} required /></label>
      <label>What changed as a result?<textarea name="result" maxLength={1500} required /></label>
      <label>What should you do next, if interested?<textarea name="cta" maxLength={1500} required /></label>
      <label>What, if anything, was confusing or hard to read? <span>(Optional)</span><textarea name="confusing" maxLength={1500} /></label>
      <div className={styles.surveyActions}><button type="submit" disabled={!ready}>{storageReady ? 'Save response on this device' : 'Download this response'}</button><button type="button" disabled={responses.length === 0} onClick={() => download(responses)}>Download saved responses ({responses.length})</button></div>
      {!ready && <p className={styles.surveyStatus}>This version has no completed film yet. Saving responses is available when a film is ready.</p>}<p className={styles.surveyStatus} role="status">{status}</p>
    </form>
    <aside className={styles.responseSummary}><strong>{responses.length} response{responses.length === 1 ? '' : 's'} saved on this device</strong><p>Responses are unscored. A reviewer must assess comprehension and count distinct unfamiliar participants. This number is not a success rate, a count of verified participants, or a central survey total.</p></aside>
    <footer className={styles.footer} style={{ marginTop: 32 }}><p>For the facilitator: show one version per unfamiliar participant. Keep the storyboard and expected answers out of view until responses are saved.</p><a className={styles.textLink} href="/direction-lab">Return to the direction lab after answering ↗</a></footer>
  </main>;
}
