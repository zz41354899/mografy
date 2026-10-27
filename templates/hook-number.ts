// Number hook: one huge Anton figure whose digits roll into place like an odometer under a mask, the unit rises
// beside it in orange, a rule draws under the pair and the caption rises word by word.
import type { FrameContext } from '@mografy/runtime';
import { at, ease, exitOf, lerp, safeGuide, safeParam, springs, stage, type C2D, type TemplateInfo } from './kit.js';
import { CX, DISPLAY, SANS, charLine, editorialParams, footer, header, measure, page, paper, wordLine } from './editorial.js';

export const template = {
  id: 'hook-number', name: 'Number hook', category: 'hook', aspect: '9:16',
  summary: 'One huge figure rolls into place digit by digit like an odometer, its unit rises in orange and a caption follows.',
  agentHint: 'Open on a single striking figure (1–4 characters: "3", "24", "9.5") with a short unit and a one-line caption under 30 characters. For several figures use stat-count.',
  principles: ['anticipation', 'slow in and slow out', 'follow-through', 'staging'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 3.5, fps: 30, background: '#FFFFFF' };

export const params = {
  number: { name: 'Number', type: 'string' as const, default: '3' },
  unit: { name: 'Unit', type: 'string' as const, default: 'MIN' },
  caption: { name: 'Caption', type: 'string' as const, default: 'From link to launch film' },
  kicker: { name: 'Header left', type: 'string' as const, default: 'Launch notes' },
  brand: { name: 'Footer brand', type: 'string' as const, default: 'Northwind · Studio' },
  ...editorialParams, ...safeParam,
};

const BASE = 1170, MAXW = 840;

/** Advance of one Anton character at `size`. */
const adv = (c: C2D, ch: string, size: number) => measure(c, ch, { size, color: '', family: DISPLAY });

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, out = exitOf(time, d, .55);
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    header(c, pg, time, .05, String(p.kicker), 'By the numbers', 1 - out);
    footer(c, pg, time, .2, String(p.brand), 'See more', 1 - out);

    const chars = [...String(p.number).trim().slice(0, 6)], unit = String(p.unit).trim().toUpperCase();
    // Size the pair to the page: every digit gets the same slot so the rolling strip never jitters.
    const fit = (N: number) => {
      const slot = Math.max(...'0123456789'.split('').map(ch => adv(c, ch, N)));
      const widths = chars.map(ch => /\d/.test(ch) ? slot : adv(c, ch, N));
      const U = N * .34, uw = unit ? measure(c, unit, { size: U, color: '', family: DISPLAY, tracking: U * .02 }) : 0;
      const gap = unit ? N * .07 : 0, tw = widths.reduce((a, b) => a + b, 0) - N * .02 * (chars.length - 1);
      return { N, slot, widths, U, uw, gap, total: tw + gap + uw };
    };
    let f = fit(820); if (f.total > MAXW) f = fit(820 * MAXW / f.total);
    const { N, widths, U, uw, gap, total } = f;
    const x0 = CX - total / 2, cell = N * .95, top = BASE - N * .84;

    // The odometer: each digit is a strip of 0–9 under the mask; the rightmost spins the most, then all settle with
    // a little mechanical overshoot.
    const lift = at(time, d - .55, d - .1, ease.inOutCubic);
    c.save(); c.beginPath(); c.rect(0, top - 6, 1080, BASE + N * .06 - top + 6); c.clip();
    c.font = `400 ${N}px ${DISPLAY}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillStyle = pg.ink;
    let x = x0;
    const digits = chars.filter(ch => /\d/.test(ch)).length;
    let di = 0;
    chars.forEach((ch, i) => {
      const w = widths[i]!;
      const t0 = .22 + i * .07;
      if (/\d/.test(ch)) {
        const v = Number(ch), steps = v + 10 * (1 + (digits - 1 - di)), k = springs.pop(at(time, t0, t0 + 1.15, ease.linear));
        const pos = (steps + 1) * k - 1 + lift * 1.15;   // the strip starts one cell below the mask, so nothing shows before it rolls
        for (let s = Math.floor(pos) - 1; s <= Math.floor(pos) + 1; s++) {
          if (s < 0 || s > steps) continue;
          const y = BASE + (s - pos) * cell;
          if (y < top - cell * .1 || y > BASE + cell) continue;
          const dch = String(((s % 10) + 10) % 10);
          c.fillText(dch, x + (w - adv(c, dch, N)) / 2, y);
        }
        di++;
      } else {
        const k = at(time, t0 + .5, t0 + 1.1, ease.outQuint);
        c.fillText(ch, x, BASE + (1 - k) * cell - lift * cell * 1.15);
      }
      x += w - N * .02;
    });
    c.restore();

    // The unit rises letter by letter in the accent, on the figure's baseline.
    const ux = x0 + total - uw;
    if (unit) charLine(c, unit, ux, BASE, U, time, .95, { align: 'left', color: pg.accent, stagger: .05, exitAt: d - .5 });
    // A rule draws under the pair, then retracts to the right as the template leaves.
    const rule = at(time, 1.2, 1.75, ease.inOutCubic), back = at(time, d - .55, d - .15, ease.inOutCubic);
    if (rule > back) { c.fillStyle = pg.accent; c.fillRect(lerp(x0, x0 + total, back), BASE + 62, total * (rule - back), 6); }
    // The caption rises under the rule.
    wordLine(c, String(p.caption), CX, BASE + 176, { size: 58, color: pg.ink, family: SANS, weight: 700, align: 'center' }, time, 1.4, { stagger: .07, exit: at(time, d - .5, d - .1, ease.inOutCubic) });
    safeGuide(c, '9:16', p.safeGuide);
  });
}
