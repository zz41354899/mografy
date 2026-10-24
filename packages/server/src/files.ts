import { randomUUID, createHash } from 'node:crypto';
import { lstat, mkdir, open, readFile, rename, stat, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

export const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

/** Write through a temp file + rename so readers never see a half-written file. */
export async function atomicWrite(path: string, data: string | Buffer | AsyncIterable<Uint8Array>) {
  try { if ((await lstat(path)).isSymbolicLink()) throw new Error(`Refusing to write through a symlink: ${path}`); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  await mkdir(dirname(path), { recursive: true });
  const temp = join(dirname(path), `.tmp-${randomUUID()}`);
  const mode = await stat(path).then(s => s.mode & 0o777).catch(() => 0o644);
  const file = await open(temp, 'wx', mode);
  try {
    if (typeof data === 'string' || Buffer.isBuffer(data)) await file.writeFile(data);
    else for await (const chunk of data) await file.writeFile(chunk);
    await file.sync(); await file.close(); await replace(temp, path);
  }
  finally { await file.close().catch(() => {}); await unlink(temp).catch(() => {}); }
}

/**
 * On Windows a virus scanner, the search indexer or an editor can hold a just-written file for a moment,
 * and the rename then fails with EPERM, EACCES or EBUSY. Retry briefly instead of failing the save.
 */
async function replace(from: string, to: string) {
  for (let attempt = 0; ; attempt++) {
    try { return await rename(from, to); }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (process.platform !== 'win32' || attempt >= 9 || !['EPERM', 'EACCES', 'EBUSY'].includes(code ?? '')) throw error;
      await new Promise(done => setTimeout(done, 50 * (attempt + 1)));
    }
  }
}

const SOURCE = /\.(ts|mts|cts|js|mjs|cjs)$/;
const RESERVED = new Set(['.mografy', 'renders', 'node_modules', '.git', 'assets']);
/** Validate a project-relative scene source path from a client. */
export function sourcePath(root: string, path: string) {
  const parts = path.split('/');
  if (!path || isAbsolute(path) || path.includes('\\') || path.includes(':') || parts.some(p => !p || p === '.' || p === '..' || p.startsWith('.')))
    throw new Error(`Invalid source path: ${path}`);
  if (RESERVED.has(parts[0]!)) throw new Error(`Source files cannot live in ${parts[0]}/: ${path}`);
  if (!SOURCE.test(path)) throw new Error(`Source files must be .ts or .js: ${path}`);
  const file = resolve(root, path), local = relative(root, file);
  if (local.startsWith('..') || isAbsolute(local)) throw new Error(`Outside project: ${path}`);
  return file;
}

export async function readJson<T>(path: string): Promise<T | undefined> {
  try { return JSON.parse(await readFile(path, 'utf8')) as T; } catch { return undefined; }
}

const ASSET = /\.(mp3|wav|m4a|aac|ogg|oga|flac|png|jpe?g|webp|gif|svg|ttf|otf|woff2?)$/i;
/**
 * Save an uploaded file into the project's assets/ folder under a safe name.
 * An existing file with different content keeps its name; the upload gets -2, -3….
 */
export async function saveAsset(root: string, name: string, data: Buffer) {
  const base = name.split(/[\\/]/).pop()!.normalize('NFC').replace(/[^\p{L}\p{N}._\- ]+/gu, '-').replace(/\s+/g, '-').replace(/^[.-]+/, '');
  if (!base || !ASSET.test(base)) throw new Error('Use an audio, image or font file (mp3, wav, m4a, ogg, flac, png, jpg, webp, svg, ttf, otf, woff)');
  if (!data.length) throw new Error('The file is empty');
  const dot = base.lastIndexOf('.'), stem = base.slice(0, dot), ext = base.slice(dot);
  for (let i = 1; i < 1000; i++) {
    const file = `${stem}${i === 1 ? '' : `-${i}`}${ext}`, path = join(root, 'assets', file);
    const existing = await readFile(path).catch(() => undefined);
    if (existing && sha256(existing) === sha256(data)) return `assets/${file}`;
    if (!existing) { await atomicWrite(path, data); return `assets/${file}`; }
  }
  throw new Error('Too many files with that name');
}
