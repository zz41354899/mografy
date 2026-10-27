// Click zoom: a line opens into a window onto a dark editor. A big cursor travels to the Export button and clicks
// (squash, ring); the camera pushes in about the button, and an orange label printed on the page above names it,
// tied to the button by a short leader.
import type { FrameContext } from '@mografy/runtime';
import { alpha, at, ease, exitOf, lerp, press, ring, rr, safeGuide, safeParam, springs, stage, type C2D, type TemplateInfo } from './kit.js';
import { CX, DISPLAY, SANS, W, charLine, editorialParams, marked, measure, page, paper, txt, type Page } from './editorial.js';

export const template = {
  id: 'click-zoom', name: 'Click zoom', category: 'screen', aspect: '9:16',
  summary: 'A big cursor clicks a button in a dark product window, the camera pushes in on it and an orange label names it.',
  agentHint: 'Highlight one button or control. Label 2–5 words. The editor in the window is a stand-in: redraw `editor` with the real screen and move BTN to the control (keep it in the top half so the leader stays short).',
  principles: ['anticipation', 'squash and stretch', 'staging', 'slow in and slow out'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 4, fps: 30, background: '#FFFFFF' };

export const params = {
  label: { name: 'Label', type: 'string' as const, default: 'Export in one click' },
  ...editorialParams, ...safeParam,
};

// The window opens tall, then its top edge slides down to make room for the label once the button is clicked.
const TOP0 = 300, TOP = 560, BOT = 1500, LINE_Y = 900, VH = BOT - TOP0, OPEN = .35, CLICK = 1.65, ZOOM = 1.45;
const BTN: [number, number] = [918, 70], BW = 196, BH = 64, RIGHT = 950;
const UI = { bg: '#171717', panel: '#222222', ink: '#FFFFFF', mute: '#8C8C8C' };

/** A headline set on two balanced lines (one when it is a single word), shrunk until it fits `width`; [marked] words come back flagged. */
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
      const sc = wmax * (span(0, i - 1).plain.endsWith(',') ? .8 : 1);
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

/** The stand-in editor (window coordinates, W × VH): top bar with Export, a film frame and a timeline. */
function editor(c: C2D, pg: Page, time: number) {
  c.fillStyle = pg.dark ? '#1E1E1E' : UI.bg; c.fillRect(0, 0, W, VH);
  txt(c, 'NORTHWIND', 56, 84, { size: 40, color: UI.ink, family: DISPLAY, tracking: 2 });
  txt(c, 'LAUNCH FILM  ·  0:30', 330, 80, { size: 22, color: UI.mute, family: SANS, weight: 800, tracking: 5 });
  c.fillStyle = alpha(UI.ink, .1); c.fillRect(0, 140, W, 2);
  // Export: presses, fills with progress, then reads Done.
  const bp = press(time, CLICK, .08), fill = at(time, CLICK + .1, CLICK + .85, ease.inOutCubic), done = at(time, CLICK + .85, CLICK + 1.2, ease.outQuint);
  c.save(); c.translate(BTN[0], BTN[1]); c.scale(1 - .07 * bp, 1 - .07 * bp);
  c.fillStyle = pg.accent; c.fill(rr(-BW / 2, -BH / 2, BW, BH, 6));
  if (fill > 0 && done < 1) { c.fillStyle = alpha('#FFFFFF', .22 * (1 - done)); c.fillRect(-BW / 2, -BH / 2, BW * fill, BH); }
  c.beginPath(); c.rect(-BW / 2, -BH / 2, BW, BH); c.clip();
  const lab = { size: 26, color: '#FFFFFF', family: SANS, weight: 700, align: 'center' as const };
  txt(c, 'Export', 0, 10 - done * BH, lab);
  if (done > 0) {
    txt(c, 'Done', 12, 10 + (1 - done) * BH, lab);
    c.strokeStyle = '#FFFFFF'; c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-52, 2 + (1 - done) * BH); c.lineTo(-44, 10 + (1 - done) * BH); c.lineTo(-30, -6 + (1 - done) * BH); c.stroke();
  }
  c.restore();
  // The film frame.
  const fx = 56, fy = 196, fw = W - 112, fh = fw * 9 / 16;
  c.fillStyle = UI.panel; c.fillRect(fx, fy, fw, fh);
  txt(c, 'MEET', fx + fw - 64, fy + 210, { size: 110, color: UI.ink, family: DISPLAY, tracking: 2, align: 'right' });
  txt(c, 'NORTHWIND.', fx + fw - 64, fy + 330, { size: 110, color: pg.accent, family: DISPLAY, tracking: 2, align: 'right' });
  txt(c, 'A calm week, planned in one place.', fx + fw - 66, fy + 400, { size: 26, color: UI.mute, family: SANS, weight: 600, align: 'right' });
  c.fillStyle = alpha(UI.ink, .16); c.fillRect(fx, fy + fh - 6, fw, 6); c.fillStyle = pg.accent; c.fillRect(fx, fy + fh - 6, fw * .38, 6);
  // Timeline: six clips and a playhead.
  const ty = fy + fh + 60, clips = [.14, .2, .12, .22, .16, .16];
  txt(c, 'TIMELINE', fx, ty - 14, { size: 18, color: UI.mute, family: SANS, weight: 800, tracking: 5 });
  let x = fx;
  clips.forEach((w, i) => { const cw = fw * w - 8; c.fillStyle = i === 2 ? pg.accent : alpha(UI.ink, .2); c.fillRect(x, ty, cw, 96); x += fw * w; });
  c.fillStyle = UI.ink; c.fillRect(fx + fw * .38, ty - 16, 3, 128);
  txt(c, '00:11 / 00:30', fx + fw, ty + 150, { size: 22, color: UI.mute, family: SANS, weight: 600, align: 'right' });
  // Export settings under the timeline.
  [['Format', 'MP4  ·  1080 × 1920'], ['Length', '0:30'], ['Music', 'Calm piano']].forEach(([k, v], i) => {
    const y = ty + 230 + i * 74;
    c.fillStyle = alpha(UI.ink, .1); c.fillRect(fx, y + 26, fw, 2);
    txt(c, k!, fx, y, { size: 26, color: UI.mute, family: SANS, weight: 600 });
    txt(c, v!, fx + fw, y, { size: 26, color: UI.ink, family: SANS, weight: 600, align: 'right' });
  });
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, out = exitOf(time, d, .55);
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    const line = at(time, .02, OPEN, ease.inOutCubic), open = at(time, OPEN, OPEN + .8, springs.camera), close = at(time, d - .55, d - .1, ease.inOutCubic);
    const slide = at(time, CLICK + .3, CLICK + .95, springs.camera), rest = lerp(TOP0, TOP, slide), mid = (TOP + BOT) / 2;
    const top = lerp(lerp(LINE_Y, TOP0, open) + (TOP - TOP0) * slide, mid, close), bot = lerp(lerp(LINE_Y, BOT, open), mid, close);
    // Camera inside the window: zoom about the button, so it keeps its place while everything grows around it.
    const z = lerp(1, ZOOM, at(time, CLICK + .05, CLICK + .75, springs.camera)), ox = BTN[0] * (1 - z), oy = BTN[1] * (1 - z);
    if (bot - top > 1) {
      c.save(); c.beginPath(); c.rect(0, top, W, bot - top); c.clip(); c.translate(0, rest);
      c.save(); c.translate(ox, oy); c.scale(z, z); editor(c, pg, time); c.restore();
      // The cursor travels on a spring with a slight arc, squashes on the click and rests beside the button.
      const m = at(time, .8, CLICK - .05, springs.cursor), park = at(time, CLICK + .2, CLICK + .8, ease.inOutCubic);
      const tx = BTN[0] - 10, ty = BTN[1] + 6, bend = Math.sin(m * Math.PI) * 60;
      const cx = lerp(lerp(400, tx, m) + bend, tx + 70, park), cy = lerp(lerp(760, ty, m) + bend * .4, ty + 120, park);
      ring(c, BTN[0], BTN[1], time, CLICK, '#FFFFFF', 1.2);
      arrow(c, cx, cy, 3.2, press(time, CLICK), at(time, .75, 1.0) * (1 - out));
      c.restore();
    }
    const retract = at(time, OPEN + .45, OPEN + .95, ease.inOutCubic) * (1 - at(time, d - .62, d - .45, ease.inOutCubic));
    const half = 540 * line * (1 - at(time, d - .2, d, ease.inOutCubic));
    if (half > 0 && retract < 1) for (const y of bot - top > 2 ? [top - 3, bot - 3] : [top - 3]) {
      c.fillStyle = pg.accent; c.fillRect(CX - half, y, half * (1 - retract), 6); c.fillRect(CX + half * retract, y, half * (1 - retract), 6);
    }

    // The label is printed on the page above the button, right-aligned to it; a leader drops to the button.
    const L0 = CLICK + .35, { lines, size } = headline(c, String(p.label).toUpperCase(), 860, 150);
    const lh = size * 1.0, last = TOP - 70;
    // The letters rise into the page above the window, never over its picture while its top edge is still sliding.
    c.save(); c.beginPath(); c.rect(0, 0, W, top - 3); c.clip();
    lines.forEach((ln, i) => charLine(c, ln.plain, RIGHT, last - (lines.length - 1 - i) * lh, size, time, L0 + i * .18, {
      color: pg.accent, align: 'right', stagger: .03, exitAt: d - .65 + i * .04, fx: j => ({ ...(ln.flags[j] ? { color: pg.ink } : {}), alpha: 1 - out }),
    }));
    c.restore();
    const lead = at(time, L0 + .25, L0 + .6, ease.inOutCubic) * (1 - out), btnTop = TOP + BTN[1] - BH / 2 * ZOOM - 10;
    if (lead > 0) { c.fillStyle = pg.accent; c.fillRect(BTN[0] - 3, last + 26, 6, (btnTop - last - 26) * lead); }
    safeGuide(c, '9:16', p.safeGuide);
  });
}
