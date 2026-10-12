import type { Metadata } from 'next';
import { lab } from './data';
import { DirectionLab } from './review';

export const metadata: Metadata = {
  title: 'Direction lab — one story, every view',
  description: 'Review the Tally storyboard, compare placements, and follow the reusable motion engine work.',
  robots: { index: false, follow: false },
};

export default function DirectionLabPage() { return <DirectionLab manifest={lab} />; }
