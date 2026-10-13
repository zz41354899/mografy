// Runs inside headless Chromium. Loads one compiled scene build and serves frames to Node.
// Frame bytes go back by POST to the host server, never through JSON or PNG.
import { createSceneRuntime, renderOutputFrame } from '@mografy/runtime';
import type { SceneModule, SceneRuntime, OutputSettings } from '@mografy/runtime';
import type { BeatGrid, ParameterValues } from '@mografy/core';

export interface LoadSpec {
  sceneUrl: string; assetBase: string; seed: number; renderScale: number;
  params: ParameterValues; fonts: { family: string; path: string; weight: number }[];
  audio?: BeatGrid | undefined;
}
export type Cell = { label: string; kind: 'raw'; t: number } | { label: string; kind: 'output'; k: number };
export interface SheetSpec { title: string[]; cells: Cell[]; columns: number; cellWidth: number; settings: OutputSettings }

let canvas: HTMLCanvasElement | undefined;
let runtime: SceneRuntime | undefined;
let spec: LoadSpec | undefined;

async function upload(token: string, data: BlobPart) {
  const response = await fetch(`/upload/${token}`, { method: 'POST', body: data });
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

const host = {
  async load(next: LoadSpec) {
    runtime?.dispose(); canvas?.remove();
    spec = next;
    const scene = await import(/* @vite-ignore */ next.sceneUrl) as SceneModule;
    canvas = document.createElement('canvas'); document.body.append(canvas);
    runtime = await createSceneRuntime(canvas, scene, {
      seed: next.seed, renderScale: next.renderScale, params: next.params, assetBase: next.assetBase, fonts: next.fonts, audio: next.audio,
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
  async raw(t: number, token: string) { await upload(token, rawPixels(t).data); },
  async rawHash(t: number) { return digest(rawPixels(t).data); },
  async output(k: number, settings: OutputSettings, token: string) { await upload(token, outputPixels(k, settings).data); },
  async png(cell: Cell, settings: OutputSettings, token: string) {
    const image = cell.kind === 'raw' ? rawPixels(cell.t) : outputPixels(cell.k, settings);
    const out = document.createElement('canvas'); out.width = image.width; out.height = image.height;
    out.getContext('2d')!.putImageData(image, 0, 0);
    await upload(token, await new Promise<Blob>((done, fail) => out.toBlob(b => b ? done(b) : fail(new Error('PNG encode failed')), 'image/png')));
  },
  /** Small raw frame as PNG, for project thumbnails. */
  async thumb(t: number, width: number, token: string) {
    const { canvas } = need();
    const image = rawPixels(t);
    const full = document.createElement('canvas'); full.width = image.width; full.height = image.height;
    full.getContext('2d')!.putImageData(image, 0, 0);
    const out = document.createElement('canvas'); out.width = width; out.height = Math.round(width * canvas.height / canvas.width);
    const c = out.getContext('2d')!; c.imageSmoothingQuality = 'high'; c.drawImage(full, 0, 0, out.width, out.height);
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
