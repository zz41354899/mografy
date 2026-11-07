// Batch export dialog, opened from the top bar or the export dialog: tick any of the computer's projects, choose a
// format and how to encode it, and they export one after another in the background. The queue belongs to the player,
// so closing this dialog or switching projects does not stop it; a small card in the corner follows it meanwhile.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { XIcon } from '@phosphor-icons/react/dist/csr/X';
import { isVideoFormat } from '@mografy/core';
import type { ExportFormat, ProjectList, ProjectSummary, QueueJob } from '@mografy/core';
import { callApi } from './api.js';
import { batchRequest } from './ExportQueue.js';
import type { BatchEncoder, BatchFormat, BatchOptions } from './ExportQueue.js';
import type { Session } from './session.js';

const FORMATS: { id: BatchFormat; name: string; spec: string }[] = [
  { id: 'mp4', name: 'MP4', spec: 'H.264 · H.265' },
  { id: 'webm', name: 'WebM', spec: 'VP9' },
  { id: 'mov', name: 'MOV', spec: 'ProRes' },
  { id: 'lottie', name: 'Lottie', spec: 'Web' },
  { id: 'svga', name: 'SVGA', spec: 'App' },
];
const ENCODERS: { value: BatchEncoder; label: string }[] = [
  { value: 'project', label: 'Own' }, { value: 'share', label: 'Share · H.264' }, { value: 'high', label: 'High · H.265' }, { value: 'fast', label: 'Fast · GPU' },
];
const GROUPS: { kind: ProjectSummary['kind']; title: string }[] = [
  { kind: 'recent', title: 'Recent' },
  { kind: 'library', title: 'Projects folder' },
  { kind: 'example', title: 'Examples' },
];
const STORE = 'mografy.batchExport';
const DEFAULTS: BatchOptions = { format: 'mp4', encoder: 'project', shortSide: 1080, fps: null, samples: null, lowMemory: false, includeAudio: true };
function loadOptions(): BatchOptions {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Partial<BatchOptions>;
    // Sizes above 1080p were offered once; they fall back to the default rather than vanishing from the choices.
    if (saved.shortSide !== undefined && saved.shortSide !== null && saved.shortSide !== 720 && saved.shortSide !== 1080) delete saved.shortSide;
    return { ...DEFAULTS, ...saved };
  } catch { return DEFAULTS; }
}

const formatName = (format: ExportFormat) => FORMATS.find(f => f.id === format)?.name ?? format.toUpperCase();
const thumbUrl = (dir: string, version?: number | null) => `/__mografy/projects/thumb?dir=${encodeURIComponent(dir)}${version ? `&v=${version}` : ''}`;
const isActive = (job: QueueJob) => job.state === 'queued' || job.state === 'running';
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const plural = (n: number) => `${n} ${n === 1 ? 'film' : 'films'}`;

function Thumb({ dir, version, className = '' }: { dir: string; version?: number | null | undefined; className?: string }) {
  const [broken, setBroken] = useState(false);
  return <span className={`bx-thumb ${className}`}>{version !== null && !broken
    ? <img src={thumbUrl(dir, version)} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} /> : <i />}</span>;
}

function Seg<T extends string>({ label, value, options, disabled, onChange }: { label: string; value: T; options: { value: T; label: string }[]; disabled?: boolean | undefined; onChange(value: T): void }) {
  return <div className="bx-seg" role="radiogroup" aria-label={label}>
    {options.map(o => <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} disabled={disabled} onClick={() => onChange(o.value)}>{o.label}</button>)}
  </div>;
}

/** Progress of one running job: what the scene, the queue rows and the corner card all show. */
export function jobProgress(job: QueueJob, now: number) {
  const capture = job.state === 'running' && job.stage === 'capture' && job.total > 0;
  const percentage = capture ? Math.min(99, Math.round(job.done / job.total * 100)) : job.state === 'done' ? 100 : 0;
  const elapsed = job.startedAt ? Math.max(0, (now - Date.parse(job.startedAt)) / 1000) : 0;
  const left = capture && job.done > 0 && elapsed > 2 ? elapsed / job.done * (job.total - job.done) : null;
  const stage = job.state === 'running' ? job.stage === 'encode' ? 'Encoding' : job.stage === 'package' ? 'Packaging' : capture ? 'Capturing' : 'Starting' : '';
  return { capture, percentage, elapsed, left, stage };
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

const STRIP = 24;
/** The frame being captured, swept by a scan line, with a strip that fills as the film is captured. */
function CaptureScene({ job, version, index, count, now }: { job: QueueJob; version?: number | null | undefined; index: number; count: number; now: number }) {
  const { capture, percentage, elapsed, left, stage } = jobProgress(job, now);
  const filled = capture ? Math.floor(job.done / job.total * STRIP) : 0;
  return <>
    <h2 className="bx-label">Exporting · {index + 1} of {count}</h2>
    <div className={`bx-frame ${capture ? 'capturing' : ''}`} aria-hidden="true">
      <Thumb dir={job.dir} version={version} className="fill" />
      {capture ? <><i className="bx-grid" /><i className="bx-scan" /><i className="bx-edge" /></> : null}
      <span className="bx-fno">{capture ? `Frame ${job.done} / ${job.total}` : `${stage}…`}</span>
    </div>
    <div className="bx-strip" aria-hidden="true">{Array.from({ length: STRIP }, (_, i) => <i key={i} className={i < filled ? 'c' : i === filled && capture ? 'now' : ''} />)}</div>
    <div className="bx-current">
      <div className="bx-current-text"><strong>{job.name}</strong><small>{formatName(job.format)} · <span role="status">{stage}…</span></small></div>
      <div className="bx-metric" aria-label={capture ? `${percentage} percent` : stage}>{capture ? <>{percentage}<small>%</small></> : <small className="bx-dots" />}</div>
    </div>
    <div className={`bx-bar ${capture ? '' : 'indeterminate'}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={capture ? percentage : undefined}><i style={{ width: `${capture ? percentage : 36}%` }} /></div>
    <div className="bx-cap"><span>{clock(elapsed)}</span><span>{left !== null ? `~${clock(left)} left` : ''}</span></div>
  </>;
}

export function BatchExportDialog({ session, current, onClose }: { session: Pick<Session, 'queue' | 'enqueue' | 'cancelQueued' | 'clearQueue'>; current?: string | undefined; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [list, setList] = useState<ProjectList | null>(null);
  const [selected, setSelected] = useState<string[]>(() => current ? [current] : []);
  const [options, setOptions] = useState(loadOptions);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const jobs = session.queue.jobs, active = jobs.filter(isActive).length, running = jobs.find(j => j.state === 'running');
  // A running queue opens on its progress; otherwise on the picker.
  const [view, setView] = useState<'pick' | 'queue'>(() => active ? 'queue' : 'pick');
  const now = useNow(view === 'queue' && Boolean(running));
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(options)); } catch { /* optional */ } }, [options]);
  useEffect(() => { void callApi<ProjectList>('projects').then(setList, e => setError(String(e.message))); }, []);

  const projects = useMemo(() => list?.projects.filter(p => p.kind !== 'component') ?? [], [list]);
  const ready = projects.filter(p => p.valid);
  const versions = useMemo(() => new Map(projects.map(p => [p.dir, p.thumb])), [projects]);
  const set = (patch: Partial<BatchOptions>) => { setOptions(o => ({ ...o, ...patch })); setError(''); };
  const toggle = (dir: string) => setSelected(s => s.includes(dir) ? s.filter(d => d !== dir) : [...s, dir]);
  const all = ready.length > 0 && ready.every(p => selected.includes(p.dir));
  const video = isVideoFormat(options.format);
  const chosen = projects.filter(p => selected.includes(p.dir));
  const outputLabel = video ? `${formatName(options.format)} · ${options.shortSide ? `${options.shortSide}p` : 'own size'}` : formatName(options.format);

  const submit = async () => {
    const dirs = chosen.map(p => p.dir);
    if (!dirs.length) return;
    setBusy(true); setError('');
    try { await session.enqueue(batchRequest(dirs, options)); setView('queue'); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const cancel = (id?: string) => void session.cancelQueued(id).catch(e => setError(String(e.message)));
  const done = jobs.filter(j => j.state === 'done').length, failed = jobs.filter(j => j.state === 'failed').length;
  const runningIndex = running ? jobs.indexOf(running) : -1;

  return <dialog ref={dialog} className={`export-dialog bx-dialog ${view}`} aria-labelledby="batch-title"
    onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}
    onClick={e => { if (e.target === e.currentTarget && !busy) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}>
    {view === 'queue' ? <>
      <section className="bx-scene" aria-label="Export progress">
        <i className="bx-glow" aria-hidden="true" />
        {running ? <CaptureScene job={running} version={versions.get(running.dir)} index={runningIndex} count={jobs.length} now={now} />
          : active ? <><h2 className="bx-label">Batch export</h2><div className="bx-big">Starting…</div><p className="bx-sub">{plural(active)} waiting</p></>
          : <><h2 className="bx-label">Batch export</h2><div className="bx-big">{done ? `${plural(done)} done` : 'Nothing exported'}</div><p className="bx-sub">{failed ? `${failed} failed. ` : ''}{done ? "Saved in each project's renders folder" : ''}</p></>}
      </section>
      <div className="bx-main">
        <header className="bx-head"><h3 id="batch-title">Queue</h3><button type="button" className="icon-button" aria-label="Close batch export" title="Close" onClick={onClose}><XIcon size={19} /></button></header>
        <div className="bx-body">
          <ul className="bx-queue">
            {jobs.map((job, i) => {
              const { capture, percentage, stage } = jobProgress(job, now);
              return <li key={job.id} className={`bx-job ${job.state}`} style={job.state === 'running' ? { '--progress': `${percentage}%` } as CSSProperties : undefined} title={job.state === 'done' ? job.output : job.state === 'failed' ? job.error : job.dir}>
                <span className={`bx-mark ${job.state}`} aria-hidden="true">{job.state === 'done' ? '✓' : job.state === 'failed' ? '!' : job.state === 'cancelled' ? '–' : job.state === 'running' ? '' : i + 1}</span>
                <Thumb dir={job.dir} version={versions.get(job.dir)} />
                <span className="bx-job-text"><span className="bx-job-name">{job.name}</span><small>{
                  job.state === 'queued' ? 'Waiting' : job.state === 'running' ? capture ? `Frame ${job.done} / ${job.total}` : `${stage}…`
                  : job.state === 'done' ? job.output?.split(/[\\/]/).pop() : job.state === 'cancelled' ? 'Cancelled' : job.error?.replace(/\s+/g, ' ').slice(0, 120) ?? 'Failed'}</small></span>
                <span className="bx-job-end">
                  {job.state === 'running' && capture ? <span className="bx-job-pct">{percentage}%</span> : job.state === 'done' ? <span className="bx-job-ok">Done</span> : null}
                  {isActive(job) ? <button type="button" className="bx-x" aria-label={`Cancel ${job.name}`} title="Cancel" onClick={() => cancel(job.id)}>✕</button> : null}
                </span>
              </li>;
            })}
          </ul>
          {!jobs.length ? <p className="hint">Nothing in the queue.</p> : null}
          {error ? <p className="error-text" role="alert">{error}</p> : null}
          <p className="bx-note">You can close this and keep working.</p>
        </div>
        <footer className="bx-foot">
          <span>{active ? `${plural(active)} to go` : ''}</span>
          <div>
            {active ? <button type="button" onClick={() => cancel()}>Cancel all</button> : jobs.length ? <button type="button" onClick={() => { void session.clearQueue(); setView('pick'); }}>Clear</button> : null}
            <button type="button" onClick={() => setView('pick')}>Add films</button>
            <button type="button" className="export-primary" onClick={onClose}>{active ? 'Run in background' : 'Done'}</button>
          </div>
        </footer>
      </div>
    </> : <>
      <section className="bx-scene" aria-label="Films to export">
        <h2 className="bx-label" id="batch-title">Batch export</h2>
        <div className="bx-big">{selected.length ? plural(selected.length) : 'Choose films'}</div>
        <p className="bx-sub">{!list ? 'Loading projects…' : !projects.length ? 'No projects yet. Create one first.' : <>{ready.length} projects · <button type="button" className="bx-link" disabled={!ready.length} onClick={() => setSelected(all ? [] : ready.map(p => p.dir))}>{all ? 'Select none' : 'Select all'}</button></>}</p>
        <div className="bx-reel">
          {GROUPS.map(group => {
            const items = projects.filter(p => p.kind === group.kind);
            if (!items.length) return null;
            return <div key={group.kind} className="bx-group">
              <h4>{group.title}</h4>
              <ul>{items.map(p => {
                const ticked = selected.includes(p.dir);
                return <li key={p.dir}><label className={`bx-film ${ticked ? 'on' : ''} ${p.valid ? '' : 'invalid'}`} title={p.dir}>
                  <input type="checkbox" checked={ticked} disabled={!p.valid || busy} onChange={() => toggle(p.dir)} />
                  <Thumb dir={p.dir} version={p.thumb} />
                  <span className="bx-film-text"><span className="bx-film-name">{p.name}</span><small>{!p.valid ? 'mografy.json needs fixing' : p.dir === current ? 'Open now' : new Date(p.updatedAt).toLocaleDateString()}</small></span>
                  <span className="bx-chk" aria-hidden="true">{ticked ? '✓' : ''}</span>
                </label></li>;
              })}</ul>
            </div>;
          })}
        </div>
      </section>
      <form className="bx-main" onSubmit={e => { e.preventDefault(); void submit(); }}>
        <header className="bx-head"><h3>Format</h3>{jobs.length ? <button type="button" className="bx-link" onClick={() => setView('queue')}>Queue{active ? ` · ${active} to go` : ''}</button> : null}<button type="button" className="icon-button" aria-label="Close batch export" title="Close" disabled={busy} onClick={onClose}><XIcon size={19} /></button></header>
        <div className="bx-body">
          <div className="bx-cards" role="radiogroup" aria-label="Output format">
            {FORMATS.map(f => <button key={f.id} type="button" role="radio" aria-checked={options.format === f.id} className={`bx-card ${f.id} ${options.format === f.id ? 'on' : ''}`} disabled={busy}
              onClick={() => set({ format: f.id, ...(isVideoFormat(f.id) !== video ? { fps: null } : {}) })}><i /><span className="bx-spec">{f.spec}</span><strong>{f.name}</strong></button>)}
          </div>
          <div className="bx-rows">
            {options.format === 'mp4' ? <div className="bx-row"><span>Encoder</span><Seg label="Encoder" value={options.encoder} options={ENCODERS} disabled={busy} onChange={v => set({ encoder: v })} /></div> : null}
            {video ? <div className="bx-row"><span>Resolution</span><Seg label="Resolution" value={String(options.shortSide ?? 'project')} disabled={busy} options={[{ value: 'project', label: 'Own' }, { value: '720', label: '720p' }, { value: '1080', label: '1080p' }]} onChange={v => set({ shortSide: v === 'project' ? null : Number(v) as 720 | 1080 })} /></div> : null}
            <div className="bx-row"><span>Frame rate</span><Seg label="Frame rate" value={String(options.fps ?? 'project')} disabled={busy} options={[{ value: 'project', label: 'Own' }, ...(video ? [24, 30, 60] : [12, 15, 20, 30]).map(v => ({ value: String(v), label: String(v) }))]} onChange={v => set({ fps: v === 'project' ? null : Number(v) })} /></div>
          </div>
          <div className="bx-opts">
            <label className="bx-opt"><input type="checkbox" className="bx-switch" checked={options.lowMemory} disabled={busy} onChange={e => set({ lowMemory: e.currentTarget.checked })} /><span>Use less memory</span></label>
            {video ? <label className="bx-opt"><input type="checkbox" className="bx-switch" checked={options.includeAudio} disabled={busy} onChange={e => set({ includeAudio: e.currentTarget.checked })} /><span>Include music</span></label> : null}
            {video ? <details className="bx-adv"><summary>Advanced</summary>
              <div className="bx-row"><span>Motion samples</span><Seg label="Motion samples" value={String(options.samples ?? 'project')} disabled={busy} options={[{ value: 'project', label: 'Own' }, ...[1, 2, 4, 8].map(v => ({ value: String(v), label: String(v) }))]} onChange={v => set({ samples: v === 'project' ? null : Number(v) })} /></div>
            </details> : null}
          </div>
          <div className="bx-out">
            <div className="bx-out-head"><strong>You'll get</strong><span>{chosen.length ? `${chosen.length} ${formatName(options.format)} · saved in each project's renders folder` : ''}</span></div>
            {chosen.length ? <ul className="bx-out-list">
              {chosen.slice(0, 6).map(p => <li key={p.dir}><Thumb dir={p.dir} version={p.thumb} className="big" /><span>{p.name}</span><small>{outputLabel}</small></li>)}
              {chosen.length > 6 ? <li className="bx-out-more">+ {chosen.length - 6} more</li> : null}
            </ul> : <p className="hint">Tick films on the left.</p>}
          </div>
          {error ? <p className="error-text" role="alert">{error}</p> : null}
        </div>
        <footer className="bx-foot">
          <span>{selected.length ? `${plural(selected.length)}, one after another` : 'No films selected'}</span>
          <div><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="export-primary" disabled={busy || !selected.length}>{busy ? 'Adding…' : `Export ${selected.length ? plural(selected.length) : 'films'}`}</button></div>
        </footer>
      </form>
    </>}
  </dialog>;
}

/** Corner card that follows the queue while the dialog is closed, and lingers a moment once the last film is done. */
export function BatchToast({ jobs, onOpen }: { jobs: QueueJob[]; onOpen(): void }) {
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
  return <aside className={`bx-toast ${running ? 'running' : ''}`} aria-label="Batch export progress">
    {running && progress ? <>
      <div className="bx-toast-row">
        <div className="bx-frame mini capturing" aria-hidden="true"><Thumb dir={running.dir} className="fill" />{progress.capture ? <><i className="bx-scan" /><i className="bx-edge" /></> : null}</div>
        <div className="bx-toast-text"><strong>{running.name}</strong><small role="status">{jobs.indexOf(running) + 1} of {jobs.length} · {progress.capture ? `frame ${running.done} / ${running.total}` : `${progress.stage.toLowerCase()}…`}</small></div>
        <span className="bx-toast-pct">{progress.capture ? <>{progress.percentage}<small>%</small></> : null}</span>
      </div>
      <div className={`bx-bar ${progress.capture ? '' : 'indeterminate'}`} aria-hidden="true"><i style={{ width: `${progress.capture ? progress.percentage : 36}%` }} /></div>
    </> : <div className="bx-toast-row">
      <span className={`bx-mark ${active ? 'queued' : 'done'}`} aria-hidden="true">{active ? '' : '✓'}</span>
      <div className="bx-toast-text"><strong role="status">{active ? 'Starting…' : `${plural(done)} done`}</strong><small>{active ? `${plural(active)} waiting` : failed ? `${failed} failed` : "Saved in each project's renders folder"}</small></div>
    </div>}
    <div className="bx-toast-foot"><span>{next ? <>Next: <b>{next.name}</b></> : active ? 'Last one' : ''}</span><button type="button" className="bx-link" onClick={onOpen}>Open queue</button></div>
  </aside>;
}
