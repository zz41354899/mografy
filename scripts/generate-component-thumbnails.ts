// Maintain the checked-in previews using actual scene rendering in Chromium.
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { COMPONENT_PRESETS, createProject, TEMPLATE_DIR } from '../packages/server/src/workspace.js';
import { COMPONENT_THUMBNAILS_DIR, thumbnailFingerprint } from '../packages/server/src/component-thumbnails.js';
import { Project, queueProjectWrite } from '../packages/server/src/project.js';
import { atomicWrite } from '../packages/server/src/files.js';

const sandbox = await realpath(await mkdtemp(join(tmpdir(), 'mografy-thumbnails-')));
try {
  for (const preset of COMPONENT_PRESETS) {
    const dir = join(sandbox, preset.id);
    await createProject(dir, preset.name, await readFile(join(TEMPLATE_DIR, 'scenes', `${preset.id}.ts`), 'utf8'), '9:16');
    const project = await Project.open(dir);
    try {
      if (!await project.refreshThumbnail()) throw new Error(`No thumbnail captured for ${preset.id}`);
      const png = await readFile(join(dir, '.mografy/thumb.png'));
      const metadata = JSON.stringify({ fingerprint: await thumbnailFingerprint(dir) }, null, 2) + '\n';
      await queueProjectWrite(COMPONENT_THUMBNAILS_DIR, async () => {
        await atomicWrite(join(COMPONENT_THUMBNAILS_DIR, `${preset.id}.png`), png);
        await atomicWrite(join(COMPONENT_THUMBNAILS_DIR, `${preset.id}.json`), metadata);
      });
      console.log(`Captured ${preset.id}: ${png.length} bytes`);
    } finally { await project.close(); }
  }
} finally { await rm(sandbox, { recursive: true, force: true }); }
