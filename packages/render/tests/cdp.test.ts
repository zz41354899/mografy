import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { headlessShells, locateBrowser, playwrightCache, systemBrowsers } from '../src/cdp.js';

async function file(path: string) { await mkdir(join(path, '..'), { recursive: true }); await writeFile(path, ''); await chmod(path, 0o755); }

test('Playwright keeps its browsers in a per-platform cache, unless PLAYWRIGHT_BROWSERS_PATH says otherwise', () => {
  assert.equal(playwrightCache('darwin', {}, '/Users/a'), join('/Users/a', 'Library', 'Caches', 'ms-playwright'));
  assert.equal(playwrightCache('linux', {}, '/home/a'), join('/home/a', '.cache', 'ms-playwright'));
  assert.equal(playwrightCache('win32', { LOCALAPPDATA: 'C:\\L' }, 'C:\\U'), join('C:\\L', 'ms-playwright'));
  assert.equal(playwrightCache('linux', { PLAYWRIGHT_BROWSERS_PATH: '/x' }, '/home/a'), '/x');
});

test('the newest complete headless shell wins; an unfinished download is skipped', async () => {
  const cache = await mkdtemp(join(tmpdir(), 'mografy-pw-'));
  try {
    const env = { PLAYWRIGHT_BROWSERS_PATH: cache };
    await file(join(cache, 'chromium_headless_shell-1200', 'chrome-headless-shell-linux64', 'chrome-headless-shell'));
    await writeFile(join(cache, 'chromium_headless_shell-1200', 'INSTALLATION_COMPLETE'), '');
    await file(join(cache, 'chromium_headless_shell-1248', 'chrome-headless-shell-linux64', 'chrome-headless-shell'));
    await writeFile(join(cache, 'chromium_headless_shell-1248', 'INSTALLATION_COMPLETE'), '');
    await file(join(cache, 'chromium_headless_shell-1300', 'chrome-headless-shell-linux64', 'chrome-headless-shell'));
    // An older layout (chrome-linux/headless_shell) is found too.
    await file(join(cache, 'chromium_headless_shell-1100', 'chrome-linux', 'headless_shell'));
    await writeFile(join(cache, 'chromium_headless_shell-1100', 'INSTALLATION_COMPLETE'), '');
    assert.deepEqual(headlessShells('linux', env), [
      join(cache, 'chromium_headless_shell-1248', 'chrome-headless-shell-linux64', 'chrome-headless-shell'),
      join(cache, 'chromium_headless_shell-1200', 'chrome-headless-shell-linux64', 'chrome-headless-shell'),
      join(cache, 'chromium_headless_shell-1100', 'chrome-linux', 'headless_shell'),
    ]);
  } finally { await rm(cache, { recursive: true, force: true }); }
});

test('without a shell the system Chrome or Edge is used; PLAYWRIGHT_CHANNEL and MOGRAFY_BROWSER choose one', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-browsers-'));
  try {
    const bin = join(dir, 'bin'), cache = join(dir, 'empty-cache');
    await file(join(bin, 'google-chrome')); await file(join(bin, 'microsoft-edge'));
    const env = { PATH: bin, PLAYWRIGHT_BROWSERS_PATH: cache };
    // Only the fake browsers: this machine may have a real one in /opt/google/chrome.
    const kinds = (e: NodeJS.ProcessEnv) => locateBrowser('linux', e, dir).found.filter(c => c.path.startsWith(dir)).map(c => c.kind);
    assert.deepEqual(kinds(env), ['chrome', 'msedge']);
    assert.deepEqual(kinds({ ...env, PLAYWRIGHT_CHANNEL: 'msedge' }), ['msedge']);
    assert.deepEqual(locateBrowser('linux', { ...env, MOGRAFY_BROWSER: join(bin, 'microsoft-edge') }, dir).found, [{ kind: 'custom', path: join(bin, 'microsoft-edge') }]);
    const none = locateBrowser('linux', { PATH: join(dir, 'nothing'), PLAYWRIGHT_BROWSERS_PATH: cache }, dir);
    assert.deepEqual(none.found.filter(c => c.path.startsWith(dir)), []);
    assert.ok(none.looked.some(p => p.includes('chromium_headless_shell-*')), 'the error can say where it looked');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('macOS and Windows look where Chrome and Edge install themselves', () => {
  const mac = systemBrowsers('darwin', {}, '/Users/a').map(c => c.path);
  assert.ok(mac.includes('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'));
  assert.ok(mac.includes('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'));
  const win = systemBrowsers('win32', { PROGRAMFILES: 'C:\\P', 'PROGRAMFILES(X86)': 'C:\\P86', LOCALAPPDATA: 'C:\\L' }, 'C:\\U').map(c => c.path);
  assert.ok(win.includes(join('C:\\P', 'Google', 'Chrome', 'Application', 'chrome.exe')));
  assert.ok(win.includes(join('C:\\P86', 'Microsoft', 'Edge', 'Application', 'msedge.exe')));
});
