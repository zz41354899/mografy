// Time, frames and beats.


/** Number of output frames for a duration. */
export const outputFrameCount = (duration: number, fps: number) => Math.max(1, Math.ceil(duration * fps - 1e-9));
/**
 * Equal-weight sample times for output frame k: S evenly spaced, centred in sub-intervals of a window that covers
 * `shutter`/360 of the frame interval. With `after` the window is centred on (k + 0.5)/fps (with a 360° shutter,
 * exactly (S·k + j + 0.5) / (S·fps), the original timing); with `centred` it is centred on k/fps, in step with audio.
 */
export function sampleTimes(k: number, fps: number, samples: number, shutter = 360, window: 'after' | 'centred' = 'after'): number[] {
  const span = Math.min(360, Math.max(0, shutter)) / 360 / fps, centre = (window === 'centred' ? k : k + 0.5) / fps;
  if (span === 1 / fps && window === 'after') return Array.from({ length: samples }, (_, j) => (samples * k + j + 0.5) / (fps * samples));
  return Array.from({ length: samples }, (_, j) => Math.max(0, centre + ((j + 0.5) / samples - 0.5) * span));
}
/** Split [0, frames) into contiguous ranges on output-frame boundaries. */
export function segmentFrames(frames: number, workers: number): { start: number; end: number }[] {
  const count = Math.max(1, Math.min(workers, frames));
  return Array.from({ length: count }, (_, i) => ({ start: Math.floor(frames * i / count), end: Math.floor(frames * (i + 1) / count) }));
}

export interface BeatGrid { bpm: number; offset: number; beatsPerBar?: number | undefined }
export interface BeatPosition { beat: number; bar: number; beatInBar: number; phase: number; period: number }
/** Beat index counts from the beat at `offset`; negative before it. phase is 0..1 within the beat. */
export function beatAt(t: number, grid: BeatGrid): BeatPosition {
  if (!Number.isFinite(t) || !(grid.bpm > 0)) throw new Error('Invalid beat query');
  const period = 60 / grid.bpm, per = grid.beatsPerBar ?? 4, x = (t - grid.offset) / period;
  // Snap values within 1e-9 of a beat so sampling exactly on a beat is stable.
  const near = Math.round(x), position = Math.abs(x - near) < 1e-9 ? near : x;
  const beat = Math.floor(position);
  return { beat, bar: Math.floor(beat / per), beatInBar: ((beat % per) + per) % per, phase: position - beat, period };
}
/** Beat times within [0, duration]. */
export function beatTimes(duration: number, grid?: BeatGrid): number[] {
  if (!grid) return [];
  const period = 60 / grid.bpm;
  const first = Math.ceil((0 - grid.offset) / period - 1e-9);
  const last = Math.floor((duration - grid.offset) / period + 1e-9);
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => grid.offset + (first + i) * period);
}
