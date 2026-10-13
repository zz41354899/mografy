// Projects on this computer: where new ones go, which were opened recently, bundled examples,
// and which Mografy server is currently showing the player (so other tools can switch it).
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { access, mkdir, readdir, readFile, realpath, rmdir, stat, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectGuide, SKILL, SKILL_REFERENCES, isLegacyAgentFile, validateSceneProject } from '@mografy/core';
import type { ProjectList, ProjectSummary } from '@mografy/core';
import { atomicWrite, readJson } from './files.js';
import { queueProjectWrite } from './project.js';
import { seedComponentThumbnail } from './component-thumbnails.js';

const here = dirname(fileURLToPath(import.meta.url));
/** Starter project copied by createProject. */
export const TEMPLATE_DIR = resolve(here, '..', 'template');
const REPO_ROOT = resolve(here, '..', '..', '..');
const FROM_SOURCE = existsSync(join(REPO_ROOT, 'pnpm-workspace.yaml'));
/** Example projects shipped in the repository (examples/ at the repo root). */
export const EXAMPLES_DIR = join(REPO_ROOT, 'examples');
/**
 * Where new projects are created: $MOGRAFY_HOME, else projects/ inside the Mografy folder
 * when running from source, else ~/Mografy.
 */
export const libraryDir = () => resolve(process.env.MOGRAFY_HOME ?? (FROM_SOURCE ? join(REPO_ROOT, 'projects') : join(homedir(), 'Mografy')));
/** Separate each installation's recent projects and active player; an override is explicit shared state. */
export function installationStateDir(repository: string) {
  const id = createHash('sha256').update(resolve(repository)).digest('hex').slice(0, 16);
  return join(homedir(), '.mografy', 'installations', id);
}
export const stateDir = () => resolve(process.env.MOGRAFY_STATE ?? installationStateDir(REPO_ROOT));
export const COMPONENT_PRESETS = [
  { id: 'stagger-text', name: 'Stagger text' },
  { id: 'typewriter', name: 'Typewriter' },
  { id: 'pop-card', name: 'Pop card' },
  { id: 'progress-bar', name: 'Progress bar' },
  { id: 'pulse-dots', name: 'Pulse dots' },
  { id: 'logo-reveal', name: 'Logo reveal' },
  { id: 'social-card', name: 'Social card' },
  { id: 'youtube-subscribe', name: 'YouTube subscribe' },
  { id: 'ai-chat', name: 'AI chat' },
  { id: 'like-burst', name: 'Like burst' },
  { id: 'follow-badge', name: 'Follow badge' },
  { id: 'notification-toast', name: 'Notification toast' },
  { id: 'lower-third', name: 'Lower third' },
  { id: 'count-up', name: 'Count up' },
  { id: 'toggle-switch', name: 'Toggle switch' },
  { id: 'audio-wave', name: 'Audio wave' },
] as const;
const componentRoot = () => join(libraryDir(), '.components');
export const DEFAULT_PROJECT = () => join(componentRoot(), COMPONENT_PRESETS[0].id);

const exists = (path: string) => access(path).then(() => true, () => false);
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

// ---------------------------------------------------------------- recent projects

interface Recent { projects: string[] }
async function readRecent(): Promise<Recent> {
  const data = await readJson<Recent & { last?: string }>(join(stateDir(), 'recent.json'));
  const projects = Array.isArray(data?.projects) ? data.projects.filter(p => typeof p === 'string') : data?.last ? [data.last] : [];
  return { projects };
}
export async function rememberProject(dir: string) {
  const { projects } = await readRecent();
  const next = [dir, ...projects.filter(p => p !== dir)].slice(0, 20);
  await atomicWrite(join(stateDir(), 'recent.json'), JSON.stringify({ projects: next, last: dir }, null, 2) + '\n').catch(() => {});
}
export async function lastProject() {
  for (const dir of (await readRecent()).projects) if (await isProject(dir)) return dir;
  return undefined;
}
/** Current project, last opened project, or the bundled component showcase on first launch. */
export async function defaultProject(cwd = process.cwd()) {
  if (await isProject(cwd)) return cwd;
  const last = await lastProject();
  // Upgrade the former six-in-one showcase without overwriting its scene or user edits.
  return last && resolve(last) !== componentRoot() ? last : await ensureComponentsProject();
}

// ---------------------------------------------------------------- creating projects

/** Turn a display name into a folder name. */
export function folderName(name: string) {
  const cleaned = name.trim().replace(/[\\/:*?"<>|\s]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return cleaned || 'untitled';
}

/** Copy the starter project into `dir`, which must not already be a project. */
export async function createProject(dir: string, name?: string, scene?: string) {
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

const componentCreations = new Map<string, Promise<string>>();
const readyComponents = new Set<string>();
async function ensureComponentProject(preset: typeof COMPONENT_PRESETS[number]) {
  const dir = join(componentRoot(), preset.id);
  if (readyComponents.has(dir) && await isProject(dir)) return dir;
  let creation = componentCreations.get(dir);
  if (!creation) {
    creation = (async () => {
    try {
      if (await isProject(dir)) await ensureAgentFiles(dir);
      else await createProject(dir, preset.name, await readFile(join(TEMPLATE_DIR, 'scenes', `${preset.id}.ts`), 'utf8'));
      await seedComponentThumbnail(dir, preset.id);
      readyComponents.add(dir);
      return dir;
    }
    finally { componentCreations.delete(dir); }
    })();
    componentCreations.set(dir, creation);
  }
  return creation;
}
/** Independently editable and exportable animations, installed with Mografy. */
export const ensureComponentProjects = () => Promise.all(COMPONENT_PRESETS.map(ensureComponentProject));
export async function ensureComponentsProject() { return (await ensureComponentProjects())[0]!; }

/** Create a project named `name` in the library folder, picking a free folder name. */
export async function createInLibrary(name: string) {
  const base = folderName(name);
  let dir = join(libraryDir(), base);
  for (let i = 2; await exists(dir); i++) dir = join(libraryDir(), `${base}-${i}`);
  return createProject(dir, name);
}

// ---------------------------------------------------------------- listing

async function summarize(dir: string, kind: ProjectSummary['kind']): Promise<ProjectSummary | undefined> {
  try {
    const file = join(dir, 'mografy.json');
    const [raw, info] = await Promise.all([readFile(file, 'utf8'), stat(file)]);
    let name = basename(dir), valid = true;
    try { name = validateSceneProject(JSON.parse(raw)).name; } catch { valid = false; }
    const thumb = await stat(join(dir, '.mografy', 'thumb.png')).then(s => s.mtimeMs, () => null);
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
  for (const dir of await ensureComponentProjects()) await add(dir, 'component');
  for (const dir of (await readRecent()).projects) {
    if (resolve(dir) !== componentRoot()) await add(dir, examples.has(resolve(dir)) ? 'example' : 'recent');
  }
  for (const dir of await subfolders(libraryDir())) await add(dir, 'library');
  for (const dir of examples) await add(dir, 'example');
  return { current: current ?? null, library: libraryDir(), projects };
}

// ---------------------------------------------------------------- the active player

export interface ActiveServer { pid: number; url: string; token: string; project: string }
const activePath = () => join(stateDir(), 'active.json');
export const writeActive = (record: ActiveServer) => atomicWrite(activePath(), JSON.stringify(record, null, 2) + '\n');
export async function clearActive(token: string) {
  const record = await readJson<ActiveServer>(activePath());
  if (record?.token === token) await unlink(activePath()).catch(() => {});
}
/** The server currently showing the player, if it is alive. */
export async function findActive(): Promise<ActiveServer | undefined> {
  const record = await readJson<ActiveServer>(activePath());
  if (!record?.url) return undefined;
  try {
    const health = await (await fetch(new URL('/__mografy/health', record.url), { signal: AbortSignal.timeout(1500) })).json() as { token?: string };
    return health.token === record.token ? record : undefined;
  } catch { return undefined; }
}
