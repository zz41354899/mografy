// Viewer preferences from the settings panel (the gear): kept per browser, never written to the project.
import { createContext, useContext } from 'react';
import type { Lang } from './i18n.js';
import { readLocal, writeLocal } from './storage.js';

export interface Settings {
  lang: Lang;
  /** Snap layers, shots and transitions to beats, the playhead and edges while dragging. */
  snapping: boolean;
  /** Scroll a zoomed timeline to keep the playhead in view while playing. */
  follow: boolean;
  density: 'standard' | 'compact';
  /** Interface text size, 0.9–1.25. */
  textScale: number;
  /** How the transport shows time: timecode (mm:ss:ff), seconds or frame numbers. */
  timeFormat: 'timecode' | 'seconds' | 'frames';
  /** Loop playback when a project opens. */
  loop: boolean;
  /** Draw the music's beat and bar lines on the timeline. */
  beats: boolean;
  /** Calm the interface: no panel slides, fades or springs. */
  reduceMotion: boolean;
}
export const DEFAULT_SETTINGS: Omit<Settings, 'lang'> = { snapping: true, follow: true, density: 'standard', textScale: 1, timeFormat: 'timecode', loop: true, beats: true, reduceMotion: false };
export const TEXT_SCALES = [0.9, 1, 1.1, 1.25] as const;
const KEY = 'mografy.settings';

export function loadSettings(lang: Lang): Settings {
  const base: Settings = { lang, ...DEFAULT_SETTINGS };
  try {
    const saved = JSON.parse(readLocal(KEY) ?? 'null') as Partial<Settings> | null;
    if (!saved) return base;
    return {
      lang: saved.lang === 'zh' || saved.lang === 'en' ? saved.lang : lang,
      snapping: saved.snapping !== false, follow: saved.follow !== false,
      density: saved.density === 'compact' ? 'compact' : 'standard',
      textScale: TEXT_SCALES.includes(saved.textScale as typeof TEXT_SCALES[number]) ? saved.textScale! : 1,
      timeFormat: saved.timeFormat === 'seconds' || saved.timeFormat === 'frames' ? saved.timeFormat : 'timecode',
      loop: saved.loop !== false, beats: saved.beats !== false, reduceMotion: saved.reduceMotion === true,
    };
  } catch { return base; }
}
export function saveSettings(settings: Settings) { writeLocal(KEY, JSON.stringify(settings)); }

export const SettingsContext = createContext<Settings>({ lang: 'en', ...DEFAULT_SETTINGS });
export const useSettings = () => useContext(SettingsContext);
