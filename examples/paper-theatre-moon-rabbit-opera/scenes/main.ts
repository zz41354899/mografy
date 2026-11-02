// 來自月亮的偶像 · 3D × 2D — 60 s paper puppet theatre.
// One 3D paper toy theatre (world3d.ts) cut against flat printed 2D inserts (paper.ts). Moonlight travels:
// moon → town windows → moonbeam on the washi screen → one spotlight → the audience's penlights → the full stage.
import type { FrameContext, SetupContext } from '@mografy/runtime';
import { beats, keys, spring, at, bloom, buffer, ease as E } from '@mografy/runtime';
import { prepareStage, type Stage } from './three.js';
import { W, H, C, TAU, clamp, lerp, P, on2, eo, cv, rng, bakeKit, grain, storyCard, drawS04, drawS06, drawS08, drawS11, petalsOverlay, bakeFX, branches, dust, glints, godRays, leak, confetti, specks, vnoise, type Kit, type C2, type FX } from './paper.js';
import { buildWorld, resetWorld, render3D, setPose, setDrapes, footlights, setBulbs, setBackdrop, poseStars, setAudience, popAudience, drawScreen, setCityLit, camSet, setHouse, type World, type RenderOpts } from './world3d.js';

export const BEATS = beats([
  { title: 'S01 開場・跑馬燈', end: 4.5, stop: 3.6, handoff: .8, note: 'Marquee bulbs light one by one; pull back to the theatre on the maker\'s desk; drapes open.' },
  { title: 'S02 月上的兔子', end: 8, stop: 6.8, handoff: .8, note: 'Paper moon lowered; the moon rabbit with her mooncake; rack focus.' },
  { title: 'S03 地上的紙城鎮', end: 12, stop: 11.0, handoff: .5, note: 'Town flats rise in three layers; windows light one by one; a paper train crosses the viaduct.' },
  { title: 'S04 她的眼睛', end: 16, stop: 14.6, handoff: .6, note: '2D: profile close-up, the town lights in her eye; washi screen slides in.' },
  { title: 'S05 紙屏與拉門', end: 20, stop: 17.6, handoff: .6, note: 'Shadow play on the washi screen; it splits into shoji doors that slide open onto the sky.' },
  { title: 'S06 穿過雲海', end: 24, stop: 22.2, handoff: .6, note: '2D: she floats down through paper clouds; lands on 23.5.' },
  { title: 'S07 空蕩的舞台', end: 28.6, stop: 26.8, handoff: .4, note: 'One spotlight, empty seats; she trembles; the light flickers.' },
  { title: 'S08 深呼吸', end: 32, stop: 30.8, handoff: .6, note: '2D: a deep breath inside the circle of light; iris opens into 3D.' },
  { title: 'S09 第一首歌', end: 40, stop: 38.6, handoff: .8, note: 'She sings; fans arrive one per beat, then faster; penlights.' },
  { title: 'S10 翻面・月亮偶像', end: 43, stop: 42.2, handoff: .8, note: 'The puppet card flips to full colour on 40; footlights blaze; petals.' },
  { title: 'S11 月亮偶像海報', end: 46, stop: 45.0, handoff: .6, note: '2D poster; pulled away like a kamishibai card.' },
  { title: 'S12 她的每一夜', end: 54, stop: 50.4, handoff: .8, note: 'Push into the kamishibai box until the 2D card fills the frame; three cards.' },
  { title: 'S13 謝幕', end: 60, stop: 57.4, note: 'Curtain call, bow on 58; the drapes close, the house lights come up, fade.' },
]);
const DUR = BEATS.duration;
const inCubic = (p: number) => p * p * p;

export const meta = { width: W, height: H, duration: DUR, fps: 30, background: '#060a20', shots: BEATS.shots, tempo: { bpm: 120, beatsPerBar: 4, offset: 0 } };
export const params = {};

interface Assets { kit: Kit; stage: Stage<World>; fx: FX; frame: OffscreenCanvas }
export async function setup(ctx: SetupContext) {
  const kit = await bakeKit(ctx);
  const stage = await prepareStage(ctx, b => buildWorld(b, kit), { fov: 36, toneMapping: 'aces', exposure: 1 });
  (ctx.assets as Record<string, unknown>).lunar = { kit, stage, fx: bakeFX(), frame: bakeFrame() } satisfies Assets;
}

// ---------------------------------------------------------------- camera keys (3D sequences)
type CK = readonly [t: number, px: number, py: number, pz: number, lx: number, ly: number, lz: number, fov: number];
function camKeys(list: readonly CK[]) {
  const ch = [1, 2, 3, 4, 5, 6, 7].map(i => keys(list.map(k => [k[0], k[i]!] as const)));
  return (t: number) => ch.map(f => f(t));
}
const CAM_A = camKeys([ // S01–S03
  [0, 0, 3.22, 2.7, 0, 3.22, .6, 34],
  [1.35, 0, 3.2, 2.45, 0, 3.2, .6, 34],
  [2.3, .2, 1.9, 4.75, -.1, 3.75, 1.4, 54],
  [3.2, .2, 1.45, 4.7, 0, 1.45, 0, 50],
  [3.9, .15, 1.3, 4.3, 0, 1.3, -.1, 44],
  [4.5, .14, 1.3, 3.1, .4, 1.55, -.95, 32],
  [7.5, .15, 1.7, 2.2, .5, 1.8, -.95, 28],
  [8.3, 0, 2.05, 1.6, 0, 1.45, -1.2, 36],
  [11.55, .25, .62, 1.75, 0, .78, -1.1, 36],
  [12, .22, .6, 1.25, .12, .62, -1.05, 30],
]);
const CAM_B = camKeys([ // S05
  [16, 0, 1.18, 2.95, 0, 1.18, -.25, 36],
  [17.9, 0, 1.16, 3.45, 0, 1.15, -.3, 36],
  [19.0, 0, 1.18, 2.85, 0, 1.18, -.25, 36],
  [20, 0, 1.18, 2.8, 0, 1.18, -.25, 36],
]);
const CAM_C = camKeys([[24, .5, .46, 4.6, 0, .64, -.45, 30], [28.6, .3, .48, 3.45, 0, .68, -.45, 30]]);
const CAM_E = camKeys([ // S10
  [40, 0, .3, 2.15, 0, .92, -.45, 38], [40.4, 0, .3, 2.1, 0, .94, -.45, 38], [42.7, .38, .5, 2.4, 0, 1.0, -.45, 38], [43, .4, .52, 2.42, 0, 1.0, -.45, 38],
]);
const CAM_F = camKeys([ // S12
  [46, 0, .95, 2.6, 0, .95, -.35, 34], [46.5, 0, .97, 2.4, 0, .98, -.35, 34], [48, 0, 1.1, 1.079, 0, 1.1, -.35, 34],
  [53.3, 0, 1.1, 1.079, 0, 1.1, -.35, 34], [54, 0, .95, 2.6, 0, .95, -.35, 34],
]);
const CAM_G = camKeys([ // S13: pull back through the house (never past its back wall) and hold on the closing drapes
  [54, 0, .95, 2.6, 0, .95, -.35, 34], [55.2, 0, 1.0, 3.3, 0, .95, -.2, 34], [56.4, .12, 1.25, 4.4, 0, 1.12, -.25, 40],
  [58.2, .14, 1.68, 4.65, 0, 1.72, -.2, 58], [60, .1, 1.72, 4.75, 0, 1.76, -.2, 58],
]);
function cam(w: World, k: number[], t: number) {
  const a = .0055, sx = vnoise(t * .9, 11) * a, sy = vnoise(t * .8, 12) * a, lx = vnoise(t * .7, 13) * a * .6, ly = vnoise(t * .75, 14) * a * .6;
  camSet(w, [k[0]! + sx, k[1]! + sy, k[2]!], [k[3]! + sx + lx, k[4]! + sy + ly, k[5]!], k[6]!);
}

// fans arrive one per beat at first, then faster (ease-in schedule)
const FANS = 104, FAN0 = 32.5, FAN_SPAN = 7;
const fanTime = (i: number) => FAN0 + FAN_SPAN * Math.pow(i / FANS, .45);
const fansAt = (t: number) => t < FAN0 ? 0 : Math.min(FANS, Math.floor(FANS * Math.pow(clamp((t - FAN0) / FAN_SPAN), 1 / .45)) + 1);

// ---------------------------------------------------------------- 3D poses per shot
function poseS01(w: World, t: number): RenderOpts {
  const tt = on2(t);
  poseStars(w, t); footlights(w, clamp((tt - 1.6) / .8)); setDrapes(w, 1 - E.inOutCubic(P(tt, 2.6, 3.75)));
  setBulbs(w, Math.floor(clamp((tt - .3) / 1.0) * 26));
  w.moonKey.intensity = .1 + .2 * P(t, 1.4, 2.6); w.warm.intensity = 3 * P(t, 1.5, 2.5); w.hemi.intensity = .12 + .22 * P(t, 1.4, 2.6);
  w.prosMat.emissiveIntensity = .6 * clamp((tt - 1.6) / .8); w.scene.environmentIntensity = .04 + .21 * P(t, 1.3, 2.4);
  // the house comes up as the camera pulls back into the opera house, then goes down as the drapes open
  setHouse(w, P(t, 1.5, 2.2) * (1 - .8 * P(t, 2.6, 3.6)), false);
  cam(w, CAM_A(t), t);
  return { near: t > 2.4 ? 2.4 : 0, fgBlur: 14, bloom: .4 };
}
function poseS02(w: World, t: number): RenderOpts {
  poseStars(w, t); footlights(w, 1); setDrapes(w, 0);
  w.moon.visible = true;
  const tt = on2(t), steps = Math.floor((tt - 4.45) * 12);
  const drop = tt < 4.2 ? 0 : steps < 3 ? eo((steps + 3) / 9) : steps < 6 ? eo((steps + 3) / 9) : steps === 6 ? 1.06 : 1;
  const flyUp = inCubic(P(t, 7.55, 8.05));
  w.moon.position.set(.55, lerp(3.2, 1.3, drop) + flyUp * 2.4, -.95); w.moon.rotation.z = Math.sin(tt * 1.5) * .02;
  const beat = (tt * 2) % 1; w.mallet.rotation.z = beat < .33 ? -.9 : beat < .66 ? -.3 : .2;
  w.garland.forEach(g => { if (g.userData.front) g.visible = false; }); w.garLines.forEach(l => { if (l.userData.front) l.visible = false; });
  w.warm.intensity = 2.2; w.prosMat.emissiveIntensity = .6; setHouse(w, .35, false);
  const fs = w.stars[0]; fs.position.set(-.05, 1.62, 1.05); fs.scale.setScalar(1.2);
  cam(w, CAM_A(t), t);
  const rack = E.inOutCubic(P(t, 5.6, 6.2)); // focus from the foreground star to the rabbit
  return { near: 1.6, fgBlur: lerp(2, 22, rack), bloom: .18 };
}
function poseS03(w: World, t: number): RenderOpts {
  poseStars(w, t); footlights(w, 1); setDrapes(w, 0); setBackdrop(w, 'foot', 0);
  w.moon.visible = true; w.moon.position.set(.95, lerp(3.6, 1.62, E.outCubic(P(t, 8.0, 8.9))), -1.5);
  w.city.forEach(c => c.visible = true);
  const tt = on2(t), rise = [0, 1, 2, 3].map(i => eo(clamp(Math.floor(P(tt, 8.2 + i * .25, 10.2 + i * .25) * 6) / 6)));
  setCityLit(w, rise, P(tt, 9, 12)); setHouse(w, .35, false);
  // a paper train crosses the viaduct, stepped on 2s with a little chug
  const tr = P(tt, 9.4, 11.9); w.train.visible = true; w.train.position.x = lerp(3.3, -3.3, tr); w.train.position.y = .577 + (Math.floor(tt * 12) % 2) * .004;
  w.train.userData.mat.emissiveIntensity = 1.3;
  w.warm.intensity = 1.2; w.moonKey.intensity = .7; w.prosMat.emissiveIntensity = .5;
  w.garland.forEach(g => { if (g.userData.front) g.visible = false; }); w.garLines.forEach(l => { if (l.userData.front) l.visible = false; });
  cam(w, CAM_A(t), t);
  return { near: 1.0, bloom: .45 + .5 * P(t, 11.6, 12) };
}
function poseS05(w: World, t: number): RenderOpts {
  footlights(w, .6); setDrapes(w, 0); w.stars.forEach(s => s.visible = false); w.clouds.visible = false;
  w.screen.visible = true;
  const tt = on2(t), u = P(tt, 16, 23.5); drawScreen(w, u, tt);
  w.moonKey.intensity = .25; w.hemi.intensity = .2; w.prosMat.emissiveIntensity = .3;
  cam(w, CAM_B(t), t);
  return { bloom: .3, exposure: .9 };
}
function poseS07(w: World, t: number): RenderOpts {
  setDrapes(w, 0); poseStars(w, t);
  w.pup.visible = true; setPose(w, w.pup, 'happy', 'sad');
  const tt = on2(t), tremble = Math.sin(tt * 40) * .004 * (tt > 26 ? 1.6 : 1);
  w.pup.rotation.y = Math.PI * .92 + Math.sin(tt * 37) * .01; w.pup.position.set(0, .66 + tremble, -.45);
  const flick = Math.abs(t - 28.6) < .07 ? .15 : 1;
  w.spot.intensity = 5 * flick; w.cone.visible = true; w.pool.material.opacity = .25 * flick; w.rim.intensity = 2.5; w.dust.visible = true;
  w.dust.rotation.y = tt * .05;
  w.moonKey.intensity = .08; w.hemi.intensity = .08; w.prosMat.emissiveIntensity = .05; w.scene.fog.density = .06;
  cam(w, CAM_C(t), t);
  return { near: 2.6, fgBlur: 7, bloom: .45, exposure: 1.0 };
}
function poseS09(w: World, t: number): RenderOpts {
  setDrapes(w, 0); poseStars(w, t); w.clouds.visible = false;
  w.pup.visible = true; w.pup.position.set(0, .66 + Math.max(0, Math.sin(on2(t) * Math.PI * 2)) * .01, -.45); w.pup.rotation.y = Math.PI;
  const n = fansAt(on2(t)); setAudience(w, n, t, P(t, 37, 39));
  for (let i = Math.max(0, n - 6); i < n; i++) popAudience(w, i, on2(t) - fanTime(i));
  w.notes.forEach((m, i) => { const ph = ((t - 32.2) * .35 + i / 6) % 1; m.visible = t > 32.2; m.position.set(-.5 + (i % 3) * .5 + Math.sin(i) * .1, .9 + Math.floor(ph * 12) / 12 * 1.5, -.5 + (i % 2) * .2); m.rotation.z = Math.sin(on2(t) * 2 + i) * .3; });
  w.rim.intensity = 1.6; w.dust.visible = true; w.dust.rotation.y = t * .05;
  w.spot.intensity = 2.2; w.cone.visible = true; w.pool.material.opacity = .2;
  const lift = P(t, 36, 39.5); footlights(w, lift * .55 + P(t, 39.6, 40) * .15); setHouse(w, P(t, 36.5, 39.5), t > 37.6); w.hemi.intensity = .1 + lift * .15; w.moonKey.intensity = .1 + lift * .2;
  if (t > 39.5) { setBackdrop(w, 'end', .32 * P(t, 39.5, 40.3)); w.backdrop.position.y = lerp(4.2, 1.35, E.outCubic(P(t, 39.5, 40.3))); }
  // orbit around her front while she sings (kept in frame), then turn to the filling hall, then swing to S10
  const a = E.inOutCubic(P(t, 32, 35.2)), b = E.inOutCubic(P(t, 35.2, 36.4)), c = P(t, 36.4, 39.5);
  const ang1 = lerp(.45, .85, a), rad1 = lerp(3.1, 2.2, a), ang2 = lerp(1.72, 1.82, c), rad2 = lerp(1.38, 1.25, c);
  const o1 = [Math.sin(ang1) * rad1, lerp(.95, 1.05, a), -.45 + Math.cos(ang1) * rad1, 0, .72, -.45, 34];
  const o2 = [Math.sin(ang2) * rad2, lerp(1.45, 1.55, c), -.45 + Math.cos(ang2) * rad2, lerp(-.2, -.3, c), .35, 1.5, 42];
  const orb = o1.map((v, i) => lerp(v, o2[i]!, b));
  const sw = E.inOutCubic(P(t, 39.5, 40)), end = CAM_E(40);
  cam(w, orb.map((v, i) => lerp(v, end[i]!, sw)), t);
  return { near: .5, fgBlur: 12, bloom: .4, exposure: .8 };
}
function poseS10(w: World, t: number): RenderOpts {
  setDrapes(w, 0); poseStars(w, t); w.clouds.visible = false;
  w.pup.visible = true; setPose(w, w.pup, 'happy', 'moonlight');
  const step = clamp(Math.floor((t - 40) * 12 + 1e-6), 0, 3); w.pup.rotation.y = Math.PI * (1 - step / 3);
  const hop = t < 40.4 ? 0 : Math.max(0, Math.sin((on2(t) - 40.4) * Math.PI * 2)) * .04;
  w.pup.position.set(0, .66 + hop, -.45);
  footlights(w, 1); const lit = P(t, 40.2, 40.8); w.footLights.forEach(l => l.intensity = lerp(1.0, 1.8, lit)); w.warm.intensity = lerp(.6, 1.2, lit); w.rim.intensity = lerp(1.2, 2.2, lit); w.hemi.intensity = .35; w.moonKey.intensity = .5;
  w.prosMat.emissiveIntensity = 1.2;
  setBackdrop(w, 'end', .32 * (.5 + .5 * P(t, 40.2, 40.8))); w.backdrop.position.y = lerp(4.2, 1.35, E.outCubic(P(t, 39.5, 40.3)));
  setAudience(w, FANS, t, 1); setHouse(w, 1);
  w.petals.forEach((p, i) => { const d = p.userData; p.visible = t > 40.1; const y = d.y + 3 - ((t - 40) * d.sp) % 3.2; p.position.set(d.x + Math.sin(t + i) * .1, y, d.z); p.rotation.set(t * d.s * 3, t * 2 + i, i); });
  cam(w, CAM_E(t), t);
  return { near: .9, fgBlur: 10, bloom: .2, exposure: .72 };
}
function poseS12(w: World, t: number): RenderOpts {
  setDrapes(w, E.inOutCubic(P(t, 53.4, 53.85))); poseStars(w, t); footlights(w, 1);
  w.kami.visible = true; w.hemi.intensity = .3; setHouse(w, 1); w.warm.intensity = 3; w.prosMat.emissiveIntensity = .9;
  setBackdrop(w, 'stage2', .35); w.clouds.visible = false; w.seatRows.forEach(r => r.visible = false);
  const card = t < 48.8 ? 0 : t < 51.5 ? 1 : 2; w.kamiCards.forEach((c, i) => c.visible = i >= card);
  cam(w, CAM_F(t), t);
  return { bloom: .35 };
}
function poseS13(w: World, t: number): RenderOpts {
  poseStars(w, t); footlights(w, 1);
  w.pup.visible = true; setPose(w, w.pup, 'arrival', 'moonlight'); w.pup.rotation.y = 0;
  const bow = on2(t) >= 57.9 && on2(t) < 58.9 ? (on2(t) < 58.0 ? -.07 : -.14) : 0; w.pup.rotation.x = bow; w.pup.position.set(0, .66, -.45);
  setAudience(w, FANS, t, 1); setHouse(w, .75 + .25 * P(t, 59.0, 59.6));
  setBackdrop(w, 'end', .22); w.clouds.visible = false;
  setBulbs(w, Math.floor(P(on2(t), 54.6, 56.2) * 26), on2(t) > 56.2 && t < 59 ? Math.floor(on2(t) * 6) % 3 : -1);
  w.prosMat.emissiveIntensity = 1.0; w.warm.intensity = 1.4; w.hemi.intensity = .3 + .2 * P(t, 56.5, 59); w.moonKey.intensity = .55 + .3 * P(t, 56.5, 59);
  setDrapes(w, Math.max(1 - E.outCubic(P(t, 54.1, 54.8)), E.inOutCubic(P(t, 58.3, 59.0))));
  const k = CAM_G(t), a = P(t, 55.2, 58.2); cam(w, k, t);
  w.scene.fog.density = lerp(.03, .018, a);
  return { near: a < .15 ? 1.2 : 2.0, fgBlur: 10, bloom: .3, exposure: .85 };
}
const POSE3D: Record<number, (w: World, t: number) => RenderOpts> = { 0: poseS01, 1: poseS02, 2: poseS03, 4: poseS05, 6: poseS07, 8: poseS09, 9: poseS10, 11: poseS12, 12: poseS13 };

function draw3D(ctx: FrameContext, A: Assets, index: number, t: number, alpha = 1) {
  const w = A.stage.objects; resetWorld(w);
  const o = POSE3D[index]!(w, t);
  render3D(ctx, A.stage, { ...o, alpha });
}

// ---------------------------------------------------------------- 2D overlays and transitions
const CARDS: { text: string; x: number; y: number; size: number; inAt: number; outAt: number }[] = [
  { text: '很久很久以前，／月亮上住著一隻兔子。', x: 1590, y: 110, size: 60, inAt: 4.75, outAt: 7.4 },
  { text: '每一盞燈下，／都有睡不著的人。', x: 300, y: 120, size: 62, inAt: 12.3, outAt: 15.35 },
  { text: '於是她決定，／親自去陪他們。', x: 300, y: 90, size: 60, inAt: 20.3, outAt: 23.35 },
  { text: '第一次站上舞台，／台下，空無一人。', x: 1600, y: 100, size: 58, inAt: 24.55, outAt: 28.2 },
  { text: '她還是開口唱了。／一盞、兩盞……', x: 1600, y: 90, size: 56, inAt: 32.45, outAt: 34.9 },
  { text: '今晚，陪伴著你。', x: 1640, y: 110, size: 60, inAt: 55.1, outAt: 58.35 },
];
function storyCards(c: C2, t: number) {
  for (const k of CARDS) {
    if (t < k.inAt || t > k.outAt + .5) continue;
    const drop = spring(t, k.inAt, .7, .22) * (1 - at(t, k.outAt, k.outAt + .4, inCubic));
    const sway = Math.sin((t - k.inAt) * 2.2) * Math.exp(-(t - k.inAt) * 1.2) * .6;
    storyCard(c, k.text, k.x, k.y, k.size, drop, sway);
  }
}
/** One paper cloud bank sweeping right → left across the frame, fully covering it at `mid` (the cut). */
function cloudWipe(c: C2, kit: Kit, t: number, mid: number) {
  const u = (t - (mid - .5)) / 1.0; if (u <= 0 || u >= 1) return;
  c.drawImage(kit.cloudBank, lerp(W - 250, -3350, E.inOutCubic(u)), 0);
}
/** The washi screen fills the frame; its two halves slide apart like shoji doors, carrying her shadow away, into the 2D sky. */
function shojiDoors(c: C2, A: Assets, t: number) {
  if (t < 19.05 || t >= 20) return;
  const sc = A.stage.objects.screenCanvas, sy = (sc.height - sc.width * H / W) / 2, sh = sc.width * H / W, half = sc.width / 2;
  const show = P(t, 19.05, 19.2), u = E.inOutCubic(P(t, 19.25, 19.97)), off = u * (W / 2 + 120);
  if (u > 0) {
    drawS06(c, A.kit, 20);
    const g = c.createLinearGradient(W / 2 - off - 200, 0, W / 2 + off + 200, 0);
    g.addColorStop(0, 'rgba(220,232,255,0)'); g.addColorStop(.5, `rgba(235,242,255,${.55 * (1 - u)})`); g.addColorStop(1, 'rgba(220,232,255,0)');
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
  }
  c.save(); c.globalAlpha = show;
  for (const side of [-1, 1]) {
    c.save(); c.translate(side * off, 0);
    c.shadowColor = 'rgba(0,0,10,.55)'; c.shadowBlur = 40; c.shadowOffsetX = side * 14;
    c.drawImage(sc, side < 0 ? 0 : half, sy, half, sh, side < 0 ? 0 : W / 2, 0, W / 2, H);
    c.shadowColor = 'transparent'; c.fillStyle = '#3a2216'; c.fillRect(side < 0 ? W / 2 - 16 : W / 2, 0, 16, H);
    c.fillStyle = '#c9a77a'; c.fillRect(side < 0 ? W / 2 - 60 : W / 2 + 44, H / 2 - 40, 16, 80);
    c.restore();
  }
  c.restore();
}
/** S04 → S05: two shoji doors slide shut from both sides. They show the real 3D screen of 16.0, so when they meet
 *  the frame is already the first frame of S05 (the meeting stiles add up to the lattice's centre bar). Mirrors the doors opening at 19. */
function shojiClose(ctx: FrameContext, A: Assets, t: number) {
  const u = P(t, 15.5, 16.0); if (u <= 0 || t >= 16) return;
  const off = E.inOutCubic(u) * W / 2, el = ctx.canvas.canvas, pw = el.width, ph = el.height;
  // keep S04, render the 3D screen of 16.0 over the frame, keep that too, then put S04 back and slide each half of the screen in
  const s04 = buffer('shoji-s04', pw, ph), scr = buffer('shoji-scr', pw, ph);
  const b1 = s04.getContext('2d')!, b2 = scr.getContext('2d')!;
  b1.clearRect(0, 0, pw, ph); b1.drawImage(el, 0, 0);
  draw3D(ctx, A, 4, 16);
  b2.clearRect(0, 0, pw, ph); b2.drawImage(el, 0, 0);
  ctx.withCanvas(c => {
    c.drawImage(s04, 0, 0, W, H);
    for (const left of [true, false]) { const x = left ? off : W - off, d = left ? 1 : -1, g = c.createLinearGradient(x, 0, x + d * 90, 0); g.addColorStop(0, 'rgba(4,6,24,.5)'); g.addColorStop(1, 'rgba(4,6,24,0)'); c.fillStyle = g; c.fillRect(Math.min(x, x + d * 90), 0, 90, H); }
    c.drawImage(scr, 0, 0, pw / 2, ph, off - W / 2, 0, W / 2, H);
    c.drawImage(scr, pw / 2, 0, pw / 2, ph, W - off, 0, W / 2, H);
    c.fillStyle = '#24150e'; c.fillRect(off - 8, 0, 8, H); c.fillRect(W - off, 0, 8, H);
    c.fillStyle = 'rgba(150,110,80,.5)'; c.fillRect(off - 8, 0, 2, H); c.fillRect(W - off, 0, 2, H);
  });
}
function posterPull(c: C2, kit: Kit, t: number) {
  const u = P(t, 45.6, 46.1);
  c.save(); c.translate(lerp(0, -W * 1.15, inCubic(u)), 0); c.rotate(-.04 * u);
  c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 40; c.shadowOffsetX = 20;
  drawS11(c, kit, t, spring(t, 43.3, .5, .25)); c.restore();
}
/** The kamishibai frame as seen at 48.0: wooden side bars over the card's edges, dark box interior above and below. */
function bakeFrame() {
  const c = cv(W, H), g = c.getContext('2d')!, r = rng(81), BW = 70;
  for (const left of [true, false]) {
    const x0 = left ? 0 : W - BW, inner = left ? BW : W - BW, dir = left ? 1 : -1;
    const sg = g.createLinearGradient(inner, 0, inner + dir * 30, 0); sg.addColorStop(0, 'rgba(12,5,2,.5)'); sg.addColorStop(1, 'rgba(12,5,2,0)'); g.fillStyle = sg; g.fillRect(Math.min(inner, inner + dir * 30), 0, 30, H);
    const wg = g.createLinearGradient(x0, 0, x0 + BW, 0); wg.addColorStop(0, '#4a2f1e'); wg.addColorStop(left ? .85 : .15, '#6a4630'); wg.addColorStop(1, '#4a2f1e'); g.fillStyle = wg; g.fillRect(x0, 0, BW, H);
    for (let i = 0; i < 46; i++) { g.strokeStyle = r() < .55 ? 'rgba(20,8,2,.22)' : 'rgba(255,215,170,.08)'; g.lineWidth = .7 + r() * 1.6; const x = x0 + 4 + r() * (BW - 8); g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - .5) * 10, H * .3, x + (r() - .5) * 10, H * .7, x + (r() - .5) * 6, H); g.stroke(); }
    g.fillStyle = 'rgba(255,214,160,.28)'; g.fillRect(left ? BW - 4 : W - BW, 0, 4, H);
  }
  return c;
}
function cardsFull(c: C2, A: Assets, t: number) {
  // the box's card fills the frame exactly from 48.0 (camera z 1.079): the same canvases, pulled out sideways under the frame at 48.6 and 51.3
  const kit = A.kit, pulls = [48.6, 51.3], CW = W - 140, CH = Math.round(CW * .8 / 1.42), CY = (H - CH) / 2;
  c.fillStyle = '#170c08'; c.fillRect(0, 0, W, H);
  for (let i = 2; i >= 0; i--) {
    const pullAt = pulls[i], u = pullAt === undefined ? 0 : P(t, pullAt, pullAt + .4);
    if (u >= 1) continue;
    c.save(); c.translate(-W * 1.1 * inCubic(u), 0); c.rotate(-.03 * u);
    c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 24; c.shadowOffsetX = u > 0 ? 18 : 0;
    c.drawImage(kit.cards[i]!, 70, CY, CW, CH); c.restore();
  }
  c.drawImage(A.frame, 0, 0);
}

// ---------------------------------------------------------------- frame
export function renderFrame(ctx: FrameContext, time: number) {
  const A = (ctx.assets as Record<string, unknown>).lunar as Assets, kit = A.kit;
  const t = Math.min(time, DUR - .001), { beat } = BEATS.at(t), i = beat.index;
  ctx.withCanvas(c => { c.fillStyle = '#060a20'; c.fillRect(0, 0, W, H); });

  if (i === 3) ctx.withCanvas(c => drawS04(c, kit, t));
  else if (i === 5) ctx.withCanvas(c => drawS06(c, kit, t));
  else if (i === 7) ctx.withCanvas(c => drawS08(c, kit, t));
  else if (i === 10) ctx.withCanvas(c => drawS11(c, kit, t, spring(t, 43.3, .5, .25)));
  else if (i === 11 && t >= 48 && t < 53.3) ctx.withCanvas(c => cardsFull(c, A, t));
  else draw3D(ctx, A, i, t);

  // handoffs
  if (i === 3 && t > 15.5) shojiClose(ctx, A, t);
  if (i === 7 && t > 31.75) { // iris opens from the circle of light into the 3D hall
    const r = lerp(470, 1250, E.inOutCubic(P(t, 31.75, 32))), path = new Path2D(); path.arc(W / 2, 470, r, 0, TAU);
    ctx.clip(path, () => draw3D(ctx, A, 8, 32));
  }
  if (i === 10 && t > 45.6) { ctx.withCanvas(c => { c.fillStyle = '#060a20'; c.fillRect(0, 0, W, H); }); draw3D(ctx, A, 11, 46); ctx.withCanvas(c => posterPull(c, kit, t)); }
  ctx.withCanvas(c => {
    shojiDoors(c, A, t); cloudWipe(c, kit, t, 24);
    if (t > 42.3 && t < 43.7) { petalsOverlay(c, kit, t, 42.3, .7); petalsOverlay(c, kit, t + .35, 42.3, .7); const pv = Math.exp(-(((t - 43) / .12) ** 2)); if (pv > .01) { c.fillStyle = `rgba(255,214,232,${pv * .85})`; c.fillRect(0, 0, W, H); } }
    // window glow swallows the frame as S03 pushes into a lit window
    if (t > 11.7 && t < 12.25) { const a = Math.sin(P(t, 11.7, 12.25) * Math.PI) * .85; c.fillStyle = `rgba(255,214,140,${a})`; c.fillRect(0, 0, W, H); }
    // the spotlight's flicker becomes a white flash
    const fl = Math.exp(-(((t - 28.62) / .05) ** 2)); if (fl > .01) { c.fillStyle = `rgba(255,248,236,${fl * .9})`; c.fillRect(0, 0, W, H); }
    // 40 downbeat: a warm burst
    const bu = Math.exp(-(((t - 40.02) / .08) ** 2)); if (bu > .01) { c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,190,150,${bu * .18})`; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; }
    // 2D effects
    if (t < 4.6) { branches(c, A.fx, t, P(t, 1.7, 2.6) * (1 - P(t, 3.8, 4.4)) * .9); dust(c, A.fx, t, P(t, 1.4, 2.4) * .7); }
    leak(c, t, 4.25, .7);
    if (t > 4.7 && t < 8) glints(c, A.fx, t, [[1220, 520, 70, 0], [700, 300, 46, 1.7], [1480, 840, 52, 3.1], [860, 760, 40, 4.2], [1660, 420, 36, 5.3], [520, 640, 30, 2.4]], P(t, 4.8, 5.4) * (1 - P(t, 7.6, 8)));
    if (t > 24 && t < 28.6) dust(c, A.fx, t, .75, 40, [640, 0, 640, H]);
    if (t > 32 && t < 36.5) dust(c, A.fx, t, .5, 34, [500, 0, 900, H]);
    if (t > 39.8 && t < 43.1) { godRays(c, 960, 470, t, P(t, 40.1, 40.6) * (1 - P(t, 42.6, 43)) * .7); glints(c, A.fx, t * 1.6, [[640, 300, 70, 0], [1300, 260, 80, 1], [560, 640, 50, 2], [1380, 600, 60, 3], [760, 880, 44, 4], [1180, 900, 46, 5]], P(t, 40, 40.3) * (1 - P(t, 42.6, 43))); }
    leak(c, t, 39.95, .6, '255,170,190');
    if (t > 48 && t < 53.3) glints(c, A.fx, t, [[1300, 200, 40, 0], [1660, 520, 34, 2], [960, 820, 30, 4]], .8);
    leak(c, t, 54.15, .8, '255,190,140');
    if (t > 57.85) confetti(c, t, 57.9);
    if (t > 56.8) branches(c, A.fx, t, P(t, 56.8, 57.8) * .6);
    storyCards(c, t);
    // paper grain (stop-motion: re-seeded 12 times a second) and a soft vignette
    const f = Math.floor(t * 12), ox = Math.floor(ctx.noise(f, 1) * 1024), oy = Math.floor(ctx.noise(f, 2) * 1024);
    grain(c, W, H, .07, 'overlay', ox, oy);
    specks(c, t);
    const tone = c.createLinearGradient(0, 0, 0, H); tone.addColorStop(0, 'rgba(48,80,192,.14)'); tone.addColorStop(1, 'rgba(255,150,110,.10)');
    c.save(); c.globalCompositeOperation = 'soft-light'; c.fillStyle = tone; c.fillRect(0, 0, W, H); c.restore();
    const v = c.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .95); v.addColorStop(0, 'rgba(0,0,10,0)'); v.addColorStop(1, 'rgba(2,4,20,.5)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
    // the last second fades to the lit sign
    if (t > 59.5) { c.fillStyle = `rgba(4,6,18,${E.inOutSine(P(t, 59.5, 60))})`; c.fillRect(0, 0, W, H); }
  });
  // halation: highlights bleed a warm glow, like light on film
  const frameEl = ctx.canvas.canvas;
  bloom(ctx, c => { c.filter = 'brightness(.55) contrast(2.4) sepia(.5) saturate(2)'; c.drawImage(frameEl, 0, 0, W, H); c.filter = 'none'; }, { radius: 12, strength: .12, halo: .7 });
  void C;
}
