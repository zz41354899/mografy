// The one place that decides which Mografy checkout runs; bin/mografy.js imports it. It must stay a single file with
// no dependencies. A checkout around the current folder is used only when it was installed on
// this computer (listed in the trust file), so a downloaded folder that imitates one cannot run its code.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const real = dir => { try { return realpathSync(dir); } catch { return dir; } };
const defaultTrust = () => join(homedir(), '.mografy', 'trusted-checkouts');
const listed = (file, dir) => { try { return readFileSync(file, 'utf8').split('\n').includes(dir); } catch { return false; } };

/** The Mografy checkout containing `start`, if any: its real path, and whether it may run. */
export function checkoutAround(start, { trustFile = defaultTrust(), own } = {}) {
  for (let dir = start; ; dir = dirname(dir)) {
    let workspace;
    try { workspace = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')); } catch {}
    if (workspace?.name === 'mografy-workspace' && existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      const path = real(dir);
      return { dir, path, trusted: path === own || listed(trustFile, path) };
    }
    if (dirname(dir) === dir) return undefined;
  }
}

export const warnUntrusted = dir => console.error(`mografy: ignoring ${dir} because it was not installed on this computer. Run pnpm install there to use it.`);
