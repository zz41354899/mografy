// Project state: the only writer of mografy.json and scene sources.
// Every change goes compile → Chromium trial render → publish, in one queue.
import { EventEmitter } from 'node:events';
import { createReadStream, watch } from 'node:fs';
import type { FSWatcher } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { exportRequestSchema, outputFrameCount, reconcileParams, resolveParams, validateExportFrameRate, validateSceneProject } from '@mografy/core';
import type { ExportRequest, ParameterIssue, ParameterValues, ProjectPatch, RenderStatus, SceneError, SceneInfo, SceneProject, Snapshot, ServerEvent } from '@mografy/core';
import { buildScene, renderAnimation, renderReview, renderVideo, SceneHost, slug, validateAnimationSize } from '@mografy/render';
import type { Cell, HostPage, SceneBuild } from '@mografy/render';
import { atomicWrite, readJson, sha256, sourcePath } from './files.js';

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: Record<string, unknown>) { super(message); }
}
const now = () => new Date().toISOString();
type Issue = { path: PropertyKey[]; message: string };
const describe = (error: unknown) => error instanceof Error && error.name === 'ZodError' && Array.isArray((error as { issues?: unknown }).issues)
  ? ((error as unknown as { issues: Issue[] }).issues).map(i => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`).join('\n')
  : error instanceof Error ? error.message : String(error);
const IGNORED = new Set(['.mografy', 'renders', 'node_modules', '.git']);

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
  private stillQueue: Promise<unknown> = Promise.resolve();
  private sequence = 0;
  private raw = '';
  private project: SceneProject | null = null;
  private scene: SceneInfo | null = null;
  private error: SceneError | null = null;
  private issues: ParameterIssue[] = [];
  private state = { playhead: 0 };
  private renderStatus: RenderStatus | null = null;
  private renderTask: Promise<void> | undefined;
  private renderAbort: AbortController | undefined;
  private builds = new Map<string, SceneBuild>();
  private stillPage: { key: string; page: HostPage } | undefined;
  private watcher: FSWatcher | undefined;
  private poller: ReturnType<typeof setInterval> | undefined;
  private fingerprint = '';
  private debounce: ReturnType<typeof setTimeout> | undefined;
  private stateTimer: ReturnType<typeof setTimeout> | undefined;
  private thumbTimer: ReturnType<typeof setTimeout> | undefined;
  private thumbnail: string | null = null;
  private closed = false;
  url = '';

  private constructor(readonly dir: string, readonly host: SceneHost) {
    super();
    this.manifestFile = join(dir, 'mografy.json');
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

  /** Size + mtime of every project file that can affect a build. */
  private async scan() {
    const parts: string[] = [];
    const walk = async (rel: string): Promise<void> => {
      const entries = await readdir(join(this.dir, rel), { withFileTypes: true }).catch(() => []);
      for (const e of entries) {
        if (e.name.startsWith('.') || (!rel && IGNORED.has(e.name))) continue;
        const path = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) { if (parts.length < 5000) await walk(path); }
        else if (e.isFile()) { const s = await stat(join(this.dir, path)).catch(() => undefined); if (s) parts.push(`${path}:${s.size}:${s.mtimeMs}`); }
      }
    };
    await walk('');
    return parts.sort().join('|');
  }

  /**
   * Watch the project folder; any scene, asset or manifest change rebuilds.
   * fs.watch reacts fast; a 1 s fingerprint poll catches events some platforms drop
   * (for example after a file is replaced by rename).
   */
  watch() {
    const trigger = () => {
      clearTimeout(this.debounce);
      this.debounce = setTimeout(() => { void this.scan().then(f => { this.fingerprint = f; return this.rebuild('watch'); }).catch(() => {}); }, 150);
    };
    try {
      this.watcher = watch(this.dir, { recursive: true }, (_event, name) => {
        const path = String(name ?? '').split('\\').join('/');
        if (!path || IGNORED.has(path.split('/')[0]!) || /(^|\/)\.|~$|\.swp$/.test(path)) return;
        trigger();
      });
      this.watcher.on('error', () => {});
    } catch { /* polling still works */ }
    void this.scan().then(f => { this.fingerprint = f; });
    this.poller = setInterval(() => {
      void this.scan().then(f => { if (f !== this.fingerprint) { this.fingerprint = f; trigger(); } });
    }, 1000);
    this.poller.unref();
  }

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
      state: this.state, render: this.renderStatus, thumbnail: this.thumbnail,
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
    const known = this.scene?.version === build.version ? this.scene : undefined;
    const loaded = known ? { meta: known.meta, params: known.params } : await this.host.inspect(build, project);
    return { build, meta: loaded.meta, params: loaded.params };
  }

  /** Make a prepared build current: keep compatible saved values, persist the build, publish. */
  private async commit(project: SceneProject, prepared: Awaited<ReturnType<Project['prepare']>>, reason: SceneInfo['reason']) {
    const { build, meta, params } = prepared;
    const { values, issues } = reconcileParams(params, project.params);
    if (issues.length) await this.writeManifest({ ...project, params: values });
    this.builds.set(build.version, build);
    for (const key of [...this.builds.keys()].slice(0, -8)) this.builds.delete(key);
    await writeFile(join(this.dir, '.mografy', 'builds', `${build.version}.js`), build.code).catch(() => {});
    const changed = this.scene?.version !== build.version;
    if (changed) this.scene = { version: build.version, meta, params, sources: build.sources, publishedAt: now(), reason };
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
        this.raw = raw; this.project = project;
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
      this.raw = raw; this.project = project;
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

  patchProject(patch: ProjectPatch, expected?: string, clientId?: string) {
    return this.run(async () => {
      const { raw, project } = await this.readManifest().catch(error => { throw new ApiError(422, 'MANIFEST', describe(error)); });
      this.raw = raw; this.project = project;
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
      if (patch.audio !== undefined) { if (patch.audio === null) delete next.audio; else next.audio = patch.audio; }
      if (patch.render) next.render = { ...project.render, ...patch.render };
      if (patch.review) next.review = { ...project.review, ...patch.review };
      let validated: SceneProject;
      try { validated = validateSceneProject(next); } catch (error) { throw new ApiError(422, 'VALIDATION', describe(error)); }
      await this.writeManifest(validated);
      if (patch.audio || patch.seed !== undefined) {
        // Assets and seed feed setup; re-run the trial so a bad audio path surfaces now.
        try { await this.commit(validated, await this.prepare(validated), 'update'); }
        catch (error) { this.error = { message: describe(error), reason: 'watch', at: now() }; }
      }
      this.publish('project', clientId);
      return this.snapshot();
    });
  }

  setPlayhead(t: number, clientId?: string, seek = false) {
    if (!Number.isFinite(t) || t < 0) throw new ApiError(400, 'INVALID', 'Invalid time');
    this.state.playhead = Math.min(t, this.scene?.meta.duration ?? t);
    clearTimeout(this.stateTimer);
    this.stateTimer = setTimeout(() => { void atomicWrite(join(this.dir, '.mografy', 'state.json'), JSON.stringify(this.state) + '\n').catch(() => {}); }, 300);
    if (seek) { this.sequence++; this.emit('event', { type: 'seek', t: this.state.playhead, clientId }); }
    return this.state;
  }

  /** Run `task` with a host page for the current version, seed and params (reused while they stay the same). */
  private withStillPage<T>(task: (page: HostPage, project: SceneProject, scene: SceneInfo) => Promise<T>) {
    const run = async () => {
      const { project, scene, build } = this.current();
      const key = `${scene.version}|${project.seed}|${JSON.stringify(project.params)}`;
      if (this.stillPage?.key !== key) {
        await this.stillPage?.page.close();
        this.stillPage = { key, page: await this.host.open(build, project, { renderScale: 1 }) };
      }
      return task(this.stillPage.page, project, scene);
    };
    const next = this.stillQueue.then(run);
    this.stillQueue = next.catch(() => {});
    return next;
  }

  /** PNG of the current version, raw at time t or as the output frame containing t. */
  still(cell: { kind: 'raw'; t: number } | { kind: 'output'; t: number }, sheet?: { title: string[]; cells: Cell[]; columns: number; cellWidth: number }) {
    return this.withStillPage((page, project, scene) => {
      const settings = project.render;
      if (sheet) return page.sheet({ ...sheet, settings });
      const t = Math.min(Math.max(0, cell.t), scene.meta.duration);
      const frames = Math.max(1, Math.ceil(scene.meta.duration * settings.fps - 1e-9));
      return page.png(cell.kind === 'raw' ? { kind: 'raw', t, label: '' } : { kind: 'output', k: Math.min(frames - 1, Math.floor(t * settings.fps + 1e-9)), label: '' }, settings);
    });
  }

  /** Thumbnail for the project list, refreshed shortly after the picture changes. */
  private scheduleThumb() {
    clearTimeout(this.thumbTimer);
    this.thumbTimer = setTimeout(() => {
      void this.refreshThumbnail().catch(() => {});
    }, 1200);
    this.thumbTimer.unref();
  }

  /** Capture then queue the write; discard a capture superseded by a source/parameter update. */
  async refreshThumbnail(time?: number) {
    const { png, revision, version } = await this.withStillPage(async (page, _project, scene) => {
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

  startRender(input: ExportRequest | string = {}) {
    if (this.renderStatus?.state === 'running') throw new ApiError(409, 'BUSY', 'A render is already running');
    const { project, scene, build } = this.current();
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
    const file = resolve(this.dir, request.output ?? join('renders', `${slug(project.name)}${ext}`));
    const local = relative(this.dir, file);
    if (local.split(/[\\/]/)[0] !== 'renders' || !file.endsWith(format === 'lottie' ? '.json' : ext)) throw new ApiError(400, 'INVALID_PATH', `Output must be a ${format === 'lottie' ? '.json' : ext} file inside renders/`);
    const status: RenderStatus = { id: Math.random().toString(36).slice(2, 10), format, state: 'running', stage: 'capture', done: 0, total, version: scene.version, output: file, startedAt: now() };
    this.renderStatus = status;
    const controller = new AbortController(); this.renderAbort = controller;
    let last = 0;
    this.publish('render');
    const onProgress = (done: number, total: number, stage: 'capture' | 'encode' | 'package') => {
      Object.assign(status, { done, total, stage });
      if (!this.closed && (Date.now() - last > 250 || done === total)) { last = Date.now(); this.publish('render'); }
    };
    this.renderTask = (async () => {
      if (format === 'mp4') {
        const temp = await mkdtemp(join(tmpdir(), 'mografy-export-'));
        try {
          const result = await renderVideo({ projectDir: this.dir, project: snapshot, build, output: join(temp, 'output.mp4'), host: this.host, size: request.size, signal: controller.signal, onProgress });
          if (controller.signal.aborted) throw new Error('Render cancelled');
          await this.run(() => atomicWrite(file, createReadStream(result.output)));
        } finally { await rm(temp, { recursive: true, force: true }); }
      } else {
        const result = await renderAnimation({ project: snapshot, build, host: this.host, format, size: request.size, signal: controller.signal, onProgress });
        if (controller.signal.aborted) throw new Error('Render cancelled');
        await this.run(() => atomicWrite(file, result.data));
      }
    })().then(() => { Object.assign(status, { state: 'done', stage: 'done', finishedAt: now() }); })
      .catch(error => { Object.assign(status, controller.signal.aborted
        ? { state: 'cancelled', stage: 'done', cancelling: false, finishedAt: now() }
        : { state: 'failed', error: describe(error), finishedAt: now() }); })
      .finally(() => { if (!this.closed) this.publish('render'); });
    return status;
  }

  cancelRender(id?: string) {
    const status = this.renderStatus;
    if (!status || status.state !== 'running') throw new ApiError(409, 'NO_RENDER', 'No export is running');
    if (id && status.id !== id) throw new ApiError(409, 'RENDER_CHANGED', 'That export is no longer running');
    if (!status.cancelling) {
      status.cancelling = true;
      this.renderAbort?.abort();
      this.publish('render');
    }
    return status;
  }

  review(video?: string) {
    const { project, build } = this.current();
    const comparisonVideo = video ?? (this.renderStatus?.state === 'done' && this.renderStatus.format === 'mp4' && this.renderStatus.version === build.version ? this.renderStatus.output : undefined);
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
    this.renderAbort?.abort();
    this.watcher?.close(); clearInterval(this.poller); clearTimeout(this.debounce); clearTimeout(this.thumbTimer);
    if (this.stateTimer) { clearTimeout(this.stateTimer); await atomicWrite(join(this.dir, '.mografy', 'state.json'), JSON.stringify(this.state) + '\n').catch(() => {}); }
    await this.queue.catch(() => {});
    await this.renderTask?.catch(() => {});
    await this.stillPage?.page.close();
    await this.host.close();
    this.removeAllListeners();
  }
}
