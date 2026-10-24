import { join } from 'node:path';
import { sceneRuntimeKey } from '@mografy/core';
import type { AutoShots, SceneInfo, SceneProject } from '@mografy/core';
import { detectShots, readStoryboard } from '@mografy/render';
import type { SceneBuild, SceneHost } from '@mografy/render';
import { readJson, sha256 } from './files.js';

interface ShotSource { scene: SceneInfo | null; project: SceneProject | null; build: SceneBuild | undefined }

/**
 * Shots for a scene that lists none: guessed from the storyboard or from the picture, in the background,
 * and cached in .mografy/auto-shots.json for the exact inputs (scene, settings, storyboard).
 */
export class ShotGuesser {
  private guess: (AutoShots & { key: string; duration: number }) | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<unknown> | undefined;
  private closed = false;

  constructor(
    private dir: string,
    private host: SceneHost,
    private source: () => ShotSource,
    /** Queued write of the cache file. */
    private write: (file: string, data: string) => Promise<unknown>,
    /** A new guess is ready for the current version. */
    private changed: () => void,
  ) {}

  /** True when the scene or mografy.json already decides the shots, so nothing is guessed. */
  private decided({ scene, project }: ShotSource) { return !!scene?.meta.shots?.length || !!project?.slides?.shots; }

  /**
   * The scene as clients see it. One that lists no shots carries the guessed ones, so Present mode,
   * the presentation page and the HTML export all get one slide per shot. A guess for the previous
   * version stands in while the new one is measured, as long as the length is unchanged.
   */
  present(scene: SceneInfo | null, project: SceneProject | null): SceneInfo | null {
    const guess = this.guess, slides = project?.slides;
    if (!scene || scene.meta.shots?.length) return scene;
    // Shots written to mografy.json (by hand, by an agent, or by `mografy update`) come next.
    if (slides?.shots) return { ...scene, meta: { ...scene.meta, shots: slides.shots }, ...(slides.guessedFrom ? { autoShots: slides.guessedFrom } : {}) };
    if (!guess || guess.duration !== scene.meta.duration) return scene;
    return { ...scene, meta: { ...scene.meta, shots: guess.shots }, autoShots: guess.source };
  }

  /** Guess shortly after the scene settles, outside the project's write queue. */
  schedule() {
    clearTimeout(this.timer);
    const source = this.source();
    if (this.closed || !source.scene || this.decided(source)) return;
    this.timer = setTimeout(() => { void this.refresh(); }, 400);
  }

  /** Guesses run one after another; each skips work when its inputs match the last guess. */
  private refresh() {
    const next = (this.running ?? Promise.resolve()).then(() => this.guessNow()).catch(() => {});
    this.running = next;
    return next;
  }

  private async guessNow() {
    const source = this.source(), { scene, project, build } = source;
    if (this.closed || !scene || !project || !build || this.decided(source)) return;
    const storyboard = await readStoryboard(this.dir);
    const key = sha256(JSON.stringify(['guess-1', sceneRuntimeKey(scene.version, project), project.params, storyboard ?? null]));
    if (this.guess?.key === key) return;
    const file = join(this.dir, '.mografy', 'auto-shots.json');
    const saved = await readJson<AutoShots & { key?: string }>(file);
    let result: AutoShots;
    if (saved?.key === key && Array.isArray(saved.shots)) result = { source: saved.source, shots: saved.shots };
    else {
      const page = await this.host.open(build, project, { renderScale: 0.25 });
      try { result = await detectShots(page, storyboard); } finally { await page.close(); }
      await this.write(file, JSON.stringify({ key, ...result }) + '\n').catch(() => {});
    }
    if (this.closed || this.source().scene?.version !== scene.version) return;
    this.guess = { ...result, key, duration: scene.meta.duration };
    this.changed();
  }

  async close() {
    this.closed = true;
    clearTimeout(this.timer);
    await this.running;
  }
}
