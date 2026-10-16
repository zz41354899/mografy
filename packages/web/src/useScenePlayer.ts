import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { ParameterValues, Snapshot } from '@mografy/core';
import { ScenePlayer } from './player.js';
import type { Session } from './session.js';

/** Owns player creation, project/version loading, and externally requested seeks. */
export function useScenePlayer(stage: RefObject<HTMLDivElement | null>, snapshot: Snapshot | null, values: ParameterValues, seek: Session['seek']) {
  const [player, setPlayer] = useState<ScenePlayer | null>(null);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const started = useRef<string | undefined>(undefined);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const player = new ScenePlayer(stage.current!);
    setPlayer(player);
    const unlock = () => { void player.enableSound(); };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => {
      player.dispose(); clearTimeout(messageTimer.current);
      document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock);
    };
  }, [stage]);
  const dir = snapshot?.projectDir, version = snapshot?.scene?.version, project = snapshot?.project;
  const spec = JSON.stringify(project);
  useEffect(() => { started.current = undefined; setError(''); setMessage(''); clearTimeout(messageTimer.current); }, [dir]);
  useEffect(() => {
    if (!player || !version || !project || !dir) return;
    let cancelled = false;
    const previous = player.version;
    if (started.current !== dir) player.seek(snapshot?.state.playhead ?? 0);
    void player.load(version, project, values).then(() => {
      if (cancelled) return;
      setError('');
      if (started.current !== dir) { started.current = dir; player.play(); }
      if (previous && previous !== version) {
        setMessage(`Updated to ${version.slice(0, 7)}`);
        clearTimeout(messageTimer.current);
        messageTimer.current = setTimeout(() => setMessage(''), 2600);
      }
    }, error => { if (!cancelled) setError(error instanceof Error ? error.message : String(error)); });
    return () => { cancelled = true; };
  }, [player, dir, version, spec]);
  useEffect(() => { player?.setParams(values); }, [player, values]);
  useEffect(() => { if (seek) { player?.pause(); player?.seek(seek.t); } }, [player, seek]);
  return { player, error, message };
}
