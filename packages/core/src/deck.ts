// Presentation slides derived from a scene's shots.
import type { Slides } from './project-schema.js';
import type { Shot } from './scene-checks.js';
import type { SceneMeta } from './scene-meta.js';

export interface DeckSlide {
  index: number;
  /** The scene shot it comes from; its notes live at slides.pages[shot]. */
  shot: number;
  /** Where the transition into this slide starts (the previous stop, or 0). */
  start: number;
  /** The stop itself. */
  at: number;
  title: string; notes: string;
  /** Start of the replayed range while holding, or null to freeze. */
  loopFrom: number | null;
}
/**
 * One slide per shot of the scene, waiting at the shot's stop; a scene without shots is one slide.
 * Shots past the end are dropped, stops are kept in order, loops are clamped to their slide.
 */
export function deckSlides(meta: Pick<SceneMeta, 'duration' | 'fps' | 'shots'>, slides?: Slides): DeckSlide[] {
  const { duration } = meta, frame = 1 / meta.fps;
  const shots = (meta.shots ?? []).filter(shot => shot.end <= duration + 1e-6);
  const list: Shot[] = shots.length ? shots : [{ end: duration }];
  const out: DeckSlide[] = [];
  list.forEach((shot, i) => {
    const last = i === list.length - 1, start = out.at(-1)?.at ?? 0;
    const at = Math.min(duration, shot.stop ?? (last && shot.end >= duration - 1e-6 ? duration : Math.max(0, shot.end - frame)));
    if (out.length && at <= start + 1e-6) return;
    const page = slides?.pages[i], hold = page?.hold ?? slides?.hold ?? 'freeze', index = out.length;
    const loopFrom = hold === 'freeze' || at - start < 0.1 ? null : Math.max(start, at - hold.loop);
    out.push({ index, shot: i, start, at, title: page?.title ?? shot.title ?? `Slide ${index + 1}`, notes: page?.notes ?? '', loopFrom });
  });
  return out;
}
