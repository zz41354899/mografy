// Multi-window: three windows of the same board stand in depth. A card moves in the first; a small comet of light
// carries the change to the next window, where the same card moves, and on to the third.
import type { FrameContext } from '@mografy/runtime';
import { exitOf, safeGuide, safeParam, spring, stage, type C2D, type TemplateInfo } from './kit.js';
import { K, P, W, bez, bloom, clamp, comet, dot, drawPlane, eio, eo, glow, ground, kin, layer, lerp, look, mkPath, montageParams, pAt, planeProj, polyPath, rr, rrPts, setFont, specLinear, textW, texture, vignette } from './montage.js';

export const template = {
  id: 'multi-window-wide', name: 'Multi-window', category: 'screen', aspect: '16:9',
  summary: 'Three windows of one board stand in depth; a card moves in the first and a comet of light carries the change to the others in turn.',
  agentHint: 'Real-time sync or collaboration. Title under ~28 characters; [bracketed] words (else the last word) take the spectrum. The board is a stand-in: rename the columns and cards in `COLS`, or redraw `board()`.',
  principles: ['overlapping action', 'follow-through', 'arcs', 'staging'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 5, fps: 30, background: '#06080C' };

export const params = {
  title: { name: 'Title', type: 'string' as const, default: 'Everyone sees it at once' },
  ...montageParams('night'), ...safeParam,
};

type Pt = [number, number];
const BW = 1000, BH = 620;
const COLS: [string, string[]][] = [['To do', ['Write launch post', 'Record the demo', 'Pricing page']], ['Doing', ['Onboarding emails', 'Beta feedback']], ['Done', ['Brand film', 'Landing page']]];
const CX = [36, 358, 680], CW = 284, CY0 = 132, CH = 96, GAP = 14;
const TAGS = [K.violet, K.sky, K.coral, K.teal, K.amber, K.sky, K.violet];
// the three windows (front to back) and their teammates
const WINS = [
  { px: 395, py: 616, s: .56, yaw: .78, who: 'M', col: K.teal, delay: .08 },
  { px: 960, py: 600, s: .64, yaw: 0, who: 'J', col: K.violet, delay: 0 },
  { px: 1525, py: 616, s: .56, yaw: -.78, who: 'S', col: K.coral, delay: .16 },
];
const ORDER = [0, 2, 1]; // drawing order: the side windows stand behind the middle one
// when the card moves in each window, and when the light travels between them
const MOVE = [[1.0, 1.55], [2.15, 2.6], [3.2, 3.65]] as const, HOP = [[1.5, 2.2], [2.55, 3.25]] as const;
const box = (pts: Pt[], pad: number): [number, number, number, number] => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const bx = Math.floor((x0 - pad) / 32) * 32, by = Math.floor((y0 - pad) / 32) * 32;
  return [bx, by, Math.ceil((x1 + pad - bx) / 32) * 32, Math.ceil((y1 + pad - by) / 32) * 32];
};
// where the moving card starts (Doing, first) and lands (Done, first), card centres in board units
const FROM: Pt = [CX[1]! + CW / 2, CY0 + CH / 2], TO: Pt = [CX[2]! + CW / 2, CY0 + CH / 2];

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), d = meta.duration, dark = lk.dark, out = exitOf(time, d, .55), back = eio(P(time, d - .6, d));
  stage(ctx, '16:9', c => {
    ground(c, p, time, { orbA: K.teal, orbB: K.violet });
    const projs: ((x: number, y: number) => Pt)[] = [];
    for (const i of ORDER) {
      const w = WINS[i]!, k = spring(time, .02 + w.delay, .9, .1), e = eo(P(time, .02 + w.delay, 1.2 + w.delay)), side = Math.sign(w.px - 960);
      const o = { u: BW / 2, v: BH / 2, px: w.px + side * lerp(160, 0, e) + side * 40 * back, py: w.py + lerp(110, 0, k), s: w.s * lerp(.9, 1, k) * lerp(1, .94, back), yaw: w.yaw * lerp(1.3, 1, e), pitch: -.05, roll: 0, f: 1250 };
      const proj = planeProj(o) as (x: number, y: number) => Pt; projs[i] = proj;
      const a = clamp(P(time, .02 + w.delay, .3 + w.delay)) * (1 - P(time, d - .45 + i * .04, d));
      const m = MOVE[i]!, mv = P(time, m[0], m[1]), sync = i > 0 ? Math.sin(Math.PI * P(time, m[0] - .08, m[0] + .5)) : 0;
      const outline = rrPts(BW / 2, BH / 2, BW, BH, 20, 120).map(q => proj(q[0], q[1]));
      layer(c, `mw-${i}`, a, (x: C2D) => {
        // a soft elliptical shadow under the window: one gradient fill, far cheaper than a blurred outline
        const sc = proj(BW / 2, BH + 30), rw = Math.abs(outline[60]![0] - outline[0]![0]) * .6;
        x.save(); x.translate(sc[0], sc[1]); x.scale(1, .4);
        const g = x.createRadialGradient(0, 0, 0, 0, 0, rw); g.addColorStop(0, dark ? 'rgba(0,0,0,.6)' : 'rgba(28,46,64,.1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(-rw, -rw, rw * 2, rw * 2); x.restore();
        polyPath(x, outline); x.fillStyle = dark ? '#0E1219' : '#FFFFFF'; x.fill();
        const [tex, ts] = texture(x, `mw-${i}`, BW, BH, w.s, (t: C2D) => board(t, mv, P(time, m[1], m[1] + .9), w.who, w.col, dark, sync));
        // the middle window is nearly flat, so a coarse grid maps it; the turned side windows need a finer one
        drawPlane(x, tex, ts, BW, BH, proj, w.yaw ? 14 : 4, w.yaw ? 9 : 3);
      });
    }
    // the light that carries the change from one window to the next
    HOP.forEach(([t0, t1], h) => {
      const k = P(time, t0, t1); if (k <= 0 || k >= 1) return;
      const A = projs[h]!(...TO), B = projs[h + 1]!(...FROM), mid: Pt = [(A[0] + B[0]) / 2, Math.min(A[1], B[1]) - 220];
      const Pa = mkPath(bez(A, [A[0] + 40, mid[1]], [B[0] - 60, mid[1] - 20], B, 70)), s = Pa.len * eio(k);
      const fa = Math.min(1, Math.sin(Math.PI * k) * 2.2) * (1 - out);
      const em = (x: C2D) => { comet(x, Pa, s, { len: Pa.len * .7, lw: 3.2, a: fa, per: Pa.len / .8, hue: h * .25, step: 12 }); dot(x, ...(pAt(Pa, s).slice(0, 2) as Pt), 5.5, '#FFFFFF', fa); };
      em(c); bloom(c, em, { radius: 10, strength: 1.1 * fa, halo: .9, bounds: [0, 160, W, 640] });
    });
    // a soft bloom where each copy of the card lands
    MOVE.forEach(([, t1], i) => {
      const k = Math.sin(Math.PI * P(time, t1 - .12, t1 + .5)); if (k <= 0) return;
      const q = projs[i]!(...TO); c.save(); c.globalCompositeOperation = dark ? 'lighter' : 'source-over'; glow(c, q[0], q[1], 150 * WINS[i]!.s / .6, K.teal, (dark ? .4 : .3) * k); c.restore();
    });

    // title with a spectrum word
    const raw = String(p.title), plain = raw.replace(/[[\]]/g, ''), a0 = raw.indexOf('['), b0 = raw.indexOf(']');
    const n0 = a0 >= 0 && b0 > a0 ? a0 : plain.lastIndexOf(' ') + 1, n1 = a0 >= 0 && b0 > a0 ? b0 - 1 : plain.length;
    kin(c, plain, 960, 226, 84, lk.ink, time - .3, {
      w: 600, st: .026, out, colAt: (i: number) => i >= n0 && i < n1 ? 'fill' : lk.ink,
      fill: (x: C2D, x0: number) => specLinear(x, x0 + textW(x, plain.slice(0, n0), 84, 600), 0, x0 + textW(x, plain.slice(0, n1), 84, 600), 0, [K.teal, K.sky, K.violet]),
    });
    if (dark) vignette(c, .45);
    safeGuide(c, '16:9', p.safeGuide);
  });
}

/** One copy of the board. mv 0..1 moves "Onboarding emails" from Doing to Done; sync flashes the change arriving. */
function board(c: C2D, mv: number, after: number, who: string, col: string, dark: boolean, sync: number) {
  const bg = dark ? '#0E1219' : '#FFFFFF', panel = dark ? '#131822' : '#F5F7F9', line = dark ? '#252C38' : '#E2E7EC', fg = dark ? K.fg : K.ink, mut = dark ? '#7F8A99' : '#8A95A3', card = dark ? '#1A202B' : '#FFFFFF';
  rr(c, 0, 0, BW, BH, 20); c.fillStyle = bg; c.fill(); c.strokeStyle = line; c.lineWidth = 1.5; c.stroke();
  [0, 1, 2].forEach(i => { c.fillStyle = dark ? '#2B3240' : '#DCE2E8'; c.beginPath(); c.arc(30 + i * 20, 30, 6, 0, 7); c.fill(); });
  setFont(c, 17, 600); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = fg; c.fillText('Northwind · Launch board', BW / 2, 31);
  // the teammate on this window
  c.fillStyle = col; c.beginPath(); c.arc(BW - 42, 31, 16, 0, 7); c.fill(); setFont(c, 15, 700); c.fillStyle = '#FFFFFF'; c.fillText(who, BW - 42, 32);
  if (sync > 0) { c.save(); c.globalAlpha = sync; c.strokeStyle = K.teal; c.lineWidth = 3; c.beginPath(); c.arc(BW - 42, 31, 22, 0, 7); c.stroke(); c.restore(); }
  const k = eio(mv), lift = Math.sin(Math.PI * mv);
  const drawCard = (x: number, y: number, label: string, tag: string, o: { lift?: number; glow?: number } = {}) => {
    c.save();
    if (o.lift) { c.shadowColor = dark ? 'rgba(0,0,0,.6)' : 'rgba(28,46,64,.22)'; c.shadowBlur = 30 * o.lift; c.shadowOffsetY = 14 * o.lift; c.translate(x + CW / 2, y + CH / 2); c.rotate(.04 * o.lift); c.scale(1 + .05 * o.lift, 1 + .05 * o.lift); c.translate(-x - CW / 2, -y - CH / 2); }
    rr(c, x, y, CW, CH, 14); c.fillStyle = card; c.fill(); c.shadowColor = 'transparent';
    if (!dark) { c.strokeStyle = line; c.lineWidth = 1.2; c.stroke(); }
    rr(c, x + 18, y + 18, 46, 8, 4); c.fillStyle = tag; c.fill();
    setFont(c, 22, 600); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = fg; c.fillText(label, x + 18, y + 52);
    rr(c, x + 18, y + 72, 120, 6, 3); c.fillStyle = line; c.fill();
    if (o.glow) { c.globalAlpha = o.glow; rr(c, x - 1, y - 1, CW + 2, CH + 2, 15); c.strokeStyle = K.teal; c.lineWidth = 3; c.stroke(); }
    c.restore();
  };
  let tag = 0;
  COLS.forEach(([name, cards], ci) => {
    const x = CX[ci]!;
    rr(c, x - 12, 76, CW + 24, BH - 100, 16); c.fillStyle = panel; c.fill();
    setFont(c, 16, 600); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = mut; c.fillText(name.toUpperCase(), x + 4, 104);
    const count = cards.length + (ci === 2 ? (k > .5 ? 1 : 0) : ci === 1 ? (k > .5 ? -1 : 0) : 0);
    setFont(c, 15, 600); c.textAlign = 'right'; c.fillText(String(count), x + CW - 4, 104);
    cards.forEach((label, j) => {
      const tg = TAGS[tag++ % TAGS.length]!;
      if (ci === 1 && j === 0) return; // the moving card is drawn last
      let slot = j;
      if (ci === 1) slot = j - eio(clamp(mv * 1.6 - .5)); // the rest of Doing closes the gap
      if (ci === 2) slot = j + eio(clamp(mv * 1.6 - .2)); // Done makes room
      drawCard(x, CY0 + slot * (CH + GAP), label, tg);
    });
  });
  // the moving card: lifts, travels on a slight arc and lands at the top of Done
  const x = lerp(CX[1]!, CX[2]!, k), y = CY0 - 46 * lift;
  drawCard(x, y, COLS[1]![1][0]!, TAGS[3]!, { lift, glow: mv <= 0 ? 0 : mv < 1 ? Math.max(lift, eio(mv)) : 1 - after });
}
