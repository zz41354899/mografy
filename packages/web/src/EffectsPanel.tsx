import type { CSSProperties } from 'react';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { Section } from './InspectorSection.js';

export type Effects = { glow: number; grain: number };
export function EffectsPanel({ effects, preview, playing, saving, error, onChange, onPreview }: { effects: Effects; preview: boolean; playing: boolean; saving: boolean; error: string; onChange(next: Effects): void; onPreview(enabled: boolean): void }) {
  return <Section title="Image effects" aside={<button className="text-button" disabled={!effects.glow && !effects.grain} onClick={() => onChange({ glow: 0, grain: 0 })}>Clear effects</button>}>
    <div className="effects-body">
      <p className="panel-help">Applied to your exports.</p>
      {([{ id: 'glow', name: 'Glow', help: 'Light around bright edges', max: 1, step: .01 }, { id: 'grain', name: 'Grain', help: 'Film texture', max: .1, step: .001 }] as const).map(({ id, name, help, max, step }) => <div className="effect-control" key={id}>
        <div className="effect-head"><label htmlFor={`effect-${id}`}>{name}</label><div className="effect-value"><input aria-label={`${name} amount`} type="number" min={0} max={100} step={1} value={Math.round(effects[id] / max * 100)} onChange={e => { const percent = e.currentTarget.valueAsNumber; if (Number.isFinite(percent) && percent >= 0 && percent <= 100) onChange({ ...effects, [id]: Math.round(percent) / 100 * max }); }} /><span>%</span><button className="icon-button" aria-label={`Reset ${name}`} title={`Remove ${name.toLowerCase()}`} disabled={!effects[id]} onClick={() => onChange({ ...effects, [id]: 0 })}><ArrowCounterClockwiseIcon size={15} /></button></div></div>
        <input id={`effect-${id}`} aria-label={name} type="range" min={0} max={max} step={step} value={effects[id]} style={{ '--fill': `${effects[id] / max * 100}%` } as CSSProperties} onChange={e => onChange({ ...effects, [id]: e.currentTarget.valueAsNumber })} />
        <p>{help}</p>
      </div>)}
      <div className="effects-compare">
        <span className="control-label">Frame preview</span>
        <div className="segmented" role="radiogroup" aria-label="Frame preview" onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const enabled = e.key === 'Home' ? false : e.key === 'End' ? true : !preview; onPreview(enabled); e.currentTarget.querySelectorAll<HTMLButtonElement>('button')[enabled ? 1 : 0]?.focus(); } }}>
          <button role="radio" aria-checked={!preview} tabIndex={!preview ? 0 : -1} className={!preview ? 'on' : ''} onClick={() => onPreview(false)}>Original</button>
          <button role="radio" aria-checked={preview} tabIndex={preview ? 0 : -1} className={preview ? 'on' : ''} onClick={() => onPreview(true)}>With effects</button>
        </div>
        <p className="panel-help">{preview && playing ? 'Playback shows the original. Pause to see effects.' : preview ? 'Showing effects on the paused frame.' : 'Preview only. Exports use your saved effects.'}</p>
        {preview && playing ? <button className="text-button" onClick={() => onPreview(true)}>Pause to preview</button> : null}
      </div>
      {error ? <p className="error-text" role="alert">{error} <button className="text-button" onClick={() => onChange(effects)}>Retry</button></p> : null}
      <p className="effects-save" role="status">{error ? 'Not saved' : saving ? 'Saving…' : 'Saved automatically'}</p>
    </div>
  </Section>;
}

