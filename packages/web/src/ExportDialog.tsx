import { useEffect, useRef, useState, useReducer } from 'react';
import { XIcon } from '@phosphor-icons/react/dist/csr/X';
import type { ExportFormat, ExportSize, RenderSettings, Snapshot } from '@mografy/core';
import { ExportJob } from './ExportJob.js';
import { ExportSettings } from './ExportSettings.js';
import { useExportDraft } from './useExportDraft.js';
import { exportJobReducer } from './export-state.js';
import type { ExportJobState } from './export-state.js';
import type { Session } from './session.js';

export function ExportDialog({ snapshot, session, open, resume, onClose }: { snapshot: Snapshot; session: Session; open: boolean; resume: boolean; onClose(keepJob: boolean): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const draft = useExportDraft(snapshot);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [jobState, dispatchJob] = useReducer(exportJobReducer, undefined, (): ExportJobState => resume && snapshot.render ? { mode: 'job', job: snapshot.render, preview: null } : { mode: 'settings' });
  const job = jobState.mode === 'job' ? jobState.job : null;
  const preview = jobState.mode === 'job' ? jobState.preview : null;
  const activeJob = snapshot.render?.id === job?.id ? snapshot.render : job;
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  useEffect(() => {
    if (open && !busy && snapshot.render?.state === 'running' && snapshot.render.id !== job?.id) { dispatchJob({ type: 'track', job: snapshot.render }); draft.setFormat(snapshot.render.format); }
  }, [open, snapshot.render?.id, busy]);
  useEffect(() => { if (snapshot.render && snapshot.render.id === job?.id) dispatchJob({ type: 'track', job: snapshot.render }); }, [snapshot.render, job?.id]);
  const close = () => onClose(activeJob?.state === 'running');
  const submit = async (saved?: { format: ExportFormat; size: ExportSize; settings: RenderSettings }) => {
    const { format, size, settings } = saved ?? draft;
    setBusy(true); setError('');
    try {
      const nextPreview = { snapshot: structuredClone(snapshot), size: { width: size.width, height: size.height, fit: size.fit }, settings: { ...settings } };
      const next = await session.startRender({ format, size: nextPreview.size, render: settings });
      dispatchJob({ type: 'track', job: next, preview: nextPreview });
    }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} className={`export-dialog ${activeJob ? 'export-job-dialog' : ''}`} aria-labelledby="export-title"
    onCancel={e => { e.preventDefault(); if (!busy) close(); }} onClick={e => { if (e.target === e.currentTarget && !busy) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close(); } }}>
    <header className="export-header"><h2 id="export-title">Export animation</h2><button type="button" className="icon-button" aria-label="Close export" title="Close" disabled={busy} onClick={close}><XIcon size={19} /></button></header>
    {activeJob ? <ExportJob job={activeJob} preview={preview} session={session} onClose={close} onRetry={() => { if (preview) void submit({ format: activeJob.format, size: preview.size, settings: preview.settings }); }} onEdit={() => { draft.setFormat(activeJob.format); dispatchJob({ type: 'edit' }); setError(''); }} starting={busy} requestError={error} /> : <ExportSettings snapshot={snapshot} draft={draft} busy={busy} error={error} clearError={() => setError('')} onSubmit={() => void submit()} onClose={close} />}
  </dialog>;
}
