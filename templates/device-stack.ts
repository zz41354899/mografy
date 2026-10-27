// Device stack: under a tall Anton title, a flat laptop and then a phone rise out of an orange rule, both showing
// the same dark product screen counting up in step; a quiet line under the rule says what it means.
import type { FrameContext } from '@mografy/runtime';
import { alpha, at, ease, exitOf, lerp, rr, safeGuide, safeParam, spring, springs, stage, type C2D, type TemplateInfo } from './kit.js';
import { CX, DISPLAY, SANS, W, charLine, editorialParams, marked, measure, page, paper, txt, wordLine, type Page } from './editorial.js';

export const template = {
  id: 'device-stack', name: 'Device stack', category: 'screen', aspect: '9:16',
  summary: 'A flat laptop and a phone rise out of an orange rule in turn, both showing the same product counting up in step.',
  agentHint: 'Say the product works everywhere. Title 2–4 words ([brackets] mark orange words), detail one short line. Both screens come from `product` (landscape and portrait layouts of one stand-in dashboard): redraw it, or draw screenshots into the two screen rects.',
  principles: ['staging', 'overlapping action', 'slow in and slow out', 'follow-through'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 5, fps: 30, background: '#FFFFFF' };

export const params = {
  title: { name: 'Title', type: 'string' as const, default: 'Desktop and [mobile]' },
  detail: { name: 'Detail', type: 'string' as const, default: 'One account, every screen.' },
  ...editorialParams, ...safeParam,
};

const FLOOR = 1372;
const LAP = { x: 92, y: 708, w: 800, h: 506, bezel: 18 }, BASE = { y: 1214, h: 30, over: 50 };
const PHONE = { x: 742, y: 812, w: 252, h: 530, inset: 10 };
const UI = { bg: '#181818', side: '#111111', ink: '#FFFFFF', mute: '#8C8C8C' };

/** A headline of at most two balanced lines, shrunk until it fits `width`; [marked] words come back flagged. */
function headline(c: C2D, raw: string, width: number, size: number) {
  const m = marked(raw), toks: [number, number][] = [];
  for (const x of m.plain.matchAll(/\S+/g)) toks.push([x.index!, x.index! + x[0].length]);
  const st = (s: number) => ({ size: s, color: '', family: DISPLAY, tracking: s * .02 });
  const span = (a: number, b: number) => ({ plain: m.plain.slice(toks[a]![0], toks[b]![1]), flags: m.flags.slice(toks[a]![0], toks[b]![1]) });
  for (let s = size; ; s -= 4) {
    const one = span(0, toks.length - 1);
    if (toks.length < 2) { if (measure(c, one.plain, st(s)) <= width || s <= 48) return { lines: [one], size: s }; continue; }
    let best = 1, score = Infinity;
    for (let i = 1; i < toks.length; i++) {
      const wmax = Math.max(measure(c, span(0, i - 1).plain, st(s)), measure(c, span(i, toks.length - 1).plain, st(s)));
      if (wmax < score) { score = wmax; best = i; }
    }
    const lines = [span(0, best - 1), span(best, toks.length - 1)];
    if (lines.every(l => measure(c, l.plain, st(s)) <= width) || s <= 48) return { lines, size: s };
  }
}

/** One stand-in product in two layouts: landscape (sidebar, figure, chart) and portrait (figure, chart, list). */
function product(c: C2D, w: number, h: number, pg: Page, t: number) {
  const wide = w > h, s = wide ? h / 474 : w / 236;
  c.fillStyle = UI.bg; c.fillRect(0, 0, w, h);
  const n = Math.round(lerp(0, 12480, ease.outCubic(at(t, .1, 1.5, ease.linear)))).toLocaleString('en-US');
  const bars = [.42, .55, .48, .7, .62, .84, 1];
  const chart = (x: number, y: number, cw: number, ch: number) => {
    const bw = cw / bars.length;
    bars.forEach((v, i) => { const k = spring(t, .25 + i * .06, .6, .1), bh = ch * v * k; c.fillStyle = i === 6 ? pg.accent : alpha(UI.ink, .28); c.fillRect(x + i * bw + bw * .18, y - bh, bw * .64, bh); });
    c.fillStyle = alpha(UI.ink, .2); c.fillRect(x, y + 1, cw, 2 * s);
  };
  if (wide) {
    const sw = 170 * s, pad = 34 * s;
    c.fillStyle = UI.side; c.fillRect(0, 0, sw, h);
    txt(c, 'NORTHWIND', pad, pad + 26 * s, { size: 30 * s, color: UI.ink, family: DISPLAY, tracking: 1 * s });
    c.fillStyle = pg.accent; c.fillRect(pad, pad + 40 * s, 26 * s, 3 * s);
    for (let i = 0; i < 5; i++) { c.fillStyle = alpha(UI.ink, i === 0 ? .5 : .16); c.fillRect(pad, (110 + i * 40) * s, (i === 0 ? 86 : 70 - i * 6) * s, 9 * s); }
    const x0 = sw + pad;
    txt(c, 'OVERVIEW', x0, pad + 22 * s, { size: 15 * s, color: UI.mute, family: SANS, weight: 800, tracking: 4 * s });
    c.fillStyle = pg.accent; c.beginPath(); c.arc(w - pad - 8 * s, pad + 16 * s, 8 * s, 0, Math.PI * 2); c.fill();
    txt(c, n, x0, 170 * s, { size: 110 * s, color: UI.ink, family: DISPLAY, tracking: 1 * s });
    txt(c, 'ACTIVE USERS THIS WEEK', x0, 204 * s, { size: 14 * s, color: UI.mute, family: SANS, weight: 700, tracking: 3 * s });
    chart(x0, h - pad - 4 * s, w - x0 - pad, 190 * s);
  } else {
    const pad = 22 * s;
    txt(c, 'OVERVIEW', pad, 70 * s, { size: 11 * s, color: UI.mute, family: SANS, weight: 800, tracking: 3 * s });
    c.fillStyle = pg.accent; c.beginPath(); c.arc(w - pad - 6 * s, 66 * s, 6 * s, 0, Math.PI * 2); c.fill();
    txt(c, n, pad, 140 * s, { size: 60 * s, color: UI.ink, family: DISPLAY, tracking: .5 * s });
    txt(c, 'ACTIVE USERS THIS WEEK', pad, 162 * s, { size: 9 * s, color: UI.mute, family: SANS, weight: 700, tracking: 2 * s });
    chart(pad, 300 * s, w - pad * 2, 110 * s);
    for (let i = 0; i < 4; i++) {
      const y = (338 + i * 44) * s, k = at(t, .5 + i * .08, 1 + i * .08, ease.outQuint);
      c.save(); c.globalAlpha *= k;
      c.fillStyle = alpha(UI.ink, .5); c.fillRect(pad, y, (110 - i * 12) * s, 9 * s);
      c.fillStyle = alpha(UI.ink, .2); c.fillRect(w - pad - 28 * s, y, 28 * s, 9 * s);
      c.fillStyle = alpha(UI.ink, .1); c.fillRect(pad, y + 26 * s, w - pad * 2, 1.5 * s);
      c.restore();
    }
  }
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, out = exitOf(time, d, .55);
  const body = pg.dark ? '#2A2A2A' : '#111111';
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    const { lines, size } = headline(c, String(p.title).toUpperCase(), 860, 156);
    const lh = size * 1.0, last = 560;
    lines.forEach((ln, i) => charLine(c, ln.plain, CX, last - (lines.length - 1 - i) * lh, size, time, .1 + i * .22, {
      color: pg.ink, stagger: .03, exitAt: d - .62 + i * .05, fx: j => ({ ...(ln.flags[j] ? { color: pg.accent } : {}), alpha: 1 - out }),
    }));

    // The rule both devices stand on.
    const rule = at(time, .02, .4, ease.inOutCubic) * (1 - at(time, d - .3, d, ease.inOutCubic));
    if (rule > 0) { c.fillStyle = pg.accent; c.fillRect(CX - 470 * rule, FLOOR, 940 * rule, 6); }

    // Devices rise out of the rule in turn and sink back in reverse order.
    const drop = (start: number, sinkAt: number) => (1 - at(time, start, start + .95, springs.camera)) * 900 + at(time, sinkAt, sinkAt + .45, ease.inOutCubic) * 900;
    const ly = drop(.3, d - .5), py = drop(.6, d - .6);
    c.save(); c.beginPath(); c.rect(0, 0, W, FLOOR); c.clip();
    if (ly < 880) {
      c.save(); c.translate(0, ly);
      c.fillStyle = body; c.fill(rr(LAP.x, LAP.y, LAP.w, LAP.h, [22, 22, 0, 0]));
      c.save(); c.beginPath(); c.rect(LAP.x + LAP.bezel, LAP.y + LAP.bezel, LAP.w - LAP.bezel * 2, LAP.h - LAP.bezel * 2); c.clip();
      c.translate(LAP.x + LAP.bezel, LAP.y + LAP.bezel); product(c, LAP.w - LAP.bezel * 2, LAP.h - LAP.bezel * 2, pg, time - .7); c.restore();
      // The base: a slab a little wider than the lid, with a thumb notch.
      c.fillStyle = body; c.fill(rr(LAP.x - BASE.over, BASE.y, LAP.w + BASE.over * 2, BASE.h, [0, 0, 14, 14]));
      c.fillStyle = pg.dark ? '#1A1A1A' : '#2B2B2B'; c.fillRect(LAP.x + LAP.w / 2 - 60, BASE.y, 120, 8);
      c.restore();
    }
    if (py < 880) {
      c.save(); c.translate(0, py);
      // A page-coloured keyline separates the phone from the laptop behind it.
      c.fillStyle = pg.bg; c.fill(rr(PHONE.x - 8, PHONE.y - 8, PHONE.w + 16, PHONE.h + 16, 46));
      c.fillStyle = body; c.fill(rr(PHONE.x, PHONE.y, PHONE.w, PHONE.h, 38));
      const sx = PHONE.x + PHONE.inset, sy = PHONE.y + PHONE.inset, sw = PHONE.w - PHONE.inset * 2, sh = PHONE.h - PHONE.inset * 2;
      c.save(); c.beginPath(); c.roundRect(sx, sy, sw, sh, 30); c.clip(); c.translate(sx, sy);
      product(c, sw, sh, pg, time - .7);
      c.fillStyle = '#000000'; c.fill(rr(sw / 2 - 30, 12, 60, 18, 9));
      c.restore(); c.restore();
    }
    c.restore();

    // The detail lifts and fades as one line, so no clipped descenders linger in its mask.
    c.save(); c.globalAlpha *= 1 - out; c.translate(0, -out * 24);
    wordLine(c, String(p.detail), CX, FLOOR + 110, { size: 42, color: pg.mute, family: SANS, weight: 600, align: 'center' }, time, 1.15);
    c.restore();
    safeGuide(c, '9:16', p.safeGuide);
  });
}
