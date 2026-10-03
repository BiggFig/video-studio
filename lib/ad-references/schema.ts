import { z } from 'zod';
import { hookLabels } from './types';
import type { AdReference, HookType } from './types';

export type { AdReference, AdScene, HookType } from './types';

const text = z.string().trim().min(1);
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const seconds = z.number().finite().nonnegative();
const publicUrl = z.string().url().refine(value => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
}, 'Use an HTTPS source URL without embedded credentials.');
const metaUrl = publicUrl.refine(value => {
  const url = new URL(value);
  return /(^|\.)facebook\.com$/.test(url.hostname) && /^\/ads\/library(?:\/|$)/.test(url.pathname);
}, 'Use the actual Meta Ad Library page URL.');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Use a real observation date.');

export const adReferenceSchema = z.object({
  id,
  advertiser: text,
  title: text,
  sourceType: z.enum(['direct-meta', 'archive']),
  sourceUrl: publicUrl,
  metaLibraryUrl: metaUrl.optional(),
  durationSeconds: z.number().finite().positive(),
  observedAt: date,
  statusObserved: text,
  hook: z.object({
    type: z.enum(Object.keys(hookLabels) as [HookType, ...HookType[]]),
    description: text,
    startSeconds: seconds,
    endSeconds: seconds,
  }).strict(),
  scenes: z.array(z.object({
    id, startSeconds: seconds, endSeconds: seconds, title: text,
    visual: text, motion: text, copy: text.optional(), purpose: text,
  }).strict()).min(1),
  mechanism: text,
  howWeApply: z.array(text).min(1),
  observation: z.object({
    method: z.enum(['full-video', 'sampled-frames']),
    coverage: text,
    audioReviewed: z.boolean(),
    limitations: z.array(text),
  }).strict(),
  poster: z.object({
    src: z.string().regex(/^\/ad-references\/[a-zA-Z0-9_/-]+\.(?:jpg|jpeg|png|webp)$/),
    alt: text,
    caption: text,
  }).strict().optional(),
  videoUrl: publicUrl.optional(),
}).strict().superRefine((reference, ctx) => {
  if (reference.hook.endSeconds <= reference.hook.startSeconds || reference.hook.endSeconds > reference.durationSeconds) {
    ctx.addIssue({ code: 'custom', path: ['hook'], message: 'Hook timing must sit within the observed video.' });
  }
  const ids = new Set<string>();
  reference.scenes.forEach((scene, index) => {
    if (ids.has(scene.id)) ctx.addIssue({ code: 'custom', path: ['scenes', index, 'id'], message: 'Scene IDs must be unique within a reference.' });
    ids.add(scene.id);
    if (scene.endSeconds <= scene.startSeconds || scene.endSeconds > reference.durationSeconds) {
      ctx.addIssue({ code: 'custom', path: ['scenes', index], message: 'Scene timing must sit within the observed video.' });
    }
    if (index > 0 && scene.startSeconds < reference.scenes[index - 1].endSeconds) {
      ctx.addIssue({ code: 'custom', path: ['scenes', index], message: 'Scene ranges must be ordered and not overlap.' });
    }
  });
});

/** Validate contributed research together so cross-file duplicate IDs fail at build time. */
export function parseAdReferences(data: unknown): AdReference[] {
  const references = z.array(adReferenceSchema).parse(data);
  const ids = new Set<string>();
  for (const reference of references) {
    if (ids.has(reference.id)) throw new Error(`Duplicate ad reference ID: ${reference.id}`);
    ids.add(reference.id);
  }
  return references;
}
