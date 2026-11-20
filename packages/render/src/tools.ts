// Native tools Mografy downloads the first time it needs them instead of at installation: one pinned build per
// platform, checked against a SHA-256 before it is used, kept in a shared cache (~/.mografy/tools, or $MOGRAFY_TOOLS).
// A download is written to a temporary folder beside the cache and renamed into place only when it is complete and
// verified, so an interrupted or corrupted download is never used. Several processes (the player, `mografy export`,
// a batch) that need the same tool at once share one download: within a process through one promise, across
// processes through a lock folder.
import { createHash, randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { chmod, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, hostname } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';

export interface ToolBuild {
  /** Download URL of the (gzipped when `gzip`) executable. */
  url: string;
  sha256: string;
  bytes: number;
  gzip?: boolean;
  /** Licence text saved beside the executable (best effort, not verified). */
  licence?: string;
}
export interface ToolSpec {
  /** Folder name in the cache; includes the version, so a new pin never reuses an old build. */
  id: string;
  /** Executable name inside the folder (without `.exe`). */
  executable: string;
  builds: Partial<Record<string, ToolBuild>>;
}
export type DownloadProgress = (received: number, total: number) => void;

export const platformKey = (platform: NodeJS.Platform = process.platform, arch: string = process.arch) => `${platform}-${arch}`;
export const toolsDir = () => process.env.MOGRAFY_TOOLS ?? join(homedir(), '.mografy', 'tools');
const exe = (name: string, platform = process.platform) => platform === 'win32' ? `${name}.exe` : name;
/** Where a tool's executable lives once downloaded (whether or not it is there yet). */
export const toolPath = (spec: ToolSpec, platform = process.platform, arch = process.arch) =>
  join(toolsDir(), `${spec.id}-${platformKey(platform, arch)}`, exe(spec.executable, platform));

const exists = (file: string) => stat(file).then(s => s.isFile(), () => false);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * A lock whose owner stopped refreshing it this long ago belongs to a process that died mid-download (the owner
 * refreshes it every few seconds). On the same machine a dead owner is noticed at once from its process id.
 */
const STALE_LOCK_MS = 60_000;
const REFRESH_MS = 5_000;
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM'; } };
async function stale(lock: string) {
  const owner = join(lock, 'owner.json');
  const info = await readFile(owner, 'utf8').then(text => JSON.parse(text) as { pid: number; host: string }, () => undefined);
  if (info && info.host === hostname() && !alive(info.pid)) return true;
  // No owner file yet: the owner may be between mkdir and writing it; judge by the folder's age.
  const age = await stat(info ? owner : lock).then(st => Date.now() - st.mtimeMs, () => 0);
  return age > STALE_LOCK_MS;
}
async function withLock<T>(lock: string, signal: AbortSignal | undefined, run: () => Promise<T>, ready: () => Promise<boolean>): Promise<T | undefined> {
  await mkdir(dirname(lock), { recursive: true });
  for (;;) {
    signal?.throwIfAborted();
    try {
      await mkdir(lock);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (await stale(lock)) { await rm(lock, { recursive: true, force: true }); continue; }
      // Someone else is downloading: wait for them, then use what they finished.
      await sleep(500);
      if (await ready()) return undefined;
    }
  }
  const owner = join(lock, 'owner.json');
  const mark = () => writeFile(owner, JSON.stringify({ pid: process.pid, host: hostname() })).catch(() => {});
  await mark();
  const refresh = setInterval(() => void mark(), REFRESH_MS);
  refresh.unref();
  try { return await run(); } finally { clearInterval(refresh); await rm(lock, { recursive: true, force: true }); }
}

const pending = new Map<string, Promise<string>>();

/**
 * The tool's executable, downloading it first when the cache does not have it. Resolves to its path.
 * Throws when this platform has no pinned build, the download fails, or the checksum does not match.
 */
export interface ToolOptions { onProgress?: DownloadProgress | undefined; signal?: AbortSignal | undefined; fetch?: typeof fetch | undefined }
export function ensureTool(spec: ToolSpec, options: ToolOptions = {}): Promise<string> {
  const target = toolPath(spec);
  let job = pending.get(target);
  if (!job) {
    job = (async () => {
      if (await exists(target)) return target;
      const build = spec.builds[platformKey()];
      if (!build) throw new Error(`Mografy has no ${spec.executable} download for ${platformKey()}.`);
      const folder = dirname(target);
      await withLock(`${folder}.lock`, options.signal, () => download(spec, build, folder, options), () => exists(target));
      if (!await exists(target)) throw new Error(`${spec.executable} download did not finish.`);
      return target;
    })();
    pending.set(target, job);
    // A failure is not remembered: the next call tries again.
    job.catch(() => pending.delete(target));
  }
  return job;
}

async function download(spec: ToolSpec, build: ToolBuild, folder: string, options: ToolOptions) {
  if (await exists(join(folder, exe(spec.executable)))) return;
  const fetchImpl = options.fetch ?? fetch;
  // We hold the lock, so any other temporary folder for this tool is left over from a process that died.
  const prefix = `${basename(folder)}.tmp-`;
  for (const name of await readdir(dirname(folder)).catch(() => [] as string[]))
    if (name.startsWith(prefix)) await rm(join(dirname(folder), name), { recursive: true, force: true }).catch(() => {});
  const temp = `${folder}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`;
  await mkdir(temp, { recursive: true });
  try {
    const init = options.signal ? { signal: options.signal } : {};
    const response = await fetchImpl(build.url, init).catch(error => {
      throw new Error(`Could not download ${spec.executable} from ${build.url}: ${(error as Error).message}`);
    });
    if (!response.ok || !response.body) throw new Error(`Could not download ${spec.executable} (${response.status}) from ${build.url}`);
    const total = Number(response.headers.get('content-length')) || build.bytes;
    const hash = createHash('sha256');
    let received = 0, reported = 0;
    const count = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        hash.update(chunk); received += chunk.length;
        if (received - reported > 256 * 1024 || received === total) { reported = received; options.onProgress?.(received, total); }
        done(null, chunk);
      },
    });
    const file = join(temp, exe(spec.executable));
    const body = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream<Uint8Array>);
    if (build.gzip) await pipeline(body, count, createGunzip(), createWriteStream(file), init);
    else await pipeline(body, count, createWriteStream(file), init);
    options.onProgress?.(received, received);
    const digest = hash.digest('hex');
    if (digest !== build.sha256) throw new Error(`${spec.executable} download is damaged (SHA-256 ${digest}, expected ${build.sha256}). Try again.`);
    await chmod(file, 0o755);
    if (build.licence) {
      const licence = await fetchImpl(build.licence, init).then(r => r.ok ? r.text() : undefined, () => undefined);
      if (licence) await writeFile(join(temp, 'LICENSE.txt'), licence);
    }
    await writeFile(join(temp, 'source.json'), JSON.stringify({ url: build.url, sha256: build.sha256 }, null, 2) + '\n');
    await rename(temp, folder).catch(async error => {
      // Another process finished first (the folder exists): keep theirs.
      if (!await exists(join(folder, exe(spec.executable)))) throw error;
    });
  } finally {
    await rm(temp, { recursive: true, force: true }).catch(() => {});
  }
}

/** Forget in-flight downloads (tests). */
export function resetTools() { pending.clear(); }

/** Read a downloaded tool's recorded source, for `mografy setup --check`. */
export async function toolSource(spec: ToolSpec) {
  const file = join(dirname(toolPath(spec)), 'source.json');
  return readFile(file, 'utf8').then(text => JSON.parse(text) as { url: string; sha256: string }, () => undefined);
}
