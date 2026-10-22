// Edits to mografy.json `slides` from the editor's Present mode. Slides are the scene's shots, so the
// editor never adds, moves or removes them; it only changes a shot's page (title, notes, hold) and
// the deck settings. Each edit returns the whole new value, sent as one project patch.
import type { SlidePage, Slides } from '@mografy/core';

const EMPTY: Slides = { hold: 'freeze', music: 'duck', pages: [] };

/** Change shot `shot`'s page. Blank text and an undefined hold are dropped, and trailing empty pages trimmed. */
export function setPage(slides: Slides | undefined, shot: number, change: Partial<SlidePage>): Slides {
  const base = slides ?? EMPTY, pages = [...base.pages];
  while (pages.length <= shot) pages.push({});
  const page: SlidePage = { ...pages[shot], ...change };
  for (const key of ['title', 'notes'] as const) if (key in change && !page[key]?.trim()) delete page[key];
  if ('hold' in change && change.hold === undefined) delete page.hold;
  pages[shot] = page;
  while (pages.length && !Object.keys(pages.at(-1)!).length) pages.pop();
  return { ...base, pages };
}

/** Change the deck settings (default hold, music). */
export function setDeck(slides: Slides | undefined, change: Partial<Pick<Slides, 'hold' | 'music'>>): Slides {
  return { ...(slides ?? EMPTY), ...change };
}
