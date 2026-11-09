import { useCallback, useEffect } from 'react';
import { beatAt } from '@mografy/core';
import type { SceneProject } from '@mografy/core';
import type { ScenePlayer } from './player.js';
import type { Viewport } from './useViewport.js';

export function usePlayerShortcuts(player: ScenePlayer | null, audio: SceneProject['audio'], toggleGuides: () => void, toggleProjects: () => void, viewport: Viewport, enabled = true) {
  const { toggleFullscreen, setZoom, zoomIn, zoomOut } = viewport;
  const seekBy = useCallback((direction: number, coarse: boolean) => {
    if (!player) return;
    if (!coarse) { player.step(direction); return; }
    player.pause();
    if (audio) {
      const beat = beatAt(player.t, audio);
      player.seek(audio.offset + (beat.beat + (direction > 0 ? 1 : beat.phase > 1e-6 ? 0 : -1)) * beat.period);
    } else player.seek(player.t + direction);
  }, [player, audio]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!enabled || !player || event.defaultPrevented || target?.closest('dialog, input, textarea, select, [contenteditable="true"]') || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.code === 'Space') { if (target?.closest('button, summary')) return; event.preventDefault(); player.toggle(); }
      else if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') { event.preventDefault(); seekBy(event.code === 'ArrowLeft' ? -1 : 1, event.shiftKey); }
      else if (event.code === 'Home') { event.preventDefault(); player.pause(); player.seek(0); }
      else if (event.code === 'End') { event.preventDefault(); player.pause(); player.seek(Math.max(0, player.duration - 1 / player.fps)); }
      else if (event.code === 'KeyL') player.setLoop(!player.loop);
      else if (event.code === 'KeyG') toggleGuides();
      else if (event.code === 'KeyP') toggleProjects();
      else if (event.code === 'KeyF') toggleFullscreen();
      else if (event.key === '0') setZoom('fit');
      else if (event.key === '1') setZoom(1);
      else if (event.key === '+' || event.key === '=') zoomIn();
      else if (event.key === '-') zoomOut();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled, player, seekBy, toggleGuides, toggleProjects, toggleFullscreen, setZoom, zoomIn, zoomOut]);
  return seekBy;
}
