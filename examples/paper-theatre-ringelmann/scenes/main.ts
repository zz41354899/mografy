// 林格曼效應｜Ringelmann Effect — a 75 s, 12-shot stop-motion film in the same desk paper theatre as 陰影心理學,
// 格式塔心理學 and 美即好用效應, timed to the ElevenLabs narration (assets/narration-ringelmann.mp3, laid 1.2 s late;
// storyboards/cues.json).
//
// The film's idea: one twine rope tied to one brass dynamometer. The red needle is 3D (what the team really pulls); a
// gold dashed needle is 2D (what it should read if nobody held back). The gap between the two needles is the effect.
// In Act II the same dial turns over and becomes a sound meter; in Act III the rope unravels into four strands, and every
// puppet gets its own strand and its own small dial.
//
//  S01 一條繩子     0.0– 5.0  dark; the bulb snaps on; crane down; eight puppets wait at the back, the rope lies slack
//  S02 一個人       5.0–12.6  one puppet steps up, grabs, leans back: the needle swings to 100
//  S03 兩個、三個   12.6–17.4  two more join: the dashed needle says 200, 300; the red one stops at 186, 255
//  S04 八個人      17.4–21.6  pull back: eight on the rope, 392 against 800; Ringelmann's chalk bars
//  S05 命名        21.6–27.6  they let go, the rope drops, the gold title card is lowered; push to the dial
//  S06 拉不齊？     27.6–31.6  through the dial glass (iris): full-frame 2D, three effort curves out of step
//  S07 蒙眼實驗     31.6–40.8  iris back out onto the ink backstage: one blindfolded puppet, three see-through fakes
//  S08 大喊        40.8–49.6  the dial turns over into a sound meter; headphones, shouting, see-through partners
//  S09 一個數字     49.6–55.3  the dial turns back; eight on the rope seen past the dial: question marks; one lets go
//  S10 四股繩      55.3–65.0  a paper flat drops: the rope unravels into four strands, each named as it is spoken
//  S11 看得見      65.0–67.1  the flat flies out: four puppets, four short ropes, four small dials, all at 100
//  S12 片尾        67.1–75.0  pull back out of the proscenium: the whole theatre on a desk; tagline
//
// Motion (param `motion`): 'stop-motion' (default) poses the puppets, the rope, the lamp, the card and the dial's turn on
// 2s (12 per second) with a seeded boil; 'smooth' moves them every frame. The camera, focus, needles, 2D layers, type and
// subtitles are always smooth. Acts change while a full-frame 2D shot covers the stage, never in the dark.
import { at, beats, clamp, ease, lerp, text } from '@mografy/runtime';
import type { FrameContext, SetupContext, TextStyle } from '@mografy/runtime';
import { prepareStage, type Stage, type ThreeModule } from './three.js';
import { bake, buildWorld, loadBaked, storeBaked, makePost, dialAngle, rng, SANS, SERIF, TOP, ROPE_Y, ROPE_Z, DIAL, MINI, ROPE_SEGS, MINI_SEGS, type V3, type World } from './world.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type G = any;

// ---------------------------------------------------------------- tokens
const C = { cream: '#F3EBDD', amber: '#E8A84A', amberInk: '#A86A1C', ink: '#2C2824', red: '#D2412F', gold: '#E4C06C', chalk: 'rgba(243,235,221,.92)', muted: 'rgba(243,235,221,.74)', dim: 'rgba(243,235,221,.55)', bg: '#14110E' };
const T = {
  kicker: { size: 30, family: SANS, weight: 500, color: C.amber, tracking: 10 } as TextStyle,
  sub: { size: 44, family: SANS, weight: 500, color: C.cream, tracking: 2, align: 'center' } as TextStyle,
  tagline: { size: 48, family: SANS, weight: 500, color: C.amber, tracking: 12, align: 'center' } as TextStyle,
  latin: { size: 24, family: SANS, weight: 500, color: C.muted, tracking: 12, align: 'center' } as TextStyle,
  credit: { size: 22, family: SANS, weight: 500, color: C.dim, tracking: 2, align: 'right' } as TextStyle,
  chalk: { size: 34, family: SANS, weight: 500, color: C.chalk, tracking: 3 } as TextStyle,
};

export const BEATS = beats([
  { title: 'S01 一條繩子', end: 5.0, stop: 3.8, handoff: 1.0, note: 'The bulb snaps on; crane down to the slack rope and the dial.' },
  { title: 'S02 一個人', end: 12.6, stop: 11.4, handoff: 1.0, note: 'One puppet steps up and pulls: the needle reads 100.' },
  { title: 'S03 兩個、三個', end: 17.4, stop: 16.6, handoff: 1.0, note: 'Two more join: 186 and 255 against a dashed 200 and 300.' },
  { title: 'S04 八個人', end: 21.6, stop: 20.6, handoff: 1.2, note: 'Eight on the rope: 392 against 800; chalk bars 100/93/85/49.' },
  { title: 'S05 命名', end: 27.6, stop: 25.8, handoff: .8, note: 'They let go; the gold title card is lowered; push to the dial.' },
  { title: 'S06 拉不齊？', end: 31.6, stop: 30.9, handoff: .6, note: 'Full-frame 2D through the dial glass: effort curves out of step.' },
  { title: 'S07 蒙眼實驗', end: 40.8, stop: 39.4, handoff: .6, note: 'Blindfolded, with see-through fakes: still under 100.' },
  { title: 'S08 大喊', end: 49.6, stop: 47.6, handoff: .6, note: 'The dial turns into a sound meter: 100, 82, 74.' },
  { title: 'S09 一個數字', end: 55.3, stop: 54.4, handoff: .5, note: 'Eight people, one number: question marks; one lets go.' },
  { title: 'S10 四股繩', end: 65.0, stop: 64.6, handoff: .5, note: 'A paper flat: the rope unravels into four named strands.' },
  { title: 'S11 看得見', end: 67.1, stop: 66.4, handoff: 1.0, note: 'Four ropes, four small dials, all at 100.' },
  { title: 'S12 片尾', end: 75.0, stop: 73.0, note: 'Pull back: the whole theatre on a desk; tagline.' },
]);
export const meta = { width: 1920, height: 1080, duration: BEATS.duration, fps: 30, background: C.bg, shots: BEATS.shots };
export const params = {
  motion: { name: '動態 Motion', type: 'enum' as const, default: 'stop-motion', options: ['stop-motion', 'smooth'] },
};

// narration phrases shown as subtitles (film seconds, from storyboards/cues.json); S05's last line is the gold card itself
const SUBS: [number, number, string][] = [
  [1.34, 3.72, '一個人拉繩子，能出多少力？'],
  [5.18, 8.09, '一百多年前，法國農業工程師林格曼，'], [8.39, 10.06, '量過人拉繩子的力氣。'], [10.80, 12.30, '一個人出一百分的力。'],
  [12.92, 15.19, '兩個人一起，每人只剩 93；'], [15.64, 16.95, '三個人，85。'],
  [17.52, 18.33, '到了八個人，'], [18.57, 20.37, '每個人平均只出了 49，'], [20.65, 21.20, '不到一半。'],
  [21.96, 24.17, '人越多，每個人出的力越少。'],
  [28.17, 31.09, '林格曼猜，是大家用力的時間對不上。'],
  [31.95, 34.90, '但 1974 年的實驗讓人蒙眼拉繩，'], [35.28, 37.08, '後面的人只是假裝在拉。'], [37.53, 38.61, '不用配合任何人，'], [38.88, 40.10, '他還是少出了力。'],
  [41.11, 44.13, '1979 年，研究者讓人戴上耳機大喊。'], [44.77, 47.30, '只要以為有人一起喊，聲音就變小。'], [47.76, 49.09, '這叫「社會懈怠」。'],
  [49.92, 52.60, '人一多，沒人看得出你出了多少力；'], [53.08, 54.83, '你也覺得，少你一個沒差。'],
  [55.76, 59.27, '1993 年，一份整理 78 篇研究的分析發現：'],
  [59.81, 61.48, '當每個人的貢獻看得見、'], [61.80, 62.74, '任務有意義、'], [63.00, 63.86, '團隊小一點、'], [64.16, 64.91, '彼此在乎，'], [65.22, 66.65, '偷懶就會少很多。'],
];
const TAG: [number, string][] = [[67.32, '人多，不一定力量大；'], [69.43, '看得見，'], [70.29, '大家才會用力。']];
// kickers on 3D shots (the 2D shots draw their own, in dark amber on paper)
const KICKERS: [number, number, string][] = [
  [5.4, 12.4, 'M. RINGELMANN · 1913 · 法國農業工程師'], [12.9, 17.2, 'PER PERSON · 每人平均出力'], [17.8, 21.4, 'RINGELMANN · 1913 · 他的數據'],
  [32.4, 40.2, 'INGHAM ET AL. · 1974 · 蒙眼拉繩'], [41.6, 49.0, 'LATANE ET AL. · 1979 · 社會懈怠'],
  [50.6, 54.9, 'ONE NUMBER · 只看得到總數'], [65.5, 67.0, 'VISIBLE EFFORT · 每份力都看得見'],
];
// the four conditions in S10, each strand appears as it is spoken
const TAGT = [59.81, 61.80, 63.00, 64.16];

// full-frame 2D (the stage is not rendered) and the transitions that reveal or cover it
const IN2D: [number, number][] = [[28.0, 31.25], [55.45, 64.85]];
const IRIS_OPEN: [number, number] = [27.45, 28.0], IRIS_CLOSE: [number, number] = [31.25, 31.8];
const DROP: [number, number] = [54.95, 55.45], LIFT: [number, number] = [64.85, 65.35];

// ---------------------------------------------------------------- time
const FPS_ANIM = 12;
let STOP = false;
/** Pose time: on 2s in stop-motion, the real time otherwise. */
const step = (t: number) => STOP ? Math.floor(t * FPS_ANIM + 1e-6) / FPS_ANIM : t;
const io = ease.inOutCubic, out = ease.outCubic, inQ = ease.inQuad, inC = ease.inCubic;
const outBack = (x: number) => { const c = 1.7; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
const mix3 = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
/** 0 → 1 over [a, a + d] on the pose clock. */
const ramp = (t: number, a: number, d: number, curve = io) => curve(clamp((step(t) - a) / d));
/** 0 → 1 over [a, a + d] on the smooth clock. */
const sm = (t: number, a: number, d: number, curve = io) => curve(clamp((t - a) / d));
const frame12 = (t: number) => Math.floor(t * 12 + 1e-6);

// ---------------------------------------------------------------- the set
const SPOTS = [2.3, 1.35, .4, -.55, -1.5, -2.45, -3.4, -4.35];   // places on the rope, nearest the dial first
const PZ = ROPE_Z + .05, QZ = 1.15;                              // on the rope / waiting at the back
const XS3 = [-5.0, -2.3, .4, 3.1];                            // Act III: four puppets, each with a small dial at x + 1.55
const HOOK_X = DIAL.x - .72;
const actOf = (t: number) => t < 28.0 ? 1 : t < 41.1 ? 2 : t < 49.8 ? 3 : t < 60 ? 4 : 5;   // 1 Act I · 2 S07 · 3 S08 · 4 S09 · 5 Act III

// ---------------------------------------------------------------- the lamp
interface Lamp { p: V3; k: number; power: number }
// the lamp stands well in front of the rope: from the side its light only grazes the puppets' faces
const LA: V3 = [-2.6, 4.7, 6.5], L04: V3 = [-4.3, 5.0, 6.7], L05: V3 = [-5.2, 5.6, 6.6], L07: V3 = [5.3, 4.4, 5.9], L09: V3 = [-1.0, 5.6, 6.6], L11: V3 = [-5.3, 5.4, 6.0];
function lampAt(t: number): Lamp {
  const k = t < .8 ? 0 : 1;
  if (t < 17.4) return { p: LA, k, power: 60 };
  if (t < 21.6) return { p: mix3(LA, L04, ramp(t, 17.4, .6)), k, power: 60 };
  if (t < 28.0) return { p: mix3(L04, L05, ramp(t, 21.8, .7)), k, power: 60 };
  if (t < 49.8) return { p: L07, k, power: 33 };
  if (t < 60) return { p: L09, k, power: 40 };
  if (t < 67.1) return { p: L11, k, power: 63 };
  return { p: L11, k, power: 63 };   // stays out of frame through the pull-back
}

// ---------------------------------------------------------------- the camera
interface Pose { p: V3; q: V3; f: number }
const DIAL_C: V3 = [DIAL.x, DIAL.y, ROPE_Z];
const P: Record<string, Pose> = {
  c01a: { p: [0, 8.6, 13.6], q: [0, 2.0, 2.0], f: 40 },
  c01: { p: [0, 5.4, 12.6], q: [0, 2.4, 2.4], f: 40 },
  c02: { p: [2.7, 2.7, 11.8], q: [2.9, 2.2, 3.0], f: 34 },
  c03: { p: [1.9, 2.75, 11.2], q: [1.6, 2.15, 3.0], f: 37 },
  c04: { p: [0, 3.6, 13.2], q: [-.1, 2.3, 3.0], f: 40 },
  c05: { p: [.2, 3.9, 13.4], q: [.2, 3.05, 3.5], f: 42 },
  c05b: { p: [.2, 3.95, 12.9], q: [.2, 3.2, 3.5], f: 40 },
  cDial: { p: [DIAL.x, DIAL.y, ROPE_Z + 2.55], q: DIAL_C, f: 40 },
  c07: { p: [2.4, 2.6, 10.6], q: [1.9, 2.2, 3.1], f: 38 },
  c07b: { p: [2.6, 2.5, 9.7], q: [2.0, 2.2, 3.1], f: 38 },
  c08: { p: [1.2, 2.7, 11.6], q: [1.2, 2.3, 3.1], f: 40 },
  c08b: { p: [.5, 2.7, 11.9], q: [.6, 2.3, 3.1], f: 40 },
  c09: { p: [6.1, 3.1, 9.6], q: [1.7, 2.25, 3.0], f: 40 },
  c11: { p: [-.2, 3.4, 13.6], q: [-.25, 1.95, 3.0], f: 42 },
  c11b: { p: [-.2, 3.3, 13.1], q: [-.25, 2.0, 3.0], f: 42 },
  c12: { p: [0, 9.5, 31], q: [0, 3.6, 3.5], f: 30 },
};
const blend = (a: Pose, b: Pose, k: number): Pose => ({ p: mix3(a.p, b.p, k), q: mix3(a.q, b.q, k), f: lerp(a.f, b.f, k) });
const move = (t: number, t0: number, t1: number, a: Pose, b: Pose, curve = io) => blend(a, b, curve(clamp((t - t0) / (t1 - t0))));
function bez3(a: V3, b: V3, c: V3, d: V3, u: number): V3 { const f = (i: 0 | 1 | 2) => (1 - u) ** 3 * a[i] + 3 * (1 - u) ** 2 * u * b[i] + 3 * (1 - u) * u * u * c[i] + u ** 3 * d[i]; return [f(0), f(1), f(2)]; }

function camera(t: number): Pose {
  if (t < 5.0) return move(t, .5, 4.6, P.c01a!, P.c01!, ease.inOutQuart);
  if (t < 12.6) return move(t, 5.0, 6.4, P.c01!, P.c02!);
  if (t < 17.4) return move(t, 12.6, 13.7, P.c02!, P.c03!);
  if (t < 21.6) return move(t, 17.4, 18.6, P.c03!, P.c04!);
  if (t < 26.8) return t < 23.2 ? move(t, 21.8, 23.2, P.c04!, P.c05!) : move(t, 23.2, 26.6, P.c05!, P.c05b!, ease.inOutSine);
  if (t < 31.8) return move(t, 26.8, 27.6, P.c05b!, P.cDial!);   // S05 → S06: into the dial glass
  if (t < 40.3) return t < 33.0 ? move(t, 31.8, 33.0, P.cDial!, P.c07!) : move(t, 33.0, 40.0, P.c07!, P.c07b!, ease.inOutSine);
  if (t < 41.4) return move(t, 40.3, 40.9, P.c07b!, P.cDial!);   // the dial turns over in close-up
  if (t < 49.0) return t < 42.4 ? move(t, 41.4, 42.4, P.cDial!, P.c08!) : move(t, 42.4, 48.8, P.c08!, P.c08b!, ease.inOutSine);
  if (t < 50.0) return move(t, 49.0, 49.6, P.c08b!, P.cDial!);   // and back
  if (t < 60) return move(t, 50.0, 51.0, P.cDial!, P.c09!);
  if (t < 67.1) return move(t, 65.1, 67.1, P.c11!, P.c11b!, ease.inOutSine);
  const u = io(clamp((t - 67.1) / 4.7));
  return { p: bez3(P.c11b!.p, [0, 5.4, 14.6], [0, 8.4, 22], P.c12!.p, u), q: mix3(P.c11b!.q, P.c12!.q, u), f: lerp(P.c11b!.f, P.c12!.f, u) };
}

/** Focus, with every change blended over 0.6 s so the depth of field never pops. */
const FOCUS_CUTS = [5.0, 12.6, 17.4, 21.6, 26.8, 31.8, 40.3, 41.4, 49.0, 50.0, 67.1];
function focus(t: number): { at: V3; ap: number } {
  for (const b of FOCUS_CUTS) if (t >= b && t < b + .6) {
    const a = focusRaw(b - 1e-3), c = focusRaw(t), u = io((t - b) / .6);
    return { at: mix3(a.at, c.at, u), ap: lerp(a.ap, c.ap, u) };
  }
  return focusRaw(t);
}
function focusRaw(t: number): { at: V3; ap: number } {
  if (t < 5.0) return { at: [1.2, 1.6, 3.0], ap: 8 };
  if (t < 12.6) return { at: [2.9, 2.1, 3.1], ap: 10 };
  if (t < 17.4) return { at: [1.6, 2.0, 3.1], ap: 10 };
  if (t < 21.6) return { at: [0, 2.0, 3.1], ap: 12 };
  if (t < 26.8) return { at: [.3, 4.4, 4.3], ap: 12 };
  if (t < 31.8) return { at: DIAL_C, ap: 6 };
  if (t < 40.3) return { at: [2.4, 2.0, 3.1], ap: 10 };
  if (t < 41.4) return { at: DIAL_C, ap: 6 };
  if (t < 49.0) return { at: [2.6, 2.2, 3.25], ap: 10 };
  if (t < 50.0) return { at: DIAL_C, ap: 6 };
  if (t < 60) return { at: DIAL_C, ap: 14 };
  if (t < 67.1) return { at: [0, 1.9, 3.1], ap: 12 };
  return { at: mix3([0, 1.9, 3.1], [0, 4.5, 6.5], io(clamp((t - 67.1) / 4.7))), ap: lerp(12, 5, clamp((t - 67.1) / 4.7)) };
}

// ---------------------------------------------------------------- the puppets
interface PS { on: boolean; x: number; z: number; y: number; tilt: number; grip: number; blind: boolean; phones: boolean; alpha: number; shout: number }
const OFF: PS = { on: false, x: 0, z: 0, y: 0, tilt: 0, grip: 0, blind: false, phones: false, alpha: 1, shout: 0 };
const STEP_IN = [5.55, 12.85, 15.05, 17.45, 17.58, 17.71, 17.84, 17.97];
// how far each puppet leans back as the team grows (1, 2, 3, then 8 on the rope): the last ones barely lean at all
const TT = { one: .2, two: .17, three: .15, eight: [.13, .11, .08, .1, .05, .07, .04, .06] };
function leanAt(t: number, i: number) {
  let v = TT.one;
  v += (TT.two - v) * ramp(t, 13.6, .4);
  v += (TT.three - TT.two) * ramp(t, 15.8, .4);
  v += (TT.eight[i]! - TT.three) * ramp(t, 18.6, .5);
  return v;
}
/** Steps forward from the queue (hops on 2s), grabs the rope, leans back. */
function stepUp(t: number, i: number, x: number, t0: number) {
  const u = ramp(t, t0, .5), ts = step(t);
  const hop = ts >= t0 && ts < t0 + .5 ? Math.abs(Math.sin((ts - t0) * Math.PI * 4)) * .1 : 0;
  return { x, z: lerp(QZ, PZ, u), y: hop, grip: ramp(t, t0 + .5, .25), lean: ramp(t, t0 + .75, .3, out) };
}
function puppetsAt(t: number): PS[] {
  const act = actOf(t), ts = step(t);
  if (act === 1) return SPOTS.map((x, i) => {
    const s = stepUp(t, i, x, STEP_IN[i]!), rel = ramp(t, 22.6, .25);
    return { ...OFF, on: true, x, z: s.z, y: s.y, grip: s.grip * (1 - rel), tilt: leanAt(t, i) * s.lean * (1 - rel) };
  });
  if (act === 2) return SPOTS.map((x, i) => {
    if (i > 3) return OFF;
    const rel = ramp(t, 40.4, .25), fake = i > 0;
    // the fakes go through the motions: their lean pumps on 2s, the real one holds
    const pump = fake ? .03 * Math.sin(frame12(t) * 1.7 + i) : 0;
    return { ...OFF, on: true, x, z: PZ, grip: 1 - rel, tilt: ((fake ? .18 : .14) + pump) * (1 - rel), blind: i === 0, alpha: fake ? .16 : 1 };
  });
  if (act === 3) return SPOTS.map((_, i) => {
    if (i > 5) return OFF;
    const x = 2.55 - i * .95, z = PZ + .2;
    if (i === 0) {
      const shouting = t >= 41.6 && t < 48.9, beat = shouting ? (frame12(t) % 4 < 2 ? 1 : .55) : 0;
      return { ...OFF, on: true, x, z, phones: true, shout: beat };
    }
    const t0 = i === 1 ? 44.8 : 45.6 + (i - 2) * .15;
    if (ts < t0) return OFF;
    return { ...OFF, on: true, x, z, phones: true, alpha: .16 * ramp(t, t0, .25, ease.linear) };
  });
  if (act === 4) return SPOTS.map((x, i) => {
    const quits = i === 5 ? ramp(t, 53.4, .3) : 0;   // "少你一個沒差": one lets go, the needle barely moves
    return { ...OFF, on: true, x, z: PZ, grip: 1 - quits, tilt: TT.eight[i]! * (1 - quits) };
  });
  return SPOTS.map((_, i) => {
    if (i > 3) return OFF;
    return { ...OFF, on: true, x: XS3[i]!, z: PZ, grip: 1, tilt: .2 * ramp(t, 65.2 + i * .2, .3, out) };
  });
}
/** World x of a puppet's front hand (where the rope is held). */
function handX(s: PS, h: number) {
  const dir = lerp(.12, Math.PI / 2 - .08 - s.tilt, s.grip), a = s.tilt + dir;
  const sx = .36 * Math.cos(s.tilt) - 1.62 * Math.sin(s.tilt);
  return s.x + (sx + .76 * Math.sin(a)) * h;
}

// ---------------------------------------------------------------- the rope
/** Points along the rope from the hook: taut to the last hand, then down to the floor; or slack on the floor. */
function ropePoints(n: number, hx: number, z: number, xl: number, k: number, tail = 1.6, slackTo = -4.6): V3[] {
  const pts: V3[] = [], a = Math.max(.05, hx - xl), back = 1.0, drop = .9, total = a + back + drop + tail;
  const sTotal = .9 + Math.max(.5, hx - .9 - slackTo);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    // taut
    let d = u * total, tp: V3;
    if (d < a) tp = [hx - d, ROPE_Y - .025 * Math.sin(Math.PI * d / a), z];
    else if (d < a + back) { const v = (d - a) / back; tp = [xl - back * v, ROPE_Y - .28 * v * v, z - .12 * v]; }   // behind the body
    else if (d < a + back + drop) { const v = (d - a - back) / drop, e = v * v * (3 - 2 * v); tp = [xl - back - .5 * v, lerp(ROPE_Y - .28, .06, e), z - .12 + .1 * v]; }
    else { const v = (d - a - back - drop) / tail; tp = [xl - back - .5 - tail * v, .06, z - .02 + .3 * v]; }
    // slack
    d = u * sTotal; let sp: V3;
    if (d < .9) { const v = d / .9; sp = [hx - .9 * v, lerp(ROPE_Y, .06, Math.sqrt(v)), z + .25 * v]; }
    else { const v = (d - .9) / (sTotal - .9); sp = [hx - .9 - (hx - .9 - slackTo) * v, .06, z + .25 + .3 * v]; }
    pts.push(mix3(sp, tp, k));
  }
  return pts;
}
function poseRope(W: World, rope: World, pts: V3[]) {
  rope.g.visible = true;
  for (let i = 0; i < rope.segs.length; i++) {
    const a = pts[i]!, b = pts[i + 1]!, m = rope.segs[i];
    W.dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = W.dir.length() || 1e-4; W.dir.multiplyScalar(1 / len);
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); m.scale.y = len; m.quaternion.setFromUnitVectors(W.up, W.dir);
  }
  rope.knots.forEach((k: ThreeModule, i: number) => k.position.set(...pts[i]!));
}
/** How taut the main rope is (0 slack on the floor, 1 pulled). */
function tension(t: number) {
  const act = actOf(t);
  if (act === 1) return ramp(t, 6.15, .45) * (1 - ramp(t, 22.6, .35, inQ));
  if (act === 2) return 1 - ramp(t, 40.4, .4, inQ);
  if (act === 3) return 0;
  if (act === 4) return ramp(t, 50.1, .4);
  return 0;
}

// ---------------------------------------------------------------- the needles
type Key = [number, number, number];   // start, duration, target
function needle(t: number, keys: Key[]) {
  let v = 0;
  for (const [t0, d, target] of keys) { if (t < t0) break; v = lerp(v, target, outBack(clamp((t - t0) / d))); }
  return v;
}
const FORCE: Key[] = [[6.6, 1.0, 100], [13.6, .8, 186], [15.75, .7, 255], [18.4, 1.1, 392], [22.6, .6, 0], [29.0, .1, 84], [40.45, .5, 0], [50.3, .8, 392], [53.5, .6, 352]];
const SOUND: Key[] = [[41.6, .5, 100], [45.0, .5, 82], [46.0, .5, 74]];
/** The dial's face turns over (force ↔ sound) in close-up, on 2s. */
const flipAt = (t: number) => t < 49.6 ? Math.PI * ramp(t, 40.9, .5) : Math.PI * (1 - ramp(t, 49.6, .5));

// ---------------------------------------------------------------- posing the stage
interface Film { stage: Stage<World>; post: ReturnType<typeof makePost> }
function str(s: ThreeModule, a: V3) {
  const h = TOP - a[1]; s.visible = h > .02; if (!s.visible) return;
  s.scale.y = h; s.rotation.set(0, 0, 0); s.position.set(a[0], a[1] + h / 2, a[2] + .011);
}
function pose(ctx: FrameContext, W: World, t: number, cp: Pose, cam: ThreeModule) {
  const n = STOP ? Math.floor(t * FPS_ANIM + 1e-6) : Math.floor(t * 30), ts = step(t), act = actOf(t);
  const boil = (k: number, amt: number) => (ctx.noise(n, k) - .5) * 2 * amt;
  const ink = t >= 30 && t < 60 ? 1 : 0;   // switched while a full-frame 2D shot covers the stage
  W.ink.visible = ink > 0;
  const finale = t >= 67.1;
  W.pro.visible = W.title.visible = W.deskProps.visible = finale;

  // lights (a light's visibility never changes: the light count changing recompiles every material)
  const L = lampAt(t), flick = STOP ? 1 + boil(91, .03) : 1 + .012 * Math.sin(t * 7.3), lamp = W.lamp, h = L.p[1] - .3;
  lamp.g.position.set(L.p[0], 0, L.p[2]); lamp.rod.scale.y = h; lamp.rod.position.y = h / 2 + .07; lamp.sock.position.y = L.p[1] - .22;
  lamp.bulb.position.y = L.p[1]; lamp.light.position.y = L.p[1];
  lamp.light.intensity = L.power * L.k * flick;
  lamp.bulbMat.emissiveIntensity = L.k > 0 ? 9 * flick : .05; lamp.bulbMat.color.set(L.k > 0 ? 0xffe9c8 : 0xb8b0a2);
  const dark = t < .8, gold = act === 5;
  W.hemi.intensity = dark ? 0 : finale ? .3 : ink ? .13 : gold ? .34 : .3;
  W.fill.intensity = t < .8 ? .45 : finale ? .3 : ink ? .05 : .14;
  W.room.intensity = gold ? (finale ? lerp(.45, 1.3, sm(t, 67.6, 2.0)) : .45) : 0; W.room.shadow.autoUpdate = gold;

  // the puppets
  const PSs = puppetsAt(t);
  W.puppets.forEach((pp: World, i: number) => {
    const s = PSs[i]!;
    pp.g.visible = s.on; if (!s.on) return;
    pp.g.position.set(s.x + boil(300 + i, .01), s.y, s.z); pp.g.scale.setScalar(pp.h); pp.g.rotation.set(0, 0, 0);
    const lean = s.tilt + (s.shout ? -.07 * s.shout : 0);
    pp.body.rotation.set(0, 0, lean + boil(320 + i, .012));
    const dir = Math.PI / 2 - .08 - s.tilt;
    pp.arms[0].rotation.z = lerp(.12, dir, s.grip) + boil(340 + i, .02);
    pp.arms[1].rotation.z = lerp(-.12, dir + .1, s.grip) + boil(360 + i, .02);
    pp.blind.visible = s.blind; pp.phones.visible = s.phones;
    if (pp.ghost !== s.alpha) {
      pp.ghost = s.alpha; const solid = s.alpha > .99;
      for (const m of pp.mats) { m.opacity = s.alpha; m.depthWrite = solid; }
      for (const m of pp.meshes) m.castShadow = solid;
    }
  });

  // the main rope and the big dial (Acts I–II); four short ropes and small dials (Act III)
  const dialOn = act < 5;
  W.dial.outer.visible = dialOn;
  if (dialOn) {
    const k = tension(t);
    let xl = HOOK_X - .9;
    PSs.forEach((s, i) => { if (s.on && s.grip > .01 && s.z > PZ - .3) xl = Math.min(xl, lerp(HOOK_X - .3, handX(s, W.puppets[i].h), s.grip)); });
    poseRope(W, W.rope, ropePoints(ROPE_SEGS, HOOK_X, ROPE_Z, xl, k));
    const quiver = k > .5 ? boil(97, 3) : 0;
    W.dial.needles.force.rotation.z = dialAngle(needle(t, FORCE) + quiver, 800);
    W.dial.needles.sound.rotation.z = dialAngle(needle(t, SOUND) + (act === 3 && t > 41.6 ? boil(98, 2) : 0), 100);
    W.dial.disc.rotation.y = flipAt(t);
  } else W.rope.g.visible = false;
  W.minis.forEach((m: World, i: number) => {
    m.outer.visible = act === 5; W.miniRopes[i].g.visible = act === 5;
    if (act !== 5) return;
    m.outer.position.set(XS3[i]! + 1.55, 0, ROPE_Z); m.disc.rotation.y = 0;
    const v = 100 * outBack(clamp((t - (65.3 + i * .2)) / .6));
    m.needles.force.rotation.z = dialAngle(v + (v > 50 ? boil(400 + i, 2) : 0), 800);   // same 0–800 face: one person = 100
    const hx = XS3[i]! + 1.55 + m.hook, xl = handX(PSs[i]!, W.puppets[i].h);
    poseRope(W, W.miniRopes[i], ropePoints(MINI_SEGS, hx, ROPE_Z, xl, 1, .6));
  });

  // S05: the gold title card
  const tcOn = t >= 23.9 && t < 27.1;
  W.titleCard.visible = tcOn; W.titleStr.forEach((s: ThreeModule) => (s.visible = tcOn));
  if (tcOn) {
    const y = lerp(9.5, 4.75, ramp(t, 24.1, .6, out)) + (ts >= 24.7 && ts < 24.95 ? .04 * Math.sin((ts - 24.7) * 30) : 0) + 7 * ramp(t, 26.6, .4, inQ);
    W.titleCard.position.set(.3 + boil(450, .004), y, 4.3); W.titleCard.rotation.set(0, -.04 + boil(451, .01), .012);
    W.titleStr.forEach((s: ThreeModule, i: number) => str(s, [.3 + (i ? 1.9 : -1.9), y + .78, 4.3]));
  }

  cam.fov = cp.f; cam.position.set(...cp.p); cam.up.set(0, 1, 0); cam.lookAt(...cp.q);
}

// ---------------------------------------------------------------- setup and frame
const PAPER: OffscreenCanvas[] = [];
function paperBG(base: string, seed: number) { return bake(`paperbg-${base.slice(1)}-${seed}`, 1920, 1080, g => drawPaperBG(g, base, seed)); }
function drawPaperBG(g: OffscreenCanvasRenderingContext2D, base: string, seed: number) {
  const r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, 1920, 1080);
  for (let i = 0; i < 70; i++) { const x = r() * 1920, y = r() * 1080, R = 60 + r() * 220, gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, `rgba(120,90,55,${.02 + r() * .03})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - R, y - R, 2 * R, 2 * R); }
  for (let i = 0; i < 2600; i++) { const x = r() * 1920, y = r() * 1080, a = r() * 6.3, L = 4 + r() * 16; g.strokeStyle = r() < .55 ? `rgba(255,248,235,${.1 + r() * .12})` : `rgba(80,55,30,${.04 + r() * .06})`; g.lineWidth = .8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
  const v = g.createRadialGradient(960, 540, 380, 960, 540, 1150); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,25,10,.22)'); g.fillStyle = v; g.fillRect(0, 0, 1920, 1080);
}

export async function setup(ctx: SetupContext) {
  await loadBaked();   // textures drawn by an earlier open (see world.ts)
  PAPER[0] = paperBG('#E6DCCB', 6); PAPER[1] = paperBG('#EAE0CE', 8);
  const stage = await prepareStage(ctx, async b => {
    b.renderer.shadowMap.enabled = true; b.renderer.shadowMap.type = b.THREE.PCFShadowMap;
    b.renderer.outputColorSpace = b.THREE.LinearSRGBColorSpace; b.renderer.toneMapping = b.THREE.NoToneMapping;
    b.scene.background = new b.THREE.Color(0x14110e);
    b.camera.near = .1; b.camera.far = 200;
    const world = buildWorld(b.THREE, b.scene, b.renderer);
    // compile every shader in parallel before the first render, so opening the project does not block the player
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
  let Pj: (q: V3) => [number, number, boolean] = () => [0, 0, false];
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
    post.mat.uniforms.exposure.value = actOf(t) === 5 ? 1.05 : 1;
    post.render(stage.scene, cam);
    ctx.withCanvas(c => { c.imageSmoothingQuality = 'high'; c.drawImage(stage.surface, 0, 0, ctx.width, ctx.height); });
    Pj = (q: V3) => project(W, cam, q);
  }
  ctx.withCanvas(c => {
    if (full2D) { if (t < 40) fullS06(c, t); else fullS10(c, t); }
    else {
      const L = lampAt(t), [x, y, front] = Pj(L.p);
      if (L.k > 0 && front) {
        const R = 260; c.globalCompositeOperation = 'screen';
        const g = c.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, 'rgba(255,190,100,.5)'); g.addColorStop(.25, 'rgba(255,160,70,.18)'); g.addColorStop(1, 'rgba(255,140,60,0)');
        c.fillStyle = g; c.fillRect(x - R, y - R, 2 * R, 2 * R); c.globalCompositeOperation = 'source-over';
      }
      marks(c, t, W, Pj);
      transitions(c, t, Pj);
    }
    overlay(c, t);
  });
}

// ---------------------------------------------------------------- 2D: hand-drawn marks over the 3D world (boil on 2s)
function brush(g: G, pts: [number, number][], o: { color?: string; width?: number; seed?: number; jitter?: number; passes?: number; alpha?: number; dash?: number[] } = {}) {
  const r = rng(o.seed ?? 1), j = o.jitter ?? 2;
  g.save(); g.strokeStyle = o.color ?? C.ink; g.lineWidth = o.width ?? 6; g.lineCap = 'round'; g.lineJoin = 'round';
  if (o.dash) g.setLineDash(o.dash);
  for (let pass = 0; pass < (o.passes ?? 2); pass++) {
    g.globalAlpha = (o.alpha ?? 1) * (pass ? .55 : 1); g.beginPath();
    pts.forEach(([x, y], i) => { const px = x + (r() - .5) * j, py = y + (r() - .5) * j; if (i) g.lineTo(px, py); else g.moveTo(px, py); });
    g.stroke();
  }
  g.restore();
}
const arcPts = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): [number, number][] => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
const linePts = (x0: number, y0: number, x1: number, y1: number, n = 10): [number, number][] => Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);
const partial = (pts: [number, number][], k: number) => pts.slice(0, Math.max(2, Math.ceil(pts.length * clamp(k))));
function chalk(g: G, s: string, x: number, y: number, a: number, o: Partial<TextStyle> = {}) {
  if (a <= 0) return;
  g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 8; text(g, s, x, y, { ...T.chalk, ...o, alpha: a }); g.restore();
}
/** A window [a, b] faded in and out. */
function fadeIn(t: number, a: number, b: number, inn = .35, outD = .3) { return at(t, a, a + inn, out) * (1 - at(t, b - outD, b, io)); }

/** Above-the-head force arrow: points left (the pull), its length is that person's share. */
function forceArrow(g: G, x: number, y: number, k: number, label: string, s: number, a: number, seed: number) {
  const L = 200 * k * s, x1 = x - L;
  brush(g, linePts(x, y, x1, y), { color: C.amber, width: 9 * s, seed, jitter: 1.5, alpha: a });
  brush(g, [[x1 + 26 * s, y - 20 * s], [x1, y], [x1 + 26 * s, y + 20 * s]], { color: C.amber, width: 9 * s, seed: seed + 1, jitter: 1, passes: 1, alpha: a });
  if (label) chalk(g, label, x - L / 2, y - 22 * s, a, { size: 40 * s, weight: 700, color: C.gold, align: 'center' });
}
/** The 2D "should read" needle: dashed, from the dial centre to that value; its label above the dial. */
function ghostNeedle(g: G, Pj: (q: V3) => [number, number, boolean], v: number, max: number, label: string, a: number, seed: number) {
  const tip = (val: number, len: number): V3 => { const ang = dialAngle(val, max); return [DIAL.x - Math.sin(ang) * len, DIAL.y + Math.cos(ang) * len, ROPE_Z + .1]; };
  const [cx, cy] = Pj([DIAL.x, DIAL.y, ROPE_Z + .1]), [tx, ty] = Pj(tip(v, .7));
  brush(g, linePts(cx, cy, tx, ty), { color: C.gold, width: 7, dash: [16, 12], seed, jitter: 1, passes: 1, alpha: a });
  g.save(); g.globalAlpha = a; g.fillStyle = C.gold; g.beginPath(); g.arc(tx, ty, 11, 0, 7); g.fill(); g.restore();
  if (label) { const [lx, ly] = Pj(tip(max / 2, 1.22)); chalk(g, label, lx, ly, a, { size: 32, color: C.gold, align: 'center' }); }
}
function bars(g: G, x: number, y: number, title: string, rows: [string, number, number][], t: number, a: number, labelW: number, f: number) {
  chalk(g, title, x, y, a, { size: 32 });
  rows.forEach(([n, v, t0], i) => {
    const k = sm(t, t0, .35, out) * a; if (k <= 0) return;
    const by = y + 48 + i * 50, w = 320 * v / 100 * sm(t, t0, .35, out);
    chalk(g, n, x, by + 24, k, { size: 30 });
    g.save(); g.globalAlpha = k * .85; g.fillStyle = C.amber; g.fillRect(x + labelW, by, w, 30); g.restore();
    brush(g, [[x + labelW, by], [x + labelW + w, by], [x + labelW + w, by + 30], [x + labelW, by + 30], [x + labelW, by]], { color: C.chalk, width: 3, seed: 40 + i + f * 3, jitter: 1.5, passes: 1, alpha: k });
    chalk(g, `${v}%`, x + labelW + 12 + w, by + 26, k, { size: 30, weight: 700, color: C.gold });
  });
}

/** Per-person share in Act I, as the arrows show it. */
function share(t: number) {
  let v = 100;
  v += (93 - v) * sm(t, 13.6, .5); v += (85 - 93) * sm(t, 15.75, .5); v += (49 - 85) * sm(t, 18.6, .6);
  return v;
}
function marks(c: G, t: number, W: World, Pj: (q: V3) => [number, number, boolean]) {
  const f = frame12(t), act = actOf(t), PSs = puppetsAt(t);
  const head = (i: number, dy = 0): [number, number] => { const s = PSs[i]!, h = W.puppets[i].h; const [x, y] = Pj([s.x - Math.sin(s.tilt) * 2.2 * h, (2.75 + dy) * h, s.z]); return [x, y]; };

  if (act === 1 && t >= 6.8 && t < 22.8) {   // S02–S04: force arrows above the pullers
    const rel = 1 - sm(t, 22.35, .3, ease.linear), many = sm(t, 17.9, .4), sh = share(t);
    SPOTS.forEach((_, i) => {
      const lean = ramp(t, STEP_IN[i]! + .75, .3, out); if (lean <= 0) return;
      const [x, y] = head(i), s = lerp(1, .62, many);
      forceArrow(c, x - lerp(110, 70, many), y - lerp(30, 22, many), sh / 100, t < 17.9 ? String(Math.round(sh)) : '', s, lean * rel, 500 + i * 11 + f * 3);
    });
  }
  if (t >= 10.9 && t < 12.5) {   // "一個人出一百分的力"
    const [x, y] = Pj([DIAL.x - 1.25, DIAL.y + .15, ROPE_Z]); chalk(c, '100', x, y, fadeIn(t, 10.9, 12.5), { size: 60, weight: 700, color: C.gold, align: 'center' });
  }
  // the dashed "should read" needle
  if (t >= 13.45 && t < 22.5) {
    const v = t < 15.6 ? 200 : t < 18.3 ? 300 : 800;
    ghostNeedle(c, Pj, v, 800, `應該要有 ${v}`, fadeIn(t, 13.45, 22.5, .2, .3), 600 + f * 2);
  }
  if (t >= 38.6 && t < 40.35) ghostNeedle(c, Pj, 100, 800, '一個人時：100', fadeIn(t, 38.6, 40.35, .25, .25), 610 + f * 2);
  if (t >= 45.0 && t < 48.9) ghostNeedle(c, Pj, 100, 100, '自己喊：100', fadeIn(t, 45.0, 48.9, .25, .3), 620 + f * 2);
  if (t >= 51.0 && t < 54.95) ghostNeedle(c, Pj, 800, 800, '', fadeIn(t, 51.0, 54.95, .3, .2), 630 + f * 2);
  // S04: Ringelmann's own numbers in chalk
  if (t >= 19.0 && t < 22.5) bars(c, 980, 175, '每人平均出力', [['1 人', 100, 19.0], ['2 人', 93, 19.3], ['3 人', 85, 19.6], ['8 人', 49, 19.9]], t, 1 - sm(t, 22.2, .3, ease.linear), 92, f);
  // S07: dashed rings round the fakes
  if (t >= 35.3 && t < 37.4) {
    const a = fadeIn(t, 35.3, 37.4);
    [1, 2, 3].forEach(i => { const [x, y] = head(i, -.55); brush(c, partial(arcPts(x, y, 62, 62, -1.6, 4.7, 28), sm(t, 35.3 + i * .1, .3)), { color: C.chalk, width: 4, dash: [10, 10], seed: 700 + i + f, jitter: 1, passes: 1, alpha: a }); });
    const [x, y] = head(2, -.55); chalk(c, '假裝在拉', x, y - 84, a, { align: 'center' });
  }
  // S08: shouting, the believed partners, the volume bars
  if (t >= 41.6 && t < 48.9) {
    const vol = needle(t, SOUND) / 100, [x, y] = head(0, -.5), beat = PSs[0]!.shout, a = fadeIn(t, 41.6, 48.9, .2, .3);
    const nArcs = beat > .9 ? 3 : 2;
    for (let i = 0; i < nArcs; i++) brush(c, arcPts(x + 70, y, (40 + i * 34) * vol, (40 + i * 34) * vol, -.6, .6, 12), { color: C.amber, width: 7, seed: 800 + i + f * 3, jitter: 1.2, alpha: a });
  }
  if (t >= 42.0 && t < 49.0) bars(c, 150, 250, '每人平均音量', [['自己喊', 100, 42.0], ['以為 2 人', 82, 45.1], ['以為 6 人', 74, 46.1]], t, 1 - sm(t, 48.7, .3, ease.linear), 150, f);
  if (t >= 47.8 && t < 49.0) chalk(c, '社會懈怠', 1240, 330, fadeIn(t, 47.8, 49.0, .2, .25), { size: 64, weight: 700, color: C.gold });
  // S09: one number for eight people
  if (t >= 50.8 && t < 55.0) {
    const a = 1 - sm(t, 54.7, .3, ease.linear);
    PSs.forEach((_, i) => {
      const t0 = 50.8 + i * .15; if (step(t) < t0) return;
      const [x, y] = head(i, -.15), pop = [.5, 1.15, 1][Math.min(2, Math.floor((step(t) - t0) * 12))]!;
      chalk(c, '?', x, y - 20, a * (i === 5 && t > 53.6 ? .3 : .9), { size: 70 * pop, family: SERIF, weight: 700, align: 'center' });
    });
    const [dx, dy] = Pj([DIAL.x, DIAL.y, ROPE_Z]);
    chalk(c, '8 個人，只有 1 個數字', dx - 760, dy - 250, fadeIn(t, 51.4, 55.0, .35, .3), { size: 40 });
    if (t >= 53.7) { const [x, y] = head(5, .3); chalk(c, '沒差？', x, y - 40, fadeIn(t, 53.7, 55.0, .3, .3), { size: 38, color: C.gold, align: 'center' }); }
  }
  // S11: every dial reads 100
  if (act === 5 && t < 67.8) {
    const a = 1 - sm(t, 67.2, .4, ease.linear);
    W.minis.forEach((_: World, i: number) => {
      const t0 = 65.75 + i * .2; if (t < t0) return;
      const [x, y] = Pj([XS3[i]! + 1.55 - .9 * MINI, DIAL.y * MINI + ROPE_Y * (1 - MINI) + .75, ROPE_Z]);
      const k = sm(t, t0, .25) * a;
      chalk(c, '100', x - 22, y, k, { size: 46, weight: 700, color: C.gold, align: 'center' });
      brush(c, partial([[x + 24, y - 17], [x + 36, y - 3], [x + 62, y - 36]], sm(t, t0 + .1, .2, ease.linear)), { color: C.gold, width: 7, seed: 700 + i * 3 + f * 2, jitter: 1.2, passes: 1, alpha: k });   // a hand-drawn tick
    });
  }
}

// ---------------------------------------------------------------- transitions between the stage and the 2D flats
function transitions(c: G, t: number, Pj: (q: V3) => [number, number, boolean]) {
  const iris = (k: number, draw: (g: G) => void) => {
    const [cx, cy] = Pj([DIAL.x, DIAL.y, ROPE_Z + .05]), [ex] = Pj([DIAL.x + DIAL.r, DIAL.y, ROPE_Z + .05]);
    const r0 = Math.abs(ex - cx), R = lerp(r0, 1250, k);
    c.save(); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.clip(); c.translate(cx * (1 - k) + 960 * k - 960, cy * (1 - k) + 540 * k - 540); draw(c); c.restore();
    c.save(); c.strokeStyle = 'rgba(154,116,56,.9)'; c.lineWidth = 14 * (1 - k * .6); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke(); c.restore();
  };
  if (t >= IRIS_OPEN[0] && t < IRIS_OPEN[1]) iris(sm(t, IRIS_OPEN[0], IRIS_OPEN[1] - IRIS_OPEN[0], inC), g => fullS06(g, t));
  if (t >= IRIS_CLOSE[0] && t < IRIS_CLOSE[1]) iris(1 - sm(t, IRIS_CLOSE[0], IRIS_CLOSE[1] - IRIS_CLOSE[0], out), g => fullS06(g, t));
  const flat = (y: number) => {
    c.save(); c.fillStyle = 'rgba(20,12,6,.45)'; c.fillRect(0, y + 1080, 1920, 26); c.translate(0, y); fullS10(c, t); c.restore();
    c.save(); c.translate(0, y); for (const x of [380, 1540]) { c.fillStyle = '#E9E2D6'; c.fillRect(x - 1, -1200, 2, 1200); } c.restore();
  };
  if (t >= DROP[0] && t < DROP[1]) { const u = (step(t) - DROP[0]) / (DROP[1] - DROP[0]); flat(-1080 * (1 - outBack(clamp(u)))); }
  if (t >= LIFT[0] && t < LIFT[1]) flat(-1100 * ramp(t, LIFT[0], LIFT[1] - LIFT[0], inC));
}

// ---------------------------------------------------------------- full-frame 2D shots
function kick2D(g: G, s: string, x: number, y: number, a: number) { text(g, s, x, y, { ...T.kicker, color: C.amberInk, alpha: a }); g.save(); g.globalAlpha = a; g.fillStyle = C.amberInk; g.fillRect(x, y + 22, 60, 3); g.restore(); }
/** 2D twine: two plies, a diagonal twist every 14 px. */
function rope2D(g: G, pts: [number, number][], w: number, seed: number, a = 1) {
  if (pts.length < 2) return;
  brush(g, pts, { color: '#8A6236', width: w + 6, seed, jitter: .5, passes: 1, alpha: a });
  brush(g, pts, { color: '#C9A877', width: w, seed, jitter: .5, passes: 1, alpha: a });
  g.save(); g.globalAlpha = a * .55; g.strokeStyle = 'rgb(90,60,30)'; g.lineWidth = 3;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!, [x1, y1] = pts[i]!, L = Math.hypot(x1 - x0, y1 - y0), nn = Math.max(1, Math.floor(L / 14));
    for (let k = 0; k < nn; k++) { const u = k / nn, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u; g.beginPath(); g.moveTo(x - w * .3, y + w * .45); g.lineTo(x + w * .3, y - w * .45); g.stroke(); }
  }
  g.restore();
}
const bezPts = (a: [number, number], b: [number, number], cc: [number, number], d: [number, number], n = 30): [number, number][] => Array.from({ length: n + 1 }, (_, i) => { const u = i / n, v = 1 - u; return [v ** 3 * a[0] + 3 * v * v * u * b[0] + 3 * v * u * u * cc[0] + u ** 3 * d[0], v ** 3 * a[1] + 3 * v * v * u * b[1] + 3 * v * u * u * cc[1] + u ** 3 * d[1]]; });

/** S06: Ringelmann's guess — three people's effort curves out of step; the sum is lower than if they had peaked together. */
function fullS06(g: G, t: number) {
  const f = frame12(t);
  g.drawImage(PAPER[0]!, 0, 0);
  kick2D(g, 'COORDINATION LOSS · 協調損失？', 150, 92, sm(t, 27.9, .4, ease.linear));
  text(g, '是不是，大家用力的時間對不上？', 960, 165, { size: 60, family: SERIF, weight: 700, color: C.ink, tracking: 6, align: 'center', alpha: sm(t, 28.1, .4, ease.linear) });
  const x0 = 300, x1 = 1640, gauss = (u: number, p: number) => Math.exp(-((u - p) ** 2) / .012);
  (['甲', '乙', '丙'] as const).forEach((nm, i) => {
    const peak = [.18, .42, .66][i]!, y = 300 + i * 150, k = sm(t, 28.3 + i * .4, .55, ease.inOutSine);
    if (k <= 0) return;
    brush(g, linePts(x0, y + 50, x1, y + 50, 6), { color: 'rgba(44,40,36,.25)', width: 2, passes: 1, jitter: .5 });
    const pts = Array.from({ length: 81 }, (_, s) => [x0 + (x1 - x0) * s / 80, y + 50 - 95 * gauss(s / 80, peak)] as [number, number]);
    brush(g, partial(pts, k), { color: C.ink, width: 6, seed: 80 + i + f * 3, jitter: 1.2 });
    text(g, nm, x0 - 80, y + 64, { size: 40, family: SERIF, weight: 700, color: C.ink, alpha: sm(t, 28.3 + i * .4, .3, ease.linear) });
    if (k >= 1) { const px = x0 + (x1 - x0) * peak; brush(g, linePts(px, y - 50, px, y + 50, 4), { color: C.amber, width: 3, dash: [8, 8], passes: 1, jitter: .5 }); }
  });
  const y = 840, ka = sm(t, 29.7, .5, ease.inOutSine), kr = sm(t, 30.1, .6, ease.inOutSine);
  if (ka > 0) {
    brush(g, linePts(x0, y, x1, y, 6), { color: 'rgba(44,40,36,.25)', width: 2, passes: 1, jitter: .5 });
    text(g, '合力', x0 - 120, y + 14, { size: 40, family: SERIF, weight: 700, color: C.ink, alpha: ka });
    const ideal = Array.from({ length: 81 }, (_, s) => [x0 + (x1 - x0) * s / 80, y - 62 * 3 * gauss(s / 80, .42)] as [number, number]);
    brush(g, partial(ideal, ka), { color: C.amberInk, width: 5, dash: [14, 12], seed: 90 + f, jitter: 1, passes: 1 });
  }
  if (kr > 0) {
    const real = Array.from({ length: 81 }, (_, s) => { const u = s / 80; return [x0 + (x1 - x0) * u, y - 62 * (gauss(u, .18) + gauss(u, .42) + gauss(u, .66))] as [number, number]; });
    brush(g, partial(real, kr), { color: C.red, width: 7, seed: 91 + f * 3, jitter: 1.2 });
  }
  const la = sm(t, 30.4, .4, ease.linear);
  if (la > 0) {
    brush(g, linePts(1290, 236, 1370, 236, 4), { color: C.amberInk, width: 5, dash: [14, 12], passes: 1, jitter: .5, alpha: la });
    text(g, '三個人同時用力', 1390, 247, { size: 30, family: SANS, weight: 500, color: C.amberInk, alpha: la });
    brush(g, linePts(1290, 286, 1370, 286, 4), { color: C.red, width: 7, passes: 1, jitter: .8, alpha: la });
    text(g, '時間錯開：頂點變低', 1390, 297, { size: 30, family: SANS, weight: 500, color: C.red, alpha: la });
  }
  rope2D(g, [[0, 1000], [1920, 1000]], 20, 3);   // the same rope runs underneath
}

/** S10: the rope unravels into four strands; each tag is named as the narration says it. */
function fullS10(g: G, t: number) {
  const f = frame12(t);
  g.drawImage(PAPER[1]!, 0, 0);
  kick2D(g, 'KARAU & WILLIAMS · 1993 · 78 篇研究', 150, 92, sm(t, 55.8, .4, ease.linear));
  text(g, '偷懶會變少的四個條件', 150, 190, { size: 60, family: SERIF, weight: 700, color: C.ink, tracking: 6, alpha: sm(t, 56.4, .4, ease.linear) });
  const knot: [number, number] = [560, 600];
  rope2D(g, partial(linePts(-40, 600, knot[0], 600, 30), sm(t, 55.45, 1.1, out)), 30, 1);
  const tags: [string, string][] = [['看得見', '每個人的貢獻\n能被分辨'], ['有意義', '任務對自己\n是重要的'], ['小一點', '團隊人數\n不要太多'], ['彼此在乎', '和在乎的人\n一起做']];
  tags.forEach(([nm, s], i) => {
    const t0 = TAGT[i]!, ty = 300 + i * 175, kk = sm(t, t0 - .3, .4, ease.inOutSine);
    if (kk <= 0) return;
    rope2D(g, partial(bezPts(knot, [800, 600], [900, ty], [1230, ty], 30), kk), 14, 10 + i);
    const pose3 = Math.min(1, Math.floor(clamp((step(t) - t0 + .1) / .25) * 3) / 3);
    if (pose3 <= 0) return;
    const tx = 1250, tw = 520, th = 140;
    g.save(); g.translate(tx, ty); g.scale(1, pose3); g.rotate((i % 2 ? 1 : -1) * .012); g.translate(0, -th / 2);
    g.fillStyle = 'rgba(60,40,20,.22)'; g.fillRect(10, 12, tw, th);
    g.fillStyle = i === 0 ? '#E4C06C' : '#F6F0E4'; g.fillRect(0, 0, tw, th);
    g.strokeStyle = 'rgba(120,90,55,.35)'; g.lineWidth = 2; g.strokeRect(0, 0, tw, th);
    g.restore();
    if (pose3 >= 1) {
      text(g, nm, tx + 36, ty + 18, { size: 52, family: SERIF, weight: 700, color: C.ink });
      s.split('\n').forEach((l, k) => text(g, l, tx + 300, ty - 12 + k * 36, { size: 26, family: SANS, weight: 500, color: '#5A4F44' }));
    }
    g.save(); g.fillStyle = '#9a7438'; g.beginPath(); g.arc(tx + 10, ty, 12, 0, 7); g.fill(); g.restore();
  });
  if (t >= 56.4) {
    const kn = sm(t, 56.4, .3, out);
    g.save(); g.globalAlpha = kn; g.fillStyle = '#8A6236'; g.beginPath(); g.ellipse(knot[0], knot[1], 34, 26, 0, 0, 7); g.fill(); g.fillStyle = '#C9A877'; g.beginPath(); g.ellipse(knot[0] - 4, knot[1] - 4, 24, 17, 0, 0, 7); g.fill(); g.restore();
  }
  void f;
}

// ---------------------------------------------------------------- 2D: kickers, subtitles, the opening and the end
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
  const black = Math.max(t < .8 ? (t < .2 ? 1 : 1 - .82 * at(t, .2, .5, out)) : 0, at(t, 74.2, 75.0, io));
  if (black > 0) { c.fillStyle = `rgba(10,8,6,${black})`; c.fillRect(0, 0, 1920, 1080); }
  // S12: the tagline builds phrase by phrase, then the credit
  if (t >= 67.2) {
    const k = fadeIn(t, 67.2, 74.6, .5, .4);
    const g = c.createLinearGradient(0, 760, 0, 1080); g.addColorStop(0, 'rgba(14,11,8,0)'); g.addColorStop(1, `rgba(14,11,8,${.7 * k})`); c.fillStyle = g; c.fillRect(0, 760, 1920, 320);
    c.save(); c.font = `500 48px "${SANS}"`; c.letterSpacing = '12px'; const ws = TAG.map(([, s]) => c.measureText(s).width); c.restore();
    let x = 966 - ws.reduce((s, w) => s + w, 0) / 2;
    TAG.forEach(([t0, s], i) => {
      const a = fadeIn(t, t0 - .1, 74.6, .4, .4);
      text(c, s, x, 930 + (1 - a) * 8, { ...T.tagline, align: 'left', alpha: a }); x += ws[i]!;
    });
    text(c, 'RINGELMANN EFFECT · 林格曼效應', 966, 986, { ...T.latin, alpha: fadeIn(t, 71.6, 74.6, .6, .4) });
    text(c, 'Made with Mografy', 1824, 1004, { ...T.credit, alpha: fadeIn(t, 72.2, 74.6, .6, .4) * .8 });
  }
}
