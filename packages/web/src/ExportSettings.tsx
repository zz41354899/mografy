import type { CSSProperties } from 'react';
import { BracketsCurlyIcon } from '@phosphor-icons/react/dist/csr/BracketsCurly';
import { FilmStripIcon } from '@phosphor-icons/react/dist/csr/FilmStrip';
import { StackIcon } from '@phosphor-icons/react/dist/csr/Stack';
import { EXPORT_MAX_FPS, isVideoFormat, EXPORT_SIZES, MP4_PORTRAIT_SIZES, mp4Preset, outputFrameCount, SVGA_FRAME_RATES } from '@mografy/core';
import type { ExportSize, RenderSettings, Snapshot } from '@mografy/core';
import { AspectRatioToggle } from './AspectRatioToggle.js';
import { ExportPreview } from './ExportPreview.js';
import { Choice } from './Choice.js';
import type { ExportQuality } from './export-draft.js';
import type { ExportDraftController } from './useExportDraft.js';
import { useT } from './i18n.js';

const FORMATS = [
  { id: 'mp4', name: 'MP4', description: 'xfVideo', Icon: FilmStripIcon },
  { id: 'webm', name: 'WebM', description: 'xfVp9', Icon: FilmStripIcon },
  { id: 'mov', name: 'MOV', description: 'xfProres', Icon: FilmStripIcon },
  { id: 'lottie', name: 'Lottie', description: 'xfWeb', Icon: BracketsCurlyIcon },
  { id: 'svga', name: 'SVGA', description: 'xfApp', Icon: StackIcon },
] as const;
const formatTitle = { mp4: 'MP4', webm: 'WebM', mov: 'MOV', lottie: 'Lottie', svga: 'SVGA' };
/** MP4 encoder presets; what each is for is in the dictionary. */
const MP4_PRESETS = ['share', 'high', 'fast'] as const;
const choiceOptions = (values: readonly number[], suffix = '') => values.map(v => ({ value: String(v), label: `${v}${suffix}` }));

export function ExportSettings({ snapshot, draft, busy, error, clearError, onSubmit, onClose }: {
  snapshot: Snapshot; draft: ExportDraftController; busy: boolean; error: string;
  clearError(): void; onSubmit(): void; onClose(): void;
}) {
  const t = useT();
  const presetsText = MP4_PRESETS.map(value => ({ value, label: t.xsPresets[value]![0], note: t.xsPresets[value]![1] }));
  const meta = snapshot.scene!.meta, project = snapshot.project!;
  const { format, settings, size } = draft, { width, height } = size;
  const raster = !isVideoFormat(format), differentRatio = width * meta.height !== height * meta.width;
  const frames = outputFrameCount(meta.duration, settings.fps);
  const presets = isVideoFormat(format) && height > width ? MP4_PORTRAIT_SIZES : EXPORT_SIZES[format];
  const resolutions = presets.map(size => ({ value: `${size.width}x${size.height}`, label: `${size.width} × ${size.height} — ${t.xsSizeNames[size.name] ?? size.name}` }));
  const patch = (settings: Partial<RenderSettings>) => { draft.patch(settings); clearError(); };
  return <form onSubmit={e => { e.preventDefault(); onSubmit(); }}>
      <div className="export-body">
        <nav className="export-formats" aria-label={t.xfOutput}>
          {FORMATS.map(({ id, name, description, Icon }) => <button key={id} type="button" aria-pressed={format === id} className={format === id ? 'selected' : ''}
            disabled={busy} onClick={() => { draft.setFormat(id); clearError(); }}><Icon size={22} weight="regular" /><span><strong>{name}</strong><small>{t[description]}</small></span></button>)}
        </nav>
        <div className="export-settings">
          <h3>{t.xsSettings(formatTitle[format])}</h3>
          {!raster ? <div className="export-field"><span>{t.xpOrientation}</span><AspectRatioToggle label={t.xpOrientationOf(formatTitle[format])} value={height > width ? '9:16' : '16:9'} disabled={busy} onChange={ratio => {
            draft.setOrientation(ratio); clearError();
          }} /></div> : null}
          <div className="export-field"><span>{t.xpResolution}</span><Choice label={t.xpResolution} value={`${width}x${height}`} options={resolutions} onChange={v => {
            const selected = presets.find(s => `${s.width}x${s.height}` === v)!;
            draft.setSize(selected); clearError();
          }} /></div>
          {!raster ? <ExportPreview snapshot={snapshot} size={size} settings={settings} label={t.pvFrame(formatTitle[format])} /> : null}
          {differentRatio ? <>
            <div className="export-field"><span>{t.xpFit}</span><Choice label={t.xpFit} value={size.fit} options={[{ value: 'contain', label: t.xsFitContain }, { value: 'cover', label: t.xsFitCover }, { value: 'reflow', label: t.xsFitReflow }]} onChange={v => { draft.setFit(v as ExportSize['fit']); clearError(); }} /></div>
            <p className="export-note">{size.fit === 'reflow' ? t.xsReflowNote : size.fit === 'contain' ? t.xsContainNote : t.xsCoverNote}</p>
          </> : null}
          <div className="export-field"><span>{t.xpRate}</span><Choice label={t.xpRate} value={String(settings.fps)} options={choiceOptions(format === 'svga' ? SVGA_FRAME_RATES : [...new Set([12, 15, 20, 24, 25, 30, 60, settings.fps])].filter(fps => fps <= EXPORT_MAX_FPS[format]).sort((a,b) => a-b), ' fps')} onChange={v => patch({ fps: Number(v) })} /></div>
          <div className="export-field"><span>{t.xpQuality}</span><Choice label={t.xpQuality} value={draft.quality} options={[{ value: 'draft', label: t.xsDraft }, { value: 'standard', label: t.xsStandard }, { value: 'high', label: t.xsHigh }, ...(draft.quality === 'custom' ? [{ value: 'custom', label: t.custom }] : [])]} onChange={v => draft.setQuality(v as ExportQuality)} /></div>
          {format === 'mp4' ? (() => {
            const preset = mp4Preset(settings), current = presetsText.find(p => p.value === preset);
            return <>
              <div className="export-field"><span>{t.xsEncoder}</span><Choice label={t.xsEncoder} value={preset ?? 'custom'} options={[...presetsText, ...(preset ? [] : [{ value: 'custom', label: settings.encoding === 'two-pass' ? t.xsTwoPass(settings.codec === 'h264' ? 'H.264' : 'H.265') : t.custom }])]}
                onChange={v => { if (v !== 'custom') { draft.setPreset(v as 'share' | 'high' | 'fast'); clearError(); } }} /></div>
              <p className="export-note">{current?.note ?? t.xsBitrateNote}</p>
            </>;
          })() : null}
          {format === 'mov' ? <p className="export-note">{t.xsMovNote}</p> : null}
          {format === 'webm' ? <p className="export-note">{t.xsWebmNote}</p> : null}
          {raster ? <p className="export-note">{t.xsRasterNote}</p> : null}
          <details className="export-advanced"><summary>{t.xpAdvanced}</summary>
            <div className="export-field"><span>{t.xpSamples}</span><Choice label={t.xpSamples} value={String(settings.samples)} options={choiceOptions([1, 2, 4, 8, 16])} onChange={v => patch({ samples: Number(v) })} /></div>
            <div className="export-field"><span>{t.xpMixing}</span><Choice label={t.xpMixing} value={settings.mixing} options={[{ value: 'srgb', label: 'sRGB' }, { value: 'linear', label: t.xpLinear }]} onChange={v => patch({ mixing: v as RenderSettings['mixing'] })} /></div>
            <label className="export-slider"><span>{t.fxGlow} <output>{settings.glow.toFixed(2)}</output></span><input style={{ '--fill': `${settings.glow * 100}%` } as CSSProperties} aria-label={t.fxGlow} type="range" min={0} max={1} step={.01} value={settings.glow} onChange={e => patch({ glow: e.currentTarget.valueAsNumber })} /></label>
            <label className="export-slider"><span>{t.fxGrain} <output>{settings.grain.toFixed(3)}</output></span><input style={{ '--fill': `${settings.grain * 1000}%` } as CSSProperties} aria-label={t.fxGrain} type="range" min={0} max={.1} step={.001} value={settings.grain} onChange={e => patch({ grain: e.currentTarget.valueAsNumber })} /></label>
            <div className="export-field"><span>{t.xpWorkers}</span><Choice label={t.xpWorkers} value={String(settings.workers)} options={[{ value: 'auto', label: t.auto }, ...choiceOptions([1, 2, 4, 6, 8])]} onChange={v => patch({ workers: v === 'auto' ? 'auto' : Number(v) })} /></div>
            {!raster ? <>
              <div className="export-field"><span>{t.xsShutter}</span><Choice label={t.xsShutter} value={String(settings.shutter)} options={[...new Set([180, 270, 360, settings.shutter])].sort((a, b) => a - b).map(v => ({ value: String(v), label: v === 360 ? t.xsLongest : v === 180 ? t.xsFilm : `${v}°` }))} onChange={v => patch({ shutter: Number(v) })} /></div>
              <label className="export-audio"><span>{t.xsDither}</span><input type="checkbox" checked={settings.dither} onChange={e => patch({ dither: e.currentTarget.checked })} /></label>
            </> : null}
            {!raster ? <>
              {format !== 'mov' ? <div className="export-field"><span>{t.xpEncoding}</span><Choice label={t.xpEncoding} value={settings.encoding} options={[{ value: 'crf', label: t.xsCrfMode }, { value: 'two-pass', label: t.xsBitrateMode }, ...(format === 'mp4' ? [{ value: 'hardware', label: t.xsHardwareMode }] : [])]} onChange={v => patch({ encoding: v as RenderSettings['encoding'] })} /></div> : null}
              {format === 'mp4' && settings.encoding === 'hardware' ? <label className="export-slider"><span>{t.xsHwQuality} <output>{settings.hardwareQuality}</output></span><input style={{ '--fill': `${settings.hardwareQuality}%` } as CSSProperties} aria-label={t.xsHwQuality} type="range" min={1} max={100} step={1} value={settings.hardwareQuality} onChange={e => patch({ hardwareQuality: e.currentTarget.valueAsNumber })} /><small>{t.xsHwHelp}</small></label> : null}
              {format === 'mov' || settings.encoding === 'hardware' ? null : settings.encoding === 'two-pass' ? <div className="export-field"><label htmlFor="output-bitrate">{t.xpBitrate}</label><input id="output-bitrate" type="text" required pattern="[0-9]+(\.[0-9]+)?[kM]" value={settings.bitrate} onChange={e => patch({ bitrate: e.currentTarget.value })} title={t.xsBitrateHint} /></div>
                : <label className="export-slider"><span>CRF <output>{settings.crf}</output></span><input style={{ '--fill': `${settings.crf / 51 * 100}%` } as CSSProperties} aria-label="CRF" type="range" min={0} max={51} step={1} value={settings.crf} onChange={e => patch({ crf: e.currentTarget.valueAsNumber })} /><small>{format === 'mp4' && settings.codec === 'h265' ? t.xsCrfH265 : t.xsCrf}</small></label>}
              {format === 'mov' || settings.encoding === 'hardware' ? null : <div className="export-field"><span>{t.xpSpeed}</span><Choice label={t.xpSpeed} value={settings.preset} options={['ultrafast', 'veryfast', 'fast', 'medium', 'slow'].map(v => ({ value: v, label: t.xsSpeeds[v]! }))} onChange={v => patch({ preset: v as RenderSettings['preset'] })} /></div>}
              <label className="export-audio"><span>{t.xsIncludeAudio}</span><input type="checkbox" checked={!!project.audio && settings.includeAudio} disabled={!project.audio} onChange={e => patch({ includeAudio: e.currentTarget.checked })} /></label>
              {!project.audio ? <p className="hint">{t.xsNoAudio}</p> : null}
            </> : null}
          </details>
          {error ? <p className="error-text" role="alert">{error}</p> : null}
        </div>
      </div>
      <footer className="export-footer"><span>{t.xsSummary(meta.duration.toFixed(meta.duration % 1 ? 2 : 0), frames.toLocaleString())}<small>{width} × {height} · {settings.fps} fps</small></span><div><button type="button" disabled={busy} onClick={onClose}>{t.cancel}</button><button type="submit" className="export-primary" disabled={busy}>{busy ? t.xjStarting : t.xsExport(formatTitle[format])}</button></div></footer>
    </form>;
}
