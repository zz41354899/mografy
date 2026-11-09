// What the preview occupies: zoom and pan inside its area, and full screen. Everything here is view state; the film
// and the project are never touched.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { ScenePlayer } from './player.js';
import { clampZoom, stepZoom, wheelZoom } from './viewport.js';
import type { Zoom } from './viewport.js';

const IDLE_MS = 2500;

export function useViewport(stage: RefObject<HTMLDivElement | null>, filmWidth: number | undefined, presenting: boolean, player: ScenePlayer | null, playing: boolean) {
  const viewer = useRef<HTMLElement>(null), surround = useRef<HTMLDivElement>(null), dock = useRef<HTMLDivElement>(null);
  const [chosen, setChosen] = useState<Zoom>('fit');
  const [fullscreen, setFullscreen] = useState(false), [idle, setIdle] = useState(false);
  const zoom: Zoom = presenting ? 'fit' : chosen;
  const width = useRef(filmWidth); width.current = filmWidth;
  const current = useRef(zoom); current.current = zoom;
  // The film point that stays under the pointer (or the centre) while the zoom changes.
  const anchor = useRef<{ fx: number; fy: number; x: number; y: number } | null>(null);
  // A pan or a corner drag just ended: the click that follows must not play or pause.
  const dragged = useRef(false);

  const scale = useCallback(() => {
    const value = current.current; if (typeof value === 'number') return value;
    const shown = stage.current?.clientWidth;
    return shown && width.current ? shown / width.current : 1;
  }, [stage]);
  const zoomAround = useCallback((next: Zoom, point?: { x: number; y: number }) => {
    const rect = stage.current?.getBoundingClientRect(), box = surround.current?.getBoundingClientRect();
    if (rect?.width && box) {
      const at = point ?? { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      anchor.current = { fx: (at.x - rect.left) / rect.width, fy: (at.y - rect.top) / rect.height, x: at.x, y: at.y };
    }
    setChosen(next);
  }, [stage]);
  useLayoutEffect(() => {
    const point = anchor.current, area = surround.current, rect = stage.current?.getBoundingClientRect();
    anchor.current = null;
    if (!point || !area || !rect || zoom === 'fit') return;
    area.scrollLeft += rect.left + point.fx * rect.width - point.x;
    area.scrollTop += rect.top + point.fy * rect.height - point.y;
  }, [zoom, stage]);

  const zoomIn = useCallback(() => zoomAround(stepZoom(scale(), 1)), [zoomAround, scale]);
  const zoomOut = useCallback(() => zoomAround(stepZoom(scale(), -1)), [zoomAround, scale]);
  const setZoom = useCallback((next: Zoom) => zoomAround(next), [zoomAround]);

  useEffect(() => {
    const area = surround.current; if (!area || presenting) return;
    // React's wheel listener is passive, and ⌘-wheel or a pinch must not zoom the whole page.
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomAround(wheelZoom(scale(), event.deltaY * (event.deltaMode === 1 ? 16 : 1)), { x: event.clientX, y: event.clientY });
    };
    area.addEventListener('wheel', onWheel, { passive: false });
    return () => area.removeEventListener('wheel', onWheel);
  }, [presenting, zoomAround, scale]);

  /** Drag a zoomed preview to look around it. A press that does not move still plays or pauses. */
  const onStagePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragged.current = false;
    const area = surround.current;
    if (e.button !== 0 || zoom === 'fit' || !area || (area.scrollWidth <= area.clientWidth && area.scrollHeight <= area.clientHeight)) return;
    const x0 = e.clientX, y0 = e.clientY, left = area.scrollLeft, top = area.scrollTop;
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 3) dragged.current = true;
      if (dragged.current) { area.scrollLeft = left - (ev.clientX - x0); area.scrollTop = top - (ev.clientY - y0); }
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
  const clickWasDrag = () => { const was = dragged.current; dragged.current = false; return was; };

  /** A corner of the preview, dragged: the preview grows and shrinks around its centre, keeping its shape. */
  const onGripPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    const rect = stage.current?.getBoundingClientRect();
    if (e.button !== 0 || !rect) return;
    e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId);
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2, start = scale();
    const reach = Math.max(1, Math.hypot(e.clientX - cx, e.clientY - cy));
    const move = (ev: PointerEvent) => setChosen(clampZoom(start * Math.hypot(ev.clientX - cx, ev.clientY - cy) / reach));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
  const stopClick = (e: ReactMouseEvent) => e.stopPropagation();

  const toggleFullscreen = useCallback(() => {
    if (fullscreen) {
      setFullscreen(false);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      return;
    }
    // Without the browser's full screen (refused, or an iPhone), the preview still fills the window.
    setChosen('fit'); setFullscreen(true);
    void viewer.current?.requestFullscreen?.()?.catch(() => {});
  }, [fullscreen]);
  useEffect(() => {
    const onChange = () => { if (!document.fullscreenElement) setFullscreen(false); };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  useEffect(() => {
    if (!fullscreen) { setIdle(false); return; }
    // Esc is the browser's own in real full screen; the window-filling fallback handles it here.
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !document.fullscreenElement) setFullscreen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fullscreen]);
  // While a film plays full screen the controls step aside; any movement or key brings them back.
  useEffect(() => {
    if (!fullscreen) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      setIdle(false); clearTimeout(timer);
      if (playing) timer = setTimeout(() => { if (dock.current?.matches(':hover')) wake(); else setIdle(true); }, IDLE_MS);
    };
    wake();
    document.addEventListener('pointermove', wake); document.addEventListener('pointerdown', wake); document.addEventListener('keydown', wake);
    return () => { clearTimeout(timer); document.removeEventListener('pointermove', wake); document.removeEventListener('pointerdown', wake); document.removeEventListener('keydown', wake); };
  }, [fullscreen, playing]);

  // A larger preview may need more pixels than the film was first drawn with.
  useEffect(() => {
    if (zoom === 'fit' && !fullscreen) return;
    const timer = setTimeout(() => player?.sharpen(), 400);
    return () => clearTimeout(timer);
  }, [player, zoom, fullscreen]);

  return { viewer, surround, dock, zoom, fullscreen, idle, setZoom, zoomIn, zoomOut, toggleFullscreen, onStagePointerDown, clickWasDrag, onGripPointerDown, stopClick };
}
export type Viewport = ReturnType<typeof useViewport>;
