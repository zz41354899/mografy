// Wide quote, after the montage's slogan pill: a light arc swoops in and runs once round a wide pill, the quote
// types itself inside, the attribution sharpens in below, and the pill closes into a dot on the way out.
import type { FrameContext } from '@mografy/runtime';
import { exitOf, keys, safeGuide, safeParam, stage, type C2D, type TemplateInfo } from './kit.js';
import { K, P, W, bez, blurLayer, bloom, clamp, comet, conic, devScale, dot, eio, glow, ground, joinSegs, kin, lerp, look, mixc, montageParams, pAt, polyPath, rgba, rr, rrPts, setFont, textW, vignette } from './montage.js';

export const template = {
  id: 'quote-wide', name: 'Quote pill', category: 'slides', aspect: '16:9',
  summary: 'A light arc draws a wide neon pill, the quote types itself inside, and the attribution sharpens in below.',
  agentHint: 'One-sentence quote or principle for a talk, a launch film or a testimonial: under ~60 characters reads on one line, up to ~120 wraps to two. Leave the quote marks out; the template adds them. Neon or night reads best.',
  principles: ['staging', 'arcs', 'timing', 'anticipation'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 5.5, fps: 30, background: '#040507' };

export const params = {
  quote: { name: 'Quote', type: 'string' as const, default: 'The best plan is the one your whole team can see.' },
  author: { name: 'Author', type: 'string' as const, default: 'Maya Chen, Northwind' },
  ...montageParams('neon'), ...safeParam,
};

const CX = W / 2, CY = 520, FS = 54, LH = 78, MAXW = 1480;

function wrap(c: CanvasRenderingContext2D, s: string) {
  const lines: string[] = []; let ln = '';
  for (const word of s.split(/\s+/).filter(Boolean)) { const nx = ln ? `${ln} ${word}` : word; if (ln && lines.length < 1 && textW(c, nx, FS, 500) > MAXW) { lines.push(ln); ln = word; } else ln = nx; }
  lines.push(ln); return lines;
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), d = meta.duration, out = exitOf(time, d, .5), flow = time * .9;
  stage(ctx, '16:9', c => {
    ground(c, p, time, { orbA: K.teal, orbB: K.violet });
    const q = `“${String(p.quote).trim().replace(/^["“”']+|["“”']+$/g, '')}”`;
    const lines = wrap(c, q), n = lines.length, lw = Math.max(...lines.map(s => textW(c, s, FS, 500)));
    const w0 = Math.max(680, lw + 170), h0 = n > 1 ? 232 : 140;
    // Exit: the pill closes into a dot, like the montage's slogan pill.
    const sh = eio(P(time, d - .58, d - .18)), w = lerp(w0, 24, sh), h = lerp(h0, 24, sh), y = CY;
    // One line sits in a pill; two lines in a softer rounded card, so the text never runs into the round ends.
    const R0 = n > 1 ? 72 : h0 / 2, r = Math.min(h / 2, lerp(R0, 12, sh));

    // The light arc: swoops round below, comes up at the pill's left end and runs once round it.
    const arc = joinSegs([bez([CX + 40, y + 40], [CX + w0 * .95, y + 470], [CX - w0 / 2 - 40, y + 420], [CX - w0 / 2, y], 120), rrPts(CX, y, w0, h0, R0, 240)]);
    const s = keys([[.12, 0], [.85, arc.marks[0]!], [1.5, arc.marks[1]!]])(time);
    const body = P(time, 1.15, 1.55), rimA = P(time, 1.35, 1.6) * (1 - P(time, d - .25, d - .1));
    if (body > 0) {
      c.save(); c.globalAlpha *= body * (1 - P(time, d - .2, d));
      if (!lk.dark) { c.shadowColor = 'rgba(28,46,64,.14)'; c.shadowBlur = 44 * devScale(c); c.shadowOffsetY = 14 * devScale(c); }
      rr(c, CX - w / 2, y - h / 2, w, h, r); c.fillStyle = rgba(mixc(lk.dark ? '#0B0E14' : '#FFFFFF', K.teal, sh)); c.fill(); c.restore();
    }
    if (rimA > 0) {
      const pts = rrPts(CX, y, w, h, r, 200);
      if (lk.dark) {
        // neonRim with its bloom kept to the pill (a full-frame bloom every frame is the slowest thing here)
        const st = (x: C2D) => { polyPath(x, pts); x.strokeStyle = conic(x, CX, y, flow); x.lineWidth = 3.6; x.lineJoin = 'round'; x.stroke(); };
        c.save(); c.globalAlpha *= rimA; st(c); c.restore(); bloom(c, st, { radius: 14, strength: 1.2 * rimA, halo: 1, bounds: [CX - w / 2 - 10, y - h / 2 - 10, w + 20, h + 20] });
      }
      else { c.save(); c.globalAlpha *= rimA; rr(c, CX - w / 2, y - h / 2, w, h, r); c.strokeStyle = conic(c, CX, y, flow); c.lineWidth = 3.2; c.stroke(); c.restore(); }
    }
    const ta = 1 - P(time, 1.45, 1.8);
    if (ta > 0 && time > .12) {
      const head = pAt(arc.path, s);
      const emit = (x: C2D) => { comet(x, arc.path, s, { len: 2300, lw: 4, per: 1900, fade: .8, step: 14 }); if (time < 1.5) dot(x, head[0], head[1], 6, lk.dark ? '#FFFFFF' : K.teal); };
      c.save(); c.globalAlpha *= ta; emit(c); c.restore();
      bloom(c, emit, { radius: 12, strength: (lk.dark ? 1.2 : .5) * ta, mode: lk.dark ? 'lighter' : 'source-over', bounds: [CX - w0 / 2 - 80, y - h0 / 2 - 80, w0 + 160, h0 / 2 + 640] });
    }
    if (sh > .85) { c.save(); c.globalCompositeOperation = lk.dark ? 'lighter' : 'source-over'; glow(c, CX, y, 80, K.teal, .4 * P(sh, .85, 1) * (1 - P(time, d - .15, d))); c.restore(); }

    // The quote types inside the pill, line after line, with a teal caret.
    const len = [...lines.join('')].length, rate = Math.max(36, len / 1.1), typed = (time - 1.55) * rate, ga = 1 - P(time, d - .7, d - .5);
    if (typed > 0 && ga > 0) {
      let left = typed; const ty0 = y - (n - 1) * LH / 2;
      const draw = (x: C2D) => {
        setFont(x, FS, 500); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = lk.ink; left = typed;
        lines.forEach((ln, i) => {
          const ch = [...ln], k = Math.floor(clamp(left, 0, ch.length)), part = ch.slice(0, k).join(''), lx = CX - textW(x, ln, FS, 500) / 2, ly = ty0 + i * LH + 2;
          setFont(x, FS, 500); x.fillText(part, lx, ly);
          if (left >= 0 && left < ch.length + (i === n - 1 ? 8 : 0) && (time * 1.6) % 1 < .6 && (i === n - 1 || left < ch.length)) { x.fillStyle = K.teal; x.fillRect(lx + x.measureText(part).width + 5, ly - 28, 3, 56); x.fillStyle = lk.ink; }
          left -= ch.length;
        });
      };
      const fadeOut = P(time, d - .7, d - .5);
      if (fadeOut > 0) blurLayer(c, 'quote-out', 14 * fadeOut, draw, { alpha: ga, bounds: [CX - w0 / 2, y - h0 / 2, w0, h0] });
      else draw(c);
    }
    // The attribution sharpens in once the quote has landed.
    const typedEnd = 1.55 + len / rate;
    kin(c, String(p.author), CX, y + h0 / 2 + 74, 32, lk.mut, time - typedEnd - .1, { w: 500, st: .015, d: .5, tint: false, out: Math.max(out, P(time, d - .7, d - .45)) });
    if (lk.dark) vignette(c, .5);
    safeGuide(c, '16:9', p.safeGuide);
  });
}
