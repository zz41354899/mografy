import { z } from 'zod';

/** Project-relative path: no absolute paths, drive letters, backslashes or `..` segments. */
const localPath = z.string().min(1).refine(
  p => !p.startsWith('/') && !p.includes('\\') && !p.split('/').includes('..') && !p.includes(':'),
  'Use a project-relative path',
);
const color = z.string().regex(/^#[\da-f]{6}$/i);
const scalar = z.union([z.number().finite(), z.string(), z.boolean()]);

// ---------------------------------------------------------------- scene module contract

const shotSchema = z.strictObject({
  /** When the shot ends (the next one starts). */
  end: z.number().finite().positive(),
  /** Where its slide waits: a settled frame. Default: one frame before `end`, or `end` for the last shot. */
  stop: z.number().finite().nonnegative().optional(),
  title: z.string().max(120).optional(),
});
const shotsSchema = z.array(shotSchema).min(1).max(200).refine(shots => shots.every((shot, i) => i === 0 || shot.end > shots[i - 1]!.end), 'Shot ends must be in increasing time order');
export const sceneMetaSchema = z.strictObject({
  width: z.number().int().min(2).max(7680),
  height: z.number().int().min(2).max(7680),
  duration: z.number().finite().positive().max(3600),
  /** Preview stepping only. Output frame rate lives in mografy.json render settings. */
  fps: z.number().int().min(1).max(240),
  background: color,
  /** The scene's shots, in order. Present mode makes one slide per shot; video ignores them. */
  shots: shotsSchema.optional(),
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

// ---------------------------------------------------------------- mografy.json (configuration only)

export const renderSettingsSchema = z.strictObject({
  /** Device pixels per logical pixel for output capture. */
  scale: z.number().finite().min(0.1).max(4).default(1),
  /** Parallel capture segments. */
  workers: z.number().int().min(1).max(8).default(2),
  /** Output frame rate. */
  fps: z.number().int().min(1).max(120).default(30),
  /** Equal-weight samples per output frame (4 × 30fps = 120 samples per second). */
  samples: z.number().int().min(1).max(16).default(4),
  mixing: z.enum(['srgb', 'linear']).default('srgb'),
  bitrate: z.string().regex(/^\d+(\.\d+)?[kM]$/).default('12M'),
  glow: z.number().finite().min(0).max(1).default(0.12),
  grain: z.number().finite().min(0).max(0.1).default(0.008),
  encoding: z.enum(['two-pass', 'crf']).default('two-pass'),
  preset: z.enum(['ultrafast', 'veryfast', 'fast', 'medium', 'slow']).default('medium'),
  crf: z.number().int().min(0).max(51).default(18),
  includeAudio: z.boolean().default(true),
});
export type RenderSettings = z.infer<typeof renderSettingsSchema>;
export const exportFormatSchema = z.enum(['mp4', 'webm', 'lottie', 'svga']);
export type ExportFormat = z.infer<typeof exportFormatSchema>;
export type VideoFormat = Extract<ExportFormat, 'mp4' | 'webm'>;
export const isVideoFormat = (format: ExportFormat): format is VideoFormat => format === 'mp4' || format === 'webm';
/** WebM uses quality-based VP9 by default rather than inheriting the MP4 bitrate target. */
export const WEBM_DEFAULTS = { encoding: 'crf', crf: 32, preset: 'medium' } as const;
export const EXPORT_MAX_FPS = { mp4: 60, webm: 60, lottie: 30, svga: 30 } as const;
export const SVGA_FRAME_RATES = [1, 2, 3, 5, 6, 10, 12, 15, 20, 30] as const;
export function validateExportFrameRate(format: ExportFormat, fps: number) {
  if (!Number.isInteger(fps) || fps < 1 || fps > EXPORT_MAX_FPS[format])
    throw new Error(`${format === 'lottie' ? 'Lottie' : format.toUpperCase()} frame rate must be between 1 and ${EXPORT_MAX_FPS[format]} fps.`);
  if (format === 'svga' && !SVGA_FRAME_RATES.some(rate => rate === fps))
    throw new Error(`SVGA frame rate must be one of ${SVGA_FRAME_RATES.join(', ')}.`);
}
export const EXPORT_SIZES = {
  lottie: [{ width: 256, height: 256, name: 'Square' }, { width: 640, height: 360, name: 'Landscape' }],
  svga: [{ width: 375, height: 375, name: 'Square' }, { width: 375, height: 750, name: 'Portrait' }],
  webm: [{ width: 1280, height: 720, name: '720p' }, { width: 1920, height: 1080, name: '1080p' }],
  mp4: [{ width: 1280, height: 720, name: '720p' }, { width: 1920, height: 1080, name: '1080p' }],
} as const;
export const MP4_PORTRAIT_SIZES = EXPORT_SIZES.mp4.map(size => ({ ...size, width: size.height, height: size.width }));
/** Output viewport only; the scene keeps its logical dimensions. */
export const exportSizeSchema = z.strictObject({
  width: z.number().int().min(2).max(7680),
  height: z.number().int().min(2).max(7680),
  fit: z.enum(['contain', 'cover', 'reflow']).default('contain'),
});
export type ExportSize = z.infer<typeof exportSizeSchema>;
export const renderOverridesSchema = z.strictObject({
  scale: renderSettingsSchema.shape.scale.unwrap().optional(),
  workers: renderSettingsSchema.shape.workers.unwrap().optional(),
  fps: renderSettingsSchema.shape.fps.unwrap().optional(),
  samples: renderSettingsSchema.shape.samples.unwrap().optional(),
  mixing: renderSettingsSchema.shape.mixing.unwrap().optional(),
  bitrate: renderSettingsSchema.shape.bitrate.unwrap().optional(),
  glow: renderSettingsSchema.shape.glow.unwrap().optional(),
  grain: renderSettingsSchema.shape.grain.unwrap().optional(),
  encoding: renderSettingsSchema.shape.encoding.unwrap().optional(),
  preset: renderSettingsSchema.shape.preset.unwrap().optional(),
  crf: renderSettingsSchema.shape.crf.unwrap().optional(),
  includeAudio: renderSettingsSchema.shape.includeAudio.unwrap().optional(),
});
export const exportRequestSchema = z.strictObject({
  format: exportFormatSchema.default('mp4'),
  output: localPath.optional(),
  size: exportSizeSchema.optional(),
  render: renderOverridesSchema.optional(),
}).superRefine((request, ctx) => {
  if (request.render?.fps === undefined) return;
  try { validateExportFrameRate(request.format, request.render.fps); }
  catch (error) { ctx.addIssue({ code: 'custom', path: ['render', 'fps'], message: (error as Error).message }); }
});
export type ExportRequest = z.input<typeof exportRequestSchema>;
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
export type Shot = NonNullable<SceneMeta['shots']>[number];
/** Problems that need the scene's duration: shots the scene cannot reach. */
export function shotIssues(meta: Pick<SceneMeta, 'duration' | 'shots'>): string[] {
  return (meta.shots ?? []).flatMap((shot, i) => [
    ...(shot.end > meta.duration + 1e-6 ? [`Shot ${i + 1} ends at ${shot.end}s, after the scene ends (${meta.duration}s).`] : []),
    ...(shot.stop !== undefined && (shot.stop > shot.end + 1e-6 || shot.stop <= (meta.shots![i - 1]?.end ?? 0) - 1e-6) ? [`Shot ${i + 1} stops at ${shot.stop}s, outside the shot.`] : []),
  ]);
}

export interface DeckSlide {
  index: number;
  /** The scene shot it comes from; its notes live at slides.pages[shot]. */
  shot: number;
  /** Where the transition into this slide starts (the previous stop, or 0). */
  start: number;
  /** The stop itself. */
  at: number;
  title: string; notes: string;
  /** Start of the replayed range while holding, or null to freeze. */
  loopFrom: number | null;
}
/**
 * One slide per shot of the scene, waiting at the shot's stop; a scene without shots is one slide.
 * Shots past the end are dropped, stops are kept in order, loops are clamped to their slide.
 */
export function deckSlides(meta: Pick<SceneMeta, 'duration' | 'fps' | 'shots'>, slides?: Slides): DeckSlide[] {
  const { duration } = meta, frame = 1 / meta.fps;
  const shots = (meta.shots ?? []).filter(shot => shot.end <= duration + 1e-6);
  const list: Shot[] = shots.length ? shots : [{ end: duration }];
  const out: DeckSlide[] = [];
  list.forEach((shot, i) => {
    const last = i === list.length - 1, start = out.at(-1)?.at ?? 0;
    const at = Math.min(duration, shot.stop ?? (last && shot.end >= duration - 1e-6 ? duration : Math.max(0, shot.end - frame)));
    if (out.length && at <= start + 1e-6) return;
    const page = slides?.pages[i], hold = page?.hold ?? slides?.hold ?? 'freeze', index = out.length;
    const loopFrom = hold === 'freeze' || at - start < 0.1 ? null : Math.max(start, at - hold.loop);
    out.push({ index, shot: i, start, at, title: page?.title ?? shot.title ?? `Slide ${index + 1}`, notes: page?.notes ?? '', loopFrom });
  });
  return out;
}

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

// HTTP request contracts reuse project schemas without applying defaults to omitted patch fields.
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

// ---------------------------------------------------------------- parameters

function checkValue(d: ParameterDefinition, value: unknown): value is ParameterValue {
  if (typeof value !== typeof d.default) return false;
  switch (d.type) {
    case 'number': return Number.isFinite(value) && (value as number) >= d.min && (value as number) <= d.max;
    case 'color': return /^#[\da-f]{6}$/i.test(String(value));
    case 'enum': return d.options.includes(String(value));
    case 'string': return String(value).length <= 4096;
    case 'boolean': return true;
  }
}
/** Strict: unknown ids or invalid values throw. Missing values use defaults. */
export function resolveParams(definitions: ParameterDefinitions, values: ParameterValues): Readonly<ParameterValues> {
  const defs = parameterDefinitionsSchema.parse(definitions);
  for (const id of Object.keys(values)) if (!(id in defs)) throw new Error(`Unknown parameter: ${id}`);
  const result: ParameterValues = {};
  for (const [id, d] of Object.entries(defs)) {
    const value = values[id] ?? d.default;
    if (!checkValue(d, value)) throw new Error(`Invalid parameter: ${id}`);
    result[id] = value;
  }
  return Object.freeze(result);
}
export interface ParameterIssue { id: string; value: ParameterValue; reason: 'removed' | 'type-changed' | 'out-of-range' }
/**
 * After a scene update, keep saved values that still fit the new definitions.
 * Values for removed or incompatible parameters are dropped and reported.
 */
export function reconcileParams(definitions: ParameterDefinitions, values: ParameterValues): { values: ParameterValues; issues: ParameterIssue[] } {
  const defs = parameterDefinitionsSchema.parse(definitions);
  const kept: ParameterValues = {}, issues: ParameterIssue[] = [];
  for (const [id, value] of Object.entries(values)) {
    const d = defs[id];
    if (!d) issues.push({ id, value, reason: 'removed' });
    else if (typeof value !== typeof d.default) issues.push({ id, value, reason: 'type-changed' });
    else if (!checkValue(d, value)) issues.push({ id, value, reason: 'out-of-range' });
    else kept[id] = value;
  }
  return { values: kept, issues };
}

// ---------------------------------------------------------------- time, frames, beats

/** Number of output frames for a duration. */
export const outputFrameCount = (duration: number, fps: number) => Math.max(1, Math.ceil(duration * fps - 1e-9));
/** Centered, non-overlapping sample times for output frame k: (S·k + j + 0.5) / (S·fps). */
export function sampleTimes(k: number, fps: number, samples: number): number[] {
  const rate = fps * samples;
  return Array.from({ length: samples }, (_, j) => (samples * k + j + 0.5) / rate);
}
/** Split [0, frames) into contiguous ranges on output-frame boundaries. */
export function segmentFrames(frames: number, workers: number): { start: number; end: number }[] {
  const count = Math.max(1, Math.min(workers, frames));
  return Array.from({ length: count }, (_, i) => ({ start: Math.floor(frames * i / count), end: Math.floor(frames * (i + 1) / count) }));
}

export interface BeatGrid { bpm: number; offset: number; beatsPerBar?: number | undefined }
export interface BeatPosition { beat: number; bar: number; beatInBar: number; phase: number; period: number }
/** Beat index counts from the beat at `offset`; negative before it. phase is 0..1 within the beat. */
export function beatAt(t: number, grid: BeatGrid): BeatPosition {
  if (!Number.isFinite(t) || !(grid.bpm > 0)) throw new Error('Invalid beat query');
  const period = 60 / grid.bpm, per = grid.beatsPerBar ?? 4, x = (t - grid.offset) / period;
  // Snap values within 1e-9 of a beat so sampling exactly on a beat is stable.
  const near = Math.round(x), position = Math.abs(x - near) < 1e-9 ? near : x;
  const beat = Math.floor(position);
  return { beat, bar: Math.floor(beat / per), beatInBar: ((beat % per) + per) % per, phase: position - beat, period };
}
/** Beat times within [0, duration]. */
export function beatTimes(duration: number, grid?: BeatGrid): number[] {
  if (!grid) return [];
  const period = 60 / grid.bpm;
  const first = Math.ceil((0 - grid.offset) / period - 1e-9);
  const last = Math.floor((duration - grid.offset) / period + 1e-9);
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => grid.offset + (first + i) * period);
}

// ---------------------------------------------------------------- source checks

export interface SceneSourceIssue { line: number; rule: string; message: string }
const forbidden: [RegExp, string, string][] = [
  [/\bMath\.random\b/, 'unseeded-random', 'Math.random is not reproducible. Use ctx.random() in setup or ctx.noise() per frame.'],
  [/\bDate\.now\b|\bnew\s+Date\s*\(/, 'clock', 'Scenes cannot read the clock. Use the t passed to renderFrame.'],
  [/\bperformance\.now\b/, 'clock', 'Scenes cannot read the clock. Use the t passed to renderFrame.'],
  [/\b(requestAnimationFrame|setTimeout|setInterval)\s*\(/, 'async-timer', 'Scenes cannot schedule work. The picture comes only from renderFrame(t).'],
  [/\bcrypto\.getRandomValues\b|\brandomUUID\b/, 'unseeded-random', 'Unseeded randomness is not reproducible. Use ctx.noise().'],
];
/** Heuristic lint only. It does not prove renderFrame is pure; runtime guards and render comparisons do the rest. */
export function checkSceneSource(source: string): SceneSourceIssue[] {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
  const issues: SceneSourceIssue[] = [];
  stripped.split('\n').forEach((text, index) => {
    for (const [pattern, rule, message] of forbidden) if (pattern.test(text)) issues.push({ line: index + 1, rule, message });
  });
  return issues;
}
export type * from './protocol.js';
export { sceneRuntimeKey } from './scene-inputs.js';
export { GUIDE, SKILL, SKILL_REFERENCES, sharedSkillFiles, obsoleteStoryboardFiles, projectGuide, isLegacyAgentFile } from './guide.js';
export { autoShots, storyboardShots, pictureShotEnds, settledStop } from './auto-shots.js';
export type { AutoShots, AutoShotSource, MotionFrames } from './auto-shots.js';
