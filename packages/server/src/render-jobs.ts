// Export lifecycle; Project supplies the only persistent write operation.
import { createReadStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { exportRequestSchema, outputFrameCount, validateExportFrameRate, validateSceneProject } from '@mografy/core';
import type { ExportRequest, RenderStatus, SceneInfo, SceneProject } from '@mografy/core';
import { renderAnimation, renderVideo, slug, validateAnimationSize } from '@mografy/render';
import type { SceneBuild, SceneHost } from '@mografy/render';
import { ApiError, describe } from './errors.js';

const now = () => new Date().toISOString();
interface RenderSource { project: SceneProject; scene: SceneInfo; build: SceneBuild }
type WriteOutput = (file: string, data: Buffer | AsyncIterable<Uint8Array>, signal: AbortSignal) => Promise<void>;

export class RenderJobs {
  status: RenderStatus | null = null;
  private task: Promise<void> | undefined;
  private controller: AbortController | undefined;
  private closed = false;
  constructor(private dir: string, private host: SceneHost, private write: WriteOutput, private publish: () => void) {}

  start(input: ExportRequest | string, { project, scene, build }: RenderSource) {
    if (this.closed) throw new ApiError(503, 'CLOSED', 'Server is closing');
    if (this.status?.state === 'running') throw new ApiError(409, 'BUSY', 'A render is already running');

    let request, snapshot: SceneProject;
    try {
      request = exportRequestSchema.parse(typeof input === 'string' ? { output: input } : input);
      snapshot = validateSceneProject({ ...structuredClone(project), render: { ...project.render, ...request.render } });
      validateExportFrameRate(request.format, snapshot.render.fps);
    } catch (error) { throw new ApiError(400, 'INVALID_EXPORT', describe(error)); }
    const { format } = request, settings = snapshot.render;
    const width = request.size?.width ?? Math.round(scene.meta.width * settings.scale), height = request.size?.height ?? Math.round(scene.meta.height * settings.scale);
    const total = outputFrameCount(scene.meta.duration, settings.fps);
    if (format === 'mp4' && (width % 2 || height % 2)) throw new ApiError(400, 'INVALID_EXPORT', 'MP4 needs even pixel dimensions. Adjust the resolution.');
    if (format !== 'mp4') {
      try { validateAnimationSize(width, height, total); } catch (error) { throw new ApiError(400, 'INVALID_EXPORT', describe(error)); }
    }
    const ext = format === 'lottie' ? '.lottie.json' : `.${format}`;
    const orientation = format === 'mp4' && height > width ? '-portrait' : '';
    const file = resolve(this.dir, request.output ?? join('renders', `${slug(project.name)}${orientation}${ext}`));
    const local = relative(this.dir, file);
    if (local.split(/[\\/]/)[0] !== 'renders' || !file.endsWith(format === 'lottie' ? '.json' : ext)) throw new ApiError(400, 'INVALID_PATH', `Output must be a ${format === 'lottie' ? '.json' : ext} file inside renders/`);
    const status: RenderStatus = { id: Math.random().toString(36).slice(2, 10), format, state: 'running', stage: 'capture', done: 0, total, version: scene.version, output: file, startedAt: now() };
    this.status = status;
    const controller = new AbortController(); this.controller = controller;
    let last = 0;
    this.publish();
    const onProgress = (done: number, total: number, stage: 'capture' | 'encode' | 'package') => {
      Object.assign(status, { done, total, stage });
      if (!this.closed && (Date.now() - last > 250 || done === total)) { last = Date.now(); this.publish(); }
    };
    this.task = (async () => {
      if (format === 'mp4') {
        const temp = await mkdtemp(join(tmpdir(), 'mografy-export-'));
        try {
          const result = await renderVideo({ projectDir: this.dir, project: snapshot, build, output: join(temp, 'output.mp4'), host: this.host, size: request.size, signal: controller.signal, onProgress });
          if (controller.signal.aborted) throw new Error('Render cancelled');
          await this.write(file, createReadStream(result.output), controller.signal);
        } finally { await rm(temp, { recursive: true, force: true }); }
      } else {
        const result = await renderAnimation({ project: snapshot, build, host: this.host, format, size: request.size, signal: controller.signal, onProgress });
        if (controller.signal.aborted) throw new Error('Render cancelled');
        await this.write(file, result.data, controller.signal);
      }
    })().then(() => { Object.assign(status, { state: 'done', stage: 'done', finishedAt: now() }); })
      .catch(error => { Object.assign(status, controller.signal.aborted
        ? { state: 'cancelled', stage: 'done', cancelling: false, finishedAt: now() }
        : { state: 'failed', error: describe(error), finishedAt: now() }); })
      .finally(() => { if (!this.closed) this.publish(); });
    return status;
  }

  cancel(id?: string) {
    const status = this.status;
    if (!status || status.state !== 'running') throw new ApiError(409, 'NO_RENDER', 'No export is running');
    if (id && status.id !== id) throw new ApiError(409, 'RENDER_CHANGED', 'That export is no longer running');
    if (!status.cancelling) {
      status.cancelling = true;
      this.controller?.abort();
      this.publish();
    }
    return status;
  }

  async close() {
    this.closed = true;
    this.controller?.abort();
    await this.task;
  }
}
