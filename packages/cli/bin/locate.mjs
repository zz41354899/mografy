// The one place that decides which Mografy checkout runs. bin/mografy.js imports it, and `mografy install-command`
// copies it beside the trust list so the PATH launchers still work when the checkout they came from is gone. It must
// stay a single file with no dependencies. A checkout around the current folder is used only when it was installed on
// this computer (listed in the trust file), so a downloaded folder that imitates one cannot run its code.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

/** Launcher entry: `node locate.mjs --launch <installed bin> <trust file> [mografy arguments]`. */
async function launch([installedBin, trustFile, ...args]) {
  const found = checkoutAround(process.cwd(), { trustFile });
  let bin;
  if (found?.trusted) { const local = join(found.path, 'packages/cli/bin/mografy.js'); if (existsSync(local)) bin = local; }
  else if (found) warnUntrusted(found.dir);
  if (!bin && existsSync(installedBin)) bin = installedBin;
  if (!bin) {
    console.error(`mografy: the Mografy folder this command was installed from no longer exists:\n  ${installedBin}\nRun mografy from inside your Mografy folder, or repair this command once from there:\n  node packages/cli/bin/mografy.js install-command`);
    process.exit(1);
  }
  process.argv = [process.argv[0], bin, ...args];
  process.env.MOGRAFY_CHECKOUT_CHECKED = '1';
  await import(pathToFileURL(bin).href);
}

if (process.argv[2] === '--launch' && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) await launch(process.argv.slice(3));
