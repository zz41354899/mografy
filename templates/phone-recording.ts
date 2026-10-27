// Phone recording: an orange rule draws across the foot of the page, a flat black phone rises out of it under a
// tall Anton title, and a touch lands on one task of the product screen; the task checks off and the count rolls.
import type { FrameContext, SetupContext } from '@mografy/runtime';
import { alpha, at, ease, exitOf, lerp, press, ring, rr, safeGuide, safeParam, springs, stage, type C2D, type TemplateInfo } from './kit.js';
import { CX, DISPLAY, SANS, charLine, cover, editorialParams, loadPhoto, measure, page, paper, txt, underline, wrapLines, type Page } from './editorial.js';

export const template = {
  id: 'phone-recording', name: 'Phone recording', category: 'screen', aspect: '9:16',
  summary: 'A flat black phone rises out of an orange rule under a tall title, and a touch checks off one task on its screen.',
  agentHint: 'Show a mobile app in use. Title 2–4 words. The screen is a stand-in task list: put assets/screen.jpg (portrait, about 9:19) in the project to show a real recording frame, or redraw `phoneScreen`; the tap lands on the second row (TAP_ROW).',
  principles: ['staging', 'anticipation', 'follow-through', 'slow in and slow out'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 5, fps: 30, background: '#FFFFFF' };

export const params = {
  title: { name: 'Title', type: 'string' as const, default: 'See it in action' },
  ...editorialParams, ...safeParam,
};

export async function setup(ctx: SetupContext) {
  await loadPhoto(ctx, 'screen.jpg', 'screen');
}

const PW = 480, PH = 980, PX = CX - PW / 2, PY = 1556, FLOOR = 1590, INSET = 16;
const TAP = 2.55, TAP_ROW = 1;
const TASKS = [
  { name: 'Review launch brief', when: '9:00', done: true },
  { name: 'Approve storyboard', when: '10:30', done: false },
  { name: 'Book the voice-over', when: '13:00', done: false },
  { name: 'Send weekly report', when: '15:00', done: false },
  { name: 'Plan the offsite', when: '16:30', done: false },
];
const SCREEN = { bg: '#181818', ink: '#FFFFFF', mute: '#8C8C8C' };

/** Break a headline into at most `max` lines that fit `width`, shrinking the size until they do. */
function fitHeadline(c: C2D, value: string, width: number, size: number, max = 2) {
  const st = (s: number) => ({ size: s, color: '', family: DISPLAY, tracking: s * .02 });
  let s = size, lines = wrapLines(c, value, width, st(s));
  while (s > 48 && (lines.length > max || lines.some(l => measure(c, l, st(s)) > width))) { s -= 4; lines = wrapLines(c, value, width, st(s)); }
  return { lines: lines.slice(0, max), size: s };
}

/** Local y of a task row's centre on a screen `w` wide. */
const rowY = (i: number, s: number) => (452 + i * 92 + 46) * s;

/** A portrait product screen in the editorial palette: today's count, a progress strip and a task list. */
function phoneScreen(c: C2D, w: number, h: number, pg: Page, t: number, tapT: number) {
  const s = w / 448, pad = 36 * s;
  c.fillStyle = SCREEN.bg; c.fillRect(0, 0, w, h);
  const k0 = at(t, 0, .6, ease.outQuint);
  txt(c, 'TODAY', pad, pad + 44 * s, { size: 20 * s, color: SCREEN.mute, family: SANS, weight: 800, tracking: 5 * s, alpha: k0 });
  c.save(); c.globalAlpha *= k0; c.fillStyle = pg.accent; c.beginPath(); c.arc(w - pad - 9 * s, pad + 37 * s, 9 * s, 0, Math.PI * 2); c.fill(); c.restore();
  // The count: the second digit rolls from 3 to 4 when the task is checked.
  const roll = at(tapT, .15, .6, ease.outQuint), fy = 286 * s, fs = 168 * s;
  const zero = txt(c, '0', pad, fy + (1 - k0) * 60 * s, { size: fs, color: SCREEN.ink, family: DISPLAY, alpha: k0 });
  c.save(); c.beginPath(); c.rect(pad + zero, fy - fs * .92, fs, fs * 1.02); c.clip();
  txt(c, '3', pad + zero + 2 * s, fy + (1 - k0) * 60 * s - roll * fs, { size: fs, color: SCREEN.ink, family: DISPLAY, alpha: k0 });
  if (roll > 0) txt(c, '4', pad + zero + 2 * s, fy + (1 - roll) * fs, { size: fs, color: pg.accent, family: DISPLAY });
  c.restore();
  txt(c, '/ 08', pad + zero * 2 + 26 * s, fy, { size: 64 * s, color: SCREEN.mute, family: DISPLAY, alpha: at(t, .15, .7, ease.outQuint) });
  txt(c, 'TASKS DONE', pad, fy + 52 * s, { size: 20 * s, color: SCREEN.mute, family: SANS, weight: 800, tracking: 5 * s, alpha: at(t, .2, .8, ease.outQuint) });
  // Progress strip: eight segments, the newest one fills in orange.
  const sw = (w - pad * 2 - 7 * 6 * s) / 8;
  for (let i = 0; i < 8; i++) {
    const k = at(t, .25 + i * .04, .7 + i * .04, ease.outQuint), x = pad + i * (sw + 6 * s);
    const fill = i < 3 ? alpha(SCREEN.ink, .7) : i === 3 ? pg.accent : alpha(SCREEN.ink, .14);
    c.fillStyle = alpha(SCREEN.ink, .14); c.fillRect(x, 378 * s, sw * k, 10 * s);
    if (i < 3) { c.fillStyle = fill; c.fillRect(x, 378 * s, sw * k, 10 * s); }
    if (i === 3) { c.fillStyle = fill; c.fillRect(x, 378 * s, sw * at(tapT, .1, .45, ease.outQuart), 10 * s); }
  }
  // Rows separated by hairlines; the tapped row flashes, its box fills and its name is struck through.
  TASKS.forEach((task, i) => {
    const k = at(t, .35 + i * .08, .95 + i * .08, ease.outQuint), y = rowY(i, s);
    if (k <= 0) return;
    c.save(); c.globalAlpha *= k; c.translate(0, (1 - k) * 24 * s);
    const tapped = i === TAP_ROW, flash = tapped ? Math.exp(-(((tapT - .08) / .22) ** 2)) : 0;
    if (flash > .01) { c.fillStyle = alpha(pg.accent, .16 * flash); c.fillRect(0, y - 46 * s, w, 92 * s); }
    c.fillStyle = alpha(SCREEN.ink, .12); c.fillRect(pad, y + 46 * s, w - pad * 2, 1.5 * s);
    const done = task.done ? 1 : tapped ? at(tapT, 0, .3, ease.outQuart) : 0, bx = pad, bs = 30 * s;
    c.strokeStyle = done > .5 ? pg.accent : alpha(SCREEN.ink, .5); c.lineWidth = 2.5 * s; c.strokeRect(bx, y - bs / 2, bs, bs);
    if (done > 0) {
      c.fillStyle = task.done ? alpha(SCREEN.ink, .5) : pg.accent;
      const g = bs * done; c.fillRect(bx + (bs - g) / 2, y - g / 2, g, g);
      const m = task.done ? 1 : at(tapT, .12, .4, ease.outQuart);
      if (m > 0) {
        c.strokeStyle = SCREEN.bg; c.lineWidth = 4 * s; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
        const p0 = [bx + 7 * s, y + 1 * s], p1 = [bx + 13 * s, y + 7 * s], p2 = [bx + 23 * s, y - 7 * s];
        c.moveTo(p0[0]!, p0[1]!);
        if (m < .4) c.lineTo(lerp(p0[0]!, p1[0]!, m / .4), lerp(p0[1]!, p1[1]!, m / .4));
        else { c.lineTo(p1[0]!, p1[1]!); c.lineTo(lerp(p1[0]!, p2[0]!, (m - .4) / .6), lerp(p1[1]!, p2[1]!, (m - .4) / .6)); }
        c.stroke();
      }
    }
    const nameSt = { size: 25 * s, color: done >= 1 ? SCREEN.mute : SCREEN.ink, family: SANS, weight: 600 };
    const tx = bx + bs + 22 * s, tw = txt(c, task.name, tx, y + 9 * s, nameSt);
    const strike = task.done ? 1 : tapped ? at(tapT, .2, .55, ease.inOutCubic) : 0;
    if (strike > 0) { c.fillStyle = SCREEN.mute; c.fillRect(tx - 2 * s, y, (tw + 4 * s) * strike, 2.5 * s); }
    txt(c, task.when, w - pad, y + 8 * s, { size: 20 * s, color: SCREEN.mute, family: SANS, weight: 600, align: 'right' });
    c.restore();
  });
}

/** A flat touch: a soft dot that arrives, presses and leaves a ring. */
function touch(c: C2D, x: number, y: number, time: number, t: number) {
  const a = at(time, t - .35, t - .15, ease.outQuart) * (1 - at(time, t + .35, t + .6, ease.inOutCubic));
  if (a > .001) {
    const r = 30 * (1 - .18 * press(time, t, .07)) * lerp(1.4, 1, at(time, t - .35, t - .1, ease.outQuart));
    c.save(); c.globalAlpha *= a; c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#FFFFFF'; c.lineWidth = 3; c.stroke(); c.restore();
  }
  ring(c, x, y, time, t, '#FFFFFF', .8);
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, out = exitOf(time, d, .55);
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    // The rule the phone stands on: draws out from the centre, pulls back in at the end.
    const rule = at(time, .02, .4, ease.inOutCubic) * (1 - at(time, d - .3, d, ease.inOutCubic));
    if (rule > 0) { c.fillStyle = pg.accent; c.fillRect(CX - 470 * rule, FLOOR, 940 * rule, 6); }

    // Title: up to two lines rising letter by letter; the last word gets the hand-drawn underline.
    const { lines, size } = fitHeadline(c, String(p.title).toUpperCase(), 860, 136);
    const lh = size * 1.02, last = 470, n = lines.length;
    lines.forEach((ln, i) => {
      const y = last - (n - 1 - i) * lh;
      const boxes = charLine(c, ln, CX, y, size, time, .12 + i * .22, { color: pg.ink, stagger: .03, exitAt: d - .62 + i * .05, fx: () => ({ alpha: 1 - out }) });
      if (i === n - 1 && boxes.length) {
        const from = ln.lastIndexOf(' ') + 1, u = at(time, 1.15, 1.7, ease.inOutCubic);
        c.save(); c.globalAlpha *= 1 - out; underline(c, boxes[from]![0], boxes[boxes.length - 1]![1], y + 34, u, pg.accent, 9); c.restore();
      }
    });

    // The phone rises out of the rule (clipped to the page above it) and sinks back into it at the end.
    const rise = at(time, .28, 1.25, springs.camera), sink = at(time, d - .55, d - .1, ease.inOutCubic);
    const py = PY - PH + (1 - rise) * (PH + 60) + sink * (PH + 60);
    if (py < FLOOR) {
      c.save(); c.beginPath(); c.rect(0, 0, 1080, FLOOR); c.clip();
      c.fillStyle = pg.dark ? '#2A2A2A' : '#111111'; c.fill(rr(PX, py, PW, PH, 72));
      const sx = PX + INSET, sy = py + INSET, sw = PW - INSET * 2, sh = PH - INSET * 2;
      c.save(); c.beginPath(); c.roundRect(sx, sy, sw, sh, 58); c.clip(); c.translate(sx, sy);
      const img = ctx.assets.screen as (CanvasImageSource & { width: number; height: number }) | undefined;
      if (img) cover(c, img, 0, 0, sw, sh, .5, 0);
      else phoneScreen(c, sw, sh, pg, time - .75, time - TAP);
      // The camera island: a flat pill at the top of the screen.
      c.fillStyle = '#000000'; c.fill(rr(sw / 2 - 52, 18, 104, 30, 15));
      // The touch lands in the row's free space, between the task name and its time, so the strike stays readable.
      touch(c, sw * .77, rowY(TAP_ROW, sw / 448), time, TAP);
      c.restore(); c.restore();
    }
    safeGuide(c, '9:16', p.safeGuide);
  });
}
