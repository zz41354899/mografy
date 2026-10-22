// Video / Present switch and Present mode: the scene's shots as slides, their notes and holds,
// slide previews, the presentation window and HTML export.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deckSlides } from '@mografy/core';
import type { SlidePage, Slides, Snapshot } from '@mografy/core';
import { callApi } from './api.js';
import type { ScenePlayer } from './player.js';
import type { Session } from './session.js';
import { setDeck, setPage } from './slides-edit.js';

export type EditorMode = 'video' | 'present';
export interface DeckFile { output: string; bytes: number; slides: number }

/** Hand the exported file to the browser as a download, so it lands in Downloads like any export. */
function download(file: DeckFile) {
  const name = file.output.split(/[\\/]/).pop()!;
  const link = Object.assign(document.createElement('a'), { href: `/__mografy/files/renders/${encodeURIComponent(name)}?download`, download: name });
  document.body.append(link); link.click(); link.remove();
}

/** `loaded` is the scene version the player has loaded, so a slide is shown once it can be drawn. */
export function usePresentMode(snapshot: Snapshot | null, session: Session, player: ScenePlayer | null, loaded: string | null) {
  const [chosen, setChosen] = useState<EditorMode>(() => { try { return localStorage.getItem('mografy.mode') === 'present' ? 'present' : 'video'; } catch { return 'video'; } });
  const [blocked, setBlocked] = useState(false);
  const [selected, setSelected] = useState(0);
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [exporting, setExporting] = useState(false), [deck, setDeckFile] = useState<DeckFile | null>(null);
  const dir = snapshot?.projectDir, builtIn = snapshot?.builtIn === true, meta = snapshot?.scene?.meta, settings = snapshot?.project?.slides;
  const slides = useMemo(() => meta ? deckSlides(meta, settings) : [], [meta, settings]);
  // Built-in components are references, not presentations: they always open in Video mode.
  const mode: EditorMode = builtIn ? 'video' : chosen;
  useEffect(() => { setSelected(0); setError(''); setDeckFile(null); setBlocked(false); }, [dir]);

  const setMode = useCallback((next: EditorMode) => {
    if (next === 'present' && builtIn) { setBlocked(true); return; }
    setBlocked(false); setChosen(next); setError('');
    try { localStorage.setItem('mografy.mode', next); } catch { /* optional */ }
  }, [builtIn]);

  const current = Math.min(selected, Math.max(0, slides.length - 1)), slide = slides[current];
  /** Show a slide's resting frame, still. The editor never plays on its own: loops run only in Preview and the presentation. */
  const show = useCallback((index: number) => {
    const target = slides[index];
    setSelected(index);
    if (target && player) player.holdAt(target.at, null);
  }, [slides, player]);
  // Entering Present mode, or a new version loading under it, shows the selected slide's frame.
  useEffect(() => { if (mode === 'present' && slide && player) player.holdAt(slide.at, null); }, [mode, loaded, player, slide?.at]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (mode === 'video') player?.pause(); }, [mode, player]);
  /** Play the transition into the slide and stop on it, as the audience will see it. */
  const preview = useCallback(() => {
    if (slide && player) player.playTo(slide.start, slide.at, slide.loopFrom, settings?.music !== 'off');
  }, [slide, player, settings?.music]);

  // Present mode keys: arrows and Page Up / Down move between slides, Space or Enter previews.
  useEffect(() => {
    if (mode !== 'present') return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || target?.closest('dialog, input, textarea, select, [contenteditable="true"]')) return;
      const step = ['ArrowRight', 'ArrowDown', 'PageDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key) ? -1 : 0;
      if (step) { event.preventDefault(); show(Math.min(slides.length - 1, Math.max(0, current + step))); }
      else if ((event.key === ' ' || event.key === 'Enter') && !target?.closest('button, a, summary')) { event.preventDefault(); preview(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mode, show, preview, slides.length, current]);

  const pending = useRef<Promise<void>>(Promise.resolve());
  const save = useCallback((next: Slides) => {
    setSaving(true);
    const task = (async () => {
      try { await session.patchProject({ slides: next }); setError(''); }
      catch (e) { setError(e instanceof Error ? e.message : String(e)); }
      finally { setSaving(false); }
    })();
    pending.current = task;
    return task;
  }, [session]);
  const changePage = useCallback((change: Partial<SlidePage>) => { if (slide) void save(setPage(settings, slide.shot, change)); }, [slide, settings, save]);
  const changeDeck = useCallback((change: Partial<Pick<Slides, 'hold' | 'music'>>) => { void save(setDeck(settings, change)); }, [settings, save]);

  const start = useCallback(() => {
    player?.pause();
    // Leave a focused title or notes field first, so its draft saves before the page changes.
    (document.activeElement as HTMLElement | null)?.blur();
    void pending.current.then(() => location.assign('/present'));
  }, [player]);
  const exportHtml = useCallback(async () => {
    setExporting(true); setError('');
    try {
      const file = await callApi<DeckFile>('deck', 'POST', {}, dir);
      setDeckFile(file);
      download(file);
    }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setExporting(false); }
  }, [dir]);

  return {
    mode, setMode, builtIn, blocked, dismissBlocked: () => setBlocked(false),
    slides, settings, selected: current, slide, show, preview, changePage, changeDeck,
    hasShots: Boolean(meta?.shots?.length), saving, error, start, exportHtml, exporting, deck,
  };
}
