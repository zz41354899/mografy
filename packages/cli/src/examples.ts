// `mografy add <film>`: copy a finished reference film from examples/ into the library, to watch, study or build on.
// The films stay untouched in examples/ (the player lists them there); the copy is the user's own project.
// A default installation checks out only examples/catalog.json and the intro; every other film in the catalog is
// downloaded from the same repository on GitHub, file by file, the first time it is added.
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { EXAMPLES_DIR, isProject, libraryDir } from '@mografy/server';
import { downloadRepoFile } from './github.js';
import { displayPath } from './paths.js';

/**
 * The films installed with Mografy, in the order the Skill recommends reading them; other folders in examples/ are
 * listed after. Longer reference films live on the website's showcase and are downloaded by name (showcase.ts).
 */
const CURATED: Record<string, string> = {
  'stage-invoices': '7 s Stage loop: a window off two edges, Mark paid flies the amount into a rolling total, Undo resets; Variant param shows the five failures',
  'stage-phone': '7.6 s 9:16 Stage loop: a lock-screen notification grows into the thread, a reply is typed, the side button locks',
  'stage-dashboard': '6.5 s Stage loop, dark: the cursor finds a spike, a tooltip, one annotation, the camera leans in and back',
  'stage-bento': '5.7 s Stage loop, dark bento planned as one picture: keys, a task done, a count that rolls, a diagram; no cursor',
  'stage-calendar': '7.5 s Stage loop: a meeting dragged to Wednesday, the target jumps cell to cell, attendees confirm, dragged back',
  'stage-upload': '7.4 s Stage loop, blueprint API diagram: a file becomes a link, one annotation per hop; no cursor',
  'stage-command': '6.5 s Stage loop, keyboard only: ⌘K, type, ↵ assigns and the avatar flies in, ⌘Z undoes',
  'stage-checkout': '9 s Stage loop in a browser with tabs: type an email, Pay with a spinner, a check draws, Done resets',
  'stage-request': '10 s Stage loop on two screens: a web request arrives on a cropped phone, two taps pay, the web total rolls',
  'stage-snooze': '8 s Stage feature card: hover actions, a snooze menu, the row leaves and the list closes up, Undo',
  'mografy-intro': '12 s product intro: typing, scrubbing, an edit that updates the player, the logo',
};
/** Never copied: the player's caches and earlier exports. */
const SKIP = new Set(['.mografy', 'renders', 'node_modules', '.DS_Store']);

export interface ExampleInfo { name: string; title: string; summary?: string; /** In this checkout's examples/. */ installed: boolean }
/** One film in examples/catalog.json: its files, relative to examples/<name>/. */
export interface CatalogExample { name: string; title: string; files: string[] }

const safeName = (name: string) => /^[a-z0-9][a-z0-9-]*$/.test(name);
const safeFile = (file: string) => !file.startsWith('/') && !file.includes('\\') && !file.split('/').some(part => !part || part === '.' || part === '..');

let catalogCache: Promise<CatalogExample[]> | undefined;
/** examples/catalog.json from this checkout, or from GitHub; empty when neither can be read. */
export function exampleCatalog(fetchImpl: typeof fetch = fetch): Promise<CatalogExample[]> {
  return catalogCache ??= (async () => {
    const data = await readFile(join(EXAMPLES_DIR, 'catalog.json')).catch(() => downloadRepoFile('examples/catalog.json', fetchImpl)).catch(() => undefined);
    if (!data) return [];
    const list = (JSON.parse(data.toString('utf8')) as { examples?: CatalogExample[] }).examples ?? [];
    return list.filter(e => safeName(e.name) && Array.isArray(e.files) && e.files.every(safeFile));
  })();
}
/** Forget the cached catalog (tests). */
export function resetExampleCatalog() { catalogCache = undefined; }

export async function listExamples(): Promise<ExampleInfo[]> {
  const entries = await readdir(EXAMPLES_DIR, { withFileTypes: true }).catch(() => []);
  const found: ExampleInfo[] = [];
  const summary = (name: string) => CURATED[name] ? { summary: CURATED[name] } : {};
  for (const entry of entries) {
    const dir = join(EXAMPLES_DIR, entry.name);
    if (!entry.isDirectory() || entry.name.startsWith('.') || !await isProject(dir)) continue;
    const manifest = JSON.parse(await readFile(join(dir, 'mografy.json'), 'utf8')) as { name?: string };
    found.push({ name: entry.name, title: manifest.name ?? entry.name, ...summary(entry.name), installed: true });
  }
  for (const entry of await exampleCatalog())
    if (!found.some(e => e.name === entry.name)) found.push({ name: entry.name, title: entry.title, ...summary(entry.name), installed: false });
  const order = Object.keys(CURATED);
  const rank = (name: string) => { const i = order.indexOf(name); return i < 0 ? order.length : i; };
  return found.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}

export async function examplesList() {
  const list = await listExamples();
  if (!list.length) return '  (no reference films found)';
  const width = Math.max(...list.map(e => e.name.length));
  return list.map(e => `  ${e.name.padEnd(width)}  ${e.summary ?? e.title}${e.installed ? '' : ' (from GitHub)'}`).join('\n');
}

/** Copy examples/<name> to `target` (default: the library's <name>). Never overwrites an existing folder. */
export async function copyExample(name: string, target?: string) {
  const list = await listExamples();
  const film = list.find(e => e.name === name);
  if (!film) throw new Error(`Unknown example: ${name}\nAvailable examples:\n${await examplesList()}`);
  const dest = resolve(target ?? join(libraryDir(), name));
  if (await readdir(dest).then(() => true, () => false)) throw new Error(`${displayPath(dest)} already exists. Pass another folder: mografy add ${name} <folder>`);
  if (film.installed) await cp(join(EXAMPLES_DIR, name), dest, { recursive: true, errorOnExist: true, filter: source => !SKIP.has(basename(source)) });
  else await downloadExample(name, dest);
  return dest;
}

/** Download a catalog film from GitHub into `dest` (which must not exist yet). A failed download leaves nothing behind. */
export async function downloadExample(name: string, dest: string, fetchImpl: typeof fetch = fetch) {
  const entry = (await exampleCatalog(fetchImpl)).find(e => e.name === name);
  if (!entry) throw new Error(`${name} is not in examples/catalog.json.`);
  console.log(`Downloading ${name} (${entry.files.length} files) from GitHub…`);
  await mkdir(dest, { recursive: true });
  try {
    const queue = [...entry.files];
    let failed = false;
    const worker = async () => {
      for (let file = queue.shift(); file !== undefined && !failed; file = queue.shift()) {
        const target = resolve(dest, ...file.split('/'));
        if (!target.startsWith(resolve(dest) + sep)) throw new Error(`Refusing a catalog file outside its folder: ${file}`);
        const data = await downloadRepoFile(`examples/${name}/${file}`, fetchImpl);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, data);
      }
    };
    // Every worker settles before a failure cleans up, so none writes into the folder after it is removed.
    const results = await Promise.allSettled(Array.from({ length: Math.min(6, entry.files.length) }, () => worker().catch(error => { failed = true; throw error; })));
    const failure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failure) throw failure.reason;
    if (!await isProject(dest)) throw new Error(`${name} downloaded, but it has no mografy.json; the catalog may be out of date.`);
  } catch (error) {
    await rm(dest, { recursive: true, force: true });
    throw error;
  }
}

export function printExample(name: string, dest: string) {
  console.log(`Copied the reference film ${name} to ${displayPath(dest)}`);
  console.log(`\nWatch it:   mografy dev ${displayPath(dest)}\nRead first: scenes/ (the shot table, the camera, the drawing), then references/examples.md in the Mografy Skill`);
}
