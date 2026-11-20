// `mografy update` for the npm package: npm owns the installed files, so Mografy checks the registry and says which
// command updates it, instead of replacing its own files while they run (Windows keeps running files locked).
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { installation } from '@mografy/server';

export const REGISTRY = (process.env.MOGRAFY_NPM_REGISTRY ?? 'https://registry.npmjs.org').replace(/\/$/, '');

/** Compare dotted versions with an optional pre-release (`0.2.0-beta.1`); a release sorts after its pre-releases. */
export function newerVersion(latest: string, current: string) {
  const parse = (v: string) => { const [main, pre] = v.split('-', 2); return { parts: main!.split('.').map(Number), pre }; };
  const a = parse(latest), b = parse(current);
  for (let i = 0; i < 3; i++) if ((a.parts[i] ?? 0) !== (b.parts[i] ?? 0)) return (a.parts[i] ?? 0) > (b.parts[i] ?? 0);
  if (a.pre === b.pre) return false;
  if (!a.pre) return true;
  if (!b.pre) return false;
  return a.pre.localeCompare(b.pre, undefined, { numeric: true }) > 0;
}

export async function packageUpdate(checkOnly: boolean, fetchImpl: typeof fetch = fetch, log = console.log) {
  const current = (JSON.parse(await readFile(join(installation.root, 'package.json'), 'utf8')) as { version: string }).version;
  const channel = current.includes('-') ? 'beta' : 'latest';
  const response = await fetchImpl(`${REGISTRY}/mografy/${channel}`).catch(error => { throw new Error(`Could not reach the npm registry: ${(error as Error).message}`); });
  if (!response.ok) throw new Error(`Could not read the latest Mografy version from the npm registry (${response.status}${response.status === 404 ? `: no ${channel} release is published` : ''}).`);
  const latest = (await response.json() as { version: string }).version;
  if (!newerVersion(latest, current)) { log(`Mografy ${current} is up to date.`); return; }
  log(`Mografy ${latest} is available (installed: ${current}).`);
  if (checkOnly) return;
  log(`Stop the player (mografy stop), then run:\n  npm install -g mografy@${channel}\nYour projects in ${join('~', 'Mografy')} stay as they are.`);
}
