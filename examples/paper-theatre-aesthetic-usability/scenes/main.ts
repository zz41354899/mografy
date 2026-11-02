// 美即好用效應｜Aesthetic-Usability Effect — a 74 s, 13-shot stop-motion film in the same desk paper theatre as
// 陰影心理學 and 格式塔心理學, timed to the ElevenLabs narration (assets/narration-aesthetic-usability.mp3, laid 1.2 s late; storyboards/cues.json).
//
// The film's idea: two cardboard ATMs that do exactly the same thing; only their faces differ. Inside the screens is 2D
// (the interface, what we see), outside is 3D (the paper puppet's reactions, the light, the halo). The camera passes
// through a screen into full-frame 2D twice: S03 peels both skins to show one skeleton, S11 lifts the pretty skin to show
// what it hides. In S12 the lamp stands at the viewer's eye, so the pretty skin's shadow covers the wireframe exactly.
//
//  S01 兩台機器        0.0– 4.1  dark; the bulb snaps on; crane down to two dark screens
//  S02 只差一張臉      4.1– 7.0  both screens boot (left harsh, right soft); slide, then push into the right screen
//  S03 同樣的骨架      7.0–13.4  full-frame 2D: a scan line peels both skins → the same wireframe; votes pile up on the right
//  S04 1995 年的 ATM  13.4–23.5  pull out of one of 26 hanging screen cards; the cards drop in; a chalk chart in 2D
//  S05 命名           23.5–26.6  the gold-foil title card is lowered; the ATMs hop back in; it lifts away as the camera
//                                 swings down to the ugly ATM and the ink backdrop fades in
//  S06 醜的出錯       26.6–32.8  ink backstage; the puppet presses, a red error shakes; 2D anger marks
//  S07 美的出錯       32.8–36.3  truck right with the puppet; a soft error, a shrug ("～"), retry, done
//  S08 心情放寬視野    36.3–44.3  side view; the screen's warm light grows; a 2D vision fan opens
//  S09 光環           44.3–49.3  low angle; a gold ring is lowered over the pretty ATM; the camera cranes up and back as
//                                 the ink fades and the lamp swings round
//  S10 光環撐不住      49.3–56.1  the pretty screen crashes; the string snaps, the halo falls; the puppet leaves; push in
//  S11 好看會藏住問題  56.1–61.2  full-frame 2D usability test: ticks, the skin lifts, a red circle
//  S12 兩層對齊        61.2–67.1  two hanging layers; lamp at the eye; orbit out and back until they align
//  S13 片尾           67.1–74.0  pull back out of the proscenium: the whole theatre on a desk; tagline
//
// Motion (param `motion`): 'stop-motion' (default) poses props, the puppet and the lamp on 2s (12 per second) with a
// seeded boil; 'smooth' moves them every frame. The camera, focus, 2D interfaces, type and subtitles are always smooth.
import { at, beats, clamp, ease, lerp, text } from '@mografy/runtime';
import type { FrameContext, SetupContext, TextStyle } from '@mografy/runtime';
import { prepareStage, type Stage, type ThreeModule } from './three.js';
import { bake, buildWorld, loadBaked, storeBaked, makePost, TOP, EYE, FRONT_Z, BACK_Z, BACK_SCALE, SCREEN_W, SCREEN_H, type V3, type World } from './world.js';
import { paintScreen, skin, wire, SK, SANS, SERIF, rng, type ScreenState, type G } from './ui.js';

// ---------------------------------------------------------------- tokens
const C = { cream: '#F3EBDD', amber: '#E8A84A', amberInk: '#A86A1C', ink: '#2C2824', red: '#D2412F', muted: 'rgba(243,235,221,.74)', dim: 'rgba(243,235,221,.55)', bg: '#14110E' };
const T = {
  kicker: { size: 30, family: SANS, weight: 500, color: C.amber, tracking: 10 } as TextStyle,
  sub: { size: 44, family: SANS, weight: 500, color: C.cream, tracking: 2, align: 'center' } as TextStyle,
  tagline: { size: 48, family: SANS, weight: 500, color: C.amber, tracking: 12, align: 'center' } as TextStyle,
  latin: { size: 24, family: SANS, weight: 500, color: C.muted, tracking: 12, align: 'center' } as TextStyle,
  credit: { size: 22, family: SANS, weight: 500, color: C.dim, tracking: 2, align: 'right' } as TextStyle,
};

// ---------------------------------------------------------------- the shot table (times follow the narration)
export const BEATS = beats([
  { title: 'S01 兩台機器', end: 4.1, stop: 3.8, handoff: 1.0, note: 'The bulb snaps on; crane down to two dark screens.' },
  { title: 'S02 只差一張臉', end: 7.0, stop: 6.0, handoff: .6, note: 'Both screens boot; push into the pretty one.' },
  { title: 'S03 同樣的骨架', end: 13.4, stop: 8.9, handoff: .6, note: 'Full-frame 2D: both skins peel to one wireframe.' },
  { title: 'S04 1995 年的 ATM', end: 23.5, stop: 22.9, handoff: 1.0, note: 'Pull out of one of 26 screen cards; a chalk chart.' },
  { title: 'S05 命名', end: 26.6, stop: 25.4, handoff: .8, note: 'The gold title card is lowered.' },
  { title: 'S06 醜的出錯', end: 32.8, stop: 31.6, handoff: 1.0, note: 'A red error shakes; 2D anger marks.' },
  { title: 'S07 美的出錯', end: 36.3, stop: 35.2, handoff: 1.0, note: 'A soft error, a shrug, retry, done.' },
  { title: 'S08 心情放寬視野', end: 44.3, stop: 43.0, handoff: 1.0, note: 'The warm light grows; a 2D vision fan opens.' },
  { title: 'S09 光環', end: 49.3, stop: 47.6, handoff: .8, note: 'A gold ring is lowered over the pretty ATM.' },
  { title: 'S10 光環撐不住', end: 56.1, stop: 54.4, handoff: .6, note: 'Crash; the halo falls; the puppet leaves.' },
  { title: 'S11 好看會藏住問題', end: 61.2, stop: 60.2, handoff: .6, note: 'Full-frame 2D test; the skin lifts.' },
  { title: 'S12 兩層對齊', end: 67.1, stop: 66.5, handoff: 1.0, note: 'Two layers; orbit out and back until they align.' },
  { title: 'S13 片尾', end: 74.0, stop: 72.0, note: 'Pull back: the whole theatre on a desk.' },
]);
export const meta = { width: 1920, height: 1080, duration: BEATS.duration, fps: 30, background: C.bg, shots: BEATS.shots };
export const params = {
  motion: { name: '動態 Motion', type: 'enum' as const, default: 'stop-motion', options: ['stop-motion', 'smooth'] },
};

// narration phrases shown as subtitles (film seconds, from storyboards/cues.json); S05's line is the gold card itself
const SUBS: [number, number, string][] = [
  [1.29, 2.47, '這兩台機器，'], [2.72, 3.68, '功能一模一樣。'],
  [4.25, 5.37, '唯一的差別是：'], [5.70, 6.55, '一台比較好看。'],
  [7.30, 9.16, '同樣的按鈕，同樣的步驟，'], [9.66, 10.97, '可是大多數人會說，'], [11.28, 12.74, '右邊那台比較好用。'],
  [13.84, 14.72, '1995 年，'], [14.96, 19.48, '日立的研究者請 252 個人評比 26 種 ATM 畫面。'],
  [20.14, 21.58, '結果，看起來越美，'], [21.89, 23.18, '大家就越覺得好用。'],
  [27.06, 28.77, '更有趣的是出錯的時候。'], [29.45, 32.48, '同一個小錯誤，在醜的介面上讓人火大；'],
  [33.08, 35.76, '在好看的介面上，人卻比較願意原諒。'],
  [36.54, 37.24, '諾曼說，'], [37.57, 39.62, '好看的東西讓人心情變好；'], [40.12, 43.79, '心情好，就更有耐心，也更願意自己找出解法。'],
  [44.69, 46.42, '第一眼的好感就像光環，'], [46.78, 48.42, '會一路影響後面的判斷。'],
  [49.91, 51.69, '但光環只撐得住小問題。'], [52.57, 53.40, '真的不好用，'], [53.76, 55.52, '再好看，人也會離開。'],
  [56.41, 57.85, '好看還有一個副作用：'], [58.40, 60.59, '它會讓測試的人，看不見問題。'],
  [61.57, 64.05, '所以，美不是用來遮住問題，'], [64.39, 66.62, '而是讓人願意，多給一次機會。'],
];
const TAG: [number, string][] = [[67.45, '好看讓人留步，'], [69.13, '好用讓人留下。']];
// kickers on 3D shots (the 2D shots draw their own, in dark amber on paper)
const KICKERS: [number, number, string][] = [
  [4.4, 6.5, 'SAME FUNCTION · 同樣的功能'], [13.9, 23.2, 'KUROSU & KASHIMURA · 1995'], [27.2, 36.0, 'SAME ERROR · 同一個小錯誤'],
  [36.6, 43.9, 'D. NORMAN · EMOTIONAL DESIGN'], [44.7, 48.6, 'HALO · 光環'], [49.8, 55.4, 'LIMIT · 光環的極限'], [61.8, 66.6, 'SKIN & SKELETON · 皮與骨架'],
];
// No blackouts between the acts: a lamp-off cut left the self-lit screens and the halo floating and jumping in the
// dark. Both act changes are camera moves now, with the lamp, the ink backdrop and the screen glow changing during them.
const DARK: [number, number][] = [];
/** The ink backdrop of Act II (S06–S09), faded in and out during the two act-change camera moves. */
const inkAt = (t: number) => sm(t, 26.35, .7) * (1 - sm(t, 48.95, .7));
const IN2D: [number, number][] = [[7.0, 13.4], [56.1, 61.2]];

// ---------------------------------------------------------------- time
const FPS_ANIM = 12;
let STOP = false;
/** Pose time: on 2s in stop-motion, the real time otherwise. */
const step = (t: number) => STOP ? Math.floor(t * FPS_ANIM + 1e-6) / FPS_ANIM : t;
const io = ease.inOutCubic, out = ease.outCubic, inQ = ease.inQuad, inC = ease.inCubic;
const mix3 = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
/** 0 → 1 over [a, a + d] on the pose clock. */
const ramp = (t: number, a: number, d: number, curve = io) => curve(clamp((step(t) - a) / d));
/** 0 → 1 over [a, a + d] on the smooth clock. */
const sm = (t: number, a: number, d: number, curve = io) => curve(clamp((t - a) / d));

// ---------------------------------------------------------------- the lamp
interface Lamp { p: V3; k: number; power: number; desk: boolean }
const LA: V3 = [-4.6, 4.4, 5.3], L04: V3 = [-4.4, 5.2, 5.6], L05: V3 = [-3.8, 5.6, 6.2], L06: V3 = [-5.0, 4.8, 5.8], L09: V3 = [-1.4, 6.3, 6.0], L10: V3 = [-4.4, 4.6, 5.4];
const LEYE: V3 = [EYE[0], EYE[1], EYE[2] + .3];
function lampAt(t: number): Lamp {
  let p = LA, power = 60, desk = false;
  if (t < 13.4) { power = t < 4.6 ? 60 : lerp(60, 42, sm(t, 4.6, .6)); }
  else if (t < 23.5) { p = L04; power = 60; }
  else if (t < 26.3) { p = mix3(L04, L05, ramp(t, 23.5, .7)); power = 60; }
  else if (t < 36.3) { const k = ramp(t, 26.3, .8); p = mix3(L05, L06, k); power = lerp(60, 33, k); }
  else if (t < 44.3) { p = L06; power = lerp(33, 17, sm(t, 37.6, 2.5)); }
  else if (t < 49.0) { p = mix3(L06, L09, ramp(t, 44.3, 1.0)); power = lerp(17, 45, ramp(t, 44.3, 1.0)); }
  else if (t < 61.2) { const k = ramp(t, 49.0, .8); p = mix3(L09, L10, k); power = lerp(45, 63, k); }
  else { p = LEYE; power = 96; desk = true; }
  let k = t < .8 ? 0 : 1;
  for (const [a, b] of DARK) if (t >= a && t < b) k = 0;
  return { p, k, power, desk };
}

// ---------------------------------------------------------------- the camera
interface Pose { p: V3; q: V3; f: number }
const SCR_C: V3 = [2.5, 2.6, 2.585], SCR_N: V3 = [0, Math.sin(.2), Math.cos(.2)];
const cIn: Pose = { p: [SCR_C[0], SCR_C[1] + SCR_N[1] * 1.15, SCR_C[2] + SCR_N[2] * 1.15], q: SCR_C, f: 40 };
const T12: V3 = [0, 3.5, 2.6], D12 = Math.hypot(EYE[0] - T12[0], EYE[1] - T12[1], EYE[2] - T12[2]);
const orbit12 = (yaw: number): Pose => ({ p: [T12[0] + D12 * Math.sin(yaw), EYE[1], T12[2] + D12 * Math.cos(yaw)], q: T12, f: 36 });
const P: Record<string, Pose> = {
  c01a: { p: [0, 8.6, 12.6], q: [0, 2.0, 2.0], f: 40 },
  c01: { p: [0, 5.4, 12.6], q: [0, 2.6, 2.0], f: 40 },
  c02: { p: [.4, 3.4, 11.4], q: [.2, 2.6, 2.4], f: 37 },
  c04a: { p: [0, 6.35, 1.66], q: [0, 6.35, 1.1], f: 40 },
  c04: { p: [0, 3.0, 11.0], q: [0, 4.6, 1.2], f: 44 },
  c05: { p: [0, 4.0, 11.6], q: [0, 3.9, 3.5], f: 34 },
  c05b: { p: [0, 4.0, 11.6], q: [0, 3.95, 3.5], f: 32.4 },
  c06: { p: [-.55, 2.95, 9.0], q: [-2.25, 2.55, 2.6], f: 34 },
  c06b: { p: [-.8, 2.9, 8.3], q: [-2.3, 2.55, 2.6], f: 34 },
  c07: { p: [.55, 2.95, 9.0], q: [2.25, 2.55, 2.6], f: 34 },
  c08: { p: [5.6, 2.7, 6.2], q: [2.0, 2.15, 3.6], f: 42 },
  c08b: { p: [5.3, 2.95, 7.4], q: [2.0, 2.2, 3.8], f: 42 },
  c09: { p: [1.7, .95, 8.6], q: [2.5, 3.85, 2.6], f: 44 },
  c10a: { p: [1.0, 3.6, 11.0], q: [2.0, 2.9, 3.0], f: 38 },
  c10: { p: [1.0, 3.6, 11.0], q: [1.8, 1.5, 3.2], f: 38 },
  c12in: { p: [0, EYE[1], FRONT_Z + 1.9], q: [0, EYE[1], FRONT_Z], f: 40 },
  c12: orbit12(0),
  c13: { p: [0, 9.5, 31], q: [0, 3.6, 3.5], f: 30 },
};
const blend = (a: Pose, b: Pose, k: number): Pose => ({ p: mix3(a.p, b.p, k), q: mix3(a.q, b.q, k), f: lerp(a.f, b.f, k) });
const move = (t: number, t0: number, t1: number, a: Pose, b: Pose, curve = io) => blend(a, b, curve(clamp((t - t0) / (t1 - t0))));
function bez3(a: V3, b: V3, c: V3, d: V3, u: number): V3 { const f = (i: 0 | 1 | 2) => (1 - u) ** 3 * a[i] + 3 * (1 - u) ** 2 * u * b[i] + 3 * (1 - u) * u * u * c[i] + u ** 3 * d[i]; return [f(0), f(1), f(2)]; }

function camera(t: number): Pose {
  if (t < 4.1) return move(t, .5, 3.9, P.c01a!, P.c01!, ease.inOutQuart);
  if (t < 7.0) return t < 6.3 ? move(t, 4.1, 5.7, P.c01!, P.c02!) : move(t, 6.3, 7.0, P.c02!, cIn, inC);
  if (t < 13.4) return cIn;
  if (t < 23.5) return move(t, 14.0, 16.6, P.c04a!, P.c04!, ease.inOutCubic);
  if (t < 26.2) return t < 24.6 ? move(t, 23.5, 24.6, P.c04!, P.c05!) : move(t, 24.6, 26.2, P.c05!, P.c05b!, ease.inOutSine);
  if (t < 27.1) return move(t, 26.2, 27.1, P.c05b!, P.c06!);   // S05 → S06: swing down to the ugly ATM
  if (t < 32.8) return move(t, 27.1, 32.6, P.c06!, P.c06b!, ease.inOutSine);
  if (t < 36.3) return move(t, 32.8, 33.75, P.c06b!, P.c07!);
  if (t < 44.3) return t < 37.4 ? move(t, 36.3, 37.4, P.c07!, P.c08!) : move(t, 37.4, 44.3, P.c08!, P.c08b!, ease.inOutSine);
  if (t < 48.9) return move(t, 44.3, 45.5, P.c08b!, P.c09!);
  if (t < 49.8) return move(t, 48.9, 49.8, P.c09!, P.c10a!);   // S09 → S10: crane up and back, the halo stays in frame
  if (t < 56.1) return t < 55.5 ? move(t, 51.1, 51.9, P.c10a!, P.c10!) : move(t, 55.5, 56.1, P.c10!, cIn, inC);
  if (t < 61.2) return cIn;
  if (t < 67.1) {
    if (t < 62.8) return move(t, 61.2, 62.4, P.c12in!, P.c12!, ease.outQuart);
    if (t < 64.6) return orbit12(.42 * sm(t, 62.8, 1.5));
    return orbit12(.42 * (1 - sm(t, 64.6, 1.6)));
  }
  const u = io(clamp((t - 67.1) / 4.7));
  return { p: bez3(P.c12!.p, [0, 5.6, 12.6], [0, 8.4, 21], P.c13!.p, u), q: mix3(P.c12!.q, P.c13!.q, u), f: lerp(P.c12!.f, P.c13!.f, u) };
}

/** Focus, with every shot change blended over 0.6 s so the depth of field never pops. */
const FOCUS_CUTS = [4.1, 13.4, 23.5, 26.6, 32.8, 36.3, 44.3, 51.1, 55.5, 61.2, 67.1];
function focus(t: number): { at: V3; ap: number } {
  for (const b of FOCUS_CUTS) if (t >= b && t < b + .6) {
    const a = focusRaw(b - 1e-3), c = focusRaw(t), u = io((t - b) / .6);
    return { at: mix3(a.at, c.at, u), ap: lerp(a.ap, c.ap, u) };
  }
  return focusRaw(t);
}
function focusRaw(t: number): { at: V3; ap: number } {
  if (t < 4.1) return { at: [0, 2.6, 2.6], ap: 8 };
  if (t < 7.0) return t < 6.3 ? { at: [.6, 2.6, 2.6], ap: 10 } : { at: SCR_C, ap: 6 };
  if (t < 23.5) return { at: [0, 5.9, 1.2], ap: t < 16.6 ? lerp(4, 12, sm(t, 14.0, 2.6)) : 12 };
  if (t < 26.6) return { at: [0, 4.55, 4.3], ap: 14 };
  if (t < 32.8) return { at: [-2.5, 2.6, 2.6], ap: 12 };
  if (t < 36.3) return { at: [2.5, 2.6, 2.6], ap: 12 };
  if (t < 44.3) return { at: [1.9, 2.2, 4.9], ap: 14 };
  if (t < 51.1) return { at: [2.5, 4.4, 2.75], ap: 12 };
  if (t < 55.5) return { at: [2.2, 1.8, 3.4], ap: 8 };
  if (t < 61.2) return { at: SCR_C, ap: 6 };
  if (t < 67.1) return { at: [0, EYE[1], FRONT_Z], ap: 10 };
  return { at: mix3([0, EYE[1], FRONT_Z], [0, 4.5, 6.5], io(clamp((t - 67.1) / 4.7))), ap: lerp(10, 5, clamp((t - 67.1) / 4.7)) };
}

// ---------------------------------------------------------------- the screens
const shakeAt = (t: number, t0: number, d = .6, amp = 14) => { const u = (t - t0) / d; if (u < 0 || u > 1) return 0; return (Math.floor(t * 24) % 2 ? 1 : -1) * amp * (1 - u); };
function screenL(t: number): ScreenState {
  if (t < 4.25) return { mode: 'off', k: 0, t };
  if (t < 4.6) return { mode: 'boot', k: (t - 4.25) / .35, t };
  if (t >= 29.75 && t < 32.9) return { mode: 'error', k: (t - 29.75) / .25, t, shake: shakeAt(t, 29.75) };
  return { mode: 'home', k: 1, t };
}
function screenR(t: number): ScreenState {
  if (t < 4.6) return { mode: 'off', k: 0, t };
  if (t < 5.3) return { mode: 'boot', k: (t - 4.6) / .7, t };
  if (t >= 34.3 && t < 35.55) return { mode: 'error', k: (t - 34.3) / .4, t };
  if (t >= 35.55 && t < 44.3) return { mode: 'ok', k: (t - 35.55) / .6, t };
  if (t >= 50.1 && t < 61.2) return { mode: 'crash', k: (t - 50.1) / .5, t };
  return { mode: 'home', k: 1, t };
}
/** What a screen shows, as a key: equal keys draw identical pixels, so the texture is only re-uploaded when it changes. */
function screenKey(s: ScreenState) {
  const k = Math.min(1, Math.max(0, s.k));
  if (s.mode === 'off' || s.mode === 'home') return s.mode;
  if (s.mode === 'crash') return `crash|${Math.round(k * 12)}|${Math.floor(s.t * 12 + 1e-6)}`;
  return `${s.mode}|${Math.round(k * 60)}|${Math.round(s.shake ?? 0)}`;
}
const GLOW_L = 0x7FB0FF, GLOW_R = 0xFFE2BC;
/** Screen glow; at the two act changes the intensities blend over the camera move instead of switching. */
function glow(t: number): { l: [number, number]; r: [number, number] } {
  for (const b of [26.6, 49.3]) if (t >= b - .3 && t < b + .4) {
    const a = glowRaw(b - .3 - 1e-3), c = glowRaw(b + .4), u = io((t - b + .3) / .7);
    return { l: [c.l[0], lerp(a.l[1], c.l[1], u)], r: [c.r[0], lerp(a.r[1], c.r[1], u)] };
  }
  return glowRaw(t);
}
function glowRaw(t: number): { l: [number, number]; r: [number, number] } {
  if (t < 4.25) return { l: [GLOW_L, 0], r: [GLOW_R, 0] };
  if (t < 13.4) return { l: [GLOW_L, 3], r: [GLOW_R, t < 4.6 ? 0 : 3] };
  if (t < 26.6) return { l: [GLOW_L, 1.2], r: [GLOW_R, 1.2] };
  if (t < 32.8) return { l: t >= 29.75 ? [0xFF4A3A, 4.5] : [GLOW_L, 2], r: [GLOW_R, .8] };
  if (t < 36.3) return { l: [GLOW_L, .8], r: [0xFFD9A0, 3.2] };
  if (t < 44.3) return { l: [GLOW_L, .6], r: [0xFFD49A, lerp(3.2, 7.5, sm(t, 37.6, 2.5))] };
  if (t < 49.3) return { l: [GLOW_L, .6], r: [GLOW_R, 3] };
  if (t < 61.2) return { l: [GLOW_L, 1.2], r: t >= 50.1 ? [0x9FB4C8, 1.6] : [GLOW_R, 2.2] };
  return { l: [GLOW_L, 2.2], r: [GLOW_R, 2.2] };
}

// ---------------------------------------------------------------- the puppet
interface Puppet { on: boolean; x: number; z: number; y: number; ry: number; tilt: number; arm: number }
/** Walk on 2s: position eases between a and b, and the body hops once per pose pair. */
function walk(t: number, t0: number, d: number, a: [number, number], b: [number, number]) {
  const u = ramp(t, t0, d, ease.inOutSine), hop = step(t) >= t0 && step(t) < t0 + d ? Math.abs(Math.sin((step(t) - t0) * Math.PI * 6)) * .09 : 0;
  return { x: lerp(a[0], b[0], u), z: lerp(a[1], b[1], u), y: hop };
}
function puppetAt(t: number): Puppet {
  const off: Puppet = { on: false, x: 0, z: 0, y: 0, ry: 0, tilt: 0, arm: 0 };
  if (t < 26.6 || (t >= 56.1 && t < 61.9)) return off;
  const ts = step(t);
  if (t < 32.8) {   // S06: walks in, presses, stomps
    const w = walk(t, 26.95, 1.65, [-6.5, 4.6], [-2.55, 4.25]);   // from behind the side wall
    const stomp = [30.9, 31.4].some(s => ts >= s && ts < s + 2 / 12) ? .1 : 0;
    return { on: true, ...w, y: w.y + stomp, ry: 0, tilt: 0, arm: 2.35 * ramp(t, 29.25, .3, ease.linear) };
  }
  if (t < 36.3) {   // S07: crosses, presses, shrugs, retries
    const w = walk(t, 32.85, .85, [-2.55, 4.25], [2.55, 4.25]);
    const press = (a: number) => ts >= a && ts < a + .25;
    const arm = press(33.9) || press(35.3) ? 2.35 : ts >= 33.9 ? .35 : 0;
    const tilt = ts >= 34.6 && ts < 35.2 ? (Math.floor(ts * 6) % 2 ? .06 : -.06) : 0;
    return { on: true, ...w, ry: 0, tilt, arm };
  }
  if (t < 44.3) {   // S08: turns to face the warm screen
    const u = ramp(t, 36.35, .35, ease.linear);
    return { on: true, x: lerp(2.55, 1.9, u), z: lerp(4.25, 4.9, u), y: 0, ry: lerp(0, Math.PI - 1.1, u), tilt: 0, arm: .2 };
  }
  if (t < 49.3) {   // S09: steps aside for the halo
    const u = ramp(t, 44.4, .6, ease.linear);
    return { on: true, x: lerp(1.9, 3.6, u), z: lerp(4.9, 4.6, u), y: u > 0 && u < 1 ? .06 : 0, ry: lerp(Math.PI - 1.1, 0, u), tilt: 0, arm: .2 };
  }
  if (t < 56.1) {   // S10: waits, turns away, leaves
    const turn = ramp(t, 52.6, .25, ease.linear), w = walk(t, 53.8, 1.6, [3.6, 4.6], [5.5, 6.5]);
    return { on: true, x: w.x, z: w.z, y: w.y, ry: -.75 * turn, tilt: ts >= 53.8 && ts < 55.4 ? -.06 : 0, arm: -.3 };
  }
  // S12–S13: comes back, reaches for the sheet when the layers align
  const w = walk(t, 61.9, 1.1, [5.4, 3.8], [2.1, 2.9]);
  return { on: true, ...w, ry: 0, tilt: 0, arm: -1.35 * ramp(t, 65.4, .3, ease.linear) };
}

// ---------------------------------------------------------------- the halo
interface Halo { on: boolean; p: V3; rx: number; rz: number; hung: boolean; stub: boolean }
function haloAt(t: number): Halo {
  if (t < 44.6) return { on: false, p: [0, 0, 0], rx: 0, rz: 0, hung: false, stub: false };
  const ts = step(t), HANG: V3 = [2.5, 4.5, 2.75];
  if (t < 51.1) {
    const y = lerp(9.2, HANG[1], ramp(t, 44.6, 1.8, out));
    const sw = ts >= 46.4 && ts < 47.3 ? .09 * Math.cos((ts - 46.4) * 12 * Math.PI / 2.5) * (1 - (ts - 46.4) / .9) : 0;
    return { on: true, p: [HANG[0], y, HANG[2]], rx: 1.25, rz: sw, hung: true, stub: false };
  }
  // the string snaps: fall, two bounces, roll to rest
  const LAND1: V3 = [1.9, .06, 3.95], LAND2: V3 = [1.25, .06, 4.3], REST: V3 = [.6, .06, 4.6];
  if (ts < 51.45) { const u = ramp(t, 51.1, .35, inQ); return { on: true, p: mix3(HANG, LAND1, u), rx: lerp(1.25, Math.PI / 2 + .04, u), rz: .3 * u, hung: false, stub: false }; }
  if (ts < 51.75) { const u = (ts - 51.45) / .3, p = mix3(LAND1, LAND2, u); p[1] += Math.sin(u * Math.PI) * .32; return { on: true, p, rx: Math.PI / 2 + .04 - .12 * Math.sin(u * Math.PI), rz: .3 + .2 * u, hung: false, stub: true }; }
  if (ts < 51.92) { const u = (ts - 51.75) / .17, p = mix3(LAND2, REST, u * .6); p[1] += Math.sin(u * Math.PI) * .1; return { on: true, p, rx: Math.PI / 2 + .04, rz: .5, hung: false, stub: true }; }
  const u = ramp(t, 51.92, .3, out);
  return { on: true, p: mix3(mix3(LAND2, REST, .6), REST, u), rx: Math.PI / 2 + .04, rz: .5 + .3 * u, hung: false, stub: true };
}

// ---------------------------------------------------------------- posing the world
interface Film { stage: Stage<World>; post: ReturnType<typeof makePost> }
const hash = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
/** Stretch a string from an anchor up to the rigging bar. */
function str(s: ThreeModule, a: V3) {
  const h = TOP - a[1]; s.visible = h > .02; if (!s.visible) return;
  s.scale.y = h; s.rotation.set(0, 0, 0); s.position.set(a[0], a[1] + h / 2, a[2] + .011);
}
const CARD_ORDER = (() => { const ids = [...Array(26).keys()].filter(i => i !== 6); ids.sort((a, b) => (Math.abs(a % 13 - 6) + (a >= 13 ? .5 : 0)) - (Math.abs(b % 13 - 6) + (b >= 13 ? .5 : 0)) || a - b); const r = new Array(26).fill(-1); ids.forEach((id, k) => (r[id] = k)); return r as number[]; })();

function pose(ctx: FrameContext, W: World, t: number, cp: Pose, cam: ThreeModule) {
  const ts = step(t), n = STOP ? Math.floor(t * FPS_ANIM + 1e-6) : Math.floor(t * 30);
  const boil = (k: number, amt: number) => (ctx.noise(n, k) - .5) * 2 * amt;
  const ink = inkAt(t);
  W.ink.visible = ink > 0;
  if (ink > 0) W.ink.children.forEach((m: ThreeModule) => { m.material.opacity = ink; });
  const finale = t >= 67.1;
  W.pro.visible = W.title.visible = W.deskProps.visible = finale;

  // lights
  const L = lampAt(t), flick = STOP ? 1 + boil(91, .03) : 1 + .012 * Math.sin(t * 7.3), lamp = W.lamp;
  const gy = L.desk ? -.34 : 0, h = L.p[1] - gy - .3;
  lamp.g.position.set(L.p[0], gy, L.p[2]); lamp.rod.scale.y = h; lamp.rod.position.y = h / 2 + .07; lamp.sock.position.y = L.p[1] - gy - .22;
  lamp.bulb.position.y = L.p[1] - gy; lamp.light.position.y = L.p[1] - gy;
  lamp.light.intensity = L.power * L.k * flick;   // never toggle a light's visibility: the light count changing recompiles every material
  lamp.bulbMat.emissiveIntensity = L.k > 0 ? 9 * flick : .05; lamp.bulbMat.color.set(L.k > 0 ? 0xffe9c8 : 0xb8b0a2);
  const dark = t < .8 || DARK.some(([a, b]) => t >= a && t < b);
  W.hemi.intensity = dark ? 0 : finale ? .3 : lerp(.3, .13, ink);
  W.fill.intensity = t < .8 ? .45 : dark ? 0 : finale ? .3 : lerp(.14, .05, ink);
  W.room.intensity = finale ? 1.3 * sm(t, 67.6, 2.0) : 0; W.room.shadow.autoUpdate = finale;   // its shadow map renders only in the finale

  // the ATMs: offstage during S04, hop back in at the start of S05, wider apart from S11 on
  // (offstage = outside the box, still in the scene, so their glow lights keep the light count constant)
  let ax = 2.5, aOn = true, ay = 0;
  if (t >= 13.4 && t < 23.5) { aOn = false; ax = 9.5; }
  else if (t >= 23.5 && t < 24.3) { const u = ramp(t, 23.55, .6, ease.inOutSine); ax = lerp(7.4, 2.5, u); ay = u > 0 && u < 1 ? Math.abs(Math.sin(u * Math.PI * 3)) * .12 : 0; }
  else if (t >= 56.1) ax = 4.2;
  W.atmL.g.position.set(-ax, ay, 2.5); W.atmR.g.position.set(ax, ay, 2.5);
  const gl = glow(t);
  for (const [atm, s, gg] of [[W.atmL, screenL(t), gl.l], [W.atmR, screenR(t), gl.r]] as const) {
    atm.glow.color.set(gg[0]); atm.glow.intensity = dark || !aOn ? 0 : gg[1];
    if (!aOn) continue;
    // repaint and re-upload only when the picture changes (a held screen costs nothing)
    const key = screenKey(s);
    if (atm.painted !== key) { paintScreen(atm.c2d, SCREEN_W, SCREEN_H, atm.kind, s); atm.map.needsUpdate = true; atm.painted = key; }
  }

  // the puppet
  const pp = puppetAt(t), PU = W.puppet;
  PU.g.visible = pp.on;
  if (pp.on) {
    PU.g.position.set(pp.x + boil(301, .01), pp.y, pp.z); PU.g.rotation.set(0, pp.ry + boil(302, .015), 0);
    PU.bodyG.rotation.set(0, 0, pp.tilt + boil(303, .012)); PU.arm.rotation.set(0, 0, pp.arm + boil(304, .03));
  }

  // S04: the 26 screen cards (card 6 is already there: the camera pulls out of it)
  const cardsOn = t >= 13.4 && t < 23.7;
  W.cards.forEach((c: World) => {
    c.m.visible = c.s.visible = cardsOn; if (!cardsOn) return;
    const t0 = c.i === 6 ? -1 : 14.96 + CARD_ORDER[c.i]! * .165;
    const dy = c.i === 6 ? 0 : 3.2 * (1 - ramp(t, t0, .25, out));
    const up = 6 * ramp(t, 23.05 + (c.i % 13) * .012, .4, inQ);
    const vis = c.i === 6 || ts >= t0;
    c.m.visible = c.s.visible = vis; if (!vis) return;
    const y = c.y + dy + up;
    c.m.position.set(c.x + boil(400 + c.i, .004), y, c.z); c.m.rotation.set(c.rot[0], c.rot[1] + boil(430 + c.i, .02), c.rot[2]);
    str(c.s, [c.x, y + .25, c.z]);
  });

  // S05: the gold title card
  const tcOn = t >= 23.6 && t < 26.6;
  W.titleCard.visible = tcOn; W.titleStr.forEach((s: ThreeModule) => (s.visible = tcOn));
  if (tcOn) {
    const y = lerp(9.5, 4.55, ramp(t, 23.7, .6, out)) + (ts >= 24.3 && ts < 24.55 ? .04 * Math.sin((ts - 24.3) * 30) : 0) + 7 * ramp(t, 26.05, .45, inQ);
    W.titleCard.position.set(boil(450, .004), y, 4.3); W.titleCard.rotation.set(0, -.04 + boil(451, .01), .012);
    W.titleStr.forEach((s: ThreeModule, i: number) => str(s, [i ? 1.9 : -1.9, y + .78, 4.3]));
  }

  // S09–S13: the halo
  const H = haloAt(t);
  W.halo.visible = H.on; W.haloStub.visible = H.on && H.stub; W.haloStr.forEach((s: ThreeModule) => (s.visible = H.on && H.hung));
  if (H.on) {
    W.halo.position.set(...H.p); W.halo.rotation.set(H.rx, 0, H.rz);
    if (H.hung) [0, 2.1, 4.2].forEach((a, i) => str(W.haloStr[i], [H.p[0] + Math.cos(a) * .78, H.p[1] + Math.sin(a) * .78 * Math.cos(H.rx), H.p[2] + Math.sin(a) * .78 * Math.sin(H.rx)]));
    if (H.stub) { const s = W.haloStub; s.scale.y = .9; s.rotation.set(0, .5, Math.PI / 2 - .15); s.position.set(1.55, .03, 3.7); }
  }

  // S12–S13: the two hanging layers, aligned only from the eye
  const lyOn = t >= 61.0;
  W.sheetFront.visible = W.sheetBack.visible = lyOn; W.sheetStr.forEach((s: ThreeModule) => (s.visible = lyOn));
  if (lyOn) {
    W.sheetFront.position.set(boil(470, .003), EYE[1], FRONT_Z); W.sheetBack.position.set(0, EYE[1], BACK_Z);
    W.sheetFront.rotation.set(0, boil(471, .006), 0);
    const hf = .79, hb = .79 * BACK_SCALE;
    str(W.sheetStr[0], [-1.1, EYE[1] + hf, FRONT_Z]); str(W.sheetStr[1], [1.1, EYE[1] + hf, FRONT_Z]);
    str(W.sheetStr[2], [-1.1 * BACK_SCALE, EYE[1] + hb, BACK_Z]); str(W.sheetStr[3], [1.1 * BACK_SCALE, EYE[1] + hb, BACK_Z]);
  }

  cam.fov = cp.f; cam.position.set(...cp.p); cam.up.set(0, 1, 0); cam.lookAt(...cp.q);
  void hash;
}

// ---------------------------------------------------------------- setup and frame
export async function setup(ctx: SetupContext) {
  await loadBaked();   // textures drawn by an earlier open (see world.ts)
  for (const k of ['ugly', 'pretty', 'wire', 'flaws', 'off'] as const) { skin(k, SCREEN_W, SCREEN_H); }
  skin('ugly', 800, 526); skin('pretty', 800, 526); skin('pretty', 860, 565); skin('flaws', 860, 565);
  PANEL_WIRE[0] = wireCanvas(800, 526, 5); PANEL_WIRE[1] = wireCanvas(800, 526, 6);
  PAPER[0] = paperBG('#E9E0D0', 2); PAPER[1] = paperBG('#E6DCCB', 6);
  const stage = await prepareStage(ctx, async b => {
    b.renderer.shadowMap.enabled = true; b.renderer.shadowMap.type = b.THREE.PCFShadowMap;
    b.renderer.outputColorSpace = b.THREE.LinearSRGBColorSpace; b.renderer.toneMapping = b.THREE.NoToneMapping;
    b.scene.background = new b.THREE.Color(0x14110e);
    b.camera.near = .1; b.camera.far = 200;
    const world = buildWorld(b.THREE, b.scene, b.renderer);
    // the ink backdrop fades in and out (inkAt): its own transparent material copies, set before the shaders compile
    world.ink.children.forEach((m: ThreeModule) => { m.material = m.material.clone(); m.material.transparent = true; });
    // compile every shader in parallel before the first render (KHR_parallel_shader_compile), so opening the
    // project does not block the player while dozens of programs link one after another
    await b.renderer.compileAsync?.(b.scene, b.camera);
    return world;
  }, { fov: 40, toneMapping: 'none' });
  const post = makePost(stage.THREE, stage.renderer, ctx.width, ctx.height);
  stage.renderer.setRenderTarget(post.rt); stage.renderer.render(stage.scene, stage.camera); stage.renderer.setRenderTarget(null);
  ctx.assets.film = { stage, post } satisfies Film;
  storeBaked();
}

function project(W: World, cam: ThreeModule, p: V3): [number, number, boolean] {
  const v = W.v.set(p[0], p[1], p[2]).project(cam);
  return [(v.x + 1) / 2 * 1920, (1 - v.y) / 2 * 1080, v.z < 1];
}

export function renderFrame(ctx: FrameContext, time: number, p: { motion?: string } = {}) {
  STOP = p.motion !== 'smooth';
  const { stage, post } = ctx.assets.film as Film, W = stage.objects, cam = stage.camera, t = time;
  const full2D = IN2D.some(([a, b]) => t >= a && t < b);
  if (!full2D) {
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
    post.mat.uniforms.exposure.value = t >= 36.3 && t < 44.3 ? lerp(1, 1.12, sm(t, 37.6, 2.5)) : 1;
    post.render(stage.scene, cam);
    ctx.withCanvas(c => { c.imageSmoothingQuality = 'high'; c.drawImage(stage.surface, 0, 0, ctx.width, ctx.height); });
  }
  ctx.withCanvas(c => {
    if (full2D) { if (t < 13.4) fullS03(c, t); else fullS11(c, t); }
    else {
      const L = lampAt(t), [x, y, front] = project(W, cam, L.p);
      if (L.k > 0 && front) {
        const R = 260; c.globalCompositeOperation = 'screen';
        const g = c.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, 'rgba(255,190,100,.5)'); g.addColorStop(.25, 'rgba(255,160,70,.18)'); g.addColorStop(1, 'rgba(255,140,60,0)');
        c.fillStyle = g; c.fillRect(x - R, y - R, 2 * R, 2 * R); c.globalCompositeOperation = 'source-over';
      }
      marks(c, t, (q: V3) => project(W, cam, q));
    }
    overlay(c, t);
  });
}

// ---------------------------------------------------------------- 2D: hand-drawn marks over the 3D world (boil on 2s)
const frame12 = (t: number) => Math.floor(t * 12 + 1e-6);
function brush(g: G, pts: [number, number][], o: { color?: string; width?: number; seed?: number; jitter?: number; passes?: number; alpha?: number } = {}) {
  const r = rng(o.seed ?? 1), j = o.jitter ?? 2;
  g.save(); g.strokeStyle = o.color ?? C.ink; g.lineWidth = o.width ?? 6; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let pass = 0; pass < (o.passes ?? 2); pass++) {
    g.globalAlpha = (o.alpha ?? 1) * (pass ? .55 : 1); g.beginPath();
    pts.forEach(([x, y], i) => { const px = x + (r() - .5) * j, py = y + (r() - .5) * j; if (i) g.lineTo(px, py); else g.moveTo(px, py); });
    g.stroke();
  }
  g.restore();
}
const arcPts = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): [number, number][] => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
const partial = (pts: [number, number][], k: number) => pts.slice(0, Math.max(2, Math.ceil(pts.length * clamp(k))));

function anger(g: G, x: number, y: number, s: number, seed: number, alpha: number) {
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4, cx = x + Math.cos(a) * 38 * s, cy = y + Math.sin(a) * 38 * s;
    const pts = arcPts(cx, cy, 26 * s, 26 * s, a + Math.PI - 1.05, a + Math.PI + 1.05, 10);
    brush(g, pts, { color: C.cream, width: 18 * s, seed: seed + k, jitter: 1, passes: 1, alpha });
    brush(g, pts, { color: C.red, width: 10 * s, seed: seed + 10 + k, jitter: 2, alpha });
  }
}
function scribble(g: G, x: number, y: number, s: number, seed: number, alpha: number) {
  const r = rng(seed), pts: [number, number][] = [];
  for (let i = 0; i < 70; i++) { const a = i * .55, R = (30 + r() * 22) * s; pts.push([x + Math.cos(a) * R * 1.5 + i * .4 * s - 14 * s, y + Math.sin(a) * R * .8]); }
  brush(g, pts, { color: '#EFE4CF', width: 4.5 * s, seed, jitter: 2, passes: 1, alpha });
}
function tilde(g: G, x: number, y: number, s: number, seed: number, k: number) {
  const pts = Array.from({ length: 30 }, (_, i) => [x - 50 * s + i * 100 * s / 29, y + Math.sin(i / 29 * Math.PI * 2) * 14 * s] as [number, number]);
  brush(g, partial(pts, k), { color: C.amber, width: 9 * s, seed, jitter: 1.4 });
}
function sparkle(g: G, x: number, y: number, s: number, seed: number) {
  brush(g, [[x, y - 22 * s], [x, y + 22 * s]], { color: C.amber, width: 5 * s, seed, jitter: .8, passes: 1 });
  brush(g, [[x - 22 * s, y], [x + 22 * s, y]], { color: C.amber, width: 5 * s, seed: seed + 1, jitter: .8, passes: 1 });
}

function marks(c: G, t: number, P: (q: V3) => [number, number, boolean]) {
  const f = frame12(t);
  if (t >= 30.0 && t < 32.75) {   // S06: anger and a tangle above the puppet
    const pp = puppetAt(t), [x, y] = P([pp.x, 2.2, pp.z + .02]), pop = [.6, 1.15, 1][Math.min(2, Math.floor((t - 30.0) * 12))]!;
    const a = 1 - sm(t, 32.5, .25, ease.linear);
    anger(c, x - 250, y - 70, 1.1 * pop, 100 + f * 3, a);
    if (t >= 30.4) scribble(c, x - 270, y + 90, .8, 200 + f * 5, a);
  }
  if (t >= 34.6 && t < 36.2) {   // S07: a small "～" and two sparks
    const pp = puppetAt(t), [x, y] = P([pp.x, 2.2, pp.z + .02]);
    tilde(c, x + 250, y - 40, 1.1, 300 + f * 3, sm(t, 34.6, .3, ease.linear));
    if (t >= 34.9) { sparkle(c, x + 380, y - 120, .9, 330 + f); sparkle(c, x + 230, y + 90, .6, 360 + f); }
  }
  if (t >= 40.1 && t < 44.3) {   // S08: a chalk vision fan from the puppet toward the warm screen
    const [x, y] = P([1.9, 2.18, 4.92]), [sx, sy] = P([2.5, 2.6, 2.7]), a = Math.atan2(sy - y, sx - x);
    const k = sm(t, 40.1, 2.2, out), spread = .08 + .37 * k, R = 300 + 300 * k, al = 1 - sm(t, 43.9, .4, ease.linear);
    const pts: [number, number][] = [[x, y], ...arcPts(x, y, R, R, a - spread, a + spread, 22), [x, y]];
    c.save(); c.globalAlpha = al; c.fillStyle = 'rgba(232,168,74,.13)'; c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.fill(); c.restore();
    brush(c, pts, { color: '#E4C06C', width: 4.5, seed: 400 + f * 3, jitter: 2.5, alpha: al });
    brush(c, arcPts(x, y, R * .55, R * .55, a - spread + .05, a + spread - .05, 16), { color: 'rgba(228,192,108,.6)', width: 3, seed: 430 + f, passes: 1, alpha: al });
  }
  if (t >= 50.6 && t < 52.5) {   // S10: waiting "..."
    const pp = puppetAt(t), [x, y] = P([pp.x, 2.95, pp.z]);
    const n = Math.min(3, 1 + Math.floor((t - 50.6) * 2.5) % 4);
    c.save(); c.fillStyle = '#EFE4CF'; for (let i = 0; i < n; i++) { c.beginPath(); c.arc(x - 20 + i * 26, y, 7, 0, 7); c.fill(); } c.restore();
  }
  if (t >= 53.8 && t < 55.5) {   // S10: speed lines as the puppet leaves
    const pp = puppetAt(t), [x, y] = P([pp.x, 1.3, pp.z]);
    for (let i = 0; i < 4; i++) brush(c, [[x - 70, y - 70 + i * 42], [x - 170 - i * 14, y - 70 + i * 42]], { color: '#EFE4CF', width: 5, seed: 500 + f * 4 + i, passes: 1, jitter: 1.5 });
  }
  if (t >= 20.0 && t < 23.5) chalkChart(c, t, 660, 600, 600, 270, f);
}

/** S04: a chalk scatter plot — axes, 26 dots that fall in one by one, and an amber trend line. */
function chalkChart(g: G, t: number, x: number, y: number, w: number, h: number, f: number) {
  const al = 1 - sm(t, 23.15, .3, ease.linear), col = 'rgba(243,235,221,.92)';
  const ax = sm(t, 20.0, .45, ease.linear);
  brush(g, partial([[x, y], [x, y + h * .5], [x, y + h], [x + w * .5, y + h], [x + w, y + h]], ax), { color: col, width: 5, seed: 600 + f, jitter: 2, alpha: al });
  if (ax >= 1) {
    brush(g, [[x - 12, y + 18], [x, y], [x + 12, y + 18]], { color: col, width: 5, seed: 610 + f, jitter: 1, passes: 1, alpha: al });
    brush(g, [[x + w - 18, y + h - 12], [x + w, y + h], [x + w - 18, y + h + 12]], { color: col, width: 5, seed: 620 + f, jitter: 1, passes: 1, alpha: al });
  }
  const la = sm(t, 20.35, .3, ease.linear) * al;
  text(g, '看起來多美 →', x + w, y + h + 44, { size: 26, family: SANS, weight: 500, color: col, tracking: 4, align: 'right', alpha: la });
  text(g, '↑ 覺得多好用', x + 14, y - 14, { size: 26, family: SANS, weight: 500, color: col, tracking: 4, alpha: la });
  const r = rng(9);
  for (let i = 0; i < 26; i++) {
    const tt = (i + .5) / 26, px = x + 30 + tt * (w - 60), py0 = y + h - 30 - (tt * .78 + (r() - .5) * .3) * (h - 60), py = Math.max(y + 20, Math.min(y + h - 20, py0));
    const t0 = 20.15 + i * .055; if (step(t) < t0) continue;
    const d = 1 - ramp(t, t0, .16, out);
    g.save(); g.globalAlpha = al; g.fillStyle = col; g.beginPath(); g.arc(px, py - 40 * d, 7, 0, 7); g.fill(); g.restore();
  }
  const tl = sm(t, 21.9, .9, ease.inOutSine);
  if (tl > 0) brush(g, partial(Array.from({ length: 20 }, (_, i) => [x + 30 + (w - 60) * i / 19, y + h - 40 - (h - 100) * i / 19] as [number, number]), tl), { color: C.amber, width: 6, seed: 640 + f, jitter: 2, alpha: al });
}

// ---------------------------------------------------------------- full-frame 2D shots (inside the screens)
const PANEL_WIRE: OffscreenCanvas[] = [], PAPER: OffscreenCanvas[] = [];
function wireCanvas(w: number, h: number, seed: number) { const c = new OffscreenCanvas(w, h); wire(c.getContext('2d'), w, h, { seed, ink: '#5E564C', bg: '#EFEBE3' }); return c; }
function paperBG(base: string, seed: number) { return bake(`paperbg-${base.slice(1)}-${seed}`, 1920, 1080, g => drawPaperBG(g, base, seed)); }
function drawPaperBG(g: OffscreenCanvasRenderingContext2D, base: string, seed: number) {
  const r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, 1920, 1080);
  for (let i = 0; i < 70; i++) { const x = r() * 1920, y = r() * 1080, R = 60 + r() * 220, gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, `rgba(120,90,55,${.02 + r() * .03})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - R, y - R, 2 * R, 2 * R); }
  for (let i = 0; i < 2600; i++) { const x = r() * 1920, y = r() * 1080, a = r() * 6.3, L = 4 + r() * 16; g.strokeStyle = r() < .55 ? `rgba(255,248,235,${.1 + r() * .12})` : `rgba(80,55,30,${.04 + r() * .06})`; g.lineWidth = .8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
  const v = g.createRadialGradient(960, 540, 380, 960, 540, 1150); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,25,10,.22)'); g.fillStyle = v; g.fillRect(0, 0, 1920, 1080);
}
type Rect = [number, number, number, number];
const lerpR = (a: Rect, b: Rect, k: number): Rect => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)];
const cover = (aspect: number): Rect => { const h = 1920 / aspect; return [0, (1080 - h) / 2, 1920, h]; };
function panel(g: G, r: Rect, draw: (c: G, w: number, h: number) => void, frameA = 1) {
  const [x, y, w, h] = r, s = w / 800;
  g.save(); g.globalAlpha = .22 * frameA; g.fillStyle = 'rgb(60,40,20)'; g.fillRect(x + 12 * s, y + 16 * s, w, h);
  g.globalAlpha = frameA; g.fillStyle = '#2B2621'; g.fillRect(x - 14 * s, y - 14 * s, w + 28 * s, h + 28 * s); g.globalAlpha = 1;
  g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); g.scale(w / 800, w / 800); draw(g, 800, h * 800 / w); g.restore();
}
function kick2D(g: G, s: string, x: number, y: number, a: number) { text(g, s, x, y, { ...T.kicker, color: C.amberInk, alpha: a }); g.save(); g.globalAlpha = a; g.fillStyle = C.amberInk; g.fillRect(x, y + 22, 60, 3); g.restore(); }

/** S03: both skins peel to one wireframe, then the votes pile up on the right. */
function fullS03(g: G, t: number) {
  const f = frame12(t);
  g.drawImage(PAPER[0]!, 0, 0);
  const R: Rect = [1000, 228, 800, 526], Lr: Rect = [120, 228, 800, 526];
  const enter = sm(t, 7.0, .75, out), exit = sm(t, 12.9, .5, inC);
  const rRect = exit > 0 ? lerpR(R, cover(800 / 526), exit) : lerpR(cover(800 / 526), R, enter);
  const lx = lerp(-900, 120, sm(t, 7.25, .65, out)) - exit * 1100;
  const cut = .56 * sm(t, 7.9, 1.1, ease.inOutSine) * (1 - sm(t, 9.7, .6, ease.inOutSine));
  const others = 1 - exit;
  const draw = (k: number) => (c: G, w: number, h: number) => {
    c.drawImage(skin(k ? 'pretty' : 'ugly', 800, 526), 0, 0, w, h);
    if (cut > 0) {
      c.drawImage(PANEL_WIRE[k]!, 0, 0, 800, 526 * cut, 0, 0, w, h * cut);
      const sl = c.createLinearGradient(0, h * cut - 30, 0, h * cut + 6); sl.addColorStop(0, 'rgba(232,168,74,0)'); sl.addColorStop(1, 'rgba(232,168,74,.75)');
      c.fillStyle = sl; c.fillRect(0, h * cut - 30, w, 36); c.fillStyle = '#FFE2A8'; c.fillRect(0, h * cut + 2, w, 4);
    }
  };
  // votes: hand-drawn ticks above each panel (two on the left, many on the right)
  const votes = (px: number, count: number, seed: number) => {
    for (let i = 0; i < count; i++) {
      const t0 = 11.32 + i * (count > 4 ? .055 : .5); if (step(t) < t0) continue;
      const vx = px + 40 + (i % 12) * 62, vy = 196 - Math.floor(i / 12) * 34;
      brush(g, [[vx, vy - 6], [vx + 9, vy + 4], [vx + 28, vy - 20]], { color: C.ink, width: 4.5, seed: seed + i * 7 + f, jitter: 1.4, passes: 1, alpha: others });
    }
  };
  if (others > 0) {
    g.save(); g.globalAlpha = others;
    panel(g, [lx, Lr[1], Lr[2], Lr[3]], draw(0));
    g.restore();
    const ta = sm(t, 7.5, .4, ease.linear) * others * (1 - sm(t, 11.1, .3, ease.linear));
    text(g, '同樣 4 顆按鈕 · 同樣 3 個步驟', 960, 165, { size: 64, family: SERIF, weight: 700, color: C.ink, tracking: 6, align: 'center', alpha: ta });
    kick2D(g, 'SAME SKELETON · 同一副骨架', 150, 92, sm(t, 7.4, .4, ease.linear) * others);
  }
  panel(g, rRect, draw(1), others);
  if (others > 0) {
    // numbered badges: the same button on both sides
    for (const [px, k0] of [[lx, 0], [1000, 4]] as const) SK.btn.forEach((b, i) => {
      const t0 = 8.4 + i * .1 + (k0 ? .05 : 0); if (step(t) < t0) return;
      const s = [.5, 1.15, 1][Math.min(2, Math.floor((step(t) - t0) * 12))]! * (1 - sm(t, 10.4, .3, ease.linear));
      if (s <= 0) return;
      const bx = px + b[2]! * 800 - 6, by = 228 + b[1]! * 526 + 6;
      g.save(); g.globalAlpha = others; g.fillStyle = C.amber; g.beginPath(); g.arc(bx, by, 24 * s, 0, 7); g.fill();
      g.fillStyle = C.ink; g.font = `500 ${28 * s}px "${SANS}"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), bx, by + 1); g.restore();
    });
    const la = sm(t, 8.0, .4, ease.linear) * others;
    text(g, '左：比較醜', lx + 400, 228 + 526 + 62, { size: 28, family: SANS, weight: 500, color: C.ink, tracking: 8, align: 'center', alpha: la });
    text(g, '右：比較好看', 1400, 228 + 526 + 62, { size: 28, family: SANS, weight: 500, color: C.ink, tracking: 8, align: 'center', alpha: la });
    const sa = sm(t, 9.0, .4, ease.linear) * (1 - sm(t, 11.1, .3, ease.linear)) * others;
    ['插卡', '選服務', '完成'].forEach((s, i) => {
      const sx = 960 - 330 + i * 330, sy = 872;
      g.save(); g.globalAlpha = sa; g.strokeStyle = C.ink; g.lineWidth = 3; g.beginPath(); g.arc(sx - 70, sy - 10, 22, 0, 7); g.stroke(); g.restore();
      text(g, String(i + 1), sx - 70, sy, { size: 26, family: SANS, weight: 500, color: C.ink, align: 'center', alpha: sa });
      text(g, s, sx - 36, sy, { size: 34, family: SANS, weight: 500, color: C.ink, alpha: sa });
      if (i < 2) brush(g, [[sx + 110, sy - 10], [sx + 190, sy - 10]], { color: C.amber, width: 4, seed: 70 + i, passes: 1, jitter: 1, alpha: sa });
    });
    votes(lx, 2, 800); votes(1000, 34, 900);
  }
}

/** S11: a usability test that passes, until the pretty skin is lifted. */
function fullS11(g: G, t: number) {
  const f = frame12(t);
  g.drawImage(PAPER[1]!, 0, 0);
  const R: Rect = [900, 230, 860, 565];
  const enter = sm(t, 56.1, .75, out), exit = sm(t, 60.7, .5, inC), others = 1 - exit;
  const rRect = exit > 0 ? lerpR(R, cover(860 / 565), exit) : lerpR(cover(860 / 565), R, enter);
  // the clipboard
  const cx = lerp(-700, 170, sm(t, 56.4, .6, out)) - exit * 900, cy = 190, cw = 600, ch = 640;
  if (others > 0) {
    g.save(); g.globalAlpha = others;
    g.fillStyle = 'rgba(60,40,20,.25)'; g.fillRect(cx + 14, cy + 18, cw, ch);
    g.fillStyle = '#9A7438'; g.fillRect(cx, cy, cw, ch); g.fillStyle = '#F6F0E4'; g.fillRect(cx + 22, cy + 70, cw - 44, ch - 92);
    g.fillStyle = '#5A4A3A'; g.fillRect(cx + cw / 2 - 90, cy - 18, 180, 60); g.restore();
    text(g, '易用性測試', cx + 60, cy + 150, { size: 40, family: SERIF, weight: 700, color: C.ink, alpha: others });
    text(g, '受測者 #07 · 美版', cx + 60, cy + 192, { size: 24, family: SANS, weight: 500, color: '#8A7E70', alpha: others });
    ['找到「提款」', '完成一次轉帳', '畫面看起來清楚', '整體覺得好用 5/5', '找到「下一步」'].forEach((s, i) => {
      const y = cy + 270 + i * 74;
      g.save(); g.globalAlpha = others; g.strokeStyle = '#B9AD9C'; g.lineWidth = 2; g.strokeRect(cx + 60, y - 30, 38, 38); g.restore();
      text(g, s, cx + 124, y, { size: 32, family: SANS, weight: 500, color: C.ink, alpha: others });
      if (i < 4) { const k = sm(t, 56.95 + i * .38, .2, ease.linear); if (k > 0) brush(g, partial([[cx + 64, y - 12], [cx + 78, y + 2], [cx + 108, y - 40]], k), { color: '#4E7A4A', width: 6, seed: 50 + i, jitter: 1.5, alpha: others }); }
    });
    // the pencil hovers over the last item
    const wob = STOP ? (rng(f)() - .5) * 6 : Math.sin(t * 9) * 3;
    g.save(); g.globalAlpha = others; g.translate(cx + 448, cy + 566 + wob); g.rotate(.55);
    g.fillStyle = '#D9A23A'; g.fillRect(0, -11, 230, 22); g.fillStyle = '#E8CFA8'; g.beginPath(); g.moveTo(0, -11); g.lineTo(-34, 0); g.lineTo(0, 11); g.fill();
    g.fillStyle = C.ink; g.beginPath(); g.moveTo(-24, -3.5); g.lineTo(-34, 0); g.lineTo(-24, 3.5); g.fill(); g.restore();
    kick2D(g, 'USABILITY TEST · 易用性測試', 150, 110, sm(t, 56.5, .4, ease.linear) * others);
  }
  // the pretty skin, its lower-right corner lifted in three poses
  const lift = Math.round(3 * ramp(t, 58.5, .5, ease.linear) * (1 - ramp(t, 60.4, .2, ease.linear))) / 3;
  panel(g, rRect, (c, w, h) => {
    const fx = w * .38 * 1.6 * lift, fy = h * .35 * 1.6 * lift;
    if (lift > 0) c.drawImage(skin('flaws', 860, 565), 0, 0, w, h);
    c.save(); if (lift > 0) { c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w, h - fy); c.lineTo(w - fx, h); c.lineTo(0, h); c.closePath(); c.clip(); }
    c.drawImage(skin('pretty', 860, 565), 0, 0, w, h); c.restore();
    if (lift > 0) {
      const ax = w, ay = h - fy, bx = w - fx, by = h;
      c.fillStyle = 'rgba(40,25,10,.35)'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.lineTo(bx - 40 * lift, by - 150 * lift); c.closePath(); c.fill();
      c.fillStyle = '#EFE4CF'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.lineTo(bx - 20 * lift, by - 190 * lift); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(120,90,55,.35)'; c.lineWidth = 2; c.stroke();
    }
  }, others);
  // the red circle round what the skin was hiding
  const rc = sm(t, 59.3, .5, ease.inOutSine) * (1 - sm(t, 60.35, .2, ease.linear)) * others;
  if (rc > 0) {
    const b3 = SK.btn[3]!, bx = 900 + (b3[0]! + (b3[2]! - b3[0]!) * .9) * 860, by = 230 + (b3[1]! + (b3[3]! - b3[1]!) * .15) * 565;
    brush(g, partial(arcPts(bx, by, 52, 44, -2.6, 3.5, 30), rc), { color: C.red, width: 7, seed: 60 + f, jitter: 3 });
    text(g, '小到點不到', bx + 40, by - 62, { size: 28, family: SANS, weight: 500, color: C.red, align: 'right', alpha: sm(t, 59.6, .3, ease.linear) * (1 - sm(t, 60.35, .2, ease.linear)) });
  }
}

// ---------------------------------------------------------------- 2D: kickers, subtitles, transitions, tagline
function fadeIn(t: number, a: number, b: number, inn = .35, outD = .3) { return at(t, a, a + inn, out) * (1 - at(t, b - outD, b, io)); }
function overlay(c: G, t: number) {
  const kick = KICKERS.find(([a, b]) => t >= a - .1 && t < b);
  if (kick) {
    const k = fadeIn(t, kick[0], kick[1]);
    const g = c.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, `rgba(14,11,8,${.5 * k})`); g.addColorStop(1, 'rgba(14,11,8,0)'); c.fillStyle = g; c.fillRect(0, 0, 1920, 300);
    text(c, kick[2], 150, 150 - (1 - k) * 6, { ...T.kicker, alpha: k });
    c.save(); c.globalAlpha = k; c.fillStyle = C.amber; c.fillRect(150, 172, 60, 3); c.restore();
  }
  const subOn = SUBS.some(([a, b]) => t >= a - .15 && t < b + .6);
  if (subOn) { const g = c.createLinearGradient(0, 780, 0, 1080); g.addColorStop(0, 'rgba(14,11,8,0)'); g.addColorStop(1, 'rgba(14,11,8,.55)'); c.fillStyle = g; c.fillRect(0, 780, 1920, 300); }
  SUBS.forEach(([a, b, s], i) => {
    const next = SUBS[i + 1]?.[0] ?? Infinity, end = Math.min(b + .6, next - .08);
    if (t < a - .15 || t > end) return;
    const k = at(t, a - .15, a + .1, out) * (1 - at(t, end - .18, end, io));
    c.save(); c.shadowColor = 'rgba(10,8,6,.6)'; c.shadowBlur = 16; text(c, s, 960, 1000 + (1 - k) * 8, { ...T.sub, alpha: k }); c.restore();
  });
  // the opening dark and the end
  const dip = (a: number, b: number) => at(t, a, a + .12, out) * (1 - at(t, b - .25, b, out));
  const black = Math.max(t < .8 ? (t < .2 ? 1 : 1 - .82 * at(t, .2, .5, out)) : 0, ...DARK.map(([a, b]) => dip(a, b) * .9), at(t, 73.2, 74.0, io));
  if (black > 0) { c.fillStyle = `rgba(10,8,6,${black})`; c.fillRect(0, 0, 1920, 1080); }
  // S13: the tagline builds phrase by phrase, then the credit
  if (t >= 67.2) {
    const k = fadeIn(t, 67.3, 73.4, .5, .4);
    const g = c.createLinearGradient(0, 760, 0, 1080); g.addColorStop(0, 'rgba(14,11,8,0)'); g.addColorStop(1, `rgba(14,11,8,${.7 * k})`); c.fillStyle = g; c.fillRect(0, 760, 1920, 320);
    const a1 = fadeIn(t, TAG[0]![0] - .1, 73.4, .4, .4), a2 = fadeIn(t, TAG[1]![0] - .1, 73.4, .4, .4);
    c.save(); c.font = `500 48px "${SANS}"`; c.letterSpacing = '12px'; const w1 = c.measureText(TAG[0]![1]).width, w2 = c.measureText(TAG[1]![1]).width; c.restore();
    const x0 = 966 - (w1 + w2) / 2;
    text(c, TAG[0]![1], x0, 930 + (1 - a1) * 8, { ...T.tagline, align: 'left', alpha: a1 });
    text(c, TAG[1]![1], x0 + w1, 930 + (1 - a2) * 8, { ...T.tagline, align: 'left', alpha: a2 });
    text(c, 'AESTHETIC – USABILITY EFFECT · 美即好用效應', 966, 986, { ...T.latin, alpha: fadeIn(t, 70.6, 73.4, .6, .4) });
    text(c, 'Made with Mografy', 1824, 1004, { ...T.credit, alpha: fadeIn(t, 71.2, 73.4, .6, .4) * .8 });
  }
}
