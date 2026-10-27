import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isProject } from '@mografy/server';
import { addList, planAdd, runAdd } from '../src/add.js';
import { addTemplate, listTemplates, ROOT, TEMPLATE_SHARED } from '../src/templates.js';

const quiet = async <T>(run: () => Promise<T>) => { const log = console.log; console.log = () => {}; try { return await run(); } finally { console.log = log; } };

test('the template catalog lists every template file, pairs point both ways and landscape ids end in -wide', async () => {
  const templates = await listTemplates(ROOT);
  assert.ok(templates.length > 0);
  for (const s of templates) {
    assert.equal(s.aspect === '16:9', s.id.endsWith('-wide'), s.id);
    if (s.pair) assert.equal(templates.find(o => o.id === s.pair)?.pair, s.id, s.id);
    await readFile(join(ROOT, 'templates', `${s.id}.ts`));
    assert.ok(!/[㐀-鿿]/.test(JSON.stringify(s)), `${s.id}: template copy is English`);
  }
});

test('mografy add sorts templates next to helpers, and lists them by aspect', async () => {
  assert.deepEqual(await planAdd(['hook-impact', 'cjk', 'projects/x']), { films: [], helpers: ['cjk'], templates: ['hook-impact'], target: 'projects/x' });
  await assert.rejects(planAdd(['mografy-montage', 'hook-impact']), /separately/);
  assert.match(await addList(), /Mografy Templates[\s\S]*Portrait 9:16[\s\S]*hook-impact[\s\S]*Landscape 16:9[\s\S]*title-wide/);
});

test('mografy add <template> copies the template, the shared modules and the fonts, and registers the fonts once', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mografy-template-'));
  try {
    await writeFile(join(dir, 'mografy.json'), JSON.stringify({ version: 1, name: 'x', scene: 'scenes/main.ts', fonts: [] }));
    const first = await addTemplate(ROOT, dir, 'hook-impact');
    assert.deepEqual(first.written.filter(f => f.startsWith('scenes/')).sort(), ['scenes/templates/hook-impact.ts', ...TEMPLATE_SHARED.map(f => `scenes/templates/${f}`)].sort());
    assert.deepEqual(first.fonts, ['Inter 500', 'Inter 600', 'Inter 700', 'Inter 800', 'Anton 400']);
    const again = await addTemplate(ROOT, dir, 'hook-impact');
    assert.deepEqual([again.written, again.fonts], [[], []]);
    await writeFile(join(dir, 'scenes/templates/hook-impact.ts'), '// mine\n');
    assert.deepEqual((await addTemplate(ROOT, dir, 'hook-impact')).kept, ['scenes/templates/hook-impact.ts']);
    assert.deepEqual((await addTemplate(ROOT, dir, 'hook-impact', true)).written, ['scenes/templates/hook-impact.ts']);
    await assert.rejects(addTemplate(ROOT, dir, 'no-such-template'), /Unknown template/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('adding templates to a folder without a project creates one that plays them in order', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mografy-template-project-')), dir = join(root, 'my-film');
  try {
    const plan = await planAdd(['hook-impact', 'three-steps', 'title-wide', dir]);
    await quiet(() => runAdd(plan, ROOT, async t => t, false, isProject));
    const manifest = JSON.parse(await readFile(join(dir, 'mografy.json'), 'utf8'));
    assert.equal(manifest.aspectRatio, '9:16');
    assert.deepEqual([manifest.render.glow, manifest.render.grain], [0, 0]);
    assert.equal(manifest.fonts.filter((f: { family: string }) => f.family === 'Inter').length, 4);
    const editor = JSON.parse(await readFile(join(dir, 'tsconfig.json'), 'utf8'));
    assert.ok(editor.compilerOptions.strict, 'the project gets strict editor support');
    assert.match(editor.compilerOptions.paths['@mografy/runtime'][0], /packages\/runtime\/dist\/index\.d\.ts$/);
    const scene = await readFile(join(dir, 'scenes/main.ts'), 'utf8');
    assert.match(scene, /import \* as hookImpact from '\.\/templates\/hook-impact\.js'/);
    assert.match(scene, /import \* as threeSteps/);
    assert.doesNotMatch(scene, /titleWide/, 'a 16:9 template is not put into a 9:16 sequence');
    await readFile(join(dir, 'scenes/templates/title-wide.ts'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('helpers without a project fail with the command to run, instead of going into another project', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mografy-helper-'));
  try {
    await assert.rejects(quiet(async () => runAdd(await planAdd(['music']), ROOT, async () => undefined, false, isProject)), /not a Mografy project[\s\S]*mografy add music projects\/<name>/);
    await assert.rejects(quiet(async () => runAdd(await planAdd(['music', join(root, 'none')]), ROOT, async t => t, false, isProject)), /has no mografy\.json/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
