// @ts-nocheck
// The undersea castle: seashell spires, pearl masonry, arcades, a round terrace (the stage) and the Moon Tower (her room).
import { THREE, TAU, V, clamp, lerp, smooth, rng, fbm, ridged, noise3, merge, T, gradY, lathe, spline, surface, canvasTex, ashlar, rockBump, water, G } from './lib.js';

// ---------- layout ----------
export const TERRACE = { x: -19, z: 33, y: 22.02, r: 10.5, keep: 2.62 };
export const MOON = { x: 24, z: 31, y0: 13, h: 33, r: 7.6, floor: 31.5, ceil: 39.5 };

export function groundH(x, z) {
  const r = Math.hypot(x, z * .92);
  const dome = 15.2 * (1 - smooth(26, 66, r));                    // the mound
  const rough = (ridged(x * .035, 3.1, z * .035, 4) - .55) * 14 * smooth(22, 40, r) * (1 - smooth(60, 92, r));
  const sand = (fbm(x * .012, 1.7, z * .012, 3) - .5) * 9 * smooth(60, 100, r);
  return dome + rough + sand;
}

const archShape = (w, h) => {
  const s = new THREE.Shape(), hw = w / 2, sp = h - w * .78;
  s.moveTo(-hw, 0); s.lineTo(-hw, sp); s.quadraticCurveTo(-hw, sp + w * .5, 0, h); s.quadraticCurveTo(hw, sp + w * .5, hw, sp); s.lineTo(hw, 0); s.closePath(); return s;
};
const archHole = (w, h) => {
  const p = new THREE.Path(), hw = w / 2, sp = h - w * .78;
  p.moveTo(-hw, 0); p.lineTo(-hw, sp); p.quadraticCurveTo(-hw, sp + w * .5, 0, h); p.quadraticCurveTo(hw, sp + w * .5, hw, sp); p.lineTo(hw, 0); p.closePath(); return p;
};
const ext = (shape, depth, bevel = .04) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 10 });

function uvScale(g, u, v) { const a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * u, a.getY(i) * v); return g; }

/** Spiral seashell spire: a helical ridge climbs to the tip. */
function shellRoof(r, h, turns = 5, seg = 72, nv = 110) {
  return surface(seg, nv, (u, v) => {
    const th = u * TAU, ph = turns * TAU * v + th;
    const prof = r * Math.pow(1 - v, 1.28) * (1 + .22 * Math.sin(Math.min(1, v * 1.4) * Math.PI) * .25);
    const ridge = 1 + .12 * Math.pow(.5 + .5 * Math.cos(ph), 2.4) * (1 - v * .25);
    const R = prof * ridge + .02;
    return [Math.cos(th) * R, h * v, Math.sin(th) * R];
  }, true, true);
}
/** Ribbed onion dome. */
function ribDome(r, h, ribs = 16, seg = 128, nv = 60) {
  return surface(seg, nv, (u, v) => {
    const th = u * TAU;
    const prof = r * (Math.sin(Math.min(1, v * 1.25) * Math.PI * .62 + .35) * 1.02) * Math.pow(1 - v, .62);
    const R = prof * (1 + .045 * Math.pow(Math.abs(Math.cos(th * ribs * .5)), 6) * (1 - v * .4));
    return [Math.cos(th) * R, h * v, Math.sin(th) * R];
  }, true, true);
}
const crescent = (R = 1) => {
  const s = new THREE.Shape(); s.absarc(0, 0, R, .5, TAU - .5, false);
  const inner = new THREE.Path(); s.absarc(R * .55, 0, R * .78, TAU - 1.05, 1.05, true); return s;
};

export function buildCastle(scene, R, env) {
  const r = rng(2026);
  const B = { stone: [], trim: [], roof: [], silver: [], dark: [], glass: [] };
  const I = { col: [], cor: [], mer: [], bal: [] };    // instanced repeats
  const wins = [];                                     // window instances
  const put = (arr, x, y, z, ry = 0, s = [1, 1, 1], rx = 0, rz = 0) => arr.push(new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(...s)));

  const BW = 1.25, BH = .55;   // masonry block size
  const shaft = (x, z, pts, seg = 56, phiStart = 0, phiLen = TAU) => {
    const rAvg = pts.reduce((a, p) => a + p[0], 0) / pts.length, h = pts[pts.length - 1][1] - pts[0][1];
    const g = lathe(pts, seg, phiStart, phiLen); uvScale(g, Math.round(TAU * rAvg * (phiLen / TAU) / (BW * 9)) || 1, h / (BH * 12)); return T(g, x, 0, z);
  };
  const ring = (x, z, rad, y, a = .16, b = .22) => B.trim.push(T(lathe(spline([[rad, y - a], [rad + b * .7, y - a * .75], [rad + b, y - a * .1], [rad + b * .9, y + a * .4], [rad + b * .4, y + a * .6], [rad, y + a]], 12), 56), x, 0, z));

  const win = (x, y, z, ry, w, h, group = 0, frame = true) => {
    wins.push({ m: new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), V(w, h, 1)), p: V(x, y + h / 2, z), group });
    if (frame) {
      const out = w * .16, S = archShape(w + out * 2, h + out * 1.7); S.holes.push(archHole(w, h));
      const f = T(ext(S, .1, .035), 0, -out * .2, -.03); B.trim.push(T(f, x, y, z, ry));
      const sill = new THREE.BoxGeometry(w + out * 3, .14, .4); B.trim.push(T(sill, x, y - .1, z, ry));
    }
  };

  /** A tower: battered base, windows in rings, corbels, crown, shell roof. */
  function tower(x, z, y0, rad, h, o = {}) {
    const n = 22, pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, y = y0 + h * t;
      const bat = 1 + .2 * Math.pow(1 - clamp(t / .14), 2), ent = 1 - .05 * Math.sin(t * Math.PI * .9);
      pts.push([rad * bat * ent, y]);
    }
    B.stone.push(shaft(x, z, pts));
    // string courses
    const rAt = t => rad * (1 - .05 * Math.sin(t * Math.PI * .9));
    const nRing = o.rings ?? Math.max(1, Math.round(h / 8));
    for (let i = 1; i <= nRing; i++) { const t = i / (nRing + 1); ring(x, z, rAt(t) - .03, y0 + h * t, .13, .17); }
    ring(x, z, rad * 1.18, y0 + h * .13, .2, .22);
    // windows
    const rows = o.rows ?? Math.max(1, Math.floor(h / 8));
    for (let j = 0; j < rows; j++) {
      const t = (j + .55) / (rows + .4), y = y0 + h * (.18 + t * .68);
      const R0 = rAt(.18 + t * .68), cnt = Math.max(3, Math.round(TAU * R0 / (o.spacing ?? 3.3)));
      for (let i = 0; i < cnt; i++) {
        if (r() < .14) continue;
        const a = (i + (j % 2) * .5) / cnt * TAU, ww = Math.min(.95, R0 * .34), hh = ww * 2.3;
        win(x + Math.sin(a) * (R0 + .05), y, z + Math.cos(a) * (R0 + .05), a, ww, hh, o.group ?? 0);
      }
    }
    // corbel table + crown
    const top = y0 + h, crown = rad * 1.17;
    B.stone.push(shaft(x, z, spline([[rad * .96, top - 1.2], [rad * 1.0, top - .8], [crown * .97, top - .1], [crown, top + .05], [crown, top + 1.9], [crown * 1.03, top + 2.05]], 18)));
    const cn = Math.round(TAU * crown / 1.0);
    for (let i = 0; i < cn; i++) {
      const a = i / cn * TAU;
      put(I.cor, x + Math.sin(a) * (crown * .94), top - .65, z + Math.cos(a) * (crown * .94), a, [.34, .8, .5]);
      if (i % 2 === 0) put(I.mer, x + Math.sin(a) * (crown + .02), top + 2.05, z + Math.cos(a) * (crown + .02), a, [.5, .7, .24]);
    }
    ring(x, z, crown - .02, top + 2.0, .13, .16);
    // crown windows
    const wn = Math.max(4, Math.round(cn / 3.4));
    for (let i = 0; i < wn; i++) { const a = i / wn * TAU; win(x + Math.sin(a) * (crown + .04), top + .35, z + Math.cos(a) * (crown + .04), a, .55, 1.25, o.group ?? 0, true); }
    B.stone.push(T(lathe([[.05, top + 1.7], [crown + .02, top + 1.7]], 56), x, 0, z));   // the wall-walk: closes the tower under its roof
    // roof
    const rh = o.roofH ?? rad * 3.4, rr = rad * 1.04;
    const roof = T(shellRoof(rr, rh, o.turns ?? 4 + rh / rad * .5), x, top + 2.0, z, r() * TAU);
    gradY(roof, [[0, o.c0 ?? '#c7b6f4'], [.45, o.c1 ?? '#9fd5f0'], [1, '#f7f3ff']]);
    B.roof.push(roof);
    B.silver.push(T(lathe(spline([[.04, top + 2 + rh * .99], [.34, top + 2 + rh * 1.0], [.46, top + 2 + rh * 1.03], [.34, top + 2 + rh * 1.06], [.14, top + 2 + rh * 1.09], [.1, top + 2 + rh * 1.16], [.02, top + 2 + rh * 1.24]], 22), 18), x, 0, z));
  }

  /** Round drum with an open arcade around it. */
  function arcadeDrum(rad, y, h, n, o = {}) {
    B.stone.push(shaft(0, 0, [[rad + .3, y], [rad, y + .6], [rad, y + h - .3], [rad + .2, y + h]]));
    const ar = rad + 2, seg = TAU / n, w = 2 * ar * Math.tan(seg / 2), archW = w * .62, archH = h * .72;
    for (let i = 0; i < n; i++) {
      const a = (i + .5) * seg;
      const S = new THREE.Shape(); S.moveTo(-w / 2, 0); S.lineTo(-w / 2, h); S.lineTo(w / 2, h); S.lineTo(w / 2, 0); S.closePath(); S.holes.push(archHole(archW, archH));
      const g = T(ext(S, .4, .05), 0, 0, -.2); B.trim.push(T(g, Math.sin(a) * ar, y, Math.cos(a) * ar, a));
      win(Math.sin(a) * (rad + .08), y + .6, Math.cos(a) * (rad + .08), a, archW * .62, archH * .8, 1, false);
      const b = i * seg, cR = ar * 1.01 / Math.cos(0);
      put(I.col, Math.sin(b) * (cR + .25), y, Math.cos(b) * (cR + .25), b, [.5, h * .78, .5]);
    }
    ring(0, 0, ar + .1, y + h, .2, .4); ring(0, 0, ar + .1, y + .1, .22, .3);
    // deck between the arcade and the drum
    B.trim.push(T(lathe([[rad, y + h + .02], [ar + .3, y + h + .02]], 56), 0, 0, 0));
    B.dark.push(T(lathe([[ar - .2, y + .15], [rad - .1, y + .15]], 56), 0, 0, 0));
  }

  // ---------- central keep ----------
  arcadeDrum(19, 14.4, 7.6, 20);
  arcadeDrum(14.5, 22, 6.8, 16);
  {
    const y = 28.8;
    B.stone.push(shaft(0, 0, spline([[11, y], [10.6, y + 3], [10.1, y + 8.4], [10.5, y + 9.3]], 14)));
    const n = 14; for (let i = 0; i < n; i++) { const a = (i + .5) / n * TAU; win(Math.sin(a) * 10.5, y + 1.6, Math.cos(a) * 10.5, a, 1.5, 5.6, 2); }
    for (let i = 0; i < n; i++) { const a = i / n * TAU; const g = new THREE.BoxGeometry(.5, 9.2, .8); B.trim.push(T(g, Math.sin(a) * 10.75, y + 4.5, Math.cos(a) * 10.75, a)); }
    ring(0, 0, 10.6, y + 9.4, .25, .5);
    const d = T(ribDome(10.4, 13, 14), 0, y + 9.5, 0);
    gradY(d, [[0, '#b9d6f5'], [.55, '#c9bcf6'], [1, '#f4f0ff']]);
    B.roof.push(d);
    // ribs of the dome in silver
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * TAU, pts = [];
      for (let k = 0; k <= 20; k++) { const v = k / 20, prof = 10.4 * (Math.sin(Math.min(1, v * 1.25) * Math.PI * .62 + .35) * 1.02) * Math.pow(1 - v, .62) * 1.045; pts.push(V(Math.sin(a) * prof, y + 9.5 + 13 * v, Math.cos(a) * prof)); }
      B.silver.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, .1, 6));
    }
    // lantern + central shell spire
    const ly = y + 21.6;
    B.stone.push(shaft(0, 0, [[2.9, ly], [2.5, ly + .6], [2.5, ly + 4.2], [3.0, ly + 4.7]], 28));
    for (let i = 0; i < 8; i++) { const a = (i + .5) / 8 * TAU; win(Math.sin(a) * 2.56, ly + .9, Math.cos(a) * 2.56, a, .78, 2.5, 2); }
    const sp = T(shellRoof(2.9, 19, 8.5), 0, ly + 4.6, 0); gradY(sp, [[0, '#c7b6f4'], [.5, '#a9d8f2'], [1, '#ffffff']]); B.roof.push(sp);
    // crescent finial: her crown's moon on top of the castle
    const S = new THREE.Shape(); S.absarc(0, 0, 1.5, .7, TAU - .7, false); S.absarc(.72, 0, 1.15, TAU - 1.32, 1.32, true);
    const c = T(ext(S, .14, .03), 0, 0, -.07); B.silver.push(T(c, 0, ly + 25.4, 0, 0, 1, 0, Math.PI / 2 + .28));
    B.silver.push(T(new THREE.SphereGeometry(.34, 18, 14), 0, ly + 23.7, 0));
  }

  // ---------- towers ----------
  const ringT = [[-31, -8, 12, 3.8, 27], [-24, -24, 12, 4.2, 37], [-8, -33, 12, 3.6, 41], [10, -34, 12, 4.4, 34], [27, -23, 12, 3.8, 30], [33, -6, 12, 4.2, 22]];
  ringT.forEach(([x, z, y0, rad, h], i) => tower(x, z, y0, rad, h, { c0: ['#c7b6f4', '#a7c8f6', '#d6bdf2'][i % 3], c1: ['#9fd5f0', '#b7a9f0', '#a3e0ea'][i % 3], roofH: rad * (3 + (i % 3) * .7), group: 3 }));
  tower(-28.5, 13, 13, 3.1, 21, { group: 3, roofH: 12 });          // beside the terrace
  tower(-7.5, 24.5, 21.6, 2.3, 18, { group: 3, roofH: 9.5, c0: '#d6bdf2' });  // gate turrets
  tower(7.5, 24.5, 21.6, 2.3, 18, { group: 3, roofH: 9.5, c0: '#d6bdf2' });
  tower(-15, -13, 28, 2.5, 21, { group: 3, roofH: 13, c1: '#b7a9f0' });
  tower(15, -13.5, 28, 2.6, 16, { group: 3, roofH: 12 });
  tower(38, 10, 11, 2.8, 15, { group: 3, roofH: 10 });

  // flying buttresses from the keep to the back towers
  ringT.forEach(([x, z, y0, rad, h]) => {
    const L = Math.hypot(x, z), dir = Math.atan2(x, z), inner = 14.8, reach = L - rad - inner, base = Math.min(y0 + h * .78, 30);
    const S = new THREE.Shape(); S.moveTo(0, 0); S.quadraticCurveTo(reach * .55, reach * .08, reach, reach * .55 + 1.4); S.lineTo(reach, reach * .55 + 2.5); S.quadraticCurveTo(reach * .42, reach * .3 + 1.1, 0, 1.3); S.closePath();
    const g = T(ext(S, .55, .05), 0, 0, -.27); const m = new THREE.Matrix4().makeRotationY(dir - Math.PI / 2).setPosition(Math.sin(dir) * (L - rad), base, Math.cos(dir) * (L - rad));
    g.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1)); g.index && g.toNonIndexed();
    g.applyMatrix4(m); B.trim.push(g);
  });

  // ---------- curtain wall with scalloped merlons ----------
  {
    const rw = 42, y = 12.4, h = 3.6;
    const pts = [[rw + .9, y - 3], [rw + .5, y], [rw, y + 1.2], [rw, y + h]];
    B.stone.push(shaft(0, 0, pts, 96)); B.stone.push(T(lathe([[rw, y + h], [rw - 1.8, y + h], [rw - 1.8, y - 2]], 96), 0, 0, 0));
    ring(0, 0, rw + .02, y + h - .1, .16, .2);
    const n = 150; for (let i = 0; i < n; i++) { const a = i / n * TAU; if (i % 2 === 0) put(I.mer, Math.sin(a) * rw, y + h, Math.cos(a) * rw, a, [.62, .75, .3]); }
    [.18, .74, 1.52, 2.3, 3.14, 3.95, 4.7, 5.5].forEach((a, i) => { if (Math.abs(a - .74) < .02 || Math.abs(a - 5.5) < .01) return; tower(Math.sin(a) * rw, Math.cos(a) * rw, 10.5, 2.5, 8 + (i % 3) * 3, { rows: 1, rings: 1, roofH: 8 + (i % 2) * 2.5, group: 4 }); });
    // main gate: arch + stairs facing the camera
    B.stone.push(T(new THREE.BoxGeometry(10, 12, 4), 0, 16, 42.2)); tower(-6.6, 42.4, 10.4, 2.5, 13, { rows: 2, roofH: 10, group: 4 }); tower(6.6, 42.4, 10.4, 2.5, 13, { rows: 2, roofH: 10, group: 4 });
    win(0, 11, 44.25, 0, 4.2, 7.2, 2);
  }

  // ---------- town of little shell-roofed houses on the mound ----------
  const houses = [];
  for (let i = 0; i < 150; i++) {
    const a = r() * TAU, rad = 47 + Math.pow(r(), .7) * 30, x = Math.sin(a) * rad, z = Math.cos(a) * rad;
    if (Math.abs(a) < .11 || Math.abs(a - TAU) < .11) continue;      // keep the road to the gate clear
    const h = 2.2 + r() * 3.6, w = 1.2 + r() * .9;
    houses.push({ x, z, y: groundH(x, z) - .4, h, w, ry: r() * TAU, t: r() });
  }
  const hStone = lathe([[1.08, 0], [1, .05], [.97, .92], [1.08, 1]], 14), hRoof = shellRoof(1.2, 2.5, 3, 18, 36);
  const hs = new THREE.InstancedMesh(merge([hStone]), R.stoneI, houses.length), hr = new THREE.InstancedMesh(merge([hRoof]), R.roofI, houses.length);
  houses.forEach((h, i) => {
    hs.setMatrixAt(i, new THREE.Matrix4().compose(V(h.x, h.y, h.z), new THREE.Quaternion(), V(h.w, h.h, h.w)));
    hr.setMatrixAt(i, new THREE.Matrix4().compose(V(h.x, h.y + h.h - .02, h.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, h.ry, 0)), V(h.w, h.w * (.9 + h.t * .5), h.w)));
    hr.setColorAt(i, new THREE.Color(['#c7b6f4', '#a7c8f6', '#d6bdf2', '#9fd5f0', '#e6d3f5'][i % 5]));
    const n = 2 + (i % 2); for (let k = 0; k < n; k++) { const a = h.ry + k / n * TAU, wy = h.y + h.h * .34; win(h.x + Math.sin(a) * (h.w * 1.0), wy, h.z + Math.cos(a) * (h.w * 1.0), a, .42, .95, 5, false); }
  });
  hs.castShadow = hs.receiveShadow = hr.castShadow = hr.receiveShadow = true; scene.add(hs, hr);

  // ---------- the terrace (the stage) ----------
  {
    const { x, z, y, r: Rt } = TERRACE;
    // the pier that holds it up: a sea-fan flare
    const pier = spline([[Rt * 1.0, y - .08], [Rt * .985, y - .55], [Rt * .9, y - 1.3], [Rt * .55, y - 3.6], [Rt * .32, y - 7], [Rt * .3, y - 13], [Rt * .52, y - 22]], 48);
    B.stone.push(shaft(x, z, pier, 72));
    ring(x, z, Rt - .08, y - .06, .1, .2); ring(x, z, Rt * .9, y - 1.22, .14, .16);
    for (let i = 0; i < 32; i++) {                   // ribs under the deck
      const a = i / 32 * TAU, pts = [];
      for (let k = 0; k <= 12; k++) { const t = k / 12, pr = lerp(Rt * .97, Rt * .32, Math.pow(t, .7)), py = lerp(y - .6, y - 7.5, t); pts.push(V(x + Math.sin(a) * (pr + .1), py, z + Math.cos(a) * (pr + .1))); }
      B.trim.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, .13, 6));
    }
    // balustrade around the sea side; opening towards the keep
    const nb = 110; for (let i = 0; i < nb; i++) {
      const a = i / nb * TAU, d = Math.abs(((a - 2.62 + Math.PI * 3) % TAU) - Math.PI);   // a=2.62 points at the keep
      if (d < .48) continue;
      put(I.bal, x + Math.sin(a) * (Rt - .35), y, z + Math.cos(a) * (Rt - .35), a, [1, 1, 1]);
    }
    const railPts = (Rd, yy) => { const p = []; for (let i = 0; i <= 96; i++) { const a = 2.62 + .48 + i / 96 * (TAU - .96); p.push(V(x + Math.sin(a) * Rd, yy, z + Math.cos(a) * Rd)); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p), 280, .085, 8); };
    B.trim.push(railPts(Rt - .35, y + 1.02), railPts(Rt - .35, y + .06));
    for (let i = 0; i < 10; i++) {                   // lamp posts: small glass shell on a pillar
      const a = 2.62 + .58 + i / 9 * (TAU - 1.16), px = x + Math.sin(a) * (Rt - .35), pz = z + Math.cos(a) * (Rt - .35);
      B.trim.push(T(lathe(spline([[.3, 0], [.26, .08], [.17, .25], [.15, 1.3], [.2, 1.4], [.13, 1.52]], 14), 12), px, y, pz));
    }
    // a level causeway to the keep deck
    { const a = 2.62, L = 9.4, cx = x + Math.sin(a) * (Rt + L / 2 - .4), cz = z + Math.cos(a) * (Rt + L / 2 - .4);
      B.trim.push(T(new THREE.BoxGeometry(5.6, .22, L), cx, y - .11, cz, a));
      B.stone.push(T(new THREE.BoxGeometry(5.0, 1.6, L), cx, y - 1.0, cz, a));
      for (const sd of [-1, 1]) { const px = cx + Math.cos(a) * sd * 2.7, pz = cz - Math.sin(a) * sd * 2.7; B.trim.push(T(new THREE.BoxGeometry(.26, 1.1, L), px, y + .45, pz, a)); }
    }
  }

  // ---------- Moon Tower (her room is inside; the bay window faces the camera) ----------
  {
    const { x, z, y0, h, r: Rm, floor, ceil } = MOON, gap = .52;   // half-angle of the bay opening
    const n = 20, pts = []; for (let i = 0; i <= n; i++) { const t = i / n; pts.push([Rm * (1 + .16 * Math.pow(1 - clamp(t / .18), 2)), y0 + h * t]); }
    B.stone.push(shaft(x, z, pts, 72, gap, TAU - gap * 2));
    B.stone.push(shaft(x, z, spline([[Rm * .97, y0 + h - 1.4], [Rm, y0 + h - 1], [Rm * 1.14, y0 + h], [Rm * 1.15, y0 + h + 2.1], [Rm * 1.18, y0 + h + 2.3]], 18), 72));
    ring(x, z, Rm - .02, y0 + 8, .14, .2); ring(x, z, Rm - .02, floor - .6, .2, .3); ring(x, z, Rm - .02, ceil + 1.3, .16, .24);
    const crown = Rm * 1.15, cn = 44;
    for (let i = 0; i < cn; i++) { const a = i / cn * TAU; put(I.cor, x + Math.sin(a) * crown * .94, y0 + h - .65, z + Math.cos(a) * crown * .94, a, [.36, .8, .5]); if (i % 2 === 0) put(I.mer, x + Math.sin(a) * (crown + .02), y0 + h + 2.3, z + Math.cos(a) * (crown + .02), a, [.5, .7, .26]); }
    for (let i = 0; i < 16; i++) { if (i === 0 || i === 15) continue; const a = (i + .5) / 16 * TAU; win(x + Math.sin(a) * (crown + .04), y0 + h + .3, z + Math.cos(a) * (crown + .04), a, .62, 1.4, 3); }
    B.stone.push(T(lathe([[.05, y0 + h + 1.9], [Rm * 1.16, y0 + h + 1.9]], 72), x, 0, z));
    const roof = T(shellRoof(Rm * 1.1, 24, 7.5), x, y0 + h + 2.2, z, .6); gradY(roof, [[0, '#bda9f2'], [.5, '#9fdcf0'], [1, '#fdfbff']]); B.roof.push(roof);
    B.silver.push(T(lathe(spline([[.04, y0 + h + 26], [.42, y0 + h + 26.1], [.58, y0 + h + 26.5], [.3, y0 + h + 27], [.1, y0 + h + 27.6], [.02, y0 + h + 28.4]], 22), 18), x, 0, z));
    // lower-tower windows
    for (let j = 0; j < 2; j++) for (let i = 2; i < 12; i += 2) { const a = gap + i / 14 * (TAU - gap * 2); win(x + Math.sin(a + 1.57 - 1.57) * (Rm + .05), y0 + 3 + j * 5, z + Math.cos(a) * (Rm + .05), a, .9, 2.1, 3); }

    // bay wall with the great window
    const bw = 2 * Rm * Math.sin(gap), bz = Rm * Math.cos(gap), W = 5.6, H = 7.0, wy = floor + .15;
    const S = new THREE.Shape(); S.moveTo(-bw / 2, 0); S.lineTo(-bw / 2, y0 + h - 0 - wy + (wy - y0)); S.lineTo(bw / 2, y0 + h - wy + (wy - y0)); S.lineTo(bw / 2, 0); S.closePath();
    const hole = archHole(W, H); const hp = hole.getPoints(30).map(p => new THREE.Vector2(p.x, p.y + (wy - y0))); S.holes.push(new THREE.Path(hp));
    const wall = ext(S, .9, .04); uvScale(wall, .1, .1); B.stone.push(T(T(wall, 0, 0, -.45), x, y0, z + bz + .5));
    // window frame + tracery
    const out = .4, F = archShape(W + out * 2, H + out * 1.5); F.holes.push(archHole(W, H));
    B.trim.push(T(T(ext(F, .34, .05), 0, 0, -.1), x, wy - .05, z + bz + .96));
    const mull = (px, top) => { const g = new THREE.BoxGeometry(.13, top, .16); B.silver.push(T(g, x + px, wy + top / 2, z + bz + .6)); };
    mull(-W / 6, H * .78); mull(W / 6, H * .78);
    for (const p of [-1, 1]) {                       // arched tracery heads
      const curve = new THREE.CubicBezierCurve3(V(x + p * W / 6, wy + H * .77, z + bz + .6), V(x + p * W / 6, wy + H * .9, z + bz + .6), V(x + p * W * .12, wy + H * .98, z + bz + .6), V(x, wy + H * .995, z + bz + .6));
      B.silver.push(new THREE.TubeGeometry(curve, 16, .06, 6));
    }
    B.silver.push(T(new THREE.BoxGeometry(W, .1, .16), x, wy + H * .5, z + bz + .6));
    B.silver.push(T(new THREE.BoxGeometry(W + .6, .22, 1.6), x, wy - .08, z + bz + .9));
    // balcony below the window
    const bal = T(lathe(spline([[2.9, 0], [2.86, -.12], [2.3, -.9], [1.0, -1.9], [.05, -2.5]], 18), 40, -Math.PI / 2, Math.PI), x, wy - .06, z + bz + 1.0); B.trim.push(bal);
    for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + i / 15 * Math.PI, bx = x + Math.sin(a) * 2.75, bzz = z + bz + 1.0 + Math.cos(a) * 2.75; put(I.bal, bx, wy - .08, bzz, a, [.7, .8, .7]); }
  }

  // ---------- bake buckets ----------
  const paintStone = g => {
    const p = g.attributes.position, c = new Float32Array(p.count * 3), a = new THREE.Color('#6f7bc0'), b = new THREE.Color('#ded9f4'), d = new THREE.Color('#fbf8ff'), t = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = smooth(9, 26, y + (fbm(x * .1, y * .1, z * .1, 3) - .5) * 14), hi = smooth(26, 50, y);
      t.copy(a).lerp(b, k).lerp(d, hi); c[i * 3] = t.r; c[i * 3 + 1] = t.g; c[i * 3 + 2] = t.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
  };
  const add = (list, mat, shadow = true) => { if (!list.length) return null; const m = new THREE.Mesh(merge(list), mat); m.castShadow = shadow; m.receiveShadow = true; scene.add(m); return m; };
  const stoneM = add([paintStone(merge(B.stone))], R.stone);
  add(B.trim, R.trim); add(B.roof, R.roof); add(B.silver, R.silver); add(B.dark, R.dark, false);

  // instanced repeats
  const colG = lathe(spline([[.62, 0], [.56, .03], [.4, .07], [.33, .12], [.3, .5], [.27, .9], [.36, .95], [.5, .985], [.62, 1]], 24), 12);
  const corG = (() => { const S = new THREE.Shape(); S.moveTo(-.5, 1); S.lineTo(.5, 1); S.lineTo(.5, .6); S.quadraticCurveTo(.3, .1, 0, 0); S.quadraticCurveTo(-.3, .1, -.5, .6); S.closePath(); return T(ext(S, 1, 0), 0, 0, -.5); })();
  const merG = (() => { const S = new THREE.Shape(); S.moveTo(-.5, 0); S.lineTo(-.5, .55); S.absarc(0, .55, .5, Math.PI, 0, true); S.lineTo(.5, 0); S.closePath(); return T(ext(S, .9, .03), 0, 0, -.45); })();
  const balG = lathe(spline([[.13, 0], [.09, .06], [.07, .2], [.13, .42], [.145, .55], [.09, .75], [.06, .84], [.11, .92], [.13, 1]], 26), 8);
  const inst = (geo, list, mat) => { const m = new THREE.InstancedMesh(merge([geo]), mat, list.length); list.forEach((x, i) => m.setMatrixAt(i, x)); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
  inst(colG, I.col, R.trim); inst(corG, I.cor, R.trim); inst(merG, I.mer, R.trim); inst(balG, I.bal, R.trim);

  // windows
  const W = wins.length, gl = new THREE.ShapeGeometry(archShape(1, 1), 8);
  { const p = gl.attributes.position, u = gl.attributes.uv; gl.computeBoundingBox(); for (let i = 0; i < p.count; i++) u.setXY(i, p.getX(i) + .5, p.getY(i)); }
  const winM = new THREE.InstancedMesh(gl, R.window, W), aLit = new Float32Array(W);
  wins.forEach((w, i) => winM.setMatrixAt(i, w.m));
  winM.geometry.setAttribute('aLit', new THREE.InstancedBufferAttribute(aLit, 1));
  winM.frustumCulled = false; scene.add(winM);

  return { wins, winM, aLit, stoneM };
}

/** Average normals across coincident vertices (icosphere geometry is unindexed, so it would shade faceted). */
function smoothNormals(g) {
  const p = g.attributes.position, n = g.attributes.normal, map = new Map();
  for (let i = 0; i < p.count; i++) { const k = `${Math.round(p.getX(i) * 400)},${Math.round(p.getY(i) * 400)},${Math.round(p.getZ(i) * 400)}`; const e = map.get(k) || [0, 0, 0, []]; e[0] += n.getX(i); e[1] += n.getY(i); e[2] += n.getZ(i); e[3].push(i); map.set(k, e); }
  for (const e of map.values()) { const l = Math.hypot(e[0], e[1], e[2]) || 1; for (const i of e[3]) n.setXYZ(i, e[0] / l, e[1] / l, e[2] / l); }
}

// ---------- seabed, rocks, coral ----------
export function buildSeabed(scene, R) {
  const r = rng(99);
  // ground
  const N = 420, S = 640, g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  const rock = new THREE.Color('#2a2f73'), rock2 = new THREE.Color('#4a4a9c'), sand = new THREE.Color('#2f3a8c'), lilac = new THREE.Color('#a891dc'), t = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = groundH(x, z); p.setY(i, y);
    const rr = Math.hypot(x, z), k = smooth(62, 96, rr), n = fbm(x * .09, 2, z * .09, 4);
    t.copy(rock).lerp(rock2, n * 1.2).lerp(lilac, smooth(.55, .75, fbm(x * .03, 8, z * .03, 3)) * .5).lerp(sand, k);
    c[i * 3] = t.r; c[i * 3 + 1] = t.g; c[i * 3 + 2] = t.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals();
  const ground = new THREE.Mesh(g, R.ground); ground.receiveShadow = true; scene.add(ground);

  // tall sea stacks that frame the castle
  const stack = (seed, sc) => {
    const q = new THREE.IcosahedronGeometry(1, 22), pos = q.attributes.position, col = new Float32Array(pos.count * 3);
    const out = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      out.fromBufferAttribute(pos, i); const n = out.clone().normalize();
      const d = ridged(n.x * 1.7 + seed, n.y * 3.2, n.z * 1.7, 5), e = fbm(n.x * 6 + seed, n.y * 9, n.z * 6, 4);
      const lay = Math.sin(n.y * 34 + e * 7) * .018;     // strata
      const R0 = 1 + (d - .5) * .85 + (e - .5) * .25 + lay;
      pos.setXYZ(i, n.x * R0, n.y * R0, n.z * R0);
      const h = n.y * .5 + .5, k = clamp(h * 1.1 + (e - .5) * .8);
      t.copy(rock).lerp(rock2, k).lerp(lilac, smooth(.72, .92, h + (d - .5) * .4) * .55);
      col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b;
    }
    q.setAttribute('color', new THREE.BufferAttribute(col, 3)); q.computeVertexNormals(); smoothNormals(q); return q;
  };
  const stacks = [[-92, -30, 26, 62, 30], [-120, -70, 34, 88, 38], [-70, -86, 22, 54, 26], [96, -36, 28, 72, 32], [128, -78, 38, 96, 42], [74, -92, 20, 46, 24],
    [0, -135, 46, 70, 46], [-52, -128, 26, 80, 30], [46, -140, 30, 92, 36], [-150, 10, 30, 64, 40], [158, 22, 34, 74, 46], [-112, 44, 16, 34, 20], [120, 56, 15, 30, 18]];
  const G0 = [stack(1.3), stack(5.1), stack(9.7)];
  stacks.forEach(([x, z, sx, sy, sz], i) => { const m = new THREE.Mesh(G0[i % 3], R.rock); m.position.set(x, groundH(x, z) + sy * .32, z); m.scale.set(sx, sy, sz); m.rotation.y = i * 1.3; m.castShadow = true; m.receiveShadow = true; scene.add(m); });
  // natural arch far behind
  { const a = new THREE.TorusGeometry(52, 15, 24, 96, Math.PI); const q = a.attributes.position; for (let i = 0; i < q.count; i++) { const x = q.getX(i), y = q.getY(i), z = q.getZ(i), n = fbm(x * .05, y * .05, z * .05, 4) - .5; q.setXYZ(i, x + n * 22, y + n * 22, z + n * 16); } a.computeVertexNormals();
    const col = new Float32Array(q.count * 3).fill(0); for (let i = 0; i < q.count; i++) { t.copy(rock).lerp(rock2, .6); col.set([t.r, t.g, t.b], i * 3); } a.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(a, R.rock); m.position.set(-34, 0, -190); scene.add(m); }

  // coral: branching tubes
  const branch = (out, seed, o) => {
    const q = rng(seed);
    const grow = (px, dir, len, rad, depth) => {
      const pts = [px.clone()]; let d = dir.clone(), cur = px.clone(); const n = 4;
      for (let i = 0; i < n; i++) { d.add(V((q() - .5) * .36, (q() - .5) * .14 + .05, (q() - .5) * .36 * o.flat)).normalize(); cur = cur.clone().addScaledVector(d, len / n); pts.push(cur); }
      out.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, rad, 5));
      out.push(T(new THREE.SphereGeometry(rad * .96, 6, 5), cur.x, cur.y, cur.z));
      if (depth <= 0) return;
      const kids = 2 + (q() < .55 ? 1 : 0);
      for (let k = 0; k < kids; k++) { const a = q() * TAU, sp = .55 + q() * .45; grow(cur, d.clone().add(V(Math.cos(a) * sp, .12, Math.sin(a) * sp * o.flat)).normalize(), len * (.66 + q() * .16), rad * .68, depth - 1); }
    };
    const base = o.trunks; for (let i = 0; i < base; i++) { const a = i / base * TAU + q(); grow(V(Math.cos(a) * .12, 0, Math.sin(a) * .12 * o.flat), V(Math.cos(a) * .35, 1, Math.sin(a) * .35 * o.flat).normalize(), 1.0, .1, o.depth); }
  };
  const cg = [];
  for (let i = 0; i < 3; i++) { const l = []; branch(l, 40 + i, { flat: i === 2 ? .12 : 1, trunks: i === 2 ? 3 : 4, depth: i === 2 ? 5 : 4 }); cg.push(merge(l)); }
  const pos = [];
  const addCoral = (x, z, s, y) => pos.push({ x, y: y ?? groundH(x, z) - .1, z, s, ry: r() * TAU, v: pos.length % 3 });
  for (let i = 0; i < 170; i++) { const a = r() * TAU, d = 46 + r() * 80, x = Math.sin(a) * d, z = Math.cos(a) * d; addCoral(x, z, 1.4 + r() * 2.6); }
  return { ground, addCoral, finishCoral() {
    for (let v = 0; v < 3; v++) {
      const list = pos.filter(q => q.v === v), m = new THREE.InstancedMesh(cg[v], R.coral, list.length);
      const col = ['#d9a6ea', '#f0a9d4', '#b6a2f2', '#a9c8f7'];
      list.forEach((q, i) => { m.setMatrixAt(i, new THREE.Matrix4().compose(V(q.x, q.y, q.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, q.ry, 0)), V(q.s, q.s, q.s))); m.setColorAt(i, new THREE.Color(col[(i * 7) % 4])); });
      m.castShadow = true; m.frustumCulled = false; scene.add(m);
    }
  } };
}
