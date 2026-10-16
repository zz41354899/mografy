import type { ExportSize, RenderSettings, RenderStatus, Snapshot } from '@mografy/core';

export interface ExportJobPreview { snapshot: Snapshot; size: ExportSize; settings: RenderSettings }

export interface ExportPanelState {
  mode: 'closed' | 'settings' | 'job' | 'hidden';
  generation: number;
}
export type ExportPanelAction = { type: 'settings' | 'resume' | 'reset' } | { type: 'close'; keepJob: boolean };
export const INITIAL_EXPORT_PANEL: ExportPanelState = { mode: 'closed', generation: 0 };

export function exportPanelReducer(state: ExportPanelState, action: ExportPanelAction): ExportPanelState {
  switch (action.type) {
    case 'settings': return { mode: 'settings', generation: state.generation + 1 };
    case 'resume': return { ...state, mode: 'job' };
    case 'close': return { ...state, mode: action.keepJob ? 'hidden' : 'closed' };
    case 'reset': return { mode: 'closed', generation: state.generation + 1 };
  }
}

export type ExportJobState = { mode: 'settings' } | { mode: 'job'; job: RenderStatus; preview: ExportJobPreview | null };
export type ExportJobAction = { type: 'edit' } | { type: 'track'; job: RenderStatus; preview?: ExportJobPreview | null };

export function exportJobReducer(state: ExportJobState, action: ExportJobAction): ExportJobState {
  if (action.type === 'edit') return { mode: 'settings' };
  const preview = action.preview !== undefined ? action.preview : state.mode === 'job' && state.job.id === action.job.id ? state.preview : null;
  return { mode: 'job', job: action.job, preview };
}

export function exportProgress(job: RenderStatus) {
  const running = job.state === 'running';
  return {
    running, ready: job.state === 'done', failed: job.state === 'failed',
    percentage: Math.min(100, Math.max(0, Math.round(job.done / Math.max(1, job.total) * 100))),
    indeterminate: running && job.stage !== 'capture',
    stageLabel: job.stage === 'capture' ? 'Exporting' : job.format === 'mp4' ? 'Encoding' : 'Packaging',
  };
}
