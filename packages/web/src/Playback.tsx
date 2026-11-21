import { useEffect, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { useRef } from 'react';
import type { Snapshot } from '@mografy/core';
import { CornersInIcon } from '@phosphor-icons/react/dist/csr/CornersIn';
import { CornersOutIcon } from '@phosphor-icons/react/dist/csr/CornersOut';
import { MinusIcon } from '@phosphor-icons/react/dist/csr/Minus';
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus';
import type { Viewport } from './useViewport.js';
import { ZOOM_PRESETS, zoomPercent } from './viewport.js';
import { ArrowsClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { FrameCornersIcon } from '@phosphor-icons/react/dist/csr/FrameCorners';
import { Timeline } from './Timeline.js';
import type { ScenePlayer, PlayerView } from './player.js';
import { usePlayerView } from './usePlayerView.js';
import { useT } from './i18n.js';
import type { TimelineEditor } from './useTimeline.js';
import { phases } from './timeline-edit.js';
import { useSettings } from './settings.js';
import type { Settings } from './settings.js';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { readLocal, writeLocal } from './storage.js';

const ICONS = {
  play: 'M7 4.5v15l12.5-7.5z', pause: 'M7.5 5v14M16.5 5v14', prev: 'M17 5.5L9 12l8 6.5M7 5v14', next: 'M7 5.5L15 12l-8 6.5M17 5v14',
  start: 'M18 5.5L10 12l8 6.5M6 5v14', end: 'M6 5.5L14 12l-8 6.5M18 5v14',
} as const;
function Icon({ name }: { name: keyof typeof ICONS }) {
  const filled = name === 'play';
  return <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>;
}
const pad = (n: number) => String(n).padStart(2, '0');
/** MM:SS:FF timecode at the scene's preview frame rate. */
function timecode(t: number, fps: number) {
  const frames = Math.round(t * fps), f = frames % fps, s = Math.floor(frames / fps);
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}:${pad(f)}`;
}
/** The transport's clock in the viewer's chosen format. */
function clockText(t: number, fps: number, format: Settings['timeFormat']) {
  if (format === 'seconds') return `${t.toFixed(2)}s`;
  if (format === 'frames') return String(Math.round(t * fps));
  return timecode(t, fps);
}

/** Preview size: stepped buttons around a menu of common sizes. Fit follows the space the preview has. */
function ZoomControl({ viewport }: { viewport: Viewport }) {
  const t = useT(), { zoom } = viewport;
  const value = zoom === 'fit' ? 'fit' : String(zoom);
  return <div className="zoom-control" role="group" aria-label={t.zoomLabel}>
    <button aria-label={t.zoomOut} title={t.zoomOut} onClick={viewport.zoomOut}><MinusIcon size={14} /></button>
    <select aria-label={t.zoomLabel} title={t.zoomLabel} value={value} onChange={e => { const v = e.currentTarget.value; viewport.setZoom(v === 'fit' ? 'fit' : Number(v)); e.currentTarget.blur(); }}>
      <option value="fit">{t.zoomFit}</option>
      {typeof zoom === 'number' && !ZOOM_PRESETS.some(p => p === zoom) ? <option value={value}>{zoomPercent(zoom)}</option> : null}
      {ZOOM_PRESETS.map(p => <option key={p} value={String(p)}>{zoomPercent(p)}</option>)}
    </select>
    <button aria-label={t.zoomIn} title={t.zoomIn} onClick={viewport.zoomIn}><PlusIcon size={14} /></button>
  </div>;
}

export function Playback({ player, snapshot, stage, guides, onGuides, seekBy, toast, reportPlayhead, viewport, editor, onTransitions }: {
  player: ScenePlayer | null; snapshot: Snapshot | null; stage: RefObject<HTMLDivElement | null>;
  guides: boolean; onGuides(): void; seekBy(dir: number, coarse: boolean): void; toast: string;
  reportPlayhead(t: number): void; viewport: Viewport;
  editor: TimelineEditor;
  onTransitions(list: NonNullable<Snapshot['project']>['review']['transitions']): Promise<void>;
}) {
  const t = useT(), settings = useSettings();
  // Timeline height, in layer rows, remembered per browser; dragged from the line between the picture and the transport.
  const [rows, setRows] = useState(() => Number(readLocal('mografy.timeline.rows')) || 8.5);
  const [resizing, setResizing] = useState(false);
  const resize = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setResizing(true);
    document.body.classList.add('row-resizing');
    const y0 = e.clientY, start = rows, rowPx = 40;
    const move = (ev: PointerEvent) => setRows(Math.min(24, Math.max(3, start - (ev.clientY - y0) / rowPx)));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setResizing(false); document.body.classList.remove('row-resizing'); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  useEffect(() => { writeLocal('mografy.timeline.rows', String(rows)); }, [rows]);
  const selected = editor.state?.layers.find(l => l.id === editor.selected);
  const view = usePlayerView(player, 'frames');
  const meta = snapshot?.scene?.meta, fps = view.fps, duration = view.duration;
  const { zoom, fullscreen, idle } = viewport;
  const report = useRef(reportPlayhead); report.current = reportPlayhead;
  useEffect(() => {
    let last = 0;
    return player?.subscribe(view => {
      if (!view.playing || performance.now() - last > 1000) { last = performance.now(); report.current(view.t); }
    });
  }, [player]);
  return (
      <section ref={viewport.viewer} className={`viewer ${fullscreen ? 'fullscreen' : ''} ${idle ? 'idle' : ''}`}>
        <div ref={viewport.surround} className={`surround ${typeof zoom === 'number' ? 'zoomed' : ''}`}>
          <div className={`stage ${meta && meta.height > meta.width ? 'portrait' : ''}`} ref={stage} style={{ aspectRatio: meta ? `${meta.width} / ${meta.height}` : '16 / 9', '--scene-bg': meta?.background ?? '#000', '--aspect': meta ? meta.width / meta.height : 16 / 9, ...(typeof zoom === 'number' && meta ? { width: Math.round(meta.width * zoom) } : {}) } as CSSProperties} onPointerDown={viewport.onStagePointerDown} onClick={() => { if (!viewport.clickWasDrag()) player?.toggle(); }} data-testid="stage" data-version={view.version ?? ''} data-time={view.t.toFixed(4)}>
            {guides ? <div className="guides" aria-hidden="true"><i className="action" /><i className="title" /><i className="cross" /></div> : null}
            {fullscreen || !meta ? null : (['nw', 'ne', 'sw', 'se'] as const).map(corner => <i key={corner} className={`stage-grip ${corner}`} title={t.resizeStage} onPointerDown={viewport.onGripPointerDown} onClick={viewport.stopClick} />)}
          </div>
          {toast ? <div className="toast" role="status">{toast}</div> : null}
          {!snapshot?.scene && !snapshot?.error ? <div className="placeholder">{t.pbCompiling}</div> : null}
        </div>

        <div className="viewer-dock" ref={viewport.dock}>
        <div className="transport">
          <div className={`tl-resize ${resizing ? 'active' : ''}`} role="separator" aria-orientation="horizontal" aria-label={t.timelineHeight} title={t.timelineHeight} onPointerDown={resize} onDoubleClick={() => setRows(8.5)} />
          <div className="buttons">
            <button aria-label={t.goStart} title={`${t.goStart} (Home)`} onClick={() => { player?.pause(); player?.seek(0); }}><Icon name="start" /></button>
            <button aria-label={t.prevFrame} title={`${t.prevFrame} (←)`} onClick={() => seekBy(-1, false)}><Icon name="prev" /></button>
            <button className="play" aria-label={view.playing ? t.pause : t.play} title={`${t.play} / ${t.pause} (Space)`} onClick={() => player?.toggle()} disabled={!view.version}><Icon name={view.playing ? 'pause' : 'play'} /></button>
            <button aria-label={t.nextFrame} title={`${t.nextFrame} (→)`} onClick={() => seekBy(1, false)}><Icon name="next" /></button>
            <button aria-label={t.goEnd} title={`${t.goEnd} (End)`} onClick={() => { player?.pause(); player?.seek(Math.max(0, duration - 1 / fps)); }}><Icon name="end" /></button>
          </div>
          <div className="clock" data-testid="time">
            <output className="tc" aria-label={t.currentTime}>{clockText(view.t, fps, settings.timeFormat)}</output>
            <span className="tc-total">/ {clockText(duration, fps, settings.timeFormat)}</span>
          </div>
          <span className="sel-summary">{selected ? `${selected.name} · ${t.in} ${selected.in.toFixed(1)}s · ${t.out} ${selected.out.toFixed(1)}s · ${t.hold} ${phases(selected).hold.toFixed(1)}s` : ''}</span>
          <div className="toggles">
            {view.sound !== 'none' ? <button className={`sound ${view.sound}`} onClick={() => { if (view.sound === 'locked') void player?.enableSound(); else if (view.sound === 'on' || view.sound === 'muted') player?.setMuted(view.sound === 'on'); }} aria-label={t.pbSoundLabel[view.sound]} title={t.pbSoundLabel[view.sound]}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />{view.sound === 'on' ? <path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}</svg>
              <span>{t.pbSoundText[view.sound]}</span>
            </button> : null}
            <button className={`transport-toggle ${view.loop ? 'on' : ''}`} aria-label={t.loop} aria-pressed={view.loop} title={`${t.loop} (L)`} onClick={() => player?.setLoop(!view.loop)}><ArrowsClockwiseIcon size={20} /></button>
            <button className={`transport-toggle ${guides ? 'on' : ''}`} aria-label={t.guides} aria-pressed={guides} title={`${t.guides} (G)`} onClick={() => onGuides()}><FrameCornersIcon size={20} /></button>
            <ZoomControl viewport={viewport} />
            <button className={`transport-toggle ${fullscreen ? 'on' : ''}`} aria-label={fullscreen ? t.exitFullscreen : t.fullscreen} aria-pressed={fullscreen} title={fullscreen ? t.exitFullscreen : t.fullscreen} onClick={viewport.toggleFullscreen}>{fullscreen ? <CornersInIcon size={20} /> : <CornersOutIcon size={20} />}</button>
          </div>
        </div>
        {snapshot?.project && !fullscreen ? <Timeline rows={rows} view={view} snapshot={snapshot} audio={player?.audio} onSeek={time => { player?.pause(); player?.seek(time); }} editor={editor} onTransitions={onTransitions} /> : null}
        </div>
      </section>
  );
}
