// `mografy export --format html`: one presentation file that works offline.
import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readApiResponse, sendApi } from '@mografy/core';
import { Project, findServer } from '@mografy/server';
import { displayPath, requireProject } from '../paths.js';

export async function exportDeckProject(dir: string) {
  await requireProject(dir);
  console.log(`Exporting presentation for ${displayPath(dir)}…`);
  const running = await findServer(dir);
  let result: { output: string; bytes: number; slides: number } | undefined;
  if (running) {
    const response = await sendApi(running.url, 'deck', 'POST', undefined, await realpath(resolve(dir)));
    if (response.status !== 409) result = await readApiResponse(response);
  }
  if (!result) {
    const project = await Project.open(dir);
    try { result = await project.exportDeck(); } finally { await project.close(); }
  }
  console.log(`✓ Presentation file written (${result.slides || 'no'} slides, ${(result.bytes / 1048576).toFixed(1)} MB)\n  ${displayPath(result.output)}\n  Open it in a browser to present; it works offline.`);
}
