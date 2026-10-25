// @ts-nocheck
// Mografy Pro Triangulum promo v4: drawing for every beat, with Three.js particle layers (ported from storyboards/board-src v4 by to-project.py).
// Pure function of time on a 1920 × 1080 logical canvas; SHOTS holds each beat's design times.
import { beats, blurLayer, clamp, ease, lerp, pr as P } from '@mografy/runtime';
import { LOGO_PIECES } from './logo.js';

// ---------- Shot list (v3: ten beats, one continuous camera, a light trail that links them) ----------
export const SHOTS = [
  { id: 'B01', start: 0, end: 3.6, key: 1.8, stop: 3.5, slide: '點亮', thumbs: [0.6, 1.4, 3.0], title: '點亮',
    caps: [],
    action: '全黑的深空，前景有幾顆失焦的大光點緩緩飄過。0.3 一個小光點在左下亮起、呼吸；1.0 起它拖著一條細長的光軌，沿弧線飛向畫面右側（1.0–2.7）。2.6 光點炸開，星點從核心往外綻放，長成三角座星系（2.6–3.5）。',
    trans: '星系在 B02 繼續轉，同一個鏡頭沒有切換。' },
  { id: 'B02', start: 3.6, end: 8.2, xf: .3, key: 5.9, stop: 6.8, slide: 'Mografy Pro Triangulum', thumbs: [4.2, 6.2, 7.6], title: 'Mografy Pro Triangulum',
    caps: [],
    action: '星系在右邊慢慢自轉、鏡頭緩推。左側文字：3.9「MOGRAFY PRO」香檳銀字距拉開；4.2 起「Triangulum」逐字從遮罩裡升起；5.0 一條細線與「付費版本 · 即將推出」。5.6–6.6 一道高光從左到右掃過「Triangulum」。',
    trans: '7.2–8.2 文字往上收進遮罩；星系的星點沿旋臂被拉直，流成四條光線，落在 B03 時間軸的四條軌道上。' },
  { id: 'B03', start: 8.2, end: 12.6, key: 11.6, stop: 11.8, slide: '動態元件', thumbs: [8.6, 9.4, 10.6], title: '動態元件',
    caps: [],
    action: '左上「01 — 動態元件」與兩行大字「每個圖層，都是一個動態元件。」。四條光線各由一顆光點拉出成色塊（8.3–9.4）；右上的畫面預覽裡，元素照色塊依序進場：星球、標題、卡片、字幕。播放頭持續往右走。',
    trans: '同一個鏡頭直接推進成 B04 的特寫。' },
  { id: 'B04', start: 12.6, end: 16.2, xf: 0, key: 14.2, stop: 14.9, slide: '只有停留會變長', thumbs: [13.0, 13.6, 15.4], title: '進場・停留・退場（特寫）',
    caps: [],
    action: '鏡頭推進兩倍，對準星球色塊的尾端，上方的畫面預覽失焦。色塊上方標出「進場／停留／退場」；游標抓住尾端往右拉（13.3–14.5），只有停留變長，兩端漸層寬度不變。大字換成「拖動尾端，只有停留會變長。」播放頭經過舊的結束點，星球仍留在畫面上。',
    trans: '15.4–16.2 鏡頭拉回、介面失焦淡出；標題色塊上飛出一顆青色光點，拖著光軌飛到 B05 的品牌色色票上。' },
  { id: 'B05', start: 16.2, end: 20.4, xf: .5, key: 18.9, stop: 19.4, slide: '設計系統', thumbs: [16.6, 17.6, 19.6], title: '設計系統',
    caps: [],
    action: '「02 — 設計系統」「改一個 token，整部影片一起變。」光點落下的位置長出 design.json 卡片；右邊一整面畫面牆從失焦對焦進來。游標點開品牌色，選珊瑚色（17.35）、再選紫色（18.65）：每次從色票擴散出一圈光波，光波掃過的畫面、按鈕、星球依序換色。',
    trans: '19.9–20.4 其他東西失焦淡出，只留下卡片裡「動態」那條彈簧曲線，下一鏡從它長成整張圖。' },
  { id: 'B06', start: 20.4, end: 24.6, xf: .4, key: 22.6, stop: 22.8, slide: '全新物理動畫', thumbs: [20.8, 21.6, 23.6], title: '全新物理動畫',
    caps: [],
    action: '「03 — 物理動畫」「全新物理動畫，每個動作都自然停穩。」曲線卡片放大成全黑背景上的光線圖表。三條曲線由三顆光點畫出：表現型（青，微回彈）、標準型（白）、效果（紫，不回彈）；右邊三片玻璃方塊照各自的彈簧移動、淡入，留下殘影。22.9 起全部再彈回一次。',
    trans: '24.2–24.9 鏡頭往右平移，圖表從左邊滑出，字幕畫面從右邊滑入。' },
  { id: 'B07', start: 24.6, end: 28.4, xf: .5, key: 26.6, stop: 27.8, slide: '跟著圖層走的字幕', thumbs: [25.0, 25.8, 27.6], title: '跟著圖層走的字幕',
    caps: [],
    action: '「04 — 字幕」「字幕綁在圖層上，一起移動。」畫面預覽、時間軸、字幕管理器。游標把 S02 色塊往右拖 1 秒，字幕管理器裡的時間從 0:02.0 跟著變成 0:03.0；播放頭不在色塊裡時字幕消失，播放頭走進新位置時字幕再出現。',
    trans: '28.0–28.7 鏡頭繼續往右平移，三片玻璃卡從右邊滑入。' },
  { id: 'B08', start: 28.4, end: 33, xf: .5, key: 31.0, stop: 32.3, slide: '日常操作', thumbs: [29.2, 30.4, 32.2], title: '日常操作',
    caps: [],
    action: '「05 — 日常操作」「日常操作，也更順手。」三片玻璃卡排成一列，景深對焦依序移動：① 專案搜尋，打 lpc 只剩 lunar-pop-club，按 Enter；② 影片先播放（播放頭走過色塊，畫面元素跟著出現），再平順切到簡報；③ 介面語言 中／EN。對焦的那張清楚放大，其他兩張失焦變暗。',
    trans: '32.6–33.3 鏡頭往後拉，三張卡縮小淡出，完整的編輯器視窗從前方退入畫面。' },
  { id: 'B09', start: 33, end: 36.4, xf: .7, key: 34.8, stop: 35.4, slide: '全部，都在 Mografy Pro', thumbs: [33.4, 34.2, 35.9], title: '全部，都在 Mografy Pro',
    caps: [],
    action: '上方「全部，都在 Mografy Pro。」（Mografy Pro 為香檳銀）。一整個編輯器視窗：上方標題列有 PRO 標籤，左邊畫面預覽，右邊設計系統色票、彈簧曲線與字幕列表，下方時間軸色塊與播放頭在動。鏡頭緩推。',
    trans: '35.8 起視窗化成上千顆星點，旋轉著聚成三角座星系（35.8–37.0），呼應開場。' },
  { id: 'B10', start: 36.4, end: 42, xf: .6, key: 41.6, stop: 41.6, slide: '即將推出', thumbs: [36.8, 37.6, 38.6], title: 'Logo 與即將推出',
    caps: [],
    action: '星系捲向核心（37.0–37.65），柔和的光暈一閃，Mografy 品牌 Logo 動畫接手（白色字母、青色緞帶）。40.0「Pro Triangulum」（Pro 為香檳銀），40.3 官方標語「有些想法，值得動起來。」，40.6 底部膠囊「www.mografy.app」（只有網址，文字置中）。41.0 一道高光掃過「Pro Triangulum」。',
    trans: '停在結尾畫面到 42 秒。' },
];
// ---------- Renderer (1920 × 1080) ----------
const F = '"Inter", "Noto Sans TC", system-ui, sans-serif', M = '"JetBrains Mono", ui-monospace, monospace';
const D = { bg: '#071012', ui: 'rgba(18,28,31,.86)', raised: '#1c2a2d', line: '#2b3a3d', hair: 'rgba(255,255,255,.09)', text: '#F2F7F6', mute: '#9FB3AF', faint: '#61716E', stage: '#0c1719' };
const L = { ink: '#1B1F24', card: '#FFFFFF', muted: '#A9B4B1', hair: 'rgba(27,31,36,.07)' };
const K = { teal: '#12B5A5', glow: '#2FD3C2', deep: '#0A8A7D', mint: '#CFF1EC', yellow: '#FFD45E', coral: '#FF8C69', lilac: '#B7A6F6', sky: '#8FD3FF', violet: '#7B61E8' };
const eo = ease.outCubic;
const eio = ease.inOutCubic;
const { outQuint, inOutQuart } = ease;
const rnd = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix = (a, b, k) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(k))).toString(16).padStart(2, '0')).join(''); };
const alpha = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
const isLight = () => false;
/** Damped spring step response (mass 1): damping ratio and stiffness, time in seconds. */
function springV(t, z, k) { if (t <= 0) return 0; const w = Math.sqrt(k); if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t)); }
/** Entrance with a soft spring feel, no visible overshoot. */
const inK = (t, a, d = .6) => springV(P(t, a, a + d) * .45, .9, 200) / springV(.45, .9, 200);

function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, Math.max(0, w), Math.max(0, h), Math.max(0, Math.min(r, w / 2, h / 2))); }
function box(c, x, y, w, h, r, fill) { rr(c, x, y, w, h, r); c.fillStyle = fill; c.fill(); }
function hair(c, x, y, w, h, r, col, lw = 1.5) { rr(c, x, y, w, h, r); c.lineWidth = lw; c.strokeStyle = col; c.stroke(); }
function dot(c, x, y, r, fill) { c.beginPath(); c.arc(x, y, Math.max(0, r), 0, Math.PI * 2); c.fillStyle = fill; c.fill(); }
// dark glass panel with a light rim
function panel(c, x, y, w, h, r = 26, fill = D.ui) {
  c.save(); c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 70; c.shadowOffsetY = 28; box(c, x, y, w, h, r, fill); c.restore();
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,255,255,.16)'); g.addColorStop(.35, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(47,211,194,.10)');
  rr(c, x + .75, y + .75, w - 1.5, h - 1.5, r); c.lineWidth = 1.5; c.strokeStyle = g; c.stroke();
}
function txt(c, s, x, y, size, color, weight = 700, align = 'center', font = F, ls = 0) {
  c.font = `${weight} ${size}px ${font}`; c.letterSpacing = `${ls}px`; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, x, y); c.letterSpacing = '0px';
}
function tw(c, s, size, weight = 700, font = F, ls = 0) { c.font = `${weight} ${size}px ${font}`; c.letterSpacing = `${ls}px`; const w = c.measureText(s).width; c.letterSpacing = '0px'; return w; }
function rich(c, parts, x, y, size, weight = 800, ls = -1) {
  const ws = parts.map(([s]) => tw(c, s, size, weight, F, ls)), W = ws.reduce((m, v) => m + v, 0); let cx = x - W / 2;
  parts.forEach(([s, col], i) => { txt(c, s, cx, y, size, col, weight, 'left', F, ls); cx += ws[i]; });
}
function fade(c, k, dy, fn) { if (k <= 0) return; c.save(); c.globalAlpha *= k; c.translate(0, (1 - eo(k)) * dy); fn(); c.restore(); }
function cursor(c, x, y, click = 0) {
  if (click > 0 && click < 1) { c.save(); c.globalAlpha *= 1 - click; c.lineWidth = 3; c.strokeStyle = K.glow; c.beginPath(); c.arc(x, y, 10 + click * 36, 0, Math.PI * 2); c.stroke(); c.restore(); }
  c.save(); c.translate(x, y); const s = 1.35 * (1 - Math.sin(clamp(click * 2) * Math.PI) * .15); c.scale(s, s);
  c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 10; c.shadowOffsetY = 3;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 26); c.lineTo(7, 20); c.lineTo(12, 31); c.lineTo(17, 29); c.lineTo(12, 18); c.lineTo(21, 18); c.closePath();
  c.fillStyle = '#fff'; c.fill(); c.shadowColor = 'transparent'; c.lineWidth = 2; c.strokeStyle = L.ink; c.lineJoin = 'round'; c.stroke(); c.restore();
}
function path(t, keys) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 1; i < keys.length; i++) { const [t1, x1, y1] = keys[i]; if (t <= t1) { const [t0, x0, y0] = keys[i - 1], e = eio(P(t, t0, t1)); return [lerp(x0, x1, e), lerp(y0, y1, e)]; } }
  return keys[keys.length - 1].slice(1);
}
/** Big headline at the top of each feature shot; k fades it up and out. */
function headline(c, parts, kin, kout = 0, y = 118) { const k = kin * (1 - kout); if (k <= 0) return;
  c.save(); c.globalAlpha *= k; c.translate(0, (1 - eo(kin)) * 34 - eio(kout) * 34); rich(c, parts, 960, y, 80, 800, -1); c.restore(); }
const W0 = '#F2F7F6';

// ---- ground: deep space, cached once per canvas size ----
function paintGround(make) {
  {
    const g = make(1920, 1080); const x = g.getContext('2d');
    const lg = x.createLinearGradient(0, 0, 1920, 1080); lg.addColorStop(0, '#061214'); lg.addColorStop(.6, '#050B10'); lg.addColorStop(1, '#0A0A16');
    x.fillStyle = lg; x.fillRect(0, 0, 1920, 1080);
    for (const [cx, cy, r, col] of [[760, 420, 980, 'rgba(18,181,165,.11)'], [1500, 820, 760, 'rgba(123,97,232,.11)'], [200, 980, 600, 'rgba(18,181,165,.05)']]) {
      const n = x.createRadialGradient(cx, cy, 0, cx, cy, r); n.addColorStop(0, col); n.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = n; x.fillRect(0, 0, 1920, 1080); }
    // a faint Milky Way band from lower left to upper right, dense with tiny stars
    x.save(); x.translate(960, 540); x.rotate(-.42); x.scale(1, .16);
    const mb = x.createRadialGradient(0, 0, 0, 0, 0, 1250); mb.addColorStop(0, 'rgba(207,241,236,.07)'); mb.addColorStop(.5, 'rgba(143,140,255,.035)'); mb.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = mb; x.fillRect(-1300, -1300, 2600, 2600); x.restore();
    for (let i = 0; i < 2600; i++) { const along = (rnd(i * 2.37 + 9) - .5) * 2400, off = (rnd(i * 3.9 + 1) + rnd(i * 5.1 + 2) + rnd(i * 1.3 + 4) - 1.5) * 150, ca = Math.cos(-.42), sa = Math.sin(-.42);
      x.globalAlpha = .08 + rnd(i * 4.1 + 6) ** 2 * .45; dot(x, 960 + along * ca - off * sa, 540 + along * sa + off * ca, .4 + rnd(i * 6.3 + 3) ** 4 * 1.2, rnd(i * 8.7 + 5) > .8 ? K.mint : '#fff'); }
    for (let i = 0; i < 520; i++) { x.globalAlpha = .12 + rnd(i * 5.3) * .5; dot(x, rnd(i * 3.1) * 1920, rnd(i * 7.7 + 2) * 1080, .5 + rnd(i * 1.9) ** 3 * 1.7, rnd(i * 9.1) > .85 ? K.mint : '#fff'); }
    x.globalAlpha = .035; const im = x.createImageData(1920, 1080);
    for (let i = 0; i < im.data.length; i += 4) { const v = rnd(i * .37) * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 10; }
    x.globalAlpha = 1; const gc = make(1920, 1080); gc.getContext('2d').putImageData(im, 0, 0); x.drawImage(gc, 0, 0);
    return g;
  }
}
function ground(c, T) {
  c.drawImage(A.ground, -110 + T * 3.4, -60 + T * 1.2, 2035, 1145); // slow drift through the whole film
}

// ---- galaxy: soft additive sprites in depth layers ----
const sprite = col => A.sprites[col];
function paintSprite(col, make) {
  const s = make(64, 64); const x = s.getContext('2d'), [r, g, b] = hex(col);
  const rg = x.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, `rgba(${r},${g},${b},1)`); rg.addColorStop(.22, `rgba(${r},${g},${b},.55)`); rg.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = rg; x.fillRect(0, 0, 64, 64); return s;
}
/** o: t, mode, cx, cy, R, rot, elev, angle, a (alpha), core (0..1), halo (0..1). Stars are the Three.js layer (particles.part.js); halo and core stay 2D. */
function galaxy(c, o) {
  c.save(); c.globalCompositeOperation = 'lighter';
  const R = o.R, tilt = Math.sin(o.elev ?? .64), A = o.a ?? 1;
  if ((o.halo ?? 1) > 0) { c.save(); c.translate(o.cx, o.cy); c.rotate(o.angle ?? -.35); c.scale(1, tilt);
    const h = c.createRadialGradient(0, 0, 0, 0, 0, R * 1.05); h.addColorStop(0, `rgba(255,236,200,${.36 * A * (o.halo ?? 1)})`); h.addColorStop(.14, `rgba(255,214,150,${.13 * A * (o.halo ?? 1)})`);
    h.addColorStop(.5, `rgba(18,181,165,${.06 * A * (o.halo ?? 1)})`); h.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = h; c.beginPath(); c.arc(0, 0, R * 1.05, 0, Math.PI * 2); c.fill(); c.restore(); }
  c.restore();
  galaxyLayer(c, o);
  const core = (o.core ?? 1) * A; if (core > 0) { const r = 90 * (o.coreR ?? 1); const g = c.createRadialGradient(o.cx, o.cy, 0, o.cx, o.cy, r);
    g.addColorStop(0, `rgba(255,255,255,${.9 * core})`); g.addColorStop(.3, `rgba(255,233,190,${.5 * core})`); g.addColorStop(1, 'rgba(255,212,94,0)');
    c.save(); c.globalCompositeOperation = 'lighter'; c.translate(o.cx, o.cy); c.rotate(o.angle ?? -.35); c.scale(1, tilt + .02); c.translate(-o.cx, -o.cy); c.fillStyle = g; c.beginPath(); c.arc(o.cx, o.cy, r, 0, Math.PI * 2); c.fill(); c.restore(); }
}

// ---- shared timeline pieces ----
/** A solid: enter ramp, hold, exit ramp (ramps keep their width; a short solid squeezes both). */
function solid(c, x0, x1, y, h, col, en, ex, glow = 1) {
  const w = Math.max(1, x1 - x0), q = Math.min(1, w / (en + ex)), a = en * q / w, b = 1 - ex * q / w;
  const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, alpha(col, .25)); g.addColorStop(a, col); g.addColorStop(b, col); g.addColorStop(1, alpha(col, .25));
  c.save(); if (glow) { c.shadowColor = alpha(col, .55 * glow); c.shadowBlur = 18; } box(c, x0, y, w, h, Math.min(9, h / 2), g); c.restore();
  c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(x0 + a * w - 1, y + 6, 2, h - 12); c.fillRect(x0 + b * w - 1, y + 6, 2, h - 12);
  return { a: x0 + a * w, b: x0 + b * w };
}
function playhead(c, x, top, h, col = W0) {
  c.save(); c.shadowColor = alpha(K.glow, .6); c.shadowBlur = 12; box(c, x - 1.5, top, 3, h, 1.5, col);
  c.beginPath(); c.moveTo(x - 9, top - 10); c.lineTo(x + 9, top - 10); c.lineTo(x + 9, top - 1); c.lineTo(x, top + 7); c.lineTo(x - 9, top - 1); c.closePath(); c.fillStyle = col; c.fill(); c.restore();
}
function eye(c, x, y, col = D.mute) {
  c.save(); c.strokeStyle = col; c.lineWidth = 2.2; c.beginPath(); c.moveTo(x - 11, y); c.quadraticCurveTo(x, y - 10, x + 11, y); c.quadraticCurveTo(x, y + 10, x - 11, y); c.stroke(); dot(c, x, y, 3.2, col); c.restore();
}
function chip(c, s, x, y, col, size = 20, font = F, wt = 600) { const w = tw(c, s, size, wt, font) + size * 1.3, h = size * 1.75;
  box(c, x - w / 2, y - h / 2, w, h, h / 2, alpha(col, .16)); hair(c, x - w / 2, y - h / 2, w, h, h / 2, alpha(col, .5), 1.2); txt(c, s, x, y + 1, size, col, wt, 'center', font); return w; }


const SECS = 6;

const LAY = [
  { name: '星球', in: .4, out: 5.0, col: K.coral, en: .7, ex: .55 },
  { name: '標題', in: .9, out: 5.4, col: K.glow, en: .7, ex: .5 },
  { name: '卡片', in: 1.5, out: 5.6, col: K.lilac, en: .75, ex: .6 },
  { name: '字幕', in: 2.1, out: 5.3, col: K.yellow, en: .65, ex: .45 },
];
const drag2 = t => eio(P(t, 5.9, 7.0));
const lay2 = (t, i) => i === 0 ? { ...LAY[0], out: lerp(3.6, 5.5, drag2(t)) } : LAY[i];
function stageFrame(c, R) {
  const g = c.createLinearGradient(R.x, R.y, R.x + R.w, R.y + R.h); g.addColorStop(0, '#0E1C1E'); g.addColorStop(1, '#141A2B'); box(c, R.x, R.y, R.w, R.h, 18, g);
  const a0 = c.globalAlpha; c.save(); rr(c, R.x, R.y, R.w, R.h, 18); c.clip(); for (let i = 0; i < 60; i++) { c.globalAlpha = a0 * (.15 + rnd(i * 3.3) * .35); dot(c, R.x + rnd(i * 1.1) * R.w, R.y + rnd(i * 2.2) * R.h, .8 + rnd(i) * 1.2, '#fff'); } c.restore();
}
function planet(c, x, y, r, col, k = 1) {
  c.save(); c.globalAlpha *= clamp(k);
  const h = c.createRadialGradient(x, y, r * .6, x, y, r * 2.1); h.addColorStop(0, alpha(col, .35)); h.addColorStop(1, alpha(col, 0)); c.fillStyle = h; c.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
  const g = c.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r); g.addColorStop(0, mix(col, '#ffffff', .55)); g.addColorStop(.55, col); g.addColorStop(1, mix(col, '#000000', .45)); dot(c, x, y, r, g);
  c.save(); c.translate(x, y); c.rotate(-.35); c.scale(1, .26); c.strokeStyle = alpha(mix(col, '#ffffff', .5), .8); c.lineWidth = 9; c.beginPath(); c.arc(0, 0, r * 1.55, Math.PI * 1.02, Math.PI * 1.98, true); c.stroke(); c.restore();
  c.restore();
}

function springCurve(c, R, col, z, k, span, prog = 1, lw = 4) {
  c.beginPath(); c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = col;
  const base = R.y + R.h * .82, unit = R.h * .62;
  for (let i = 0; i <= 90; i++) { const u = i / 90 * prog, x = R.x + R.w * .06 + u * R.w * .88, y = base - springV(u * span, z, k) * unit; i ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.stroke();
}

const CURVES = [
  { col: K.glow, z: .6, k: 800, label: '空間 · 表現型', tag: '可微微回彈' },
  { col: W0, z: .9, k: 1400, label: '空間 · 標準型', tag: '俐落、不晃' },
  { col: K.lilac, z: 1, k: 1600, label: '效果', tag: '透明度、顏色，不回彈' },
];

// ---- S05 ----
const ST5 = { x: 160, y: 196, w: 860, h: 484 }, TL5 = { x: 160, y: 704, w: 860, h: 216 }, INS = { x: 1080, y: 196, w: 680, h: 724 };
const SUBS = [['S01', 'Mografy Pro 27 Triangulum', K.glow, .2, 1.6], ['S02', '每一句字幕，都跟著圖層走。', K.coral, 2.0, 3.2], ['S03', '改一個 token，全部更新。', K.lilac, 2.6, 4.2], ['S04', '即將推出。', K.yellow, 3.8, 5.6]];
const shift5 = t => eio(P(t, 17.0, 18.2));
function subs5(c, t) {
  const out = eio(P(t, 19.35, 19.8)), a = inK(t, 16.0, .7), ph = lerp(2.2, 3.6, P(t, 18.25, 19.6));
  const sub2 = clamp((ph - SUBS[1][3] - shift5(t)) / .12) * clamp((SUBS[1][4] + shift5(t) - ph) / .12);
  c.save();
  // stage
  panel(c, ST5.x, ST5.y, ST5.w, ST5.h); const S = { x: ST5.x + 18, y: ST5.y + 18, w: ST5.w - 36, h: ST5.h - 36 }; stageFrame(c, S);
  planet(c, S.x + S.w * .5, S.y + 170 + Math.sin((t - 16) * 1.7) * 7, 78, K.coral);
  const line = SUBS[1][1], w = tw(c, line, 32, 600) + 64; if (sub2 > 0) { c.save(); c.globalAlpha *= sub2; c.translate(0, (1 - eo(sub2)) * 14); box(c, 590 - w / 2, 560, w, 64, 32, 'rgba(0,0,0,.6)'); txt(c, line, 590, 593, 32, W0, 600); c.restore(); }
  // timeline
  panel(c, TL5.x, TL5.y, TL5.w, TL5.h); const X0 = 300, XW = 680, sx = s => X0 + s / SECS * XW;
  SUBS.forEach(([id, , col, a0, b0], i) => { const y = 726 + i * 46, d = i === 1 ? shift5(t) : 0;
    txt(c, id, 196, y + 16, 20, i === 1 ? W0 : D.mute, 600, 'left', M); box(c, X0, y + 14, XW, 4, 2, 'rgba(255,255,255,.06)');
    const s0 = sx(a0 + d), s1 = sx(b0 + d); solid(c, s0, s1, y, 32, col, 26, 20, i === 1 ? 1 : .4);
    if (i === 1) hair(c, s0 - 4, y - 4, s1 - s0 + 8, 40, 12, alpha(K.coral, .9), 2); });
  playhead(c, sx(ph), 718, 196);
  // inspector
  panel(c, INS.x, INS.y, INS.w, INS.h);
  txt(c, '字幕', 1124, 252, 32, W0, 800, 'left'); chip(c, '目前畫面', 1660, 252, K.glow, 18);
  box(c, 1120, 296, 600, 56, 28, 'rgba(255,255,255,.06)'); c.strokeStyle = D.mute; c.lineWidth = 2.5; c.beginPath(); c.arc(1152, 323, 9, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(1159, 330); c.lineTo(1167, 338); c.stroke();
  txt(c, '搜尋字幕', 1180, 325, 22, D.faint, 500, 'left');
  let y = 380; const rowY = [];
  SUBS.forEach(([id, s, col, a0], i) => { const open = i === 1, h = open ? 196 : 76; rowY.push(y + 38);
    box(c, 1120, y, 600, h - 12, 16, open ? 'rgba(255,140,105,.08)' : 'rgba(255,255,255,.03)'); if (open) hair(c, 1120, y, 600, h - 12, 16, alpha(K.coral, .6), 2);
    c.save(); c.translate(1146, y + 32); c.rotate(open ? Math.PI / 2 : 0); c.strokeStyle = D.mute; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-3, -6); c.lineTo(3, 0); c.lineTo(-3, 6); c.stroke(); c.restore();
    txt(c, id, 1170, y + 33, 22, open ? K.coral : D.mute, 600, 'left', M); dot(c, 1236, y + 32, 7, col);
    const tm = a0 + (i === 1 ? shift5(t) : 0); txt(c, `0:${tm.toFixed(1).padStart(4, '0')}`, 1700, y + 33, 22, open && shift5(t) > 0 && shift5(t) < 1 ? K.coral : D.mute, 500, 'right', M);
    if (!open) txt(c, s, 1256, y + 33, 22, D.text, 500, 'left');
    else { box(c, 1146, y + 66, 548, 96, 14, 'rgba(0,0,0,.35)'); hair(c, 1146, y + 66, 548, 96, 14, 'rgba(255,255,255,.12)'); txt(c, s, 1170, y + 114, 28, W0, 600, 'left');
      if (Math.sin(t * 9) > 0) box(c, 1172 + tw(c, s, 28, 600), y + 96, 3, 36, 1.5, K.glow); }
    y += h; });
  // link from S02 solid to its row
  const sx1 = sx(SUBS[1][4] + shift5(t)) + 6, sy1 = 726 + 46 + 16;
  c.save(); c.setLineDash([6, 8]); c.lineWidth = 2.2; c.strokeStyle = alpha(K.coral, .8); c.beginPath(); c.moveTo(sx1, sy1); c.bezierCurveTo(1060, sy1, 1050, rowY[1], 1120, rowY[1]); c.stroke(); c.restore();
  c.restore();
  if (t > 16.4 && t < 18.9) { const s0 = sx(SUBS[1][3] + shift5(t)), cx = s0 + 80, cy = 726 + 46 + 18;
    const [x, y2] = t < 17.0 ? path(t, [[16.4, 700, 600], [16.95, sx(SUBS[1][3]) + 80, cy]]) : [cx, cy];
    c.save(); c.globalAlpha *= P(t, 16.4, 16.6) * (1 - P(t, 18.5, 18.9)); cursor(c, x, y2, P(t, 16.95, 17.3)); c.restore(); }
}


// ---- S06 ----
const CARDS6 = [160, 720, 1280].map(x => ({ x, y: 216, w: 480, h: 600 }));
const BEAT = [19.9, 21.4, 22.9];
const focus6 = (t, i) => i === 2 ? P(t, BEAT[2] - .2, BEAT[2] + .2) : P(t, BEAT[i] - .2, BEAT[i] + .2) * (1 - P(t, BEAT[i + 1] - .2, BEAT[i + 1] + .2));
const LABEL6 = [['專案搜尋', '輸入 lpc，直接開啟'], ['影片／簡報', '同一個專案，兩種播放方式'], ['介面語言', '繁體中文與 English']];
const PROJ = [['lunar-pop-club', K.lilac], ['qlite-promo', K.teal], ['duopurse', K.coral], ['mografy-story', '#8FA3A0'], ['superhunter', K.yellow], ['etf-ipo', K.sky]];
const fuzzy = (name, q) => { let at = 0; const hits = []; for (const ch of q) { const f = name.indexOf(ch, at); if (f < 0) return null; hits.push(f); at = f + 1; } return hits; };
function switch2(c, x, y, w, k, a, b, ra, rb) { box(c, x, y, w, 60, 30, 'rgba(255,255,255,.06)'); const th = x + 4 + (w / 2 - 4) * k;
  c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 12; box(c, th, y + 4, w / 2 - 4, 52, 26, '#2c4245'); c.restore(); hair(c, th, y + 4, w / 2 - 4, 52, 26, 'rgba(207,241,236,.16)', 1.2);
  ra(x + w / 4 + 2, y + 30, k < .5 ? W0 : D.faint); rb(x + w * 3 / 4 - 2, y + 30, k >= .5 ? W0 : D.faint); }

function tileBody(c, i, R, t) {
    const L0 = R.x + 32, Wd = R.w - 64;
    if (i === 0) { const n = t < 20.1 ? 0 : Math.min(3, 1 + Math.floor((t - 20.1) / .3)), q = 'lpc'.slice(0, n), qb = 'lpc'.slice(0, Math.max(0, n - 1)), since = n ? P(t, 20.1 + (n - 1) * .3, 20.1 + (n - 1) * .3 + .3) : 1;
      box(c, L0, R.y + 40, Wd, 64, 32, 'rgba(255,255,255,.06)'); hair(c, L0, R.y + 40, Wd, 64, 32, n ? alpha(K.glow, .8) : 'rgba(255,255,255,.12)', 2);
      c.strokeStyle = n ? K.glow : D.mute; c.lineWidth = 2.5; c.beginPath(); c.arc(L0 + 34, R.y + 70, 10, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(L0 + 41, R.y + 77); c.lineTo(L0 + 50, R.y + 86); c.stroke();
      txt(c, q, L0 + 64, R.y + 73, 28, W0, 600, 'left', M); if (Math.sin(t * 8) > 0 && t < 21.2) box(c, L0 + 66 + tw(c, q, 28, 600, M), R.y + 56, 3, 34, 1.5, K.glow);
      let y = R.y + 128;
      PROJ.forEach(([name, col]) => { const was = fuzzy(name, qb) ? 1 : 0, now = fuzzy(name, q) ? 1 : 0, v = lerp(was, now, eo(since)), h = 70 * v; if (v < .02) { y += h; return; }
        c.save(); c.globalAlpha *= v; c.beginPath(); c.rect(L0 - 8, y, Wd + 16, h); c.clip(); const top = n > 0 && name === 'lunar-pop-club';
        if (top) box(c, L0 - 6, y + 6, Wd + 12, 58, 14, `rgba(47,211,194,${.14 + .2 * Math.exp(-(((t - 21.0) / .12) ** 2))})`);
        box(c, L0 + 10, y + 17, 52, 36, 9, col); const hits = fuzzy(name, q) || []; let x = L0 + 80; c.font = `600 24px ${M}`;
        [...name].forEach((ch, k) => { const on = hits.includes(k); txt(c, ch, x, y + 36, 24, on ? K.glow : top ? W0 : D.mute, 600, 'left', M); if (on) box(c, x, y + 52, tw(c, ch, 24, 600, M), 3, 1.5, K.glow); x += tw(c, ch, 24, 600, M); });
        if (top) txt(c, '↵', L0 + Wd - 6, y + 36, 24, K.glow, 600, 'right', M); c.restore(); y += h; });
    }
    if (i === 1) { const m = eio(P(t, 22.0, 22.6));   // the video plays first, then one smooth switch
      switch2(c, L0, R.y + 40, Wd, m, '', '', (x0, y, col) => { const x = x0 - (48 + tw(c, '影片', 22, 600)) / 2 + 18;   // icon + label centred as one group
          c.strokeStyle = col; c.lineWidth = 2.4; rr(c, x - 18, y - 13, 36, 26, 6); c.stroke(); c.beginPath(); c.moveTo(x - 4, y - 7); c.lineTo(x - 4, y + 7); c.lineTo(x + 7, y); c.closePath(); c.fillStyle = col; c.fill(); txt(c, '影片', x + 30, y + 1, 22, col, 600, 'left'); },
        (x0, y, col) => { const x = x0 - (48 + tw(c, '簡報', 22, 600)) / 2 + 18;
          c.strokeStyle = col; c.lineWidth = 2.4; rr(c, x - 18, y - 14, 36, 22, 4); c.stroke(); c.beginPath(); c.moveTo(x, y + 8); c.lineTo(x, y + 14); c.moveTo(x - 7, y + 15); c.lineTo(x + 7, y + 15); c.stroke(); txt(c, '簡報', x + 30, y + 1, 22, col, 600, 'left'); });
      const E = { x: L0, y: R.y + 128, w: Wd, h: 440 }; box(c, E.x, E.y, E.w, E.h, 16, 'rgba(255,255,255,.04)');
      const sX = lerp(E.x + 16, E.x + 112, m), sW = lerp(E.w - 32, E.w - 128, m), sH = sW * 9 / 16, sY = lerp(E.y + 16, E.y + 24, m);
      // video mode plays: the playhead runs across the solids and each element shows while the playhead is inside its solid
      const S2 = k => [E.x + 16 + k * 40, E.x + 300 + k * 30], ph = E.x + 16 + (E.w - 32) * (.06 + .66 * P(t, 19.6, 22.3));
      const on = k => { const [a, b] = S2(k); return lerp(clamp((ph - a) / 26) * clamp((b - ph) / 26), 1, m); };
      stageFrame(c, { x: sX, y: sY, w: sW, h: sH }); planet(c, sX + sW * .7, sY + sH * .5 + Math.sin(t * 1.8) * 3, sH * .2 * (.7 + .3 * eo(on(0))), K.coral, on(0));
      fade(c, on(1), 10, () => box(c, sX + 18, sY + 24, sW * .38, 12, 6, W0)); fade(c, on(2), 10, () => box(c, sX + 18, sY + 46, sW * .24, 8, 4, 'rgba(255,255,255,.4)'));
      fade(c, on(3) * (1 - m), 8, () => { box(c, sX + sW / 2 - 70, sY + sH - 30, 140, 20, 10, 'rgba(0,0,0,.45)'); box(c, sX + sW / 2 - 52, sY + sH - 22, 104, 4, 2, 'rgba(255,255,255,.6)'); });
      c.save(); c.globalAlpha *= 1 - eo(P(m, 0, .6)); c.translate(0, m * 40); [K.coral, K.glow, K.lilac, K.yellow].forEach((col, k) => { const y = sY + sH + 30 + k * 38; box(c, E.x + 16, y + 12, E.w - 32, 3, 1.5, 'rgba(255,255,255,.07)'); solid(c, S2(k)[0], S2(k)[1], y, 26, col, 26, 20, .4); });
      playhead(c, ph, sY + sH + 22, 150); c.restore();
      // present mode: a slide list that fills the column, page dots, the start button and speaker notes, easing in as the timeline leaves
      const pk = eo(P(m, .35, 1));
      c.save(); c.globalAlpha *= pk; const SH = (E.h - 32) / 6;
      for (let k = 0; k < 6; k++) { const y = E.y + 16 + k * SH, dx = (1 - pk) * (24 + k * 8); box(c, E.x + 14 - dx, y, 82, SH - 12, 8, k === 1 ? '#1d3134' : 'rgba(255,255,255,.07)');
        if (k === 1) hair(c, E.x + 12 - dx, y - 2, 86, SH - 8, 10, K.glow, 2); else box(c, E.x + 24 - dx, y + 12, 40, 5, 2.5, 'rgba(255,255,255,.12)'); }
      c.translate(0, (1 - pk) * 18);
      for (let k = 0; k < 5; k++) dot(c, sX + sW / 2 - 36 + k * 18, sY + sH + 28, k === 1 ? 6 : 4, k === 1 ? K.glow : D.faint);
      box(c, sX + sW / 2 - 80, sY + sH + 56, 160, 52, 26, K.teal); txt(c, '開始簡報', sX + sW / 2, sY + sH + 83, 22, '#fff', 700);
      const NY = sY + sH + 132; box(c, sX, NY, sW, E.y + E.h - 16 - NY, 12, 'rgba(255,255,255,.05)'); txt(c, '講者備註', sX + 18, NY + 26, 17, D.faint, 600, 'left');
      box(c, sX + 18, NY + 50, sW * .72, 7, 3.5, 'rgba(255,255,255,.14)'); box(c, sX + 18, NY + 68, sW * .5, 7, 3.5, 'rgba(255,255,255,.1)'); c.restore();
    }
    if (i === 2) { const g = eio(P(t, 23.4, 24.0));
      switch2(c, L0, R.y + 40, Wd, g, '', '', (x, y, col) => txt(c, '中', x, y + 1, 26, col, 700), (x, y, col) => txt(c, 'EN', x, y + 1, 24, col, 700));
      const E = { x: L0, y: R.y + 128, w: Wd, h: 440 }; box(c, E.x, E.y, E.w, E.h, 16, 'rgba(255,255,255,.04)');
      c.save(); c.globalAlpha *= clamp(1 - g * 2); txt(c, '設計系統', E.x + 28, E.y + 64 - g * 12, 46, W0, 800, 'left'); c.restore();
      c.save(); c.globalAlpha *= clamp(g * 2 - 1); txt(c, 'Design system', E.x + 28, E.y + 76 - g * 12, 42, W0, 700, 'left'); c.restore();
      let x = E.x + 28; [['色彩', 'Colour'], ['字體', 'Type'], ['動態', 'Motion']].forEach(([zh, en], k) => { const s = g < .5 ? zh : en, w = tw(c, s, 22, 600);
        txt(c, s, x, E.y + 132, 22, k === 0 ? W0 : D.mute, 600, 'left'); if (!k) box(c, x, E.y + 152, w, 3, 1.5, K.glow); x += lerp(tw(c, zh, 22, 600), tw(c, en, 22, 600), g) + 34; });
      c.fillStyle = D.hair; c.fillRect(E.x + 28, E.y + 156, E.w - 56, 1.5);
      [['品牌色', 'Brand colour'], ['彈簧速度', 'Spring speed'], ['表現型', 'Expressive'], ['安全區', 'Safe area']].forEach(([zh, en], k) => { const y = E.y + 180 + k * 62;
        box(c, E.x + 20, y, E.w - 40, 50, 12, 'rgba(255,255,255,.05)'); c.save(); c.globalAlpha *= clamp(1 - g * 2) + clamp(g * 2 - 1); txt(c, g < .5 ? zh : en, E.x + 40, y + 26, 22, D.text, 500, 'left'); c.restore();
        if (k === 0) dot(c, E.x + E.w - 50, y + 25, 12, K.teal); if (k === 2) { box(c, E.x + E.w - 92, y + 13, 56, 26, 13, K.teal); dot(c, E.x + E.w - 50, y + 26, 9, '#fff'); }
        if (k === 1) txt(c, 'default', E.x + E.w - 36, y + 26, 18, D.faint, 500, 'right', M); if (k === 3) txt(c, '90%', E.x + E.w - 36, y + 26, 18, D.faint, 500, 'right', M); });
    }
}

// ---------- v3 look: champagne for Pro, glass, mask-reveal type, light trails, depth of field ----------
const CH = '#E6D6B0';
function metal(c, x0, x1) { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#FBF7EE'); g.addColorStop(.4, '#E6D6B0'); g.addColorStop(.62, '#FFFFFF'); g.addColorStop(1, '#BCA77C'); return g; }
function glass(c, x, y, w, h, r = 28) {
  panel(c, x, y, w, h, r, 'rgba(12,20,22,.8)');
  const g = c.createLinearGradient(0, y, 0, y + h * .5); g.addColorStop(0, 'rgba(255,255,255,.055)'); g.addColorStop(1, 'rgba(255,255,255,0)'); box(c, x + 1, y + 1, w - 2, h * .5, r, g);
}
function richL(c, parts, x, y, size, weight = 700, ls = -1) { let cx = x; parts.forEach(([s, col]) => { txt(c, s, cx, y, size, col, weight, 'left', F, ls); cx += tw(c, s, size, weight, F, ls); }); return cx - x; }
/** Section kicker: number, a short rule, label. */
function kicker(c, n, s, x, y, k) {
  if (k <= 0) return; c.save(); c.globalAlpha *= clamp(k); txt(c, n, x, y, 22, K.glow, 600, 'left', M, 2); const w = tw(c, n, 22, 600, M, 2);
  c.fillStyle = alpha(K.glow, .6); c.fillRect(x + w + 14, y - 1, 40 * eo(clamp(k)), 1.5); txt(c, s, x + w + 70, y + 1, 22, D.mute, 500, 'left', F, 4); c.restore();
}
/** Title lines rise out of a baseline mask at `a` and leave upward into it at `b`. */
function title(c, lines, x, y, t, a, b, size = 64, lh = 84, weight = 700) {
  lines.forEach((parts, i) => {
    const u = outQuint(P(t, a + i * .1, a + i * .1 + .8)), v = eio(P(t, b + i * .06, b + i * .06 + .5)); if (u <= 0 || v >= 1) return;
    const yy = y + i * lh; c.save(); c.beginPath(); c.rect(x - 20, yy - size * .8, 1500, size * 1.55); c.clip(); c.globalAlpha *= clamp(u * 1.5);
    c.translate(0, (1 - u) * size * 1.1 - v * size * 1.1); richL(c, parts, x, yy, size, weight, -1); c.restore();
  });
}
const bz = (p0, p1, p2, p3) => v => { const w = 1 - v; return [0, 1].map(k => w ** 3 * p0[k] + 3 * w * w * v * p1[k] + 3 * w * v * v * p2[k] + v ** 3 * p3[k]); };
/** A comet of light along f(0..1): head at u, a tapering trail of length len (in u). */
function comet(c, f, u, len, col = '#CFF1EC', w = 3, a = 1) {
  if (a <= .002) return; c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.strokeStyle = col;
  const N = 40, u0 = u - len; let [px, py] = f(clamp(u0));
  for (let i = 1; i <= N; i++) { const v = clamp(u0 + len * i / N), [x, y] = f(v), k = i / N; c.globalAlpha = a * k * k * .9; c.lineWidth = w * (.25 + .75 * k);
    c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke(); px = x; py = y; }
  const [hx, hy] = f(clamp(u)), s = w * 16; c.globalAlpha = a; c.drawImage(sprite('#CFF1EC'), hx - s / 2, hy - s / 2, s, s); c.drawImage(sprite('#FFFFFF'), hx - s / 5, hy - s / 5, s / 2.5, s / 2.5);
  c.restore();
}
/**
 * Draw fn(ctx) out of focus by `px` film pixels: the runtime's blurLayer draws the content once into a pooled layer
 * (at reduced resolution when the blur is strong) and blurs that layer in one pass. Never set a filter on the frame
 * around many draws; the browser would blur every fill and glyph separately. Nested blurs get their own layer.
 */
let blurDepth = 0;
function blurred(c, px, fn) {
  if (px <= .05) { fn(c); return; }
  blurLayer(c, `dof${blurDepth}`, px, x => { blurDepth++; try { fn(x); } finally { blurDepth--; } }, { frameUnits: true });
}

/** Camera: zoom z about the frame centre while moving the focus point (fx, fy) toward it by k. */
function zoomTo(c, fx, fy, z, k) { c.translate(960, 540); c.scale(z, z); c.translate(-lerp(960, fx, k), -lerp(540, fy, k)); }
/** Specular band crossing text: draw the same text again with a moving transparent-white-transparent gradient. */
function sweepFill(c, x0, x1, u, wBand = 160) {
  const cx = lerp(x0 - wBand * 2, x1 + wBand * 2, u), g = c.createLinearGradient(cx - wBand, 0, cx + wBand, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); return g;
}

// ---------- B01: a spark ignites and blooms into the galaxy ----------
const GAL3 = { x: 1380, y: 430 }, IGN = [300, 780];
const path01 = bz(IGN, [760, 1020], [980, 160], [GAL3.x, GAL3.y]);
const galRot = t => t * .05, galE = t => .56 + .12 * eio(P(t, 2.4, 8.4)), galR = t => 470 + Math.max(0, t - 3.6) * 12;
function b01(c, t) {
  const ign = eo(P(t, .3, 1.0)), fly = eio(P(t, 1.0, 2.7));
  if (t < 2.95) {
    if (fly <= 0) { c.save(); c.globalCompositeOperation = 'lighter'; const s = (60 + 26 * Math.sin(t * 6)) * ign; c.globalAlpha = ign;
      c.drawImage(sprite('#CFF1EC'), IGN[0] - s, IGN[1] - s, s * 2, s * 2); c.drawImage(sprite('#FFFFFF'), IGN[0] - s / 3, IGN[1] - s / 3, s / 1.5, s / 1.5); c.restore(); }
    else comet(c, path01, fly, .42, '#CFF1EC', 4, 1 - P(t, 2.65, 2.95));
  }
  if (t > 2.5 && t < 3.6) galaxy(c, { t, mode: 1, cx: GAL3.x, cy: GAL3.y, R: galR(t), rot: galRot(t), elev: galE(t), a: 1, core: P(t, 2.55, 3.0), halo: P(t, 2.6, 3.5) });
  const fl = Math.exp(-(((t - 2.7) / .18) ** 2)); if (fl > .01) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = fl * .8; c.drawImage(sprite('#FFFFFF'), GAL3.x - 160, GAL3.y - 160, 320, 320); c.restore(); }
}

// ---------- B02: the name; the galaxy straightens into four tracks ----------
const TL3 = { x: 160, y: 650, w: 1600, h: 300 }, TRY3 = [722, 778, 834, 890], TRH3 = 36, X03 = 420, XW3 = 1290;
const tx3 = s => X03 + s / SECS * XW3;
function b02(c, t) {
  galaxy(c, { t, mode: 2, cx: GAL3.x, cy: GAL3.y, R: galR(t), rot: galRot(t), elev: galE(t), a: 1 - P(t, 8.2, 8.5), core: 1 - P(t, 7.2, 7.8), halo: 1 - P(t, 7.2, 7.9) });
  const out = eio(P(t, 7.2, 7.8)); if (out >= 1) return;
  c.save(); c.globalAlpha *= 1 - out; c.translate(0, -out * 50);
  // MOGRAFY PRO, champagne silver
  const k0 = P(t, 3.9, 4.6); if (k0 > 0) { c.save(); c.globalAlpha *= k0; const s = 'MOGRAFY PRO', W = tw(c, s, 30, 600, F, lerp(30, 14, eo(k0)));
    txt(c, s, 160, 404, 30, metal(c, 160, 160 + W), 600, 'left', F, lerp(30, 14, eo(k0))); c.restore(); }
  // Triangulum rises letter by letter from a mask, then a highlight crosses it
  const word = 'Triangulum', size = 150, ls = -4, W = tw(c, word, size, 600, F, ls); let x = 152;
  const g = c.createLinearGradient(152, 440, 152 + W, 600); g.addColorStop(0, '#FFFFFF'); g.addColorStop(.6, '#E8FBF7'); g.addColorStop(1, '#9EEBDF');
  const sw = P(t, 5.6, 6.6), band = sw > 0 && sw < 1 ? sweepFill(c, 152, 152 + W, sw) : null;
  [...word].forEach((ch, i) => { const k = outQuint(P(t, 4.2 + i * .06, 4.95 + i * .06)), cw = tw(c, ch, size, 600, F) + ls;
    if (k > 0) { c.save(); c.beginPath(); c.rect(x - 20, 420, cw + 40, 200); c.clip(); c.globalAlpha *= clamp(k * 1.4); txt(c, ch, x, 520 + (1 - k) * 90, size, g, 600, 'left', F);
      if (band) { c.globalCompositeOperation = 'lighter'; c.globalAlpha *= .55; txt(c, ch, x, 520, size, band, 600, 'left', F); } c.restore(); }
    x += cw; });
  const k2 = P(t, 5.0, 5.6); if (k2 > 0) { c.save(); c.globalAlpha *= k2; c.fillStyle = CH; c.fillRect(162, 648, 48 * eo(k2), 1.5); txt(c, '付費版本 · 即將推出', 232, 650, 32, D.mute, 500, 'left', F, 6); c.restore(); }
  c.restore();
}

// ---------- B03 + B04: the timeline (one camera that pushes in for the close-up) ----------
const STG3 = { x: 900, y: 128, w: 860, h: 484 };
const pt3 = t => { const u = P(t, 8.4, 16.2); return 5 * (u < .1 ? 5 * u * u : u - .05) / .95; };
const drag3 = t => eio(P(t, 13.3, 14.5));
const lay3 = (t, i) => i === 0 ? { ...LAY[0], out: lerp(3.6, 5.5, drag3(t)) } : LAY[i];
const F4 = [tx3(4.55), TRY3[0] + TRH3 / 2];
function editor3(c, t, zk) {
  const pt = pt3(t);
  // stage preview (falls out of focus during the close-up)
  blurred(c, 7 * zk, c => { const k = inK(t, 8.4, .8); c.save(); c.globalAlpha *= k; c.translate(0, (1 - k) * 40);
    glass(c, STG3.x - 16, STG3.y - 16, STG3.w + 32, STG3.h + 32, 30); stageFrame(c, STG3);
    const pr = i => { const l = lay3(t, i); return clamp((pt - l.in) / l.en) * clamp((l.out - pt) / l.ex); }, X = STG3.x, Y = STG3.y;
    const p0 = pr(0); if (p0 > 0) { const s = springV(p0 * .5, .62, 160) / springV(.5, .62, 160); planet(c, X + 628, Y + 176 + Math.sin(t * 1.6) * 6, 92 * s, K.coral, p0 * 2); }
    const p1 = eo(pr(1)); fade(c, p1, 30, () => { txt(c, '全新編輯器', X + 56, Y + 122, 70, W0, 800, 'left'); txt(c, 'Mografy Pro Triangulum', X + 60, Y + 188, 28, K.glow, 600, 'left', F, 2); });
    const p2 = eo(pr(2)); if (p2 > 0) { for (let k2 = 3; k2 >= 0; k2--) { const sp = k2 * 9 * (1 - p2); c.save(); c.globalAlpha *= p2 * (k2 ? .16 : 1);
        box(c, X + 56 - sp, Y + 240 - sp, 330 + sp * 2, 120 + sp * 2, 18 + sp, 'rgba(183,166,246,.22)'); c.restore(); }
      c.save(); c.globalAlpha *= p2; hair(c, X + 56, Y + 240, 330, 120, 18, alpha(K.lilac, .55)); txt(c, '進場 · 停留 · 退場', X + 80, Y + 280, 28, W0, 700, 'left'); txt(c, 'enter / hold / exit', X + 82, Y + 324, 20, K.lilac, 500, 'left', M); c.restore(); }
    const p3 = eio(pr(3)); if (p3 > 0) { const s = '每個圖層，都能直接編排。', w = tw(c, s, 28, 600) + 56, cx = X + 430; c.save(); c.beginPath(); c.rect(cx - w / 2, Y + 384, w * p3, 56); c.clip();
      box(c, cx - w / 2, Y + 386, w, 50, 25, 'rgba(0,0,0,.55)'); txt(c, s, cx, Y + 412, 28, W0, 600); c.restore(); }
    c.restore(); });
  // timeline
  const kp = P(t, 8.2, 8.7); c.save(); c.globalAlpha *= kp;
  glass(c, TL3.x, TL3.y, TL3.w, TL3.h, 26);
  for (let s = 0; s <= SECS * 4; s++) { const x = X03 + s / (SECS * 4) * XW3; c.fillStyle = s % 4 ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.35)'; c.fillRect(x, 676, 1.5, s % 4 ? 6 : 12);
    if (!(s % 4)) { c.save(); c.globalAlpha *= 1 - zk; txt(c, `${s / 4}s`, x + 6, 684, 16, D.faint, 500, 'left', M); c.restore(); } }
  c.restore();
  LAY.forEach((_, i) => { const l = lay3(t, i), y = TRY3[i];
    c.save(); c.globalAlpha *= kp; eye(c, 200, y + TRH3 / 2); dot(c, 238, y + TRH3 / 2, 7, l.col); txt(c, l.name, 258, y + TRH3 / 2 + 1, 24, i === 0 ? W0 : D.mute, 600, 'left');
    box(c, X03, y + TRH3 / 2 - 2, XW3, 4, 2, 'rgba(255,255,255,.06)'); c.restore();
    // each solid is drawn out by a comet of light
    const gi = P(t, 8.3 + i * .16, 9.1 + i * .16), x0 = tx3(l.in), x1 = tx3(l.out), xe = lerp(x0, x1, eo(gi)); if (gi <= 0) return;
    c.save(); c.beginPath(); c.rect(0, y - 20, xe, TRH3 + 40); c.clip(); const seg = solid(c, x0, x1, y, TRH3, l.col, l.en / SECS * XW3, l.ex / SECS * XW3, 1); c.restore();
    if (gi < 1) comet(c, v => [lerp(x0 - 200, xe, v), y + TRH3 / 2], 1, .5, '#FFFFFF', 3, 1 - P(gi, .8, 1));
    if (i === 0) { const lab = P(t, 12.9, 13.3); if (lab > 0) { c.save(); c.globalAlpha *= lab;
      [['進場', x0, seg.a], ['停留', seg.a, seg.b], ['退場', seg.b, x1]].forEach(([s, a, b], k) => {
        c.strokeStyle = k === 1 ? K.coral : D.mute; c.lineWidth = 2; c.beginPath(); c.moveTo(a + 3, y - 6); c.lineTo(a + 3, y - 14); c.lineTo(b - 3, y - 14); c.lineTo(b - 3, y - 6); c.stroke();
        chip(c, s, (a + b) / 2, y - 34, k === 1 ? K.coral : D.mute, 18); }); c.restore(); }
      if (t > 13.2) hair(c, x0 - 4, y - 4, x1 - x0 + 8, TRH3 + 8, 12, alpha(K.coral, .9), 2); } });
  c.save(); c.globalAlpha *= P(t, 8.6, 9.0); playhead(c, tx3(pt), 668, 262); c.restore();
  // cursor grabs the planet's end
  if (t > 12.9 && t < 15.3) { const ex = tx3(lay3(t, 0).out), cy = TRY3[0] + TRH3 / 2;
    const [x, y] = t < 13.25 ? path(t, [[12.9, ex + 160, cy + 160], [13.25, ex - 4, cy + 4]]) : [ex - 4, cy + 4];
    c.save(); c.globalAlpha *= P(t, 12.9, 13.05) * (1 - P(t, 14.9, 15.3)); cursor(c, x, y, P(t, 13.2, 13.5)); c.restore(); }
}
function b034(c, t) {
  const zk = eio(P(t, 12.6, 13.3)) * (1 - eio(P(t, 15.3, 16.3))), gone = eio(P(t, 15.7, 16.4));
  c.save(); c.globalAlpha *= 1 - gone; zoomTo(c, F4[0], F4[1], 1 + zk, zk); blurred(c, gone * 10, c => editor3(c, t, zk)); c.restore();
  // star streams still settling into the tracks
  const pin = P(t, 8.2, 8.7); if (pin < 1) { c.save(); c.globalCompositeOperation = 'lighter'; TRY3.forEach(y => { const g = c.createLinearGradient(X03, 0, X03 + XW3, 0);
    g.addColorStop(0, 'rgba(207,241,236,0)'); g.addColorStop(.5, `rgba(207,241,236,${.5 * (1 - pin)})`); g.addColorStop(1, 'rgba(207,241,236,0)'); c.fillStyle = g; c.fillRect(X03, y + TRH3 / 2 - 1.5, XW3, 3); }); c.restore(); }
  // a scrim keeps the type readable over the close-up
  if (zk > 0) { c.save(); const g = c.createLinearGradient(0, 0, 1000, 0); g.addColorStop(0, `rgba(3,7,9,${.85 * zk})`); g.addColorStop(1, 'rgba(3,7,9,0)'); c.fillStyle = g; c.fillRect(0, 0, 1000, 1080); c.restore(); }
  kicker(c, '01', '動態元件', 160, 196, P(t, 8.4, 8.9) * (1 - P(t, 15.6, 16.0)));
  title(c, [[['每個圖層，', W0]], [['都是一個', W0], ['動態元件', K.glow], ['。', W0]]], 160, 280, t, 8.5, 12.4);
  title(c, [[['拖動尾端，', W0]], [['只有', W0], ['停留', K.coral], ['會變長。', W0]]], 160, 280, t, 12.8, 15.6);
  // a teal spark leaves the title solid and flies to the brand swatch of the next shot
  const fl = P(t, 15.75, 16.55); if (fl > 0 && fl < 1) { const p0 = [tx3(2.8), TRY3[1] + TRH3 / 2]; comet(c, bz(p0, [p0[0] - 200, p0[1] - 520], [600, 520], SW5), eio(fl), .35, '#CFF1EC', 3.5, 1 - P(fl, .85, 1)); }
}

// ---------- B05: design.json; a brand change travels as a wave of light ----------
const DJ5 = { x: 160, y: 430, w: 560, h: 540 }, SW5 = [226, 620], HERO5 = { x: 800, y: 128, w: 960, h: 540 };
const WAVES = [[17.35, K.teal, K.coral], [18.65, K.coral, K.violet]];
function colAt(t, x, y) { const d = Math.hypot(x - SW5[0], y - SW5[1]); let col = K.teal;
  WAVES.forEach(([ta, , to]) => { const w = clamp(((t - ta) * 2000 - d) / 260); if (w > 0) col = mix(col, to, w); }); return col; }
function b05(c, t) {
  const inA = inK(t, 16.25, .8), out = eio(P(t, 19.9, 20.4)), foc = 1 - eo(P(t, 16.4, 17.2));
  kicker(c, '02', '設計系統', 160, 196, P(t, 16.4, 16.9) * (1 - out));
  title(c, [[['改一個 ', W0], ['token', K.glow], ['，', W0]], [['整部影片一起變。', W0]]], 160, 280, t, 16.5, 19.85);
  // the wall of frames, racking into focus
  c.save(); c.globalAlpha *= P(t, 16.3, 16.9) * (1 - out);
  blurred(c, 12 * foc + 10 * out, c => { const H = HERO5, cH = colAt(t, H.x + 300, H.y + 200);
    glass(c, H.x, H.y, H.w, H.h, 26); const R = { x: H.x + 18, y: H.y + 18, w: H.w - 36, h: H.h - 36 }, g = c.createLinearGradient(R.x, R.y, R.x + R.w, R.y + R.h);
    g.addColorStop(0, mix(cH, '#071012', .78)); g.addColorStop(1, mix(cH, '#0A0A16', .9)); box(c, R.x, R.y, R.w, R.h, 18, g);
    txt(c, 'Mografy Pro', R.x + 56, R.y + 104, 34, mix(cH, '#ffffff', .55), 600, 'left', F, 3); txt(c, 'Triangulum', R.x + 50, R.y + 180, 96, W0, 600, 'left', F, -3);
    txt(c, '付費版本，即將推出', R.x + 56, R.y + 262, 30, D.mute, 500, 'left');
    const cB = colAt(t, R.x + 160, R.y + 370); box(c, R.x + 56, R.y + 336, 212, 64, 32, cB); txt(c, '了解更多', R.x + 162, R.y + 369, 26, '#fff', 700);
    planet(c, R.x + 720, R.y + 230 + Math.sin(t * 1.6) * 8, 124, colAt(t, R.x + 720, R.y + 230)); });
  const MW = (HERO5.w - 40) / 3;
  blurred(c, 12 * foc + 2.5 + 10 * out, c => [0, 1, 2].forEach(i => { const x = HERO5.x + i * (MW + 20), y = 700, col = colAt(t, x + MW / 2, y + 120);
    glass(c, x, y, MW, 250, 20); const r = { x: x + 12, y: y + 12, w: MW - 24, h: 226 }; box(c, r.x, r.y, r.w, r.h, 12, i === 2 ? '#0B1214' : 'rgba(255,255,255,.05)');
    if (i === 0) { box(c, r.x + 18, r.y + 140, 200, 48, 10, col); txt(c, '全新物理動畫', r.x + 36, r.y + 165, 22, '#fff', 700, 'left'); box(c, r.x + 18, r.y + 40, 140, 14, 7, 'rgba(255,255,255,.3)'); box(c, r.x + 18, r.y + 66, 90, 10, 5, 'rgba(255,255,255,.18)'); }
    if (i === 1) [70, 110, 88, 150, 124].forEach((h, b) => box(c, r.x + 40 + b * 48, r.y + r.h - 24 - h, 30, h, 7, b === 3 ? col : mix(col, '#0B1214', .45)));
    if (i === 2) { planet(c, r.x + r.w / 2, r.y + 86, 40, col); txt(c, '即將推出', r.x + r.w / 2, r.y + 180, 24, W0, 700); } }));
  c.restore();
  // design.json card (its spring curve stays for the next shot)
  const brand = colAt(t, SW5[0], SW5[1]);
  c.save(); c.globalAlpha *= inA; c.translate(0, (1 - inA) * 50);
  c.save(); c.globalAlpha *= 1 - out; c.translate(0, -out * 40); glass(c, DJ5.x, DJ5.y, DJ5.w, DJ5.h);
  txt(c, '{ }', 214, 484, 28, K.glow, 700, 'center', M); txt(c, 'design.json', 246, 484, 30, W0, 600, 'left', M); chip(c, 'tokens', 660, 484, K.glow, 18, M, 500);
  c.fillStyle = D.hair; c.fillRect(DJ5.x, 524, DJ5.w, 1.5);
  txt(c, '色彩', 200, 564, 24, D.mute, 600, 'left');
  [[brand, 30], ['#F2F7F6', 24], [K.yellow, 24], [K.mint, 24], ['#1B1F24', 24]].forEach(([col, r], i) => { const x = SW5[0] + i * 86; dot(c, x, SW5[1], r, col); if (i === 4) { c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(x, SW5[1], r, 0, Math.PI * 2); c.stroke(); } });
  c.save(); c.lineWidth = 3; c.strokeStyle = alpha(brand, .6); c.beginPath(); c.arc(SW5[0], SW5[1], 40, 0, Math.PI * 2); c.stroke(); c.restore();
  txt(c, 'color.brand', 200, 684, 20, D.faint, 500, 'left', M); txt(c, brand.toUpperCase(), 344, 684, 20, mix(brand, '#ffffff', .35), 600, 'left', M);
  txt(c, '動態', 200, 736, 24, D.mute, 600, 'left'); txt(c, 'spring · expressive', 684, 736, 18, D.faint, 500, 'right', M);
  c.restore();
  if (t < 20.4) { // from 20.4 the next shot draws this card itself and grows it into the graph
  box(c, CV5.x, CV5.y, CV5.w, CV5.h, 16, 'rgba(255,255,255,.05)');
  c.save(); c.setLineDash([5, 7]); c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1.5; const v1 = CV5.y + CV5.h * .82 - CV5.h * .62; c.beginPath(); c.moveTo(CV5.x + 30, v1); c.lineTo(CV5.x + CV5.w - 30, v1); c.stroke(); c.restore();
  springCurve(c, CV5, brand, .6, 800, .32); }
  // picker
  const pop = P(t, 17.0, 17.15) * (1 - P(t, 19.0, 19.25));
  if (pop > 0) { c.save(); c.globalAlpha *= pop * (1 - out); c.translate(0, (1 - eo(pop)) * 10); panel(c, 196, 652, 300, 84, 22, '#1d2b2e');
    [K.teal, K.coral, K.violet].forEach((col, i) => { const x = 246 + i * 100, on = (i === 0 && t < 17.3) || (i === 1 && t >= 17.3 && t < 18.6) || (i === 2 && t >= 18.6); dot(c, x, 694, 22, col);
      if (on) { c.lineWidth = 3; c.strokeStyle = '#fff'; c.beginPath(); c.arc(x, 694, 29, 0, Math.PI * 2); c.stroke(); } }); c.restore(); }
  c.restore();
  // the waves themselves
  WAVES.forEach(([ta, , to]) => { const rw = (t - ta) * 2000; if (rw <= 0 || rw > 2600) return; c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(SW5[0], SW5[1], Math.max(0, rw - 140), SW5[0], SW5[1], rw); g.addColorStop(0, alpha(to, 0)); g.addColorStop(.85, alpha(to, .16 * (1 - rw / 2600))); g.addColorStop(1, alpha(to, 0));
    c.fillStyle = g; c.fillRect(0, 0, 1920, 1080); c.lineWidth = 2; c.strokeStyle = alpha(to, .5 * (1 - rw / 2600)); c.beginPath(); c.arc(SW5[0], SW5[1], rw, 0, Math.PI * 2); c.stroke(); c.restore(); });
  if (t > 16.7 && t < 19.4) { const [x, y] = path(t, [[16.7, 700, 900], [17.0, 236, 630], [17.1, 236, 630], [17.25, 346, 704], [18.45, 346, 704], [18.6, 446, 704], [19.0, 446, 704], [19.4, 640, 860]]);
    c.save(); c.globalAlpha *= P(t, 16.7, 16.85) * (1 - P(t, 19.1, 19.4)); cursor(c, x, y, Math.max(P(t, 17.0, 17.3) * (t < 17.3 ? 1 : 0), P(t, 17.25, 17.55) * (t < 17.55 ? 1 : 0), P(t, 18.55, 18.85) * (t < 18.85 ? 1 : 0))); c.restore(); }
}
const CV5 = { x: 196, y: 770, w: 488, h: 170 };

// ---------- B06: physics drawn in light ----------
const GRAPH6 = { x: 160, y: 420, w: 1000, h: 560 };
function b06(c, t) {
  const grow = eo(P(t, 20.4, 21.05)), trk = eio(P(t, 24.2, 24.9)), span = .32, sim = eio(P(t, 20.9, 22.7)) * span, back = eio(P(t, 22.9, 24.2)) * span;
  const pos = (cv, d = 0) => springV(Math.max(0, sim - d), cv.z, cv.k) - springV(Math.max(0, back - d), cv.z, cv.k), dotAt = t < 22.9 ? sim : back;
  kicker(c, '03', '物理動畫', 160, 196, P(t, 20.6, 21.1) * (1 - trk));
  title(c, [[['全新', W0], ['物理動畫', K.glow], ['，', W0]], [['每個動作都自然停穩。', W0]]], 160, 280, t, 20.6, 24.1);
  c.save(); c.globalAlpha *= 1 - trk; c.translate(-trk * 700, 0);
  const R = { x: lerp(CV5.x, GRAPH6.x, grow), y: lerp(CV5.y, GRAPH6.y, grow), w: lerp(CV5.w, GRAPH6.w, grow), h: lerp(CV5.h, GRAPH6.h, grow) };
  box(c, R.x, R.y, R.w, R.h, 16, `rgba(255,255,255,${.05 * (1 - grow)})`);
  const G = { x: R.x + 40 * grow, y: R.y + 20 * grow, w: R.w - 60 * grow, h: R.h - 80 * grow }, base = G.y + G.h * .82, unit = G.h * .62;
  c.save(); c.globalAlpha *= grow; c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 1.5;
  for (let i = 0; i <= 8; i++) { const x = G.x + G.w * .06 + i / 8 * G.w * .88; c.beginPath(); c.moveTo(x, G.y + 20); c.lineTo(x, base); c.stroke(); }
  for (let i = 0; i <= 4; i++) { const y = base - i / 4 * unit * 1.2; c.beginPath(); c.moveTo(G.x + G.w * .06, y); c.lineTo(G.x + G.w * .94, y); c.stroke(); } c.restore();
  c.save(); c.setLineDash([5, 7]); c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1.5 + .5 * grow; c.beginPath(); c.moveTo(G.x + G.w * .06, base - unit); c.lineTo(G.x + G.w * .94, base - unit); c.stroke(); c.restore();
  // the design.json curve itself grows into the graph and becomes the expressive curve; the other two are then drawn by light
  c.save(); c.shadowColor = K.glow; c.shadowBlur = 14 * grow; springCurve(c, G, mix(K.violet, K.glow, grow), .6, 800, span, 1, 4); c.restore();
  const fxy = cv => v => [G.x + G.w * .06 + v * G.w * .88, base - springV(v * span, cv.z, cv.k) * unit];
  if (t >= 20.9) CURVES.forEach((cv, i) => { if (i) { c.save(); c.shadowColor = cv.col; c.shadowBlur = 14; springCurve(c, G, cv.col, cv.z, cv.k, span, sim / span, 4); c.restore(); }
    if (t < 22.9) comet(c, fxy(cv), sim / span, .18, cv.col === W0 ? '#FFFFFF' : cv.col, 4, 1 - P(t, 22.5, 22.8));
    else comet(c, fxy(cv), dotAt / span, .18, cv.col === W0 ? '#FFFFFF' : cv.col, 4, P(t, 22.9, 23.05) * (1 - P(t, 24.0, 24.2))); });
  c.save(); c.globalAlpha *= P(t, 21.0, 21.4); CURVES.forEach((cv, i) => { const x = G.x + 50 + i * 290; dot(c, x, R.y + R.h + 34, 7, cv.col); txt(c, cv.label, x + 18, R.y + R.h + 35, 20, D.mute, 600, 'left'); }); c.restore();
  // floating glass chips on their own springs
  const li = inK(t, 20.7, .8); c.save(); c.globalAlpha *= li; c.translate((1 - li) * 60, 0);
  CURVES.forEach((cv, i) => { const y = 470 + i * 180, from = 1250, to = 1574; txt(c, cv.label, 1250, y - 34, 22, W0, 700, 'left'); txt(c, cv.tag, 1760, y - 34, 18, D.faint, 500, 'right');
    box(c, 1250, y + 76, 510, 3, 1.5, 'rgba(255,255,255,.07)');
    if (i < 2) { for (let gh = 5; gh >= 0; gh--) { const v = pos(cv, gh * .014), x = lerp(from, to, v); c.save(); c.globalAlpha *= gh ? .08 : 1;
        if (!gh) { c.shadowColor = alpha(i === 0 ? K.glow : '#ffffff', .45); c.shadowBlur = 24; } box(c, x, y - 4, 186, 70, 18, i === 0 ? K.teal : '#E8EFEE'); c.shadowColor = 'transparent';
        if (!gh) { box(c, x + 22, y + 18, 92, 12, 6, i === 0 ? 'rgba(255,255,255,.85)' : 'rgba(27,31,36,.7)'); box(c, x + 22, y + 40, 60, 10, 5, i === 0 ? 'rgba(255,255,255,.55)' : 'rgba(27,31,36,.35)'); } c.restore(); } }
    else { const v = clamp(pos(cv)); c.save(); c.globalAlpha *= .08 + .92 * v; c.shadowColor = alpha(K.violet, .5); c.shadowBlur = 24 * v; box(c, 1412, y - 4, 186, 70, 18, K.violet); c.shadowColor = 'transparent';
      box(c, 1434, y + 18, 92, 12, 6, 'rgba(255,255,255,.85)'); box(c, 1434, y + 40, 60, 10, 5, 'rgba(255,255,255,.55)'); c.restore(); } });
  c.restore(); c.restore();
}

// ---------- B07: subtitles (the v2 layout, scaled into the right side) ----------
const tt7 = t => 16 + (t - 24.6) * (3.5 / 3.8);
function b07(c, t) {
  const inn = eo(P(t, 24.45, 25.2)), trk = eio(P(t, 28.0, 28.7));
  kicker(c, '04', '字幕', 160, 196, P(t, 24.8, 25.3) * (1 - trk));
  title(c, [[['字幕綁在圖層上，', W0]], [['一起移動', K.glow], ['。', W0]]], 160, 280, t, 24.85, 28.0);
  c.save(); c.globalAlpha *= inn * (1 - trk); c.translate((1 - inn) * 700 - trk * 700, 0); c.translate(1136, 680); const z7 = 1 + (t - 24.6) * .012; c.scale(z7, z7); c.translate(-1136, -680); c.translate(387, 247); c.scale(.78, .78); subs5(c, tt7(t)); c.restore();
}

// ---------- B08: three glass cards with a rack focus ----------
const tt8 = t => 19.5 + (t - 28.4) * (5 / 4.6);
const TILE_X = [590, 1060, 1530];
function b08(c, t) {
  const tt = tt8(t), inn = eo(P(t, 28.3, 29.1)), back = eio(P(t, 32.6, 33.3));
  const fc = eio(P(tt, 21.2, 21.6)) + eio(P(tt, 22.9, 23.3));
  kicker(c, '05', '日常操作', 160, 196, P(t, 28.6, 29.1) * (1 - back));
  title(c, [[['日常操作，', W0]], [['也更', W0], ['順手', K.glow], ['。', W0]]], 160, 280, t, 28.65, 32.5);
  c.save(); c.globalAlpha *= inn * (1 - back); c.translate((1 - inn) * 700, 0); c.translate(960, 690); c.scale(1 - back * .45, 1 - back * .45); c.translate(-960, -690);
  c.translate(-(fc - 1) * 70, 0);
  [2, 0, 1].sort((a, b) => Math.abs(b - fc) - Math.abs(a - fc)).forEach(i => {
    const d = Math.abs(i - fc), s = .9 * (1 - .1 * clamp(d)), cx = TILE_X[i], cy = 700 + clamp(d) * 18, R = { x: cx - 240, y: cy - 300, w: 480, h: 600 };
    blurred(c, 4.5 * clamp(d), c => { c.save(); c.globalAlpha *= 1 - .4 * clamp(d); c.translate(cx, cy); c.scale(s, s); c.translate(-cx, -cy);
      if (d < .5) { c.save(); c.shadowColor = alpha(K.glow, .35 * (1 - d * 2)); c.shadowBlur = 60; box(c, R.x, R.y, R.w, R.h, 26, 'rgba(12,20,22,.9)'); c.restore(); }
      glass(c, R.x, R.y, R.w, R.h, 26); tileBody(c, i, R, tt);
      if (d < .5) { c.save(); c.globalAlpha *= 1 - d * 2; hair(c, R.x - 3, R.y - 3, R.w + 6, R.h + 6, 28, alpha(K.glow, .7), 2); c.restore(); }
      txt(c, LABEL6[i][0], cx, R.y + R.h + 52, 30, d < .5 ? W0 : D.mute, 700); c.restore(); }); });
  c.restore();
}

// ---------- B09: the whole editor ----------
const WIN = { x: 260, y: 196, w: 1400, h: 790 };
function editorWindow(c, t) {
  const W = WIN; glass(c, W.x, W.y, W.w, W.h, 30);
  // title bar
  [K.coral, K.yellow, K.glow].forEach((col, i) => dot(c, W.x + 34 + i * 26, W.y + 30, 7, alpha(col, .8)));
  const name = 'Mografy Pro Triangulum', nw = tw(c, name, 20, 600); txt(c, name, W.x + W.w / 2 + 30, W.y + 31, 20, D.text, 600);
  const bx = W.x + W.w / 2 - nw / 2 - 40; box(c, bx - 26, W.y + 18, 52, 26, 13, metal(c, bx - 26, bx + 26)); txt(c, 'PRO', bx, W.y + 32, 14, '#1B1F24', 800, 'center', F, 1.5);
  c.fillStyle = D.hair; c.fillRect(W.x, W.y + 60, W.w, 1.5);
  // stage
  const S = { x: W.x + 28, y: W.y + 84, w: 860, h: 484 }; stageFrame(c, S); planet(c, S.x + 640, S.y + 210 + Math.sin(t * 1.6) * 6, 96, K.coral);
  txt(c, 'Mografy Pro', S.x + 56, S.y + 110, 28, CH, 600, 'left', F, 3); txt(c, 'Triangulum', S.x + 50, S.y + 180, 80, W0, 600, 'left', F, -3);
  const sb = '每一句字幕，都跟著圖層走。', sw = tw(c, sb, 26, 600) + 52; box(c, S.x + S.w / 2 - sw / 2, S.y + 400, sw, 50, 25, 'rgba(0,0,0,.55)'); txt(c, sb, S.x + S.w / 2, S.y + 426, 26, W0, 600);
  // inspector
  const I = { x: W.x + 916, y: W.y + 84, w: 456 };
  txt(c, '設計系統', I.x, I.y + 18, 22, W0, 700, 'left'); [K.teal, K.coral, K.violet, K.yellow, K.mint].forEach((col, i) => dot(c, I.x + 22 + i * 52, I.y + 66, 17, col));
  c.fillStyle = D.hair; c.fillRect(I.x, I.y + 104, I.w, 1.5);
  txt(c, '動態', I.x, I.y + 136, 22, W0, 700, 'left'); txt(c, 'expressive', I.x + I.w, I.y + 136, 16, D.faint, 500, 'right', M);
  const CB = { x: I.x, y: I.y + 158, w: I.w, h: 130 }; box(c, CB.x, CB.y, CB.w, CB.h, 14, 'rgba(255,255,255,.04)');
  const sp = ((t - 33) % 1.6) / 1.6; springCurve(c, CB, K.glow, .6, 800, .32, 1, 3); { const v = clamp(sp * 1.2), x = CB.x + CB.w * .06 + v * CB.w * .88, y = CB.y + CB.h * .82 - springV(v * .32, .6, 800) * CB.h * .62; dot(c, x, y, 7, K.glow); }
  c.fillStyle = D.hair; c.fillRect(I.x, I.y + 308, I.w, 1.5);
  txt(c, '字幕', I.x, I.y + 340, 22, W0, 700, 'left');
  [['S01', 'Mografy Pro Triangulum'], ['S02', '每一句字幕，都跟著圖層走。'], ['S03', '改一個 token，全部更新。']].forEach(([id, s], i) => { const y = I.y + 372 + i * 44;
    box(c, I.x, y, I.w, 36, 10, i === 1 ? 'rgba(255,140,105,.1)' : 'rgba(255,255,255,.03)'); txt(c, id, I.x + 14, y + 19, 16, i === 1 ? K.coral : D.mute, 600, 'left', M); txt(c, s, I.x + 64, y + 19, 17, D.text, 500, 'left'); });
  // timeline
  const T0 = { x: W.x + 28, y: W.y + 596, w: W.w - 56, h: 166 }; box(c, T0.x, T0.y, T0.w, T0.h, 16, 'rgba(255,255,255,.035)');
  const X0 = T0.x + 150, XW = T0.w - 180;
  LAY.forEach((l, i) => { const y = T0.y + 20 + i * 36; dot(c, T0.x + 24, y + 13, 6, l.col); txt(c, l.name, T0.x + 42, y + 14, 18, D.mute, 600, 'left');
    solid(c, X0 + l.in / 6 * XW, X0 + l.out / 6 * XW, y, 26, l.col, 40, 30, .4); });
  playhead(c, X0 + ((t - 33) * .9 % 6) / 6 * XW, T0.y + 12, T0.h - 20);
}
function b09(c, t) {
  const inn = eo(P(t, 33.0, 33.8)), out = eio(P(t, 35.95, 36.6)), push = 1 + (t - 33) * .012;
  c.save(); c.globalAlpha *= P(t, 33.0, 33.45) * (1 - out); c.translate(960, 590); const z = lerp(1.3, 1, inn) * push; c.scale(z, z); c.translate(-960, -590);
  blurred(c, 10 * (1 - inn) + 8 * out, c => editorWindow(c, t)); c.restore();
  fade(c, P(t, 33.5, 34.1) * (1 - P(t, 35.7, 36.1)), 20, () => rich(c, [['全部，都在 ', W0], ['Mografy Pro', metal(c, 960, 1300)], ['。', W0]], 960, 112, 56, 700, -1));
  if (t < 36.4) galaxy10(c, t);
}

// ---------- B10: particles regather into the galaxy, collapse into light, the logo builds ----------
const LT0 = 37.45, LTS = 1.3, LOGO_CY = 420;
const START7 = [960 + (452 - 209.35) * 1.18, LOGO_CY + (135 - 126.25) * 1.18];
function galaxy10(c, t) {
  if (t < 35.8 || t > 37.95) return;
  const collapse = eio(P(t, 37.0, 37.65));
  galaxy(c, { t, mode: 3, cx: lerp(960, START7[0], collapse), cy: lerp(560, START7[1], collapse), R: lerp(520, 30, collapse), rot: (t - 35.8) * .5 + collapse * 3,
    elev: lerp(.74, .62, P(t, 35.8, 37.6)), a: 1 - P(t, 37.55, 37.9), core: P(t, 36.4, 37.0) * (.6 + collapse * .8), halo: P(t, 36.6, 37.0) * (1 - collapse) });
}
function b10(c, t) {
  galaxy10(c, t);
  const flash = Math.exp(-(((t - 37.65) / .22) ** 2));
  if (flash > .01) { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(START7[0], START7[1], 0, START7[0], START7[1], 700); g.addColorStop(0, `rgba(255,255,255,${.6 * flash})`); g.addColorStop(.25, `rgba(47,211,194,${.25 * flash})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 1920, 1080); c.restore(); }
  if (t > LT0) brandLogo(c, (t - LT0) * LTS, W0);
  // Pro (champagne) + Triangulum, with a highlight crossing at the end
  fade(c, P(t, 40.0, 40.5), 16, () => { const a = 'Pro ', b = 'Triangulum', wa = tw(c, a, 64, 600, F, -1), wb = tw(c, b, 64, 600, F, -1), x0 = 960 - (wa + wb) / 2;
    txt(c, a, x0, 604, 64, metal(c, x0, x0 + wa), 600, 'left', F, -1); const g = c.createLinearGradient(x0 + wa, 0, x0 + wa + wb, 0); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#9EEBDF'); txt(c, b, x0 + wa, 604, 64, g, 600, 'left', F, -1);
    const u = P(t, 41.0, 41.8); if (u > 0 && u < 1) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= .6; const band = sweepFill(c, x0, x0 + wa + wb, u, 120); txt(c, a + b, x0, 604, 64, band, 600, 'left', F, -1); c.restore(); } });
  fade(c, P(t, 40.3, 40.8), 14, () => rich(c, [['有些想法，', W0], ['值得動起來。', K.glow]], 960, 704, 44, 700, 1));
  // pill: centred on the ink bounds (no letter spacing), so it stays centred in every browser
  fade(c, P(t, 40.6, 41.1), 12, () => { const s = 'www.mografy.app'; c.font = `500 26px ${F}`; c.letterSpacing = '0px'; c.textAlign = 'left'; c.textBaseline = 'middle';
    const m = c.measureText(s), il = m.actualBoundingBoxLeft, iw = il + m.actualBoundingBoxRight, w = iw + 64, x = 960 - w / 2;
    box(c, x, 950, w, 56, 28, alpha(K.teal, .14)); hair(c, x, 950, w, 56, 28, alpha(K.glow, .45)); txt(c, s, 960 - iw / 2 + il, 979, 26, K.mint, 500, 'left', F, 0); });
}
// ---------- Three.js particle layers (v4) ----------
// Two point clouds, posed only through shader uniforms, so every frame is a pure function of time:
//  • the deep field: ~9 000 stars in a wrapping box the camera flies through, echoing every 2D camera move (drawn behind the UI);
//  • the Triangulum galaxy: ~80 000 stars in a real 3D disc (arms, dust, star-forming knots, bulge) seen by a perspective camera,
//    with depth of field and twinkle; its bloom, its stream into the four tracks and its regathering from the editor are staggered per star in the shader.
// The host sets GLX = { render(scene) → canvas, px } (board: a page canvas; project: the Mografy 3D layer) and GLP = buildParticles(THREE).
let GLX = null, GLP = null;
const GAL_D = 6, GAL_FOV = 21, KREF = 540 / (GAL_D * Math.tan(GAL_FOV / 2 * Math.PI / 180)); // px per galaxy unit at zoom 1
const FIELD = { W: 72, H: 42, Z: 46, near: .8, fov: 50 };

const GLSL_LIB = `
float cl(float x) { return clamp(x, 0., 1.); }
float P(float t, float a, float b) { return cl((t - a) / (b - a)); }
float eo(float x) { return 1. - pow(1. - x, 3.); }
float eio(float x) { return x < .5 ? 4. * x * x * x : 1. - pow(-2. * x + 2., 3.) / 2.; }
`;
const GLSL_FRAG = `
precision highp float;
varying vec3 vCol; varying float vA, vSharp;
void main() {
  vec2 q = gl_PointCoord * 2. - 1.; float r2 = dot(q, q); if (r2 > 1.) discard;
  float soft = exp(-r2 * 4.2) * (1. - r2 * r2), core = exp(-r2 * 26.) * vSharp;
  float a = vA * (soft * .8 + core * .7);
  vec3 col = mix(vCol, vec3(1.), core * .55);
  gl_FragColor = vec4(col * a, a);
}`;

export function buildParticles(THREE) {
  const add = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor, transparent: true, depthTest: false, depthWrite: false };
  const rgb = h => hex(h).map(v => v / 255);
  const gauss = s => (rnd(s) + rnd(s * 1.7 + .3) + rnd(s * 2.3 + .7) + rnd(s * 3.1 + .1) - 2) / 2; // ≈ N(0, .29)
  const cloud = (n, fields) => { const g = new THREE.BufferGeometry(); for (const [k, w] of fields) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(n * w), w)); return g; };

  // ---- the galaxy ----
  const stars = [];
  const put = (r, th, h, spin, size, a, col, kind = 0) => stars.push({ r, th, h, spin, size, a, col, kind });
  const armTint = (u, k) => u < .14 ? (k > .5 ? '#FFE9C2' : '#FFD9A0') : u < .42 ? (k > .72 ? '#FFFFFF' : '#CFF1EC') : k > .84 ? '#B7A6F6' : k > .42 ? '#2FD3C2' : '#8FE3D8';
  for (let i = 0; i < 26000; i++) { // arm stars
    const arm = i % 2, u = .05 + .95 * rnd(i * 1.37) ** 1.12, g = gauss(i * 4.21), k = rnd(i * 6.6);
    put(u * (.88 + rnd(i * 2.9) * .24), arm * Math.PI + Math.log(u * 12 + 1) * 2.25 + g * (.42 + u * .78), gauss(i * 5.3) * (.05 - u * .03), 1,
      (3.4 + rnd(i * 8.8) ** 6 * 14) * (1.1 - u * .4), (.2 + k * .34) * (.62 + .38 * Math.min(1, u * 3)) * (1 - Math.abs(g) * .6), armTint(u, k));
  }
  for (let i = 0; i < 40000; i++) { // fine dust that fills the arms and the gaps (the Milky Way look)
    const j = i + 9000, arm = i % 2, u = .03 + .99 * rnd(j * 1.91) ** .85, g = gauss(j * 4.7), k = rnd(j * 6.1);
    put(u * (.94 + rnd(j * 2.3) * .2), arm * Math.PI + Math.log(u * 12 + 1) * 2.25 + g * (.85 + u * 1.05), gauss(j * 3.7) * (.07 - u * .04), 1,
      2 + rnd(j * 8.1) ** 3 * 2.6, (.11 + k * .22) * (.75 + .25 * Math.min(1, u * 3)), k > .92 ? '#B7A6F6' : k > .58 ? '#FFFFFF' : u < .18 ? '#FFE9C2' : '#CFF1EC');
  }
  for (let c = 0; c < 140; c++) { // star-forming knots strung along the arms
    const arm = c % 2, u = .22 + .7 * rnd(c * 7.31 + 2), th0 = arm * Math.PI + Math.log(u * 12 + 1) * 2.25 + gauss(c * 3.3) * .25, col = rnd(c * 5.7) > .45 ? '#C9B8FF' : '#9FF2E6';
    for (let m = 0; m < 22; m++) { const s = c * 40 + m; put(u + gauss(s * 1.9) * .035, th0 + gauss(s * 2.7) * .05, gauss(s * 3.9) * .02, 1, 3.2 + rnd(s * 4.4) ** 3 * 9, .34 + rnd(s * 6.2) * .4, m % 5 ? col : '#FFFFFF'); }
  }
  for (let i = 0; i < 6000; i++) { // bulge: a warm, slightly flattened ball
    const r = Math.abs(gauss(i * 2.2 + 5)) * .42 * (.4 + rnd(i * 1.1 + 8)), th = rnd(i * 7.3 + 3) * Math.PI * 2;
    put(r, th, gauss(i * 9.1) * r * .7, .6, 3 + rnd(i * 3.3) ** 3 * 9, .18 + rnd(i * 4.4) * .3, rnd(i * 9.9) > .5 ? '#FFE9C2' : '#FFF6E4');
  }
  for (let i = 0; i < 16; i++) // a few big out-of-focus discs that float in front of the disc
    put(.45 + rnd(i * 3.7) * .75, rnd(i * 11.1) * Math.PI * 2, .35 + rnd(i * 2.9) * .5, .3, 40 + rnd(i * 2.3) * 60, .06 + rnd(i * 5.1) * .06, rnd(i) > .5 ? '#12B5A5' : '#B7A6F6', 1);
  const NG = stars.length;
  const gg = cloud(NG, [['position', 3], ['aP', 3], ['aS', 3], ['aCol', 3], ['aR', 4], ['aR2', 4]]);
  stars.forEach((s, i) => {
    gg.attributes.aP.array.set([s.r, s.th, s.h], i * 3);
    gg.attributes.aS.array.set([s.spin, s.size, s.a], i * 3);
    gg.attributes.aCol.array.set(rgb(s.col), i * 3);
    gg.attributes.aR.array.set([rnd(i * .7), rnd(i * 3.3), rnd(i * 1.7) - .5, rnd(i * 2.9) - .5], i * 4);   // d, tx, jx, jy (stagger, track x, swirl)
    gg.attributes.aR2.array.set([i % 4, rnd(i * 1.31 + .5), rnd(i * 8.3), s.kind], i * 4);              // track row, window y, twinkle phase, kind
  });
  const galMat = new THREE.ShaderMaterial({ ...add,
    uniforms: Object.fromEntries(Object.entries({ uT: 0, uMode: 0, uRot: 0, uZoom: 1, uZs: 1, uAng: -.35, uA: 1, uPx: 1, uFocus: GAL_D, uCoC: 7,
      uC: new THREE.Vector2(960, 540), uTrk: new THREE.Vector4(420, 1290, 740, 56), uWin: new THREE.Vector4(260, 196, 1400, 790) }).map(([k, v]) => [k, { value: v }])),
    vertexShader: GLSL_LIB + `
attribute vec3 aP, aS, aCol; attribute vec4 aR, aR2;
uniform float uT, uMode, uRot, uZoom, uZs, uAng, uA, uPx, uFocus, uCoC; uniform vec2 uC; uniform vec4 uTrk, uWin;
varying vec3 vCol; varying float vA, vSharp;
void main() {
  float d = aR.x, tx = aR.y, jx = aR.z, jy = aR.w, m = 1., swell = 1.;
  float th = aP.y + uRot * aS.x, r = aP.x, h = aP.z;
  if (uMode == 1.) { // bloom: every star spirals out of the core, inner ones first
    float g = eo(P(uT, 2.55, 2.95 + r * .6 + d * .25)); th -= (1. - g) * 1.6; r *= g; h *= g; m = g; swell = 1. + (1. - g) * g * 1.6;
  }
  vec4 mv = modelViewMatrix * vec4(cos(th) * r, h, sin(th) * r, 1.), cp = projectionMatrix * mv;
  vec2 off = cp.xy / cp.w * vec2(960., -540.) * uZoom; float ca = cos(uAng), sa = sin(uAng);
  vec2 px = uC + vec2(off.x * ca - off.y * sa, off.x * sa + off.y * ca);
  if (uMode == 2. && uT > 7.2) { // stream: the galaxy straightens into the four timeline tracks
    float u = eio(P(uT, 7.2 + d * .35, 7.85 + d * .3));
    vec2 to = vec2(uTrk.x + tx * uTrk.y, uTrk.z + aR2.x * uTrk.w + jy * 6.);
    px = mix(px, to, u) + vec2(0., -sin(u * 3.14159) * 90. * jx); m *= 1. - u * .3; swell *= 1. + sin(u * 3.14159) * .9;
  }
  if (uMode == 3.) { // gather: stars rise out of the editor window and swirl into the disc
    float g = eio(P(uT, 35.8 + d * .3, 36.95 + d * .25)), sw = sin(g * 3.14159) * 140. * jx;
    vec2 from = uWin.xy + vec2(tx, aR2.y) * uWin.zw;
    px = mix(from, px, g) + vec2(-sw, sw * .5); m *= mix(.3, 1., g) * P(uT, 35.95, 36.4); swell *= 1. + sin(g * 3.14159) * .5;
  }
  m *= .8 + .2 * sin(uT * (1.1 + aR2.z * 2.6) + aR2.z * 40.);   // twinkle
  float depth = -mv.z, s = aS.y * uZs * swell * (uFocus / depth) * uPx, coc = abs(depth - uFocus) * uCoC * uPx;
  if (aR2.w > .5) { s = aS.y * uPx; coc = 0.; }
  float se = sqrt(s * s + coc * coc), lo = 1.3 * uPx;
  m *= s * s / (se * se); if (se < lo) { m *= se * se / (lo * lo); se = lo; }
  vA = aS.z * uA * m; vCol = aCol; vSharp = cl(1. - coc / (s + .01)) * (aR2.w > .5 ? 0. : 1.);
  gl_PointSize = min(se, 160. * uPx);
  gl_Position = vec4(px.x / 960. - 1., 1. - px.y / 540., 0., 1.);
}`, fragmentShader: GLSL_FRAG });
  const galScene = new THREE.Scene(), gal = new THREE.Points(gg, galMat); gal.frustumCulled = false; galScene.add(gal);
  const galCam = new THREE.PerspectiveCamera(GAL_FOV, 16 / 9, .05, 100);

  // ---- the deep field ----
  const NF = 9000, fg = cloud(NF, [['position', 3], ['aP', 3], ['aS', 3], ['aCol', 3]]);
  for (let i = 0; i < NF; i++) {
    const k = rnd(i * 5.3 + 1), big = rnd(i * 2.1 + 4) ** 9;
    fg.attributes.aP.array.set([rnd(i * 3.1 + 2), rnd(i * 7.7 + 3), rnd(i * 1.9 + 5)], i * 3);
    fg.attributes.aS.array.set([1.6 + big * 7, .35 + k * .6, rnd(i * 8.3)], i * 3);
    fg.attributes.aCol.array.set(rgb(k > .9 ? '#B7A6F6' : k > .7 ? '#CFF1EC' : k > .62 ? '#FFE9C2' : '#FFFFFF'), i * 3);
  }
  const fieldMat = new THREE.ShaderMaterial({ ...add,
    uniforms: { uCam: { value: new THREE.Vector3() }, uT: { value: 0 }, uA: { value: 1 }, uPx: { value: 1 } },
    vertexShader: GLSL_LIB + `
attribute vec3 aP, aS, aCol; uniform vec3 uCam; uniform float uT, uA, uPx; varying vec3 vCol; varying float vA, vSharp;
void main() {
  vec3 B = vec3(${FIELD.W.toFixed(1)}, ${FIELD.H.toFixed(1)}, ${FIELD.Z.toFixed(1)});
  vec3 p = fract(aP - uCam / B);
  float depth = ${FIELD.near.toFixed(2)} + p.z * B.z;
  vec4 mv = vec4((p.x - .5) * B.x, (p.y - .5) * B.y, -depth, 1.), cp = projectionMatrix * mv;
  float s = aS.x * 9. / depth * uPx + .9 * uPx, coc = abs(1. / depth - 1. / 16.) * 70. * uPx, se = sqrt(s * s + coc * coc), lo = 1.2 * uPx;
  float m = s * s / (se * se); if (se < lo) { m *= se * se / (lo * lo); se = lo; }
  m *= smoothstep(B.z, B.z * .7, depth) * smoothstep(${FIELD.near.toFixed(2)}, 2.6, depth) * (.72 + .28 * sin(uT * (.8 + aS.z * 2.2) + aS.z * 50.));
  vA = aS.y * uA * m; vCol = aCol; vSharp = cl(1. - coc / (s + .01));
  gl_PointSize = min(se, 110. * uPx); gl_Position = cp;
}`, fragmentShader: GLSL_FRAG });
  const fieldScene = new THREE.Scene(), field = new THREE.Points(fg, fieldMat); field.frustumCulled = false; fieldScene.add(field);
  const fieldCam = new THREE.PerspectiveCamera(FIELD.fov, 16 / 9, .1, 200);
  return { THREE, galScene, galCam, galMat, fieldScene, fieldCam, fieldMat };
}

/** The deep-field camera: a slow flight forward that also follows every 2D camera move (push-ins, pull-backs, trucks). */
function fieldCam(T) {
  const z = .32 * T + 2.6 * eio(P(T, 12.6, 13.3)) - 2.6 * eio(P(T, 15.3, 16.3)) - 3.2 * eio(P(T, 32.6, 33.3)) + 4.5 * eio(P(T, 36.9, 37.7))
    + 1.4 * eio(P(T, 1.0, 2.7)), x = .06 * T + 3.4 * eio(P(T, 24.2, 24.9)) + 3.4 * eio(P(T, 28.0, 28.7)) - 1.2 * eio(P(T, 1.0, 2.7)), y = .03 * T;
  return [x, y, z];
}
function fieldLayer(c, T) {
  if (!GLX) return;
  const u = GLP.fieldMat.uniforms, [x, y, z] = fieldCam(T);
  u.uCam.value.set(x, y, z); u.uT.value = T; u.uPx.value = GLX.px; u.uA.value = 1;
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1; c.drawImage(GLX.render(GLP.fieldScene, GLP.fieldCam), 0, 0, 1920, 1080); c.restore();
}
/** o: t (beat time), mode (0 still, 1 bloom, 2 stream, 3 gather), cx, cy, R, rot, a, elev, yaw, angle. */
function galaxyLayer(c, o) {
  if (!GLX) return;
  const u = GLP.galMat.uniforms, cam = GLP.galCam, e = o.elev ?? .64, yw = o.yaw ?? 0;
  cam.position.set(Math.sin(yw) * Math.cos(e) * GAL_D, Math.sin(e) * GAL_D, Math.cos(yw) * Math.cos(e) * GAL_D); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  u.uT.value = o.t; u.uMode.value = o.mode ?? 0; u.uRot.value = o.rot; u.uZoom.value = o.R / KREF; u.uZs.value = (o.R / 470) ** .45;
  u.uAng.value = o.angle ?? -.35; u.uA.value = o.a ?? 1; u.uPx.value = GLX.px; u.uC.value.set(o.cx, o.cy);
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1; c.drawImage(GLX.render(GLP.galScene, cam), 0, 0, 1920, 1080); c.restore();
}
// ---- brand logo (paths traced from docs/brand, via packages/web/src/logo.ts) ----

const LOGO = LOGO_PIECES.map(p => ({ ...p, path: new Path2D(p.d) }));
const LOGO_VB = [13.2, 24.5, 1136.5, 203.5], MARK_W = 392.5;
// ---- the brand logo animation from examples/mografy-brand (white ink on the dark ground) ----
const SPINE = [[79, 52], [96, 48], [115, 46.5], [134, 49.5], [152, 56], [166, 72], [178, 92], [190, 116], [202, 140], [214, 160], [228, 170], [244, 160], [258, 138], [270, 116], [280, 102], [287, 96]];
// the stroke starts at the prompt's send button (right of the mark) and loops over the top into the ribbon
const LEAD = [[452, 135], [446, 62], [372, -6], [246, -40], [110, -36], [12, -8], [-16, 34], [30, 56]];
function smoothPolyline(points, steps = 10) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) { const u = s / steps, u2 = u * u, u3 = u2 * u;
      out.push([0, 1].map(k => .5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3))); }
  }
  out.push(points[points.length - 1]); return out;
}
const TRACK = smoothPolyline([...LEAD, ...SPINE]);
const CUM = TRACK.reduce((acc, p, i) => (acc.push(i ? acc[i - 1] + Math.hypot(p[0] - TRACK[i - 1][0], p[1] - TRACK[i - 1][1]) : 0), acc), []);
const TOTAL = CUM[CUM.length - 1], SPINE_START = CUM[LEAD.length * 10];
const TRACK_PATH = (() => { const p = new Path2D(); TRACK.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); return p; })();
const pointAt = len => { const i = Math.max(1, CUM.findIndex(v => v >= len)), a = TRACK[i - 1], b = TRACK[i], u = clamp((len - CUM[i - 1]) / Math.max(1e-6, CUM[i] - CUM[i - 1]));
  return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]; };
const at = (t, a, b, e = eio) => e(P(t, a, b));
const spring = (t, s, d, over) => { const x = P(t, s, s + d); if (x <= 0) return 0; const c1 = over * 8; return 1 + (c1 + 1) * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
const LOGO_BOX = { x0: 15.2, y0: 26.5, x1: 1147.5, y1: 226 }, MARK_BOX = { x0: 15.2, y0: 26.5, x1: 403.5, y1: 226 };
function brandLogo(c, T, ink = L.ink) { // T = seconds into the template animation
  const g = c.createRadialGradient(960, LOGO_CY, 0, 960, LOGO_CY, 760); g.addColorStop(0, `rgba(18,181,165,${.1 * at(T, .6, 2.6)})`); g.addColorStop(1, 'rgba(18,181,165,0)');
  c.fillStyle = g; c.fillRect(0, 0, 1920, 1080);
  const lock = at(T, 2.25, 3.35, inOutQuart), s = lerp(1.18, .8, lock);
  const markCx = (MARK_BOX.x0 + MARK_BOX.x1) / 2, logoCx = (LOGO_BOX.x0 + LOGO_BOX.x1) / 2, cy = (LOGO_BOX.y0 + LOGO_BOX.y1) / 2;
  c.save(); c.translate(960 - lerp(markCx, logoCx, lock) * s, LOGO_CY - cy * s); c.scale(s, s);
  const ribbon = LOGO[1];
  // 1 — one teal stroke sweeps in along the ribbon's own path
  const head = at(T, .45, 1.75, x => inOutQuart(x) * .35 + outQuint(x) * .65) * TOTAL, tail = Math.max(0, head - lerp(260, 0, at(T, 1.35, 1.95)));
  if (head > 0 && head - tail > .5 && T < 2.1) { c.save(); c.strokeStyle = K.teal; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = lerp(7, 16, at(T, 1.0, 1.7));
    c.setLineDash([head - tail, TOTAL * 2]); c.lineDashOffset = -tail; c.stroke(TRACK_PATH); c.restore(); }
  const filled = head - SPINE_START;
  const fillRibbon = () => { if (filled <= 0) return; const clip = new Path2D();
    for (let l = SPINE_START; l <= Math.min(head, TOTAL); l += 4) { const [x, y] = pointAt(l); clip.moveTo(x + 50, y); clip.arc(x, y, 50, 0, Math.PI * 2); }
    if (head >= TOTAL - 1) clip.rect(0, 0, 420, 260);
    c.save(); c.clip(clip); c.fillStyle = K.teal; c.fill(ribbon.path, 'evenodd'); c.restore(); };
  fillRibbon();
  // 2 — arches rise with a small anticipation and settle
  [0, 2].forEach((idx, k) => { const start = 1.25 + k * .14, rise = spring(T, start, .62, .14); if (rise <= 0) return;
    const p = LOGO[idx], [bx, by, bw, bh] = p.box, dip = Math.sin(P(T, start - .12, start) * Math.PI) * 3;
    c.save(); c.beginPath(); c.rect(bx - 6, by - 40, bw + 12, bh + 46); c.clip(); c.translate(0, (1 - rise) * (bh + 10) + dip); c.fillStyle = ink; c.fill(p.path, 'evenodd'); c.restore();
    if (idx === 0) fillRibbon(); });
  // 3 — the wordmark rises letter by letter from a baseline mask
  LOGO.slice(3).forEach((p, i) => { const start = 2.55 + i * .065, a = outQuint(P(T, start, start + .75)); if (a <= 0) return; const [bx, , bw] = p.box;
    c.save(); c.beginPath(); c.rect(bx - 10, 30, bw + 20, 200); c.clip(); c.globalAlpha *= clamp(a * 1.4); c.translate(0, (1 - a) * 70); c.fillStyle = ink; c.fill(p.path, 'evenodd'); c.restore(); });
  c.restore();
}
const FNS = [b01, b02, b034, b034, b05, b06, b07, b08, b09, b10];
/** A few large out-of-focus lights drifting in front of everything (the star dust behind is the Three.js deep field). */
const BOKEH = Array.from({ length: 12 }, (_, i) => ({ x: rnd(i * 9.1 + 7) * 2400, y: rnd(i * 3.3 + 9) * 1500, s: 110 + rnd(i * 5.9 + 2) * 200, a: .025 + rnd(i * 7.7) * .035,
  col: rnd(i * 2.1 + 5) > .6 ? '#12B5A5' : rnd(i * 4.3) > .5 ? '#B7A6F6' : '#CFF1EC' }));
function drift(c, T, list, vx, vy, W, H, alphaOf, sizeOf) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const d of list) { const z = d.z ?? 1, x = ((d.x - T * vx * z) % W + W) % W - (W - 1920) / 2, y = ((d.y - T * vy * z) % H + H) % H - (H - 1080) / 2, s = sizeOf(d);
    c.globalAlpha = alphaOf(d, T); c.drawImage(sprite(d.col), x - s / 2, y - s / 2, s, s); }
  c.restore();
}
function vignette(c) { const g = c.createRadialGradient(960, 540, 380, 960, 540, 1150); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = g; c.fillRect(0, 0, 1920, 1080); }

// film time → shot + design time
const FILM = (() => { let f = 0; return SHOTS.map(s => { const d = (s.end - s.start) * (s.sx || 1), o = { a: f, b: f + d }; f += d; return o; }); })();
export const DUR = FILM[FILM.length - 1].b;
export const toFilm = (i, t) => FILM[i].a + (t - SHOTS[i].start) * (SHOTS[i].sx || 1);
// the one timing table → Present mode slides (meta.shots) and review times; `stop` is each beat's settled frame
export const BEATS = beats(SHOTS.map((s, i) => ({ title: s.slide ?? s.title, end: FILM[i].b, stop: toFilm(i, s.stop) })));
export function frame(c, T, assets) {
  A = assets; GLX = assets.glx; GLP = assets.glp;
  T = clamp(T, 0, DUR - .001);
  const i = FILM.findIndex(f => T < f.b), s = SHOTS[i], t = s.start + (T - FILM[i].a) / (s.sx || 1);
  c.save();
  ground(c, T);
  fieldLayer(c, T);
  const u = T - FILM[i].a, pv = SHOTS[i - 1];
  if (s.xf && u < s.xf && FNS[i - 1] !== FNS[i]) { c.save(); FNS[i - 1](c, pv.end + u / (pv.sx || 1)); c.restore(); }
  c.save(); FNS[i](c, t); c.restore();
  drift(c, T, BOKEH, 26, 10, 2400, 1500, d => d.a, d => d.s);
  vignette(c);
  c.restore();
}

// ---------- Setup: paint the deep-space ground and one soft sprite per star colour ----------
let A; // canvases from setup (ctx.assets), handed in by frame()
export function prepareWorld(make) {
  const sprites = {};
  for (const col of ['#CFF1EC', '#FFFFFF', '#B7A6F6', '#12B5A5']) sprites[col] = paintSprite(col, make);
  return { ground: paintGround(make), sprites };
}
