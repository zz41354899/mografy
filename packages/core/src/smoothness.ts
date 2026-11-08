// `mografy check --motion`: find where a film's motion is choppy rather than slow. Frame cost cannot see
// a jump, a hard start or a hard stop; the change between consecutive frames can.
import type { MotionFrames } from './auto-shots.js';

/**
 * Limits on the mean change between consecutive tiny greyscale frames (0–255 per pixel, 1/30 s apart).
 * still: below this nothing visibly moves (grain and shimmer stay under it). moving: a change worth
 * reporting. jump: a single frame changes this many times more than the frames around it. edge: a start
 * or stop whose first or last frame already moves this fraction of the move's peak has no ease.
 */
export const MOTION_LIMITS = { step: 1 / 30, still: 0.12, moving: 1, jump: 4, edge: 0.6 } as const;

export type MotionEventKind = 'jump' | 'start' | 'stop' | 'seam';
export interface MotionEvent { kind: MotionEventKind; time: number; diff: number }
export interface Smoothness {
  step: number; frames: number;
  /** The largest change between two consecutive frames and the time of the later frame. */
  max: { time: number; diff: number };
  events: MotionEvent[];
  /** For a looping film (meta.loop): the change from the last frame back to the first. */
  seam?: number | undefined;
}
export interface SmoothnessOptions {
  /** The film loops (meta.loop): its last frame must match its first, or the loop shows a seam. */
  loop?: boolean | undefined;
}

/** Mean absolute change between each frame and the next (length frames − 1). */
export function frameDiffs(frames: MotionFrames): number[] {
  const { size, data } = frames, count = Math.floor(data.length / size), out: number[] = [];
  for (let f = 1; f < count; f++) {
    let sum = 0;
    for (let p = 0, a = (f - 1) * size, b = f * size; p < size; p++) sum += Math.abs(data[b + p]! - data[a + p]!);
    out.push(sum / size);
  }
  return out;
}

const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)]! : 0; };
const round = (n: number, k = 100) => Math.round(n * k) / k;

/**
 * Jumps: one frame changes far more than its neighbours (a pop, a teleport, or a hard cut).
 * Starts: motion begins at full speed straight out of a still frame. Stops: it ends at full speed into one.
 */
export function smoothness(frames: MotionFrames, limits = MOTION_LIMITS, options: SmoothnessOptions = {}): Smoothness {
  const d = frameDiffs(frames), time = (i: number) => round((i + 1) * frames.step, 1000);
  const events: MotionEvent[] = [];
  let max = { time: 0, diff: 0 };
  d.forEach((v, i) => {
    if (v > max.diff) max = { time: time(i), diff: round(v) };
    if (v < limits.moving) return;
    const around = [...d.slice(Math.max(0, i - 4), i), ...d.slice(i + 1, i + 5)];
    const prev = d[i - 1] ?? 0, next = d[i + 1] ?? 0;
    if (v > limits.jump * Math.max(median(around), limits.still) && v > 2 * Math.max(prev, next)) {
      events.push({ kind: 'jump', time: time(i), diff: round(v) });
      return;
    }
    if (i > 0 && prev < limits.still && v >= limits.edge * Math.max(...d.slice(i, i + 6)))
      events.push({ kind: 'start', time: time(i), diff: round(v) });
    if (i < d.length - 1 && next < limits.still && v >= limits.edge * Math.max(...d.slice(Math.max(0, i - 5), i + 1)))
      events.push({ kind: 'stop', time: time(i), diff: round(v) });
  });
  let seam: number | undefined;
  const count = Math.floor(frames.data.length / frames.size);
  if (options.loop && count > 1) {
    // Frames are sampled from 0 to the duration inclusive, so a seamless loop's last frame equals its first.
    let sum = 0;
    for (let p = 0, a = (count - 1) * frames.size; p < frames.size; p++) sum += Math.abs(frames.data[a + p]! - frames.data[p]!);
    seam = round(sum / frames.size);
    if (seam >= limits.moving) events.push({ kind: 'seam', time: time(count - 2), diff: seam });
  }
  return { step: frames.step, frames: d.length + 1, max, events, ...(seam !== undefined ? { seam } : {}) };
}

const WHAT: Record<MotionEventKind, string> = {
  jump: 'Jumps (one frame changes far more than its neighbours: a pop, two tracks that do not meet, or a hard cut)',
  start: 'Hard starts (motion leaves a still frame at full speed: no ease-in, or an entrance that jumps on its first frame)',
  stop: 'Hard stops (motion halts at full speed: chained eases, a fade that ends above 0, or a spring cut short)',
  seam: 'Loop seam (meta.loop is set, but the last frame differs from the first: undo every change on screen and settle before the end)',
};

/** One summary line and the warnings for `mografy check --motion`. */
export function smoothnessReport(s: Smoothness): { summary: string; warnings: string[] } {
  const at = (t: number) => `${t.toFixed(2)}s`;
  const summary = `Motion at ${Math.round(1 / s.step)} fps (${s.frames} frames): largest frame change ${s.max.diff} at ${at(s.max.time)}, `
    + (s.events.length ? `${s.events.length} choppy moment${s.events.length === 1 ? '' : 's'}` : 'no jumps, hard starts or hard stops')
    + (s.seam !== undefined && !s.events.some(e => e.kind === 'seam') ? ', loop seam clean' : '');
  const warnings = (['jump', 'start', 'stop', 'seam'] as const).flatMap(kind => {
    const list = s.events.filter(e => e.kind === kind);
    if (!list.length) return [];
    const shown = list.slice(0, 8).map(e => at(e.time)).join(', ') + (list.length > 8 ? ` and ${list.length - 8} more` : '');
    return [`${WHAT[kind]}: ${shown}. Look at those frames; a deliberate cut is fine.`];
  });
  return { summary, warnings };
}
