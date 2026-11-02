// The paper theatre (same world as 陰影心理學 and 格式塔心理學), now with two cardboard ATMs whose screens are a 2D layer.
// Units: 1 = 5 cm of card. x right, y up, z toward the audience. Box interior x ±6, y 0..7.6, z 0..7; back wall at z = 0,
// proscenium at z = 7. Everything is built once in setup; renderFrame only changes properties.
import type { ThreeModule } from './three.js';
import { SANS, SERIF, skin, rng } from './ui.js';

type T3 = ThreeModule;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type World = Record<string, any>;
export type V3 = [number, number, number];

export const TOP = 7.45;                 // rigging bar: every string ends here
export const SCREEN_W = 1024, SCREEN_H = 672;
export const EYE: V3 = [0, 3.7, 10.6];   // S12–S13: the viewer's eye, where the lamp stands so the skin's shadow covers the wireframe
export const FRONT_Z = 4.3, BACK_Z = 1.0;
export const BACK_SCALE = (EYE[2] - BACK_Z) / (EYE[2] - FRONT_Z);
export const COL = {
  wall: 0xE8DCC4, floor: 0xD9C8A8, side: 0xCFAE80, kraft: 0xB98A57, card: 0xCFAE80, cream: 0xEFE4CF,
  ink: 0x2C2824, inkFloor: 0x25211E, gold: 0xCFA54E, red: 0x5B2A22, thread: 0xE9E2D6,
};

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
function tex(THREE: T3, cv: OffscreenCanvas, repeat = 1) {
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8; return t;
}
// ---------------------------------------------------------------- baked textures
// Drawing the paper and wood textures is the slowest part of opening the project. Each one is drawn once and kept in
// the browser's Cache Storage as a lossless PNG (same pixels); later opens decode those instead. A fresh browser (an
// export, a check) has no cache and simply draws them, so the film looks the same everywhere. Bump BAKE_VERSION
// whenever a generator below changes.
const BAKE_VERSION = 1, BAKE_CACHE = 'mografy-baked-textures', BAKE_PREFIX = `https://mografy.local/baked/aesthetic-usability/v${BAKE_VERSION}/`;
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
  // base colour + grain written straight into a new ImageData: reading pixels back (getImageData) from an
  // accelerated canvas stalls on the GPU and cost seconds of setup every time the project opened
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
  const cv = bake(`wood-${seed}-${s}`, s, s, g => drawWood(g, seed, s));
  const t = tex(THREE, cv); t.repeat.set(rx, ry); return t;
}
function drawWood(g: OffscreenCanvasRenderingContext2D, seed: number, s: number) {
  const r = rng(seed);
  g.fillStyle = '#5A3E2A'; g.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y++) { const v = Math.sin(y * .045 + Math.sin(y * .011) * 3) * .5 + .5; g.fillStyle = `rgba(${50 + v * 40},${32 + v * 24},${18 + v * 12},${.2 + r() * .1})`; g.fillRect(0, y, s, 1); }
  for (let i = 0; i < 900; i++) { g.strokeStyle = `rgba(30,18,8,${.05 + r() * .08})`; g.lineWidth = .5 + r(); const y = r() * s; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(s * .3, y + (r() - .5) * 20, s * .6, y + (r() - .5) * 20, s, y + (r() - .5) * 10); g.stroke(); }
}
function rectPath(THREE: T3, x0: number, y0: number, x1: number, y1: number) { const p = new THREE.Path(); p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.closePath(); return p; }

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
  const mCream = paper(COL.cream, 41), mCard = paper(COL.card, 43), mKraft = paper(COL.kraft, 11, { repeat: 2 });
  const dowelMat = new THREE.MeshStandardMaterial({ color: 0x8a6236, roughness: .6 });
  W.mats = { mGold, mCream, mCard };

  // a string: a unit-height cylinder, stretched each frame from its anchor up to the rigging bar
  const strGeo = new THREE.CylinderGeometry(.007, .007, 1, 5);
  W.string = (parent: T3 = scene) => { const s = new THREE.Mesh(strGeo, threadMat); s.castShadow = true; parent.add(s); return s; };

  // ---- the theatre box ----
  const box = new THREE.Group(); scene.add(box); W.box = box;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 7.6), paper(COL.wall, 3, { repeat: 2 })); wall.position.set(0, 3.8, 0); wall.receiveShadow = true; box.add(wall);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), paper(COL.floor, 5, { repeat: 2 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 3.5); floor.receiveShadow = true; box.add(floor);
  const mSide = paper(COL.side, 9, { repeat: 1.5 });   // one texture for both sides (every texture is an upload when the project opens)
  for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(7, 7.6), mSide); s.rotation.y = -sx * Math.PI / 2; s.position.set(sx * 6, 3.8, 3.5); s.receiveShadow = true; box.add(s); }
  add(box, new THREE.BoxGeometry(13.4, .3, 7.6), mKraft, 0, -.19, 3.6);
  add(box, new THREE.BoxGeometry(12.4, 7.9, .2), mKraft, 0, 3.8, -.16);
  for (const sx of [-1, 1]) add(box, new THREE.BoxGeometry(.2, 7.9, 7.4), mKraft, sx * 6.16, 3.8, 3.5);
  for (const z of [1, 2, 3, 4, 5]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 12, 12), dowelMat); d.rotation.z = Math.PI / 2; d.position.set(0, TOP + .05, z); d.castShadow = true; box.add(d); }

  // Act II: ink paper laid over the wall, floor and sides
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
  tg.font = `700 200px "${SERIF}"`; tg.letterSpacing = '36px'; tg.fillText('美即好用效應', 1218, 165);
  tg.font = `500 56px "${SANS}"`; tg.letterSpacing = '22px'; tg.fillText('AESTHETIC – USABILITY EFFECT', 1211, 345);
  const tt = new THREE.CanvasTexture(tcv); tt.colorSpace = THREE.SRGBColorSpace; tt.anisotropy = 8;
  W.title = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 1.82), new THREE.MeshStandardMaterial({ map: tt, transparent: true, alphaTest: .4, metalness: .5, roughness: .3, envMap: env, emissive: 0xA07428, emissiveIntensity: .9, emissiveMap: tt }));
  W.title.position.set(0, 7.7, 7.17); box.add(W.title);
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), new THREE.MeshStandardMaterial({ map: woodTex(THREE, 77, 5, 2.5), roughness: .65 }));
  desk.rotation.x = -Math.PI / 2; desk.position.set(0, -.34, 10); desk.receiveShadow = true; scene.add(desk);
  W.deskProps = new THREE.Group(); scene.add(W.deskProps);
  for (let i = 0; i < 6; i++) { const c = add(W.deskProps, new THREE.BoxGeometry(2.2, .03, 1.5), i % 2 ? mCream : mCard, 9.4, -.32 + i * .032, 9.6); c.rotation.y = .3 + (i * .07 % .2); }
  const pencil = new THREE.Group(); W.deskProps.add(pencil);
  add(pencil, new THREE.CylinderGeometry(.16, .16, 5.2, 6), new THREE.MeshStandardMaterial({ color: 0xd3a23a, roughness: .5 }), 0, 0, 0);
  add(pencil, new THREE.ConeGeometry(.16, .55, 6), new THREE.MeshStandardMaterial({ color: 0xe7c9a0, roughness: .8 }), 0, 2.875, 0);
  pencil.rotation.set(Math.PI / 2, 0, 1.1); pencil.position.set(-9.4, -.18, 10.4);

  // ---- lights: one brass stand lamp, a faint fill, a room light for the pull-back ----
  const mkLamp = () => {
    const g = new THREE.Group(); scene.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.34, .38, .07, 40), brass); base.position.y = .035; base.receiveShadow = true;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, 1, 16), brass);
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(.075, .085, .2, 24), brass);
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe9c8, emissive: 0xffb04a, emissiveIntensity: 9, roughness: .2 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.17, 32, 20), bulbMat); bulb.scale.set(1, 1.15, 1);
    const light = new THREE.PointLight(0xffc37a, 60, 0, 2); light.castShadow = true; light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.near = .05; light.shadow.camera.far = 60; light.shadow.bias = -.0015; light.shadow.normalBias = .02; light.shadow.radius = 5;
    const meshes = new THREE.Group(); meshes.add(base, rod, sock, bulb); g.add(meshes, light);
    return { g, meshes, rod, sock, bulb, bulbMat, light };
  };
  W.lamp = mkLamp();
  W.hemi = new THREE.HemisphereLight(0xfff1dc, 0x2a1d12, .3); scene.add(W.hemi);
  W.fill = new THREE.DirectionalLight(0xcfd8ff, .14); W.fill.position.set(-6, 10, 18); scene.add(W.fill);
  W.room = new THREE.DirectionalLight(0xffc690, 1.3); W.room.position.set(14, 22, 20); W.room.castShadow = true; W.room.shadow.mapSize.set(2048, 2048);
  Object.assign(W.room.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 }); W.room.shadow.bias = -.0008; scene.add(W.room);

  // ---- two cardboard ATMs; the screen is a canvas texture the 2D layer paints every frame ----
  const mSlot = paper(0x3B342D, 63, { dark: true });
  const mkATM = (kind: 'ugly' | 'pretty', seed: number) => {
    const g = new THREE.Group(); box.add(g);
    const body = mCream, trim = mCard, dark = mSlot; void seed;   // both machines share the card textures
    add(g, new THREE.BoxGeometry(2.1, 1.9, 1.3), body, 0, .95, 0);
    add(g, new THREE.BoxGeometry(2.16, .1, 1.36), trim, 0, 1.92, 0);
    const keypad = new THREE.Group(); keypad.position.set(.42, 1.86, .52); keypad.rotation.x = -.5; g.add(keypad);
    add(keypad, new THREE.BoxGeometry(.78, .05, .52), trim, 0, 0, 0);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) add(keypad, new THREE.BoxGeometry(.16, .07, .09), body, -.24 + c * .24, .04, -.18 + r * .12);
    add(g, new THREE.BoxGeometry(.6, .06, .08), dark, -.55, 1.6, .66);
    add(g, new THREE.BoxGeometry(1.0, .07, .08), dark, 0, .55, .66);
    const head = new THREE.Group(); head.position.set(0, 2.6, .05); head.rotation.x = -.2; g.add(head);
    add(head, new THREE.BoxGeometry(2.1, 1.42, .3), body, 0, 0, -.12);
    add(head, new THREE.BoxGeometry(2.1, .4, .32), trim, 0, .86, -.12);
    const canvas = new OffscreenCanvas(SCREEN_W, SCREEN_H), c2d = canvas.getContext('2d')!;
    c2d.drawImage(skin('off', SCREEN_W, SCREEN_H), 0, 0);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    map.generateMipmaps = false; map.minFilter = THREE.LinearFilter;   // re-uploaded when the screen changes: no mip rebuild
    const screenMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .86, roughness: .9, envMap: env, envMapIntensity: .15 });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 1.22), screenMat); screen.position.set(0, 0, .036); head.add(screen);
    const glow = new THREE.PointLight(0xffffff, 0, 6, 2); glow.position.set(0, -.75, 1.25); head.add(glow);
    g.traverse((m: T3) => { if (m.isMesh && m !== screen) { m.castShadow = true; m.receiveShadow = true; } });
    return { g, head, screen, screenMat, map, c2d, glow, kind, painted: '' };
  };
  W.atmL = mkATM('ugly', 61); W.atmR = mkATM('pretty', 71);

  // ---- the paper rod puppet ----
  {
    const g = new THREE.Group(); box.add(g);
    const s = new THREE.Shape();
    s.moveTo(-.42, .55); s.lineTo(.42, .55); s.quadraticCurveTo(.5, 1.5, .34, 1.72); s.quadraticCurveTo(0, 1.84, -.34, 1.72); s.quadraticCurveTo(-.5, 1.5, -.42, .55);
    const bodyG = new THREE.Group(); g.add(bodyG);
    bodyG.add(new THREE.Mesh(ext(s, .03), mCream));
    const hs = new THREE.Shape(); hs.absarc(0, 2.18, .32, 0, Math.PI * 2);
    bodyG.add(new THREE.Mesh(ext(hs, .03), mCream));
    const neck = new THREE.Mesh(new THREE.BoxGeometry(.14, .2, .02), mCream); neck.position.set(0, 1.82, .015); bodyG.add(neck);
    const legs = [-1, 1].map(sx => { const leg = new THREE.Mesh(new THREE.BoxGeometry(.16, .5, .03), mCard); leg.position.set(sx * .16, .32, .015); g.add(leg); return leg; });
    const arm = new THREE.Group(); arm.position.set(.36, 1.62, .03); bodyG.add(arm);
    const armMesh = new THREE.Mesh(new THREE.BoxGeometry(.13, .8, .02), mCard); armMesh.position.y = -.38; arm.add(armMesh);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .03, 16), brass); pin.rotation.x = Math.PI / 2; pin.position.set(.36, 1.62, .05); bodyG.add(pin);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .4, 8), dowelMat); rod.position.set(0, .1, -.04); g.add(rod);
    const block = new THREE.Mesh(new THREE.BoxGeometry(.5, .08, .36), new THREE.MeshStandardMaterial({ map: woodTex(THREE, 9, .3, .3, 256), roughness: .7 })); block.position.set(0, .04, -.04); g.add(block);
    g.traverse((m: T3) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    W.puppet = { g, bodyG, arm, legs };
  }

  // ---- 26 ATM screen cards (S04); card 6 is the pretty one the camera pulls out of ----
  W.cards = []; W.cardGroup = new THREE.Group(); box.add(W.cardGroup);
  const r = rng(5);
  for (let i = 0; i < 26; i++) {
    const row = i < 13 ? 0 : 1, col = i % 13;
    const x = -5.1 + col * .85, y = row ? 5.45 : 6.35, z = 1.1 + row * .35;
    const cv = new OffscreenCanvas(300, 200), g = cv.getContext('2d')!;
    const pick = r(), kind = i === 6 ? 'pretty' : pick < .45 ? 'ugly' : pick < .7 ? 'wire' : 'pretty';
    g.drawImage(skin(kind as 'ugly', 1024, 672), 0, 0, 300, 200);
    if (kind === 'wire') { g.fillStyle = `rgba(${150 + r() * 80},${120 + r() * 60},${90 + r() * 60},.35)`; g.fillRect(0, 0, 300, 200); }
    const ct = new THREE.CanvasTexture(cv); ct.colorSpace = THREE.SRGBColorSpace; ct.anisotropy = 4;
    const face = new THREE.MeshStandardMaterial({ map: ct, roughness: .85 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(.72, .5, .02), [mCream, mCream, mCream, mCream, face, mCream]);
    m.castShadow = m.receiveShadow = true; W.cardGroup.add(m);
    const rot: V3 = i === 6 ? [0, 0, 0] : [(r() - .5) * .08, (r() - .5) * .25, (r() - .5) * .08];
    W.cards.push({ m, s: W.string(W.cardGroup), x, y, z, rot, i });
  }

  // ---- the gold-foil title card (S05) ----
  const gcv = new OffscreenCanvas(2000, 680), gg = gcv.getContext('2d')!;
  gg.drawImage(paperCanvas(COL.gold, { seed: 46 }), 0, 0, 2000, 680);
  gg.fillStyle = '#3A2410'; gg.textAlign = 'center'; gg.textBaseline = 'middle';
  gg.font = `700 250px "${SERIF}"`; gg.letterSpacing = '30px'; gg.fillText('美即好用效應', 1015, 300);
  gg.font = `500 64px "${SANS}"`; gg.letterSpacing = '20px'; gg.fillText('AESTHETIC – USABILITY EFFECT', 1010, 540);
  const gtex = new THREE.CanvasTexture(gcv); gtex.colorSpace = THREE.SRGBColorSpace; gtex.anisotropy = 8;
  const tcMat = new THREE.MeshPhysicalMaterial({ map: gtex, metalness: .75, roughness: .34, envMap: env, envMapIntensity: 1.1, clearcoat: .3 });
  W.titleCard = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.56, .03), [mGold, mGold, mGold, mGold, tcMat, mGold]); W.titleCard.castShadow = W.titleCard.receiveShadow = true; box.add(W.titleCard);
  W.titleStr = [W.string(box), W.string(box)];

  // ---- the gold halo (S09–S10) ----
  W.halo = new THREE.Mesh(new THREE.TorusGeometry(.78, .06, 20, 96), mGold); W.halo.castShadow = W.halo.receiveShadow = true; box.add(W.halo);
  W.haloStr = [W.string(box), W.string(box), W.string(box)];
  W.haloStub = W.string(box);   // the snapped end lying on the floor

  // ---- two hanging layers (S12–S13): the pretty skin in front, the wireframe behind ----
  const sheet = (kind: 'pretty' | 'wire', w: number, h: number) => {
    const cv = new OffscreenCanvas(1024, 672); cv.getContext('2d')!.drawImage(skin(kind, 1024, 672), 0, 0);
    const st = new THREE.CanvasTexture(cv); st.colorSpace = THREE.SRGBColorSpace; st.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, .02), [mCream, mCream, mCream, mCream, new THREE.MeshStandardMaterial({ map: st, roughness: .85, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: .1 }), mCream]);
    m.castShadow = m.receiveShadow = true; box.add(m); return m;
  };
  W.sheetFront = sheet('pretty', 2.4, 1.58);
  W.sheetBack = sheet('wire', 2.4 * BACK_SCALE, 1.58 * BACK_SCALE); W.sheetBack.castShadow = false;
  W.sheetStr = [W.string(box), W.string(box), W.string(box), W.string(box)];

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
