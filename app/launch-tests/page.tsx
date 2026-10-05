import type { Metadata } from 'next';
import { SocialPlayer } from './social-player';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Social ads — a reason to act',
  description: 'Three product stories rebuilt for mobile: a recognizable problem, a visible action and a useful result. Compare Reels and feed editions.',
  robots: { index: false, follow: false },
};

const films = [
  { id: 'linear', name: 'Linear', audience: 'For software teams', headline: 'Keep the bug. Keep the context.', hook: 'Still copying bugs into an AI chat?', description: 'A bug report stays with the work as it is delegated to an agent. The payoff is a draft pull request to review, with the issue still in context.', contrast: 'An interrupted handoff gives way to one continuous issue-to-draft story. The final result settles long enough to read.', proof: 'A deliberate agent selection, a working state, then a clearly labeled draft. Human review remains part of the story.', outcome: 'Review the work. Keep the context.', reference: '/ad-references#backend-monday-localization', note: 'Coding sessions require the relevant workspace access and GitHub/agent setup. The example and transitions are illustrative; a draft is not a merged fix.' },
  { id: 'tally', name: 'Tally', audience: 'For independent businesses', headline: 'Give the client brief a home.', hook: 'Still taking client briefs in DMs?', description: 'Scattered client details become one form for a name, email and project brief. Building, publishing and submitting are distinct actions with visible results.', contrast: 'Fragmented messages create the problem. A clean form organizes it; a completed submission delivers the payoff.', proof: 'The form is built, Publish makes it available, and an illustrative respondent submits a complete brief.', outcome: 'The brief. In one place.', reference: '/ad-references#interface-figma-options', note: 'The opening messages illustrate the problem; Tally does not import them in this video. Example contact information is fictional.' },
  { id: 'todoist', name: 'Todoist', audience: 'For people juggling work and life', headline: 'Close the laptop. Capture the thought.', hook: 'Laptop closed. Brain still open.', description: 'One task interrupts the end of the day. The same words enter Quick Add, become a date and priority, then remain visible in the saved Inbox task.', contrast: 'A closing laptop is interrupted by the thought. Fast movement pauses for recognition, then gives way to a calm, readable saved result.', proof: 'Date, time and priority are recognized before Add. The saved task is still pending, with its date and priority intact.', outcome: 'Captured. Scheduled. Off your mind.', reference: '/ad-references#interface-grammarly-paper', note: 'This demonstrates task capture and scheduling, not task completion or a guarantee of a reminder. The interface is an illustrative reconstruction.' },
];
const earlier = [
  { suffix: '-hook', label: 'Previous hook cut', duration: 18 },
  { suffix: '-motion', label: 'Product-motion cut', duration: 18 },
  { suffix: '-extreme', label: 'Extreme experiment', duration: 18 },
  { suffix: '', label: 'Original launch film', duration: 24 },
];

export default function LaunchTestsPage() {
  return <main id="main-content" className={styles.page}>
    <header className={styles.header}>
      <a href="/" className={styles.brand}>Video Studio <span aria-hidden="true">●</span></a>
      <p className={styles.eyebrow}>The mobile ad studies · October 2026</p>
      <h1>A reason to stop.<br /><span>A reason to act.</span></h1>
      <p className={styles.intro}>A familiar problem. One clear action. A result that matters. Three new stories, each composed for vertical viewing and the feed. Watch with sound off first.</p>
      <nav className={styles.navigation} aria-label="Choose a film">{films.map(film => <a key={film.id} href={`#${film.id}`}>{film.name}<span aria-hidden="true">↘</span></a>)}</nav>
      <div className={styles.headerLinks}><a href="/ad-references">Explore the reference portfolio ↗</a><a href="/launch-tests/social-ad-test-plan.md" download>Get the testing brief ↓</a></div>
    </header>
    <div className={styles.films}>{films.map((film, index) => <section key={film.id} id={film.id} className={styles.film} aria-labelledby={`${film.id}-title`}>
      <div className={styles.caption}><div><span className={styles.number}>0{index + 1}</span><h2 id={`${film.id}-title`}>{film.name}</h2></div><span className={styles.duration}>New story · Two formats</span></div>
      <div className={styles.presentation}>
        <SocialPlayer id={film.id} name={film.name} />
        <div className={styles.story}>
          <p className={styles.eyebrow}>{film.audience}</p><h3>{film.headline}</h3>
          <p id={`${film.id}-description`} className={styles.storyIntro}>{film.description}</p>
          <dl className={styles.beats}>
            <div><dt>The hook</dt><dd>“{film.hook}”</dd></div>
            <div><dt>The proof</dt><dd>{film.proof}</dd></div>
            <div><dt>The consequence</dt><dd>“{film.outcome}”</dd></div>
          </dl>
          <div className={styles.downloads} aria-label={`${film.name} downloads`}>
            <a href={`/launch-tests/media/${film.id}-social-reels.mp4`} download={`${film.id}-social-9x16.mp4`}>Download vertical <span>9:16 ↓</span></a>
            <a href={`/launch-tests/media/${film.id}-social-feed.mp4`} download={`${film.id}-social-4x5.mp4`}>Download feed <span>4:5 ↓</span></a>
          </div>
          <details className={styles.notes}><summary>Creative notes &amp; suggested post copy</summary><p>{film.contrast}</p><p>{film.note}</p><p><a href={`/launch-tests/${film.id}-creative-brief.md`} download>Download script and suggested organic / paid copy ↓</a></p><p><a href={film.reference}>See the reference technique ↗</a></p></details>
        </div>
      </div>
      <details className={styles.previous}><summary>Compare the earlier cuts <span>Four versions</span></summary>
        <p>Previous landscape exports are preserved. The new ads retain the previous hook cut’s exact soundtrack, so the change can be judged visually.</p>
        <div className={styles.archiveGrid}>{earlier.map(version => <details key={version.suffix} className={styles.original}>
          <summary>{version.label}<span>{version.duration}s · 16:9</span></summary>
          <video controls muted playsInline preload="none" poster={`/launch-tests/media/${film.id}${version.suffix}.jpg`} width={1920} height={1080} aria-label={`${film.name} ${version.label.toLowerCase()}`}>
            <source src={`/launch-tests/media/${film.id}${version.suffix}.mp4`} type="video/mp4" />
            <a href={`/launch-tests/media/${film.id}${version.suffix}.mp4`}>Open previous film.</a>
          </video>
          <a className={styles.originalDownload} href={`/launch-tests/media/${film.id}${version.suffix}.mp4`} download>Download this version ↓</a>
        </details>)}</div>
      </details>
    </section>)}</div>
    <aside className={styles.testNote}><p className={styles.eyebrow}>The next check is with the audience</p><h2>Test the story. Measure the result.</h2><p>These cuts are creative hypotheses, not proven winners. Compare attention with qualified sign-ups and product activation. Keep audience, placement, offer and landing page consistent when testing one change.</p><a href="/launch-tests/social-ad-test-plan.md" download>Download the test plan ↓</a></aside>
    <footer className={styles.footer}><p>Original, individually art-directed HTML films. These are not official brand campaigns or automatic URL-to-video acceptance runs. Brand palettes are retained; product examples and transitions are illustrative. Each player starts muted.</p><div><a href="/ad-references">Ad research ↗</a><a href="/comparisons">Original references ↗</a><a href="#main-content">Back to top ↑</a></div></footer>
  </main>;
}
