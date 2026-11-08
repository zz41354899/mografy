// Showcase films: finished reference films that are not part of the installation. They live on the website's
// showcase (https://www.mografy.app/showcase), each as a zip of its project, and `mografy add <name> [folder]`
// downloads one into the library. The catalog below works offline; the website also serves it as films.json.
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { libraryDir } from '@mografy/server';
import { displayPath } from './paths.js';

export const SHOWCASE_URL = (process.env.MOGRAFY_SHOWCASE_URL ?? 'https://www.mografy.app/showcase').replace(/\/$/, '');
export const filmUrl = (name: string) => `${SHOWCASE_URL}/films/${name}.zip`;

export interface ShowcaseFilm { name: string; summary: string }
/** Keep in step with the website's apps/web/app/data/showcase-films.ts (the same names, the same order). */
export const SHOWCASE: readonly ShowcaseFilm[] = [
  { name: 'film-starter', summary: '20 s model film to start from: one camera, one shot table, a light that becomes a card, a ring, a full stop' },
  { name: 'mografy-montage', summary: '60 s promo in one continuous camera: a comet draws act I, a 3D window, neon type, a galaxy, the logo' },
  { name: 'mografy-triangulum', summary: '42 s launch teaser: a Three.js galaxy, a timeline drawn by light, depth of field, glass cards' },
  { name: 'mografy-story', summary: '71 s story film in Traditional Chinese: dark to light, a black box that opens, product UI, captions' },
  { name: 'analytics-product', summary: '8 s UI loop: a click switches the week and a dashboard chart and number update, with a gentle push-in' },
  { name: 'follow-interaction', summary: '8 s UI loop: a cursor clicks Follow, the button springs into Following, a quiet confirmation' },
  { name: 'mografy-brand', summary: '8 s logo reveal: a teal stroke draws the ribbon, the arches rise, the wordmark follows' },
  { name: 'paper-theatre-shadow', summary: '82 s paper theatre explainer (繁中, narrated): one lamp, real 3D shadows, stop-motion on 2s, three acts' },
  { name: 'paper-theatre-gestalt', summary: '78 s paper theatre explainer: card fragments whose shadows lock into a face, six laws in an ink act' },
  { name: 'paper-theatre-aesthetic-usability', summary: '74 s paper theatre explainer: two cardboard ATMs, 2D screens inside a 3D theatre' },
  { name: 'paper-theatre-ringelmann', summary: '75 s paper theatre explainer: one rope, a brass dial, a 3D needle against a 2D target' },
  { name: 'paper-theatre-adhd', summary: '85 s paper theatre explainer: a spotlight on a track against the 2D ring the puppet wants to look at' },
  { name: 'paper-theatre-moon-rabbit-opera', summary: '60 s 3D opera house × 2D inserts: a paper toy theatre lit in Three.js, kamishibai cards, curtain call' },
  { name: 'paper-theatre-sea-moon', summary: '72 s full 3D undersea castle: a paper puppet on threads, cards swapped by emotion, umbrella becomes a jellyfish' },
];
export const isShowcaseFilm = (name: string) => SHOWCASE.some(film => film.name === name);

export function showcaseList() {
  const width = Math.max(...SHOWCASE.map(film => film.name.length));
  return SHOWCASE.map(film => `  ${film.name.padEnd(width)}  ${film.summary}`).join('\n');
}

// ---------------------------------------------------------------- zip

/**
 * The entries of a zip archive (stored or deflated), read from its central directory. Paths are normalised and must
 * stay inside the archive: an absolute path or a `..` segment is refused, so an archive cannot write outside its folder.
 */
export function readZip(zip: Buffer): { path: string; data: Buffer }[] {
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) if (zip.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('Not a zip archive (no end of central directory).');
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const out: { path: string; data: Buffer }[] = [];
  for (let n = 0; n < count; n++) {
    if (zip.readUInt32LE(at) !== 0x02014b50) throw new Error('Damaged zip archive (central directory).');
    const method = zip.readUInt16LE(at + 10), size = zip.readUInt32LE(at + 20), nameLength = zip.readUInt16LE(at + 28);
    const extra = zip.readUInt16LE(at + 30), comment = zip.readUInt16LE(at + 32), local = zip.readUInt32LE(at + 42);
    const path = zip.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    at += 46 + nameLength + extra + comment;
    if (path.endsWith('/')) continue;
    const clean = normalize(path).replaceAll('\\', '/');
    if (clean.startsWith('/') || clean.split('/').includes('..') || /^[a-z]:/i.test(clean)) throw new Error(`Refusing a zip entry outside its folder: ${path}`);
    if (zip.readUInt32LE(local) !== 0x04034b50) throw new Error('Damaged zip archive (local header).');
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28), raw = zip.subarray(start, start + size);
    if (method !== 0 && method !== 8) throw new Error(`Unsupported zip compression (${method}) in ${path}.`);
    out.push({ path: clean, data: method === 8 ? inflateRawSync(raw) : Buffer.from(raw) });
  }
  return out;
}

/** Write a zip's files into `dest`, dropping one top-level folder when every entry shares it (`<name>/…`). */
export async function extractZip(zip: Buffer, dest: string) {
  const entries = readZip(zip);
  const tops = new Set(entries.map(e => e.path.split('/')[0]));
  const strip = tops.size === 1 && entries.every(e => e.path.includes('/'));
  for (const entry of entries) {
    const rel = strip ? entry.path.slice(entry.path.indexOf('/') + 1) : entry.path, file = resolve(dest, rel);
    if (!file.startsWith(resolve(dest) + sep)) throw new Error(`Refusing a zip entry outside its folder: ${entry.path}`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, entry.data);
  }
  return entries.length;
}

// ---------------------------------------------------------------- install

/** Download a showcase film into `target` (default: the library's <name>). Never overwrites an existing folder. */
export async function installShowcase(name: string, target?: string, fetchImpl: typeof fetch = fetch) {
  if (!isShowcaseFilm(name)) throw new Error(`Unknown showcase film: ${name}\nShowcase films:\n${showcaseList()}`);
  const dest = resolve(target ?? join(libraryDir(), name));
  if (await readdir(dest).then(() => true, () => false)) throw new Error(`${displayPath(dest)} already exists. Pass another folder: mografy add ${name} <folder>`);
  const url = filmUrl(name);
  console.log(`Downloading ${name} from ${url}…`);
  const response = await fetchImpl(url).catch(error => { throw new Error(`Could not download ${name}: ${(error as Error).message}. Check the connection, or get it from ${SHOWCASE_URL}`); });
  if (!response.ok) throw new Error(`Could not download ${name} (${response.status}). See ${SHOWCASE_URL}`);
  const zip = Buffer.from(await response.arrayBuffer());
  await mkdir(dest, { recursive: true });
  const files = await extractZip(zip, dest);
  if (!await readdir(dest).then(list => list.includes('mografy.json'), () => false)) throw new Error(`${name} downloaded, but it has no mografy.json; the archive may be damaged.`);
  return { dest, files, bytes: zip.length };
}

export function printShowcase(name: string, dest: string, bytes: number) {
  console.log(`Downloaded the showcase film ${name} (${(bytes / 1048576).toFixed(1)} MB) to ${displayPath(dest)}`);
  console.log(`\nWatch it:   mografy dev ${displayPath(dest)}\nRead first: scenes/ and style.md, then .agents/skills/mografy/references/examples.md`);
}
