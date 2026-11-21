/**
 * Project colour swaps. The design system lets people change a film's colours without touching its code: each
 * swap maps one colour the scene draws with (`#rrggbb`) to another, keeping the alpha the scene asked for. The
 * runtime applies it where a colour enters a context (fill, stroke, shadow and gradient stops), on the frame's
 * own context and on every layer made from it, so the player and exports change together.
 */
export type ColorSwaps = Readonly<Record<string, string>>;

/** One swap table shared by a frame and its layers. `seen` counts the colours drawn, for the design system. */
export interface ColorSwap {
  apply<T>(value: T): T;
  set(swaps: ColorSwaps | undefined): void;
  seen?: Map<string, number> | undefined;
}

const hex2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
export const toHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

/** `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()` as [r, g, b, a]; anything else is null. */
export function parseColor(value: string): [number, number, number, number] | null {
  const s = value.trim().toLowerCase();
  if (s[0] === '#') {
    const h = s.slice(1);
    if (!/^[0-9a-f]+$/.test(h)) return null;
    if (h.length === 3 || h.length === 4) {
      const [r, g, b, a = 'f'] = h.split('').map(c => c + c) as [string, string, string, string?];
      return [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16), parseInt(a.length === 1 ? a + a : a, 16) / 255];
    }
    if (h.length === 6 || h.length === 8) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
    return null;
  }
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s);
  if (!m) return s === 'white' ? [255, 255, 255, 1] : s === 'black' ? [0, 0, 0, 1] : null;
  const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
  return [Number(m[1]), Number(m[2]), Number(m[3]), alpha];
}

/** A swap table; `seen` (optional) receives a count for every colour drawn through it. */
export function colorSwap(swaps?: ColorSwaps, seen?: Map<string, number>): ColorSwap {
  let table: Record<string, string> = {};
  // string → [the colour's #rrggbb, what to draw]: every distinct string is parsed once
  const cache = new Map<string, [string, string] | null>();
  const swap: ColorSwap = {
    seen,
    set(next) {
      table = {};
      for (const [from, to] of Object.entries(next ?? {})) if (parseColor(to)) table[from.toLowerCase()] = to.toLowerCase();
      cache.clear();
    },
    apply<T>(value: T): T {
      if (typeof value !== 'string') return value;
      let hit = cache.get(value);
      if (hit === undefined) {
        const c = parseColor(value);
        if (!c) hit = null;
        else {
          const key = toHex(c[0], c[1], c[2]), to = table[key];
          const out = !to ? value : c[3] >= 1 ? to : (([r, g, b]) => `rgba(${r},${g},${b},${c[3]})`)(parseColor(to)!);
          hit = [key, out];
        }
        cache.set(value, hit);
      }
      if (!hit) return value;
      if (swap.seen) swap.seen.set(hit[0], (swap.seen.get(hit[0]) ?? 0) + 1);
      return hit[1] as T;
    },
  };
  swap.set(swaps);
  return swap;
}

export const COLOR_PROPS = new Set(['fillStyle', 'strokeStyle', 'shadowColor']);
type Gradients = Pick<CanvasRenderingContext2D, 'createLinearGradient' | 'createRadialGradient' | 'createConicGradient'>;
const GRADIENTS = new Set(['createLinearGradient', 'createRadialGradient', 'createConicGradient']);
/** A context method with gradient stops passed through the swap, or undefined for any other key. */
export function swappedGradient(target: Gradients, key: PropertyKey, swap: ColorSwap | undefined) {
  if (!swap || typeof key !== 'string' || !GRADIENTS.has(key)) return undefined;
  const make = (target[key as keyof Gradients] as (...args: number[]) => CanvasGradient).bind(target);
  return (...args: number[]) => {
    const gradient = make(...args), add = gradient.addColorStop.bind(gradient);
    gradient.addColorStop = (offset: number, color: string) => add(offset, swap.apply(color));
    return gradient;
  };
}
