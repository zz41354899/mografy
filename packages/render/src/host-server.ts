// The localhost server headless Chromium loads from: the host page, scene builds, project files and frame uploads.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';

const MIME: Record<string, string> = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg' };

const bundles = new Map<string, Promise<string>>();
/** Bundle an in-page script (the host page or its output worker, with runtime + core) once per process. */
function pageBundle(name: 'host-page' | 'post-worker') {
  let bundle = bundles.get(name);
  if (!bundle) {
    const self = fileURLToPath(import.meta.url);
    const entry = resolve(self, '..', `${name}${extname(self)}`);
    bundle = esbuild({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'browser', target: 'chrome120', write: false, logLevel: 'silent' })
      .then(result => result.outputFiles[0]!.text);
    bundles.set(name, bundle);
  }
  return bundle;
}

/** Resolve a request path to a file inside the project, refusing dot-directories and escapes. */
export async function projectFile(projectDir: string, relativePath: string) {
  const parts = relativePath.split('/');
  if (!relativePath || parts.some(p => !p || p === '..' || p.startsWith('.')) || relativePath.includes('\\') || relativePath.includes(':')) throw new Error(`Unsafe asset path: ${relativePath}`);
  const root = await realpath(projectDir);
  const file = await realpath(resolve(root, relativePath));
  const local = relative(root, file);
  if (!local || local.startsWith('..') || isAbsolute(local)) throw new Error(`Asset outside project: ${relativePath}`);
  if (!(await stat(file)).isFile()) throw new Error(`Not a file: ${relativePath}`);
  return file;
}

/** Largest frame or sheet a page may upload; Node buffers cannot hold much more. */
const UPLOAD_LIMIT = 512 * 1024 ** 2;
export interface FrameWaiter { resolve(data: Buffer): void; reject(error: Error): void }
export interface HostRoutes { readonly origin: string; readonly projectDir: string; readonly builds: Map<string, string>; readonly waiters: Map<string, FrameWaiter> }

export async function handleHostRequest(host: HostRoutes, request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? '/', host.origin);
  const fail = (status: number, message: string) => { response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' }); response.end(message); };
  // Only the headless page this host opened: refuse other hosts (DNS rebinding) and cross-site requests.
  if (request.headers.host !== new URL(host.origin).host || request.headers['sec-fetch-site'] === 'cross-site') return fail(403, 'forbidden');
  try {
    if (request.method === 'POST' && url.pathname.startsWith('/upload/')) {
      const waiter = host.waiters.get(url.pathname.slice(8));
      if (!waiter) return fail(404, 'unknown token');
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of request) {
        size += (chunk as Buffer).length;
        if (size > UPLOAD_LIMIT) { host.waiters.delete(url.pathname.slice(8)); waiter.reject(new Error('Rendered data is larger than 512 MB')); return fail(413, 'too large'); }
        chunks.push(chunk as Buffer);
      }
      host.waiters.delete(url.pathname.slice(8));
      waiter.resolve(Buffer.concat(chunks));
      response.writeHead(204); response.end(); return;
    }
    if (request.method !== 'GET') return fail(405, 'method');
    if (url.pathname === '/') { response.writeHead(200, { 'content-type': 'text/html' }); response.end('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"><script type="module" src="/host.js"></script>'); return; }
    if (url.pathname === '/host.js') { response.writeHead(200, { 'content-type': 'text/javascript' }); response.end(await pageBundle('host-page')); return; }
    if (url.pathname === '/post-worker.js') { response.writeHead(200, { 'content-type': 'text/javascript' }); response.end(await pageBundle('post-worker')); return; }
    const scene = /^\/scene\/([\da-f]+)\.js$/.exec(url.pathname);
    if (scene) {
      const code = host.builds.get(scene[1]!);
      if (!code) return fail(404, 'unknown build');
      response.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' }); response.end(code); return;
    }
    if (url.pathname.startsWith('/project/')) {
      const file = await projectFile(host.projectDir, decodeURIComponent(url.pathname.slice(9)));
      response.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' });
      response.end(await readFile(file)); return;
    }
    fail(404, 'not found');
  } catch (error) { fail(404, error instanceof Error ? error.message : String(error)); }
}
