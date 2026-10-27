// Wide chapter title: a comet of light falls and leaves a thin spectrum line; the chapter number sharpens in on its
// left in a spectrum gradient, the title and subtitle on its right. On the way out the type blurs away and the line
// draws back up into the light it came from.
import type { FrameContext } from '@mografy/runtime';
import { exitOf, safeGuide, safeParam, stage, type C2D, type TemplateInfo } from './kit.js';
import { K, P, W, bloom, comet, dot, eio, eo, glow, ground, kin, look, mkPath, montageParams, pAt, specLinear, textW, vignette } from './montage.js';

export const template = {
  id: 'chapter-title-wide', name: 'Chapter title', category: 'slides', aspect: '16:9',
  summary: 'A falling comet leaves a thin spectrum line; a huge spectrum chapter number and the title sharpen in on either side.',
  agentHint: 'Section divider for a talk, a course or a long demo: number 1–3 characters, title under ~28 characters, subtitle under ~50. Long titles shrink to fit. Neon or night reads best.',
  principles: ['staging', 'timing', 'overlapping action', 'slow in and slow out'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 3.5, fps: 30, background: '#040507' };

export const params = {
  number: { name: 'Number', type: 'string' as const, default: '01' },
  title: { name: 'Title', type: 'string' as const, default: 'Planning the quarter' },
  subtitle: { name: 'Subtitle', type: 'string' as const, default: 'How three teams agree on goals in one afternoon' },
  ...montageParams('neon'), ...safeParam,
};

const CY = 540, NS = 280, GAP = 72, Y0 = 372, Y1 = 708;

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), d = meta.duration, out = exitOf(time, d, .5);
  stage(ctx, '16:9', c => {
    ground(c, p, time, { orbA: K.violet, orbB: K.teal });
    const num = String(p.number), title = String(p.title), sub = String(p.subtitle);
    // Fit the group into the safe width: the title shrinks before anything leaves the frame.
    const nw = textW(c, num, NS, 700);
    let ts = 96; const free = 1640 - nw - GAP * 2;
    ts = Math.max(56, Math.min(ts, ts * free / Math.max(1, textW(c, title, ts, 600))));
    const ss = Math.min(36, ts * .4), rw = Math.max(textW(c, title, ts, 600), textW(c, sub, ss, 500));
    const gx = W / 2 - (nw + GAP * 2 + rw) / 2, lx = gx + nw + GAP;
    // Soft light behind the number on dark grounds.
    if (lk.dark) { c.save(); c.globalCompositeOperation = 'lighter'; glow(c, gx + nw / 2, CY, 420, K.violet, .16 * eo(P(time, .3, 1.2)) * (1 - out)); glow(c, lx, Y0, 260, K.teal, .12 * eo(P(time, 0, .6)) * (1 - out)); c.restore(); }

    // The comet falls along the divider; the line stays behind it and draws back up on the way out.
    const path = mkPath([[lx, Y0 - 40], [lx, Y1]]), s = path.len * eo(P(time, .08, .8)), head = pAt(path, s);
    const yTop = Y0, yBot = Math.max(yTop, head[1]) - (Math.max(yTop, head[1]) - yTop) * eio(P(time, d - .55, d - .1));
    if (yBot - yTop > 1) { c.fillStyle = specLinear(c, 0, Y0, 0, Y1, [K.teal, K.sky, K.violet]); c.fillRect(lx - 1.5, yTop, 3, yBot - yTop); }
    const ta = 1 - P(time, .8, 1.15);
    if (ta > 0) {
      const emit = (x: C2D) => { comet(x, path, s, { len: 380, lw: 3.6, step: 12, per: 900 }); dot(x, head[0], head[1], 6, lk.dark ? '#FFFFFF' : K.teal); };
      c.save(); c.globalAlpha *= ta; emit(c); c.restore();
      bloom(c, emit, { radius: 10, strength: (lk.dark ? 1.15 : .5) * ta, halo: .9, mode: lk.dark ? 'lighter' : 'source-over', bounds: [lx - 60, Y0 - 120, 120, Y1 - Y0 + 180] });
    }
    // A point rests where the line ends up (top) as it retracts.
    const pa = P(time, d - .3, d - .2) * (1 - P(time, d - .15, d));
    if (pa > 0) dot(c, lx, Y0, 5, lk.dark ? '#FFFFFF' : K.teal, pa);

    // The number sharpens in on the left in the spectrum; the title and subtitle on the right.
    const numFill = (x: C2D, x0: number, w: number) => specLinear(x, x0, CY - NS * .4, x0 + w, CY + NS * .4, [K.teal, K.sky, K.violet, K.coral]);
    kin(c, num, gx, CY + 8, NS, lk.ink, time - .3, { al: 'left', w: 700, st: .09, d: .7, out, blur: .14, colAt: () => 'fill', fill: numFill });
    kin(c, title, lx + GAP, CY - ts * .34, ts, lk.ink, time - .55, { al: 'left', w: 600, st: Math.min(.03, .6 / Math.max(1, title.length)), out });
    kin(c, sub, lx + GAP + 2, CY + ts * .6, ss, lk.mut, time - .9, { al: 'left', w: 500, st: .012, d: .45, tint: false, out });
    if (lk.dark) vignette(c, .45);
    safeGuide(c, '16:9', p.safeGuide);
  });
}
