// Wide end card: the headline sharpens in, a light arc swoops in below and draws a pill round the website address,
// which types itself; a button lands, a cursor clicks it and its spark fills with a small spectrum burst; a QR card
// traces in on the right.
import type { FrameContext } from '@mografy/runtime';
import { cursor, exitOf, keys, path as cursorPath, press, ring, safeGuide, safeParam, spring, stage, type C2D, type TemplateInfo } from './kit.js';
import { K, P, SPEC, W, bez, bloom, comet, conic, devScale, dot, eio, eo, ground, joinSegs, kin, layer, lerp, look, montageParams, pAt, polyPath, rnd, rr, rrPts, setFont, textW, vignette } from './montage.js';

export const template = {
  id: 'cta-endcard-wide', name: 'Website end card', category: 'end', aspect: '16:9', pair: 'cta-endcard',
  summary: 'The headline sharpens in, a light arc draws a pill round the web address, and a cursor clicks the button beside a QR card.',
  agentHint: 'Closing call to action of a landscape film or a talk: a headline under ~28 characters, an address under ~24 and a button label of 1–3 words. The QR pattern is a stand-in that does not scan: replace the modules in `qrCard()` with your real code image (load it in `setup`, draw it into the same square).',
  principles: ['anticipation', 'staging', 'arcs', 'follow-through'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 4.5, fps: 30, background: '#06080C' };

export const params = {
  headline: { name: 'Headline', type: 'string' as const, default: 'Plan your next launch.' },
  url: { name: 'Address', type: 'string' as const, default: 'northwind.app' },
  button: { name: 'Button', type: 'string' as const, default: 'Try it free' },
  ...montageParams('night'), ...safeParam,
};

const HY = 330, HS = 104, PY = 556, PH = 136, PF = 56, BY = 724, BH = 96, BF = 34, QS = 320, COLGAP = 150, CLICK = 2.75, N = 21;
const QY = (PY - PH / 2 + BY + BH / 2) / 2;

/** The four-point spark of the button (outline, filled on the click). */
function sparkPath(c: C2D, x: number, y: number, r: number) {
  c.beginPath();
  for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, q = i % 2 ? r * .36 : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
  c.closePath();
}

/** The QR card: a frame that traces itself, three finder squares, and modules that sweep in. Stand-in pattern. */
function qrCard(c: C2D, cx: number, cy: number, time: number, dark: boolean) {
  const x0 = cx - QS / 2, y0 = cy - QS / 2, line = dark ? 'rgba(255,255,255,.28)' : 'rgba(20,24,32,.2)', fg = dark ? '#E9EEF5' : '#141820';
  const pts = rrPts(cx, cy, QS, QS, 40, 160), k = eio(P(time, 1.25, 1.95)), n = Math.max(1, Math.round(k * 160));
  c.save(); c.globalAlpha *= P(time, 1.5, 1.9); rr(c, x0, y0, QS, QS, 40); c.fillStyle = dark ? 'rgba(16,20,28,.7)' : 'rgba(255,255,255,.85)'; c.fill(); c.restore();
  if (k > 0) { polyPath(c, pts.slice(0, n + 1), false); c.strokeStyle = line; c.lineWidth = 2.5; c.lineJoin = 'round'; c.stroke(); }
  const pad = 38, m = (QS - pad * 2) / N, gx = x0 + pad, gy = y0 + pad;
  const finder = (i: number, j: number) => (i < 8 && j < 8) || (i > N - 9 && j < 8) || (i < 8 && j > N - 9);
  // Modules sweep in diagonally from the top left, one path for all of them.
  const sweep = P(time, 1.75, 2.35) * (N * 2 + 6);
  if (sweep > 0) {
    c.beginPath();
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (finder(i, j) || i + j > sweep || rnd(i * 31.7 + j * 7.3 + 1) < .5) continue;
      c.rect(gx + i * m + m * .1, gy + j * m + m * .1, m * .8, m * .8);
    }
    c.fillStyle = dark ? 'rgba(233,238,245,.78)' : 'rgba(20,24,32,.78)'; c.fill();
  }
  [[0, 0], [N - 7, 0], [0, N - 7]].forEach(([fi, fj], i) => {
    const s = spring(time, 1.65 + i * .08, .45, .2); if (s <= 0) return;
    const fx = gx + fi! * m + 3.5 * m, fy = gy + fj! * m + 3.5 * m, hs = 3.5 * m;
    c.save(); c.translate(fx, fy); c.scale(s, s);
    rr(c, -hs + m * .5, -hs + m * .5, hs * 2 - m, hs * 2 - m, m * 1.4); c.strokeStyle = fg; c.lineWidth = m; c.stroke();
    rr(c, -m * 1.5, -m * 1.5, m * 3, m * 3, m * .7); c.fillStyle = fg; c.fill(); c.restore();
  });
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), d = meta.duration, out = exitOf(time, d, .5), ga = 1 - out, flow = time * .9;
  stage(ctx, '16:9', c => {
    ground(c, p, time, { orbA: K.teal, orbB: K.violet });
    const url = String(p.url), label = String(p.button);
    const pw = Math.max(480, textW(c, url, PF, 500) + 200), bw = textW(c, label, BF, 600) + 140, leftW = Math.max(pw, bw);
    const x0 = W / 2 - (leftW + COLGAP + QS) / 2, lcx = x0 + leftW / 2, qcx = x0 + leftW + COLGAP + QS / 2;

    kin(c, String(p.headline), W / 2, HY, HS, lk.ink, time - .1, { w: 600, st: .026, out });

    // The light arc swoops in below and runs once round the address pill.
    const arc = joinSegs([bez([lcx + 60, PY + 60], [lcx + pw * .95, PY + 400], [lcx - pw / 2 - 60, PY + 390], [lcx - pw / 2, PY], 110), rrPts(lcx, PY, pw, PH, PH / 2, 220)]);
    const s = keys([[.3, 0], [.95, arc.marks[0]!], [1.5, arc.marks[1]!]])(time), body = P(time, 1.2, 1.55), rimA = P(time, 1.4, 1.65);
    const typed = Math.floor(Math.max(0, (time - 1.5) * 26)), chars = [...url];
    // Pill body, rim and address fade out as one.
    layer(c, 'cta-pill', ga, x => {
      if (body > 0) { x.save(); x.globalAlpha *= body; if (!lk.dark) { x.shadowColor = 'rgba(28,46,64,.14)'; x.shadowBlur = 40 * devScale(x); x.shadowOffsetY = 12 * devScale(x); }
        rr(x, lcx - pw / 2, PY - PH / 2, pw, PH, PH / 2); x.fillStyle = lk.dark ? '#0B0E14' : '#FFFFFF'; x.fill(); x.restore(); }
      if (rimA > 0) { x.save(); x.globalAlpha *= rimA; rr(x, lcx - pw / 2, PY - PH / 2, pw, PH, PH / 2); x.strokeStyle = conic(x, lcx, PY, flow); x.lineWidth = 3.4; x.stroke(); x.restore(); }
      if (typed > 0) {
        setFont(x, PF, 500); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = lk.ink;
        const tx = lcx - textW(x, url, PF, 500) / 2, part = chars.slice(0, typed).join(''); setFont(x, PF, 500); x.fillText(part, tx, PY + 2);
        if (typed < chars.length + 10 && (time * 1.6) % 1 < .6) { x.fillStyle = K.teal; x.fillRect(tx + x.measureText(part).width + 5, PY - 26, 3, 52); }
      }
    }, { bounds: [lcx - pw / 2 - 60, PY - PH / 2 - 60, pw + 120, PH + 120] });
    if (rimA > 0 && lk.dark) {
      const st = (x: C2D) => { rr(x, lcx - pw / 2, PY - PH / 2, pw, PH, PH / 2); x.strokeStyle = conic(x, lcx, PY, flow); x.lineWidth = 3.4; x.stroke(); };
      bloom(c, st, { radius: 14, strength: 1.1 * rimA * ga, halo: .9, bounds: [lcx - pw / 2 - 10, PY - PH / 2 - 10, pw + 20, PH + 20] });
    }
    const ta = (1 - P(time, 1.45, 1.75)) * ga;
    if (ta > 0 && time > .3) {
      const head = pAt(arc.path, s);
      const emit = (x: C2D) => { comet(x, arc.path, s, { len: 1900, lw: 4, per: 1700, fade: .8, step: 14 }); dot(x, head[0], head[1], 6, lk.dark ? '#FFFFFF' : K.teal); };
      c.save(); c.globalAlpha *= ta; emit(c); c.restore();
      bloom(c, emit, { radius: 12, strength: (lk.dark ? 1.2 : .5) * ta, mode: lk.dark ? 'lighter' : 'source-over', bounds: [lcx - pw / 2 - 80, PY - PH / 2 - 60, pw + 160, 540] });
    }

    // The button lands, gets clicked, and its spark fills with a small spectrum burst.
    const bk = spring(time, 1.65, .5, .18), pr = press(time, CLICK, .07), bx = lcx - bw / 2, sx = bx + 54;
    if (bk > 0) layer(c, 'cta-button', Math.min(1, bk * 1.4) * ga, x => {
      x.translate(lcx, BY); const s2 = lerp(.86, 1, bk) * (1 - .05 * pr); x.scale(s2, s2); x.translate(-lcx, -BY);
      if (!lk.dark) { x.shadowColor = 'rgba(20,24,32,.22)'; x.shadowBlur = 26 * devScale(x); x.shadowOffsetY = 8 * devScale(x); }
      rr(x, bx, BY - BH / 2, bw, BH, BH / 2); x.fillStyle = lk.dark ? K.fg : K.ink; x.fill(); x.shadowColor = 'transparent';
      const on = lk.dark ? K.ink : '#FFFFFF', filled = P(time, CLICK, CLICK + .06), pop = 1 + .35 * Math.sin(Math.PI * P(time, CLICK, CLICK + .35));
      x.save(); x.translate(sx, BY); x.scale(pop, pop); x.rotate(.25 * eo(P(time, CLICK, CLICK + .5))); sparkPath(x, 0, 0, 18);
      if (filled > 0) { x.fillStyle = conic(x, 0, 0, flow); x.fill(); }
      else { x.strokeStyle = on; x.lineWidth = 2.6; x.lineJoin = 'round'; x.stroke(); }
      x.restore();
      setFont(x, BF, 600); x.fillStyle = on; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(label, bx + 92, BY + 1);
    }, { bounds: [bx - 60, BY - BH / 2 - 60, bw + 120, BH + 120] });
    // The burst: a few spectrum sparks fly out of the spark.
    const bu = P(time, CLICK, CLICK + .55);
    if (bu > 0 && bu < 1) for (let i = 0; i < 10; i++) {
      const an = i / 10 * Math.PI * 2 + .3, r = 24 + 60 * eo(bu) * (i % 2 ? .8 : 1);
      dot(c, sx + Math.cos(an) * r, BY + Math.sin(an) * r, 4.5 * (1 - bu * .6), SPEC[i % 5]!, (1 - bu) * ga);
    }

    if (time > 1.2) layer(c, 'cta-qr', ga, x => qrCard(x, qcx, QY, time, lk.dark), { bounds: [qcx - QS / 2 - 20, QY - QS / 2 - 20, QS + 40, QS + 40] });

    // The cursor comes in from the lower right, clicks the spark, and eases back a little.
    const [cx, cy] = cursorPath([[2.0, 1700, 1040], [2.62, sx + 6, BY + 6], [3.2, sx + 6, BY + 6], [3.65, sx + 70, BY + 70]], time);
    ring(c, sx, BY, time, CLICK, K.teal);
    cursor(c, cx, cy, { scale: 2.4, dark: lk.dark, press: pr, alpha: P(time, 2.0, 2.2) * (1 - P(time, 3.55, 3.95)) * ga });
    if (lk.dark) vignette(c, .45);
    safeGuide(c, '16:9', p.safeGuide);
  });
}
