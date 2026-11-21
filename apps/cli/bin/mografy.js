#!/usr/bin/env node
// The `mografy` command of the npm package. Inside a Mografy checkout that was installed on this computer, that
// checkout runs instead (the same rule as the PATH launcher), so working on Mografy itself never uses a stale package.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkoutAround, warnUntrusted } from '../lib/node_modules/@mografy/cli/bin/locate.mjs';

let entry = new URL('../lib/node_modules/@mografy/cli/dist/index.js', import.meta.url);
const found = checkoutAround(process.cwd());
if (found?.trusted && existsSync(join(found.path, 'packages/cli/dist/index.js'))) entry = pathToFileURL(join(found.path, 'packages/cli/dist/index.js'));
else if (found && !found.trusted && !process.env.MOGRAFY_CHECKOUT_CHECKED) warnUntrusted(found.dir);

import(entry.href).then(({ main }) => main()).catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
