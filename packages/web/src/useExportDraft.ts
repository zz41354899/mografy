import { useEffect, useReducer } from 'react';
import type { AspectRatio, ExportFormat, ExportPreset, ExportSize, RenderSettings, Snapshot } from '@mografy/core';
import { createExportDraft, exportDraftReducer } from './export-draft.js';
import type { ExportDraft, ExportQuality } from './export-draft.js';

/**
 * The last export settings per project, so the next export opens where the last one left off. They are kept only
 * while the project's own render settings (mografy.json) stay the same: when those change, the dialog starts from them.
 */
const key = (dir: string) => `mografy.export.draft:${dir}`;
function restore(snapshot: Snapshot): ExportDraft {
  const fresh = createExportDraft(snapshot.scene!.meta, snapshot.project!.render);
  try {
    const stored = JSON.parse(localStorage.getItem(key(snapshot.projectDir)) ?? 'null') as { base?: string; draft?: ExportDraft } | null;
    const saved = stored?.base === JSON.stringify(snapshot.project!.render) ? stored.draft : null;
    if (!saved || !(saved.format in fresh.formats)) return fresh;
    // Keep only formats the saved copy has in full; anything newer falls back to the project's settings.
    const formats = { ...fresh.formats };
    for (const f of Object.keys(fresh.formats) as (keyof typeof formats)[]) {
      const s = saved.formats?.[f];
      if (s && typeof s === 'object' && s.settings && s.size) formats[f] = { ...fresh.formats[f], ...s, settings: { ...fresh.formats[f].settings, ...s.settings } };
    }
    return { format: saved.format, formats };
  } catch { return fresh; }
}

export function useExportDraft(snapshot: Snapshot) {
  const [draft, dispatch] = useReducer(exportDraftReducer, snapshot, restore);
  useEffect(() => { try { localStorage.setItem(key(snapshot.projectDir), JSON.stringify({ base: JSON.stringify(snapshot.project!.render), draft })); } catch { /* optional */ } }, [draft, snapshot.projectDir, snapshot.project]);
  return {
    format: draft.format, ...draft.formats[draft.format],
    setFormat: (format: ExportFormat) => dispatch({ type: 'format', format }),
    patch: (settings: Partial<RenderSettings>) => dispatch({ type: 'patch', settings }),
    setPreset: (preset: Exclude<ExportPreset, 'master'>) => dispatch({ type: 'preset', preset }),
    setQuality: (quality: ExportQuality) => dispatch({ type: 'quality', quality, base: snapshot.project!.render }),
    setOrientation: (ratio: AspectRatio) => dispatch({ type: 'orientation', ratio }),
    setSize: (size: Pick<ExportSize, 'width' | 'height'>) => dispatch({ type: 'size', size }),
    setFit: (fit: ExportSize['fit']) => dispatch({ type: 'fit', fit }),
  };
}
export type ExportDraftController = ReturnType<typeof useExportDraft>;
