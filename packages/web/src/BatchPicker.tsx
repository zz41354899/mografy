// The batch export picker: tick films on the left, choose how to export them on the right.
import { XIcon } from '@phosphor-icons/react/dist/csr/X';
import { isVideoFormat } from '@mografy/core';
import type { ProjectList, ProjectSummary, QueueJob } from '@mografy/core';
import { Thumb } from './BatchThumb.js';
import { FORMATS, formatName } from './batch-progress.js';
import type { BatchEncoder, BatchOptions } from './ExportQueue.js';
import { useT } from './i18n.js';

const GROUPS: ProjectSummary['kind'][] = ['recent', 'library', 'example'];

function Seg<T extends string>({ label, value, options, disabled, onChange }: { label: string; value: T; options: { value: T; label: string }[]; disabled?: boolean | undefined; onChange(value: T): void }) {
  return <div className="bx-seg" role="radiogroup" aria-label={label}>
    {options.map(o => <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} disabled={disabled} onClick={() => onChange(o.value)}>{o.label}</button>)}
  </div>;
}

export function BatchPicker({ projects, list, ready, selected, setSelected, options, set, busy, error, current, jobs, active, onSubmit, onQueue, onClose }: {
  projects: ProjectSummary[]; list: ProjectList | null; ready: ProjectSummary[]; selected: string[]; setSelected(next: string[] | ((s: string[]) => string[])): void;
  options: BatchOptions; set(patch: Partial<BatchOptions>): void; busy: boolean; error: string; current?: string | undefined; jobs: QueueJob[]; active: number;
  onSubmit(): void; onQueue(): void; onClose(): void;
}) {
  const t = useT(), plural = t.films;
  const ENCODERS: { value: BatchEncoder; label: string }[] = [
    { value: 'project', label: t.bxOwn }, { value: 'share', label: t.bxEncoderShare }, { value: 'high', label: t.bxEncoderHigh }, { value: 'fast', label: t.bxEncoderFast },
  ];
  const toggle = (dir: string) => setSelected(s => s.includes(dir) ? s.filter(d => d !== dir) : [...s, dir]);
  const all = ready.length > 0 && ready.every(p => selected.includes(p.dir));
  const video = isVideoFormat(options.format);
  const chosen = projects.filter(p => selected.includes(p.dir));
  const outputLabel = video ? `${formatName(options.format)} · ${options.shortSide ? `${options.shortSide}p` : t.bxOwnSize}` : formatName(options.format);
  return <>
      <section className="bx-scene" aria-label={t.bxPicker}>
        <h2 className="bx-label" id="batch-title">{t.batchExport}</h2>
        <div className="bx-big">{selected.length ? plural(selected.length) : t.bxChoose}</div>
        <p className="bx-sub">{!list ? t.bxLoading : !projects.length ? t.bxNoProjects : <>{t.bxProjects(ready.length)} · <button type="button" className="bx-link" disabled={!ready.length} onClick={() => setSelected(all ? [] : ready.map(p => p.dir))}>{all ? t.bxSelectNone : t.bxSelectAll}</button></>}</p>
        <div className="bx-reel">
          {GROUPS.map(kind => {
            const items = projects.filter(p => p.kind === kind);
            if (!items.length) return null;
            return <div key={kind} className="bx-group">
              <h4>{t.groups[kind]}</h4>
              <ul>{items.map(p => {
                const ticked = selected.includes(p.dir);
                return <li key={p.dir}><label className={`bx-film ${ticked ? 'on' : ''} ${p.valid ? '' : 'invalid'}`} title={p.dir}>
                  <input type="checkbox" checked={ticked} disabled={!p.valid || busy} onChange={() => toggle(p.dir)} />
                  <Thumb dir={p.dir} version={p.thumb} />
                  <span className="bx-film-text"><span className="bx-film-name">{p.name}</span><small>{!p.valid ? t.needsFix : p.dir === current ? t.openNow : new Date(p.updatedAt).toLocaleDateString()}</small></span>
                  <span className="bx-chk" aria-hidden="true">{ticked ? '✓' : ''}</span>
                </label></li>;
              })}</ul>
            </div>;
          })}
        </div>
      </section>
      <form className="bx-main" onSubmit={e => { e.preventDefault(); onSubmit(); }}>
        <header className="bx-head"><h3>{t.bxFormat}</h3>{jobs.length ? <button type="button" className="bx-link" onClick={() => onQueue()}>{t.bxQueueLink(active)}</button> : null}<button type="button" className="icon-button" aria-label={t.bxClose} title={t.close} disabled={busy} onClick={onClose}><XIcon size={19} /></button></header>
        <div className="bx-body">
          <div className="bx-cards" role="radiogroup" aria-label={t.xfOutput}>
            {FORMATS.map(f => <button key={f.id} type="button" role="radio" aria-checked={options.format === f.id} className={`bx-card ${f.id} ${options.format === f.id ? 'on' : ''}`} disabled={busy}
              onClick={() => set({ format: f.id, ...(isVideoFormat(f.id) !== video ? { fps: null } : {}) })}><i /><span className="bx-spec">{t.bxSpecs[f.spec] ?? f.spec}</span><strong>{f.name}</strong></button>)}
          </div>
          <div className="bx-rows">
            {options.format === 'mp4' ? <div className="bx-row"><span>{t.xsEncoder}</span><Seg label={t.xsEncoder} value={options.encoder} options={ENCODERS} disabled={busy} onChange={v => set({ encoder: v })} /></div> : null}
            {video ? <div className="bx-row"><span>{t.xpResolution}</span><Seg label={t.xpResolution} value={String(options.shortSide ?? 'project')} disabled={busy} options={[{ value: 'project', label: t.bxOwn }, { value: '720', label: '720p' }, { value: '1080', label: '1080p' }]} onChange={v => set({ shortSide: v === 'project' ? null : Number(v) as 720 | 1080 })} /></div> : null}
            <div className="bx-row"><span>{t.xpRate}</span><Seg label={t.xpRate} value={String(options.fps ?? 'project')} disabled={busy} options={[{ value: 'project', label: t.bxOwn }, ...(video ? [24, 30, 60] : [12, 15, 20, 30]).map(v => ({ value: String(v), label: String(v) }))]} onChange={v => set({ fps: v === 'project' ? null : Number(v) })} /></div>
          </div>
          <div className="bx-opts">
            <label className="bx-opt"><input type="checkbox" className="bx-switch" checked={options.lowMemory} disabled={busy} onChange={e => set({ lowMemory: e.currentTarget.checked })} /><span>{t.bxLowMemory}</span></label>
            {video ? <label className="bx-opt"><input type="checkbox" className="bx-switch" checked={options.includeAudio} disabled={busy} onChange={e => set({ includeAudio: e.currentTarget.checked })} /><span>{t.bxIncludeMusic}</span></label> : null}
            {video ? <details className="bx-adv"><summary>{t.bxAdvanced}</summary>
              <div className="bx-row"><span>{t.xpSamples}</span><Seg label={t.xpSamples} value={String(options.samples ?? 'project')} disabled={busy} options={[{ value: 'project', label: t.bxOwn }, ...[1, 2, 4, 8].map(v => ({ value: String(v), label: String(v) }))]} onChange={v => set({ samples: v === 'project' ? null : Number(v) })} /></div>
            </details> : null}
          </div>
          <div className="bx-out">
            <div className="bx-out-head"><strong>{t.bxYoullGet}</strong><span>{chosen.length ? t.bxOutput(chosen.length, formatName(options.format)) : ''}</span></div>
            {chosen.length ? <ul className="bx-out-list">
              {chosen.slice(0, 6).map(p => <li key={p.dir}><Thumb dir={p.dir} version={p.thumb} className="big" /><span>{p.name}</span><small>{outputLabel}</small></li>)}
              {chosen.length > 6 ? <li className="bx-out-more">{t.bxMore(chosen.length - 6)}</li> : null}
            </ul> : <p className="hint">{t.bxTick}</p>}
          </div>
          {error ? <p className="error-text" role="alert">{error}</p> : null}
        </div>
        <footer className="bx-foot">
          <span>{selected.length ? t.bxOneAfter(plural(selected.length)) : t.bxNone}</span>
          <div><button type="button" disabled={busy} onClick={onClose}>{t.cancel}</button><button type="submit" className="export-primary" disabled={busy || !selected.length}>{busy ? t.bxAdding : t.bxExportFilms(selected.length ? plural(selected.length) : null)}</button></div>
        </footer>
      </form>
  </>;
}
