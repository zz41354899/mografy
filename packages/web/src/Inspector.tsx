import { useState } from 'react';
import type { ParameterValue, ParameterValues, Snapshot } from '@mografy/core';
import type { Session } from './session.js';
import { Parameters } from './Parameters.js';
import { EffectsPanel } from './EffectsPanel.js';
import type { Effects } from './EffectsPanel.js';
import { AudioPanel } from './AudioPanel.js';
import { FrameReview } from './FrameReview.js';

export function Inspector({ snapshot, session, values, onParam, onReset, effects, previewEffects, playing, sound, savingEffects, effectsError, onEffects, onEffectsPreview }: {
  snapshot: Snapshot | null; session: Session; values: ParameterValues;
  onParam(id: string, value: ParameterValue): void; onReset(id: string): void;
  effects: Effects; previewEffects: boolean; playing: boolean; sound: string;
  savingEffects: boolean; effectsError: string; onEffects(next: Effects): void; onEffectsPreview(enabled: boolean): void;
}) {
  const [inspectorTab, setInspectorTab] = useState<'scene' | 'effects' | 'audio'>('scene');
  return (
      <aside className="inspector">
        <div className="inspector-tabs" role="tablist" aria-label="Inspector">
          {(['scene', 'effects', 'audio'] as const).map((id, index, tabs) => <button key={id} id={`${id}-tab`} role="tab" aria-selected={inspectorTab === id} aria-controls={`${id}-panel`} tabIndex={inspectorTab === id ? 0 : -1} onClick={() => setInspectorTab(id)} onKeyDown={e => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
            e.preventDefault(); const next = tabs[e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]!;
            setInspectorTab(next); document.getElementById(`${next}-tab`)?.focus();
          }}>{id === 'scene' ? 'Scene' : id === 'effects' ? 'Effects' : 'Audio'}</button>)}
        </div>
        <div className="inspector-content" id={`${inspectorTab}-panel`} role="tabpanel" aria-labelledby={`${inspectorTab}-tab`} tabIndex={0}>
          {snapshot ? inspectorTab === 'scene' ? <Parameters snapshot={snapshot} values={values} onChange={onParam} onReset={onReset} /> : inspectorTab === 'effects' ? <EffectsPanel effects={effects} preview={previewEffects} playing={playing} saving={savingEffects} error={effectsError} onChange={onEffects} onPreview={onEffectsPreview} /> : <AudioPanel key={snapshot.projectDir} snapshot={snapshot} session={session} sound={sound} /> : null}
        </div>
        {snapshot ? <FrameReview key={snapshot.projectDir} snapshot={snapshot} session={session} /> : null}
      </aside>
  );
}
