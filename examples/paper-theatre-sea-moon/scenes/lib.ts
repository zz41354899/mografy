// @ts-nocheck
// Helpers: seeded random, noise, geometry merge, canvas textures, water-light shader injection.
import type { ThreeModule } from './three.js';
/** Three.js arrives at runtime from assets/three.module.js; every world module reads it through this binding. */
export let THREE: ThreeModule;
export const bindThree = (t: ThreeModule) => { THREE = t; };

export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const V = (x?: number, y?: number, z?: number) => new THREE.Vector3(x, y, z);

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ---------- value noise ----------
const P = new Float32Array(4096); { const r = rng(7); for (let i = 0; i < 4096; i++) P[i] = r(); }
const h3 = (x, y, z) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 873191261)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return P[(h ^ (h >>> 16)) & 4095]; };
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const f = t => t * t * (3 - 2 * t), u = f(x - xi), v = f(y - yi), w = f(z - zi);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), L(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
           L(L(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), L(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v), w);
}
export function fbm(x, y, z, o = 5) { let a = .5, s = 0, n = 0; for (let i = 0; i < o; i++) { s += a * noise3(x, y, z); n += a; x *= 2.03; y *= 2.03; z *= 2.03; a *= .5; } return s / n; }
export function ridged(x, y, z, o = 4) { let a = .5, s = 0, n = 0; for (let i = 0; i < o; i++) { s += a * (1 - Math.abs(2 * noise3(x, y, z) - 1)); n += a; x *= 2.1; y *= 2.1; z *= 2.1; a *= .5; } return s / n; }

// ---------- geometry ----------
/** Merge geometries into one non-indexed BufferGeometry (position, normal, uv, color). */
export function merge(list) {
  let n = 0; const gs = list.map(g => { const h = g.index ? g.toNonIndexed() : g; n += h.attributes.position.count; return h; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of gs) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + c) * 3);
    o += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
export const T = (g, x = 0, y = 0, z = 0, ry = 0, s = 1, rx = 0, rz = 0) => {
  const m = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(s, s, s));
  return g.applyMatrix4(m);
};
/** Paint a vertex-colour gradient along y between stops [[t, '#hex'], ...] in the geometry's own bounds. */
export function gradY(g, stops, y0, y1) {
  g.computeBoundingBox(); const a = y0 ?? g.boundingBox.min.y, b = y1 ?? g.boundingBox.max.y;
  const p = g.attributes.position, c = new Float32Array(p.count * 3), C = stops.map(([t, h]) => [t, new THREE.Color(h)]), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const t = clamp((p.getY(i) - a) / (b - a)); let j = 0; while (j < C.length - 2 && t > C[j + 1][0]) j++;
    const k = clamp((t - C[j][0]) / (C[j + 1][0] - C[j][0])); tmp.copy(C[j][1]).lerp(C[j + 1][1], k);
    c[i * 3] = tmp.r; c[i * 3 + 1] = tmp.g; c[i * 3 + 2] = tmp.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
/** A lathe from [[r, y], ...] with `seg` sides. */
export function lathe(pts, seg = 48, phiStart = 0, phiLen = TAU) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, .0001), y)), seg, phiStart, phiLen);
  return g;
}
/** Dense profile: replace each segment by a smooth Catmull-Rom spline through the points. */
export function spline(pts, n = 40) {
  const c = new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  return c.getPoints(n).map(p => [p.x, p.y]);
}
/** A grid surface f(u, v) -> [x,y,z]; smooth normals. */
/** `outward` flips the winding for surfaces of revolution written as (cos u, v, sin u), so their front faces look outwards. */
export function surface(nu, nv, f, closeU = true, outward = false) {
  const p = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const u = i / nu, v = j / nv; p.push(...f(u, v)); uv.push(u, v); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; if (outward) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  if (closeU) { const n = g.attributes.normal; for (let j = 0; j <= nv; j++) { const a = j * (nu + 1), b = a + nu; const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1; n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l); } }
  return g;
}

// ---------- canvas textures ----------
export function canvasTex(w, h, draw, opt = {}) {
  const c = new OffscreenCanvas(w, h), x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = opt.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 8;
  if (opt.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...opt.repeat); } return t;
}
/** Ashlar masonry: colour and bump. */
export function ashlar(seed, rows = 12, cols = 9) {
  const r = rng(seed); const S = 1024, blocks = [];
  const rh = S / rows;
  for (let j = 0; j < rows; j++) { const off = (j % 2) * .5; for (let i = -1; i < cols; i++) { const w = S / cols; blocks.push([(i + off + (r() - .5) * .06) * w, j * rh, w, rh, r(), r()]); } }
  const paint = (x, bump) => {
    x.fillStyle = bump ? '#555' : '#c9c9d6'; x.fillRect(0, 0, S, S);
    for (const [bx, by, bw, bh, a, b] of blocks) {
      const inset = 2.2; const l = bump ? 170 + a * 60 : 226 + a * 26;
      x.fillStyle = bump ? `rgb(${l},${l},${l})` : `rgb(${l - 8 + b * 8},${l - 6},${l + 2})`;
      x.beginPath(); x.roundRect(bx + inset, by + inset, bw - inset * 2, bh - inset * 2, 5); x.fill();
      if (bx + bw > S) { x.beginPath(); x.roundRect(bx - S + inset, by + inset, bw - inset * 2, bh - inset * 2, 5); x.fill(); }
    }
    // veins and pits
    for (let i = 0; i < 900; i++) { const q = r(); x.fillStyle = bump ? `rgba(0,0,0,${q * .12})` : `rgba(120,110,170,${q * .05})`; x.beginPath(); x.arc(r() * S, r() * S, 1 + r() * 7, 0, TAU); x.fill(); }
  };
  const map = canvasTex(S, S, (x) => paint(x, false), { repeat: [1, 1] });
  const bump = canvasTex(S, S, (x) => paint(x, true), { repeat: [1, 1], linear: true });
  return { map, bump };
}
export function rockBump(seed) {
  const r = rng(seed), S = 512;
  return canvasTex(S, S, x => {
    x.fillStyle = '#777'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) { const q = r(); x.fillStyle = q > .5 ? `rgba(255,255,255,${r() * .13})` : `rgba(0,0,0,${r() * .18})`; const R = 2 + r() * r() * 42; x.beginPath(); x.ellipse(r() * S, r() * S, R, R * (.3 + r() * .7), r() * 3, 0, TAU); x.fill(); }
  }, { repeat: [1, 1], linear: true });
}

// ---------- shared water-light uniforms ----------
export const G: any = {}, F: any = {};
export function initShared() {
  Object.assign(G, { uTime: { value: 0 }, uCaustic: { value: 1 }, uCausticColor: { value: new THREE.Color('#bfe6ff') }, uCausticScale: { value: .036 }, tCaustic: { value: null } });
  Object.assign(F, {
    uFogD: { value: .006 }, uFogT: { value: 0 }, uMoonA: { value: 1 }, uSurfY: { value: 190 }, uEclipse: { value: 0 },
    uDeep: { value: new THREE.Color('#071030') }, uMid: { value: new THREE.Color('#123a8c') }, uTop: { value: new THREE.Color('#3f86d6') },
    uMoonDir: { value: new THREE.Vector3(.42, .82, .38).normalize() }, uGlowC: { value: new THREE.Color('#9fd0ff') },
  });
}
export const GLSL_FOG = /* glsl */`
uniform float uFogD, uFogT, uMoonA, uSurfY, uEclipse; uniform vec3 uDeep, uMid, uTop, uMoonDir, uGlowC;
float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hsh(i), hsh(i + vec2(1, 0)), f.x), mix(hsh(i + vec2(0, 1)), hsh(i + vec2(1, 1)), f.x), f.y); }
vec3 seaCol(vec3 d){
  float u = d.y * .5 + .5;
  vec3 c = mix(uDeep, uMid, smoothstep(.3, .55, u));
  c = mix(c, uTop, smoothstep(.54, .96, u));
  float m = max(dot(d, uMoonDir), 0.);
  c += uGlowC * uMoonA * (pow(m, 5.) * .2 + pow(m, 26.) * .45);
  return c;
}
float fogK(vec3 wp){ float L = length(wp - cameraPosition); return exp(-pow(L * uFogD, 1.3)); }
vec3 waterFog(vec3 c, vec3 wp){ vec3 v = wp - cameraPosition; float L = length(v); return mix(seaCol(v / L), c, exp(-pow(L * uFogD, 1.3))); }`;
const GLSL_CAUSTIC = /* glsl */`
uniform float uTime, uCaustic, uCausticScale; uniform vec3 uCausticColor; uniform sampler2D tCaustic;
float cSample(vec2 p){
  return min(texture2D(tCaustic, p + vec2(.021, .013) * uTime).r, texture2D(tCaustic, p * 1.23 + vec2(.37 - .017 * uTime, .11 + .019 * uTime)).r);
}`;
/** Bakes one tile of water caustics at setup; every lit material then samples it for a couple of texture reads. */
export function bakeCaustics(renderer: any) {
  const rt = new THREE.WebGLRenderTarget(1024, 1024, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: false });
  const m = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `varying vec2 vU; const float TAU = 6.2831853;
    void main(){ vec2 p = mod(vU * TAU, TAU) - 250., i = p; float c = 1., inten = .0065;
      for (int n = 0; n < 5; n++) { float t = 7.3 * (1. - 3.5 / float(n + 1)); i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x)); c += 1. / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten))); }
      c /= 5.; c = 1.17 - pow(c, 1.4); gl_FragColor = vec4(vec3(clamp(pow(abs(c), 8.) * .45, 0., 1.)), 1.); }` });
  const sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); q.frustumCulled = false; sc.add(q);
  renderer.setRenderTarget(rt); renderer.render(sc, cam); renderer.setRenderTarget(null);
  G.tCaustic.value = rt.texture;
}
/** Adds world-space caustics to any lit material. `amp` scales this material's share. */
export function water(mat, amp = 1, extra = {}) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (s, r) => {
    prev && prev(s, r);
    Object.assign(s.uniforms, F, { uTime: G.uTime, uCaustic: G.uCaustic, uCausticColor: G.uCausticColor, uCausticScale: G.uCausticScale, tCaustic: G.tCaustic, uAmpC: { value: amp } }, extra.uniforms || {});
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 wp = vec4(transformed, 1.);
#ifdef USE_INSTANCING
        wp = instanceMatrix * wp;
#endif
        vWP = (modelMatrix * wp).xyz; }`);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWP; uniform float uAmpC;\n${GLSL_FOG}\n${GLSL_CAUSTIC}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>\n      gl_FragColor.rgb = waterFog(gl_FragColor.rgb, vWP);`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      { vec3 wN = normalize((vec4(normal, 0.) * viewMatrix).xyz);
        float up = smoothstep(.25, .8, abs(wN.y));
        float cWall = up < .99 ? cSample(vec2(vWP.x + vWP.z * .7, vWP.y * 1.1 - vWP.z * .35) * uCausticScale) : 0., cFloor = up > .01 ? cSample(vWP.xz * uCausticScale) : 0.;
        float cc = mix(cWall, cFloor, up) * 2.6;
        float k = mix(.25, 1., clamp(wN.y * .5 + .5, 0., 1.));
        reflectedLight.directDiffuse += diffuseColor.rgb * uCausticColor * cc * k * uCaustic * uAmpC * mix(.16, .5, up); }`);
    extra.patch && extra.patch(s);
  };
  mat.customProgramCacheKey = () => 'w' + amp + (extra.key || '');
  return mat;
}
