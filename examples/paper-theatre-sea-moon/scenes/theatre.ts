// @ts-nocheck
// The paper theatre that bookends the film: a pearl shell proscenium, velvet drapes, seigaiha paper waves, a paper moon on threads.
import { THREE, TAU, V, clamp, lerp, smooth, rng, merge, T, gradY, lathe, spline, surface, canvasTex, water } from './lib.js';

const SEA = ['#0f1f63', '#16308a', '#1f4bb0', '#3173cc', '#59a6e0'];

function seigaiha(col, line) {
  return canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = col; x.fillRect(0, 0, w, h);
    const R = 64;
    for (let row = -1; row < 7; row++) for (let i = -1; i < 7; i++) {
      const cx = (i + (row % 2) * .5) * R * 2 * .5 * 2 / 2 * 1, px = i * R * 1.0 * 2 * .5 * 2 + ((row % 2) ? R : 0) - 0, cy = row * R * .5 + R;
      for (let k = 5; k >= 0; k--) { x.beginPath(); x.arc(px, cy, R * (k + 1) / 6, Math.PI, 0); x.closePath(); x.fillStyle = k % 2 ? col : line; if (k === 5) { x.fillStyle = line; } x.fill(); }
      void cx;
    }
    const q = rng(17); x.globalAlpha = .06; for (let i = 0; i < 900; i++) { x.fillStyle = i % 2 ? '#fff' : '#000'; x.fillRect(q() * w, q() * h, 2, 1); } x.globalAlpha = 1;
  }, { repeat: [1, 1] });
}

export function buildTheatre(group, R) {
  const out = {};
  const r = rng(12);
  const pearl = R.trim, velvet = new THREE.MeshPhysicalMaterial({ color: '#16288c', roughness: .72, sheen: 1, sheenColor: new THREE.Color('#6f8dff'), sheenRoughness: .42, side: THREE.DoubleSide });
  water(velvet, 0);
  const add = (g, m, sh = true) => { const q = new THREE.Mesh(g, m); q.castShadow = sh; q.receiveShadow = true; group.add(q); return q; };

  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 50), water(new THREE.MeshStandardMaterial({ color: '#0d1648', roughness: .62, metalness: .1 }), 0));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -.02, 3); floor.receiveShadow = true; group.add(floor);
  // apron with pearl footlights
  add(T(new THREE.BoxGeometry(30, 1, 3.2), 0, -.5, 2.6), pearl);

  // proscenium wall
  const OW = 22, OH = 14.5, S = new THREE.Shape();
  S.moveTo(-40, -1); S.lineTo(-40, 34); S.lineTo(40, 34); S.lineTo(40, -1); S.closePath();
  const hole = new THREE.Path(); const hw = OW / 2, sp = OH - 6; hole.moveTo(-hw, -1); hole.lineTo(-hw, sp); hole.bezierCurveTo(-hw, sp + 4.5, -4, OH, 0, OH + .5); hole.bezierCurveTo(4, OH, hw, sp + 4.5, hw, sp); hole.lineTo(hw, -1); hole.closePath(); S.holes.push(hole);
  const wt = seigaiha('#121f6e', '#1b2c86'); wt.repeat.set(1 / 7, 1 / 3.5); const wallM = water(new THREE.MeshStandardMaterial({ map: wt, roughness: .62, metalness: .1 }), 0);
  add(T(new THREE.ExtrudeGeometry(S, { depth: 1.2, bevelEnabled: false, curveSegments: 40 }), 0, 0, -1.2), wallM);
  // pearl frame: two nested mouldings following the arch
  const archPts = []; { const c = new THREE.CurvePath(); const P = (a, b, c1, d) => new THREE.CubicBezierCurve3(V(...a), V(...b), V(...c1), V(...d));
    const L = new THREE.LineCurve3(V(-hw, 0, 0), V(-hw, sp, 0)), A = P([-hw, sp, 0], [-hw, sp + 4.5, 0], [-4, OH, 0], [0, OH + .5, 0]), B = P([0, OH + .5, 0], [4, OH, 0], [hw, sp + 4.5, 0], [hw, sp, 0]), Rr = new THREE.LineCurve3(V(hw, sp, 0), V(hw, 0, 0));
    [L, A, B, Rr].forEach(q => c.add(q)); out.arch = c;
    for (const [off, rad, z] of [[.1, .3, .15], [.82, .17, .32], [1.28, .12, .22]]) { const pts = c.getSpacedPoints(160).map((p, i, a) => { const q = a[Math.min(i + 1, a.length - 1)], w = a[Math.max(i - 1, 0)], tx = q.x - w.x, ty = q.y - w.y, l = Math.hypot(tx, ty) || 1; return V(p.x - ty / l * off, p.y + tx / l * off, p.z + z); }); add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 320, rad, 10), pearl); }
    // pearls along the arch: they light up one by one
    const bead = c.getSpacedPoints(64); out.pearls = [];
    const pm = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#bfe6ff', emissiveIntensity: 3, roughness: .2 });
    bead.forEach((p, i) => { const q = bead[Math.min(i + 1, bead.length - 1)], w = bead[Math.max(i - 1, 0)], tx = q.x - w.x, ty = q.y - w.y, l = Math.hypot(tx, ty) || 1; const m = new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 10), pm.clone()); m.position.set(p.x - ty / l * .46, p.y + tx / l * .46, p.z + .35); group.add(m); out.pearls.push(m); });
  }
  // twisted pearl columns
  for (const sd of [-1, 1]) {
    const col = surface(72, 110, (u, v) => { const th = u * TAU, y = v * 11.5, tw = v * 16; const rr = .62 * (1 + .1 * Math.pow(.5 + .5 * Math.cos(th * 6 + tw), 1.6)) * (1 - .1 * v); return [Math.cos(th) * rr, y + .9, Math.sin(th) * rr]; }, true, true);
    add(T(col, sd * (hw + 2.3), 0, .4), pearl);
    add(T(lathe(spline([[1.1, 0], [1.05, .3], [.82, .55], [.72, .95]], 18), 32), sd * (hw + 2.3), 0, .4), pearl);
    add(T(lathe(spline([[.58, 12.2], [.7, 12.6], [1.05, 13], [1.2, 13.4], [1.18, 13.7]], 18), 32), sd * (hw + 2.3), 0, .4), R.silver);
    // shell lamp on top
    add(T(new THREE.SphereGeometry(.42, 24, 18), sd * (hw + 2.3), 14.05, .4), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#cfe8ff', emissiveIntensity: 5 }));
  }
  // crown shell over the opening
  { const fan = surface(120, 22, (u, v) => { const a = lerp(-1.45, 1.45, u), rib = 1 + .055 * Math.pow(Math.abs(Math.cos(a * 9)), .7), rr = (v * 4.6) * rib; return [Math.sin(a) * rr, Math.cos(a) * rr + .05, .55 * (1 - v * v) + .2 * Math.pow(Math.abs(Math.cos(a * 9)), .7) * v]; }, false);
    gradY(fan, [[0, '#bda9f2'], [.5, '#9fdcf0'], [1, '#fdfbff']]); add(T(fan, 0, OH + 1.1, .25), R.roof);
    const Cc = new THREE.Shape(); Cc.absarc(0, 0, 1.15, .75, TAU - .75, false); Cc.absarc(.6, 0, .92, TAU - 1.28, 1.28, true);
    const c = add(T(T(new THREE.ExtrudeGeometry(Cc, { depth: .14, bevelEnabled: true, bevelSize: .03, bevelThickness: .03, bevelSegments: 2, curveSegments: 28 }), 0, 0, 0, 0, 1, 0, Math.PI / 2 + .2), 0, OH + 7, .4), R.silver); void c; }

  // back wall, painted night sky
  const sky = canvasTex(2048, 1024, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#081038'); g.addColorStop(.55, '#142a7c'); g.addColorStop(1, '#3a6ccb'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const q = rng(4); for (let i = 0; i < 900; i++) { const a = q(); x.fillStyle = `rgba(230,240,255,${a * a * .9})`; x.beginPath(); x.arc(q() * w, q() * h * .7, .5 + a * 1.8, 0, TAU); x.fill(); }
    x.strokeStyle = 'rgba(210,225,255,.16)'; x.lineWidth = 2; for (const rr of [240, 330, 420]) { x.beginPath(); x.arc(w * .6, h * .32, rr, 0, TAU); x.stroke(); }
  });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshBasicMaterial({ map: sky, toneMapped: false })); back.position.set(0, 11, -20); group.add(back);

  // paper moon on two threads
  const moonT = canvasTex(1024, 1024, (x, w) => {
    x.fillStyle = '#fbf3da'; x.beginPath(); x.arc(w / 2, w / 2, w / 2 - 4, 0, TAU); x.fill();
    const q = rng(8); for (let i = 0; i < 80; i++) { const a = q() * TAU, d = Math.sqrt(q()) * w * .44, R0 = 20 + q() * 110; x.fillStyle = `rgba(190,190,226,${q() * .16})`; x.beginPath(); x.arc(w / 2 + Math.cos(a) * d, w / 2 + Math.sin(a) * d, R0, 0, TAU); x.fill(); }
    for (let i = 0; i < 3000; i++) { x.strokeStyle = `rgba(200,180,140,${q() * .12})`; x.beginPath(); const px = q() * w, py = q() * w; x.moveTo(px, py); x.lineTo(px + (q() - .5) * 60, py + (q() - .5) * 26); x.stroke(); }
    x.globalCompositeOperation = 'destination-in'; x.fillStyle = '#000'; x.beginPath(); x.arc(w / 2, w / 2, w / 2 - 4, 0, TAU); x.fill(); x.globalCompositeOperation = 'source-over';
  });
  const moon = new THREE.Group(); moon.position.set(4.8, 11.2, -12.5); group.add(moon);
  const md = new THREE.Mesh(new THREE.CircleGeometry(3.1, 96), new THREE.MeshBasicMaterial({ map: moonT, transparent: true, color: new THREE.Color(1.05, 1, .9), alphaTest: .4 })); moon.add(md);
  for (const sx of [-1.4, 1.4]) { const th = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 40, 6), new THREE.MeshBasicMaterial({ color: '#c8d4ff' })); th.position.set(sx, 3 + 20 - .2 - Math.abs(sx) * .4, 0); moon.add(th); }
  const halo = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: 'varying vec2 vU; void main(){ vU = uv - .5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }', fragmentShader: 'varying vec2 vU; void main(){ float d = length(vU) * 2.; gl_FragColor = vec4(vec3(.5, .62, .95) * pow(max(1. - d, 0.), 2.6) * .8, 1.); }' }));
  halo.position.z = -.4; moon.add(halo); out.moon = moon;

  // seigaiha paper waves: five rows, each a scalloped sheet with a pale cut edge
  out.waves = [];
  for (let i = 0; i < 5; i++) {
    const Rw = 3 - i * .26, col = SEA[i], tex = seigaiha(col, ['#2a46aa', '#3a60c6', '#5c88dc', '#86b6ec', '#b5dcf6'][i]);
    const Sh = new THREE.Shape(), L = 40, base = 1.3 + i * 1.02; Sh.moveTo(-L, -8); Sh.lineTo(-L, base);
    let px = -L + (i % 2) * Rw; while (px < L) { Sh.absarc(px + Rw, base, Rw, Math.PI, 0, true); px += Rw * 2; } Sh.lineTo(L + 4, -8); Sh.closePath();
    const g = new THREE.ExtrudeGeometry(Sh, { depth: .1, bevelEnabled: false, curveSegments: 22 });
    const u = g.attributes.uv, p = g.attributes.position; for (let k = 0; k < u.count; k++) u.setXY(k, p.getX(k) / (Rw * 4), p.getY(k) / (Rw * 2));
    const face = water(new THREE.MeshStandardMaterial({ map: tex, roughness: .9 }), 0), edge = water(new THREE.MeshStandardMaterial({ color: '#eaf3ff', roughness: .9 }), 0);
    const m = new THREE.Mesh(g, [face, edge]); m.castShadow = true; m.receiveShadow = true;
    const lip = new THREE.Mesh(new THREE.ExtrudeGeometry(Sh, { depth: .03, bevelEnabled: false, curveSegments: 22 }), edge); lip.position.set(0, .16, -.08); lip.castShadow = true;
    const sh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#030722', transparent: true, opacity: .42, depthWrite: false })); sh.position.set(.12, -.1, -.1); sh.renderOrder = 1;
    const row = new THREE.Group(); row.add(sh, m, lip); row.userData.z = -9.8 + (4 - i) * 1.4; row.position.z = row.userData.z; group.add(row); out.waves.push(row);
  }

  // velvet drapes
  const panel = (sd) => { const nu = 200, nv = 32; const g = new THREE.BufferGeometry(); const p = new Float32Array((nu + 1) * (nv + 1) * 3), idx = []; for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); } g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setIndex(idx); const m = new THREE.Mesh(g, velvet); m.castShadow = true; m.receiveShadow = true; group.add(m); return { g, p, nu, nv, sd }; };
  const P = [panel(-1), panel(1)];
  const hem = [0, 1].map(() => { const g = new THREE.BufferGeometry(), p = new Float32Array(202 * 2 * 3), idx = []; for (let i = 0; i < 200; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setIndex(idx); const m = new THREE.Mesh(g, R.silver); m.frustumCulled = false; group.add(m); return { g, p }; });
  let drapeState = -1;
  out.setDrapes = (o) => {
    if (o === drapeState) return; drapeState = o;
    P.forEach(({ g, p, nu, nv, sd }, k) => {
      const hemPts = [];
      for (let j = 0; j <= nv; j++) { const v = j / nv, y = v * (OH + 2.4) - .02;                  // v 0 bottom
        for (let i = 0; i <= nu; i++) { const u = i / nu;                                           // u 0 outer edge
          const tie = Math.exp(-Math.pow((v - .38) / .2, 2));                                       // gathered at a tie-back height
          const inner = lerp(.02, lerp(8.8, 9.85, tie), o), xi = lerp(hw + 1.3, inner, u);
          const pleat = Math.sin(u * TAU * 9.5 + v * .9 + k) * lerp(.3, .52 + tie * .2, o) + Math.sin(u * TAU * 23 + k + v * 2) * .08 + Math.sin(u * TAU * 3.5 + k) * .12;
          const x = sd * (xi + pleat * .25 * (1 - o * .3)); const z = -2.1 + pleat * .9;
          const q = (j * (nu + 1) + i) * 3; p[q] = x; p[q + 1] = y; p[q + 2] = z;
          if (j === 0) hemPts.push(x, z); }
      }
      g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
      for (let i = 0; i <= 200; i++) { const x = hemPts[i * 2], z = hemPts[i * 2 + 1] + .03, q = i * 6; hem[k].p.set([x, .02, z, x, .2, z], q); } hem[k].g.attributes.position.needsUpdate = true; hem[k].g.computeVertexNormals();
    });
  };
  // swag valance
  { const n = 5, W0 = OW + 3.4, parts = [];
    for (let i = 0; i < n; i++) { const c0 = -W0 / 2 + (i + .5) * W0 / n, hwS = W0 / n / 2 + .25, a = Math.abs(i - 2) / 2;
      parts.push(surface(80, 24, (u, v) => { const x = (u - .5) * 2, sag = (1 - x * x) * (1.9 - .25 * a), y = OH + 2.55 - v * (.55 + sag), fold = Math.sin(v * 11 + x * .8) * .1 * (1 - x * x) + .16 * (1 - x * x) * v; return [c0 + x * hwS, y, -1.7 + fold + .32 * v * (1 - x * x)]; }, false));
      const hemC = new THREE.QuadraticBezierCurve3(V(c0 - hwS, OH + 2.0, -1.7), V(c0, OH + 2.55 - .55 - 2 * (1.9 - .25 * a), -1.2), V(c0 + hwS, OH + 2.0, -1.7)); add(new THREE.TubeGeometry(hemC, 40, .065, 8), R.silver); }
    add(merge(parts), velvet); const band = add(new THREE.BoxGeometry(W0 + 1, .5, .2), R.silver); band.position.set(0, OH + 2.65, -1.6); }

  out.setWaves = t => out.waves.forEach((w, i) => { w.position.x = Math.sin(t * 1.2 + i * 1.7) * .55; w.position.y = Math.sin(t * 1.6 + i) * .12; });
  out.setPearls = n => out.pearls.forEach((m, i) => { const d = Math.abs(i - 32) / 32; m.material.emissiveIntensity = (1 - d) <= n ? 4.2 : .12; });
  out.setDrapes(0);
  return out;
}
