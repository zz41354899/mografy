// `mografy dev` in a source checkout: serve the player from src/ through Vite, so edits to the player
// hot-reload in the open browser (HMR). When Vite is not installed, the server serves dist/ instead.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export async function createPlayerDevServer(httpServer) {
  const { createServer } = await import('vite');
  // Plugins and the rest live in vite.config.ts; only the parts tied to this server are set here.
  const vite = await createServer({
    root, configFile: fileURLToPath(new URL('vite.config.ts', import.meta.url)),
    server: { middlewareMode: true, hmr: { server: httpServer } },
  });
  // The built page loads dist/app.js and app.css; from source, main.tsx imports its own styles.
  const template = (await readFile(new URL('index.html', import.meta.url), 'utf8'))
    .replace(/\s*<link rel="stylesheet" href="\.\/app\.css" \/>/, '')
    .replace('src="./app.js"', 'src="/src/main.tsx"');
  return {
    /** Answer a player request; false when Vite has nothing at that path. */
    async handle(request, response) {
      const path = new URL(request.url ?? '/', 'http://localhost').pathname;
      if (!path.startsWith('/@') && !/\.\w+$/.test(path)) {
        const html = await vite.transformIndexHtml(path, template);
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
        response.end(request.method === 'HEAD' ? undefined : html);
        return true;
      }
      return new Promise((done, fail) => vite.middlewares(request, response, error => error ? fail(error) : done(false)));
    },
    /** Vite's HMR socket shares the player's port. */
    ownsUpgrade: request => /^vite/.test(String(request.headers['sec-websocket-protocol'] ?? '')),
    close: () => vite.close(),
  };
}
