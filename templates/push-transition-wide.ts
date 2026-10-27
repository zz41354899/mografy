// Push transition: a vertical edge of spectrum light sweeps from right to left. Behind it the outgoing picture is
// pushed away to the left at a slower pace, while the incoming picture slides in under the mask and settles; the
// edge leaves the frame and the new picture holds.
import type { FrameContext } from '@mografy/runtime';
import { safeGuide, safeParam, stage, type C2D, type TemplateInfo } from './kit.js';
import { APP, H, K, P, SPEC, W, appUI, bloom, eio, glow, ground, kin, lerp, look, montageParams, rgba, rr, specLinear, textW } from './montage.js';

export const template = {
  id: 'push-transition-wide', name: 'Push transition', category: 'transition', aspect: '16:9', pair: 'push-transition',
  summary: 'An edge of spectrum light wipes right to left: the old picture is pushed away, the new one slides in and holds.',
  agentHint: 'Cut between two landscape shots. The pictures are stand-ins: draw the outgoing shot in `pictureA` and the incoming one in `pictureB` (each is already offset). With backdrop false only the light edge and its shade are drawn. Titles under ~30 characters; the template ends on picture B, so the next shot starts from it.',
  principles: ['timing', 'slow in and slow out', 'overlapping action', 'staging'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 2.4, fps: 30, background: '#06080C' };

export const params = {
  from: { name: 'Outgoing title', type: 'string' as const, default: 'This week at a glance' },
  to: { name: 'Incoming title', type: 'string' as const, default: 'Reports that [write themselves].' },
  ...montageParams('night'), ...safeParam,
};

/** The sweep: when the edge leaves the right side and when it has left the frame. */
const GO = .55, DONE = 1.5;
/** How far each picture travels with the edge (A is pushed out at 40 % of the edge's pace, B slides in from 22 %). */
const PUSH_A = .4, SLIDE_B = .22;

/** Outgoing stand-in: the product window under a quiet title, on the template's ground. */
function pictureA(c: C2D, p: Readonly<Record<string, unknown>>, time: number) {
  const lk = look(p);
  ground(c, p, time, { orbA: K.teal, orbB: K.violet });
  kin(c, String(p.from), W / 2, 190, 64, lk.ink, 9, { w: 600, tint: false });
  c.save(); c.translate(W / 2 - APP.w * .58 / 2, 300); c.scale(.58, .58);
  if (!lk.dark) { c.shadowColor = 'rgba(28,46,64,.14)'; c.shadowBlur = 60; c.shadowOffsetY = 24; }
  rr(c, 0, 0, APP.w, APP.h, 24); c.fillStyle = lk.dark ? '#0E1219' : '#FFFFFF'; c.fill(); c.shadowColor = 'transparent';
  appUI(c, { dark: lk.dark, t: 0, gen: 1 }); c.restore();
}
/** Incoming stand-in: a big title on the opposite ground, with the spectrum rule under it. */
function pictureB(c: C2D, p: Readonly<Record<string, unknown>>, time: number) {
  const other = { ...p, theme: look(p).dark ? 'light' : 'night' }, lk = look(other);
  ground(c, other, time, { orbA: K.sky, orbB: K.violet });
  const raw = String(p.to), a = raw.indexOf('['), b = raw.indexOf(']'), s = raw.replace(/[[\]]/g, ''), n0 = a < 0 ? -1 : a, n1 = b < 0 ? -1 : b - 1;
  const size = Math.min(104, 104 * 1500 / Math.max(1, textW(c, s, 104, 600)));
  const w = kin(c, s, W / 2, 500, size, lk.ink, 9, {
    w: 600, colAt: (i: number) => i >= n0 && i <= n1 ? 'fill' : lk.ink,
    fill: (x: C2D, x0: number) => specLinear(x, x0 + textW(x, s.slice(0, Math.max(0, n0)), size, 600), 0, x0 + textW(x, s.slice(0, n1 + 1), size, 600), 0, [K.teal, K.sky, K.violet]),
  });
  c.save(); c.fillStyle = specLinear(c, W / 2 - w * .3, 0, W / 2 + w * .3, 0, SPEC); rr(c, W / 2 - w * .3, 588, w * .6, 6, 3); c.fill(); c.restore();
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), overlay = p.backdrop === false;
  // the edge travels on one long ease, from just outside the right side to just outside the left
  const k = eio(P(time, GO, DONE)), e = lerp(W + 40, -40, k);
  stage(ctx, '16:9', c => {
    if (!overlay) {
      if (e > 0) { c.save(); c.beginPath(); c.rect(0, 0, Math.min(W, e), H); c.clip(); c.translate(-(W - Math.min(W, e)) * PUSH_A, 0); pictureA(c, p, time); c.restore(); }
      if (e < W) { c.save(); c.beginPath(); c.rect(Math.max(0, e), 0, W - Math.max(0, e), H); c.clip(); c.translate(Math.max(0, e) * SLIDE_B, 0); pictureB(c, p, time); c.restore(); }
    }
    if (k > 0 && k < 1) {
      // the incoming picture lies over the outgoing one: a soft shade on the outgoing side of the edge
      const sh = c.createLinearGradient(e - 220, 0, e, 0); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, `rgba(0,0,0,${lk.dark ? .45 : .2})`);
      c.fillStyle = sh; c.fillRect(e - 220, 0, 220, H);
      // the edge itself: a spectrum line with a white core, bloomed, brightest mid-sweep
      const a = Math.sin(Math.PI * k) ** .5;
      const edge = (x: C2D) => { x.fillStyle = specLinear(x, 0, 0, 0, H, SPEC); x.fillRect(e - 3, 0, 6, H); x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(e - 1, 0, 2, H); };
      c.save(); c.globalAlpha *= a; edge(c); c.restore();
      bloom(c, edge, { radius: 18, strength: 1.3 * a, halo: 1, bounds: [Math.round(e / 8) * 8 - 64, 0, 128, H] });
      c.save(); c.globalCompositeOperation = lk.dark ? 'lighter' : 'source-over'; glow(c, e, H / 2, 420, K.sky, .12 * a); c.restore();
    }
    // a faint smear of the light along the path just travelled
    if (k > 0 && k < 1) { const tr = c.createLinearGradient(e, 0, e + 360, 0); tr.addColorStop(0, rgba(K.violet, .14 * Math.sin(Math.PI * k))); tr.addColorStop(1, rgba(K.violet, 0)); c.fillStyle = tr; c.fillRect(e, 0, 360, H); }
    safeGuide(c, '16:9', p.safeGuide);
  });
}
