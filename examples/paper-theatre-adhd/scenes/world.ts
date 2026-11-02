// 不聽使喚的燈 — the desk paper theatre (same world as 陰影心理學 / 格式塔心理學 / 林格曼效應), rebuilt around one theatre
// spotlight on a brass track, pulled by a rope. Units: 1 = 5 cm of card. x right, y up, z toward the audience.
// Box interior x ±6, y 0..7.6, z 0..7; back wall z = 0, proscenium z = 7.
// Built once in setup; renderFrame only changes properties (ropes and beams are posed, never rebuilt).
// @ts-nocheck -- ported from the storyboard's plain-JS world
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type World = any;
export type V3 = [number, number, number];
let THREE: any;

export const SANS = 'Noto Sans CJK TC', SERIF = 'Noto Serif CJK TC';
export const TOP = 7.45, TRACK = { y: 5.95, z: 4.7 };
export const COL = { wall: 0xE8DCC4, floor: 0xD9C8A8, side: 0xCFAE80, kraft: 0xB98A57, card: 0xCFAE80, cream: 0xEFE4CF, ink: 0x2C2824, inkFloor: 0x25211E, gold: 0xCFA54E, red: 0x5B2A22, thread: 0xE9E2D6 };

export function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function tex(cv, repeat = 1) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8; return t; }
function canvas(w, h) { return new OffscreenCanvas(w, h); }

// ---------------------------------------------------------------- baked textures
// Drawing the paper, wood and twine textures is the slowest part of opening the project. Each one is drawn once and kept
// in the browser's Cache Storage as a lossless PNG (same pixels); later opens decode those instead. A fresh browser (an
// export, a check) has no cache and simply draws them, so the film looks the same everywhere. Bump BAKE_VERSION
// whenever a generator below changes.
const BAKE_VERSION = 1, BAKE_CACHE = 'mografy-baked-textures', BAKE_PREFIX = `https://mografy.local/baked/adhd-spotlight/v${BAKE_VERSION}/`;
const baked = new Map(), unbaked = [];
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
export function bake(key, w, h, draw) {
  const cv = new OffscreenCanvas(w, h), g = cv.getContext('2d')!, hit = baked.get(key);
  if (hit && hit.width === w && hit.height === h) { g.drawImage(hit, 0, 0); return cv; }
  draw(g); unbaked.push([key, cv]); return cv;
}

function paperCanvas(base, o = {}) {
  const size = o.size ?? 512, seed = o.seed ?? 1, dark = !!o.dark, fiber = o.fiber ?? .08;
  return bake(`paper-${base.toString(16)}-${seed}-${size}-${fiber}-${dark ? 1 : 0}`, size, size, g => {
  const r = rng(seed);
  const id = new ImageData(size, size), d = id.data, cr = base >> 16 & 255, cg = base >> 8 & 255, cb = base & 255;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - .5) * (dark ? 10 : 16); d[i] = cr + n; d[i + 1] = cg + n; d[i + 2] = cb + n; d[i + 3] = 255; }
  g.putImageData(id, 0, 0);
  for (let i = 0; i < 46; i++) { const x = r() * size, y = r() * size, R = 26 + r() * 90, a = .025 + r() * .035, gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, dark ? `rgba(255,240,220,${a * .45})` : `rgba(120,90,55,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - R, y - R, 2 * R, 2 * R); }
  g.lineCap = 'round';
  for (let i = 0; i < size * fiber * 14; i++) { const x = r() * size, y = r() * size, a = r() * Math.PI * 2, L = 4 + r() * 18; g.strokeStyle = r() < .55 ? `rgba(255,248,235,${(dark ? .05 : .07) + r() * .09})` : `rgba(80,55,30,${.04 + r() * .07})`; g.lineWidth = .6 + r() * .7; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + .6) * L * .5, y + Math.sin(a + .6) * L * .5, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
  for (let i = 0; i < size * .2; i++) { g.fillStyle = `rgba(60,40,22,${.15 + r() * .25})`; g.beginPath(); g.arc(r() * size, r() * size, .4 + r() * .8, 0, 7); g.fill(); }
  });
}
function woodTex(seed, rx = 1, ry = 1, s = 1024) {
  const cv = bake(`wood-${seed}-${s}`, s, s, g => { const r = rng(seed);
  g.fillStyle = '#5A3E2A'; g.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y++) { const v = Math.sin(y * .045 + Math.sin(y * .011) * 3) * .5 + .5; g.fillStyle = `rgba(${50 + v * 40},${32 + v * 24},${18 + v * 12},${.2 + r() * .1})`; g.fillRect(0, y, s, 1); }
  for (let i = 0; i < 900 * s / 1024; i++) { g.strokeStyle = `rgba(30,18,8,${.05 + r() * .08})`; g.lineWidth = .5 + r(); const y = r() * s; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(s * .3, y + (r() - .5) * 20, s * .6, y + (r() - .5) * 20, s, y + (r() - .5) * 10); g.stroke(); }
  });
  const t = tex(cv); t.repeat.set(rx, ry); return t;
}
function twineCanvas() {
  const w = 256, h = 64;
  return bake('twine', w, h, g => { const r = rng(88);
  g.fillStyle = '#C9A877'; g.fillRect(0, 0, w, h);
  for (let x = -h; x < w + h; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, 'rgba(90,60,30,.55)'); gr.addColorStop(.45, 'rgba(255,240,210,.25)'); gr.addColorStop(1, 'rgba(90,60,30,.5)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x, h); g.lineTo(x + h * .7, 0); g.lineTo(x + h * .7 + 16, 0); g.lineTo(x + 16, h); g.fill(); }
  for (let i = 0; i < 300; i++) { g.strokeStyle = `rgba(${r() < .5 ? '255,240,210' : '70,45,20'},${.12 + r() * .2})`; g.lineWidth = .7; const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3 + r() * 6, y - 2 - r() * 4); g.stroke(); }
  });
}
function rectPath(x0, y0, x1, y1) { const p = new THREE.Path(); p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.closePath(); return p; }

// punched paper tape: one row of round holes (transparent), positions come from a list in 0..1
function tapeCanvas(positions, o = {}) {
  const w = o.w ?? 2048, h = o.h ?? 96;
  return bake(`tape-${w}-${o.seed ?? 3}-${positions.length}-${(o.base ?? 0).toString(16)}`, w, h, g => {
  g.drawImage(paperCanvas(o.base ?? 0xF1E7D3, { seed: o.seed ?? 3 }), 0, 0, w, h);
  g.strokeStyle = 'rgba(60,40,22,.28)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
  // sprocket row
  g.globalCompositeOperation = 'destination-out';
  for (let x = 12; x < w; x += 24) { g.beginPath(); g.arc(x, h * .2, h * .045, 0, 7); g.fill(); }
  for (const p of positions) { g.beginPath(); g.arc(p * w, h * .6, h * .17, 0, 7); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  });
}
/** Reaction times as a tape: the same typical gap with a little noise; `slow` adds occasional long gaps (the slow tail). */
export function tapePositions(seed, noise, slow, n = 60) {
  const r = rng(seed), a = []; let x = .012;
  while (a.length < n && x < .985) {
    a.push(x);
    let gap = .022 * (1 + (r() - .5) * noise);
    if (r() < slow) gap += .024 + r() * .05;
    x += gap;
  }
  return a;
}

export function buildWorld(T, scene, renderer) {
  THREE = T;
  const W = {};
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new THREE.RoomEnvironment(), .04).texture; pmrem.dispose();
  const paper = (base, seed, o = {}) => new THREE.MeshStandardMaterial({ map: tex(paperCanvas(base, { seed, dark: o.dark }), o.repeat ?? 1), roughness: o.rough ?? .93, side: THREE.DoubleSide, ...(o.extra ?? {}) });
  const ext = (s, depth = .022) => new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 40 });
  const add = (parent, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const group = (parent = scene) => { const g = new THREE.Group(); parent.add(g); return g; };
  const label = (w, h, draw) => { const cv = canvas(w, h), g = cv.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const brass = new THREE.MeshStandardMaterial({ color: 0xB08A45, metalness: 1, roughness: .3, envMap: env, envMapIntensity: 1.1 });
  const threadMat = new THREE.MeshStandardMaterial({ color: COL.thread, roughness: .8 });
  const mGold = new THREE.MeshPhysicalMaterial({ map: tex(paperCanvas(COL.gold, { seed: 45 })), metalness: .85, roughness: .3, envMap: env, envMapIntensity: 1.4, clearcoat: .3, side: THREE.DoubleSide });
  const mCard = paper(COL.card, 43), mKraft = paper(COL.kraft, 11, { repeat: 2 }), mCream = paper(COL.cream, 44), mDarkCard = paper(0x3B342D, 77, { dark: true });
  const woodSmall = woodTex(9, .3, .3, 256);
  const mWood = new THREE.MeshStandardMaterial({ map: woodSmall, roughness: .7 });
  const strGeo = new THREE.CylinderGeometry(.008, .008, 1, 5);
  const string = (parent, a, b) => { const s = new THREE.Mesh(strGeo, threadMat); s.castShadow = true; const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A); s.position.copy(A).addScaledVector(d, .5); s.scale.y = d.length(); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); parent.add(s); return s; };
  W.brass = brass; W.mats = { paper, mGold };

  // ---- theatre box ----
  const box = group(); W.box = box;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 7.6), paper(COL.wall, 3, { repeat: 2 })); wall.position.set(0, 3.8, 0); wall.receiveShadow = true; box.add(wall);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), paper(COL.floor, 5, { repeat: 2 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 3.5); floor.receiveShadow = true; box.add(floor);
  const mSide = paper(COL.side, 9, { repeat: 1.5 }); W.sides = {};
  for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(7, 7.6), mSide); s.rotation.y = -sx * Math.PI / 2; s.position.set(sx * 6, 3.8, 3.5); s.receiveShadow = true; box.add(s); W.sides[sx] = s; }
  add(box, new THREE.BoxGeometry(13.4, .3, 7.6), mKraft, 0, -.19, 3.6);
  W.backBoard = add(box, new THREE.BoxGeometry(12.4, 7.9, .2), mKraft, 0, 3.8, -.16);
  W.outerSides = {}; for (const sx of [-1, 1]) W.outerSides[sx] = add(box, new THREE.BoxGeometry(.2, 7.9, 7.4), mKraft, sx * 6.16, 3.8, 3.5);
  W.dowels = group(box);
  for (const z of [1, 2, 3, 5]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 12, 12), mWood); d.rotation.z = Math.PI / 2; d.position.set(0, TOP + .05, z); d.castShadow = true; W.dowels.add(d); }

  // Act II ink overlay
  W.ink = group(box);
  const iw = new THREE.Mesh(new THREE.PlaneGeometry(12, 7.6), paper(COL.ink, 31, { dark: true, repeat: 2 })); iw.position.set(0, 3.8, .012); iw.receiveShadow = true; W.ink.add(iw);
  const ifl = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), paper(COL.inkFloor, 33, { dark: true, repeat: 2 })); ifl.rotation.x = -Math.PI / 2; ifl.position.set(0, .012, 3.5); ifl.receiveShadow = true; W.ink.add(ifl);
  const mInkSide = paper(0x332D28, 35, { dark: true, repeat: 1.5 }); W.inkSides = {};
  for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(7, 7.6), mInkSide); s.rotation.y = -sx * Math.PI / 2; s.position.set(sx * 5.988, 3.8, 3.5); s.receiveShadow = true; W.ink.add(s); W.inkSides[sx] = s; }

  // proscenium + gold-foil header
  const pro = new THREE.Shape(); pro.moveTo(-6.7, -.34); pro.lineTo(6.7, -.34); pro.lineTo(6.7, 8.9); pro.lineTo(-6.7, 8.9); pro.closePath(); pro.holes.push(rectPath(-5.6, 0, 5.6, 6.5));
  W.pro = new THREE.Mesh(ext(pro, .16), paper(COL.red, 21, { dark: true })); W.pro.position.z = 7; W.pro.castShadow = W.pro.receiveShadow = true; box.add(W.pro);
  const tt = label(2400, 420, (g) => { g.fillStyle = '#E4C06C'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 200px "${SERIF}"`; g.letterSpacing = '36px'; g.fillText('不聽使喚的燈', 1218, 165); g.font = `500 54px "${SANS}"`; g.letterSpacing = '20px'; g.fillText('ADHD ・ THE UNRULY SPOTLIGHT', 1210, 345); });
  W.title = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 1.82), new THREE.MeshStandardMaterial({ map: tt, transparent: true, alphaTest: .4, metalness: .5, roughness: .3, envMap: env, emissive: 0xA07428, emissiveIntensity: .9, emissiveMap: tt })); W.title.position.set(0, 7.7, 7.17); box.add(W.title);
  const deskTop = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), new THREE.MeshStandardMaterial({ map: woodTex(77, 5, 2.5), roughness: .65 })); deskTop.rotation.x = -Math.PI / 2; deskTop.position.set(0, -.34, 10); deskTop.receiveShadow = true; scene.add(deskTop); W.deskTop = deskTop;
  W.deskProps = group();
  const twineTex = tex(twineCanvas()); const coilTex = twineTex.clone(); coilTex.repeat.set(10, 1); coilTex.needsUpdate = true;
  const mCoil = new THREE.MeshStandardMaterial({ map: coilTex, roughness: .9 });
  add(W.deskProps, new THREE.TorusGeometry(.75, .16, 16, 60), mCoil, 9.4, -.18, 9.4).rotation.x = Math.PI / 2;
  add(W.deskProps, new THREE.TorusGeometry(.6, .15, 16, 60), mCoil, 9.45, .1, 9.35).rotation.x = Math.PI / 2;
  const pencil = group(W.deskProps);
  add(pencil, new THREE.CylinderGeometry(.16, .16, 5.2, 6), new THREE.MeshStandardMaterial({ color: 0xd3a23a, roughness: .5 }));
  add(pencil, new THREE.ConeGeometry(.16, .55, 6), new THREE.MeshStandardMaterial({ color: 0xe7c9a0, roughness: .8 }), 0, 2.875, 0);
  pencil.rotation.set(Math.PI / 2, 0, 1.1); pencil.position.set(-9.4, -.18, 10.4);

  // ---- light rig ----
  W.track = group(box);
  { const t = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 11.4, 16), brass); t.rotation.z = Math.PI / 2; t.position.set(0, TRACK.y, TRACK.z); t.castShadow = true; W.track.add(t);
    for (const x of [-4.8, 0, 4.8]) string(W.track, [x, TRACK.y, TRACK.z], [x, TOP, TRACK.z]); }
  W.fix = group(box);                                  // the spotlight: trolley on the track, a yoke, a head that aims
  { const f = W.fix; add(f, new THREE.BoxGeometry(.46, .1, .22), brass, 0, 0, 0);
    add(f, new THREE.TorusGeometry(.07, .02, 8, 20), brass, -.14, .06, 0); add(f, new THREE.TorusGeometry(.07, .02, 8, 20), brass, .14, .06, 0);
    add(f, new THREE.CylinderGeometry(.03, .03, .34, 10), brass, 0, -.2, 0);
    const yoke = group(f); yoke.position.y = -.44; W.yoke = yoke;
    const head = group(yoke); W.head = head;
    const mBody = new THREE.MeshStandardMaterial({ color: 0x2A2622, metalness: .4, roughness: .55, envMap: env });
    const b = add(head, new THREE.CylinderGeometry(.27, .27, .62, 40, 1, false), mBody, 0, 0, -.1); b.rotation.x = Math.PI / 2;
    const c = add(head, new THREE.CylinderGeometry(.31, .29, .12, 40, 1, true), brass, 0, 0, .24); c.rotation.x = Math.PI / 2;
    const lensMat = new THREE.MeshStandardMaterial({ color: 0xffe6bc, emissive: 0xffb65a, emissiveIntensity: 7, roughness: .25 });
    const l = new THREE.Mesh(new THREE.CircleGeometry(.27, 40), lensMat); l.position.z = .24; head.add(l); W.lens = lensMat;
    const back = add(head, new THREE.CylinderGeometry(.2, .27, .16, 40), brass, 0, 0, -.48); back.rotation.x = Math.PI / 2;
  }
  W.spot = new THREE.SpotLight(0xffcf94, 300, 0, .3, .55, 2); W.spot.castShadow = true; W.spot.shadow.mapSize.set(2048, 2048); W.spot.shadow.camera.near = .3; W.spot.shadow.camera.far = 40; W.spot.shadow.bias = -.0008; W.spot.shadow.normalBias = .02; W.spot.shadow.radius = 4; scene.add(W.spot, W.spot.target);
  W.amber = new THREE.SpotLight(0xff9a3c, 0, 0, .34, .5, 2); W.amber.castShadow = true; W.amber.shadow.mapSize.set(2048, 2048); W.amber.shadow.camera.near = .2; W.amber.shadow.camera.far = 30; W.amber.shadow.bias = -.0008; W.amber.shadow.normalBias = .02; W.amber.shadow.radius = 3; scene.add(W.amber, W.amber.target);
  W.glow = new THREE.PointLight(0xff9a3c, 0, 0, 2); W.glow.castShadow = true; W.glow.shadow.mapSize.set(1024, 1024); W.glow.shadow.bias = -.0015; W.glow.shadow.normalBias = .02; W.glow.shadow.radius = 5; scene.add(W.glow);
  W.tvGlow = new THREE.PointLight(0x9fc4ff, 0, 0, 2); scene.add(W.tvGlow);
  W.extra = [0, 1, 2].map(() => { const s = new THREE.SpotLight(0xffd2a0, 0, 0, .32, .7, 2); scene.add(s, s.target); return s; });
  W.hemi = new THREE.HemisphereLight(0xffe2bd, 0x4a3320, .3); scene.add(W.hemi);
  W.fill = new THREE.DirectionalLight(0xcfd8ff, .14); W.fill.position.set(-6, 10, 18); scene.add(W.fill);
  W.room = new THREE.DirectionalLight(0xffc690, 0); W.room.position.set(14, 22, 20); W.room.castShadow = true; W.room.shadow.mapSize.set(2048, 2048); Object.assign(W.room.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 }); W.room.shadow.bias = -.0008; scene.add(W.room);

  // visible beam: an additive cone that fades along its length, rebuilt per pose
  const beamMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { c: { value: new THREE.Color(0xffd29a) }, k: { value: .1 } },
    vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 c; uniform float k; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float e = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); float a = pow(vY, 1.5)*e*k; gl_FragColor = vec4(c*a, a); }' });
  W.beamMat = beamMat; W.beam = new THREE.Mesh(new THREE.CylinderGeometry(.12, 1, 1, 72, 1, true), beamMat); W.beam.visible = false; W.beam.renderOrder = 5; scene.add(W.beam);

  W.leakMat = beamMat.clone(); W.leakMat.uniforms.c.value = new THREE.Color(0xff9a3c); W.leakMat.uniforms.k.value = .55;
  W.leak = new THREE.Mesh(W.beam.geometry, W.leakMat); W.leak.visible = false; W.leak.renderOrder = 6; scene.add(W.leak);
  const up = new THREE.Vector3(0, 1, 0), v0 = new THREE.Vector3(), v1 = new THREE.Vector3();
  /** Aim a beam cone from a to b; `flat` squashes it into a sheet. */
  W.setBeam = (mesh, from, to, angle, flat = 1) => { v0.copy(to).sub(from); const h = v0.length(), R = Math.tan(angle) * h; mesh.position.copy(from).addScaledVector(v0, .5); mesh.scale.set(R, h, R * flat); mesh.quaternion.setFromUnitVectors(up, v0.normalize().negate()); mesh.visible = true; };

  // ---- the rope: a chain of cylinders posed along a Catmull-Rom curve (same tension as the storyboard), never rebuilt ----
  const ropeTex = twineTex.clone(); ropeTex.repeat.set(2, 1); ropeTex.needsUpdate = true;
  W.mRope = new THREE.MeshStandardMaterial({ map: ropeTex, roughness: .9 });
  const SUB = 7, SEGS = 9 * SUB, segGeo = new THREE.CylinderGeometry(.034, .034, 1, 8);
  W.rope = group(box); const segs = Array.from({ length: SEGS }, () => { const m = new THREE.Mesh(segGeo, W.mRope); m.castShadow = true; W.rope.add(m); return m; });
  const herm = (a, b, c, d, u) => { const t0 = .15 * (c - a), t1 = .15 * (d - b), u2 = u * u, u3 = u2 * u; return b + t0 * u + (-3 * b + 3 * c - 2 * t0 - t1) * u2 + (2 * b - 2 * c + t0 + t1) * u3; };
  W.setRope = (pts) => {
    const n = pts.length, P = i => pts[Math.max(0, Math.min(n - 1, i))]; let k = 0, px = pts[0][0], py = pts[0][1], pz = pts[0][2];
    for (let i = 0; i < n - 1; i++) for (let s = 1; s <= SUB && k < SEGS; s++) {
      const u = s / SUB, a = P(i - 1), b = P(i), c = P(i + 1), d = P(i + 2), x = herm(a[0], b[0], c[0], d[0], u), y = herm(a[1], b[1], c[1], d[1], u), z = herm(a[2], b[2], c[2], d[2], u), m = segs[k++];
      v0.set(x - px, y - py, z - pz); const L = v0.length() || 1e-4; m.position.set((x + px) / 2, (y + py) / 2, (z + pz) / 2); m.scale.set(1, L * 1.04, 1); v1.copy(v0).divideScalar(L); m.quaternion.setFromUnitVectors(up, v1); m.visible = true; px = x; py = y; pz = z;
    }
    for (; k < SEGS; k++) segs[k].visible = false;
  };
  W.pulley = group(box);                                // pulley at the left end of the track
  { const wh = add(W.pulley, new THREE.CylinderGeometry(.2, .2, .07, 32), brass); wh.rotation.x = Math.PI / 2; add(W.pulley, new THREE.BoxGeometry(.05, .34, .12), mWood, 0, .16, 0); }
  W.pulley.position.set(-4.3, TRACK.y - .26, TRACK.z);

  // ---- desk with the report ----
  W.set = group(box);
  const desk = group(W.set); W.desk = desk; desk.position.set(0, 0, 4.2);
  add(desk, new THREE.BoxGeometry(3.9, .1, 1.5), mKraft, 0, 1.28, 0);
  add(desk, new THREE.BoxGeometry(3.7, 1.24, .05), mCard, 0, .62, .66);
  for (const [x, z] of [[-1.8, -.6], [1.8, -.6]]) add(desk, new THREE.BoxGeometry(.1, 1.24, .1), mKraft, x, .62, z);
  const rep = group(desk); rep.position.set(.95, 1.33, .1); rep.rotation.x = -.62; W.report = rep;   // tilted toward the audience, on a small easel
  const repTex = label(760, 980, (g, w, h) => {
    g.drawImage(paperCanvas(0xF4ECDC, { seed: 61 }), 0, 0, w, h); g.fillStyle = '#2C2824'; g.textAlign = 'center'; g.font = `700 112px "${SERIF}"`; g.fillText('報告', w / 2, 170);
    g.fillStyle = 'rgba(44,40,36,.5)'; for (let i = 0; i < 9; i++) { const lw = 500 + (i * 73 % 110); g.fillRect((w - lw) / 2, 260 + i * 66, lw, 16); }
  });
  const sheet = add(rep, new THREE.BoxGeometry(.98, 1.26, .02), [mCream, mCream, mCream, mCream, new THREE.MeshStandardMaterial({ map: repTex, roughness: .9 }), mCream], 0, .62, 0);
  const tagTex = label(420, 170, (g, w, h) => { g.fillStyle = '#B0342A'; g.fillRect(0, 0, w, h); g.fillStyle = '#F7EBD8'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 92px "${SERIF}"`; g.fillText('明天交', w / 2, h / 2 + 6); });
  const tag = add(rep, new THREE.PlaneGeometry(.62, .25), new THREE.MeshStandardMaterial({ map: tagTex, roughness: .9, side: THREE.DoubleSide }), .3, .2, .03); tag.rotation.z = -.1;
  W.reportAnchor = new THREE.Vector3(0, .62, .02);

  // ---- window with a sky card, a sun on a thread and a moon ----
  const win = group(W.set); win.position.set(3.75, 4.25, .05); W.win = win;
  const fr = new THREE.Shape(); fr.moveTo(-1.42, -1.42); fr.lineTo(1.42, -1.42); fr.lineTo(1.42, 1.42); fr.lineTo(-1.42, 1.42); fr.closePath(); fr.holes.push(rectPath(-1.2, -1.2, 1.2, 1.2));
  const frame = add(win, ext(fr, .1), mKraft, 0, 0, .06);
  add(win, new THREE.BoxGeometry(.07, 2.4, .05), mKraft, 0, 0, .1); add(win, new THREE.BoxGeometry(2.4, .07, .05), mKraft, 0, 0, .1);
  W.skyNight = paper(0x263247, 41, { dark: true }); W.skyDawn = paper(0xE9A25C, 42);
  W.skyDawn.transparent = true; W.sky = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), W.skyNight); W.sky.position.z = .01; W.sky.receiveShadow = true; win.add(W.sky);
  W.skyD = new THREE.Mesh(W.sky.geometry, W.skyDawn); W.skyD.position.z = .02; win.add(W.skyD);
    W.sun = add(win, new THREE.CircleGeometry(.42, 48), new THREE.MeshStandardMaterial({ color: 0xF6C65B, emissive: 0xE69A2C, emissiveIntensity: .7, roughness: .8 }), .3, -.45, .04);
  W.moon = add(win, new THREE.CircleGeometry(.3, 48), new THREE.MeshStandardMaterial({ color: 0xF2E9D6, emissive: 0xCFC4A8, emissiveIntensity: .4, roughness: .8 }), -.45, .5, .04);
  const hill = new THREE.Shape(); hill.moveTo(-1.2, -1.2); hill.lineTo(1.2, -1.2); hill.lineTo(1.2, -.72); hill.quadraticCurveTo(.6, -.38, .05, -.8); hill.quadraticCurveTo(-.6, -.5, -1.2, -.9); hill.closePath();
  add(win, ext(hill, .012), mDarkCard, 0, 0, .05);

  // ---- paper TV on a low stand ----
  const tv = group(W.set); tv.position.set(-3.75, 0, 2.5); tv.rotation.y = .32; W.tv = tv;
  add(tv, new THREE.BoxGeometry(2.2, 1.0, .9), mKraft, 0, .5, 0);
  add(tv, new THREE.BoxGeometry(2.3, 1.6, .22), mDarkCard, 0, 1.86, 0);
  const tvTex = label(960, 640, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2A4A78'); gr.addColorStop(1, '#D98A5A'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#F4E3B5'; g.beginPath(); g.arc(700, 190, 70, 0, 7); g.fill();
    g.fillStyle = '#1E2A3A'; g.beginPath(); g.moveTo(0, h); g.lineTo(0, 470); g.quadraticCurveTo(300, 360, 560, 480); g.quadraticCurveTo(760, 420, w, 500); g.lineTo(w, h); g.fill();
    g.fillStyle = '#111A26'; g.beginPath(); g.arc(320, 400, 44, 0, 7); g.fill(); g.fillRect(278, 438, 84, 150); g.beginPath(); g.arc(500, 412, 40, 0, 7); g.fill(); g.fillRect(462, 448, 76, 140);
    g.fillStyle = 'rgba(255,255,255,.92)'; g.textAlign = 'center'; g.font = `500 44px "${SANS}"`; g.fillText('下一集　5 秒後播放', w / 2, 608);
  });
  W.tvMat = new THREE.MeshStandardMaterial({ map: tvTex, emissive: 0xffffff, emissiveMap: tvTex, emissiveIntensity: 1, roughness: .55 });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.04, 1.34), W.tvMat); scr.position.set(0, 1.86, .118); tv.add(scr);

  // ---- puppets: the paper rod puppet of the earlier films, plus two dot eyes so the gaze can tell the story ----
  const torso = new THREE.Shape(); torso.moveTo(-.42, .55); torso.lineTo(.42, .55); torso.quadraticCurveTo(.5, 1.5, .34, 1.72); torso.quadraticCurveTo(0, 1.84, -.34, 1.72); torso.quadraticCurveTo(-.5, 1.5, -.42, .55);
  const headShape = new THREE.Shape(); headShape.absarc(0, 2.18, .32, 0, Math.PI * 2);
  const torsoGeo = ext(torso, .03), headGeo = ext(headShape, .03);
  const limbTex = paper(COL.card, 220);
  const inkDot = new THREE.MeshStandardMaterial({ color: 0x241F1B, roughness: .6 });
  W.mkPuppet = (tone, seed, s = 1, parent = W.set) => {
    const mBody = paper(tone, seed), g = group(parent), body = group(g);
    body.add(new THREE.Mesh(torsoGeo, mBody), new THREE.Mesh(headGeo, mBody));
    const neck = new THREE.Mesh(new THREE.BoxGeometry(.14, .2, .02), mBody); neck.position.set(0, 1.82, .015); body.add(neck);
    const legs = [-1, 1].map(sx => { const pivot = group(body); pivot.position.set(sx * .17, .62, .03); const leg = new THREE.Mesh(new THREE.BoxGeometry(.16, .62, .03), limbTex); leg.position.y = -.31; pivot.add(leg); const foot = new THREE.Mesh(new THREE.BoxGeometry(.28, .09, .05), mDarkCard); foot.position.set(sx * .05, -.62, .01); pivot.add(foot); return pivot; });
    const arms = [.36, -.36].map((ax, k) => { const arm = group(body); arm.position.set(ax, 1.62, .045 - k * .03); const am = new THREE.Mesh(new THREE.BoxGeometry(.13, .8, .02), limbTex); am.position.y = -.38; arm.add(am); const pin = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .03, 16), brass); pin.rotation.x = Math.PI / 2; pin.position.set(ax, 1.62, .06 - k * .03); body.add(pin); return arm; });
    const eyes = [-.1, .1].map(x => { const e = new THREE.Mesh(new THREE.CircleGeometry(.034, 20), inkDot); e.position.set(x, 2.22, .034); body.add(e); return e; });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .4, 8), mWood); rod.position.set(0, .1, -.04); g.add(rod);
    const block = new THREE.Mesh(new THREE.BoxGeometry(.5, .08, .36), mWood); block.position.set(0, .04, -.04); g.add(block);
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    g.scale.setScalar(s);
    return { g, body, arms, legs, eyes, rod, block, look(dx, dy = 0) { eyes[0].position.set(-.1 + dx, 2.22 + dy, .034); eyes[1].position.set(.1 + dx, 2.22 + dy, .034); }, hand(i = 1) { const v = new THREE.Vector3(0, -.76, .02); arms[i].updateWorldMatrix(true, false); return arms[i].localToWorld(v); } };
  };
  W.me = W.mkPuppet(COL.cream, 200, 1.36);
  W.helper = W.mkPuppet(0xD9C2A0, 203, 1.3);
  W.others = [0xE6D3B3, 0xEFDCC0, 0xE2CDA8].map((c, i) => W.mkPuppet(c, 204 + i, 1.0));
  W.kid = W.mkPuppet(0xF2E6D2, 208, 1.0);

  // ---- S03: the labels hanging over the puppet ----
  W.labels = group(box);
  const sign = (txt, x, y, z, w, ry, seed, blank) => {
    const g = group(W.labels), h = w * .52, t = label(1024, Math.round(1024 * .52), (c, cw, ch) => { c.drawImage(paperCanvas(0xC79A63, { seed }), 0, 0, cw, ch); c.strokeStyle = 'rgba(44,30,20,.5)'; c.lineWidth = 8; c.strokeRect(24, 24, cw - 48, ch - 48); if (txt) { c.fillStyle = '#231C16'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${txt.length > 1 ? 240 : 330}px "${SERIF}"`; c.fillText(txt, cw / 2, ch / 2 + 14); } });
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: .9 }), bk = mCard, face = new THREE.Mesh(new THREE.BoxGeometry(w, h, .04), [bk, bk, bk, bk, m, blank ? mCream : m]);
    face.castShadow = face.receiveShadow = true; g.add(face); g.position.set(x, y, z); g.rotation.set(.04, ry, (seed % 5 - 2) * .025);
    for (const sx of [-1, 1]) string(g, [sx * w * .36, h / 2, 0], [sx * w * .36, TOP - y, 0]);
    return g;
  };
  sign('懶', -1.7, 4.55, 3.2, 2.3, .16, 71); sign('不努力', 1.05, 5.1, 3.8, 2.7, -.12, 72); sign('不專心', 3.1, 3.5, 2.4, 2.2, -.3, 73);
  W.flip = sign('沒用心', -3.5, 3.3, 2.6, 2.0, 3.32, 74, true);
  W.signs = W.labels.children.map(g => ({ g, y: g.position.y, ry: g.rotation.y, rz: g.rotation.z }));

  // ---- S04: a wall of 319 hanging tapes and two hero tapes ----
  W.tapes = group(box);
  { const r = rng(319), mats = [0, 1, 2, 3, 4, 5].map(i => { const t = tex(tapeCanvas(tapePositions(30 + i, .5, i % 2 ? .22 : .04, 60), { w: 1024, h: 56, seed: 12 + i, base: [0xF1E7D3, 0xE6D8BE, 0xEADCC4][i % 3] })); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return new THREE.MeshStandardMaterial({ map: t, alphaTest: .5, roughness: .9, side: THREE.DoubleSide }); });
    for (let i = 0; i < 319; i++) {
      const col = i % 53, row = Math.floor(i / 53), L = 2.2 + r() * 3.3, x = -5.6 + col * .215 + (r() - .5) * .05, g = group(W.tapes), m = new THREE.Mesh(new THREE.PlaneGeometry(L, .13), mats[i % 6]);
      m.rotation.z = -Math.PI / 2; m.position.y = -L / 2; m.castShadow = true; g.add(m); g.position.set(x, 7.3 - row * .04, .28 + row * .22 + r() * .1); g.rotation.z = (r() - .5) * .025; g.rotation.y = (r() - .5) * .3;
    }
    W.tapeRows = W.tapes.children.map((g, i) => ({ g, y: g.position.y, d: (i * 37 % 53) / 53 })); }
  W.heroTapes = group(box);
  const heroTape = (seed, noise, slow, y, z) => { const t = tex(tapeCanvas(tapePositions(seed, noise, slow, 90), { w: 4096, h: 192, seed: seed + 3 })); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; const m = new THREE.Mesh(new THREE.PlaneGeometry(11, .52, 80, 1), new THREE.MeshStandardMaterial({ map: t, alphaTest: .5, roughness: .85, side: THREE.DoubleSide })); const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(x * .6 + seed) * .06); } m.geometry.computeVertexNormals(); m.position.set(0, y, z); m.rotation.z = (seed % 2 ? 1 : -1) * .012; m.castShadow = true; m.receiveShadow = true; W.heroTapes.add(m); return m; };
  W.tapeA = heroTape(11, .42, 0, 3.72, 5.15); W.tapeB = heroTape(14, .62, .17, 2.72, 5.15);
  for (const [x, y] of [[-5.2, 3.72], [5.2, 3.72], [-5.2, 2.72], [5.2, 2.72]]) string(W.heroTapes, [x, y, 5.15], [x, TOP, 5.15]);

  // ---- S05/S06: backstage notes, the dimmer, the partition with its slit, the curtains ----
  W.back = group(box);
  const notes = ['晚餐吃什麼', '那首歌叫什麼', '忘了回訊息', '明天會下雨嗎', '那句話什麼意思', '鑰匙放哪了', '要買牙膏', '如果當初', '貓在想什麼', '下週的旅行'];
  { const r = rng(55);
    notes.forEach((n, i) => { const g = group(W.back), w = .62, h = .28 + n.length * .36, t = label(300, Math.round(300 * h / w), (c, cw, ch) => { c.drawImage(paperCanvas(0xF0DFB8, { seed: 80 + i }), 0, 0, cw, ch); const step = (ch - 50) / n.length; c.fillStyle = '#2C2824'; c.font = `700 ${Math.min(170, Math.round(step * .9))}px "${SERIF}"`; c.textAlign = 'center'; c.textBaseline = 'middle'; [...n].forEach((ch2, k) => c.fillText(ch2, cw / 2, 40 + step * (k + .5))); });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, .02), new THREE.MeshStandardMaterial({ map: t, roughness: .9 })); m.castShadow = m.receiveShadow = true; g.add(m);
      const row = i < 5 ? 0 : 1, x = -4.8 + (i % 5) * 2.3 + (row ? 1.15 : 0) + (r() - .5) * .3, y = (row ? 3.15 : 5.15) + (r() - .5) * .5, z = row ? 1.55 : .75; g.position.set(x, y, z); g.rotation.set(0, (r() - .5) * .6, (r() - .5) * .1); string(g, [0, h / 2, 0], [0, TOP - y, 0]); }); }
  W.dimmer = group(box);
  { const d = W.dimmer, plate = add(d, new THREE.BoxGeometry(.72, 3.1, .08), mDarkCard, 0, 1.75, 0); add(d, new THREE.BoxGeometry(1.1, .1, .6), mWood, 0, .05, 0); add(d, new THREE.BoxGeometry(.16, .3, .16), mWood, 0, .15, -.1);
    const faceT = label(360, 1550, (g, w, h) => { g.drawImage(paperCanvas(0x38312B, { seed: 58, dark: true }), 0, 0, w, h); g.strokeStyle = '#D9B765'; g.fillStyle = '#E8CF8F'; g.lineWidth = 7; for (let i = 0; i <= 10; i++) { const y = 150 + i * 125; g.beginPath(); g.moveTo(i % 5 ? 240 : 214, y); g.lineTo(320, y); g.stroke(); } g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = `700 76px "${SERIF}"`; g.fillText('亮', 34, 150); g.fillText('暗', 34, 1400); g.fillStyle = '#16120F'; g.fillRect(128, 120, 24, 1310); });
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(.72, 3.1), new THREE.MeshStandardMaterial({ map: faceT, roughness: .75 })); fp.position.set(0, 1.75, .045); d.add(fp);
    W.fader = add(d, new THREE.BoxGeometry(.4, .17, .2), brass, -.06, 1.2, .14); add(W.fader, new THREE.BoxGeometry(.06, .17, .22), inkDot, 0, 0, 0); }
  W.part = group(box);
  { const m = paper(0x3B342D, 91, { dark: true, repeat: 2 }); W.partLow = add(W.part, new THREE.BoxGeometry(12, 1.7, .24), mKraft, 0, .85, 3.2); W.partHigh = add(W.part, new THREE.BoxGeometry(12, 5.66, .24), mKraft, 0, 4.77, 3.2); }
  W.curtains = group(box);
  { const mR = paper(0x6B2A22, 92, { dark: true }), geo = new THREE.PlaneGeometry(4.2, 7.5, 120, 1), p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(x * 5.5) * .17 + Math.sin(x * 2.2) * .08); } geo.computeVertexNormals();
    for (const sx of [-1, 1]) { const c = add(W.curtains, geo, mR, sx * 4.4, 3.75, 5.1); c.scale.x = 1; } }

  // ---- S07: track, candy, trophy, time flags ----
  W.rail = group(box);
  { for (const x of [-.34, .34]) add(W.rail, new THREE.BoxGeometry(.05, .05, 6.7), brass, x, .05, 3.5); for (let z = .4; z < 6.8; z += .42) add(W.rail, new THREE.BoxGeometry(.9, .04, .12), mWood, 0, .02, z);
    const flag = (txt, z, sx) => { const g = group(W.rail); g.position.set(sx * .74, 0, z); add(g, new THREE.CylinderGeometry(.015, .015, 1.05, 8), mWood, 0, .52, 0); const t = label(420, 160, (c, w, h) => { c.drawImage(paperCanvas(0xEFE4CF, { seed: 15 }), 0, 0, w, h); c.fillStyle = '#2C2824'; c.font = `700 92px "${SERIF}"`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, w / 2, h / 2 + 6); }); const f = add(g, new THREE.BoxGeometry(.72, .28, .012), new THREE.MeshStandardMaterial({ map: t, roughness: .9 }), sx * .37, .9, 0); };
    flag('現在', 4.5, -1); flag('下週', 2.75, 1); flag('下個月', .9, -1); W.rail.children.at(-2).position.x = 1.75; }
  { const pts = [[0, 0], [.42, 0], [.42, .05], [.13, .1], [.08, .32], [.08, .46], [.26, .58], [.46, 1.0], [.5, 1.4], [.46, 1.42], [.0, 1.2]].map(p => new THREE.Vector2(...p));
    const g = group(box); W.trophy = g; const m = add(g, new THREE.LatheGeometry(pts, 48), mGold); const h = new THREE.TorusGeometry(.24, .03, 10, 30, Math.PI); for (const sx of [-1, 1]) { const a = add(g, h, mGold, sx * .46, 1.12, 0); a.rotation.z = sx > 0 ? -Math.PI / 2 : Math.PI / 2; }
    const bk = add(g, new THREE.BoxGeometry(.6, .1, .6), mWood, 0, -.04, 0); }
  { const g = group(box); W.candy = g; const m = new THREE.MeshStandardMaterial({ color: 0xB0342A, roughness: .35, metalness: .05 }); const b = add(g, new THREE.SphereGeometry(.2, 32, 22), m); b.scale.set(1.25, .85, .85);
    const tri = new THREE.Shape(); tri.moveTo(0, 0); tri.lineTo(.28, .13); tri.lineTo(.22, 0); tri.lineTo(.28, -.13); tri.closePath(); for (const sx of [-1, 1]) { const w = add(g, ext(tri, .012), paper(0xE9C766, 19), sx * .22, 0, 0); if (sx < 0) w.rotation.y = Math.PI; } }

  // ---- S08: lock pin, coffee cups, a half-built paper tower ----
  W.pin = group(box);
  W.pin.scale.setScalar(1.5);
  { const p = add(W.pin, new THREE.CylinderGeometry(.05, .05, .72, 16), brass); const k = add(W.pin, new THREE.SphereGeometry(.09, 16, 12), brass, 0, .38, 0); const d = add(W.pin, new THREE.BoxGeometry(.22, .1, .22), brass, 0, -.1, 0); }
  W.cups = group(W.set);
  const cupGeo = new THREE.CylinderGeometry(.13, .1, .3, 24, 1, true), cupIn = new THREE.CircleGeometry(.125, 24), mCoffee = new THREE.MeshStandardMaterial({ color: 0x3A2415, roughness: .3 });
  [[-1.55, -.2], [-1.25, .25], [-1.75, .2], [-1.35, -.32], [-.98, -.05], [-1.62, -.46]].forEach(([x, z], i) => { const g = group(W.cups); add(g, cupGeo, mCream, 0, .15, 0); const c = new THREE.Mesh(cupIn, mCoffee); c.rotation.x = -Math.PI / 2; c.position.y = .27; g.add(c); g.position.set(x, 1.33, 4.2 + z); });
  W.tower = group(W.set);
  { const r = rng(17); for (let i = 0; i < 8; i++) { const s = .62 - i * .045, b = add(W.tower, new THREE.BoxGeometry(s, .26, s), i % 2 ? mCard : mCream, (r() - .5) * .05, .13 + i * .26, 0); b.rotation.y = i * .42; } const fl = add(W.tower, new THREE.ConeGeometry(.16, .34, 4), paper(0xB0342A, 23), 0, 2.27, 0); W.tower.position.set(-.35, 1.33, 4.25); }

  // ---- S09: small stool, wooden clip, digit strips ----
  W.nine = group(box);
  W.stool = group(W.nine); add(W.stool, new THREE.BoxGeometry(1.0, .08, .7), mWood, 0, 1.5, 0); for (const sx of [-1, 1]) add(W.stool, new THREE.BoxGeometry(.08, 1.5, .08), mWood, sx * .42, .75, 0);
  W.clip = group(W.nine); { add(W.clip, new THREE.BoxGeometry(1.1, .12, .08), mWood, 0, .12, 0); add(W.clip, new THREE.BoxGeometry(1.1, .12, .08), mWood, 0, -.12, .02).rotation.z = .3; add(W.clip, new THREE.TorusGeometry(.08, .02, 8, 20), brass, -.3, 0, .06); }
  const digits = '7392048165';
  W.strips = [...digits].map((d, i) => { const g = group(W.nine), t = label(240, 360, (c, w, h) => { c.drawImage(paperCanvas(0xF1E7D3, { seed: 100 + i }), 0, 0, w, h); c.strokeStyle = 'rgba(44,40,36,.45)'; c.lineWidth = 6; c.strokeRect(10, 10, w - 20, h - 20); c.fillStyle = '#2C2824'; c.font = `700 230px "${SERIF}"`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(d, w / 2, h / 2 + 8); }); const m = add(g, new THREE.BoxGeometry(.66, 1.0, .015), new THREE.MeshStandardMaterial({ map: t, roughness: .9 })); const str = new THREE.Mesh(strGeo, threadMat); str.castShadow = true; g.add(str); return { g, m, str }; });
  // k = 0 hanging, 1 on the floor; the thread goes when the strip lets go
  W.poseStrip = (st, h, f, k, thread = false) => { const e = k * k; st.g.position.set(h.x + (f.x - h.x) * k, h.y + (f.y - h.y) * e, h.z + (f.z - h.z) * k); st.g.rotation.set((-Math.PI / 2 + .02) * k, h.ry * (1 - k), f.rz * k); st.str.visible = k === 0 || thread; if (st.str.visible) { const L = TOP - st.g.position.y - .5; st.str.position.set(0, .5 + L / 2, 0); st.str.scale.y = L; } };

  // ---- S10: under the stage ----
  W.under = group(); W.under.position.y = -24;
  { const u = W.under, mW = paper(0x4A3B2E, 121, { dark: true, repeat: 2 }), mF = paper(0x3A2E25, 122, { dark: true, repeat: 2 });
    const bw = new THREE.Mesh(new THREE.PlaneGeometry(26, 12), mW); bw.position.set(0, 6, -2); bw.receiveShadow = true; u.add(bw);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(26, 14), mF); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0, 4); fl.receiveShadow = true; u.add(fl);
    const ceil = new THREE.Shape(); ceil.moveTo(-13, -7); ceil.lineTo(13, -7); ceil.lineTo(13, 7); ceil.lineTo(-13, 7); ceil.closePath(); ceil.holes.push(rectPath(-1.5, -1.3, 1.5, 1.3));
    const c = new THREE.Mesh(ext(ceil, .3), mKraft); c.rotation.x = -Math.PI / 2; c.position.set(0, 9.2, 2); c.castShadow = c.receiveShadow = true; u.add(c);
    for (const x of [-9, -3.4, 3.4, 9]) add(u, new THREE.BoxGeometry(.4, 9.2, .4), mWood, x, 4.6, 5.4);
    add(u, new THREE.BoxGeometry(26, .36, .4), mWood, 0, 8.9, 5.4);
    W.shaft = add(u, new THREE.BoxGeometry(.01, .01, .01), mWood, 0, 0, 0);
    const station = (txt, x) => { const t = label(620, 240, (g, w, h) => { g.drawImage(paperCanvas(0xEFE4CF, { seed: 31 + x }), 0, 0, w, h); g.strokeStyle = 'rgba(44,30,20,.5)'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28); g.fillStyle = '#231C16'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 150px "${SERIF}"`; g.fillText(txt, w / 2, h / 2 + 8); }); return add(u, new THREE.BoxGeometry(2.6, 1.0, .03), new THREE.MeshStandardMaterial({ map: t, roughness: .9 }), x, 1.0, 3.6); };
    station('基因', -6.6); station('環境', 0); station('大腦發展', 6.6);
    // genes: racks of thread spools with threads running up to the hatch
    const spool = (x, y, z, col) => { const g = group(u); g.position.set(x, y, z); const m = new THREE.MeshStandardMaterial({ color: col, roughness: .8 }); const b = add(g, new THREE.CylinderGeometry(.24, .24, .5, 24), m); for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(.3, .3, .05, 24), mWood, 0, s * .26, 0); return g; };
    const cols = [0xB0342A, 0xCFA54E, 0x3F6B6B, 0xE9E2D6, 0x7C4E2A, 0x34506E]; const r = rng(7); W.threadLines = [];
    for (let i = 0; i < 18; i++) { const col = i % 6, row = Math.floor(i / 6), x = -8.7 + col * .84, y = 1.72 + row * 1.15, z = 1.4 + (row % 2) * .2; spool(x, y, z, cols[(i * 5) % 6]); const m = new THREE.MeshStandardMaterial({ color: cols[(i * 5) % 6], roughness: .8 }); const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, y + .28, z), new THREE.Vector3(x * .7 - 1, 6.6 + r(), 2.2), new THREE.Vector3((r() - .5) * .9 - .6, 8.9, 2)]); const tb = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, .014, 5), m); tb.castShadow = true; u.add(tb); }
    // environment: house, tree, cloud and sun, cut paper on sticks
    const cut = (shape, col, x, y, z, s = 1, seed = 1) => { const m = add(u, ext(shape, .04), paper(col, seed), x, y, z); m.scale.setScalar(s); return m; };
    const house = new THREE.Shape(); house.moveTo(-1, 0); house.lineTo(1, 0); house.lineTo(1, 1.2); house.lineTo(0, 2.1); house.lineTo(-1, 1.2); house.closePath(); house.holes.push(rectPath(-.3, 0.02, .3, .9));
    cut(house, 0xE2CDA8, -1.0, 1.2, 1.2, 1.15, 301);
    const school = new THREE.Shape(); school.moveTo(-1.2, 0); school.lineTo(1.2, 0); school.lineTo(1.2, 1.5); school.lineTo(.4, 1.5); school.lineTo(.4, 2.3); school.lineTo(-.4, 2.3); school.lineTo(-.4, 1.5); school.lineTo(-1.2, 1.5); school.closePath();
    cut(school, 0xC79A63, 1.65, 1.2, .8, 1.0, 302);
    const cloud = new THREE.Shape(); cloud.absarc(0, 0, .6, 0, Math.PI * 2); const c2 = new THREE.Shape(); c2.absarc(.7, -.1, .45, 0, Math.PI * 2); const c3 = new THREE.Shape(); c3.absarc(-.7, -.1, .42, 0, Math.PI * 2);
    for (const [s, dx] of [[cloud, 0], [c2, 0], [c3, 0]]) { const m = cut(s, 0xEFE4CF, -2.0, 5.9, 1.5, 1, 303); }
    string(u, [-2.0, 6.4, 1.52], [-2.0, 8.9, 1.52]);
    const sunShape = new THREE.Shape(); sunShape.absarc(0, 0, .5, 0, Math.PI * 2); cut(sunShape, 0xE7B24C, 2.2, 5.6, 1.1, 1, 304); string(u, [2.2, 6.1, 1.12], [2.2, 8.9, 1.12]);
    // brain development: interlocked paper gears
    const gear = (R, teeth, col, x, y, z, rot, seed) => { const s = new THREE.Shape(); const n = teeth * 4; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, rr = (i % 4 === 0 || i % 4 === 1) ? R : R * .84; const px = Math.cos(a) * rr, py = Math.sin(a) * rr; i ? s.lineTo(px, py) : s.moveTo(px, py); } const h = new THREE.Path(); h.absarc(0, 0, R * .2, 0, Math.PI * 2, true); s.holes.push(h); const m = add(u, ext(s, .08), paper(col, seed), x, y, z); m.rotation.z = rot; const hub = add(u, new THREE.CylinderGeometry(R * .17, R * .17, .16, 24), brass, x, y, z + .06); hub.rotation.x = Math.PI / 2; return m; };
    gear(1.7, 16, 0xC79A63, 5.2, 3.0, .9, .1, 311); gear(1.1, 11, 0xE2CDA8, 7.6, 3.5, 1.05, .28, 312); gear(.9, 9, 0xCFA54E, 5.9, 5.6, 1.15, .05, 313); gear(1.3, 13, 0x9A7A4E, 8.9, 5.8, .9, .2, 314);
    add(u, new THREE.CylinderGeometry(.05, .05, 4, 12), mWood, 4.4, 6.9, 1).rotation.z = .7;
    W.fall = group(u);                                                                      // the tiny "不夠努力" card, falling in the hatch light
    const t = label(420, 200, (g, w, h) => { g.drawImage(paperCanvas(0xC79A63, { seed: 74 }), 0, 0, w, h); g.fillStyle = '#231C16'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 92px "${SERIF}"`; g.fillText('不夠努力', w / 2, h / 2 + 6); });
    add(W.fall, new THREE.BoxGeometry(.84, .4, .012), new THREE.MeshStandardMaterial({ map: t, roughness: .9 })); W.fall.position.set(.05, 5.0, 3.0); W.fall.rotation.set(.1, .2, -.18); W.fall.traverse(m => { if (m.isMesh) m.castShadow = false; });
  }

  // ---- S11: toolbox and a floor pulley ----
  W.crate = group(box); add(W.crate, new THREE.BoxGeometry(2.6, 1.0, 1.3), mKraft, 0, .5, 0); add(W.crate, new THREE.BoxGeometry(2.66, .06, 1.36), mWood, 0, .98, 0);
  W.toolbox = group(box);
  { const b = W.toolbox; add(b, new THREE.BoxGeometry(2.3, .6, 1.0), mWood, 0, .3, 0); const lid = add(b, new THREE.BoxGeometry(2.3, .06, 1.0), mWood, 0, .98, -.72); lid.rotation.x = -1.15; const hd = add(b, new THREE.TorusGeometry(.3, .03, 8, 24, Math.PI), brass, 0, .62, 0);
    add(b, new THREE.BoxGeometry(2.12, .03, .84), mDarkCard, 0, .56, 0);
    const tags = [['藥物', -.74, .14], ['心理治療', 0, -.06], ['環境調整', .74, .1]];
    W.tags = tags.map(([txt, x, rz], i) => { const g = group(b), t = label(330, 440, (c, w, h) => { c.drawImage(paperCanvas(0xF4ECDC, { seed: 141 + i }), 0, 0, w, h); c.strokeStyle = 'rgba(44,30,20,.5)'; c.lineWidth = 6; c.strokeRect(12, 12, w - 24, h - 24); c.fillStyle = '#231C16'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${txt.length > 2 ? 84 : 112}px "${SERIF}"`; if (txt.length > 2) { c.fillText(txt.slice(0, 2), w / 2, h / 2 - 66); c.fillText(txt.slice(2), w / 2, h / 2 + 56); } else c.fillText(txt, w / 2, h / 2 + 8); c.fillStyle = '#2C2824'; c.beginPath(); c.arc(w / 2, 36, 12, 0, 7); c.fill(); }); add(g, new THREE.BoxGeometry(.62, .84, .012), new THREE.MeshStandardMaterial({ map: t, roughness: .9 }), x, 1.16, .05).rotation.set(-.1, 0, rz); return g; });
  }
  W.floorPulley = group(W.set);
  { const f = W.floorPulley, wh = add(f, new THREE.TorusGeometry(.17, .05, 12, 40), brass, 0, 3.0, 0); const hub = add(f, new THREE.CylinderGeometry(.05, .05, .12, 16), mWood, 0, 3.0, 0); hub.rotation.x = Math.PI / 2; add(f, new THREE.BoxGeometry(.08, 3.0, .08), mWood, 0, 1.5, -.12); add(f, new THREE.BoxGeometry(.7, .08, .5), mWood, 0, .04, -.12); }

  // ---- S12: three brass-pinned cards on a board ----
  W.board = group(box);
  { const b = W.board; const bd = add(b, new THREE.BoxGeometry(11, .06, 6.4), paper(0xA88256, 151, { repeat: 2 }), 0, .03, 3.5);
    const cards = [['從小就有', '12 歲前就出現', -3.55, -.035], ['跨場合', '不只一種場合', 0, .025], ['影響生活', '妨礙日常功能', 3.55, -.015]];
    cards.forEach(([a, b2, x, rz], i) => { const t = label(760, 900, (g, w, h) => { g.drawImage(paperCanvas(0xF4ECDC, { seed: 161 + i }), 0, 0, w, h); g.strokeStyle = 'rgba(44,30,20,.35)'; g.lineWidth = 5; g.strokeRect(20, 20, w - 40, h - 40); g.fillStyle = '#A86A1C'; g.textAlign = 'center'; g.font = `500 62px "${SANS}"`; g.letterSpacing = '6px'; g.fillText(`${i + 1} / 3`, w / 2, 170); g.letterSpacing = '0px'; g.fillStyle = '#231C16'; g.font = `700 134px "${SERIF}"`; g.fillText(a, w / 2, 470); g.fillStyle = '#4A4036'; g.font = `500 62px "${SANS}"`; g.fillText(b2, w / 2, 660); });
      const c = add(b, new THREE.BoxGeometry(3.05, .02, 3.62), [mCream, mCream, new THREE.MeshStandardMaterial({ map: t, roughness: .9 }), mCream, mCream, mCream], x, .08, 3.3); c.rotation.y = rz; add(b, new THREE.CylinderGeometry(.09, .09, .05, 24), brass, x + Math.sin(rz) * -1.66, .13, 3.3 - Math.cos(rz) * 1.66); });
  }
  W.v = new THREE.Vector3();
  return W;
}

export function makePost(T, renderer, w, h) {
  THREE = T;
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
    resize(pw, ph, logicalW) { if (rt.width !== pw || rt.height !== ph) { rt.setSize(pw, ph); mat.uniforms.res.value.set(pw, ph); } mat.uniforms.scale.value = pw / logicalW; },
    render(scene, camera) {
      mat.uniforms.near.value = camera.near; mat.uniforms.far.value = camera.far;
      renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(ps, pc);
    },
  };
}
