// The paper theatre: every mesh, material, light and texture of the film, built once in setup.
// Units: 1 = 5 cm of card. x right, y up, z toward the audience. Box interior x ±6, y 0..7.6, z 0..7;
// the back wall is the plane z = 0 and the proscenium stands at z = 7.
import type { ThreeModule } from './three.js';
import { CJK_SANS, CJK_SERIF } from './cjk.js';

type T3 = ThreeModule;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type World = Record<string, any>;
export type V3 = [number, number, number];

export const TOP = 7.45;                       // rigging bar height: every string ends here
export const L_FACE: V3 = [0, 3.3, 5.0];       // the one lamp position where the fragments become a face
export const L_RUBIN: V3 = [0, 3.2, 6.0];
export const L_PRAG: V3 = [0, 3.3, 5.6];
export const C_KAN: V3 = [0, 3.25, 6.4];       // the one camera position where the three discs line up

export const COL = {
  wall: 0xE8DCC4, floor: 0xD9C8A8, side: 0xCFAE80, kraft: 0xB98A57, card: 0xCFAE80, cream: 0xEFE4CF,
  ink: 0x2C2824, inkFloor: 0x25211E, gold: 0xCFA54E, goldDot: 0xE6A33A, yarn: 0xA4523A, red: 0x5B2A22, thread: 0xE9E2D6,
};

// ---------------------------------------------------------------- seeded textures
function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
function tex(THREE: T3, cv: OffscreenCanvas, repeat = 1) {
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8; return t;
}
function noiseFill(g: OffscreenCanvasRenderingContext2D, w: number, h: number, amt: number, r: () => number) {
  const id = g.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - .5) * amt; d[i] = d[i]! + n; d[i + 1] = d[i + 1]! + n; d[i + 2] = d[i + 2]! + n; }
  g.putImageData(id, 0, 0);
}
function paperTex(THREE: T3, base: number, o: { seed?: number; size?: number; fiber?: number; repeat?: number; dark?: boolean } = {}) {
  const size = o.size ?? 512, r = rng(o.seed ?? 1), dark = !!o.dark, fiber = o.fiber ?? .08;
  const cv = new OffscreenCanvas(size, size), g = cv.getContext('2d')!;
  g.fillStyle = hex(base); g.fillRect(0, 0, size, size);
  noiseFill(g, size, size, dark ? 10 : 16, r);
  for (let i = 0; i < 46; i++) {
    const x = r() * size, y = r() * size, R = 26 + r() * 90, a = .025 + r() * .035, gr = g.createRadialGradient(x, y, 0, x, y, R);
    gr.addColorStop(0, dark ? `rgba(255,240,220,${a * .45})` : `rgba(120,90,55,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - R, y - R, 2 * R, 2 * R);
  }
  g.lineCap = 'round';
  for (let i = 0; i < size * fiber * 14; i++) {
    const x = r() * size, y = r() * size, a = r() * Math.PI * 2, L = 4 + r() * 18;
    g.strokeStyle = r() < .55 ? `rgba(255,248,235,${(dark ? .05 : .07) + r() * .09})` : `rgba(80,55,30,${.04 + r() * .07})`; g.lineWidth = .6 + r() * .7;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + .6) * L * .5, y + Math.sin(a + .6) * L * .5, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
  }
  for (let i = 0; i < size * .2; i++) { g.fillStyle = `rgba(60,40,22,${.15 + r() * .25})`; g.beginPath(); g.arc(r() * size, r() * size, .4 + r() * .8, 0, 7); g.fill(); }
  return tex(THREE, cv, o.repeat ?? 1);
}
function woodTex(THREE: T3, seed: number, rx = 1, ry = 1) {
  const s = 1024, cv = new OffscreenCanvas(s, s), g = cv.getContext('2d')!, r = rng(seed);
  g.fillStyle = '#5A3E2A'; g.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y++) { const v = Math.sin(y * .045 + Math.sin(y * .011) * 3) * .5 + .5; g.fillStyle = `rgba(${50 + v * 40},${32 + v * 24},${18 + v * 12},${.2 + r() * .1})`; g.fillRect(0, y, s, 1); }
  for (let i = 0; i < 900; i++) { g.strokeStyle = `rgba(30,18,8,${.05 + r() * .08})`; g.lineWidth = .5 + r(); const y = r() * s; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(s * .3, y + (r() - .5) * 20, s * .6, y + (r() - .5) * 20, s, y + (r() - .5) * 10); g.stroke(); }
  const t = tex(THREE, cv); t.repeat.set(rx, ry); return t;
}

// ---------------------------------------------------------------- shapes (drawn in wall coordinates)
function arcShape(THREE: T3, cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const s = new THREE.Shape(), d = Math.PI / 180;
  s.absarc(cx, cy, r1, a0 * d, a1 * d, false); s.absarc(cx, cy, r0, a1 * d, a0 * d, true); s.closePath(); return s;
}
function discShape(THREE: T3, cx: number, cy: number, r: number) { const s = new THREE.Shape(); s.absarc(cx, cy, r, 0, Math.PI * 2, false); return s; }
function pacShape(THREE: T3, cx: number, cy: number, r: number, dirDeg: number, mouth = 60) {
  const d = Math.PI / 180, s = new THREE.Shape();
  s.moveTo(cx, cy); s.absarc(cx, cy, r, (dirDeg + mouth / 2) * d, (dirDeg + 360 - mouth / 2) * d, false); s.lineTo(cx, cy); return s;
}
function rectShape(THREE: T3, x0: number, y0: number, x1: number, y1: number) {
  const s = new THREE.Shape(); s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.closePath(); return s;
}
function rectPath(THREE: T3, x0: number, y0: number, x1: number, y1: number) {
  const p = new THREE.Path(); p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.closePath(); return p;
}
function birdShape(THREE: T3, s = 1) {
  const P = [[-.46, .2], [-.3, .16], [-.16, .07], [-.05, -.01], [0, .02], [.05, -.01], [.16, .07], [.3, .16], [.46, .2],
    [.34, .06], [.2, -.04], [.08, -.12], [.02, -.2], [-.02, -.2], [-.08, -.12], [-.2, -.04], [-.34, .06]];
  const sh = new THREE.Shape();
  P.forEach(([x, y], i) => (i ? sh.lineTo(x! * s, y! * s) : sh.moveTo(x! * s, y! * s)));
  sh.closePath(); return sh;
}

/** Where a wall point p (z = 0) projects to at fraction t along the ray from L. */
export function projPoint(L: V3, p: [number, number], t: number): V3 { return [L[0] + (p[0] - L[0]) * t, L[1] + (p[1] - L[1]) * t, L[2] * (1 - t)]; }

// ---------------------------------------------------------------- the world
export function buildWorld(THREE: T3, scene: T3, renderer: T3): World {
  const W: World = {};
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new THREE.RoomEnvironment(), .04).texture; pmrem.dispose();
  const paper = (base: number, seed: number, o: { repeat?: number; dark?: boolean; rough?: number; metal?: number; env?: boolean } = {}) =>
    new THREE.MeshStandardMaterial({ map: paperTex(THREE, base, { seed, repeat: o.repeat, dark: o.dark }), roughness: o.rough ?? .93, metalness: o.metal ?? 0, envMap: o.env ? env : null, side: THREE.DoubleSide });
  const ext = (s: T3, depth = .022) => new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 48 });
  const cutout = (s: T3, m: T3, depth?: number) => { const o = new THREE.Mesh(ext(s, depth), m); o.castShadow = o.receiveShadow = true; return o; };

  const mCard = paper(COL.card, 43), mCream = paper(COL.cream, 41);
  const mGold = new THREE.MeshPhysicalMaterial({ map: paperTex(THREE, COL.gold, { seed: 45 }), metalness: .85, roughness: .32, envMap: env, envMapIntensity: 1.3, clearcoat: .3, side: THREE.DoubleSide });
  const mGoldDot = paper(COL.goldDot, 47, { rough: .7 });
  const brass = new THREE.MeshStandardMaterial({ color: 0x9a7438, metalness: 1, roughness: .32, envMap: env });
  const threadMat = new THREE.MeshStandardMaterial({ color: COL.thread, roughness: .8 });
  W.mats = { mCard, mCream, mGold, mGoldDot };

  // a string: a unit-height cylinder stretched each frame from the anchor up to the rigging bar
  const strGeo = new THREE.CylinderGeometry(.007, .007, 1, 5);
  W.string = () => { const s = new THREE.Mesh(strGeo, threadMat); s.castShadow = true; return s; };

  // ---- the theatre box ----
  const box = new THREE.Group(); scene.add(box); W.box = box;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 7.6), paper(COL.wall, 3, { repeat: 2 })); wall.position.set(0, 3.8, 0); wall.receiveShadow = true; box.add(wall);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), paper(COL.floor, 5, { repeat: 2 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 3.5); floor.receiveShadow = true; box.add(floor);
  for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(7, 7.6), paper(COL.side, 9, { repeat: 1.5 })); s.rotation.y = -sx * Math.PI / 2; s.position.set(sx * 6, 3.8, 3.5); s.receiveShadow = true; box.add(s); }
  const kraft = paper(COL.kraft, 11, { repeat: 2 });
  const add = (geo: T3, m: T3, x: number, y: number, z: number) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; box.add(o); return o; };
  add(new THREE.BoxGeometry(13.4, .3, 7.6), kraft, 0, -.19, 3.6);  // its top sits just under the floor, never coplanar (coplanar faces streak the lamp shadow)
  add(new THREE.BoxGeometry(12.4, 7.9, .2), kraft, 0, 3.8, -.16);
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(.2, 7.9, 7.4), kraft, sx * 6.16, 3.8, 3.5);
  const dowelMat = new THREE.MeshStandardMaterial({ color: 0x8a6236, roughness: .6 });
  for (const z of [1, 2, 3, 4, 5]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 12, 12), dowelMat); d.rotation.z = Math.PI / 2; d.position.set(0, TOP + .05, z); d.castShadow = true; box.add(d); }
  // proscenium and the gold-foil header, seen in the final pull-back
  const pro = new THREE.Shape(); pro.moveTo(-6.7, -.34); pro.lineTo(6.7, -.34); pro.lineTo(6.7, 8.9); pro.lineTo(-6.7, 8.9); pro.closePath();
  pro.holes.push(rectPath(THREE, -5.6, 0, 5.6, 6.5));
  const proMesh = new THREE.Mesh(ext(pro, .16), paper(COL.red, 21, { dark: true })); proMesh.position.z = 7; proMesh.castShadow = proMesh.receiveShadow = true; box.add(proMesh); W.pro = proMesh;
  const tcv = new OffscreenCanvas(2400, 420), tg = tcv.getContext('2d')!;
  tg.fillStyle = '#E4C06C'; tg.textAlign = 'center'; tg.textBaseline = 'middle';
  tg.font = `700 210px "${CJK_SERIF}"`; tg.letterSpacing = '40px'; tg.fillText('格式塔心理學', 1220, 170);
  tg.font = `500 62px "${CJK_SANS}"`; tg.letterSpacing = '30px'; tg.fillText('GESTALT  PSYCHOLOGY', 1215, 345);
  const tt = new THREE.CanvasTexture(tcv); tt.colorSpace = THREE.SRGBColorSpace; tt.anisotropy = 8;
  const title = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 1.82), new THREE.MeshStandardMaterial({ map: tt, transparent: true, alphaTest: .4, metalness: .5, roughness: .3, envMap: env, emissive: 0xA07428, emissiveIntensity: .9, emissiveMap: tt }));
  title.position.set(0, 7.7, 7.17); box.add(title); W.title = title;
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), new THREE.MeshStandardMaterial({ map: woodTex(THREE, 77, 5, 2.5), roughness: .65 }));
  desk.rotation.x = -Math.PI / 2; desk.position.set(0, -.34, 10); desk.receiveShadow = true; scene.add(desk); W.desk = desk;

  // ---- lights: two brass stand lamps, a faint fill, a room light for the pull-back ----
  const mkLamp = () => {
    const g = new THREE.Group(); scene.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.34, .38, .07, 40), brass); base.position.y = .035; base.receiveShadow = true;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, 1, 16), brass);
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(.075, .085, .2, 24), brass);
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe9c8, emissive: 0xffb04a, emissiveIntensity: 9, roughness: .2 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.17, 32, 20), bulbMat); bulb.scale.set(1, 1.15, 1);
    const light = new THREE.PointLight(0xffb866, 34, 0, 2); light.castShadow = true; light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.near = .05; light.shadow.camera.far = 40; light.shadow.bias = -.0015; light.shadow.normalBias = .02; light.shadow.radius = 5;
    g.add(base, rod, sock, bulb, light);
    return { g, rod, sock, bulb, bulbMat, light };
  };
  W.lamp = mkLamp(); W.lamp2 = mkLamp();
  W.hemi = new THREE.HemisphereLight(0xfff1dc, 0x2a1d12, .22); scene.add(W.hemi);
  W.fill = new THREE.DirectionalLight(0xcfd8ff, .14); W.fill.position.set(-6, 10, 18); scene.add(W.fill);
  W.room = new THREE.DirectionalLight(0xffc690, 1.3); W.room.position.set(14, 22, 20); W.room.castShadow = true; W.room.shadow.mapSize.set(2048, 2048);
  Object.assign(W.room.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 }); W.room.shadow.bias = -.0008; scene.add(W.room);

  // ---- Act II: ink paper over the wall and floor ----
  W.ink = new THREE.Group(); box.add(W.ink);
  const iw = new THREE.Mesh(new THREE.PlaneGeometry(12, 7.6), paper(COL.ink, 31, { dark: true, repeat: 2 })); iw.position.set(0, 3.8, .012); iw.receiveShadow = true; W.ink.add(iw);
  const ifl = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), paper(COL.inkFloor, 33, { dark: true, repeat: 2 })); ifl.rotation.x = -Math.PI / 2; ifl.position.set(0, .012, 3.5); ifl.receiveShadow = true; W.ink.add(ifl);

  // ---- A. the face fragments: only from L_FACE do their shadows make a face ----
  W.face = new THREE.Group(); scene.add(W.face); W.facePieces = [];
  const FC = [0, 3.6], R = 1.75, RW = .24;
  const arcs = [[15, 77], [77, 138], [138, 202], [202, 262], [262, 318], [318, 375]], ts = [.32, .6, .44, .8, .52, .7];
  const piece = (shape: T3, t: number, anchor: [number, number]) => {
    const m = cutout(shape, mCard), s = W.string(); W.face.add(m, s);
    W.facePieces.push({ m, s, t, anchor });
  };
  arcs.forEach(([a0, a1], i) => { const am = (a0! + a1!) / 2 * Math.PI / 180; piece(arcShape(THREE, FC[0]!, FC[1]!, R - RW, R, a0!, a1!), ts[i]!, [FC[0]! + Math.cos(am) * R, FC[1]! + Math.sin(am) * R]); });
  piece(discShape(THREE, -.62, 4.08, .21), .64, [-.62, 4.29]);
  piece(discShape(THREE, .62, 4.08, .21), .38, [.62, 4.29]);
  piece(arcShape(THREE, 0, 3.62, .82, 1.02, 208, 332), .55, [0, 2.8]);

  // ---- B. phi phenomenon: one paper bird ----
  W.phiBird = cutout(birdShape(THREE, 1.25), mCream); W.phiStr = W.string(); scene.add(W.phiBird, W.phiStr);

  // ---- C. vase / two faces: lamp → card with a window → the vase → wall ----
  W.rubin = new THREE.Group(); scene.add(W.rubin);
  const prof: [number, number][] = [[5.1, .62], [4.6, .62], [4.38, .56], [4.18, .42], [4.02, .47], [3.86, .33], [3.74, .19], [3.62, .3], [3.56, .42],
    [3.47, .31], [3.38, .42], [3.29, .32], [3.15, .38], [3.0, .44], [2.86, .43], [2.72, .6], [2.45, .7], [1.5, .72]];
  const vs = new THREE.Shape(); vs.moveTo(prof[0]![1], prof[0]![0]);
  vs.splineThru(prof.slice(1).map(([y, w]) => new THREE.Vector2(w, y)));
  vs.lineTo(-prof[prof.length - 1]![1], prof[prof.length - 1]![0]);
  vs.splineThru(prof.slice(0, -1).reverse().map(([y, w]) => new THREE.Vector2(-w, y))); vs.closePath();
  W.vase = cutout(vs, mCard); W.vaseStr = W.string(); W.rubin.add(W.vase, W.vaseStr);
  const bs = rectShape(THREE, -17, -6.6, 17, 13); bs.holes.push(rectPath(THREE, -1.6, 1.9, 1.6, 4.7));
  W.board = cutout(bs, paper(COL.kraft, 51), .03); W.rubin.add(W.board);
  W.boardStr = [W.string(), W.string()]; W.rubin.add(...W.boardStr);

  // ---- D/E. thirty paper dots on pins (proximity, similarity) ----
  W.dots = [];
  const dotGeo = new THREE.CylinderGeometry(.16, .16, .02, 40), pinGeo = new THREE.CylinderGeometry(.018, .018, .1, 8), pinMat = new THREE.MeshStandardMaterial({ color: 0x8b7a62, roughness: .6 });
  for (let i = 0; i < 30; i++) {
    const g = new THREE.Group(); scene.add(g);
    const d = new THREE.Mesh(dotGeo, mCream); d.position.y = .13; d.castShadow = d.receiveShadow = true;
    const p = new THREE.Mesh(pinGeo, pinMat); p.position.y = .06; p.castShadow = true;
    g.add(d, p); W.dots.push({ g, d });
  }

  // ---- F. closure: three discs with a bite, aligned only from C_KAN ----
  W.kan = [];
  const TR = 1.3;
  ([[90, .36], [210, .56], [330, .76]] as const).forEach(([ang, t]) => {
    const a = ang * Math.PI / 180, vx = Math.cos(a) * TR, vy = 3.25 + Math.sin(a) * TR;
    const m = cutout(pacShape(THREE, vx, vy, .62, ang + 180, 60), mCream), s = W.string(); scene.add(m, s);
    W.kan.push({ m, s, t, anchor: [vx, vy + .62] });
  });

  // ---- G. continuity: two strands of yarn ----
  const yarnMat = new THREE.MeshStandardMaterial({ map: paperTex(THREE, COL.yarn, { seed: 71, fiber: .2 }), roughness: .98 });
  const A0 = new THREE.Vector3(-3.4, 0, 1.7), A1 = new THREE.Vector3(3.4, 0, 4.5), dir = A1.clone().sub(A0), len = dir.length(); dir.normalize();
  const perp = new THREE.Vector3(-dir.z, 0, dir.x), pa: T3[] = [], pb: T3[] = [];
  for (let i = 0; i <= 40; i++) {
    const s = i / 40, p = A0.clone().addScaledVector(dir, s * len);
    pa.push(p.clone().addScaledVector(perp, Math.sin(s * Math.PI) * .25).setY(.045));
    pb.push(p.clone().addScaledVector(perp, Math.sin(s * Math.PI * 3.2) * .75).setY(.085));
  }
  W.yarnSegs = 400; W.yarnRadial = 10;
  W.yarn = [pa, pb].map(pts => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), W.yarnSegs, .042, W.yarnRadial), yarnMat); m.castShadow = m.receiveShadow = true; scene.add(m); return m; });

  // ---- H. common fate: fifteen paper birds ----
  W.birds = [];
  const r9 = rng(91), movers = new Set(['0-1', '1-3', '2-0', '0-4', '2-2']);
  [3.0, 3.9, 4.8].forEach((y, ri) => [-2.5, -1.25, 0, 1.25, 2.5].forEach((x, ci) => {
    const b = cutout(birdShape(THREE, .95), mCream), s = W.string(); scene.add(b, s);
    const z = 1.8 + ri * .45 + (r9() - .5) * .3;
    W.birds.push({ b, s, x: x + (ri % 2 ? .45 : 0), y, z, rot: [(r9() - .5) * .25, (r9() - .5) * .5, (r9() - .5) * .08], mover: movers.has(`${ri}-${ci}`), k: ri * 5 + ci });
  }));

  // ---- I. prägnanz: a paper ring and a square frame ----
  const sq = rectShape(THREE, -.35, 2.15, 1.55, 4.05); sq.holes.push(rectPath(THREE, -.23, 2.27, 1.43, 3.93));
  W.prag = [
    { m: cutout(arcShape(THREE, -.6, 3.45, .94, 1.06, 0, 360), mCream), t: .46, anchor: [-.6, 4.51] },
    { m: cutout(sq, mCream), t: .72, anchor: [.6, 4.05] },
  ];
  W.prag.forEach((p: World) => { p.s = W.string(); scene.add(p.m, p.s); });

  // ---- props on the desk (pull-back) ----
  W.deskProps = new THREE.Group(); scene.add(W.deskProps);
  const pencil = new THREE.Group();
  pencil.add(new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, 5.2, 6), new THREE.MeshStandardMaterial({ color: 0xd3a23a, roughness: .5 })));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.16, .55, 6), new THREE.MeshStandardMaterial({ color: 0xe7c9a0, roughness: .8 })); tip.position.y = 2.875; pencil.add(tip);
  const lead = new THREE.Mesh(new THREE.ConeGeometry(.05, .16, 8), new THREE.MeshStandardMaterial({ color: 0x2a2a2a })); lead.position.y = 3.07; pencil.add(lead);
  pencil.rotation.set(Math.PI / 2, 0, -.9); pencil.position.set(9.6, -.18, 9.4); pencil.traverse((m: T3) => { if (m.isMesh) m.castShadow = true; }); W.deskProps.add(pencil);
  const rs = rng(5);
  for (let i = 0; i < 7; i++) {
    const sh = i % 3 === 0 ? discShape(THREE, 0, 0, .25 + rs() * .2) : i % 3 === 1 ? arcShape(THREE, 0, 0, .5, .72, 0, 70 + rs() * 50) : birdShape(THREE, .9);
    const m = cutout(sh, i % 2 ? mCard : mCream, .02); m.rotation.x = -Math.PI / 2; m.rotation.z = rs() * 6;
    m.position.set(-10 + rs() * 4 + (i > 3 ? 18 : 0), -.33, 8 + rs() * 4); W.deskProps.add(m);
  }

  W.v = new THREE.Vector3(); W.v2 = new THREE.Vector3(); // scratch vectors, reused every frame
  return W;
}

// ---------------------------------------------------------------- post: depth of field, grade, grain
export function makePost(THREE: T3, renderer: T3, w: number, h: number) {
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 2 });
  rt.depthTexture = new THREE.DepthTexture(w, h); rt.depthTexture.type = THREE.FloatType;
  const mat = new THREE.ShaderMaterial({
    uniforms: { tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, near: { value: .1 }, far: { value: 200 }, focus: { value: 5 }, aperture: { value: 18 }, maxBlur: { value: 22 }, res: { value: new THREE.Vector2(w, h) }, scale: { value: 1 }, seed: { value: 1 }, exposure: { value: 1 }, vig: { value: .4 }, grain: { value: .045 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `
      precision highp float; varying vec2 vUv;
      uniform sampler2D tColor, tDepth; uniform float near, far, focus, aperture, maxBlur, seed, exposure, vig, grain, scale; uniform vec2 res;
      float lin(float d){ return near*far / (far - d*(far-near)); }
      float coc(vec2 uv){ float z = lin(texture2D(tDepth, uv).x); return clamp(abs(z - focus) / z * aperture, 0., maxBlur) * scale; }
      vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14), 0., 1.); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + seed) * 43758.5453); }
      void main(){
        float c0 = coc(vUv); vec3 acc = texture2D(tColor, vUv).rgb; float wsum = 1.;
        const int N = 40; float ga = 2.39996323;
        if (c0 > .75) for (int i = 0; i < N; i++) {
          float fi = float(i); float r = sqrt((fi + .5) / float(N)) * c0; float a = fi * ga;
          vec2 uv = vUv + vec2(cos(a), sin(a)) * r / res;
          float cs = coc(uv); float w = cs >= r - .5 ? 1. : max(.0, cs / max(r, .001)) * .35;
          vec3 s = texture2D(tColor, uv).rgb; w *= 1. + dot(s, vec3(.3)) * .6;
          acc += s * w; wsum += w;
        }
        vec3 col = acc / max(wsum, .0001);
        col = aces(col * exposure);
        col = pow(col, vec3(1./2.2));
        col = mix(col, col * vec3(1.05, 1.0, .9), .55);
        col = col * .97 + vec3(.02, .014, .012);
        vec2 q = vUv - .5; col *= 1. - vig * pow(dot(q, q) * 2.2, 1.3);
        col += (hash(floor(vUv * res)) - .5) * grain;
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); const ps = new THREE.Scene(); ps.add(quad);
  const pc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    rt, mat,
    resize(pw: number, ph: number, logicalW: number) { if (rt.width !== pw || rt.height !== ph) { rt.setSize(pw, ph); mat.uniforms.res.value.set(pw, ph); } mat.uniforms.scale.value = pw / logicalW; },
    render(scene: T3, camera: T3) {
      mat.uniforms.near.value = camera.near; mat.uniforms.far.value = camera.far;
      renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(ps, pc);
    },
  };
}
