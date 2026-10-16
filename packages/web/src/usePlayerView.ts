import { useEffect, useState } from 'react';
import type { PlayerView, ScenePlayer } from './player.js';

const INITIAL: PlayerView = { t: 0, playing: false, loop: true, version: null, duration: 0, fps: 30, finished: false, sound: 'none' };
const sameStatus = (a: PlayerView, b: PlayerView) => a.playing === b.playing && a.loop === b.loop && a.version === b.version
  && a.duration === b.duration && a.fps === b.fps && a.finished === b.finished && a.sound === b.sound && a.error === b.error;

/** Only the playback subtree subscribes to frame time; the shell observes status changes. */
export function usePlayerView(player: ScenePlayer | null, mode: 'frames' | 'status') {
  const [view, setView] = useState(INITIAL);
  useEffect(() => {
    let previous: PlayerView | undefined;
    return player?.subscribe(next => {
      if (mode === 'status' && previous && sameStatus(previous, next)) return;
      previous = next;
      setView(next);
    });
  }, [player, mode]);
  return view;
}
