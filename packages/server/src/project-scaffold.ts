// Project creation and generated instruction migration; every write uses Project's queue.
import { access, mkdir, readdir, readFile, rmdir, unlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { aspectRatioSchema, projectGuide, SKILL, SKILL_REFERENCES, isLegacyAgentFile } from '@mografy/core';
import type { AspectRatio } from '@mografy/core';
import { atomicWrite } from './files.js';
import { queueProjectWrite } from './project.js';
import { REPO_ROOT, TEMPLATE_DIR } from './installation.js';

export const exists = (path: string) => access(path).then(() => true, () => false);
export const isProject = (dir: string) => exists(join(dir, 'mografy.json'));

/** Remove only exact generated files; preserve customized instructions and references. Call within the project queue. */
export async function removeGeneratedProjectSkills(dir: string) {
  for (const host of ['.agents', '.claude']) {
    const skill = join(dir, host, 'skills', 'mografy');
    const entry = join(skill, 'SKILL.md');
    const contents = await readFile(entry, 'utf8').catch(() => undefined);
    if (contents !== undefined && contents !== SKILL && !isLegacyAgentFile(contents, 'skill')) continue;
    if (contents !== undefined) await unlink(entry);
    for (const [name, expected] of Object.entries(SKILL_REFERENCES)) {
      const file = join(skill, 'references', name);
      if (await readFile(file, 'utf8').catch(() => undefined) === expected) await unlink(file);
    }
    for (const folder of [join(skill, 'references'), skill, dirname(skill), join(dir, host)]) {
      await rmdir(folder).catch(error => {
        if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error;
      });
    }
  }
}

/** Install project pointers for both hosts; full Skills live in the source repository's outer .agents folder. */
async function writeAgentFiles(dir: string) {
  const agents = join(dir, 'AGENTS.md');
  const current = await readFile(agents, 'utf8').catch(() => '');
  // Upgrade only the old generated guide. Preserve every custom AGENTS.md.
  if (!current || isLegacyAgentFile(current, 'guide', REPO_ROOT) || (current.startsWith('# Mografy 場景撰寫指南') && current.includes('## 工作流程（MCP）'))) await atomicWrite(agents, projectGuide());
  const claude = join(dir, 'CLAUDE.md');
  if (!await exists(claude)) await atomicWrite(claude, '@AGENTS.md\n');
  await removeGeneratedProjectSkills(dir);
}

export function ensureAgentFiles(dir: string) {
  return queueProjectWrite(dir, () => writeAgentFiles(dir));
}

/** Turn a display name into a folder name. */
export function folderName(name: string) {
  const cleaned = name.trim().replace(/[\\/:*?"<>|\s]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : 'untitled';
}

/** Copy the starter project into `dir`, which must not already be a project. */
export async function createProject(dir: string, name?: string, scene?: string, aspectRatio?: AspectRatio) {
  if (aspectRatio !== undefined) aspectRatioSchema.parse(aspectRatio);
  return queueProjectWrite(dir, async () => {
    await mkdir(dir, { recursive: true });
    if (await isProject(dir)) throw new Error(`${dir} already has a mografy.json`);
    const copy = async (source: string, target: string): Promise<void> => {
      for (const entry of await readdir(source, { withFileTypes: true })) {
        if (entry.name === '.mografy') continue;
        const dest = join(target, entry.name === 'gitignore' ? '.gitignore' : entry.name);
        if (entry.isDirectory()) { await mkdir(dest, { recursive: true }); await copy(join(source, entry.name), dest); }
        else if (!await exists(dest) && entry.name !== 'mografy.json') await atomicWrite(dest, await readFile(join(source, entry.name)));
      }
    };
    await copy(TEMPLATE_DIR, dir);
    const manifest = JSON.parse(await readFile(join(TEMPLATE_DIR, 'mografy.json'), 'utf8'));
    const folder = basename(dir);
    manifest.name = name?.trim() || (folder && !/^(mografy|untitled|desktop)$/i.test(folder) ? folder : manifest.name);
    if (aspectRatio) manifest.aspectRatio = aspectRatio;
    if (scene) {
      await atomicWrite(join(dir, 'scenes', 'main.ts'), scene);
      manifest.review = { times: [0, 0.8, 2, 3.5, 4.8, 6], transitions: [] };
    }
    await writeAgentFiles(dir);
    // Publish the manifest last: interrupted scaffolds can be retried safely.
    await atomicWrite(join(dir, 'mografy.json'), JSON.stringify(manifest, null, 2) + '\n');
    return dir;
  });
}
