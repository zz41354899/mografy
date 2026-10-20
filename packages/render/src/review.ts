// Visual review: raw stills sheet, post-processed sheet, transition strips, browser↔video PSNR.
import { access, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { outputFrameCount, resolveParams } from '@mografy/core';
import type { SceneProject } from '@mografy/core';
import type { SceneBuild } from './build.js';
import { ffmpegOutput } from './ffmpeg.js';
import { SceneHost } from './host.js';
import type { Cell } from './host-page.js';

export interface ReviewJob {
  projectDir: string; project: SceneProject; build: SceneBuild; host?: SceneHost; outputDir?: string;
  /** Video of this exact version to compare by PSNR. Without it, review renders sheets only. */
  video?: string | undefined;
  /** Server-owned projects provide atomicWrite so every review artifact is committed through the project queue. */
  write?: (path: string, data: string | Buffer) => Promise<void>;
}
export interface FrameComparison { frame: number; time: number; psnr: number }
export interface ReviewResult { files: string[]; report: string; comparisons: FrameComparison[]; version: string }

/** PSNR over RGB of an RGBA page frame and an rgb24 decoded video frame. */
export function psnr(rgba: Uint8Array, rgb: Uint8Array) {
  const pixels = rgba.length / 4;
  if (rgb.length !== pixels * 3) throw new Error('Frame size mismatch');
  let sum = 0;
  for (let p = 0; p < pixels; p++) for (let c = 0; c < 3; c++) { const d = rgba[p * 4 + c]! - rgb[p * 3 + c]!; sum += d * d; }
  const mse = sum / (pixels * 3);
  return mse === 0 ? Infinity : 10 * Math.log10(255 * 255 / mse);
}

export async function renderReview(job: ReviewJob): Promise<ReviewResult> {
  const { project, build } = job, settings = project.render;
  const ownHost = !job.host, host = job.host ?? await SceneHost.start(job.projectDir);
  const outDir = resolve(job.outputDir ?? join(job.projectDir, 'renders'));
  await mkdir(outDir, { recursive: true });
  const page = await host.open(build, project, { renderScale: settings.scale });
  try {
    const { meta, params: definitions } = page.scene;
    const values = resolveParams(definitions, project.params);
    const frames = outputFrameCount(meta.duration, settings.fps);
    const tag = build.version.slice(0, 8);
    const title = [
      `${project.name}, scene version ${build.version}`,
      `seed ${project.seed}, params ${JSON.stringify(values)}`,
      `output ${settings.fps} fps with ${settings.samples} samples per frame, ${settings.mixing} mixing, glow ${settings.glow}, grain ${settings.grain}, scale ${settings.scale}`,
    ];
    const times = project.review.times.map(t => Math.min(Math.max(0, t), meta.duration));
    const frameOf = (t: number) => Math.min(frames - 1, Math.floor(t * settings.fps + 1e-9));
    const files: string[] = [];
    const write = job.write ?? writeFile;
    const save = async (name: string, data: Buffer) => { const file = join(outDir, name); await write(file, data); files.push(file); };
    const columns = Math.min(4, Math.max(1, times.length));

    await save(`review-${tag}-stills.png`, await page.sheet({
      title: ['Raw stills (single moment, no post-processing)', ...title], columns, cellWidth: 420, settings,
      cells: times.map((t): Cell => ({ kind: 'raw', t, label: `t=${t.toFixed(3)}s raw` })),
    }));
    await save(`review-${tag}-output.png`, await page.sheet({
      title: [`Final frames (${settings.samples}-sample blend, glow, grain)`, ...title], columns, cellWidth: 420, settings,
      cells: times.map((t): Cell => { const k = frameOf(t); return { kind: 'output', k, label: `frame ${k}, ${(k / settings.fps).toFixed(3)}–${((k + 1) / settings.fps).toFixed(3)}s final` }; }),
    }));
    for (const [i, tr] of project.review.transitions.entries()) {
      const cells: Cell[] = [];
      for (let t = tr.start; t <= Math.min(tr.end, meta.duration) + 1e-9 && cells.length < 48; t += tr.step) cells.push({ kind: 'raw', t: Math.min(t, meta.duration), label: `t=${t.toFixed(3)}s, frame ${frameOf(t)}` });
      await save(`review-${tag}-transition-${i + 1}.png`, await page.sheet({
        title: [`Transition ${tr.name ?? i + 1}: ${tr.start}–${tr.end}s every ${tr.step.toFixed(3)}s (raw)`, ...title], columns: 6, cellWidth: 280, settings, cells,
      }));
    }

    // Compare only a video known to belong to this version. An older export under renders/ would
    // give meaningless PSNR and, decoding from the first frame for every sample, make review slow.
    const comparisons: FrameComparison[] = [];
    const video = job.video;
    if (video && await access(video).then(() => true, () => false)) {
      const { width, height } = page.scene;
      for (const k of [...new Set(times.map(frameOf))]) {
        const decoded = await ffmpegOutput(['-i', video, '-vf', `select=eq(n\\,${k})`, '-vsync', '0', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${width}x${height}`, 'pipe:1']);
        const expected = await page.output(k, settings);
        comparisons.push({ frame: k, time: k / settings.fps, psnr: Number(psnr(expected, decoded).toFixed(2)) });
      }
    }
    const report = join(outDir, `review-${tag}.json`);
    await write(report, JSON.stringify({ name: project.name, version: build.version, seed: project.seed, params: values, render: settings, video: comparisons.length ? video : null, comparisons, files }, null, 2) + '\n');
    return { files, report, comparisons, version: build.version };
  } finally {
    await page.close();
    if (ownHost) await host.close();
  }
}

/** File-safe name for default outputs. */
export function slug(name: string) {
  return name.trim().replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '') || 'mografy';
}
