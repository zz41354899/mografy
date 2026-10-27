// Numbers table: a headline rises, then three rows of an editorial table draw in under thin rules; each huge Anton
// figure counts up in fixed-width digit slots, with its label in Inter caps on the right.
import type { FrameContext } from '@mografy/runtime';
import { alpha, at, clamp, ease, exitOf, safeGuide, safeParam, stage, type C2D, type TemplateInfo } from './kit.js';
import { DISPLAY, MX, SANS, W, charLine, editorialParams, footer, header, measure, page, paper, txt, wrapLines, type Ink } from './editorial.js';

export const template = {
  id: 'stat-count', name: 'Numbers table', category: 'data', aspect: '9:16',
  pair: 'stat-count-wide',
  summary: 'Three figures count up in an editorial table, each row drawn in under a thin rule with its label in caps.',
  agentHint: 'Three key figures with short labels, one per line as "value | label" (a unit or suffix may follow the value: "4.9/5", "3 MIN"). Values up to 6 digits, labels under ~20 characters; the headline is one line of up to ~22 characters.',
  principles: ['timing', 'slow in and slow out', 'staging', 'overlapping action'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 4.5, fps: 30, background: '#FFFFFF' };

export const params = {
  title: { name: 'Headline', type: 'string' as const, default: 'The numbers so far' },
  stats: { name: 'Figures (value | label)', type: 'string' as const, default: '12,480 | Teams\n4.9/5 | Average rating\n3 MIN | To first film' },
  kicker: { name: 'Header left', type: 'string' as const, default: 'Launch notes' },
  label: { name: 'Header right', type: 'string' as const, default: 'Northwind' },
  brand: { name: 'Footer brand', type: 'string' as const, default: 'Northwind · Studio' },
  ...editorialParams, ...safeParam,
};

/**
 * The figures from "value | label" lines: the number counts up, whatever follows it ("/5", "MIN") is set smaller in
 * the accent after the figure.
 */
function stats(v: unknown) {
  return String(v).split('\n').map(s => s.trim()).filter(Boolean).slice(0, 3).map(line => {
    const [head = '', ...rest] = line.split('|'), m = head.trim().match(/^([\d,]*\.?\d+)\s*(.*)$/);
    const num = m ? m[1]!.replace(/,/g, '') : '0', dot = num.indexOf('.');
    return { value: Number(num) || 0, decimals: dot < 0 ? 0 : num.length - dot - 1, suffix: m ? m[2]!.trim() : head.trim(), label: rest.join('|').trim() };
  });
}

const TABLE = 545, ROW = 330, NUM = 236;

/** A figure drawn character by character: every digit sits in the same slot, so counting never jitters. */
function figure(c: C2D, s: string, x: number, y: number, size: number, color: string, a: number) {
  const st: Ink = { size, color, family: DISPLAY };
  const slot = Math.max(...'0123456789'.split('').map(d => measure(c, d, st)));
  let cx = x;
  for (const ch of s) {
    const digit = /\d/.test(ch), w = digit ? slot : measure(c, ch, st);
    txt(c, ch, cx + (digit ? (slot - measure(c, ch, st)) / 2 : 0), y, { ...st, alpha: a });
    cx += w + size * .015;
  }
  return cx - x;
}

const format = (v: number, decimals: number) => v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, out = exitOf(time, d, .55);
  const STATS = stats(p.stats);
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    header(c, pg, time, .05, String(p.kicker), String(p.label), 1 - out);
    footer(c, pg, time, .2, String(p.brand), 'See more', 1 - out);

    // Headline, fitted to the measure.
    const title = String(p.title).toUpperCase();
    const tw = measure(c, title, { size: 120, color: '', family: DISPLAY, tracking: 2.4 });
    charLine(c, title, MX, 445, Math.min(120, 120 * 900 / Math.max(1, tw)), time, .3, { align: 'left', color: pg.ink, stagger: .025, exitAt: d - .6 });

    // The table's top rule in the accent, then one thin rule under each row.
    const top = at(time, .55, 1.15, ease.inOutCubic), back = at(time, d - .55, d - .1, ease.inOutCubic);
    c.fillStyle = pg.accent; c.fillRect(MX + (W - 2 * MX) * back, TABLE, (W - 2 * MX) * (top - back), 4);
    STATS.forEach((s, i) => {
      const y0 = TABLE + i * ROW, t0 = .75 + i * .22, base = y0 + ROW - 62;
      const rule = at(time, t0, t0 + .6, ease.inOutCubic), gone = at(time, d - .55 + i * .05, d - .1 + i * .05, ease.inOutCubic);
      if (i < STATS.length - 1 && rule > gone) { c.fillStyle = alpha(pg.ink, pg.dark ? .28 : .16); c.fillRect(MX + (W - 2 * MX) * gone, y0 + ROW, (W - 2 * MX) * (rule - gone), 2); }
      // Index in the accent.
      txt(c, `0${i + 1}`, W - MX, y0 + 78, { size: 38, color: pg.accent, family: DISPLAY, tracking: 1, align: 'right', alpha: at(time, t0 + .1, t0 + .5) * (1 - gone) });
      // The figure rises into its mask as it counts; the count slows down onto the final value.
      const k = at(time, t0, t0 + .7, ease.outQuint), n = ease.outQuart(clamp((time - t0) / 1.5));
      const v = Math.round(s.value * n * 10 ** s.decimals) / 10 ** s.decimals;
      c.save(); c.beginPath(); c.rect(0, base - NUM * .95, W, NUM * 1.05); c.clip();
      const dy = (1 - k) * NUM * .9 - gone * NUM * 1.1, a = clamp(k * 1.6) * (1 - gone);
      const fw = figure(c, format(v, s.decimals), MX - 4, base + dy, NUM, pg.ink, a);
      if (s.suffix) {
        const sk = at(time, t0 + 1, t0 + 1.5, ease.outQuint);
        txt(c, s.suffix, MX + fw + 14, base + dy + (1 - sk) * 100, { size: NUM * .42, color: pg.accent, family: DISPLAY, tracking: 1, alpha: a * clamp(sk * 1.6) });
      }
      c.restore();
      // Label: Inter caps, right-aligned on the figure's baseline (two lines if it needs them).
      const st: Ink = { size: 30, color: pg.mute, family: SANS, weight: 800, tracking: 4, align: 'right' };
      const lines = wrapLines(c, s.label.toUpperCase(), 280, st);
      lines.forEach((ln, j) => {
        const y = base - (lines.length - 1 - j) * 42, lk = at(time, t0 + .5 + j * .08, t0 + 1.1 + j * .08, ease.outQuint);
        c.save(); c.beginPath(); c.rect(0, y - 40, W, 52); c.clip();
        txt(c, ln, W - MX, y + (1 - lk) * 44 - gone * 50, { ...st, alpha: clamp(lk * 1.6) * (1 - gone) });
        c.restore();
      });
    });
    safeGuide(c, '9:16', p.safeGuide);
  });
}
