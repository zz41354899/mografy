import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMPLATE_DIR } from '@mografy/server';
import { ffmpegOutput, SceneHost, buildScene } from '@mografy/render';
import { browserFixture } from './helpers/browser-fixture.js';
import type { BrowserFixture } from './helpers/browser-fixture.js';

const BIN = resolve(fileURLToPath(import.meta.url), '../../bin/mografy.js');
let fixture: BrowserFixture | undefined;
let dir: BrowserFixture['dir'], sandbox: BrowserFixture['sandbox'], server: BrowserFixture['server'], page: BrowserFixture['page'];
let api: BrowserFixture['api'], stage: BrowserFixture['stage'], banner: BrowserFixture['banner'];
beforeEach(async () => {
  fixture = undefined;
  fixture = await browserFixture();
  ({ dir, sandbox, server, page, api, stage, banner } = fixture);
});
afterEach(async () => { await fixture?.close(); });

test('component project plays as soon as the player opens', async () => {
  const a = await stage(); await page.waitForTimeout(500); const b = await stage();
  assert.match(a.version, /^[\da-f]{16}$/);
  assert.ok(b.t > a.t, `time advances while playing (${a.t} → ${b.t})`);
  assert.equal(await page.locator('canvas.stage-canvas').count(), 1);
  const files = await readFile(join(dir, 'AGENTS.md'), 'utf8');
  assert.match(files, /renderFrame/);
  assert.equal(await readFile(join(dir, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n');
  await assert.rejects(access(join(dir, '.agents/skills')), { code: 'ENOENT' });
  await assert.rejects(access(join(dir, '.claude/skills')), { code: 'ENOENT' });
});

test('CLI presents the file-and-skill workflow', async () => {
  const child = spawn(process.execPath, [BIN, '--help'], { env: { ...process.env, MOGRAFY_NO_OPEN: '1' } });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const code = await new Promise<number | null>(done => child.once('close', done));
  assert.equal(code, 0, stderr);
  assert.match(stdout, /mografy dev/);
  assert.match(stdout, /mografy check/);
  assert.match(stdout, /mografy export/);
  assert.doesNotMatch(stdout, /\bmcp\b|setup-claude/i);
});

test('seek from outside pauses the player at that time', async () => {
  await api('seek', 'POST', { t: 3.25 });
  await page.waitForFunction(() => Math.abs(Number(document.querySelector<HTMLElement>('[data-testid=stage]')!.dataset.time) - 3.25) < 1e-6);
  await page.waitForTimeout(300);
  assert.equal((await stage()).t, 3.25, 'stays paused');
  assert.equal((await api('snapshot')).data.state.playhead, 3.25);
});

test('source update: verified first, then the player switches version at the same time', async () => {
  await api('seek', 'POST', { t: 3.25 });
  await page.waitForFunction(() => Number(document.querySelector<HTMLElement>('[data-testid=stage]')!.dataset.time) === 3.25);
  const before = await stage();
  const source = await readFile(join(dir, 'scenes/main.ts'), 'utf8');
  const bad = await api('source', 'POST', { files: { 'scenes/main.ts': source.replace('export function renderFrame', 'export function renderFrameX') } });
  assert.equal(bad.status, 422);
  assert.equal(await readFile(join(dir, 'scenes/main.ts'), 'utf8'), source, 'failed update leaves the file untouched');
  const good = await api('source', 'POST', { files: { 'scenes/main.ts': source.replace('default: "Motion designer"', 'default: "Motion editor"') } });
  assert.equal(good.status, 200, JSON.stringify(good.data));
  await page.waitForFunction(v => document.querySelector<HTMLElement>('[data-testid=stage]')!.dataset.version === v, good.data.version, { timeout: 10_000 });
  const after = await stage();
  assert.notEqual(after.version, before.version);
  assert.equal(after.t, before.t, 'time kept across versions');
  assert.equal(await banner(), 0);
});

test('editing the file on disk: broken keeps the last version with an error, fixed clears it', async () => {
  const good = await stage(), source = await readFile(join(dir, 'scenes/main.ts'), 'utf8');
  await writeFile(join(dir, 'scenes/main.ts'), source + '\nexport const = 1;\n');
  await page.waitForSelector('.notice.error', { timeout: 10_000 });
  assert.match(await page.locator('.notice.error pre').innerText(), /main\.ts:\d+/);
  assert.equal((await stage()).version, good.version);
  await writeFile(join(dir, 'scenes/main.ts'), source.replace('"Mografy"', '"HELLO"'));
  await page.waitForFunction(v => document.querySelector<HTMLElement>('[data-testid=stage]')!.dataset.version !== v, good.version, { timeout: 10_000 });
  await page.waitForFunction(() => !document.querySelector('.notice.error'));
});

const runCli = async (...args: string[]) => {
  const child = spawn(process.execPath, [BIN, ...args], { env: { ...process.env, MOGRAFY_NO_OPEN: '1' } });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const code = await new Promise<number | null>(done => child.once('close', done));
  return { code, stdout, stderr };
};

test('mografy check asks the running player, which shows the same result', async () => {
  const source = await readFile(join(dir, 'scenes/main.ts'), 'utf8');
  const ok = await runCli('check', dir);
  assert.equal(ok.code, 0, ok.stderr);
  assert.match(ok.stdout, /✓ Compiled and trial-rendered/);
  await writeFile(join(dir, 'scenes/main.ts'), source + '\nexport const = 1;\n');
  const broken = await runCli('check', dir);
  assert.notEqual(broken.code, 0);
  assert.match(broken.stderr, /did not compile/);
  await page.waitForSelector('.notice.error', { timeout: 10_000 });
  await writeFile(join(dir, 'scenes/main.ts'), source);
  assert.equal((await runCli('check', dir)).code, 0);
  await page.waitForFunction(() => !document.querySelector('.notice.error'), undefined, { timeout: 10_000 });
});

test('playback stopped by a renderFrame error resumes once a fixed version loads', async () => {
  const scene = (broken: boolean) => `export const meta = { width: 320, height: 180, duration: 2, fps: 30, background: '#000000' };
export const params = {};
export function setup() {}
export function renderFrame(ctx, time) {
  if (${broken} && time > 0.6 && time < 0.9) throw new Error('mid-shot failure');
  ctx.canvas.fillStyle = '#ffffff'; ctx.canvas.fillRect(0, 0, time * 100, 10);
}
`;
  const versionOf = () => page.evaluate(() => document.querySelector<HTMLElement>('[data-testid=stage]')!.dataset.version);
  const initial = await versionOf();
  await writeFile(join(dir, 'scenes/main.ts'), scene(true));
  await page.waitForFunction(v => document.querySelector<HTMLElement>('[data-testid=stage]')!.dataset.version !== v, initial, { timeout: 15_000 });
  await api('seek', 'POST', { t: 0 });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 10_000 });
  const stopped = Number((await stage()).t);
  assert.ok(stopped > 0.6 && stopped < 0.9, `stopped inside the failing range (${stopped})`);
  const brokenVersion = await versionOf();
  await writeFile(join(dir, 'scenes/main.ts'), scene(false));
  await page.waitForFunction(v => document.querySelector<HTMLElement>('[data-testid=stage]')!.dataset.version !== v, brokenVersion, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Pause', exact: true }).waitFor({ timeout: 5_000 });
  await page.waitForFunction(t => Number(document.querySelector<HTMLElement>('[data-testid=stage]')!.dataset.time) !== t, stopped, { timeout: 5_000 });
});

test('parameter panel saves values; scene updates drop incompatible ones', async () => {
  const input = page.locator('[data-param=speed] input[type=number]');
  await input.fill('1.5');
  for (let i = 0; i < 50 && (await api('snapshot')).data.project.params.speed !== 1.5; i++) await new Promise(r => setTimeout(r, 100));
  assert.equal(JSON.parse(await readFile(join(dir, 'mografy.json'), 'utf8')).params.speed, 1.5);
  const frame = await readFile(join(dir, 'scenes/component-frame.ts'), 'utf8');
  const result = await api('source', 'POST', { files: { 'scenes/component-frame.ts': frame.replace("default: 1, min: 0.25, max: 2", "default: 0.5, min: 0.25, max: 1") } });
  assert.deepEqual(result.data.issues.map((i: { id: string; reason: string }) => [i.id, i.reason]), [['speed', 'out-of-range']]);
  await page.waitForSelector('.notice.warn');
  assert.equal(JSON.parse(await readFile(join(dir, 'mografy.json'), 'utf8')).params.speed, undefined);
});

test('only subtitles are editable; multiple edits save, survive reload and reset safely', async () => {
  const source = await readFile(join(dir, 'scenes/main.ts'), 'utf8');
  const fixture = source.replace('export const params = {', `export const params = {
    caption: { name: 'Second subtitle', type: 'string' as const, role: 'subtitle' as const, default: 'Second line' },`);
  const updated = await api('source', 'POST', { files: { 'scenes/main.ts': fixture } });
  assert.equal(updated.status, 200);
  await page.waitForFunction(v => document.querySelector<HTMLElement>('[data-testid=stage]')!.dataset.version === v, updated.data.version);
  await api('seek', 'POST', { t: 3.25 });
  assert.equal(await page.locator('[data-param=name]').count(), 0, 'names are changed through AI');
  assert.equal(await page.locator('.inspector textarea').count(), 2, 'only declared subtitles are listed');
  const original = (await api('snapshot')).data.scene.params.subtitle.default;
  const picture = () => page.locator('canvas.stage-canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  const before = await picture();
  const subtitle = page.locator('[data-param=subtitle] textarea');
  const caption = page.locator('[data-param=caption] textarea');
  await subtitle.fill('Shared copy');
  await caption.fill('Second copy\n第二行文字');
  await page.waitForFunction(() => !!document.querySelector('[data-param=subtitle].edited') && !!document.querySelector('[data-param=caption].edited'));
  const params = JSON.parse(await readFile(join(dir, 'mografy.json'), 'utf8')).params;
  assert.equal(params.subtitle, 'Shared copy');
  assert.equal(params.caption, 'Second copy\n第二行文字');
  assert.notEqual(await picture(), before, 'subtitle changes reach the actual Canvas preview');
  await subtitle.fill('Pending edit');
  await page.locator('[data-param=subtitle]').getByRole('button', { name: 'Reset' }).click();
  await page.waitForTimeout(350);
  assert.equal((await api('snapshot')).data.project.params.subtitle, undefined);
  assert.equal(await subtitle.inputValue(), original);
  await page.reload();
  await page.waitForSelector('canvas.stage-canvas');
  assert.equal(await caption.inputValue(), 'Second copy\n第二行文字');
  assert.equal(await subtitle.inputValue(), original);
  await api('seek', 'POST', { t: 3.25 });
  await subtitle.focus();
  await subtitle.press('Space');
  await page.waitForTimeout(100);
  assert.equal((await stage()).t, 3.25, 'typing does not trigger playback shortcuts');
  await api('source', 'POST', { files: { 'scenes/main.ts': source } });
});

test('inspector groups scene settings and offers direct effects with keyboard navigation', async () => {
  await api('seek', 'POST', { t: 1 });
  await page.waitForFunction(() => Number(document.querySelector<HTMLElement>('[data-testid=stage]')!.dataset.time) === 1);
  const tabs = page.getByRole('tablist', { name: 'Inspector', exact: true });
  assert.equal(await tabs.getByRole('tab').count(), 3);
  await tabs.getByRole('tab', { name: 'Scene', exact: true }).click();
  assert.ok(await page.getByRole('heading', { name: 'Colors', exact: true }).isVisible());
  assert.ok(await page.getByRole('heading', { name: 'Controls', exact: true }).isVisible());
  await tabs.getByRole('tab', { name: 'Scene', exact: true }).press('ArrowRight');
  assert.equal(await tabs.getByRole('tab', { name: 'Effects', exact: true }).getAttribute('aria-selected'), 'true');
  assert.ok(await page.getByRole('slider', { name: 'Glow', exact: true }).isVisible(), 'effects are available without a disclosure');
  assert.equal((await stage()).t, 1, 'tab arrows do not move the playhead');
  await tabs.getByRole('tab', { name: 'Effects', exact: true }).press('End');
  assert.equal(await tabs.getByRole('tab', { name: 'Audio', exact: true }).getAttribute('aria-selected'), 'true');
  assert.ok(await page.getByRole('button', { name: 'Add music', exact: true }).isVisible());
  await tabs.getByRole('tab', { name: 'Audio', exact: true }).press('Home');
  assert.equal(await tabs.getByRole('tab', { name: 'Scene', exact: true }).getAttribute('aria-selected'), 'true');
});

test('advanced effects preview through the export pipeline, persist, and clear without changing seed', async () => {
  const original = (await api('snapshot')).data.project;
  const originalSource = await readFile(join(dir, 'scenes/main.ts'), 'utf8');
  const fixture = await api('source', 'POST', { files: { 'scenes/main.ts': await readFile(join(TEMPLATE_DIR, 'scenes/progress-bar.ts'), 'utf8') } });
  assert.equal(fixture.status, 200);
  await page.waitForFunction(v => document.querySelector<HTMLElement>('[data-testid=stage]')!.dataset.version === v, fixture.data.version);
  await api('seek', 'POST', { t: .15 });
  await page.waitForFunction(() => Number(document.querySelector<HTMLElement>('[data-testid=stage]')!.dataset.time) === .15);
  assert.equal(await page.getByText('Random variation', { exact: true }).count(), 0);
  await page.getByRole('tab', { name: 'Effects', exact: true }).click();
  const panel = page.getByRole('tabpanel', { name: 'Effects', exact: true });
  await panel.getByRole('slider', { name: 'Glow', exact: true }).fill('0.5');
  await panel.getByRole('spinbutton', { name: 'Grain amount', exact: true }).fill('60');
  await panel.getByRole('status').filter({ hasText: 'Saved automatically' }).waitFor();
  const saved = (await api('snapshot')).data.project;
  assert.equal(saved.render.glow, .5); assert.equal(saved.render.grain, .06);
  assert.equal(saved.seed, original.seed);
  assert.ok(await page.getByRole('button', { name: 'Play', exact: true }).isVisible(), 'changing effects pauses for preview');
  assert.equal(await panel.getByRole('radio', { name: 'With effects', exact: true }).getAttribute('aria-checked'), 'true');
  // Compare player pixels with the real headless capture used by video exports.
  const dimensions = await page.locator('canvas.stage-canvas').evaluate((canvas: HTMLCanvasElement) => ({ width: canvas.width, height: canvas.height }));
  const sceneBuild = await buildScene(dir, saved);
  const host = await SceneHost.start(dir);
  try {
    const capture = await host.open(sceneBuild, saved, { renderScale: dimensions.width / (await api('snapshot')).data.scene.meta.width });
    const duration = (await api('snapshot')).data.scene.meta.duration;
    const k = Math.min(Math.ceil(duration * saved.render.fps) - 1, Math.round((await stage()).t * saved.render.fps));
    const expected = await capture.output(k, saved.render);
    const actual = await page.locator('canvas.stage-canvas').evaluate((canvas: HTMLCanvasElement) => Array.from(canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data));
    const mismatches = actual.reduce((count, value, index) => count + (value !== expected[index] ? 1 : 0), 0);
    assert.equal(mismatches, 0, `paused preview differs in ${mismatches} of ${actual.length} channels; actual size ${dimensions.width}x${dimensions.height}, capture ${capture.scene.width}x${capture.scene.height}, frame ${k}`);
  } finally { await host.close(); }
  const picture = () => page.locator('canvas.stage-canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  const processed = await picture();
  await panel.getByRole('radio', { name: 'Original', exact: true }).click();
  assert.notEqual(await picture(), processed, 'preview comparison shows the original scene');
  for (const format of ['MP4', 'Lottie', 'SVGA']) {
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const modal = page.getByRole('dialog');
    await modal.getByRole('button', { name: new RegExp('^' + format) }).click();
    await modal.getByText('Advanced settings', { exact: true }).click();
    assert.equal(await modal.getByRole('slider', { name: 'Glow', exact: true }).inputValue(), '0.5');
    assert.equal(await modal.getByRole('slider', { name: 'Grain', exact: true }).inputValue(), '0.06');
    await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  await page.reload(); await page.waitForSelector('canvas.stage-canvas');
  await page.getByRole('tab', { name: 'Effects', exact: true }).click();
  assert.equal(await panel.getByRole('slider', { name: 'Glow', exact: true }).inputValue(), '0.5');
  assert.equal(await panel.getByRole('slider', { name: 'Grain', exact: true }).inputValue(), '0.06');
  await panel.getByRole('button', { name: 'Reset Glow', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: 'Saved automatically' }).waitFor();
  assert.equal((await api('snapshot')).data.project.render.glow, 0);
  assert.equal((await api('snapshot')).data.project.render.grain, .06);
  await panel.getByRole('button', { name: 'Clear effects', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: 'Saved automatically' }).waitFor();
  const cleared = (await api('snapshot')).data.project;
  assert.equal(cleared.render.glow, 0); assert.equal(cleared.render.grain, 0);
  assert.equal(cleared.render.samples, original.render.samples, 'other output settings remain intact');
  await api('project', 'PATCH', { patch: { render: original.render } });
  await panel.getByRole('radio', { name: 'Original', exact: true }).click();
  await page.getByRole('tab', { name: 'Scene', exact: true }).click();
  const restored = await api('source', 'POST', { files: { 'scenes/main.ts': originalSource } });
  await page.waitForFunction(v => document.querySelector<HTMLElement>('[data-testid=stage]')!.dataset.version === v, restored.data.version);
});
