// Type input: a flat input box draws itself on the page, a query types at a natural pace behind an orange caret,
// the send button presses, and three results rise below it, each on its own rule.
import type { FrameContext } from '@mografy/runtime';
import { at, ease, exitOf, press, safeGuide, safeParam, springs, stage, type TemplateInfo } from './kit.js';
import { DISPLAY, MX, SANS, charLine, editorialParams, measure, page, paper, txt, wordLine, wrapLines, type Ink } from './editorial.js';

export const template = {
  id: 'type-input', name: 'Typed input', category: 'screen', aspect: '9:16',
  summary: 'A flat input box draws itself, a query types behind an orange caret, send presses and three results rise below.',
  agentHint: 'Show a prompt or search being typed and answered. Query up to ~60 characters (two lines). The three result rows are stand-ins in RESULTS: replace them with what the real product returns.',
  principles: ['timing', 'anticipation', 'staging', 'follow-through'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 4.5, fps: 30, background: '#FFFFFF' };

export const params = {
  query: { name: 'Query', type: 'string' as const, default: 'Make a 30-second launch film for Northwind' },
  kicker: { name: 'Label', type: 'string' as const, default: 'Ask Northwind' },
  ...editorialParams, ...safeParam,
};

const BX = MX, BW = 870, BY = 520, PAD = 44, LH = 76, SEND = 92, TYPE0 = .55, ROW = 172;
const RESULTS = [['Script', '30 seconds, four scenes'], ['Storyboard', 'Twelve frames, ready to review'], ['First cut', '0:30 in 1080 × 1920']];

/** When each character lands: a natural pace, a little uneven, with a breath after each word. */
function keyTimes(value: string) {
  const out: number[] = []; let t = TYPE0;
  [...value].forEach((ch, i) => {
    const jitter = (Math.sin(i * 12.9898 + 4.1) * 43758.5453) % 1;
    t += .023 + Math.abs(jitter) * .018 + (ch === ' ' ? .03 : 0);
    out.push(t);
  });
  return out;
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, out = exitOf(time, d, .5);
  const query = String(p.query), keys = keyTimes(query), typed = keys.filter(k => k <= time).length;
  const done = keys.length ? keys[keys.length - 1]! : TYPE0, SENT = Math.max(done + .22, 1.2);
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    c.save(); c.translate(0, -out * 40); c.globalAlpha *= 1 - out;
    const ink: Ink = { size: 56, color: pg.ink, family: SANS, weight: 600 };
    const lines = wrapLines(c, query, BW - PAD * 2, ink).slice(0, 3), TOOL = SEND + 34, bh = PAD + 10 + lines.length * LH + TOOL;

    // Label: a tall Anton line rising letter by letter (shrunk to fit the box width), and a short rule under it.
    const kick = String(p.kicker).toUpperCase(), ks = Math.min(112, 112 * BW / Math.max(1, measure(c, kick, { size: 112, color: '', family: DISPLAY, tracking: 112 * .02 })));
    charLine(c, kick, BX, BY - 64, ks, time, .08, { color: pg.accent, align: 'left', stagger: .03 });
    c.fillStyle = pg.accent; c.fillRect(BX, BY - 36, 120 * at(time, .25, .8, ease.inOutCubic), 4);

    // The box draws its outline clockwise from the top-left corner.
    const draw = at(time, .05, .55, ease.inOutCubic), per = 2 * (BW + bh);
    c.save(); c.strokeStyle = pg.ink; c.lineWidth = 3; c.setLineDash([per * draw, per]); c.strokeRect(BX, BY, BW, bh); c.restore();

    // Typed copy: each character appears on its key time; the caret follows, solid while typing, blinking at rest.
    let left = typed, cx = BX + PAD, cy = BY + PAD + 54;
    lines.forEach((ln, i) => {
      const y = BY + PAD + 54 + i * LH, n = Math.min(left, ln.length + (i < lines.length - 1 ? 1 : 0));
      const shown = ln.slice(0, Math.min(n, ln.length));
      const w = txt(c, shown, BX + PAD, y, ink);
      if (left > 0) { cx = BX + PAD + w + 4; cy = y; }
      left -= n;
    });
    const typing = time >= TYPE0 - .05 && time <= done + .15;
    const blink = typing ? 1 : (Math.floor((time - (time > done ? done : 0)) / .45) % 2 === 0 ? 1 : 0);
    const caretOn = at(time, .45, .55) * (time < SENT ? blink : 0);
    if (caretOn > 0) { c.fillStyle = pg.accent; c.fillRect(cx, cy - 50, 5, 64); }

    // Toolbar along the bottom of the box: a hairline and two quiet settings.
    const ty = BY + bh - TOOL, tk = at(time, .35, .8, ease.outQuint);
    c.save(); c.globalAlpha *= tk; c.fillStyle = pg.dots; c.fillRect(BX + PAD / 2, ty, (BW - PAD) * tk, 2);
    const chip: Ink = { size: 26, color: pg.mute, family: SANS, weight: 700, tracking: 3 };
    let chx = BX + PAD;
    for (const label of ['FILM', '9:16', '30 S']) { const w = txt(c, label, chx, ty + TOOL / 2 + 10, chip); chx += w + 40; }
    c.restore();
    // Send: ink square with an arrow; it presses and turns orange.
    const sp = press(time, SENT, .08), sent = at(time, SENT - .02, SENT + .12), sx = BX + BW - PAD / 2 - SEND, sy = BY + bh - PAD / 2 - SEND;
    const ka = at(time, .4, .8, springs.pop);
    if (ka > 0) {
      c.save(); c.translate(sx + SEND / 2, sy + SEND / 2); c.scale(ka * (1 - .1 * sp), ka * (1 - .1 * sp));
      c.fillStyle = sent > .5 ? pg.accent : pg.ink; c.fillRect(-SEND / 2, -SEND / 2, SEND, SEND);
      c.strokeStyle = pg.bg; c.lineWidth = 5; c.lineCap = 'square'; c.lineJoin = 'miter';
      c.beginPath(); c.moveTo(0, 18); c.lineTo(0, -18); c.moveTo(-14, -4); c.lineTo(0, -18); c.lineTo(14, -4); c.stroke();
      c.restore();
    }

    // Results: a count, then three rows, each rule drawing before its copy rises.
    const R0 = SENT + .15, ry = BY + bh + 100;
    txt(c, `${RESULTS.length} RESULTS`, BX, ry, { size: 26, color: pg.mute, family: SANS, weight: 800, tracking: 6, alpha: at(time, R0 - .1, R0 + .3) });
    RESULTS.forEach(([title, detail], i) => {
      const t0 = R0 + .05 + i * .1, y = ry + 40 + i * ROW;
      const rule = at(time, t0, t0 + .4, ease.inOutCubic);
      if (rule <= 0) return;
      c.fillStyle = pg.ink; c.fillRect(BX, y, BW * rule, 2);
      const k = at(time, t0 + .1, t0 + .7, ease.outQuint);
      c.save(); c.beginPath(); c.rect(0, y + 4, 1080, ROW - 4); c.clip();
      txt(c, `0${i + 1}`, BX, y + 118 + (1 - k) * 130, { size: 96, color: pg.accent, family: DISPLAY });
      c.restore();
      wordLine(c, title!, BX + 140, y + 76, { size: 50, color: pg.ink, family: SANS, weight: 700 }, time, t0 + .15);
      wordLine(c, detail!, BX + 140, y + 128, { size: 34, color: pg.mute, family: SANS, weight: 600 }, time, t0 + .25, { stagger: .03 });
      const a = at(time, t0 + .35, t0 + .8, ease.outQuint);
      txt(c, '→', BX + BW - 8 - (1 - a) * 30, y + 104, { size: 46, color: pg.ink, family: SANS, weight: 700, align: 'right', alpha: a });
    });
    c.restore();
    safeGuide(c, '9:16', p.safeGuide);
  });
}
