// 2D paper layer: palette, textures baked in setup, puppet cards, story cards and the flat 2D inserts.
// Everything that allocates a canvas runs in setup (bakeKit); the draw* functions only draw.
import type { SetupContext } from '@mografy/runtime';

export const W = 1920, H = 1080, TAU = Math.PI * 2;
export type C2 = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type Img = ImageBitmap | OffscreenCanvas | HTMLImageElement;

export const C = {
  ivory: '#FFF7EB', pink: '#F8A3C8', lav: '#B99BDD', violet: '#9977BD', plum: '#30122E', moon: '#FFE49B',
  rose: '#CC528B', gold: '#E2B055', gold2: '#B8862F', wood: '#6E4634',
  gun0: '#070C26', gun1: '#0E1A4F', gun2: '#1C2F7A', gun3: '#3A56A8', gun4: '#7E9AD6', red: '#C8344F',
};
export const SERIF = '"LPC Serif TC", serif', LAT = '"Inter Display", sans-serif';

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ease = (t: number) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const eo = (t: number) => 1 - Math.pow(1 - t, 3);
export const P = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const on2 = (t: number) => Math.floor(t * 12 + 1e-6) / 12; // stop motion: 12 poses a second

export function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function cv(w: number, h: number) { return new OffscreenCanvas(Math.ceil(w), Math.ceil(h)); }
const g2 = (c: OffscreenCanvas) => c.getContext('2d')! as OffscreenCanvasRenderingContext2D;

// ---------- paper grain ----------
let GRAIN: OffscreenCanvas;
function makeGrain() {
  const c = cv(1024, 1024), g = g2(c), d = g.createImageData(1024, 1024), r = rng(7);
  for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() - .5) * 70; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0);
  g.globalAlpha = .08; g.strokeStyle = '#fff'; g.lineWidth = 1;
  for (let i = 0; i < 900; i++) { const x = r() * 1024, y = r() * 1024, a = r() * TAU, l = 6 + r() * 22; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + .6) * l * .5, y + Math.sin(a + .6) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  return c;
}
export function grain(g: C2, w: number, h: number, a = .12, mode: GlobalCompositeOperation = 'overlay', ox = 0, oy = 0) {
  g.save(); g.globalCompositeOperation = mode; g.globalAlpha = a;
  for (let y = -oy; y < h; y += 1024) for (let x = -ox; x < w; x += 1024) g.drawImage(GRAIN, x, y);
  g.restore();
}
/** Grain only where the canvas is already painted (grain() alone would also tint transparent pixels). */
export function grainIn(g: C2, w: number, h: number, a = .15) {
  const m = cv(w, h); g2(m).drawImage(g.canvas as OffscreenCanvas, 0, 0);
  grain(g, w, h, a, 'soft-light'); g.save(); g.globalCompositeOperation = 'destination-in'; g.drawImage(m, 0, 0); g.restore();
}
export function starPath(g: C2, x: number, y: number, r: number, r2 = r * .45, n = 5, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) { const rr = i % 2 ? r2 : r, a = rot + i * Math.PI / n; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath();
}
export function vtext(g: C2, text: string, x: number, y: number, size: number, col: string, lh = 1.08) {
  g.save(); g.font = `700 ${size}px ${SERIF}`; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
  let yy = y;
  for (const ch of text) {
    if ('，。、'.includes(ch)) g.fillText(ch, x + size * .32, yy - size * .28);
    else if (ch === '…') { g.save(); g.translate(x, yy); g.rotate(Math.PI / 2); g.fillText(ch, 0, 0); g.restore(); }
    else g.fillText(ch, x, yy);
    yy += size * lh;
  }
  g.restore();
  return yy;
}

// ---------- puppet cards ----------
export type Pose = { front: OffscreenCanvas; back: OffscreenCanvas; sil: OffscreenCanvas };
function recolor(src: OffscreenCanvas, mode: 'duo' | 'sil') {
  const w = src.width, h = src.height, c = cv(w, h), g = g2(c);
  g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, w, h), p = d.data;
  const A = [0x30, 0x12, 0x2E], M = [0xB9, 0x9B, 0xDD], L = [0xF6, 0xEE, 0xFC];
  for (let i = 0; i < p.length; i += 4) {
    if (mode === 'sil') { p[i] = 0x1a; p[i + 1] = 0x10; p[i + 2] = 0x38; continue; }
    const l = (p[i]! * .3 + p[i + 1]! * .55 + p[i + 2]! * .15) / 255;
    const [a, b] = l < .55 ? [A, M] : [M, L], t = l < .55 ? l / .55 : (l - .55) / .45;
    p[i] = a[0]! + (b[0]! - a[0]!) * t; p[i + 1] = a[1]! + (b[1]! - a[1]!) * t; p[i + 2] = a[2]! + (b[2]! - a[2]!) * t;
  }
  g.putImageData(d, 0, 0); return c;
}
/** A die-cut paper card of a figure: white cut border; `duo` = lavender duotone printed on the back (mirrored). */
export function dieCut(img: Img, scale: number, border: number, mode: 'plain' | 'duo' | 'sil') {
  const iw = Math.round(img.width * scale), ih = Math.round(img.height * scale), pad = border + 6, w = iw + pad * 2, h = ih + pad * 2;
  const base = cv(w, h); g2(base).drawImage(img as CanvasImageSource, pad, pad, iw, ih);
  const art = mode === 'plain' ? base : recolor(base, mode);
  const out = cv(w, h), g = g2(out);
  if (border > 0) {
    const ring = cv(w, h), r = g2(ring);
    for (let a = 0; a < 24; a++) r.drawImage(art, Math.cos(a / 24 * TAU) * border, Math.sin(a / 24 * TAU) * border);
    r.globalCompositeOperation = 'source-in'; r.fillStyle = '#FFFBF4'; r.fillRect(0, 0, w, h);
    g.drawImage(ring, 0, 0);
  }
  g.drawImage(art, 0, 0);
  if (mode === 'duo') {
    grain(g, w, h, .1, 'soft-light');
    const m = cv(w, h), mg = g2(m); mg.translate(w, 0); mg.scale(-1, 1); mg.drawImage(out, 0, 0); return m;
  }
  return out;
}
export function duoImage(img: Img, sx: number, sy: number, sw: number, sh: number, scale = 1) {
  const c = cv(sw * scale, sh * scale); g2(c).drawImage(img as CanvasImageSource, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return recolor(c, 'duo');
}

// ---------- baked kit ----------
export const POSES = ['char', 'happy', 'moonlight', 'sad', 'mooncake', 'arrival', 'lantern', 'rhythm'] as const;
export type PoseKey = typeof POSES[number];
export const FILES: Record<string, string> = {
  turn: 'portrait-turnaround.png', end: 'end-stage.png',
  mark: 'lunar-pop-rabbit-mark-v1.webp', starmap: 'lunar-rabbit-star-map-bg-v1.webp', garden: 'lunar-rabbit-lantern-garden-bg-v1.webp',
  nightfoot: 'lunar-rabbit-night-sky-footer-v1.webp', stagev2: 'momo-moon-rabbit-stage-v2.webp', paper: 'momo-paper-bg.webp',
  happy: 'momo-moon-rabbit-hero-happy-v2.webp', moonlight: 'momo-moon-rabbit-moonlight-v1.webp', sad: 'momo-moon-rabbit-practice-sad.webp',
  mooncake: 'momo-moon-rabbit-mooncake-v1.webp', arrival: 'momo-moon-rabbit-arrival-v1.webp', lantern: 'momo-moon-rabbit-lantern-dance-v1.webp',
  rhythm: 'momo-moon-rabbit-rhythm-v1.webp',
};
export interface Kit {
  img: Record<string, ImageBitmap>;
  pose: Record<string, Pose>;
  bg: { garden: OffscreenCanvas; starmap: OffscreenCanvas; stagev2: OffscreenCanvas; starNight: OffscreenCanvas; footNight: OffscreenCanvas };
  profile: OffscreenCanvas; sadDuo: OffscreenCanvas;
  cards: OffscreenCanvas[]; poster: OffscreenCanvas; washi: OffscreenCanvas;
  town2d: OffscreenCanvas; town2dFar: OffscreenCanvas; train2d: OffscreenCanvas; win2d: number[][]; clouds2d: OffscreenCanvas[]; cloudBank: OffscreenCanvas; waves2d: OffscreenCanvas;
  r: { bokeh: number[][]; stars: number[][]; petals: number[][] };
}
function tinted(img: Img, col: string, a: number, blur: number, bright: number, w = W, h = H, pad = 60, crop?: [number, number, number, number]) {
  const c = cv(w, h), g = g2(c);
  g.filter = `blur(${blur}px) brightness(${bright})`;
  if (crop) g.drawImage(img as CanvasImageSource, crop[0], crop[1], crop[2], crop[3], -pad, -pad * .6, w + pad * 2, h + pad * 1.2);
  else g.drawImage(img as CanvasImageSource, -pad, -pad * .6, w + pad * 2, h + pad * 1.2);
  g.filter = 'none';
  g.globalCompositeOperation = 'color'; g.globalAlpha = a; g.fillStyle = col; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; grain(g, w, h, .1, 'soft-light');
  return c;
}
export function chapterCard(k: { img: Record<string, ImageBitmap>; pose: Record<string, Pose> }, n: number) {
  const c = cv(W, H), g = g2(c);
  const bgs = [[C.gun1, C.gun2], ['#3a0f33', C.rose], [C.gun2, C.lav]][n - 1]!;
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, bgs[0]!); gr.addColorStop(1, bgs[1]!); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const r = rng(20 + n);
  for (let i = 0; i < 40; i++) { starPath(g, r() * W, r() * H, 6 + r() * 18); g.fillStyle = r() < .5 ? C.gold : 'rgba(255,255,255,.6)'; g.fill(); }
  g.fillStyle = 'rgba(255,228,155,.95)'; g.beginPath(); g.arc(1300, 560, 380, 0, TAU); g.fill();
  const F = k.pose[['arrival', 'mooncake', 'rhythm'][n - 1]!]!.front, fh = 1000, fw = fh * F.width / F.height;
  g.save(); g.shadowColor = 'rgba(10,0,30,.45)'; g.shadowBlur = 30; g.shadowOffsetX = 14; g.shadowOffsetY = 14; g.drawImage(F, 1300 - fw / 2, 50, fw, fh); g.restore();
  g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 24; g.shadowOffsetY = 10; g.drawImage(k.img.paper!, 150, 150, 520, 780); g.restore();
  g.strokeStyle = C.gold; g.lineWidth = 6; g.strokeRect(176, 176, 468, 728);
  g.fillStyle = C.plum; g.font = `600 140px ${LAT}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText('0' + n, 410, 330);
  vtext(g, ['登場', '魅力', '節拍'][n - 1]!, 410, 470, 130, C.plum);
  g.fillStyle = C.rose; g.font = `600 26px ${LAT}`; g.letterSpacing = '6px'; g.fillText(['FIRST APPEARANCE', 'IRRESISTIBLE CHARM', 'FIND YOUR RHYTHM'][n - 1]!, 410, 850); g.letterSpacing = '0px';
  grain(g, W, H, .16);
  return c;
}
export async function bakeKit(ctx: SetupContext): Promise<Kit> {
  const img: Record<string, ImageBitmap> = {};
  await Promise.all(Object.entries(FILES).map(async ([k, f]) => { img[k] = await ctx.loadImage('assets/' + f) as ImageBitmap; }));
  GRAIN = makeGrain();
  const pose: Record<string, Pose> = {};
  // backs (lavender duotone) only where the film shows them; the shadow silhouette only for the shadow play
  const NEEDS_BACK = new Set(['moonlight', 'sad', 'mooncake']);
  for (const k of POSES) {
    if (k === 'char') continue;
    const im = img[k]!, s = 960 / Math.max(im.width, im.height); // cards at ~960 px tall
    const front = dieCut(im, s, 11, 'plain');
    pose[k] = { front, back: NEEDS_BACK.has(k) ? dieCut(im, s, 11, 'duo') : front, sil: k === 'moonlight' ? dieCut(im, s * .5, 0, 'sil') : front };
  }
  const T = img.turn!, half = T.width / 2;
  const kit0 = { img, pose };
  // 2D inserts' baked backgrounds (filters run here, once)
  const bg = {
    garden: tinted(img.garden!, '#2340b0', .55, 16, .55),
    starmap: tinted(img.starmap!, '#2846c0', .5, 0, 1.15, W, H, 80),
    stagev2: tinted(img.stagev2!, '#b0306a', .25, 10, .7, W, H, 80),
    starNight: tinted(img.starmap!, '#2a48c8', .55, 0, 1.15, 2048, 1152, 0, [0, img.starmap!.height * .18, img.starmap!.width * .6, img.starmap!.height * .6 * 1152 / 2048 * (img.starmap!.width / img.starmap!.height)]),
    footNight: tinted(img.nightfoot!, '#3050d0', .45, 0, 1.6, 2048, 1152, 0),
  };
  const profile = duoImage(T, 0, 0, half, T.height);
  const S = img.sad!, sadDuo = duoImage(S, 0, 0, S.width, Math.round(S.height * .66));
  { const g = g2(sadDuo), fg = g.createLinearGradient(0, sadDuo.height * .62, 0, sadDuo.height); fg.addColorStop(0, 'rgba(0,0,0,1)'); fg.addColorStop(1, 'rgba(0,0,0,0)'); g.globalCompositeOperation = 'destination-in'; g.fillStyle = fg; g.fillRect(0, 0, sadDuo.width, sadDuo.height); }
  const cards = [1, 2, 3].map(n => chapterCard(kit0, n));
  // poster (static part)
  const poster = cv(W, H); {
    const g = g2(poster); g.drawImage(bg.stagev2, 0, 0);
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, 'rgba(14,26,79,.85)'); gr.addColorStop(.5, 'rgba(90,22,72,.35)'); gr.addColorStop(1, 'rgba(204,82,139,.2)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,120,150,.9)'; g.beginPath(); g.arc(1180, 520, 420, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,228,155,.95)'; g.beginPath(); g.arc(1180, 520, 330, 0, TAU); g.fill();
    const F = pose.lantern!.front, fh = 1080, fw = fh * F.width / F.height; g.save(); g.shadowColor = 'rgba(30,0,30,.5)'; g.shadowBlur = 40; g.shadowOffsetX = 18; g.shadowOffsetY = 18; g.drawImage(F, 1180 - fw / 2, 30, fw, fh); g.restore();
  }
  // washi wipe panel
  const washi = cv(W + 200, H); {
    const g = g2(washi); const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#9DB6EE'); gr.addColorStop(1, '#E9F0FF'); g.fillStyle = gr; g.fillRect(0, 0, W + 200, H);
    g.strokeStyle = 'rgba(20,20,40,.75)'; g.lineWidth = 16; for (let x = 0; x <= W + 200; x += (W + 200) / 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y <= H; y += H / 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(W + 200, y); g.stroke(); }
    g.fillStyle = '#3a2216'; g.fillRect(W + 170, 0, 30, H); grain(g, W + 200, H, .2, 'soft-light');
  }
  // flat paper town strip, cloud flats and ukiyo-e wave band for the 2D inserts
  // the 2D city for S04: a hazy tower skyline (behind her), an elevated line with a small train, dark blocks in front whose windows light up
  const town2dFar = cv(W + 400, 460), win2d: number[][] = []; {
    const g = g2(town2dFar), r = rng(13); let x = 0;
    while (x < W + 400) {
      const w = 50 + r() * 110, h = 200 + r() * 250, y = 460 - h; g.fillStyle = r() < .5 ? '#2c3d8c' : '#33479a'; g.fillRect(x, y, w, h);
      if (r() < .3) { g.fillRect(x + w / 2 - 2, y - 70, 4, 70); g.fillStyle = '#ff5050'; g.beginPath(); g.arc(x + w / 2, y - 70, 3.5, 0, TAU); g.fill(); }
      else if (r() < .3) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w / 2, y - 50); g.lineTo(x + w, y); g.fill(); }
      for (let wy = y + 14; wy < 450; wy += 18) for (let wx = x + 8; wx < x + w - 10; wx += 13) { const lit = r() < .3; g.fillStyle = lit ? 'rgba(255,220,150,.55)' : 'rgba(10,16,50,.45)'; g.fillRect(wx, wy, 6, 9); }
      x += w + 2 + r() * 8;
    }
    g.globalCompositeOperation = 'source-atop'; const hz = g.createLinearGradient(0, 0, 0, 460); hz.addColorStop(0, 'rgba(160,180,240,.1)'); hz.addColorStop(1, 'rgba(160,180,240,.28)'); g.fillStyle = hz; g.fillRect(0, 0, W + 400, 460);
    g.globalCompositeOperation = 'source-over'; grainIn(g, W + 400, 460);
    g.fillStyle = '#0d1546'; g.fillRect(0, 196, W + 400, 10); g.fillStyle = '#5a74c0'; g.fillRect(0, 196, W + 400, 2); // the elevated line
    for (let px = 40; px < W + 400; px += 220) { g.fillStyle = '#0d1546'; g.fillRect(px, 206, 12, 254); }
  }
  const train2d = cv(560, 70); { const g = g2(train2d);
    g.fillStyle = '#0d1546'; g.beginPath(); g.roundRect(0, 18, 120, 44, 12); g.fill(); g.fillRect(24, 4, 16, 18);
    for (let k = 0; k < 3; k++) { const x = 136 + k * 140; g.fillStyle = '#0d1546'; g.beginPath(); g.roundRect(x, 14, 130, 48, 8); g.fill(); for (let j = 0; j < 4; j++) { g.fillStyle = '#FFD27A'; g.fillRect(x + 12 + j * 30, 24, 20, 18); } }
    g.fillStyle = '#FFF1C9'; g.beginPath(); g.arc(8, 38, 6, 0, TAU); g.fill(); g.fillStyle = '#FFD27A'; g.fillRect(84, 26, 22, 16); }
  const town2d = cv(W + 400, 300); {
    const g = g2(town2d), r = rng(12); let x = 0;
    while (x < W + 400) {
      const w = 110 + r() * 170, h = 110 + r() * 170, y = 300 - h; g.fillStyle = '#0a1240'; g.fillRect(x, y, w, h);
      if (r() < .35) { g.fillRect(x + w * .6, y - 22, 26, 22); }
      for (let wy = y + 18; wy < 270; wy += 30) for (let wx = x + 14; wx < x + w - 22; wx += 26) { const v = r(); if (v < .35) { g.fillStyle = '#FFD27A'; g.fillRect(wx, wy, 14, 18); } else { g.fillStyle = 'rgba(40,50,110,.6)'; g.fillRect(wx, wy, 14, 18); if (v < .6) win2d.push([wx, wy, r()]); } }
      x += w + 4;
    }
    grainIn(g, W + 400, 300);
    win2d.sort((a, b) => a[2]! - b[2]!);
  }
  const cloud = (col: string, edge: string) => {
    const c = cv(680, 300), g = g2(c); g.translate(340, 150);
    const puffs: [number, number, number][] = [[-230, 20, 62], [-150, -14, 80], [-50, -36, 96], [60, -26, 88], [160, -8, 74], [240, 18, 56], [-170, 50, 52], [-70, 58, 60], [40, 60, 62], [150, 52, 54]];
    g.fillStyle = col; g.shadowColor = 'rgba(5,10,40,.4)'; g.shadowBlur = 26; g.shadowOffsetY = 12;
    g.beginPath(); for (const [x, y, r] of puffs) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); } g.fill(); g.shadowColor = 'transparent';
    g.globalCompositeOperation = 'source-atop'; const sh = g.createLinearGradient(0, -120, 0, 120); sh.addColorStop(0, 'rgba(255,255,255,.18)'); sh.addColorStop(1, 'rgba(40,40,110,.22)'); g.fillStyle = sh; g.fillRect(-340, -150, 680, 300); g.globalCompositeOperation = 'source-over';
    g.strokeStyle = edge; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); for (const [x, y, r] of [[-120, 10, 22], [0, -6, 26], [110, 12, 22]] as const) { g.moveTo(x + r * Math.cos(Math.PI * 1.15), y + r * Math.sin(Math.PI * 1.15)); g.arc(x, y, r, Math.PI * 1.15, Math.PI * 1.95); } g.stroke();
    grain(g, 680, 300, .18, 'soft-light'); return c;
  };
  const clouds2d = [cloud('#5C7BC4', '#7E9AD6'), cloud('#E8E2F2', '#C4BCD8')];
  const cloudBank = cv(3600, H); {
    const g = g2(cloudBank), rr = rng(71);
    const bank = (x0: number, x1: number, col: string, shade: string, seed: number) => {
      const r = rng(seed); g.beginPath();
      g.rect(x0, 0, x1 - x0, H);
      for (let y = -60; y < H + 120; y += 110) { const rad = 120 + r() * 90; g.moveTo(x0 + 40 + rad, y); g.arc(x0 + 40 - r() * 120, y, rad, 0, TAU); }
      for (let y = -60; y < H + 120; y += 120) { const rad = 110 + r() * 80; g.moveTo(x1 + rad, y); g.arc(x1 + r() * 100, y, rad, 0, TAU); }
      g.save(); g.shadowColor = 'rgba(10,14,50,.45)'; g.shadowBlur = 50; g.shadowOffsetX = -24; g.fillStyle = col; g.fill(); g.restore();
      g.save(); g.clip(); const sh = g.createLinearGradient(0, 0, 0, H); sh.addColorStop(0, 'rgba(255,255,255,.25)'); sh.addColorStop(1, shade); g.fillStyle = sh; g.fillRect(x0 - 400, 0, x1 - x0 + 800, H); g.restore();
    };
    bank(760, 3050, '#B8A9DD', 'rgba(60,50,120,.25)', 7);
    bank(560, 2900, '#F1ECF8', 'rgba(90,80,150,.22)', 9);
    g.strokeStyle = 'rgba(160,140,205,.8)'; g.lineWidth = 7; g.lineCap = 'round';
    for (let i = 0; i < 26; i++) { const x = 760 + rr() * 2000, y = rr() * H, rad = 26 + rr() * 30; g.beginPath(); g.arc(x, y, rad, Math.PI * 1.1, Math.PI * 1.95); g.stroke(); }
    g.strokeStyle = 'rgba(226,176,85,.7)'; g.lineWidth = 4;
    for (let i = 0; i < 10; i++) { const x = 800 + rr() * 1900, y = rr() * H, rad = 18 + rr() * 16; g.beginPath(); g.arc(x, y, rad, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    grain(g, 3600, H, .16, 'soft-light');
  }
  const waves2d = cv(W + 520, 180); {
    const g = g2(waves2d);
    for (let x = 0; x < W + 520; x += 260) { g.fillStyle = C.gun2; g.beginPath(); g.moveTo(x, 180); g.lineTo(x, 100); g.bezierCurveTo(x + 60, 0, x + 200, 0, x + 240, 60); g.bezierCurveTo(x + 200, 40, x + 170, 90, x + 210, 110); g.lineTo(x + 260, 180); g.fill();
      g.strokeStyle = C.ivory; g.lineWidth = 6; g.beginPath(); g.moveTo(x + 20, 100); g.bezierCurveTo(x + 70, 25, x + 190, 25, x + 232, 62); g.stroke(); g.fillStyle = C.ivory; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + 232 - k * 16, 70 - k * 6, 6, 0, TAU); g.fill(); } }
  }
  const r = rng(4);
  return {
    img, pose, bg, profile, sadDuo, cards, poster, washi, town2d, town2dFar, train2d, win2d, clouds2d, cloudBank, waves2d,
    r: {
      bokeh: Array.from({ length: 60 }, () => [r() * W, 760 + r() * 360, 10 + r() * 40, r(), r() * 4]),
      stars: Array.from({ length: 34 }, () => [r() * W, r() * H, 8 + r() * 26]),
      petals: Array.from({ length: 140 }, () => [r() * W, r(), r(), r() * TAU, .6 + r() * .8]),
    },
  };
}

// ---------- story cards (2D overlay hanging on strings) ----------
/** Two-column vertical ivory card lowered on strings (right column first); `drop` 0 = above frame, 1 = hanging. */
export function storyCard(O: C2, lines: string, x: number, y: number, size: number, drop: number, sway = 0) {
  if (drop <= 0.001) return;
  const [l1, l2] = lines.split('／') as [string, string?];
  const n = Math.max([...l1].length, [...(l2 ?? '')].length), hh = n * size * 1.08 + size * .9, ww = size * (l2 ? 2.7 : 1.7);
  const yy = lerp(-hh - 40, y, drop);
  O.save();
  O.strokeStyle = 'rgba(240,232,215,.8)'; O.lineWidth = 2; for (const s of [-1, 1]) { O.beginPath(); O.moveTo(x + s * ww * .3, 0); O.lineTo(x + s * ww * .3 + sway * 30, yy); O.stroke(); }
  O.translate(x, yy); O.rotate(sway * .02);
  O.shadowColor = 'rgba(0,0,0,.45)'; O.shadowBlur = 24; O.shadowOffsetY = 10;
  O.fillStyle = C.ivory; O.fillRect(-ww / 2, 0, ww, hh); O.shadowColor = 'transparent';
  O.strokeStyle = C.gold; O.lineWidth = 3; O.strokeRect(-ww / 2 + 12, 12, ww - 24, hh - 24);
  if (l2) { vtext(O, l1, size * .62, size * .9, size, C.plum); vtext(O, l2, -size * .62, size * .9, size, C.plum); }
  else vtext(O, l1, 0, size * .9, size, C.plum);
  O.fillStyle = C.red; O.fillRect(-ww / 2 + 22, hh - 62, 38, 38); O.fillStyle = C.ivory; O.font = `700 26px ${SERIF}`; O.textAlign = 'center'; O.textBaseline = 'middle'; O.fillText('月', -ww / 2 + 41, hh - 43);
  O.restore();
}

// ---------- 2D inserts ----------
export function drawS04(O: C2, k: Kit, t: number) { // her eyes, over the night city
  const u = P(t, 12, 16), z = 1 + .06 * ease(u), tt = on2(t);
  O.save(); O.translate(W / 2, H / 2); O.scale(z, z); O.translate(-W / 2, -H / 2);
  O.drawImage(k.bg.garden, 0, 0);
  for (const [x, y, rr, a, ph] of k.r.bokeh) { const on = (tt * 3 + ph!) % 4 > 1.2; O.fillStyle = `rgba(255,${200 + a! * 40},${110 + a! * 50},${on ? .3 + a! * .3 : .06})`; O.beginPath(); O.arc(x!, y!, rr! * .8, 0, TAU); O.fill(); }
  // the skyline behind her, drifting slower than the blocks in front; the train from S03 carries on along the elevated line
  O.drawImage(k.town2dFar, -tt * 8 - 60, H - 460 - 60);
  const tx = lerp(W + 80, -640, P(tt, 12.1, 15.9)); O.drawImage(k.train2d, tx, H - 460 - 60 + 196 - 62 + (Math.floor(tt * 12) % 2));
  O.save(); O.translate(1180, 540); O.rotate(.3);
  O.shadowColor = 'rgba(0,0,0,.5)'; O.shadowBlur = 40; O.shadowOffsetX = 20; O.shadowOffsetY = 20;
  O.drawImage(k.profile, -720, -620, 1380, 1380); O.restore();
  O.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) { O.fillStyle = `rgba(255,214,140,${.7 - i * .1})`; O.beginPath(); O.arc(982 + i * 9, 542 + (i % 2) * 6, 3.4, 0, TAU); O.fill(); } O.globalCompositeOperation = 'source-over';
  O.restore();
  // the blocks in front: more windows come on as she watches
  const ox = -tt * 18; O.drawImage(k.town2d, ox, H - 300);
  const n = Math.floor(k.win2d.length * P(tt, 12.2, 15.6)); O.fillStyle = '#FFD27A';
  for (let i = 0; i < n; i++) { const wv = k.win2d[i]!; O.fillRect(ox + wv[0]!, H - 300 + wv[1]!, 14, 18); }
}
function cloudAt(O: C2, img: OffscreenCanvas, x: number, y: number, s: number) { O.drawImage(img, x - 340 * s, y - 150 * s, 680 * s, 300 * s); }
export function drawS06(O: C2, k: Kit, t: number) { // cloud sea, flat parallax
  const tt = on2(t);
  O.drawImage(k.bg.starmap, 0, 0);
  O.save(); O.globalAlpha = .16; O.fillStyle = '#fff'; O.beginPath(); O.moveTo(1560, 120); O.lineTo(1700, 230); O.lineTo(260, 1180); O.lineTo(-100, 1000); O.closePath(); O.fill(); O.restore();
  for (let i = 0; i < 4; i++) cloudAt(O, k.clouds2d[0]!, ((i * 620 + 300 + (tt - 20) * 30) % 2400) - 200, 520 + i * 30, .8);
  const uu = P(tt, 20, 23.5), hx = lerp(1480, 820, uu), hy = lerp(190, 700, (uu + (1 - Math.cos(uu * Math.PI)) / 2) / 2);
  O.save(); O.translate(hx, hy); O.rotate(Math.sin(tt * 5) * .06);
  const B = k.pose.moonlight!.back, bw = 220, bh = bw * B.height / B.width; O.drawImage(B, -bw / 2, -bh * .35, bw, bh);
  const top = -bh * .35;
  O.fillStyle = C.lav; O.beginPath(); O.moveTo(-170, top - 10); O.quadraticCurveTo(0, top - 190, 170, top - 10); O.closePath(); O.fill();
  O.strokeStyle = C.violet; O.lineWidth = 4; for (let q = -2; q <= 2; q++) { O.beginPath(); O.moveTo(0, top - 150); O.lineTo(q * 70, top - 10); O.stroke(); }
  O.fillStyle = C.ivory; for (let q = -2; q <= 2; q++) { O.beginPath(); O.arc(q * 70 + 35, top - 8, 10, 0, Math.PI); O.fill(); }
  O.fillStyle = C.wood; O.fillRect(-4, top - 150, 8, 200);
  O.restore();
  for (let i = 0; i < 3; i++) cloudAt(O, k.clouds2d[1]!, ((i * 820 + 2400 - (tt - 20) * 90) % 2600) - 100, 830 + i * 20, 1.2);
  O.drawImage(k.waves2d, -(((tt - 20) * 130) % 260), H - 180);
}
export function drawS08(O: C2, k: Kit, t: number) { // deep breath
  O.fillStyle = '#05060f'; O.fillRect(0, 0, W, H);
  const flick = t < 28.75 ? 1.6 : 1, glow = (.8 + .2 * P(t, 29, 32)) * flick;
  const gr = O.createRadialGradient(W / 2, 470, 60, W / 2, 470, 560); gr.addColorStop(0, `rgba(255,240,214,${.9 * Math.min(1, glow)})`); gr.addColorStop(.6, `rgba(150,140,190,${.25 * glow})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
  O.fillStyle = gr; O.fillRect(0, 0, W, H);
  const d = k.sadDuo, breathe = Math.sin(on2(t) * Math.PI * 1.2) * 6, dw = 1000, dh = dw * d.height / d.width, lift = -18 * ease(P(t, 30.6, 31.6));
  O.save(); O.beginPath(); O.arc(W / 2, 470, 470, 0, TAU); O.clip();
  O.globalAlpha = .96; O.drawImage(d, W / 2 - dw / 2, 20 + breathe + lift, dw, dh); O.restore();
  O.strokeStyle = 'rgba(255,240,214,.5)'; O.lineWidth = 3; O.setLineDash([4, 10]); O.beginPath(); O.arc(W / 2, 470, 480, 0, TAU); O.stroke(); O.setLineDash([]);
  O.save(); O.scale(1, .22); const fg = O.createRadialGradient(W / 2, 1010 / .22, 10, W / 2, 1010 / .22, 520); fg.addColorStop(0, 'rgba(255,236,200,.35)'); fg.addColorStop(1, 'rgba(255,236,200,0)'); O.fillStyle = fg; O.beginPath(); O.arc(W / 2, 1010 / .22, 520, 0, TAU); O.fill(); O.restore();
}
export function drawS11(O: C2, k: Kit, t: number, stampIn: number) { // idol poster
  const z = 1 + .08 * eo(P(t, 43, 45.7));
  O.save(); O.translate(W / 2, H / 2); O.scale(z, z); O.translate(-W / 2, -H / 2);
  O.drawImage(k.poster, 0, 0);
  const tw0 = Math.floor(on2(t) * 6);
  k.r.stars.forEach(([x, y, r], i) => { const tw = (tw0 + i) % 3 === 0; starPath(O, x!, y!, r! * (tw ? 1.3 : 1)); O.fillStyle = tw ? '#FFF3C8' : C.gold; O.fill(); });
  // vertical title band, stamped in
  const s = stampIn < 1 ? lerp(1.35, 1, stampIn) : 1;
  O.save(); O.globalAlpha = clamp(stampIn * 1.6); O.translate(415, 520); O.scale(s, s); O.translate(-415, -520);
  O.fillStyle = C.ivory; O.fillRect(300, 110, 230, 820); O.strokeStyle = C.gold; O.lineWidth = 6; O.strokeRect(318, 128, 194, 784);
  vtext(O, '月亮偶像', 415, 260, 170, C.plum, 1.05);
  O.fillStyle = C.red; O.fillRect(370, 850, 90, 60); O.fillStyle = C.ivory; O.font = `600 22px ${LAT}`; O.textAlign = 'center'; O.textBaseline = 'alphabetic'; O.fillText('NO.01', 415, 888);
  O.restore();
  O.restore();
  const r2 = rng(14); for (let i = 0; i < 26; i++) { const col = ['255,127,184', '255,226,122', '200,166,255'][i % 3]; const x = r2() * W, y = 900 + r2() * 200 + Math.sin(t * 3 + i) * 8, rr = 30 + r2() * 50; O.fillStyle = `rgba(${col},.35)`; O.beginPath(); O.arc(x, y, rr, 0, TAU); O.fill(); }
}
export function petalsOverlay(O: C2, k: Kit, t: number, start: number, dur: number) {
  const u = (t - start) / dur; if (u <= 0 || u >= 1.6) return;
  for (const [x, a, b, rot, s] of k.r.petals) {
    const y = -80 + (u * (900 + a! * 900)) * 1.3, xx = x! + Math.sin(u * 6 + b! * 9) * 60;
    if (y > H + 60) continue;
    O.save(); O.translate(xx, y); O.rotate(rot! + u * 6 * (b! - .5)); O.scale(s! * 1.6, s! * 1.6);
    O.fillStyle = b! < .5 ? C.pink : '#FFD3E6'; O.beginPath(); O.moveTo(0, -18); O.bezierCurveTo(16, -10, 12, 14, 0, 18); O.bezierCurveTo(-12, 14, -16, -10, 0, -18); O.fill();
    O.restore();
  }
}

// ---------------------------------------------------------------- 2D finishing layer (effects over both 2D and 3D shots)
export interface FX { branch: OffscreenCanvas; glint: OffscreenCanvas; dot: OffscreenCanvas }
export function bakeFX(): FX {
  // an out-of-focus sakura branch, seen in the foreground (baked blurred once)
  const raw = cv(900, 600), g = g2(raw), r = rng(303);
  g.strokeStyle = '#1a0d22'; g.lineCap = 'round';
  const limb = (x: number, y: number, a: number, len: number, wdt: number, depth: number) => {
    if (depth <= 0 || len < 20) return;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    g.lineWidth = wdt; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + (r() - .5) * 40, (y + y2) / 2 + (r() - .5) * 40, x2, y2); g.stroke();
    for (let k = 0; k < 6; k++) { const bx = x2 + (r() - .5) * 90, by = y2 + (r() - .5) * 70, s = 10 + r() * 16; g.fillStyle = r() < .5 ? '#F7B6D2' : '#FFD9EA'; g.save(); g.translate(bx, by); for (let p = 0; p < 5; p++) { g.rotate(TAU / 5); g.beginPath(); g.ellipse(0, -s * .55, s * .42, s * .6, 0, 0, TAU); g.fill(); } g.restore(); }
    limb(x2, y2, a - .35 - r() * .3, len * .72, wdt * .65, depth - 1); limb(x2, y2, a + .3 + r() * .3, len * .66, wdt * .6, depth - 1);
  };
  limb(-20, 40, .38, 260, 26, 4);
  const branch = cv(900, 600), bg = g2(branch); bg.filter = 'blur(9px)'; bg.drawImage(raw, 0, 0); bg.filter = 'none';
  const glint = cv(128, 128), gg = g2(glint);
  const rad = gg.createRadialGradient(64, 64, 0, 64, 64, 64); rad.addColorStop(0, 'rgba(255,255,255,1)'); rad.addColorStop(.12, 'rgba(255,246,220,.8)'); rad.addColorStop(.4, 'rgba(255,230,180,.12)'); rad.addColorStop(1, 'rgba(255,230,180,0)');
  gg.fillStyle = rad; gg.fillRect(0, 0, 128, 128);
  for (const [w2, h2] of [[64, 2.2], [2.2, 64]]) { const lg = gg.createRadialGradient(64, 64, 0, 64, 64, 64); lg.addColorStop(0, 'rgba(255,255,255,.95)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); gg.fillStyle = lg; gg.fillRect(64 - w2!, 64 - h2!, w2! * 2, h2! * 2); }
  const dot = cv(64, 64), dg = g2(dot), dr = dg.createRadialGradient(32, 32, 0, 32, 32, 32); dr.addColorStop(0, 'rgba(255,240,215,.9)'); dr.addColorStop(.5, 'rgba(255,230,200,.25)'); dr.addColorStop(1, 'rgba(255,230,200,0)'); dg.fillStyle = dr; dg.fillRect(0, 0, 64, 64);
  return { branch, glint, dot };
}
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/** Smooth 1D value noise in [-1, 1] (a pure function of x). */
export function vnoise(x: number, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return (lerp(hash(i + seed * 57), hash(i + 1 + seed * 57), u)) * 2 - 1; }
/** Foreground out-of-focus sakura branches in the top corners, swaying a little. */
export function branches(O: C2, fx: FX, t: number, a: number) {
  if (a <= .01) return;
  O.save(); O.globalAlpha = a;
  O.save(); O.translate(-60 + vnoise(t * .4, 1) * 8, -40); O.rotate(vnoise(t * .3, 2) * .02); O.drawImage(fx.branch, 0, 0, 1000, 667); O.restore();
  O.save(); O.translate(W + 60 + vnoise(t * .4, 3) * 8, -60); O.scale(-1, 1); O.rotate(.1 + vnoise(t * .3, 4) * .02); O.drawImage(fx.branch, 0, 0, 820, 547); O.restore();
  O.restore();
}
/** Warm dust motes drifting through the light (additive). */
export function dust(O: C2, fx: FX, t: number, a: number, n = 46, box: [number, number, number, number] = [0, 0, W, H]) {
  if (a <= .01) return;
  O.save(); O.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const sx = hash(i * 3.1), sy = hash(i * 7.7), sp = .2 + hash(i * 1.9) * .6, s = 4 + hash(i * 5.3) * 14;
    const x = box[0] + ((sx * box[2] + t * 18 * sp + vnoise(t * .5 + i, 9) * 30) % box[2]), y = box[1] + ((sy * box[3] - t * 10 * sp + box[3] * 10) % box[3]);
    O.globalAlpha = a * (.25 + .5 * hash(i * 9.1)) * (.6 + .4 * Math.sin(t * 2 + i));
    O.drawImage(fx.dot, x - s, y - s, s * 2, s * 2);
  }
  O.restore();
}
/** Four-point star glints that twinkle (additive). pts: [x, y, size, phase]. */
export function glints(O: C2, fx: FX, t: number, pts: readonly (readonly number[])[], a = 1) {
  O.save(); O.globalCompositeOperation = 'lighter';
  for (const [x, y, s, ph] of pts) { const k = Math.max(0, Math.sin(t * 3.2 + ph!)) ** 3; if (k < .02) continue; const z = s! * (.4 + .6 * k); O.globalAlpha = a * k; O.drawImage(fx.glint, x! - z, y! - z, z * 2, z * 2); }
  O.restore();
}
/** Soft god rays fanning from (cx, cy). */
export function godRays(O: C2, cx: number, cy: number, t: number, a: number) {
  if (a <= .01) return;
  O.save(); O.globalCompositeOperation = 'lighter'; O.translate(cx, cy); O.rotate(t * .05);
  for (let i = 0; i < 14; i++) {
    const ang = i / 14 * TAU + Math.sin(i * 1.7) * .15, wdt = .05 + hash(i) * .07, len = 1300;
    const gr = O.createLinearGradient(0, 0, Math.cos(ang) * len, Math.sin(ang) * len); gr.addColorStop(0, `rgba(255,214,180,${.22 * a})`); gr.addColorStop(1, 'rgba(255,190,200,0)');
    O.fillStyle = gr; O.beginPath(); O.moveTo(0, 0); O.lineTo(Math.cos(ang - wdt) * len, Math.sin(ang - wdt) * len); O.lineTo(Math.cos(ang + wdt) * len, Math.sin(ang + wdt) * len); O.closePath(); O.fill();
  }
  O.restore();
}
/** A warm light leak drifting across, peaking at `at`. */
export function leak(O: C2, t: number, at: number, dur = .9, hue = '255,150,110') {
  const u = (t - at) / dur; if (u < -1 || u > 1) return;
  const k = Math.cos(u * Math.PI / 2) ** 2, x = lerp(-200, W + 200, (u + 1) / 2);
  O.save(); O.globalCompositeOperation = 'screen';
  const gr = O.createRadialGradient(x, H * .35, 0, x, H * .35, 900); gr.addColorStop(0, `rgba(${hue},${.55 * k})`); gr.addColorStop(.5, `rgba(${hue},${.18 * k})`); gr.addColorStop(1, `rgba(${hue},0)`);
  O.fillStyle = gr; O.fillRect(0, 0, W, H); O.restore();
}
/** Paper confetti (gold and sakura rectangles) fluttering down from `start`, on 2s. */
export function confetti(O: C2, t: number, start: number, n = 90) {
  const tt = on2(t) - start; if (tt <= 0) return;
  for (let i = 0; i < n; i++) {
    const x0 = hash(i * 2.3) * W, sp = 220 + hash(i * 4.1) * 260, y = -40 + tt * sp - hash(i * 6.7) * 300; if (y < -40 || y > H + 40) continue;
    const x = x0 + Math.sin(tt * 2.4 + i) * 40, rot = tt * (2 + hash(i) * 4) + i, flip = Math.cos(tt * 6 + i);
    O.save(); O.translate(x, y); O.rotate(rot); O.scale(1, flip);
    O.fillStyle = i % 3 === 0 ? '#E2B055' : i % 3 === 1 ? '#F8A3C8' : '#FFF7EB'; O.fillRect(-9, -5, 18, 10);
    O.restore();
  }
}
/** Film specks: one or two tiny marks on a few frames (12 per second), like dust on a print. */
export function specks(O: C2, t: number) {
  const f = Math.floor(t * 12); if (hash(f * .37) > .35) return;
  O.save();
  for (let i = 0; i < 2; i++) {
    const x = hash(f * 1.3 + i) * W, y = hash(f * 2.9 + i) * H, s = 1 + hash(f * 5.1 + i) * 2.5, light = hash(f * 7.3 + i) > .5;
    O.globalAlpha = .35; O.fillStyle = light ? '#fff6e8' : '#0a0610';
    if (hash(f * 3.7 + i) > .8) { O.strokeStyle = O.fillStyle; O.lineWidth = 1; O.beginPath(); O.moveTo(x, y); O.quadraticCurveTo(x + 14, y + 6, x + 6, y + 22); O.stroke(); }
    else { O.beginPath(); O.ellipse(x, y, s, s * .7, f, 0, TAU); O.fill(); }
  }
  O.restore();
}
/** The end title: vertical, characters rise in one by one. */
export function endTitle(O: C2, t: number, start: number) {
  const u = t - start; if (u <= 0) return;
  O.save(); O.fillStyle = `rgba(3,5,18,${Math.min(.55, u * .9)})`; O.fillRect(0, 0, W, H);
  const text = '來自月亮的偶像', size = 92;
  [...text].forEach((ch, i) => {
    const k = clamp((u - i * .07) / .35), e = 1 - (1 - k) ** 3; if (k <= 0) return;
    O.globalAlpha = e; O.font = `700 ${size}px ${SERIF}`; O.fillStyle = C.ivory; O.textAlign = 'center'; O.textBaseline = 'middle';
    O.shadowColor = 'rgba(255,214,232,.55)'; O.shadowBlur = 24;
    O.fillText(ch, 1480, 200 + i * size * 1.06 + (1 - e) * 16);
  });
  const k2 = clamp((u - .45) / .4); O.globalAlpha = k2; O.shadowBlur = 0;
  O.font = `600 22px ${LAT}`; O.fillStyle = C.gold; O.letterSpacing = '10px'; O.fillText('LUNAR POP CLUB · 月兔紙劇場', 1480, 890); O.letterSpacing = '0px';
  O.restore();
}
