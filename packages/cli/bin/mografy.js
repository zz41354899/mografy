#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// A PATH launcher may belong to an older clone. Prefer the checkout the user is
// working in, including when invoked from one of its animation subfolders, but only
// one installed on this computer (listed by install-command), never a folder imitating one.
let entry = new URL('../dist/index.js', import.meta.url);
const real = dir => { try { return realpathSync(dir); } catch { return dir; } };
const own = real(fileURLToPath(new URL('../../..', import.meta.url)));
const trusted = dir => dir === own || (() => {
  try { return readFileSync(join(homedir(), '.mografy', 'trusted-checkouts'), 'utf8').split('\n').includes(dir); } catch { return false; }
})();
for (let dir = process.cwd(); ; dir = dirname(dir)) {
  let workspace;
  try { workspace = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')); } catch {}
  if (workspace?.name === 'mografy-workspace' && existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    if (!trusted(real(dir))) {
      console.error(`mografy: ignoring ${dir} because it was not installed on this computer. Run pnpm install there to use it.`);
      break;
    }
    const local = join(dir, 'packages/cli/dist/index.js');
    if (!existsSync(local)) {
      console.error(`Mografy has not been built in ${dir}. Run pnpm install && pnpm build in that checkout.`);
      process.exit(1);
    }
    entry = pathToFileURL(local);
    break;
  }
  if (dirname(dir) === dir) break;
}

import(entry.href).then(({ main }) => main()).catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
