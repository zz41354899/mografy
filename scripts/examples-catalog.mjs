// `pnpm examples:sync`: write examples/catalog.json, the list of reference films and their tracked files.
// A default installation checks out only this catalog (and the intro); `mografy add <film>` downloads the rest
// from GitHub with it. `--check` fails instead of writing when the catalog is out of date (used by the tests).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tracked = execFileSync('git', ['ls-files', '-z', '--', 'examples'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
const byFilm = new Map();
for (const path of tracked) {
  const [, name, ...rest] = path.split('/');
  if (!rest.length) continue;
  if (!byFilm.has(name)) byFilm.set(name, []);
  byFilm.get(name).push(rest.join('/'));
}
const examples = [...byFilm].filter(([, files]) => files.includes('mografy.json')).sort(([a], [b]) => a.localeCompare(b)).map(([name, files]) => ({
  name,
  title: JSON.parse(readFileSync(join(root, 'examples', name, 'mografy.json'), 'utf8')).name ?? name,
  files: files.sort(),
}));
const text = JSON.stringify({ generated: 'pnpm examples:sync — do not edit by hand', examples }, null, 2) + '\n';
const file = join(root, 'examples', 'catalog.json');
if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(file, 'utf8'); } catch {}
  if (current !== text) { console.error('examples/catalog.json is out of date. Run pnpm examples:sync and commit it.'); process.exit(1); }
  console.log(`examples/catalog.json lists ${examples.length} films.`);
} else {
  writeFileSync(file, text);
  console.log(`Wrote examples/catalog.json (${examples.length} films, ${examples.reduce((n, e) => n + e.files.length, 0)} files).`);
}
