// The preview's zoom: 'fit' follows the available space; a number is the scale against film pixels (1 = 100%).
export type Zoom = 'fit' | number;

export const ZOOM_MIN = 0.1, ZOOM_MAX = 4;
export const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2] as const;
const STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];

export const clampZoom = (zoom: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
/** The next stop past `zoom`; a zoom already between stops moves to the nearest one in that direction. */
export function stepZoom(zoom: number, direction: 1 | -1) {
  const next = direction > 0 ? STEPS.find(s => s > zoom + 1e-3) : [...STEPS].reverse().find(s => s < zoom - 1e-3);
  return next ?? clampZoom(zoom);
}
/** Trackpad pinches and ⌘-wheel send small deltas: zoom in proportion, so a gesture feels the same at any size. */
export const wheelZoom = (zoom: number, deltaY: number) => clampZoom(zoom * Math.exp(-deltaY * 0.002));
export const zoomPercent = (zoom: number) => `${Math.round(zoom * 100)}%`;
/** The timeline's divider: dragged past this far below its natural height, the timeline folds away. */
export const dockHeight = (dragged: number) => dragged < -30 ? -60 : Math.max(0, dragged);
