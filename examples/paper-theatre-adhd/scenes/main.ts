// 不聽使喚的燈｜ADHD — an 85 s, 13-shot stop-motion film in the same desk paper theatre as 陰影心理學, 格式塔心理學 and
// 林格曼效應, timed to the ElevenLabs narration (assets/narration-adhd.mp3, laid 1.4 s late; storyboards/cues.json).
//
// The film's idea: a paper puppet pulls a rope to bring a theatre spotlight back to where it wants the light. The gold
// dashed ring (2D) is where the puppet wants to look; the real 3D light is what is actually lit. The gap between them runs
// through the film: widest in S02, close in S11, almost overlapping (never quite) in S13.
//
//  S01 亮燈        0.0– 7.2  dark; the lamp snaps on; pull back and tilt down the beam to the puppet and the report
//  S02 光滑走       7.2–13.2  the light slides to the window, the rope cannot bring it back; then it sticks on the TV
//  S03 標籤        13.2–17.7  low angle: the labels drop onto the puppet; the last one turns round and is blank
//  S04 忽快忽慢     17.7–22.9  ink stage: along two punched tapes, then the wall of 319; the ADHD tape's long gaps
//  S05 後台        22.9–28.3  the curtain opens onto backstage notes; the dimmer pushes it down
//  S06 漏光        28.3–35.8  section view: a narrow slit, a thin warm leak reaches the report
//  S07 遠處的獎勵   35.8–42.6  dolly zoom along a rail: the trophy shrinks faster than perspective; the dashed outline stays
//  S08 鎖燈        42.6–49.5  the pin drops, cups pile up, the sky turns; pull back: others are locked too
//  S09 坐好        49.5–56.9  feet clamped, strips fall; released, feet swing, a few more stay. The light never moves
//  S10 舞台底下     56.9–62.8  down through the floor: genes, environment, brain development; a tiny card falls
//  S11 工具箱      62.8–69.5  a helper, a toolbox of labels, a pulley: the light obeys better, and still slips
//  S12 三張清單     69.5–76.5  from above, three cards turn over and are pinned
//  S13 片名        76.5–85.0  long pull back to the whole theatre; the light still wobbles near the ring
//
// Motion (param `motion`): 'stop-motion' (default) poses puppets, props, rope and the lamp on 2s; 'smooth' moves them every
// frame. The camera, focus, 2D layers and type are always smooth.
import { at, beats, clamp, ease, lerp, text } from '@mografy/runtime';
import type { FrameContext, SetupContext, TextStyle } from '@mografy/runtime';
import { prepareStage, type Stage, type ThreeModule } from './three.js';
import { bake, buildWorld, loadBaked, storeBaked, makePost, rng, tapePositions, SANS, SERIF, TRACK, type V3, type World } from './world.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type G = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Film = { stage: Stage<World>; post: any };
type Draw = (c: G, Pj: (q: V3) => [number, number, boolean]) => void;

// ---------------------------------------------------------------- tokens
const C = { cream: '#F3EBDD', amber: '#E8A84A', gold: '#E4C06C', ink: '#3A2410', muted: 'rgba(243,235,221,.74)', dim: 'rgba(243,235,221,.55)', bg: '#14110E' };
const T = {
  kicker: { size: 30, family: SANS, weight: 500, color: C.amber, tracking: 10 } as TextStyle,
  sub: { size: 44, family: SANS, weight: 500, color: C.cream, tracking: 2, align: 'center' } as TextStyle,
  note: { size: 30, family: SANS, weight: 500, color: C.cream, tracking: 3 } as TextStyle,
  chalk: { size: 32, family: SANS, weight: 500, color: C.gold, tracking: 2 } as TextStyle,
  end: { size: 26, family: SANS, weight: 500, color: C.muted, tracking: 3, align: 'center' } as TextStyle,
  credit: { size: 22, family: SANS, weight: 500, color: C.dim, tracking: 2, align: 'right' } as TextStyle,
};

export const BEATS = beats([
  { title: 'S01 亮燈', end: 7.2, stop: 6.0, handoff: 1.0, note: 'The lamp snaps on; pull back and tilt down the beam to the puppet and the report.' },
  { title: 'S02 光滑走', end: 13.2, stop: 12.9, handoff: .8, note: 'The light slides away; the rope cannot bring it back; then it locks on the TV until dawn.' },
  { title: 'S03 標籤', end: 17.7, stop: 17.3, handoff: .35, note: 'Labels drop on the puppet; the last turns round, blank.' },
  { title: 'S04 忽快忽慢', end: 22.9, stop: 22.2, handoff: .6, note: 'Two punched tapes, then the wall of 319: long gaps now and then.' },
  { title: 'S05 後台', end: 28.3, stop: 27.9, handoff: .35, note: 'Curtain opens on the backstage notes; the dimmer pushes down.' },
  { title: 'S06 漏光', end: 35.8, stop: 35.4, handoff: .35, note: 'Section view: a narrow slit leaks a thin warm light onto the report.' },
  { title: 'S07 遠處的獎勵', end: 42.6, stop: 42.2, handoff: .35, note: 'The trophy shrinks faster than perspective; the dashed outline keeps its size.' },
  { title: 'S08 鎖燈', end: 49.5, stop: 49.1, handoff: .35, note: 'Pin drops, cups pile up, dawn; pull back: others are locked too.' },
  { title: 'S09 坐好', end: 56.9, stop: 56.4, handoff: .5, note: 'Clamped feet, falling strips; free feet, a few more stay. The light does not move.' },
  { title: 'S10 舞台底下', end: 62.8, stop: 62.4, handoff: .35, note: 'Under the stage: genes, environment, brain development; a tiny card falls.' },
  { title: 'S11 工具箱', end: 69.5, stop: 69.1, handoff: .35, note: 'Helper, toolbox of labels, pulley: closer, and it still slips.' },
  { title: 'S12 三張清單', end: 76.5, stop: 76.1, handoff: .35, note: 'Three cards turn over and are pinned, one per phrase.' },
  { title: 'S13 片名', end: 85.0, stop: 81.0, note: 'Long pull back; title on the proscenium; the light never quite reaches the ring.' },
]);
export const meta = { width: 1920, height: 1080, duration: BEATS.duration, fps: 30, background: C.bg, shots: BEATS.shots };
export const params = {
  motion: { name: '動態 Motion', type: 'enum' as const, default: 'stop-motion', options: ['stop-motion', 'smooth'] },
};

// narration phrases shown as subtitles (film seconds, from storyboards/cues.json)
const SUBS: [number, number, string][] = [
  [1.60, 3.26, '舞台上有一盞聚光燈。'], [3.75, 4.75, '它照到哪裡，'], [4.97, 5.94, '你就看見哪裡。'],
  [7.44, 8.56, '報告明天要交，'], [8.88, 9.85, '燈一直滑走。'], [10.62, 11.73, '影集看到天亮，'], [11.91, 12.90, '它卻動也不動。'],
  [13.40, 14.75, '很多人說這是懶。'], [15.47, 17.43, '研究看到的，不太一樣。'],
  [17.95, 19.55, '三百多項研究整理出：'], [19.94, 22.59, 'ADHD 的反應，更容易忽快忽慢。'],
  [23.20, 24.21, '大腦有個後台，'], [24.49, 25.52, '發呆時最亮。'], [26.03, 28.01, '開始做事，它本該暗下來。'],
  [28.59, 29.78, '兒少腦造影看到，'], [30.11, 32.94, 'ADHD 的前後台平均分得較不開。'], [33.26, 34.10, '差異很小，'], [34.37, 35.48, '只是線索之一。'],
  [36.19, 37.57, '獎勵也有距離。'], [38.12, 40.11, '對不少有 ADHD 的人來說，'], [40.32, 42.32, '遠處的大獎，縮得特別快。'],
  [42.93, 44.23, '有時燈鎖住不動，'], [44.56, 45.88, '一抬頭，天亮了。'], [46.36, 47.48, '這叫過度專注，'], [47.75, 49.13, '不是 ADHD 獨有。'],
  [49.79, 51.13, '至於那句「坐好」：'], [51.70, 52.84, '一項小型研究裡，'], [53.02, 55.18, '有 ADHD 的男孩動得多時，'], [55.36, 56.65, '記憶題答得更好。'],
  [57.12, 59.96, '基因、環境、大腦發展一起作用。'], [60.36, 62.43, '一句「不夠努力」解釋不了。'],
  [63.08, 66.55, '藥物、心理治療、環境調整，都是選項。'], [67.04, 69.24, '怎麼搭配，找專業人員一起看。'],
  [69.80, 71.89, '偶爾分心，不等於 ADHD。'], [72.39, 73.89, '要看是否從小就有、'], [74.12, 76.17, '跨場合，而且影響生活。'],
  [77.39, 78.87, '這盞燈不是不亮。'], [79.31, 80.07, '只是，'], [80.55, 81.38, '比較難調度。'],
];
// kickers: from, to, line, second line, right-aligned, y
const KICKERS: [number, number, string, string?, boolean?, number?][] = [
  [18.15, 22.5, 'KOFLER ET AL. · 2013 · 319 項研究', '注意力不足過動症（ADHD）'],
  [23.5, 27.8, 'DEFAULT MODE NETWORK', '預設模式網路'],
  [28.7, 35.4, 'NORMAN ET AL. · 2023 · 兒少腦造影', undefined, true],
  [36.3, 42.2, 'JACKSON & MACKILLOP · 2016 · 延遲折扣'],
  [46.4, 49.2, 'HUPFELD 2019 · GROEN 2020 · 過度專注', undefined, true, 210],
  [50.0, 56.5, 'SARVER ET AL. · 2015', '29 名 ADHD 男孩'],
];
// paper flats that cover a set change: from, to, direction, sheet (cover is complete at the midpoint = the shot boundary)
const FLATS: [number, number, 'down' | 'up' | 'left' | 'right', number][] = [
  [17.35, 18.05, 'down', 3], [27.95, 28.65, 'right', 2], [35.45, 36.15, 'left', 2], [42.25, 42.95, 'up', 2],
  [49.15, 49.85, 'right', 2], [62.45, 63.15, 'up', 1], [69.15, 69.85, 'left', 0], [76.15, 76.85, 'down', 1],
];

// ---------------------------------------------------------------- time
const FPS_ANIM = 12;
let STOP = false;
/** Pose time: on 2s in stop-motion, the real time otherwise. */
const step = (t: number) => STOP ? Math.floor(t * FPS_ANIM + 1e-6) / FPS_ANIM : t;
const io = ease.inOutCubic, out = ease.outCubic, inQ = ease.inQuad;
const outBack = (x: number) => { const c = 1.7; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
const mix3 = (a: readonly number[], b: readonly number[], k: number): V3 => [lerp(a[0]!, b[0]!, k), lerp(a[1]!, b[1]!, k), lerp(a[2]!, b[2]!, k)];
/** 0 → 1 over [a, a + d] on the pose clock. */
const ramp = (t: number, a: number, d: number, curve = io) => curve(clamp((step(t) - a) / d));
/** 0 → 1 over [a, a + d] on the smooth clock. */
const sm = (t: number, a: number, d: number, curve = io) => curve(clamp((t - a) / d));
/** Up and back down over [a, a + d]. */
const bump = (t: number, a: number, d: number) => { const k = clamp((step(t) - a) / d); return Math.sin(k * Math.PI); };
const frame12 = (t: number) => Math.floor(t * 12 + 1e-6);
/** Seeded on-2s tremble, ±1. */
const boil = (t: number, seed: number) => rng(frame12(t) * 31 + seed)() * 2 - 1;
const fadeIn = (t: number, a: number, b: number, i = .35, o = .3) => at(t, a, a + i, out) * (1 - at(t, b - o, b, io));

// ---------------------------------------------------------------- camera
type Cam = { p: V3; q: V3; fov: number; focus: number; ap: number; roll?: number; up?: V3 };
const c1a: Cam = { p: [.9, 3.7, 5.6], q: [.1, 5.4, 4.72], fov: 30, focus: 2.1, ap: 14 };
const c1b: Cam = { p: [.4, 3.3, 15.6], q: [0, 3.3, 3.6], fov: 30, focus: 11.9, ap: 12 };
const c1c: Cam = { ...c1b, p: [.4, 3.3, 15.2], focus: 11.6 };
const c2a: Cam = { p: [1.3, 3.3, 15.6], q: [1.4, 3.3, 3.2], fov: 30, focus: 11.9, ap: 12 };
const c2b: Cam = { p: [.1, 3.3, 15.6], q: [-.2, 3.3, 3.2], fov: 30, focus: 11.9, ap: 12 };
const c3: Cam = { p: [.5, .95, 11.2], q: [.05, 3.9, 3.2], fov: 42, focus: 8.4, ap: 8, roll: .05 };
const c3b: Cam = { ...c3, p: [.5, .95, 10.7], focus: 7.9 };
const c4a: Cam = { p: [-4.2, 3.42, 9], q: [-3.9, 3.42, 5.15], fov: 28, focus: 3.85, ap: 8 };
const c4b: Cam = { p: [.6, 3.42, 9], q: [.9, 3.42, 5.15], fov: 28, focus: 3.85, ap: 8 };
const c4c: Cam = { p: [-.4, 3.5, 15.2], q: [.1, 3.5, 5.1], fov: 25, focus: 10.1, ap: 16 };
const c5: Cam = { p: [0, 3.5, 9.8], q: [0, 3.45, 1.2], fov: 34, focus: 7.2, ap: 10 };
const c5b: Cam = { ...c5, p: [0, 3.5, 9.2], focus: 6.6 };
const c6a: Cam = { p: [-12.6, 3.3, 2.5], q: [0, 3.15, 2.7], fov: 31, focus: 12.6, ap: 6 };
const c6b: Cam = { p: [-12.6, 3.3, 3.5], q: [0, 3.15, 3.5], fov: 31, focus: 12.6, ap: 6 };
const c7a: Cam = { p: [.8, 1.45, 8.4], q: [.1, 1.0, 3.4], fov: 40, focus: 5.0, ap: 4 };
const c7b: Cam = { p: [.5, 2.1, 11.6], q: [.15, 1.12, 2.6], fov: 26, focus: 10.5, ap: 3.5 };
const c8a: Cam = { p: [0, 3.9, 14.4], q: [0, 3.9, 3.6], fov: 30, focus: 10.4, ap: 7 };
const c8b: Cam = { p: [0, 3.6, 15.6], q: [0, 3.6, 3.3], fov: 30, focus: 11.6, ap: 7 };
const c9a: Cam = { p: [-2.7, 1.1, 8.0], q: [-3.05, 1.1, 3.4], fov: 26, focus: 4.5, ap: 5 };
const c9b: Cam = { p: [.9, 2.6, 14.4], q: [.75, 2.02, 3.0], fov: 30, focus: 11.4, ap: 6 };
const c9c: Cam = { p: [0, 1.7, 6.8], q: [0, 0, 3.7], fov: 36, focus: 3.5, ap: 3 };
const c9d: Cam = { p: [0, .22, 3.76], q: [0, 0, 3.7], fov: 36, focus: .3, ap: 0 };
const Y0 = -24;
const c10a: Cam = { p: [0, Y0 + 11.4, 2.0], q: [0, Y0, 2.1], fov: 36, focus: 4, ap: 2 };
const c10b: Cam = { p: [0, Y0 + 7.6, 2.4], q: [0, Y0 + 1, 3.4], fov: 36, focus: 6, ap: 3 };
const c10c: Cam = { p: [0, Y0 + 3.6, 18.6], q: [0, Y0 + 3.6, 2], fov: 36, focus: 15.6, ap: 5 };
const c10d: Cam = { ...c10c, p: [0, Y0 + 4.2, 17.4], focus: 14.4 };
const c11a: Cam = { p: [-5.2, 3.5, 14.3], q: [-2.2, 3.2, 3.9], fov: 30, focus: 11, ap: 12 };
const c11b: Cam = { p: [-1.9, 3.5, 15.1], q: [-1.0, 3.35, 3.9], fov: 30, focus: 11.3, ap: 12 };
const c11c: Cam = { ...c11b, p: [-1.6, 3.5, 14.7], focus: 10.9 };
const top = (y: number): Cam => ({ p: [0, y, 3.32], q: [0, 0, 3.3], fov: 30, focus: y - .1, ap: 2, up: [0, 0, -1] });
const c13a: Cam = { p: [-.4, 3.7, 12.6], q: [.2, 3.4, 3.6], fov: 30, focus: 9, ap: 10 };
const c13b: Cam = { p: [-2.2, 5.6, 27], q: [0, 3.85, 3.5], fov: 27, focus: 23.5, ap: 8 };

// key poses; two keys at the same time are a cut (always under a paper flat or at a matched frame)
const CK: [number, Cam][] = [
  [0, c1a], [1.3, c1a], [4.7, c1b], [7.2, c1c], [9.7, c2a], [10.5, c2b], [13.25, c2b], [14.1, c3], [17.7, c3b],
  [17.7, c4a], [19.4, c4b], [21.1, c4c], [22.9, c4c], [24.9, c5], [28.3, c5b],
  [28.3, c6a], [35.8, c6b],
  [35.8, c7a], [38.1, c7a], [41.9, c7b], [42.6, c7b],
  [42.6, c8a], [46.3, c8a], [48.7, c8b], [49.5, c8b],
  [49.5, c9a], [51.1, c9a], [52.6, c9b], [56.4, c9b], [56.72, c9c], [56.9, c9d],
  [56.9, c10a], [57.4, c10b], [58.4, c10c], [62.8, c10d],
  [62.8, c11a], [66.6, c11b], [69.5, c11c],
  [69.5, top(15)], [71.9, top(15)], [72.6, top(14.2)], [73.9, top(14.2)], [74.5, top(13.5)], [75.3, top(13.5)], [75.9, top(12.8)], [76.5, top(12.8)],
  [76.5, c13a], [77.3, c13a], [81.2, c13b], [85, c13b],
];
function cameraAt(t: number): Cam {
  let i = 0; while (i < CK.length - 1 && CK[i + 1]![0] <= t) i++;
  const [t0, a] = CK[i]!, nx = CK[i + 1];
  if (!nx || nx[0] === t0) return a;
  const k = io(clamp((t - t0) / (nx[0] - t0)));
  return { p: mix3(a.p, nx[1].p, k), q: mix3(a.q, nx[1].q, k), fov: lerp(a.fov, nx[1].fov, k), focus: lerp(a.focus, nx[1].focus, k), ap: lerp(a.ap, nx[1].ap, k), roll: lerp(a.roll ?? 0, nx[1].roll ?? 0, k), up: a.up };
}

// ---------------------------------------------------------------- pose helpers
const noteRot: number[] = [];
const DESK = { p: [0, 0, 4.2] as V3 };
const WIN = [3.75, 4.25, .05] as const, TV = [-3.75, 0, 2.5] as const;
function reset(W: World, u0: G) {
  const hide = [W.labels, W.tapes, W.heroTapes, W.back, W.dimmer, W.part, W.curtains, W.rail, W.trophy, W.candy, W.pin, W.cups, W.tower, W.nine, W.under, W.toolbox, W.floorPulley, W.board, W.crate, W.ink, W.pro, W.title, W.deskProps, W.me.g, W.helper.g, W.kid.g, ...W.others.map((o: G) => o.g), W.tv, W.win, W.desk, W.rope];
  for (const o of hide) o.visible = false;
  for (const o of [W.box, W.deskTop, W.fix, W.track, W.pulley, W.dowels, W.set, W.sides[-1], W.sides[1], W.outerSides[-1], W.outerSides[1], W.inkSides[-1], W.inkSides[1], W.backBoard]) o.visible = true;
  W.spot.intensity = 300; W.spot.angle = .3; W.spot.penumbra = .55; W.spot.color.set(0xffcf94);
  W.amber.intensity = 0; W.glow.intensity = 0; W.tvGlow.intensity = 0; for (const s of W.extra) s.intensity = 0; W.lens.emissiveIntensity = 7;
  W.hemi.intensity = .3; W.fill.intensity = .14; W.room.intensity = 0; W.room.position.set(14, 22, 20); W.glow.color.set(0xff9a3c); W.beam.visible = false; W.leak.visible = false;
  W.tvMat.emissiveIntensity = .25; W.skyDawn.opacity = 0; W.sun.visible = false; W.moon.visible = true; W.sun.position.y = -.45; W.moon.position.y = .5;
  W.win.position.set(...WIN); W.tv.position.set(...TV);
  W.desk.position.set(...DESK.p); W.desk.rotation.y = 0;
  W.back.children.forEach((g: G, i: number) => { g.rotation.y = noteRot[i]; g.visible = true; });
  u0.exposure.value = 1.2; u0.maxBlur.value = 16; u0.vig.value = .4; u0.grain.value = .04;
  for (const p of [W.me, W.helper, W.kid, ...W.others]) { p.g.rotation.set(0, 0, 0); p.body.rotation.set(0, 0, 0); p.body.scale.set(1, 1, 1); p.arms[0].rotation.z = 0; p.arms[1].rotation.z = 0; p.legs[0].rotation.z = 0; p.legs[1].rotation.z = 0; p.rod.visible = p.block.visible = true; p.look(0, 0); }
}
const Vec = (W: World, a: readonly number[]) => W.v3(a[0], a[1], a[2]);
function extra(W: World, i: number, p: readonly number[], q: readonly number[], angle: number, I: number) { const s = W.extra[i]; s.position.set(p[0], p[1], p[2]); s.target.position.set(q[0], q[1], q[2]); s.target.updateMatrixWorld(); s.angle = angle; s.intensity = I; }
function spot(W: World, p: readonly number[], q: readonly number[], angle: number, I: number) { W.spot.position.set(p[0], p[1], p[2]); W.spot.target.position.set(q[0], q[1], q[2]); W.spot.target.updateMatrixWorld(); W.spot.angle = angle; W.spot.intensity = I; }
/** Put the trolley at x and aim the head at a world point; the SpotLight sits on the lens. */
function aim(W: World, x: number, target: V3, o: { angle?: number; i?: number; beam?: number } = {}) {
  W.fix.position.set(x, TRACK.y - .02, TRACK.z); W.fix.updateWorldMatrix(true, true);
  const tv = Vec(W, target); W.head.lookAt(tv); W.head.updateWorldMatrix(true, false);
  const from = W.head.localToWorld(W.v3(0, 0, .3));
  W.spot.position.copy(from); W.spot.target.position.copy(tv); W.spot.target.updateMatrixWorld();
  W.spot.angle = o.angle ?? .3; W.spot.intensity = o.i ?? 300;
  const b = o.beam ?? .1; W.beamMat.uniforms.k.value = b;
  if (b > 0) W.setBeam(W.beam, from, tv, W.spot.angle * .9);
}
const reportPoint = (W: World): V3 => { W.report.updateWorldMatrix(true, false); const v = W.report.localToWorld(W.reportAnchor.clone()); return [v.x, v.y, v.z]; };
function studySet(W: World) { W.desk.visible = W.me.g.visible = W.win.visible = W.tv.visible = W.rope.visible = true; W.me.g.position.set(-.55, 0, 3.55); W.me.rod.visible = W.me.block.visible = false; }
const ropeHead = (fx: number): V3[] => [[fx - .22, TRACK.y - .03, TRACK.z], [(fx - 4.3) / 2, TRACK.y - .06, TRACK.z], [-4.3, TRACK.y - .08, TRACK.z], [-4.46, TRACK.y - .3, TRACK.z]];
const handTail = (h: V3, sag = 0): V3[] => { const a: V3 = [-4.46, TRACK.y - .3, TRACK.z]; return [.3, .6, .85, 1].map(k => { const m = mix3(a, h, k); m[1] -= sag * Math.sin(k * Math.PI); return m; }); };
const mixTail = (a: V3[], b: V3[], k: number) => a.map((p, i) => mix3(p, b[i]!, k));
const handOf = (W: World, p: G, i = 1): V3 => { p.g.updateWorldMatrix(true, true); const h = p.hand(i); return [h.x, h.y, h.z]; };
const TAIL_FLOOR: V3[] = [[-4.4, 3.6, 4.5], [-4.3, 1.3, 4.5], [-4.2, .06, 4.5], [-3.5, .05, 4.6]];
const TAIL_FAR: V3[] = [[-5.4, 4.2, 4.2], [-5.5, 2.2, 4.2], [-5.4, .06, 4.2], [-4.9, .05, 4.4]];
const TAIL_HANG: V3[] = [[-4.5, 3, 4.2], [-4.45, 2, 4.15], [-4.42, 1, 4.1], [-4.4, .06, 4.1]];
const TAIL_LOCK: V3[] = [[-4.5, 3.4, 4.3], [-4.4, 2, 4.3], [-4.3, .08, 4.3], [-3.5, .05, 4.1]];
const TAIL_DROP: V3[] = [[-4.5, 3, 4.3], [-4.5, 2, 4.33], [-4.5, 1, 4.36], [-4.5, .06, 4.4]];
function curtains(W: World, open: number) { W.curtains.visible = true; W.curtains.children.forEach((c: G, i: number) => { c.scale.x = 1.6; c.position.x = (i ? 1 : -1) * (3.3 + 2 * open); c.position.z = 5.6; }); }
/** Night sky → dawn; the sun rises behind the hill, the moon goes. */
function sky(W: World, k: number) { W.skyDawn.opacity = k; W.sun.visible = k > .02; W.sun.position.y = lerp(-1.02, -.45, k); W.moon.visible = k < .8; W.moon.position.y = lerp(.5, .95, k); }

// the longest silence on the ADHD tape (same seed as the tape in world.ts), for the S04 bracket
const GAP = (() => { const p = tapePositions(14, .62, .17, 90).map(x => -5.5 + 11 * x); let a = 0, b = 0; for (let i = 1; i < p.length; i++) if (p[i - 1]! > -2.6 && p[i]! < 2.6 && p[i]! - p[i - 1]! > b - a) { a = p[i - 1]!; b = p[i]!; } return [a, b]; })();
// S09 strips: where each hangs and where it lands (same draw order as the storyboard)
const STRIP = (() => { const r = rng(9), held = [0, 1, 2, 3, 5, 6, 8], H: G[] = [], F: G[] = []; for (let i = 0; i < 10; i++) { const x = -.65 + i * .69; if (held.includes(i)) { H[i] = { x, y: 3.62 + r() * .55, z: 2.7 + r() * .4, ry: (r() - .5) * .5 }; F[i] = { x: x + .1, y: .03, z: 3.5, rz: .4 - i * .1 }; } else { const fx = x + (r() - .5) * .25, fz = 3.3 + r() * .9, rz = (r() - .5) * 1.1; H[i] = { x, y: 3.9, z: 2.9, ry: .1 }; F[i] = { x: fx, y: .03, z: fz, rz }; } } return { H, F }; })();
const FALLS: Record<number, number> = { 4: 50.8, 7: 51.3, 9: 51.8, 1: 52.25, 3: 52.65 };
const BACK: Record<number, number> = { 1: 55.5, 3: 56.0 };   // pulled back up once the feet swing; 4, 7 and 9 stay down

// ---------------------------------------------------------------- the shots
function S01(W: World, t: number): Draw {
  studySet(W); const rp = reportPoint(W), level = t < .7 ? 0 : t < .78 ? 1 : t < .86 ? .3 : 1;
  const read = ramp(t, 4.9, .5);
  W.me.arms[0].rotation.z = lerp(.2, .62, read); W.me.arms[1].rotation.z = lerp(-.1, -.3, read); W.me.look(.05 * read, lerp(.03, -.04, read)); W.me.g.rotation.y = .1; W.me.body.rotation.z = -.03 * read + boil(t, 3) * .003;
  aim(W, .1, mix3(rp, [-1.0 + rp[0], .7 + rp[1], -.4 + rp[2]], 1), { angle: .5, i: 190 * level, beam: .2 * level });
  W.lens.emissiveIntensity = 7 * level; W.hemi.intensity = lerp(.03, .24, level); W.fill.intensity = .08 * level;
  W.setRope([...ropeHead(.5), ...TAIL_FLOOR]);
  return () => {};
}
function S02(W: World, t: number): Draw {
  studySet(W); const rp = reportPoint(W), u = step(t);
  const T0: V3 = [rp[0] - 1, rp[1] + .7, rp[2] - .4], WC: V3 = [3.75, 4.25, .1], TVC: V3 = [-3.75, 1.9, 2.6];
  const s1 = ramp(t, 8.75, 1.25), s2 = ramp(t, 10.1, .55), hold = ramp(t, 8.5, .35), let_go = ramp(t, 10.05, .5);
  const tug = bump(t, 9.2, .45) * .55 + bump(t, 9.7, .35) * .3, drift = Math.sin(u * 3.1) * .07 * (1 - s1);
  const fx = lerp(lerp(.1, 2.6, s1) - tug + drift, -2.9, s2);
  aim(W, fx, mix3(mix3(T0, WC, s1), TVC, s2), { angle: lerp(lerp(.5, .26, s1), .2, s2), i: lerp(lerp(190, 170, s1), 70, s2), beam: .2 });
  W.me.g.position.x = lerp(lerp(-.55, -.8, hold), -.55, let_go); W.me.g.rotation.y = lerp(lerp(.1, -.12, hold), .36, let_go);
  W.me.body.rotation.z = lerp(hold * (.14 + tug * .12), -.05, let_go);
  W.me.arms[1].rotation.z = lerp(lerp(-.3, -2.5, hold), -.1, let_go); W.me.arms[0].rotation.z = lerp(lerp(.62, 1, hold), .25, let_go);
  W.me.look(lerp(-.06 * hold, -.09, let_go), lerp(.06 * hold, -.03, let_go));
  const h = handOf(W, W.me), tail = let_go > 0 ? mixTail(handTail(h), TAIL_FAR, let_go) : mixTail(TAIL_FLOOR, handTail(h), hold);
  W.setRope([...ropeHead(Math.max(fx, -3.6)), ...tail]);
  const k = ramp(t, 10.7, 1.7); sky(W, k);
  W.tvMat.emissiveIntensity = lerp(.25, 1, s2); W.tvGlow.position.set(-3.2, 2, 3.9); W.tvGlow.intensity = 9 * s2;
  extra(W, 0, mix3([-1.4, 5.6, 11], [.6, 5.6, 11], s2), mix3([-.8, 2.6, 3.5], [-.5, 2.6, 3.5], s2), .3, lerp(34 * hold, 30, s2));
  W.hemi.intensity = lerp(lerp(.24, .42, hold), .4, s2); W.fill.intensity = lerp(.08, .1, hold);
  return (c, Pj) => { ring(c, Pj, W, rp, .92, sm(t, 8.95, .55), '想照的地方', fadeIn(t, 9.3, 14)); };
}
function S03(W: World, t: number): Draw {
  studySet(W); W.labels.visible = true; const fly = ramp(t, 13.2, .55, inQ), rp = reportPoint(W);
  W.win.position.y += 9 * fly; W.tv.position.y += 9 * fly; W.win.visible = W.tv.visible = fly < 1; sky(W, 1); W.tvMat.emissiveIntensity = 1 - .75 * fly;
  const a = ramp(t, 13.2, .7);
  aim(W, lerp(-2.9, -2.8, a), mix3([-3.75, 1.9, 2.6], [-.2, 2.3, 3.4], a), { angle: lerp(.2, .34, a), i: lerp(70, 200, a), beam: .1 }); W.spot.color.set(0xffdfb8);
  W.setRope([...ropeHead(-2.8), ...mixTail(TAIL_FAR, TAIL_HANG, a)]);
  const hits = [13.55, 13.85, 14.2, 14.75]; let squash = 0;
  W.signs.forEach((s: G, i: number) => {
    const k = ramp(t, hits[i]!, .32, outBack), age = step(t) - hits[i]! - .32;
    s.g.position.y = s.y + 7.4 * (1 - k);
    s.g.rotation.z = s.rz + (age > 0 ? Math.sin(age * 7) * .05 * Math.exp(-age * 1.6) : 0);
    if (i < 3) squash += bump(t, hits[i]! + .22, .3);
  });
  const fl = ramp(t, 15.6, .5); W.signs[3].g.rotation.y = lerp(W.signs[3].ry - Math.PI, W.signs[3].ry, fl);
  W.me.g.position.x = lerp(-.55, -.3, a); W.me.g.rotation.y = lerp(.36, 0, a); W.me.body.scale.y = 1 - squash * .05; W.me.body.rotation.x = .04 + ramp(t, 13.9, .8) * .05; W.me.arms[0].rotation.z = .1; W.me.arms[1].rotation.z = -.1; W.me.look(0, lerp(.08, -.04, ramp(t, 14.3, .4)) + ramp(t, 15.7, .4) * .12);
  extra(W, 0, [-3.2, 1.2, 9], [-3.5, 3.3, 2.6], .3, 40); W.hemi.intensity = .42;
  void rp; return () => {};
}
function S04(W: World, t: number): Draw {
  W.ink.visible = W.heroTapes.visible = true; W.fix.visible = W.track.visible = W.pulley.visible = false;
  const wall = t > 19.2; W.tapes.visible = wall;
  if (wall) for (const r of W.tapeRows) r.g.position.y = r.y + 8 * (1 - ramp(t, 19.4 + r.d * 1.3, .6));
  spot(W, [.2, 7, 8.8], [0, 3.2, 5.15], .8, 170);
  extra(W, 0, [-4, 7, 7], [0, 3.5, .4], .8, 22 * sm(t, 19.6, 1)); W.hemi.intensity = .1; W.fill.intensity = .04;
  W.heroTapes.children[0].position.x = 0;
  if (t > 22.2) curtains(W, 1 - ramp(t, 22.25, .65));
  return (c, Pj) => {
    const [ax, ay] = Pj([-3.5, 4.22, 5.15]), [bx, by] = Pj([-3.5, 3.22, 5.15]), lab = fadeIn(t, 20.9, 22.5);
    const a0 = fadeIn(t, 18.2, 19.3, .3, .2);
    if (a0 > 0) { const [mx, my] = Pj([-3.1, 3.36, 5.15]), [nx, ny] = Pj([-3.1, 3.08, 5.15]); chalk(c, '一般發展', mx, my, { color: C.cream, alpha: a0, size: 36 }); chalk(c, 'ADHD', nx, ny, { alpha: a0, size: 36 }); }
    if (lab > 0) { chalk(c, '一般發展', ax, ay, { color: C.cream, alpha: lab, size: 34 }); chalk(c, 'ADHD', bx, by, { alpha: lab, size: 34 }); }
    // the long gap: a bracket under the widest silence on the ADHD tape
    const g = sm(t, 21.2, .4) * (1 - sm(t, 22.2, .3));
    if (g > 0) { const [x0, y0] = Pj([GAP[0]!, 2.42, 5.15]), [x1] = Pj([GAP[1]!, 2.42, 5.15]); c.save(); c.globalAlpha = g; c.strokeStyle = C.amber; c.lineWidth = 4; c.beginPath(); c.moveTo(x0, y0 - 12); c.lineTo(x0, y0); c.lineTo(x1, y0); c.lineTo(x1, y0 - 12); c.stroke(); c.restore(); chalk(c, '偶爾有一段特別久的空白', (x0 + x1) / 2, y0 + 40, { color: C.cream, alpha: g, size: 28, align: 'center' }); }
  };
}
function S05(W: World, t: number): Draw {
  W.ink.visible = W.back.visible = W.dimmer.visible = true; W.fix.visible = W.track.visible = W.pulley.visible = false;
  const u = step(t), dim = ramp(t, 26.3, 1.6), wake = bump(t, 24.45, 1.2);
  const open = ramp(t, 23.0, 1.2); curtains(W, open);
  spot(W, [.2, 7, 8.8], [0, 3.2, 5.15], .8, 170 * (1 - open));   // the S04 light stays on the curtain until it has opened
  W.dimmer.position.set(1.62, .95, 4); W.dimmer.rotation.y = -.22; W.fader.position.y = lerp(3, .78, dim); W.back.children[1].visible = false;
  W.back.children.forEach((g: G, i: number) => { g.rotation.y = noteRot[i]! + Math.sin(u * 1.9 + i * 1.7) * (.16 + wake * .2) * (1 - dim * .85); });
  W.glow.position.set(-.6, 6.8, 3.6); W.glow.intensity = lerp(90 + wake * 30, 9, dim); W.hemi.intensity = lerp(.22, .13, dim);
  extra(W, 0, [0, 6.6, 8.5], [1.62, 2.6, 4], .2, lerp(90, 150, dim));
  return (c, Pj) => {
    const a = fadeIn(t, 26.1, 28.1); if (a <= 0) return;
    const [x, y] = Pj([1.62, 3.55, 4.1]); c.save(); c.globalAlpha = a; c.strokeStyle = C.amber; c.fillStyle = C.amber; c.lineWidth = 5; c.beginPath(); c.moveTo(x + 88, y - 96); c.lineTo(x + 88, y + 60); c.stroke(); c.beginPath(); c.moveTo(x + 74, y + 56); c.lineTo(x + 102, y + 56); c.lineTo(x + 88, y + 80); c.fill(); c.restore();
  };
}
function S06(W: World, t: number): Draw {
  W.back.visible = W.part.visible = true; studySet(W); W.tv.visible = W.win.visible = W.rope.visible = W.pulley.visible = false;
  W.sides[-1].visible = W.outerSides[-1].visible = W.inkSides[-1].visible = false;
  const u = step(t), leak = ramp(t, 30.3, 1.0);
  W.back.children.forEach((g: G, i: number) => { g.rotation.y = -1.25 + (i % 3) * .12 + Math.sin(u * 1.3 + i) * .05; g.visible = g.position.x > .9; });
  W.desk.position.set(.2, 0, 5.05); W.desk.rotation.y = -2;
  const hx = Math.sin(-2), hz = Math.cos(-2);
  W.me.g.position.set(.2 - hx * .75, 0, 5.05 - hz * .75); W.me.g.rotation.y = -1.75; W.me.arms[0].rotation.z = .55; W.me.arms[1].rotation.z = .4; W.me.look(.04, -.05); W.me.body.rotation.z = boil(t, 5) * .004;
  const rp = reportPoint(W);
  aim(W, .1, [rp[0] + .1, rp[1], rp[2] + .1], { angle: .36, i: 64, beam: 0 }); W.fix.visible = W.track.visible = false;
  W.glow.position.set(1.6, 4.4, 1.6); W.glow.intensity = 70;
  W.amber.position.set(rp[0], 2.02, .9); W.amber.target.position.set(rp[0], rp[1], rp[2]); W.amber.target.updateMatrixWorld(); W.amber.angle = .2; W.amber.intensity = 620 * leak;
  if (leak > 0) { W.leakMat.uniforms.k.value = 1.1 * leak; W.setBeam(W.leak, Vec(W, [rp[0], 1.82, 3.2]), Vec(W, [rp[0], rp[1] - .04, rp[2]]), .13, .22); }
  extra(W, 0, [-4, 6.8, 6.4], [6, 3.2, 5.2], .34, 70); W.hemi.intensity = .2;
  return (c, Pj) => {
    const a = Pj([0, 5.5, -.2]), b = Pj([0, 4.3, 5.6]), s = Pj([0, 1.82, 3.2]);
    chalk(c, '後台', a[0], a[1], { color: C.ink, size: 40, align: 'center', alpha: fadeIn(t, 28.8, 35.5), shadow: false });
    chalk(c, '前台', b[0], b[1], { color: C.cream, size: 40, align: 'center', alpha: fadeIn(t, 29.4, 35.5) });
    const k = fadeIn(t, 31.3, 35.4); if (k <= 0) return;
    chalk(c, '很窄的縫', s[0] - 26, s[1] + 76, { size: 34, align: 'right', alpha: k });
    c.save(); c.globalAlpha = k; c.strokeStyle = C.gold; c.lineWidth = 3; c.beginPath(); c.moveTo(s[0] - 22, s[1] + 62); c.lineTo(s[0] - 4, s[1] + 12); c.stroke(); c.restore();
  };
}
function S07(W: World, t: number): Draw {
  W.ink.visible = W.rail.visible = W.trophy.visible = W.candy.visible = true; W.fix.visible = W.track.visible = W.pulley.visible = false;
  const slow = ramp(t, 38.1, 2.1), fast = ramp(t, 40.3, 1.6), z = lerp(lerp(3.4, 2.75, slow), .95, fast), s = lerp(lerp(1, .9, slow), .5, fast);
  W.trophy.position.set(0, .1, z); W.trophy.scale.setScalar(s); W.candy.position.set(0, .3, 4.4); W.candy.scale.setScalar(.8); W.candy.rotation.set(.1, .3, .15);
  spot(W, [1.2, 6.5, z + 2.25], [0, .4, z], .17, 360);
  extra(W, 0, [-1.8, 5, 8.2], [0, .2, 4.4], .15, 150); extra(W, 1, [0, 7, 6], [0, 0, 3.2], .7, 70); W.hemi.intensity = .36;
  return (c, Pj) => {
    const a = sm(t, 40.5, .5), l = fadeIn(t, 41.0, 42.6, .4, .01); if (a <= 0) return;
    const b = Pj([0, .1, z]), r = Pj([0, .81, z]), H = (b[1] - r[1]) * 2.2, w = H * .34, cx = b[0], by = b[1];
    c.save(); c.globalAlpha = a; c.strokeStyle = C.gold; c.lineWidth = 5; c.setLineDash([22, 14]); c.lineCap = 'round'; c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 6; c.beginPath();
    c.moveTo(cx - w * .86, by); c.lineTo(cx + w * .86, by); c.moveTo(cx - w * .24, by - H * .04); c.lineTo(cx - w * .16, by - H * .34); c.quadraticCurveTo(cx - w * .9, by - H * .46, cx - w, by - H); c.lineTo(cx + w, by - H); c.quadraticCurveTo(cx + w * .9, by - H * .46, cx + w * .16, by - H * .34); c.lineTo(cx + w * .24, by - H * .04); c.stroke(); c.restore();
    chalk(c, '實際的價值', cx + w + 18, by - H * .86, { alpha: l }); chalk(c, '感覺到的價值', cx + w * .62, by - H * .2, { color: C.cream, size: 30, alpha: l });
  };
}
function S08(W: World, t: number): Draw {
  W.ink.visible = true; studySet(W); W.tower.visible = W.cups.visible = W.pin.visible = true; W.tv.visible = false;
  const up = ramp(t, 44.55, .45), u = step(t);
  sky(W, ramp(t, 44.6, 1.1));
  W.me.g.position.set(-1.2, 0, 3.55); W.me.g.rotation.y = .2; W.me.arms[0].rotation.z = lerp(1.25 + Math.sin(u * 9) * .06, .5, up); W.me.arms[1].rotation.z = lerp(.62 + Math.sin(u * 7 + 1) * .05, -.1, up); W.me.look(lerp(.08, .1, up), lerp(-.05, .1, up)); W.me.body.rotation.z = -.04 * up;
  const fx = -.5; aim(W, fx, [-.65, 2.8, 3.95], { angle: .4, i: 200, beam: .2 });
  W.pin.position.set(fx + .08, TRACK.y + .22 + 1.6 * (1 - ramp(t, 42.95, .3, inQ)), TRACK.z);
  W.setRope([...ropeHead(fx), ...TAIL_LOCK]);
  W.cups.children.forEach((g: G, i: number) => { g.visible = step(t) >= 43.35 + i * .3; });
  ([[-4.65, 2.0], [-3.1, 1.5], [3.9, 1.7]] as const).forEach(([x, z], i) => { const o = W.others[i], k = ramp(t, 47.7 + i * .28, .3), w = ramp(t, 46.5 + i * .12, .9), wing = x < 0 ? -7.2 : 7.2, hop = w > 0 && w < 1 ? Math.abs(Math.sin(step(t) * 13)) * .1 : 0; o.g.visible = w > 0; o.g.position.set(lerp(wing, x, w), hop, z); o.look(0, -.05); o.arms[0].rotation.z = .9; o.arms[1].rotation.z = -.9; extra(W, i, [x + .2, 6.6, z + 1.4], [x, 1, z], .22, 90 * k); });
  W.hemi.intensity = .3; W.fill.intensity = .09;
  return () => {};
}
function S09(W: World, t: number): Draw {
  W.ink.visible = W.nine.visible = W.kid.g.visible = W.rope.visible = true; W.pulley.visible = true;
  const kx = -2.55, KZ = 3.5, u = step(t), free = t >= 53.1, sw = ramp(t, 53.2, .35), ph = Math.sin(u * Math.PI * 2 * 1.5);
  W.stool.position.set(kx, 0, 3.1); W.kid.g.position.set(kx, 1.54 - .62 * .84 + .02, KZ); W.kid.rod.visible = W.kid.block.visible = false;
  W.kid.legs[0].rotation.z = ph * .38 * sw; W.kid.legs[1].rotation.z = -ph * .3 * sw; W.kid.arms[0].rotation.z = .35; W.kid.arms[1].rotation.z = -.35; W.kid.look(.08, lerp(-.04, .05, ramp(t, 51.2, .4))); W.kid.g.rotation.y = .12;
  const drop = ramp(t, 53.0, .35, inQ);
  W.clip.position.set(lerp(kx, kx + .9, drop), lerp(1.26, .2, drop), lerp(KZ + .1, 3.9, drop)); W.clip.rotation.set(-1.45 * drop, 0, .5 * drop);
  W.strips.forEach((s: G, i: number) => {
    const f = FALLS[i], b = BACK[i]; let k = f !== undefined ? clamp((step(t) - f) / .4) : 0;
    if (b !== undefined) k *= 1 - clamp((step(t) - b) / .45);
    W.poseStrip(s, STRIP.H[i], STRIP.F[i], k, b !== undefined && step(t) > b);
  });
  const fx = -2.2; aim(W, fx, [kx, 1.9, KZ], { angle: .3, i: 110, beam: .16 });   // this light never moves in S09
  W.setRope([...ropeHead(fx), ...TAIL_DROP]);
  extra(W, 0, [2.6, 6.8, 7.6], [2, 2.2, 3.2], .55, 120); extra(W, 1, [.8, 6, 9], [1, 0, 3.8], .5, 150); W.hemi.intensity = .34;
  return (c, Pj) => {
    if (!free) return;
    const a = sm(t, 53.4, .3) * (1 - sm(t, 56.4, .3)), p = Pj([kx - .35, 1.05, KZ]), q = Pj([kx + .4, 1.0, KZ]);
    c.save(); c.globalAlpha = a; c.strokeStyle = C.amber; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.arc(p[0], p[1], 58, 1.15, 2.4); c.stroke(); c.beginPath(); c.arc(q[0], q[1], 58, .75, 2); c.stroke(); c.restore();
  };
}
function S10(W: World, t: number): Draw {
  W.box.visible = W.deskTop.visible = false; W.under.visible = true; W.fix.visible = false;
  spot(W, [0, Y0 + 13, 2], [0, Y0, 3], .22, 900);
  W.beamMat.uniforms.k.value = .34; W.setBeam(W.beam, Vec(W, [0, Y0 + 9.2, 2.05]), Vec(W, [0, Y0, 2.85]), .13);
  W.glow.position.set(0, Y0 + 6.4, 7.5); W.glow.color.set(0xffb066); W.glow.intensity = 40 + 90 * ramp(t, 57.85, .4);
  extra(W, 0, [-6.6, Y0 + 8.4, 8], [-6.6, Y0 + 2.4, 1.4], .42, 25 + 105 * ramp(t, 57.1, .4));
  extra(W, 1, [6.8, Y0 + 8.4, 8], [6.8, Y0 + 3.6, 1], .42, 25 + 105 * ramp(t, 58.55, .4)); W.hemi.intensity = .34;
  const f = clamp((step(t) - 60.2) / 1.9), y = lerp(9.5, .35, f * f);
  W.fall.visible = t >= 60.2; W.fall.position.set(.05 + Math.sin(f * 7) * .22, y, 3); W.fall.rotation.set(.1 + f * 2.4, .2 + f * 3, -.18 + Math.sin(f * 6) * .5);
  return () => {};
}
function S11(W: World, t: number): Draw {
  studySet(W); W.toolbox.visible = W.crate.visible = W.helper.g.visible = true; W.tv.visible = false; W.dowels.visible = false; sky(W, 0);
  const rp = reportPoint(W), u = step(t);
  const walk = ramp(t, 63.0, 1.0), hop = Math.abs(Math.sin(u * 13)) * .1 * (walk > 0 && walk < 1 ? 1 : 0), mount = ramp(t, 65.7, .9, outBack), pull = ramp(t, 66.9, .7), look2 = ramp(t, 67.9, .4);
  W.helper.g.position.set(lerp(-5.5, -2.95, walk), hop, 3.7); W.helper.g.rotation.y = .3; W.helper.arms[0].rotation.z = lerp(.2, 2.1, ramp(t, 64.1, .4)); W.helper.arms[1].rotation.z = -.5; W.helper.look(.07, .04); W.helper.rod.visible = W.helper.block.visible = false;
  W.crate.position.set(-4.3, 0, 4.9); W.toolbox.position.set(-4.3, 1, 4.9); W.toolbox.rotation.y = .12;
  W.tags.forEach((g: G, i: number) => { g.position.y = -.9 + .9 * ramp(t, [63.15, 63.75, 64.5][i]!, .35, outBack); });
  W.floorPulley.visible = mount > 0; W.floorPulley.position.set(-2.1, 3 * (1 - mount) * .5, 3.7); W.floorPulley.scale.setScalar(Math.max(.001, Math.min(mount, 1)));
  W.me.g.position.x = -.5; W.me.g.rotation.y = -.25; W.me.arms[1].rotation.z = lerp(-.4, -1.7, pull); W.me.arms[0].rotation.z = lerp(.3, .7, pull); W.me.look(lerp(.02, -.07, look2), .03);
  W.helper.look(lerp(.07, .1, look2), .04);
  const slip = bump(t, 68.55, .75) * .34, wander = lerp(1.9, .75, pull) + Math.sin(u * 1.4) * .05 * (1 - pull) + slip;
  aim(W, wander, [rp[0] - .75 + (wander - .75) * .9, rp[1] + .6, rp[2] - .3], { angle: .5, i: 190, beam: .16 });
  const h = handOf(W, W.me), via: V3[] = [[-3, 4.6, 4.1], [-2.17, 3.22, 3.74], [-1.9, 3.1, 3.72], h];
  W.setRope([...ropeHead(wander), ...mixTail(TAIL_FLOOR, via, ramp(t, 66.3, .6))]);
  extra(W, 0, [-3.6, 6, 11], [-3, 2.4, 3.7], .3, 70); extra(W, 1, [-4.6, 6, 9.5], [-4.3, 1.9, 4.9], .2, 90); W.hemi.intensity = .44; W.fill.intensity = .2;
  return (c, Pj) => ring(c, Pj, W, rp, .92, sm(t, 63.4, .6), null, 0);
}
function S12(W: World, t: number, u0: G): Draw {
  W.board.visible = true; W.fix.visible = W.track.visible = W.pulley.visible = W.dowels.visible = false; W.backBoard.visible = false;
  W.sides[1].visible = W.sides[-1].visible = W.outerSides[1].visible = W.outerSides[-1].visible = false;
  spot(W, [-3.6, 8.5, 7.4], [0, 0, 3.3], .62, 300); W.hemi.intensity = .6; u0.vig.value = .5;
  [72.45, 74.15, 75.35].forEach((a, i) => {
    const card = W.board.children[1 + i * 2], pin = W.board.children[2 + i * 2], k = ramp(t, a, .4), p = ramp(t, a + .32, .22, inQ);
    card.rotation.z = Math.PI * (1 - k); card.position.y = .08 + Math.sin(k * Math.PI) * 1.2 + (k < 1 ? 0 : 0);
    pin.visible = p > 0; pin.position.y = .13 + 2.6 * (1 - p);
  });
  return () => {};
}
function S13(W: World, t: number): Draw {
  studySet(W); W.pro.visible = W.title.visible = W.deskProps.visible = true; W.tv.visible = W.dowels.visible = false; const rp = reportPoint(W), u = step(t);
  W.me.arms[0].rotation.z = .7; W.me.arms[1].rotation.z = -1.25 + Math.sin(u * 2.3) * .05; W.me.look(.06, 0); W.me.g.rotation.y = .1;
  const w1 = Math.sin(u * 1.1) * .13 + Math.sin(u * 2.7 + 1) * .06, fx = 1.05 + w1 * .6;
  aim(W, fx, [rp[0] - .4 + w1, rp[1] + .3, rp[2] - .1], { angle: .36, i: 240, beam: .24 });
  W.setRope([...ropeHead(fx), ...handTail(handOf(W, W.me))]);
  W.room.position.set(-3, 9, 40); W.room.intensity = lerp(.35, .95, sm(t, 77, 3.5)); W.hemi.intensity = .5;
  return (c, Pj) => ring(c, Pj, W, rp, .86, 1, null, 0);
}
const SHOTS: [number, (W: World, t: number, u0: G) => Draw][] = [[7.2, S01], [13.2, S02], [17.7, S03], [22.9, S04], [28.3, S05], [35.8, S06], [42.6, S07], [49.5, S08], [56.9, S09], [62.8, S10], [69.5, S11], [76.5, S12], [85.1, S13]];

// ---------------------------------------------------------------- setup and frame
const PAPER: OffscreenCanvas[] = [];
function paperBG(base: string, seed: number, holes = false) { return bake(`paperbg-${base.slice(1)}-${seed}-${holes ? 1 : 0}`, 1920, 1080, g => drawPaperBG(g, base, seed, holes)); }
function drawPaperBG(g: OffscreenCanvasRenderingContext2D, base: string, seed: number, holes: boolean) {
  const r = rng(seed), dark = base === '#2C2824';
  g.fillStyle = base; g.fillRect(0, 0, 1920, 1080);
  for (let i = 0; i < 70; i++) { const x = r() * 1920, y = r() * 1080, R = 60 + r() * 220, gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, `rgba(120,90,55,${.02 + r() * .03})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - R, y - R, 2 * R, 2 * R); }
  for (let i = 0; i < 2600; i++) { const x = r() * 1920, y = r() * 1080, a = r() * 6.3, L = 4 + r() * 16; g.strokeStyle = r() < .55 ? `rgba(255,248,235,${(dark ? .02 : .1) + r() * (dark ? .05 : .12)})` : `rgba(80,55,30,${.04 + r() * .06})`; g.lineWidth = .8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
  if (holes) { g.fillStyle = '#2A2420'; for (const y of [250, 830]) { let x = 30; while (x < 1900) { g.beginPath(); g.arc(x, y, 26, 0, 7); g.fill(); x += 78 + (r() < .17 ? 150 + r() * 120 : r() * 18); } } }
  const v = g.createRadialGradient(960, 540, 380, 960, 540, 1150); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,25,10,.22)'); g.fillStyle = v; g.fillRect(0, 0, 1920, 1080);
}

export async function setup(ctx: SetupContext) {
  await loadBaked();
  PAPER[0] = paperBG('#EAE0CE', 8); PAPER[1] = paperBG('#B98A57', 9); PAPER[2] = paperBG('#2C2824', 10); PAPER[3] = paperBG('#F1E7D3', 12, true);
  const stage = await prepareStage(ctx, async b => {
    b.renderer.shadowMap.enabled = true; b.renderer.shadowMap.type = b.THREE.PCFShadowMap;
    b.renderer.outputColorSpace = b.THREE.LinearSRGBColorSpace; b.renderer.toneMapping = b.THREE.NoToneMapping;
    b.scene.background = new b.THREE.Color(0x0d0a08);
    b.camera.near = .1; b.camera.far = 200;
    const world = buildWorld(b.THREE, b.scene, b.renderer);
    noteRot.length = 0; for (const g of world.back.children) noteRot.push(g.rotation.y);
    world.v3 = (x: number, y: number, z: number) => new b.THREE.Vector3(x, y, z);
    await b.renderer.compileAsync?.(b.scene, b.camera);
    return world;
  }, { fov: 30, toneMapping: 'none' });
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
  const { stage, post } = ctx.assets.film as Film, W = stage.objects, cam = stage.camera, t = Math.min(time, BEATS.duration - 1e-3);
  const s3 = Math.min(ctx.renderScale, 1), pw = Math.max(1, Math.round(ctx.width * s3)), ph = Math.max(1, Math.round(ctx.height * s3));
  if (stage.surface.width !== pw || stage.surface.height !== ph) stage.renderer.setSize(pw, ph, false);
  post.resize(pw, ph, ctx.width);
  cam.aspect = ctx.width / ctx.height;
  const u = post.mat.uniforms;
  reset(W, u);
  const after = SHOTS.find(([end]) => t < end)![1](W, t, u);
  const c0 = cameraAt(t);
  cam.up.set(...(c0.up ?? [0, 1, 0])); cam.position.set(...c0.p); cam.fov = c0.fov; cam.lookAt(...c0.q); if (c0.roll) cam.rotateZ(c0.roll);
  cam.updateProjectionMatrix(); cam.updateMatrixWorld(); stage.scene.updateMatrixWorld(true);
  u.focus.value = c0.focus; u.aperture.value = c0.ap; u.seed.value = Math.floor(t * 30) % 97;
  // lights at zero cost nothing: skip their shadow passes (a property change, so no shader recompile)
  for (const l of [W.amber, W.glow, W.room]) { l.shadow.autoUpdate = l.intensity > 0; }
  post.render(stage.scene, cam);
  ctx.withCanvas(c => {
    c.imageSmoothingQuality = 'high'; c.drawImage(stage.surface, 0, 0, ctx.width, ctx.height);
    after(c, q => project(W, cam, q));
    flats(c, t);
    overlay(c, t);
  });
}

// ---------------------------------------------------------------- 2D
function chalk(c: G, s: string, x: number, y: number, o: { size?: number; color?: string; align?: 'left' | 'center' | 'right'; alpha?: number; shadow?: boolean } = {}) {
  if ((o.alpha ?? 1) <= 0) return;
  c.save(); if (o.shadow !== false) { c.shadowColor = 'rgba(0,0,0,.75)'; c.shadowBlur = 8; }
  text(c, s, x, y, { ...T.chalk, size: o.size ?? T.chalk.size, color: o.color ?? C.gold, align: o.align ?? 'left', alpha: o.alpha ?? 1 }); c.restore();
}
/** The gold dashed ring: where the puppet wants the light. Draws on with k. */
function ring(c: G, Pj: (q: V3) => [number, number, boolean], W: World, q: V3, rWorld: number, k: number, label: string | null, labelK: number) {
  if (k <= 0) return;
  const [x, y] = Pj(q), [x1, y1] = Pj([q[0] + rWorld, q[1], q[2]]), r = Math.hypot(x1 - x, y1 - y);
  c.save(); c.strokeStyle = C.gold; c.lineWidth = 5; c.setLineDash([22, 14]); c.lineCap = 'round'; c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 6;
  c.beginPath(); c.ellipse(x, y, r, r * .86, -.05, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); c.stroke(); c.restore();
  if (label) chalk(c, label, x, y - r * .86 - 30, { align: 'center', alpha: labelK });
}
function flats(c: G, t: number) {
  for (const [a, b, dir, sheet] of FLATS) {
    if (t <= a || t >= b) continue;
    const k = (t - a) / (b - a), e = k < .46 ? -(1 - out(k / .46)) : k > .54 ? ((k - .54) / .46) ** 3 : 0, d = e * 1.06;
    const dx = dir === 'right' ? d * 1920 : dir === 'left' ? -d * 1920 : 0, dy = dir === 'down' ? d * 1080 : dir === 'up' ? -d * 1080 : 0;
    c.save(); c.shadowColor = 'rgba(8,6,4,.6)'; c.shadowBlur = 50; c.drawImage(PAPER[sheet]!, dx, dy, 1920, 1080); c.restore();
  }
}
function overlay(c: G, t: number) {
  const kick = KICKERS.find(([a, b]) => t >= a - .1 && t < b);
  if (kick) {
    const [a, b, s, s2, right, y0] = kick, k = fadeIn(t, a, b), y = y0 ?? 150, x = right ? 1770 : 150;
    if (!y0) { const g = c.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, `rgba(14,11,8,${.5 * k})`); g.addColorStop(1, 'rgba(14,11,8,0)'); c.fillStyle = g; c.fillRect(0, 0, 1920, 300); }
    c.save(); c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 8;
    text(c, s, x, y - (1 - k) * 6, { ...T.kicker, alpha: k, align: right ? 'right' : 'left', tracking: y0 ? 5 : T.kicker.tracking });
    c.globalAlpha = k; c.fillStyle = C.amber; c.fillRect(right ? x - 60 : x, y + 22, 60, 3); c.globalAlpha = 1;
    if (s2) text(c, s2, x, y + 66, { ...T.note, alpha: k, align: right ? 'right' : 'left' });
    c.restore();
  }
  const subOn = SUBS.some(([a, b]) => t >= a - .15 && t < b + .6);
  if (subOn) { const g = c.createLinearGradient(0, 780, 0, 1080); g.addColorStop(0, 'rgba(14,11,8,0)'); g.addColorStop(1, 'rgba(14,11,8,.55)'); c.fillStyle = g; c.fillRect(0, 780, 1920, 300); }
  SUBS.forEach(([a, b, s], i) => {
    const next = SUBS[i + 1]?.[0] ?? Infinity, end = Math.min(b + .6, next - .08);
    if (t < a - .15 || t > end) return;
    const k = at(t, a - .15, a + .1, out) * (1 - at(t, end - .18, end, io));
    c.save(); c.shadowColor = 'rgba(10,8,6,.6)'; c.shadowBlur = 16; text(c, s, 960, 1000 + (1 - k) * 8, { ...T.sub, alpha: k }); c.restore();
  });
  // S12: the small reminder above the cards
  { const k = fadeIn(t, 70.2, 76.3, .5, .25); if (k > 0) { c.save(); c.shadowColor = 'rgba(0,0,0,.7)'; c.shadowBlur = 8; text(c, '評估請找專業人員', 960, 92, { ...T.note, align: 'center', alpha: k, tracking: 4 }); c.restore(); } }
  // S13: end card
  if (t > 82) {
    const k = fadeIn(t, 82.1, 84.7, .6, .4);
    const g = c.createLinearGradient(0, 860, 0, 1080); g.addColorStop(0, 'rgba(14,11,8,0)'); g.addColorStop(1, `rgba(14,11,8,${.6 * k})`); c.fillStyle = g; c.fillRect(0, 860, 1920, 220);
    text(c, '本片為科普內容，不能取代專業評估。', 960, 990, { ...T.end, alpha: k });
    text(c, 'Made with Mografy', 1824, 1040, { ...T.credit, alpha: k * .8 });
  }
  // the opening dark and the end
  const black = Math.max(t < .7 ? 1 : 0, at(t, 84.3, 85.0, io));
  if (black > 0) { c.fillStyle = `rgba(10,8,6,${black})`; c.fillRect(0, 0, 1920, 1080); }
}

void SERIF;
