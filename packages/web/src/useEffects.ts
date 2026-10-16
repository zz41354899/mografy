import { useEffect, useRef, useState } from 'react';
import type { Snapshot } from '@mografy/core';
import type { Effects } from './EffectsPanel.js';
import type { ScenePlayer } from './player.js';
import type { Session } from './session.js';
import { useDebounced } from './useDebounced.js';

export function useEffects(snapshot: Snapshot | null, session: Session, player: ScenePlayer | null) {
  const dir = snapshot?.projectDir, saved = snapshot?.project?.render;
  const [local, setLocal] = useState<(Effects & { dir: string }) | null>(null);
  const [preview, setPreview] = useState(false), [error, setError] = useState('');
  const active = useRef(dir); active.current = dir;
  const generation = useRef(0);
  const values: Effects = local?.dir === dir && local ? { glow: local.glow, grain: local.grain } : { glow: saved?.glow ?? 0, grain: saved?.grain ?? 0 };
  useEffect(() => { generation.current++; setLocal(null); setPreview(false); setError(''); }, [dir]);
  useEffect(() => { player?.setEffects(values, preview); }, [player, values.glow, values.grain, preview]);
  useEffect(() => {
    setLocal(local => local && local.dir === dir && local.glow === saved?.glow && local.grain === saved?.grain ? null : local);
  }, [dir, saved?.glow, saved?.grain, local]);
  const save = useDebounced((expected: string, next: Effects, request: number) => {
    if (expected !== dir) return;
    void session.patchProject({ render: next }).catch(error => {
      if (expected === active.current && request === generation.current) setError(`Could not save effects: ${String(error.message)}`);
    });
  }, 200);
  const onChange = (next: Effects) => {
    if (!dir) return;
    player?.pause(); setPreview(true); setError('');
    setLocal({ ...next, dir }); save(dir, next, ++generation.current);
  };
  const onPreview = (enabled: boolean) => { if (enabled) player?.pause(); setPreview(enabled); };
  return { values, preview, saving: !!local && local.dir === dir, error, onChange, onPreview };
}
