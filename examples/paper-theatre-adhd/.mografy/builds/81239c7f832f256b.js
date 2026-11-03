// ../../packages/runtime/dist/math.js
var clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
var pr = (t, start, end) => end === start ? t >= end ? 1 : 0 : clamp((t - start) / (end - start));
var lerp = (a, b, p) => a + (b - a) * p;
var ease = Object.freeze({
  linear: (p) => p,
  inQuad: (p) => p * p,
  outCubic: (p) => 1 - (1 - p) ** 3,
  inOutCubic: (p) => p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2,
  outExpo: (p) => p === 1 ? 1 : 1 - 2 ** (-10 * p),
  /** Softer landings than outCubic: the house default for entrances and moves. */
  outQuart: (p) => 1 - (1 - p) ** 4,
  /** Word and letter rises. */
  outQuint: (p) => 1 - (1 - p) ** 5,
  inOutQuart: (p) => p < 0.5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2,
  /** Gentle, symmetric: loops, breathing, slow drifts. */
  inOutSine: (p) => 0.5 - 0.5 * Math.cos(Math.PI * p)
});

// ../../packages/runtime/dist/motion.js
var at = (time, start, end, curve = ease.outCubic) => curve(pr(time, start, end));
function springEase(stiffness = 6, damping = 1) {
  const x = (u) => {
    if (damping >= 1)
      return 1 - (1 + u) * Math.exp(-u);
    const wd = Math.sqrt(1 - damping * damping);
    return 1 - Math.exp(-damping * u) * (Math.cos(wd * u) + damping / wd * Math.sin(wd * u));
  };
  const end = x(stiffness);
  return (p) => p <= 0 ? 0 : p >= 1 ? 1 : x(stiffness * p) / end;
}
var springs = Object.freeze({ out: springEase(5.5, 1), pop: springEase(7.5, 0.8), camera: springEase(6.5, 1), cursor: springEase(6, 1) });

// ../../packages/runtime/dist/film.js
function scope(t, draw) {
  if ("withCanvas" in t) {
    t.withCanvas(draw);
    return;
  }
  t.save();
  try {
    draw(t);
  } finally {
    t.restore();
  }
}
function beats(input) {
  if (!input.length)
    throw new Error("beats needs at least one shot");
  let start = 0;
  const list = input.map((b, index) => {
    if (!(b.end > start))
      throw new Error(`beats: "${b.title}" ends at ${b.end}, before it starts (${start})`);
    const stop = b.stop ?? start + (b.end - start) * 0.85;
    if (stop < start || stop > b.end)
      throw new Error(`beats: "${b.title}" stops at ${stop}, outside ${start}\u2013${b.end}`);
    const beat = { index, title: b.title, start, end: b.end, stop, handoff: b.handoff ?? 0, note: b.note ?? "" };
    start = b.end;
    return Object.freeze(beat);
  });
  const duration = start, last = list.length - 1;
  const transitions = list.filter((b, i) => b.handoff > 0 && i < last).map((b) => ({ start: Math.max(0, b.end - b.handoff / 2), end: Math.min(duration, b.end + b.handoff / 2) }));
  const reviewTimes = [...new Set([...list.map((b) => b.stop), ...transitions.flatMap((w) => [w.start, (w.start + w.end) / 2, w.end])].map((t) => Math.round(t * 1e3) / 1e3))].sort((a, b) => a - b);
  return Object.freeze({
    list: Object.freeze(list),
    duration,
    shots: list.map((b) => ({ end: b.end, stop: b.stop, title: b.title })),
    reviewTimes,
    transitions,
    at(time) {
      let i = 0;
      while (i < last && time >= list[i].end)
        i++;
      const beat = list[i];
      return { beat, local: time - beat.start, progress: clamp((time - beat.start) / (beat.end - beat.start)) };
    },
    get(title) {
      const beat = list.find((b) => b.title === title);
      if (!beat)
        throw new Error(`beats: no shot titled "${title}"`);
      return beat;
    }
  });
}

// ../../packages/runtime/dist/layers.js
var family = (f = "sans-serif") => /[,"']/.test(f) || /^(sans-serif|serif|monospace|system-ui)$/.test(f) ? f : `"${f}"`;
var font = (s) => `${s.weight ?? 400} ${s.size}px ${family(s.family)}`;
function text(ctx, value, x, y, s) {
  if (!value || s.alpha !== void 0 && s.alpha <= 1e-3)
    return;
  scope(ctx, (c) => {
    c.font = font(s);
    c.fillStyle = s.color;
    c.textAlign = s.align ?? "left";
    c.textBaseline = s.baseline ?? "alphabetic";
    c.letterSpacing = `${s.tracking ?? 0}px`;
    if (s.alpha !== void 0)
      c.globalAlpha *= clamp(s.alpha);
    if (s.maxWidth)
      c.fillText(value, x, y, s.maxWidth);
    else
      c.fillText(value, x, y);
  });
}

// scenes/three.ts
var loaded = /* @__PURE__ */ new Map();
async function prepareStage(ctx, build, o = {}) {
  const url = ctx.asset(o.library ?? "assets/three.module.js");
  let pending = loaded.get(url);
  if (!pending) {
    pending = import(
      /* @vite-ignore */
      url
    );
    loaded.set(url, pending);
  }
  const THREE2 = await pending.catch((error) => {
    loaded.delete(url);
    throw new Error(`Three.js failed to load from ${o.library ?? "assets/three.module.js"}. Copy extras/three/three.module.js into the project's assets/. (${String(error)})`);
  });
  const width = o.width ?? ctx.width, height = o.height ?? ctx.height;
  const surface = new OffscreenCanvas(width, height);
  const gl = surface.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: o.antialias ?? true, preserveDrawingBuffer: true });
  if (!gl) throw new Error("WebGL 2 is unavailable in this browser, so the 3D layer cannot render.");
  const renderer = new THREE2.WebGLRenderer({ canvas: surface, context: gl, alpha: true, premultipliedAlpha: true, antialias: o.antialias ?? true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE2.SRGBColorSpace;
  renderer.toneMapping = o.toneMapping === "none" ? THREE2.NoToneMapping : o.toneMapping === "agx" ? THREE2.AgXToneMapping : THREE2.ACESFilmicToneMapping;
  renderer.toneMappingExposure = o.exposure ?? 1;
  const scene = new THREE2.Scene();
  const camera = new THREE2.PerspectiveCamera(o.fov ?? 35, width / height, 0.1, 1e3);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  const objects = await build({ THREE: THREE2, scene, camera, renderer, setup: ctx });
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  return { THREE: THREE2, scene, camera, objects, width, height, renderer, surface };
}

// scenes/world.ts
var THREE;
var SANS = "Noto Sans CJK TC";
var SERIF = "Noto Serif CJK TC";
var TOP = 7.45;
var TRACK = { y: 5.95, z: 4.7 };
var COL = { wall: 15260868, floor: 14272680, side: 13610624, kraft: 12159575, card: 13610624, cream: 15721679, ink: 2893860, inkFloor: 2433310, gold: 13608270, red: 5974562, thread: 15327958 };
function rng(seed) {
  return () => {
    seed |= 0;
    seed = seed + 1831565813 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function tex(cv, repeat = 1) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}
function canvas(w, h) {
  return new OffscreenCanvas(w, h);
}
var BAKE_VERSION = 1;
var BAKE_CACHE = "mografy-baked-textures";
var BAKE_PREFIX = `https://mografy.local/baked/adhd-spotlight/v${BAKE_VERSION}/`;
var baked = /* @__PURE__ */ new Map();
var unbaked = [];
async function loadBaked() {
  try {
    if (typeof caches === "undefined") return;
    const cache = await caches.open(BAKE_CACHE);
    const keys = (await cache.keys()).filter((r) => r.url.startsWith(BAKE_PREFIX));
    await Promise.all(keys.map(async (r) => {
      const res = await cache.match(r);
      if (res) baked.set(r.url.slice(BAKE_PREFIX.length), await createImageBitmap(await res.blob()));
    }));
  } catch {
    baked.clear();
  }
}
function storeBaked() {
  for (const b of baked.values()) b.close();
  baked.clear();
  const list = unbaked.splice(0);
  if (!list.length || typeof caches === "undefined") return;
  void (async () => {
    try {
      const cache = await caches.open(BAKE_CACHE);
      for (const [k, c] of list) await cache.put(BAKE_PREFIX + k, new Response(await c.convertToBlob({ type: "image/png" })));
    } catch {
    }
  })();
}
function bake(key, w, h, draw) {
  const cv = new OffscreenCanvas(w, h), g = cv.getContext("2d"), hit = baked.get(key);
  if (hit && hit.width === w && hit.height === h) {
    g.drawImage(hit, 0, 0);
    return cv;
  }
  draw(g);
  unbaked.push([key, cv]);
  return cv;
}
function paperCanvas(base, o = {}) {
  const size = o.size ?? 512, seed = o.seed ?? 1, dark = !!o.dark, fiber = o.fiber ?? 0.08;
  return bake(`paper-${base.toString(16)}-${seed}-${size}-${fiber}-${dark ? 1 : 0}`, size, size, (g) => {
    const r = rng(seed);
    const id = new ImageData(size, size), d = id.data, cr = base >> 16 & 255, cg = base >> 8 & 255, cb = base & 255;
    for (let i = 0; i < d.length; i += 4) {
      const n = (r() - 0.5) * (dark ? 10 : 16);
      d[i] = cr + n;
      d[i + 1] = cg + n;
      d[i + 2] = cb + n;
      d[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    for (let i = 0; i < 46; i++) {
      const x = r() * size, y = r() * size, R = 26 + r() * 90, a = 0.025 + r() * 0.035, gr = g.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, dark ? `rgba(255,240,220,${a * 0.45})` : `rgba(120,90,55,${a})`);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(x - R, y - R, 2 * R, 2 * R);
    }
    g.lineCap = "round";
    for (let i = 0; i < size * fiber * 14; i++) {
      const x = r() * size, y = r() * size, a = r() * Math.PI * 2, L = 4 + r() * 18;
      g.strokeStyle = r() < 0.55 ? `rgba(255,248,235,${(dark ? 0.05 : 0.07) + r() * 0.09})` : `rgba(80,55,30,${0.04 + r() * 0.07})`;
      g.lineWidth = 0.6 + r() * 0.7;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a + 0.6) * L * 0.5, y + Math.sin(a + 0.6) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L);
      g.stroke();
    }
    for (let i = 0; i < size * 0.2; i++) {
      g.fillStyle = `rgba(60,40,22,${0.15 + r() * 0.25})`;
      g.beginPath();
      g.arc(r() * size, r() * size, 0.4 + r() * 0.8, 0, 7);
      g.fill();
    }
  });
}
function woodTex(seed, rx = 1, ry = 1, s = 1024) {
  const cv = bake(`wood-${seed}-${s}`, s, s, (g) => {
    const r = rng(seed);
    g.fillStyle = "#5A3E2A";
    g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y++) {
      const v = Math.sin(y * 0.045 + Math.sin(y * 0.011) * 3) * 0.5 + 0.5;
      g.fillStyle = `rgba(${50 + v * 40},${32 + v * 24},${18 + v * 12},${0.2 + r() * 0.1})`;
      g.fillRect(0, y, s, 1);
    }
    for (let i = 0; i < 900 * s / 1024; i++) {
      g.strokeStyle = `rgba(30,18,8,${0.05 + r() * 0.08})`;
      g.lineWidth = 0.5 + r();
      const y = r() * s;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(s * 0.3, y + (r() - 0.5) * 20, s * 0.6, y + (r() - 0.5) * 20, s, y + (r() - 0.5) * 10);
      g.stroke();
    }
  });
  const t = tex(cv);
  t.repeat.set(rx, ry);
  return t;
}
function twineCanvas() {
  const w = 256, h = 64;
  return bake("twine", w, h, (g) => {
    const r = rng(88);
    g.fillStyle = "#C9A877";
    g.fillRect(0, 0, w, h);
    for (let x = -h; x < w + h; x += 16) {
      const gr = g.createLinearGradient(x, 0, x + 16, 0);
      gr.addColorStop(0, "rgba(90,60,30,.55)");
      gr.addColorStop(0.45, "rgba(255,240,210,.25)");
      gr.addColorStop(1, "rgba(90,60,30,.5)");
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x + h * 0.7, 0);
      g.lineTo(x + h * 0.7 + 16, 0);
      g.lineTo(x + 16, h);
      g.fill();
    }
    for (let i = 0; i < 300; i++) {
      g.strokeStyle = `rgba(${r() < 0.5 ? "255,240,210" : "70,45,20"},${0.12 + r() * 0.2})`;
      g.lineWidth = 0.7;
      const x = r() * w, y = r() * h;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 3 + r() * 6, y - 2 - r() * 4);
      g.stroke();
    }
  });
}
function rectPath(x0, y0, x1, y1) {
  const p = new THREE.Path();
  p.moveTo(x0, y0);
  p.lineTo(x0, y1);
  p.lineTo(x1, y1);
  p.lineTo(x1, y0);
  p.closePath();
  return p;
}
function tapeCanvas(positions, o = {}) {
  const w = o.w ?? 2048, h = o.h ?? 96;
  return bake(`tape-${w}-${o.seed ?? 3}-${positions.length}-${(o.base ?? 0).toString(16)}`, w, h, (g) => {
    g.drawImage(paperCanvas(o.base ?? 15853523, { seed: o.seed ?? 3 }), 0, 0, w, h);
    g.strokeStyle = "rgba(60,40,22,.28)";
    g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
    g.globalCompositeOperation = "destination-out";
    for (let x = 12; x < w; x += 24) {
      g.beginPath();
      g.arc(x, h * 0.2, h * 0.045, 0, 7);
      g.fill();
    }
    for (const p of positions) {
      g.beginPath();
      g.arc(p * w, h * 0.6, h * 0.17, 0, 7);
      g.fill();
    }
    g.globalCompositeOperation = "source-over";
  });
}
function tapePositions(seed, noise, slow, n = 60) {
  const r = rng(seed), a = [];
  let x = 0.012;
  while (a.length < n && x < 0.985) {
    a.push(x);
    let gap = 0.022 * (1 + (r() - 0.5) * noise);
    if (r() < slow) gap += 0.024 + r() * 0.05;
    x += gap;
  }
  return a;
}
function buildWorld(T2, scene, renderer) {
  THREE = T2;
  const W = {};
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const paper = (base, seed, o = {}) => new THREE.MeshStandardMaterial({ map: tex(paperCanvas(base, { seed, dark: o.dark }), o.repeat ?? 1), roughness: o.rough ?? 0.93, side: THREE.DoubleSide, ...o.extra ?? {} });
  const ext = (s, depth = 0.022) => new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 40 });
  const add = (parent, geo, m, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const group = (parent = scene) => {
    const g = new THREE.Group();
    parent.add(g);
    return g;
  };
  const label = (w, h, draw) => {
    const cv = canvas(w, h), g = cv.getContext("2d");
    draw(g, w, h);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const brass = new THREE.MeshStandardMaterial({ color: 11569733, metalness: 1, roughness: 0.3, envMap: env, envMapIntensity: 1.1 });
  const threadMat = new THREE.MeshStandardMaterial({ color: COL.thread, roughness: 0.8 });
  const mGold = new THREE.MeshPhysicalMaterial({ map: tex(paperCanvas(COL.gold, { seed: 45 })), metalness: 0.85, roughness: 0.3, envMap: env, envMapIntensity: 1.4, clearcoat: 0.3, side: THREE.DoubleSide });
  const mCard = paper(COL.card, 43), mKraft = paper(COL.kraft, 11, { repeat: 2 }), mCream = paper(COL.cream, 44), mDarkCard = paper(3879981, 77, { dark: true });
  const woodSmall = woodTex(9, 0.3, 0.3, 256);
  const mWood = new THREE.MeshStandardMaterial({ map: woodSmall, roughness: 0.7 });
  const strGeo = new THREE.CylinderGeometry(8e-3, 8e-3, 1, 5);
  const string = (parent, a, b) => {
    const s = new THREE.Mesh(strGeo, threadMat);
    s.castShadow = true;
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
    s.position.copy(A).addScaledVector(d, 0.5);
    s.scale.y = d.length();
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    parent.add(s);
    return s;
  };
  W.brass = brass;
  W.mats = { paper, mGold };
  const box = group();
  W.box = box;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 7.6), paper(COL.wall, 3, { repeat: 2 }));
  wall.position.set(0, 3.8, 0);
  wall.receiveShadow = true;
  box.add(wall);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), paper(COL.floor, 5, { repeat: 2 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 3.5);
  floor.receiveShadow = true;
  box.add(floor);
  const mSide = paper(COL.side, 9, { repeat: 1.5 });
  W.sides = {};
  for (const sx of [-1, 1]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(7, 7.6), mSide);
    s.rotation.y = -sx * Math.PI / 2;
    s.position.set(sx * 6, 3.8, 3.5);
    s.receiveShadow = true;
    box.add(s);
    W.sides[sx] = s;
  }
  add(box, new THREE.BoxGeometry(13.4, 0.3, 7.6), mKraft, 0, -0.19, 3.6);
  W.backBoard = add(box, new THREE.BoxGeometry(12.4, 7.9, 0.2), mKraft, 0, 3.8, -0.16);
  W.outerSides = {};
  for (const sx of [-1, 1]) W.outerSides[sx] = add(box, new THREE.BoxGeometry(0.2, 7.9, 7.4), mKraft, sx * 6.16, 3.8, 3.5);
  W.dowels = group(box);
  for (const z of [1, 2, 3, 5]) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 12, 12), mWood);
    d.rotation.z = Math.PI / 2;
    d.position.set(0, TOP + 0.05, z);
    d.castShadow = true;
    W.dowels.add(d);
  }
  W.ink = group(box);
  const iw = new THREE.Mesh(new THREE.PlaneGeometry(12, 7.6), paper(COL.ink, 31, { dark: true, repeat: 2 }));
  iw.position.set(0, 3.8, 0.012);
  iw.receiveShadow = true;
  W.ink.add(iw);
  const ifl = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), paper(COL.inkFloor, 33, { dark: true, repeat: 2 }));
  ifl.rotation.x = -Math.PI / 2;
  ifl.position.set(0, 0.012, 3.5);
  ifl.receiveShadow = true;
  W.ink.add(ifl);
  const mInkSide = paper(3353896, 35, { dark: true, repeat: 1.5 });
  W.inkSides = {};
  for (const sx of [-1, 1]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(7, 7.6), mInkSide);
    s.rotation.y = -sx * Math.PI / 2;
    s.position.set(sx * 5.988, 3.8, 3.5);
    s.receiveShadow = true;
    W.ink.add(s);
    W.inkSides[sx] = s;
  }
  const pro = new THREE.Shape();
  pro.moveTo(-6.7, -0.34);
  pro.lineTo(6.7, -0.34);
  pro.lineTo(6.7, 8.9);
  pro.lineTo(-6.7, 8.9);
  pro.closePath();
  pro.holes.push(rectPath(-5.6, 0, 5.6, 6.5));
  W.pro = new THREE.Mesh(ext(pro, 0.16), paper(COL.red, 21, { dark: true }));
  W.pro.position.z = 7;
  W.pro.castShadow = W.pro.receiveShadow = true;
  box.add(W.pro);
  const tt = label(2400, 420, (g) => {
    g.fillStyle = "#E4C06C";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `700 200px "${SERIF}"`;
    g.letterSpacing = "36px";
    g.fillText("\u4E0D\u807D\u4F7F\u559A\u7684\u71C8", 1218, 165);
    g.font = `500 54px "${SANS}"`;
    g.letterSpacing = "20px";
    g.fillText("ADHD \u30FB THE UNRULY SPOTLIGHT", 1210, 345);
  });
  W.title = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 1.82), new THREE.MeshStandardMaterial({ map: tt, transparent: true, alphaTest: 0.4, metalness: 0.5, roughness: 0.3, envMap: env, emissive: 10515496, emissiveIntensity: 0.9, emissiveMap: tt }));
  W.title.position.set(0, 7.7, 7.17);
  box.add(W.title);
  const deskTop = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), new THREE.MeshStandardMaterial({ map: woodTex(77, 5, 2.5), roughness: 0.65 }));
  deskTop.rotation.x = -Math.PI / 2;
  deskTop.position.set(0, -0.34, 10);
  deskTop.receiveShadow = true;
  scene.add(deskTop);
  W.deskTop = deskTop;
  W.deskProps = group();
  const twineTex = tex(twineCanvas());
  const coilTex = twineTex.clone();
  coilTex.repeat.set(10, 1);
  coilTex.needsUpdate = true;
  const mCoil = new THREE.MeshStandardMaterial({ map: coilTex, roughness: 0.9 });
  add(W.deskProps, new THREE.TorusGeometry(0.75, 0.16, 16, 60), mCoil, 9.4, -0.18, 9.4).rotation.x = Math.PI / 2;
  add(W.deskProps, new THREE.TorusGeometry(0.6, 0.15, 16, 60), mCoil, 9.45, 0.1, 9.35).rotation.x = Math.PI / 2;
  const pencil = group(W.deskProps);
  add(pencil, new THREE.CylinderGeometry(0.16, 0.16, 5.2, 6), new THREE.MeshStandardMaterial({ color: 13869626, roughness: 0.5 }));
  add(pencil, new THREE.ConeGeometry(0.16, 0.55, 6), new THREE.MeshStandardMaterial({ color: 15190432, roughness: 0.8 }), 0, 2.875, 0);
  pencil.rotation.set(Math.PI / 2, 0, 1.1);
  pencil.position.set(-9.4, -0.18, 10.4);
  W.track = group(box);
  {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 11.4, 16), brass);
    t.rotation.z = Math.PI / 2;
    t.position.set(0, TRACK.y, TRACK.z);
    t.castShadow = true;
    W.track.add(t);
    for (const x of [-4.8, 0, 4.8]) string(W.track, [x, TRACK.y, TRACK.z], [x, TOP, TRACK.z]);
  }
  W.fix = group(box);
  {
    const f = W.fix;
    add(f, new THREE.BoxGeometry(0.46, 0.1, 0.22), brass, 0, 0, 0);
    add(f, new THREE.TorusGeometry(0.07, 0.02, 8, 20), brass, -0.14, 0.06, 0);
    add(f, new THREE.TorusGeometry(0.07, 0.02, 8, 20), brass, 0.14, 0.06, 0);
    add(f, new THREE.CylinderGeometry(0.03, 0.03, 0.34, 10), brass, 0, -0.2, 0);
    const yoke = group(f);
    yoke.position.y = -0.44;
    W.yoke = yoke;
    const head = group(yoke);
    W.head = head;
    const mBody = new THREE.MeshStandardMaterial({ color: 2762274, metalness: 0.4, roughness: 0.55, envMap: env });
    const b = add(head, new THREE.CylinderGeometry(0.27, 0.27, 0.62, 40, 1, false), mBody, 0, 0, -0.1);
    b.rotation.x = Math.PI / 2;
    const c = add(head, new THREE.CylinderGeometry(0.31, 0.29, 0.12, 40, 1, true), brass, 0, 0, 0.24);
    c.rotation.x = Math.PI / 2;
    const lensMat = new THREE.MeshStandardMaterial({ color: 16770748, emissive: 16758362, emissiveIntensity: 7, roughness: 0.25 });
    const l = new THREE.Mesh(new THREE.CircleGeometry(0.27, 40), lensMat);
    l.position.z = 0.24;
    head.add(l);
    W.lens = lensMat;
    const back = add(head, new THREE.CylinderGeometry(0.2, 0.27, 0.16, 40), brass, 0, 0, -0.48);
    back.rotation.x = Math.PI / 2;
  }
  W.spot = new THREE.SpotLight(16764820, 300, 0, 0.3, 0.55, 2);
  W.spot.castShadow = true;
  W.spot.shadow.mapSize.set(2048, 2048);
  W.spot.shadow.camera.near = 0.3;
  W.spot.shadow.camera.far = 40;
  W.spot.shadow.bias = -8e-4;
  W.spot.shadow.normalBias = 0.02;
  W.spot.shadow.radius = 4;
  scene.add(W.spot, W.spot.target);
  W.amber = new THREE.SpotLight(16751164, 0, 0, 0.34, 0.5, 2);
  W.amber.castShadow = true;
  W.amber.shadow.mapSize.set(2048, 2048);
  W.amber.shadow.camera.near = 0.2;
  W.amber.shadow.camera.far = 30;
  W.amber.shadow.bias = -8e-4;
  W.amber.shadow.normalBias = 0.02;
  W.amber.shadow.radius = 3;
  scene.add(W.amber, W.amber.target);
  W.glow = new THREE.PointLight(16751164, 0, 0, 2);
  W.glow.castShadow = true;
  W.glow.shadow.mapSize.set(1024, 1024);
  W.glow.shadow.bias = -15e-4;
  W.glow.shadow.normalBias = 0.02;
  W.glow.shadow.radius = 5;
  scene.add(W.glow);
  W.tvGlow = new THREE.PointLight(10470655, 0, 0, 2);
  scene.add(W.tvGlow);
  W.extra = [0, 1, 2].map(() => {
    const s = new THREE.SpotLight(16765600, 0, 0, 0.32, 0.7, 2);
    scene.add(s, s.target);
    return s;
  });
  W.hemi = new THREE.HemisphereLight(16769725, 4862752, 0.3);
  scene.add(W.hemi);
  W.fill = new THREE.DirectionalLight(13621503, 0.14);
  W.fill.position.set(-6, 10, 18);
  scene.add(W.fill);
  W.room = new THREE.DirectionalLight(16762512, 0);
  W.room.position.set(14, 22, 20);
  W.room.castShadow = true;
  W.room.shadow.mapSize.set(2048, 2048);
  Object.assign(W.room.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
  W.room.shadow.bias = -8e-4;
  scene.add(W.room);
  const beamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { c: { value: new THREE.Color(16765594) }, k: { value: 0.1 } },
    vertexShader: "varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }",
    fragmentShader: "uniform vec3 c; uniform float k; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float e = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); float a = pow(vY, 1.5)*e*k; gl_FragColor = vec4(c*a, a); }"
  });
  W.beamMat = beamMat;
  W.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 1, 1, 72, 1, true), beamMat);
  W.beam.visible = false;
  W.beam.renderOrder = 5;
  scene.add(W.beam);
  W.leakMat = beamMat.clone();
  W.leakMat.uniforms.c.value = new THREE.Color(16751164);
  W.leakMat.uniforms.k.value = 0.55;
  W.leak = new THREE.Mesh(W.beam.geometry, W.leakMat);
  W.leak.visible = false;
  W.leak.renderOrder = 6;
  scene.add(W.leak);
  const up = new THREE.Vector3(0, 1, 0), v0 = new THREE.Vector3(), v1 = new THREE.Vector3();
  W.setBeam = (mesh, from, to, angle, flat = 1) => {
    v0.copy(to).sub(from);
    const h = v0.length(), R = Math.tan(angle) * h;
    mesh.position.copy(from).addScaledVector(v0, 0.5);
    mesh.scale.set(R, h, R * flat);
    mesh.quaternion.setFromUnitVectors(up, v0.normalize().negate());
    mesh.visible = true;
  };
  const ropeTex = twineTex.clone();
  ropeTex.repeat.set(2, 1);
  ropeTex.needsUpdate = true;
  W.mRope = new THREE.MeshStandardMaterial({ map: ropeTex, roughness: 0.9 });
  const SUB = 7, SEGS = 9 * SUB, segGeo = new THREE.CylinderGeometry(0.034, 0.034, 1, 8);
  W.rope = group(box);
  const segs = Array.from({ length: SEGS }, () => {
    const m = new THREE.Mesh(segGeo, W.mRope);
    m.castShadow = true;
    W.rope.add(m);
    return m;
  });
  const herm = (a, b, c, d, u) => {
    const t0 = 0.15 * (c - a), t1 = 0.15 * (d - b), u2 = u * u, u3 = u2 * u;
    return b + t0 * u + (-3 * b + 3 * c - 2 * t0 - t1) * u2 + (2 * b - 2 * c + t0 + t1) * u3;
  };
  W.setRope = (pts) => {
    const n = pts.length, P = (i) => pts[Math.max(0, Math.min(n - 1, i))];
    let k = 0, px = pts[0][0], py = pts[0][1], pz = pts[0][2];
    for (let i = 0; i < n - 1; i++) for (let s = 1; s <= SUB && k < SEGS; s++) {
      const u = s / SUB, a = P(i - 1), b = P(i), c = P(i + 1), d = P(i + 2), x = herm(a[0], b[0], c[0], d[0], u), y = herm(a[1], b[1], c[1], d[1], u), z = herm(a[2], b[2], c[2], d[2], u), m = segs[k++];
      v0.set(x - px, y - py, z - pz);
      const L = v0.length() || 1e-4;
      m.position.set((x + px) / 2, (y + py) / 2, (z + pz) / 2);
      m.scale.set(1, L * 1.04, 1);
      v1.copy(v0).divideScalar(L);
      m.quaternion.setFromUnitVectors(up, v1);
      m.visible = true;
      px = x;
      py = y;
      pz = z;
    }
    for (; k < SEGS; k++) segs[k].visible = false;
  };
  W.pulley = group(box);
  {
    const wh = add(W.pulley, new THREE.CylinderGeometry(0.2, 0.2, 0.07, 32), brass);
    wh.rotation.x = Math.PI / 2;
    add(W.pulley, new THREE.BoxGeometry(0.05, 0.34, 0.12), mWood, 0, 0.16, 0);
  }
  W.pulley.position.set(-4.3, TRACK.y - 0.26, TRACK.z);
  W.set = group(box);
  const desk = group(W.set);
  W.desk = desk;
  desk.position.set(0, 0, 4.2);
  add(desk, new THREE.BoxGeometry(3.9, 0.1, 1.5), mKraft, 0, 1.28, 0);
  add(desk, new THREE.BoxGeometry(3.7, 1.24, 0.05), mCard, 0, 0.62, 0.66);
  for (const [x, z] of [[-1.8, -0.6], [1.8, -0.6]]) add(desk, new THREE.BoxGeometry(0.1, 1.24, 0.1), mKraft, x, 0.62, z);
  const rep = group(desk);
  rep.position.set(0.95, 1.33, 0.1);
  rep.rotation.x = -0.62;
  W.report = rep;
  const repTex = label(760, 980, (g, w, h) => {
    g.drawImage(paperCanvas(16051420, { seed: 61 }), 0, 0, w, h);
    g.fillStyle = "#2C2824";
    g.textAlign = "center";
    g.font = `700 112px "${SERIF}"`;
    g.fillText("\u5831\u544A", w / 2, 170);
    g.fillStyle = "rgba(44,40,36,.5)";
    for (let i = 0; i < 9; i++) {
      const lw = 500 + i * 73 % 110;
      g.fillRect((w - lw) / 2, 260 + i * 66, lw, 16);
    }
  });
  const sheet = add(rep, new THREE.BoxGeometry(0.98, 1.26, 0.02), [mCream, mCream, mCream, mCream, new THREE.MeshStandardMaterial({ map: repTex, roughness: 0.9 }), mCream], 0, 0.62, 0);
  const tagTex = label(420, 170, (g, w, h) => {
    g.fillStyle = "#B0342A";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#F7EBD8";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `700 92px "${SERIF}"`;
    g.fillText("\u660E\u5929\u4EA4", w / 2, h / 2 + 6);
  });
  const tag = add(rep, new THREE.PlaneGeometry(0.62, 0.25), new THREE.MeshStandardMaterial({ map: tagTex, roughness: 0.9, side: THREE.DoubleSide }), 0.3, 0.2, 0.03);
  tag.rotation.z = -0.1;
  W.reportAnchor = new THREE.Vector3(0, 0.62, 0.02);
  const win = group(W.set);
  win.position.set(3.75, 4.25, 0.05);
  W.win = win;
  const fr = new THREE.Shape();
  fr.moveTo(-1.42, -1.42);
  fr.lineTo(1.42, -1.42);
  fr.lineTo(1.42, 1.42);
  fr.lineTo(-1.42, 1.42);
  fr.closePath();
  fr.holes.push(rectPath(-1.2, -1.2, 1.2, 1.2));
  const frame = add(win, ext(fr, 0.1), mKraft, 0, 0, 0.06);
  add(win, new THREE.BoxGeometry(0.07, 2.4, 0.05), mKraft, 0, 0, 0.1);
  add(win, new THREE.BoxGeometry(2.4, 0.07, 0.05), mKraft, 0, 0, 0.1);
  W.skyNight = paper(2503239, 41, { dark: true });
  W.skyDawn = paper(15311452, 42);
  W.skyDawn.transparent = true;
  W.sky = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), W.skyNight);
  W.sky.position.z = 0.01;
  W.sky.receiveShadow = true;
  win.add(W.sky);
  W.skyD = new THREE.Mesh(W.sky.geometry, W.skyDawn);
  W.skyD.position.z = 0.02;
  win.add(W.skyD);
  W.sun = add(win, new THREE.CircleGeometry(0.42, 48), new THREE.MeshStandardMaterial({ color: 16172635, emissive: 15112748, emissiveIntensity: 0.7, roughness: 0.8 }), 0.3, -0.45, 0.04);
  W.moon = add(win, new THREE.CircleGeometry(0.3, 48), new THREE.MeshStandardMaterial({ color: 15919574, emissive: 13616296, emissiveIntensity: 0.4, roughness: 0.8 }), -0.45, 0.5, 0.04);
  const hill = new THREE.Shape();
  hill.moveTo(-1.2, -1.2);
  hill.lineTo(1.2, -1.2);
  hill.lineTo(1.2, -0.72);
  hill.quadraticCurveTo(0.6, -0.38, 0.05, -0.8);
  hill.quadraticCurveTo(-0.6, -0.5, -1.2, -0.9);
  hill.closePath();
  add(win, ext(hill, 0.012), mDarkCard, 0, 0, 0.05);
  const tv = group(W.set);
  tv.position.set(-3.75, 0, 2.5);
  tv.rotation.y = 0.32;
  W.tv = tv;
  add(tv, new THREE.BoxGeometry(2.2, 1, 0.9), mKraft, 0, 0.5, 0);
  add(tv, new THREE.BoxGeometry(2.3, 1.6, 0.22), mDarkCard, 0, 1.86, 0);
  const tvTex = label(960, 640, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#2A4A78");
    gr.addColorStop(1, "#D98A5A");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#F4E3B5";
    g.beginPath();
    g.arc(700, 190, 70, 0, 7);
    g.fill();
    g.fillStyle = "#1E2A3A";
    g.beginPath();
    g.moveTo(0, h);
    g.lineTo(0, 470);
    g.quadraticCurveTo(300, 360, 560, 480);
    g.quadraticCurveTo(760, 420, w, 500);
    g.lineTo(w, h);
    g.fill();
    g.fillStyle = "#111A26";
    g.beginPath();
    g.arc(320, 400, 44, 0, 7);
    g.fill();
    g.fillRect(278, 438, 84, 150);
    g.beginPath();
    g.arc(500, 412, 40, 0, 7);
    g.fill();
    g.fillRect(462, 448, 76, 140);
    g.fillStyle = "rgba(255,255,255,.92)";
    g.textAlign = "center";
    g.font = `500 44px "${SANS}"`;
    g.fillText("\u4E0B\u4E00\u96C6\u30005 \u79D2\u5F8C\u64AD\u653E", w / 2, 608);
  });
  W.tvMat = new THREE.MeshStandardMaterial({ map: tvTex, emissive: 16777215, emissiveMap: tvTex, emissiveIntensity: 1, roughness: 0.55 });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.04, 1.34), W.tvMat);
  scr.position.set(0, 1.86, 0.118);
  tv.add(scr);
  const torso = new THREE.Shape();
  torso.moveTo(-0.42, 0.55);
  torso.lineTo(0.42, 0.55);
  torso.quadraticCurveTo(0.5, 1.5, 0.34, 1.72);
  torso.quadraticCurveTo(0, 1.84, -0.34, 1.72);
  torso.quadraticCurveTo(-0.5, 1.5, -0.42, 0.55);
  const headShape = new THREE.Shape();
  headShape.absarc(0, 2.18, 0.32, 0, Math.PI * 2);
  const torsoGeo = ext(torso, 0.03), headGeo = ext(headShape, 0.03);
  const limbTex = paper(COL.card, 220);
  const inkDot = new THREE.MeshStandardMaterial({ color: 2367259, roughness: 0.6 });
  W.mkPuppet = (tone, seed, s = 1, parent = W.set) => {
    const mBody = paper(tone, seed), g = group(parent), body = group(g);
    body.add(new THREE.Mesh(torsoGeo, mBody), new THREE.Mesh(headGeo, mBody));
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.02), mBody);
    neck.position.set(0, 1.82, 0.015);
    body.add(neck);
    const legs = [-1, 1].map((sx) => {
      const pivot = group(body);
      pivot.position.set(sx * 0.17, 0.62, 0.03);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.03), limbTex);
      leg.position.y = -0.31;
      pivot.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.05), mDarkCard);
      foot.position.set(sx * 0.05, -0.62, 0.01);
      pivot.add(foot);
      return pivot;
    });
    const arms = [0.36, -0.36].map((ax, k) => {
      const arm = group(body);
      arm.position.set(ax, 1.62, 0.045 - k * 0.03);
      const am = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.8, 0.02), limbTex);
      am.position.y = -0.38;
      arm.add(am);
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16), brass);
      pin.rotation.x = Math.PI / 2;
      pin.position.set(ax, 1.62, 0.06 - k * 0.03);
      body.add(pin);
      return arm;
    });
    const eyes = [-0.1, 0.1].map((x) => {
      const e = new THREE.Mesh(new THREE.CircleGeometry(0.034, 20), inkDot);
      e.position.set(x, 2.22, 0.034);
      body.add(e);
      return e;
    });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8), mWood);
    rod.position.set(0, 0.1, -0.04);
    g.add(rod);
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.36), mWood);
    block.position.set(0, 0.04, -0.04);
    g.add(block);
    g.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    g.scale.setScalar(s);
    return { g, body, arms, legs, eyes, rod, block, look(dx, dy = 0) {
      eyes[0].position.set(-0.1 + dx, 2.22 + dy, 0.034);
      eyes[1].position.set(0.1 + dx, 2.22 + dy, 0.034);
    }, hand(i = 1) {
      const v = new THREE.Vector3(0, -0.76, 0.02);
      arms[i].updateWorldMatrix(true, false);
      return arms[i].localToWorld(v);
    } };
  };
  W.me = W.mkPuppet(COL.cream, 200, 1.36);
  W.helper = W.mkPuppet(14271136, 203, 1.3);
  W.others = [15127475, 15719616, 14863784].map((c, i) => W.mkPuppet(c, 204 + i, 1));
  W.kid = W.mkPuppet(15918802, 208, 1);
  W.labels = group(box);
  const sign = (txt, x, y, z, w, ry, seed, blank) => {
    const g = group(W.labels), h = w * 0.52, t = label(1024, Math.round(1024 * 0.52), (c, cw, ch) => {
      c.drawImage(paperCanvas(13081187, { seed }), 0, 0, cw, ch);
      c.strokeStyle = "rgba(44,30,20,.5)";
      c.lineWidth = 8;
      c.strokeRect(24, 24, cw - 48, ch - 48);
      if (txt) {
        c.fillStyle = "#231C16";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.font = `700 ${txt.length > 1 ? 240 : 330}px "${SERIF}"`;
        c.fillText(txt, cw / 2, ch / 2 + 14);
      }
    });
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), bk = mCard, face = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), [bk, bk, bk, bk, m, blank ? mCream : m]);
    face.castShadow = face.receiveShadow = true;
    g.add(face);
    g.position.set(x, y, z);
    g.rotation.set(0.04, ry, (seed % 5 - 2) * 0.025);
    for (const sx of [-1, 1]) string(g, [sx * w * 0.36, h / 2, 0], [sx * w * 0.36, TOP - y, 0]);
    return g;
  };
  sign("\u61F6", -1.7, 4.55, 3.2, 2.3, 0.16, 71);
  sign("\u4E0D\u52AA\u529B", 1.05, 5.1, 3.8, 2.7, -0.12, 72);
  sign("\u4E0D\u5C08\u5FC3", 3.1, 3.5, 2.4, 2.2, -0.3, 73);
  W.flip = sign("\u6C92\u7528\u5FC3", -3.5, 3.3, 2.6, 2, 3.32, 74, true);
  W.signs = W.labels.children.map((g) => ({ g, y: g.position.y, ry: g.rotation.y, rz: g.rotation.z }));
  W.tapes = group(box);
  {
    const r = rng(319), mats = [0, 1, 2, 3, 4, 5].map((i) => {
      const t = tex(tapeCanvas(tapePositions(30 + i, 0.5, i % 2 ? 0.22 : 0.04, 60), { w: 1024, h: 56, seed: 12 + i, base: [15853523, 15128766, 15391940][i % 3] }));
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      return new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, roughness: 0.9, side: THREE.DoubleSide });
    });
    for (let i = 0; i < 319; i++) {
      const col = i % 53, row = Math.floor(i / 53), L = 2.2 + r() * 3.3, x = -5.6 + col * 0.215 + (r() - 0.5) * 0.05, g = group(W.tapes), m = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.13), mats[i % 6]);
      m.rotation.z = -Math.PI / 2;
      m.position.y = -L / 2;
      m.castShadow = true;
      g.add(m);
      g.position.set(x, 7.3 - row * 0.04, 0.28 + row * 0.22 + r() * 0.1);
      g.rotation.z = (r() - 0.5) * 0.025;
      g.rotation.y = (r() - 0.5) * 0.3;
    }
    W.tapeRows = W.tapes.children.map((g, i) => ({ g, y: g.position.y, d: i * 37 % 53 / 53 }));
  }
  W.heroTapes = group(box);
  const heroTape = (seed, noise, slow, y, z) => {
    const t = tex(tapeCanvas(tapePositions(seed, noise, slow, 90), { w: 4096, h: 192, seed: seed + 3 }));
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(11, 0.52, 80, 1), new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, roughness: 0.85, side: THREE.DoubleSide }));
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setZ(i, Math.sin(x * 0.6 + seed) * 0.06);
    }
    m.geometry.computeVertexNormals();
    m.position.set(0, y, z);
    m.rotation.z = (seed % 2 ? 1 : -1) * 0.012;
    m.castShadow = true;
    m.receiveShadow = true;
    W.heroTapes.add(m);
    return m;
  };
  W.tapeA = heroTape(11, 0.42, 0, 3.72, 5.15);
  W.tapeB = heroTape(14, 0.62, 0.17, 2.72, 5.15);
  for (const [x, y] of [[-5.2, 3.72], [5.2, 3.72], [-5.2, 2.72], [5.2, 2.72]]) string(W.heroTapes, [x, y, 5.15], [x, TOP, 5.15]);
  W.back = group(box);
  const notes = ["\u665A\u9910\u5403\u4EC0\u9EBC", "\u90A3\u9996\u6B4C\u53EB\u4EC0\u9EBC", "\u5FD8\u4E86\u56DE\u8A0A\u606F", "\u660E\u5929\u6703\u4E0B\u96E8\u55CE", "\u90A3\u53E5\u8A71\u4EC0\u9EBC\u610F\u601D", "\u9470\u5319\u653E\u54EA\u4E86", "\u8981\u8CB7\u7259\u818F", "\u5982\u679C\u7576\u521D", "\u8C93\u5728\u60F3\u4EC0\u9EBC", "\u4E0B\u9031\u7684\u65C5\u884C"];
  {
    const r = rng(55);
    notes.forEach((n, i) => {
      const g = group(W.back), w = 0.62, h = 0.28 + n.length * 0.36, t = label(300, Math.round(300 * h / w), (c, cw, ch) => {
        c.drawImage(paperCanvas(15785912, { seed: 80 + i }), 0, 0, cw, ch);
        const step2 = (ch - 50) / n.length;
        c.fillStyle = "#2C2824";
        c.font = `700 ${Math.min(170, Math.round(step2 * 0.9))}px "${SERIF}"`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        [...n].forEach((ch2, k) => c.fillText(ch2, cw / 2, 40 + step2 * (k + 0.5)));
      });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      const row = i < 5 ? 0 : 1, x = -4.8 + i % 5 * 2.3 + (row ? 1.15 : 0) + (r() - 0.5) * 0.3, y = (row ? 3.15 : 5.15) + (r() - 0.5) * 0.5, z = row ? 1.55 : 0.75;
      g.position.set(x, y, z);
      g.rotation.set(0, (r() - 0.5) * 0.6, (r() - 0.5) * 0.1);
      string(g, [0, h / 2, 0], [0, TOP - y, 0]);
    });
  }
  W.dimmer = group(box);
  {
    const d = W.dimmer, plate = add(d, new THREE.BoxGeometry(0.72, 3.1, 0.08), mDarkCard, 0, 1.75, 0);
    add(d, new THREE.BoxGeometry(1.1, 0.1, 0.6), mWood, 0, 0.05, 0);
    add(d, new THREE.BoxGeometry(0.16, 0.3, 0.16), mWood, 0, 0.15, -0.1);
    const faceT = label(360, 1550, (g, w, h) => {
      g.drawImage(paperCanvas(3682603, { seed: 58, dark: true }), 0, 0, w, h);
      g.strokeStyle = "#D9B765";
      g.fillStyle = "#E8CF8F";
      g.lineWidth = 7;
      for (let i = 0; i <= 10; i++) {
        const y = 150 + i * 125;
        g.beginPath();
        g.moveTo(i % 5 ? 240 : 214, y);
        g.lineTo(320, y);
        g.stroke();
      }
      g.textAlign = "left";
      g.textBaseline = "middle";
      g.font = `700 76px "${SERIF}"`;
      g.fillText("\u4EAE", 34, 150);
      g.fillText("\u6697", 34, 1400);
      g.fillStyle = "#16120F";
      g.fillRect(128, 120, 24, 1310);
    });
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 3.1), new THREE.MeshStandardMaterial({ map: faceT, roughness: 0.75 }));
    fp.position.set(0, 1.75, 0.045);
    d.add(fp);
    W.fader = add(d, new THREE.BoxGeometry(0.4, 0.17, 0.2), brass, -0.06, 1.2, 0.14);
    add(W.fader, new THREE.BoxGeometry(0.06, 0.17, 0.22), inkDot, 0, 0, 0);
  }
  W.part = group(box);
  {
    const m = paper(3879981, 91, { dark: true, repeat: 2 });
    W.partLow = add(W.part, new THREE.BoxGeometry(12, 1.7, 0.24), mKraft, 0, 0.85, 3.2);
    W.partHigh = add(W.part, new THREE.BoxGeometry(12, 5.66, 0.24), mKraft, 0, 4.77, 3.2);
  }
  W.curtains = group(box);
  {
    const mR = paper(7023138, 92, { dark: true }), geo = new THREE.PlaneGeometry(4.2, 7.5, 120, 1), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setZ(i, Math.sin(x * 5.5) * 0.17 + Math.sin(x * 2.2) * 0.08);
    }
    geo.computeVertexNormals();
    for (const sx of [-1, 1]) {
      const c = add(W.curtains, geo, mR, sx * 4.4, 3.75, 5.1);
      c.scale.x = 1;
    }
  }
  W.rail = group(box);
  {
    for (const x of [-0.34, 0.34]) add(W.rail, new THREE.BoxGeometry(0.05, 0.05, 6.7), brass, x, 0.05, 3.5);
    for (let z = 0.4; z < 6.8; z += 0.42) add(W.rail, new THREE.BoxGeometry(0.9, 0.04, 0.12), mWood, 0, 0.02, z);
    const flag = (txt, z, sx) => {
      const g = group(W.rail);
      g.position.set(sx * 0.74, 0, z);
      add(g, new THREE.CylinderGeometry(0.015, 0.015, 1.05, 8), mWood, 0, 0.52, 0);
      const t = label(420, 160, (c, w, h) => {
        c.drawImage(paperCanvas(15721679, { seed: 15 }), 0, 0, w, h);
        c.fillStyle = "#2C2824";
        c.font = `700 92px "${SERIF}"`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(txt, w / 2, h / 2 + 6);
      });
      const f = add(g, new THREE.BoxGeometry(0.72, 0.28, 0.012), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), sx * 0.37, 0.9, 0);
    };
    flag("\u73FE\u5728", 4.5, -1);
    flag("\u4E0B\u9031", 2.75, 1);
    flag("\u4E0B\u500B\u6708", 0.9, -1);
    W.rail.children.at(-2).position.x = 1.75;
  }
  {
    const pts = [[0, 0], [0.42, 0], [0.42, 0.05], [0.13, 0.1], [0.08, 0.32], [0.08, 0.46], [0.26, 0.58], [0.46, 1], [0.5, 1.4], [0.46, 1.42], [0, 1.2]].map((p) => new THREE.Vector2(...p));
    const g = group(box);
    W.trophy = g;
    const m = add(g, new THREE.LatheGeometry(pts, 48), mGold);
    const h = new THREE.TorusGeometry(0.24, 0.03, 10, 30, Math.PI);
    for (const sx of [-1, 1]) {
      const a = add(g, h, mGold, sx * 0.46, 1.12, 0);
      a.rotation.z = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    const bk = add(g, new THREE.BoxGeometry(0.6, 0.1, 0.6), mWood, 0, -0.04, 0);
  }
  {
    const g = group(box);
    W.candy = g;
    const m = new THREE.MeshStandardMaterial({ color: 11547690, roughness: 0.35, metalness: 0.05 });
    const b = add(g, new THREE.SphereGeometry(0.2, 32, 22), m);
    b.scale.set(1.25, 0.85, 0.85);
    const tri = new THREE.Shape();
    tri.moveTo(0, 0);
    tri.lineTo(0.28, 0.13);
    tri.lineTo(0.22, 0);
    tri.lineTo(0.28, -0.13);
    tri.closePath();
    for (const sx of [-1, 1]) {
      const w = add(g, ext(tri, 0.012), paper(15320934, 19), sx * 0.22, 0, 0);
      if (sx < 0) w.rotation.y = Math.PI;
    }
  }
  W.pin = group(box);
  W.pin.scale.setScalar(1.5);
  {
    const p = add(W.pin, new THREE.CylinderGeometry(0.05, 0.05, 0.72, 16), brass);
    const k = add(W.pin, new THREE.SphereGeometry(0.09, 16, 12), brass, 0, 0.38, 0);
    const d = add(W.pin, new THREE.BoxGeometry(0.22, 0.1, 0.22), brass, 0, -0.1, 0);
  }
  W.cups = group(W.set);
  const cupGeo = new THREE.CylinderGeometry(0.13, 0.1, 0.3, 24, 1, true), cupIn = new THREE.CircleGeometry(0.125, 24), mCoffee = new THREE.MeshStandardMaterial({ color: 3810325, roughness: 0.3 });
  [[-1.55, -0.2], [-1.25, 0.25], [-1.75, 0.2], [-1.35, -0.32], [-0.98, -0.05], [-1.62, -0.46]].forEach(([x, z], i) => {
    const g = group(W.cups);
    add(g, cupGeo, mCream, 0, 0.15, 0);
    const c = new THREE.Mesh(cupIn, mCoffee);
    c.rotation.x = -Math.PI / 2;
    c.position.y = 0.27;
    g.add(c);
    g.position.set(x, 1.33, 4.2 + z);
  });
  W.tower = group(W.set);
  {
    const r = rng(17);
    for (let i = 0; i < 8; i++) {
      const s = 0.62 - i * 0.045, b = add(W.tower, new THREE.BoxGeometry(s, 0.26, s), i % 2 ? mCard : mCream, (r() - 0.5) * 0.05, 0.13 + i * 0.26, 0);
      b.rotation.y = i * 0.42;
    }
    const fl = add(W.tower, new THREE.ConeGeometry(0.16, 0.34, 4), paper(11547690, 23), 0, 2.27, 0);
    W.tower.position.set(-0.35, 1.33, 4.25);
  }
  W.nine = group(box);
  W.stool = group(W.nine);
  add(W.stool, new THREE.BoxGeometry(1, 0.08, 0.7), mWood, 0, 1.5, 0);
  for (const sx of [-1, 1]) add(W.stool, new THREE.BoxGeometry(0.08, 1.5, 0.08), mWood, sx * 0.42, 0.75, 0);
  W.clip = group(W.nine);
  {
    add(W.clip, new THREE.BoxGeometry(1.1, 0.12, 0.08), mWood, 0, 0.12, 0);
    add(W.clip, new THREE.BoxGeometry(1.1, 0.12, 0.08), mWood, 0, -0.12, 0.02).rotation.z = 0.3;
    add(W.clip, new THREE.TorusGeometry(0.08, 0.02, 8, 20), brass, -0.3, 0, 0.06);
  }
  const digits = "7392048165";
  W.strips = [...digits].map((d, i) => {
    const g = group(W.nine), t = label(240, 360, (c, w, h) => {
      c.drawImage(paperCanvas(15853523, { seed: 100 + i }), 0, 0, w, h);
      c.strokeStyle = "rgba(44,40,36,.45)";
      c.lineWidth = 6;
      c.strokeRect(10, 10, w - 20, h - 20);
      c.fillStyle = "#2C2824";
      c.font = `700 230px "${SERIF}"`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(d, w / 2, h / 2 + 8);
    });
    const m = add(g, new THREE.BoxGeometry(0.66, 1, 0.015), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
    const str = new THREE.Mesh(strGeo, threadMat);
    str.castShadow = true;
    g.add(str);
    return { g, m, str };
  });
  W.poseStrip = (st, h, f, k, thread = false) => {
    const e = k * k;
    st.g.position.set(h.x + (f.x - h.x) * k, h.y + (f.y - h.y) * e, h.z + (f.z - h.z) * k);
    st.g.rotation.set((-Math.PI / 2 + 0.02) * k, h.ry * (1 - k), f.rz * k);
    st.str.visible = k === 0 || thread;
    if (st.str.visible) {
      const L = TOP - st.g.position.y - 0.5;
      st.str.position.set(0, 0.5 + L / 2, 0);
      st.str.scale.y = L;
    }
  };
  W.under = group();
  W.under.position.y = -24;
  {
    const u = W.under, mW = paper(4864814, 121, { dark: true, repeat: 2 }), mF = paper(3812901, 122, { dark: true, repeat: 2 });
    const bw = new THREE.Mesh(new THREE.PlaneGeometry(26, 12), mW);
    bw.position.set(0, 6, -2);
    bw.receiveShadow = true;
    u.add(bw);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(26, 14), mF);
    fl.rotation.x = -Math.PI / 2;
    fl.position.set(0, 0, 4);
    fl.receiveShadow = true;
    u.add(fl);
    const ceil = new THREE.Shape();
    ceil.moveTo(-13, -7);
    ceil.lineTo(13, -7);
    ceil.lineTo(13, 7);
    ceil.lineTo(-13, 7);
    ceil.closePath();
    ceil.holes.push(rectPath(-1.5, -1.3, 1.5, 1.3));
    const c = new THREE.Mesh(ext(ceil, 0.3), mKraft);
    c.rotation.x = -Math.PI / 2;
    c.position.set(0, 9.2, 2);
    c.castShadow = c.receiveShadow = true;
    u.add(c);
    for (const x of [-9, -3.4, 3.4, 9]) add(u, new THREE.BoxGeometry(0.4, 9.2, 0.4), mWood, x, 4.6, 5.4);
    add(u, new THREE.BoxGeometry(26, 0.36, 0.4), mWood, 0, 8.9, 5.4);
    W.shaft = add(u, new THREE.BoxGeometry(0.01, 0.01, 0.01), mWood, 0, 0, 0);
    const station = (txt, x) => {
      const t2 = label(620, 240, (g, w, h) => {
        g.drawImage(paperCanvas(15721679, { seed: 31 + x }), 0, 0, w, h);
        g.strokeStyle = "rgba(44,30,20,.5)";
        g.lineWidth = 6;
        g.strokeRect(14, 14, w - 28, h - 28);
        g.fillStyle = "#231C16";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.font = `700 150px "${SERIF}"`;
        g.fillText(txt, w / 2, h / 2 + 8);
      });
      return add(u, new THREE.BoxGeometry(2.6, 1, 0.03), new THREE.MeshStandardMaterial({ map: t2, roughness: 0.9 }), x, 1, 3.6);
    };
    station("\u57FA\u56E0", -6.6);
    station("\u74B0\u5883", 0);
    station("\u5927\u8166\u767C\u5C55", 6.6);
    const spool = (x, y, z, col) => {
      const g = group(u);
      g.position.set(x, y, z);
      const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 });
      const b = add(g, new THREE.CylinderGeometry(0.24, 0.24, 0.5, 24), m);
      for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.3, 0.3, 0.05, 24), mWood, 0, s * 0.26, 0);
      return g;
    };
    const cols = [11547690, 13608270, 4156267, 15327958, 8146474, 3428462];
    const r = rng(7);
    W.threadLines = [];
    for (let i = 0; i < 18; i++) {
      const col = i % 6, row = Math.floor(i / 6), x = -8.7 + col * 0.84, y = 1.72 + row * 1.15, z = 1.4 + row % 2 * 0.2;
      spool(x, y, z, cols[i * 5 % 6]);
      const m = new THREE.MeshStandardMaterial({ color: cols[i * 5 % 6], roughness: 0.8 });
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, y + 0.28, z), new THREE.Vector3(x * 0.7 - 1, 6.6 + r(), 2.2), new THREE.Vector3((r() - 0.5) * 0.9 - 0.6, 8.9, 2)]);
      const tb = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.014, 5), m);
      tb.castShadow = true;
      u.add(tb);
    }
    const cut = (shape, col, x, y, z, s = 1, seed = 1) => {
      const m = add(u, ext(shape, 0.04), paper(col, seed), x, y, z);
      m.scale.setScalar(s);
      return m;
    };
    const house = new THREE.Shape();
    house.moveTo(-1, 0);
    house.lineTo(1, 0);
    house.lineTo(1, 1.2);
    house.lineTo(0, 2.1);
    house.lineTo(-1, 1.2);
    house.closePath();
    house.holes.push(rectPath(-0.3, 0.02, 0.3, 0.9));
    cut(house, 14863784, -1, 1.2, 1.2, 1.15, 301);
    const school = new THREE.Shape();
    school.moveTo(-1.2, 0);
    school.lineTo(1.2, 0);
    school.lineTo(1.2, 1.5);
    school.lineTo(0.4, 1.5);
    school.lineTo(0.4, 2.3);
    school.lineTo(-0.4, 2.3);
    school.lineTo(-0.4, 1.5);
    school.lineTo(-1.2, 1.5);
    school.closePath();
    cut(school, 13081187, 1.65, 1.2, 0.8, 1, 302);
    const cloud = new THREE.Shape();
    cloud.absarc(0, 0, 0.6, 0, Math.PI * 2);
    const c2 = new THREE.Shape();
    c2.absarc(0.7, -0.1, 0.45, 0, Math.PI * 2);
    const c32 = new THREE.Shape();
    c32.absarc(-0.7, -0.1, 0.42, 0, Math.PI * 2);
    for (const [s, dx] of [[cloud, 0], [c2, 0], [c32, 0]]) {
      const m = cut(s, 15721679, -2, 5.9, 1.5, 1, 303);
    }
    string(u, [-2, 6.4, 1.52], [-2, 8.9, 1.52]);
    const sunShape = new THREE.Shape();
    sunShape.absarc(0, 0, 0.5, 0, Math.PI * 2);
    cut(sunShape, 15184460, 2.2, 5.6, 1.1, 1, 304);
    string(u, [2.2, 6.1, 1.12], [2.2, 8.9, 1.12]);
    const gear = (R, teeth, col, x, y, z, rot, seed) => {
      const s = new THREE.Shape();
      const n = teeth * 4;
      for (let i = 0; i <= n; i++) {
        const a = i / n * Math.PI * 2, rr = i % 4 === 0 || i % 4 === 1 ? R : R * 0.84;
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        i ? s.lineTo(px, py) : s.moveTo(px, py);
      }
      const h = new THREE.Path();
      h.absarc(0, 0, R * 0.2, 0, Math.PI * 2, true);
      s.holes.push(h);
      const m = add(u, ext(s, 0.08), paper(col, seed), x, y, z);
      m.rotation.z = rot;
      const hub = add(u, new THREE.CylinderGeometry(R * 0.17, R * 0.17, 0.16, 24), brass, x, y, z + 0.06);
      hub.rotation.x = Math.PI / 2;
      return m;
    };
    gear(1.7, 16, 13081187, 5.2, 3, 0.9, 0.1, 311);
    gear(1.1, 11, 14863784, 7.6, 3.5, 1.05, 0.28, 312);
    gear(0.9, 9, 13608270, 5.9, 5.6, 1.15, 0.05, 313);
    gear(1.3, 13, 10123854, 8.9, 5.8, 0.9, 0.2, 314);
    add(u, new THREE.CylinderGeometry(0.05, 0.05, 4, 12), mWood, 4.4, 6.9, 1).rotation.z = 0.7;
    W.fall = group(u);
    const t = label(420, 200, (g, w, h) => {
      g.drawImage(paperCanvas(13081187, { seed: 74 }), 0, 0, w, h);
      g.fillStyle = "#231C16";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `700 92px "${SERIF}"`;
      g.fillText("\u4E0D\u5920\u52AA\u529B", w / 2, h / 2 + 6);
    });
    add(W.fall, new THREE.BoxGeometry(0.84, 0.4, 0.012), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
    W.fall.position.set(0.05, 5, 3);
    W.fall.rotation.set(0.1, 0.2, -0.18);
    W.fall.traverse((m) => {
      if (m.isMesh) m.castShadow = false;
    });
  }
  W.crate = group(box);
  add(W.crate, new THREE.BoxGeometry(2.6, 1, 1.3), mKraft, 0, 0.5, 0);
  add(W.crate, new THREE.BoxGeometry(2.66, 0.06, 1.36), mWood, 0, 0.98, 0);
  W.toolbox = group(box);
  {
    const b = W.toolbox;
    add(b, new THREE.BoxGeometry(2.3, 0.6, 1), mWood, 0, 0.3, 0);
    const lid = add(b, new THREE.BoxGeometry(2.3, 0.06, 1), mWood, 0, 0.98, -0.72);
    lid.rotation.x = -1.15;
    const hd = add(b, new THREE.TorusGeometry(0.3, 0.03, 8, 24, Math.PI), brass, 0, 0.62, 0);
    add(b, new THREE.BoxGeometry(2.12, 0.03, 0.84), mDarkCard, 0, 0.56, 0);
    const tags = [["\u85E5\u7269", -0.74, 0.14], ["\u5FC3\u7406\u6CBB\u7642", 0, -0.06], ["\u74B0\u5883\u8ABF\u6574", 0.74, 0.1]];
    W.tags = tags.map(([txt, x, rz], i) => {
      const g = group(b), t = label(330, 440, (c, w, h) => {
        c.drawImage(paperCanvas(16051420, { seed: 141 + i }), 0, 0, w, h);
        c.strokeStyle = "rgba(44,30,20,.5)";
        c.lineWidth = 6;
        c.strokeRect(12, 12, w - 24, h - 24);
        c.fillStyle = "#231C16";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.font = `700 ${txt.length > 2 ? 84 : 112}px "${SERIF}"`;
        if (txt.length > 2) {
          c.fillText(txt.slice(0, 2), w / 2, h / 2 - 66);
          c.fillText(txt.slice(2), w / 2, h / 2 + 56);
        } else c.fillText(txt, w / 2, h / 2 + 8);
        c.fillStyle = "#2C2824";
        c.beginPath();
        c.arc(w / 2, 36, 12, 0, 7);
        c.fill();
      });
      add(g, new THREE.BoxGeometry(0.62, 0.84, 0.012), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), x, 1.16, 0.05).rotation.set(-0.1, 0, rz);
      return g;
    });
  }
  W.floorPulley = group(W.set);
  {
    const f = W.floorPulley, wh = add(f, new THREE.TorusGeometry(0.17, 0.05, 12, 40), brass, 0, 3, 0);
    const hub = add(f, new THREE.CylinderGeometry(0.05, 0.05, 0.12, 16), mWood, 0, 3, 0);
    hub.rotation.x = Math.PI / 2;
    add(f, new THREE.BoxGeometry(0.08, 3, 0.08), mWood, 0, 1.5, -0.12);
    add(f, new THREE.BoxGeometry(0.7, 0.08, 0.5), mWood, 0, 0.04, -0.12);
  }
  W.board = group(box);
  {
    const b = W.board;
    const bd = add(b, new THREE.BoxGeometry(11, 0.06, 6.4), paper(11043414, 151, { repeat: 2 }), 0, 0.03, 3.5);
    const cards = [["\u5F9E\u5C0F\u5C31\u6709", "12 \u6B72\u524D\u5C31\u51FA\u73FE", -3.55, -0.035], ["\u8DE8\u5834\u5408", "\u4E0D\u53EA\u4E00\u7A2E\u5834\u5408", 0, 0.025], ["\u5F71\u97FF\u751F\u6D3B", "\u59A8\u7919\u65E5\u5E38\u529F\u80FD", 3.55, -0.015]];
    cards.forEach(([a, b2, x, rz], i) => {
      const t = label(760, 900, (g, w, h) => {
        g.drawImage(paperCanvas(16051420, { seed: 161 + i }), 0, 0, w, h);
        g.strokeStyle = "rgba(44,30,20,.35)";
        g.lineWidth = 5;
        g.strokeRect(20, 20, w - 40, h - 40);
        g.fillStyle = "#A86A1C";
        g.textAlign = "center";
        g.font = `500 62px "${SANS}"`;
        g.letterSpacing = "6px";
        g.fillText(`${i + 1} / 3`, w / 2, 170);
        g.letterSpacing = "0px";
        g.fillStyle = "#231C16";
        g.font = `700 134px "${SERIF}"`;
        g.fillText(a, w / 2, 470);
        g.fillStyle = "#4A4036";
        g.font = `500 62px "${SANS}"`;
        g.fillText(b2, w / 2, 660);
      });
      const c = add(b, new THREE.BoxGeometry(3.05, 0.02, 3.62), [mCream, mCream, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), mCream, mCream, mCream], x, 0.08, 3.3);
      c.rotation.y = rz;
      add(b, new THREE.CylinderGeometry(0.09, 0.09, 0.05, 24), brass, x + Math.sin(rz) * -1.66, 0.13, 3.3 - Math.cos(rz) * 1.66);
    });
  }
  W.v = new THREE.Vector3();
  return W;
}
function makePost(T2, renderer, w, h) {
  THREE = T2;
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 2 });
  rt.depthTexture = new THREE.DepthTexture(w, h);
  rt.depthTexture.type = THREE.FloatType;
  const mat = new THREE.ShaderMaterial({
    uniforms: { tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, near: { value: 0.1 }, far: { value: 200 }, focus: { value: 5 }, aperture: { value: 18 }, maxBlur: { value: 22 }, res: { value: new THREE.Vector2(w, h) }, scale: { value: 1 }, seed: { value: 1 }, exposure: { value: 1 }, vig: { value: 0.4 }, grain: { value: 0.045 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }",
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
      }`
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const ps = new THREE.Scene();
  ps.add(quad);
  const pc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    rt,
    mat,
    resize(pw, ph, logicalW) {
      if (rt.width !== pw || rt.height !== ph) {
        rt.setSize(pw, ph);
        mat.uniforms.res.value.set(pw, ph);
      }
      mat.uniforms.scale.value = pw / logicalW;
    },
    render(scene, camera) {
      mat.uniforms.near.value = camera.near;
      mat.uniforms.far.value = camera.far;
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(ps, pc);
    }
  };
}

// scenes/main.ts
var C = { cream: "#F3EBDD", amber: "#E8A84A", gold: "#E4C06C", ink: "#3A2410", muted: "rgba(243,235,221,.74)", dim: "rgba(243,235,221,.55)", bg: "#14110E" };
var T = {
  kicker: { size: 30, family: SANS, weight: 500, color: C.amber, tracking: 10 },
  sub: { size: 44, family: SANS, weight: 500, color: C.cream, tracking: 2, align: "center" },
  note: { size: 30, family: SANS, weight: 500, color: C.cream, tracking: 3 },
  chalk: { size: 32, family: SANS, weight: 500, color: C.gold, tracking: 2 },
  end: { size: 26, family: SANS, weight: 500, color: C.muted, tracking: 3, align: "center" },
  credit: { size: 22, family: SANS, weight: 500, color: C.dim, tracking: 2, align: "right" }
};
var BEATS = beats([
  { title: "S01 \u4EAE\u71C8", end: 7.2, stop: 6, handoff: 1, note: "The lamp snaps on; pull back and tilt down the beam to the puppet and the report." },
  { title: "S02 \u5149\u6ED1\u8D70", end: 13.2, stop: 12.9, handoff: 0.8, note: "The light slides away; the rope cannot bring it back; then it locks on the TV until dawn." },
  { title: "S03 \u6A19\u7C64", end: 17.7, stop: 17.3, handoff: 0.35, note: "Labels drop on the puppet; the last turns round, blank." },
  { title: "S04 \u5FFD\u5FEB\u5FFD\u6162", end: 22.9, stop: 22.2, handoff: 0.6, note: "Two punched tapes, then the wall of 319: long gaps now and then." },
  { title: "S05 \u5F8C\u53F0", end: 28.3, stop: 27.9, handoff: 0.35, note: "Curtain opens on the backstage notes; the dimmer pushes down." },
  { title: "S06 \u6F0F\u5149", end: 35.8, stop: 35.4, handoff: 0.35, note: "Section view: a narrow slit leaks a thin warm light onto the report." },
  { title: "S07 \u9060\u8655\u7684\u734E\u52F5", end: 42.6, stop: 42.2, handoff: 0.35, note: "The trophy shrinks faster than perspective; the dashed outline keeps its size." },
  { title: "S08 \u9396\u71C8", end: 49.5, stop: 49.1, handoff: 0.35, note: "Pin drops, cups pile up, dawn; pull back: others are locked too." },
  { title: "S09 \u5750\u597D", end: 56.9, stop: 56.4, handoff: 0.5, note: "Clamped feet, falling strips; free feet, a few more stay. The light does not move." },
  { title: "S10 \u821E\u53F0\u5E95\u4E0B", end: 62.8, stop: 62.4, handoff: 0.35, note: "Under the stage: genes, environment, brain development; a tiny card falls." },
  { title: "S11 \u5DE5\u5177\u7BB1", end: 69.5, stop: 69.1, handoff: 0.35, note: "Helper, toolbox of labels, pulley: closer, and it still slips." },
  { title: "S12 \u4E09\u5F35\u6E05\u55AE", end: 76.5, stop: 76.1, handoff: 0.35, note: "Three cards turn over and are pinned, one per phrase." },
  { title: "S13 \u7247\u540D", end: 85, stop: 81, note: "Long pull back; title on the proscenium; the light never quite reaches the ring." }
]);
var meta = { width: 1920, height: 1080, duration: BEATS.duration, fps: 30, background: C.bg, shots: BEATS.shots };
var params = {
  motion: { name: "\u52D5\u614B Motion", type: "enum", default: "stop-motion", options: ["stop-motion", "smooth"] }
};
var SUBS = [
  [1.6, 3.26, "\u821E\u53F0\u4E0A\u6709\u4E00\u76DE\u805A\u5149\u71C8\u3002"],
  [3.75, 4.75, "\u5B83\u7167\u5230\u54EA\u88E1\uFF0C"],
  [4.97, 5.94, "\u4F60\u5C31\u770B\u898B\u54EA\u88E1\u3002"],
  [7.44, 8.56, "\u5831\u544A\u660E\u5929\u8981\u4EA4\uFF0C"],
  [8.88, 9.85, "\u71C8\u4E00\u76F4\u6ED1\u8D70\u3002"],
  [10.62, 11.73, "\u5F71\u96C6\u770B\u5230\u5929\u4EAE\uFF0C"],
  [11.91, 12.9, "\u5B83\u537B\u52D5\u4E5F\u4E0D\u52D5\u3002"],
  [13.4, 14.75, "\u5F88\u591A\u4EBA\u8AAA\u9019\u662F\u61F6\u3002"],
  [15.47, 17.43, "\u7814\u7A76\u770B\u5230\u7684\uFF0C\u4E0D\u592A\u4E00\u6A23\u3002"],
  [17.95, 19.55, "\u4E09\u767E\u591A\u9805\u7814\u7A76\u6574\u7406\u51FA\uFF1A"],
  [19.94, 22.59, "ADHD \u7684\u53CD\u61C9\uFF0C\u66F4\u5BB9\u6613\u5FFD\u5FEB\u5FFD\u6162\u3002"],
  [23.2, 24.21, "\u5927\u8166\u6709\u500B\u5F8C\u53F0\uFF0C"],
  [24.49, 25.52, "\u767C\u5446\u6642\u6700\u4EAE\u3002"],
  [26.03, 28.01, "\u958B\u59CB\u505A\u4E8B\uFF0C\u5B83\u672C\u8A72\u6697\u4E0B\u4F86\u3002"],
  [28.59, 29.78, "\u5152\u5C11\u8166\u9020\u5F71\u770B\u5230\uFF0C"],
  [30.11, 32.94, "ADHD \u7684\u524D\u5F8C\u53F0\u5E73\u5747\u5206\u5F97\u8F03\u4E0D\u958B\u3002"],
  [33.26, 34.1, "\u5DEE\u7570\u5F88\u5C0F\uFF0C"],
  [34.37, 35.48, "\u53EA\u662F\u7DDA\u7D22\u4E4B\u4E00\u3002"],
  [36.19, 37.57, "\u734E\u52F5\u4E5F\u6709\u8DDD\u96E2\u3002"],
  [38.12, 40.11, "\u5C0D\u4E0D\u5C11\u6709 ADHD \u7684\u4EBA\u4F86\u8AAA\uFF0C"],
  [40.32, 42.32, "\u9060\u8655\u7684\u5927\u734E\uFF0C\u7E2E\u5F97\u7279\u5225\u5FEB\u3002"],
  [42.93, 44.23, "\u6709\u6642\u71C8\u9396\u4F4F\u4E0D\u52D5\uFF0C"],
  [44.56, 45.88, "\u4E00\u62AC\u982D\uFF0C\u5929\u4EAE\u4E86\u3002"],
  [46.36, 47.48, "\u9019\u53EB\u904E\u5EA6\u5C08\u6CE8\uFF0C"],
  [47.75, 49.13, "\u4E0D\u662F ADHD \u7368\u6709\u3002"],
  [49.79, 51.13, "\u81F3\u65BC\u90A3\u53E5\u300C\u5750\u597D\u300D\uFF1A"],
  [51.7, 52.84, "\u4E00\u9805\u5C0F\u578B\u7814\u7A76\u88E1\uFF0C"],
  [53.02, 55.18, "\u6709 ADHD \u7684\u7537\u5B69\u52D5\u5F97\u591A\u6642\uFF0C"],
  [55.36, 56.65, "\u8A18\u61B6\u984C\u7B54\u5F97\u66F4\u597D\u3002"],
  [57.12, 59.96, "\u57FA\u56E0\u3001\u74B0\u5883\u3001\u5927\u8166\u767C\u5C55\u4E00\u8D77\u4F5C\u7528\u3002"],
  [60.36, 62.43, "\u4E00\u53E5\u300C\u4E0D\u5920\u52AA\u529B\u300D\u89E3\u91CB\u4E0D\u4E86\u3002"],
  [63.08, 66.55, "\u85E5\u7269\u3001\u5FC3\u7406\u6CBB\u7642\u3001\u74B0\u5883\u8ABF\u6574\uFF0C\u90FD\u662F\u9078\u9805\u3002"],
  [67.04, 69.24, "\u600E\u9EBC\u642D\u914D\uFF0C\u627E\u5C08\u696D\u4EBA\u54E1\u4E00\u8D77\u770B\u3002"],
  [69.8, 71.89, "\u5076\u723E\u5206\u5FC3\uFF0C\u4E0D\u7B49\u65BC ADHD\u3002"],
  [72.39, 73.89, "\u8981\u770B\u662F\u5426\u5F9E\u5C0F\u5C31\u6709\u3001"],
  [74.12, 76.17, "\u8DE8\u5834\u5408\uFF0C\u800C\u4E14\u5F71\u97FF\u751F\u6D3B\u3002"],
  [77.39, 78.87, "\u9019\u76DE\u71C8\u4E0D\u662F\u4E0D\u4EAE\u3002"],
  [79.31, 80.07, "\u53EA\u662F\uFF0C"],
  [80.55, 81.38, "\u6BD4\u8F03\u96E3\u8ABF\u5EA6\u3002"]
];
var KICKERS = [
  [18.15, 22.5, "KOFLER ET AL. \xB7 2013 \xB7 319 \u9805\u7814\u7A76", "\u6CE8\u610F\u529B\u4E0D\u8DB3\u904E\u52D5\u75C7\uFF08ADHD\uFF09"],
  [23.5, 27.8, "DEFAULT MODE NETWORK", "\u9810\u8A2D\u6A21\u5F0F\u7DB2\u8DEF"],
  [28.7, 35.4, "NORMAN ET AL. \xB7 2023 \xB7 \u5152\u5C11\u8166\u9020\u5F71", void 0, true],
  [36.3, 42.2, "JACKSON & MACKILLOP \xB7 2016 \xB7 \u5EF6\u9072\u6298\u6263"],
  [46.4, 49.2, "HUPFELD 2019 \xB7 GROEN 2020 \xB7 \u904E\u5EA6\u5C08\u6CE8", void 0, true, 210],
  [50, 56.5, "SARVER ET AL. \xB7 2015", "29 \u540D ADHD \u7537\u5B69"]
];
var FLATS = [
  [17.35, 18.05, "down", 3],
  [27.95, 28.65, "right", 2],
  [35.45, 36.15, "left", 2],
  [42.25, 42.95, "up", 2],
  [49.15, 49.85, "right", 2],
  [62.45, 63.15, "up", 1],
  [69.15, 69.85, "left", 0],
  [76.15, 76.85, "down", 1]
];
var FPS_ANIM = 12;
var STOP = false;
var step = (t) => STOP ? Math.floor(t * FPS_ANIM + 1e-6) / FPS_ANIM : t;
var io = ease.inOutCubic;
var out = ease.outCubic;
var inQ = ease.inQuad;
var outBack = (x) => {
  const c = 1.7;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
};
var mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
var ramp = (t, a, d, curve = io) => curve(clamp((step(t) - a) / d));
var sm = (t, a, d, curve = io) => curve(clamp((t - a) / d));
var bump = (t, a, d) => {
  const k = clamp((step(t) - a) / d);
  return Math.sin(k * Math.PI);
};
var frame12 = (t) => Math.floor(t * 12 + 1e-6);
var boil = (t, seed) => rng(frame12(t) * 31 + seed)() * 2 - 1;
var fadeIn = (t, a, b, i = 0.35, o = 0.3) => at(t, a, a + i, out) * (1 - at(t, b - o, b, io));
var c1a = { p: [0.9, 3.7, 5.6], q: [0.1, 5.4, 4.72], fov: 30, focus: 2.1, ap: 14 };
var c1b = { p: [0.4, 3.3, 15.6], q: [0, 3.3, 3.6], fov: 30, focus: 11.9, ap: 12 };
var c1c = { ...c1b, p: [0.4, 3.3, 15.2], focus: 11.6 };
var c2a = { p: [1.3, 3.3, 15.6], q: [1.4, 3.3, 3.2], fov: 30, focus: 11.9, ap: 12 };
var c2b = { p: [0.1, 3.3, 15.6], q: [-0.2, 3.3, 3.2], fov: 30, focus: 11.9, ap: 12 };
var c3 = { p: [0.5, 0.95, 11.2], q: [0.05, 3.9, 3.2], fov: 42, focus: 8.4, ap: 8, roll: 0.05 };
var c3b = { ...c3, p: [0.5, 0.95, 10.7], focus: 7.9 };
var c4a = { p: [-4.2, 3.42, 9], q: [-3.9, 3.42, 5.15], fov: 28, focus: 3.85, ap: 8 };
var c4b = { p: [0.6, 3.42, 9], q: [0.9, 3.42, 5.15], fov: 28, focus: 3.85, ap: 8 };
var c4c = { p: [-0.4, 3.5, 15.2], q: [0.1, 3.5, 5.1], fov: 25, focus: 10.1, ap: 16 };
var c5 = { p: [0, 3.5, 9.8], q: [0, 3.45, 1.2], fov: 34, focus: 7.2, ap: 10 };
var c5b = { ...c5, p: [0, 3.5, 9.2], focus: 6.6 };
var c6a = { p: [-12.6, 3.3, 2.5], q: [0, 3.15, 2.7], fov: 31, focus: 12.6, ap: 6 };
var c6b = { p: [-12.6, 3.3, 3.5], q: [0, 3.15, 3.5], fov: 31, focus: 12.6, ap: 6 };
var c7a = { p: [0.8, 1.45, 8.4], q: [0.1, 1, 3.4], fov: 40, focus: 5, ap: 4 };
var c7b = { p: [0.5, 2.1, 11.6], q: [0.15, 1.12, 2.6], fov: 26, focus: 10.5, ap: 3.5 };
var c8a = { p: [0, 3.9, 14.4], q: [0, 3.9, 3.6], fov: 30, focus: 10.4, ap: 7 };
var c8b = { p: [0, 3.6, 15.6], q: [0, 3.6, 3.3], fov: 30, focus: 11.6, ap: 7 };
var c9a = { p: [-2.7, 1.1, 8], q: [-3.05, 1.1, 3.4], fov: 26, focus: 4.5, ap: 5 };
var c9b = { p: [0.9, 2.6, 14.4], q: [0.75, 2.02, 3], fov: 30, focus: 11.4, ap: 6 };
var c9c = { p: [0, 1.7, 6.8], q: [0, 0, 3.7], fov: 36, focus: 3.5, ap: 3 };
var c9d = { p: [0, 0.22, 3.76], q: [0, 0, 3.7], fov: 36, focus: 0.3, ap: 0 };
var Y0 = -24;
var c10a = { p: [0, Y0 + 11.4, 2], q: [0, Y0, 2.1], fov: 36, focus: 4, ap: 2 };
var c10b = { p: [0, Y0 + 7.6, 2.4], q: [0, Y0 + 1, 3.4], fov: 36, focus: 6, ap: 3 };
var c10c = { p: [0, Y0 + 3.6, 18.6], q: [0, Y0 + 3.6, 2], fov: 36, focus: 15.6, ap: 5 };
var c10d = { ...c10c, p: [0, Y0 + 4.2, 17.4], focus: 14.4 };
var c11a = { p: [-5.2, 3.5, 14.3], q: [-2.2, 3.2, 3.9], fov: 30, focus: 11, ap: 12 };
var c11b = { p: [-1.9, 3.5, 15.1], q: [-1, 3.35, 3.9], fov: 30, focus: 11.3, ap: 12 };
var c11c = { ...c11b, p: [-1.6, 3.5, 14.7], focus: 10.9 };
var top = (y) => ({ p: [0, y, 3.32], q: [0, 0, 3.3], fov: 30, focus: y - 0.1, ap: 2, up: [0, 0, -1] });
var c13a = { p: [-0.4, 3.7, 12.6], q: [0.2, 3.4, 3.6], fov: 30, focus: 9, ap: 10 };
var c13b = { p: [-2.2, 5.6, 27], q: [0, 3.85, 3.5], fov: 27, focus: 23.5, ap: 8 };
var CK = [
  [0, c1a],
  [1.3, c1a],
  [4.7, c1b],
  [7.2, c1c],
  [9.7, c2a],
  [10.5, c2b],
  [13.25, c2b],
  [14.1, c3],
  [17.7, c3b],
  [17.7, c4a],
  [19.4, c4b],
  [21.1, c4c],
  [22.9, c4c],
  [24.9, c5],
  [28.3, c5b],
  [28.3, c6a],
  [35.8, c6b],
  [35.8, c7a],
  [38.1, c7a],
  [41.9, c7b],
  [42.6, c7b],
  [42.6, c8a],
  [46.3, c8a],
  [48.7, c8b],
  [49.5, c8b],
  [49.5, c9a],
  [51.1, c9a],
  [52.6, c9b],
  [56.4, c9b],
  [56.72, c9c],
  [56.9, c9d],
  [56.9, c10a],
  [57.4, c10b],
  [58.4, c10c],
  [62.8, c10d],
  [62.8, c11a],
  [66.6, c11b],
  [69.5, c11c],
  [69.5, top(15)],
  [71.9, top(15)],
  [72.6, top(14.2)],
  [73.9, top(14.2)],
  [74.5, top(13.5)],
  [75.3, top(13.5)],
  [75.9, top(12.8)],
  [76.5, top(12.8)],
  [76.5, c13a],
  [77.3, c13a],
  [81.2, c13b],
  [85, c13b]
];
function cameraAt(t) {
  let i = 0;
  while (i < CK.length - 1 && CK[i + 1][0] <= t) i++;
  const [t0, a] = CK[i], nx = CK[i + 1];
  if (!nx || nx[0] === t0) return a;
  const k = io(clamp((t - t0) / (nx[0] - t0)));
  return { p: mix3(a.p, nx[1].p, k), q: mix3(a.q, nx[1].q, k), fov: lerp(a.fov, nx[1].fov, k), focus: lerp(a.focus, nx[1].focus, k), ap: lerp(a.ap, nx[1].ap, k), roll: lerp(a.roll ?? 0, nx[1].roll ?? 0, k), up: a.up };
}
var noteRot = [];
var DESK = { p: [0, 0, 4.2] };
var WIN = [3.75, 4.25, 0.05];
var TV = [-3.75, 0, 2.5];
function reset(W, u0) {
  const hide = [W.labels, W.tapes, W.heroTapes, W.back, W.dimmer, W.part, W.curtains, W.rail, W.trophy, W.candy, W.pin, W.cups, W.tower, W.nine, W.under, W.toolbox, W.floorPulley, W.board, W.crate, W.ink, W.pro, W.title, W.deskProps, W.me.g, W.helper.g, W.kid.g, ...W.others.map((o) => o.g), W.tv, W.win, W.desk, W.rope];
  for (const o of hide) o.visible = false;
  for (const o of [W.box, W.deskTop, W.fix, W.track, W.pulley, W.dowels, W.set, W.sides[-1], W.sides[1], W.outerSides[-1], W.outerSides[1], W.inkSides[-1], W.inkSides[1], W.backBoard]) o.visible = true;
  W.spot.intensity = 300;
  W.spot.angle = 0.3;
  W.spot.penumbra = 0.55;
  W.spot.color.set(16764820);
  W.amber.intensity = 0;
  W.glow.intensity = 0;
  W.tvGlow.intensity = 0;
  for (const s of W.extra) s.intensity = 0;
  W.lens.emissiveIntensity = 7;
  W.hemi.intensity = 0.3;
  W.fill.intensity = 0.14;
  W.room.intensity = 0;
  W.room.position.set(14, 22, 20);
  W.glow.color.set(16751164);
  W.beam.visible = false;
  W.leak.visible = false;
  W.tvMat.emissiveIntensity = 0.25;
  W.skyDawn.opacity = 0;
  W.sun.visible = false;
  W.moon.visible = true;
  W.sun.position.y = -0.45;
  W.moon.position.y = 0.5;
  W.win.position.set(...WIN);
  W.tv.position.set(...TV);
  W.desk.position.set(...DESK.p);
  W.desk.rotation.y = 0;
  W.back.children.forEach((g, i) => {
    g.rotation.y = noteRot[i];
    g.visible = true;
  });
  u0.exposure.value = 1.2;
  u0.maxBlur.value = 16;
  u0.vig.value = 0.4;
  u0.grain.value = 0.04;
  for (const p of [W.me, W.helper, W.kid, ...W.others]) {
    p.g.rotation.set(0, 0, 0);
    p.body.rotation.set(0, 0, 0);
    p.body.scale.set(1, 1, 1);
    p.arms[0].rotation.z = 0;
    p.arms[1].rotation.z = 0;
    p.legs[0].rotation.z = 0;
    p.legs[1].rotation.z = 0;
    p.rod.visible = p.block.visible = true;
    p.look(0, 0);
  }
}
var Vec = (W, a) => W.v3(a[0], a[1], a[2]);
function extra(W, i, p, q, angle, I) {
  const s = W.extra[i];
  s.position.set(p[0], p[1], p[2]);
  s.target.position.set(q[0], q[1], q[2]);
  s.target.updateMatrixWorld();
  s.angle = angle;
  s.intensity = I;
}
function spot(W, p, q, angle, I) {
  W.spot.position.set(p[0], p[1], p[2]);
  W.spot.target.position.set(q[0], q[1], q[2]);
  W.spot.target.updateMatrixWorld();
  W.spot.angle = angle;
  W.spot.intensity = I;
}
function aim(W, x, target, o = {}) {
  W.fix.position.set(x, TRACK.y - 0.02, TRACK.z);
  W.fix.updateWorldMatrix(true, true);
  const tv = Vec(W, target);
  W.head.lookAt(tv);
  W.head.updateWorldMatrix(true, false);
  const from = W.head.localToWorld(W.v3(0, 0, 0.3));
  W.spot.position.copy(from);
  W.spot.target.position.copy(tv);
  W.spot.target.updateMatrixWorld();
  W.spot.angle = o.angle ?? 0.3;
  W.spot.intensity = o.i ?? 300;
  const b = o.beam ?? 0.1;
  W.beamMat.uniforms.k.value = b;
  if (b > 0) W.setBeam(W.beam, from, tv, W.spot.angle * 0.9);
}
var reportPoint = (W) => {
  W.report.updateWorldMatrix(true, false);
  const v = W.report.localToWorld(W.reportAnchor.clone());
  return [v.x, v.y, v.z];
};
function studySet(W) {
  W.desk.visible = W.me.g.visible = W.win.visible = W.tv.visible = W.rope.visible = true;
  W.me.g.position.set(-0.55, 0, 3.55);
  W.me.rod.visible = W.me.block.visible = false;
}
var ropeHead = (fx) => [[fx - 0.22, TRACK.y - 0.03, TRACK.z], [(fx - 4.3) / 2, TRACK.y - 0.06, TRACK.z], [-4.3, TRACK.y - 0.08, TRACK.z], [-4.46, TRACK.y - 0.3, TRACK.z]];
var handTail = (h, sag = 0) => {
  const a = [-4.46, TRACK.y - 0.3, TRACK.z];
  return [0.3, 0.6, 0.85, 1].map((k) => {
    const m = mix3(a, h, k);
    m[1] -= sag * Math.sin(k * Math.PI);
    return m;
  });
};
var mixTail = (a, b, k) => a.map((p, i) => mix3(p, b[i], k));
var handOf = (W, p, i = 1) => {
  p.g.updateWorldMatrix(true, true);
  const h = p.hand(i);
  return [h.x, h.y, h.z];
};
var TAIL_FLOOR = [[-4.4, 3.6, 4.5], [-4.3, 1.3, 4.5], [-4.2, 0.06, 4.5], [-3.5, 0.05, 4.6]];
var TAIL_FAR = [[-5.4, 4.2, 4.2], [-5.5, 2.2, 4.2], [-5.4, 0.06, 4.2], [-4.9, 0.05, 4.4]];
var TAIL_HANG = [[-4.5, 3, 4.2], [-4.45, 2, 4.15], [-4.42, 1, 4.1], [-4.4, 0.06, 4.1]];
var TAIL_LOCK = [[-4.5, 3.4, 4.3], [-4.4, 2, 4.3], [-4.3, 0.08, 4.3], [-3.5, 0.05, 4.1]];
var TAIL_DROP = [[-4.5, 3, 4.3], [-4.5, 2, 4.33], [-4.5, 1, 4.36], [-4.5, 0.06, 4.4]];
function curtains(W, open) {
  W.curtains.visible = true;
  W.curtains.children.forEach((c, i) => {
    c.scale.x = 1.6;
    c.position.x = (i ? 1 : -1) * (3.3 + 2 * open);
    c.position.z = 5.6;
  });
}
function sky(W, k) {
  W.skyDawn.opacity = k;
  W.sun.visible = k > 0.02;
  W.sun.position.y = lerp(-1.02, -0.45, k);
  W.moon.visible = k < 0.8;
  W.moon.position.y = lerp(0.5, 0.95, k);
}
var GAP = (() => {
  const p = tapePositions(14, 0.62, 0.17, 90).map((x) => -5.5 + 11 * x);
  let a = 0, b = 0;
  for (let i = 1; i < p.length; i++) if (p[i - 1] > -2.6 && p[i] < 2.6 && p[i] - p[i - 1] > b - a) {
    a = p[i - 1];
    b = p[i];
  }
  return [a, b];
})();
var STRIP = (() => {
  const r = rng(9), held = [0, 1, 2, 3, 5, 6, 8], H = [], F = [];
  for (let i = 0; i < 10; i++) {
    const x = -0.65 + i * 0.69;
    if (held.includes(i)) {
      H[i] = { x, y: 3.62 + r() * 0.55, z: 2.7 + r() * 0.4, ry: (r() - 0.5) * 0.5 };
      F[i] = { x: x + 0.1, y: 0.03, z: 3.5, rz: 0.4 - i * 0.1 };
    } else {
      const fx = x + (r() - 0.5) * 0.25, fz = 3.3 + r() * 0.9, rz = (r() - 0.5) * 1.1;
      H[i] = { x, y: 3.9, z: 2.9, ry: 0.1 };
      F[i] = { x: fx, y: 0.03, z: fz, rz };
    }
  }
  return { H, F };
})();
var FALLS = { 4: 50.8, 7: 51.3, 9: 51.8, 1: 52.25, 3: 52.65 };
var BACK = { 1: 55.5, 3: 56 };
function S01(W, t) {
  studySet(W);
  const rp = reportPoint(W), level = t < 0.7 ? 0 : t < 0.78 ? 1 : t < 0.86 ? 0.3 : 1;
  const read = ramp(t, 4.9, 0.5);
  W.me.arms[0].rotation.z = lerp(0.2, 0.62, read);
  W.me.arms[1].rotation.z = lerp(-0.1, -0.3, read);
  W.me.look(0.05 * read, lerp(0.03, -0.04, read));
  W.me.g.rotation.y = 0.1;
  W.me.body.rotation.z = -0.03 * read + boil(t, 3) * 3e-3;
  aim(W, 0.1, mix3(rp, [-1 + rp[0], 0.7 + rp[1], -0.4 + rp[2]], 1), { angle: 0.5, i: 190 * level, beam: 0.2 * level });
  W.lens.emissiveIntensity = 7 * level;
  W.hemi.intensity = lerp(0.03, 0.24, level);
  W.fill.intensity = 0.08 * level;
  W.setRope([...ropeHead(0.5), ...TAIL_FLOOR]);
  return () => {
  };
}
function S02(W, t) {
  studySet(W);
  const rp = reportPoint(W), u = step(t);
  const T0 = [rp[0] - 1, rp[1] + 0.7, rp[2] - 0.4], WC = [3.75, 4.25, 0.1], TVC = [-3.75, 1.9, 2.6];
  const s1 = ramp(t, 8.75, 1.25), s2 = ramp(t, 10.1, 0.55), hold = ramp(t, 8.5, 0.35), let_go = ramp(t, 10.05, 0.5);
  const tug = bump(t, 9.2, 0.45) * 0.55 + bump(t, 9.7, 0.35) * 0.3, drift = Math.sin(u * 3.1) * 0.07 * (1 - s1);
  const fx = lerp(lerp(0.1, 2.6, s1) - tug + drift, -2.9, s2);
  aim(W, fx, mix3(mix3(T0, WC, s1), TVC, s2), { angle: lerp(lerp(0.5, 0.26, s1), 0.2, s2), i: lerp(lerp(190, 170, s1), 70, s2), beam: 0.2 });
  W.me.g.position.x = lerp(lerp(-0.55, -0.8, hold), -0.55, let_go);
  W.me.g.rotation.y = lerp(lerp(0.1, -0.12, hold), 0.36, let_go);
  W.me.body.rotation.z = lerp(hold * (0.14 + tug * 0.12), -0.05, let_go);
  W.me.arms[1].rotation.z = lerp(lerp(-0.3, -2.5, hold), -0.1, let_go);
  W.me.arms[0].rotation.z = lerp(lerp(0.62, 1, hold), 0.25, let_go);
  W.me.look(lerp(-0.06 * hold, -0.09, let_go), lerp(0.06 * hold, -0.03, let_go));
  const h = handOf(W, W.me), tail = let_go > 0 ? mixTail(handTail(h), TAIL_FAR, let_go) : mixTail(TAIL_FLOOR, handTail(h), hold);
  W.setRope([...ropeHead(Math.max(fx, -3.6)), ...tail]);
  const k = ramp(t, 10.7, 1.7);
  sky(W, k);
  W.tvMat.emissiveIntensity = lerp(0.25, 1, s2);
  W.tvGlow.position.set(-3.2, 2, 3.9);
  W.tvGlow.intensity = 9 * s2;
  extra(W, 0, mix3([-1.4, 5.6, 11], [0.6, 5.6, 11], s2), mix3([-0.8, 2.6, 3.5], [-0.5, 2.6, 3.5], s2), 0.3, lerp(34 * hold, 30, s2));
  W.hemi.intensity = lerp(lerp(0.24, 0.42, hold), 0.4, s2);
  W.fill.intensity = lerp(0.08, 0.1, hold);
  return (c, Pj) => {
    ring(c, Pj, W, rp, 0.92, sm(t, 8.95, 0.55), "\u60F3\u7167\u7684\u5730\u65B9", fadeIn(t, 9.3, 14));
  };
}
function S03(W, t) {
  studySet(W);
  W.labels.visible = true;
  const fly = ramp(t, 13.2, 0.55, inQ), rp = reportPoint(W);
  W.win.position.y += 9 * fly;
  W.tv.position.y += 9 * fly;
  W.win.visible = W.tv.visible = fly < 1;
  sky(W, 1);
  W.tvMat.emissiveIntensity = 1 - 0.75 * fly;
  const a = ramp(t, 13.2, 0.7);
  aim(W, lerp(-2.9, -2.8, a), mix3([-3.75, 1.9, 2.6], [-0.2, 2.3, 3.4], a), { angle: lerp(0.2, 0.34, a), i: lerp(70, 200, a), beam: 0.1 });
  W.spot.color.set(16768952);
  W.setRope([...ropeHead(-2.8), ...mixTail(TAIL_FAR, TAIL_HANG, a)]);
  const hits = [13.55, 13.85, 14.2, 14.75];
  let squash = 0;
  W.signs.forEach((s, i) => {
    const k = ramp(t, hits[i], 0.32, outBack), age = step(t) - hits[i] - 0.32;
    s.g.position.y = s.y + 7.4 * (1 - k);
    s.g.rotation.z = s.rz + (age > 0 ? Math.sin(age * 7) * 0.05 * Math.exp(-age * 1.6) : 0);
    if (i < 3) squash += bump(t, hits[i] + 0.22, 0.3);
  });
  const fl = ramp(t, 15.6, 0.5);
  W.signs[3].g.rotation.y = lerp(W.signs[3].ry - Math.PI, W.signs[3].ry, fl);
  W.me.g.position.x = lerp(-0.55, -0.3, a);
  W.me.g.rotation.y = lerp(0.36, 0, a);
  W.me.body.scale.y = 1 - squash * 0.05;
  W.me.body.rotation.x = 0.04 + ramp(t, 13.9, 0.8) * 0.05;
  W.me.arms[0].rotation.z = 0.1;
  W.me.arms[1].rotation.z = -0.1;
  W.me.look(0, lerp(0.08, -0.04, ramp(t, 14.3, 0.4)) + ramp(t, 15.7, 0.4) * 0.12);
  extra(W, 0, [-3.2, 1.2, 9], [-3.5, 3.3, 2.6], 0.3, 40);
  W.hemi.intensity = 0.42;
  void rp;
  return () => {
  };
}
function S04(W, t) {
  W.ink.visible = W.heroTapes.visible = true;
  W.fix.visible = W.track.visible = W.pulley.visible = false;
  const wall = t > 19.2;
  W.tapes.visible = wall;
  if (wall) for (const r of W.tapeRows) r.g.position.y = r.y + 8 * (1 - ramp(t, 19.4 + r.d * 1.3, 0.6));
  spot(W, [0.2, 7, 8.8], [0, 3.2, 5.15], 0.8, 170);
  extra(W, 0, [-4, 7, 7], [0, 3.5, 0.4], 0.8, 22 * sm(t, 19.6, 1));
  W.hemi.intensity = 0.1;
  W.fill.intensity = 0.04;
  W.heroTapes.children[0].position.x = 0;
  if (t > 22.2) curtains(W, 1 - ramp(t, 22.25, 0.65));
  return (c, Pj) => {
    const [ax, ay] = Pj([-3.5, 4.22, 5.15]), [bx, by] = Pj([-3.5, 3.22, 5.15]), lab = fadeIn(t, 20.9, 22.5);
    const a0 = fadeIn(t, 18.2, 19.3, 0.3, 0.2);
    if (a0 > 0) {
      const [mx, my] = Pj([-3.1, 3.36, 5.15]), [nx, ny] = Pj([-3.1, 3.08, 5.15]);
      chalk(c, "\u4E00\u822C\u767C\u5C55", mx, my, { color: C.cream, alpha: a0, size: 36 });
      chalk(c, "ADHD", nx, ny, { alpha: a0, size: 36 });
    }
    if (lab > 0) {
      chalk(c, "\u4E00\u822C\u767C\u5C55", ax, ay, { color: C.cream, alpha: lab, size: 34 });
      chalk(c, "ADHD", bx, by, { alpha: lab, size: 34 });
    }
    const g = sm(t, 21.2, 0.4) * (1 - sm(t, 22.2, 0.3));
    if (g > 0) {
      const [x0, y0] = Pj([GAP[0], 2.42, 5.15]), [x1] = Pj([GAP[1], 2.42, 5.15]);
      c.save();
      c.globalAlpha = g;
      c.strokeStyle = C.amber;
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(x0, y0 - 12);
      c.lineTo(x0, y0);
      c.lineTo(x1, y0);
      c.lineTo(x1, y0 - 12);
      c.stroke();
      c.restore();
      chalk(c, "\u5076\u723E\u6709\u4E00\u6BB5\u7279\u5225\u4E45\u7684\u7A7A\u767D", (x0 + x1) / 2, y0 + 40, { color: C.cream, alpha: g, size: 28, align: "center" });
    }
  };
}
function S05(W, t) {
  W.ink.visible = W.back.visible = W.dimmer.visible = true;
  W.fix.visible = W.track.visible = W.pulley.visible = false;
  const u = step(t), dim = ramp(t, 26.3, 1.6), wake = bump(t, 24.45, 1.2);
  const open = ramp(t, 23, 1.2);
  curtains(W, open);
  spot(W, [0.2, 7, 8.8], [0, 3.2, 5.15], 0.8, 170 * (1 - open));
  W.dimmer.position.set(1.62, 0.95, 4);
  W.dimmer.rotation.y = -0.22;
  W.fader.position.y = lerp(3, 0.78, dim);
  W.back.children[1].visible = false;
  W.back.children.forEach((g, i) => {
    g.rotation.y = noteRot[i] + Math.sin(u * 1.9 + i * 1.7) * (0.16 + wake * 0.2) * (1 - dim * 0.85);
  });
  W.glow.position.set(-0.6, 6.8, 3.6);
  W.glow.intensity = lerp(90 + wake * 30, 9, dim);
  W.hemi.intensity = lerp(0.22, 0.13, dim);
  extra(W, 0, [0, 6.6, 8.5], [1.62, 2.6, 4], 0.2, lerp(90, 150, dim));
  return (c, Pj) => {
    const a = fadeIn(t, 26.1, 28.1);
    if (a <= 0) return;
    const [x, y] = Pj([1.62, 3.55, 4.1]);
    c.save();
    c.globalAlpha = a;
    c.strokeStyle = C.amber;
    c.fillStyle = C.amber;
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(x + 88, y - 96);
    c.lineTo(x + 88, y + 60);
    c.stroke();
    c.beginPath();
    c.moveTo(x + 74, y + 56);
    c.lineTo(x + 102, y + 56);
    c.lineTo(x + 88, y + 80);
    c.fill();
    c.restore();
  };
}
function S06(W, t) {
  W.back.visible = W.part.visible = true;
  studySet(W);
  W.tv.visible = W.win.visible = W.rope.visible = W.pulley.visible = false;
  W.sides[-1].visible = W.outerSides[-1].visible = W.inkSides[-1].visible = false;
  const u = step(t), leak = ramp(t, 30.3, 1);
  W.back.children.forEach((g, i) => {
    g.rotation.y = -1.25 + i % 3 * 0.12 + Math.sin(u * 1.3 + i) * 0.05;
    g.visible = g.position.x > 0.9;
  });
  W.desk.position.set(0.2, 0, 5.05);
  W.desk.rotation.y = -2;
  const hx = Math.sin(-2), hz = Math.cos(-2);
  W.me.g.position.set(0.2 - hx * 0.75, 0, 5.05 - hz * 0.75);
  W.me.g.rotation.y = -1.75;
  W.me.arms[0].rotation.z = 0.55;
  W.me.arms[1].rotation.z = 0.4;
  W.me.look(0.04, -0.05);
  W.me.body.rotation.z = boil(t, 5) * 4e-3;
  const rp = reportPoint(W);
  aim(W, 0.1, [rp[0] + 0.1, rp[1], rp[2] + 0.1], { angle: 0.36, i: 64, beam: 0 });
  W.fix.visible = W.track.visible = false;
  W.glow.position.set(1.6, 4.4, 1.6);
  W.glow.intensity = 70;
  W.amber.position.set(rp[0], 2.02, 0.9);
  W.amber.target.position.set(rp[0], rp[1], rp[2]);
  W.amber.target.updateMatrixWorld();
  W.amber.angle = 0.2;
  W.amber.intensity = 620 * leak;
  if (leak > 0) {
    W.leakMat.uniforms.k.value = 1.1 * leak;
    W.setBeam(W.leak, Vec(W, [rp[0], 1.82, 3.2]), Vec(W, [rp[0], rp[1] - 0.04, rp[2]]), 0.13, 0.22);
  }
  extra(W, 0, [-4, 6.8, 6.4], [6, 3.2, 5.2], 0.34, 70);
  W.hemi.intensity = 0.2;
  return (c, Pj) => {
    const a = Pj([0, 5.5, -0.2]), b = Pj([0, 4.3, 5.6]), s = Pj([0, 1.82, 3.2]);
    chalk(c, "\u5F8C\u53F0", a[0], a[1], { color: C.ink, size: 40, align: "center", alpha: fadeIn(t, 28.8, 35.5), shadow: false });
    chalk(c, "\u524D\u53F0", b[0], b[1], { color: C.cream, size: 40, align: "center", alpha: fadeIn(t, 29.4, 35.5) });
    const k = fadeIn(t, 31.3, 35.4);
    if (k <= 0) return;
    chalk(c, "\u5F88\u7A84\u7684\u7E2B", s[0] - 26, s[1] + 76, { size: 34, align: "right", alpha: k });
    c.save();
    c.globalAlpha = k;
    c.strokeStyle = C.gold;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(s[0] - 22, s[1] + 62);
    c.lineTo(s[0] - 4, s[1] + 12);
    c.stroke();
    c.restore();
  };
}
function S07(W, t) {
  W.ink.visible = W.rail.visible = W.trophy.visible = W.candy.visible = true;
  W.fix.visible = W.track.visible = W.pulley.visible = false;
  const slow = ramp(t, 38.1, 2.1), fast = ramp(t, 40.3, 1.6), z = lerp(lerp(3.4, 2.75, slow), 0.95, fast), s = lerp(lerp(1, 0.9, slow), 0.5, fast);
  W.trophy.position.set(0, 0.1, z);
  W.trophy.scale.setScalar(s);
  W.candy.position.set(0, 0.3, 4.4);
  W.candy.scale.setScalar(0.8);
  W.candy.rotation.set(0.1, 0.3, 0.15);
  spot(W, [1.2, 6.5, z + 2.25], [0, 0.4, z], 0.17, 360);
  extra(W, 0, [-1.8, 5, 8.2], [0, 0.2, 4.4], 0.15, 150);
  extra(W, 1, [0, 7, 6], [0, 0, 3.2], 0.7, 70);
  W.hemi.intensity = 0.36;
  return (c, Pj) => {
    const a = sm(t, 40.5, 0.5), l = fadeIn(t, 41, 42.6, 0.4, 0.01);
    if (a <= 0) return;
    const b = Pj([0, 0.1, z]), r = Pj([0, 0.81, z]), H = (b[1] - r[1]) * 2.2, w = H * 0.34, cx = b[0], by = b[1];
    c.save();
    c.globalAlpha = a;
    c.strokeStyle = C.gold;
    c.lineWidth = 5;
    c.setLineDash([22, 14]);
    c.lineCap = "round";
    c.shadowColor = "rgba(0,0,0,.5)";
    c.shadowBlur = 6;
    c.beginPath();
    c.moveTo(cx - w * 0.86, by);
    c.lineTo(cx + w * 0.86, by);
    c.moveTo(cx - w * 0.24, by - H * 0.04);
    c.lineTo(cx - w * 0.16, by - H * 0.34);
    c.quadraticCurveTo(cx - w * 0.9, by - H * 0.46, cx - w, by - H);
    c.lineTo(cx + w, by - H);
    c.quadraticCurveTo(cx + w * 0.9, by - H * 0.46, cx + w * 0.16, by - H * 0.34);
    c.lineTo(cx + w * 0.24, by - H * 0.04);
    c.stroke();
    c.restore();
    chalk(c, "\u5BE6\u969B\u7684\u50F9\u503C", cx + w + 18, by - H * 0.86, { alpha: l });
    chalk(c, "\u611F\u89BA\u5230\u7684\u50F9\u503C", cx + w * 0.62, by - H * 0.2, { color: C.cream, size: 30, alpha: l });
  };
}
function S08(W, t) {
  W.ink.visible = true;
  studySet(W);
  W.tower.visible = W.cups.visible = W.pin.visible = true;
  W.tv.visible = false;
  const up = ramp(t, 44.55, 0.45), u = step(t);
  sky(W, ramp(t, 44.6, 1.1));
  W.me.g.position.set(-1.2, 0, 3.55);
  W.me.g.rotation.y = 0.2;
  W.me.arms[0].rotation.z = lerp(1.25 + Math.sin(u * 9) * 0.06, 0.5, up);
  W.me.arms[1].rotation.z = lerp(0.62 + Math.sin(u * 7 + 1) * 0.05, -0.1, up);
  W.me.look(lerp(0.08, 0.1, up), lerp(-0.05, 0.1, up));
  W.me.body.rotation.z = -0.04 * up;
  const fx = -0.5;
  aim(W, fx, [-0.65, 2.8, 3.95], { angle: 0.4, i: 200, beam: 0.2 });
  W.pin.position.set(fx + 0.08, TRACK.y + 0.22 + 1.6 * (1 - ramp(t, 42.95, 0.3, inQ)), TRACK.z);
  W.setRope([...ropeHead(fx), ...TAIL_LOCK]);
  W.cups.children.forEach((g, i) => {
    g.visible = step(t) >= 43.35 + i * 0.3;
  });
  [[-4.65, 2], [-3.1, 1.5], [3.9, 1.7]].forEach(([x, z], i) => {
    const o = W.others[i], k = ramp(t, 47.7 + i * 0.28, 0.3), w = ramp(t, 46.5 + i * 0.12, 0.9), wing = x < 0 ? -7.2 : 7.2, hop = w > 0 && w < 1 ? Math.abs(Math.sin(step(t) * 13)) * 0.1 : 0;
    o.g.visible = w > 0;
    o.g.position.set(lerp(wing, x, w), hop, z);
    o.look(0, -0.05);
    o.arms[0].rotation.z = 0.9;
    o.arms[1].rotation.z = -0.9;
    extra(W, i, [x + 0.2, 6.6, z + 1.4], [x, 1, z], 0.22, 90 * k);
  });
  W.hemi.intensity = 0.3;
  W.fill.intensity = 0.09;
  return () => {
  };
}
function S09(W, t) {
  W.ink.visible = W.nine.visible = W.kid.g.visible = W.rope.visible = true;
  W.pulley.visible = true;
  const kx = -2.55, KZ = 3.5, u = step(t), free = t >= 53.1, sw = ramp(t, 53.2, 0.35), ph = Math.sin(u * Math.PI * 2 * 1.5);
  W.stool.position.set(kx, 0, 3.1);
  W.kid.g.position.set(kx, 1.54 - 0.62 * 0.84 + 0.02, KZ);
  W.kid.rod.visible = W.kid.block.visible = false;
  W.kid.legs[0].rotation.z = ph * 0.38 * sw;
  W.kid.legs[1].rotation.z = -ph * 0.3 * sw;
  W.kid.arms[0].rotation.z = 0.35;
  W.kid.arms[1].rotation.z = -0.35;
  W.kid.look(0.08, lerp(-0.04, 0.05, ramp(t, 51.2, 0.4)));
  W.kid.g.rotation.y = 0.12;
  const drop = ramp(t, 53, 0.35, inQ);
  W.clip.position.set(lerp(kx, kx + 0.9, drop), lerp(1.26, 0.2, drop), lerp(KZ + 0.1, 3.9, drop));
  W.clip.rotation.set(-1.45 * drop, 0, 0.5 * drop);
  W.strips.forEach((s, i) => {
    const f = FALLS[i], b = BACK[i];
    let k = f !== void 0 ? clamp((step(t) - f) / 0.4) : 0;
    if (b !== void 0) k *= 1 - clamp((step(t) - b) / 0.45);
    W.poseStrip(s, STRIP.H[i], STRIP.F[i], k, b !== void 0 && step(t) > b);
  });
  const fx = -2.2;
  aim(W, fx, [kx, 1.9, KZ], { angle: 0.3, i: 110, beam: 0.16 });
  W.setRope([...ropeHead(fx), ...TAIL_DROP]);
  extra(W, 0, [2.6, 6.8, 7.6], [2, 2.2, 3.2], 0.55, 120);
  extra(W, 1, [0.8, 6, 9], [1, 0, 3.8], 0.5, 150);
  W.hemi.intensity = 0.34;
  return (c, Pj) => {
    if (!free) return;
    const a = sm(t, 53.4, 0.3) * (1 - sm(t, 56.4, 0.3)), p = Pj([kx - 0.35, 1.05, KZ]), q = Pj([kx + 0.4, 1, KZ]);
    c.save();
    c.globalAlpha = a;
    c.strokeStyle = C.amber;
    c.lineWidth = 4;
    c.lineCap = "round";
    c.beginPath();
    c.arc(p[0], p[1], 58, 1.15, 2.4);
    c.stroke();
    c.beginPath();
    c.arc(q[0], q[1], 58, 0.75, 2);
    c.stroke();
    c.restore();
  };
}
function S10(W, t) {
  W.box.visible = W.deskTop.visible = false;
  W.under.visible = true;
  W.fix.visible = false;
  spot(W, [0, Y0 + 13, 2], [0, Y0, 3], 0.22, 900);
  W.beamMat.uniforms.k.value = 0.34;
  W.setBeam(W.beam, Vec(W, [0, Y0 + 9.2, 2.05]), Vec(W, [0, Y0, 2.85]), 0.13);
  W.glow.position.set(0, Y0 + 6.4, 7.5);
  W.glow.color.set(16756838);
  W.glow.intensity = 40 + 90 * ramp(t, 57.85, 0.4);
  extra(W, 0, [-6.6, Y0 + 8.4, 8], [-6.6, Y0 + 2.4, 1.4], 0.42, 25 + 105 * ramp(t, 57.1, 0.4));
  extra(W, 1, [6.8, Y0 + 8.4, 8], [6.8, Y0 + 3.6, 1], 0.42, 25 + 105 * ramp(t, 58.55, 0.4));
  W.hemi.intensity = 0.34;
  const f = clamp((step(t) - 60.2) / 1.9), y = lerp(9.5, 0.35, f * f);
  W.fall.visible = t >= 60.2;
  W.fall.position.set(0.05 + Math.sin(f * 7) * 0.22, y, 3);
  W.fall.rotation.set(0.1 + f * 2.4, 0.2 + f * 3, -0.18 + Math.sin(f * 6) * 0.5);
  return () => {
  };
}
function S11(W, t) {
  studySet(W);
  W.toolbox.visible = W.crate.visible = W.helper.g.visible = true;
  W.tv.visible = false;
  W.dowels.visible = false;
  sky(W, 0);
  const rp = reportPoint(W), u = step(t);
  const walk = ramp(t, 63, 1), hop = Math.abs(Math.sin(u * 13)) * 0.1 * (walk > 0 && walk < 1 ? 1 : 0), mount = ramp(t, 65.7, 0.9, outBack), pull = ramp(t, 66.9, 0.7), look2 = ramp(t, 67.9, 0.4);
  W.helper.g.position.set(lerp(-5.5, -2.95, walk), hop, 3.7);
  W.helper.g.rotation.y = 0.3;
  W.helper.arms[0].rotation.z = lerp(0.2, 2.1, ramp(t, 64.1, 0.4));
  W.helper.arms[1].rotation.z = -0.5;
  W.helper.look(0.07, 0.04);
  W.helper.rod.visible = W.helper.block.visible = false;
  W.crate.position.set(-4.3, 0, 4.9);
  W.toolbox.position.set(-4.3, 1, 4.9);
  W.toolbox.rotation.y = 0.12;
  W.tags.forEach((g, i) => {
    g.position.y = -0.9 + 0.9 * ramp(t, [63.15, 63.75, 64.5][i], 0.35, outBack);
  });
  W.floorPulley.visible = mount > 0;
  W.floorPulley.position.set(-2.1, 3 * (1 - mount) * 0.5, 3.7);
  W.floorPulley.scale.setScalar(Math.max(1e-3, Math.min(mount, 1)));
  W.me.g.position.x = -0.5;
  W.me.g.rotation.y = -0.25;
  W.me.arms[1].rotation.z = lerp(-0.4, -1.7, pull);
  W.me.arms[0].rotation.z = lerp(0.3, 0.7, pull);
  W.me.look(lerp(0.02, -0.07, look2), 0.03);
  W.helper.look(lerp(0.07, 0.1, look2), 0.04);
  const slip = bump(t, 68.55, 0.75) * 0.34, wander = lerp(1.9, 0.75, pull) + Math.sin(u * 1.4) * 0.05 * (1 - pull) + slip;
  aim(W, wander, [rp[0] - 0.75 + (wander - 0.75) * 0.9, rp[1] + 0.6, rp[2] - 0.3], { angle: 0.5, i: 190, beam: 0.16 });
  const h = handOf(W, W.me), via = [[-3, 4.6, 4.1], [-2.17, 3.22, 3.74], [-1.9, 3.1, 3.72], h];
  W.setRope([...ropeHead(wander), ...mixTail(TAIL_FLOOR, via, ramp(t, 66.3, 0.6))]);
  extra(W, 0, [-3.6, 6, 11], [-3, 2.4, 3.7], 0.3, 70);
  extra(W, 1, [-4.6, 6, 9.5], [-4.3, 1.9, 4.9], 0.2, 90);
  W.hemi.intensity = 0.44;
  W.fill.intensity = 0.2;
  return (c, Pj) => ring(c, Pj, W, rp, 0.92, sm(t, 63.4, 0.6), null, 0);
}
function S12(W, t, u0) {
  W.board.visible = true;
  W.fix.visible = W.track.visible = W.pulley.visible = W.dowels.visible = false;
  W.backBoard.visible = false;
  W.sides[1].visible = W.sides[-1].visible = W.outerSides[1].visible = W.outerSides[-1].visible = false;
  spot(W, [-3.6, 8.5, 7.4], [0, 0, 3.3], 0.62, 300);
  W.hemi.intensity = 0.6;
  u0.vig.value = 0.5;
  [72.45, 74.15, 75.35].forEach((a, i) => {
    const card = W.board.children[1 + i * 2], pin = W.board.children[2 + i * 2], k = ramp(t, a, 0.4), p = ramp(t, a + 0.32, 0.22, inQ);
    card.rotation.z = Math.PI * (1 - k);
    card.position.y = 0.08 + Math.sin(k * Math.PI) * 1.2 + (k < 1 ? 0 : 0);
    pin.visible = p > 0;
    pin.position.y = 0.13 + 2.6 * (1 - p);
  });
  return () => {
  };
}
function S13(W, t) {
  studySet(W);
  W.pro.visible = W.title.visible = W.deskProps.visible = true;
  W.tv.visible = W.dowels.visible = false;
  const rp = reportPoint(W), u = step(t);
  W.me.arms[0].rotation.z = 0.7;
  W.me.arms[1].rotation.z = -1.25 + Math.sin(u * 2.3) * 0.05;
  W.me.look(0.06, 0);
  W.me.g.rotation.y = 0.1;
  const w1 = Math.sin(u * 1.1) * 0.13 + Math.sin(u * 2.7 + 1) * 0.06, fx = 1.05 + w1 * 0.6;
  aim(W, fx, [rp[0] - 0.4 + w1, rp[1] + 0.3, rp[2] - 0.1], { angle: 0.36, i: 240, beam: 0.24 });
  W.setRope([...ropeHead(fx), ...handTail(handOf(W, W.me))]);
  W.room.position.set(-3, 9, 40);
  W.room.intensity = lerp(0.35, 0.95, sm(t, 77, 3.5));
  W.hemi.intensity = 0.5;
  return (c, Pj) => ring(c, Pj, W, rp, 0.86, 1, null, 0);
}
var SHOTS = [[7.2, S01], [13.2, S02], [17.7, S03], [22.9, S04], [28.3, S05], [35.8, S06], [42.6, S07], [49.5, S08], [56.9, S09], [62.8, S10], [69.5, S11], [76.5, S12], [85.1, S13]];
var PAPER = [];
function paperBG(base, seed, holes = false) {
  return bake(`paperbg-${base.slice(1)}-${seed}-${holes ? 1 : 0}`, 1920, 1080, (g) => drawPaperBG(g, base, seed, holes));
}
function drawPaperBG(g, base, seed, holes) {
  const r = rng(seed), dark = base === "#2C2824";
  g.fillStyle = base;
  g.fillRect(0, 0, 1920, 1080);
  for (let i = 0; i < 70; i++) {
    const x = r() * 1920, y = r() * 1080, R = 60 + r() * 220, gr = g.createRadialGradient(x, y, 0, x, y, R);
    gr.addColorStop(0, `rgba(120,90,55,${0.02 + r() * 0.03})`);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(x - R, y - R, 2 * R, 2 * R);
  }
  for (let i = 0; i < 2600; i++) {
    const x = r() * 1920, y = r() * 1080, a = r() * 6.3, L = 4 + r() * 16;
    g.strokeStyle = r() < 0.55 ? `rgba(255,248,235,${(dark ? 0.02 : 0.1) + r() * (dark ? 0.05 : 0.12)})` : `rgba(80,55,30,${0.04 + r() * 0.06})`;
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
    g.stroke();
  }
  if (holes) {
    g.fillStyle = "#2A2420";
    for (const y of [250, 830]) {
      let x = 30;
      while (x < 1900) {
        g.beginPath();
        g.arc(x, y, 26, 0, 7);
        g.fill();
        x += 78 + (r() < 0.17 ? 150 + r() * 120 : r() * 18);
      }
    }
  }
  const v = g.createRadialGradient(960, 540, 380, 960, 540, 1150);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(40,25,10,.22)");
  g.fillStyle = v;
  g.fillRect(0, 0, 1920, 1080);
}
async function setup(ctx) {
  await loadBaked();
  PAPER[0] = paperBG("#EAE0CE", 8);
  PAPER[1] = paperBG("#B98A57", 9);
  PAPER[2] = paperBG("#2C2824", 10);
  PAPER[3] = paperBG("#F1E7D3", 12, true);
  const stage = await prepareStage(ctx, async (b) => {
    b.renderer.shadowMap.enabled = true;
    b.renderer.shadowMap.type = b.THREE.PCFShadowMap;
    b.renderer.outputColorSpace = b.THREE.LinearSRGBColorSpace;
    b.renderer.toneMapping = b.THREE.NoToneMapping;
    b.scene.background = new b.THREE.Color(854536);
    b.camera.near = 0.1;
    b.camera.far = 200;
    const world = buildWorld(b.THREE, b.scene, b.renderer);
    noteRot.length = 0;
    for (const g of world.back.children) noteRot.push(g.rotation.y);
    world.v3 = (x, y, z) => new b.THREE.Vector3(x, y, z);
    await b.renderer.compileAsync?.(b.scene, b.camera);
    return world;
  }, { fov: 30, toneMapping: "none" });
  const post = makePost(stage.THREE, stage.renderer, ctx.width, ctx.height);
  stage.renderer.setRenderTarget(post.rt);
  stage.renderer.render(stage.scene, stage.camera);
  stage.renderer.setRenderTarget(null);
  ctx.assets.film = { stage, post };
  storeBaked();
}
function project(W, cam, p) {
  const v = W.v.set(p[0], p[1], p[2]).project(cam);
  return [(v.x + 1) / 2 * 1920, (1 - v.y) / 2 * 1080, v.z < 1];
}
function renderFrame(ctx, time, p = {}) {
  STOP = p.motion !== "smooth";
  const { stage, post } = ctx.assets.film, W = stage.objects, cam = stage.camera, t = Math.min(time, BEATS.duration - 1e-3);
  const s3 = Math.min(ctx.renderScale, 1), pw = Math.max(1, Math.round(ctx.width * s3)), ph = Math.max(1, Math.round(ctx.height * s3));
  if (stage.surface.width !== pw || stage.surface.height !== ph) stage.renderer.setSize(pw, ph, false);
  post.resize(pw, ph, ctx.width);
  cam.aspect = ctx.width / ctx.height;
  const u = post.mat.uniforms;
  reset(W, u);
  const after = SHOTS.find(([end]) => t < end)[1](W, t, u);
  const c0 = cameraAt(t);
  cam.up.set(...c0.up ?? [0, 1, 0]);
  cam.position.set(...c0.p);
  cam.fov = c0.fov;
  cam.lookAt(...c0.q);
  if (c0.roll) cam.rotateZ(c0.roll);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  stage.scene.updateMatrixWorld(true);
  u.focus.value = c0.focus;
  u.aperture.value = c0.ap;
  u.seed.value = Math.floor(t * 30) % 97;
  for (const l of [W.amber, W.glow, W.room]) {
    l.shadow.autoUpdate = l.intensity > 0;
  }
  post.render(stage.scene, cam);
  ctx.withCanvas((c) => {
    c.imageSmoothingQuality = "high";
    c.drawImage(stage.surface, 0, 0, ctx.width, ctx.height);
    after(c, (q) => project(W, cam, q));
    flats(c, t);
    overlay(c, t);
  });
}
function chalk(c, s, x, y, o = {}) {
  if ((o.alpha ?? 1) <= 0) return;
  c.save();
  if (o.shadow !== false) {
    c.shadowColor = "rgba(0,0,0,.75)";
    c.shadowBlur = 8;
  }
  text(c, s, x, y, { ...T.chalk, size: o.size ?? T.chalk.size, color: o.color ?? C.gold, align: o.align ?? "left", alpha: o.alpha ?? 1 });
  c.restore();
}
function ring(c, Pj, W, q, rWorld, k, label, labelK) {
  if (k <= 0) return;
  const [x, y] = Pj(q), [x1, y1] = Pj([q[0] + rWorld, q[1], q[2]]), r = Math.hypot(x1 - x, y1 - y);
  c.save();
  c.strokeStyle = C.gold;
  c.lineWidth = 5;
  c.setLineDash([22, 14]);
  c.lineCap = "round";
  c.shadowColor = "rgba(0,0,0,.5)";
  c.shadowBlur = 6;
  c.beginPath();
  c.ellipse(x, y, r, r * 0.86, -0.05, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
  c.stroke();
  c.restore();
  if (label) chalk(c, label, x, y - r * 0.86 - 30, { align: "center", alpha: labelK });
}
function flats(c, t) {
  for (const [a, b, dir, sheet] of FLATS) {
    if (t <= a || t >= b) continue;
    const k = (t - a) / (b - a), e = k < 0.46 ? -(1 - out(k / 0.46)) : k > 0.54 ? ((k - 0.54) / 0.46) ** 3 : 0, d = e * 1.06;
    const dx = dir === "right" ? d * 1920 : dir === "left" ? -d * 1920 : 0, dy = dir === "down" ? d * 1080 : dir === "up" ? -d * 1080 : 0;
    c.save();
    c.shadowColor = "rgba(8,6,4,.6)";
    c.shadowBlur = 50;
    c.drawImage(PAPER[sheet], dx, dy, 1920, 1080);
    c.restore();
  }
}
function overlay(c, t) {
  const kick = KICKERS.find(([a, b]) => t >= a - 0.1 && t < b);
  if (kick) {
    const [a, b, s, s2, right, y0] = kick, k = fadeIn(t, a, b), y = y0 ?? 150, x = right ? 1770 : 150;
    if (!y0) {
      const g = c.createLinearGradient(0, 0, 0, 300);
      g.addColorStop(0, `rgba(14,11,8,${0.5 * k})`);
      g.addColorStop(1, "rgba(14,11,8,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 1920, 300);
    }
    c.save();
    c.shadowColor = "rgba(0,0,0,.6)";
    c.shadowBlur = 8;
    text(c, s, x, y - (1 - k) * 6, { ...T.kicker, alpha: k, align: right ? "right" : "left", tracking: y0 ? 5 : T.kicker.tracking });
    c.globalAlpha = k;
    c.fillStyle = C.amber;
    c.fillRect(right ? x - 60 : x, y + 22, 60, 3);
    c.globalAlpha = 1;
    if (s2) text(c, s2, x, y + 66, { ...T.note, alpha: k, align: right ? "right" : "left" });
    c.restore();
  }
  const subOn = SUBS.some(([a, b]) => t >= a - 0.15 && t < b + 0.6);
  if (subOn) {
    const g = c.createLinearGradient(0, 780, 0, 1080);
    g.addColorStop(0, "rgba(14,11,8,0)");
    g.addColorStop(1, "rgba(14,11,8,.55)");
    c.fillStyle = g;
    c.fillRect(0, 780, 1920, 300);
  }
  SUBS.forEach(([a, b, s], i) => {
    const next = SUBS[i + 1]?.[0] ?? Infinity, end = Math.min(b + 0.6, next - 0.08);
    if (t < a - 0.15 || t > end) return;
    const k = at(t, a - 0.15, a + 0.1, out) * (1 - at(t, end - 0.18, end, io));
    c.save();
    c.shadowColor = "rgba(10,8,6,.6)";
    c.shadowBlur = 16;
    text(c, s, 960, 1e3 + (1 - k) * 8, { ...T.sub, alpha: k });
    c.restore();
  });
  {
    const k = fadeIn(t, 70.2, 76.3, 0.5, 0.25);
    if (k > 0) {
      c.save();
      c.shadowColor = "rgba(0,0,0,.7)";
      c.shadowBlur = 8;
      text(c, "\u8A55\u4F30\u8ACB\u627E\u5C08\u696D\u4EBA\u54E1", 960, 92, { ...T.note, align: "center", alpha: k, tracking: 4 });
      c.restore();
    }
  }
  if (t > 82) {
    const k = fadeIn(t, 82.1, 84.7, 0.6, 0.4);
    const g = c.createLinearGradient(0, 860, 0, 1080);
    g.addColorStop(0, "rgba(14,11,8,0)");
    g.addColorStop(1, `rgba(14,11,8,${0.6 * k})`);
    c.fillStyle = g;
    c.fillRect(0, 860, 1920, 220);
    text(c, "\u672C\u7247\u70BA\u79D1\u666E\u5167\u5BB9\uFF0C\u4E0D\u80FD\u53D6\u4EE3\u5C08\u696D\u8A55\u4F30\u3002", 960, 990, { ...T.end, alpha: k });
    text(c, "Made with Mografy", 1824, 1040, { ...T.credit, alpha: k * 0.8 });
  }
  const black = Math.max(t < 0.7 ? 1 : 0, at(t, 84.3, 85, io));
  if (black > 0) {
    c.fillStyle = `rgba(10,8,6,${black})`;
    c.fillRect(0, 0, 1920, 1080);
  }
}
export {
  BEATS,
  meta,
  params,
  renderFrame,
  setup
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vcGFja2FnZXMvcnVudGltZS9zcmMvbWF0aC50cyIsICIuLi8uLi9wYWNrYWdlcy9ydW50aW1lL3NyYy9tb3Rpb24udHMiLCAiLi4vLi4vcGFja2FnZXMvcnVudGltZS9zcmMvZmlsbS50cyIsICIuLi8uLi9wYWNrYWdlcy9ydW50aW1lL3NyYy9sYXllcnMudHMiLCAic2NlbmVzL3RocmVlLnRzIiwgInNjZW5lcy93b3JsZC50cyIsICJzY2VuZXMvbWFpbi50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFBTyxJQUFNLFFBQVEsQ0FBQyxHQUFXLE1BQU0sR0FBRyxNQUFNLE1BQU0sS0FBSyxJQUFJLEtBQUssS0FBSyxJQUFJLEtBQUssQ0FBQyxDQUFDO0FBQzdFLElBQU0sS0FBSyxDQUFDLEdBQVcsT0FBZSxRQUFnQixRQUFRLFFBQVMsS0FBSyxNQUFNLElBQUksSUFBSyxPQUFPLElBQUksVUFBVSxNQUFNLE1BQU07QUFDNUgsSUFBTSxPQUFPLENBQUMsR0FBVyxHQUFXLE1BQWMsS0FBSyxJQUFJLEtBQUs7QUFDaEUsSUFBTSxPQUFPLE9BQU8sT0FBTztFQUNoQyxRQUFRLENBQUMsTUFBYztFQUN2QixRQUFRLENBQUMsTUFBYyxJQUFJO0VBQzNCLFVBQVUsQ0FBQyxNQUFjLEtBQUssSUFBSSxNQUFNO0VBQ3hDLFlBQVksQ0FBQyxNQUFjLElBQUksTUFBTSxJQUFJLEtBQUssSUFBSSxLQUFLLEtBQUssSUFBSSxNQUFNLElBQUk7RUFDMUUsU0FBUyxDQUFDLE1BQWMsTUFBTSxJQUFJLElBQUksSUFBSSxNQUFNLE1BQU07O0VBRXRELFVBQVUsQ0FBQyxNQUFjLEtBQUssSUFBSSxNQUFNOztFQUV4QyxVQUFVLENBQUMsTUFBYyxLQUFLLElBQUksTUFBTTtFQUN4QyxZQUFZLENBQUMsTUFBYyxJQUFJLE1BQU0sSUFBSSxLQUFLLElBQUksS0FBSyxLQUFLLElBQUksTUFBTSxJQUFJOztFQUUxRSxXQUFXLENBQUMsTUFBYyxNQUFNLE1BQU0sS0FB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U0FBSyxTQUFTLElBQUksS0FBSyxLQUFLO0FBQUEsRUFDdkg7QUFDQSxJQUFFLE9BQU8sSUFBSSxNQUFNLFVBQVUsVUFBVSxLQUFLLEdBQUcsS0FBSSxNQUFLLENBQUM7QUFBRyxJQUFFLEtBQUssYUFBYTtBQUFNLElBQUUsS0FBSyxPQUFPLFFBQVEsSUFBSSxNQUFNLElBQUk7QUFBRyxJQUFFLEtBQUssT0FBTyxPQUFPLE9BQU87QUFBSSxJQUFFLEtBQUssT0FBTyxPQUFPLE1BQU07QUFBSSxJQUFFLEtBQUssT0FBTyxPQUFPO0FBQVEsSUFBRSxLQUFLLE9BQU8sYUFBYTtBQUFLLElBQUUsS0FBSyxPQUFPLFNBQVM7QUFBRyxRQUFNLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxNQUFNO0FBQ2xULElBQUUsUUFBUSxJQUFJLE1BQU0sVUFBVSxVQUFVLEdBQUcsR0FBRyxNQUFLLEtBQUksQ0FBQztBQUFHLElBQUUsTUFBTSxhQUFhO0FBQU0sSUFBRSxNQUFNLE9BQU8sUUFBUSxJQUFJLE1BQU0sSUFBSTtBQUFHLElBQUUsTUFBTSxPQUFPLE9BQU8sT0FBTztBQUFJLElBQUUsTUFBTSxPQUFPLE9BQU8sTUFBTTtBQUFJLElBQUUsTUFBTSxPQUFPLE9BQU87QUFBUSxJQUFFLE1BQU0sT0FBTyxhQUFhO0FBQUssSUFBRSxNQUFNLE9BQU8sU0FBUztBQUFHLFFBQU0sSUFBSSxFQUFFLE9BQU8sRUFBRSxNQUFNLE1BQU07QUFDMVQsSUFBRSxPQUFPLElBQUksTUFBTSxXQUFXLFVBQVUsR0FBRyxHQUFHLENBQUM7QUFBRyxJQUFFLEtBQUssYUFBYTtBQUFNLElBQUUsS0FBSyxPQUFPLFFBQVEsSUFBSSxNQUFNLElBQUk7QUFBRyxJQUFFLEtBQUssT0FBTyxPQUFPO0FBQVEsSUFBRSxLQUFLLE9BQU8sYUFBYTtBQUFLLElBQUUsS0FBSyxPQUFPLFNBQVM7QUFBRyxRQUFNLElBQUksRUFBRSxJQUFJO0FBQzFOLElBQUUsU0FBUyxJQUFJLE1BQU0sV0FBVyxVQUFVLEdBQUcsR0FBRyxDQUFDO0FBQUcsUUFBTSxJ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QU0sRUFBRSxJQUFJO0FBQUcsUUFBRSxTQUFTLElBQUksS0FBSyxNQUFLLEdBQUcsQ0FBQztBQUFHLFVBQUksR0FBRyxJQUFJLE1BQU0saUJBQWlCLE9BQU0sT0FBTSxNQUFNLENBQUMsR0FBRyxPQUFPLEdBQUcsTUFBSyxDQUFDO0FBQUcsWUFBTSxJQUFJLE1BQU0sS0FBSyxLQUFLLENBQUMsR0FBRyxHQUFHLE1BQU07QUFBRSxVQUFFLFVBQVUsWUFBWSxVQUFVLEVBQUUsTUFBTSxHQUFHLENBQUMsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUcsVUFBRSxZQUFZO0FBQVcsVUFBRSxPQUFPLGFBQWEsS0FBSztBQUFLLFVBQUUsWUFBWTtBQUFVLFVBQUUsZUFBZTtBQUFVLFVBQUUsU0FBUyxLQUFLLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQztBQUFBLE1BQUcsQ0FBQztBQUFHLFlBQU0sSUFBSSxJQUFJLEdBQUcsSUFBSSxNQUFNLFlBQVksTUFBSyxNQUFLLEtBQUksR0FBRyxJQUFJLE1BQU0scUJBQXFCLEVBQUUsS0FBSyxHQUFHLFdBQVcsSUFBRyxDQUFDLEdBQUcsS0FBSyxNQUFLLEtBQUksQ0FBQztBQUFBLElBQUc7QUFDbGlCLFNBQUssZ0JBQU0sS0FBSyxFQUFFO0FBQUcsU0FBSyxnQkFBTSxNQUFNLENBQUM7QUFBRyxTQUFLLHNCQUFPLEtBQUksRUFBRTtBQUFHLE1BQUUsS0FBSyxTQUFTLEdBQUcsRUFBRSxFQUFFLFNBQVMsSUFBSTtBQUFBLEVBQU07QUFDM0c7QUFBRSxVQUFNLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBSyxDQUFDLEdBQUcsQ0FBQyxNQUFLLElBQUcsR0FBRyxDQUFDLE1BQUssR0FBRSxHQUFHLENBQUMsTUFBSyxJQUFHLEdBQUcsQ0FBQyxNQUFLLElBQUcsR0FBRyxDQUFDLE1BQUssSUFBRyxHQUFHLENBQUMsTUFBSyxDQUFHLEdBQUcsQ0FBQyxLQUFJLEdBQUcsR0FBRyxDQUFDLE1BQUssSUFBSSxHQUFHLENBQUMsR0FBSSxHQUFHLENBQUMsRUFBRSxJQUFJLE9BQUssSUFBSSxNQUFNLFFBQVEsR0FBRyxDQUFDLENBQUM7QUFDekssVUFBTSxJQUFJLE1BQU0sR0FBRztBQUFHLE1BQUUsU0FBUztBQUFHLFVBQU0sSUFBSSxJQUFJLEdBQUcsSUFBSSxNQUFNLGNBQWMsS0FBSyxFQUFFLEdBQUcsS0FBSztBQUFHLFVBQU0sSUFBSSxJQUFJLE1BQU0sY0FBYyxNQUFLLE1BQUssSUFBSSxJQUFJLEtBQUssRUFBRTtBQUFHLGVBQVcsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHO0FBQUUsWUFBTSxJQUFJLElBQUksR0FBRyxHQUFHLE9BQU8sS0FBSyxNQUFLLE1BQU0sQ0FBQztBQUFHLFFBQUUsU0FBUyxJQUFJLEtBQUssSUFBSSxDQUFDLEtBQUssS0FBSyxJQUFJLEtBQUssS0FBSztBQUFBLElBQUc7QUFDNVIsVUFBTSxLQUFLLElBQUksR0FBRyxJQUFJLE1BQU0sWUFBWSxLQUFJLEtBQUksR0FBRSxHQUFHLE9BQU8sR0FBRyxPQUFNLENBQUM7QUFBQSxFQUFHO0FBQzNFO0FBQUUsVUFBTSxJQUFJLE1BQU0sR0FBRztBQUFHLE1BQUUsUUFBUTtBQUFHLFVBQU0sSUFBSSxJQUFJLE1BQU0scUJBQXFCLEVBQUUsT0FBTyxVQUFVLFdBQVcsTUFBSyxXQUFXLEtBQUksQ0FBQztBQUFHLFVBQU0sSUFBSSxJQUFJLEdBQUcsSUFBSSxNQUFNLGVBQWUsS0FBSSxJQUFJLEVBQUUsR0FBRyxDQUFDO0FBQUcsTUFBRSxNQUFNLElBQUksTUFBTSxNQUFLLElBQUc7QUFDdk4sVUFBTSxNQUFNLElBQUksTUFBTSxNQUFNO0FBQUcsUUFBSSxPQUFPLEdBQUcsQ0FBQztBQUFHLFFBQUksT0FBTyxNQUFLLElBQUc7QUFBRyxRQUFJLE9BQU8sTUFBSyxDQUFDO0FBQUcsUUFBSSxPQUFPLE1BQUssS0FBSTtBQUFHLFFBQUksVUFBVTtBQUFHLGVBQVcsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHO0FBQUUsWUFBTSxJQUFJLElBQUksR0FBRyxJQUFJLEtBQUssS0FBSSxH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SUFBTSxLQUFLLEtBQUssTUFBTSxHQUFHO0FBQzlDLFVBQU0sU0FBUyxJQUFJLE1BQU0sTUFBTTtBQUFHLFdBQU8sT0FBTyxNQUFNLENBQUM7QUFBRyxXQUFPLE9BQU8sS0FBSyxDQUFDO0FBQUcsV0FBTyxPQUFPLEtBQUssR0FBRztBQUFHLFdBQU8sT0FBTyxLQUFJLEdBQUc7QUFBRyxXQUFPLE9BQU8sS0FBSSxHQUFHO0FBQUcsV0FBTyxPQUFPLE1BQUssR0FBRztBQUFHLFdBQU8sT0FBTyxNQUFLLEdBQUc7QUFBRyxXQUFPLE9BQU8sTUFBTSxHQUFHO0FBQUcsV0FBTyxVQUFVO0FBQ3ZQLFFBQUksUUFBUSxVQUFVLE1BQU0sS0FBSyxLQUFJLEdBQUssR0FBRztBQUM3QyxVQUFNLFFBQVEsSUFBSSxNQUFNLE1BQU07QUFBRyxVQUFNLE9BQU8sR0FBRyxHQUFHLEtBQUksR0FBRyxLQUFLLEtBQUssQ0FBQztBQUFHLFVBQU0sS0FBSyxJQUFJLE1BQU0sTUFBTTtBQUFHLE9BQUcsT0FBTyxLQUFJLE1BQUssTUFBSyxHQUFHLEtBQUssS0FBSyxDQUFDO0FBQUcsVUFBTUMsTUFBSyxJQUFJLE1BQU0sTUFBTTtBQUFHLElBQUFBLElBQUcsT0FBTyxNQUFLLE1BQUssTUFBSyxHQUFHLEtBQUssS0FBSyxDQUFDO0FBQ3JOLGVBQVcsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDQSxLQUFJLENBQUMsQ0FBQyxHQUFHO0FBQUUsWUFBTSxJQUFJLElBQUksR0FBRyxVQUFVLElBQU0sS0FBSyxLQUFLLEdBQUcsR0FBRztBQUFBLElBQUc7QUFDNUcsV0FBTyxHQUFHLENBQUMsSUFBTSxLQUFLLElBQUksR0FBRyxDQUFDLElBQU0sS0FBSyxJQUFJLENBQUM7QUFDOUMsVUFBTSxXQUFXLElBQUksTUFBTSxNQUFNO0FBQUcsYUFBUyxPQUFPLEdBQUcsR0FBRyxLQUFJLEdBQUcsS0FBSyxLQUFLLENBQUM7QUFBRyxRQUFJLFVBQVUsVUFBVSxL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QUFHLEtBQUssSUFBSSxPQUFPLEtBQUssSUFBSSxHQUFHO0FBQ3RGLElBQU0sTUFBVyxFQUFFLEdBQUcsQ0FBQyxLQUFJLEtBQUssSUFBSSxHQUFHLEdBQUcsQ0FBQyxHQUFHLEtBQUssR0FBRyxHQUFHLEtBQUssSUFBSSxPQUFPLE1BQU0sSUFBSSxHQUFHO0FBQ3RGLElBQU0sTUFBVyxFQUFFLEdBQUcsS0FBSyxHQUFHLENBQUMsS0FBSSxLQUFLLElBQUksR0FBRyxPQUFPLEtBQUs7QUFDM0QsSUFBTSxNQUFXLEVBQUUsR0FBRyxDQUFDLEtBQUssS0FBSyxJQUFJLEdBQUcsR0FBRyxDQUFDLEtBQUssS0FBSyxHQUFHLEdBQUcsS0FBSyxJQUFJLE9BQU8sTUFBTSxJQUFJLEdBQUc7QUFDekYsSUFBTSxNQUFXLEVBQUUsR0FBRyxDQUFDLEtBQUksS0FBSyxJQUFJLEdBQUcsR0FBRyxDQUFDLE1BQUssS0FBSyxHQUFHLEdBQUcsS0FBSyxJQUFJLE9BQU8sTUFBTSxJQUFJLEdBQUc7QUFDeEYsSUFBTSxLQUFVLEVBQUUsR0FBRyxDQUFDLEtBQUksTUFBSyxJQUFJLEdBQUcsR0FBRyxDQUFDLE1BQUssS0FBSyxHQUFHLEdBQUcsS0FBSyxJQUFJLE9BQU8sS0FBSyxJQUFJLEdBQUcsTUFBTSxLQUFJO0FBQ2hHLElBQU0sTUFBVyxFQUFFLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSSxNQUFLLElBQUksR0FBRyxPQUFPLElBQUk7QUFDekQsSUFBTSxNQUFXLEVBQUUsR0FBRyxDQUFDLE1BQU0sTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLE1BQU0sTUFBTSxJQUFJLEdBQUcsS0FBSyxJQUFJLE9BQU8sTUFBTSxJQUFJLEVBQUU7QUFDMUYsSUFBTSxNQUFXLEVBQUUsR0FBRyxDQUFDLEtBQUksTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLEtBQUksTUFBTSxJQUFJLEdBQUcsS0FBSyxJQUFJLE9BQU8sTUFBTSxJQUFJLEVBQUU7QUFDdEYsSUFBTSxNQUFXLEVBQUUsR0FBRyxDQUFDLE1BQUssS0FBSyxJQUFJLEdBQUcsR0FBRyxDQUFDLEtBQUksS0FBSyxHQUFHLEdBQUcsS0FBSyxJQUFJLE9BQU8sTUFBTSxJQUFJLEdBQUc7QUFDeEYsSUFBTSxLQUFVLEVBQUUsR0FBRyxDQUFDLEdBQUcsS0FBSyxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsTUFBTSxHQUFHLEdBQUcsS0FBSyxJQUFJLE9BQU8sS0FBSyxJQUFJLEdBQUc7QUFDbkYsSUFBTSxNQUFXLEVBQUUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEtBQUssR0FBRyxHQUFHLE9BQU8sSUFBSTtBQUN2RCxJQUFNLE1BQVcsRUFBRSxHQUFHLENBQUMsT0FBTyxLQUFLLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxNQUFNLEdBQUcsR0FBRyxLQUFLLElBQUksT0FBTyxNQUFNLElBQUksRUFBRTtBQUN4RixJQUFNLE1BQVcsRUFBRSxHQUFHLENBQUMsT0FBTyxLQUFLLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxNQUFNLEdBQUcsR0FBRyxLQUFLLElBQUksT0FBTyxNQUFNLElBQUksRUFBRTtBQUN4RixJQUFNLE1BQVcsRUFBRSxHQUFHLENBQUMsS0FBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsS0FBSSxHQUFLLEdBQUcsR0FBRyxLQUFLLElBQUksT0FBTyxHQUFLLElBQUksRUFBRTtBQUNyRixJQUFNLE1BQVcsRUFBRSxHQUFHLENBQUMsS0FBSSxLQUFLLElBQUksR0FBRyxHQUFHLENBQUMsTUFBSyxNQUFNLEdBQUcsR0FBRyxLQUFLLElBQUksT0FBTyxNQUFNLElBQUksSUFBSTtBQUMxRixJQUFNLE1BQVcsRUFBRSxHQUFHLENBQUMsR0FBRyxLQUFLLElBQUksR0FBRyxHQUFHLENBQUMsR0FBRyxLQUFLLEdBQUcsR0FBRyxLQUFLLElBQUksT0FBTyxNQUFNLElBQUksRUFBRTtBQUNwRixJQUFNLE1BQVcsRUFBRSxHQUFHLENBQUMsR0FBRyxLQUFLLElBQUksR0FBRyxHQUFHLENBQUMsR0FBRyxLQUFLLEdBQUcsR0FBRyxLQUFLLElBQUksT0FBTyxNQUFN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QUFHLENBQUMsTUFBTSxHQUFHO0FBQUEsRUFDM0csQ0FBQyxNQUFNLEdBQUc7QUFBQSxFQUFHLENBQUMsTUFBTSxHQUFHO0FBQUEsRUFBRyxDQUFDLE1BQU0sR0FBRztBQUFBLEVBQUcsQ0FBQyxNQUFNLEdBQUc7QUFBQSxFQUFHLENBQUMsTUFBTSxFQUFFO0FBQUEsRUFBRyxDQUFDLE1BQU0sR0FBRztBQUFBLEVBQzFFLENBQUMsTUFBTSxHQUFHO0FBQUEsRUFBRyxDQUFDLE1BQU0sR0FBRztBQUFBLEVBQ3ZCLENBQUMsTUFBTSxHQUFHO0FBQUEsRUFBRyxDQUFDLE1BQU0sR0FBRztBQUFBLEVBQUcsQ0FBQyxNQUFNLEdBQUc7QUFBQSxFQUFHLENBQUMsTUFBTSxHQUFHO0FBQUEsRUFDakQsQ0FBQyxNQUFNLEdBQUc7QUFBQSxFQUFHLENBQUMsTUFBTSxHQUFHO0FBQUEsRUFBRyxDQUFDLE1BQU0sR0FBRztBQUFBLEVBQUcsQ0FBQyxNQUFNLEdBQUc7QUFBQSxFQUNqRCxDQUFDLE1BQU0sR0FBRztBQUFBLEVBQUcsQ0FBQyxNQUFNLEdBQUc7QUFBQSxFQUFHLENBQUMsTUFBTSxHQUFHO0FBQUEsRUFBRyxDQUFDLE1BQU0sR0FBRztBQUFBLEVBQUcsQ0FBQyxPQUFPLEdBQUc7QUFBQSxFQUFHLENBQUMsTUFBTSxHQUFHO0FBQUEsRUFDNUUsQ0FBQyxNQUFNLElBQUk7QUFBQSxFQUFHLENBQUMsTUFBTSxJQUFJO0FBQUEsRUFBRyxDQUFDLE1BQU0sSUFBSTtBQUFBLEVBQUcsQ0FBQyxNQUFNLElBQUk7QUFBQSxFQUNyRCxDQUFDLE1BQU0sSUFBSTtBQUFBLEVBQUcsQ0FBQyxNQUFNLElBQUk7QUFBQSxFQUFHLENBQUMsTUFBTSxJQUFJO0FBQUEsRUFDdkMsQ0FBQyxNQUFNLElBQUksRUFBRSxDQUFDO0FBQUEsRUFBRyxDQUFDLE1BQU0sSUFBSSxFQUFFLENBQUM7QUFBQSxFQUFHLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQztBQUFBLEVBQUcsQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDO0FBQUEsRUFBRyxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUM7QUFBQSxFQUFHLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQztBQUFBLEVBQUcsQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDO0FBQUEsRUFBRyxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUM7QUFBQSxFQUNqSixDQUFDLE1BQU0sSUFBSTtBQUFBLEVBQUcsQ0FBQyxNQUFNLElBQUk7QUFBQSxFQUFHLENBQUMsTUFBTSxJQUFJO0FBQUEsRUFBRyxDQUFDLElBQUksSUFBSTtBQUNyRDtBQUNBLFNBQVMsU0FBUyxHQUFnQjtBQUNoQyxNQUFJLElBQUk7QUFBRyxTQUFPLElBQUksR0FBRyxTQUFTLEtBQUssR0FBRyxJQUFJLENBQUMsRUFBRyxDQUFDLEtBQUssRUFBRztBQUMzRCxRQUFNLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLEdBQUksS0FBSyxHQUFHLElBQUksQ0FBQztBQUNyQyxNQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsTUFBTSxHQUFJLFFBQU87QUFDaEMsUUFBTSxJQUFJLEdBQUcsT0FBTyxJQUFJLE9BQU8sR0FBRyxDQUFDLElBQUksR0FBRyxDQUFDO0FBQzNDLFNBQU8sRUFBRSxHQUFHLEtBQUssRUFBRSxHQUFHLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxHQUFHLEdBQUcsS0FBSyxFQUFFLEdBQUcsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLEdBQUcsS0FBSyxLQUFLLEVBQUUsS0FBSyxHQUFHLENBQUMsRUFBRSxLQUFLLENBQUMsR0FBRyxPQUFPLEtBQUssRUFBRSxPQUFPLEdBQUcsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxHQUFHLElBQUksS0FBSyxFQUFFLElBQUksR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsTUFBTSxLQUFLLEVBQUUsUUFBUSxHQUFHLEdBQUcsQ0FBQyxFQUFFLFFBQVEsR0FBRyxDQUFDLEdBQUcsSUFBSSxFQUFFLEdBQUc7QUFDeE47QUFHQSxJQUFNLFVBQW9CLENBQUM7QUFDM0IsSUFBTSxPQUFPLEVBQUUsR0FBRyxDQUFDLEdBQUcsR0FBRyxHQUFHLEVBQVE7QUFDcEMsSUFBTSxNQUFNLENBQUMsTUFBTSxNQUFNLElBQUc7QUFBNUIsSUFBd0MsS0FBSyxDQUFDLE9BQU8sR0FBRyxHQUFHO0FBQzNELFNBQVMsTUFBTSxHQUFVLElBQU87QUFDOUIsUUFBTSxPQUFPLENBQUMsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsYUFBYSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLEdBQUcsR0FBRyxFQUFFLE9BQU8sR0FBRyxFQUFFLElBQUksR0FBRyxHQUFHLEVBQUUsT0FBTyxJQUFJLENBQUMsTUFBUyxFQUFFLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLElBQUk7QUFDaFUsYUFBVyxLQUFLLEtBQU0sR0FBRSxVQUFVO0FBQ2xDLGFBQVcsS0FBSyxDQUFDLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsTUFBTSxDQUFDLEdBQUcsRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUFFLFdBQVcsQ0FBQyxHQUFHLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxTQUFTLENBQUMsR0FBRyxFQUFFLFNBQVMsRUFBRyxHQUFFLFVBQVU7QUFDbk0sSUFBRSxLQUFLLFlBQVk7QUFBSyxJQUFFLEtBQUssUUFBUTtBQUFJLElBQUUsS0FBSyxXQUFXO0FBQUssSUFBRSxLQUFLLE1BQU0sSUFBSSxRQUFRO0FBQzNGLElBQUUsTUFBTSxZQUFZO0FBQUcsSUFB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SUFBSSxFQUFFLFFBQVEsSUFBSyxLQUFJLEVBQUUsSUFBSSxDQUFDLElBQUssUUFBUSxFQUFFLENBQUMsSUFBSyxPQUFPLEVBQUUsQ0FBQyxJQUFLLEVBQUUsSUFBSSxDQUFDLElBQUssSUFBSSxHQUFHO0FBQUUsUUFBSSxFQUFFLElBQUksQ0FBQztBQUFJLFFBQUksRUFBRSxDQUFDO0FBQUEsRUFBSTtBQUFFLFNBQU8sQ0FBQyxHQUFHLENBQUM7QUFBRyxHQUFHO0FBRS9QLElBQU0sU0FBUyxNQUFNO0FBQUUsUUFBTSxJQUFJLElBQUksQ0FBQyxHQUFHLE9BQU8sQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBUyxDQUFDLEdBQUcsSUFBUyxDQUFDO0FBQUcsV0FBUyxJQUFJLEdBQUcsSUFBSSxJQUFJLEtBQUs7QUFBRSxVQUFNLElBQUksUUFBTyxJQUFJO0FBQUssUUFBSSxLQUFLLFNBQVMsQ0FBQyxHQUFHO0FBQUUsUUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLEdBQUcsT0FBTyxFQUFFLElBQUksTUFBSyxHQUFHLE1BQU0sRUFBRSxJQUFJLEtBQUksS0FBSyxFQUFFLElBQUksT0FBTSxJQUFHO0FBQUcsUUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLElBQUksS0FBSSxHQUFHLE1BQUssR0FBRyxLQUFLLElBQUksTUFBSyxJQUFJLElBQUc7QUFBQSxJQUFHLE9BQU87QUFBRSxZQUFNLEtBQUssS0FBSyxFQUFFLElBQUksT0FBTSxNQUFLLEtBQUssTUFBTSxFQUFFLElBQUksS0FBSSxNQUFNLEVBQUUsSUFBSSxPQUFNO0FBQUssUUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLEdBQUcsS0FBSyxHQUFHLEtBQUssSUFBSSxJQUFHO0FBQUcsUUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLElBQUksR0FBRyxNQUFLLEdBQUcsSUFBSSxHQUFHO0FBQUEsSUFBRztBQUFBLEVBQUU7QUFBRSxTQUFPLEVBQUUsR0FBRyxFQUFFO0FBQUcsR0FBRztBQUM3ZSxJQUFNLFFBQWdDLEVBQUUsR0FBRyxNQUFNLEdBQUcsTUFBTSxHQUFHLE1BQU0sR0FBRyxPQUFPLEdBQUcsTUFBTTtBQUN0RixJQUFNLE9BQStCLEVBQUUsR0FBRyxNQUFNLEdBQUcsR0FBSztBQUd4RCxTQUFTLElBQUksR0FBVSxHQUFpQjtBQUN0QyxXQUFTLENBQUM7QUFBRyxRQUFNLEtBQUssWUFBWSxDQUFDLEdBQUcsUUFBUSxJQUFJLE1BQUssSUFBSSxJQUFJLE9BQU0sSUFBSSxJQUFJLE9BQU0sTUFBSztBQUMxRixRQUFNLE9BQU8sS0FBSyxHQUFHLEtBQUssR0FBRTtBQUM1QixJQUFFLEdBQUcsS0FBSyxDQUFDLEVBQUUsU0FBUyxJQUFJLEtBQUssS0FBSSxNQUFLLElBQUk7QUFBRyxJQUFFLEdBQUcsS0FBSyxDQUFDLEVBQUUsU0FBUyxJQUFJLEtBQUssTUFBSyxNQUFLLElBQUk7QUFBRyxJQUFFLEdBQUcsS0FBSyxPQUFNLE1BQU0sS0FBSyxNQUFLLE9BQU0sSUFBSSxDQUFDO0FBQUcsSUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJO0FBQUksSUFBRSxHQUFHLEtBQUssU0FBUyxJQUFJLFFBQU8sT0FBTyxLQUFLLEdBQUcsQ0FBQyxJQUFJO0FBQ3ZOLE1BQUksR0FBRyxLQUFJLEtBQUssSUFBSSxDQUFDLEtBQU8sR0FBRyxDQUFDLEdBQUcsTUFBSyxHQUFHLENBQUMsR0FBRyxPQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsT0FBTyxLQUFJLEdBQUcsTUFBTSxPQUFPLE1BQU0sTUFBSyxNQUFNLENBQUM7QUFDaEgsSUFBRSxLQUFLLG9CQUFvQixJQUFJO0FBQU8sSUFBRSxLQUFLLFlBQVksS0FBSyxNQUFLLE1BQUssS0FBSztBQUFHLElBQUUsS0FBSyxZQUFZLE9BQU07QUFDekcsSUFBRSxRQUFRLENBQUMsR0FBRyxTQUFTLEdBQUUsR0FBRyxHQUFHLFVBQVUsQ0FBQztBQUMxQyxTQUFPLE1BQU07QUFBQSxFQUFDO0FBQ2hCO0FBQ0EsU0FBUyxJQUFJLEdBQVUsR0FBaUI7QUFDdEMsV0FBUyxDQUFDO0FBQUcsUUFBTSxLQUFLLFlBQVksQ0FBQyxHQUFHLElBQUksS0FBSyxDQUFDO0FBQ2xELFFBQU0sS0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLElBQUksS0FBSSxHQUFHLENBQUMsSUFBSSxHQUFFLEdBQUcsS0FBUyxDQUFDLE1BQU0sTUFBTSxHQUFFLEdBQUcsTUFBVSxDQUFDLE9BQU8sS0FBSyxHQUFHO0FBQ3pHLFFBQU0sS0FBSyxLQUFLLEdBQUcsTUFBTSxJQUFJLEdBQUcsS0FBSyxLQUFLLEdBQUcsTUFBTSxJQUFHLEdBQUcsT0FBTyxLQUFLLEdBQUcsS0FBSyxJQUFHLEdBQUcsU0FBUyxLQUFLLEdBQUcsT0FBTyxHQUFFO0FBQzdHLFFBQU0sTUFBTSxLQUFLLEdBQUcsS0FBSyxJQUFHLElBQUksT0FBTSxLQUFLLEdBQUcsS0FBSyxJQUFHLElBQUksS0FBSSxRQUFRLEtBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxRQUFPLElBQUk7QUFDckcsUUFBTSxLQUFLLEtBQUssS0FBSyxLQUFJLEtBQUssRUFBRSxJQUFJLE1BQU0sT0FBTyxNQUFNLEVBQUU7QUFDekQsTUFBSSxHQUFHLElBQUksS0FBSyxLQUFLLElBQUksSUFBSSxFQUFFLEdBQUcsS0FBSyxFQUFFLEdBQUcsRUFBRSxPQUFPLEtBQUssS0FBSyxLQUFJLE1BQUssRUFBRSxHQUFHLEtBQUksRUFBRSxHQUFHLEdBQUcsS0FBSyxLQUFLLEtBQUssS0FBSyxFQUFFLEdBQUcsSUFBSSxFQUFFLEdBQUcsTUFBTSxJQUFHLENBQUM7QUFDckksSUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJLEtBQUssS0FBSyxPQUFNLE1BQUssSUFBSSxHQUFHLE9BQU0sTUFBTTtBQUFHLElBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxLQUFLLEtBQUssS0FBSSxPQUFNLElBQUksR0FBRyxNQUFLLE1BQU07QUFDekgsSUFBRSxHQUFHLEtBQUssU0FBUyxJQUFJLEtBQUssUUFBUSxPQUFNLE1BQU0sT0FBTSxPQUFNLE1BQU07QUFDbEUsSUFBRSxHQUFHLEtBQUssQ0FBQyxFQUFFLFNBQVMsSUFBSSxLQUFLLEtBQUssTUFBSyxNQUFNLElBQUksR0FBRyxNQUFLLE1BQU07QUFBRyxJQUFFLEdBQUcsS0FBSyxDQUFDLEVBQUUsU0FBUyxJQUFJLEtBQUssS0FBSyxNQUFLLEdBQUcsSUFBSSxHQUFHLE1BQUssTUFBTTtBQUNsSSxJQUFFLEdBQUcsS0FBSyxLQUFLLFFBQU8sTUFBTSxPQUFNLE1BQU0sR0FBRyxLQUFLLE9BQU0sTUFBTSxPQUFNLE1BQU0sQ0FBQztBQUN6RSxRQUFNLElBQUksT0FBTyxHQUFHLEVBQUUsRUFBRSxHQUFHLE9BQU8sU0FBUyxJQUFJLFFBQVEsU0FBUyxDQUFDLEdBQUcsVUFBVSxNQUFNLElBQUksUUFBUSxZQUFZLFNBQVMsQ0FBQyxHQUFHLElBQUk7QUFDN0gsSUFBRSxRQUFRLENBQUMsR0FBRyxTQUFTLEtBQUssSUFBSSxJQUFJLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDO0FBQ3BELFFBQU0sSUFBSSxLQUFLLEdBQUcsTUFBTSxHQUFHO0FBQUcsTUFBSSxHQUFHLENBQUM7QUFDdEMsSUFBRSxNQUFNLG9CQUFvQixLQUFLLE1BQUssR0FBRyxFQUFFO0FBQUcsSUFBRSxPQUFPLFNBQVMsSUFBSSxNQUFNLEdBQUcsR0FBRztBQUFHLElBQUUsT0FBTyxZQUFZLElBQUk7QUFDNUcsUUFBTSxHQUFHLEdBQUcsS0FBSyxDQUFDLE1BQU0sS0FBSyxFQUFFLEdBQUcsQ0FBQyxLQUFJLEtBQUssRUFBRSxHQUFHLEVBQUUsR0FBRyxLQUFLLENBQUMsTUFBSyxLQUFLLEdBQUcsR0FBRyxDQUFDLE1BQUssS0FBSyxHQUFHLEdBQUcsRUFBRSxHQUFHLEtBQUksS0FBSyxLQUFLLE1BQU0sSUFBSSxFQUFFLENBQUM7QUFDN0gsSUFBRSxLQUFLLFlBQVksS0FBSyxLQUFLLE1BQUssTUFBSyxJQUFJLEdBQUcsS0FBSSxFQUFFO0FBQUcsSUFBRSxLQUFLLFlBQVksS0FBSyxNQUFLLEtBQUksSUFBSTtBQUM1RixTQUFPLENBQUMsR0FBRyxPQUFPO0FBQUUsU0FBSyxHQUFHLElBQUksR0FBRyxJQUFJLE1BQUssR0FBRyxHQUFHLE1BQU0sSUFBRyxHQUFHLGtDQUFTLE9BQU8sR0FBRyxLQUFLLEVBQUUsQ0FBQztBQUFBLEVBQUc7QUFDOUY7QUFDQSxTQUFTLElBQUksR0FBVSxHQUFpQjtBQUN0QyxXQUFTLENBQUM7QUFBRyxJQUFFLE9BQU8sVUFBVTtBQUFNLFFBQU0sTUFBTSxLQUFLLEdBQUcsTUFBTSxNQUFLLEdBQUcsR0FBRyxLQUFLLFlBQVksQ0FBQztBQUM3RixJQUFFLElBQUksU0FBUyxLQUFLLElBQUk7QUFBSyxJQUFFLEdBQUcsU0FBUyxLQUFLLElBQUk7QUFBSyxJQUFFLElBQUksVUFBVSxFQUFFLEdBQUcsVUFBVSxNQUFNO0FBQUcsTUFBSSxHQUFHLENBQUM7QUFBRyxJQUFFLE1BQU0sb0JBQW9CLElBQUksT0FBTTtBQUNsSixRQUFNLElBQUksS0FBSyxHQUFHLE1BQU0sR0FBRTtBQUMxQixNQUFJLEdBQUcsS0FBSyxNQUFNLE1BQU0sQ0FBQyxHQUFHLEtBQUssQ0FBQyxPQUFPLEtBQUssR0FBRyxHQUFHLENBQUMsTUFBSyxLQUFLLEdBQUcsR0FBRyxDQUFDLEdBQUcsRUFBRSxPQUFPLEtBQUssS0FBSSxNQUFLLENBQUMsR0FBRyxHQUFHLEtBQUssSUFBSSxLQUFLLENBQUMsR0FBRyxNQUFNLElBQUcsQ0FBQztBQUFHLElBQUUsS0FBSyxNQUFNLElBQUksUUFBUTtBQUMvSixJQUFFLFFBQVEsQ0FBQyxHQUFHLFNBQVMsSUFBSSxHQUFHLEdBQUcsUUFBUSxVQUFVLFdBQVcsQ0FBQyxDQUFDLENBQUM7QUFDakUsUUFBTSxPQUFPLENBQUMsT0FBTyxPQUFPLE1BQU0sS0FBSztBQUFHLE1BQUksU0FBUztBQUN2RCxJQUFFLE1BQU0sUUFBUSxDQUFDLEdBQU0sTUFBYztBQUNuQyxVQUFNLElBQUksS0FBSyxHQUFHLEtBQUssQ0FBQyxHQUFJLE1BQUssT0FBTyxHQUFHLE1BQU0sS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLElBQUs7QUFDdEUsTUFBRSxFQUFFLFNBQVMsSUFBSSxFQUFFLElBQUksT0FBTyxJQUFJO0FBQ2xDLE1BQUUsRUFBRSxTQUFTLElBQUksRUFBRSxNQUFNLE1BQU0sSUFBSSxLQUFLLElBQUksTUFBTSxDQUFDLElBQUksT0FBTSxLQUFLLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSTtBQUNwRixRQUFJLElBQUksRUFBRyxXQUFVLEtBQUssR0FBRyxLQUFLLENBQUMsSUFBSyxNQUFLLEdBQUU7QUFBQSxFQUNqRCxDQUFDO0FBQ0QsUUFBTSxLQUFLLEtBQUssR0FBRyxNQUFNLEdBQUU7QUFBRyxJQUFFLE1BQU0sQ0FBQyxFQUFFLEVBQUUsU0FBUyxJQUFJLEtBQUssRUFBRSxNQUFNLENBQUMsRUFBRSxLQUFLLEtBQUssSUFBSSxFQUFFLE1BQU0sQ0FBQyxFQUFFLElBQUksRUFBRTtBQUN2RyxJQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksS0FBSyxPQUFNLE1BQUssQ0FBQztBQUFHLElBQUUsR0FBRyxFQUFFLFNBQVMsSUFBSSxLQUFLLE1BQUssR0FBRyxDQUFDO0FBQUcsSUFBRSxHQUFHLEtBQUssTUFBTSxJQUFJLElBQUksU0FBUztBQUFLLElBQUUsR0FBRyxLQUFLLFNBQVMsSUFBSSxPQUFNLEtBQUssR0FBRyxNQUFNLEdBQUUsSUFBSTtBQUFLLElBQUUsR0FBRyxLQUFLLENBQUMsRUFBRSxTQUFTLElBQUk7QUFBSSxJQUFFLEdBQUcsS0FBSyxDQUFDLEVBQUUsU0FBUyxJQUFJO0FBQUssSUFBRSxHQUFHLEtBQUssR0FBRyxLQUFLLE1BQUssT0FBTSxLQUFLLEdBQUcsTUFBTSxHQUFFLENBQUMsSUFBSSxLQUFLLEdBQUcsTUFBTSxHQUFFLElBQUksSUFBRztBQUMvUyxRQUFNLEdBQUcsR0FBRyxDQUFDLE1BQU0sS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEtBQUssR0FBRyxHQUFHLEtBQUksRUFBRTtBQUFHLElBQUUsS0FBSyxZQUFZO0FBQzFFLE9BQUs7QUFBSSxTQUFPLE1BQU07QUFBQSxFQUFDO0FBQ3pCO0FBQ0EsU0FBUyxJQUFJLEdBQVUsR0FBaUI7QUFDdEMsSUFBRSxJQUFJLFVBQVUsRUFBRSxVQUFVLFVBQVU7QUFBTSxJQUFFLElBQUksVUFBVSxFQUFFLE1BQU0sVUFBVSxFQUFFLE9BQU8sVUFBVTtBQUNqRyxRQUFNLE9BQU8sSUFBSTtBQUFNLElBQUUsTUFBTSxVQUFVO0FBQ3pDLE1BQUksS0FBTSxZQUFXLEtBQUssRUFBRSxTQUFVLEdBQUUsRUFBRSxTQUFTLElBQUksRUFBRSxJQUFJLEtBQUssSUFBSSxLQUFLLEdBQUcsT0FBTyxFQUFFLElBQUksS0FBSyxHQUFFO0FBQ2xHLE9BQUssR0FBRyxDQUFDLEtBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEtBQUssSUFBSSxHQUFHLEtBQUksR0FBRztBQUM3QyxRQUFNLEdBQUcsR0FBRyxDQUFDLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssR0FBRSxHQUFHLEtBQUksS0FBSyxHQUFHLEdBQUcsTUFBTSxDQUFDLENBQUM7QUFBRyxJQUFFLEtBQUssWUFBWTtBQUFJLElBQUUsS0FBSyxZQUFZO0FBQzFHLElBQUUsVUFBVSxTQUFTLENBQUMsRUFBRSxTQUFTLElBQUk7QUFDckMsTUFBSSxJQUFJLEtBQU0sVUFBUyxHQUFHLElBQUksS0FBSyxHQUFHLE9BQU8sSUFBRyxDQUFDO0FBQ2pELFNBQU8sQ0FBQyxHQUFHLE9BQU87QUFDaEIsVUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEdBQUcsQ0FBQyxNQUFNLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxHQUFHLENBQUMsTUFBTSxNQUFNLElBQUksQ0FBQyxHQUFHLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSTtBQUN0RyxVQUFNLEtBQUssT0FBTyxHQUFHLE1BQU0sTUFBTSxLQUFJLEdBQUU7QUFDdkMsUUFBSSxLQUFLLEdBQUc7QUFBRSxZQUFNLENBQUMsSUFBSSxFQUFFLElBQUksR0FBRyxDQUFDLE1BQU0sTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUks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YyxFQUFFO0FBQU0sTUFBRSxZQUFZO0FBQUcsTUFBRSxVQUFVO0FBQUcsTUFBRSxPQUFPLEVBQUUsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLElBQUksRUFBRTtBQUFHLE1BQUUsT0FBTyxFQUFFLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQyxJQUFJLEVBQUU7QUFBRyxNQUFFLE9BQU87QUFBRyxNQUFFLFFBQVE7QUFBQSxFQUM1SztBQUNGO0FBQ0EsU0FBUyxJQUFJLEdBQVUsR0FBaUI7QUFDdEMsSUFBRSxJQUFJLFVBQVUsRUFBRSxLQUFLLFVBQVUsRUFBRSxPQUFPLFVBQVUsRUFBRSxNQUFNLFVBQVU7QUFBTSxJQUFFLElBQUksVUFBVSxFQUFFLE1BQU0sVUFBVSxFQUFFLE9BQU8sVUFBVTtBQUNqSSxRQUFNLE9BQU8sS0FBSyxHQUFHLE1BQU0sR0FBRyxHQUFHLE9BQU8sS0FBSyxHQUFHLE1BQU0sR0FBRyxHQUFHLElBQUksS0FBSyxLQUFLLEtBQUssTUFBTSxJQUFJLEdBQUcsTUFBSyxJQUFJLEdBQUcsSUFBSSxLQUFLLEtBQUssR0FBRyxLQUFJLElBQUksR0FBRyxLQUFJLElBQUk7QUFDNUksSUFBRSxPQUFPLFNBQVMsSUFBSSxHQUFHLEtBQUksQ0FBQztBQUFHLElBQUUsT0FBTyxNQUFNLFVBQVUsQ0FBQztBQUFHLElBQUUsTUFBTSxTQUFTLElBQUksR0FBRyxLQUFJLEdBQUc7QUFBRyxJQUFFLE1BQU0sTUFBTSxVQUFVLEdBQUU7QUFBRyxJQUFFLE1BQU0sU0FBUyxJQUFJLEtBQUksS0FBSSxJQUFHO0FBQzdKLE9BQUssR0FBRyxDQUFDLEtBQUssS0FBSyxJQUFJLElBQUksR0FBRyxDQUFDLEdBQUcsS0FBSSxDQUFDLEdBQUcsTUFBSyxHQUFHO0FBQ2xELFFBQU0sR0FBRyxHQUFHLENBQUMsTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsS0FBSSxHQUFHLEdBQUcsTUFBSyxHQUFHO0FBQUcsUUFBTSxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLEdBQUcsR0FBRyxLQUFJLEVBQUU7QUFBRyxJQUFFLEtBQUssWUFBWTtBQUNySCxTQUFPLENBQUMsR0FBRyxPQUFPO0FBQ2hCLFVBQU0sSUFBSSxHQUFHLEdBQUcsTUFBTSxHQUFFLEdBQUcsSUFBSSxPQUFPLEdBQUcsSUFBTSxNQUFNLEtBQUksSUFBRztBQUFHLFFBQUksS0FBSyxFQUFHO0FBQzNFLFVBQU0sSUFBSSxHQUFHLENBQUMsR0FBRyxLQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsTUFBSyxDQUFDLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLEtBQUssSUFBSSxJQUFJLE1BQUssS0FBSyxFQUFFLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQztBQUN4RyxNQUFFLEtBQUs7QUFBRyxNQUFFLGNBQWM7QUFBRyxNQUFFLGNBQWMsRUFBRTtBQUFNLE1BQUUsWUFBWTtBQUFHLE1BQUUsWUFBWSxDQUFDLElBQUksRUFBRSxDQUFDO0FBQUcsTUFBRSxVQUFVO0FBQVMsTUFBRSxjQUFjO0FBQWtCLE1BQUUsYUFBYTtBQUFHLE1BQUUsVUFBVTtBQUNwTCxNQUFFLE9BQU8sS0FBSyxJQUFJLE1BQUssRUFBRTtBQUFHLE1BQUUsT0FBTyxLQUFLLElBQUksTUFBSyxFQUFFO0FBQUcsTUFBRSxPQUFPLEtBQUssSUFBSSxNQUFLLEtBQUssSUFBSSxJQUFHO0FBQUcsTUFBRSxPQUFPLEtBQUssSUFBSSxNQUFLLEtBQUssSUFBSSxJQUFHO0FBQUcsTUFBRSxpQkFBaUIsS0FBSyxJQUFJLEtBQUksS0FBSyxJQUFJLE1BQUssS0FBSyxHQUFHLEtBQUssQ0FBQztBQUFHLE1BQUUsT0FBTyxLQUFLLEdBQUcsS0FBSyxDQUFDO0FBQUcsTUFBRSxpQkFBaUIsS0FBSyxJQUFJLEtBQUksS0FBSyxJQUFJLE1BQUssS0FBSyxJQUFJLE1BQUssS0FBSyxJQUFJLElBQUc7QUFBRyxNQUFFLE9BQU8sS0FBSyxJQUFJLE1BQUssS0FBSyxJQUFJLElBQUc7QUFBRyxNQUFFLE9BQU87QUFBRyxNQUFFLFFBQVE7QUFDcFcsVUFBTSxHQUFHLGtDQUFTLEtBQUssSUFBSSxJQUFJLEtBQUssSUFBSSxNQUFLLEVBQUUsT0FBTyxFQUFFLENBQUM7QUFBRyxVQUFNLEdBQUcsd0NBQVUsS0FBSyxJQUFJLE1BQUssS0FBSyxJQUFJLEtBQUksRUFBRSxPQUFPLEVBQUUsT0FBTyxNQUFNLElBQUksT0FBTyxFQUFFLENBQUM7QUFBQSxFQUNsSjtBQUNGO0FBQ0EsU0FBUyxJQUFJLEdBQVUsR0FBaUI7QUFDdEMsSUFBRSxJQUFJLFVBQVU7QUFBTSxXQUFTLENBQUM7QUFBRyxJQUFFLE1BQU0sVUFBVSxFQUFFLEtBQUssVUFBVSxFQUFFLElBQUksVUFBVTtBQUFNLElBQUUsR0FBRyxVQUFVO0FBQzNHLFFBQU0sS0FBSyxLQUFLLEdBQUcsT0FBTyxJQUFHLEdBQUcsSUFBSSxLQUFLLENBQUM7QUFDMUMsTUFBSSxHQUFHLEtBQUssR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUN6QixJQUFFLEdBQUcsRUFBRSxTQUFTLElBQUksTUFBTSxHQUFHLElBQUk7QUFBRyxJQUFFLEdBQUcsRUFBRSxTQUFTLElBQUk7QUFBSSxJQUFFLEdBQUcsS0FBSyxDQUFDLEVBQUUsU0FBUyxJQUFJLEtBQUssT0FBTyxLQUFLLElBQUksSUFBSSxDQUFDLElBQUksTUFBSyxLQUFJLEVBQUU7QUFBRyxJQUFFLEdBQUcsS0FBSyxDQUFDLEVBQUUsU0FBUyxJQUFJLEtBQUssT0FBTSxLQUFLLElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxNQUFLLE1BQUssRUFBRTtBQUFHLElBQUUsR0FBRyxLQUFLLEtBQUssTUFBSyxLQUFJLEVBQUUsR0FBRyxLQUFLLE9BQU0sS0FBSSxFQUFFLENBQUM7QUFBRyxJQUFFLEdBQUcsS0FBSyxTQUFTLElBQUksUUFBTztBQUM1UixRQUFNLEtBQUs7QUFBSyxNQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU0sS0FBSyxJQUFJLEdBQUcsRUFBRSxPQUFPLEtBQUksR0FBRyxLQUFLLE1BQU0sSUFBRyxD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QUUsS0FBSyxTQUFTLElBQUksUUFBUSxNQUFNLEdBQUcsTUFBSyxJQUFJO0FBQzVJLElBQUUsT0FBTyxRQUFRLENBQUMsR0FBTSxNQUFjO0FBQ3BDLFVBQU0sSUFBSSxNQUFNLENBQUMsR0FBRyxJQUFJLEtBQUssQ0FBQztBQUFHLFFBQUksSUFBSSxNQUFNLFNBQVksT0FBTyxLQUFLLENBQUMsSUFBSSxLQUFLLEdBQUUsSUFBSTtBQUN2RixRQUFJLE1BQU0sT0FBVyxNQUFLLElBQUksT0FBTyxLQUFLLENBQUMsSUFBSSxLQUFLLElBQUc7QUFDdkQsTUFBRSxVQUFVLEdBQUcsTUFBTSxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxHQUFHLEdBQUcsTUFBTSxVQUFhLEtBQUssQ0FBQyxJQUFJLENBQUM7QUFBQSxFQUMxRSxDQUFDO0FBQ0QsUUFBTSxLQUFLO0FBQU0sTUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLEtBQUssRUFBRSxHQUFHLEVBQUUsT0FBTyxLQUFJLEdBQUcsS0FBSyxNQUFNLEtBQUksQ0FBQztBQUMzRSxJQUFFLFFBQVEsQ0FBQyxHQUFHLFNBQVMsRUFBRSxHQUFHLEdBQUcsU0FBUyxDQUFDO0FBQ3pDLFFBQU0sR0FBRyxHQUFHLENBQUMsS0FBSyxLQUFLLEdBQUcsR0FBRyxDQUFDLEdBQUcsS0FBSyxHQUFHLEdBQUcsTUFBSyxHQUFHO0FBQUcsUUFBTSxHQUFHLEdBQUcsQ0FBQyxLQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLEdBQUcsR0FBRyxLQUFJLEdBQUc7QUFBRyxJQUFFLEtBQUssWUFBWTtBQUN6SCxTQUFPLENBQUMsR0FBRyxPQUFPO0FBQ2hCLFFBQUksQ0FBQyxLQUFNO0FBQ1gsVUFBTSxJQUFJLEdBQUcsR0FBRyxNQUFNLEdBQUUsS0FBSyxJQUFJLEdBQUcsR0FBRyxNQUFNLEdBQUUsSUFBSSxJQUFJLEdBQUcsQ0FBQyxLQUFLLE1BQUssTUFBTSxFQUFFLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLEtBQUksR0FBSyxFQUFFLENBQUM7QUFD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RUFBRSxTQUFTLElBQUk7QUFBSSxJQUFFLE9BQU8sS0FBSyxDQUFDLEVBQUUsU0FBUyxJQUFJLEtBQUssS0FBSSxLQUFLLEtBQUssR0FBRyxNQUFNLEdBQUUsQ0FBQztBQUFHLElBQUUsT0FBTyxLQUFLLENBQUMsRUFBRSxTQUFTLElBQUk7QUFBSyxJQUFFLE9BQU8sS0FBSyxNQUFLLElBQUc7QUFBRyxJQUFFLE9BQU8sSUFBSSxVQUFVLEVBQUUsT0FBTyxNQUFNLFVBQVU7QUFDcFEsSUFBRSxNQUFNLFNBQVMsSUFBSSxNQUFNLEdBQUcsR0FBRztBQUFHLElBQUUsUUFBUSxTQUFTLElBQUksTUFBTSxHQUFHLEdBQUc7QUFBRyxJQUFFLFFBQVEsU0FBUyxJQUFJO0FBQ2pHLElBQUUsS0FBSyxRQUFRLENBQUMsR0FBTSxNQUFjO0FBQUUsTUFBRSxTQUFTLElBQUksT0FBTSxNQUFLLEtBQUssR0FBRyxDQUFDLE9BQU8sT0FBTyxJQUFJLEVBQUUsQ0FBQyxHQUFJLE1BQUssT0FBTztBQUFBLEVBQUcsQ0FBQztBQUNsSCxJQUFFLFlBQVksVUFBVSxRQUFRO0FBQUcsSUFBRSxZQUFZLFNBQVMsSUFBSSxNQUFNLEtBQUssSUFBSSxTQUFTLEtBQUksR0FBRztBQUFHLElBQUUsWUFBWSxNQUFNLFVBQVUsS0FBSyxJQUFJLE1BQU0sS0FBSyxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDaEssSUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJO0FBQUssSUFBRSxHQUFHLEVBQUUsU0FBUyxJQUFJO0FBQU0sSUFBRSxHQUFHLEtBQUssQ0FBQyxFQUFFLFNBQVMsSUFBSSxLQUFLLE1BQUssTUFBTSxJQUFJO0FBQUcsSUFBRSxHQUFHLEtBQUssQ0FBQyxFQUFFLFNBQVMsSUFBSSxLQUFLLEtBQUksS0FBSSxJQUFJO0FBQUcsSUFBRSxHQUFHLEtBQUssS0FBSyxNQUFLLE9BQU0sS0FBSyxHQUFHLElBQUc7QUFDdkwsSUFBRSxPQUFPLEtBQUssS0FBSyxNQUFLLEtBQUksS0FBSyxHQUFHLElBQUc7QUFDdkMsUUFBTSxPQUFPLEtBQUssR0FBRyxPQUFPLElBQUcsSUFBSSxNQUFLLFNBQVMsS0FBSyxLQUFLLE1BQUssSUFBSSxJQUFJLEtBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxRQUFPLElBQUksUUFBUTtBQUMvRyxNQUFJLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLFFBQU8sU0FBUyxRQUFPLEtBQUksR0FBRyxDQUFDLElBQUksS0FBSSxHQUFHLENBQUMsSUFBSSxHQUFFLEdBQUcsRUFBRSxPQUFPLEtBQUksR0FBRyxLQUFLLE1BQU0sS0FBSSxDQUFDO0FBQzVHLFFBQU0sSUFBSSxPQUFPLEdBQUcsRUFBRSxFQUFFLEdBQUcsTUFBWSxDQUFDLENBQUMsSUFBSSxLQUFLLEdBQUcsR0FBRyxDQUFDLE9BQU8sTUFBTSxJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssSUFBSSxHQUFHLENBQUM7QUFDakcsSUFBRSxRQUFRLENBQUMsR0FBRyxTQUFTLE1BQU0sR0FBRyxHQUFHLFFBQVEsWUFBWSxLQUFLLEtBQUssR0FBRyxNQUFNLEdBQUUsQ0FBQyxDQUFDLENBQUM7QUFDL0UsUUFBTSxHQUFHLEdBQUcsQ0FBQyxNQUFNLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxLQUFLLEdBQUcsR0FBRyxLQUFJLEVBQUU7QUFBRyxRQUFNLEdBQUcsR0FBRyxDQUFDLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLEtBQUssR0FBRyxHQUFHLEtBQUksRUFBRTtBQUFHLElBQUUsS0FBSyxZQUFZO0FBQUssSUFBRSxLQUFLLFlBQVk7QUFDdEosU0FBTyxDQUFDLEdBQUcsT0FBTyxLQUFLLEdBQUcsSUFBSSxHQUFHLElBQUksTUFBSyxHQUFHLEdBQUcsTUFBTSxHQUFFLEdBQUcsTUFBTSxDQUFDO0FBQ3BFO0FBQ0EsU0FBUyxJQUFJLEdBQVUsR0FBVyxJQUFhO0FBQzdDLElBQUUsTUFBTSxVQUFVO0FBQU0sSUFBRSxJQUFJLFVBQVUsRUFBRSxNQUFNLFVBQVUsRUFBRSxPQUFPLFVBQVUsRUFBRSxPQUFPLFVBQVU7QUFBTyxJQUFFLFVB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RyxNQUFFLGFBQWEsR0FBRyxpQkFBaUI7QUFBRyxNQUFFLGFBQWEsR0FBRyxnQkFBZ0IsTUFBSyxDQUFDLEdBQUc7QUFBRyxNQUFFLFlBQVk7QUFBRyxNQUFFLFNBQVMsR0FBRyxLQUFLLE1BQU0sR0FBRztBQUNwTCxTQUFLLEdBQUcsMEdBQXFCLEtBQUssS0FBSyxFQUFFLEdBQUcsRUFBRSxLQUFLLE9BQU8sRUFBRSxDQUFDO0FBQzdELFNBQUssR0FBRyxxQkFBcUIsTUFBTSxNQUFNLEVBQUUsR0FBRyxFQUFFLFFBQVEsT0FBTyxJQUFJLElBQUcsQ0FBQztBQUFBLEVBQ3pFO0FBRUEsUUFBTSxRQUFRLEtBQUssSUFBSSxJQUFJLE1BQUssSUFBSSxHQUFHLEdBQUcsR0FBRyxNQUFNLElBQU0sRUFBRSxDQUFDO0FBQzVELE1BQUksUUFBUSxHQUFHO0FBQUUsTUFBRSxZQUFZLGVBQWUsS0FBSztBQUFLLE1BQUUsU0FBUyxHQUFHLEdBQUcsTUFBTSxJQUFJO0FBQUEsRUFBRztBQUN4RjsiLAogICJuYW1lcyI6IFsiVEhSRUUiLCAiVCIsICJzdGVwIiwgInQiLCAiYzMiXQp9Cg==
