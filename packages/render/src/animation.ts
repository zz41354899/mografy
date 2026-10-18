// Raster animation packages use the same browser runtime and post-processing as MP4.
// Canvas scenes cannot be losslessly inferred as editable vector animation.
import { createHash } from 'node:crypto';
import { deflate } from 'node:zlib';
import { promisify } from 'node:util';
import protobuf from 'protobufjs/minimal.js';
import { outputFrameCount, segmentFrames, validateExportFrameRate } from '@mografy/core';
import type { ExportFormat, ExportSize, SceneProject } from '@mografy/core';
import type { SceneBuild } from './build.js';
import { SceneHost } from './host.js';

const compress = promisify(deflate);
export const MAX_ANIMATION_FRAMES = 1200;
export const MAX_ANIMATION_PIXELS = 200_000_000;
const MAX_ASSET_BYTES = 64 * 1024 * 1024;
const MAX_SVGA_FRAME_ENTRIES = 200_000;
export interface AnimationJob {
  project: SceneProject; build: SceneBuild; host: SceneHost;
  format: Exclude<ExportFormat, 'mp4' | 'webm'>;
  signal?: AbortSignal;
  size?: ExportSize | undefined;
  onProgress?: (done: number, total: number, stage: 'capture' | 'package') => void;
}
export interface AnimationResult {
  data: Buffer; frames: number; fps: number; duration: number; width: number; height: number; assets: number;
}
export function validateAnimationSize(width: number, height: number, frames: number) {
  if (frames > MAX_ANIMATION_FRAMES || width * height * frames > MAX_ANIMATION_PIXELS)
    throw new Error('Frame-based animation is too large. Lower the resolution or frame rate (maximum 1,200 frames and 200 million frame pixels).');
}

interface RasterAsset { id: string; png: Buffer }
interface RasterFrames { width: number; height: number; fps: number; images: RasterAsset[]; frameAssets: string[]; name: string }

/** Standard image layers with one-frame visibility. PNG assets are embedded, so the JSON is portable. */
export function encodeLottie(movie: RasterFrames): Buffer {
  const { width: w, height: h, fps: fr, frameAssets, images } = movie;
  const staticValue = (k: number | number[]) => ({ a: 0, k });
  const layers = frameAssets.map((refId, k) => ({
    ddd: 0, ind: k + 1, ty: 2, nm: `Frame ${k + 1}`, refId, sr: 1,
    ks: { o: staticValue(100), r: staticValue(0), p: staticValue([0, 0, 0]), a: staticValue([0, 0, 0]), s: staticValue([100, 100, 100]) },
    ao: 0, ip: k, op: k + 1, st: 0, bm: 0,
  }));
  return Buffer.from(JSON.stringify({ v: '5.12.2', fr, ip: 0, op: frameAssets.length, w, h, nm: movie.name, ddd: 0,
    assets: images.map(({ id, png }) => ({ id, w, h, u: '', p: `data:image/png;base64,${png.toString('base64')}`, e: 1 })), layers, markers: [],
  }));
}

// Wire field numbers follow https://github.com/svga/SVGA-Format/blob/master/proto/svga.proto.
// Using the minimal protobuf writer avoids generated code and any scene execution in Node.
export async function encodeSvga(movie: RasterFrames): Promise<Buffer> {
  const { Writer } = protobuf;
  const writer = Writer.create();
  writer.uint32(10).string('2.0');
  writer.uint32(18).fork().uint32(13).float(movie.width).uint32(21).float(movie.height)
    .uint32(24).int32(movie.fps).uint32(32).int32(movie.frameAssets.length).ldelim();
  for (const { id, png } of movie.images) writer.uint32(26).fork().uint32(10).string(id).uint32(18).bytes(png).ldelim();
  // A sprite's imageKey is fixed. Its full frame table toggles visibility for that image.
  // Hidden entries are empty protobuf messages (alpha defaults to zero).
  for (const { id } of movie.images) {
    writer.uint32(34).fork().uint32(10).string(id);
    for (const asset of movie.frameAssets) {
      writer.uint32(18).fork();
      if (asset === id) {
        writer.uint32(13).float(1);
        writer.uint32(18).fork().uint32(29).float(movie.width).uint32(37).float(movie.height).ldelim();
        writer.uint32(26).fork().uint32(13).float(1).uint32(37).float(1).ldelim();
      }
      writer.ldelim();
    }
    writer.ldelim();
  }
  // SVGA 2 is a zlib-compressed MovieEntity, not a zip or JSON renamed to .svga.
  return compress(Buffer.from(writer.finish()));
}

export async function renderAnimation(job: AnimationJob): Promise<AnimationResult> {
  const project = structuredClone(job.project), settings = project.render;
  validateExportFrameRate(job.format, settings.fps);
  const probe = await job.host.open(job.build, project, { renderScale: settings.scale, outputSize: job.size });
  const { width, height, meta } = probe.scene;
  await probe.close();
  const frames = outputFrameCount(meta.duration, settings.fps);
  validateAnimationSize(width, height, frames);
  const captured = new Array<Buffer>(frames);
  let bytes = 0, done = 0, failure: unknown;
  await Promise.allSettled(segmentFrames(frames, settings.workers).map(async segment => {
    const page = await job.host.open(job.build, project, { renderScale: settings.scale, outputSize: job.size });
    try {
      for (let k = segment.start; k < segment.end; k++) {
        if (failure) break;
        if (job.signal?.aborted) throw new Error('Render cancelled');
        const png = await page.png({ kind: 'output', k, label: '' }, settings);
        bytes += png.length;
        if (bytes > MAX_ASSET_BYTES) throw new Error('Animation images exceed 64 MB. Lower the resolution or frame rate, or reduce grain.');
        captured[k] = png;
        job.onProgress?.(++done, frames, 'capture');
      }
    } catch (error) { failure ??= error; }
    finally { await page.close(); }
  })).then(results => { for (const r of results) if (r.status === 'rejected') failure ??= r.reason; });
  if (failure) throw failure;
  if (job.signal?.aborted) throw new Error('Render cancelled');
  job.onProgress?.(frames, frames, 'package');
  const unique = new Map<string, RasterAsset>();
  const frameAssets = captured.map(png => {
    const hash = createHash('sha256').update(png).digest('hex');
    if (!unique.has(hash)) unique.set(hash, { id: `image_${unique.size}`, png });
    return unique.get(hash)!.id;
  });
  if (job.format === 'svga' && unique.size * frames > MAX_SVGA_FRAME_ENTRIES)
    throw new Error('SVGA has too many image frame entries for lightweight playback. Lower the frame rate (maximum 200,000 sprite frames).');
  const movie = { width, height, fps: settings.fps, frameAssets, images: [...unique.values()], name: project.name };
  const data = job.format === 'lottie' ? encodeLottie(movie) : await encodeSvga(movie);
  return { data, frames, fps: settings.fps, duration: frames / settings.fps, width, height, assets: unique.size };
}
