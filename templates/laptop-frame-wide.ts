// Laptop: a flat, minimal laptop rises on the ground; its lid swings open on the hinge, the black screen lights from a
// glow into the product, and the title sharpens in on the left in the montage's kinetic type.
import type { FrameContext } from '@mografy/runtime';
import { exitOf, safeGuide, safeParam, spring, stage, type C2D, type TemplateInfo } from './kit.js';
import { APP, K, P, appUI, bloom, layer, clamp, conic, drawPlane, eio, eo, glow, ground, kin, lerp, look, montageParams, polyPath, rgba, rrPts, specLinear, textW, texture, vignette } from './montage.js';

export const template = {
  id: 'laptop-frame-wide', name: 'Laptop', category: 'screen', aspect: '16:9',
  summary: 'A minimal laptop rises, its lid swings open on the hinge and the screen lights from a glow into the product, beside a kinetic title.',
  agentHint: 'Show a desktop product in context. Title under ~26 characters; it breaks after a comma, and [bracketed] words (else the last line) take the spectrum. The screen is a stand-in: redraw `screen()` or draw a 1400 × 860 screenshot into it.',
  principles: ['anticipation', 'arcs', 'overlapping action', 'staging'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 5, fps: 30, background: '#06080C' };

export const params = {
  title: { name: 'Title', type: 'string' as const, default: 'Your week, in one view' },
  ...montageParams('night'), ...safeParam,
};

type Pt = [number, number];
// Laptop in world units: the hinge is the origin, the base top is y = 0, the front of the base is z = -BD.
const LW = 1480, LH = 940, BW = 1580, BD = 1000, BT = 34, DX = 40, DY = 36;

/** Bounding box of points, padded: keeps bloom and blur layers small. */
const box = (pts: Pt[], pad: number): [number, number, number, number] => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  // snapped to 32 px so pooled buffers are reused from frame to frame
  const q = (v: number) => Math.ceil(v / 32) * 32, bx = Math.floor((x0 - pad) / 32) * 32, by = Math.floor((y0 - pad) / 32) * 32;
  return [bx, by, q(x1 + pad - bx), q(y1 + pad - by)];
};
/** Split a title into lines (after a comma, else by width) and find the spectrum characters. */
function titleLines(c: CanvasRenderingContext2D, raw: string, size: number, max: number) {
  const plain = raw.replace(/[[\]]/g, '');
  const words = plain.split(' '), lines: string[] = [];
  const comma = plain.indexOf(', ');
  if (comma > 0 && textW(c, plain.slice(0, comma + 1), size, 600) <= max && textW(c, plain.slice(comma + 2), size, 600) <= max) lines.push(plain.slice(0, comma + 1), plain.slice(comma + 2));
  else { let ln = ''; for (const w of words) { const nx = ln ? `${ln} ${w}` : w; if (ln && textW(c, nx, size, 600) > max) { lines.push(ln); ln = w; } else ln = nx; } lines.push(ln); }
  // spectrum ranges in plain-text character indices
  const marks: [number, number][] = []; let off = 0, a = -1;
  for (const ch of raw) { if (ch === '[') a = off; else if (ch === ']') { if (a >= 0) marks.push([a, off]); a = -1; } else off++; }
  return { lines, marks };
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), d = meta.duration, out = exitOf(time, d, .55), dark = lk.dark;
  stage(ctx, '16:9', c => {
    ground(c, p, time, { orbA: K.teal, orbB: K.violet });

    // ---- camera on the laptop: it rises on a spring, turns a little toward the title, then sinks away at the end
    const rise = spring(time, 0, .8, .1), turn = eo(P(time, .05, 1.6)), back = eio(P(time, d - .6, d));
    const yaw = lerp(-.62, -.34, turn) - .06 * back, tilt = lerp(.42, .3, turn), s = .46 * lerp(.88, 1, rise) * lerp(1, .9, back), f = 2600;
    const ox = 1210 + 40 * back, oy = lerp(860, 650, rise) + 60 * back;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
    const P3 = (x: number, y: number, z: number): Pt => {
      const x1 = x * cy + z * sy, z1 = -x * sy + z * cy, y2 = y * ct - z1 * st, z2 = y * st + z1 * ct, k = f / Math.max(80, f + z2 * s);
      return [ox + x1 * s * k, oy + y2 * s * k];
    };
    // lid opening angle: closed on the base, then swings open past upright on a spring
    const alpha = lerp(0, 1.86, spring(time, .4, 1.15, .1));
    const sa = Math.sin(alpha), ca = Math.cos(alpha);
    const lid = (u: number, v: number): Pt => { const r = LH - v; return P3(u - LW / 2, -r * sa, -r * ca); };
    const base = (u: number, w: number, y = 0): Pt => P3(u - BW / 2, y, -w);
    const a = clamp(P(time, 0, .22)) * (1 - P(time, d - .35, d));

    // the laptop fades as one group (its texture cells overlap by a hair)
    layer(c, 'laptop', a, (c: C2D) => {
    const poly = (pts: Pt[], fill: string | CanvasGradient) => { polyPath(c, pts); c.fillStyle = fill; c.fill(); };
    // light on the floor under the laptop
    c.save(); c.globalCompositeOperation = dark ? 'lighter' : 'source-over';
    const fl = base(BW / 2, BD * .5, BT); glow(c, fl[0], fl[1] + 40, 760 * s / .52, K.teal, (dark ? .1 : .14) + .1 * P(time, 1.3, 2));
    c.restore();
    // base: sides, top, keyboard, trackpad, front edge
    const top = dark ? '#1B212C' : '#E7EBEF', edge = dark ? '#2B3340' : '#CFD5DC', keyC = dark ? '#10141B' : '#D5DBE2', side = dark ? '#141922' : '#C6CDD5';
    poly([base(0, 0), base(0, BD), base(0, BD, BT), base(0, 0, BT)], side);
    poly([base(BW, 0), base(BW, BD), base(BW, BD, BT), base(BW, 0, BT)], side);
    const t0 = base(BW / 2, 0), t1 = base(BW / 2, BD), tg = c.createLinearGradient(t0[0], t0[1], t1[0], t1[1]);
    tg.addColorStop(0, dark ? '#151A23' : '#DDE2E7'); tg.addColorStop(1, top);
    poly([base(0, 0), base(BW, 0), base(BW, BD), base(0, BD)], tg);
    for (let r = 0; r < 5; r++) for (let k = 0; k < 14; k++) {
      const kw = (BW - 300 - 13 * 14) / 14, u = 150 + k * (kw + 14), w = 90 + r * 78;
      poly([base(u, w), base(u + kw, w), base(u + kw, w + 64), base(u, w + 64)], keyC);
    }
    const tpU = BW / 2 - 300, tpW = 600;
    poly([base(tpU, 520), base(tpU + tpW, 520), base(tpU + tpW, 900), base(tpU, 900)], dark ? '#161B24' : '#DFE4E9');
    polyPath(c, [base(tpU, 520), base(tpU + tpW, 520), base(tpU + tpW, 900), base(tpU, 900)]); c.strokeStyle = dark ? '#283040' : '#C9D0D8'; c.lineWidth = 1.2; c.stroke();
    poly([base(0, BD), base(BW, BD), base(BW, BD, BT), base(0, BD, BT)], edge);
    // screen light spilling onto the keyboard
    const lit = P(time, 1.25, 1.9);
    if (lit > 0) {
      c.save(); polyPath(c, [base(0, 0), base(BW, 0), base(BW, BD), base(0, BD)]); c.clip(); c.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      const g0 = base(BW / 2, 60); glow(c, g0[0], g0[1], 520 * s / .52, K.teal, (dark ? .16 : .1) * lit); glow(c, g0[0] + 160 * s, g0[1], 380 * s / .52, K.violet, (dark ? .1 : .06) * lit); c.restore();
    }

    // ---- the lid: its shell while it faces away, the display once it turns to the camera
    const A0 = lid(0, 0), B0 = lid(LW, 0), D0 = lid(0, LH), facing = (B0[0] - A0[0]) * (D0[1] - A0[1]) - (B0[1] - A0[1]) * (D0[0] - A0[0]) > 0;
    const outline = rrPts(LW / 2, LH / 2, LW, LH, 34, 140).map(q => lid(q[0], q[1]));
    if (!facing) {
      const sg = c.createLinearGradient(A0[0], A0[1], D0[0], D0[1]); sg.addColorStop(0, dark ? '#2C3445' : '#F4F6F8'); sg.addColorStop(1, dark ? '#1C222D' : '#DCE2E8');
      polyPath(c, outline); c.fillStyle = sg; c.fill(); c.strokeStyle = dark ? '#3A4456' : '#C4CCD4'; c.lineWidth = 1.5; c.stroke();
      const ring = rrPts(LW / 2, LH / 2, 90, 90, 45, 60).map(q => lid(q[0], q[1]));
      polyPath(c, ring); c.strokeStyle = rgba(K.teal, .8); c.lineWidth = 2; c.stroke();
    } else {
      // shadow and bezel, then the display texture
      const on = P(time, 1.2, 1.75), app = eo(P(time, 1.6, 2.05)), flow = time * .55;
      polyPath(c, outline); c.fillStyle = '#0A0D12'; c.fill();
      const [tex, ts] = texture(c, 'laptop-lid', LW, LH, s * 1.05, (x: C2D) => screen(x, time, on, app, dark));
      drawPlane(c, tex, ts, LW, LH, lid, 16, 10);
      polyPath(c, outline); c.strokeStyle = dark ? '#2C3442' : '#3A4250'; c.lineWidth = 1.4; c.stroke();
      // the display edge flares with the spectrum as it lights, then rests as a faint rim
      const rimK = Math.min(P(time, 1.2, 1.5), 1 - .7 * P(time, 1.7, 2.6)) * (1 - out);
      if (rimK > 0) {
        const pts = rrPts(DX + 700, DY + 430, 1400, 860, 22, 160).map(q => lid(q[0], q[1])), m = lid(LW / 2, LH / 2);
        const st2 = (x: C2D) => { polyPath(x, pts); x.strokeStyle = conic(x, m[0], m[1], flow); x.lineWidth = 2.6; x.lineJoin = 'round'; x.stroke(); };
        c.save(); c.globalAlpha *= rimK; st2(c); c.restore();
        // bloom only while it flares; the resting rim is a plain stroke
        const flare = P(time, 1.2, 1.5) * (1 - P(time, 1.9, 2.6));
        if (flare > 0) bloom(c, st2, { radius: 14, strength: 1.1 * flare, halo: 1, bounds: box(pts, 60) });
      }
    }
    });

    // ---- title
    const { lines, marks } = titleLines(c, String(p.title), 96, 640);
    const LX = 140, Y0 = 540 - (lines.length - 1) * 58;
    let off = 0;
    lines.slice(0, 3).forEach((ln, li) => {
      const n = [...ln].length, start = off; off += n + 1;
      const spec = (i: number) => marks.length ? marks.some(([m0, m1]) => start + i >= m0 && start + i < m1) : li === lines.length - 1 && lines.length > 1;
      const idx = [...Array(n).keys()].filter(spec), i0 = idx[0] ?? 0, i1 = (idx[idx.length - 1] ?? 0) + 1;
      kin(c, ln, LX, Y0 + li * 116, 96, lk.ink, time - .3 - li * .14, {
        al: 'left', w: 600, st: .03, out, colAt: (i: number) => spec(i) ? 'fill' : lk.ink,
        fill: (x: C2D, x0: number) => specLinear(x, x0 + textW(x, [...ln].slice(0, i0).join(''), 96, 600), 0, x0 + textW(x, [...ln].slice(0, i1).join(''), 96, 600), 0, [K.teal, K.sky, K.violet]),
      });
    });
    if (dark) vignette(c, .45);
    safeGuide(c, '16:9', p.safeGuide);
  });
}

/** The lid face: bezel, then a display that lights from a glow into the product window. */
function screen(x: C2D, time: number, on: number, app: number, dark: boolean) {
  x.fillStyle = '#0A0D12'; x.beginPath(); x.roundRect(0, 0, LW, LH, 34); x.fill();
  x.save(); x.beginPath(); x.roundRect(DX, DY, APP.w, APP.h, 22); x.clip();
  x.fillStyle = '#05070A'; x.fillRect(DX, DY, APP.w, APP.h);
  if (on > 0) {
    // the glow blooms from the centre and fills the panel
    const R = lerp(60, 1300, eo(on)), cx = DX + APP.w / 2, cy = DY + APP.h / 2;
    glow(x, cx, cy, R, K.teal, .9 * (1 - app * .8)); glow(x, cx + 160, cy + 40, R * .8, K.violet, .7 * (1 - app * .8)); glow(x, cx, cy, R * .3, '#FFFFFF', .8 * (1 - app));
  }
  if (app > 0) {
    x.save(); x.globalAlpha = app; x.translate(DX, DY);
    appUI(x, { dark, t: time, gen: P(time, 2.0, 3.2), title: 'Northwind · This week' });
    x.restore();
  }
  // a soft reflection across the glass
  const g = x.createLinearGradient(DX, DY, DX + APP.w * .7, DY + APP.h); g.addColorStop(0, 'rgba(255,255,255,.07)'); g.addColorStop(.5, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(DX, DY, APP.w, APP.h);
  x.restore();
  // camera dot
  x.fillStyle = '#1C222C'; x.beginPath(); x.arc(LW / 2, DY / 2, 5, 0, 7); x.fill();
}
