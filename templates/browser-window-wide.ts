// Browser: the montage's pill → window move. A URL types into a glass pill with a conic rim; the camera pulls back and
// the pill turns out to be the address bar of a browser window on a tilted plane, and the page builds inside it.
import type { FrameContext } from '@mografy/runtime';
import { exitOf, safeGuide, safeParam, spring, stage, type C2D, type TemplateInfo } from './kit.js';
import { K, P, bloom, clamp, conic, dot, drawPlane, eio, eo, glow, ground, layer, lerp, look, miniFilm, mixc, montageParams, planeProj, polyPath, rgba, rr, rrPts, setFont, springK, texture, vignette } from './montage.js';

export const template = {
  id: 'browser-window-wide', name: 'Browser', category: 'screen', aspect: '16:9',
  summary: 'A URL types into a glass pill; the camera pulls back to reveal it is the address bar of a browser window, and the page builds inside.',
  agentHint: 'Open a website or web-app demo. Keep the URL short (under ~24 characters, no https://). The page is a stand-in: redraw `page()` (1400 × 764 below the bar) or draw a screenshot there; avoid real browser or brand UI.',
  principles: ['staging', 'anticipation', 'slow in and slow out', 'overlapping action'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 5, fps: 30, background: '#F4F6F8' };

export const params = {
  url: { name: 'URL', type: 'string' as const, default: 'northwind.app' },
  ...montageParams('light'), ...safeParam,
};

type Pt = [number, number];
// window, local units; the address bar is the pill
const WW = 1400, WH = 860, BX = 420, BY = 19, BW = 560, BH = 58, S0 = 1000 / BW;
const box = (pts: Pt[], pad: number): [number, number, number, number] => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const bx = Math.floor((x0 - pad) / 32) * 32, by = Math.floor((y0 - pad) / 32) * 32;
  return [bx, by, Math.ceil((x1 + pad - bx) / 32) * 32, Math.ceil((y1 + pad - by) / 32) * 32];
};

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), d = meta.duration, dark = lk.dark, out = exitOf(time, d, .55), flow = time * .55;
  const url = String(p.url);
  stage(ctx, '16:9', c => {
    ground(c, p, time);
    // ---- the plane: the bar fills the frame at first (yaw 0, so it is flat), then the camera pulls back and swings
    const k1 = eio(P(time, 1.85, 3.05)), back = eio(P(time, d - .6, d));
    const o = {
      u: 700, v: lerp(BY + BH / 2, WH / 2, k1), px: lerp(960, 975, k1), py: lerp(540, 556, k1),
      s: Math.exp(lerp(Math.log(S0), Math.log(.8), k1)) * lerp(1, .93, back),
      yaw: lerp(0, .29, k1), pitch: lerp(0, -.09, k1), roll: lerp(0, .012, k1),
    };
    const proj = planeProj(o) as (x: number, y: number) => Pt;
    const a = clamp(P(time, 0, .15)) * (1 - P(time, d - .4, d));

    // ---- the pill opens from a point, the URL types, "go" lights
    const open = spring(time, .02, .6, .12), bw = lerp(30 / S0, BW, open), bh = lerp(30 / S0, BH, Math.min(1, open * 1.15));
    const n = (time - .58) * 15, len = [...url].length, go = P(time, 1.55, 1.65), pulse = P(time, 1.62, 1.9);
    const chromeA = P(time, 1.85, 2.35), gen = P(time, 2.4, 3.5);

    layer(c, 'browser', a, (x: C2D) => {
      // window body and page (the bar region stays empty here: the bar is its own sharper plane)
      if (chromeA > 0) {
        const outline = rrPts(WW / 2, WH / 2, WW, WH, 24, 120).map(q => proj(q[0], q[1]));
        // soft elliptical shadow: one gradient fill (a blurred outline would need a buffer of a new size every frame)
        const sc = proj(WW / 2, WH + 40), rw = Math.abs(outline[60]![0] - outline[0]![0]) * .6;
        x.save(); x.globalAlpha *= chromeA; x.translate(sc[0], sc[1]); x.scale(1, .35);
        const g = x.createRadialGradient(0, 0, 0, 0, 0, rw); g.addColorStop(0, dark ? 'rgba(0,0,0,.6)' : 'rgba(28,46,64,.1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(-rw, -rw, rw * 2, rw * 2); x.restore();
        // the window fades in as one group (texture cells overlap by a hair)
        layer(x, 'bw-win', chromeA, (y: C2D) => {
          polyPath(y, outline); y.fillStyle = dark ? '#0E1219' : '#FFFFFF'; y.fill();
          const [tex, ts] = texture(y, 'bw-win', WW, WH, .9, (t: C2D) => browser(t, time, gen, dark));
          drawPlane(y, tex, ts, WW, WH, proj, 14, 9);
        });
      }
      // the address bar
      const [tb, tsb] = texture(x, 'bw-bar', BW + 40, BH + 40, S0, (t: C2D) => bar(t, 20 + BW / 2, 20 + BH / 2, bw, bh, url, n, go, pulse, time, dark, P(time, .42, .56), open, chromeA));
      drawPlane(x, tb, tsb, BW + 40, BH + 40, (u: number, v: number) => proj(BX - 20 + u, BY - 20 + v), 14, 3);
    });

    // the conic rim of the pill, in screen space so it stays crisp; it blooms while the pill is the whole picture,
    // until the go button fires
    const rim = rrPts(BX + BW / 2, BY + BH / 2, bw, bh, bh / 2, 160).map(q => proj(q[0], q[1])), m = proj(BX + BW / 2, BY + BH / 2);
    const rimA = a * (1 - out) * lerp(1, .85, k1);
    const st = (x: C2D) => { polyPath(x, rim); x.strokeStyle = conic(x, m[0], m[1], flow); x.lineWidth = 3.2 * (o.s / S0) ** .5; x.lineJoin = 'round'; x.stroke(); };
    c.save(); c.globalAlpha *= rimA; st(c); c.restore();
    const bl = rimA * (1 - P(time, 1.7, 1.95)) * (dark ? 1 : .9);
    if (bl > 0) bloom(c, st, { radius: 16, strength: .9 * bl, mode: dark ? 'lighter' : 'source-over', halo: .7, bounds: [192, 128, 1536, 576] });
    // a soft light under the go button when it fires
    const gp = proj(BX + BW - BH / 2, BY + BH / 2), gk = Math.sin(Math.PI * P(time, 1.58, 2.1));
    if (gk > 0) { c.save(); c.globalCompositeOperation = dark ? 'lighter' : 'source-over'; glow(c, gp[0], gp[1], 140, K.teal, .35 * gk); c.restore(); }
    if (dark) vignette(c, .45);
    safeGuide(c, '16:9', p.safeGuide);
  });
}

/** The address bar, centred at (cx, cy) in its own texture: glass body, lock, typed URL, caret and the go button. */
function bar(c: C2D, cx: number, cy: number, w: number, h: number, url: string, n: number, go: number, pulse: number, time: number, dark: boolean, textA: number, open: number, chromeA: number) {
  if (w <= 0) return;
  c.save(); c.translate(cx, cy);
  rr(c, -w / 2, -h / 2, w, h, h / 2); c.fillStyle = dark ? '#0B0E14' : '#FFFFFF'; c.fill();
  // once the window is there the bar sits on a quiet track, like a real address bar
  if (chromeA > 0) { c.save(); c.globalAlpha *= chromeA * .9; rr(c, -w / 2, -h / 2, w, h, h / 2); c.fillStyle = dark ? '#121722' : '#F6F8FA'; c.fill(); c.restore(); }
  if (textA > 0 && open > .85) {
    c.save(); rr(c, -w / 2, -h / 2, w, h, h / 2); c.clip(); c.globalAlpha *= textA;
    const fs = h * .36, lx = -w / 2 + h * .62;
    // lock
    c.strokeStyle = dark ? '#7F8A99' : '#8A95A3'; c.lineWidth = h * .045; c.lineCap = 'round';
    c.beginPath(); c.arc(lx, -h * .05, h * .1, Math.PI, 0); c.stroke();
    rr(c, lx - h * .15, -h * .06, h * .3, h * .24, h * .05); c.fillStyle = dark ? '#7F8A99' : '#8A95A3'; c.fill();
    const tx = lx + h * .36, s = [...url].slice(0, Math.max(0, Math.floor(n))).join('');
    setFont(c, fs, 500); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = dark ? K.fg : K.ink; c.fillText(s, tx, h * .02);
    if (n < [...url].length + 6 && (time * 1.6) % 1 < .6) { c.fillStyle = K.teal; c.fillRect(tx + c.measureText(s).width + h * .04, -h * .2, Math.max(1.5, h * .03), h * .4); }
    // go button
    const bx = w / 2 - h / 2, br = h * .32 * (1 + .16 * Math.sin(Math.PI * pulse));
    dot(c, bx, 0, br, rgba(mixc(dark ? '#222936' : '#E3E8EC', K.teal, go)));
    c.strokeStyle = go > .5 ? '#FFFFFF' : (dark ? '#5B6574' : '#9AA5B1'); c.lineWidth = h * .045; c.lineJoin = 'round';
    const k = br * .45; c.beginPath(); c.moveTo(bx - k, 0); c.lineTo(bx + k, 0); c.moveTo(bx + k * .2, -k * .75); c.lineTo(bx + k, 0); c.lineTo(bx + k * .2, k * .75); c.stroke();
    c.restore();
  }
  c.restore();
}

/** The browser window around the bar: chrome, then the page building in. */
function browser(c: C2D, time: number, gen: number, dark: boolean) {
  const bg = dark ? '#0E1219' : '#FFFFFF', line = dark ? '#252C38' : '#E2E7EC', mut = dark ? '#5B6574' : '#B4BDC7';
  rr(c, 0, 0, WW, WH, 24); c.fillStyle = bg; c.fill(); c.strokeStyle = line; c.lineWidth = 1.5; c.stroke();
  [0, 1, 2].forEach(i => dot(c, 34 + i * 22, 48, 7, dark ? '#2B3240' : '#DCE2E8'));
  // back / forward / reload
  c.strokeStyle = mut; c.lineWidth = 2.4; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(150, 40); c.lineTo(142, 48); c.lineTo(150, 56); c.moveTo(180, 40); c.lineTo(188, 48); c.lineTo(180, 56); c.stroke();
  c.beginPath(); c.arc(226, 48, 9, -Math.PI * .2, Math.PI * 1.45); c.stroke();
  dot(c, WW - 52, 48, 15, dark ? '#1E2A33' : '#E6F7F4'); dot(c, WW - 52, 48, 7, K.teal);
  c.fillStyle = line; c.fillRect(0, 95, WW, 1.5);
  page(c, time, gen, dark);
}

/** The page inside the browser: nav, hero, picture and three cards spring in one after another. */
function page(c: C2D, time: number, gen: number, dark: boolean) {
  const fg = dark ? K.fg : K.ink, mut = dark ? '#7F8A99' : '#8A95A3', panel = dark ? '#131822' : '#F5F7F9';
  const pop = (i: number, draw: () => void, rise = 26) => { const k = springK(clamp(gen * 9 - i)); if (k <= 0) return; c.save(); c.globalAlpha *= clamp(k * 1.6); c.translate(0, (1 - k) * rise); draw(); c.restore(); };
  pop(0, () => {
    dot(c, 74, 146, 13, K.teal); dot(c, 74, 146, 6, dark ? '#0E1219' : '#FFFFFF');
    setFont(c, 22, 700); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = fg; c.fillText('Northwind', 98, 147);
    setFont(c, 17, 500); c.fillStyle = mut; ['Product', 'Pricing', 'Customers'].forEach((s, i) => c.fillText(s, 820 + i * 120, 147));
    rr(c, 1200, 124, 140, 46, 23); c.fillStyle = dark ? K.fg : K.ink; c.fill();
    setFont(c, 16, 600); c.fillStyle = dark ? K.ink : '#FFFFFF'; c.textAlign = 'center'; c.fillText('Sign in', 1270, 148);
  }, 12);
  pop(1, () => { setFont(c, 56, 700); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = fg; c.fillText('Plan the week', 64, 268); });
  pop(1.6, () => { setFont(c, 56, 700); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = fg; c.fillText('your team keeps.', 64, 334); });
  pop(2.4, () => { setFont(c, 21, 500); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = mut; c.fillText('Boards, calendar and insights in one calm place.', 64, 398); });
  pop(3.2, () => {
    rr(c, 64, 438, 176, 56, 28); c.fillStyle = K.teal; c.fill(); setFont(c, 18, 600); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#FFFFFF'; c.fillText('Start free', 152, 467);
    rr(c, 256, 438, 186, 56, 28); c.strokeStyle = dark ? '#3A4456' : '#D3DAE1'; c.lineWidth = 1.5; c.stroke(); c.fillStyle = fg; c.fillText('Book a demo', 349, 467);
  });
  pop(2, () => miniFilm(c, 720, 176, 616, 340, 2, time, 18), 40);
  [['Boards', 'Move a card, everyone sees it.'], ['Calendar', 'Every deadline on one line.'], ['Insights', 'Know where the week went.']].forEach(([t, s], i) => pop(4.2 + i * .7, () => {
    const x = 64 + i * 432; rr(c, x, 564, 408, 236, 18); c.fillStyle = panel; c.fill();
    dot(c, x + 48, 614, 22, rgba([K.teal, K.sky, K.violet][i]!, .16)); dot(c, x + 48, 614, 8, [K.teal, K.sky, K.violet][i]!);
    setFont(c, 22, 700); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = fg; c.fillText(t!, x + 28, 684);
    setFont(c, 17, 500); c.fillStyle = mut; c.fillText(s!, x + 28, 722);
    rr(c, x + 28, 756, 200, 8, 4); c.fillStyle = dark ? '#252C38' : '#E6EBEF'; c.fill();
  }, 34));
}
