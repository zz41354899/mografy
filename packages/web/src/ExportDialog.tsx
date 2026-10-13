import { useEffect, useId, useRef, useState } from 'react';
import { BracketsCurlyIcon } from '@phosphor-icons/react/dist/csr/BracketsCurly';
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown';
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check';
import { FilmStripIcon } from '@phosphor-icons/react/dist/csr/FilmStrip';
import { StackIcon } from '@phosphor-icons/react/dist/csr/Stack';
import { XIcon } from '@phosphor-icons/react/dist/csr/X';
import { EXPORT_MAX_FPS, EXPORT_SIZES, outputFrameCount, SVGA_FRAME_RATES } from '@mografy/core';
import type { CSSProperties } from 'react';
import type { ExportFormat, ExportSize, RenderSettings, Snapshot } from '@mografy/core';
import type { Session } from './session.js';

interface ChoiceOption { value: string; label: string }
/** A styled select with keyboard navigation and a single accessible selection. */
function Choice({ label, value, options, onChange }: { label: string; value: string; options: ChoiceOption[]; onChange(value: string): void }) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [active, setActive] = useState(0);
  const selected = Math.max(0, options.findIndex(o => o.value === value));
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => { if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [open, active, id]);
  const choose = (index: number) => { onChange(options[index]!.value); setOpen(false); trigger.current?.focus(); };
  return <div className="export-choice">
    <button ref={trigger} type="button" role="combobox" aria-label={label} aria-expanded={open} aria-controls={id} aria-haspopup="listbox"
      aria-activedescendant={open ? `${id}-${active}` : undefined}
      onClick={() => { setActive(selected); setOpen(v => !v); }}
      onKeyDown={e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); setActive(a => open ? (a + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length : selected); }
        else if (open && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choose(active); }
        else if (open && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); }
        else if (open && (e.key === 'Home' || e.key === 'End')) { e.preventDefault(); setActive(e.key === 'Home' ? 0 : options.length - 1); }
        else if (e.key === 'Tab') setOpen(false);
      }}><span>{options[selected]?.label ?? value}</span><CaretDownIcon size={15} /></button>
    {open ? <div id={id} ref={menu} className="choice-menu" role="listbox" aria-label={label}>
      {options.map((o, i) => <div id={`${id}-${i}`} key={o.value} role="option" aria-selected={o.value === value} className={i === active ? 'active' : ''}
        onPointerMove={() => setActive(i)} onClick={() => choose(i)}><span>{o.label}</span>{o.value === value ? <CheckIcon size={14} /> : null}</div>)}
    </div> : null}
  </div>;
}
const FORMATS = [
  { id: 'mp4', name: 'MP4', description: 'Video', Icon: FilmStripIcon },
  { id: 'lottie', name: 'Lottie', description: 'Web animation', Icon: BracketsCurlyIcon },
  { id: 'svga', name: 'SVGA', description: 'App animation', Icon: StackIcon },
] as const;
const formatTitle = { mp4: 'MP4', lottie: 'Lottie', svga: 'SVGA' };
const choiceOptions = (values: readonly number[], suffix = '') => values.map(v => ({ value: String(v), label: `${v}${suffix}` }));

export function ExportDialog({ snapshot, session, onClose }: { snapshot: Snapshot; session: Session; onClose(): void }) {
  const meta = snapshot.scene!.meta, project = snapshot.project!;
  const dialog = useRef<HTMLDialogElement>(null);
  const [format, setFormat] = useState<ExportFormat>('mp4');
  const [sizes, setSizes] = useState<Record<ExportFormat, ExportSize>>({
    mp4: { ...EXPORT_SIZES.mp4[0], fit: 'contain' },
    lottie: { ...EXPORT_SIZES.lottie[0], fit: 'contain' },
    svga: { ...EXPORT_SIZES.svga[0], fit: 'contain' },
  });
  const [drafts, setDrafts] = useState<Record<ExportFormat, RenderSettings>>(() => {
    const raster = { ...project.render, fps: 20, samples: 1, includeAudio: false };
    return { mp4: { ...project.render, fps: Math.min(project.render.fps, EXPORT_MAX_FPS.mp4) }, lottie: { ...raster }, svga: { ...raster } };
  });
  const [qualities, setQualities] = useState<Record<ExportFormat, string>>({ mp4: 'standard', lottie: 'standard', svga: 'standard' });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const settings = drafts[format], raster = format !== 'mp4';
  const size = sizes[format], { width, height } = size;
  const differentRatio = width * meta.height !== height * meta.width;
  const frames = outputFrameCount(meta.duration, settings.fps);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const patch = (change: Partial<RenderSettings>, custom = true) => {
    setDrafts(d => ({ ...d, [format]: { ...d[format], ...change } }));
    if (custom) setQualities(q => ({ ...q, [format]: 'custom' }));
    setError('');
  };
  const quality = (value: string) => {
    setQualities(q => ({ ...q, [format]: value }));
    const change: Partial<RenderSettings> = value === 'draft' ? { samples: 1, glow: 0, grain: 0, encoding: 'crf', crf: 23, preset: 'veryfast' }
      : value === 'high' ? { samples: 8, glow: project.render.glow, grain: project.render.grain, encoding: 'crf', crf: 16, preset: 'slow' }
      : { samples: raster ? 1 : 4, glow: project.render.glow, grain: project.render.grain, encoding: 'two-pass', bitrate: project.render.bitrate, preset: 'medium' };
    patch(change, false);
  };
  const resolutions = EXPORT_SIZES[format].map(s => ({ value: `${s.width}x${s.height}`, label: `${s.width} × ${s.height} — ${s.name}` }));
  const submit = async () => {
    setBusy(true); setError('');
    try { await session.startRender({ format, size: { width, height, fit: size.fit }, render: settings }); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="export-dialog" aria-labelledby="export-title" onClose={onClose}
    onCancel={e => { if (busy) e.preventDefault(); }} onClick={e => { if (e.target === e.currentTarget && !busy) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}>
    <header className="export-header"><h2 id="export-title">Export animation</h2><button type="button" className="icon-button" aria-label="Close export" title="Close" disabled={busy} onClick={onClose}><XIcon size={19} /></button></header>
    <form onSubmit={e => { e.preventDefault(); void submit(); }}>
      <div className="export-body">
        <nav className="export-formats" aria-label="Output format">
          {FORMATS.map(({ id, name, description, Icon }) => <button key={id} type="button" aria-pressed={format === id} className={format === id ? 'selected' : ''}
            disabled={busy} onClick={() => { setFormat(id); setError(''); }}><Icon size={22} weight="regular" /><span><strong>{name}</strong><small>{description}</small></span></button>)}
        </nav>
        <div className="export-settings">
          <h3>{formatTitle[format]} settings</h3>
          <div className="export-field"><span>Resolution</span><Choice label="Resolution" value={`${width}x${height}`} options={resolutions} onChange={v => {
            const selected = EXPORT_SIZES[format].find(s => `${s.width}x${s.height}` === v)!;
            setSizes(s => ({ ...s, [format]: { width: selected.width, height: selected.height, fit: s[format].fit } })); setError('');
          }} /></div>
          {differentRatio ? <>
            <div className="export-field"><span>Fit</span><Choice label="Fit" value={size.fit} options={[{ value: 'contain', label: 'Fit entire scene' }, { value: 'cover', label: 'Fill and crop' }]} onChange={v => { setSizes(s => ({ ...s, [format]: { ...s[format], fit: v as ExportSize['fit'] } })); setError(''); }} /></div>
            <p className="export-note">{size.fit === 'contain' ? 'Keeps the entire scene centered. Extra space uses the scene background color.' : 'Fills the output and crops the edges. The scene stays centered.'}</p>
          </> : null}
          <div className="export-field"><span>Frame rate</span><Choice label="Frame rate" value={String(settings.fps)} options={choiceOptions(format === 'svga' ? SVGA_FRAME_RATES : [...new Set([12, 15, 20, 24, 25, 30, 60, settings.fps])].filter(fps => fps <= EXPORT_MAX_FPS[format]).sort((a,b) => a-b), ' fps')} onChange={v => patch({ fps: Number(v) })} /></div>
          <div className="export-field"><span>Quality</span><Choice label="Quality" value={qualities[format]} options={[{ value: 'draft', label: 'Draft' }, { value: 'standard', label: 'Standard' }, { value: 'high', label: 'High' }, ...(qualities[format] === 'custom' ? [{ value: 'custom', label: 'Custom' }] : [])]} onChange={quality} /></div>
          {raster ? <p className="export-note">Embedded image frames preserve the Canvas scene. No audio or editable vector layers. Smaller sizes keep playback lighter.</p> : null}
          <details className="export-advanced"><summary>Advanced settings</summary>
            <div className="export-field"><span>Motion samples</span><Choice label="Motion samples" value={String(settings.samples)} options={choiceOptions([1, 2, 4, 8, 16])} onChange={v => patch({ samples: Number(v) })} /></div>
            <div className="export-field"><span>Color mixing</span><Choice label="Color mixing" value={settings.mixing} options={[{ value: 'srgb', label: 'sRGB' }, { value: 'linear', label: 'Linear light' }]} onChange={v => patch({ mixing: v as RenderSettings['mixing'] })} /></div>
            <label className="export-slider"><span>Glow <output>{settings.glow.toFixed(2)}</output></span><input style={{ '--fill': `${settings.glow * 100}%` } as CSSProperties} aria-label="Glow" type="range" min={0} max={1} step={.01} value={settings.glow} onChange={e => patch({ glow: e.currentTarget.valueAsNumber })} /></label>
            <label className="export-slider"><span>Grain <output>{settings.grain.toFixed(3)}</output></span><input style={{ '--fill': `${settings.grain * 1000}%` } as CSSProperties} aria-label="Grain" type="range" min={0} max={.1} step={.001} value={settings.grain} onChange={e => patch({ grain: e.currentTarget.valueAsNumber })} /></label>
            <div className="export-field"><span>Parallel workers</span><Choice label="Parallel workers" value={String(settings.workers)} options={choiceOptions([...new Set([1, 2, 4, 8, settings.workers])].sort((a,b)=>a-b))} onChange={v => patch({ workers: Number(v) })} /></div>
            {!raster ? <>
              <div className="export-field"><span>Encoding</span><Choice label="Encoding" value={settings.encoding} options={[{ value: 'two-pass', label: 'Target bitrate · two-pass' }, { value: 'crf', label: 'Constant quality · one-pass' }]} onChange={v => patch({ encoding: v as RenderSettings['encoding'] })} /></div>
              {settings.encoding === 'two-pass' ? <div className="export-field"><label htmlFor="output-bitrate">Bitrate</label><input id="output-bitrate" type="text" required pattern="[0-9]+(\.[0-9]+)?[kM]" value={settings.bitrate} onChange={e => patch({ bitrate: e.currentTarget.value })} title="For example 12M or 8000k" /></div>
                : <label className="export-slider"><span>CRF <output>{settings.crf}</output></span><input style={{ '--fill': `${settings.crf / 51 * 100}%` } as CSSProperties} aria-label="CRF" type="range" min={0} max={51} step={1} value={settings.crf} onChange={e => patch({ crf: e.currentTarget.valueAsNumber })} /><small>Lower values keep more detail.</small></label>}
              <div className="export-field"><span>Encoder speed</span><Choice label="Encoder speed" value={settings.preset} options={['ultrafast', 'veryfast', 'fast', 'medium', 'slow'].map(v => ({ value: v, label: v === 'veryfast' ? 'Very fast' : v.charAt(0).toUpperCase()+v.slice(1) }))} onChange={v => patch({ preset: v as RenderSettings['preset'] })} /></div>
              <label className="export-audio"><span>Include audio</span><input type="checkbox" checked={!!project.audio && settings.includeAudio} disabled={!project.audio} onChange={e => patch({ includeAudio: e.currentTarget.checked })} /></label>
              {!project.audio ? <p className="hint">No audio track added.</p> : null}
            </> : null}
          </details>
          {error ? <p className="error-text" role="alert">{error}</p> : null}
        </div>
      </div>
      <footer className="export-footer"><span>{meta.duration.toFixed(meta.duration % 1 ? 2 : 0)} seconds · {frames.toLocaleString()} frames<small>{width} × {height} · {settings.fps} fps</small></span><div><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="export-primary" disabled={busy}>{busy ? 'Starting…' : `Export ${formatTitle[format]}`}</button></div></footer>
    </form>
  </dialog>;
}
