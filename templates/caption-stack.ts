// Stacked caption: tall Anton words stack up line by line at the margin, each rising into its mask, while an orange
// rule grows down beside the stack; a picture window opens to the right, and the last line lands in orange.
import type { FrameContext, SetupContext } from '@mografy/runtime';
import { at, ease, exitOf, lerp, safeGuide, safeParam, spring, springs, stage, type TemplateInfo } from './kit.js';
import { DISPLAY, MX, W, charLine, cover, editorialParams, editorialScreen, footer, header, loadPhoto, measure, page, paper, type Page } from './editorial.js';

export const template = {
  id: 'caption-stack', name: 'Stacked caption', category: 'caption', aspect: '9:16',
  summary: 'Tall words stack up line by line at the margin beside a growing orange rule; the last line lands in orange.',
  agentHint: 'A slogan of 2–5 very short lines (1 word each, up to ~6 letters), one per "\\n". Put assets/stack.jpg in the project for the picture strip; with backdrop false the stack sits on a white panel.',
  principles: ['staging', 'timing', 'overlapping action', 'slow in and slow out'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 4, fps: 30, background: '#FFFFFF' };

export const params = {
  text: { name: 'Lines', type: 'string' as const, default: 'PLAN\nLESS.\nSHIP\nMORE.' },
  kicker: { name: 'Header left', type: 'string' as const, default: 'Team notes' },
  label: { name: 'Header right', type: 'string' as const, default: 'Northwind' },
  brand: { name: 'Footer brand', type: 'string' as const, default: 'Northwind · Studio' },
  ...editorialParams, ...safeParam,
};

export async function setup(ctx: SetupContext) { await loadPhoto(ctx, 'stack.jpg'); }

const WL = 690, TOP = 330, BOT = 1610, MID = 970, TX = MX + 44, SIZE = 280;

function picture(c: CanvasRenderingContext2D, ctx: FrameContext, pg: Page, time: number) {
  const img = ctx.assets.photo as (CanvasImageSource & { width: number; height: number }) | undefined;
  const zoom = lerp(1.1, 1, at(time, .3, 1.7, ease.outCubic));
  c.save(); c.translate(WL, MID); c.scale(zoom, zoom); c.translate(-WL, -MID);
  if (img) cover(c, img, WL, TOP, W - WL, BOT - TOP, .5, .5);
  else {
    // The stand-in screen, cropped hard into the strip like a detail photo of the product: its right-hand side, the
    // accent dot, the last bars of the chart and the times of the list, so no word is cut by the strip's edges.
    c.translate(WL - 560, TOP - 40); editorialScreen(c, 1000, BOT - TOP + 80, pg, time - .3, { title: 'Sprint', figure: '24', label: 'Tasks done today' });
  }
  c.restore();
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, out = exitOf(time, d, .55), overlay = p.backdrop === false;
  const lines = String(p.text).toUpperCase().split('\n').map(s => s.trim()).filter(Boolean).slice(0, 5), n = lines.length;
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    // One size for the stack: as tall as the widest line allows left of the picture strip (or the page in overlay).
    const room = (overlay ? W - MX : WL - 44) - TX;
    const widest = Math.max(1, ...lines.map(l => measure(c, l, { size: SIZE, color: '', family: DISPLAY, tracking: SIZE * .02 })));
    const size = Math.min(SIZE, SIZE * room / widest, (BOT - TOP - 60) / (n * .97));
    c.save(); c.font = `400 ${size}px ${DISPLAY}`; const cap = c.measureText('H').actualBoundingBoxAscent; c.restore();
    const lh = size * .97, first = MID - ((n - 1) * lh + cap) / 2 + cap;

    if (!overlay) {
      header(c, pg, time, .05, String(p.kicker), String(p.label), 1 - out);
      footer(c, pg, time, .2, String(p.brand), 'See more', 1 - out);
      // The strip window: an orange line drops at its left edge, then the picture opens out of it to the right.
      const drop = at(time, 0, .35, ease.inOutCubic), open = at(time, .3, 1.05, springs.camera), close = at(time, d - .7, d - .2, ease.inOutCubic);
      const right = lerp(lerp(WL, W, open), WL, close);
      if (right - WL > 1) { c.save(); c.beginPath(); c.rect(WL, TOP, right - WL, BOT - TOP); c.clip(); picture(c, ctx, pg, time); c.restore(); }
      const h = (BOT - TOP) * drop * (1 - at(time, d - .25, d, ease.inOutCubic));
      if (h > 0) { c.fillStyle = pg.accent; c.fillRect(WL - 3, MID - h / 2, 6, h); }
    } else {
      const k = at(time, .1, .5, ease.outQuart) * (1 - out);
      const r = TX + Math.max(...lines.map(l => measure(c, l, { size, color: '', family: DISPLAY, tracking: size * .02 }))) + 48;
      c.save(); c.globalAlpha *= k; c.fillStyle = pg.paper; c.fillRect(MX - 40, first - cap - 56, r - (MX - 40), (n - 1) * lh + cap + 112); c.restore();
    }

    // The words stack up: each line rises into its own mask; the last one lands in the accent, a touch larger first.
    const starts = lines.map((_, i) => .38 + i * .3);
    lines.forEach((ln, i) => {
      const last = i === n - 1;
      charLine(c, ln, TX, first + i * lh, size, time, starts[i]!, {
        align: 'left', color: last ? pg.accent : pg.ink, stagger: .04, exitAt: d - .62 + i * .05,
        fx: last ? (_, k) => ({ scale: lerp(1.18, 1, k) }) : undefined,
      });
    });
    // The rule grows down beside the stack, following each line as it lands; it retracts upward on the way out.
    let bottom = first - cap;
    starts.forEach((t, i) => { bottom = lerp(bottom, first + i * lh + size * .04, spring(time, t + .05, .45, .1)); });
    const retract = at(time, d - .6, d - .2, ease.inOutCubic), topY = first - cap;
    if (bottom > topY + 1) { c.fillStyle = pg.accent; c.fillRect(MX, lerp(topY, bottom, retract), 8, (bottom - topY) * (1 - retract)); }
    safeGuide(c, '9:16', p.safeGuide);
  });
}
