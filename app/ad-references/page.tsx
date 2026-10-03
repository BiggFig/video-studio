import type { Metadata } from 'next';
import { adReferences } from '@/lib/ad-references/data';
import { ReferencePortfolio } from './reference-portfolio';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Ad references — a closer look at the hook',
  description: 'Source-attributed ad studies: the opening hook, scene-by-scene timing, and ideas to apply to our next product films.',
  robots: { index: false, follow: false },
};

export default function AdReferencesPage() {
  const brands = new Set(adReferences.map(reference => reference.advertiser)).size;
  const scenes = adReferences.reduce((count, reference) => count + reference.scenes.length, 0);
  return <main id="main-content" className={styles.page}>
    <nav className={styles.topNav} aria-label="Main navigation">
      <a className={styles.brand} href="/">Video Studio<span className={styles.brandDot} aria-hidden="true" /></a>
      <a className={styles.navLink} href="/launch-tests">Our product films <span aria-hidden="true">↗</span></a>
    </nav>
    <header className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>The reference shelf / Meta ad creative</p>
        <h1>What earns<br /><span>the next second?</span></h1>
        <p className={styles.intro}>A closer look at how real ads open, move, and make their point. Follow each creative from its first frame to its final ask, then see what we can bring to our own product films.</p>
      </div>
      <aside className={styles.heroNote} aria-label="How to use these studies">
        <span className={styles.noteIndex} aria-hidden="true">01 — 03</span>
        <ol>
          <li><strong>Find the hook.</strong><span>What makes the opening worth a look?</span></li>
          <li><strong>Follow the proof.</strong><span>How does the product earn its promise?</span></li>
          <li><strong>Apply the idea.</strong><span>Carry the technique into a new story.</span></li>
        </ol>
      </aside>
    </header>
    <div className={styles.overview}>
      <dl className={styles.stats}>
        <div><dt>References</dt><dd>{adReferences.length.toString().padStart(2, '0')}</dd></div>
        <div><dt>Advertisers</dt><dd>{brands.toString().padStart(2, '0')}</dd></div>
        <div><dt>Scene notes</dt><dd>{scenes.toString().padStart(2, '0')}</dd></div>
      </dl>
      <p>Creative observations, not performance rankings. Source and ad status are recorded as observed; availability can change.</p>
    </div>
    <ReferencePortfolio references={adReferences} />
    <section className={styles.nextStep} aria-labelledby="next-film-title">
      <div><p className={styles.eyebrow}>From reference to our next cut</p><h2 id="next-film-title">Borrow the thinking.<br />Make the story our own.</h2><p>Use a sharper opening, a more deliberate reveal, or a clearer payoff. Our films keep their own product, evidence, and visual identity.</p></div>
      <a className={styles.primaryLink} href="/launch-tests">Watch our product films <span aria-hidden="true">↗</span></a>
    </section>
    <footer className={styles.footer}>
      <p>Independent creative commentary. Advertisers retain ownership of their work. Open the attributed source to watch the original; any storyboard shown here is a limited excerpt for analysis.</p>
      <a href="#main-content">Back to top <span aria-hidden="true">↑</span></a>
    </footer>
  </main>;
}
