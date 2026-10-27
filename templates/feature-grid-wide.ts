// Feature grid: under a kinetic headline, quiet glass cards rise into a grid. Then one comet of light runs around
// each card in turn; as it closes the loop the card lights up: its rim takes the spectrum, its icon its colour, its
// name sharpens to full ink. One moving focus at a time, then the lit grid holds.
import type { FrameContext } from '@mografy/runtime';
import { exitOf, safeGuide, safeParam, spring, stage, type C2D, type TemplateInfo } from './kit.js';
import { K, P, W, bloom, clamp, comet, conic, dot, eio, eo, glow, ground, kin, layer, lerp, look, mixc, mkPath, montageParams, pAt, rgba, rr, rrPts, setFont, specLinear, specRGB, textW, vignette } from './montage.js';

export const template = {
  id: 'feature-grid-wide', name: 'Feature grid', category: 'explain', aspect: '16:9',
  summary: 'Quiet glass cards rise into a grid, then a comet runs around each in turn and lights it up in the spectrum.',
  agentHint: 'Show what a product does in one frame: 3–6 features, one per line as "Name: detail" (name 1–3 words, detail under ~38 characters), headline under ~32 characters with [brackets] for the spectrum. Draw your own icons in `icon()` (one per card, by index).',
  principles: ['staging', 'timing', 'overlapping action', 'secondary action'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 5.5, fps: 30, background: '#06080C' };

export const params = {
  title: { name: 'Headline', type: 'string' as const, default: 'Everything your [week] needs.' },
  features: {
    name: 'Features', type: 'string' as const,
    default: 'Shared plans: One calm view of the week\nLive reports: Numbers that update themselves\nGoals: Progress the whole team can see\nTeam spaces: Every project in one place\nGentle alerts: Only what needs you today\nInsights: Patterns found for you',
  },
  ...montageParams('night'), ...safeParam,
};

const TY = 272, TS = 88, GY = 426, CW = 500, CH = 196, GAP = 30, R = 28;
/** The light visits card i at LIT + i × STEP and takes RUN seconds to close its loop. */
const LIT = 1.15, STEP = .38, RUN = .5;

/** A simple line icon per card, centred at (x, y) in a box of about 2r. Replace with your own. */
function icon(c: C2D, i: number, x: number, y: number, r: number, col: string) {
  c.save(); c.translate(x, y); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath();
  switch (i % 6) {
    case 0: c.roundRect(-r, -r * .8, r * 2, r * 1.75, 6); c.moveTo(-r, -r * .3); c.lineTo(r, -r * .3); c.moveTo(-r * .45, -r * 1.05); c.lineTo(-r * .45, -r * .6); c.moveTo(r * .45, -r * 1.05); c.lineTo(r * .45, -r * .6); break;
    case 1: [-.7, 0, .7].forEach((u, j) => { const h = r * [.8, 1.3, 1.9][j]!; c.moveTo(u * r, r * .95); c.lineTo(u * r, r * .95 - h); }); c.lineWidth = 6; break;
    case 2: c.arc(0, 0, r, 0, 7); c.moveTo(r * .52, 0); c.arc(0, 0, r * .52, 0, 7); c.stroke(); c.beginPath(); c.arc(0, 0, r * .14, 0, 7); c.fill(); c.beginPath(); break;
    case 3: c.arc(-r * .38, -r * .35, r * .36, 0, 7); c.moveTo(r * .74, -r * .35); c.arc(r * .38, -r * .35, r * .36, 0, 7);
      c.moveTo(-r, r * .85); c.quadraticCurveTo(-r * .38, -r * .05, r * .2, r * .85); c.moveTo(-r * .2, r * .85); c.quadraticCurveTo(r * .38, -r * .05, r, r * .85); break;
    case 4: c.moveTo(-r * .8, r * .55); c.quadraticCurveTo(-r * .6, r * .2, -r * .62, -r * .15); c.quadraticCurveTo(-r * .55, -r, 0, -r); c.quadraticCurveTo(r * .55, -r, r * .62, -r * .15);
      c.quadraticCurveTo(r * .6, r * .2, r * .8, r * .55); c.closePath(); c.moveTo(-r * .25, r * .82); c.quadraticCurveTo(0, r * 1.05, r * .25, r * .82); break;
    default: for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 - Math.PI / 2, q = k % 2 ? r * .3 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); c.fill(); c.beginPath();
  }
  c.stroke(); c.restore();
}

type Box = [number, number, number, number];

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), d = meta.duration, out = exitOf(time, d, .55), dark = lk.dark, flow = time * .4;
  const items = String(p.features).split('\n').map(s => s.trim()).filter(Boolean).slice(0, 6).map(s => {
    const i = s.indexOf(':'); return i < 0 ? { name: s, detail: '' } : { name: s.slice(0, i).trim(), detail: s.slice(i + 1).trim() };
  });
  const n = items.length, cols = n <= 3 ? n : Math.ceil(n / 2), rows = n <= 3 ? 1 : 2;
  const gx = W / 2 - (cols * CW + (cols - 1) * GAP) / 2, gy = rows === 1 ? GY + (CH + GAP) / 2 : GY;
  stage(ctx, '16:9', c => {
    ground(c, p, time, { orbA: K.teal, orbB: K.violet });

    // ---- headline
    const raw = String(p.title), a0 = raw.indexOf('['), a1 = raw.indexOf(']'), title = raw.replace(/[[\]]/g, ''), n0 = a0 < 0 ? -1 : a0, n1 = a1 < 0 ? -1 : a1 - 1;
    const size = Math.min(TS, TS * 1560 / Math.max(1, textW(c, title, TS, 600)));
    kin(c, title, W / 2, TY, size, lk.ink, time - .05, {
      w: 600, st: .025, out, colAt: (i: number) => i >= n0 && i <= n1 ? 'fill' : lk.ink,
      fill: (x: C2D, x0: number) => specLinear(x, x0 + textW(x, title.slice(0, Math.max(0, n0)), size, 600), 0, x0 + textW(x, title.slice(0, n1 + 1), size, 600), 0, [K.teal, K.sky, K.violet]),
    });

    // ---- cards
    items.forEach((it, i) => {
      const col = i % cols, row = Math.floor(i / cols), x = gx + col * (CW + GAP), y = gy + row * (CH + GAP);
      const rise = spring(time, .25 + i * .06, .5, .12), t0 = LIT + i * STEP, lit = eo(P(time, t0 + RUN * .7, t0 + RUN + .25));
      const hue = specRGB(.02 + i / Math.max(1, n) * .8), hueC = rgba(hue);
      if (rise <= 0) return;
      // the lit card's light on the ground behind it
      if (lit > 0 && dark) { c.save(); c.globalCompositeOperation = 'lighter'; glow(c, x + CW / 2, y + CH / 2, 330, hueC, .1 * lit * (1 - out)); c.restore(); }
      layer(c, `fg-card-${i}`, clamp(rise * 1.6) * (1 - out), (x2: C2D) => {
        x2.save(); x2.translate(0, (1 - rise) * 40);
        if (!dark) { x2.shadowColor = `rgba(28,46,64,${.06 + .06 * lit})`; x2.shadowBlur = 36; x2.shadowOffsetY = 12; }
        rr(x2, x, y, CW, CH, R); x2.fillStyle = dark ? rgba(mixc('#0E1219', '#151B26', lit)) : '#FFFFFF'; x2.fill(); x2.shadowColor = 'transparent';
        x2.strokeStyle = lk.line; x2.lineWidth = 1.5; x2.stroke();
        // the rim flashes in the spectrum as the loop closes, then settles into the card's own colour
        if (lit > 0) {
          const flash = lit * (1 - eo(P(time, t0 + RUN + .25, t0 + RUN + .9)));
          x2.save(); rr(x2, x, y, CW, CH, R); x2.lineWidth = 2.4; x2.globalAlpha *= lit * .7; x2.strokeStyle = hueC; x2.stroke();
          if (flash > 0) { x2.globalAlpha = flash; x2.strokeStyle = conic(x2, x + CW / 2, y + CH / 2, flow + i); x2.stroke(); }
          x2.restore();
        }
        // icon: grey until lit, then its spectrum colour in a soft tile
        const ix = x + 36 + 30, iy = y + 36 + 30;
        rr(x2, ix - 30, iy - 30, 60, 60, 16); x2.fillStyle = lit > 0 ? rgba(hue, (dark ? .16 : .13) * lit) : 'rgba(0,0,0,0)'; x2.fill();
        icon(x2, i, ix, iy, 15, rgba(mixc(dark ? '#4A5361' : '#B4BDC7', hue, lit)));
        setFont(x2, 34, 600); x2.textAlign = 'left'; x2.textBaseline = 'middle';
        x2.fillStyle = rgba(mixc(dark ? '#5B6574' : '#9AA5B1', dark ? K.fg : K.ink, lit)); x2.fillText(it.name, x + 36, y + 124);
        setFont(x2, 22, 500); x2.fillStyle = lk.mut; x2.globalAlpha *= lerp(.55, 1, lit); x2.fillText(it.detail, x + 36, y + 162);
        x2.restore();
      }, { bounds: [x - 40, y - 20, CW + 80, CH + 100] });

      // the comet's loop around the card
      const k = eio(P(time, t0, t0 + RUN));
      if (k > 0 && k < 1) {
        const loop = mkPath(rrPts(x + CW / 2, y + CH / 2, CW, CH, R, 120)), s = loop.len * k, a = Math.sin(Math.PI * k) ** .4 * (1 - out);
        const emit = (x2: C2D) => { comet(x2, loop, s, { len: loop.len * .45, lw: 3.2, a, per: loop.len, hue: i / n, step: 20 }); const h = pAt(loop, s); dot(x2, h[0], h[1], 5.5, '#FFFFFF', a); };
        const b: Box = [x - 48, y - 48, CW + 96, CH + 96];
        emit(c); bloom(c, emit, { radius: 10, strength: 1.1 * a, halo: .9, bounds: b });
      }
    });
    if (dark) vignette(c, .4);
    safeGuide(c, '16:9', p.safeGuide);
  });
}
