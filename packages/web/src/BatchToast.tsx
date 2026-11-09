// The corner card that follows a batch export while its dialog is closed.
import { useEffect, useRef, useState } from 'react';
import type { QueueJob } from '@mografy/core';
import { isActive, jobProgress, useNow } from './batch-progress.js';
import { Thumb } from './BatchThumb.js';
import { useT } from './i18n.js';

/** Corner card that follows the queue while the dialog is closed, and lingers a moment once the last film is done. */
export function BatchToast({ jobs, onOpen }: { jobs: QueueJob[]; onOpen(): void }) {
  const t = useT();
  const plural = t.films;
  const active = jobs.filter(isActive).length, running = jobs.find(j => j.state === 'running');
  const [finished, setFinished] = useState(false);
  const wasActive = useRef(false);
  useEffect(() => {
    if (active) { wasActive.current = true; setFinished(false); return; }
    if (!wasActive.current) return;
    wasActive.current = false; setFinished(true);
    const timer = setTimeout(() => setFinished(false), 6000);
    return () => clearTimeout(timer);
  }, [active]);
  const now = useNow(Boolean(running));
  if (!active && !finished) return null;
  const done = jobs.filter(j => j.state === 'done').length, failed = jobs.filter(j => j.state === 'failed').length;
  const next = jobs.find(j => j.state === 'queued');
  const progress = running ? jobProgress(running, now) : null;
  return <aside className={`bx-toast ${running ? 'running' : ''}`} aria-label={t.bxProgress}>
    {running && progress ? <>
      <div className="bx-toast-row">
        <div className="bx-frame mini capturing" aria-hidden="true"><Thumb dir={running.dir} className="fill" />{progress.capture ? <><i className="bx-scan" /><i className="bx-edge" /></> : null}</div>
        <div className="bx-toast-text"><strong>{running.name}</strong><small role="status">{t.bxOf(jobs.indexOf(running) + 1, jobs.length)} · {progress.capture ? t.bxFrameLc(running.done, running.total) : `${t.stage[progress.stage]?.toLowerCase() ?? ''}…`}</small></div>
        <span className="bx-toast-pct">{progress.capture ? <>{progress.percentage}<small>%</small></> : null}</span>
      </div>
      <div className={`bx-bar ${progress.capture ? '' : 'indeterminate'}`} aria-hidden="true"><i style={{ width: `${progress.capture ? progress.percentage : 36}%` }} /></div>
    </> : <div className="bx-toast-row">
      <span className={`bx-mark ${active ? 'queued' : 'done'}`} aria-hidden="true">{active ? '' : '✓'}</span>
      <div className="bx-toast-text"><strong role="status">{active ? t.xjStarting : t.bxDone(plural(done))}</strong><small>{active ? t.bxWaiting(plural(active)) : failed ? t.bxFailed(failed) : t.bxSaved}</small></div>
    </div>}
    <div className="bx-toast-foot"><span>{next ? <>{t.bxNext}<b>{next.name}</b></> : active ? t.bxLast : ''}</span><button type="button" className="bx-link" onClick={onOpen}>{t.bxOpenQueue}</button></div>
  </aside>;
}
