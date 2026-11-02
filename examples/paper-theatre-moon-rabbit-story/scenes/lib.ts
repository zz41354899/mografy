// Lunar Pop Club No.01 — Paper Puppet Theatre. Tokens, geometry and the paper pieces, prepared once in setup.
// Everything that never changes shape (the theatre, flats, cards, the puppet faces) is baked into bitmaps here,
// shadows included, so a frame only places pieces. Every function below depends only on its arguments.
import { clamp, colorLerp } from '@mografy/runtime';
import type { SetupContext } from '@mografy/runtime';

export const W = 1920, H = 1080, TAU = Math.PI * 2;
export type G = CanvasRenderingContext2D;

export const C = {
  ivory: '#FFF7EB', pink: '#F8A3C8', lav: '#B99BDD', violet: '#9977BD', plum: '#30122E', yellow: '#FFE49B',
  rose: '#CC528B', gold: '#E2B055', goldD: '#B8862F', wood: '#6E4634', room: '#160814', berry: '#7E2E5E',
  deepRose: '#9C3C70', drape: '#7E2E5E', drapeDark: '#5C1D4E', night: '#30122E', nightDeep: '#1F0A1E',
} as const;
export const SERIF = '"LPC Serif TC"', DIDOT = '"LPC Numerals"', LAT = '"Inter Display"';

/** The proscenium opening and the stage line the puppets stand on (world = frame at zoom 1). */
export const OP = { x: 330, y: 236, w: 1260, h: 640 };
export const OPR = OP.x + OP.w, OPB = OP.y + OP.h;
export const FLOOR = OPB - 40;
/** end-stage.png: moon centre and radius in source pixels; the backdrop is fitted to the opening width. */
export const STAGE_MOON = { x: 832, y: 332, r: 222 };
export const BACKDROP_K = OP.w / 1672;
export const PAINTED_MOON = { x: OP.x + OP.w / 2, y: OP.y + 205, r: STAGE_MOON.r * BACKDROP_K };
/** character.webp: the standing foot (bottom centre), the rod socket on the back, the face for the wink crop. */
export const FOOT = { x: 493, y: 1526 }, SOCKET = { x: 540, y: 880 }, WINK = { x: 548, y: 290 };

export const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a)})`;
};
export const mix = (a: string, b: string, p: number) => colorLerp(a, b, clamp(p));

// ---------------------------------------------------------------- sprites
/** A baked piece: drawn at world rect (x, y, w, h), stored at SS × resolution. */
export interface Sprite { img: ImageBitmap; x: number; y: number; w: number; h: number }
const SS = 1.25;
export type OG = OffscreenCanvasRenderingContext2D;
export function bake(x: number, y: number, w: number, h: number, draw: (c: OG) => void, scale = SS): Sprite {
  const cv = new OffscreenCanvas(Math.ceil(w * scale), Math.ceil(h * scale)), c = cv.getContext('2d')!;
  c.scale(scale, scale); c.translate(-x, -y); draw(c);
  return { img: cv.transferToImageBitmap(), x, y, w, h };
}
export function put(c: G, s: Sprite, dx = 0, dy = 0, alpha = 1) {
  if (alpha <= .002) return;
  if (alpha < 1) { const a = c.globalAlpha; c.globalAlpha = a * alpha; c.drawImage(s.img, s.x + dx, s.y + dy, s.w, s.h); c.globalAlpha = a; }
  else c.drawImage(s.img, s.x + dx, s.y + dy, s.w, s.h);
}
/** Paper shadow, set on an offscreen context (setup only), scaled for the bake resolution. */
function shade(c: OG, k = 1, a = .38) {
  c.shadowColor = `rgba(18,4,20,${a})`; c.shadowBlur = 18 * k * SS; c.shadowOffsetX = 7 * k * SS; c.shadowOffsetY = 11 * k * SS;
}
function flat(c: OG, path: (c: OG) => void, fill: string | CanvasGradient, o: { k?: number; a?: number; edge?: string; lw?: number } = {}) {
  c.save(); shade(c, o.k ?? 1, o.a ?? .38); c.fillStyle = fill; path(c); c.fill(); c.restore();
  if (o.edge) { c.save(); path(c); c.lineWidth = o.lw ?? 5; c.strokeStyle = o.edge; c.stroke(); c.restore(); }
}
function rr(c: OG, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.roundRect(x, y, w, h, r); }
export function sakuraPath(c: G | OG, r: number) {
  c.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = i * TAU / 5, s = Math.sin(a), co = Math.cos(a);
    const P = (x: number, y: number) => [x * co - y * s, x * s + y * co] as const;
    const p0 = P(0, 0), c1 = P(-r * .62, -r * .45), c2 = P(-r * .42, -r * 1.02), e1 = P(-r * .12, -r * .98), n = P(0, -r * .82), e2 = P(r * .12, -r * .98), c3 = P(r * .42, -r * 1.02), c4 = P(r * .62, -r * .45);
    c.moveTo(...p0); c.bezierCurveTo(...c1, ...c2, ...e1); c.lineTo(...n); c.lineTo(...e2); c.bezierCurveTo(...c3, ...c4, ...p0);
  }
}
function sakura(c: OG, x: number, y: number, r: number, fill: string, rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = fill; sakuraPath(c, r); c.fill();
  c.fillStyle = C.yellow; c.beginPath(); c.arc(0, 0, r * .16, 0, TAU); c.fill(); c.restore();
}
export function tracked(c: G | OG, text: string, x: number, y: number, sp: number, align: 'left' | 'center' | 'right' = 'left') {
  const chars = [...text], ws = chars.map(ch => c.measureText(ch).width), tw = ws.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
  let cx = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
  const al = c.textAlign; c.textAlign = 'left'; chars.forEach((ch, i) => { c.fillText(ch, cx, y); cx += ws[i]! + sp; }); c.textAlign = al;
  return tw;
}
/** A vertical CJK column, top-down; the comma sits in the upper right of its cell. */
export function vtext(c: G | OG, text: string, x: number, y: number, size: number, col: string, shadow?: string) {
  c.save(); c.font = `700 ${size}px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'top';
  if (shadow) { c.shadowColor = shadow; c.shadowBlur = size * .18 * SS; c.shadowOffsetX = size * .04 * SS; c.shadowOffsetY = size * .06 * SS; }
  c.fillStyle = col;
  [...text].forEach((ch, i) => {
    const cy = y + i * size * 1.08;
    if ('，、。'.includes(ch)) c.fillText(ch, x + size * .5, cy - size * .45);
    else if ('…—'.includes(ch)) { c.save(); c.translate(x, cy + size * .5); c.rotate(Math.PI / 2); c.textBaseline = 'middle'; c.fillText(ch, 0, 0); c.restore(); }
    else c.fillText(ch, x, cy);
  });
  c.restore();
}
function star4(c: OG, x: number, y: number, r: number, col: string) {
  c.save(); c.translate(x, y); c.fillStyle = col; c.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, q = i % 2 ? r * .32 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); }
  c.closePath(); c.fill(); c.restore();
}

// ---------------------------------------------------------------- the theatre (static, baked once)
// Built like a real toy theatre: stacked cardstock layers, each with a drop shadow, paper fibre, a lit top edge and
// a darker lower edge (the card's thickness). The crown, pillars, lanterns and lace sit on the layers.
let FIBRE: CanvasPattern | null = null;
const FRAME = { x: 150, y: 168, w: 1620, h: 818 };          // outer body
export const PLATE = { x: 700, y: 118, w: 520, h: 96 };    // header plate (centre y 158)
const PLATE_CY = PLATE.y + PLATE.h / 2;
/** A cardstock piece: shadow, fill, fibre, a lit edge on top-left and a thickness edge on the bottom-right. */
function card(c: OG, path: (c: OG) => void, fill: string | CanvasGradient, o: { k?: number; a?: number; fibre?: number; lit?: number } = {}) {
  c.save(); shade(c, o.k ?? 1, o.a ?? .4); c.fillStyle = fill; path(c); c.fill(); c.restore();
  c.save(); path(c); c.clip();
  if (FIBRE && (o.fibre ?? .5) > 0) { c.globalAlpha = o.fibre ?? .5; c.globalCompositeOperation = 'soft-light'; c.fillStyle = FIBRE; c.fillRect(-200, -200, W + 400, H + 400); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
  c.translate(1.6, 2.2); c.strokeStyle = 'rgba(30,6,30,.35)'; c.lineWidth = 3; path(c); c.stroke();
  c.translate(-3.2, -4.4); c.strokeStyle = `rgba(255,248,240,${o.lit ?? .45})`; c.lineWidth = 2.4; path(c); c.stroke();
  c.restore();
}
function room(c: OG) {
  const g = c.createRadialGradient(W / 2, 420, 120, W / 2, 520, 1250); g.addColorStop(0, '#4A1D42'); g.addColorStop(.5, '#2A0F27'); g.addColorStop(1, C.room);
  c.fillStyle = g; c.fillRect(-200, -200, W + 400, H + 400);
  // a lamp pool on the wall behind the theatre
  const l = c.createRadialGradient(960, 300, 40, 960, 360, 900); l.addColorStop(0, 'rgba(255,190,200,.16)'); l.addColorStop(1, 'rgba(255,190,200,0)');
  c.fillStyle = l; c.fillRect(-200, -200, W + 400, 1200);
  // the desk: warm wood with grain
  const d = c.createLinearGradient(0, 996, 0, 1180); d.addColorStop(0, '#5A2A2E'); d.addColorStop(1, '#2A1018'); c.fillStyle = d; c.fillRect(-200, 996, W + 400, 300);
  c.strokeStyle = 'rgba(255,200,170,.07)'; c.lineWidth = 1.5;
  for (let i = 0; i < 9; i++) { const y = 1004 + i * 9 + (i % 3) * 2; c.beginPath(); c.moveTo(-200, y); c.bezierCurveTo(500, y - 3, 1300, y + 4, W + 200, y - 1); c.stroke(); }
  c.fillStyle = 'rgba(255,214,190,.14)'; c.fillRect(-200, 996, W + 400, 2);
  // contact shadow of the theatre on the desk and wall
  const sh = c.createRadialGradient(960, 990, 100, 960, 990, 900); sh.addColorStop(0, 'rgba(8,0,8,.55)'); sh.addColorStop(1, 'rgba(8,0,8,0)');
  c.save(); c.scale(1, .12); c.fillStyle = sh; c.fillRect(0, 990 / .12 - 900, W, 1800); c.restore();
}
/** Auspicious cloud: three lobes and an inner curl, ivory card with a gold line. */
function cloudCurl(c: OG, x: number, y: number, s: number, flip: number) {
  c.save(); c.translate(x, y); c.scale(s * flip, s);
  const path = (g: OG) => { g.beginPath(); g.arc(-38, 6, 26, Math.PI * .5, Math.PI * 1.5); g.arc(0, -10, 34, Math.PI * 1.1, Math.PI * 1.95); g.arc(44, 2, 26, Math.PI * 1.3, Math.PI * .5); g.closePath(); };
  card(c, path, C.ivory, { k: .6, fibre: .3 });
  c.strokeStyle = C.gold; c.lineWidth = 3; c.lineCap = 'round';
  c.beginPath(); c.arc(0, -6, 18, Math.PI * .9, Math.PI * 2.3); c.stroke();
  c.beginPath(); c.arc(4, -4, 8, Math.PI * 1.2, Math.PI * 2.6); c.stroke();
  c.beginPath(); c.arc(-38, 6, 12, Math.PI * .6, Math.PI * 1.6); c.stroke();
  c.restore();
}
function lantern(c: OG, x: number, y: number) {
  c.strokeStyle = 'rgba(226,176,85,.9)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 70); c.lineTo(x, y - 30); c.stroke();
  const body = (g: OG) => { g.beginPath(); g.ellipse(x, y, 30, 34, 0, 0, TAU); };
  const lg = c.createRadialGradient(x - 8, y - 8, 4, x, y, 36); lg.addColorStop(0, '#FFC7DA'); lg.addColorStop(1, C.rose);
  card(c, body, lg, { k: .7, fibre: .4 });
  c.strokeStyle = 'rgba(126,46,94,.55)'; c.lineWidth = 1.6;
  for (const k of [-.66, -.33, 0, .33, .66]) { c.beginPath(); c.ellipse(x, y, Math.abs(30 * k) + .1, 34, 0, 0, TAU); c.stroke(); }
  c.fillStyle = C.gold; c.beginPath(); c.roundRect(x - 14, y - 40, 28, 9, 3); c.roundRect(x - 14, y + 31, 28, 9, 3); c.fill();
  c.strokeStyle = C.gold; c.lineWidth = 2; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(x + i * 2.4, y + 40); c.lineTo(x + i * 3.2, y + 66); c.stroke(); }
}
function pillar(c: OG, x: number, side: number) {
  const top = 262, bot = 930, sw = 64;
  // plinth and capital
  card(c, g => { g.beginPath(); g.roundRect(x - 52, bot - 6, 104, 46, 6); }, C.berry, { k: .7 });
  card(c, g => { g.beginPath(); g.roundRect(x - 44, bot - 28, 88, 26, 5); }, C.rose, { k: .6 });
  // shaft with fluting
  const sg = c.createLinearGradient(x - sw / 2, 0, x + sw / 2, 0); sg.addColorStop(0, '#F2B6CF'); sg.addColorStop(.45, '#FFE0EC'); sg.addColorStop(1, '#E596B9');
  card(c, g => { g.beginPath(); g.rect(x - sw / 2, top + 30, sw, bot - top - 58); }, sg, { k: .8, fibre: .4 });
  c.strokeStyle = 'rgba(204,82,139,.35)'; c.lineWidth = 2; for (const dx of [-18, -6, 6, 18]) { c.beginPath(); c.moveTo(x + dx, top + 44); c.lineTo(x + dx, bot - 40); c.stroke(); }
  card(c, g => { g.beginPath(); g.roundRect(x - 48, top, 96, 34, 8); }, C.rose, { k: .7 });
  c.fillStyle = C.gold; for (const s of [-1, 1]) { c.beginPath(); c.arc(x + s * 40, top + 22, 11, 0, TAU); c.fill(); c.fillStyle = C.berry; c.beginPath(); c.arc(x + s * 40, top + 22, 5, 0, TAU); c.fill(); c.fillStyle = C.gold; }
  c.fillStyle = C.gold; c.fillRect(x - 48, top + 32, 96, 3); c.fillRect(x - 44, bot - 30, 88, 3);
  // a sakura vine climbing the shaft
  c.strokeStyle = '#7E2E5E'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 30 * side, bot - 40);
  for (let i = 0; i < 6; i++) { const y0 = bot - 40 - i * 100; c.bezierCurveTo(x + 40 * side, y0 - 30, x + 40 * side, y0 - 70, x - 30 * side * (i % 2 ? -1 : 1), y0 - 100); }
  c.stroke();
  for (let i = 0; i < 7; i++) { const y = bot - 90 - i * 88, xx = x + (i % 2 ? 30 : -30) * side; sakura(c, xx, y, 15 + (i % 3) * 3, i % 2 ? C.ivory : '#F8A3C8', i * .7); }
  lantern(c, x, 380);
}
function proscenium(c: OG) {
  // back layer: a plum card with an arched crown
  const crown = (g: OG, inset: number) => {
    const x0 = FRAME.x + inset, x1 = FRAME.x + FRAME.w - inset, y0 = FRAME.y + inset, y1 = FRAME.y + FRAME.h - inset;
    g.beginPath(); g.moveTo(x0 + 24, y0); g.lineTo(560 + inset, y0);
    g.bezierCurveTo(640 + inset, y0, 650 + inset, 96 + inset, 760, 84 + inset); g.lineTo(1160, 84 + inset);
    g.bezierCurveTo(1270 - inset, 96 + inset, 1280 - inset, y0, 1360 - inset, y0); g.lineTo(x1 - 24, y0);
    g.quadraticCurveTo(x1, y0, x1, y0 + 24); g.lineTo(x1, y1 - 24); g.quadraticCurveTo(x1, y1, x1 - 24, y1); g.lineTo(x0 + 24, y1); g.quadraticCurveTo(x0, y1, x0, y1 - 24); g.lineTo(x0, y0 + 24); g.quadraticCurveTo(x0, y0, x0 + 24, y0); g.closePath();
  };
  card(c, g => crown(g, 0), '#5E1F52', { k: 2.2, a: .55, fibre: .35, lit: .25 });
  const pg = c.createLinearGradient(0, 90, 0, 990); pg.addColorStop(0, '#FFC2DA'); pg.addColorStop(.5, C.pink); pg.addColorStop(1, '#E68AB2');
  card(c, g => crown(g, 16), pg, { k: 1, fibre: .55 });
  // lace scallops along the inside of the pink layer
  c.fillStyle = C.ivory;
  for (let x = FRAME.x + 60; x < FRAME.x + FRAME.w - 60; x += 26) { if (x > 600 && x < 1320) continue; c.beginPath(); c.arc(x, FRAME.y + 16, 9, 0, Math.PI); c.fill(); }
  c.fillStyle = 'rgba(204,82,139,.6)';
  for (let x = FRAME.x + 60; x < FRAME.x + FRAME.w - 60; x += 26) { if (x > 600 && x < 1320) continue; c.beginPath(); c.arc(x, FRAME.y + 18, 2.5, 0, TAU); c.fill(); }
  // the moon crest behind the plate, gold-rimmed, with clouds either side
  // a moon rising behind the plate: rays first, then the disc
  const MC = { x: 960, y: 214, r: 150 };
  for (let i = 0; i < 17; i++) { const a = Math.PI * (1.04 + i * .92 / 16), r0 = MC.r + 6, r1 = MC.r + (i % 2 ? 20 : 34);
    c.strokeStyle = i % 2 ? 'rgba(226,176,85,.7)' : C.gold; c.lineWidth = i % 2 ? 2 : 3.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(MC.x + Math.cos(a) * r0, MC.y + Math.sin(a) * r0); c.lineTo(MC.x + Math.cos(a) * r1, MC.y + Math.sin(a) * r1); c.stroke(); }
  const mg = c.createRadialGradient(920, 120, 10, 960, 190, 160); mg.addColorStop(0, '#FFF6D8'); mg.addColorStop(1, '#F2C66C');
  card(c, g => { g.beginPath(); g.arc(MC.x, MC.y, MC.r, Math.PI, 0); g.closePath(); }, mg, { k: .9, fibre: .4 });
  c.fillStyle = 'rgba(214,160,70,.28)'; for (const [x, y, r] of [[900, 108, 14], [1010, 96, 9], [1050, 124, 7], [870, 140, 6]] as const) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  c.strokeStyle = C.gold; c.lineWidth = 3; c.beginPath(); c.arc(MC.x, MC.y, MC.r - 10, Math.PI * 1.03, Math.PI * 1.97); c.stroke();
  cloudCurl(c, 620, 170, 1.05, -1); cloudCurl(c, 1300, 170, 1.05, 1);
  for (const [x, y, r] of [[700, 118, 9], [1222, 112, 8], [560, 200, 6], [1366, 204, 6]] as const) { c.fillStyle = C.yellow; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, q = i % 2 ? r * .35 : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); c.fill(); }
  // the opening: a rose card frame, gold foil and a lace edge
  card(c, g => { g.beginPath(); g.roundRect(OP.x - 40, OP.y - 34, OP.w + 80, OP.h + 60, 22); g.roundRect(OP.x - 8, OP.y - 6, OP.w + 16, OP.h + 12, 8); }, C.rose, { k: .9, fibre: .45 });
  c.save(); c.strokeStyle = C.gold; c.lineWidth = 3; c.beginPath(); c.roundRect(OP.x - 28, OP.y - 22, OP.w + 56, OP.h + 36, 16); c.stroke();
  c.lineWidth = 1.2; c.setLineDash([2, 6]); c.beginPath(); c.roundRect(OP.x - 20, OP.y - 14, OP.w + 40, OP.h + 22, 12); c.stroke(); c.restore();
  // pillars with lanterns
  pillar(c, 238, 1); pillar(c, 1682, -1);
  // the header plate (a rabbit head): ears behind, then the plate
  for (const [ex, rot] of [[898, -.24], [1022, .24]] as const) {
    c.save(); c.translate(ex, 126); c.rotate(rot);
    card(c, g => { g.beginPath(); g.ellipse(0, -18, 22, 44, 0, 0, TAU); }, C.ivory, { k: .7, fibre: .35 });
    c.fillStyle = '#F7B3CD'; c.beginPath(); c.ellipse(0, -16, 10, 30, 0, 0, TAU); c.fill(); c.restore();
  }
  card(c, g => rr(g, PLATE.x, PLATE.y, PLATE.w, PLATE.h, 50), C.plum, { k: 1.1, fibre: .3, lit: .3 });
  c.save(); c.strokeStyle = C.gold; c.lineWidth = 3; rr(c, PLATE.x + 11, PLATE.y + 11, PLATE.w - 22, PLATE.h - 22, 40); c.stroke();
  c.lineWidth = 1.2; rr(c, PLATE.x + 17, PLATE.y + 17, PLATE.w - 34, PLATE.h - 34, 34); c.stroke(); c.restore();
  header(c, '#C9A15A');
  // base plinth on the desk
  card(c, g => { g.beginPath(); g.roundRect(FRAME.x - 14, 972, FRAME.w + 28, 30, 6); }, '#4A1640', { k: .8, fibre: .3, lit: .25 });
  c.fillStyle = C.gold; c.fillRect(FRAME.x - 4, 978, FRAME.w + 8, 2.5);
}
/** The header type; baked twice (unlit, lit) and cross-faded. */
function header(c: OG, col: string, lit = false) {
  c.save(); c.font = `600 38px ${LAT}`; c.fillStyle = col; c.textBaseline = 'middle';
  if (lit) { c.shadowColor = 'rgba(255,228,155,.85)'; c.shadowBlur = 22 * SS; }
  tracked(c, 'LUNAR POP CLUB', 960, PLATE_CY - 12, 9, 'center');
  c.shadowBlur = 0; c.fillStyle = lit ? '#FFC0DA' : C.pink;
  c.font = `700 14px ${SERIF}`; const w1 = tracked(c, '月兔紙劇場', 0, -999, 5);
  c.font = `600 14px ${LAT}`; const w2 = tracked(c, '·  NO.01', 0, -999, 5);
  const x0 = 960 - (w1 + 18 + w2) / 2;
  c.font = `700 14px ${SERIF}`; tracked(c, '月兔紙劇場', x0, PLATE_CY + 24, 5);
  c.font = `600 14px ${LAT}`; tracked(c, '·  NO.01', x0 + w1 + 18, PLATE_CY + 24, 5);
  c.restore();
}
/** Two-tier valance: pleated swags on a pelmet, then a scalloped front with gold fringe and tassels. */
function valance(c: OG) {
  const x0 = OP.x - 14, x1 = OPR + 14, top = OP.y - 16, n = 6, sw = (x1 - x0) / n;
  // pelmet board
  card(c, g => { g.beginPath(); g.rect(x0 - 6, top - 4, x1 - x0 + 12, 30); }, '#5E1F52', { k: .8, fibre: .3, lit: .3 });
  c.fillStyle = C.gold; c.fillRect(x0 - 6, top + 22, x1 - x0 + 12, 3);
  for (let x = x0 + 14; x < x1; x += 28) { c.save(); c.translate(x, top + 11); c.rotate(Math.PI / 4); c.fillStyle = 'rgba(226,176,85,.8)'; c.fillRect(-4, -4, 8, 8); c.restore(); }
  // back tier: swags with pleats
  for (let i = 0; i < n; i++) {
    const a = x0 + i * sw, b = a + sw, d = top + 118;
    const swag = (g: OG) => { g.beginPath(); g.moveTo(a, top + 24); g.lineTo(b, top + 24); g.quadraticCurveTo(b - 6, d - 40, (a + b) / 2, d); g.quadraticCurveTo(a + 6, d - 40, a, top + 24); g.closePath(); };
    const sg = c.createLinearGradient(0, top + 24, 0, d); sg.addColorStop(0, '#8E3570'); sg.addColorStop(1, '#6A2258');
    card(c, swag, sg, { k: .9, fibre: .3, lit: .2 });
    c.save(); swag(c); c.clip();
    for (let k = 1; k <= 4; k++) { const yy = top + 24 + k * 20; c.strokeStyle = 'rgba(40,6,36,.35)'; c.lineWidth = 3; c.beginPath(); c.moveTo(a, yy - 10); c.quadraticCurveTo((a + b) / 2, yy + k * 14, b, yy - 10); c.stroke();
      c.strokeStyle = 'rgba(255,200,230,.18)'; c.lineWidth = 2; c.beginPath(); c.moveTo(a, yy - 4); c.quadraticCurveTo((a + b) / 2, yy + k * 14 + 6, b, yy - 4); c.stroke(); }
    c.restore();
  }
  // front tier: scallops with fringe
  const m = 14, mw = (x1 - x0) / m, fy = top + 50;
  c.save(); shade(c, .8); c.fillStyle = C.deepRose; c.beginPath(); c.moveTo(x0, top + 22); c.lineTo(x1, top + 22);
  for (let i = m; i > 0; i--) { const xa = x0 + i * mw, xb = xa - mw; c.lineTo(xa, fy); c.quadraticCurveTo((xa + xb) / 2, fy + 46, xb, fy); }
  c.closePath(); c.fill(); c.restore();
  c.strokeStyle = C.gold; c.lineWidth = 2.5; c.beginPath();
  for (let i = 0; i < m; i++) { const xa = x0 + i * mw, xb = xa + mw; c.moveTo(xa, fy); c.quadraticCurveTo((xa + xb) / 2, fy + 46, xb, fy); }
  c.stroke();
  c.lineWidth = 1.4; c.strokeStyle = 'rgba(226,176,85,.85)';
  for (let i = 0; i < m; i++) { const xa = x0 + i * mw; for (let j = 1; j < 12; j++) { const u = j / 12, xx = xa + u * mw, yy = fy + 4 * u * (1 - u) * 46 * .5 * 2; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx, yy + 9); c.stroke(); } }
  for (let i = 0; i <= m; i++) {   // tassels at the points
    const xx = x0 + i * mw; c.fillStyle = C.gold; c.beginPath(); c.arc(xx, fy + 2, 5, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(xx - 4, fy + 6); c.lineTo(xx + 4, fy + 6); c.lineTo(xx + 6, fy + 24); c.lineTo(xx - 6, fy + 24); c.closePath(); c.fill();
  }
}
export const LANTERNS = Array.from({ length: 9 }, (_, i) => OP.x + 50 + i * (OP.w - 100) / 8);
const LIP = { top: OPB + 6, front: 912, base: 972 };
function apron(c: OG) {
  // the frame returns: the card's thickness seen inside the opening edges
  for (const [x, dir] of [[OP.x - 8, 1], [OPR + 8, -1]] as const) {
    const g = c.createLinearGradient(x, 0, x + dir * 26, 0); g.addColorStop(0, 'rgba(40,8,34,.55)'); g.addColorStop(1, 'rgba(40,8,34,0)');
    c.fillStyle = g; c.fillRect(Math.min(x, x + dir * 26), OP.y - 6, 26, OP.h + 12);
  }
  // the stage lip: wooden boards in light perspective
  const lip = (g: OG) => { g.beginPath(); g.moveTo(OP.x - 60, LIP.top); g.lineTo(OPR + 60, LIP.top); g.lineTo(OPR + 110, LIP.front); g.lineTo(OP.x - 110, LIP.front); g.closePath(); };
  const wg = c.createLinearGradient(0, LIP.top, 0, LIP.front); wg.addColorStop(0, '#9A4A66'); wg.addColorStop(1, '#B9637F');
  card(c, lip, wg, { k: 1, fibre: .4, lit: .3 });
  c.save(); lip(c); c.clip(); c.strokeStyle = 'rgba(60,12,40,.28)'; c.lineWidth = 1.5;
  for (let i = -12; i <= 12; i++) { const xt = 960 + i * (OP.w + 120) / 24, xb = 960 + i * (OP.w + 220) / 24; c.beginPath(); c.moveTo(xt, LIP.top); c.lineTo(xb, LIP.front); c.stroke(); }
  c.restore();
  // the skirt: plum card with a sakura band between gold rules
  const skirt = (g: OG) => { g.beginPath(); g.rect(OP.x - 110, LIP.front, OP.w + 220, LIP.base - LIP.front); };
  card(c, skirt, C.berry, { k: 1.1, a: .5, fibre: .4, lit: .35 });
  c.fillStyle = C.gold; c.fillRect(OP.x - 110, LIP.front + 4, OP.w + 220, 2.5); c.fillRect(OP.x - 110, LIP.base - 7, OP.w + 220, 2.5);
  for (let x = OP.x - 86, i = 0; x < OPR + 100; x += 46, i++) {
    if (i % 2) sakura(c, x, (LIP.front + LIP.base) / 2, 11, 'rgba(255,247,235,.85)', i * .4);
    else { c.fillStyle = 'rgba(226,176,85,.75)'; c.save(); c.translate(x, (LIP.front + LIP.base) / 2); c.rotate(Math.PI / 4); c.fillRect(-4, -4, 8, 8); c.restore(); }
  }
  // shell footlights on the lip
  for (const x of LANTERNS) {
    const y = LIP.front - 6;
    const shell = (g: OG) => { g.beginPath(); g.moveTo(x - 30, y); g.quadraticCurveTo(x - 32, y - 34, x, y - 38); g.quadraticCurveTo(x + 32, y - 34, x + 30, y); g.closePath(); };
    const gg = c.createLinearGradient(0, y - 38, 0, y); gg.addColorStop(0, '#F6D27E'); gg.addColorStop(1, C.goldD);
    card(c, shell, gg, { k: .5, fibre: .2, lit: .5 });
    c.strokeStyle = 'rgba(120,70,20,.5)'; c.lineWidth = 1.4;
    for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(x, y - 2); c.lineTo(x + k * 9, y - 32 + Math.abs(k) * 4); c.stroke(); }
    c.fillStyle = C.yellow; c.beginPath(); c.arc(x, y - 8, 9, 0, TAU); c.fill();
  }
}
function footGlow(c: OG) {
  for (const x of LANTERNS) {
    const g = c.createRadialGradient(x, LIP.front - 14, 2, x, LIP.front - 14, 64); g.addColorStop(0, 'rgba(255,228,155,.6)'); g.addColorStop(.5, 'rgba(255,228,155,.18)'); g.addColorStop(1, 'rgba(255,228,155,0)');
    c.fillStyle = g; c.fillRect(x - 64, LIP.front - 78, 128, 128);
  }
  const g = c.createLinearGradient(0, OPB, 0, OPB - 260); g.addColorStop(0, 'rgba(255,214,170,.24)'); g.addColorStop(1, 'rgba(255,214,170,0)');
  c.fillStyle = g; c.fillRect(OP.x, OPB - 260, OP.w, 260);
}

// ---------------------------------------------------------------- the sets
function hills(c: OG) {
  const base = FLOOR;
  flat(c, g => { g.beginPath(); g.moveTo(OP.x - 10, base - 120); for (let i = 0; i <= 8; i++) g.lineTo(OP.x + i * OP.w / 8, base - 150 - (i % 2 ? 110 : 20) - (i === 4 ? 60 : 0)); g.lineTo(OPR + 10, base); g.lineTo(OP.x - 10, base); g.closePath(); }, '#8C5FA8', { k: .8 });
  flat(c, g => { g.beginPath(); g.moveTo(OP.x - 10, base - 40); for (let i = 0; i <= 6; i++) g.lineTo(OP.x + i * OP.w / 6 + 60, base - 60 - (i % 2 ? 90 : 10)); g.lineTo(OPR + 10, base + 50); g.lineTo(OP.x - 10, base + 50); g.closePath(); }, '#6A2E64');
  c.fillStyle = '#3F1638'; c.fillRect(OP.x, FLOOR - 4, OP.w, OPB - FLOOR + 4);
}
function dusk(c: OG) {
  const g = c.createLinearGradient(0, OP.y, 0, FLOOR); g.addColorStop(0, '#9977BD'); g.addColorStop(.6, '#D9A2C9'); g.addColorStop(1, '#F8C3D6');
  c.fillStyle = g; c.fillRect(OP.x, OP.y, OP.w, OP.h);
}
function night(c: OG) {
  c.fillStyle = C.night; c.fillRect(OP.x, OP.y, OP.w, OP.h);
  c.fillStyle = '#24091F'; c.fillRect(OP.x, FLOOR - 4, OP.w, OPB - FLOOR + 4); c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(OP.x, FLOOR - 4, OP.w, 3);
}
export const TRI_PATH = (g: G | OG) => { g.beginPath(); g.moveTo(OP.x - 10, OP.y - 10); g.lineTo(OP.x + 520, OP.y - 10); g.lineTo(OP.x - 10, OP.y + 420); g.closePath(); };
export const BLOCK_PATH = (g: G | OG) => { g.beginPath(); g.moveTo(OPR - 250, OP.y + 210); g.lineTo(OPR + 20, OP.y + 120); g.lineTo(OPR + 20, FLOOR + 30); g.lineTo(OPR - 380, FLOOR + 30); g.closePath(); };
function cloud(c: OG, cx: number, cy: number, sc: number) {
  flat(c, g => { g.beginPath(); g.arc(cx, cy, 70 * sc, Math.PI, 0); g.arc(cx + 90 * sc, cy, 50 * sc, Math.PI, 0); g.arc(cx - 90 * sc, cy, 46 * sc, Math.PI, 0); g.closePath(); }, '#5A2C63', { k: .7 });
}

/** A washi screen: back-lit colour or unlit paper, with its wooden lattice. */
function screen(c: OG, lit: string | null) {
  if (lit) {
    const g = c.createRadialGradient(OP.x + 700, OP.y + 290, 60, OP.x + 650, OP.y + 330, 760);
    if (lit === 'pink') { g.addColorStop(0, '#FFE3EE'); g.addColorStop(.45, '#F6B3D2'); g.addColorStop(1, '#B98BC9'); }
    else { g.addColorStop(0, '#F1E6FF'); g.addColorStop(.45, '#C9AEEA'); g.addColorStop(1, '#7E5FA8'); }
    c.fillStyle = g;
  } else c.fillStyle = '#D9C4D2';
  c.fillRect(OP.x, OP.y, OP.w, OP.h);
  c.save(); c.globalAlpha = lit ? .16 : .3; c.strokeStyle = '#fff'; c.lineWidth = .8;
  let s = 11; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 420; i++) { const x = OP.x + r() * OP.w, y = OP.y + r() * OP.h; c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + 10, y + 6, x + 22, y - 5, x + 30 + r() * 30, y + r() * 8); c.stroke(); }
  c.restore();
  c.strokeStyle = 'rgba(110,70,52,.6)'; c.lineWidth = 7; for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(OP.x + i * OP.w / 6, OP.y); c.lineTo(OP.x + i * OP.w / 6, OPB); c.stroke(); }
  c.lineWidth = 5; c.beginPath(); c.moveTo(OP.x, OP.y + OP.h * .5); c.lineTo(OPR, OP.y + OP.h * .5); c.stroke();
}
function roller(c: OG) {
  c.save(); shade(c, .8); const g = c.createLinearGradient(0, -23, 0, 23); g.addColorStop(0, '#E9B3CF'); g.addColorStop(.5, '#FFE3EE'); g.addColorStop(1, '#C994B6');
  c.fillStyle = g; rr(c, OP.x + 6, -23, OP.w - 12, 46, 23); c.fill(); c.restore();
  c.fillStyle = C.gold; c.beginPath(); c.arc(OP.x + 20, 0, 9, 0, TAU); c.arc(OPR - 20, 0, 9, 0, TAU); c.fill();
}

// ---------------------------------------------------------------- chapter fields (flats with their copy)
export const CARD_POS = [{ x: 820, y: 560, r: 270 }, { x: 1120, y: 572, r: 248 }, { x: 820, y: 560, r: 260 }] as const;
function diamond(c: OG, x: number, y: number, s: number, col: string) { c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillStyle = col; c.fillRect(-s / 2, -s / 2, s, s); c.restore(); }
function numeral(c: OG, n: string, x: number, y: number, stroke: string, fill: string, cap: string, capCol: string) {
  c.save(); c.font = `400 150px ${DIDOT}`; c.lineWidth = 3; c.strokeStyle = stroke; c.fillStyle = fill; c.fillText(n, x, y); c.strokeText(n, x, y);
  c.font = `600 18px ${LAT}`; c.fillStyle = capCol; tracked(c, cap, x + 5, y + 28, 6); c.restore();
}
function field(c: OG, i: number) {
  if (i === 0) {
    const f = c.createLinearGradient(OP.x, OP.y, OPR, OPB); f.addColorStop(0, '#FFC7DE'); f.addColorStop(1, C.pink); c.fillStyle = f; c.fillRect(OP.x, OP.y, OP.w, OP.h);
    flat(c, g => { g.beginPath(); g.moveTo(OP.x - 20, OPB - 40); g.lineTo(OP.x + 520, OPB + 20); g.lineTo(OP.x + 240, OPB + 20); g.lineTo(OP.x - 20, OPB + 20); g.closePath(); }, C.plum);
    flat(c, g => { g.beginPath(); g.moveTo(OP.x - 20, OP.y + 250); g.lineTo(OP.x + 760, OPB + 20); g.lineTo(OP.x + 470, OPB + 20); g.lineTo(OP.x - 20, OP.y + 470); g.closePath(); }, C.plum, { k: 1.1 });
    for (const [x, y] of [[520, 330], [1160, 300], [1090, 760]] as const) diamond(c, x, y, 22, C.ivory);
    vtext(c, '登場', 1400, 350, 120, C.ivory, 'rgba(48,18,46,.55)');
    vtext(c, '今晚，陪伴著你', 1270, 356, 46, C.plum);
    numeral(c, '01', 1250, 840, C.goldD, 'rgba(226,176,85,.28)', 'FIRST APPEARANCE', C.plum);
  } else if (i === 1) {
    c.fillStyle = C.lav; c.fillRect(OP.x, OP.y, OP.w, OP.h);
    flat(c, g => { g.beginPath(); g.moveTo(OP.x - 20, OP.y - 20); g.lineTo(OP.x + 260, OP.y - 20); g.lineTo(OP.x + 900, OPB + 20); g.lineTo(OP.x + 620, OPB + 20); g.closePath(); }, C.plum, { k: 1.1 });
    for (const [x, y] of [[700, 820], [1480, 330]] as const) diamond(c, x, y, 20, C.ivory);
    vtext(c, '魅力', 520, 350, 120, C.ivory, 'rgba(48,18,46,.55)');
    vtext(c, '月亮偶像', 660, 366, 46, C.plum);
    numeral(c, '02', 380, 840, C.ivory, 'rgba(255,247,235,.2)', 'IRRESISTIBLE CHARM', C.ivory);
  } else {
    c.fillStyle = C.plum; c.fillRect(OP.x, OP.y, OP.w, OP.h);
    flat(c, g => { g.beginPath(); g.moveTo(OPR + 20, OP.y + 60); g.lineTo(OPR + 20, OP.y + 320); g.lineTo(OP.x + 500, OPB + 20); g.lineTo(OP.x + 200, OPB + 20); g.closePath(); }, C.nightDeep);
    c.strokeStyle = rgba(C.pink, .8); c.lineWidth = 3;
    for (const [a, b, d, e] of [[OP.x + 60, OP.y + 120, OP.x + 360, OP.y + 120], [OP.x + 60, OP.y + 120, OP.x + 60, OP.y + 300], [OPR - 80, OPB - 60, OPR - 380, OPB - 60]] as const) { c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); }
    vtext(c, '節拍', 1400, 350, 120, C.ivory, 'rgba(204,82,139,.6)');
    vtext(c, '陪伴著你', 1270, 366, 46, C.pink);
    numeral(c, '03', 1250, 840, C.pink, 'rgba(248,163,200,.15)', 'FIND YOUR RHYTHM', C.pink);
  }
}

// ---------------------------------------------------------------- the puppet faces
/** Puppet bitmaps share one frame: source pixels + PAD on every side, stored at PS of source size. */
export const PAD = 70, PS = .62;
export interface Puppet { front: ImageBitmap; back: ImageBitmap; shadow: ImageBitmap; edge: ImageBitmap }
function silhouette(img: ImageBitmap, col: string) {
  const cv = new OffscreenCanvas(img.width, img.height), c = cv.getContext('2d')!;
  c.drawImage(img, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = col; c.fillRect(0, 0, img.width, img.height); return cv;
}
function puppetFace(img: ImageBitmap, face: 'front' | 'back' | 'shadow') {
  const w = img.width + PAD * 2, h = img.height + PAD * 2, cv = new OffscreenCanvas(Math.ceil(w * PS), Math.ceil(h * PS)), c = cv.getContext('2d')!;
  c.scale(PS, PS);
  if (face === 'shadow') {   // the shadow cast on the washi screen: soft, flat plum
    c.filter = 'blur(7px)'; c.drawImage(silhouette(img, '#2A0E2C'), PAD, PAD); return cv.transferToImageBitmap();
  }
  const edgeCol = face === 'front' ? '#FFF9F0' : '#F3E8F7', sil = silhouette(img, edgeCol), border = 16;
  // contact shadow on whatever is behind (the backdrop or the night flat)
  c.save(); c.filter = 'blur(20px)'; c.globalAlpha = .42; c.drawImage(silhouette(img, '#12041A'), PAD + 22, PAD + 30); c.restore();
  for (let i = 0; i < 32; i++) { const a = i / 32 * TAU; c.drawImage(sil, PAD + Math.cos(a) * border, PAD + Math.sin(a) * border); }
  if (face === 'front') c.drawImage(img, PAD, PAD);
  else {
    // the moon side: her own picture printed in moonlight lavender (a duotone), so she reads in close-ups
    const b = new OffscreenCanvas(img.width, img.height), bc = b.getContext('2d')!;
    bc.filter = 'grayscale(1) contrast(.9) brightness(1.08)'; bc.drawImage(img, 0, 0); bc.filter = 'none';
    bc.globalCompositeOperation = 'multiply'; bc.fillStyle = '#B9A2E6'; bc.fillRect(0, 0, img.width, img.height);
    bc.globalCompositeOperation = 'screen'; bc.fillStyle = 'rgba(60,30,90,.35)'; bc.fillRect(0, 0, img.width, img.height);
    bc.globalCompositeOperation = 'destination-in'; bc.drawImage(img, 0, 0);
    c.drawImage(b, PAD, PAD);
  }
  return cv.transferToImageBitmap();
}
/** The thin card edge seen mid-flip. */
function puppetEdge(img: ImageBitmap) {
  const h = img.height + PAD * 2, cv = new OffscreenCanvas(Math.ceil(40 * PS), Math.ceil(h * PS)), c = cv.getContext('2d')!;
  c.scale(PS, PS); c.fillStyle = '#EFE2EC'; c.fillRect(8, PAD + 60, 24, img.height - 120); c.fillStyle = 'rgba(48,18,46,.25)'; c.fillRect(24, PAD + 60, 8, img.height - 120);
  return cv.transferToImageBitmap();
}

// ---------------------------------------------------------------- the kit
export interface Petal { x: number; y: number; vy: number; vx: number; s: number; spin: number; ph: number; col: number }
export interface Star { x: number; y: number; r: number; gold: boolean; ph: number }
export interface Kit {
  char: ImageBitmap; portraits: ImageBitmap; stage: ImageBitmap;
  back: Sprite; front: Sprite; glow: Sprite; lanternGlow: Sprite; headerLit: Sprite;
  dusk: Sprite; hills: Sprite; night: Sprite; tri: Sprite; block: Sprite; cloudL: Sprite; cloudR: Sprite;
  screen: Sprite; screenPink: Sprite; screenLav: Sprite; roller: Sprite;
  backdrop: Sprite; fields: Sprite[]; banner: Sprite; card1: Sprite; card2: Sprite; tags: Sprite[];
  moon: Sprite; disc: Sprite; bulb: Sprite; flower: Sprite; plaque: Sprite; ribbon: Sprite; star: Sprite; starPale: Sprite;
  puppet: Puppet; grain: ImageBitmap; petals: Petal[]; stars: Star[];
}
export const TAG_WORDS = ['A', 'BRIGHTER', 'NIGHT', 'WITH', 'YOU'];
/** Rabbit-head plaque outline, local coordinates (scaled .8 when hung). */
export const plaqueHead = (g: G | OG) => { g.beginPath(); g.ellipse(-52, -105, 26, 66, -.2, 0, TAU); g.ellipse(52, -105, 26, 66, .2, 0, TAU); g.ellipse(0, 0, 120, 92, 0, 0, TAU); };

export async function prepare(ctx: SetupContext): Promise<Kit> {
  const doc = (globalThis as { document?: Document }).document;
  if (doc?.fonts) await Promise.all([`700 40px ${SERIF}`, `400 40px ${DIDOT}`, `600 40px ${LAT}`].map(f => doc.fonts.load(f, '登場01A')));
  const [char, portraits, stage] = await Promise.all(['assets/character.webp', 'assets/portrait-turnaround.png', 'assets/end-stage.png'].map(p => ctx.loadImage(p)));

  const all = (draw: (c: OG) => void) => bake(-60, -40, W + 120, H + 80, draw, 1.25);
  { // paper fibre for the cardstock pieces (soft-light): mid-grey noise with light fibres
    const fc = new OffscreenCanvas(320, 320), f = fc.getContext('2d')!, id = f.createImageData(320, 320);
    for (let i = 0; i < 320 * 320; i++) { const v = 118 + Math.round(ctx.random() * 20); id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
    f.putImageData(id, 0, 0); f.strokeStyle = 'rgba(255,255,255,.35)'; f.lineWidth = .8;
    for (let i = 0; i < 220; i++) { const x = ctx.random() * 320, y = ctx.random() * 320; f.beginPath(); f.moveTo(x, y); f.bezierCurveTo(x + 8, y + 5, x + 18, y - 5, x + 26 + ctx.random() * 20, y + ctx.random() * 6); f.stroke(); }
    FIBRE = new OffscreenCanvas(1, 1).getContext('2d')!.createPattern(fc, 'repeat');
  }
  const inOp = (draw: (c: OG) => void, pad = 60) => bake(OP.x - pad, OP.y - pad, OP.w + pad * 2, OP.h + pad * 2, draw);
  const at0 = (r: number, draw: (c: OG) => void, s = SS) => bake(-r, -r, r * 2, r * 2, draw, s);

  const back = all(c => { room(c); proscenium(c); });
  const front = bake(OP.x - 140, OP.y - 40, OP.w + 280, 800, c => { valance(c); apron(c); });
  const glow = bake(OP.x - 70, OPB - 260, OP.w + 140, 330, footGlow, 1);
  const lanternGlow = bake(-110, -110, 220, 220, c => { const l = c.createRadialGradient(0, 0, 4, 0, 0, 110); l.addColorStop(0, 'rgba(255,180,200,.45)'); l.addColorStop(1, 'rgba(255,180,200,0)'); c.fillStyle = l; c.fillRect(-110, -110, 220, 220); }, .5);
  const headerLit = bake(PLATE.x - 20, PLATE.y - 20, PLATE.w + 40, PLATE.h + 40, c => header(c, C.yellow, true));

  const tags = TAG_WORDS.map(w => at0(130, c => {
    c.font = `600 26px ${LAT}`; const tw = tracked(c, w, 0, -999, 4) + 46;
    flat(c, g => rr(g, -tw / 2, 0, tw, 48, 5), C.ivory, { k: .6 }); c.fillStyle = C.plum; c.textBaseline = 'middle'; tracked(c, w, 0, 25, 4, 'center');
  }));
  const hangCard = (text: string, size: number) => {
    const n = [...text].length, w = size * 1.5, h = n * size * 1.08 + size * .6;
    return bake(-w, -20, w * 2, h + 60, c => { flat(c, g => rr(g, -w / 2, 0, w, h, 6), C.ivory, { k: .8 }); vtext(c, text, 0, size * .3, size, C.plum); });
  };
  const disc = at0(320, c => { c.save(); shade(c, 1.3, .45); c.fillStyle = C.ivory; c.beginPath(); c.arc(0, 0, 286, 0, TAU); c.fill(); c.restore(); });
  const moon = at0(140, c => flat(c, g => { g.beginPath(); g.arc(0, 0, 100, 0, TAU); }, C.yellow, { k: .9, edge: '#FFF2C8', lw: 5 }));
  const flower = at0(90, c => { c.save(); shade(c, .9, .4); c.fillStyle = C.pink; sakuraPath(c, 60); c.fill(); c.restore(); c.fillStyle = C.yellow; c.beginPath(); c.arc(0, 0, 10, 0, TAU); c.fill();
    c.strokeStyle = rgba(C.rose, .45); c.lineWidth = 2; for (let i = 0; i < 5; i++) { const a = i * TAU / 5 - Math.PI / 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 40, Math.sin(a) * 40); c.stroke(); } });
  const plaque = bake(-160, -200, 320, 320, c => flat(c, plaqueHead, C.plum));
  const ribbon = bake(-380, -60, 760, 130, c => {
    flat(c, g => { g.beginPath(); g.moveTo(-300, -34); g.lineTo(300, -34); g.lineTo(340, 0); g.lineTo(300, 34); g.lineTo(-300, 34); g.lineTo(-340, 0); g.closePath(); }, C.ivory);
    c.font = `700 40px ${SERIF}`; c.fillStyle = C.rose; c.textBaseline = 'middle'; tracked(c, '今晚，陪伴著你', 0, 2, 10, 'center');
  });
  const banner = bake(-110, -30, 220, 560, c => {
    flat(c, g => { g.beginPath(); g.moveTo(-70, 0); g.lineTo(70, 0); g.lineTo(70, 430); g.lineTo(0, 470); g.lineTo(-70, 430); g.closePath(); }, C.ivory);
    vtext(c, '月亮偶像', 0, 22, 92, C.plum, 'rgba(204,82,139,.35)');
  });
  const star = at0(30, c => star4(c, 0, 0, 22, C.gold)), starPale = at0(30, c => star4(c, 0, 0, 22, C.yellow));
  const bw = stage.width * BACKDROP_K, bh = stage.height * BACKDROP_K, bx = OP.x + (OP.w - bw) / 2, by = PAINTED_MOON.y - STAGE_MOON.y * BACKDROP_K;
  const backdrop = bake(bx - 40, by - 40, bw + 100, bh + 110, c => { c.save(); shade(c, 1.4, .55); c.drawImage(stage, bx, by, bw, bh); c.restore(); }, 1.15);

  const grainCv = new OffscreenCanvas(256, 256), gc = grainCv.getContext('2d')!, img = gc.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) { const v = 200 + Math.round(ctx.random() * 55); img.data[i * 4] = v; img.data[i * 4 + 1] = v - 4; img.data[i * 4 + 2] = v - 10; img.data[i * 4 + 3] = 255; }
  gc.putImageData(img, 0, 0);

  const petals: Petal[] = Array.from({ length: 34 }, () => ({
    x: ctx.random(), y: ctx.random(), vy: 70 + ctx.random() * 60, vx: -20 - ctx.random() * 30, s: .7 + ctx.random() * .8,
    spin: .8 + ctx.random() * 1.6, ph: ctx.random() * TAU, col: Math.floor(ctx.random() * 4),
  }));
  const stars: Star[] = Array.from({ length: 16 }, (_, i) => ({
    x: OP.x + 60 + ((i + ctx.random() * .8) / 16) * (OP.w - 120), y: OP.y + 120 + ctx.random() * 230, r: .55 + ctx.random() * .6, gold: ctx.random() < .7, ph: ctx.random() * TAU,
  }));

  return {
    char, portraits, stage, back, front, glow, lanternGlow, headerLit,
    dusk: bake(OP.x, OP.y, OP.w, OP.h, dusk, 1), hills: bake(OP.x - 20, OP.y + 260, OP.w + 60, OP.h - 220, hills, 1), night: bake(OP.x, OP.y, OP.w, OP.h, night, 1),
    tri: bake(OP.x - 20, OP.y - 20, 600, 500, c => flat(c, TRI_PATH, C.lav, { k: 1.2 }), 1), block: bake(OPR - 400, OP.y + 100, 460, FLOOR - OP.y - 10, c => flat(c, BLOCK_PATH, C.pink, { k: 1.2 }), 1),
    cloudL: bake(400, FLOOR - 140, 360, 170, c => cloud(c, 560, FLOOR - 30, 1), 1), cloudR: bake(1200, FLOOR - 100, 300, 130, c => cloud(c, 1330, FLOOR - 10, .8), 1),
    screen: bake(OP.x, OP.y, OP.w, OP.h, c => screen(c, null), 1), screenPink: bake(OP.x, OP.y, OP.w, OP.h, c => screen(c, 'pink'), 1), screenLav: bake(OP.x, OP.y, OP.w, OP.h, c => screen(c, 'lav'), 1),
    roller: bake(OP.x - 10, -40, OP.w + 20, 90, roller),
    backdrop, fields: [0, 1, 2].map(i => inOp(c => field(c, i))), banner,
    bulb: at0(24, c => { const g = c.createRadialGradient(0, 0, 0, 0, 0, 24); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(.27, 'rgba(255,228,155,1)'); g.addColorStop(.32, 'rgba(255,228,155,.55)'); g.addColorStop(1, 'rgba(255,228,155,0)'); c.fillStyle = g; c.fillRect(-24, -24, 48, 48); }),
    card1: hangCard('今晚，', 74), card2: hangCard('陪伴著你', 64), tags, moon, disc, flower, plaque, ribbon, star, starPale,
    puppet: { front: puppetFace(char, 'front'), back: puppetFace(char, 'back'), shadow: puppetFace(char, 'shadow'), edge: puppetEdge(char) },
    grain: grainCv.transferToImageBitmap(), petals, stars,
  };
}
