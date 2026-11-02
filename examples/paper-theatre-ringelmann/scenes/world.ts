// The paper theatre (same world as 陰影心理學, 格式塔心理學 and 美即好用效應), now with one twine rope, a brass
// dynamometer and eight paper rod puppets.
// Units: 1 = 5 cm of card. x right, y up, z toward the audience. Box interior x ±6, y 0..7.6, z 0..7; back wall at z = 0,
// proscenium at z = 7. Everything is built once in setup; renderFrame only changes properties.
import type { ThreeModule } from './three.js';

type T3 = ThreeModule;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type World = Record<string, any>;
export type V3 = [number, number, number];

export const SANS = 'Noto Sans CJK TC';     // registered at 500
export const SERIF = 'Noto Serif CJK TC';   // registered at 700
export const TOP = 7.45;                    // rigging bar: every string ends here
export const ROPE_Y = 1.58;                 // rope height at the puppets' hands
export const ROPE_Z = 3.05;                 // the rope's plane (the dial's hook)
export const DIAL = { x: 4.55, y: 2.75, r: .78 };   // the big dial: face centre height and radius
export const MINI = .55;                    // scale of the four small dials (Act III)
export const ROPE_SEGS = 34, MINI_SEGS = 12;
export const COL = {
  wall: 0xE8DCC4, floor: 0xD9C8A8, side: 0xCFAE80, kraft: 0xB98A57, card: 0xCFAE80, cream: 0xEFE4CF,
  ink: 0x2C2824, inkFloor: 0x25211E, gold: 0xCFA54E, red: 0x5B2A22, thread: 0xE9E2D6,
};

export function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
function tex(THREE: T3, cv: OffscreenCanvas, repeat = 1) {
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8; return t;
}

// ---------------------------------------------------------------- baked textures
// Drawing the paper, wood and twine textures is the slowest part of opening the project. Each one is drawn once and kept
// in the browser's Cache Storage as a lossless PNG (same pixels); later opens decode those instead. A fresh browser (an
// export, a check) has no cache and simply draws them, so the film looks the same everywhere. Bump BAKE_VERSION
// whenever a generator below changes.
const BAKE_VERSION = 1, BAKE_CACHE = 'mografy-baked-textures', BAKE_PREFIX = `https://mografy.local/baked/ringelmann-effect/v${BAKE_VERSION}/`;
const baked = new Map<string, ImageBitmap>(), unbaked: [string, OffscreenCanvas][] = [];
/** In setup, before building: decode every texture baked by an earlier open. */
export async function loadBaked() {
  try {
    if (typeof caches === 'undefined') return;
    const cache = await caches.open(BAKE_CACHE);
    const keys = (await cache.keys()).filter(r => r.url.startsWith(BAKE_PREFIX));
    await Promise.all(keys.map(async r => { const res = await cache.match(r); if (res) baked.set(r.url.slice(BAKE_PREFIX.length), await createImageBitmap(await res.blob())); }));
  } catch { baked.clear(); }
}
/** At the end of setup: store what this open had to draw (in the background), and free the decoded bitmaps. */
export function storeBaked() {
  for (const b of baked.values()) b.close();
  baked.clear();
  const list = unbaked.splice(0);
  if (!list.length || typeof caches === 'undefined') return;
  void (async () => {
    try { const cache = await caches.open(BAKE_CACHE); for (const [k, c] of list) await cache.put(BAKE_PREFIX + k, new Response(await c.convertToBlob({ type: 'image/png' }))); }
    catch { /* best effort: the next open draws again */ }
  })();
}
/** A generated texture: the baked copy when there is one, otherwise drawn now and queued for baking. */
export function bake(key: string, w: number, h: number, draw: (g: OffscreenCanvasRenderingContext2D) => void) {
  const cv = new OffscreenCanvas(w, h), g = cv.getContext('2d')!, hit = baked.get(key);
  if (hit && hit.width === w && hit.height === h) { g.drawImage(hit, 0, 0); return cv; }
  draw(g); unbaked.push([key, cv]); return cv;
}

function paperCanvas(base: number, o: { seed?: number; size?: number; fiber?: number; dark?: boolean } = {}) {
  const size = o.size ?? 512, seed = o.seed ?? 1, dark = !!o.dark, fiber = o.fiber ?? .08;
  return bake(`paper-${base.toString(16)}-${seed}-${size}-${fiber}-${dark ? 1 : 0}`, size, size, g => drawPaper(g, base, size, seed, fiber, dark));
}
function drawPaper(g: OffscreenCanvasRenderingContext2D, base: number, size: number, seed: number, fiber: number, dark: boolean) {
  const r = rng(seed);
  // base colour + grain written straight into a new ImageData (reading pixels back from a canvas stalls on the GPU)
  const id = new ImageData(size, size), d = id.data, cr = base >> 16 & 255, cg = base >> 8 & 255, cb = base & 255;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - .5) * (dark ? 10 : 16); d[i] = cr + n; d[i + 1] = cg + n; d[i + 2] = cb + n; d[i + 3] = 255; }
  g.putImageData(id, 0, 0);
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
}
function woodTex(THREE: T3, seed: number, rx = 1, ry = 1, s = 1024) {
  const cv = bake(`wood-${seed}-${s}`, s, s, g => {
    const r = rng(seed);
    g.fillStyle = '#5A3E2A'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y++) { const v = Math.sin(y * .045 + Math.sin(y * .011) * 3) * .5 + .5; g.fillStyle = `rgba(${50 + v * 40},${32 + v * 24},${18 + v * 12},${.2 + r() * .1})`; g.fillRect(0, y, s, 1); }
    for (let i = 0; i < 900 * s / 1024; i++) { g.strokeStyle = `rgba(30,18,8,${.05 + r() * .08})`; g.lineWidth = .5 + r(); const y = r() * s; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(s * .3, y + (r() - .5) * 20, s * .6, y + (r() - .5) * 20, s, y + (r() - .5) * 10); g.stroke(); }
  });
  const t = tex(THREE, cv); t.repeat.set(rx, ry); return t;
}
/** Twine: two plies twisted, as stripes along the rope's length (u runs along the rope). */
function twineCanvas() {
  return bake('twine-1', 256, 64, g => {
    const r = rng(88), w = 256, h = 64;
    g.fillStyle = '#C9A877'; g.fillRect(0, 0, w, h);
    for (let x = -h; x < w + h; x += 16) {
      const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, 'rgba(90,60,30,.55)'); gr.addColorStop(.45, 'rgba(255,240,210,.25)'); gr.addColorStop(1, 'rgba(90,60,30,.5)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x, h); g.lineTo(x + h * .7, 0); g.lineTo(x + h * .7 + 16, 0); g.lineTo(x + 16, h); g.fill();
    }
    for (let i = 0; i < 300; i++) { g.strokeStyle = `rgba(${r() < .5 ? '255,240,210' : '70,45,20'},${.12 + r() * .2})`; g.lineWidth = .7; const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3 + r() * 6, y - 2 - r() * 4); g.stroke(); }
  });
}
function rectPath(THREE: T3, x0: number, y0: number, x1: number, y1: number) { const p = new THREE.Path(); p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.closePath(); return p; }

/** Needle angle for a reading: 270° sweep, measured counter-clockwise from straight up. */
export const dialAngle = (v: number, max: number) => (135 - 270 * Math.min(1.04, Math.max(-.02, v / max))) * Math.PI / 180;
function dialFace(kind: 'force' | 'sound') {
  return bake(`dial-${kind}-1`, 1024, 1024, g => {
    const s = 1024, c = s / 2, R = s * .44, max = kind === 'force' ? 800 : 100, major = kind === 'force' ? 100 : 10;
    g.drawImage(paperCanvas(0xF1E7D3, { seed: kind === 'force' ? 51 : 52 }), 0, 0, s, s);
    g.strokeStyle = '#2C2824'; g.lineWidth = 6; g.beginPath(); g.arc(c, c, R + 10, 0, 7); g.stroke();
    for (let v = 0; v <= max; v += major / 5) {
      const a = dialAngle(v, max), maj = v % major === 0, L = maj ? 62 : 30, x = -Math.sin(a), y = -Math.cos(a);
      g.strokeStyle = '#2C2824'; g.lineWidth = maj ? 8 : 4; g.beginPath(); g.moveTo(c + x * R, c + y * R); g.lineTo(c + x * (R - L), c + y * (R - L)); g.stroke();
      if (maj) { g.fillStyle = '#2C2824'; g.font = `500 ${kind === 'force' ? 62 : 58}px "${SANS}"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(v), c + x * (R - 118), c + y * (R - 118)); }
    }
    g.fillStyle = '#A86A1C'; g.font = `700 80px "${SERIF}"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(kind === 'force' ? '力' : '音量', c, c + R * .48);
    g.fillStyle = '#8A7E70'; g.font = `500 34px "${SANS}"`; g.letterSpacing = '8px'; g.fillText(kind === 'force' ? 'DYNAMOMETER' : 'SOUND LEVEL', c, c + R * .7);
  });
}

export function buildWorld(THREE: T3, scene: T3, renderer: T3): World {
  const W: World = {};
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new THREE.RoomEnvironment(), .04).texture; pmrem.dispose();
  const paper = (base: number, seed: number, o: { repeat?: number; dark?: boolean; rough?: number } = {}) =>
    new THREE.MeshStandardMaterial({ map: tex(THREE, paperCanvas(base, { seed, dark: o.dark }), o.repeat ?? 1), roughness: o.rough ?? .93, side: THREE.DoubleSide });
  const ext = (s: T3, depth = .022) => new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 40 });
  const add = (parent: T3, geo: T3, m: T3, x: number, y: number, z: number) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const brass = new THREE.MeshStandardMaterial({ color: 0x9a7438, metalness: 1, roughness: .32, envMap: env });
  const threadMat = new THREE.MeshStandardMaterial({ color: COL.thread, roughness: .8 });
  const mGold = new THREE.MeshPhysicalMaterial({ map: tex(THREE, paperCanvas(COL.gold, { seed: 45 })), metalness: .85, roughness: .32, envMap: env, envMapIntensity: 1.3, clearcoat: .3, side: THREE.DoubleSide });
  const mCard = paper(COL.card, 43), mKraft = paper(COL.kraft, 11, { repeat: 2 });
  const dowelMat = new THREE.MeshStandardMaterial({ color: 0x8a6236, roughness: .6 });
  const woodSmall = woodTex(THREE, 9, .3, .3, 256);
  const mWood = new THREE.MeshStandardMaterial({ map: woodSmall, roughness: .7 });

  // a string: a unit-height cylinder, stretched each frame from its anchor up to the rigging bar
  const strGeo = new THREE.CylinderGeometry(.007, .007, 1, 5);
  W.string = (parent: T3 = scene) => { const s = new THREE.Mesh(strGeo, threadMat); s.castShadow = true; parent.add(s); return s; };

  // ---- the theatre box ----
  const box = new THREE.Group(); scene.add(box); W.box = box;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 7.6), paper(COL.wall, 3, { repeat: 2 })); wall.position.set(0, 3.8, 0); wall.receiveShadow = true; box.add(wall);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), paper(COL.floor, 5, { repeat: 2 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 3.5); floor.receiveShadow = true; box.add(floor);
  const mSide = paper(COL.side, 9, { repeat: 1.5 });
  for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(7, 7.6), mSide); s.rotation.y = -sx * Math.PI / 2; s.position.set(sx * 6, 3.8, 3.5); s.receiveShadow = true; box.add(s); }
  add(box, new THREE.BoxGeometry(13.4, .3, 7.6), mKraft, 0, -.19, 3.6);
  add(box, new THREE.BoxGeometry(12.4, 7.9, .2), mKraft, 0, 3.8, -.16);
  for (const sx of [-1, 1]) add(box, new THREE.BoxGeometry(.2, 7.9, 7.4), mKraft, sx * 6.16, 3.8, 3.5);
  for (const z of [1, 2, 3, 4, 5]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 12, 12), dowelMat); d.rotation.z = Math.PI / 2; d.position.set(0, TOP + .05, z); d.castShadow = true; box.add(d); }

  // Act II: ink paper laid over the wall, floor and sides (switched while a full-frame 2D shot covers the stage)
  W.ink = new THREE.Group(); box.add(W.ink);
  const iw = new THREE.Mesh(new THREE.PlaneGeometry(12, 7.6), paper(COL.ink, 31, { dark: true, repeat: 2 })); iw.position.set(0, 3.8, .012); iw.receiveShadow = true; W.ink.add(iw);
  const ifl = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), paper(COL.inkFloor, 33, { dark: true, repeat: 2 })); ifl.rotation.x = -Math.PI / 2; ifl.position.set(0, .012, 3.5); ifl.receiveShadow = true; W.ink.add(ifl);
  const mInkSide = paper(0x332D28, 35, { dark: true, repeat: 1.5 });
  for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(7, 7.6), mInkSide); s.rotation.y = -sx * Math.PI / 2; s.position.set(sx * 5.988, 3.8, 3.5); s.receiveShadow = true; W.ink.add(s); }

  // proscenium and the gold-foil header, seen in the final pull-back
  const pro = new THREE.Shape(); pro.moveTo(-6.7, -.34); pro.lineTo(6.7, -.34); pro.lineTo(6.7, 8.9); pro.lineTo(-6.7, 8.9); pro.closePath();
  pro.holes.push(rectPath(THREE, -5.6, 0, 5.6, 6.5));
  W.pro = new THREE.Mesh(ext(pro, .16), paper(COL.red, 21, { dark: true })); W.pro.position.z = 7; W.pro.castShadow = W.pro.receiveShadow = true; box.add(W.pro);
  const tcv = new OffscreenCanvas(2400, 420), tg = tcv.getContext('2d')!;
  tg.fillStyle = '#E4C06C'; tg.textAlign = 'center'; tg.textBaseline = 'middle';
  tg.font = `700 200px "${SERIF}"`; tg.letterSpacing = '40px'; tg.fillText('林格曼效應', 1220, 165);
  tg.font = `500 56px "${SANS}"`; tg.letterSpacing = '22px'; tg.fillText('RINGELMANN EFFECT', 1211, 345);
  const tt = new THREE.CanvasTexture(tcv); tt.colorSpace = THREE.SRGBColorSpace; tt.anisotropy = 8;
  W.title = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 1.82), new THREE.MeshStandardMaterial({ map: tt, transparent: true, alphaTest: .4, metalness: .5, roughness: .3, envMap: env, emissive: 0xA07428, emissiveIntensity: .9, emissiveMap: tt }));
  W.title.position.set(0, 7.7, 7.17); box.add(W.title);
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), new THREE.MeshStandardMaterial({ map: woodTex(THREE, 77, 5, 2.5), roughness: .65 }));
  desk.rotation.x = -Math.PI / 2; desk.position.set(0, -.34, 10); desk.receiveShadow = true; scene.add(desk);
  // desk props: two coils of twine and a pencil
  const twineTex = tex(THREE, twineCanvas()); twineTex.repeat.set(1, 1);
  W.deskProps = new THREE.Group(); scene.add(W.deskProps);
  const coilTex = twineTex.clone(); coilTex.repeat.set(10, 1); coilTex.needsUpdate = true;
  const mCoil = new THREE.MeshStandardMaterial({ map: coilTex, roughness: .9 });
  const coil = add(W.deskProps, new THREE.TorusGeometry(.75, .16, 16, 60), mCoil, 9.4, -.18, 9.4); coil.rotation.x = Math.PI / 2;
  const coil2 = add(W.deskProps, new THREE.TorusGeometry(.6, .15, 16, 60), mCoil, 9.45, .1, 9.35); coil2.rotation.x = Math.PI / 2;
  const pencil = new THREE.Group(); W.deskProps.add(pencil);
  add(pencil, new THREE.CylinderGeometry(.16, .16, 5.2, 6), new THREE.MeshStandardMaterial({ color: 0xd3a23a, roughness: .5 }), 0, 0, 0);
  add(pencil, new THREE.ConeGeometry(.16, .55, 6), new THREE.MeshStandardMaterial({ color: 0xe7c9a0, roughness: .8 }), 0, 2.875, 0);
  pencil.rotation.set(Math.PI / 2, 0, 1.1); pencil.position.set(-9.4, -.18, 10.4);

  // ---- lights: one brass stand lamp, a faint fill, a room light for the pull-back ----
  {
    const g = new THREE.Group(); scene.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.34, .38, .07, 40), brass); base.position.y = .035; base.receiveShadow = true;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, 1, 16), brass);
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(.075, .085, .2, 24), brass);
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe9c8, emissive: 0xffb04a, emissiveIntensity: 9, roughness: .2 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.17, 32, 20), bulbMat); bulb.scale.set(1, 1.15, 1);
    const light = new THREE.PointLight(0xffc37a, 60, 0, 2); light.castShadow = true; light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.near = .05; light.shadow.camera.far = 60; light.shadow.bias = -.0015; light.shadow.normalBias = .02; light.shadow.radius = 5;
    const meshes = new THREE.Group(); meshes.add(base, rod, sock, bulb); g.add(meshes, light);
    W.lamp = { g, meshes, rod, sock, bulb, bulbMat, light };
  }
  W.hemi = new THREE.HemisphereLight(0xfff1dc, 0x2a1d12, .3); scene.add(W.hemi);
  W.fill = new THREE.DirectionalLight(0xcfd8ff, .14); W.fill.position.set(-6, 10, 18); scene.add(W.fill);
  W.room = new THREE.DirectionalLight(0xffc690, 1.3); W.room.position.set(14, 22, 20); W.room.castShadow = true; W.room.shadow.mapSize.set(2048, 2048);
  Object.assign(W.room.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 }); W.room.shadow.bias = -.0008; scene.add(W.room);

  // ---- ropes: chains of short twine cylinders, posed every frame along a curve (no geometry rebuilt) ----
  const segGeo = new THREE.CylinderGeometry(.055, .055, 1, 10, 1, true);
  const mRope = new THREE.MeshStandardMaterial({ map: twineTex, roughness: .9 });
  const mkRope = (n: number, radius = 1) => {
    const g = new THREE.Group(); box.add(g);
    const segs = Array.from({ length: n }, () => { const m = new THREE.Mesh(segGeo, mRope); m.castShadow = m.receiveShadow = true; m.scale.set(radius, 1, radius); g.add(m); return m; });
    const knots = Array.from({ length: n + 1 }, () => { const k = new THREE.Mesh(new THREE.SphereGeometry(.055 * radius, 10, 8), mRope); k.castShadow = true; g.add(k); return k; });
    return { g, segs, knots };
  };
  W.rope = mkRope(ROPE_SEGS);
  W.miniRopes = [0, 1, 2, 3].map(() => mkRope(MINI_SEGS));
  W.up = new THREE.Vector3(0, 1, 0); W.dir = new THREE.Vector3(); W.q = new THREE.Quaternion();

  // ---- dynamometers: post, spring barrel with a hook, brass dial; the face turns over (force ↔ sound) ----
  const faceTex = { force: tex(THREE, dialFace('force')), sound: tex(THREE, dialFace('sound')) };
  for (const t of Object.values(faceTex)) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(1, 1); }
  const needleMat = new THREE.MeshStandardMaterial({ color: 0xB0342A, roughness: .5 });
  const mkDial = (s: number) => {
    // lift: the small dials stand on a wooden column so their barrels sit at rope height
    const lift = ROPE_Y * (1 - s), outer = new THREE.Group(); box.add(outer);
    const g = new THREE.Group(); g.position.y = lift; outer.add(g);
    if (lift > 0) add(outer, new THREE.BoxGeometry(.22, lift, .22), mWood, .5 * s, lift / 2, -.25 * s);
    // the post stands behind the head's turning circle, joined to the spring barrel by a brass brace
    add(g, new THREE.BoxGeometry(.34 * s, 3.3 * s, .34 * s), mWood, .55 * s, 1.65 * s, -1.0 * s);
    add(g, new THREE.BoxGeometry(.9 * s, .12 * s, 1.3 * s), mWood, .5 * s, .06 * s, -.55 * s);
    add(g, new THREE.BoxGeometry(.08 * s, .08 * s, .95 * s), brass, .55 * s, ROPE_Y * s, -.5 * s);
    // the head turns round like a sign: force on the front, a sound meter on the back
    const head = new THREE.Group(); head.position.set(0, DIAL.y * s, 0); g.add(head);
    const back = add(head, new THREE.CylinderGeometry((DIAL.r + .04) * s, (DIAL.r + .04) * s, .1 * s, 64), brass, 0, 0, -.09 * s); back.rotation.x = Math.PI / 2;
    const side = (kind: 'force' | 'sound', flip: number, z: number) => {
      const holder = new THREE.Group(); holder.rotation.y = flip; holder.position.z = z; head.add(holder);
      add(holder, new THREE.TorusGeometry(DIAL.r * s, .07 * s, 20, 96), brass, 0, 0, 0);
      const fm = new THREE.MeshStandardMaterial({ map: faceTex[kind], roughness: .7, emissive: 0xffffff, emissiveMap: faceTex[kind], emissiveIntensity: .3 });
      const face = new THREE.Mesh(new THREE.CircleGeometry(DIAL.r * s, 96), fm); face.position.z = .012 * s; face.receiveShadow = true; holder.add(face);
      const needle = new THREE.Group(); needle.position.z = .04 * s; holder.add(needle);
      const nd = new THREE.Mesh(new THREE.BoxGeometry(.035 * s, .66 * s, .012 * s), needleMat); nd.position.y = .27 * s; nd.castShadow = true; needle.add(nd);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(.035 * s, .1 * s, 4), needleMat); tip.position.y = .64 * s; needle.add(tip);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(.06 * s, .06 * s, .05 * s, 24), brass); hub.rotation.x = Math.PI / 2; hub.position.z = .065 * s; holder.add(hub);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(DIAL.r * s, 96), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .06, roughness: .05, envMap: env, envMapIntensity: 1.5 }));
      glass.position.z = .09 * s; glass.castShadow = false; holder.add(glass);
      return needle;
    };
    const needles = { force: side('force', 0, 0), sound: side('sound', Math.PI, -.18 * s) };
    const disc = head;
    const barrel = add(g, new THREE.CylinderGeometry(.13 * s, .13 * s, .95 * s, 28), brass, -.15 * s, ROPE_Y * s, 0); barrel.rotation.z = Math.PI / 2;
    for (let i = 0; i < 6; i++) { const c = add(g, new THREE.TorusGeometry(.14 * s, .02 * s, 8, 24), brass, (-.55 + i * .08) * s, ROPE_Y * s, 0); c.rotation.y = Math.PI / 2; }
    add(g, new THREE.TorusGeometry(.08 * s, .022 * s, 10, 24, Math.PI * 1.5), brass, -.72 * s, ROPE_Y * s, 0);
    add(g, new THREE.BoxGeometry(.06 * s, (DIAL.y - ROPE_Y - DIAL.r) * s, .06 * s), brass, 0, ((DIAL.y - DIAL.r + ROPE_Y) / 2) * s, -.09 * s);   // on the turning axis
    add(g, new THREE.BoxGeometry(.65 * s, .08 * s, .08 * s), brass, .3 * s, ROPE_Y * s, -.05 * s);
    return { outer, g, disc, needles, s, hook: -.72 * s };
  };
  W.dial = mkDial(1); W.dial.outer.position.set(DIAL.x, 0, ROPE_Z);
  W.minis = [0, 1, 2, 3].map(() => mkDial(MINI));

  // ---- the gold-foil title card (S05) ----
  const gcv = new OffscreenCanvas(2000, 680), gg = gcv.getContext('2d')!;
  gg.drawImage(paperCanvas(COL.gold, { seed: 46 }), 0, 0, 2000, 680);
  gg.fillStyle = '#3A2410'; gg.textAlign = 'center'; gg.textBaseline = 'middle';
  gg.font = `700 260px "${SERIF}"`; gg.letterSpacing = '40px'; gg.fillText('林格曼效應', 1020, 300);
  gg.font = `500 70px "${SANS}"`; gg.letterSpacing = '24px'; gg.fillText('RINGELMANN EFFECT', 1012, 545);
  const gtex = new THREE.CanvasTexture(gcv); gtex.colorSpace = THREE.SRGBColorSpace; gtex.anisotropy = 8;
  const tcMat = new THREE.MeshPhysicalMaterial({ map: gtex, metalness: .75, roughness: .34, envMap: env, envMapIntensity: 1.1, clearcoat: .3 });
  W.titleCard = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.56, .03), [mGold, mGold, mGold, mGold, tcMat, mGold]); W.titleCard.castShadow = W.titleCard.receiveShadow = true; box.add(W.titleCard);
  W.titleStr = [W.string(box), W.string(box)];

  // ---- eight paper rod puppets: two arms, paper tones and heights vary; each has its own materials so it can turn
  //      into a see-through "teammate" (opacity only: no material ever changes kind) ----
  const tones = [COL.cream, 0xE6D3B3, 0xEFDCC0, 0xD9C2A0, 0xF2E6D2, 0xE2CDA8, 0xEBD9BC, 0xDCC6A4];
  const bodyTex = tones.map((c, i) => tex(THREE, paperCanvas(c, { seed: 200 + i })));
  const limbTex = tex(THREE, paperCanvas(COL.card, { seed: 220 }));
  const darkTex = tex(THREE, paperCanvas(0x3B342D, { seed: 77, dark: true }));
  const torso = new THREE.Shape();
  torso.moveTo(-.42, .55); torso.lineTo(.42, .55); torso.quadraticCurveTo(.5, 1.5, .34, 1.72); torso.quadraticCurveTo(0, 1.84, -.34, 1.72); torso.quadraticCurveTo(-.5, 1.5, -.42, .55);
  const headShape = new THREE.Shape(); headShape.absarc(0, 2.18, .32, 0, Math.PI * 2);
  const torsoGeo = ext(torso, .03), headGeo = ext(headShape, .03);
  W.puppets = tones.map((_, i) => {
    const mat = (map: T3) => new THREE.MeshStandardMaterial({ map, roughness: .93, side: THREE.DoubleSide, transparent: true, opacity: 1 });
    const mBody = mat(bodyTex[i]), mLimb = mat(limbTex), mDark = mat(darkTex), mBrass = brass.clone(); mBrass.transparent = true;
    const mWoodP = new THREE.MeshStandardMaterial({ map: woodSmall, roughness: .7, transparent: true });
    const g = new THREE.Group(); box.add(g);
    const body = new THREE.Group(); g.add(body);
    body.add(new THREE.Mesh(torsoGeo, mBody), new THREE.Mesh(headGeo, mBody));
    const neck = new THREE.Mesh(new THREE.BoxGeometry(.14, .2, .02), mBody); neck.position.set(0, 1.82, .015); body.add(neck);
    for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.16, .5, .03), mLimb); leg.position.set(sx * .16, .32, .015); body.add(leg); }
    const arms = [.36, -.36].map((ax, k) => {
      const arm = new THREE.Group(); arm.position.set(ax, 1.62, .045 - k * .03); body.add(arm);
      const am = new THREE.Mesh(new THREE.BoxGeometry(.13, .8, .02), mLimb); am.position.y = -.38; arm.add(am);
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .03, 16), mBrass); pin.rotation.x = Math.PI / 2; pin.position.set(ax, 1.62, .06 - k * .03); body.add(pin);
      return arm;
    });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .4, 8), mWoodP); rod.position.set(0, .1, -.04); g.add(rod);
    const block = new THREE.Mesh(new THREE.BoxGeometry(.5, .08, .36), mWoodP); block.position.set(0, .04, -.04); g.add(block);
    const blind = new THREE.Mesh(new THREE.BoxGeometry(.72, .16, .05), mDark); blind.position.set(0, 2.22, .03); body.add(blind);
    const phones = new THREE.Group(); body.add(phones);
    const band = new THREE.Mesh(new THREE.TorusGeometry(.38, .035, 8, 40, Math.PI), mDark); band.position.set(0, 2.18, .02); phones.add(band);
    for (const sx of [-1, 1]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .1, 24), mDark); cup.rotation.x = Math.PI / 2; cup.position.set(sx * .36, 2.15, .04); phones.add(cup); }
    g.traverse((m: T3) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    const meshes: T3[] = []; g.traverse((m: T3) => { if (m.isMesh) meshes.push(m); });
    return { g, body, arms, blind, phones, mats: [mBody, mLimb, mDark, mBrass, mWoodP], meshes, h: .94 + ((i * 37) % 11) / 100, ghost: -1 };
  });

  W.v = new THREE.Vector3(); W.v2 = new THREE.Vector3();
  return W;
}

// ---------------------------------------------------------------- post: depth of field, grade, grain (as in 格式塔心理學)
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
