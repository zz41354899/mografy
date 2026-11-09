import { useEffect, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { readLocal, writeLocal } from './storage.js';

/** A panel size the viewer drags, remembered per browser. */
export function usePanelSize(key: string, initial: number, min: number, max: number) {
  const [size, setSize] = useState(() => { const v = Number(readLocal(key) ?? NaN); return v >= min && v <= max ? v : initial; });
  useEffect(() => { writeLocal(key, String(size)); }, [key, size]);
  const clamp = (v: number) => Math.round(Math.min(max, Math.max(min, v)));
  return { size, set: (v: number) => setSize(clamp(v)), reset: () => setSize(initial), min, max };
}

/** Follow one drag from the handle it started on, until the button is released. */
function dragHandle(e: ReactPointerEvent<HTMLElement>, bodyClass: string, onMove: (ev: PointerEvent) => void, onEnd: () => void) {
  e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
  document.body.classList.add(bodyClass);
  const up = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); document.body.classList.remove(bodyClass); onEnd(); };
  window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}

/**
 * The divider on a panel's inner edge. Drag to resize, double-click to restore, arrow keys for small steps.
 * `side` is where the panel sits: a left panel grows to the right, a right panel to the left.
 */
export function PanelHandle({ side, panel, label }: { side: 'left' | 'right'; panel: ReturnType<typeof usePanelSize>; label: string }) {
  const [active, setActive] = useState(false);
  const sign = side === 'left' ? 1 : -1;
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const x0 = e.clientX, start = panel.size;
    setActive(true);
    dragHandle(e, 'col-resizing', ev => panel.set(start + sign * (ev.clientX - x0)), () => setActive(false));
  };
  return <div className={`panel-handle ${side} ${active ? 'active' : ''}`} role="separator" aria-orientation="vertical" aria-label={label} title={label}
    aria-valuenow={panel.size} aria-valuemin={panel.min} aria-valuemax={panel.max} tabIndex={0}
    style={side === 'left' ? { left: panel.size } : { right: panel.size }}
    onPointerDown={down} onDoubleClick={panel.reset}
    onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); panel.set(panel.size + (e.key === 'ArrowRight' ? 16 : -16) * sign); } }} />;
}

/** The divider above the transport: up gives the timeline more height, far enough down folds it away. */
export function DockHandle({ dock, label, resolve }: { dock: ReturnType<typeof usePanelSize>; label: string; resolve(dragged: number): number }) {
  const [active, setActive] = useState(false);
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const y0 = e.clientY, start = dock.size;
    setActive(true);
    dragHandle(e, 'row-resizing', ev => dock.set(resolve(start + y0 - ev.clientY)), () => setActive(false));
  };
  return <div className={`dock-handle ${active ? 'active' : ''}`} role="separator" aria-orientation="horizontal" aria-label={label} title={label}
    aria-valuenow={dock.size} aria-valuemin={dock.min} aria-valuemax={dock.max} tabIndex={0}
    onPointerDown={down} onDoubleClick={dock.reset}
    onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); dock.set(resolve(dock.size + (e.key === 'ArrowUp' ? 16 : -16))); } }} />;
}
