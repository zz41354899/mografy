// End to end: built-in component → server → real player in Chromium → verified file writes and export.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { createProject, startServer, TEMPLATE_DIR } from '@mografy/server';
import { ffmpegOutput, SceneHost, buildScene } from '@mografy/render';
import type { RunningServer } from '@mografy/server';

const BIN = resolve(fileURLToPath(import.meta.url), '../../bin/mografy.js');
let dir: string, sandbox: string, server: RunningServer, browser: Browser, page: Page;
const api = async (path: string, method = 'GET', body?: unknown) => {
  const response = await fetch(new URL(`/__mografy/${path}`, server.url), { method, ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json() as any };
};
const stage = () => page.evaluate(() => { const s = document.querySelector<HTMLElement>('[data-testid=stage]')!; return { version: s.dataset.version!, t: Number(s.dataset.time) }; });
const banner = () => page.locator('.notice.error').count();

before(async () => {
  // Keep the projects folder and recent list away from the real home folder.
  sandbox = await realpath(await mkdtemp(join(tmpdir(), 'mografy-e2e-')));
  process.env.MOGRAFY_HOME = join(sandbox, 'library');
  process.env.MOGRAFY_STATE = join(sandbox, 'state');
  dir = join(sandbox, 'first');
  await createProject(dir, 'First', await readFile(join(TEMPLATE_DIR, 'scenes/lower-third.ts'), 'utf8'));
  server = await startServer(dir, { port: 0 });
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => console.error('pageerror', e.message));
  await page.goto(server.url);
  await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-testid=stage]')?.dataset.version, null, { timeout: 20_000 });
});
after(async () => { await browser?.close(); await server?.close(); await rm(sandbox, { recursive: true, force: true }); });

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

test('project panel: create a project, switch to it, switch back', { timeout: 120_000 }, async () => {
  await page.waitForSelector('nav.projects');
  const first = await stage();
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByLabel('New project name').fill('Second take');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForFunction(() => document.querySelector('.topbar .project')?.textContent === 'Second take', null, { timeout: 30_000 });
  await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-testid=stage]')!.dataset.version, null, { timeout: 30_000 });
  assert.equal((await api('snapshot')).data.projectDir, join(sandbox, 'library', 'Second-take'));
  const list = (await api('projects')).data;
  assert.deepEqual(list.projects.filter((p: { kind: string }) => p.kind === 'recent' || p.kind === 'library').map((p: { name: string }) => p.name).sort(), ['First', 'Second take']);
  const components = list.projects.filter((p: { kind: string }) => p.kind === 'component');
  assert.equal(components.length, 16);
  assert.ok(components.every((p: { thumb: number | null }) => p.thumb !== null), 'unopened components already have bundled previews');
  const previewUrl = new URL(`/__mografy/projects/thumb?dir=${encodeURIComponent(components[0].dir)}&v=${components[0].thumb}`, server.url);
  const preview = await fetch(previewUrl);
  assert.equal(preview.status, 200);
  assert.match(preview.headers.get('cache-control')!, /immutable/);
  const etag = preview.headers.get('etag')!;
  assert.equal((await fetch(previewUrl, { headers: { 'if-none-match': etag } })).status, 304);
  previewUrl.searchParams.set('v', 'old-preview');
  assert.equal((await fetch(previewUrl)).headers.get('cache-control'), 'no-cache', 'stale URLs cannot cache changed artwork permanently');
  const versions = new Set<string>();
  for (const component of components) {
    await page.getByRole('button', { name: new RegExp(`^${component.name} `) }).click();
    await page.waitForFunction(name => document.querySelector('.topbar .project')?.textContent === name, component.name, { timeout: 30_000 });
    await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-testid=stage]')?.dataset.version, null, { timeout: 30_000 });
    const animation = (await api('snapshot')).data;
    assert.equal(animation.error, null); assert.ok(animation.scene);
    assert.equal(animation.projectDir, component.dir);
    versions.add(animation.scene.version);
  }
  assert.equal(versions.size, 16, 'sixteen independent scene builds');
  await page.waitForFunction(() => {
    const image = document.querySelector('.project-item.current .thumb img');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
  }, null, { timeout: 15000 });
  const beforeThumbnail = await page.locator('.project-item.current .thumb img').getAttribute('src');
  const thumbnailChange = await api('project', 'PATCH', { patch: { params: { accent: '#cc44ff' } } });
  assert.equal(thumbnailChange.status, 200);
  await page.waitForFunction(before => {
    const image = document.querySelector('.project-item.current .thumb img');
    return image instanceof HTMLImageElement && image.getAttribute('src') !== before && image.complete && image.naturalWidth > 0;
  }, beforeThumbnail, { timeout: 15000 });
  await page.getByRole('button', { name: /First/ }).click();
  await page.waitForFunction(v => document.querySelector<HTMLElement>('[data-testid=stage]')!.dataset.version === v, first.version, { timeout: 30_000 });
  assert.equal((await api('snapshot')).data.projectDir, dir);
  assert.equal(await page.locator('.project-item.current .project-name').innerText(), 'First');
});

test('music: add a track in the Audio panel, hear it in sync, seek with Range requests', { timeout: 120_000 }, async () => {
  const mp3 = join(sandbox, 'beat.mp3');
  await ffmpegOutput(['-f', 'lavfi', '-i', 'sine=frequency=330:duration=6', '-c:a', 'libmp3lame', '-b:a', '128k', '-y', mp3]);
  await page.getByRole('tab', { name: 'Audio', exact: true }).click();
  await page.getByRole('tabpanel', { name: 'Audio', exact: true }).locator('input[type=file]').setInputFiles(mp3);
  for (let i = 0; i < 100 && !(await api('snapshot')).data.project.audio; i++) await new Promise(r => setTimeout(r, 100));
  const audio = (await api('snapshot')).data.project.audio;
  assert.equal(audio.path, 'assets/beat.mp3'); assert.equal(audio.bpm, 120);
  assert.equal(JSON.parse(await readFile(join(dir, 'mografy.json'), 'utf8')).audio.path, 'assets/beat.mp3');
  await page.waitForSelector('.music-lane .waveform');
  await page.waitForFunction(() => document.querySelector('button.sound')?.classList.contains('on') || document.querySelector('button.sound')?.classList.contains('locked'), null, { timeout: 10_000 });
  const range = await fetch(new URL('/__mografy/files/assets/beat.mp3', server.url), { headers: { range: 'bytes=0-99' } });
  assert.equal(range.status, 206); assert.equal((await range.arrayBuffer()).byteLength, 100);
  const bad = await fetch(new URL('/__mografy/assets?name=notes.txt', server.url), { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: 'x' });
  assert.equal(bad.status, 400);
  assert.ok(await page.getByRole('slider', { name: 'Volume', exact: true }).isVisible());
  assert.equal(await page.getByLabel('BPM', { exact: true }).isVisible(), false);
  await page.getByText('Beat sync', { exact: false }).click();
  await page.getByLabel('BPM', { exact: true }).fill('140');
  for (let i = 0; i < 50 && (await api('snapshot')).data.project.audio?.bpm !== 140; i++) await new Promise(r => setTimeout(r, 100));
  assert.equal((await api('snapshot')).data.project.audio.bpm, 140);
  await page.getByRole('button', { name: 'Remove' }).click();
  for (let i = 0; i < 50 && (await api('snapshot')).data.project.audio; i++) await new Promise(r => setTimeout(r, 100));
  assert.equal((await api('snapshot')).data.project.audio, undefined);
});


test('export dialog: three usable formats, keyboard choices, advanced controls and unchanged project defaults', { timeout: 120_000 }, async () => {
  await page.getByRole('tab',{name:'Scene',exact:true}).click();
  assert.equal(await page.locator('[data-param=name]').count(),0);
  assert.equal(await page.locator('[data-param=subtitle]').count(),1);
  assert.equal(await page.getByText('Final frame',{exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Loop',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Guides',exact:true}).click();
  assert.equal(await page.locator('.guides').count(),1);
  await page.getByRole('button',{name:'Guides',exact:true}).click();
  const changed=await api('source','POST',{files:{'scenes/main.ts':await readFile(join(TEMPLATE_DIR,'scenes/progress-bar.ts'),'utf8')}});
  assert.equal(changed.status,200);
  await page.waitForFunction(v=>document.querySelector<HTMLElement>('[data-testid=stage]')!.dataset.version===v,changed.data.version);
  await api('project','PATCH',{patch:{render:{scale:.1,fps:10,samples:1,workers:1}}});
  const manifest=await readFile(join(dir,'mografy.json'),'utf8');
  await page.getByRole('button',{name:'Export',exact:true}).click();
  const modal = page.getByRole('dialog');
  const expectedSizes = {
    MP4: ['1280 × 720 — 720p', '1920 × 1080 — 1080p'],
    Lottie: ['256 × 256 — Square', '640 × 360 — Landscape'],
    SVGA: ['375 × 375 — Square', '375 × 750 — Portrait'],
  };
  for (const [format, sizes] of Object.entries(expectedSizes)) {
    await modal.getByRole('button', { name: new RegExp('^' + format) }).click();
    const resolution = modal.getByRole('combobox', { name: 'Resolution', exact: true });
    await resolution.click();
    assert.deepEqual(await modal.getByRole('option').allTextContents(), sizes);
    await resolution.press('End'); await resolution.press('Enter');
    assert.equal(await resolution.innerText(), sizes[1]);
  }
  await modal.getByRole('button', { name: /^Lottie/ }).click();
  assert.equal(await modal.getByRole('combobox', { name: 'Resolution', exact: true }).innerText(), expectedSizes.Lottie[1], 'format switches preserve selections');
  assert.equal(await modal.getByRole('combobox', { name: 'Fit', exact: true }).count(), 0, 'matching landscape aspect ratio does not need fitting');
  const lottieResolution = modal.getByRole('combobox', { name: 'Resolution', exact: true });
  await lottieResolution.click(); await lottieResolution.press('Home'); await lottieResolution.press('Enter');
  const fit = modal.getByRole('combobox', { name: 'Fit', exact: true });
  await fit.click(); await fit.press('End'); await fit.press('Enter');
  assert.equal(await fit.innerText(), 'Fill and crop');
  await page.getByRole('dialog').getByRole('combobox',{name:'Resolution',exact:true}).click();
  await page.getByRole('dialog').getByRole('combobox',{name:'Resolution',exact:true}).press('Escape');
  assert.equal(await page.getByRole('dialog').count(),1,'Escape closes the choice before the dialog');
  await page.getByRole('dialog').getByRole('button',{name:'Close export'}).press('Escape');
  await page.getByRole('dialog').waitFor({state:'detached'});
  for(const format of ['MP4','Lottie','SVGA']) {
    await page.getByRole('button',{name:'Export',exact:true}).click();
    const modal=page.getByRole('dialog',{name:'Export animation'});
    await modal.getByRole('button',{name:new RegExp('^'+format)}).click();
    const fps=modal.getByRole('combobox',{name:'Frame rate',exact:true});
    await fps.click();
    const availableRates = await modal.getByRole('option').allTextContents();
    const maximum = format === 'MP4' ? 60 : 30;
    assert.equal(availableRates.at(-1), `${maximum} fps`);
    assert.ok(availableRates.every(rate => Number.parseInt(rate) <= maximum));
    await fps.press('Home'); await fps.press('Enter');
    await modal.getByText('Advanced settings',{exact:true}).click();
    const encoding=modal.getByRole('combobox',{name:'Encoding',exact:true});
    if(format==='MP4') {
      await encoding.click(); await encoding.press('End'); await encoding.press('Enter');
      await modal.getByRole('slider',{name:'CRF'}).fill('20');
    } else {
      assert.equal(await encoding.count(),0);
      assert.match(await modal.locator('.export-note').filter({ hasText: 'Embedded image frames' }).innerText(),/Embedded image frames/);
    }
    await modal.getByRole('button',{name:'Export '+format,exact:true}).click();
    await modal.waitFor({state:'detached'});
    for(let i=0;i<1200&&(await api('snapshot')).data.render.state==='running';i++) await new Promise(r=>setTimeout(r,50));
    const render=(await api('snapshot')).data.render;
    assert.equal(render.state,'done',render.error); assert.equal(render.format,format.toLowerCase());
    const complete=page.locator('.export-complete');
    await complete.waitFor();
    assert.match(await complete.innerText(),new RegExp(`Export ready[\\s\\S]*${render.output.split(/[\\\\/]/).pop()}`));
    if(format==='MP4') await complete.waitFor({state:'detached',timeout:8_000});
    assert.equal(await readFile(join(dir,'mografy.json'),'utf8'),manifest,'single-export settings do not change project defaults');
    const downloaded=await fetch(new URL('/__mografy/files/'+render.output.slice(dir.length+1),server.url));
    assert.equal(downloaded.status,200);
    const bytes=Buffer.from(await downloaded.arrayBuffer());
    if(format==='MP4') assert.equal(bytes.subarray(4,8).toString(),'ftyp');
    else if(format==='Lottie') { const movie = JSON.parse(bytes.toString()); assert.equal(movie.layers.length,render.total); assert.equal(movie.w,256); assert.equal(movie.h,256); }
    else assert.equal(bytes[0],0x78,'zlib-compressed SVGA 2');
  }
  assert.equal((await api('render','POST',{format:'svga',render:{fps:24}})).status,400);
  assert.equal((await api('render','POST',{format:'mp4',render:{fps:61}})).status,400);
  assert.equal((await api('render','POST',{format:'lottie',render:{fps:31}})).status,400);
  assert.equal((await api('render','POST',{format:'svga',render:{fps:31}})).status,400);
  assert.equal((await api('render','POST',{format:'svga',render:{fps:60}})).status,400);
  await api('project', 'PATCH', { patch: { render: { fps: 120 } } });
  for (const format of ['mp4', 'lottie', 'svga']) assert.equal((await api('render', 'POST', { format })).status, 400, 'inherited project frame rates also obey the format cap');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  assert.equal(await page.getByRole('dialog').getByRole('combobox', { name: 'Frame rate', exact: true }).innerText(), '60 fps', 'dialog clamps legacy project defaults');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await api('project', 'PATCH', { patch: { render: { fps: 10 } } });
  assert.equal((await api('render','POST',{format:'lottie',output:'mografy.json'})).status,400);
  const uiOutput='renders/cancel-from-player.lottie.json';
  assert.equal((await api('render','POST',{format:'lottie',output:uiOutput,render:{scale:.25,fps:30,samples:8}})).status,202);
  await page.getByRole('button',{name:'Cancel export',exact:true}).click();
  for(let i=0;i<200&&(await api('snapshot')).data.render.state==='running';i++) await new Promise(r=>setTimeout(r,25));
  assert.equal((await api('snapshot')).data.render.state,'cancelled');
  await assert.rejects(access(join(dir,uiOutput)),'cancelled player export does not commit a partial file');

  const cliOutput='renders/cancel-from-cli.lottie.json';
  assert.equal((await api('render','POST',{format:'lottie',output:cliOutput,render:{scale:.25,fps:30,samples:8}})).status,202);
  const child=spawn(process.execPath,[BIN,'export',dir,'--cancel'],{env:{...process.env,MOGRAFY_NO_OPEN:'1'}});
  let stdout='',stderr=''; child.stdout.on('data',c=>{stdout+=c;}); child.stderr.on('data',c=>{stderr+=c;});
  const code=await new Promise<number|null>(done=>child.once('close',done));
  assert.equal(code,0,stderr); assert.match(stdout,/Cancelling Lottie export/); assert.match(stdout,/Export cancelled/);
  assert.equal((await api('snapshot')).data.render.state,'cancelled');
  await assert.rejects(access(join(dir,cliOutput)),'cancelled CLI export does not commit a partial file');
});
