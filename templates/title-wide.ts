// Wide headline: a comet of light runs in under the headline and writes its second line as it passes, the way the
// montage writes "From one sentence."; the head settles into a breathing point at the end of the line.
import type { FrameContext } from '@mografy/runtime';
import { exitOf, safeGuide, safeParam, stage, type TemplateInfo } from './kit.js';
import { K, P, W, bez, clamp, dot, eo, glow, ground, kin, lightTrail, look, mkPath, montageParams, pAt, specLinear, textW, vignette } from './montage.js';

export const template = {
  id: 'title-wide', name: 'Wide headline', category: 'hook', aspect: '16:9',
  summary: 'A comet of light runs in under the headline and writes its second line as it passes, then rests as a point.',
  agentHint: 'Opening statement for a landing page, YouTube or a talk: two short lines (under ~26 characters each), the [bracketed] words in the spectrum. Night or neon ground reads best.',
  principles: ['follow-through', 'arcs', 'staging', 'secondary action'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 5, fps: 30, background: '#06080C' };

export const params = {
  line1: { name: 'Line 1', type: 'string' as const, default: 'Every product deserves' },
  line2: { name: 'Line 2', type: 'string' as const, default: 'a [launch film].' },
  eyebrow: { name: 'Eyebrow', type: 'string' as const, default: 'Northwind Studio' },
  ...montageParams('night'), ...safeParam,
};

const SIZE = 112, Y1 = 452, Y2 = 590, LY = 680;

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), d = meta.duration, out = exitOf(time, d, .6);
  const raw2 = String(p.line2), a = raw2.indexOf('['), b = raw2.indexOf(']');
  const line2 = raw2.replace(/[[\]]/g, ''), n0 = a < 0 ? -1 : a, n1 = b < 0 ? -1 : b - 1;
  stage(ctx, '16:9', c => {
    ground(c, p, time, { orbA: K.teal, orbB: K.violet });
    const w1 = textW(c, String(p.line1), SIZE, 600), w2 = textW(c, line2, SIZE, 600);
    const x0 = W / 2 - Math.max(w1, w2) / 2, x2 = W / 2 - w2 / 2, end = x2 + w2 + 26;
    // The comet enters from the lower left on a curve, then runs along the baseline of line 2.
    const path = mkPath([...bez([x0 - 520, LY + 260], [x0 - 260, LY + 220], [x0 - 220, LY], [x0 - 40, LY], 50), [end, LY]]);
    const s = path.len * eo(P(time, .35, 2.05)), head = pAt(path, s);
    const fade = 1 - P(time, 2.2, 2.7);
    if (fade > 0) lightTrail(c, path, s, { len: 1300, lw: 3.4, a: fade * (1 - out), head: false });
    // The head rests at the end of the line as a breathing point.
    const breathe = 1 + .12 * Math.sin(time * 3.2);
    c.save(); c.globalCompositeOperation = lk.dark ? 'lighter' : 'source-over';
    glow(c, head[0], head[1], 110 * breathe, K.teal, (lk.dark ? .35 : .22) * clamp(time / .5) * (1 - out)); c.restore();
    dot(c, head[0], head[1], 6.5 * breathe * (1 + 1.2 * P(time, 1.9, 2.1) * (1 - P(time, 2.1, 2.5))), lk.dark ? '#FFFFFF' : K.teal, clamp(time / .4) * (1 - out));

    kin(c, String(p.eyebrow), W / 2, 330, 30, lk.mut, time - .2, { tint: false, out });
    kin(c, String(p.line1), W / 2, Y1, SIZE, lk.ink, time - .45, { w: 600, st: .028, out });
    // Line 2 is written by the head as it passes each letter; the bracketed words take the spectrum.
    kin(c, line2, W / 2, Y2, SIZE, lk.ink, time - .5, {
      w: 600, out, prog: (_i, gx) => Math.max(eo(clamp((head[0] - gx - 10) / 240)), eo(P(time, 1.95, 2.6))),
      colAt: i => i >= n0 && i <= n1 ? 'fill' : lk.ink,
      fill: (x, xs) => specLinear(x, xs + textW(x, line2.slice(0, Math.max(0, n0)), SIZE, 600), 0, xs + textW(x, line2.slice(0, n1 + 1), SIZE, 600), 0, [K.teal, K.sky, K.violet]),
    });
    if (lk.dark) vignette(c, .45);
    safeGuide(c, '16:9', p.safeGuide);
  });
}
