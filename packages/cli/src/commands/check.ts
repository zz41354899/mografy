// `mografy check`: compile and trial-render, through the running player when there is one.
import { access, realpath } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { deckSlides, frameCostReport, readApiResponse, sendApi, shotIssues, smoothnessReport, tempoIssues } from '@mografy/core';
import type { FrameCost, Smoothness, Snapshot } from '@mografy/core';
import { Project, findServer } from '@mografy/server';
import { displayPath, requireProject } from '../paths.js';

export async function checkProject(dir: string, motion = false) {
  await requireProject(dir);
  console.log(`Checking ${displayPath(dir)}`);
  // Every film keeps its design decisions in style.md, so later sessions keep its look (the Skill writes it).
  const hasStyle = dir.split(sep).includes('.components') || await access(join(dir, 'style.md')).then(() => true, () => false);
  const passed = (snapshot: Snapshot & { cost?: FrameCost | undefined }) => {
    if (!snapshot.scene || snapshot.error) throw new Error(snapshot.error?.message ?? 'The scene did not publish.');
    console.log(`✓ Compiled and trial-rendered in Chromium\n  ${snapshot.scene.meta.width}×${snapshot.scene.meta.height}, ${snapshot.scene.meta.duration}s, version ${snapshot.scene.version}`);
    const { meta, autoShots } = snapshot.scene;
    if (meta.shots && autoShots) {
      const count = deckSlides(meta, snapshot.project?.slides).length;
      const where = snapshot.project?.slides?.shots ? 'slides.shots in mografy.json' : 'the running player';
      console.log(`• No shots marked in the scene: ${count} slide${count === 1 ? '' : 's'} guessed from the ${autoShots} (${where}). Mark meta.shots to set them.`);
    } else if (meta.shots) {
      const issues = shotIssues(meta);
      if (issues.length) throw new Error(issues.join('\n'));
      const count = deckSlides(meta, snapshot.project?.slides).length;
      console.log(`✓ ${meta.shots.length} shot${meta.shots.length === 1 ? '' : 's'}, ${count} presentation slide${count === 1 ? '' : 's'}`);
    }
    if (meta.tempo) {
      const issues = tempoIssues(meta, snapshot.project?.audio);
      if (issues.length) console.log(issues.map(issue => `! ${issue}`).join('\n') + '\n  Change meta.tempo or the audio settings so the picture and the music share one grid.');
      else console.log(`✓ Timed to ${meta.tempo.bpm} BPM${snapshot.project?.audio ? ', matching the audio' : ' (no audio yet)'}`);
    }
    if (snapshot.cost) {
      const { summary, warnings } = frameCostReport(snapshot.cost);
      console.log(`${warnings.length ? '!' : '✓'} ${summary}${warnings.map(w => `\n! ${w}`).join('')}`);
    }
    if (!hasStyle) console.log('! No style.md: write the film\'s idea, design system and motion decisions to style.md (see the Skill\'s taste.md), so later changes keep this look.');
  };
  // A running player already owns this project: ask it, so the check uses its queue and Chromium
  // and the player shows the same result, instead of starting a second Chromium beside it.
  const running = await findServer(dir);
  if (running) {
    const identity = await realpath(resolve(dir));
    const response = await sendApi(running.url, 'check', 'POST', undefined, identity);
    if (response.status !== 409) {
      passed(await readApiResponse<Snapshot>(response));
      if (motion) printMotion(await readApiResponse<Smoothness>(await sendApi(running.url, 'check/motion', 'POST', undefined, identity)));
      return;
    }
  }
  const project = await Project.open(dir);
  try {
    passed({ ...project.snapshot(), cost: await project.measure().catch(() => undefined) });
    if (motion) printMotion(await project.motion());
  } finally { await project.close(); }
}

function printMotion(result: Smoothness) {
  const { summary, warnings } = smoothnessReport(result);
  console.log(`${warnings.length ? '!' : '✓'} ${summary}${warnings.map(w => `\n! ${w}`).join('')}`);
}
