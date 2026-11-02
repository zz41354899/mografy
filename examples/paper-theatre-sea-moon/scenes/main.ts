// @ts-nocheck
// 海月公主 — 72 s fully 3D paper puppet theatre with Mirea and an undersea castle.
// Light travels: the moon → the castle's windows → darkness → her umbrella → her voice → the jellyfish → the windows → the sea's own moon.
import type { FrameContext, SetupContext } from '@mografy/runtime';
import { beats, keys, spring, ease as E } from '@mografy/runtime';
import { prepareStage, type Stage } from './three.js';
import { clamp, lerp, rng } from './lib.js';
import { W, H, STAGE_Y, buildWorld, resetWorld, renderWorld, type World } from './world.js';

const BAR = 2.4, TAU = Math.PI * 2;
export const BEATS = beats([
  { title: 'S01 開幕', end: 4.8, stop: 3.4, handoff: .7, note: 'Pearls light one by one; the velvet drapes part on paper waves and a paper moon; the camera pushes in.' },
  { title: 'S02 潛入海裡', end: 9.6, stop: 8, handoff: .7, note: 'The front wave lifts past the lens: under water, looking up at the moon.' },
  { title: 'S03 月光城堡', end: 16.8, stop: 12.8, handoff: .5, note: 'One crane from the surface down to the castle, then a push into the lit window of the Moon Tower.' },
  { title: 'S04 月之塔', end: 24, stop: 20.5, handoff: .5, note: 'Window light into her room. She hums to herself; fish pass and she shrinks away.' },
  { title: 'S05 朔月', end: 28.8, stop: 26.8, handoff: .4, note: 'A black paper disc on threads slides over the moon; rack from the spire to the moon.' },
  { title: 'S06 一盞一盞', end: 33.6, stop: 31.6, handoff: .4, note: 'Windows go out from the town inwards until none are left.' },
  { title: 'S07 黑暗裡', end: 38.4, stop: 36.6, handoff: .4, note: 'The dark room. A child cries somewhere. The umbrella lights by itself.' },
  { title: 'S08 走上露台', end: 43.2, stop: 41.5, handoff: .4, note: 'She walks out onto the empty terrace, the only light in the sea.' },
  { title: 'S09 開口', end: 48, stop: 46, handoff: .4, note: 'She breathes and sings; rings of light leave her chest.' },
  { title: 'S10 水母回應', end: 52.8, stop: 51, handoff: .4, note: 'The jellyfish wake and rise; the moon-phase ring lights under her.' },
  { title: 'S11 城堡亮起', end: 60, stop: 57.4, handoff: .3, note: 'Crane up from her to the whole city as the windows relight outward in her colours.' },
  { title: 'S12 俯瞰全城', end: 64.8, stop: 64.4, note: 'The same camera swings round and up until it looks down on the lit city, rings of light and lanterns rising through the jellyfish.' },
  { title: 'S13 浮回水面', end: 69.6, stop: 68.3, handoff: .6, note: 'Still one move: bubbles pass the lens, the camera tilts up, the paper disc slides off and the moon of the opening is back; the paper waves wash past.' },
  { title: 'S14 閉幕', end: 72, stop: 71, note: 'A paper wave falls past the lens; the drapes close.' },
]);
const DUR = BEATS.duration;
export const meta = { width: W, height: H, duration: DUR, fps: 30, background: '#040818', shots: BEATS.shots, tempo: { bpm: 100, beatsPerBar: 4, offset: 0 } };
export const params = {};

// ---------------------------------------------------------------- small helpers
const P = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const inCubic = (p: number) => p * p * p;
const on2 = (t: number) => Math.floor(t * 12 + 1e-6) / 12;
const hash = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
const add = (p: number[], x: number, y: number, z: number) => [p[0]! + x, p[1]! + y, p[2]! + z];
const face = (from: number[], to: number[]) => Math.atan2(to[0]! - from[0]!, to[2]! - from[2]!);
function camKeys(list: number[][]) { const ch = [1, 2, 3, 4, 5, 6, 7].map(i => keys(list.map(k => [k[0]!, k[i]!] as const))); return (t: number) => ch.map(f => f(t)); }
const nz = (t: number, s: number) => Math.sin(t * .83 + s) * .55 + Math.sin(t * 1.37 + s * 2.1) * .45;
const AK = 2.62, AS = 5.76;                                   // bearings on the terrace: towards the keep / out to sea

// ---------------------------------------------------------------- sea states
const NIGHT = { fog: .0040, moon: 1, mid: '#0f2f80', top: '#2f6fc8', key: 1.3, hemi: .34, caustic: .35, deep: '#050c2a', glow: '#9fd0ff' };
const SURF = { fog: .0078, moon: 1, top: '#2268cc', mid: '#0f3392', deep: '#061448', hemi: .5, snow: 1.4, glow: '#4d88d8', key: 1.3 };
const ROOM = { fog: .0046, hemi: .2, caustic: .8, snow: .3, env: .42, key: .28, moon: 1, mid: '#0f2f80', top: '#2f6fc8' };
const DIM = { moon: .3, fog: .0034, top: '#123a8c', mid: '#0a2264', deep: '#040b2c', hemi: .3, snow: .7 };
const DUSK = { moon: .14, fog: .0058, deep: '#030822', mid: '#0a1f5e', top: '#123a8a', hemi: .3, env: .5, snow: .5 };
const DARK = { moon: .04, deep: '#02040f', mid: '#050b2a', top: '#0b1a4e', hemi: .16, hemiC: '#5a78d8', hemiG: '#1a1650', env: .35, fog: .0072, snow: .35, glow: '#4a68c0' };
const SONG = { moon: .08, deep: '#07072a', mid: '#1c1a78', top: '#4a3cc0', hemi: .5, hemiC: '#b6a4ff', hemiG: '#3a2a9c', env: .8, fog: .0048, snow: .9, glow: '#c9a6ff', key: 1, caustic: 2.4, causticC: '#d9b8ff' };
const THEATRE = { moon: 0, fog: 0, hemi: .3, env: .5, snow: 0, key: 0, caustic: 0 };

// ---------------------------------------------------------------- continuous cameras
const y0 = STAGE_Y;
const CR_B = keys([[52.8, 2.47], [54.4, 3.1], [56, 4.5], [57.8, 5.79]]), CR_D = keys([[52.8, 7.1], [54.4, 13], [55.2, 24], [56, 50], [57.8, 118], [60, 120]]), CR_H = keys([[52.8, 3.4], [53.8, 8], [54.4, 18], [55.2, 40], [56, 46], [57.8, 49], [60, 50]]);   // up first, above every roof, and only then out
const CAM_OPEN = camKeys([[0, 0, y0 + 7.4, 41, 0, y0 + 8.2, 0, 34], [1.7, 0, y0 + 7.4, 39.5, 0, y0 + 8.2, 0, 34], [3.4, 0, y0 + 7, 30, 0, y0 + 7.6, 0, 34], [4.8, 0, y0 + 5.2, 5, 0, y0 + 4.6, -8, 42]]);
const CAM_SEA = camKeys([ // S02–S03: one move from the surface to the castle window. It backs away from the castle while it tilts down, and never flies over a tower
  [4.8, 46, 152, 26, 70, 200, 70, 52], [8, 46, 128, 26, 70, 176, 70, 52], [9.6, 40, 118, 92, 34, 112, -30, 48], [10.9, 8, 88, 172, 4, 62, 0, 40],
  [12.8, -40, 42, 142, 3, 41, 0, 33], [15.6, -24, 39, 118, 16, 39, 26, 30], [16.8, 23.6, 35, 51, 24, 35, 38, 30],
]);

// S12–S13: one move. Polar round the city, up over it, then the view tilts from straight down to the moon of S02.
const END_A = keys([[60, -.5356], [64.4, -2.2], [66.2, -2.42], [69.6, -2.5]]), END_R = keys([[60, 148.5], [62, 105], [64.4, 60], [66.2, 50], [69.6, 30]]), END_H = keys([[60, 72.02], [61, 100], [62, 133], [63.4, 150], [64.8, 156], [66.6, 164], [69.6, 178]]), END_F = keys([[60, 34], [62.4, 40], [64.8, 44], [66, 44], [68.4, 50], [69.6, 52]]);
function endCam(t: number) {
  const a = END_A(t), r = END_R(t), c = [Math.sin(a) * r, END_H(t), 10 + Math.cos(a) * r], g = E.inOutSine(P(t, 60, 62)), d = [lerp(-4, -2, g) - c[0]!, lerp(30, 24, g) - c[1]!, lerp(12, 10, g) - c[2]!];
  const u = E.inOutCubic(P(t, 65.7, 68.2)), yaw = lerp(Math.atan2(d[0]!, d[2]!), .5, u), el = lerp(Math.atan2(d[1]!, Math.hypot(d[0]!, d[2]!)), .77, u), L = u > 0 ? 100 : Math.hypot(d[0]!, d[1]!, d[2]!);
  return { c, l: [c[0]! + Math.sin(yaw) * Math.cos(el) * L, c[1]! + Math.sin(el) * L, c[2]! + Math.cos(yaw) * Math.cos(el) * L], dist: Math.hypot(d[0]!, d[1]!, d[2]!) };
}

// ---------------------------------------------------------------- story cards
const CARDS = [
  { text: ['月光每晚，', '都會走進海裡。'], x: 1660, t0: 5.5, t1: 9.3 },
  { text: ['海底的城堡，', '靠月光發亮。'], x: 214, t0: 11.2, t1: 15.8 },
  { text: ['公主很怕生，', '歌只唱給自己聽。'], x: 1660, t0: 17.6, t1: 23.4 },
  { text: ['那一夜，', '月亮沒有來。'], x: 214, t0: 24.7, t1: 28.5 },
  { text: ['燈，', '一盞一盞地熄了。'], x: 1680, t0: 29.4, t1: 33.3 },
  { text: ['黑暗裡，', '有人在小聲地哭。'], x: 214, t0: 34, t1: 38 },
  { text: ['她第一次，', '走到大家看得見的地方。'], x: 1660, t0: 38.9, t1: 42.9 },
  { text: ['聲音在發抖，', '但她沒有停。'], x: 1660, t0: 44.2, t1: 47.7 },
  { text: ['在深海裡，', '慢慢發亮。'], x: 214, t0: 48.8, t1: 52.5 },
  { text: ['原來，', '不必等月亮。'], x: 1680, t0: 55.6, t1: 59.7 },
  { text: ['海裡也有月亮，', '它叫海月。'], x: 214, t0: 62.6, t1: 65.6 },
  { text: ['下一首歌，', '想和你一起聽。'], x: 1680, t0: 65.6, t1: 68.7 },
];
function paintCard(cols: string[]) {
  const r = rng(hashText(cols.join(''))), n = Math.max(...cols.map(c => [...c].length)), cell = 86, cw = 112, pad = 58, wd = cols.length * cw + pad * 2 - 18, ht = n * cell + pad * 2 + 8;
  const c = new OffscreenCanvas(wd + 60, ht + 60), x = c.getContext('2d')!;
  x.translate(30, 24); x.shadowColor = 'rgba(4,8,40,.6)'; x.shadowBlur = 22; x.shadowOffsetY = 10;
  const g = x.createLinearGradient(0, 0, wd, ht); g.addColorStop(0, '#f7f2e6'); g.addColorStop(1, '#ece7e0'); x.fillStyle = g; x.fillRect(0, 0, wd, ht); x.shadowColor = 'transparent'; x.shadowBlur = 0; x.shadowOffsetY = 0;
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${i % 2 ? '120,110,90' : '255,255,255'},${r() * .07})`; x.fillRect(r() * wd, r() * ht, 1 + r() * 14, 1); }
  x.strokeStyle = '#5a78c8'; x.lineWidth = 3; x.strokeRect(16, 16, wd - 32, ht - 32); x.strokeStyle = 'rgba(90,120,200,.45)'; x.lineWidth = 1.5; x.strokeRect(24, 24, wd - 48, ht - 48);
  x.fillStyle = '#15225e'; x.font = '700 74px "Hai Serif TC"'; x.textAlign = 'center'; x.textBaseline = 'middle';
  cols.forEach((t, i) => { const px = wd - pad - cw * (i + .5) + 9; [...t].forEach((ch, k) => x.fillText(ch, px, pad + 2 + k * cell + cell / 2)); });
  x.fillStyle = '#5a78c8'; x.fillRect(pad - 18, ht - pad - 18, 40, 40); x.fillStyle = '#f7f2e6'; x.font = '700 28px "Hai Serif TC"'; x.fillText('海', pad + 2, ht - pad + 3);
  return { c, wd: wd + 60, ht: ht + 60 };
}
const hashText = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
const CARD_S = .58;
function drawCards(c: any, A: Assets, t: number) {
  CARDS.forEach((k, i) => {
    if (t < k.t0 || t > k.t1) return;
    const b = A.cards[i], drop = spring(t, k.t0, .62, .14) * (1 - inCubic(P(t, k.t1 - .42, k.t1)));
    if (drop <= .001) return;
    const w = b.wd * CARD_S, h = b.ht * CARD_S, top = 40, y = lerp(-h - 30, top, drop), sway = Math.sin(t * 1.3 + i) * .006 * (1 + (1 - drop) * 3);
    c.save(); c.strokeStyle = 'rgba(232,226,210,.8)'; c.lineWidth = 2;
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(k.x + s * w * .3, 0); c.lineTo(k.x + s * w * .3 + sway * 300, y + 24); c.stroke(); }
    c.translate(k.x + sway * 300, y); c.rotate(sway); c.drawImage(b.c, -w / 2, 0, w, h); c.restore();
  });
}

// ---------------------------------------------------------------- the paper waves that wash past the lens
// Three sheets, each scalloped along BOTH edges and wider than the frame, so no straight edge ever shows.
const BAND_H = 1720, BAND_W = W + 360;
function bakeBand(seed: number, top: string, mid: string, bot: string, line: string, R: number) {
  const r = rng(seed), c = new OffscreenCanvas(BAND_W, BAND_H), x = c.getContext('2d')!, off = -((seed % 7) * 23), n = Math.ceil((BAND_W - off) / (R * 2)) + 1;
  const outline = () => { x.beginPath(); x.moveTo(off, R); for (let i = 0; i < n; i++) x.arc(off + R + i * R * 2, R, R, Math.PI, 0); for (let i = n - 1; i >= 0; i--) x.arc(off + R + i * R * 2, BAND_H - R, R, 0, Math.PI); x.closePath(); };
  outline();
  const g = x.createLinearGradient(0, 0, 0, BAND_H); g.addColorStop(0, top); g.addColorStop(.5, mid); g.addColorStop(1, bot); x.fillStyle = g; x.fill();
  x.save(); x.clip(); x.lineWidth = 6;
  const P0 = 110; for (let row = 0; row < 26; row++) for (let i = -1; i < 14; i++) { const cx = i * P0 * 2 + (row % 2 ? P0 : 0), cy = 120 + row * 72; for (let k = 5; k > 0; k--) { x.strokeStyle = line; x.globalAlpha = .1 + (k % 2) * .12; x.beginPath(); x.arc(cx, cy, k * 21, Math.PI, 0); x.stroke(); } }
  x.globalAlpha = 1; for (let i = 0; i < 2600; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.05)'; x.fillRect(r() * BAND_W, r() * BAND_H, 2 + r() * 8, 1); }
  x.restore(); outline(); x.strokeStyle = '#eaf3ff'; x.lineWidth = 11; x.stroke();
  return c;
}
const WASH = [{ c: 0, dt: .17, sway: 60 }, { c: 1, dt: .08, sway: -46 }, { c: 2, dt: 0, sway: 30 }];
const washY = (u: number) => lerp(H + 24, -BAND_H - 24, E.inOutCubic(clamp(u)));
function drawWash(c: any, A: Assets, t: number) {
  const pass = (t0: number, t1: number, down: boolean) => {
    if (t < t0 - .25 || t > t1 + .25) return;
    for (const l of WASH) {
      const u = (t + l.dt - t0) / (t1 - t0), y = washY(down ? 1 - u : u);
      if (y < H && y > -BAND_H) c.drawImage(A.bands[l.c], -180 + Math.sin(t * 2.1 + l.c) * l.sway, y);
    }
  };
  pass(4.02, 5.58, false); pass(68.82, 70.38, true);
}
// bubbles: left behind by the wash on the way down; passing the lens, then rising with us, on the way back up
function bubble(c: any, x: number, y: number, r: number, al: number) {
  c.strokeStyle = `rgba(226,242,255,${al})`; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); c.fillStyle = `rgba(255,255,255,${al * .7})`; c.beginPath(); c.arc(x - r * .34, y - r * .34, Math.max(1, r * .16), 0, TAU); c.fill();
}
function drawBubbles(c: any, t: number) {
  const up = (n: number, a: number, spread: number) => { for (let i = 0; i < n; i++) {
    const t0 = a + hash(i) * spread, q = (t - t0) / (1 + hash(i + 40)); if (q < 0 || q > 1) continue;
    bubble(c, hash(i + 7) * W + Math.sin(t * 3 + i) * 14, H + 40 - q * (H + 200) * (1 + hash(i + 13)), 3 + hash(i + 3) * hash(i + 5) * 20, .7 * (1 - q));
  } };
  c.save(); c.lineWidth = 2;
  if (t > 4.7 && t < 7) up(90, 4.72, .7);
  if (t > 64.6 && t < 66.8) for (let i = 0; i < 80; i++) {                  // looking down: they rise past us, out from the centre of the frame
    const t0 = 64.6 + hash(i + 50) * 1.3, q = (t - t0) / (.8 + hash(i + 51) * .5); if (q < 0 || q > 1) continue;
    const a = hash(i + 52) * TAU, R = 40 + q * q * 1150; bubble(c, 960 + Math.cos(a) * R, 540 + Math.sin(a) * R * .8, 2 + q * q * (8 + hash(i + 53) * 26), .6 * Math.sin(q * Math.PI));
  }
  if (t > 65.8 && t < 69.9) up(150, 65.9, 3);
  c.restore();
}

// ---------------------------------------------------------------- windows: when each one goes out, when each one comes back
interface Win { off: number; on: number; tint: number }
function bakeWindows(w: World): Win[] {
  const T = w.api.TERRACE, list = w.api.castle.wins, dO = list.map((q: any) => Math.hypot(q.p.x, q.p.z)), dT = list.map((q: any) => Math.hypot(q.p.x - T.x, q.p.z - T.z)), mO = Math.max(...dO), mT = Math.max(...dT);
  return list.map((_: any, i: number) => ({ off: 29.1 + 4.1 * Math.pow(1 - dO[i] / mO, 1.35) + hash(i) * .3, on: 53.2 + 5.6 * dT[i] / mT + hash(i + 7) * .35, tint: i % 3 === 0 ? .95 : i % 3 === 1 ? .02 : .3 }));
}
function setWindows(w: World, A: Assets, t: number) {
  const n = A.wins.length; let lit = 0;
  for (let i = 0; i < n; i++) {
    const q = A.wins[i]!, l = t < 33.6 ? (t < q.off ? 1 : 0) : clamp((on2(t) - q.on) / .12);
    A.lit[i] = l; A.tint[i] = t < 33.6 ? 0 : q.tint; lit += l;
  }
  w.api.windows(A.lit, A.tint);
  return lit / n;
}

// ---------------------------------------------------------------- the jellyfish field
interface J { x: number; y: number; z: number; s: number; ry: number; tx: number; tz: number; hue: number; lit: number; on: number; rise: number; ph: number }
function bakeJellies(w: World): J[] {
  const T = w.api.TERRACE, r = rng(2612), out: J[] = [];
  const field = (n: number, cx: number, cy: number, cz: number, r0: number, r1: number, yA: number, yB: number, sA: number, sB: number, onA: number, onB: number) => {
    for (let i = 0; i < n; i++) { const a = r() * TAU, d = r0 + Math.pow(r(), .7) * (r1 - r0); out.push({ x: cx + Math.sin(a) * d, y: cy + yA + r() * (yB - yA), z: cz + Math.cos(a) * d, s: sA + r() * r() * (sB - sA), ry: r() * TAU, tx: (r() - .5) * .5, tz: (r() - .5) * .5, hue: r(), lit: .75 + r() * .55, on: onA + r() * (onB - onA), rise: 14 + r() * 26, ph: r() * TAU }); }
  };
  field(200, T.x + Math.sin(AS) * 30, T.y, T.z + Math.cos(AS) * 30, 8, 72, -24, 26, .5, 1.9, 44.6, 51.5);  // out to sea, around the terrace
  field(70, 0, 88, 10, 26, 96, -8, 40, 1.2, 3.6, 57.9, 60.2);                                            // above the city: seen from over it, against the lights
  field(100, 0, 16, 14, 28, 116, -6, 56, .9, 3, 50, 58);                                                 // around the city
  return out;
}
function jellyList(A: Assets, t: number, extra: any[] = [], cam?: number[]) {
  const list = [...extra];
  for (const j of A.jellies) {
    if (t < j.on) continue; const u = E.outCubic(P(t, j.on, j.on + 3.4)), lit = j.lit * P(t, j.on, j.on + .5);
    const x = j.x + Math.sin(t * .3 + j.ph) * .8, y = j.y + j.rise * u + (t - j.on) * .35;
    // a jelly the camera is about to pass through bows out, so its tentacles never sweep across the lens
    const near = cam ? P(Math.hypot(x - cam[0]!, y - 2 * j.s - cam[1]!, j.z - cam[2]!), j.s * 5, j.s * 11) : 1; if (lit * near < .01) continue;
    list.push({ x, y, z: j.z, s: j.s, ry: j.ry, tx: j.tx, tz: j.tz, lit: lit * near, hue: j.hue });
  }
  return list;
}

// ---------------------------------------------------------------- shots
const tp = (w: World, a: number, d: number, h = 0) => { const T = w.api.TERRACE; return [T.x + Math.sin(a) * d, T.y + h, T.z + Math.cos(a) * d]; };
const stagePos = (w: World) => tp(w, 0, -1);

function shotTheatre(w: World, t: number, open: number, pearls: number, cam: number[], level: number) {
  const a = w.api; a.show({ theatre: true }); a.sea(THEATRE); a.stageLights(level); const th = a.th; th.setDrapes(open); th.setPearls(pearls); th.setWaves(on2(t));
  a.cam(cam.slice(0, 3), cam.slice(3, 6), cam[6]); a.o.warp = 0; a.o.bloom = .5; a.o.vig = .5; a.o.bloomThr = 1.2;
}

function pose(w: World, A: Assets, t: number, i: number) {
  const a = w.api, o = a.o, p0 = stagePos(w), T = a.TERRACE, m = a.MOON, y = a.floorY;
  a.fish(on2(t));
  const litFrac = setWindows(w, A, t);
  switch (i) {
    case 0: shotTheatre(w, t, E.inOutCubic(P(t, 1.5, 3.5)) * .8, P(on2(t), .2, 1.4), CAM_OPEN(t), E.inOutSine(P(t, .7, 2))); break;
    case 1: case 2: {
      const k = E.inOutSine(P(t, 8, 11)); a.sea(a.mix(SURF, NIGHT, k)); a.show({ bed: t > 8.6 });
      const q = CAM_SEA(t), sx = nz(t, 1) * .05; a.cam([q[0]! + sx, q[1]!, q[2]!], q.slice(3, 6), q[6]);
      o.shaft = lerp(.9, .5, k); o.shaftFall = lerp(.003, .0048, k); o.exposure = lerp(.9, 1, k); o.focus = 140; o.aperture = 30 * P(t, 10, 11); o.bloom = lerp(.4, .5, k); o.bloomThr = 1.2;
      a.light('c', [0, 24, 40], 120 * k); a.light('a', [-19, 28, 42], 40 * k);
      if (t < 12) a.jelly(A.drift.map((d: any) => ({ ...d, y: d.y - (t - 8) * 1.2, lit: .8 * (1 - P(t, 9.4, 10.6)) })));
      break;
    }
    case 3: { // the Moon Tower room
      a.sea(ROOM); a.show({ room: true, bed: false });
      const sz = m.z + 4.5, c = [lerp(m.x - 4.0, m.x - 3.2, E.inOutSine(P(t, 16.8, 24))), y + 1.42, lerp(m.z - 2.2, m.z - 3.0, E.inOutSine(P(t, 16.8, 24)))], fov = lerp(26, 24.4, P(t, 16.8, 24));
      const up = inCubic(P(t, 22.7, 24.4)); a.cam(c, [m.x + .35 + up * 1.4, y + 1.42 + up * 3.4, sz], fov);                // she looks away; we look up to the window, and the moon
      const tt = on2(t), shy = E.inOutCubic(P(tt, 21.5, 21.9)) * (1 - E.inOutCubic(P(tt, 22.9, 23.4))), hum = .5 + .5 * Math.sin(tt * 2.6), p = [m.x + .1 - shy * .1, y, sz - 1.02];       // clear of the seat: the card must not cut into the cushion
      a.puppet({ pose: 'sit', p, h: 2.62, ry: face(p, c) + shy * .1 + Math.sin(tt * 1.3) * .006, rz: shy * .03, umb: lerp(.1, .18, hum) * (1 - shy * .6), key: '#eeeafb', rim: '#3f78d8', caus: .08, contact: false, foot: .025, threads: true });
      a.fishRoom(lerp(m.x - 30, m.x + 34, P(t, 20.4, 24)));
      a.jelly(A.outside); a.light('a', [m.x + .2, y + 3.6, m.z + 5.4], 11, '#bfe3ff'); a.light('b', [m.x - 3, y + 2.6, m.z + 1], 4, '#e0c8ff');
      o.mirrorY = y; o.mirrorHide = 'room'; o.mirrorAmt = .85; o.focus = Math.hypot(c[0]! - p[0]!, c[2]! - p[2]!); o.aperture = 34; o.shaft = .3;
      break;
    }
    case 4: { // the paper disc slides over the moon
      const e = Math.floor(E.inOutSine(P(t, 24.4, 28.6)) * 40) / 40, st = a.mix(NIGHT, DIM, P(t, 24, 25.4)); st.moon = lerp(.42, .14, e); st.eclipse = lerp(.001, 1, e); a.sea(st); a.show({ bed: false });
      const c = [-5.6, 66.5 - P(t, 24, 28.8) * .5, -6.4]; const dn = inCubic(P(t, 27.9, 29.15)); a.cam(c, [17 - dn * 22, 110 - dn * 86, 13 - dn * 6], 40);                 // from the covered moon down to the city it was lighting
      o.shaft = lerp(.34, .05, e); o.focus = keys([[24.6, 12], [26, 90]])(t); o.aperture = 22;
      break;
    }
    case 5: { // windows go out
      const k = P(t, 28.8, 33.4), st = a.mix(DUSK, DARK, k); st.eclipse = 1; a.sea(st); a.show({});
      a.cam([-26 - k * 2, 76 - k, 158 - k * 4], [2, 33, 4], 30); o.shaft = .1 * (1 - k); o.bloom = .55; o.bloomThr = 1.1; o.exposure = 1.05;
      a.light('c', [0, 40, 20], 240 * litFrac);
      break;
    }
    case 6: { // the dark room, the umbrella wakes
      a.sea({ ...DARK, fog: .009, hemi: .1, eclipse: 1 }); a.show({ room: true, bed: false });
      const tt = on2(t), u = E.inOutSine(P(t, 35.1, 36.5)), br = 1 + .12 * Math.sin(tt * 3.1), k = P(t, 33.6, 38.4), c = [m.x - .4 - k * .2, y + 1.7, m.z - 3.4 + k * 2.1], p = [m.x - 2.15, y, m.z + 4.5];
      a.cam(c, [p[0]! + .1, y + 1.82 + k * .5, p[2]!], 30);
      a.puppet({ pose: 'sad', p, ry: face(p, c), rz: Math.sin(tt * 1.6) * .006, umb: lerp(.03, .75, u) * br, shade: .88, key: lerp(.25, 1, u) > .9 ? '#8a9ae0' : '#4a5496', rim: '#3f78d8', caus: 0, contact: false, threads: true });
      a.light('a', [p[0]! - .7, y + 2.6, p[2]! - .9], lerp(.1, 3.2, u) * br, '#8fe4ff'); o.mirrorY = y; o.mirrorHide = 'room'; o.mirrorAmt = .7; o.focus = Math.hypot(c[0]! - p[0]!, c[2]! - p[2]!); o.aperture = 30; o.bloom = .75; o.bloomThr = 1.1; o.vig = .62;
      break;
    }
    case 7: { // she walks out
      a.sea({ ...DARK, fog: .0062, hemi: .07, env: .15, eclipse: 1 }); a.show({});
      const tt = on2(t), u = E.inOutSine(P(tt, 38.5, 42.5)), st = tt * 2.1, sB = tp(w, AK, 8.6), p = [lerp(sB[0]!, p0[0]!, u), T.y, lerp(sB[2]!, p0[2]!, u)], hop = Math.abs(Math.sin(st * Math.PI)) * .05 * (1 - P(tt, 42.3, 42.6));
      const k = P(t, 38.4, 43.2), c = add(p0, Math.sin(.12) * lerp(31, 28.5, k), lerp(9.5, 8.6, k), Math.cos(.12) * lerp(31, 28.5, k)); a.cam(c, add(p0, 0, 3.3, -1), 25);
      a.puppet({ pose: 'sad', p: [p[0]!, p[1]! + hop, p[2]!], ry: face(p, c), rz: Math.sin(st * Math.PI) * .03 * (1 - P(tt, 42.3, 42.6)), umb: .9, shade: .9, key: '#8a9ae0', rim: '#3f78d8', caus: 0 });
      a.light('a', add(p, -.8, 3.2, .8), 16, '#8fe4ff'); o.mirrorY = T.y; o.mirrorAmt = .9; o.focus = 30; o.aperture = 30; o.bloom = .8; o.bloomThr = 1.1; o.vig = .6; a.deck({ glow: .07 });
      break;
    }
    case 8: { // she sings
      a.sea({ ...DARK, fog: .006, hemi: .12, env: .25, eclipse: 1 }); a.show({});
      const tt = on2(t), dir = [Math.sin(.12), Math.cos(.12)], k = P(t, 43.2, 48), d = lerp(7.9, 7.3, k), c = add(p0, dir[0]! * d, 2.05, dir[1]! * d), inh = E.inOutSine(P(t, 43.5, 44.4)) * (1 - P(t, 44.4, 44.9));
      const shake = hash(Math.floor(tt * 12) % 3) - .5, sing = P(t, 44.4, 44.7), dec = 1 - P(t, 45.8, 47.6);
      const p = [p0[0]!, T.y + inh * .02, p0[2]!]; a.cam(c, add(p0, .1 + nz(t, 3) * .01, 2.2, 0), 14.5);
      a.puppet({ pose: 'sad', p: add(p, shake * .01 * sing * dec, 0, 0), ry: face(p, c), rz: shake * .007 * sing * dec, umb: .55 + .25 * sing, shade: .42, key: '#d4dbfa', rim: '#58a2f2', caus: 0, threads: true });
      a.light('a', add(p, -.8, 3, 1.5), 12, '#8fe4ff');
      const ring = (n: number) => { const q = P(t, 44.5 + n * .62, 44.5 + n * .62 + 2.4); return [.06 + E.outCubic(q) * .62, (1 - q) * (q > 0 ? 1 : 0)]; }, R = [ring(0), ring(1), ring(2)];
      a.rings({ p: add(p, 0, 2.05, 0), s: 7.5, rot: [0, face(p, c), 0], r: R.map(r => r[0]), a: R.map(r => r[1]), g: 1.1, c: '#8fdcff' });
      o.mirrorY = T.y; o.focus = d; o.aperture = 26; o.bloom = .6; o.bloomThr = 1.2; o.vig = .62; a.deck({ glow: .5 * sing }); a.jelly(jellyList(A, t));
      break;
    }
    case 9: { // the jellies answer
      const st = a.mix({ ...DARK, eclipse: 1 }, { ...SONG, hemi: .3, env: .55, caustic: 1.4, eclipse: 1 }, E.inOutSine(P(t, 47.6, 49.4))); a.sea(st); a.show({});
      const k = P(t, 48, 52.8), b = keys([[48, AK + 1.15], [52.8, AK - .15]])(t), d = lerp(9.4, 7.1, E.inOutSine(k)), h = lerp(1.1, 3.4, E.inOutSine(k)), c = add(p0, Math.sin(b) * d, h, Math.cos(b) * d);
      a.cam(c, add(p0, 0, lerp(3.2, 2.5, k), 0), 44);
      a.puppet({ pose: 'happy', p: p0, ry: face(p0, c), rz: Math.sin(on2(t) * 2) * .012, umb: .4, rim: '#d7a6ff', key: '#f6f0ff', caus: .05, threads: true });
      a.light('a', add(p0, 0, 5, 4), 22, '#bfe9ff'); a.light('b', add(p0, -4, 2, -4), 18, '#f3b0ff'); o.mirrorY = T.y; o.focus = d; o.aperture = 26; o.bloom = .55; a.deck({ glow: .85 * P(t, 47.8, 49.4), c: '#c9eaff' });
      a.jelly(jellyList(A, t, [], c));
      break;
    }
    case 10: { // the whole city answers
      a.sea({ ...SONG, fog: .004, eclipse: 1 }); a.show({}); const k = E.inOutSine(P(t, 53, 57.8));
      // the same camera as S10: it swings up round the terrace on the sea side, clear of every tower, and out over the whole city
      const b = CR_B(t), d = CR_D(t), c = add(p0, Math.sin(b) * d, CR_H(t), Math.cos(b) * d), l = [lerp(p0[0]!, -4, k), lerp(p0[1]! + 2.5, 30, k), lerp(p0[2]!, 12, k)];
      a.cam(c, l, lerp(44, 34, k)); const dist = Math.hypot(c[0]! - l[0]!, c[1]! - l[1]!, c[2]! - l[2]!);
      a.puppet({ pose: 'joy', p: p0, ry: face(p0, c), rz: Math.sin(on2(t) * 2.2) * .014, umb: .7, rim: '#f0c8ff', contact: k < .4, caus: .05 });
      a.light('c', [-4, 40, 52], 180 * litFrac, '#d6a8ff'); a.light('a', [-19, 30, 33], 30, '#a8e6ff'); a.light('d', [34, 44, 52], 40 * litFrac, '#ffb0e6');
      o.mirrorY = T.y; o.focus = dist; o.aperture = 26; o.bloom = .42; a.deck({ glow: lerp(.85, .4, k) }); a.jelly(jellyList(A, t, [], c));
      break;
    }
    case 11: case 12: { // up over the city, and home to the surface: one move
      const k = E.inOutSine(P(t, 65.2, 68.4)), { c, l, dist } = endCam(t), reveal = E.inOutSine(P(t, 66.1, 68.5)), g = E.inOutSine(P(t, 60, 62)), st = a.mix(a.mix({ ...SONG, fog: .004, eclipse: 1 }, { ...SONG, fog: .0032, hemi: .46, eclipse: 1 }, g), SURF, k);
      st.eclipse = lerp(1, .001, Math.floor(reveal * 30) / 30); st.moon = lerp(.08, 1, reveal); a.sea(st); a.show({ bed: t < 67.2 });
      a.cam(c, l, END_F(t));
      const h = Math.hypot(c[0]! - p0[0]!, c[2]! - p0[2]!), el = Math.atan2(c[1]! - p0[1]!, h);
      if (t < 66.4) a.puppet({ pose: 'joy', p: p0, ry: face(p0, c), rx: el * .8 * g, umb: .7, rim: '#f0c8ff', key: '#fff6fb', contact: false, caus: .05 });
      const fade = 1 - k; a.light('c', [-4, 40, 52], 180 * fade, '#d6a8ff'); a.light('a', [-19, 30, 33], 30 * fade, '#a8e6ff'); a.light('d', [34, 44, 52], 40 * fade, '#ffb0e6');
      if (t < 62) { o.mirrorY = T.y; o.mirrorAmt = lerp(.8, 0, P(t, 60, 62)); }
      // her song leaves the terrace as rings across the whole city; every window sends up a small light
      const ring = (n: number) => { const q = P(t, 62.4 + n * .55, 65 + n * .55); return [.02 + E.outCubic(q) * .94, (1 - q) * (q > 0 ? 1 : 0)]; }, R = [ring(0), ring(1), ring(2)];
      if (t > 62.4 && t < 66.2) a.rings({ p: [T.x, T.y + 30, T.z], s: 170, rot: [-Math.PI / 2, 0, 0], r: R.map(r => r[0]), a: R.map(r => r[1]), g: .32, c: '#d9c2ff' });
      a.glows(A.lanterns.filter((q: any) => t > q.on).map((q: any) => { const u = .75 * P(t, q.on, q.on + .7) * (1 - P(t, 65.4, 67)); return [q.x, q.y + (t - q.on) * q.v, q.z, q.r * u, q.g * u, q.b * u, q.s]; }));
      a.deck({ glow: lerp(.4, .6, g) }); a.jelly(jellyList(A, t, [], c).map((j: any) => ({ ...j, lit: j.lit * lerp(1, .55, k) })));
      o.focus = dist; o.aperture = lerp(26, 20, g) * (1 - k); o.bloom = lerp(lerp(.42, .46, g), .4, k) + .14 * Math.exp(-(((t - 62.4) / .5) ** 2)); o.bloomThr = lerp(1.5, 1.2, g); o.shaft = lerp(.42 * g, .9, k); o.shaftC = reveal > .5 ? '#a9d8ff' : '#c9b6ff'; o.shaftFall = .003; o.exposure = lerp(1, .9, k);
      break;
    }
    default: { // back through the wave; the drapes close
      const u = E.inOutSine(P(t, 69.6, 71.6)), z = lerp(14, 46, E.outCubic(P(t, 69.6, 71.4))), cam = [0, y0 + 8, z, 0, y0 + 8.6, 0, 34];
      shotTheatre(w, t, lerp(.8, 0, E.inOutCubic(P(t, 69.9, 71.6))), 1 - P(t, 70.6, 71.8) * .9, cam, 1 - P(t, 71.2, 72) * .9); o.vig = .55; o.exposure = 1 - P(t, 71.4, 72) * .8; void u;
    }
  }
}

// ---------------------------------------------------------------- setup + frame
interface Assets { stage: Stage<World>; cards: any[]; bands: OffscreenCanvas[]; wins: Win[]; lit: Float32Array; tint: Float32Array; jellies: J[]; drift: any[]; outside: any[]; lanterns: any[] }

export async function setup(ctx: SetupContext) {
  const stage = await prepareStage(ctx, b => buildWorld(b), { fov: 34, toneMapping: 'none', antialias: false });
  const w = stage.objects, wins = bakeWindows(w), n = wins.length, r = rng(9);
  const near = [46 + 26, 128 + 22, 26 + 16], drift = Array.from({ length: 16 }, () => { const a = r() * TAU, d = 6 + r() * 28; return { x: near[0]! + Math.sin(a) * d, y: near[1]! - 8 + r() * 34, z: near[2]! + Math.cos(a) * d, s: .6 + r() * r() * 1.2, ry: r() * TAU, tx: (r() - .5) * .4, tz: (r() - .5) * .4, hue: r() * .3 }; });
  const m = w.api.MOON, outside = Array.from({ length: 12 }, () => { const a = r() * TAU, d = 4 + r() * 16; return { x: m.x + 3 + Math.sin(a) * d, y: w.api.floorY + 2 - 5 + r() * 19, z: m.z + 30 + Math.cos(a) * d, s: .5 + r() * r() * .7, ry: r() * TAU, tx: (r() - .5) * .4, tz: (r() - .5) * .4, hue: r() * .35, lit: .75 }; });
  const T = w.api.TERRACE, lit = w.api.castle.wins, lanterns = Array.from({ length: 460 }, () => { const q = lit[Math.floor(r() * lit.length)]!, d = Math.hypot(q.p.x - T.x, q.p.z - T.z); return { x: q.p.x + (r() - .5) * 3, y: q.p.y, z: q.p.z + (r() - .5) * 3, v: 3 + r() * 6, r: 2.2, g: r() > .5 ? 1.7 : 2.4, b: r() > .5 ? 2.8 : 2.2, s: .45 + r() * .5, on: 60.2 + d / 120 * 3.4 + r() * .9 }; });
  (ctx.assets as Record<string, unknown>).haiyue = { stage, cards: CARDS.map(k => paintCard(k.text)), bands: [bakeBand(11, '#3f79d8', '#2c5fc2', '#2452b0', 'rgba(205,232,255,1)', 142), bakeBand(23, '#2452b4', '#1b3f9a', '#183689', 'rgba(170,208,250,1)', 158), bakeBand(37, '#163088', '#102468', '#0c1c58', 'rgba(140,182,240,1)', 176)], wins, lit: new Float32Array(n), tint: new Float32Array(n), jellies: bakeJellies(w), drift, outside, lanterns } satisfies Assets;
}

// Cuts that dissolve: both shots are really rendered for these frames; the rest stay hard cuts on the bar.
const DISSOLVE: [number, number][] = [[24, .8], [28.8, .7], [38.4, .6], [43.2, .45]];

export function renderFrame(ctx: FrameContext, time: number) {
  const A = (ctx.assets as Record<string, unknown>).haiyue as Assets, t = Math.min(time, DUR - .001), { beat } = BEATS.at(t), w = A.stage.objects;
  const dis = DISSOLVE.find(([at, d]) => Math.abs(t - at) < d / 2);
  if (dis) {
    const [at, d] = dis;
    resetWorld(w); pose(w, A, t, BEATS.at(at - .01).beat.index); renderWorld(ctx, A.stage, t);
    resetWorld(w); pose(w, A, t, BEATS.at(at + .01).beat.index); renderWorld(ctx, A.stage, t, E.inOutSine(P(t, at - d / 2, at + d / 2)));
  } else { resetWorld(w); pose(w, A, t, beat.index); renderWorld(ctx, A.stage, t); }
  ctx.withCanvas(c => {
    const fl = Math.exp(-(((t - 16.8) / .24) ** 2));                  // the window's light swallows the frame
    if (fl > .01) { c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(190,226,255,${fl * .95})`; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; }
    const ring = P(t, 47.45, 48.02), fade = 1 - P(t, 48.02, 48.75);   // her last ring of light grows until it fills the sea
    if (ring > 0 && fade > 0) { const R = 150 + inCubic(ring) * 1500, g = c.createRadialGradient(1010, 650, R * .55, 1010, 650, R); g.addColorStop(0, `rgba(190,238,255,${inCubic(ring) * inCubic(ring) * fade})`); g.addColorStop(.86, `rgba(200,242,255,${(.34 + ring * .66) * fade})`); g.addColorStop(1, 'rgba(120,200,255,0)'); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; }
    drawBubbles(c, t); drawWash(c, A, t); drawCards(c, A, t);
  });
}
