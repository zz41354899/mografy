import type { ExportRequest, RenderStatus } from '@mografy/core';
import { findServer, Project } from '@mografy/server';
import { responseJson } from './api.js';

interface ExportConnection {
  start(request: ExportRequest): Promise<RenderStatus>;
  current(): Promise<RenderStatus | null>;
  cancel(id: string): Promise<void>;
  close(): Promise<void>;
}

/** Keeps command progress and cancellation independent of how a project is hosted. */
export async function openExportConnection(dir: string): Promise<ExportConnection> {
  const server = await findServer(dir);
  if (server) {
    const post = <T>(path: string, payload: unknown) => fetch(new URL(`/__mografy/${path}`, server.url), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    }).then(responseJson<T>);
    return {
      start: request => post<RenderStatus>('render', request),
      current: async () => (await responseJson<{ render: RenderStatus | null }>(await fetch(new URL('/__mografy/snapshot', server.url)))).render,
      cancel: async id => { await post('render/cancel', { id }); },
      close: async () => {},
    };
  }
  const project = await Project.open(dir);
  return {
    start: async request => project.startRender(request),
    current: async () => project.snapshot().render,
    cancel: async id => { project.cancelRender(id); },
    close: () => project.close(),
  };
}
