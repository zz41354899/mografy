import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayersMeta, Snapshot, TimelineEdits } from '@mografy/core';
import { callApi } from './api.js';
import type { Session } from './session.js';
import { History, stateOf } from './timeline-edit.js';
import type { TimelineState } from './timeline-edit.js';

/** Key order differs between the editor and the scene's copy of the edits, so compare canonically. */
const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical((v as Record<string, unknown>)[k])])) : v;
const same = (a: TimelineEdits, b: TimelineEdits) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/**
 * The scene's editable layers with optimistic edits: changes show on the timeline at once and are saved (debounced)
 * to the scene's timeline file, which the server compiles and trial-renders before the player shows them.
 */
export function useTimeline(snapshot: Snapshot | null, session: Session) {
  const dir = snapshot?.projectDir, meta: LayersMeta | undefined = snapshot?.scene?.meta.layers;
  const serverKey = `${dir}|${snapshot?.scene?.version ?? ''}`;
  const [local, setLocal] = useState<{ dir: string | undefined; state: TimelineState } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean; undo?: boolean } | null>(null);
  const history = useRef(new History());
  const pending = useRef<TimelineEdits | null>(null), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dragging = useRef(false), active = useRef(dir); active.current = dir;
  const server = useMemo(() => meta ? stateOf(meta) : null, [meta]);

  useEffect(() => { history.current.clear(); setSelected(null); setLocal(null); pending.current = null; clearTimeout(timer.current); }, [dir]);
  // A new published version replaces the optimistic state once nothing is waiting to be saved.
  // After a save, keep showing it until the published version carries it: the HTTP reply can arrive before the
  // new snapshot, and syncing to the older one in between makes the layer jump back and forth.
  const awaiting = useRef<{ edits: TimelineEdits; until: number } | null>(null);
  useEffect(() => {
    if (!server || dragging.current || pending.current || saving) return;
    const wait = awaiting.current;
    if (wait && !same(server.edits, wait.edits) && performance.now() < wait.until) return;
    awaiting.current = null;
    setLocal({ dir, state: server });
  }, [serverKey, server, dir, saving]);

  const state = local?.dir === dir && local ? local.state : server;
  const flash = useCallback((text: string, error = false, undo = false) => { const next = { text, error, undo }; setToast(next); setTimeout(() => setToast(t => t === next ? null : t), error || undo ? 6000 : 2600); }, []);

  const save = useCallback((edits: TimelineEdits) => {
    pending.current = edits;
    clearTimeout(timer.current);
    const expected = dir;
    timer.current = setTimeout(() => {
      const body = pending.current; if (!body || expected !== active.current) return;
      setSaving(true);
      callApi('timeline', 'PUT', { edits: body, clientId: session.clientId }, expected)
        .then(() => { if (pending.current === body) { pending.current = null; awaiting.current = { edits: body, until: performance.now() + 4000 }; } })
        .catch((error: Error) => { if (pending.current === body) pending.current = null; if (active.current === expected) { flash(error.message, true); setLocal(null); } })
        .finally(() => setSaving(false));
    }, 250);
  }, [dir, session.clientId, flash]);

  /** Apply a change: recorded for undo and saved. */
  const commit = useCallback((change: (s: TimelineState) => TimelineState, before?: TimelineState) => {
    if (!state) return;
    const next = change(state);
    if (next === state && !before) return;
    if (same(next.edits, (before ?? state).edits)) { setLocal({ dir, state: next }); return; }
    history.current.push(before ?? state);
    setLocal({ dir, state: next });
    save(next.edits);
  }, [state, dir, save]);
  /** Show a change while dragging, without saving it. */
  const preview = useCallback((next: TimelineState) => { dragging.current = true; setLocal({ dir, state: next }); }, [dir]);
  const endDrag = useCallback((before: TimelineState) => {
    dragging.current = false;
    setLocal(current => {
      if (current && !same(current.state.edits, before.edits)) { history.current.push(before); save(current.state.edits); }
      return current;
    });
  }, [save]);
  const undo = useCallback(() => {
    if (!state) return false;
    const previous = history.current.undo(state); if (!previous) return false;
    setLocal({ dir, state: previous }); save(previous.edits); return true;
  }, [state, dir, save]);
  const redo = useCallback(() => {
    if (!state) return false;
    const next = history.current.redo(state); if (!next) return false;
    setLocal({ dir, state: next }); save(next.edits); return true;
  }, [state, dir, save]);

  const file = meta?.file ?? 'scenes/timeline.json';

  return { meta, file, server, state, selected, select: setSelected, commit, preview, endDrag, undo, redo, saving, toast, flash };
}
export type TimelineEditor = ReturnType<typeof useTimeline>;
