// HTTP request contracts reuse project schemas without applying defaults to omitted patch fields.
import { z } from 'zod';
import { exportFormatSchema, exportSizeSchema, renderOverridesSchema } from './export-settings.js';
import { audioSchema, reviewSchema, slidesSchema, sceneProjectSchema } from './project-schema.js';
import { aspectRatioSchema } from './scene-meta.js';
import { scalar } from './schema-parts.js';

export const projectPatchSchema = z.strictObject({
  name: sceneProjectSchema.shape.name.optional(),
  params: z.record(z.string(), scalar.nullable()).optional(),
  seed: sceneProjectSchema.shape.seed.unwrap().optional(),
  aspectRatio: aspectRatioSchema.nullable().optional(),
  audio: audioSchema.nullable().optional(),
  render: renderOverridesSchema.optional(),
  review: z.strictObject({
    times: reviewSchema.shape.times.unwrap().optional(),
    transitions: reviewSchema.shape.transitions.unwrap().optional(),
  }).optional(),
  /** Replaces all presentation stops; null removes them. */
  slides: slidesSchema.nullable().optional(),
});
export type ProjectPatch = z.infer<typeof projectPatchSchema>;
const clientId = z.string().optional();
const time = z.number().finite().nonnegative();
export const projectPatchRequestSchema = z.strictObject({ patch: projectPatchSchema, revision: z.string().optional(), clientId });
/** Distinguish a malformed HTTP envelope (400) from invalid project settings (422). */
export const projectPatchEnvelopeSchema = z.strictObject({ patch: z.record(z.string(), z.unknown()), revision: z.string().optional(), clientId });
export const openProjectRequestSchema = z.strictObject({ dir: z.string().min(1) });
/** Batch export from the player: projects to export one after another, each with the same request (no file name). */
export const queueRequestSchema = z.strictObject({
  dirs: z.array(z.string().min(1)).min(1).max(200),
  request: z.strictObject({
    format: exportFormatSchema.default('mp4'),
    size: exportSizeSchema.optional(),
    /** Video only: scale each film so its shorter side has this many pixels, keeping its own aspect ratio (landscape and portrait films can share one batch). */
    shortSide: z.union([z.literal(720), z.literal(1080), z.literal(1440), z.literal(2160)]).optional(),
    render: renderOverridesSchema.optional(),
  }).default({ format: 'mp4' }),
});
export type QueueRequest = z.input<typeof queueRequestSchema>;
export const queueCancelSchema = z.strictObject({ id: z.string().min(1).optional() });
export const newProjectRequestSchema = z.strictObject({ name: z.string().trim().min(1).max(80), aspectRatio: aspectRatioSchema.optional() });
export const sourceRequestSchema = z.strictObject({ files: z.record(z.string(), z.string().max(1_000_000)).refine(files => Object.keys(files).length > 0, 'No files submitted') });
export const playheadRequestSchema = z.strictObject({ playhead: time, clientId });
export const seekRequestSchema = z.strictObject({ t: time, clientId });
export const cancelRenderRequestSchema = z.strictObject({ id: z.string().optional() });
export const sheetRequestSchema = z.strictObject({
  times: z.array(z.number().finite()).min(1).max(48).optional(),
  transition: z.strictObject({ start: z.number().finite(), end: z.number().finite(), step: z.number().finite().positive().optional() })
    .refine(value => value.end >= value.start, 'Transition end must not precede start').optional(),
  kind: z.enum(['raw', 'output']).optional(),
});
