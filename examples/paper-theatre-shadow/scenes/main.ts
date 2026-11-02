// 陰影心理學｜Shadow Psychology — an 82 s, 13-shot stop-motion film in a paper theatre, timed to the
// ElevenLabs narration (assets/narration.mp3, laid 1.0 s late; cue sheet in storyboards/cues.json).
//
// The film's idea: a paper theatre on a desk. One bulb moves and the shadow answers. The shadow is cast for real
// by the 3D point light; the four trait tokens live inside it, so they travel wherever the shadow goes.
//
//  S01 點燈        0.0– 7.6  dark; the pull cord is tugged and the bulb snaps on; pull back to the giant shadow
//  S02 定義        7.6–15.4  slider along the wall + rack focus; four tokens are pinned inside the shadow's head
//  S03 形成       15.4–24.4  worm's-eye; the child; four tags drop and knock the tokens into the shadow
//  S04 人格面具   24.4–30.8  macro push-in; the mask is lowered on a wire; rack focus to the maskless shadow
//  S05 投射       30.8–37.3  overhead; another cutout slides into our shadow; the triangle pins to their chest
//  S06 線索       37.3–43.0  dolly zoom on the triangle; ripples; amber yarn runs back to our chest
//  S07 轉身       43.0–48.3  orbit; the bulb swings; the cutout turns; push through the shadow into black
//  S08–S10 三步驟 48.3–62.7  backstage truck: eye, cupped hands, two halves
//  S11 金色陰影   62.7–69.0  macro rise over four gold tokens
//  S12 完整       69.0–74.6  high angle, slow spin: the half-dark disc, the cutout on its seam
//  S13 片尾       74.6–82.0  pull back out of the proscenium: the whole theatre on a desk
//
// Motion (param `motion`): 'stop-motion' (default) samples poses and the light on 2s (12 per second) with a seeded boil
// per pose; 'smooth' moves everything every frame. The camera, focus, type and subtitles are always smooth, and every
// shot change blends focus, light and size so nothing jumps at a cut.
import { at, beats, clamp, ease, lerp, text } from '@mografy/runtime';
import type { FrameContext, SetupContext, TextStyle } from '@mografy/runtime';
import { prepareStage, type Stage, type ThreeModule } from './three.js';
import { CJK_SANS, CJK_SERIF } from './cjk.js';
import { buildWorld, makePost, FIG, STEP_X, TRAITS, type Trait, type World } from './world.js';

// ---------------------------------------------------------------- tokens
const C = { cream: '#F3EBDD', amber: '#E8A84A', muted: 'rgba(243,235,221,.72)', dim: 'rgba(243,235,221,.55)', night: '#0E0C12', bg: '#15131B' };
const T = {
  kicker: { size: 30, family: CJK_SANS, weight: 500, color: C.amber, tracking: 10 } as TextStyle,
  sub: { size: 44, family: CJK_SANS, weight: 500, color: C.cream, tracking: 2, align: 'center' } as TextStyle,
  label: { size: 36, family: CJK_SANS, weight: 500, color: C.cream } as TextStyle,
  stepNo: { size: 32, family: CJK_SANS, weight: 500, color: C.amber, tracking: 10 } as TextStyle,
  stepLatin: { size: 32, family: CJK_SANS, weight: 500, color: C.dim, tracking: 10 } as TextStyle,
  stepName: { size: 150, family: CJK_SERIF, weight: 700, color: C.cream, tracking: 12 } as TextStyle,
  stepDesc: { size: 42, family: CJK_SANS, weight: 500, color: C.muted } as TextStyle,
  gold: { size: 56, family: CJK_SERIF, weight: 700, color: C.cream, tracking: 6, align: 'center' } as TextStyle,
  goldSub: { size: 28, family: CJK_SANS, weight: 500, color: C.muted, tracking: 4, align: 'center' } as TextStyle,
  tagline: { size: 48, family: CJK_SANS, weight: 500, color: C.amber, tracking: 12, align: 'center' } as TextStyle,
  latin: { size: 24, family: CJK_SANS, weight: 500, color: C.muted, tracking: 12, align: 'center' } as TextStyle,
  credit: { size: 22, family: CJK_SANS, weight: 500, color: C.dim, tracking: 2, align: 'right' } as TextStyle,
};

// ---------------------------------------------------------------- the shot table (times follow the narration)
export const BEATS = beats([
  { title: 'S01 點燈', end: 7.6, stop: 6.8, handoff: 1.6, note: 'Crane down; the bulb pops on and the shadow appears.' },
  { title: 'S02 定義', end: 15.4, stop: 14.6, handoff: 1.2, note: 'Slider + rack focus; four tokens pinned in the shadow.' },
  { title: 'S03 形成', end: 24.4, stop: 23.6, handoff: 1.2, note: "Worm's-eye; tags knock the tokens into the child's shadow." },
  { title: 'S04 人格面具', end: 30.8, stop: 29.0, handoff: 1.4, note: 'Macro; the mask on a wire; rack focus to the shadow.' },
  { title: 'S05 投射', end: 37.3, stop: 36.6, handoff: 1.2, note: 'Overhead; the other steps into our shadow; the triangle moves.' },
  { title: 'S06 線索', end: 43.0, stop: 42.2, handoff: 1.2, note: 'Dolly zoom; ripples; the yarn runs back to us.' },
  { title: 'S07 轉身', end: 48.3, stop: 46.6, handoff: 1.0, note: 'Orbit; the bulb swings; the turn; push through the shadow.' },
  { title: 'S08 覺察', end: 53.2, stop: 52.4, handoff: 1.0, note: 'Backstage station 1: the eye.' },
  { title: 'S09 接納', end: 58.1, stop: 57.4, handoff: 1.0, note: 'Station 2: the triangle lands in the hands.' },
  { title: 'S10 整合', end: 62.7, stop: 61.4, handoff: .8, note: 'Station 3: the halves join; the seam lights.' },
  { title: 'S11 金色陰影', end: 69.0, stop: 68.4, handoff: .8, note: 'Four gold tokens on the felt.' },
  { title: 'S12 完整', end: 74.6, stop: 74.0, handoff: 1.2, note: 'The half-dark disc; the cutout on the seam.' },
  { title: 'S13 片尾', end: 82.0, stop: 79.6, note: 'Pull back: the whole theatre on a desk.' },
]);
export const meta = { width: 1920, height: 1080, duration: BEATS.duration, fps: 30, background: C.bg, shots: BEATS.shots };
export const params = {
  motion: { name: '動態 Motion', type: 'enum' as const, default: 'stop-motion', options: ['stop-motion', 'smooth'] },
};

// narration phrases (film seconds, from storyboards/cues.json) shown as subtitles
const SUBS: [number, number, string][] = [
  [1.00, 3.17, '燈亮的地方，就有影子。'], [4.04, 7.20, '榮格說：每個人，都帶著一道陰影。'],
  [7.92, 10.52, '陰影，是你不願承認的那部分自己——'], [11.18, 14.85, '憤怒、嫉妒、脆弱，和說不出口的渴望。'],
  [15.93, 16.89, '它不是天生的。'], [17.66, 20.60, '小時候，每一句「不准哭」、「不要生氣」，'], [21.12, 23.36, '都把一部分的我們，推到了身後。'],
  [25.08, 27.55, '長大以後，我們學會戴上面具，'], [27.85, 30.33, '只把討人喜歡的那一面，留給別人看。'],
  [31.13, 33.31, '但被藏起來的，並不會消失。'], [34.41, 36.89, '它會投射出去——落在別人身上。'],
  [37.65, 39.28, '當某個人特別讓你火大，'], [39.69, 42.00, '那份刺痛，常常指向你自己。'],
  [43.52, 45.53, '要停止投射，只有一個方法：'], [46.13, 47.75, '轉過身……看見它。'],
  [63.06, 64.66, '陰影裡，不只有黑暗。'], [65.15, 68.65, '憤怒裡有力量，嫉妒，指向你真正想要的。'],
  [69.36, 71.24, '目標從來不是消滅影子，'], [71.65, 74.11, '而是讓光和影，屬於同一個人。'],
];
// the three steps: [shot start, "第N步" cue, descriptor cue, no., latin, name, descriptor]
const STEPS: [number, number, number, string, string, string, string][] = [
  [48.3, 48.68, 50.66, '01', 'AWARENESS', '覺察', '留意那些讓你反應過度的時刻'],
  [53.2, 53.60, 55.38, '02', 'ACCEPTANCE', '接納', '叫出它的名字，不急著趕走它'],
  [58.1, 58.40, 60.31, '03', 'INTEGRATION', '整合', '把它的力量，收回成自己的'],
];
const KICKERS: [number, number, string][] = [
  [4.2, 7.3, 'C.G. JUNG · 分析心理學'], [9.0, 15.1, 'THE SHADOW · 陰影'], [16.6, 24.1, 'FORMATION · 形成'],
  [25.6, 30.5, 'PERSONA · 人格面具'], [32.2, 37.0, 'PROJECTION · 投射'], [38.0, 42.7, 'TRIGGER · 線索'],
  [43.4, 47.6, 'THE TURN · 轉身'], [63.2, 68.7, 'GOLDEN SHADOW · 金色陰影'], [69.6, 74.3, 'WHOLENESS · 完整'],
];

// ---------------------------------------------------------------- time
const FPS_ANIM = 12;
/** 'smooth' (default) moves every frame; 'stop-motion' samples poses on 2s. Set at the top of each renderFrame from params. */
let STOP = false;
/** Pose time: on 2s in stop-motion, the real time otherwise. */
const step = (t: number) => STOP ? Math.floor(t * FPS_ANIM + 1e-6) / FPS_ANIM : t;
const io = ease.inOutCubic, out = ease.outCubic;
type V3 = [number, number, number];
const mix3 = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
/** Pop: 0 → 1.18 → 1 (three poses in stop-motion, a 0.3 s overshoot when smooth). */
const pop = (t: number, a: number) => {
  if (STOP) return t < a ? 0 : t < a + 1 / 12 ? .55 : t < a + 2 / 12 ? 1.18 : 1;
  const u = clamp((t - a) / .3); return u <= 0 ? 0 : out(u) + .2 * Math.sin(Math.PI * u) * (1 - u);
};

// ---------------------------------------------------------------- the light
const L1: V3 = [2.15, 1.15, 1.45], L3: V3 = [1.75, .55, 1.25], L7: V3 = [-1.3, 1.25, 2.2], L12: V3 = [.95, 1.55, 1.0];
const HITS = [19.1, 20.15, 21.4, 22.5];           // S03: 不准哭, 不要生氣, 不可以比較, 別想要太多
const HIT_TRAIT: Trait[] = ['ci', 'tri', 'sq', 'cr'];
function stationX(t: number) {
  const a = out(clamp((t - 52.8) / .9)), b = out(clamp((t - 57.7) / .9));
  return STEP_X[0]! + (STEP_X[1]! - STEP_X[0]!) * io(a) + (STEP_X[2]! - STEP_X[1]!) * io(b);
}
function lampAt(t: number): { p: V3; k: number } {
  if (t < 15.4) return { p: L1, k: t < .8 ? 0 : 1 };  // pitch black, then the bulb snaps on at 0.8
  if (t < 24.4) { const n = HITS.reduce((a, h) => a + (STOP ? (t >= h ? 1 : 0) : io(clamp((t - h) / .35))), 0); return { p: mix3(L1, L3, n / 4), k: 1 }; }
  if (t < 25.0) return { p: mix3(L3, L1, io(clamp((step(t) - 24.4) / .6))), k: 1 };
  if (t < 43.2) return { p: L1, k: 1 };
  if (t < 48.3) { const u = io(clamp((t - 43.2) / 2.4)); const p = mix3(L1, L7, u); p[1] += Math.sin(Math.PI * u) * .55; return { p, k: 1 }; }
  if (t < 62.7) { const x = stationX(t); return { p: [x + .9, 2.7, 1.5], k: .78 }; }
  if (t < 69.0) return { p: [2.5, 3.2, 2.6], k: 1.18 };
  return { p: L12, k: .9 };
}
/** Where a point lands on the back wall, seen from the lamp. */
function onWall(L: V3, p: V3): [number, number] { const t = (-2.5 - L[2]) / (p[2] - L[2]); return [L[0] + (p[0] - L[0]) * t, L[1] + (p[1] - L[1]) * t]; }

// ---------------------------------------------------------------- the camera
interface Pose { p: V3; q: V3; f: number; r?: number }
const P: Record<string, Pose> = {
  bulb: { p: [2.95, 1.02, 2.95], q: [2.15, .98, 1.45], f: 30 },
  s01: { p: [4.3, 3.1, 6.9], q: [-.75, 1.45, -1.2], f: 30 },
  s02: { p: [1.5, 1.7, 2.3], q: [-1.89, 1.985, -2.5], f: 34 },
  s03: { p: [2.45, .3, 4.35], q: [.95, 1.62, -1.2], f: 39, r: -.07 },
  s04: { p: [2.25, 1.45, 2.95], q: [-.1, 1.5, -1.0], f: 30 },
  s04b: { p: [1.85, 1.46, 2.45], q: [-.1, 1.5, -1.0], f: 30 },
  s05: { p: [2.2, 4.9, 4.6], q: [-.4, .95, -.85], f: 30 },
  s07: { p: [-.6, 1.55, 3.9], q: [1.9, 1.6, -2.5], f: 34 },
  s11a: { p: [-1.2, .55, 6.0], q: [-.55, .42, 0], f: 30 },
  s11: { p: [-1.2, 1.05, 6.0], q: [-.55, .5, 0], f: 30 },
  s12: { p: [2.6, 5.2, 5.4], q: [-.35, .8, -.1], f: 30 },
  s13: { p: [2.4, 4.2, 21], q: [0, 2.25, 0], f: 24 },
};
const T6: V3 = [-.62, 1.12, -1.2], C6: V3 = [-2.2, 1.05, 6.4];
const D6 = Math.hypot(C6[0] - T6[0], C6[1] - T6[1], C6[2] - T6[2]);
const DIR6: V3 = [(C6[0] - T6[0]) / D6, (C6[1] - T6[1]) / D6, (C6[2] - T6[2]) / D6];
const vertigo = (f: number): Pose => { const d = D6 * Math.tan(8 * Math.PI / 180) / Math.tan(f / 2 * Math.PI / 180); return { p: [T6[0] + DIR6[0] * d, T6[1] + DIR6[1] * d, T6[2] + DIR6[2] * d], q: T6, f }; };
const station = (x: number, up = 0): Pose => ({ p: [x - 2.2, 1.55 + up, 4.8], q: [x - 1.25, 1.0 + up * .4, 0], f: 30 });
const blend = (a: Pose, b: Pose, k: number): Pose => ({ p: mix3(a.p, b.p, k), q: mix3(a.q, b.q, k), f: lerp(a.f, b.f, k), r: lerp(a.r ?? 0, b.r ?? 0, k) });
const move = (t: number, t0: number, t1: number, a: Pose, b: Pose, curve = io) => blend(a, b, curve(clamp((t - t0) / (t1 - t0))));
function bez3(a: V3, b: V3, c: V3, d: V3, u: number): V3 { const f = (i: 0 | 1 | 2) => (1 - u) ** 3 * a[i] + 3 * (1 - u) ** 2 * u * b[i] + 3 * (1 - u) * u * u * c[i] + u ** 3 * d[i]; return [f(0), f(1), f(2)]; }
function spinPose(a: number): Pose { const c = Math.cos(a), s = Math.sin(a), p = P.s12!.p; return { p: [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c], q: P.s12!.q, f: 30 }; }
const PUSH_Q = (() => { const [x, y] = onWall(L7, [.9, FIG.headY, .3]); return [x, y, -2.5] as V3; })();

function camera(t: number): Pose {
  if (t < 7.6) return t < 1.3 ? P.bulb! : move(t, 1.3, 4.2, P.bulb!, P.s01!, ease.inOutQuart);  // close on the bulb, then pull back
  if (t < 15.4) return move(t, 7.6, 9.4, P.s01!, P.s02!);
  if (t < 24.4) {
    const base = move(t, 15.4, 16.6, P.s02!, P.s03!);
    const hit = HITS.some(h => t >= h && t < h + 1 / 12) ? .015 : 0;  // one-pose bump on each hit
    return { ...base, r: (base.r ?? 0) + hit };
  }
  if (t < 30.8) return t < 25.6 ? move(t, 24.4, 25.6, P.s03!, P.s04!) : move(t, 26.0, 29.4, P.s04!, P.s04b!);
  if (t < 37.3) return move(t, 30.8, 32.4, P.s04b!, P.s05!);
  if (t < 43.0) return t < 38.0 ? move(t, 37.3, 38.0, P.s05!, vertigo(16)) : vertigo(lerp(16, 34, io(clamp((t - 38.0) / 2.0))));
  if (t < 48.3) {
    if (t < 46.2) { // orbit: swing round the figure from the dolly-zoom end to over the shoulder
      const u = io(clamp((t - 43.0) / 3.0)), a = vertigo(34), b = P.s07!, m = blend(a, b, u);
      return { ...m, p: [m.p[0] + Math.sin(Math.PI * u) * 1.6, m.p[1] + Math.sin(Math.PI * u) * .5, m.p[2] + Math.sin(Math.PI * u) * 2.2] };
    }
    const push: Pose = { p: [PUSH_Q[0] - .25, PUSH_Q[1], -2.25], q: [PUSH_Q[0], PUSH_Q[1], -2.7], f: 34 };
    return move(t, 47.0, 48.3, P.s07!, push, ease.inQuad);
  }
  if (t < 62.7) {
    const x = stationX(t);
    if (t < 49.4) return move(t, 48.3, 49.4, { p: [-3.4, 1.9, 6.6], q: [-1.4, 1.1, 0], f: 30 }, station(0), out);
    return t < 61.4 ? station(x) : move(t, 61.4, 62.7, station(x), station(x, .5));
  }
  if (t < 69.0) return move(t, 62.7, 66.6, P.s11a!, P.s11!, out);
  if (t < 74.6) return spinPose(lerp(-.32, .05, io(clamp((t - 69.0) / 4.6))));
  const u = io(clamp((t - 74.6) / 4.8)), a = spinPose(.05);
  return { p: bez3(a.p, [3.4, 5.8, 9], [2.6, 4.9, 16], P.s13!.p, u), q: mix3(a.q, P.s13!.q, u), f: lerp(30, P.s13!.f, u) };
}
/** Focus with every shot change blended over 0.7 s, so the depth of field never pops at a cut. */
const FOCUS_CUTS = [7.6, 15.4, 24.4, 30.8, 37.3, 43.0, 62.7, 69.0];
function focus(t: number): { at: V3; ap: number } {
  for (const b of FOCUS_CUTS) if (t >= b && t < b + .7) {
    const a = focusRaw(b - 1e-3), c = focusRaw(t), u = io((t - b) / .7);
    return { at: mix3(a.at, c.at, u), ap: lerp(a.ap, c.ap, u) };
  }
  return focusRaw(t);
}
function focusRaw(t: number): { at: V3; ap: number } {
  const wall1 = (() => { const [x, y] = onWall(L1, [.9, FIG.headY, .3]); return [x, y, -2.5] as V3; })();
  if (t < 7.6) { const u = io(clamp((t - 1.4) / 1.8)); return { at: mix3([2.15, 1.0, 1.45], [.9, .8, .3], u), ap: lerp(14, 9, u) }; }
  if (t < 15.4) return { at: mix3([.9, 1.0, .3], wall1, io(clamp((t - 9.0) / .8))), ap: 26 };
  if (t < 24.4) return { at: [1.0, .6, .5], ap: 10 };
  if (t < 30.8) return { at: mix3([.95, 1.45, .45], wall1, io(clamp((t - 29.4) / .8))), ap: 30 };
  if (t < 37.3) return { at: [-.2, .5, -.5], ap: 7 };
  if (t < 43.0) return { at: [-.83, .84, -1.2], ap: 30 };
  if (t < 48.3) return { at: mix3([.9, 1.2, .3], PUSH_Q, io(clamp((t - 45.6) / .8))), ap: 14 };
  if (t < 62.7) return { at: [stationX(t), 1, 0], ap: 16 };
  if (t < 69.0) { const g = clamp((t - 65.0) / .9, 0, 3), i = Math.min(2, Math.floor(g)), k = io(clamp((g - i) / .5)), x = lerp(i, i + 1, g >= 3 ? 1 : k); return { at: [-2.55 + x * 1.3, .66, .7 - x * .32], ap: 20 }; }
  if (t < 74.6) return { at: [0, .6, 0], ap: 7 };
  return { at: mix3([0, .6, 0], [0, 2.5, 2.8], io(clamp((t - 74.6) / 4.8))), ap: lerp(7, 5, clamp((t - 74.6) / 4.8)) };
}

// ---------------------------------------------------------------- posing the world
interface Film { stage: Stage<World>; post: ReturnType<typeof makePost> }
const OTHER_Z = -1.25, OTHER_R = .35;
function otherX(t: number) {
  if (t < 32.6) return -4.2;
  if (t < 43.0) return lerp(-4.2, -.85, out(clamp((t - 32.6) / 1.8))) + (t >= 34.4 && t < 34.4 + 1 / 12 ? .04 : 0);
  return lerp(-.85, -4.4, io(clamp((t - 43.0) / 1.0)));
}
const chestOf = (x: number): V3 => [x + .02 * Math.cos(OTHER_R) + .06 * Math.sin(OTHER_R), FIG.base + .78, OTHER_Z - .02 * Math.sin(OTHER_R) + .06 * Math.cos(OTHER_R)];

function pose(ctx: FrameContext, W: World, t: number, camPose: Pose, cam: ThreeModule) {
  // boil: a new hand-placed offset every pose in stop-motion; one fixed offset when smooth (no jitter)
  const n = STOP ? Math.floor(t * FPS_ANIM + 1e-6) : 0;
  const boil = (k: number, amt: number) => (ctx.noise(n, k) - .5) * 2 * amt;
  const inBox = t < 48.3 || t >= 69.0, backstage = !inBox;
  W.box.visible = inBox; W.shell.visible = t >= 74.6; W.desk.visible = t >= 74.6;
  W.stage2.visible = backstage; W.props.visible = t < 62.7; W.bokeh.visible = t >= 62.7 && t < 69.0;

  // light
  const L = lampAt(t), flick = STOP ? 1 + boil(91, .03) : 1 + .012 * Math.sin(t * 7.3) + .008 * Math.sin(t * 13.1);
  W.lamp.position.set(...L.p); W.lamp.rotation.set(0, 0, t >= 43.2 && t < 45.6 ? Math.sin(Math.PI * (t - 43.2) / 2.4) * -.25 : 0);
  W.light.intensity = 34 * L.k * flick; W.bulbMat.emissiveIntensity = L.k > 0 ? .4 + 8.6 * Math.min(1, L.k) * flick : 0;
  W.hemi.intensity = t < .8 ? 0 : backstage ? (t >= 62.7 ? .12 : .1) : t >= 74.6 ? .18 : .22;
  W.fill.intensity = t < .8 ? .5 : backstage ? .05 : t >= 74.6 ? .35 : .14;  // before the switch: a faint cool room light only
  // the pull cord: tugged down 0.50–0.62, held, released 0.80–1.0 (the click switches the bulb on at 0.8)
  const tug = .11 * (STOP ? (t >= .5 && t < .9 ? 1 : 0) : out(clamp((t - .5) / .12)) * (1 - io(clamp((t - .8) / .2))));
  const len = .46 + tug; W.cordStr.scale.y = len; W.cordStr.position.y = -len / 2; W.cordBead.position.y = -len;

  // me: adult, child (S03), turned (S07), on the disc (S12–)
  const childK = t < 15.4 || t >= 24.9 ? 0 : t < 24.4 ? out(clamp((t - 15.4) / .5)) : 1 - out(clamp((t - 24.4) / .5));
  const turned = t >= 46.13 && t < 69.0;
  const me = W.me; me.visible = inBox;
  if (t >= 69.0) { me.position.set(boil(1, .004), 0, boil(2, .004)); me.rotation.set(0, -.5 + boil(3, .006), 0); me.scale.setScalar(1); }
  else {
    me.position.set(.9 + boil(1, .004), 0, lerp(.3, .5, childK) + boil(2, .003)); me.scale.setScalar(lerp(1, .62, childK));
    const turn = STOP ? (t < 46.13 ? -.12 : t < 46.13 + 2 / 12 ? Math.PI * .5 : Math.PI - .25) : lerp(-.12, Math.PI - .25, io(clamp((t - 46.0) / .45)));
    me.rotation.set(0, turn + boil(3, .006), boil(4, .003));
  }
  W.eyeDot.visible = turned;
  const meS = lerp(1, .62, childK), mePos: V3 = [me.position.x, 0, me.position.z];

  // the other cutout
  const ox = otherX(t); W.other.visible = t >= 32.6 && t < 44.0;
  W.other.position.set(ox + boil(5, .003), 0, OTHER_Z); W.other.rotation.set(0, OTHER_R + boil(6, .006), 0);

  // traits: pinned tokens live inside the shadow's head and travel with it
  const head = onWall(L.p, [mePos[0], FIG.base + (FIG.headY - FIG.base) * meS, mePos[2]]);
  const OFF: Record<Trait, [number, number]> = { tri: [-.32, .3], sq: [.3, .34], ci: [-.3, -.32], cr: [.32, -.28] };
  const PIN2 = [11.18, 11.97, 12.70, 13.57];
  const ORBIT: Record<Trait, V3> = { tri: [.42, 1.15, .78], sq: [1.4, 1.2, .72], ci: [.38, .68, .86], cr: [1.46, .72, .82] };
  TRAITS.forEach((k, i) => {
    const m = W.trait[k]; m.visible = false; m.material = W.traitMat[k].paper; m.userData.pin.visible = true;
    m.material[0].emissiveIntensity = 0;
    m.rotation.set(0, 0, (i % 2 ? .08 : -.06) + boil(10 + i, .01)); m.scale.setScalar(1);
    const pinned = (x: number, y: number, s = 1) => { m.visible = true; m.position.set(x + OFF[k][0] + boil(20 + i, .004), y + OFF[k][1] + boil(30 + i, .004), -2.47); m.scale.setScalar(s); };
    if (t < 15.4) { if (t >= PIN2[i]!) pinned(head[0], head[1], Math.max(.001, pop(t, PIN2[i]!))); return; }
    if (t < 24.4) {
      const hit = HITS[HIT_TRAIT.indexOf(k)]!, rel = t - hit;
      if (t < 16.4) { // tokens leave the wall and gather round the child
        const u = out(clamp((t - 15.4) / .8)), [x0, y0] = onWall(L1, [.9, FIG.headY, .3]);
        m.visible = true; m.userData.pin.visible = false;
        m.position.set(...mix3([x0 + OFF[k][0], y0 + OFF[k][1], -2.47], ORBIT[k], u)); m.position.y += Math.sin(Math.PI * u) * .6; m.rotation.z += u * 6.3;
        return;
      }
      if (rel < 0) { m.visible = true; m.userData.pin.visible = false; m.position.set(ORBIT[k][0] + boil(40 + i, .01), ORBIT[k][1] + boil(50 + i, .01), ORBIT[k][2]); m.rotation.y = .32; return; }
      if (rel < .6) { // knocked: tumbles on an arc into the shadow, 45° per pose
        const u = step(rel) / .6, B: V3 = [head[0] + OFF[k][0], head[1] + OFF[k][1], -2.47];
        m.visible = true; m.userData.pin.visible = false;
        m.position.set(...mix3(ORBIT[k], B, u)); m.position.y += Math.sin(Math.PI * u) * .7; m.rotation.set(.3, .32 * (1 - u), (STOP ? Math.floor(rel * 12) : rel * 12) * Math.PI / 4);
        return;
      }
      pinned(head[0], head[1]); return;
    }
    if (t >= 48.3) { // Act II and III
      if (k === 'tri' && t >= 53.9 && t < 62.7) {
        const u = clamp((step(t) - 53.9) / .4), land = t >= 54.3 && t < 54.3 + 1 / 12;
        m.visible = true; m.userData.pin.visible = false; m.scale.set(1.25, land ? 1.0 : 1.25, 1.25);
        m.position.set(STEP_X[1]!, lerp(2.4, .5, u * u), .05); m.rotation.set(-.05, 0, .04);
      }
      if (t >= 62.7 && t < 69.0) {
        const a = [63.1, 63.4, 63.7, 64.0][i]!; if (t < a) return;
        const flip = STOP ? clamp((step(t) - a) * 12 / 3) : io(clamp((t - a) / .3));
        m.visible = true; m.userData.pin.visible = false; m.material = flip >= 1 ? W.traitMat[k].gold : W.traitMat[k].paper;
        m.scale.setScalar(1.45); m.position.set(-2.55 + i * 1.3, .66, .7 - i * .32);
        m.rotation.set(-.06 + boil(60 + i, .005), -.28 + i * .1 + (1 - flip) * Math.PI / 2, (i - 1.5) * .06);
      }
      return;
    }
    // S04–S07 (adult)
    if (k === 'tri' && t >= 35.3 && t < 43.6) {
      const back = clamp((step(t) - 43.0) / .6), chest = chestOf(ox), [hx, hy] = head;
      m.visible = true; m.userData.pin.visible = true; m.material[0].emissiveIntensity = .5 * (1 - back);
      const s = 1.5 * Math.max(.001, t < 35.3 + 3 / 12 ? pop(t, 35.3) : 1);
      m.scale.setScalar(lerp(s, 1, back));
      m.position.set(...mix3([chest[0], chest[1], chest[2] + .05], [hx + OFF.tri[0], hy + OFF.tri[1], -2.47], back));
      m.position.y += Math.sin(Math.PI * back) * .5; m.rotation.set(0, OTHER_R * (1 - back), .05);
      return;
    }
    pinned(head[0], head[1]);
  });

  // tags on strings (S03)
  W.tags.forEach((g: ThreeModule, i: number) => {
    const hit = HITS[i]!, hang: V3 = ([[2.45, 1.55, -1.0], [3.25, 1.3, -.8], [2.35, .95, -.6], [3.15, .7, -.4]] as V3[])[i]!;
    g.visible = t >= hit - .5 && t >= 18.5 && t < 25.2;
    const drop = out(clamp((step(t) - (hit - .5)) / .4)), lift = ease.inQuad(clamp((step(t) - (24.0 + i * .08)) / .7));
    g.position.set(hang[0], hang[1] + (1 - drop) * 2.4 + lift * 3.2, hang[2]);
    const sw = t > hit - .1 ? Math.sin((step(t) - hit + .1) * 9) * Math.exp(-(t - hit + .1) * 2.2) * .14 : 0;
    g.rotation.set(0, -.25 + i * .06, (i % 2 ? -.06 : .05) + sw);
  });

  // mask on a wire (lowered 25.9–26.4, 6 poses + bounce)
  W.mask.visible = t >= 25.9 && t < 46.13;  // the mask is gone the moment you turn to face the shadow
  const md = clamp((step(t) - 25.9) / .5), bounce = STOP ? (t >= 26.4 && t < 26.4 + 2 / 12 ? .03 : 0) : .03 * Math.sin(Math.PI * clamp((t - 26.4) / .25));
  if (t < 46.13) { W.mask.position.set(.92, FIG.headY + (1 - out(md)) * 1.4 + bounce, .36); W.mask.rotation.set(0, .28, .04 + boil(7, .01)); }
  else { W.mask.position.set(.88, FIG.headY, .24); W.mask.rotation.set(0, .28 + Math.PI, .04); }

  // ripples and yarn (S06)
  const tri = W.trait.tri.position;
  W.ripples.forEach((r: ThreeModule, i: number) => {
    r.visible = t >= 38.0 + i * .25 && t < 41.6; r.position.set(tri.x, tri.y, tri.z + .02); r.rotation.set(0, OTHER_R, 0);
    r.scale.setScalar(1 + ((n + i) % 3) * .05);
  });
  const yu = clamp((step(t) - 39.7) / 1.3) * (1 - clamp((step(t) - 42.7) / .6));
  W.yarn.visible = t >= 39.7 && t < 43.3; W.yarn.geometry.setDrawRange(0, Math.floor(yu * W.yarnSegs) * W.yarnRadial * 6);

  // backstage props
  const open = clamp((step(t) - 48.7) / .4);
  W.eyeFrame.scale.set(1, Math.max(.06, STOP ? open : io(open)), 1); W.eyeRing.visible = open > .5;
  W.iris.scale.setScalar(Math.max(.001, pop(t, 49.1)));
  const off = 1.3 * (1 - out(clamp((step(t) - 58.5) / .9)));
  W.halfL.position.set(STEP_X[2]! - .02 - off, 1.0, 0); W.halfR.position.set(STEP_X[2]! + .02 + off, 1.0, 0);
  W.seam.visible = t >= 59.5; W.mats.amber.emissiveIntensity = 2.2 * (t >= 59.5 && t < 59.5 + 3 / 12 ? 1.8 : 1);

  // the disc (S12–)
  const dOff = 1.2 * (1 - out(clamp((step(t) - 69.3) / .7)));
  W.discL.visible = W.discR.visible = t >= 69.0; W.discSeam.visible = t >= 70.0;
  W.discL.position.set(-dOff, .004, 0); W.discR.position.set(dOff, .004, 0); W.discSeam.position.set(0, .01, 0);

  // camera
  cam.fov = camPose.f; cam.position.set(...camPose.p); cam.up.set(0, 1, 0); cam.lookAt(...camPose.q); if (camPose.r) cam.rotateZ(camPose.r);
}

// ---------------------------------------------------------------- setup and frame
export async function setup(ctx: SetupContext) {
  const stage = await prepareStage(ctx, b => {
    b.renderer.shadowMap.enabled = true; b.renderer.shadowMap.type = b.THREE.PCFShadowMap;
    b.renderer.outputColorSpace = b.THREE.LinearSRGBColorSpace; b.renderer.toneMapping = b.THREE.NoToneMapping;
    b.scene.background = new b.THREE.Color(0x15131b);
    b.camera.near = .1; b.camera.far = 200;
    return buildWorld(b.THREE, b.scene, b.renderer);
  }, { fov: 30, toneMapping: 'none' });
  const post = makePost(stage.THREE, stage.renderer, ctx.width, ctx.height);
  stage.renderer.setRenderTarget(post.rt); stage.renderer.render(stage.scene, stage.camera); stage.renderer.setRenderTarget(null);
  ctx.assets.film = { stage, post } satisfies Film;
}

function project(W: World, cam: ThreeModule, p: V3): [number, number, boolean] {
  const v = W.v.set(p[0], p[1], p[2]).project(cam);
  return [(v.x + 1) / 2 * 1920, (1 - v.y) / 2 * 1080, v.z < 1];
}

export function renderFrame(ctx: FrameContext, time: number, p: { motion?: string } = {}) {
  STOP = p.motion === 'stop-motion';
  const { stage, post } = ctx.assets.film as Film, W = stage.objects, cam = stage.camera, t = time, ts = step(t);
  // 3D layer, stop-motion sampled
  // the 3D layer renders at most at 1920 × 1080: on a Retina preview the player asks for 2× (4K), which the
  // shadow pass and depth of field cannot keep up with; DOF and grain hide the upscale.
  const s3 = Math.min(ctx.renderScale, 1);
  const pw = Math.max(1, Math.round(ctx.width * s3)), ph = Math.max(1, Math.round(ctx.height * s3));
  if (stage.surface.width !== pw || stage.surface.height !== ph) stage.renderer.setSize(pw, ph, false);
  post.resize(pw, ph, ctx.width);
  cam.aspect = ctx.width / ctx.height;
  // objects, light and props move on 2s; the camera and the focus move every frame, so pans never judder
  const cp = camera(t);
  pose(ctx, W, ts, cp, cam);
  cam.updateProjectionMatrix(); cam.updateMatrixWorld(); stage.scene.updateMatrixWorld(true);
  const f = focus(t), fv = W.v2.set(...f.at).applyMatrix4(cam.matrixWorldInverse);
  post.mat.uniforms.focus.value = -fv.z; post.mat.uniforms.aperture.value = f.ap; post.mat.uniforms.seed.value = Math.floor(t * 30) % 97;
  post.render(stage.scene, cam);
  ctx.withCanvas(c => { c.imageSmoothingQuality = 'high'; c.drawImage(stage.surface, 0, 0, ctx.width, ctx.height); });

  ctx.withCanvas(c => {
    // bulb glow
    const L = lampAt(ts);
    if (L.k > 0) {
      const [x, y, front] = project(W, cam, L.p);
      if (front) { const R = 260, a = .5 * Math.min(1, L.k); c.globalCompositeOperation = 'screen'; const g = c.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, `rgba(255,190,100,${a})`); g.addColorStop(.25, `rgba(255,160,70,${a * .35})`); g.addColorStop(1, 'rgba(255,140,60,0)'); c.fillStyle = g; c.fillRect(x - R, y - R, 2 * R, 2 * R); c.globalCompositeOperation = 'source-over'; }
    }
    overlay(c, W, cam, t);
  });
}

// ---------------------------------------------------------------- 2D: type, subtitles, transitions
function fadeIn(t: number, a: number, b: number, inn = .35, outD = .3) { return at(t, a, a + inn, out) * (1 - at(t, b - outD, b, io)); }
function overlay(c: CanvasRenderingContext2D, W: World, cam: ThreeModule, t: number) {
  // top scrim + kicker
  const kick = KICKERS.find(([a, b]) => t >= a - .1 && t < b);
  if (kick) {
    const k = fadeIn(t, kick[0], kick[1]);
    const g = c.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, `rgba(14,12,18,${.5 * k})`); g.addColorStop(1, 'rgba(14,12,18,0)'); c.fillStyle = g; c.fillRect(0, 0, 1920, 300);
    text(c, kick[2], 150, 150 - (1 - k) * 6, { ...T.kicker, alpha: k });
  }
  // S02: labels beside the pinned tokens
  if (t >= 11.0 && t < 15.3) {
    const L: [string, Trait, number, number][] = [['憤怒', 'tri', -1, 11.18], ['嫉妒', 'sq', 1, 11.97], ['脆弱', 'ci', -1, 12.70], ['渴望', 'cr', 1, 13.57]];
    for (const [s, k, side, a] of L) {
      if (t < a + 1 / 12) continue;
      const p = W.trait[k].position, [x, y] = project(W, cam, [p.x, p.y, p.z]), al = at(t, a + 1 / 12, a + .35) * (1 - at(t, 15.0, 15.3));
      const lx = x + side * 74;
      c.save(); c.globalAlpha = al; c.strokeStyle = 'rgba(243,235,221,.65)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + side * 26, y); c.lineTo(lx - side * 10, y); c.stroke(); c.restore();
      text(c, s, lx, y + 13, { ...T.label, align: side < 0 ? 'right' : 'left', alpha: al });
    }
  }
  // S08–S10: the step layout
  for (const [a, cue, descAt, no, latin, name, desc] of STEPS) {
    const end = a + (no === '03' ? 4.4 : 4.9);
    if (t < a || t >= end) continue;
    const g = c.createLinearGradient(0, 0, 900, 0), sk = fadeIn(t, a, end, .4, .35);
    g.addColorStop(0, `rgba(14,12,18,${.6 * sk})`); g.addColorStop(1, 'rgba(14,12,18,0)'); c.fillStyle = g; c.fillRect(0, 0, 900, 1080);
    const k1 = fadeIn(t, cue - .1, end), k2 = fadeIn(t, descAt - .1, end);
    text(c, `No.${no}`, 150, 420, { ...T.stepNo, alpha: k1 }); text(c, latin, 300, 420, { ...T.stepLatin, alpha: k1 });
    text(c, name, 142, 600 + (1 - k1) * 10, { ...T.stepName, alpha: k1 });
    text(c, desc, 150, 690 + (1 - k2) * 8, { ...T.stepDesc, alpha: k2 });
    for (let i = 0; i < 3; i++) { c.globalAlpha = k1; c.fillStyle = i === +no - 1 ? C.amber : 'rgba(243,235,221,.2)'; c.beginPath(); c.roundRect(150 + i * 64, 760, 48, 6, 3); c.fill(); }
    c.globalAlpha = 1;
  }
  // S11: what each token holds
  if (t >= 65.0 && t < 69.0) {
    const L: [string, string, Trait, number][] = [['力量', '來自 憤怒', 'tri', 65.15], ['方向', '來自 嫉妒', 'sq', 66.5], ['連結', '來自 脆弱', 'ci', 67.2], ['熱情', '來自 渴望', 'cr', 67.6]];
    for (const [a, b, k, s] of L) {
      const p = W.trait[k].position, [x, y] = project(W, cam, [p.x, p.y - .55, p.z]), al = fadeIn(t, s, 68.9, .4, .3);
      text(c, a, x, y + 10 + (1 - al) * 8, { ...T.gold, alpha: al }); text(c, b, x, y + 60, { ...T.goldSub, alpha: al });
    }
  }
  // subtitles
  const subOn = SUBS.some(([a, b]) => t >= a - .15 && t < b + .6);
  if (subOn) { const g = c.createLinearGradient(0, 780, 0, 1080); g.addColorStop(0, 'rgba(14,12,18,0)'); g.addColorStop(1, 'rgba(14,12,18,.55)'); c.fillStyle = g; c.fillRect(0, 780, 1920, 300); }
  SUBS.forEach(([a, b, s], i) => {
    const next = SUBS[i + 1]?.[0] ?? Infinity, end = Math.min(b + .6, next - .08);
    if (t < a - .15 || t > end) return;
    const k = at(t, a - .15, a + .1, out) * (1 - at(t, end - .18, end, io));
    c.save(); c.shadowColor = 'rgba(10,8,14,.6)'; c.shadowBlur = 16; text(c, s, 960, 1000 + (1 - k) * 8, { ...T.sub, alpha: k }); c.restore();
  });
  // transitions: into the shadow (black), the seam flash, the dip back to the box, the end
  const black = Math.max(t < .8 ? (t < .2 ? 1 : 1 - .8 * at(t, .2, .5, out)) : 0, at(t, 47.75, 48.3, ease.inQuad) * (1 - at(t, 48.3, 48.9, out)), at(t, 68.6, 69.0, io) * (1 - at(t, 69.0, 69.5, out)), at(t, 81.2, 82.0, io));
  if (black > 0) { c.fillStyle = `rgba(10,8,14,${black})`; c.fillRect(0, 0, 1920, 1080); }
  const flash = at(t, 62.35, 62.7, ease.inQuad) * (1 - at(t, 62.7, 63.2, out));
  if (flash > 0) { c.globalCompositeOperation = 'screen'; c.fillStyle = `rgba(255,200,120,${flash * .85})`; c.fillRect(0, 0, 1920, 1080); c.globalCompositeOperation = 'source-over'; }
  // S13: tagline and credit
  if (t >= 74.8) {
    const k = fadeIn(t, 74.85, 81.3, .5, .4), k2 = fadeIn(t, 76.2, 81.3, .6, .4);
    const g = c.createLinearGradient(0, 760, 0, 1080); g.addColorStop(0, 'rgba(14,12,18,0)'); g.addColorStop(1, `rgba(14,12,18,${.7 * k})`); c.fillStyle = g; c.fillRect(0, 760, 1920, 320);
    text(c, '與你的影子，和解', 966, 930 + (1 - k) * 8, { ...T.tagline, alpha: k });
    text(c, 'SHADOW PSYCHOLOGY · C.G. JUNG', 966, 986, { ...T.latin, alpha: k2 });
    text(c, 'Made with Mografy', 1824, 1004, { ...T.credit, alpha: fadeIn(t, 78.0, 81.3, .6, .4) * .8 });
  }
}
