// Batch export dialog, opened from the top bar or the export dialog: tick any of the computer's projects, choose a
// format and how to encode it, and they export one after another in the background. The queue belongs to the player,
// so closing this dialog or switching projects does not stop it; a small card in the corner follows it meanwhile.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectList } from '@mografy/core';
import { callApi } from './api.js';
import { BatchPicker } from './BatchPicker.js';
import { BatchQueue } from './BatchQueue.js';
import { isActive, useNow } from './batch-progress.js';
import { batchRequest } from './ExportQueue.js';
import type { BatchOptions } from './ExportQueue.js';
import type { Session } from './session.js';

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
  const chosen = projects.filter(p => selected.includes(p.dir));

  const submit = async () => {
    const dirs = chosen.map(p => p.dir);
    if (!dirs.length) return;
    setBusy(true); setError('');
    try { await session.enqueue(batchRequest(dirs, options)); setView('queue'); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const cancel = (id?: string) => void session.cancelQueued(id).catch(e => setError(String(e.message)));

  return <dialog ref={dialog} className={`export-dialog bx-dialog ${view}`} aria-labelledby="batch-title"
    onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}
    onClick={e => { if (e.target === e.currentTarget && !busy) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}>
    {view === 'queue'
      ? <BatchQueue session={session} jobs={jobs} versions={versions} error={error} now={now} onCancel={cancel} onPick={() => setView('pick')} onClose={onClose} />
      : <BatchPicker projects={projects} list={list} ready={ready} selected={selected} setSelected={setSelected} options={options} set={set} busy={busy} error={error} current={current} jobs={jobs} active={active} onSubmit={() => void submit()} onQueue={() => setView('queue')} onClose={onClose} />}
  </dialog>;
}

export { BatchToast } from './BatchToast.js';
