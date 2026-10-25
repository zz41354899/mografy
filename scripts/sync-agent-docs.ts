// Generate one shared outer .agents folder and migrate animation subproject guidance.
// Guidance is written in packages/core/skill/*.md (assembled by packages/core/src/guide.ts); executable helpers are copied from scripts/.
import { createHash } from 'node:crypto';
import { lstat, mkdir, readdir, readFile, realpath, rmdir, symlink, unlink } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error plain ESM build script without type declarations
import { writeSkillText } from '../packages/core/scripts/skill-text.mjs';
import { atomicWrite } from '../packages/server/src/files.js';
import { queueProjectWrite } from '../packages/server/src/project.js';
import { ensureAgentFiles, isProject } from '../packages/server/src/workspace.js';
import { recordSkillSources } from '../packages/cli/src/skills.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Bundle the Markdown first, so an edited reference is picked up even before `pnpm build`.
writeSkillText();
const { obsoleteStoryboardFiles, sharedSkillFiles } = await import('../packages/core/src/guide.js');
if (process.argv.length > 2) throw new Error('Usage: pnpm sync:skills');
for (const [name, files] of Object.entries(sharedSkillFiles())) {
  if (name === 'mografy') files['scripts/compress-video.py'] = await readFile(join(root, 'scripts', 'compress-video.py'), 'utf8');
  const skill = join(root, '.agents', 'skills', name);
  await queueProjectWrite(skill, async () => {
    for (const [file, contents] of Object.entries(files)) await atomicWrite(join(skill, file), contents);
  });
  console.log(`Generated ${skill}`);
}

// The Codex-only supplement became the shared references/motion-design.md; remove only the unedited generated copy.
const retired = join(root, '.agents', 'skills', 'mografy', 'references', 'codex-motion-design.md');
const retiredContents = await readFile(retired).catch(() => undefined);
if (retiredContents && createHash('sha256').update(retiredContents).digest('hex') === '9b4a1bf969d0effc8116d5a8f5fc6f5c30731c498230cd30b2603d6c7b1dc641') await unlink(retired);

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
let placeholder = false;
await queueProjectWrite(claudeSkills, async () => {
  await mkdir(claudeSkills, { recursive: true });
  const entry = await lstat(claudeEntry).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return undefined;
  });
  // Windows creates junctions without admin rights or Developer Mode; directory symlinks need one of them.
  if (!entry) await symlink(relative(claudeSkills, shared), claudeEntry, process.platform === 'win32' ? 'junction' : 'dir');
  else if (entry.isFile() && await isGitSymlinkPlaceholder(claudeEntry)) placeholder = true;
  else if (!entry.isSymbolicLink() || await realpath(claudeEntry) !== await realpath(shared)) {
    throw new Error(`Preserving an existing custom Claude entry: ${claudeEntry}`);
  }
});
// Without symlink support (the Git default on Windows) the tracked link is checked out as a small text file
// holding its target. Leave it as Git wrote it, so the checkout stays clean for `mografy update`;
// Claude still reads the Skill through the root CLAUDE.md import.
async function isGitSymlinkPlaceholder(path: string): Promise<boolean> {
  const target = (await readFile(path, 'utf8').catch(() => '')).trim();
  return target !== '' && resolve(claudeSkills, target) === shared;
}
console.log(placeholder
  ? `Claude entry ${claudeEntry} is a Git symlink placeholder (symlinks are off in this checkout); Claude reads the Skill through CLAUDE.md.`
  : `Claude entry ${claudeEntry} -> ${shared}`);

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
