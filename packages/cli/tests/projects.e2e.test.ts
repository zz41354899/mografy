import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ffmpegOutput } from '@mografy/render';
import { createProject } from '@mografy/server';
import { browserFixture } from './helpers/browser-fixture.js';
import type { BrowserFixture } from './helpers/browser-fixture.js';

let fixture: BrowserFixture | undefined;
let dir: BrowserFixture['dir'], sandbox: BrowserFixture['sandbox'], server: BrowserFixture['server'], page: BrowserFixture['page'];
let api: BrowserFixture['api'], stage: BrowserFixture['stage'];
beforeEach(async () => {
  fixture = undefined;
  fixture = await browserFixture();
  ({ dir, sandbox, server, page, api, stage } = fixture);
});
afterEach(async () => { await fixture?.close(); });

test('a delayed auto-save cannot modify the project opened afterward', { timeout: 30_000 }, async () => {
  const second = join(sandbox, 'second');
  await createProject(second, 'Second', await readFile(join(dir, 'scenes/main.ts'), 'utf8'));
  const subtitle = 'Save belongs to First';
  let release!: () => void, held!: () => void, complete!: (status: number) => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { held = resolve; });
  const finished = new Promise<number>(resolve => { complete = resolve; });
  await page.route('**/__mografy/project', async route => {
    const request = route.request();
    if (request.method() !== 'PATCH' || request.postDataJSON()?.patch?.params?.subtitle !== subtitle) return route.continue();
    held();
    await gate;
    const response = await route.fetch();
    await route.fulfill({ response });
    complete(response.status());
  });
  try {
    await page.locator('[data-param=subtitle] textarea').fill(subtitle);
    await started;
    assert.equal((await api('projects/open', 'POST', { dir: second })).status, 200);
    await page.waitForFunction(() => document.querySelector('.topbar .project')?.textContent === 'Second');
    release();
    assert.equal(await finished, 409);
    assert.equal(JSON.parse(await readFile(join(second, 'mografy.json'), 'utf8')).params?.subtitle, undefined);
  } finally { release(); await page.unrouteAll({ behavior: 'wait' }); }
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
    assert.equal(animation.project.aspectRatio, '9:16');
    assert.deepEqual([animation.scene.meta.width, animation.scene.meta.height], [1080, 1920]);
    assert.deepEqual(await page.locator('.project-item.current .thumb').evaluate(e => {
      const css = getComputedStyle(e), image = e.querySelector('img');
      return { ratio: css.aspectRatio, fit: image ? getComputedStyle(image).objectFit : '' };
    }), { ratio: '9 / 16', fit: 'contain' }, 'portrait component thumbnail is never cropped into a landscape box');
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
