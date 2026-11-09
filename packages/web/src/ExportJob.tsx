import { isVideoFormat } from '@mografy/core';
import { useEffect, useRef, useState } from 'react';
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check';
import { DownloadSimpleIcon } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { PauseIcon } from '@phosphor-icons/react/dist/csr/Pause';
import type { RenderStatus } from '@mografy/core';
import { apiPath } from './api.js';
import type { Session } from './session.js';
import { ExportPreview } from './ExportPreview.js';
import { ExportMascot } from './ExportMascot.js';

import { exportProgress } from './export-state.js';
import type { ExportJobPreview } from './export-state.js';
import { useExportCancellation } from './useExportCancellation.js';
import { ExportProgressBar } from './ExportProgressBar.js';
import { useT } from './i18n.js';
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function ExportJob({ job, preview, session, onClose, onRetry, onEdit, starting, requestError }: {
  job: RenderStatus; preview: ExportJobPreview | null; session: Session;
  onClose(): void; onRetry(): void; onEdit(): void; starting: boolean; requestError: string;
}) {
  const t = useT();
  const { running, ready, failed, percentage, indeterminate, stageLabel } = exportProgress(job);
  const { stopped, error, cancel } = useExportCancellation(job, session);
  const [now, setNow] = useState(Date.now());
  const title = useRef<HTMLHeadingElement>(null);
  // A browser without H.265 support either reports an error or plays only the sound with an empty picture.
  const [unplayable, setUnplayable] = useState(false);
  useEffect(() => { setUnplayable(false); }, [job.id]);
  useEffect(() => { title.current?.focus(); }, [job.id, job.state]);
  useEffect(() => {
    if (!running) return;
    setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running, job.id]);
  const elapsed = Math.max(0, ((job.finishedAt ? Date.parse(job.finishedAt) : now) - Date.parse(job.startedAt)) / 1000);
  const heading = ready ? t.xjReady : failed ? t.exportFailed : !running ? t.exportCancelled : stopped ? t.xjCancelling : t.stage[stageLabel];
  const url = apiPath(`files/${job.output.slice(session.snapshot!.projectDir.length + 1).split(/[\\/]/).map(encodeURIComponent).join('/')}`);
  const filename = job.output.split(/[\\/]/).pop();
  return <div className={`export-job-view ${ready ? 'is-ready' : failed ? 'is-failed' : !running ? 'is-cancelled' : 'is-rendering'}`} data-testid="export-job" data-state={job.state}>
    <div className="export-job-scene">
      <div className="export-job-art">
        {running ? <ExportMascot paused={stopped} /> : ready && isVideoFormat(job.format) && !unplayable ? <video className="export-result-video" src={url} controls playsInline preload="metadata" aria-label={t.xjVideo}
            onError={() => setUnplayable(true)} onLoadedMetadata={e => { if (!e.currentTarget.videoWidth) setUnplayable(true); }} />
          : ready && preview ? <ExportPreview {...preview} label={t.xjFramePreview} />
          : <div className={`export-result-mark ${ready ? 'complete' : ''}`} aria-hidden="true">{ready ? <CheckIcon size={48} weight="bold" /> : failed ? <WarningCircleIcon size={48} /> : <PauseIcon size={44} />}</div>}
      </div>
      <div className="export-job-caption"><strong>{job.format === 'lottie' ? 'Lottie' : job.format.toUpperCase()}</strong>{preview ? <span>{preview.size.width} × {preview.size.height}</span> : null}</div>
    </div>
    <div className="export-job-content">
      <h3 ref={title} tabIndex={-1}><span role="status" aria-live="polite">{heading}</span>{ready ? <CheckIcon size={21} weight="bold" aria-hidden="true" /> : null}</h3>
      {running ? <>
        <div className="export-job-metric"><span>{indeterminate ? '···' : String(percentage)}{indeterminate ? null : <small>%</small>}</span></div>
        <ExportProgressBar percentage={percentage} indeterminate={indeterminate} />
        <div className="export-job-detail"><span>{job.done.toLocaleString()} / {job.total.toLocaleString()} {t.xjFrames}</span><time title={t.xjElapsed}>{clock(elapsed)}</time></div>
      </> : ready ? <p className="export-job-file" title={filename}>{filename}</p> : null}
      {ready && unplayable ? <p className="export-job-note" role="status">{t.xjUnplayable}</p> : null}
      {ready && (job.encoder || job.note) ? <p className="export-job-note" role="status">{[job.encoder ? t.xjEncoder(job.encoder) : '', job.note ?? ''].filter(Boolean).join(' ')}</p> : null}
      {job.error || error || requestError ? <p className="export-job-error" role="alert">{requestError || error || job.error}</p> : null}
      {running && session.connection !== 'connected' ? <p className="export-job-error" role="status">{t.reconnectingDots}</p> : null}
      <div className="export-job-footer">
        {running ? <><button type="button" className="text-button" aria-label={t.xjCancelExport} disabled={stopped} onClick={() => void cancel()}>{stopped ? t.cancelling : t.cancel}</button><button type="button" aria-label={t.xjHideExport} title={t.xjHideHelp} onClick={onClose}>{t.xjHide}</button></>
          : ready ? <><button type="button" onClick={onClose}>{t.xjDone}</button><a className="export-primary export-job-download" href={url} download><DownloadSimpleIcon size={17} />{t.xjDownload}</a></>
          : <><button type="button" aria-label={t.xjEditSettings} onClick={onEdit}>{t.settings}</button>{preview ? <button type="button" className="export-primary" aria-label={t.xjRetryExport} disabled={starting} onClick={onRetry}><ArrowCounterClockwiseIcon size={16} />{starting ? t.xjStarting : t.retry}</button> : <button type="button" onClick={onClose}>{t.close}</button>}</>}
      </div>
    </div>
  </div>;
}
