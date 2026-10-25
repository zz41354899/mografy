import { colorLerp, clamp, pr } from '@mografy/runtime';
import type { FrameContext } from '@mografy/runtime';
import { setupFrame, scope, at, spring, inOut, inOutQuart, outQuint, mix, rr, surface, stroke, text, measure, cursor, check, arc2 } from './kit.js';

export const meta = { width: 1920, height: 1080, duration: 8, fps: 30, background: '#E8F5EF' };
export const params = { accent: { name: 'Accent', type: 'color' as const, default: '#12B5A5' } };
export async function setup() {}

const INK = '#14201B', MUTED = '#76837D';
const CARD = { x: 520, y: 400, w: 880, h: 200 };
const BTN_RIGHT = CARD.x + CARD.w - 48, BTN_CY = CARD.y + CARD.h / 2, BTN_H = 84;

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  setupFrame(ctx);
  const accent = String(p.accent);
  ctx.draw.translate(960, 540); ctx.draw.scale(1.24); ctx.draw.translate(-960, -560);

  // Soft light pooling at the center keeps the eye on the card.
  scope(ctx, c => {
    const g = c.createRadialGradient(960, 520, 0, 960, 520, 900);
    g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(-400, -400, 2720, 1880);
  });

  // ── Timing ───────────────────────────────────────────────
  const back = at(time, 7.35, 7.9, inOutQuart);              // reset to Follow
  const hover = at(time, 1.32, 1.6) * (1 - at(time, 1.95, 2.3));
  const press = Math.sin(pr(time, 1.78, 2.0) * Math.PI);
  const state = spring(time, 1.96, .62, .16) * (1 - back);   // Follow → Following
  const tone = clamp(at(time, 1.96, 2.3, inOut) * (1 - back), 0, 1);
  const tick = outQuint(pr(time, 2.12, 2.55)) * (1 - back);
  const ring = at(time, 2.15, 2.85, inOutQuart) * (1 - at(time, 7.2, 7.5, inOut));
  const toast = spring(time, 2.42, .6, .2) * (1 - at(time, 7.15, 7.45, inOut));

  // Card
  const card = rr(CARD.x, CARD.y, CARD.w, CARD.h, 36);
  surface(ctx, card, '#FFFFFF', 1.2, '16, 60, 48');

  // Avatar with a follow ring that completes once you follow
  const ax = CARD.x + 100, ay = BTN_CY;
  scope(ctx, c => {
    const g = c.createLinearGradient(ax - 52, ay - 52, ax + 52, ay + 52);
    g.addColorStop(0, '#7FE0D2'); g.addColorStop(1, '#0E9E90');
    c.fillStyle = g; c.beginPath(); c.arc(ax, ay, 52, 0, Math.PI * 2); c.fill();
    // simple abstract portrait: head + shoulders
    c.save(); c.beginPath(); c.arc(ax, ay, 52, 0, Math.PI * 2); c.clip();
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.beginPath(); c.arc(ax, ay - 10, 18, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(ax, ay + 44, 36, 28, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    if (ring > 0) {
      c.strokeStyle = accent; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.arc(ax, ay, 62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ring); c.stroke();
    }
  });
  text(ctx, 'Mira Chen', ax + 88, ay - 20, { size: 40, weight: 600, color: INK, tracking: -.8 });
  text(ctx, 'Motion designer', ax + 88, ay + 26, { size: 26, weight: 500, color: MUTED });

  // Button — width morphs with a spring; fill turns from solid teal to a quiet confirmed state.
  const wFollow = 236, wFollowing = 290;
  const w = mix(wFollow, wFollowing, state);
  const bx = BTN_RIGHT - w, by = BTN_CY - BTN_H / 2;
  const bcx = bx + w / 2;
  const scaleB = 1 + hover * .025 - press * .06;
  scope(ctx, c => {
    c.translate(bcx, BTN_CY); c.scale(scaleB, scaleB); c.translate(-bcx, -BTN_CY);
    const pill = rr(bx, by, w, BTN_H, BTN_H / 2);
    const fill = colorLerp(colorLerp(accent, '#0FA595', hover), '#E4F6F1', tone);
    surface(ctx, pill, fill, mix(.5, .08, tone), '10, 120, 100');
    if (tone > 0) stroke(ctx, pill, `rgba(10, 138, 125, ${.28 * tone})`, 2);
    // Ripple from the click point
    const rip = pr(time, 1.86, 2.55);
    if (rip > 0 && rip < 1) ctx.clip(pill, () => scope(ctx, c2 => {
      c2.fillStyle = `rgba(255,255,255,${.35 * (1 - rip)})`; c2.beginPath(); c2.arc(bcx + 62, BTN_CY + 14, 30 + outQuint(rip) * 190, 0, Math.PI * 2); c2.fill();
    }));
    // Labels: Follow slides up and out, Following slides up into place.
    ctx.clip(pill, () => {
      const out = clamp(state, 0, 1.2);
      const fw = measure(ctx, 'Follow', { size: 31, weight: 600, color: '' });
      scope(ctx, c2 => {
        c2.globalAlpha = clamp(1 - out * 1.6, 0, 1);
        const lx = bcx - (fw + 34) / 2, ly = BTN_CY - out * 34;
        c2.strokeStyle = '#FFFFFF'; c2.lineWidth = 3.6; c2.lineCap = 'round';
        c2.beginPath(); c2.moveTo(lx + 1, ly); c2.lineTo(lx + 19, ly); c2.moveTo(lx + 10, ly - 9); c2.lineTo(lx + 10, ly + 9); c2.stroke();
        text(ctx, 'Follow', lx + 34, ly + 1, { size: 31, weight: 600, color: '#FFFFFF' });
      });
      const gw = measure(ctx, 'Following', { size: 31, weight: 600, color: '' });
      scope(ctx, c2 => {
        c2.globalAlpha = clamp((out - .2) * 1.6, 0, 1);
        const lx = bcx - (gw + 42) / 2, ly = BTN_CY + (1 - clamp(out, 0, 1)) * 34;
        check(ctx, lx + 13, ly + 1, 26, '#0A8A7D', tick, 4);
        text(ctx, 'Following', lx + 42, ly + 1, { size: 31, weight: 600, color: '#0A8A7D' });
      });
    });
  });

  // A few short accents spark from the button edge — small, quick, gone.
  const spark = pr(time, 1.98, 2.5);
  if (spark > 0 && spark < 1) scope(ctx, c => {
    c.strokeStyle = accent; c.lineCap = 'round'; c.lineWidth = 4 * (1 - spark);
    const cx = BTN_RIGHT - wFollowing / 2, r0 = 160 + outQuint(spark) * 34, len = 22 * (1 - spark * .6);
    [-.95, -.62, -.3, .3, .62, .95].forEach(a => {
      const ang = a * .9 - Math.PI / 2 + (a > 0 ? 0 : 0);
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const rx = r0, ry = r0 * .42;
      c.beginPath(); c.moveTo(cx + dx * rx, BTN_CY + dy * ry); c.lineTo(cx + dx * (rx + len), BTN_CY + dy * (ry + len * .7)); c.stroke();
    });
  });

  // Confirmation beneath the card
  if (toast > 0.001) scope(ctx, c => {
    const tw = 380, th = 76, tx = 960 - tw / 2, ty = CARD.y + CARD.h + 52;
    c.globalAlpha = clamp(toast * 1.3, 0, 1);
    c.translate(0, (1 - toast) * 26);
    surface(ctx, rr(tx, ty, tw, th, th / 2), '#FFFFFF', .8, '16, 60, 48');
    c.fillStyle = accent; c.beginPath(); c.arc(tx + 44, ty + th / 2, 19, 0, Math.PI * 2); c.fill();
    check(ctx, tx + 44, ty + th / 2, 20, '#FFFFFF', outQuint(pr(time, 2.6, 2.95)), 3.4);
    text(ctx, 'You’re following.', tx + 78, ty + th / 2 + 1, { size: 27, weight: 500, color: INK });
  });

  // Cursor: approaches on a gentle arc, pauses, clicks, steps aside.
  const target: [number, number] = [BTN_RIGHT - wFollow / 2 + 62, BTN_CY + 14];
  const approach = at(time, .35, 1.32, inOutQuart);
  const [x0, y0] = arc2(1560, 900, 1560, 620, target[0], target[1], approach);
  const leave = at(time, 2.75, 3.45, inOut);
  const x = x0 + leave * 120, y = y0 + leave * 170;
  cursor(ctx, x, y, at(time, .3, .55) * (1 - at(time, 2.95, 3.45, inOut)), press);
}
