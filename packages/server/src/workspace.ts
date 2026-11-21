// Read-only discovery and explicit library-level operations.
import { projectPaths } from '@mografy/render/fs-util';
import { mkdir, readdir, readFile, realpath, stat } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import { validateSceneProject } from '@mografy/core';
import type { AspectRatio, ProjectList, ProjectSummary } from '@mografy/core';
import { EXAMPLES_DIR, libraryDir } from './installation.js';
import { lastProject, readRecent } from './workspace-state.js';
import { COMPONENT_PRESETS, componentRoot, ensureComponentsProject } from './components.js';
import { createProject, exists, folderName, isProject } from './project-scaffold.js';
import { queueProjectWrite } from './files.js';

export * from './installation.js';
export * from './workspace-state.js';
export * from './components.js';
export * from './project-scaffold.js';

/** Current project, last opened project, or the bundled component showcase on first launch. */
export async function defaultProject(cwd = process.cwd()) {
  if (await isProject(cwd)) return cwd;
  const last = await lastProject();
  // Upgrade the former six-in-one showcase without overwriting its scene or user edits.
  return last && resolve(last) !== componentRoot() ? last : await ensureComponentsProject();
}

/**
 * What `mografy dev` opens from a folder that is not a project: the last project when it is in the library
 * (~/Mografy, or projects/ in a checkout), else the built-in components. Never a project from another repository.
 */
export async function libraryProject() {
  const last = await lastProject();
  if (last && resolve(last).startsWith(resolve(libraryDir()) + sep) && resolve(last) !== componentRoot()) return last;
  return ensureComponentsProject();
}

/** Create a project named `name` in the library folder, picking a free folder name. */
export async function createInLibrary(name: string, aspectRatio?: AspectRatio) {
  const base = folderName(name);
  const root = libraryDir();
  await mkdir(root, { recursive: true });
  return queueProjectWrite(root, async () => {
    let dir = join(root, base);
    for (let i = 2; await exists(dir); i++) dir = join(root, `${base}-${i}`);
    return createProject(dir, name, undefined, aspectRatio);
  });
}

async function summarize(dir: string, kind: ProjectSummary['kind']): Promise<ProjectSummary | undefined> {
  try {
    const file = join(dir, 'mografy.json');
    const [raw, info] = await Promise.all([readFile(file, 'utf8'), stat(file)]);
    let name = basename(dir), valid = true;
    try { name = validateSceneProject(JSON.parse(raw)).name; } catch { valid = false; }
    const thumb = await stat(projectPaths(dir).thumb).then(s => s.mtimeMs, () => null);
    return { dir: await realpath(dir), name, kind, valid, updatedAt: new Date(info.mtimeMs).toISOString(), thumb };
  } catch { return undefined; }
}
async function subfolders(root: string) {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  return entries.filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => join(root, e.name));
}
/** Recent projects first, then the library folder, then examples; each project listed once. */
export async function listProjects(current?: string): Promise<ProjectList> {
  const seen = new Set<string>(), projects: ProjectSummary[] = [];
  const add = async (dir: string, kind: ProjectSummary['kind']) => {
    const real = await realpath(dir).catch(() => undefined);
    if (!real || seen.has(real) || !await isProject(real)) return;
    const summary = await summarize(real, kind);
    if (summary) { seen.add(real); projects.push(summary); }
  };
  const examples = new Set((await subfolders(EXAMPLES_DIR)).map(d => resolve(d)));
  for (const preset of COMPONENT_PRESETS) await add(join(componentRoot(), preset.id), 'component');
  // Projects in the library folder always list as library, opened or not, so that section never empties out.
  const library = await subfolders(libraryDir());
  const inLibrary = new Set(await Promise.all(library.map(d => realpath(d).catch(() => resolve(d)))));
  for (const dir of (await readRecent()).projects) {
    if (resolve(dir) === componentRoot() || inLibrary.has(await realpath(dir).catch(() => resolve(dir)))) continue;
    await add(dir, examples.has(resolve(dir)) ? 'example' : 'recent');
  }
  for (const dir of library) await add(dir, 'library');
  for (const dir of examples) await add(dir, 'example');
  return { current: current ?? null, library: libraryDir(), projects };
}
