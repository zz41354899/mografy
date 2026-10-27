// Wide logo end, after the montage's logo ending: a point of light glides in and traces a small mark (an N built from
// two arches), the stroke fills, a wind ribbon sweeps under it, the wordmark letters rise in and the tagline sharpens.
import type { FrameContext } from '@mografy/runtime';
import { exitOf, safeGuide, safeParam, spring, stage, type C2D, type TemplateInfo } from './kit.js';
import { K, P, W, bez, bloom, clamp, comet, dot, eio, eo, fnPts, glow, ground, joinSegs, kin, lerp, look, montageParams, pAt, polyPath, specLinear, textW, vignette } from './montage.js';

export const template = {
  id: 'logo-tagline-wide', name: 'Logo and tagline', category: 'end', aspect: '16:9', pair: 'logo-tagline',
  summary: 'A point of light glides in and traces the mark, the stroke fills, the wordmark rises in letter by letter and the tagline sharpens below.',
  agentHint: 'Closing logo of a landscape film. Brand 1–2 words, tagline under ~40 characters. The mark is a fictional stand-in: redraw `markPath()` (a centre line, traced then filled) and `ribbon()` with your own logo, keeping the trace → fill → letters order. Night or neon reads best.',
  principles: ['follow-through', 'arcs', 'staging', 'anticipation'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 4, fps: 30, background: '#06080C' };

export const params = {
  brand: { name: 'Brand', type: 'string' as const, default: 'Northwind' },
  tagline: { name: 'Tagline', type: 'string' as const, default: 'Plan less. Ship more.' },
  ...montageParams('night'), ...safeParam,
};

const MY = 480, BS = 128, GAP = 54, MARK = 150, SW = 30, TAG = 660;

/** The mark's centre line in local units: an N from two arches (left stem up, arch over, arch under, right stem up). */
function markPath(): number[][] {
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => fnPts((u: number) => [cx + r * Math.cos(lerp(a0, a1, u)), cy + r * Math.sin(lerp(a0, a1, u))], 24);
  return [[-60, 58], [-60, -10], ...arc(-30, -10, 30, Math.PI, 2 * Math.PI).slice(1), [0, 10], ...arc(30, 10, 30, Math.PI, 0).slice(1), [60, -70]];
}
/** The wind ribbon under the mark: a tapered swoosh drawn from its left end up to u (0..1). */
function ribbon(c: C2D, mx: number, my: number, u: number, fill: string | CanvasGradient) {
  if (u <= 0) return;
  const q = (t: number) => { const a = 1 - t; return [mx + a * a * -104 + 2 * a * t * 0 + t * t * 112, my + a * a * 62 + 2 * a * t * 150 + t * t * 26]; };
  const n = 40, top: number[][] = [], bot: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const t = u * i / n, [x, y] = q(t), [x2, y2] = q(Math.min(1, t + .01)), len = Math.hypot(x2! - x!, y2! - y!) || 1, nx = -(y2! - y!) / len, ny = (x2! - x!) / len, w = 13 * Math.pow(Math.sin(Math.PI * t), .7);
    top.push([x! + nx * w, y! + ny * w]); bot.push([x! - nx * w, y! - ny * w]);
  }
  polyPath(c, [...top, ...bot.reverse()]); c.fillStyle = fill; c.fill();
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), d = meta.duration, out = exitOf(time, d, .55);
  stage(ctx, '16:9', c => {
    ground(c, p, time, { orbA: K.teal, orbB: K.violet });
    const brand = String(p.brand), bw = textW(c, brand, BS, 600), gx = W / 2 - (MARK + GAP + bw) / 2, mx = gx + MARK / 2, my = MY;
    // One path for the light: the glide in from the lower left, then the mark's centre line.
    const local = markPath().map(([x, y]) => [mx + x!, my + y!]), sx = gx - 340, sy = my + 190;
    const path = joinSegs([bez([sx, sy], [sx + 180, sy + 30], [mx - 60, my + 170], local[0]!, 50), local]), entry = path.marks[0]!, total = path.marks[1]!;
    const s = time < .85 ? entry * eo(P(time, .05, .85)) : lerp(entry, total, eio(P(time, .85, 1.6))), head = pAt(path.path, s);
    const ga = 1 - out, ink = lk.ink;

    // The trace: a thin spectrum line behind the head, which then fills out into the solid mark.
    const fillK = spring(time, 1.5, .5, .1), trace = clamp((s - entry) / (total - entry));
    c.save(); c.globalAlpha *= ga;
    if (trace > 0) {
      const pts = trace >= 1 ? local : Array.from({ length: 81 }, (_, i) => pAt(path.path, lerp(entry, s, i / 80)));
      polyPath(c, pts, false); c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = fillK > .02 ? ink : specLinear(c, mx - 70, my + 70, mx + 70, my - 70, [K.teal, K.sky, K.violet]); c.lineWidth = lerp(3, SW, fillK); c.stroke();
    }
    // The ribbon sweeps in under the mark once it has filled.
    ribbon(c, mx, my, eio(P(time, 1.6, 2.15)), specLinear(c, mx - 104, 0, mx + 112, 0, [K.teal, K.sky]));
    c.restore();

    // The light itself: a comet with its head, gone once the stroke fills.
    const ta = 1 - P(time, 1.55, 1.85);
    if (ta > 0 && time > .05) {
      const emit = (x: C2D) => { comet(x, path.path, s, { len: 460, lw: 3.6, per: 1200, step: 10 }); dot(x, head[0], head[1], 6.5, lk.dark ? '#FFFFFF' : K.teal); };
      c.save(); c.globalAlpha *= ta; emit(c); c.restore();
      bloom(c, emit, { radius: 10, strength: (lk.dark ? 1.15 : .5) * ta, halo: .9, mode: lk.dark ? 'lighter' : 'source-over', bounds: [sx - 40, my - 140, mx - sx + 160, 380] });
    }
    // A soft glow settles behind the finished mark.
    const gl = P(time, 1.5, 2.3) * ga;
    if (gl > 0) { c.save(); c.globalCompositeOperation = lk.dark ? 'lighter' : 'source-over'; glow(c, mx, my, 360, K.teal, (lk.dark ? .14 : .1) * gl); c.restore(); }

    // The wordmark letters rise in, then the tagline sharpens below.
    kin(c, brand, gx + MARK + GAP, my + 4, BS, ink, time - 1.7, { al: 'left', w: 600, st: .05, d: .6, rise: .45, out });
    kin(c, String(p.tagline), W / 2, TAG, 40, lk.mut, time - 2.25, { w: 500, st: .018, d: .5, tint: false, out });
    if (lk.dark) vignette(c, .5);
    safeGuide(c, '16:9', p.safeGuide);
  });
}
