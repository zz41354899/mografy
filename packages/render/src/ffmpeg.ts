import { spawn, execFile } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ensureTool, toolPath, type ToolOptions, type ToolSpec } from './tools.js';

const RELEASE = 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1';
const build = (key: string, sha256: string, bytes: number, licence: string) =>
  ({ url: `${RELEASE}/ffmpeg-${key}.gz`, sha256, bytes, gzip: true, licence: `${RELEASE}/${licence}.LICENSE` });
/**
 * Static FFmpeg builds from ffmpeg-static's release b6.1.1 (the ones ffmpeg-static 5.3 installed; GPL): libx264, libx265, libvpx-vp9, prores_ks
 * and AAC on every platform. Downloaded on the first export instead of at installation.
 */
export const FFMPEG: ToolSpec = {
  id: 'ffmpeg-b6.1.1',
  executable: 'ffmpeg',
  builds: {
    'darwin-arm64': build('darwin-arm64', '8923876afa8db5585022d7860ec7e589af192f441c56793971276d450ed3bbfa', 19_246_198, 'darwin-arm64'),
    'darwin-x64': build('darwin-x64', '929b375c1182d956c51f7ac25e0b2b0411fb01f6f407aa15c9758efeb4242106', 25_296_431, 'darwin-x64'),
    'linux-x64': build('linux-x64', 'bfe8a8fc511530457b528c48d77b5737527b504a3797a9bc4866aeca69c2dffa', 29_354_986, 'linux-x64'),
    'linux-arm64': build('linux-arm64', '754a678672298bc68156adff58aa7385a592c2b30b1d0ae8750c45c915c4bac0', 25_568_691, 'linux-arm64'),
    'win32-x64': build('win32-x64', '8883a3dffbd0a16cf4ef95206ea05283f78908dbfb118f73c83f4951dcc06d77', 29_581_307, 'win32-x64'),
  },
};
/** Software encoders an FFmpeg must have to be used without a download: every format and preset Mografy offers. */
export const REQUIRED_ENCODERS = ['libx264', 'libx265', 'libvpx-vp9', 'prores_ks', 'aac'];

/** An ffmpeg-static binary left in node_modules by an installation from before on-demand downloads. */
function legacyBundled(): string | undefined {
  try {
    const bundled: unknown = createRequire(import.meta.url)('ffmpeg-static');
    if (typeof bundled === 'string' && existsSync(bundled)) return bundled;
  } catch { /* not installed */ }
  return undefined;
}

let resolved: string | undefined;
/**
 * The FFmpeg to run: $MOGRAFY_FFMPEG, else the one `ensureFfmpeg` chose, else a downloaded build, else a legacy
 * ffmpeg-static binary, else ffmpeg on PATH. Call `ensureFfmpeg` before an export so the choice is made (and a
 * download happens) first.
 */
export function ffmpegPath(): string {
  if (process.env.MOGRAFY_FFMPEG) return process.env.MOGRAFY_FFMPEG;
  if (resolved) return resolved;
  const downloaded = toolPath(FFMPEG);
  if (existsSync(downloaded)) return downloaded;
  return legacyBundled() ?? 'ffmpeg';
}

/** The encoders an FFmpeg lists (`-encoders`), or undefined when it does not run. */
export function listEncoders(binary: string): Promise<Set<string> | undefined> {
  return new Promise(resolve => {
    execFile(binary, ['-hide_banner', '-encoders'], { windowsHide: true, timeout: 15_000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
      if (error) return resolve(undefined);
      resolve(new Set(stdout.split('\n').map(line => /^\s*[VAS][A-Z.]{5}\s+(\S+)/.exec(line)?.[1]).filter((name): name is string => Boolean(name))));
    });
  });
}

export interface FfmpegChoice { path: string; source: 'env' | 'downloaded' | 'bundled' | 'system' | 'system-incomplete'; missing?: string[] }
let choosing: Promise<FfmpegChoice> | undefined;
/**
 * Pick the FFmpeg exports use, downloading Mografy's pinned build only when nothing usable is installed:
 * $MOGRAFY_FFMPEG → an earlier download → a legacy ffmpeg-static binary → ffmpeg on PATH when it has every encoder in
 * REQUIRED_ENCODERS (unless MOGRAFY_SYSTEM_FFMPEG=0) → download. When the download is impossible (offline, or no build for this platform), an incomplete
 * system FFmpeg is still used (an export that needs a missing encoder then says which). The choice is made once per process.
 */
export function ensureFfmpeg(options: ToolOptions = {}): Promise<FfmpegChoice> {
  if (process.env.MOGRAFY_FFMPEG) return Promise.resolve({ path: process.env.MOGRAFY_FFMPEG, source: 'env' });
  choosing ??= (async (): Promise<FfmpegChoice> => {
    const downloaded = toolPath(FFMPEG);
    if (existsSync(downloaded)) return { path: downloaded, source: 'downloaded' };
    const bundled = legacyBundled();
    if (bundled) return { path: bundled, source: 'bundled' };
    // A project's own installation (`npx mografy@latest init`) sets MOGRAFY_SYSTEM_FFMPEG=0: it never uses PATH's ffmpeg.
    const system = process.env.MOGRAFY_SYSTEM_FFMPEG === '0' ? undefined : await listEncoders('ffmpeg');
    const missing = system ? REQUIRED_ENCODERS.filter(name => !system.has(name)) : REQUIRED_ENCODERS;
    if (system && !missing.length) return { path: 'ffmpeg', source: 'system' };
    try {
      return { path: await ensureTool(FFMPEG, options), source: 'downloaded' };
    } catch (error) {
      // Offline, or no build for this platform: an FFmpeg that lacks some encoders still exports what it can
      // (planCodec falls back from H.265 to H.264, and names a missing encoder it cannot do without).
      if (system) return { path: 'ffmpeg', source: 'system-incomplete', missing };
      throw new Error(`${(error as Error).message}\nFFmpeg is needed for video exports. Connect to the internet and run \`mografy setup\`, `
        + 'or install FFmpeg yourself (macOS: brew install ffmpeg · Windows: winget install Gyan.FFmpeg · Linux: your package manager) '
        + 'or point MOGRAFY_FFMPEG at one.');
    }
  })();
  const job = choosing;
  job.then(choice => { resolved = choice.path; }, () => { if (choosing === job) choosing = undefined; });
  return job;
}
/** Forget the choice (tests). */
export function resetFfmpegChoice() { choosing = undefined; resolved = undefined; }

export interface FfmpegProcess { child: ChildProcess; done: Promise<void>; write(chunk: Buffer): Promise<void>; end(): Promise<void>; kill(): void }

/** `cwd` lets encoder options name files relatively (x265 stats paths cannot contain the colon of a Windows drive). */
export function startFfmpeg(args: string[], input = false, signal?: AbortSignal, cwd?: string): FfmpegProcess {
  const child = spawn(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-nostdin', ...args].filter(a => !(input && a === '-nostdin')), { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'pipe'], windowsHide: true, ...(cwd ? { cwd } : {}) });
  let stderr = '';
  child.stderr!.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-8000); });
  child.stdin?.on('error', () => {});
  const abort = () => child.kill('SIGKILL');
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  const done = new Promise<void>((resolve, reject) => {
    child.once('error', error => reject(new Error(`FFmpeg could not start (${ffmpegPath()}): ${error.message}`)));
    child.once('close', (code, exitSignal) => {
      signal?.removeEventListener('abort', abort);
      code === 0 ? resolve() : reject(new Error(`FFmpeg failed (${code ?? exitSignal}): ${stderr.trim()}`));
    });
  });
  void done.catch(() => {});
  return {
    child, done,
    write: chunk => new Promise((resolve, reject) => {
      if (!child.stdin) return reject(new Error('FFmpeg has no input'));
      child.stdin.write(chunk, error => error ? reject(error) : resolve());
    }),
    async end() { child.stdin?.end(); await done; },
    kill() { child.kill('SIGKILL'); },
  };
}

export const runFfmpeg = (args: string[], signal?: AbortSignal, cwd?: string) => startFfmpeg(args, false, signal, cwd).done;

/** Run FFmpeg and collect stdout (for decoding frames back for comparison). */
export function ffmpegOutput(args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-nostdin', ...args], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const out: Buffer[] = []; let stderr = '';
    child.stdout!.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr!.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-8000); });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`FFmpeg failed (${code}): ${stderr.trim()}`)));
  });
}
