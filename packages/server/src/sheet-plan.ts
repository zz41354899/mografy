// POST /sheet: which frames a review sheet shows, and how they are laid out.
import { outputFrameCount } from '@mografy/core';
import type { SceneMeta, SceneProject } from '@mografy/core';
import type { Cell } from '@mografy/render';
import { ApiError } from './errors.js';
import { num } from './http-io.js';

export interface SheetRequest { times?: number[] | undefined; transition?: { start: number; end: number; step?: number | undefined } | undefined; kind?: 'raw' | 'output' | undefined }
const MAX_CELLS = 48;

/** Pure: the times come from the request, a transition's range or the project's review times; limits answer 400. */
export function sheetPlan(spec: SheetRequest, project: Pick<SceneProject, 'review' | 'render' | 'name'>, scene: { version: string; meta: Pick<SceneMeta, 'duration'> }) {
  const fps = project.render.fps, frames = outputFrameCount(scene.meta.duration, fps);
  let times = spec.times?.map(t => num(t, 'time')) ?? project.review.times;
  if (spec.transition) {
    const step = num(spec.transition.step ?? 1 / fps, 'step'), start = num(spec.transition.start, 'start'), end = num(spec.transition.end, 'end');
    if (step <= 0 || end < start) throw new ApiError(400, 'INVALID', 'Invalid transition range');
    times = [];
    for (let t = start; t <= end + 1e-9 && times.length < MAX_CELLS; t += step) times.push(Number(t.toFixed(6)));
  }
  if (!times.length || times.length > MAX_CELLS) throw new ApiError(400, 'INVALID', `Give 1–${MAX_CELLS} times`);
  const kind = spec.kind === 'output' ? 'output' : 'raw';
  const cells: Cell[] = times.map(t => {
    const c = Math.min(Math.max(0, t), scene.meta.duration), k = Math.min(frames - 1, Math.floor(c * fps + 1e-9));
    return kind === 'raw' ? { kind, t: c, label: `t=${c.toFixed(3)}s` } : { kind, k, label: `frame ${k}, ${(k / fps).toFixed(3)}s` };
  });
  return {
    title: [`${project.name}, version ${scene.version}, ${kind === 'raw' ? 'raw' : 'final'} frames`],
    cells, columns: Math.min(times.length, spec.transition ? 6 : 4), cellWidth: spec.transition ? 280 : 400,
  };
}
