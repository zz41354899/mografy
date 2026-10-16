// HTTP/WebSocket transport; project lifecycle and request handling are separate modules.
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import type { ServerEvent } from '@mografy/core';
import type { Project } from './project.js';
import { ApiError } from './errors.js';
import { allowed, json, MIME } from './http-io.js';
import { ProjectSession } from './project-session.js';
import { handleProjectRequest } from './project-routes.js';
import { handleWorkspaceRequest } from './workspace-routes.js';
import { ensureComponentProjects } from './components.js';

const webDist = () => join(dirname(fileURLToPath(import.meta.resolve('@mografy/web/package.json'))), 'dist');

export interface StartOptions { port?: number; quiet?: boolean }
export interface RunningServer {
  url: string;
  /** The project currently shown (changes when the player switches projects). */
  readonly project: Project;
  switchProject(dir: string): Promise<unknown>;
  close(): Promise<void>;
}

export async function startServer(projectDir: string, options: StartOptions = {}): Promise<RunningServer> {
  await ensureComponentProjects();
  const session = await ProjectSession.open(projectDir);
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  const send = (socket: WebSocket, event: ServerEvent) => { if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 4 << 20) socket.send(JSON.stringify(event)); };
  session.on('event', event => { for (const socket of sockets.clients) send(socket, event); });
  sockets.on('connection', socket => {
    socket.on('error', () => {});
    socket.on('message', () => socket.close(1008, 'Use the HTTP API'));
    send(socket, { type: 'snapshot', reason: 'initial', snapshot: session.project.snapshot() });
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
    if (route === 'POST /shutdown') { json(response, 200, { ok: true }); setTimeout(() => { void close(); }, 50); return; }
    if (path === '/__mografy/health' || path.startsWith('/__mografy/projects')) return handleWorkspaceRequest(session, request, response, url, route);
    return handleProjectRequest(session.project, request, response, url, route);
  };
  const server: Server = createServer((request, response) => {
    handle(request, response).catch(error => {
      if (response.headersSent) { response.destroy(); return; }
      json(response, error instanceof ApiError ? error.status : 500, { error: {
        code: error instanceof ApiError ? error.code : 'INTERNAL', message: error instanceof Error ? error.message : String(error),
        ...(error instanceof ApiError ? error.details : {}),
      } });
    });
  });
  server.on('upgrade', (request, socket, head) => {
    if (new URL(request.url ?? '/', 'http://localhost').pathname !== '/__mografy/events' || !allowed(request)) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    sockets.handleUpgrade(request, socket, head, ws => sockets.emit('connection', ws, request));
  });
  let heartbeat: ReturnType<typeof setInterval> | undefined, closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    clearInterval(heartbeat);
    for (const socket of sockets.clients) socket.terminate();
    const stopped = new Promise<void>(done => server.close(() => done()));
    server.closeAllConnections();
    try { await session.close(); } finally { await stopped; sockets.close(); }
  })();
  try {
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
    const url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : port}/`;
    await session.activate(url);
    heartbeat = setInterval(() => { for (const socket of sockets.clients) socket.ping(); }, 20000); heartbeat.unref();
    return { url, get project() { return session.project; }, switchProject: dir => session.switchProject(dir), close };
  } catch (error) { await close(); throw error; }
}
