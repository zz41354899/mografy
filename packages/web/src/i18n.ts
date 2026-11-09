// Interface language: Traditional Chinese or English. Every string the interface shows lives in locales/; the
// choice is a per-viewer convenience kept in this browser.
import { createContext, useContext } from 'react';
import { en } from './locales/en.js';
import { zh } from './locales/zh.js';
import type { Dict } from './locales/zh.js';
import { readLocal, writeLocal } from './storage.js';

export type Lang = 'zh' | 'en';
export type T = Dict;
export const DICTS: Record<Lang, Dict> = { zh, en };
const KEY = 'mografy.lang';

export function initialLang(): Lang {
  const saved = readLocal(KEY); if (saved === 'zh' || saved === 'en') return saved;
  return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}
export const saveLang = (lang: Lang) => writeLocal(KEY, lang);

export const LangContext = createContext<Lang>('en');
export const useT = (): T => DICTS[useContext(LangContext)];
