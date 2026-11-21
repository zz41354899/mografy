// mografy.json: configuration only, never animation.
import { z } from 'zod';
import { renderSettingsSchema } from './export-settings.js';
import { aspectRatioSchema } from './scene-meta.js';
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

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colour must be #rrggbb').transform(v => v.toLowerCase());
/** Colour swaps from the colour panel: a colour the scene draws with → the colour to draw instead. */
export const colorSwapsSchema = z.record(hexColor, hexColor);

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
  colors: colorSwapsSchema.optional(),
  render: renderSettingsSchema.default(renderSettingsSchema.parse({})),
  review: reviewSchema.default(reviewSchema.parse({})),
  /** Settings of the former Present mode. Kept when an older project has them, never read. */
  slides: z.unknown().optional(),
});
export type SceneProject = z.infer<typeof sceneProjectSchema>;
export type SceneProjectInput = z.input<typeof sceneProjectSchema>;
export const validateSceneProject = (input: unknown): SceneProject => sceneProjectSchema.parse(input);
