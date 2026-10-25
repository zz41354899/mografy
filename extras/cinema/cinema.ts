// Camera, transition and atmosphere helpers for film-style scenes.
// Every function is a pure function of time and its options; nothing keeps playback state.
// Layout uses ctx.width / ctx.height, so the helpers work in landscape and portrait canvases.
import { buffer, clamp, ease, lerp, pr } from '@mografy/runtime';
import type { FrameContext, SetupContext } from '@mografy/runtime';

const TAU = Math.PI * 2;
const smoothstep = (a: number, b: number, x: number) => { const q = clamp((x - a) / (b - a)); return q * q * (3 - 2 * q); };
type Curve = (p: number) => number;

// ---------------------------------------------------------------- plates and camera

/** A still image prepared once in setup, with an optional soft copy for bloom. */
export interface Plate { image: CanvasImageSource; width: number; height: number; soft?: CanvasImageSource; softScale?: number }

/** Load an image in setup and prepare a blurred highlights copy for `plate(..., { bloom })`. */
export async function preparePlate(ctx: SetupContext, path: string, softWidth = 480): Promise<Plate> {
  const image = await ctx.loadImage(path);
  const softScale = softWidth / image.width, w = softWidth, h = Math.max(1, Math.round(image.height * softScale));
  const off = new OffscreenCanvas(w, h), c = off.getContext('2d')!;
  c.filter = 'blur(7px) brightness(0.7) contrast(2.2) saturate(1.2)';
  c.drawImage(image, 0, 0, w, h);
  return { image, width: image.width, height: image.height, soft: await createImageBitmap(off), softScale };
}

/** zoom ≥ 1 scales about the focus point (0..1 of the canvas); pan offsets are canvas pixels. */
export interface Camera { zoom?: number; focusX?: number; focusY?: number; panX?: number; panY?: number }
export type Crop = [x: number, y: number, width: number, height: number];

/**
 * Draw a plate to cover the canvas through a camera. The pan is clamped so the frame never
 * shows an edge: give the camera zoom headroom (for example 1.06) before panning.
 */
export function plate(ctx: FrameContext, p: Plate, camera: Camera = {}, o: { crop?: Crop; alpha?: number; bloom?: number } = {}) {
  const W = ctx.width, H = ctx.height;
  const [sx, sy, sw, sh] = o.crop ?? [0, 0, p.width, p.height];
  const cover = Math.max(W / sw, H / sh), z = Math.max(1, camera.zoom ?? 1), s = cover * z;
  const dw = sw * s, dh = sh * s, fx = (camera.focusX ?? .5) * W, fy = (camera.focusY ?? .5) * H;
  const x = clamp(fx - (fx - (W - sw * cover) / 2) * z + (camera.panX ?? 0), W - dw, 0);
  const y = clamp(fy - (fy - (H - sh * cover) / 2) * z + (camera.panY ?? 0), H - dh, 0);
  ctx.withCanvas(c => {
    c.globalAlpha = clamp(o.alpha ?? 1); c.imageSmoothingQuality = 'high';
    c.drawImage(p.image, sx, sy, sw, sh, x, y, dw, dh);
    const k = p.softScale ?? 0;
    if (p.soft && k && (o.bloom ?? 0) > 0) {
      c.globalCompositeOperation = 'screen'; c.globalAlpha = clamp(o.alpha ?? 1) * clamp(o.bloom ?? 0);
      c.drawImage(p.soft, sx * k, sy * k, sw * k, sh * k, x, y, dw, dh);
    }
  });
}

/** Interpolate a camera move between two framings over [start, end]. */
export function move(time: number, start: number, end: number, from: Camera, to: Camera, curve: Curve = ease.inOutCubic): Camera {
  const q = curve(pr(time, start, end));
  const f = (k: keyof Camera, d: number) => lerp(from[k] ?? d, to[k] ?? d, q);
  return { zoom: f('zoom', 1), focusX: f('focusX', .5), focusY: f('focusY', .5), panX: f('panX', 0), panY: f('panY', 0) };
}

// ---------------------------------------------------------------- transitions
// `from` and `to` draw complete frames. A transition calls them inside clips and transforms,
// so they must only draw (no state). Usually pass closures such as () => shotA(ctx, Math.min(time, cut)).

export interface Transition { start: number; end: number; from: () => void; to: () => void }

/** Before `start` draws `from`, after `end` draws `to`; returns progress 0..1 or undefined outside. */
function window_(time: number, o: Transition) {
  if (time < o.start) { o.from(); return undefined; }
  if (time >= o.end) { o.to(); return undefined; }
  return pr(time, o.start, o.end);
}

/** Simple dissolve. */
export function crossfade(ctx: FrameContext, time: number, o: Transition & { curve?: Curve }) {
  const e = window_(time, o); if (e === undefined) return;
  o.from();
  fadeLayer(ctx, (o.curve ?? ease.inOutCubic)(e), o.to);
}
/** Draw a layer at reduced opacity by covering it back with the previous frame. */
function fadeLayer(ctx: FrameContext, alpha: number, draw: () => void) {
  if (alpha >= .999) { draw(); return; }
  if (alpha <= .001) return;
  ctx.withCanvas(c => {
    // A pooled copy of the frame so far (never a new canvas per frame).
    const src = c.canvas as HTMLCanvasElement | OffscreenCanvas;
    const under = buffer('cinema:fade', src.width, src.height);
    under.getContext('2d')!.drawImage(src, 0, 0);
    draw();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1 - alpha;
    c.drawImage(under, 0, 0, ctx.width, ctx.height);
  });
}

/** Dip through a colour: `from` fades out to the colour, then `to` fades in. Cuts at the midpoint. */
export function dipTo(ctx: FrameContext, time: number, o: Transition & { color?: string; depth?: number }) {
  const e = window_(time, o); if (e === undefined) return;
  const half = e < .5;
  (half ? o.from : o.to)();
  const a = (o.depth ?? 1) * (half ? ease.inOutCubic(e * 2) : 1 - ease.outCubic((e - .5) * 2));
  ctx.withCanvas(c => { c.globalAlpha = clamp(a); c.fillStyle = o.color ?? '#000'; c.fillRect(0, 0, ctx.width, ctx.height); });
}

/** A short exposure flash overlay that peaks at `at` and decays. Draw it after the frame. */
export function flash(ctx: FrameContext, time: number, at: number, o: { strength?: number; decay?: number; color?: string } = {}) {
  if (time < at) return;
  const a = (o.strength ?? .6) * Math.exp(-(time - at) / (o.decay ?? .2));
  if (a < .005) return;
  ctx.withCanvas(c => { c.globalCompositeOperation = 'screen'; c.globalAlpha = clamp(a); c.fillStyle = o.color ?? '#fff'; c.fillRect(0, 0, ctx.width, ctx.height); });
}

/** A circle opens from (x, y) and reveals `to`, with a glowing rim. */
export function iris(ctx: FrameContext, time: number, o: Transition & { x: number; y: number; rim?: string }) {
  const e = window_(time, o); if (e === undefined) return;
  const q = ease.inOutCubic(e), r = Math.hypot(ctx.width, ctx.height) * 1.1 * q * q + 2;
  o.from();
  const path = new Path2D(); path.arc(o.x, o.y, r, 0, TAU);
  ctx.clip(path, o.to);
  ctx.withCanvas(c => {
    c.globalCompositeOperation = 'screen'; c.globalAlpha = 1 - q; c.strokeStyle = o.rim ?? '#ffe9c8';
    c.lineWidth = 24; c.shadowColor = o.rim ?? '#ffd2a0'; c.shadowBlur = 46;
    c.beginPath(); c.arc(o.x, o.y, r, 0, TAU); c.stroke();
  });
}

/** A slanted band of light sweeps left to right; `to` is revealed behind it. */
export function slash(ctx: FrameContext, time: number, o: Transition & { slant?: number; color?: string }) {
  const e = window_(time, o); if (e === undefined) return;
  const W = ctx.width, H = ctx.height, k = o.slant ?? H * .4, x = lerp(-k - 200, W + k + 200, ease.inOutCubic(e));
  o.from();
  const path = new Path2D(); path.moveTo(-k - 400, 0); path.lineTo(x, 0); path.lineTo(x - k, H); path.lineTo(-k - 400, H); path.closePath();
  ctx.clip(path, o.to);
  ctx.withCanvas(c => {
    const g = c.createLinearGradient(x - 260, 0, x + 60, 0), col = o.color ?? '255,236,214';
    g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(.75, `rgba(${col},1)`); g.addColorStop(1, `rgba(${col},0)`);
    c.globalCompositeOperation = 'screen'; c.fillStyle = g; c.beginPath();
    c.moveTo(x - 260, 0); c.lineTo(x + 60, 0); c.lineTo(x + 60 - k, H); c.lineTo(x - 260 - k, H); c.fill();
  });
}

/** Whip pan: both frames travel together in one direction with a motion smear. */
export function whip(ctx: FrameContext, time: number, o: Transition & { direction?: 'up' | 'down' | 'left' | 'right' }) {
  const e = window_(time, o); if (e === undefined) return;
  const W = ctx.width, H = ctx.height, q = ease.inOutCubic(e), d = o.direction ?? 'down';
  const [ux, uy] = d === 'down' ? [0, -1] : d === 'up' ? [0, 1] : d === 'right' ? [-1, 0] : [1, 0];
  ctx.withCanvas(c => { c.translate(ux * W * q, uy * H * q); o.from(); });
  ctx.withCanvas(c => { c.translate(-ux * W * (1 - q), -uy * H * (1 - q)); o.to(); });
  smear(ctx, .7 * Math.sin(Math.PI * e), ux !== 0 ? 'x' : 'y');
}

/** Directional motion smear of the current frame (use sparingly, for a few frames). */
export function smear(ctx: FrameContext, amount: number, axis: 'x' | 'y' = 'x') {
  if (amount <= .01) return;
  ctx.withCanvas(c => {
    const src = c.canvas as HTMLCanvasElement;
    c.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 1; i <= 3; i++) {
      const s = i * 22 * amount; c.globalAlpha = amount * .13;
      c.drawImage(src, axis === 'x' ? s : 0, axis === 'y' ? s : 0, ctx.width, ctx.height);
      c.drawImage(src, axis === 'x' ? -s : 0, axis === 'y' ? -s : 0, ctx.width, ctx.height);
    }
  });
}

export type Shape = 'petal' | 'star' | 'circle' | 'heart';
function shapePath(shape: Shape) {
  const p = new Path2D();
  if (shape === 'petal') { p.moveTo(0, -1); p.bezierCurveTo(.9, -.9, 1.1, .4, 0, 1.1); p.bezierCurveTo(-1.1, .4, -.9, -.9, 0, -1); }
  else if (shape === 'star') { const q = .22; p.moveTo(0, -1); p.quadraticCurveTo(q, -q, 1, 0); p.quadraticCurveTo(q, q, 0, 1); p.quadraticCurveTo(-q, q, -1, 0); p.quadraticCurveTo(-q, -q, 0, -1); }
  else if (shape === 'heart') { p.moveTo(0, .9); p.bezierCurveTo(-1.4, 0, -.7, -1.1, 0, -.4); p.bezierCurveTo(.7, -1.1, 1.4, 0, 0, .9); }
  else p.arc(0, 0, 1, 0, TAU);
  return p;
}

/**
 * Particle wipe (sakura by default): a gust of shapes crosses the frame and grows until it
 * covers it; each shape is a window onto `to`. Shapes start solid and fade into windows.
 */
export function particleWipe(ctx: FrameContext, time: number, o: Transition & {
  direction?: 'left' | 'right' | 'up' | 'down'; shape?: Shape; count?: number; seed?: number; color?: string; rim?: string;
}) {
  const e = window_(time, o); if (e === undefined) return;
  const W = ctx.width, H = ctx.height, span = Math.max(W, H), n = o.count ?? 70, seed = o.seed ?? 7, d = o.direction ?? 'left';
  const base = shapePath(o.shape ?? 'petal'), clipPath = new Path2D(), pieces: [DOMMatrix, number][] = [];
  o.from();
  for (let i = 0; i < n; i++) {
    const r = (k: number) => ctx.noise(seed, i, k);
    const f = clamp((e - r(0) * .4) / .6);
    if (f <= 0) continue;
    const k = ease.outCubic(f), a = r(1), b = r(2), wob = .06 * span * Math.sin(f * 3 + r(3) * TAU);
    let x: number, y: number;
    if (d === 'left' || d === 'right') {
      const tx = -.05 * W + a * W * 1.1; x = d === 'left' ? lerp(W + span * .1, tx, k) : lerp(-span * .1, tx, k);
      y = -.1 * H + b * H * 1.2 + wob;
    } else {
      const ty = -.05 * H + b * H * 1.1; y = d === 'up' ? lerp(H + span * .1, ty, k) : lerp(-span * .1, ty, k);
      x = -.05 * W + a * W * 1.1 + wob;
    }
    const size = span * (.008 + .19 * ease.inQuad(f) * (.6 + .5 * r(4)));
    pieces.push([new DOMMatrix().translate(x, y).rotate((r(5) * TAU + f * 1.8) * 57.2958).scale(size, size), f]);
  }
  for (const [m] of pieces) clipPath.addPath(base, m);
  ctx.clip(clipPath, o.to);
  ctx.withCanvas(c => {
    for (const [m, f] of pieces) {
      const piece = new Path2D(); piece.addPath(base, m);
      const solid = 1 - smoothstep(.25, .6, f);
      if (solid > .01) { c.globalAlpha = solid; c.fillStyle = o.color ?? '#ffd3df'; c.fill(piece); }
      const rim = f < .5 ? .75 * Math.sin(Math.PI * f / .5) : 0;
      if (rim > .01) { c.globalAlpha = rim; c.strokeStyle = o.rim ?? '#ffeef3'; c.lineWidth = 3; c.shadowColor = o.rim ?? '#ff9ec0'; c.shadowBlur = 12; c.stroke(piece); }
    }
  });
}

// ---------------------------------------------------------------- atmosphere

/** Soft radial light in screen mode. */
export function glow(ctx: FrameContext, x: number, y: number, radius: number, color: string, alpha: number) {
  if (alpha <= .001) return;
  ctx.withCanvas(c => {
    const g = c.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalCompositeOperation = 'screen'; c.globalAlpha = clamp(alpha); c.fillStyle = g;
    c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  });
}

/** Drifting particles (sakura petals, snow or sparks) that wrap around the frame. */
export function drift(ctx: FrameContext, time: number, o: { shape?: Shape; count?: number; seed?: number; amount?: number; wind?: number; fall?: number; size?: number; color?: string } = {}) {
  const amount = clamp(o.amount ?? 1); if (amount <= .01) return;
  const W = ctx.width, H = ctx.height, n = Math.round((o.count ?? 60) * amount), seed = o.seed ?? 11, base = shapePath(o.shape ?? 'petal');
  ctx.withCanvas(c => {
    c.fillStyle = o.color ?? '#ffd8e2';
    for (let i = 0; i < n; i++) {
      const r = (k: number) => ctx.noise(seed, i, k), depth = r(6);
      const sw = W + 240, sh = H + 240;
      const x = ((r(0) * sw + (o.wind ?? -60) * (.6 + depth) * time + 40 * Math.sin(time * .9 + r(1) * TAU)) % sw + sw) % sw - 120;
      const y = ((r(2) * sh + (o.fall ?? 80) * (.6 + depth) * time) % sh + sh) % sh - 120;
      const spin = 1 + r(3) * 2, flip = Math.abs(Math.cos(time * spin + r(4) * TAU));
      const size = (o.size ?? 9) * (.6 + depth);
      c.save(); c.translate(x, y); c.rotate(time * spin * .6 + r(5) * TAU); c.scale(size, size * (.35 + .65 * flip));
      c.globalAlpha = .5 + .45 * depth; c.fill(base); c.restore();
    }
  });
}

/** Twinkling four-point stars inside an area (defaults to the full frame). */
export function twinkle(ctx: FrameContext, time: number, o: { count?: number; seed?: number; amount?: number; area?: Crop; size?: number; color?: string } = {}) {
  const amount = clamp(o.amount ?? 1); if (amount <= .01) return;
  const [ax, ay, aw, ah] = o.area ?? [0, 0, ctx.width, ctx.height], base = shapePath('star'), seed = o.seed ?? 23;
  ctx.withCanvas(c => {
    c.globalCompositeOperation = 'screen';
    for (let i = 0; i < (o.count ?? 30); i++) {
      const r = (k: number) => ctx.noise(seed, i, k);
      const tw = Math.pow(Math.max(0, Math.sin(time * (1.5 + 3 * r(0)) + r(1) * TAU)), 6);
      if (tw < .02) continue;
      const x = ax + r(2) * aw, y = ay + r(3) * ah, s = (o.size ?? 10) * (.5 + r(4)) * (.6 + .6 * tw);
      const g = c.createRadialGradient(x, y, 0, x, y, s * 2.2);
      g.addColorStop(0, o.color ?? '#fff6dc'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = amount * tw; c.fillStyle = g; c.fillRect(x - s * 2.2, y - s * 2.2, s * 4.4, s * 4.4);
      c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = o.color ?? '#fff6dc'; c.fill(base); c.restore();
    }
  });
}

/** A slanted sheet of light crossing the frame once over [start, end]. */
export function lightSweep(ctx: FrameContext, time: number, o: { start: number; end: number; width?: number; slant?: number; alpha?: number; color?: string }) {
  const e = pr(time, o.start, o.end); if (e <= 0 || e >= 1) return;
  const W = ctx.width, H = ctx.height, w = o.width ?? 260, x = lerp(-w * 2, W + w * 2, ease.inOutCubic(e)), col = o.color ?? '255,240,220';
  ctx.withCanvas(c => {
    const g = c.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(.5, `rgba(${col},${o.alpha ?? .28})`); g.addColorStop(1, `rgba(${col},0)`);
    c.globalCompositeOperation = 'screen'; c.setTransform(1, 0, -(o.slant ?? .35), 1, 0, 0);
    c.fillStyle = g; c.fillRect(-W, 0, W * 3, H);
  });
}
