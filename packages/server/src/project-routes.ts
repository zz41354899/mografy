import { projectPaths } from '@mografy/render/fs-util';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { projectFile } from '@mografy/render';
import { apiPath, PROJECT_HEADER, cancelRenderRequestSchema, exportRequestSchema, playheadRequestSchema, projectPatchEnvelopeSchema, seekRequestSchema, sheetRequestSchema, sourceRequestSchema } from '@mografy/core';
import { ApiError, Project } from './project.js';
import { body, json, num, rawBody, sendFile } from './http-io.js';
import { sheetPlan } from './sheet-plan.js';

export async function handleProjectRequest(project: Project, request: IncomingMessage, response: ServerResponse, url: URL, route: string) {
  const expected = request.headers[PROJECT_HEADER];
  if (expected !== undefined) {
    let dir: string;
    try { dir = decodeURIComponent(String(expected)); } catch { throw new ApiError(400, 'INVALID', 'Invalid project header'); }
    if (dir !== project.dir) throw new ApiError(409, 'PROJECT_CHANGED', 'The player switched projects. Reload and try again.');
  }
  const path = url.pathname;
  const scene = /^GET \/scene\/([\da-f]{16})\.js$/.exec(route);
  if (scene) {
    const build = project.build(scene[1]!) ?? { code: await readFile(join(projectPaths(project.dir).builds, `${scene[1]}.js`), 'utf8').catch(() => { throw new ApiError(404, 'NOT_FOUND', 'Unknown version'); }) };
    response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable' });
    response.end(build.code); return;
  }
  if (route.startsWith('GET /files/') || route.startsWith('HEAD /files/')) {
    const file = await projectFile(project.dir, decodeURIComponent(path.slice(apiPath('files/').length))).catch(error => { throw new ApiError(404, 'NOT_FOUND', String(error.message)); });
    // ?download saves the file under its own name (Unicode names included) instead of opening it.
    if (url.searchParams.has('download')) response.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(basename(file))}`);
    return sendFile(request, response, file);
  }
  switch (route) {
    case 'GET /snapshot': return json(response, 200, project.snapshot());
    case 'POST /assets': {
      // Raw upload into assets/ (music, images, fonts). Returns the project-relative path.
      const name = url.searchParams.get('name') ?? '';
      const path = await project.saveAsset(name, await rawBody(request, 200 * 1024 * 1024)).catch(error => { throw error instanceof ApiError ? error : new ApiError(400, 'INVALID', error instanceof Error ? error.message : String(error)); });
      return json(response, 200, { path });
    }
    case 'GET /source': return json(response, 200, await project.readSource());
    case 'POST /source': {
      const { files } = await body(request, sourceRequestSchema);
      return json(response, 200, await project.updateSource(files));
    }
    case 'PATCH /project': {
      const { patch, revision, clientId } = await body(request, projectPatchEnvelopeSchema);
      return json(response, 200, await project.patchProject(patch, revision, clientId));
    }
    case 'PATCH /state': {
      const { playhead, clientId } = await body(request, playheadRequestSchema);
      return json(response, 200, project.setPlayhead(playhead, clientId));
    }
    case 'POST /seek': {
      const { t, clientId } = await body(request, seekRequestSchema);
      return json(response, 200, project.setPlayhead(t, clientId, true));
    }
    case 'GET /still': {
      const kind = url.searchParams.get('kind') === 'output' ? 'output' : 'raw';
      const png = await project.still({ kind, t: num(url.searchParams.get('t') ?? 0, 't') });
      response.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' }); response.end(png); return;
    }
    case 'POST /sheet': {
      const spec = await body(request, sheetRequestSchema);
      const { project: p, scene: s } = project.current();
      const plan = sheetPlan(spec, p, s);
      const png = await project.still({ kind: 'raw', t: 0 }, plan);
      response.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' }); response.end(png); return;
    }
    case 'POST /render': {
      const spec = await body(request, exportRequestSchema, 'INVALID_EXPORT');
      return json(response, 202, project.startRender(spec));
    }
    case 'POST /render/cancel': {
      const { id } = await body(request, cancelRenderRequestSchema);
      return json(response, 202, project.cancelRender(id));
    }
    case 'POST /review': return json(response, 200, await project.review());
    case 'POST /deck': return json(response, 200, await project.exportDeck());
    case 'POST /check': return json(response, 200, await project.check());
    case 'POST /check/motion': return json(response, 200, await project.motion());
  }
  throw new ApiError(404, 'NOT_FOUND', `Unknown endpoint: ${route}`);
}
