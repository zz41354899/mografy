// The paper theatre: every mesh, material, light and texture of the film, built once in setup.
// Units: 1 = 10 cm. x right, y up, z toward the audience. Box interior x ±4.5, z −2.5..2.5, back wall z = −2.5.
import type { ThreeModule } from './three.js';
import { CJK_SANS, CJK_SERIF } from './cjk.js';

type T3 = ThreeModule;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type World = Record<string, any>;

export const COL = {
  paper: 0xEFE6D4, inkCard: 0x24212C, other: 0xA79E90, felt: 0x1B1922,
  tri: 0xC8643B, sq: 0x7F8C76, ci: 0xB98B7E, cr: 0xD9A441,
};
export const TRAITS = ['tri', 'sq', 'ci', 'cr'] as const;
export type Trait = typeof TRAITS[number];
/** Figure proportions (scale 1): body 1.16, neck gap .07, head r .2, standing on a .065 base. */
export const FIG = { base: .065, body: 1.16, gap: .07, head: .2, headY: .065 + 1.16 + .07 + .2 };
export const STEP_X = [0, 4, 8];

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
function paperTex(THREE: T3, base: number, o: { seed?: number; size?: number; fiber?: number; speck?: number; repeat?: number; dark?: boolean } = {}) {
  const size = o.size ?? 512, r = rng(o.seed ?? 1), dark = !!o.dark, fiber = o.fiber ?? .07, speck = o.speck ?? .05;
  const cv = new OffscreenCanvas(size, size), g = cv.getContext('2d')!;
  g.fillStyle = hex(base); g.fillRect(0, 0, size, size);
  noiseFill(g, size, size, dark ? 11 : 18, r);
  for (let i = 0; i < 40; i++) {
    const x = r() * size, y = r() * size, R = 30 + r() * 90, a = .025 + r() * .03, gr = g.createRadialGradient(x, y, 0, x, y, R);
    gr.addColorStop(0, dark ? `rgba(255,255,255,${a * .5})` : `rgba(120,95,60,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - R, y - R, 2 * R, 2 * R);
  }
  g.lineCap = 'round';
  for (let i = 0; i < size * fiber * 12; i++) {
    const x = r() * size, y = r() * size, a = r() * Math.PI, L = 4 + r() * 16;
    g.strokeStyle = r() < .5 ? `rgba(255,255,255,${.06 + r() * .08})` : `rgba(80,60,40,${.04 + r() * .06})`; g.lineWidth = .6 + r() * .7;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * L * .5 + (r() - .5) * 3, y + Math.sin(a) * L * .5 + (r() - .5) * 3, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
  }
  for (let i = 0; i < size * speck * 4; i++) { g.fillStyle = `rgba(60,45,30,${.15 + r() * .25})`; g.beginPath(); g.arc(r() * size, r() * size, .4 + r() * .8, 0, 7); g.fill(); }
  return tex(THREE, cv, o.repeat ?? 1);
}
function woodTex(THREE: T3, seed: number, rx = 1, ry = 1) {
  const s = 1024, cv = new OffscreenCanvas(s, s), g = cv.getContext('2d')!, r = rng(seed);
  g.fillStyle = '#8A6644'; g.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y++) { const v = Math.sin(y * .045 + Math.sin(y * .011) * 3) * .5 + .5; g.fillStyle = `rgba(${60 + v * 40},${40 + v * 25},${22 + v * 12},${.18 + r() * .1})`; g.fillRect(0, y, s, 1); }
  for (let i = 0; i < 900; i++) { g.strokeStyle = `rgba(40,25,12,${.05 + r() * .08})`; g.lineWidth = .5 + r(); const y = r() * s; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(s * .3, y + (r() - .5) * 20, s * .6, y + (r() - .5) * 20, s, y + (r() - .5) * 10); g.stroke(); }
  const t = tex(THREE, cv); t.repeat.set(rx, ry); return t;
}
function labelTex(THREE: T3, lines: string[], o: { w?: number; h?: number; bg?: string; color?: string; size?: number; family?: string; weight?: number; tracking?: number; border?: boolean; hole?: boolean } = {}) {
  const w = o.w ?? 512, h = o.h ?? 256, cv = new OffscreenCanvas(w, h), g = cv.getContext('2d')!;
  g.fillStyle = o.bg ?? '#F2EBDD'; g.fillRect(0, 0, w, h);
  if ((o.bg ?? '#F2EBDD') !== '#000000') noiseFill(g, w, h, 14, rng(w + h));
  if (o.border ?? true) { g.strokeStyle = 'rgba(42,39,51,.25)'; g.lineWidth = 3; g.strokeRect(14, 14, w - 28, h - 28); }
  const size = o.size ?? 92;
  g.fillStyle = o.color ?? '#2A2733'; g.font = `${o.weight ?? 500} ${size}px "${o.family ?? CJK_SANS}"`; g.letterSpacing = `${o.tracking ?? 4}px`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const cx = o.hole ? w / 2 + 30 : w / 2;
  lines.forEach((l, i) => g.fillText(l, cx, h / 2 + (i - (lines.length - 1) / 2) * size * 1.15));
  if (o.hole) { g.fillStyle = 'rgba(42,39,51,.8)'; g.beginPath(); g.arc(46, h / 2, 14, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ---------------------------------------------------------------- shapes
function figureShapes(THREE: T3) {
  const w = .56, h = FIG.body, gap = FIG.gap, r = FIG.head;
  const body = new THREE.Shape(); body.moveTo(-w / 2 + .03, 0); body.lineTo(w / 2 - .03, 0); body.quadraticCurveTo(w / 2, 0, w / 2, .03);
  body.lineTo(w / 2, h - w / 2); body.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); body.lineTo(-w / 2, .03); body.quadraticCurveTo(-w / 2, 0, -w / 2 + .03, 0);
  const neck = new THREE.Shape(); neck.moveTo(-.06, h - .05); neck.lineTo(.06, h - .05); neck.lineTo(.06, h + gap + .05); neck.lineTo(-.06, h + gap + .05); neck.closePath();
  const head = new THREE.Shape(); head.absarc(0, h + gap + r, r, 0, Math.PI * 2, false);
  return [body, neck, head];
}
function traitShape(THREE: T3, k: Trait, s: number) {
  const r = s / 2, sh = new THREE.Shape();
  if (k === 'ci') sh.absarc(0, 0, r, 0, Math.PI * 2, false);
  else if (k === 'sq') { const q = r * .86, c = r * .16; sh.moveTo(-q + c, -q); sh.lineTo(q - c, -q); sh.quadraticCurveTo(q, -q, q, -q + c); sh.lineTo(q, q - c); sh.quadraticCurveTo(q, q, q - c, q); sh.lineTo(-q + c, q); sh.quadraticCurveTo(-q, q, -q, q - c); sh.lineTo(-q, -q + c); sh.quadraticCurveTo(-q, -q, -q + c, -q); }
  else if (k === 'tri') { const h = r * 1.08; sh.moveTo(0, h); sh.lineTo(h * .95, -h * .62); sh.lineTo(-h * .95, -h * .62); sh.closePath(); }
  else {
    const a = Math.acos(.25), d = r * .5, N = 40, pts = [];
    for (let i = 0; i <= N; i++) { const t = a + (2 * Math.PI - 2 * a) * i / N; pts.push(new THREE.Vector2(Math.cos(t) * r, -Math.sin(t) * r)); }
    const b0 = Math.PI + a, b1 = Math.PI - a;
    for (let i = 1; i < N; i++) { const t = b0 - (b0 - b1) * i / N; pts.push(new THREE.Vector2(d + Math.cos(t) * r, -Math.sin(t) * r)); }
    sh.setFromPoints(pts);
  }
  return sh;
}

// ---------------------------------------------------------------- the world
export function buildWorld(THREE: T3, scene: T3, renderer: T3): World {
  const W: World = {};
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new THREE.RoomEnvironment(), .04).texture; pmrem.dispose();
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  const mPaper = new THREE.MeshStandardMaterial({ map: paperTex(THREE, COL.paper, { seed: 2, repeat: 2.5 }), roughness: .95 });
  const mFloor = new THREE.MeshStandardMaterial({ map: paperTex(THREE, 0xE6DBC5, { seed: 5, repeat: 3 }), roughness: .97 });
  const mCardSide = new THREE.MeshStandardMaterial({ color: 0xD8CBB2, roughness: .9 });
  const mInk = new THREE.MeshStandardMaterial({ map: paperTex(THREE, COL.inkCard, { seed: 7, dark: true }), roughness: .85 });
  const mOther = new THREE.MeshStandardMaterial({ map: paperTex(THREE, COL.other, { seed: 9 }), roughness: .9 });
  const mWood = new THREE.MeshStandardMaterial({ map: woodTex(THREE, 4), roughness: .7 });
  const brass = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, metalness: 1, roughness: .35, envMap: env });
  const cream = new THREE.MeshStandardMaterial({ map: paperTex(THREE, 0xEDE3CF, { seed: 31 }), roughness: .85 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xE3A042, emissive: 0xE38B2A, emissiveIntensity: 2.2, roughness: .6 });
  W.mats = { mInk, cream, amber };

  // ---- the theatre box ----
  const box = new THREE.Group(); scene.add(box); W.box = box;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 5.2), mPaper); wall.position.set(0, 2.6, -2.5); wall.receiveShadow = true; box.add(wall);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 5.2), mFloor); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; box.add(floor);
  const sideMat = new THREE.MeshStandardMaterial({ map: paperTex(THREE, 0xD9C9AA, { seed: 11, repeat: 1.5 }), roughness: .95, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), sideMat); s.rotation.y = -sx * Math.PI / 2; s.position.set(sx * 4.6, 2.6, 0); s.receiveShadow = true; box.add(s); }
  // the carton shell and proscenium, seen in the final pull-back
  const shell = new THREE.Group(); box.add(shell); W.shell = shell;
  const kraft = new THREE.MeshStandardMaterial({ map: paperTex(THREE, 0xB9946A, { seed: 13, repeat: 2 }), roughness: .9 });
  const add = (geo: T3, m: T3, x: number, y: number, z: number) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; shell.add(o); return o; };
  add(new THREE.BoxGeometry(9.6, .12, 5.6), kraft, 0, -.06, 0);
  add(new THREE.BoxGeometry(.12, 5.4, 5.6), kraft, -4.72, 2.6, 0); add(new THREE.BoxGeometry(.12, 5.4, 5.6), kraft, 4.72, 2.6, 0);
  add(new THREE.BoxGeometry(9.6, 5.4, .12), kraft, 0, 2.6, -2.62); add(new THREE.BoxGeometry(9.6, .12, 5.6), kraft, 0, 5.3, 0);
  const pro = new THREE.MeshStandardMaterial({ map: paperTex(THREE, 0x1F1C27, { seed: 17, dark: true }), roughness: .8 });
  add(new THREE.BoxGeometry(.9, 5.4, .1), pro, -4.3, 2.6, 2.82); add(new THREE.BoxGeometry(.9, 5.4, .1), pro, 4.3, 2.6, 2.82);
  const titleOpts = { w: 2048, h: 268, size: 150, family: CJK_SERIF, weight: 700, tracking: 30, border: false };
  const headerFace = new THREE.MeshStandardMaterial({
    map: labelTex(THREE, ['陰影心理學'], { ...titleOpts, bg: '#1F1C27', color: '#E7C27A' }),
    emissiveMap: labelTex(THREE, ['陰影心理學'], { ...titleOpts, bg: '#000000', color: '#E7C27A' }), emissive: 0xffffff, emissiveIntensity: 1.1, roughness: .55, metalness: .25,
  });
  add(new THREE.BoxGeometry(9.6, 1.25, .1), [pro, pro, pro, pro, headerFace, pro], 0, 4.75, 2.82);
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshStandardMaterial({ map: woodTex(THREE, 21, 4, 2), roughness: .6 }));
  desk.rotation.x = -Math.PI / 2; desk.position.y = -.13; desk.receiveShadow = true; scene.add(desk); W.desk = desk;

  // ---- cardboard figures on wooden bases ----
  const figGeo = new THREE.ExtrudeGeometry(figureShapes(THREE), { depth: .04, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 1, curveSegments: 40 });
  figGeo.translate(0, 0, -.02);
  const mkFig = (face: T3) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(figGeo, [face, mCardSide]); m.position.y = FIG.base; m.castShadow = m.receiveShadow = true; g.add(m);
    const base = new THREE.Mesh(new THREE.BoxGeometry(.62, .07, .3), mWood); base.position.y = .035; base.castShadow = base.receiveShadow = true; g.add(base);
    return g;
  };
  W.me = mkFig(mInk); scene.add(W.me);
  W.other = mkFig(mOther); scene.add(W.other);
  // the eye that appears after the turn
  W.eyeDot = new THREE.Mesh(new THREE.CircleGeometry(.028, 20), new THREE.MeshStandardMaterial({ color: 0xF6EFE2, roughness: .6 }));
  W.eyeDot.position.set(.07, FIG.headY + .02, -.032); W.eyeDot.rotation.y = Math.PI; W.me.add(W.eyeDot);

  // ---- the bulb on its wire ----
  const lamp = new THREE.Group(); scene.add(lamp); W.lamp = lamp;
  W.bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffb04a, emissiveIntensity: 9, roughness: .2 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.11, 32, 24), W.bulbMat); bulb.scale.set(1, 1.2, 1); lamp.add(bulb);
  const sock = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, .14, 24), brass); sock.position.y = .17; lamp.add(sock);
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, 3.75, 6), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .6 })); wire.position.y = .24 + 1.875; lamp.add(wire);
  // pull cord with a wooden bead: pulled in the dark at the very start to switch the bulb on
  const cord = new THREE.Group(); cord.position.set(.058, .13, .0); lamp.add(cord); W.cord = cord;
  W.cordStr = new THREE.Mesh(new THREE.CylinderGeometry(.0035, .0035, 1, 6), new THREE.MeshStandardMaterial({ color: 0xcfc2a8, roughness: .8 })); cord.add(W.cordStr);
  W.cordBead = new THREE.Mesh(new THREE.SphereGeometry(.026, 18, 12), mWood); W.cordBead.castShadow = true; cord.add(W.cordBead);
  const light = new THREE.PointLight(0xffb866, 34, 0, 2); light.castShadow = true; light.shadow.mapSize.set(1024, 1024); light.shadow.bias = -.0015; light.shadow.normalBias = .02; light.shadow.radius = 6; lamp.add(light); W.light = light;
  W.hemi = new THREE.HemisphereLight(0xfff1dc, 0x3a3040, .22); scene.add(W.hemi);
  W.fill = new THREE.DirectionalLight(0xcfd8ff, .14); W.fill.position.set(-4, 6, 8); scene.add(W.fill);

  // ---- the four traits: paper, and gold for Act II ----
  W.trait = {}; W.traitMat = {};
  for (const k of TRAITS) {
    const geo = new THREE.ExtrudeGeometry(traitShape(THREE, k, .34), { depth: .03, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 1, curveSegments: 36 }); geo.center();
    const paper = new THREE.MeshStandardMaterial({ map: paperTex(THREE, COL[k], { seed: k.charCodeAt(0) }), roughness: .85, emissive: COL[k], emissiveIntensity: 0 });
    const side = new THREE.MeshStandardMaterial({ color: COL[k], roughness: .9 });
    const gold = new THREE.MeshPhysicalMaterial({ color: 0xE2B055, metalness: 1, roughness: .28, envMap: env, envMapIntensity: 1.6, clearcoat: .4 });
    W.traitMat[k] = { paper: [paper, side], gold: [gold, gold] };
    const m = new THREE.Mesh(geo, W.traitMat[k].paper); m.castShadow = m.receiveShadow = true; scene.add(m); W.trait[k] = m;
    const pin = new THREE.Mesh(new THREE.SphereGeometry(.022, 12, 8), brass); pin.position.z = .03; m.add(pin); m.userData.pin = pin;
  }

  // ---- the mask on a wire ----
  const maskGeo = new THREE.SphereGeometry(.26, 48, 32, Math.PI * .12, Math.PI * .76, Math.PI * .16, Math.PI * .68); maskGeo.scale(1, 1.15, .55);
  const mcv = new OffscreenCanvas(512, 512), mg = mcv.getContext('2d')!;
  mg.fillStyle = '#F6EFE2'; mg.fillRect(0, 0, 512, 512); noiseFill(mg, 512, 512, 10, rng(5));
  mg.strokeStyle = '#2A2733'; mg.lineWidth = 12; mg.lineCap = 'round';
  mg.beginPath(); mg.arc(196, 236, 34, Math.PI * 1.15, Math.PI * 1.85); mg.stroke(); mg.beginPath(); mg.arc(316, 236, 34, Math.PI * 1.15, Math.PI * 1.85); mg.stroke();
  mg.beginPath(); mg.arc(256, 300, 64, Math.PI * .22, Math.PI * .78); mg.stroke();
  mg.fillStyle = 'rgba(214,120,90,.22)'; mg.beginPath(); mg.arc(170, 300, 30, 0, 7); mg.arc(342, 300, 30, 0, 7); mg.fill();
  const maskTex = new THREE.CanvasTexture(mcv); maskTex.colorSpace = THREE.SRGBColorSpace;
  const mask = new THREE.Group(); scene.add(mask); W.mask = mask;
  const mm = new THREE.Mesh(maskGeo, new THREE.MeshStandardMaterial({ map: maskTex, roughness: .7, side: THREE.DoubleSide })); mm.castShadow = true; mask.add(mm);
  const mw = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, 8, 6), new THREE.MeshStandardMaterial({ color: 0x222222 })); mw.position.y = 4.25; mask.add(mw);

  // ---- the four tags on strings ----
  W.tags = [];
  const tagShape = new THREE.Shape(); { const w = .92, h = .36, c = .1; tagShape.moveTo(-w / 2 + c, -h / 2); tagShape.lineTo(w / 2, -h / 2); tagShape.lineTo(w / 2, h / 2); tagShape.lineTo(-w / 2 + c, h / 2); tagShape.lineTo(-w / 2, 0); tagShape.closePath(); }
  const tagGeo = new THREE.ExtrudeGeometry(tagShape, { depth: .01, bevelEnabled: false });
  { const uv = tagGeo.attributes.uv, pos = tagGeo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + .46) / .92, (pos.getY(i) + .18) / .36); }
  for (const s of ['不准哭', '不要生氣', '不可以比較', '別想要太多']) {
    const g = new THREE.Group(); scene.add(g);
    const m = new THREE.Mesh(tagGeo, [new THREE.MeshStandardMaterial({ map: labelTex(THREE, [s], { w: 920, h: 360, size: s.length > 4 ? 104 : 120, weight: 500, hole: true }), roughness: .85 }), mCardSide]); m.castShadow = true; g.add(m);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, 6, 5), new THREE.MeshStandardMaterial({ color: 0x8d7a5c })); str.position.set(-.36, 3.0, .005); g.add(str);
    W.tags.push(g);
  }

  // ---- amber yarn (S06) and ripples ----
  const yarn = new THREE.CatmullRomCurve3([V(-.78, .8, -1.17), V(-.5, .45, -1.0), V(-.2, .02, -.6), V(.4, .02, .1), V(.85, .4, .4), V(.9, .8, .36)], false, 'catmullrom', .2);
  W.yarnSegs = 240; W.yarnRadial = 8;
  W.yarn = new THREE.Mesh(new THREE.TubeGeometry(yarn, W.yarnSegs, .012, W.yarnRadial, false), amber); W.yarn.castShadow = true; scene.add(W.yarn);
  W.ripples = [0, 1, 2].map(i => { const t = new THREE.Mesh(new THREE.TorusGeometry(.32 + i * .17, .008, 8, 96), new THREE.MeshStandardMaterial({ color: 0xE3A042, emissive: 0xE3A042, emissiveIntensity: 2.4 - i * .7, transparent: true, opacity: 1 - i * .28 })); scene.add(t); return t; });

  // ---- backstage (Act II) ----
  const stage2 = new THREE.Group(); scene.add(stage2); W.stage2 = stage2;
  const felt = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshStandardMaterial({ map: paperTex(THREE, COL.felt, { seed: 23, dark: true, repeat: 6, fiber: .12 }), roughness: 1 })); felt.rotation.x = -Math.PI / 2; felt.receiveShadow = true; stage2.add(felt);
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), new THREE.MeshStandardMaterial({ map: paperTex(THREE, 0x16141C, { seed: 29, dark: true, repeat: 4 }), roughness: 1 })); backdrop.position.set(0, 7, -4); backdrop.receiveShadow = true; stage2.add(backdrop);
  const props = new THREE.Group(); stage2.add(props); W.props = props;
  for (const x of STEP_X) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.55, .6, .16, 64), new THREE.MeshStandardMaterial({ color: 0x2A2633, roughness: .6 })); p.position.set(x, .08, 0); p.castShadow = p.receiveShadow = true; props.add(p); }
  const ext = (s: T3, depth: number) => new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 1, curveSegments: 64 });
  { // eye
    const s = new THREE.Shape(); s.moveTo(-.9, 0); s.quadraticCurveTo(0, .78, .9, 0); s.quadraticCurveTo(0, -.78, -.9, 0);
    const h = new THREE.Path(); h.moveTo(-.8, 0); h.quadraticCurveTo(0, .64, .8, 0); h.quadraticCurveTo(0, -.64, -.8, 0); s.holes.push(h);
    W.eyeFrame = new THREE.Mesh(ext(s, .05), [cream, mCardSide]); W.eyeFrame.position.set(0, 1.05, 0); W.eyeFrame.castShadow = true; props.add(W.eyeFrame);
    W.eyeRing = new THREE.Mesh(new THREE.TorusGeometry(.26, .035, 16, 64), brass); W.eyeRing.position.set(0, 1.05, .03); props.add(W.eyeRing);
    W.iris = new THREE.Mesh(new THREE.SphereGeometry(.14, 32, 24), new THREE.MeshPhysicalMaterial({ color: 0xE3A042, emissive: 0xC77A20, emissiveIntensity: 1.3, metalness: .6, roughness: .25, envMap: env })); W.iris.position.set(0, 1.05, .08); props.add(W.iris);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .65, 8), brass); post.position.set(0, .48, 0); props.add(post);
  }
  { // cupped hands
    const s = new THREE.Shape(); s.moveTo(-1.0, .55); s.quadraticCurveTo(-1.1, .1, -.86, -.12); s.absarc(0, .32, .95, Math.PI * 1.2, Math.PI * 1.8, false); s.quadraticCurveTo(1.1, .1, 1.0, .55); s.lineTo(.9, .55); s.quadraticCurveTo(.96, .16, .74, -.04); s.absarc(0, .32, .82, Math.PI * 1.78, Math.PI * 1.22, true); s.quadraticCurveTo(-.96, .16, -.9, .55); s.closePath();
    W.hands = new THREE.Mesh(ext(s, .06), [cream, mCardSide]); W.hands.position.set(STEP_X[1], .7, 0); W.hands.castShadow = true; props.add(W.hands);
  }
  { // two halves and the seam
    const half = (right: boolean, mat: T3) => { const s = new THREE.Shape(); s.absarc(0, 0, .8, Math.PI / 2, Math.PI * 1.5, right); s.closePath(); const m = new THREE.Mesh(ext(s, .06), [mat, mCardSide]); m.castShadow = true; props.add(m); return m; };
    W.halfL = half(false, mInk); W.halfR = half(true, cream);
    W.seam = new THREE.Mesh(new THREE.BoxGeometry(.03, 1.62, .08), amber); W.seam.position.set(STEP_X[2], 1.0, .02); props.add(W.seam);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .3, 8), brass); post.position.set(STEP_X[2], .2, 0); props.add(post);
  }
  W.bokeh = new THREE.Group(); scene.add(W.bokeh);
  { const r = rng(77); for (let i = 0; i < 26; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.05 + r() * .05, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xffb04a, emissiveIntensity: 6 + r() * 6 })); b.position.set((r() - .5) * 14, .6 + r() * 3.5, -3 - r() * 4); W.bokeh.add(b); } }

  // ---- the floor disc (S12) ----
  const disc = (a0: number, mat: T3) => { const m = new THREE.Mesh(new THREE.CircleGeometry(1.45, 96, a0, Math.PI), mat); m.rotation.x = -Math.PI / 2; m.position.y = .004; m.receiveShadow = true; scene.add(m); return m; };
  W.discL = disc(Math.PI / 2, new THREE.MeshStandardMaterial({ map: paperTex(THREE, COL.inkCard, { seed: 41, dark: true }), roughness: .85 }));
  W.discR = disc(-Math.PI / 2, new THREE.MeshStandardMaterial({ map: paperTex(THREE, 0xF6EFE2, { seed: 43 }), roughness: .9 }));
  W.discSeam = new THREE.Mesh(new THREE.BoxGeometry(.035, .012, 2.9), amber); scene.add(W.discSeam);

  W.v = V(0, 0, 0); // scratch vector for per-frame maths (reused, never re-created)
  W.v2 = V(0, 0, 0);
  return W;
}

// ---------------------------------------------------------------- post: depth of field, grade, grain
export function makePost(THREE: T3, renderer: T3, w: number, h: number) {
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 2 });
  rt.depthTexture = new THREE.DepthTexture(w, h); rt.depthTexture.type = THREE.FloatType;
  const mat = new THREE.ShaderMaterial({
    uniforms: { tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, near: { value: .1 }, far: { value: 200 }, focus: { value: 5 }, aperture: { value: 18 }, maxBlur: { value: 22 }, res: { value: new THREE.Vector2(w, h) }, scale: { value: 1 }, seed: { value: 1 }, exposure: { value: 1 }, vig: { value: .35 }, grain: { value: .045 } },
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
        // in-focus pixels (most of the frame) skip the gather entirely
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
        col = mix(col, col * vec3(1.03, 1.0, .95), .6);
        col = col * .97 + vec3(.022, .016, .026);
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
