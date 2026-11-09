// The batch export queue: the film being captured, and every job in order.
import type { CSSProperties } from 'react';
import { XIcon } from '@phosphor-icons/react/dist/csr/X';
import type { QueueJob } from '@mografy/core';
import { Thumb } from './BatchThumb.js';
import { clock, formatName, isActive, jobProgress } from './batch-progress.js';
import { useT } from './i18n.js';
import type { Session } from './session.js';

const STRIP = 24;
/** The frame being captured, swept by a scan line, with a strip that fills as the film is captured. */
function CaptureScene({ job, version, index, count, now }: { job: QueueJob; version?: number | null | undefined; index: number; count: number; now: number }) {
  const t = useT();
  const { capture, percentage, elapsed, left, stage } = jobProgress(job, now);
  const filled = capture ? Math.floor(job.done / job.total * STRIP) : 0;
  return <>
    <h2 className="bx-label">{t.bxExportingOf(index + 1, count)}</h2>
    <div className={`bx-frame ${capture ? 'capturing' : ''}`} aria-hidden="true">
      <Thumb dir={job.dir} version={version} className="fill" />
      {capture ? <><i className="bx-grid" /><i className="bx-scan" /><i className="bx-edge" /></> : null}
      <span className="bx-fno">{capture ? t.bxFrame(job.done, job.total) : `${t.stage[stage]}…`}</span>
    </div>
    <div className="bx-strip" aria-hidden="true">{Array.from({ length: STRIP }, (_, i) => <i key={i} className={i < filled ? 'c' : i === filled && capture ? 'now' : ''} />)}</div>
    <div className="bx-current">
      <div className="bx-current-text"><strong>{job.name}</strong><small>{formatName(job.format)} · <span role="status">{t.stage[stage]}…</span></small></div>
      <div className="bx-metric" aria-label={capture ? t.bxPercent(percentage) : t.stage[stage]}>{capture ? <>{percentage}<small>%</small></> : <small className="bx-dots" />}</div>
    </div>
    <div className={`bx-bar ${capture ? '' : 'indeterminate'}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={capture ? percentage : undefined}><i style={{ width: `${capture ? percentage : 36}%` }} /></div>
    <div className="bx-cap"><span>{clock(elapsed)}</span><span>{left !== null ? t.bxLeft(clock(left)) : ''}</span></div>
  </>;
}

export function BatchQueue({ session, jobs, versions, error, now, onCancel: cancel, onPick, onClose }: {
  session: Pick<Session, 'clearQueue'>; jobs: QueueJob[]; versions: Map<string, number | null | undefined>; error: string; now: number;
  onCancel(id?: string): void; onPick(): void; onClose(): void;
}) {
  const t = useT(), plural = t.films;
  const active = jobs.filter(isActive).length, running = jobs.find(j => j.state === 'running');
  const done = jobs.filter(j => j.state === 'done').length, failed = jobs.filter(j => j.state === 'failed').length;
  const runningIndex = running ? jobs.indexOf(running) : -1;
  return <>
      <section className="bx-scene" aria-label={t.xjProgress}>
        <i className="bx-glow" aria-hidden="true" />
        {running ? <CaptureScene job={running} version={versions.get(running.dir)} index={runningIndex} count={jobs.length} now={now} />
          : active ? <><h2 className="bx-label">{t.batchExport}</h2><div className="bx-big">{t.xjStarting}</div><p className="bx-sub">{t.bxWaiting(plural(active))}</p></>
          : <><h2 className="bx-label">{t.batchExport}</h2><div className="bx-big">{done ? t.bxDone(plural(done)) : t.bxNothing}</div><p className="bx-sub">{failed ? t.bxFailed(failed) : ''}{done ? t.bxSaved : ''}</p></>}
      </section>
      <div className="bx-main">
        <header className="bx-head"><h3 id="batch-title">{t.bxQueue}</h3><button type="button" className="icon-button" aria-label={t.bxClose} title={t.close} onClick={onClose}><XIcon size={19} /></button></header>
        <div className="bx-body">
          <ul className="bx-queue">
            {jobs.map((job, i) => {
              const { capture, percentage, stage } = jobProgress(job, now);
              return <li key={job.id} className={`bx-job ${job.state}`} style={job.state === 'running' ? { '--progress': `${percentage}%` } as CSSProperties : undefined} title={job.state === 'done' ? job.output : job.state === 'failed' ? job.error : job.dir}>
                <span className={`bx-mark ${job.state}`} aria-hidden="true">{job.state === 'done' ? '✓' : job.state === 'failed' ? '!' : job.state === 'cancelled' ? '–' : job.state === 'running' ? '' : i + 1}</span>
                <Thumb dir={job.dir} version={versions.get(job.dir)} />
                <span className="bx-job-text"><span className="bx-job-name">{job.name}</span><small>{
                  job.state === 'queued' ? t.bxJobWaiting : job.state === 'running' ? capture ? t.bxFrame(job.done, job.total) : `${t.stage[stage]}…`
                  : job.state === 'done' ? job.output?.split(/[\\/]/).pop() : job.state === 'cancelled' ? t.bxJobCancelled : job.error?.replace(/\s+/g, ' ').slice(0, 120) ?? t.bxJobFailed}</small></span>
                <span className="bx-job-end">
                  {job.state === 'running' && capture ? <span className="bx-job-pct">{percentage}%</span> : job.state === 'done' ? <span className="bx-job-ok">{t.xjDone}</span> : null}
                  {isActive(job) ? <button type="button" className="bx-x" aria-label={t.bxCancelName(job.name)} title={t.cancel} onClick={() => cancel(job.id)}>✕</button> : null}
                </span>
              </li>;
            })}
          </ul>
          {!jobs.length ? <p className="hint">{t.bxEmpty}</p> : null}
          {error ? <p className="error-text" role="alert">{error}</p> : null}
          <p className="bx-note">{t.bxNote}</p>
        </div>
        <footer className="bx-foot">
          <span>{active ? t.bxToGo(plural(active)) : ''}</span>
          <div>
            {active ? <button type="button" onClick={() => cancel()}>{t.bxCancelAll}</button> : jobs.length ? <button type="button" onClick={() => { void session.clearQueue(); onPick(); }}>{t.bxClear}</button> : null}
            <button type="button" onClick={() => onPick()}>{t.bxAddFilms}</button>
            <button type="button" className="export-primary" onClick={onClose}>{active ? t.bxBackground : t.xjDone}</button>
          </div>
        </footer>
      </div>
  </>;
}
