// Runs inside headless Chromium. Loads one compiled scene build and serves frames to Node.
// Frame bytes go back by POST to the host server, never through JSON or PNG.
import { outputFrameCount, sampleTimes } from '@mografy/core';
import { createSceneRuntime, renderOutputFrame } from '@mografy/runtime';
import type { SceneModule, SceneRuntime, OutputSettings } from '@mografy/runtime';
import type { BeatGrid, ExportSize, FrameCost, ParameterValues, SceneProject } from '@mografy/core';

export interface LoadSpec {
  sceneUrl: string; assetBase: string; seed: number; renderScale: number;
  params: ParameterValues; fonts: { family: string; path: string; weight: number }[];
  audio?: BeatGrid | undefined;
  outputSize?: ExportSize | undefined;
  aspectRatio?: SceneProject['aspectRatio'];
  canvas?: 'cpu' | 'gpu' | undefined;
}
export type Cell = { label: string; kind: 'raw'; t: number } | { label: string; kind: 'output'; k: number };
export interface SheetSpec { title: string[]; cells: Cell[]; columns: number; cellWidth: number; settings: OutputSettings }

let canvas: HTMLCanvasElement | undefined;
let runtime: SceneRuntime | undefined;
let spec: LoadSpec | undefined;
let pipeline: OutputPipeline | undefined;

async function upload(token: string, data: BlobPart) {
  // A Blob body streams to the host without Chromium exposing it as request post data: about ten times
  // faster for a full frame than posting the typed array, and Playwright no longer holds a copy per request.
  const response = await fetch(`/upload/${token}`, { method: 'POST', body: data instanceof Blob ? data : new Blob([data]) });
  if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
}
async function digest(data: BufferSource) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(b => b.toString(16).padStart(2, '0')).join('');
}
function need() { if (!runtime || !canvas || !spec) throw new Error('Scene not loaded'); return { runtime, canvas, spec }; }
function rawPixels(t: number) {
  const { runtime, canvas } = need();
  runtime.render(t);
  return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
}
function outputPixels(k: number, settings: OutputSettings) {
  const { runtime, canvas, spec } = need();
  return new ImageData(renderOutputFrame(runtime, canvas, k, settings, spec.seed) as Uint8ClampedArray<ArrayBuffer>, canvas.width, canvas.height);
}

/**
 * Export path for output frames. The main thread only draws samples and reads them back; each frame's
 * buffers move (no copy) to one of two workers that mix and finish it. While a worker finishes frame k,
 * the main thread already draws frame k+1, so mixing, glow and grain no longer add to the frame time.
 * Same FrameAccumulator and finishFrame as renderOutputFrame, so the bytes are identical.
 */
class OutputPipeline {
  private workers = [0, 1].map(() => new Worker('/post-worker.js', { type: 'module' }));
  private replies = this.workers.map(() => [] as { resolve(data: ArrayBuffer): void; reject(error: Error): void }[]);
  private pending = new Map<string, Promise<ArrayBuffer>>();
  constructor() {
    this.workers.forEach((worker, i) => {
      const fail = (error: Error) => { for (const reply of this.replies[i]!.splice(0)) reply.reject(error); };
      worker.onmessage = ({ data }: MessageEvent<{ data?: ArrayBuffer; error?: string }>) => {
        const reply = this.replies[i]!.shift();
        if (data.error !== undefined) reply?.reject(new Error(data.error)); else reply?.resolve(data.data!);
      };
      worker.onerror = event => { event.preventDefault(); fail(new Error(`Output worker failed: ${event.message}`)); };
    });
  }
  private start(k: number, settings: OutputSettings) {
    const { runtime, canvas, spec } = need();
    const frames = outputFrameCount(runtime.meta.duration, settings.fps);
    if (!Number.isInteger(k) || k < 0 || k >= frames) throw new Error(`Output frame outside scene: ${k}`);
    const ctx = canvas.getContext('2d')!, i = k % 2, worker = this.workers[i]!;
    const { width, height } = canvas, space = settings.mixing;
    const done = new Promise<ArrayBuffer>((resolve, reject) => this.replies[i]!.push({ resolve, reject }));
    for (const t of sampleTimes(k, settings.fps, settings.samples)) {
      runtime.render(Math.min(t, runtime.meta.duration));
      const data = ctx.getImageData(0, 0, width, height).data.buffer;
      worker.postMessage({ type: 'add', width, height, space, data }, [data]);
    }
    worker.postMessage({ type: 'finish', settings: { glow: settings.glow, grain: settings.grain, seed: spec.seed, frame: k } });
    return done;
  }
  /** Frame k's finished RGBA. With `next`, also draws frame `next` before waiting, so its mixing overlaps. */
  async frame(k: number, settings: OutputSettings, next?: number) {
    const key = (n: number) => `${n} ${JSON.stringify(settings)}`;
    let job = this.pending.get(key(k));
    for (const stale of this.pending.keys()) if (stale !== key(next ?? -1)) this.pending.delete(stale);
    job ??= this.start(k, settings);
    if (next !== undefined && !this.pending.has(key(next))) {
      const ahead = this.start(next, settings);
      void ahead.catch(() => {});
      this.pending.set(key(next), ahead);
    }
    return job;
  }
  dispose() { for (const worker of this.workers) worker.terminate(); this.pending.clear(); }
}

const host = {
  /** The scene's exported meta and params, without running setup or drawing: what opening a project needs first. */
  async describe(sceneUrl: string) {
    const scene = await import(/* @vite-ignore */ sceneUrl) as SceneModule;
    return JSON.parse(JSON.stringify({ meta: scene.meta, params: scene.params ?? {} })) as { meta: unknown; params: unknown };
  },
  async load(next: LoadSpec) {
    runtime?.dispose(); canvas?.remove(); pipeline?.dispose(); pipeline = undefined;
    spec = next;
    const scene = await import(/* @vite-ignore */ next.sceneUrl) as SceneModule;
    canvas = document.createElement('canvas'); document.body.append(canvas);
    runtime = await createSceneRuntime(canvas, scene, {
      seed: next.seed, renderScale: next.renderScale, params: next.params, assetBase: next.assetBase, fonts: next.fonts, audio: next.audio,
      outputSize: next.outputSize,
      aspectRatio: next.aspectRatio,
      canvas: next.canvas,
    });
    return { meta: runtime.meta, params: runtime.definitions, width: canvas.width, height: canvas.height };
  },
  /** Trial render: start, middle, end, then the middle again to catch state carried between calls. */
  async trial() {
    const { runtime } = need(), d = runtime.meta.duration;
    const first = await digest(rawPixels(d / 2).data);
    rawPixels(0); rawPixels(d); rawPixels(d * 0.25);
    const again = await digest(rawPixels(d / 2).data);
    if (first !== again) throw new Error('renderFrame depends on earlier calls: the same time drew two different pictures. Draw only from t, params and data prepared in setup.');
    return first;
  },
  /**
   * Frame cost: draw frames spread over the film and time each one, within `budget` ms. Then draw a few of
   * them again and count canvases created (a warm frame should allocate none).
   */
  cost(budget = 4000) {
    const { runtime, canvas } = need(), d = runtime.meta.duration, ctx = canvas.getContext('2d')!;
    const times = Array.from({ length: 24 }, (_, i) => Math.min(d, Number((d * (i + .5) / 24).toFixed(3))));
    const measured: { time: number; ms: number; filters: number }[] = [];
    const began = performance.now();
    for (const time of times) {
      const t0 = performance.now();
      runtime.render(time); ctx.getImageData(0, 0, 1, 1);
      measured.push({ time, ms: performance.now() - t0, filters: runtime.stats().filters });
      if (performance.now() - began > budget) break;
    }
    const Native = globalThis.OffscreenCanvas, scope = globalThis as { OffscreenCanvas: typeof OffscreenCanvas };
    let created = 0;
    const repeat = measured.slice(0, 3);
    scope.OffscreenCanvas = class extends Native { constructor(w: number, h: number) { super(w, h); created++; } };
    try { for (const m of repeat) runtime.render(m.time); } finally { scope.OffscreenCanvas = Native; }
    const ms = measured.map(m => m.ms).sort((a, b) => a - b), round = (n: number) => Math.round(n * 10) / 10;
    const worst = measured.reduce((a, b) => b.filters > a.filters ? b : a, measured[0]!);
    return {
      width: canvas.width, height: canvas.height, canvas: need().spec.canvas ?? 'cpu',
      frames: measured.length, medianMs: round(ms[Math.floor(ms.length / 2)]!),
      slowest: [...measured].sort((a, b) => b.ms - a.ms).slice(0, 3).map(m => ({ time: m.time, ms: round(m.ms) })),
      maxFilters: { time: worst.time, count: worst.filters },
      canvasesPerFrame: repeat.length ? round(created / repeat.length) : 0,
    } satisfies FrameCost;
  },
  async raw(t: number, token: string) { await upload(token, rawPixels(t).data); },
  async rawHash(t: number) { return digest(rawPixels(t).data); },
  async output(k: number, settings: OutputSettings, token: string, next?: number) {
    pipeline ??= new OutputPipeline();
    await upload(token, await pipeline.frame(k, settings, next));
  },
  async png(cell: Cell, settings: OutputSettings, token: string) {
    const image = cell.kind === 'raw' ? rawPixels(cell.t) : outputPixels(cell.k, settings);
    const out = document.createElement('canvas'); out.width = image.width; out.height = image.height;
    out.getContext('2d')!.putImageData(image, 0, 0);
    await upload(token, await new Promise<Blob>((done, fail) => out.toBlob(b => b ? done(b) : fail(new Error('PNG encode failed')), 'image/png')));
  },
  /** Tiny greyscale raw frames, one after another, for finding where shots change. */
  async motion(times: number[], width: number, token: string) {
    const { canvas, runtime } = need();
    const out = document.createElement('canvas'); out.width = width; out.height = Math.max(1, Math.round(width * canvas.height / canvas.width));
    const c = out.getContext('2d', { willReadFrequently: true })!, size = out.width * out.height, grey = new Uint8Array(size * times.length);
    c.imageSmoothingQuality = 'low';
    for (const [i, t] of times.entries()) {
      runtime.render(t);
      c.fillStyle = '#000'; c.fillRect(0, 0, out.width, out.height); c.drawImage(canvas, 0, 0, out.width, out.height);
      const rgba = c.getImageData(0, 0, out.width, out.height).data;
      for (let p = 0; p < size; p++) grey[i * size + p] = (rgba[p * 4]! * 77 + rgba[p * 4 + 1]! * 150 + rgba[p * 4 + 2]! * 29) >> 8;
    }
    await upload(token, grey);
  },
  /** Small raw frame as PNG, for project thumbnails. */
  async thumb(t: number, width: number, token: string) {
    const { canvas, runtime } = need();
    runtime.render(t);
    const out = document.createElement('canvas'); out.width = width; out.height = Math.round(width * canvas.height / canvas.width);
    const c = out.getContext('2d')!; c.imageSmoothingQuality = 'high'; c.drawImage(canvas, 0, 0, out.width, out.height);
    await upload(token, await new Promise<Blob>((done, fail) => out.toBlob(b => b ? done(b) : fail(new Error('PNG encode failed')), 'image/png')));
  },
  /** Contact sheet with labels. Each cell is drawn from the exact raw or output pixels. */
  async sheet(sheet: SheetSpec, token: string) {
    const { canvas } = need();
    const cw = sheet.cellWidth, ch = Math.round(cw * canvas.height / canvas.width), pad = 16, labelH = 28, titleLine = 22;
    const columns = Math.min(sheet.columns, sheet.cells.length), rows = Math.ceil(sheet.cells.length / columns);
    const top = pad + sheet.title.length * titleLine + 8;
    const out = document.createElement('canvas');
    out.width = pad + columns * (cw + pad); out.height = top + rows * (ch + labelH + pad);
    const c = out.getContext('2d')!;
    c.fillStyle = '#16181d'; c.fillRect(0, 0, out.width, out.height);
    c.font = '15px ui-monospace, Menlo, monospace'; c.fillStyle = '#e7e9ee'; c.textBaseline = 'top';
    sheet.title.forEach((line, i) => c.fillText(line, pad, pad + i * titleLine, out.width - pad * 2));
    const tile = document.createElement('canvas'); tile.width = canvas.width; tile.height = canvas.height;
    for (const [i, cell] of sheet.cells.entries()) {
      const x = pad + (i % columns) * (cw + pad), y = top + Math.floor(i / columns) * (ch + labelH + pad);
      tile.getContext('2d')!.putImageData(cell.kind === 'raw' ? rawPixels(cell.t) : outputPixels(cell.k, sheet.settings), 0, 0);
      c.imageSmoothingQuality = 'high'; c.drawImage(tile, x, y, cw, ch);
      c.strokeStyle = cell.kind === 'raw' ? '#6aa0ff' : '#12b5a5'; c.lineWidth = 2; c.strokeRect(x - 1, y - 1, cw + 2, ch + 2);
      c.fillStyle = cell.kind === 'raw' ? '#9cc0ff' : '#c4f0a0'; c.fillText(cell.label, x, y + ch + 6, cw);
    }
    await upload(token, await new Promise<Blob>((done, fail) => out.toBlob(b => b ? done(b) : fail(new Error('PNG encode failed')), 'image/png')));
  },
};
export type HostApi = typeof host;
(window as unknown as { mografyHost: HostApi }).mografyHost = host;
