export const hookLabels = {
  problem: 'A recognisable problem',
  question: 'A direct question',
  demonstration: 'Product in action',
  outcome: 'The result first',
  contrast: 'Before / after',
  curiosity: 'An open loop',
  'social-proof': 'Social proof',
  offer: 'A specific offer',
  other: 'Other approach',
} as const;

export type HookType = keyof typeof hookLabels;

export interface AdScene {
  id: string;
  startSeconds: number;
  endSeconds: number;
  title: string;
  visual: string;
  motion: string;
  copy?: string;
  purpose: string;
}

/** Editorial observations, never an assertion of campaign performance. */
export interface AdReference {
  id: string;
  advertiser: string;
  title: string;
  sourceType: 'direct-meta' | 'archive';
  sourceUrl: string;
  metaLibraryUrl?: string;
  durationSeconds: number;
  observedAt: string;
  statusObserved: string;
  hook: {
    type: HookType;
    description: string;
    startSeconds: number;
    endSeconds: number;
  };
  scenes: AdScene[];
  mechanism: string;
  howWeApply: string[];
  observation: {
    method: 'full-video' | 'sampled-frames';
    coverage: string;
    audioReviewed: boolean;
    limitations: string[];
  };
  /** Publish only approved, attributed commentary excerpts under public/ad-references. */
  poster?: { src: string; alt: string; caption: string };
  /** An optional link to a stable public host, never an embedded or copied full video. */
  videoUrl?: string;
}
