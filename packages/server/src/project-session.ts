import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ProjectList, ServerEvent } from '@mografy/core';
import { ApiError, Project } from './project.js';
import { AlreadyRunning, ServerLock } from './lock.js';
import { isProject } from './project-scaffold.js';
import { listProjects } from './workspace.js';
import { clearActive, rememberProject, writeActive } from './workspace-state.js';

/** Owns the currently opened Project, its lock, switches, and catalog invalidation. */
export class ProjectSession extends EventEmitter<{ event: [ServerEvent] }> {
  private switching: Promise<unknown> = Promise.resolve();
  private closing: Promise<void> | undefined;
  private closed = false;
  private url = '';
  private catalog: { expires: number; data: Promise<ProjectList> } | undefined;
  private unsubscribe: () => void;

  private constructor(readonly token: string, private current: Project, private lock: ServerLock) {
    super();
    this.unsubscribe = this.listen(current);
  }

  static async open(dir: string) {
    const token = randomUUID(), lock = await ServerLock.acquire(dir, token);
    try { return new ProjectSession(token, await Project.open(dir), lock); }
    catch (error) { await lock.release(); throw error; }
  }

  get project() { return this.current; }

  private listen(project: Project) {
    const listener = (event: ServerEvent) => {
      if (this.closed || project !== this.current) return;
      if (event.type === 'snapshot' && ['scene', 'project', 'thumbnail'].includes(event.reason)) this.catalog = undefined;
      this.emit('event', event);
    };
    project.on('event', listener);
    return () => { project.off('event', listener); };
  }

  async activate(url: string) {
    this.url = url;
    this.current.url = url;
    await this.lock.write(url);
    this.current.watch();
    await this.remember();
  }

  private async remember() {
    await rememberProject(this.current.dir);
    await writeActive({ pid: process.pid, url: this.url, token: this.token, project: this.current.dir }).catch(() => {});
  }

  getProjects() {
    if (!this.catalog || this.catalog.expires <= Date.now()) {
      const catalog = { expires: Date.now() + 1000, data: listProjects(this.current.dir) };
      this.catalog = catalog;
      void catalog.data.catch(() => { if (this.catalog === catalog) this.catalog = undefined; });
    }
    return this.catalog.data;
  }

  switchProject(dir: string) {
    if (this.closed) return Promise.reject(new ApiError(503, 'CLOSED', 'Server is closing'));
    const run = async () => {
      if (this.closed) throw new ApiError(503, 'CLOSED', 'Server is closing');
      const target = await realpath(resolve(dir)).catch(() => { throw new ApiError(404, 'NOT_FOUND', `Folder not found: ${dir}`); });
      if (target === this.current.dir) return this.current.snapshot();
      if (!await isProject(target)) throw new ApiError(404, 'NOT_A_PROJECT', `${target} has no mografy.json`);
      let nextLock: ServerLock;
      try { nextLock = await ServerLock.acquire(target, this.token); }
      catch (error) {
        if (error instanceof AlreadyRunning) throw new ApiError(409, 'ALREADY_OPEN', `That project is already open in another player: ${error.url}`, { url: error.url });
        throw error;
      }
      let next: Project | undefined;
      try {
        next = await Project.open(target);
        next.url = this.url;
        await nextLock.write(this.url);
        if (this.closed) throw new ApiError(503, 'CLOSED', 'Server is closing');
      } catch (error) {
        try { await next?.close(); } finally { await nextLock.release(); }
        throw error;
      }
      const old = this.current, oldLock = this.lock;
      this.unsubscribe();
      this.current = next; this.lock = nextLock;
      this.unsubscribe = this.listen(next);
      next.watch();
      this.catalog = undefined;
      try { await old.close(); } finally { await oldLock.release(); }
      await this.remember();
      const snapshot = this.current.snapshot();
      if (!this.closed) this.emit('event', { type: 'snapshot', reason: 'switch', snapshot });
      return snapshot;
    };
    const next = this.switching.then(run);
    this.switching = next.catch(() => {});
    return next;
  }

  close() {
    this.closed = true;
    return this.closing ??= (async () => {
      await this.switching;
      this.unsubscribe();
      try { await this.current.close(); }
      finally { await this.lock.release(); await clearActive(this.token); this.removeAllListeners(); }
    })();
  }
}
