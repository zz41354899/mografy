// Drawing helpers on top of FrameContext: rounded paths, elevated surfaces and animated type.
// Each call is a synchronous scope that restores the canvas state afterwards.
import { clamp, ease } from './math.js';
import { at, type Curve } from './motion.js';
import type { FrameContext } from './canvas.js';
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
export function surface(ctx: FrameContext, path: Path2D, fill: Paint, o: SurfaceOptions = {}) {
  const elevation = o.elevation ?? 1, tint = o.tint ?? '20, 24, 22';
  ctx.withCanvas(c => {
    if (elevation > 0) {
      ctx.shadow(`rgba(${tint}, ${.07 * elevation})`, 70 * elevation, 0, 30 * elevation);
      c.fillStyle = fill; c.fill(path);
      ctx.shadow(`rgba(${tint}, ${.07 * elevation})`, 8, 0, 2);
    }
    c.fillStyle = fill; c.fill(path);
  });
}

export interface TextStyle {
  size: number; color: Paint;
  /** A family registered under `fonts` in mografy.json. Default: sans-serif. */
  family?: string; weight?: number;
  align?: CanvasTextAlign; baseline?: CanvasTextBaseline;
  /** Letter spacing in logical pixels. */
  tracking?: number;
  /** Multiplies the current opacity. */
  alpha?: number;
  maxWidth?: number;
}
const font = (s: TextStyle) => `${s.weight ?? 400} ${s.size}px "${s.family ?? 'sans-serif'}"`.replace('"sans-serif"', 'sans-serif');
/** Draw one line of text with its own font, colour, tracking and alpha. */
export function text(ctx: FrameContext, value: string, x: number, y: number, s: TextStyle) {
  if (!value || (s.alpha !== undefined && s.alpha <= 0.001)) return;
  ctx.withCanvas(c => {
    c.font = font(s);
    c.fillStyle = s.color; c.textAlign = s.align ?? 'left'; c.textBaseline = s.baseline ?? 'alphabetic';
    c.letterSpacing = `${s.tracking ?? 0}px`;
    if (s.alpha !== undefined) c.globalAlpha *= clamp(s.alpha);
    if (s.maxWidth) c.fillText(value, x, y, s.maxWidth); else c.fillText(value, x, y);
  });
}
/** Width of `value` in the given style. */
export function measure(ctx: FrameContext, value: string, s: TextStyle) {
  let width = 0;
  ctx.withCanvas(c => { c.font = font(s); c.letterSpacing = `${s.tracking ?? 0}px`; width = c.measureText(value).width; });
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
function layoutWords(ctx: FrameContext, line: string, x: number, s: TextStyle, separator: string) {
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
export function riseWords(ctx: FrameContext, line: string, x: number, y: number, s: TextStyle, time: number, start: number, o: WordsOptions = {}) {
  const stagger = o.stagger ?? .07, duration = o.duration ?? .8, curve = o.curve ?? ease.outQuint, exit = o.exit ?? 0;
  const words = layoutWords(ctx, line, x, s, o.separator ?? ' ');
  const maskTop = y - s.size * 1.05, maskH = s.size * 1.45;
  ctx.withCanvas(c => {
    c.beginPath(); c.rect(-4000, maskTop, 10000, maskH); c.clip();
    words.forEach(({ word, left }, i) => {
      const k = at(time, start + i * stagger, start + i * stagger + duration, curve);
      const dy = (1 - k) * s.size * 1.1 - exit * s.size * 1.2;
      if (k > 0) text(ctx, word, left, y + dy, { ...s, align: 'left', color: o.colors ? o.colors(word, i) : s.color, alpha: (s.alpha ?? 1) * Math.min(1, k * 1.4) * (1 - exit) });
    });
  });
  return words.map(w => [w.left, w.right] as [number, number]);
}

/** Words come into focus one after another: blur, a small rise and opacity resolve together. */
export function blurWords(ctx: FrameContext, line: string, x: number, y: number, s: TextStyle, time: number, start: number, o: WordsOptions & { blur?: number; lift?: number } = {}) {
  const stagger = o.stagger ?? .07, duration = o.duration ?? .8, curve = o.curve ?? ease.outCubic, exit = o.exit ?? 0;
  const blur = o.blur ?? s.size * .16, lift = o.lift ?? s.size * .25;
  const words = layoutWords(ctx, line, x, s, o.separator ?? ' ');
  words.forEach(({ word, left }, i) => {
    const k = at(time, start + i * stagger, start + i * stagger + duration, curve);
    if (k <= 0) return;
    ctx.withCanvas(() => {
      ctx.blur(blur * (1 - k) + blur * exit);
      text(ctx, word, left, y + lift * (1 - k), { ...s, align: 'left', color: o.colors ? o.colors(word, i) : s.color, alpha: (s.alpha ?? 1) * k * (1 - exit) });
    });
  });
  return words.map(w => [w.left, w.right] as [number, number]);
}
