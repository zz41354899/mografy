import { open } from 'node:fs/promises';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { newProjectRequestSchema, openProjectRequestSchema } from '@mografy/core';
import { ApiError } from './errors.js';
import { body, json } from './http-io.js';
import { sha256 } from './files.js';
import { createInLibrary } from './workspace.js';
import type { ProjectSession } from './project-session.js';

export async function handleWorkspaceRequest(session: ProjectSession, request: IncomingMessage, response: ServerResponse, url: URL, route: string) {
  switch (route) {
    case 'GET /health': return json(response, 200, { ok: true, pid: process.pid, dir: session.project.dir, token: session.token });
    case 'GET /projects': return json(response, 200, await session.getProjects());
    case 'GET /projects/thumb': {
      const dir = url.searchParams.get('dir') ?? '';
      if (!(await session.getProjects()).projects.some(p => p.dir === dir)) throw new ApiError(404, 'NOT_FOUND', 'Unknown project');
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
      const { dir } = await body(request, openProjectRequestSchema);
      return json(response, 200, await session.switchProject(dir));
    }
    case 'POST /projects/new': {
      const { name, aspectRatio } = await body(request, newProjectRequestSchema);
      return json(response, 200, await session.switchProject(await createInLibrary(name, aspectRatio)));
    }
  }
  throw new ApiError(404, 'NOT_FOUND', `Unknown endpoint: ${route}`);
}
