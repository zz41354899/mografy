// Review carousel: under a tall headline, three reviews swipe past like an Instagram carousel. Each card has a big
// orange quote mark, the quote in Inter, a short rule and the reviewer; the incoming card leads with an orange edge
// and the dots follow.
import type { FrameContext } from '@mografy/runtime';
import { at, clamp, ease, exitOf, lerp, safeGuide, safeParam, settle, spring, stage, type TemplateInfo } from './kit.js';
import { CX, DISPLAY, MX, SANS, W, carousel, carouselDots, charLine, editorialParams, footer, glyph, header, measure, page, paper, txt, wordLine, wrapLines, type Ink } from './editorial.js';

export const template = {
  id: 'review-cards', name: 'Review carousel', category: 'proof', aspect: '9:16',
  summary: 'Three reviews swipe past like a carousel, each with a big orange quote mark, the quote, a rule and the reviewer.',
  agentHint: 'Social proof for a post: three reviews, one per line as "quote | name | role", quotes up to ~70 characters. Fictional people by default; use real reviews only with permission.',
  principles: ['staging', 'follow-through', 'overlapping action', 'slow in and slow out'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 6.5, fps: 30, background: '#FFFFFF' };

export const params = {
  heading: { name: 'Headline', type: 'string' as const, default: 'What teams say' },
  reviews: {
    name: 'Reviews (quote | name | role)', type: 'string' as const,
    default: 'We cut weekly planning from two hours to twenty minutes. | Priya Nair | Head of Operations, Fernhill\n'
      + 'Everyone sees the same plan now. Our stand-ups got shorter overnight. | Tom Okafor | Engineering Lead, Brightline\n'
      + 'The first tool our whole team opened without being asked. | Lena Vogel | Product Manager, Harbor & Co.',
  },
  kicker: { name: 'Header left', type: 'string' as const, default: 'Reviews' },
  label: { name: 'Header right', type: 'string' as const, default: 'Northwind' },
  brand: { name: 'Footer brand', type: 'string' as const, default: 'Northwind · Studio' },
  ...editorialParams, ...safeParam,
};

/** The reviews from "quote | name | role" lines (up to three; fictional people by default). */
const reviewsOf = (v: unknown) => String(v).split('\n').map(s => s.trim()).filter(Boolean).slice(0, 3)
  .map(line => { const [quote = '', name = '', role = ''] = line.split('|').map(s => s.trim()); return { quote, name, role }; });

const SWIPES = [2.4, 4.1], CARD_TOP = 560, CARD_BOT = 1450, MARK_Y = 690, Q_Y = 930, Q_SIZE = 68, DOTS_Y = 1530;

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, out = exitOf(time, d, .55), REVIEWS = reviewsOf(p.reviews);
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    header(c, pg, time, .05, String(p.kicker), String(p.label), 1 - out);
    footer(c, pg, time, .2, String(p.brand), 'See more', 1 - out);

    // Headline.
    const title = String(p.heading).toUpperCase();
    const tw = measure(c, title, { size: 120, color: '', family: DISPLAY, tracking: 2.4 });
    charLine(c, title, MX, 445, Math.min(120, 120 * 900 / Math.max(1, tw)), time, .25, { align: 'left', color: pg.ink, stagger: .03, exitAt: d - .6 });

    const pos = carousel(time, SWIPES.slice(0, Math.max(0, REVIEWS.length - 1))), moving = Math.sin(clamp(pos - Math.floor(pos)) * Math.PI), depth = 1 - .05 * moving;
    const q: Ink = { size: Q_SIZE, color: pg.ink, family: SANS, weight: 700, tracking: -.6 };
    for (let i = 0; i < REVIEWS.length; i++) {
      const dx = (i - pos) * W; if (Math.abs(dx) >= W) continue;
      const r = REVIEWS[i]!, first = i === 0, b = first ? .3 : SWIPES[i - 1]! - .1;
      c.save(); c.translate(CX, 1000); c.scale(depth, depth); c.translate(-CX, -1000); c.translate(dx, 0);
      c.save(); c.globalAlpha *= 1 - out; c.translate(0, -out * 40);
      // The quote mark drops in on the first card and settles; later cards arrive with it in place.
      const drop = first ? spring(time, b, .5, .28) : 1, wob = first ? settle(time, b + .3, .6, .12) : 0;
      glyph(c, '“', MX + 88, MARK_Y + (1 - drop) * -260, 340, pg.accent, { rot: wob, alpha: clamp(drop * 3) });
      // The quote: words rise on the first card; the others are set when they swipe in.
      const lines = wrapLines(c, r.quote, 900, q).slice(0, 3);
      lines.forEach((ln, j) => {
        const y = Q_Y + j * Q_SIZE * 1.28;
        if (first) wordLine(c, ln, MX, y, q, time, b + .2 + j * .12, { stagger: .035 });
        else txt(c, ln, MX, y, q);
      });
      // Rule, then the reviewer: the name's letter spacing opens as the card settles.
      const after = Q_Y + (lines.length - 1) * Q_SIZE * 1.28;
      const rb = first ? b + .55 + lines.length * .12 : SWIPES[i - 1]! + .25;
      c.fillStyle = pg.accent; c.fillRect(MX, after + 80, 96 * at(time, rb, rb + .45, ease.inOutCubic), 5);
      const nk = at(time, rb + .1, rb + .9, ease.outQuart);
      txt(c, r.name.toUpperCase(), MX, after + 172, { size: 44, color: pg.ink, family: SANS, weight: 800, tracking: lerp(-2, 4, nk), alpha: clamp(nk * 1.8) });
      txt(c, r.role, MX, after + 228, { size: 34, color: pg.mute, family: SANS, weight: 600, alpha: at(time, rb + .25, rb + .8) });
      c.restore();
      // An accent leading edge on the card coming in.
      if (dx > 0 && moving > .01) { c.globalAlpha *= moving; c.fillStyle = pg.accent; c.fillRect(-7, CARD_TOP, 14, CARD_BOT - CARD_TOP); }
      c.restore();
    }
    // The dots follow the swipe.
    const chrome = at(time, .8, 1.3) * (1 - out);
    carouselDots(c, pg, REVIEWS.length, pos, DOTS_Y, chrome);
    safeGuide(c, '9:16', p.safeGuide);
  });
}
