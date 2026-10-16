import { sceneRuntimeKey } from '@mografy/core';
import type { SceneInfo, SceneProject } from '@mografy/core';
import type { HostPage, SceneBuild, SceneHost } from '@mografy/render';
import { ApiError } from './errors.js';

interface FrameSource { project: SceneProject; scene: SceneInfo; build: SceneBuild }

/** Owns serialized access to a cached Chromium page and thumbnail scheduling. */
export class ProjectFrames {
  private queue: Promise<unknown> = Promise.resolve();
  private cached: { key: string; page: HostPage } | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;

  constructor(private host: SceneHost, private current: () => FrameSource) {}

  withPage<T>(task: (page: HostPage, project: SceneProject, scene: SceneInfo) => Promise<T>): Promise<T> {
    if (this.closed) return Promise.reject(new ApiError(503, 'CLOSED', 'Server is closing'));
    const next = this.queue.then(async () => {
      const { project, scene, build } = this.current();
      const key = JSON.stringify([sceneRuntimeKey(scene.version, project), project.params]);
      if (this.cached?.key !== key) {
        await this.cached?.page.close();
        this.cached = undefined;
        this.cached = { key, page: await this.host.open(build, project, { renderScale: 1 }) };
      }
      return task(this.cached.page, project, scene);
    });
    this.queue = next.catch(() => {});
    return next;
  }

  scheduleThumbnail(capture: () => Promise<unknown>) {
    this.cancelThumbnail();
    if (this.closed) return;
    this.timer = setTimeout(() => { void capture().catch(() => {}); }, 300);
    this.timer.unref();
  }

  cancelThumbnail() { clearTimeout(this.timer); }

  async close() {
    this.closed = true;
    this.cancelThumbnail();
    await this.queue;
    await this.cached?.page.close();
    this.cached = undefined;
  }
}
