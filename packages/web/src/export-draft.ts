import { EXPORT_MAX_FPS, isVideoFormat, WEBM_DEFAULTS, EXPORT_SIZES, MP4_PORTRAIT_SIZES } from '@mografy/core';
import type { AspectRatio, ExportFormat, ExportSize, RenderSettings, SceneMeta } from '@mografy/core';

export type ExportQuality = 'draft' | 'standard' | 'high' | 'custom';
interface FormatDraft { size: ExportSize; settings: RenderSettings; quality: ExportQuality }
export interface ExportDraft { format: ExportFormat; formats: Record<ExportFormat, FormatDraft> }
export type ExportDraftAction =
  | { type: 'format'; format: ExportFormat }
  | { type: 'patch'; settings: Partial<RenderSettings> }
  | { type: 'quality'; quality: ExportQuality; base: RenderSettings }
  | { type: 'orientation'; ratio: AspectRatio }
  | { type: 'size'; size: Pick<ExportSize, 'width' | 'height'> }
  | { type: 'fit'; fit: ExportSize['fit'] };

export function createExportDraft(meta: SceneMeta, render: RenderSettings): ExportDraft {
  const raster = { ...render, fps: 20, samples: 1, includeAudio: false };
  const sizeOf = ({ width, height }: Pick<ExportSize, 'width' | 'height'>): ExportSize => ({ width, height, fit: 'contain' });
  return {
    format: 'mp4',
    formats: {
      mp4: { size: sizeOf(meta.height > meta.width ? MP4_PORTRAIT_SIZES[0]! : EXPORT_SIZES.mp4[0]), settings: { ...render, fps: Math.min(render.fps, EXPORT_MAX_FPS.mp4) }, quality: 'standard' },
      webm: { size: sizeOf(meta.height > meta.width ? MP4_PORTRAIT_SIZES[0]! : EXPORT_SIZES.webm[0]), settings: { ...render, ...WEBM_DEFAULTS, fps: Math.min(render.fps, EXPORT_MAX_FPS.webm) }, quality: 'standard' },
      lottie: { size: sizeOf(EXPORT_SIZES.lottie[0]), settings: { ...raster }, quality: 'standard' },
      svga: { size: sizeOf(EXPORT_SIZES.svga[0]), settings: { ...raster }, quality: 'standard' },
    },
  };
}

export function exportDraftReducer(state: ExportDraft, action: ExportDraftAction): ExportDraft {
  if (action.type === 'format') return { ...state, format: action.format };
  const format = state.format;
  if (action.type === 'orientation' && !isVideoFormat(format)) return state;
  const current = state.formats[format];
  let next: FormatDraft;
  switch (action.type) {
    case 'patch': next = { ...current, settings: { ...current.settings, ...action.settings }, quality: 'custom' }; break;
    case 'size': next = { ...current, size: { width: action.size.width, height: action.size.height, fit: current.size.fit } }; break;
    case 'fit': next = { ...current, size: { ...current.size, fit: action.fit } }; break;
    case 'orientation': {
      const short = Math.min(current.size.width, current.size.height), long = Math.max(current.size.width, current.size.height);
      next = { ...current, size: { width: action.ratio === '9:16' ? short : long, height: action.ratio === '9:16' ? long : short, fit: current.size.fit } };
      break;
    }
    case 'quality': {
      if (action.quality === 'custom') return state;
      const patch: Partial<RenderSettings> = action.quality === 'draft' ? { samples: 1, glow: 0, grain: 0, encoding: 'crf', crf: 23, preset: 'veryfast' }
        : action.quality === 'high' ? { samples: 8, glow: action.base.glow, grain: action.base.grain, encoding: 'crf', crf: 16, preset: 'slow' }
        : { samples: format === 'mp4' ? 4 : 1, glow: action.base.glow, grain: action.base.grain, encoding: 'two-pass', bitrate: action.base.bitrate, preset: 'medium' };
      if (format === 'webm') Object.assign(patch, { encoding: 'crf', crf: action.quality === 'draft' ? 38 : action.quality === 'high' ? 26 : 32, samples: action.quality === 'draft' ? 1 : action.quality === 'high' ? 8 : 4 });
      next = { ...current, settings: { ...current.settings, ...patch }, quality: action.quality };
      break;
    }
  }
  return { ...state, formats: { ...state.formats, [format]: next } };
}
