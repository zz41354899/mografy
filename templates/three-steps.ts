// Three steps: an orange line opens into a picture window, and three step cards swipe through it like an Instagram
// carousel; each title rises in the band above, the dots follow, the window closes back into the line.
import type { FrameContext, SetupContext } from '@mografy/runtime';
import { at, clamp, ease, exitOf, lerp, pr, safeGuide, safeParam, springs, stage, type TemplateInfo } from './kit.js';
import { CX, DISPLAY, MX, SANS, W, carousel, carouselDots, cover, editorialParams, editorialScreen, loadPhoto, page, paper, txt, type Page } from './editorial.js';

export const template = {
  id: 'three-steps', name: 'Three steps', category: 'explain', aspect: '9:16',
  summary: 'A line opens into a window and three step cards swipe through it like a carousel, each with its title above.',
  agentHint: 'Explain a 3-step flow. Step titles 2–4 words, details one short line. The window shows a stand-in screen: put assets/step-1.jpg … step-3.jpg in the project (or redraw `screen`) to show the real product.',
  principles: ['staging', 'follow-through', 'overlapping action', 'slow in and slow out'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 7, fps: 30, background: '#FFFFFF' };

export const params = {
  kicker: { name: 'Band label', type: 'string' as const, default: 'How it works' },
  step1: { name: 'Step 1', type: 'string' as const, default: 'Paste a link' },
  step2: { name: 'Step 2', type: 'string' as const, default: 'Pick a style' },
  step3: { name: 'Step 3', type: 'string' as const, default: 'Export the film' },
  details: { name: 'Details (one per line)', type: 'string' as const, default: 'Drop in your product page.\nChoose the look and the pace.\nMP4, ready to post.' },
  hint: { name: 'Swipe hint', type: 'string' as const, default: 'Swipe for the next step' },
  ...editorialParams, ...safeParam,
};

export async function setup(ctx: SetupContext) {
  for (const i of [1, 2, 3]) await loadPhoto(ctx, `step-${i}.jpg`, `step${i}`);
}

const TOP = 600, BOT = 1640, LINE_Y = 1120, OPEN = .35, SWIPES = [2.55, 4.55];
const SCREENS = [{ title: 'New film', figure: '01', label: 'Link pasted' }, { title: 'Style', figure: '12', label: 'Looks to choose from' }, { title: 'Export', figure: '1080p', label: 'Ready to post' }];

/** The step picture: a photo from the project, or the stand-in product screen. */
function screen(c: CanvasRenderingContext2D, ctx: FrameContext, i: number, pg: Page, t: number, x: number) {
  const img = ctx.assets[`step${i + 1}`] as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (img) { cover(c, img, x, TOP, W, BOT - TOP, .5, .5, lerp(1.06, 1, at(t, 0, 1.4, ease.outCubic))); return; }
  c.save(); c.translate(x, TOP); editorialScreen(c, W, BOT - TOP, pg, t, SCREENS[i]); c.restore();
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, out = exitOf(time, d, .7);
  const titles = [p.step1, p.step2, p.step3].map(String), details = String(p.details).split('\n');
  stage(ctx, '9:16', c => {
    paper(c, p, pg, pg.paper);
    // The line draws out from the centre, then its two halves become the window's top and bottom edges.
    const line = at(time, .05, OPEN, ease.inOutCubic), open = at(time, OPEN, OPEN + .8, springs.camera), close = at(time, d - .75, d - .2, ease.inOutCubic);
    const top = lerp(lerp(LINE_Y, TOP, open), LINE_Y, close), bot = lerp(lerp(LINE_Y, BOT, open), LINE_Y, close);
    const pos = carousel(time, SWIPES), moving = Math.sin(clamp(pos - Math.floor(pos)) * Math.PI), depth = 1 - .05 * moving;
    if (bot - top > 1) for (let i = 0; i < 3; i++) {
      const dx = (i - pos) * W; if (Math.abs(dx) >= W) continue;
      const t0 = i === 0 ? OPEN : SWIPES[i - 1]! - .1;
      c.save(); c.translate(CX, 1120); c.scale(depth, depth); c.translate(-CX, -1120);
      c.beginPath(); c.rect(dx, top, W, bot - top); c.clip();
      // Parallax: the picture travels a little slower than its frame.
      screen(c, ctx, i, pg, time - t0, dx * .62);
      c.restore();
      // An accent leading edge on the card coming in.
      if (dx > 0 && moving > .01) { c.save(); c.globalAlpha *= moving; c.fillStyle = pg.accent; c.fillRect(dx - 7, top, 14, bot - top); c.restore(); }
    }
    // The window's edges pull out to both sides once it is open, come back to close it, then the line shrinks away.
    const retract = at(time, OPEN + .45, OPEN + .95, ease.inOutCubic) * (1 - at(time, d - 1, d - .75, ease.inOutCubic));
    const half = 540 * line * (1 - at(time, d - .25, d, ease.inOutCubic));
    if (half > 0 && retract < 1) for (const y of bot - top > 2 ? [top - 3, bot - 3] : [top - 3]) {
      c.fillStyle = pg.accent; c.fillRect(CX - half, y, half * (1 - retract), 6); c.fillRect(CX + half * retract, y, half * (1 - retract), 6);
    }

    // Band above the window: label and rule, then each step's number and title, swapping with the swipe.
    const chrome = at(time, OPEN + .2, OPEN + .8) * (1 - out);
    txt(c, String(p.kicker).toUpperCase(), MX, 196, { size: 38, color: pg.accent, family: DISPLAY, tracking: 2, alpha: chrome });
    c.save(); c.globalAlpha *= chrome; c.fillStyle = pg.accent; c.fillRect(MX, 226, 520 * at(time, OPEN + .3, OPEN + 1), 3); c.restore();
    for (let i = 0; i < 3; i++) {
      const dx = (i - pos) * W; if (Math.abs(dx) >= W) continue;
      const build = i === 0 ? OPEN + .4 : SWIPES[i - 1]! + .3;
      c.save(); c.translate(dx, 0); c.globalAlpha *= 1 - out;
      const k = at(time, build, build + .9, ease.outQuart);
      const nw = txt(c, `0${i + 1}`, MX, 410, { size: 150, color: pg.accent, family: DISPLAY, alpha: Math.min(1, k * 1.6) }), tx = MX + nw + 34;
      c.save(); c.globalAlpha *= Math.min(1, k * 1.6); c.fillStyle = pg.accent; c.fillRect(MX + nw + 14, 300, 3, 110 * k); c.restore();
      txt(c, titles[i]!.toUpperCase(), tx, 402, { size: 92, color: pg.ink, family: DISPLAY, tracking: lerp(-4, 3, k), alpha: Math.min(1, k * 1.6) });
      const e = at(time, build + .25, build + 1, ease.outQuint);
      c.save(); c.beginPath(); c.rect(0, 430, W * 2, 90); c.clip();
      txt(c, details[i] ?? '', tx, 486 + (1 - e) * 80, { size: 38, color: pg.mute, family: SANS, weight: 600 });
      c.restore(); c.restore();
    }
    // Bottom: the swipe hint (its arrow nudges before each swipe) and the dots.
    const nudge = SWIPES.reduce((a, t) => a + Math.sin(clamp(pr(time, t - .5, t)) * Math.PI), 0);
    const hint = `[ ${String(p.hint).toUpperCase()} ]`;
    txt(c, hint, CX, 1760, { size: 34, color: pg.accent, family: SANS, weight: 800, tracking: 5, align: 'center', alpha: chrome });
    txt(c, '←', CX - 330 - nudge * 22, 1758, { size: 40, color: pg.accent, family: SANS, weight: 800, align: 'center', alpha: chrome * clamp(nudge * 2) });
    carouselDots(c, pg, 3, pos, 1690, chrome * at(time, OPEN + .6, OPEN + 1.1));
    safeGuide(c, '9:16', p.safeGuide);
  });
}
