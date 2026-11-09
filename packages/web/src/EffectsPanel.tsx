import type { CSSProperties } from 'react';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { Section } from './InspectorSection.js';
import { useT } from './i18n.js';

export type Effects = { glow: number; grain: number };
export function EffectsPanel({ effects, preview, playing, saving, error, onChange, onPreview }: { effects: Effects; preview: boolean; playing: boolean; saving: boolean; error: string; onChange(next: Effects): void; onPreview(enabled: boolean): void }) {
  const t = useT();
  return <Section title={t.fxTitle} aside={<button className="text-button" disabled={!effects.glow && !effects.grain} onClick={() => onChange({ glow: 0, grain: 0 })}>{t.fxClear}</button>}>
    <div className="effects-body">
      <p className="panel-help">{t.fxHelp}</p>
      {([{ id: 'glow', name: t.fxGlow, help: t.fxGlowHelp, max: 1, step: .01 }, { id: 'grain', name: t.fxGrain, help: t.fxGrainHelp, max: .1, step: .001 }] as const).map(({ id, name, help, max, step }) => <div className="effect-control" key={id}>
        <div className="effect-head"><label htmlFor={`effect-${id}`}>{name}</label><div className="effect-value"><input aria-label={t.fxAmount(name)} type="number" min={0} max={100} step={1} value={Math.round(effects[id] / max * 100)} onChange={e => { const percent = e.currentTarget.valueAsNumber; if (Number.isFinite(percent) && percent >= 0 && percent <= 100) onChange({ ...effects, [id]: Math.round(percent) / 100 * max }); }} /><span>%</span><button className="icon-button" aria-label={t.fxReset(name)} title={t.fxRemove(name)} disabled={!effects[id]} onClick={() => onChange({ ...effects, [id]: 0 })}><ArrowCounterClockwiseIcon size={15} /></button></div></div>
        <input id={`effect-${id}`} aria-label={name} type="range" min={0} max={max} step={step} value={effects[id]} style={{ '--fill': `${effects[id] / max * 100}%` } as CSSProperties} onChange={e => onChange({ ...effects, [id]: e.currentTarget.valueAsNumber })} />
        <p>{help}</p>
      </div>)}
      <div className="effects-compare">
        <span className="control-label">{t.fxPreview}</span>
        <div className="segmented" role="radiogroup" aria-label={t.fxPreview} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const enabled = e.key === 'Home' ? false : e.key === 'End' ? true : !preview; onPreview(enabled); e.currentTarget.querySelectorAll<HTMLButtonElement>('button')[enabled ? 1 : 0]?.focus(); } }}>
          <button role="radio" aria-checked={!preview} tabIndex={!preview ? 0 : -1} className={!preview ? 'on' : ''} onClick={() => onPreview(false)}>{t.fxOriginal}</button>
          <button role="radio" aria-checked={preview} tabIndex={preview ? 0 : -1} className={preview ? 'on' : ''} onClick={() => onPreview(true)}>{t.fxWith}</button>
        </div>
        <p className="panel-help">{preview && playing ? t.fxPlaying : preview ? t.fxPaused : t.fxPreviewOnly}</p>
        {preview && playing ? <button className="text-button" onClick={() => onPreview(true)}>{t.fxPause}</button> : null}
      </div>
      {error ? <p className="error-text" role="alert">{error} <button className="text-button" onClick={() => onChange(effects)}>{t.retry}</button></p> : null}
      <p className="effects-save" role="status">{error ? t.fxNotSaved : saving ? t.fxSaving : t.fxSaved}</p>
    </div>
  </Section>;
}

