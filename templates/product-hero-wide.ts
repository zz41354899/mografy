// Product hero: on the light ground of the montage, the name sharpens in from a spectrum blur, the tagline follows,
// two pills land (one with the spectrum rim), and the product window swings in on a tilted 3D plane and settles.
import type { FrameContext } from '@mografy/runtime';
import { exitOf, safeGuide, safeParam, spring, stage, type TemplateInfo } from './kit.js';
import { APP, K, P, appUI, card3d, clamp, conic, eio, eo, ground, kin, lerp, look, montageParams, rr, setFont, specWord, textW } from './montage.js';

export const template = {
  id: 'product-hero-wide', name: 'Product hero', category: 'hook', aspect: '16:9',
  summary: 'The name sharpens out of a spectrum blur, two pills land, and the product window swings in on a tilted plane.',
  agentHint: 'Opening of a landing-page loop, Product Hunt or YouTube demo. Name 1–2 words, tagline under ~40 characters, button labels 1–3 words. The window is a stand-in: redraw it in `appUI` or draw a screenshot into the same 1400 × 860 card.',
  principles: ['staging', 'overlapping action', 'slow in and slow out', 'appeal'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 5, fps: 30, background: '#F4F6F8' };

export const params = {
  name: { name: 'Product name', type: 'string' as const, default: 'Northwind' },
  tagline: { name: 'Tagline', type: 'string' as const, default: 'Your whole week in one calm view.' },
  kicker: { name: 'Kicker', type: 'string' as const, default: 'New · Version 2' },
  primary: { name: 'Primary button', type: 'string' as const, default: 'Start free' },
  secondary: { name: 'Secondary button', type: 'string' as const, default: 'Watch the film' },
  ...montageParams('light'), ...safeParam,
};

const LX = 150;

function pill(c: CanvasRenderingContext2D, x: number, y: number, label: string, k: number, primary: boolean, dark: boolean, flow: number) {
  if (k <= 0) return 0;
  setFont(c, 30, 600); const w = c.measureText(label).width + 92 + (primary ? 38 : 0), h = 84;
  c.save(); c.globalAlpha *= clamp(k * 1.5); c.translate(x + w / 2, y + h / 2); c.scale(lerp(.9, 1, k), lerp(.9, 1, k)); c.translate(-w / 2, -h / 2);
  if (primary) {
    c.shadowColor = 'rgba(20,24,32,.22)'; c.shadowBlur = 30; c.shadowOffsetY = 10;
    rr(c, 0, 0, w, h, h / 2); c.fillStyle = dark ? K.fg : K.ink; c.fill(); c.shadowColor = 'transparent';
    setFont(c, 30, 600); c.fillStyle = dark ? K.ink : '#FFFFFF'; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText(label, 46, h / 2 + 1);
    // arrow
    const ax = w - 60; c.strokeStyle = dark ? K.ink : '#FFFFFF'; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(ax, h / 2); c.lineTo(ax + 20, h / 2); c.moveTo(ax + 11, h / 2 - 9); c.lineTo(ax + 20, h / 2); c.lineTo(ax + 11, h / 2 + 9); c.stroke();
  } else {
    rr(c, 0, 0, w, h, h / 2); c.fillStyle = dark ? '#0B0E14' : '#FFFFFF'; c.fill();
    rr(c, 0, 0, w, h, h / 2); c.strokeStyle = conic(c, w / 2, h / 2, flow); c.lineWidth = 2.6; c.stroke();
    setFont(c, 30, 600); c.fillStyle = dark ? K.fg : K.ink; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText(label, 46, h / 2 + 1);
  }
  c.restore();
  return w;
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), d = meta.duration, out = exitOf(time, d, .55), flow = time * .55;
  stage(ctx, '16:9', c => {
    ground(c, p, time);
    // The window swings in from the right on a tilted plane and settles at a gentle angle; on the way out it recedes.
    const k = eo(P(time, .55, 1.9)), sp = spring(time, .55, .9, .06), back = eio(P(time, d - .6, d));
    const o = { u: APP.w / 2, v: APP.h / 2, px: lerp(2380, 1430, sp) + back * 120, py: lerp(600, 560, k), s: .6 * lerp(.92, 1, k) * lerp(1, .94, back),
      yaw: lerp(-.62, -.26, k), pitch: lerp(.08, .04, k), roll: lerp(.02, 0, k) };
    if (time > .5) card3d(c, 'hero-app', APP.w, APP.h, o, x => appUI(x, { dark: lk.dark, t: time, gen: P(time, 1.0, 2.4) }), clamp(P(time, .55, .8)) * (1 - out), lk.dark);

    kin(c, String(p.kicker), LX, 330, 28, lk.g === 'light' ? '#0F9C8E' : '#7FE3D2', time - .15, { al: 'left', w: 600, tint: false, out });
    const name = String(p.name);
    kin(c, name, LX - 6, 440, 150, lk.ink, time - .3, { al: 'left', w: 700, st: .04, out, ...specWord('', name, 150, 700, [K.teal, K.sky, K.violet]) });
    // The tagline wraps to two lines when it is long.
    const words = String(p.tagline).split(' '), lines: string[] = []; let ln = '';
    for (const w of words) { const nx = ln ? `${ln} ${w}` : w; if (ln && textW(c, nx, 44, 500) > 780) { lines.push(ln); ln = w; } else ln = nx; }
    lines.push(ln);
    lines.slice(0, 2).forEach((s, i) => kin(c, s, LX, 560 + i * 62, 44, lk.mut, time - .75 - i * .1, { al: 'left', tint: false, st: .012, out }));
    const by = 560 + Math.min(2, lines.length) * 62 + 40;
    c.save(); c.globalAlpha *= 1 - out;
    const w1 = pill(c, LX, by, String(p.primary), spring(time, 1.25, .5, .15), true, lk.dark, flow);
    pill(c, LX + w1 + 20, by, String(p.secondary), spring(time, 1.4, .5, .15), false, lk.dark, flow);
    c.restore();
    safeGuide(c, '16:9', p.safeGuide);
  });
}
