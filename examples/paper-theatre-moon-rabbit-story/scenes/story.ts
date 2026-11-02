// 來自月亮的偶像 — the story's new paper pieces. Each draws from explicit amounts (0–1), so the storyboard and the
// film share them: the moon rabbit's mortar and mallet, the paper town, the shadow-show descent with a parasol,
// the empty hall's seats and riser, the audience with penlights, paper notes and the two-column story cards.
import { C, FLOOR, OP, OPB, OPR, SERIF, TAU, bake, put, rgba, vtext, type G, type Kit, type OG, type Sprite } from './lib.js';

/** The little riser the rabbit sings on in the empty hall, and the seat rows in front of it. */
export const RISER = { y: 742, h: 46 };
export const SEATS = { back: 796, front: 834, w: 66, gap: 10 };

// ---------------------------------------------------------------- story cards
/** A two-column vertical card hung on two strings; the right column is read first. A red seal sits bottom left. */
export function storyCard(c: G, lines: readonly [string, string], x: number, y: number, size: number, o: { rot?: number; alpha?: number } = {}) {
  const n = Math.max(...lines.map(l => [...l].length)), col = size * 1.32, w = col * 2 + size * .8, h = n * size * 1.08 + size * 1.1;
  c.save(); c.globalAlpha = o.alpha ?? 1;
  c.strokeStyle = 'rgba(255,247,235,.7)'; c.lineWidth = 1.6;
  for (const sx of [-.32, .32]) { c.beginPath(); c.moveTo(x + sx * w, OP.y - 30); c.lineTo(x + sx * w, y + 8); c.stroke(); }
  c.translate(x, y); c.rotate(o.rot ?? 0);
  c.save(); c.shadowColor = 'rgba(18,4,20,.4)'; c.shadowBlur = 16; c.shadowOffsetX = 6; c.shadowOffsetY = 10;
  c.fillStyle = C.ivory; c.beginPath(); c.roundRect(-w / 2, 0, w, h, 6); c.fill(); c.restore();
  c.strokeStyle = rgba(C.gold, .9); c.lineWidth = 1.5; c.beginPath(); c.roundRect(-w / 2 + 8, 8, w - 16, h - 16, 4); c.stroke();
  c.strokeStyle = rgba(C.rose, .25); c.lineWidth = 1; c.beginPath(); c.moveTo(0, size * .5); c.lineTo(0, h - size * .5); c.stroke();
  vtext(c, lines[0], col / 2, size * .55, size, C.plum);
  vtext(c, lines[1], -col / 2, size * .55, size, C.plum);
  // seal
  c.fillStyle = C.rose; c.beginPath(); c.roundRect(-w / 2 + 14, h - 50, 34, 34, 4); c.fill();
  c.fillStyle = C.ivory; c.font = `700 22px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('月', -w / 2 + 31, h - 32);
  for (const sx of [-.32, .32]) { c.fillStyle = C.gold; c.beginPath(); c.arc(sx * w, 9, 5, 0, TAU); c.fill(); }
  c.restore();
  return { w, h };
}

// ---------------------------------------------------------------- the moon and the rabbit's mochi
/** A paper moon with soft craters (the promo's moon sprite plus crater card pieces). */
export function paperMoon(c: G, k: Kit, x: number, y: number, r: number) {
  const z = r / 100; c.drawImage(k.moon.img, x + k.moon.x * z, y + k.moon.y * z, k.moon.w * z, k.moon.h * z);
  c.fillStyle = 'rgba(214,160,70,.25)';
  for (const [dx, dy, rr] of [[-.35, -.2, .2], [.3, .25, .14], [.1, -.45, .1], [-.15, .4, .12], [.45, -.1, .08]] as const) { c.beginPath(); c.arc(x + dx * r, y + dy * r, rr * r, 0, TAU); c.fill(); }
}
/** Mortar and mallet beside the rabbit; `swing` 0 = mallet raised, 1 = down in the mortar. */
export function mochi(c: G, x: number, y: number, s: number, swing: number) {
  c.save(); c.translate(x, y); c.scale(s, s);
  // mortar
  c.fillStyle = '#8A5A44'; c.beginPath(); c.moveTo(-34, -40); c.lineTo(34, -40); c.lineTo(26, 0); c.lineTo(-26, 0); c.closePath(); c.fill();
  c.fillStyle = '#6E4634'; c.fillRect(-36, -46, 72, 9); c.fillStyle = C.ivory; c.beginPath(); c.ellipse(0, -46, 26, 9, 0, Math.PI, 0); c.fill();
  // mallet pivoting at the rabbit's hand (left of the mortar)
  c.translate(-46, -78); c.rotate(-.9 + swing * 1.05);
  c.fillStyle = '#B8865E'; c.fillRect(-3, -4, 64, 7);
  c.fillStyle = '#8A5A44'; c.beginPath(); c.roundRect(52, -14, 26, 28, 6); c.fill();
  c.restore();
}

// ---------------------------------------------------------------- the town
interface House { x: number; w: number; h: number; kind: 'gable' | 'pagoda' | 'gate' | 'tower'; row: 0 | 1; windows: [number, number][] }
/** Fixed layout, so the order the windows light in never changes. */
export const TOWN: House[] = (() => {
  const out: House[] = [], back = [
    [OP.x + 20, 150, 210, 'gable'], [OP.x + 175, 120, 300, 'pagoda'], [OP.x + 300, 170, 190, 'gable'], [OP.x + 470, 130, 250, 'tower'],
    [OP.x + 610, 190, 170, 'gable'], [OP.x + 800, 150, 230, 'gable'], [OP.x + 960, 140, 280, 'pagoda'], [OP.x + 1100, 160, 200, 'gable'],
  ] as const, front = [
    [OP.x - 10, 210, 130, 'gable'], [OP.x + 210, 260, 150, 'gate'], [OP.x + 480, 200, 120, 'gable'], [OP.x + 690, 230, 140, 'gable'],
    [OP.x + 930, 250, 150, 'gate'], [OP.x + 1150, 140, 120, 'gable'],
  ] as const;
  let seed = 7; const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (const [row, list] of [[0, back], [1, front]] as const) for (const [x, w, h, kind] of list) {
    const windows: [number, number][] = [];
    const cols = Math.max(1, Math.floor(w / 46)), rows = Math.max(1, Math.floor((h - 70) / 52));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (kind !== 'gate' && r() < .75) windows.push([x + w * (i + 1) / (cols + 1), j]);
    out.push({ x, w, h, kind, row, windows });
  }
  return out;
})();
const WINDOW_ORDER = (() => { const all: [number, number][] = []; TOWN.forEach((h, i) => h.windows.forEach((_, j) => all.push([i, j]))); let s = 3; return all.map(v => ({ v, k: (s = (s * 9301 + 49297) % 233280) })).sort((a, b) => a.k - b.k).map(o => o.v); })();
export const WINDOW_COUNT = WINDOW_ORDER.length;
const ROW_BASE = [OPB + 30 - 70, OPB + 30] as const;
/** One row of houses with unlit windows, at its risen position (baked once). */
function townRow(c: G | OG, row: 0 | 1) {
  const base = ROW_BASE[row], col = row ? '#3A1A4A' : '#5B3478';
  for (const h of TOWN) {
    if (h.row !== row) continue;
    const top = base - h.h, x = h.x, w = h.w;
    c.save(); c.shadowColor = 'rgba(10,2,14,.45)'; c.shadowBlur = 14 * 1.25; c.shadowOffsetX = 5 * 1.25; c.shadowOffsetY = 8 * 1.25; c.fillStyle = col; c.beginPath();
    if (h.kind === 'gable') { c.moveTo(x, base); c.lineTo(x, top + 40); c.lineTo(x + w / 2, top); c.lineTo(x + w, top + 40); c.lineTo(x + w, base); }
    else if (h.kind === 'tower') { c.rect(x + 10, top + 30, w - 20, h.h - 30); c.moveTo(x, top + 34); c.lineTo(x + w / 2, top - 10); c.lineTo(x + w, top + 34); }
    else if (h.kind === 'pagoda') { for (let t = 0; t < 3; t++) { const ty = top + t * h.h / 3, ins = (2 - t) * 14; c.moveTo(x + ins - 16, ty + 30); c.quadraticCurveTo(x + w / 2, ty - 6, x + w - ins + 16, ty + 30); c.lineTo(x + w - ins, ty + 30); c.lineTo(x + w - ins, ty + h.h / 3 + 2); c.lineTo(x + ins, ty + h.h / 3 + 2); c.lineTo(x + ins, ty + 30); c.closePath(); } c.rect(x + 20, top + 2 * h.h / 3, w - 40, h.h / 3); }
    else { c.rect(x, top + 20, w, h.h - 20); }
    c.fill(); c.restore();
    if (h.kind === 'gate') { c.fillStyle = row ? '#1F0A22' : '#2A1036'; c.beginPath(); c.arc(x + w / 2, base - 70, 58, 0, TAU); c.fill(); c.fillStyle = col; c.fillRect(x + w / 2 - 70, base - 12, 140, 14); }
    for (const [wx, j] of h.windows) { c.fillStyle = row ? '#2A1036' : '#43245C'; c.beginPath(); c.roundRect(wx - 10, base - 66 - j * 52, 20, 26, [10, 10, 2, 2]); c.fill(); }
  }
}
/** Window positions at the risen town, in the order they light. */
const WINDOWS = WINDOW_ORDER.map(([i, j]) => { const h = TOWN[i]!, [wx, wj] = h.windows[j]!; return { x: wx, y: ROW_BASE[h.row] - 66 - wj * 52, row: h.row }; });
const RISE = [360, 300] as const;
/** The town ground rows rising from the trap (`rise` 0–1), with the first `lit` windows glowing warm. */
export function town(c: G, sk: StoryKit, rise: number, lit: number) {
  if (rise <= 0) return;
  for (const row of [0, 1] as const) {
    const dy = (1 - rise) * RISE[row];
    put(c, sk.town[row]!, 0, dy);
    WINDOWS.forEach((w, i) => {
      if (w.row !== row || i >= lit) return;
      const y = w.y + dy;
      put(c, sk.windowGlow, w.x, y + 13);
      c.fillStyle = C.yellow; c.beginPath(); c.roundRect(w.x - 10, y, 20, 26, [10, 10, 2, 2]); c.fill();
      c.fillStyle = 'rgba(110,70,52,.6)'; c.fillRect(w.x - .8, y + 4, 1.6, 22); c.fillRect(w.x - 10, y + 14, 20, 1.6);
    });
  }
}

// ---------------------------------------------------------------- the descent (shadow show)
/** A paper parasol: scalloped canopy with ribs and a handle; `ink` for its shadow. */
export function parasol(c: G, x: number, y: number, r: number, rot: number, ink?: string) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = ink ?? C.rose; c.beginPath(); c.moveTo(-r, 0);
  for (let i = 0; i < 6; i++) { const a0 = -r + i * r / 3, a1 = a0 + r / 3; c.quadraticCurveTo((a0 + a1) / 2, -8, a1, 0); }
  c.lineTo(r, 0); c.arc(0, 0, r, 0, Math.PI, true); c.closePath(); c.fill();
  if (!ink) { c.strokeStyle = rgba(C.ivory, .7); c.lineWidth = 2; for (let i = 1; i < 6; i++) { const a = Math.PI + i * Math.PI / 6; c.beginPath(); c.moveTo(0, -r * .02); c.lineTo(Math.cos(a) * r, Math.sin(a) * r * .98); c.stroke(); } }
  c.strokeStyle = ink ?? '#6E4634'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -r); c.lineTo(0, r * 1.05); c.arc(-9, r * 1.05, 9, 0, Math.PI); c.stroke();
  c.restore();
}
/** Back-lit screen in moon blue: a bright disc, the moonbeam to the lower left, cloud shadows, and her shadow under the parasol. */
export const LANDING = { x: OP.x + 450, y: 744 };
export function descent(c: G, k: Kit, u: number, clouds: number, lit = 1, fold = 0) {
  put(c, k.screenLav); c.save();
  c.globalCompositeOperation = 'multiply'; c.fillStyle = '#B8C8F2'; c.fillRect(OP.x, OP.y, OP.w, OP.h); c.globalCompositeOperation = 'source-over';
  const M = { x: OPR - 230, y: OP.y + 170, r: 92 };
  // moonbeam: a pale band from the disc to the lower left
  const g = c.createLinearGradient(M.x, M.y, OP.x + 160, OPB); g.addColorStop(0, 'rgba(255,255,240,.65)'); g.addColorStop(1, 'rgba(255,255,240,.12)');
  c.fillStyle = g; c.beginPath(); c.moveTo(M.x - 70, M.y + 40); c.lineTo(M.x + 40, M.y + 70); c.lineTo(LANDING.x + 170, OPB); c.lineTo(LANDING.x - 150, OPB); c.closePath(); c.fill();
  const halo = c.createRadialGradient(M.x, M.y, M.r * .8, M.x, M.y, M.r * 2.4); halo.addColorStop(0, 'rgba(255,255,235,.6)'); halo.addColorStop(1, 'rgba(255,255,235,0)');
  c.fillStyle = halo; c.fillRect(M.x - M.r * 2.4, M.y - M.r * 2.4, M.r * 4.8, M.r * 4.8);
  c.fillStyle = '#FFFDF2'; c.beginPath(); c.arc(M.x, M.y, M.r, 0, TAU); c.fill();
  // cloud shadows drifting the other way
  c.globalCompositeOperation = 'multiply';
  for (const [i, [cx, cy, s]] of ([[OP.x + 300, OP.y + 210, 1], [OP.x + 880, OP.y + 420, .8]] as const).entries()) {
    const x = cx + (i ? -1 : 1) * clouds * 260; c.fillStyle = 'rgba(70,60,110,.55)';
    c.beginPath(); c.arc(x, cy, 60 * s, Math.PI, 0); c.arc(x + 80 * s, cy, 44 * s, Math.PI, 0); c.arc(x - 78 * s, cy, 40 * s, Math.PI, 0); c.closePath(); c.fill();
  }
  // her shadow down the beam
  const fx = M.x - 120 + (LANDING.x - (M.x - 120)) * u, fy = M.y + 220 + (LANDING.y - (M.y + 220)) * u, rot = (-.12 + Math.sin(u * 9) * .06) * (1 - u * u);
  c.globalAlpha = .9 * lit; const hgt = 250, s = hgt / 1526, cw = k.char.width, ch = k.char.height;
  c.save(); c.translate(fx, fy); c.rotate(rot); c.drawImage(k.puppet.shadow, -(493 + 70) * s, -(1526 + 70) * s, (cw + 140) * s, (ch + 140) * s);
  if (fold < 1) { c.save(); c.translate(40, -hgt - 40); c.scale(1 - fold, 1); parasol(c, 0, 0, 88, .06, 'rgba(42,14,44,.85)'); c.restore(); }
  c.restore();
  c.restore();
  return { fx, fy };
}

// ---------------------------------------------------------------- the empty hall
export function riser(c: G) {
  c.save(); c.shadowColor = 'rgba(10,2,14,.5)'; c.shadowBlur = 16; c.shadowOffsetY = 10;
  c.fillStyle = '#4A1640'; c.beginPath(); c.roundRect(OP.x + 170, RISER.y, OP.w - 340, RISER.h, 4); c.fill(); c.restore();
  c.fillStyle = C.gold; c.fillRect(OP.x + 170, RISER.y + 4, OP.w - 340, 2.5);
  c.fillStyle = '#6A2258'; c.fillRect(OP.x + 170, RISER.y - 8, OP.w - 340, 10);
}
/** A cone of light from the flies onto the riser; `a` its strength. */
export function spotlight(c: G, x: number, a: number) {
  if (a <= 0) return;
  c.save(); c.globalCompositeOperation = 'screen';
  const g = c.createLinearGradient(0, OP.y, 0, RISER.y); g.addColorStop(0, `rgba(255,236,200,${.05 * a})`); g.addColorStop(1, `rgba(255,236,200,${.32 * a})`);
  c.fillStyle = g; c.beginPath(); c.moveTo(x - 60, OP.y); c.lineTo(x + 60, OP.y); c.lineTo(x + 230, RISER.y); c.lineTo(x - 230, RISER.y); c.closePath(); c.fill();
  const p = c.createRadialGradient(x, RISER.y, 10, x, RISER.y, 240); p.addColorStop(0, `rgba(255,236,200,${.5 * a})`); p.addColorStop(1, 'rgba(255,236,200,0)');
  c.save(); c.translate(x, RISER.y); c.scale(1, .22); c.fillStyle = p; c.fillRect(-240, -240, 480, 480); c.restore();
  c.restore();
}
const SEAT_X = (() => { const out: number[] = []; for (let x = OP.x + 40; x < OPR - 30; x += SEATS.w + SEATS.gap) out.push(x); return out; })();
/** Order the audience arrives in: a scatter, so the hall fills unevenly. */
const ARRIVAL = (() => { const all: [number, number][] = []; for (const r of [0, 1]) SEAT_X.forEach((_, i) => all.push([r, i])); let s = 11; return all.map(v => ({ v, k: (s = (s * 9301 + 49297) % 233280) })).sort((a, b) => a.k - b.k).map(o => o.v); })();
const ORDER_OF = new Map(ARRIVAL.map(([r, i], n) => [r * 100 + i, n]));
export const AUDIENCE = ARRIVAL.length;
const LIGHTS = ['#FF9EC8', '#FFE49B', '#C9B0FF', '#9FF0E0'];
const POP = [.3, .8, 1.15, 1];
function seatRow(c: G | OG, r: 0 | 1) {
  const top = r ? SEATS.front : SEATS.back, off = r ? (SEATS.w + SEATS.gap) / 2 : 0;
  for (const sx of SEAT_X) {
    const x = sx + off;
    c.save(); c.shadowColor = 'rgba(10,2,14,.5)'; c.shadowBlur = 10 * 1.25; c.shadowOffsetY = 6 * 1.25;
    c.fillStyle = r ? '#5C1D4E' : '#4A1640'; c.beginPath(); c.roundRect(x, top, SEATS.w, 70, [14, 14, 3, 3]); c.fill(); c.restore();
    c.fillStyle = rgba(C.gold, .85); c.beginPath(); c.roundRect(x + SEATS.w / 2 - 9, top + 10, 18, 11, 2); c.fill();
  }
}
/**
 * The hall's ground row: seats, and the audience in arrival order. `age(n)` is the seconds since member n arrived
 * (negative = not yet); they pop up over three poses with their penlight. `glow` 0–1 is how bright the penlights
 * are, `sway` their angle, `dy` lowers the whole row (it sinks into the trap between scenes).
 */
export function hall(c: G, sk: StoryKit, age: (n: number) => number, sway: number, glow: number, dy = 0) {
  c.save(); c.translate(0, dy);
  for (const r of [0, 1] as const) {
    const top = r ? SEATS.front : SEATS.back, off = r ? (SEATS.w + SEATS.gap) / 2 : 0;
    SEAT_X.forEach((sx, i) => {
      const a = age(ORDER_OF.get(r * 100 + i)!); if (a < 0) return;
      const z = POP[Math.min(3, Math.floor(a * 12 + 1e-6))]!, x = sx + off, hx = x + SEATS.w / 2, hy = top - 18;
      c.save(); c.translate(hx, top + 10); c.scale(z, z); c.translate(-hx, -(top + 10));
      if ((i + r) % 3 === 0) { c.fillStyle = '#1B0919'; for (const e of [-1, 1]) { c.beginPath(); c.ellipse(hx + e * 9, hy - 26, 5, 14, e * .25, 0, TAU); c.fill(); } }
      const ang = sway * ((i + r) % 2 ? 1 : -1), ci = (i * 3 + r) % 4, lx = hx + ((i % 2) ? 22 : -22), ly = hy + 10;
      c.save(); c.translate(lx, ly); c.rotate(ang);
      put(c, sk.glows[ci]!, 0, -48, .35 + .65 * glow);
      c.fillStyle = LIGHTS[ci]!; c.beginPath(); c.roundRect(-3.5, -60, 7, 46, 3); c.fill(); c.fillStyle = '#2A1028'; c.fillRect(-4, -14, 8, 16); c.restore();
      c.fillStyle = '#1B0919'; c.beginPath(); c.arc(hx, hy, 15, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(hx, hy + 30, 26, 18, 0, Math.PI, 0); c.fill();
      // rim light from the stage, so the silhouettes read against the seats
      c.strokeStyle = 'rgba(214,190,255,.45)'; c.lineWidth = 2; c.beginPath(); c.arc(hx, hy, 15, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
      c.beginPath(); c.ellipse(hx, hy + 30, 26, 18, 0, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      c.restore();
    });
    put(c, sk.seats[r]!);
  }
  c.restore();
}
/** The riser and its seat rows, plus the town, window glow and penlight glows, baked once. */
export interface StoryKit { town: Sprite[]; windowGlow: Sprite; seats: Sprite[]; glows: Sprite[] }
export function prepareStory(): StoryKit {
  const glowSprite = (col: string, r: number) => bake(-r, -r, r * 2, r * 2, c => { const g = c.createRadialGradient(0, 0, 1, 0, 0, r); g.addColorStop(0, rgba(col, .7)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.fillRect(-r, -r, r * 2, r * 2); }, .6);
  return {
    town: ([0, 1] as const).map(r => bake(OP.x - 40, OP.y + 100, OP.w + 80, OPB - OP.y - 40, c => townRow(c, r))),
    windowGlow: bake(-40, -40, 80, 80, c => { const g = c.createRadialGradient(0, 0, 2, 0, 0, 40); g.addColorStop(0, 'rgba(255,214,140,.55)'); g.addColorStop(1, 'rgba(255,214,140,0)'); c.fillStyle = g; c.fillRect(-40, -40, 80, 80); }, .6),
    seats: ([0, 1] as const).map(r => bake(OP.x, SEATS.back - 10, OP.w, 140, c => seatRow(c, r))),
    glows: LIGHTS.map(col => glowSprite(col, 34)),
  };
}
/** A paper music note on a thread, rising from (x, y). */
export function note(c: G, x: number, y: number, s: number, rot: number, col: string) {
  c.strokeStyle = 'rgba(255,247,235,.45)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, OP.y - 30); c.lineTo(x, y - 40 * s); c.stroke();
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  c.shadowColor = 'rgba(18,4,20,.35)'; c.shadowBlur = 8; c.shadowOffsetX = 3; c.shadowOffsetY = 5;
  c.fillStyle = col; c.beginPath(); c.ellipse(-8, 20, 13, 10, -.4, 0, TAU); c.fill();
  c.fillRect(2, -30, 5, 52); c.beginPath(); c.moveTo(7, -30); c.quadraticCurveTo(30, -18, 22, 2); c.quadraticCurveTo(24, -14, 7, -18); c.fill();
  c.restore();
}
