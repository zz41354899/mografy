// Render settings and the export policy built on them.
import { z } from 'zod';
import { localPath } from './schema-parts.js';

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
type RenderShape = typeof renderSettingsSchema.shape;
/** Each setting, optional and without its default; derived so a new setting cannot be forgotten here. */
const renderOverrides = Object.fromEntries(Object.entries(renderSettingsSchema.shape).map(([key, field]) => [key, field.unwrap().optional()])) as {
  [K in keyof RenderShape]: z.ZodOptional<ReturnType<RenderShape[K]['unwrap']>>;
};
export const renderOverridesSchema = z.strictObject(renderOverrides);
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
