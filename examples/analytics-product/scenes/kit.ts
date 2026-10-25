// Shared design kit for the website demo films. Pure helpers: every value derives from absolute time.
import { ease, pr, clamp } from '@mografy/runtime';
import type { FrameContext } from '@mografy/runtime';

export const TEAL = '#12B5A5';
export const TEAL_DEEP = '#0A8A7D';

/** Fit a 1920 × 1080 design into any canvas, centered. */
export function setupFrame(ctx: FrameContext) {
  const s = Math.min(ctx.width / 1920, ctx.height / 1080);
  ctx.draw.translate(ctx.width / 2, ctx.height / 2); ctx.draw.scale(s); ctx.draw.translate(-960, -540);
}
export const scope = (ctx: FrameContext, draw: (c: CanvasRenderingContext2D) => void) => ctx.withCanvas(draw);

// Easing
export const outQuart = (t: number) => 1 - (1 - clamp(t, 0, 1)) ** 4;
export const outQuint = (t: number) => 1 - (1 - clamp(t, 0, 1)) ** 5;
export const inOutQuart = (t: number) => { t = clamp(t, 0, 1); return t < .5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2; };
export const inOut = ease.inOutCubic;
/** Range helper: eased progress of time between a and b. */
export const at = (time: number, a: number, b: number, curve: (t: number) => number = outQuart) => curve(pr(time, a, b));
/** Damped spring from 0 to 1 starting at `start`. `bounce` 0..0.5 controls overshoot. */
export function spring(time: number, start: number, duration = .7, bounce = .18) {
  const t = time - start;
  if (t <= 0) return 0;
  if (t >= duration * 1.6) return 1;
  const zeta = 1 - bounce * 1.6, omega = 2 * Math.PI / (duration * .78);
  const wd = omega * Math.sqrt(Math.max(1e-4, 1 - zeta * zeta));
  const v = 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + (zeta * omega / wd) * Math.sin(wd * t));
  // Fade the residual to exactly 1 so the hold is perfectly still.
  const tail = pr(t, duration * 1.1, duration * 1.6);
  return v + (1 - v) * ease.inOutCubic(tail);
}
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Rounded rectangle Path2D with independent radii (tl, tr, br, bl). */
export function rr(x: number, y: number, w: number, h: number, r: number | [number, number, number, number]) {
  const p = new Path2D();
  p.roundRect(x, y, w, h, typeof r === 'number' ? Math.min(r, w / 2, h / 2) : r);
  return p;
}
/** Soft two-layer elevation, then the surface. */
export function surface(ctx: FrameContext, path: Path2D, fill: string | CanvasGradient, elevation = 1, tint = '20, 32, 28') {
  scope(ctx, c => {
    if (elevation > 0) {
      ctx.shadow(`rgba(${tint}, ${.05 * elevation})`, 60 * elevation, 0, 24 * elevation);
      c.fillStyle = fill; c.fill(path);
      ctx.shadow(`rgba(${tint}, ${.06 * elevation})`, 6, 0, 2);
    }
    c.fillStyle = fill; c.fill(path);
  });
}
export function stroke(ctx: FrameContext, path: Path2D, color: string, width = 1) {
  scope(ctx, c => { c.strokeStyle = color; c.lineWidth = width; c.stroke(path); });
}
export interface TextStyle { size: number; weight?: number; color: string; family?: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline; tracking?: number; alpha?: number }
export function text(ctx: FrameContext, value: string, x: number, y: number, s: TextStyle) {
  scope(ctx, c => {
    c.font = `${s.weight ?? 400} ${s.size}px "${s.family ?? 'Inter'}"`;
    c.fillStyle = s.color; c.textAlign = s.align ?? 'left'; c.textBaseline = s.baseline ?? 'middle';
    (c as any).letterSpacing = `${s.tracking ?? 0}px`;
    if (s.alpha !== undefined) c.globalAlpha *= clamp(s.alpha, 0, 1);
    c.fillText(value, x, y);
  });
}
export function measure(ctx: FrameContext, value: string, s: TextStyle) {
  let w = 0;
  scope(ctx, c => { c.font = `${s.weight ?? 400} ${s.size}px "${s.family ?? 'Inter'}"`; (c as any).letterSpacing = `${s.tracking ?? 0}px`; w = c.measureText(value).width; });
  return w;
}
/** Tabular figures drawn cell by cell, so counting numbers never jitter. Returns total width. */
export function figures(ctx: FrameContext, value: string, x: number, y: number, s: TextStyle) {
  const digit = Math.max(...'0123456789'.split('').map(d => measure(ctx, d, s)));
  const widths = [...value].map(ch => /\d/.test(ch) ? digit : measure(ctx, ch, s));
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = s.align === 'center' ? x - total / 2 : s.align === 'right' ? x - total : x;
  [...value].forEach((ch, i) => { text(ctx, ch, cx + widths[i]! / 2, y, { ...s, align: 'center' }); cx += widths[i]!; });
  return total;
}

/** A crisp arrow pointer with a white keyline. Tip at (x, y). */
const POINTER = new Path2D('M0 0 L0 50 C0 52.5 2.9 53.6 4.6 51.8 L15.6 40.2 L23.9 59.3 C24.6 60.9 26.4 61.6 28 60.9 L33.2 58.7 C34.8 58 35.5 56.2 34.8 54.6 L26.6 35.8 L42.5 35 C45 34.9 46 31.9 44.2 30.3 L4.3 -1.9 C2.6 -3.3 0 -2.1 0 0 Z');
export function cursor(ctx: FrameContext, x: number, y: number, alpha: number, press = 0) {
  if (alpha <= 0.001) return;
  scope(ctx, c => {
    c.globalAlpha = clamp(alpha, 0, 1);
    c.translate(x, y); c.scale(1 - press * .14, 1 - press * .14);
    ctx.shadow('rgba(10, 20, 16, 0.28)', 14, 0, 6);
    c.fillStyle = '#FFFFFF'; c.lineJoin = 'round'; c.strokeStyle = '#FFFFFF'; c.lineWidth = 7; c.stroke(POINTER);
    ctx.shadow('transparent', 0);
    c.fillStyle = '#121614'; c.fill(POINTER);
  });
}
/** Checkmark drawn progressively (amount 0..1), centered at (x, y). */
export function check(ctx: FrameContext, x: number, y: number, size: number, color: string, amount = 1, width = size * .16) {
  if (amount <= 0) return;
  const pts = [[-.42, .02], [-.12, .32], [.44, -.3]].map(([a, b]) => [x + a! * size, y + b! * size] as const);
  const l1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), l2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
  scope(ctx, c => {
    c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(...pts[0]); c.lineTo(...pts[1]); c.lineTo(...pts[2]);
    c.setLineDash([l1 + l2, l1 + l2]); c.lineDashOffset = (l1 + l2) * (1 - clamp(amount, 0, 1)); c.stroke();
  });
}
/** Quadratic-bezier point, used for natural cursor arcs. */
export function arc2(ax: number, ay: number, cx: number, cy: number, bx: number, by: number, t: number): [number, number] {
  const u = 1 - t; return [u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by];
}
