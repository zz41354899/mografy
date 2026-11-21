// Where each shot of a scene settles: its stop frame, which review sheets show and agents compare against.
import type { Shot } from './scene-checks.js';
import type { SceneMeta } from './scene-meta.js';

export interface ShotStop {
  /** Index of the shot in meta.shots. */
  shot: number;
  title: string;
  /** Where the shot starts (the previous stop, or 0). */
  start: number;
  /** The stop: the shot's own `stop`, else its last frame. */
  at: number;
}

/** One stop per shot that ends inside the film, in order; shots that would not move past the previous stop are dropped. */
export function shotStops(meta: Pick<SceneMeta, 'duration' | 'fps' | 'shots'>): ShotStop[] {
  const { duration } = meta, frame = 1 / meta.fps;
  const shots: Shot[] = (meta.shots ?? []).filter(shot => shot.end <= duration + 1e-6);
  const out: ShotStop[] = [];
  shots.forEach((shot, i) => {
    const last = i === shots.length - 1, start = out.at(-1)?.at ?? 0;
    const at = Math.min(duration, shot.stop ?? (last && shot.end >= duration - 1e-6 ? duration : Math.max(0, shot.end - frame)));
    if (out.length && at <= start + 1e-6) return;
    out.push({ shot: i, title: shot.title ?? `Shot ${out.length + 1}`, start, at });
  });
  return out;
}
