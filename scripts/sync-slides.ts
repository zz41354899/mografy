// Write guessed slides into mografy.json for every listed project whose scene marks no shots.
// Runs after install and update; it never fails the install: problems are reported per project.
import { basename } from 'node:path';
import { listProjects } from '../packages/server/src/workspace.js';
import { syncProjectSlides } from '../packages/server/src/slides-sync.js';

if (process.argv.length > 2) throw new Error('Usage: pnpm sync:slides');
let written = 0;
try {
  const { projects } = await listProjects();
  for (const project of projects) {
    // Bundled components and examples are tracked files of this checkout; writing them would block the next update.
    if ((project.kind !== 'library' && project.kind !== 'recent') || !project.valid) continue;
    try {
      const sync = await syncProjectSlides(project.dir);
      if (sync.result === 'written') {
        written++;
        console.log(`Slides: ${sync.slides} guessed from the ${sync.source} → ${basename(project.dir)}/mografy.json`);
      }
    } catch (error) {
      console.log(`Slides not written for ${project.dir}: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`);
    }
  }
} catch (error) {
  console.log(`Slides were not synced: ${error instanceof Error ? error.message : String(error)}`);
}
console.log(written ? `Wrote guessed slides into ${written} project${written === 1 ? '' : 's'}; edit slides.shots in mografy.json or mark meta.shots in the scene to change them.` : 'Slides: every project already has its shots.');
