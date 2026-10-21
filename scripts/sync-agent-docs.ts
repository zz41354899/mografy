// Generate one shared outer .agents folder and migrate animation subproject guidance.
// Guidance is owned by packages/core/src/guide.ts; executable helpers are copied from scripts/.
import { lstat, mkdir, readdir, readFile, realpath, rmdir, symlink, unlink } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { obsoleteStoryboardFiles, sharedSkillFiles } from '../packages/core/src/guide.js';
import { atomicWrite } from '../packages/server/src/files.js';
import { queueProjectWrite } from '../packages/server/src/project.js';
import { ensureAgentFiles, isProject } from '../packages/server/src/workspace.js';
import { recordSkillSources } from '../packages/cli/src/skills.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv.length > 2) throw new Error('Usage: pnpm sync:skills');
for (const [name, files] of Object.entries(sharedSkillFiles())) {
  if (name === 'mografy') files['scripts/compress-video.py'] = await readFile(join(root, 'scripts', 'compress-video.py'), 'utf8');
  const skill = join(root, '.agents', 'skills', name);
  await queueProjectWrite(skill, async () => {
    for (const [file, contents] of Object.entries(files)) await atomicWrite(join(skill, file), contents);
  });
  console.log(`Generated ${skill}`);
}

// Remove only exact generated files from the former standalone storyboard Skill.
const obsolete = join(root, '.agents', 'skills', 'mografy-storyboard');
await queueProjectWrite(obsolete, async () => {
  for (const [file, expected] of Object.entries(obsoleteStoryboardFiles(root))) {
    const path = join(obsolete, file);
    if (await readFile(path, 'utf8').catch(() => undefined) === expected) await unlink(path);
  }
  for (const folder of [join(obsolete, 'references'), obsolete]) {
    await rmdir(folder).catch(error => {
      if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error;
      if (error.code !== 'ENOENT') console.log(`Preserved custom files in ${folder}`);
    });
  }
});

// Native Claude discovery reads the same physical Skill as Codex.
const claudeSkills = join(root, '.claude', 'skills');
const claudeEntry = join(claudeSkills, 'mografy');
const shared = join(root, '.agents', 'skills', 'mografy');
await queueProjectWrite(claudeSkills, async () => {
  await mkdir(claudeSkills, { recursive: true });
  const entry = await lstat(claudeEntry).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return undefined;
  });
  if (!entry) await symlink(relative(claudeSkills, shared), claudeEntry, 'dir');
  else if (!entry.isSymbolicLink() || await realpath(claudeEntry) !== await realpath(shared)) {
    throw new Error(`Preserving an existing custom Claude entry: ${claudeEntry}`);
  }
});
console.log(`Claude entry ${claudeEntry} -> ${shared}`);

let projects = 0;
async function install(dir: string): Promise<void> {
  if (await isProject(dir)) { await ensureAgentFiles(dir); projects++; }
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (entry.isDirectory() && !['node_modules', '.mografy', '.git', '.agents', '.claude', 'assets', 'renders', 'scenes'].includes(entry.name)) {
      await install(join(dir, entry.name));
    }
  }
}
await install(join(root, 'examples'));
await install(join(root, 'projects'));
console.log(`Updated guidance in ${projects} local projects; both hosts share one repository-root Mografy Skill.`);
await recordSkillSources(root);
