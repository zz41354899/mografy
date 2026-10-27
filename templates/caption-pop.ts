// Pop captions for short video: over a talking-head picture window, one or two words at a time pop into a white
// strip in huge Anton with a small overshoot; the strip springs to each group's width, the previous group lifts
// out through it, and the last group lands in orange.
import type { FrameContext, SetupContext } from '@mografy/runtime';
import { at, clamp, ease, exitOf, lerp, safeGuide, safeParam, spring, springs, stage, type TemplateInfo } from './kit.js';
import { CX, DISPLAY, W, cover, editorialParams, footer, header, loadPhoto, measure, page, paper, type Page } from './editorial.js';

export const template = {
  id: 'caption-pop', name: 'Pop captions', category: 'caption', aspect: '9:16',
  summary: 'Short-video captions: one or two words at a time pop into a white strip over the picture, the last group in orange.',
  agentHint: 'Punchy spoken line of 2–8 short words; words of up to three letters ride with the next word. Put assets/pop.jpg in the project for the picture, or play it with backdrop false over your own footage (the strip carries the words).',
  principles: ['squash and stretch', 'timing', 'follow-through', 'exaggeration'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 4, fps: 30, background: '#FFFFFF' };

export const params = {
  text: { name: 'Caption', type: 'string' as const, default: 'Plan less ship more' },
  kicker: { name: 'Header left', type: 'string' as const, default: 'Team notes' },
  label: { name: 'Header right', type: 'string' as const, default: 'Northwind' },
  brand: { name: 'Footer brand', type: 'string' as const, default: 'Northwind · Studio' },
  ...editorialParams, ...safeParam,
};

export async function setup(ctx: SetupContext) { await loadPhoto(ctx, 'pop.jpg'); }

const TOP = 300, BOT = 1640, LINE_Y = 970, STRIP_Y = 1290, SIZE = 250, MAXW = 760, T0 = .7;

/**
 * Stand-in picture: a talking head, a figure in soft back light against a grey studio wall, drawn flat in greys
 * like the black-and-white photos of the post. Replace it with assets/pop.jpg.
 */
function portrait(c: CanvasRenderingContext2D, time: number) {
  // Backdrop: a soft pool of light behind the sitter, so the figure reads as a backlit silhouette.
  const g = c.createRadialGradient(600, 820, 30, 600, 860, 760);
  g.addColorStop(0, '#4A4A4A'); g.addColorStop(.5, '#262626'); g.addColorStop(1, '#0D0D0D');
  c.fillStyle = g; c.fillRect(0, TOP, W, BOT - TOP);
  c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(830, TOP + 110, 150, 560);
  const k = at(time, .2, 1.8, ease.outCubic);
  c.save(); c.translate(lerp(18, 0, k), 0);
  const fig = c.createLinearGradient(300, 0, 900, 0);
  fig.addColorStop(0, '#070707'); fig.addColorStop(.7, '#121212'); fig.addColorStop(1, '#1E1E1E');
  c.fillStyle = fig;
  // Shoulders, neck and head as one silhouette.
  c.beginPath();
  c.moveTo(120, BOT); c.bezierCurveTo(140, 1330, 300, 1215, 470, 1185);
  c.bezierCurveTo(515, 1170, 528, 1120, 530, 1065);
  c.lineTo(648, 1065); c.bezierCurveTo(650, 1120, 663, 1170, 708, 1185);
  c.bezierCurveTo(880, 1215, 1020, 1330, 1040, BOT); c.closePath(); c.fill();
  c.beginPath(); c.ellipse(590, 900, 118, 156, -.04, 0, Math.PI * 2); c.fill();
  // A thin rim of light on the lit side.
  c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 4;
  c.beginPath(); c.ellipse(590, 900, 118, 156, -.04, -1.1, .55); c.stroke();
  c.beginPath(); c.moveTo(708, 1185); c.bezierCurveTo(880, 1215, 1020, 1330, 1040, BOT); c.stroke();
  c.restore();
}

function picture(c: CanvasRenderingContext2D, ctx: FrameContext, _pg: Page, time: number) {
  const img = ctx.assets.photo as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (img) cover(c, img, 0, TOP, W, BOT - TOP, .5, .35, lerp(1.08, 1, at(time, .25, 1.6, ease.outCubic)));
  else portrait(c, time);
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, out = exitOf(time, d, .5), overlay = p.backdrop === false;
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    if (!overlay) {
      header(c, pg, time, .05, String(p.kicker), String(p.label), 1 - out);
      footer(c, pg, time, .2, String(p.brand), 'See more', 1 - out);
      const line = at(time, 0, .3, ease.inOutCubic), open = at(time, .2, 1, springs.camera), close = at(time, d - .48, d - .08, ease.inOutCubic);
      const top = lerp(lerp(LINE_Y, TOP, open), LINE_Y, close), bot = lerp(lerp(LINE_Y, BOT, open), LINE_Y, close);
      if (bot - top > 1) { c.save(); c.beginPath(); c.rect(0, top, W, bot - top); c.clip(); picture(c, ctx, pg, time); c.restore(); }
      const retract = at(time, .75, 1.25, ease.inOutCubic) * (1 - at(time, d - .7, d - .48, ease.inOutCubic));
      const half = 540 * line * (1 - at(time, d - .12, d, ease.inOutCubic));
      if (half > 0 && retract < 1) for (const y of bot - top > 2 ? [top - 3, bot - 3] : [top - 3]) {
        c.fillStyle = pg.accent; c.fillRect(CX - half, y, half * (1 - retract), 6); c.fillRect(CX + half * retract, y, half * (1 - retract), 6);
      }
    }

    // Groups: a word of up to three letters rides with the next one. The first pops in once the window is open.
    const words = String(p.text).toUpperCase().split(/\s+/).filter(Boolean), groups: string[] = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i]!;
      if (w.replace(/\W/g, '').length <= 3 && i + 1 < words.length) { groups.push(`${w} ${words[i + 1]}`); i++; } else groups.push(w);
    }
    if (!groups.length) return;
    const probe = { size: SIZE, color: '', family: DISPLAY, tracking: SIZE * .01 };
    const size = Math.min(SIZE, ...groups.map(g => SIZE * MAXW / Math.max(1, measure(c, g, probe))));
    const st = { ...probe, size, tracking: size * .01 };
    c.save(); c.font = `400 ${size}px ${DISPLAY}`; const cap = c.measureText('H').actualBoundingBoxAscent; c.restore();
    const padX = size * .2, padY = size * .17, h = cap + padY * 2, sTop = STRIP_Y - h / 2, base = sTop + padY + cap;
    const step = Math.min(.62, (d - 1.25 - T0) / groups.length), n = groups.length;
    const widths = groups.map(g => measure(c, g, st) + padX * 2);
    const tOf = (g: number) => T0 + g * step;

    // The strip: opens from the centre for the first group, then springs to each group's width; closes at the end.
    let sw = widths[0]! * spring(time, T0 - .12, .38, .12);
    for (let g = 1; g < n; g++) sw = lerp(sw, widths[g]!, spring(time, tOf(g) - .04, .36, .2));
    sw *= 1 - at(time, d - .62, d - .36, ease.inOutCubic);
    if (sw <= 1) return;
    c.fillStyle = pg.paper; c.fillRect(CX - sw / 2, sTop, sw, h);

    c.save(); c.beginPath(); c.rect(CX - sw / 2, sTop, sw, h); c.clip();
    c.font = `400 ${size}px ${DISPLAY}`; c.letterSpacing = `${st.tracking}px`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    groups.forEach((g, i) => {
      const t = tOf(i), k = spring(time, t, .42, .3);
      if (k <= 0) return;
      // Lifted out by the next group (or by the exit for the last one).
      const lift = i < n - 1 ? at(time, tOf(i + 1) - .02, tOf(i + 1) + .26, ease.inOutCubic) : at(time, d - .64, d - .38, ease.inOutCubic);
      if (lift >= 1) return;
      const s = lerp(.72, 1, k);
      c.save(); c.translate(CX, base - cap / 2 + (1 - Math.min(1, k)) * h * .8 - lift * h * 1.05); c.scale(s, s);
      c.globalAlpha *= clamp(k * 2); c.fillStyle = i === n - 1 ? pg.accent : pg.ink;
      c.fillText(g, st.tracking / 2, cap / 2);
      c.restore();
    });
    c.restore();
    safeGuide(c, '9:16', p.safeGuide);
  });
}
