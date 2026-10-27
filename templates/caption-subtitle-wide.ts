// Wide subtitle: over the film's picture, the line sharpens in glyph by glyph on a soft scrim, a short spectrum
// underline draws out from the centre, and the speaker settles in below it in the quiet colour.
import type { FrameContext } from '@mografy/runtime';
import { exitOf, safeGuide, safeParam, stage, type C2D, type TemplateInfo } from './kit.js';
import { APP, H, K, P, W, appUI, bloom, eio, eo, ground, kin, lerp, look, montageParams, rgba, specLinear, textW, vignette } from './montage.js';

export const template = {
  id: 'caption-subtitle-wide', name: 'Wide subtitle', category: 'caption', aspect: '16:9', pair: 'caption-subtitle',
  summary: 'A subtitle sharpens in over the picture on a soft scrim, a short spectrum underline draws, and the speaker follows.',
  agentHint: 'Subtitle or pull quote over footage in a landscape film: one sentence (wraps to two lines past ~45 characters) and a speaker line. Play it with `backdrop: false` over your own picture; the product screen underneath is only a stand-in.',
  principles: ['timing', 'staging', 'slow in and slow out', 'secondary action'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 4, fps: 30, background: '#06080C' };

export const params = {
  text: { name: 'Subtitle', type: 'string' as const, default: 'We built Northwind for teams that ship.' },
  speaker: { name: 'Speaker', type: 'string' as const, default: 'Maya Chen · Founder, Northwind' },
  ...montageParams('night'), ...safeParam,
};

const SIZE = 58, LH = 76, MAXW = 1500, BASE = 846, UY = 906, SY = 952;

/** Stand-in for the film's own picture: a product screen recording on the ground, darkened toward the bottom. */
function picture(c: CanvasRenderingContext2D, p: Readonly<Record<string, unknown>>, t: number, g: string) {
  ground(c, p, t, { orbs: false });
  const s = 1.2;
  c.save(); c.translate(W / 2 - APP.w * s / 2, 64); c.scale(s, s); appUI(c, { dark: g !== 'light', t, title: 'Northwind · Q3 roadmap' }); c.restore();
  // darker toward the bottom, where subtitles sit (only the lower half is filled: full-frame fills are not free)
  const dk = c.createLinearGradient(0, H / 2, 0, H); dk.addColorStop(0, 'rgba(4,6,10,0)'); dk.addColorStop(1, `rgba(4,6,10,${g === 'light' ? .2 : .6})`);
  c.fillStyle = dk; c.fillRect(0, H / 2, W, H / 2);
  if (g !== 'light') vignette(c, .4);
}

/** One line if it fits, otherwise the most balanced break into two lines. */
function wrap(c: CanvasRenderingContext2D, s: string, size: number, w: number, maxW: number) {
  const words = s.split(/\s+/).filter(Boolean), all = words.join(' ');
  if (words.length < 2 || textW(c, all, size, w) <= maxW) return [all];
  let best = [all], bw = Infinity;
  for (let i = 1; i < words.length; i++) { const a = words.slice(0, i).join(' '), b = words.slice(i).join(' '), m = Math.max(textW(c, a, size, w), textW(c, b, size, w)); if (m < bw) { bw = m; best = [a, b]; } }
  return best;
}

/** A soft oval scrim: readable copy over any picture, and on its own with `backdrop: false`. */
function scrim(c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, col: string, a: number) {
  if (a <= 0) return;
  c.save(); c.translate(cx, cy); c.scale(rx / ry, 1);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, ry); [[0, 1], [.3, .9], [.55, .58], [.78, .22], [1, 0]].forEach(([o, k]) => g.addColorStop(o!, rgba(col, a * k!)));
  c.fillStyle = g; c.fillRect(-ry, -ry, ry * 2, ry * 2); c.restore();
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), d = meta.duration, out = exitOf(time, d, .5);
  stage(ctx, '16:9', c => {
    if (p.backdrop !== false) picture(c, p, time, lk.g);
    const light = lk.g === 'light', ink = light ? K.ink : '#FFFFFF', mut = light ? '#4B5563' : '#AEB8C6';
    const lines = wrap(c, String(p.text), SIZE, 600, MAXW), n = lines.length;
    const maxW = Math.max(...lines.map(s => textW(c, s, SIZE, 600)));
    // The scrim breathes in first, so the frame already reads at 0.3 s.
    const sa = eo(P(time, 0, .45)) * (1 - out);
    if (light) {
      // On the light ground the scrim is a frosted glass panel instead of a shadow.
      const top = BASE - (n - 1) * LH - 62, pw = maxW + 150, ph = SY + 44 - top, k = lerp(.97, 1, eo(P(time, 0, .5)));
      // a soft shadow drawn as a cheap gradient scrim (shadowBlur on a panel this big is slow on CPU canvases)
      scrim(c, W / 2, top + ph / 2 + 20, pw / 2 + 60, ph / 2 + 70, '#141C2A', .2 * sa);
      c.save(); c.globalAlpha *= sa; c.translate(W / 2, top + ph / 2); c.scale(k, k);
      c.beginPath(); c.roundRect(-pw / 2, -ph / 2, pw, ph, 36); c.fillStyle = 'rgba(255,255,255,.86)'; c.fill();
      c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 1.5; c.stroke(); c.restore();
    } else scrim(c, W / 2, BASE + 30 - (n - 1) * LH / 2, maxW / 2 + 340, 250 + (n - 1) * 50, lk.g === 'neon' ? '#000000' : '#05070C', .7 * sa);
    // The subtitle: glyphs rise and sharpen out of a spectrum blur, line by line.
    lines.forEach((s, i) => {
      kin(c, s, W / 2, BASE - (n - 1 - i) * LH, SIZE, ink, time - .18 - i * .12, { w: 600, st: Math.min(.022, .7 / Math.max(1, [...s].length)), d: .5, out, lift: .2, hue: i * .2 });
    });
    // A short spectrum underline draws out from the centre, then retracts on the way out.
    const uw = 150 * eo(P(time, .75, 1.3)) * (1 - eio(P(time, d - .5, d - .1)));
    if (uw > 1) {
      const line = (x: C2D) => { x.fillStyle = specLinear(x, W / 2 - uw / 2, 0, W / 2 + uw / 2, 0, [K.teal, K.sky, K.violet]); x.beginPath(); x.roundRect(W / 2 - uw / 2, UY - 2, uw, 4, 2); x.fill(); };
      line(c);
      if (!light) bloom(c, line, { radius: 8, strength: .9, halo: .6, bounds: [W / 2 - 120, UY - 20, 240, 40] });
    }
    // The speaker: the name a touch brighter than the role.
    const sp = String(p.speaker), cut = sp.indexOf('·');
    kin(c, sp, W / 2, SY, 28, mut, time - .95, { w: 500, st: .012, d: .45, tint: false, out, colAt: i => cut > 0 && i < cut ? (light ? K.ink : '#E3E8EF') : mut });
    safeGuide(c, '16:9', p.safeGuide);
  });
}
