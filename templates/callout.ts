// Callout: a line opens into a window onto a dark product screen. An orange ring draws around one element while
// the rest of the screen dims, then an orange leader runs out of the window and along the page to a printed label:
// a tall Anton title and one line of detail.
import type { FrameContext } from '@mografy/runtime';
import { alpha, at, ease, exitOf, lerp, ring, safeGuide, safeParam, spring, springs, stage, type C2D, type TemplateInfo } from './kit.js';
import { CX, DISPLAY, MX, SANS, W, H, charLine, editorialParams, marked, measure, page, paper, txt, wordLine, wrapLines, type Page } from './editorial.js';

export const template = {
  id: 'callout', name: 'Callout', category: 'explain', aspect: '9:16',
  pair: 'callout-wide',
  summary: 'An orange ring focuses one element of a dark product screen, the rest dims, and a leader runs out to a printed label.',
  agentHint: 'Point at one feature. Title 1–3 words ([brackets] mark orange words), detail one short sentence. Over a film picture (backdrop false) the whole frame dims around FOCUS and the label sits on a white panel; move FOCUS to the element in your picture.',
  principles: ['staging', 'anticipation', 'follow-through', 'slow in and slow out'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 4.5, fps: 30, background: '#FFFFFF' };

export const params = {
  title: { name: 'Title', type: 'string' as const, default: 'Live insights' },
  detail: { name: 'Detail', type: 'string' as const, default: 'Updates the moment your team does.' },
  ...editorialParams, ...safeParam,
};

const TOP = 250, BOT = 1090, LINE_Y = 670, OPEN = .35;
/** The focused element, in page coordinates, and the ring around it. */
const FOCUS: [number, number] = [800, TOP + 560], RING = 178;
const ELBOW_Y = 1200, LABEL_Y = 1350, R0 = 1.15;
const UI = { bg: '#181818', ink: '#FFFFFF', mute: '#8C8C8C' };

/** A headline on one line when it fits, else two balanced lines; shrunk until it fits `width`. */
function headline(c: C2D, raw: string, width: number, size: number) {
  const m = marked(raw), toks: [number, number][] = [];
  for (const x of m.plain.matchAll(/\S+/g)) toks.push([x.index!, x.index! + x[0].length]);
  const st = (s: number) => ({ size: s, color: '', family: DISPLAY, tracking: s * .02 });
  const span = (a: number, b: number) => ({ plain: m.plain.slice(toks[a]![0], toks[b]![1]), flags: m.flags.slice(toks[a]![0], toks[b]![1]) });
  for (let s = size; ; s -= 4) {
    const one = span(0, toks.length - 1);
    if (measure(c, one.plain, st(s)) <= width || toks.length < 2) { if (measure(c, one.plain, st(s)) <= width || s <= 48) return { lines: [one], size: s }; continue; }
    let best = 1, score = Infinity;
    for (let i = 1; i < toks.length; i++) {
      const wmax = Math.max(measure(c, span(0, i - 1).plain, st(s)), measure(c, span(i, toks.length - 1).plain, st(s)));
      if (wmax < score) { score = wmax; best = i; }
    }
    const lines = [span(0, best - 1), span(best, toks.length - 1)];
    if (lines.every(l => measure(c, l.plain, st(s)) <= width) || s <= 48) return { lines, size: s };
  }
}

/** Stand-in product screen (window coordinates, W × 840): a figure, a bar chart and the on-track gauge. */
function screen(c: C2D, pg: Page, t: number) {
  const h = BOT - TOP;
  // On the dark page the window is a step lighter than the page, so it still reads as a picture.
  c.fillStyle = pg.dark ? '#232323' : UI.bg; c.fillRect(0, 0, W, h);
  txt(c, 'NORTHWIND', 64, 96, { size: 40, color: UI.ink, family: DISPLAY, tracking: 2 });
  txt(c, 'THIS WEEK', W - 64, 92, { size: 22, color: UI.mute, family: SANS, weight: 800, tracking: 5, align: 'right' });
  c.fillStyle = alpha(UI.ink, .1); c.fillRect(0, 140, W, 2);
  const n = Math.round(lerp(0, 12480, ease.outCubic(at(t, .1, 1.3, ease.linear)))).toLocaleString('en-US');
  txt(c, n, 64, 350, { size: 160, color: UI.ink, family: DISPLAY, tracking: 2 });
  txt(c, 'ACTIVE USERS', 64, 400, { size: 22, color: UI.mute, family: SANS, weight: 700, tracking: 5 });
  const bars = [.42, .55, .48, .7, .62, .84, 1], bw = 520 / bars.length;
  bars.forEach((v, i) => { const k = spring(t, .2 + i * .06, .6, .1), bh = 260 * v * k; c.fillStyle = alpha(UI.ink, i === 6 ? .6 : .26); c.fillRect(64 + i * bw + bw * .18, 760 - bh, bw * .64, bh); });
  c.fillStyle = alpha(UI.ink, .2); c.fillRect(64, 762, 520, 2);
  // The gauge: a track, the filled share, and the figure in the middle.
  const gx = FOCUS[0], gy = FOCUS[1] - TOP, r = 118, share = .87 * at(t, .3, 1.4, ease.inOutCubic);
  c.lineWidth = 26; c.lineCap = 'butt';
  c.strokeStyle = alpha(UI.ink, .14); c.beginPath(); c.arc(gx, gy, r, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = UI.ink; c.beginPath(); c.arc(gx, gy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * share); c.stroke();
  txt(c, `${Math.round(share * 100)}%`, gx, gy + 24, { size: 84, color: UI.ink, family: DISPLAY, align: 'center' });
  txt(c, 'ON TRACK', gx, gy + 62, { size: 18, color: UI.mute, family: SANS, weight: 800, tracking: 4, align: 'center' });
  c.fillStyle = pg.accent; c.beginPath(); c.arc(gx + 112, gy - 112, 10, 0, Math.PI * 2); c.fill();
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, out = exitOf(time, d, .5), overlay = p.backdrop === false;
  // The ring and its leader leave first, then the label lifts and the window closes.
  const focusOut = at(time, d - .55, d - .3, ease.inOutCubic);
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    // Window: a line draws, opens onto the screen, and closes back at the end.
    const line = at(time, .02, OPEN, ease.inOutCubic), open = at(time, OPEN, OPEN + .8, springs.camera), close = at(time, d - .5, d - .05, ease.inOutCubic);
    const top = lerp(lerp(LINE_Y, TOP, open), LINE_Y, close), bot = lerp(lerp(LINE_Y, BOT, open), LINE_Y, close);
    if (!overlay) {
      if (bot - top > 1) { c.save(); c.beginPath(); c.rect(0, top, W, bot - top); c.clip(); c.translate(0, TOP); screen(c, pg, time - .45); c.restore(); }
      const retract = at(time, OPEN + .45, OPEN + .95, ease.inOutCubic) * (1 - at(time, d - .58, d - .42, ease.inOutCubic));
      const half = 540 * line * (1 - at(time, d - .2, d, ease.inOutCubic));
      if (half > 0 && retract < 1) for (const y of bot - top > 2 ? [top - 3, bot - 3] : [top - 3]) {
        c.fillStyle = pg.accent; c.fillRect(CX - half, y, half * (1 - retract), 6); c.fillRect(CX + half * retract, y, half * (1 - retract), 6);
      }
    }

    // Focus: everything but the ring dims (the window on the page, the whole frame over a film), then the ring draws.
    const focus = at(time, R0, R0 + .5, ease.inOutCubic) * (1 - focusOut);
    const dimTop = overlay ? 0 : Math.max(top, TOP), dimH = overlay ? H : Math.min(bot, BOT) - dimTop;
    if (focus > 0 && dimH > 1) {
      const hole = new Path2D();
      hole.rect(0, dimTop, W, dimH);
      hole.arc(FOCUS[0], FOCUS[1], RING - 8, 0, Math.PI * 2);
      c.save(); c.beginPath(); c.rect(0, dimTop, W, dimH); c.clip(); c.fillStyle = `rgba(0,0,0,${.58 * focus})`; c.fill(hole, 'evenodd'); c.restore();
    }
    const draw = at(time, R0 + .05, R0 + .6, ease.inOutCubic);
    if (draw > 0 && focusOut < 1) {
      c.save(); c.globalAlpha *= 1 - focusOut; c.strokeStyle = pg.accent; c.lineWidth = 7; c.lineCap = 'round';
      c.beginPath(); c.arc(FOCUS[0], FOCUS[1], RING, Math.PI / 2, Math.PI / 2 + Math.PI * 2 * draw); c.stroke(); c.restore();
      ring(c, FOCUS[0], FOCUS[1], time, R0 + .6, pg.accent, 2.4);
    }

    // Label panel (only over a film), the leader, then the title and the detail.
    const { lines, size } = headline(c, String(p.title).toUpperCase(), 860, 150);
    const detail = wrapLines(c, String(p.detail), 860, { size: 44, color: '', family: SANS, weight: 600 }).slice(0, 2);
    const lh = size, titleY = LABEL_Y + (lines.length - 1) * lh, detailY = titleY + 84;
    if (overlay) {
      const k = at(time, R0 + .4, R0 + .8, ease.outQuint) * (1 - out);
      c.save(); c.globalAlpha *= k; c.fillStyle = pg.paper; c.fillRect(MX - 40, ELBOW_Y - 40, W - MX * 2 + 80, detailY + (detail.length - 1) * 60 + 60 - ELBOW_Y + 40); c.restore();
    }
    const L0 = R0 + .55, x0 = FOCUS[0], y0 = FOCUS[1] + RING, seg1 = ELBOW_Y - y0, seg2 = x0 - MX, total = seg1 + seg2;
    const lead = at(time, L0, L0 + .55, ease.inOutCubic) * total, gone = at(time, d - .55, d - .25, ease.inOutCubic) * total;
    if (lead > gone) {
      c.save(); c.strokeStyle = pg.accent; c.lineWidth = 5; c.lineCap = 'butt'; c.beginPath();
      const pt = (s: number): [number, number] => s <= seg1 ? [x0, y0 + s] : [x0 - (s - seg1), ELBOW_Y];
      const [ax, ay] = pt(gone); c.moveTo(ax, ay);
      if (gone < seg1 && lead > seg1) c.lineTo(x0, ELBOW_Y);
      const [bx, by] = pt(lead); c.lineTo(bx, by); c.stroke();
      if (lead >= total - 1) { c.fillStyle = pg.accent; c.beginPath(); c.arc(MX + 6, ELBOW_Y, 10, 0, Math.PI * 2); c.fill(); }
      c.restore();
    }
    const T0 = L0 + .4;
    lines.forEach((ln, i) => charLine(c, ln.plain, MX, LABEL_Y + i * lh, size, time, T0 + i * .15, {
      color: pg.ink, align: 'left', stagger: .03, exitAt: d - .52 + i * .05, fx: j => ({ ...(ln.flags[j] ? { color: pg.accent } : {}), alpha: 1 - out }),
    }));
    c.save(); c.globalAlpha *= 1 - out; c.translate(0, -out * 24);
    detail.forEach((ln, i) => wordLine(c, ln, MX, detailY + i * 60, { size: 44, color: pg.mute, family: SANS, weight: 600 }, time, T0 + .3 + i * .1));
    c.restore();
    safeGuide(c, '9:16', p.safeGuide);
  });
}
