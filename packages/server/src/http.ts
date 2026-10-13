// HTTP + WebSocket front of a Project, plus the built player's static files.
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { projectFile } from '@mografy/render';
import type { Cell } from '@mografy/render';
import type { ExportRequest, ProjectList, ProjectPatch, ServerEvent } from '@mografy/core';
import { ApiError, Project } from './project.js';
import { saveAsset, sha256 } from './files.js';
import { AlreadyRunning, ServerLock } from './lock.js';
import { clearActive, createInLibrary, isProject, listProjects, rememberProject, writeActive } from './workspace.js';

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8', '.svga': 'application/octet-stream' };
const webDist = () => join(dirname(fileURLToPath(import.meta.resolve('@mografy/web/package.json'))), 'dist');

function allowed(request: IncomingMessage) {
  const host = request.headers.host ?? '';
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) return false;
  const origin = request.headers.origin;
  return (!origin || origin === `http://${host}`) && request.headers['sec-fetch-site'] !== 'cross-site';
}
function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  response.end(JSON.stringify(value));
}
async function body<T>(request: IncomingMessage, limit = 2 * 1024 * 1024): Promise<T> {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new ApiError(415, 'CONTENT_TYPE', 'Use application/json');
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) { size += (chunk as Buffer).length; if (size > limit) throw new ApiError(413, 'TOO_LARGE', 'Request too large'); chunks.push(chunk as Buffer); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as T; } catch { throw new ApiError(400, 'INVALID_JSON', 'Invalid JSON'); }
}
async function rawBody(request: IncomingMessage, limit: number) {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) { size += (chunk as Buffer).length; if (size > limit) throw new ApiError(413, 'TOO_LARGE', `File is larger than ${Math.round(limit / 1048576)} MB`); chunks.push(chunk as Buffer); }
  return Buffer.concat(chunks);
}
/** Serve a file with HTTP Range support, so audio and video elements can seek. */
async function sendFile(request: IncomingMessage, response: ServerResponse, file: string) {
  const { size } = await stat(file);
  const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(request.headers.range ?? ''));
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start); end = Math.min(size - 1, end);
    if (start > end) { response.writeHead(416, { 'content-range': `bytes */${size}` }); response.end(); return; }
    response.writeHead(206, { 'content-type': type, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'cache-control': 'no-cache' });
    if (request.method === 'HEAD') { response.end(); return; }
    createReadStream(file, { start, end }).pipe(response); return;
  }
  response.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes', 'cache-control': 'no-cache' });
  if (request.method === 'HEAD') { response.end(); return; }
  createReadStream(file).pipe(response);
}
const num = (value: unknown, name: string) => { const n = Number(value); if (!Number.isFinite(n)) throw new ApiError(400, 'INVALID', `${name} must be a number`); return n; };

export interface StartOptions { port?: number; quiet?: boolean }
export interface RunningServer {
  url: string;
  /** The project currently shown (changes when the player switches projects). */
  readonly project: Project;
  switchProject(dir: string): Promise<unknown>;
  close(): Promise<void>;
}

export async function startServer(projectDir: string, options: StartOptions = {}): Promise<RunningServer> {
  const token = randomUUID();
  let lock = await ServerLock.acquire(projectDir, token);
  let project: Project;
  try { project = await Project.open(projectDir); }
  catch (error) { await lock.release(); throw error; }
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  const send = (socket: WebSocket, event: ServerEvent) => { if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 4 << 20) socket.send(JSON.stringify(event)); };
  const broadcast = (event: ServerEvent) => { for (const socket of sockets.clients) send(socket, event); };
  // Coalesce the list request and its image requests instead of rescanning per thumbnail.
  let catalog: { expires: number; data: Promise<ProjectList> } | undefined;
  const getProjects = () => {
    if (!catalog || catalog.expires <= Date.now()) {
      const next = { expires: Date.now() + 1000, data: listProjects(project.dir) };
      catalog = next;
      void next.data.catch(() => { if (catalog === next) catalog = undefined; });
    }
    return catalog.data;
  };
  const listen = (p: Project) => p.on('event', event => {
    if (p !== project) return;
    if (event.type === 'snapshot' && ['scene', 'project', 'thumbnail'].includes(event.reason)) catalog = undefined;
    broadcast(event);
  });
  listen(project);
  let url = '';

  /** Show another project in this player: take its lock, open it, then let go of the old one. */
  let switching: Promise<unknown> = Promise.resolve();
  const switchProject = (dir: string) => {
    const run = async () => {
      const target = await realpath(resolve(dir)).catch(() => { throw new ApiError(404, 'NOT_FOUND', `Folder not found: ${dir}`); });
      if (target === project.dir) return project.snapshot();
      if (!await isProject(target)) throw new ApiError(404, 'NOT_A_PROJECT', `${target} has no mografy.json`);
      let nextLock: ServerLock;
      try { nextLock = await ServerLock.acquire(target, token); }
      catch (error) {
        if (error instanceof AlreadyRunning) throw new ApiError(409, 'ALREADY_OPEN', `That project is already open in another player: ${error.url}`, { url: error.url });
        throw error;
      }
      let next: Project;
      try { next = await Project.open(target); }
      catch (error) { await nextLock.release(); throw error; }
      next.url = url; await nextLock.write(url); next.watch();
      const old = project, oldLock = lock;
      project = next; lock = nextLock; listen(next);
      catalog = undefined;
      await old.close(); await oldLock.release();
      await rememberProject(target);
      await writeActive({ pid: process.pid, url, token, project: target });
      broadcast({ type: 'snapshot', reason: 'switch', snapshot: project.snapshot() });
      return project.snapshot();
    };
    const next = switching.then(run);
    switching = next.catch(() => {});
    return next;
  };
  sockets.on('connection', socket => {
    socket.on('error', () => {});
    socket.on('message', () => socket.close(1008, 'Use the HTTP API'));
    send(socket, { type: 'snapshot', reason: 'initial', snapshot: project.snapshot() });
  });

  const handle = async (request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const path = url.pathname, method = request.method ?? 'GET';
    if (!allowed(request)) throw new ApiError(403, 'ORIGIN', 'Only same-origin localhost requests are accepted');
    if (!path.startsWith('/__mografy/')) {
      if (method !== 'GET' && method !== 'HEAD') throw new ApiError(405, 'METHOD', 'Method not allowed');
      const root = webDist(), file = normalize(join(root, path === '/' ? 'index.html' : decodeURIComponent(path)));
      if (!file.startsWith(root)) throw new ApiError(404, 'NOT_FOUND', 'Not found');
      const data = await readFile(file).catch(() => readFile(join(root, 'index.html')));
      response.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
      response.end(method === 'HEAD' ? undefined : data); return;
    }
    const route = `${method} ${path.replace(/^\/__mografy/, '')}`;
    const scene = /^GET \/scene\/([\da-f]{16})\.js$/.exec(route);
    if (scene) {
      const build = project.build(scene[1]!) ?? { code: await readFile(join(project.dir, '.mografy', 'builds', `${scene[1]}.js`), 'utf8').catch(() => { throw new ApiError(404, 'NOT_FOUND', 'Unknown version'); }) };
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable' });
      response.end(build.code); return;
    }
    if (route.startsWith('GET /files/') || route.startsWith('HEAD /files/')) {
      const file = await projectFile(project.dir, decodeURIComponent(path.slice('/__mografy/files/'.length))).catch(error => { throw new ApiError(404, 'NOT_FOUND', String(error.message)); });
      return sendFile(request, response, file);
    }
    switch (route) {
      case 'GET /health': return json(response, 200, { ok: true, pid: process.pid, dir: project.dir, token });
      case 'GET /projects': return json(response, 200, await getProjects());
      case 'GET /projects/thumb': {
        const dir = url.searchParams.get('dir') ?? '';
        if (!(await getProjects()).projects.some(p => p.dir === dir)) throw new ApiError(404, 'NOT_FOUND', 'Unknown project');
        const file = await open(join(dir, '.mografy', 'thumb.png'), 'r').catch(() => { throw new ApiError(404, 'NOT_FOUND', 'No thumbnail yet'); });
        try {
          // Read bytes and timestamp from the same inode across atomic replacements.
          const info = await file.stat(), png = await file.readFile();
          const headers = { 'content-type': 'image/png', 'etag': `"${sha256(png)}"`,
            'cache-control': url.searchParams.get('v') === String(info.mtimeMs) ? 'private, max-age=31536000, immutable' : 'no-cache' };
          if (request.headers['if-none-match'] === headers.etag) { response.writeHead(304, headers); response.end(); return; }
          response.writeHead(200, headers); response.end(png); return;
        } finally { await file.close(); }
      }
      case 'POST /projects/open': {
        const { dir } = await body<{ dir?: string }>(request);
        if (typeof dir !== 'string' || !dir) throw new ApiError(400, 'INVALID', 'Expected { dir }');
        return json(response, 200, await switchProject(dir));
      }
      case 'POST /projects/new': {
        const { name } = await body<{ name?: string }>(request);
        if (typeof name !== 'string' || !name.trim() || name.length > 80) throw new ApiError(400, 'INVALID', 'Give the project a name (up to 80 characters)');
        return json(response, 200, await switchProject(await createInLibrary(name)));
      }
      case 'GET /snapshot': return json(response, 200, project.snapshot());
      case 'POST /assets': {
        // Raw upload into assets/ (music, images, fonts). Returns the project-relative path.
        const name = url.searchParams.get('name') ?? '';
        const path = await saveAsset(project.dir, name, await rawBody(request, 200 * 1024 * 1024)).catch(error => { throw error instanceof ApiError ? error : new ApiError(400, 'INVALID', error instanceof Error ? error.message : String(error)); });
        return json(response, 200, { path });
      }
      case 'GET /source': return json(response, 200, await project.readSource());
      case 'POST /source': {
        const { files } = await body<{ files?: Record<string, string> }>(request);
        if (!files || typeof files !== 'object') throw new ApiError(400, 'INVALID', 'Expected { files: { path: content } }');
        return json(response, 200, await project.updateSource(files));
      }
      case 'PATCH /project': {
        const { patch, revision, clientId } = await body<{ patch?: ProjectPatch; revision?: string; clientId?: string }>(request);
        if (!patch || typeof patch !== 'object') throw new ApiError(400, 'INVALID', 'Expected { patch }');
        return json(response, 200, await project.patchProject(patch, revision, clientId));
      }
      case 'PATCH /state': {
        const { playhead, clientId } = await body<{ playhead?: number; clientId?: string }>(request);
        return json(response, 200, project.setPlayhead(num(playhead, 'playhead'), clientId));
      }
      case 'POST /seek': {
        const { t, clientId } = await body<{ t?: number; clientId?: string }>(request);
        return json(response, 200, project.setPlayhead(num(t, 't'), clientId, true));
      }
      case 'GET /still': {
        const kind = url.searchParams.get('kind') === 'output' ? 'output' : 'raw';
        const png = await project.still({ kind, t: num(url.searchParams.get('t') ?? 0, 't') });
        response.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' }); response.end(png); return;
      }
      case 'POST /sheet': {
        const spec = await body<{ times?: number[]; transition?: { start: number; end: number; step?: number }; kind?: 'raw' | 'output' }>(request);
        const { project: p, scene: s } = project.current();
        const fps = p.render.fps, frames = Math.max(1, Math.ceil(s.meta.duration * fps - 1e-9));
        let times = spec.times?.map(t => num(t, 'time')) ?? p.review.times;
        if (spec.transition) {
          const step = num(spec.transition.step ?? 1 / fps, 'step'), start = num(spec.transition.start, 'start'), end = num(spec.transition.end, 'end');
          if (step <= 0 || end < start) throw new ApiError(400, 'INVALID', 'Invalid transition range');
          times = []; for (let t = start; t <= end + 1e-9 && times.length < 48; t += step) times.push(Number(t.toFixed(6)));
        }
        if (!times.length || times.length > 48) throw new ApiError(400, 'INVALID', 'Give 1–48 times');
        const kind = spec.kind === 'output' ? 'output' : 'raw';
        const cells: Cell[] = times.map(t => { const c = Math.min(Math.max(0, t), s.meta.duration); const k = Math.min(frames - 1, Math.floor(c * fps + 1e-9)); return kind === 'raw' ? { kind, t: c, label: `t=${c.toFixed(3)}s` } : { kind, k, label: `frame ${k}, ${(k / fps).toFixed(3)}s` }; });
        const png = await project.still({ kind: 'raw', t: 0 }, { title: [`${p.name}, version ${s.version}, ${kind === 'raw' ? 'raw' : 'final'} frames`], cells, columns: Math.min(times.length, spec.transition ? 6 : 4), cellWidth: spec.transition ? 280 : 400 });
        response.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' }); response.end(png); return;
      }
      case 'POST /render': {
        const spec = await body<ExportRequest>(request);
        return json(response, 202, project.startRender(spec));
      }
      case 'POST /render/cancel': {
        const { id } = await body<{ id?: string }>(request);
        if (id !== undefined && typeof id !== 'string') throw new ApiError(400, 'INVALID', 'Expected { id?: string }');
        return json(response, 202, project.cancelRender(id));
      }
      case 'POST /review': return json(response, 200, await project.review());
      case 'POST /shutdown': json(response, 200, { ok: true }); setTimeout(() => { void close(); }, 50); return;
    }
    throw new ApiError(404, 'NOT_FOUND', `Unknown endpoint: ${route}`);
  };

  const server: Server = createServer((request, response) => {
    handle(request, response).catch(error => {
      if (response.headersSent) { response.destroy(); return; }
      const status = error instanceof ApiError ? error.status : 500;
      json(response, status, { error: { code: error instanceof ApiError ? error.code : 'INTERNAL', message: error instanceof Error ? error.message : String(error), ...(error instanceof ApiError ? error.details : {}) } });
    });
  });
  server.on('upgrade', (request, socket, head) => {
    if (new URL(request.url ?? '/', 'http://localhost').pathname !== '/__mografy/events' || !allowed(request)) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    sockets.handleUpgrade(request, socket, head, ws => sockets.emit('connection', ws, request));
  });
  const heartbeat = setInterval(() => { for (const s of sockets.clients) s.ping(); }, 20000); heartbeat.unref();

  const first = options.port ?? 4173;
  let port = first;
  for (;; port++) {
    const ok = await new Promise<boolean>((done, fail) => {
      const onError = (error: NodeJS.ErrnoException) => { server.off('listening', onListen); if (error.code === 'EADDRINUSE' && port < first + 30 && options.port === undefined) done(false); else fail(error); };
      const onListen = () => { server.off('error', onError); done(true); };
      server.once('error', onError); server.once('listening', onListen);
      server.listen(port, '127.0.0.1');
    });
    if (ok) break;
  }
  const address = server.address();
  url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : port}/`;
  project.url = url;
  await lock.write(url);
  project.watch();
  await rememberProject(project.dir);
  await writeActive({ pid: process.pid, url, token, project: project.dir }).catch(() => {});

  let closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    clearInterval(heartbeat);
    for (const s of sockets.clients) s.terminate();
    await new Promise<void>(done => server.close(() => done()));
    server.closeAllConnections();
    await switching.catch(() => {});
    await project.close();
    await lock.release();
    await clearActive(token);
  })();
  return { url, get project() { return project; }, switchProject, close };
}
