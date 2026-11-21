// A small Chrome DevTools Protocol client: just what the scene host needs (launch a headless Chromium, isolated
// contexts, pages that navigate and evaluate, page errors, requests, crash detection). It replaces Playwright at
// runtime, so the installation carries no browser-automation library; the tests still drive the player with
// Playwright. Chromium is driven over --remote-debugging-pipe (file descriptors 3 and 4): no port, no WebSocket.
//
// Which Chromium: MOGRAFY_BROWSER (a path), or PLAYWRIGHT_CHANNEL (chrome, msedge, chromium); else Playwright's
// headless shell when one is installed (the same pixels as before, and what a checkout's `pnpm install` sets up);
// else the Google Chrome, Microsoft Edge or Chromium on this computer. `locateBrowser` lists what it tried.
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import type { Readable, Writable } from 'node:stream';

// ---------------------------------------------------------------- finding a browser

export interface BrowserCandidate { path: string; kind: 'shell' | 'chrome' | 'msedge' | 'chromium' | 'custom' }

/** Playwright's browser folder (PLAYWRIGHT_BROWSERS_PATH, or its per-platform cache). */
export function playwrightCache(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env, home = homedir()) {
  if (env.PLAYWRIGHT_BROWSERS_PATH && env.PLAYWRIGHT_BROWSERS_PATH !== '0') return env.PLAYWRIGHT_BROWSERS_PATH;
  if (platform === 'darwin') return join(home, 'Library', 'Caches', 'ms-playwright');
  if (platform === 'win32') return join(env.LOCALAPPDATA ?? join(home, 'AppData', 'Local'), 'ms-playwright');
  return join(env.XDG_CACHE_HOME ?? join(home, '.cache'), 'ms-playwright');
}

/** Installed Playwright headless shells, newest revision first. */
export function headlessShells(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env, home = homedir()): string[] {
  const cache = playwrightCache(platform, env, home);
  const exe = platform === 'win32' ? '.exe' : '';
  let entries: string[] = [];
  try { entries = readdirSync(cache); } catch { return []; }
  const revisions = entries.map(name => /^chromium_headless_shell-(\d+)$/.exec(name)).filter((m): m is RegExpExecArray => Boolean(m))
    .sort((a, b) => Number(b[1]) - Number(a[1])).map(m => join(cache, m[0]));
  const found: string[] = [];
  for (const dir of revisions) {
    if (!existsSync(join(dir, 'INSTALLATION_COMPLETE'))) continue;
    let inner: string[] = [];
    try { inner = readdirSync(dir); } catch { continue; }
    for (const sub of inner) {
      const file = sub.startsWith('chrome-headless-shell-') ? join(dir, sub, `chrome-headless-shell${exe}`)
        : /^chrome-(linux|mac|win)/.test(sub) ? join(dir, sub, `headless_shell${exe}`) : undefined;
      if (file && existsSync(file)) { found.push(file); break; }
    }
  }
  return found;
}

const which = (names: string[], env: NodeJS.ProcessEnv) => {
  for (const dir of (env.PATH ?? '').split(delimiter).filter(Boolean))
    for (const name of names) if (existsSync(join(dir, name))) return join(dir, name);
  return undefined;
};

/** Where Chrome, Edge and Chromium install themselves, per platform, by kind. */
export function systemBrowsers(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env, home = homedir()): BrowserCandidate[] {
  const list: BrowserCandidate[] = [];
  const add = (kind: BrowserCandidate['kind'], path: string | undefined) => { if (path) list.push({ kind, path }); };
  if (platform === 'darwin') {
    for (const root of ['/Applications', join(home, 'Applications')]) {
      add('chrome', join(root, 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'));
      add('msedge', join(root, 'Microsoft Edge.app', 'Contents', 'MacOS', 'Microsoft Edge'));
      add('chromium', join(root, 'Chromium.app', 'Contents', 'MacOS', 'Chromium'));
    }
  } else if (platform === 'win32') {
    const roots = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter((r): r is string => Boolean(r));
    for (const root of roots) add('chrome', join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    for (const root of roots) add('msedge', join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  } else {
    add('chrome', '/opt/google/chrome/chrome');
    add('chrome', which(['google-chrome', 'google-chrome-stable'], env));
    add('msedge', which(['microsoft-edge', 'microsoft-edge-stable'], env));
    add('chromium', which(['chromium', 'chromium-browser'], env));
  }
  return list;
}

/**
 * The Chromium to launch, in order of preference, and what was looked at (for the error when nothing is there).
 * Only existing files are returned.
 */
export function locateBrowser(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env, home = homedir()):
  { found: BrowserCandidate[]; looked: string[] } {
  const looked: string[] = [];
  const existing = (candidates: BrowserCandidate[]) => candidates.filter((c, i) => {
    if (candidates.findIndex(o => o.path === c.path) !== i) return false;
    looked.push(c.path);
    return existsSync(c.path);
  });
  if (env.MOGRAFY_BROWSER) return { found: existing([{ kind: 'custom', path: env.MOGRAFY_BROWSER }]), looked };
  const channel = env.PLAYWRIGHT_CHANNEL?.trim().toLowerCase();
  const system = systemBrowsers(platform, env, home);
  if (channel) {
    const kind = channel.startsWith('msedge') ? 'msedge' : channel.startsWith('chrome') ? 'chrome' : 'chromium';
    return { found: existing(system.filter(c => c.kind === kind)), looked };
  }
  const shells = headlessShells(platform, env, home).map(path => ({ kind: 'shell' as const, path }));
  looked.push(join(playwrightCache(platform, env, home), 'chromium_headless_shell-*'));
  return { found: [...shells, ...existing(system)], looked };
}

// ---------------------------------------------------------------- protocol

interface Pending { resolve(value: any): void; reject(error: Error): void; method: string }
interface Message { id?: number; method?: string; params?: any; result?: any; error?: { message: string; data?: string }; sessionId?: string }

class Connection extends EventEmitter {
  private next = 1;
  private pending = new Map<number, Pending>();
  private buffer = '';
  closed = false;
  constructor(private input: Writable, output: Readable) {
    super();
    output.setEncoding('utf8');
    output.on('data', (chunk: string) => {
      this.buffer += chunk;
      for (let end = this.buffer.indexOf('\0'); end >= 0; end = this.buffer.indexOf('\0')) {
        const text = this.buffer.slice(0, end); this.buffer = this.buffer.slice(end + 1);
        let message: Message;
        try { message = JSON.parse(text) as Message; } catch { continue; }
        this.dispatch(message);
      }
    });
    const end = () => this.shutdown();
    output.on('close', end); output.on('error', end); input.on('error', end);
  }
  private dispatch(message: Message) {
    if (message.id !== undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}${message.error.data ? ` (${message.error.data})` : ''}`));
      else pending.resolve(message.result);
      return;
    }
    if (message.method) this.emit('event', message);
  }
  send(method: string, params: object = {}, sessionId?: string): Promise<any> {
    if (this.closed) return Promise.reject(new Error(`${method}: Target closed (Chromium has disconnected)`));
    const id = this.next++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.input.write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
    });
  }
  /** Reject what is still waiting on one session (its page closed or crashed). */
  failSession(sessionId: string, reason: string) {
    for (const [id, pending] of this.pending) if ((pending as Pending & { session?: string }).session === sessionId) { this.pending.delete(id); pending.reject(new Error(reason)); }
  }
  sendTo(sessionId: string, method: string, params: object = {}): Promise<any> {
    const promise = this.send(method, params, sessionId);
    const entry = this.pending.get(this.next - 1);
    if (entry) (entry as Pending & { session?: string }).session = sessionId;
    return promise;
  }
  shutdown() {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.pending.values()) pending.reject(new Error(`${pending.method}: Target closed (Chromium has disconnected)`));
    this.pending.clear();
    this.emit('disconnected');
  }
}

// ---------------------------------------------------------------- browser, contexts, pages

/** The switches Playwright passes to Chromium, kept so pictures stay as they were (colour profile, GPU fallback). */
const DISABLED_FEATURES = ['AvoidUnnecessaryBeforeUnloadCheckSync', 'DestroyProfileOnBrowserClose', 'DialMediaRouteProvider', 'GlobalMediaControls',
  'HttpsUpgrades', 'LensOverlay', 'MediaRouter', 'PaintHolding', 'ThirdPartyStoragePartitioning', 'Translate', 'AutoDeElevate', 'OptimizationHints',
  'NetworkTimeServiceQuerying', 'AimEnabled', 'msForceBrowserSignIn', 'msEdgeUpdateLaunchServicesPreferredVersion'];
export const BASE_SWITCHES = [
  '--disable-field-trial-config', '--disable-background-networking', '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows', '--disable-back-forward-cache', '--disable-breakpad', '--disable-client-side-phishing-detection',
  '--disable-component-extensions-with-background-pages', '--disable-component-update', '--no-default-browser-check', '--disable-default-apps',
  '--disable-dev-shm-usage', '--disable-edgeupdater', '--disable-extensions', `--disable-features=${DISABLED_FEATURES.join(',')}`,
  '--allow-pre-commit-input', '--disable-hang-monitor', '--disable-ipc-flooding-protection', '--disable-popup-blocking', '--disable-prompt-on-repost',
  '--disable-renderer-backgrounding', '--disable-updater-scheduler', '--force-color-profile=srgb', '--metrics-recording-only', '--no-first-run',
  '--password-store=basic', '--use-mock-keychain', '--no-service-autorun', '--disable-search-engine-choice-screen', '--edge-skip-compat-layer-relaunch',
  '--disable-infobars', '--disable-sync', '--enable-unsafe-swiftshader', '--headless', '--hide-scrollbars', '--mute-audio', '--no-sandbox',
  '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4',
];

export interface LaunchOptions { executable: string; args?: string[]; timeout?: number }

const live = new Set<ChildProcess>();
let exitHook = false;
function killOnExit(child: ChildProcess) {
  live.add(child);
  child.once('exit', () => live.delete(child));
  if (exitHook) return;
  exitHook = true;
  // Chromium never outlives Mografy, however Mografy ends.
  process.once('exit', () => { for (const c of live) c.kill('SIGKILL'); });
}

export class Browser extends EventEmitter {
  private contexts = new Set<BrowserContext>();
  private constructor(readonly connection: Connection, private child: ChildProcess, private profile: string, readonly version: string) {
    super();
    connection.on('disconnected', () => {
      for (const context of this.contexts) context.markClosed();
      this.emit('disconnected');
    });
    connection.on('event', (message: Message) => {
      if (message.method === 'Target.detachedFromTarget') for (const context of this.contexts) context.detached(message.params.sessionId as string);
    });
  }

  static async launch({ executable, args = [], timeout = 30_000 }: LaunchOptions): Promise<Browser> {
    const profile = await mkdtemp(join(tmpdir(), 'mografy-chromium-'));
    const child = spawn(executable, [...BASE_SWITCHES, ...args, `--user-data-dir=${profile}`, '--remote-debugging-pipe', '--no-startup-window'],
      { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'], windowsHide: true });
    killOnExit(child);
    let stderr = '';
    child.stderr!.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-4000); });
    const connection = new Connection(child.stdio[3] as Writable, child.stdio[4] as Readable);
    const failed = new Promise<never>((_, reject) => {
      child.once('error', error => reject(new Error(`Could not start ${executable}: ${error.message}`)));
      child.once('exit', code => reject(new Error(`Chromium (${executable}) exited during startup (${code}).${stderr ? `\n${stderr.trim()}` : ''}`)));
    });
    child.once('exit', () => { connection.shutdown(); void rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {}); });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Chromium (${executable}) did not start within ${timeout / 1000}s.`)), timeout); });
    try {
      const { product } = await Promise.race([connection.send('Browser.getVersion'), failed, late]) as { product: string };
      return new Browser(connection, child, profile, product);
    } catch (error) {
      child.kill('SIGKILL');
      throw error;
    } finally { clearTimeout(timer); void failed.catch(() => {}); }
  }

  isConnected() { return !this.connection.closed; }

  async newContext(options: { viewport: { width: number; height: number }; deviceScaleFactor: number }) {
    const { browserContextId } = await this.connection.send('Target.createBrowserContext', { disposeOnDetach: true }) as { browserContextId: string };
    const context = new BrowserContext(this, browserContextId, options);
    this.contexts.add(context);
    context.once('close', () => this.contexts.delete(context));
    return context;
  }

  async close() {
    if (this.connection.closed) return;
    const exited = new Promise<void>(done => { if (this.child.exitCode !== null) done(); else this.child.once('exit', () => done()); });
    await Promise.race([this.connection.send('Browser.close').catch(() => {}), new Promise(done => setTimeout(done, 3000))]);
    await Promise.race([exited, new Promise(done => setTimeout(done, 3000))]);
    if (this.child.exitCode === null) this.child.kill('SIGKILL');
    this.connection.shutdown();
  }
}

export class BrowserContext extends EventEmitter {
  private pages = new Map<string, Page>();
  private closed = false;
  constructor(readonly browser: Browser, readonly id: string, private options: { viewport: { width: number; height: number }; deviceScaleFactor: number }) { super(); }

  async newPage(): Promise<Page> {
    if (this.closed) throw new Error('newPage: Target closed (the context is closed)');
    const connection = this.browser.connection;
    const { targetId } = await connection.send('Target.createTarget', { url: 'about:blank', browserContextId: this.id }) as { targetId: string };
    const { sessionId } = await connection.send('Target.attachToTarget', { targetId, flatten: true }) as { sessionId: string };
    const page = new Page(this, targetId, sessionId);
    this.pages.set(sessionId, page);
    page.once('close', () => this.pages.delete(sessionId));
    await page.init(this.options);
    return page;
  }

  /** A page's session ended without us closing it: the renderer crashed or the target went away. */
  detached(sessionId: string) { this.pages.get(sessionId)?.markClosed('Target closed (the page went away)'); }
  markClosed() { if (this.closed) return; this.closed = true; for (const page of this.pages.values()) page.markClosed('Target closed (the context is closed)'); this.emit('close'); }

  async close() {
    if (this.closed) return;
    this.markClosed();
    await this.browser.connection.send('Target.disposeBrowserContext', { browserContextId: this.id }).catch(() => {});
  }
}

/** undefined survives the trip into the page (JSON would turn it into null inside arrays and objects). */
const UNDEFINED = '__mografyUndefined__';
const encode = (value: unknown) => JSON.stringify(value === undefined ? UNDEFINED : value, (_key, v: unknown) => v === undefined ? UNDEFINED : v);
const REVIVE = `(text => JSON.parse(text, (k, v) => v === ${JSON.stringify(UNDEFINED)} ? undefined : v))`;

export interface PageRequest { url(): string }

export class Page extends EventEmitter {
  private dead = false;
  private loads: (() => void)[] = [];
  constructor(readonly context: BrowserContext, readonly targetId: string, readonly sessionId: string) {
    super();
    const connection = context.browser.connection;
    const onEvent = (message: Message) => {
      if (message.sessionId !== this.sessionId) return;
      if (message.method === 'Page.loadEventFired') { const loads = this.loads; this.loads = []; for (const done of loads) done(); }
      else if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params.exceptionDetails as { text?: string; exception?: { description?: string; value?: unknown } };
        const text = details.exception?.description?.split('\n')[0] ?? String(details.exception?.value ?? details.text ?? 'Uncaught error');
        this.emit('pageerror', new Error(text.replace(/^[A-Za-z]*Error: /, '')));
      } else if (message.method === 'Network.requestWillBeSent') {
        const url = message.params.request.url as string;
        this.emit('request', { url: () => url } satisfies PageRequest);
      } else if (message.method === 'Inspector.targetCrashed') this.markClosed('Target crashed');
    };
    connection.on('event', onEvent);
    this.once('close', () => connection.off('event', onEvent));
  }

  private send(method: string, params: object = {}) {
    if (this.dead) return Promise.reject(new Error(`${method}: Target closed`));
    return this.context.browser.connection.sendTo(this.sessionId, method, params);
  }

  async init(options: { viewport: { width: number; height: number }; deviceScaleFactor: number }) {
    await Promise.all([
      this.send('Page.enable'), this.send('Runtime.enable'), this.send('Network.enable'),
      this.send('Emulation.setDeviceMetricsOverride', { width: options.viewport.width, height: options.viewport.height, deviceScaleFactor: options.deviceScaleFactor, mobile: false }),
      // Headless pages count as focused, so timers and animation frames run as in a visible tab.
      this.send('Emulation.setFocusEmulationEnabled', { enabled: true }),
    ]);
  }

  isClosed() { return this.dead; }
  markClosed(reason: string) {
    if (this.dead) return;
    this.dead = true;
    this.context.browser.connection.failSession(this.sessionId, reason);
    this.emit('close');
  }

  async goto(url: string, { timeout = 30_000 }: { timeout?: number } = {}) {
    const loaded = new Promise<void>(done => this.loads.push(done));
    const result = await this.send('Page.navigate', { url }) as { errorText?: string };
    if (result.errorText) throw new Error(`page.goto: ${result.errorText} at ${url}`);
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([loaded, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`page.goto: Timeout ${timeout}ms exceeded loading ${url}`)), timeout); })])
      .finally(() => clearTimeout(timer));
  }

  /** Run `fn(arg)` in the page and return its (awaited) result by value. */
  async evaluate<A, R>(fn: (arg: A) => R | Promise<R>, arg?: A): Promise<Awaited<R>> {
    const expression = `(${fn.toString()})(${REVIVE}(${JSON.stringify(encode(arg))}))`;
    const response = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }) as {
      result: { value?: unknown; type: string };
      exceptionDetails?: { text?: string; exception?: { description?: string; value?: unknown } };
    };
    if (response.exceptionDetails) {
      const details = response.exceptionDetails;
      const description = details.exception?.description ?? String(details.exception?.value ?? details.text ?? 'Evaluation failed');
      throw new Error(`page.evaluate: ${description.replace(/^[A-Za-z]*Error: /, '')}`);
    }
    return response.result.value as Awaited<R>;
  }

  /** Run a script file in the page's global scope, as a classic <script> would (tests load third-party players). */
  async addScriptTag({ path }: { path: string }) {
    const source = await readFile(path, 'utf8');
    const response = await this.send('Runtime.evaluate', { expression: `${source}\n//# sourceURL=${path}` }) as { exceptionDetails?: { text?: string } };
    if (response.exceptionDetails) throw new Error(`page.addScriptTag: ${response.exceptionDetails.text ?? 'the script threw'}`);
  }

  /** Resolve when `fn()` returns something truthy in the page. */
  async waitForFunction(fn: () => unknown, _arg?: undefined, { timeout = 30_000, polling = 50 }: { timeout?: number; polling?: number } = {}) {
    const deadline = Date.now() + timeout;
    for (;;) {
      if (await this.evaluate(fn).catch(() => false)) return;
      if (this.dead) throw new Error('page.waitForFunction: Target closed');
      if (Date.now() > deadline) throw new Error(`page.waitForFunction: Timeout ${timeout}ms exceeded.`);
      await new Promise(done => setTimeout(done, polling));
    }
  }

  async close() {
    if (this.dead) return;
    const connection = this.context.browser.connection;
    this.markClosed('Target closed (the page was closed)');
    await connection.send('Target.closeTarget', { targetId: this.targetId }).catch(() => {});
  }
}
