// Entry point of an exported presentation file. Everything the scene needs (its compiled code,
// fonts, images, music) is embedded in the page, so the file opens offline by double-clicking.
import { DeckApp } from './deck-app.js';
import type { DeckSource } from './deck-app.js';
import './deck.css';

interface EmbeddedDeck extends DeckSource {
  name: string;
  /** The compiled scene module. */
  scene: string;
  /** Project-relative path → { type, base64 data }. */
  assets: Record<string, { type: string; data: string }>;
}

function blobUrl(data: string, type: string) {
  const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type }));
}

const embedded = (window as unknown as { __MOGRAFY_DECK__?: EmbeddedDeck }).__MOGRAFY_DECK__;
const root = document.getElementById('deck')!;
document.documentElement.classList.add('deck-page');
if (!embedded) root.textContent = 'This presentation file is incomplete.';
else {
  document.title = embedded.name;
  const scene = URL.createObjectURL(new Blob([embedded.scene], { type: 'text/javascript' }));
  const assetUrls = Object.fromEntries(Object.entries(embedded.assets).map(([path, asset]) => [path, blobUrl(asset.data, asset.type)]));
  const app = new DeckApp(root, { sources: { sceneUrl: () => scene, assetBase: './', assetUrls } });
  app.setSource(embedded);
}
