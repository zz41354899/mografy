// A 12-second tour of walkthrough.ts: a fictional quoting app redrawn as four simplified cards, filmed one action at a time.
// Each card grows out of the control that was just used, each card has its own camera, and the cursor follows them.
import { clamp, pr } from '@mografy/runtime';
import type { FrameContext } from '@mografy/runtime';
import { createKit, mixColor, springs, sineInOut, press, typed, blink, countUp, camAt, withCamera, toScreen, rectToScreen, cursorAt, drawCursor, clickRing, visible, fluid, flood } from './walkthrough.js';
import type { Kit, Rect, CameraKey, CursorKey, Viewport } from './walkthrough.js';

export const meta = { width: 1920, height: 1080, duration: 12, fps: 30, background: '#ffffff' };

export const params = {
  accent: { name: 'Brand colour', type: 'color' as const, default: '#3b6cf6' },
};
type Values = { accent: string };

export function setup() { /* nothing to prepare: everything is drawn */ }

const VIEW: Viewport = { width: 1920, height: 1080 };
const PROMPT = 'Quote for Lumen Studio: homepage plus 5 inner pages, responsive build and three months of care. Budget about $8k.';
const ROWS: [string, string, number][] = [['Homepage design', '1 page', 1800], ['Inner page design', '5 pages', 2500], ['Responsive build', '1 set', 2700], ['Care plan', '3 months', 900]];
const money = (v: number) => '$' + v.toLocaleString('en-US');

// layout rects and click times
const A: Rect = [400, 240, 1120, 600], A_AI: Rect = [966, 700, 230, 58], CLICK_A = 2.2;
const B: Rect = [380, 330, 1160, 420], B_FIELD: Rect = [420, 430, 1080, 230], SEND = { x: 1456, y: 616, r: 32 }, CLICK_B = 6.0, TYPE: [number, number] = [3.1, 5.2];
const BUBBLE: Rect = [900, 120, 580, 128], C: Rect = [440, 290, 1040, 640], C_BTN: Rect = [480, 840, 960, 64], ROW_T = [6.9, 7.1, 7.3, 7.5], CLICK_C = 9.2;
const D: Rect = [510, 320, 900, 400], D_LINK: Rect = [554, 470, 700, 64], D_COPY: Rect = [1270, 470, 96, 64], CLICK_D = 10.6;
const camA: CameraKey[] = [[0, 960, 540, 1], [1.3, 960, 540, 1], [2.0, 1060, 680, 1.35], [3, 1060, 680, 1.35]];
const camB: CameraKey[] = [[2.2, 960, 540, 1], [5.3, 960, 540, 1], [5.9, 1300, 590, 1.75], [6.1, 1300, 590, 1.75], [6.7, 960, 540, 1]];
const camC: CameraKey[] = [[6, 960, 540, 1], [8.5, 960, 540, 1], [9.1, 960, 830, 1.3], [9.3, 960, 830, 1.3], [10, 960, 640, .97]];
const camD: CameraKey[] = [[9.2, 960, 540, 1], [9.9, 960, 540, 1], [10.4, 1120, 520, 1.3], [12, 1120, 520, 1.3]];

function cardA(k: Kit, c: CanvasRenderingContext2D, t: number) {
  const [x, y, w] = A, th = k.theme, cx = x + w / 2;
  k.card(c, A);
  k.box(c, x + 48, y + 30, 40, 40, 11, th.primary); k.text(c, 'P', x + 68, y + 51, 24, { color: '#ffffff', weight: 700, align: 'center' });
  k.text(c, 'Paperline', x + 102, y + 51, 24, { weight: 700 });
  k.skeleton(c, x + w - 290, y + 44, 120); k.dot(c, x + w - 72, y + 50, 18, th.surface);
  k.line(c, x, y + 100, x + w, y + 100);
  k.text(c, 'Quotes', x + 48, y + 164, 44, { weight: 700 }); k.text(c, 'Create, track and share quotes', x + 48, y + 210, 20, { color: th.mute, weight: 400 });
  k.button(c, [x + w - 228, y + 140, 180, 54], 'New quote', { size: 20, icon: 'doc' });
  k.hair(c, x + 48, y + 254, w - 96, 52, 14); k.icon(c, 'search', x + 76, y + 280, th.faint, 1.2); k.skeleton(c, x + 104, y + 274, 300);
  k.text(c, 'No quotes yet', cx, y + 372, 28, { weight: 700, align: 'center' });
  k.text(c, 'Create one by hand, or describe the job and let AI draft it.', cx, y + 412, 20, { color: th.mute, weight: 400, align: 'center' });
  k.button(c, [774, 700, 176, 58], 'New quote', { size: 20 });
  k.button(c, A_AI, 'Draft with AI', { kind: 'secondary', size: 20, icon: 'sparkle', hover: sineInOut(pr(t, 1.7, 1.9)), time: t, pressAt: CLICK_A });
}
function cardB(k: Kit, c: CanvasRenderingContext2D, t: number) {
  const [x, y, w, h] = B, th = k.theme, typing = t > TYPE[0] && t < TYPE[1];
  k.card(c, B);
  k.icon(c, 'sparkle', x + 46, y + 45, th.primary, 1.3); k.text(c, 'New chat', x + 70, y + 44, 22, { weight: 700 }); k.icon(c, 'x', x + w - 46, y + 44, th.mute, 1.2);
  k.line(c, x, y + 86, x + w, y + 86);
  const value = typed(PROMPT, pr(t, TYPE[0], TYPE[1]));
  k.field(c, B_FIELD, { value, placeholder: 'Describe the job, or drop in a brief…', size: 32, lines: 4, radius: 24, focus: sineInOut(pr(t, 2.8, 3.1)), caret: t > 2.8 && t < CLICK_B && (typing || blink(t)) });
  k.icon(c, 'plus', B_FIELD[0] + 46, B_FIELD[1] + B_FIELD[3] - 44, th.mute, 1.6);
  const p = press(t, CLICK_B);
  c.save(); c.translate(SEND.x, SEND.y); c.scale(1 - .12 * p, 1 - .12 * p); k.dot(c, 0, 0, SEND.r, value ? th.primary : k.mix(th.primary, '#ffffff', .5)); k.icon(c, 'arrowUp', 0, 0, '#ffffff', 1.8); c.restore();
  k.ring(c, [SEND.x - SEND.r, SEND.y - SEND.r, SEND.r * 2, SEND.r * 2], SEND.r, t, CLICK_B);
  k.text(c, 'Enter to send, Shift + Enter for a new line', x + w / 2, y + h - 32, 18, { color: th.faint, weight: 400, align: 'center' });
}
function bubble(k: Kit, c: CanvasRenderingContext2D) {
  const [x, y, w, h] = BUBBLE; k.box(c, x, y, w, h, 24, k.theme.primary);
  k.wrap(c, PROMPT, w - 68, 22, { weight: 400 }).forEach((l, i) => k.text(c, l, x + 34, y + 33 + i * 32, 22, { color: '#ffffff', weight: 400 }));
}
function cardC(k: Kit, c: CanvasRenderingContext2D, t: number) {
  const [x, y, w] = C, th = k.theme, rise = springs.out(pr(t, 6.7, 7.2)), btn = springs.out(pr(t, 8.1, 8.6)), h = 540 + 100 * btn;
  bubble(k, c);
  if (rise <= 0) return;
  c.save(); c.globalAlpha *= clamp(rise * 1.4); c.translate(0, (1 - rise) * 40);
  k.card(c, [x, y, w, h]);
  k.reveal(c, 'Lumen Studio — website redesign', x + 40, y + 52, 26, t, 6.75, .35, { weight: 700 });
  k.chip(c, x + w - 112, y + 52, 'Draft', { fg: th.primary, bg: th.primarySoft });
  k.line(c, x + 40, y + 92, x + w - 40, y + 92);
  ROWS.forEach(([name, qty, amount], i) => {
    const at = ROW_T[i]!, e = springs.pop(pr(t, at, at + .5)), a = pr(t, at, at + .2); if (a <= 0) return;
    const Y = y + 92 + i * 84;
    c.save(); c.globalAlpha *= a; c.translate(0, (1 - e) * 22);
    k.text(c, name, x + 40, Y + 34, 24, { weight: 600 }); k.skeleton(c, x + 40, Y + 58, 260, 10);
    const aw = k.measure(c, money(amount), 26, { weight: 700 });
    k.text(c, money(countUp(amount, pr(t, at, at + .5))), x + w - 40, Y + 42, 26, { color: th.primary, weight: 700, align: 'right' });
    k.text(c, qty, x + w - 62 - aw, Y + 42, 22, { color: th.mute, weight: 400, align: 'right' });
    if (i < 3) k.line(c, x + 40, Y + 84, x + w - 40, Y + 84, th.surface);
    c.restore();
  });
  const tk = pr(t, 7.55, 7.95);
  if (tk > 0) {
    c.save(); c.globalAlpha *= pr(t, 7.55, 7.7);
    k.line(c, x + 40, y + 446, x + w - 40, y + 446); k.text(c, 'Total', x + 40, y + 496, 28, { weight: 700 });
    const pop = 1 + .07 * Math.exp(-(((t - 7.98) / .13) ** 2));
    c.save(); c.translate(x + w - 40, y + 496); c.scale(pop, pop); k.text(c, money(countUp(7900, tk)), 0, 0, 52, { color: th.primary, weight: 700, align: 'right' }); c.restore();
    c.restore();
  }
  if (btn > 0) { c.save(); c.globalAlpha *= btn; c.translate(0, (1 - btn) * 16); k.button(c, C_BTN, 'Send to client', { size: 24, icon: 'user', hover: sineInOut(pr(t, 8.85, 9.0)), time: t, pressAt: CLICK_C }); c.restore(); }
  c.restore();
}
function cardD(k: Kit, c: CanvasRenderingContext2D, t: number) {
  const [x, y, w] = D, th = k.theme, copied = pr(t, CLICK_D + .05, CLICK_D + .2), view = sineInOut(pr(t, 11.25, 11.5));
  k.card(c, D);
  k.text(c, 'Share quote', x + 44, y + 58, 30, { weight: 700 }); k.icon(c, 'x', x + w - 50, y + 58, th.mute, 1.3);
  k.text(c, 'Anyone with the link can view the quote and accept it.', x + 44, y + 102, 20, { color: th.mute, weight: 400 });
  k.text(c, 'Link', x + 44, y + 150, 22, { weight: 700 });
  k.field(c, D_LINK, { value: 'paperline.app/q/7Kd2xPa9…', size: 22, mono: true, focus: copied });
  const p = press(t, CLICK_D), [cx, cy, cw, ch] = D_COPY;
  c.save(); c.translate(cx + cw / 2, cy + ch / 2); c.scale(1 - .08 * p, 1 - .08 * p);
  k.box(c, -cw / 2, -ch / 2, cw, ch, 16, k.mix('#ffffff', th.primarySoft, copied)); k.hair(c, -cw / 2, -ch / 2, cw, ch, 16, copied > 0 ? th.primary : th.line);
  if (copied > 0) k.check(c, 0, 0, 26, springs.out(copied)); else k.icon(c, 'copy', 0, 0, th.ink, 1.5);
  c.restore(); k.ring(c, D_COPY, 16, t, CLICK_D);
  k.line(c, x + 44, y + 282, x + w - 44, y + 282);
  // views: 0 → 1 when the client opens the link
  k.icon(c, 'eye', x + 58, y + 340, view > .5 ? th.primary : th.mute, 1.4);
  c.save(); c.beginPath(); c.rect(x + 72, y + 310, w - 116, 60); c.clip();
  k.text(c, '0 views', x + 84, y + 341 - view * 44, 24, { color: th.mute, weight: 500 }); k.text(c, '1 view · just now', x + 84, y + 385 - view * 44, 24, { color: th.primary, weight: 700 });
  c.restore();
}

export function renderFrame(ctx: FrameContext, time: number, values: Values) {
  const t = time, primary = values.accent;
  ctx.withCanvas(c => {
    const k = createKit({ primary, primaryDark: mixColor(primary, '#000000', .2), primarySoft: mixColor(primary, '#ffffff', .86) });
    const th = k.theme;
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, VIEW.width, VIEW.height);
    if (t > 2.25) { // brand atmosphere floods in when the first card opens
      fluid(c, VIEW, t, [k.mix(primary, '#000000', .25), primary, k.mix(primary, '#ffffff', .45), k.mix(primary, '#000000', .45), k.mix(primary, '#ffffff', .7)]);
      flood(c, VIEW, 1300 * (1 - sineInOut(pr(t, 2.25, 3.3))));
    }
    // A: the list page
    if (t < 2.7) {
      const a = springs.out(pr(t, 0, .8)), out = sineInOut(pr(t, 2.25, 2.6)), s = (.94 + .06 * a) * (1 - .04 * out);
      c.save(); c.globalAlpha *= clamp(a * 1.3) * (1 - out);
      withCamera(c, VIEW, camAt(camA, t), () => { c.translate(960, 540 + (1 - a) * 40); c.scale(s, s); c.translate(-960, -540); cardA(k, c, t); });
      c.restore();
    }
    // B: the button grows into the composer
    if (t >= CLICK_A + .05 && t < 6.6) {
      const K = camAt(camB, t);
      if (t < 3.0) k.grow(c, rectToScreen(VIEW, camAt(camA, CLICK_A), A_AI), rectToScreen(VIEW, K, B), springs.pop(pr(t, CLICK_A + .05, 3.0)), { incoming: () => withCamera(c, VIEW, K, () => cardB(k, c, t)) });
      else {
        const out = sineInOut(pr(t, CLICK_B + .05, CLICK_B + .5)), s = 1 - .05 * out;
        c.save(); c.globalAlpha *= 1 - out; withCamera(c, VIEW, K, () => { c.translate(960, 540 + out * 60); c.scale(s, s); c.translate(-960, -540); cardB(k, c, t); }); c.restore();
      }
    }
    // C: send becomes the message; the AI drafts the quote
    if (t >= CLICK_B + .05 && t < 10.4) {
      if (t < CLICK_B + .65) {
        const K = camAt(camB, CLICK_B);
        k.grow(c, rectToScreen(VIEW, K, [SEND.x - SEND.r, SEND.y - SEND.r, SEND.r * 2, SEND.r * 2]), BUBBLE, springs.pop(pr(t, CLICK_B + .05, CLICK_B + .65)),
          { fromRadius: SEND.r * K.z, toRadius: 24, fromColor: th.primary, toColor: th.primary, incoming: () => bubble(k, c) });
      } else {
        const dim = .62 * sineInOut(pr(t, CLICK_C + .05, CLICK_C + .6)), out = sineInOut(pr(t, 10.0, 10.4));
        c.save(); c.globalAlpha *= (1 - dim) * (1 - out); withCamera(c, VIEW, camAt(camC, t), () => cardC(k, c, t)); c.restore();
      }
    }
    // D: the button grows into the share card
    if (t >= CLICK_C + .05) {
      const K = camAt(camD, t);
      if (t < 9.95) k.grow(c, rectToScreen(VIEW, camAt(camC, CLICK_C), C_BTN), rectToScreen(VIEW, K, D), springs.pop(pr(t, CLICK_C + .05, 9.95)),
        { fromColor: th.primary, incoming: () => withCamera(c, VIEW, K, () => cardD(k, c, t)) });
      else withCamera(c, VIEW, K, () => cardD(k, c, t));
      k.toast(c, 960, 960, 'Link copied', springs.out(pr(t, CLICK_D + .1, CLICK_D + .4)) * (1 - pr(t, 11.6, 11.9)), { icon: 'link' });
    }
    // the cursor visits each control through that card's camera
    const keys: CursorKey[] = [
      [.8, [1500, 1040]], [1.85, tt => toScreen(VIEW, camAt(camA, tt), A_AI[0] + 150, A_AI[1] + 34)], [2.4, tt => toScreen(VIEW, camAt(camA, tt), A_AI[0] + 150, A_AI[1] + 34)],
      [5.0, [1640, 1010]], [5.75, tt => toScreen(VIEW, camAt(camB, tt), SEND.x + 6, SEND.y + 4)], [6.3, tt => toScreen(VIEW, camAt(camB, tt), SEND.x + 6, SEND.y + 4)],
      [8.2, [1560, 1040]], [8.95, tt => toScreen(VIEW, camAt(camC, tt), 1060, C_BTN[1] + 34)], [9.6, tt => toScreen(VIEW, camAt(camC, tt), 1060, C_BTN[1] + 34)],
      [10.45, tt => toScreen(VIEW, camAt(camD, tt), D_COPY[0] + 52, D_COPY[1] + 36)], [12, tt => toScreen(VIEW, camAt(camD, tt), D_COPY[0] + 52, D_COPY[1] + 36)],
    ];
    const vis = visible(t, [[.8, 2.55], [5.0, 6.35], [8.2, 11.1]]);
    if (vis > 0) {
      const [x, y] = cursorAt(keys, t), clicks = [CLICK_A, CLICK_B, CLICK_C, CLICK_D];
      clicks.forEach(at => clickRing(c, x, y, t, at, th.primary));
      drawCursor(c, x, y, { scale: 2.3, alpha: vis, squash: clicks.reduce((m, at) => Math.max(m, press(t, at)), 0) });
    }
  });
}
