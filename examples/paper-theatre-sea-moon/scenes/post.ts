// @ts-nocheck
// Film pipeline: scene → bokeh depth of field → card pass → bloom → grade. All in linear HDR until the last pass.
import { THREE } from './lib.js';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

export function makePost(renderer, W, H) {
  const hdr = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const depth = new THREE.DepthTexture(W, H, THREE.UnsignedIntType);
  const rtMain = new THREE.WebGLRenderTarget(W, H, { ...hdr, depthBuffer: true, samples: 2, depthTexture: depth });
  const rtDof = new THREE.WebGLRenderTarget(W, H, { ...hdr, depthBuffer: true });
  const rtShaft = [0, 1].map(() => new THREE.WebGLRenderTarget(Math.ceil(W / 3), Math.ceil(H / 3), { ...hdr }));
  const blurDiv = [4, 8, 16], blur = blurDiv.map(d => [0, 1].map(() => new THREE.WebGLRenderTarget(Math.ceil(W / d), Math.ceil(H / d), hdr)));
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const fsScene = new THREE.Scene(); fsScene.add(quad); quad.frustumCulled = false;
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.clear(); renderer.render(fsScene, cam); };

  const dof = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { tC: { value: null }, tD: { value: depth }, uPx: { value: new THREE.Vector2(1 / W, 1 / H) }, uFocus: { value: 10 }, uAperture: { value: 0 }, uNear: { value: .1 }, uFar: { value: 1 }, uMax: { value: 22 * H / 1080 } },
    vertexShader: VS,
    fragmentShader: /* glsl */`
    varying vec2 vUv; uniform sampler2D tC, tD; uniform vec2 uPx; uniform float uFocus, uAperture, uNear, uFar, uMax, uStep;
    const float GA = 2.39996323;
    float lin(float d){ float z = d * 2. - 1.; return 2. * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
    float coc(float z){ return clamp(abs(1. / uFocus - 1. / z) * uAperture, 0., uMax); }
    float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
    void main(){
      vec4 c0 = texture2D(tC, vUv); if (any(isnan(c0)) || any(isinf(c0))) c0 = vec4(0.);
      if (uAperture <= 0.) { gl_FragColor = c0; return; }
      float zc = lin(texture2D(tD, vUv).x), sc = coc(zc);
      if (sc < .7) { gl_FragColor = c0; return; }                 // in focus: one read
      vec3 col = c0.rgb; float tot = 1., ang = ign(gl_FragCoord.xy) * 6.2832;
      const int N = 36;
      for (int i = 0; i < N; i++) {
        float rad = sc * sqrt((float(i) + .5) / float(N)); ang += GA;
        vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uPx * rad;
        vec3 sa = texture2D(tC, tc).rgb; if (any(isnan(sa)) || any(isinf(sa))) sa = c0.rgb;
        float zs = lin(texture2D(tD, tc).x), m = 1.;
        if (zs < zc) { float ss = coc(zs); m = smoothstep(rad - .5, rad + .5, ss); }    // sharp things in front stay out of the blur
        col += mix(c0.rgb, sa, m); tot += 1.;
      }
      gl_FragColor = vec4(col / tot, 1.);
    }`,
  });

  // volumetric moon shafts: march the view ray through a pattern projected down from the surface
  const shaft = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { tD: { value: depth }, uInv: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() }, uSurfY: { value: 190 }, uDir: { value: new THREE.Vector3() }, uT: { value: 0 }, uFar: { value: 230 }, uScale: { value: .03 }, uFall: { value: .0048 } },
    vertexShader: VS,
    fragmentShader: /* glsl */`
    varying vec2 vUv; uniform sampler2D tD; uniform mat4 uInv; uniform vec3 uCam, uDir; uniform float uSurfY, uT, uFar, uScale, uFall;
    float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hs(i), hs(i + vec2(1, 0)), f.x), mix(hs(i + vec2(0, 1)), hs(i + vec2(1, 1)), f.x), f.y); }
    float pat(vec2 q){ float a = vn(q + uT * .05), b = vn(q * 2.3 - uT * .07 + 4.), c = vn(q * .45 + 9.); float s = a * .6 + b * .4; return smoothstep(.56, .72, s) * (.2 + c * c * 1.6); }
    void main(){
      float dz = texture2D(tD, vUv).x; vec4 p = uInv * vec4(vUv * 2. - 1., dz * 2. - 1., 1.); p /= p.w;
      vec3 v = p.xyz - uCam; float L = min(length(v), uFar); v = normalize(v);
      const int N = 26; float dt = L / float(N), t = dt * hs(vUv * 917.), acc = 0.;
      for (int i = 0; i < N; i++) {
        vec3 q = uCam + v * t; float dep = uSurfY - q.y;
        vec2 pr = q.xz + uDir.xz / uDir.y * dep;
        acc += pat(pr * uScale) * exp(-dep * uFall) * exp(-t * .0075) * dt; t += dt;
      }
      gl_FragColor = vec4(vec3(acc * .012), 1.);
    }`,
  });

  const bright = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { tC: { value: null }, uThr: { value: 1 } }, vertexShader: VS,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tC; uniform float uThr; void main(){ vec3 c = min(texture2D(tC, vUv).rgb, vec3(12.)); if (any(isnan(c))) c = vec3(0.); float l = max(c.r, max(c.g, c.b)); float k = smoothstep(uThr * .7, uThr * 1.5, l); gl_FragColor = vec4(c * k, 1.); }` });
  const gauss = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { tC: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: VS,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tC; uniform vec2 uDir;
    void main(){ vec3 c = texture2D(tC, vUv).rgb * .1964; float o[5]; o[0]=1.4118;o[1]=3.2941;o[2]=5.1765;o[3]=7.0588;o[4]=8.9412; float w[5]; w[0]=.2969;w[1]=.0945;w[2]=.0104;w[3]=.0005;w[4]=.0001;
      for(int i=0;i<5;i++){ c += (texture2D(tC, vUv + uDir*o[i]).rgb + texture2D(tC, vUv - uDir*o[i]).rgb) * w[i]; } gl_FragColor = vec4(c, 1.); }` });

  const final = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { tC: { value: null }, tB0: { value: null }, tB1: { value: null }, tB2: { value: null }, tS: { value: null }, uShaft: { value: 0 }, uShaftC: { value: new THREE.Color('#a9d8ff') }, uBloom: { value: .4 }, uExposure: { value: 1 }, uSeed: { value: 1 }, uVig: { value: .35 }, uTint: { value: new THREE.Color(1, 1, 1) }, uShadow: { value: new THREE.Color('#0a1038') }, uWarp: { value: 1 }, uTime: { value: 0 }, uAspect: { value: W / H }, uLift: { value: .018 }, uSat: { value: 1 } },
    vertexShader: VS,
    fragmentShader: /* glsl */`
    varying vec2 vUv; uniform sampler2D tC, tB0, tB1, tB2, tS; uniform vec3 uShaftC; uniform float uShaft, uBloom, uExposure, uSeed, uVig, uWarp, uTime, uAspect, uLift, uSat; uniform vec3 uTint, uShadow;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      // slight refraction of the whole picture: we are under water
      uv += uWarp * .0012 * vec2(sin(uv.y * 17. + uTime * 1.3) + .5 * sin(uv.y * 41. - uTime), cos(uv.x * 13. - uTime * 1.1));
      vec2 q = uv - .5; float d2 = dot(q, q);
      vec3 c = vec3(texture2D(tC, uv + q * d2 * .0035).r, texture2D(tC, uv).g, texture2D(tC, uv - q * d2 * .0035).b);
      vec3 b = texture2D(tB0, uv).rgb * .5 + texture2D(tB1, uv).rgb * .32 + texture2D(tB2, uv).rgb * .28;
      c += b * uBloom + texture2D(tS, uv).r * uShaft * uShaftC;
      c *= uExposure * uTint;
      c = aces(c * .92);
      c = pow(c, vec3(1. / 2.2));
      float l = dot(c, vec3(.3, .59, .11));
      c = mix(vec3(l), c, uSat);
      c = c + uShadow * (1. - smoothstep(0., .55, l)) * .5 + uLift;              // lifted, tinted shadows: matches the painted art
      float v = 1. - uVig * smoothstep(.12, .75, d2 * 2.);
      c *= v;
      c += (h(vUv * 811.) - .5) * .018;
      gl_FragColor = vec4(c, 1.);
    }`,
  });

  /** Renders one frame. `drawOverlay(target)` paints the in-focus hanging cards after the DOF pass. */
  function render(scene, camera, o) {
    renderer.setRenderTarget(rtMain); renderer.clear(); renderer.render(scene, camera);
    if ((o.shaft ?? 0) > 0) {
      const S = shaft.uniforms; S.uInv.value.copy(camera.projectionMatrixInverse).premultiply(camera.matrixWorld); S.uCam.value.setFromMatrixPosition(camera.matrixWorld);
      S.uSurfY.value = o.surfY; S.uDir.value.copy(o.moonDir); S.uT.value = o.time ?? 0; S.uFall.value = o.shaftFall ?? .0048; S.uScale.value = o.shaftScale ?? .03;
      pass(shaft, rtShaft[0]);
      gauss.uniforms.tC.value = rtShaft[0].texture; gauss.uniforms.uDir.value.set(.8 / rtShaft[0].width, 0); pass(gauss, rtShaft[1]);
      gauss.uniforms.tC.value = rtShaft[1].texture; gauss.uniforms.uDir.value.set(0, .8 / rtShaft[0].height); pass(gauss, rtShaft[0]);
    }
    dof.uniforms.tC.value = rtMain.texture; dof.uniforms.uFocus.value = o.focus; dof.uniforms.uAperture.value = (o.aperture ?? 0) * H / 1080;
    dof.uniforms.uNear.value = camera.near; dof.uniforms.uFar.value = camera.far;
    pass(dof, rtDof);
    bright.uniforms.uThr.value = o.bloomThr ?? 1.0; bright.uniforms.tC.value = rtDof.texture;
    pass(bright, blur[0][0]);
    let src = blur[0][0];
    blur.forEach(([a, b], i) => {
      gauss.uniforms.tC.value = i === 0 ? a.texture : src.texture; gauss.uniforms.uDir.value.set(1 / a.width, 0);
      if (i === 0) { pass(gauss, b); gauss.uniforms.tC.value = b.texture; gauss.uniforms.uDir.value.set(0, 1 / a.height); pass(gauss, a); src = a; }
      else { pass(gauss, b); gauss.uniforms.tC.value = b.texture; gauss.uniforms.uDir.value.set(0, 1 / a.height); pass(gauss, a); src = a; }
    });
    const u = final.uniforms; u.tS.value = rtShaft[0].texture; u.uShaft.value = o.shaft ?? 0; if (o.shaftC) u.uShaftC.value.set(o.shaftC); u.tC.value = rtDof.texture; u.tB0.value = blur[0][0].texture; u.tB1.value = blur[1][0].texture; u.tB2.value = blur[2][0].texture;
    u.uBloom.value = o.bloom ?? .4; u.uExposure.value = o.exposure ?? 1; u.uSeed.value = o.seed ?? 1; u.uVig.value = o.vig ?? .35; u.uTime.value = o.time ?? 0; u.uWarp.value = o.warp ?? 1; u.uSat.value = o.sat ?? 1; u.uLift.value = o.lift ?? .015;
    if (o.tint) u.uTint.value.set(o.tint); else u.uTint.value.set('#ffffff'); if (o.shadow) u.uShadow.value.set(o.shadow);
    pass(final, null);
    // story cards sit on top of the graded picture, so water, bloom and exposure never wash the text out
    if (o.overlay) { renderer.setRenderTarget(null); renderer.autoClear = false; renderer.clearDepth(); o.overlay(renderer, camera); renderer.autoClear = true; }
  }
  /** The player can change output scale at any time. */
  function setSize(w, h) {
    if (w === W && h === H) return; W = w; H = h;
    rtMain.setSize(w, h); rtDof.setSize(w, h); rtShaft.forEach(r => r.setSize(Math.ceil(w / 3), Math.ceil(h / 3)));
    blur.forEach((p, i) => p.forEach(r => r.setSize(Math.ceil(w / blurDiv[i]), Math.ceil(h / blurDiv[i]))));
    dof.uniforms.uPx.value.set(1 / w, 1 / h); dof.uniforms.uMax.value = 22 * h / 1080; final.uniforms.uAspect.value = w / h;
  }
  return { render, rtMain, setSize };
}

/** Planar reflection helper (a Reflector without the mesh): renders the mirrored view into a texture. */
export function makeMirror(renderer, W, H) {
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
  const vc = new THREE.PerspectiveCamera(), mat = new THREE.Matrix4();
  const N = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), cw = new THREE.Vector3(), view = new THREE.Vector3(), target = new THREE.Vector3(), look = new THREE.Vector3(), rot = new THREE.Matrix4();
  const uniform = { tMirror: { value: rt.texture }, uMirrorM: { value: mat }, uMirrorAmt: { value: 0 } };
  const plane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4();
  function render(scene, camera, y, hide = []) {
    P.set(0, y, 0); cw.setFromMatrixPosition(camera.matrixWorld);
    view.subVectors(P, cw); if (view.dot(N) > 0) return;
    view.reflect(N).negate().add(P);
    rot.extractRotation(camera.matrixWorld); look.set(0, 0, -1).applyMatrix4(rot).add(cw);
    target.subVectors(P, look).reflect(N).negate().add(P);
    vc.position.copy(view); vc.up.set(0, 1, 0).applyMatrix4(rot).reflect(N); vc.lookAt(target);
    vc.near = camera.near; vc.far = camera.far; vc.updateMatrixWorld(); vc.projectionMatrix.copy(camera.projectionMatrix);
    mat.set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1).multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);
    // oblique near plane so nothing under the floor shows up
    plane.setFromNormalAndCoplanarPoint(N, P).applyMatrix4(vc.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = vc.projectionMatrix;
    q.x = (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0]; q.y = (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5]; q.z = -1; q.w = (1 + pm.elements[10]) / pm.elements[14];
    clip.multiplyScalar(2 / clip.dot(q));
    pm.elements[2] = clip.x; pm.elements[6] = clip.y; pm.elements[10] = clip.z + 1 - .0; pm.elements[14] = clip.w;
    const was = hide.map(o => o.visible); hide.forEach(o => o.visible = false);
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, vc);
    hide.forEach((o, i) => o.visible = was[i]);
    renderer.setRenderTarget(null);
  }
  return { render, uniform };
}
