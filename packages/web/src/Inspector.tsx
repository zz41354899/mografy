import { useEffect, useState } from 'react';
import type { ParameterValue, ParameterValues, Snapshot } from '@mografy/core';
import type { Session } from './session.js';
import { Parameters } from './Parameters.js';
import { EffectsPanel } from './EffectsPanel.js';
import type { Effects } from './EffectsPanel.js';
import { AudioPanel } from './AudioPanel.js';
import { FrameReview } from './FrameReview.js';
import { LayerPanel } from './LayerPanel.js';
import { Subtitles } from './Subtitles.js';
import { DesignPanel } from './DesignSystem.js';
import { useT } from './i18n.js';
import type { TimelineEditor } from './useTimeline.js';
import type { ScenePlayer } from './player.js';

type Tab = 'scene' | 'design' | 'effects' | 'audio';

export function Inspector({ snapshot, session, values, onParam, onReset, effects, previewEffects, playing, sound, savingEffects, effectsError, onEffects, onEffectsPreview, editor, player, onSeek, designRequest }: {
  snapshot: Snapshot | null; session: Session; values: ParameterValues;
  onParam(id: string, value: ParameterValue): void; onReset(id: string): void;
  effects: Effects; previewEffects: boolean; playing: boolean; sound: string;
  savingEffects: boolean; effectsError: string; onEffects(next: Effects): void; onEffectsPreview(enabled: boolean): void;
  editor: TimelineEditor; player: ScenePlayer | null; onSeek(t: number): void; designRequest: number;
}) {
  const t = useT();
  const layered = !!editor.state;
  const [inspectorTab, setInspectorTab] = useState<Tab>('scene');
  const tabs: Tab[] = ['scene', 'design', 'effects', 'audio'];
  const label: Record<Tab, string> = { scene: t.scene, design: t.tabDesign, effects: t.effects, audio: t.audio };
  // ⌘K "design system" opens this tab.
  useEffect(() => { if (designRequest) setInspectorTab('design'); }, [designRequest]);
  // Selecting a layer on the timeline brings its properties forward.
  const [lastSelected, setLastSelected] = useState(editor.selected);
  if (lastSelected !== editor.selected) { setLastSelected(editor.selected); if (editor.selected && layered) setInspectorTab('scene'); }
  const subtitles = snapshot ? <Subtitles snapshot={snapshot} values={values} onChange={onParam} onReset={onReset} layers={editor.state?.layers ?? []} selected={editor.selected} player={player} onSelect={editor.select} onSeek={onSeek} /> : null;
  return (
      <aside className="inspector">
        <div className="inspector-head">
        <div className="inspector-tabs" role="tablist" aria-label={t.inspector} style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((id, index) => <button key={id} id={`${id}-tab`} role="tab" aria-selected={inspectorTab === id} aria-controls={`${id}-panel`} tabIndex={inspectorTab === id ? 0 : -1} onClick={() => setInspectorTab(id)} onKeyDown={e => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
            e.preventDefault(); const next = tabs[e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]!;
            setInspectorTab(next); document.getElementById(`${next}-tab`)?.focus();
          }}>{label[id]}</button>)}
        </div>
        </div>
        <div className="inspector-content" id={`${inspectorTab}-panel`} role="tabpanel" aria-labelledby={`${inspectorTab}-tab`} tabIndex={0}>
          {snapshot ? inspectorTab === 'scene' ? <>{layered ? <LayerPanel editor={editor} duration={snapshot.scene?.meta.duration ?? 1} onSeek={onSeek} /> : null}<Parameters snapshot={snapshot} values={values} onChange={onParam} onReset={onReset} subtitles={subtitles} /></> : inspectorTab === 'design' ? (snapshot.scene && snapshot.project ? <DesignPanel snapshot={snapshot} session={session} editor={editor} player={player} values={values} onSeek={onSeek} /> : null) : inspectorTab === 'effects' ? <EffectsPanel effects={effects} preview={previewEffects} playing={playing} saving={savingEffects} error={effectsError} onChange={onEffects} onPreview={onEffectsPreview} /> : <AudioPanel key={snapshot.projectDir} snapshot={snapshot} session={session} sound={sound} /> : null}
        </div>
        {snapshot ? <FrameReview key={snapshot.projectDir} snapshot={snapshot} session={session} /> : null}
      </aside>
  );
}
