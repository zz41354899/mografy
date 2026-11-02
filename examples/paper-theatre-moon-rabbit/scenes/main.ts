// Lunar Pop Club No.01 — Paper Puppet Theatre. 25 s, 1920 × 1080, 30 fps, 120 BPM (beat 0.5 s, bar 2 s).
//
// The whole film happens inside one paper toy theatre seen from the audience. Every change is a stage mechanism:
// drapes, a back-lit washi screen that rolls up, flats sliding in grooves, a backdrop flown in and out, and one
// paper moon that travels through the film: it is lowered on strings (S03), sits over the painted moon (S04),
// comes forward and flips over into the chapter card (S05), which is pulled like a kamishibai card (S06, S07).
// The puppet is one rigid card on a rod: it hops behind the screen as a shadow, flips from its painted back to
// its full-colour face on the 12 s downbeat, and bows at the curtain call.
//
//  開幕   0– 6  light snaps on, drapes open, cards drop, the moon rises on its stick; a washi screen slides in
//  剪影   6– 8  back-lit screen, the puppet's shadow hops in and lands on 7; gel swap; the screen rolls up
//  夜幕   8–10  night flat, stars, the moon lowered on strings, 60° flats slide in from the wings
//  登場  10–16  painted backdrop flown in, the puppet comes downstage and flips to colour on 12; banner
//  01    16–18  the moon comes forward and flips into chapter card 01; pink field
//  02    18–20  card pull: the card travels right, its face slides out to the front portrait; paper fan
//  03    20–22  pull back left to the wink; pop-up flowers; drapes snap shut on 22
//  謝幕  22–25  curtain call: the puppet bows, the rabbit marquee lights bulb by bulb
//
// Props, flats and the puppet move on 2s (12 poses a second) with a seeded boil; camera, light and type stay smooth.
import { at, beats, cameraPath, clamp, ease, keys, lerp, pr, settle, spring, springs, tempoGrid, withCamera } from '@mografy/runtime';
import type { FrameContext, SetupContext } from '@mografy/runtime';
import {
  C, FLOOR, FOOT, H, OP, OPB, OPR, PAD, PAINTED_MOON, SOCKET, TAU, TAG_WORDS, W, WINK, CARD_POS, LANTERNS,
  prepare, put, rgba, mix, sakuraPath, plaqueHead, type G, type Kit,
} from './lib.js';

const tempo = { bpm: 120, beatsPerBar: 4 };
const grid = tempoGrid(tempo);
const B = (n: number, k = 0) => grid.onBar(n, k);   // bar n (2 s each), plus k beats

export const BEATS = beats([
  { title: '開幕 今晚，陪伴著你', end: B(3), stop: 4.8, handoff: .6, note: 'Light snaps on, drapes open, cards drop, the moon rises on its stick.' },
  { title: '剪影 A BRIGHTER NIGHT', end: B(4), stop: 7.5, handoff: .6, note: "The puppet's shadow hops in on the back-lit screen; the screen rolls up." },
  { title: '夜幕 月亮垂降', end: B(5), stop: 9.4, handoff: .8, note: 'Night flat, stars and the moon lowered on strings.' },
  { title: '登場 月亮偶像', end: B(8), stop: 14.6, handoff: .8, note: 'Backdrop flown in; the puppet flips to colour on 12; banner.' },
  { title: '01 登場', end: B(9), stop: 17.3, handoff: .8, note: 'The moon comes forward and flips into chapter card 01.' },
  { title: '02 魅力', end: B(10), stop: 19.4, handoff: .8, note: 'Card pull to the front portrait; the paper fan opens.' },
  { title: '03 節拍', end: B(11), stop: 21.2, handoff: .8, note: 'Pull to the wink; pop-up flowers; drapes snap shut.' },
  { title: '謝幕 LUNAR POP CLUB', end: 25, stop: 24.5, note: 'Curtain call: the puppet bows, the marquee lights.' },
]);

export const meta = { width: W, height: H, duration: BEATS.duration, fps: 30, background: C.room, tempo, shots: BEATS.shots };

export const params = {
  grain: { name: 'Paper grain', type: 'number' as const, default: .1, min: 0, max: .3, step: .01 },
  motion: { name: 'Motion', type: 'enum' as const, default: 'stop-motion', options: ['stop-motion', 'smooth'] },
};

export async function setup(ctx: SetupContext) { ctx.assets.kit = await prepare(ctx); }

// ---------------------------------------------------------------- time
/** Frame state: `t` smooth time, `s` the pose time (on 2s), `pose` its index, `boil` a per-pose wobble. */
interface F { t: number; s: number; pose: number; smooth: boolean; noise: (...n: number[]) => number }
const boil = (f: F, id: number, amt = .005) => f.smooth ? 0 : (f.noise(id, f.pose) - .5) * 2 * amt;
const io = ease.inOutCubic, oc = ease.outCubic;
const inC = (p: number) => p * p * p;

// ---------------------------------------------------------------- the camera (one for the film)
const camera = cameraPath([
  [0, 960, 548, 1.0],
  [.6, 960, 548, 1.0],
  [B(3), 960, 544, 1.04],
  [B(4), 960, 536, 1.10],
  [B(5), 960, 536, 1.12],
  [11.6, 960, 545, 1.0],
  [15.6, 960, 545, 1.0],
  [16.6, 900, 552, 1.05],
  [17.6, 892, 552, 1.05],
  [18.4, 1010, 552, 1.05],
  [19.6, 1018, 552, 1.05],
  [20.4, 914, 552, 1.06],
  [21.5, 906, 552, 1.08],
  [22.4, 960, 545, 1.0],
  [25, 960, 540, .97],
]);

// ---------------------------------------------------------------- drapes
function openAmount(s: number) {
  if (s < 21.4) return io(pr(s, 1.0, 2.6));
  if (s < 22.1) return 1 - inC(pr(s, 21.4, 22.0));
  return io(pr(s, 22.1, 22.6));
}
function curtains(c: G, open: number) {
  for (const side of [-1, 1]) {
    const edge = side < 0 ? OP.x + (OP.w / 2 + 6) * (1 - open) : OPR - (OP.w / 2 + 6) * (1 - open), outer = side < 0 ? OP.x - 14 : OPR + 14;
    const tie = OP.y + OP.h * .62, pull = open * 70;
    const drape = () => { c.beginPath(); c.moveTo(outer, OP.y - 10); c.lineTo(edge, OP.y - 10);
      c.quadraticCurveTo(edge - side * pull * .5, tie - 80, edge - side * pull * 1.1, tie);
      c.quadraticCurveTo(edge - side * pull * .5, tie + 120, edge, OPB + 4); c.lineTo(outer, OPB + 4); c.closePath(); };
    c.save(); c.translate(-side * 10, 8); c.fillStyle = 'rgba(18,4,20,.18)'; drape(); c.fill(); c.translate(-side * 6, 4); c.fillStyle = 'rgba(18,4,20,.14)'; drape(); c.fill(); c.restore();
    const g = c.createLinearGradient(Math.min(edge, outer), 0, Math.max(edge, outer) + 1, 0);
    for (let i = 0; i < 12; i++) { const u = i / 12, w = 1 / 12;   // velvet pleats: shadow, body, a thin sheen
      g.addColorStop(u, '#4A1440'); g.addColorStop(u + w * .45, C.drape); g.addColorStop(u + w * .7, '#A4467F'); g.addColorStop(u + w * .82, C.drape); }
    g.addColorStop(1, '#4A1440');
    c.fillStyle = g; drape(); c.fill();
    if (open > .15) {
      const tx = edge - side * pull * 1.1 + side * 8;
      c.fillStyle = C.gold; c.beginPath(); c.roundRect(Math.min(tx, outer), tie - 7, Math.abs(outer - tx), 14, 7); c.fill();
      c.fillStyle = 'rgba(255,240,200,.5)'; c.fillRect(Math.min(tx, outer), tie - 5, Math.abs(outer - tx), 3);
      // the tassel hanging from the tie
      c.fillStyle = C.gold; c.beginPath(); c.moveTo(tx - 7, tie + 8); c.lineTo(tx + 7, tie + 8); c.lineTo(tx + 13, tie + 54); c.lineTo(tx - 13, tie + 54); c.closePath(); c.fill();
      c.strokeStyle = C.goldD; c.lineWidth = 1.2; for (let j = -2; j <= 2; j++) { c.beginPath(); c.moveTo(tx + j * 2.5, tie + 14); c.lineTo(tx + j * 4.8, tie + 54); c.stroke(); }
      c.fillStyle = C.goldD; c.fillRect(tx - 8, tie + 14, 16, 4);
      pin(c, tx, tie, 10);
    }
  }
}
function pin(c: G, x: number, y: number, r: number) {
  const g = c.createRadialGradient(x - r * .3, y - r * .3, 1, x, y, r);
  g.addColorStop(0, '#FFF1C2'); g.addColorStop(.5, C.gold); g.addColorStop(1, C.goldD); c.fillStyle = g;
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}
function string(c: G, x: number, y0: number, y1: number, a = .7) {
  if (y1 <= y0) return;
  c.strokeStyle = `rgba(255,247,235,${a})`; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke();
}
function rod(c: G, x0: number, y0: number, x1: number, y1: number, w = 11) {
  c.lineCap = 'round'; c.strokeStyle = C.wood; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.strokeStyle = 'rgba(255,220,180,.25)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x0 - 2, y0); c.lineTo(x1 - 2, y1); c.stroke();
}

// ---------------------------------------------------------------- the puppet
type Face = 'front' | 'back' | 'shadow' | 'edge';
interface PuppetPose { x: number; y: number; h: number; rot: number; sx: number; face: Face; on: boolean }
/** The puppet's pose at pose time s: one card that hops, comes downstage, flips, exits and bows. */
function puppetPose(f: F): PuppetPose {
  const s = f.s;
  if (s < 6.0 || (s >= 16.1 && s < 22.0)) return { x: 0, y: 0, h: 0, rot: 0, sx: 1, face: 'back', on: false };
  if (s >= 22.0) {   // curtain call: bow on the 23 s beat
    const bow = s < 23 ? 0 : s < 23.5 ? at(s, 23, 23.17, oc) : 1 - at(s, 23.5, 23.75, io);
    return { x: 960, y: FLOOR + 14, h: 340, rot: .13 * bow + boil(f, 1), sx: 1, face: 'front', on: true };
  }
  // the hop in (6.0–7.0) along an arc from below the stage to the landing mark, then a forward tilt on landing
  const LAND = { x: 760, y: FLOOR };
  let x = LAND.x, y = LAND.y, h = 470, rot = 0;
  if (s < 7) {
    const u = pr(s, 6.05, 7.0), a = { x: 1540, y: FLOOR + 360 }, k = { x: 1200, y: 300 };
    x = (1 - u) ** 2 * a.x + 2 * (1 - u) * u * k.x + u * u * LAND.x; y = (1 - u) ** 2 * a.y + 2 * (1 - u) * u * k.y + u * u * LAND.y;
    rot = lerp(-.28, -.04, u);
  } else rot = .07 * (1 - pr(s, 7.0, 7.34)) + (s > 8.2 && s < 10.2 ? .012 * Math.sin(Math.PI * Math.floor((s - 8) / .5)) : 0);
  // downstage to the hero mark with three small hops (10.2–11.6)
  if (s >= 10.2) {
    const u = pr(s, 10.2, 11.6), e = io(u);
    x = lerp(LAND.x, 690, e); y = lerp(LAND.y, FLOOR + 14, e) - 34 * Math.abs(Math.sin(Math.PI * 3 * u)); h = lerp(470, 600, e);
  }
  // exit to the left wing (15.3–16.1)
  if (s >= 15.3) { const u = pr(s, 15.3, 16.1); x = lerp(690, OP.x - 330, io(u)); y = FLOOR + 14 - 30 * Math.abs(Math.sin(Math.PI * 3 * u)); h = 600; rot = -.05; }
  // the flip on the 12 s downbeat: back → edge → front over three poses
  let face: Face = s < 12 ? 'back' : 'front', sx = 1;
  if (s >= 12 && s < 12.25) { const p = Math.floor((s - 12) * 12 + 1e-6); face = p === 0 ? 'back' : p === 1 ? 'edge' : 'front'; sx = p === 1 ? 1 : .5; }
  if (s >= 12.25 && s < 15.3) rot = .015 * Math.sin(Math.PI * Math.floor((s - 12) / 1)) + (s > 14 && s < 14.5 ? -.04 * Math.sin(Math.PI * pr(s, 14, 14.5)) : 0);
  if (s >= 14 && s < 14.5) y -= 26 * Math.sin(Math.PI * pr(s, 14, 14.5));
  return { x, y, h, rot: rot + boil(f, 1), sx, face, on: true };
}
function drawPuppet(c: G, k: Kit, p: PuppetPose, face: Face = p.face, withRod = true) {
  const s = p.h / FOOT.y, cw = k.char.width, ch = k.char.height;
  c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
  if (withRod) { const sx = (SOCKET.x - FOOT.x) * s, sy = (SOCKET.y - FOOT.y) * s; c.save(); c.rotate(-p.rot); rod(c, sx * Math.cos(p.rot) - sy * Math.sin(p.rot), sx * Math.sin(p.rot) + sy * Math.cos(p.rot), 70, 260, 11 * p.h / 600 + 3); c.restore(); }
  if (face === 'edge') c.drawImage(k.puppet.edge, -20 * s, -(FOOT.y + PAD) * s, 40 * s, (ch + PAD * 2) * s);
  else { c.scale(p.sx, 1); c.drawImage(k.puppet[face], -(FOOT.x + PAD) * s, -(FOOT.y + PAD) * s, (cw + PAD * 2) * s, (ch + PAD * 2) * s); }
  c.restore();
}

// ---------------------------------------------------------------- the moon and the chapter card
type CardFace = 'moon' | 0 | 1 | 2;
interface CardPose { x: number; y: number; r: number; on: boolean; strings: boolean; sx: number; face: CardFace; prev: CardFace; pull: number; tab: number }
const cx = keys([[15.6, PAINTED_MOON.x], [16.05, CARD_POS[0].x], [17.6, CARD_POS[0].x], [18.3, CARD_POS[1].x], [19.6, CARD_POS[1].x], [20.3, CARD_POS[2].x]]);
const cy = keys([[15.6, PAINTED_MOON.y], [16.05, CARD_POS[0].y], [17.6, CARD_POS[0].y], [18.3, CARD_POS[1].y], [19.6, CARD_POS[1].y], [20.3, CARD_POS[2].y]]);
const cr = keys([[15.6, PAINTED_MOON.r], [16.05, CARD_POS[0].r], [17.6, CARD_POS[0].r], [18.3, CARD_POS[1].r], [19.6, CARD_POS[1].r], [20.3, CARD_POS[2].r]]);
function cardPose(f: F): CardPose {
  const s = f.s, off = { x: 0, y: 0, r: 0, on: false, strings: false, sx: 1, face: 'moon' as CardFace, prev: 'moon' as CardFace, pull: 0, tab: 0 };
  if (s < 7.8 || s >= 22.0) return off;
  if (s < 15.6) {
    // lowered on two strings (7.8–8.7), carried over the painted moon (9.6–10.3), flown out (11.0–11.5), back (15.0–15.5)
    const HANG = { x: 1120, y: 470, r: 175 };
    let x = HANG.x, y = lerp(OP.y - 260, HANG.y, spring(s, 7.85, .55, .25)), r = HANG.r;
    if (s >= 9.6) { const e = io(pr(s, 9.6, 10.3)); x = lerp(HANG.x, PAINTED_MOON.x, e); y = lerp(HANG.y, PAINTED_MOON.y, e); r = lerp(HANG.r, PAINTED_MOON.r, e); }
    if (s >= 11.0) y -= 620 * inC(pr(s, 11.0, 11.5)) - 620 * spring(s, 15.0, .4, .2);
    if (s >= 11.5 && s < 15.0) return off;
    return { ...off, x, y: y + 3 * Math.sin(Math.floor(s * 3)) * (s > 8.7 && s < 9.6 ? 1 : 0), r, on: true, strings: true };
  }
  // forward and flip into card 01 (15.6–16.05), then the pulls
  const x = cx(s), y = cy(s) - 40 * Math.sin(Math.PI * pr(s, 15.6, 16.05)), r = cr(s);
  let sx = 1, face: CardFace = 0, prev: CardFace = 0, pull = 0;
  if (s < 16.0) { const p = Math.floor((s - 15.75) * 12 + 1e-6); face = s < 15.75 || p <= 0 ? 'moon' : 0; sx = s < 15.75 ? 1 : p === 0 ? .5 : p === 1 ? .08 : .5; if (p === 1) face = 'moon'; }
  else if (s < 18.3) { face = s < 17.7 ? 0 : 1; prev = 0; pull = s < 17.7 ? 0 : io(pr(s, 17.7, 18.2)); }
  else if (s < 19.7) { face = 1; prev = 1; }
  else { face = 2; prev = 1; pull = io(pr(s, 19.7, 20.2)); }
  const tab = s < 16.2 ? 0 : s < 17.7 ? spring(s, 16.2, .4, .3) : 1 - pr(s, 17.7, 17.85);
  return { x, y, r, on: true, strings: false, sx, face, prev, pull, tab };
}
function portrait(c: G, k: Kit, face: CardFace, x: number, y: number, r: number) {
  const P = k.portraits, cw = P.width / 2;
  if (face === 0) { const z = r * 2.44 / cw * cw; c.drawImage(P, 0, 0, cw, P.height, x - r * 1.22, y - r * 1.11, z, z * P.height / cw); }
  else if (face === 1) { const z = r * 2.4; c.drawImage(P, cw, 0, cw, P.height, x - z / 2, y - r * 1.1, z, z * P.height / cw); }
  else if (face === 2) { const src = 600, z = r * 2.3; c.fillStyle = C.lav; c.fillRect(x - r, y - r, r * 2, r * 2); c.drawImage(k.char, WINK.x - src / 2, WINK.y - src * .42, src, src, x - z / 2, y - z * .5, z, z); }
}
const LABELS = ['MOON RABBIT · CHAPTER 01', 'MOON RABBIT · CHAPTER 02', 'MOON RABBIT · CHAPTER 03'];
function drawCard(c: G, k: Kit, f: F, p: CardPose) {
  if (!p.on) return;
  c.save(); c.translate(p.x, p.y); c.rotate(boil(f, 7, .004));
  if (p.strings) { string(c, -p.r * .45, OP.y - p.y - 40, -p.r * .9); string(c, p.r * .45, OP.y - p.y - 40, -p.r * .9); }
  c.scale(p.sx, 1);
  if (p.face === 'moon') {
    const z = p.r / 100; c.drawImage(k.moon.img, k.moon.x * z, k.moon.y * z, k.moon.w * z, k.moon.h * z);
    if (p.strings) { pin(c, -p.r * .45, -p.r * .9, 6); pin(c, p.r * .45, -p.r * .9, 6); }
    c.restore(); return;
  }
  const beat = f.t >= 16.05 && f.t < 21.4 ? Math.exp(-((f.t - 16) % .5) / .5 * 6) : 0;   // the rim hops on every beat
  const R = p.r, z = (R + 16) / 286; c.drawImage(k.disc.img, k.disc.x * z, k.disc.y * z, k.disc.w * z, k.disc.h * z);
  c.save(); c.beginPath(); c.arc(0, 0, R, 0, TAU); c.clip(); c.fillStyle = C.ivory; c.fillRect(-R, -R, R * 2, R * 2);
  portrait(c, k, p.face, 0, 0, R);
  if (p.pull > 0 && p.pull < 1) {   // the outgoing sheet slides out to the right, its left edge casting a shadow
    const off = p.pull * R * 2.3, e = off - R;
    const sh = c.createLinearGradient(e - 26, 0, e, 0); sh.addColorStop(0, 'rgba(48,18,46,0)'); sh.addColorStop(1, 'rgba(48,18,46,.4)');
    c.fillStyle = sh; c.fillRect(e - 26, -R, 26, R * 2);
    c.fillStyle = C.ivory; c.fillRect(e, -R, R * 2 + 40, R * 2);
    portrait(c, k, p.prev, off, 0, R);
    c.fillStyle = C.ivory; c.fillRect(e, -R, 6, R * 2);
  }
  c.restore();
  c.strokeStyle = C.gold; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, R + 7, 0, TAU); c.stroke();
  c.lineWidth = 2; c.strokeStyle = p.face === 1 ? C.violet : C.rose; c.beginPath(); c.arc(0, 0, R + 28 + 6 * beat, 0, TAU); c.stroke();
  if (p.tab > 0) {   // the pull tab
    c.save(); c.translate(R + 6, 0); c.scale(p.tab, p.tab); c.fillStyle = C.gold; c.beginPath(); c.roundRect(0, -26, 64, 52, 10); c.fill();
    c.fillStyle = C.plum; c.font = `600 22px "Inter Display"`; c.textBaseline = 'middle'; c.fillText('→', 20, 1); c.restore();
  }
  // the chapter label strip under the card
  const li = typeof p.face === 'number' ? (p.pull > .5 || p.pull === 0 ? p.face : p.prev as number) : -1;
  if (li >= 0 && p.sx === 1) {
    c.font = '600 15px "Inter Display"'; c.letterSpacing = '5px'; const tw = c.measureText(LABELS[li]!).width + 30;
    c.fillStyle = 'rgba(18,4,20,.3)'; c.fillRect(-tw / 2 + 4, R + 11, tw, 34);
    c.fillStyle = C.ivory; c.fillRect(-tw / 2, R + 6, tw, 34); c.fillStyle = C.plum; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(LABELS[li]!, 2, R + 24); c.letterSpacing = '0px';
  }
  c.restore();
}

// ---------------------------------------------------------------- set pieces
function hangCards(c: G, k: Kit, f: F) {
  const s = f.s;
  const cards = [{ sp: k.card1, x: 640, y: 362, in: .6, out: 5.25 }, { sp: k.card2, x: 800, y: 346, in: 2.0, out: 5.33 }];
  for (const [i, d] of cards.entries()) {
    if (s < d.in || s > d.out + .4) continue;
    const y = lerp(OP.y - 560, d.y, spring(s, d.in, .45, .3)) - 760 * inC(pr(s, d.out, d.out + .35));
    const w = d.sp.w * .5;
    string(c, d.x - w * .3, OP.y - 30, y + 6); string(c, d.x + w * .3, OP.y - 30, y + 6);
    c.save(); c.translate(d.x, y); c.rotate(settle(s, d.in + .4, 1.2, .05) + boil(f, 20 + i, .006)); put(c, d.sp); pin(c, -w * .3, 8, 5); pin(c, w * .3, 8, 5); c.restore();
  }
}
/** S02 tags: one chain lowered on a single string (6.15), then each tag turns on the string to face us, one per pose step. */
function tagsOnScreen(c: G, k: Kit, f: F) {
  const s = f.s, x = 1410;
  if (s < 6.15 || s > 7.95) return;
  const drop = (1 - spring(s, 6.15, .45, .15)) * 560 + 700 * inC(pr(s, 7.55, 7.9));
  const yLast = OP.y + 120 + 4 * 78 - drop;
  string(c, x, OP.y - 30, yLast + 24);
  TAG_WORDS.forEach((_, i) => {
    const y = OP.y + 120 + i * 78 - drop, p = Math.floor((s - (6.5 + i * .1)) * 12 + 1e-6);
    const sx = p < 0 ? 0 : [.3, .75, 1.06, 1][Math.min(p, 3)]!;
    c.save(); c.translate(x, y); c.rotate((i % 2 ? 1 : -1) * .03 * sx + boil(f, 30 + i, .008));
    if (sx === 0) { c.fillStyle = '#E9DCCB'; c.fillRect(-3, 2, 6, 46); }   // edge-on: just the card's thickness
    else { c.scale(sx, 1); put(c, k.tags[i]!); }
    c.restore();
  });
}
/** S01: dusk sky, the moon on a bamboo stick rising behind two hill flats. */
function dusk(c: G, k: Kit, f: F) {
  put(c, k.dusk);
  const y = lerp(FLOOR + 190, 520, spring(f.s, 3.0, 1.5, .22)), r = 120;
  rod(c, 1150, y + r * .5, 1150, OPB + 40, 12);
  c.save(); c.translate(1150, y); c.rotate(boil(f, 2)); const z = r / 100; c.drawImage(k.moon.img, k.moon.x * z, k.moon.y * z, k.moon.w * z, k.moon.h * z); c.restore();
  put(c, k.hills);
}
/** S02: the washi screen slides in (5.6–6.0), is back-lit on 6, swaps gel on 7 and rolls up (7.75–8.2). */
function washi(c: G, k: Kit, f: F, pp: PuppetPose) {
  const s = f.s, slide = io(pr(s, 5.6, 6.0)), x0 = lerp(-OP.w - 40, 0, slide);
  const bottom = lerp(OPB, OP.y + 30, io(pr(s, 7.75, 8.2)));
  const lit = s < 6 ? 0 : s < 6.08 ? .55 : 1, gelFlick = s >= 7 && s < 7.09 ? .75 : 1;
  c.save(); c.beginPath(); c.rect(OP.x + x0, OP.y, OP.w, bottom - OP.y); c.clip();
  put(c, k.screen, x0);
  if (lit > 0) put(c, s < 7 ? k.screenPink : k.screenLav, x0, 0, lit * gelFlick);
  if (lit > 0 && pp.on && pp.face !== 'edge') {   // the shadow, cast slightly larger than the card
    c.globalAlpha = .9 * lit; c.globalCompositeOperation = 'multiply';
    drawPuppet(c, k, { ...pp, h: pp.h * 1.06, y: pp.y + 8 }, 'shadow', false);
    c.save(); c.strokeStyle = 'rgba(42,14,44,.85)'; c.lineWidth = 12; c.lineCap = 'round'; const s2 = pp.h * 1.06 / FOOT.y;
    c.beginPath(); c.moveTo(pp.x + (SOCKET.x - FOOT.x) * s2, pp.y + 8 + (SOCKET.y - FOOT.y) * s2); c.lineTo(pp.x + 70, OPB + 40); c.stroke(); c.restore();
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  }
  c.restore();
  // the roller sits on the screen's lower edge; it stays rolled at the top through S03 and flies out on 10
  const ry = s < 10 ? bottom : bottom - 400 * inC(pr(s, 10.0, 10.4));
  if (s < 10.4) put(c, k.roller, x0, ry);
}
/** S03–S04 night set: plum flat, stars on strings, the 60° flats and clouds sliding in grooves. */
function nightSet(c: G, k: Kit, f: F) {
  const s = f.s;
  put(c, k.night);
  for (const [i, st] of k.stars.entries()) {
    const out = inC(pr(s, 9.9 + (i % 5) * .05, 10.4 + (i % 5) * .05)), y = st.y - 520 * out;
    if (y < OP.y - 40) continue;
    string(c, st.x, OP.y - 30, y - 18 * st.r, .4);
    const ang = Math.floor((s + st.ph) * 3) % 2 ? .12 : -.12;
    c.save(); c.translate(st.x, y); c.rotate(ang); c.scale(st.r, st.r); put(c, st.gold ? k.star : k.starPale); c.restore();
  }
  const inn = (a: number) => io(pr(s, a, a + .45)), out = io(pr(s, 9.8, 10.3));
  const tri = inn(8.05) * (1 - out), block = inn(8.15) * (1 - out), clouds = inn(8.1) * (1 - out);
  const ax = Math.cos(Math.PI / 3), ay = Math.sin(Math.PI / 3);
  if (tri > 0) put(c, k.tri, -ax * 700 * (1 - tri), -ay * 700 * (1 - tri));
  if (clouds > 0) { put(c, k.cloudL, -760 * (1 - clouds), 0); put(c, k.cloudR, 760 * (1 - clouds), 0); }
  if (block > 0) put(c, k.block, 700 * (1 - block), 0);
}
function backdropY(s: number) {
  if (s < 10 || (s >= 16.3 && s < 22)) return null;
  if (s >= 22) return 0;
  if (s >= 15.8) return -820 * io(pr(s, 15.8, 16.3));
  return -820 * (1 - spring(s, 10.0, .5, .2)) + settle(s, 10.5, .9, 14);
}
function drawBackdrop(c: G, k: Kit, dy: number) {
  string(c, OP.x + 140, OP.y - 30, OP.y + dy + 20); string(c, OPR - 140, OP.y - 30, OP.y + dy + 20);
  put(c, k.backdrop, 0, dy);
}
function banner(c: G, k: Kit, f: F) {
  const s = f.s; if (s < 12.2 || s > 15.8) return;
  const dy = 560 * (1 - spring(s, 12.2, .45, .25)) + 600 * inC(pr(s, 15.3, 15.7));
  rod(c, 1330, 300 + dy + 440, 1330, OPB + 60, 10);
  c.save(); c.translate(1330, 300 + dy); c.rotate(boil(f, 9)); put(c, k.banner); c.restore();
}
function fields(c: G, k: Kit, f: F) {
  const s = f.s; if (s < 15.6 || s >= 22) return;
  const lav = io(pr(s, 17.6, 18.3)), plum = io(pr(s, 19.6, 20.3));
  if (lav < 1) put(c, k.fields[0]!);
  if (lav > 0 && plum < 1) put(c, k.fields[1]!, -(OP.w + 80) * (1 - lav));
  if (plum > 0) put(c, k.fields[2]!, (OP.w + 80) * (1 - plum));
}
/** S06: a folded paper fan opens behind the card (8 poses), turns slowly, folds away before the next pull. */
function fan(c: G, f: F, p: CardPose) {
  const s = f.s, open = io(pr(s, 18.25, 18.92)) * (1 - io(pr(s, 19.45, 19.75)));
  if (open <= 0 || !p.on) return;
  const n = 18, R = 430, folds = Math.max(1, Math.round(open * n)), base = Math.PI * 1.5 - (folds / n) * Math.PI / 2 + (s - 18.25) * .06;
  c.save(); c.translate(p.x, p.y);
  for (let i = 0; i < folds; i++) {
    const a0 = base + i / n * Math.PI, a1 = base + (i + 1) / n * Math.PI;
    c.fillStyle = i % 2 ? '#FFF1F7' : '#E7D5F4'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, a0, a1); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(153,119,189,.6)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a1) * R, Math.sin(a1) * R); c.stroke();
  }
  c.restore();
}
/** S07: pop-up paper flowers spring open round the card, one per beat. */
const POPS = [[-262, -205, .9, .2, 20.1], [262, -232, .7, .9, 20.5], [-300, 30, .6, 2, 20.75], [-262, 232, .75, 1.4, 21.0], [282, 242, 1, .5, 21.5]] as const;
function popups(c: G, k: Kit, f: F, p: CardPose) {
  const s = f.s; if (s < 20.1 || s >= 22) return;
  for (const [i, [dx, dy, sc, rot, t0]] of POPS.entries()) {
    if (s < t0) continue;
    const step = Math.min(3, Math.floor((s - t0) * 12 + 1e-6)), z = [.3, .8, 1.15, 1][step]!, fold = [.25, .6, 1, 1][step]!;
    c.save(); c.translate(p.x + dx, p.y + dy); c.rotate(rot + boil(f, 40 + i, .01)); c.scale(sc * z, sc * z * fold); put(c, k.flower); c.restore();
  }
}
/** S08: the rabbit-head marquee hung in front of the moon; bulbs light four a pose, flicker twice, then pulse. */
const BULBS = (() => {
  const out: [number, number][] = [];
  for (let i = 0; i < 28; i++) { const a = -Math.PI / 2 + i / 28 * TAU, x = Math.cos(a) * 108, y = Math.sin(a) * 80; if (y < -60 && Math.abs(Math.abs(x) - 52) < 30) continue; out.push([x, y]); }
  for (const sd of [1, -1]) for (let i = 0; i <= 8; i++) { const a = Math.PI * (1.12 + .76 * i / 8), ex = Math.cos(a) * 18, ey = Math.sin(a) * 56, r = sd * .2; out.push([sd * 52 + ex * Math.cos(r) - ey * Math.sin(r), -105 + ex * Math.sin(r) + ey * Math.cos(r)]); }
  return out;
})();
function marquee(c: G, k: Kit, f: F) {
  const s = f.s, X = 960, Y = 432;
  string(c, X - 70, OP.y - 30, Y - 120, .6); string(c, X + 70, OP.y - 30, Y - 120, .6);
  c.save(); c.translate(X, Y); c.rotate(boil(f, 11, .004)); c.scale(.8, .8); put(c, k.plaque);
  const lit = Math.max(0, Math.floor((s - 22.6) * 12 + 1e-6) * 4), flick = (s >= 23.85 && s < 23.95) || (s >= 24.05 && s < 24.15) ? .15 : 1;
  const pulse = s > 24.15 ? .75 + .25 * Math.exp(-((f.t - 24) % .5) / .5 * 5) : 1;
  BULBS.forEach(([x, y], i) => {
    const on = i < lit ? flick * pulse : 0;
    if (on > 0) put(c, k.bulb, x, y, on);
    else { c.fillStyle = '#6B4A3A'; c.beginPath(); c.arc(x, y, 6.5, 0, TAU); c.fill(); }
  });
  c.font = '600 30px "Inter Display"'; c.letterSpacing = '6px'; c.fillStyle = C.yellow; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = at(s, 22.9, 23.3);
  c.fillText('NO.01', 3, 2); c.letterSpacing = '0px'; c.globalAlpha = 1;
  c.fillStyle = C.pink; c.beginPath(); c.ellipse(-60, 32, 16, 9, 0, 0, TAU); c.ellipse(60, 32, 16, 9, 0, 0, TAU); c.fill();
  c.restore();
}
function ribbon(c: G, k: Kit, f: F) {
  const s = f.s; if (s < 22.6) return;
  const dy = 230 * (1 - spring(s, 22.6, .4, .25));
  c.save(); c.translate(960, 815 + dy); c.rotate(boil(f, 12, .003)); put(c, k.ribbon); c.restore();
}
function petals(c: G, k: Kit, f: F) {
  const s = f.s, a1 = s >= 12 && s < 16 ? at(s, 12, 12.5) * (1 - at(s, 15.5, 16)) : 0, a2 = s >= 22.5 ? at(s, 22.5, 23) : 0, a = Math.max(a1, a2);
  if (a <= 0) return;
  const cols = ['#FFC6DD', C.pink, '#FFE7F0', C.yellow];
  for (const p of k.petals) {
    const y = OP.y + ((p.y * OP.h + p.vy * s) % (OP.h + 60)) - 30, x = OP.x + ((p.x * OP.w + p.vx * s + 30 * Math.sin(s + p.ph)) % OP.w + OP.w) % OP.w;
    const flip = Math.abs(Math.cos(s * p.spin + p.ph));
    c.save(); c.translate(x, y); c.rotate(s * p.spin * .5 + p.ph); c.scale(p.s, p.s * (.3 + .7 * flip));
    c.globalAlpha = a * .9; c.fillStyle = cols[p.col]!; c.beginPath(); c.ellipse(0, 0, 10, 6, 0, 0, TAU); c.fill(); c.restore();
  }
}

// ---------------------------------------------------------------- the frame
function world(c: G, k: Kit, f: F) {
  const s = f.s, pp = puppetPose(f), card = cardPose(f), dy = backdropY(s);
  put(c, k.back);
  c.save(); c.beginPath(); c.rect(OP.x, OP.y, OP.w, OP.h); c.clip();
  if (s < 6.0) dusk(c, k, f);
  if (s >= 7.75 && s < 16.3) nightSet(c, k, f);   // hidden behind the washi screen before it rolls
  fields(c, k, f);
  if (dy !== null && s < 22) drawBackdrop(c, k, dy);
  if (s >= 22) { put(c, k.night); drawBackdrop(c, k, 0); marquee(c, k, f); }
  if (s < 15.6 && s >= 7.75) drawCard(c, k, f, card);                  // the moon sits behind the puppet while it hangs
  if (pp.on && s >= 6.0 && (s >= 7.7 || s >= 22)) drawPuppet(c, k, pp);
  banner(c, k, f);
  if (s >= 22) ribbon(c, k, f);
  if (s >= 15.6) { fan(c, f, card); drawCard(c, k, f, card); popups(c, k, f, card); }
  if (s >= 5.6 && s < 10.4) washi(c, k, f, pp);
  if (s >= 6.1 && s < 8.0) tagsOnScreen(c, k, f);
  petals(c, k, f);
  c.restore();
  curtains(c, openAmount(s));
  hangCards(c, k, f);
  put(c, k.front);
  // light: footlights after the snap, the lit header from 12.2 (flickers in), a warm spot on the stage
  const on = f.t < .5 ? 0 : f.t < .58 ? .5 : 1;
  c.save(); c.globalCompositeOperation = 'screen';
  put(c, k.glow, 0, 0, on * (.85 + .15 * (f.t > 12 ? Math.exp(-(f.t % .5) / .5 * 5) : 0)));
  put(c, k.lanternGlow, 238, 380, on); put(c, k.lanternGlow, 1682, 380, on);
  const sp = c.createRadialGradient(960, 520, 10, 960, 520, 760); sp.addColorStop(0, `rgba(255,236,200,${.2 * on})`); sp.addColorStop(1, 'rgba(255,236,200,0)');
  c.fillStyle = sp; c.fillRect(OP.x - 60, OP.y - 40, OP.w + 120, OP.h + 120);
  c.restore();
  const hl = f.s < 12.2 ? 0 : f.s < 12.28 ? .6 : f.s < 12.37 ? .2 : 1;
  put(c, k.headerLit, 0, 0, hl * (f.t > 22 ? .8 + .2 * Math.exp(-((f.t - 22) % .5) / .5 * 4) : 1));
  if (on < 1) { c.fillStyle = `rgba(10,3,14,${.86 * (1 - on)})`; c.fillRect(-200, -200, W + 400, H + 400); }
}

export function renderFrame(ctx: FrameContext, time: number, input: Readonly<Record<string, unknown>>) {
  const p = input as { grain: number; motion: string }, k = ctx.assets.kit as Kit, smooth = p.motion === 'smooth';
  const s = smooth ? time : Math.floor(time * 12 + 1e-6) / 12;
  const f: F = { t: time, s, pose: Math.floor(time * 12 + 1e-6), smooth, noise: (...n) => ctx.noise(...n) };
  ctx.withCanvas(c => {
    c.scale(ctx.width / W, ctx.height / H);
    withCamera(c, camera(time), w => world(w as G, k, f));
    // vignette and paper grain over the whole frame
    const v = c.createRadialGradient(W / 2, H / 2, 520, W / 2, H / 2, 1150); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,0,10,.42)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
    if (p.grain > 0) { c.globalCompositeOperation = 'multiply'; c.globalAlpha = p.grain; c.fillStyle = c.createPattern(k.grain, 'repeat')!; c.fillRect(0, 0, W, H); }
  });
}
