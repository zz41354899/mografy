// 格式塔心理學｜Gestalt Psychology — a 78 s, 13-shot stop-motion film in a paper theatre, timed to the
// ElevenLabs narration (assets/narration.mp3, laid 1.4 s late; cue sheet in storyboards/cues.json).
//
// The film's idea: a handful of card fragments and one bulb. Only from one lamp position do the fragments' shadows
// make a face; move the lamp and the face falls apart. The brain, like the lamp, completes the whole.
//
//  S01 點燈        0.0– 4.6  dark; the bulb snaps on; crane down over the hanging fragments
//  S02 整體        4.6–11.9  slider + rack focus; the lamp slides into place and the shadows lock into a face
//  S03 似動現象   11.9–18.7  low truck; two lamps take turns and the bird's shadow flies
//  S04 圖形與背景 18.7–25.8  a card with a window flies in; push through it to the vase / two faces
//  S05 接近       25.8–32.6  lamp off → ink backstage; top-down: scattered dots hop into pairs of columns
//  S06 相似       32.6–37.0  crane up; the dots even out and every other row flips to gold
//  S07 封閉       37.0–44.3  three bitten discs line up into a triangle that isn't there; orbit reveals the depth
//  S08 連續       44.3–49.3  two strands of yarn are laid; track along them
//  S09 共同命運   49.3–53.7  fifteen birds; five rise together
//  S10 簡潔       53.7–59.5  a ring and a square; only the lamp moves (on-screen name 簡潔, "也叫完形")
//  S11 換個角度   59.5–66.3  lamp off → back in the box, the face whole; the lamp moves and it falls apart; dolly zoom
//  S12 完成它     66.3–70.5  orbit; the lamp returns, the face locks, the fragments turn gold
//  S13 片尾       70.5–78.0  pull back out of the proscenium: the whole theatre on a desk
//
// Motion (param `motion`): 'stop-motion' (default) samples props and lamps on 2s (12 per second) with a seeded boil per
// pose; 'smooth' moves them every frame. The camera, focus, type and subtitles are always smooth.
import { at, beats, clamp, ease, lerp, text } from '@mografy/runtime';
import type { FrameContext, SetupContext, TextStyle } from '@mografy/runtime';
import { prepareStage, type Stage, type ThreeModule } from './three.js';
import { CJK_SANS, CJK_SERIF } from './cjk.js';
import { buildWorld, makePost, projPoint, TOP, L_FACE, L_RUBIN, L_PRAG, C_KAN, type V3, type World } from './world.js';

// ---------------------------------------------------------------- tokens
const C = { cream: '#F3EBDD', amber: '#E8A84A', muted: 'rgba(243,235,221,.74)', dim: 'rgba(243,235,221,.55)', bg: '#14110E' };
const T = {
  kicker: { size: 30, family: CJK_SANS, weight: 500, color: C.amber, tracking: 10 } as TextStyle,
  sub: { size: 44, family: CJK_SANS, weight: 500, color: C.cream, tracking: 2, align: 'center' } as TextStyle,
  stepNo: { size: 32, family: CJK_SANS, weight: 500, color: C.amber, tracking: 10 } as TextStyle,
  stepLatin: { size: 30, family: CJK_SANS, weight: 500, color: C.dim, tracking: 8 } as TextStyle,
  stepName: { size: 150, family: CJK_SERIF, weight: 700, color: C.cream, tracking: 12 } as TextStyle,
  stepDesc: { size: 42, family: CJK_SANS, weight: 500, color: C.muted } as TextStyle,
  tagline: { size: 48, family: CJK_SANS, weight: 500, color: C.amber, tracking: 12, align: 'center' } as TextStyle,
  latin: { size: 24, family: CJK_SANS, weight: 500, color: C.muted, tracking: 12, align: 'center' } as TextStyle,
  credit: { size: 22, family: CJK_SANS, weight: 500, color: C.dim, tracking: 2, align: 'right' } as TextStyle,
};

// ---------------------------------------------------------------- the shot table (times follow the narration)
export const BEATS = beats([
  { title: 'S01 點燈', end: 4.6, stop: 4.2, handoff: 1.2, note: 'The bulb snaps on; crane down over the fragments.' },
  { title: 'S02 整體', end: 11.9, stop: 10.8, handoff: 1.2, note: 'The lamp slides into place; the shadows lock into a face.' },
  { title: 'S03 似動現象', end: 18.7, stop: 17.9, handoff: 1.0, note: 'Two lamps take turns; the bird shadow flies.' },
  { title: 'S04 圖形與背景', end: 25.8, stop: 24.4, handoff: .8, note: 'Push through the window: a vase, or two faces.' },
  { title: 'S05 接近', end: 32.6, stop: 31.8, handoff: 1.0, note: 'Ink backstage; the dots hop into pairs of columns.' },
  { title: 'S06 相似', end: 37.0, stop: 36.4, handoff: 1.0, note: 'Crane up; every other row flips to gold.' },
  { title: 'S07 封閉', end: 44.3, stop: 41.2, handoff: 1.0, note: 'A triangle that is not there; orbit reveals the depth.' },
  { title: 'S08 連續', end: 49.3, stop: 48.6, handoff: 1.0, note: 'Two strands of yarn; track along them.' },
  { title: 'S09 共同命運', end: 53.7, stop: 53.1, handoff: 1.0, note: 'Five birds rise together.' },
  { title: 'S10 簡潔', end: 59.5, stop: 58.6, handoff: .8, note: 'A ring and a square; only the lamp moves.' },
  { title: 'S11 換個角度', end: 66.3, stop: 65.4, handoff: 1.0, note: 'The lamp moves; the face falls apart; dolly zoom.' },
  { title: 'S12 完成它', end: 70.5, stop: 70.2, handoff: 1.0, note: 'Orbit; the face locks again and turns gold.' },
  { title: 'S13 片尾', end: 78.0, stop: 76.4, note: 'Pull back: the whole theatre on a desk.' },
]);
export const meta = { width: 1920, height: 1080, duration: BEATS.duration, fps: 30, background: C.bg, shots: BEATS.shots };
export const params = {
  motion: { name: '動態 Motion', type: 'enum' as const, default: 'stop-motion', options: ['stop-motion', 'smooth'] },
};

// narration phrases shown as subtitles (film seconds, from storyboards/cues.json)
const SUBS: [number, number, string][] = [
  [1.48, 2.32, '這些碎片，'], [2.97, 3.85, '看起來像什麼？'],
  [4.90, 5.52, '燈一停，'], [5.79, 7.20, '碎片就成了一張臉。'], [7.86, 8.65, '考夫卡說：'], [9.07, 11.23, '整體，不等於部分的總和。'],
  [12.12, 14.10, '1912 年，魏泰默發現：'], [14.54, 16.10, '兩盞燈輪流亮起，'], [16.40, 18.32, '大腦卻看見一隻鳥在飛。'],
  [19.01, 19.67, '同一張圖，'], [19.99, 21.84, '你看到花瓶，還是兩張臉？'], [22.73, 25.23, '大腦一次，只能選一個當主角。'],
  [26.11, 28.29, '大腦拼圖，有幾個常見的習慣。'],
  [41.74, 43.82, '這個三角形，其實不存在。'],
  [59.85, 61.69, '換個角度，臉就散了。'], [62.39, 65.87, '我們對一個人的印象，也常是幾片碎片拼出來的。'],
  [66.55, 68.62, '所以，你不是在看世界，'], [68.96, 70.11, '你是在完成它。'],
];
// the six habits: ["第N，名稱" cue, descriptor cue, no., latin, name, descriptor]
const STEPS: [number, number, string, string, string, string][] = [
  [29.04, 30.70, '01', 'PROXIMITY', '接近', '靠在一起的，就是一組'],
  [32.97, 34.59, '02', 'SIMILARITY', '相似', '長得像的，會被看成同一類'],
  [37.26, 38.82, '03', 'CLOSURE', '封閉', '缺了一角，大腦會自己補上'],
  [44.56, 46.25, '04', 'CONTINUITY', '連續', '線條會順著最平滑的方向走下去'],
  [49.58, 51.47, '05', 'COMMON FATE', '共同命運', '一起移動的，就是同一群'],
  [53.90, 56.64, '06', 'PRÄGNANZ · 也叫完形', '簡潔', '大腦總是選最簡單的解釋'],
];
const STEPS_END = 59.1;
const KICKERS: [number, number, string][] = [
  [7.8, 11.7, 'K. KOFFKA · 格式塔心理學'], [12.3, 18.5, 'PHI PHENOMENON · 似動現象'], [19.3, 25.4, 'FIGURE / GROUND · 圖形與背景'],
  [26.5, 28.6, 'GESTALT · 大腦的習慣'], [60.1, 66.0, 'ANOTHER ANGLE · 換個角度'], [66.6, 70.3, 'COMPLETION · 完成'],
];

// ---------------------------------------------------------------- time
const FPS_ANIM = 12;
let STOP = false;
/** Pose time: on 2s in stop-motion, the real time otherwise. */
const step = (t: number) => STOP ? Math.floor(t * FPS_ANIM + 1e-6) / FPS_ANIM : t;
const io = ease.inOutCubic, out = ease.outCubic, inQ = ease.inQuad;
const mix3 = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
/** 0 → 1 over [a, a + d] on the pose clock. */
const ramp = (t: number, a: number, d: number, curve = io) => curve(clamp((step(t) - a) / d));

// ---------------------------------------------------------------- the lamps
const L_OFF: V3 = [2.5, 2.35, 4.4], L_OFF2: V3 = [2.7, 2.25, 4.5];
const PHI_A: V3 = [-1.3, 2.95, 4.6], PHI_B: V3 = [1.3, 2.95, 4.6], PHI_OUT: V3 = [5.4, 2.95, 4.6];
const L5: V3 = [3.5, 3.8, 5.9], L7: V3 = [3.6, 6.0, 5.8], L8: V3 = [-4.6, 2.9, 6.8], L9: V3 = [-3.1, 2.1, 5.4], L10a: V3 = [1.5, 3.3, 6.3];
/** S03: the moments the two lamps swap, slow then faster (snapped to the 12 fps grid). */
const SWAPS: number[] = (() => { const s: number[] = []; let t = 14.54, dt = .5; while (t < 18.3) { s.push(Math.round(t * 12) / 12); if (t > 15.9) dt = Math.max(1 / 6, dt * .78); t += dt; } if (s.length % 2) s.pop(); return s; })();
/** Lamp switch-offs between the acts (the scene changes in the dark). */
const DARK: [number, number][] = [[25.6, 26.3], [59.2, 59.85]];
const RUBIN_BLINKS = [21.92, 23.67];

function lampAt(t: number): { p: V3; k: number; p2: V3; k2: number; show2: boolean } {
  const ts = step(t);
  let p: V3 = L_OFF, k = t < .8 ? 0 : 1, p2: V3 = PHI_OUT, k2 = 0;
  if (t < 4.9) p = L_OFF;
  else if (t < 11.9) p = mix3(L_OFF, L_FACE, ramp(t, 4.9, .6));
  else if (t < 18.7) {
    p = mix3(L_FACE, PHI_A, ramp(t, 11.9, 1.0));
    p2 = mix3(PHI_OUT, PHI_B, ramp(t, 12.0, .9, out));
    const n = SWAPS.filter(s => ts >= s).length;   // swaps so far: odd → the right lamp is on
    if (n % 2) { k = 0; k2 = 1; }
  } else if (t < 25.8) {
    p = mix3(PHI_A, L_RUBIN, ramp(t, 18.7, .9)); p2 = mix3(PHI_B, PHI_OUT, ramp(t, 18.7, .8, inQ));
    if (RUBIN_BLINKS.some(b => ts >= b && ts < b + 1 / 12)) k = 0;
  } else if (t < 59.5) {
    if (t < 37.0) p = L5;
    else if (t < 44.3) p = mix3(L5, L7, ramp(t, 37.0, 1.2));
    else if (t < 49.3) p = mix3(L7, L8, ramp(t, 44.3, 1.1));
    else if (t < 53.7) p = mix3(L8, L9, ramp(t, 49.3, 1.0));
    else p = t < 55.2 ? mix3(L9, L10a, ramp(t, 53.7, 1.0)) : mix3(L10a, L_PRAG, ramp(t, 55.2, 2.2));
  } else if (t < 66.3) p = mix3(L_FACE, L_OFF2, ramp(t, 60.9, .6));
  else p = mix3(L_OFF2, L_FACE, ramp(t, 68.9, .7));
  for (const [a, b] of DARK) if (t >= a && t < b) { k = 0; k2 = 0; }
  if (t >= 25.6 && t < 26.3) p = L5;
  if (t >= 59.2 && t < 59.85) p = L_FACE;
  return { p, k, p2, k2, show2: t >= 12.0 && t < 19.6 };
}
/** Light intensity per stretch of the film (the lamp is further away in some shots). */
function lampPower(t: number) {
  if (t < 11.9) return 34; if (t < 18.7) return 26; if (t < 25.8) return 40;
  if (t < 44.3) return 30; if (t < 49.3) return lerp(30, 72, clamp((t - 44.3) / 1.1)); if (t < 53.7) return lerp(72, 32, clamp((t - 49.3) / 1.0));
  if (t < 59.5) return 46; return 34;
}

// ---------------------------------------------------------------- the camera
interface Pose { p: V3; q: V3; f: number; up?: V3 }
const UP: V3 = [0, 1, 0];
const rollUp = (deg: number): V3 => { const r = deg * Math.PI / 180; return [Math.sin(r), 0, -Math.cos(r)]; };
const P: Record<string, Pose> = {
  s01a: { p: [.3, 13.6, 8.6], q: [0, 1.2, 1.9], f: 40 },
  s01: { p: [.5, 8.9, 6.6], q: [-.1, 3.1, 1.0], f: 46 },
  s02: { p: [4.7, 3.3, 6.5], q: [-.45, 3.35, .6], f: 36 },
  s03: { p: [-.6, 2.3, 7.9], q: [.35, 3.3, 0], f: 44 },
  s04a: { p: [.95, 3.35, 6.95], q: [0, 3.3, 0], f: 40 },
  s04b: { p: [.22, 3.22, 4.4], q: [0, 3.25, 0], f: 44 },
  s04c: { p: [.32, 3.12, 3.75], q: [-.05, 3.27, 0], f: 45 },
  s04: { p: [1.55, 2.55, 3.55], q: [-.15, 3.3, 0], f: 46 },
  s05: { p: [-1.75, 6.9, 3.3], q: [-1.75, 0, 3.16], f: 40 },
  s06: { p: [-2.05, 8.3, 3.2], q: [-2.05, 0, 3.16], f: 40 },
  s07: { p: C_KAN, q: [-1.45, 3.45, 0], f: 40 },
  s07b: { p: [3.6, 3.7, 6.5], q: [-.9, 3.3, 1.6], f: 40 },
  s08a: { p: [-1.6, 5.4, 7.0], q: [-2.3, 0, 2.7], f: 44 },
  s08b: { p: [-.8, 4.6, 6.9], q: [-1.7, 0, 3.0], f: 44 },
  s09: { p: [1.5, .6, 6.8], q: [-1.7, 5.0, 1.6], f: 44 },
  s09b: { p: [1.5, .6, 6.8], q: [-1.7, 5.7, 1.6], f: 44 },
  s10: { p: [-1.6, 3.2, 5.2], q: [-1.0, 3.3, 0], f: 46 },
  s12: { p: [-4.6, 3.45, 6.4], q: [.45, 3.4, .5], f: 35 },
  s13: { p: [4.6, 7.4, 27.5], q: [0, 3.0, 3.5], f: 26 },
};
// S11 dolly zoom: the fragments keep their size while the wall behind them is pulled away
const T11: V3 = [-.1, 3.4, 1.4], C11: V3 = [.6, 3.45, 7.6];
const D11 = Math.hypot(C11[0] - T11[0], C11[1] - T11[1], C11[2] - T11[2]);
const DIR11: V3 = [(C11[0] - T11[0]) / D11, (C11[1] - T11[1]) / D11, (C11[2] - T11[2]) / D11];
const vertigo = (f: number): Pose => { const d = D11 * Math.tan(15 * Math.PI / 180) / Math.tan(f / 2 * Math.PI / 180); return { p: [T11[0] + DIR11[0] * d, T11[1] + DIR11[1] * d, T11[2] + DIR11[2] * d], q: T11, f }; };

const blend = (a: Pose, b: Pose, k: number): Pose => {
  const ua = a.up ?? UP, ub = b.up ?? UP, u = mix3(ua, ub, k), n = Math.hypot(...u) || 1;
  return { p: mix3(a.p, b.p, k), q: mix3(a.q, b.q, k), f: lerp(a.f, b.f, k), up: [u[0] / n, u[1] / n, u[2] / n] };
};
const move = (t: number, t0: number, t1: number, a: Pose, b: Pose, curve = io) => blend(a, b, curve(clamp((t - t0) / (t1 - t0))));
function bez3(a: V3, b: V3, c: V3, d: V3, u: number): V3 { const f = (i: 0 | 1 | 2) => (1 - u) ** 3 * a[i] + 3 * (1 - u) ** 2 * u * b[i] + 3 * (1 - u) * u * u * c[i] + u ** 3 * d[i]; return [f(0), f(1), f(2)]; }
/** Catmull–Rom through four poses (passes through every one: the push threads the card's window). */
function cr4(ps: Pose[], u: number): Pose {
  const n = ps.length - 1, x = clamp(u) * n, i = Math.min(n - 1, Math.floor(x)), s = x - i;
  const g = (k: number) => ps[Math.max(0, Math.min(n, k))]!;
  const crv = (a: number, b: number, c: number, d: number) => .5 * (2 * b + (c - a) * s + (2 * a - 5 * b + 4 * c - d) * s * s + (3 * b - a - 3 * c + d) * s * s * s);
  const P0 = g(i - 1), P1 = g(i), P2 = g(i + 1), P3 = g(i + 2);
  const v = (key: 'p' | 'q'): V3 => [0, 1, 2].map(j => crv(P0[key][j]!, P1[key][j]!, P2[key][j]!, P3[key][j]!)) as V3;
  return { p: v('p'), q: v('q'), f: lerp(P1.f, P2.f, s) };
}
const S05: Pose = { ...P.s05!, up: rollUp(-6) }, S05b: Pose = { ...P.s05!, up: rollUp(-11) }, S06: Pose = { ...P.s06!, up: rollUp(-9) };

function camera(t: number): Pose {
  if (t < 4.6) return move(t, .5, 4.3, P.s01a!, P.s01!, ease.inOutQuart);
  if (t < 11.9) return move(t, 4.6, 6.6, P.s01!, P.s02!);
  if (t < 18.7) return move(t, 11.9, 13.4, P.s02!, P.s03!);
  if (t < 25.95) {
    if (t < 19.7) return move(t, 18.7, 19.7, P.s03!, P.s04a!);
    return cr4([P.s04a!, P.s04b!, P.s04c!, P.s04!], io(clamp((t - 19.7) / 2.2)));
  }
  if (t < 32.6) return move(t, 26.0, 32.6, S05, S05b, ease.inOutSine);
  if (t < 37.0) return move(t, 32.6, 34.2, S05b, S06);
  if (t < 44.3) {
    if (t < 38.7) { // from straight down to straight ahead: tilt up while descending in front of the discs
      const u = io(clamp((t - 37.0) / 1.7)), b = blend(S06, P.s07!, u);
      return { ...b, p: bez3(S06.p, [-1.2, 8.0, 5.8], [-.1, 4.6, 7.2], C_KAN, u) };
    }
    if (t < 41.8) return P.s07!;
    const u = io(clamp((t - 41.8) / 1.9)), m = blend(P.s07!, P.s07b!, u);
    return { ...m, p: [m.p[0], m.p[1] + Math.sin(Math.PI * u) * .3, m.p[2] + Math.sin(Math.PI * u) * .5] };
  }
  if (t < 49.3) return t < 45.4 ? move(t, 44.3, 45.4, P.s07b!, P.s08a!) : move(t, 45.4, 49.3, P.s08a!, P.s08b!, ease.inOutSine);
  if (t < 53.7) return t < 50.5 ? move(t, 49.3, 50.5, P.s08b!, P.s09!) : move(t, 51.4, 52.9, P.s09!, P.s09b!);
  if (t < 59.5) return move(t, 53.7, 54.9, P.s09b!, P.s10!);
  if (t < 66.3) return t < 61.4 ? vertigo(30) : vertigo(lerp(30, 58, io(clamp((t - 61.4) / 2.8))));
  if (t < 70.5) { // orbit round the fragments to the far side
    const u = io(clamp((t - 66.3) / 3.6)), a = vertigo(58), m = blend(a, P.s12!, u);
    return { ...m, p: [m.p[0], m.p[1] + Math.sin(Math.PI * u) * .4, m.p[2] + Math.sin(Math.PI * u) * 2.2] };
  }
  const u = io(clamp((t - 70.5) / 5.2));
  return { p: bez3(P.s12!.p, [-3.5, 4.8, 12], [1.5, 6.6, 20], P.s13!.p, u), q: mix3(P.s12!.q, P.s13!.q, u), f: lerp(P.s12!.f, P.s13!.f, u) };
}

/** Focus, with every shot change blended over 0.7 s so the depth of field never pops. */
const FOCUS_CUTS = [4.6, 11.9, 18.7, 37.0, 44.3, 49.3, 53.7, 66.3, 70.5];
function focus(t: number): { at: V3; ap: number } {
  for (const b of FOCUS_CUTS) if (t >= b && t < b + .7) {
    const a = focusRaw(b - 1e-3), c = focusRaw(t), u = io((t - b) / .7);
    return { at: mix3(a.at, c.at, u), ap: lerp(a.ap, c.ap, u) };
  }
  return focusRaw(t);
}
function focusRaw(t: number): { at: V3; ap: number } {
  const wallFace: V3 = [0, 3.6, 0];
  if (t < 4.6) return { at: [0, 3.4, 2.6], ap: 8 };
  if (t < 11.9) return { at: mix3([.2, 3.4, 2.8], wallFace, io(clamp((t - 6.4) / .8))), ap: lerp(14, 22, clamp((t - 6.4) / .8)) };
  if (t < 18.7) return { at: [1.4, 3.6, 0], ap: 13 };
  if (t < 25.95) return { at: mix3([0, 3.4, 2.5], [0, 3.3, 0], io(clamp((t - 21.0) / .8))), ap: lerp(12, 24, clamp((t - 21.0) / .8)) };
  if (t < 37.0) return { at: [0, .13, 3.2], ap: 6 };
  if (t < 44.3) return { at: [0, 3.3, 2.9], ap: t < 41.8 ? 3 : 8 };
  if (t < 49.3) return { at: [-.2, .05, 3.0], ap: 12 };
  if (t < 53.7) return { at: [0, 4.4, 2.3], ap: 9 };
  if (t < 59.5) return { at: [0, 3.3, 0], ap: 14 };
  if (t < 66.3) return { at: t < 61.4 ? wallFace : [.1, 3.5, 2.4], ap: t < 61.4 ? 16 : 12 };
  if (t < 70.5) return { at: wallFace, ap: 18 };
  return { at: mix3(wallFace, [0, 6.5, 7], io(clamp((t - 70.5) / 5.2))), ap: lerp(18, 5, clamp((t - 70.5) / 5.2)) };
}

// ---------------------------------------------------------------- posing the world
interface Film { stage: Stage<World>; post: ReturnType<typeof makePost> }
const hash = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
/** Stretch a string from an anchor up to the rigging bar (hidden when the anchor is above it). */
function str(s: ThreeModule, a: V3) {
  const h = TOP - a[1]; s.visible = h > .02; if (!s.visible) return;
  s.scale.y = h; s.position.set(a[0], a[1] + h / 2, a[2] + .011);
}
/** A cutout drawn in wall coordinates, hung on the ray from L at fraction t, lifted by dy. */
function hangProj(m: ThreeModule, s: ThreeModule, L: V3, t: number, anchor: [number, number], dy: number, jx = 0, jy = 0) {
  m.scale.set(t, t, 1); m.position.set(L[0] * (1 - t) + jx, L[1] * (1 - t) + dy + jy, L[2] * (1 - t));
  const a = projPoint(L, anchor, t); str(s, [a[0] + jx, a[1] + dy + jy, a[2]]);
}
function setLampMesh(l: World, p: V3, k: number, flick: number) {
  l.g.position.set(p[0], 0, p[2]);
  const h = p[1] - .3; l.rod.scale.y = h; l.rod.position.y = h / 2 + .07; l.sock.position.y = p[1] - .22; l.bulb.position.y = p[1]; l.light.position.y = p[1];
  l.light.visible = k > 0; l.bulbMat.emissiveIntensity = k > 0 ? 9 * k * flick : .05; l.bulbMat.color.set(k > 0 ? 0xffe9c8 : 0xb8b0a2);
}

// dot layouts on the floor (S05–S06): scattered → pairs of columns → even grid
const ZS = [2.0, 2.58, 3.16, 3.74, 4.32], PROX_X = [-2.25, -1.8, -.225, .225, 1.8, 2.25], GRID_X = [-1.55, -.93, -.31, .31, .93, 1.55];
const scatter = (i: number): [number, number] => [-2.6 + 5.2 * hash(i, 1), 1.9 + 2.5 * hash(i, 2)];
const prox = (i: number): [number, number] => [PROX_X[i % 6]!, ZS[Math.floor(i / 6)]!];
const grid = (i: number): [number, number] => [GRID_X[i % 6]!, ZS[Math.floor(i / 6)]!];

function pose(ctx: FrameContext, W: World, t: number, camPose: Pose, cam: ThreeModule) {
  const ts = step(t), n = STOP ? Math.floor(t * FPS_ANIM + 1e-6) : 0;
  const boil = (k: number, amt: number) => (ctx.noise(n, k) - .5) * 2 * amt;
  const act2 = t >= 26.0 && t < 59.5;
  W.ink.visible = act2;
  W.deskProps.visible = t >= 70.5; W.room.visible = t >= 70.5; W.pro.visible = W.title.visible = t >= 70.5;

  // lights
  const L = lampAt(t), flick = STOP ? 1 + boil(91, .03) : 1 + .012 * Math.sin(t * 7.3) + .008 * Math.sin(t * 13.1), pw = lampPower(t);
  setLampMesh(W.lamp, L.p, L.k, flick); W.lamp.light.intensity = pw * L.k * flick;
  W.lamp2.g.visible = L.show2; setLampMesh(W.lamp2, L.p2, L.k2, flick); W.lamp2.light.intensity = 26 * L.k2 * flick; W.lamp2.light.visible = L.show2 && L.k2 > 0;
  const dark = t < .8 || DARK.some(([a, b]) => t >= a && t < b);
  W.hemi.intensity = dark ? 0 : t >= 70.5 ? .3 : act2 ? .13 : .22;
  W.fill.intensity = t < .8 ? .45 : dark ? 0 : t >= 70.5 ? .3 : act2 ? .05 : .14;

  // A. the face fragments (S01–S02, S11–S13)
  const faceOn = t < 12.9 || t >= 59.5;
  const liftF = t < 59.5 ? 7 * ramp(t, 11.9, .8, inQ) : 0;
  const goldFlip = clamp((ts - 69.75) * 12 / 3);   // three poses: tilt, edge, gold
  W.facePieces.forEach((p: World, i: number) => {
    p.m.visible = faceOn; p.s.visible = faceOn; if (!faceOn) return;
    p.m.material = goldFlip >= 1 ? W.mats.mGold : W.mats.mCard;
    hangProj(p.m, p.s, L_FACE, p.t, p.anchor, liftF + (i % 3) * .3 * clamp(liftF), boil(100 + i, .003), boil(120 + i, .003));
    if (goldFlip > 0 && goldFlip < 1) p.m.scale.x = p.t * (goldFlip < .5 ? .55 : .12);
  });

  // B. the phi bird (S03)
  const birdOn = t >= 12.0 && t < 19.6;
  W.phiBird.visible = birdOn; W.phiStr.visible = birdOn;
  if (birdOn) {
    const dy = 6 * (1 - ramp(t, 12.1, .8, out)) + 7 * ramp(t, 18.7, .7, inQ);
    W.phiBird.position.set(boil(130, .004), 3.3 + dy, 2.4); W.phiBird.rotation.set(0, boil(131, .02), boil(132, .006));
    str(W.phiStr, [W.phiBird.position.x, 3.35 + dy, 2.41]);
  }

  // C. the vase and the card with a window (S04)
  const rubinOn = t >= 18.8 && t < 25.95;
  W.rubin.visible = rubinOn;
  if (rubinOn) {
    const dyB = 8 * (1 - ramp(t, 18.8, .9, out)), dyV = 6 * (1 - ramp(t, 19.0, .8, out));
    hangProj(W.vase, W.vaseStr, L_RUBIN, .583, [0, 5.1], dyV, 0, boil(140, .003));
    W.vase.rotation.set(0, 0, 0);
    W.board.scale.set(1 / 3, 1 / 3, 1); W.board.position.set(L_RUBIN[0] * 2 / 3, L_RUBIN[1] * 2 / 3 + dyB, L_RUBIN[2] * 2 / 3);
    const top = L_RUBIN[1] * 2 / 3 + 13 / 3 + dyB;
    W.boardStr.forEach((s: ThreeModule, i: number) => str(s, [i ? 3.2 : -3.2, top, 4.0]));
  }

  // D/E. the thirty dots (S05–S06)
  const dotsOn = t >= 26.0 && t < 37.9;
  W.dots.forEach((o: World, i: number) => {
    o.g.visible = dotsOn; if (!dotsOn) return;
    const r = Math.floor(i / 6), c = i % 6;
    const hopTo = (a: [number, number], b: [number, number], start: number): [number, number, number] => {
      const u = clamp((ts - start) / .25); if (u <= 0) return [a[0], 0, a[1]];
      return [lerp(a[0], b[0], STOP ? u : io(u)), Math.sin(Math.PI * u) * .35, lerp(a[1], b[1], STOP ? u : io(u))];
    };
    let p: [number, number, number];
    if (ts < 32.9) p = hopTo(scatter(i), prox(i), 29.1 + hash(i, 3) * .9);
    else p = hopTo(prox(i), grid(i), 33.0 + c * 1 / 12 + r * .04);
    o.g.position.set(p[0], p[1], p[2]);
    o.g.rotation.set(boil(200 + i, .05), hash(i, 4) * 6 + boil(240 + i, .04), boil(280 + i, .05));
    // gold rows flip (rows 0, 2, 4), left to right, one dot every 2 frames; then everything flips away at 37.0
    const gold = r % 2 === 0, f = clamp((ts - (34.25 + c * 2 / 12)) * 12 / 3), away = clamp((ts - (37.0 + c / 12 + r * .03)) * 12 / 3);
    o.d.material = gold && f >= 1 ? W.mats.mGoldDot : W.mats.mCream;
    const tilt = gold && f > 0 && f < 1 ? (f < .5 ? .7 : 1.45) : 0;
    o.d.rotation.set(tilt + (away > 0 ? away * Math.PI / 2 : 0), 0, 0);
    o.g.visible = away < 1;
  });

  // F. the three bitten discs (S07)
  const kanOn = t >= 37.2 && t < 45.1;
  W.kan.forEach((k: World, i: number) => {
    k.m.visible = k.s.visible = kanOn; if (!kanOn) return;
    const dy = 6 * (1 - ramp(t, 37.3 + i * .12, .8, out)) + 7 * ramp(t, 44.3 + i * .08, .7, inQ);
    hangProj(k.m, k.s, C_KAN, k.t, k.anchor, dy, boil(300 + i, .002), boil(310 + i, .002));
  });

  // G. the yarn (S08): laid out, then wound back
  const yu = ramp(t, 44.7, 1.2, ease.linear) * (1 - ramp(t, 49.25, .6, ease.linear));
  W.yarn.forEach((y: ThreeModule, i: number) => {
    y.visible = t >= 44.7 && t < 49.9;
    const u = clamp(yu * 1.08 - i * .08);
    y.geometry.setDrawRange(0, Math.floor(u * W.yarnSegs) * W.yarnRadial * 6);
  });

  // H. fifteen birds (S09): lowered, five rise together, all flown out
  const birdsOn = t >= 49.35 && t < 54.6;
  const rise = .95 * ramp(t, 51.5, 1.1, STOP ? ease.linear : io);
  W.birds.forEach((o: World) => {
    o.b.visible = o.s.visible = birdsOn; if (!birdsOn) return;
    const dy = 6 * (1 - ramp(t, 49.4 + o.k * .02, .8, out)) + 7 * ramp(t, 53.7 + o.k * .015, .7, inQ) + (o.mover ? rise : 0);
    o.b.position.set(o.x + boil(400 + o.k, .004), o.y + dy, o.z);
    const flap = o.mover && t >= 51.5 && t < 52.7 ? (Math.floor(t * 6) % 2 ? .18 : -.12) : 0;
    o.b.rotation.set(o.rot[0] + flap, o.rot[1] + boil(430 + o.k, .02), o.rot[2] + boil(460 + o.k, .01));
    str(o.s, [o.b.position.x, o.y + dy + .05, o.z + .01]);
  });

  // I. the ring and the square (S10)
  const pragOn = t >= 53.9 && t < 59.5;
  W.prag.forEach((p: World, i: number) => {
    p.m.visible = p.s.visible = pragOn; if (!pragOn) return;
    hangProj(p.m, p.s, L_PRAG, p.t, p.anchor, 6 * (1 - ramp(t, 53.9 + i * .15, .8, out)), boil(500 + i, .003), boil(510 + i, .003));
  });

  // camera
  cam.fov = camPose.f; cam.position.set(...camPose.p); const u = camPose.up ?? UP; cam.up.set(u[0], u[1], u[2]); cam.lookAt(...camPose.q);
}

// ---------------------------------------------------------------- setup and frame
export async function setup(ctx: SetupContext) {
  const stage = await prepareStage(ctx, b => {
    b.renderer.shadowMap.enabled = true; b.renderer.shadowMap.type = b.THREE.PCFShadowMap;
    b.renderer.outputColorSpace = b.THREE.LinearSRGBColorSpace; b.renderer.toneMapping = b.THREE.NoToneMapping;
    b.scene.background = new b.THREE.Color(0x14110e);
    b.camera.near = .1; b.camera.far = 200;
    return buildWorld(b.THREE, b.scene, b.renderer);
  }, { fov: 40, toneMapping: 'none' });
  const post = makePost(stage.THREE, stage.renderer, ctx.width, ctx.height);
  stage.renderer.setRenderTarget(post.rt); stage.renderer.render(stage.scene, stage.camera); stage.renderer.setRenderTarget(null);
  ctx.assets.film = { stage, post } satisfies Film;
}

function project(W: World, cam: ThreeModule, p: V3): [number, number, boolean] {
  const v = W.v.set(p[0], p[1], p[2]).project(cam);
  return [(v.x + 1) / 2 * 1920, (1 - v.y) / 2 * 1080, v.z < 1];
}

export function renderFrame(ctx: FrameContext, time: number, p: { motion?: string } = {}) {
  STOP = p.motion !== 'smooth';
  const { stage, post } = ctx.assets.film as Film, W = stage.objects, cam = stage.camera, t = time;
  // the 3D layer renders at most at 1920 × 1080; depth of field and grain hide the upscale on Retina previews
  const s3 = Math.min(ctx.renderScale, 1);
  const pw = Math.max(1, Math.round(ctx.width * s3)), ph = Math.max(1, Math.round(ctx.height * s3));
  if (stage.surface.width !== pw || stage.surface.height !== ph) stage.renderer.setSize(pw, ph, false);
  post.resize(pw, ph, ctx.width);
  cam.aspect = ctx.width / ctx.height;
  const cp = camera(t);
  pose(ctx, W, t, cp, cam);
  cam.updateProjectionMatrix(); cam.updateMatrixWorld(); stage.scene.updateMatrixWorld(true);
  const f = focus(t), fv = W.v2.set(...f.at).applyMatrix4(cam.matrixWorldInverse);
  post.mat.uniforms.focus.value = -fv.z; post.mat.uniforms.aperture.value = f.ap; post.mat.uniforms.seed.value = Math.floor(t * 30) % 97;
  post.mat.uniforms.exposure.value = t >= 44.3 && t < 49.3 ? lerp(1, 1.3, clamp((t - 44.3) / .8)) * (1 - .3 * clamp((t - 48.6) / .7) / 1.3) : 1;
  post.render(stage.scene, cam);
  ctx.withCanvas(c => { c.imageSmoothingQuality = 'high'; c.drawImage(stage.surface, 0, 0, ctx.width, ctx.height); });

  ctx.withCanvas(c => {
    // bulb glow (both lamps)
    const L = lampAt(t);
    const glow = (pos: V3, k: number) => {
      if (k <= 0) return; const [x, y, front] = project(W, cam, pos); if (!front) return;
      const R = 260, a = .5 * Math.min(1, k); c.globalCompositeOperation = 'screen';
      const g = c.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, `rgba(255,190,100,${a})`); g.addColorStop(.25, `rgba(255,160,70,${a * .35})`); g.addColorStop(1, 'rgba(255,140,60,0)');
      c.fillStyle = g; c.fillRect(x - R, y - R, 2 * R, 2 * R); c.globalCompositeOperation = 'source-over';
    };
    glow(L.p, L.k); if (L.show2) glow(L.p2, L.k2);
    overlay(c, t);
  });
}

// ---------------------------------------------------------------- 2D: type, subtitles, transitions
function fadeIn(t: number, a: number, b: number, inn = .35, outD = .3) { return at(t, a, a + inn, out) * (1 - at(t, b - outD, b, io)); }
function overlay(c: CanvasRenderingContext2D, t: number) {
  // top scrim + kicker
  const kick = KICKERS.find(([a, b]) => t >= a - .1 && t < b);
  if (kick) {
    const k = fadeIn(t, kick[0], kick[1]);
    const g = c.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, `rgba(14,11,8,${.5 * k})`); g.addColorStop(1, 'rgba(14,11,8,0)'); c.fillStyle = g; c.fillRect(0, 0, 1920, 300);
    text(c, kick[2], 150, 150 - (1 - k) * 6, { ...T.kicker, alpha: k });
  }
  // S05–S10: the six habits, one layout that stays while its content changes
  if (t >= STEPS[0]![0] - .4 && t < STEPS_END) {
    const sk = fadeIn(t, STEPS[0]![0] - .4, STEPS_END, .5, .45);
    const g = c.createLinearGradient(0, 0, 940, 0); g.addColorStop(0, `rgba(10,8,6,${.62 * sk})`); g.addColorStop(1, 'rgba(10,8,6,0)'); c.fillStyle = g; c.fillRect(0, 0, 940, 1080);
    STEPS.forEach(([cue, descAt, no, latin, name, desc], i) => {
      const next = STEPS[i + 1]?.[0] ?? STEPS_END + .15, end = next - .12;
      if (t < cue - .12 || t >= end) return;
      const k1 = fadeIn(t, cue - .12, end, .35, .3), k2 = fadeIn(t, descAt - .12, end, .4, .3);
      text(c, `No.${no}`, 150, 420, { ...T.stepNo, alpha: k1 }); text(c, latin, 300, 420, { ...T.stepLatin, alpha: k1 });
      text(c, name, 142, 600 + (1 - k1) * 10, { ...T.stepName, alpha: k1 });
      text(c, desc, 150, 690 + (1 - k2) * 8, { ...T.stepDesc, alpha: k2 });
    });
    const cur = STEPS.filter(s => t >= s[0] - .12).length - 1;
    for (let i = 0; i < 6; i++) { c.globalAlpha = sk; c.fillStyle = i === cur ? C.amber : i < cur ? 'rgba(232,168,74,.38)' : 'rgba(243,235,221,.2)'; c.beginPath(); c.roundRect(150 + i * 64, 760, 48, 6, 3); c.fill(); }
    c.globalAlpha = 1;
  }
  // subtitles
  const subOn = SUBS.some(([a, b]) => t >= a - .15 && t < b + .6);
  if (subOn) { const g = c.createLinearGradient(0, 780, 0, 1080); g.addColorStop(0, 'rgba(14,11,8,0)'); g.addColorStop(1, 'rgba(14,11,8,.55)'); c.fillStyle = g; c.fillRect(0, 780, 1920, 300); }
  SUBS.forEach(([a, b, s], i) => {
    const next = SUBS[i + 1]?.[0] ?? Infinity, end = Math.min(b + .6, next - .08);
    if (t < a - .15 || t > end) return;
    const k = at(t, a - .15, a + .1, out) * (1 - at(t, end - .18, end, io));
    c.save(); c.shadowColor = 'rgba(10,8,6,.6)'; c.shadowBlur = 16; text(c, s, 960, 1000 + (1 - k) * 8, { ...T.sub, alpha: k }); c.restore();
  });
  // transitions: the opening dark, the two lamp switch-offs between the acts, the end
  const dip = (a: number, b: number) => at(t, a, a + .12, out) * (1 - at(t, b - .25, b, out));
  const black = Math.max(t < .8 ? (t < .2 ? 1 : 1 - .82 * at(t, .2, .5, out)) : 0, ...DARK.map(([a, b]) => dip(a, b) * .9), at(t, 77.2, 78.0, io));
  if (black > 0) { c.fillStyle = `rgba(10,8,6,${black})`; c.fillRect(0, 0, 1920, 1080); }
  // S13: tagline and credit
  if (t >= 70.5) {
    const k = fadeIn(t, 70.6, 77.3, .5, .4), k2 = fadeIn(t, 72.2, 77.3, .6, .4);
    const g = c.createLinearGradient(0, 760, 0, 1080); g.addColorStop(0, 'rgba(14,11,8,0)'); g.addColorStop(1, `rgba(14,11,8,${.7 * k})`); c.fillStyle = g; c.fillRect(0, 760, 1920, 320);
    text(c, '你看見的，是大腦完成的', 966, 930 + (1 - k) * 8, { ...T.tagline, alpha: k });
    text(c, 'GESTALT PSYCHOLOGY · 格式塔學派', 966, 986, { ...T.latin, alpha: k2 });
    text(c, 'Made with Mografy', 1824, 1004, { ...T.credit, alpha: fadeIn(t, 74.0, 77.3, .6, .4) * .8 });
  }
}
