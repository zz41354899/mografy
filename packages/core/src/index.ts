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

// ---------------------------------------------------------------- mografy.json (configuration only)

export const renderSettingsSchema = z.strictObject({
  /** Device pixels per logical pixel for output capture. */
  scale: z.number().finite().min(0.1).max(4).default(1),
  /** Parallel capture segments; `auto` picks from the CPU count and canvas (see exportWorkers). */
  workers: z.union([z.number().int().min(1).max(8), z.literal('auto')]).default('auto'),
  /** Output frame rate. */
  fps: z.number().int().min(1).max(120).default(30),
  /** Equal-weight samples per output frame (4 × 30fps = 120 samples per second). */
  samples: z.number().int().min(1).max(16).default(4),
  mixing: z.enum(['srgb', 'linear']).default('srgb'),
  /**
   * Shutter angle in degrees: the share of each frame interval the samples cover. 360 spreads them over the whole
   * interval (the long-standing look); 180 is the film convention, with shorter trails.
   */
  shutter: z.number().finite().min(1).max(360).default(360),
  /**
   * Where frame k's samples sit. `after` (the original timing): in the interval after k/fps, so the picture is
   * centred half a frame after its timestamp. `centred`: around k/fps, in step with the audio. Kept as `after`
   * by default so existing films render exactly as before.
   */
  sampleWindow: z.enum(['after', 'centred']).default('after'),
  /**
   * Frames whose first and last samples barely differ mix only those two. Decided by how far the change spreads,
   * so small fast objects keep every sample. Off by default.
   */
  adaptiveSamples: z.boolean().default(false),
  /**
   * Where export frames are drawn. 'cpu' is identical on every machine. 'gpu' rasterizes on the graphics card
   * (Metal on macOS, Direct3D 11 on Windows), with antialiased edges a little different; elsewhere it falls back to 'cpu'.
   */
  canvas: z.enum(['cpu', 'gpu']).default('cpu'),
  /** Ordered dither before the final 8-bit rounding: hides banding in soft gradients. Off by default (exact old output). */
  dither: z.boolean().default(false),
  bitrate: z.string().regex(/^\d+(\.\d+)?[kM]$/).default('12M'),
  glow: z.number().finite().min(0).max(1).default(0.12),
  grain: z.number().finite().min(0).max(0.1).default(0.008),
  /**
   * MP4 video codec (WebM is always VP9, MOV always ProRes). H.265 / HEVC is written 10-bit and keeps the same look in
   * a markedly smaller file; it plays in QuickTime, Safari, Chrome and Edge with hardware decoding, phones and social
   * uploads. H.264 (8-bit) also plays in Firefox, older players and Windows PCs without HEVC support.
   */
  codec: z.enum(['h265', 'h264']).default('h265'),
  /**
   * `crf`: software constant quality, encoded while frames are captured. `two-pass`: software target bitrate from a
   * lossless master (slower; for a fixed file size). `hardware`: the GPU's encoder (VideoToolbox, NVENC, Quick Sync,
   * AMF or VA-API), falling back to software constant quality where none works.
   */
  encoding: z.enum(['crf', 'two-pass', 'hardware']).default('crf'),
  preset: z.enum(['ultrafast', 'veryfast', 'fast', 'medium', 'slow']).default('medium'),
  crf: z.number().int().min(0).max(51).default(18),
  /** Hardware encoder quality, 1–100: higher keeps more detail in a larger file. 65 looks like libx265 CRF 14. */
  hardwareQuality: z.number().int().min(1).max(100).default(65),
  includeAudio: z.boolean().default(true),
});
export type RenderSettings = z.infer<typeof renderSettingsSchema>;
export const exportFormatSchema = z.enum(['mp4', 'webm', 'mov', 'lottie', 'svga']);
export type ExportFormat = z.infer<typeof exportFormatSchema>;
export type VideoFormat = Extract<ExportFormat, 'mp4' | 'webm' | 'mov'>;
export const isVideoFormat = (format: ExportFormat): format is VideoFormat => format === 'mp4' || format === 'webm' || format === 'mov';
/**
 * MP4 `crf` and `bitrate` are on the H.264 scale (the numbers existing projects and the quality presets use). Measured
 * on lossless masters of a 3D paper-texture film and a 2D motion film (docs/STATUS.md, 2026-10-31), libx265 at the
 * same CRF matched libx264's quality at 50–58 % of the size, so the CRF carries over unchanged; a two-pass target
 * takes 0.6 of the bitrate, a little above that ratio, so H.265 is never worse than the H.264 target.
 */
export const HEVC_EQUIVALENT = { crfOffset: 0, bitrateScale: 0.6 } as const;
/** The libx265 CRF and bitrate that match these H.264-scale settings. */
export function hevcQuality(settings: Pick<RenderSettings, 'crf' | 'bitrate'>) {
  const [, value, unit] = /^(\d+(?:\.\d+)?)([kM])$/.exec(settings.bitrate)!;
  const kbps = Math.max(1, Math.round(Number(value) * (unit === 'M' ? 1000 : 1) * HEVC_EQUIVALENT.bitrateScale));
  return { crf: Math.min(51, settings.crf + HEVC_EQUIVALENT.crfOffset), bitrate: `${kbps}k` };
}
/** WebM uses quality-based VP9 by default rather than inheriting the MP4 bitrate target. */
export const WEBM_DEFAULTS = { encoding: 'crf', crf: 32, preset: 'medium' } as const;
/**
 * Export presets. `share`: H.264 8-bit, plays everywhere. `high`: H.265 10-bit software encode (the MP4 default).
 * `fast`: the hardware H.265 encoder streamed during capture, GPU-drawn frames. `master`: ProRes 422 HQ in a MOV.
 */
export const EXPORT_PRESETS = {
  share: { format: 'mp4', render: { codec: 'h264', encoding: 'crf', dither: true } },
  high: { format: 'mp4', render: { codec: 'h265', encoding: 'crf', dither: true } },
  fast: { format: 'mp4', render: { codec: 'h265', encoding: 'hardware', hardwareQuality: 65, canvas: 'gpu', adaptiveSamples: false, dither: true } },
  master: { format: 'mov', render: { dither: false } },
} as const satisfies Record<string, { format: 'mp4' | 'mov'; render: Partial<RenderSettings> }>;
export type ExportPreset = keyof typeof EXPORT_PRESETS;
export const exportPresetSchema = z.enum(['share', 'high', 'fast', 'master']);
/** The MP4 preset these settings match, if any. */
export function mp4Preset(settings: Pick<RenderSettings, 'codec' | 'encoding'>): Exclude<ExportPreset, 'master'> | undefined {
  if (settings.encoding === 'hardware') return settings.codec === 'h265' ? 'fast' : undefined;
  if (settings.encoding !== 'crf') return undefined;
  return settings.codec === 'h264' ? 'share' : 'high';
}
/** Measured memory one 1080p capture segment holds at its peak (its Chromium page plus its encoder), in bytes. */
export const SEGMENT_MEMORY_1080P = 1.3 * 2 ** 30;
/** Measured memory every export holds whatever its segments: Chromium's browser process and Node. */
export const EXPORT_BASE_MEMORY = 0.9 * 2 ** 30;
/** Share of the computer's memory an `auto` export may plan for, leaving the rest to the system, the player and other apps. */
export const EXPORT_MEMORY_SHARE = 0.4;
/**
 * Capture segments for an export: the explicit count, or for `auto` one per two cores (CPU canvas, at most 6) or 3
 * (GPU: the graphics card is shared), and never more than 40% of the computer's memory holds. Each extra segment costs
 * about 1.3 GB at 1080p; past one per two cores it adds memory without adding speed (the CPU is already full).
 * `auto` budgets 40% of memory: the shared Chromium and Node (0.9 GB) plus 1.3 GB per 1080p segment.
 */
export function exportWorkers(settings: Pick<RenderSettings, 'workers' | 'canvas'>, cores: number, memory?: { total: number; pixels: number }) {
  if (settings.workers !== 'auto') return settings.workers;
  const byCores = settings.canvas === 'gpu' ? 3 : Math.max(1, Math.min(6, Math.floor(cores / 2)));
  if (!memory) return byCores;
  const perSegment = SEGMENT_MEMORY_1080P * Math.max(0.25, memory.pixels / (1920 * 1080));
  return Math.max(1, Math.min(byCores, Math.floor((memory.total * EXPORT_MEMORY_SHARE - EXPORT_BASE_MEMORY) / perSegment)));
}
export const EXPORT_MAX_FPS = { mp4: 60, webm: 60, mov: 60, lottie: 30, svga: 30 } as const;
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
  mov: [{ width: 1280, height: 720, name: '720p' }, { width: 1920, height: 1080, name: '1080p' }],
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
  shutter: renderSettingsSchema.shape.shutter.unwrap().optional(),
  sampleWindow: renderSettingsSchema.shape.sampleWindow.unwrap().optional(),
  adaptiveSamples: renderSettingsSchema.shape.adaptiveSamples.unwrap().optional(),
  canvas: renderSettingsSchema.shape.canvas.unwrap().optional(),
  dither: renderSettingsSchema.shape.dither.unwrap().optional(),
  bitrate: renderSettingsSchema.shape.bitrate.unwrap().optional(),
  glow: renderSettingsSchema.shape.glow.unwrap().optional(),
  grain: renderSettingsSchema.shape.grain.unwrap().optional(),
  codec: renderSettingsSchema.shape.codec.unwrap().optional(),
  encoding: renderSettingsSchema.shape.encoding.unwrap().optional(),
  preset: renderSettingsSchema.shape.preset.unwrap().optional(),
  crf: renderSettingsSchema.shape.crf.unwrap().optional(),
  hardwareQuality: renderSettingsSchema.shape.hardwareQuality.unwrap().optional(),
  includeAudio: renderSettingsSchema.shape.includeAudio.unwrap().optional(),
});
export const exportRequestSchema = z.strictObject({
  format: exportFormatSchema.default('mp4'),
  output: localPath.optional(),
  size: exportSizeSchema.optional(),
  render: renderOverridesSchema.optional(),
}).superRefine((request, ctx) => {
  if (request.size && isVideoFormat(request.format) && (request.size.width % 2 || request.size.height % 2))
    ctx.addIssue({ code: 'custom', path: ['size'], message: 'Video needs even pixel dimensions.' });
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

/** Differences between the tempo a scene is timed to and the project's audio grid. */
export function tempoIssues(meta: Pick<SceneMeta, 'tempo'>, audio?: Pick<z.infer<typeof audioSchema>, 'bpm' | 'offset' | 'beatsPerBar'>): string[] {
  const tempo = meta.tempo;
  if (!tempo || !audio) return [];
  const issues: string[] = [];
  if (Math.abs(tempo.bpm - audio.bpm) > 1e-6) issues.push(`The scene is timed to ${tempo.bpm} BPM (meta.tempo) but the audio is set to ${audio.bpm} BPM.`);
  if (Math.abs((tempo.offset ?? 0) - (audio.offset ?? 0)) > 1e-3) issues.push(`meta.tempo.offset is ${tempo.offset ?? 0}s but audio.offset is ${audio.offset ?? 0}s.`);
  if ((tempo.beatsPerBar ?? 4) !== (audio.beatsPerBar ?? 4)) issues.push(`meta.tempo has ${tempo.beatsPerBar ?? 4} beats per bar but audio has ${audio.beatsPerBar ?? 4}.`);
  return issues;
}

/** Frame budget used by `mografy check`: slower frames make the player stutter. */
export const FRAME_BUDGET = { slowMs: 100, filters: 8 } as const;
/** One summary line and the warnings for a measured frame cost. */
export function frameCostReport(cost: import('./protocol.js').FrameCost): { summary: string; warnings: string[] } {
  const worst = cost.slowest[0], at = (t: number) => `${t.toFixed(1)}s`;
  const summary = `Frame cost at ${cost.width}×${cost.height} (${cost.canvas.toUpperCase()} canvas, ${cost.frames} frames): median ${cost.medianMs} ms`
    + (worst ? `, slowest ${worst.ms} ms at ${at(worst.time)}` : '');
  const warnings: string[] = [];
  if (worst && worst.ms > FRAME_BUDGET.slowMs)
    warnings.push(`Frames take up to ${worst.ms} ms (${cost.slowest.map(s => at(s.time)).join(', ')}), so the player will stutter. Blur layers instead of setting ctx.filter, reuse buffers, and cache paths and text layout (performance reference).`);
  if (cost.maxFilters.count > FRAME_BUDGET.filters)
    warnings.push(`${cost.maxFilters.count} filters were set on the frame context in one frame (${at(cost.maxFilters.time)}). Each blurs every later draw separately: use blurLayer for groups and blurText for type.`);
  if (cost.canvasesPerFrame > 0)
    warnings.push(`renderFrame creates about ${cost.canvasesPerFrame} canvas${cost.canvasesPerFrame === 1 ? '' : 'es'} per frame. Reuse them with buffer() or layer() from @mografy/runtime.`);
  return { summary, warnings };
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
/**
 * Equal-weight sample times for output frame k: S evenly spaced, centred in sub-intervals of a window that covers
 * `shutter`/360 of the frame interval. With `after` the window is centred on (k + 0.5)/fps (with a 360° shutter,
 * exactly (S·k + j + 0.5) / (S·fps), the original timing); with `centred` it is centred on k/fps, in step with audio.
 */
export function sampleTimes(k: number, fps: number, samples: number, shutter = 360, window: 'after' | 'centred' = 'after'): number[] {
  const span = Math.min(360, Math.max(0, shutter)) / 360 / fps, centre = (window === 'centred' ? k : k + 0.5) / fps;
  if (span === 1 / fps && window === 'after') return Array.from({ length: samples }, (_, j) => (samples * k + j + 0.5) / (fps * samples));
  return Array.from({ length: samples }, (_, j) => Math.max(0, centre + ((j + 0.5) / samples - 0.5) * span));
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
export { frameDiffs, smoothness, smoothnessReport, MOTION_LIMITS } from './smoothness.js';
export type { Smoothness, SmoothnessOptions, MotionEvent, MotionEventKind } from './smoothness.js';
