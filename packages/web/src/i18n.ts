// Interface language: Traditional Chinese or English. Every string the interface shows lives in locales/; the
// choice is a per-viewer convenience kept in localStorage. zh/en hold the editor panel; zh-main/en-main hold the
// batch export and preview-zoom strings that only this version has. The panel's strings win where both name a key.
import { createContext, useContext } from 'react';
import { en } from './locales/en.js';
import { zh } from './locales/zh.js';
import { en as enMain } from './locales/en-main.js';
import { zh as zhMain } from './locales/zh-main.js';
import type { Dict as PanelDict } from './locales/zh.js';
import type { Dict as MainDict } from './locales/zh-main.js';
import { readLocal, writeLocal } from './storage.js';

export type Lang = 'zh' | 'en';
export type Dict = Omit<MainDict, keyof PanelDict> & PanelDict;
export type T = Dict;
export const DICTS: Record<Lang, Dict> = { zh: { ...zhMain, ...zh }, en: { ...enMain, ...en } };
const KEY = 'mografy.lang';

export function initialLang(): Lang {
  const saved = readLocal(KEY); if (saved === 'zh' || saved === 'en') return saved;
  return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}
export const saveLang = (lang: Lang) => writeLocal(KEY, lang);

export const LangContext = createContext<Lang>('en');
export const useT = (): T => DICTS[useContext(LangContext)];
