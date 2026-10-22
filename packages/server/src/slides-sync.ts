// `pnpm install` / `mografy update`: give every project whose scene marks no shots a set of slides in
// mografy.json (`slides.shots`, `slides.guessedFrom`), so presenting works without any edits.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateSceneProject } from '@mografy/core';
import type { AutoShotSource } from '@mografy/core';
import { buildScene, detectShots, readStoryboard, SceneHost } from '@mografy/render';
import { atomicWrite, readJson, sha256 } from './files.js';
import { queueProjectWrite } from './project.js';

export type SlidesSync =
  | { result: 'written'; slides: number; source: AutoShotSource }
  | { result: 'skipped'; reason: 'slides' | 'scene' | 'one-slide' | 'checked' };

/**
 * Guess and write the slides of one project. Projects with shots in mografy.json or in the scene are
 * left alone; a scene already checked at this version and storyboard is skipped without Chromium.
 */
export async function syncProjectSlides(dir: string): Promise<SlidesSync> {
  const manifest = join(dir, 'mografy.json');
  const project = validateSceneProject(JSON.parse(await readFile(manifest, 'utf8')));
  if (project.slides?.shots) return { result: 'skipped', reason: 'slides' };
  const build = await buildScene(dir, project);
  const storyboard = await readStoryboard(dir);
  const key = sha256(JSON.stringify(['slides-sync-1', build.version, project.seed, project.params, storyboard ?? null]));
  const marker = join(dir, '.mografy', 'slides-sync.json');
  if ((await readJson<{ key?: string }>(marker))?.key === key) return { result: 'skipped', reason: 'checked' };
  const host = await SceneHost.start(dir);
  let outcome: SlidesSync;
  try {
    const page = await host.open(build, project, { renderScale: 0.25 });
    try {
      if (page.scene.meta.shots?.length) outcome = { result: 'skipped', reason: 'scene' };
      else {
        const guess = await detectShots(page, storyboard);
        if (guess.shots.length < 2) outcome = { result: 'skipped', reason: 'one-slide' };
        else {
          // Edit the file as written: keep its fields and order, add only the two slide fields.
          await queueProjectWrite(dir, async () => {
            const raw = JSON.parse(await readFile(manifest, 'utf8')) as Record<string, unknown> & { slides?: Record<string, unknown> };
            if (raw.slides?.shots) return;
            const next = { ...raw, slides: { ...raw.slides, shots: guess.shots, guessedFrom: guess.source } };
            validateSceneProject(next);
            await atomicWrite(manifest, JSON.stringify(next, null, 2) + '\n');
          });
          outcome = { result: 'written', slides: guess.shots.length, source: guess.source };
        }
      }
    } finally { await page.close(); }
  } finally { await host.close(); }
  await queueProjectWrite(dir, () => atomicWrite(marker, JSON.stringify({ key }) + '\n')).catch(() => {});
  return outcome;
}
