// ../../packages/runtime/dist/math.js
var clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
var pr = (t, start, end) => end === start ? t >= end ? 1 : 0 : clamp((t - start) / (end - start));
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
function spring(time, start, duration = 0.7, bounce = 0.18) {
  const t = time - start;
  if (t <= 0)
    return 0;
  if (t >= duration * 1.6)
    return 1;
  const zeta = 1 - bounce * 1.6, omega = 2 * Math.PI / (duration * 0.78);
  const wd = omega * Math.sqrt(Math.max(1e-4, 1 - zeta * zeta));
  const v = 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + zeta * omega / wd * Math.sin(wd * t));
  const tail = pr(t, duration * 1.1, duration * 1.6);
  return v + (1 - v) * ease.inOutCubic(tail);
}

// ../../packages/runtime/dist/film.js
var FILM_FRAME = /* @__PURE__ */ Symbol.for("mografy.filmFrame");
var native = (t) => "withCanvas" in t ? t.canvas : t;
function filmFrame(c, width, height, base = new DOMMatrix([c.canvas.width / width, 0, 0, c.canvas.height / height, 0, 0])) {
  const frame = { base, inverse: base.inverse(), width, height, hidden: false, effects: false };
  c[FILM_FRAME] = frame;
  return frame;
}
function frameOf(c) {
  const tagged = c[FILM_FRAME];
  if (tagged)
    return tagged;
  const identity = new DOMMatrix();
  return { base: identity, inverse: identity, width: c.canvas.width, height: c.canvas.height, hidden: false, effects: false };
}
function deviceTransform(t) {
  const c = native(t), f = frameOf(c), m = c.getTransform();
  return f.hidden ? f.base.multiply(m) : m;
}
function devScale(t) {
  const m = deviceTransform(t);
  return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
}
function setDevice(c, f, m) {
  c.setTransform(f.hidden ? f.inverse.multiply(m) : m);
}
var frameScale = (f) => Math.sqrt(Math.abs(f.base.a * f.base.d - f.base.b * f.base.c)) || 1;
function keys(points) {
  const n = points.length;
  if (!n)
    throw new Error("keys needs at least one key");
  const xs = points.map((k) => k[0]), ys = points.map((k) => k[1]);
  for (let i = 1; i < n; i++)
    if (!(xs[i] > xs[i - 1]))
      throw new Error(`keys: times must increase (key ${i} at ${xs[i]})`);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++)
    d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  for (let i = 1; i < n - 1; i++)
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      m[i] = k * a * d[i];
      m[i + 1] = k * b * d[i];
    }
  }
  return (time) => {
    if (n === 1 || time <= xs[0])
      return ys[0];
    if (time >= xs[n - 1])
      return ys[n - 1];
    let i = 0;
    while (time > xs[i + 1])
      i++;
    const h = xs[i + 1] - xs[i], s = (time - xs[i]) / h, s2 = s * s, s3 = s2 * s;
    return ys[i] * (2 * s3 - 3 * s2 + 1) + m[i] * h * (s3 - 2 * s2 + s) + ys[i + 1] * (-2 * s3 + 3 * s2) + m[i + 1] * h * (s3 - s2);
  };
}
var pool = /* @__PURE__ */ new Map();
function buffer(name, width, height) {
  const w = Math.max(1, Math.ceil(width)), h = Math.max(1, Math.ceil(height)), key = `${name} ${w}\xD7${h}`;
  let b = pool.get(key);
  if (!b) {
    b = new OffscreenCanvas(w, h);
    pool.set(key, b);
    if (pool.size > 64)
      for (const old of pool.keys()) {
        if (old === key)
          continue;
        pool.delete(old);
        if (pool.size <= 48)
          break;
      }
  } else {
    pool.delete(key);
    pool.set(key, b);
  }
  const x = b.getContext("2d");
  x.reset();
  return b;
}
var EFFECT_PROPS = /* @__PURE__ */ new Set(["shadowBlur", "shadowOffsetX", "shadowOffsetY"]);
var scaleLengths = (value, k) => value === "none" ? value : value.replace(/(-?\d*\.?\d+(?:e[-+]?\d+)?)px/gi, (_, n) => `${Number(n) * k}px`);
function filmUnits(x, k) {
  return new Proxy(x, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (EFFECT_PROPS.has(String(key)))
        return Number(value) / k;
      if (key === "filter")
        return scaleLengths(String(value), 1 / k);
      return typeof value === "function" ? value.bind(target) : value;
    },
    set(target, key, value) {
      const next = EFFECT_PROPS.has(String(key)) ? Number(value) * k : key === "filter" ? scaleLengths(String(value), k) : value;
      return Reflect.set(target, key, next, target);
    }
  });
}
function frameLayer(c, name, res, bounds, margin = 0) {
  const f = frameOf(c), d = deviceTransform(c);
  const corners = (m, [x, y, w2, h2]) => [[x, y], [x + w2, y], [x, y + h2], [x + w2, y + h2]].map(([px, py]) => m.transformPoint({ x: px, y: py }));
  const box = (pts, grow) => {
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    return [Math.min(...xs) - grow, Math.min(...ys) - grow, Math.max(...xs) + grow, Math.max(...ys) + grow];
  };
  const full = box(corners(f.base, [0, 0, f.width, f.height]), 0);
  let [x0, y0, x1, y1] = bounds ? box(corners(d, bounds), margin) : full;
  x0 = Math.floor(Math.max(x0, full[0]));
  y0 = Math.floor(Math.max(y0, full[1]));
  x1 = Math.ceil(Math.min(x1, full[2]));
  y1 = Math.ceil(Math.min(y1, full[3]));
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  const canvas = buffer(name, w * res, h * res), raw = canvas.getContext("2d");
  const toLayer = new DOMMatrix([res, 0, 0, res, -x0 * res, -y0 * res]);
  raw.setTransform(toLayer.multiply(d));
  const tag = filmFrame(raw, f.width, f.height, toLayer.multiply(f.base));
  tag.effects = true;
  return { canvas, ctx: filmUnits(raw, frameScale(tag)), frame: f, rect: [x0, y0, w, h], res };
}
function composite(c, canvas, l, alpha, mode = "source-over") {
  const f = l.frame, [x, y, w, h] = l.rect;
  c.save();
  try {
    setDevice(c, f, new DOMMatrix());
    c.globalAlpha *= clamp(alpha);
    c.globalCompositeOperation = mode;
    c.filter = "none";
    c.shadowColor = "transparent";
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = l.res < 1 ? "low" : "high";
    c.drawImage(canvas, 0, 0, canvas.width, canvas.height, x, y, w, h);
  } finally {
    c.restore();
  }
}
function layer(t, name, alpha, draw, o = {}) {
  const c = native(t);
  if (alpha <= 1e-3)
    return;
  if (alpha >= 0.999 && !o.mode && (o.res ?? 1) === 1) {
    c.save();
    try {
      draw(c);
    } finally {
      c.restore();
    }
    return;
  }
  const l = frameLayer(c, `layer:${name}`, o.res ?? 1, o.bounds, 2);
  draw(l.ctx);
  composite(c, l.canvas, l, alpha, o.mode);
}
function blurLayer(t, name, radius, draw, o = {}) {
  const c = native(t), f = frameOf(c), alpha = o.alpha ?? 1;
  if (alpha <= 1e-3)
    return;
  const px = radius * (o.frameUnits ? frameScale(f) : devScale(c));
  if (px < 0.3) {
    layer(c, name, alpha, draw, { ...o.mode ? { mode: o.mode } : {}, ...o.bounds ? { bounds: o.bounds } : {} });
    return;
  }
  const res = o.res ?? (px > 48 ? 0.25 : px > 12 ? 0.5 : 1);
  const a = frameLayer(c, `blur:${name}:a`, res, o.bounds, px * 3);
  draw(a.ctx);
  const b = buffer(`blur:${name}:b`, a.canvas.width, a.canvas.height), bx = b.getContext("2d");
  bx.filter = `blur(${(px * res).toFixed(2)}px)`;
  bx.drawImage(a.canvas, 0, 0);
  composite(c, b, a, alpha, o.mode);
}
function bloom(t, draw, o = {}) {
  const c = native(t), k = (o.strength ?? 1) * c.globalAlpha;
  if (k <= 1e-3)
    return;
  const res = o.res ?? 0.25, wide = (o.halo ?? 0.75) > 1e-3, device = (o.radius ?? 16) * devScale(c);
  const a = frameLayer(c, "bloom:a", res, o.bounds, device * (wide ? 3.4 : 1) * 3);
  draw(a.ctx);
  const pass = (radius, alpha) => {
    if (alpha <= 1e-3)
      return;
    const b = buffer("bloom:b", a.canvas.width, a.canvas.height), bx = b.getContext("2d");
    bx.filter = `blur(${Math.max(0.6, radius * res).toFixed(2)}px)`;
    bx.drawImage(a.canvas, 0, 0);
    c.save();
    try {
      c.globalAlpha = 1;
      composite(c, b, a, alpha, o.mode ?? "lighter");
    } finally {
      c.restore();
    }
  };
  pass(device, k);
  if (wide)
    pass(device * 3.4, k * (o.halo ?? 0.75));
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
  const THREE = await pending.catch((error) => {
    loaded.delete(url);
    throw new Error(`Three.js failed to load from ${o.library ?? "assets/three.module.js"}. Copy extras/three/three.module.js into the project's assets/. (${String(error)})`);
  });
  const width = o.width ?? ctx.width, height = o.height ?? ctx.height;
  const surface = new OffscreenCanvas(width, height);
  const gl = surface.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: o.antialias ?? true, preserveDrawingBuffer: true });
  if (!gl) throw new Error("WebGL 2 is unavailable in this browser, so the 3D layer cannot render.");
  const renderer = new THREE.WebGLRenderer({ canvas: surface, context: gl, alpha: true, premultipliedAlpha: true, antialias: o.antialias ?? true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = o.toneMapping === "none" ? THREE.NoToneMapping : o.toneMapping === "agx" ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = o.exposure ?? 1;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(o.fov ?? 35, width / height, 0.1, 1e3);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  const objects = await build({ THREE, scene, camera, renderer, setup: ctx });
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  return { THREE, scene, camera, objects, width, height, renderer, surface };
}

// scenes/paper.ts
var W = 1920;
var H = 1080;
var TAU = Math.PI * 2;
var C = {
  ivory: "#FFF7EB",
  pink: "#F8A3C8",
  lav: "#B99BDD",
  violet: "#9977BD",
  plum: "#30122E",
  moon: "#FFE49B",
  rose: "#CC528B",
  gold: "#E2B055",
  gold2: "#B8862F",
  wood: "#6E4634",
  gun0: "#070C26",
  gun1: "#0E1A4F",
  gun2: "#1C2F7A",
  gun3: "#3A56A8",
  gun4: "#7E9AD6",
  red: "#C8344F"
};
var SERIF = '"LPC Serif TC", serif';
var LAT = '"Inter Display", sans-serif';
var clamp2 = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
var lerp = (a, b, t) => a + (b - a) * t;
var ease2 = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
var eo = (t) => 1 - Math.pow(1 - t, 3);
var P = (t, a, b) => clamp2((t - a) / (b - a));
var on2 = (t) => Math.floor(t * 12 + 1e-6) / 12;
function rng(seed) {
  let s = seed >>> 0;
  return () => (s = s * 1664525 + 1013904223 >>> 0) / 4294967296;
}
function cv(w, h) {
  return new OffscreenCanvas(Math.ceil(w), Math.ceil(h));
}
var g2 = (c) => c.getContext("2d");
var GRAIN;
function makeGrain() {
  const c = cv(1024, 1024), g = g2(c), d = g.createImageData(1024, 1024), r = rng(7);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 128 + (r() - 0.5) * 70;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  g.globalAlpha = 0.08;
  g.strokeStyle = "#fff";
  g.lineWidth = 1;
  for (let i = 0; i < 900; i++) {
    const x = r() * 1024, y = r() * 1024, a = r() * TAU, l = 6 + r() * 22;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  return c;
}
function grain(g, w, h, a = 0.12, mode = "overlay", ox = 0, oy = 0) {
  g.save();
  g.globalCompositeOperation = mode;
  g.globalAlpha = a;
  for (let y = -oy; y < h; y += 1024) for (let x = -ox; x < w; x += 1024) g.drawImage(GRAIN, x, y);
  g.restore();
}
function grainIn(g, w, h, a = 0.15) {
  const m = cv(w, h);
  g2(m).drawImage(g.canvas, 0, 0);
  grain(g, w, h, a, "soft-light");
  g.save();
  g.globalCompositeOperation = "destination-in";
  g.drawImage(m, 0, 0);
  g.restore();
}
function starPath(g, x, y, r, r2 = r * 0.45, n = 5, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? r2 : r, a = rot + i * Math.PI / n;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
}
function vtext(g, text, x, y, size, col, lh = 1.08) {
  g.save();
  g.font = `700 ${size}px ${SERIF}`;
  g.fillStyle = col;
  g.textAlign = "center";
  g.textBaseline = "middle";
  let yy = y;
  for (const ch of text) {
    if ("\uFF0C\u3002\u3001".includes(ch)) g.fillText(ch, x + size * 0.32, yy - size * 0.28);
    else if (ch === "\u2026") {
      g.save();
      g.translate(x, yy);
      g.rotate(Math.PI / 2);
      g.fillText(ch, 0, 0);
      g.restore();
    } else g.fillText(ch, x, yy);
    yy += size * lh;
  }
  g.restore();
  return yy;
}
function recolor(src, mode) {
  const w = src.width, h = src.height, c = cv(w, h), g = g2(c);
  g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, w, h), p = d.data;
  const A = [48, 18, 46], M = [185, 155, 221], L = [246, 238, 252];
  for (let i = 0; i < p.length; i += 4) {
    if (mode === "sil") {
      p[i] = 26;
      p[i + 1] = 16;
      p[i + 2] = 56;
      continue;
    }
    const l = (p[i] * 0.3 + p[i + 1] * 0.55 + p[i + 2] * 0.15) / 255;
    const [a, b] = l < 0.55 ? [A, M] : [M, L], t = l < 0.55 ? l / 0.55 : (l - 0.55) / 0.45;
    p[i] = a[0] + (b[0] - a[0]) * t;
    p[i + 1] = a[1] + (b[1] - a[1]) * t;
    p[i + 2] = a[2] + (b[2] - a[2]) * t;
  }
  g.putImageData(d, 0, 0);
  return c;
}
function dieCut(img, scale, border, mode) {
  const iw = Math.round(img.width * scale), ih = Math.round(img.height * scale), pad = border + 6, w = iw + pad * 2, h = ih + pad * 2;
  const base = cv(w, h);
  g2(base).drawImage(img, pad, pad, iw, ih);
  const art = mode === "plain" ? base : recolor(base, mode);
  const out = cv(w, h), g = g2(out);
  if (border > 0) {
    const ring = cv(w, h), r = g2(ring);
    for (let a = 0; a < 24; a++) r.drawImage(art, Math.cos(a / 24 * TAU) * border, Math.sin(a / 24 * TAU) * border);
    r.globalCompositeOperation = "source-in";
    r.fillStyle = "#FFFBF4";
    r.fillRect(0, 0, w, h);
    g.drawImage(ring, 0, 0);
  }
  g.drawImage(art, 0, 0);
  if (mode === "duo") {
    grain(g, w, h, 0.1, "soft-light");
    const m = cv(w, h), mg = g2(m);
    mg.translate(w, 0);
    mg.scale(-1, 1);
    mg.drawImage(out, 0, 0);
    return m;
  }
  return out;
}
function duoImage(img, sx, sy, sw, sh, scale = 1) {
  const c = cv(sw * scale, sh * scale);
  g2(c).drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return recolor(c, "duo");
}
var POSES = ["char", "happy", "moonlight", "sad", "mooncake", "arrival", "lantern", "rhythm"];
var FILES = {
  turn: "portrait-turnaround.png",
  end: "end-stage.png",
  mark: "lunar-pop-rabbit-mark-v1.webp",
  starmap: "lunar-rabbit-star-map-bg-v1.webp",
  garden: "lunar-rabbit-lantern-garden-bg-v1.webp",
  nightfoot: "lunar-rabbit-night-sky-footer-v1.webp",
  stagev2: "momo-moon-rabbit-stage-v2.webp",
  paper: "momo-paper-bg.webp",
  happy: "momo-moon-rabbit-hero-happy-v2.webp",
  moonlight: "momo-moon-rabbit-moonlight-v1.webp",
  sad: "momo-moon-rabbit-practice-sad.webp",
  mooncake: "momo-moon-rabbit-mooncake-v1.webp",
  arrival: "momo-moon-rabbit-arrival-v1.webp",
  lantern: "momo-moon-rabbit-lantern-dance-v1.webp",
  rhythm: "momo-moon-rabbit-rhythm-v1.webp"
};
function tinted(img, col, a, blur, bright, w = W, h = H, pad = 60, crop) {
  const c = cv(w, h), g = g2(c);
  g.filter = `blur(${blur}px) brightness(${bright})`;
  if (crop) g.drawImage(img, crop[0], crop[1], crop[2], crop[3], -pad, -pad * 0.6, w + pad * 2, h + pad * 1.2);
  else g.drawImage(img, -pad, -pad * 0.6, w + pad * 2, h + pad * 1.2);
  g.filter = "none";
  g.globalCompositeOperation = "color";
  g.globalAlpha = a;
  g.fillStyle = col;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 1;
  grain(g, w, h, 0.1, "soft-light");
  return c;
}
function chapterCard(k, n) {
  const c = cv(W, H), g = g2(c);
  const bgs = [[C.gun1, C.gun2], ["#3a0f33", C.rose], [C.gun2, C.lav]][n - 1];
  const gr = g.createLinearGradient(0, 0, W, H);
  gr.addColorStop(0, bgs[0]);
  gr.addColorStop(1, bgs[1]);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  const r = rng(20 + n);
  for (let i = 0; i < 40; i++) {
    starPath(g, r() * W, r() * H, 6 + r() * 18);
    g.fillStyle = r() < 0.5 ? C.gold : "rgba(255,255,255,.6)";
    g.fill();
  }
  g.fillStyle = "rgba(255,228,155,.95)";
  g.beginPath();
  g.arc(1300, 560, 380, 0, TAU);
  g.fill();
  const F = k.pose[["arrival", "mooncake", "rhythm"][n - 1]].front, fh = 1e3, fw = fh * F.width / F.height;
  g.save();
  g.shadowColor = "rgba(10,0,30,.45)";
  g.shadowBlur = 30;
  g.shadowOffsetX = 14;
  g.shadowOffsetY = 14;
  g.drawImage(F, 1300 - fw / 2, 50, fw, fh);
  g.restore();
  g.save();
  g.shadowColor = "rgba(0,0,0,.35)";
  g.shadowBlur = 24;
  g.shadowOffsetY = 10;
  g.drawImage(k.img.paper, 150, 150, 520, 780);
  g.restore();
  g.strokeStyle = C.gold;
  g.lineWidth = 6;
  g.strokeRect(176, 176, 468, 728);
  g.fillStyle = C.plum;
  g.font = `600 140px ${LAT}`;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.fillText("0" + n, 410, 330);
  vtext(g, ["\u767B\u5834", "\u9B45\u529B", "\u7BC0\u62CD"][n - 1], 410, 470, 130, C.plum);
  g.fillStyle = C.rose;
  g.font = `600 26px ${LAT}`;
  g.letterSpacing = "6px";
  g.fillText(["FIRST APPEARANCE", "IRRESISTIBLE CHARM", "FIND YOUR RHYTHM"][n - 1], 410, 850);
  g.letterSpacing = "0px";
  grain(g, W, H, 0.16);
  return c;
}
async function bakeKit(ctx) {
  const img = {};
  await Promise.all(Object.entries(FILES).map(async ([k, f]) => {
    img[k] = await ctx.loadImage("assets/" + f);
  }));
  GRAIN = makeGrain();
  const pose = {};
  const NEEDS_BACK = /* @__PURE__ */ new Set(["moonlight", "sad", "mooncake"]);
  for (const k of POSES) {
    if (k === "char") continue;
    const im = img[k], s = 960 / Math.max(im.width, im.height);
    const front = dieCut(im, s, 11, "plain");
    pose[k] = { front, back: NEEDS_BACK.has(k) ? dieCut(im, s, 11, "duo") : front, sil: k === "moonlight" ? dieCut(im, s * 0.5, 0, "sil") : front };
  }
  const T = img.turn, half = T.width / 2;
  const kit0 = { img, pose };
  const bg = {
    garden: tinted(img.garden, "#2340b0", 0.55, 16, 0.55),
    starmap: tinted(img.starmap, "#2846c0", 0.5, 0, 1.15, W, H, 80),
    stagev2: tinted(img.stagev2, "#b0306a", 0.25, 10, 0.7, W, H, 80),
    starNight: tinted(img.starmap, "#2a48c8", 0.55, 0, 1.15, 2048, 1152, 0, [0, img.starmap.height * 0.18, img.starmap.width * 0.6, img.starmap.height * 0.6 * 1152 / 2048 * (img.starmap.width / img.starmap.height)]),
    footNight: tinted(img.nightfoot, "#3050d0", 0.45, 0, 1.6, 2048, 1152, 0)
  };
  const profile = duoImage(T, 0, 0, half, T.height);
  const S = img.sad, sadDuo = duoImage(S, 0, 0, S.width, Math.round(S.height * 0.66));
  {
    const g = g2(sadDuo), fg = g.createLinearGradient(0, sadDuo.height * 0.62, 0, sadDuo.height);
    fg.addColorStop(0, "rgba(0,0,0,1)");
    fg.addColorStop(1, "rgba(0,0,0,0)");
    g.globalCompositeOperation = "destination-in";
    g.fillStyle = fg;
    g.fillRect(0, 0, sadDuo.width, sadDuo.height);
  }
  const cards = [1, 2, 3].map((n) => chapterCard(kit0, n));
  const poster = cv(W, H);
  {
    const g = g2(poster);
    g.drawImage(bg.stagev2, 0, 0);
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, "rgba(14,26,79,.85)");
    gr.addColorStop(0.5, "rgba(90,22,72,.35)");
    gr.addColorStop(1, "rgba(204,82,139,.2)");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,120,150,.9)";
    g.beginPath();
    g.arc(1180, 520, 420, 0, TAU);
    g.fill();
    g.fillStyle = "rgba(255,228,155,.95)";
    g.beginPath();
    g.arc(1180, 520, 330, 0, TAU);
    g.fill();
    const F = pose.lantern.front, fh = 1080, fw = fh * F.width / F.height;
    g.save();
    g.shadowColor = "rgba(30,0,30,.5)";
    g.shadowBlur = 40;
    g.shadowOffsetX = 18;
    g.shadowOffsetY = 18;
    g.drawImage(F, 1180 - fw / 2, 30, fw, fh);
    g.restore();
  }
  const washi = cv(W + 200, H);
  {
    const g = g2(washi);
    const gr = g.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, "#9DB6EE");
    gr.addColorStop(1, "#E9F0FF");
    g.fillStyle = gr;
    g.fillRect(0, 0, W + 200, H);
    g.strokeStyle = "rgba(20,20,40,.75)";
    g.lineWidth = 16;
    for (let x = 0; x <= W + 200; x += (W + 200) / 6) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    for (let y = 0; y <= H; y += H / 4) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W + 200, y);
      g.stroke();
    }
    g.fillStyle = "#3a2216";
    g.fillRect(W + 170, 0, 30, H);
    grain(g, W + 200, H, 0.2, "soft-light");
  }
  const town2dFar = cv(W + 400, 460), win2d = [];
  {
    const g = g2(town2dFar), r2 = rng(13);
    let x = 0;
    while (x < W + 400) {
      const w = 50 + r2() * 110, h = 200 + r2() * 250, y = 460 - h;
      g.fillStyle = r2() < 0.5 ? "#2c3d8c" : "#33479a";
      g.fillRect(x, y, w, h);
      if (r2() < 0.3) {
        g.fillRect(x + w / 2 - 2, y - 70, 4, 70);
        g.fillStyle = "#ff5050";
        g.beginPath();
        g.arc(x + w / 2, y - 70, 3.5, 0, TAU);
        g.fill();
      } else if (r2() < 0.3) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + w / 2, y - 50);
        g.lineTo(x + w, y);
        g.fill();
      }
      for (let wy = y + 14; wy < 450; wy += 18) for (let wx = x + 8; wx < x + w - 10; wx += 13) {
        const lit = r2() < 0.3;
        g.fillStyle = lit ? "rgba(255,220,150,.55)" : "rgba(10,16,50,.45)";
        g.fillRect(wx, wy, 6, 9);
      }
      x += w + 2 + r2() * 8;
    }
    g.globalCompositeOperation = "source-atop";
    const hz = g.createLinearGradient(0, 0, 0, 460);
    hz.addColorStop(0, "rgba(160,180,240,.1)");
    hz.addColorStop(1, "rgba(160,180,240,.28)");
    g.fillStyle = hz;
    g.fillRect(0, 0, W + 400, 460);
    g.globalCompositeOperation = "source-over";
    grainIn(g, W + 400, 460);
    g.fillStyle = "#0d1546";
    g.fillRect(0, 196, W + 400, 10);
    g.fillStyle = "#5a74c0";
    g.fillRect(0, 196, W + 400, 2);
    for (let px = 40; px < W + 400; px += 220) {
      g.fillStyle = "#0d1546";
      g.fillRect(px, 206, 12, 254);
    }
  }
  const train2d = cv(560, 70);
  {
    const g = g2(train2d);
    g.fillStyle = "#0d1546";
    g.beginPath();
    g.roundRect(0, 18, 120, 44, 12);
    g.fill();
    g.fillRect(24, 4, 16, 18);
    for (let k = 0; k < 3; k++) {
      const x = 136 + k * 140;
      g.fillStyle = "#0d1546";
      g.beginPath();
      g.roundRect(x, 14, 130, 48, 8);
      g.fill();
      for (let j = 0; j < 4; j++) {
        g.fillStyle = "#FFD27A";
        g.fillRect(x + 12 + j * 30, 24, 20, 18);
      }
    }
    g.fillStyle = "#FFF1C9";
    g.beginPath();
    g.arc(8, 38, 6, 0, TAU);
    g.fill();
    g.fillStyle = "#FFD27A";
    g.fillRect(84, 26, 22, 16);
  }
  const town2d = cv(W + 400, 300);
  {
    const g = g2(town2d), r2 = rng(12);
    let x = 0;
    while (x < W + 400) {
      const w = 110 + r2() * 170, h = 110 + r2() * 170, y = 300 - h;
      g.fillStyle = "#0a1240";
      g.fillRect(x, y, w, h);
      if (r2() < 0.35) {
        g.fillRect(x + w * 0.6, y - 22, 26, 22);
      }
      for (let wy = y + 18; wy < 270; wy += 30) for (let wx = x + 14; wx < x + w - 22; wx += 26) {
        const v = r2();
        if (v < 0.35) {
          g.fillStyle = "#FFD27A";
          g.fillRect(wx, wy, 14, 18);
        } else {
          g.fillStyle = "rgba(40,50,110,.6)";
          g.fillRect(wx, wy, 14, 18);
          if (v < 0.6) win2d.push([wx, wy, r2()]);
        }
      }
      x += w + 4;
    }
    grainIn(g, W + 400, 300);
    win2d.sort((a, b) => a[2] - b[2]);
  }
  const cloud = (col, edge) => {
    const c = cv(680, 300), g = g2(c);
    g.translate(340, 150);
    const puffs = [[-230, 20, 62], [-150, -14, 80], [-50, -36, 96], [60, -26, 88], [160, -8, 74], [240, 18, 56], [-170, 50, 52], [-70, 58, 60], [40, 60, 62], [150, 52, 54]];
    g.fillStyle = col;
    g.shadowColor = "rgba(5,10,40,.4)";
    g.shadowBlur = 26;
    g.shadowOffsetY = 12;
    g.beginPath();
    for (const [x, y, r2] of puffs) {
      g.moveTo(x + r2, y);
      g.arc(x, y, r2, 0, TAU);
    }
    g.fill();
    g.shadowColor = "transparent";
    g.globalCompositeOperation = "source-atop";
    const sh = g.createLinearGradient(0, -120, 0, 120);
    sh.addColorStop(0, "rgba(255,255,255,.18)");
    sh.addColorStop(1, "rgba(40,40,110,.22)");
    g.fillStyle = sh;
    g.fillRect(-340, -150, 680, 300);
    g.globalCompositeOperation = "source-over";
    g.strokeStyle = edge;
    g.lineWidth = 5;
    g.lineCap = "round";
    g.beginPath();
    for (const [x, y, r2] of [[-120, 10, 22], [0, -6, 26], [110, 12, 22]]) {
      g.moveTo(x + r2 * Math.cos(Math.PI * 1.15), y + r2 * Math.sin(Math.PI * 1.15));
      g.arc(x, y, r2, Math.PI * 1.15, Math.PI * 1.95);
    }
    g.stroke();
    grain(g, 680, 300, 0.18, "soft-light");
    return c;
  };
  const clouds2d = [cloud("#5C7BC4", "#7E9AD6"), cloud("#E8E2F2", "#C4BCD8")];
  const cloudBank = cv(3600, H);
  {
    const g = g2(cloudBank), rr = rng(71);
    const bank = (x0, x1, col, shade, seed) => {
      const r2 = rng(seed);
      g.beginPath();
      g.rect(x0, 0, x1 - x0, H);
      for (let y = -60; y < H + 120; y += 110) {
        const rad = 120 + r2() * 90;
        g.moveTo(x0 + 40 + rad, y);
        g.arc(x0 + 40 - r2() * 120, y, rad, 0, TAU);
      }
      for (let y = -60; y < H + 120; y += 120) {
        const rad = 110 + r2() * 80;
        g.moveTo(x1 + rad, y);
        g.arc(x1 + r2() * 100, y, rad, 0, TAU);
      }
      g.save();
      g.shadowColor = "rgba(10,14,50,.45)";
      g.shadowBlur = 50;
      g.shadowOffsetX = -24;
      g.fillStyle = col;
      g.fill();
      g.restore();
      g.save();
      g.clip();
      const sh = g.createLinearGradient(0, 0, 0, H);
      sh.addColorStop(0, "rgba(255,255,255,.25)");
      sh.addColorStop(1, shade);
      g.fillStyle = sh;
      g.fillRect(x0 - 400, 0, x1 - x0 + 800, H);
      g.restore();
    };
    bank(760, 3050, "#B8A9DD", "rgba(60,50,120,.25)", 7);
    bank(560, 2900, "#F1ECF8", "rgba(90,80,150,.22)", 9);
    g.strokeStyle = "rgba(160,140,205,.8)";
    g.lineWidth = 7;
    g.lineCap = "round";
    for (let i = 0; i < 26; i++) {
      const x = 760 + rr() * 2e3, y = rr() * H, rad = 26 + rr() * 30;
      g.beginPath();
      g.arc(x, y, rad, Math.PI * 1.1, Math.PI * 1.95);
      g.stroke();
    }
    g.strokeStyle = "rgba(226,176,85,.7)";
    g.lineWidth = 4;
    for (let i = 0; i < 10; i++) {
      const x = 800 + rr() * 1900, y = rr() * H, rad = 18 + rr() * 16;
      g.beginPath();
      g.arc(x, y, rad, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    }
    grain(g, 3600, H, 0.16, "soft-light");
  }
  const waves2d = cv(W + 520, 180);
  {
    const g = g2(waves2d);
    for (let x = 0; x < W + 520; x += 260) {
      g.fillStyle = C.gun2;
      g.beginPath();
      g.moveTo(x, 180);
      g.lineTo(x, 100);
      g.bezierCurveTo(x + 60, 0, x + 200, 0, x + 240, 60);
      g.bezierCurveTo(x + 200, 40, x + 170, 90, x + 210, 110);
      g.lineTo(x + 260, 180);
      g.fill();
      g.strokeStyle = C.ivory;
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(x + 20, 100);
      g.bezierCurveTo(x + 70, 25, x + 190, 25, x + 232, 62);
      g.stroke();
      g.fillStyle = C.ivory;
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.arc(x + 232 - k * 16, 70 - k * 6, 6, 0, TAU);
        g.fill();
      }
    }
  }
  const r = rng(4);
  return {
    img,
    pose,
    bg,
    profile,
    sadDuo,
    cards,
    poster,
    washi,
    town2d,
    town2dFar,
    train2d,
    win2d,
    clouds2d,
    cloudBank,
    waves2d,
    r: {
      bokeh: Array.from({ length: 60 }, () => [r() * W, 760 + r() * 360, 10 + r() * 40, r(), r() * 4]),
      stars: Array.from({ length: 34 }, () => [r() * W, r() * H, 8 + r() * 26]),
      petals: Array.from({ length: 140 }, () => [r() * W, r(), r(), r() * TAU, 0.6 + r() * 0.8])
    }
  };
}
function storyCard(O, lines, x, y, size, drop, sway = 0) {
  if (drop <= 1e-3) return;
  const [l1, l2] = lines.split("\uFF0F");
  const n = Math.max([...l1].length, [...l2 ?? ""].length), hh = n * size * 1.08 + size * 0.9, ww = size * (l2 ? 2.7 : 1.7);
  const yy = lerp(-hh - 40, y, drop);
  O.save();
  O.strokeStyle = "rgba(240,232,215,.8)";
  O.lineWidth = 2;
  for (const s of [-1, 1]) {
    O.beginPath();
    O.moveTo(x + s * ww * 0.3, 0);
    O.lineTo(x + s * ww * 0.3 + sway * 30, yy);
    O.stroke();
  }
  O.translate(x, yy);
  O.rotate(sway * 0.02);
  O.shadowColor = "rgba(0,0,0,.45)";
  O.shadowBlur = 24;
  O.shadowOffsetY = 10;
  O.fillStyle = C.ivory;
  O.fillRect(-ww / 2, 0, ww, hh);
  O.shadowColor = "transparent";
  O.strokeStyle = C.gold;
  O.lineWidth = 3;
  O.strokeRect(-ww / 2 + 12, 12, ww - 24, hh - 24);
  if (l2) {
    vtext(O, l1, size * 0.62, size * 0.9, size, C.plum);
    vtext(O, l2, -size * 0.62, size * 0.9, size, C.plum);
  } else vtext(O, l1, 0, size * 0.9, size, C.plum);
  O.fillStyle = C.red;
  O.fillRect(-ww / 2 + 22, hh - 62, 38, 38);
  O.fillStyle = C.ivory;
  O.font = `700 26px ${SERIF}`;
  O.textAlign = "center";
  O.textBaseline = "middle";
  O.fillText("\u6708", -ww / 2 + 41, hh - 43);
  O.restore();
}
function drawS04(O, k, t) {
  const u = P(t, 12, 16), z = 1 + 0.06 * ease2(u), tt = on2(t);
  O.save();
  O.translate(W / 2, H / 2);
  O.scale(z, z);
  O.translate(-W / 2, -H / 2);
  O.drawImage(k.bg.garden, 0, 0);
  for (const [x, y, rr, a, ph] of k.r.bokeh) {
    const on = (tt * 3 + ph) % 4 > 1.2;
    O.fillStyle = `rgba(255,${200 + a * 40},${110 + a * 50},${on ? 0.3 + a * 0.3 : 0.06})`;
    O.beginPath();
    O.arc(x, y, rr * 0.8, 0, TAU);
    O.fill();
  }
  O.drawImage(k.town2dFar, -tt * 8 - 60, H - 460 - 60);
  const tx = lerp(W + 80, -640, P(tt, 12.1, 15.9));
  O.drawImage(k.train2d, tx, H - 460 - 60 + 196 - 62 + Math.floor(tt * 12) % 2);
  O.save();
  O.translate(1180, 540);
  O.rotate(0.3);
  O.shadowColor = "rgba(0,0,0,.5)";
  O.shadowBlur = 40;
  O.shadowOffsetX = 20;
  O.shadowOffsetY = 20;
  O.drawImage(k.profile, -720, -620, 1380, 1380);
  O.restore();
  O.globalCompositeOperation = "lighter";
  for (let i = 0; i < 5; i++) {
    O.fillStyle = `rgba(255,214,140,${0.7 - i * 0.1})`;
    O.beginPath();
    O.arc(982 + i * 9, 542 + i % 2 * 6, 3.4, 0, TAU);
    O.fill();
  }
  O.globalCompositeOperation = "source-over";
  O.restore();
  const ox = -tt * 18;
  O.drawImage(k.town2d, ox, H - 300);
  const n = Math.floor(k.win2d.length * P(tt, 12.2, 15.6));
  O.fillStyle = "#FFD27A";
  for (let i = 0; i < n; i++) {
    const wv = k.win2d[i];
    O.fillRect(ox + wv[0], H - 300 + wv[1], 14, 18);
  }
}
function cloudAt(O, img, x, y, s) {
  O.drawImage(img, x - 340 * s, y - 150 * s, 680 * s, 300 * s);
}
function drawS06(O, k, t) {
  const tt = on2(t);
  O.drawImage(k.bg.starmap, 0, 0);
  O.save();
  O.globalAlpha = 0.16;
  O.fillStyle = "#fff";
  O.beginPath();
  O.moveTo(1560, 120);
  O.lineTo(1700, 230);
  O.lineTo(260, 1180);
  O.lineTo(-100, 1e3);
  O.closePath();
  O.fill();
  O.restore();
  for (let i = 0; i < 4; i++) cloudAt(O, k.clouds2d[0], (i * 620 + 300 + (tt - 20) * 30) % 2400 - 200, 520 + i * 30, 0.8);
  const uu = P(tt, 20, 23.5), hx = lerp(1480, 820, uu), hy = lerp(190, 700, (uu + (1 - Math.cos(uu * Math.PI)) / 2) / 2);
  O.save();
  O.translate(hx, hy);
  O.rotate(Math.sin(tt * 5) * 0.06);
  const B = k.pose.moonlight.back, bw = 220, bh = bw * B.height / B.width;
  O.drawImage(B, -bw / 2, -bh * 0.35, bw, bh);
  const top = -bh * 0.35;
  O.fillStyle = C.lav;
  O.beginPath();
  O.moveTo(-170, top - 10);
  O.quadraticCurveTo(0, top - 190, 170, top - 10);
  O.closePath();
  O.fill();
  O.strokeStyle = C.violet;
  O.lineWidth = 4;
  for (let q = -2; q <= 2; q++) {
    O.beginPath();
    O.moveTo(0, top - 150);
    O.lineTo(q * 70, top - 10);
    O.stroke();
  }
  O.fillStyle = C.ivory;
  for (let q = -2; q <= 2; q++) {
    O.beginPath();
    O.arc(q * 70 + 35, top - 8, 10, 0, Math.PI);
    O.fill();
  }
  O.fillStyle = C.wood;
  O.fillRect(-4, top - 150, 8, 200);
  O.restore();
  for (let i = 0; i < 3; i++) cloudAt(O, k.clouds2d[1], (i * 820 + 2400 - (tt - 20) * 90) % 2600 - 100, 830 + i * 20, 1.2);
  O.drawImage(k.waves2d, -((tt - 20) * 130 % 260), H - 180);
}
function drawS08(O, k, t) {
  O.fillStyle = "#05060f";
  O.fillRect(0, 0, W, H);
  const flick = t < 28.75 ? 1.6 : 1, glow = (0.8 + 0.2 * P(t, 29, 32)) * flick;
  const gr = O.createRadialGradient(W / 2, 470, 60, W / 2, 470, 560);
  gr.addColorStop(0, `rgba(255,240,214,${0.9 * Math.min(1, glow)})`);
  gr.addColorStop(0.6, `rgba(150,140,190,${0.25 * glow})`);
  gr.addColorStop(1, "rgba(0,0,0,0)");
  O.fillStyle = gr;
  O.fillRect(0, 0, W, H);
  const d = k.sadDuo, breathe = Math.sin(on2(t) * Math.PI * 1.2) * 6, dw = 1e3, dh = dw * d.height / d.width, lift = -18 * ease2(P(t, 30.6, 31.6));
  O.save();
  O.beginPath();
  O.arc(W / 2, 470, 470, 0, TAU);
  O.clip();
  O.globalAlpha = 0.96;
  O.drawImage(d, W / 2 - dw / 2, 20 + breathe + lift, dw, dh);
  O.restore();
  O.strokeStyle = "rgba(255,240,214,.5)";
  O.lineWidth = 3;
  O.setLineDash([4, 10]);
  O.beginPath();
  O.arc(W / 2, 470, 480, 0, TAU);
  O.stroke();
  O.setLineDash([]);
  O.save();
  O.scale(1, 0.22);
  const fg = O.createRadialGradient(W / 2, 1010 / 0.22, 10, W / 2, 1010 / 0.22, 520);
  fg.addColorStop(0, "rgba(255,236,200,.35)");
  fg.addColorStop(1, "rgba(255,236,200,0)");
  O.fillStyle = fg;
  O.beginPath();
  O.arc(W / 2, 1010 / 0.22, 520, 0, TAU);
  O.fill();
  O.restore();
}
function drawS11(O, k, t, stampIn) {
  const z = 1 + 0.08 * eo(P(t, 43, 45.7));
  O.save();
  O.translate(W / 2, H / 2);
  O.scale(z, z);
  O.translate(-W / 2, -H / 2);
  O.drawImage(k.poster, 0, 0);
  const tw0 = Math.floor(on2(t) * 6);
  k.r.stars.forEach(([x, y, r], i) => {
    const tw = (tw0 + i) % 3 === 0;
    starPath(O, x, y, r * (tw ? 1.3 : 1));
    O.fillStyle = tw ? "#FFF3C8" : C.gold;
    O.fill();
  });
  const s = stampIn < 1 ? lerp(1.35, 1, stampIn) : 1;
  O.save();
  O.globalAlpha = clamp2(stampIn * 1.6);
  O.translate(415, 520);
  O.scale(s, s);
  O.translate(-415, -520);
  O.fillStyle = C.ivory;
  O.fillRect(300, 110, 230, 820);
  O.strokeStyle = C.gold;
  O.lineWidth = 6;
  O.strokeRect(318, 128, 194, 784);
  vtext(O, "\u6708\u4EAE\u5076\u50CF", 415, 260, 170, C.plum, 1.05);
  O.fillStyle = C.red;
  O.fillRect(370, 850, 90, 60);
  O.fillStyle = C.ivory;
  O.font = `600 22px ${LAT}`;
  O.textAlign = "center";
  O.textBaseline = "alphabetic";
  O.fillText("NO.01", 415, 888);
  O.restore();
  O.restore();
  const r2 = rng(14);
  for (let i = 0; i < 26; i++) {
    const col = ["255,127,184", "255,226,122", "200,166,255"][i % 3];
    const x = r2() * W, y = 900 + r2() * 200 + Math.sin(t * 3 + i) * 8, rr = 30 + r2() * 50;
    O.fillStyle = `rgba(${col},.35)`;
    O.beginPath();
    O.arc(x, y, rr, 0, TAU);
    O.fill();
  }
}
function petalsOverlay(O, k, t, start, dur) {
  const u = (t - start) / dur;
  if (u <= 0 || u >= 1.6) return;
  for (const [x, a, b, rot, s] of k.r.petals) {
    const y = -80 + u * (900 + a * 900) * 1.3, xx = x + Math.sin(u * 6 + b * 9) * 60;
    if (y > H + 60) continue;
    O.save();
    O.translate(xx, y);
    O.rotate(rot + u * 6 * (b - 0.5));
    O.scale(s * 1.6, s * 1.6);
    O.fillStyle = b < 0.5 ? C.pink : "#FFD3E6";
    O.beginPath();
    O.moveTo(0, -18);
    O.bezierCurveTo(16, -10, 12, 14, 0, 18);
    O.bezierCurveTo(-12, 14, -16, -10, 0, -18);
    O.fill();
    O.restore();
  }
}
function bakeFX() {
  const raw = cv(900, 600), g = g2(raw), r = rng(303);
  g.strokeStyle = "#1a0d22";
  g.lineCap = "round";
  const limb = (x, y, a, len, wdt, depth) => {
    if (depth <= 0 || len < 20) return;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    g.lineWidth = wdt;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo((x + x2) / 2 + (r() - 0.5) * 40, (y + y2) / 2 + (r() - 0.5) * 40, x2, y2);
    g.stroke();
    for (let k = 0; k < 6; k++) {
      const bx = x2 + (r() - 0.5) * 90, by = y2 + (r() - 0.5) * 70, s = 10 + r() * 16;
      g.fillStyle = r() < 0.5 ? "#F7B6D2" : "#FFD9EA";
      g.save();
      g.translate(bx, by);
      for (let p = 0; p < 5; p++) {
        g.rotate(TAU / 5);
        g.beginPath();
        g.ellipse(0, -s * 0.55, s * 0.42, s * 0.6, 0, 0, TAU);
        g.fill();
      }
      g.restore();
    }
    limb(x2, y2, a - 0.35 - r() * 0.3, len * 0.72, wdt * 0.65, depth - 1);
    limb(x2, y2, a + 0.3 + r() * 0.3, len * 0.66, wdt * 0.6, depth - 1);
  };
  limb(-20, 40, 0.38, 260, 26, 4);
  const branch = cv(900, 600), bg = g2(branch);
  bg.filter = "blur(9px)";
  bg.drawImage(raw, 0, 0);
  bg.filter = "none";
  const glint = cv(128, 128), gg = g2(glint);
  const rad = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
  rad.addColorStop(0, "rgba(255,255,255,1)");
  rad.addColorStop(0.12, "rgba(255,246,220,.8)");
  rad.addColorStop(0.4, "rgba(255,230,180,.12)");
  rad.addColorStop(1, "rgba(255,230,180,0)");
  gg.fillStyle = rad;
  gg.fillRect(0, 0, 128, 128);
  for (const [w2, h2] of [[64, 2.2], [2.2, 64]]) {
    const lg = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
    lg.addColorStop(0, "rgba(255,255,255,.95)");
    lg.addColorStop(1, "rgba(255,255,255,0)");
    gg.fillStyle = lg;
    gg.fillRect(64 - w2, 64 - h2, w2 * 2, h2 * 2);
  }
  const dot = cv(64, 64), dg = g2(dot), dr = dg.createRadialGradient(32, 32, 0, 32, 32, 32);
  dr.addColorStop(0, "rgba(255,240,215,.9)");
  dr.addColorStop(0.5, "rgba(255,230,200,.25)");
  dr.addColorStop(1, "rgba(255,230,200,0)");
  dg.fillStyle = dr;
  dg.fillRect(0, 0, 64, 64);
  return { branch, glint, dot };
}
var hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
function vnoise(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 57), hash(i + 1 + seed * 57), u) * 2 - 1;
}
function branches(O, fx, t, a) {
  if (a <= 0.01) return;
  O.save();
  O.globalAlpha = a;
  O.save();
  O.translate(-60 + vnoise(t * 0.4, 1) * 8, -40);
  O.rotate(vnoise(t * 0.3, 2) * 0.02);
  O.drawImage(fx.branch, 0, 0, 1e3, 667);
  O.restore();
  O.save();
  O.translate(W + 60 + vnoise(t * 0.4, 3) * 8, -60);
  O.scale(-1, 1);
  O.rotate(0.1 + vnoise(t * 0.3, 4) * 0.02);
  O.drawImage(fx.branch, 0, 0, 820, 547);
  O.restore();
  O.restore();
}
function dust(O, fx, t, a, n = 46, box = [0, 0, W, H]) {
  if (a <= 0.01) return;
  O.save();
  O.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const sx = hash(i * 3.1), sy = hash(i * 7.7), sp = 0.2 + hash(i * 1.9) * 0.6, s = 4 + hash(i * 5.3) * 14;
    const x = box[0] + (sx * box[2] + t * 18 * sp + vnoise(t * 0.5 + i, 9) * 30) % box[2], y = box[1] + (sy * box[3] - t * 10 * sp + box[3] * 10) % box[3];
    O.globalAlpha = a * (0.25 + 0.5 * hash(i * 9.1)) * (0.6 + 0.4 * Math.sin(t * 2 + i));
    O.drawImage(fx.dot, x - s, y - s, s * 2, s * 2);
  }
  O.restore();
}
function glints(O, fx, t, pts, a = 1) {
  O.save();
  O.globalCompositeOperation = "lighter";
  for (const [x, y, s, ph] of pts) {
    const k = Math.max(0, Math.sin(t * 3.2 + ph)) ** 3;
    if (k < 0.02) continue;
    const z = s * (0.4 + 0.6 * k);
    O.globalAlpha = a * k;
    O.drawImage(fx.glint, x - z, y - z, z * 2, z * 2);
  }
  O.restore();
}
function godRays(O, cx, cy, t, a) {
  if (a <= 0.01) return;
  O.save();
  O.globalCompositeOperation = "lighter";
  O.translate(cx, cy);
  O.rotate(t * 0.05);
  for (let i = 0; i < 14; i++) {
    const ang = i / 14 * TAU + Math.sin(i * 1.7) * 0.15, wdt = 0.05 + hash(i) * 0.07, len = 1300;
    const gr = O.createLinearGradient(0, 0, Math.cos(ang) * len, Math.sin(ang) * len);
    gr.addColorStop(0, `rgba(255,214,180,${0.22 * a})`);
    gr.addColorStop(1, "rgba(255,190,200,0)");
    O.fillStyle = gr;
    O.beginPath();
    O.moveTo(0, 0);
    O.lineTo(Math.cos(ang - wdt) * len, Math.sin(ang - wdt) * len);
    O.lineTo(Math.cos(ang + wdt) * len, Math.sin(ang + wdt) * len);
    O.closePath();
    O.fill();
  }
  O.restore();
}
function leak(O, t, at2, dur = 0.9, hue = "255,150,110") {
  const u = (t - at2) / dur;
  if (u < -1 || u > 1) return;
  const k = Math.cos(u * Math.PI / 2) ** 2, x = lerp(-200, W + 200, (u + 1) / 2);
  O.save();
  O.globalCompositeOperation = "screen";
  const gr = O.createRadialGradient(x, H * 0.35, 0, x, H * 0.35, 900);
  gr.addColorStop(0, `rgba(${hue},${0.55 * k})`);
  gr.addColorStop(0.5, `rgba(${hue},${0.18 * k})`);
  gr.addColorStop(1, `rgba(${hue},0)`);
  O.fillStyle = gr;
  O.fillRect(0, 0, W, H);
  O.restore();
}
function confetti(O, t, start, n = 90) {
  const tt = on2(t) - start;
  if (tt <= 0) return;
  for (let i = 0; i < n; i++) {
    const x0 = hash(i * 2.3) * W, sp = 220 + hash(i * 4.1) * 260, y = -40 + tt * sp - hash(i * 6.7) * 300;
    if (y < -40 || y > H + 40) continue;
    const x = x0 + Math.sin(tt * 2.4 + i) * 40, rot = tt * (2 + hash(i) * 4) + i, flip = Math.cos(tt * 6 + i);
    O.save();
    O.translate(x, y);
    O.rotate(rot);
    O.scale(1, flip);
    O.fillStyle = i % 3 === 0 ? "#E2B055" : i % 3 === 1 ? "#F8A3C8" : "#FFF7EB";
    O.fillRect(-9, -5, 18, 10);
    O.restore();
  }
}
function specks(O, t) {
  const f = Math.floor(t * 12);
  if (hash(f * 0.37) > 0.35) return;
  O.save();
  for (let i = 0; i < 2; i++) {
    const x = hash(f * 1.3 + i) * W, y = hash(f * 2.9 + i) * H, s = 1 + hash(f * 5.1 + i) * 2.5, light = hash(f * 7.3 + i) > 0.5;
    O.globalAlpha = 0.35;
    O.fillStyle = light ? "#fff6e8" : "#0a0610";
    if (hash(f * 3.7 + i) > 0.8) {
      O.strokeStyle = O.fillStyle;
      O.lineWidth = 1;
      O.beginPath();
      O.moveTo(x, y);
      O.quadraticCurveTo(x + 14, y + 6, x + 6, y + 22);
      O.stroke();
    } else {
      O.beginPath();
      O.ellipse(x, y, s, s * 0.7, f, 0, TAU);
      O.fill();
    }
  }
  O.restore();
}

// scenes/world3d.ts
var g22 = (c) => c.getContext("2d");
var LAYER_MAIN = 0;
var LAYER_FG = 1;
var LAYER_BG = 2;
function prosTextures() {
  const c = cv(2400, 1640), g = g22(c), e = cv(2400, 1640), ge = g22(e);
  ge.fillStyle = "#000";
  ge.fillRect(0, 0, 2400, 1640);
  const OPx = 400, OPy = 480, OPw = 1600, OPh = 960;
  const crown = (inset) => {
    g.beginPath();
    g.moveTo(40 + inset, 1640);
    g.lineTo(40 + inset, 330 + inset);
    g.lineTo(720 + inset * 0.4, 330 + inset);
    g.quadraticCurveTo(820, 330 + inset, 860 + inset * 0.3, 230 + inset);
    g.bezierCurveTo(950, 30 + inset, 1450, 30 + inset, 1540 - inset * 0.3, 230 + inset);
    g.quadraticCurveTo(1580, 330 + inset, 1680 - inset * 0.4, 330 + inset);
    g.lineTo(2360 - inset, 330 + inset);
    g.lineTo(2360 - inset, 1640);
    g.closePath();
  };
  g.save();
  g.shadowColor = "rgba(0,0,0,.45)";
  g.shadowBlur = 30;
  crown(0);
  g.fillStyle = C.plum;
  g.fill();
  g.restore();
  crown(26);
  g.fillStyle = "#E58FB6";
  g.fill();
  crown(40);
  g.fillStyle = C.pink;
  g.fill();
  crown(58);
  g.strokeStyle = C.gold;
  g.lineWidth = 6;
  g.stroke();
  g.setLineDash([2, 14]);
  g.lineCap = "round";
  crown(74);
  g.strokeStyle = C.ivory;
  g.lineWidth = 5;
  g.stroke();
  g.setLineDash([]);
  const rr = (x, y, w, h, r2) => {
    g.beginPath();
    g.moveTo(x + r2, y);
    g.arcTo(x + w, y, x + w, y + h, r2);
    g.lineTo(x + w, y + h);
    g.lineTo(x, y + h);
    g.arcTo(x, y, x + r2, y, r2);
    g.closePath();
  };
  rr(OPx - 70, OPy - 70, OPw + 140, OPh + 70, 120);
  g.fillStyle = C.rose;
  g.fill();
  rr(OPx - 44, OPy - 44, OPw + 88, OPh + 44, 100);
  g.strokeStyle = C.gold;
  g.lineWidth = 8;
  g.stroke();
  rr(OPx - 24, OPy - 24, OPw + 48, OPh + 24, 90);
  g.strokeStyle = "#F6C9DC";
  g.lineWidth = 3;
  g.setLineDash([3, 12]);
  g.stroke();
  g.setLineDash([]);
  const r = rng(91);
  for (let i = 0; i < 46; i++) {
    const side = i % 2, t = r(), x = side ? OPx + OPw + 40 : OPx - 40, y = OPy - 30 + t * (OPh - 40);
    g.save();
    g.translate(x + (r() - 0.5) * 20, y);
    g.fillStyle = r() < 0.5 ? "#FFD3E6" : "#FFF0F6";
    for (let k = 0; k < 5; k++) {
      g.rotate(TAU / 5);
      g.beginPath();
      g.ellipse(0, -9, 6, 10, 0, 0, TAU);
      g.fill();
    }
    g.fillStyle = C.gold;
    g.beginPath();
    g.arc(0, 0, 3.5, 0, TAU);
    g.fill();
    g.restore();
  }
  g.save();
  g.translate(1200, 200);
  g.fillStyle = C.plum;
  g.beginPath();
  g.ellipse(0, 20, 330, 110, 0, 0, TAU);
  g.fill();
  g.strokeStyle = C.gold;
  g.lineWidth = 6;
  g.beginPath();
  g.ellipse(0, 20, 310, 92, 0, 0, TAU);
  g.stroke();
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(0, 20, 296, 80, 0, 0, TAU);
  g.stroke();
  g.fillStyle = C.moon;
  g.font = `600 64px ${LAT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.letterSpacing = "10px";
  g.fillText("LUNAR POP CLUB", 0, 8);
  g.letterSpacing = "6px";
  g.font = `700 26px ${SERIF}`;
  g.fillStyle = C.gold;
  g.fillText("\u6708\u5154\u7D19\u5287\u5834 \xB7 NO.01", 0, 70);
  g.letterSpacing = "0px";
  g.restore();
  for (let i = 0; i < 26; i++) {
    const a = Math.PI + i / 25 * Math.PI, x = 1200 + Math.cos(a) * 390, y = 220 + Math.sin(a) * 150;
    g.fillStyle = "#9c8a70";
    g.beginPath();
    g.arc(x, y, 12, 0, TAU);
    g.fill();
    g.strokeStyle = C.gold2;
    g.lineWidth = 3;
    g.stroke();
  }
  g.fillStyle = C.plum;
  g.fillRect(40, 1440, 2320, 200);
  g.fillStyle = C.gold;
  g.fillRect(40, 1456, 2320, 6);
  g.fillRect(40, 1600, 2320, 6);
  for (let x = 90; x < 2360; x += 110) {
    g.save();
    g.translate(x, 1530);
    g.fillStyle = C.pink;
    for (let k = 0; k < 5; k++) {
      g.rotate(TAU / 5);
      g.beginPath();
      g.ellipse(0, -14, 9, 15, 0, 0, TAU);
      g.fill();
    }
    g.fillStyle = C.gold;
    g.beginPath();
    g.arc(0, 0, 5, 0, TAU);
    g.fill();
    g.restore();
    g.fillStyle = C.rose;
    g.beginPath();
    g.moveTo(x + 55, 1510);
    g.lineTo(x + 70, 1530);
    g.lineTo(x + 55, 1550);
    g.lineTo(x + 40, 1530);
    g.fill();
  }
  grain(g, 2400, 1640, 0.16, "soft-light");
  g.globalCompositeOperation = "destination-out";
  rr(OPx, OPy, OPw, OPh + 2, 80);
  g.fill();
  return { c, e };
}
function moonTex() {
  const c = cv(1024, 1024), g = g22(c), r = rng(11);
  g.save();
  g.beginPath();
  g.arc(512, 512, 500, 0, TAU);
  g.clip();
  const gr = g.createRadialGradient(420, 400, 40, 512, 512, 520);
  gr.addColorStop(0, "#FFF6D6");
  gr.addColorStop(0.7, "#F6DC92");
  gr.addColorStop(1, "#E9BF68");
  g.fillStyle = gr;
  g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 70; i++) {
    const x = r() * 1024, y = r() * 1024, rr = 30 + r() * 150, cg = g.createRadialGradient(x, y, 0, x, y, rr);
    const a = 0.03 + r() * 0.07;
    cg.addColorStop(0, `rgba(222,168,84,${a})`);
    cg.addColorStop(0.8, `rgba(222,168,84,${a * 0.6})`);
    cg.addColorStop(1, "rgba(222,168,84,0)");
    g.fillStyle = cg;
    g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  const rabbit = () => {
    g.beginPath();
    g.ellipse(430, 600, 150, 118, -0.2, 0, TAU);
    g.moveTo(400, 430);
    g.ellipse(340, 450, 82, 74, 0, 0, TAU);
    g.moveTo(310, 380);
    g.ellipse(290, 300, 26, 96, -0.35, 0, TAU);
    g.moveTo(370, 380);
    g.ellipse(372, 292, 24, 92, 0.08, 0, TAU);
    g.moveTo(640, 640);
    g.lineTo(780, 640);
    g.lineTo(752, 770);
    g.lineTo(668, 770);
    g.closePath();
    g.moveTo(540, 500);
    g.ellipse(620, 470, 120, 22, -0.7, 0, TAU);
  };
  g.filter = "blur(10px)";
  g.fillStyle = "rgba(196,140,64,.34)";
  rabbit();
  g.fill();
  g.filter = "blur(2px)";
  g.strokeStyle = "rgba(170,112,44,.28)";
  g.lineWidth = 6;
  rabbit();
  g.stroke();
  g.filter = "none";
  for (let i = 0; i < 30; i++) {
    const x = 120 + r() * 780, y = 120 + r() * 780, rr = 8 + r() * 36;
    g.fillStyle = "rgba(200,146,70,.14)";
    g.beginPath();
    g.arc(x, y, rr, 0, TAU);
    g.fill();
    g.lineWidth = 2 + rr * 0.08;
    g.strokeStyle = "rgba(255,250,226,.55)";
    g.beginPath();
    g.arc(x, y, rr, Math.PI * 0.8, Math.PI * 1.8);
    g.stroke();
    g.strokeStyle = "rgba(150,100,44,.3)";
    g.beginPath();
    g.arc(x, y, rr, -Math.PI * 0.2, Math.PI * 0.8);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = C.gold;
  g.lineWidth = 14;
  g.beginPath();
  g.arc(512, 512, 496, 0, TAU);
  g.stroke();
  g.strokeStyle = "rgba(255,248,220,.7)";
  g.lineWidth = 3;
  g.setLineDash([3, 10]);
  g.beginPath();
  g.arc(512, 512, 476, 0, TAU);
  g.stroke();
  g.setLineDash([]);
  grain(g, 1024, 1024, 0.24, "soft-light");
  return c;
}
function starTex() {
  const c = cv(256, 256), g = g22(c);
  starPath(g, 128, 132, 120, 52);
  const gr = g.createLinearGradient(0, 0, 256, 256);
  gr.addColorStop(0, "#FFE7A3");
  gr.addColorStop(0.5, C.gold);
  gr.addColorStop(1, C.gold2);
  g.fillStyle = gr;
  g.fill();
  starPath(g, 128, 132, 92, 40);
  g.strokeStyle = "rgba(255,248,220,.7)";
  g.lineWidth = 4;
  g.stroke();
  grain(g, 256, 256, 0.2, "soft-light");
  return c;
}
function cityTex(L) {
  if (L === 3) return streetTex();
  const r = rng(40 + L), Hc = [1300, 1e3, 760][L], c = cv(2400, Hc), g = g22(c), e = cv(2400, Hc), ge = g22(e);
  ge.fillStyle = "#000";
  ge.fillRect(0, 0, 2400, Hc);
  const base = ["#5a6fbe", "#2c3f92", "#141c52"][L], ww = [9, 13, 17][L], wh = [12, 17, 22][L], sx = [17, 24, 31][L], sy = [24, 31, 40][L];
  const hr = [[960, 1290], [700, 990], [470, 720]][L], win = [];
  const sign = ["#FF7FB8", "#7FE3FF", "#FFD27A", "#C8A6FF"];
  let x = -30;
  while (x < 2400) {
    const w = L === 0 ? 60 + r() * 120 : L === 1 ? 110 + r() * 160 : 150 + r() * 190;
    let h = hr[0] + r() * (hr[1] - hr[0]);
    if (L === 0 && x > 1380 && x < 2050) h = Math.min(h, 1010 + r() * 60);
    const y = Hc - h, tone = r();
    g.fillStyle = base;
    g.fillRect(x, y, w, h);
    g.fillStyle = tone < 0.5 ? `rgba(0,0,30,${tone * 0.3})` : `rgba(255,255,255,${(tone - 0.5) * 0.08})`;
    g.fillRect(x, y, w, h);
    const top = r();
    g.fillStyle = base;
    if (top < 0.2) {
      g.fillRect(x + w * 0.14, y - 34, w * 0.72, 34);
      g.fillRect(x + w * 0.3, y - 64, w * 0.4, 30);
      g.fillRect(x + w / 2 - 2, y - 150, 4, 86);
      ge.fillStyle = "#ff4040";
      ge.beginPath();
      ge.arc(x + w / 2, y - 150, 5, 0, TAU);
      ge.fill();
    } else if (top < 0.34) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + w / 2, y - 90 - r() * 60);
      g.lineTo(x + w, y);
      g.fill();
    } else if (top < 0.58) {
      g.fillRect(x + w * 0.58, y - 30, 30, 22);
      g.fillRect(x + w * 0.6, y - 8, 3, 8);
      g.fillRect(x + w * 0.58 + 25, y - 8, 3, 8);
      g.fillRect(x + w * 0.15, y - 14, 24, 14);
    } else if (top < 0.76 && L > 0) {
      const bw = Math.min(w * 0.8, 120), bx = x + (w - bw) / 2, by = y - 64, col = sign[Math.floor(r() * 4)];
      g.fillRect(bx + 10, by + 40, 4, 24);
      g.fillRect(bx + bw - 14, by + 40, 4, 24);
      g.fillStyle = col;
      g.fillRect(bx, by, bw, 40);
      ge.fillStyle = col;
      ge.fillRect(bx, by, bw, 40);
      g.fillStyle = "rgba(20,20,60,.5)";
      g.fillRect(bx + 8, by + 12, bw - 16, 6);
      g.fillRect(bx + 8, by + 24, (bw - 16) * 0.6, 6);
    }
    g.fillStyle = "rgba(255,255,255,.09)";
    g.fillRect(x, y, 4, h);
    g.fillStyle = "rgba(0,0,20,.25)";
    g.fillRect(x + w - 4, y, 4, h);
    const cols = Math.max(1, Math.floor((w - 14) / sx)), x0 = x + (w - (cols - 1) * sx - ww) / 2, dens = 0.3 + r() * 0.45, stop = L === 2 ? Hc - 90 : Hc - wh - 6;
    for (let wy = y + 20; wy < stop; wy += sy) for (let i = 0; i < cols; i++) {
      const wx = x0 + i * sx;
      g.fillStyle = "rgba(5,10,40,.55)";
      g.fillRect(wx, wy, ww, wh);
      if (r() < dens) win.push([wx, wy, r()]);
    }
    if (L === 2) {
      g.fillStyle = "#0d1440";
      g.fillRect(x + 8, Hc - 72, w - 16, 62);
      const col = r() < 0.5 ? "#FFCF8A" : sign[Math.floor(r() * 4)];
      for (const G of [g, ge]) {
        G.fillStyle = col;
        G.fillRect(x + 12, Hc - 70, w - 24, 9);
        G.fillRect(x + 20, Hc - 52, (w - 40) * 0.45, 34);
      }
    }
    x += w + (L === 0 ? 2 + r() * 10 : 5 + r() * 22);
  }
  if (L === 0) {
    const tx = 560, ty = Hc - 1240;
    g.strokeStyle = base;
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(tx - 70, Hc);
    g.lineTo(tx - 6, ty);
    g.moveTo(tx + 70, Hc);
    g.lineTo(tx + 6, ty);
    g.stroke();
    g.lineWidth = 3;
    for (let k = 0; k < 14; k++) {
      const u0 = k / 14, u1 = (k + 1) / 14, y0 = lerp(Hc, ty, u0), y1 = lerp(Hc, ty, u1), a = lerp(70, 6, u0), b = lerp(70, 6, u1);
      g.beginPath();
      g.moveTo(tx - a, y0);
      g.lineTo(tx + b, y1);
      g.moveTo(tx + a, y0);
      g.lineTo(tx - b, y1);
      g.stroke();
    }
    g.fillStyle = base;
    g.fillRect(tx - 34, Hc - 520, 68, 16);
    g.fillRect(tx - 22, Hc - 860, 44, 14);
    g.fillRect(tx - 2, ty - 90, 4, 90);
    ge.fillStyle = "#ff4040";
    for (const yy of [ty - 90, Hc - 860, Hc - 520]) {
      ge.beginPath();
      ge.arc(tx, yy, 6, 0, TAU);
      ge.fill();
    }
  }
  if (L === 0) {
    const hz = g.createLinearGradient(0, Hc * 0.3, 0, Hc);
    hz.addColorStop(0, "rgba(150,170,230,0)");
    hz.addColorStop(1, "rgba(150,170,230,.22)");
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = hz;
    g.fillRect(0, 0, 2400, Hc);
    g.globalCompositeOperation = "source-over";
  }
  grain(g, 2400, Hc, 0.16, "soft-light");
  win.sort((a, b) => a[2] - b[2]);
  return { c, e, win, Hc, ww, wh };
}
function streetTex() {
  const Hc = 260, c = cv(2400, Hc), g = g22(c), e = cv(2400, Hc), ge = g22(e), r = rng(49), col = "#0c1238";
  ge.fillStyle = "#000";
  ge.fillRect(0, 0, 2400, Hc);
  for (let x = 20; x < 2420; x += 120 + r() * 70) {
    const cx = x, cy = 96 + r() * 20, R = 34 + r() * 22;
    g.fillStyle = col;
    g.fillRect(cx - 4, cy, 8, 80);
    g.fillStyle = "#121a4a";
    g.beginPath();
    for (const [dx, dy, rr] of [[0, 0, 1], [-0.7, 0.35, 0.75], [0.7, 0.35, 0.75], [0, -0.45, 0.7]]) {
      g.moveTo(cx + dx * R + rr * R, cy + dy * R);
      g.arc(cx + dx * R, cy + dy * R, rr * R, 0, TAU);
    }
    g.fill();
    g.fillStyle = "rgba(120,150,230,.12)";
    g.beginPath();
    g.arc(cx - R * 0.3, cy - R * 0.3, R * 0.45, 0, TAU);
    g.fill();
  }
  for (let x = 150; x < 2400; x += 300) {
    g.fillStyle = col;
    g.fillRect(x - 3, 40, 6, 120);
    g.fillRect(x - 3, 38, 22, 5);
    for (const G of [g, ge]) {
      G.fillStyle = "#FFE0A8";
      G.beginPath();
      G.arc(x + 18, 48, 7, 0, TAU);
      G.fill();
    }
    const gl = ge.createRadialGradient(x + 18, 52, 2, x + 18, 52, 46);
    gl.addColorStop(0, "rgba(255,210,150,.5)");
    gl.addColorStop(1, "rgba(255,210,150,0)");
    ge.fillStyle = gl;
    ge.fillRect(x - 30, 4, 96, 96);
  }
  g.fillStyle = col;
  g.fillRect(0, 150, 2400, Hc - 150);
  g.fillStyle = "#34479a";
  g.fillRect(0, 150, 2400, 4);
  for (let x = 0; x < 2400; x += 60) {
    g.fillStyle = "rgba(255,255,255,.04)";
    g.fillRect(x, 156, 2, Hc - 156);
  }
  grain(g, 2400, Hc, 0.16, "soft-light");
  return { c, e, win: [], Hc, ww: 10, wh: 10 };
}
function audTex(k) {
  const c = cv(256, 320), g = g22(c);
  g.fillStyle = "#120a26";
  g.beginPath();
  g.ellipse(128, 300, 118, 90, 0, Math.PI, 0);
  g.fill();
  g.fillRect(10, 300, 236, 20);
  g.beginPath();
  g.arc(128, 150, 68, 0, TAU);
  g.fill();
  if (k === 0) {
    g.beginPath();
    g.arc(128, 72, 36, 0, TAU);
    g.fill();
  }
  if (k === 1) {
    g.beginPath();
    g.ellipse(84, 70, 18, 60, -0.3, 0, TAU);
    g.ellipse(172, 70, 18, 60, 0.3, 0, TAU);
    g.fill();
  }
  if (k === 2) {
    g.beginPath();
    g.ellipse(128, 106, 92, 28, 0, Math.PI, 0);
    g.fill();
  }
  return c;
}
function noteTex(col) {
  const c = cv(160, 220), g = g22(c);
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(52, 176, 40, 30, -0.4, 0, TAU);
  g.fill();
  g.fillRect(80, 30, 14, 150);
  g.beginPath();
  g.moveTo(80, 30);
  g.quadraticCurveTo(140, 60, 132, 120);
  g.quadraticCurveTo(122, 80, 94, 72);
  g.fill();
  grain(g, 160, 220, 0.2, "soft-light");
  return c;
}
function valanceTex() {
  const c = cv(2048, 300), g = g22(c);
  g.fillStyle = C.gun1;
  g.fillRect(0, 0, 2048, 150);
  for (let x = 0; x < 2048; x += 160) {
    g.beginPath();
    g.moveTo(x, 140);
    g.quadraticCurveTo(x + 80, 300, x + 160, 140);
    g.fill();
  }
  g.strokeStyle = C.gold;
  g.lineWidth = 8;
  for (let x = 0; x < 2048; x += 160) {
    g.beginPath();
    g.moveTo(x, 150);
    g.quadraticCurveTo(x + 80, 290, x + 160, 150);
    g.stroke();
  }
  for (let x = 80; x < 2048; x += 160) {
    g.fillStyle = C.gold;
    g.fillRect(x - 4, 222, 8, 50);
    g.beginPath();
    g.arc(x, 280, 12, 0, TAU);
    g.fill();
  }
  for (let x = 20; x < 2048; x += 60) {
    starPath(g, x, 70, 16, 7);
    g.fillStyle = C.gold;
    g.fill();
  }
  grain(g, 2048, 300, 0.2, "soft-light");
  return c;
}
function woodTex() {
  const c = cv(1024, 512), g = g22(c), r = rng(5);
  for (let y = 0; y < 512; y += 64) {
    g.fillStyle = `hsl(22,${32 + r() * 10}%,${24 + r() * 8}%)`;
    g.fillRect(0, y, 1024, 62);
    g.fillStyle = "rgba(0,0,0,.4)";
    g.fillRect(0, y + 62, 1024, 2);
  }
  g.globalAlpha = 0.15;
  for (let i = 0; i < 300; i++) {
    g.strokeStyle = r() < 0.5 ? "#000" : "#fff";
    g.beginPath();
    const y = r() * 512;
    g.moveTo(0, y);
    g.bezierCurveTo(300, y + 6, 700, y - 6, 1024, y);
    g.stroke();
  }
  g.globalAlpha = 1;
  return c;
}
function seatNumTex(n) {
  const c = cv(128, 64), g = g22(c);
  g.fillStyle = C.gold;
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = C.plum;
  g.font = `600 44px ${LAT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(n), 64, 34);
  return c;
}
function coneTex() {
  const c = cv(64, 256), g = g22(c);
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "rgba(255,255,255,0)");
  gr.addColorStop(0.15, "rgba(255,255,255,.9)");
  gr.addColorStop(1, "rgba(255,255,255,.15)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 256);
  return c;
}
function glowTex() {
  const c = cv(128, 128), g = g22(c);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.25, "rgba(255,255,255,.5)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return c;
}
function petalTex() {
  const c = cv(64, 64), g = g22(c);
  g.fillStyle = C.pink;
  g.beginPath();
  g.moveTo(32, 4);
  g.bezierCurveTo(62, 20, 50, 56, 32, 60);
  g.bezierCurveTo(14, 56, 2, 20, 32, 4);
  g.fill();
  return c;
}
function wavesTex() {
  const c = cv(2400, 200), g = g22(c);
  for (let x = -100; x < 2500; x += 150) {
    g.fillStyle = "#1C2F7A";
    g.beginPath();
    g.moveTo(x, 200);
    g.lineTo(x, 120);
    g.bezierCurveTo(x + 40, 40, x + 120, 40, x + 150, 95);
    g.bezierCurveTo(x + 120, 80, x + 100, 115, x + 125, 130);
    g.lineTo(x + 150, 200);
    g.fill();
    g.strokeStyle = "#FFF7EB";
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(x + 14, 122);
    g.bezierCurveTo(x + 48, 58, x + 118, 58, x + 144, 96);
    g.stroke();
    g.strokeStyle = "#E2B055";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x + 30, 150);
    g.bezierCurveTo(x + 60, 110, x + 110, 110, x + 130, 140);
    g.stroke();
  }
  grain(g, 2400, 200, 0.2, "soft-light");
  return c;
}
function cloudsTex() {
  const c = cv(2400, 360), g = g22(c), r = rng(55);
  for (let i = 0; i < 9; i++) {
    const x = i * 300 - 40 + r() * 60, y = 220 + r() * 60, s = 0.8 + r() * 0.5;
    g.fillStyle = i % 2 ? "#C9B8E8" : "#E9E0F5";
    g.beginPath();
    for (let k = 0; k < 5; k++) g.arc(x - 120 * s + k * 60 * s, y - Math.sin(k * 1.3) * 18, (46 + k % 2 * 22) * s, Math.PI, 0);
    g.lineTo(x + 180 * s, 360);
    g.lineTo(x - 170 * s, 360);
    g.fill();
    g.strokeStyle = "#E2B055";
    g.lineWidth = 4;
    g.beginPath();
    g.arc(x, y + 10, 22 * s, Math.PI * 1.1, Math.PI * 1.95);
    g.stroke();
  }
  g.fillStyle = "#C9B8E8";
  g.fillRect(0, 330, 2400, 30);
  grain(g, 2400, 360, 0.2, "soft-light");
  return c;
}
function fluteTex() {
  const c = cv(512, 256), g = g22(c), gr = g.createLinearGradient(0, 0, 512, 0);
  for (let k = 0; k <= 16; k++) gr.addColorStop(k / 16, k % 2 ? "#F7B4D0" : "#E486B0");
  g.fillStyle = gr;
  g.fillRect(0, 0, 512, 256);
  grain(g, 512, 256, 0.2, "soft-light");
  return c;
}
function lanternTex() {
  const c = cv(256, 256), g = g22(c);
  g.fillStyle = "#F5A3C7";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#C24D84";
  g.lineWidth = 6;
  for (let x = 0; x < 256; x += 32) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 256);
    g.stroke();
  }
  g.fillStyle = "#C24D84";
  g.fillRect(0, 0, 256, 22);
  g.fillRect(0, 234, 256, 22);
  g.fillStyle = "#7a1f4a";
  g.font = `700 90px ${SERIF}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("\u6708", 128, 128);
  return c;
}
function trainTex() {
  const c = cv(1600, 300), g = g22(c), e = cv(1600, 300), ge = g22(e), body = "#121d55", hi = "#3A56A8", lit = "#FFD27A";
  ge.fillStyle = "#000";
  ge.fillRect(0, 0, 1600, 300);
  const both = (f) => {
    f(g);
    f(ge);
  };
  g.fillStyle = body;
  g.beginPath();
  g.roundRect(40, 118, 330, 122, 34);
  g.fill();
  g.beginPath();
  g.roundRect(262, 58, 140, 182, 14);
  g.fill();
  g.fillRect(92, 52, 46, 80);
  g.beginPath();
  g.moveTo(70, 46);
  g.lineTo(160, 46);
  g.lineTo(148, 70);
  g.lineTo(82, 70);
  g.fill();
  g.beginPath();
  g.moveTo(44, 236);
  g.lineTo(0, 272);
  g.lineTo(70, 272);
  g.fill();
  g.fillRect(250, 50, 166, 14);
  g.fillStyle = hi;
  g.fillRect(60, 124, 290, 6);
  g.fillRect(268, 64, 128, 5);
  for (let k = 0; k < 3; k++) {
    const x = 450 + k * 380;
    g.fillStyle = body;
    g.beginPath();
    g.roundRect(x, 92, 350, 150, 22);
    g.fill();
    g.fillRect(x - 34, 206, 34, 12);
    g.fillStyle = hi;
    g.fillRect(x + 14, 98, 322, 6);
    for (let j = 0; j < 4; j++) {
      const wx = x + 28 + j * 80;
      both((G) => {
        G.fillStyle = lit;
        G.fillRect(wx, 122, 52, 56);
      });
    }
  }
  both((G) => {
    G.fillStyle = lit;
    G.fillRect(292, 88, 72, 62);
    G.fillStyle = "#FFF1C9";
    G.beginPath();
    G.arc(48, 150, 17, 0, TAU);
    G.fill();
  });
  both((G) => {
    G.fillStyle = G === g ? body : "#000";
    G.beginPath();
    G.ellipse(948, 150, 7, 24, -0.2, 0, TAU);
    G.ellipse(966, 150, 7, 24, 0.2, 0, TAU);
    G.fill();
    G.beginPath();
    G.arc(957, 178, 15, Math.PI, 0);
    G.fill();
  });
  g.fillStyle = "#0a1238";
  g.strokeStyle = hi;
  g.lineWidth = 4;
  for (const x of [110, 200, 320, 500, 740, 880, 1120, 1260, 1500]) {
    g.beginPath();
    g.arc(x, 252, 26, 0, TAU);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(x - 20, 252);
    g.lineTo(x + 20, 252);
    g.moveTo(x, 232);
    g.lineTo(x, 272);
    g.stroke();
  }
  grain(g, 1600, 300, 0.2, "soft-light");
  return { c, e };
}
function viaductTex() {
  const c = cv(2400, 220), g = g22(c), e = cv(2400, 220), ge = g22(e), col = "#0f1946";
  ge.fillStyle = "#000";
  ge.fillRect(0, 0, 2400, 220);
  g.fillStyle = col;
  g.fillRect(0, 22, 2400, 30);
  g.fillStyle = "#5a74c0";
  g.fillRect(0, 22, 2400, 3);
  g.fillStyle = col;
  g.fillRect(0, 6, 2400, 3);
  for (let x = 0; x < 2400; x += 18) g.fillRect(x, 6, 3, 17);
  g.strokeStyle = col;
  g.lineWidth = 6;
  for (let x = 60; x < 2400; x += 300) {
    g.fillRect(x, 52, 24, 168);
    g.beginPath();
    g.moveTo(x - 80, 52);
    g.lineTo(x, 124);
    g.moveTo(x + 104, 52);
    g.lineTo(x + 24, 124);
    g.stroke();
  }
  for (let x = 210; x < 2400; x += 300) {
    g.fillStyle = col;
    g.fillRect(x - 2, 0, 4, 22);
    for (const G of [g, ge]) {
      G.fillStyle = "#FFE0A8";
      G.beginPath();
      G.arc(x, 3, 5, 0, TAU);
      G.fill();
    }
  }
  grain(g, 2400, 220, 0.2, "soft-light");
  return { c, e };
}
function fibreTex() {
  const c = cv(1800, 1100), g = g22(c), r = rng(17);
  for (let i = 0; i < 90; i++) {
    const x = r() * 1800, y = r() * 1100, rr = 60 + r() * 220, gr = g.createRadialGradient(x, y, 0, x, y, rr), dark = r() < 0.5;
    gr.addColorStop(0, dark ? "rgba(20,30,90,.07)" : "rgba(255,255,255,.06)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  g.lineCap = "round";
  for (let i = 0; i < 900; i++) {
    const x = r() * 1800, y = r() * 1100, a = r() * TAU, l = 20 + r() * 120, bend = (r() - 0.5) * 60, dark = r() < 0.3;
    g.strokeStyle = dark ? `rgba(30,40,100,${0.08 + r() * 0.12})` : `rgba(255,255,255,${0.12 + r() * 0.25})`;
    g.lineWidth = 0.6 + r() * 1.6;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l / 2 - Math.sin(a) * bend, y + Math.sin(a) * l / 2 + Math.cos(a) * bend, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  return c;
}
var PXU = 200;
var TIERS = [0.45, 1.35, 2.25, 3.15];
var HALL = { x: 3.45, z0: 0.55, z1: 5.4, y0: -0.5, y1: 5.4 };
function damask(g, w, h) {
  g.fillStyle = "#3d1030";
  g.fillRect(0, 0, w, h);
  for (let y = 10, j = 0; y < h; y += 46, j++) for (let x = j % 2 * 23; x < w; x += 46) {
    g.fillStyle = "rgba(226,176,85,.09)";
    g.beginPath();
    g.moveTo(x, y - 12);
    g.quadraticCurveTo(x + 9, y, x, y + 12);
    g.quadraticCurveTo(x - 9, y, x, y - 12);
    g.fill();
  }
}
function archPath(G, cx, top, bot, hw) {
  const S = top + hw;
  G.beginPath();
  G.moveTo(cx - hw, bot);
  G.lineTo(cx - hw, S);
  G.arc(cx, S, hw, Math.PI, 0);
  G.lineTo(cx + hw, bot);
  G.closePath();
}
function operaWallTex(len, bays) {
  const w = Math.round(len * PXU), h = Math.round((HALL.y1 - HALL.y0) * PXU), c = cv(w, h), g = g22(c), e = cv(w, h), ge = g22(e);
  const Y = (y) => (HALL.y1 - y) * PXU, bw = w / bays;
  ge.fillStyle = "#000";
  ge.fillRect(0, 0, w, h);
  damask(g, w, h);
  for (let k = 0; k < bays; k++) {
    const cx = (k + 0.5) * bw, hw = bw * 0.36;
    for (const y0 of TIERS) {
      const top = Y(y0 + 0.84), bot = Y(y0 + 0.16), ig = g.createLinearGradient(0, top, 0, bot);
      ig.addColorStop(0, "#2a0a1e");
      ig.addColorStop(1, "#0e0308");
      archPath(g, cx, top, bot, hw);
      g.fillStyle = ig;
      g.fill();
      g.save();
      archPath(g, cx, top, bot, hw);
      g.clip();
      g.fillStyle = "#9a2443";
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx + s * hw * 1.05, top);
        g.quadraticCurveTo(cx + s * hw * 0.3, top + (bot - top) * 0.5, cx + s * hw * 0.78, bot);
        g.lineTo(cx + s * hw * 1.05, bot);
        g.fill();
      }
      g.fillStyle = "rgba(0,0,0,.28)";
      g.fillRect(cx - hw, top, hw * 2, 16);
      g.restore();
      g.strokeStyle = C.gold;
      g.lineWidth = 6;
      archPath(g, cx, top, bot, hw);
      g.stroke();
      g.strokeStyle = "rgba(255,240,200,.35)";
      g.lineWidth = 2;
      archPath(g, cx, top + 7, bot, hw - 7);
      g.stroke();
      ge.save();
      archPath(ge, cx, top, bot, hw);
      ge.clip();
      const eg = ge.createRadialGradient(cx, top + hw * 0.9, 4, cx, top + hw * 0.9, hw * 1.5);
      eg.addColorStop(0, "#ffb070");
      eg.addColorStop(0.6, "#5a2410");
      eg.addColorStop(1, "#100402");
      ge.fillStyle = eg;
      ge.fillRect(cx - hw, top, hw * 2, bot - top);
      ge.restore();
    }
    const dtop = Y(0.3), dhw = bw * 0.22;
    archPath(g, cx, dtop, h, dhw);
    g.fillStyle = "#12040c";
    g.fill();
    g.strokeStyle = C.gold2;
    g.lineWidth = 5;
    g.stroke();
    ge.save();
    archPath(ge, cx, dtop, h, dhw);
    ge.clip();
    ge.fillStyle = "#3a1406";
    ge.fillRect(cx - dhw, dtop, dhw * 2, h - dtop);
    ge.restore();
  }
  for (const y0 of TIERS) {
    const y = Y(y0 + 0.9);
    g.fillStyle = C.gold2;
    g.fillRect(0, y - 8, w, 8);
    g.fillStyle = "rgba(0,0,0,.4)";
    g.fillRect(0, y, w, 6);
  }
  g.fillStyle = "#2a0b22";
  g.fillRect(0, 0, w, Y(4.1));
  for (let k = 0; k <= bays; k++) {
    const x = k * bw, pg = g.createLinearGradient(x - 13, 0, x + 13, 0);
    pg.addColorStop(0, "#8a6020");
    pg.addColorStop(0.5, "#f3d58a");
    pg.addColorStop(1, "#8a6020");
    g.fillStyle = pg;
    g.fillRect(x - 11, Y(4.1), 22, h - Y(4.1));
    for (const y0 of TIERS) {
      g.fillStyle = "#f3d58a";
      g.fillRect(x - 19, Y(y0 + 0.9) - 18, 38, 10);
    }
  }
  g.fillStyle = C.gold;
  g.fillRect(0, Y(4.1) - 10, w, 10);
  g.fillRect(0, Y(5.32), w, 8);
  for (let k = 0; k < bays; k++) {
    const cx = (k + 0.5) * bw;
    g.strokeStyle = C.gold2;
    g.lineWidth = 4;
    g.strokeRect(cx - bw * 0.38, Y(5.15), bw * 0.76, Y(4.25) - Y(5.15));
    starPath(g, cx, (Y(5.15) + Y(4.25)) / 2, 22, 9);
    g.fillStyle = "rgba(226,176,85,.55)";
    g.fill();
  }
  grain(g, w, h, 0.16, "soft-light");
  return { c, e };
}
function ceilingTex() {
  const w = 1380, h = 970, c = cv(w, h), g = g22(c), e = cv(w, h), ge = g22(e), r = rng(71), cx = w / 2, cy = h / 2, R = 440;
  ge.fillStyle = "#000";
  ge.fillRect(0, 0, w, h);
  damask(g, w, h);
  const dg = g.createRadialGradient(cx, cy, 20, cx, cy, R);
  dg.addColorStop(0, "#3b5bb8");
  dg.addColorStop(0.6, "#1C2F7A");
  dg.addColorStop(1, "#0E1A4F");
  g.fillStyle = dg;
  g.beginPath();
  g.arc(cx, cy, R, 0, TAU);
  g.fill();
  for (let i = 0; i < 240; i++) {
    const a = r() * TAU, rr = Math.sqrt(r()) * R * 0.95;
    g.fillStyle = `rgba(255,240,210,${0.3 + r() * 0.6})`;
    g.beginPath();
    g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.8 + r() * 1.8, 0, TAU);
    g.fill();
  }
  g.strokeStyle = C.gold;
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * TAU;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 120, cy + Math.sin(a) * 120);
    g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    g.stroke();
  }
  for (const [rr, lw] of [[R, 16], [R - 22, 4], [120, 10], [300, 3]]) {
    g.lineWidth = lw;
    g.beginPath();
    g.arc(cx, cy, rr, 0, TAU);
    g.stroke();
  }
  for (let k = 0; k < 48; k++) {
    const a = k / 48 * TAU, x = cx + Math.cos(a) * (R + 30), y = cy + Math.sin(a) * (R + 30);
    for (const G of [g, ge]) {
      G.fillStyle = G === g ? "#f3d58a" : "#ffd59a";
      G.beginPath();
      G.arc(x, y, 7, 0, TAU);
      G.fill();
    }
  }
  g.fillStyle = C.moon;
  g.beginPath();
  g.arc(cx, cy, 70, 0, TAU);
  g.fill();
  g.fillStyle = "#3b5bb8";
  g.beginPath();
  g.arc(cx + 30, cy - 16, 62, 0, TAU);
  g.fill();
  for (const [x, y] of [[90, 90], [w - 90, 90], [90, h - 90], [w - 90, h - 90]]) {
    starPath(g, x, y, 40, 16);
    g.fillStyle = C.gold2;
    g.fill();
  }
  grain(g, w, h, 0.16, "soft-light");
  return { c, e };
}
function prosWallTex(kit) {
  const w = Math.round(HALL.x * 2 * PXU), h = Math.round((HALL.y1 - HALL.y0) * PXU), c = cv(w, h), g = g22(c);
  const X = (x) => (x + HALL.x) * PXU, Y = (y) => (HALL.y1 - y) * PXU;
  damask(g, w, h);
  const lx = X(0), ly = Y(4.15), rx = 1.7 * PXU, ry = 1.1 * PXU, src = kit.bg.starNight;
  g.save();
  g.beginPath();
  g.ellipse(lx, ly, rx, ry, 0, Math.PI, 0);
  g.closePath();
  g.clip();
  const k = Math.max(rx * 2 / src.width, ry / src.height);
  g.drawImage(src, lx - src.width * k / 2, ly - src.height * k * 0.8, src.width * k, src.height * k);
  g.fillStyle = "rgba(14,26,79,.25)";
  g.fillRect(lx - rx, ly - ry, rx * 2, ry);
  g.restore();
  g.strokeStyle = C.gold;
  g.lineWidth = 16;
  g.beginPath();
  g.ellipse(lx, ly, rx, ry, 0, Math.PI, 0);
  g.closePath();
  g.stroke();
  g.strokeStyle = "rgba(255,240,200,.5)";
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(lx, ly, rx - 14, ry - 14, 0, Math.PI, 0);
  g.stroke();
  for (const sx of [-1, 1]) {
    const x = X(sx * 3.25), pg = g.createLinearGradient(x - 18, 0, x + 18, 0);
    pg.addColorStop(0, "#8a6020");
    pg.addColorStop(0.5, "#f3d58a");
    pg.addColorStop(1, "#8a6020");
    g.fillStyle = pg;
    g.fillRect(x - 16, 0, 32, h);
  }
  g.fillStyle = C.gold;
  g.fillRect(0, Y(5.32), w, 8);
  grain(g, w, h, 0.16, "soft-light");
  g.globalCompositeOperation = "destination-out";
  g.fillRect(X(-2.4), Y(2.6), X(2.4) - X(-2.4), h);
  g.globalCompositeOperation = "source-over";
  return c;
}
async function buildWorld(b, kit) {
  const { THREE, scene, camera, renderer } = b;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  camera.near = 0.05;
  camera.far = 80;
  const bmp = (im) => {
    const c = cv(im.width, im.height);
    g22(c).drawImage(im, 0, 0);
    return c;
  };
  const tex = (canvas, mip = true) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.generateMipmaps = mip;
    if (!mip) t.minFilter = THREE.LinearFilter;
    return t;
  };
  const depthFor = (map) => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 });
  const cutMat = (map, o = {}) => new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, ...o });
  const flat = (canvas, w2, h, o = {}) => {
    const g = new THREE.Group(), map = tex(canvas, canvas.width <= 1024);
    const m = cutMat(map, { side: THREE.FrontSide });
    if (o.emissive) {
      m.emissiveMap = o.emissive;
      m.emissive = new THREE.Color("#ffffff");
      m.emissiveIntensity = o.ei ?? 0;
    }
    const front = new THREE.Mesh(new THREE.PlaneGeometry(w2, h), m);
    front.castShadow = o.shadow ?? true;
    front.receiveShadow = true;
    front.customDepthMaterial = depthFor(map);
    const backing = new THREE.Mesh(new THREE.PlaneGeometry(w2, h), new THREE.MeshStandardMaterial({ alphaMap: map, alphaTest: 0.5, color: o.back ?? "#20102a", roughness: 0.9, side: THREE.DoubleSide }));
    backing.position.z = -(o.thick ?? 0.012);
    backing.castShadow = o.shadow ?? true;
    backing.customDepthMaterial = depthFor(map);
    g.add(front, backing);
    g.userData = { front, map, mat: m };
    return g;
  };
  const strMat = new THREE.MeshBasicMaterial({ color: "#E9E1D2" });
  const woodC = woodTex();
  const blurList = [];
  const glowT = tex(glowTex());
  const trimMat = new THREE.MeshStandardMaterial({ color: C.gold, metalness: 0.8, roughness: 0.35 });
  const texc = {};
  const USED = [["happy", "front"], ["arrival", "front"], ["mooncake", "front"], ["moonlight", "front"], ["sad", "front"], ["moonlight", "back"], ["sad", "back"], ["mooncake", "back"]];
  for (const [key, side] of USED) {
    const c = kit.pose[key][side], t = tex(c, false);
    texc[key + side] = { tex: t, depth: depthFor(t), aspect: c.width / c.height };
  }
  const sil = kit.pose.moonlight.sil, silTex = tex(sil);
  texc.moonlightsil = { tex: silTex, depth: depthFor(silTex), aspect: sil.width / sil.height };
  const puppet = (h) => {
    const g = new THREE.Group();
    const f = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: texc.happyfront.tex, alphaTest: 0.5, roughness: 0.75 }));
    const bk = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: texc.moonlightback.tex, alphaTest: 0.5, roughness: 0.8 }));
    bk.rotation.y = Math.PI;
    bk.position.z = -4e-3;
    f.position.z = 4e-3;
    f.castShadow = bk.castShadow = true;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(h * 8e-3, h * 8e-3, h * 0.9, 6), new THREE.MeshStandardMaterial({ color: C.wood }));
    rod.position.set(0, -h * 0.62, -0.01);
    rod.castShadow = true;
    g.add(f, bk, rod);
    g.userData = { f, b: bk, h, key: "" };
    return g;
  };
  const room = new THREE.Group();
  scene.add(room);
  const deskMap = tex(woodC);
  deskMap.wrapS = deskMap.wrapT = THREE.RepeatWrapping;
  deskMap.repeat.set(4, 6);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(16, 0.4, 12), new THREE.MeshStandardMaterial({ map: deskMap, color: "#8a7090", roughness: 0.6 }));
  desk.position.set(0, -0.7, 2);
  desk.receiveShadow = true;
  room.add(desk);
  const winLight = { intensity: 0 };
  const th = new THREE.Group();
  scene.add(th);
  const stageMat = new THREE.MeshPhysicalMaterial({ map: tex(woodC), color: "#b48a8a", roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.12 });
  const plumMat = new THREE.MeshStandardMaterial({ color: C.plum });
  const stage = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.5, 2.4), [plumMat, plumMat, stageMat, stageMat, plumMat, plumMat]);
  stage.position.set(0, -0.25, -0.55);
  stage.receiveShadow = true;
  stage.castShadow = true;
  th.add(stage);
  const backTex = { star: tex(kit.bg.starNight, false), foot: tex(kit.bg.footNight, false), end: tex(bmp(kit.img.end), false), stage2: tex(bmp(kit.img.stagev2), false) };
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.9), new THREE.MeshStandardMaterial({ map: backTex.star, emissiveMap: backTex.star, emissive: "#ffffff", emissiveIntensity: 0, roughness: 1 }));
  backdrop.position.set(0, 1.35, -1.72);
  backdrop.receiveShadow = true;
  th.add(backdrop);
  for (const s of [-1, 1]) {
    const w2 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3), new THREE.MeshStandardMaterial({ color: "#120a2a", roughness: 1 }));
    w2.position.set(s * 2.3, 1.3, -0.55);
    w2.rotation.y = -s * Math.PI / 2;
    th.add(w2);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.4), new THREE.MeshStandardMaterial({ color: "#0a0620" }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 2.75, -0.55);
  th.add(ceil);
  const P2 = prosTextures();
  const pros = flat(P2.c, 6, 4.1, { thick: 0.06, back: "#1b0a1e", emissive: tex(P2.e, false), ei: 0 });
  pros.position.set(0, 1.55, 0.62);
  th.add(pros);
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.1), new THREE.MeshStandardMaterial({ alphaMap: pros.userData.map, alphaTest: 0.5, color: "#7a2a58", roughness: 0.9 }));
  inner.position.set(0, 1.55, 0.5);
  th.add(inner);
  const bulbs = [];
  for (let i = 0; i < 26; i++) {
    const a = Math.PI + i / 25 * Math.PI, x = 1200 + Math.cos(a) * 390, y = 220 + Math.sin(a) * 150;
    const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 8), new THREE.MeshBasicMaterial({ color: "#4a3a2a", toneMapped: false }));
    b2.position.set(-3 + x / 400, 3.6 - y / 400, 0.645);
    th.add(b2);
    bulbs.push(b2);
  }
  const val = flat(valanceTex(), 4.3, 0.63, { thick: 0.02, back: "#08102e" });
  val.position.set(0, 2.33, 0.44);
  th.add(val);
  const drapeMat = new THREE.MeshPhysicalMaterial({ color: "#1F3A9C", roughness: 0.75, sheen: 1, sheenColor: new THREE.Color("#8fb0ff"), sheenRoughness: 0.5, side: THREE.DoubleSide });
  const drapes = [-1, 1].map((s) => {
    const geo = new THREE.PlaneGeometry(2.2, 2.6, 120, 1), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 26) * 0.035);
    geo.translate(-s * 1.1, 0, 0);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, drapeMat);
    m.castShadow = m.receiveShadow = true;
    const hem = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.08), trimMat);
    hem.position.set(-s * 1.1, -1.28, 0);
    const grp = new THREE.Group();
    grp.position.set(s * 2.12, 1.2, 0.38);
    grp.add(m, hem);
    const tas = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), trimMat);
    tas.position.set(-s * 0.1, -0.2, 0.06);
    grp.add(tas);
    th.add(grp);
    return grp;
  });
  {
    const fringeGeo = new THREE.CylinderGeometry(4e-3, 4e-3, 0.06, 4), cp = new THREE.Vector3(), v = new THREE.Vector3(), TS = 48, RS = 16;
    for (let k = 0; k < 3; k++) {
      const x0 = -2.1 + k * 1.4, pts = [];
      for (let i = 0; i <= 16; i++) {
        const u = i / 16;
        pts.push(new THREE.Vector3(x0 + 1.4 * u, 2.52 - 0.25 * Math.sin(Math.PI * u), 0.72 + 0.06 * Math.sin(Math.PI * u)));
      }
      const curve = new THREE.CatmullRomCurve3(pts), geo = new THREE.TubeGeometry(curve, TS, 0.09, RS, false), p = geo.attributes.position;
      const fat = (u) => 0.3 + 0.8 * Math.sin(Math.PI * u);
      for (let i = 0; i <= TS; i++) {
        const u = i / TS;
        curve.getPointAt(u, cp);
        for (let j = 0; j <= RS; j++) {
          const idx = i * (RS + 1) + j;
          v.fromBufferAttribute(p, idx).sub(cp).multiplyScalar(fat(u) * (1 + 0.12 * Math.sin(j / RS * TAU * 5)));
          v.z *= 0.55;
          p.setXYZ(idx, cp.x + v.x, cp.y + v.y, cp.z + v.z);
        }
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, drapeMat);
      m.castShadow = true;
      th.add(m);
      const low = pts.map((q, i) => new THREE.Vector3(q.x, q.y - 0.09 * fat(i / 16) - 5e-3, q.z + 0.015));
      const lowC = new THREE.CatmullRomCurve3(low);
      th.add(new THREE.Mesh(new THREE.TubeGeometry(lowC, 40, 0.011, 6), trimMat));
      const fr = new THREE.InstancedMesh(fringeGeo, trimMat, 36), m4 = new THREE.Matrix4();
      for (let i = 0; i < 36; i++) {
        lowC.getPointAt((i + 0.5) / 36, cp);
        m4.makeTranslation(cp.x, cp.y - 0.035, cp.z);
        fr.setMatrixAt(i, m4);
      }
      fr.frustumCulled = false;
      th.add(fr);
    }
    for (const x of [-2.1, -0.7, 0.7, 2.1]) {
      const tg = new THREE.Group(), knot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), trimMat), cord2 = new THREE.Mesh(new THREE.CylinderGeometry(7e-3, 7e-3, 0.12, 6), trimMat);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 8), trimMat), skirt = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.17, 18, 1, true), new THREE.MeshStandardMaterial({ color: C.gold, metalness: 0.5, roughness: 0.55, side: THREE.DoubleSide }));
      cord2.position.y = -0.09;
      ball.position.y = -0.15;
      skirt.position.y = -0.24;
      tg.add(knot, cord2, ball, skirt);
      tg.position.set(x, 2.52, 0.74);
      tg.traverse((o) => {
        if (o.isMesh) o.castShadow = true;
      });
      th.add(tg);
    }
  }
  const foot = [];
  for (let i = 0; i < 9; i++) {
    const x = -1.8 + i * 0.45;
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 10, 0, TAU, 0, Math.PI / 2), trimMat);
    shell.position.set(x, 0, 0.42);
    shell.rotation.x = -0.3;
    th.add(shell);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: "#FFE2A6", toneMapped: false }));
    bulb.position.set(x, 0.03, 0.44);
    th.add(bulb);
    foot.push(bulb);
  }
  const footLights = [-1.2, 0, 1.2].map((x) => {
    const l = new THREE.PointLight("#FFC27A", 0, 4, 1.6);
    l.position.set(x, 0.12, 0.5);
    th.add(l);
    return l;
  });
  const shaftMat = new THREE.MeshStandardMaterial({ map: tex(fluteTex()), roughness: 0.5 });
  const lanT = tex(lanternTex()), lanMat = new THREE.MeshStandardMaterial({ map: lanT, emissiveMap: lanT, emissive: "#ffffff", emissiveIntensity: 0, roughness: 0.8 });
  const capMat = new THREE.MeshStandardMaterial({ color: "#7a1f4a" }), tasMat = new THREE.MeshStandardMaterial({ color: C.gold, metalness: 0.6, roughness: 0.4 });
  const lanterns = [];
  for (const s of [-1, 1]) {
    const x = s * 2.5;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 2.15, 32), shaftMat);
    shaft.position.set(x, 1.12, 0.82);
    shaft.castShadow = shaft.receiveShadow = true;
    th.add(shaft);
    for (const [y, r3] of [[2.24, 0.17], [2.32, 0.15], [0.06, 0.18], [-0.02, 0.2]]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r3, r3, 0.07, 32), trimMat);
      ring.position.set(x, y, 0.82);
      ring.castShadow = true;
      th.add(ring);
    }
    for (const k of [-1, 1]) {
      const vol = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 10, 24), trimMat);
      vol.position.set(x + k * 0.14, 2.26, 0.9);
      th.add(vol);
    }
    const lan = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 20), lanMat);
    lan.scale.set(1, 1.22, 1);
    lan.position.set(x - s * 0.02, 1.86, 1);
    th.add(lan);
    lanterns.push(lan);
    for (const y of [1.7, 2.02]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 20), capMat);
      cap.position.set(x - s * 0.02, y, 1);
      th.add(cap);
    }
    const tas = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.14, 10), tasMat);
    tas.rotation.x = Math.PI;
    tas.position.set(x - s * 0.02, 1.6, 1);
    th.add(tas);
  }
  const lanternLights = [];
  const garland = [], garLines = [];
  const lineMat = new THREE.MeshBasicMaterial({ color: "#3a2a20" });
  for (const [z, y0, sag, n, sc] of [[0.28, 2.2, 0.2, 15, 1], [-1.35, 2.45, 0.28, 19, 0.85]]) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), x = lerp(-1.95, 1.95, u), y = y0 - sag * (1 - Math.pow(2 * u - 1, 2));
      pts.push(new THREE.Vector3(x, y, z));
      const col = i % 3 === 0 ? "#FFD27A" : i % 3 === 1 ? "#FF9EC8" : "#FFF1C9";
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.038 * sc, 16, 12), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0, roughness: 0.7 }));
      m.scale.y = 1.25;
      m.position.set(x, y - 0.05 * sc, z);
      m.userData.front = z > 0;
      th.add(m);
      garland.push(m);
    }
    const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 25e-4, 4), lineMat);
    line.userData.front = z > 0;
    th.add(line);
    garLines.push(line);
  }
  const sTex = tex(starTex()), starMat = cutMat(sTex, { roughness: 0.35, metalness: 0.7 }), starDepth = depthFor(sTex);
  const stars = [];
  const r = rng(77);
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group(), s = 0.13 + r() * 0.14, len = 0.3 + r() * 1.1;
    const st = new THREE.Mesh(new THREE.PlaneGeometry(s, s), starMat);
    st.castShadow = true;
    st.customDepthMaterial = starDepth;
    const str = new THREE.Mesh(new THREE.CylinderGeometry(2e-3, 2e-3, len, 4), strMat);
    str.position.y = len / 2 + s * 0.4;
    g.add(st, str);
    const home = new THREE.Vector3(-1.9 + r() * 3.8, 2.6 - len, -1.5 + r() * 1.5);
    g.position.copy(home);
    g.userData = { ph: r() * TAU, s, home };
    th.add(g);
    stars.push(g);
    blurList.push(g);
  }
  const moon = new THREE.Group();
  const mt = tex(moonTex());
  const mm = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 72), [new THREE.MeshStandardMaterial({ color: "#E8C978", roughness: 0.8 }), new THREE.MeshStandardMaterial({ map: mt, roughness: 0.7, emissive: "#FFE6A0", emissiveIntensity: 0.05 }), new THREE.MeshStandardMaterial({ color: "#C9A75C" })]);
  mm.rotation.x = Math.PI / 2;
  mm.castShadow = true;
  moon.add(mm);
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: "#FFD98C", blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
  moonHalo.scale.set(2.3, 2.3, 1);
  moonHalo.position.z = -0.06;
  moon.add(moonHalo);
  for (const s of [-1, 1]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(3e-3, 3e-3, 3, 4), strMat);
    st.position.set(s * 0.32, 1.95, 0);
    moon.add(st);
  }
  const moonRabbit = puppet(0.62);
  moonRabbit.position.set(-0.1, 0.55 + 0.28, 0.04);
  moonRabbit.children[2].visible = false;
  moon.add(moonRabbit);
  const mortar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.09, 20), new THREE.MeshStandardMaterial({ color: C.wood }));
  mortar.position.set(0.26, 0.6, 0.05);
  moon.add(mortar);
  const mallet = new THREE.Group();
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 12), new THREE.MeshStandardMaterial({ color: "#8a5a3c" }));
  head.rotation.z = Math.PI / 2;
  const hand = new THREE.Mesh(new THREE.CylinderGeometry(8e-3, 8e-3, 0.16, 6), new THREE.MeshStandardMaterial({ color: C.wood }));
  hand.position.y = -0.08;
  mallet.add(head, hand);
  mallet.position.set(0.26, 0.77, 0.05);
  moon.add(mallet);
  th.add(moon);
  const city = [], cityWin = [], cityWinCount = [];
  const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.35, 1, 0.55), toneMapped: false });
  [0, 1, 2, 3].forEach((L) => {
    const ct = cityTex(L), k = 4.5 / 2400, fh = ct.Hc * k, f = flat(ct.c, 4.5, fh, { thick: 0.015, back: "#0a1030", emissive: tex(ct.e), ei: 0 });
    f.position.set(0, -3, [-1.35, -1.05, -0.72, -0.6][L]);
    f.userData.h = fh;
    th.add(f);
    city.push(f);
    const n = Math.max(1, ct.win.length), im = new THREE.InstancedMesh(new THREE.PlaneGeometry(ct.ww * k, ct.wh * k), winMat, n), m4 = new THREE.Matrix4();
    ct.win.forEach(([x, y], i) => {
      m4.makeTranslation((x + ct.ww / 2) * k - 2.25, (ct.Hc - y - ct.wh / 2) * k - fh / 2, 2e-3);
      im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true;
    im.count = 0;
    im.frustumCulled = false;
    f.add(im);
    cityWin.push(im);
    cityWinCount.push(ct.win.length);
  });
  const VT = viaductTex(), viaduct = flat(VT.c, 4.6, 0.42, { thick: 0.015, back: "#0a1030", emissive: tex(VT.e), ei: 0 });
  viaduct.position.set(0, -0.75, -0.88);
  th.add(viaduct);
  const TT = trainTex(), train = flat(TT.c, 1.5, 0.28, { thick: 0.012, back: "#0a1030", emissive: tex(TT.e), ei: 0 });
  train.position.set(3.3, 0.577, -0.86);
  th.add(train);
  const pup = puppet(1.25);
  pup.position.set(0, 0.66, -0.45);
  th.add(pup);
  const screenCanvas = cv(1800, 1100), screenTex = tex(screenCanvas, false);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 2.26), new THREE.MeshStandardMaterial({ map: screenTex, emissiveMap: screenTex, emissive: "#ffffff", emissiveIntensity: 0.42, roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.97 }));
  screen.position.set(0, 1.18, -0.25);
  th.add(screen);
  const sframe = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: "#3a2216" }));
  sframe.position.set(0, 1.14, 0);
  screen.add(sframe);
  const lamp = new THREE.Group();
  const lb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), new THREE.MeshBasicMaterial({ color: "#EAF2FF", toneMapped: false }));
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(4e-3, 4e-3, 1, 4), new THREE.MeshBasicMaterial({ color: "#222" }));
  cord.position.y = 0.55;
  lamp.add(lb, cord);
  const lampLight = { intensity: 0 };
  lamp.position.set(1.05, 1.9, -1.35);
  th.add(lamp);
  const shadowPup = puppet(0.62);
  shadowPup.position.set(0.35, 1.2, -0.85);
  th.add(shadowPup);
  const parasol = new THREE.Group();
  const canMat = new THREE.MeshStandardMaterial({ color: "#C9B0EC", roughness: 0.8, side: THREE.DoubleSide, emissive: "#3a2a60", emissiveIntensity: 0.2 });
  const can = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.12, 16, 1, true), canMat);
  can.position.y = 0.16;
  can.castShadow = true;
  const trim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 6e-3, 6, 48), new THREE.MeshStandardMaterial({ color: "#FFF7EB" }));
  trim.rotation.x = Math.PI / 2;
  trim.position.y = 0.1;
  parasol.add(trim);
  const shf = new THREE.Mesh(new THREE.CylinderGeometry(6e-3, 6e-3, 0.42, 6), new THREE.MeshStandardMaterial({ color: C.wood }));
  shf.position.y = 0;
  shf.castShadow = true;
  parasol.add(can, shf);
  parasol.position.set(0.05, 0.34, 0.01);
  parasol.rotation.z = 0.12;
  parasol.scale.setScalar(0.8);
  shadowPup.add(parasol);
  const rod2 = new THREE.Mesh(new THREE.CylinderGeometry(8e-3, 8e-3, 1.4, 6), new THREE.MeshStandardMaterial({ color: C.wood }));
  rod2.position.y = -0.9;
  shadowPup.add(rod2);
  const seatRows = [], audience = [];
  const seatMat = new THREE.MeshStandardMaterial({ color: "#8E2a4c", roughness: 0.62 });
  const seatBack = new THREE.MeshStandardMaterial({ color: "#932a50", roughness: 0.6 });
  const rakeMat = new THREE.MeshStandardMaterial({ color: "#3a2152", roughness: 0.9 }), lipMat = new THREE.MeshStandardMaterial({ color: C.gold, metalness: 0.7, roughness: 0.35 });
  const seatGeo = new THREE.RoundedBoxGeometry(0.26, 0.07, 0.21, 3, 0.03), backGeo = new THREE.RoundedBoxGeometry(0.26, 0.28, 0.06, 3, 0.03), armGeo = new THREE.RoundedBoxGeometry(0.035, 0.12, 0.2, 2, 0.012);
  const armMat = new THREE.MeshStandardMaterial({ color: "#2a1630", roughness: 0.6 });
  const numMats = Array.from({ length: 13 }, (_, n) => new THREE.MeshBasicMaterial({ map: tex(seatNumTex(n + 1)) }));
  const audTexs = [0, 1, 2].map((k) => tex(audTex(k)));
  const aisleMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.2, 0.1), toneMapped: false }), aisleGeo = new THREE.SphereGeometry(0.014, 8, 6);
  const audMats = audTexs.map((t) => new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, roughness: 0.9, side: THREE.DoubleSide }));
  const ar = rng(31);
  for (let row = 0; row < 8; row++) {
    const g = new THREE.Group(), z = 1.15 + row * 0.36, y = -0.5 + row * 0.035;
    const rake = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.035 * (row + 1), 0.36), rakeMat);
    rake.position.set(0, -0.5 + 0.0175 * (row + 1), z);
    rake.receiveShadow = true;
    g.add(rake);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.012, 0.012), lipMat);
    lip.position.set(0, -0.5 + 0.035 * (row + 1), z - 0.18);
    g.add(lip);
    for (const sx of [-1, 1]) {
      const al = new THREE.Mesh(aisleGeo, aisleMat);
      al.position.set(sx * 2.25, -0.5 + 0.035 * (row + 1) + 0.01, z - 0.17);
      g.add(al);
    }
    for (let i = 0; i < 13; i++) {
      const x = -1.92 + i * 0.32;
      const seat = new THREE.Mesh(seatGeo, seatMat);
      seat.position.set(x, y + 0.14, z);
      seat.receiveShadow = true;
      const back = new THREE.Mesh(backGeo, seatBack);
      back.position.set(x, y + 0.27, z + 0.1);
      back.rotation.x = 0.12;
      back.receiveShadow = true;
      const num = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.04), numMats[i]);
      num.position.set(x, y + 0.37, z + 0.135);
      num.rotation.y = Math.PI;
      num.rotation.x = -0.12;
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.set(x + 0.16, y + 0.17, z + 0.01);
      g.add(seat, back, num, arm);
      const am = new THREE.Group(), k = Math.floor(ar() * 3);
      const silm = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.3), audMats[k]);
      silm.position.y = 0.15;
      am.add(silm);
      const pc = ["#FF7FB8", "#FFE27A", "#C8A6FF"][Math.floor(ar() * 3)];
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(8e-3, 8e-3, 0.16, 6), new THREE.MeshBasicMaterial({ color: pc, toneMapped: false }));
      pl.position.set((ar() < 0.5 ? -1 : 1) * 0.09, 0.32, -0.01);
      am.add(pl);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: pc, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
      gl.scale.set(0.16, 0.16, 1);
      gl.position.set(pl.position.x, 0.39, -0.01);
      am.add(gl);
      am.position.set(x, y + 0.16, z + 0.02);
      am.userData = { pl, gl, pc, order: ar() + row * 0.02, tilt: (ar() - 0.5) * 0.6, ph: ar() * TAU };
      g.add(am);
      audience.push(am);
    }
    g.userData.row = row;
    th.add(g);
    seatRows.push(g);
    blurList.push(g);
  }
  audience.sort((a, b2) => a.userData.order - b2.userData.order);
  const audLights = [0, 1].map(() => {
    const l = new THREE.PointLight("#ff9ad0", 0, 2.8, 1.5);
    th.add(l);
    return l;
  });
  const houseExtra = {};
  const houseFac = [], houseGlow = [], houseFans = [];
  const houseBulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.07, 0.04), toneMapped: false });
  {
    const mergeGeo = (parts2) => {
      let nv = 0, ni = 0;
      for (const p of parts2) {
        nv += p.geo.attributes.position.count;
        ni += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count;
      }
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni), nm = new THREE.Matrix3(), v = new THREE.Vector3();
      let ov = 0, oi = 0;
      for (const { geo, m } of parts2) {
        const P3 = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
        nm.getNormalMatrix(m);
        for (let i = 0; i < P3.count; i++) {
          v.fromBufferAttribute(P3, i).applyMatrix4(m);
          pos[(ov + i) * 3] = v.x;
          pos[(ov + i) * 3 + 1] = v.y;
          pos[(ov + i) * 3 + 2] = v.z;
          v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
          nor[(ov + i) * 3] = v.x;
          nor[(ov + i) * 3 + 1] = v.y;
          nor[(ov + i) * 3 + 2] = v.z;
          if (U) {
            uv[(ov + i) * 2] = U.getX(i);
            uv[(ov + i) * 2 + 1] = U.getY(i);
          }
        }
        const n = geo.index ? geo.index.count : P3.count;
        for (let i = 0; i < n; i++) idx[oi + i] = (geo.index ? geo.index.getX(i) : i) + ov;
        ov += P3.count;
        oi += n;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      return g;
    };
    const fm = tex(fluteTex());
    fm.wrapS = THREE.RepeatWrapping;
    fm.repeat.set(3, 1);
    const balMat = new THREE.MeshStandardMaterial({ map: fm, roughness: 0.55, side: THREE.DoubleSide }), velvet = new THREE.MeshStandardMaterial({ color: "#8a1f3c", roughness: 0.8 }), soffit = new THREE.MeshStandardMaterial({ color: "#4a1430", side: THREE.DoubleSide });
    const G = { front: new THREE.CylinderGeometry(0.4, 0.4, 0.26, 32, 1, true, -Math.PI / 2, Math.PI), rail: new THREE.TorusGeometry(0.4, 0.022, 8, 32, Math.PI), ring: new THREE.TorusGeometry(0.4, 0.012, 6, 32, Math.PI), floor: new THREE.CircleGeometry(0.4, 24, Math.PI, Math.PI), fan: new THREE.PlaneGeometry(0.18, 0.23) };
    const parts = { front: [], rail: [], ring: [], floor: [], fan0: [], fan1: [], fan2: [] };
    const bulbPos = [], fanGlowPos = [], fanGlowCol = [], fr = rng(44), o = new THREE.Object3D(), L = new THREE.Matrix4(), M = new THREE.Matrix4(), q = new THREE.Vector3();
    const wall = (len2, bays, x, z, ry) => {
      o.position.set(x, 0, z);
      o.rotation.set(0, ry, 0);
      o.updateMatrixWorld(true);
      const T = operaWallTex(len2, bays), mat = new THREE.MeshStandardMaterial({ map: tex(T.c), emissiveMap: tex(T.e), emissive: "#ffffff", emissiveIntensity: 0, roughness: 0.85 });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(len2, HALL.y1 - HALL.y0), mat);
      plane.position.set(x, (HALL.y1 + HALL.y0) / 2, z);
      plane.rotation.y = ry;
      th.add(plane);
      houseFac.push(mat);
      const bw = len2 / bays;
      for (let k = 0; k < bays; k++) for (const y0 of TIERS) {
        const lx = -len2 / 2 + bw * (k + 0.5), put = (key, geo, lyy, rx = 0, lz = 0, lxx = lx) => {
          L.makeRotationX(rx).setPosition(lxx, lyy, lz);
          M.multiplyMatrices(o.matrixWorld, L);
          parts[key].push({ geo, m: M.clone() });
        };
        put("front", G.front, y0 + 0.13);
        put("rail", G.rail, y0 + 0.27, Math.PI / 2);
        put("ring", G.ring, y0, Math.PI / 2);
        put("floor", G.floor, y0, -Math.PI / 2);
        q.set(lx, y0 + 0.58, 0.05).applyMatrix4(o.matrixWorld);
        bulbPos.push(q.x, q.y, q.z);
        const nf = fr() < 0.45 ? 0 : fr() < 0.5 ? 1 : 2;
        for (let f = 0; f < nf; f++) {
          const fx = lx + (nf === 1 ? 0 : f ? 0.11 : -0.11);
          put("fan" + Math.floor(fr() * 3), G.fan, y0 + 0.37, 0, 0.2, fx);
          q.set(fx + (fr() < 0.5 ? -0.07 : 0.07), y0 + 0.56, 0.21).applyMatrix4(o.matrixWorld);
          fanGlowPos.push(q.x, q.y, q.z);
          const pc = new THREE.Color(["#FF7FB8", "#FFE27A", "#C8A6FF"][Math.floor(fr() * 3)]);
          fanGlowCol.push(pc.r, pc.g, pc.b);
        }
      }
    };
    const len = HALL.z1 - HALL.z0;
    for (const sx of [-1, 1]) wall(len, 5, sx * HALL.x, (HALL.z0 + HALL.z1) / 2, -sx * Math.PI / 2);
    wall(HALL.x * 2, 7, 0, HALL.z1, Math.PI);
    for (const [key, mat] of [["front", balMat], ["rail", velvet], ["ring", trimMat], ["floor", soffit]]) th.add(new THREE.Mesh(mergeGeo(parts[key]), mat));
    const fans = new THREE.Group();
    th.add(fans);
    houseFans.push(fans);
    [0, 1, 2].forEach((k) => {
      if (parts["fan" + k].length) fans.add(new THREE.Mesh(mergeGeo(parts["fan" + k]), audMats[k]));
    });
    const fg = new THREE.BufferGeometry();
    fg.setAttribute("position", new THREE.Float32BufferAttribute(fanGlowPos, 3));
    fg.setAttribute("color", new THREE.Float32BufferAttribute(fanGlowCol, 3));
    const fanGlow = new THREE.Points(fg, new THREE.PointsMaterial({ map: glowT, size: 0.16, vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    fanGlow.frustumCulled = false;
    fans.add(fanGlow);
    const nb = bulbPos.length / 3, bim = new THREE.InstancedMesh(new THREE.SphereGeometry(0.026, 10, 8), houseBulbMat, nb), m4 = new THREE.Matrix4();
    for (let i = 0; i < nb; i++) {
      m4.makeTranslation(bulbPos[i * 3], bulbPos[i * 3 + 1], bulbPos[i * 3 + 2]);
      bim.setMatrixAt(i, m4);
    }
    bim.frustumCulled = false;
    th.add(bim);
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.Float32BufferAttribute(bulbPos, 3));
    const bglow = new THREE.Points(bg, new THREE.PointsMaterial({ map: glowT, color: "#FFC07A", size: 0.42, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    bglow.frustumCulled = false;
    th.add(bglow);
    houseGlow.push(bglow);
    const pw = new THREE.Mesh(new THREE.PlaneGeometry(HALL.x * 2, HALL.y1 - HALL.y0), new THREE.MeshStandardMaterial({ map: tex(prosWallTex(kit)), alphaTest: 0.5, roughness: 0.85 }));
    pw.position.set(0, (HALL.y1 + HALL.y0) / 2, HALL.z0);
    th.add(pw);
    const CT = ceilingTex(), cmat = new THREE.MeshStandardMaterial({ map: tex(CT.c), emissiveMap: tex(CT.e), emissive: "#ffffff", emissiveIntensity: 0, roughness: 0.9 });
    houseFac.push(cmat);
    const ceilM = new THREE.Mesh(new THREE.PlaneGeometry(HALL.x * 2, len), cmat);
    ceilM.rotation.x = Math.PI / 2;
    ceilM.position.set(0, HALL.y1, (HALL.z0 + HALL.z1) / 2);
    th.add(ceilM);
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(HALL.x * 2, len), new THREE.MeshStandardMaterial({ color: "#5a1430", roughness: 1 }));
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(0, -0.498, (HALL.z0 + HALL.z1) / 2);
    carpet.receiveShadow = true;
    th.add(carpet);
    const pit = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.32, 0.04), new THREE.MeshStandardMaterial({ map: tex(woodC), color: "#7a4a3a", roughness: 0.5 }));
    pit.position.set(0, -0.34, 0.98);
    th.add(pit);
    const pitRail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 4.7, 8), trimMat);
    pitRail.rotation.z = Math.PI / 2;
    pitRail.position.set(0, -0.17, 0.98);
    th.add(pitRail);
    const ch = new THREE.Group();
    ch.position.set(0, 4.55, 2.4);
    th.add(ch);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.9, 6), trimMat);
    chain.position.y = 0.45;
    ch.add(chain);
    ch.add(new THREE.Mesh(new THREE.LatheGeometry([[0, -0.32], [0.05, -0.29], [0.07, -0.16], [0.035, -0.06], [0.09, 0.04], [0.05, 0.14], [0, 0.2]].map(([x, y]) => new THREE.Vector2(x, y)), 24), trimMat));
    const rings = [[0.44, -0.12, 28], [0.31, 0, 22], [0.19, 0.1, 16]], beads = [], cand = [];
    for (const [rr, y, n] of rings) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.012, 8, 48), trimMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      ch.add(ring);
      for (let i = 0; i < n; i++) {
        const a0 = i / n * TAU, a1 = (i + 1) / n * TAU;
        for (let j = 0; j < 5; j++) {
          const u = (j + 0.5) / 5, a = lerp(a0, a1, u);
          beads.push(Math.cos(a) * rr, y - 0.07 * Math.sin(Math.PI * u) - 0.015, Math.sin(a) * rr);
        }
        for (let j = 1; j <= 3; j++) beads.push(Math.cos(a0) * rr, y - 0.03 - j * 0.03, Math.sin(a0) * rr);
        if (rr > 0.4 || i % 2 === 0) cand.push(Math.cos(a0) * rr, y + 0.05, Math.sin(a0) * rr);
      }
    }
    const chBeadMat = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#ffe6c0", emissiveIntensity: 0.2, metalness: 0.3, roughness: 0.12 });
    const bi = new THREE.InstancedMesh(new THREE.SphereGeometry(0.011, 8, 6), chBeadMat, beads.length / 3), ci = new THREE.InstancedMesh(new THREE.SphereGeometry(0.016, 8, 6), houseBulbMat, cand.length / 3);
    for (let i = 0; i < beads.length / 3; i++) {
      m4.makeTranslation(beads[i * 3], beads[i * 3 + 1], beads[i * 3 + 2]);
      bi.setMatrixAt(i, m4);
    }
    for (let i = 0; i < cand.length / 3; i++) {
      m4.makeTranslation(cand[i * 3], cand[i * 3 + 1], cand[i * 3 + 2]);
      ci.setMatrixAt(i, m4);
    }
    bi.frustumCulled = ci.frustumCulled = false;
    ch.add(bi, ci);
    const cg = new THREE.BufferGeometry();
    cg.setAttribute("position", new THREE.Float32BufferAttribute(cand, 3));
    const cglow = new THREE.Points(cg, new THREE.PointsMaterial({ map: glowT, color: "#FFC88A", size: 0.3, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    cglow.frustumCulled = false;
    ch.add(cglow);
    houseGlow.push(cglow);
    const chLight = new THREE.PointLight("#FFC88A", 0, 7.5, 1.1);
    chLight.position.set(0, 4.3, 2.4);
    th.add(chLight);
    Object.assign(houseExtra, { chLight, chBeadMat });
  }
  const spot = new THREE.SpotLight("#FFF1D6", 0, 12, 0.2, 0.45, 1.2);
  spot.position.set(0.5, 4.2, 2.2);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -4e-4;
  spot.target.position.set(0, 0, -0.45);
  th.add(spot, spot.target);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 4.6, 48, 1, true), new THREE.MeshBasicMaterial({ map: tex(coneTex()), color: "#FFF0D0", transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.position.copy(spot.position).lerp(spot.target.position, 0.5);
  cone.lookAt(spot.target.position);
  cone.rotateX(-Math.PI / 2);
  th.add(cone);
  const pool2 = new THREE.Mesh(new THREE.CircleGeometry(0.55, 48), new THREE.MeshBasicMaterial({ color: "#FFE9C4", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool2.rotation.x = -Math.PI / 2;
  pool2.position.set(0, 5e-3, -0.45);
  th.add(pool2);
  const rim = new THREE.SpotLight("#C8A6FF", 0, 6, 0.5, 0.7, 1.2);
  rim.position.set(0.2, 2.5, -1.55);
  rim.target.position.set(0, 0.8, -0.45);
  th.add(rim, rim.target);
  const dp = [], dr = rng(66);
  for (let i = 0; i < 420; i++) {
    const u = dr(), rr = Math.sqrt(dr()) * 0.5 * u, a = dr() * TAU;
    const p = spot.position.clone().lerp(spot.target.position, u);
    dp.push(p.x + Math.cos(a) * rr, p.y, p.z + Math.sin(a) * rr);
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute("position", new THREE.Float32BufferAttribute(dp, 3));
  const dust2 = new THREE.Points(dg, new THREE.PointsMaterial({ color: "#FFF1D0", size: 0.012, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  th.add(dust2);
  const notes = ["#FF9EC8", "#FFE27A", "#C8A6FF", "#FFFFFF", "#FF9EC8", "#C8A6FF"].map((col) => {
    const t = tex(noteTex(col)), m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.22), cutMat(t, { emissive: col, emissiveIntensity: 0.25 }));
    m.castShadow = true;
    m.customDepthMaterial = depthFor(t);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(15e-4, 15e-4, 2, 4), strMat);
    str.position.y = 1.1;
    m.add(str);
    th.add(m);
    return m;
  });
  const petals = [];
  const pt = tex(petalTex()), pm = new THREE.MeshStandardMaterial({ map: pt, alphaTest: 0.5, side: THREE.DoubleSide, emissive: "#ff9ac8", emissiveIntensity: 0.3 }), r2 = rng(8);
  for (let i = 0; i < 90; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), pm);
    m.userData = { x: -2.2 + r2() * 4.4, y: r2() * 3, z: -1.4 + r2() * 3.2, s: r2(), sp: 0.3 + r2() * 0.5 };
    th.add(m);
    petals.push(m);
  }
  const kami = new THREE.Group(), wm = new THREE.MeshStandardMaterial({ map: tex(woodC), roughness: 0.55, color: "#c08a64" });
  for (const [w2, h, d, x, y] of [[1.62, 0.1, 0.22, 0, 0.56], [1.62, 0.1, 0.22, 0, -0.56], [0.1, 1.22, 0.22, -0.76, 0], [0.1, 1.22, 0.22, 0.76, 0]]) {
    const bx = new THREE.Mesh(new THREE.BoxGeometry(w2, h, d), wm);
    bx.position.set(x, y, 0);
    bx.castShadow = bx.receiveShadow = true;
    kami.add(bx);
  }
  for (const s of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.74, 1.02, 0.03), wm);
    door.geometry.translate(s * 0.37, 0, 0);
    door.position.set(s * 0.8, 0, 0.1);
    door.rotation.y = s * -0.12;
    door.castShadow = true;
    kami.add(door);
  }
  const kamiCards = kit.cards.map((c, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.8), new THREE.MeshBasicMaterial({ map: tex(c, false), toneMapped: false }));
    m.position.z = 0.02 - i * 4e-3;
    kami.add(m);
    return m;
  });
  const kback = new THREE.Mesh(new THREE.PlaneGeometry(1.52, 1.12), new THREE.MeshStandardMaterial({ color: "#1a0e0a", roughness: 1 }));
  kback.position.z = -0.1;
  kami.add(kback);
  const kstand = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.3), wm);
  kstand.position.set(0, -0.85, -0.05);
  kami.add(kstand);
  kami.position.set(0, 1.1, -0.35);
  th.add(kami);
  const waves = flat(wavesTex(), 4.45, 0.37, { thick: 0.012, back: "#0b1238" });
  waves.position.set(0, 0.12, 0.3);
  th.add(waves);
  const clouds = flat(cloudsTex(), 4.7, 0.7, { thick: 0.012, back: "#3a2a60" });
  clouds.position.set(0, 0.3, -1.5);
  th.add(clouds);
  const hemi = new THREE.HemisphereLight("#6f86d8", "#1a0d22", 0.35);
  scene.add(hemi);
  const moonKey = new THREE.DirectionalLight("#9db4ff", 0.6);
  moonKey.position.set(-3, 5, 4);
  moonKey.castShadow = true;
  moonKey.shadow.mapSize.set(1024, 1024);
  Object.assign(moonKey.shadow.camera, { left: -4, right: 4, top: 4, bottom: -2, near: 0.5, far: 20 });
  moonKey.shadow.bias = -5e-4;
  scene.add(moonKey);
  const warm = new THREE.SpotLight("#FFC9A0", 0, 10, 0.5, 0.6, 1);
  warm.position.set(-1.5, 3.5, 3.2);
  warm.target.position.set(0, 0.6, -0.5);
  warm.castShadow = true;
  warm.shadow.mapSize.set(1024, 1024);
  scene.add(warm, warm.target);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.25;
  pmrem.dispose();
  scene.traverse((o) => {
    if (o.isLight) {
      o.layers.enableAll();
      if (o.shadow) o.shadow.camera.layers.enableAll();
    }
  });
  scene.fog = new THREE.FogExp2("#0b1338", 0.035);
  const w = {
    THREE,
    scene,
    camera,
    renderer,
    th,
    room,
    pros,
    prosMat: pros.userData.mat,
    drapes,
    backdrop,
    backTex,
    foot,
    footLights,
    lanternLights,
    lanterns,
    garland,
    garLines,
    stars,
    moon,
    moonRabbit,
    mallet,
    city,
    cityWin,
    cityWinCount,
    pup,
    shadowPup,
    screen,
    screenTex,
    screenCanvas,
    fibre: fibreTex(),
    lamp,
    lampLight,
    seatRows,
    audience,
    audLights,
    spot,
    cone,
    pool: pool2,
    rim,
    dust: dust2,
    notes,
    petals,
    kami,
    kamiCards,
    waves,
    clouds,
    winLight,
    hemi,
    moonKey,
    warm,
    blurList,
    bulbs,
    texc,
    kit,
    houseBulbMat,
    houseGlow,
    houseFac,
    houseFans,
    chLight: houseExtra.chLight,
    chBeadMat: houseExtra.chBeadMat,
    train,
    viaduct,
    moonHalo,
    aisleMat
  };
  resetWorld(w);
  footlights(w, 1);
  w.spot.intensity = 1;
  w.rim.intensity = 1;
  w.lampLight.intensity = 1;
  w.warm.intensity = 1;
  w.winLight.intensity = 0.1;
  w.audLights.forEach((l) => l.intensity = 0.1);
  for (const o of [moon, screen, lamp, shadowPup, pup, kami, cone, dust2, train, viaduct, ...notes, ...petals, ...audience, ...city, ...houseFans]) o.visible = true;
  setHouse(w, 1);
  renderer.shadowMap.needsUpdate = true;
  return w;
}
function setPose(w, g, front, back = front) {
  const id = front + "|" + back;
  if (g.userData.key === id) return;
  g.userData.key = id;
  const { f, b, h } = g.userData;
  for (const [m, key] of [[f, front + "front"], [b, back + "back"]]) {
    const t = w.texc[key];
    m.material.map = t.tex;
    m.customDepthMaterial = t.depth;
    m.scale.set(h * t.aspect, h, 1);
  }
}
function setBulbs(w, n, chase = -1) {
  w.bulbs.forEach((b, i) => {
    const on = i < n && !(chase >= 0 && (i + chase) % 3 === 0);
    b.material.color.setRGB(on ? 2.4 : 0.05, on ? 1.9 : 0.04, on ? 1.1 : 0.03);
  });
}
function setHouse(w, lamps, fans = lamps > 0.5) {
  w.houseBulbMat.color.setRGB(0.1 + 2.1 * lamps, 0.07 + 1.5 * lamps, 0.04 + 0.9 * lamps);
  w.houseGlow.forEach((p) => p.material.opacity = 0.7 * lamps);
  w.houseFac.forEach((m) => m.emissiveIntensity = 0.85 * lamps);
  w.chLight.intensity = 2.4 * lamps;
  w.chBeadMat.emissiveIntensity = 0.15 + 1.1 * lamps;
  w.aisleMat.color.setRGB(0.25 + 1.2 * lamps, 0.17 + 0.8 * lamps, 0.08 + 0.35 * lamps);
  w.houseFans.forEach((a) => a.visible = fans);
}
function setDrapes(w, closed) {
  w.drapes.forEach((g) => {
    g.scale.x = lerp(0.16, 1, clamp2(closed));
  });
}
function footlights(w, a) {
  w.foot.forEach((b, i) => b.material.color.set(a > i / 9 ? "#FFE6B0" : "#3a2a20"));
  w.footLights.forEach((l) => l.intensity = 2.2 * a);
  w.lanternLights.forEach((l) => l.intensity = 1.6 * a);
  w.lanterns.forEach((l) => l.material.emissiveIntensity = 0.9 * a);
  w.garland.forEach((g, i) => g.material.emissiveIntensity = a > i / w.garland.length ? 1.6 : 0.05);
}
function setBackdrop(w, key, glow) {
  const m = w.backdrop.material, t = w.backTex[key];
  m.map = t;
  m.emissiveMap = t;
  m.emissiveIntensity = glow;
}
function poseStars(w, t) {
  const tt = on2(t);
  w.stars.forEach((s) => {
    s.position.copy(s.userData.home);
    s.scale.setScalar(1);
    s.rotation.set(0, Math.sin(tt * 1.3 + s.userData.ph) * 0.5, Math.sin(tt * 0.9 + s.userData.ph) * 0.05);
    s.visible = true;
  });
}
function setAudience(w, n, t, wave = 0) {
  w.audience.forEach((a, i) => {
    a.visible = i < n;
    const u = a.userData;
    u.pl.rotation.z = u.tilt + Math.sin(t * Math.PI + u.ph) * 0.25 * wave;
    a.scale.setScalar(1);
  });
  const lit = w.audience.slice(0, n), v = new w.THREE.Vector3();
  w.audLights.forEach((l, k) => {
    const a = lit[Math.floor((k + 0.5) * lit.length / w.audLights.length)];
    if (!a || !n) {
      l.intensity = 0;
      return;
    }
    a.getWorldPosition(v);
    l.position.set(v.x, v.y + 0.35, v.z);
    l.color.set(a.userData.pc);
    l.intensity = 0.9;
  });
}
function popAudience(w, i, age) {
  const a = w.audience[i];
  if (!a) return;
  const step = Math.floor(age * 12);
  a.scale.setScalar(step <= 0 ? 0.3 : step === 1 ? 0.8 : step === 2 ? 1.15 : 1);
}
function drawScreen(w, u, tt) {
  const c = w.screenCanvas, g = g22(c), cw = c.width, ch = c.height;
  const gr = g.createRadialGradient(cw * 0.8, ch * 0.2, 30, cw * 0.62, ch * 0.48, cw * 0.85);
  gr.addColorStop(0, "#EEF3FF");
  gr.addColorStop(0.28, "#B4C6EF");
  gr.addColorStop(0.62, "#6A84C8");
  gr.addColorStop(1, "#2A3C86");
  g.fillStyle = gr;
  g.fillRect(0, 0, cw, ch);
  const mg = g.createRadialGradient(cw * 0.8, ch * 0.2, 0, cw * 0.8, ch * 0.2, 150);
  mg.addColorStop(0, "rgba(255,255,255,.9)");
  mg.addColorStop(0.6, "rgba(255,255,255,.55)");
  mg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = mg;
  g.fillRect(0, 0, cw, ch);
  const bm = g.createLinearGradient(cw * 0.8, ch * 0.2, cw * 0.1, ch);
  bm.addColorStop(0, "rgba(255,255,255,.22)");
  bm.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = bm;
  g.beginPath();
  g.moveTo(cw * 0.76, ch * 0.14);
  g.lineTo(cw * 0.86, ch * 0.26);
  g.lineTo(cw * 0.2, ch * 1.05);
  g.lineTo(cw * -0.05, ch * 0.9);
  g.closePath();
  g.fill();
  g.fillStyle = "rgba(30,40,100,.42)";
  for (const [cx, cy, s] of [[cw * 0.25 + u * 160, ch * 0.28, 1], [cw * 0.55 - u * 220, ch * 0.55, 0.8]]) {
    g.beginPath();
    g.ellipse(cx, cy, 160 * s, 46 * s, 0, 0, TAU);
    g.ellipse(cx - 90 * s, cy + 10, 90 * s, 34 * s, 0, 0, TAU);
    g.ellipse(cx + 100 * s, cy + 14, 80 * s, 30 * s, 0, 0, TAU);
    g.fill();
  }
  const px = lerp(cw * 0.68, cw * 0.3, u), py = lerp(ch * 0.28, ch * 0.74, u);
  g.save();
  g.translate(px, py);
  g.rotate(Math.sin(tt * 3) * 0.07);
  g.globalAlpha = 0.88;
  g.shadowColor = "rgba(26,16,56,.9)";
  g.shadowBlur = 7;
  const sh = w.kit.pose.moonlight.sil, sw = 230, shh = sw * sh.height / sh.width;
  g.drawImage(sh, -sw / 2, -shh / 2 + 60, sw, shh);
  g.fillStyle = "#1a1038";
  g.beginPath();
  g.moveTo(-150, -150);
  g.quadraticCurveTo(0, -260, 150, -150);
  g.lineTo(-150, -150);
  g.fill();
  g.fillRect(-4, -170, 8, 190);
  g.restore();
  g.drawImage(w.fibre, 0, 0);
  g.lineCap = "butt";
  for (const [lw, col, off] of [[14, "#24150e", 0], [3, "rgba(150,110,80,.6)", -5]]) {
    g.strokeStyle = col;
    g.lineWidth = lw;
    g.beginPath();
    for (let x = 0; x <= cw + 1; x += cw / 6) {
      g.moveTo(x + off, 0);
      g.lineTo(x + off, ch);
    }
    for (let y = 0; y <= ch + 1; y += ch / 4) {
      g.moveTo(0, y + off);
      g.lineTo(cw, y + off);
    }
    g.stroke();
  }
  g.fillStyle = "#24150e";
  g.fillRect(0, ch / 2 - 13, cw, 26);
  g.fillStyle = "rgba(150,110,80,.5)";
  g.fillRect(0, ch / 2 - 13, cw, 3);
  w.screenTex.needsUpdate = true;
}
function setCityLit(w, rise, lit) {
  w.city.forEach((c, i) => {
    const h = c.userData.h;
    c.position.y = lerp(-h / 2 - 0.05, [-0.9, -0.85, -0.8, -0.11][i] + h / 2, rise[i]);
    c.userData.mat.emissiveIntensity = 0.55 * lit;
  });
  w.viaduct.visible = true;
  w.viaduct.position.y = lerp(-0.3, 0.29, rise[1]);
  w.viaduct.userData.mat.emissiveIntensity = 1.2 * lit;
  w.cityWin.forEach((m, i) => {
    m.count = Math.floor(w.cityWinCount[i] * lit * 0.8);
  });
}
function camSet(w, pos, look, fov) {
  w.camera.position.set(pos[0], pos[1], pos[2]);
  w.camera.fov = fov;
  w.camera.lookAt(look[0], look[1], look[2]);
}
function resetWorld(w) {
  w.th.visible = true;
  w.room.visible = true;
  w.moon.visible = false;
  w.moon.position.set(0.55, 3.2, -0.95);
  w.moonRabbit.rotation.set(0, Math.PI, 0);
  w.mallet.rotation.set(0, 0, 0);
  w.city.forEach((c) => {
    c.visible = false;
    c.position.y = -3;
  });
  w.cityWin.forEach((m) => m.count = 0);
  w.viaduct.visible = false;
  w.viaduct.position.y = -0.75;
  w.train.visible = false;
  w.train.position.x = 3.3;
  w.train.userData.mat.emissiveIntensity = 0;
  setHouse(w, 0);
  w.moonHalo.material.opacity = 0.55;
  w.screen.visible = false;
  w.lamp.visible = false;
  w.shadowPup.visible = false;
  w.shadowPup.rotation.set(0, 0, 0);
  w.shadowPup.position.set(0.35, 1.2, -0.85);
  w.lampLight.intensity = 0;
  w.pup.visible = false;
  w.pup.position.set(0, 0.66, -0.45);
  w.pup.rotation.set(0, Math.PI, 0);
  w.pup.scale.setScalar(1);
  w.kami.visible = false;
  w.kamiCards.forEach((c, i) => {
    c.position.x = 0;
    c.visible = true;
    c.position.z = 0.02 - i * 4e-3;
  });
  w.cone.visible = false;
  w.pool.material.opacity = 0;
  w.dust.visible = false;
  w.audience.forEach((a) => {
    a.visible = false;
    a.scale.setScalar(1);
  });
  w.audLights.forEach((l) => l.intensity = 0);
  w.notes.forEach((n) => n.visible = false);
  w.petals.forEach((p) => p.visible = false);
  footlights(w, 0);
  setBulbs(w, 26);
  w.spot.intensity = 0;
  w.warm.intensity = 0;
  w.rim.intensity = 0;
  w.winLight.intensity = 0;
  w.moonKey.intensity = 0.55;
  w.hemi.intensity = 0.3;
  w.prosMat.emissiveIntensity = 0;
  setBackdrop(w, "star", 0);
  w.backdrop.position.y = 1.35;
  setDrapes(w, 1);
  w.stars.forEach((s) => s.visible = true);
  w.seatRows.forEach((r) => r.visible = true);
  w.garland.forEach((g) => g.visible = true);
  w.garLines.forEach((l) => l.visible = true);
  w.waves.visible = true;
  w.clouds.visible = true;
  setPose(w, w.pup, "happy", "moonlight");
  setPose(w, w.moonRabbit, "mooncake");
  setPose(w, w.shadowPup, "moonlight");
  w.scene.fog.density = 0.035;
  w.scene.environmentIntensity = 0.25;
}
function assignLayers(w, near, far) {
  const cp = w.camera.position, v = new w.THREE.Vector3(), used = [0, 0, 0];
  for (const o of w.blurList) {
    if (o.userData.row !== void 0) v.set(0, -0.3, 1.15 + o.userData.row * 0.36);
    else o.getWorldPosition(v);
    const d = v.distanceTo(cp);
    const L = near && d < near ? LAYER_FG : far && d > far ? LAYER_BG : LAYER_MAIN;
    if (o.userData.layer !== L) {
      o.userData.layer = L;
      o.traverse((c) => c.layers.set(L));
    }
    if (o.visible) used[L]++;
  }
  return used;
}
function render3D(ctx, s, o = {}) {
  const w = s.objects, R = s.renderer;
  const pw = Math.max(1, Math.round(W * ctx.renderScale)), ph = Math.max(1, Math.round(H * ctx.renderScale));
  if (s.surface.width !== pw || s.surface.height !== ph) R.setSize(pw, ph, false);
  w.camera.aspect = W / H;
  w.camera.updateProjectionMatrix();
  R.toneMappingExposure = o.exposure ?? 1;
  const near = o.near ?? 0, far = o.far ?? 0, alpha = o.alpha ?? 1;
  const used = assignLayers(w, near, far);
  R.shadowMap.needsUpdate = true;
  const pass = (layer2) => {
    w.camera.layers.set(layer2);
    R.render(w.scene, w.camera);
  };
  const draw = (c) => {
    c.imageSmoothingQuality = "high";
    c.drawImage(s.surface, 0, 0, W, H);
  };
  if (far && used[LAYER_BG]) {
    pass(LAYER_BG);
    blurLayer(ctx, "dof-bg", o.bgBlur ?? 6, draw, { alpha });
  }
  pass(LAYER_MAIN);
  ctx.withCanvas((c) => {
    c.globalAlpha = alpha;
    draw(c);
  });
  if (o.bloom) bloom(ctx, (c) => {
    c.filter = "brightness(.55) contrast(2.6)";
    draw(c);
    c.filter = "none";
  }, { radius: 14, strength: o.bloom * alpha, halo: 0.8 });
  if (near && used[LAYER_FG]) {
    pass(LAYER_FG);
    blurLayer(ctx, "dof-fg", o.fgBlur ?? 14, draw, { alpha });
  }
  w.camera.layers.set(LAYER_MAIN);
}

// scenes/main.ts
var BEATS = beats([
  { title: "S01 \u958B\u5834\u30FB\u8DD1\u99AC\u71C8", end: 4.5, stop: 3.6, handoff: 0.8, note: "Marquee bulbs light one by one; pull back to the theatre on the maker's desk; drapes open." },
  { title: "S02 \u6708\u4E0A\u7684\u5154\u5B50", end: 8, stop: 6.8, handoff: 0.8, note: "Paper moon lowered; the moon rabbit with her mooncake; rack focus." },
  { title: "S03 \u5730\u4E0A\u7684\u7D19\u57CE\u93AE", end: 12, stop: 11, handoff: 0.5, note: "Town flats rise in three layers; windows light one by one; a paper train crosses the viaduct." },
  { title: "S04 \u5979\u7684\u773C\u775B", end: 16, stop: 14.6, handoff: 0.6, note: "2D: profile close-up, the town lights in her eye; washi screen slides in." },
  { title: "S05 \u7D19\u5C4F\u8207\u62C9\u9580", end: 20, stop: 17.6, handoff: 0.6, note: "Shadow play on the washi screen; it splits into shoji doors that slide open onto the sky." },
  { title: "S06 \u7A7F\u904E\u96F2\u6D77", end: 24, stop: 22.2, handoff: 0.6, note: "2D: she floats down through paper clouds; lands on 23.5." },
  { title: "S07 \u7A7A\u8569\u7684\u821E\u53F0", end: 28.6, stop: 26.8, handoff: 0.4, note: "One spotlight, empty seats; she trembles; the light flickers." },
  { title: "S08 \u6DF1\u547C\u5438", end: 32, stop: 30.8, handoff: 0.6, note: "2D: a deep breath inside the circle of light; iris opens into 3D." },
  { title: "S09 \u7B2C\u4E00\u9996\u6B4C", end: 40, stop: 38.6, handoff: 0.8, note: "She sings; fans arrive one per beat, then faster; penlights." },
  { title: "S10 \u7FFB\u9762\u30FB\u6708\u4EAE\u5076\u50CF", end: 43, stop: 42.2, handoff: 0.8, note: "The puppet card flips to full colour on 40; footlights blaze; petals." },
  { title: "S11 \u6708\u4EAE\u5076\u50CF\u6D77\u5831", end: 46, stop: 45, handoff: 0.6, note: "2D poster; pulled away like a kamishibai card." },
  { title: "S12 \u5979\u7684\u6BCF\u4E00\u591C", end: 54, stop: 50.4, handoff: 0.8, note: "Push into the kamishibai box until the 2D card fills the frame; three cards." },
  { title: "S13 \u8B1D\u5E55", end: 60, stop: 57.4, note: "Curtain call, bow on 58; the drapes close, the house lights come up, fade." }
]);
var DUR = BEATS.duration;
var inCubic = (p) => p * p * p;
var meta = { width: W, height: H, duration: DUR, fps: 30, background: "#060a20", shots: BEATS.shots, tempo: { bpm: 120, beatsPerBar: 4, offset: 0 } };
var params = {};
async function setup(ctx) {
  const kit = await bakeKit(ctx);
  const stage = await prepareStage(ctx, (b) => buildWorld(b, kit), { fov: 36, toneMapping: "aces", exposure: 1 });
  ctx.assets.lunar = { kit, stage, fx: bakeFX(), frame: bakeFrame() };
}
function camKeys(list) {
  const ch = [1, 2, 3, 4, 5, 6, 7].map((i) => keys(list.map((k) => [k[0], k[i]])));
  return (t) => ch.map((f) => f(t));
}
var CAM_A = camKeys([
  // S01–S03
  [0, 0, 3.22, 2.7, 0, 3.22, 0.6, 34],
  [1.35, 0, 3.2, 2.45, 0, 3.2, 0.6, 34],
  [2.3, 0.2, 1.9, 4.75, -0.1, 3.75, 1.4, 54],
  [3.2, 0.2, 1.45, 4.7, 0, 1.45, 0, 50],
  [3.9, 0.15, 1.3, 4.3, 0, 1.3, -0.1, 44],
  [4.5, 0.14, 1.3, 3.1, 0.4, 1.55, -0.95, 32],
  [7.5, 0.15, 1.7, 2.2, 0.5, 1.8, -0.95, 28],
  [8.3, 0, 2.05, 1.6, 0, 1.45, -1.2, 36],
  [11.55, 0.25, 0.62, 1.75, 0, 0.78, -1.1, 36],
  [12, 0.22, 0.6, 1.25, 0.12, 0.62, -1.05, 30]
]);
var CAM_B = camKeys([
  // S05
  [16, 0, 1.18, 2.95, 0, 1.18, -0.25, 36],
  [17.9, 0, 1.16, 3.45, 0, 1.15, -0.3, 36],
  [19, 0, 1.18, 2.85, 0, 1.18, -0.25, 36],
  [20, 0, 1.18, 2.8, 0, 1.18, -0.25, 36]
]);
var CAM_C = camKeys([[24, 0.5, 0.46, 4.6, 0, 0.64, -0.45, 30], [28.6, 0.3, 0.48, 3.45, 0, 0.68, -0.45, 30]]);
var CAM_E = camKeys([
  // S10
  [40, 0, 0.3, 2.15, 0, 0.92, -0.45, 38],
  [40.4, 0, 0.3, 2.1, 0, 0.94, -0.45, 38],
  [42.7, 0.38, 0.5, 2.4, 0, 1, -0.45, 38],
  [43, 0.4, 0.52, 2.42, 0, 1, -0.45, 38]
]);
var CAM_F = camKeys([
  // S12
  [46, 0, 0.95, 2.6, 0, 0.95, -0.35, 34],
  [46.5, 0, 0.97, 2.4, 0, 0.98, -0.35, 34],
  [48, 0, 1.1, 1.079, 0, 1.1, -0.35, 34],
  [53.3, 0, 1.1, 1.079, 0, 1.1, -0.35, 34],
  [54, 0, 0.95, 2.6, 0, 0.95, -0.35, 34]
]);
var CAM_G = camKeys([
  // S13: pull back through the house (never past its back wall) and hold on the closing drapes
  [54, 0, 0.95, 2.6, 0, 0.95, -0.35, 34],
  [55.2, 0, 1, 3.3, 0, 0.95, -0.2, 34],
  [56.4, 0.12, 1.25, 4.4, 0, 1.12, -0.25, 40],
  [58.2, 0.14, 1.68, 4.65, 0, 1.72, -0.2, 58],
  [60, 0.1, 1.72, 4.75, 0, 1.76, -0.2, 58]
]);
function cam(w, k, t) {
  const a = 55e-4, sx = vnoise(t * 0.9, 11) * a, sy = vnoise(t * 0.8, 12) * a, lx = vnoise(t * 0.7, 13) * a * 0.6, ly = vnoise(t * 0.75, 14) * a * 0.6;
  camSet(w, [k[0] + sx, k[1] + sy, k[2]], [k[3] + sx + lx, k[4] + sy + ly, k[5]], k[6]);
}
var FANS = 104;
var FAN0 = 32.5;
var FAN_SPAN = 7;
var fanTime = (i) => FAN0 + FAN_SPAN * Math.pow(i / FANS, 0.45);
var fansAt = (t) => t < FAN0 ? 0 : Math.min(FANS, Math.floor(FANS * Math.pow(clamp2((t - FAN0) / FAN_SPAN), 1 / 0.45)) + 1);
function poseS01(w, t) {
  const tt = on2(t);
  poseStars(w, t);
  footlights(w, clamp2((tt - 1.6) / 0.8));
  setDrapes(w, 1 - ease.inOutCubic(P(tt, 2.6, 3.75)));
  setBulbs(w, Math.floor(clamp2((tt - 0.3) / 1) * 26));
  w.moonKey.intensity = 0.1 + 0.2 * P(t, 1.4, 2.6);
  w.warm.intensity = 3 * P(t, 1.5, 2.5);
  w.hemi.intensity = 0.12 + 0.22 * P(t, 1.4, 2.6);
  w.prosMat.emissiveIntensity = 0.6 * clamp2((tt - 1.6) / 0.8);
  w.scene.environmentIntensity = 0.04 + 0.21 * P(t, 1.3, 2.4);
  setHouse(w, P(t, 1.5, 2.2) * (1 - 0.8 * P(t, 2.6, 3.6)), false);
  cam(w, CAM_A(t), t);
  return { near: t > 2.4 ? 2.4 : 0, fgBlur: 14, bloom: 0.4 };
}
function poseS02(w, t) {
  poseStars(w, t);
  footlights(w, 1);
  setDrapes(w, 0);
  w.moon.visible = true;
  const tt = on2(t), steps = Math.floor((tt - 4.45) * 12);
  const drop = tt < 4.2 ? 0 : steps < 3 ? eo((steps + 3) / 9) : steps < 6 ? eo((steps + 3) / 9) : steps === 6 ? 1.06 : 1;
  const flyUp = inCubic(P(t, 7.55, 8.05));
  w.moon.position.set(0.55, lerp(3.2, 1.3, drop) + flyUp * 2.4, -0.95);
  w.moon.rotation.z = Math.sin(tt * 1.5) * 0.02;
  const beat = tt * 2 % 1;
  w.mallet.rotation.z = beat < 0.33 ? -0.9 : beat < 0.66 ? -0.3 : 0.2;
  w.garland.forEach((g) => {
    if (g.userData.front) g.visible = false;
  });
  w.garLines.forEach((l) => {
    if (l.userData.front) l.visible = false;
  });
  w.warm.intensity = 2.2;
  w.prosMat.emissiveIntensity = 0.6;
  setHouse(w, 0.35, false);
  const fs = w.stars[0];
  fs.position.set(-0.05, 1.62, 1.05);
  fs.scale.setScalar(1.2);
  cam(w, CAM_A(t), t);
  const rack = ease.inOutCubic(P(t, 5.6, 6.2));
  return { near: 1.6, fgBlur: lerp(2, 22, rack), bloom: 0.18 };
}
function poseS03(w, t) {
  poseStars(w, t);
  footlights(w, 1);
  setDrapes(w, 0);
  setBackdrop(w, "foot", 0);
  w.moon.visible = true;
  w.moon.position.set(0.95, lerp(3.6, 1.62, ease.outCubic(P(t, 8, 8.9))), -1.5);
  w.city.forEach((c) => c.visible = true);
  const tt = on2(t), rise = [0, 1, 2, 3].map((i) => eo(clamp2(Math.floor(P(tt, 8.2 + i * 0.25, 10.2 + i * 0.25) * 6) / 6)));
  setCityLit(w, rise, P(tt, 9, 12));
  setHouse(w, 0.35, false);
  const tr = P(tt, 9.4, 11.9);
  w.train.visible = true;
  w.train.position.x = lerp(3.3, -3.3, tr);
  w.train.position.y = 0.577 + Math.floor(tt * 12) % 2 * 4e-3;
  w.train.userData.mat.emissiveIntensity = 1.3;
  w.warm.intensity = 1.2;
  w.moonKey.intensity = 0.7;
  w.prosMat.emissiveIntensity = 0.5;
  w.garland.forEach((g) => {
    if (g.userData.front) g.visible = false;
  });
  w.garLines.forEach((l) => {
    if (l.userData.front) l.visible = false;
  });
  cam(w, CAM_A(t), t);
  return { near: 1, bloom: 0.45 + 0.5 * P(t, 11.6, 12) };
}
function poseS05(w, t) {
  footlights(w, 0.6);
  setDrapes(w, 0);
  w.stars.forEach((s) => s.visible = false);
  w.clouds.visible = false;
  w.screen.visible = true;
  const tt = on2(t), u = P(tt, 16, 23.5);
  drawScreen(w, u, tt);
  w.moonKey.intensity = 0.25;
  w.hemi.intensity = 0.2;
  w.prosMat.emissiveIntensity = 0.3;
  cam(w, CAM_B(t), t);
  return { bloom: 0.3, exposure: 0.9 };
}
function poseS07(w, t) {
  setDrapes(w, 0);
  poseStars(w, t);
  w.pup.visible = true;
  setPose(w, w.pup, "happy", "sad");
  const tt = on2(t), tremble = Math.sin(tt * 40) * 4e-3 * (tt > 26 ? 1.6 : 1);
  w.pup.rotation.y = Math.PI * 0.92 + Math.sin(tt * 37) * 0.01;
  w.pup.position.set(0, 0.66 + tremble, -0.45);
  const flick = Math.abs(t - 28.6) < 0.07 ? 0.15 : 1;
  w.spot.intensity = 5 * flick;
  w.cone.visible = true;
  w.pool.material.opacity = 0.25 * flick;
  w.rim.intensity = 2.5;
  w.dust.visible = true;
  w.dust.rotation.y = tt * 0.05;
  w.moonKey.intensity = 0.08;
  w.hemi.intensity = 0.08;
  w.prosMat.emissiveIntensity = 0.05;
  w.scene.fog.density = 0.06;
  cam(w, CAM_C(t), t);
  return { near: 2.6, fgBlur: 7, bloom: 0.45, exposure: 1 };
}
function poseS09(w, t) {
  setDrapes(w, 0);
  poseStars(w, t);
  w.clouds.visible = false;
  w.pup.visible = true;
  w.pup.position.set(0, 0.66 + Math.max(0, Math.sin(on2(t) * Math.PI * 2)) * 0.01, -0.45);
  w.pup.rotation.y = Math.PI;
  const n = fansAt(on2(t));
  setAudience(w, n, t, P(t, 37, 39));
  for (let i = Math.max(0, n - 6); i < n; i++) popAudience(w, i, on2(t) - fanTime(i));
  w.notes.forEach((m, i) => {
    const ph = ((t - 32.2) * 0.35 + i / 6) % 1;
    m.visible = t > 32.2;
    m.position.set(-0.5 + i % 3 * 0.5 + Math.sin(i) * 0.1, 0.9 + Math.floor(ph * 12) / 12 * 1.5, -0.5 + i % 2 * 0.2);
    m.rotation.z = Math.sin(on2(t) * 2 + i) * 0.3;
  });
  w.rim.intensity = 1.6;
  w.dust.visible = true;
  w.dust.rotation.y = t * 0.05;
  w.spot.intensity = 2.2;
  w.cone.visible = true;
  w.pool.material.opacity = 0.2;
  const lift = P(t, 36, 39.5);
  footlights(w, lift * 0.55 + P(t, 39.6, 40) * 0.15);
  setHouse(w, P(t, 36.5, 39.5), t > 37.6);
  w.hemi.intensity = 0.1 + lift * 0.15;
  w.moonKey.intensity = 0.1 + lift * 0.2;
  if (t > 39.5) {
    setBackdrop(w, "end", 0.32 * P(t, 39.5, 40.3));
    w.backdrop.position.y = lerp(4.2, 1.35, ease.outCubic(P(t, 39.5, 40.3)));
  }
  const a = ease.inOutCubic(P(t, 32, 35.2)), b = ease.inOutCubic(P(t, 35.2, 36.4)), c = P(t, 36.4, 39.5);
  const ang1 = lerp(0.45, 0.85, a), rad1 = lerp(3.1, 2.2, a), ang2 = lerp(1.72, 1.82, c), rad2 = lerp(1.38, 1.25, c);
  const o1 = [Math.sin(ang1) * rad1, lerp(0.95, 1.05, a), -0.45 + Math.cos(ang1) * rad1, 0, 0.72, -0.45, 34];
  const o2 = [Math.sin(ang2) * rad2, lerp(1.45, 1.55, c), -0.45 + Math.cos(ang2) * rad2, lerp(-0.2, -0.3, c), 0.35, 1.5, 42];
  const orb = o1.map((v, i) => lerp(v, o2[i], b));
  const sw = ease.inOutCubic(P(t, 39.5, 40)), end = CAM_E(40);
  cam(w, orb.map((v, i) => lerp(v, end[i], sw)), t);
  return { near: 0.5, fgBlur: 12, bloom: 0.4, exposure: 0.8 };
}
function poseS10(w, t) {
  setDrapes(w, 0);
  poseStars(w, t);
  w.clouds.visible = false;
  w.pup.visible = true;
  setPose(w, w.pup, "happy", "moonlight");
  const step = clamp2(Math.floor((t - 40) * 12 + 1e-6), 0, 3);
  w.pup.rotation.y = Math.PI * (1 - step / 3);
  const hop = t < 40.4 ? 0 : Math.max(0, Math.sin((on2(t) - 40.4) * Math.PI * 2)) * 0.04;
  w.pup.position.set(0, 0.66 + hop, -0.45);
  footlights(w, 1);
  const lit = P(t, 40.2, 40.8);
  w.footLights.forEach((l) => l.intensity = lerp(1, 1.8, lit));
  w.warm.intensity = lerp(0.6, 1.2, lit);
  w.rim.intensity = lerp(1.2, 2.2, lit);
  w.hemi.intensity = 0.35;
  w.moonKey.intensity = 0.5;
  w.prosMat.emissiveIntensity = 1.2;
  setBackdrop(w, "end", 0.32 * (0.5 + 0.5 * P(t, 40.2, 40.8)));
  w.backdrop.position.y = lerp(4.2, 1.35, ease.outCubic(P(t, 39.5, 40.3)));
  setAudience(w, FANS, t, 1);
  setHouse(w, 1);
  w.petals.forEach((p, i) => {
    const d = p.userData;
    p.visible = t > 40.1;
    const y = d.y + 3 - (t - 40) * d.sp % 3.2;
    p.position.set(d.x + Math.sin(t + i) * 0.1, y, d.z);
    p.rotation.set(t * d.s * 3, t * 2 + i, i);
  });
  cam(w, CAM_E(t), t);
  return { near: 0.9, fgBlur: 10, bloom: 0.2, exposure: 0.72 };
}
function poseS12(w, t) {
  setDrapes(w, ease.inOutCubic(P(t, 53.4, 53.85)));
  poseStars(w, t);
  footlights(w, 1);
  w.kami.visible = true;
  w.hemi.intensity = 0.3;
  setHouse(w, 1);
  w.warm.intensity = 3;
  w.prosMat.emissiveIntensity = 0.9;
  setBackdrop(w, "stage2", 0.35);
  w.clouds.visible = false;
  w.seatRows.forEach((r) => r.visible = false);
  const card = t < 48.8 ? 0 : t < 51.5 ? 1 : 2;
  w.kamiCards.forEach((c, i) => c.visible = i >= card);
  cam(w, CAM_F(t), t);
  return { bloom: 0.35 };
}
function poseS13(w, t) {
  poseStars(w, t);
  footlights(w, 1);
  w.pup.visible = true;
  setPose(w, w.pup, "arrival", "moonlight");
  w.pup.rotation.y = 0;
  const bow = on2(t) >= 57.9 && on2(t) < 58.9 ? on2(t) < 58 ? -0.07 : -0.14 : 0;
  w.pup.rotation.x = bow;
  w.pup.position.set(0, 0.66, -0.45);
  setAudience(w, FANS, t, 1);
  setHouse(w, 0.75 + 0.25 * P(t, 59, 59.6));
  setBackdrop(w, "end", 0.22);
  w.clouds.visible = false;
  setBulbs(w, Math.floor(P(on2(t), 54.6, 56.2) * 26), on2(t) > 56.2 && t < 59 ? Math.floor(on2(t) * 6) % 3 : -1);
  w.prosMat.emissiveIntensity = 1;
  w.warm.intensity = 1.4;
  w.hemi.intensity = 0.3 + 0.2 * P(t, 56.5, 59);
  w.moonKey.intensity = 0.55 + 0.3 * P(t, 56.5, 59);
  setDrapes(w, Math.max(1 - ease.outCubic(P(t, 54.1, 54.8)), ease.inOutCubic(P(t, 58.3, 59))));
  const k = CAM_G(t), a = P(t, 55.2, 58.2);
  cam(w, k, t);
  w.scene.fog.density = lerp(0.03, 0.018, a);
  return { near: a < 0.15 ? 1.2 : 2, fgBlur: 10, bloom: 0.3, exposure: 0.85 };
}
var POSE3D = { 0: poseS01, 1: poseS02, 2: poseS03, 4: poseS05, 6: poseS07, 8: poseS09, 9: poseS10, 11: poseS12, 12: poseS13 };
function draw3D(ctx, A, index, t, alpha = 1) {
  const w = A.stage.objects;
  resetWorld(w);
  const o = POSE3D[index](w, t);
  render3D(ctx, A.stage, { ...o, alpha });
}
var CARDS = [
  { text: "\u5F88\u4E45\u5F88\u4E45\u4EE5\u524D\uFF0C\uFF0F\u6708\u4EAE\u4E0A\u4F4F\u8457\u4E00\u96BB\u5154\u5B50\u3002", x: 1590, y: 110, size: 60, inAt: 4.75, outAt: 7.4 },
  { text: "\u6BCF\u4E00\u76DE\u71C8\u4E0B\uFF0C\uFF0F\u90FD\u6709\u7761\u4E0D\u8457\u7684\u4EBA\u3002", x: 300, y: 120, size: 62, inAt: 12.3, outAt: 15.35 },
  { text: "\u65BC\u662F\u5979\u6C7A\u5B9A\uFF0C\uFF0F\u89AA\u81EA\u53BB\u966A\u4ED6\u5011\u3002", x: 300, y: 90, size: 60, inAt: 20.3, outAt: 23.35 },
  { text: "\u7B2C\u4E00\u6B21\u7AD9\u4E0A\u821E\u53F0\uFF0C\uFF0F\u53F0\u4E0B\uFF0C\u7A7A\u7121\u4E00\u4EBA\u3002", x: 1600, y: 100, size: 58, inAt: 24.55, outAt: 28.2 },
  { text: "\u5979\u9084\u662F\u958B\u53E3\u5531\u4E86\u3002\uFF0F\u4E00\u76DE\u3001\u5169\u76DE\u2026\u2026", x: 1600, y: 90, size: 56, inAt: 32.45, outAt: 34.9 },
  { text: "\u4ECA\u665A\uFF0C\u966A\u4F34\u8457\u4F60\u3002", x: 1640, y: 110, size: 60, inAt: 55.1, outAt: 58.35 }
];
function storyCards(c, t) {
  for (const k of CARDS) {
    if (t < k.inAt || t > k.outAt + 0.5) continue;
    const drop = spring(t, k.inAt, 0.7, 0.22) * (1 - at(t, k.outAt, k.outAt + 0.4, inCubic));
    const sway = Math.sin((t - k.inAt) * 2.2) * Math.exp(-(t - k.inAt) * 1.2) * 0.6;
    storyCard(c, k.text, k.x, k.y, k.size, drop, sway);
  }
}
function cloudWipe(c, kit, t, mid) {
  const u = (t - (mid - 0.5)) / 1;
  if (u <= 0 || u >= 1) return;
  c.drawImage(kit.cloudBank, lerp(W - 250, -3350, ease.inOutCubic(u)), 0);
}
function shojiDoors(c, A, t) {
  if (t < 19.05 || t >= 20) return;
  const sc = A.stage.objects.screenCanvas, sy = (sc.height - sc.width * H / W) / 2, sh = sc.width * H / W, half = sc.width / 2;
  const show = P(t, 19.05, 19.2), u = ease.inOutCubic(P(t, 19.25, 19.97)), off = u * (W / 2 + 120);
  if (u > 0) {
    drawS06(c, A.kit, 20);
    const g = c.createLinearGradient(W / 2 - off - 200, 0, W / 2 + off + 200, 0);
    g.addColorStop(0, "rgba(220,232,255,0)");
    g.addColorStop(0.5, `rgba(235,242,255,${0.55 * (1 - u)})`);
    g.addColorStop(1, "rgba(220,232,255,0)");
    c.save();
    c.globalCompositeOperation = "lighter";
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.restore();
  }
  c.save();
  c.globalAlpha = show;
  for (const side of [-1, 1]) {
    c.save();
    c.translate(side * off, 0);
    c.shadowColor = "rgba(0,0,10,.55)";
    c.shadowBlur = 40;
    c.shadowOffsetX = side * 14;
    c.drawImage(sc, side < 0 ? 0 : half, sy, half, sh, side < 0 ? 0 : W / 2, 0, W / 2, H);
    c.shadowColor = "transparent";
    c.fillStyle = "#3a2216";
    c.fillRect(side < 0 ? W / 2 - 16 : W / 2, 0, 16, H);
    c.fillStyle = "#c9a77a";
    c.fillRect(side < 0 ? W / 2 - 60 : W / 2 + 44, H / 2 - 40, 16, 80);
    c.restore();
  }
  c.restore();
}
function shojiClose(ctx, A, t) {
  const u = P(t, 15.5, 16);
  if (u <= 0 || t >= 16) return;
  const off = ease.inOutCubic(u) * W / 2, el = ctx.canvas.canvas, pw = el.width, ph = el.height;
  const s04 = buffer("shoji-s04", pw, ph), scr = buffer("shoji-scr", pw, ph);
  const b1 = s04.getContext("2d"), b2 = scr.getContext("2d");
  b1.clearRect(0, 0, pw, ph);
  b1.drawImage(el, 0, 0);
  draw3D(ctx, A, 4, 16);
  b2.clearRect(0, 0, pw, ph);
  b2.drawImage(el, 0, 0);
  ctx.withCanvas((c) => {
    c.drawImage(s04, 0, 0, W, H);
    for (const left of [true, false]) {
      const x = left ? off : W - off, d = left ? 1 : -1, g = c.createLinearGradient(x, 0, x + d * 90, 0);
      g.addColorStop(0, "rgba(4,6,24,.5)");
      g.addColorStop(1, "rgba(4,6,24,0)");
      c.fillStyle = g;
      c.fillRect(Math.min(x, x + d * 90), 0, 90, H);
    }
    c.drawImage(scr, 0, 0, pw / 2, ph, off - W / 2, 0, W / 2, H);
    c.drawImage(scr, pw / 2, 0, pw / 2, ph, W - off, 0, W / 2, H);
    c.fillStyle = "#24150e";
    c.fillRect(off - 8, 0, 8, H);
    c.fillRect(W - off, 0, 8, H);
    c.fillStyle = "rgba(150,110,80,.5)";
    c.fillRect(off - 8, 0, 2, H);
    c.fillRect(W - off, 0, 2, H);
  });
}
function posterPull(c, kit, t) {
  const u = P(t, 45.6, 46.1);
  c.save();
  c.translate(lerp(0, -W * 1.15, inCubic(u)), 0);
  c.rotate(-0.04 * u);
  c.shadowColor = "rgba(0,0,0,.5)";
  c.shadowBlur = 40;
  c.shadowOffsetX = 20;
  drawS11(c, kit, t, spring(t, 43.3, 0.5, 0.25));
  c.restore();
}
function bakeFrame() {
  const c = cv(W, H), g = c.getContext("2d"), r = rng(81), BW = 70;
  for (const left of [true, false]) {
    const x0 = left ? 0 : W - BW, inner = left ? BW : W - BW, dir = left ? 1 : -1;
    const sg = g.createLinearGradient(inner, 0, inner + dir * 30, 0);
    sg.addColorStop(0, "rgba(12,5,2,.5)");
    sg.addColorStop(1, "rgba(12,5,2,0)");
    g.fillStyle = sg;
    g.fillRect(Math.min(inner, inner + dir * 30), 0, 30, H);
    const wg = g.createLinearGradient(x0, 0, x0 + BW, 0);
    wg.addColorStop(0, "#4a2f1e");
    wg.addColorStop(left ? 0.85 : 0.15, "#6a4630");
    wg.addColorStop(1, "#4a2f1e");
    g.fillStyle = wg;
    g.fillRect(x0, 0, BW, H);
    for (let i = 0; i < 46; i++) {
      g.strokeStyle = r() < 0.55 ? "rgba(20,8,2,.22)" : "rgba(255,215,170,.08)";
      g.lineWidth = 0.7 + r() * 1.6;
      const x = x0 + 4 + r() * (BW - 8);
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + (r() - 0.5) * 10, H * 0.3, x + (r() - 0.5) * 10, H * 0.7, x + (r() - 0.5) * 6, H);
      g.stroke();
    }
    g.fillStyle = "rgba(255,214,160,.28)";
    g.fillRect(left ? BW - 4 : W - BW, 0, 4, H);
  }
  return c;
}
function cardsFull(c, A, t) {
  const kit = A.kit, pulls = [48.6, 51.3], CW = W - 140, CH = Math.round(CW * 0.8 / 1.42), CY = (H - CH) / 2;
  c.fillStyle = "#170c08";
  c.fillRect(0, 0, W, H);
  for (let i = 2; i >= 0; i--) {
    const pullAt = pulls[i], u = pullAt === void 0 ? 0 : P(t, pullAt, pullAt + 0.4);
    if (u >= 1) continue;
    c.save();
    c.translate(-W * 1.1 * inCubic(u), 0);
    c.rotate(-0.03 * u);
    c.shadowColor = "rgba(0,0,0,.5)";
    c.shadowBlur = 24;
    c.shadowOffsetX = u > 0 ? 18 : 0;
    c.drawImage(kit.cards[i], 70, CY, CW, CH);
    c.restore();
  }
  c.drawImage(A.frame, 0, 0);
}
function renderFrame(ctx, time) {
  const A = ctx.assets.lunar, kit = A.kit;
  const t = Math.min(time, DUR - 1e-3), { beat } = BEATS.at(t), i = beat.index;
  ctx.withCanvas((c) => {
    c.fillStyle = "#060a20";
    c.fillRect(0, 0, W, H);
  });
  if (i === 3) ctx.withCanvas((c) => drawS04(c, kit, t));
  else if (i === 5) ctx.withCanvas((c) => drawS06(c, kit, t));
  else if (i === 7) ctx.withCanvas((c) => drawS08(c, kit, t));
  else if (i === 10) ctx.withCanvas((c) => drawS11(c, kit, t, spring(t, 43.3, 0.5, 0.25)));
  else if (i === 11 && t >= 48 && t < 53.3) ctx.withCanvas((c) => cardsFull(c, A, t));
  else draw3D(ctx, A, i, t);
  if (i === 3 && t > 15.5) shojiClose(ctx, A, t);
  if (i === 7 && t > 31.75) {
    const r = lerp(470, 1250, ease.inOutCubic(P(t, 31.75, 32))), path = new Path2D();
    path.arc(W / 2, 470, r, 0, TAU);
    ctx.clip(path, () => draw3D(ctx, A, 8, 32));
  }
  if (i === 10 && t > 45.6) {
    ctx.withCanvas((c) => {
      c.fillStyle = "#060a20";
      c.fillRect(0, 0, W, H);
    });
    draw3D(ctx, A, 11, 46);
    ctx.withCanvas((c) => posterPull(c, kit, t));
  }
  ctx.withCanvas((c) => {
    shojiDoors(c, A, t);
    cloudWipe(c, kit, t, 24);
    if (t > 42.3 && t < 43.7) {
      petalsOverlay(c, kit, t, 42.3, 0.7);
      petalsOverlay(c, kit, t + 0.35, 42.3, 0.7);
      const pv = Math.exp(-(((t - 43) / 0.12) ** 2));
      if (pv > 0.01) {
        c.fillStyle = `rgba(255,214,232,${pv * 0.85})`;
        c.fillRect(0, 0, W, H);
      }
    }
    if (t > 11.7 && t < 12.25) {
      const a = Math.sin(P(t, 11.7, 12.25) * Math.PI) * 0.85;
      c.fillStyle = `rgba(255,214,140,${a})`;
      c.fillRect(0, 0, W, H);
    }
    const fl = Math.exp(-(((t - 28.62) / 0.05) ** 2));
    if (fl > 0.01) {
      c.fillStyle = `rgba(255,248,236,${fl * 0.9})`;
      c.fillRect(0, 0, W, H);
    }
    const bu = Math.exp(-(((t - 40.02) / 0.08) ** 2));
    if (bu > 0.01) {
      c.globalCompositeOperation = "lighter";
      c.fillStyle = `rgba(255,190,150,${bu * 0.18})`;
      c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = "source-over";
    }
    if (t < 4.6) {
      branches(c, A.fx, t, P(t, 1.7, 2.6) * (1 - P(t, 3.8, 4.4)) * 0.9);
      dust(c, A.fx, t, P(t, 1.4, 2.4) * 0.7);
    }
    leak(c, t, 4.25, 0.7);
    if (t > 4.7 && t < 8) glints(c, A.fx, t, [[1220, 520, 70, 0], [700, 300, 46, 1.7], [1480, 840, 52, 3.1], [860, 760, 40, 4.2], [1660, 420, 36, 5.3], [520, 640, 30, 2.4]], P(t, 4.8, 5.4) * (1 - P(t, 7.6, 8)));
    if (t > 24 && t < 28.6) dust(c, A.fx, t, 0.75, 40, [640, 0, 640, H]);
    if (t > 32 && t < 36.5) dust(c, A.fx, t, 0.5, 34, [500, 0, 900, H]);
    if (t > 39.8 && t < 43.1) {
      godRays(c, 960, 470, t, P(t, 40.1, 40.6) * (1 - P(t, 42.6, 43)) * 0.7);
      glints(c, A.fx, t * 1.6, [[640, 300, 70, 0], [1300, 260, 80, 1], [560, 640, 50, 2], [1380, 600, 60, 3], [760, 880, 44, 4], [1180, 900, 46, 5]], P(t, 40, 40.3) * (1 - P(t, 42.6, 43)));
    }
    leak(c, t, 39.95, 0.6, "255,170,190");
    if (t > 48 && t < 53.3) glints(c, A.fx, t, [[1300, 200, 40, 0], [1660, 520, 34, 2], [960, 820, 30, 4]], 0.8);
    leak(c, t, 54.15, 0.8, "255,190,140");
    if (t > 57.85) confetti(c, t, 57.9);
    if (t > 56.8) branches(c, A.fx, t, P(t, 56.8, 57.8) * 0.6);
    storyCards(c, t);
    const f = Math.floor(t * 12), ox = Math.floor(ctx.noise(f, 1) * 1024), oy = Math.floor(ctx.noise(f, 2) * 1024);
    grain(c, W, H, 0.07, "overlay", ox, oy);
    specks(c, t);
    const tone = c.createLinearGradient(0, 0, 0, H);
    tone.addColorStop(0, "rgba(48,80,192,.14)");
    tone.addColorStop(1, "rgba(255,150,110,.10)");
    c.save();
    c.globalCompositeOperation = "soft-light";
    c.fillStyle = tone;
    c.fillRect(0, 0, W, H);
    c.restore();
    const v = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    v.addColorStop(0, "rgba(0,0,10,0)");
    v.addColorStop(1, "rgba(2,4,20,.5)");
    c.fillStyle = v;
    c.fillRect(0, 0, W, H);
    if (t > 59.5) {
      c.fillStyle = `rgba(4,6,18,${ease.inOutSine(P(t, 59.5, 60))})`;
      c.fillRect(0, 0, W, H);
    }
  });
  const frameEl = ctx.canvas.canvas;
  bloom(ctx, (c) => {
    c.filter = "brightness(.55) contrast(2.4) sepia(.5) saturate(2)";
    c.drawImage(frameEl, 0, 0, W, H);
    c.filter = "none";
  }, { radius: 12, strength: 0.12, halo: 0.7 });
  void C;
}
export {
  BEATS,
  meta,
  params,
  renderFrame,
  setup
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vcGFja2FnZXMvcnVudGltZS9zcmMvbWF0aC50cyIsICIuLi8uLi9wYWNrYWdlcy9ydW50aW1lL3NyYy9tb3Rpb24udHMiLCAiLi4vLi4vcGFja2FnZXMvcnVudGltZS9zcmMvZmlsbS50cyIsICJzY2VuZXMvdGhyZWUudHMiLCAic2NlbmVzL3BhcGVyLnRzIiwgInNjZW5lcy93b3JsZDNkLnRzIiwgInNjZW5lcy9tYWluLnRzIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFPLElBQU0sUUFBUSxDQUFDLEdBQVcsTUFBTSxHQUFHLE1BQU0sTUFBTSxLQUFLLElBQUksS0FBSyxLQUFLLElBQUksS0FBSyxDQUFDLENBQUM7QUFDN0UsSUFBTSxLQUFLLENBQUMsR0FBVyxPQUFlLFFBQWdCLFFBQVEsUUFBUyxLQUFLLE1BQU0sSUFBSSxJQUFLLE9BQU8sSUFBSSxVQUFVLE1BQU0sTUFBTTtBQUU1SCxJQUFNLE9BQU8sT0FBTyxPQUFPO0VBQ2hDLFFBQVEsQ0FBQyxNQUFjO0VBQ3ZCLFFBQVEsQ0FBQyxNQUFjLElBQUk7RUFDM0IsVUFBVSxDQUFDLE1BQWMsS0FBSyxJQUFJLE1BQU07RUFDeEMsWUFBWSxDQUFDLE1BQWMsSUFBSSxNQUFNLElBQUksS0FBSyxJQUFJLEtBQUssS0FBSyxJQUFJLE1BQU0sSUFBSTtFQUMxRSxTQUFTLENBQUMsTUFBYyxNQUFNLElBQUksSUFBSSxJQUFJLE1BQU0sTUFBTTs7RUFFdEQsVUFBVSxDQUFDLE1BQWMsS0FBSyxJQUFJLE1BQU07O0VBRXhDLFVBQVUsQ0FBQyxNQUFjLEtBQUssSUFBSSxNQUFNO0VBQ3hDLFlBQVksQ0FBQyxNQUFjLElBQUksTUFBTSxJQUFJLEtBQUssSUFBSSxLQUFLLEtBQUssSUFBSSxNQUFNLElBQUk7O0VBRTFFLFdBQVcsQ0FBQyxNQUFjLE1BQU0sTUFBTSxLQUFLLElBQUksS0FBSyxLQUFLLENBQUM7Q0FDM0Q7OztBQ1RNLElBQU0sS0FBSyxDQUFDLE1BQWMsT0FBZSxLQUFhLFFBQWUs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LEdBQUc7QUFDbkUsTUFBRSxZQUFZO0FBQVcsTUFBRSxTQUFTLEdBQUcsS0FBSyxJQUFJLEtBQUssRUFBRTtBQUFHLE1BQUUsWUFBWTtBQUFXLE1BQUUsU0FBUyxHQUFHLEtBQUssSUFBSSxLQUFLLENBQUM7QUFDaEgsYUFBUyxLQUFLLElBQUksS0FBSyxJQUFJLEtBQUssTUFBTSxLQUFLO0FBQUUsUUFBRSxZQUFZO0FBQVcsUUFBRSxTQUFTLElBQUksS0FBSyxJQUFJLEdBQUc7QUFBQSxJQUFHO0FBQUEsRUFDdEc7QUFDQSxRQUFNLFVBQVUsR0FBRyxLQUFLLEVBQUU7QUFBRztBQUFFLFVBQU0sSUFBSSxHQUFHLE9BQU87QUFDakQsTUFBRSxZQUFZO0FBQVcsTUFBRSxVQUFVO0FBQUcsTUFBRSxVQUFVLEdBQUcsSUFBSSxLQUFLLElBQUksRUFBRTtBQUFHLE1BQUUsS0FBSztBQUFHLE1BQUUsU0FBUyxJQUFJLEdBQUcsSUFBSSxFQUFFO0FBQzNHLGFBQVMsSUFBSSxHQUFHLElBQUksR0FBRyxLQUFLO0FBQUUsWUFBTSxJQUFJLE1BQU0sSUFBSTtBQUFLLFFBQUUsWUFBWTtBQUFXLFFBQUUsVUFBVTtBQUFHLFFBQUUsVUFBVSxHQUFHLElBQUksS0FBSyxJQUFJLENBQUM7QUFBRyxRQUFFLEtBQUs7QUFBRyxlQUFTLElBQUksR0FBRyxJQUFJLEdBQUcsS0FBSztBQUFFLFVBQUUsWUFBWTtBQUFXLFVBQUUsU0FBUyxJQUFJLEtBQUssSUFBSSxJQUFJLElBQUksSUFBSSxFQUFFO0FBQUEsTUFBRztBQUFBLElBQUU7QUFDM08sTUFBRSxZQUFZO0FBQVcsTUFBRSxVQUFVO0FBQUcsTUFBRSxJQUFJLEdBQUcsSUFBSSxHQUFHLEdBQUcsR0FBRztBQUFHLE1BQUUsS0FBSztBQUFHLE1BQUUsWUFBWTtBQUFXLE1BQUUsU0FBUyxJQUFJLElBQUksSUFBSSxFQUFFO0FBQUEsRUFBRztBQUNsSSxRQUFNLFNBQVMsR0FBRyxJQUFJLEtBQUssR0FBRztBQUFHO0FBQy9CLFVBQU0sSUFBSSxHQUFHLE1BQU0sR0FBR0Es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UUFBUTtBQUFBO0FBQUEsRUFDcEIsQ0FBQyxJQUFJLEdBQUcsTUFBTSxNQUFNLEdBQUcsTUFBTSxPQUFNLEVBQUU7QUFBQSxFQUNyQyxDQUFDLE1BQU0sR0FBRyxNQUFNLE1BQU0sR0FBRyxNQUFNLE1BQUssRUFBRTtBQUFBLEVBQ3RDLENBQUMsSUFBTSxHQUFHLE1BQU0sTUFBTSxHQUFHLE1BQU0sT0FBTSxFQUFFO0FBQUEsRUFDdkMsQ0FBQyxJQUFJLEdBQUcsTUFBTSxLQUFLLEdBQUcsTUFBTSxPQUFNLEVBQUU7QUFDdEMsQ0FBQztBQUNELElBQU0sUUFBUSxRQUFRLENBQUMsQ0FBQyxJQUFJLEtBQUksTUFBSyxLQUFLLEdBQUcsTUFBSyxPQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sS0FBSSxNQUFLLE1BQU0sR0FBRyxNQUFLLE9BQU0sRUFBRSxDQUFDLENBQUM7QUFDckcsSUFBTSxRQUFRLFFBQVE7QUFBQTtBQUFBLEVBQ3BCLENBQUMsSUFBSSxHQUFHLEtBQUksTUFBTSxHQUFHLE1BQUssT0FBTSxFQUFFO0FBQUEsRUFBRyxDQUFDLE1BQU0sR0FBRyxLQUFJLEtBQUssR0FBRyxNQUFLLE9BQU0sRUFBRTtBQUFBLEVBQUcsQ0FBQyxNQUFNLE1BQUssS0FBSSxLQUFLLEdBQUcsR0FBSyxPQUFNLEVBQUU7QUFBQSxFQUFHLENBQUMsSUFBSSxLQUFJLE1BQUssTUFBTSxHQUFHLEdBQUssT0FBTSxFQUFFO0FBQ3pKLENBQUM7QUFDRCxJQUFNLFFBQVEsUUFBUTtBQUFBO0FBQUEsRUFDcEIsQ0FBQyxJQUFJLEdBQUcsTUFBSyxLQUFLLEdBQUcsTUFBSyxPQUFNLEVBQUU7QUFBQSxFQUFHLENBQUMsTUFBTSxHQUFHLE1BQUssS0FBSyxHQUFHLE1BQUssT0FBTSxFQUFFO0FBQUEsRUFBRyxDQUFDLElBQUksR0FBRyxLQUFLLE9BQU8sR0FBRyxLQUFLLE9BQU0sRUFBRTtBQUFBLEVBQ2hILENBQUMsTUFBTSxHQUFHLEtBQUssT0FBTyxHQUFHLEtBQUssT0FBTSxFQUFFO0FBQUEsRUFBRyxDQUFDLElBQUks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LE1BQUUsU0FBUyxJQUFJLEtBQUssSUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSTtBQUFBLEVBQUksQ0FBQztBQUM1UCxJQUFFLElBQUksWUFBWTtBQUFLLElBQUUsS0FBSyxVQUFVO0FBQU0sSUFBRSxLQUFLLFNBQVMsSUFBSSxJQUFJO0FBQ3RFLElBQUUsS0FBSyxZQUFZO0FBQUssSUFBRSxLQUFLLFVBQVU7QUFBTSxJQUFFLEtBQUssU0FBUyxVQUFVO0FBQ3pFLFFBQU0sT0FBTyxFQUFFLEdBQUcsSUFBSSxJQUFJO0FBQUcsYUFBVyxHQUFHLE9BQU8sT0FBTSxFQUFFLEdBQUcsTUFBTSxFQUFFLElBQUksSUFBRztBQUFHLFdBQVMsR0FBRyxFQUFFLEdBQUcsTUFBTSxJQUFJLEdBQUcsSUFBSSxJQUFJO0FBQUcsSUFBRSxLQUFLLFlBQVksTUFBSyxPQUFPO0FBQUssSUFBRSxRQUFRLFlBQVksTUFBSyxPQUFPO0FBQzlMLE1BQUksSUFBSSxNQUFNO0FBQUUsZ0JBQVksR0FBRyxPQUFPLE9BQU0sRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDO0FBQUcsTUFBRSxTQUFTLFNBQVMsSUFBSSxLQUFLLEtBQUssTUFBTSxLQUFFLFNBQVMsRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLENBQUM7QUFBQSxFQUFHO0FBRXRJLFFBQU0sSUFBSSxLQUFFLFdBQVcsRUFBRSxHQUFHLElBQUksSUFBSSxDQUFDLEdBQUcsSUFBSSxLQUFFLFdBQVcsRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUcsSUFBSSxFQUFFLEdBQUcsTUFBTSxJQUFJO0FBQy9GLFFBQU0sT0FBTyxLQUFLLE1BQUssTUFBSyxDQUFDLEdBQUcsT0FBTyxLQUFLLEtBQUssS0FBSyxDQUFDLEdBQUcsT0FBTyxLQUFLLE1BQU0sTUFBTSxDQUFDLEdBQUcsT0FBTyxLQUFLLE1BQU0sTUFBTSxDQUFDO0FBQy9HLFFBQU0sS0FBSyxDQUFDLEtBQUssSUFBSSxJQUFJLElBQUksTUFBTSxLQUFLLE1BQUssTUFBTSxDQUFDLEdBQUcsUUFBTyxL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LEVBQUUsR0FBRyxLQUFLLEdBQUcsS0FBSyxJQUFJLEVBQUUsR0FBRyxLQUFLLEdBQUcsS0FBSyxHQUFFO0FBQUcsV0FBSyxHQUFHLEVBQUUsSUFBSSxHQUFHLEVBQUUsR0FBRyxLQUFLLEdBQUcsSUFBSSxHQUFFO0FBQUEsSUFBRztBQUN4SCxTQUFLLEdBQUcsR0FBRyxNQUFNLEdBQUU7QUFDbkIsUUFBSSxJQUFJLE9BQU8sSUFBSSxFQUFHLFFBQU8sR0FBRyxFQUFFLElBQUksR0FBRyxDQUFDLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxLQUFLLElBQUksR0FBRyxHQUFHLENBQUMsTUFBTSxLQUFLLElBQUksR0FBRyxHQUFHLENBQUMsS0FBSyxLQUFLLElBQUksR0FBRyxHQUFHLENBQUMsTUFBTSxLQUFLLElBQUksR0FBRyxHQUFHLENBQUMsS0FBSyxLQUFLLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLEtBQUssR0FBRyxLQUFLLElBQUksRUFBRSxHQUFHLEtBQUssQ0FBQyxFQUFFO0FBQzdNLFFBQUksSUFBSSxNQUFNLElBQUksS0FBTSxNQUFLLEdBQUcsRUFBRSxJQUFJLEdBQUcsTUFBSyxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxDQUFDO0FBQ2xFLFFBQUksSUFBSSxNQUFNLElBQUksS0FBTSxNQUFLLEdBQUcsRUFBRSxJQUFJLEdBQUcsS0FBSSxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxDQUFDO0FBQ2pFLFFBQUksSUFBSSxRQUFRLElBQUksTUFBTTtBQUFFLGNBQVEsR0FBRyxLQUFLLEtBQUssR0FBRyxFQUFFLEdBQUcsTUFBTSxJQUFJLEtBQUssSUFBSSxFQUFFLEdBQUcsTUFBTSxFQUFFLEtBQUssR0FBRTtBQUFHLGFBQU8sR0FBRyxFQUFFLElBQUksSUFBSSxLQUFLLENBQUMsQ0FBQyxLQUFLLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEtBQUssSUFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxJQUFJLEtBQUssSUFBSSxFQUFFLEdBQUcsTUFBTSxFQUFFLEVBQUU7QUFBQSxJQUFHO0FBQzNSLFNBQUssR0FBRyxHQUFHLE9BQU8sS0FBSSxhQUFhO0FBQ25DLFFBQUksSUFBSSxNQUFNLElBQUksS0FBTSxRQUFPLEdBQUcsRUFBRSxJQUFJLEdBQUcsQ0FBQyxDQUFDLE1BQU0sS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssS0FBSyxJQUFJLENBQUMsQ0FBQyxHQUFHLEdBQUU7QUFDMUcsU0FBSyxHQUFHLEdBQUcsT0FBTyxLQUFJLGFBQWE7QUFDbkMsUUFBSSxJQUFJLE1BQU8sVUFBUyxHQUFHLEdBQUcsSUFBSTtBQUNsQyxRQUFJLElBQUksS0FBTSxVQUFTLEdBQUcsRUFBRSxJQUFJLEdBQUcsRUFBRSxHQUFHLE1BQU0sSUFBSSxJQUFJLEdBQUU7QUFDeEQsZUFBVyxHQUFHLENBQUM7QUFFZixVQUFNLElBQUksS0FBSyxNQUFNLElBQUksRUFBRSxHQUFHLEtBQUssS0FBSyxNQUFNLElBQUksTUFBTSxHQUFHLENBQUMsSUFBSSxJQUFJLEdBQUcsS0FBSyxLQUFLLE1BQU0sSUFBSSxNQUFNLEdBQUcsQ0FBQyxJQUFJLElBQUk7QUFDN0csVUFBTSxHQUFHLEdBQUcsR0FBRyxNQUFLLFdBQVcsSUFBSSxFQUFFO0FBQ3JDLFdBQU8sR0FBRyxDQUFDO0FBQ1gsVUFBTSxPQUFPLEVBQUUscUJBQXFCLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBRyxTQUFLLGFBQWEsR0FBRyxxQkFBcUI7QUFBRyxTQUFLLGFBQWEsR0FBRyx1QkFBdUI7QUFDMUksTUFBRSxLQUFLO0FBQUcsTUFBRSwyQkFBMkI7QUFBYyxNQUFFLFlBQVk7QUFBTSxNQUFFLFNBQVMsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFHLE1BQUUsUUFBUTtBQUMzRyxVQUFNLElBQUksRUFBRSxxQkFBcUIsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLE1BQUssSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLElBQUc7QUFBRyxNQUFFLGFBQWEsR0FBRyxnQkFBZ0I7QUFBRyxNQUFFLGFBQWEsR0FBRyxpQkFBaUI7QUFDeEosTUFBRSxZQUFZO0FBQUcsTUFBRSxTQUFTLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFFdEMsUUFBSSxJQUFJLE1BQU07QUFBRSxRQUFFLFlBQVksZUFBZSxLQUFFLFVBQVUsRUFBRSxHQUFHLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFBSyxRQUFFLFNBQVMsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQUc7QUFBQSxFQUN2RyxDQUFDO0FBRUQsUUFBTSxVQUFVLElBQUksT0FBTztBQUMzQixRQUFNLEtBQUssT0FBSztBQUFFLE1BQUUsU0FBUztBQUF1RCxNQUFFLFVBQVUsU0FBUyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUcsTUFBRSxTQUFTO0FBQUEsRUFBUSxHQUFHLEVBQUUsUUFBUSxJQUFJLFVBQVUsTUFBSyxNQUFNLElBQUcsQ0FBQztBQUNuTCxPQUFLO0FBQ1A7IiwKICAibmFtZXMiOiBbInciLCAiaCIsICJjbGFtcCIsICJlYXNlIiwgInIiLCAiYXQiLCAiZzIiLCAiciIsICJnMiIsICJ3IiwgIlAiLCAiYiIsICJjb3JkIiwgInIiLCAicGFydHMiLCAibGVuIiwgInBvb2wiLCAiZHVzdCIsICJjbGFtcCIsICJsYXllciIsICJjbGFtcCJdCn0K
