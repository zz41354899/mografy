// Which process hosts a project for the MCP server: the running player when there is one (so the player and the
// agent see the same result and share one Chromium), otherwise a Project this process opens and keeps for a while.
import { existsSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { readApiResponse, sendApi } from '@mografy/core';
import type { ExportRequest, FrameCost, RenderStatus, Smoothness, Snapshot } from '@mografy/core';
import type { ReviewResult } from '@mografy/render';
import { Project, WORKSPACE_FILE, findServer, isProject, libraryDir } from '@mografy/server';
import { workspaceRoot } from '../paths.js';

const isWorkspace = (dir: string) => existsSync(join(dir, WORKSPACE_FILE));

export type CheckResult = Snapshot & { cost?: FrameCost | undefined };
export interface Source { entry: string; files: Record<string, string> }

/** One project's operations, whoever hosts it. */
export interface Host {
  readonly via: 'player' | 'mcp';
  readonly url?: string | undefined;
  snapshot(): Promise<Snapshot>;
  check(): Promise<CheckResult>;
  motion(): Promise<Smoothness>;
  still(t: number, kind: 'raw' | 'output'): Promise<Buffer>;
  review(): Promise<ReviewResult>;
  readSource(): Promise<Source>;
  writeSource(files: Record<string, string>): Promise<{ version: string; changed: boolean; issues: unknown[] }>;
  startRender(request: ExportRequest): Promise<RenderStatus>;
  render(): Promise<RenderStatus | null>;
  cancelRender(id: string): Promise<void>;
}

/** The player answers 409 when it has switched to another project; this host then falls back to its own. */
class Switched extends Error {}

function playerHost(url: string, identity: string): Host {
  const call = async (path: string, method = 'GET', payload?: unknown) => {
    const response = await sendApi(url, path, method, payload, identity);
    if (response.status === 409) {
      const body = await response.clone().json().catch(() => ({})) as { error?: { code?: string } };
      if (body.error?.code === 'PROJECT_CHANGED') throw new Switched();
    }
    return response;
  };
  const json = async <T>(path: string, method = 'GET', payload?: unknown) => readApiResponse<T>(await call(path, method, payload));
  return {
    via: 'player', url,
    snapshot: () => json<Snapshot>('snapshot'),
    check: () => json<CheckResult>('check', 'POST'),
    motion: () => json<Smoothness>('check/motion', 'POST'),
    still: async (t, kind) => {
      const response = await call(`still?t=${encodeURIComponent(t)}&kind=${kind}`);
      if (!response.ok) await readApiResponse(response);
      return Buffer.from(await response.arrayBuffer());
    },
    review: () => json<ReviewResult>('review', 'POST'),
    readSource: () => json<Source>('source'),
    writeSource: files => json('source', 'POST', { files }),
    startRender: request => json<RenderStatus>('render', 'POST', request),
    render: async () => (await json<{ render: RenderStatus | null }>('snapshot')).render,
    cancelRender: async id => { await json('render/cancel', 'POST', { id }); },
  };
}

function ownHost(project: Project): Host {
  // This process does not watch files (the agent edits them between calls), so read the disk before each answer.
  const fresh = () => project.rebuild('watch').catch(() => {});
  return {
    via: 'mcp',
    snapshot: async () => { await fresh(); return project.snapshot(); },
    check: () => project.check(),
    motion: async () => { await fresh(); return project.motion(); },
    still: async (t, kind) => { await fresh(); return project.still({ kind, t }); },
    review: async () => { await fresh(); return project.review(); },
    readSource: () => project.readSource(),
    writeSource: files => project.updateSource(files),
    startRender: async request => { await fresh(); return project.startRender(request); },
    render: async () => project.snapshot().render,
    cancelRender: async id => { project.cancelRender(id); },
  };
}

const IDLE_MS = 5 * 60_000;

export class Hosts {
  private opened = new Map<string, { project: Promise<Project>; timer?: ReturnType<typeof setTimeout> | undefined }>();

  /**
   * A project path: absolute, relative to the current folder, a folder name in the projects library, or a path inside
   * the Mografy installation or workspace. Without one, MOGRAFY_PROJECT or the project in the current folder.
   */
  async resolve(arg: unknown): Promise<string> {
    const value = typeof arg === 'string' && arg.trim() ? arg.trim() : undefined;
    if (!value) {
      // MOGRAFY_PROJECT may name a workspace (that is where the server works, see workspaceDir) rather than one project.
      if (process.env.MOGRAFY_PROJECT && !isWorkspace(resolve(process.env.MOGRAFY_PROJECT))) return this.require(resolve(process.env.MOGRAFY_PROJECT));
      if (await isProject(process.cwd())) return realpath(process.cwd());
      throw new Error('Name a project: an absolute path, or a folder name from list_projects.');
    }
    const candidates = isAbsolute(value) ? [value] : [resolve(value), join(libraryDir(), value), resolve(workspaceRoot, value)];
    for (const dir of candidates) if (await isProject(dir)) return realpath(dir);
    throw new Error(`${value} is not a Mografy project (no mografy.json). Use list_projects to see the projects.`);
  }
  private async require(dir: string) {
    if (!await isProject(dir)) throw new Error(`${dir} has no mografy.json.`);
    return realpath(dir);
  }

  /** Run `task` against whoever hosts `dir` now. */
  async with<T>(dir: string, task: (host: Host) => Promise<T>): Promise<T> {
    const server = await findServer(dir);
    if (server) {
      // Never host a project beside its player: two hosts would both write its files.
      await this.release(dir);
      try { return await task(playerHost(server.url, dir)); }
      catch (error) { if (!(error instanceof Switched)) throw error; }
    }
    return task(ownHost(await this.open(dir)));
  }

  private async open(dir: string) {
    let entry = this.opened.get(dir);
    if (!entry) {
      entry = { project: Project.open(dir) };
      this.opened.set(dir, entry);
      entry.project.catch(() => this.opened.delete(dir));
    }
    clearTimeout(entry.timer);
    const current = entry;
    current.timer = setTimeout(() => {
      // Keep a project with an export in progress until it finishes.
      void current.project.then(project => project.snapshot().render?.state === 'running' ? undefined : this.release(dir));
    }, IDLE_MS);
    current.timer.unref();
    return entry.project;
  }

  async release(dir: string) {
    const entry = this.opened.get(dir);
    if (!entry) return;
    this.opened.delete(dir);
    clearTimeout(entry.timer);
    await entry.project.then(project => project.close(), () => {});
  }

  async close() { await Promise.all([...this.opened.keys()].map(dir => this.release(dir))); }
}

