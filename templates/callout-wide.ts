// Callout: the product window swings in on a tilted plane; a comet of light runs once around one element and leaves
// a neon rim while the rest of the frame dims; then a spectrum leader runs out of the rim, its arrow pointing back
// at the element, and opens a glass label whose title sharpens in.
import type { FrameContext } from '@mografy/runtime';
import { exitOf, safeGuide, safeParam, spring, stage, type C2D, type TemplateInfo } from './kit.js';
import { APP, H, K, P, W, appUI, bez, bloom, comet, conic, clamp, drawPlane, layer, polyPath, texture, dot, eio, eo, ground, kin, lerp, look, mkPath, montageParams, pAt, planeProj, rgba, rr, rrPts, specLinear, textW } from './montage.js';

export const template = {
  id: 'callout-wide', name: 'Callout', category: 'explain', aspect: '16:9', pair: 'callout',
  summary: 'A comet rings one element of a product window on a tilted plane, the rest dims, and a leader opens a glass label.',
  agentHint: 'Point at one feature of a product window. Title 1–3 words ([brackets] take the spectrum), detail one short sentence. With backdrop false the window is skipped and the frame dims around FOCUS over your own picture; move FOCUS (a rect in the 1400 × 860 window) to your element, or redraw the window in `appUI`.',
  principles: ['staging', 'anticipation', 'follow-through', 'slow in and slow out'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 4.5, fps: 30, background: '#06080C' };

export const params = {
  title: { name: 'Title', type: 'string' as const, default: '[Live] insights' },
  detail: { name: 'Detail', type: 'string' as const, default: 'Updates the moment your team does.' },
  ...montageParams('night'), ...safeParam,
};

/** The focused element in window units (the second stat card of `appUI`), and its corner radius. */
const FOCUS = { x: 984, y: 198, w: 400, h: 142, r: 22 };
/** The label panel on the right (left, width, top); the leader lands on its top edge. */
const PX = 1262, PW = 562, PT = 596, PAD = 44;
/** Ring, leader and label beats. */
const RING = 1.05, LEAD = 1.65, LABEL = 2.05;

type Pts = number[][];
type Box = [number, number, number, number];
/** Bounding box of points, padded and snapped to 32 px so pooled buffers are reused. */
function boxOf(pts: Pts, pad: number): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x!); y0 = Math.min(y0, y!); x1 = Math.max(x1, x!); y1 = Math.max(y1, y!); }
  const bx = Math.floor((x0 - pad) / 32) * 32, by = Math.floor((y0 - pad) / 32) * 32;
  return [bx, by, Math.ceil((x1 + pad - bx) / 32) * 32, Math.ceil((y1 + pad - by) / 32) * 32];
}
/** `lightTrail` with its bloom limited to `bounds` (the shared one blooms the whole frame). */
function trail(c: C2D, Pa: ReturnType<typeof mkPath>, s: number, o: Record<string, number>, bounds: Box) {
  const emit = (x: C2D) => { comet(x, Pa, s, { step: 20, ...o }); const h = pAt(Pa, s); dot(x, h[0], h[1], 6, '#FFFFFF', o.a ?? 1); };
  emit(c); bloom(c, emit, { radius: 10, strength: 1.1 * (o.a ?? 1), halo: .9, bounds });
}
/**
 * `neonRim` with its bloom limited to `bounds`, blooming only while it flares (`flare` 0..1); at rest a soft wide
 * stroke stands in for the bloom, so a held frame costs no blur.
 */
function rim(c: C2D, pts: Pts, cx: number, cy: number, flow: number, lw: number, k: number, flare: number, bounds: Box, dark: boolean) {
  const st = (x: C2D) => { polyPath(x, pts); x.strokeStyle = conic(x, cx, cy, flow); x.lineWidth = lw; x.lineJoin = 'round'; x.stroke(); };
  const ga = c.globalAlpha; c.save(); c.globalAlpha = ga * k; st(c);
  c.globalAlpha = ga * k * (dark ? .2 : .12) * (1 - flare); polyPath(c, pts); c.lineWidth = lw * 4; c.stroke(); c.restore();
  if (flare > .01) bloom(c, st, { radius: 14, strength: 1.2 * k * flare, halo: 1, bounds });
}

/**
 * The product window on its plane: a soft gradient shadow, the face, and the `appUI` texture
 * mapped through a coarse grid (the plane is only gently tilted). Cheaper than `card3d` for a window that holds.
 */
function windowPlane(c: C2D, o: { s: number }, proj: (x: number, y: number) => number[], dark: boolean, a: number) {
  const outline = rrPts(APP.w / 2, APP.h / 2, APP.w, APP.h, 24, 80).map(q => proj(q[0], q[1]));
  // fixed bounds: the window moves, and a layer of a new size every frame would allocate a new buffer
  layer(c, 'callout-window', a, (x: C2D) => {
    // a soft elliptical shadow: one gradient fill, far cheaper than blurring the outline
    const cx = (outline[0]![0]! + outline[40]![0]!) / 2, cy = (outline[20]![1]! + outline[60]![1]!) / 2 + 40 * o.s, rw = Math.abs(outline[40]![0]! - outline[0]![0]!) * .62;
    x.save(); x.translate(cx, cy); x.scale(1, .72);
    const g = x.createRadialGradient(0, 0, rw * .55, 0, 0, rw); g.addColorStop(0, dark ? 'rgba(0,0,0,.55)' : 'rgba(28,46,64,.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(-rw, -rw, rw * 2, rw * 2); x.restore();
    polyPath(x, outline); x.fillStyle = dark ? '#0E1219' : '#FFFFFF'; x.fill();
    const [tex, ts] = texture(x, 'callout-app', APP.w, APP.h, .74, (t: C2D) => appUI(t, { dark, t: 0, gen: 1 }));
    drawPlane(x, tex, ts, APP.w, APP.h, proj, 12, 8);
  });
}

/** The detail on one line when it fits `max` px, else two balanced lines. */
function wrap(c: C2D, s: string, size: number, max: number) {
  const words = s.split(' ');
  if (textW(c, s, size, 500) <= max || words.length < 2) return [s];
  let best = 1, score = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = textW(c, words.slice(0, i).join(' '), size, 500), b = textW(c, words.slice(i).join(' '), size, 500), m = Math.max(a, b);
    if (m < score) { score = m; best = i; }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), d = meta.duration, out = exitOf(time, d, .5), dark = lk.dark, overlay = p.backdrop === false, flow = time * .5;
  stage(ctx, '16:9', c => {
    ground(c, p, time, { orbA: K.sky, orbB: K.violet });

    // ---- the window swings in from the left and settles turned toward the label; on the way out it recedes
    const sp = spring(time, .05, .8, .08), k = eo(P(time, .05, 1.3)), back = eio(P(time, d - .55, d));
    const o = { u: APP.w / 2, v: APP.h / 2, px: lerp(-300, 650, sp) - back * 90, py: 540, s: .74 * lerp(.92, 1, k) * lerp(1, .95, back),
      yaw: lerp(.7, .2, k), pitch: lerp(.1, .04, k), roll: lerp(-.03, 0, k) };
    const proj = planeProj(o);
    if (!overlay && time > .03) windowPlane(c, o, proj, dark, clamp(P(time, .03, .3)) * (1 - back));

    // ---- the focus: dim the rest of the frame, then a comet runs once around the element and leaves a neon rim
    const pts = rrPts(FOCUS.x + FOCUS.w / 2, FOCUS.y + FOCUS.h / 2, FOCUS.w, FOCUS.h, FOCUS.r, 160).map(q => proj(q[0], q[1]));
    const fc = proj(FOCUS.x + FOCUS.w / 2, FOCUS.y + FOCUS.h / 2), rimEnd = proj(FOCUS.x + FOCUS.w, FOCUS.y + FOCUS.h / 2);
    const dim = eo(P(time, RING + .1, RING + .6)) * (1 - out);
    if (dim > 0) {
      c.save(); c.beginPath(); c.rect(0, 0, W, H); c.moveTo(pts[0][0], pts[0][1]); for (const q of pts) c.lineTo(q[0], q[1]); c.closePath();
      c.fillStyle = lk.g === 'light' ? rgba('#F4F6F8', .62 * dim) : rgba(lk.g === 'neon' ? '#040507' : '#06080C', .6 * dim); c.fill('evenodd'); c.restore();
    }
    const ring = mkPath(pts), run = eio(P(time, RING, RING + .6));
    // bloom bounds from the settled pose, so the pooled buffers keep one size while the window still moves
    const still = planeProj({ ...o, px: 650, s: .74, yaw: .2, pitch: .04, roll: 0 });
    const fb = boxOf(rrPts(FOCUS.x + FOCUS.w / 2, FOCUS.y + FOCUS.h / 2, FOCUS.w, FOCUS.h, FOCUS.r, 24).map(q => still(q[0], q[1])), 48);
    if (run > 0 && run < 1) trail(c, ring, ring.len * run, { len: ring.len * .55, lw: 3.2, a: 1 - out, per: ring.len }, fb);
    const rimA = P(time, RING + .35, RING + .7) * (1 - out);
    if (rimA > 0) rim(c, pts, fc[0], fc[1], flow, 3.2, rimA, 1 - P(time, RING + .8, RING + 1.3), fb, dark);

    // ---- the leader: a comet runs out of the rim to the label; it leaves a spectrum line with an arrow at the rim
    const anchor: [number, number] = [PX + 72, PT], start: [number, number] = [rimEnd[0] + 24, rimEnd[1]];
    const lead = mkPath(bez(start, [start[0] + 120, start[1]], [anchor[0], anchor[1] - 130], anchor, 60));
    const ls = lead.len * eo(P(time, LEAD, LEAD + .45)), lineA = P(time, LEAD + .2, LEAD + .5) * (1 - out);
    if (ls > 0 && time < LEAD + .9) trail(c, lead, ls, { len: 340, lw: 3, a: (1 - P(time, LEAD + .45, LEAD + .9)) * (1 - out), per: 900 }, boxOf(lead.pts, 12));
    if (lineA > 0) {
      c.save(); c.globalAlpha *= lineA * .85; c.lineWidth = 2.4; c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = specLinear(c, start[0], start[1], anchor[0], anchor[1], [K.teal, K.sky, K.violet]);
      c.beginPath(); lead.pts.forEach((q: number[], i: number) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke();
      // the arrow points back into the rim
      const a = pAt(lead, 6)[2] + Math.PI, hx = start[0] - 4, hy = start[1];
      c.fillStyle = K.teal; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx - 18 * Math.cos(a - .45), hy - 18 * Math.sin(a - .45)); c.lineTo(hx - 18 * Math.cos(a + .45), hy - 18 * Math.sin(a + .45)); c.closePath(); c.fill();
      c.restore();
    }

    // ---- the label: a glass panel opens from the anchor, the title sharpens in, the detail follows
    const raw = String(p.title), m0 = raw.indexOf('['), m1 = raw.indexOf(']'), title = raw.replace(/[[\]]/g, ''), n0 = m0 < 0 ? -1 : m0, n1 = m1 < 0 ? -1 : m1 - 1;
    const size = Math.min(76, 76 * (PW - 2 * PAD) / Math.max(1, textW(c, title, 76, 600)));
    const lines = wrap(c, String(p.detail), 30, PW - 2 * PAD), ph = PAD * 2 + size + 22 + lines.length * 42;
    const open = spring(time, LABEL - .05, .5, .1);
    if (open > 0) {
      c.save(); c.globalAlpha *= clamp(open * 1.5) * (1 - out);
      const w = lerp(40, PW, open), h = lerp(40, ph, open);
      if (!dark) { c.shadowColor = 'rgba(28,46,64,.12)'; c.shadowBlur = 40; c.shadowOffsetY = 14; }
      rr(c, PX, PT, w, h, 28); c.fillStyle = dark ? 'rgba(14,18,25,.86)' : 'rgba(255,255,255,.9)'; c.fill(); c.shadowColor = 'transparent';
      c.strokeStyle = lk.line; c.lineWidth = 1.5; c.stroke(); c.restore();
    }
    if (lineA > 0) dot(c, anchor[0], anchor[1], 6, dark ? '#FFFFFF' : K.violet, lineA);
    const ty = PT + PAD + size / 2;
    kin(c, title, PX + PAD, ty, size, lk.ink, time - LABEL - .05, {
      al: 'left', w: 600, st: .03, out, colAt: (i: number) => i >= n0 && i <= n1 ? 'fill' : lk.ink,
      fill: (x: C2D, x0: number) => specLinear(x, x0 + textW(x, title.slice(0, Math.max(0, n0)), size, 600), 0, x0 + textW(x, title.slice(0, n1 + 1), size, 600), 0, [K.teal, K.sky, K.violet]),
    });
    lines.forEach((s, i) => kin(c, s, PX + PAD, ty + size / 2 + 22 + 21 + i * 42, 30, lk.mut, time - LABEL - .3 - i * .08, { al: 'left', tint: false, st: .01, out }));
    safeGuide(c, '16:9', p.safeGuide);
  });
}

