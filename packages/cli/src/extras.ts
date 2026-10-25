// `mografy add <helper>`: copy an optional helper (cinema, cjk, three, music, walkthrough) into a project.
// Extras are not part of the installed template. They come from this checkout's extras/ folder,
// or from GitHub when the folder is missing, so an installation stays at the sixteen built-in components.
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { displayPath } from './paths.js';

const GITHUB = 'https://raw.githubusercontent.com/zz41354899/mografy/main/extras/';

interface FontEntry { family: string; path: string; weight: number }
export interface Extra {
  summary: string;
  /** [source under extras/, destination in the project]. */
  files: [string, string][];
  /** Registered under `fonts` in mografy.json when missing. */
  fonts?: FontEntry[];
  reference: string;
  next: string;
}
export const EXTRAS: Record<string, Extra> = {
  cinema: {
    summary: 'Camera moves on stills, transitions and atmosphere',
    files: [['cinema/cinema.ts', 'scenes/cinema.ts']],
    reference: 'camera-transitions.md',
    next: "import { plate, move, crossfade, iris, particleWipe, drift } from './cinema.js';",
  },
  cjk: {
    summary: 'Chinese and Japanese typography, vertical text and two Noto CJK subsets (about 9.5 MB)',
    files: [
      ['cjk/cjk.ts', 'scenes/cjk.ts'],
      ['cjk/fonts/NotoSansCJKtc-Medium-subset.otf', 'assets/NotoSansCJKtc-Medium-subset.otf'],
      ['cjk/fonts/NotoSerifCJKtc-Bold-subset.otf', 'assets/NotoSerifCJKtc-Bold-subset.otf'],
      ['cjk/fonts/OFL.txt', 'assets/OFL-NotoCJK.txt'],
    ],
    fonts: [
      { family: 'Noto Sans CJK TC', path: 'assets/NotoSansCJKtc-Medium-subset.otf', weight: 500 },
      { family: 'Noto Serif CJK TC', path: 'assets/NotoSerifCJKtc-Bold-subset.otf', weight: 700 },
    ],
    reference: 'cjk-typography.md',
    next: "import { cjkText, verticalText, CJK_SANS, CJK_SERIF } from './cjk.js';",
  },
  three: {
    summary: '3D layers with Three.js r186 (about 0.8 MB)',
    files: [['three/three.ts', 'scenes/three.ts'], ['three/three.module.js', 'assets/three.module.js'], ['three/LICENSE-three.txt', 'assets/LICENSE-three.txt']],
    reference: 'three-d.md',
    next: "import { prepareStage, stage, orbit, studioLight } from './three.js';",
  },
  music: {
    summary: 'Contextual score generator (Python 3 with numpy, ffmpeg for MP3)',
    files: [['music/score.py', 'music-src/score.py'], ['music/music-example.json', 'music-src/music.json']],
    reference: 'music.md',
    next: 'Write music-src/music.json from the film, then: python3 music-src/score.py music-src/music.json assets/music.mp3',
  },
  walkthrough: {
    summary: 'Product walkthroughs: redrawn app screens, cameras, cursor and taps',
    files: [['walkthrough/walkthrough.ts', 'scenes/walkthrough.ts']],
    reference: 'product-walkthrough.md',
    next: "import { createKit, camAt, withCamera, cursorAt, drawCursor } from './walkthrough.js';",
  },
};

export function extrasList() {
  const width = Math.max(...Object.keys(EXTRAS).map(name => name.length));
  return Object.entries(EXTRAS).map(([name, extra]) => `  ${name.padEnd(width)}  ${extra.summary}`).join('\n');
}

const exists = (file: string) => access(file).then(() => true, () => false);

async function source(workspaceRoot: string, path: string): Promise<Buffer> {
  const local = join(workspaceRoot, 'extras', path);
  if (await exists(local)) return readFile(local);
  const response = await fetch(GITHUB + path).catch(error => { throw new Error(`Could not download ${path}: ${(error as Error).message}`); });
  if (!response.ok) throw new Error(`Could not download ${path} (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

export interface AddResult { written: string[]; unchanged: string[]; kept: string[]; fonts: string[] }

/** Copy an extra into `dir`. Files that differ from the extra are kept unless `force` is set. */
export async function addExtra(workspaceRoot: string, dir: string, name: string, force = false): Promise<AddResult> {
  const extra = EXTRAS[name];
  if (!extra) throw new Error(`Unknown helper: ${name}\nAvailable helpers:\n${extrasList()}`);
  const result: AddResult = { written: [], unchanged: [], kept: [], fonts: [] };
  for (const [from, to] of extra.files) {
    const target = join(dir, to), data = await source(workspaceRoot, from);
    const current = await readFile(target).catch(() => undefined);
    if (current?.equals(data)) { result.unchanged.push(to); continue; }
    if (current && !force) { result.kept.push(to); continue; }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
    result.written.push(to);
  }
  if (extra.fonts?.length) {
    const file = join(dir, 'mografy.json');
    const project = JSON.parse(await readFile(file, 'utf8')) as { fonts?: FontEntry[] };
    const fonts = project.fonts ?? [];
    for (const font of extra.fonts) {
      if (fonts.some(f => f.path === font.path)) continue;
      fonts.push(font); result.fonts.push(`${font.family} ${font.weight}`);
    }
    if (result.fonts.length) { project.fonts = fonts; await writeFile(file, JSON.stringify(project, null, 2) + '\n'); }
  }
  return result;
}

export function printAdd(name: string, dir: string, result: AddResult) {
  const extra = EXTRAS[name]!;
  console.log(`Added ${name} to ${displayPath(dir)}`);
  for (const file of result.written) console.log(`  + ${file}`);
  for (const file of result.unchanged) console.log(`  = ${file} (already up to date)`);
  for (const file of result.kept) console.log(`  ! ${file} differs from the extra and was kept. Use --force to replace it.`);
  if (result.fonts.length) console.log(`  + fonts in mografy.json: ${result.fonts.join(', ')}`);
  console.log(`\nNext: ${extra.next}\nGuide: .agents/skills/mografy/references/${extra.reference}`);
}
