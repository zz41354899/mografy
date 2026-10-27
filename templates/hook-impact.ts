// Impact headline: the accent folds into the header rule, a quote mark drops, and three tall Anton lines rise
// letter by letter; the [marked] word turns orange and gets a hand-drawn underline. The opening of a 9:16 post.
import type { FrameContext } from '@mografy/runtime';
import { at, ease, exitOf, safeGuide, safeParam, settle, spring, stage, type TemplateInfo } from './kit.js';
import { CX, DISPLAY, charLine, editorialParams, footer, glyph, header, marked, measure, openingPanel, page, paper, underline } from './editorial.js';

export const template = {
  id: 'hook-impact', name: 'Impact headline', category: 'hook', aspect: '9:16',
  summary: 'The page opens in orange, a quote mark drops and three tall lines rise letter by letter; one word is underlined.',
  agentHint: 'First 3–4 s of a post. Up to three lines of 1–3 short words, uppercase reads best; mark one word with [brackets]. Not for sentences longer than ~25 characters.',
  principles: ['anticipation', 'staging', 'follow-through', 'slow in and slow out'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 4, fps: 30, background: '#FFFFFF' };

export const params = {
  text: { name: 'Headline', type: 'string' as const, default: 'Your product\ndeserves\nto be [seen.]' },
  kicker: { name: 'Header left', type: 'string' as const, default: 'Launch notes' },
  label: { name: 'Header right', type: 'string' as const, default: 'Why it matters' },
  brand: { name: 'Footer brand', type: 'string' as const, default: 'Northwind · Studio' },
  more: { name: 'Footer link', type: 'string' as const, default: 'See more' },
  ...editorialParams, ...safeParam,
};

const SIZE = 176, LH = 196;

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, out = exitOf(time, d, .55);
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    openingPanel(c, pg, time);
    header(c, pg, time, .5, String(p.kicker), String(p.label), 1 - out);
    footer(c, pg, time, .65, String(p.brand), String(p.more), 1 - out);

    const lines = String(p.text).toUpperCase().split('\n').slice(0, 3).map(marked);
    const n = lines.length, top = 1010 - (n - 1) * LH / 2, landed = .95 + (n - 1) * .3 + .5;
    // Shrink a line that would not fit between the margins.
    const sizeOf = (s: string) => Math.min(SIZE, SIZE * 900 / Math.max(1, measure(c, s, { size: SIZE, color: '', family: DISPLAY, tracking: SIZE * .02 })));
    // The opening mark drops from above the frame and lands over the headline with a small overshoot.
    const drop = spring(time, .55, .5, .28), mk = settle(time, .85, .5, 10, 1.2);
    glyph(c, '“', CX, top - SIZE - 120 + (1 - drop) * -900 + mk, 230, pg.accent, { alpha: 1 - out });
    lines.forEach((ln, i) => {
      const y = top + i * LH, size = sizeOf(ln.plain), start = .95 + i * .3;
      const boxes = charLine(c, ln.plain, CX, y, size, time, start, {
        color: pg.ink, stagger: .035, exitAt: d - .6 + i * .05,
        fx: j => ln.flags[j] ? { color: pg.accent } : {},
      });
      if (ln.first >= 0) {
        const u = at(time, landed, landed + .55, ease.inOutCubic);
        c.save(); c.globalAlpha *= 1 - out; underline(c, boxes[ln.first]![0], boxes[ln.last]![1], y + 40, u, pg.accent, 10); c.restore();
      }
    });
    // The closing mark lands under the last line once the headline is set.
    const close = spring(time, landed - .1, .45, .28);
    if (close > 0) glyph(c, '”', CX, top + (n - 1) * LH + 150 + (1 - close) * -120, 230, pg.accent, { alpha: Math.min(1, close * 3) * (1 - out) });
    safeGuide(c, '9:16', p.safeGuide);
  });
}
