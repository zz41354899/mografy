import type { RenderStatus } from '@mografy/core';
import type { Session } from './session.js';
import { exportProgress } from './export-state.js';
import { useExportCancellation } from './useExportCancellation.js';
import { ExportProgressBar } from './ExportProgressBar.js';
import { ExportMascot } from './ExportMascot.js';

export function ExportProgressToast({ job, session, onOpen }: { job: RenderStatus; session: Session; onOpen(): void }) {
  const { stopped, error, cancel } = useExportCancellation(job, session);
  const { percentage, indeterminate, stageLabel } = exportProgress(job);
  const heading = stopped ? 'Cancelling…' : session.connection !== 'connected' ? 'Reconnecting…' : `${stageLabel}…`;
  return <aside className="export-progress-toast" aria-label="Export progress">
    <div className="export-toast-summary"><ExportMascot compact paused={stopped} /><div><span role="status">{heading}</span><small>{job.format === 'lottie' ? 'Lottie' : job.format.toUpperCase()}</small></div>{!indeterminate ? <strong>{percentage}<small>%</small></strong> : null}</div>
    <ExportProgressBar percentage={percentage} indeterminate={indeterminate} />
    {error ? <p className="error-text" role="alert">{error}</p> : null}
    <div className="export-toast-actions"><button type="button" className="text-button" aria-label="Cancel export" disabled={stopped} onClick={() => void cancel()}>Cancel</button><button type="button" aria-label="View export" onClick={onOpen}>View</button></div>
  </aside>;
}
