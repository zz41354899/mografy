// Present mode for scenes that do not list `meta.shots`: guess the shots so every project has slides.
// The storyboard's shot table wins when it covers the whole scene; otherwise the picture decides.
import type { Shot } from './index.js';

export type AutoShotSource = 'storyboard' | 'picture';
export interface AutoShots { source: AutoShotSource; shots: Shot[] }
/** Tiny greyscale frames sampled every `step` seconds from 0 (see the render host's `motion`). */
export interface MotionFrames { step: number; size: number; data: Uint8Array }

const NUMBER = String.raw`(\d+(?::\d{1,2}(?:\.\d+)?)?(?:\.\d+)?)`;
const RANGE = new RegExp(String.raw`^\s*${NUMBER}\s*s?\s*(?:–|—|-|~|→|to)\s*${NUMBER}\s*(?:s|sec|secs|seconds|秒)?\s*$`, 'i');
const seconds = (text: string) => {
  const [m, s] = text.split(':');
  return s === undefined ? Number(m) : Number(m) * 60 + Number(s);
};
const plain = (cell: string) => cell.replace(/\*\*|__|`|\*/g, '').replace(/<[^>]+>/g, '').trim();
const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map(plain);
const isRule = (row: string[]) => row.every(cell => /^:?-{2,}:?$/.test(cell));
const range = (cell: string) => {
  const match = RANGE.exec(cell);
  if (!match) return undefined;
  const start = seconds(match[1]!), end = seconds(match[2]!);
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : undefined;
};
const TIME_HEADER = /time|秒|時間|時段|sec/i;
const TITLE_HEADERS = [/title|標題|name|名稱/i, /purpose|beat|idea|目的|段落/i, /copy|text|line|文案|字幕|台詞/i, /^shot$|^鏡頭$/i, /screen|scene|畫面/i];
const ID = /^(?:s|shot\s*)?\d+[a-z]?$|^#?\d+$/i;
function titleOf(text: string) {
  const title = text.replace(/^\s*[（(][^)）]*[)）]\s*/, '').split(/\s[—–]\s|(?<=[^\d\s])[.;:]\s|(?<=\S)\s*[（(]/)[0]!.replace(/^["“「『']+|["”」』']+$/g, '').replace(/\s*\/\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return !title || /^[—–-]+$/.test(title) ? undefined : title.length > 60 ? `${title.slice(0, 59).trimEnd()}…` : title;
}

/**
 * Shots from a storyboard's shot table (`| S01 | 0.0–6.0 | … |`). Only a table whose time ranges run in
 * order from the start to the scene's end counts: an outdated board for another cut is ignored.
 */
export function storyboardShots(markdown: string, duration: number): Shot[] | null {
  const lines = markdown.split(/\r?\n/);
  let best: Shot[] | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]!.trim().startsWith('|') || !lines[i + 1]?.trim().startsWith('|') || !isRule(cells(lines[i + 1]!))) continue;
    const header = cells(lines[i]!);
    const rows: string[][] = [];
    for (i += 2; i < lines.length && lines[i]!.trim().startsWith('|'); i++) rows.push(cells(lines[i]!));
    const named = header.findIndex(cell => TIME_HEADER.test(cell));
    const timeColumn = named >= 0 && rows.some(row => range(row[named] ?? '')) ? named : header.findIndex((_, c) => rows.some(row => range(row[c] ?? '')));
    if (timeColumn < 0) continue;
    const titleColumns = [
      ...TITLE_HEADERS.map(pattern => header.findIndex((cell, c) => c !== timeColumn && pattern.test(cell))).filter(c => c >= 0),
      ...header.map((_, c) => c).filter(c => c !== timeColumn),
    ];
    const shots: Shot[] = [];
    let previous = 0;
    for (const row of rows) {
      const span = range(row[timeColumn] ?? '');
      if (!span) continue;
      if (Math.abs(span.start - previous) > 0.6 || span.end <= previous) { shots.length = 0; break; }
      // A trailing "(hold)" row only lengthens the shot before it.
      if (shots.length && row.some(cell => /^\(?hold\)?$/i.test(cell))) { shots[shots.length - 1]!.end = Math.min(span.end, duration); previous = span.end; continue; }
      const title = titleColumns.map(c => row[c] ?? '').filter(cell => !ID.test(cell) && !range(cell)).map(titleOf).find(Boolean);
      shots.push({ end: Math.min(span.end, duration), ...(title ? { title } : {}) });
      previous = span.end;
    }
    if (shots.length >= 2 && Math.abs(previous - duration) <= 0.6 && (!best || shots.length > best.length)) best = shots;
  }
  if (best) best[best.length - 1]!.end = duration;
  return best;
}

/** Mean absolute difference between two sampled frames, 0–1. */
function distance(frames: MotionFrames, a: number, b: number) {
  const { size, data } = frames;
  let sum = 0;
  for (let p = 0; p < size; p++) sum += Math.abs(data[a * size + p]! - data[b * size + p]!);
  return sum / size / 255;
}
const count = (frames: MotionFrames) => Math.floor(frames.data.length / frames.size);
const MIN_SHOT = 3;

/** Shot ends where the picture turns into something else: the strongest changes, at least three seconds apart. */
export function pictureShotEnds(frames: MotionFrames, duration: number): number[] {
  const n = count(frames), reach = Math.max(1, Math.round(0.4 / frames.step));
  if (n < 3) return [];
  const change = Array.from({ length: n }, (_, i) => distance(frames, Math.max(0, i - reach), Math.min(n - 1, i + reach)));
  const sorted = [...change].sort((a, b) => a - b), threshold = 0.5 * sorted[Math.floor(0.9 * (n - 1))]!;
  const chosen: number[] = [];
  for (const i of change.map((_, i) => i).sort((a, b) => change[b]! - change[a]!)) {
    const t = i * frames.step;
    if (change[i]! < threshold || change[i]! < 0.004) break;
    if (t < 1.5 || t > duration - 1.5) continue;
    if (chosen.every(c => Math.abs(c - t) >= MIN_SHOT)) chosen.push(t);
  }
  return chosen.sort((a, b) => a - b);
}

/**
 * Where a shot should wait: the stillest moment shortly before it ends (content built, exit not begun).
 * Among equally still moments the latest wins.
 */
export function settledStop(frames: MotionFrames, start: number, end: number) {
  const n = count(frames), step = frames.step;
  const motion = (i: number) => i > 0 && i < n ? distance(frames, i - 1, i) : 0;
  const from = Math.max(start + 0.3 * (end - start), end - 1.2), to = end - 0.3;
  const candidates: number[] = [];
  for (let i = Math.ceil(from / step - 1e-6); i * step <= to + 1e-6 && i < n; i++) candidates.push(i);
  if (!candidates.length) return Math.max(start, end - 0.3);
  const score = candidates.map(i => motion(i - 2) + motion(i - 1) + motion(i) + motion(i + 1) + motion(i + 2));
  const top = Math.max(...score, 1e-9);
  let best = 0;
  candidates.forEach((_, k) => { if (Math.round(score[k]! / top * 10) <= Math.round(score[best]! / top * 10)) best = k; });
  return Math.round(candidates[best]! * step * 1000) / 1000;
}

/** Shots for a scene without `meta.shots`: storyboard ends when the board fits, else picture changes; stops from the picture. */
export function autoShots(input: { duration: number; frames: MotionFrames; storyboard?: string | undefined }): AutoShots {
  const { duration, frames } = input;
  const board = input.storyboard ? storyboardShots(input.storyboard, duration) : null;
  const source: AutoShotSource = board ? 'storyboard' : 'picture';
  const planned: Shot[] = board ?? [...pictureShotEnds(frames, duration).map(end => ({ end })), { end: duration }];
  const shots: Shot[] = [];
  planned.forEach((shot, i) => {
    const start = shots.at(-1)?.end ?? 0;
    if (shot.end - start < 0.5 && i < planned.length - 1) return;
    const last = i === planned.length - 1;
    shots.push({ end: last ? duration : shot.end, ...(last ? {} : { stop: settledStop(frames, start, shot.end) }), ...(shot.title ? { title: shot.title } : {}) });
  });
  return { source, shots };
}
