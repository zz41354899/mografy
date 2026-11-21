// "/" or ⌘K anywhere: one search box over everything the editor can reach — commands, projects, layers, shots —
// and plain times ("12", "1:05") to jump the playhead.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { ArrowElbowDownLeftIcon } from '@phosphor-icons/react/dist/csr/ArrowElbowDownLeft';
import { useT } from './i18n.js';
import { marked, score } from './search.js';

export interface SpotItem {
  id: string;
  group: 'time' | 'command' | 'shot' | 'layer' | 'project';
  label: string;
  /** Extra words that should also find the item (an English name, a shortcut). */
  keywords?: string | undefined;
  hint?: string | undefined;
  icon?: ReactNode;
  run(): void;
}

const GROUP_ORDER: SpotItem['group'][] = ['time', 'command', 'shot', 'layer', 'project'];

/** Seconds from "12", "12.5", "12s" or "1:05"; null for anything else. */
export function parseTime(text: string): number | null {
  const s = text.trim();
  let m = /^(\d+(?:\.\d+)?)\s*s?$/.exec(s);
  if (m) return Number(m[1]);
  m = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function Spotlight({ items, onClose, timeItem }: { items: SpotItem[]; onClose(): void; timeItem(seconds: number): SpotItem | null }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { input.current?.focus(); }, []);

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    const time = parseTime(q);
    const jump = time !== null ? timeItem(time) : null;
    const ranked = items
      .map(item => ({ item, rank: q ? Math.max(score(item.label, q), item.keywords ? score(item.keywords, q) - .5 : 0) : (item.group === 'command' ? 1 : item.group === 'shot' ? .9 : 0) }))
      .filter(r => r.rank > 0)
      // Without a query: commands and shots, as a menu. With one: grouped, best match first inside each group.
      .sort((a, b) => GROUP_ORDER.indexOf(a.item.group) - GROUP_ORDER.indexOf(b.item.group) || b.rank - a.rank);
    const out = [...(jump ? [jump] : []), ...ranked.map(r => r.item)];
    // Each group keeps at most eight rows, so one long list of layers does not bury the rest.
    const seen: Record<string, number> = {};
    return out.filter(item => (seen[item.group] = (seen[item.group] ?? 0) + 1) <= 8);
  }, [items, q, timeItem]);
  useEffect(() => { setCursor(0); }, [q]);
  useEffect(() => { list.current?.querySelector(`[data-index="${cursor}"]`)?.scrollIntoView({ block: 'nearest' }); }, [cursor]);

  const run = (item: SpotItem | undefined) => { if (!item) return; onClose(); item.run(); };
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(results.length - 1, c + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(results[cursor]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (q) setQuery(''); else onClose(); }
  };

  let last = '';
  return <div className="spot-backdrop" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="spot" role="dialog" aria-modal="true" aria-label={t.spTitle} onKeyDown={onKey}>
      <label className="spot-input">
        <MagnifyingGlassIcon size={20} aria-hidden="true" />
        <input ref={input} type="text" value={query} placeholder={t.spPlaceholder} aria-label={t.spTitle} role="combobox" aria-expanded="true" aria-controls="spot-list"
          aria-activedescendant={results[cursor] ? `spot-${results[cursor]!.id}` : undefined} onChange={e => setQuery(e.currentTarget.value)} />
        <kbd>esc</kbd>
      </label>
      <div className="spot-list" id="spot-list" role="listbox" ref={list}>
        {results.map((item, index) => {
          const header = item.group !== last ? <div className="spot-group" role="presentation">{t.spGroups[item.group]}</div> : null;
          last = item.group;
          return <div key={item.id} role="presentation">
            {header}
            <div id={`spot-${item.id}`} data-index={index} role="option" aria-selected={index === cursor} className={`spot-row ${index === cursor ? 'on' : ''}`}
              onPointerMove={() => setCursor(index)} onClick={() => run(item)}>
              <span className="spot-icon" aria-hidden="true">{item.icon}</span>
              <span className="spot-label">{marked(item.label, q)}</span>
              {item.hint ? <span className="spot-hint">{item.hint}</span> : null}
              {index === cursor ? <ArrowElbowDownLeftIcon size={14} className="spot-enter" aria-hidden="true" /> : null}
            </div>
          </div>;
        })}
        {!results.length ? <p className="spot-empty">{t.spNothing(query.trim())}</p> : null}
      </div>
      <footer className="spot-foot"><span><kbd>↑</kbd><kbd>↓</kbd> {t.spMove}</span><span><kbd>↵</kbd> {t.spOpen}</span><span>{t.spTimeHint}</span></footer>
    </div>
  </div>;
}
