import { useEffect } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { beatAt, beatTimes } from '@mografy/core';
import type { DeckSlide, Snapshot } from '@mografy/core';
import { ArrowsClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { FrameCornersIcon } from '@phosphor-icons/react/dist/csr/FrameCorners';
import type { AudioTrack } from './audio.js';
import type { ScenePlayer, PlayerView } from './player.js';
import { usePlayerView } from './usePlayerView.js';
import { CornersInIcon } from '@phosphor-icons/react/dist/csr/CornersIn';
import { CornersOutIcon } from '@phosphor-icons/react/dist/csr/CornersOut';
import { MinusIcon } from '@phosphor-icons/react/dist/csr/Minus';
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus';
import { useT } from './i18n.js';
import { DockHandle, usePanelSize } from './PanelResize.js';
import type { Viewport } from './useViewport.js';
import { dockHeight, ZOOM_PRESETS, zoomPercent } from './viewport.js';

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

function ticks(duration: number) {
  const target = duration / 8, magnitude = 10 ** Math.floor(Math.log10(target || 1));
  const step = ([1, 2, 5, 10].find(v => v * magnitude >= target) ?? 10) * magnitude;
  return Array.from({ length: Math.floor(duration / step + 1e-9) + 1 }, (_, i) => Number((i * step).toPrecision(10)));
}

/** Music waveform, drawn from the player's decoded audio (no second download). */
function Waveform({ audio, duration, ready }: { audio: AudioTrack; duration: number; ready: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current; if (!el || !ready) return;
    const draw = () => {
      const width = el.width = Math.max(1, Math.round(el.clientWidth * devicePixelRatio)), height = el.height = Math.max(1, Math.round(el.clientHeight * devicePixelRatio));
      const peaks = audio.peaks(width, duration); if (!peaks) return;
      const c = el.getContext('2d')!;
      c.clearRect(0, 0, width, height); c.fillStyle = getComputedStyle(el).color;
      peaks.forEach((peak, x) => { const h = Math.max(1, Math.min(1, peak * 1.4) * height); c.fillRect(x, (height - h) / 2, 1, h); });
    };
    draw();
    const observer = new ResizeObserver(draw); observer.observe(el);
    return () => observer.disconnect();
  }, [audio, duration, ready]);
  return <canvas className="waveform" ref={canvas} aria-hidden="true" />;
}

/** The presentation's slides (the scene's shots), marked where each one stops. */
export interface TimelineStops { slides: DeckSlide[]; onSelect(index: number): void }

function Timeline({ view, snapshot, audio, onSeek, slides }: { view: PlayerView; snapshot: Snapshot; audio: AudioTrack | undefined; onSeek(t: number): void; slides?: TimelineStops | undefined }) {
  const t = useT();
  const project = snapshot.project!, duration = view.duration || snapshot.scene?.meta.duration || 1;
  const area = useRef<HTMLDivElement>(null);
  const at = (clientX: number) => { const r = area.current!.getBoundingClientRect(); return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * duration; };
  const beats = useMemo(() => project.audio ? beatTimes(duration, project.audio).map(t => ({ t, bar: beatAt(t, project.audio!).beatInBar === 0 })) : [], [project.audio, duration]);
  const pct = (t: number) => `${(t / duration) * 100}%`;
  const frames = Math.round(duration * view.fps);
  return <div className="timeline">
    <div className={`track-area ${project.audio ? 'has-audio' : ''}`} ref={area} role="slider" tabIndex={0} aria-label={t.timeline} aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Number(view.t.toFixed(3))} aria-valuetext={t.seconds(view.t.toFixed(2))}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); onSeek(at(e.clientX)); }}
      onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) onSeek(at(e.clientX)); }}>
      <div className="ruler">
        {frames <= 600 ? <div className="frame-ticks" style={{ backgroundSize: `${100 / frames}% 100%` }} /> : null}
        {ticks(duration).map(t => <span key={t} style={{ left: pct(t) }}>{t}s</span>)}
        {slides && slides.slides.length > 1 ? slides.slides.map((slide, i) => <button key={`s${i}`} className="stop-mark" style={{ left: pct(slide.at) }} title={t.slideMark(i + 1, slide.title, Number(slide.at.toFixed(2)))}
          aria-label={t.slideMarkAria(i + 1, Number(slide.at.toFixed(2)))} onPointerDown={e => { e.stopPropagation(); slides.onSelect(i); }} />) : null}
      </div>
      <div className="lane">
        {beats.map(b => <i key={b.t} className={b.bar ? 'beat bar' : 'beat'} style={{ left: pct(b.t) }} />)}
        {project.review.transitions.map((tr, i) => <div key={i} className="span" style={{ left: pct(tr.start), width: pct(Math.min(tr.end, duration) - tr.start) }} title={t.transitionNamed(tr.name ?? t.transition, tr.start, tr.end)}><span>{tr.name ?? t.transitionN(i + 1)}</span></div>)}
        {project.review.times.map(rt => <i key={`r${rt}`} className="review-mark" style={{ left: pct(rt) }} title={t.reviewAt(rt)} />)}
      </div>
      {project.audio ? <div className="music-lane" title={project.audio.path}>
        {audio ? <Waveform audio={audio} duration={duration} ready={view.sound !== 'loading' && view.sound !== 'none' && view.sound !== 'error'} /> : null}
        <span className="music-label">{view.sound === 'loading' ? t.loadingMusic : view.sound === 'error' ? (audio?.error || t.musicFailed) : project.audio.path.split('/').pop()}</span>
      </div> : null}
      <div className="playhead" style={{ left: pct(view.t) }}><b /></div>
    </div>
    <div className="timeline-foot">
      <span>{project.audio ? t.bpm(project.audio.bpm, project.audio.beatsPerBar) : t.addMusic}</span>
      <span className="keys"><span><kbd>Space</kbd> {t.keyPlay}</span><span><kbd>←</kbd><kbd>→</kbd> {t.keyFrame}</span><span><kbd>⇧</kbd><kbd>←</kbd><kbd>→</kbd> {project.audio ? t.keyBeat : t.keySecond}</span><span><kbd>L</kbd> {t.keyLoop}</span><span><kbd>G</kbd> {t.keyGuides}</span><span><kbd>P</kbd> {t.keyProjects}</span><span><kbd>F</kbd> {t.keyFull}</span></span>
    </div>
  </div>;
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

export function Playback({ player, snapshot, stage, guides, onGuides, viewport, seekBy, toast, reportPlayhead, slides, presenting, overlay }: {
  player: ScenePlayer | null; snapshot: Snapshot | null; stage: RefObject<HTMLDivElement | null>;
  guides: boolean; onGuides(): void; viewport: Viewport; seekBy(dir: number, coarse: boolean): void; toast: string;
  reportPlayhead(t: number): void; slides?: TimelineStops | undefined;
  /** Present mode: the stage alone, without the transport and timeline. */
  presenting?: boolean;
  /** Present mode: controls floating in the middle of the stage. */
  overlay?: ReactNode;
}) {
  const t = useT();
  const view = usePlayerView(player, 'frames');
  const dock = usePanelSize('mografy.timeline.extra', 0, -60, 240);
  const { zoom, fullscreen, idle } = viewport, folded = dock.size < 0 && !fullscreen;
  const meta = snapshot?.scene?.meta, fps = view.fps, duration = view.duration;
  const report = useRef(reportPlayhead); report.current = reportPlayhead;
  useEffect(() => {
    let last = 0;
    return player?.subscribe(view => {
      if (!view.playing || performance.now() - last > 1000) { last = performance.now(); report.current(view.t); }
    });
  }, [player]);
  return (
      <section ref={viewport.viewer} className={`viewer ${presenting ? 'presenting' : ''} ${fullscreen ? 'fullscreen' : ''} ${idle ? 'idle' : ''}`} style={{ '--track-extra': `${fullscreen ? 0 : Math.max(0, dock.size)}px` } as CSSProperties}>
        <div ref={viewport.surround} className={`surround ${typeof zoom === 'number' ? 'zoomed' : ''}`}>
          <div className={`stage ${meta && meta.height > meta.width ? 'portrait' : ''}`} ref={stage} style={{ aspectRatio: meta ? `${meta.width} / ${meta.height}` : '16 / 9', '--scene-bg': meta?.background ?? '#000', '--aspect': meta ? meta.width / meta.height : 16 / 9, ...(typeof zoom === 'number' && meta ? { width: Math.round(meta.width * zoom) } : {}) } as CSSProperties} onPointerDown={viewport.onStagePointerDown} onClick={() => { if (!viewport.clickWasDrag() && !presenting) player?.toggle(); }} data-testid="stage" data-version={view.version ?? ''} data-time={view.t.toFixed(4)}>
            {guides ? <div className="guides" aria-hidden="true"><i className="action" /><i className="title" /><i className="cross" /></div> : null}
            {presenting || fullscreen || !meta ? null : (['nw', 'ne', 'sw', 'se'] as const).map(corner => <i key={corner} className={`stage-grip ${corner}`} title={t.resizeStage} onPointerDown={viewport.onGripPointerDown} onClick={viewport.stopClick} />)}
          </div>
          {overlay}
          {toast ? <div className="toast" role="status">{toast}</div> : null}
          {!snapshot?.scene && !snapshot?.error ? <div className="placeholder">{t.pbCompiling}</div> : null}
        </div>

        {presenting ? null : <div className="viewer-dock" ref={viewport.dock}>
        <div className="transport">
          {fullscreen ? null : <DockHandle dock={dock} label={t.resizeTimeline} resolve={dockHeight} />}
          <div className="buttons">
            <button aria-label={t.goStart} title={t.goStartHelp} onClick={() => { player?.pause(); player?.seek(0); }}><Icon name="start" /></button>
            <button aria-label={t.prevFrame} title={t.prevFrameHelp} onClick={() => seekBy(-1, false)}><Icon name="prev" /></button>
            <button className="play" aria-label={view.playing ? t.pause : t.play} title={t.playHelp} onClick={() => player?.toggle()} disabled={!view.version}><Icon name={view.playing ? 'pause' : 'play'} /></button>
            <button aria-label={t.nextFrame} title={t.nextFrameHelp} onClick={() => seekBy(1, false)}><Icon name="next" /></button>
            <button aria-label={t.goEnd} title={t.goEndHelp} onClick={() => { player?.pause(); player?.seek(Math.max(0, duration - 1 / fps)); }}><Icon name="end" /></button>
          </div>
          <div className="clock" data-testid="time">
            <output className="tc" aria-label={t.currentTime}>{timecode(view.t, fps)}</output>
            <span className="tc-total">/ {timecode(duration, fps)}</span>
            <span className="seconds">{view.t.toFixed(2)} s</span>
          </div>
          <div className="toggles">
            {view.sound !== 'none' ? <button className={`sound ${view.sound}`} onClick={() => { if (view.sound === 'locked') void player?.enableSound(); else if (view.sound === 'on' || view.sound === 'muted') player?.setMuted(view.sound === 'on'); }} aria-label={t.pbSoundLabel[view.sound]} title={t.pbSoundLabel[view.sound]}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />{view.sound === 'on' ? <path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}</svg>
              <span>{t.pbSoundText[view.sound]}</span>
            </button> : null}
            <button className={`transport-toggle ${view.loop ? 'on' : ''}`} aria-label={t.loop} aria-pressed={view.loop} title={t.loopHelp} onClick={() => player?.setLoop(!view.loop)}><ArrowsClockwiseIcon size={20} /></button>
            <button className={`transport-toggle ${guides ? 'on' : ''}`} aria-label={t.guides} aria-pressed={guides} title={t.guidesHelp} onClick={() => onGuides()}><FrameCornersIcon size={20} /></button>
            <ZoomControl viewport={viewport} />
            <button className={`transport-toggle ${fullscreen ? 'on' : ''}`} aria-label={fullscreen ? t.exitFullscreen : t.fullscreen} aria-pressed={fullscreen} title={fullscreen ? t.exitFullscreen : t.fullscreen} onClick={viewport.toggleFullscreen}>{fullscreen ? <CornersInIcon size={20} /> : <CornersOutIcon size={20} />}</button>
          </div>
        </div>
        {snapshot?.project && !folded ? <Timeline view={view} snapshot={snapshot} audio={player?.audio} onSeek={time => { player?.pause(); player?.seek(time); }} slides={slides} /> : null}
        </div>}
      </section>
  );
}
