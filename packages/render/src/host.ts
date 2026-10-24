// Node side of the scene host: a localhost server plus headless Chromium pages.
// Scene code only ever runs inside Chromium, never in the Node process.
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';
import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { ExportSize, ParameterDefinitions, ParameterValues, RenderSettings, SceneMeta, SceneProject } from '@mografy/core';
import type { Cell, HostApi, LoadSpec, SheetSpec } from './host-page.js';
import type { SceneBuild } from './build.js';

const MIME: Record<string, string> = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg' };

const bundles = new Map<string, Promise<string>>();
/** Bundle an in-page script (the host page or its output worker, with runtime + core) once per process. */
function pageBundle(name: 'host-page' | 'post-worker') {
  let bundle = bundles.get(name);
  if (!bundle) {
    const self = fileURLToPath(import.meta.url);
    const entry = resolve(self, '..', `${name}${extname(self)}`);
    bundle = esbuild({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'browser', target: 'chrome120', write: false, logLevel: 'silent' })
      .then(result => result.outputFiles[0]!.text);
    bundles.set(name, bundle);
  }
  return bundle;
}

/** Resolve a request path to a file inside the project, refusing dot-directories and escapes. */
export async function projectFile(projectDir: string, relativePath: string) {
  const parts = relativePath.split('/');
  if (!relativePath || parts.some(p => !p || p === '..' || p.startsWith('.')) || relativePath.includes('\\') || relativePath.includes(':')) throw new Error(`Unsafe asset path: ${relativePath}`);
  const root = await realpath(projectDir);
  const file = await realpath(resolve(root, relativePath));
  const local = relative(root, file);
  if (!local || local.startsWith('..') || isAbsolute(local)) throw new Error(`Asset outside project: ${relativePath}`);
  if (!(await stat(file)).isFile()) throw new Error(`Not a file: ${relativePath}`);
  return file;
}

export interface LoadedScene { meta: SceneMeta; params: ParameterDefinitions; width: number; height: number }
export interface OpenOptions {
  renderScale?: number; params?: ParameterValues; seed?: number; outputSize?: ExportSize | undefined;
  /** Canvas backing (see RuntimeOptions.canvas). Defaults to MOGRAFY_CANVAS, else 'cpu'. */
  canvas?: CanvasBacking | undefined;
}
export type CanvasBacking = 'cpu' | 'gpu';
/** `MOGRAFY_CANVAS=gpu` draws with GPU acceleration, for comparing speed on a machine with a GPU. */
export function canvasBacking(): CanvasBacking {
  const value = process.env.MOGRAFY_CANVAS?.trim().toLowerCase();
  if (!value || value === 'cpu') return 'cpu';
  if (value === 'gpu') return 'gpu';
  throw new Error(`MOGRAFY_CANVAS must be cpu or gpu, not ${process.env.MOGRAFY_CANVAS}`);
}
type OutputSettings = Pick<RenderSettings, 'fps' | 'samples' | 'mixing' | 'glow' | 'grain'>;

/**
 * Upper bounds for work inside Chromium, in milliseconds. `page.evaluate` has no timeout of its own,
 * so a scene whose setup never resolves or whose renderFrame never returns would otherwise hold the
 * project queue forever and every later edit would wait behind it.
 */
/** Largest frame or sheet a page may upload; Node buffers cannot hold much more. */
const UPLOAD_LIMIT = 512 * 1024 ** 2;
export const hostTimeouts = { load: 30_000, trial: 20_000, frame: 120_000 };
const seconds = (ms: number) => `${Math.round(ms / 100) / 10}s`;

export class SceneTimeoutError extends Error {
  constructor(message: string) { super(message); this.name = 'SceneTimeoutError'; }
}

/** Race work against a deadline; on timeout, run `abandon` (close the page/context) so Chromium stops the work. */
async function bounded<T>(work: Promise<T>, ms: number, message: string, abandon: () => Promise<unknown>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new SceneTimeoutError(message)), ms); });
  try { return await Promise.race([work, deadline]); }
  catch (error) {
    if (error instanceof SceneTimeoutError) { void work.catch(() => {}); await abandon().catch(() => {}); }
    throw error;
  }
  finally { clearTimeout(timer); }
}

export class HostPage {
  private dead = false;
    /** `assets` collects the project files this page requests; setup loads every asset a scene draws with. */
  constructor(private host: SceneHost, private context: BrowserContext, readonly page: Page, readonly scene: LoadedScene, readonly assets: ReadonlySet<string> = new Set()) {}
  /** True after close, a timeout or a renderer crash; callers holding a cached page must open a new one. */
  get closed() { return this.dead || this.page.isClosed(); }
  private bounded<T>(work: Promise<T>) {
    return bounded(work, hostTimeouts.frame, `Rendering a frame did not finish within ${seconds(hostTimeouts.frame)}. renderFrame may contain a loop that never ends.`, () => this.close());
  }
  private async receive(run: (token: string) => Promise<unknown>) {
    const { token, data } = this.host.expect();
    try { await this.bounded(run(token)); } catch (error) { this.host.cancel(token); throw cleanError(error); }
    return data;
  }
  /** Raw RGBA of the scene at time t (device pixels). */
  raw(t: number) { return this.receive(token => this.page.evaluate(([t, token]) => window.mografyHost.raw(t, token), [t, token] as const)); }
  rawHash(t: number) { return this.bounded(this.page.evaluate(t => window.mografyHost.rawHash(t), t)).catch(e => { throw cleanError(e); }); }
  /**
   * Post-processed RGBA of output frame k. Pass `next` (the frame you will ask for after this one) to let
   * the page draw it while frame k is still being mixed; the next call then only waits for its finish.
   */
  output(k: number, settings: OutputSettings, next?: number) { return this.receive(token => this.page.evaluate(([k, s, token, next]) => window.mografyHost.output(k, s, token, next), [k, settings, token, next] as const)); }
  png(cell: Cell, settings: OutputSettings) { return this.receive(token => this.page.evaluate(([c, s, token]) => window.mografyHost.png(c, s, token), [cell, settings, token] as const)); }
  /** Greyscale frames `width` wide at each time, concatenated (see host-page motion). */
  motion(times: number[], width: number) { return this.receive(token => this.page.evaluate(([t, w, token]) => window.mografyHost.motion(t, w, token), [times, width, token] as const)); }
  thumb(t: number, width = 480) { return this.receive(token => this.page.evaluate(([t, w, token]) => window.mografyHost.thumb(t, w, token), [t, width, token] as const)); }
  sheet(spec: SheetSpec) { return this.receive(token => this.page.evaluate(([s, token]) => window.mografyHost.sheet(s, token), [spec, token] as const)); }
  async close() { this.dead = true; await this.context.close().catch(() => {}); }
}

declare global { interface Window { mografyHost: HostApi } }

function cleanError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(message.replace(/^page\.evaluate: /, '').replace(/\n\s+at .*/gs, '').trim());
}

/**
 * One localhost server and one Chromium per project.
 * Builds are registered by version and served at /scene/<version>.js.
 */
export class SceneHost {
  private builds = new Map<string, string>();
  private waiters = new Map<string, { resolve(data: Buffer): void; reject(error: Error): void }>();
  private browser: Promise<Browser> | undefined;
  private constructor(readonly projectDir: string, private server: Server, readonly origin: string) {}

  static async start(projectDir: string) {
    let host!: SceneHost;
    const server = createServer((request, response) => { void host.handle(request, response); });
    await new Promise<void>((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done); });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Host server failed to start');
    host = new SceneHost(resolve(projectDir), server, `http://127.0.0.1:${address.port}`);
    return host;
  }

  private async handle(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url ?? '/', this.origin);
    const fail = (status: number, message: string) => { response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' }); response.end(message); };
    // Only the headless page this host opened: refuse other hosts (DNS rebinding) and cross-site requests.
    if (request.headers.host !== new URL(this.origin).host || request.headers['sec-fetch-site'] === 'cross-site') return fail(403, 'forbidden');
    try {
      if (request.method === 'POST' && url.pathname.startsWith('/upload/')) {
        const waiter = this.waiters.get(url.pathname.slice(8));
        if (!waiter) return fail(404, 'unknown token');
        const chunks: Buffer[] = []; let size = 0;
        for await (const chunk of request) {
          size += (chunk as Buffer).length;
          if (size > UPLOAD_LIMIT) { this.waiters.delete(url.pathname.slice(8)); waiter.reject(new Error('Rendered data is larger than 512 MB')); return fail(413, 'too large'); }
          chunks.push(chunk as Buffer);
        }
        this.waiters.delete(url.pathname.slice(8));
        waiter.resolve(Buffer.concat(chunks));
        response.writeHead(204); response.end(); return;
      }
      if (request.method !== 'GET') return fail(405, 'method');
      if (url.pathname === '/') { response.writeHead(200, { 'content-type': 'text/html' }); response.end('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"><script type="module" src="/host.js"></script>'); return; }
      if (url.pathname === '/host.js') { response.writeHead(200, { 'content-type': 'text/javascript' }); response.end(await pageBundle('host-page')); return; }
      if (url.pathname === '/post-worker.js') { response.writeHead(200, { 'content-type': 'text/javascript' }); response.end(await pageBundle('post-worker')); return; }
      const scene = /^\/scene\/([\da-f]+)\.js$/.exec(url.pathname);
      if (scene) {
        const code = this.builds.get(scene[1]!);
        if (!code) return fail(404, 'unknown build');
        response.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' }); response.end(code); return;
      }
      if (url.pathname.startsWith('/project/')) {
        const file = await projectFile(this.projectDir, decodeURIComponent(url.pathname.slice(9)));
        response.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' });
        response.end(await readFile(file)); return;
      }
      fail(404, 'not found');
    } catch (error) { fail(404, error instanceof Error ? error.message : String(error)); }
  }

  expect() {
    const token = randomUUID();
    const data = new Promise<Buffer>((resolve, reject) => this.waiters.set(token, { resolve, reject }));
    void data.catch(() => {});
    return { token, data };
  }
  cancel(token: string) { this.waiters.get(token)?.reject(new Error('cancelled')); this.waiters.delete(token); }

  register(build: SceneBuild) { this.builds.set(build.version, build.code); return `${this.origin}/scene/${build.version}.js`; }

  /**
   * Playwright's bundled Chromium first (`pnpm exec playwright install chromium`);
   * if it is not installed, fall back to the system Google Chrome.
   */
  private launch() {
    if (this.browser) return this.browser;
    const args = ['--force-color-profile=srgb', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'];
    const channel = process.env.PLAYWRIGHT_CHANNEL;
    const launching: Promise<Browser> = chromium.launch({ ...(channel ? { channel } : {}), args }).catch(async error => {
      if (channel || !/Executable doesn't exist|install/i.test(String(error))) throw error;
      return chromium.launch({ channel: 'chrome', args }).catch(() => {
        throw new Error('No Chromium found. Run `pnpm exec playwright install chromium`, or install Google Chrome.');
      });
    });
    this.browser = launching;
    // A crashed or closed Chromium must not be reused: forget it so the next page launches a fresh one.
    const forget = () => { if (this.browser === launching) this.browser = undefined; };
    launching.then(browser => browser.once('disconnected', forget), forget);
    return launching;
  }

  /** A live browser context; relaunches Chromium once if the cached browser has died. */
  private async context(): Promise<BrowserContext> {
    const options = { viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 };
    for (let attempt = 0; ; attempt++) {
      const browser = await this.launch();
      if (!browser.isConnected()) {
        if (attempt > 0) throw new Error('Chromium closed unexpectedly and could not be restarted.');
        this.browser = undefined; continue;
      }
      try { return await browser.newContext(options); }
      catch (error) {
        if (attempt > 0 || !/closed|disconnected|crash/i.test(String(error))) throw error;
        this.browser = undefined;
        await browser.close().catch(() => {});
      }
    }
  }

  /** Each page gets its own browser context, so parallel segments run in separate renderer processes. */
  async open(build: SceneBuild, project: SceneProject, options: OpenOptions = {}) {
    const sceneUrl = this.register(build);
    const context = await this.context();
    const page = await context.newPage();
    const errors: string[] = [], assets = new Set<string>();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.origin === this.origin && url.pathname.startsWith('/project/')) assets.add(decodeURIComponent(url.pathname.slice(9)));
    });
    try {
      await page.goto(`${this.origin}/`, { timeout: hostTimeouts.load });
      await page.waitForFunction(() => 'mografyHost' in window, undefined, { timeout: hostTimeouts.load });
      const spec: LoadSpec = {
        sceneUrl, assetBase: `${this.origin}/project/`, seed: options.seed ?? project.seed,
        renderScale: options.renderScale ?? 1, params: options.params ?? project.params,
        fonts: project.fonts, audio: project.audio,
        outputSize: options.outputSize,
        aspectRatio: project.aspectRatio,
        canvas: options.canvas ?? canvasBacking(),
      };
      const scene = await bounded(page.evaluate(s => window.mografyHost.load(s), spec), hostTimeouts.load,
        `Scene setup did not finish within ${seconds(hostTimeouts.load)}. Check setup() for an await that never resolves (image, font or fetch) or a loop that never ends.`,
        () => context.close()) as LoadedScene;
      return new HostPage(this, context, page, scene, assets);
    } catch (error) {
      await context.close().catch(() => {});
      const detail = cleanError(error).message;
      throw new Error(errors.length && !detail.includes(errors[0]!) ? `${detail}\n${errors.join('\n')}` : detail);
    }
  }

  /** Load in Chromium, validate exports and params, run setup and a trial render. */
  async inspect(build: SceneBuild, project: SceneProject) {
    const page = await this.open(build, project, { params: {} });
    try {
      await bounded(page.page.evaluate(() => window.mografyHost.trial()), hostTimeouts.trial,
        `Trial render did not finish within ${seconds(hostTimeouts.trial)}. renderFrame may contain a loop that never ends, or one frame is far too slow to preview.`,
        () => page.close()).catch(e => { throw cleanError(e); });
      return page.scene;
    } finally { await page.close(); }
  }

  /** The project files a scene loads: run setup and a trial render, recording every request. */
  async loadedAssets(build: SceneBuild, project: SceneProject) {
    const page = await this.open(build, project, { renderScale: 0.25 });
    try {
      await bounded(page.page.evaluate(() => window.mografyHost.trial()), hostTimeouts.trial,
        `Trial render did not finish within ${seconds(hostTimeouts.trial)}.`, () => page.close()).catch(e => { throw cleanError(e); });
      return [...page.assets].sort();
    } finally { await page.close(); }
  }

  async close() {
    for (const waiter of this.waiters.values()) waiter.reject(new Error('Host closed'));
    this.waiters.clear();
    const browser = await this.browser?.catch(() => undefined);
    this.browser = undefined;
    await browser?.close().catch(() => {});
    await new Promise<void>(done => this.server.close(() => done()));
  }
}

