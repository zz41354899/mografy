// Product walkthrough helpers: redraw an app's screens as large, simplified cards and film one action at a time.
// Motion helpers (springs, cameras, cursor) are pure functions of time; drawing helpers take a native 2D context
// (inside ctx.withCanvas) and a theme from createKit. Layout is in the scene's own pixels, so portrait works too.
import { clamp, ease, lerp, pr, pulse, springEase, springs } from '@mografy/runtime';

type C2D = CanvasRenderingContext2D;
export type Rect = [x: number, y: number, width: number, height: number];
export type Point = [x: number, y: number];
export interface Viewport { width: number; height: number }

// ---------------------------------------------------------------- motion

// Springs and easing live in @mografy/runtime (springEase, springs, pulse, ease.inOutSine);
// the names below are kept so walkthrough scenes written before that keep compiling unchanged.
export const spring = springEase;
export { springs };
export const sineInOut = (p: number) => ease.inOutSine(clamp(p));
/** A short bump around a click or tap, for squash and highlights (peaks at 1 at `at`). */
export const press = pulse;
/** The first part of `text` for typing progress p (0..1). */
export const typed = (text: string, p: number) => { const ch = [...text]; return ch.slice(0, Math.round(ch.length * clamp(p))).join(''); };
/** Fade in at each range start and out at its end; ranges are [in, out] seconds. */
export function visible(time: number, ranges: [number, number][], fade = .25) {
  return ranges.reduce((m, [a, b]) => Math.max(m, pr(time, a, a + fade) * (1 - pr(time, b - fade, b))), 0);
}
/** Interpolate rectangles (for a container transform or a moving highlight). */
export const lerpRect = (a: Rect, b: Rect, p: number): Rect => [lerp(a[0], b[0], p), lerp(a[1], b[1], p), lerp(a[2], b[2], p), lerp(a[3], b[3], p)];

// ---------------------------------------------------------------- cameras

/** A framing: the layout point shown at the centre of the screen, and the zoom. */
export interface Cam { x: number; y: number; z: number }
/** [time, x, y, zoom]; repeat a key to hold. */
export type CameraKey = [time: number, x: number, y: number, zoom: number];

/**
 * A zoom between two framings as a pure scale about one fixed point: the centre moves linearly in 1 / zoom and the zoom
 * changes evenly in log space, so the picture never swings sideways while it scales.
 */
export function zoomPath(a: Cam, b: Cam, p: number): Cam {
  const z = a.z * (b.z / a.z) ** p;
  const w = Math.abs(b.z - a.z) < 1e-3 ? p : (1 / z - 1 / a.z) / (1 / b.z - 1 / a.z);
  return { x: lerp(a.x, b.x, w), y: lerp(a.y, b.y, w), z };
}
/** Evaluate camera keys at `time` with a spring between keys. Each card usually has its own keys. */
export function camAt(keys: CameraKey[], time: number, curve: (p: number) => number = springs.camera): Cam {
  const first = keys[0]!; if (time <= first[0] || keys.length < 2) return { x: first[1], y: first[2], z: first[3] };
  let i = 0; while (i < keys.length - 2 && time > keys[i + 1]![0]) i++;
  const a = keys[i]!, b = keys[i + 1]!;
  return zoomPath({ x: a[1], y: a[2], z: a[3] }, { x: b[1], y: b[2], z: b[3] }, curve(pr(time, a[0], b[0])));
}
/** Draw layout content through a camera. */
export function withCamera(c: C2D, view: Viewport, cam: Cam, draw: () => void) {
  c.save(); c.translate(view.width / 2, view.height / 2); c.scale(cam.z, cam.z); c.translate(-cam.x, -cam.y); draw(); c.restore();
}
export const toScreen = (view: Viewport, cam: Cam, x: number, y: number): Point => [view.width / 2 + (x - cam.x) * cam.z, view.height / 2 + (y - cam.y) * cam.z];
export const rectToScreen = (view: Viewport, cam: Cam, r: Rect): Rect => { const [x, y] = toScreen(view, cam, r[0], r[1]); return [x, y, r[2] * cam.z, r[3] * cam.z]; };
/** Scale a rectangle about a point, e.g. to follow a card's entrance scale. */
export const scaleRect = (r: Rect, s: number, cx: number, cy: number): Rect => [cx + (r[0] - cx) * s, cy + (r[1] - cy) * s, r[2] * s, r[3] * s];

// ---------------------------------------------------------------- cursor

/** [arrival time, position]; a position function is evaluated every frame, so a target can follow a moving camera. */
export type CursorKey = [time: number, at: Point | ((time: number) => Point)];
/** Screen position of the cursor: it leaves for each key up to 1.1 s before arriving, on a gentle arc. */
export function cursorAt(keys: CursorKey[], time: number): Point {
  const pos = (k: CursorKey): Point => typeof k[1] === 'function' ? k[1](time) : k[1];
  if (keys.length < 2) return pos(keys[0]!);
  let i = 0; while (i < keys.length - 2 && time > keys[i + 1]![0]) i++;
  const a = keys[i]!, b = keys[i + 1]!, dur = Math.min(1.1, (b[0] - a[0]) * .9), k = springs.cursor(pr(time, b[0] - dur, b[0]));
  const A = pos(a), B = pos(b), bend = Math.sin(k * Math.PI) * Math.min(60, Math.hypot(B[0] - A[0], B[1] - A[1]) * .08);
  return [lerp(A[0], B[0], k) + bend, lerp(A[1], B[1], k) - bend * .5];
}
/** A large macOS-style arrow; `squash` (0..1, usually from press) shrinks it on a click. */
export function drawCursor(c: C2D, x: number, y: number, o: { scale?: number; alpha?: number; squash?: number } = {}) {
  const a = o.alpha ?? 1; if (a <= 0) return;
  const s = (o.scale ?? 2.2) * (1 - .14 * (o.squash ?? 0));
  c.save(); c.globalAlpha *= a; c.translate(x, y); c.scale(s, s);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 22); c.lineTo(5.5, 17); c.lineTo(9.5, 26); c.lineTo(13, 24.5); c.lineTo(9, 15.8); c.lineTo(16, 15.8); c.closePath();
  c.shadowColor = 'rgba(0,0,0,.28)'; c.shadowBlur = 8; c.shadowOffsetY = 2; c.fillStyle = '#111'; c.fill();
  c.shadowColor = 'transparent'; c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.lineJoin = 'round'; c.stroke();
  c.restore();
}
/** An expanding ring where a click or tap lands (draw it for ~0.45 s after `at`). */
export function clickRing(c: C2D, x: number, y: number, time: number, at: number, color: string, size = 1) {
  const r = pr(time, at, at + .45); if (r <= 0 || r >= 1) return;
  c.save(); c.globalAlpha *= (1 - r) * .5; c.beginPath(); c.arc(x, y, (10 + 40 * springs.out(r)) * size, 0, Math.PI * 2);
  c.strokeStyle = color; c.lineWidth = 4 * size; c.stroke(); c.restore();
}
/** A finger tap for phone scenes (no cursor): a soft filled dot that presses in, then a ring. */
export function tap(c: C2D, x: number, y: number, time: number, at: number, color = 'rgba(29,41,48,.35)', size = 1) {
  const k = pr(time, at - .18, at + .12) * (1 - pr(time, at + .12, at + .3)); if (k > 0) {
    c.save(); c.globalAlpha *= k; c.beginPath(); c.arc(x, y, 26 * size * (1 - .15 * press(time, at)), 0, Math.PI * 2); c.fillStyle = color; c.fill(); c.restore(); }
  clickRing(c, x, y, time, at, color, size);
}

// ---------------------------------------------------------------- backdrop

let fluidCanvas: OffscreenCanvasRenderingContext2D | undefined;
/**
 * Slow light blobs on a tiny canvas scaled up to cover the frame: soft brand-colour atmosphere behind floating cards.
 * `colors` needs at least two #rrggbb values (base first). The scratch canvas is redrawn from scratch every frame.
 */
export function fluid(c: C2D, view: Viewport, time: number, colors: string[], streaks = .5) {
  const g = fluidCanvas ??= new OffscreenCanvas(192, 108).getContext('2d')!;
  g.fillStyle = colors[0]!; g.fillRect(0, 0, 192, 108);
  const blobs: [number, number, number, number][] = [[.18, .25, .55, 0], [.82, .2, .5, 1.7], [.75, .85, .6, 3.1], [.2, .8, .5, 4.4], [.5, .5, .38, 2.2]];
  blobs.forEach(([x, y, r, ph], i) => {
    const col = colors[1 + i % (colors.length - 1)] ?? colors[0]!;
    const X = (x + Math.sin(time * .23 + ph) * .12) * 192, Y = (y + Math.cos(time * .19 + ph * 1.3) * .14) * 108;
    const gr = g.createRadialGradient(X, Y, 0, X, Y, r * 192); gr.addColorStop(0, col); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.fillRect(0, 0, 192, 108);
  });
  if (streaks > 0) ([[.35, .4, -.5, 0], [.7, .62, .4, 2.5]] as const).forEach(([x, y, rot, ph]) => {
    g.save(); g.translate((x + Math.sin(time * .17 + ph) * .1) * 192, (y + Math.cos(time * .21 + ph) * .1) * 108); g.rotate(rot + Math.sin(time * .1 + ph) * .2); g.scale(3.2, .45);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30); gr.addColorStop(0, `rgba(255,255,255,${streaks})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(-40, -40, 80, 80); g.restore();
  });
  c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(g.canvas, 0, 0, view.width, view.height); c.restore();
}
/** A solid colour inside radius r around the centre with a soft edge: grow it to flood in, shrink it to reveal. */
export function flood(c: C2D, view: Viewport, r: number, color = '#ffffff', feather = 520) {
  if (r <= 0) return;
  const cx = view.width / 2, cy = view.height / 2, R = r + feather, g = c.createRadialGradient(cx, cy, 0, cx, cy, R);
  g.addColorStop(0, color); g.addColorStop(r / R, color); g.addColorStop(1, color + '00'); c.fillStyle = g; c.fillRect(0, 0, view.width, view.height);
}

// ---------------------------------------------------------------- drawing kit

export interface Theme {
  primary: string; primaryDark: string; primarySoft: string;
  ink: string; mute: string; faint: string; line: string; surface: string; card: string;
  skeleton: string; shadow: string; font: string; mono: string; radius: number;
}
export const defaultTheme: Theme = {
  primary: '#3b6cf6', primaryDark: '#2c55cc', primarySoft: '#e3ebff',
  ink: '#1b2230', mute: '#667085', faint: '#a4acb9', line: '#e1e4ea', surface: '#f3f5f8', card: '#ffffff',
  skeleton: 'rgba(27,34,48,.08)', shadow: '16,24,48', font: '"Inter", "Noto Sans TC", system-ui, sans-serif', mono: '"JetBrains Mono", ui-monospace, monospace', radius: 28,
};
export type IconName = 'search' | 'plus' | 'arrowUp' | 'copy' | 'share' | 'user' | 'link' | 'eye' | 'lock' | 'x' | 'doc' | 'chev' | 'building' | 'mail' | 'sparkle';
export interface TextOptions { color?: string; weight?: number; align?: CanvasTextAlign; font?: string }

/** Mix two #rrggbb colours in sRGB. */
export const mixColor = (a: string, b: string, p: number) => {
  const h = (s: string) => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  const A = h(a), B = h(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i]!, clamp(p))).toString(16).padStart(2, '0')).join('');
};
const FAR = 4000;

/** Drawing helpers bound to a theme. Sizes are layout pixels; type at about 1.3–1.6× the app's own size reads at 1080p. */
export function createKit(overrides: Partial<Theme> = {}) {
  const th: Theme = { ...defaultTheme, ...overrides };
  const rr = (c: C2D, x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.roundRect(x, y, Math.max(0, w), Math.max(0, h), Math.max(0, Math.min(r, w / 2, h / 2))); };
  const box = (c: C2D, x: number, y: number, w: number, h: number, r: number, fill: string) => { rr(c, x, y, w, h, r); c.fillStyle = fill; c.fill(); };
  const hair = (c: C2D, x: number, y: number, w: number, h: number, r: number, color = th.line, lw = 1.5) => { rr(c, x + lw / 2, y + lw / 2, w - lw, h - lw, r); c.lineWidth = lw; c.strokeStyle = color; c.stroke(); };
  const line = (c: C2D, x1: number, y1: number, x2: number, y2: number, color = th.line, lw = 1.5) => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = color; c.lineWidth = lw; c.stroke(); };
  const dot = (c: C2D, x: number, y: number, r: number, fill: string) => { c.beginPath(); c.arc(x, y, Math.max(0, r), 0, Math.PI * 2); c.fillStyle = fill; c.fill(); };
  const fontOf = (size: number, o: TextOptions = {}) => `${o.weight ?? 500} ${size}px ${o.font ?? th.font}`;
  const measure = (c: C2D, s: string, size: number, o: TextOptions = {}) => { c.font = fontOf(size, o); return c.measureText(s).width; };
  const text = (c: C2D, s: string, x: number, y: number, size: number, o: TextOptions = {}) => {
    c.font = fontOf(size, o); c.textAlign = o.align ?? 'left'; c.textBaseline = 'middle'; c.fillStyle = o.color ?? th.ink; c.fillText(s, x, y);
  };
  /** Break text into lines that fit maxWidth (per character, which suits CJK and short UI copy). */
  const wrap = (c: C2D, s: string, maxWidth: number, size: number, o: TextOptions = {}) => {
    const out: string[] = []; let cur = '';
    for (const ch of s) { if (cur && measure(c, cur + ch, size, o) > maxWidth) { out.push(cur); cur = ch.trimStart(); } else cur += ch; }
    if (cur) out.push(cur); return out;
  };
  /** Blurred text without c.filter: the glyphs are drawn far off-canvas and only their shadow lands in place. */
  const blurText = (c: C2D, s: string, x: number, y: number, size: number, blur: number, o: TextOptions = {}) => {
    if (blur < .25) return text(c, s, x, y, size, o);
    const m = c.getTransform(), k = Math.hypot(m.a, m.b);
    c.save(); c.shadowColor = o.color ?? th.ink; c.shadowBlur = blur * k; c.shadowOffsetX = FAR * m.a; c.shadowOffsetY = FAR * m.b; c.translate(-FAR, 0);
    text(c, s, x, y, size, o); c.restore();
  };
  /** Per-character entrance: each glyph rises a little and goes from blurred to sharp, staggered over `span` seconds. */
  const reveal = (c: C2D, s: string, x: number, y: number, size: number, time: number, start: number, span: number, o: TextOptions = {}) => {
    if (time < start) return;
    const chars = [...s], n = chars.length, D = .55;
    if (time >= start + span + D) return text(c, s, x, y, size, o);
    const W = measure(c, s, size, o), align = o.align ?? 'left', x0 = align === 'center' ? x - W / 2 : align === 'right' ? x - W : x;
    let pre = '';
    chars.forEach((ch, i) => {
      const a = start + (n > 1 ? span * i / (n - 1) : 0), k = springs.out(pr(time, a, a + D));
      if (k > 0) { c.save(); c.globalAlpha *= k; blurText(c, ch, x0 + measure(c, pre, size, o), y + (1 - k) * size * .22, size, (1 - k) * size * .25, { ...o, align: 'left' }); c.restore(); }
      pre += ch;
    });
  };
  /** A floating card: a wide soft shadow, a contact shadow and a hairline. Shadows scale with the current transform. */
  const card = (c: C2D, r: Rect, o: { radius?: number; fill?: string } = {}) => {
    const [x, y, w, h] = r, rad = o.radius ?? th.radius, fill = o.fill ?? th.card, m = c.getTransform(), k = Math.hypot(m.a, m.b);
    c.save(); c.shadowColor = `rgba(${th.shadow},.16)`; c.shadowBlur = 90 * k; c.shadowOffsetY = 40 * k; box(c, x, y, w, h, rad, fill);
    c.shadowColor = `rgba(${th.shadow},.08)`; c.shadowBlur = 12 * k; c.shadowOffsetY = 3 * k; box(c, x, y, w, h, rad, fill); c.restore();
    hair(c, x, y, w, h, rad, `rgba(${th.shadow},.07)`, 1);
  };
  /** A rounded bar standing in for copy the action does not need. */
  const skeleton = (c: C2D, x: number, y: number, w: number, h = 12) => box(c, x, y, w, h, h / 2, th.skeleton);
  /** A pill label; returns its width. x is the left edge, y the middle. */
  const chip = (c: C2D, x: number, y: number, label: string, o: { fg?: string; bg?: string; size?: number } = {}) => {
    const size = o.size ?? 16, w = measure(c, label, size, { weight: 600 }) + size * 1.3;
    box(c, x, y - size * .95, w, size * 1.9, size * .95, o.bg ?? th.surface); text(c, label, x + w / 2, y + 1, size, { color: o.fg ?? th.mute, weight: 600, align: 'center' }); return w;
  };
  const stroke = (c: C2D, color: string, lw = 1.5) => { c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); };
  /** Line icons on a 16 px grid centred on (x, y); scale with `s`. */
  const icon = (c: C2D, name: IconName, x: number, y: number, color = th.ink, s = 1) => {
    c.save(); c.translate(x, y); c.scale(s, s);
    const R = (a: number, b: number, w: number, h: number, r = 2) => { rr(c, a, b, w, h, r); stroke(c, color); };
    const L = (...p: number[]) => { c.beginPath(); c.moveTo(p[0]!, p[1]!); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i]!, p[i + 1]!); stroke(c, color); };
    const O = (cx: number, cy: number, r: number) => { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); stroke(c, color); };
    if (name === 'search') { O(-1, -1, 5); L(3, 3, 6, 6); }
    else if (name === 'plus') { L(-5, 0, 5, 0); L(0, -5, 0, 5); }
    else if (name === 'arrowUp') { L(0, 5, 0, -5); L(-4, -1, 0, -5, 4, -1); }
    else if (name === 'copy') { R(-3, -3, 9, 9); L(-6, 3, -6, -6, 3, -6); }
    else if (name === 'share') { O(4, -5, 2); O(-4, 0, 2); O(4, 5, 2); L(-2, -1, 2, -4); L(-2, 1, 2, 4); }
    else if (name === 'user') { O(0, -3, 3); L(-5, 7, -4, 3, 4, 3, 5, 7); }
    else if (name === 'link') { R(-7, -3, 8, 6, 3); R(-1, -3, 8, 6, 3); }
    else if (name === 'eye') { c.beginPath(); c.ellipse(0, 0, 7, 4.5, 0, 0, Math.PI * 2); stroke(c, color); O(0, 0, 2); }
    else if (name === 'lock') { R(-6, -1, 12, 9); c.beginPath(); c.arc(0, -2, 4, Math.PI, 0); stroke(c, color); }
    else if (name === 'x') { L(-5, -5, 5, 5); L(5, -5, -5, 5); }
    else if (name === 'doc') { R(-6, -7, 12, 14); L(-3, -2, 3, -2); L(-3, 1, 3, 1); L(-3, 4, 1, 4); }
    else if (name === 'chev') { L(-4, -2, 0, 2, 4, -2); }
    else if (name === 'building') { R(-7, -3, 7, 10, 1); R(0, -7, 7, 14, 1); L(2.5, -3, 4.5, -3); L(2.5, 0, 4.5, 0); L(2.5, 3, 4.5, 3); }
    else if (name === 'mail') { R(-7, -5, 14, 10); L(-7, -4, 0, 1, 7, -4); }
    else if (name === 'sparkle') {
      const star = (cx: number, cy: number, r: number) => { c.beginPath(); c.moveTo(cx, cy - r); c.quadraticCurveTo(cx, cy, cx + r, cy); c.quadraticCurveTo(cx, cy, cx, cy + r); c.quadraticCurveTo(cx, cy, cx - r, cy); c.quadraticCurveTo(cx, cy, cx, cy - r); c.fillStyle = color; c.fill(); };
      star(-1, 1, 6); star(5, -4.5, 2.8);
    }
    c.restore();
  };
  /** A soft halo that spreads from a pressed control. */
  const ring = (c: C2D, r: Rect, radius: number, time: number, at: number, color = th.primary) => {
    const k = pr(time, at, at + .6); if (k <= 0 || k >= 1) return; const e = springs.out(k) * 10;
    c.save(); c.globalAlpha *= (1 - k) * .5; rr(c, r[0] - e, r[1] - e, r[2] + 2 * e, r[3] + 2 * e, radius + e); c.strokeStyle = color; c.lineWidth = 3; c.stroke(); c.restore();
  };
  /** A button that squashes on `pressAt` and tints with `hover` (0..1). */
  const button = (c: C2D, r: Rect, label: string, o: { kind?: 'primary' | 'secondary'; size?: number; hover?: number; time?: number; pressAt?: number; icon?: IconName } = {}) => {
    const [x, y, w, h] = r, size = o.size ?? 22, hov = o.hover ?? 0, primary = (o.kind ?? 'primary') === 'primary', rad = Math.min(16, h / 2);
    const p = o.pressAt !== undefined && o.time !== undefined ? press(o.time, o.pressAt) : 0;
    c.save(); c.translate(x + w / 2, y + h / 2); c.scale(1 - .05 * p, 1 - .05 * p); c.translate(-w / 2, -h / 2);
    if (primary) box(c, 0, 0, w, h, rad, mixColor(th.primary, th.primaryDark, hov));
    else { box(c, 0, 0, w, h, rad, mixColor(th.card, th.primarySoft, hov)); hair(c, 0, 0, w, h, rad, mixColor(th.line, th.primary, hov)); }
    const col = primary ? '#ffffff' : th.ink, lw = measure(c, label, size, { weight: 600 }), iw = o.icon ? size * .9 + 10 : 0, x0 = (w - lw - iw) / 2;
    if (o.icon) icon(c, o.icon, x0 + size * .45, h / 2, o.icon === 'sparkle' && !primary ? th.primary : col, size / 16);
    text(c, label, x0 + iw, h / 2 + 1, size, { color: col, weight: 600 });
    c.restore();
    if (o.pressAt !== undefined && o.time !== undefined) ring(c, r, rad, o.time, o.pressAt);
  };
  /**
   * An input. `value` wraps inside the field when `lines` > 1; `caret` draws the caret after the last character
   * (blink it with `blink(time)` and keep it solid while typing).
   */
  const field = (c: C2D, r: Rect, o: { value?: string; placeholder?: string; size?: number; focus?: number; caret?: boolean; mono?: boolean; lines?: number; radius?: number } = {}) => {
    const [x, y, w, h] = r, size = o.size ?? 22, focus = o.focus ?? 0, rad = o.radius ?? 16, pad = size * .9, tf: TextOptions = { weight: 400, ...(o.mono ? { font: th.mono } : {}) };
    box(c, x, y, w, h, rad, th.card); hair(c, x, y, w, h, rad, focus > 0 ? th.primary : th.line, focus > 0 ? 2 : 1.5);
    if (focus > 0) { c.save(); c.globalAlpha *= .2 * focus; hair(c, x - 5, y - 5, w + 10, h + 10, rad + 5, th.primary, 5); c.restore(); }
    const lh = size * 1.55, multi = (o.lines ?? 1) > 1, top = multi ? y + pad + size * .7 : y + h / 2 + 1;
    const ls = o.value ? (multi ? wrap(c, o.value, w - pad * 2, size, tf) : [o.value]) : [];
    if (ls.length) ls.forEach((l, i) => text(c, l, x + pad, top + i * lh, size, { ...tf, color: th.ink }));
    else if (o.placeholder) text(c, o.placeholder, x + pad, top, size, { ...tf, color: th.faint });
    if (o.caret) { const last = ls[ls.length - 1] ?? ''; box(c, x + pad + 1 + measure(c, last, size, tf), top + Math.max(0, ls.length - 1) * lh - size * .62, 3, size * 1.25, 1.5, th.primary); }
  };
  /** A check mark that draws itself over k (0..1). */
  const check = (c: C2D, x: number, y: number, s: number, k: number, color = th.primary, lw = 3) => {
    const p: Point[] = [[-.42, 0], [-.12, .3], [.45, -.32]], L1 = .42, L2 = .85, d = clamp(k) * (L1 + L2);
    c.save(); c.beginPath(); c.moveTo(x + p[0]![0] * s, y + p[0]![1] * s);
    if (d <= L1) { const u = d / L1; c.lineTo(x + lerp(p[0]![0], p[1]![0], u) * s, y + lerp(p[0]![1], p[1]![1], u) * s); }
    else { c.lineTo(x + p[1]![0] * s, y + p[1]![1] * s); const u = (d - L1) / L2; c.lineTo(x + lerp(p[1]![0], p[2]![0], u) * s, y + lerp(p[1]![1], p[2]![1], u) * s); }
    stroke(c, color, lw); c.restore();
  };
  /** A dark notice pill centred on (x, y), entering over k (0..1). */
  const toast = (c: C2D, x: number, y: number, label: string, k: number, o: { icon?: IconName; size?: number } = {}) => {
    if (k <= 0) return; const size = o.size ?? 20, iw = o.icon ? size * 1.6 + 12 : 0, w = measure(c, label, size, { weight: 600 }) + iw + size * 2.2, h = size * 2.8;
    c.save(); c.globalAlpha *= clamp(k); c.translate(x, y + (1 - k) * 14); c.scale(.94 + .06 * k, .94 + .06 * k);
    c.save(); c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 26; c.shadowOffsetY = 10; box(c, -w / 2, -h / 2, w, h, h / 2, th.ink); c.restore();
    let tx = -w / 2 + size * 1.1;
    if (o.icon) { dot(c, tx + size * .8, 0, size * .8, th.primary); icon(c, o.icon, tx + size * .8, 0, '#ffffff', size / 18); tx += iw; }
    text(c, label, tx, 1, size, { color: '#ffffff', weight: 600 }); c.restore();
  };
  /**
   * Container transform: a card grows from rect `from` (the control that was just used) to rect `to` (the next card),
   * both in screen space. `outgoing` draws the control and fades early; `incoming` draws the next card's content and is
   * scaled with the box and revealed inside it. Use springs.pop for k so the card settles with a hint of overshoot.
   */
  const grow = (c: C2D, from: Rect, to: Rect, k: number, o: { fromRadius?: number; toRadius?: number; fromColor?: string; toColor?: string; outgoing?: () => void; incoming?: () => void } = {}) => {
    const [x, y, w, h] = lerpRect(from, to, k), r = lerp(o.fromRadius ?? 16, o.toRadius ?? th.radius, clamp(k));
    card(c, [x, y, w, h], { radius: r, fill: mixColor(o.fromColor ?? th.card, o.toColor ?? th.card, clamp(k * 1.6)) });
    const into = (R: Rect, draw: () => void, a: number) => {
      if (a <= 0) return; const s = w / R[2];
      c.save(); rr(c, x, y, w, h, r); c.clip(); c.globalAlpha *= a; c.translate(x + w / 2, y + h / 2); c.scale(s, s); c.translate(-(R[0] + R[2] / 2), -(R[1] + R[3] / 2)); draw(); c.restore();
    };
    if (o.outgoing) into(from, o.outgoing, 1 - pr(k, 0, .35));
    if (o.incoming) into(to, o.incoming, pr(k, .35, .9));
  };
  /** A phone body around `screen`; `draw` paints the screen in its own coordinates (0, 0)–(width, height). */
  const phone = (c: C2D, screen: Rect, draw: (c: C2D, w: number, h: number) => void, o: { body?: string; bg?: string } = {}) => {
    const [x, y, w, h] = screen, bez = w * .035, rad = w * .13;
    c.save(); c.shadowColor = 'rgba(0,0,0,.28)'; c.shadowBlur = 50; c.shadowOffsetY = 20; box(c, x - bez, y - bez, w + 2 * bez, h + 2 * bez, rad + bez, o.body ?? '#1d2930'); c.restore();
    c.save(); rr(c, x, y, w, h, rad); c.clip(); box(c, x, y, w, h, 0, o.bg ?? '#f7f9f8'); c.translate(x, y); draw(c, w, h); c.restore();
    box(c, x + w / 2 - w * .14, y + w * .03, w * .28, w * .075, w * .0375, o.body ?? '#1d2930');
  };
  return { theme: th, rr, box, hair, line, dot, text, measure, wrap, blurText, reveal, card, skeleton, chip, icon, ring, button, field, check, toast, grow, phone, mix: mixColor };
}
export type Kit = ReturnType<typeof createKit>;
/** Caret blink: on for the first half of every 0.42 s. */
export const blink = (time: number) => Math.floor(time * 2.4) % 2 === 0;
/** Count a number up with the out spring; format with toLocaleString('en-US') or your own. */
export const countUp = (value: number, p: number) => Math.round(value * springs.out(p));
