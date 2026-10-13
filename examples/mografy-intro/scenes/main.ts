// Mografy intro: what Mografy is, in four beats (12 s).
//  1. 0.0–2.6  the idea: an animation is renderFrame(time)
//  2. 2.4–6.9  a frame that plays and scrubs to the same picture
//  3. 6.8–9.8  a chat request updates the player
//  4. 9.8–12   the ribbon-m logo, traced from the brand artwork (scenes/logo.ts)
import { pr, lerp, ease, clamp, colorLerp } from '@mografy/runtime';
import type { FrameContext, DrawingApi } from '@mografy/runtime';
import { LOGO_BOX, LOGO_PIECES } from './logo.js';

export const meta = { width: 1920, height: 1080, duration: 12, fps: 30, background: '#f7f7f4' };

export const params = {
  codeCaption: { role: 'subtitle' as const, name: 'Opening · Caption', type: 'string' as const, default: 'An animation is a function of time.' },
  playCaption: { role: 'subtitle' as const, name: 'Playback · Caption', type: 'string' as const, default: 'Every frame is drawn from time alone.' },
  scrubCaption: { role: 'subtitle' as const, name: 'Scrubbing · Caption', type: 'string' as const, default: 'Scrub anywhere. Same picture, every time.' },
  request: { name: 'Chat · Request', type: 'string' as const, default: 'Make the title teal and a little slower.' },
  chatCaption: { role: 'subtitle' as const, name: 'Chat · Caption', type: 'string' as const, default: 'Claude writes. The player updates, at the same moment.' },
  tagline: { role: 'subtitle' as const, name: 'Closing · Tagline', type: 'string' as const, default: 'Claude creates. Mografy shows.' },
  accent: { name: 'Accent', type: 'color' as const, default: '#12b5a5' },
  ink: { name: 'Ink', type: 'color' as const, default: '#151515' },
  vignette: { name: 'Vignette', type: 'number' as const, default: 0, min: 0, max: 1, step: 0.01 },
};
type P = { [K in keyof typeof params]: (typeof params)[K]['default'] };

const FONT = 'ABeeZee';
// Brand palette: paper, ink and the ribbon teal (params), plus quiet greys.
const MUTED = '#7c7b76';      // secondary text on paper
const PANEL = '#ebeae5';      // chat bubble and timeline strip on paper
const SCREEN = '#1b1c1f';     // the little screens inside the film
const SCREEN_INK = '#f2f1ec'; // text and shapes on those screens
const SCREEN_GREY = '#5b5e65';
const LINE = '#45474c';
const SHADOW = 'rgba(20,20,20,0.18)';
/** Path2D per logo piece, built once from the traced brand artwork (constant data, not state). */
const LOGO = LOGO_PIECES.map(piece => ({ ...piece, path: new Path2D(piece.d) }));

export function setup() {}

/** Fade in over [a, b], out over [outStart, d]. */
const window_ = (time: number, a: number, b: number, outStart: number, d: number) => ease.outCubic(pr(time, a, b)) * (1 - ease.inOutCubic(pr(time, outStart, d)));

function roundRect(x: number, y: number, w: number, h: number, r: number) {
  const path = new Path2D(); path.roundRect(x, y, w, h, r); return path;
}

function caption(ctx: FrameContext, text: string, alpha: number, y = 930) {
  if (alpha <= 0) return;
  const mografy = ctx.draw;
  mografy.push(); mografy.opacity(alpha); mografy.textFont(FONT); mografy.textSize(44); mografy.textAlign('center'); mografy.fill(MUTED);
  const lines = wrap(mografy, text, ctx.width - 240);
  const lineHeight = Math.min(54, 150 / Math.max(1, lines.length));
  mografy.textSize(Math.min(44, lineHeight * .82));
  lines.forEach((line, i) => mografy.text(line, ctx.width / 2, y + (i - (lines.length - 1) / 2) * lineHeight + (1 - alpha) * 14, ctx.width - 240));
  mografy.pop();
}

// ------------------------------------------------------------------ 1. renderFrame(time)

function beatCode(ctx: FrameContext, time: number, p: P) {
  const vis = window_(time, 0.1, 0.5, 2.1, 2.6);
  if (vis <= 0) return;
  const mografy = ctx.draw;
  const parts: [string, string][] = [['export function ', MUTED], ['renderFrame', p.accent], ['(ctx, ', p.ink], ['time', p.accent], [') {', p.ink]];
  const full = parts.map(x => x[0]).join('');
  const shown = Math.floor(lerp(0, full.length, pr(time, 0.35, 1.55)));
  mografy.push();
  mografy.opacity(vis);
  mografy.translate(0, -ease.inOutCubic(pr(time, 2.1, 2.6)) * 60);
  mografy.textFont(FONT); mografy.textSize(80); mografy.textAlign('start', 'alphabetic');
  const fontSize = 80 * Math.min(1, (ctx.width - 240) / Math.max(1, mografy.textWidth(full)));
  mografy.textSize(fontSize);
  const width = mografy.textWidth(full), x0 = (ctx.width - width) / 2, y = 500;
  let x = x0, used = 0;
  for (const [text, color] of parts) {
    const take = clamp(shown - used, 0, text.length);
    if (take > 0) { mografy.fill(color); mografy.text(text.slice(0, take), x, y); }
    x += mografy.textWidth(text); used += text.length;
  }
  // Second and third lines appear once the signature is typed.
  const body = ease.outCubic(pr(time, 1.55, 1.95));
  mografy.opacity(vis * body); mografy.fill(MUTED); mografy.textSize(Math.min(54, fontSize * .675));
  mografy.text('// draw the whole picture at time time', x0 + 80, y + 100, ctx.width - x0 - 160);
  mografy.textSize(fontSize); mografy.fill(p.ink); mografy.text('}', x0, y + 206, ctx.width - x0 - 80);
  // Caret: blinks twice a second, follows the typing.
  const caretX = x0 + mografy.textWidth(full.slice(0, shown)) + 6;
  if (time < 1.6 || Math.floor(time * 2) % 2 === 0) { mografy.opacity(vis); mografy.fill(p.accent); mografy.rect(time < 1.6 ? caretX : x0 + 42, time < 1.6 ? y - 64 : y + 146, 5, 76); }
  mografy.pop();
  caption(ctx, p.codeCaption, window_(time, 0.6, 1.0, 2.1, 2.5));
}

// ------------------------------------------------------------------ 2. play and scrub

/** The little animation inside the demo frame, drawn at demo time u (0–1.6 s). */
function miniScene(ctx: FrameContext, x: number, y: number, w: number, h: number, u: number, p: P) {
  const mografy = ctx.draw;
  const k = clamp(u / 1.6);
  // Three bars grow in turn.
  for (let i = 0; i < 3; i++) {
    const grow = ease.outExpo(pr(u, 0.15 + i * 0.25, 0.75 + i * 0.25));
    const bw = w * 0.11, bx = x + w * (0.16 + i * 0.15), bh = h * (0.22 + i * 0.16) * grow;
    mografy.fill(i === 2 ? p.accent : SCREEN_GREY);
    mografy.rect(bx, y + h * 0.82 - bh, bw, bh, 8);
  }
  // A ball arcs across the frame.
  const bx = lerp(x + w * 0.62, x + w * 0.88, ease.inOutCubic(k));
  const by = y + h * 0.82 - 18 - Math.abs(Math.sin(k * Math.PI * 2)) * h * 0.42;
  mografy.fill(SCREEN_INK); mografy.circle(bx, by, 36);
  mografy.stroke(LINE); mografy.strokeWeight(2);
  mografy.line(x + w * 0.1, y + h * 0.82, x + w * 0.9, y + h * 0.82);
}

/** Demo time: plays forward, then scrubs back and forth. */
function demoTime(time: number) {
  if (time < 4.6) return clamp(time - 3.0, 0, 1.6);
  const s = pr(time, 4.6, 6.3);
  return 1.6 * (0.5 + 0.5 * Math.cos(s * Math.PI * 3));
}

function beatScrub(ctx: FrameContext, time: number, p: P) {
  const vis = window_(time, 2.4, 3.0, 6.4, 6.9);
  if (vis <= 0) return;
  const canvas = ctx.canvas, mografy = ctx.draw, cx = ctx.width / 2;
  const grow = ease.outExpo(pr(time, 2.4, 3.2)), leave = ease.inOutCubic(pr(time, 6.4, 6.9));
  const w = 1000 * lerp(0.86, 1, grow) * (1 - 0.1 * leave), h = w * 9 / 16;
  const x = cx - w / 2 + leave * 160, y = 150;
  const u = demoTime(time);
  mografy.push(); mografy.opacity(vis);
  ctx.shadow(SHADOW, 40, 0, 18);
  mografy.fill(SCREEN); mografy.rect(x, y, w, h, 14);
  ctx.shadow('transparent', 0);
  ctx.clip(roundRect(x, y, w, h, 14), () => miniScene(ctx, x, y, w, h, u, p));
  // Timeline strip with frame ticks and the amber playhead.
  const ty = y + h + 42, tw = w;
  mografy.fill(PANEL); mografy.rect(x, ty, tw, 40, 8);
  mografy.fill('rgba(0,0,0,0.16)');
  for (let f = 0; f <= 48; f++) mografy.rect(x + (tw * f) / 48, ty + (f % 8 === 0 ? 6 : 26), 1.5, f % 8 === 0 ? 28 : 8);
  const px = x + tw * (u / 1.6);
  mografy.fill(p.accent); mografy.rect(px - 2, ty - 14, 4, 68);
  mografy.triangle(px - 10, ty - 22, px + 10, ty - 22, px, ty - 8);
  mografy.textFont(FONT); mografy.textSize(30); mografy.fill(p.ink); mografy.textAlign('right');
  mografy.text(`time = ${u.toFixed(2)} s`, x + tw, ty + 86);
  mografy.pop();
  caption(ctx, p.playCaption, window_(time, 3.1, 3.5, 4.4, 4.7) * vis);
  caption(ctx, p.scrubCaption, window_(time, 4.7, 5.1, 6.3, 6.6) * vis);
}

// ------------------------------------------------------------------ 3. chat → player

function beatChat(ctx: FrameContext, time: number, p: P) {
  const vis = window_(time, 6.8, 7.3, 9.4, 9.9);
  if (vis <= 0) return;
  const canvas = ctx.canvas, mografy = ctx.draw;
  mografy.push(); mografy.opacity(vis);

  // Player on the right.
  const px = 960, py = 200, pw = 800, ph = pw * 9 / 16, mid = py + ph / 2;
  ctx.shadow(SHADOW, 40, 0, 18);
  mografy.fill(SCREEN); mografy.rect(px, py, pw, ph, 14);
  ctx.shadow('transparent', 0);

  // Chat on the left: the request as a right-aligned bubble sized to its text,
  // laid out from the full sentence so nothing shifts while it types.
  const left = 140, right = 860, pad = 32;
  let size = 40;
  mografy.textFont(FONT); mografy.textSize(size); mografy.textAlign('left', 'top');
  let lines = wrap(mografy, p.request, right - left - pad * 2);
  while (lines.length * size * 1.35 > 440 && size > 8) {
    size -= 2; mografy.textSize(size);
    lines = wrap(mografy, p.request, right - left - pad * 2);
  }
  const lh = size * 1.35;
  const bw = Math.min(right - left, Math.max(...lines.map(l => mografy.textWidth(l))) + pad * 2);
  const bh = pad * 2 + size + (lines.length - 1) * lh;
  const replyGap = 44, replyH = 40, blockH = bh + replyGap + replyH;
  const top = mid - blockH / 2, bx = right - bw;
  const ask = ease.outCubic(pr(time, 7.2, 7.6));
  mografy.opacity(vis * ask);
  mografy.fill(PANEL); mografy.rect(bx, top + (1 - ask) * 20, bw, bh, 26);
  let remaining = Math.floor(lerp(0, p.request.length, pr(time, 7.3, 8.1)));
  mografy.fill(p.ink);
  lines.forEach((line, i) => {
    const shown = line.slice(0, Math.max(0, remaining));
    remaining -= line.length + 1;
    if (shown) mografy.text(shown, bx + pad, top + (1 - ask) * 20 + pad + i * lh);
  });

  // Claude's reply: a check and one short line under the bubble.
  const reply = ease.outCubic(pr(time, 8.3, 8.7));
  const ry = top + bh + replyGap + replyH / 2;
  mografy.opacity(vis * reply);
  mografy.stroke(p.accent); mografy.strokeWeight(5); mografy.strokeCap('round'); mografy.strokeJoin('round');
  canvas.beginPath(); canvas.moveTo(left + 2, ry); canvas.lineTo(left + 14, ry + 12); canvas.lineTo(left + 36, ry - 12); canvas.stroke(); mografy.noStroke();
  mografy.textSize(34); mografy.textAlign('left', 'middle'); mografy.fill(MUTED);
  mografy.text('Claude updated scenes/main.ts', left + 56, ry, right - left - 56);
  mografy.opacity(vis);

  // Title inside the player: ink before the update, accent after, with a slower rise.
  const swap = ease.inOutCubic(pr(time, 8.6, 9.0));
  const rise = swap < 1 ? ease.outExpo(pr(time, 7.3, 7.8)) : ease.outCubic(pr(time, 8.6, 9.3));
  mografy.textSize(120); mografy.textAlign('center', 'middle');
  mografy.fill(colorLerp(SCREEN_INK, p.accent, swap, 'linear'));
  mografy.text('Hello', px + pw / 2, mid + 10 + (1 - rise) * 40, pw - 80);

  // "Updated" toast, sized to its label.
  const toast = window_(time, 8.6, 8.8, 9.3, 9.5);
  if (toast > 0) {
    mografy.textSize(28);
    const tw = Math.min(pw - 80, mografy.textWidth('Updated') + 48), th = 50;
    mografy.opacity(vis * toast); mografy.fill(p.accent);
    mografy.rect(px + (pw - tw) / 2, py + 28, tw, th, th / 2);
    mografy.fill('#04201c'); mografy.text('Updated', px + pw / 2, py + 28 + th / 2 + 1, tw - 48);
  }
  mografy.pop();
  caption(ctx, p.chatCaption, window_(time, 7.4, 7.8, 9.4, 9.8));
}

function wrap(mografy: DrawingApi, text: string, width: number) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const character of paragraph) {
      if (line && mografy.textWidth(line + character) > width) {
        const space = line.lastIndexOf(' ');
        if (space > 0) { lines.push(line.slice(0, space)); line = line.slice(space + 1); }
        else { lines.push(line); line = ''; }
      }
      line += character;
    }
    lines.push(line);
  }
  return lines;
}

// ------------------------------------------------------------------ 4. the logo

/** Draw one logo piece revealed by a clip rectangle that grows from the bottom or from the left. */
function revealPiece(ctx: FrameContext, piece: (typeof LOGO)[number], color: string, k: number, from: 'bottom' | 'left', lift: number) {
  if (k <= 0) return;
  const [x, y, w, h] = piece.box;
  const path = new Path2D();
  if (from === 'bottom') path.rect(x - 4, y + h * (1 - k) - 4, w + 8, h * k + 8);
  else path.rect(x - 4, y - 4, w * k + 8, h + 8);
  ctx.clip(path, () => {
    const canvas = ctx.canvas;
    canvas.translate(0, (1 - k) * lift);
    canvas.fillStyle = color; canvas.fill(piece.path, 'evenodd');
  });
}

function beatLogo(ctx: FrameContext, time: number, p: P) {
  if (time < 9.85) return;
  const canvas = ctx.canvas, mografy = ctx.draw;
  const [x0, y0, x1, y1] = LOGO_BOX, w = x1 - x0, h = y1 - y0;
  const scale = 1180 / w, top = 400 - (h * scale) / 2;
  mografy.push();
  mografy.translate((ctx.width - w * scale) / 2 - x0 * scale, top - y0 * scale);
  mografy.scale(scale, scale);
  // On the music hit (9.9): the left arch rises, the ribbon flows across, the right arch lands.
  const [left, ribbon, right, ...letters] = LOGO;
  revealPiece(ctx, left!, p.ink, ease.outExpo(pr(time, 9.9, 10.45)), 'bottom', 40);
  revealPiece(ctx, ribbon!, p.accent, ease.inOutCubic(pr(time, 10.0, 10.6)), 'left', 0);
  revealPiece(ctx, right!, p.ink, ease.outExpo(pr(time, 10.12, 10.7)), 'bottom', 40);
  // The letters of the wordmark rise in one after another.
  letters.forEach((letter, i) => {
    const k = ease.outExpo(pr(time, 10.45 + i * 0.05, 11.1 + i * 0.05));
    if (k <= 0) return;
    mografy.push(); mografy.opacity(k); mografy.translate(0, (1 - k) * 36);
    mografy.fill(p.ink); mografy.path(letter.path, 'evenodd');
    mografy.pop();
  });
  mografy.pop();
  const tag = ease.outCubic(pr(time, 11.1, 11.5));
  if (tag > 0) {
    mografy.push(); mografy.opacity(tag);
    mografy.textFont(FONT); mografy.textSize(52); mografy.fill(MUTED); mografy.textAlign('center');
    const lines = wrap(mografy, p.tagline, ctx.width - 240);
    const lineHeight = Math.min(64, 180 / Math.max(1, lines.length));
    mografy.textSize(Math.min(52, lineHeight * .82));
    lines.forEach((line, i) => mografy.text(line, ctx.width / 2, top + h * scale + 150 + i * lineHeight + (1 - tag) * 14, ctx.width - 240));
    mografy.pop();
  }
}

export function renderFrame(ctx: FrameContext, time: number, input: Readonly<Record<string, unknown>>) {
  const p = input as unknown as P;
  beatCode(ctx, time, p);
  beatScrub(ctx, time, p);
  beatChat(ctx, time, p);
  beatLogo(ctx, time, p);
  ctx.vignette(p.vignette);
}
