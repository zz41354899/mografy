// Whole-film helpers: smooth keyed curves, one continuous camera, pooled offscreen layers, one-pass blur and bloom,
// and a shot table that feeds meta.shots. All are pure functions of their arguments (the buffer pool only reuses
// memory; every buffer is cleared before it is drawn), so they are safe in renderFrame and work the same in a plain
// HTML storyboard page on any 2D context.
import { clamp } from './math.js';
import type { FrameContext } from './canvas.js';

export type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
/** A FrameContext, or any native 2D context (ctx.canvas, a storyboard canvas, an offscreen context). */
export type Target = FrameContext | Context2D;

// ---------------------------------------------------------------- frame space

/**
 * The film frame of a context: the device transform of its logical (0, 0) and the film's logical size.
 * The runtime's logical context answers this itself; a plain canvas is tagged with `filmFrame`.
 * `hidden` means the context already multiplies `base` into every transform (the runtime's logical context).
 * `effects` means it also scales shadow and filter lengths from film units to pixels (the logical context and every
 * layer context), so scene code draws the same picture on the frame and inside a layer at any output scale.
 */
export interface FilmFrame { base: DOMMatrix; inverse: DOMMatrix; width: number; height: number; hidden: boolean; effects: boolean }
/** Global key, so a scene bundle and the runtime that made its context agree on it. */
export const FILM_FRAME = Symbol.for('mografy.filmFrame');

const native = (t: Target): Context2D => ('withCanvas' in t ? t.canvas : t);
/**
 * Tag a plain canvas context (a storyboard page, an offscreen canvas) with its film frame: `base` maps the film's
 * logical 1920 × 1080 (or `width` × `height`) to the canvas's pixels. Scenes never need this; the runtime does it.
 */
export function filmFrame(c: Context2D, width: number, height: number, base = new DOMMatrix([c.canvas.width / width, 0, 0, c.canvas.height / height, 0, 0])) {
  const frame: FilmFrame = { base, inverse: base.inverse(), width, height, hidden: false, effects: false };
  (c as unknown as Record<symbol, FilmFrame>)[FILM_FRAME] = frame;
  return frame;
}
function frameOf(c: Context2D): FilmFrame {
  const tagged = (c as unknown as Record<symbol, FilmFrame | undefined>)[FILM_FRAME];
  if (tagged) return tagged;
  const identity = new DOMMatrix();
  return { base: identity, inverse: identity, width: c.canvas.width, height: c.canvas.height, hidden: false, effects: false };
}
/** The context's current transform in device pixels. */
export function deviceTransform(t: Target) {
  const c = native(t), f = frameOf(c), m = c.getTransform();
  return f.hidden ? f.base.multiply(m) : m;
}
/**
 * Device pixels per unit of the current coordinate system (output scale × camera zoom × any local scale).
 * Multiply every length you put in an offscreen context's `filter` or `shadowBlur` by this; native contexts
 * do not scale those with the transform.
 */
export function devScale(t: Target) { const m = deviceTransform(t); return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1; }
/**
 * A synchronous drawing scope on any target: `ctx.withCanvas` for a FrameContext (which also restores the
 * drawing API's state), save/restore for a native context.
 */
export function scope(t: Target, draw: (c: Context2D) => void) {
  if ('withCanvas' in t) { t.withCanvas(draw); return; }
  t.save();
  try { draw(t); } finally { t.restore(); }
}
/**
 * Factor for shadow and filter lengths given in frame units: 1 on the runtime's context (it scales them itself),
 * the output scale on a native or layer context.
 */
export function effectUnits(t: Target) { const f = frameOf(native(t)); return f.effects ? 1 : frameScale(f); }
/** Factor the context itself applies to shadow and filter lengths (the output scale on the runtime's context, else 1). */
export function appliedEffectScale(t: Target) { const f = frameOf(native(t)); return f.effects ? frameScale(f) : 1; }
function setDevice(c: Context2D, f: FilmFrame, m: DOMMatrix) { c.setTransform(f.hidden ? f.inverse.multiply(m) : m); }
/** Device pixels per film unit of the frame itself: the output scale, without camera or local scale. */
export function outputScale(t: Target) { return frameScale(frameOf(native(t))); }
const frameScale = (f: FilmFrame) => Math.sqrt(Math.abs(f.base.a * f.base.d - f.base.b * f.base.c)) || 1;

// ---------------------------------------------------------------- keyed curves and the camera

/**
 * A smooth curve through `[time, value]` keys (monotone cubic): velocity carries through every inner key,
 * it never overshoots between keys, and it eases into the first and last key. Use it for camera paths and
 * any long move that passes through several poses, instead of chaining separate eased segments.
 */
export function keys(points: readonly (readonly [number, number])[]): (time: number) => number {
  const n = points.length;
  if (!n) throw new Error('keys needs at least one key');
  const xs = points.map(k => k[0]), ys = points.map(k => k[1]);
  for (let i = 1; i < n; i++) if (!(xs[i]! > xs[i - 1]!)) throw new Error(`keys: times must increase (key ${i} at ${xs[i]})`);
  const d: number[] = [], m = new Array<number>(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1]! - ys[i]!) / (xs[i + 1]! - xs[i]!));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i]! / d[i]!, b = m[i + 1]! / d[i]!, s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]!; m[i + 1] = k * b * d[i]!; }
  }
  return time => {
    if (n === 1 || time <= xs[0]!) return ys[0]!;
    if (time >= xs[n - 1]!) return ys[n - 1]!;
    let i = 0; while (time > xs[i + 1]!) i++;
    const h = xs[i + 1]! - xs[i]!, s = (time - xs[i]!) / h, s2 = s * s, s3 = s2 * s;
    return ys[i]! * (2 * s3 - 3 * s2 + 1) + m[i]! * h * (s3 - 2 * s2 + s) + ys[i + 1]! * (-2 * s3 + 3 * s2) + m[i + 1]! * h * (s3 - s2);
  };
}

/** What the camera looks at: the film point at the centre of the frame, zoom (1 = film size) and roll in radians. */
export interface FilmCamera { x: number; y: number; zoom: number; roll: number }
export type CameraKey = readonly [time: number, x: number, y: number, zoom?: number, roll?: number];
/**
 * One camera for the whole film, from keys `[time, x, y, zoom?, roll?]`. Position and roll follow `keys`; zoom
 * is interpolated in log space so a push from 1 to 2 feels as even as one from 2 to 4.
 */
export function cameraPath(cameraKeys: readonly CameraKey[]): (time: number) => FilmCamera {
  const x = keys(cameraKeys.map(k => [k[0], k[1]] as const)), y = keys(cameraKeys.map(k => [k[0], k[2]] as const));
  const z = keys(cameraKeys.map(k => [k[0], Math.log(k[3] ?? 1)] as const)), r = keys(cameraKeys.map(k => [k[0], k[4] ?? 0] as const));
  return time => ({ x: x(time), y: y(time), zoom: Math.exp(z(time)), roll: r(time) });
}
/**
 * Draw `draw` through the camera: the camera's (x, y) lands at the frame centre. Cards and UI get their own local
 * transforms inside it; they never get a second camera.
 */
export function withCamera(t: Target, camera: FilmCamera, draw: (c: Context2D) => void) {
  const c = native(t), f = frameOf(c);
  c.save();
  try {
    c.translate(f.width / 2, f.height / 2); c.rotate(camera.roll); c.scale(camera.zoom, camera.zoom); c.translate(-camera.x, -camera.y);
    draw(c);
  } finally { c.restore(); }
}

// ---------------------------------------------------------------- pooled buffers

const pool = new Map<string, OffscreenCanvas>();
/**
 * A named offscreen canvas of exactly `width` × `height` device pixels, cleared and reset. Buffers are reused
 * between frames (only memory is reused, never content), so renderFrame never allocates canvases.
 */
export function buffer(name: string, width: number, height: number) {
  const w = Math.max(1, Math.ceil(width)), h = Math.max(1, Math.ceil(height)), key = `${name} ${w}×${h}`;
  let b = pool.get(key);
  if (!b) {
    b = new OffscreenCanvas(w, h); pool.set(key, b);
    if (pool.size > 64) for (const old of pool.keys()) { if (old === key) continue; pool.delete(old); if (pool.size <= 48) break; }
  } else { pool.delete(key); pool.set(key, b); }
  const x = b.getContext('2d')!;
  x.reset();
  return b;
}

/** A rectangle `[x, y, width, height]` in the current coordinates. */
export type Bounds = readonly [x: number, y: number, width: number, height: number];
interface Layer { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D; frame: FilmFrame; rect: [number, number, number, number]; res: number }
const EFFECT_PROPS = new Set(['shadowBlur', 'shadowOffsetX', 'shadowOffsetY']);
const scaleLengths = (value: string, k: number) => value === 'none' ? value : value.replace(/(-?\d*\.?\d+(?:e[-+]?\d+)?)px/gi, (_, n: string) => `${Number(n) * k}px`);
/** A layer context whose shadow and filter lengths are in film units, like the runtime's own context. */
function filmUnits(x: OffscreenCanvasRenderingContext2D, k: number): OffscreenCanvasRenderingContext2D {
  return new Proxy(x, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (EFFECT_PROPS.has(String(key))) return Number(value) / k;
      if (key === 'filter') return scaleLengths(String(value), 1 / k);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, key, value) {
      const next = EFFECT_PROPS.has(String(key)) ? Number(value) * k : key === 'filter' ? scaleLengths(String(value), k) : value;
      return Reflect.set(target, key, next, target);
    },
  });
}
/**
 * A buffer at `res` × output resolution over the device pixels of the film frame, or only of `bounds` (current
 * coordinates) grown by `margin` device pixels. Its context draws in the caller's current space.
 */
function frameLayer(c: Context2D, name: string, res: number, bounds?: Bounds, margin = 0): Layer {
  const f = frameOf(c), d = deviceTransform(c);
  const corners = (m: DOMMatrix, [x, y, w, h]: Bounds) => [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([px, py]) => m.transformPoint({ x: px!, y: py! }));
  const box = (pts: DOMPoint[], grow: number) => {
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    return [Math.min(...xs) - grow, Math.min(...ys) - grow, Math.max(...xs) + grow, Math.max(...ys) + grow];
  };
  const full = box(corners(f.base, [0, 0, f.width, f.height]), 0);
  let [x0, y0, x1, y1] = bounds ? box(corners(d, bounds), margin) : full;
  x0 = Math.floor(Math.max(x0!, full[0]!)); y0 = Math.floor(Math.max(y0!, full[1]!)); x1 = Math.ceil(Math.min(x1!, full[2]!)); y1 = Math.ceil(Math.min(y1!, full[3]!));
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  const canvas = buffer(name, w * res, h * res), raw = canvas.getContext('2d')!;
  // device pixels of the rect → layer pixels; then the caller's current transform
  const toLayer = new DOMMatrix([res, 0, 0, res, -x0 * res, -y0 * res]);
  raw.setTransform(toLayer.multiply(d));
  const tag = filmFrame(raw, f.width, f.height, toLayer.multiply(f.base));
  tag.effects = true;
  return { canvas, ctx: filmUnits(raw, frameScale(tag)), frame: f, rect: [x0, y0, w, h], res };
}
export type Composite = GlobalCompositeOperation;
function composite(c: Context2D, canvas: OffscreenCanvas, l: Layer, alpha: number, mode: Composite = 'source-over') {
  const f = l.frame, [x, y, w, h] = l.rect;
  c.save();
  try {
    setDevice(c, f, new DOMMatrix());
    c.globalAlpha *= clamp(alpha); c.globalCompositeOperation = mode; c.filter = 'none'; c.shadowColor = 'transparent';
    // a reduced-resolution buffer holds soft content: bilinear upscaling is enough and far cheaper than 'high'
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = l.res < 1 ? 'low' : 'high';
    c.drawImage(canvas, 0, 0, canvas.width, canvas.height, x, y, w, h);
  } finally { c.restore(); }
}

export interface LayerOptions {
  /** Layer resolution relative to the output (1 = full). Lower it for soft content. */
  res?: number;
  /** How the layer lands on the frame. Default 'source-over'. */
  mode?: Composite;
  /**
   * The area the drawing covers, `[x, y, width, height]` in the current coordinates. The layer is only that big
   * (plus room for any blur), which makes small layers far cheaper than a full frame. Default: the whole frame.
   */
  bounds?: Bounds;
}
/**
 * Draw a group into its own layer and composite it once at `alpha`. Use it whenever several overlapping parts
 * fade together (a card with its text, a UI panel, a whole shot in a crossfade): drawn directly, their alphas
 * multiply where they overlap and the overlaps flash. At alpha 1 with no mode it draws straight through.
 */
export function layer(t: Target, name: string, alpha: number, draw: (c: Context2D) => void, o: LayerOptions = {}) {
  const c = native(t);
  if (alpha <= 0.001) return;
  if (alpha >= 0.999 && !o.mode && (o.res ?? 1) === 1) { c.save(); try { draw(c); } finally { c.restore(); } return; }
  const l = frameLayer(c, `layer:${name}`, o.res ?? 1, o.bounds, 2);
  draw(l.ctx);
  composite(c, l.canvas, l, alpha, o.mode);
}

export interface BlurOptions extends LayerOptions {
  alpha?: number;
  /** Lengths in the frame's units instead of the current (camera-scaled) ones. */
  frameUnits?: boolean;
}
/**
 * Blur a group in one pass. `radius` is in the current units, so it grows with the camera zoom like the drawing
 * does. Never wrap many draws in `ctx.filter`: the browser then blurs every fill and glyph separately.
 * Strong blurs render at a lower resolution automatically (pass `res` to choose); pass `bounds` for small groups.
 */
export function blurLayer(t: Target, name: string, radius: number, draw: (c: Context2D) => void, o: BlurOptions = {}) {
  const c = native(t), f = frameOf(c), alpha = o.alpha ?? 1;
  if (alpha <= 0.001) return;
  const px = radius * (o.frameUnits ? frameScale(f) : devScale(c));
  if (px < 0.3) { layer(c, name, alpha, draw, { ...(o.mode ? { mode: o.mode } : {}), ...(o.bounds ? { bounds: o.bounds } : {}) }); return; }
  const res = o.res ?? (px > 48 ? .25 : px > 12 ? .5 : 1);
  const a = frameLayer(c, `blur:${name}:a`, res, o.bounds, px * 3);
  draw(a.ctx);
  const b = buffer(`blur:${name}:b`, a.canvas.width, a.canvas.height), bx = b.getContext('2d')!;
  bx.filter = `blur(${(px * res).toFixed(2)}px)`; bx.drawImage(a.canvas, 0, 0);
  composite(c, b, a, alpha, o.mode);
}

export interface BloomOptions {
  /** Radius of the tight glow, in current units. Default 16. */
  radius?: number;
  /** Opacity of the tight glow. Default 1. */
  strength?: number;
  /** Opacity of the wide halo (radius × 3.4) relative to `strength`; 0 skips it. Default 0.75. */
  halo?: number;
  /** Default 'lighter'. Use 'screen' on light backgrounds. */
  mode?: Composite;
  /** Resolution of the glow buffers. Default 0.25. */
  res?: number;
  /** The area the lights cover, in current coordinates (the glow is given room around it). Default: the frame. */
  bounds?: Bounds;
}
/**
 * Glow for lights, neon and highlights: `draw` is rendered at quarter resolution, blurred into a tight glow and a
 * wide halo, and added over the frame. It draws only the glow; draw the sharp source yourself.
 */
export function bloom(t: Target, draw: (c: Context2D) => void, o: BloomOptions = {}) {
  const c = native(t), k = (o.strength ?? 1) * c.globalAlpha;
  if (k <= 0.001) return;
  const res = o.res ?? .25, wide = (o.halo ?? .75) > 0.001, device = (o.radius ?? 16) * devScale(c);
  const a = frameLayer(c, 'bloom:a', res, o.bounds, device * (wide ? 3.4 : 1) * 3);
  draw(a.ctx);
  const pass = (radius: number, alpha: number) => {
    if (alpha <= 0.001) return;
    const b = buffer('bloom:b', a.canvas.width, a.canvas.height), bx = b.getContext('2d')!;
    bx.filter = `blur(${Math.max(.6, radius * res).toFixed(2)}px)`; bx.drawImage(a.canvas, 0, 0);
    c.save();
    try { c.globalAlpha = 1; composite(c, b, a, alpha, o.mode ?? 'lighter'); } finally { c.restore(); }
  };
  pass(device, k);
  if (wide) pass(device * 3.4, k * (o.halo ?? .75));
}

// ---------------------------------------------------------------- the shot table

export interface BeatInput {
  title: string;
  /** End of the shot, seconds. Shots are contiguous: each starts where the previous one ended. */
  end: number;
  /** A settled moment to stop on in Present mode and to review. Default: 85 % into the shot. */
  stop?: number;
  /** Seconds of handoff into the next shot, centred on `end`; reviewed as a dense strip. */
  handoff?: number;
  /** What happens, for the storyboard. */
  note?: string;
}
export interface Beat extends Required<Omit<BeatInput, 'handoff' | 'note'>> { index: number; start: number; handoff: number; note: string }
export interface Beats {
  list: readonly Beat[];
  duration: number;
  /** For `meta.shots`. */
  shots: { end: number; stop: number; title: string }[];
  /** Times worth a still in review: every stop, plus the frames around each handoff. */
  reviewTimes: number[];
  /** Handoff windows for mografy.json `review.transitions`. */
  transitions: { start: number; end: number }[];
  /** The shot at `time` and the seconds since it started. */
  at(time: number): { beat: Beat; local: number; progress: number };
  /** A shot by title. */
  get(title: string): Beat;
}
/**
 * One table for the film's timing. Write the shots once here and derive `meta.shots`, review times and handoff
 * windows from it, so a retimed shot moves everything with it.
 */
export function beats(input: readonly BeatInput[]): Beats {
  if (!input.length) throw new Error('beats needs at least one shot');
  let start = 0;
  const list = input.map((b, index): Beat => {
    if (!(b.end > start)) throw new Error(`beats: "${b.title}" ends at ${b.end}, before it starts (${start})`);
    const stop = b.stop ?? start + (b.end - start) * .85;
    if (stop < start || stop > b.end) throw new Error(`beats: "${b.title}" stops at ${stop}, outside ${start}–${b.end}`);
    const beat = { index, title: b.title, start, end: b.end, stop, handoff: b.handoff ?? 0, note: b.note ?? '' };
    start = b.end;
    return Object.freeze(beat);
  });
  const duration = start, last = list.length - 1;
  const transitions = list.filter((b, i) => b.handoff > 0 && i < last).map(b => ({ start: Math.max(0, b.end - b.handoff / 2), end: Math.min(duration, b.end + b.handoff / 2) }));
  const reviewTimes = [...new Set([...list.map(b => b.stop), ...transitions.flatMap(w => [w.start, (w.start + w.end) / 2, w.end])].map(t => Math.round(t * 1000) / 1000))].sort((a, b) => a - b);
  return Object.freeze({
    list: Object.freeze(list), duration,
    shots: list.map(b => ({ end: b.end, stop: b.stop, title: b.title })),
    reviewTimes, transitions,
    at(time: number) {
      let i = 0; while (i < last && time >= list[i]!.end) i++;
      const beat = list[i]!;
      return { beat, local: time - beat.start, progress: clamp((time - beat.start) / (beat.end - beat.start)) };
    },
    get(title: string) {
      const beat = list.find(b => b.title === title);
      if (!beat) throw new Error(`beats: no shot titled "${title}"`);
      return beat;
    },
  });
}
