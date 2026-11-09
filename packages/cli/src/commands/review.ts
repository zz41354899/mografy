// `mografy review`: visual-review sheets, through the running player when there is one.
import { realpath } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { readApiResponse, sendApi } from '@mografy/core';
import type { ReviewResult } from '@mografy/render';
import { Project, findServer } from '@mografy/server';
import { displayPath, requireProject } from '../paths.js';

function printReview(result: ReviewResult) {
  console.log('✓ Visual review created');
  for (const file of result.files) console.log(`  ${displayPath(file)}`);
  console.log(`  ${displayPath(result.report)}`);
  if (result.comparisons.length) console.log(`  PSNR: ${result.comparisons.map(c => `#${c.frame} ${c.psnr}dB`).join(', ')}`);
}

export async function reviewProject(dir: string, video?: string) {
  await requireProject(dir);
  console.log(`Creating visual review for ${basename(dir)}…`);
  const running = !video ? await findServer(dir) : undefined;
  if (running) {
    const response = await sendApi(running.url, 'review', 'POST', undefined, await realpath(resolve(dir)));
    // 409: the player switched to another project just now; review this one directly.
    if (response.status !== 409) { printReview(await readApiResponse<ReviewResult>(response)); return; }
  }
  const project = await Project.open(dir);
  try { printReview(await project.review(video ? resolve(video) : undefined)); }
  finally { await project.close(); }
}
