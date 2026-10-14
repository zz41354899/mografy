import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { RenderStatus } from '@mografy/core';
import type { Session } from './session.js';
import { ExportMascot } from './ExportMascot.js';

export function ExportProgressToast({ job, session, onOpen }: { job: RenderStatus; session: Session; onOpen(): void }) {
  const [cancelling, setCancelling] = useState(false), [error, setError] = useState('');
  const stopped = cancelling || !!job.cancelling;
  const percentage = Math.min(100, Math.round(job.done / Math.max(1, job.total) * 100));
  const indeterminate = job.stage !== 'capture';
  const heading = stopped ? 'Cancelling…' : session.connection !== 'connected' ? 'Reconnecting…' : indeterminate ? job.format === 'mp4' ? 'Encoding…' : 'Packaging…' : 'Exporting…';
  const cancel = async () => {
    setCancelling(true); setError('');
    try { await session.cancelRender(job.id); }
    catch (e) { setCancelling(false); setError(e instanceof Error ? e.message : String(e)); }
  };
  return <aside className="export-progress-toast" aria-label="Export progress">
    <div className="export-toast-summary"><ExportMascot compact paused={stopped} /><div><span role="status">{heading}</span><small>{job.format === 'lottie' ? 'Lottie' : job.format.toUpperCase()}</small></div>{!indeterminate ? <strong>{percentage}<small>%</small></strong> : null}</div>
    <div className={`export-job-progress ${indeterminate ? 'indeterminate' : ''}`} role="progressbar" aria-label={indeterminate ? 'Finalizing export' : 'Frame capture'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={indeterminate ? undefined : percentage}><i style={{ '--progress': `${percentage}%` } as CSSProperties} /></div>
    {error ? <p className="error-text" role="alert">{error}</p> : null}
    <div className="export-toast-actions"><button type="button" className="text-button" aria-label="Cancel export" disabled={stopped} onClick={() => void cancel()}>Cancel</button><button type="button" aria-label="View export" onClick={onOpen}>View</button></div>
  </aside>;
}
