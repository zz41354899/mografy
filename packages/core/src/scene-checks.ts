// What `mografy check` reports about a scene.
import { z } from 'zod';
import { audioSchema } from './project-schema.js';
import type { SceneMeta } from './scene-meta.js';

export type Shot = NonNullable<SceneMeta['shots']>[number];
/** Problems that need the scene's duration: shots the scene cannot reach. */
export function shotIssues(meta: Pick<SceneMeta, 'duration' | 'shots'>): string[] {
  return (meta.shots ?? []).flatMap((shot, i) => [
    ...(shot.end > meta.duration + 1e-6 ? [`Shot ${i + 1} ends at ${shot.end}s, after the scene ends (${meta.duration}s).`] : []),
    ...(shot.stop !== undefined && (shot.stop > shot.end + 1e-6 || shot.stop <= (meta.shots![i - 1]?.end ?? 0) - 1e-6) ? [`Shot ${i + 1} stops at ${shot.stop}s, outside the shot.`] : []),
  ]);
}

/** Differences between the tempo a scene is timed to and the project's audio grid. */
export function tempoIssues(meta: Pick<SceneMeta, 'tempo'>, audio?: Pick<z.infer<typeof audioSchema>, 'bpm' | 'offset' | 'beatsPerBar'>): string[] {
  const tempo = meta.tempo;
  if (!tempo || !audio) return [];
  const issues: string[] = [];
  if (Math.abs(tempo.bpm - audio.bpm) > 1e-6) issues.push(`The scene is timed to ${tempo.bpm} BPM (meta.tempo) but the audio is set to ${audio.bpm} BPM.`);
  if (Math.abs((tempo.offset ?? 0) - (audio.offset ?? 0)) > 1e-3) issues.push(`meta.tempo.offset is ${tempo.offset ?? 0}s but audio.offset is ${audio.offset ?? 0}s.`);
  if ((tempo.beatsPerBar ?? 4) !== (audio.beatsPerBar ?? 4)) issues.push(`meta.tempo has ${tempo.beatsPerBar ?? 4} beats per bar but audio has ${audio.beatsPerBar ?? 4}.`);
  return issues;
}

/** Frame budget used by `mografy check`: slower frames make the player stutter. */
export const FRAME_BUDGET = { slowMs: 100, filters: 8 } as const;
/** One summary line and the warnings for a measured frame cost. */
export function frameCostReport(cost: import('./protocol.js').FrameCost): { summary: string; warnings: string[] } {
  const worst = cost.slowest[0], at = (t: number) => `${t.toFixed(1)}s`;
  const summary = `Frame cost at ${cost.width}×${cost.height} (${cost.canvas.toUpperCase()} canvas, ${cost.frames} frames): median ${cost.medianMs} ms`
    + (worst ? `, slowest ${worst.ms} ms at ${at(worst.time)}` : '');
  const warnings: string[] = [];
  if (worst && worst.ms > FRAME_BUDGET.slowMs)
    warnings.push(`Frames take up to ${worst.ms} ms (${cost.slowest.map(s => at(s.time)).join(', ')}), so the player will stutter. Blur layers instead of setting ctx.filter, reuse buffers, and cache paths and text layout (performance reference).`);
  if (cost.maxFilters.count > FRAME_BUDGET.filters)
    warnings.push(`${cost.maxFilters.count} filters were set on the frame context in one frame (${at(cost.maxFilters.time)}). Each blurs every later draw separately: use blurLayer for groups and blurText for type.`);
  if (cost.canvasesPerFrame > 0)
    warnings.push(`renderFrame creates about ${cost.canvasesPerFrame} canvas${cost.canvasesPerFrame === 1 ? '' : 'es'} per frame. Reuse them with buffer() or layer() from @mografy/runtime.`);
  return { summary, warnings };
}
