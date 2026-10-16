import type { SceneProject } from './index.js';

/** Inputs that require a fresh scene setup or change renderFrame's context. */
export function sceneRuntimeKey(version: string, project: Pick<SceneProject, 'aspectRatio' | 'seed' | 'fonts' | 'audio'>) {
  return JSON.stringify([
    version, project.aspectRatio ?? null, project.seed,
    project.fonts.map(font => [font.family, font.path, font.weight ?? 400]),
    project.audio ? [project.audio.path, project.audio.bpm, project.audio.offset, project.audio.beatsPerBar] : null,
  ]);
}
