import { beatAt, exportSizeSchema, parameterDefinitionsSchema, resolveParams, sceneMetaForAspect, sceneMetaSchema } from '@mografy/core';
import type { AspectRatio } from '@mografy/core';
import type { BeatGrid, BeatPosition, ExportSize, SceneMeta, ParameterDefinitions, ParameterValues } from '@mografy/core';
import { hashNoise, seededRandom } from './math.js';
import { createDrawing } from './draw.js';
import type { DrawingApi } from './draw.js';

export interface SetupContext {
  width: number; height: number; seed: number;
  /** Stateful seeded random. Only for one-time preparation in setup. */
  random(): number;
  /** Resolve a project-relative asset path to a URL. */
  asset(path: string): string;
  loadImage(path: string): Promise<ImageBitmap>;
  /** Prepared data. Frozen after setup returns. */
  assets: Record<string, unknown>;
}
export interface FrameContext {
  /** 2D context in logical coordinates. Effect lengths (shadow*, filter px) are logical too. */
  canvas: CanvasRenderingContext2D;
  /** Convenience drawing API, bound to this canvas and reset for every frame. */
  draw: DrawingApi;
  width: number; height: number; renderScale: number; seed: number;
  assets: Readonly<Record<string, unknown>>;
  /** Order-independent noise in 0..1 from (seed, ...coordinates). */
  noise(...coordinates: number[]): number;
  /** Beat position from the project audio grid; undefined without audio. */
  beat(time: number): BeatPosition | undefined;
  /** Synchronous scope; restores native styles and drawing flags, even on failure. */
  withCanvas(draw: (canvas: CanvasRenderingContext2D) => void): void;
  /** Clip a synchronous drawing scope to a logical Path2D. */
  clip(path: Path2D, draw: () => void, rule?: CanvasFillRule): void;
  blur(radius: number): void;
  shadow(color: string, blur: number, x?: number, y?: number): void;
  vignette(strength: number, inner?: number): void;
}
export interface SceneModule {
  meta: SceneMeta; params: ParameterDefinitions;
  setup(ctx: SetupContext): void | Promise<void>;
  renderFrame(ctx: FrameContext, time: number, params: Readonly<ParameterValues>): void;
}
export interface SceneRuntime {
  meta: SceneMeta; definitions: ParameterDefinitions; renderScale: number;
  render(time: number, values?: ParameterValues): void;
  dispose(): void;
}
export interface FontSource { family: string; path: string; weight?: number | undefined }
export interface RuntimeOptions {
  seed?: number; renderScale?: number; assetBase?: string; params?: ParameterValues;
  fonts?: FontSource[]; audio?: BeatGrid | undefined;
  outputSize?: ExportSize | undefined;
  aspectRatio?: AspectRatio | undefined;
  /** Throw when renderFrame touches Math.random / Date.now / performance.now. Default true. */
  guard?: boolean;
}

const EFFECT_PROPS = new Set(['shadowBlur', 'shadowOffsetX', 'shadowOffsetY']);
/** Every px length in a CSS filter (blur, drop-shadow offsets/radius) is a device length. */
export const scaleFilter = (value: string, factor: number) =>
  value === 'none' ? value : value.replace(/(-?\d*\.?\d+(?:e[-+]?\d+)?)px/gi, (_, n: string) => `${Number(n) * factor}px`);

function checkAssetPath(path: string) {
  if (!path || path.startsWith('/') || path.split('/').includes('..') || path.includes(':') || path.includes('\\')) throw new Error(`Asset must be project-relative: ${path}`);
}

export async function createSceneRuntime(element: HTMLCanvasElement, scene: SceneModule, options: RuntimeOptions = {}): Promise<SceneRuntime> {
  const meta = sceneMetaForAspect(sceneMetaSchema.parse(scene.meta), options.aspectRatio), definitions = parameterDefinitionsSchema.parse(scene.params);
  if (options.outputSize) {
    const size = exportSizeSchema.parse(options.outputSize);
    if (size.fit === 'reflow') {
      const factor = Math.min(size.width, size.height) / Math.min(meta.width, meta.height);
      const aspect = size.width * 16 === size.height * 9 ? '9:16' : size.width * 9 === size.height * 16 ? '16:9' : undefined;
      const layout = aspect ? sceneMetaForAspect(meta, aspect) : { ...meta, width: Math.round(size.width / factor), height: Math.round(size.height / factor) };
      return createSceneRuntime(element, { ...scene, meta: layout }, { ...options, aspectRatio: undefined, outputSize: { ...size, fit: 'contain' } });
    }
    const factor = size.fit === 'cover' ? Math.max(size.width / meta.width, size.height / meta.height) : Math.min(size.width / meta.width, size.height / meta.height);
    const source = document.createElement('canvas');
    const runtime = await createSceneRuntime(source, { ...scene, meta }, { ...options, aspectRatio: undefined, outputSize: undefined, renderScale: Math.min(4, factor) });
    element.width = size.width; element.height = size.height;
    const ctx = element.getContext('2d', { willReadFrequently: true });
    if (!ctx) { runtime.dispose(); throw new Error('Canvas 2D unavailable'); }
    const width = meta.width * factor, height = meta.height * factor;
    return {
      meta: runtime.meta, definitions: runtime.definitions, renderScale: runtime.renderScale,
      render(time, values) {
        runtime.render(time, values);
        ctx.reset(); ctx.fillStyle = meta.background; ctx.fillRect(0, 0, size.width, size.height);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(source, (size.width - width) / 2, (size.height - height) / 2, width, height);
      },
      dispose() { runtime.dispose(); source.width = source.height = 0; },
    };
  }
  if (typeof scene.setup !== 'function' || typeof scene.renderFrame !== 'function') throw new Error('Scene must export setup and renderFrame');
  const scale = options.renderScale ?? 1, seed = (options.seed ?? 1) >>> 0;
  if (!Number.isFinite(scale) || scale <= 0 || scale > 4) throw new Error('Invalid renderScale');
  resolveParams(definitions, options.params ?? {});
  const url = (path: string) => { checkAssetPath(path); return new URL(path, new URL(options.assetBase ?? './', document.baseURI)).href; };

  // Fonts must be ready before setup measures text and before any frame is drawn.
  for (const font of options.fonts ?? []) {
    const face = new FontFace(font.family, `url(${JSON.stringify(url(font.path))})`, { weight: String(font.weight ?? 400) });
    document.fonts.add(await face.load());
  }
  await document.fonts.ready;

  element.width = Math.max(1, Math.round(meta.width * scale)); element.height = Math.max(1, Math.round(meta.height * scale));
  const sx = element.width / meta.width, sy = element.height / meta.height, effect = Math.sqrt(sx * sy);
  const assets: Record<string, unknown> = {};
  await scene.setup({
    width: meta.width, height: meta.height, seed, random: seededRandom(seed), assets, asset: url,
    async loadImage(path) {
      const response = await fetch(url(path));
      if (!response.ok) throw new Error(`Image failed: ${path} (${response.status})`);
      return createImageBitmap(await response.blob());
    },
  });
  Object.freeze(assets);
  const ctx = element.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D unavailable');

  // Public context speaks logical units; the native context receives device pixels.
  const base = new DOMMatrix([sx, 0, 0, sy, 0, 0]), inverse = base.inverse();
  const toNative = (m: DOMMatrix) => base.multiply(m);
  const overrides: Record<string, unknown> = {
    setTransform(...args: unknown[]) {
      const m = args.length >= 6 ? new DOMMatrix(args.slice(0, 6) as number[]) : DOMMatrix.fromMatrix((args[0] ?? {}) as DOMMatrixInit);
      ctx.setTransform(toNative(m));
    },
    resetTransform() { ctx.setTransform(base); },
    getTransform() { return inverse.multiply(ctx.getTransform()); },
    reset() { ctx.reset(); ctx.setTransform(base); },
  };
  const logical = new Proxy(ctx, {
    get(target, key) {
      if (typeof key === 'string' && key in overrides) return overrides[key];
      const value = Reflect.get(target, key, target);
      if (EFFECT_PROPS.has(String(key))) return Number(value) / effect;
      if (key === 'filter') return scaleFilter(String(value), 1 / effect);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, key, value) {
      const next = EFFECT_PROPS.has(String(key)) ? Number(value) * effect : key === 'filter' ? scaleFilter(String(value), effect) : value;
      return Reflect.set(target, key, next, target);
    },
  });

  const drawing = createDrawing(logical, meta.width, meta.height);
  const frame: FrameContext = {
    canvas: logical, draw: drawing.draw, width: meta.width, height: meta.height, renderScale: scale, seed, assets,
    noise: (...coordinates) => hashNoise(seed, ...coordinates),
    beat: time => options.audio ? beatAt(time, options.audio) : undefined,
    withCanvas(draw) {
      drawing.draw.push();
      try { draw(logical); } finally { drawing.draw.pop(); }
    },
    clip(path, draw, rule = 'nonzero') {
      drawing.draw.push();
      try { logical.clip(path, rule); draw(); } finally { drawing.draw.pop(); }
    },
    blur(radius) { ctx.filter = radius > 0 ? `blur(${radius * effect}px)` : 'none'; },
    shadow(color, radius, x = 0, y = 0) { ctx.shadowColor = color; ctx.shadowBlur = radius * effect; ctx.shadowOffsetX = x * effect; ctx.shadowOffsetY = y * effect; },
    vignette(strength, inner = 0.15) {
      ctx.save(); ctx.setTransform(base); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.shadowColor = 'transparent';
      const cx = meta.width / 2, cy = meta.height / 2;
      const gradient = ctx.createRadialGradient(cx, cy, Math.min(meta.width, meta.height) * inner, cx, cy, Math.hypot(meta.width, meta.height) / 2);
      gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(1, `rgba(0,0,0,${Math.min(1, Math.max(0, strength))})`);
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, meta.width, meta.height); ctx.restore();
    },
  };

  const guard = options.guard ?? true;
  const blocked = (name: string) => () => { throw new Error(`${name} is not allowed in renderFrame; use time, ctx.noise or setup data`); };
  let disposed = false;
  return {
    meta, definitions, renderScale: scale,
    render(time, values = options.params ?? {}) {
      if (disposed) throw new Error('Runtime disposed');
      if (!Number.isFinite(time) || time < 0 || time > meta.duration) throw new Error(`Time outside scene: ${time}`);
      const resolved = resolveParams(definitions, values);
      // reset() also discards clip regions and unbalanced save stacks from the previous call.
      ctx.reset(); ctx.setTransform(base); ctx.fillStyle = meta.background; ctx.fillRect(0, 0, meta.width, meta.height);
      drawing.reset();
      const saved = guard ? { random: Math.random, now: Date.now, perf: performance.now } : undefined;
      if (saved) { Math.random = blocked('Math.random'); Date.now = blocked('Date.now'); performance.now = blocked('performance.now'); }
      let result: unknown;
      try { result = scene.renderFrame(frame, time, resolved); }
      finally { if (saved) { Math.random = saved.random; Date.now = saved.now; performance.now = saved.perf; } }
      if (result instanceof Promise) throw new Error('renderFrame must be synchronous');
    },
    dispose() {
      disposed = true;
      for (const value of Object.values(assets)) if (typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap) value.close();
    },
  };
}
