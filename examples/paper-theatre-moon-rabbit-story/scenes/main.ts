// 來自月亮的偶像 — Lunar Pop Club story. 60 s, 1920 × 1080, 30 fps, 120 BPM (bar 2 s), cut to assets/music.mp3.
//
// One paper toy theatre, one camera. Moonlight travels through the film: the moon, the town's windows, the beam she
// floats down, the single spotlight in the empty hall, the audience's penlights, and finally the whole stage.
//
//  序    0– 8  drapes open, the moon is lowered; the rabbit pounds mochi on top of it (a tok on every beat)
//  起    8–16  the moon is flown up, a paper town rises and its windows light one by one
//  承   16–24  washi screen: her shadow floats down the moonbeam under a parasol; lands on 23.5; the screen rolls up
//  轉   24–32  the empty hall: one spotlight, empty seats; she trembles
//  初唱 32–40  she sings: notes rise, the audience arrives one by one with penlights
//  合   40–46  the backdrop flies in and on the 40 downbeat she flips from her moon side to full colour; banner
//  每夜 46–54  the promo's kamishibai chapter cards (01 登場, 02 魅力, 03 節拍), retimed to this score
//  謝幕 54–60  curtain call: the bow, the marquee, the ribbon; the drapes close on the lit header
//
// Props, flats, puppets and cards move on 2s (12 poses a second) with a seeded boil; camera, light and type stay smooth.
import { at, beats, cameraPath, ease, keys, lerp, pr, settle, spring, tempoGrid, withCamera } from '@mografy/runtime';
import type { FrameContext, SetupContext } from '@mografy/runtime';
import { C, H, OP, OPB, PAINTED_MOON, TAU, W, prepare, put, type G, type Kit } from './lib.js';
import { cardPose, curtains, drawBackdrop, drawCard, drawPuppet, fan, fields, marquee, popups, string, type F, type PuppetPose } from './promo.js';
import { AUDIENCE, LANDING, RISER, descent, hall, mochi, note, paperMoon, prepareStory, riser, spotlight, storyCard, town, WINDOW_COUNT, type StoryKit } from './story.js';

const tempo = { bpm: 120, beatsPerBar: 4 };
const grid = tempoGrid(tempo);
const B = (n: number, k = 0) => grid.onBar(n, k);   // bar n (2 s each) plus k beats

export const BEATS = beats([
  { title: '序 月上的兔子', end: B(4), stop: 6.0, handoff: 1.0, note: 'Drapes open; the moon is lowered; the rabbit pounds mochi.' },
  { title: '起 地上的燈火', end: B(8), stop: 14.4, handoff: .8, note: 'The town rises and its windows light.' },
  { title: '承 沿著月光', end: B(12), stop: 21.0, handoff: .8, note: 'Her shadow floats down the moonbeam; the screen rolls up.' },
  { title: '轉 空蕩的舞台', end: B(16), stop: 29.0, handoff: .6, note: 'One spotlight, empty seats.' },
  { title: '初唱 一盞、兩盞', end: B(20), stop: 38.0, handoff: .8, note: 'She sings; the audience arrives with penlights.' },
  { title: '合 月亮偶像登場', end: B(23), stop: 43.5, handoff: .8, note: 'Backdrop in, the flip on 40, banner.' },
  { title: '每夜 登場・魅力・節拍', end: B(27), stop: 50.4, handoff: .8, note: 'Kamishibai chapter cards.' },
  { title: '謝幕 今晚，陪伴著你', end: 60, stop: 58.4, note: 'Curtain call; the drapes close on the lit header.' },
]);
export const meta = { width: W, height: H, duration: BEATS.duration, fps: 30, background: C.room, tempo, shots: BEATS.shots };
export const params = {
  grain: { name: 'Paper grain', type: 'number' as const, default: .1, min: 0, max: .3, step: .01 },
  motion: { name: 'Motion', type: 'enum' as const, default: 'stop-motion', options: ['stop-motion', 'smooth'] },
};
interface Assets { k: Kit; sk: StoryKit }
export async function setup(ctx: SetupContext) { const k = await prepare(ctx); ctx.assets.story = { k, sk: prepareStory() } satisfies Assets; }

// ---------------------------------------------------------------- time helpers
const io = ease.inOutCubic, inC = (p: number) => p * p * p;
const boil = (f: F, id: number, amt = .005) => f.smooth ? 0 : (f.noise(id, f.pose) - .5) * 2 * amt;
/** Story time → the promo's time, for the chapter cards and the curtain call it already choreographs. */
const toPromo = keys([[45.0, 15.0], [45.6, 15.6], [46.05, 16.05], [48.4, 17.6], [49.1, 18.3], [51.1, 19.6], [51.8, 20.3], [53.4, 21.4], [54.0, 22.0], [54.6, 22.6], [56.6, 23.8], [57.2, 24.2], [60, 25.6]]);
const promoF = (f: F): F => { const t = toPromo(f.s); return { ...f, t, s: t }; };

// ---------------------------------------------------------------- the camera
const camera = cameraPath([
  [0, 960, 548, 1.0], [2.6, 960, 546, 1.0], [7.6, 960, 560, 1.05],
  [8.8, 960, 545, 1.0], [15.6, 960, 545, 1.0],
  [16.2, 960, 545, 1.0], [23.6, 940, 548, 1.08],
  [24.4, 930, 560, 1.08], [31.6, 960, 560, 1.12],
  [33.6, 960, 556, 1.04], [39.4, 960, 550, 1.02], [40.6, 960, 545, 1.0], [45.4, 960, 545, 1.0],
  [46.6, 900, 552, 1.05], [48.4, 892, 552, 1.05], [49.2, 1010, 552, 1.05], [51.1, 1018, 552, 1.05], [51.9, 914, 552, 1.06], [53.4, 906, 552, 1.08],
  [54.4, 960, 545, 1.0], [60, 960, 540, .97],
]);

// ---------------------------------------------------------------- light
/** Footlights and lanterns: on at 0.5, down for the empty hall, rising with the audience, full on the 40 downbeat. */
function lights(t: number) {
  if (t < .5) return 0; if (t < .58) return .5;
  if (t < 23.8) return 1; if (t < 32) return lerp(1, .22, io(pr(t, 23.8, 24.4)));
  if (t < 39.95) return lerp(.22, .6, pr(t, 32, 39.5));
  if (t < 59) return 1; return lerp(1, .35, pr(t, 59, 59.9));
}
function drapes(s: number) {
  if (s < 53.4) return io(pr(s, 1.0, 2.6));
  if (s < 54.15) return 1 - inC(pr(s, 53.4, 54.0));
  if (s < 59) return io(pr(s, 54.15, 54.75));
  return 1 - io(pr(s, 59.0, 59.9));
}
function headerLit(s: number, t: number) {
  if (s < 40) return 0; if (s < 40.08) return .6; if (s < 40.16) return .2;
  return t > 54 ? .8 + .2 * Math.exp(-((t - 54) % .5) / .5 * 4) : 1;
}

// ---------------------------------------------------------------- 序 / 起: the moon, the rabbit, the town
const moonX = keys([[7.6, 960], [8.6, 1200]]), moonY = keys([[7.6, 650], [8.6, 560]]), moonR = keys([[7.6, 170], [8.6, 120]]);
function moonAndRabbit(c: G, a: Assets, f: F) {
  const s = f.s; if (s >= 16.0) return;
  const drop = 1 - spring(s, 1.9, .6, .2), x = moonX(s), y = moonY(s) - drop * 760, r = moonR(s);
  string(c, x - r * .42, OP.y - 30, y - r * .92); string(c, x + r * .42, OP.y - 30, y - r * .92);
  c.save(); c.translate(x, y); c.rotate(boil(f, 2, .003)); c.translate(-x, -y); paperMoon(c, a.k, x, y, r); c.restore();
  // the rabbit on top, pounding mochi on every beat from 2.5 to 7.5
  const k = r / 170, feet = y - r + 6, beatU = s >= 2.5 && s < 7.6 ? ((s - 2.5) % .5) / .5 : .5;
  const swing = (Math.cos(TAU * beatU) + 1) / 2;
  const hit = s >= 2.5 && s < 7.6 && beatU < .17 ? .03 : 0;
  drawPuppet(c, a.k, { x: x - 35 * k, y: feet, h: 160 * k, rot: hit + boil(f, 3), sx: 1, face: 'back', on: true }, 'back', false);
  mochi(c, x + 44 * k, feet, .95 * k, swing);
}
function townAt(c: G, a: Assets, f: F) {
  const s = f.s; if (s < 7.8 || s >= 16.0) return;
  const rise = io(Math.floor(pr(s, 7.8, 8.8) * 6 + 1e-6) / 6), lit = Math.floor(pr(s, 9.0, 15.2) * WINDOW_COUNT * .85);
  town(c, a.sk, rise, lit);
}
function stars(c: G, k: Kit, alpha: number) {
  if (alpha <= 0) return;
  c.save(); c.globalAlpha = alpha;
  for (const st of k.stars) { string(c, st.x, OP.y - 30, st.y - 18 * st.r, .4); c.save(); c.translate(st.x, st.y); c.rotate(Math.floor(st.ph * 3) % 2 ? .1 : -.1); c.scale(st.r, st.r); put(c, st.gold ? k.star : k.starPale); c.restore(); }
  c.restore();
}

// ---------------------------------------------------------------- 承: the descent on the washi screen
function washi(c: G, a: Assets, f: F) {
  const s = f.s; if (s < 15.6 || s >= 24.25) return;
  const slide = io(pr(s, 15.6, 16.0)), x0 = lerp(-OP.w - 40, 0, slide), bottom = lerp(OPB, OP.y + 30, io(pr(s, 23.75, 24.2)));
  const lit = s < 16 ? 0 : s < 16.08 ? .55 : 1;
  c.save(); c.beginPath(); c.rect(OP.x + x0, OP.y, OP.w, bottom - OP.y); c.clip();
  if (lit < 1) put(c, a.k.screen, x0);
  if (lit > 0) {
    c.save(); c.globalAlpha = lit;
    const u = ease.inOutSine(pr(s, 16.4, 23.5)), fold = pr(s, 23.55, 23.75);
    descent(c, a.k, u, pr(s, 16, 24), 1, fold);
    c.restore();
  }
  c.restore();
  if (s < 24.25) put(c, a.k.roller, x0, s < 24.2 ? bottom : bottom - 400 * inC(pr(s, 24.2, 24.25)));
}

// ---------------------------------------------------------------- 轉 / 初唱 / 合: the hall, her song, the debut
function puppet(f: F): PuppetPose & { on: boolean } {
  const s = f.s, off = { x: 0, y: 0, h: 0, rot: 0, sx: 1, face: 'back' as const, on: false };
  if (s < 23.5 || (s >= 46.0 && s < 54.0)) return off;
  if (s >= 54) {   // curtain call: a hop on 56, the bow on the final chord (58)
    const bow = s < 58 ? 0 : s < 58.7 ? at(s, 58, 58.17, ease.outCubic) : 1 - at(s, 58.7, 59.0, io);
    const hop = s >= 56 && s < 56.5 ? 18 * Math.sin(Math.PI * pr(s, 56, 56.5)) : 0;
    return { x: 960, y: RISER.y + 2 - hop, h: 300, rot: .13 * bow + boil(f, 1), sx: 1, face: 'front', on: true };
  }
  let x = LANDING.x, y = RISER.y + 2, h = 400, rot = 0;
  if (s < 24.4) rot = settle(s, 23.5, .7, .05);
  else if (s < 25.4) { const u = pr(s, 24.4, 25.4); x = lerp(LANDING.x, 960, io(u)); y -= 26 * Math.abs(Math.sin(Math.PI * 2 * u)); }
  else x = 960;
  if (s >= 25.4 && s < 31.8) rot += boil(f, 4, .015);                                  // she trembles
  if (s >= 32 && s < 40) rot += .03 * (Math.floor((s - 32) / .5) % 2 ? 1 : -1);        // swaying as she sings
  let face: PuppetPose['face'] = s < 40 ? 'back' : 'front', sx = 1;
  if (s >= 40 && s < 40.25) { const p = Math.floor((s - 40) * 12 + 1e-6); face = p === 0 ? 'back' : p === 1 ? 'edge' : 'front'; sx = p === 1 ? 1 : .5; }
  if (s >= 40.25 && s < 45.2) {                                                        // the idol: a step on 1 and 3, a rock on every beat
    h = 430; const b = (s - 40) / .5;
    rot += .025 * (Math.floor(b) % 2 ? 1 : -1); if (Math.floor(b) % 2 === 0) y -= 12 * Math.sin(Math.PI * (b % 1));
  }
  if (s >= 40.25) h = 430;
  if (s >= 45.2) { const u = pr(s, 45.2, 45.95); x = lerp(960, OP.x - 300, io(u)); y -= 30 * Math.abs(Math.sin(Math.PI * 3 * u)); rot = -.05; }
  return { x, y, h, rot: rot + boil(f, 1), sx, face, on: true };
}
/** Arrival time of audience member n: the first few slowly (一盞、兩盞……), then the hall fills by 39.5. */
const arrival = (n: number) => 33 + 6.5 * Math.pow(n / (AUDIENCE - 1), .62);
function hallSet(c: G, a: Assets, f: F) {
  const s = f.s; if (s < 23.7) return;
  const sink = s < 54 ? 260 * inC(pr(s, 45.6, 46.2)) : 0;
  if (sink >= 259) return;
  const seated = s >= 54 ? 1 : 0, sway = s >= 40 ? .28 * Math.sin(Math.PI * (s - 40) / .5) : s >= 36 ? .12 * Math.sin(Math.PI * (s - 36) / 1) : 0;
  const glow = s >= 39.5 ? 1 : .75;
  c.save(); c.translate(0, sink); riser(c); c.restore();
  const p = puppet(f);
  if (p.on && s < 54) {
    const spot = s < 24 ? 0 : s < 40 ? (s >= 28.6 && s < 28.75 ? .3 : 1) * (s < 32 ? 1 : 1.15) : 1 - pr(s, 40, 40.4);
    spotlight(c, p.x, spot);
    drawPuppet(c, a.k, p);
  }
  if (s >= 54 && p.on) drawPuppet(c, a.k, p);
  if (s >= 54) ribbonUp(c, a, f);
  // notes rising while she sings
  if (s >= 32 && s < 40.2) for (let i = 0; i < 8; i++) {
    const t0 = 32.2 + i * .9, u = pr(s, t0, t0 + 2.2); if (u <= 0 || u >= 1) continue;
    const x = 960 + (i % 2 ? 1 : -1) * (90 + 40 * (i % 3)), y = lerp(540, 300, u) - 300 * inC(pr(u, .8, 1));
    note(c, x, y, .8 + .15 * (i % 3), (i % 2 ? .15 : -.2) + boil(f, 60 + i, .02), [C.pink, C.yellow, C.lav][i % 3]!);
  }
  hall(c, a.sk, n => seated ? 9 : s - arrival(n), sway, glow, sink);
}
function ribbonUp(c: G, a: Assets, f: F) {
  const dy = 230 * (1 - spring(f.s, 54.8, .4, .25));
  c.save(); c.translate(960, 708 + dy); c.rotate(boil(f, 12, .003)); put(c, a.k.ribbon); c.restore();
}
function bannerUp(c: G, a: Assets, f: F) {
  const s = f.s; if (s < 40.3 || s > 45.8) return;
  const dy = 560 * (1 - spring(s, 40.3, .45, .25)) + 600 * inC(pr(s, 45.3, 45.7));
  c.lineCap = 'round'; c.strokeStyle = C.wood; c.lineWidth = 10; c.beginPath(); c.moveTo(1330, 740 + dy); c.lineTo(1330, OPB + 60); c.stroke();
  c.save(); c.translate(1330, 300 + dy); c.rotate(boil(f, 9)); put(c, a.k.banner); c.restore();
}
function backdropY(s: number): number | null {
  if (s < 39.4 || (s >= 46.3 && s < 54)) return null;
  if (s >= 54) return 0;
  if (s >= 45.8) return -820 * io(pr(s, 45.8, 46.3));
  return -820 * (1 - spring(s, 39.4, .5, .2)) + settle(s, 39.9, .9, 14);
}
function petals(c: G, k: Kit, f: F) {
  const s = f.s, a = s >= 40.3 && s < 46 ? at(s, 40.3, 40.8) * (1 - at(s, 45.5, 46)) : s >= 54.8 ? at(s, 54.8, 55.3) : 0;
  if (a <= 0) return;
  const cols = ['#FFC6DD', C.pink, '#FFE7F0', C.yellow];
  for (const p of k.petals) {
    const y = OP.y + ((p.y * OP.h + p.vy * s) % (OP.h + 60)) - 30, x = OP.x + ((p.x * OP.w + p.vx * s + 30 * Math.sin(s + p.ph)) % OP.w + OP.w) % OP.w;
    c.save(); c.translate(x, y); c.rotate(s * p.spin * .5 + p.ph); c.scale(p.s, p.s * (.3 + .7 * Math.abs(Math.cos(s * p.spin + p.ph))));
    c.globalAlpha = a * .9; c.fillStyle = cols[p.col]!; c.beginPath(); c.ellipse(0, 0, 10, 6, 0, 0, TAU); c.fill(); c.restore();
  }
}

// ---------------------------------------------------------------- story cards
const CARDS = [
  { lines: ['很久很久以前，', '月亮上住著一隻兔子。'], x: 560, size: 40, tin: 2.9, tout: 7.35 },
  { lines: ['每一盞燈下，', '都有睡不著的人。'], x: 560, size: 42, tin: 9.4, tout: 15.15 },
  { lines: ['於是她決定，', '親自去陪他們。'], x: 560, size: 42, tin: 16.6, tout: 22.6 },
  { lines: ['第一次站上舞台，', '台下，空無一人。'], x: 1400, size: 42, tin: 24.8, tout: 31.0 },
  { lines: ['她還是開口唱了。', '一盞、兩盞……'], x: 520, size: 42, tin: 32.3, tout: 38.6 },
] as const;
function storyCards(c: G, f: F) {
  const s = f.s;
  CARDS.forEach((d, i) => {
    if (s < d.tin || s > d.tout + .4) return;
    const y = lerp(OP.y - 760, 352, spring(s, d.tin, .45, .3)) - 900 * inC(pr(s, d.tout, d.tout + .35));
    storyCard(c, d.lines, d.x, y, d.size, { rot: settle(s, d.tin + .4, 1.2, .045) + boil(f, 20 + i, .005) });
  });
}

// ---------------------------------------------------------------- the frame
function world(c: G, a: Assets, f: F) {
  const s = f.s, k = a.k, L = lights(f.t);
  put(c, k.back);
  c.save(); c.beginPath(); c.rect(OP.x, OP.y, OP.w, OP.h); c.clip();
  if (s < 16.0) { put(c, k.night); stars(c, k, 1); moonAndRabbit(c, a, f); townAt(c, a, f); }
  else {
    c.fillStyle = '#14060F'; c.fillRect(OP.x, OP.y, OP.w, OP.h);
    stars(c, k, s < 32 ? .25 : s < 40 ? lerp(.25, .6, pr(s, 32, 39.5)) : .6);
    if (s >= 54) put(c, k.night);
  }
  if (s >= 45.6 && s < 54) fields(c, k, promoF(f));
  const dy = backdropY(s); if (dy !== null) drawBackdrop(c, k, dy);
  if (s >= 54) { c.save(); c.translate(0, -78); marquee(c, k, promoF(f)); c.restore(); }
  const card = s >= 45.0 && s < 54 ? cardPose(promoF(f)) : null;
  if (card && s < 45.6) drawCard(c, k, promoF(f), card);                  // the paper moon lowered over the painted one
  hallSet(c, a, f);
  bannerUp(c, a, f);
  if (card && s >= 45.6) { const pf = promoF(f); fan(c, pf, card); drawCard(c, k, pf, card); popups(c, k, pf, card); }
  washi(c, a, f);
  petals(c, k, f);
  c.restore();
  curtains(c, drapes(s));
  storyCards(c, f);
  put(c, k.front);
  c.save(); c.globalCompositeOperation = 'screen';
  put(c, k.glow, 0, 0, L * (.85 + .15 * (f.t > 40 && f.t < 54 ? Math.exp(-(f.t % .5) / .5 * 5) : 0)));
  put(c, k.lanternGlow, 238, 380, L); put(c, k.lanternGlow, 1682, 380, L);
  c.restore();
  put(c, k.headerLit, 0, 0, headerLit(s, f.t));
  // the room dims with the house lights: dark before 0.5, dim in the empty hall
  const dark = f.t < .5 ? .86 : f.t < .58 ? .45 : .42 * (1 - L) * (f.t > 23 && f.t < 40.2 ? 1 : 0);
  if (dark > 0) {
    c.fillStyle = `rgba(10,3,14,${dark})`; c.fillRect(-200, -200, W + 400, H + 400);
    if (f.t >= 23.9 && f.t < 40.4) {   // the spotlight still reads through the dark
      const p = puppet(f); if (p.on) { c.save(); c.beginPath(); c.rect(OP.x, OP.y, OP.w, OP.h); c.clip(); spotlight(c, p.x, .6 * (1 - pr(f.t, 40, 40.4))); c.restore(); }
    }
  }
}

export function renderFrame(ctx: FrameContext, time: number, input: Readonly<Record<string, unknown>>) {
  const p = input as { grain: number; motion: string }, a = ctx.assets.story as Assets, smooth = p.motion === 'smooth';
  const s = smooth ? time : Math.floor(time * 12 + 1e-6) / 12;
  const f: F = { t: time, s, pose: Math.floor(time * 12 + 1e-6), smooth, noise: (...n) => ctx.noise(...n) };
  ctx.withCanvas(c => {
    c.scale(ctx.width / W, ctx.height / H);
    withCamera(c, camera(time), w => world(w as G, a, f));
    const v = c.createRadialGradient(W / 2, H / 2, 520, W / 2, H / 2, 1150); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,0,10,.42)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
    if (p.grain > 0) { c.globalCompositeOperation = 'multiply'; c.globalAlpha = p.grain; c.fillStyle = c.createPattern(a.k.grain, 'repeat')!; c.fillRect(0, 0, W, H); }
  });
}
