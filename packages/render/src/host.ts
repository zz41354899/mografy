// Node side of the scene host: a localhost server plus headless Chromium pages.
// Scene code only ever runs inside Chromium, never in the Node process.
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import { parameterDefinitionsSchema, resolveParams, sceneMetaForAspect, sceneMetaSchema } from '@mografy/core';
import type { ExportSize, MotionFrames, ParameterDefinitions, ParameterValues, RenderSettings, SceneMeta, SceneProject } from '@mografy/core';
import type { Cell, HostApi, LoadSpec, SheetSpec } from './host-page.js';
import type { SceneBuild } from './build.js';
import { handleHostRequest } from './host-server.js';
import type { FrameWaiter } from './host-server.js';

export { projectFile } from './host-server.js';

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
/**
 * Headless Chromium falls back to SwiftShader (software rendering) unless told which GPU backend to use: ANGLE on
 * Metal on macOS, ANGLE on Direct3D 11 on Windows. Only GPU pages get it: with a real GPU, pooled OffscreenCanvas
 * buffers are accelerated too, and their first frame after load can differ from later ones, which breaks the
 * same-time-same-picture check and every CPU export. CPU pages therefore run in a separate SwiftShader browser.
 */
export function gpuArgs(gpu: boolean, platform: NodeJS.Platform = process.platform) {
  if (!gpu) return [];
  return platform === 'darwin' ? ['--use-angle=metal'] : platform === 'win32' ? ['--use-angle=d3d11'] : [];
}
/** Whether a GPU canvas reaches a real GPU here; elsewhere 'gpu' would still be SwiftShader, so exports use 'cpu'. */
export const gpuCanvasAvailable = (platform: NodeJS.Platform = process.platform) => platform === 'darwin' || platform === 'win32';
type OutputSettings = Pick<RenderSettings, 'fps' | 'samples' | 'mixing' | 'glow' | 'grain'> & Partial<Pick<RenderSettings, 'adaptiveSamples' | 'shutter' | 'sampleWindow' | 'dither'>>;

/**
 * Upper bounds for work inside Chromium, in milliseconds. `page.evaluate` has no timeout of its own,
 * so a scene whose setup never resolves or whose renderFrame never returns would otherwise hold the
 * project queue forever and every later edit would wait behind it.
 */
// The trial allows 60 s: headless WebGL is SwiftShader, which compiles each Three.js pipeline on its first draw, so a
// lit 3D film's first frame alone can take ~20 s (lunar-pop-club-3d: 19 s at t = 0, 0.7 s once warm).
export const hostTimeouts = { load: 30_000, trial: 60_000, frame: 120_000 };
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
  private held: { k: number; data: Buffer } | undefined;
  /**
   * Like `output`, but only the changed rectangle crosses from the page: this page keeps the previous frame and
   * patches it. The returned buffer is reused by the next call, so write it out before asking for another frame.
   */
  async outputFrame(k: number, settings: OutputSettings, next?: number) {
    const base = this.held?.k ?? null;
    const body = await this.receive(token => this.page.evaluate(([k, s, token, next, base]) => window.mografyHost.outputDelta(k, s, token, next, base), [k, settings, token, next, base] as const));
    const [x, y, w, h] = [0, 4, 8, 12].map(o => body.readUInt32LE(o)) as [number, number, number, number];
    const { width, height } = this.scene;
    if (!this.held || base === null || (x === 0 && y === 0 && w === width && h === height)) {
      if (w !== width || h !== height) throw new Error(`Frame ${k}: the page sent a partial frame without a base`);
      this.held = { k, data: this.held?.data.length === width * height * 4 ? this.held.data : Buffer.alloc(width * height * 4) };
    }
    for (let row = 0; row < h; row++) body.copy(this.held.data, ((y + row) * width + x) * 4, 16 + row * w * 4, 16 + (row + 1) * w * 4);
    this.held.k = k;
    return this.held.data;
  }
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

async function watchedPage(context: BrowserContext) {
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  return { page, errors };
}

/** A page's failure, with what the page itself reported when that says more. */
function pageFailure(error: unknown, errors: string[]) {
  const detail = cleanError(error).message;
  return new Error(errors.length && !detail.includes(errors[0]!) ? `${detail}\n${errors.join('\n')}` : detail);
}

type Browsers = Partial<Record<CanvasBacking, Promise<Browser>>>;
/** Close every browser in a set and leave the set empty. */
async function closeBrowsers(set: Browsers) {
  const browsers = await Promise.all(Object.values(set).map(b => b.catch(() => undefined)));
  for (const key of Object.keys(set) as CanvasBacking[]) delete set[key];
  await Promise.all(browsers.map(b => b?.close().catch(() => {})));
}

/**
 * Chromium processes, by canvas backing. A host owns its own unless it is handed a shared set (batch export: one
 * Chromium for every project in the batch instead of a launch per project); the owner of a shared set closes it.
 */
export class SharedBrowsers {
  readonly browsers: Browsers = {};
  async close() { await closeBrowsers(this.browsers); }
}

/**
 * One localhost server per project, and one Chromium per project unless a SharedBrowsers set is given.
 * Builds are registered by version and served at /scene/<version>.js.
 */
export class SceneHost {
  private builds = new Map<string, string>();
  private waiters = new Map<string, FrameWaiter>();
  private browsers: Browsers;
  private constructor(readonly projectDir: string, private server: Server, readonly origin: string, private shared?: SharedBrowsers) {
    this.browsers = shared?.browsers ?? {};
  }

  static async start(projectDir: string, shared?: SharedBrowsers) {
    let host!: SceneHost;
    const server = createServer((request, response) => { void handleHostRequest({ origin: host.origin, projectDir: host.projectDir, builds: host.builds, waiters: host.waiters }, request, response); });
    await new Promise<void>((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done); });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Host server failed to start');
    host = new SceneHost(resolve(projectDir), server, `http://127.0.0.1:${address.port}`, shared);
    return host;
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
  private launch(backing: CanvasBacking) {
    const running = this.browsers[backing];
    if (running) return running;
    const args = ['--force-color-profile=srgb', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', ...gpuArgs(backing === 'gpu')];
    const channel = process.env.PLAYWRIGHT_CHANNEL;
    // Playwright's own Ctrl+C handling kills Chromium and exits at once, before an export can cancel cleanly (and before
    // a batch can print its summary). Commands that handle Ctrl+C do so themselves; Chromium still closes on exit.
    const signals = { handleSIGINT: false, handleSIGTERM: false };
    const launching: Promise<Browser> = chromium.launch({ ...(channel ? { channel } : {}), args, ...signals }).catch(async error => {
      if (channel || !/Executable doesn't exist|install/i.test(String(error))) throw error;
      return chromium.launch({ channel: 'chrome', args, ...signals }).catch(() => {
        throw new Error('No Chromium found. Run `pnpm exec playwright install chromium`, or install Google Chrome.');
      });
    });
    this.browsers[backing] = launching;
    // A crashed or closed Chromium must not be reused: forget it so the next page launches a fresh one.
    const forget = () => { if (this.browsers[backing] === launching) delete this.browsers[backing]; };
    launching.then(browser => browser.once('disconnected', forget), forget);
    return launching;
  }

  /** A live browser context; relaunches Chromium once if the cached browser has died. */
  private async context(backing: CanvasBacking): Promise<BrowserContext> {
    const options = { viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 };
    for (let attempt = 0; ; attempt++) {
      const browser = await this.launch(backing);
      if (!browser.isConnected()) {
        if (attempt > 0) throw new Error('Chromium closed unexpectedly and could not be restarted.');
        delete this.browsers[backing]; continue;
      }
      try { return await browser.newContext(options); }
      catch (error) {
        if (attempt > 0 || !/closed|disconnected|crash/i.test(String(error))) throw error;
        delete this.browsers[backing];
        await browser.close().catch(() => {});
      }
    }
  }

  private async ready(page: Page) {
    await page.goto(`${this.origin}/`, { timeout: hostTimeouts.load });
    await page.waitForFunction(() => 'mografyHost' in window, undefined, { timeout: hostTimeouts.load });
  }

  /** Open a page for one job and always close it. */
  private async withPage<T>(build: SceneBuild, project: SceneProject, options: OpenOptions, run: (page: HostPage) => Promise<T>): Promise<T> {
    const page = await this.open(build, project, options);
    try { return await run(page); } finally { await page.close(); }
  }

  private trial(page: HostPage, timeoutMessage: string) {
    return bounded(page.page.evaluate(() => window.mografyHost.trial()), hostTimeouts.trial, timeoutMessage, () => page.close()).catch(e => { throw cleanError(e); });
  }

  /** Each page gets its own browser context, so parallel segments run in separate renderer processes. */
  async open(build: SceneBuild, project: SceneProject, options: OpenOptions = {}) {
    const sceneUrl = this.register(build);
    const canvas = options.canvas ?? canvasBacking();
    const context = await this.context(canvas);
    const { page, errors } = await watchedPage(context);
    const assets = new Set<string>();
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.origin === this.origin && url.pathname.startsWith('/project/')) assets.add(decodeURIComponent(url.pathname.slice(9)));
    });
    try {
      await this.ready(page);
      const spec: LoadSpec = {
        sceneUrl, assetBase: `${this.origin}/project/`, seed: options.seed ?? project.seed,
        renderScale: options.renderScale ?? 1, params: options.params ?? project.params,
        fonts: project.fonts, audio: project.audio,
        outputSize: options.outputSize,
        aspectRatio: project.aspectRatio,
        canvas,
      };
      const scene = await bounded(page.evaluate(s => window.mografyHost.load(s), spec), hostTimeouts.load,
        `Scene setup did not finish within ${seconds(hostTimeouts.load)}. Check setup() for an await that never resolves (image, font or fetch) or a loop that never ends.`,
        () => context.close()) as LoadedScene;
      return new HostPage(this, context, page, scene, assets);
    } catch (error) {
      await context.close().catch(() => {});
      throw pageFailure(error, errors);
    }
  }

  /**
   * Meta and parameter definitions read from the module's exports, validated exactly as the runtime does, without
   * setup or a frame: seconds faster than `inspect` for 3D scenes, whose headless WebGL is software. Opening a
   * project uses this and runs the full trial afterwards in the background.
   */
  async describe(build: SceneBuild, project: SceneProject): Promise<LoadedScene> {
    const sceneUrl = this.register(build);
    const context = await this.context('cpu');
    const { page, errors } = await watchedPage(context);
    try {
      await this.ready(page);
      const raw = await bounded(page.evaluate(url => window.mografyHost.describe(url), sceneUrl), hostTimeouts.load,
        `Loading the scene module did not finish within ${seconds(hostTimeouts.load)}.`, () => context.close());
      const meta = sceneMetaForAspect(sceneMetaSchema.parse(raw.meta), project.aspectRatio), params = parameterDefinitionsSchema.parse(raw.params);
      resolveParams(params, project.params ?? {});
      return { meta, params, width: meta.width, height: meta.height };
    } catch (error) {
      throw pageFailure(error, errors);
    } finally { await context.close().catch(() => {}); }
  }

  /** Load in Chromium, validate exports and params, run setup and a trial render. */
  inspect(build: SceneBuild, project: SceneProject) {
    return this.withPage(build, project, { params: {} }, async page => {
      await this.trial(page, `Trial render did not finish within ${seconds(hostTimeouts.trial)}. renderFrame may contain a loop that never ends, or one frame is far too slow to preview.`);
      return page.scene;
    });
  }

  /** Load the scene and measure what its frames cost to draw (see FrameCost). */
  measure(build: SceneBuild, project: SceneProject) {
    return this.withPage(build, project, { params: {} }, page => bounded(page.page.evaluate(() => window.mografyHost.cost()), hostTimeouts.trial,
      `Measuring frames did not finish within ${seconds(hostTimeouts.trial)}.`, () => page.close()).catch(e => { throw cleanError(e); }));
  }

  /**
   * Tiny greyscale frames every `step` seconds over the whole film, for `mografy check --motion`. Drawn at
   * quarter scale: motion, not detail, is what it measures.
   */
  motionFrames(build: SceneBuild, project: SceneProject, step = 1 / 30, width = 128): Promise<MotionFrames> {
    return this.withPage(build, project, { params: {}, renderScale: 0.25 }, async page => {
      const { duration } = page.scene.meta, count = Math.floor(duration / step + 1e-6) + 1;
      const times = Array.from({ length: count }, (_, i) => Math.min(duration, Number((i * step).toFixed(4))));
      const parts: Uint8Array[] = [];
      for (let i = 0; i < count; i += 240) parts.push(new Uint8Array(await page.motion(times.slice(i, i + 240), width)));
      const data = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      parts.reduce((offset, p) => { data.set(p, offset); return offset + p.length; }, 0);
      return { step, size: data.length / count, data };
    });
  }

  /** The project files a scene loads: run setup and a trial render, recording every request. */
  loadedAssets(build: SceneBuild, project: SceneProject) {
    return this.withPage(build, project, { renderScale: 0.25 }, async page => {
      await this.trial(page, `Trial render did not finish within ${seconds(hostTimeouts.trial)}.`);
      return [...page.assets].sort();
    });
  }

  async close() {
    for (const waiter of this.waiters.values()) waiter.reject(new Error('Host closed'));
    this.waiters.clear();
    if (!this.shared) await closeBrowsers(this.browsers);
    await new Promise<void>(done => this.server.close(() => done()));
  }
}

