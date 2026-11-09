#!/usr/bin/env node
import { existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkoutAround, warnUntrusted } from './locate.mjs';

// A PATH launcher may belong to an older clone. Prefer the checkout the user is working in, including when invoked from
// one of its animation subfolders, but only one installed on this computer, never a folder imitating one.
let entry = new URL('../dist/index.js', import.meta.url);
const found = checkoutAround(process.cwd(), { own: realpathSync(fileURLToPath(new URL('../../..', import.meta.url))) });
if (found?.trusted) {
  const local = join(found.path, 'packages/cli/dist/index.js');
  if (!existsSync(local)) {
    console.error(`Mografy has not been built in ${found.path}. Run pnpm install && pnpm build in that checkout.`);
    process.exit(1);
  }
  entry = pathToFileURL(local);
} else if (found && !process.env.MOGRAFY_CHECKOUT_CHECKED) warnUntrusted(found.dir);

import(entry.href).then(({ main }) => main()).catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
