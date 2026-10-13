// Video output: parallel segment capture → FFV1 segments → lossless concat → two-pass H.264 (+ audio).
import { access, copyFile, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { outputFrameCount, segmentFrames } from '@mografy/core';
import type { SceneProject } from '@mografy/core';
import type { SceneBuild } from './build.js';
import { runFfmpeg, startFfmpeg } from './ffmpeg.js';
import { SceneHost } from './host.js';

export interface VideoJob {
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
}
export interface VideoResult { output: string; frames: number; fps: number; duration: number; width: number; height: number; version: string; segments: number; audio: boolean }

const nullDevice = process.platform === 'win32' ? 'NUL' : '/dev/null';

async function exists(path: string) { return access(path).then(() => true, () => false); }

/** Capture output frames [start, end) into one lossless FFV1 segment. */
async function captureSegment(host: SceneHost, job: VideoJob, start: number, end: number, file: string, onFrame: () => void) {
  const { project } = job, settings = project.render;
  const page = await host.open(job.build, project, { renderScale: settings.scale });
  const { width, height } = page.scene;
  const ffmpeg = startFfmpeg(['-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${width}x${height}`, '-framerate', String(settings.fps), '-i', 'pipe:0', '-c:v', 'ffv1', '-level', '3', '-g', '1', '-pix_fmt', 'bgr0', '-y', file], true);
  try {
    for (let k = start; k < end; k++) {
      if (job.signal?.aborted) throw new Error('Render cancelled');
      const rgba = await page.output(k, settings);
      if (rgba.length !== width * height * 4) throw new Error(`Frame ${k}: expected ${width * height * 4} bytes, got ${rgba.length}`);
      await ffmpeg.write(rgba);
      onFrame();
    }
    await ffmpeg.end();
  } catch (error) { ffmpeg.kill(); await ffmpeg.done.catch(() => {}); throw error; }
  finally { await page.close(); }
  return { width, height };
}

export async function renderVideo(job: VideoJob): Promise<VideoResult> {
  const project = structuredClone(job.project), settings = project.render;
  const output = resolve(job.output);
  if (extname(output).toLowerCase() !== '.mp4') throw new Error('Output must end with .mp4');
  if (!job.overwrite && await exists(output)) throw new Error(`Output already exists: ${output}`);
  const ownHost = !job.host, host = job.host ?? await SceneHost.start(job.projectDir);
  const work = await mkdtemp(join(tmpdir(), 'mografy-render-'));
  try {
    // Read meta once to plan the segments.
    const probe = await host.open(job.build, project, { renderScale: settings.scale });
    const { meta } = probe.scene, { width, height } = probe.scene;
    await probe.close();
    if (width % 2 || height % 2) throw new Error(`H.264 yuv420p needs even dimensions; got ${width}×${height} (meta × render.scale)`);
    const frames = outputFrameCount(meta.duration, settings.fps);
    const segments = segmentFrames(frames, settings.workers);
    let done = 0;
    const tick = () => job.onProgress?.(++done, frames, 'capture');
    const files = segments.map((_, i) => join(work, `segment-${String(i).padStart(2, '0')}.mkv`));
    const controller = new AbortController();
    const signal = job.signal ? AbortSignal.any([job.signal, controller.signal]) : controller.signal;
    const captures = await Promise.allSettled(segments.map(async (s, i) => {
      try { return await captureSegment(host, { ...job, project, signal }, s.start, s.end, files[i]!, tick); }
      catch (error) { controller.abort(); throw error; }
    }));
    const failed = captures.find(r => r.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    if (job.signal?.aborted) throw new Error('Render cancelled');

    // Lossless master: stream copy, no re-encode.
    const list = join(work, 'segments.txt');
    await writeFile(list, files.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
    const master = join(work, 'master.mkv');
    await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-y', master], job.signal);

    // Two-pass target bitrate from the same master; audio joins on pass 2 only.
    job.onProgress?.(frames, frames, 'encode');
    const length = frames / settings.fps;
    const passlog = join(work, 'x264');
    const twoPass = settings.encoding === 'two-pass';
    const video = ['-c:v', 'libx264', '-preset', settings.preset,
      ...(twoPass ? ['-b:v', settings.bitrate] : ['-crf', String(settings.crf)]), '-pix_fmt', 'yuv420p',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-r', String(settings.fps), '-passlogfile', passlog];
    if (twoPass) await runFfmpeg(['-i', master, '-an', ...video, '-pass', '1', '-f', 'mp4', '-y', nullDevice], job.signal);
    const audio = project.audio && settings.includeAudio ? resolve(job.projectDir, project.audio.path) : undefined;
    if (audio && !await exists(audio)) throw new Error(`Audio not found: ${project.audio!.path}`);
    const partial = join(work, 'out.mp4');
    await runFfmpeg([
      '-i', master, ...(audio ? ['-i', audio] : []),
      '-map', '0:v:0', ...(audio ? ['-map', '1:a:0', '-af', `volume=${project.audio!.gain},apad,atrim=0:${length}`, '-c:a', 'aac', '-b:a', '192k'] : ['-an']),
      ...video, ...(twoPass ? ['-pass', '2'] : []), '-t', String(length), '-movflags', '+faststart', '-y', partial,
    ], job.signal);
    await mkdir(dirname(output), { recursive: true });
    await rename(partial, output).catch(async error => {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
      await copyFile(partial, output);
    });
    return { output, frames, fps: settings.fps, duration: length, width, height, version: job.build.version, segments: segments.length, audio: !!audio };
  } finally {
    await rm(work, { recursive: true, force: true });
    if (ownHost) await host.close();
  }
}
