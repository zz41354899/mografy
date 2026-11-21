// The scene module contract: meta and parameter definitions.
import { z } from 'zod';
import { color, localPath } from './schema-parts.js';

const shotSchema = z.strictObject({
  /** When the shot ends (the next one starts). */
  end: z.number().finite().positive(),
  /** Its stop frame: a settled moment the review sheet shows. Default: one frame before `end`, or `end` for the last shot. */
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
/** Layer motions; the same list as MOTIONS in @mografy/runtime's timeline (a runtime test keeps them equal). */
export const layerMotionSchema = z.enum(['none', 'fade', 'fade-up', 'pop', 'blur-in', 'wipe']);
const layerId = z.string().regex(/^[\w-]{1,64}$/);
const seconds = z.number().finite().nonnegative().max(3600);
export const layerEditSchema = z.strictObject({
  name: z.string().trim().min(1).max(120).optional(), in: seconds.optional(), out: seconds.optional(),
  enter: layerMotionSchema.optional(), exit: layerMotionSchema.optional(), hidden: z.boolean().optional(), colour: color.optional(), locked: z.boolean().optional(),
});
export type LayerEdit = z.infer<typeof layerEditSchema>;
/** What the timeline editor writes to the scene's timeline file. Animation stays in the scene; this holds only changes. */
export const timelineEditsSchema = z.strictObject({
  layers: z.record(layerId, layerEditSchema).optional(),
  added: z.array(z.strictObject({ id: layerId, base: layerId })).max(200).optional(),
  removed: z.array(layerId).max(400).optional(),
  order: z.array(layerId).max(400).optional(),
  /** New shot ends for a scene without layers; the scene's own time is stretched to fit (shotWarp in @mografy/runtime). */
  shots: z.array(z.number().finite().positive().max(3600)).min(1).max(200).refine(e => e.every((v, i) => i === 0 || v > e[i - 1]!), 'Shot ends must increase').optional(),
});
export type TimelineEdits = z.infer<typeof timelineEditsSchema>;
export const timelineLayerSchema = z.strictObject({
  id: layerId, base: layerId, name: z.string().max(120), in: seconds, out: seconds,
  enter: layerMotionSchema, exit: layerMotionSchema, hidden: z.boolean(), locked: z.boolean(),
  colour: color.optional(), source: z.string().max(200).optional(), subtitles: z.array(z.string()).max(32),
  edited: z.array(layerEditSchema.keyof()),
});
export type TimelineLayer = z.infer<typeof timelineLayerSchema>;
/** `meta.layers`: what `timeline(...).meta` from @mografy/runtime returns. */
export const layersMetaSchema = z.strictObject({
  file: localPath.regex(/\.json$/, 'The timeline file must be a .json file'),
  layers: z.array(timelineLayerSchema).max(400),
  edits: timelineEditsSchema,
  /** The layers are the scene's shots in order (shotSequence): they stay contiguous, and cutting one shortens the film. */
  sequence: z.boolean().optional(),
});
export type LayersMeta = z.infer<typeof layersMetaSchema>;
export const sceneMetaSchema = z.strictObject({
  width: z.number().int().min(2).max(7680),
  height: z.number().int().min(2).max(7680),
  duration: z.number().finite().positive().max(3600),
  /** Preview stepping only. Output frame rate lives in mografy.json render settings. */
  fps: z.number().int().min(1).max(240),
  background: color,
  /** The scene's shots, in order: the timeline marks them and review shows each one's stop frame; video ignores them. */
  shots: shotsSchema.optional(),
  /** The tempo the scene is timed to. `ctx.beat` uses it when the project has no audio; `mografy check` compares it with `audio`. */
  tempo: tempoSchema.optional(),
  /** The film is a loop: its last frame equals its first. `mografy check --motion` then also checks the seam. */
  loop: z.boolean().optional(),
  /** Editable layers from `timeline(...)` in @mografy/runtime; the editor's timeline shows and edits them. */
  layers: layersMetaSchema.optional(),
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
