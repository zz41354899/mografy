import { access, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite, readJson } from './files.js';
import { stateDir } from './installation.js';
import { queueProjectWrite } from './project.js';

interface Recent { projects: string[] }
async function readRecentAt(root: string): Promise<Recent> {
  const data = await readJson<Recent & { last?: string }>(join(root, 'recent.json'));
  const projects = Array.isArray(data?.projects) ? data.projects.filter(p => typeof p === 'string') : data?.last ? [data.last] : [];
  return { projects };
}
export const readRecent = () => readRecentAt(stateDir());
export async function rememberProject(dir: string) {
  const root = stateDir();
  // Recent history is optional; an unavailable state directory must not block opening a project.
  try { await mkdir(root, { recursive: true }); } catch { return; }
  await queueProjectWrite(root, async () => {
    const { projects } = await readRecentAt(root);
    const next = [dir, ...projects.filter(p => p !== dir)].slice(0, 20);
    await atomicWrite(join(root, 'recent.json'), JSON.stringify({ projects: next, last: dir }, null, 2) + '\n');
  }).catch(() => {});
}
export async function lastProject() {
  for (const dir of (await readRecent()).projects) if (await access(join(dir, 'mografy.json')).then(() => true, () => false)) return dir;
  return undefined;
}

export interface ActiveServer { pid: number; url: string; token: string; project: string }
const activePath = () => join(stateDir(), 'active.json');
export async function writeActive(record: ActiveServer) {
  const root = stateDir();
  await mkdir(root, { recursive: true });
  return queueProjectWrite(root, () => atomicWrite(join(root, 'active.json'), JSON.stringify(record, null, 2) + '\n'));
}
export async function clearActive(token: string) {
  const root = stateDir();
  return queueProjectWrite(root, async () => {
    const file = join(root, 'active.json');
    const record = await readJson<ActiveServer>(file);
    if (record?.token === token) await unlink(file).catch(() => {});
  });
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
