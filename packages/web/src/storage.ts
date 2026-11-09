// Per-browser conveniences (panel widths, the language). Storage can be missing or refuse writes (private windows,
// blocked site data), so every read falls back and every write is best effort.
export function readLocal(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
/** Store a value; null removes the key. */
export function writeLocal(key: string, value: string | null) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* optional */ }
}
