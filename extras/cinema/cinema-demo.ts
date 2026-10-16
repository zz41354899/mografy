// A 14-second tour of the camera and transition helpers in cinema.ts.
// Six procedural plates stand in for photos or key art; replace them with preparePlate(ctx, 'assets/…').
import { ease, pr } from '@mografy/runtime';
import type { FrameContext, SetupContext } from '@mografy/runtime';
import { plate, move, iris, slash, whip, particleWipe, dipTo, crossfade, flash, drift, twinkle, glow, lightSweep } from './cinema.js';
import type { Plate } from './cinema.js';

export const meta = { width: 1920, height: 1080, duration: 14, fps: 30, background: '#0b0a12' };

export const params = {
  accent: { name: 'Petal colour', type: 'color' as const, default: '#ffd3df' },
  labels: { name: 'Show labels', type: 'boolean' as const, default: true },
};
type Values = { accent: string; labels: boolean };

type Kind = 'night' | 'dawn' | 'city' | 'stage' | 'forest' | 'ocean';
const KINDS: Kind[] = ['night', 'dawn', 'city', 'stage', 'forest', 'ocean'];

/** Paint one 1920 × 1080 plate with seeded detail. */
function paint(c: OffscreenCanvasRenderingContext2D, kind: Kind, rnd: () => number) {
  const W = 1920, H = 1080;
  const sky = (a: string, b: string) => { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, W, H); };
  const disc = (x: number, y: number, r: number, color: string, halo: string) => {
    const g = c.createRadialGradient(x, y, r * .6, x, y, r * 3); g.addColorStop(0, halo); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6); c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  };
  const ridge = (base: number, amp: number, color: string) => {
    c.fillStyle = color; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += 40) c.lineTo(x, base - amp * (Math.sin(x * .004 + base) * .6 + Math.sin(x * .011 + amp) * .4));
    c.lineTo(W, H); c.fill();
  };
  if (kind === 'night') {
    sky('#141a3c', '#4a2c5e'); disc(1460, 250, 120, '#fff1cf', 'rgba(255,230,180,.45)');
    for (let i = 0; i < 9; i++) { c.fillStyle = `rgba(150,110,170,${.25 + rnd() * .2})`; c.beginPath(); c.ellipse(rnd() * W, 640 + rnd() * 380, 260 + rnd() * 260, 50 + rnd() * 40, 0, 0, Math.PI * 2); c.fill(); }
  } else if (kind === 'dawn') {
    sky('#ff9a8b', '#ffd28f'); disc(960, 640, 150, '#fff4d6', 'rgba(255,240,200,.6)');
    ridge(760, 120, '#c76b7a'); ridge(860, 90, '#8e4a6b'); ridge(960, 70, '#5a3058');
  } else if (kind === 'city') {
    sky('#0f3b4a', '#2b8a8a');
    for (let x = 0; x < W; x += 70 + rnd() * 60) {
      const w = 60 + rnd() * 90, h = 220 + rnd() * 520; c.fillStyle = '#0b2530'; c.fillRect(x, H - h, w, h);
      c.fillStyle = 'rgba(255,220,140,.75)';
      for (let y = H - h + 20; y < H - 20; y += 34) for (let k = x + 10; k < x + w - 12; k += 22) if (rnd() > .55) c.fillRect(k, y, 10, 16);
    }
  } else if (kind === 'stage') {
    sky('#3a0a2e', '#a3226a');
    for (let i = 0; i < 5; i++) {
      const x = 200 + i * 380, g = c.createLinearGradient(x, 0, x, H); g.addColorStop(0, 'rgba(255,220,240,.5)'); g.addColorStop(1, 'rgba(255,220,240,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(x - 30, 0); c.lineTo(x + 30, 0); c.lineTo(x + 260, H); c.lineTo(x - 260, H); c.fill();
    }
    c.fillStyle = 'rgba(255,200,120,.35)'; c.beginPath(); c.ellipse(960, 950, 760, 110, 0, 0, Math.PI * 2); c.fill();
  } else if (kind === 'forest') {
    sky('#163a2c', '#7fb37a');
    for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 16; i++) {
      const x = rnd() * W, h = 300 + rnd() * 400 + layer * 120, base = H - 40 + layer * 30;
      c.fillStyle = ['#2f6b4c', '#1f4d37', '#123224'][layer]!; c.beginPath(); c.moveTo(x, base - h); c.lineTo(x + h * .28, base); c.lineTo(x - h * .28, base); c.fill();
    }
  } else {
    sky('#0e2c5c', '#3f8fc8'); disc(560, 230, 90, '#f2fbff', 'rgba(220,240,255,.4)');
    for (let y = 560; y < H; y += 26) { c.strokeStyle = `rgba(220,240,255,${.12 + (y - 560) / 1800})`; c.lineWidth = 3; c.beginPath(); for (let x = 0; x <= W; x += 30) c.lineTo(x, y + 8 * Math.sin(x * .01 + y)); c.stroke(); }
  }
}

export async function setup(ctx: SetupContext) {
  for (const kind of KINDS) {
    const off = new OffscreenCanvas(1920, 1080), c = off.getContext('2d')!;
    paint(c, kind, ctx.random);
    const image = await createImageBitmap(off);
    const soft = new OffscreenCanvas(480, 270), s = soft.getContext('2d')!;
    s.filter = 'blur(7px) brightness(0.7) contrast(2.2)'; s.drawImage(image, 0, 0, 480, 270);
    ctx.assets[kind] = { image, width: 1920, height: 1080, soft: await createImageBitmap(soft), softScale: .25 } satisfies Plate;
  }
}

const pl = (ctx: FrameContext, k: Kind) => ctx.assets[k] as Plate;

// Each shot owns a camera move; transitions overlap neighbouring shots.
const shots = {
  night: (ctx: FrameContext, t: number) => { plate(ctx, pl(ctx, 'night'), move(t, 0, 2.75, { zoom: 1.0 }, { zoom: 1.12, focusX: .76, focusY: .23 }), { bloom: .3 }); twinkle(ctx, t, { area: [0, 0, ctx.width, ctx.height * .5] }); },
  dawn: (ctx: FrameContext, t: number) => { plate(ctx, pl(ctx, 'dawn'), move(t, 2.3, 4.95, { zoom: 1.1, panX: 80 }, { zoom: 1.1, panX: -80 }), { bloom: .25 }); lightSweep(ctx, t, { start: 3.0, end: 4.4 }); },
  city: (ctx: FrameContext, t: number) => { plate(ctx, pl(ctx, 'city'), move(t, 4.5, 7.15, { zoom: 1.12, panY: 60 }, { zoom: 1.12, panY: -60 }), { bloom: .3 }); },
  stage: (ctx: FrameContext, t: number, p: Values) => { plate(ctx, pl(ctx, 'stage'), move(t, 6.85, 9.8, { zoom: 1.14 }, { zoom: 1.02 }, ease.outCubic), { bloom: .35 }); drift(ctx, t, { color: p.accent, amount: .8 }); glow(ctx, ctx.width / 2, ctx.height * .85, 600, 'rgba(255,200,150,.9)', .2); },
  forest: (ctx: FrameContext, t: number) => { plate(ctx, pl(ctx, 'forest'), move(t, 9.0, 12.0, { zoom: 1.0 }, { zoom: 1.08, focusY: .4 }), { bloom: .2 }); },
  ocean: (ctx: FrameContext, t: number) => { plate(ctx, pl(ctx, 'ocean'), move(t, 11.2, 14, { zoom: 1.08, panX: -40 }, { zoom: 1.02, panX: 40 }), { bloom: .3 }); twinkle(ctx, t, { area: [0, 0, ctx.width, ctx.height * .45], seed: 5 }); },
};

const LABELS: [number, number, string][] = [
  [2.1, 3.2, 'iris()'], [4.3, 5.4, 'slash()'], [6.6, 7.6, 'whip()'], [8.8, 10.2, 'particleWipe()'], [11.0, 12.4, 'dipTo()'], [12.8, 14, 'crossfade()'],
];

export function renderFrame(ctx: FrameContext, time: number, input: Readonly<Record<string, unknown>>) {
  const p = input as Values, t = time, W = ctx.width, H = ctx.height;
  const at = (k: keyof typeof shots, clampTo?: [number, number]) => () => shots[k](ctx, clampTo ? Math.min(Math.max(t, clampTo[0]), clampTo[1]) : t, p);
  if (t < 2.75) iris(ctx, t, { start: 2.3, end: 2.75, x: W * .76, y: H * .23, from: at('night'), to: at('dawn') });
  else if (t < 4.95) slash(ctx, t, { start: 4.5, end: 4.95, from: at('dawn'), to: at('city') });
  else if (t < 7.15) whip(ctx, t, { start: 6.85, end: 7.15, direction: 'down', from: at('city'), to: at('stage') });
  else if (t < 9.8) particleWipe(ctx, t, { start: 9.0, end: 9.8, direction: 'left', color: p.accent, from: at('stage'), to: at('forest') });
  else if (t < 12.0) dipTo(ctx, t, { start: 11.2, end: 12.0, color: '#05060a', from: at('forest'), to: at('ocean') });
  else crossfade(ctx, t, { start: 12.9, end: 13.7, from: at('ocean'), to: at('night', [0, 2.75]) });
  flash(ctx, t, 7.0, { strength: .35 });

  if (p.labels) {
    const mografy = ctx.draw;
    for (const [a, b, label] of LABELS) {
      const v = ease.outCubic(pr(t, a, a + .3)) * (1 - ease.inOutCubic(pr(t, b - .3, b)));
      if (v <= 0) continue;
      mografy.push(); mografy.opacity(v); mografy.textFont('ABeeZee', 400); mografy.textSize(Math.min(W, H) * .05);
      mografy.textAlign('left', 'alphabetic'); ctx.shadow('#00000088', 14, 0, 2); mografy.fill('#ffffff');
      mografy.text(label, W * .06, H * .9 + (1 - v) * 12); mografy.pop();
    }
  }
  ctx.vignette(.35);
}
