// Presentation export: one HTML file holding the compiled scene, the presentation player and every
// asset the scene loads, so it opens offline with a double-click and presents like the editor's window.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectFile, slug } from '@mografy/render';
import { deckSlides } from '@mografy/core';
import type { SceneInfo, SceneProject } from '@mografy/core';
import { MIME } from './http-io.js';

const webDist = () => join(dirname(fileURLToPath(import.meta.resolve('@mografy/web/package.json'))), 'dist');
/** Keep `</script>` and HTML comment openers out of inline script text. */
const inline = (text: string) => text.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

/** Only the files the scene loads (recorded in Chromium), plus its fonts and music. */
async function projectAssets(dir: string, project: SceneProject, used: Iterable<string>) {
  const paths = new Set<string>([...project.fonts.map(f => f.path), ...(project.audio ? [project.audio.path] : []), ...used]);
  const assets: Record<string, { type: string; data: string }> = {};
  for (const path of [...paths].sort()) {
    const type = (MIME[extname(path).toLowerCase()] ?? 'application/octet-stream').split(';')[0]!;
    // A scene may request any path; embed only real files inside the project, as the host serves them.
    const file = await projectFile(dir, path).catch(() => undefined);
    if (file) assets[path] = { type, data: (await readFile(file)).toString('base64') };
  }
  return assets;
}

export async function exportDeck(dir: string, project: SceneProject, scene: SceneInfo, code: string, used: Iterable<string>) {
  const [player, styles, assets] = await Promise.all([
    readFile(join(webDist(), 'deck.js'), 'utf8'), readFile(join(webDist(), 'deck.css'), 'utf8'), projectAssets(dir, project, used),
  ]).then(([js, css, files]) => [js.replace(/\n\/\/# sourceMappingURL=\S+\s*$/, '\n'), css.replace(/\/\*# sourceMappingURL=\S+ \*\/\s*$/, ''), files] as const);
  const defaults = Object.fromEntries(Object.entries(scene.params).map(([id, d]) => [id, d.default]));
  const deck = { name: project.name, version: scene.version, project, values: { ...defaults, ...project.params }, meta: scene.meta, scene: code, assets };
  const html = `<!doctype html>
<html lang="zh-Hant" class="deck-page">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Mografy">
<title>${project.name.replace(/[<&]/g, c => c === '<' ? '&lt;' : '&amp;')}</title>
<style>${styles.replace(/<\/style/gi, '<\\/style')}</style>
</head>
<body>
<div id="deck"></div>
<script>window.__MOGRAFY_DECK__ = ${inline(JSON.stringify(deck))};</script>
<script type="module">${inline(player)}</script>
</body>
</html>
`;
  const file = join(dir, 'renders', `${slug(project.name)}-presentation.html`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
  return { output: file, bytes: Buffer.byteLength(html), slides: deckSlides(scene.meta, project.slides).length };
}
