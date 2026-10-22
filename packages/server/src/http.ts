// HTTP/WebSocket transport; project lifecycle and request handling are separate modules.
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
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

export interface StartOptions {
  port?: number; quiet?: boolean;
  /** Serve the player from source with Vite hot reload when Vite is installed (default). false serves dist/. */
  hmr?: boolean;
}
interface PlayerDevServer { handle(request: IncomingMessage, response: ServerResponse): Promise<boolean>; ownsUpgrade(request: IncomingMessage): boolean; close(): Promise<void> }
/** Vite is a development dependency of the player: present in a checkout after pnpm install, absent otherwise. */
async function playerDevServer(server: Server): Promise<PlayerDevServer | null> {
  try {
    const { createPlayerDevServer } = await import('@mografy/web/dev-server' as string) as { createPlayerDevServer(server: Server): Promise<PlayerDevServer> };
    return await createPlayerDevServer(server);
  } catch { return null; }
}
export interface RunningServer {
  url: string;
  /** The player is served from source with Vite hot reload. */
  hmr: boolean;
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
  let stopping = false, player: PlayerDevServer | null = null;

  const handle = async (request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const path = url.pathname, method = request.method ?? 'GET';
    if (!allowed(request)) throw new ApiError(403, 'ORIGIN', 'Only same-origin localhost requests are accepted');
    if (stopping) throw new ApiError(503, 'CLOSED', 'Server is closing');
    if (!path.startsWith('/__mografy/')) {
      if (method !== 'GET' && method !== 'HEAD') throw new ApiError(405, 'METHOD', 'Method not allowed');
      if (player && await player.handle(request, response)) return;
      const root = webDist(), file = normalize(join(root, path === '/' ? 'index.html' : decodeURIComponent(path)));
      if (!file.startsWith(root + sep)) throw new ApiError(404, 'NOT_FOUND', 'Not found');
      // Page routes without an extension get the player; a missing file is a 404, never HTML labelled as its type.
      const page = !extname(file) || file === join(root, 'index.html');
      const data = await readFile(page ? join(root, 'index.html') : file).catch(() => { throw new ApiError(404, 'NOT_FOUND', 'Not found'); });
      response.writeHead(200, { 'content-type': page ? MIME['.html']! : MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
      response.end(method === 'HEAD' ? undefined : data); return;
    }
    const route = `${method} ${path.replace(/^\/__mografy/, '')}`;
    if (route === 'POST /shutdown') {
      if (url.searchParams.get('onlyIfIdle') === '1' && session.project.snapshot().render?.state === 'running') throw new ApiError(409, 'EXPORT_RUNNING', 'Wait for the export to finish before updating.');
      stopping = true;
      response.once('finish', () => { void close(); });
      json(response, 200, { ok: true }); return;
    }
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
    // Vite answers its own HMR socket, but only for the same-origin localhost player.
    if (player?.ownsUpgrade(request)) { if (!allowed(request)) socket.destroy(); return; }
    if (new URL(request.url ?? '/', 'http://localhost').pathname !== '/__mografy/events' || !allowed(request)) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    sockets.handleUpgrade(request, socket, head, ws => sockets.emit('connection', ws, request));
  });
  let heartbeat: ReturnType<typeof setInterval> | undefined, closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    clearInterval(heartbeat);
    for (const socket of sockets.clients) socket.terminate();
    const stopped = new Promise<void>(done => server.close(() => done()));
    server.closeAllConnections();
    try { await Promise.all([session.close(), player?.close()]); } finally { await stopped; sockets.close(); }
  })();
  try {
    if (options.hmr !== false && process.env.MOGRAFY_HMR !== '0') player = await playerDevServer(server);
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
    return { url, hmr: player !== null, get project() { return session.project; }, switchProject: dir => session.switchProject(dir), close };
  } catch (error) { await close(); throw error; }
}
