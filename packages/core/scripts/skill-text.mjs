// Bundle the Skill's Markdown (skill/**/*.md) into src/skill-text.ts, so the guidance ships with
// @mografy/core without file access at runtime. Edit the Markdown; never the generated module.
// `node scripts/skill-text.mjs --check` exits 1 when the generated module is out of date.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'skill'), target = join(root, 'src', 'skill-text.ts');

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    .flatMap(entry => entry.isDirectory() ? files(join(dir, entry.name)) : entry.name.endsWith('.md') ? [join(dir, entry.name)] : []);
}

// Git on Windows checks the Markdown out with CRLF line endings by default; the generated module is tracked,
// so normalise to LF or every Windows build would leave it modified (and `mografy update` would refuse to run).
export function skillText() {
  const entries = files(source).map(file => `  ${JSON.stringify(relative(source, file).split(sep).join('/'))}: ${JSON.stringify(readFileSync(file, 'utf8').replaceAll('\r\n', '\n'))},`);
  return `// Generated from packages/core/skill/**/*.md by scripts/skill-text.mjs. Edit the Markdown, then run \`pnpm build\`.\n`
    + `export const SKILL_TEXT = {\n${entries.join('\n')}\n} as const;\n`;
}

export function writeSkillText() {
  const next = skillText();
  let current = '';
  try { current = readFileSync(target, 'utf8'); } catch {}
  if (current !== next) writeFileSync(target, next);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--check')) {
    let current = '';
    try { current = readFileSync(target, 'utf8'); } catch {}
    if (current !== skillText()) { console.error('packages/core/src/skill-text.ts is out of date: run `node packages/core/scripts/skill-text.mjs`.'); process.exit(1); }
  } else {
    writeSkillText();
  }
}
