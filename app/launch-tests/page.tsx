import type { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Launch films — a sharper hook',
  description: 'Three reference-led hook studies. Watch muted, inspect the research and compare earlier versions.',
  robots: { index: false, follow: false },
};

const films = [
  { id:'linear', name:'Linear', mood:'Precise. Technical. Confident.', description:'For software teams: an issue becomes a delegated task, then a draft pull request ready for review.', reference:'/ad-references#backend-clickup-link-hunt', hook:'A recognizable work question opens on the actual issue object. Its contraction turns the question into a handoff, and the draft PR supplies the answer.', transcript:'Bug reported. Now what? The issue arrives, contracts and becomes an implementation task. A request is typed into the Linear agent pane and sent. The agent response reveals a draft pull request. The result moves into a focused review composition. Linear. Get started.' },
  { id:'tally', name:'Tally', mood:'Playful. Tactile. Direct.', description:'For founders and creators: turn a document into a feedback form, publish it, and give people a way to respond.', reference:'/ad-references#interface-figma-options', hook:'Show the finished object first, then reveal how it is built. The opening form moves into its own editor, keeping one subject through the transition.', transcript:'Stop guessing. Start asking. A finished feedback form appears first, then folds back into the editor. The slash-command menu adds an email field and a multiple-choice question: Where did you hear about us? Google, Social media and Friends assemble as options. Publish leads to a respondent view. An illustrative email and choice are entered, then Submit reveals the default thank-you message. Tally. Create a free form.' },
  { id:'todoist', name:'Todoist', mood:'Warm. Fast. Focused.', description:'For busy independent professionals: a thought becomes a task, with its date and priority recognized along the way.', reference:'/ad-references#interface-grammarly-paper', hook:'Start with the burden of remembering. The headline clears and the same thought moves into Quick Add, connecting the opening directly to product proof.', transcript:'Don’t keep it in your head. A strip carrying “Meet with Ada tomorrow at 14 p1” moves into Todoist Quick Add. Tomorrow at 14:00 and priority one are recognized. The task is added to Inbox with the same date and priority. Todoist. Start for free.' },
];

export default function LaunchTestsPage(){
  return <main id="main-content" className={styles.page}>
    <header className={styles.header}>
      <a href="/" className={styles.brand}>Video Studio</a>
      <p className={styles.eyebrow}>Reference-led hook studies · October 2026</p>
      <h1>Same product.<br/>Sharper hook.</h1>
      <p className={styles.intro}>A stronger opening, then a product story you can follow. These new cuts apply techniques from our software-ad research while keeping each product’s palette. Watch with sound off, then compare with the previous cut below.</p>
      <a className={styles.researchLink} href="/ad-references">Explore the ad reference portfolio <span aria-hidden="true">↗</span></a>
      <nav className={styles.navigation} aria-label="Choose a film">{films.map(film=><a key={film.id} href={`#${film.id}`}>{film.name}<span aria-hidden="true">↘</span></a>)}</nav>
    </header>
    <div className={styles.films}>{films.map((film,index)=><section key={film.id} id={film.id} className={styles.film} aria-labelledby={`${film.id}-title`}>
      <div className={styles.caption}><div><span className={styles.number}>0{index+1}</span><h2 id={`${film.id}-title`}>{film.name}</h2></div><span className={styles.duration}>New hook cut · 18 seconds</span></div>
      <video controls muted playsInline preload="metadata" poster={`/launch-tests/media/${film.id}-hook.jpg`} width={1920} height={1080} aria-label={`${film.name} hook study`} aria-describedby={`${film.id}-description`}>
        <source src={`/launch-tests/media/${film.id}-hook.mp4`} type="video/mp4"/>
        Your browser does not support embedded video. <a href={`/launch-tests/media/${film.id}-hook.mp4`}>Open the film.</a>
      </video>
      <div className={styles.details}><div><h3>{index===0?'An issue. An action. A draft to review.':index===1?'Type it. Build it. Publish it.':'Your words become your next task.'}</h3><p id={`${film.id}-description`}>{film.description}</p></div><a href={`/launch-tests/media/${film.id}-hook.mp4`} download={`${film.id}-hook-study.mp4`}>Download new cut <span aria-hidden="true">↓</span></a></div>
      <details className={styles.description}><summary>The hook and product story</summary><p>{film.hook}</p><p><a href={film.reference}>See the reference technique ↗</a></p><p>{film.transcript}</p><p>Interfaces and interactions are illustrative reconstructions from public product sources.</p></details>
      <details className={styles.original}><summary>Compare with the previous product-motion cut <span>18 seconds ↗</span></summary>
        <p>The preceding brand-faithful cut. The new version retains this exact soundtrack.</p>
        <video controls muted playsInline preload="none" poster={`/launch-tests/media/${film.id}-motion.jpg`} width={1920} height={1080} aria-label={`${film.name} previous product motion film`}>
          <source src={`/launch-tests/media/${film.id}-motion.mp4`} type="video/mp4"/>
          Your browser does not support embedded video. <a href={`/launch-tests/media/${film.id}-motion.mp4`}>Open the previous product-motion cut.</a>
        </video>
        <a className={styles.originalDownload} href={`/launch-tests/media/${film.id}-motion.mp4`} download={`${film.id}-product-motion.mp4`}>Download previous product-motion cut ↓</a>
      </details>
      <details className={styles.original}><summary>Compare with the previous extreme cut <span>18 seconds ↗</span></summary>
        <p>The previous visual experiment, with the same soundtrack as the new cut.</p>
        <video controls muted playsInline preload="none" poster={`/launch-tests/media/${film.id}-extreme.jpg`} width={1920} height={1080} aria-label={`${film.name} previous extreme launch film`}>
          <source src={`/launch-tests/media/${film.id}-extreme.mp4`} type="video/mp4"/>
          Your browser does not support embedded video. <a href={`/launch-tests/media/${film.id}-extreme.mp4`}>Open the previous cut.</a>
        </video>
        <a className={styles.originalDownload} href={`/launch-tests/media/${film.id}-extreme.mp4`} download={`${film.id}-extreme-launch.mp4`}>Download previous cut ↓</a>
      </details>
      <details className={styles.original}><summary>Compare with the original <span>24 seconds ↗</span></summary>
        <p>{film.mood}</p>
        <video controls muted playsInline preload="none" poster={`/launch-tests/media/${film.id}.jpg`} width={1920} height={1080} aria-label={`${film.name} original launch film`}>
          <source src={`/launch-tests/media/${film.id}.mp4`} type="video/mp4"/>
          Your browser does not support embedded video. <a href={`/launch-tests/media/${film.id}.mp4`}>Open the original.</a>
        </video>
        <a className={styles.originalDownload} href={`/launch-tests/media/${film.id}.mp4`} download={`${film.id}-original-launch.mp4`}>Download original ↓</a>
      </details>
    </section>)}</div>
    <footer className={styles.footer}><p>These are individually art-directed HTML films, not official campaigns or completed automatic URL-to-video runs. The new cuts retain the previous soundtracks so the comparison focuses on picture and motion. Each player starts muted; sound can be enabled in its controls.</p><div><a href="/ad-references">Explore the ad research ↗</a><a href="/comparisons">View the original references ↗</a><a href="#main-content">Back to top ↑</a></div></footer>
  </main>;
}
