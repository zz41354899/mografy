import { useMemo, useState } from 'react';
import type { ParameterValue, ParameterValues, Snapshot, TimelineLayer } from '@mografy/core';
import { Section } from './InspectorSection.js';
import { useT } from './i18n.js';
import type { ScenePlayer } from './player.js';
import { usePlayerView } from './usePlayerView.js';

/** S01, S02, …: subtitle numbers in the order their layers appear in the film. */
export function subtitleNumbers(snapshot: Snapshot, layers: TimelineLayer[]): Map<string, string> {
  const ids = Object.entries(snapshot.scene?.params ?? {}).filter(([, d]) => d.type === 'string' && d.role === 'subtitle').map(([id]) => id);
  const start = (id: string) => (layers.find(l => l.base === l.id && l.subtitles.includes(id)) ?? layers.find(l => l.subtitles.includes(id)))?.in ?? 1e9;
  return new Map(ids.sort((a, b) => start(a) - start(b)).map((id, i) => [id, `S${String(i + 1).padStart(2, '0')}`]));
}

/**
 * The scene's subtitle parameters as one list. Each row names the layer that shows it and when, so a click jumps
 * there; edits save like any parameter.
 */
export function Subtitles({ snapshot, values, onChange, onReset, layers, selected, player, onSelect, onSeek }: {
  snapshot: Snapshot; values: ParameterValues; onChange(id: string, v: ParameterValue): void; onReset(id: string): void;
  layers: TimelineLayer[]; selected: string | null; player: ScenePlayer | null; onSelect(id: string): void; onSeek(t: number): void;
}) {
  const t = useT(), time = usePlayerView(player, 'frames').t;
  const defs = snapshot.scene?.params ?? {}, saved = snapshot.project?.params ?? {};
  const rows = useMemo(() => Object.entries(defs).filter(([, d]) => d.type === 'string' && d.role === 'subtitle').map(([id, d]) => {
    const layer = layers.find(l => l.base === l.id && l.subtitles.includes(id)) ?? layers.find(l => l.subtitles.includes(id));
    return { id, name: d.name, def: String(d.default), layer };
  }).sort((a, b) => (a.layer?.in ?? 1e9) - (b.layer?.in ?? 1e9)), [defs, layers]);
  // A short list starts open so each line can be edited at once; a long one starts folded so it stays scannable.
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(false);
  if (!rows.length) return null;
  const q = query.trim().toLowerCase();
  const shown = rows.filter(r => (!q || `${r.name} ${values[r.id] ?? r.def}`.toLowerCase().includes(q)) && (!now || (r.layer && time >= r.layer.in && time < r.layer.out)));
  const open0 = rows.length <= 3, isOpenId = (id: string) => open0 !== flipped.has(id);
  const toggle = (id: string) => setFlipped(s => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const all = shown.every(r => isOpenId(r.id));
  return <Section title={t.subtitles} aside={<span className="hint">{t.subsCount(rows.length)}</span>}>
    <div className="subs-tools">
      <input type="text" placeholder={t.subsSearch} aria-label={t.subsSearch} value={query} onChange={e => setQuery(e.currentTarget.value)} />
      <button className={now ? 'on' : ''} aria-pressed={now} onClick={() => setNow(v => !v)}>{t.subsNow}</button>
      <button onClick={() => setFlipped(new Set(open0 === all ? shown.map(r => r.id) : []))}>{all ? t.collapseAll : t.expandAll}</button>
    </div>
    <ol className="subs">
      {shown.map((r, i) => {
        const value = String(values[r.id] ?? r.def), isOpen = isOpenId(r.id), live = r.layer && time >= r.layer.in && time < r.layer.out;
        const edited = r.id in saved && value !== r.def;
        return <li key={r.id} data-param={r.id} title={r.id} className={`param ${isOpen ? 'open' : ''} ${live ? 'live' : ''} ${edited ? 'edited' : ''} ${r.layer && r.layer.id === selected ? 'selected' : ''}`}>
          <button className="sub-row" aria-expanded={isOpen} onClick={() => { toggle(r.id); if (r.layer) { onSelect(r.layer.id); onSeek(r.layer.in + Math.min(.8, (r.layer.out - r.layer.in) / 2)); } }}>
            <span className="sub-n">S{String(i + 1).padStart(2, '0')}</span>
            <span className="sub-main"><span className="sub-name">{r.name}</span><span className="sub-text">{value}</span></span>
            {r.layer ? <span className="sub-time">{r.layer.in.toFixed(1)}–{r.layer.out.toFixed(1)}s</span> : null}
          </button>
          {isOpen ? <div className="sub-edit">
            <textarea rows={2} maxLength={4096} value={value} aria-label={r.name} onChange={e => onChange(r.id, e.currentTarget.value)} />
            <div className="sub-actions">
              {r.layer ? <span className="hint">{t.boundTo} {r.layer.name}</span> : <span />}
              {edited ? <button className="text-button" onClick={() => onReset(r.id)}>{t.reset}</button> : null}
            </div>
          </div> : null}
        </li>;
      })}
      {!shown.length ? <li className="subs-none">{t.subsNone}</li> : null}
    </ol>
  </Section>;
}
