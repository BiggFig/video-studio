import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Reference comparisons",
  description: "Watch four original references alongside Video Studio's motion reconstructions.",
  robots: { index: false, follow: false },
};

const studies = [
  { id: "original", name: "FilmLoop", duration: "22 seconds", description: "The original WhatsApp reference. Recreated product UI, typed responses, selection, pricing, and closing sequence." },
  { id: "elevenlabs", name: "ElevenAgents", duration: "28 seconds", description: "Pricing stacks, luminous materials, moving trays, and a continuous product reveal." },
  { id: "clickup", name: "ClickUp", duration: "11 seconds", description: "A selected sequence: the composer becomes an interaction, then opens into the larger workspace." },
  { id: "reception", name: "Reception", duration: "20 seconds", description: "A selected sequence: a sphere becomes a chat avatar, glass messages appear, and cards merge into the closing line." },
];

export default function ComparisonsPage() {
  return <main id="main-content" className={styles.page}>
    <header className={styles.header}>
      <a href="/" className={styles.brand}>Video Studio</a>
      <p className={styles.eyebrow}>Reference studies · October 2026</p>
      <h1>See the motion.<br />Compare the details.</h1>
      <p className={styles.intro}>Four references alongside our reconstructions. The original is on the left; our HTML engine is on the right.</p>
      <nav aria-label="Choose a comparison" className={styles.navigation}>{studies.map(study => <a key={study.id} href={`#${study.id}`}>{study.name}<span aria-hidden="true">↘</span></a>)}</nav>
    </header>
    <div className={styles.studies}>{studies.map((study, index) => <section key={study.id} id={study.id} className={styles.study} aria-labelledby={`${study.id}-title`}>
      <div className={styles.caption}>
        <div><span className={styles.number}>0{index + 1}</span><h2 id={`${study.id}-title`}>{study.name}</h2></div>
        <span className={styles.duration}>{study.duration}</span>
      </div>
      <video controls playsInline preload="metadata" poster={`/comparisons/media/${study.id}.jpg`} width={1920} height={590} aria-label={`${study.name}: original reference on the left, Video Studio reconstruction on the right`}>
        <source src={`/comparisons/media/${study.id}.mp4`} type="video/mp4" />
        Your browser does not support embedded video. <a href={`/comparisons/media/${study.id}.mp4`}>Open the comparison.</a>
      </video>
      <div className={styles.details}><p>{study.description}</p><a href={`/comparisons/media/${study.id}.mp4`} download={`${study.id}-comparison.mp4`}>Download video <span aria-hidden="true">↓</span></a></div>
    </section>)}</div>
    <footer className={styles.footer}><p>These are silent, manually authored design studies. Lighting, materials, and some motion timing remain approximations. They demonstrate the renderer, not automatic URL-to-video output.</p><a href="#main-content">Back to top ↑</a></footer>
  </main>;
}
