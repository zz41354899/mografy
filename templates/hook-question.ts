// Question hook: tall Anton lines rise letter by letter at the margin, an orange block sweeps the [marked] words
// and leaves them orange, then a huge orange question mark rises into place last and settles beside the question.
import type { FrameContext } from '@mografy/runtime';
import { at, ease, exitOf, lerp, safeGuide, safeParam, settle, spring, stage, type C2D, type TemplateInfo } from './kit.js';
import { DISPLAY, MX, charLine, editorialParams, footer, glyph, header, marked, measure, page, paper, sweep } from './editorial.js';

export const template = {
  id: 'hook-question', name: 'Question hook', category: 'hook', aspect: '9:16',
  summary: 'A question rises in tall lines, an orange block sweeps the key words, and a huge question mark rises into place beside it.',
  agentHint: 'Opening 3–4 s that asks the viewer a pain-point question. Up to three short uppercase lines (≤ 14 characters each); mark the key words with [brackets]; the question mark is drawn for you.',
  principles: ['anticipation', 'squash and stretch', 'staging', 'follow-through'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 3.5, fps: 30, background: '#FFFFFF' };

export const params = {
  text: { name: 'Question', type: 'string' as const, default: 'STILL EDITING\nVIDEOS\n[BY HAND]?' },
  kicker: { name: 'Header left', type: 'string' as const, default: 'Quick question' },
  label: { name: 'Header right', type: 'string' as const, default: 'For product teams' },
  brand: { name: 'Footer brand', type: 'string' as const, default: 'Northwind · Studio' },
  more: { name: 'Footer link', type: 'string' as const, default: 'See more' },
  ...editorialParams, ...safeParam,
};

const MAX = 210, RIGHT = 950, MID = 1000;

/** Ink box of one Anton glyph at `size`: width and height of what is actually drawn. */
function ink(c: C2D, ch: string, size: number) {
  c.save(); c.font = `400 ${size}px ${DISPLAY}`;
  const m = c.measureText(ch); c.restore();
  return { w: m.actualBoundingBoxRight + m.actualBoundingBoxLeft, h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent };
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, out = exitOf(time, d, .55);
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    header(c, pg, time, .05, String(p.kicker), String(p.label), 1 - out);
    footer(c, pg, time, .2, String(p.brand), String(p.more), 1 - out);

    // The question without its question mark: the mark is the template's own glyph.
    const raw = String(p.text).toUpperCase().split('\n').map(s => s.trim()).filter(Boolean).slice(0, 3);
    if (raw.length) raw[raw.length - 1] = raw[raw.length - 1]!.replace(/[?？]+\s*$/, '');
    const lines = raw.map(marked), n = lines.length;
    // One size for the whole stack, as large as the widest line allows between the margins.
    const widest = Math.max(1, ...lines.map(l => measure(c, l.plain, { size: MAX, color: '', family: DISPLAY, tracking: MAX * .02 })));
    const size = Math.min(MAX, MAX * (RIGHT - MX) / widest), lh = size * 1.04;
    // The mark stands beside the last line when it can be at least two and a half lines tall there; otherwise it
    // lands under the stack at the right margin, three lines tall, and the page reads on a diagonal.
    const st = { size, color: '', family: DISPLAY, tracking: size * .02 };
    const unit = ink(c, '?', 100), tall = lh * 2.5 / unit.h * 100;
    // Every line the mark would stand beside (the last two and a half) must leave room for it.
    const besideW = Math.max(...lines.slice(-3).map(l => measure(c, l.plain, st)));
    const beside = RIGHT - (MX + besideW + size * .22) >= unit.w * tall / 100;
    const q = beside ? tall : Math.min(lh * 3 / unit.h * 100, (RIGHT - MX) * .5 / unit.w * 100);
    const qh = unit.h * q / 100, qw = unit.w * q / 100;
    const blockH = (n - 1) * lh + size * .74 + (beside ? 0 : qh + lh * .3);
    const top = MID - blockH / 2 + size * .74;   // first baseline

    const start = .3, step = .22, stag = .03;
    const landed = start + (n - 1) * step + Math.max(1, lines[n - 1]?.plain.length ?? 1) * stag + .5;
    const sIn = at(time, landed - .1, landed + .22, ease.inOutCubic), sOut = at(time, landed + .22, landed + .55, ease.inOutCubic);
    lines.forEach((ln, i) => {
      const y = top + i * lh;
      const boxes = charLine(c, ln.plain, MX, y, size, time, start + i * step, {
        align: 'left', color: pg.ink, stagger: stag, exitAt: d - .58 + i * .05,
        fx: j => ln.flags[j] && sIn >= 1 ? { color: pg.accent } : {},
      });
      if (ln.first >= 0 && out === 0) sweep(c, boxes[ln.first]![0] - 12, boxes[ln.last]![1] + 12, y, size * .82, sIn, sOut, pg.accent);
    });

    // The question mark comes in last, stretched on the way, squashes on landing and settles.
    const qT = landed + .42, drop = spring(time, qT, .5, .24);
    if (drop > 0) {
      const lastBase = top + (n - 1) * lh;
      const cx = beside ? Math.min(RIGHT - qw / 2, MX + besideW + size * .22 + qw / 2) : RIGHT - qw / 2 - 10;
      const cy = beside ? lastBase - qh / 2 : lastBase + lh * .3 + qh / 2;
      // It rises into its own mask, so it never crosses the question on the way in; it lifts out of it at the end.
      const sq = settle(time, qT + .3, .7, .14, 1.2), fall = 1 - Math.min(1, drop);
      c.save(); c.beginPath(); c.rect(cx - qw * 1.2, cy - qh * .62, qw * 2.4, qh * 1.3); c.clip();
      glyph(c, '?', cx, lerp(cy + qh * 1.25, cy, drop) - out * qh * 1.3 + qh * sq * .5, q, pg.accent, {
        rot: lerp(.32, 0, Math.min(1, drop)) - out * .12, sx: 1 + sq * .7 - fall * .1, sy: 1 - sq + fall * .16, alpha: Math.min(1, drop * 4),
      });
      c.restore();
    }
    safeGuide(c, '9:16', p.safeGuide);
  });
}
