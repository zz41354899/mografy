// Playwright's headless Chromium shell: what checks, reviews and exports render in.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

/** Install (or confirm) the headless shell with Playwright's own installer. Output goes to this terminal. */
export function installChromiumShell(): Promise<void> {
  const cli = createRequire(import.meta.url).resolve('playwright/cli.js');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'install', 'chromium', '--only-shell'], { stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error(`Installing the Chromium headless shell failed (${code}).`)));
  });
}

/** Whether a headless Chromium starts: Playwright's shell, or the browser PLAYWRIGHT_CHANNEL names. */
export async function chromiumWorks(): Promise<{ ok: boolean; detail: string }> {
  const channel = process.env.PLAYWRIGHT_CHANNEL;
  try {
    const browser = await chromium.launch(channel ? { channel } : {});
    const detail = `${channel ?? 'headless shell'} ${browser.version()}`;
    await browser.close();
    return { ok: true, detail };
  } catch (error) {
    return { ok: false, detail: String((error as Error).message).split('\n')[0]! };
  }
}
