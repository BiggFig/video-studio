import type { Metadata } from 'next';
import { lab } from '../data';
import { ViewerReview } from './viewer-review';

export const metadata: Metadata = { title: 'Film viewer test', robots: { index: false, follow: false } };

export default async function ViewerPage({ searchParams }: { searchParams: Promise<{ film?: string }> }) {
  const { film: filmId } = await searchParams;
  const film = lab.films.find(item => item.id === filmId) ?? lab.films[0];
  return <ViewerReview film={{ id: film.id, placements: film.placements, baseline: film.baseline, control: film.control }} />;
}
