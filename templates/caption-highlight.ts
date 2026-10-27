// Highlight caption: a line opens into a picture window, one caption line rises big under it word by word, an
// orange block sweeps the [marked] words and leaves them orange, and a hand-drawn underline follows.
import type { FrameContext, SetupContext } from '@mografy/runtime';
import { at, clamp, ease, exitOf, lerp, safeGuide, safeParam, springs, stage, type TemplateInfo } from './kit.js';
import { CX, MX, SANS, W, cover, editorialParams, editorialScreen, footer, header, loadPhoto, measure, page, paper, sweep, txt, underline, type Ink, type Page } from './editorial.js';

export const template = {
  id: 'caption-highlight', name: 'Highlight caption', category: 'caption', aspect: '9:16',
  summary: 'One big caption line rises under a picture window; the marked words are swept orange and underlined by hand.',
  agentHint: 'One statement of up to ~40 characters with the key words in [brackets]. Put assets/highlight.jpg in the project for the picture; with backdrop false the caption sits on a white panel over your own footage.',
  principles: ['staging', 'timing', 'follow-through', 'slow in and slow out'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 4, fps: 30, background: '#FFFFFF' };

export const params = {
  text: { name: 'Caption', type: 'string' as const, default: 'Plan the week in [one view].' },
  kicker: { name: 'Header left', type: 'string' as const, default: 'Feature notes' },
  label: { name: 'Header right', type: 'string' as const, default: 'Northwind' },
  brand: { name: 'Footer brand', type: 'string' as const, default: 'Northwind · Studio' },
  ...editorialParams, ...safeParam,
};

export async function setup(ctx: SetupContext) { await loadPhoto(ctx, 'highlight.jpg'); }

const TOP = 330, BOT = 990, LINE_Y = 660, SIZE = 118, MAXW = 870;

interface Word { s: string; flags: boolean[]; x: number; w: number; line: number; i: number }

function picture(c: CanvasRenderingContext2D, ctx: FrameContext, pg: Page, time: number) {
  const img = ctx.assets.photo as (CanvasImageSource & { width: number; height: number }) | undefined;
  const zoom = lerp(1.08, 1, at(time, .25, 1.6, ease.outCubic));
  c.save(); c.translate(CX, LINE_Y); c.scale(zoom, zoom); c.translate(-CX, -LINE_Y);
  if (img) cover(c, img, 0, TOP, W, BOT - TOP, .5, .5);
  else {
    // The stand-in screen at 900 wide, so its title, figure and chart all fit the window; its ground runs on to the edges.
    c.translate((W - 900) / 2, TOP - 60);
    const g = c.createLinearGradient(0, 0, 0, 1100); g.addColorStop(0, '#1C1C1C'); g.addColorStop(1, '#141414');
    c.fillStyle = g; c.fillRect(-(W - 900) / 2, -60, W, 1220); editorialScreen(c, 900, 1100, pg, time - .3, { title: 'Week 42', figure: '5', label: 'Projects, one view' });
  }
  c.restore();
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, out = exitOf(time, d, .55), overlay = p.backdrop === false;
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    if (!overlay) {
      header(c, pg, time, .05, String(p.kicker), String(p.label), 1 - out);
      footer(c, pg, time, .2, String(p.brand), 'See more', 1 - out);
      // The window: a line draws out, opens into the picture, and closes back into the line at the end.
      const line = at(time, 0, .3, ease.inOutCubic), open = at(time, .25, 1.05, springs.camera), close = at(time, d - .75, d - .2, ease.inOutCubic);
      const top = lerp(lerp(LINE_Y, TOP, open), LINE_Y, close), bot = lerp(lerp(LINE_Y, BOT, open), LINE_Y, close);
      if (bot - top > 1) { c.save(); c.beginPath(); c.rect(0, top, W, bot - top); c.clip(); picture(c, ctx, pg, time); c.restore(); }
      const retract = at(time, .8, 1.3, ease.inOutCubic) * (1 - at(time, d - 1, d - .75, ease.inOutCubic));
      const half = 540 * line * (1 - at(time, d - .25, d, ease.inOutCubic));
      if (half > 0 && retract < 1) for (const y of bot - top > 2 ? [top - 3, bot - 3] : [top - 3]) {
        c.fillStyle = pg.accent; c.fillRect(CX - half, y, half * (1 - retract), 6); c.fillRect(CX + half * retract, y, half * (1 - retract), 6);
      }
    }

    // Lay the caption out in words, carrying which letters were [marked], wrapped between the margins.
    let plain = '', on = false; const flags: boolean[] = [];
    for (const ch of String(p.text).trim()) { if (ch === '[') { on = true; continue; } if (ch === ']') { on = false; continue; } plain += ch; flags.push(on); }
    const raw: { s: string; flags: boolean[] }[] = [];
    let at0 = 0;
    for (const s of plain.split(' ')) { raw.push({ s, flags: flags.slice(at0, at0 + s.length) }); at0 += s.length + 1; }
    const longest = Math.max(1, ...raw.map(r => measure(c, r.s, { size: SIZE, color: '', family: SANS, weight: 800 })));
    const size = Math.min(SIZE, SIZE * MAXW / longest), st: Ink = { size, color: pg.ink, family: SANS, weight: 800, tracking: -size * .02 };
    const space = measure(c, ' ', st), words: Word[] = [];
    let x = MX, line = 0;
    raw.forEach((r, i) => {
      const w = measure(c, r.s, st);
      if (x > MX && x + w > MX + MAXW) { x = MX; line++; }
      words.push({ ...r, x, w, line, i }); x += w + space;
    });
    const lines = line + 1, lh = size * 1.12, base0 = 1290 - (lines - 1) * lh / 2 + size * .36;
    const yOf = (l: number) => base0 + l * lh;

    if (overlay) {
      const k = at(time, .1, .6, ease.outQuart) * (1 - out);
      c.save(); c.globalAlpha *= k; c.fillStyle = pg.paper;
      c.fillRect(MX - 44, yOf(0) - size * .74 - 52, W - 2 * (MX - 44), (lines - 1) * lh + size * .98 + 104 + 30); c.restore();
    }

    // Words rise; once the line is set the block sweeps the marked letters and leaves them orange.
    const W0 = .5, step = .09, set = W0 + words.length * step + .35;
    const sIn = at(time, set, set + .3, ease.inOutCubic), sOut = at(time, set + .3, set + .62, ease.inOutCubic);
    const ul = at(time, set + .62, set + 1.12, ease.inOutCubic);
    const spans: [number, number, number][] = [];
    words.forEach(wd => {
      const y = yOf(wd.line), k = at(time, W0 + wd.i * step, W0 + wd.i * step + .6, ease.outQuint);
      // Marked letters inside the word: measure the run so the sweep and the colour cover exactly them.
      const a = wd.flags.indexOf(true), b = wd.flags.lastIndexOf(true);
      let l = 0, r = 0;
      if (a >= 0) { l = wd.x + measure(c, wd.s.slice(0, a), st) + (a ? st.tracking! : 0); r = wd.x + measure(c, wd.s.slice(0, b + 1), st); spans.push([l, r, wd.line]); }
      if (k <= 0) return;
      const yy = y + (1 - k) * size * 1.05 - out * size * 1.2, alpha = clamp(k * 1.6) * (1 - out);
      c.save(); c.beginPath(); c.rect(0, y - size * 1.05, W, size * 1.38); c.clip();
      if (a < 0 || sIn < 1) txt(c, wd.s, wd.x, yy, { ...st, alpha });
      else {
        txt(c, wd.s.slice(0, a), wd.x, yy, { ...st, alpha });
        txt(c, wd.s.slice(a, b + 1), l, yy, { ...st, color: pg.accent, alpha });
        txt(c, wd.s.slice(b + 1), r, yy, { ...st, alpha });
      }
      c.restore();
    });
    // Join the marked runs per line, then sweep and underline each run.
    const runs: [number, number, number][] = [];
    for (const s of spans) { const last = runs[runs.length - 1]; if (last && last[2] === s[2]) last[1] = s[1]; else runs.push([...s]); }
    for (const [l, r, ln] of runs) {
      if (out === 0) sweep(c, l - 10, r + 10, yOf(ln) + size * .04, size * .8, sIn, sOut, pg.accent);
      c.save(); c.globalAlpha *= 1 - out; underline(c, l, r, yOf(ln) + size * .3, ul, pg.accent, 10); c.restore();
    }
    safeGuide(c, '9:16', p.safeGuide);
  });
}
