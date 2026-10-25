import { colorLerp, lerp, pr, clamp } from '@mografy/runtime';
import type { FrameContext } from '@mografy/runtime';
import { setupFrame, scope, at, spring, inOut, inOutQuart, outQuint, mix, rr, surface, stroke, text, figures, cursor, arc2 } from './kit.js';

export const meta = { width: 1920, height: 1080, duration: 8, fps: 30, background: '#F7F6F2' };
export const params = { accent: { name: 'Accent', type: 'color' as const, default: '#12B5A5' } };
export async function setup() {}

const INK = '#141816', MUTED = '#7A807C', FAINT = '#A9ADA8', LINE = '#ECEAE4', SIDEBAR = '#F4F3EF';
const WIN = { x: 250, y: 150, w: 1420, h: 780 };
const SIDE_W = 268;
const SEG = { x: 1220, y: 206, w: 380, h: 66 };
const BEFORE = [148, 196, 172, 232, 214, 262, 240];
const AFTER = [196, 238, 262, 304, 296, 356, 338];
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const FROM = 12480, TO = 18906;
const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));

function icon(ctx: FrameContext, kind: number, x: number, y: number, color: string) {
  scope(ctx, c => {
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 2.6; c.lineCap = 'round'; c.lineJoin = 'round';
    if (kind === 0) { for (const [dx, dy] of [[0, 0], [12, 0], [0, 12], [12, 12]]) c.stroke(rr(x - 11 + dx!, y - 11 + dy!, 9, 9, 2.5)); }
    if (kind === 1) { c.beginPath(); c.arc(x, y - 5, 5.5, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(x, y + 13, 10, Math.PI * 1.12, Math.PI * 1.88); c.stroke(); }
    if (kind === 2) { [[-8, 4], [0, -2], [8, -8]].forEach(([dx, top]) => { c.beginPath(); c.moveTo(x + dx!, y + 10); c.lineTo(x + dx!, y + top!); c.stroke(); }); }
    if (kind === 3) { c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill(); }
  });
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  setupFrame(ctx);
  const accent = String(p.accent);

  // ── Timing ───────────────────────────────────────────────
  const hover = at(time, 1.3, 1.6) * (1 - at(time, 1.95, 2.3));
  const press = Math.sin(pr(time, 1.72, 1.94) * Math.PI);
  const pill = spring(time, 1.86, .55, .12) * (1 - at(time, 7.3, 7.85, inOutQuart));
  const count = outQuint(pr(time, 2.0, 3.7));
  const chip = spring(time, 2.75, .5, .2) * (1 - at(time, 7.25, 7.5, inOut));
  const focus = at(time, 2.8, 4.1, inOutQuart) * (1 - at(time, 7.25, 7.95, inOutQuart));
  const tip = spring(time, 3.65, .5, .16) * (1 - at(time, 7.25, 7.42, inOut));

  // Gentle focus: a small push-in toward the result while secondary UI quiets.
  scope(ctx, c => {
    const zoom = 1 + focus * .055, fx = 1110, fy = 590;
    c.translate(fx, fy); c.scale(zoom, zoom); c.translate(-fx, -fy);
    c.translate(-focus * 18, 0);

    const win = rr(WIN.x, WIN.y, WIN.w, WIN.h, 30);
    surface(ctx, win, '#FFFFFF', 1.1);
    stroke(ctx, win, LINE, 1.5);

    // Sidebar — quiets during focus
    scope(ctx, c2 => {
      c2.globalAlpha = 1 - focus * .62;
      ctx.clip(win, () => {
        scope(ctx, c3 => { c3.fillStyle = SIDEBAR; c3.fillRect(WIN.x, WIN.y, SIDE_W, WIN.h); c3.fillStyle = LINE; c3.fillRect(WIN.x + SIDE_W, WIN.y, 1.5, WIN.h); });
      });
      scope(ctx, c3 => { c3.fillStyle = accent; c3.fill(rr(WIN.x + 34, WIN.y + 38, 44, 44, 12)); });
      scope(ctx, c3 => { c3.strokeStyle = '#FFFFFF'; c3.lineWidth = 4; c3.lineCap = 'round'; c3.beginPath(); c3.moveTo(WIN.x + 46, WIN.y + 68); c3.lineTo(WIN.x + 54, WIN.y + 58); c3.lineTo(WIN.x + 60, WIN.y + 64); c3.lineTo(WIN.x + 67, WIN.y + 52); c3.stroke(); });
      text(ctx, 'Pulse', WIN.x + 94, WIN.y + 61, { size: 26, weight: 600, color: INK, tracking: -.3 });
      ['Overview', 'Audience', 'Reports', 'Settings'].forEach((label, i) => {
        const y = WIN.y + 158 + i * 66, active = i === 0;
        if (active) surface(ctx, rr(WIN.x + 20, y - 26, SIDE_W - 40, 52, 14), '#FFFFFF', .35);
        icon(ctx, i, WIN.x + 52, y, active ? accent : '#9DA29D');
        text(ctx, label, WIN.x + 80, y + 1, { size: 21, weight: active ? 600 : 500, color: active ? INK : '#8B908B' });
      });
      scope(ctx, c3 => { c3.fillStyle = '#E3E1DA'; c3.beginPath(); c3.arc(WIN.x + 54, WIN.y + WIN.h - 56, 18, 0, Math.PI * 2); c3.fill(); });
      text(ctx, 'Studio team', WIN.x + 84, WIN.y + WIN.h - 55, { size: 19, weight: 500, color: '#8B908B' });
    });

    const left = WIN.x + SIDE_W + 72;
    // Header
    text(ctx, 'Overview', left, WIN.y + 90, { size: 40, weight: 600, color: INK, tracking: -1, alpha: 1 - focus * .55 });

    // Segmented control: Last week | This week
    scope(ctx, c2 => {
      const cx = SEG.x + SEG.w / 2, cy = SEG.y + SEG.h / 2, s = 1 - press * .012;
      c2.globalAlpha = 1 - focus * .4;
      c2.translate(cx, cy); c2.scale(s, s); c2.translate(-cx, -cy);
      c2.fillStyle = '#F1F0EC'; c2.fill(rr(SEG.x, SEG.y, SEG.w, SEG.h, 16));
      const half = (SEG.w - 10) / 2;
      if (hover > 0) { c2.save(); c2.globalAlpha *= hover * .7; c2.fillStyle = '#E7E6E1'; c2.fill(rr(SEG.x + 5 + half, SEG.y + 5, half, SEG.h - 10, 12)); c2.restore(); }
      const px = SEG.x + 5 + half * pill;
      const stretch = Math.sin(clamp(pill, 0, 1) * Math.PI) * 18;
      surface(ctx, rr(px - stretch / 2, SEG.y + 5, half + stretch, SEG.h - 10, 12), '#FFFFFF', .45);
      text(ctx, 'Last week', SEG.x + 5 + half / 2, cy + 1, { size: 23, weight: 600, color: colorLerp(INK, MUTED, clamp(pill, 0, 1)), align: 'center' });
      text(ctx, 'This week', SEG.x + 5 + half * 1.5, cy + 1, { size: 23, weight: 600, color: colorLerp(colorLerp(MUTED, '#454B47', hover), INK, clamp(pill, 0, 1)), align: 'center' });
    });

    // Metric
    const my = WIN.y + 268;
    text(ctx, 'Active visitors', left, my, { size: 24, weight: 500, color: MUTED });
    const value = lerp(FROM, TO, count);
    const resetSwap = at(time, 7.3, 7.78, inOut);
    if (resetSwap <= 0) figures(ctx, fmt(value), left - 4, my + 92, { size: 104, weight: 600, family: 'Inter Display', color: INK, tracking: -2.5 });
    else {
      ctx.clip(rr(left - 20, my + 36, 520, 112, 0), () => {
        figures(ctx, fmt(TO), left - 4, my + 92 - resetSwap * 112, { size: 104, weight: 600, family: 'Inter Display', color: INK, tracking: -2.5, alpha: 1 - resetSwap });
        figures(ctx, fmt(FROM), left - 4, my + 92 + (1 - resetSwap) * 112, { size: 104, weight: 600, family: 'Inter Display', color: INK, tracking: -2.5, alpha: resetSwap });
      });
    }
    // Delta chip
    scope(ctx, c2 => {
      if (chip <= 0.001) return;
      const s = .85 + .15 * chip, x0 = left, y0 = my + 168;
      c2.globalAlpha = clamp(chip, 0, 1);
      c2.translate(x0, y0 + 22); c2.scale(s, s); c2.translate(-x0, -(y0 + 22));
      c2.fillStyle = '#E2F5F0'; c2.fill(rr(x0, y0, 148, 44, 22));
      c2.strokeStyle = '#0A8A7D'; c2.lineWidth = 2.6; c2.lineCap = 'round'; c2.lineJoin = 'round';
      c2.beginPath(); c2.moveTo(x0 + 24, y0 + 28); c2.lineTo(x0 + 31, y0 + 16); c2.lineTo(x0 + 38, y0 + 28); c2.stroke();
      text(ctx, '+51.5%', x0 + 50, y0 + 23, { size: 21, weight: 600, color: '#0A8A7D' });
      text(ctx, 'vs. last week', x0 + 166, y0 + 23, { size: 20, weight: 500, color: FAINT });
    });
    // Small context row, quiet
    scope(ctx, c2 => {
      c2.globalAlpha = 1 - focus * .7;
      const y0 = WIN.y + WIN.h - 120;
      [['Avg. session', '3m 42s'], ['Returning', '38%']].forEach(([k, v], i) => {
        text(ctx, k!, left + i * 210, y0, { size: 19, weight: 500, color: FAINT });
        text(ctx, v!, left + i * 210, y0 + 38, { size: 28, weight: 600, color: '#3A403C', tracking: -.5 });
      });
    });

    // Chart
    const base = WIN.y + 640, barW = 54, gap = 24, cx0 = 1600 - (7 * (barW + gap) - gap);
    scope(ctx, c2 => { c2.fillStyle = LINE; [0, 1, 2, 3].forEach(i => c2.fillRect(cx0 - 24, base - i * 120, 7 * (barW + gap) - gap + 24, i ? 1.2 : 2)); });
    BEFORE.forEach((b, i) => {
      const grow = spring(time, 2.02 + i * .07, .62, .16) * (1 - at(time, 7.3 + i * .025, 7.8 + i * .02, inOut));
      const h = mix(b, AFTER[i]!, grow), x = cx0 + i * (barW + gap);
      const tone = clamp(grow, 0, 1);
      scope(ctx, c3 => {
        const g = c3.createLinearGradient(0, base - h, 0, base);
        g.addColorStop(0, colorLerp('#DCDAD3', accent, tone)); g.addColorStop(1, colorLerp('#E6E4DE', colorLerp(accent, '#7FD9CF', .55), tone));
        c3.fillStyle = g; c3.fill(rr(x, base - h, barW, h, [12, 12, 4, 4]));
      });
      text(ctx, DAYS[i]!, x + barW / 2, base + 34, { size: 19, weight: 500, color: FAINT, align: 'center' });
    });
    // Peak tooltip
    if (tip > 0.001) scope(ctx, c2 => {
      const i = 5, x = cx0 + i * (barW + gap) + barW / 2, h = AFTER[i]!, y = base - h - 26;
      c2.globalAlpha = clamp(tip, 0, 1);
      c2.translate(x, y + 8 * (1 - tip)); c2.scale(.9 + .1 * tip, .9 + .1 * tip);
      surface(ctx, rr(-66, -54, 132, 46, 12), '#18201D', .6);
      c2.fillStyle = '#18201D'; c2.beginPath(); c2.moveTo(-9, -9); c2.lineTo(0, 0); c2.lineTo(9, -9); c2.fill();
      text(ctx, '3,904', 0, -30, { size: 21, weight: 600, color: '#FFFFFF', align: 'center' });
    });
  });

  // Cursor: enters, rests on "This week", clicks, then drifts out of the way.
  const enter = at(time, .35, 1.4, inOutQuart);
  const [ex, ey] = arc2(1760, 880, 1700, 430, 1522, 246, enter);
  const leave = at(time, 2.35, 3.25, inOut);
  const x = ex + leave * 150, y = ey + leave * 210;
  cursor(ctx, x, y, at(time, .3, .6) * (1 - at(time, 2.7, 3.25, inOut)), press);
}
