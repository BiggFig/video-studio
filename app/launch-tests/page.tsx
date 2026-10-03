import type { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Launch films — maximum energy',
  description: 'Three maximalist launch films. Compare the extreme cuts with the originals.',
  robots: { index: false, follow: false },
};

const films = [
  { id:'linear', name:'Linear', mood:'Precise. Technical. Confident.', description:'For software teams: an issue becomes a delegated task, then a draft pull request ready for review.', source:'https://linear.app/', transcript:'An implementation task is waiting. A request is typed into the Linear agent pane and sent. The agent response reveals a draft pull request. The result moves into a focused review composition. Linear. Get started.' },
  { id:'tally', name:'Tally', mood:'Playful. Tactile. Direct.', description:'For founders and creators: a simple contact form, a clear interaction, and a satisfying confirmation.', source:'https://tally.so/', transcript:'A contact form has first name, last name, company, email, website and phone fields. An illustrative email is entered, the Contact me button is pressed, and the form resolves into “Thanks for completing this form!” Tally. Create a free form.' },
  { id:'todoist', name:'Todoist', mood:'Warm. Fast. Focused.', description:'For busy independent professionals: a thought becomes a task, with its date and priority recognized along the way.', source:'https://www.todoist.com/', transcript:'Scattered thoughts resolve into Todoist Quick Add. “Meet with Ada tomorrow at 14 p1” is typed. Tomorrow at 14:00 and priority one are recognized. The task is added to Inbox with the same date and priority. Todoist. Start for free.' },
];

export default function LaunchTestsPage(){
  return <main id="main-content" className={styles.page}>
    <header className={styles.header}>
      <a href="/" className={styles.brand}>Video Studio</a>
      <p className={styles.eyebrow}>The other extreme · October 2026</p>
      <h1>Take it<br/>too far.</h1>
      <p className={styles.intro}>Three products. Maximum energy. Rapid cuts, oversized type, flying interfaces and aggressive electronic soundtracks. An intentional push to the loud end of the spectrum. Open the original below each film to compare.</p>
      <nav className={styles.navigation} aria-label="Choose a film">{films.map(film=><a key={film.id} href={`#${film.id}`}>{film.name}<span aria-hidden="true">↘</span></a>)}</nav>
    </header>
    <div className={styles.films}>{films.map((film,index)=><section key={film.id} id={film.id} className={styles.film} aria-labelledby={`${film.id}-title`}>
      <div className={styles.caption}><div><span className={styles.number}>0{index+1}</span><h2 id={`${film.id}-title`}>{film.name}</h2></div><span className={styles.duration}>Extreme cut · 18 seconds</span></div>
      <video controls playsInline preload="metadata" poster={`/launch-tests/media/${film.id}-extreme.jpg`} width={1920} height={1080} aria-label={`${film.name} extreme launch film`} aria-describedby={`${film.id}-description`}>
        <source src={`/launch-tests/media/${film.id}-extreme.mp4`} type="video/mp4"/>
        Your browser does not support embedded video. <a href={`/launch-tests/media/${film.id}-extreme.mp4`}>Open the film.</a>
      </video>
      <div className={styles.details}><div><h3>{index===0?'Hard electro. Acid type. UI shrapnel.':index===1?'Candy chaos. Flying forms. Big impacts.':'Task tornado. Smash zooms. Red-hot rhythm.'}</h3><p id={`${film.id}-description`}>{film.description}</p></div><a href={`/launch-tests/media/${film.id}-extreme.mp4`} download={`${film.id}-extreme-launch.mp4`}>Download extreme cut <span aria-hidden="true">↓</span></a></div>
      <details className={styles.description}><summary>Read the product story</summary><p>{film.transcript}</p><p>The extreme version surrounds this product story with fast camera moves, oversized animated type and layers of moving shapes. Interactions are illustrative.</p></details>
      <details className={styles.original}><summary>Compare with the original <span>24 seconds ↗</span></summary>
        <p>{film.mood}</p>
        <video controls playsInline preload="none" poster={`/launch-tests/media/${film.id}.jpg`} width={1920} height={1080} aria-label={`${film.name} original launch film`}>
          <source src={`/launch-tests/media/${film.id}.mp4`} type="video/mp4"/>
          Your browser does not support embedded video. <a href={`/launch-tests/media/${film.id}.mp4`}>Open the original.</a>
        </video>
        <a className={styles.originalDownload} href={`/launch-tests/media/${film.id}.mp4`} download={`${film.id}-original-launch.mp4`}>Download original ↓</a>
      </details>
    </section>)}</div>
    <footer className={styles.footer}><p>These are individually art-directed HTML films with generated instrumental music. The extreme cuts add original synthesized percussion and transition sounds on a 160 BPM grid. Product interfaces are recreated from public sources, with illustrative interactions. These are creative studies, not successful automatic URL-to-video runs or official campaigns.</p><div><a href="/comparisons">View the reference comparisons ↗</a><a href="#main-content">Back to top ↑</a></div></footer>
  </main>;
}
