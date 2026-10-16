import type { CSSProperties } from 'react';
import { BracketsCurlyIcon } from '@phosphor-icons/react/dist/csr/BracketsCurly';
import { FilmStripIcon } from '@phosphor-icons/react/dist/csr/FilmStrip';
import { StackIcon } from '@phosphor-icons/react/dist/csr/Stack';
import { EXPORT_MAX_FPS, EXPORT_SIZES, MP4_PORTRAIT_SIZES, outputFrameCount, SVGA_FRAME_RATES } from '@mografy/core';
import type { ExportSize, RenderSettings, Snapshot } from '@mografy/core';
import { AspectRatioToggle } from './AspectRatioToggle.js';
import { ExportPreview } from './ExportPreview.js';
import { Choice } from './Choice.js';
import type { ExportQuality } from './export-draft.js';
import type { ExportDraftController } from './useExportDraft.js';

const FORMATS = [
  { id: 'mp4', name: 'MP4', description: 'Video', Icon: FilmStripIcon },
  { id: 'lottie', name: 'Lottie', description: 'Web animation', Icon: BracketsCurlyIcon },
  { id: 'svga', name: 'SVGA', description: 'App animation', Icon: StackIcon },
] as const;
const formatTitle = { mp4: 'MP4', lottie: 'Lottie', svga: 'SVGA' };
const choiceOptions = (values: readonly number[], suffix = '') => values.map(v => ({ value: String(v), label: `${v}${suffix}` }));

export function ExportSettings({ snapshot, draft, busy, error, clearError, onSubmit, onClose }: {
  snapshot: Snapshot; draft: ExportDraftController; busy: boolean; error: string;
  clearError(): void; onSubmit(): void; onClose(): void;
}) {
  const meta = snapshot.scene!.meta, project = snapshot.project!;
  const { format, settings, size } = draft, { width, height } = size;
  const raster = format !== 'mp4', differentRatio = width * meta.height !== height * meta.width;
  const frames = outputFrameCount(meta.duration, settings.fps);
  const presets = format === 'mp4' && height > width ? MP4_PORTRAIT_SIZES : EXPORT_SIZES[format];
  const resolutions = presets.map(size => ({ value: `${size.width}x${size.height}`, label: `${size.width} × ${size.height} — ${size.name}` }));
  const patch = (settings: Partial<RenderSettings>) => { draft.patch(settings); clearError(); };
  return <form onSubmit={e => { e.preventDefault(); onSubmit(); }}>
      <div className="export-body">
        <nav className="export-formats" aria-label="Output format">
          {FORMATS.map(({ id, name, description, Icon }) => <button key={id} type="button" aria-pressed={format === id} className={format === id ? 'selected' : ''}
            disabled={busy} onClick={() => { draft.setFormat(id); clearError(); }}><Icon size={22} weight="regular" /><span><strong>{name}</strong><small>{description}</small></span></button>)}
        </nav>
        <div className="export-settings">
          <h3>{formatTitle[format]} settings</h3>
          {!raster ? <div className="export-field"><span>Orientation</span><AspectRatioToggle label="MP4 orientation" value={height > width ? '9:16' : '16:9'} disabled={busy} onChange={ratio => {
            draft.setOrientation(ratio); clearError();
          }} /></div> : null}
          <div className="export-field"><span>Resolution</span><Choice label="Resolution" value={`${width}x${height}`} options={resolutions} onChange={v => {
            const selected = presets.find(s => `${s.width}x${s.height}` === v)!;
            draft.setSize(selected); clearError();
          }} /></div>
          {!raster ? <ExportPreview snapshot={snapshot} size={size} settings={settings} /> : null}
          {differentRatio ? <>
            <div className="export-field"><span>Fit</span><Choice label="Fit" value={size.fit} options={[{ value: 'contain', label: 'Fit entire scene' }, { value: 'cover', label: 'Fill and crop' }, { value: 'reflow', label: 'Adapt layout' }]} onChange={v => { draft.setFit(v as ExportSize['fit']); clearError(); }} /></div>
            <p className="export-note">{size.fit === 'reflow' ? 'Rearranges responsive scenes for the output canvas. Built-in components support landscape and portrait layouts.' : size.fit === 'contain' ? 'Keeps the entire scene centered. Extra space uses the scene background color.' : 'Fills the output and crops the edges. The scene stays centered.'}</p>
          </> : null}
          <div className="export-field"><span>Frame rate</span><Choice label="Frame rate" value={String(settings.fps)} options={choiceOptions(format === 'svga' ? SVGA_FRAME_RATES : [...new Set([12, 15, 20, 24, 25, 30, 60, settings.fps])].filter(fps => fps <= EXPORT_MAX_FPS[format]).sort((a,b) => a-b), ' fps')} onChange={v => patch({ fps: Number(v) })} /></div>
          <div className="export-field"><span>Quality</span><Choice label="Quality" value={draft.quality} options={[{ value: 'draft', label: 'Draft' }, { value: 'standard', label: 'Standard' }, { value: 'high', label: 'High' }, ...(draft.quality === 'custom' ? [{ value: 'custom', label: 'Custom' }] : [])]} onChange={v => draft.setQuality(v as ExportQuality)} /></div>
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
    </form>;
}
