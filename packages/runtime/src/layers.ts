// Drawing helpers: rounded paths, elevated surfaces and animated type. Each takes a FrameContext or any native
// 2D context (inside layer() and blurLayer() callbacks, pass the context you were given) and is a synchronous
// scope that restores the canvas state afterwards.
import { clamp, ease } from './math.js';
import { at, type Curve } from './motion.js';
import { appliedEffectScale, deviceTransform, effectUnits, scope, type Target } from './film.js';
import type { Paint } from './draw.js';

export type Corners = number | [topLeft: number, topRight: number, bottomRight: number, bottomLeft: number];
/** Rounded-rectangle Path2D; a single radius is clamped to half the shorter side. */
export function roundRect(x: number, y: number, width: number, height: number, radius: Corners = 0) {
  const p = new Path2D();
  p.roundRect(x, y, width, height, typeof radius === 'number' ? Math.max(0, Math.min(radius, width / 2, height / 2)) : radius);
  return p;
}

export interface SurfaceOptions {
  /** 0 draws a flat fill; 1 is a card resting on the page; 2 is lifted. */
  elevation?: number;
  /** Shadow colour as "r, g, b". */
  tint?: string;
}
/** Fill a path with a soft two-layer shadow under it (a wide ambient one and a tight contact one). */
export function surface(ctx: Target, path: Path2D, fill: Paint, o: SurfaceOptions = {}) {
  const elevation = o.elevation ?? 1, tint = o.tint ?? '20, 24, 22';
  scope(ctx, c => {
    const u = effectUnits(ctx);
    const shadow = (color: string, blur: number, y: number) => { c.shadowColor = color; c.shadowBlur = blur * u; c.shadowOffsetX = 0; c.shadowOffsetY = y * u; };
    if (elevation > 0) {
      shadow(`rgba(${tint}, ${.07 * elevation})`, 70 * elevation, 30 * elevation);
      c.fillStyle = fill; c.fill(path);
      shadow(`rgba(${tint}, ${.07 * elevation})`, 8, 2);
    }
    c.fillStyle = fill; c.fill(path);
  });
}

export interface TextStyle {
  size: number; color: Paint;
  /** A family registered under `fonts` in mografy.json, or a CSS stack such as `Inter, "Noto Sans TC", sans-serif`. Default: sans-serif. */
  family?: string; weight?: number;
  align?: CanvasTextAlign; baseline?: CanvasTextBaseline;
  /** Letter spacing in logical pixels. */
  tracking?: number;
  /** Multiplies the current opacity. */
  alpha?: number;
  maxWidth?: number;
}
const family = (f = 'sans-serif') => /[,"']/.test(f) || /^(sans-serif|serif|monospace|system-ui)$/.test(f) ? f : `"${f}"`;
const font = (s: TextStyle) => `${s.weight ?? 400} ${s.size}px ${family(s.family)}`;
/** Draw one line of text with its own font, colour, tracking and alpha. */
export function text(ctx: Target, value: string, x: number, y: number, s: TextStyle) {
  if (!value || (s.alpha !== undefined && s.alpha <= 0.001)) return;
  scope(ctx, c => {
    c.font = font(s);
    c.fillStyle = s.color; c.textAlign = s.align ?? 'left'; c.textBaseline = s.baseline ?? 'alphabetic';
    c.letterSpacing = `${s.tracking ?? 0}px`;
    if (s.alpha !== undefined) c.globalAlpha *= clamp(s.alpha);
    if (s.maxWidth) c.fillText(value, x, y, s.maxWidth); else c.fillText(value, x, y);
  });
}
/** Width of `value` in the given style. */
export function measure(ctx: Target, value: string, s: TextStyle) {
  let width = 0;
  scope(ctx, c => { c.font = font(s); c.letterSpacing = `${s.tracking ?? 0}px`; width = c.measureText(value).width; });
  return width;
}

export interface WordsOptions {
  /** Seconds between words. Default 0.07. */
  stagger?: number;
  /** Seconds each word takes. Default 0.8. */
  duration?: number;
  curve?: Curve;
  /** 0–1: lifts the whole line up and out of the mask (riseWords) or fades it (blurWords). */
  exit?: number;
  /** Per-word colour, for highlighting one word. */
  colors?: (word: string, index: number) => Paint;
  /** Split on this instead of spaces; use '' to animate each character (CJK copy). */
  separator?: string;
}
function layoutWords(ctx: Target, line: string, x: number, s: TextStyle, separator: string) {
  const words = separator === '' ? [...line] : line.split(separator);
  const gap = separator === '' ? 0 : measure(ctx, separator, s);
  const widths = words.map(w => measure(ctx, w, s));
  const total = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
  let cx = s.align === 'center' ? x - total / 2 : s.align === 'right' ? x - total : x;
  return words.map((word, i) => { const left = cx; cx += widths[i]! + gap; return { word, left, right: left + widths[i]! }; });
}

/**
 * Words rise into a mask one after another, starting at `start`. Returns each word's [left, right] in x,
 * so an underline or cursor can follow a word.
 */
export function riseWords(ctx: Target, line: string, x: number, y: number, s: TextStyle, time: number, start: number, o: WordsOptions = {}) {
  const stagger = o.stagger ?? .07, duration = o.duration ?? .8, curve = o.curve ?? ease.outQuint, exit = o.exit ?? 0;
  const words = layoutWords(ctx, line, x, s, o.separator ?? ' ');
  const maskTop = y - s.size * 1.05, maskH = s.size * 1.45;
  scope(ctx, c => {
    c.beginPath(); c.rect(-4000, maskTop, 10000, maskH); c.clip();
    words.forEach(({ word, left }, i) => {
      const k = at(time, start + i * stagger, start + i * stagger + duration, curve);
      const dy = (1 - k) * s.size * 1.1 - exit * s.size * 1.2;
      if (k > 0) text(ctx, word, left, y + dy, { ...s, align: 'left', color: o.colors ? o.colors(word, i) : s.color, alpha: (s.alpha ?? 1) * Math.min(1, k * 1.4) * (1 - exit) });
    });
  });
  return words.map(w => [w.left, w.right] as [number, number]);
}

/**
 * One line of text blurred by `radius` (current units, so it grows with camera zoom). It uses the text's shadow,
 * not `ctx.filter`: the glyphs are drawn far outside the frame and only their blurred shadow lands in place,
 * which costs about as much as drawing the text sharp. Gradient fills fall back to a filter.
 */
export function blurText(ctx: Target, value: string, x: number, y: number, s: TextStyle, radius: number) {
  if (!value || (s.alpha !== undefined && s.alpha <= 0.001)) return;
  if (radius <= 0.05 || typeof s.color !== 'string') {
    scope(ctx, c => { if (radius > 0.05) c.filter = `blur(${radius * effectUnits(ctx)}px)`; text(c, value, x, y, s); });
    return;
  }
  scope(ctx, c => {
    const m = deviceTransform(c), det = m.a * m.d - m.b * m.c;
    if (Math.abs(det) < 1e-9) return;
    const scale = Math.sqrt(Math.abs(det)), effect = appliedEffectScale(ctx), far = 4 * Math.max(c.canvas.width, c.canvas.height) + 2000;
    // move the glyphs `far` device pixels to the left, and the shadow (offsets are device-space) back by the same
    c.translate(-far * m.d / det, far * m.b / det);
    c.shadowColor = s.color as string; c.shadowOffsetX = far / effect; c.shadowOffsetY = 0;
    c.shadowBlur = 2 * radius * scale / effect;
    c.font = font(s); c.fillStyle = s.color; c.textAlign = s.align ?? 'left'; c.textBaseline = s.baseline ?? 'alphabetic';
    c.letterSpacing = `${s.tracking ?? 0}px`;
    if (s.alpha !== undefined) c.globalAlpha *= clamp(s.alpha);
    if (s.maxWidth) c.fillText(value, x, y, s.maxWidth); else c.fillText(value, x, y);
  });
}

/** Words come into focus one after another: blur, a small rise and opacity resolve together. No ctx.filter. */
export function blurWords(ctx: Target, line: string, x: number, y: number, s: TextStyle, time: number, start: number, o: WordsOptions & { blur?: number; lift?: number } = {}) {
  const stagger = o.stagger ?? .07, duration = o.duration ?? .8, curve = o.curve ?? ease.outCubic, exit = o.exit ?? 0;
  const blur = o.blur ?? s.size * .16, lift = o.lift ?? s.size * .25;
  const words = layoutWords(ctx, line, x, s, o.separator ?? ' ');
  words.forEach(({ word, left }, i) => {
    const k = at(time, start + i * stagger, start + i * stagger + duration, curve);
    if (k <= 0) return;
    blurText(ctx, word, left, y + lift * (1 - k), { ...s, align: 'left', color: o.colors ? o.colors(word, i) : s.color, alpha: (s.alpha ?? 1) * k * (1 - exit) }, blur * (1 - k) + blur * exit);
  });
  return words.map(w => [w.left, w.right] as [number, number]);
}
