// Batch export from the player: projects export one after another in the background, each in its own headless Project
// (switching the player to another project never stops them), sharing one Chromium for the whole queue.
import { EventEmitter } from 'node:events';
import { readFile, realpath } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { EXPORT_MAX_FPS, EXPORT_SIZES, isVideoFormat, queueRequestSchema, SVGA_FRAME_RATES, validateSceneProject } from '@mografy/core';
import type { ExportFormat, ExportQueueStatus, ExportRequest, QueueJob, QueueRequest, RenderStatus, SceneProject } from '@mografy/core';
import { SharedBrowsers } from '@mografy/render';
import { ApiError, describe } from './errors.js';
import { Project } from './project.js';
import { isProject } from './project-scaffold.js';

const now = () => new Date().toISOString();
type Request = ReturnType<typeof queueRequestSchema.parse>['request'];
interface Entry { job: QueueJob; request: Request }

/**
 * One batch request made fit for one film: a size from its own aspect ratio (so landscape and portrait films share a
 * batch), and a frame rate the format accepts when the film's own rate is higher (60 fps films as Lottie or SVGA).
 */
export function jobRequest(request: Request, meta: { width: number; height: number }, render: SceneProject['render']): ExportRequest {
  const { shortSide, ...rest } = request;
  const out: ExportRequest = { ...rest, render: { ...rest.render } };
  const portrait = meta.height > meta.width;
  if (!out.size && isVideoFormat(request.format) && shortSide) {
    const scale = shortSide / Math.min(meta.width, meta.height), even = (v: number) => Math.max(2, Math.round(v * scale / 2) * 2);
    out.size = { width: even(meta.width), height: even(meta.height), fit: 'contain' };
  }
  if (!out.size && !isVideoFormat(request.format)) {
    const sizes = EXPORT_SIZES[request.format], square = meta.width === meta.height;
    const size = request.format === 'svga' ? sizes[portrait ? 1 : 0]! : sizes[square || portrait ? 0 : 1]!;
    out.size = { width: size.width, height: size.height, fit: 'contain' };
  }
  const fps = out.render!.fps ?? render.fps;
  if (fps > EXPORT_MAX_FPS[request.format as ExportFormat] || (request.format === 'svga' && !SVGA_FRAME_RATES.some(r => r === fps)))
    out.render!.fps = request.format === 'svga' ? [...SVGA_FRAME_RATES].reverse().find(r => r <= fps) ?? 20 : EXPORT_MAX_FPS[request.format];
  return out;
}

async function projectName(dir: string) {
  try { return validateSceneProject(JSON.parse(await readFile(join(dir, 'mografy.json'), 'utf8'))).name; }
  catch { return basename(dir); }
}

export class ExportQueue extends EventEmitter<{ change: [ExportQueueStatus] }> {
  private entries: Entry[] = [];
  private running: { entry: Entry; project?: Project; renderId?: string; cancelled: boolean } | undefined;
  private loop: Promise<void> | undefined;
  private browsers = new SharedBrowsers();
  private closed = false;
  private last = 0;

  status(): ExportQueueStatus { return { jobs: this.entries.map(e => ({ ...e.job })) }; }
  get busy() { return this.entries.some(e => e.job.state === 'queued' || e.job.state === 'running'); }

  private publish(force = true) {
    if (this.closed) return;
    if (!force && Date.now() - this.last < 250) return;
    this.last = Date.now();
    this.emit('change', this.status());
  }

  async add(input: QueueRequest) {
    if (this.closed) throw new ApiError(503, 'CLOSED', 'Server is closing');
    let parsed;
    try { parsed = queueRequestSchema.parse(input); } catch (error) { throw new ApiError(400, 'INVALID_EXPORT', describe(error)); }
    const added: QueueJob[] = [];
    for (const raw of parsed.dirs) {
      const dir = await realpath(resolve(raw)).catch(() => { throw new ApiError(404, 'NOT_FOUND', `Folder not found: ${raw}`); });
      if (!await isProject(dir)) throw new ApiError(404, 'NOT_A_PROJECT', `${dir} has no mografy.json`);
      // The same project twice in a row would only overwrite its own file.
      if (this.entries.some(e => e.job.dir === dir && e.job.state === 'queued')) continue;
      const job: QueueJob = { id: Math.random().toString(36).slice(2, 10), dir, name: await projectName(dir), state: 'queued', format: parsed.request.format, done: 0, total: 0 };
      this.entries.push({ job, request: parsed.request });
      added.push(job);
    }
    this.publish();
    this.loop ??= this.drain().finally(() => { this.loop = undefined; });
    return { added, queue: this.status() };
  }

  /** Cancel one job (queued: removed from the run; running: stopped), or with no id the running job and every queued one. */
  cancel(id?: string) {
    const targets = this.entries.filter(e => (id ? e.job.id === id : true) && (e.job.state === 'queued' || e.job.state === 'running'));
    if (id && !targets.length) throw new ApiError(409, 'NOT_QUEUED', 'That export is not waiting or running');
    for (const entry of targets) {
      if (entry.job.state === 'queued') Object.assign(entry.job, { state: 'cancelled', finishedAt: now() });
      else if (this.running?.entry === entry && !this.running.cancelled) {
        this.running.cancelled = true;
        if (this.running.project && this.running.renderId) { try { this.running.project.cancelRender(this.running.renderId); } catch { /* already finished */ } }
      }
    }
    this.publish();
    return this.status();
  }

  /** Forget finished jobs (done, failed, cancelled). */
  clear() {
    this.entries = this.entries.filter(e => e.job.state === 'queued' || e.job.state === 'running');
    this.publish();
    return this.status();
  }

  private async drain() {
    for (;;) {
      const entry = this.entries.find(e => e.job.state === 'queued');
      if (!entry || this.closed) break;
      await this.run(entry);
    }
    // Free Chromium while the queue is idle; the next batch launches it again.
    await this.browsers.close();
  }

  private async run(entry: Entry) {
    const { job } = entry;
    Object.assign(job, { state: 'running', stage: 'capture', startedAt: now() });
    const running: { entry: Entry; project?: Project; renderId?: string; cancelled: boolean } = { entry, cancelled: false };
    this.running = running;
    this.publish();
    let project: Project | undefined;
    try {
      project = await Project.open(job.dir, this.browsers);
      running.project = project;
      if (running.cancelled) throw new Error('Render cancelled');
      const finished = new Promise<RenderStatus>(done => {
        const check = () => {
          const render = project!.snapshot().render;
          if (!render || render.id !== running.renderId) return;
          Object.assign(job, { stage: render.stage, done: render.done, total: render.total, output: render.output });
          if (render.state === 'running') { this.publish(false); return; }
          project!.off('event', check); done(render);
        };
        project!.on('event', check);
        const snap = project!.snapshot();
        if (!snap.scene || !snap.project) throw new Error(snap.error?.message ?? 'The scene did not build');
        const status = project!.startRender(jobRequest(entry.request, snap.scene.meta, snap.project.render));
        running.renderId = status.id;
        Object.assign(job, { total: status.total, output: status.output });
        this.publish();
        check();
      });
      if (running.cancelled) project.cancelRender(running.renderId);
      const result = await finished;
      if (result.state === 'done') Object.assign(job, { state: 'done', stage: 'done', done: result.total });
      else if (result.state === 'cancelled') Object.assign(job, { state: 'cancelled' });
      else Object.assign(job, { state: 'failed', error: result.error ?? 'Export failed' });
    } catch (error) {
      Object.assign(job, running.cancelled ? { state: 'cancelled' } : { state: 'failed', error: describe(error) });
    } finally {
      job.finishedAt = now();
      this.running = undefined;
      await project?.close().catch(() => {});
      this.publish();
    }
  }

  async close() {
    this.closed = true;
    for (const entry of this.entries) if (entry.job.state === 'queued') entry.job.state = 'cancelled';
    if (this.running) { this.running.cancelled = true; try { if (this.running.renderId) this.running.project?.cancelRender(this.running.renderId); } catch { /* finished */ } }
    await this.loop;
    await this.browsers.close();
    this.removeAllListeners();
  }
}
