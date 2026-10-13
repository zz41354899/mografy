// One writer per project: .mografy/server.json records who is serving it.
import { randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite, readJson } from './files.js';

export interface ServerRecord { pid: number; url: string; token: string; startedAt: string }
export class AlreadyRunning extends Error {
  constructor(readonly url: string) { super(`Mografy is already running for this project: ${url}`); this.name = 'AlreadyRunning'; }
}
export const lockPath = (projectDir: string) => join(projectDir, '.mografy', 'server.json');

function alive(pid: number) {
  try { process.kill(pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM'; }
}
/** The URL of a live server for this project, if any. */
export async function findServer(projectDir: string): Promise<ServerRecord | undefined> {
  const record = await readJson<ServerRecord>(lockPath(projectDir));
  if (!record || !Number.isInteger(record.pid) || !alive(record.pid) || !record.url) return undefined;
  try {
    const response = await fetch(new URL('/__mografy/health', record.url), { signal: AbortSignal.timeout(1500) });
    const health = await response.json() as { token?: string };
    return health.token === record.token ? record : undefined;
  } catch { return undefined; }
}

export class ServerLock {
  private constructor(private path: string, readonly token: string) {}
  /** `token` identifies the server process; /__mografy/health answers with it. */
  static async acquire(projectDir: string, token: string = randomUUID()) {
    const existing = await findServer(projectDir);
    if (existing) throw new AlreadyRunning(existing.url);
    const lock = new ServerLock(lockPath(projectDir), token);
    await lock.write('');
    return lock;
  }
  write(url: string) {
    const record: ServerRecord = { pid: process.pid, url, token: this.token, startedAt: new Date().toISOString() };
    return atomicWrite(this.path, JSON.stringify(record, null, 2) + '\n');
  }
  async release() {
    const record = await readFile(this.path, 'utf8').then(t => JSON.parse(t) as ServerRecord).catch(() => undefined);
    if (record?.token === this.token) await unlink(this.path).catch(() => {});
  }
}
