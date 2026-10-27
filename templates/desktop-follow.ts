// Desktop follow: a line opens into a tall window onto a wide dark web app. A camera inside the window follows the
// cursor across the app and pushes in a little on each click (zooming about the click, no swing): open Reports,
// press New report, and the new report lands at the top of the list. An Anton label above says what happens.
import type { FrameContext } from '@mografy/runtime';
import { alpha, at, ease, exitOf, lerp, press, ring, rr, safeGuide, safeParam, springs, stage, type C2D, type TemplateInfo } from './kit.js';
import { CX, DISPLAY, SANS, W, charLine, editorialParams, marked, measure, page, paper, txt, type Page } from './editorial.js';

export const template = {
  id: 'desktop-follow', name: 'Desktop follow', category: 'screen', aspect: '9:16',
  summary: 'A window opens onto a wide desktop app; the camera follows the cursor and pushes in on each of two clicks.',
  agentHint: 'Show a two-click desktop flow in a portrait post. Label 2–5 words, [brackets] mark the orange words. The app is a stand-in 1440 × 1000 dashboard: redraw `app` with the real product and move CLICKS to its targets (the camera follows them).',
  principles: ['staging', 'anticipation', 'slow in and slow out', 'follow-through'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 6, fps: 30, background: '#FFFFFF' };

export const params = {
  label: { name: 'Label', type: 'string' as const, default: 'One click, [one report]' },
  ...editorialParams, ...safeParam,
};

// Window on the page, and the app inside it (app coordinates).
const TOP = 620, BOT = 1560, LINE_Y = 1090, VW = W, VH = BOT - TOP, AW = 1440, AH = 1000;
const OPEN = .35, C1 = 2.0, C2 = 3.75;
const NAV = ['Overview', 'Planner', 'Reports', 'Team', 'Settings'];
const REPORTS = [['Weekly planning', 'Jun 2'], ['Team velocity', 'May 26'], ['Launch tracker', 'May 19'], ['Hiring pipeline', 'May 12']];
const P1: [number, number] = [118, 328], P2: [number, number] = [1290, 82];
const UI = { bg: '#171717', side: '#101010', ink: '#FFFFFF', mute: '#8C8C8C' };

// ---------------------------------------------------------------- type

/** A headline of at most two balanced lines (preferring a break after a comma), shrunk until it fits `width`. */
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
      const a = span(0, i - 1), b = span(i, toks.length - 1), wmax = Math.max(measure(c, a.plain, st(s)), measure(c, b.plain, st(s)));
      const sc = wmax * (a.plain.endsWith(',') ? .8 : 1);
      if (sc < score) { score = sc; best = i; }
    }
    const lines = [span(0, best - 1), span(best, toks.length - 1)];
    if (lines.every(l => measure(c, l.plain, st(s)) <= width) || s <= 48) return { lines, size: s };
  }
}

/** A flat arrow cursor (no shadow): white with an ink outline; `pressK` squashes it. */
function arrow(c: C2D, x: number, y: number, scale: number, pressK: number, a = 1) {
  if (a <= .001) return;
  const s = scale * (1 - .14 * pressK);
  c.save(); c.globalAlpha *= a; c.translate(x, y); c.scale(s, s);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 22); c.lineTo(5.5, 17); c.lineTo(9.5, 26); c.lineTo(13, 24.5); c.lineTo(9, 15.8); c.lineTo(16, 15.8); c.closePath();
  c.fillStyle = '#FFFFFF'; c.fill(); c.strokeStyle = '#111111'; c.lineWidth = 1.5; c.lineJoin = 'round'; c.stroke();
  c.restore();
}

// ---------------------------------------------------------------- camera and cursor

type Cam = { z: number; ox: number; oy: number };
/** Keep the view inside the app. */
const bound = (k: Cam): Cam => ({ z: k.z, ox: Math.min(0, Math.max(VW - AW * k.z, k.ox)), oy: Math.min(0, Math.max(VH - AH * k.z, k.oy)) });
/** View centred on an app point. */
const centre = (x: number, y: number, z: number) => bound({ z, ox: VW / 2 - x * z, oy: VH / 2 - y * z });
/** Zoom to `z` about an app point, which keeps its place on screen. */
const pushAbout = (k: Cam, x: number, y: number, z: number): Cam => ({ z, ox: x * k.z + k.ox - x * z, oy: y * k.z + k.oy - y * z });

const K0 = centre(760, 520, .97), K1 = centre(560, 520, .97), K2 = pushAbout(K1, P1[0], P1[1], 1.1);
const K3 = centre(1000, 470, 1.1), K4 = pushAbout(K3, P2[0], P2[1], 1.26), K5 = centre(750, 470, 1.26);
/** Camera moves: [start, end, pose]. Each eases on springs.camera; translation and zoom move together, so a push stays anchored. */
const CAM: [number, number, Cam][] = [[1.1, 1.9, K1], [C1, C1 + .6, K2], [2.55, 3.55, K3], [C2, C2 + .6, K4], [4.3, 4.95, K5]];
function camera(time: number): Cam {
  let k = K0;
  for (const [a, b, next] of CAM) {
    const p = at(time, a, b, springs.camera);
    k = { z: lerp(k.z, next.z, p), ox: lerp(k.ox, next.ox, p), oy: lerp(k.oy, next.oy, p) };
  }
  return k;
}
/** Cursor in app coordinates: [time, x, y] keys, travelling on springs.cursor. */
const MOVES: [number, number, number][] = [[1.0, 880, 720], [1.95, P1[0], P1[1]], [2.35, P1[0], P1[1]], [3.7, P2[0], P2[1]], [4.3, P2[0], P2[1]], [4.9, 860, 505]];
function cursorAt(time: number): [number, number] {
  if (time <= MOVES[0]![0]) return [MOVES[0]![1], MOVES[0]![2]];
  let i = 0; while (i < MOVES.length - 2 && time > MOVES[i + 1]![0]) i++;
  const a = MOVES[i]!, b = MOVES[i + 1]!, p = springs.cursor(at(time, a[0], b[0], ease.linear));
  const bend = Math.sin(p * Math.PI) * Math.min(60, Math.hypot(b[1] - a[1], b[2] - a[2]) * .06);
  return [lerp(a[1], b[1], p) + bend, lerp(a[2], b[2], p) - bend * .5];
}

// ---------------------------------------------------------------- the app (1440 × 1000, dark)

function app(c: C2D, pg: Page, time: number) {
  // On the dark page the app is a step lighter than the page, so the window still reads as a picture.
  c.fillStyle = pg.dark ? '#212121' : UI.bg; c.fillRect(0, 0, AW, AH);
  c.fillStyle = pg.dark ? '#191919' : UI.side; c.fillRect(0, 0, 300, AH);
  txt(c, 'NORTHWIND', 44, 92, { size: 44, color: UI.ink, family: DISPLAY, tracking: 2 });
  c.fillStyle = pg.accent; c.fillRect(44, 112, 36, 4);
  const toReports = at(time, C1 + .05, C1 + .35, ease.outQuart), leave = at(time, C1 + .05, C1 + .3, ease.inOutCubic), arrive = at(time, C1 + .25, C1 + .7, ease.outQuint);
  NAV.forEach((n, i) => {
    const y = 200 + i * 64, on = i === 0 ? 1 - toReports : i === 2 ? toReports : 0;
    if (on > 0) { c.fillStyle = alpha(UI.ink, .07 * on); c.fillRect(24, y - 40, 252, 56); c.fillStyle = pg.accent; c.fillRect(24, y - 40, 5 * on, 56); }
    txt(c, n, 56, y, { size: 26, color: on > .5 ? UI.ink : UI.mute, family: SANS, weight: 600 });
  });
  const flash = press(time, C1, .1);
  if (flash > .01) { c.fillStyle = alpha(pg.accent, .22 * flash); c.fillRect(24, 200 + 2 * 64 - 40, 252, 56); }

  // Top bar: page name and the New report button (pressed at C2).
  const x0 = 360;
  c.save(); c.beginPath(); c.rect(x0, 40, 600, 80); c.clip();
  txt(c, 'OVERVIEW', x0, 96 - toReports * 70, { size: 26, color: UI.mute, family: SANS, weight: 800, tracking: 6 });
  txt(c, 'REPORTS', x0, 166 - toReports * 70, { size: 26, color: UI.mute, family: SANS, weight: 800, tracking: 6 });
  c.restore();
  const bp = press(time, C2, .08), bw = 220, bh = 64;
  c.save(); c.translate(P2[0], P2[1]); c.scale(1 - .06 * bp, 1 - .06 * bp);
  c.fillStyle = pg.accent; c.fill(rr(-bw / 2, -bh / 2, bw, bh, 6));
  txt(c, '+  New report', 0, 9, { size: 25, color: '#FFFFFF', family: SANS, weight: 700, align: 'center' });
  c.restore();
  c.fillStyle = alpha(UI.ink, .1); c.fillRect(x0, 150, AW - x0 - 40, 2);

  // Right column: who the page is shared with.
  txt(c, 'SHARED WITH', 1180, 250, { size: 20, color: UI.mute, family: SANS, weight: 800, tracking: 5 });
  ['AK', 'MR', 'JS', 'LT'].forEach((n, i) => {
    const y = 316 + i * 84;
    c.fillStyle = i === 0 ? pg.accent : alpha(UI.ink, .16); c.beginPath(); c.arc(1206, y, 26, 0, Math.PI * 2); c.fill();
    txt(c, n, 1206, y + 8, { size: 20, color: UI.ink, family: SANS, weight: 700, align: 'center' });
    c.fillStyle = alpha(UI.ink, .18); c.fillRect(1250, y - 8, 110 - i * 14, 8); c.fillStyle = alpha(UI.ink, .1); c.fillRect(1250, y + 6, 70, 6);
  });
  // Overview: the week's figure and a bar chart. Reports: a list that the new report joins at the top.
  if (leave < 1) {
    c.save(); c.globalAlpha *= 1 - leave; c.translate(0, -leave * 30);
    txt(c, '12,480', x0, 410, { size: 210, color: UI.ink, family: DISPLAY, tracking: 2 });
    txt(c, 'ACTIVE USERS THIS WEEK', x0, 470, { size: 24, color: UI.mute, family: SANS, weight: 700, tracking: 5 });
    const bars = [.42, .55, .48, .7, .62, .84, 1], bwid = 780 / bars.length;
    bars.forEach((v, i) => { const h = 300 * v; c.fillStyle = i === 6 ? pg.accent : alpha(UI.ink, .26); c.fillRect(x0 + i * bwid + bwid * .2, 900 - h, bwid * .6, h); });
    c.fillStyle = alpha(UI.ink, .2); c.fillRect(x0, 902, 780, 2);
    c.restore();
  }
  if (arrive > 0) {
    const add = at(time, C2 + .12, C2 + .75, springs.camera), rowH = 112, y0 = 200, RW = 780;
    c.save(); c.globalAlpha *= arrive; c.translate(0, (1 - arrive) * 30);
    const nw = txt(c, String(REPORTS.length + (add > .5 ? 1 : 0)).padStart(2, '0'), x0, 360, { size: 150, color: UI.ink, family: DISPLAY });
    txt(c, 'REPORTS THIS QUARTER', x0 + nw + 24, 356, { size: 24, color: UI.mute, family: SANS, weight: 700, tracking: 5 });
    const row = (y: number, name: string, date: string, fresh: number) => {
      c.fillStyle = alpha(UI.ink, .1); c.fillRect(x0, y + rowH, RW, 2);
      if (fresh > 0) { c.fillStyle = alpha(pg.accent, .14 * fresh); c.fillRect(x0, y + 2, RW, rowH - 2); c.fillStyle = pg.accent; c.fillRect(x0, y + 2, 6, rowH - 2); }
      txt(c, name, x0 + 40, y + 68, { size: 32, color: UI.ink, family: SANS, weight: 600 });
      txt(c, date, x0 + RW - 150, y + 68, { size: 26, color: UI.mute, family: SANS, weight: 600, align: 'right' });
      txt(c, fresh > 0 ? 'READY' : 'PDF', x0 + RW - 30, y + 68, { size: 22, color: fresh > 0 ? pg.accent : UI.mute, family: SANS, weight: 800, tracking: 4, align: 'right' });
    };
    const top = y0 + 230;
    REPORTS.forEach(([n, dt], i) => row(top + (i + add) * rowH, n!, dt!, 0));
    if (add > 0) {
      c.save(); c.beginPath(); c.rect(x0, top, AW, rowH * add + 2); c.clip();
      row(top - rowH * (1 - add), 'Q3 planning report', 'Today', 1);
      c.restore();
    }
    c.restore();
  }
}

// ---------------------------------------------------------------- frame

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, out = exitOf(time, d, .55);
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    // Label: Anton, two balanced lines at most, [marked] words in the accent.
    const { lines, size } = headline(c, String(p.label).toUpperCase(), 860, 140);
    const lh = size * 1.02, last = 520;
    lines.forEach((ln, i) => charLine(c, ln.plain, CX, last - (lines.length - 1 - i) * lh, size, time, .12 + i * .25, {
      color: pg.ink, stagger: .03, exitAt: d - .62 + i * .05, fx: j => ({ ...(ln.flags[j] ? { color: pg.accent } : {}), alpha: 1 - out }),
    }));

    // The line draws, opens into the window, and the window closes back into it at the end.
    const line = at(time, .02, OPEN, ease.inOutCubic), open = at(time, OPEN, OPEN + .8, springs.camera), close = at(time, d - .55, d - .1, ease.inOutCubic);
    const top = lerp(lerp(LINE_Y, TOP, open), LINE_Y, close), bot = lerp(lerp(LINE_Y, BOT, open), LINE_Y, close);
    if (bot - top > 1) {
      const cam = camera(time), [wx, wy] = cursorAt(time);
      c.save(); c.beginPath(); c.rect(0, top, W, bot - top); c.clip(); c.translate(0, TOP);
      c.save(); c.translate(cam.ox, cam.oy); c.scale(cam.z, cam.z); app(c, pg, time); c.restore();
      const sx = wx * cam.z + cam.ox, sy = wy * cam.z + cam.oy;
      ring(c, P1[0] * cam.z + cam.ox, P1[1] * cam.z + cam.oy, time, C1, '#FFFFFF', .9);
      ring(c, P2[0] * cam.z + cam.ox, P2[1] * cam.z + cam.oy, time, C2, '#FFFFFF', .9);
      arrow(c, sx, sy, 2.6, Math.max(press(time, C1), press(time, C2)), at(time, .95, 1.25) * (1 - out));
      c.restore();
    }
    const retract = at(time, OPEN + .45, OPEN + .95, ease.inOutCubic) * (1 - at(time, d - .62, d - .45, ease.inOutCubic));
    const half = 540 * line * (1 - at(time, d - .2, d, ease.inOutCubic));
    if (half > 0 && retract < 1) for (const y of bot - top > 2 ? [top - 3, bot - 3] : [top - 3]) {
      c.fillStyle = pg.accent; c.fillRect(CX - half, y, half * (1 - retract), 6); c.fillRect(CX + half * retract, y, half * (1 - retract), 6);
    }
    safeGuide(c, '9:16', p.safeGuide);
  });
}
