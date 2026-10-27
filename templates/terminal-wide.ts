// Terminal: on the neon ground a light traces the outline of a terminal window and leaves a conic rim; a command types,
// output lines tick off one by one, and the success line lands in the spectrum.
import type { FrameContext } from '@mografy/runtime';
import { exitOf, safeGuide, safeParam, spring, stage, type C2D, type TemplateInfo } from './kit.js';
import { K, P, bloom, clamp, comet, conic, dot, drawPlane, eio, eo, glow, ground, kin, layer, lerp, look, mkPath, montageParams, pAt, planeProj, polyPath, rr, rrPts, setFont, specRGB, texture, vignette } from './montage.js';

export const template = {
  id: 'terminal-wide', name: 'Terminal', category: 'screen', aspect: '16:9',
  summary: 'A light traces a terminal window into a neon rim; a command types, output lines tick off and the success line lands in the spectrum.',
  agentHint: 'CLI, SDK or developer-tool launch. One command under ~34 characters. Output and success copy live in `OUTPUT` and `SUCCESS`; keep them to four short lines and one line. Neon ground reads best.',
  principles: ['timing', 'staging', 'follow-through', 'secondary action'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 5, fps: 30, background: '#040507' };

export const params = {
  command: { name: 'Command', type: 'string' as const, default: 'npx northwind init' },
  ...montageParams('neon'), ...safeParam,
};

type Pt = [number, number];
const TW = 1240, TH = 600, MONO = '"JetBrains Mono", "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace';
const OUTPUT: [string, string][] = [['Workspace created', '0.4s'], ['3 boards imported', '0.8s'], ['Calendar synced', '0.3s'], ['12 teammates invited', '0.5s']];
const SUCCESS = 'Ready. Your week is live.', HINT = 'open northwind.app/team';
// timing: typing, enter, one output line every LINE seconds, then the success line
const T_TYPE = .75, CPS = 20, LINE = .3, LX = 56, Y0 = 122, LH = 56;

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), d = meta.duration, dark = lk.dark, out = exitOf(time, d, .5), flow = time * .7;
  const cmd = String(p.command), n = (time - T_TYPE) * CPS, typed = T_TYPE + [...cmd].length / CPS, enter = typed + .2;
  const lineAt = (i: number) => enter + .15 + i * LINE, successAt = lineAt(OUTPUT.length) + .1;
  stage(ctx, '16:9', c => {
    ground(c, p, time, { orbA: K.teal, orbB: K.violet });
    // the window swings in flat and holds still while it reads; on the way out it recedes
    const sw = spring(time, .2, 1.1, .08), back = eio(P(time, d - .55, d));
    const o = { u: TW / 2, v: TH / 2, px: 960, py: lerp(590, 540, sw) - 10 * back, s: lerp(.86, .94, sw) * lerp(1, .9, back), yaw: lerp(-.42, 0, sw), pitch: lerp(.16, 0, sw), roll: 0 };
    const proj = planeProj(o) as (x: number, y: number) => Pt;
    const outline = rrPts(TW / 2, TH / 2, TW, TH, 22, 420).map(q => proj(q[0], q[1])), m = proj(TW / 2, TH / 2);
    // one fixed box for the bloom layers: bounds that follow the moving window would allocate new buffers every frame
    const glowBox: [number, number, number, number] = [224, 96, 1472, 896];
    const body = P(time, .3, .75) * (1 - P(time, d - .4, d));

    // light behind the window
    c.save(); c.globalCompositeOperation = dark ? 'lighter' : 'source-over';
    glow(c, m[0] - 260, m[1] - 60, 700, K.teal, (dark ? .1 : .14) * body); glow(c, m[0] + 300, m[1] + 80, 640, K.violet, (dark ? .08 : .1) * body);
    c.restore();

    layer(c, 'term', body, (x: C2D) => {
      polyPath(x, outline); x.fillStyle = dark ? '#090C12' : '#0E1219'; x.fill();
      const [tex, ts] = texture(x, 'term', TW, TH, .94, (t: C2D) => term(t, time, cmd, n, enter, lineAt, successAt));
      drawPlane(x, tex, ts, TW, TH, proj, 16, 10);
    }, { bounds: glowBox });

    // the success line, in screen space so it can sharpen out of a blur (the plane is flat by then)
    const sp = proj(LX, Y0 + (OUTPUT.length + 1) * LH + 12), ss = 48 * o.s;
    // glyph by glyph through teal → sky → violet: solid colours blur through blurText, so no per-glyph layers (and buffers)
    const nS = [...SUCCESS].length, hex = (u: number) => '#' + specRGB(u).map((v: number) => Math.round(v).toString(16).padStart(2, '0')).join('');
    kin(c, SUCCESS, sp[0], sp[1], ss, '#FFFFFF', time - successAt, { al: 'left', w: 700, st: .022, out, colAt: (i: number) => hex(.4 * i / Math.max(1, nS - 1)) });

    // a light traces the outline once and leaves the neon rim behind it
    const Pa = mkPath([...outline, outline[1]!]), trace = eo(P(time, .02, .72)), s1 = Pa.len * trace;
    if (trace < 1) {
      const em = (x: C2D) => { comet(x, Pa, s1, { len: Pa.len * .75, lw: 3.4, per: Pa.len / 1.4, step: 14 }); dot(x, ...(pAt(Pa, s1).slice(0, 2) as Pt), 6, '#FFFFFF'); };
      em(c); bloom(c, em, { radius: 12, strength: dark ? 1.3 : .8, halo: 0, mode: dark ? 'lighter' : 'source-over', bounds: glowBox });
    }
    const rimIn = P(time, .72, 1.0), flare = rimIn * (1 - P(time, 1.0, 1.45)) + .5 * Math.sin(Math.PI * P(time, successAt, successAt + .5));
    if (rimIn > 0) {
      const st = (x: C2D) => { polyPath(x, outline); x.strokeStyle = conic(x, m[0], m[1], flow); x.lineWidth = 3; x.lineJoin = 'round'; x.stroke(); };
      c.save(); c.globalAlpha *= rimIn * (1 - out); st(c); c.restore();
      // bloom only while the rim flares (as it closes, and when the success line lands); at rest a soft wide stroke
      if (flare <= .01) { c.save(); c.globalAlpha *= rimIn * (1 - out) * (dark ? .18 : .1); polyPath(c, outline); c.strokeStyle = conic(c, m[0], m[1], flow); c.lineWidth = 12; c.lineJoin = 'round'; c.stroke(); c.restore(); }
      else bloom(c, st, { radius: 14, strength: (dark ? 1.1 : .6) * flare * (1 - out), halo: 1, mode: dark ? 'lighter' : 'source-over', bounds: glowBox });
    }
    if (dark) vignette(c, .5);
    safeGuide(c, '16:9', p.safeGuide);
  });
}

/** The terminal: chrome, the prompt and command, output lines with spinners that turn into ticks. */
function term(c: C2D, time: number, cmd: string, n: number, enter: number, lineAt: (i: number) => number, successAt: number) {
  const fg = '#E6EBF1', mut = '#6C7686', line = '#1E2430';
  rr(c, 0, 0, TW, TH, 22); c.fillStyle = '#090C12'; c.fill();
  c.fillStyle = '#0D1118'; c.beginPath(); c.roundRect(0, 0, TW, 64, [22, 22, 0, 0]); c.fill(); c.fillStyle = line; c.fillRect(0, 64, TW, 1.5);
  [K.coral, K.amber, K.teal].forEach((k, i) => dot(c, 34 + i * 24, 32, 7, k, .85));
  setFont(c, 17, 500); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = mut; c.fillText('northwind — zsh', TW / 2, 33);
  const mono = (size: number, w = 500) => { c.font = `${w} ${size}px ${MONO}`; c.letterSpacing = '0px'; c.textAlign = 'left'; c.textBaseline = 'middle'; };
  const prompt = (y: number) => { mono(30, 600); c.fillStyle = K.teal; c.fillText('~/northwind', LX, y); const w = c.measureText('~/northwind ').width; c.fillStyle = mut; c.fillText('$', LX + w, y); return LX + w + c.measureText('$ ').width; };
  const caret = (x0: number, y: number, on: boolean) => { if (on && (time * 1.8) % 1 < .62) { c.fillStyle = K.teal; c.fillRect(x0 + 3, y - 17, 16, 34); } };
  // prompt and command
  const cx = prompt(Y0), s = [...cmd].slice(0, Math.max(0, Math.floor(n))).join('');
  mono(30, 500); c.fillStyle = fg; c.fillText(s, cx, Y0);
  caret(cx + c.measureText(s).width, Y0, time < enter + .05);
  // output lines
  OUTPUT.forEach(([label, took], i) => {
    const t0 = lineAt(i), k = clamp((time - t0) / .18); if (k <= 0) return;
    const y = Y0 + (i + 1) * LH, done = P(time, t0 + .16, t0 + .34), ix = LX + 12;
    c.save(); c.globalAlpha *= k; c.translate(0, (1 - eo(k)) * 10);
    if (done < 1) { // spinner
      c.save(); c.globalAlpha *= 1 - done; c.strokeStyle = mut; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); const a0 = time * 9; c.arc(ix, y, 10, a0, a0 + 4.2); c.stroke(); c.restore();
    }
    if (done > 0) { // tick draws itself
      c.strokeStyle = K.teal; c.lineWidth = 3.4; c.lineCap = 'round'; c.lineJoin = 'round';
      const pts: Pt[] = [[ix - 10, y + 1], [ix - 3, y + 8], [ix + 11, y - 9]], L1 = Math.hypot(7, 7), L2 = Math.hypot(14, 17), dd = done * (L1 + L2);
      c.beginPath(); c.moveTo(...pts[0]!); if (dd <= L1) c.lineTo(lerp(pts[0]![0], pts[1]![0], dd / L1), lerp(pts[0]![1], pts[1]![1], dd / L1)); else { c.lineTo(...pts[1]!); const e = (dd - L1) / L2; c.lineTo(lerp(pts[1]![0], pts[2]![0], e), lerp(pts[1]![1], pts[2]![1], e)); } c.stroke();
    }
    mono(28, 500); c.fillStyle = done >= 1 ? fg : mut; c.fillText(label, LX + 48, y);
    c.fillStyle = mut; c.globalAlpha *= done; c.textAlign = 'right'; c.fillText(took, TW - LX, y);
    c.restore();
  });
  // hint under the success line, then a fresh prompt waits
  const hy = Y0 + (OUTPUT.length + 2) * LH + 8, hk = P(time, successAt + .35, successAt + .6);
  if (hk > 0) { c.save(); c.globalAlpha *= hk; mono(26, 500); c.fillStyle = mut; c.fillText('→ ' + HINT, LX, hy); c.restore(); }
  const pk = P(time, successAt + .55, successAt + .7);
  if (pk > 0) { c.save(); c.globalAlpha *= pk; const px = prompt(hy + LH); caret(px, hy + LH, true); c.restore(); }
}
