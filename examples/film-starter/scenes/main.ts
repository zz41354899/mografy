// A 20-second, five-shot film written the way a whole film should be: one world, one camera, one shot table,
// and every shot starting from the geometry the previous one ended on. Nothing is cut; the eye follows one
// light (a point that draws a line, the line that becomes a card's edge, the curve's last key that comes
// forward as a ring and lands as a full stop).
//
//  A point          0.0– 3.2  a point of light appears; it draws a line and the camera rides its head
//  One idea         3.2– 7.2  the line settles as the underline of the headline
//  Takes shape      7.2–11.6  the headline lifts away; the underline is the top edge of a card that draws itself
//                             round, fills, and plots an ease curve with the same point riding its head
//  Comes into focus 11.6–15.6 the curve's last key comes forward as a ring of light; the card falls out of focus
//  Move as one      15.6–20.0 the ring shrinks back to a point that lands as the full stop of the last line; hold
//
// Read it as a model for multi-shot films (references/film-architecture.md). It uses only @mografy/runtime:
// beats → meta.shots, cameraPath + withCamera, layer for group fades, blurLayer for depth of field, bloom for
// light, blurWords / riseWords for type. Type is set in the Inter subsets in assets/ (registered in mografy.json).
// Start a new film from a copy: `mografy add film-starter <folder>`.
import { at, beats, blurLayer, blurWords, bloom, cameraPath, clamp, ease, keys, layer, lerp, riseWords, roundRect, springs, stagger, text, withCamera } from '@mografy/runtime';
import type { Context2D, FrameContext, SetupContext } from '@mografy/runtime';

// ---------------------------------------------------------------- tokens (each fixed value lives once, here)
const C = {
  bg: '#0A0D12', bgLift: '#141A23', ink: '#F1F4F7', muted: '#8A95A5', faint: '#3A4250', edge: '#2B323D',
  cardTop: '#1A2029', cardBottom: '#11151B', accent: '#1BC6B4', accentRgb: '27, 198, 180', cool: '86, 120, 196',
};
const FONT = 'Inter, "Helvetica Neue", Arial, sans-serif';
const TITLE = { size: 140, color: C.ink, family: FONT, weight: 700, align: 'center' as const, baseline: 'alphabetic' as const, tracking: -4.5 };
const LABEL = { size: 30, color: C.ink, family: FONT, weight: 500, baseline: 'middle' as const, tracking: -.3 };
const glow = (a: number) => `rgba(${C.accentRgb}, ${a})`;

// ---------------------------------------------------------------- the shot table: the only source of timing
export const BEATS = beats([
  { title: 'A point', end: 3.2, stop: 2.6, handoff: .8, note: 'A point of light appears and draws a line; the camera rides its head.' },
  { title: 'One idea', end: 7.2, stop: 6.4, handoff: .8, note: 'The line settles as the underline of the headline.' },
  { title: 'Takes shape', end: 11.6, stop: 11.2, handoff: .8, note: 'The underline becomes the top edge of a card that draws itself and plots a curve.' },
  { title: 'Comes into focus', end: 15.6, stop: 14.8, handoff: .8, note: "The curve's last key comes forward as a ring; the card falls out of focus." },
  { title: 'Move as one', end: 20, stop: 19.4, note: 'The ring becomes the full stop of the last line; hold.' },
]);
const T = Object.fromEntries(BEATS.list.map(b => [b.title, b.start])) as Record<string, number>;
const T1 = T['A point']!, T2 = T['One idea']!, T3 = T['Takes shape']!, T4 = T['Comes into focus']!, T5 = T['Move as one']!;

export const meta = { width: 1920, height: 1080, duration: BEATS.duration, fps: 30, background: C.bg, shots: BEATS.shots };
export const params = {};

/** Data prepared once (in setup, or by a storyboard page): the last line is centred and the ring lands after it. */
export interface FilmData { endWidth: number }
export function prepare(): FilmData {
  const c = new OffscreenCanvas(1, 1).getContext('2d')!;
  c.font = `${TITLE.weight} ${TITLE.size}px ${FONT}`; c.letterSpacing = `${TITLE.tracking}px`;
  return { endWidth: c.measureText('Move as one').width };
}
export function setup(ctx: SetupContext) { ctx.assets.film = prepare(); }

// ---------------------------------------------------------------- shared geometry (world coordinates)
// The underline is the spine of the film: the point draws it, the headline sits on it, and it is the middle of
// the card's top edge, so the card grows out of it without a jump.
const LINE = { x0: 760, x1: 1160, y: 600 };
const CARD = { x: 960, y: LINE.y + 220, w: 760, h: 440, r: 40 };
const CX0 = CARD.x - CARD.w / 2, CY0 = CARD.y - CARD.h / 2;
// The ease curve on the card, cubic-bezier(.16, 1, .3, 1) between its two keys. Its last key is the light.
const PLOT = { x0: CX0 + 76, x1: CX0 + CARD.w - 76, y0: CY0 + CARD.h - 70, y1: CY0 + 180 };
const KEY = { x: PLOT.x1, y: PLOT.y1 };
const RING = { x: CARD.x, y: CARD.y + 10 };   // where the ring comes forward to
const END = { x: 960, y: CARD.y + 50 };       // baseline of the last line

/** One camera for the whole film. Keys sit on the shot table; no shot has its own camera. */
const camera = cameraPath([
  [0, LINE.x0, LINE.y, 2.6],                       // open close on the point: it must read at once
  [T1 + 1.4, LINE.x0 + 10, LINE.y, 2.4],
  [T2 + 1.0, 960, LINE.y - 30, 1.0],               // pull back to frame the headline on its line
  [T3, 960, LINE.y - 10, 1.0],
  [T3 + 2.0, 960, CARD.y - 10, 1.16],              // descend with the card as it draws itself round
  [T4, 960, CARD.y, 1.2],
  [T4 + 2.0, RING.x, RING.y, 1.34, .02],           // push in on the ring
  [T5, 960, RING.y + 10, 1.24],
  [BEATS.duration, 960, END.y - 44, 1.04],
]);

// The head of the line, as one curve through the first two shots (no stop at the shot boundary).
const head = keys([[T1 + 1.3, LINE.x0], [T2 + .3, LINE.x0 + 270], [T2 + 1.2, LINE.x1]]);

/**
 * The card's outline as n + 1 evenly spaced points, starting at the middle of the top edge and running
 * clockwise. A window round index 0 is the underline, so the outline can grow from it in both directions.
 */
function cardLoop(n: number) {
  const { r } = CARD, x1 = CX0 + CARD.w, y1 = CY0 + CARD.h, pts: [number, number][] = [[CARD.x, CY0]];
  const arc = (cx: number, cy: number, a: number) => { for (let i = 0; i <= 16; i++) { const t = a + i / 16 * Math.PI / 2; pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } };
  arc(x1 - r, CY0 + r, -Math.PI / 2); arc(x1 - r, y1 - r, 0); arc(CX0 + r, y1 - r, Math.PI / 2); arc(CX0 + r, CY0 + r, Math.PI);
  pts.push(pts[0]!);
  return resample(pts, n);
}
function resample(pts: readonly (readonly [number, number])[], n: number) {
  const len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  const total = len[len.length - 1]!;
  const out = Array.from({ length: n + 1 }, (_, i) => {
    const s = total * i / n; let j = 1; while (j < len.length - 1 && len[j]! < s) j++;
    const k = (s - len[j - 1]!) / Math.max(1e-6, len[j]! - len[j - 1]!);
    return [lerp(pts[j - 1]![0], pts[j]![0], k), lerp(pts[j - 1]![1], pts[j]![1], k)] as [number, number];
  });
  return { pts: out, total };
}
/** The plotted curve, evenly spaced along its length so the point rides it at an even speed. */
function plotCurve(n: number) {
  const b = (a: number, p1: number, p2: number, d: number, u: number) => (1 - u) ** 3 * a + 3 * (1 - u) ** 2 * u * p1 + 3 * (1 - u) * u * u * p2 + u ** 3 * d;
  const raw = Array.from({ length: 200 }, (_, i) => {
    const u = i / 199, px = b(0, .16, .3, 1, u), py = b(0, 1, 1, 1, u);
    return [lerp(PLOT.x0, PLOT.x1, px), lerp(PLOT.y0, PLOT.y1, py)] as [number, number];
  });
  return resample(raw, n).pts;
}
const LOOP = cardLoop(480), CURVE = plotCurve(240);   // fixed geometry, computed once
/** Stroke points [i0, i1] of a resampled path (fractional ends interpolated, indices wrap). */
function trace(c: Context2D, pts: readonly (readonly [number, number])[], i0: number, i1: number, wrap = false) {
  const n = pts.length - 1, at = (f: number) => {
    const g = wrap ? ((f % n) + n) % n : clamp(f, 0, n), i = Math.floor(g), k = g - i, p = pts[i]!, q = pts[Math.min(i + 1, n)]!;
    return [lerp(p[0], q[0], k), lerp(p[1], q[1], k)] as const;
  };
  c.beginPath(); const a = at(i0); c.moveTo(a[0], a[1]);
  for (let i = Math.floor(i0) + 1; i < i1; i++) { const p = at(i); c.lineTo(p[0], p[1]); }
  const b = at(i1); c.lineTo(b[0], b[1]); c.stroke();
}

// ---------------------------------------------------------------- the world, drawn from time alone
function dot(c: Context2D, x: number, y: number, r: number, color: string = C.accent) {
  if (r <= 0) return;
  c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}
/** The point of light: a core with a soft halo (a gradient, not a filter) and, while it moves, a bloom. */
function light(c: Context2D, x: number, y: number, r: number, energy: number) {
  if (r <= 0) return;
  const h = r * 7, g = c.createRadialGradient(x, y, 0, x, y, h);
  g.addColorStop(0, glow(.35 * energy)); g.addColorStop(.35, glow(.1 * energy)); g.addColorStop(1, glow(0));
  c.fillStyle = g; c.fillRect(x - h, y - h, h * 2, h * 2);
  const core = (d: Context2D) => { dot(d, x, y, r); dot(d, x, y, r * .45, '#E9FFFC'); };
  if (energy > .02) bloom(c, core, { radius: r * 1.6, strength: .9 * energy, halo: .5, bounds: [x - r, y - r, r * 2, r * 2] });
  core(c);
}

/** Shots 1–3: the point draws the line, the line rests as the underline, then grows round the card. */
const drawn = (t: number) => at(t, T3 + .35, T3 + 1.75, ease.inOutCubic);
function spine(c: Context2D, t: number) {
  const k = drawn(t);
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (k <= 0) {
    const x1 = Math.max(LINE.x0, head(t)), appear = springs.pop(clamp((t - .2) / .8));
    const moving = at(t, T1 + 1.2, T1 + 1.6) * (1 - at(t, T2 + .9, T2 + 1.4)), tail = at(t, T2 + .6, T2 + 1.8, ease.inOutCubic);
    if (x1 > LINE.x0 + .5) {
      // a comet while it moves: the tail fades in behind the head, then fills in as it settles
      const g = c.createLinearGradient(LINE.x0, 0, x1, 0);
      g.addColorStop(0, glow(tail)); g.addColorStop(1, glow(1));
      c.strokeStyle = g; c.lineWidth = 6; trace(c, [[LINE.x0, LINE.y], [x1, LINE.y]], 0, 1);
    }
    light(c, x1, LINE.y, 9 * appear * (1 - .25 * tail), .35 + .65 * Math.max(moving, 1 - at(t, .4, 1.6)));
    return;
  }
  if (k >= 1) return;   // the card draws its own outline from here
  // the underline is the window [-w, w] round the top-middle of the outline; it widens until the ends meet
  const n = LOOP.pts.length - 1, w0 = (LINE.x1 - LINE.x0) / 2 / LOOP.total * n, w = lerp(w0, n / 2, k);
  c.strokeStyle = C.accent; c.lineWidth = lerp(6, 3, k);
  trace(c, LOOP.pts, -w, w, true);
  const ends = 1 - at(k, .85, 1);
  light(c, ...LOOP.pts[Math.round(n - w) % n]!, 7 * ends, ends);
  light(c, ...LOOP.pts[Math.round(w) % n]!, 7 * ends, ends);
}

/** The card's face: glass, an outline that cools from accent to edge, a header and the plotted curve. */
function cardFace(c: Context2D, t: number, keyOut: number) {
  const shape = roundRect(CX0, CY0, CARD.w, CARD.h, CARD.r), fill = at(t, T3 + 1.45, T3 + 2.1, ease.outCubic);
  c.save();
  c.shadowColor = 'rgba(0, 0, 0, .55)'; c.shadowBlur = 90; c.shadowOffsetY = 40; c.globalAlpha = fill;
  const g = c.createLinearGradient(0, CY0, 0, CY0 + CARD.h); g.addColorStop(0, C.cardTop); g.addColorStop(1, C.cardBottom);
  c.fillStyle = g; c.fill(shape);
  c.restore();
  if (drawn(t) >= 1) {
    const cool = at(t, T3 + 1.9, T3 + 2.8, ease.inOutCubic);
    c.strokeStyle = cool < 1 ? mixHex(C.accent, C.edge, cool) : C.edge; c.lineWidth = lerp(3, 2, cool); c.stroke(shape);
    // a hairline of light on the top edge, where the underline was
    const hl = c.createLinearGradient(CX0, 0, CX0 + CARD.w, 0);
    hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(.5, `rgba(255,255,255,${.16 * cool})`); hl.addColorStop(1, 'rgba(255,255,255,0)');
    c.strokeStyle = hl; c.lineWidth = 1.5; c.beginPath(); c.moveTo(CX0 + CARD.r, CY0 + 1); c.lineTo(CX0 + CARD.w - CARD.r, CY0 + 1); c.stroke();
  }
  // header: label left, duration right, rising in on a stagger
  const row = (i: number) => at(t, T3 + 1.7 + stagger(i, 3, .1), T3 + 2.5 + stagger(i, 3, .1), springs.out);
  const hy = CY0 + 74;
  c.globalAlpha = row(0); dot(c, CX0 + 64, hy + (1 - row(0)) * 18, 7);
  text(c, 'Ease out', CX0 + 88, hy + (1 - row(0)) * 18, { ...LABEL, alpha: row(0) });
  text(c, '0.6 s', CX0 + CARD.w - 64, hy + (1 - row(1)) * 18, { ...LABEL, color: C.muted, align: 'right', alpha: row(1) });
  c.globalAlpha = row(2) * .9; c.fillStyle = C.edge; c.fillRect(CX0 + 40, CY0 + 124, CARD.w - 80, 1.5);
  c.globalAlpha = 1;
  // the plot: a quiet baseline, the start key, the curve traced by the point, then the last key
  const axis = at(t, T3 + 2.1, T3 + 2.7, ease.inOutCubic), draw = at(t, T3 + 2.35, T3 + 3.55, ease.inOutSine);
  c.strokeStyle = C.faint; c.lineWidth = 2; c.lineCap = 'round';
  c.beginPath(); c.moveTo(PLOT.x0, PLOT.y0); c.lineTo(lerp(PLOT.x0, PLOT.x1, axis), PLOT.y0); c.stroke();
  c.setLineDash([2, 10]); c.globalAlpha = at(t, T3 + 3.3, T3 + 3.9);
  c.beginPath(); c.moveTo(PLOT.x0, PLOT.y1); c.lineTo(PLOT.x1, PLOT.y1); c.stroke();
  c.setLineDash([]); c.globalAlpha = 1;
  if (axis > 0) { c.lineWidth = 3; c.strokeStyle = C.muted; c.fillStyle = C.cardBottom; c.beginPath(); c.arc(PLOT.x0, PLOT.y0, 9 * axis, 0, Math.PI * 2); c.fill(); c.stroke(); }
  if (draw > 0) {
    const n = CURVE.length - 1, end = draw * n, p = CURVE[Math.round(end)]!;
    c.strokeStyle = C.accent; c.lineWidth = 5; trace(c, CURVE, 0, end);
    if (draw < 1) light(c, p[0], p[1], 8, 1);
  }
  const key = at(t, T3 + 3.45, T3 + 4.05, springs.pop);
  if (key > 0 && keyOut <= 0) light(c, KEY.x, KEY.y, 12 * key, .6 * key);
}
function mixHex(a: string, b: string, k: number) {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b);
  return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i]!, k))).join(', ')})`;
}

/** The ring the last key becomes: a stroke with bloom, a faint fill, and one echo when it arrives. */
function ring(c: Context2D, t: number, x: number, y: number, radius: number, width: number, energy: number) {
  if (radius < width) { light(c, x, y, Math.max(radius, width / 2), energy); return; }
  const fill = c.createRadialGradient(x, y, radius * .2, x, y, radius);
  fill.addColorStop(0, glow(0)); fill.addColorStop(1, glow(.1 * energy));
  c.fillStyle = fill; c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fill();
  const echo = at(t, T4 + .7, T4 + 2.2, ease.outCubic);
  if (echo > 0 && echo < 1) { c.strokeStyle = glow(.35 * (1 - echo)); c.lineWidth = 2; c.beginPath(); c.arc(x, y, radius * (1 + .55 * echo), 0, Math.PI * 2); c.stroke(); }
  const draw = (d: Context2D) => { d.strokeStyle = C.accent; d.lineWidth = width; d.beginPath(); d.arc(x, y, radius, 0, Math.PI * 2); d.stroke(); };
  const e = radius + width;
  bloom(c, draw, { radius: 20, strength: energy, halo: .7, bounds: [x - e, y - e, e * 2, e * 2] });
  draw(c);
}

/**
 * The whole film on any 2D context in film coordinates: the scene below, or a storyboard page that tags its
 * canvas with filmFrame(c, 1920, 1080) and calls drawFilm(c, t, prepare()) for each panel.
 */
export function drawFilm(c: Context2D, t: number, data: FilmData) {
  const cam = camera(t);
  ambient(c, cam);
  withCamera(c, cam, w => world(w, t, data));
}
/** Two soft lights far behind the world: they move with the camera at a third of its speed, which gives depth. */
function ambient(c: Context2D, cam: { x: number; y: number; zoom: number }) {
  const lights: [number, number, number, string][] = [[620, 760, 900, `rgba(${C.accentRgb}, .07)`], [1400, 280, 1000, `rgba(${C.cool}, .08)`]];
  for (const [x, y, r, color] of lights) {
    const sx = 960 + (x - cam.x) * .33, sy = 540 + (y - cam.y) * .33, g = c.createRadialGradient(sx, sy, 0, sx, sy, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 1920, 1080);
  }
}
function world(c: Context2D, t: number, data: FilmData) {
  // Shots 2 and 3: the headline. Its exit overlaps the card drawing, so there is never an empty frame.
  const lift = at(t, T3, T3 + .7, ease.inOutCubic);
  if (t > T2 + .2 && lift < 1) blurWords(c, 'One idea.', 960, LINE.y - 58, TITLE, t, T2 + .45, { exit: lift, stagger: .1, duration: 1 });

  // Shot 4: the last key comes forward and the card falls out of focus; shot 5: it shrinks back to a point.
  const come = at(t, T4, T4 + 1.7, springs.camera);
  const back = at(t, T5, T5 + 1.2, springs.camera);
  const focus = come * (1 - back);
  const cardAlpha = (drawn(t) > .9 ? 1 : 0) * (1 - at(t, T5, T5 + .8, ease.inOutCubic));
  if (cardAlpha > 0) {
    // the face, its rows and its outline fade and blur as one layer; it leaves still out of focus
    const face = (d: Context2D) => cardFace(d, t, come);
    const bounds = [CX0 - 120, CY0 - 60, CARD.w + 240, CARD.h + 200] as const;   // room for the shadow
    if (come > .01) blurLayer(c, 'card', 16 * come, face, { alpha: cardAlpha * (1 - .35 * come), bounds });
    else layer(c, 'card', cardAlpha, face, { bounds });
  }
  spine(c, t);

  if (come > 0) {
    const endX = END.x + data.endWidth / 2 + 26;
    const x = lerp(lerp(KEY.x, RING.x, come), endX, back), y = lerp(lerp(KEY.y, RING.y, come), END.y - 11, back);
    ring(c, t, x, y, lerp(lerp(12, 160, come), 11, back), lerp(lerp(24, 9, come), 22, back), .6 + .4 * focus - .3 * at(t, T5 + 1.2, T5 + 2.4));
  }
  // the ring lands first as the full stop, then the line rises up to meet it
  if (t > T5 + .6) riseWords(c, 'Move as one', END.x, END.y, TITLE, t, T5 + .7, { stagger: .09, duration: 1 });
}

export function renderFrame(ctx: FrameContext, time: number) {
  const g = ctx.canvas.createRadialGradient(ctx.width / 2, ctx.height * .42, 0, ctx.width / 2, ctx.height * .42, ctx.width * .75);
  g.addColorStop(0, C.bgLift); g.addColorStop(1, C.bg);
  ctx.canvas.fillStyle = g; ctx.canvas.fillRect(0, 0, ctx.width, ctx.height);
  ctx.withCanvas(c => drawFilm(c, time, ctx.assets.film as FilmData));
  ctx.vignette(.4);
}
