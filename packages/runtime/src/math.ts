export const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
export const pr = (t: number, start: number, end: number) => end === start ? (t >= end ? 1 : 0) : clamp((t - start) / (end - start));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const ease = Object.freeze({ linear: (p: number) => p, inQuad: (p: number) => p * p, outCubic: (p: number) => 1 - (1 - p) ** 3, inOutCubic: (p: number) => p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2, outExpo: (p: number) => p === 1 ? 1 : 1 - 2 ** (-10 * p) });
export const srgbToLinear = (p: number) => p <= 0.04045 ? p / 12.92 : ((p + 0.055) / 1.055) ** 2.4;
export const linearToSrgb = (p: number) => p <= 0.0031308 ? 12.92 * p : 1.055 * p ** (1 / 2.4) - 0.055;
export function colorLerp(a: string, b: string, p: number, space: 'srgb' | 'linear' = 'srgb') {
  if (![a, b].every(c => /^#[\da-f]{6}$/i.test(c))) throw new Error('Use #rrggbb colors');
  const channels = [1, 3, 5].map(i => {
    const x = parseInt(a.slice(i, i + 2), 16) / 255, y = parseInt(b.slice(i, i + 2), 16) / 255;
    return Math.round(clamp(space === 'linear' ? linearToSrgb(lerp(srgbToLinear(x), srgbToLinear(y), clamp(p))) : lerp(x, y, clamp(p))) * 255).toString(16).padStart(2, '0');
  });
  return '#' + channels.join('');
}
export function hashNoise(seed: number, ...coordinates: number[]) {
  let h = seed >>> 0;
  for (const v of coordinates) { h ^= Math.round(v * 4096); h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); }
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Stateful randomness is only for one-time preparation. */
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => { state += 0x6d2b79f5; let n = Math.imul(state ^ (state >>> 15), 1 | state); n ^= n + Math.imul(n ^ (n >>> 7), 61 | n); return ((n ^ (n >>> 14)) >>> 0) / 4294967296; };
}
