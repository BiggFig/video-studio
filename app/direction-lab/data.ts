import manifest from '@/public/direction-lab/manifest.json';
import type { LabManifest } from './types';

// Public, versioned research metadata; no private source media or provider state.
export const lab = manifest as LabManifest;
