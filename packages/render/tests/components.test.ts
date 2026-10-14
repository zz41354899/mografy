import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSceneProject } from '@mografy/core';
import type { SceneProject } from '@mografy/core';
import { buildScene, SceneHost } from '../src/index.js';

const template = resolve(fileURLToPath(import.meta.url), '../../../server/template');
const components = ['stagger-text', 'typewriter', 'pop-card', 'progress-bar', 'pulse-dots', 'logo-reveal', 'social-card', 'youtube-subscribe', 'ai-chat', 'like-burst', 'follow-badge', 'notification-toast', 'lower-third', 'count-up', 'toggle-switch', 'audio-wave'];
let dir: string, host: SceneHost, project: SceneProject;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mografy-responsive-components-'));
  await cp(template, dir, { recursive: true });
  project = validateSceneProject(JSON.parse(await readFile(join(dir, 'mografy.json'), 'utf8')));
  host = await SceneHost.start(dir);
});
after(async () => { await host?.close(); await rm(dir, { recursive: true, force: true }); });

function assertSafe(pixels: Buffer, width: number, height: number, portrait: boolean, name: string) {
  let visible = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    // Exclude the dark canvas, panels and shadows. Test critical copy, icons and accents.
    if (Math.max(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!) < 90) continue;
    visible++;
    assert.ok(x >= width * (portrait ? .06 : .02) - 1 && x <= width * (portrait ? .94 : .98) + 1 && y >= height * (portrait ? .08 : .02) - 1 && y <= height * (portrait ? .82 : .98) + 1, `${name} visible content outside safe canvas at ${x},${y}`);
  }
  return visible;
}

function assertCentered(pixels: Buffer, width: number, height: number, name: string) {
  let left = width, right = 0, top = height, bottom = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    // Include the card body and exclude the dark canvas and its shadows.
    if (Math.max(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!) < 35) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  assert.ok(left < right && top < bottom);
  assert.ok(Math.abs((left + right + 1) / 2 - width / 2) <= width * .02, `${name} horizontal center: ${left}–${right}`);
  assert.ok(Math.abs((top + bottom + 1) / 2 - height / 2) <= height * .02, `${name} vertical center: ${top}–${bottom}`);
}

for (const name of components) {
  test(`${name}: landscape and portrait remain legible, inside safe margins and deterministic`, { timeout: 30_000 }, async () => {
    const source = await readFile(join(template, 'scenes', `${name}.ts`), 'utf8');
    const build = await buildScene(dir, project, { 'scenes/main.ts': source });
    for (const aspectRatio of ['16:9', '9:16'] as const) {
      const p = { ...project, aspectRatio };
      const page = await host.open(build, p, { renderScale: .2 });
      const { width, height } = page.scene;
      try {
        let visible = 0;
        for (const t of [0, .2, .8, 1.4, 2.5, 3.9, 4.1, 6, 8]) {
          visible += assertSafe(await page.raw(t), width, height, aspectRatio === '9:16', name);
        }
        assert.ok(visible > 100, `${name} must render a visible subject`);
        if (aspectRatio === '9:16') assertCentered(await page.raw(2.5), width, height, name);
        const frame = await page.raw(1.4);
        await page.raw(6); await page.raw(0);
        assert.deepEqual(await page.raw(1.4), frame);
        // An export with Adapt layout must match the saved portrait/landscape canvas.
        const exportPage = await host.open(build, project, { outputSize: { width, height, fit: 'reflow' } });
        try { assert.deepEqual(await exportPage.raw(1.4), frame); } finally { await exportPage.close(); }
      } finally { await page.close(); }
    }
  });
}

test('portrait social copy wraps within cards, including CJK, long words and line breaks', { timeout: 30_000 }, async () => {
  const copy: Record<string, Record<string, string>> = {
    'social-card': { name: 'Mografy 動畫設計工作室', caption: '在直式畫面中也能清楚閱讀的元件動畫與字幕。', avatar: 'AI' },
    'ai-chat': { prompt: 'Please create a portrait animation.\nKeep the subject readable.', reply: '讓我們製作適合手機觀看的直式動畫，文字應該自動換行。', avatar: 'AI' },
    'follow-badge': { name: 'Mografy 動畫設計工作室', label: 'Follow Mografy', following: 'Following Mografy', avatar: 'AI' },
    'notification-toast': { message: 'A new message is ready. Check your animation preview now.' },
    'lower-third': { name: 'Mografy 動畫設計工作室', subtitle: 'Motion designer creating responsive portrait animations' },
    'youtube-subscribe': { label: 'Subscribe to Mografy', subscribed: 'Subscribed to Mografy' },
  };
  for (const name of ['social-card', 'ai-chat', 'follow-badge', 'notification-toast', 'lower-third', 'youtube-subscribe']) {
    const source = await readFile(join(template, 'scenes', `${name}.ts`), 'utf8');
    const build = await buildScene(dir, project, { 'scenes/main.ts': source });
    const page = await host.open(build, { ...project, aspectRatio: '9:16', params: copy[name]! }, { renderScale: .2 });
    try { assert.ok(assertSafe(await page.raw(2.5), page.scene.width, page.scene.height, true, name) > 100); }
    finally { await page.close(); }
  }
});
