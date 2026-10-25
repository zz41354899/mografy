// @ts-nocheck
// Why I built Mografy: drawing for every shot (ported from storyboards/board-src, storyboard v3).
// Pure function of time on a 1920 × 1080 logical canvas. SHOTS is the one timing table: each shot's design times, `sx` to
// play a shot slower, `xf` to overlap it with the previous one, and `stop`, its settled frame in film seconds (Present mode).
import { beats, clamp, ease, lerp, pr as P } from '@mografy/runtime';
import { LOGO_PIECES } from './logo.js';

export const SHOTS = [
  { id: 'S01', start: 0, end: 4.5, key: 3.4, stop: 3.4, thumbs: [0.6, 1.6, 4.2], title: '一個問題',
    caps: [],
    action: '暗色底。畫面中央逐字打出大標「AI 能做好 Motion Graphics 嗎？」（0.8–3.0），青色游標閃爍。',
    trans: '3.9–4.5 標題往上淡出，下方的 Prompt 輸入框升起。' },
  { id: 'S02', start: 4.5, end: 9, xf: .5, key: 8.0, stop: 8.2, thumbs: [5.2, 6.4, 7.3], title: '一句 Prompt 就有影片',
    caps: [[5.0, '一句 Prompt，就能生成一支完整的影片。']],
    action: '輸入框打出「做一支產品介紹影片」，游標點送出（5.9）。上方出現一個暗色的「AI 影片生成器」框，轉圈 6.0–7.0，接著影片從中心圓形展開（7.0–7.6）：標題、三張卡片、青色圓，底下進度條開始跑。',
    trans: '8.4–9 輸入框往下淡出，影片往中間靠。' },
  { id: 'S03', start: 9, end: 13, key: 12.0, stop: 12.2, thumbs: [9.4, 10.4, 11.6], title: '做出來之後呢？',
    caps: [],
    action: '影片縮小置中，上方浮出大字「做出來之後，還能控制它嗎？」（「控制它」青色）。游標想點選影片裡的標題（11.4），影片角落跳出鎖頭並輕晃，標籤「MP4 · 無法單獨修改」。',
    trans: '13.0 影片滑到左側，大字淡出。' },
  { id: 'S04', start: 13, end: 18.5, key: 17.9, stop: 18.2, thumbs: [13.9, 14.6, 16.2], title: '每次修改都重新生成',
    caps: [[13.4, '只是一個小修改，卻得整支重新生成。']],
    action: '右側一句句跳出修改要求：「這個標題晚 0.5 秒出現。」（13.6）「這個轉場太快了。」（14.8）「品牌色換成另外一組。」（16.0）「其他地方都不要動，只改這一段。」（17.2）。右側是「修改要求」對話面板。每句出現後 0.5 秒，影片蒙上一層暗、中央的重新生成箭頭轉一圈，視窗狀態變「生成中…」，舊的宣傳片在轉圈下溶解成一支完全不同的宣傳片：v1 白天薄荷、v2 夜空、v3 暖橘早鳥、v4 紫色編排、v5 黑白雜誌風。標題列的版本號 v1 → v5；影片下方一條說明寫出這次其實變了什麼。',
    trans: '對話泡泡淡出，影片開始複製成一疊版本。' },
  { id: 'S05', start: 18.5, end: 22.5, key: 20.6, stop: 20.6, thumbs: [18.9, 19.4, 21.8], title: '像重做了一支影片',
    caps: [[19.0, '每一次修改，都換來一支不一樣的影片。']],
    action: 'v1–v5 五個版本從影片位置攤開成一疊歪斜的卡片（18.6–19.8），每張排版都不一樣。',
    trans: '20.3 起中央慢慢描出一個立方體的青色邊線，接著補上暗色的面；五個版本從 v5 開始，一張接一張沿弧線落進盒口，每落進一張，邊光就亮一下。立方體從頭到尾緩慢旋轉、輕輕浮動。' },
  { id: 'S06', start: 22.5, end: 27.5, sx: 1.6, key: 24.9, stop: 25.9, thumbs: [23.4, 25.9, 26.8], title: '如果動畫像寫網頁？',
    caps: [[22.7, '答案，藏在 p5.js 與 Canvas 的網頁動畫裡。'], [24.3, '']],
    action: '黑盒子繼續慢慢旋轉，周圍浮出四張小程式碼視窗（sketch.js、index.html、main.js、scene.ts，有行號與語法上色），輕輕漂浮。24.0 大字「如果 Motion Graphics 也可以像寫網頁一樣呢？」。24.7 起四張視窗依序沿弧線落進盒口，邊光一次次亮起。25.75 蓋子沿後緣慢慢掀開，光從盒裡往上升，淺色從盒口擴散，整個世界翻成亮色。',
    trans: '26.2–27.45 光裡長出白色卡片，飛到 S07 的位置（左邊預覽，右邊四張）。' },
  { id: 'S07', start: 27.5, end: 34, key: 31.2, stop: 36.4, thumbs: [27.9, 28.8, 33.4], title: '可以編輯的系統',
    caps: [[27.8, 'Mografy 把動畫拆成場景、時間、參數與元件。'], [31.6, '讓 Claude Code、Codex 建立動畫，即時預覽每一格。']],
    action: '左邊即時預覽，右邊四張卡：場景、時間、參數、元件，虛線從預覽連到每張卡（27.8–28.8）。游標抓住「大小」滑桿往右拖（30.0–31.4），預覽裡的青色圓跟著變大；時間卡的播放頭同步移動。',
    trans: '34.0–35.0 其他卡淡出，「時間」卡放大成下方的大時間軸，預覽縮到右上。' },
  { id: 'S08', start: 34, end: 39, key: 37.6, stop: 40.6, thumbs: [34.7, 35.5, 36.2], title: '只改需要改的地方',
    caps: [[34.3, '哪裡不滿意，就只改那裡。'], [36.7, 'AI 不再是黑盒子，而是你的動態設計協作者。']],
    action: '左上再次出現 S04 那句「這個標題晚 0.5 秒出現。」（34.6）。虛線連到時間軸的「標題」片段（35.3），片段往右滑 0.5 秒並標上「+0.5s」（35.6–36.4）。卡片、圓形、音樂三條軌道變淡並上鎖（35.9 起依序）。預覽裡的標題被青色虛線框起。',
    trans: '38.4–39.0 全部淡出往下沉，下一個鏡頭的卡片隨即升起。' },
  { id: 'S09', start: 39, end: 51, xf: .6, key: 44.6, stop: 53.2, thumbs: [39.6, 41.8, 49.4], title: 'Mografy 想幫助的人',
    caps: [[39.2, '不必取代 After Effects，讓每個人都能開始做動態。'], [41.3, '']],
    action: '四張彩色卡片依序升起（每張間隔 0.18 秒，沒有彈跳）：設計師、獨立開發者、內容創作者、想學動態的人，各有一個部落格插圖。接著每 2.4 秒輪流介紹一位：該張卡片浮起、亮青色邊框、插圖動起來，其他卡片變淡；下方說明條的小三角滑到那張卡片下面，換上這個人的一句話：設計師「用原本的設計思維加上 AI，讓靜態設計動起來。」→ 獨立開發者「沒有動畫團隊，也能用自己的 UI 做產品動畫。」→ 內容創作者「讓文章與活動資訊，變成可重複使用的動態內容。」→ 想學動態的人「先看懂畫面怎麼動，再慢慢理解動畫原理。」',
    trans: '50.4–51.0 卡片與說明條一起往下淡出。' },
  { id: 'S10', start: 46, end: 51, xf: .6, key: 50.2, stop: 58.2, thumbs: [46.6, 47.4, 48.6], title: '用一句話描述動畫',
    caps: [[46.2, '用一句話告訴 AI：'], [48.9, '再從結果裡調整時間、Easing 與節奏。']],
    action: '左邊泡泡「標題從下面滑進來。」（46.3），右邊舞台的標題隨即往上滑入；「三張卡片依序出現。」（47.6），三張卡依序彈出。舞台下方的小時間軸同步長出對應的片段。49.0 起三個標籤：時間 · Easing · Stagger。',
    trans: '50.4–51.0 全部淡出。' },
  { id: 'S11', start: 51, end: 55.5, sx: 1.1, xf: .6, key: 54.4, stop: 63.2, thumbs: [51.6, 52.6, 53.3], title: '最後的決定',
    caps: [],
    action: '四角浮出四個小泡泡：「再慢一點。」「這裡不要動。」「這個節奏比較好。」「只改這裡。」（51.2 起）。52.4 中央大字第一行「讓 AI 負責加速製作，」，53.2 第二行「最後的決定，仍然留在創作者手上。」（「創作者」青色），四個小泡泡退到背景。',
    trans: '55.0–55.5 全部往上淡出。' },
  { id: 'S12', start: 55.5, end: 62.3, xf: .6, key: 61.6, stop: 70.0, slide: 'Mografy', thumbs: [56.0, 57.5, 59.1], title: 'Logo 與網址',
    caps: [],
    action: '中央一個 Prompt 泡泡打出「Logo 最後放大並淡入。」，送出後泡泡收起。接著直接用 Mografy 模板的品牌 Logo 動畫（examples/mografy-brand），改成淺色版：深墨色的拱形與字母、青色緞帶。一筆青色線條沿著緞帶的路徑劃進來並填滿緞帶，兩道拱形帶一點預備動作升起，Logo 標誌先放大置中，再滑到左邊讓「Mografy」字母逐一升起。Logo 下方Mografy 標語「有些想法，值得動起來。」，網址膠囊「www.mografy.app」放在畫面最底部。',
    trans: '停在結尾畫面約 2 秒。' },
];

// ---------- Renderer (1920 × 1080) ----------
const F = '"Inter", "Noto Sans TC", system-ui, sans-serif', M = '"JetBrains Mono", ui-monospace, monospace';
const D = { bg: '#151619', ui: '#1b1d21', raised: '#24262b', line: '#34363b', hair: 'rgba(255,255,255,.08)', text: '#ebe9e4', mute: '#a09e97', faint: '#6f6e69', box: '#0b0c0e' };
const L = { bg: '#F1F7F5', card: '#FFFFFF', stage: '#F5F8F7', line: '#DCE6E3', hair: 'rgba(27,31,36,.07)', ink: '#1B1F24', muted: '#A9B4B1', mute: '#5f6b68' };
const K = { teal: '#12B5A5', deep: '#0A8A7D', mint: '#CFF1EC', yellow: '#FFD45E', coral: '#FF8C69', lilac: '#B7A6F6', sky: '#8FD3FF', violet: '#7B61E8' };
const SYN = { kw: '#c3a6ff', fn: '#7fd0ff', num: '#ffd45e', str: '#ff9c80', pl: '#d8d6d0', cm: '#6f6e69' };
const eo = ease.outCubic;
const eio = ease.inOutCubic;
const back = x => { const c1 = .9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const rnd = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix = (a, b, k) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], k)).toString(16).padStart(2, '0')).join(''); };
const alpha = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
const isLight = t => t >= 26.6;

function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, Math.max(0, w), Math.max(0, h), Math.max(0, Math.min(r, w / 2, h / 2))); }
function box(c, x, y, w, h, r, fill) { rr(c, x, y, w, h, r); c.fillStyle = fill; c.fill(); }
function hair(c, x, y, w, h, r, col, lw = 1.5) { rr(c, x, y, w, h, r); c.lineWidth = lw; c.strokeStyle = col; c.stroke(); }
function dot(c, x, y, r, fill) { c.beginPath(); c.arc(x, y, Math.max(0, r), 0, Math.PI * 2); c.fillStyle = fill; c.fill(); }
// layered soft shadow card (light world)
function card(c, x, y, w, h, r = 22, fill = L.card, sh = 1) {
  c.save(); c.shadowColor = `rgba(16,48,42,${.06 * sh})`; c.shadowBlur = 6; c.shadowOffsetY = 2; box(c, x, y, w, h, r, fill);
  c.shadowColor = `rgba(16,48,42,${.10 * sh})`; c.shadowBlur = 48; c.shadowOffsetY = 20; box(c, x, y, w, h, r, fill); c.restore();
  hair(c, x, y, w, h, r, L.hair, 1);
}
// dark panel with a hairline rim
function panel(c, x, y, w, h, r = 22, fill = D.ui) {
  c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 60; c.shadowOffsetY = 24; box(c, x, y, w, h, r, fill); c.restore();
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(.4, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(255,255,255,.03)');
  rr(c, x + .75, y + .75, w - 1.5, h - 1.5, r); c.lineWidth = 1.5; c.strokeStyle = g; c.stroke();
}
function txt(c, s, x, y, size, color, weight = 700, align = 'center', font = F, ls = 0) {
  c.font = `${weight} ${size}px ${font}`; c.letterSpacing = `${ls}px`; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, x, y); c.letterSpacing = '0px';
}
function tw(c, s, size, weight = 700, font = F, ls = 0) { c.font = `${weight} ${size}px ${font}`; c.letterSpacing = `${ls}px`; const w = c.measureText(s).width; c.letterSpacing = '0px'; return w; }
// centred line made of [text, colour, highlight 0..1] parts; highlight = mint marker swiping in behind the words
function rich(c, parts, x, y, size, weight = 800, ls = -1) {
  const ws = parts.map(([s]) => tw(c, s, size, weight, F, ls)), W = ws.reduce((m, v) => m + v, 0); let cx = x - W / 2;
  parts.forEach(([s, col, hl], i) => { if (hl > 0) { c.save(); box(c, cx - 8, y - size * .12, (ws[i] + 16) * eio(hl), size * .58, 8, alpha(K.teal, .2)); c.restore(); }
    txt(c, s, cx, y, size, col, weight, 'left', F, ls); cx += ws[i]; });
}
function pop(c, x, y, k, fn) { if (k <= 0) return; const s = back(k); c.save(); c.translate(x, y); c.scale(s, s); c.globalAlpha *= clamp(k * 3); fn(); c.restore(); }
function fade(c, k, dy, fn) { if (k <= 0) return; c.save(); c.globalAlpha *= k; c.translate(0, (1 - eo(k)) * dy); fn(); c.restore(); }
function windowDots(c, x, y, dark) { [K.coral, K.yellow, K.teal].forEach((col, i) => dot(c, x + i * 20, y, 6, dark ? '#3a3d43' : col)); }
function cursor(c, x, y, click = 0) {
  if (click > 0 && click < 1) { c.save(); c.globalAlpha *= 1 - click; c.lineWidth = 3; c.strokeStyle = K.teal; c.beginPath(); c.arc(x, y, 10 + click * 36, 0, Math.PI * 2); c.stroke(); c.restore(); }
  c.save(); c.translate(x, y); const s = 1.25 * (1 - Math.sin(clamp(click * 2) * Math.PI) * .15); c.scale(s, s);
  c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 8; c.shadowOffsetY = 3;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 26); c.lineTo(7, 20); c.lineTo(12, 31); c.lineTo(17, 29); c.lineTo(12, 18); c.lineTo(21, 18); c.closePath();
  c.fillStyle = L.ink; c.fill(); c.shadowColor = 'transparent'; c.lineWidth = 2.2; c.strokeStyle = '#fff'; c.lineJoin = 'round'; c.stroke(); c.restore();
}
function lock(c, x, y, col = L.muted, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s); c.strokeStyle = col; c.lineWidth = 3;
  c.beginPath(); c.arc(0, -5, 7, Math.PI, 0); c.stroke(); box(c, -10, -5, 20, 15, 4, col); c.restore();
}
function regen(c, x, y, rot, col = K.coral, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s); c.rotate(rot); c.strokeStyle = col; c.lineWidth = 4.5; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.arc(0, 0, 15, 0.2, Math.PI * 1.6); c.stroke();
  c.beginPath(); c.moveTo(15, -14); c.lineTo(15, 1); c.lineTo(0, 1); c.stroke(); c.restore();
}
function path(t, keys) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 1; i < keys.length; i++) { const [t1, x1, y1] = keys[i]; if (t <= t1) { const [t0, x0, y0] = keys[i - 1], e = eio(P(t, t0, t1)); return [lerp(x0, x1, e), lerp(y0, y1, e)]; } }
  return keys[keys.length - 1].slice(1);
}
function sendBtn(c, x, y, r) {
  const g = c.createLinearGradient(x - r, y - r, x + r, y + r); g.addColorStop(0, '#19c9b7'); g.addColorStop(1, K.deep); dot(c, x, y, r, g);
  c.beginPath(); c.moveTo(x, y + r * .42); c.lineTo(x, y - r * .42); c.moveTo(x - r * .34, y - r * .1); c.lineTo(x, y - r * .45); c.lineTo(x + r * .34, y - r * .1);
  c.strokeStyle = '#fff'; c.lineWidth = r * .14; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
}
// chat bubble; align 'left' anchors x at the left edge, 'right' at the right edge, 'center' at the middle
function bubble(c, s, x, y, k, o = {}) {
  if (k <= 0) return;
  const size = o.size || 32, light = o.light ?? true, pad = size * .85, h = size * 2.05;
  const w = tw(c, s, size, 500) + pad * 2 + (o.send ? h * .8 : 0);
  const left = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x, r = h * .42;
  c.save(); c.globalAlpha *= clamp(k * 2.5); c.translate(left + w / 2, y + h / 2); const sc = .88 + .12 * back(k); c.scale(sc, sc); c.translate(-(left + w / 2), -(y + h / 2 - (1 - eo(k)) * 14));
  const fill = o.fill || (light ? L.card : D.raised);
  if (light) card(c, left, y, w, h, r, fill, .9); else { box(c, left, y, w, h, r, fill); hair(c, left, y, w, h, r, D.hair); }
  const shown = o.typed != null ? s.slice(0, Math.round(s.length * o.typed)) : s;
  txt(c, shown, left + pad, y + h / 2 + 1, size, o.ink || (light ? L.ink : D.text), 500, 'left');
  if (o.typed != null && o.typed < 1) box(c, left + pad + tw(c, shown, size, 500) + 4, y + h * .25, 3, h * .5, 1.5, K.teal);
  if (o.send) sendBtn(c, left + w - h * .52, y + h / 2, h * .3);
  if (o.label && (o.labelA ?? 1) > 0) { c.save(); c.globalAlpha *= o.labelA ?? 1; txt(c, o.label, o.align === 'right' ? left + w - 6 : left + 6, y - 22, 18, light ? L.muted : D.faint, 500, o.align === 'right' ? 'right' : 'left', M, 1); c.restore(); }
  c.restore();
  return { x: left, y, w, h };
}
function caption(c, s, a, light) {
  if (!s || a <= 0) return;
  c.save(); c.globalAlpha *= a; const w = tw(c, s, 34, 500, F, 1) + 76, y = 996 + (1 - eo(a)) * 16;
  if (light) { card(c, 960 - w / 2, y - 34, w, 68, 34, 'rgba(255,255,255,.94)', .7); }
  else { box(c, 960 - w / 2, y - 34, w, 68, 34, 'rgba(14,15,17,.78)'); hair(c, 960 - w / 2, y - 34, w, 68, 34, D.hair); }
  txt(c, s, 960, y + 1, 34, light ? L.ink : D.text, 500, 'center', F, 1); c.restore();
}

// ---- ground: radial light, dot grid, film grain ----
function ground(c, light) {
  const g = c.createRadialGradient(960, 430, 60, 960, 520, 1250);
  if (light) { g.addColorStop(0, '#FBFDFC'); g.addColorStop(1, '#E4EEEA'); } else { g.addColorStop(0, '#1e2025'); g.addColorStop(1, '#0b0c0e'); }
  c.fillStyle = g; c.fillRect(0, 0, 1920, 1080);
  c.fillStyle = light ? 'rgba(27,31,36,.05)' : 'rgba(255,255,255,.035)';
  for (let x = 48; x < 1920; x += 48) for (let y = 36; y < 1080; y += 48) c.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
}

// ---- brand logo (paths traced from docs/brand, via packages/web/src/logo.ts) ----

const LOGO = LOGO_PIECES.map(p => ({ ...p, path: new Path2D(p.d) }));
const LOGO_VB = [13.2, 24.5, 1136.5, 203.5], MARK_W = 392.5;

// ---- the little launch film every shot reuses, laid out in a 960 × 540 box ----
const PAL = [K.teal, K.coral, K.yellow, K.lilac, K.sky];
const BGS = ['#E3F4F0', '#FFF1D1', '#FFE6DD', '#ECE7FF', '#E1EEFF'];
const FEAT = ['調光', '定時', '省電'];
// The made film is an "Aurora 智慧燈" product promo. Every regeneration comes back as a different promo:
// v1 day (mint), v2 night (navy), v3 sunset (peach), v4 violet editorial, v5 monochrome magazine.
const STY = [
  { style: 'day', tx: 64, ty: 92, ts: 60, cx: 740, cy: 222, cr: 100, kx: 64, ky: 300, col: [K.teal, K.yellow, K.lilac, K.coral], bg: '#E3F4F0' },
  { style: 'night', tx: 480, ty: 392, ts: 62, cx: 480, cy: 186, cr: 86, kx: 0, ky: 0, col: ['#FFC861', K.yellow, K.sky, K.coral], bg: '#1A2747' },
  { style: 'sunset', tx: 520, ty: 196, ts: 76, cx: 262, cy: 236, cr: 126, kx: 0, ky: 0, col: ['#FF9466', K.yellow, K.coral, K.lilac], bg: '#FFC7AE' },
  { style: 'violet', tx: 52, ty: 456, ts: 46, cx: 480, cy: 222, cr: 100, kx: 0, ky: 0, col: [K.violet, K.lilac, K.sky, '#F5A3D9'], bg: '#DCD1FF' },
  { style: 'mono', tx: 56, ty: 150, ts: 108, cx: 770, cy: 196, cr: 80, kx: 0, ky: 0, col: ['#3A3F46', '#1B1F24', '#1B1F24', '#1B1F24'], bg: '#F2EFEA' },
];
const layout = seed => ({ ...STY[seed < STY.length ? seed : (seed - 3) % STY.length] });
function lerpLayout(a, b, k) {
  const o = {}; for (const key in a) o[key] = key === 'col' ? a.col.map((v, i) => mix(v, b.col[i], k)) : key === 'bg' ? mix(a.bg, b.bg, k) : typeof a[key] === 'number' ? lerp(a[key], b[key], k) : (k < .5 ? a : b)[key];
  return o;
}
function glyph(c, i, s, col = '#fff') { // feature icons: sun, clock, bolt
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2.6 * s; c.lineCap = 'round';
  if (i === 0) { dot(c, 0, 0, 6 * s, col); for (let a = 0; a < 8; a++) { const q = a * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(q) * 10 * s, Math.sin(q) * 10 * s); c.lineTo(Math.cos(q) * 14 * s, Math.sin(q) * 14 * s); c.stroke(); } }
  if (i === 1) { c.beginPath(); c.arc(0, 0, 12 * s, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(0, -7 * s); c.lineTo(0, 0); c.lineTo(5 * s, 4 * s); c.stroke(); }
  if (i === 2) { c.beginPath(); c.moveTo(3 * s, -14 * s); c.lineTo(-8 * s, 2 * s); c.lineTo(-1 * s, 2 * s); c.lineTo(-3 * s, 14 * s); c.lineTo(8 * s, -2 * s); c.lineTo(1 * s, -2 * s); c.closePath(); c.fill(); }
}
// the product: a glass globe lamp on a short base, with its own light around it
function lamp(c, x, y, r, col, base, halo = .3) {
  const hg = c.createRadialGradient(x, y, r * .5, x, y, r * 2.8); hg.addColorStop(0, alpha(col, halo)); hg.addColorStop(1, alpha(col, 0)); c.fillStyle = hg; c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  c.save(); c.globalAlpha *= .22; c.beginPath(); c.ellipse(x, y + r * 1.38, r * .82, r * .1, 0, 0, Math.PI * 2); c.fillStyle = '#000'; c.fill(); c.restore();
  const bw = r * 1.04, by = y + r * .88, bg = c.createLinearGradient(x - bw / 2, 0, x + bw / 2, 0); bg.addColorStop(0, mix(base, '#ffffff', .3)); bg.addColorStop(.6, base); bg.addColorStop(1, mix(base, '#000000', .25));
  box(c, x - bw / 2, by, bw, r * .46, r * .12, bg); box(c, x - bw * .42, by + r * .13, bw * .84, r * .05, r * .025, alpha(col, .9));
  const og = c.createRadialGradient(x - r * .34, y - r * .4, r * .06, x, y, r); og.addColorStop(0, '#ffffff'); og.addColorStop(.4, mix(col, '#ffffff', .55)); og.addColorStop(1, col); dot(c, x, y, r, og);
  c.save(); c.globalAlpha *= .3; c.lineWidth = 2; c.strokeStyle = col; c.beginPath(); c.arc(x, y, r * 1.3, 0, Math.PI * 2); c.stroke(); c.restore();
}
const pill = (c, x, y, w, h, fill, label, col, size = 18, font = F, wt = 700) => { box(c, x, y, w, h, h / 2, fill); txt(c, label, x + w / 2, y + h / 2 + 1, size, col, wt, 'center', font); };
function scene(c, x, y, w, h, lay, o = {}) {
  c.save(); rr(c, x, y, w, h, 14 * w / 960); c.clip(); c.translate(x, y); c.scale(w / 960, h / 540);
  const st = lay.style || 'day', ti = o.title ?? 1, tdy = o.titleDy ?? 0, ts = lay.ts, r = lay.cr * (o.circleS ?? 1), pl = o.play ?? .5;
  const breathe = .28 + .06 * Math.sin(pl * 14);
  if (st === 'day') {
    const g = c.createLinearGradient(0, 0, 960, 540); g.addColorStop(0, mix(lay.bg, '#ffffff', .45)); g.addColorStop(1, lay.bg); c.fillStyle = g; c.fillRect(0, 0, 960, 540);
    if (o.circle !== 0) lamp(c, lay.cx, lay.cy, r, lay.col[0], '#E9F0EE', breathe);
    c.save(); c.globalAlpha *= ti; c.translate(0, tdy);
    const ew = tw(c, 'NEW · 春季新品', 16, 600, M, 1) + 28; box(c, lay.tx, lay.ty - ts * .5 - 46, ew, 30, 15, 'rgba(255,255,255,.8)');
    txt(c, 'NEW · 春季新品', lay.tx + 14, lay.ty - ts * .5 - 30, 16, K.deep, 600, 'left', M, 1);
    txt(c, 'Aurora 智慧燈', lay.tx, lay.ty, ts, L.ink, 900, 'left', F, -1);
    txt(c, '讓每個夜晚都剛剛好', lay.tx + 2, lay.ty + ts * .5 + 30, 24, L.mute, 500, 'left');
    c.restore();
    [0, 1, 2].forEach(i => { const k = o.cards ? o.cards[i] : 1; if (k <= 0) return;
      c.save(); c.globalAlpha *= clamp(k * 2); c.translate(lay.kx + i * 166 + 74, lay.ky + 84 + (1 - eo(k)) * 40);
      c.shadowColor = 'rgba(16,48,42,.12)'; c.shadowBlur = 24; c.shadowOffsetY = 10; box(c, -74, -84, 148, 168, 18, '#fff'); c.shadowColor = 'transparent';
      box(c, -52, -62, 48, 48, 14, lay.col[i + 1]); c.save(); c.translate(-28, -38); glyph(c, i, 1); c.restore();
      txt(c, FEAT[i], -52, 22, 24, L.ink, 700, 'left'); box(c, -52, 48, 96, 8, 4, L.line); box(c, -52, 48, 40 + i * 22, 8, 4, lay.col[i + 1]); c.restore(); });
    const ca = o.cta ?? (o.cards ? o.cards[2] : 1); if (ca > 0 && lay.ky > 200) { c.save(); c.globalAlpha *= clamp(ca);
      const cx0 = lay.cx - 120, cy0 = lay.cy + r * 1.62 + 30; txt(c, 'NT$ 1,990', cx0, cy0 + 22, 26, L.ink, 800, 'left'); txt(c, '起', cx0 + tw(c, 'NT$ 1,990', 26, 800) + 6, cy0 + 24, 16, L.mute, 600, 'left');
      pill(c, cx0 + 172, cy0, 120, 44, K.teal, '立即預購', '#fff', 18); c.restore(); }
  } else if (st === 'night') {
    const g = c.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, '#0E1630'); g.addColorStop(1, '#22325A'); c.fillStyle = g; c.fillRect(0, 0, 960, 540);
    for (let i = 0; i < 34; i++) dot(c, rnd(i + 40) * 960, rnd(i + 80) * 300, .8 + rnd(i + 120) * 1.4, `rgba(255,255,255,${.25 + rnd(i + 160) * .4})`);
    lamp(c, lay.cx, lay.cy, r, lay.col[0], '#2C3A62', breathe + .18);
    c.save(); c.globalAlpha *= ti; c.translate(0, tdy);
    pill(c, 48, 36, 92, 30, 'rgba(255,255,255,.1)', 'NEW', '#FFD98A', 15, M, 600);
    txt(c, 'Aurora 智慧燈', lay.tx, lay.ty, ts, '#ffffff', 900, 'center', F, -1);
    txt(c, '夜晚的第一道光', lay.tx, lay.ty + 52, 24, '#AFC0E6', 500, 'center', F, 2);
    c.restore();
    FEAT.forEach((f, i) => { const fx = 480 + (i - 1) * 150; dot(c, fx - 34, 496, 15, alpha(lay.col[i + 1], .9)); c.save(); c.translate(fx - 34, 496); glyph(c, i, .6, '#1A2747'); c.restore(); txt(c, f, fx - 12, 497, 20, '#E4EAF7', 600, 'left'); });
  } else if (st === 'sunset') {
    const g = c.createLinearGradient(0, 0, 960, 540); g.addColorStop(0, '#FFEBDD'); g.addColorStop(1, '#FFB08E'); c.fillStyle = g; c.fillRect(0, 0, 960, 540);
    dot(c, lay.cx + 40, lay.cy - 30, r * 1.9, 'rgba(255,255,255,.28)');
    lamp(c, lay.cx, lay.cy, r, lay.col[0], '#FFF4EC', breathe);
    c.save(); c.globalAlpha *= ti; c.translate(0, tdy);
    txt(c, '早鳥限定', lay.tx + 2, lay.ty - 92, 18, '#C2532C', 700, 'left', F, 3);
    txt(c, 'Aurora', lay.tx, lay.ty - 36, ts, L.ink, 900, 'left', F, -2); txt(c, '智慧燈', lay.tx, lay.ty + 48, ts, L.ink, 900, 'left', F, -2);
    txt(c, '一盞燈，換一種心情', lay.tx + 2, lay.ty + 118, 24, '#7A4A38', 500, 'left');
    c.restore();
    txt(c, 'NT$ 1,990', lay.tx, 410, 36, L.ink, 800, 'left'); pill(c, lay.tx + 200, 386, 168, 50, L.ink, '立即預購  →', '#fff', 19);
    txt(c, '調光 · 定時 · 省電', lay.tx + 2, 476, 18, '#8A5B48', 600, 'left', F, 2);
  } else if (st === 'violet') {
    const g = c.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, '#F1EDFF'); g.addColorStop(1, lay.bg); c.fillStyle = g; c.fillRect(0, 0, 960, 540);
    txt(c, 'AURORA', 480, 236, 196, 'rgba(255,255,255,.62)', 900, 'center', F, 6);
    lamp(c, lay.cx, lay.cy, r, lay.col[0], '#FFFFFF', breathe);
    pill(c, 812, 30, 118, 32, 'rgba(255,255,255,.75)', '2026 新色', K.violet, 15, F, 700);
    c.save(); c.globalAlpha *= ti; c.translate(0, tdy);
    txt(c, 'Aurora 智慧燈', lay.tx, lay.ty, ts, L.ink, 900, 'left', F, -1); txt(c, '換上你的顏色', lay.tx + 2, lay.ty + 42, 20, '#6B5FA8', 600, 'left');
    c.restore();
    FEAT.forEach((f, i) => { const px = 600 + i * 118; box(c, px, 440, 106, 40, 20, 'rgba(255,255,255,.8)'); dot(c, px + 22, 460, 7, lay.col[i + 1]); txt(c, f, px + 38, 461, 18, L.ink, 700, 'left'); });
  } else { // mono
    c.fillStyle = lay.bg; c.fillRect(0, 0, 960, 540);
    box(c, 56, 64, 848, 1.5, 0, 'rgba(27,31,36,.25)'); box(c, 56, 420, 848, 1.5, 0, 'rgba(27,31,36,.25)');
    txt(c, 'AURORA / 2026', 56, 42, 14, L.ink, 600, 'left', M, 2); txt(c, 'NO. 05', 904, 42, 14, L.ink, 600, 'right', M, 2);
    lamp(c, lay.cx, lay.cy, r, lay.col[0], '#1B1F24', .12);
    c.save(); c.globalAlpha *= ti; c.translate(0, tdy);
    txt(c, 'Aurora', lay.tx - 4, lay.ty, ts, L.ink, 900, 'left', F, -4); txt(c, '智慧燈', lay.tx, lay.ty + 112, 86, L.ink, 900, 'left', F, -2);
    txt(c, '光，剛剛好。', lay.tx + 2, lay.ty + 196, 24, '#6E6A63', 500, 'left', F, 2);
    c.restore();
    FEAT.forEach((f, i) => { const fx = 56 + i * 220; txt(c, `0${i + 1}`, fx, 470, 15, '#8A867E', 600, 'left', M, 1); txt(c, f, fx + 36, 470, 24, L.ink, 800, 'left'); });
  }
  if (o.play != null) { box(c, 0, 532, 960, 8, 0, 'rgba(27,31,36,.12)'); box(c, 0, 532, 960 * o.play, 8, 0, st === 'mono' ? L.ink : st === 'night' ? '#FFC861' : K.teal); }
  if (o.mark) { c.save(); c.setLineDash([12, 10]); c.lineWidth = 4; c.strokeStyle = K.teal; c.globalAlpha *= o.mark;
    rr(c, lay.tx - 18, lay.ty - ts * .5 - 60 + tdy, tw(c, 'Aurora 智慧燈', ts, 900, F, -1) + 36, ts + 120, 16); c.stroke(); c.restore(); }
  c.restore();
}

// ---- shots ----
const H1 = 'AI 能做好 Motion Graphics 嗎？';
function s01(c, t) {
  const out = eio(P(t, 4.1, 4.95)), sc = 1 - out * .04;
  c.save(); c.globalAlpha *= 1 - out; c.translate(960, 470); c.scale(sc, sc); c.translate(-960, -470);
  const full = tw(c, H1, 74, 800, F, -1), x0 = 960 - full / 2, n = Math.round(H1.length * P(t, .8, 3.0)), s = H1.slice(0, n);
  txt(c, s, x0, 470, 74, D.text, 800, 'left', F, -1);
  if ((Math.floor(t * 2.2) % 2 === 0 || n < H1.length || t > 3.8) && t < 4.3) box(c, x0 + tw(c, s, 74, 800, F, -1) + 10, 430, 5, 80, 2.5, K.teal);
  c.restore();
  // the caret leaves the headline and drops into the prompt field below
  const fl = eio(P(t, 4.3, 4.95)); if (t >= 4.3 && t < 4.95) { const w = lerp(5, 3, fl), h = lerp(80, 34, fl), x = lerp(x0 + full + 10, 556, fl), y = lerp(430, 800, fl);
    c.save(); c.shadowColor = K.teal; c.shadowBlur = 16; box(c, x, y, w, h, w / 2, K.teal); c.restore(); }
}
const BOX0 = { x: 500, y: 160, w: 920, h: 517.5 }, BOX1 = { x: 600, y: 300, w: 720, h: 405 }, BOX2 = { x: 110, y: 250, w: 1040, h: 585 };
const lerpR = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) });
function generator(c, r, t, o = {}) { // "AI video generator" window with the made film inside
  const s = r.w / 920, bar = 50 * s;
  panel(c, r.x - 14 * s, r.y - bar, r.w + 28 * s, r.h + bar + 14 * s, 24 * s);
  windowDots(c, r.x + 14 * s, r.y - bar / 2, true);
  c.save(); c.globalAlpha *= o.chromeA ?? 1; // S04 lets the title and status go before the window becomes a version card
  txt(c, 'AI 影片生成器', r.x + r.w / 2, r.y - bar / 2, 19 * s, D.mute, 500, 'center', M, 1);
  const busy = o.busy ?? (t < 7.0), st = busy ? '生成中…' : '已完成 · 00:15', sw = tw(c, st, 16 * s, 600, M) + 36 * s;
  box(c, r.x + r.w - sw, r.y - bar / 2 - 14 * s, sw, 28 * s, 14 * s, busy ? 'rgba(255,212,94,.14)' : 'rgba(18,181,165,.16)');
  dot(c, r.x + r.w - sw + 14 * s, r.y - bar / 2, 4 * s, busy ? K.yellow : K.teal); txt(c, st, r.x + r.w - sw + 24 * s, r.y - bar / 2, 16 * s, busy ? K.yellow : K.teal, 600, 'left', M); c.restore();
  box(c, r.x, r.y, r.w, r.h, 12 * s, D.box);
  const spin = P(t, 6.0, 7.0), rev = eio(P(t, 7.0, 7.6));
  if (spin > 0 && rev < 1 && !o.lay) { c.save(); c.globalAlpha *= 1 - rev; const cx = r.x + r.w / 2, cy = r.y + r.h / 2 - 20;
    c.lineWidth = 6; c.strokeStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.arc(cx, cy, 40, 0, Math.PI * 2); c.stroke();
    c.lineCap = 'round'; c.strokeStyle = K.teal; c.beginPath(); const a = t * 5; c.arc(cx, cy, 40, a, a + 2.2); c.stroke();
    txt(c, `正在生成影片… ${Math.round(spin * 100)}%`, cx, cy + 82, 22, D.mute, 500, 'center'); c.restore(); }
  if (rev > 0 || o.lay) { c.save(); c.beginPath(); c.arc(r.x + r.w / 2, r.y + r.h / 2, (o.lay ? 1 : rev) * r.w * .62, 0, Math.PI * 2); c.clip();
    scene(c, r.x, r.y, r.w, r.h, o.lay || layout(0), { play: o.play ?? clamp((t - 7.6) / 9) });
    if (o.lay2 && o.mixK > 0) { c.save(); c.globalAlpha *= o.mixK; scene(c, r.x, r.y, r.w, r.h, o.lay2, { play: o.play ?? 0 }); c.restore(); }
    c.restore(); }
}
function s02(c, t) {
  const bar = eo(P(t, 4.5, 4.95)) * (1 - eio(P(t, 8.4, 9.0)));
  if (bar > 0) { c.save(); c.globalAlpha *= bar; c.translate(0, (1 - bar) * 24);
    panel(c, 460, 770, 1000, 92, 46, '#1c1e22');
    box(c, 486, 792, 48, 48, 14, 'rgba(18,181,165,.16)'); txt(c, 'AI', 510, 817, 18, K.teal, 700, 'center', M);
    const p = '做一支產品介紹影片', n = Math.round(p.length * P(t, 5.0, 5.7));
    txt(c, n ? p.slice(0, n) : '描述你想要的影片…', 554, 817, 32, n ? D.text : D.faint, 500, 'left');
    if (t >= 4.95 && n < p.length) box(c, n ? 554 + tw(c, p.slice(0, n), 32, 500) + 4 : 556, 800, 3, 34, 1.5, K.teal); // the caret that dropped in from the headline
    sendBtn(c, 1412, 816, 26); c.restore(); }
  const gk = eo(P(t, 5.9, 6.5));
  if (gk > 0) { c.save(); c.globalAlpha *= gk; const s = .96 + .04 * gk; c.translate(960, 420); c.scale(s, s); c.translate(-960, -420); generator(c, BOX0, t); c.restore(); }
  if (t > 5.2 && t < 6.6) { const [x, y] = path(t, [[5.2, 1520, 1040], [5.8, 1414, 820]]); cursor(c, x, y, P(t, 5.9, 6.3) * (t < 6.3 ? 1 : 0)); }
}
function s03(c, t) {
  const k = eio(P(t, 9.0, 9.8)), r = lerpR(BOX0, BOX1, k), out = eio(P(t, 12.1, 13.0));
  generator(c, lerpR(r, BOX2, out), t);
  fade(c, P(t, 9.4, 10.0) * (1 - P(t, 12.1, 12.7)), 20, () => rich(c, [['做出來之後，還能', D.text], ['控制它', K.teal], ['嗎？', D.text]], 960, 150, 62));
  if (t > 10.4 && t < 12.6) { const [x, y] = path(t, [[10.4, 1500, 960], [11.2, 760, 410]]); c.save(); c.globalAlpha *= 1 - P(t, 12.1, 12.5); cursor(c, x, y, P(t, 11.4, 11.8)); c.restore(); }
  const lk = P(t, 11.5, 11.9); if (lk > 0 && out < 1) { c.save(); c.globalAlpha *= 1 - out;
    const sh = Math.sin(P(t, 11.6, 12.1) * Math.PI * 6) * 8 * (1 - P(t, 11.6, 12.1));
    pop(c, BOX1.x + BOX1.w - 46 + sh, BOX1.y + 46, lk, () => { c.save(); c.shadowColor = 'rgba(255,140,105,.5)'; c.shadowBlur = 24; dot(c, 0, 0, 34, K.coral); c.restore(); lock(c, 0, 2, '#fff', 1.1); });
    fade(c, P(t, 11.8, 12.2), 10, () => { const s = 'MP4 · 無法單獨修改', w = tw(c, s, 20, 500, M, 1) + 40, x = BOX1.x + BOX1.w - w, y = BOX1.y + BOX1.h + 30;
      box(c, x, y, w, 44, 22, D.raised); hair(c, x, y, w, 44, 22, D.hair); txt(c, s, x + w / 2, y + 23, 20, D.text, 500, 'center', M, 1); });
    c.restore(); }
}
const ASKS = ['這個標題晚 0.5 秒出現。', '這個轉場太快了。', '品牌色換成另外一組。', '其他地方都不要動，只改這一段。'];
const ASK_T = [13.6, 14.8, 16.0, 17.2], REGEN_T = ASK_T.map(a => a + .5);
function versionAt(t) {
  let k = 0; REGEN_T.forEach(a => { if (t >= a) k++; });
  const p = k ? eio(P(t, REGEN_T[k - 1], REGEN_T[k - 1] + .6)) : 1;
  const q = k ? eio(P(p, .3, .72)) : 1; // the old promo dissolves into the new one under the regenerate spinner
  return { k, p, q, lay: k && q < 1 ? layout(k - 1) : layout(k), lay2: k && q < 1 ? layout(k) : null };
}
const CHAT = { x: 1240, y: 200, w: 580, h: 640 };
const RESULT = ['標題晚了 0.5 秒，但版面、配色、文案也全變了。', '轉場慢下來了，整支影片卻換成另一種風格。', '品牌色換了，連排版、字體與產品角度也跟著變。', '說好只改這一段，整支影片還是重新來過。'];
function resultStrip(c, t) {
  const r = BOX2, y = r.y + r.h + 30, out = 1 - P(t, 18.1, 18.45);
  RESULT.forEach((s, j) => { const a = eo(P(t, REGEN_T[j] + .45, REGEN_T[j] + .85)) * (j < 3 ? 1 - P(t, REGEN_T[j + 1], REGEN_T[j + 1] + .3) : 1) * out; if (a <= 0) return;
    c.save(); c.globalAlpha *= a; c.translate(0, (1 - a) * 10); panel(c, r.x, y, r.w, 62, 31, '#1b1d21');
    pill(c, r.x + 14, y + 13, 64, 36, 'rgba(255,140,105,.16)', `v${j + 2}`, K.coral, 18, M, 700);
    txt(c, s, r.x + 98, y + 32, 25, D.text, 500, 'left');
    regen(c, r.x + r.w - 40, y + 31, 0, K.coral, .55); c.restore(); });
}
function s04(c, t) {
  const { k, p, q, lay, lay2 } = versionAt(t), r = BOX2;
  generator(c, r, t, { lay, lay2, mixK: q, chromeA: 1 - P(t, 18.0, 18.45), busy: k > 0 && p < 1, play: k ? clamp((t - REGEN_T[k - 1] - .4) / 6) : clamp((t - 7.6) / 9) });
  const vk = eo(P(t, 13.3, 13.7));
  fade(c, vk, 0, () => { const by = r.y - 50 * r.w / 920 / 2; box(c, r.x + 84, by - 17, 66, 34, 17, k ? 'rgba(255,140,105,.18)' : 'rgba(255,255,255,.1)'); txt(c, `v${k + 1}`, r.x + 117, by + 1, 20, k ? K.coral : D.text, 700, 'center', M); }); // version chip in the title bar
  if (k && p < 1) { c.save(); c.globalAlpha *= Math.sin(p * Math.PI); c.fillStyle = 'rgba(11,12,14,.38)'; rr(c, r.x, r.y, r.w, r.h, 12); c.fill();
    c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 20; dot(c, r.x + r.w / 2, r.y + r.h / 2, 52, '#fff'); c.shadowColor = 'transparent'; regen(c, r.x + r.w / 2, r.y + r.h / 2, p * Math.PI * 2, K.coral, 1.7); c.restore(); }
  resultStrip(c, t);
  const ck = eo(P(t, 13.2, 13.7)) * (1 - P(t, 18.2, 18.5));
  if (ck > 0) { c.save(); c.globalAlpha *= ck; c.translate((1 - ck) * 40, 0); const q = CHAT;
    panel(c, q.x, q.y, q.w, q.h, 24); txt(c, '修改要求', q.x + 32, q.y + 40, 22, D.text, 700, 'left'); txt(c, `${Math.min(4, ASK_T.filter(a => t >= a).length)} / 4`, q.x + q.w - 32, q.y + 40, 18, D.faint, 500, 'right', M);
    box(c, q.x, q.y + 76, q.w, 1.5, 0, D.hair);
    ASKS.forEach((s, i) => bubble(c, s, q.x + q.w - 28, q.y + 110 + i * 128, P(t, ASK_T[i], ASK_T[i] + .45), { align: 'right', size: 28, fill: '#e8f7f4', label: `你 · v${i + 1} 之後` }));
    c.restore(); }
}
// ---- the black box: a real 3D cube seen from above, turning very slowly; teal rim; the lid swings up on its back hinge ----
const BOX = { cx: 960, cy: 545, s: 104 }, BOX_PITCH = .5;
const boxYaw = t => -.66 + (t - 20.2) * .042, boxBob = t => Math.sin((t - 20.2) * .9) * 6;
const CUBE_V = [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]];
const CUBE_E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
const CUBE_F = [{ v: [3, 2, 6, 7], n: [0, 0, 1] }, { v: [1, 0, 4, 5], n: [0, 0, -1] }, { v: [2, 1, 5, 6], n: [1, 0, 0] }, { v: [0, 3, 7, 4], n: [-1, 0, 0] }];
function boxCam(t) {
  const yaw = boxYaw(t), cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(BOX_PITCH), sp = Math.sin(BOX_PITCH), cy = BOX.cy + boxBob(t);
  const rot = ([x, y, z]) => { const xr = x * cyw - z * syw, zr = x * syw + z * cyw; return [xr, y * cp - zr * sp, y * sp + zr * cp]; };
  const proj = p => { const [x, y, d] = rot(p); return [BOX.cx + x * BOX.s, cy - y * BOX.s, d]; };
  return { rot, proj, cy };
}
// where things fall into the box: just above the middle of the lid
const boxMouth = t => { const [x, y] = boxCam(t).proj([0, 1, 0]); return [x, y - 6]; };
// pulses of rim light, one per thing that drops into the box
const pulse = (t, arr) => arr.reduce((m, a) => m + Math.exp(-Math.pow((t - a) / .22, 2)) * (t > a - .5 ? 1 : 0), 0);
function cube3(c, t, o) { // o: wire 0..1 (edges trace in), body 0..1 (faces fill), open 0..1, glow, a
  const { rot, proj, cy } = boxCam(t), V = CUBE_V.map(proj), s = BOX.s, a = o.a ?? 1, body = o.body ?? 1, wire = o.wire ?? 1, open = o.open || 0, glow = o.glow || 0;
  if (a <= 0) return;
  c.save(); c.globalAlpha *= a;
  // floor light under the box
  const [fx, fy] = proj([0, -1, 0]), fl = c.createRadialGradient(fx, fy + 18, 0, fx, fy + 18, s * 2.6);
  fl.addColorStop(0, `rgba(18,181,165,${(.16 + .1 * glow + .25 * open) * wire})`); fl.addColorStop(1, 'rgba(18,181,165,0)');
  c.fillStyle = fl; c.beginPath(); c.ellipse(fx, fy + 18, s * 2.6, s * 2.6 * Math.sin(BOX_PITCH) * .9, 0, 0, Math.PI * 2); c.fill();
  // faces (back-face culled), shaded from the upper left
  const quad = (pts, fill) => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fillStyle = fill; c.fill(); };
  const vis = CUBE_F.map(f => ({ ...f, d: rot(f.n)[2], sx: rot(f.n)[0] })).filter(f => f.d > 0);
  if (body > 0) { c.save(); c.globalAlpha *= body;
    vis.forEach(f => { const p = f.v.map(i => V[i]), lit = clamp(.5 - f.sx * .45), top = mix('#0c0d10', '#2a2d33', lit), bot = mix('#060708', '#16181c', lit);
      const g = c.createLinearGradient(p[3][0], p[3][1], p[0][0], p[0][1]); g.addColorStop(0, top); g.addColorStop(1, bot); quad(p, g);
      // a faint sheen sliding across the face as the box turns
      const sh = c.createLinearGradient(p[0][0], 0, p[1][0], 0), u = (boxYaw(t) * 1.6 + f.sx) % 1;
      sh.addColorStop(clamp(u - .25), 'rgba(255,255,255,0)'); sh.addColorStop(clamp(u), 'rgba(255,255,255,.035)'); sh.addColorStop(clamp(u + .25), 'rgba(255,255,255,0)'); quad(p, sh); });
    const T = [4, 5, 6, 7].map(i => V[i]);
    if (open < 1) { const g = c.createLinearGradient(T[0][0], T[0][1], T[2][0], T[2][1]); g.addColorStop(0, '#2c2f35'); g.addColorStop(1, '#17191d'); quad(T, g); }
    c.restore(); }
  // the opening: light inside, a soft beam rising out of it
  const T = [4, 5, 6, 7].map(i => V[i]);
  if (open > 0) { const [mx, my] = proj([0, 1, 0]);
    const bh = s * (1.2 + 4 * eio(open)), bg = c.createLinearGradient(0, my, 0, my - bh); bg.addColorStop(0, `rgba(240,252,249,${.75 * eo(P(open, 0, .5))})`); bg.addColorStop(1, 'rgba(207,241,236,0)');
    const xs = T.map(p => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
    c.fillStyle = bg; c.beginPath(); c.moveTo(x0, my); c.lineTo(x0 - s * .7 * open, my - bh); c.lineTo(x1 + s * .7 * open, my - bh); c.lineTo(x1, my); c.closePath(); c.fill();
    const li = eo(P(open, 0, .45)), ig = c.createRadialGradient(mx, my, 0, mx, my, s * 1.5); ig.addColorStop(0, `rgba(255,255,255,${li})`); ig.addColorStop(.55, `rgba(214,244,239,${li})`); ig.addColorStop(1, `rgba(95,224,211,${.85 * li})`); quad(T, ig); }
  // the lid swings up on the back edge (z = -1) and fades as it passes upright
  if (open > 0 && open < 1) { const ang = eio(open) * 1.95, lid = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => z < 0 ? [x, 1, -1] : [x, 1 + 2 * Math.sin(ang), -1 + 2 * Math.cos(ang)]).map(proj);
    c.save(); c.globalAlpha *= 1 - P(open, .55, 1); const under = ang > BOX_PITCH;
    const g = c.createLinearGradient(lid[0][0], lid[0][1], lid[2][0], lid[2][1]); g.addColorStop(0, under ? '#c9ece6' : '#2c2f35'); g.addColorStop(1, under ? '#f4fbf9' : '#17191d'); quad(lid, g);
    c.shadowColor = K.teal; c.shadowBlur = 14; c.strokeStyle = 'rgba(18,181,165,.8)'; c.lineWidth = 2.5; c.lineJoin = 'round';
    c.beginPath(); lid.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.stroke(); c.restore(); }
  // rim: visible edges in teal; hidden edges only while the box is still a wireframe
  const visE = new Set(); vis.forEach(f => f.v.forEach((v, i) => { const w = f.v[(i + 1) % 4]; visE.add(Math.min(v, w) + '-' + Math.max(v, w)); }));
  c.save(); c.lineCap = 'round'; c.shadowColor = K.teal;
  CUBE_E.forEach(([p, q], ei) => { const isTop = p >= 4 && q >= 4, seen = isTop || visE.has(Math.min(p, q) + '-' + Math.max(p, q));
    const k = eio(P(wire, ei * .045, ei * .045 + .46)); if (k <= 0) return;
    const al = seen ? .5 + .35 * glow : .32 * (1 - body); if (al <= .01) return;
    const [x0, y0] = V[p], [x1, y1] = V[q]; c.globalAlpha = a * Math.min(1, al); c.shadowBlur = seen ? 12 + 16 * glow : 6;
    c.strokeStyle = seen && isTop ? '#5fe0d3' : K.teal; c.lineWidth = seen ? 2.4 : 1.4;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(lerp(x0, x1, k), lerp(y0, y1, k)); c.stroke(); });
  c.restore();
  c.restore(); void cy;
}
// a few slow motes of teal dust drifting up around the box
function motes(c, t, a) {
  if (a <= 0) return; c.save();
  for (let i = 0; i < 16; i++) { const u = ((t * .05 + rnd(i)) % 1), x = BOX.cx + (rnd(i + 9) - .5) * 620 + Math.sin(t * .4 + i) * 14, y = BOX.cy + 170 - u * 420;
    c.globalAlpha = a * .45 * Math.sin(u * Math.PI) * (.4 + .6 * rnd(i + 3)); dot(c, x, y, 1.6 + rnd(i + 5) * 1.8, '#5fe0d3'); }
  c.restore();
}
const FAN = [[250, 250, -7], [690, 200, 4], [1110, 250, -3], [470, 520, 5], [930, 560, -5]];
function versionCard(c, i, cx, cy, sc, rot, play) {
  const w = 560, h = 315; c.save(); c.translate(cx, cy); c.rotate(rot); c.scale(sc, sc);
  panel(c, -w / 2 - 8, -h / 2 - 30, w + 16, h + 38, 14);
  [0, 1, 2].forEach(d => dot(c, -w / 2 + 2 + d * 11, -h / 2 - 15, 3.3, '#3a3d43'));
  box(c, -w / 2 + 45, -h / 2 - 24, 36, 18, 9, i ? 'rgba(255,140,105,.18)' : 'rgba(255,255,255,.1)'); txt(c, `v${i + 1}`, -w / 2 + 63, -h / 2 - 14.5, 10.8, i ? K.coral : D.text, 700, 'center', M);
  scene(c, -w / 2, -h / 2, w, h, layout(i), { play }); c.restore();
}
// S05 versions drop into the box one by one (v5 last); each arrival lights the rim
const DROP5 = [0, 1, 2, 3, 4].map(i => 20.75 + (4 - i) * .26), DROP_LEN = 1.05;
// a smooth arc from a to the box mouth: rises a little first, then falls in
const arcTo = (a, b, u, lift) => { const mx = (a[0] + b[0]) / 2, my = Math.min(a[1], b[1]) - lift, v = 1 - u;
  return [v * v * a[0] + 2 * v * u * mx + u * u * b[0], v * v * a[1] + 2 * v * u * my + u * u * b[1]]; };
function s05(c, t) {
  const wire = P(t, 20.3, 21.5), body = eio(P(t, 21.1, 22.0));
  motes(c, t, P(t, 20.6, 21.8));
  cube3(c, t, { wire, body, glow: pulse(t, DROP5.map(d => d + DROP_LEN)) * .9, a: 1 });
  [0, 1, 2, 3, 4].forEach(i => { // v5 sits on top of the fan and falls first
    const k = eio(P(t, 18.6 + i * .12, 19.5 + i * .12)), [fx, fy, rot] = FAN[i];
    const sp = eio(P(t, 19.4, 21.4)) * 16, dx = fx + 280 - 690, dy = fy + 157 - 520, dl = Math.hypot(dx, dy) || 1; // the fan keeps spreading a little while it holds
    const sx = lerp(BOX2.x + BOX2.w / 2, fx + 280 + dx / dl * sp, k), sy = lerp(BOX2.y + BOX2.h / 2, fy + 157 + dy / dl * sp, k), sc = lerp(BOX2.w / 560, 1, k);
    const d = eio(P(t, DROP5[i], DROP5[i] + DROP_LEN)); if (d >= 1) return;
    const [gx, gy] = d > 0 ? arcTo([sx, sy], boxMouth(t), d, 90) : [sx, sy];
    c.save(); c.globalAlpha *= 1 - P(d, .72, 1); versionCard(c, i, gx, gy, sc * lerp(1, .07, d), rot * Math.PI / 180 * k * (1 - d), .3 + i * .12); c.restore();
  });
}
const CODE = [
  { file: 'sketch.js', x: 200, y: 280, lines: [[['function ', SYN.kw], ['draw', SYN.fn], ['() {', SYN.pl]], [['  circle', SYN.fn], ['(x, y, ', SYN.pl], ['80', SYN.num], [');', SYN.pl]], [['}', SYN.pl]]] },
  { file: 'index.html', x: 1330, y: 290, lines: [[['<canvas ', SYN.kw], ['id', SYN.fn], ['=', SYN.pl], ['"stage"', SYN.str], ['>', SYN.kw]]] },
  { file: 'main.js', x: 1270, y: 650, lines: [[['// 每一幀重畫', SYN.cm]], [['requestAnimationFrame', SYN.fn], ['(tick);', SYN.pl]]] },
  { file: 'scene.ts', x: 230, y: 660, lines: [[['ctx.', SYN.pl], ['arc', SYN.fn], ['(x, y, r, ', SYN.pl], ['0', SYN.num], [', TAU);', SYN.pl]]] },
];
const SUCK = [24.7, 24.85, 25.0, 25.15], SUCK_LEN = .75;
function codeCard(c, cd, i, t) {
  const k = eo(P(t, 22.8 + i * .3, 23.6 + i * .3)), suck = eio(P(t, SUCK[i], SUCK[i] + SUCK_LEN)); if (k <= 0 || suck >= 1) return;
  const lw = Math.max(...cd.lines.map(l => l.reduce((m, [s]) => m + tw(c, s, 21, 500, M), 0))), w = Math.max(lw + 90, 260), h = 52 + cd.lines.length * 32 + 18;
  const drift = Math.sin(t * .8 + i * 1.7) * 6, home = [cd.x + w / 2, cd.y + h / 2 + (1 - k) * 24 + drift];
  const [px, py] = suck > 0 ? arcTo(home, boxMouth(t), suck, 70) : home, sc = lerp(1, .08, suck);
  c.save(); c.globalAlpha *= k * (1 - P(suck, .7, 1)); c.translate(px, py); c.scale(sc, sc); c.translate(-w / 2, -h / 2);
  panel(c, 0, 0, w, h, 16, '#18191d'); windowDots(c, 22, 24, true); txt(c, cd.file, w - 20, 24, 16, D.faint, 500, 'right', M);
  box(c, 0, 46, w, 1, 0, D.hair);
  cd.lines.forEach((parts, i) => { const y = 72 + i * 32; txt(c, String(i + 1), 26, y, 17, '#4a4c52', 500, 'center', M); let x = 52;
    parts.forEach(([s, col]) => { txt(c, s, x, y, 21, col, 500, 'left', M); x += tw(c, s, 21, 500, M); }); });
  c.restore();
}
// S07 layout: live preview on the left, four cards on the right
const PREV = { x: 110, y: 150, w: 920, h: 640 };
const SIDE = [['場景', 'scenes/'], ['時間', 'timeline'], ['參數', 'params'], ['元件', 'components']].map(([name, tag], i) => ({ name, tag, x: 1090, y: 150 + i * 164, w: 720, h: 148 }));
const SIDE_COL = [K.teal, K.coral, K.lilac, K.yellow];
function s06(c, t) {
  const open = P(t, 25.75, 26.55), flood = eio(P(t, 26.0, 26.9));
  motes(c, t, 1 - P(t, 25.8, 26.4));
  if (t < 26.9) cube3(c, t, { glow: .25 + .15 * Math.sin((t - 22.5) * 2.2) + pulse(t, SUCK.map(s => s + SUCK_LEN)) * .9, open }); // covered by the light from 26.4
  CODE.forEach((cd, i) => codeCard(c, cd, i, t));
  fade(c, P(t, 24.0, 24.7) * (1 - P(t, 25.3, 25.8)), 20, () => rich(c, [['如果 Motion Graphics 也可以', D.text], ['像寫網頁', K.teal], ['一樣呢？', D.text]], 960, 150, 62));
  if (flood > 0 && flood < 1) { const [mx, my] = boxMouth(t), R = flood * 2300; // light spreads from the box mouth with a soft glowing edge
    const hg = c.createRadialGradient(mx, my, R * .85, mx, my, R * 1.2 + 40); hg.addColorStop(0, `rgba(214,244,239,${.6 * (1 - flood)})`); hg.addColorStop(1, 'rgba(214,244,239,0)');
    c.fillStyle = hg; c.beginPath(); c.arc(mx, my, R * 1.2 + 40, 0, Math.PI * 2); c.fill();
    c.save(); c.beginPath(); c.arc(mx, my, R, 0, Math.PI * 2); c.clip(); ground(c, true); c.restore(); }
  if (t >= 26.2) {
    const from = { x: 940, y: 440, w: 40, h: 40 }, m = eio(P(t, 26.2, 27.4));
    system(c, t, { prev: lerpR(from, PREV, m), side: SIDE.map((s, i) => lerpR(from, s, eio(P(t, 26.3 + i * .09, 27.45)))) }, P(t, 26.7, 27.4), { cardA: eo(P(t, 26.2, 26.6)) });
  }
}
function slider(c, x, y, w, v, col) { box(c, x, y - 3, w, 6, 3, L.line); box(c, x, y - 3, w * v, 6, 3, col);
  c.save(); c.shadowColor = 'rgba(16,48,42,.25)'; c.shadowBlur = 8; c.shadowOffsetY = 2; dot(c, x + w * v, y, 13, '#fff'); c.restore(); c.lineWidth = 3.5; c.strokeStyle = col; c.beginPath(); c.arc(x + w * v, y, 13, 0, Math.PI * 2); c.stroke(); }
const sizeAt = t => lerp(.3, .85, eio(P(t, 30.0, 31.4)));
function sideIcon(c, i, x, y) {
  box(c, x, y, 40, 40, 12, alpha(SIDE_COL[i], .18)); c.save(); c.translate(x + 20, y + 20); c.strokeStyle = i === 3 ? '#c9971a' : SIDE_COL[i] === K.lilac ? K.violet : mix(SIDE_COL[i], '#000000', .15);
  c.lineWidth = 2.5; c.lineCap = 'round'; c.lineJoin = 'round';
  if (i === 0) { rr(c, -10, -8, 20, 16, 3); c.stroke(); c.beginPath(); c.moveTo(-6, -12); c.lineTo(6, -12); c.stroke(); }
  if (i === 1) { [-6, 0, 6].forEach((y, q) => { c.beginPath(); c.moveTo(-10 + q * 3, y); c.lineTo(4 + q * 3, y); c.stroke(); }); }
  if (i === 2) { [-5, 5].forEach((y, q) => { c.beginPath(); c.moveTo(-10, y); c.lineTo(10, y); c.stroke(); dot(c, q ? 4 : -4, y, 3.5, c.strokeStyle); }); }
  if (i === 3) { [[-9, -9], [1, -9], [-9, 1], [1, 1]].forEach(([a, b]) => { rr(c, a, b, 8, 8, 2); c.stroke(); }); }
  c.restore();
}
function system(c, t, R, content, o = {}) {
  const ph = ((t - 26) % 6) / 6, ca = o.cardA ?? 1;
  // preview window
  const p = R.prev; if (p && (o.prevA ?? 1) > 0) { c.save(); c.globalAlpha *= (o.prevA ?? 1) * ca; card(c, p.x, p.y, p.w, p.h, 24);
    if (content > 0) { c.save(); c.globalAlpha *= content; const s = p.w / 920;
      windowDots(c, p.x + 28 * s, p.y + 30 * s); txt(c, 'launch.ts', p.x + p.w / 2, p.y + 30 * s, 18 * s, L.muted, 500, 'center', M);
      const lw = tw(c, '即時預覽', 16 * s, 600) + 40 * s; box(c, p.x + p.w - lw - 20 * s, p.y + 16 * s, lw, 28 * s, 14 * s, alpha(K.teal, .12));
      dot(c, p.x + p.w - lw - 4 * s, p.y + 30 * s, 4 * s, K.teal); txt(c, '即時預覽', p.x + p.w - lw + 6 * s, p.y + 30 * s, 16 * s, K.deep, 600, 'left');
      const sw = p.w - 48 * s, sh = sw * 9 / 16; scene(c, p.x + 24 * s, p.y + 60 * s, sw, sh, layout(0), { circleS: (.55 + sizeAt(t) * .7), mark: o.mark || 0 });
      const ty = p.y + 60 * s + sh + 38 * s; sendPlay(c, p.x + 46 * s, ty, 18 * s);
      txt(c, `00:0${Math.floor(ph * 6)}.${Math.floor(ph * 60) % 10}`, p.x + 78 * s, ty, 18 * s, L.mute, 500, 'left', M);
      box(c, p.x + 180 * s, ty - 3 * s, p.w - 220 * s, 6 * s, 3 * s, L.line); box(c, p.x + 180 * s, ty - 3 * s, (p.w - 220 * s) * ph, 6 * s, 3 * s, K.teal);
      c.restore(); }
    c.restore(); }
  // connectors with a travelling dot
  if ((o.wires ?? 1) > 0 && content > 0) { c.save(); SIDE.forEach((sd, i) => { const k = eo(P(t, 27.8 + i * .2, 28.4 + i * .2)) * (o.wires ?? 1); if (k <= 0) return;
      const x0 = PREV.x + PREV.w + 2, y0 = PREV.y + PREV.h / 2, x1 = sd.x - 4, y1 = sd.y + sd.h / 2; c.globalAlpha = k;
      c.setLineDash([6, 9]); c.lineWidth = 2.5; c.strokeStyle = alpha(K.teal, .7); c.beginPath(); c.moveTo(x0, y0); c.bezierCurveTo(x0 + 34, y0, x1 - 34, y1, x1, y1); c.stroke();
      c.setLineDash([]); const u = P(t, 27.9 + i * .2, 28.9 + i * .2); if (u > 0 && u < 1) { const a = 1 - u, bx = a ** 3 * x0 + 3 * a * a * u * (x0 + 34) + 3 * a * u * u * (x1 - 34) + u ** 3 * x1, by = a ** 3 * y0 + 3 * a * a * u * y0 + 3 * a * u * u * y1 + u ** 3 * y1; dot(c, bx, by, 6, K.teal); }
      dot(c, x1, y1, 5, K.teal); }); c.restore(); }
  // side cards
  (R.side || []).forEach((r, i) => { const a = (o.sideA ? o.sideA[i] : 1) * ca; if (!r || a <= 0) return; c.save(); c.globalAlpha *= a;
    card(c, r.x, r.y, r.w, r.h, 20);
    if (content > 0) { c.save(); c.globalAlpha *= content; c.translate(r.x, r.y);
      sideIcon(c, i, 24, 24); txt(c, SIDE[i].name, 78, 45, 26, L.ink, 700, 'left'); txt(c, SIDE[i].tag, 26, 116, 16, L.muted, 500, 'left', M);
      if (i === 0) [0, 1, 2].forEach(j => { const x = 196 + j * 172; scene(c, x, 20, 152, 85.5, layout(j ? j + 4 : 0), {}); if (!j) { c.lineWidth = 3.5; c.strokeStyle = K.teal; rr(c, x - 3, 17, 158, 91.5, 10); c.stroke(); }
        txt(c, ['開場', '功能', '結尾'][j], x + 2, 126, 16, j ? L.muted : K.deep, 600, 'left'); });
      if (i === 1) { const lx = 196, lw = 490; for (let s = 0; s <= 6; s++) box(c, lx + s * lw / 6, 22, 1.5, 8, 1, L.muted);
        [['標題', .05, .32, L.ink], ['卡片', .25, .38, K.coral], ['圓形', 0, .82, K.teal]].forEach(([n, s, l, col], j) => { const y = 40 + j * 32; box(c, lx + s * lw, y, l * lw, 24, 7, col); txt(c, n, lx + s * lw + 10, y + 13, 14, '#fff', 600, 'left'); });
        box(c, lx + ph * lw - 1.5, 18, 3, 120, 1.5, K.deep); dot(c, lx + ph * lw, 18, 6, K.deep); }
      if (i === 2) { [['大小', sizeAt(t), K.teal], ['速度', .45, K.violet]].forEach(([n, v, col], j) => { const y = 50 + j * 54;
        txt(c, n, 196, y, 22, L.mute, 600, 'left'); slider(c, 268, y, 330, v, col); txt(c, j ? '1.0×' : v.toFixed(2), 690, y, 20, L.ink, 600, 'right', M); }); }
      if (i === 3) [['文字', 0], ['圖表', 1], ['形狀', 2], ['卡片', 3]].forEach(([n], j) => { const x = 196 + j * 126; box(c, x, 18, 110, 84, 14, L.stage); hair(c, x, 18, 110, 84, 14, L.line);
        if (j === 0) txt(c, 'Aa', x + 55, 60, 36, L.ink, 800); if (j === 1) [26, 46, 36].forEach((hh, q) => box(c, x + 30 + q * 18, 84 - hh, 13, hh, 3, K.coral));
        if (j === 2) dot(c, x + 55, 60, 24, K.teal); if (j === 3) { box(c, x + 28, 36, 54, 50, 9, K.yellow); box(c, x + 38, 72, 34, 6, 3, 'rgba(255,255,255,.85)'); }
        txt(c, n, x + 55, 124, 16, L.mute, 500); });
      c.restore(); }
    c.restore(); });
}
function sendPlay(c, x, y, r) { dot(c, x, y, r, K.teal); c.beginPath(); c.moveTo(x - r * .3, y - r * .45); c.lineTo(x - r * .3, y + r * .45); c.lineTo(x + r * .5, y); c.closePath(); c.fillStyle = '#fff'; c.fill(); }
function s07(c, t) {
  system(c, t, { prev: PREV, side: SIDE }, 1);
  if (t > 29.0 && t < 32.4) { const r = SIDE[2], v = sizeAt(t); const [x, y] = t < 30 ? path(t, [[29.0, 1500, 960], [29.9, r.x + 268 + 330 * .3, r.y + 50]]) : [r.x + 268 + 330 * v, r.y + 50];
    cursor(c, x + 4, y + 4, P(t, 29.9, 30.2) * (t < 30.2 ? 1 : 0)); }
}
// S08: the 時間 card grows into a full timeline, preview tucks top-right
const TL = { x: 100, y: 580, w: 1720, h: 350 }, PREV8 = { x: 1120, y: 40, w: 700, h: 487 };
const TRACKS = [['標題', .5, 1.6, L.ink], ['卡片', 1.2, 2.2, K.coral], ['圓形', .2, 3.4, K.teal], ['音樂', 0, 6, K.lilac]];
function timeline(c, r, t) {
  card(c, r.x, r.y, r.w, r.h, 24);
  const lx = r.x + 210, lw = r.w - 270, sc = lw / 6, shift = eio(P(t, 35.6, 36.4)) * .5 * sc;
  txt(c, '時間軸', r.x + 36, r.y + 38, 22, L.ink, 700, 'left');
  for (let s = 0; s <= 6; s++) { box(c, lx + s * sc - .75, r.y + 30, 1.5, 14, 1, L.muted); txt(c, `${s}s`, lx + s * sc + 8, r.y + 34, 16, L.muted, 500, 'left', M);
    if (s < 6) for (let q = 1; q < 4; q++) box(c, lx + (s + q / 4) * sc - .5, r.y + 38, 1, 6, .5, L.line); }
  TRACKS.forEach(([name, s, l, col], i) => { const y = r.y + 72 + i * 66, act = i === 0, lk = act ? 0 : eo(P(t, 35.9 + i * .12, 36.3 + i * .12));
    dot(c, r.x + 44, y + 25, 6, col); txt(c, name, r.x + 62, y + 25, 22, L.ink, 600, 'left'); box(c, lx, y + 24, lw, 2, 1, L.line);
    const x = lx + s * sc + (act ? shift : 0);
    if (act && shift > 1) { c.save(); c.setLineDash([7, 7]); c.lineWidth = 2; c.strokeStyle = L.muted; rr(c, lx + s * sc, y, l * sc, 50, 10); c.stroke(); c.restore();
      c.save(); c.strokeStyle = K.deep; c.lineWidth = 2.5; c.beginPath(); c.moveTo(lx + s * sc + 8, y + 25); c.lineTo(x - 6, y + 25); c.stroke(); c.restore(); }
    c.save(); c.globalAlpha *= 1 - lk * .55;
    const g = c.createLinearGradient(0, y, 0, y + 50); g.addColorStop(0, mix(col, '#ffffff', .12)); g.addColorStop(1, col); box(c, x, y, l * sc, 50, 10, g);
    if (i === 3) { c.fillStyle = 'rgba(255,255,255,.5)'; for (let q = x + 16; q < x + l * sc - 12; q += 8) { const hh = 6 + 18 * Math.abs(Math.sin(q * .045) * Math.sin(q * .011 + 1)); c.fillRect(q, y + 25 - hh / 2, 3.5, hh); } }
    else txt(c, name, x + 16, y + 26, 18, '#fff', 600, 'left');
    c.restore();
    if (act && t > 35.5) { c.lineWidth = 3.5; c.strokeStyle = K.deep; rr(c, x - 5, y - 5, l * sc + 10, 60, 14); c.stroke();
      pop(c, x + l * sc / 2, y - 30, P(t, 35.9, 36.3), () => { c.shadowColor = 'rgba(10,138,125,.35)'; c.shadowBlur = 14; box(c, -56, -20, 112, 40, 20, K.deep); c.shadowColor = 'transparent'; txt(c, '+0.5s', 0, 1, 20, '#fff', 700, 'center', M); }); }
    if (lk > 0) pop(c, r.x + r.w - 34, y + 25, lk, () => { dot(c, 0, 0, 18, L.stage); lock(c, 0, 1, L.muted, .9); }); });
  box(c, lx + ((t - 34) / 5) * lw * .9 - 1.5, r.y + 52, 3, r.h - 70, 1.5, alpha(K.deep, .5));
}
function s08(c, t) {
  const m = eio(P(t, 34.0, 35.0)), out = eio(P(t, 38.7, 39.55));
  c.save(); c.globalAlpha *= 1 - out; c.translate(0, -out * 40);
  system(c, t, { prev: lerpR(PREV, PREV8, m), side: SIDE.map((s, i) => i === 1 ? null : s) }, 1, { sideA: [1 - m, 0, 1 - m, 1 - m], wires: 1 - P(t, 34.0, 34.3), mark: P(t, 36.0, 36.4) });
  const r1 = lerpR(SIDE[1], TL, m); if (m < 1) { c.save(); c.globalAlpha *= 1 - m; card(c, r1.x, r1.y, r1.w, r1.h, 20); c.restore(); }
  if (m > 0) { c.save(); c.globalAlpha *= m; timeline(c, r1, t); c.restore(); }
  bubble(c, ASKS[0], 100, 210, P(t, 34.6, 35.05), { size: 34, send: true, label: '對 AI 說' });
  const wk = eo(P(t, 35.2, 35.7)); if (wk > 0) { c.save(); c.setLineDash([7, 9]); c.lineWidth = 2.5; c.strokeStyle = K.teal; c.globalAlpha *= wk * (1 - P(t, 37.6, 38.2));
    const x1 = TL.x + 210 + .5 / 6 * (TL.w - 270) + 20, y1 = TL.y + 66; c.beginPath(); c.moveTo(250, 290); c.bezierCurveTo(250, 450, x1, 420, lerp(250, x1, wk), lerp(290, y1, wk)); c.stroke(); c.restore(); }
  c.restore();
}
const AUD = [['設計師', 'Designer', '#DDF3EE', '靜態 → 動態'], ['獨立開發者', 'Indie developer', '#FFF0CC', '產品 UI 動畫'], ['內容創作者', 'Content creator', '#FFE3D9', '文章 → 短影音'], ['想學動態的人', 'Motion learner', '#E9E3FF', 'Timing · Easing']];
const AUD_INK = [K.deep, '#B07A00', '#D65F3C', K.violet];
const bez = (p, u) => { const a = 1 - u; return [0, 1].map(k => a ** 3 * p[0][k] + 3 * a * a * u * p[1][k] + 3 * a * u * u * p[2][k] + u ** 3 * p[3][k]); };
function dashed(c, pts, col, lw = 3, k = 1) { // polyline that draws itself in
  const n = Math.max(1, Math.round((pts.length - 1) * k)); c.save(); c.setLineDash([8, 9]); c.lineCap = 'round'; c.lineWidth = lw; c.strokeStyle = col; c.beginPath();
  pts.slice(0, n + 1).forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); c.restore(); }
const diamond = (c, x, y, s, col) => { c.save(); c.translate(x, y); c.rotate(Math.PI / 4); box(c, -s / 2, -s / 2, s, s, 2, col); c.restore(); };
// one illustration per person, drawn in a 347 × 300 panel; u = seconds since that person came into focus
function persona(c, i, cx, py, u) {
  if (i === 0) { // designer: a static layout gets a motion path, keyframes and a moving shape
    card(c, cx - 150, py + 42, 210, 146, 16, '#fff', .8);
    box(c, cx - 128, py + 66, 96, 12, 6, L.ink); box(c, cx - 128, py + 88, 64, 8, 4, L.muted); box(c, cx - 128, py + 112, 74, 54, 10, '#FFB59E');
    const path = [[cx + 22, py + 126], [cx + 140, py + 120], [cx + 30, py + 262], [cx + 138, py + 258]], pts = Array.from({ length: 41 }, (_, q) => bez(path, q / 40));
    const draw = eio(P(u, 0, .9)), go = eio(P(u, .5, 1.7));
    dashed(c, pts, alpha(K.teal, .8), 3, Math.max(draw, go > 0 ? 1 : 0));
    [0, .5, 1].forEach(q => { const [x, y] = bez(path, q); if (draw >= q) diamond(c, x, y, 14, go >= q ? K.teal : '#9FDCD4'); });
    const [bx, by] = bez(path, go); c.save(); c.shadowColor = 'rgba(18,181,165,.35)'; c.shadowBlur = 18; dot(c, bx, by, 24, K.teal); c.restore(); dot(c, bx - 7, by - 8, 7, 'rgba(255,255,255,.45)');
  }
  if (i === 1) { // indie developer: code on the left drives the product UI on a phone
    box(c, cx - 156, py + 52, 196, 150, 16, '#1d2026'); windowDots(c, cx - 136, py + 72, true);
    [[70, K.teal], [118, K.yellow], [92, K.lilac], [56, '#5a5e66'], [104, K.teal]].forEach(([w, col], q) => { txt(c, String(q + 1), cx - 140, py + 100 + q * 20, 11, '#4a4c52', 500, 'center', M); box(c, cx - 126 + (q === 2 || q === 3 ? 14 : 0), py + 96 + q * 20, w, 8, 4, col); });
    const k = eo(P(u, .2, 1.0)), b = eo(P(u, .6, 1.4));
    dashed(c, Array.from({ length: 21 }, (_, q) => bez([[cx + 40, py + 128], [cx + 64, py + 128], [cx + 50, py + 168], [cx + 78, py + 168]], q / 20)), alpha('#B07A00', .7), 2.5, k || 1);
    card(c, cx + 34, py + 30, 128, 236, 22, '#fff', .9); box(c, cx + 80, py + 42, 36, 6, 3, L.line);
    const ig = c.createLinearGradient(0, py + 60, 0, py + 140); ig.addColorStop(0, '#E3F4F0'); ig.addColorStop(1, '#BFE9E2'); box(c, cx + 46, py + 58, 104, 84, 12, ig);
    c.save(); c.translate(0, (1 - k) * 16); c.globalAlpha *= .35 + .65 * k; dot(c, cx + 98, py + 100, 22, K.teal); dot(c, cx + 92, py + 93, 7, 'rgba(255,255,255,.5)'); c.restore();
    box(c, cx + 48, py + 156, 78, 9, 4.5, L.ink); box(c, cx + 48, py + 174, 56, 7, 3.5, L.muted);
    c.save(); c.globalAlpha *= .3 + .7 * b; c.translate(0, (1 - b) * 14); box(c, cx + 48, py + 210, 100, 34, 17, K.yellow); txt(c, 'Get', cx + 98, py + 228, 15, L.ink, 700, 'center'); c.restore(); }
  if (i === 2) { // content creator: an article becomes a vertical video
    card(c, cx - 156, py + 62, 132, 176, 14, '#fff', .8); box(c, cx - 142, py + 76, 104, 54, 8, '#FFE7A8');
    [96, 104, 80, 98, 64].forEach((w, q) => box(c, cx - 142, py + 144 + q * 16, w, 7, 3.5, q ? L.line : L.ink));
    const k = eio(P(u, .1, .9)), pl = clamp((u - .8) / 1.6);
    c.save(); c.globalAlpha *= .4 + .6 * k; c.lineWidth = 3; c.lineCap = 'round'; c.strokeStyle = '#E58A6C'; c.beginPath(); c.moveTo(cx - 14, py + 150); c.lineTo(cx - 14 + 22 * k, py + 150); c.stroke();
    c.beginPath(); c.moveTo(cx - 14 + 22 * k - 7, py + 143); c.lineTo(cx - 14 + 22 * k, py + 150); c.lineTo(cx - 14 + 22 * k - 7, py + 157); c.stroke(); c.restore();
    const vg = c.createLinearGradient(0, py + 34, 0, py + 266); vg.addColorStop(0, '#FF9E80'); vg.addColorStop(1, '#F06C4E');
    c.save(); c.shadowColor = 'rgba(240,108,78,.3)'; c.shadowBlur = 24; c.shadowOffsetY = 10; box(c, cx + 26, py + 34, 130, 232, 22, vg); c.restore();
    box(c, cx + 40, py + 46, 38, 20, 10, 'rgba(255,255,255,.25)'); txt(c, '9:16', cx + 59, py + 56, 11, '#fff', 700, 'center', M);
    dot(c, cx + 91, py + 140, 26, 'rgba(255,255,255,.92)'); c.beginPath(); c.moveTo(cx + 84, py + 127); c.lineTo(cx + 84, py + 153); c.lineTo(cx + 104, py + 140); c.closePath(); c.fillStyle = '#F06C4E'; c.fill();
    [[96, .2], [70, .45]].forEach(([w, d], q) => box(c, cx + 42, py + 200 + q * 18, w * eo(P(pl, d, d + .35)) + 2, 9, 4.5, 'rgba(255,255,255,.9)'));
    box(c, cx + 40, py + 248, 102, 5, 2.5, 'rgba(255,255,255,.35)'); box(c, cx + 40, py + 248, 102 * pl, 5, 2.5, '#fff'); }
  if (i === 3) { // learner: an easing curve and what it does to a moving ball
    card(c, cx - 140, py + 34, 280, 180, 16, '#fff', .8);
    c.strokeStyle = '#EEEBF8'; c.lineWidth = 1.5; for (let g = 1; g < 5; g++) { c.beginPath(); c.moveTo(cx - 116 + g * 46, py + 54); c.lineTo(cx - 116 + g * 46, py + 194); c.stroke(); }
    for (let g = 1; g < 4; g++) { c.beginPath(); c.moveTo(cx - 116, py + 54 + g * 35); c.lineTo(cx + 116, py + 54 + g * 35); c.stroke(); }
    c.lineWidth = 4; c.strokeStyle = K.lilac; c.lineCap = 'round'; c.beginPath(); for (let q = 0; q <= 1.001; q += .02) { const px = cx - 116 + q * 232, pyy = py + 194 - eio(q) * 140; q === 0 ? c.moveTo(px, pyy) : c.lineTo(px, pyy); } c.stroke();
    const m = clamp((u - .3) / 1.4); dot(c, cx - 116 + m * 232, py + 194 - eio(m) * 140, 9, K.violet);
    txt(c, 'ease-in-out', cx + 112, py + 202, 12, '#9A8FD0', 600, 'right', M);
    box(c, cx - 130, py + 254, 260, 4, 2, '#DCD4F8');
    [.2, .4, .6, .8].forEach(g => { const q = Math.min(g, m); dot(c, cx - 120 + eio(q) * 240, py + 256, 12, alpha(K.violet, .1 + g * .12)); });
    c.save(); c.shadowColor = 'rgba(123,97,232,.35)'; c.shadowBlur = 14; dot(c, cx - 120 + eio(m) * 240, py + 256, 15, K.violet); c.restore(); }
}
const AUD_LONG = ['用原本的設計思維加上 AI，讓靜態設計動起來。', '沒有動畫團隊，也能用自己的 UI 做產品動畫。', '讓文章與活動資訊，變成可重複使用的動態內容。', '先看懂畫面怎麼動，再慢慢理解動畫原理。'];
const HL = [41.4, 43.8, 46.2, 48.6], CW = 375, CX0 = 150, CSTEP = 415;
// how much persona i is in focus: eases in over .6 s, hands over to the next one over .6 s
const focusOf = (t, i) => eio(P(t, HL[i] - .3, HL[i] + .3)) * (i < 3 ? 1 - eio(P(t, HL[i + 1] - .3, HL[i + 1] + .3)) : 1);
function s09(c, t) {
  const out = eio(P(t, 50.7, 51.55)), focus = eio(P(t, HL[0] - .4, HL[0] + .3));
  const idx = [1, 2, 3].reduce((m, i) => m + eio(P(t, HL[i] - .3, HL[i] + .3)), 0);
  AUD.forEach(([name, en, tint, chip], i) => {
    const x = CX0 + i * CSTEP, y = 110, w = CW, h = 540, cx = x + w / 2;
    const k = eo(P(t, 39.0 + i * .18, 40.0 + i * .18)); if (k <= 0) return;
    if (i === 3 && t >= 51) return; // from here S10 carries this card on and opens it into its preview window
    const on = focusOf(t, i), veil = focus * (1 - on), ex = i === 3 ? 0 : out;
    c.save(); c.globalAlpha *= k * (1 - ex); c.translate(0, (1 - k) * 70 + ex * 40 - on * 16);
    card(c, x, y, w, h, 30, '#fff', 1 + on * .8); audCard(c, i, t, on);
    if (veil > 0) { c.save(); c.globalAlpha *= veil * .55; box(c, x - 1, y - 1, w + 2, h + 2, 31, '#F1F6F4'); c.restore(); }
    c.restore();
  });
  stripS09(c, t, out, focus, idx);
}
function audCard(c, i, t, on) { // everything inside a person card (the white card itself is drawn by the caller)
  const [name, en, tint, chip] = AUD[i], x = CX0 + i * CSTEP, y = 110, w = CW, h = 540, cx = x + w / 2;
  {
    // tinted illustration panel
    const g = c.createLinearGradient(0, y + 14, 0, y + 314); g.addColorStop(0, tint); g.addColorStop(1, mix(tint, '#ffffff', .5)); box(c, x + 14, y + 14, w - 28, 300, 22, g);
    c.save(); rr(c, x + 14, y + 14, w - 28, 300, 22); c.clip(); for (let q = 0; q < 6; q++) for (let r = 0; r < 5; r++) dot(c, x + 40 + q * 60, y + 40 + r * 60, 1.6, 'rgba(27,31,36,.06)');
    persona(c, i, cx, y + 14, t >= HL[i] - .3 ? t - HL[i] + .3 : (i === 0 ? 0 : 0)); c.restore();
    // label block
    box(c, x + 30, y + 340, 50, 28, 14, alpha(AUD_INK[i], .1)); txt(c, `0${i + 1}`, x + 55, y + 355, 15, AUD_INK[i], 700, 'center', M);
    txt(c, en, x + 92, y + 355, 15, L.muted, 600, 'left', M, .5);
    txt(c, name, x + 30, y + 412, 38, L.ink, 800, 'left', F, -.5);
    const cw = tw(c, chip, 17, 600) + 32; box(c, x + 30, y + 456, cw, 38, 19, alpha(AUD_INK[i], .08)); hair(c, x + 30, y + 456, cw, 38, 19, alpha(AUD_INK[i], .22), 1.2);
    txt(c, chip, x + 30 + cw / 2, y + 476, 17, AUD_INK[i], 600, 'center');
    if (on > .02) hair(c, x, y, w, h, 30, alpha(K.teal, on * .9), 2.5);
  }
}
function stripS09(c, t, out, focus, idx) {
  // the line under the row; its pointer glides from card to card
  const sa = focus * (1 - out); if (sa <= 0) return;
  c.save(); c.globalAlpha *= sa; c.translate(0, (1 - focus) * 24 + out * 40);
  const sx = CX0, sy = 702, sw = CX0 + 3 * CSTEP + CW - sx, sh = 196, px = CX0 + CW / 2 + idx * CSTEP;
  card(c, sx, sy, sw, sh, 28);
  c.beginPath(); c.moveTo(px - 18, sy + 1); c.lineTo(px, sy - 16); c.lineTo(px + 18, sy + 1); c.closePath(); c.fillStyle = L.card; c.fill();
  box(c, sx + 168, sy + 40, 1.5, sh - 80, 0, L.line);
  AUD.forEach(([name, en], i) => { const v = focusOf(t, i), a = clamp((v - .5) / .5); if (a <= 0) return;
    // a clean hand-off: the old line lifts away first, then the new one rises in, never both at once
    c.save(); c.globalAlpha *= eo(a); c.translate(0, (1 - a) * (t < HL[i] ? 18 : -18));
    txt(c, `0${i + 1}`, sx + 84, sy + sh / 2 + 2, 60, AUD_INK[i], 700, 'center', M, -2);
    txt(c, name, sx + 208, sy + 64, 22, AUD_INK[i], 700, 'left'); txt(c, en.toUpperCase(), sx + 216 + tw(c, name, 22, 700), sy + 65, 13, L.muted, 600, 'left', M, 1.5);
    txt(c, AUD_LONG[i], sx + 206, sy + 128, 44, L.ink, 700, 'left', F, -.5); c.restore(); });
  // four segments: which person we are on, and how far along
  AUD.forEach((_, j) => { const bx = sx + sw - 300 + j * 64, f = j < 3 ? Math.max(P(t, HL[j], HL[j + 1] - .3), t >= HL[j + 1] ? 1 : 0) : P(t, HL[j], 50.6);
    box(c, bx, sy + sh / 2 - 3, 52, 6, 3, L.line); if (f > 0) box(c, bx, sy + sh / 2 - 3, 52 * f, 6, 3, AUD_INK[j]); });
  c.restore();
}
const STAGE = { x: 840, y: 90, w: 960, h: 625 };
function s10(c, t) {
  const m = eio(P(t, 46.0, 47.1)), out = eio(P(t, 50.7, 51.55));
  c.save(); c.globalAlpha *= 1 - out; c.translate(0, -out * 30);
  const C3 = { x: CX0 + 3 * CSTEP, y: 94, w: CW, h: 540 }, r = lerpR(C3, STAGE, m), rad = lerp(30, 24, m);
  card(c, r.x, r.y, r.w, r.h, rad, '#fff', 1.8 - .8 * m); if (m < 1) hair(c, r.x, r.y, r.w, r.h, rad, alpha(K.teal, .9 * (1 - m)), 2.5);
  const oa = 1 - P(m, 0, .35); if (oa > 0) { c.save(); rr(c, r.x, r.y, r.w, r.h, rad); c.clip(); c.globalAlpha *= oa; c.translate(r.x - C3.x, r.y - C3.y - 16); audCard(c, 3, 51, 0); c.restore(); }
  const ia = P(m, .55, 1); c.save(); c.globalAlpha *= ia; const r2 = r; // the preview content rides on the growing card
  windowDots(c, r2.x + 28, r2.y + 30); txt(c, 'scene.ts · 預覽', r2.x + r2.w / 2, r2.y + 30, 18, L.muted, 500, 'center', M); c.restore(); c.save(); c.globalAlpha *= ia;
  const title = eo(P(t, 46.9, 47.5)), cards = [0, 1, 2].map(i => eo(P(t, 48.1 + i * .22, 48.6 + i * .22)));
  const lay = { ...layout(0), tx: 70, ty: 140, kx: 70, ky: 260, cx: 770, cy: 280, cr: 100 };
  scene(c, r.x + 24, r.y + 60, r.w - 48, (r.w - 48) * 513 / 912, lay, { title, titleDy: (1 - title) * 80, cards }); c.restore();
  const tk = eo(P(t, 46.7, 47.4)); c.save(); c.globalAlpha *= tk; c.translate(0, (1 - tk) * 40);
  const tl = { x: 840, y: 740, w: 960, h: 170 }; card(c, tl.x, tl.y, tl.w, tl.h, 20);
  const lx = tl.x + 150, lw = tl.w - 190, sc = lw / 3;
  [['標題', .2, .6, L.ink, title], ['卡片 1', .9, .5, K.coral, cards[0]], ['卡片 2', 1.12, .5, K.yellow, cards[1]], ['卡片 3', 1.34, .5, K.lilac, cards[2]]].forEach(([n, s, l, col, k], i) => {
    const y = tl.y + 24 + i * 34; txt(c, n, tl.x + 28, y + 9, 17, L.mute, 500, 'left'); box(c, lx, y + 8, lw, 2, 1, L.line); box(c, lx + s * sc, y, l * sc * k, 18, 9, col); });
  const ph = clamp((t - 46.5) / 3.2) * 3; box(c, lx + ph * sc - 1.5, tl.y + 14, 3, 142, 1.5, K.deep); dot(c, lx + ph * sc, tl.y + 14, 6, K.deep);
  c.restore(); c.restore();
  if (t < 51) { // from 51 S11 carries these two lines on as part of its scattered notes
    bubble(c, ASK10[0], 100, 270, P(t, 46.3, 46.75), { size: 34, label: '對 AI 說' });
    bubble(c, ASK10[1], 100, 430, P(t, 47.6, 48.05), { size: 34, label: '對 AI 說' }); }
  c.save(); c.globalAlpha *= 1 - out;
  fade(c, P(t, 48.9, 49.3), 0, () => txt(c, '從結果裡觀察', 104, 610, 20, L.muted, 500, 'left', M, 1));
  ['時間', 'Easing', 'Stagger'].forEach((s, i) => pop(c, 100 + i * 176 + 78, 670, P(t, 49.0 + i * .3, 49.5 + i * .3), () => { box(c, -78, -28, 156, 56, 28, K.mint); txt(c, s, 0, 1, 24, K.deep, 600, 'center', i ? M : F); }));
  c.restore();
}
const ASK10 = ['標題從下面滑進來。', '三張卡片依序出現。'];
const QUOTES = [[ASK10[0], 150, 170, -3], ['再慢一點。', 1440, 160, 2], [ASK10[1], 170, 790, 2], ['只改這裡。', 1500, 800, -2]];
const FROM10 = [[100, 270], null, [100, 430], null];
function s11(c, t) {
  const out = eio(P(t, 55.0, 55.95)), dim = .4 + .6 * (1 - P(t, 52.4, 53.0)), fly = eio(P(t, 51.0, 52.1)), conv = eio(P(t, 54.85, 55.9));
  QUOTES.forEach(([s, x, y, rot], i) => { const f = FROM10[i], m = f ? fly : 1;
    const sz = f ? lerp(34, 28, m) : 28, w = tw(c, s, sz, 500) + sz * 1.7, h = sz * 2.05, sc = lerp(1, .45, conv);
    const px = lerp(f ? f[0] : x, x, m), py = lerp(f ? f[1] : y, y, m), gx = lerp(px, 960 - w * sc / 2, conv), gy = lerp(py, 470 - h * sc / 2, conv);
    c.save(); c.globalAlpha *= lerp(dim, 1, conv) * (1 - P(conv, .5, 1)); c.translate(gx, gy); c.rotate(rot * Math.PI / 180 * m * (1 - conv)); c.scale(sc, sc);
    bubble(c, s, 0, 0, f ? 1 : P(t, 51.0 + i * .25, 51.5 + i * .25), { size: sz, label: f && m < 1 ? '對 AI 說' : null, labelA: 1 - P(m, 0, .5) }); c.restore(); });
  c.save(); c.globalAlpha *= 1 - out; const so = 1 - out * .06; c.translate(960, 510); c.scale(so, so); c.translate(-960, -510);
  fade(c, P(t, 52.4, 53.0), 24, () => rich(c, [['讓 AI 負責', L.ink], ['加速製作', L.ink, P(t, 52.8, 53.3)], ['，', L.ink]], 960, 450, 78));
  fade(c, P(t, 53.2, 53.8), 24, () => rich(c, [['最後的決定，仍然留在', L.ink], ['創作者', K.deep, P(t, 53.7, 54.2)], ['手上。', L.ink]], 960, 572, 78));
  c.restore();
}
// ---- S12: the brand logo animation from examples/mografy-brand, recoloured for the light ground ----
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
const inOutQuart = x => x < .5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2, outQuint = x => 1 - (1 - x) ** 5;
const at = (t, a, b, e = eio) => e(P(t, a, b));
const spring = (t, s, d, over) => { const x = P(t, s, s + d); if (x <= 0) return 0; const c1 = over * 8; return 1 + (c1 + 1) * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
const LOGO_BOX = { x0: 15.2, y0: 26.5, x1: 1147.5, y1: 226 }, MARK_BOX = { x0: 15.2, y0: 26.5, x1: 403.5, y1: 226 };
const LT0 = 56.3, LOGO_CY = 460;
function brandLogo(c, T) { // T = seconds into the template animation
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
    c.save(); c.beginPath(); c.rect(bx - 6, by - 40, bw + 12, bh + 46); c.clip(); c.translate(0, (1 - rise) * (bh + 10) + dip); c.fillStyle = L.ink; c.fill(p.path, 'evenodd'); c.restore();
    if (idx === 0) fillRibbon(); });
  // 3 — the wordmark rises letter by letter from a baseline mask
  LOGO.slice(3).forEach((p, i) => { const start = 2.55 + i * .065, a = outQuint(P(T, start, start + .75)); if (a <= 0) return; const [bx, , bw] = p.box;
    c.save(); c.beginPath(); c.rect(bx - 10, 30, bw + 20, 200); c.clip(); c.globalAlpha *= clamp(a * 1.4); c.translate(0, (1 - a) * 70); c.fillStyle = L.ink; c.fill(p.path, 'evenodd'); c.restore(); });
  c.restore();
}
function s12(c, t) {
  const bk = P(t, 55.5, 56.0), fold = eio(P(t, 56.4, 56.85)), s = 'Logo 最後放大並淡入。', size = 40, h = size * 2.05, pad = size * .85;
  const w = tw(c, s, size, 500) + pad * 2 + h * .8, left = 960 - w / 2, y = 430, sx = left + w - h * .52, sy = y + h / 2;
  const tx = 960 + (LEAD[0][0] - (MARK_BOX.x0 + MARK_BOX.x1) / 2) * 1.18, ty = LOGO_CY + (LEAD[0][1] - (LOGO_BOX.y0 + LOGO_BOX.y1) / 2) * 1.18;
  if (fold <= 0) bubble(c, s, 960, y, bk, { size, align: 'center', send: true, typed: P(t, 55.6, 56.1), label: '對 AI 說' });
  else if (t < LT0 + .62) { // the prompt folds into its send button, and the button becomes the pen tip that draws the logo
    const dx = (tx - sx) * fold, dy = (ty - sy) * fold, l2 = lerp(left, sx - h * .5, fold), r2 = lerp(left + w, sx + h * .5, fold);
    c.save(); c.translate(dx, dy); c.globalAlpha *= 1 - P(fold, .45, .9); card(c, l2, y, r2 - l2, h, lerp(h * .42, h / 2, fold), L.card, .9);
    c.save(); rr(c, l2, y, r2 - l2, h, h / 2); c.clip(); c.globalAlpha *= 1 - P(fold, 0, .4); txt(c, s, left + pad, y + h / 2 + 1, size, L.ink, 500, 'left'); c.restore();
    c.globalAlpha *= 1 - P(fold, 0, .3); txt(c, '對 AI 說', left + 6, y - 22, 18, L.muted, 500, 'left', M, 1); c.restore();
    dot(c, sx + dx, sy + dy, lerp(h * .3, 4, fold), K.teal); if (fold < .5) { c.save(); c.globalAlpha *= 1 - P(fold, 0, .5); sendBtn(c, sx + dx, sy + dy, h * .3); c.restore(); } }
  if (t > 55.7 && t < 56.8) { const e = 1 - eio(P(t, 55.7, 56.2)); c.save(); c.globalAlpha *= 1 - P(t, 56.4, 56.75); cursor(c, 1240 + e * 160, 476 + e * 160, P(t, 56.2, 56.6)); c.restore(); }
  if (t > LT0) brandLogo(c, t - LT0);
  fade(c, P(t, LT0 + 3.5, LT0 + 4.1), 16, () => rich(c, [['有些想法，', L.ink], ['值得動起來。', K.deep]], 960, 668, 44, 700, 1));
  // the address sits at the bottom of the frame
  fade(c, P(t, LT0 + 3.9, LT0 + 4.5), 12, () => { const w = tw(c, 'www.mografy.app', 26, 500, M, 1) + 60; box(c, 960 - w / 2, 966, w, 52, 26, alpha(K.teal, .1)); hair(c, 960 - w / 2, 966, w, 52, 26, alpha(K.teal, .35));
    txt(c, 'www.mografy.app', 960, 993, 26, K.deep, 500, 'center', M, 1); });
}
const FNS = [s01, s02, s03, s04, s05, s06, s07, s08, s09, s10, s11, s12];

// film time → shot + design time; sx > 1 plays a shot slower than its design times
const FILM = (() => { let f = 0; return SHOTS.map(s => { const d = (s.end - s.start) * (s.sx || 1), o = { a: f, b: f + d }; f += d; return o; }); })();
export const DUR = FILM[FILM.length - 1].b;
export const toFilm = (i, t) => FILM[i].a + (t - SHOTS[i].start) * (SHOTS[i].sx || 1);
export const BEATS = beats(SHOTS.map((s, i) => ({ title: s.slide ?? s.title, end: FILM[i].b, stop: s.stop })));
export function frame(c, T) {
  T = clamp(T, 0, DUR - .001);
  const i = FILM.findIndex(f => T < f.b), s = SHOTS[i], t = s.start + (T - FILM[i].a) / (s.sx || 1);
  c.save();
  ground(c, isLight(t));
  const u = T - FILM[i].a, pv = SHOTS[i - 1];
  if (s.xf && u < s.xf) { c.save(); FNS[i - 1](c, pv.end + u / (pv.sx || 1)); c.restore(); }
  c.save(); FNS[i](c, t); c.restore();
  // caption: the latest cue in this shot, fading out before the next cue or the shot end
  const cues = s.caps; let j = -1; cues.forEach(([at], q) => { if (t >= at) j = q; });
  if (j >= 0) { const [at, text] = cues[j], end = j + 1 < cues.length ? cues[j + 1][0] : s.end;
    caption(c, text, P(t, at, at + .4) * (1 - P(t, end - .3, end)), isLight(t)); }
  c.restore();
}

