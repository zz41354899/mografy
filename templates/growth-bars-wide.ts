// Wide growth chart: twelve bars rise one by one in soft spectrum gradients, then a comet of light runs along the
// trend over their tops and leaves a glowing point and the multiple at the last value.
import type { FrameContext } from '@mografy/runtime';
import { exitOf, keys, safeGuide, safeParam, spring, stage, type C2D, type TemplateInfo } from './kit.js';
import { K, P, bloom, clamp, comet, dot, eio, eo, glow, ground, kin, look, mkPath, montageParams, pAt, polyPath, rgba, specLinear, specRGB, vignette } from './montage.js';

export const template = {
  id: 'growth-bars-wide', name: 'Growth bars', category: 'data', aspect: '16:9',
  summary: 'Bars rise one by one in soft spectrum gradients, then a comet runs along the trend and leaves a point at the last value.',
  agentHint: 'A single growth story (revenue, users, speed) in a landscape film or a talk. The twelve monthly values are constants in `DATA` and the end label in `LABEL`; keep the headline under ~34 characters. It is a mood chart, not an exact one: no axis values.',
  principles: ['staging', 'overlapping action', 'follow-through', 'arcs'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 5, fps: 30, background: '#06080C' };

export const params = {
  title: { name: 'Headline', type: 'string' as const, default: 'Revenue, three times in a year' },
  ...montageParams('night'), ...safeParam,
};

/** Monthly values, January to December, and the label at the last point. */
const DATA = [1, 1.1, 1.18, 1.3, 1.38, 1.55, 1.7, 1.86, 2.1, 2.36, 2.68, 3];
const LABEL = '3×', MONTHS = ['Jan', 'Dec'];
const X0 = 380, X1 = 1400, BY = 870, HMAX = 410, BW = 46, TY = 230;
const bx = (i: number) => X0 + (X1 - X0) * i / (DATA.length - 1);
const bh = (v: number) => HMAX * v / Math.max(...DATA);

/** Catmull-Rom through the points, sampled evenly (pure: module level only builds numbers). */
function smooth(pts: number[][], per = 16) {
  const out: number[][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    for (let k = 0; k < per; k++) { const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => .5 * (2 * p1[j]! + (-p0[j]! + p2[j]!) * t + (2 * p0[j]! - 5 * p1[j]! + 4 * p2[j]! - p3[j]!) * t2 + (-p0[j]! + 3 * p1[j]! - 3 * p2[j]! + p3[j]!) * t3))); }
  }
  out.push(pts[pts.length - 1]!); return out;
}
const TREND = mkPath(smooth(DATA.map((v, i) => [bx(i), BY - bh(v) - 30])));
const runS = keys([[1.85, 0], [3.05, TREND.len]]);

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), d = meta.duration, out = exitOf(time, d, .5);
  stage(ctx, '16:9', c => {
    ground(c, p, time, { orbA: K.teal, orbB: K.violet });
    kin(c, String(p.title), X0 - BW / 2, TY, 72, lk.ink, time - .1, { al: 'left', w: 600, st: .024, out });
    // A faint baseline and the two ends of the year.
    const ba = eo(P(time, .2, .7)) * (1 - out);
    if (ba > 0) { c.fillStyle = lk.dark ? `rgba(255,255,255,${.12 * ba})` : `rgba(20,24,32,${.12 * ba})`; c.fillRect(X0 - 60, BY, (X1 - X0 + 120) * eo(P(time, .2, .8)), 1.5); }
    kin(c, MONTHS[0]!, bx(0), BY + 44, 24, lk.mut, time - .5, { w: 500, tint: false, out });
    kin(c, MONTHS[1]!, bx(DATA.length - 1), BY + 44, 24, lk.mut, time - 1.25, { w: 500, tint: false, out });

    // Bars rise one by one, each in its own soft spectrum gradient; on the way out they sink back.
    DATA.forEach((v, i) => {
      const k = spring(time, .4 + i * .075, .5, .12) * (1 - eio(P(time, d - .58 + i * .012, d - .12)));
      if (k <= 0) return; const h = bh(v) * k, x = bx(i) - BW / 2, col = specRGB(i / (DATA.length - 1) * .62);
      const g = c.createLinearGradient(0, BY - bh(v), 0, BY); g.addColorStop(0, rgba(col, lk.dark ? .78 : .7)); g.addColorStop(.6, rgba(col, lk.dark ? .3 : .3)); g.addColorStop(1, rgba(col, lk.dark ? .04 : .06));
      c.fillStyle = g; c.beginPath(); c.roundRect(x, BY - h, BW, h, [14, 14, 0, 0]); c.fill();
    });

    // The comet runs along the trend over the bar tops; a faint line stays behind it.
    const s = runS(time), head = pAt(TREND, s), la = 1 - out;
    if (s > 1) {
      const n = Math.max(2, Math.ceil(s / 8)), pts = Array.from({ length: n + 1 }, (_, i) => pAt(TREND, s * i / n));
      c.save(); c.globalAlpha *= .5 * la; polyPath(c, pts, false); c.strokeStyle = specLinear(c, X0, 0, X1, 0, [K.teal, K.sky, K.violet, K.coral]); c.lineWidth = 2; c.lineJoin = 'round'; c.stroke(); c.restore();
    }
    const ta = (time > 1.85 ? 1 : 0) * (1 - P(time, 3.05, 3.4)) * la;
    if (ta > 0) {
      const emit = (x: C2D) => { comet(x, TREND, s, { len: 600, lw: 3.8, per: 1500, step: 10 }); dot(x, head[0], head[1], 6, lk.dark ? '#FFFFFF' : K.teal); };
      c.save(); c.globalAlpha *= ta; emit(c); c.restore();
      bloom(c, emit, { radius: 10, strength: (lk.dark ? 1.15 : .5) * ta, halo: .9, mode: lk.dark ? 'lighter' : 'source-over', bounds: [X0 - 40, BY - HMAX - 120, X1 - X0 + 80, HMAX + 160] });
    }
    // The point it leaves at the last value, and the multiple above it.
    const end = TREND.pts[TREND.pts.length - 1]!, pa = P(time, 2.98, 3.1) * la;
    if (pa > 0) {
      const pulse = 1 + .9 * P(time, 3.0, 3.1) * (1 - P(time, 3.1, 3.6));
      c.save(); c.globalCompositeOperation = lk.dark ? 'lighter' : 'source-over'; glow(c, end[0]!, end[1]!, 120 * pulse, K.coral, (lk.dark ? .38 : .25) * pa); c.restore();
      dot(c, end[0]!, end[1]!, 7 * clamp(pulse, 1, 1.4), lk.dark ? '#FFFFFF' : K.coral, pa);
    }
    // The multiple, big, just right of the point.
    kin(c, LABEL, end[0]! + 48, end[1]! + 4, 132, lk.ink, time - 3.05, { al: 'left', w: 700, st: .06, out, colAt: () => 'fill',
      fill: (x, x0, w) => specLinear(x, x0, 0, x0 + w, 0, [K.violet, K.coral, K.amber]) });
    if (lk.dark) vignette(c, .45);
    safeGuide(c, '16:9', p.safeGuide);
  });
}
