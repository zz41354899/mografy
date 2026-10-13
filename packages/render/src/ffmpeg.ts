import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';

/** MOGRAFY_FFMPEG, then the bundled ffmpeg-static binary, then ffmpeg on PATH. */
export function ffmpegPath(): string {
  if (process.env.MOGRAFY_FFMPEG) return process.env.MOGRAFY_FFMPEG;
  try {
    const bundled: unknown = createRequire(import.meta.url)('ffmpeg-static');
    if (typeof bundled === 'string') return bundled;
  } catch { /* fall through */ }
  return 'ffmpeg';
}

export interface FfmpegProcess { child: ChildProcess; done: Promise<void>; write(chunk: Buffer): Promise<void>; end(): Promise<void>; kill(): void }

export function startFfmpeg(args: string[], input = false, signal?: AbortSignal): FfmpegProcess {
  const child = spawn(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-nostdin', ...args].filter(a => !(input && a === '-nostdin')), { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
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

export const runFfmpeg = (args: string[], signal?: AbortSignal) => startFfmpeg(args, false, signal).done;

/** Run FFmpeg and collect stdout (for decoding frames back for comparison). */
export function ffmpegOutput(args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-nostdin', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    const out: Buffer[] = []; let stderr = '';
    child.stdout!.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr!.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-8000); });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`FFmpeg failed (${code}): ${stderr.trim()}`)));
  });
}
