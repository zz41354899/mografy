import { isVideoFormat } from '@mografy/core';
import { useEffect, useRef, useState } from 'react';
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check';
import { DownloadSimpleIcon } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { PauseIcon } from '@phosphor-icons/react/dist/csr/Pause';
import type { RenderStatus } from '@mografy/core';
import type { Session } from './session.js';
import { ExportPreview } from './ExportPreview.js';
import { ExportMascot } from './ExportMascot.js';

import { exportProgress } from './export-state.js';
import type { ExportJobPreview } from './export-state.js';
import { useExportCancellation } from './useExportCancellation.js';
import { ExportProgressBar } from './ExportProgressBar.js';
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function ExportJob({ job, preview, session, onClose, onRetry, onEdit, starting, requestError }: {
  job: RenderStatus; preview: ExportJobPreview | null; session: Session;
  onClose(): void; onRetry(): void; onEdit(): void; starting: boolean; requestError: string;
}) {
  const { running, ready, failed, percentage, indeterminate, stageLabel } = exportProgress(job);
  const { stopped, error, cancel } = useExportCancellation(job, session);
  const [now, setNow] = useState(Date.now());
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus(); }, [job.id, job.state]);
  useEffect(() => {
    if (!running) return;
    setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running, job.id]);
  const elapsed = Math.max(0, ((job.finishedAt ? Date.parse(job.finishedAt) : now) - Date.parse(job.startedAt)) / 1000);
  const heading = ready ? 'Export ready' : failed ? 'Export failed' : !running ? 'Export cancelled' : stopped ? 'Cancelling' : stageLabel;
  const url = `/__mografy/files/${job.output.slice(session.snapshot!.projectDir.length + 1).split(/[\\/]/).map(encodeURIComponent).join('/')}`;
  const filename = job.output.split(/[\\/]/).pop();
  return <div className={`export-job-view ${ready ? 'is-ready' : failed ? 'is-failed' : !running ? 'is-cancelled' : 'is-rendering'}`} data-testid="export-job" data-state={job.state}>
    <div className="export-job-scene">
      <div className="export-job-art">
        {running ? <ExportMascot paused={stopped} /> : ready && isVideoFormat(job.format) ? <video className="export-result-video" src={url} controls playsInline preload="metadata" aria-label="Exported video" />
          : ready && preview ? <ExportPreview {...preview} label="Export frame preview" />
          : <div className={`export-result-mark ${ready ? 'complete' : ''}`} aria-hidden="true">{ready ? <CheckIcon size={48} weight="bold" /> : failed ? <WarningCircleIcon size={48} /> : <PauseIcon size={44} />}</div>}
      </div>
      <div className="export-job-caption"><strong>{job.format === 'lottie' ? 'Lottie' : job.format.toUpperCase()}</strong>{preview ? <span>{preview.size.width} × {preview.size.height}</span> : null}</div>
    </div>
    <div className="export-job-content">
      <h3 ref={title} tabIndex={-1}><span role="status" aria-live="polite">{heading}</span>{ready ? <CheckIcon size={21} weight="bold" aria-hidden="true" /> : null}</h3>
      {running ? <>
        <div className="export-job-metric"><span>{indeterminate ? '···' : String(percentage)}{indeterminate ? null : <small>%</small>}</span></div>
        <ExportProgressBar percentage={percentage} indeterminate={indeterminate} />
        <div className="export-job-detail"><span>{job.done.toLocaleString()} / {job.total.toLocaleString()} frames</span><time title="Elapsed time">{clock(elapsed)}</time></div>
      </> : ready ? <p className="export-job-file" title={filename}>{filename}</p> : null}
      {job.error || error || requestError ? <p className="export-job-error" role="alert">{requestError || error || job.error}</p> : null}
      {running && session.connection !== 'connected' ? <p className="export-job-error" role="status">Reconnecting…</p> : null}
      <div className="export-job-footer">
        {running ? <><button type="button" className="text-button" aria-label="Cancel export" disabled={stopped} onClick={() => void cancel()}>{stopped ? 'Cancelling…' : 'Cancel'}</button><button type="button" aria-label="Hide export" title="Continue exporting in the background" onClick={onClose}>Hide</button></>
          : ready ? <><button type="button" onClick={onClose}>Done</button><a className="export-primary export-job-download" href={url} download><DownloadSimpleIcon size={17} />Download</a></>
          : <><button type="button" aria-label="Edit settings" onClick={onEdit}>Settings</button>{preview ? <button type="button" className="export-primary" aria-label="Retry export" disabled={starting} onClick={onRetry}><ArrowCounterClockwiseIcon size={16} />{starting ? 'Starting…' : 'Retry'}</button> : <button type="button" onClick={onClose}>Close</button>}</>}
      </div>
    </div>
  </div>;
}
