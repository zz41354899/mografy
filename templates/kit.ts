// Mografy Templates core: what every template shares, whatever its look. Templates are complete scenes (template, meta, params,
// renderFrame) that also play inside a film through `play`. The two looks live next to this file:
//   editorial.ts  9:16  the SUPERHUNTER page: white paper, black type, burnt orange, Anton headlines, rules, quote marks, photo windows
//   montage.ts   16:9  the Mografy montage: night, light and neon grounds, the spectrum, kinetic Inter type, light and glass
// Module level stays pure (no canvas or Path2D), because tooling reads `template`, `meta` and `params` in Node.
import { at, clamp, ease, keys, lerp, pr, settle, spring, springs, stagger, win } from '@mografy/runtime';
import type { FrameContext } from '@mografy/runtime';

export type C2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type Rect = [x: number, y: number, width: number, height: number];

// ---------------------------------------------------------------- catalog

export type TemplateCategory = 'hook' | 'caption' | 'screen' | 'explain' | 'proof' | 'data' | 'slides' | 'end' | 'transition';
export type TemplateAspect = '9:16' | '16:9';
/** What a template tells the catalog, the website and agents. JSON-compatible on purpose. */
export interface TemplateInfo {
  id: string;
  name: string;
  category: TemplateCategory;
  aspect: TemplateAspect;
  /** The same template designed for the other aspect ratio, if there is one. */
  pair?: string;
  summary: string;
  /** One line for agents: when to use it, and what to avoid. */
  agentHint: string;
  /** Animation principles the template leans on. */
  principles: string[];
}

// ---------------------------------------------------------------- fonts

/** Registered by `mografy add`: Inter 500–800 (body, UI, montage type) and Anton (editorial headlines). */
export const INTER = 'Inter', ANTON = 'Anton';
export const SANS = `${INTER}, "Helvetica Neue", Arial, sans-serif`;
export const DISPLAY = `${ANTON}, Impact, "Arial Narrow", sans-serif`;

// ---------------------------------------------------------------- small helpers

/** `#rrggbb` with an alpha 0..1. */
export function alpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255}, ${clamp(a)})`;
}
export const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[\da-f]{6}$/i.test(v);
/** Rounded rectangle path. */
export function rr(x: number, y: number, w: number, h: number, r: number | number[]) {
  const p = new Path2D();
  p.roundRect(x, y, w, h, typeof r === 'number' ? Math.max(0, Math.min(r, w / 2, h / 2)) : r);
  return p;
}
/** 0 → 1 by `inEnd`, then 1 → 0 over the last `outLen` seconds of `duration`. */
export const envelope = (time: number, duration: number, inEnd = .5, outLen = .45) =>
  clamp(time / inEnd) * (1 - ease.inOutCubic(pr(time, duration - outLen, duration)));
/** The exit of a template: 0 until `duration - len`, then eased to 1. */
export const exitOf = (time: number, duration: number, len = .5) => ease.inOutCubic(pr(time, duration - len, duration));

/**
 * Draw in the template's design space (1080 × 1920 portrait or 1920 × 1080 landscape), centred and contained in
 * whatever canvas the template is played on.
 */
export function stage(ctx: FrameContext, aspect: TemplateAspect, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) {
  const [w, h] = aspect === '9:16' ? [1080, 1920] : [1920, 1080];
  const s = Math.min(ctx.width / w, ctx.height / h);
  ctx.withCanvas(c => {
    c.translate((ctx.width - w * s) / 2, (ctx.height - h * s) / 2); c.scale(s, s);
    draw(c, w, h);
  });
}

// ---------------------------------------------------------------- safe areas

/**
 * Where critical copy belongs. Portrait follows Mografy's conservative social guide (8 % top, 18 % bottom,
 * 6 % left, 12 % right); platform overlays vary, so treat it as a planning margin, not a guarantee.
 */
export function safeRect(aspect: TemplateAspect): Rect {
  if (aspect === '9:16') return [1080 * .06, 1920 * .08, 1080 * (1 - .06 - .12), 1920 * (1 - .08 - .18)];
  return [1920 * .05, 1080 * .07, 1920 * .9, 1080 * .86];
}
/** Shade everything outside the safe area (preview aid; off by default). */
export function safeGuide(c: C2D, aspect: TemplateAspect, on: unknown) {
  if (on !== true) return;
  const [w, h] = aspect === '9:16' ? [1080, 1920] : [1920, 1080], [x, y, sw, sh] = safeRect(aspect);
  c.save();
  const p = new Path2D(); p.rect(0, 0, w, h); p.rect(x, y, sw, sh);
  c.fillStyle = 'rgba(255, 64, 96, .16)'; c.fill(p, 'evenodd');
  c.setLineDash([14, 10]); c.strokeStyle = 'rgba(255, 64, 96, .8)'; c.lineWidth = 3; c.strokeRect(x, y, sw, sh);
  c.restore();
}
export const safeParam = { safeGuide: { name: 'Safe-area guide', type: 'boolean' as const, default: false } };

// ---------------------------------------------------------------- cursor and taps

/** A large arrow cursor; `press` (0..1) squashes it on a click. */
export function cursor(c: C2D, x: number, y: number, o: { scale?: number; alpha?: number; press?: number; dark?: boolean } = {}) {
  const a = o.alpha ?? 1; if (a <= .001) return;
  const s = (o.scale ?? 3) * (1 - .14 * (o.press ?? 0));
  c.save(); c.globalAlpha *= a; c.translate(x, y); c.scale(s, s);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 22); c.lineTo(5.5, 17); c.lineTo(9.5, 26); c.lineTo(13, 24.5); c.lineTo(9, 15.8); c.lineTo(16, 15.8); c.closePath();
  c.shadowColor = 'rgba(0,0,0,.28)'; c.shadowBlur = 8; c.shadowOffsetY = 2; c.fillStyle = o.dark ? '#ffffff' : '#111317'; c.fill();
  c.shadowColor = 'transparent'; c.strokeStyle = o.dark ? '#111317' : '#ffffff'; c.lineWidth = 1.6; c.lineJoin = 'round'; c.stroke();
  c.restore();
}
/** A click: the press bump (for squash and button depress) peaking at `at`. */
export const press = (time: number, t: number, width = .08) => Math.exp(-(((time - t) / width) ** 2));
/** An expanding ring where a click or tap lands. */
export function ring(c: C2D, x: number, y: number, time: number, t: number, color: string, size = 1) {
  const r = pr(time, t, t + .5); if (r <= 0 || r >= 1) return;
  c.save(); c.globalAlpha *= (1 - r) * .6; c.beginPath(); c.arc(x, y, (14 + 70 * springs.out(r)) * size, 0, Math.PI * 2);
  c.strokeStyle = color; c.lineWidth = 5 * size; c.stroke(); c.restore();
}
/** Cursor position through [time, x, y] keys, travelling on a spring with a slight arc. */
export function path(k: [number, number, number][], time: number): [number, number] {
  if (k.length < 2 || time <= k[0]![0]) return [k[0]![1], k[0]![2]];
  let i = 0; while (i < k.length - 2 && time > k[i + 1]![0]) i++;
  const a = k[i]!, b = k[i + 1]!, p = springs.cursor(pr(time, a[0], b[0]));
  const bend = Math.sin(p * Math.PI) * Math.min(70, Math.hypot(b[1] - a[1], b[2] - a[2]) * .08);
  return [lerp(a[1], b[1], p) + bend, lerp(a[2], b[2], p) - bend * .5];
}

// ---------------------------------------------------------------- composition

export interface TemplateModule {
  meta: { duration: number };
  params: Record<string, { default: unknown }>;
  renderFrame(ctx: FrameContext, time: number, params: Readonly<Record<string, unknown>>): void;
}
/** Default values of a template's params. */
export const defaults = (template: TemplateModule) => Object.fromEntries(Object.entries(template.params).map(([k, d]) => [k, d.default]));
/**
 * Play a template inside a film from `start` for its own duration. `overrides` change its params; pass
 * `backdrop: false` to draw an overlay template over the film's own picture.
 */
export function play(ctx: FrameContext, time: number, start: number, template: TemplateModule, overrides: Record<string, unknown> = {}) {
  const local = time - start;
  if (local < 0 || local > template.meta.duration) return;
  template.renderFrame(ctx, local, { ...defaults(template), ...overrides });
}
export { at, clamp, ease, keys, lerp, pr, settle, spring, springs, stagger, win };
