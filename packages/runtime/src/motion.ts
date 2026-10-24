// Motion helpers: eased time windows, springs, follow-through and a musical grid.
// All are pure functions of absolute time, so they are safe in renderFrame and at module level.
import { clamp, ease, pr } from './math.js';

export type Curve = (p: number) => number;

/** Eased progress of `time` between `start` and `end` (0 before, 1 after). */
export const at = (time: number, start: number, end: number, curve: Curve = ease.outCubic) => curve(pr(time, start, end));
/** In over [a, b], out over [c, d]: 0 → 1 → 0. */
export const win = (time: number, a: number, b: number, c: number, d: number, enter: Curve = ease.outCubic, exit: Curve = ease.inOutCubic) =>
  at(time, a, b, enter) * (1 - at(time, c, d, exit));

/**
 * A damped spring as an easing curve for `p` in 0..1, normalised to land exactly on 1 at p = 1.
 * `stiffness` is how many natural periods fit in the window (higher settles sooner); `damping` 1 has no
 * overshoot, 0.8 overshoots about 1.5 %.
 */
export function springEase(stiffness = 6, damping = 1): Curve {
  const x = (u: number) => {
    if (damping >= 1) return 1 - (1 + u) * Math.exp(-u);
    const wd = Math.sqrt(1 - damping * damping);
    return 1 - Math.exp(-damping * u) * (Math.cos(wd * u) + damping / wd * Math.sin(wd * u));
  };
  const end = x(stiffness);
  return p => p <= 0 ? 0 : p >= 1 ? 1 : x(stiffness * p) / end;
}
/** Tuned spring curves: `out` for entrances, `pop` for cards and buttons (tiny overshoot), `camera`, `cursor`. */
export const springs = Object.freeze({ out: springEase(5.5, 1), pop: springEase(7.5, .8), camera: springEase(6.5, 1), cursor: springEase(6, 1) });

/**
 * A spring from 0 to 1 that starts at `start` and settles exactly on 1 by `start + duration × 1.6`.
 * `bounce` 0 has no overshoot; 0.18 gives a small, lively overshoot.
 */
export function spring(time: number, start: number, duration = 0.7, bounce = 0.18) {
  const t = time - start;
  if (t <= 0) return 0;
  if (t >= duration * 1.6) return 1;
  const zeta = 1 - bounce * 1.6, omega = 2 * Math.PI / (duration * .78);
  const wd = omega * Math.sqrt(Math.max(1e-4, 1 - zeta * zeta));
  const v = 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + (zeta * omega / wd) * Math.sin(wd * t));
  const tail = pr(t, duration * 1.1, duration * 1.6);
  return v + (1 - v) * ease.inOutCubic(tail);
}

/** Follow-through: a decaying wobble around 0 after `start`, for landings, overshoots and squash. Exactly 0 outside the window. */
export function settle(time: number, start: number, duration: number, amplitude: number, cycles = 1.5) {
  if (time <= start || time >= start + duration) return 0;
  const u = (time - start) / duration;
  return amplitude * Math.sin(u * Math.PI * 2 * cycles) * Math.exp(-5 * u) * (1 - u) ** 2;
}

/** A Gaussian bump that peaks at 1 at `at`: presses, flashes, highlights. */
export const pulse = (time: number, at: number, width = 0.07) => Math.exp(-(((time - at) / width) ** 2));

/** Delay for item `i` of a stagger, optionally eased across the group so the last items bunch up or spread out. */
export function stagger(i: number, count: number, step: number, curve?: Curve) {
  if (!curve || count <= 1) return i * step;
  return curve(clamp(i / (count - 1))) * step * (count - 1);
}

export interface Tempo { bpm: number; beatsPerBar?: number | undefined; offset?: number | undefined }
export interface TempoGrid {
  bpm: number; beatsPerBar: number; offset: number;
  /** Seconds per beat and per bar. */
  beat: number; bar: number;
  /** Time of bar `n` (from 0) plus `k` beats. */
  onBar(n: number, k?: number): number;
  /** Time of beat `n` (from 0). */
  onBeat(n: number): number;
  /** Nearest beat time to `time`, for snapping a hand-picked moment onto the grid. */
  snap(time: number): number;
}
/**
 * A musical grid for timing constants. Declare the tempo once in the scene's `meta.tempo`
 * and build times from it, so cuts, hits and the logo stay on the music when the tempo changes.
 * `mografy check` reports a tempo that differs from mografy.json `audio`.
 */
export function tempoGrid(tempo: Tempo): TempoGrid {
  if (!(tempo.bpm > 0)) throw new Error('tempoGrid needs a positive bpm');
  const beatsPerBar = tempo.beatsPerBar ?? 4, offset = tempo.offset ?? 0, beat = 60 / tempo.bpm, bar = beat * beatsPerBar;
  return Object.freeze({
    bpm: tempo.bpm, beatsPerBar, offset, beat, bar,
    onBar: (n: number, k = 0) => offset + n * bar + k * beat,
    onBeat: (n: number) => offset + n * beat,
    snap: (time: number) => offset + Math.round((time - offset) / beat) * beat,
  });
}
