// Project state: the only writer of mografy.json and scene sources.
// Every change goes compile → Chromium trial render → publish, in one queue.
import { EventEmitter } from 'node:events';
import { mkdir, readFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { outputFrameCount, projectPatchSchema, reconcileParams, resolveParams, sceneRuntimeKey, validateSceneProject } from '@mografy/core';
import type { ExportRequest, ParameterIssue, ParameterValues, ProjectPatch, SceneError, SceneInfo, SceneProject, Snapshot, ServerEvent } from '@mografy/core';
import { buildScene, renderReview, SceneHost } from '@mografy/render';
import type { Cell, SceneBuild } from '@mografy/render';
import { atomicWrite, readJson, saveAsset, sha256, sourcePath } from './files.js';

import { ProjectWatcher } from './project-watcher.js';
import { ProjectFrames } from './project-frames.js';
import { RenderJobs } from './render-jobs.js';
import { ApiError, describe } from './errors.js';
export { ApiError } from './errors.js';
const now = () => new Date().toISOString();

// Scaffolding and live updates share the same writer for each project directory.
const writers = new Map<string, Promise<unknown>>();
export async function queueProjectWrite<T>(dir: string, task: () => Promise<T>): Promise<T> {
  const key = await realpath(resolve(dir)).catch(() => resolve(dir));
  const next = (writers.get(key) ?? Promise.resolve()).then(task);
  const tail = next.catch(() => {});
  writers.set(key, tail);
  void tail.then(() => { if (writers.get(key) === tail) writers.delete(key); });
  return next;
}

export class Project extends EventEmitter<{ event: [ServerEvent] }> {
  readonly manifestFile: string;
  private queue: Promise<unknown> = Promise.resolve();
  private sequence = 0;
  private raw = '';
  private project: SceneProject | null = null;
  private scene: SceneInfo | null = null;
  private preparedKey = '';
  private error: SceneError | null = null;
  private issues: ParameterIssue[] = [];
  private state = { playhead: 0 };
  private builds = new Map<string, SceneBuild>();
  private stateTimer: ReturnType<typeof setTimeout> | undefined;
  private thumbnail: string | null = null;
  private closed = false;
  private readonly watcher: ProjectWatcher;
  private readonly frames: ProjectFrames;
  private readonly jobs: RenderJobs;
  url = '';

  private constructor(readonly dir: string, readonly host: SceneHost) {
    super();
    this.manifestFile = join(dir, 'mografy.json');
    this.watcher = new ProjectWatcher(dir, () => this.rebuild('watch'));
    this.frames = new ProjectFrames(host, () => this.current());
    this.jobs = new RenderJobs(dir, host, (file, data, signal) => this.run(async () => {
      signal.throwIfAborted();
      await atomicWrite(file, data);
    }), () => { if (!this.closed) this.publish('render'); });
  }

  static async open(projectDir: string) {
    const dir = await realpath(resolve(projectDir));
    await mkdir(join(dir, '.mografy', 'builds'), { recursive: true });
    const project = new Project(dir, await SceneHost.start(dir));
    const saved = await readJson<{ playhead?: unknown }>(join(dir, '.mografy', 'state.json'));
    if (typeof saved?.playhead === 'number' && Number.isFinite(saved.playhead)) project.state.playhead = Math.max(0, saved.playhead);
    await project.rebuild('startup');
    return project;
  }

  watch() { this.watcher.start(); }

  private run<T>(task: () => Promise<T>): Promise<T> {
    if (this.closed) return Promise.reject(new ApiError(503, 'CLOSED', 'Server is closing'));
    const next = this.queue.then(() => queueProjectWrite(this.dir, task));
    this.queue = next.catch(() => {});
    return next;
  }

  snapshot(): Snapshot {
    return structuredClone({
      sequence: this.sequence, url: this.url, projectDir: this.dir, revision: sha256(this.raw),
      project: this.project, scene: this.scene, error: this.error, issues: this.issues,
      state: this.state, render: this.jobs.status, thumbnail: this.thumbnail,
    });
  }
  private publish(reason: string, clientId?: string) {
    if (this.scene && (reason === 'scene' || reason === 'project')) this.scheduleThumb();
    this.sequence++;
    this.emit('event', { type: 'snapshot', reason, clientId, snapshot: this.snapshot() });
  }
  build(version: string) { return this.builds.get(version); }
  current() {
    if (!this.project || !this.scene) throw new ApiError(409, 'NO_SCENE', this.error?.message ?? 'No working scene yet');
    return { project: this.project, scene: this.scene, build: this.builds.get(this.scene.version)! };
  }

  private async readManifest() {
    const raw = await readFile(this.manifestFile, 'utf8');
    let project: SceneProject;
    try { project = validateSceneProject(JSON.parse(raw)); }
    catch (error) { throw new Error(`mografy.json is invalid:\n${describe(error)}`); }
    return { raw, project };
  }
  private async writeManifest(project: SceneProject) {
    const raw = JSON.stringify(project, null, 2) + '\n';
    await atomicWrite(this.manifestFile, raw);
    this.raw = raw; this.project = project;
  }

  /** Compile and trial-render in Chromium. Nothing is published or written here. */
  private async prepare(project: SceneProject, overrides?: Record<string, string>) {
    const build = await buildScene(this.dir, project, overrides);
    const key = sceneRuntimeKey(build.version, project);
    const known = this.preparedKey === key ? this.scene : undefined;
    const loaded = known ? { meta: known.meta, params: known.params } : await this.host.inspect(build, project);
    return { build, meta: loaded.meta, params: loaded.params, key };
  }

  /** Make a prepared build current: keep compatible saved values, persist the build, publish. */
  private async commit(project: SceneProject, prepared: Awaited<ReturnType<Project['prepare']>>, reason: SceneInfo['reason']) {
    const { build, meta, params } = prepared;
    const { values, issues } = reconcileParams(params, project.params);
    if (issues.length) await this.writeManifest({ ...project, params: values });
    this.builds.set(build.version, build);
    for (const key of [...this.builds.keys()].slice(0, -8)) this.builds.delete(key);
    await atomicWrite(join(this.dir, '.mografy', 'builds', `${build.version}.js`), build.code).catch(() => {});
    const changed = this.scene?.version !== build.version || this.scene.meta.width !== meta.width || this.scene.meta.height !== meta.height;
    if (changed) this.scene = { version: build.version, meta, params, sources: build.sources, publishedAt: now(), reason };
    this.project = issues.length ? { ...project, params: values } : project;
    this.preparedKey = prepared.key;
    this.state.playhead = Math.min(this.state.playhead, meta.duration);
    this.issues = issues.length ? issues : changed ? [] : this.issues;
    this.error = null;
    return { changed, issues };
  }

  /** Rebuild from disk (startup and file changes). Failures keep the last good version. */
  rebuild(reason: 'startup' | 'watch') {
    return this.run(async () => {
      try {
        const { raw, project } = await this.readManifest();
        const manifestChanged = raw !== this.raw;
        this.raw = raw;
        if (!this.scene) this.project = project;
        const prepared = await this.prepare(project);
        const hadError = !!this.error;
        const { changed } = await this.commit(project, prepared, reason);
        if (changed || manifestChanged || hadError || reason === 'startup') this.publish(changed ? 'scene' : 'project');
      } catch (error) {
        const message = describe(error);
        if (this.error?.message !== message || reason === 'startup') { this.error = { message, reason, at: now() }; this.publish('error'); }
        if (reason === 'startup') return;
        throw error;
      }
    });
  }

  /** Submitted sources are compiled and trial-rendered first; only then written to disk. */
  updateSource(files: Record<string, string>) {
    return this.run(async () => {
      const entries = Object.entries(files);
      if (!entries.length) throw new ApiError(400, 'EMPTY', 'No files submitted');
      const paths = entries.map(([path, text]) => {
        if (typeof text !== 'string' || text.length > 1_000_000) throw new ApiError(400, 'INVALID', `Invalid content for ${path}`);
        try { return sourcePath(this.dir, path); } catch (error) { throw new ApiError(400, 'INVALID_PATH', describe(error)); }
      });
      const { raw, project } = await this.readManifest().catch(error => { throw new ApiError(422, 'MANIFEST', describe(error)); });
      this.raw = raw;
      let prepared;
      try { prepared = await this.prepare(project, files); }
      catch (error) { throw new ApiError(422, 'SCENE_ERROR', describe(error)); }
      for (const [i, [, text]] of entries.entries()) await atomicWrite(paths[i]!, text);
      const { changed, issues } = await this.commit(project, prepared, 'update');
      this.publish(changed ? 'scene' : 'project');
      return { version: this.scene!.version, changed, issues };
    });
  }

  async readSource() {
    const entry = this.project?.scene ?? 'scenes/main.ts';
    const paths = this.scene?.sources.length ? this.scene.sources : [entry];
    const files: Record<string, string> = {};
    for (const path of paths) files[path] = await readFile(join(this.dir, path), 'utf8').catch(() => '');
    return { entry, files };
  }

  patchProject(input: ProjectPatch, expected?: string, clientId?: string) {
    return this.run(async () => {
      let patch: ProjectPatch;
      try { patch = projectPatchSchema.parse(input); }
      catch (error) { throw new ApiError(422, 'VALIDATION', describe(error)); }
      const { raw, project } = await this.readManifest().catch(error => { throw new ApiError(422, 'MANIFEST', describe(error)); });
      this.raw = raw;
      if (expected && expected !== sha256(raw)) throw new ApiError(409, 'REVISION_CONFLICT', 'mografy.json changed since you last read it. Reload and try again.');
      const next: Record<string, unknown> = structuredClone(project);
      if (patch.params) {
        if (!this.scene) throw new ApiError(409, 'NO_SCENE', 'Parameters can be set once the scene has loaded');
        const values: ParameterValues = { ...project.params };
        for (const [id, value] of Object.entries(patch.params)) { if (value === null) delete values[id]; else values[id] = value; }
        try { resolveParams(this.scene.params, values); } catch (error) { throw new ApiError(422, 'INVALID_PARAM', describe(error)); }
        next.params = values;
      }
      if (patch.name !== undefined) next.name = patch.name;
      if (patch.seed !== undefined) next.seed = patch.seed;
      if (patch.aspectRatio !== undefined) { if (patch.aspectRatio === null) delete next.aspectRatio; else next.aspectRatio = patch.aspectRatio; }
      if (patch.audio !== undefined) { if (patch.audio === null) delete next.audio; else next.audio = patch.audio; }
      if (patch.render) next.render = { ...project.render, ...patch.render };
      if (patch.review) next.review = { ...project.review, ...patch.review };
      let validated: SceneProject;
      try { validated = validateSceneProject(next); } catch (error) { throw new ApiError(422, 'VALIDATION', describe(error)); }
      // Seed, canvas and the audio grid change the runtime even when compiled code is unchanged.
      const needsTrial = patch.aspectRatio !== undefined || patch.seed !== undefined || patch.audio !== undefined
        || (this.scene !== null && sceneRuntimeKey(this.scene.version, validated) !== this.preparedKey);
      const prepared = needsTrial ? await this.prepare(validated).catch(error => {
        throw new ApiError(422, patch.aspectRatio !== undefined ? 'CANVAS' : 'SCENE_ERROR', describe(error));
      }) : undefined;
      await this.writeManifest(validated);
      if (prepared) await this.commit(validated, prepared, 'update');
      this.publish('project', clientId);
      return this.snapshot();
    });
  }

  /** Filename allocation and the write form one serialized project operation. */
  saveAsset(name: string, data: Buffer) {
    return this.run(() => saveAsset(this.dir, name, data));
  }

  setPlayhead(t: number, clientId?: string, seek = false) {
    if (this.closed) throw new ApiError(503, 'CLOSED', 'Server is closing');
    if (!Number.isFinite(t) || t < 0) throw new ApiError(400, 'INVALID', 'Invalid time');
    this.state.playhead = Math.min(t, this.scene?.meta.duration ?? t);
    clearTimeout(this.stateTimer);
    this.stateTimer = setTimeout(() => { void this.run(() => atomicWrite(join(this.dir, '.mografy', 'state.json'), JSON.stringify(this.state) + '\n')).catch(() => {}); }, 300);
    if (seek) { this.sequence++; this.emit('event', { type: 'seek', t: this.state.playhead, clientId }); }
    return this.state;
  }

  /** PNG of the current version, raw at time t or as the output frame containing t. */
  still(cell: { kind: 'raw'; t: number } | { kind: 'output'; t: number }, sheet?: { title: string[]; cells: Cell[]; columns: number; cellWidth: number }) {
    return this.frames.withPage((page, project, scene) => {
      const settings = project.render;
      if (sheet) return page.sheet({ ...sheet, settings });
      const t = Math.min(Math.max(0, cell.t), scene.meta.duration);
      const frames = outputFrameCount(scene.meta.duration, settings.fps);
      return page.png(cell.kind === 'raw' ? { kind: 'raw', t, label: '' } : { kind: 'output', k: Math.min(frames - 1, Math.floor(t * settings.fps + 1e-9)), label: '' }, settings);
    });
  }

  private scheduleThumb() { this.frames.scheduleThumbnail(() => this.refreshThumbnail()); }

  /** Capture then queue the write; discard a capture superseded by a source/parameter update. */
  async refreshThumbnail(time?: number) {
    this.frames.cancelThumbnail();
    const { png, revision, version } = await this.frames.withPage(async (page, _project, scene) => {
      const revision = sha256(this.raw), version = scene.version;
      return { png: await page.thumb(Math.max(0, Math.min(time ?? scene.meta.duration * .45, scene.meta.duration)), 480), revision, version };
    });
    return this.run(async () => {
      if (this.scene?.version !== version || sha256(this.raw) !== revision) return;
      await atomicWrite(join(this.dir, '.mografy', 'thumb.png'), png);
      this.thumbnail = sha256(png);
      this.publish('thumbnail');
      return this.thumbnail;
    });
  }

  startRender(input: ExportRequest | string = {}) { return this.jobs.start(input, this.current()); }
  cancelRender(id?: string) { return this.jobs.cancel(id); }

  review(video?: string) {
    const { project, build } = this.current();
    const comparisonVideo = video ?? (this.jobs.status?.state === 'done' && this.jobs.status.format === 'mp4' && this.jobs.status.version === build.version ? this.jobs.status.output : undefined);
    return this.run(() => renderReview({
      projectDir: this.dir,
      project: structuredClone(project),
      build,
      host: this.host,
      write: atomicWrite,
      ...(comparisonVideo ? { video: comparisonVideo } : {}),
    }));
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    this.watcher.close();
    this.frames.cancelThumbnail();
    clearTimeout(this.stateTimer);
    await this.jobs.close();
    await this.queue;
    if (this.stateTimer) await queueProjectWrite(this.dir, () => atomicWrite(join(this.dir, '.mografy', 'state.json'), JSON.stringify(this.state) + '\n')).catch(() => {});
    await this.frames.close();
    await this.host.close();
    this.removeAllListeners();
  }
}
