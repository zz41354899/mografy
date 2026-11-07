// Batch export options and the queue request they make. The dialog lives in BatchExportDialog.tsx.
import { EXPORT_PRESETS } from '@mografy/core';
import type { ExportFormat, ExportPreset, QueueRequest } from '@mografy/core';

export type BatchFormat = ExportFormat;
/** How MP4s are encoded: each project's own encoder settings, or one preset for the whole batch. */
export type BatchEncoder = 'project' | Exclude<ExportPreset, 'master'>;
export interface BatchOptions {
  format: BatchFormat; encoder: BatchEncoder;
  /** Shorter side in pixels for video, or null for each project's own size. */
  shortSide: 720 | 1080 | null;
  /** null keeps each project's own value. */
  fps: number | null; samples: number | null;
  /** One capture segment per film: the least memory, a little slower. */
  lowMemory: boolean;
  includeAudio: boolean;
}
type Render = NonNullable<NonNullable<QueueRequest['request']>['render']>;
export function batchRequest(dirs: string[], o: BatchOptions): QueueRequest {
  const render: Render = {};
  if (o.format === 'mp4' && o.encoder !== 'project') Object.assign(render, EXPORT_PRESETS[o.encoder].render);
  if (o.format === 'mov') Object.assign(render, EXPORT_PRESETS.master.render);
  const raster = o.format === 'lottie' || o.format === 'svga';
  if (raster) Object.assign(render, { samples: 1, includeAudio: false });
  else if (!o.includeAudio) render.includeAudio = false;
  if (o.fps) render.fps = o.fps;
  if (o.samples && !raster) render.samples = o.samples;
  if (o.lowMemory) render.workers = 1;
  return { dirs, request: { format: o.format, ...(o.shortSide && !raster ? { shortSide: o.shortSide } : {}), ...(Object.keys(render).length ? { render } : {}) } };
}
