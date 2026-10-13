#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// A PATH launcher may belong to an older clone. Prefer the checkout the user is
// working in, including when invoked from one of its animation subfolders.
let entry = new URL('../dist/index.js', import.meta.url);
for (let dir = process.cwd(); ; dir = dirname(dir)) {
  let workspace;
  try { workspace = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')); } catch {}
  if (workspace?.name === 'mografy-workspace' && existsSync(join(dir, 'pnpm-workspace.yaml'))) {
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
