// @ts-nocheck
// Montage look for 16:9 templates, from the Mografy montage film: three grounds (night with drifting colour orbs, light
// with pastel glows, neon black), the Mografy spectrum (teal → sky → violet → coral → amber), kinetic Inter type
// that sharpens out of a blur and settles from a spectrum tint, comets of light with bloom, conic-gradient rims,
// glass pills and product windows on tilted 3D planes. Few words, big type, a lot of air.
import { blurLayer, blurText, bloom, buffer, clamp, devScale, ease, layer, lerp, pr as P } from '@mografy/runtime';
import { SANS, type C2D } from './kit.js';

// The helpers below are written tersely and are not type-checked inside this file (`@ts-nocheck`), but every export
// declares its parameter types, so templates that call them are fully typed and get no implicit `any`.
/** A point [x, y] (some helpers add a third value). */
export type Pt = number[];
/** A colour as '#RRGGBB' or [r, g, b]. */
export type Color = string | number[];
/** A path measured by arc length (from `mkPath`). */
export interface PathT { pts: Pt[]; L: number[]; len: number }
/** Loose options object for the helpers below; the ones that take callbacks have their own types. */
export type Opts = Record<string, any>;
/** Options of `kin`. */
export interface KinOptions {
  [key: string]: unknown;
  out?: number; a?: number; w?: number; st?: number; d?: number; d0?: number; al?: 'left' | 'center' | 'right';
  hue?: number; blur?: number; rise?: number; lift?: number; tint?: boolean;
  /** Gradient for the glyphs whose `colAt(i)` is 'fill'; x0 is the line's left edge, width its width. */
  fill?: (c: C2D, x0: number, width: number) => string | CanvasGradient | CanvasPattern;
  /** Drive each glyph yourself: return its progress 0..1 from its index and its left edge. */
  prog?: (i: number, gx: number) => number;
  /** Colour of glyph i, or 'fill' to use `fill`. */
  colAt?: (i: number) => string | undefined;
  /** Font weight of glyph i. */
  wAt?: (i: number) => number;
}

export const W = 1920, H = 1080;
export const K = { teal: '#1BC6B4', sky: '#4AA8FF', violet: '#8C6BFF', coral: '#FF7A6B', amber: '#FFC15A', ink: '#141820', fg: '#EEF2F5', mut: '#8792A2', night: '#06080C' };
export const SPEC = [K.teal, K.sky, K.violet, K.coral, K.amber];
export const eo = ease.outCubic, eio = ease.inOutCubic, ei = (x: number) => x * x * x;
export const springK = (x: number) => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-6 * x) * Math.cos(9 * x);
export const rnd = (s: number) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hex = (h: string): number[] => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export const rgba = (c: Color, a = 1) => { const [r, g, b] = typeof c === 'string' ? hex(c) : c; return `rgba(${r | 0},${g | 0},${b | 0},${clamp(a)})`; };
export const mixc = (a: Color, b: Color, k: number): number[] => { const x = typeof a === 'string' ? hex(a) : a, y = typeof b === 'string' ? hex(b) : b; return [0, 1, 2].map(i => lerp(x[i], y[i], k)); };
export const specRGB = (u: number): number[] => { u = ((u % 1) + 1) % 1; const f = u * SPEC.length, i = Math.floor(f); return mixc(SPEC[i], SPEC[(i + 1) % SPEC.length], f - i); };
export const spec = (u: number, a = 1) => rgba(specRGB(u), a);
export const env = (t: number, a: number, b: number, i = .4, o = .4) => Math.min(P(t, a, a + i), 1 - P(t, b - o, b));
export { P, clamp, lerp };

// ---------------------------------------------------------------- theme

/** Params every montage template shares. */
export const montageParams = (ground = 'night') => ({
  theme: { name: 'Ground', type: 'enum' as const, default: ground, options: ['night', 'light', 'neon'] },
});
/** Colours for a ground: the type, its quiet second colour, surfaces. */
export function look(p: Readonly<Record<string, unknown>>) {
  const g = p.theme === 'light' ? 'light' : p.theme === 'neon' ? 'neon' : 'night';
  return g === 'light'
    ? { g, ink: K.ink, mut: '#6B7684', surface: '#FFFFFF', panel: '#F5F7F9', line: '#E2E7EC', dark: false }
    : { g, ink: K.fg, mut: '#8792A2', surface: g === 'neon' ? '#0B0E14' : '#0E1219', panel: '#131822', line: '#252C38', dark: true };
}
/** Fill the frame with the ground (skipped when a film passes `backdrop: false`). `T` drifts the light. */
export function ground(c: C2D, p: Readonly<Record<string, unknown>>, T: number, o: { orbs?: boolean; orbA?: string; orbB?: string } = {}) {
  if (p.backdrop === false) return;
  const g = look(p).g;
  if (g === 'light') {
    const lg = c.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, '#FBFCFD'); lg.addColorStop(1, '#EFF3F6'); c.fillStyle = lg; c.fillRect(0, 0, W, H);
    glow(c, 1560 + 90 * Math.sin(T * .23), 160, 720, '#C9F1EA', .55); glow(c, 260, 940 + 50 * Math.cos(T * .2), 680, '#E3DCFF', .55); glow(c, 1700, 980, 520, '#FFE3D6', .4);
    return;
  }
  if (g === 'neon') { c.fillStyle = '#040507'; c.fillRect(0, 0, W, H); return; }
  const rg = c.createRadialGradient(W / 2, H * .46, 0, W / 2, H / 2, W * .72); rg.addColorStop(0, '#111725'); rg.addColorStop(1, K.night); c.fillStyle = rg; c.fillRect(0, 0, W, H);
  // two slow colour orbs (the comet act's light), unless a template draws its own
  if (o.orbs !== false) {
    c.save(); c.globalCompositeOperation = 'lighter';
    glow(c, 560 + 40 * Math.sin(T * .5), 420 + 30 * Math.cos(T * .4), 520, o.orbA ?? K.teal, .2);
    glow(c, 1380 + 40 * Math.cos(T * .45), 640 + 30 * Math.sin(T * .35), 560, o.orbB ?? K.violet, .16);
    c.restore();
  }
}
export function vignette(c: C2D, a = .5) { const v = c.createRadialGradient(W / 2, H / 2, H * .42, W / 2, H / 2, W * .78); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${a})`); c.fillStyle = v; c.fillRect(0, 0, W, H); }

// ---------------------------------------------------------------- light

export function glow(c: C2D, x: number, y: number, r: number, col: Color, a: number) { if (a <= 0 || r <= 0) return; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(.45, rgba(col, a * .38)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
export function dot(c: C2D, x: number, y: number, r: number, col: string, a = 1) { if (a <= 0 || r <= 0) return; const ga = c.globalAlpha; c.globalAlpha = ga * a; c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.globalAlpha = ga; }
export function conic(c: C2D, cx: number, cy: number, rot: number) { const g = c.createConicGradient(rot, cx, cy); SPEC.forEach((k, i) => g.addColorStop(i / SPEC.length, k)); g.addColorStop(1, SPEC[0]); return g; }
export function specLinear(c: C2D, x0: number, y0: number, x1: number, y1: number, cols: string[] = SPEC) { const g = c.createLinearGradient(x0, y0, x1, y1); cols.forEach((k, i) => g.addColorStop(i / (cols.length - 1), k)); return g; }
export { bloom, blurLayer, layer, devScale };

// ---------------------------------------------------------------- paths

export function mkPath(pts: Pt[]): PathT { const L2 = [0]; for (let i = 1; i < pts.length; i++) L2.push(L2[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, L: L2, len: L2[L2.length - 1] }; }
export function pAt(Pa: PathT, s: number): number[] {
  s = clamp(s, 0, Pa.len); let lo = 0, hi = Pa.L.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (Pa.L[m] < s) lo = m; else hi = m; }
  const k = (s - Pa.L[lo]) / Math.max(1e-6, Pa.L[hi] - Pa.L[lo]), a = Pa.pts[lo], b = Pa.pts[hi]; return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), Math.atan2(b[1] - a[1], b[0] - a[0])];
}
export const bez = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 90): Pt[] => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [0, 1].map(j => u * u * u * p0[j] + 3 * u * u * t * p1[j] + 3 * u * t * t * p2[j] + t * t * t * p3[j]); });
export const qbez = (p0: Pt, p1: Pt, p2: Pt, n = 70): Pt[] => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [0, 1].map(j => u * u * p0[j] + 2 * u * t * p1[j] + t * t * p2[j]); });
export const fnPts = (f: (u: number) => Pt, n: number): Pt[] => Array.from({ length: n + 1 }, (_, i) => f(i / n));
export function resample(pts: Pt[], n: number): Pt[] { const Pa = mkPath(pts); return Array.from({ length: n + 1 }, (_, i) => pAt(Pa, Pa.len * i / n).slice(0, 2)); }
export function joinSegs(segs: Pt[][]): { path: PathT; marks: number[] } { const pts = [], marks = []; for (const s of segs) { pts.push(...(pts.length ? s.slice(1) : s)); marks.push(mkPath(pts).len); } return { path: mkPath(pts), marks }; }
/** Rounded-rect outline, clockwise from its left-middle point, resampled to n + 1 points (for morphs and rims). */
export function rrPts(cx: number, cy: number, w: number, h: number, r: number, n = 220): Pt[] {
  r = Math.min(r, w / 2, h / 2); const x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2, pts = [[x0, cy]];
  const arc = (ax, ay, a0, a1) => { for (let i = 0; i <= 14; i++) { const a = lerp(a0, a1, i / 14); pts.push([ax + r * Math.cos(a), ay + r * Math.sin(a)]); } };
  arc(x0 + r, y0 + r, Math.PI, 1.5 * Math.PI); arc(x1 - r, y0 + r, 1.5 * Math.PI, 2 * Math.PI); arc(x1 - r, y1 - r, 0, .5 * Math.PI); arc(x0 + r, y1 - r, .5 * Math.PI, Math.PI); pts.push([x0, cy]);
  return resample(pts, n);
}
export function circlePts(cx: number, cy: number, R: number, n = 220): Pt[] { return fnPts(u => [cx + R * Math.cos(Math.PI + u * 2 * Math.PI), cy + R * Math.sin(Math.PI + u * 2 * Math.PI)], n); }
export const lerpPts = (a: Pt[], b: Pt[], k: number): Pt[] => a.map((p, i) => [lerp(p[0], b[i][0], k), lerp(p[1], b[i][1], k)]);
export function polyPath(c: C2D, pts: Pt[], close = true) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); if (close) c.closePath(); }
export function rr(c: C2D, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.roundRect(x, y, w, h, r); }

/** A comet: the path from s1 - len to s1, tapering and fading toward the tail, coloured by arc length. */
export function comet(c: C2D, Pa: PathT, s1: number, o: Opts = {}) {
  const len = o.len ?? 1500, lw = o.lw ?? 3.2, s0 = Math.max(o.from ?? 0, s1 - len), a = o.a ?? 1, per = o.per ?? 2600, hue = o.hue ?? 0;
  if (s1 - s0 < 1 || a <= 0) return; const n = Math.max(2, Math.ceil((s1 - s0) / (o.step ?? 10))), ga = c.globalAlpha; c.lineCap = 'butt'; c.lineJoin = 'round';
  let p = pAt(Pa, s0);
  for (let i = 1; i <= n; i++) {
    const s = s0 + (s1 - s0) * i / n, q = pAt(Pa, s), f = clamp((s - (s1 - len)) / len);
    c.globalAlpha = ga * a * Math.pow(f, o.fade ?? 1.2); c.strokeStyle = o.col ?? spec(s / per + hue); c.lineWidth = lw * (.3 + .7 * f);
    c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); p = q;
  }
  c.globalAlpha = ga;
}
/** A comet with its white head and bloom: the signature light of the montage. */
export function lightTrail(c: C2D, Pa: PathT, s: number, o: Opts = {}) {
  const emit = x => { comet(x, Pa, s, { step: 20, ...o }); if (o.head !== false) dot(x, ...pAt(Pa, s).slice(0, 2), o.headR ?? 6, '#FFFFFF', o.a ?? 1); };
  emit(c); bloom(c, emit, { radius: o.bloom ?? 10, strength: (o.strength ?? 1.1) * (o.a ?? 1), halo: .9 });
}
/** A neon conic-gradient rim along a closed outline, with bloom. */
export function neonRim(c: C2D, pts: Pt[], cx: number, cy: number, flow: number, lw = 4, k = 1) {
  const st = x => { polyPath(x, pts); x.strokeStyle = conic(x, cx, cy, flow); x.lineWidth = lw; x.lineJoin = 'round'; x.stroke(); };
  c.save(); c.globalAlpha *= k; st(c); c.restore(); bloom(c, st, { radius: 14, strength: 1.2 * k, halo: 1 });
}

// ---------------------------------------------------------------- type

export function setFont(c: C2D, size: number, w = 500) { c.font = `${w} ${size}px ${SANS}`; c.letterSpacing = size >= 56 ? `${(-size * .028).toFixed(2)}px` : '0px'; }
export const textW = (c: C2D, s: string, size: number, w = 500): number => { setFont(c, size, w); return c.measureText(s).width; };
/**
 * Kinetic line: every glyph rises, sharpens out of a blur and settles from a spectrum tint into its colour.
 * t = seconds since the line started; o.out (0..1) blurs, lifts and fades the whole line away. Returns its width.
 * Options: w weight, st stagger, d duration, al align, a alpha, fill(c, x0, width) gradient for colAt(i) === 'fill',
 * colAt(i) per-glyph colour, prog(i, x) to drive glyphs yourself, tint false to skip the spectrum tint.
 */
export function kin(c: C2D, s: string, x: number, y: number, size: number, col: string, t: number, o: KinOptions = {}): number {
  const out = o.out ?? 0, a0 = o.a ?? 1; if (t <= 0 || out >= 1 || a0 <= 0) return 0;
  const w = o.w ?? 500, st = o.st ?? .03, d = o.d ?? .55, al = o.al ?? 'center'; setFont(c, size, w); c.textBaseline = 'middle'; c.textAlign = 'left';
  const chars = [...s], xs = [0]; for (let i = 1; i <= chars.length; i++) xs.push(c.measureText(chars.slice(0, i).join('')).width);
  const total = xs[chars.length], x0 = al === 'left' ? x : al === 'right' ? x - total : x - total / 2, sc = devScale(c), ga = c.globalAlpha;
  const fill = o.fill ? o.fill(c, x0, total) : null;
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === ' ') continue;
    const e = o.prog ? o.prog(i, x0 + xs[i]) : eo(P(t, (o.d0 ?? 0) + i * st, (o.d0 ?? 0) + i * st + d)); if (e <= 0) continue;
    const b = Math.max(1 - e, out), blur = b * size * (o.blur ?? .2), base = o.colAt ? o.colAt(i) : col, gradient = fill && (!o.colAt || o.colAt(i) === 'fill');
    const tinted = gradient ? '' : rgba(mixc(specRGB((o.hue ?? 0) + i * .05), base === 'fill' ? col : base, Math.min(1, e * 1.15)));
    const gy = y + (1 - e) * size * (o.rise ?? .16) - out * size * (o.lift ?? .3), weight = o.wAt ? o.wAt(i) : w;
    if (blur * sc > .5) {
      if (gradient) blurLayer(c, 'kin', blur, x2 => { setFont(x2, size, weight); x2.textBaseline = 'middle'; x2.textAlign = 'left'; x2.fillStyle = fill; x2.fillText(chars[i], x0 + xs[i], gy); },
        { alpha: a0 * e * (1 - out), bounds: [x0 + xs[i] - size * .2, gy - size * .8, xs[i + 1] - xs[i] + size * .4, size * 1.6] });
      else blurText(c, chars[i], x0 + xs[i], gy, { size, family: SANS, weight, baseline: 'middle', color: o.tint === false || e >= 1 ? base : tinted, alpha: a0 * e * (1 - out) }, blur);
      continue;
    }
    c.save(); c.globalAlpha = ga * a0 * e * (1 - out);
    c.fillStyle = gradient ? fill : (o.tint === false || e >= 1 ? base : tinted);
    setFont(c, size, weight); c.fillText(chars[i], x0 + xs[i], gy); c.restore();
  }
  return total;
}
/** Spectrum fill for part of a kinetic line: `kin(..., specWord(c, before, word, size))` colours `word` only. */
export function specWord(before: string, word: string, size: number, w = 500, cols: string[] = [K.teal, K.sky, K.violet]) {
  const n0 = [...before].length, n1 = n0 + [...word].length;
  return { colAt: i => i >= n0 && i < n1 ? 'fill' : undefined, fill: (x, x0) => specLinear(x, x0 + textW(x, before, size, w), 0, x0 + textW(x, before + word, size, w), 0, cols) };
}

// ---------------------------------------------------------------- 3D planes

/** A flat card in 3D: local point (x, y) → screen. Pivot (u, v) in local units sits at screen (px, py); s = scale. */
export function planeProj(o: Opts): (x: number, y: number) => number[] {
  const f = o.f ?? 1900, cyw = Math.cos(o.yaw ?? 0), syw = Math.sin(o.yaw ?? 0), cp = Math.cos(o.pitch ?? 0), sp = Math.sin(o.pitch ?? 0), cr = Math.cos(o.roll ?? 0), sr = Math.sin(o.roll ?? 0), s = o.s ?? 1;
  return (x, y) => { const X = (x - o.u) * s, Y = (y - o.v) * s, y1 = Y * cp, z1 = Y * sp, x2 = X * cyw + z1 * syw, z2 = -X * syw + z1 * cyw, k = f / Math.max(80, f + z2), qx = x2 * k, qy = y1 * k;
    return [o.px + qx * cr - qy * sr, o.py + qx * sr + qy * cr]; };
}
/** Texture-map tex (local w × h at ts px per unit) through proj, as a grid of small affine cells. */
export function drawPlane(c: C2D, tex: CanvasImageSource, ts: number, w: number, h: number, proj: (u: number, v: number) => number[], nx = 30, ny = 18) {
  const G = []; for (let j = 0; j <= ny; j++) { const row = []; for (let i = 0; i <= nx; i++) row.push(proj(w * i / nx, h * j / ny)); G.push(row); }
  const cw = w / nx, ch = h / ny; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = G[j][i], b = G[j][i + 1], d = G[j + 1][i], ex = .8 / Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1])), ey = .8 / Math.max(1, Math.hypot(d[0] - a[0], d[1] - a[1]));
    c.save(); c.transform(b[0] - a[0], b[1] - a[1], d[0] - a[0], d[1] - a[1], a[0], a[1]);
    c.drawImage(tex, i * cw * ts, j * ch * ts, cw * ts, ch * ts, 0, 0, 1 + ex, 1 + ey); c.restore();
  }
}
/** Render a local w × h drawing into a pooled texture sized for how large the plane appears. */
export function texture(c: C2D, name: string, w: number, h: number, s: number, draw: (x: C2D) => void): [CanvasImageSource, number] { const ts = clamp(s * devScale(c) * 1.05, .5, 2.6), b = buffer('tex-' + name, w * ts, h * ts), x = b.getContext('2d'); x.setTransform(ts, 0, 0, ts, 0, 0); draw(x); return [b, ts]; }
/** A plane with its soft shadow: draw(local ctx) paints the w × h card. */
export function card3d(c: C2D, name: string, w: number, h: number, o: Opts, draw: (x: C2D) => void, a = 1, dark = false) {
  const proj = planeProj(o), sc = devScale(c);
  layer(c, name, a, x => {
    x.save(); x.shadowColor = dark ? 'rgba(0,0,0,.55)' : 'rgba(28,46,64,.16)'; x.shadowBlur = 90 * o.s * sc; x.shadowOffsetY = 40 * o.s * sc;
    polyPath(x, rrPts(w / 2, h / 2, w, h, 24, 120).map(p => proj(p[0], p[1]))); x.fillStyle = dark ? '#0E1219' : '#FFFFFF'; x.fill(); x.restore();
    const [tex, ts] = texture(x, name, w, h, o.s, draw); drawPlane(x, tex, ts, w, h, proj);
  });
  return proj;
}

// ---------------------------------------------------------------- UI

/** Four-point sparkle. */
export function spark(c: C2D, x: number, y: number, r: number, t: number) { c.save(); c.translate(x, y); c.rotate(t * .4); c.fillStyle = conic(c, 0, 0, t); c.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r2 = i % 2 ? r * .28 : r; c.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); } c.closePath(); c.fill(); c.restore(); }
/** The prompt pill, centred at (cx, cy): `n` typed characters, `send` 0..1 lights the send button. */
export function pillUI(c: C2D, cx: number, cy: number, w: number, h: number, text: string, n: number, send: number, o: Opts = {}) {
  const d = o.dark, sc = devScale(c), now = o.now ?? 0; c.save(); c.translate(cx, cy);
  if (o.body !== false) { c.save(); if (!d && o.shadow !== false) { c.shadowColor = 'rgba(28,46,64,.13)'; c.shadowBlur = h * .45 * sc; c.shadowOffsetY = h * .12 * sc; }
    rr(c, -w / 2, -h / 2, w, h, h / 2); c.fillStyle = d ? '#0B0E14' : '#FFFFFF'; c.fill(); c.restore(); }
  if ((o.rimA ?? 1) > 0) { c.save(); c.globalAlpha *= o.rimA ?? 1; rr(c, -w / 2, -h / 2, w, h, h / 2); c.strokeStyle = conic(c, 0, 0, o.flow ?? 0); c.lineWidth = o.rim ?? h * .03; c.stroke(); c.restore(); }
  const ta = o.textA ?? 1;
  if (ta > 0 && w > h * 3) {
    c.save(); rr(c, -w / 2, -h / 2, w, h, h / 2); c.clip(); c.globalAlpha *= ta;
    const fs = h * .33, tx = -w / 2 + h * (o.icon ? .82 : .42), s = [...text].slice(0, Math.max(0, Math.floor(n))).join(''); setFont(c, fs, 500); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = d ? K.fg : K.ink; c.fillText(s, tx, h * .01);
    if (o.icon) spark(c, -w / 2 + h * .48, 0, h * .16, now);
    if (o.caret && (now * 1.6) % 1 < .6) { c.fillStyle = K.teal; c.fillRect(tx + c.measureText(s).width + h * .03, -h * .2, Math.max(1.5, h * .022), h * .4); }
    const bx = w / 2 - h / 2, br = h * .32 * (1 + .18 * Math.sin(Math.PI * clamp(o.pulse ?? 0)));
    dot(c, bx, 0, br, send > 0 ? rgba(mixc(d ? '#222936' : '#E3E8EC', K.teal, clamp(send))) : (d ? '#222936' : '#E3E8EC'));
    c.strokeStyle = send > .5 ? '#fff' : (d ? '#5B6574' : '#9AA5B1'); c.lineWidth = Math.max(1.2, h * .035); c.lineCap = 'round'; const k = br * .42;
    c.beginPath(); c.moveTo(bx, k); c.lineTo(bx, -k); c.moveTo(bx - k * .75, -k * .2); c.lineTo(bx, -k); c.lineTo(bx + k * .75, -k * .2); c.stroke(); c.restore();
  }
  c.restore();
}
/** A gradient "frame of a film" or hero image: ground, a soft orb, a title block and a dot. i picks the palette. */
const WARM = [['#FFB27A', '#FF7A8A', '#FFE6A8'], ['#7FD8FF', '#8C6BFF', '#E8E2FF'], ['#1BC6B4', '#7FE3D2', '#FFF3C2'], ['#FFC15A', '#FF7A6B', '#FFF0D0'], ['#8C6BFF', '#4AA8FF', '#C8F1FF'], ['#FF8FB1', '#FFC15A', '#FFFFFF'], ['#4AA8FF', '#1BC6B4', '#EFFFFB'], ['#FF7A6B', '#8C6BFF', '#FFD9CF']];
export function miniFilm(c: C2D, x: number, y: number, w: number, h: number, i: number, t: number, r = 10) {
  const p = WARM[i % 8]; c.save(); rr(c, x, y, w, h, r); c.clip();
  const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, p[0]); g.addColorStop(1, p[1]); c.fillStyle = g; c.fillRect(x, y, w, h);
  const ox = x + w * (.66 + .06 * Math.sin(t * .9 + i)), oy = y + h * (.46 + .05 * Math.cos(t * .7 + i));
  const gg = c.createRadialGradient(ox, oy, 0, ox, oy, h * .55); gg.addColorStop(0, rgba(p[2], .85)); gg.addColorStop(1, rgba(p[2], 0)); c.fillStyle = gg; c.fillRect(x, y, w, h);
  c.fillStyle = rgba('#FFFFFF', .92); rr(c, x + w * .08, y + h * .36, w * .34, h * .075, h * .04); c.fill();
  c.fillStyle = rgba('#FFFFFF', .6); rr(c, x + w * .08, y + h * .5, w * .22, h * .045, h * .025); c.fill();
  dot(c, ox, oy, h * .07, '#FFFFFF', .95); c.restore();
}

/**
 * A product window in the montage style, local 1400 × 860: chrome with title, a hero stage, a stat column, a list.
 * Stand-in for the user's product; redraw it in the template or replace it with a screenshot. o: dark, t, title, gen 0..1.
 */
export const APP = { w: 1400, h: 860 };
export function appUI(c: C2D, o: Opts = {}) {
  const d = o.dark, t = o.t ?? 0, bg = d ? '#0E1219' : '#FFFFFF', panel = d ? '#131822' : '#F5F7F9', line = d ? '#252C38' : '#E2E7EC', fg = d ? K.fg : K.ink, mut = d ? '#7F8A99' : '#8A95A3';
  rr(c, 0, 0, 1400, 860, 24); c.fillStyle = bg; c.fill(); c.strokeStyle = line; c.lineWidth = 1.5; c.stroke();
  [0, 1, 2].forEach(i => dot(c, 30 + i * 20, 30, 6, d ? '#2B3240' : '#DCE2E8'));
  setFont(c, 15, 600); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = fg; c.fillText(o.title ?? 'Northwind · Overview', 700, 31);
  // sidebar
  rr(c, 28, 76, 220, 756, 16); c.fillStyle = panel; c.fill();
  ['Overview', 'Projects', 'Reports', 'Team', 'Settings'].forEach((s, i) => { if (i === 0) { rr(c, 40, 94, 196, 40, 10); c.fillStyle = d ? 'rgba(27,198,180,.16)' : 'rgba(27,198,180,.12)'; c.fill(); }
    setFont(c, 15, i === 0 ? 600 : 500); c.textAlign = 'left'; c.fillStyle = i === 0 ? (d ? '#7FE3D2' : '#0F9C8E') : mut; c.fillText(s, 60, 114 + i * 52); });
  // hero stage
  miniFilm(c, 272, 76, 700, 394, 6, t, 16);
  // stats
  const gen = o.gen ?? 1;
  [['Active users', '12,480', '+18%'], ['Revenue', '$84.2k', '+12%'], ['Retention', '91%', '+4%']].forEach(([a, b, e], i) => {
    const k = springK(clamp(gen * 3 - i)); if (k <= 0) return; const y = 76 + i * 134;
    c.save(); c.globalAlpha *= clamp(k); rr(c, 996, y, 376, 118, 16); c.fillStyle = panel; c.fill();
    setFont(c, 14, 500); c.textAlign = 'left'; c.fillStyle = mut; c.fillText(a, 1020, y + 30);
    setFont(c, 34, 700); c.fillStyle = fg; c.fillText(b, 1020, y + 74); setFont(c, 14, 600); c.fillStyle = '#12A898'; c.fillText(e, 1020 + textW(c, b, 34, 700) + 12, y + 78); c.restore(); });
  // chart
  rr(c, 272, 494, 1100, 338, 16); c.fillStyle = panel; c.fill();
  setFont(c, 15, 600); c.textAlign = 'left'; c.fillStyle = fg; c.fillText('Growth', 296, 526);
  const pts = fnPts(u => [300 + u * 1044, 790 - (60 + 200 * (u * u * .7 + .3 * u) + 18 * Math.sin(u * 13)) * clamp(gen * 1.4 - .2)], 60);
  c.save(); polyPath(c, [...pts, [1344, 812], [300, 812]]); const ag = c.createLinearGradient(0, 560, 0, 812); ag.addColorStop(0, rgba(K.teal, .22)); ag.addColorStop(1, rgba(K.teal, 0)); c.fillStyle = ag; c.fill(); c.restore();
  polyPath(c, pts, false); c.strokeStyle = specLinear(c, 300, 0, 1344, 0, [K.teal, K.sky, K.violet]); c.lineWidth = 3.5; c.lineJoin = 'round'; c.stroke();
}
