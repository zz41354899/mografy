// mografy.json: configuration only, never animation.
import { z } from 'zod';
import { renderSettingsSchema } from './export-settings.js';
import { shotsSchema, aspectRatioSchema } from './scene-meta.js';
import { localPath, scalar } from './schema-parts.js';

export const audioSchema = z.strictObject({
  path: localPath,
  bpm: z.number().finite().positive().max(1000),
  /** Time in seconds of a beat (the grid origin). May be negative. */
  offset: z.number().finite().default(0),
  beatsPerBar: z.number().int().min(1).max(32).default(4),
  gain: z.number().finite().min(0).max(4).default(1),
});
export const transitionSchema = z.strictObject({
  name: z.string().max(80).optional(),
  start: z.number().finite().nonnegative(),
  end: z.number().finite().nonnegative(),
  step: z.number().finite().positive().default(1 / 30),
}).refine(t => t.end > t.start, 'Transition end must be after start');
export const reviewSchema = z.strictObject({
  times: z.array(z.number().finite().nonnegative()).max(64).default([0]),
  transitions: z.array(transitionSchema).max(32).default([]),
});

/** At a stop the picture freezes, or keeps replaying the last `loop` seconds before the stop (never past the previous stop). */
const slideHoldSchema = z.union([z.literal('freeze'), z.strictObject({ loop: z.number().finite().positive().max(60) })]);
/** Present mode's own notes on one slide (a shot of the scene). */
export const slidePageSchema = z.strictObject({
  title: z.string().max(120).optional(),
  notes: z.string().max(4000).optional(),
  hold: slideHoldSchema.optional(),
});
/** Presentation settings. The slides themselves are the scene's shots; video export ignores all of this. */
export const slidesSchema = z.strictObject({
  hold: slideHoldSchema.default('freeze'),
  /** duck: music plays during transitions and fades out at each stop. off: silent presentation. */
  music: z.enum(['duck', 'off']).default('duck'),
  /** pages[i] belongs to shot i: title override, speaker notes, how it waits. */
  pages: z.array(slidePageSchema).max(200).default([]),
  /** Shots for a scene whose `meta` lists none (the scene's own shots win). `mografy update` writes Mografy's guess here. */
  shots: shotsSchema.optional(),
  /** Set while `shots` is Mografy's guess; remove it after correcting the shots by hand. */
  guessedFrom: z.enum(['storyboard', 'picture']).optional(),
});
export type Slides = z.infer<typeof slidesSchema>;
export type SlidePage = z.infer<typeof slidePageSchema>;
/**
 * mografy.json stores project configuration only.
 * Animation content lives in the scene module; this file never stores layers or keyframes.
 */
export const sceneProjectSchema = z.strictObject({
  version: z.literal(1),
  name: z.string().min(1),
  scene: localPath.regex(/\.[cm]?[jt]s$/, 'Scene entry must be a .ts or .js module'),
  /** Composition canvas; absent uses the scene module's native dimensions. */
  aspectRatio: aspectRatioSchema.optional(),
  seed: z.number().int().min(0).max(0xffffffff).default(1),
  params: z.record(z.string(), scalar).default({}),
  fonts: z.array(z.strictObject({ family: z.string().min(1), path: localPath, weight: z.number().int().min(1).max(1000).default(400) })).default([]),
  audio: audioSchema.optional(),
  render: renderSettingsSchema.default(renderSettingsSchema.parse({})),
  review: reviewSchema.default(reviewSchema.parse({})),
  slides: slidesSchema.optional(),
});
export type SceneProject = z.infer<typeof sceneProjectSchema>;
export type SceneProjectInput = z.input<typeof sceneProjectSchema>;
export const validateSceneProject = (input: unknown): SceneProject => sceneProjectSchema.parse(input);
