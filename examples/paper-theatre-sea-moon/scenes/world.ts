// @ts-nocheck
// 海月公主 — the 3D world: castle, seabed, Moon Tower room, theatre, paper puppet, light and the film pipeline.
import type { FrameContext, SetupContext } from '@mografy/runtime';
import type { BuildContext, Stage } from './three.js';
import { THREE, bindThree, initShared, bakeCaustics, TAU, V, clamp, lerp, smooth, rng, merge, T, lathe, spline, surface, canvasTex, ashlar, rockBump, water, G, F, GLSL_FOG } from './lib.js';
import { buildCastle, buildSeabed, groundH, TERRACE, MOON } from './castle.js';
import { buildTheatre } from './theatre.js';
import { buildJelly, buildFish, buildSnow, buildGlows, buildRings } from './life.js';
import { makePost, makeMirror } from './post.js';

export const W = 1920, H = 1080;
export const STAGE_Y = 1500;

/** Loaded through a canvas so flipY holds and mipmaps average premultiplied colour (no dark fringes). */
async function art(ctx: SetupContext, file: string, srgb = false) {
  const img = await ctx.loadImage('assets/' + file) as ImageBitmap, c = new OffscreenCanvas(img.width, img.height); c.getContext('2d').drawImage(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; t.premultiplyAlpha = true; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
}

export async function buildWorld(b: BuildContext) {
const { renderer, scene, camera } = b, ctx = b.setup;
bindThree(b.THREE); initShared();
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping; renderer.setClearColor(0x000000, 1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
bakeCaustics(renderer);
camera.near = .3; camera.far = 3400; camera.aspect = W / H; camera.updateProjectionMatrix();
const sea = new THREE.Group(), stage = new THREE.Group(); scene.add(sea, stage); stage.position.set(0, STAGE_Y, 0);

// ---------- environment for reflections ----------
{
  const e = new THREE.Scene(), g = new THREE.SphereGeometry(10, 32, 24);
  e.add(new THREE.Mesh(g, new THREE.ShaderMaterial({ side: THREE.BackSide, vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `varying vec3 vP; void main(){ vec3 d = normalize(vP); vec3 c = mix(vec3(.02, .05, .16), vec3(.1, .26, .62), smoothstep(-.3, .6, d.y)); c += vec3(.55, .78, 1.) * pow(max(dot(d, normalize(vec3(.2, .95, .24))), 0.), 14.) * 3.; c += vec3(.8, .55, 1.) * pow(max(dot(d, normalize(vec3(-.8, .1, .5))), 0.), 6.) * .5; gl_FragColor = vec4(c, 1.); }` })));
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(e, .02).texture; scene.environmentIntensity = 1; pm.dispose();
}

// ---------- materials ----------
const masonry = ashlar(21), rb = rockBump(6);
const R = {};
R.stone = water(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, map: masonry.map, bumpMap: masonry.bump, bumpScale: 1.5, vertexColors: true, roughness: .5, envMapIntensity: .55 }), 1);
R.trim = water(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: '#f1ecff', roughness: .33, metalness: .05, envMapIntensity: .9 }), .9);
R.roof = water(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .22, metalness: .1, clearcoat: 1, clearcoatRoughness: .14, iridescence: .85, iridescenceIOR: 1.5, iridescenceThicknessRange: [180, 520], envMapIntensity: 1.25 }), .7);
R.silver = water(new THREE.MeshStandardMaterial({ color: '#dfe6ff', roughness: .24, metalness: 1, envMapIntensity: 1.5 }), .3);
R.dark = water(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: '#2a2f72', roughness: .7 }), .4);
R.stoneI = water(new THREE.MeshStandardMaterial({ color: '#cfc9ee', roughness: .6 }), 1);
R.roofI = water(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .32, envMapIntensity: 1 }), .7);
R.ground = water(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, bumpMap: rb, bumpScale: 1 }), 1.3);
rb.repeat.set(26, 26);
R.rock = water(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .86, bumpMap: rb, bumpScale: 1.2 }), 1.1);
R.coral = water(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .55 }), .9);
R.fish = water(new THREE.MeshStandardMaterial({ color: '#d7e8ff', roughness: .3, metalness: .8, side: THREE.DoubleSide }), .3);
R.window = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  uniforms: { ...F, uGain: { value: 1 }, uA: { value: new THREE.Color('#bfe0ff') }, uB: { value: new THREE.Color('#ffb4ec') }, uC: { value: new THREE.Color('#8fe9ff') }, uTime: G.uTime },
  vertexShader: `attribute float aLit, aTint; varying float vL, vT; varying vec2 vU; varying vec3 vWP; void main(){ vL = aLit; vT = aTint; vU = uv; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `varying float vL, vT; varying vec2 vU; varying vec3 vWP; uniform float uGain; uniform vec3 uA, uB, uC; ${GLSL_FOG}
    void main(){
      float bars = 1. - .72 * (smoothstep(.03, .0, abs(vU.x - .5)) + smoothstep(.022, .0, abs(fract(vU.y * 3.2) - .5)));
      float grad = mix(1.25, .55, vU.y);
      vec3 lit = mix(uA, vT < .5 ? uB : uC, step(.001, vT) * clamp(abs(vT - .5) * 2. + .0, .55, 1.));
      vec3 c = mix(vec3(.012, .02, .06), lit * (2.6 + 3.4 * vL) * grad * bars * uGain, vL);
      float f = exp(-pow(length(vWP - cameraPosition) * uFogD, 1.3));
      gl_FragColor = vec4(mix(seaCol(normalize(vWP - cameraPosition)), c, mix(f, pow(f, .4), vL)), 1.);
    }`,
});
const mirror = makeMirror(renderer, 960, 540);
const inlay = canvasTex(2048, 2048, (x, w) => {
  const c = w / 2, K = w / 2 / 10.6;
  x.fillStyle = '#d9d6f2'; x.fillRect(0, 0, w, w);
  const q = rng(31); for (let i = 0; i < 90; i++) { x.strokeStyle = `rgba(150,140,210,${q() * .16})`; x.lineWidth = 1 + q() * 3; x.beginPath(); let px = q() * w, py = q() * w; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (q() - .5) * 180; py += (q() - .5) * 180; x.lineTo(px, py); } x.stroke(); }
  x.strokeStyle = 'rgba(255,255,255,.45)'; x.lineWidth = 2; for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; x.beginPath(); x.moveTo(c + Math.cos(a) * K * 2.6, c + Math.sin(a) * K * 2.6); x.lineTo(c + Math.cos(a) * K * 7.2, c + Math.sin(a) * K * 7.2); x.stroke(); }
  for (const [r, lw] of [[10.05, 16], [9.6, 4], [7.2, 8], [6.95, 3], [2.6, 5], [2.4, 3]]) { x.strokeStyle = '#ffffff'; x.lineWidth = lw; x.beginPath(); x.arc(c, c, r * K, 0, TAU); x.stroke(); }
});
const glowInlay = canvasTex(2048, 2048, (x, w) => {                     // the moon-phase ring that lights up under her song
  x.fillStyle = '#000'; x.fillRect(0, 0, w, w); const c = w / 2, K = w / 2 / 10.6;
  for (const [r, lw] of [[10.05, 14], [9.6, 4], [7.2, 8], [6.95, 3], [2.6, 5], [2.4, 3]]) { x.strokeStyle = '#fff'; x.lineWidth = lw; x.beginPath(); x.arc(c, c, r * K, 0, TAU); x.stroke(); }
  const n = 16; for (let i = 0; i < n; i++) { const a = i / n * TAU, px = c + Math.cos(a) * K * 8.3, py = c + Math.sin(a) * K * 8.3, rr = K * .62, ph = i / n * TAU; x.save(); x.translate(px, py); x.rotate(a + Math.PI / 2); x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, rr, 0, TAU); x.fill(); x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000'; x.beginPath(); x.arc(Math.cos(ph) * rr * 1.5, 0, rr * 1.15, 0, TAU); x.globalCompositeOperation = 'source-over'; x.fillStyle = '#000'; x.fill(); x.restore(); }
}, { linear: false });
const deckM = water(new THREE.MeshStandardMaterial({ map: inlay, roughness: .34, metalness: .05, emissive: '#ffffff', emissiveMap: glowInlay, emissiveIntensity: 0, envMapIntensity: .8 }), 1.4, {
  key: 'deck', uniforms: mirror.uniform,
  patch: s => {
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tMirror; uniform mat4 uMirrorM; uniform float uMirrorAmt;')
      .replace('#include <opaque_fragment>', `{ vec4 mc = uMirrorM * vec4(vWP + vec3(0., .0, 0.), 1.); vec2 mu = mc.xy / mc.w; mu += .004 * vec2(vn(vWP.xz * 3.), vn(vWP.zx * 3. + 4.)) ;
        vec3 ref = texture2D(tMirror, mu).rgb; float fr = .42 + .58 * pow(1. - max(dot(normalize(vViewPosition), normal), 0.), 3.); outgoingLight = mix(outgoingLight, ref + outgoingLight * .4, uMirrorAmt * fr); }
        #include <opaque_fragment>`);
  },
});

// ---------- sky ----------
const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 32), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, uniforms: { ...F, uNear: { value: 0 } },
  vertexShader: 'varying vec3 vD; void main(){ vD = (modelMatrix * vec4(position, 1.)).xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.); gl_Position.z = gl_Position.w * .99999; }',
  fragmentShader: `varying vec3 vD; ${GLSL_FOG}
    void main(){
      vec3 d = normalize(vD), c = seaCol(d);
      float top = uSurfY - cameraPosition.y;
      if (d.y > .03 && top > 0.) {
        float t = top / d.y; vec3 p = cameraPosition + d * t; vec2 s = p.xz * .05;
        vec2 w = vec2(vn(s * 1.3 + uFogT * .3), vn(s * 1.3 + 7. - uFogT * .25)) - .5;
        float line = pow(1. - abs(2. * vn(s * 2.4 + w * 3.4 + uFogT * .2) - 1.), 9.) + .5 * pow(1. - abs(2. * vn(s * 5.1 - w * 5. - uFogT * .2) - 1.), 12.);
        float nearK = exp(-top * .0065) * smoothstep(.05, .4, d.y);
        vec3 dw = normalize(d + vec3(w.x, 0., w.y) * .007);
        float a = acos(clamp(dot(dw, uMoonDir), -1., 1.)), r = .1;
        float disc = smoothstep(r, r * .86, a), halo = exp(-a * a * 9.) * .85 + exp(-a * a * 90.) * .9;
        vec3 E = normalize(uMoonDir + normalize(vec3(1., 0., -.25)) * (1. - uEclipse) * 1.4);    // the black paper disc slides over the moon
        float cover = uEclipse > 0. ? smoothstep(r * 1.02, r * .94, acos(clamp(dot(dw, E), -1., 1.))) : 0.;
        float snell = smoothstep(.56, .74, d.y + w.x * .1);
        vec3 moonC = vec3(1., .96, .86) * 5.;
        c += nearK * (uTop * snell * (.12 + .85 * line) * (uMoonA * .9 + .1));
        c += nearK * (moonC * disc + vec3(.7, .86, 1.) * halo * .9 * uMoonA) * (1. - cover);
        c = mix(c, vec3(.003, .005, .016) + c * .02, cover * min(1., nearK * 2.2));
        if (uEclipse > 0.) {                                                                     // its two threads
          vec3 rg = normalize(cross(E, vec3(0., 1., 0.))), upv = cross(rg, E); float pz = dot(dw, E), px = dot(dw, rg) / pz, py = dot(dw, upv) / pz;
          float ln = smoothstep(.0016, .0006, abs(abs(px) - r * .6)) * step(0., py);
          c = mix(c, vec3(.02, .03, .08), ln * .85);
        }
      }
      gl_FragColor = vec4(c, 1.);
    }`,
}));
sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);

// ---------- light ----------
const hemi = new THREE.HemisphereLight('#a7d0ff', '#352a8c', 1); scene.add(hemi);
const key = new THREE.DirectionalLight('#cfe6ff', 2.4); key.castShadow = true; key.shadow.mapSize.set(4096, 4096); key.shadow.camera.left = -120; key.shadow.camera.right = 120; key.shadow.camera.top = 120; key.shadow.camera.bottom = -120; key.shadow.camera.near = 20; key.shadow.camera.far = 520; key.shadow.bias = -.0007; key.shadow.normalBias = .06; scene.add(key, key.target);
const pl = (c, d = 0) => { const p = new THREE.PointLight(c, 0, d, 1.6); scene.add(p); return p; };
const L = { a: pl('#bde9ff', 60), b: pl('#e9b4ff', 80), c: pl('#9fd9ff', 120), d: pl('#ffc4f0', 120) };

// ---------- build the sea ----------
const bedG = new THREE.Group(), castleG = new THREE.Group(); sea.add(bedG, castleG);
const bed = buildSeabed(bedG, R), castle = buildCastle(castleG, R);
const r0 = rng(808);
const { x: TX, z: TZ, y: TY, r: TR } = TERRACE;
for (let i = 0; i < 26; i++) { const a = -.5 + i / 26 * 3.4 + r0() * .1, d = TR + 1.2 + r0() * 3, x = TX + Math.sin(a) * d, z = TZ + Math.cos(a) * d; bed.addCoral(x, z, .6 + r0() * .9, TY - 6.4 - r0() * 2); }
bed.finishCoral();
const winAttr = new THREE.InstancedBufferAttribute(new Float32Array(castle.wins.length), 1);
castle.winM.geometry.setAttribute('aTint', winAttr);
const fish = buildFish(bedG, R, [{ n: 240, x: -90, y: 46, z: 58, rx: 22, rz: 9, ry: 9, dir: 0, s: .55, v: 6 }, { n: 180, x: 80, y: 62, z: 40, rx: 18, rz: 8, ry: 9, dir: Math.PI, s: .5, v: -5 }, { n: 110, x: -40, y: 28, z: 74, rx: 14, rz: 5, ry: 5, dir: 0, s: .36, v: 7 }, { n: 90, x: MOON.x - 30, y: MOON.floor + 3, z: MOON.z + 30, rx: 8, rz: 4, ry: 4, dir: 0, s: .34, v: 0 }]);
const jelly = buildJelly(sea), glows = buildGlows(sea), rings = buildRings(sea), snow = buildSnow(sea);
snow.material.uniforms.uH.value = 1080; glows.mesh.material.uniforms.uH.value = 1080;

// the deck
const deck = new THREE.Mesh(new THREE.CircleGeometry(TR - .04, 128).rotateX(-Math.PI / 2), deckM); deck.position.set(TX, TY, TZ); deck.receiveShadow = true; { const u = deck.geometry.attributes.uv; } sea.add(deck);

// ---------- the Moon Tower room ----------
let W_floor;
const room = new THREE.Group(); sea.add(room);
const floorY = MOON.floor + .02, ceilY = MOON.ceil + .6, mx = MOON.x, mz = MOON.z;
{
  const fTex = canvasTex(1024, 1024, (x, w) => { x.fillStyle = '#c9c6ee'; x.fillRect(0, 0, w, w); for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) { x.fillStyle = (i + j) % 2 ? '#dcd8f6' : '#b9bbe9'; x.fillRect(i * w / 7 + 1, j * w / 7 + 1, w / 7 - 2, w / 7 - 2); } });
  const fm = deckM.clone(); fm.map = fTex; fm.emissiveIntensity = 0; fm.onBeforeCompile = deckM.onBeforeCompile; fm.customProgramCacheKey = deckM.customProgramCacheKey; fm.roughness = .14;
  const fl = new THREE.Mesh(new THREE.CircleGeometry(7.6, 64).rotateX(-Math.PI / 2), fm); fl.position.set(mx, floorY, mz); room.add(fl); W_floor = fl;
  const panelT = canvasTex(2048, 512, (x, w, h) => {
    x.fillStyle = '#d7d2f4'; x.fillRect(0, 0, w, h); const n = 9;
    for (let i = 0; i < n; i++) { const px = i * w / n; x.strokeStyle = '#f7f4ff'; x.lineWidth = 7; x.strokeRect(px + 26, 26, w / n - 52, h * .62 - 26); x.strokeRect(px + 26, h * .68, w / n - 52, h * .26); x.strokeStyle = '#a9a3dc'; x.lineWidth = 2; x.strokeRect(px + 34, 34, w / n - 68, h * .62 - 42); x.strokeRect(px + 34, h * .68 + 8, w / n - 68, h * .26 - 16); }
  });
  const wm = water(new THREE.MeshStandardMaterial({ map: panelT, side: THREE.DoubleSide, roughness: .55 }), 2.2);
  const gap = .64, wall = new THREE.CylinderGeometry(7.15, 7.15, ceilY - floorY, 80, 1, true, gap, TAU - gap * 2); const ww = new THREE.Mesh(wall, wm); ww.position.set(mx, (ceilY + floorY) / 2, mz); room.add(ww);
  const ceil = T(lathe(spline([[7.2, ceilY], [6, ceilY + .9], [3.4, ceilY + 1.5], [.03, ceilY + 1.7]], 22), 64), mx, 0, mz); const cm = new THREE.Mesh(ceil, water(new THREE.MeshStandardMaterial({ color: '#dcd6f8', side: THREE.DoubleSide, roughness: .6 }), 1.6)); room.add(cm);
  // cornice + base mouldings
  for (const y of [ceilY - .02, floorY + .14]) { const g = lathe([[7.13, y - .13], [7.0, y - .06], [7.0, y + .06], [7.13, y + .13]], 80, gap, TAU - gap * 2); T(g, mx, 0, mz); const mm = new THREE.Mesh(g, R.trim.clone()); mm.material.side = THREE.DoubleSide; room.add(mm); }
  // bay return walls, so the opening reads as a deep embrasure
  for (const sd of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(.8, ceilY - floorY, 1.8), wm); m.position.set(mx + sd * 3.42, (ceilY + floorY) / 2, mz + 6.45); room.add(m); }
  // chaise
  const Rb = THREE.RoundedBoxGeometry; const seatZ = mz + 4.5, seatH = .78;
  const seat = new THREE.Mesh(new Rb(4.2, .3, 1.02, 5, .13), water(new THREE.MeshStandardMaterial({ color: '#f4f0ff', roughness: .62 }), .8)); seat.position.set(mx + .9, floorY + seatH, seatZ); seat.castShadow = true; room.add(seat);
  const backr = new THREE.Mesh(new Rb(4.2, .9, .3, 5, .13), seat.material); backr.position.set(mx + .9, floorY + seatH + .46, seatZ + .46); backr.rotation.x = -.14; backr.castShadow = true; room.add(backr);
  for (const [dx, dz] of [[-1.02, -.38], [2.82, -.38], [-1.02, .38], [2.82, .38]]) { const g = T(lathe(spline([[.03, 0], [.08, .05], [.05, .2], [.1, .4], [.07, .55], [.13, .62]], 18), 12), mx + dx, floorY, seatZ + dz); room.add(new THREE.Mesh(g, R.silver)); }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(4.3, .08, 1.08), R.silver); rail.position.set(mx + .9, floorY + seatH - .2, seatZ); room.add(rail);
  const book = new THREE.Mesh(new Rb(.74, .1, .52, 2, .02), water(new THREE.MeshStandardMaterial({ color: '#2d3b96', roughness: .5 }), .3)); book.position.set(mx + 2.5, floorY + seatH + .2, seatZ - .05); book.rotation.y = .2; room.add(book);
  // sheer curtains: the left side of the window
  const cur = [-1, 1].map(sd => { const g = surface(160, 24, (u, v) => { const x = u * 2.2 + (sd > 0 ? 0 : 0), z = Math.sin(u * 44 + v * 2) * .1 + Math.sin(u * 19) * .1; return [sd * (-3.6 + x * (.72 + .24 * Math.sin(v * 3.14)) * 1), v * (ceilY - floorY - .3), z]; }, false); const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: '#efeaff', transparent: true, opacity: .42, side: THREE.DoubleSide, roughness: .6, depthWrite: false, envMapIntensity: .5 })); water(m.material, 1.6); m.position.set(mx, floorY + .05, mz + 5.5); m.renderOrder = 2; room.add(m); return m; });
}



// ---------- paper puppet ----------
const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blank.needsUpdate = true;
const cards = {};
for (const k of ['sit', 'sad', 'happy', 'joy', 'free']) {
  cards[k] = { art: await art(ctx, `mirea-${k}.webp`), rim: await art(ctx, `rim-${k}.webp`), mask: k === 'free' ? blank : await art(ctx, `mask-${k}.webp`), paper: await art(ctx, `paper-${k}.webp`, true) };
}
const pieceTex = await art(ctx, 'mirea-piece.webp');
const pupM = new THREE.ShaderMaterial({
  transparent: true, side: THREE.DoubleSide,
  uniforms: { ...F, uTime: G.uTime, tArt: { value: null }, tRim: { value: null }, tUm: { value: null }, uKey: { value: new THREE.Color(1, 1, 1) }, uRimC: { value: new THREE.Color(0, 0, 0) }, uUmb: { value: 0 }, uUmbC: { value: new THREE.Color('#9fe4ff') }, uCaus: { value: 0 }, uShade: { value: 0 }, uCut: { value: 0 } },
  vertexShader: `varying vec2 vU; varying vec3 vWP; void main(){ vU = uv; vec4 w = modelMatrix * vec4(position, 1.); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `varying vec2 vU; varying vec3 vWP; uniform sampler2D tArt, tRim, tUm; uniform vec3 uKey, uRimC, uUmbC; uniform float uUmb, uCaus, uShade, uTime, uCut; ${GLSL_FOG}
    void main(){
      vec4 a0 = texture2D(tArt, vU); if (a0.a < .05) discard;
      vec3 str = a0.rgb / a0.a; float alpha = a0.a, edge = 0.;
      if (uCut > 0.) {                                                     // the paper dissolves from the canopy outwards
        float r = length((vU - vec2(.3, .84)) * vec2(.667, 1.)) / .78 + (vn(vU * 16.) - .5) * .16;
        if (r < uCut - .02) discard; edge = smoothstep(uCut + .05, uCut, r);
      }
      float rim = texture2D(tRim, vU).r, um = texture2D(tUm, vU).r;
      vec3 lin = pow(str, vec3(2.2));
      vec3 c = pow(lin, vec3(1.16)) * 1.12; float lm = dot(c, vec3(.3, .59, .11)); c = max(mix(vec3(lm), c, 1.28), 0.);   // holds the printed art's colour through the film curve
      c *= uKey;
      c = mix(c, c * vec3(.34, .36, .62), uShade * (1. - um));   // cold shadow pass for dark shots
      c += uRimC * rim * .16;
      float ca = vn(vWP.xy * 3.1 + uTime * .2 + vWP.z) * vn(vWP.yx * 5. - uTime * .17); c *= 1. + uCaus * pow(ca * 2.2, 3.);
      c += lin * uUmbC * um * uUmb * (.9 + .9 * alpha);
      c += uUmbC * edge * 3.;
      gl_FragColor = vec4(waterFog(c, vWP), alpha);
    }`,
});
const bakM = new THREE.MeshStandardMaterial({ color: '#efe9ff', transparent: true, alphaTest: .4, roughness: .9, side: THREE.DoubleSide, envMapIntensity: .3 });
const pup = new THREE.Group(); sea.add(pup);
const cardG = new THREE.PlaneGeometry(1, 1.5);
const pupF = new THREE.Mesh(cardG, pupM), pupB = new THREE.Mesh(cardG, bakM); pupB.position.z = -.018; pupF.renderOrder = 3; pup.add(pupB, pupF);
const pieceM = pupM.clone(); for (const k of Object.keys(F)) pieceM.uniforms[k] = F[k]; pieceM.uniforms.uTime = G.uTime; pieceM.uniforms.tArt.value = pieceTex; pieceM.uniforms.tRim.value = cards.joy.rim; pieceM.uniforms.tUm.value = cards.joy.mask;
const piece = new THREE.Mesh(cardG, pieceM); piece.renderOrder = 4; piece.visible = false; sea.add(piece);
const threadM = new THREE.MeshBasicMaterial({ color: new THREE.Color(.34, .42, .66) });
const threads = [[.55, .97], [.82, .6]].map(([u, v]) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(.0045, .0045, 240, 5), threadM); t.userData = { u, v }; t.frustumCulled = false; pup.add(t); return t; });
const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, color: '#080a2c', opacity: .42, alphaMap: canvasTex(128, 128, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 2, w / 2, w / 2, w / 2); g.addColorStop(0, '#fff'); g.addColorStop(.5, '#777'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, w, w); }) })); contact.rotation.x = -Math.PI / 2; contact.renderOrder = 2; sea.add(contact);

const th = buildTheatre(stage, R);
const post = makePost(renderer, W, H);
const scA = new THREE.Color(), scB = new THREE.Color();
const seaKeys = ['fog', 'moon', 'hemi', 'env', 'snow', 'key', 'caustic', 'win', 'eclipse'], seaCols = ['deep', 'mid', 'top', 'glow', 'causticC', 'hemiC', 'hemiG'];
const hide = { deck: [deck, bedG], room: [W_floor, bedG] };
// the Moon Tower is hollow for the room inside: from outside it is filled, so no camera can see through it
const moonCore = new THREE.Mesh(new THREE.CylinderGeometry(MOON.r - .5, MOON.r - .5, MOON.h - 1, 40), new THREE.MeshBasicMaterial({ color: '#0a1238' })); moonCore.position.set(MOON.x, MOON.y0 + MOON.h / 2, MOON.z - .6); castleG.add(moonCore);
// the seabed runs on past its detailed heart, so no shot ever finds its edge
const farBed = new THREE.Mesh(new THREE.RingGeometry(240, 3000, 96, 1).rotateX(-Math.PI / 2), water(new THREE.MeshStandardMaterial({ color: '#232a70', roughness: 1 }), 0)); farBed.position.y = -9; bedG.add(farBed);

const api = {
  TERRACE, MOON, floorY, castle, th, o: {} as any,
  cam(p, l, fov = 30, roll = 0) { camera.fov = fov; camera.position.set(p[0], p[1], p[2]); camera.up.set(Math.sin(roll), Math.cos(roll), 0); camera.lookAt(l[0], l[1], l[2]); camera.updateProjectionMatrix(); camera.updateMatrixWorld(); },
  /** Blends two sea states; every number and colour eases with `k`. */
  mix(a, b, k) { const o: any = {}; for (const n of seaKeys) { const x = a[n], y = b[n]; if (x != null || y != null) o[n] = lerp(x ?? DEF[n], y ?? DEF[n], k); } for (const n of seaCols) { scA.set(a[n] ?? DEF[n]); scB.set(b[n] ?? DEF[n]); o[n] = '#' + scA.lerp(scB, k).getHexString(); } return o; },
  sea(o: any = {}) {
    F.uFogD.value = o.fog ?? DEF.fog; const m = o.moon ?? 1; F.uMoonA.value = m; F.uEclipse.value = o.eclipse ?? 0;
    F.uDeep.value.set(o.deep ?? DEF.deep); F.uMid.value.set(o.mid ?? DEF.mid); F.uTop.value.set(o.top ?? DEF.top); F.uGlowC.value.set(o.glow ?? DEF.glow);
    G.uCaustic.value = (o.caustic ?? 1) * m; G.uCausticColor.value.set(o.causticC ?? DEF.causticC);
    hemi.intensity = o.hemi ?? DEF.hemi; hemi.color.set(o.hemiC ?? DEF.hemiC); hemi.groundColor.set(o.hemiG ?? DEF.hemiG);
    key.intensity = (o.key ?? DEF.key) * m; scene.environmentIntensity = o.env ?? DEF.env;
    snow.material.uniforms.uGain.value = o.snow ?? 1; R.window.uniforms.uGain.value = o.win ?? 1;
  },
  windows(lit: Float32Array, tint: Float32Array) { castle.aLit.set(lit); winAttr.array.set(tint); castle.winM.geometry.attributes.aLit.needsUpdate = true; winAttr.needsUpdate = true; },
  light(n, p, i, c) { const l = L[n]; l.position.set(p[0], p[1], p[2]); l.intensity = i; if (c) l.color.set(c); },
  puppet(o) {
    const k = cards[o.pose]; pup.visible = contact.visible = true; pupM.uniforms.tArt.value = k.art; pupM.uniforms.tRim.value = k.rim; pupM.uniforms.tUm.value = k.mask; bakM.map = k.paper;
    const Ht = o.h ?? 3.0, foot = o.foot ?? .01, sc = Ht / 1.5; pupF.scale.set(sc, sc, 1); pupB.scale.copy(pupF.scale); pupF.position.y = pupB.position.y = Ht / 2 - Ht * foot;
    pup.position.set(o.p[0], o.p[1], o.p[2]); pup.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0, 'YXZ'); pup.updateMatrixWorld(true);
    threads.forEach(t => { t.visible = !!o.threads; t.position.set((t.userData.u - .5) * sc, Ht * t.userData.v - Ht * foot + 120, -.002); });
    pupM.uniforms.uKey.value.set(o.key ?? '#ffffff'); pupM.uniforms.uRimC.value.set(o.rim ?? '#6fa8ff'); pupM.uniforms.uUmb.value = o.umb ?? 0; pupM.uniforms.uCaus.value = o.caus ?? .25; pupM.uniforms.uShade.value = o.shade ?? 0;
    contact.position.set(o.p[0], o.p[1] + .012, o.p[2]); contact.scale.set(1.15, .8, 1); contact.visible = o.contact !== false;
  },
  /** The umbrella as a loose piece of paper: same size and place as the card it was cut from. */
  piece(o) { piece.visible = !!o; if (!o) return; const Ht = o.h ?? 3.0, sc = Ht / 1.5; piece.scale.set(sc, sc, 1); piece.position.set(o.p[0], o.p[1] + Ht / 2 - Ht * .01, o.p[2]); piece.rotation.set(0, o.ry ?? 0, o.rz ?? 0, 'YXZ'); pieceM.uniforms.uCut.value = o.cut ?? 0; pieceM.uniforms.uUmb.value = o.umb ?? 0; pieceM.uniforms.uKey.value.set(o.key ?? '#ffffff'); pieceM.uniforms.uRimC.value.set(o.rim ?? '#bfe9ff'); pieceM.uniforms.uCaus.value = 0; pieceM.uniforms.uShade.value = 0; },
  noPuppet() { pup.visible = contact.visible = piece.visible = false; },
  jelly: l => jelly.set(l), glows: l => glows.set(l),
  rings(o) { rings.visible = !!o; if (o) { rings.position.set(o.p[0], o.p[1], o.p[2]); rings.scale.setScalar(o.s); rings.rotation.set(o.rot[0], o.rot[1], o.rot[2]); rings.material.uniforms.uR.value = o.r; rings.material.uniforms.uA.value = o.a; rings.material.uniforms.uGain.value = o.g ?? 1; if (o.c) rings.material.uniforms.uC.value.set(o.c); } },
  deck(o: any = {}) { deckM.emissiveIntensity = o.glow ?? 0; deckM.emissive.set(o.c ?? '#bfe8ff'); },
  fish(t) { fish.forEach(m => { const s = m.userData; m.position.x = s.x + s.v * t; }); },
  fishRoom(x) { fish[3].position.x = x; },
  show(o) { stage.visible = !!o.theatre; sea.visible = !o.theatre; bedG.visible = o.bed !== false; castleG.visible = o.castle !== false; room.visible = !!o.room; moonCore.visible = !o.room; },
  stageLights(a) { const y = STAGE_Y; api.light('a', [0, y + 5, 9], 46 * a, '#cfe2ff'); api.light('b', [-14, y + 12, 18], 90 * a, '#d8c6ff'); api.light('c', [14, y + 12, 18], 90 * a, '#bfe0ff'); api.light('d', [4.8, y + 11, -8], 70 * a, '#ffeec4'); },
};
const DEF = { fog: .0052, moon: 1, eclipse: 0, deep: '#050c2a', mid: '#123a8c', top: '#3f86d6', glow: '#9fd0ff', caustic: 1, causticC: '#bfe6ff', hemi: .42, hemiC: '#a7d0ff', hemiG: '#352a8c', key: 1.7, env: 1, snow: 1, win: 1 };
key.position.copy(key.target.position.set(0, 20, 10)).addScaledVector(F.uMoonDir.value, 260); key.updateMatrixWorld(); key.target.updateMatrixWorld();
renderer.shadowMap.needsUpdate = true;                                    // the castle never moves: its shadow map is drawn once
return { scene, camera, post, mirror, deck, api, hide, sky };
}

export type World = Awaited<ReturnType<typeof buildWorld>>;

const LIGHT0 = { a: '#bde9ff', b: '#e9b4ff', c: '#9fd9ff', d: '#ffc4f0' };
export function resetWorld(w: World) {
  const a = w.api; a.windowsDone = false; a.noPuppet(); a.jelly([]); a.glows([]); a.rings(null); a.deck(); a.show({});
  for (const n of ['a', 'b', 'c', 'd']) a.light(n, [0, 0, 0], 0, LIGHT0[n]);   // colours too: no shot may inherit another's
  a.o = { focus: 100, aperture: 0, exposure: 1, bloom: .4, bloomThr: 1.5, vig: .4, warp: 1, shaft: 0, shaftC: '#a9d8ff', mirrorY: null, sat: 1.04, lift: .014 };
}

/** Renders the posed world through the film pipeline and draws it into the frame. */
export function renderWorld(ctx: FrameContext, s: Stage<World>, time: number, alpha = 1) {
  const w = s.objects, o = w.api.o, R = s.renderer;
  const pw = Math.max(1, Math.round(W * ctx.renderScale)), ph = Math.max(1, Math.round(H * ctx.renderScale));
  if (s.surface.width !== pw || s.surface.height !== ph) { R.setSize(pw, ph, false); w.post.setSize(pw, ph); }
  G.uTime.value = time; F.uFogT.value = time;                                 // before the mirror pass: it must see this frame's time
  w.mirror.uniform.uMirrorAmt.value = 0;
  if (o.mirrorY != null) { w.mirror.uniform.uMirrorAmt.value = o.mirrorAmt ?? .8; w.mirror.render(w.scene, w.camera, o.mirrorY, w.hide[o.mirrorHide ?? 'deck']); }
  w.post.render(w.scene, w.camera, { ...o, time, seed: 1 + time, surfY: F.uSurfY.value, moonDir: F.uMoonDir.value });
  ctx.withCanvas(c => { c.imageSmoothingQuality = 'high'; c.globalAlpha = alpha; c.drawImage(s.surface, 0, 0, W, H); c.globalAlpha = 1; });
}
