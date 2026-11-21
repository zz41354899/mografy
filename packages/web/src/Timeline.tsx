import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { beatAt, beatTimes } from '@mografy/core';
import { SHOT_COLOURS } from '@mografy/runtime';
import type { Snapshot, TimelineLayer } from '@mografy/core';
import { ArrowsInLineHorizontalIcon } from '@phosphor-icons/react/dist/csr/ArrowsInLineHorizontal';
import { KeyboardIcon } from '@phosphor-icons/react/dist/csr/Keyboard';
import { MagnifyingGlassMinusIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlassMinus';
import { MagnifyingGlassPlusIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlassPlus';
import type { AudioTrack } from './audio.js';
import type { PlayerView } from './player.js';
import { useT } from './i18n.js';
import { useSettings } from './settings.js';
import { ignoreKey, useKeydown } from './shortcuts.js';
import type { T } from './i18n.js';
import type { TimelineEditor } from './useTimeline.js';
import { declaredOf, duplicateInSequence, duplicateLayer, MOTIONS, moveLayer, phases, reorderLayer, reorderSequence, setLayer, slideSequence, snap, snapTargets, trimLayer, trimSequence } from './timeline-edit.js';
import { subtitleNumbers } from './Subtitles.js';
import type { SnapTarget, TimelineState } from './timeline-edit.js';
import { PanelHandle, usePanelWidth } from './PanelResize.js';
import { basename } from './format.js';

/** Track colours, in the order shots use them; muted so the scene's own colours read true. */
const ZOOM_MIN = 1, ZOOM_MAX = 12, SNAP_PX = 8;

function ticks(duration: number, zoom: number) {
  const target = duration / (8 * zoom), magnitude = 10 ** Math.floor(Math.log10(target || 1));
  const step = ([1, 2, 5, 10].find(v => v * magnitude >= target) ?? 10) * magnitude;
  return Array.from({ length: Math.floor(duration / step + 1e-9) + 1 }, (_, i) => Number((i * step).toPrecision(10)));
}

/** Music waveform, drawn from the player's decoded audio (no second download). */
function Waveform({ audio, duration, ready, zoom }: { audio: AudioTrack; duration: number; ready: boolean; zoom: number }) {
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
  }, [audio, duration, ready, zoom]);
  return <canvas className="waveform" ref={canvas} aria-hidden="true" />;
}

type Transition = NonNullable<Snapshot['project']>['review']['transitions'][number];
interface Solid { name: string; start: number; end: number; stop?: number | undefined }
interface Track { id: string; name: string; colour: string; kind: 'shot' | 'transition'; solids: Solid[] }

/** Without layers: one track per shot of the scene's beat table, then one track holding every review transition. */
function shotTracks(snapshot: Snapshot, duration: number, t: T, ends?: number[] | null, list?: Transition[] | null): Track[] {
  const declared = snapshot.scene?.meta.shots ?? [], out: Track[] = [];
  const shots = ends && ends.length === declared.length ? declared.map((shot, i) => ({ ...shot, end: ends[i]! })) : declared;
  shots.forEach((shot, i) => {
    const start = i ? shots[i - 1]!.end : 0;
    if (start >= duration) return;
    const name = shot.title || `Shot ${i + 1}`;
    out.push({ id: `shot-${i}`, name, colour: SHOT_COLOURS[i % SHOT_COLOURS.length]!, kind: 'shot', solids: [{ name, start, end: ends ? shot.end : Math.min(shot.end, duration), stop: ends ? undefined : shot.stop }] });
  });
  const transitions = list ?? snapshot.project?.review.transitions ?? [];
  if (transitions.length) out.push({ id: 'transitions', name: t.transitions, colour: '#8a8f98', kind: 'transition',
    solids: transitions.map((tr, i) => ({ name: tr.name ?? `${t.transitions} ${i + 1}`, start: tr.start, end: Math.min(tr.end, duration) })) });
  return out;
}

const Eye = ({ open }: { open: boolean }) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
  <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" />{open ? null : <path d="M4 4l16 16" />}</svg>;
const Lock = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 018 0v2.5" /></svg>;

interface Drag { id: string; mode: 'move' | 'in' | 'out'; x0: number; before: TimelineState; layer: TimelineLayer }
/** Dragging a layer's name up or down moves it in the stack. */
interface Reorder { id: string; y0: number; from: number; to: number; moved: boolean }

/** Multi-track timeline: a fixed column of track names beside a zoomable, scrollable lane area. Layers can be edited. */
export function Timeline({ view, snapshot, audio, onSeek, editor, onTransitions, rows }: { rows: number; view: PlayerView; snapshot: Snapshot; audio: AudioTrack | undefined; onSeek(t: number): void; editor: TimelineEditor; onTransitions(list: Transition[]): Promise<void> }) {
  const t = useT(), settings = useSettings();
  const project = snapshot.project!, duration = view.duration || snapshot.scene?.meta.duration || 1;
  const [zoom, setZoom] = useState(1);
  const [guide, setGuide] = useState<SnapTarget | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [keysOpen, setKeysOpen] = useState(false);
  // The layer-name column, as wide as the viewer drags it.
  const namesPanel = usePanelWidth('mografy.timeline.names', 220, 140, 420);
  const drag = useRef<Drag | null>(null);
  const [reorder, setReorder] = useState<Reorder | null>(null);
  const names = useRef<HTMLUListElement>(null);
  const scroller = useRef<HTMLDivElement>(null), area = useRef<HTMLDivElement>(null);
  const state = editor.state, layered = !!state;
  // Shot ends and transitions being dragged, shown until the next published version carries them.
  const [trs, setTrs] = useState<Transition[] | null>(null);
  const span = useRef<{ index: number; mode: 'move' | 'in' | 'out'; x0: number; trs: Transition[] } | null>(null);
  const [trMenu, setTrMenu] = useState<{ index: number; x: number; y: number } | null>(null);
  useEffect(() => { if (!span.current) setTrs(null); }, [snapshot.scene?.version, snapshot.project?.review]);
  const allTracks = useMemo(() => shotTracks(snapshot, duration, t, null, trs), [snapshot, duration, t, trs]);
  // Shots of a film without its own layers move like any layer: only the dragged one changes; a gap shows the
  // background and an overlap shows the shot that starts later.
  const sequence = false;
  const tracks = layered ? [] : allTracks, transitions = layered ? allTracks.filter(x => x.kind === 'transition') : [];
  const grid = project.audio ?? snapshot.scene?.meta.tempo;
  const beats = useMemo(() => {
    if (!grid) return [];
    const g = { bpm: grid.bpm, offset: grid.offset ?? 0, beatsPerBar: grid.beatsPerBar };
    return beatTimes(duration, g).map(x => ({ t: x, bar: beatAt(x, g).beatInBar === 0 }));
  }, [grid, duration]);
  const beatLength = grid ? 60 / grid.bpm : .5, frame = 1 / (snapshot.scene?.meta.fps ?? 30);
  const pct = (x: number) => `${(x / duration) * 100}%`;
  const secondsPerPx = () => duration / Math.max(1, area.current?.getBoundingClientRect().width ?? 1);
  const at = (clientX: number) => { const r = area.current!.getBoundingClientRect(); return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * duration; };
  const frames = Math.round(duration * view.fps);
  const currentShot = tracks.find(track => track.kind === 'shot' && track.solids.some(s => view.t >= s.start && view.t < s.end))?.id;
  const declared = (l: TimelineLayer) => declaredOf(l, editor.server?.layers.find(x => x.id === l.id));
  const selected = state?.layers.find(l => l.id === editor.selected) ?? null;
  const numbers = useMemo(() => subtitleNumbers(snapshot, state?.layers ?? []), [snapshot, state?.layers]);
  const badge = (l: TimelineLayer) => l.subtitles.map(id => numbers.get(id)).filter(Boolean).join(' ');

  // Zoom around the pointer (⌘/Ctrl + wheel), keeping the time under it in place.
  const zoomTo = (next: number, anchorX?: number) => {
    const el = scroller.current; next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    if (!el) { setZoom(next); return; }
    const r = el.getBoundingClientRect(), x = anchorX ?? r.width / 2, ratio = (el.scrollLeft + x) / (r.width * zoom);
    setZoom(next);
    requestAnimationFrame(() => { el.scrollLeft = ratio * r.width * next - x; });
  };
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const wheel = (e: WheelEvent) => { if (!e.metaKey && !e.ctrlKey) return; e.preventDefault(); zoomTo(zoom * Math.exp(-e.deltaY / 300), e.clientX - el.getBoundingClientRect().left); };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });
  // Keep the playhead in view while playing when zoomed in.
  useEffect(() => {
    const el = scroller.current; if (!el || zoom === 1 || !view.playing || !settings.follow) return;
    const x = (view.t / duration) * el.scrollWidth;
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - 24) el.scrollLeft = x - 24;
  }, [view.t, view.playing, zoom, duration, settings.follow]);

  // ---------------------------------------------------------------- layer actions
  const act = {
    hide: (l: TimelineLayer) => editor.commit(s => setLayer(s, l.id, { hidden: !l.hidden }, declared(l))),
    lock: (l: TimelineLayer) => editor.commit(s => setLayer(s, l.id, { locked: !l.locked }, declared(l))),
    rename: (l: TimelineLayer, name: string) => { const v = name.trim(); if (v && v !== l.name) editor.commit(s => setLayer(s, l.id, { name: v }, declared(l))); },
    duplicate: (l: TimelineLayer) => {
      if (!state) return;
      const result = sequence ? duplicateInSequence(state, l.id, t.copySuffix) : duplicateLayer(state, l.id, t.copySuffix);
      if (!result.id) return;
      editor.commit(() => result.state); editor.select(result.id);
      editor.flash(t.toastDuplicated(result.state.layers.find(x => x.id === result.id)!.name));
    },
    nudge: (l: TimelineLayer, dt: number) => { if (l.locked) { editor.flash(t.toastLocked); return; } editor.commit(s => sequence ? slideSequence(s, l.id, l.in + dt) : moveLayer(s, l.id, l.in + dt, duration, declared(l))); },
    trimTo: (l: TimelineLayer, edge: 'in' | 'out') => { if (l.locked) { editor.flash(t.toastLocked); return; } editor.commit(s => sequence ? trimSequence(s, l.id, edge, view.t) : trimLayer(s, l.id, edge, view.t, duration, declared(l))); },
    motion: (l: TimelineLayer, which: 'enter' | 'exit', motion: TimelineLayer['enter']) => editor.commit(s => setLayer(s, l.id, { [which]: motion }, declared(l))),
  };

  // Layer shortcuts; playback keys stay with usePlayerShortcuts.
  useKeydown(e => {
    // The shortcuts sheet is a modal of its own: Esc or ? closes it, everything else waits.
    if (keysOpen && (e.key === 'Escape' || e.key === '?')) { e.preventDefault(); setKeysOpen(false); return; }
    if (ignoreKey(e)) return;
    const target = e.target as HTMLElement | null;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.code === 'KeyZ') { e.preventDefault(); const done = e.shiftKey ? editor.redo() : editor.undo(); editor.flash(done ? (e.shiftKey ? t.toastRedo : t.toastUndo) : t.toastNothing); return; }
    if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) { e.preventDefault(); setKeysOpen(v => !v); return; }
    // Esc closes a menu first, then lets go of the selected layer.
    if (e.key === 'Escape') { if (menu || trMenu) { setMenu(null); setTrMenu(null); } else editor.select(null); return; }
    const l = selected; if (!l) return;
    if (mod && e.code === 'KeyD') { e.preventDefault(); act.duplicate(l); return; }
    if (mod || e.altKey) return;
    if (e.code === 'Comma' || e.code === 'Period') { e.preventDefault(); act.nudge(l, (e.code === 'Comma' ? -1 : 1) * (e.shiftKey ? beatLength : frame)); }
    else if (e.code === 'BracketLeft' || e.code === 'BracketRight') { e.preventDefault(); act.trimTo(l, e.code === 'BracketLeft' ? 'in' : 'out'); }
    else if (e.code === 'KeyH' && !sequence) { e.preventDefault(); act.hide(l); }
    else if (e.code === 'Enter') { if (target?.closest('button')) return; e.preventDefault(); setRenaming(l.id); }
    else if (/^Digit[1-6]$/.test(e.code)) { e.preventDefault(); act.motion(l, e.shiftKey ? 'exit' : 'enter', MOTIONS[Number(e.code.slice(5)) - 1]!); }
  }, { enabled: layered });
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('.layer-menu')) setMenu(null); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menu]);

  // ---------------------------------------------------------------- dragging layers
  const startDrag = (e: ReactPointerEvent<HTMLElement>, l: TimelineLayer, mode: Drag['mode']) => {
    if (e.button !== 0 || !state) return;
    e.stopPropagation();
    editor.select(l.id); setMenu(null);
    if (l.locked) { editor.flash(t.toastLocked); return; }
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: l.id, mode, x0: e.clientX, before: state, layer: l };
  };
  const moveDrag = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current; if (!d || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    e.stopPropagation();
    const sp = secondsPerPx(), dt = (e.clientX - d.x0) * sp, l = d.layer;
    const targets = e.metaKey || e.ctrlKey || !settings.snapping ? [] : snapTargets(d.before, l.id, duration, view.t, beats);
    let next: TimelineState, hit: ReturnType<typeof snap>;
    if (sequence && d.mode === 'move') {
      // In a sequence, moving a shot slides it between its neighbours; only those two give or take time.
      hit = snap([l.in + dt, l.out + dt], targets.filter(x => x.kind !== 'edge'), SNAP_PX * sp);
      next = slideSequence(d.before, l.id, l.in + dt + (hit?.shift ?? 0));
    } else if (sequence) {
      // Each end is the boundary with the neighbour on that side.
      const mode = d.mode as 'in' | 'out', edge = (mode === 'in' ? l.in : l.out) + dt;
      hit = snap([edge], targets.filter(x => x.kind !== 'edge'), SNAP_PX * sp);
      next = trimSequence(d.before, l.id, mode, edge + (hit?.shift ?? 0));
    } else if (d.mode === 'move') {
      hit = snap([l.in + dt, l.out + dt], targets, SNAP_PX * sp);
      next = moveLayer(d.before, l.id, l.in + dt + (hit?.shift ?? 0), duration, declared(l));
    } else {
      const edge = (d.mode === 'in' ? l.in : l.out) + dt;
      hit = snap([edge], targets, SNAP_PX * sp);
      next = trimLayer(d.before, l.id, d.mode, edge + (hit?.shift ?? 0), duration, declared(l));
    }
    setGuide(hit?.target ?? null);
    editor.preview(next);
  };
  const endDrag = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current; if (!d) return;
    e.stopPropagation();
    drag.current = null; setGuide(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    editor.endDrag(d.before);
  };
  const dragProps = (l: TimelineLayer, mode: Drag['mode']) => ({ onPointerDown: (e: ReactPointerEvent<HTMLElement>) => startDrag(e, l, mode), onPointerMove: moveDrag, onPointerUp: endDrag, onPointerCancel: endDrag });

  const rowHeight = () => (names.current?.querySelector('li.layer') as HTMLElement | null)?.getBoundingClientRect().height ?? 40;
  const startReorder = (e: ReactPointerEvent<HTMLElement>, l: TimelineLayer) => {
    if (e.button !== 0 || !state || renaming) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const from = state.layers.findIndex(x => x.id === l.id);
    setReorder({ id: l.id, y0: e.clientY, from, to: from, moved: false });
  };
  const moveReorder = (e: ReactPointerEvent<HTMLElement>) => {
    if (!reorder || !state || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const dy = e.clientY - reorder.y0;
    if (!reorder.moved && Math.abs(dy) < 4) return;
    const to = Math.min(state.layers.length - 1, Math.max(0, reorder.from + Math.round(dy / rowHeight())));
    if (to !== reorder.to || !reorder.moved) setReorder({ ...reorder, to, moved: true });
  };
  const endReorder = (e: ReactPointerEvent<HTMLElement>) => {
    const r = reorder; if (!r) return;
    setReorder(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (r.moved && r.to !== r.from) { editor.commit(s => sequence ? reorderSequence(s, r.id, r.to) : reorderLayer(s, r.id, r.to)); editor.select(r.id); }
  };
  const reorderProps = (l: TimelineLayer) => ({ onPointerDown: (e: ReactPointerEvent<HTMLElement>) => startReorder(e, l), onPointerMove: moveReorder, onPointerUp: endReorder, onPointerCancel: endReorder });
  const shiftOf = (index: number) => {
    if (!reorder?.moved) return 0;
    const { from, to } = reorder;
    if (index === from) return to - from;
    if (from < to && index > from && index <= to) return -1;
    if (from > to && index < from && index >= to) return 1;
    return 0;
  };

  const startSpan = (e: ReactPointerEvent<HTMLElement>, index: number, mode: 'move' | 'in' | 'out') => {
    if (e.button !== 0) return;
    e.stopPropagation(); setTrMenu(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    span.current = { index, mode, x0: e.clientX, trs: structuredClone(snapshot.project?.review.transitions ?? []) };
  };
  const moveSpan = (e: ReactPointerEvent<HTMLElement>) => {
    const d = span.current; if (!d || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    e.stopPropagation();
    const sp = secondsPerPx(), dt = (e.clientX - d.x0) * sp, r = (v: number) => Math.round(v * 1000) / 1000;
    const targets = e.metaKey || e.ctrlKey || !settings.snapping ? [] : [{ t: view.t, kind: 'playhead' as const }, ...beats.map(b => ({ t: b.t, kind: b.bar ? 'bar' as const : 'beat' as const }))];
    const tr = d.trs[d.index]!, length = tr.end - tr.start;
    const edge = d.mode === 'in' ? tr.start + dt : d.mode === 'out' ? tr.end + dt : tr.start + dt;
    const hit = snap(d.mode === 'move' ? [edge, edge + length] : [edge], targets, SNAP_PX * sp);
    const v = edge + (hit?.shift ?? 0);
    const next = d.mode === 'move' ? { ...tr, start: r(Math.min(Math.max(0, v), duration - length)), end: r(Math.min(Math.max(0, v), duration - length) + length) }
      : d.mode === 'in' ? { ...tr, start: r(Math.min(Math.max(0, v), tr.end - .1)) } : { ...tr, end: r(Math.max(Math.min(duration, v), tr.start + .1)) };
    setGuide(hit?.target ?? null);
    setTrs(d.trs.map((x, i) => i === d.index ? next : x));
  };
  const endSpan = (e: ReactPointerEvent<HTMLElement>) => {
    const d = span.current; if (!d) return;
    e.stopPropagation(); span.current = null; setGuide(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (trs && JSON.stringify(trs) !== JSON.stringify(d.trs)) void onTransitions(trs).catch((error: Error) => { setTrs(null); editor.flash(error.message, true); });
  };
  const spanProps = (index: number, mode: 'move' | 'in' | 'out') => ({ onPointerDown: (e: ReactPointerEvent<HTMLElement>) => startSpan(e, index, mode), onPointerMove: moveSpan, onPointerUp: endSpan, onPointerCancel: endSpan });
  useEffect(() => {
    if (!trMenu) return;
    const close = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('.layer-menu')) setTrMenu(null); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [trMenu]);

  const scrub = {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      // A click on empty track space seeks and lets go of the selected layer.
      if (!(e.target as HTMLElement).closest('.solid')) editor.select(null);
      e.currentTarget.setPointerCapture(e.pointerId); onSeek(at(e.clientX));
    },
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) onSeek(at(e.clientX)); },
  };
  const openMenu = (e: ReactMouseEvent, l: TimelineLayer) => { e.preventDefault(); editor.select(l.id); setMenu({ id: l.id, x: e.clientX, y: e.clientY }); };
  const menuLayer = menu ? state?.layers.find(l => l.id === menu.id) : undefined;

  return <div className={`timeline ${settings.density}`} style={{ '--tl-rows': rows, '--names': `${namesPanel.width}px` } as CSSProperties}>
    <div className="tl-tools">
      <span className="tl-count">{layered ? t.layers(state.layers.length) : t.shots(tracks.filter(x => x.kind === 'shot').length)}{project.audio ? ` · ${t.music}` : ''}{editor.saving ? <span className="tl-saving"> · {t.saving}</span> : null}</span>
      <div className="tl-tools-end">
        <button className="tl-icon" onClick={() => setKeysOpen(true)} aria-label={t.shortcuts} title={`${t.shortcuts} (?)`}><KeyboardIcon size={17} /></button>
        <span className="tl-sep" aria-hidden="true" />
        {/* A div, not a label: a label would pass the slider's click to the Fit button and undo the zoom. */}
        <div className="tl-zoom" title={`${t.zoom} (⌘ + scroll)`}>
          <button className="tl-icon" aria-label={t.fit} title={t.fit} onClick={() => zoomTo(1)} disabled={zoom === 1}><ArrowsInLineHorizontalIcon size={17} /></button>
          <button className="tl-icon" aria-label={t.zoomOut} title={t.zoomOut} onClick={() => zoomTo(zoom / 1.5)} disabled={zoom <= ZOOM_MIN}><MagnifyingGlassMinusIcon size={17} /></button>
          <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={0.1} value={zoom} aria-label={t.zoom} onChange={e => zoomTo(Number(e.target.value))} />
          <button className="tl-icon" aria-label={t.zoomIn} title={t.zoomIn} onClick={() => zoomTo(zoom * 1.5)} disabled={zoom >= ZOOM_MAX}><MagnifyingGlassPlusIcon size={17} /></button>
          <output>{Math.round(zoom * 100)}%</output>
        </div>
      </div>
    </div>
    <div className="tl-frame">
    <PanelHandle side="left" panel={namesPanel} label={t.resizeNames} />
    <div className="tl-body">
      <ul className="tl-names" ref={names} aria-label={t.timeline}>
        <li className="tl-ruler-gap"><span>{layered ? t.layer : t.shotsHeading}</span></li>
        {state?.layers.map((l, index) => <li key={l.id} className={`layer ${editor.selected === l.id ? 'current' : ''} ${l.hidden ? 'is-hidden' : 'shown'} ${reorder?.moved && reorder.id === l.id ? 'lifting' : ''}`} style={{ '--shift': shiftOf(index), '--lc': l.colour ?? '#8a8f98' } as CSSProperties} onContextMenu={e => openMenu(e, l)}>
          {renaming === l.id
            ? <input className="tl-rename" type="text" autoFocus defaultValue={l.name} aria-label={t.rename} title={t.renameHint} maxLength={120}
                onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') { e.currentTarget.value = l.name; e.currentTarget.blur(); } }}
                onBlur={e => { act.rename(l, e.currentTarget.value); setRenaming(null); }} />
            : <button className="tl-name" {...reorderProps(l)} onClick={() => editor.select(editor.selected === l.id ? null : l.id)} onDoubleClick={() => setRenaming(l.id)} title={`${l.name}: ${l.in.toFixed(2)}–${l.out.toFixed(2)}s · ${t.dragToReorder}`}><b className="tl-grip" aria-hidden="true" /><i style={{ background: l.colour ?? '#8a8f98' }} /><span>{l.name}</span>{badge(l) ? <em className="tl-sub">{badge(l)}</em> : null}</button>}
          <button className={`tl-lock ${l.locked ? 'on' : ''}`} aria-label={l.locked ? t.unlock : t.lock} aria-pressed={l.locked} title={l.locked ? t.unlock : t.lock} onClick={() => act.lock(l)}><Lock /></button>
          {sequence ? null : <button className="tl-eye" aria-label={l.hidden ? t.show : t.hide} aria-pressed={l.hidden} title={`${l.hidden ? t.show : t.hide} (H)`} onClick={() => act.hide(l)}><Eye open={!l.hidden} /></button>}
        </li>)}
        {tracks.map(track => <li key={track.id} className={`${track.kind} ${currentShot === track.id ? 'current' : ''}`}>
          <button onClick={() => onSeek(track.solids[0]!.start)} title={track.name}><i style={{ background: track.colour }} /><span>{track.name}</span></button>
        </li>)}
        {transitions.map(track => <li key={track.id} className="transition"><span><i />{track.name}</span></li>)}
        {project.audio ? <li className="music" title={project.audio.path}><span><i />{basename(project.audio.path)}</span></li> : null}
        {!layered && !tracks.length ? <li className="tl-empty">{t.noShots}</li> : null}
      </ul>
      <div className="tl-scroll" ref={scroller}>
        <div className="track-area" ref={area} style={{ width: `${zoom * 100}%` }} role="slider" tabIndex={0} aria-label={t.timeline} aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Number(view.t.toFixed(3))} aria-valuetext={`${view.t.toFixed(2)} s`} {...scrub}>
          <div className="ruler">
            {frames <= 600 * zoom ? <div className="frame-ticks" style={{ backgroundSize: `${100 / frames}% 100%` }} /> : null}
            {ticks(duration, zoom).map(x => <span key={x} style={{ left: pct(x) }}>{x}s</span>)}
            {/* Slide stops and review marks belong to Present mode, not the video timeline. */}
          </div>
          <div className="tl-rows">
            {settings.beats ? beats.map(b => <i key={b.t} className={b.bar ? 'beat bar' : 'beat'} style={{ left: pct(b.t) }} />) : null}
            {state?.layers.map(l => {
              const ph = phases(l), length = Math.max(1e-6, l.out - l.in);
              return <div key={l.id} className={`tl-row layer ${editor.selected === l.id ? 'current' : ''} ${reorder?.moved && reorder.id === l.id ? 'lifting' : ''}`} style={{ '--shift': shiftOf(state.layers.indexOf(l)) } as CSSProperties} onContextMenu={e => openMenu(e, l)}>
                <div className={`solid ${editor.selected === l.id ? 'current' : ''} ${l.hidden ? 'is-hidden' : ''} ${l.locked ? 'is-locked' : ''}`} data-layer={l.id}
                  style={{ left: pct(l.in), width: pct(length), '--c': l.colour ?? '#8a8f98' } as CSSProperties}
                  title={`${l.name}: ${l.in.toFixed(2)}–${l.out.toFixed(2)}s · ${t.enter} ${t.motions[l.enter]} · ${t.exit} ${t.motions[l.exit]}`}
                  {...dragProps(l, 'move')}>
                  {ph.enter > 0 ? <i className="phase enter" style={{ width: `${(ph.enter / length) * 100}%` }} /> : null}
                  {ph.exit > 0 ? <i className="phase exit" style={{ width: `${(ph.exit / length) * 100}%` }} /> : null}
                  <span>{l.name}{l.enter !== 'none' || l.exit !== 'none' ? <em className="solid-motion"> · {t.motions[l.enter]} → {t.motions[l.exit]}</em> : null}</span>
                  {l.locked ? null : <>{sequence && state.layers[0]?.id === l.id ? null : <b className="handle in" {...dragProps(l, 'in')} />}<b className="handle out" {...dragProps(l, 'out')} /></>}
                </div>
              </div>;
            })}
            {[...tracks, ...transitions].map(track => <div key={track.id} className={`tl-row ${track.kind}`}>
              {track.solids.map((solid, i) => {
                const editable = track.kind === 'transition';
                return <div key={i} className={`solid ${currentShot === track.id ? 'current' : ''} ${editable ? 'editable' : ''}`} style={{ left: pct(solid.start), width: pct(solid.end - solid.start), '--c': track.colour } as CSSProperties}
                  title={`${solid.name}: ${solid.start.toFixed(2)}–${solid.end.toFixed(2)}s${editable ? ` · ${t.dragTransition}` : ''}`}
                  {...(editable ? spanProps(i, 'move') : { onPointerDown: (e: ReactPointerEvent<HTMLElement>) => { e.stopPropagation(); onSeek(solid.start); } })}
                  onContextMenu={editable ? e => { e.preventDefault(); setTrMenu({ index: i, x: e.clientX, y: e.clientY }); } : undefined}>
                  <span>{solid.name}</span>
                  {solid.stop !== undefined ? <i className="stop" style={{ left: `${((solid.stop - solid.start) / Math.max(1e-6, solid.end - solid.start)) * 100}%` }} /> : null}
                  {editable ? <><b className="handle in" {...spanProps(i, 'in')} /><b className="handle out" {...spanProps(i, 'out')} /></> : null}
                </div>;
              })}
            </div>)}
            {project.audio ? <div className="tl-row music-lane">
              {audio ? <Waveform audio={audio} duration={duration} zoom={zoom} ready={view.sound !== 'loading' && view.sound !== 'none' && view.sound !== 'error'} /> : null}
              {view.sound === 'loading' || view.sound === 'error' ? <span className="music-label">{view.sound === 'loading' ? t.loadingMusic : (audio?.error || t.musicFailed)}</span> : null}
            </div> : null}
          </div>
          {guide ? <div className="snap-guide" style={{ left: pct(guide.t) }}><span>{t.snap[guide.kind]} {guide.t.toFixed(2)}s</span></div> : null}
          <div className="playhead" style={{ left: pct(view.t) }}><b>{view.t.toFixed(2)}</b></div>
        </div>
      </div>
    </div>
    </div>
    {layered ? null : <div className="timeline-foot"><span>{t.noLayersHint}</span></div>}
    {menu && menuLayer ? <div className="layer-menu" role="menu" aria-label={menuLayer.name} style={{ left: Math.min(menu.x, innerWidth - 276), top: Math.min(menu.y, innerHeight - 400) }}>
      <div className="menu-title">{menuLayer.name}</div>
      <button role="menuitem" onClick={() => { setRenaming(menuLayer.id); setMenu(null); }}>{t.rename}<kbd>↵</kbd></button>
      <button role="menuitem" onClick={() => { act.duplicate(menuLayer); setMenu(null); }}>{t.duplicate}<kbd>⌘D</kbd></button>
      {sequence ? null : <button role="menuitem" onClick={() => { act.hide(menuLayer); setMenu(null); }}>{menuLayer.hidden ? t.show : t.hide}<kbd>H</kbd></button>}
      <button role="menuitem" onClick={() => { act.lock(menuLayer); setMenu(null); }}>{menuLayer.locked ? t.unlock : t.lock}</button>
    </div> : null}
    {trMenu ? <div className="layer-menu" role="menu" aria-label={t.transitions} style={{ left: Math.min(trMenu.x, innerWidth - 276), top: Math.min(trMenu.y, innerHeight - 120) }}>
      <div className="menu-title">{snapshot.project?.review.transitions[trMenu.index]?.name ?? t.transitions}</div>
      <button role="menuitem" onClick={() => { onSeek(snapshot.project?.review.transitions[trMenu.index]?.start ?? 0); setTrMenu(null); }}>{t.jump}</button>
    </div> : null}
    {editor.toast ? <div className={`tl-toast ${editor.toast.error ? 'error' : ''}`} role="status">
      <span>{editor.toast.error ? t.toastSaveFailed(editor.toast.text) : editor.toast.text}</span>
      {editor.toast.undo ? <button className="text-button" onClick={() => { editor.undo(); editor.flash(t.toastUndo); }}>{t.undo}</button> : null}
    </div> : null}
    {keysOpen ? <div className="keys-dialog" role="dialog" aria-modal="true" aria-label={t.shortcuts} onPointerDown={e => { if (e.target === e.currentTarget) setKeysOpen(false); }}>
      <div className="keys-card">
        <header><h2>{t.shortcuts}</h2><button className="text-button" onClick={() => setKeysOpen(false)}>{t.close}</button></header>
        <div className="keys-groups">{t.keys.map(([group, rows]) => <section key={group}><h3>{group}</h3><dl>{rows.map(([k, v]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>)}</dl></section>)}</div>
      </div>
    </div> : null}
  </div>;
}
