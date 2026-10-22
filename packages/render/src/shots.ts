// Shots for scenes that do not list `meta.shots`, so Present mode still has one slide per shot.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { autoShots } from '@mografy/core';
import type { AutoShots } from '@mografy/core';
import type { HostPage } from './host.js';

/** The project's written shot plan, when there is one. */
export const readStoryboard = (projectDir: string) => readFile(join(projectDir, 'storyboards', 'storyboard.md'), 'utf8').catch(() => undefined);

/** Sample the scene as tiny greyscale frames (10 per second, at most 1200) and guess its shots. */
export async function detectShots(page: HostPage, storyboard?: string): Promise<AutoShots> {
  const { duration } = page.scene.meta;
  const step = Math.max(0.1, duration / 1200);
  const times = Array.from({ length: Math.floor(duration / step + 1e-6) + 1 }, (_, i) => Math.min(duration, i * step));
  const data = new Uint8Array(await page.motion(times, 64));
  return autoShots({ duration, frames: { step, size: data.length / times.length, data }, storyboard });
}
