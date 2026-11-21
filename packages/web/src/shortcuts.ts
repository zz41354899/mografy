// Document-wide keyboard shortcuts share one rule: a key typed into a field, or pressed while a modal is open,
// belongs to that field or modal. Modals listen in the capture phase, so their Esc runs first and marks the event
// handled (preventDefault) before any editor shortcut sees it.
import { useEffect, useRef } from 'react';

const FIELD = 'input, textarea, select, [contenteditable="true"], dialog, [role="dialog"]';
const MODAL = 'dialog[open], [aria-modal="true"]';

/** True when an editor shortcut should leave this key alone. */
export function ignoreKey(e: KeyboardEvent) {
  const target = e.target as Element | null;
  return e.defaultPrevented || Boolean(target?.closest?.(FIELD)) || Boolean(document.querySelector(MODAL));
}

/** Listen for keydown on the document while `enabled`; the handler always sees the latest render's values. */
export function useKeydown(handler: (e: KeyboardEvent) => void, { enabled = true, modal = false }: { enabled?: boolean; modal?: boolean } = {}) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => latest.current(e);
    document.addEventListener('keydown', onKey, { capture: modal });
    return () => document.removeEventListener('keydown', onKey, { capture: modal });
  }, [enabled, modal]);
}

/** Esc closes a modal panel. */
export function useEscape(onClose: () => void) {
  useKeydown(e => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onClose(); } }, { modal: true });
}
