import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import type { Browser } from 'playwright';
import { createProject, startServer, TEMPLATE_DIR } from '@mografy/server';
import type { RunningServer } from '@mografy/server';

/** Each case owns its project, installation state, server, and browser. */
export async function browserFixture() {
  const previousHome = process.env.MOGRAFY_HOME, previousState = process.env.MOGRAFY_STATE;
  const sandbox = await realpath(await mkdtemp(join(tmpdir(), 'mografy-e2e-')));
  process.env.MOGRAFY_HOME = join(sandbox, 'library');
  process.env.MOGRAFY_STATE = join(sandbox, 'state');
  let server: RunningServer | undefined, browser: Browser | undefined;
  const close = async () => {
    try { await browser?.close(); await server?.close(); }
    finally {
      await rm(sandbox, { recursive: true, force: true });
      if (previousHome === undefined) delete process.env.MOGRAFY_HOME; else process.env.MOGRAFY_HOME = previousHome;
      if (previousState === undefined) delete process.env.MOGRAFY_STATE; else process.env.MOGRAFY_STATE = previousState;
    }
  };
  try {
    const dir = join(sandbox, 'first');
    await createProject(dir, 'First', await readFile(join(TEMPLATE_DIR, 'scenes/lower-third.ts'), 'utf8'));
    server = await startServer(dir, { port: 0 });
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', error => console.error('pageerror', error.message));
    await page.goto(server.url);
    await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-testid=stage]')?.dataset.version, null, { timeout: 20_000 });
    const url = server.url;
    const api = async (path: string, method = 'GET', body?: unknown) => {
      const response = await fetch(new URL(`/__mografy/${path}`, url), { method, ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
      return { status: response.status, data: await response.json() as any };
    };
    const stage = () => page.evaluate(() => {
      const element = document.querySelector<HTMLElement>('[data-testid=stage]')!;
      return { version: element.dataset.version!, t: Number(element.dataset.time) };
    });
    const banner = () => page.locator('.notice.error').count();
    return { dir, sandbox, server, browser, page, api, stage, banner, close };
  } catch (error) { await close(); throw error; }
}

export type BrowserFixture = Awaited<ReturnType<typeof browserFixture>>;
