// Before / after, side by side: the left half fills with a crooked pile of twelve manual steps, some struck through;
// a comet of light runs down the middle and draws the split, the left half dims, and on the right one glass pill
// lands with its checked result while the headline sharpens in from the spectrum.
import type { FrameContext } from '@mografy/runtime';
import { exitOf, safeGuide, safeParam, spring, stage, type C2D, type TemplateInfo } from './kit.js';
import { K, P, W, bloom, clamp, conic, dot, eo, glow, ground, kin, layer, lerp, lightTrail, look, mkPath, montageParams, rgba, rnd, rr, setFont, specLinear, textW, vignette } from './montage.js';

export const template = {
  id: 'before-after-wide', name: 'Before and after', category: 'explain', aspect: '16:9', pair: 'before-after',
  summary: 'Twelve crooked manual steps fill the left half, a comet draws the split, and one checked result lands on the right.',
  agentHint: 'Contrast the old way with the product in a landscape film. Write each label as "Kicker: Headline" (headline 1–3 words, under ~16 characters; [brackets] take the spectrum). The twelve steps and the result line are STEPS and the Result param; a full-frame explainer, not an overlay.',
  principles: ['staging', 'timing', 'follow-through', 'exaggeration'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 5, fps: 30, background: '#06080C' };

export const params = {
  before: { name: 'Before', type: 'string' as const, default: 'Before: 12 manual steps' },
  after: { name: 'After', type: 'string' as const, default: 'After: [One click.]' },
  result: { name: 'Result', type: 'string' as const, default: 'Report sent to the team' },
  ...montageParams('night'), ...safeParam,
};

const STEPS = ['Export the CSV', 'Clean the columns', 'Copy to the sheet', 'Fix the formulas', 'Check last week', 'Build the chart',
  'Paste into slides', 'Resize the chart', 'Write the summary', 'Email the team', 'Answer questions', 'Repeat on Monday'];
const STRUCK = [1, 3, 4, 7, 9, 10];
const SPLIT = W / 2, LC = 480, RC = 1440, KY = 318, HY = 398, SIZE = 76;
const CW = 228, CH = 60, GAP = 16, GY = 500, LINE: [number, number] = [150, 930];
/** When the comet runs down the split, when the left half dims and when the after lands. */
const RUN = 1.45, DIM = 1.85, LAND = 2.15;

/** "Kicker: Headline" → both parts, with the [bracketed] range of the headline in plain-text indices. */
function label(raw: string) {
  const i = raw.indexOf(':'), kicker = i < 0 ? '' : raw.slice(0, i).trim(), h = (i < 0 ? raw : raw.slice(i + 1)).trim();
  const a = h.indexOf('['), b = h.indexOf(']');
  return { kicker, head: h.replace(/[[\]]/g, ''), n0: a < 0 ? -1 : a, n1: b < 0 ? -1 : b - 1 };
}
/** Kicker and headline centred on `cx`; the bracketed words take the spectrum. Returns the headline width. */
function heading(c: C2D, raw: string, cx: number, t: number, ink: string, kick: string, a: number, out: number) {
  const l = label(raw), size = Math.min(SIZE, SIZE * 760 / Math.max(1, textW(c, l.head, SIZE, 600)));
  if (l.kicker) kin(c, l.kicker, cx, KY, 28, kick, t, { w: 600, tint: false, a, out });
  kin(c, l.head, cx, HY, size, ink, t - .12, {
    w: 600, st: .028, a, out, colAt: (i: number) => i >= l.n0 && i <= l.n1 ? 'fill' : ink,
    fill: (x: C2D, x0: number) => specLinear(x, x0 + textW(x, l.head.slice(0, Math.max(0, l.n0)), size, 600), 0, x0 + textW(x, l.head.slice(0, l.n1 + 1), size, 600), 0, [K.teal, K.sky, K.violet]),
  });
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), d = meta.duration, out = exitOf(time, d, .55), dark = lk.dark, flow = time * .5;
  const dim = eo(P(time, DIM, DIM + .5));
  stage(ctx, '16:9', c => {
    ground(c, p, time, { orbA: K.violet, orbB: K.teal });
    // the after's light: a soft pool on the right half once it lands
    c.save(); c.globalCompositeOperation = dark ? 'lighter' : 'source-over';
    glow(c, RC, 640, 560, K.teal, (dark ? .16 : .2) * eo(P(time, LAND, LAND + .8)) * (1 - out)); c.restore();

    // ---- before: the kicker and headline, then a crooked pile of steps; it dims once the split is drawn
    heading(c, String(p.before), LC, time - .05, lk.ink, lk.mut, lerp(1, .5, dim), out);
    const chipFill = dark ? 'rgba(255,255,255,.035)' : '#FFFFFF', chipLine = lk.line;
    layer(c, 'ba-before', lerp(1, .42, dim) * (1 - out), (x: C2D) => {
      const x0 = LC - (3 * CW + 2 * GAP) / 2;
      STEPS.forEach((s, i) => {
        const k = spring(time, .2 + i * .055, .45, .2); if (k <= 0) return;
        const col = i % 3, row = Math.floor(i / 3), jx = (rnd(i) - .5) * 14, jy = (rnd(i + 20) - .5) * 10, rot = (rnd(i + 40) - .5) * .07;
        const cx = x0 + col * (CW + GAP) + CW / 2 + jx, cy = GY + row * (CH + GAP) + CH / 2 + jy;
        x.save(); x.globalAlpha *= clamp(k * 1.6); x.translate(cx, cy + (1 - k) * 26); x.rotate(rot * k + (1 - k) * .12);
        rr(x, -CW / 2, -CH / 2, CW, CH, 14); x.fillStyle = chipFill; x.fill(); x.strokeStyle = chipLine; x.lineWidth = 1.5; x.stroke();
        setFont(x, 21, 500); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = lk.mut; x.fillText(s, 0, 1);
        const j = STRUCK.indexOf(i), sk = j < 0 ? 0 : eo(P(time, .95 + j * .07, 1.2 + j * .07));
        if (sk > 0) {
          const half = textW(x, s, 21, 500) / 2 + 3;
          x.strokeStyle = dark ? '#5B6574' : '#A3ADB8'; x.lineWidth = 2.5; x.lineCap = 'round';
          x.beginPath(); x.moveTo(-half, 2); x.lineTo(-half + 2 * half * sk, 2 - 2 * sk); x.stroke();
        }
        x.restore();
      });
    }, { bounds: [LC - 420, GY - 40, 840, 4 * (CH + GAP) + 70] });

    // ---- the split: a comet runs down the middle and leaves a thin spectrum line that retracts on the way out
    const path = mkPath([[SPLIT, LINE[0] - 40], [SPLIT, LINE[1]]]), s = path.len * eo(P(time, RUN, RUN + .7));
    const trail = 1 - P(time, RUN + .7, RUN + 1.2);
    if (s > 0 && trail > 0) lightTrail(c, path, s, { len: 620, lw: 3, a: trail * (1 - out), head: trail > .5, per: 1600 });
    const rest = P(time, RUN + .45, RUN + .9), shrink = out * (LINE[1] - LINE[0]) / 2;
    if (rest > 0) {
      const y0 = LINE[0] + shrink, y1 = Math.min(LINE[0] + s - 40, LINE[1]) - shrink;
      if (y1 > y0) { c.save(); c.globalAlpha *= rest * .55 * (1 - out); c.fillStyle = specLinear(c, 0, LINE[0], 0, LINE[1], [K.teal, K.sky, K.violet]); c.fillRect(SPLIT - 1, y0, 2, y1 - y0); c.restore(); }
    }

    // ---- after: the kicker and headline, then one glass pill with the checked result
    heading(c, String(p.after), RC, time - LAND + .1, lk.ink, dark ? '#7FE3D2' : '#0F9C8E', 1, out);
    const land = spring(time, LAND + .25, .55, .16);
    if (land > 0) {
      const text = String(p.result);
      setFont(c, 32, 600); const pw = Math.min(800, c.measureText(text).width + 190), ph = 112, py = GY + 1.5 * (CH + GAP) + CH / 2 - 4;
      layer(c, 'ba-after', clamp(land * 1.5) * (1 - out), (x: C2D) => {
        x.save(); x.translate(RC, py + (1 - land) * 40); x.scale(lerp(.86, 1, land), lerp(.86, 1, land));
        if (!dark) { x.shadowColor = 'rgba(28,46,64,.14)'; x.shadowBlur = 36; x.shadowOffsetY = 14; }
        rr(x, -pw / 2, -ph / 2, pw, ph, ph / 2); x.fillStyle = dark ? '#0B0E14' : '#FFFFFF'; x.fill(); x.shadowColor = 'transparent';
        rr(x, -pw / 2, -ph / 2, pw, ph, ph / 2); x.strokeStyle = conic(x, 0, 0, flow); x.lineWidth = 3; x.stroke();
        // the check fills, then its tick draws
        const ck = eo(P(time, LAND + .5, LAND + .8)), tick = eo(P(time, LAND + .7, LAND + 1.05)), bx = -pw / 2 + 62;
        dot(x, bx, 0, 30, rgba(dark ? '#222936' : '#E3E8EC'));
        dot(x, bx, 0, 30 * ck, K.teal);
        if (tick > 0) {
          x.strokeStyle = '#FFFFFF'; x.lineWidth = 5; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath();
          const pts: [number, number][] = [[bx - 12, 1], [bx - 3, 10], [bx + 13, -9]], segA = Math.min(1, tick * 2), segB = clamp(tick * 2 - 1);
          x.moveTo(pts[0][0], pts[0][1]); x.lineTo(lerp(pts[0][0], pts[1][0], segA), lerp(pts[0][1], pts[1][1], segA));
          if (segB > 0) x.lineTo(lerp(pts[1][0], pts[2][0], segB), lerp(pts[1][1], pts[2][1], segB)); x.stroke();
        }
        setFont(x, 32, 600); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = lk.ink; x.fillText(text, bx + 58, 1);
        x.restore();
      }, { bounds: [RC - pw / 2 - 70, py - 110, pw + 140, 260] });
      // a short bloom on the check as it completes
      const flash = P(time, LAND + .7, LAND + .85) * (1 - P(time, LAND + .9, LAND + 1.4));
      if (flash > 0 && dark) bloom(c, x => dot(x, RC - pw / 2 + 62, py, 34, K.teal), { radius: 22, strength: flash * 1.2, halo: .9 });
    }
    if (dark) vignette(c, .4);
    safeGuide(c, '16:9', p.safeGuide);
  });
}
