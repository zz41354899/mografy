// Video output: parallel segment capture, then either encoded segments joined by stream copy (streamed plans)
// or lossless FFV1 segments read back through the concat demuxer and encoded twice (two-pass).
// FFmpeg runs in the work folder and every file it names there is relative: no drive letters, backslashes or
// spaces reach option strings, the concat list or filter graphs on Windows.
import { access, copyFile, mkdir, mkdtemp, rename, rm, statfs, writeFile } from 'node:fs/promises';
import { availableParallelism, totalmem } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { exportWorkers, outputFrameCount, sampleTimes, segmentFrames, validateExportFrameRate } from '@mografy/core';
import type { ExportSize, SceneProject, VideoFormat } from '@mografy/core';
import { isLockedError, projectPaths, retryWhileLocked } from './fs-util.js';
import type { SceneBuild } from './build.js';
import { LOSSLESS, concatList, planCodec, segmentArgs } from './codecs.js';
import type { CodecPlan } from './codecs.js';
import { runFfmpeg, startFfmpeg } from './ffmpeg.js';
import { SceneHost, gpuCanvasAvailable } from './host.js';
import type { CanvasBacking } from './host.js';

export interface VideoJob {
  format?: VideoFormat;
  projectDir: string;
  /** Snapshot of the project at job start; later edits do not leak in. */
  project: SceneProject;
  build: SceneBuild;
  output: string;
  overwrite?: boolean;
  /** Reuse a running host (the server's); otherwise one is started and closed. */
  host?: SceneHost;
  onProgress?: (done: number, total: number, stage: 'capture' | 'encode') => void;
  signal?: AbortSignal;
  size?: ExportSize | undefined;
}
export interface VideoResult {
  output: string; frames: number; fps: number; duration: number; width: number; height: number; version: string; segments: number; audio: boolean;
  /** The encoder that wrote the video, e.g. `libx265` or `hevc_nvenc`. */
  encoder: string;
  /** Where frames were drawn (a GPU request falls back to the CPU where no GPU backend is set up). */
  canvas: CanvasBacking;
  /** Why the encoder differs from the one asked for, if it does. */
  note?: string | undefined;
  /** Seconds spent capturing (including streamed encoding), encoding a master, and adding audio. */
  timings: { capture: number; encode: number; mux: number };
}

const nullDevice = process.platform === 'win32' ? 'NUL' : '/dev/null';

async function exists(path: string) { return access(path).then(() => true, () => false); }

/** Capture output frames [start, end) into one segment file, encoded with `video` arguments. */
async function captureSegment(host: SceneHost, job: VideoJob, plan: CodecPlan, canvas: CanvasBacking, start: number, end: number, video: string[], work: string, file: string, onFrame: () => void) {
  const { project } = job, settings = project.render;
  const page = await host.open(job.build, project, { renderScale: settings.scale, outputSize: job.size, canvas });
  const { width, height } = page.scene;
  const ffmpeg = startFfmpeg(segmentArgs(width, height, settings.fps, plan, video, file), true, undefined, work);
  try {
    // A GPU page's first draw after load can differ from later ones (shader and buffer warm-up): draw once, unused.
    if (canvas === 'gpu') await page.rawHash(sampleTimes(start, settings.fps, 1)[0]!);
    for (let k = start; k < end; k++) {
      if (job.signal?.aborted) throw new Error('Render cancelled');
      const rgba = await page.outputFrame(k, settings, k + 1 < end ? k + 1 : undefined);
      if (rgba.length !== width * height * 4) throw new Error(`Frame ${k}: expected ${width * height * 4} bytes, got ${rgba.length}`);
      await ffmpeg.write(rgba);
      onFrame();
    }
    await ffmpeg.end();
  } catch (error) { ffmpeg.kill(); await ffmpeg.done.catch(() => {}); throw error; }
  finally { await page.close(); }
}

/** Refuse a two-pass master that would not fit: FFV1 of motion graphics is rarely above a byte per pixel. */
async function checkSpace(work: string, frames: number, width: number, height: number) {
  const need = frames * width * height;
  const info = await statfs(work).catch(() => undefined);
  if (info && info.bavail * info.bsize < need)
    throw new Error(`Not enough disk space for the two-pass master: about ${Math.ceil(need / 1024 ** 3)} GB needed, ${Math.floor(info.bavail * info.bsize / 1024 ** 3)} GB free. Use constant quality, or free some space.`);
}

/**
 * Move the finished file into place; across volumes, copy. On Windows a virus scanner or the search indexer can hold
 * a just-written file for a moment, so EPERM, EACCES and EBUSY are retried briefly before failing.
 */
async function place(partial: string, output: string) {
  await mkdir(dirname(output), { recursive: true });
  try { await retryWhileLocked(() => rename(partial, output)); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EXDEV') return copyFile(partial, output);
    if (isLockedError(error)) throw new Error(`Could not write ${output}: it may be open in another program. Close it and export again.`);
    throw error;
  }
}

export async function renderVideo(job: VideoJob): Promise<VideoResult> {
  const project = structuredClone(job.project), settings = project.render;
  const format = job.format ?? 'mp4';
  validateExportFrameRate(format, settings.fps);
  const output = resolve(job.output);
  if (extname(output).toLowerCase() !== `.${format}`) throw new Error(`Output must end with .${format}`);
  if (!job.overwrite && await exists(output)) throw new Error(`Output already exists: ${output}`);
  const plan = await planCodec(format, settings);
  const audioPath = project.audio && settings.includeAudio ? resolve(job.projectDir, project.audio.path) : undefined;
  if (audioPath && !await exists(audioPath)) throw new Error(`Audio not found: ${project.audio!.path}`);
  const canvas: CanvasBacking = settings.canvas === 'gpu' && gpuCanvasAvailable() ? 'gpu' : 'cpu';
  const ownHost = !job.host, host = job.host ?? await SceneHost.start(job.projectDir);
  // Work beside the project, on the same volume as renders/: the result moves into place without a copy.
  const temp = projectPaths(resolve(job.projectDir)).tmp;
  await mkdir(temp, { recursive: true });
  const work = await mkdtemp(join(temp, 'render-'));
  try {
    // Read meta once to plan the segments.
    const probe = await host.open(job.build, project, { renderScale: settings.scale, outputSize: job.size, canvas });
    const { meta } = probe.scene, { width, height } = probe.scene;
    await probe.close();
    if (width % 2 || height % 2) throw new Error(`Video needs even dimensions; got ${width}×${height} (meta × render.scale)`);
    const frames = outputFrameCount(meta.duration, settings.fps), length = frames / settings.fps;
    if (plan.mode === 'master') await checkSpace(work, frames, width, height);
    const segments = segmentFrames(frames, exportWorkers({ ...settings, canvas }, availableParallelism(), { total: totalmem(), pixels: width * height }));
    let done = 0;
    const tick = () => job.onProgress?.(++done, frames, 'capture');
    const extension = plan.mode === 'stream' ? plan.extension : 'mkv';
    const names = segments.map((_, i) => `segment-${String(i).padStart(2, '0')}.${extension}`);
    // Each segment's encoder gets its share of the cores instead of sizing itself for the whole machine (less memory).
    const threads = Math.max(1, Math.round(availableParallelism() / segments.length));
    const video = plan.mode === 'stream' ? plan.video(undefined, threads) : LOSSLESS;
    const controller = new AbortController();
    const signal = job.signal ? AbortSignal.any([job.signal, controller.signal]) : controller.signal;
    const began = performance.now();
    const captures = await Promise.allSettled(segments.map(async (s, i) => {
      try { await captureSegment(host, { ...job, project, signal }, plan, canvas, s.start, s.end, video, work, names[i]!, tick); }
      catch (error) { controller.abort(); throw error; }
    }));
    const failed = captures.find(r => r.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    if (job.signal?.aborted) throw new Error('Render cancelled');
    const captured = performance.now();

    job.onProgress?.(frames, frames, 'encode');
    await writeFile(join(work, 'segments.txt'), concatList(names));
    const joined = ['-f', 'concat', '-safe', '0', '-i', 'segments.txt'];
    const audio = audioPath
      ? ['-i', audioPath, '-map', '0:v:0', '-map', '1:a:0', '-af', `volume=${project.audio!.gain},apad,atrim=0:${length}`, ...plan.audio]
      : ['-an'];
    const container = plan.extension === 'webm' ? [] : ['-movflags', '+faststart'];
    const partial = `out.${format}`;
    if (plan.mode === 'stream') {
      await runFfmpeg([...joined, ...audio, '-c:v', 'copy', ...(plan.extension === 'mp4' ? ['-tag:v', plan.encoder.includes('264') ? 'avc1' : 'hvc1'] : []), '-t', String(length), ...container, '-y', partial], job.signal, work);
    } else {
      await runFfmpeg([...joined, '-an', ...plan.video(1), '-r', String(settings.fps), '-f', plan.extension === 'webm' ? 'webm' : 'mp4', '-y', nullDevice], job.signal, work);
      await runFfmpeg([...joined, ...audio, ...plan.video(2), '-r', String(settings.fps), '-t', String(length), ...container, '-y', partial], job.signal, work);
    }
    // Streamed plans encode while capturing, so their encode time is 0; two-pass encodes (and adds audio) here.
    const finished = performance.now(), encoded = plan.mode === 'stream' ? captured : finished;
    await place(join(work, partial), output);
    return {
      output, frames, fps: settings.fps, duration: length, width, height, version: job.build.version, segments: segments.length, audio: !!audioPath,
      encoder: plan.encoder, canvas, note: plan.note,
      timings: { capture: (captured - began) / 1000, encode: (encoded - captured) / 1000, mux: (finished - encoded) / 1000 },
    };
  } finally {
    // Windows keeps a just-killed FFmpeg's files locked for a moment; a leftover temp folder must not fail the export.
    await rm(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }).catch(() => {});
    if (ownHost) await host.close();
  }
}

