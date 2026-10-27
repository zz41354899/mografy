// Logo end, after the SUPERHUNTER end card: the mark is built stroke by stroke (stem, accent diagonal, stem), the
// wordmark opens out of its centre as its letter spacing closes, a rule draws under it and the tagline rises.
import type { FrameContext } from '@mografy/runtime';
import { at, ease, lerp, safeGuide, safeParam, settle, stage, type C2D, type TemplateInfo } from './kit.js';
import { CX, DISPLAY, SANS, W, charLine, chevrons, editorialParams, marked, measure, page, paper, txt, type Page } from './editorial.js';

export const template = {
  id: 'logo-tagline', name: 'Logo and tagline', category: 'end', aspect: '9:16', pair: 'logo-tagline-wide',
  summary: 'The mark builds stroke by stroke, the wordmark opens out of its centre as its spacing closes, and a tagline rises under a rule.',
  agentHint: 'Closing logo of a 9:16 post. Brand 1–2 words, tagline under ~28 characters with one [marked] phrase. The N mark is a fictional stand-in: redraw `mark()` with your own logo as two or three flat strokes that grow in order.',
  principles: ['staging', 'anticipation', 'follow-through', 'slow in and slow out'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 5, fps: 30, background: '#FFFFFF' };

export const params = {
  brand: { name: 'Brand', type: 'string' as const, default: 'Northwind' },
  tagline: { name: 'Tagline', type: 'string' as const, default: 'Plan less. [Ship more.]' },
  link: { name: 'Link', type: 'string' as const, default: 'northwind.app' },
  ...editorialParams, ...safeParam,
};

/** Mark box (centre, top, bottom), wordmark baseline, rule and tagline. */
const MY0 = 560, MY1 = 800, MW = 100, BAR = 52, WORD_Y = 1010, SIZE = 150, RULE_Y = 1040, TAG_Y = 1138, LINK_Y = 1300;
const STROKES = [.08, .3, .52];

/**
 * The stand-in mark: an N from a left stem, an accent diagonal and a right stem, each growing in turn (k 0..1).
 * Redraw it with your own logo, keeping the order of strokes.
 */
function mark(c: C2D, pg: Page, k: number[]) {
  const l = CX - MW, r = CX + MW, h = MY1 - MY0;
  const grow = (v: number, draw: () => void, down = false) => {
    if (v <= 0) return;
    c.save(); c.beginPath();
    if (down) c.rect(0, MY0 - 2, W, h * v + 2); else c.rect(0, MY1 - h * v, W, h * v + 2);
    c.clip(); draw(); c.restore();
  };
  grow(k[0]!, () => { c.fillStyle = pg.ink; c.fillRect(l, MY0, BAR, h); });
  grow(k[1]!, () => {
    c.fillStyle = pg.accent; c.beginPath(); c.moveTo(l, MY0); c.lineTo(l + BAR, MY0); c.lineTo(r, MY1); c.lineTo(r - BAR, MY1); c.closePath(); c.fill();
  }, true);
  grow(k[2]!, () => { c.fillStyle = pg.ink; c.fillRect(r - BAR, MY0, BAR, h); });
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, overlay = p.backdrop === false;
  const ex = (t0: number) => at(time, d - t0, d - t0 + .4, ease.inOutCubic);
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    // Over a film's own picture, a flat paper band carries the logo.
    if (overlay) {
      const b = at(time, 0, .4, ease.outQuart) * (1 - ex(.4)), mid = 850, half = 380 * b;
      c.fillStyle = pg.paper; c.fillRect(0, mid - half, W, half * 2);
    }

    // The mark builds stroke by stroke, settles with a small bounce, and lifts out of its own mask at the end.
    const k = STROKES.map(s => at(time, s, s + .42, ease.outQuint)), out = ex(.5);
    c.save(); c.beginPath(); c.rect(0, MY0 - 4, W, MY1 - MY0 + 8); c.clip();
    c.translate(0, -out * (MY1 - MY0 + 20) + settle(time, .9, .55, -8, 1.2));
    mark(c, pg, k); c.restore();

    // Wordmark: a window opens from its centre while the letter spacing closes from loose to set.
    const brand = String(p.brand).toUpperCase();
    const fit = Math.min(SIZE, SIZE * 780 / Math.max(1, measure(c, brand, { size: SIZE, color: '', family: DISPLAY, tracking: 8 })));
    const wk = at(time, .95, 1.75, ease.outQuart), wordW = measure(c, brand, { size: fit, color: '', family: DISPLAY, tracking: 8 }), wOut = ex(.55);
    if (wk > 0 && wOut < 1) {
      c.save(); c.beginPath(); c.rect(CX - (wordW / 2 + 40) * wk, WORD_Y - fit * 1.02, (wordW + 80) * wk, fit * 1.3); c.clip();
      txt(c, brand, CX, WORD_Y - wOut * fit * 1.2, { size: fit, color: pg.ink, family: DISPLAY, tracking: lerp(34, 8, wk), align: 'center' });
      c.restore();
    }
    // The rule draws out from the centre under the name, and draws back in on the way out.
    const rule = at(time, 1.45, 2.05, ease.inOutCubic) * (1 - ex(.6));
    if (rule > 0) { c.fillStyle = pg.accent; c.fillRect(CX - wordW / 2 * rule, RULE_Y, wordW * rule, 5); }

    // Tagline: tracked capitals rising letter by letter; the [marked] phrase in the accent.
    const tag = marked(String(p.tagline).toUpperCase());
    const tst = { size: 40, color: '', family: SANS, weight: 800, tracking: 9 };
    const tsize = Math.min(40, 40 * 820 / Math.max(1, measure(c, tag.plain, tst) + tag.plain.length * 9));
    charLine(c, tag.plain, CX, TAG_Y, tsize, time, 1.75, {
      color: pg.mute, family: SANS, weight: 800, tracking: tsize * .23, stagger: .022, dur: .6, exitAt: d - .95,
      fx: i => tag.flags[i] ? { color: pg.accent } : {},
    });
    // The link and `>>>`, as under the reference's end card.
    const lk = at(time, 2.35, 2.85, ease.outQuint) * (1 - ex(.75)), link = String(p.link);
    if (lk > 0 && link) {
      const st = { size: 34, color: pg.mute, family: SANS, weight: 700, tracking: 4, alpha: lk };
      const lw = measure(c, `${link}  `, st), cw = 3 * measure(c, '>', { size: 34, color: '', family: DISPLAY }) + 2 * 34 * .18, x0 = CX - (lw + cw) / 2, y = LINK_Y + (1 - lk) * 20;
      txt(c, link, x0, y, st); chevrons(c, x0 + lw, y, 34, pg, time, 2.7, lk);
    }
    safeGuide(c, '9:16', p.safeGuide);
  });
}
