// Bundled previews are captured in Chromium; scene modules are never evaluated here.
import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSceneProject } from '@mografy/core';
import { atomicWrite, readJson } from './files.js';
import { queueProjectWrite } from './project.js';

export const COMPONENT_THUMBNAILS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../thumbnails');

/** Stable across clones; covers source files, assets and settings used by raw previews. */
export async function thumbnailFingerprint(dir: string) {
  const project = validateSceneProject(JSON.parse(await readFile(join(dir, 'mografy.json'), 'utf8')));
  const hash = createHash('sha256').update(JSON.stringify({ scene: project.scene, seed: project.seed, params: project.params, fonts: project.fonts, audio: project.audio }));
  const walk = async (path: string): Promise<void> => {
    for (const entry of (await readdir(join(dir, path), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const local = `${path}/${entry.name}`;
      if (entry.isDirectory()) await walk(local);
      else if (entry.isFile()) hash.update(local).update('\0').update(await readFile(join(dir, local))).update('\0');
    }
  };
  await walk('scenes');
  await walk('assets');
  return hash.digest('hex');
}

/** Seed only missing previews of unchanged built-ins. Preserve custom scenes and existing captures. */
export function seedComponentThumbnail(dir: string, id: string) {
  return queueProjectWrite(dir, async () => {
    const target = join(dir, '.mografy/thumb.png');
    if (await access(target).then(() => true, () => false)) return;
    const metadata = await readJson<{ fingerprint: string }>(join(COMPONENT_THUMBNAILS_DIR, `${id}.json`));
    if (!metadata || metadata.fingerprint !== await thumbnailFingerprint(dir).catch(() => undefined)) return;
    const png = await readFile(join(COMPONENT_THUMBNAILS_DIR, `${id}.png`)).catch(() => undefined);
    if (png) await atomicWrite(target, png);
  });
}
