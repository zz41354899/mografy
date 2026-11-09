// The scene module contract: meta and parameter definitions.
import { z } from 'zod';
import { color } from './schema-parts.js';

const shotSchema = z.strictObject({
  /** When the shot ends (the next one starts). */
  end: z.number().finite().positive(),
  /** Where its slide waits: a settled frame. Default: one frame before `end`, or `end` for the last shot. */
  stop: z.number().finite().nonnegative().optional(),
  title: z.string().max(120).optional(),
});
export const shotsSchema = z.array(shotSchema).min(1).max(200).refine(shots => shots.every((shot, i) => i === 0 || shot.end > shots[i - 1]!.end), 'Shot ends must be in increasing time order');
/** The scene's musical grid. Build timing constants from it with tempoGrid() from @mografy/runtime. */
export const tempoSchema = z.strictObject({
  bpm: z.number().finite().positive().max(1000),
  beatsPerBar: z.number().int().min(1).max(32).default(4),
  /** Time in seconds of a beat (the grid origin). */
  offset: z.number().finite().default(0),
});
export const sceneMetaSchema = z.strictObject({
  width: z.number().int().min(2).max(7680),
  height: z.number().int().min(2).max(7680),
  duration: z.number().finite().positive().max(3600),
  /** Preview stepping only. Output frame rate lives in mografy.json render settings. */
  fps: z.number().int().min(1).max(240),
  background: color,
  /** The scene's shots, in order. Present mode makes one slide per shot; video ignores them. */
  shots: shotsSchema.optional(),
  /** The tempo the scene is timed to. `ctx.beat` uses it when the project has no audio; `mografy check` compares it with `audio`. */
  tempo: tempoSchema.optional(),
  /** The film is a loop: its last frame equals its first. `mografy check --motion` then also checks the seam. */
  loop: z.boolean().optional(),
});
export type SceneMeta = z.infer<typeof sceneMetaSchema>;
export const aspectRatioSchema = z.enum(['16:9', '9:16']);
export type AspectRatio = z.infer<typeof aspectRatioSchema>;
/** Keep short-edge detail near the native size, with an exact ratio and valid bounds. */
export function sceneMetaForAspect(meta: SceneMeta, aspectRatio?: AspectRatio): SceneMeta {
  if (!aspectRatio) return meta;
  const unit = Math.min(480, Math.max(1, Math.round(Math.min(meta.width, meta.height) / 9)));
  const short = unit * 9, long = unit * 16;
  return sceneMetaSchema.parse({ ...meta, width: aspectRatio === '9:16' ? short : long, height: aspectRatio === '9:16' ? long : short });
}

const base = { name: z.string().min(1) };
export const parameterSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...base, type: z.literal('number'), default: z.number().finite(), min: z.number().finite(), max: z.number().finite(), step: z.number().finite().positive().optional() }),
  z.strictObject({ ...base, type: z.literal('color'), default: color }),
  z.strictObject({ ...base, type: z.literal('boolean'), default: z.boolean() }),
  z.strictObject({ ...base, type: z.literal('string'), default: z.string().max(4096), role: z.literal('subtitle').optional() }),
  z.strictObject({ ...base, type: z.literal('enum'), default: z.string(), options: z.array(z.string()).min(1) }),
]);
export type ParameterDefinition = z.infer<typeof parameterSchema>;
export const parameterDefinitionsSchema = z.record(z.string().regex(/^[a-zA-Z]\w*$/), parameterSchema).superRefine((defs, ctx) => {
  for (const [id, d] of Object.entries(defs)) {
    if (d.type === 'number' && (d.min > d.max || d.default < d.min || d.default > d.max)) ctx.addIssue({ code: 'custom', path: [id], message: 'Invalid range or default' });
    if (d.type === 'enum' && !d.options.includes(d.default)) ctx.addIssue({ code: 'custom', path: [id], message: 'Default must be an option' });
  }
});
export type ParameterDefinitions = z.infer<typeof parameterDefinitionsSchema>;
export type ParameterValue = number | string | boolean;
export type ParameterValues = Record<string, ParameterValue>;
