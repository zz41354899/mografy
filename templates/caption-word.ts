// Word-by-word subtitles: an orange line opens upward into a dark picture window, and on the white band below it
// the caption builds word by word at speech pace; each key word is swept by the orange block as it is spoken.
import { colorLerp } from '@mografy/runtime';
import type { FrameContext, SetupContext } from '@mografy/runtime';
import { at, clamp, ease, exitOf, lerp, safeGuide, safeParam, springs, stage, type TemplateInfo } from './kit.js';
import { CX, MX, SANS, W, cover, editorialParams, editorialScreen, loadPhoto, measure, page, paper, sweep, txt, type Ink, type Page } from './editorial.js';

export const template = {
  id: 'caption-word', name: 'Word captions', category: 'caption', aspect: '9:16',
  summary: 'A line opens into a picture window; below it the subtitles build word by word and each key word is swept in orange.',
  agentHint: 'Spoken subtitles for a voice-over: 2–3 lines of up to ~24 characters, one per "\\n"; mark key words with [brackets] (default: the last word of each line). Put assets/caption.jpg in the project for the picture, or play it with backdrop false over your own footage.',
  principles: ['timing', 'staging', 'follow-through', 'slow in and slow out'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 5, fps: 30, background: '#FFFFFF' };

export const params = {
  text: { name: 'Caption', type: 'string' as const, default: 'We built Northwind\nfor teams that ship\nwithout the busywork' },
  ...editorialParams, ...safeParam,
};

export async function setup(ctx: SetupContext) { await loadPhoto(ctx, 'caption.jpg'); }

const WB = 1150, SIZE = 80, WORD = .24, LINE_PAUSE = .12, T0 = .45;

interface Word { s: string; x: number; w: number; line: number; key: boolean; t: number }

function picture(c: CanvasRenderingContext2D, ctx: FrameContext, pg: Page, time: number) {
  const img = ctx.assets.photo as (CanvasImageSource & { width: number; height: number }) | undefined;
  const zoom = lerp(1.07, 1, at(time, .1, 1.5, ease.outCubic));
  c.save(); c.translate(CX, WB / 2); c.scale(zoom, zoom); c.translate(-CX, -WB / 2);
  if (img) cover(c, img, 0, 0, W, WB, .5, .45);
  else {
    // The stand-in screen sits below the platform's top overlay; its own ground continues above it.
    c.fillStyle = '#1C1C1C'; c.fillRect(0, 0, W, 120);
    c.translate(0, 120); editorialScreen(c, W, WB - 120, pg, time - .2, { title: 'This week', label: 'Tasks shipped by the team' });
  }
  c.restore();
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, out = exitOf(time, d, .5);
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    const overlay = p.backdrop === false;

    // Window: the line draws out from the centre, the window opens upward out of it, and closes back at the end.
    const line = at(time, 0, .28, ease.inOutCubic), open = at(time, .22, 1, springs.camera), close = at(time, d - .7, d - .2, ease.inOutCubic);
    const top = lerp(lerp(WB, 0, open), WB, close);
    if (!overlay && WB - top > 1) { c.save(); c.beginPath(); c.rect(0, top, W, WB - top); c.clip(); picture(c, ctx, pg, time); c.restore(); }
    const retract = at(time, .75, 1.2, ease.inOutCubic) * (1 - at(time, d - .95, d - .7, ease.inOutCubic));
    const half = 540 * line * (1 - at(time, d - .25, d, ease.inOutCubic));
    if (half > 0 && retract < 1) {
      c.fillStyle = pg.accent;
      for (const y of !overlay && WB - top > 2 ? [top - 3, WB - 3] : [WB - 3]) { c.fillRect(CX - half, y, half * (1 - retract), 6); c.fillRect(CX + half * retract, y, half * (1 - retract), 6); }
    }

    // Lay the caption out: lines at the margin, one size for all, words timed at speech pace.
    const rawLines = String(p.text).split('\n').map(s => s.trim()).filter(Boolean).slice(0, 3);
    const probe: Ink = { size: SIZE, color: pg.ink, family: SANS, weight: 800 };
    const clean = (s: string) => s.replace(/[[\]]/g, '');
    const widest = Math.max(1, ...rawLines.map(l => measure(c, clean(l), probe)));
    const size = Math.min(SIZE, SIZE * 880 / widest), lh = size * 1.26, st: Ink = { ...probe, size };
    const words: Word[] = [];
    let t = T0;
    rawLines.forEach((ln, li) => {
      const parts = ln.split(/\s+/), marked = parts.some(w => w.includes('['));
      let x = MX, inMark = false;
      parts.forEach((raw, i) => {
        const opens = raw.includes('['), key = marked ? inMark || opens : i === parts.length - 1;
        if (opens) inMark = true;
        if (raw.includes(']')) inMark = false;
        const s = clean(raw), w = measure(c, s, st);
        words.push({ s, x, w, line: li, key, t });
        x += w + measure(c, ' ', st); t += WORD + (s.length > 7 ? .08 : 0);
      });
      t += LINE_PAUSE;
    });
    const n = rawLines.length, base0 = WB + 160 + (3 - n) * lh * .5;

    // Overlay mode: a white panel stands in for the band, opening down from the line.
    if (overlay) {
      const pTop = base0 - size * .74 - 46, pBot = base0 + (n - 1) * lh + size * .24 + 46;
      const k = open * (1 - close);
      c.fillStyle = pg.paper; c.fillRect(MX - 40, pTop, W - 2 * (MX - 40), (pBot - pTop) * k);
    }

    // The newest key word wins the accent; earlier ones settle back to ink.
    const keys = words.filter(w => w.key);
    words.forEach(w => {
      const y = base0 + w.line * lh, k = at(time, w.t, w.t + .32, ease.outQuint);
      if (k <= 0) return;
      let color = pg.ink;
      if (w.key) {
        const sIn = at(time, w.t + .04, w.t + .26, ease.inOutCubic), sOut = at(time, w.t + .26, w.t + .52, ease.inOutCubic);
        const next = keys[keys.indexOf(w) + 1];
        const fade = next ? at(time, next.t + .26, next.t + .6, ease.inOutCubic) : 0;
        color = sIn >= 1 ? colorLerp(pg.ink, pg.accent, 1 - fade) : pg.ink;
        if (out === 0) sweep(c, w.x - 8, w.x + w.w + 8, y + size * .06, size * .86, sIn, sOut, pg.accent);
      }
      c.save(); c.beginPath(); c.rect(0, y - size * 1.1, W, size * 1.42); c.clip();
      txt(c, w.s, w.x, y + (1 - k) * size * .9 - out * size * 1.2, { ...st, color, alpha: clamp(k * 1.6) * (1 - out) });
      c.restore();
    });
    safeGuide(c, '9:16', p.safeGuide);
  });
}
