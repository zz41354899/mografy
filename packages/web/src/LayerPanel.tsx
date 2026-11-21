import { useState } from 'react';
import type { TimelineLayer } from '@mografy/core';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { CrosshairIcon } from '@phosphor-icons/react/dist/csr/Crosshair';
import { EyeIcon } from '@phosphor-icons/react/dist/csr/Eye';
import { EyeSlashIcon } from '@phosphor-icons/react/dist/csr/EyeSlash';
import { LockSimpleIcon } from '@phosphor-icons/react/dist/csr/LockSimple';
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { Section } from './InspectorSection.js';
import { useT } from './i18n.js';
import type { TimelineEditor } from './useTimeline.js';
import { declaredOf, LAYER_COLOURS, revertLayer, setLayer } from './timeline-edit.js';
import { basename } from './format.js';

/**
 * The scene tab's layer card. With nothing selected it lists every layer (click one to select it and jump there);
 * with a layer selected it shows its name, colour, timing and actions. Timing is dragged on the timeline itself.
 */
export function LayerPanel({ editor, onSeek }: { editor: TimelineEditor; duration?: number; onSeek(t: number): void }) {
  const t = useT();
  const [palette, setPalette] = useState(false);
  const state = editor.state;
  if (!state) return null;
  const l = state.layers.find(x => x.id === editor.selected);
  const sequence = !!editor.meta?.sequence;
  if (!l) return <Section title={t.layerList} aside={<span className="hint">{state.layers.length}</span>}>
    <ul className="lp-list">
      {state.layers.map(x => <li key={x.id}>
        <button className={x.hidden ? 'is-hidden' : ''} onClick={() => { editor.select(x.id); onSeek(x.in); }}>
          <i style={{ background: x.colour ?? '#8a8f98' }} />
          <span>{x.name}</span>
          {x.locked ? <LockSimpleIcon size={12} /> : null}
          {x.edited.length ? <em>{t.changed}</em> : null}
          <small>{x.in.toFixed(1)}–{x.out.toFixed(1)}s</small>
        </button>
      </li>)}
    </ul>
    <p className="sec-foot">{t.lpPick}</p>
  </Section>;
  const declared = declaredOf(l, editor.server?.layers.find(x => x.id === l.id));
  const set = (change: Partial<Pick<TimelineLayer, 'hidden' | 'name' | 'colour' | 'locked'>>) => editor.commit(s => setLayer(s, l.id, change, declared));
  const copy = l.base !== l.id;
  const pills = [l.edited.length ? t.changed : '', copy ? t.copyPill : '', l.locked ? t.locked : '', l.hidden ? t.hiddenPill : ''].filter(Boolean);
  return <Section title={t.layer} aside={<button className="sec-link" onClick={() => editor.select(null)}><CaretLeftIcon size={12} /> {t.lpAll(state.layers.length)}</button>}>
    <div className="layer-panel" aria-label={t.layer}>
      <div className="lp-head">
        <button className="lp-swatch" style={{ background: l.colour ?? '#8a8f98' }} aria-label={t.layerColour} aria-expanded={palette} title={t.layerColour} onClick={() => setPalette(v => !v)} />
        <input className="lp-name" type="text" value={l.name} maxLength={120} aria-label={t.rename} title={l.source ? `${t.declaredIn} ${l.source}` : undefined} onChange={e => { if (e.currentTarget.value.trim()) set({ name: e.currentTarget.value }); }} />
      </div>
      {palette ? <div className="colour-row lp-palette" role="radiogroup" aria-label={t.layerColour}>
        {LAYER_COLOURS.map(c => <button key={c} role="radio" aria-checked={l.colour === c} aria-label={c} className="swatch" style={{ background: c }} onClick={() => { set({ colour: c }); setPalette(false); }} />)}
        <label className="swatch custom" title={t.customColour}><input type="color" value={l.colour ?? '#8a8f98'} aria-label={t.customColour} onChange={e => set({ colour: e.currentTarget.value })} /></label>
      </div> : null}
      {pills.length ? <div className="lp-pills">{pills.map(p => <span key={p}>{p}</span>)}</div> : null}
      <dl className="lp-facts">
        <div><dt>{t.in}</dt><dd>{l.in.toFixed(2)}s</dd></div>
        <div><dt>{t.length}</dt><dd>{(l.out - l.in).toFixed(2)}s</dd></div>
        <div><dt>{t.enter}</dt><dd>{t.motions[l.enter] ?? l.enter}</dd></div>
        <div><dt>{t.exit}</dt><dd>{t.motions[l.exit] ?? l.exit}</dd></div>
      </dl>
      <div className="lp-actions">
        <button onClick={() => onSeek(l.in)}><CrosshairIcon size={14} /> {t.jump}</button>
        <button className={l.locked ? 'on' : ''} aria-pressed={l.locked} onClick={() => set({ locked: !l.locked })}><LockSimpleIcon size={14} /> {l.locked ? t.unlock : t.lock}</button>
        {sequence ? null : <button aria-pressed={l.hidden} title="H" onClick={() => set({ hidden: !l.hidden })}>{l.hidden ? <EyeSlashIcon size={14} /> : <EyeIcon size={14} />} {l.hidden ? t.show : t.hide}</button>}
        {l.edited.length ? <button onClick={() => { editor.commit(s => ({ ...s, edits: revertLayer(s, l.id) })); editor.flash(t.toastReverted); }}><ArrowCounterClockwiseIcon size={14} /> {t.revert}</button> : null}
      </div>
      <p className="sec-foot">{sequence ? t.sequenceNote : t.lpHint}</p>
    </div>
  </Section>;
}

/** What the editor has written to the scene's timeline file. */
export function TimelineFile({ editor }: { editor: TimelineEditor }) {
  const t = useT();
  if (!editor.state || !editor.meta) return null;
  const edits = editor.state.edits;
  return <details className="timeline-file">
    <summary>{basename(editor.meta.file)}</summary>
    <pre>{Object.keys(edits).length ? JSON.stringify(edits, null, 2) : t.noChanges}</pre>
  </details>;
}
