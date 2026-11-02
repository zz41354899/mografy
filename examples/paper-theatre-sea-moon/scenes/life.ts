// @ts-nocheck
// Living things and water particles: moon jellyfish, fish, marine snow, bubbles, sound rings.
import { THREE, TAU, V, rng, merge, surface, GLSL_FOG, F, G } from './lib.js';

/** Aurelia: a moon jellyfish. Bell, frilled oral arms, a fringe of tentacles. All additive light. */
export function buildJelly(parent, max = 260) {
  // merge() drops custom attributes: rebuild with aK carried over
  const raw = (() => {
    const list = []; let n = 0;
    const src = jellyParts(); for (const g of src) { const h = g.index ? g.toNonIndexed() : g; n += h.attributes.position.count; list.push(h); }
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), k = new Float32Array(n); let o = 0;
    for (const h of list) { const c = h.attributes.position.count; pos.set(h.attributes.position.array, o * 3); nor.set(h.attributes.normal.array, o * 3); uv.set(h.attributes.uv.array, o * 2); k.set(h.attributes.aK.array, o); o += c; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('aK', new THREE.BufferAttribute(k, 1)); return g;
  })();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { ...F, uTime: G.uTime, uGain: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float aK, aLit, aHue, aUnf; varying float vK, vLit, vHue, vFres; varying vec2 vUv2; varying vec3 vWP; uniform float uTime;
      void main(){
        vec3 p = position; float ph = instanceMatrix[3][0] * .13 + instanceMatrix[3][2] * .09;
        float pulse = sin(uTime * 1.5 + ph);
        if (aK < 1.5) { float q = 1. - clamp(p.y / .62, -.3, 1.); p.xz *= 1. + .13 * pulse * q; p.y *= 1. - .11 * pulse; }
        else { p.y = -.1 + (p.y + .1) * aUnf; p.xz *= mix(.35, 1., aUnf); float d = clamp(-p.y / 3., 0., 1.); p.x += sin(p.y * 2.3 + uTime * 1.4 + ph) * .16 * d; p.z += cos(p.y * 1.9 + uTime * 1.1 + ph) * .16 * d; p.xz *= 1. + .13 * pulse * (1. - d) * .6; }
        vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.); vWP = wp.xyz;
        vec3 N = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal), Vv = normalize(cameraPosition - wp.xyz);
        vFres = 1. - abs(dot(N, Vv)); vK = aK; vLit = aLit; vHue = aHue; vUv2 = uv;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      varying float vK, vLit, vHue, vFres; varying vec2 vUv2; varying vec3 vWP; uniform float uGain;
      ${GLSL_FOG}
      void main(){
        vec3 a = vec3(.42, .86, 1.), b = vec3(.98, .52, .95), c = vec3(.68, .56, 1.);
        vec3 col = vHue < .5 ? mix(a, c, vHue * 2.) : mix(c, b, vHue * 2. - 1.);
        float e;
        if (vK < .5) {
          float th = vUv2.x * 6.2832, v = vUv2.y;
          float rib = pow(abs(sin(th * 8.)), 14.) * smoothstep(.2, .9, v) * .55;
          float lobe = pow(max(cos(th * 2.), 0.) , 2.) * smoothstep(.1, .3, v) * smoothstep(.62, .4, v);                  // four-leaf gonads
          float rim = smoothstep(.86, 1., v);
          e = pow(vFres, 2.2) * 1.15 + rib * .35 + lobe * 1.5 + rim * 1.5 + .06;
        } else if (vK < 1.5) e = pow(vFres, 3.) * .5 + .03;
        else if (vK < 2.5) e = .1 + pow(vFres, 2.) * .35 + (1. - vUv2.y) * .1;
        else e = .55 * (1. - vUv2.y * .75);
        vec3 lightC = col * e * vLit * uGain * 1.7;
        gl_FragColor = vec4(lightC * pow(fogK(vWP), .55), 1.);
      }`,
  });
  raw.setAttribute('aLit', new THREE.InstancedBufferAttribute(new Float32Array(max), 1));
  raw.setAttribute('aHue', new THREE.InstancedBufferAttribute(new Float32Array(max), 1));
  raw.setAttribute('aUnf', new THREE.InstancedBufferAttribute(new Float32Array(max).fill(1), 1));
  const m = new THREE.InstancedMesh(raw, mat, max); m.frustumCulled = false; m.count = 0; m.renderOrder = 4; parent.add(m);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
  return {
    mesh: m,
    set(list) {
      m.count = Math.min(list.length, max);
      for (let i = 0; i < m.count; i++) {
        const j = list[i]; E.set(j.tx || 0, j.ry || 0, j.tz || 0); Q.setFromEuler(E);
        M.compose(V(j.x, j.y, j.z), Q, V(j.s, j.s * (j.sy || 1), j.s)); m.setMatrixAt(i, M);
        raw.attributes.aLit.array[i] = j.lit ?? 1; raw.attributes.aHue.array[i] = j.hue ?? .3; raw.attributes.aUnf.array[i] = j.unf ?? 1;
      }
      m.instanceMatrix.needsUpdate = true; raw.attributes.aLit.needsUpdate = true; raw.attributes.aHue.needsUpdate = true; raw.attributes.aUnf.needsUpdate = true;
    },
  };
}
function jellyParts() {
  const parts = [];
  const tag = (g, k) => { const n = g.attributes.position.count; g.setAttribute('aK', new THREE.BufferAttribute(new Float32Array(n).fill(k), 1)); return g; };
  parts.push(tag(surface(72, 30, (u, v) => { const th = u * TAU, r = Math.sin(v * Math.PI * .52) * (1 + .05 * Math.sin(th * 16) * v * v * v * v); return [Math.cos(th) * r, .62 * Math.cos(v * Math.PI * .52) - .12 * v * v, Math.sin(th) * r]; }), 0));
  parts.push(tag(surface(48, 16, (u, v) => { const th = u * TAU, r = .86 * Math.sin(v * Math.PI * .5); return [Math.cos(th) * r, .46 * Math.cos(v * Math.PI * .5) - .1, Math.sin(th) * r]; }), 1));
  const r = rng(5);
  for (let a = 0; a < 4; a++) {
    const a0 = a / 4 * TAU + .4;
    parts.push(tag(surface(6, 54, (u, v) => {
      const s = v * 1.9, wob = Math.sin(v * 13 + a * 2) * .1 * v + Math.sin(v * 31 + a) * .05, w = (.15 + .08 * Math.sin(v * 27 + a)) * (1 - v * .7) * (u - .5);
      const rr = .16 + .14 * Math.sin(v * 3.1) + wob; return [Math.cos(a0 + w * 3) * rr, -.08 - s, Math.sin(a0 + w * 3) * rr];
    }, false), 2));
  }
  for (let i = 0; i < 46; i++) {
    const th = i / 46 * TAU + r() * .05, L = 1.1 + r() * 1.5, ph = r() * 6, cx = Math.cos(th), cz = Math.sin(th);
    parts.push(tag(surface(1, 20, (u, v) => { const s = .012 * (1 - v * .7) * (u - .5) * 2, rr = .99 - v * .26 + Math.sin(v * 7 + ph) * .05 * v; return [cx * rr + cz * s, -.14 - v * L, cz * rr - cx * s]; }, false), 3));
  }
  return parts;
}

/** Small silver fish in loose schools; one mesh per school, slid by the shot. */
export function buildFish(parent, R, schools) {
  const r = rng(77), body = new THREE.Shape();
  body.moveTo(.6, 0); body.quadraticCurveTo(.15, .17, -.35, .03); body.lineTo(-.62, .15); body.lineTo(-.55, 0); body.lineTo(-.62, -.15); body.lineTo(-.35, -.03); body.quadraticCurveTo(.15, -.17, .6, 0);
  const g = new THREE.ShapeGeometry(body, 6), M = new THREE.Matrix4();
  return schools.map(s => {
    const m = new THREE.InstancedMesh(g, R.fish, s.n);
    for (let i = 0; i < s.n; i++) {
      const a = r() * TAU, d = Math.pow(r(), .6), x = Math.cos(a) * d * s.rx, z = Math.sin(a) * d * s.rz, y = (r() - .5) * s.ry + Math.sin(x * .1) * 2;
      const yaw = s.dir + (r() - .5) * .3, sc = s.s * (.7 + r() * .6);
      M.compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - .5) * .4, yaw, (r() - .5) * .3)), V(sc, sc, sc)); m.setMatrixAt(i, M);
    }
    m.position.set(s.x, s.y, s.z); m.userData = s; m.frustumCulled = false; parent.add(m); return m;
  });
}

/** Marine snow / bubbles: points that wrap in a box around the camera. */
export function buildSnow(parent, n = 5200, box = 70) {
  const r = rng(3), p = new Float32Array(n * 3), s = new Float32Array(n);
  for (let i = 0; i < n; i++) { p[i * 3] = r() * box; p[i * 3 + 1] = r() * box; p[i * 3 + 2] = r() * box; s[i] = .5 + r() * r() * 2.4; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    uniforms: { uBox: { value: box }, uGain: { value: 1 }, uCol: { value: new THREE.Color('#bfe3ff') }, uH: { value: 900 }, uTime: G.uTime },
    vertexShader: `attribute float aS; uniform float uBox, uH, uTime; varying float vA;
      void main(){ vec3 q = position; q.y += uTime * .35 * aS; vec3 c = cameraPosition; vec3 w = mod(q - c + uBox * .5, uBox) - uBox * .5 + c;
        vec4 mv = viewMatrix * vec4(w, 1.); float d = -mv.z; vA = smoothstep(.6, 2.2, d) * (1. - smoothstep(uBox * .32, uBox * .5, length(w - c)));
        gl_Position = projectionMatrix * mv; gl_PointSize = clamp(aS * uH * .0009 * 60. / max(d, 1.) , 1., 14.); }`,
    fragmentShader: `uniform float uGain; uniform vec3 uCol; varying float vA; void main(){ float d = length(gl_PointCoord - .5) * 2.; float a = smoothstep(1., .1, d); gl_FragColor = vec4(uCol * a * a * vA * uGain * .55, 1.); }`,
  });
  const m = new THREE.Points(g, mat); m.frustumCulled = false; m.renderOrder = 5; parent.add(m); return m;
}

/** Glow sprites: lantern lights, pearls of light, sound motes. */
export function buildGlows(parent, max = 2400) {
  const g = new THREE.BufferGeometry(), p = new Float32Array(max * 3), c = new Float32Array(max * 3), s = new Float32Array(max);
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { ...F, uH: { value: 900 } },
    vertexShader: `attribute float aS; uniform float uH; varying vec3 vC; varying vec3 vWP; void main(){ vC = color; vec4 w = modelMatrix * vec4(position, 1.); vWP = w.xyz; vec4 mv = viewMatrix * w; gl_Position = projectionMatrix * mv; gl_PointSize = clamp(aS * projectionMatrix[1][1] * uH * .5 / max(-mv.z, .5), 1.5, 90.); }`,
    fragmentShader: `varying vec3 vC; varying vec3 vWP; ${GLSL_FOG} void main(){ float d = length(gl_PointCoord - .5) * 2.; float a = exp(-d * d * 5.) - .007; if (a <= 0.) discard; gl_FragColor = vec4(vC * a * pow(fogK(vWP), .4), 1.); }`,
  });
  const m = new THREE.Points(g, mat); m.frustumCulled = false; m.renderOrder = 6; parent.add(m);
  return { mesh: m, set(list) { g.setDrawRange(0, Math.min(list.length, max)); list.slice(0, max).forEach((q, i) => { p[i * 3] = q[0]; p[i * 3 + 1] = q[1]; p[i * 3 + 2] = q[2]; c[i * 3] = q[3]; c[i * 3 + 1] = q[4]; c[i * 3 + 2] = q[5]; s[i] = q[6]; }); g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = g.attributes.aS.needsUpdate = true; } };
}

/** Expanding rings of sound: a soft band on a disc. */
export function buildRings(parent) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uR: { value: [.2, .45, .75] }, uA: { value: [1, .7, .4] }, uC: { value: new THREE.Color('#bfe8ff') }, uGain: { value: 1 } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec2 vP; uniform float uR[3], uA[3]; uniform vec3 uC; uniform float uGain;
      void main(){ float r = length(vP), e = 0.; for (int i = 0; i < 3; i++) { float d = r - uR[i]; e += uA[i] * (exp(-d * d * 16000.) * 1.5 + exp(-d * d * 1400.) * .05 * (d < 0. ? 1. : .3)); } gl_FragColor = vec4(uC * e * uGain * smoothstep(1., .9, r), 1.); }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); m.renderOrder = 3; m.visible = false; parent.add(m); return m;
}
