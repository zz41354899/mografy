// Output post-processing: equal-weight sample mixing, glow and grain.
// Pure typed-array code, so the browser preview, the headless capture and Node tests run the same math.
import { outputFrameCount, sampleTimes } from '@mografy/core';
import type { RenderSettings } from '@mografy/core';
import type { SceneRuntime } from './canvas.js';

export type MixingSpace = 'srgb' | 'linear';

const SRGB_TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) { const p = i / 255; SRGB_TO_LINEAR[i] = p <= 0.04045 ? p / 12.92 : ((p + 0.055) / 1.055) ** 2.4; }
const LUT_SIZE = 4096;
const LINEAR_TO_SRGB = new Float32Array(LUT_SIZE + 1);
for (let i = 0; i <= LUT_SIZE; i++) { const p = i / LUT_SIZE; LINEAR_TO_SRGB[i] = p <= 0.0031308 ? 12.92 * p : 1.055 * p ** (1 / 2.4) - 0.055; }
const encode = (v: number) => LINEAR_TO_SRGB[Math.round(Math.min(1, Math.max(0, v)) * LUT_SIZE)]!;
/** byte / 255 in double precision, exactly what dividing each sample would give. */
const BYTE_TO_UNIT = new Float64Array(256);
for (let i = 0; i < 256; i++) BYTE_TO_UNIT[i] = i / 255;

/** Sums RGB samples in the chosen mixing space. Alpha is ignored: frames are opaque. */
export class FrameAccumulator {
  readonly sum: Float32Array;
  count = 0;
  constructor(readonly width: number, readonly height: number, readonly space: MixingSpace = 'srgb') {
    this.sum = new Float32Array(width * height * 3);
  }
  add(rgba: ArrayLike<number>) {
    if (rgba.length !== this.width * this.height * 4) throw new Error('Sample size mismatch');
    // One table lookup per channel, no branch in the loop: this runs S times per output frame over every pixel.
    const sum = this.sum, n = sum.length, unit = this.space === 'linear' ? SRGB_TO_LINEAR : BYTE_TO_UNIT;
    for (let p = 0, s = 0; s < n; p += 4, s += 3) {
      sum[s] = sum[s]! + unit[rgba[p]!]!;
      sum[s + 1] = sum[s + 1]! + unit[rgba[p + 1]!]!;
      sum[s + 2] = sum[s + 2]! + unit[rgba[p + 2]!]!;
    }
    this.count++;
  }
  /** Scratch image reused by finishFrame, so a long export does not allocate a full float frame per frame. */
  image?: Float32Array;
  reset() { this.sum.fill(0); this.count = 0; }
}

export interface PostSettings { glow: number; grain: number; seed: number; frame: number }

function boxBlur(src: Float32Array, tmp: Float32Array, w: number, h: number, r: number) {
  const size = 2 * r + 1;
  // Horizontal then vertical, clamped edges, 3 channels.
  for (let y = 0; y < h; y++) for (let c = 0; c < 3; c++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += src[(y * w + Math.min(w - 1, Math.max(0, i))) * 3 + c]!;
    for (let x = 0; x < w; x++) {
      tmp[(y * w + x) * 3 + c] = acc / size;
      acc += src[(y * w + Math.min(w - 1, x + r + 1)) * 3 + c]! - src[(y * w + Math.max(0, x - r)) * 3 + c]!;
    }
  }
  for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += tmp[(Math.min(h - 1, Math.max(0, i)) * w + x) * 3 + c]!;
    for (let y = 0; y < h; y++) {
      src[(y * w + x) * 3 + c] = acc / size;
      acc += tmp[(Math.min(h - 1, y + r + 1) * w + x) * 3 + c]! - tmp[(Math.max(0, y - r) * w + x) * 3 + c]!;
    }
  }
}

/** Per-pixel bright-pass preserves thin strokes and saturated colours before downsampling. */
function addGlow(image: Float32Array, w: number, h: number, strength: number, linear: boolean) {
  const f = 4, qw = Math.ceil(w / f), qh = Math.ceil(h / f);
  const bright = new Float32Array(qw * qh * 3), tmp = new Float32Array(qw * qh * 3);
  for (let qy = 0; qy < qh; qy++) for (let qx = 0; qx < qw; qx++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = qy * f; y < Math.min(h, qy * f + f); y++) for (let x = qx * f; x < Math.min(w, qx * f + f); x++) {
      const i = (y * w + x) * 3;
      const peak = Math.max(image[i]!, image[i + 1]!, image[i + 2]!);
      const weight = Math.max(0, ((linear ? encode(peak) : peak) - 0.5) / 0.5);
      r += image[i]! * weight; g += image[i + 1]! * weight; b += image[i + 2]! * weight; n++;
    }
    const o = (qy * qw + qx) * 3; bright[o] = r / n; bright[o + 1] = g / n; bright[o + 2] = b / n;
  }
  // A concentrated bloom keeps fine details visible; a wider halo softens the falloff.
  const halo = new Float32Array(bright);
  const coreRadius = Math.max(1, Math.round(qh * 0.006));
  const haloRadius = Math.max(1, Math.round(qh * 0.025));
  for (let pass = 0; pass < 3; pass++) {
    boxBlur(bright, tmp, qw, qh, coreRadius);
    boxBlur(halo, tmp, qw, qh, haloRadius);
  }
  for (let i = 0; i < bright.length; i++) bright[i] = bright[i]! * 2 + halo[i]!;
  for (let y = 0; y < h; y++) {
    const fy = Math.min(qh - 1, Math.max(0, (y + 0.5) / f - 0.5)), y0 = Math.floor(fy), y1 = Math.min(qh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(qw - 1, Math.max(0, (x + 0.5) / f - 0.5)), x0 = Math.floor(fx), x1 = Math.min(qw - 1, x0 + 1), tx = fx - x0;
      const i = (y * w + x) * 3;
      for (let c = 0; c < 3; c++) {
        const top = bright[(y0 * qw + x0) * 3 + c]! * (1 - tx) + bright[(y0 * qw + x1) * 3 + c]! * tx;
        const bottom = bright[(y1 * qw + x0) * 3 + c]! * (1 - tx) + bright[(y1 * qw + x1) * 3 + c]! * tx;
        image[i + c] = image[i + c]! + strength * (top * (1 - ty) + bottom * ty);
      }
    }
  }
}

/** Integer hash of (x, y, frame, seed) → [0, 1). Order independent and identical in every JS engine. */
export function grainNoise(x: number, y: number, frame: number, seed: number) {
  let h = (seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(frame + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Average → glow (in the mixing space) → encode sRGB → monochrome grain → RGBA8. */
export function finishFrame(acc: FrameAccumulator, settings: PostSettings): Uint8ClampedArray {
  if (!acc.count) throw new Error('No samples accumulated');
  const { width: w, height: h } = acc;
  const image = acc.image ??= new Float32Array(acc.sum.length);
  const sum = acc.sum, count = acc.count;
  for (let i = 0; i < image.length; i++) image[i] = sum[i]! / count;
  const linear = acc.space === 'linear';
  if (settings.glow > 0) addGlow(image, w, h, settings.glow, linear);
  const out = new Uint8ClampedArray(w * h * 4);
  const amount = settings.grain * 2, seed = settings.seed >>> 0, frame = settings.frame;
  const level = (v: number, n: number) => Math.round(Math.min(1, Math.max(0, v + n)) * 255);
  for (let y = 0, p = 0; y < h; y++) for (let x = 0; x < w; x++, p++) {
    const n = amount ? (grainNoise(x, y, frame, seed) - 0.5) * amount : 0, i = p * 3, o = p * 4;
    if (linear) {
      out[o] = level(encode(image[i]!), n); out[o + 1] = level(encode(image[i + 1]!), n); out[o + 2] = level(encode(image[i + 2]!), n);
    } else {
      out[o] = level(image[i]!, n); out[o + 1] = level(image[i + 1]!, n); out[o + 2] = level(image[i + 2]!, n);
    }
    out[o + 3] = 255;
  }
  return out;
}

/** One accumulator per canvas, reused (and reset) for every output frame of a long export. */
const accumulators = new WeakMap<HTMLCanvasElement, FrameAccumulator>();
function accumulatorFor(canvas: HTMLCanvasElement, space: MixingSpace) {
  let acc = accumulators.get(canvas);
  if (!acc || acc.width !== canvas.width || acc.height !== canvas.height || acc.space !== space) {
    acc = new FrameAccumulator(canvas.width, canvas.height, space); accumulators.set(canvas, acc);
  } else acc.reset();
  return acc;
}

export type OutputSettings = Pick<RenderSettings, 'fps' | 'samples' | 'mixing' | 'glow' | 'grain'>;
/**
 * Render output frame k exactly as the video pipeline does: S centered samples,
 * mixed with equal weight, then glow and grain. Browser only (reads the canvas).
 */
export function renderOutputFrame(runtime: SceneRuntime, canvas: HTMLCanvasElement, k: number, settings: OutputSettings, seed: number, params?: Parameters<SceneRuntime['render']>[1]) {
  const frames = outputFrameCount(runtime.meta.duration, settings.fps);
  if (!Number.isInteger(k) || k < 0 || k >= frames) throw new Error(`Output frame outside scene: ${k}`);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const acc = accumulatorFor(canvas, settings.mixing);
  for (const t of sampleTimes(k, settings.fps, settings.samples)) {
    runtime.render(Math.min(t, runtime.meta.duration), params);
    acc.add(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
  }
  return finishFrame(acc, { glow: settings.glow, grain: settings.grain, seed, frame: k });
}
