// The 2D layer: one skeleton, three skins — ugly, pretty and wireframe — plus their animated states.
// Everything is drawn on 2D canvases in proportional coordinates, so the same code paints the 3D screen
// textures (1024 × 672) and the two full-frame 2D shots (S03, S11). Pure functions of their arguments.

export const SANS = 'Noto Sans CJK TC';     // registered at 500
export const SERIF = 'Noto Serif CJK TC';   // registered at 700
export const LABELS = ['提款', '存款', '轉帳', '查詢餘額'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type G = any;   // CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

/** The shared skeleton (fractions of the screen): title, four buttons in a 2 × 2 grid, footer. */
export const SK = {
  title: [0.08, 0.07, 0.92, 0.24],
  btn: [[0.08, 0.31, 0.48, 0.55], [0.52, 0.31, 0.92, 0.55], [0.08, 0.60, 0.48, 0.84], [0.52, 0.60, 0.92, 0.84]],
  foot: [0.08, 0.88, 0.92, 0.96],
};

export function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const outBack = (x: number) => { const c = 1.9; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
const outCubic = (x: number) => 1 - (1 - x) ** 3;
function rr(g: G, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const box = (b: number[], w: number, h: number) => [b[0]! * w, b[1]! * h, (b[2]! - b[0]!) * w, (b[3]! - b[1]!) * h] as const;
const font = (g: G, weight: number, px: number, fam: string, track = 0) => { g.font = `${weight} ${px}px "${fam}"`; g.letterSpacing = `${track}px`; };

// ---------------------------------------------------------------- the ugly skin
const UGLY_JIT = [[-0.012, 0.018, 0.03, -0.01], [0.02, -0.006, -0.01, 0.022], [-0.004, 0.01, 0.026, 0.0], [0.014, -0.02, -0.03, 0.012]];
const UGLY_COL = ['#8CFF2E', '#FF3FD0', '#FF8A00', '#FFF200'];
function star(g: G, x: number, y: number, s: number) {
  g.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, r2 = k % 2 ? s * 0.45 : s; g.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2); } g.closePath(); g.fill();
}
function uglyHome(g: G, w: number, h: number) {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#12C2D6'); gr.addColorStop(0.55, '#3A6BE0'); gr.addColorStop(1, '#7A1FD1');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const r = rng(7); g.fillStyle = 'rgba(255,255,140,.55)';
  for (let i = 0; i < 26; i++) star(g, r() * w, r() * h, 4 + r() * 9);
  g.save(); g.translate(w * 0.5, h * 0.165); g.rotate(-0.035);
  font(g, 700, h * 0.105, SERIF); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = h * 0.02; g.strokeStyle = '#FFF200'; g.lineJoin = 'round'; g.strokeText('歡迎光臨!!自動櫃員機', 0, 0);
  g.fillStyle = '#FF2020'; g.fillText('歡迎光臨!!自動櫃員機', 0, 0); g.restore();
  SK.btn.forEach((b, i) => {
    const j = UGLY_JIT[i]!;
    const [x, y, bw, bh] = box([b[0]! + j[0]!, b[1]! + j[1]!, b[2]! + j[2]!, b[3]! + j[1]! * 0.5], w, h);
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x + 10, y + 10, bw, bh);
    g.fillStyle = UGLY_COL[i]; g.fillRect(x, y, bw, bh);
    g.lineWidth = 7; g.strokeStyle = '#111'; g.strokeRect(x, y, bw, bh);
    g.fillStyle = i === 1 ? '#0A2BFF' : '#111';
    font(g, i === 2 ? 500 : 700, h * [0.085, 0.06, 0.075, 0.05][i]!, i === 2 ? SANS : SERIF); g.textBaseline = 'middle';
    g.textAlign = i === 0 ? 'left' : 'center';
    g.fillText(LABELS[i] + (i === 3 ? '>>>' : ''), i === 0 ? x + bw * 0.08 : x + bw / 2, y + bh * (0.5 + j[3]!));
  });
  const [fx, fy, , fh] = box(SK.foot, w, h);
  g.fillStyle = '#FFF200'; g.fillRect(0, fy - 4, w, fh + 10);
  g.fillStyle = '#E00000'; font(g, 700, h * 0.05, SERIF); g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('★★本行最新優惠★★利率超高★★立即辦理★★本行最新', fx - w * 0.03, fy + fh / 2 + 1);
}
function uglyError(g: G, w: number, h: number, k: number, shake: number) {
  if (k <= 0) return;
  const s = 0.55 + 0.45 * outBack(clamp(k));
  g.save(); g.translate(w * 0.5 + 9 + shake, h * 0.52); g.rotate(0.02); g.scale(s, s);
  const ew = w * 0.8, eh = h * 0.46;
  g.fillStyle = '#000'; g.fillRect(-ew / 2 + 14, -eh / 2 + 14, ew, eh);
  g.fillStyle = '#E11'; g.fillRect(-ew / 2, -eh / 2, ew, eh);
  g.lineWidth = 10; g.strokeStyle = '#111'; g.strokeRect(-ew / 2, -eh / 2, ew, eh);
  g.fillStyle = '#FFF200'; g.fillRect(-ew / 2, -eh / 2, ew, eh * 0.24);
  g.fillStyle = '#111'; font(g, 500, eh * 0.14, SANS); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('!! 錯誤 ERROR 0x1F !!', 0, -eh / 2 + eh * 0.12);
  g.fillStyle = '#fff'; font(g, 700, eh * 0.17, SERIF); g.fillText('交易失敗!!!', 0, eh * 0.02);
  font(g, 700, eh * 0.1, SERIF); g.fillText('請洽客服專線 0800-XXX-XXX', 0, eh * 0.28);
  g.restore();
}

// ---------------------------------------------------------------- the pretty skin
const ICONS: ((g: G, s: number) => void)[] = [
  (g, s) => { g.moveTo(-s, -s * .2); g.lineTo(0, s * .8); g.lineTo(s, -s * .2); g.moveTo(0, s * .8); g.lineTo(0, -s); },
  (g, s) => { g.moveTo(-s, s * .2); g.lineTo(0, -s * .8); g.lineTo(s, s * .2); g.moveTo(0, -s * .8); g.lineTo(0, s); },
  (g, s) => { g.moveTo(-s, -s * .4); g.lineTo(s, -s * .4); g.lineTo(s * .55, -s * .85); g.moveTo(s, s * .4); g.lineTo(-s, s * .4); g.lineTo(-s * .55, s * .85); },
  (g, s) => { g.arc(-s * .15, -s * .15, s * .62, 0, Math.PI * 2); g.moveTo(s * .3, s * .3); g.lineTo(s, s); },
];
function prettyHome(g: G, w: number, h: number) {
  g.fillStyle = '#F5EFE4'; g.fillRect(0, 0, w, h);
  const vg = g.createRadialGradient(w * .3, h * .1, 0, w * .3, h * .1, w); vg.addColorStop(0, 'rgba(255,250,240,.9)'); vg.addColorStop(1, 'rgba(230,214,190,0)');
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
  const [tx, ty, , th] = box(SK.title, w, h);
  g.fillStyle = '#C98A2E'; font(g, 500, h * 0.034, SANS, h * 0.012); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillText('ATM · 早安', tx, ty + th * 0.32);
  g.fillStyle = '#2C2824'; font(g, 500, h * 0.072, SANS); g.fillText('請選擇服務', tx, ty + th * 0.92);
  SK.btn.forEach((b, i) => {
    const [x, y, bw, bh] = box(b, w, h);
    g.fillStyle = 'rgba(90,60,30,.08)'; rr(g, x, y + 6, bw, bh, h * 0.04); g.fill();
    g.fillStyle = '#EADFCB'; rr(g, x, y, bw, bh, h * 0.04); g.fill();
    const cx = x + bh * 0.5, cy = y + bh * 0.5, cr = bh * 0.27;
    g.fillStyle = '#F7EEDC'; g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#C98A2E'; g.lineWidth = h * 0.009; g.lineCap = 'round'; g.lineJoin = 'round';
    g.save(); g.translate(cx, cy); g.beginPath(); ICONS[i]!(g, cr * 0.48); g.stroke(); g.restore();
    g.fillStyle = '#2C2824'; font(g, 500, h * 0.06, SANS); g.textBaseline = 'middle'; g.fillText(LABELS[i]!, x + bh * 0.95, cy + 2);
  });
  const [fx, fy, , fh] = box(SK.foot, w, h);
  g.fillStyle = '#9C9081'; font(g, 500, h * 0.032, SANS); g.textBaseline = 'middle'; g.fillText('插入卡片後開始', fx, fy + fh / 2);
}
function prettyError(g: G, w: number, h: number, k: number) {
  if (k <= 0) return;
  const e = outCubic(clamp(k));
  g.fillStyle = `rgba(44,40,36,${.18 * e})`; g.fillRect(0, 0, w, h);
  const cw = w * 0.84, chh = h * 0.34, cx = (w - cw) / 2, cy = h - chh - h * 0.06 + (1 - e) * h * 0.45;
  g.fillStyle = 'rgba(60,40,20,.18)'; rr(g, cx, cy + 10, cw, chh, h * 0.05); g.fill();
  g.fillStyle = '#FFFDF8'; rr(g, cx, cy, cw, chh, h * 0.05); g.fill();
  g.fillStyle = '#F2D9A8'; g.beginPath(); g.arc(cx + chh * 0.42, cy + chh * 0.5, chh * 0.2, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#C98A2E'; font(g, 500, chh * 0.24, SANS); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', cx + chh * 0.42, cy + chh * 0.51);
  g.textAlign = 'left'; g.fillStyle = '#2C2824'; font(g, 500, chh * 0.17, SANS); g.fillText('好像沒讀到卡片', cx + chh * 0.8, cy + chh * 0.36);
  g.fillStyle = '#8A7E70'; font(g, 500, chh * 0.12, SANS); g.fillText('再插一次就好', cx + chh * 0.8, cy + chh * 0.66);
  g.fillStyle = '#2C2824'; rr(g, cx + cw - chh * 1.25, cy + chh * 0.3, chh * 1.0, chh * 0.4, chh * 0.2); g.fill();
  g.fillStyle = '#F5EFE4'; font(g, 500, chh * 0.13, SANS); g.textAlign = 'center'; g.fillText('再試一次', cx + cw - chh * 0.75, cy + chh * 0.51);
}
function prettyOk(g: G, w: number, h: number, k: number) {
  if (k <= 0) return;
  g.fillStyle = `rgba(245,239,228,${.88 * clamp(k * 3)})`; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#C98A2E'; g.lineWidth = h * 0.02; g.lineCap = 'round'; g.lineJoin = 'round';
  const a = clamp(k * 1.6), c = clamp(k * 2 - .8);
  g.beginPath(); g.arc(w / 2, h * 0.45, h * 0.15, -Math.PI / 2, -Math.PI / 2 + a * Math.PI * 2); g.stroke();
  if (c > 0) {
    const p = [[w / 2 - h * 0.07, h * 0.45], [w / 2 - h * 0.015, h * 0.51], [w / 2 + h * 0.08, h * 0.39]];
    g.beginPath(); g.moveTo(p[0]![0], p[0]![1]);
    const seg = c * 2; if (seg < 1) g.lineTo(p[0]![0] + (p[1]![0] - p[0]![0]) * seg, p[0]![1] + (p[1]![1] - p[0]![1]) * seg);
    else { g.lineTo(p[1]![0], p[1]![1]); g.lineTo(p[1]![0] + (p[2]![0] - p[1]![0]) * (seg - 1), p[1]![1] + (p[2]![1] - p[1]![1]) * (seg - 1)); }
    g.stroke();
  }
  g.fillStyle = `rgba(44,40,36,${clamp(k * 2 - 1)})`; font(g, 500, h * 0.06, SANS); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('完成', w / 2, h * 0.73);
}
/** Crash: horizontal slices of the screen torn sideways, colour fringes, then a dim veil and a spinner. */
function crash(g: G, src: G, w: number, h: number, k: number, t: number) {
  const r = rng(31 + Math.floor(t * 12) * 7);
  let y = 0;
  while (y < h) {
    const bh = 8 + r() * 46, dx = (r() - .5) * w * (r() < .35 ? 0.22 : 0.05) * k;
    g.drawImage(src.canvas, 0, y, w, bh, dx, y, w, bh);
    if (r() < .3 * k) { g.fillStyle = r() < .5 ? 'rgba(255,60,80,.25)' : 'rgba(60,200,255,.22)'; g.fillRect(0, y, w, bh); }
    y += bh;
  }
  g.fillStyle = `rgba(30,26,22,${.5 * k})`; g.fillRect(0, 0, w, h);
  const a0 = Math.floor(t * 12) / 12 * 7;   // on 2s, so the screen only changes 12 times a second
  g.lineCap = 'round'; g.lineWidth = h * 0.02;
  g.strokeStyle = `rgba(245,239,228,${.3 * k})`; g.beginPath(); g.arc(w / 2, h / 2, h * 0.11, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = `rgba(245,239,228,${k})`; g.beginPath(); g.arc(w / 2, h / 2, h * 0.11, a0, a0 + 1.7); g.stroke();
}

// ---------------------------------------------------------------- the wireframe
export function wire(g: G, w: number, h: number, o: { bg?: string; ink?: string; seed?: number; flaws?: number } = {}) {
  g.fillStyle = o.bg ?? '#EFEBE3'; g.fillRect(0, 0, w, h);
  const ink = o.ink ?? '#6E655B';
  g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = Math.max(2, h * 0.006); g.setLineDash([]); g.lineCap = 'round';
  const r = rng(o.seed ?? 3), wob = 2.2;
  const line = (x0: number, y0: number, x1: number, y1: number) => { g.beginPath(); g.moveTo(x0 + (r() - .5) * wob, y0 + (r() - .5) * wob); g.quadraticCurveTo((x0 + x1) / 2 + (r() - .5) * wob * 2, (y0 + y1) / 2 + (r() - .5) * wob * 2, x1 + (r() - .5) * wob, y1 + (r() - .5) * wob); g.stroke(); };
  const rect = (x: number, y: number, bw: number, bh: number, cross: boolean) => { line(x, y, x + bw, y); line(x + bw, y, x + bw, y + bh); line(x + bw, y + bh, x, y + bh); line(x, y + bh, x, y); if (cross) { g.globalAlpha = .35; line(x, y, x + bw, y + bh); line(x + bw, y, x, y + bh); g.globalAlpha = 1; } };
  const [tx, ty, tw, th] = box(SK.title, w, h);
  rect(tx, ty + th * 0.45, tw * 0.5, th * 0.45, false);
  font(g, 500, h * 0.034, SANS); g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText('TITLE', tx + 10, ty + th * 0.68);
  SK.btn.forEach((b, i) => {
    const [x, y, bw, bh] = box(b, w, h); rect(x, y, bw, bh, true);
    font(g, 500, h * 0.04, SANS); g.textAlign = 'center'; g.fillText(`BTN ${i + 1}  ${LABELS[i]}`, x + bw / 2, y + bh / 2);
  });
  const [fx, fy, fw, fh] = box(SK.foot, w, h); rect(fx, fy, fw * 0.4, fh, false);
  if (o.flaws) {   // S11: what the pretty skin was hiding — a "next" button too small to hit, a path that leads nowhere
    const [x, y, bw, bh] = box(SK.btn[3]!, w, h);
    g.globalAlpha = .85; g.fillRect(x + bw * 0.86, y + bh * 0.08, bw * 0.08, bh * 0.14); g.globalAlpha = 1;
    const [x2, y2] = box(SK.btn[2]!, w, h);
    g.setLineDash([10, 8]); line(x2 + w * 0.2, y2 + h * 0.24, x2 + w * 0.2, h * 0.99); g.setLineDash([]);
  }
}
function off(g: G, w: number, h: number) {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#26221E'); gr.addColorStop(1, '#141210');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const s = g.createLinearGradient(w * .2, 0, w * .55, h); s.addColorStop(0, 'rgba(255,240,220,0)'); s.addColorStop(.5, 'rgba(255,240,220,.07)'); s.addColorStop(1, 'rgba(255,240,220,0)');
  g.fillStyle = s; g.beginPath(); g.moveTo(w * .25, 0); g.lineTo(w * .42, 0); g.lineTo(w * .2, h); g.lineTo(w * .03, h); g.fill();
}

// ---------------------------------------------------------------- cached skins and the animated screen
const cache = new Map<string, OffscreenCanvas>();
export function skin(kind: 'ugly' | 'pretty' | 'wire' | 'flaws' | 'off', w: number, h: number) {
  const key = `${kind}-${w}x${h}`;
  let c = cache.get(key);
  if (!c) {
    c = new OffscreenCanvas(w, h); const g = c.getContext('2d')!;
    if (kind === 'ugly') uglyHome(g, w, h); else if (kind === 'pretty') prettyHome(g, w, h);
    else if (kind === 'off') off(g, w, h); else wire(g, w, h, { flaws: kind === 'flaws' ? 1 : 0, seed: kind === 'flaws' ? 8 : 3 });
    cache.set(key, c);
  }
  return c;
}

export type Mode = 'off' | 'boot' | 'home' | 'error' | 'ok' | 'crash';
export interface ScreenState { mode: Mode; k: number; t: number; shake?: number; frame?: number }

/** Paint one ATM screen at time t. `k` is the progress of the current mode's entrance (0 → 1). */
export function paintScreen(g: G, w: number, h: number, kind: 'ugly' | 'pretty', s: ScreenState) {
  g.save(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  if (s.mode === 'off') { g.drawImage(skin('off', w, h), 0, 0); g.restore(); return; }
  if (s.mode === 'boot') {
    g.drawImage(skin('off', w, h), 0, 0);
    if (kind === 'ugly') {   // a harsh flicker, frame by frame
      const pattern = [1, 0, 1, .3, 1, 0, 1, 1], f = Math.min(pattern.length - 1, Math.floor(s.k * pattern.length));
      g.globalAlpha = pattern[f]!; g.drawImage(skin('ugly', w, h), 0, 0);
    } else { g.globalAlpha = outCubic(clamp(s.k)); g.drawImage(skin('pretty', w, h), 0, 0); }
    g.restore(); return;
  }
  g.drawImage(skin(kind, w, h), 0, 0);
  if (s.mode === 'error') kind === 'ugly' ? uglyError(g, w, h, s.k, s.shake ?? 0) : prettyError(g, w, h, s.k);
  else if (s.mode === 'ok' && kind === 'pretty') { prettyError(g, w, h, 1 - clamp(s.k * 4)); prettyOk(g, w, h, s.k); }
  else if (s.mode === 'crash') crash(g, skin(kind, w, h).getContext('2d'), w, h, clamp(s.k), s.t);
  g.restore();
}
