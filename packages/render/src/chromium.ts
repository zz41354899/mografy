// The Chromium that checks, reviews and exports render in (see cdp.ts for how one is chosen).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { Browser, locateBrowser } from './cdp.js';

/**
 * The Playwright release whose installer downloads the headless shell when this computer has no Chromium at all.
 * Kept in step with the playwright devDependency, so a checkout and the npm package install the same shell revision.
 */
export const PLAYWRIGHT_INSTALLER = 'playwright-core@1.64.0';

/**
 * Install (or confirm) Playwright's Chromium headless shell. A checkout uses its own Playwright; the npm package,
 * which carries none, runs the pinned installer through npx (downloaded once into npm's cache). Output goes to this
 * terminal.
 */
export function installChromiumShell(): Promise<void> {
  let cli: string | undefined;
  for (const name of ['playwright/cli.js', 'playwright-core/cli.js']) {
    try { cli = createRequire(import.meta.url).resolve(name); break; } catch { /* not installed here */ }
  }
  const [command, args] = cli
    ? [process.execPath, [cli, 'install', 'chromium', '--only-shell']]
    : [process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', PLAYWRIGHT_INSTALLER, 'install', 'chromium', '--only-shell']];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', windowsHide: true, shell: process.platform === 'win32' && !cli });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error(`Installing the Chromium headless shell failed (${code}).`)));
  });
}

/** Whether a headless Chromium starts, and which one. */
export async function chromiumWorks(): Promise<{ ok: boolean; detail: string }> {
  const { found, looked } = locateBrowser();
  if (!found.length) return { ok: false, detail: `none found (looked at ${looked.join(', ')})` };
  const candidate = found[0]!;
  try {
    const browser = await Browser.launch({ executable: candidate.path });
    const detail = `${candidate.kind === 'shell' ? 'headless shell' : candidate.kind} ${browser.version} (${candidate.path})`;
    await browser.close();
    return { ok: true, detail };
  } catch (error) {
    return { ok: false, detail: String((error as Error).message).split('\n')[0]! };
  }
}
