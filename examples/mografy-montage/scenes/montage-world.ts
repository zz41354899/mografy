// @ts-nocheck
// Mografy montage: drawing for the whole film. A pure function of time on a 1920 × 1080 logical canvas; copy lives in
// COPY (en / zh). `frame(c, t)` runs on any 2D context, so a storyboard page can draw the real film (film-architecture.md).
import { beats, bloom, blurLayer, blurText, buffer, cameraPath, clamp, devScale, ease, keys, layer, lerp, pr as P, withCamera } from '@mografy/runtime';
import { LOGO_PIECES } from './logo.js';

// Mografy montage v3: one continuous camera through three acts, then the logo. 60 s, 1920 × 1080 logical canvas.
//  Act I   0–19.2   dark: a single comet of light draws the whole act (S-curve → wave → spiral → three nodes → a line → two
//                   arches), the camera follows it, and flies into its head; the light floods the frame white.
//  Act II  19.2–38.4 light: the light narrows to an underline, the underline becomes the prompt pill, the camera pulls back
//                   to reveal the pill inside a 3D Mografy window, dives into a slider, pulls back to "Done.", then one
//                   outline morphs Write → Tune → Score → Present and shrinks to a dot.
//  Act III 38.4–60  neon: hard cut on the dot, it opens into a neon pill, the camera flies through it, kinetic type, a whip
//                   pan to the dark window, which breaks into stars, a spiral galaxy, a light arc that draws the slogan
//                   pill, and the dot that draws the logo.
const W = 1920, H = 1080, DUR = 60, A2 = 19.2, A3 = 38.4;
const K = { teal: '#1BC6B4', sky: '#4AA8FF', violet: '#8C6BFF', coral: '#FF7A6B', amber: '#FFC15A', ink: '#141820', fg: '#EEF2F5', mut: '#8792A2', night: '#06080C' };
const SPEC = [K.teal, K.sky, K.violet, K.coral, K.amber];
const FONT = 'Inter, "Noto Sans TC", sans-serif';
const eo = ease.outCubic;
const ei = x => x * x * x;
const eio = ease.inOutCubic;
const spring = x => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-6 * x) * Math.cos(9 * x);
const rnd = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const rgba = (c, a = 1) => { const [r, g, b] = typeof c === 'string' ? hex(c) : c; return `rgba(${r | 0},${g | 0},${b | 0},${clamp(a)})`; };
const mixc = (a, b, k) => { const x = typeof a === 'string' ? hex(a) : a, y = typeof b === 'string' ? hex(b) : b; return [0, 1, 2].map(i => lerp(x[i], y[i], k)); };
// the Mografy spectrum, cyclic: teal → sky → violet → coral → amber → teal
const specRGB = u => { u = ((u % 1) + 1) % 1; const f = u * SPEC.length, i = Math.floor(f); return mixc(SPEC[i], SPEC[(i + 1) % SPEC.length], f - i); };
const spec = (u, a = 1) => rgba(specRGB(u), a);
const env = (t, a, b, i = .4, o = .4) => Math.min(P(t, a, a + i), 1 - P(t, b - o, b));

let NOW = 0, LANG = 'en';
export function setLang(l) { LANG = l === 'zh' ? 'zh' : 'en'; }
const COPY = {
  en: { whatIf: 'What if', idea: 'an idea', move: 'could move', own: 'on its own?', trio: ['Shots.', 'Rhythm.', 'Music.'], sentence: 'From one sentence.',
    meet: ['Meet ', 'Mografy'], describe: 'Describe it.', prompt: 'A 30-second launch film for my app', builds: ['It builds', 'the whole film.'],
    adjust: 'Adjust.', done: 'Done.', verbs: ['Write', 'Tune', 'Score', 'Present'], calmer: 'Make it calmer', oneWord: ['Change ', 'one', ' word.'],
    follows: 'The whole film follows.', from: 'From one sentence,', kinds: ['launch films', 'explainers', 'slides', 'brand stories'],
    chips: ['30-second launch film', 'Explain an IPO in 60 s', 'Turn this deck into motion', '9:16 hiring post', 'Why we built it, in 70 s'],
    slogan: 'Some ideas need to move.', title: 'launch-film', params: ['duration', 'ease', 'scale', 'stagger'], paramsTitle: 'Params', score: 'Score', scoreSub: 'warm · 100 bpm', present: 'Present' },
  zh: { whatIf: '如果', idea: '一個想法', move: '可以動起來', own: '而且自己會動？', trio: ['分鏡。', '節奏。', '音樂。'], sentence: '只要一句話。',
    meet: ['認識 ', 'Mografy'], describe: '描述它。', prompt: '幫我的 App 做一支 30 秒發表影片', builds: ['整支影片', '自動生成。'],
    adjust: '調整。', done: '完成。', verbs: ['撰寫', '微調', '配樂', '簡報'], calmer: '讓它更沉穩一點', oneWord: ['改', '一個', '詞。'],
    follows: '整支影片跟著變。', from: '一句話，就能做出', kinds: ['產品發表片', '解說動畫', '動態簡報', '品牌故事'],
    chips: ['30 秒產品發表片', '60 秒解說 IPO', '把簡報變成動態', '9:16 徵才貼文', '70 秒品牌故事'],
    slogan: '有些想法，值得動起來。', title: 'launch-film', params: ['時長', '緩動', '縮放', '間隔'], paramsTitle: '參數', score: '配樂', scoreSub: '溫暖 · 100 bpm', present: '簡報' },
};
const L = k => COPY[LANG][k] ?? COPY.en[k];

// ---------- camera, layers, bloom ----------
// keys (monotone cubic), cameraPath (log zoom), withCamera, layer and bloom come from @mografy/runtime; buffers are
// pooled there and sized from the film frame, so the player's canvas size never matters.
// ---------- paths ----------
function mkPath(pts) { const L2 = [0]; for (let i = 1; i < pts.length; i++) L2.push(L2[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, L: L2, len: L2[L2.length - 1] }; }
function pAt(Pa, s) {
  s = clamp(s, 0, Pa.len); let lo = 0, hi = Pa.L.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (Pa.L[m] < s) lo = m; else hi = m; }
  const k = (s - Pa.L[lo]) / Math.max(1e-6, Pa.L[hi] - Pa.L[lo]), a = Pa.pts[lo], b = Pa.pts[hi]; return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), Math.atan2(b[1] - a[1], b[0] - a[0])];
}
const bez = (p0, p1, p2, p3, n = 90) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [0, 1].map(j => u * u * u * p0[j] + 3 * u * u * t * p1[j] + 3 * u * t * t * p2[j] + t * t * t * p3[j]); });
const qbez = (p0, p1, p2, n = 70) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [0, 1].map(j => u * u * p0[j] + 2 * u * t * p1[j] + t * t * p2[j]); });
const fnPts = (f, n) => Array.from({ length: n + 1 }, (_, i) => f(i / n));
function resample(pts, n) { const Pa = mkPath(pts); return Array.from({ length: n + 1 }, (_, i) => pAt(Pa, Pa.len * i / n).slice(0, 2)); }
// joined segments → one path plus the arc length at the end of each segment
function joinSegs(segs) { const pts = [], marks = []; for (const s of segs) { pts.push(...(pts.length ? s.slice(1) : s)); marks.push(mkPath(pts).len); } return { path: mkPath(pts), marks }; }
// rounded-rect outline, clockwise from its left-middle point, resampled to n + 1 points
function rrPts(cx, cy, w, h, r, n = 220) {
  r = Math.min(r, w / 2, h / 2); const x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2, pts = [[x0, cy]];
  const arc = (ax, ay, a0, a1) => { for (let i = 0; i <= 14; i++) { const a = lerp(a0, a1, i / 14); pts.push([ax + r * Math.cos(a), ay + r * Math.sin(a)]); } };
  arc(x0 + r, y0 + r, Math.PI, 1.5 * Math.PI); arc(x1 - r, y0 + r, 1.5 * Math.PI, 2 * Math.PI); arc(x1 - r, y1 - r, 0, .5 * Math.PI); arc(x0 + r, y1 - r, .5 * Math.PI, Math.PI); pts.push([x0, cy]);
  return resample(pts, n);
}
function circlePts(cx, cy, R, n = 220) { return fnPts(u => [cx + R * Math.cos(Math.PI + u * 2 * Math.PI), cy + R * Math.sin(Math.PI + u * 2 * Math.PI)], n); }
// a thin closed band that follows a travelling wave (the "Score" shape)
function wavePts(cx, cy, w, amp, th, ph, n = 220) {
  const wy = x => { const u = (x - (cx - w / 2)) / w; return amp * Math.sin(Math.PI * u) * Math.sin(u * 5.2 * Math.PI + ph) * (.6 + .4 * Math.sin(u * 2.3 * Math.PI + ph * .5)); };
  const top = fnPts(u => [cx - w / 2 + u * w, cy + wy(cx - w / 2 + u * w) - th / 2], 120), bot = fnPts(u => [cx + w / 2 - u * w, cy + wy(cx + w / 2 - u * w) + th / 2], 120);
  return resample([[cx - w / 2, cy], ...top, [cx + w / 2, cy], ...bot, [cx - w / 2, cy]], n);
}
const lerpPts = (a, b, k) => a.map((p, i) => [lerp(p[0], b[i][0], k), lerp(p[1], b[i][1], k)]);
function polyPath(c, pts, close = true) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); if (close) c.closePath(); }
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function conic(c, cx, cy, rot) { const g = c.createConicGradient(rot, cx, cy); SPEC.forEach((k, i) => g.addColorStop(i / SPEC.length, k)); g.addColorStop(1, SPEC[0]); return g; }
function specLinear(c, x0, y0, x1, y1, cols = SPEC) { const g = c.createLinearGradient(x0, y0, x1, y1); cols.forEach((k, i) => g.addColorStop(i / (cols.length - 1), k)); return g; }
function glow(c, x, y, r, col, a) { if (a <= 0 || r <= 0) return; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(.45, rgba(col, a * .38)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
function dot(c, x, y, r, col, a = 1) { if (a <= 0 || r <= 0) return; const ga = c.globalAlpha; c.globalAlpha = ga * a; c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.globalAlpha = ga; }

// a comet: the path from s1 - len to s1, tapering and fading toward the tail, coloured by absolute arc length
function comet(c, Pa, s1, o = {}) {
  const len = o.len ?? 1500, lw = o.lw ?? 3.2, s0 = Math.max(o.from ?? 0, s1 - len), a = o.a ?? 1, per = o.per ?? 2600, hue = o.hue ?? 0;
  if (s1 - s0 < 1 || a <= 0) return; const n = Math.max(2, Math.ceil((s1 - s0) / 10)), ga = c.globalAlpha; c.lineCap = 'butt'; c.lineJoin = 'round';
  let p = pAt(Pa, s0);
  for (let i = 1; i <= n; i++) {
    const s = s0 + (s1 - s0) * i / n, q = pAt(Pa, s), f = clamp((s - (s1 - len)) / len);
    c.globalAlpha = ga * a * Math.pow(f, o.fade ?? 1.2); c.strokeStyle = o.col ?? spec(s / per + hue); c.lineWidth = lw * (.3 + .7 * f);
    c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); p = q;
  }
  c.globalAlpha = ga;
}

// ---------- type ----------
function setFont(c, size, w = 500) { c.font = `${w} ${size}px ${FONT}`; c.letterSpacing = size >= 56 ? `${(-size * .028).toFixed(2)}px` : '0px'; }
// kinetic line: every glyph rises, sharpens out of a blur and settles from a spectrum tint into its colour.
// t = seconds since the line started; o.out (0..1) blurs, lifts and fades the whole line away.
function kin(c, s, x, y, size, col, t, o = {}) {
  const out = o.out ?? 0, a0 = o.a ?? 1; if (t <= 0 || out >= 1 || a0 <= 0) return 0;
  const w = o.w ?? 500, st = o.st ?? .03, d = o.d ?? .55, al = o.al ?? 'center'; setFont(c, size, w); c.textBaseline = 'middle'; c.textAlign = 'left';
  const chars = [...s], xs = [0]; for (let i = 1; i <= chars.length; i++) xs.push(c.measureText(chars.slice(0, i).join('')).width);
  const total = xs[chars.length], x0 = al === 'left' ? x : al === 'right' ? x - total : x - total / 2, sc = devScale(c), ga = c.globalAlpha;
  const fill = o.fill ? o.fill(c, x0, total) : null;
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === ' ') continue;
    const e = o.prog ? o.prog(i, x0 + xs[i]) : eo(P(t, (o.d0 ?? 0) + i * st, (o.d0 ?? 0) + i * st + d)); if (e <= 0) continue;
    const b = Math.max(1 - e, out), blur = b * size * (o.blur ?? .2), base = o.colAt ? o.colAt(i) : col, gradient = fill && (!o.colAt || o.colAt(i) === 'fill');
    const tinted = gradient ? '' : rgba(mixc(specRGB((o.hue ?? 0) + i * .05), base, Math.min(1, e * 1.15)));
    const gy = y + (1 - e) * size * (o.rise ?? .16) - out * size * (o.lift ?? .3), weight = o.wAt ? o.wAt(i) : w;
    if (blur * sc > .5) {
      // never ctx.filter on the frame: a solid glyph blurs through its own shadow (blurText), a gradient glyph through a
      // small blur layer around it
      if (gradient) blurLayer(c, 'kin', blur, x => { setFont(x, size, weight); x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillStyle = fill; x.fillText(chars[i], x0 + xs[i], gy); },
        { alpha: a0 * e * (1 - out), bounds: [x0 + xs[i] - size * .2, gy - size * .8, xs[i + 1] - xs[i] + size * .4, size * 1.6] });
      else blurText(c, chars[i], x0 + xs[i], gy, { size, family: FONT, weight, baseline: 'middle', color: o.tint === false || e >= 1 ? base : tinted, alpha: a0 * e * (1 - out) }, blur);
      continue;
    }
    c.save(); c.globalAlpha = ga * a0 * e * (1 - out);
    c.fillStyle = gradient ? fill : (o.tint === false || e >= 1 ? base : tinted);
    setFont(c, size, weight); c.fillText(chars[i], x0 + xs[i], gy); c.restore();
  }
  return total;
}
const textW = (c, s, size, w = 500) => { setFont(c, size, w); return c.measureText(s).width; };

// ---------- 3D planes ----------
// a flat card in 3D: local point (x, y) → screen. Pivot (u, v) in local units sits at screen (px, py); s = scale.
function planeProj(o) {
  const f = o.f ?? 1900, cyw = Math.cos(o.yaw ?? 0), syw = Math.sin(o.yaw ?? 0), cp = Math.cos(o.pitch ?? 0), sp = Math.sin(o.pitch ?? 0), cr = Math.cos(o.roll ?? 0), sr = Math.sin(o.roll ?? 0), s = o.s ?? 1;
  return (x, y) => { const X = (x - o.u) * s, Y = (y - o.v) * s, y1 = Y * cp, z1 = Y * sp, x2 = X * cyw + z1 * syw, z2 = -X * syw + z1 * cyw, k = f / Math.max(80, f + z2), qx = x2 * k, qy = y1 * k;
    return [o.px + qx * cr - qy * sr, o.py + qx * sr + qy * cr]; };
}
// texture-map tex (local w × h at ts px per unit) through proj, as a grid of small affine cells
function drawPlane(c, tex, ts, w, h, proj, nx = 30, ny = 18) {
  const G = []; for (let j = 0; j <= ny; j++) { const row = []; for (let i = 0; i <= nx; i++) row.push(proj(w * i / nx, h * j / ny)); G.push(row); }
  const cw = w / nx, ch = h / ny; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = G[j][i], b = G[j][i + 1], d = G[j + 1][i], ex = .8 / Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1])), ey = .8 / Math.max(1, Math.hypot(d[0] - a[0], d[1] - a[1]));
    c.save(); c.transform(b[0] - a[0], b[1] - a[1], d[0] - a[0], d[1] - a[1], a[0], a[1]);
    c.drawImage(tex, i * cw * ts, j * ch * ts, cw * ts, ch * ts, 0, 0, 1 + ex, 1 + ey); c.restore();
  }
}
// render a local w × h drawing into a texture sized for how large the plane appears
function texture(c, name, w, h, s, draw) { const ts = clamp(s * devScale(c) * 1.05, .5, 2.6), b = buffer('tex-' + name, w * ts, h * ts), x = b.getContext('2d'); x.setTransform(ts, 0, 0, ts, 0, 0); draw(x); return [b, ts]; }

// ---------- Mografy UI ----------
// the prompt pill, centred at (cx, cy). n = typed characters; send 0..1 lights the send button.
function pillUI(c, cx, cy, w, h, text, n, send, o = {}) {
  const d = o.dark, sc = devScale(c); c.save(); c.translate(cx, cy);
  if (o.body !== false) { c.save(); if (!d && o.shadow !== false) { c.shadowColor = 'rgba(28,46,64,.13)'; c.shadowBlur = h * .45 * sc; c.shadowOffsetY = h * .12 * sc; }
    rr(c, -w / 2, -h / 2, w, h, h / 2); c.fillStyle = d ? '#0B0E14' : '#FFFFFF'; c.fill(); c.restore(); }
  if ((o.rimA ?? 1) > 0) { c.save(); c.globalAlpha *= o.rimA ?? 1; rr(c, -w / 2, -h / 2, w, h, h / 2); c.strokeStyle = conic(c, 0, 0, o.flow ?? 0); c.lineWidth = o.rim ?? h * .03; c.stroke(); c.restore(); }
  const ta = o.textA ?? 1;
  if (ta > 0 && w > h * 3) {
    c.save(); rr(c, -w / 2, -h / 2, w, h, h / 2); c.clip(); c.globalAlpha *= ta;
    const fs = h * .33, tx = -w / 2 + h * (o.icon ? .82 : .42), s = [...text].slice(0, Math.max(0, Math.floor(n))).join(''); setFont(c, fs, 500); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = d ? K.fg : K.ink; c.fillText(s, tx, h * .01);
    if (o.icon) spark(c, -w / 2 + h * .48, 0, h * .16, NOW);
    if (o.caret && (NOW * 1.6) % 1 < .6) { c.fillStyle = K.teal; c.fillRect(tx + c.measureText(s).width + h * .03, -h * .2, Math.max(1.5, h * .022), h * .4); }
    const bx = w / 2 - h / 2, br = h * .32 * (1 + .18 * Math.sin(Math.PI * clamp(o.pulse ?? 0)));
    dot(c, bx, 0, br, send > 0 ? rgba(mixc(d ? '#222936' : '#E3E8EC', K.teal, clamp(send))) : (d ? '#222936' : '#E3E8EC'));
    c.strokeStyle = send > .5 ? '#fff' : (d ? '#5B6574' : '#9AA5B1'); c.lineWidth = Math.max(1.2, h * .035); c.lineCap = 'round'; const k = br * .42;
    c.beginPath(); c.moveTo(bx, k); c.lineTo(bx, -k); c.moveTo(bx - k * .75, -k * .2); c.lineTo(bx, -k); c.lineTo(bx + k * .75, -k * .2); c.stroke(); c.restore();
  }
  c.restore();
}
// four-point sparkle (the "regenerate" mark)
function spark(c, x, y, r, t) { c.save(); c.translate(x, y); c.rotate(t * .4); c.fillStyle = conic(c, 0, 0, t); c.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr2 = i % 2 ? r * .28 : r; c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } c.closePath(); c.fill(); c.restore(); }
// palettes of the little films inside the window: bright before the edit, calm after "Make it calmer"
const WARM = [['#FFB27A', '#FF7A8A', '#FFE6A8'], ['#7FD8FF', '#8C6BFF', '#E8E2FF'], ['#1BC6B4', '#7FE3D2', '#FFF3C2'], ['#FFC15A', '#FF7A6B', '#FFF0D0'], ['#8C6BFF', '#4AA8FF', '#C8F1FF'], ['#FF8FB1', '#FFC15A', '#FFFFFF'], ['#4AA8FF', '#1BC6B4', '#EFFFFB'], ['#FF7A6B', '#8C6BFF', '#FFD9CF']];
const CALM = [['#0E2A33', '#16655F', '#7FE3D2'], ['#141B3A', '#2C4A8C', '#9FC6FF'], ['#1A1436', '#4B3A8F', '#C2B4FF'], ['#0F2230', '#1F5C6E', '#A6F0E4'], ['#161A30', '#3B3F7A', '#B9C2FF'], ['#10262B', '#1D6F68', '#8EEBDB'], ['#131C33', '#284D7A', '#A9D4FF'], ['#1B1733', '#43357D', '#CBBEFF']];
function pal(i, calm) { const a = WARM[i % 8], b = CALM[i % 8]; return a.map((k, j) => mixc(k, b[j], calm)); }
// one frame of a "Mografy film": gradient ground, a soft orb, a title block and a dot
function miniFilm(c, x, y, w, h, i, calm, t, r = 10) {
  const p = pal(i, calm); c.save(); rr(c, x, y, w, h, r); c.clip();
  const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, rgba(p[0])); g.addColorStop(1, rgba(p[1])); c.fillStyle = g; c.fillRect(x, y, w, h);
  const ox = x + w * (.66 + .06 * Math.sin(t * .9 + i)), oy = y + h * (.46 + .05 * Math.cos(t * .7 + i));
  const gg = c.createRadialGradient(ox, oy, 0, ox, oy, h * .55); gg.addColorStop(0, rgba(p[2], .85)); gg.addColorStop(1, rgba(p[2], 0)); c.fillStyle = gg; c.fillRect(x, y, w, h);
  c.fillStyle = rgba('#FFFFFF', .92); rr(c, x + w * .08, y + h * .36, w * .34, h * .075, h * .04); c.fill();
  c.fillStyle = rgba('#FFFFFF', .6); rr(c, x + w * .08, y + h * .5, w * .22, h * .045, h * .025); c.fill();
  dot(c, ox, oy, h * .07, '#FFFFFF', .95); c.restore();
}
// the Mografy window, local 1400 × 860. o: dark, chromeA, text, typed, send, gen (0..1), slider (0..1), calm (0..1), shimmer (-1 or 0..1), play (0..1), flow, focus
const WIN = { w: 1400, h: 860, field: [1162, 98], fieldW: 420, stage: [28, 76, 900, 506] };
function winUI(c, T, o) {
  const d = o.dark, bg = d ? '#0E1219' : '#FFFFFF', panel = d ? '#131822' : '#F5F7F9', line = d ? '#252C38' : '#E2E7EC', fg = d ? K.fg : K.ink, mut = d ? '#7F8A99' : '#8A95A3', ga = c.globalAlpha;
  c.globalAlpha = ga * (o.chromeA ?? 1);
  rr(c, 0, 0, 1400, 860, 24); c.fillStyle = bg; c.fill(); c.strokeStyle = line; c.lineWidth = 1.5; c.stroke();
  [0, 1, 2].forEach(i => dot(c, 30 + i * 20, 30, 6, d ? '#2B3240' : '#DCE2E8'));
  setFont(c, 15, 600); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = fg; c.fillText(L('title'), 700, 31);
  rr(c, 1280, 15, 92, 32, 16); c.strokeStyle = rgba(K.teal, .8); c.lineWidth = 1.5; c.stroke(); setFont(c, 13, 600); c.fillStyle = d ? '#7FE3D2' : '#0F9C8E'; c.fillText(L('present'), 1326, 31);
  // stage plays the film; thumbnails pop in as the film is generated
  const play = o.play ?? 0, cur = Math.floor(play * 8) % 8;
  miniFilm(c, ...WIN.stage, cur, o.calm ?? 0, T, 14);
  // params
  setFont(c, 15, 600); c.textAlign = 'left'; c.fillStyle = fg; c.fillText(L('paramsTitle'), 952, 168);
  const vals = [['dur', o.slider ?? .35], ['ease', .7], ['scale', .48], ['stag', .3]];
  vals.forEach(([, f], i) => {
    const y = 210 + i * 58, label = L('params')[i]; setFont(c, 14, 500); c.fillStyle = mut; c.textAlign = 'left'; c.fillText(label, 952, y);
    const v = i === 0 ? (0.8 + .4 * clamp((f - .35) / .27)).toFixed(1) + 's' : i === 1 ? 'spring' : i === 2 ? '1.12' : '0.06s';
    setFont(c, 14, 600); c.fillStyle = fg; c.textAlign = 'right'; c.fillText(v, 1372, y);
    rr(c, 952, y + 18, 420, 5, 2.5); c.fillStyle = line; c.fill(); rr(c, 952, y + 18, 420 * f, 5, 2.5); c.fillStyle = specLinear(c, 952, 0, 1372, 0, [K.teal, K.sky]); c.fill();
    dot(c, 952 + 420 * f, y + 20.5, 9, bg); c.strokeStyle = K.teal; c.lineWidth = 2.5; c.beginPath(); c.arc(952 + 420 * f, y + 20.5, 9, 0, 7); c.stroke();
  });
  // score card
  rr(c, 952, 446, 420, 136, 14); c.fillStyle = panel; c.fill();
  setFont(c, 14, 600); c.textAlign = 'left'; c.fillStyle = fg; c.fillText(L('score'), 972, 474); setFont(c, 13, 500); c.fillStyle = mut; c.textAlign = 'right'; c.fillText(L('scoreSub'), 1352, 474);
  for (let i = 0; i < 46; i++) { const hh = 8 + 44 * Math.abs(Math.sin(i * .37) * Math.sin(i * .11 + 1)) * (o.calm ? lerp(1, .55, o.calm) : 1); c.fillStyle = rgba(specRGB(i / 46 * .5), d ? .8 : .9); rr(c, 972 + i * 8.6, 534 - hh / 2, 4.4, hh, 2.2); c.fill(); }
  // timeline
  rr(c, 28, 604, 1344, 228, 16); c.fillStyle = panel; c.fill();
  setFont(c, 11, 500); c.fillStyle = mut; c.textAlign = 'left'; ['0s', '10s', '20s', '30s'].forEach((s, i) => c.fillText(s, 48 + i * 434, 624));
  const gen = o.gen ?? 1;
  for (let i = 0; i < 8; i++) {
    const k = spring(clamp(gen * 8 - i)); if (k <= 0) continue; const x = 48 + i * 165, y = 640, cal = clamp(((o.calmAt ?? -1) >= 0) ? (o.calmAt * 10 - i) : (o.calm ?? 0));
    c.save(); c.translate(x + 77, y + 44); c.scale(k, k); c.translate(-(x + 77), -(y + 44)); miniFilm(c, x, y, 155, 88, i, cal, T + i, 8);
    if (cur === i && gen >= 1) { rr(c, x - 2, y - 2, 159, 92, 9); c.strokeStyle = K.teal; c.lineWidth = 2.5; c.stroke(); } c.restore();
    if ((o.calmAt ?? -1) >= 0) { const fl = 1 - Math.abs(o.calmAt * 10 - i - .5) * 2; if (fl > 0) { c.save(); rr(c, x, y, 155, 88, 8); c.clip(); glow(c, x + 77, y + 44, 120, '#FFFFFF', .7 * fl); c.restore(); } }
  }
  for (let i = 0; i < 150; i++) { const hh = 4 + 26 * Math.abs(Math.sin(i * .21) * Math.sin(i * .053 + 2)); c.fillStyle = rgba(d ? '#3A4456' : '#CBD3DB'); rr(c, 48 + i * 8.7, 770 - hh / 2, 4, hh, 2); c.fill(); }
  const phx = 48 + (play % 1) * 1304; c.fillStyle = K.teal; c.fillRect(phx - 1, 632, 2.5, 176); dot(c, phx, 632, 6, K.teal);
  c.globalAlpha = ga;
  // the prompt field is the big pill at 42 % — it stays opaque while the rest of the window fades in around it
  c.save(); c.translate(...WIN.field); c.scale(WIN.fieldW / 1000, WIN.fieldW / 1000); pillUI(c, 0, 0, 1000, 104, o.text ?? L('prompt'), o.typed ?? 99, o.send ?? 1, { dark: d, flow: o.flow ?? 0, rimA: o.rimA ?? 1, caret: o.caret }); c.restore();
}
// projected outline of the window (for its shadow and rim light)
const winOutline = proj => rrPts(700, 430, 1400, 860, 24, 160).map(p => proj(p[0], p[1]));

// ---------- logo ----------
const LOGO_CACHE = new Map();
function logoPaths() { if (!LOGO_CACHE.size) for (const p of LOGO_PIECES) { const n = p.d.match(/-?\d+\.?\d*/g).map(Number); let len = 0; for (let i = 2; i < n.length; i += 2) len += Math.hypot(n[i] - n[i - 2], n[i + 1] - n[i - 1]); const xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1), bx = Math.min(...xs), by = Math.min(...ys); LOGO_CACHE.set(p.name, { path: new Path2D(p.d), len, box: [bx, by, Math.max(...xs) - bx, Math.max(...ys) - by] }); } return LOGO_CACHE; }
// brand build: ribbon outline traces (0–.45), fills; arches spring up from their base (.3–.7); letters rise in (.5–1)
function logo(c, cx, cy, s, ink, u, a = 1) {
  const Lp = logoPaths(); c.save(); c.globalAlpha *= a; c.translate(cx, cy); c.scale(s, s); c.translate(-580, -126);
  const rib = Lp.get('ribbon'), tr = eio(P(u, 0, .45));
  if (tr > 0) { c.save(); c.setLineDash([rib.len * tr, rib.len]); c.strokeStyle = K.teal; c.lineWidth = 4; c.lineJoin = 'round'; c.stroke(rib.path); c.restore(); }
  c.save(); c.globalAlpha *= eo(P(u, .3, .5)); c.fillStyle = K.teal; c.fill(rib.path); c.restore();
  for (const [name, d] of [['arch-left', 0], ['arch-right', .08]]) {
    const p = Lp.get(name), k = spring(P(u, .32 + d, .72 + d)); if (k <= 0) continue; const [bx, by, bw, bh] = p.box;
    c.save(); c.translate(bx + bw / 2, by + bh); c.scale(1, k); c.translate(-(bx + bw / 2), -(by + bh)); c.fillStyle = ink; c.fill(p.path); c.restore();
  }
  let i = 0; for (const p of LOGO_PIECES) { if (!p.name.startsWith('letter')) continue; const k = eo(P(u, .5 + i * .05, .78 + i * .05)); i++; if (k <= 0) continue;
    c.save(); c.globalAlpha *= k; c.translate(0, (1 - k) * 40); c.fillStyle = ink; c.fill(Lp.get(p.name).path); c.restore(); }
  c.restore();
}
let RIB = null;
function ribbonAt(u) {
  if (!RIB) { const n = LOGO_PIECES.find(p => p.name === 'ribbon').d.match(/-?\d+\.?\d*/g).map(Number); const pts = []; for (let i = 0; i < n.length; i += 2) pts.push([n[i], n[i + 1]]); pts.push(pts[0]); RIB = mkPath(pts); }
  return pAt(RIB, clamp(u) * RIB.len);
}
const logoXY = ([x, y], cx, cy, s) => [cx + (x - 580) * s, cy + (y - 126) * s];

// =====================================================================================================================
// ACT I — the comet (world coordinates; the camera follows the head)
// =====================================================================================================================
const C1 = [2037.5, -510], TRI = [-90, 150, 30].map(a => [C1[0] + 360 * Math.cos(a * Math.PI / 180), C1[1] + 360 * Math.sin(a * Math.PI / 180)]);
const LY = -200, L0 = [2620, LY], L1 = [4120, LY], E1 = [L1[0] + 600, LY], LIFT = [E1[0] + 430, LY - 430];
const ACT1 = (() => {
  const s1 = bez([0, 0], [320, 0], [740, -28], [900, -260]);
  const wave = fnPts(u => { const x = 900 + u * 650 * 1.75; return [x, -260 - 150 * Math.sin(2 * Math.PI * (x - 900) / 650)]; }, 220);
  const end = wave[wave.length - 1], sp = fnPts(k => { const th = Math.PI / 2 - k * 4.5 * Math.PI, r = 400 * Math.pow(110 / 400, k); return [C1[0] + r * Math.cos(th), C1[1] + r * Math.sin(th)]; }, 360);
  const e3 = sp[sp.length - 1];
  const toP1 = bez(e3, [e3[0], e3[1] - 150], [TRI[0][0] + 70, TRI[0][1] + 150], TRI[0]);
  const arcTo = (a, b) => { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; return qbez(a, [C1[0] + (m[0] - C1[0]) * 1.9, C1[1] + (m[1] - C1[1]) * 1.9], b); };
  const toL0 = bez(TRI[2], [TRI[2][0] + 150, TRI[2][1] + 40], [L0[0] - 220, LY], L0);
  const line = [L0, L1];
  const arches = [...fnPts(u => [L1[0] + 150 + 150 * Math.cos(Math.PI + u * Math.PI), LY + 150 * Math.sin(Math.PI + u * Math.PI)], 60), ...fnPts(u => [L1[0] + 450 + 150 * Math.cos(Math.PI + u * Math.PI), LY + 150 * Math.sin(Math.PI + u * Math.PI)], 60).slice(1)];
  const lift = bez(E1, [E1[0] + 30, LY + 150], [E1[0] + 250, LY - 120], LIFT);
  return joinSegs([s1, wave, sp, toP1, arcTo(TRI[0], TRI[1]), arcTo(TRI[1], TRI[2]), toL0, resample(line, 120), arches, lift]);
})();
const MK = ACT1.marks; // 0 S-curve, 1 wave, 2 spiral, 3 → P1, 4 → P2, 5 → P3, 6 → L0, 7 line, 8 arches, 9 lift
const headS = keys([[0, 0], [2.5, 0], [4.8, MK[0]], [7.2, MK[1]], [9.6, MK[2]], [10.3, MK[3]], [10.8, MK[3]], [11.5, MK[4]], [12.0, MK[4]], [12.7, MK[5]], [13.2, MK[5]], [14.4, MK[6]], [16.6, MK[7]], [18.0, MK[8]], [19.2, MK[9]]]);
const cam1 = cameraPath([[0, -60, 0, 1.38, 0], [2.5, -10, -10, 1.22, 0], [4.8, 620, -200, 1.0, -.02], [7.2, 1560, -300, .92, 0], [9.6, 2037, -520, 1.12, -.05], [12.0, 2037, -590, .98, .03],
  [13.6, 2260, -420, .96, .04], [14.4, L0[0] + 380, LY - 40, 1.0, 0], [16.6, L1[0] - 300, LY - 40, 1.0, 0], [18.0, E1[0] - 300, LY - 20, 1.05, 0], [19.2, LIFT[0], LIFT[1], 2.4, 0]]);
// soft colour orbs: [x, y, radius, colour, in, out]
const ORBS1 = [[0, 0, 300, K.teal, .2, 4.2], [1387, -110, 460, K.violet, 5.0, 9.4], [1712, -410, 420, K.coral, 5.9, 9.8], [C1[0], C1[1], 560, K.sky, 7.8, 11.2],
  [TRI[0][0], TRI[0][1], 380, K.teal, 10.2, 14.2], [TRI[1][0], TRI[1][1], 380, K.violet, 11.4, 14.4], [TRI[2][0], TRI[2][1], 380, K.coral, 12.6, 14.6],
  [L1[0] + 150, LY - 120, 460, K.teal, 16.8, 19.4], [L1[0] + 450, LY - 120, 460, K.violet, 17.2, 19.4]];
const SPECKS = Array.from({ length: 70 }, (_, i) => [lerp(-900, 5600, rnd(i)), lerp(-1400, 700, rnd(i + 50)), lerp(.35, .85, rnd(i + 99)), lerp(.8, 2, rnd(i + 7)), rnd(i + 3)]);

function darkGround(c, warm = 0) {
  const g = c.createRadialGradient(W / 2, H * .46, 0, W / 2, H / 2, W * .72); g.addColorStop(0, '#111725'); g.addColorStop(1, K.night); c.fillStyle = g; c.fillRect(0, 0, W, H);
}
function vignette(c, a = .5) { const v = c.createRadialGradient(W / 2, H / 2, H * .42, W / 2, H / 2, W * .78); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${a})`); c.fillStyle = v; c.fillRect(0, 0, W, H); }

function actI(c, T) {
  darkGround(c); const cm = cam1(T), s = headS(T), head = pAt(ACT1.path, s);
  // the last second: the camera locks onto the head so the light opens from the centre of the frame
  const lock = eio(P(T, 17.9, 18.6)); cm.x = lerp(cm.x, head[0], lock); cm.y = lerp(cm.y, head[1], lock);
  withCamera(c, cm, () => {
    // specks drift at their own depth (parallax), very faint
    for (const [x, y, dep, r, tw] of SPECKS) { const sx = x + cm.x * (1 - dep), sy = y + cm.y * (1 - dep); dot(c, sx, sy, r / Math.sqrt(cm.zoom), '#DCE6F2', (.18 + .2 * Math.sin(T * .8 + tw * 6)) * (1 - P(T, 18.4, 19.0))); }
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const [x, y, r, col, a, b] of ORBS1) { const k = env(T, a, b, 1.1, 1.4); if (k > 0) glow(c, x + 30 * Math.sin(T * .5 + x), y + 24 * Math.cos(T * .4 + y), r * (.75 + .25 * eo(P(T, a, a + 1.4))), col, .30 * k); }
    // the line beat carries a warm glow under the head
    const lg = env(T, 14.3, 17.0, .6, .8); if (lg > 0) glow(c, head[0], head[1] + 20, 340, K.amber, .22 * lg);
    c.restore();
    const emit = x => {
      const zf = Math.min(1, 1.25 / cm.zoom); comet(x, ACT1.path, s, { len: 1600, lw: 3.4 * zf, a: 1 - P(T, 18.75, 19.1) });
      dot(x, head[0], head[1], (5.5 + 1.5 * Math.sin(T * 5)) * zf * (1 + 4 * P(T, 18.4, A2)), '#FFFFFF');
      // nodes: the origin, the three trio points; they stay lit for a while after the head has passed
      const nodes = [[[0, 0], 0, 4.4], [TRI[0], 10.3, 14.2], [TRI[1], 11.5, 14.3], [TRI[2], 12.7, 14.4], [L1, 16.6, 18.6]];
      for (const [[nx, ny], a, b] of nodes) { const k = env(T, a, b, .15, .6); if (k > 0) dot(x, nx, ny, 5, '#FFFFFF', k); }
    };
    emit(c); bloom(c, emit, { radius: 10, strength: 1.1, halo: .9 });
    // words, small and calm, each where the head is
    const fg = '#E9EEF5', SZ = 46;
    kin(c, L('whatIf'), -40, 0, SZ, fg, T - .5, { al: 'right', out: P(T, 3.0, 3.5) });
    const ip = pAt(ACT1.path, MK[0] * .55); kin(c, L('idea'), ip[0] - 30, ip[1] - 70, SZ, fg, T - 3.3, { out: P(T, 5.7, 6.2) });
    kin(c, L('move'), 1712, -500, SZ, fg, T - 5.6, { out: P(T, 8.1, 8.6) });
    kin(c, L('own'), C1[0], C1[1], 40, fg, T - 8.6, { out: P(T, 9.9, 10.3) });
    const tr = L('trio');
    kin(c, tr[0], TRI[0][0], TRI[0][1] - 58, SZ, fg, T - 10.25, { out: P(T, 13.3, 13.8) });
    kin(c, tr[1], TRI[1][0] - 34, TRI[1][1], SZ, fg, T - 11.45, { al: 'right', out: P(T, 13.4, 13.9) });
    kin(c, tr[2], TRI[2][0] + 34, TRI[2][1], SZ, fg, T - 12.65, { al: 'left', out: P(T, 13.5, 14.0) });
    // the sentence is written by the head as it passes along the line
    kin(c, L('sentence'), (L0[0] + L1[0]) / 2, LY - 64, 64, fg, T - 14, { prog: (i, gx) => eo(clamp((head[0] - gx - 10) / 260)) * (T < 17 ? 1 : 1), out: P(T, 17.3, 17.9) });
    const mt = L('meet'), mw = textW(c, mt.join(''), 84, 500), mx = (L1[0] + E1[0]) / 2;
    kin(c, mt.join(''), mx, LY + 120, 84, fg, T - 17.15, { st: .035, out: P(T, 18.45, 18.95),
      colAt: i => i >= [...mt[0]].length ? 'fill' : fg, fill: (x, x0, tw) => specLinear(x, x0 + textW(x, mt[0], 84), 0, x0 + tw, 0, [K.teal, K.sky, K.violet]) });
  });
  // fly into the head: light floods the frame
  // the head opens into light: a white disc with a soft sky → violet rim grows from the head until it covers the frame
  const fl = P(T, 18.4, A2); if (fl > 0) { const hx = W / 2 + (head[0] - cm.x) * cm.zoom, hy = H / 2 + (head[1] - cm.y) * cm.zoom, R = lerp(40, 3000, Math.pow(fl, 2.1)), g = c.createRadialGradient(hx, hy, 0, hx, hy, R);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.22, 'rgba(252,253,255,.96)'); g.addColorStop(.45, 'rgba(226,240,255,.62)'); g.addColorStop(.66, rgba(K.sky, .2)); g.addColorStop(.84, rgba(K.violet, .07)); g.addColorStop(1, rgba(K.violet, 0));
    c.fillStyle = g; c.fillRect(0, 0, W, H); c.fillStyle = `rgba(250,251,252,${Math.pow(P(T, 18.85, A2), 2)})`; c.fillRect(0, 0, W, H); }
  vignette(c, .5 * (1 - P(T, 18.6, A2)));
}

// =====================================================================================================================
// ACT II — light product (screen coordinates under a gentle camera)
// =====================================================================================================================
const cam2 = cameraPath([[A2, 960, 540, 1.07, 0], [21.6, 960, 540, 1.0, 0], [24.0, 960, 540, 1.035, 0], [26.4, 960, 540, 1.0, 0], [31.2, 960, 540, 1.03, 0], [36.0, 960, 548, 1.0, 0], [A3, 960, 540, 1.0, 0]]);
function lightGround(c, T) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#FBFCFD'); g.addColorStop(1, '#EFF3F6'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  glow(c, 1560 + 90 * Math.sin(T * .23), 160, 720, '#C9F1EA', .55); glow(c, 260, 940 + 50 * Math.cos(T * .2), 680, '#E3DCFF', .55); glow(c, 1700, 980, 520, '#FFE3D6', .4);
}
// window plane in act II: pill → pull back into the window → dive to the slider → pull back and lie down
function plane2(T) {
  const k1 = eio(P(T, 24.0, 25.6)), k2 = eio(P(T, 26.3, 27.5)), k3 = eio(P(T, 28.6, 29.8)), drift = P(T, 25.6, 26.4);
  const o = { u: lerp(WIN.field[0], 700, k1), v: lerp(WIN.field[1], 430, k1), px: lerp(960, 1210, k1), py: 540, s: Math.exp(lerp(Math.log(1000 / WIN.fieldW), Math.log(.7), k1)),
    yaw: lerp(0, .36, k1) - .04 * drift, pitch: lerp(0, -.1, k1), roll: lerp(0, .012, k1) };
  o.u = lerp(o.u, 1162, k2); o.v = lerp(o.v, 230, k2); o.px = lerp(o.px, 760, k2); o.py = lerp(o.py, 560, k2); o.s = Math.exp(lerp(Math.log(o.s), Math.log(2.25), k2)); o.yaw = lerp(o.yaw, -.24, k2); o.pitch = lerp(o.pitch, .05, k2);
  o.u = lerp(o.u, 700, k3); o.v = lerp(o.v, 430, k3); o.px = lerp(o.px, 960, k3); o.py = lerp(o.py, 560, k3); o.s = Math.exp(lerp(Math.log(o.s), Math.log(.6), k3)); o.yaw = lerp(o.yaw, 0, k3); o.pitch = lerp(o.pitch, .22, k3); o.roll = lerp(o.roll, 0, k3);
  o.a = 1 - P(T, 29.15, 29.75); return o;
}
// the one outline that carries act II: underline → pill → … → ring → dot. Returns { pts, cx, cy, fillA, dotK }
function outline2(T) {
  const N = 220, line1 = rrPts(960, 650, 1100, 6, 3, N), pill = rrPts(960, 540, 1000, 104, 52, N);
  const under = rrPts(960, 690, 520 * Math.max(.02, eo(P(T, 29.9, 30.5))), 6, 3, N), write = rrPts(960, 540, 560, 96, 48, N), track = rrPts(960, 540, 640, 10, 5, N);
  const wave = wavePts(960, 540, 640, 46 * eo(P(T, 33.5, 34.2)) * (1 - P(T, 34.6, 35.0)), 10, T * 3.2, N), ring = circlePts(960, 540, 110, N);
  if (T < 21.3) return { pts: line1, fillA: 0 };
  if (T < 24.4) return { pts: lerpPts(line1, pill, eio(P(T, 21.3, 21.95))), fillA: P(T, 21.4, 21.9) };
  if (T < 29.85) return null;
  if (T < 30.8) return { pts: under, fillA: 0 };
  if (T < 32.3) return { pts: lerpPts(under, write, eio(P(T, 30.8, 31.4))), fillA: P(T, 30.9, 31.3) };
  if (T < 33.5) return { pts: lerpPts(write, track, eio(P(T, 32.3, 32.85))), fillA: 1 };
  if (T < 34.7) return { pts: lerpPts(track, wave, eio(P(T, 33.5, 33.8))), fillA: 1 };
  if (T < 36.4) return { pts: lerpPts(wave, ring, eio(P(T, 34.7, 35.3))), fillA: 1 };
  // pressing Present dims the ring like a cinema, then the ring opens past the frame: its dark inside becomes act III
  return { pts: circlePts(960, 540, lerp(110, 1450, eio(P(T, 36.45, 37.6))), N), fillA: 1, dark: P(T, 36.0, 36.45) };
}
function actII(c, T) {
  lightGround(c, T);
  withCamera(c, cam2(T), () => {
    const flow = (T - 21.6) * .55, ink = K.ink;
    // light band from act I narrows into the underline
    const nb = eio(P(T, A2 + .05, 20.4)), bh = lerp(420, 6, nb), bw = lerp(2600, 1100, nb);
    if (T < 21.5) { const ba = 1 - P(T, 21.2, 21.5);
      bloom(c, x => { x.fillStyle = specLinear(x, 960 - bw / 2, 0, 960 + bw / 2, 0, [K.teal, K.sky, K.violet, K.coral, K.amber]); rr(x, 960 - bw / 2, 650 - bh / 2, bw, bh, bh / 2); x.fill(); }, { radius: 10 + bh * .25, strength: 1 * ba, mode: 'source-over', halo: .7 });
      if (nb > .7) { c.save(); c.globalAlpha *= P(nb, .7, 1) * ba; c.fillStyle = specLinear(c, 960 - bw / 2, 0, 960 + bw / 2, 0, [K.teal, K.sky, K.violet, K.coral, K.amber]); rr(c, 960 - bw / 2, 650 - bh / 2, bw, bh, bh / 2); c.fill(); c.restore(); } }
    kin(c, L('describe'), 960, 520, 150, ink, T - 19.95, { w: 600, out: P(T, 21.15, 21.6), st: .04 });
    // the morphing outline (pill / verbs)
    const ol = outline2(T);
    if (ol) {
      const pts = ol.pts, ga = c.globalAlpha, sc = devScale(c);
      if (ol.fillA > 0) { c.save(); c.globalAlpha = ga * ol.fillA; c.shadowColor = 'rgba(28,46,64,.14)'; c.shadowBlur = 44 * sc; c.shadowOffsetY = 14 * sc; polyPath(c, pts); c.fillStyle = ol.dark ? rgba(mixc('#FFFFFF', '#040507', ol.dark)) : '#FFFFFF'; c.fill(); c.restore(); }
      const stroke = x => { polyPath(x, pts); x.strokeStyle = conic(x, 960, 540, flow); x.lineWidth = 3.2; x.stroke(); };
      if (T >= 21.3) { stroke(c); bloom(c, stroke, { radius: 16, strength: .9, mode: 'source-over', halo: .7 }); }
      else { polyPath(c, pts); c.fillStyle = specLinear(c, 410, 0, 1510, 0); c.fill(); }
    }
    // the prompt types inside the pill
    if (T >= 21.6 && T < 24.4) {
      const n = (T - 22.0) * 24, len = [...L('prompt')].length, send = P(T, 23.55, 23.7);
      pillUI(c, 960, 540, 1000, 104, L('prompt'), n, send, { body: false, rimA: 0, caret: n < len + 4, pulse: P(T, 23.65, 23.95), textA: P(T, 21.8, 22.0) });
    }
    // the window
    if (T >= 24.0 && T < 29.85) {
      const o = plane2(T), proj = planeProj(o), sc = devScale(c), chromeA = P(T, 24.0, 24.55);
      const ui = { dark: false, chromeA, gen: P(T, 24.5, 26.1), slider: lerp(.35, .62, spring(P(T, 27.3, 28.2))), play: (T - 24) * .14, flow, rimA: 1 };
      layer(c, 'win2', o.a, x => {
        x.save(); x.globalAlpha *= chromeA; x.shadowColor = 'rgba(28,46,64,.16)'; x.shadowBlur = 90 * o.s * sc; x.shadowOffsetY = 40 * o.s * sc; polyPath(x, winOutline(proj)); x.fillStyle = '#FFFFFF'; x.fill(); x.restore();
        const [tex, ts] = texture(x, 'win', WIN.w, WIN.h, o.s, t => winUI(t, T, ui)); drawPlane(x, tex, ts, WIN.w, WIN.h, proj);
        // a soft glow follows the slider knob during the dive
        const kk = env(T, 26.8, 29.0, .4, .5); if (kk > 0) { const kp = proj(952 + 420 * ui.slider, 230.5); x.save(); x.globalCompositeOperation = 'source-over'; glow(x, kp[0], kp[1], 90 * o.s, K.teal, .28 * kk); x.restore(); }
      });
      // the big pill's halo hands over to the window
      if (T < 24.5) { const pr = rrPts(960, 540, 1000, 104, 52, 160); bloom(c, x => { polyPath(x, pr); x.strokeStyle = conic(x, 960, 540, flow); x.lineWidth = 3.2; x.stroke(); }, { radius: 16, strength: .9 * (1 - P(T, 24.0, 24.5)), mode: 'source-over', halo: .7 }); }
    }
    const bl = L('builds'); kin(c, bl[0], 130, 470, 76, ink, T - 25.0, { al: 'left', w: 600, out: P(T, 26.2, 26.6) }); kin(c, bl[1], 130, 562, 76, ink, T - 25.15, { al: 'left', w: 600, out: P(T, 26.25, 26.65) });
    kin(c, L('adjust'), 1800, 540, 150, ink, T - 26.9, { al: 'right', w: 600, out: P(T, 28.55, 29.0), colAt: i => i === [...L('adjust')].length - 1 ? K.teal : ink });
    kin(c, L('done'), 960, 520, 240, ink, T - 29.3, { w: 600, out: P(T, 30.6, 31.1), colAt: () => 'fill', fill: (x, x0, tw) => specLinear(x, x0, 0, x0 + tw, 0, [K.teal, K.sky, K.violet]) });
    // verbs
    const vb = L('verbs');
    const VY = 360; [[31.35, 32.3], [32.55, 33.5], [33.75, 34.7], [34.95, 36.0]].forEach(([a, b], i) => kin(c, vb[i], 960, VY, 92, ink, T - a, { w: 600, out: P(T, b, b + .32), lift: .25 }));
    if (T >= 31.3 && T < 32.5 && (T * 1.6) % 1 < .6) { c.save(); c.globalAlpha *= P(T, 31.3, 31.45) * (1 - P(T, 32.2, 32.4)); c.fillStyle = K.teal; c.fillRect(960 - 236, 522, 3, 38); c.restore(); }
    // Tune: a knob rides the track
    const kn = env(T, 32.6, 33.75, .25, .25); if (kn > 0) { const kx = lerp(960 - 320 * .5, 960 + 320 * .4, spring(P(T, 32.85, 33.4))); c.save(); c.globalAlpha *= kn; c.shadowColor = 'rgba(28,46,64,.2)'; c.shadowBlur = 18 * devScale(c); dot(c, kx, 540, 26, '#FFFFFF'); c.restore();
      c.save(); c.globalAlpha *= kn; c.strokeStyle = conic(c, kx, 540, flow * 2); c.lineWidth = 4; c.beginPath(); c.arc(kx, 540, 26, 0, 7); c.stroke(); c.restore(); }
    // Present: a play mark inside the ring
    // Present: a play mark in the ring; pressed, it turns teal, then folds into the dot that opens act III
    if (T >= 35.1) { const k = spring(P(T, 35.1, 35.6)) * (1 - .14 * Math.sin(Math.PI * P(T, 35.95, 36.3))), f = eio(P(T, 36.7, 37.3)), col = rgba(mixc(K.ink, K.teal, P(T, 36.0, 36.4)));
      if (f < 1) { c.save(); c.translate(lerp(970, 960, f), 540); c.scale(k * (1 - f) * .9, k * (1 - f) * .9); c.beginPath(); c.moveTo(-34, -42); c.lineTo(48, 0); c.lineTo(-34, 42); c.closePath(); c.lineJoin = 'round'; c.lineWidth = 10; c.strokeStyle = col; c.fillStyle = col; c.fill(); c.stroke(); c.restore(); }
      if (f > 0 && T < 37.62) { const b = 1 + .1 * Math.sin((T - 37.3) * 6) * P(T, 37.3, 37.6); c.save(); c.globalCompositeOperation = 'lighter'; glow(c, 960, 540, 90 * b, K.teal, .35 * f); c.restore(); dot(c, 960, 540, 14 * f, K.teal); } }
  });
  if (T >= 37.6) neonPill3(c, T);
  // the flood from act I clears
  const fl = 1 - eio(P(T, A2, 20.1)); if (fl > 0) { c.fillStyle = `rgba(250,251,252,${fl})`; c.fillRect(0, 0, W, H); }
}

// =====================================================================================================================
// ACT III — neon
// =====================================================================================================================
function neonRim(c, pts, cx, cy, flow, lw = 4, k = 1) {
  const st = x => { polyPath(x, pts); x.strokeStyle = conic(x, cx, cy, flow); x.lineWidth = lw; x.lineJoin = 'round'; x.stroke(); };
  c.save(); c.globalAlpha *= k; st(c); c.restore(); bloom(c, st, { radius: 14, strength: 1.2 * k, halo: 1 });
}
function plane3(T) {
  const kin_ = eo(P(T, 42.95, 43.8));
  return { u: lerp(560, 820, P(T, 43.2, 45.0)), v: 430, px: lerp(3000, 1000, kin_), py: 560, s: .8 * lerp(1, 1.18, eio(P(T, 44.4, 45.6))), yaw: lerp(-.5, -.3, eio(P(T, 42.95, 45.3))), pitch: .14, roll: -.02 };
}
// light arc that draws the slogan pill: enters from the lower left, then runs once round the pill
const ARC3 = (() => { const a = bez([960, 566], [1750, 1000], [380, 1080], [510, 540], 140); return joinSegs([a, rrPts(960, 540, 900, 120, 60, 260)]); })();
const arcS = keys([[50.55, 0], [51.55, ARC3.marks[0]], [52.4, ARC3.marks[1]]]);
const CHIPS = [[-2.85, .0], [-.3, .35], [.55, .7], [2.6, 1.05], [1.57, 1.4]];
const gauss = s => Math.sqrt(-2 * Math.log(1 - rnd(s) * .9999)) * Math.cos(2 * Math.PI * rnd(s + .5));
// the galaxy: the diffuse disc (dust + light) is baked face-on once and blurred; the stars are points projected every frame,
// so they stay round when the disc is tilted. Same two log-spiral arms and tints as the Pro Triangulum galaxy.
const GC = [960, 650], GINC = .44, GTILT = -.28, GR = 1000, GT = 1024, GT_R = 480;
const armTh = (arm, u) => arm * Math.PI + Math.log(u * 12 + 1) * 2.25;
const GCOLS = ['#FFE2B8', '#FFFFFF', '#CFF1EC', '#2FD3C2', '#8FE3D8', '#B7A6F6', '#C9B8FF', '#9FF2E6'];
const GSTARS = (() => { const B = new Map(), put = (r, th, size, a, col) => { const ai = Math.min(3, Math.floor(clamp(a) * 4)), key = col + '|' + ai; if (!B.has(key)) B.set(key, { col, a: (ai + .5) / 4, pts: [] }); B.get(key).pts.push(Math.cos(th) * r, Math.sin(th) * r, size); };
  const tint = (u, k) => u < .14 ? (k > .7 ? '#FFFFFF' : '#FFE2B8') : u < .42 ? (k > .72 ? '#FFFFFF' : '#CFF1EC') : k > .8 ? '#B7A6F6' : k > .38 ? '#2FD3C2' : '#8FE3D8';
  for (let i = 0; i < 9000; i++) { const arm = i % 2, u = .05 + .95 * rnd(i * 1.37) ** 1.12, g = gauss(i * 4.21), k = rnd(i * 6.6); // arm stars
    put(u * (.88 + rnd(i * 2.9) * .24), armTh(arm, u) + g * (.42 + u * .78), (1.1 + rnd(i * 8.8) ** 6 * 2.6) * (1.15 - u * .35), (.35 + k * .6) * (.62 + .38 * Math.min(1, u * 3)) * (1 - Math.abs(g) * .5), tint(u, k)); }
  for (let q = 0; q < 140; q++) { const arm = q % 2, u = .22 + .7 * rnd(q * 7.31 + 2), th0 = armTh(arm, u) + gauss(q * 3.3) * .25, col = rnd(q * 5.7) > .45 ? '#C9B8FF' : '#9FF2E6'; // star-forming knots
    for (let m = 0; m < 14; m++) { const t = q * 40 + m; put(u + gauss(t * 1.9) * .025, th0 + gauss(t * 2.7) * .04, 1.2 + rnd(t * 4.4) ** 3 * 2.2, .5 + rnd(t * 6.2) * .5, m % 5 ? col : '#FFFFFF'); } }
  for (let i = 0; i < 1000; i++) { const t = i + 70000; put(Math.abs(gauss(t * 1.3)) * .09, rnd(t * 2.1) * 7, 1 + rnd(t * 3.3) * 1.2, .12 + rnd(t * 4.1) * .3, rnd(t * 5.2) > .3 ? '#FFE2B8' : '#FFFFFF'); } // bulge
  return [...B.values()]; })();
let GTEX = null;
function galTex() {
  if (GTEX) return GTEX;
  const a = new OffscreenCanvas(GT, GT), x = a.getContext('2d'), o = GT / 2; x.globalCompositeOperation = 'lighter';
  for (const [r, col, al] of [[GT_R * 1.05, '#2FD3C2', .1], [GT_R * .6, '#8C6BFF', .08], [GT_R * .32, '#FFD9A0', .13], [GT_R * .12, '#FFE9C2', .2]]) glow(x, o, o, r, col, al);
  for (let i = 0; i < 30000; i++) { const j = i + 9000, arm = i % 2, u = .03 + .99 * rnd(j * 1.91) ** .85, g = gauss(j * 4.7), k = rnd(j * 6.1), r = u * (.94 + rnd(j * 2.3) * .2) * GT_R, th = armTh(arm, u) + g * (.85 + u * 1.05); // dust
    x.globalAlpha = (.06 + k * .1) * (1 - Math.min(1, u) * .45); x.fillStyle = u < .2 ? '#FFE2B8' : k > .72 ? '#8C6BFF' : '#2FD3C2'; x.fillRect(o + Math.cos(th) * r - 1, o + Math.sin(th) * r - 1, 2.2, 2.2); }
  const b = new OffscreenCanvas(GT, GT), y = b.getContext('2d'); y.globalCompositeOperation = 'lighter'; y.filter = 'blur(5px)'; y.drawImage(a, 0, 0); y.filter = 'blur(1.2px)'; y.globalAlpha = .7; y.drawImage(a, 0, 0); y.filter = 'none';
  return (GTEX = b);
}
// draw the disc centred at (cx, cy): sc = screen px per unit radius, spin turns it in its own plane
function galDraw(x, cx, cy, sc, spin, a) {
  x.save(); x.globalCompositeOperation = 'lighter'; x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.save(); x.globalAlpha *= a; x.translate(cx, cy); x.rotate(GTILT); x.scale(sc / GT_R, sc / GT_R * GINC); x.rotate(spin); x.drawImage(galTex(), -GT / 2, -GT / 2); x.restore();
  const cs = Math.cos(spin), sn = Math.sin(spin), ct = Math.cos(GTILT), st = Math.sin(GTILT), ga = x.globalAlpha, zs = Math.sqrt(sc / GR);
  for (const bk of GSTARS) { x.fillStyle = bk.col; x.globalAlpha = ga * a * bk.a; x.beginPath(); const q = bk.pts;
    for (let i = 0; i < q.length; i += 3) { const u = (q[i] * cs - q[i + 1] * sn) * sc, v = (q[i] * sn + q[i + 1] * cs) * sc * GINC, px = cx + u * ct - v * st, py = cy + u * st + v * ct, r = q[i + 2] * zs; x.rect(px - r / 2, py - r / 2, r, r); }
    x.fill(); }
  x.restore();
}
// far stars behind the galaxy and soft bokeh in front of it (parallax against the camera push)
const FAR = Array.from({ length: 320 }, (_, i) => [rnd(i * 3.1 + 5) * W, rnd(i * 4.7 + 9) * H, .5 + rnd(i * 2.2) * 1.3, rnd(i * 6.3)]);
const BOKEH = Array.from({ length: 16 }, (_, i) => [rnd(i * 9.1 + 1) * W, rnd(i * 5.3 + 2) * H, 30 + rnd(i * 7.7) * 70, SPEC[i % 3 === 2 ? 2 : i % 2], rnd(i * 3.9)]);
// the galaxy in the frame: it unfolds out of the window's stars, turns slowly, then collapses into the bright core the arc leaves from
function galaxy(c, T, a) {
  if (a <= 0) return; const open = eo(P(T, 44.9, 46.6)), pull = eio(P(T, 49.95, 50.75)), spin = -.6 * (1 - open) + .045 * (T - 45) - .5 * pull * pull;
  const cx = GC[0], cy = lerp(GC[1], 566, pull), sc = GR * lerp(.55, 1, open) * lerp(1, .05, pull);
  c.save(); c.globalAlpha *= a; for (const [x, y, r, tw] of FAR) dot(c, x, y, r, '#DCE6F2', (.16 + .14 * Math.sin(T * .7 + tw * 6)) * (1 - pull)); c.restore();
  const k = a * lerp(.6, 1, open); galDraw(c, cx, cy, sc, spin, k);
  c.save(); c.globalCompositeOperation = 'lighter'; glow(c, cx, cy, lerp(240, 140, pull), '#FFE2B8', (.04 + .5 * pull) * a); c.restore();
  bloom(c, x => galDraw(x, cx, cy, sc, spin, 1), { radius: 9, strength: .32 * k * (1 + pull), halo: .9 });
  c.save(); c.globalAlpha *= a * (1 - pull); c.globalCompositeOperation = 'lighter';
  for (const [x, y, r, col, ph] of BOKEH) { const dx = (x - 960) * .18 * P(T, 45, 50.8), bx = x + dx + 30 * Math.sin(T * .3 + ph * 6), by = y + 12 * Math.cos(T * .25 + ph * 5); glow(c, bx, by, r, col, .07 + .05 * Math.sin(T * .5 + ph * 4)); }
  c.restore();
}
// the window breaks into stars that rush past the camera (each particle is a point of the window plane)
const DIS = Array.from({ length: 1800 }, (_, i) => { const u = rnd(i * 1.7 + 3), v = rnd(i * 2.3 + 7), d = Math.hypot(u - .35, v - .4); return [u * WIN.w, v * WIN.h, 44.85 + d * .45 + rnd(i * 5.1) * .12, [K.teal, '#FFFFFF', K.sky, K.violet, '#CFF1EC'][i % 5], .9 + rnd(i * 3.3) * 1.6]; });
function dissolve(c, T, proj) {
  if (T < 44.85 || T > 46.4) return; c.save(); c.globalCompositeOperation = 'lighter';
  for (const [u, v, t0, col, sz] of DIS) { const f = P(T, t0, t0 + .95); if (f <= 0 || f >= 1) continue; const [x0, y0] = proj(u, v), e = ei(f) * 3.2 + f * .4, x = 960 + (x0 - 960) * (1 + e), y = 560 + (y0 - 560) * (1 + e), r = sz * (1 + 4 * ei(f));
    if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue; c.globalAlpha = P(f, 0, .06) * Math.pow(1 - f, .8) * .9; c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  c.restore();
}
// the dot that ends act II opens straight into the neon search pill, types an edit, then the camera swings round it and flies through
function neonPill3(c, T) {
  const flow = T * .9, k = spring(P(T, 37.6, 38.35)), w = lerp(28, 820, k), h = lerp(28, 120, Math.min(1, k * 1.1)), sw = eio(P(T, 39.0, 40.4)), push = ei(P(T, 40.15, 40.85));
  const o = { u: lerp(500, 690, push), v: 80, px: lerp(960, 1010, sw), py: lerp(540, 520, sw), s: lerp(1, 1.3, sw) * Math.exp(Math.log(10) * push), yaw: lerp(0, .52, sw), pitch: lerp(0, -.2, sw), roll: lerp(0, .03, sw) };
  const proj = planeProj(o), n = (T - 38.05) * 22, pa = 1 - P(T, 40.6, 40.85);
  layer(c, 'pill3', pa, x => {
    const [tex, ts] = texture(x, 'pill3', 1000, 160, o.s, t => pillUI(t, 500, 80, w, h, L('calmer'), n, P(T, 38.9, 39.0), { dark: true, rimA: 0, caret: n < 20, icon: true, textA: P(T, 37.9, 38.05) }));
    drawPlane(x, tex, ts, 1000, 160, proj, 24, 6);
    neonRim(x, rrPts(500, 80, w, h, h / 2, 200).map(p => proj(...p)), ...proj(500, 80), flow, 4, 1); });
}
function actIII(c, T) {
  c.fillStyle = '#040507'; c.fillRect(0, 0, W, H); const flow = T * .9;
  const roll = 0, zm = T > 45 && T < 51.2 ? lerp(1, 1.08, P(T, 45, 49.9)) * lerp(1, 1.25, eio(P(T, 49.9, 50.8))) : 1;
  withCamera(c, { x: 960, y: 540, zoom: zm, roll }, () => {
    const va = P(T, 44.9, 45.7) * (1 - P(T, 50.5, 51.05)); galaxy(c, T, va);
    // 1. the neon pill (opened from the dot at the end of act II), the camera swings round it and flies through
    if (T < 40.85) neonPill3(c, T);
    // 2. kinetic type, then a whip pan
    if (T >= 40.7 && T < 43.6) {
      const wx = -2600 * ei(P(T, 42.85, 43.3)); c.save(); c.translate(wx, 0);
      const ow = L('oneWord'), all = ow.join(''), n0 = [...ow[0]].length, n1 = n0 + [...ow[1]].length;
      kin(c, all, 960, 540, 124, K.fg, T - 40.8, { out: P(T, 41.95, 42.35), lift: .4, st: .035, colAt: i => i >= n0 && i < n1 ? 'fill' : K.fg, fill: (x, x0, tw) => specLinear(x, x0 + textW(x, ow[0], 124), 0, x0 + textW(x, ow[0] + ow[1], 124), 0, [K.teal, K.sky, K.violet]) });
      kin(c, L('follows'), 960, 540, 108, K.fg, T - 42.05, { st: .028 });
      c.restore();
    }
    // 3. the dark window enters on the whip, the film re-renders calmer, then the window breaks into stars that rush past the camera
    if (T >= 42.95 && T < 46.4) {
      const o = plane3(T), proj = planeProj(o), cAt = P(T, 43.7, 45.0) * .8, ui = { dark: true, text: L('calmer'), typed: 99, send: 1, gen: 1, calmAt: cAt, calm: 0, play: .05 + (T - 43) * .1, flow, rimA: 1 };
      ui.calm = P(T, 44.0, 45.0);
      layer(c, 'win3', 1 - P(T, 44.95, 45.5), x => { const [tex, ts] = texture(x, 'win3', WIN.w, WIN.h, o.s, t => winUI(t, T, ui)); drawPlane(x, tex, ts, WIN.w, WIN.h, proj); });
      const top = fnPts(u => proj(lerp(40, 1360, u), 0), 60), ra = 1 - P(T, 44.9, 45.3);
      const st = x => { polyPath(x, top, false); x.strokeStyle = specLinear(x, top[0][0], top[0][1], top[60][0], top[60][1], [K.teal, K.sky, K.violet]); x.lineWidth = 3; x.stroke(); };
      if (ra > 0) { c.save(); c.globalAlpha *= ra; st(c); c.restore(); bloom(c, st, { radius: 16, strength: 1.1 * ra }); }
      dissolve(c, T, proj);
    }
    // 4. the galaxy of everything you can make: the words sit above it, prompt chips drift out across the disc
    if (va > 0) {
      CHIPS.forEach(([an, d], i) => { const t0 = 45.9 + d, k = env(T, t0, t0 + 3.6, .5, .7) * (1 - P(T, 49.9, 50.35)); if (k <= 0) return; const R = 380 + 50 * (T - t0), x = GC[0] + Math.cos(an) * R * 1.55, y = GC[1] - 10 + Math.sin(an) * R * .72;
        const s = L('chips')[i], tw = textW(c, s, 22, 500); c.save(); c.globalAlpha *= k; c.translate(x, y); c.rotate(.05 * Math.sin(i * 2)); rr(c, -tw / 2 - 40, -26, tw + 70, 52, 26); c.fillStyle = 'rgba(16,20,28,.78)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1.2; c.stroke();
          dot(c, -tw / 2 - 18, 0, 6, SPEC[i % 5]); setFont(c, 22, 500); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#D6DDE6'; c.fillText(s, -tw / 2, 1); c.restore(); });
      c.save(); c.globalAlpha *= 1 - P(T, 50.0, 50.4);
      kin(c, L('from'), 960, 214, 40, '#AEB8C6', T - 45.9, { tint: false });
      const kinds = L('kinds'); kinds.forEach((s, i) => { const t0 = 46.05 + i * 1.15; kin(c, s, 960, 312, 124, '#FFFFFF', T - t0, { w: 600, st: .028, out: i < 3 ? P(T, t0 + 1.0, t0 + 1.2) : 0, lift: .15 }); });
      c.restore();
    }
  });
  // 5. light arc draws the slogan pill; 6. hold, then it shrinks to a dot; 7. the dot draws the logo
  if (T >= 50.3 && T < 55.3) {
    const sh = eio(P(T, 54.55, 55.2)), w = lerp(900, 24, sh), h = lerp(120, 24, sh), body = P(T, 51.9, 52.4);
    if (body > 0) { c.save(); c.globalAlpha *= body; rr(c, 960 - w / 2, 540 - h / 2, w, h, h / 2); c.fillStyle = rgba(mixc('#0B0E14', K.teal, sh)); c.fill(); c.restore(); }
    const s = arcS(T); if (T < 52.6) { const em = x => { comet(x, ARC3.path, s, { len: 2300, lw: 4, per: 1900, fade: .8 }); if (T < 52.35) dot(x, ...pAt(ARC3.path, s).slice(0, 2), 6, '#FFFFFF'); }; c.save(); c.globalAlpha *= 1 - P(T, 52.3, 52.6); em(c); c.restore(); bloom(c, em, { radius: 12, strength: 1.2 * (1 - P(T, 52.3, 52.6)) }); }
    const ra = P(T, 52.2, 52.5) * (1 - P(T, 54.9, 55.2)); if (ra > 0) neonRim(c, rrPts(960, 540, w, h, h / 2, 200), 960, 540, flow, 4, ra);
    const n = (T - 52.45) * 20, len = [...L('slogan')].length;
    if (n > 0) { c.save(); c.globalAlpha *= 1 - P(T, 54.35, 54.6); setFont(c, 46, 500); c.textAlign = 'center'; c.textBaseline = 'middle'; const full = textW(c, L('slogan'), 46); const s2 = [...L('slogan')].slice(0, Math.floor(clamp(n, 0, len))).join('');
      c.fillStyle = K.fg; c.textAlign = 'left'; c.fillText(s2, 960 - full / 2, 542); if (n < len + 6 && (T * 1.6) % 1 < .6) { c.fillStyle = K.teal; c.fillRect(960 - full / 2 + c.measureText(s2).width + 5, 518, 3, 48); } c.restore(); }
    if (sh > .9) { glow(c, 960, 540, 80, K.teal, .4 * P(sh, .9, 1)); }
  }
  if (T >= 55.2) {
    const LX = 960, LYY = 500, LS = .9, st = logoXY(ribbonAt(0), LX, LYY, LS), mv = eio(P(T, 55.2, 55.75)), u = P(T, 55.7, 57.9);
    const fade = 1 - P(T, 59.0, 60.0); c.save(); c.globalAlpha *= fade;
    glow(c, LX, LYY, 520, K.teal, .12 * P(T, 56, 57.5));
    if (u <= 0) { const x = lerp(960, st[0], mv), y = lerp(540, st[1], mv); glow(c, x, y, 80, K.teal, .45); dot(c, x, y, 12, K.teal); }
    else { logo(c, LX, LYY, LS, '#F2F5F7', u); const tr = eio(P(u, 0, .45)); if (tr < 1) { const p = logoXY(ribbonAt(tr), LX, LYY, LS); glow(c, p[0], p[1], 70, K.teal, .5 * (1 - P(u, .38, .5))); dot(c, p[0], p[1], 11 * (1 - P(u, .36, .5)), '#FFFFFF'); }
      bloom(c, x => logo(x, LX, LYY, LS, '#F2F5F7', u), { radius: 14, strength: .22 }); }
    kin(c, 'mografy.app', 960, 690, 34, '#9AA6B4', T - 57.7, { tint: false });
    c.restore();
  }
  vignette(c, .55);
}

// =====================================================================================================================
function frame(c, T) {
  NOW = T; c.save();
  if (T < A2) actI(c, T); else if (T < A3) actII(c, T); else actIII(c, T);
  c.restore();
}
// beats: the film's one timing table → presentation slides (meta.shots), review times and the storyboard
const BEATS = [
  ['What if', 0, 2.5, 1.8, 'A single point of light breathes beside the words.', 'Locked, slow pull-back.'],
  ['an idea', 2.5, 4.8, 4.2, 'The point leaves and draws an S-curve: a comet coloured teal → sky → violet.', 'Camera follows the head.'],
  ['could move', 4.8, 7.2, 6.6, 'The comet becomes a wave; violet and coral orbs bloom under it.', 'Follow, slight zoom-out.'],
  ['on its own?', 7.2, 9.6, 9.2, 'The wave winds into a spiral; the question sits at its centre.', 'Push in, roll −3°.'],
  ['Shots · Rhythm · Music', 9.6, 13.2, 12.9, 'The head visits three nodes; each lights an orb and a word.', 'Slow orbit, roll +2°.'],
  ['From one sentence.', 13.2, 16.6, 16.0, 'A straight line: the head writes the sentence as it passes.', 'Track right with the head.'],
  ['Meet Mografy', 16.6, A2, 18.2, 'Two arches like the logo, "Mografy" in the spectrum; the head lifts off.', 'Lock onto the head; it opens into white light.'],
  ['Describe it.', A2, 21.6, 20.9, 'The light narrows into an underline under big type.', 'Settling push.'],
  ['Prompt', 21.6, 24.0, 23.6, 'The underline becomes the prompt pill; the prompt types itself.', 'Near-locked.'],
  ['It builds the whole film', 24.0, 26.4, 26.1, 'Pull back: the pill is the prompt field of a 3D Mografy window; the shots pop into the timeline.', 'Pull back + yaw 20°.'],
  ['Adjust.', 26.4, 28.8, 28.3, 'Dive to the duration slider; the knob springs 0.8s → 1.2s.', 'Dive + swing the other way.'],
  ['Done.', 28.8, 31.2, 30.4, 'The window settles flat in the centre and fades behind "Done." in the spectrum; an underline draws.', 'Pull back to centre.'],
  ['Write', 31.2, 32.4, 32.0, 'The underline becomes a pill; "Write" types in it.', 'Locked.'],
  ['Tune', 32.4, 33.6, 33.3, 'The pill flattens into a track; a knob springs along it.', 'Locked.'],
  ['Score', 33.6, 34.8, 34.4, 'The track starts to wave.', 'Locked.'],
  ['Present', 34.8, 36.4, 35.6, 'The wave closes into a ring around a play mark; every verb sits on the same line, its word above it.', 'Locked.'],
  ['The dot', 36.4, A3, 38.1, 'Present is pressed: the ring dims like a cinema, the play mark folds into a teal dot, the ring opens past the frame, and the dot springs straight open into the neon search pill.', 'The ring opens through the camera.'],
  ['Make it calmer', A3, 40.8, 40.0, 'The neon search pill types an edit.', 'Orbit 30°, then fly through the pill.'],
  ['Change one word.', 40.8, 42.0, 41.7, 'Big blur-in type; "one" in the spectrum.', 'Locked.'],
  ['The whole film follows.', 42.0, 43.2, 42.8, 'Second line; then a whip pan left.', 'Whip.'],
  ['Re-render', 43.2, 45.6, 44.6, 'The dark window lands on the whip; shot by shot the film turns calmer, then the window breaks into stars.', 'Dolly; the stars rush past the camera.'],
  ['From one sentence, …', 45.6, 50.4, 47.6, 'A spiral galaxy (sibling of the Pro Triangulum one) unfolds and turns; the big word above it cycles through what you can make; prompt chips drift across the disc.', 'Slow push.'],
  ['Light arc', 50.4, 52.8, 52.1, 'The galaxy collapses into its bright core; one light arc leaves it and runs round the slogan pill.', 'Push.'],
  ['Some ideas need to move.', 52.8, 55.2, 54.1, 'The slogan types in the neon pill; the pill shrinks to a dot.', 'Locked.'],
  ['Mografy', 55.2, DUR, 59.0, 'The dot glides to the ribbon and draws the logo; mografy.app.', 'Locked, fade out.'],
];

const SHOTS = beats(BEATS.map(([title, , end, stop, note]) => ({ title, end, stop, note })));

export { DUR, BEATS, SHOTS, frame };
