import type { RenderStatus } from '@mografy/core';
import type { Session } from './session.js';
import { exportProgress } from './export-state.js';
import { useExportCancellation } from './useExportCancellation.js';
import { ExportProgressBar } from './ExportProgressBar.js';
import { ExportMascot } from './ExportMascot.js';
import { useT } from './i18n.js';

export function ExportProgressToast({ job, session, onOpen }: { job: RenderStatus; session: Session; onOpen(): void }) {
  const t = useT();
  const { stopped, error, cancel } = useExportCancellation(job, session);
  const { percentage, indeterminate, stageLabel } = exportProgress(job);
  const heading = stopped ? t.cancelling : session.connection !== 'connected' ? t.reconnectingDots : `${t.stage[stageLabel]}…`;
  return <aside className="export-progress-toast" aria-label={t.xjProgress}>
    <div className="export-toast-summary"><ExportMascot compact paused={stopped} /><div><span role="status">{heading}</span><small>{job.format === 'lottie' ? 'Lottie' : job.format.toUpperCase()}</small></div>{!indeterminate ? <strong>{percentage}<small>%</small></strong> : null}</div>
    <ExportProgressBar percentage={percentage} indeterminate={indeterminate} />
    {error ? <p className="error-text" role="alert">{error}</p> : null}
    <div className="export-toast-actions"><button type="button" className="text-button" aria-label={t.xjCancelExport} disabled={stopped} onClick={() => void cancel()}>{t.cancel}</button><button type="button" aria-label={t.xjViewExport} onClick={onOpen}>{t.xjView}</button></div>
  </aside>;
}
