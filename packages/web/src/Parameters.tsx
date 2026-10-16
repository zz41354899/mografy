import type { CSSProperties, ReactNode } from 'react';
import type { ParameterDefinition, ParameterValue, ParameterValues, Snapshot } from '@mografy/core';
import { Section } from './InspectorSection.js';

function ParamControl({ id, def, value, saved, onChange, onReset }: { id: string; def: ParameterDefinition; value: ParameterValue; saved: boolean; onChange(v: ParameterValue): void; onReset(): void }) {
  let control: ReactNode;
  switch (def.type) {
    case 'number': control = <div className="number-control">
      <input type="range" min={def.min} max={def.max} step={def.step ?? (def.max - def.min) / 200} value={Number(value)} onChange={e => onChange(e.currentTarget.valueAsNumber)} aria-label={def.name} style={{ '--fill': `${((Number(value) - def.min) / (def.max - def.min || 1)) * 100}%` } as CSSProperties} />
      <input type="number" min={def.min} max={def.max} step={def.step ?? 'any'} value={Number(value)} onChange={e => { const n = e.currentTarget.valueAsNumber; if (Number.isFinite(n) && n >= def.min && n <= def.max) onChange(n); }} aria-label={`${def.name} value`} />
    </div>; break;
    case 'color': control = <label className="color-control"><input type="color" value={String(value)} onChange={e => onChange(e.currentTarget.value)} aria-label={def.name} /><code>{String(value)}</code></label>; break;
    case 'boolean': control = <label className="switch"><input type="checkbox" role="switch" checked={Boolean(value)} onChange={e => onChange(e.currentTarget.checked)} aria-label={def.name} /><span className="knob" /><span>{value ? 'On' : 'Off'}</span></label>; break;
    case 'enum': control = <div className="segmented" role="radiogroup" aria-label={def.name}>{def.options.map(o => <button key={o} role="radio" aria-checked={value === o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>{o}</button>)}</div>; break;
    case 'string': control = <textarea rows={2} value={String(value)} maxLength={4096} onChange={e => onChange(e.currentTarget.value)} aria-label={def.name} />; break;
  }
  return <div className={`param ${saved ? 'edited' : ''}`} data-param={id} title={id}>
    <div className="param-head"><span>{def.name}</span>{saved ? <button className="text-button" onClick={onReset} title="Back to the scene's default">Reset</button> : null}</div>
    {control}
  </div>;
}

export function Parameters({ snapshot, values, onChange, onReset }: { snapshot: Snapshot; values: ParameterValues; onChange(id: string, v: ParameterValue): void; onReset(id: string): void }) {
  const defs = snapshot.scene?.params ?? {}, saved = snapshot.project?.params ?? {};
  const text = Object.entries(defs).filter(([, def]) => def.type === 'string' && def.role === 'subtitle');
  const colours = Object.entries(defs).filter(([, def]) => def.type === 'color');
  const controls = Object.entries(defs).filter(([, def]) => def.type !== 'string' && def.type !== 'color');
  const fields = (entries: typeof text) => entries.map(([id, def]) => <ParamControl key={id} id={id} def={def} value={values[id] ?? def.default} saved={id in saved && values[id] !== def.default} onChange={v => onChange(id, v)} onReset={() => onReset(id)} />);
  return <>
    {text.length ? <Section title="Subtitles" aside={<span className="hint">Auto-save</span>}>
      <p className="panel-help">Ask AI to change other text.</p>
      {fields(text)}
    </Section> : null}
    {colours.length ? <Section title="Colors">{fields(colours)}</Section> : null}
    {controls.length ? <Section title="Controls">{fields(controls)}</Section> : null}
    {!text.length && !colours.length && !controls.length ? <Section title="Scene settings"><p className="empty">This scene has no adjustable settings. Ask AI to change its content.</p></Section> : null}
  </>;
}

