import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { callApi } from '@mografy/core';
import type { ExportRequest, RenderStatus } from '@mografy/core';
import type { SharedBrowsers } from '@mografy/render';
import { findServer, Project } from '@mografy/server';

interface ExportConnection {
  start(request: ExportRequest): Promise<RenderStatus>;
  current(): Promise<RenderStatus | null>;
  cancel(id: string): Promise<void>;
  close(): Promise<void>;
}

/** Keeps command progress and cancellation independent of how a project is hosted. */
export async function openExportConnection(dir: string, browsers?: SharedBrowsers): Promise<ExportConnection> {
  const server = await findServer(dir);
  if (server) {
    const identity = await realpath(resolve(dir));
    const post = <T>(path: string, payload: unknown) => callApi<T>(server.url, path, 'POST', payload, identity);
    return {
      start: request => post<RenderStatus>('render', request),
      current: async () => (await callApi<{ render: RenderStatus | null }>(server.url, 'snapshot', 'GET', undefined, identity)).render,
      cancel: async id => { await post('render/cancel', { id }); },
      close: async () => {},
    };
  }
  const project = await Project.open(dir, browsers);
  return {
    start: async request => project.startRender(request),
    current: async () => project.snapshot().render,
    cancel: async id => { project.cancelRender(id); },
    close: () => project.close(),
  };
}
