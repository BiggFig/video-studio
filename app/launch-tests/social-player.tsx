'use client';

import { useState } from 'react';
import styles from './page.module.css';

function initializePlayer(video: HTMLVideoElement | null) {
  if (!video) return;
  video.defaultMuted = true;
  video.muted = true;
  return () => video.pause();
}

export function SocialPlayer({ id, name }: { id: string; name: string }) {
  const [format, setFormat] = useState<'reels' | 'feed'>('reels');
  const path = `/launch-tests/media/${id}-social-${format}`;
  return <div className={styles.player}>
    <div className={styles.formatButtons} role="group" aria-label={`${name} video format`}>
      <button type="button" aria-pressed={format === 'reels'} onClick={() => setFormat('reels')}>Reels &amp; Stories <span>9:16</span></button>
      <button type="button" aria-pressed={format === 'feed'} onClick={() => setFormat('feed')}>Feed <span>4:5</span></button>
    </div>
    <div className={styles.screen}>
      <video ref={initializePlayer} key={format} className={format === 'reels' ? styles.reelsVideo : styles.feedVideo} controls muted playsInline preload="metadata" poster={`${path}.jpg`} width={1080} height={format === 'reels' ? 1920 : 1350} aria-label={`${name} ${format === 'reels' ? 'vertical' : 'feed'} ad`} aria-describedby={`${id}-description`}>
        <source src={`${path}.mp4`} type="video/mp4" />
        Your browser does not support embedded video. <a href={`${path}.mp4`}>Open the video.</a>
      </video>
    </div>
    <p className={styles.playerNote}>18 seconds · Starts muted · Sound available</p>
  </div>;
}
