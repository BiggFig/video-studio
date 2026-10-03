import type { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Launch films — motion with a point',
  description: 'Three brand-faithful product films. Watch muted and compare earlier versions.',
  robots: { index: false, follow: false },
};

const films = [
  { id:'linear', name:'Linear', mood:'Precise. Technical. Confident.', description:'For software teams: an issue becomes a delegated task, then a draft pull request ready for review.', source:'https://linear.app/', transcript:'An implementation task is waiting. A request is typed into the Linear agent pane and sent. The agent response reveals a draft pull request. The result moves into a focused review composition. Linear. Get started.' },
  { id:'tally', name:'Tally', mood:'Playful. Tactile. Direct.', description:'For founders and creators: turn a document into a feedback form, publish it, and give people a way to respond.', source:'https://tally.so/', transcript:'Feedback form is typed into the Tally editor. The slash-command menu adds an email field and a multiple-choice question: Where did you hear about us? Google, Social media and Friends assemble as options. Publish leads to a respondent view. An illustrative email and choice are entered, then Submit reveals the default thank-you message. Tally. Create a free form.' },
  { id:'todoist', name:'Todoist', mood:'Warm. Fast. Focused.', description:'For busy independent professionals: a thought becomes a task, with its date and priority recognized along the way.', source:'https://www.todoist.com/', transcript:'Scattered thoughts resolve into Todoist Quick Add. “Meet with Ada tomorrow at 14 p1” is typed. Tomorrow at 14:00 and priority one are recognized. The task is added to Inbox with the same date and priority. Todoist. Start for free.' },
];

export default function LaunchTestsPage(){
  return <main id="main-content" className={styles.page}>
    <header className={styles.header}>
      <a href="/" className={styles.brand}>Video Studio</a>
      <p className={styles.eyebrow}>Product motion studies · October 2026</p>
      <h1>Sound off.<br/>Product on.</h1>
      <p className={styles.intro}>Three new visual cuts. The interface drives the movement: words become tasks, fields become forms, and actions become results. Each film keeps the product’s palette and starts muted. Earlier versions are below for comparison.</p>
      <nav className={styles.navigation} aria-label="Choose a film">{films.map(film=><a key={film.id} href={`#${film.id}`}>{film.name}<span aria-hidden="true">↘</span></a>)}</nav>
    </header>
    <div className={styles.films}>{films.map((film,index)=><section key={film.id} id={film.id} className={styles.film} aria-labelledby={`${film.id}-title`}>
      <div className={styles.caption}><div><span className={styles.number}>0{index+1}</span><h2 id={`${film.id}-title`}>{film.name}</h2></div><span className={styles.duration}>New visual cut · 18 seconds</span></div>
      <video controls muted playsInline preload="metadata" poster={`/launch-tests/media/${film.id}-motion.jpg`} width={1920} height={1080} aria-label={`${film.name} product motion film`} aria-describedby={`${film.id}-description`}>
        <source src={`/launch-tests/media/${film.id}-motion.mp4`} type="video/mp4"/>
        Your browser does not support embedded video. <a href={`/launch-tests/media/${film.id}-motion.mp4`}>Open the film.</a>
      </video>
      <div className={styles.details}><div><h3>{index===0?'An issue. An action. A draft to review.':index===1?'Type it. Build it. Publish it.':'Your words become your next task.'}</h3><p id={`${film.id}-description`}>{film.description}</p></div><a href={`/launch-tests/media/${film.id}-motion.mp4`} download={`${film.id}-product-motion.mp4`}>Download new cut <span aria-hidden="true">↓</span></a></div>
      <details className={styles.description}><summary>Read the product story</summary><p>{film.transcript}</p><p>Interfaces and interactions are illustrative reconstructions from public product sources.</p></details>
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
    <footer className={styles.footer}><p>These are individually art-directed HTML films, not official campaigns or completed automatic URL-to-video runs. The new cuts retain the previous soundtracks so the comparison focuses on picture and motion. Each player starts muted; sound can be enabled in its controls.</p><div><a href="/comparisons">View the reference comparisons ↗</a><a href="#main-content">Back to top ↑</a></div></footer>
  </main>;
}
