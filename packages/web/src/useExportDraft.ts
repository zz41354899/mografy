import { useReducer } from 'react';
import type { AspectRatio, ExportFormat, ExportSize, RenderSettings, Snapshot } from '@mografy/core';
import { createExportDraft, exportDraftReducer } from './export-draft.js';
import type { ExportQuality } from './export-draft.js';

export function useExportDraft(snapshot: Snapshot) {
  const [draft, dispatch] = useReducer(exportDraftReducer, snapshot, snapshot => createExportDraft(snapshot.scene!.meta, snapshot.project!.render));
  return {
    format: draft.format, ...draft.formats[draft.format],
    setFormat: (format: ExportFormat) => dispatch({ type: 'format', format }),
    patch: (settings: Partial<RenderSettings>) => dispatch({ type: 'patch', settings }),
    setQuality: (quality: ExportQuality) => dispatch({ type: 'quality', quality, base: snapshot.project!.render }),
    setOrientation: (ratio: AspectRatio) => dispatch({ type: 'orientation', ratio }),
    setSize: (size: Pick<ExportSize, 'width' | 'height'>) => dispatch({ type: 'size', size }),
    setFit: (fit: ExportSize['fit']) => dispatch({ type: 'fit', fit }),
  };
}
export type ExportDraftController = ReturnType<typeof useExportDraft>;
