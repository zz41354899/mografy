// Wide bullet points, after the montage's Write → Tune → Score → Present: one outline with a spectrum rim morphs
// from a pill to a track to a wave to a ring, each point a big kinetic word above it; when the next point arrives,
// the word shrinks into a quiet list on the left. At the end the ring closes into a dot.
import type { FrameContext } from '@mografy/runtime';
import { exitOf, safeGuide, safeParam, spring, stage, type C2D, type TemplateInfo } from './kit.js';
import { K, P, SPEC, W, bloom, circlePts, conic, devScale, dot, eio, eo, fnPts, ground, kin, lerp, lerpPts, look, mixc, montageParams, polyPath, resample, rrPts, textW } from './montage.js';

export const template = {
  id: 'bullet-points-wide', name: 'Morphing points', category: 'slides', aspect: '16:9',
  summary: 'One outline morphs pill → track → wave → ring under each point in big kinetic type; earlier points settle into a list on the left.',
  agentHint: 'Three to four short points for a talk, a pitch or a product walkthrough, one per line (each 1–3 words, under ~18 characters); a fifth point reuses the pill. The shapes read as write (a field), tune (a slider), pulse (a wave) and present (play), so order the points to match.',
  principles: ['staging', 'timing', 'squash and stretch', 'follow-through'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 6, fps: 30, background: '#F4F6F8' };

export const params = {
  points: { name: 'Points', type: 'string' as const, default: 'Write the plan\nTune the timeline\nTrack the pulse\nPresent it' },
  ...montageParams('light'), ...safeParam,
};

const CX = W / 2, WY = 400, SY = 600, WS = 92, LS = 30, LX = 150, LY0 = 470, LGAP = 62, N = 200;

/** A thin closed band that follows a travelling wave (the montage's "Score" shape). */
function wavePts(cx: number, cy: number, w: number, amp: number, th: number, ph: number, n = N) {
  const wy = (x: number) => { const u = (x - (cx - w / 2)) / w; return amp * Math.sin(Math.PI * u) * Math.sin(u * 5.2 * Math.PI + ph) * (.6 + .4 * Math.sin(u * 2.3 * Math.PI + ph * .5)); };
  const top = fnPts((u: number) => [cx - w / 2 + u * w, cy + wy(cx - w / 2 + u * w) - th / 2], 100), bot = fnPts((u: number) => [cx + w / 2 - u * w, cy + wy(cx + w / 2 - u * w) + th / 2], 100);
  return resample([[cx - w / 2, cy], ...top, [cx + w / 2, cy], ...bot, [cx - w / 2, cy]], n);
}
const hexOf = (rgb: number[]) => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), d = meta.duration, out = exitOf(time, d, .5), flow = time * .6;
  const pts = String(p.points).split('\n').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const n = Math.max(1, pts.length), S = n > 1 ? Math.min(1.5, (d - .55 - 1.4 - .3) / (n - 1)) : 0;
  const a = (i: number) => .3 + i * S;
  stage(ctx, '16:9', c => {
    ground(c, p, time);
    // ---- the outline: underline → pill → track → wave → ring (cycling), then a dot
    const kind = (i: number) => i % 4;
    const shapeOf = (k: number) => k === 0 ? rrPts(CX, SY, 560, 96, 48, N) : k === 1 ? rrPts(CX, SY, 640, 10, 5, N)
      : k === 2 ? wavePts(CX, SY, 640, 46 * eo(P(time, a(2), a(2) + .5)), 10, time * 3.2) : circlePts(CX, SY, 100, N);
    let shape: number[][] = rrPts(CX, SY, lerp(24, 560, eo(P(time, .02, .35))), 6, 3, N);
    if (time >= .3) shape = lerpPts(shape, shapeOf(kind(0)), eio(P(time, .3, .62)));
    for (let i = 1; i < n; i++) if (time >= a(i) - .15) shape = lerpPts(shapeOf(kind(i - 1)), shapeOf(kind(i)), eio(P(time, a(i) - .15, a(i) + .25)));
    const close = eio(P(time, d - .62, d - .22));
    if (close > 0) shape = lerpPts(shape, circlePts(CX, SY, 8, N), close);
    const shapeA = 1 - P(time, d - .3, d - .05), fillA = P(time, .3, .55) * (1 - close);
    const sc = devScale(c);
    c.save(); c.globalAlpha *= shapeA;
    if (fillA > 0) { c.save(); c.globalAlpha *= fillA; if (!lk.dark) { c.shadowColor = 'rgba(28,46,64,.14)'; c.shadowBlur = 44 * sc; c.shadowOffsetY = 14 * sc; }
      polyPath(c, shape); c.fillStyle = lk.dark ? '#0B0E14' : '#FFFFFF'; c.fill(); c.restore(); }
    const stroke = (x: C2D) => { polyPath(x, shape); x.strokeStyle = conic(x, CX, SY, flow); x.lineWidth = 3.2; x.lineJoin = 'round'; x.stroke(); };
    stroke(c);
    bloom(c, stroke, { radius: 16, strength: (lk.dark ? 1 : .9) * shapeA, mode: lk.dark ? 'lighter' : 'source-over', halo: .7, bounds: [CX - 360, SY - 160, 720, 320] });
    if (close > .6) dot(c, CX, SY, 8, K.teal, P(close, .6, 1));
    c.restore();

    // ---- what each shape does while it holds
    for (let i = 0; i < n; i++) {
      const end = i < n - 1 ? a(i + 1) - .15 : d - .6, k = Math.min(P(time, a(i) + .25, a(i) + .45), 1 - P(time, end - .15, end)); if (k <= 0) continue;
      c.save(); c.globalAlpha *= k;
      if (kind(i) === 0 && (time * 1.6) % 1 < .6) { c.fillStyle = K.teal; c.fillRect(CX - 280 + 44, SY - 19, 3, 38); }
      if (kind(i) === 1) {
        const kx = lerp(CX - 160, CX + 130, spring(time, a(i) + .35, .55, .2));
        c.save(); if (!lk.dark) { c.shadowColor = 'rgba(28,46,64,.2)'; c.shadowBlur = 18 * sc; } dot(c, kx, SY, 26, lk.dark ? '#0B0E14' : '#FFFFFF'); c.restore();
        c.strokeStyle = conic(c, kx, SY, flow * 2); c.lineWidth = 4; c.beginPath(); c.arc(kx, SY, 26, 0, 7); c.stroke();
      }
      if (kind(i) === 3) {
        const s = spring(time, a(i) + .3, .5, .2) * .82; c.save(); c.translate(CX + 8, SY); c.scale(s, s);
        c.beginPath(); c.moveTo(-34, -42); c.lineTo(48, 0); c.lineTo(-34, 42); c.closePath(); c.lineJoin = 'round'; c.lineWidth = 10; c.fillStyle = c.strokeStyle = lk.ink; c.fill(); c.stroke(); c.restore();
      }
      c.restore();
    }

    // ---- the points: big at the centre, then shrinking into the list on the left
    pts.forEach((s, i) => {
      const bw = textW(c, s, WS, 600), mv = i < n - 1 ? eio(P(time, a(i + 1) - .3, a(i + 1) + .3)) : 0;
      const sc2 = lerp(1, LS / WS, mv), x0 = lerp(CX - bw / 2, LX + 30, mv), y = lerp(WY, LY0 + i * LGAP, mv);
      const col = hexOf(mixc(lk.ink, lk.mut, mv));
      c.save(); c.translate(x0, y); c.scale(sc2, sc2);
      kin(c, s, 0, 0, WS, col, time - a(i), { al: 'left', w: 600, st: .03, out, lift: .25 });
      c.restore();
      // The list dot lands with the word.
      if (mv > .7) dot(c, LX + 8, LY0 + i * LGAP + 1, 6, SPEC[i % 5]!, P(mv, .7, 1) * (1 - out));
    });
    safeGuide(c, '16:9', p.safeGuide);
  });
}
