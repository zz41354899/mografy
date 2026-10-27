// Editorial look for 9:16 templates, from the SUPERHUNTER post film: one white page with black type, burnt-orange rules and quote marks,
// tall Anton headlines that rise letter by letter into a mask, hand-drawn underlines, an orange block that sweeps a
// word, and a window that opens out of a line onto a picture or a product screen. Calm, printed, confident.
import { at, clamp, ease, lerp, pr, spring, springs } from '@mografy/runtime';
import type { FrameContext, SetupContext } from '@mografy/runtime';
import { DISPLAY, SANS, alpha, isHex, rr, type C2D } from './kit.js';

// ---------------------------------------------------------------- palette and params

export interface Page { bg: string; paper: string; accent: string; accentLight: string; ink: string; mute: string; dots: string; dark: boolean }
const LIGHT: Page = { bg: '#FFFFFF', paper: '#FFFFFF', accent: '#D4643A', accentLight: '#E8814F', ink: '#111111', mute: '#6E6E6E', dots: '#D6D6D6', dark: false };
const INK: Page = { bg: '#111111', paper: '#111111', accent: '#E06B3E', accentLight: '#F08C5C', ink: '#FFFFFF', mute: '#9A9A9A', dots: '#3A3A3A', dark: true };

/** Params every editorial template shares. */
export const editorialParams = {
  theme: { name: 'Theme', type: 'enum' as const, default: 'light', options: ['light', 'dark'] },
  accent: { name: 'Accent', type: 'color' as const, default: '#D4643A' },
};
export function page(p: Readonly<Record<string, unknown>>): Page {
  const base = p.theme === 'dark' ? INK : LIGHT;
  return isHex(p.accent) && p.accent.toLowerCase() !== '#d4643a' ? { ...base, accent: p.accent, accentLight: p.accent } : base;
}
export const W = 1080, H = 1920, CX = 540;
/** Rules of the page: header at 248, footer at 1700, margins 80. */
export const HEAD_Y = 248, FOOT_Y = 1700, MX = 80;

/** Fill the page (skipped when a film plays the template with `backdrop: false`). */
export function paper(c: C2D, p: Readonly<Record<string, unknown>>, pg: Page, color = pg.bg) {
  if (p.backdrop === false) return;
  c.fillStyle = color; c.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- type

export interface Ink { size: number; color: string; family?: string; weight?: number; tracking?: number; align?: CanvasTextAlign; alpha?: number }
const fontOf = (s: Ink) => `${s.weight ?? (s.family === DISPLAY ? 400 : 700)} ${s.size}px ${s.family ?? SANS}`;
/** One line on the alphabetic baseline. Returns its width. */
export function txt(c: C2D, value: string, x: number, y: number, s: Ink) {
  c.save(); c.font = fontOf(s); c.letterSpacing = `${s.tracking ?? 0}px`;
  const w = c.measureText(value).width - (value ? s.tracking ?? 0 : 0);
  if ((s.alpha ?? 1) > .001 && value) {
    const x0 = s.align === 'center' ? x - w / 2 : s.align === 'right' ? x - w : x;
    c.globalAlpha *= clamp(s.alpha ?? 1); c.fillStyle = s.color; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText(value, x0, y);
  }
  c.restore();
  return w;
}
export function measure(c: C2D, value: string, s: Ink) {
  c.save(); c.font = fontOf(s); c.letterSpacing = `${s.tracking ?? 0}px`;
  const w = c.measureText(value).width - (value ? s.tracking ?? 0 : 0); c.restore(); return w;
}
/** Break copy into lines no wider than `max`. */
export function wrapLines(c: C2D, value: string, max: number, s: Ink) {
  const out: string[] = [];
  for (const para of value.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(c, next, s) > max) { out.push(line); line = word; } else line = next;
    }
    out.push(line);
  }
  return out;
}

/** Strip [brackets]: the plain line and which characters were marked (for the accent colour). */
export function marked(line: string) {
  let plain = '', on = false; const flags: boolean[] = [];
  for (const ch of line) { if (ch === '[') { on = true; continue; } if (ch === ']') { on = false; continue; } plain += ch; flags.push(on); }
  return { plain, flags, first: flags.indexOf(true), last: flags.lastIndexOf(true) };
}

export type CharFx = { dx?: number; dy?: number; rot?: number; scale?: number; color?: string; alpha?: number };
/**
 * A line set letter by letter: each letter rises into a mask (ease.outQuint), `fx(i, k)` adds per-letter motion
 * or colour, `exitAt` lifts the letters out in turn. Display (Anton) by default, centred on `x`. Returns each
 * letter's [left, right].
 */
export function charLine(c: C2D, line: string, x: number, y: number, size: number, time: number, start: number,
  o: { color?: string; family?: string; weight?: number; tracking?: number; stagger?: number; dur?: number; align?: 'left' | 'center' | 'right';
    exitAt?: number; exit?: number; fx?: (i: number, k: number) => CharFx; mask?: boolean } = {}) {
  const st: Ink = { size, color: o.color ?? '#000', family: o.family ?? DISPLAY, weight: o.weight, tracking: 0 };
  const chars = [...line], tracking = o.tracking ?? size * .02;
  const widths = chars.map(ch => measure(c, ch, st));
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
  let cx = o.align === 'left' ? x : o.align === 'right' ? x - total : x - total / 2;
  const boxes = chars.map((_, i) => { const l = cx; cx += widths[i]! + tracking; return [l, l + widths[i]!] as [number, number]; });
  c.save();
  if (o.mask !== false) { c.beginPath(); c.rect(0, y - size * 1.08, W * 2, size * 1.42); c.clip(); }
  c.font = fontOf(st); c.letterSpacing = '0px'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  chars.forEach((ch, i) => {
    if (ch === ' ') return;
    const s0 = start + i * (o.stagger ?? .04), k = at(time, s0, s0 + (o.dur ?? .7), ease.outQuint);
    if (k <= 0) return;
    const ex = o.exitAt === undefined ? o.exit ?? 0 : at(time, o.exitAt + i * .025, o.exitAt + i * .025 + .4, ease.inOutCubic);
    if (ex >= 1) return;
    const f = o.fx ? o.fx(i, k) : {}, [l, r] = boxes[i]!;
    c.save();
    c.translate((l + r) / 2 + (f.dx ?? 0), y - size * .36 + (1 - k) * size * 1.1 - ex * size * 1.2 + (f.dy ?? 0));
    c.rotate(f.rot ?? 0); const sc = f.scale ?? 1; c.scale(sc, sc);
    c.globalAlpha *= Math.min(1, k * 1.5) * (1 - ex) * (f.alpha ?? 1);
    c.fillStyle = f.color ?? st.color; c.fillText(ch, -(r - l) / 2, size * .36);
    c.restore();
  });
  c.restore();
  return boxes;
}
/** Body copy: words rise into a mask one after another. Left-aligned at x unless `align` says otherwise. */
export function wordLine(c: C2D, line: string, x: number, y: number, s: Ink, time: number, start: number, o: { stagger?: number; exit?: number } = {}) {
  const words = line.split(' '), space = measure(c, ' ', s), ws = words.map(w => measure(c, w, s));
  const total = ws.reduce((a, b) => a + b, 0) + space * (words.length - 1);
  let wx = s.align === 'center' ? x - total / 2 : s.align === 'right' ? x - total : x;
  c.save(); c.beginPath(); c.rect(0, y - s.size * 1.1, W * 2, s.size * 1.5); c.clip();
  words.forEach((w, i) => {
    const k = at(time, start + i * (o.stagger ?? .06), start + i * (o.stagger ?? .06) + .6, ease.outQuint);
    if (k > 0) txt(c, w, wx, y + (1 - k) * s.size * 1.1 - (o.exit ?? 0) * s.size * 1.2, { ...s, align: 'left', alpha: (s.alpha ?? 1) * Math.min(1, k * 1.5) * (1 - (o.exit ?? 0)) });
    wx += ws[i]! + space;
  });
  c.restore();
  return total;
}

/** A quote mark (or any glyph) drawn around its own ink centre, so it can drop, spin, flatten and fly. */
export function glyph(c: C2D, ch: string, cx: number, cy: number, size: number, color: string, o: { rot?: number; sx?: number; sy?: number; alpha?: number } = {}) {
  if ((o.alpha ?? 1) <= .001 || size <= 0) return;
  c.save(); c.font = `400 ${size}px ${DISPLAY}`;
  const m = c.measureText(ch), gx = (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2, gy = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  c.translate(cx, cy); c.rotate(o.rot ?? 0); c.scale(o.sx ?? 1, o.sy ?? 1); c.globalAlpha *= clamp(o.alpha ?? 1);
  c.fillStyle = color; c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.fillText(ch, -gx + m.actualBoundingBoxLeft, gy);
  c.restore();
}

// ---------------------------------------------------------------- marks

/** Hand-drawn underline under [l, r], drawn left to right (p 0..1). */
export function underline(c: C2D, l: number, r: number, y: number, p: number, color: string, weight = 9) {
  if (p <= 0) return;
  c.save(); c.strokeStyle = color; c.lineWidth = weight; c.lineCap = 'round'; c.beginPath();
  const n = 24;
  for (let i = 0; i <= n * clamp(p); i++) {
    const t = i / n, x = lerp(l - 6, r + 10, t), yy = y + Math.sin(t * Math.PI * 1.3) * 7 - t * 6;
    if (i === 0) c.moveTo(x, yy); else c.lineTo(x, yy);
  }
  c.stroke(); c.restore();
}
/** An orange block that sweeps across [l, r] on a line: it grows in (inK) then leaves from the left (outK). */
export function sweep(c: C2D, l: number, r: number, y: number, size: number, inK: number, outK: number, color: string) {
  if (inK <= 0 || outK >= 1) return;
  c.fillStyle = color; c.fillRect(lerp(l, r, outK), y - size * 1.0, (r - l) * (inK - outK), size * 1.22);
}
/** `>>>`: three chevrons that light up in a wave after `start`. */
export function chevrons(c: C2D, x: number, y: number, size: number, pg: Page, time: number, start: number, a = 1) {
  const w = measure(c, '>', { size, color: pg.accent, family: DISPLAY });
  for (let i = 0; i < 3; i++) {
    const lit = time < start ? 0 : .35 + .65 * Math.max(0, Math.sin((time - start) * 7 - i * .9));
    txt(c, '>', x + i * (w + size * .18), y, { size, color: lit > .5 ? pg.accent : pg.mute, family: DISPLAY, alpha: a * lerp(.6, 1, lit) });
  }
  return 3 * w + 2 * size * .18;
}

// ---------------------------------------------------------------- page chrome

/** Header: an orange rule draws across, a tracked label on the left, an Anton label on the right, a slash between. */
export function header(c: C2D, pg: Page, time: number, start: number, left: string, right: string, show = 1) {
  if (show <= .001) return;
  const draw = at(time, start, start + .7, ease.outQuart);
  c.save(); c.globalAlpha *= show * .55; c.fillStyle = pg.accent; c.fillRect(MX, HEAD_Y, (W - MX * 2) * draw, 3); c.restore();
  const k = at(time, start + .15, start + .85, ease.outQuint);
  c.save(); c.translate(0, (1 - k) * 24);
  const lw = txt(c, left.toUpperCase(), MX, 196, { size: 30, color: pg.accent, family: SANS, weight: 800, tracking: 6, alpha: k * show });
  txt(c, right.toUpperCase(), W - MX, 196, { size: 44, color: pg.accent, family: DISPLAY, tracking: 3, align: 'right', alpha: k * show });
  c.globalAlpha *= k * show; c.strokeStyle = pg.accent; c.lineWidth = 2; c.beginPath(); c.moveTo(MX + lw + 34, 208); c.lineTo(MX + lw + 52, 156); c.stroke();
  c.restore();
}
/** Footer: a rule draws in from the right; brand on the left, a label and `>>>` on the right. */
export function footer(c: C2D, pg: Page, time: number, start: number, left: string, right: string, show = 1) {
  if (show <= .001) return;
  const draw = at(time, start, start + .7, ease.outQuart);
  c.save(); c.globalAlpha *= show * .55; c.fillStyle = pg.accent; c.fillRect(W - MX - (W - MX * 2) * draw, FOOT_Y, (W - MX * 2) * draw, 3); c.restore();
  const k = at(time, start + .2, start + .9, ease.outQuint), y = 1764 + (1 - k) * 16, st: Ink = { size: 28, color: pg.mute, family: SANS, weight: 600, tracking: 4, alpha: k * show };
  txt(c, left.toUpperCase(), MX, y, st);
  const cw = 3 * measure(c, '>', { size: 30, color: pg.mute, family: DISPLAY }) + 2 * 30 * .18;
  txt(c, right.toUpperCase(), W - MX - cw - 14, y, { ...st, align: 'right' });
  chevrons(c, W - MX - cw, y, 30, pg, time, start + 1, k * show);
}
/** 0–0.8 s: the accent fills the frame, then folds into the header rule (an opening for the first shot of a film). */
export function openingPanel(c: C2D, pg: Page, time: number) {
  if (time > .85) return;
  const k = at(time, .05, .7, ease.inOutQuart);
  const top = lerp(0, HEAD_Y, k), bot = lerp(H, HEAD_Y + 3, k), l = lerp(0, MX, k), r = lerp(W, W - MX, k);
  c.save(); c.globalAlpha *= 1 - .45 * pr(time, .62, .82); c.fillStyle = pg.accent; c.fillRect(l, top, r - l, bot - top); c.restore();
}

// ---------------------------------------------------------------- pictures

/**
 * A picture for a window: `assets/photo.jpg` when the project has one (prepared in black and white by
 * `loadPhoto`), otherwise the template's own stand-in drawing. `fx`, `fy` place the crop, `zoom` pushes in.
 */
export function cover(c: C2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number, fx = .5, fy = .5, zoom = 1) {
  const s = Math.max(w / img.width, h / img.height) * zoom, dw = img.width * s, dh = img.height * s;
  c.drawImage(img, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh);
}
/** In `setup`: load `assets/<name>` if it exists and keep a black-and-white copy in ctx.assets[key]. */
export async function loadPhoto(ctx: SetupContext, name: string, key = 'photo') {
  const img = await ctx.loadImage(`assets/${name}`).catch(() => undefined);
  if (!img) return;
  const o = new OffscreenCanvas(img.width, img.height), x = o.getContext('2d')!;
  x.filter = 'grayscale(1) contrast(1.08)'; x.drawImage(img, 0, 0);
  (ctx.assets as Record<string, unknown>)[key] = o;
}

/**
 * A monochrome product screen in the page's colours: big Anton figure, a bar chart and a list, one accent. Stand-in
 * for the user's real product until a film redraws it. Local coordinates (0, 0) → (w, h); `t` animates it.
 */
export function editorialScreen(c: C2D, w: number, h: number, page: Page, t: number, o: { title?: string; figure?: string; label?: string; tone?: 'page' | 'dark' } = {}) {
  const s = w / 900, pad = 64 * s;
  // In a window on the white page the screen is dark, like the black-and-white photos of the post: it reads as a picture.
  const pg = o.tone === 'page' ? page : { ...INK, accent: page.accent, accentLight: page.accentLight };
  c.save();
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, pg.dark ? '#1C1C1C' : '#FAFAFA'); g.addColorStop(1, pg.dark ? '#141414' : '#F0F0F0');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  txt(c, (o.title ?? 'Overview').toUpperCase(), pad, pad + 40 * s, { size: 30 * s, color: pg.mute, family: SANS, weight: 800, tracking: 6 * s });
  c.fillStyle = pg.accent; c.beginPath(); c.arc(w - pad - 16 * s, pad + 30 * s, 16 * s, 0, Math.PI * 2); c.fill();
  const n = Math.round(lerp(0, 12480, ease.outCubic(pr(t, .1, 1.4))));
  txt(c, o.figure ?? n.toLocaleString('en-US'), pad, pad + 240 * s, { size: 200 * s, color: pg.ink, family: DISPLAY, tracking: 2 * s });
  txt(c, (o.label ?? 'Active users this week').toUpperCase(), pad, pad + 300 * s, { size: 26 * s, color: pg.mute, family: SANS, weight: 700, tracking: 4 * s });
  const bars = [.42, .55, .48, .7, .62, .84, 1], bw = (w - pad * 2) / bars.length, base = pad + 640 * s;
  bars.forEach((v, i) => {
    const k = spring(t, .25 + i * .07, .6, .1), bh = 230 * s * v * k;
    c.fillStyle = i === bars.length - 1 ? pg.accent : alpha(pg.ink, pg.dark ? .32 : .16);
    c.fillRect(pad + i * bw + bw * .18, base - bh, bw * .64, bh);
  });
  c.fillStyle = alpha(pg.ink, .2); c.fillRect(pad, base + 2 * s, w - pad * 2, 2 * s);
  const rows = ['New order #2048', 'Team invite accepted', 'Report exported', 'Payment received'];
  rows.forEach((r, i) => {
    const y = base + 90 * s + i * 96 * s, k = at(t, .5 + i * .1, 1.1 + i * .1, ease.outQuint);
    if (y > h - 40 * s) return;
    c.save(); c.globalAlpha *= k; c.translate(0, (1 - k) * 20 * s);
    c.fillStyle = alpha(pg.ink, .08); c.fillRect(pad, y + 60 * s, w - pad * 2, 1.5 * s);
    txt(c, r, pad, y + 36 * s, { size: 32 * s, color: pg.ink, family: SANS, weight: 600 });
    txt(c, `${2 + i * 5}m`, w - pad, y + 36 * s, { size: 28 * s, color: pg.mute, family: SANS, weight: 600, align: 'right' });
    c.restore();
  });
  c.restore();
}

/** Carousel dots: the active one stretches into a pill and slides with `pos` (0..n-1). */
export function carouselDots(c: C2D, pg: Page, n: number, pos: number, y: number, a = 1) {
  for (let i = 0; i < n; i++) {
    const on = clamp(1 - Math.abs(pos - i)), w = 12 + 26 * on, x = CX + (i - (n - 1) / 2) * 46;
    c.save(); c.globalAlpha *= a; c.fillStyle = on > .5 ? pg.accent : pg.dots; c.fill(rr(x - w / 2, y, w, 12, 6)); c.restore();
  }
}
/** Carousel position from swipe times: an IG-style swipe with a small pull back before each one. */
export function carousel(time: number, swipes: number[]) {
  return swipes.reduce((pos, t) => pos + at(time, t, t + .6, springs.camera) - .028 * clamp(Math.sin(pr(time, t - .3, t + .15) * Math.PI)), 0);
}
export { DISPLAY, SANS };
