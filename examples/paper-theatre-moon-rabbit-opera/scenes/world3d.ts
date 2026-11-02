// The 3D paper toy theatre (Three.js): built once in setup, posed from time in renderFrame.
// Flats are cut-out planes with a darker backing (paper thickness); lights fade by intensity only (never toggled),
// castShadow is fixed, and every animated property is written on every frame through resetWorld().
import type { FrameContext } from '@mografy/runtime';
import { blurLayer, bloom } from '@mografy/runtime';
import type { BuildContext, Stage, ThreeModule } from './three.js';
import { C, SERIF, LAT, TAU, W, H, cv, rng, grain, starPath, lerp, clamp, on2, type Kit, type PoseKey } from './paper.js';

type T3 = ThreeModule;
const g2 = (c: OffscreenCanvas) => c.getContext('2d')! as OffscreenCanvasRenderingContext2D;

export const LAYER_MAIN = 0, LAYER_FG = 1, LAYER_BG = 2;

export interface World {
  THREE: T3; scene: T3; camera: T3; renderer: T3;
  th: T3; room: T3; pros: T3; prosMat: T3; drapes: T3[]; backdrop: T3; backTex: Record<string, T3>;
  foot: T3[]; footLights: T3[]; lanternLights: T3[]; lanterns: T3[]; garland: T3[]; garLines: T3[];
  stars: T3[]; moon: T3; moonRabbit: T3; mallet: T3;
  city: T3[]; cityWin: T3[]; cityWinCount: number[];
  pup: T3; shadowPup: T3; screen: T3; screenTex: T3; screenCanvas: OffscreenCanvas; fibre: OffscreenCanvas; lamp: T3; lampLight: T3;
  seatRows: T3[]; audience: T3[]; audLights: T3[];
  spot: T3; cone: T3; pool: T3; rim: T3; dust: T3;
  notes: T3[]; petals: T3[]; kami: T3; kamiCards: T3[];
  waves: T3; clouds: T3; winLight: T3;
  hemi: T3; moonKey: T3; warm: T3;
  blurList: T3[]; bulbs: T3[];
  houseBulbMat: T3; houseGlow: T3[]; houseFac: T3[]; houseFans: T3[]; chLight: T3; chBeadMat: T3; train: T3; viaduct: T3; moonHalo: T3; aisleMat: T3;
  texc: Record<string, { tex: T3; depth: T3; aspect: number }>;
  kit: Kit;
}

// ---------------------------------------------------------------- textures (canvases baked in setup)
function prosTextures() {
  const c = cv(2400, 1640), g = g2(c), e = cv(2400, 1640), ge = g2(e);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, 2400, 1640);
  const OPx = 400, OPy = 480, OPw = 1600, OPh = 960;
  const crown = (inset: number) => {
    g.beginPath();
    g.moveTo(40 + inset, 1640); g.lineTo(40 + inset, 330 + inset);
    g.lineTo(720 + inset * .4, 330 + inset); g.quadraticCurveTo(820, 330 + inset, 860 + inset * .3, 230 + inset);
    g.bezierCurveTo(950, 30 + inset, 1450, 30 + inset, 1540 - inset * .3, 230 + inset);
    g.quadraticCurveTo(1580, 330 + inset, 1680 - inset * .4, 330 + inset);
    g.lineTo(2360 - inset, 330 + inset); g.lineTo(2360 - inset, 1640); g.closePath();
  };
  g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 30; crown(0); g.fillStyle = C.plum; g.fill(); g.restore();
  crown(26); g.fillStyle = '#E58FB6'; g.fill();
  crown(40); g.fillStyle = C.pink; g.fill();
  crown(58); g.strokeStyle = C.gold; g.lineWidth = 6; g.stroke();
  g.setLineDash([2, 14]); g.lineCap = 'round'; crown(74); g.strokeStyle = C.ivory; g.lineWidth = 5; g.stroke(); g.setLineDash([]);
  const rr = (x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.arcTo(x, y, x + r, y, r); g.closePath(); };
  rr(OPx - 70, OPy - 70, OPw + 140, OPh + 70, 120); g.fillStyle = C.rose; g.fill();
  rr(OPx - 44, OPy - 44, OPw + 88, OPh + 44, 100); g.strokeStyle = C.gold; g.lineWidth = 8; g.stroke();
  rr(OPx - 24, OPy - 24, OPw + 48, OPh + 24, 90); g.strokeStyle = '#F6C9DC'; g.lineWidth = 3; g.setLineDash([3, 12]); g.stroke(); g.setLineDash([]);
  // sakura sprigs along the inner frame
  const r = rng(91);
  for (let i = 0; i < 46; i++) {
    const side = i % 2, t = r(), x = side ? OPx + OPw + 40 : OPx - 40, y = OPy - 30 + t * (OPh - 40);
    g.save(); g.translate(x + (r() - .5) * 20, y); g.fillStyle = r() < .5 ? '#FFD3E6' : '#FFF0F6';
    for (let k = 0; k < 5; k++) { g.rotate(TAU / 5); g.beginPath(); g.ellipse(0, -9, 6, 10, 0, 0, TAU); g.fill(); }
    g.fillStyle = C.gold; g.beginPath(); g.arc(0, 0, 3.5, 0, TAU); g.fill(); g.restore();
  }
  // header plate
  g.save(); g.translate(1200, 200);
  g.fillStyle = C.plum; g.beginPath(); g.ellipse(0, 20, 330, 110, 0, 0, TAU); g.fill();
  g.strokeStyle = C.gold; g.lineWidth = 6; g.beginPath(); g.ellipse(0, 20, 310, 92, 0, 0, TAU); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.ellipse(0, 20, 296, 80, 0, 0, TAU); g.stroke();
  g.fillStyle = C.moon; g.font = `600 64px ${LAT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.letterSpacing = '10px'; g.fillText('LUNAR POP CLUB', 0, 8); g.letterSpacing = '6px';
  g.font = `700 26px ${SERIF}`; g.fillStyle = C.gold; g.fillText('月兔紙劇場 · NO.01', 0, 70); g.letterSpacing = '0px';
  g.restore();
  for (let i = 0; i < 26; i++) {
    const a = Math.PI + i / 25 * Math.PI, x = 1200 + Math.cos(a) * 390, y = 220 + Math.sin(a) * 150;
    g.fillStyle = '#9c8a70'; g.beginPath(); g.arc(x, y, 12, 0, TAU); g.fill(); g.strokeStyle = C.gold2; g.lineWidth = 3; g.stroke();
  }
  // apron skirt band
  g.fillStyle = C.plum; g.fillRect(40, 1440, 2320, 200);
  g.fillStyle = C.gold; g.fillRect(40, 1456, 2320, 6); g.fillRect(40, 1600, 2320, 6);
  for (let x = 90; x < 2360; x += 110) {
    g.save(); g.translate(x, 1530); g.fillStyle = C.pink; for (let k = 0; k < 5; k++) { g.rotate(TAU / 5); g.beginPath(); g.ellipse(0, -14, 9, 15, 0, 0, TAU); g.fill(); } g.fillStyle = C.gold; g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill(); g.restore();
    g.fillStyle = C.rose; g.beginPath(); g.moveTo(x + 55, 1510); g.lineTo(x + 70, 1530); g.lineTo(x + 55, 1550); g.lineTo(x + 40, 1530); g.fill();
  }
  grain(g, 2400, 1640, .16, 'soft-light');
  g.globalCompositeOperation = 'destination-out'; rr(OPx, OPy, OPw, OPh + 2, 80); g.fill();
  return { c, e };
}
function moonTex() {
  // a hand-painted paper moon: watercolour blooms, the rabbit pounding mochi in the maria, crater rims, gold-leaf edge
  const c = cv(1024, 1024), g = g2(c), r = rng(11);
  g.save(); g.beginPath(); g.arc(512, 512, 500, 0, TAU); g.clip();
  const gr = g.createRadialGradient(420, 400, 40, 512, 512, 520); gr.addColorStop(0, '#FFF6D6'); gr.addColorStop(.7, '#F6DC92'); gr.addColorStop(1, '#E9BF68');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 70; i++) { const x = r() * 1024, y = r() * 1024, rr = 30 + r() * 150, cg = g.createRadialGradient(x, y, 0, x, y, rr); const a = .03 + r() * .07; cg.addColorStop(0, `rgba(222,168,84,${a})`); cg.addColorStop(.8, `rgba(222,168,84,${a * .6})`); cg.addColorStop(1, 'rgba(222,168,84,0)'); g.fillStyle = cg; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  const rabbit = () => { g.beginPath(); g.ellipse(430, 600, 150, 118, -.2, 0, TAU); g.moveTo(400, 430); g.ellipse(340, 450, 82, 74, 0, 0, TAU);
    g.moveTo(310, 380); g.ellipse(290, 300, 26, 96, -.35, 0, TAU); g.moveTo(370, 380); g.ellipse(372, 292, 24, 92, .08, 0, TAU);
    g.moveTo(640, 640); g.lineTo(780, 640); g.lineTo(752, 770); g.lineTo(668, 770); g.closePath(); g.moveTo(540, 500); g.ellipse(620, 470, 120, 22, -.7, 0, TAU); };
  g.filter = 'blur(10px)'; g.fillStyle = 'rgba(196,140,64,.34)'; rabbit(); g.fill(); g.filter = 'blur(2px)'; g.strokeStyle = 'rgba(170,112,44,.28)'; g.lineWidth = 6; rabbit(); g.stroke(); g.filter = 'none';
  for (let i = 0; i < 30; i++) { const x = 120 + r() * 780, y = 120 + r() * 780, rr = 8 + r() * 36; g.fillStyle = 'rgba(200,146,70,.14)'; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
    g.lineWidth = 2 + rr * .08; g.strokeStyle = 'rgba(255,250,226,.55)'; g.beginPath(); g.arc(x, y, rr, Math.PI * .8, Math.PI * 1.8); g.stroke(); g.strokeStyle = 'rgba(150,100,44,.3)'; g.beginPath(); g.arc(x, y, rr, -Math.PI * .2, Math.PI * .8); g.stroke(); }
  g.restore();
  g.strokeStyle = C.gold; g.lineWidth = 14; g.beginPath(); g.arc(512, 512, 496, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(255,248,220,.7)'; g.lineWidth = 3; g.setLineDash([3, 10]); g.beginPath(); g.arc(512, 512, 476, 0, TAU); g.stroke(); g.setLineDash([]);
  grain(g, 1024, 1024, .24, 'soft-light'); return c;
}
function starTex() {
  const c = cv(256, 256), g = g2(c);
  starPath(g, 128, 132, 120, 52); const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, '#FFE7A3'); gr.addColorStop(.5, C.gold); gr.addColorStop(1, C.gold2);
  g.fillStyle = gr; g.fill(); starPath(g, 128, 132, 92, 40); g.strokeStyle = 'rgba(255,248,220,.7)'; g.lineWidth = 4; g.stroke();
  grain(g, 256, 256, .2, 'soft-light'); return c;
}
/** One layer of the night city. L0 = far skyline (tall towers, a lattice radio tower, aircraft lights), L1 = office blocks
 *  (rooftop tanks and billboards), L2 = near streets (shop fronts). Window grids are dark in the texture; lit windows are instanced. */
function cityTex(L: number) {
  if (L === 3) return streetTex();
  const r = rng(40 + L), Hc = [1300, 1000, 760][L]!, c = cv(2400, Hc), g = g2(c), e = cv(2400, Hc), ge = g2(e);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, 2400, Hc);
  const base = ['#5a6fbe', '#2c3f92', '#141c52'][L]!, ww = [9, 13, 17][L]!, wh = [12, 17, 22][L]!, sx = [17, 24, 31][L]!, sy = [24, 31, 40][L]!;
  const hr = ([[960, 1290], [700, 990], [470, 720]] as const)[L]!, win: [number, number, number][] = [];
  const sign = ['#FF7FB8', '#7FE3FF', '#FFD27A', '#C8A6FF'];
  let x = -30;
  while (x < 2400) {
    const w = L === 0 ? 60 + r() * 120 : L === 1 ? 110 + r() * 160 : 150 + r() * 190;
    let h = hr[0] + r() * (hr[1] - hr[0]); if (L === 0 && x > 1380 && x < 2050) h = Math.min(h, 1010 + r() * 60); // keep the moon clear
    const y = Hc - h, tone = r();
    g.fillStyle = base; g.fillRect(x, y, w, h); g.fillStyle = tone < .5 ? `rgba(0,0,30,${tone * .3})` : `rgba(255,255,255,${(tone - .5) * .08})`; g.fillRect(x, y, w, h);
    const top = r();
    g.fillStyle = base;
    if (top < .2) { g.fillRect(x + w * .14, y - 34, w * .72, 34); g.fillRect(x + w * .3, y - 64, w * .4, 30); g.fillRect(x + w / 2 - 2, y - 150, 4, 86); ge.fillStyle = '#ff4040'; ge.beginPath(); ge.arc(x + w / 2, y - 150, 5, 0, TAU); ge.fill(); }
    else if (top < .34) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w / 2, y - 90 - r() * 60); g.lineTo(x + w, y); g.fill(); }
    else if (top < .58) { g.fillRect(x + w * .58, y - 30, 30, 22); g.fillRect(x + w * .6, y - 8, 3, 8); g.fillRect(x + w * .58 + 25, y - 8, 3, 8); g.fillRect(x + w * .15, y - 14, 24, 14); }
    else if (top < .76 && L > 0) { const bw = Math.min(w * .8, 120), bx = x + (w - bw) / 2, by = y - 64, col = sign[Math.floor(r() * 4)]!; g.fillRect(bx + 10, by + 40, 4, 24); g.fillRect(bx + bw - 14, by + 40, 4, 24); g.fillStyle = col; g.fillRect(bx, by, bw, 40); ge.fillStyle = col; ge.fillRect(bx, by, bw, 40); g.fillStyle = 'rgba(20,20,60,.5)'; g.fillRect(bx + 8, by + 12, bw - 16, 6); g.fillRect(bx + 8, by + 24, (bw - 16) * .6, 6); }
    g.fillStyle = 'rgba(255,255,255,.09)'; g.fillRect(x, y, 4, h); g.fillStyle = 'rgba(0,0,20,.25)'; g.fillRect(x + w - 4, y, 4, h);
    const cols = Math.max(1, Math.floor((w - 14) / sx)), x0 = x + (w - (cols - 1) * sx - ww) / 2, dens = .3 + r() * .45, stop = L === 2 ? Hc - 90 : Hc - wh - 6;
    for (let wy = y + 20; wy < stop; wy += sy) for (let i = 0; i < cols; i++) { const wx = x0 + i * sx; g.fillStyle = 'rgba(5,10,40,.55)'; g.fillRect(wx, wy, ww, wh); if (r() < dens) win.push([wx, wy, r()]); }
    if (L === 2) { g.fillStyle = '#0d1440'; g.fillRect(x + 8, Hc - 72, w - 16, 62); const col = r() < .5 ? '#FFCF8A' : sign[Math.floor(r() * 4)]!; for (const G of [g, ge]) { G.fillStyle = col; G.fillRect(x + 12, Hc - 70, w - 24, 9); G.fillRect(x + 20, Hc - 52, (w - 40) * .45, 34); } }
    x += w + (L === 0 ? 2 + r() * 10 : 5 + r() * 22);
  }
  if (L === 0) { // a lattice radio tower on the skyline
    const tx = 560, ty = Hc - 1240; g.strokeStyle = base; g.lineWidth = 7;
    g.beginPath(); g.moveTo(tx - 70, Hc); g.lineTo(tx - 6, ty); g.moveTo(tx + 70, Hc); g.lineTo(tx + 6, ty); g.stroke(); g.lineWidth = 3;
    for (let k = 0; k < 14; k++) { const u0 = k / 14, u1 = (k + 1) / 14, y0 = lerp(Hc, ty, u0), y1 = lerp(Hc, ty, u1), a = lerp(70, 6, u0), b = lerp(70, 6, u1); g.beginPath(); g.moveTo(tx - a, y0); g.lineTo(tx + b, y1); g.moveTo(tx + a, y0); g.lineTo(tx - b, y1); g.stroke(); }
    g.fillStyle = base; g.fillRect(tx - 34, Hc - 520, 68, 16); g.fillRect(tx - 22, Hc - 860, 44, 14); g.fillRect(tx - 2, ty - 90, 4, 90);
    ge.fillStyle = '#ff4040'; for (const yy of [ty - 90, Hc - 860, Hc - 520]) { ge.beginPath(); ge.arc(tx, yy, 6, 0, TAU); ge.fill(); }
  }
  if (L === 0) { const hz = g.createLinearGradient(0, Hc * .3, 0, Hc); hz.addColorStop(0, 'rgba(150,170,230,0)'); hz.addColorStop(1, 'rgba(150,170,230,.22)'); g.globalCompositeOperation = 'source-atop'; g.fillStyle = hz; g.fillRect(0, 0, 2400, Hc); g.globalCompositeOperation = 'source-over'; }
  grain(g, 2400, Hc, .16, 'soft-light');
  win.sort((a, b) => a[2] - b[2]);
  return { c, e, win, Hc, ww, wh };
}
/** The street in front of the city: one unbroken low wall (so the stage floor never shows under the buildings), street trees, lamps. */
function streetTex() {
  const Hc = 260, c = cv(2400, Hc), g = g2(c), e = cv(2400, Hc), ge = g2(e), r = rng(49), col = '#0c1238';
  ge.fillStyle = '#000'; ge.fillRect(0, 0, 2400, Hc);
  for (let x = 20; x < 2420; x += 120 + r() * 70) { // trees
    const cx = x, cy = 96 + r() * 20, R = 34 + r() * 22; g.fillStyle = col; g.fillRect(cx - 4, cy, 8, 80);
    g.fillStyle = '#121a4a'; g.beginPath(); for (const [dx, dy, rr] of [[0, 0, 1], [-.7, .35, .75], [.7, .35, .75], [0, -.45, .7]] as const) { g.moveTo(cx + dx * R + rr * R, cy + dy * R); g.arc(cx + dx * R, cy + dy * R, rr * R, 0, TAU); } g.fill();
    g.fillStyle = 'rgba(120,150,230,.12)'; g.beginPath(); g.arc(cx - R * .3, cy - R * .3, R * .45, 0, TAU); g.fill();
  }
  for (let x = 150; x < 2400; x += 300) { // street lamps
    g.fillStyle = col; g.fillRect(x - 3, 40, 6, 120); g.fillRect(x - 3, 38, 22, 5);
    for (const G of [g, ge]) { G.fillStyle = '#FFE0A8'; G.beginPath(); G.arc(x + 18, 48, 7, 0, TAU); G.fill(); }
    const gl = ge.createRadialGradient(x + 18, 52, 2, x + 18, 52, 46); gl.addColorStop(0, 'rgba(255,210,150,.5)'); gl.addColorStop(1, 'rgba(255,210,150,0)'); ge.fillStyle = gl; ge.fillRect(x - 30, 4, 96, 96);
  }
  g.fillStyle = col; g.fillRect(0, 150, 2400, Hc - 150); g.fillStyle = '#34479a'; g.fillRect(0, 150, 2400, 4);
  for (let x = 0; x < 2400; x += 60) { g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(x, 156, 2, Hc - 156); }
  grain(g, 2400, Hc, .16, 'soft-light');
  return { c, e, win: [] as [number, number, number][], Hc, ww: 10, wh: 10 };
}
function audTex(k: number) {
  const c = cv(256, 320), g = g2(c);
  g.fillStyle = '#120a26';
  g.beginPath(); g.ellipse(128, 300, 118, 90, 0, Math.PI, 0); g.fill(); g.fillRect(10, 300, 236, 20);
  g.beginPath(); g.arc(128, 150, 68, 0, TAU); g.fill();
  if (k === 0) { g.beginPath(); g.arc(128, 72, 36, 0, TAU); g.fill(); }
  if (k === 1) { g.beginPath(); g.ellipse(84, 70, 18, 60, -.3, 0, TAU); g.ellipse(172, 70, 18, 60, .3, 0, TAU); g.fill(); }
  if (k === 2) { g.beginPath(); g.ellipse(128, 106, 92, 28, 0, Math.PI, 0); g.fill(); }
  return c;
}
function noteTex(col: string) { const c = cv(160, 220), g = g2(c); g.fillStyle = col; g.beginPath(); g.ellipse(52, 176, 40, 30, -.4, 0, TAU); g.fill(); g.fillRect(80, 30, 14, 150); g.beginPath(); g.moveTo(80, 30); g.quadraticCurveTo(140, 60, 132, 120); g.quadraticCurveTo(122, 80, 94, 72); g.fill(); grain(g, 160, 220, .2, 'soft-light'); return c; }
function valanceTex() {
  const c = cv(2048, 300), g = g2(c);
  g.fillStyle = C.gun1; g.fillRect(0, 0, 2048, 150);
  for (let x = 0; x < 2048; x += 160) { g.beginPath(); g.moveTo(x, 140); g.quadraticCurveTo(x + 80, 300, x + 160, 140); g.fill(); }
  g.strokeStyle = C.gold; g.lineWidth = 8; for (let x = 0; x < 2048; x += 160) { g.beginPath(); g.moveTo(x, 150); g.quadraticCurveTo(x + 80, 290, x + 160, 150); g.stroke(); }
  for (let x = 80; x < 2048; x += 160) { g.fillStyle = C.gold; g.fillRect(x - 4, 222, 8, 50); g.beginPath(); g.arc(x, 280, 12, 0, TAU); g.fill(); }
  for (let x = 20; x < 2048; x += 60) { starPath(g, x, 70, 16, 7); g.fillStyle = C.gold; g.fill(); }
  grain(g, 2048, 300, .2, 'soft-light'); return c;
}
function woodTex() {
  const c = cv(1024, 512), g = g2(c), r = rng(5);
  for (let y = 0; y < 512; y += 64) { g.fillStyle = `hsl(22,${32 + r() * 10}%,${24 + r() * 8}%)`; g.fillRect(0, y, 1024, 62); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, y + 62, 1024, 2); }
  g.globalAlpha = .15; for (let i = 0; i < 300; i++) { g.strokeStyle = r() < .5 ? '#000' : '#fff'; g.beginPath(); const y = r() * 512; g.moveTo(0, y); g.bezierCurveTo(300, y + 6, 700, y - 6, 1024, y); g.stroke(); }
  g.globalAlpha = 1; return c;
}
function seatNumTex(n: number) { const c = cv(128, 64), g = g2(c); g.fillStyle = C.gold; g.fillRect(0, 0, 128, 64); g.fillStyle = C.plum; g.font = `600 44px ${LAT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 34); return c; }
function coneTex() { const c = cv(64, 256), g = g2(c); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.15, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,.15)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); return c; }
function glowTex() { const c = cv(128, 128), g = g2(c); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c; }
function petalTex() { const c = cv(64, 64), g = g2(c); g.fillStyle = C.pink; g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(62, 20, 50, 56, 32, 60); g.bezierCurveTo(14, 56, 2, 20, 32, 4); g.fill(); return c; }
function windowTex() {
  const c = cv(1200, 1400), g = g2(c);
  const gr = g.createLinearGradient(0, 0, 0, 1400); gr.addColorStop(0, '#050a24'); gr.addColorStop(1, '#1b2d76'); g.fillStyle = gr; g.fillRect(0, 0, 1200, 1400);
  const r = rng(9); for (let i = 0; i < 120; i++) { g.fillStyle = '#dfe6ff'; g.globalAlpha = r(); g.beginPath(); g.arc(r() * 1200, r() * 1000, r() * 2 + .5, 0, TAU); g.fill(); } g.globalAlpha = 1;
  const mg = g.createRadialGradient(780, 380, 10, 780, 380, 260); mg.addColorStop(0, 'rgba(255,240,200,.5)'); mg.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = mg; g.fillRect(0, 0, 1200, 1400);
  g.fillStyle = '#FFF1C6'; g.beginPath(); g.arc(780, 380, 110, 0, TAU); g.fill();
  g.fillStyle = '#0b1235'; g.fillRect(0, 1180, 1200, 220); for (let x = 0; x < 1200; x += 90) g.fillRect(x, 1100 - (x * 37 % 120), 80, 300);
  g.strokeStyle = '#2a1a1a'; g.lineWidth = 40; g.strokeRect(20, 20, 1160, 1360); g.lineWidth = 26; g.beginPath(); g.moveTo(600, 20); g.lineTo(600, 1380); g.moveTo(20, 700); g.lineTo(1180, 700); g.stroke();
  return c;
}
function wavesTex() {
  const c = cv(2400, 200), g = g2(c);
  for (let x = -100; x < 2500; x += 150) {
    g.fillStyle = '#1C2F7A'; g.beginPath(); g.moveTo(x, 200); g.lineTo(x, 120); g.bezierCurveTo(x + 40, 40, x + 120, 40, x + 150, 95); g.bezierCurveTo(x + 120, 80, x + 100, 115, x + 125, 130); g.lineTo(x + 150, 200); g.fill();
    g.strokeStyle = '#FFF7EB'; g.lineWidth = 7; g.beginPath(); g.moveTo(x + 14, 122); g.bezierCurveTo(x + 48, 58, x + 118, 58, x + 144, 96); g.stroke();
    g.strokeStyle = '#E2B055'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 30, 150); g.bezierCurveTo(x + 60, 110, x + 110, 110, x + 130, 140); g.stroke();
  }
  grain(g, 2400, 200, .2, 'soft-light'); return c;
}
function cloudsTex() {
  const c = cv(2400, 360), g = g2(c), r = rng(55);
  for (let i = 0; i < 9; i++) {
    const x = i * 300 - 40 + r() * 60, y = 220 + r() * 60, s = .8 + r() * .5; g.fillStyle = i % 2 ? '#C9B8E8' : '#E9E0F5'; g.beginPath();
    for (let k = 0; k < 5; k++) g.arc(x - 120 * s + k * 60 * s, y - Math.sin(k * 1.3) * 18, (46 + (k % 2) * 22) * s, Math.PI, 0);
    g.lineTo(x + 180 * s, 360); g.lineTo(x - 170 * s, 360); g.fill();
    g.strokeStyle = '#E2B055'; g.lineWidth = 4; g.beginPath(); g.arc(x, y + 10, 22 * s, Math.PI * 1.1, Math.PI * 1.95); g.stroke();
  }
  g.fillStyle = '#C9B8E8'; g.fillRect(0, 330, 2400, 30); grain(g, 2400, 360, .2, 'soft-light'); return c;
}
function fluteTex() { const c = cv(512, 256), g = g2(c), gr = g.createLinearGradient(0, 0, 512, 0); for (let k = 0; k <= 16; k++) gr.addColorStop(k / 16, k % 2 ? '#F7B4D0' : '#E486B0'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256); grain(g, 512, 256, .2, 'soft-light'); return c; }
function lanternTex() {
  const c = cv(256, 256), g = g2(c); g.fillStyle = '#F5A3C7'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#C24D84'; g.lineWidth = 6;
  for (let x = 0; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  g.fillStyle = '#C24D84'; g.fillRect(0, 0, 256, 22); g.fillRect(0, 234, 256, 22); g.fillStyle = '#7a1f4a'; g.font = `700 90px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('月', 128, 128); return c;
}

/** A toy train cut-out running right → left; windows (and its headlamp) on the emissive map. One window has rabbit ears in it. */
function trainTex() {
  const c = cv(1600, 300), g = g2(c), e = cv(1600, 300), ge = g2(e), body = '#121d55', hi = '#3A56A8', lit = '#FFD27A';
  ge.fillStyle = '#000'; ge.fillRect(0, 0, 1600, 300);
  const both = (f: (G: OffscreenCanvasRenderingContext2D) => void) => { f(g); f(ge); };
  g.fillStyle = body;
  g.beginPath(); g.roundRect(40, 118, 330, 122, 34); g.fill(); g.beginPath(); g.roundRect(262, 58, 140, 182, 14); g.fill();
  g.fillRect(92, 52, 46, 80); g.beginPath(); g.moveTo(70, 46); g.lineTo(160, 46); g.lineTo(148, 70); g.lineTo(82, 70); g.fill();
  g.beginPath(); g.moveTo(44, 236); g.lineTo(0, 272); g.lineTo(70, 272); g.fill(); g.fillRect(250, 50, 166, 14);
  g.fillStyle = hi; g.fillRect(60, 124, 290, 6); g.fillRect(268, 64, 128, 5);
  for (let k = 0; k < 3; k++) {
    const x = 450 + k * 380; g.fillStyle = body; g.beginPath(); g.roundRect(x, 92, 350, 150, 22); g.fill(); g.fillRect(x - 34, 206, 34, 12);
    g.fillStyle = hi; g.fillRect(x + 14, 98, 322, 6);
    for (let j = 0; j < 4; j++) { const wx = x + 28 + j * 80; both(G => { G.fillStyle = lit; G.fillRect(wx, 122, 52, 56); }); }
  }
  both(G => { G.fillStyle = lit; G.fillRect(292, 88, 72, 62); G.fillStyle = '#FFF1C9'; G.beginPath(); G.arc(48, 150, 17, 0, TAU); G.fill(); });
  both(G => { G.fillStyle = G === g ? body : '#000'; G.beginPath(); G.ellipse(948, 150, 7, 24, -.2, 0, TAU); G.ellipse(966, 150, 7, 24, .2, 0, TAU); G.fill(); G.beginPath(); G.arc(957, 178, 15, Math.PI, 0); G.fill(); });
  g.fillStyle = '#0a1238'; g.strokeStyle = hi; g.lineWidth = 4;
  for (const x of [110, 200, 320, 500, 740, 880, 1120, 1260, 1500]) { g.beginPath(); g.arc(x, 252, 26, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.moveTo(x - 20, 252); g.lineTo(x + 20, 252); g.moveTo(x, 232); g.lineTo(x, 272); g.stroke(); }
  grain(g, 1600, 300, .2, 'soft-light'); return { c, e };
}
/** A slender elevated railway: railing, deck girder, braced piers, lamps along the deck (emissive). */
function viaductTex() {
  const c = cv(2400, 220), g = g2(c), e = cv(2400, 220), ge = g2(e), col = '#0f1946';
  ge.fillStyle = '#000'; ge.fillRect(0, 0, 2400, 220);
  g.fillStyle = col; g.fillRect(0, 22, 2400, 30); g.fillStyle = '#5a74c0'; g.fillRect(0, 22, 2400, 3);
  g.fillStyle = col; g.fillRect(0, 6, 2400, 3); for (let x = 0; x < 2400; x += 18) g.fillRect(x, 6, 3, 17);
  g.strokeStyle = col; g.lineWidth = 6;
  for (let x = 60; x < 2400; x += 300) { g.fillRect(x, 52, 24, 168); g.beginPath(); g.moveTo(x - 80, 52); g.lineTo(x, 124); g.moveTo(x + 104, 52); g.lineTo(x + 24, 124); g.stroke(); }
  for (let x = 210; x < 2400; x += 300) { g.fillStyle = col; g.fillRect(x - 2, 0, 4, 22); for (const G of [g, ge]) { G.fillStyle = '#FFE0A8'; G.beginPath(); G.arc(x, 3, 5, 0, TAU); G.fill(); } }
  grain(g, 2400, 220, .2, 'soft-light'); return { c, e };
}
/** Kozo fibres and uneven pulp for the washi screen, laid over the shadow play every frame. */
function fibreTex() {
  const c = cv(1800, 1100), g = g2(c), r = rng(17);
  for (let i = 0; i < 90; i++) { const x = r() * 1800, y = r() * 1100, rr = 60 + r() * 220, gr = g.createRadialGradient(x, y, 0, x, y, rr), dark = r() < .5;
    gr.addColorStop(0, dark ? 'rgba(20,30,90,.07)' : 'rgba(255,255,255,.06)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  g.lineCap = 'round';
  for (let i = 0; i < 900; i++) { const x = r() * 1800, y = r() * 1100, a = r() * TAU, l = 20 + r() * 120, bend = (r() - .5) * 60, dark = r() < .3;
    g.strokeStyle = dark ? `rgba(30,40,100,${.08 + r() * .12})` : `rgba(255,255,255,${.12 + r() * .25})`; g.lineWidth = .6 + r() * 1.6;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l / 2 - Math.sin(a) * bend, y + Math.sin(a) * l / 2 + Math.cos(a) * bend, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  return c;
}
// ---------------------------------------------------------------- the opera house around the stage (textures)
const PXU = 200, TIERS = [.45, 1.35, 2.25, 3.15] as const, HALL = { x: 3.45, z0: .55, z1: 5.4, y0: -.5, y1: 5.4 };
type Ctx = OffscreenCanvasRenderingContext2D;
function damask(g: Ctx, w: number, h: number) {
  g.fillStyle = '#3d1030'; g.fillRect(0, 0, w, h);
  for (let y = 10, j = 0; y < h; y += 46, j++) for (let x = (j % 2) * 23; x < w; x += 46) { g.fillStyle = 'rgba(226,176,85,.09)'; g.beginPath(); g.moveTo(x, y - 12); g.quadraticCurveTo(x + 9, y, x, y + 12); g.quadraticCurveTo(x - 9, y, x, y - 12); g.fill(); }
}
function archPath(G: Ctx, cx: number, top: number, bot: number, hw: number) { const S = top + hw; G.beginPath(); G.moveTo(cx - hw, bot); G.lineTo(cx - hw, S); G.arc(cx, S, hw, Math.PI, 0); G.lineTo(cx + hw, bot); G.closePath(); }
/** A wall of opera boxes: `bays` arched openings on four tiers (velvet drapes, gilt frames), doors below, gilt pilasters, a star gallery above. Emissive map = the lamplight inside the boxes. */
function operaWallTex(len: number, bays: number) {
  const w = Math.round(len * PXU), h = Math.round((HALL.y1 - HALL.y0) * PXU), c = cv(w, h), g = g2(c), e = cv(w, h), ge = g2(e);
  const Y = (y: number) => (HALL.y1 - y) * PXU, bw = w / bays;
  ge.fillStyle = '#000'; ge.fillRect(0, 0, w, h); damask(g, w, h);
  for (let k = 0; k < bays; k++) {
    const cx = (k + .5) * bw, hw = bw * .36;
    for (const y0 of TIERS) {
      const top = Y(y0 + .84), bot = Y(y0 + .16), ig = g.createLinearGradient(0, top, 0, bot); ig.addColorStop(0, '#2a0a1e'); ig.addColorStop(1, '#0e0308');
      archPath(g, cx, top, bot, hw); g.fillStyle = ig; g.fill();
      g.save(); archPath(g, cx, top, bot, hw); g.clip(); g.fillStyle = '#9a2443';
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * hw * 1.05, top); g.quadraticCurveTo(cx + s * hw * .3, top + (bot - top) * .5, cx + s * hw * .78, bot); g.lineTo(cx + s * hw * 1.05, bot); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(cx - hw, top, hw * 2, 16); g.restore();
      g.strokeStyle = C.gold; g.lineWidth = 6; archPath(g, cx, top, bot, hw); g.stroke();
      g.strokeStyle = 'rgba(255,240,200,.35)'; g.lineWidth = 2; archPath(g, cx, top + 7, bot, hw - 7); g.stroke();
      ge.save(); archPath(ge, cx, top, bot, hw); ge.clip(); const eg = ge.createRadialGradient(cx, top + hw * .9, 4, cx, top + hw * .9, hw * 1.5);
      eg.addColorStop(0, '#ffb070'); eg.addColorStop(.6, '#5a2410'); eg.addColorStop(1, '#100402'); ge.fillStyle = eg; ge.fillRect(cx - hw, top, hw * 2, bot - top); ge.restore();
    }
    const dtop = Y(.3), dhw = bw * .22; archPath(g, cx, dtop, h, dhw); g.fillStyle = '#12040c'; g.fill(); g.strokeStyle = C.gold2; g.lineWidth = 5; g.stroke();
    ge.save(); archPath(ge, cx, dtop, h, dhw); ge.clip(); ge.fillStyle = '#3a1406'; ge.fillRect(cx - dhw, dtop, dhw * 2, h - dtop); ge.restore();
  }
  for (const y0 of TIERS) { const y = Y(y0 + .9); g.fillStyle = C.gold2; g.fillRect(0, y - 8, w, 8); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, y, w, 6); }
  g.fillStyle = '#2a0b22'; g.fillRect(0, 0, w, Y(4.1));
  for (let k = 0; k <= bays; k++) {
    const x = k * bw, pg = g.createLinearGradient(x - 13, 0, x + 13, 0); pg.addColorStop(0, '#8a6020'); pg.addColorStop(.5, '#f3d58a'); pg.addColorStop(1, '#8a6020');
    g.fillStyle = pg; g.fillRect(x - 11, Y(4.1), 22, h - Y(4.1)); for (const y0 of TIERS) { g.fillStyle = '#f3d58a'; g.fillRect(x - 19, Y(y0 + .9) - 18, 38, 10); }
  }
  g.fillStyle = C.gold; g.fillRect(0, Y(4.1) - 10, w, 10); g.fillRect(0, Y(5.32), w, 8);
  for (let k = 0; k < bays; k++) { const cx = (k + .5) * bw; g.strokeStyle = C.gold2; g.lineWidth = 4; g.strokeRect(cx - bw * .38, Y(5.15), bw * .76, Y(4.25) - Y(5.15)); starPath(g, cx, (Y(5.15) + Y(4.25)) / 2, 22, 9); g.fillStyle = 'rgba(226,176,85,.55)'; g.fill(); }
  grain(g, w, h, .16, 'soft-light'); return { c, e };
}
/** The painted dome: a 群青 sky with stars, gilt ribs and rings, a crescent moon, a ring of little lamps (emissive). */
function ceilingTex() {
  const w = 1380, h = 970, c = cv(w, h), g = g2(c), e = cv(w, h), ge = g2(e), r = rng(71), cx = w / 2, cy = h / 2, R = 440;
  ge.fillStyle = '#000'; ge.fillRect(0, 0, w, h); damask(g, w, h);
  const dg = g.createRadialGradient(cx, cy, 20, cx, cy, R); dg.addColorStop(0, '#3b5bb8'); dg.addColorStop(.6, '#1C2F7A'); dg.addColorStop(1, '#0E1A4F');
  g.fillStyle = dg; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
  for (let i = 0; i < 240; i++) { const a = r() * TAU, rr = Math.sqrt(r()) * R * .95; g.fillStyle = `rgba(255,240,210,${.3 + r() * .6})`; g.beginPath(); g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, .8 + r() * 1.8, 0, TAU); g.fill(); }
  g.strokeStyle = C.gold; for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; g.lineWidth = 5; g.beginPath(); g.moveTo(cx + Math.cos(a) * 120, cy + Math.sin(a) * 120); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke(); }
  for (const [rr, lw] of [[R, 16], [R - 22, 4], [120, 10], [300, 3]] as const) { g.lineWidth = lw; g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.stroke(); }
  for (let k = 0; k < 48; k++) { const a = k / 48 * TAU, x = cx + Math.cos(a) * (R + 30), y = cy + Math.sin(a) * (R + 30); for (const G of [g, ge]) { G.fillStyle = G === g ? '#f3d58a' : '#ffd59a'; G.beginPath(); G.arc(x, y, 7, 0, TAU); G.fill(); } }
  g.fillStyle = C.moon; g.beginPath(); g.arc(cx, cy, 70, 0, TAU); g.fill(); g.fillStyle = '#3b5bb8'; g.beginPath(); g.arc(cx + 30, cy - 16, 62, 0, TAU); g.fill();
  for (const [x, y] of [[90, 90], [w - 90, 90], [90, h - 90], [w - 90, h - 90]] as const) { starPath(g, x, y, 40, 16); g.fillStyle = C.gold2; g.fill(); }
  grain(g, w, h, .16, 'soft-light'); return { c, e };
}
/** The wall the proscenium is set into: damask, gilt pilasters, a painted moon lunette above the crown; the stage opening is cut out. */
function prosWallTex(kit: Kit) {
  const w = Math.round(HALL.x * 2 * PXU), h = Math.round((HALL.y1 - HALL.y0) * PXU), c = cv(w, h), g = g2(c);
  const X = (x: number) => (x + HALL.x) * PXU, Y = (y: number) => (HALL.y1 - y) * PXU;
  damask(g, w, h);
  const lx = X(0), ly = Y(4.15), rx = 1.7 * PXU, ry = 1.1 * PXU, src = kit.bg.starNight;
  g.save(); g.beginPath(); g.ellipse(lx, ly, rx, ry, 0, Math.PI, 0); g.closePath(); g.clip();
  const k = Math.max(rx * 2 / src.width, ry / src.height); g.drawImage(src, lx - src.width * k / 2, ly - src.height * k * .8, src.width * k, src.height * k);
  g.fillStyle = 'rgba(14,26,79,.25)'; g.fillRect(lx - rx, ly - ry, rx * 2, ry); g.restore();
  g.strokeStyle = C.gold; g.lineWidth = 16; g.beginPath(); g.ellipse(lx, ly, rx, ry, 0, Math.PI, 0); g.closePath(); g.stroke();
  g.strokeStyle = 'rgba(255,240,200,.5)'; g.lineWidth = 3; g.beginPath(); g.ellipse(lx, ly, rx - 14, ry - 14, 0, Math.PI, 0); g.stroke();
  for (const sx of [-1, 1]) { const x = X(sx * 3.25), pg = g.createLinearGradient(x - 18, 0, x + 18, 0); pg.addColorStop(0, '#8a6020'); pg.addColorStop(.5, '#f3d58a'); pg.addColorStop(1, '#8a6020'); g.fillStyle = pg; g.fillRect(x - 16, 0, 32, h); }
  g.fillStyle = C.gold; g.fillRect(0, Y(5.32), w, 8);
  grain(g, w, h, .16, 'soft-light');
  g.globalCompositeOperation = 'destination-out'; g.fillRect(X(-2.4), Y(2.6), X(2.4) - X(-2.4), h); g.globalCompositeOperation = 'source-over';
  return c;
}

// ---------------------------------------------------------------- build
export async function buildWorld(b: BuildContext, kit: Kit): Promise<World> {
  const { THREE, scene, camera, renderer } = b;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  camera.near = .05; camera.far = 80;
  // ImageBitmaps ignore texture.flipY, so loaded images go through a canvas first (otherwise they land upside down)
  const bmp = (im: ImageBitmap) => { const c = cv(im.width, im.height); g2(c).drawImage(im, 0, 0); return c; };
  const tex = (canvas: OffscreenCanvas | ImageBitmap, mip = true) => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = mip; if (!mip) t.minFilter = THREE.LinearFilter; return t; };
  const depthFor = (map: T3) => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: .5 });
  const cutMat = (map: T3, o: Record<string, unknown> = {}) => new THREE.MeshStandardMaterial({ map, alphaTest: .5, roughness: .85, metalness: 0, side: THREE.DoubleSide, ...o });
  const flat = (canvas: OffscreenCanvas, w: number, h: number, o: { thick?: number; back?: string; emissive?: T3; ei?: number; shadow?: boolean } = {}) => {
    const g = new THREE.Group(), map = tex(canvas, canvas.width <= 1024);
    const m = cutMat(map, { side: THREE.FrontSide });
    if (o.emissive) { m.emissiveMap = o.emissive; m.emissive = new THREE.Color('#ffffff'); m.emissiveIntensity = o.ei ?? 0; }
    const front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); front.castShadow = o.shadow ?? true; front.receiveShadow = true; front.customDepthMaterial = depthFor(map);
    const backing = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ alphaMap: map, alphaTest: .5, color: o.back ?? '#20102a', roughness: .9, side: THREE.DoubleSide }));
    backing.position.z = -(o.thick ?? .012); backing.castShadow = o.shadow ?? true; backing.customDepthMaterial = depthFor(map);
    g.add(front, backing); g.userData = { front, map, mat: m }; return g;
  };
  const strMat = new THREE.MeshBasicMaterial({ color: '#E9E1D2' });
  const woodC = woodTex();
  const blurList: T3[] = [];
  const glowT = tex(glowTex());
  const trimMat = new THREE.MeshStandardMaterial({ color: C.gold, metalness: .8, roughness: .35 });

  // puppet textures for every pose, shared by all puppets
  const texc: World['texc'] = {};
  const USED: [string, 'front' | 'back'][] = [['happy', 'front'], ['arrival', 'front'], ['mooncake', 'front'], ['moonlight', 'front'], ['sad', 'front'], ['moonlight', 'back'], ['sad', 'back'], ['mooncake', 'back']];
  for (const [key, side] of USED) { const c = kit.pose[key]![side], t = tex(c, false); texc[key + side] = { tex: t, depth: depthFor(t), aspect: c.width / c.height }; }
  const sil = kit.pose.moonlight!.sil, silTex = tex(sil);
  texc.moonlightsil = { tex: silTex, depth: depthFor(silTex), aspect: sil.width / sil.height };
  const puppet = (h: number) => {
    const g = new THREE.Group();
    const f = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: texc.happyfront!.tex, alphaTest: .5, roughness: .75 }));
    const bk = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: texc.moonlightback!.tex, alphaTest: .5, roughness: .8 }));
    bk.rotation.y = Math.PI; bk.position.z = -.004; f.position.z = .004; f.castShadow = bk.castShadow = true;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(h * .008, h * .008, h * .9, 6), new THREE.MeshStandardMaterial({ color: C.wood })); rod.position.set(0, -h * .62, -.01); rod.castShadow = true;
    g.add(f, bk, rod); g.userData = { f, b: bk, h, key: '' }; return g;
  };

  // ---- room ----
  const room = new THREE.Group(); scene.add(room);
  const deskMap = tex(woodC); deskMap.wrapS = deskMap.wrapT = THREE.RepeatWrapping; deskMap.repeat.set(4, 6);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(16, .4, 12), new THREE.MeshStandardMaterial({ map: deskMap, color: '#8a7090', roughness: .6 }));
  desk.position.set(0, -.7, 2); desk.receiveShadow = true; room.add(desk);
  const winLight = { intensity: 0 }; // (no room any more: kept as a stub so poses can still write it)
  // ---- theatre ----
  const th = new THREE.Group(); scene.add(th);
  const stageMat = new THREE.MeshPhysicalMaterial({ map: tex(woodC), color: '#b48a8a', roughness: .32, clearcoat: .9, clearcoatRoughness: .12 });
  const plumMat = new THREE.MeshStandardMaterial({ color: C.plum });
  const stage = new THREE.Mesh(new THREE.BoxGeometry(4.6, .5, 2.4), [plumMat, plumMat, stageMat, stageMat, plumMat, plumMat]);
  stage.position.set(0, -.25, -.55); stage.receiveShadow = true; stage.castShadow = true; th.add(stage);
  const backTex = { star: tex(kit.bg.starNight, false), foot: tex(kit.bg.footNight, false), end: tex(bmp(kit.img.end!), false), stage2: tex(bmp(kit.img.stagev2!), false) };
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.9), new THREE.MeshStandardMaterial({ map: backTex.star, emissiveMap: backTex.star, emissive: '#ffffff', emissiveIntensity: 0, roughness: 1 }));
  backdrop.position.set(0, 1.35, -1.72); backdrop.receiveShadow = true; th.add(backdrop);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3), new THREE.MeshStandardMaterial({ color: '#120a2a', roughness: 1 })); w.position.set(s * 2.3, 1.3, -.55); w.rotation.y = -s * Math.PI / 2; th.add(w); }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.4), new THREE.MeshStandardMaterial({ color: '#0a0620' })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 2.75, -.55); th.add(ceil);
  const P = prosTextures();
  const pros = flat(P.c, 6.0, 4.1, { thick: .06, back: '#1b0a1e', emissive: tex(P.e, false), ei: 0 }); pros.position.set(0, 1.55, .62); th.add(pros);
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 4.1), new THREE.MeshStandardMaterial({ alphaMap: pros.userData.map, alphaTest: .5, color: '#7a2a58', roughness: .9 })); inner.position.set(0, 1.55, .5); th.add(inner);
  // marquee bulbs around the header plate: real little lamps, lit one by one
  const bulbs: T3[] = [];
  for (let i = 0; i < 26; i++) {
    const a = Math.PI + i / 25 * Math.PI, x = 1200 + Math.cos(a) * 390, y = 220 + Math.sin(a) * 150;
    const b = new THREE.Mesh(new THREE.SphereGeometry(.024, 12, 8), new THREE.MeshBasicMaterial({ color: '#4a3a2a', toneMapped: false })); b.position.set(-3 + x / 400, 3.6 - y / 400, .645); th.add(b); bulbs.push(b);
  }
  const val = flat(valanceTex(), 4.3, .63, { thick: .02, back: '#08102e' }); val.position.set(0, 2.33, .44); th.add(val);
  const drapeMat = new THREE.MeshPhysicalMaterial({ color: '#1F3A9C', roughness: .75, sheen: 1, sheenColor: new THREE.Color('#8fb0ff'), sheenRoughness: .5, side: THREE.DoubleSide });
  const drapes = [-1, 1].map(s => {
    const geo = new THREE.PlaneGeometry(2.2, 2.6, 120, 1), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 26) * .035);
    geo.translate(-s * 1.1, 0, 0); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, drapeMat); m.castShadow = m.receiveShadow = true;
    const hem = new THREE.Mesh(new THREE.BoxGeometry(2.2, .05, .08), trimMat); hem.position.set(-s * 1.1, -1.28, 0);
    const grp = new THREE.Group(); grp.position.set(s * 2.12, 1.2, .38); grp.add(m, hem);
    const tas = new THREE.Mesh(new THREE.SphereGeometry(.05, 16, 12), trimMat); tas.position.set(-s * .1, -.2, .06); grp.add(tas);
    th.add(grp); return grp;
  });
  // velvet swags with a gold band, fringe and tassels across the top of the opening
  { const fringeGeo = new THREE.CylinderGeometry(.004, .004, .06, 4), cp = new THREE.Vector3(), v = new THREE.Vector3(), TS = 48, RS = 16;
    for (let k = 0; k < 3; k++) {
      const x0 = -2.1 + k * 1.4, pts: T3[] = [];
      for (let i = 0; i <= 16; i++) { const u = i / 16; pts.push(new THREE.Vector3(x0 + 1.4 * u, 2.52 - .25 * Math.sin(Math.PI * u), .72 + .06 * Math.sin(Math.PI * u))); }
      const curve = new THREE.CatmullRomCurve3(pts), geo = new THREE.TubeGeometry(curve, TS, .09, RS, false), p = geo.attributes.position;
      const fat = (u: number) => .3 + .8 * Math.sin(Math.PI * u);
      for (let i = 0; i <= TS; i++) { const u = i / TS; curve.getPointAt(u, cp);
        for (let j = 0; j <= RS; j++) { const idx = i * (RS + 1) + j; v.fromBufferAttribute(p, idx).sub(cp).multiplyScalar(fat(u) * (1 + .12 * Math.sin(j / RS * TAU * 5))); v.z *= .55; p.setXYZ(idx, cp.x + v.x, cp.y + v.y, cp.z + v.z); } }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, drapeMat); m.castShadow = true; th.add(m);
      const low = pts.map((q, i) => new THREE.Vector3(q.x, q.y - .09 * fat(i / 16) - .005, q.z + .015));
      const lowC = new THREE.CatmullRomCurve3(low); th.add(new THREE.Mesh(new THREE.TubeGeometry(lowC, 40, .011, 6), trimMat));
      const fr = new THREE.InstancedMesh(fringeGeo, trimMat, 36), m4 = new THREE.Matrix4();
      for (let i = 0; i < 36; i++) { lowC.getPointAt((i + .5) / 36, cp); m4.makeTranslation(cp.x, cp.y - .035, cp.z); fr.setMatrixAt(i, m4); } fr.frustumCulled = false; th.add(fr);
    }
    for (const x of [-2.1, -.7, .7, 2.1]) {
      const tg = new THREE.Group(), knot = new THREE.Mesh(new THREE.SphereGeometry(.055, 16, 12), trimMat), cord = new THREE.Mesh(new THREE.CylinderGeometry(.007, .007, .12, 6), trimMat);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(.026, 12, 8), trimMat), skirt = new THREE.Mesh(new THREE.ConeGeometry(.05, .17, 18, 1, true), new THREE.MeshStandardMaterial({ color: C.gold, metalness: .5, roughness: .55, side: THREE.DoubleSide }));
      cord.position.y = -.09; ball.position.y = -.15; skirt.position.y = -.24; tg.add(knot, cord, ball, skirt); tg.position.set(x, 2.52, .74); tg.traverse((o: T3) => { if (o.isMesh) o.castShadow = true; }); th.add(tg);
    }
  }
  // footlights
  const foot: T3[] = [];
  for (let i = 0; i < 9; i++) {
    const x = -1.8 + i * .45;
    const shell = new THREE.Mesh(new THREE.SphereGeometry(.07, 20, 10, 0, TAU, 0, Math.PI / 2), trimMat); shell.position.set(x, 0, .42); shell.rotation.x = -.3; th.add(shell);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.035, 12, 8), new THREE.MeshBasicMaterial({ color: '#FFE2A6', toneMapped: false })); bulb.position.set(x, .03, .44); th.add(bulb); foot.push(bulb);
  }
  const footLights = [-1.2, 0, 1.2].map(x => { const l = new THREE.PointLight('#FFC27A', 0, 4, 1.6); l.position.set(x, .12, .5); th.add(l); return l; });
  // pillars + paper lanterns
  const shaftMat = new THREE.MeshStandardMaterial({ map: tex(fluteTex()), roughness: .5 });
  const lanT = tex(lanternTex()), lanMat = new THREE.MeshStandardMaterial({ map: lanT, emissiveMap: lanT, emissive: '#ffffff', emissiveIntensity: 0, roughness: .8 });
  const capMat = new THREE.MeshStandardMaterial({ color: '#7a1f4a' }), tasMat = new THREE.MeshStandardMaterial({ color: C.gold, metalness: .6, roughness: .4 });
  const lanterns: T3[] = [];
  for (const s of [-1, 1]) {
    const x = s * 2.5;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.12, .13, 2.15, 32), shaftMat); shaft.position.set(x, 1.12, .82); shaft.castShadow = shaft.receiveShadow = true; th.add(shaft);
    for (const [y, r] of [[2.24, .17], [2.32, .15], [.06, .18], [-.02, .2]] as const) { const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .07, 32), trimMat); ring.position.set(x, y, .82); ring.castShadow = true; th.add(ring); }
    for (const k of [-1, 1]) { const vol = new THREE.Mesh(new THREE.TorusGeometry(.05, .016, 10, 24), trimMat); vol.position.set(x + k * .14, 2.26, .9); th.add(vol); }
    const lan = new THREE.Mesh(new THREE.SphereGeometry(.13, 32, 20), lanMat); lan.scale.set(1, 1.22, 1); lan.position.set(x - s * .02, 1.86, 1.0); th.add(lan); lanterns.push(lan);
    for (const y of [1.7, 2.02]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .03, 20), capMat); cap.position.set(x - s * .02, y, 1.0); th.add(cap); }
    const tas = new THREE.Mesh(new THREE.ConeGeometry(.025, .14, 10), tasMat); tas.rotation.x = Math.PI; tas.position.set(x - s * .02, 1.6, 1.0); th.add(tas);
  }
  const lanternLights: T3[] = []; // the lanterns glow by emission; a point light each cost more than it showed
  // lantern garlands
  const garland: T3[] = [], garLines: T3[] = [];
  const lineMat = new THREE.MeshBasicMaterial({ color: '#3a2a20' });
  for (const [z, y0, sag, n, sc] of [[.28, 2.2, .2, 15, 1], [-1.35, 2.45, .28, 19, .85]] as const) {
    const pts: T3[] = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), x = lerp(-1.95, 1.95, u), y = y0 - sag * (1 - Math.pow(2 * u - 1, 2));
      pts.push(new THREE.Vector3(x, y, z));
      const col = i % 3 === 0 ? '#FFD27A' : i % 3 === 1 ? '#FF9EC8' : '#FFF1C9';
      const m = new THREE.Mesh(new THREE.SphereGeometry(.038 * sc, 16, 12), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0, roughness: .7 }));
      m.scale.y = 1.25; m.position.set(x, y - .05 * sc, z); m.userData.front = z > 0; th.add(m); garland.push(m);
    }
    const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, .0025, 4), lineMat); line.userData.front = z > 0; th.add(line); garLines.push(line);
  }
  // stars on strings
  const sTex = tex(starTex()), starMat = cutMat(sTex, { roughness: .35, metalness: .7 }), starDepth = depthFor(sTex);
  const stars: T3[] = []; const r = rng(77);
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group(), s = .13 + r() * .14, len = .3 + r() * 1.1;
    const st = new THREE.Mesh(new THREE.PlaneGeometry(s, s), starMat); st.castShadow = true; st.customDepthMaterial = starDepth;
    const str = new THREE.Mesh(new THREE.CylinderGeometry(.002, .002, len, 4), strMat); str.position.y = len / 2 + s * .4;
    g.add(st, str); const home = new THREE.Vector3(-1.9 + r() * 3.8, 2.6 - len, -1.5 + r() * 1.5); g.position.copy(home); g.userData = { ph: r() * TAU, s, home };
    th.add(g); stars.push(g); blurList.push(g);
  }
  // moon on strings, the moon rabbit on top with mortar and mallet
  const moon = new THREE.Group();
  const mt = tex(moonTex());
  const mm = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .04, 72), [new THREE.MeshStandardMaterial({ color: '#E8C978', roughness: .8 }), new THREE.MeshStandardMaterial({ map: mt, roughness: .7, emissive: '#FFE6A0', emissiveIntensity: .05 }), new THREE.MeshStandardMaterial({ color: '#C9A75C' })]);
  mm.rotation.x = Math.PI / 2; mm.castShadow = true; moon.add(mm);
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: '#FFD98C', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .55 })); moonHalo.scale.set(2.3, 2.3, 1); moonHalo.position.z = -.06; moon.add(moonHalo);
  for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(.003, .003, 3, 4), strMat); st.position.set(s * .32, 1.95, 0); moon.add(st); }
  const moonRabbit = puppet(.62); moonRabbit.position.set(-.1, .55 + .28, .04); moonRabbit.children[2].visible = false; moon.add(moonRabbit);
  const mortar = new THREE.Mesh(new THREE.CylinderGeometry(.07, .05, .09, 20), new THREE.MeshStandardMaterial({ color: C.wood })); mortar.position.set(.26, .6, .05); moon.add(mortar);
  const mallet = new THREE.Group(); const head = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .1, 12), new THREE.MeshStandardMaterial({ color: '#8a5a3c' })); head.rotation.z = Math.PI / 2;
  const hand = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .16, 6), new THREE.MeshStandardMaterial({ color: C.wood })); hand.position.y = -.08; mallet.add(head, hand); mallet.position.set(.26, .77, .05); moon.add(mallet);
  th.add(moon);
  // city flats with instanced lit windows
  const city: T3[] = [], cityWin: T3[] = [], cityWinCount: number[] = [];
  const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.35, 1.0, .55), toneMapped: false });
  [0, 1, 2, 3].forEach(L => {
    const ct = cityTex(L), k = 4.5 / 2400, fh = ct.Hc * k, f = flat(ct.c, 4.5, fh, { thick: .015, back: '#0a1030', emissive: tex(ct.e), ei: 0 });
    f.position.set(0, -3, [-1.35, -1.05, -.72, -.6][L]!); f.userData.h = fh; th.add(f); city.push(f);
    const n = Math.max(1, ct.win.length), im = new THREE.InstancedMesh(new THREE.PlaneGeometry(ct.ww * k, ct.wh * k), winMat, n), m4 = new THREE.Matrix4();
    ct.win.forEach(([x, y], i) => { m4.makeTranslation((x + ct.ww / 2) * k - 2.25, (ct.Hc - y - ct.wh / 2) * k - fh / 2, .002); im.setMatrixAt(i, m4); });
    im.instanceMatrix.needsUpdate = true; im.count = 0; im.frustumCulled = false; f.add(im); cityWin.push(im); cityWinCount.push(ct.win.length);
  });
  // an elevated railway between the town layers, and a toy train that crosses it
  const VT = viaductTex(), viaduct = flat(VT.c, 4.6, .42, { thick: .015, back: '#0a1030', emissive: tex(VT.e), ei: 0 }); viaduct.position.set(0, -.75, -.88); th.add(viaduct);
  const TT = trainTex(), train = flat(TT.c, 1.5, .28, { thick: .012, back: '#0a1030', emissive: tex(TT.e), ei: 0 }); train.position.set(3.3, .577, -.86); th.add(train);
  // main puppet
  const pup = puppet(1.25); pup.position.set(0, .66, -.45); th.add(pup);
  // washi screen + lamp + the puppet that casts the shadow
  const screenCanvas = cv(1800, 1100), screenTex = tex(screenCanvas, false);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 2.26), new THREE.MeshStandardMaterial({ map: screenTex, emissiveMap: screenTex, emissive: '#ffffff', emissiveIntensity: .42, roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: .97 }));
  screen.position.set(0, 1.18, -.25); th.add(screen);
  const sframe = new THREE.Mesh(new THREE.BoxGeometry(3.8, .06, .06), new THREE.MeshStandardMaterial({ color: '#3a2216' })); sframe.position.set(0, 1.14, 0); screen.add(sframe);
  const lamp = new THREE.Group(); const lb = new THREE.Mesh(new THREE.SphereGeometry(.07, 20, 14), new THREE.MeshBasicMaterial({ color: '#EAF2FF', toneMapped: false }));
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, 1, 4), new THREE.MeshBasicMaterial({ color: '#222' })); cord.position.y = .55; lamp.add(lb, cord);
  const lampLight = { intensity: 0 }; lamp.position.set(1.05, 1.9, -1.35); th.add(lamp);
  const shadowPup = puppet(.62); shadowPup.position.set(.35, 1.2, -.85); th.add(shadowPup);
  const parasol = new THREE.Group();
  const canMat = new THREE.MeshStandardMaterial({ color: '#C9B0EC', roughness: .8, side: THREE.DoubleSide, emissive: '#3a2a60', emissiveIntensity: .2 });
  const can = new THREE.Mesh(new THREE.ConeGeometry(.3, .12, 16, 1, true), canMat); can.position.y = .16; can.castShadow = true;
  const trim = new THREE.Mesh(new THREE.TorusGeometry(.3, .006, 6, 48), new THREE.MeshStandardMaterial({ color: '#FFF7EB' })); trim.rotation.x = Math.PI / 2; trim.position.y = .1; parasol.add(trim);
  const shf = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .42, 6), new THREE.MeshStandardMaterial({ color: C.wood })); shf.position.y = 0; shf.castShadow = true; parasol.add(can, shf);
  parasol.position.set(.05, .34, .01); parasol.rotation.z = .12; parasol.scale.setScalar(.8); shadowPup.add(parasol);
  const rod2 = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, 1.4, 6), new THREE.MeshStandardMaterial({ color: C.wood })); rod2.position.y = -.9; shadowPup.add(rod2);
  // house: raked seat rows with audience members waiting to arrive
  const seatRows: T3[] = [], audience: T3[] = [];
  const seatMat = new THREE.MeshStandardMaterial({ color: '#8E2a4c', roughness: .62 });
  const seatBack = new THREE.MeshStandardMaterial({ color: '#932a50', roughness: .6 });
  const rakeMat = new THREE.MeshStandardMaterial({ color: '#3a2152', roughness: .9 }), lipMat = new THREE.MeshStandardMaterial({ color: C.gold, metalness: .7, roughness: .35 });
  const seatGeo = new THREE.RoundedBoxGeometry(.26, .07, .21, 3, .03), backGeo = new THREE.RoundedBoxGeometry(.26, .28, .06, 3, .03), armGeo = new THREE.RoundedBoxGeometry(.035, .12, .2, 2, .012);
  const armMat = new THREE.MeshStandardMaterial({ color: '#2a1630', roughness: .6 });
  const numMats = Array.from({ length: 13 }, (_, n) => new THREE.MeshBasicMaterial({ map: tex(seatNumTex(n + 1)) }));
  const audTexs = [0, 1, 2].map(k => tex(audTex(k)));
  const aisleMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(.3, .2, .1), toneMapped: false }), aisleGeo = new THREE.SphereGeometry(.014, 8, 6);
  const audMats = audTexs.map(t => new THREE.MeshStandardMaterial({ map: t, alphaTest: .5, roughness: .9, side: THREE.DoubleSide }));
  const ar = rng(31);
  for (let row = 0; row < 8; row++) {
    const g = new THREE.Group(), z = 1.15 + row * .36, y = -.5 + row * .035;
    const rake = new THREE.Mesh(new THREE.BoxGeometry(4.6, .035 * (row + 1), .36), rakeMat); rake.position.set(0, -.5 + .0175 * (row + 1), z); rake.receiveShadow = true; g.add(rake);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(4.6, .012, .012), lipMat); lip.position.set(0, -.5 + .035 * (row + 1), z - .18); g.add(lip);
    for (const sx of [-1, 1]) { const al = new THREE.Mesh(aisleGeo, aisleMat); al.position.set(sx * 2.25, -.5 + .035 * (row + 1) + .01, z - .17); g.add(al); }
    for (let i = 0; i < 13; i++) {
      const x = -1.92 + i * .32;
      const seat = new THREE.Mesh(seatGeo, seatMat); seat.position.set(x, y + .14, z); seat.receiveShadow = true;
      const back = new THREE.Mesh(backGeo, seatBack); back.position.set(x, y + .27, z + .1); back.rotation.x = .12; back.receiveShadow = true;
      const num = new THREE.Mesh(new THREE.PlaneGeometry(.08, .04), numMats[i]); num.position.set(x, y + .37, z + .135); num.rotation.y = Math.PI; num.rotation.x = -.12;
      const arm = new THREE.Mesh(armGeo, armMat); arm.position.set(x + .16, y + .17, z + .01);
      g.add(seat, back, num, arm);
      const am = new THREE.Group(), k = Math.floor(ar() * 3);
      const silm = new THREE.Mesh(new THREE.PlaneGeometry(.24, .3), audMats[k]); silm.position.y = .15; am.add(silm);
      const pc = ['#FF7FB8', '#FFE27A', '#C8A6FF'][Math.floor(ar() * 3)]!;
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .16, 6), new THREE.MeshBasicMaterial({ color: pc, toneMapped: false }));
      pl.position.set((ar() < .5 ? -1 : 1) * .09, .32, -.01); am.add(pl);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: pc, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .8 })); gl.scale.set(.16, .16, 1); gl.position.set(pl.position.x, .39, -.01); am.add(gl);
      am.position.set(x, y + .16, z + .02); am.userData = { pl, gl, pc, order: ar() + row * .02, tilt: (ar() - .5) * .6, ph: ar() * TAU };
      g.add(am); audience.push(am);
    }
    g.userData.row = row; th.add(g); seatRows.push(g); blurList.push(g);
  }
  audience.sort((a, b) => a.userData.order - b.userData.order);
  const audLights = [0, 1].map(() => { const l = new THREE.PointLight('#ff9ad0', 0, 2.8, 1.5); th.add(l); return l; });
  const houseExtra: { chLight?: T3; chBeadMat?: T3 } = {};
  // the opera house: proscenium wall, four tiers of boxes along both sides and the back, a painted dome, a crystal chandelier, carpet
  const houseFac: T3[] = [], houseGlow: T3[] = [], houseFans: T3[] = [];
  const houseBulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(.1, .07, .04), toneMapped: false });
  { const mergeGeo = (parts: { geo: T3; m: T3 }[]) => {
      let nv = 0, ni = 0; for (const p of parts) { nv += p.geo.attributes.position.count; ni += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count; }
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni), nm = new THREE.Matrix3(), v = new THREE.Vector3();
      let ov = 0, oi = 0;
      for (const { geo, m } of parts) {
        const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv; nm.getNormalMatrix(m);
        for (let i = 0; i < P.count; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(m); pos[(ov + i) * 3] = v.x; pos[(ov + i) * 3 + 1] = v.y; pos[(ov + i) * 3 + 2] = v.z;
          v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[(ov + i) * 3] = v.x; nor[(ov + i) * 3 + 1] = v.y; nor[(ov + i) * 3 + 2] = v.z;
          if (U) { uv[(ov + i) * 2] = U.getX(i); uv[(ov + i) * 2 + 1] = U.getY(i); }
        }
        const n = geo.index ? geo.index.count : P.count; for (let i = 0; i < n; i++) idx[oi + i] = (geo.index ? geo.index.getX(i) : i) + ov;
        ov += P.count; oi += n;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1)); return g;
    };
    const fm = tex(fluteTex()); fm.wrapS = THREE.RepeatWrapping; fm.repeat.set(3, 1);
    const balMat = new THREE.MeshStandardMaterial({ map: fm, roughness: .55, side: THREE.DoubleSide }), velvet = new THREE.MeshStandardMaterial({ color: '#8a1f3c', roughness: .8 }), soffit = new THREE.MeshStandardMaterial({ color: '#4a1430', side: THREE.DoubleSide });
    const G = { front: new THREE.CylinderGeometry(.4, .4, .26, 32, 1, true, -Math.PI / 2, Math.PI), rail: new THREE.TorusGeometry(.4, .022, 8, 32, Math.PI), ring: new THREE.TorusGeometry(.4, .012, 6, 32, Math.PI), floor: new THREE.CircleGeometry(.4, 24, Math.PI, Math.PI), fan: new THREE.PlaneGeometry(.18, .23) };
    const parts: Record<string, { geo: T3; m: T3 }[]> = { front: [], rail: [], ring: [], floor: [], fan0: [], fan1: [], fan2: [] };
    const bulbPos: number[] = [], fanGlowPos: number[] = [], fanGlowCol: number[] = [], fr = rng(44), o = new THREE.Object3D(), L = new THREE.Matrix4(), M = new THREE.Matrix4(), q = new THREE.Vector3();
    const wall = (len: number, bays: number, x: number, z: number, ry: number) => {
      o.position.set(x, 0, z); o.rotation.set(0, ry, 0); o.updateMatrixWorld(true);
      const T = operaWallTex(len, bays), mat = new THREE.MeshStandardMaterial({ map: tex(T.c), emissiveMap: tex(T.e), emissive: '#ffffff', emissiveIntensity: 0, roughness: .85 });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(len, HALL.y1 - HALL.y0), mat); plane.position.set(x, (HALL.y1 + HALL.y0) / 2, z); plane.rotation.y = ry; th.add(plane); houseFac.push(mat);
      const bw = len / bays;
      for (let k = 0; k < bays; k++) for (const y0 of TIERS) {
        const lx = -len / 2 + bw * (k + .5), put = (key: string, geo: T3, lyy: number, rx = 0, lz = 0, lxx = lx) => { L.makeRotationX(rx).setPosition(lxx, lyy, lz); M.multiplyMatrices(o.matrixWorld, L); parts[key]!.push({ geo, m: M.clone() }); };
        put('front', G.front, y0 + .13); put('rail', G.rail, y0 + .27, Math.PI / 2); put('ring', G.ring, y0, Math.PI / 2); put('floor', G.floor, y0, -Math.PI / 2);
        q.set(lx, y0 + .58, .05).applyMatrix4(o.matrixWorld); bulbPos.push(q.x, q.y, q.z);
        const nf = fr() < .45 ? 0 : fr() < .5 ? 1 : 2;
        for (let f = 0; f < nf; f++) { const fx = lx + (nf === 1 ? 0 : f ? .11 : -.11); put('fan' + Math.floor(fr() * 3), G.fan, y0 + .37, 0, .2, fx); q.set(fx + (fr() < .5 ? -.07 : .07), y0 + .56, .21).applyMatrix4(o.matrixWorld); fanGlowPos.push(q.x, q.y, q.z); const pc = new THREE.Color(['#FF7FB8', '#FFE27A', '#C8A6FF'][Math.floor(fr() * 3)]!); fanGlowCol.push(pc.r, pc.g, pc.b); }
      }
    };
    const len = HALL.z1 - HALL.z0;
    for (const sx of [-1, 1]) wall(len, 5, sx * HALL.x, (HALL.z0 + HALL.z1) / 2, -sx * Math.PI / 2);
    wall(HALL.x * 2, 7, 0, HALL.z1, Math.PI);
    for (const [key, mat] of [['front', balMat], ['rail', velvet], ['ring', trimMat], ['floor', soffit]] as const) th.add(new THREE.Mesh(mergeGeo(parts[key]!), mat));
    const fans = new THREE.Group(); th.add(fans); houseFans.push(fans);
    [0, 1, 2].forEach(k => { if (parts['fan' + k]!.length) fans.add(new THREE.Mesh(mergeGeo(parts['fan' + k]!), audMats[k])); });
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fanGlowPos, 3)); fg.setAttribute('color', new THREE.Float32BufferAttribute(fanGlowCol, 3));
    const fanGlow = new THREE.Points(fg, new THREE.PointsMaterial({ map: glowT, size: .16, vertexColors: true, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false })); fanGlow.frustumCulled = false; fans.add(fanGlow);
    const nb = bulbPos.length / 3, bim = new THREE.InstancedMesh(new THREE.SphereGeometry(.026, 10, 8), houseBulbMat, nb), m4 = new THREE.Matrix4();
    for (let i = 0; i < nb; i++) { m4.makeTranslation(bulbPos[i * 3]!, bulbPos[i * 3 + 1]!, bulbPos[i * 3 + 2]!); bim.setMatrixAt(i, m4); } bim.frustumCulled = false; th.add(bim);
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bulbPos, 3));
    const bglow = new THREE.Points(bg, new THREE.PointsMaterial({ map: glowT, color: '#FFC07A', size: .42, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); bglow.frustumCulled = false; th.add(bglow); houseGlow.push(bglow);
    // proscenium wall, dome, carpet, orchestra pit rail
    const pw = new THREE.Mesh(new THREE.PlaneGeometry(HALL.x * 2, HALL.y1 - HALL.y0), new THREE.MeshStandardMaterial({ map: tex(prosWallTex(kit)), alphaTest: .5, roughness: .85 })); pw.position.set(0, (HALL.y1 + HALL.y0) / 2, HALL.z0); th.add(pw);
    const CT = ceilingTex(), cmat = new THREE.MeshStandardMaterial({ map: tex(CT.c), emissiveMap: tex(CT.e), emissive: '#ffffff', emissiveIntensity: 0, roughness: .9 }); houseFac.push(cmat);
    const ceilM = new THREE.Mesh(new THREE.PlaneGeometry(HALL.x * 2, len), cmat); ceilM.rotation.x = Math.PI / 2; ceilM.position.set(0, HALL.y1, (HALL.z0 + HALL.z1) / 2); th.add(ceilM);
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(HALL.x * 2, len), new THREE.MeshStandardMaterial({ color: '#5a1430', roughness: 1 })); carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, -.498, (HALL.z0 + HALL.z1) / 2); carpet.receiveShadow = true; th.add(carpet);
    const pit = new THREE.Mesh(new THREE.BoxGeometry(4.7, .32, .04), new THREE.MeshStandardMaterial({ map: tex(woodC), color: '#7a4a3a', roughness: .5 })); pit.position.set(0, -.34, .98); th.add(pit);
    const pitRail = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 4.7, 8), trimMat); pitRail.rotation.z = Math.PI / 2; pitRail.position.set(0, -.17, .98); th.add(pitRail);
    // the chandelier: gilt rings, drooping crystal strands, candle bulbs, one warm light
    const ch = new THREE.Group(); ch.position.set(0, 4.55, 2.4); th.add(ch);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, .9, 6), trimMat); chain.position.y = .45; ch.add(chain);
    ch.add(new THREE.Mesh(new THREE.LatheGeometry([[0, -.32], [.05, -.29], [.07, -.16], [.035, -.06], [.09, .04], [.05, .14], [0, .2]].map(([x, y]) => new THREE.Vector2(x, y)), 24), trimMat));
    const rings = [[.44, -.12, 28], [.31, .0, 22], [.19, .1, 16]] as const, beads: number[] = [], cand: number[] = [];
    for (const [rr, y, n] of rings) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, .012, 8, 48), trimMat); ring.rotation.x = Math.PI / 2; ring.position.y = y; ch.add(ring);
      for (let i = 0; i < n; i++) { const a0 = i / n * TAU, a1 = (i + 1) / n * TAU;
        for (let j = 0; j < 5; j++) { const u = (j + .5) / 5, a = lerp(a0, a1, u); beads.push(Math.cos(a) * rr, y - .07 * Math.sin(Math.PI * u) - .015, Math.sin(a) * rr); }
        for (let j = 1; j <= 3; j++) beads.push(Math.cos(a0) * rr, y - .03 - j * .03, Math.sin(a0) * rr);
        if (rr > .4 || i % 2 === 0) cand.push(Math.cos(a0) * rr, y + .05, Math.sin(a0) * rr);
      }
    }
    const chBeadMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffe6c0', emissiveIntensity: .2, metalness: .3, roughness: .12 });
    const bi = new THREE.InstancedMesh(new THREE.SphereGeometry(.011, 8, 6), chBeadMat, beads.length / 3), ci = new THREE.InstancedMesh(new THREE.SphereGeometry(.016, 8, 6), houseBulbMat, cand.length / 3);
    for (let i = 0; i < beads.length / 3; i++) { m4.makeTranslation(beads[i * 3]!, beads[i * 3 + 1]!, beads[i * 3 + 2]!); bi.setMatrixAt(i, m4); }
    for (let i = 0; i < cand.length / 3; i++) { m4.makeTranslation(cand[i * 3]!, cand[i * 3 + 1]!, cand[i * 3 + 2]!); ci.setMatrixAt(i, m4); }
    bi.frustumCulled = ci.frustumCulled = false; ch.add(bi, ci);
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cand, 3));
    const cglow = new THREE.Points(cg, new THREE.PointsMaterial({ map: glowT, color: '#FFC88A', size: .3, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); cglow.frustumCulled = false; ch.add(cglow); houseGlow.push(cglow);
    const chLight = new THREE.PointLight('#FFC88A', 0, 7.5, 1.1); chLight.position.set(0, 4.3, 2.4); th.add(chLight);
    Object.assign(houseExtra, { chLight, chBeadMat });
  }
  // spotlight, beam, pool, rim light, dust in the beam
  const spot = new THREE.SpotLight('#FFF1D6', 0, 12, .2, .45, 1.2); spot.position.set(.5, 4.2, 2.2); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -.0004;
  spot.target.position.set(0, 0, -.45); th.add(spot, spot.target);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(.55, 4.6, 48, 1, true), new THREE.MeshBasicMaterial({ map: tex(coneTex()), color: '#FFF0D0', transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.position.copy(spot.position).lerp(spot.target.position, .5); cone.lookAt(spot.target.position); cone.rotateX(-Math.PI / 2); th.add(cone);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(.55, 48), new THREE.MeshBasicMaterial({ color: '#FFE9C4', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.position.set(0, .005, -.45); th.add(pool);
  const rim = new THREE.SpotLight('#C8A6FF', 0, 6, .5, .7, 1.2); rim.position.set(.2, 2.5, -1.55); rim.target.position.set(0, .8, -.45); th.add(rim, rim.target);
  const dp: number[] = [], dr = rng(66);
  for (let i = 0; i < 420; i++) { const u = dr(), rr = Math.sqrt(dr()) * .5 * u, a = dr() * TAU; const p = spot.position.clone().lerp(spot.target.position, u); dp.push(p.x + Math.cos(a) * rr, p.y, p.z + Math.sin(a) * rr); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: '#FFF1D0', size: .012, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false })); th.add(dust);
  // paper notes on threads
  const notes = ['#FF9EC8', '#FFE27A', '#C8A6FF', '#FFFFFF', '#FF9EC8', '#C8A6FF'].map(col => {
    const t = tex(noteTex(col)), m = new THREE.Mesh(new THREE.PlaneGeometry(.16, .22), cutMat(t, { emissive: col, emissiveIntensity: .25 })); m.castShadow = true; m.customDepthMaterial = depthFor(t);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(.0015, .0015, 2, 4), strMat); str.position.y = 1.1; m.add(str); th.add(m); return m;
  });
  // petals
  const petals: T3[] = []; const pt = tex(petalTex()), pm = new THREE.MeshStandardMaterial({ map: pt, alphaTest: .5, side: THREE.DoubleSide, emissive: '#ff9ac8', emissiveIntensity: .3 }), r2 = rng(8);
  for (let i = 0; i < 90; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(.07, .07), pm); m.userData = { x: -2.2 + r2() * 4.4, y: r2() * 3, z: -1.4 + r2() * 3.2, s: r2(), sp: .3 + r2() * .5 }; th.add(m); petals.push(m); }
  // kamishibai box with the three chapter cards (the same canvases the 2D insert draws full frame)
  const kami = new THREE.Group(), wm = new THREE.MeshStandardMaterial({ map: tex(woodC), roughness: .55, color: '#c08a64' });
  for (const [w, h, d, x, y] of [[1.62, .1, .22, 0, .56], [1.62, .1, .22, 0, -.56], [.1, 1.22, .22, -.76, 0], [.1, 1.22, .22, .76, 0]] as const) { const bx = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wm); bx.position.set(x, y, 0); bx.castShadow = bx.receiveShadow = true; kami.add(bx); }
  for (const s of [-1, 1]) { const door = new THREE.Mesh(new THREE.BoxGeometry(.74, 1.02, .03), wm); door.geometry.translate(s * .37, 0, 0); door.position.set(s * .8, 0, .1); door.rotation.y = s * -.12; /* opened flat to the sides, so they never reach the drapes (z .38) when those close */ door.castShadow = true; kami.add(door); }
  const kamiCards = kit.cards.map((c, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.42, .8), new THREE.MeshBasicMaterial({ map: tex(c, false), toneMapped: false })); m.position.z = .02 - i * .004; kami.add(m); return m; });
  const kback = new THREE.Mesh(new THREE.PlaneGeometry(1.52, 1.12), new THREE.MeshStandardMaterial({ color: '#1a0e0a', roughness: 1 })); kback.position.z = -.1; kami.add(kback);
  const kstand = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .3), wm); kstand.position.set(0, -.85, -.05); kami.add(kstand);
  kami.position.set(0, 1.1, -.35); th.add(kami);
  // ground rows
  const waves = flat(wavesTex(), 4.45, .37, { thick: .012, back: '#0b1238' }); waves.position.set(0, .12, .3); th.add(waves);
  const clouds = flat(cloudsTex(), 4.7, .7, { thick: .012, back: '#3a2a60' }); clouds.position.set(0, .3, -1.5); th.add(clouds);
  // lights
  const hemi = new THREE.HemisphereLight('#6f86d8', '#1a0d22', .35); scene.add(hemi);
  const moonKey = new THREE.DirectionalLight('#9db4ff', .6); moonKey.position.set(-3, 5, 4); moonKey.castShadow = true; moonKey.shadow.mapSize.set(1024, 1024);
  Object.assign(moonKey.shadow.camera, { left: -4, right: 4, top: 4, bottom: -2, near: .5, far: 20 }); moonKey.shadow.bias = -.0005; scene.add(moonKey);
  const warm = new THREE.SpotLight('#FFC9A0', 0, 10, .5, .6, 1); warm.position.set(-1.5, 3.5, 3.2); warm.target.position.set(0, .6, -.5); warm.castShadow = true; warm.shadow.mapSize.set(1024, 1024); scene.add(warm, warm.target);
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), .04).texture; scene.environmentIntensity = .25; pmrem.dispose();
  scene.traverse((o: T3) => { if (o.isLight) { o.layers.enableAll(); if (o.shadow) o.shadow.camera.layers.enableAll(); } });
  scene.fog = new THREE.FogExp2('#0b1338', .035);

  const w: World = {
    THREE, scene, camera, renderer, th, room, pros, prosMat: pros.userData.mat, drapes, backdrop, backTex, foot, footLights, lanternLights, lanterns, garland, garLines,
    stars, moon, moonRabbit, mallet, city, cityWin, cityWinCount, pup, shadowPup, screen, screenTex, screenCanvas, fibre: fibreTex(), lamp, lampLight,
    seatRows, audience, audLights, spot, cone, pool, rim, dust, notes, petals, kami, kamiCards, waves, clouds, winLight,
    hemi, moonKey, warm, blurList, bulbs, texc, kit,
    houseBulbMat, houseGlow, houseFac, houseFans, chLight: houseExtra.chLight, chBeadMat: houseExtra.chBeadMat, train, viaduct, moonHalo, aisleMat,
  };
  // compile every shader permutation now (all objects visible, every light on) so no shot pays for it later
  resetWorld(w); footlights(w, 1); w.spot.intensity = 1; w.rim.intensity = 1; w.lampLight.intensity = 1; w.warm.intensity = 1; w.winLight.intensity = .1; w.audLights.forEach(l => l.intensity = .1);
  for (const o of [moon, screen, lamp, shadowPup, pup, kami, cone, dust, train, viaduct, ...notes, ...petals, ...audience, ...city, ...houseFans]) o.visible = true; setHouse(w, 1);
  // prepareStage renders once after build: let that render allocate the shadow maps (their ids use Math.random)
  renderer.shadowMap.needsUpdate = true;
  return w;
}

// ---------------------------------------------------------------- per-frame helpers
export function setPose(w: World, g: T3, front: PoseKey, back: PoseKey = front) {
  const id = front + '|' + back; if (g.userData.key === id) return; g.userData.key = id;
  const { f, b, h } = g.userData;
  for (const [m, key] of [[f, front + 'front'], [b, back + 'back']] as const) {
    const t = w.texc[key]!; m.material.map = t.tex; m.customDepthMaterial = t.depth; m.scale.set(h * t.aspect, h, 1);
  }
}
/** Marquee bulbs: the first `n` (0–26) lit, with an optional chase that dims every third bulb in turn. */
export function setBulbs(w: World, n: number, chase = -1) {
  w.bulbs.forEach((b, i) => { const on = i < n && !(chase >= 0 && (i + chase) % 3 === 0); b.material.color.setRGB(on ? 2.4 : .05, on ? 1.9 : .04, on ? 1.1 : .03); });
}
/** House lights: box lamps, chandelier, the dome's lamp ring, the aisle step lights; `fans` shows the audience in the boxes. */
export function setHouse(w: World, lamps: number, fans = lamps > .5) {
  w.houseBulbMat.color.setRGB(.1 + 2.1 * lamps, .07 + 1.5 * lamps, .04 + .9 * lamps);
  w.houseGlow.forEach(p => p.material.opacity = .7 * lamps);
  w.houseFac.forEach(m => m.emissiveIntensity = .85 * lamps);
  w.chLight.intensity = 2.4 * lamps; w.chBeadMat.emissiveIntensity = .15 + 1.1 * lamps;
  w.aisleMat.color.setRGB(.25 + 1.2 * lamps, .17 + .8 * lamps, .08 + .35 * lamps);
  w.houseFans.forEach(a => a.visible = fans);
}
export function setDrapes(w: World, closed: number) { w.drapes.forEach(g => { g.scale.x = lerp(.16, 1, clamp(closed)); }); }
export function footlights(w: World, a: number) {
  w.foot.forEach((b, i) => b.material.color.set(a > i / 9 ? '#FFE6B0' : '#3a2a20'));
  w.footLights.forEach(l => l.intensity = 2.2 * a);
  w.lanternLights.forEach(l => l.intensity = 1.6 * a);
  w.lanterns.forEach(l => l.material.emissiveIntensity = .9 * a);
  w.garland.forEach((g, i) => g.material.emissiveIntensity = a > i / w.garland.length ? 1.6 : .05);
}
export function setBackdrop(w: World, key: 'star' | 'foot' | 'end' | 'stage2', glow: number) {
  const m = w.backdrop.material, t = w.backTex[key]; m.map = t; m.emissiveMap = t; m.emissiveIntensity = glow;
}
export function poseStars(w: World, t: number) {
  const tt = on2(t);
  w.stars.forEach(s => { s.position.copy(s.userData.home); s.scale.setScalar(1); s.rotation.set(0, Math.sin(tt * 1.3 + s.userData.ph) * .5, Math.sin(tt * .9 + s.userData.ph) * .05); s.visible = true; });
}
export function setAudience(w: World, n: number, t: number, wave = 0) {
  w.audience.forEach((a, i) => {
    a.visible = i < n;
    const u = a.userData;
    u.pl.rotation.z = u.tilt + Math.sin(t * Math.PI + u.ph) * .25 * wave;
    a.scale.setScalar(1);
  });
  const lit = w.audience.slice(0, n), v = new w.THREE.Vector3();
  w.audLights.forEach((l, k) => { const a = lit[Math.floor((k + .5) * lit.length / w.audLights.length)]; if (!a || !n) { l.intensity = 0; return; } a.getWorldPosition(v); l.position.set(v.x, v.y + .35, v.z); l.color.set(a.userData.pc); l.intensity = .9; });
}
/** Pop the n-th arrival: scale 0.3 → 0.8 → 1.15 → 1 over four poses. */
export function popAudience(w: World, i: number, age: number) {
  const a = w.audience[i]; if (!a) return;
  const step = Math.floor(age * 12);
  a.scale.setScalar(step <= 0 ? .3 : step === 1 ? .8 : step === 2 ? 1.15 : 1);
}
export function drawScreen(w: World, u: number, tt: number) {
  // backlit washi: a moon hotspot, uneven pulp and fibres, a soft-edged shadow (the puppet is a little off the paper), a wooden kumiko lattice
  const c = w.screenCanvas, g = g2(c), cw = c.width, ch = c.height;
  const gr = g.createRadialGradient(cw * .8, ch * .2, 30, cw * .62, ch * .48, cw * .85);
  gr.addColorStop(0, '#EEF3FF'); gr.addColorStop(.28, '#B4C6EF'); gr.addColorStop(.62, '#6A84C8'); gr.addColorStop(1, '#2A3C86');
  g.fillStyle = gr; g.fillRect(0, 0, cw, ch);
  const mg = g.createRadialGradient(cw * .8, ch * .2, 0, cw * .8, ch * .2, 150); mg.addColorStop(0, 'rgba(255,255,255,.9)'); mg.addColorStop(.6, 'rgba(255,255,255,.55)'); mg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = mg; g.fillRect(0, 0, cw, ch);
  const bm = g.createLinearGradient(cw * .8, ch * .2, cw * .1, ch); bm.addColorStop(0, 'rgba(255,255,255,.22)'); bm.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = bm; g.beginPath(); g.moveTo(cw * .76, ch * .14); g.lineTo(cw * .86, ch * .26); g.lineTo(cw * .2, ch * 1.05); g.lineTo(cw * -.05, ch * .9); g.closePath(); g.fill();
  g.fillStyle = 'rgba(30,40,100,.42)';
  for (const [cx, cy, s] of [[cw * .25 + u * 160, ch * .28, 1], [cw * .55 - u * 220, ch * .55, .8]] as const) { g.beginPath(); g.ellipse(cx, cy, 160 * s, 46 * s, 0, 0, TAU); g.ellipse(cx - 90 * s, cy + 10, 90 * s, 34 * s, 0, 0, TAU); g.ellipse(cx + 100 * s, cy + 14, 80 * s, 30 * s, 0, 0, TAU); g.fill(); }
  const px = lerp(cw * .68, cw * .3, u), py = lerp(ch * .28, ch * .74, u);
  g.save(); g.translate(px, py); g.rotate(Math.sin(tt * 3) * .07); g.globalAlpha = .88; g.shadowColor = 'rgba(26,16,56,.9)'; g.shadowBlur = 7;
  const sh = w.kit.pose.moonlight!.sil, sw = 230, shh = sw * sh.height / sh.width; g.drawImage(sh, -sw / 2, -shh / 2 + 60, sw, shh);
  g.fillStyle = '#1a1038'; g.beginPath(); g.moveTo(-150, -150); g.quadraticCurveTo(0, -260, 150, -150); g.lineTo(-150, -150); g.fill(); g.fillRect(-4, -170, 8, 190);
  g.restore();
  g.drawImage(w.fibre, 0, 0);
  // kumiko: dark wood with a lit edge, a heavier middle rail
  g.lineCap = 'butt';
  for (const [lw, col, off] of [[14, '#24150e', 0], [3, 'rgba(150,110,80,.6)', -5]] as const) {
    g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
    for (let x = 0; x <= cw + 1; x += cw / 6) { g.moveTo(x + off, 0); g.lineTo(x + off, ch); }
    for (let y = 0; y <= ch + 1; y += ch / 4) { g.moveTo(0, y + off); g.lineTo(cw, y + off); }
    g.stroke();
  }
  g.fillStyle = '#24150e'; g.fillRect(0, ch / 2 - 13, cw, 26); g.fillStyle = 'rgba(150,110,80,.5)'; g.fillRect(0, ch / 2 - 13, cw, 3);
  w.screenTex.needsUpdate = true;
}
export function setCityLit(w: World, rise: number[], lit: number) {
  // each layer rises out of the stage floor until its base sits just below the floor line
  w.city.forEach((c, i) => { const h = c.userData.h; c.position.y = lerp(-h / 2 - .05, [-.9, -.85, -.8, -.11][i]! + h / 2, rise[i]!); c.userData.mat.emissiveIntensity = .55 * lit; });
  w.viaduct.visible = true; w.viaduct.position.y = lerp(-.3, .29, rise[1]!); w.viaduct.userData.mat.emissiveIntensity = 1.2 * lit;
  w.cityWin.forEach((m, i) => { m.count = Math.floor(w.cityWinCount[i]! * lit * .8); });
}
export function camSet(w: World, pos: readonly number[], look: readonly number[], fov: number) {
  w.camera.position.set(pos[0], pos[1], pos[2]); w.camera.fov = fov; w.camera.lookAt(look[0], look[1], look[2]);
}

/** Every animated property back to its rest value, so a pose never depends on the previous frame. */
export function resetWorld(w: World) {
  w.th.visible = true; w.room.visible = true;
  w.moon.visible = false; w.moon.position.set(.55, 3.2, -.95); w.moonRabbit.rotation.set(0, Math.PI, 0); w.mallet.rotation.set(0, 0, 0);
  w.city.forEach(c => { c.visible = false; c.position.y = -3; }); w.cityWin.forEach(m => m.count = 0);
  w.viaduct.visible = false; w.viaduct.position.y = -.75; w.train.visible = false; w.train.position.x = 3.3; w.train.userData.mat.emissiveIntensity = 0;
  setHouse(w, 0); w.moonHalo.material.opacity = .55;
  w.screen.visible = false; w.lamp.visible = false; w.shadowPup.visible = false; w.shadowPup.rotation.set(0, 0, 0); w.shadowPup.position.set(.35, 1.2, -.85);
  w.lampLight.intensity = 0;
  w.pup.visible = false; w.pup.position.set(0, .66, -.45); w.pup.rotation.set(0, Math.PI, 0); w.pup.scale.setScalar(1);
  w.kami.visible = false; w.kamiCards.forEach((c, i) => { c.position.x = 0; c.visible = true; c.position.z = .02 - i * .004; });
  w.cone.visible = false; w.pool.material.opacity = 0; w.dust.visible = false;
  w.audience.forEach(a => { a.visible = false; a.scale.setScalar(1); }); w.audLights.forEach(l => l.intensity = 0);
  w.notes.forEach(n => n.visible = false); w.petals.forEach(p => p.visible = false);
  footlights(w, 0); setBulbs(w, 26);
  w.spot.intensity = 0; w.warm.intensity = 0; w.rim.intensity = 0; w.winLight.intensity = 0;
  w.moonKey.intensity = .55; w.hemi.intensity = .3;
  w.prosMat.emissiveIntensity = 0;
  setBackdrop(w, 'star', 0); w.backdrop.position.y = 1.35;
  setDrapes(w, 1);
  w.stars.forEach(s => s.visible = true);
  w.seatRows.forEach(r => r.visible = true);
  w.garland.forEach(g => g.visible = true); w.garLines.forEach(l => l.visible = true);
  w.waves.visible = true; w.clouds.visible = true;
  setPose(w, w.pup, 'happy', 'moonlight'); setPose(w, w.moonRabbit, 'mooncake'); setPose(w, w.shadowPup, 'moonlight');
  w.scene.fog.density = .035; w.scene.environmentIntensity = .25;
}

// ---------------------------------------------------------------- rendering with layered depth of field
export interface RenderOpts { near?: number; far?: number; fgBlur?: number; bgBlur?: number; bloom?: number; exposure?: number; alpha?: number }
function assignLayers(w: World, near: number, far: number) {
  const cp = w.camera.position, v = new w.THREE.Vector3(), used = [0, 0, 0];
  for (const o of w.blurList) {
    if (o.userData.row !== undefined) v.set(0, -.3, 1.15 + o.userData.row * .36); else o.getWorldPosition(v);
    const d = v.distanceTo(cp);
    const L = near && d < near ? LAYER_FG : far && d > far ? LAYER_BG : LAYER_MAIN;
    if (o.userData.layer !== L) { o.userData.layer = L; o.traverse((c: T3) => c.layers.set(L)); }
    if (o.visible) used[L]!++;
  }
  return used;
}
export function render3D(ctx: FrameContext, s: Stage<World>, o: RenderOpts = {}) {
  const w = s.objects, R = s.renderer;
  const pw = Math.max(1, Math.round(W * ctx.renderScale)), ph = Math.max(1, Math.round(H * ctx.renderScale));
  if (s.surface.width !== pw || s.surface.height !== ph) R.setSize(pw, ph, false);
  w.camera.aspect = W / H; w.camera.updateProjectionMatrix();
  R.toneMappingExposure = o.exposure ?? 1;
  const near = o.near ?? 0, far = o.far ?? 0, alpha = o.alpha ?? 1;
  const used = assignLayers(w, near, far);
  R.shadowMap.needsUpdate = true;
  const pass = (layer: number) => { w.camera.layers.set(layer); R.render(w.scene, w.camera); };
  const draw = (c: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => { c.imageSmoothingQuality = 'high'; c.drawImage(s.surface, 0, 0, W, H); };
  if (far && used[LAYER_BG]) { pass(LAYER_BG); blurLayer(ctx, 'dof-bg', o.bgBlur ?? 6, draw, { alpha }); }
  pass(LAYER_MAIN);
  ctx.withCanvas(c => { c.globalAlpha = alpha; draw(c); });
  if (o.bloom) bloom(ctx, c => { c.filter = 'brightness(.55) contrast(2.6)'; draw(c); c.filter = 'none'; }, { radius: 14, strength: o.bloom * alpha, halo: .8 });
  if (near && used[LAYER_FG]) { pass(LAYER_FG); blurLayer(ctx, 'dof-fg', o.fgBlur ?? 14, draw, { alpha }); }
  w.camera.layers.set(LAYER_MAIN);
}
