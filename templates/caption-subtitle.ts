// Interview subtitle: a line opens into a dark picture window; over its lower edge the spoken line rises word by
// word in white, and the speaker's name follows behind a short orange rule as its letter spacing opens.
import type { FrameContext, SetupContext } from '@mografy/runtime';
import { at, clamp, ease, lerp, safeGuide, safeParam, springs, stage, type TemplateInfo } from './kit.js';
import { CX, MX, SANS, W, cover, editorialParams, footer, header, loadPhoto, page, paper, txt, wordLine, wrapLines, type Ink, type Page } from './editorial.js';

export const template = {
  id: 'caption-subtitle', name: 'Speaker subtitle', category: 'caption', aspect: '9:16',
  pair: 'caption-subtitle-wide',
  summary: 'A spoken line rises in white over a dark picture window, with the speaker named behind a short orange rule.',
  agentHint: 'Interview or founder quote: one sentence up to ~60 characters (wraps to two lines) and a "Name · Role" line. Put assets/speaker.jpg in the project for the picture; with backdrop false it draws its own scrim over your footage.',
  principles: ['staging', 'timing', 'overlapping action', 'slow in and slow out'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 4.5, fps: 30, background: '#FFFFFF' };

export const params = {
  text: { name: 'Subtitle', type: 'string' as const, default: 'We built Northwind for teams that ship.' },
  speaker: { name: 'Speaker', type: 'string' as const, default: 'Maya Chen · Founder, Northwind' },
  kicker: { name: 'Header left', type: 'string' as const, default: 'In conversation' },
  label: { name: 'Header right', type: 'string' as const, default: 'Northwind' },
  brand: { name: 'Footer brand', type: 'string' as const, default: 'Northwind · Studio' },
  ...editorialParams, ...safeParam,
};

export async function setup(ctx: SetupContext) { await loadPhoto(ctx, 'speaker.jpg'); }

const TOP = 300, BOT = 1640, LINE_Y = 970, SIZE = 62, SPEAKER_Y = 1530;

/**
 * Stand-in picture: a dark studio portrait, a figure in soft side light against a grey backdrop, drawn flat in
 * greys like the black-and-white photos of the post. Replace it with assets/speaker.jpg.
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

/** The scrim that carries the white copy over any picture. */
function scrim(c: CanvasRenderingContext2D, top: number, bot: number, a: number) {
  const g = c.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.45, `rgba(0,0,0,${.45 * a})`); g.addColorStop(1, `rgba(0,0,0,${.78 * a})`);
  c.fillStyle = g; c.fillRect(0, top, W, bot - top);
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, out = at(time, d - .85, d - .4, ease.inOutCubic), overlay = p.backdrop === false;
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    if (!overlay) {
      header(c, pg, time, .05, String(p.kicker), String(p.label), 1 - out);
      footer(c, pg, time, .2, String(p.brand), 'See more', 1 - out);
      const line = at(time, 0, .3, ease.inOutCubic), open = at(time, .25, 1.05, springs.camera), close = at(time, d - .62, d - .17, ease.inOutCubic);
      const top = lerp(lerp(LINE_Y, TOP, open), LINE_Y, close), bot = lerp(lerp(LINE_Y, BOT, open), LINE_Y, close);
      if (bot - top > 1) {
        c.save(); c.beginPath(); c.rect(0, top, W, bot - top); c.clip();
        picture(c, ctx, pg, time); scrim(c, 1000, BOT, 1);
        c.restore();
      }
      const retract = at(time, .8, 1.3, ease.inOutCubic) * (1 - at(time, d - .85, d - .62, ease.inOutCubic));
      const half = 540 * line * (1 - at(time, d - .25, d, ease.inOutCubic));
      if (half > 0 && retract < 1) for (const y of bot - top > 2 ? [top - 3, bot - 3] : [top - 3]) {
        c.fillStyle = pg.accent; c.fillRect(CX - half, y, half * (1 - retract), 6); c.fillRect(CX + half * retract, y, half * (1 - retract), 6);
      }
    } else scrim(c, 960, 1920, at(time, 0, .5) * (1 - out));

    // The spoken line, white over the picture, rising word by word; the speaker sits under it.
    const st: Ink = { size: SIZE, color: '#FFFFFF', family: SANS, weight: 700 };
    // Balanced lines: the narrowest measure that still needs no more lines than the full width.
    let max = 900; const count = wrapLines(c, String(p.text), max, st).length;
    while (max > 420 && wrapLines(c, String(p.text), max - 20, st).length === count) max -= 20;
    const lines = wrapLines(c, String(p.text), max, st).slice(0, 3), lh = SIZE * 1.24;
    const first = SPEAKER_Y - 96 - (lines.length - 1) * lh;
    let start = .7;
    lines.forEach((ln, i) => {
      wordLine(c, ln, MX, first + i * lh, st, time, start, { stagger: .075, exit: at(time, d - .85 + i * .05, d - .45 + i * .05, ease.inOutCubic) });
      start += ln.split(' ').length * .075 + .1;
    });

    // Speaker: a short orange rule draws, then the name's letter spacing opens from tight to loose.
    const r = at(time, start + .05, start + .45, ease.inOutCubic), sp = at(time, start + .2, start + 1.2, ease.outQuart);
    const fade = 1 - at(time, d - .75, d - .4, ease.inOutCubic);
    c.fillStyle = pg.accentLight; c.save(); c.globalAlpha *= fade; c.fillRect(MX, SPEAKER_Y - 12, 56 * r, 5); c.restore();
    txt(c, String(p.speaker).toUpperCase(), MX + 80, SPEAKER_Y, {
      size: 28, color: pg.accentLight, family: SANS, weight: 800, tracking: lerp(-3, 5, sp), alpha: clamp(sp * 1.8) * fade,
    });
    safeGuide(c, '9:16', p.safeGuide);
  });
}
