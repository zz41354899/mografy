import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { beatAt, beatTimes } from '@mografy/core';
import type { ParameterDefinition, ParameterValue, ParameterValues, Snapshot } from '@mografy/core';
import { ScenePlayer } from './player.js';
import type { PlayerView } from './player.js';
import { useSession } from './session.js';
import type { AudioTrack } from './audio.js';
import { LOGO_PIECES, LOGO_VIEWBOX } from './logo.js';
import { Projects } from './Projects.js';
import { ExportDialog } from './ExportDialog.js';
import { ExportProgressToast } from './ExportProgressToast.js';
import { FilmStripIcon } from '@phosphor-icons/react/dist/csr/FilmStrip';
import { ArrowsClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { FrameCornersIcon } from '@phosphor-icons/react/dist/csr/FrameCorners';
import { ExportIcon } from '@phosphor-icons/react/dist/csr/Export';
import { XIcon } from '@phosphor-icons/react/dist/csr/X';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { MusicNotesIcon } from '@phosphor-icons/react/dist/csr/MusicNotes';
import type { Session } from './session.js';

// ------------------------------------------------------------------ helpers

const ICONS = {
  play: 'M7 4.5v15l12.5-7.5z', pause: 'M7.5 5v14M16.5 5v14', prev: 'M17 5.5L9 12l8 6.5M7 5v14', next: 'M7 5.5L15 12l-8 6.5M17 5v14',
  start: 'M18 5.5L10 12l8 6.5M6 5v14', end: 'M6 5.5L14 12l-8 6.5M18 5v14',
} as const;
function Icon({ name }: { name: keyof typeof ICONS }) {
  const filled = name === 'play';
  return <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>;
}
const short = (v: string | null | undefined) => v ? v.slice(0, 7) : '—';
const pad = (n: number) => String(n).padStart(2, '0');
/** MM:SS:FF timecode at the scene's preview frame rate. */
function timecode(t: number, fps: number) {
  const frames = Math.round(t * fps), f = frames % fps, s = Math.floor(frames / fps);
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}:${pad(f)}`;
}
function useDebounced<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(fn); latest.current = fn;
  useEffect(() => () => clearTimeout(timer.current), []);
  return useCallback((...args: T) => { clearTimeout(timer.current); timer.current = setTimeout(() => latest.current(...args), ms); }, [ms]);
}
const filesUrl = (projectDir: string, file: string) => `/__mografy/files/${file.slice(projectDir.length + 1).split(/[\\/]/).map(encodeURIComponent).join('/')}`;

/** The ribbon-m lockup, traced from the brand artwork. Ink pieces follow the text colour. */
function Logo() {
  return <svg className="logo" viewBox={LOGO_VIEWBOX} role="img" aria-label="Mografy">
    {LOGO_PIECES.map(p => <path key={p.name} className={p.name === 'ribbon' ? 'ribbon' : undefined} d={p.d} fill={p.name === 'ribbon' ? undefined : 'currentColor'} fillRule="evenodd" />)}
  </svg>;
}

// ------------------------------------------------------------------ timeline

function ticks(duration: number) {
  const target = duration / 8, magnitude = 10 ** Math.floor(Math.log10(target || 1));
  const step = ([1, 2, 5, 10].find(v => v * magnitude >= target) ?? 10) * magnitude;
  return Array.from({ length: Math.floor(duration / step + 1e-9) + 1 }, (_, i) => Number((i * step).toPrecision(10)));
}

/** Music waveform, drawn from the player's decoded audio (no second download). */
function Waveform({ audio, duration, ready }: { audio: AudioTrack; duration: number; ready: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current; if (!el || !ready) return;
    const draw = () => {
      const width = el.width = Math.max(1, Math.round(el.clientWidth * devicePixelRatio)), height = el.height = Math.max(1, Math.round(el.clientHeight * devicePixelRatio));
      const peaks = audio.peaks(width, duration); if (!peaks) return;
      const c = el.getContext('2d')!;
      c.clearRect(0, 0, width, height); c.fillStyle = getComputedStyle(el).color;
      peaks.forEach((peak, x) => { const h = Math.max(1, Math.min(1, peak * 1.4) * height); c.fillRect(x, (height - h) / 2, 1, h); });
    };
    draw();
    const observer = new ResizeObserver(draw); observer.observe(el);
    return () => observer.disconnect();
  }, [audio, duration, ready]);
  return <canvas className="waveform" ref={canvas} aria-hidden="true" />;
}

function Timeline({ view, snapshot, audio, onSeek }: { view: PlayerView; snapshot: Snapshot; audio: AudioTrack | undefined; onSeek(t: number): void }) {
  const project = snapshot.project!, duration = view.duration || snapshot.scene?.meta.duration || 1;
  const area = useRef<HTMLDivElement>(null);
  const at = (clientX: number) => { const r = area.current!.getBoundingClientRect(); return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * duration; };
  const beats = useMemo(() => project.audio ? beatTimes(duration, project.audio).map(t => ({ t, bar: beatAt(t, project.audio!).beatInBar === 0 })) : [], [project.audio, duration]);
  const pct = (t: number) => `${(t / duration) * 100}%`;
  const frames = Math.round(duration * view.fps);
  return <div className="timeline">
    <div className={`track-area ${project.audio ? 'has-audio' : ''}`} ref={area} role="slider" tabIndex={0} aria-label="Timeline" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Number(view.t.toFixed(3))} aria-valuetext={`${view.t.toFixed(2)} seconds`}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); onSeek(at(e.clientX)); }}
      onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) onSeek(at(e.clientX)); }}>
      <div className="ruler">
        {frames <= 600 ? <div className="frame-ticks" style={{ backgroundSize: `${100 / frames}% 100%` }} /> : null}
        {ticks(duration).map(t => <span key={t} style={{ left: pct(t) }}>{t}s</span>)}
      </div>
      <div className="lane">
        {beats.map(b => <i key={b.t} className={b.bar ? 'beat bar' : 'beat'} style={{ left: pct(b.t) }} />)}
        {project.review.transitions.map((tr, i) => <div key={i} className="span" style={{ left: pct(tr.start), width: pct(Math.min(tr.end, duration) - tr.start) }} title={`${tr.name ?? 'Transition'}: ${tr.start}–${tr.end}s`}><span>{tr.name ?? `Transition ${i + 1}`}</span></div>)}
        {project.review.times.map(t => <i key={`r${t}`} className="review-mark" style={{ left: pct(t) }} title={`Review frame at ${t}s`} />)}
      </div>
      {project.audio ? <div className="music-lane" title={project.audio.path}>
        {audio ? <Waveform audio={audio} duration={duration} ready={view.sound !== 'loading' && view.sound !== 'none' && view.sound !== 'error'} /> : null}
        <span className="music-label">{view.sound === 'loading' ? 'Loading music…' : view.sound === 'error' ? (audio?.error || 'Music could not load') : project.audio.path.split('/').pop()}</span>
      </div> : null}
      <div className="playhead" style={{ left: pct(view.t) }}><b /></div>
    </div>
    <div className="timeline-foot">
      <span>{project.audio ? `${project.audio.bpm} BPM, ${project.audio.beatsPerBar} beats per bar` : 'Add music in the Audio panel to see beats here'}</span>
      <span className="keys"><span><kbd>Space</kbd> play</span><span><kbd>←</kbd><kbd>→</kbd> frame</span><span><kbd>⇧</kbd><kbd>←</kbd><kbd>→</kbd> {project.audio ? 'beat' : 'second'}</span><span><kbd>L</kbd> loop</span><span><kbd>G</kbd> guides</span><span><kbd>P</kbd> projects</span></span>
    </div>
  </div>;
}

// ------------------------------------------------------------------ inspector

function ParamControl({ id, def, value, saved, onChange, onReset }: { id: string; def: ParameterDefinition; value: ParameterValue; saved: boolean; onChange(v: ParameterValue): void; onReset(): void }) {
  let control: ReactNode;
  switch (def.type) {
    case 'number': control = <div className="number-control">
      <input type="range" min={def.min} max={def.max} step={def.step ?? (def.max - def.min) / 200} value={Number(value)} onChange={e => onChange(e.currentTarget.valueAsNumber)} aria-label={def.name} style={{ '--fill': `${((Number(value) - def.min) / (def.max - def.min || 1)) * 100}%` } as CSSProperties} />
      <input type="number" min={def.min} max={def.max} step={def.step ?? 'any'} value={Number(value)} onChange={e => { const n = e.currentTarget.valueAsNumber; if (Number.isFinite(n) && n >= def.min && n <= def.max) onChange(n); }} aria-label={`${def.name} value`} />
    </div>; break;
    case 'color': control = <label className="color-control"><input type="color" value={String(value)} onChange={e => onChange(e.currentTarget.value)} aria-label={def.name} /><code>{String(value)}</code></label>; break;
    case 'boolean': control = <label className="switch"><input type="checkbox" role="switch" checked={Boolean(value)} onChange={e => onChange(e.currentTarget.checked)} aria-label={def.name} /><span className="knob" /><span>{value ? 'On' : 'Off'}</span></label>; break;
    case 'enum': control = <div className="segmented" role="radiogroup" aria-label={def.name}>{def.options.map(o => <button key={o} role="radio" aria-checked={value === o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>{o}</button>)}</div>; break;
    case 'string': control = <textarea rows={2} value={String(value)} maxLength={4096} onChange={e => onChange(e.currentTarget.value)} aria-label={def.name} />; break;
  }
  return <div className={`param ${saved ? 'edited' : ''}`} data-param={id} title={id}>
    <div className="param-head"><span>{def.name}</span>{saved ? <button className="text-button" onClick={onReset} title="Back to the scene's default">Reset</button> : null}</div>
    {control}
  </div>;
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return <section className="section"><header><h2>{title}</h2>{aside}</header>{children}</section>;
}

type Effects = { glow: number; grain: number };
function EffectsPanel({ effects, preview, playing, saving, error, onChange, onPreview }: { effects: Effects; preview: boolean; playing: boolean; saving: boolean; error: string; onChange(next: Effects): void; onPreview(enabled: boolean): void }) {
  return <Section title="Image effects" aside={<button className="text-button" disabled={!effects.glow && !effects.grain} onClick={() => onChange({ glow: 0, grain: 0 })}>Clear effects</button>}>
    <div className="effects-body">
      <p className="panel-help">Applied to your exports.</p>
      {([{ id: 'glow', name: 'Glow', help: 'Light around bright edges', max: 1, step: .01 }, { id: 'grain', name: 'Grain', help: 'Film texture', max: .1, step: .001 }] as const).map(({ id, name, help, max, step }) => <div className="effect-control" key={id}>
        <div className="effect-head"><label htmlFor={`effect-${id}`}>{name}</label><div className="effect-value"><input aria-label={`${name} amount`} type="number" min={0} max={100} step={1} value={Math.round(effects[id] / max * 100)} onChange={e => { const percent = e.currentTarget.valueAsNumber; if (Number.isFinite(percent) && percent >= 0 && percent <= 100) onChange({ ...effects, [id]: Math.round(percent) / 100 * max }); }} /><span>%</span><button className="icon-button" aria-label={`Reset ${name}`} title={`Remove ${name.toLowerCase()}`} disabled={!effects[id]} onClick={() => onChange({ ...effects, [id]: 0 })}><ArrowCounterClockwiseIcon size={15} /></button></div></div>
        <input id={`effect-${id}`} aria-label={name} type="range" min={0} max={max} step={step} value={effects[id]} style={{ '--fill': `${effects[id] / max * 100}%` } as CSSProperties} onChange={e => onChange({ ...effects, [id]: e.currentTarget.valueAsNumber })} />
        <p>{help}</p>
      </div>)}
      <div className="effects-compare">
        <span className="control-label">Frame preview</span>
        <div className="segmented" role="radiogroup" aria-label="Frame preview" onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const enabled = e.key === 'Home' ? false : e.key === 'End' ? true : !preview; onPreview(enabled); e.currentTarget.querySelectorAll<HTMLButtonElement>('button')[enabled ? 1 : 0]?.focus(); } }}>
          <button role="radio" aria-checked={!preview} tabIndex={!preview ? 0 : -1} className={!preview ? 'on' : ''} onClick={() => onPreview(false)}>Original</button>
          <button role="radio" aria-checked={preview} tabIndex={preview ? 0 : -1} className={preview ? 'on' : ''} onClick={() => onPreview(true)}>With effects</button>
        </div>
        <p className="panel-help">{preview && playing ? 'Playback shows the original. Pause to see effects.' : preview ? 'Showing effects on the paused frame.' : 'Preview only. Exports use your saved effects.'}</p>
        {preview && playing ? <button className="text-button" onClick={() => onPreview(true)}>Pause to preview</button> : null}
      </div>
      {error ? <p className="error-text" role="alert">{error} <button className="text-button" onClick={() => onChange(effects)}>Retry</button></p> : null}
      <p className="effects-save" role="status">{error ? 'Not saved' : saving ? 'Saving…' : 'Saved automatically'}</p>
    </div>
  </Section>;
}

function Parameters({ snapshot, values, onChange, onReset }: { snapshot: Snapshot; values: ParameterValues; onChange(id: string, v: ParameterValue): void; onReset(id: string): void }) {
  const defs = snapshot.scene?.params ?? {}, saved = snapshot.project?.params ?? {};
  const text = Object.entries(defs).filter(([, def]) => def.type === 'string' && def.role === 'subtitle');
  const colours = Object.entries(defs).filter(([, def]) => def.type === 'color');
  const controls = Object.entries(defs).filter(([, def]) => def.type !== 'string' && def.type !== 'color');
  const fields = (entries: typeof text) => entries.map(([id, def]) => <ParamControl key={id} id={id} def={def} value={values[id] ?? def.default} saved={id in saved && values[id] !== def.default} onChange={v => onChange(id, v)} onReset={() => onReset(id)} />);
  return <>
    {text.length ? <Section title="Subtitles" aside={<span className="hint">Auto-save</span>}>
      <p className="panel-help">Ask AI to change other text.</p>
      {fields(text)}
    </Section> : null}
    {colours.length ? <Section title="Colors">{fields(colours)}</Section> : null}
    {controls.length ? <Section title="Controls">{fields(controls)}</Section> : null}
    {!text.length && !colours.length && !controls.length ? <Section title="Scene settings"><p className="empty">This scene has no adjustable settings. Ask AI to change its content.</p></Section> : null}
  </>;
}

function FrameReview({ snapshot, session }: { snapshot: Snapshot; session: Session }) {
  const [review, setReview] = useState<{ files: string[] } | null>(null);
  const [reviewing, setReviewing] = useState(false), [reviewMessage, setReviewMessage] = useState('');
  return <div className="inspector-footer">
    <details className="review-tools"><summary>Frame review</summary><p className="panel-help">Create sheets of key frames to check the animation.</p><button className="review-button" disabled={reviewing || !snapshot.scene} onClick={() => { setReviewing(true); setReviewMessage(''); session.review().then(setReview, e => setReviewMessage(String(e.message))).finally(() => setReviewing(false)); }}>{reviewing ? 'Making sheets…' : 'Create review sheets'}</button>
    {review ? <ul className="files">{review.files.map(f => <li key={f}><a href={filesUrl(snapshot.projectDir, f)} target="_blank" rel="noreferrer">{f.split(/[\\/]/).pop()}</a></li>)}</ul> : null}
    {reviewMessage ? <p className="error-text">{reviewMessage}</p> : null}</details>
  </div>;
}

// ------------------------------------------------------------------ app

const SOUND_LABEL: Record<string, string> = { loading: 'Loading music', locked: 'Turn on sound', on: 'Mute', muted: 'Unmute', error: 'Music could not load' };
const SOUND_TEXT: Record<string, string> = { loading: 'Loading', locked: 'Sound off', on: 'Sound', muted: 'Muted', error: 'No sound' };

/** Music for the project: add, replace or remove the file, and set its beat grid and volume. */
function AudioPanel({ snapshot, session, sound }: { snapshot: Snapshot; session: Session; sound: string }) {
  const audio = snapshot.project?.audio;
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [draft, setDraft] = useState(audio ?? null);
  const activePath = useRef(audio?.path);
  useEffect(() => { activePath.current = audio?.path; setDraft(audio ?? null); }, [audio]);
  const save = useDebounced((next: NonNullable<typeof audio>) => { if (next.path === activePath.current) void session.patchProject({ audio: next }).catch(e => setMessage(String(e.message))); }, 300);
  const change = (patch: Partial<NonNullable<typeof audio>>) => { if (!draft) return; const next = { ...draft, ...patch }; setDraft(next); save(next); };
  const upload = async (file: File) => {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/__mografy/assets?name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: file });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? `HTTP ${response.status}`);
      await session.patchProject({ audio: { path: data.path, bpm: audio?.bpm ?? 120, offset: audio?.offset ?? 0, beatsPerBar: audio?.beatsPerBar ?? 4, gain: audio?.gain ?? 1 } });
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  const picker = <input ref={input} type="file" accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,audio/*" hidden onChange={e => { const f = e.currentTarget.files?.[0]; if (f) void upload(f); }} />;
  const remove = async () => {
    setBusy(true); setMessage(''); activePath.current = undefined;
    try { await session.patchProject({ audio: null }); setDraft(null); }
    catch (e) { activePath.current = audio?.path; setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  if (!draft) return <Section title="Music">
    {picker}
    <div className="audio-empty"><MusicNotesIcon size={28} aria-hidden="true" /><h3>Add a soundtrack</h3><p>Music plays with your animation and MP4 exports.</p><button className="primary" onClick={() => input.current?.click()} disabled={busy}>{busy ? 'Adding…' : 'Add music'}</button></div>
    {message ? <p className="error-text" role="alert">{message}</p> : null}
  </Section>;
  return <Section title="Music" aside={<span className="hint">{sound === 'muted' ? 'Muted' : ''}</span>}>
    {picker}
    <div className="audio-file"><div className="audio-file-name"><MusicNotesIcon size={20} aria-hidden="true" /><span title={draft.path}>{draft.path.split('/').pop()}</span></div><div className="audio-file-actions"><button className="text-button" onClick={() => input.current?.click()} disabled={busy}>{busy ? 'Uploading…' : 'Replace'}</button><button className="text-button" disabled={busy} onClick={() => void remove()}>Remove</button></div></div>
    <div className="param audio-volume"><div className="param-head"><span>Volume</span><span className="hint">{Math.round(draft.gain * 100)}%</span></div>
      <input type="range" min={0} max={2} step={0.01} value={draft.gain} onChange={e => change({ gain: e.currentTarget.valueAsNumber })} aria-label="Volume" style={{ '--fill': `${(draft.gain / 2) * 100}%` } as CSSProperties} />
    </div>
    {sound === 'locked' ? <p className="panel-help">Click Play to hear your music.</p> : null}
    <details className="beat-settings"><summary>Beat sync<span className="hint">{draft.bpm} BPM</span></summary><p className="panel-help">Align the timeline beat markers to your music.</p><div className="audio-grid">
      <label>BPM<input type="number" min={20} max={400} step={0.1} value={draft.bpm} onChange={e => { const n = e.currentTarget.valueAsNumber; if (n > 0 && n <= 1000) change({ bpm: n }); }} /></label>
      <label>First beat (s)<input type="number" step={0.01} value={draft.offset} onChange={e => { const n = e.currentTarget.valueAsNumber; if (Number.isFinite(n)) change({ offset: n }); }} /></label>
      <label>Beats per bar<input type="number" min={1} max={32} step={1} value={draft.beatsPerBar} onChange={e => { const n = e.currentTarget.valueAsNumber; if (Number.isInteger(n) && n >= 1 && n <= 32) change({ beatsPerBar: n }); }} /></label>
    </div></details>
    {message ? <p className="error-text" role="alert">{message}</p> : null}
  </Section>;
}

const ISSUE: Record<string, string> = { removed: 'removed from the scene', 'type-changed': 'changed type', 'out-of-range': 'out of range' };

export function App() {
  const session = useSession();
  const { snapshot } = session;
  const stage = useRef<HTMLDivElement>(null);
  const player = useRef<ScenePlayer | null>(null);
  const [view, setView] = useState<PlayerView>({ t: 0, playing: false, loop: true, version: null, duration: 0, fps: 30, finished: false, sound: 'none' });
  const [local, setLocal] = useState<ParameterValues>({});
  const [localEffects, setLocalEffects] = useState<(Effects & { dir: string }) | null>(null);
  const [previewEffects, setPreviewEffects] = useState(false);
  const [effectsError, setEffectsError] = useState('');
  const [toast, setToast] = useState('');
  const [dismissedIssues, setDismissedIssues] = useState('');
  const [loadError, setLoadError] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMounted, setExportMounted] = useState(false);
  const [exportResume, setExportResume] = useState(false);
  const [exportGeneration, setExportGeneration] = useState(0);
  const [inspectorTab, setInspectorTab] = useState<'scene' | 'effects' | 'audio'>('scene');
  const [guides, setGuides] = useState(false);
  const [showProjects, setShowProjects] = useState(() => { try { return localStorage.getItem('mografy.projects') !== 'hidden'; } catch { return true; } });
  const started = useRef(false);
  useEffect(() => { try { localStorage.setItem('mografy.projects', showProjects ? 'shown' : 'hidden'); } catch { /* optional */ } }, [showProjects]);

  // Switching projects starts fresh: restore that project's playhead and play it.
  const projectDir = snapshot?.projectDir;
  const shownDir = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!projectDir || projectDir === shownDir.current) return;
    if (shownDir.current) { started.current = false; setLocal({}); setLocalEffects(null); setPreviewEffects(false); setEffectsError(''); setToast(''); setExportOpen(false); setExportMounted(false); }
    shownDir.current = projectDir;
  }, [projectDir]);

  useEffect(() => {
    const p = new ScenePlayer(stage.current!); player.current = p;
    const off = p.subscribe(setView);
    // Browsers allow sound only after the first click or key press on the page.
    const unlock = () => { void p.enableSound(); };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => { off(); p.dispose(); document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock); };
  }, []);

  const defaults = useMemo(() => Object.fromEntries(Object.entries(snapshot?.scene?.params ?? {}).map(([id, d]) => [id, d.default])), [snapshot?.scene?.params]);
  const values = useMemo<ParameterValues>(() => {
    const merged: ParameterValues = { ...defaults, ...(snapshot?.project?.params ?? {}) };
    for (const [id, v] of Object.entries(local)) if (id in defaults) merged[id] = v;
    return merged;
  }, [defaults, snapshot?.project?.params, local]);

  // Drop local edits once the server has them.
  useEffect(() => {
    const saved = snapshot?.project?.params ?? {};
    setLocal(l => { const next = { ...l }; let changed = false; for (const id of Object.keys(l)) if (saved[id] === l[id] || (!(id in saved) && defaults[id] === l[id]) || !(id in defaults)) { delete next[id]; changed = true; } return changed ? next : l; });
  }, [snapshot?.project?.params, defaults]);

  // A newly published version loads without losing the current time.
  const version = snapshot?.scene?.version, project = snapshot?.project;
  useEffect(() => {
    const p = player.current;
    if (!p || !version || !project) return;
    const previous = p.version;
    if (!started.current) p.seek(snapshot?.state.playhead ?? 0);
    p.load(version, project, values).then(() => {
      setLoadError('');
      if (!started.current) { started.current = true; p.play(); }
      if (previous && previous !== version) { setToast(`Updated to ${short(version)}`); setTimeout(() => setToast(''), 2600); }
    }, error => setLoadError(error instanceof Error ? error.message : String(error)));
  }, [version, project]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { player.current?.setParams(values); }, [values]);

  // Seeks requested by Claude (player_seek) or another window pause at that time.
  useEffect(() => { if (session.seek && player.current) { player.current.pause(); player.current.seek(session.seek.t); } }, [session.seek]);

  const lastReport = useRef(0);
  useEffect(() => {
    if (!view.playing || performance.now() - lastReport.current > 1000) { lastReport.current = performance.now(); session.reportPlayhead(view.t); }
  }, [view.t, view.playing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Batch edits across fields so moving quickly between words does not drop a save.
  const pendingParams = useRef<ParameterValues>({});
  useEffect(() => { pendingParams.current = {}; }, [projectDir]);
  const save = useDebounced((dir: string | undefined) => {
    if (dir !== projectDir) return;
    const params = pendingParams.current; pendingParams.current = {};
    if (Object.keys(params).length) void session.patchProject({ params }).catch(e => setToast(String(e.message)));
  }, 200);
  const onParam = (id: string, value: ParameterValue) => { setLocal(l => ({ ...l, [id]: value })); pendingParams.current[id] = value; save(projectDir); };
  const onReset = (id: string) => { delete pendingParams.current[id]; setLocal(l => ({ ...l, [id]: defaults[id]! })); void session.patchProject({ params: { [id]: null } }).catch(e => setToast(String(e.message))); };

  const effects: Effects = localEffects && localEffects.dir === projectDir ? { glow: localEffects.glow, grain: localEffects.grain } : { glow: project?.render.glow ?? 0, grain: project?.render.grain ?? 0 };
  useEffect(() => { player.current?.setEffects(effects, previewEffects); }, [effects.glow, effects.grain, previewEffects]);
  useEffect(() => {
    setLocalEffects(current => current && current.dir === projectDir && current.glow === project?.render.glow && current.grain === project?.render.grain ? null : current);
  }, [projectDir, project?.render.glow, project?.render.grain, localEffects]);
  const saveEffects = useDebounced((dir: string, next: Effects) => {
    if (dir !== projectDir) return;
    void session.patchProject({ render: next }).catch(e => { if (dir === shownDir.current) setEffectsError(`Could not save effects: ${String(e.message)}`); });
  }, 200);
  const onEffects = (next: Effects) => {
    if (!projectDir) return;
    player.current?.pause(); setPreviewEffects(true); setEffectsError('');
    setLocalEffects({ ...next, dir: projectDir }); saveEffects(projectDir, next);
  };
  const onEffectsPreview = (enabled: boolean) => { if (enabled) player.current?.pause(); setPreviewEffects(enabled); };

  const seekBy = useCallback((dir: number, coarse: boolean) => {
    const p = player.current; if (!p) return;
    if (!coarse) { p.step(dir); return; }
    const audio = snapshot?.project?.audio;
    p.pause();
    if (audio) { const b = beatAt(p.t, audio); p.seek(audio.offset + (b.beat + (dir > 0 ? 1 : b.phase > 1e-6 ? 0 : -1)) * b.period); }
    else p.seek(p.t + dir);
  }, [snapshot?.project?.audio]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.defaultPrevented || target?.closest('dialog, input, textarea, select, [contenteditable="true"]') || e.metaKey || e.ctrlKey || e.altKey) return;
      const p = player.current; if (!p) return;
      if (e.code === 'Space') { if (target?.closest('button, summary')) return; e.preventDefault(); p.toggle(); }
      else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); seekBy(e.code === 'ArrowLeft' ? -1 : 1, e.shiftKey); }
      else if (e.code === 'Home') { e.preventDefault(); p.pause(); p.seek(0); }
      else if (e.code === 'End') { e.preventDefault(); p.pause(); p.seek(Math.max(0, p.duration - 1 / p.fps)); }
      else if (e.code === 'KeyL') p.setLoop(!p.loop);
      else if (e.code === 'KeyG') setGuides(g => !g);
      else if (e.code === 'KeyP') setShowProjects(v => !v);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [seekBy]);

  const meta = snapshot?.scene?.meta;
  const p = player.current;
  const fps = view.fps, duration = view.duration;
  const playerError = p?.error;
  const connection = { connecting: 'Connecting', connected: 'Live', offline: 'Reconnecting' }[session.connection];
  const issuesKey = JSON.stringify([projectDir, snapshot?.scene?.version, snapshot?.issues]);

  const showExport = (resume: boolean) => { p?.pause(); if (!resume) setExportGeneration(v => v + 1); setExportResume(resume); setExportMounted(true); setExportOpen(true); };

  return <div className="app">
    <header className="topbar">
      <button className={`icon-button ${showProjects ? 'on' : ''}`} onClick={() => setShowProjects(v => !v)} aria-label={showProjects ? 'Hide projects' : 'Show projects'} aria-pressed={showProjects} title="Projects (P)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M9.5 4.5v15" /></svg>
      </button>
      <Logo />
      <span className="project" title={snapshot?.projectDir}>{snapshot?.project?.name ?? 'Opening project…'}</span>
      <div className="topbar-end">
        {meta ? <span className="meta">{meta.width} × {meta.height}, {meta.fps} fps</span> : null}
        <span className="version" title={snapshot?.scene ? `Published ${new Date(snapshot.scene.publishedAt).toLocaleTimeString()} (${snapshot.scene.reason})` : ''}>{short(view.version)}</span>
        <span className={`conn ${session.connection}`} role="status"><i />{connection}</span>
        {snapshot?.render && snapshot.render.state !== 'running' ? <button className="last-export" aria-label="View last export" title={snapshot.render.output.split(/[\\/]/).pop()} onClick={() => showExport(true)}><FilmStripIcon size={17} /><span>{snapshot.render.state === 'done' ? 'Last export' : snapshot.render.state === 'failed' ? 'Export failed' : 'Export cancelled'}</span></button> : null}
        <button className="export-primary topbar-export" disabled={!snapshot?.scene} aria-label={snapshot?.render?.state === 'running' ? 'View active export' : 'Export'} onClick={() => showExport(snapshot?.render?.state === 'running')}><ExportIcon size={17} />{snapshot?.render?.state === 'running' ? snapshot.render.cancelling ? 'Cancelling…' : 'Exporting…' : 'Export'}</button>
      </div>
    </header>

    {snapshot?.error ? <div className="notice error" role="alert">
      <p><strong>Your latest change didn't apply.</strong> {snapshot.scene ? 'The player is still showing the previous version.' : 'There is no working version to show yet.'} Fix the file below, or ask Claude to fix it.</p>
      <pre>{snapshot.error.message}</pre>
    </div> : null}
    {loadError || playerError ? <div className="notice error" role="alert"><p><strong>The scene stopped while drawing.</strong></p><pre>{loadError || playerError}</pre></div> : null}
    {snapshot?.issues.length && dismissedIssues !== issuesKey ? <div className="notice warn settings-notice" role="status"><p><strong>Scene settings updated.</strong> Incompatible saved values were cleared: {snapshot.issues.map(i => <span key={i.id} className="issue">{i.id} ({ISSUE[i.reason]})</span>)}</p><button className="text-button" onClick={() => setDismissedIssues(issuesKey)} aria-label="Dismiss settings notice">Dismiss</button></div> : null}

    <main className={`workspace ${showProjects ? 'with-projects' : ''}`}>
      {showProjects ? <Projects current={projectDir} refreshKey={`${projectDir}|${snapshot?.scene?.version ?? ''}|${snapshot?.project?.name ?? ''}|${snapshot?.thumbnail ?? ''}`} /> : null}
      <section className="viewer">
        <div className="surround">
          <div className={`stage ${meta && meta.height > meta.width ? 'portrait' : ''}`} ref={stage} style={{ aspectRatio: meta ? `${meta.width} / ${meta.height}` : '16 / 9', '--scene-bg': meta?.background ?? '#000', '--aspect': meta ? meta.width / meta.height : 16 / 9 } as CSSProperties} onClick={() => p?.toggle()} data-testid="stage" data-version={view.version ?? ''} data-time={view.t.toFixed(4)}>
            {guides ? <div className="guides" aria-hidden="true"><i className="action" /><i className="title" /><i className="cross" /></div> : null}
          </div>
          {toast ? <div className="toast" role="status">{toast}</div> : null}
          {!snapshot?.scene && !snapshot?.error ? <div className="placeholder">Compiling and test-rendering the scene…</div> : null}
        </div>

        <div className="transport">
          <div className="buttons">
            <button aria-label="Go to start" title="Start (Home)" onClick={() => { p?.pause(); p?.seek(0); }}><Icon name="start" /></button>
            <button aria-label="Previous frame" title="Previous frame (←)" onClick={() => seekBy(-1, false)}><Icon name="prev" /></button>
            <button className="play" aria-label={view.playing ? 'Pause' : 'Play'} title="Play or pause (Space)" onClick={() => p?.toggle()} disabled={!view.version}><Icon name={view.playing ? 'pause' : 'play'} /></button>
            <button aria-label="Next frame" title="Next frame (→)" onClick={() => seekBy(1, false)}><Icon name="next" /></button>
            <button aria-label="Go to end" title="End (End)" onClick={() => { p?.pause(); p?.seek(Math.max(0, duration - 1 / fps)); }}><Icon name="end" /></button>
          </div>
          <div className="clock" data-testid="time">
            <output className="tc" aria-label="Current time">{timecode(view.t, fps)}</output>
            <span className="tc-total">/ {timecode(duration, fps)}</span>
            <span className="seconds">{view.t.toFixed(2)} s</span>
          </div>
          <div className="toggles">
            {view.sound !== 'none' ? <button className={`sound ${view.sound}`} onClick={() => { if (view.sound === 'locked') void p?.enableSound(); else if (view.sound === 'on' || view.sound === 'muted') p?.setMuted(view.sound === 'on'); }} aria-label={SOUND_LABEL[view.sound]} title={SOUND_LABEL[view.sound]}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />{view.sound === 'on' ? <path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}</svg>
              <span>{SOUND_TEXT[view.sound]}</span>
            </button> : null}
            <button className={`transport-toggle ${view.loop ? 'on' : ''}`} aria-label="Loop" aria-pressed={view.loop} title="Loop (L)" onClick={() => p?.setLoop(!view.loop)}><ArrowsClockwiseIcon size={20} /></button>
            <button className={`transport-toggle ${guides ? 'on' : ''}`} aria-label="Guides" aria-pressed={guides} title="Show safe areas (G)" onClick={() => setGuides(g => !g)}><FrameCornersIcon size={20} /></button>
          </div>
        </div>
        {snapshot?.project ? <Timeline view={view} snapshot={snapshot} audio={p?.audio} onSeek={t => { p?.pause(); p?.seek(t); }} /> : null}
      </section>

      <aside className="inspector">
        <div className="inspector-tabs" role="tablist" aria-label="Inspector">
          {(['scene', 'effects', 'audio'] as const).map((id, index, tabs) => <button key={id} id={`${id}-tab`} role="tab" aria-selected={inspectorTab === id} aria-controls={`${id}-panel`} tabIndex={inspectorTab === id ? 0 : -1} onClick={() => setInspectorTab(id)} onKeyDown={e => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
            e.preventDefault(); const next = tabs[e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]!;
            setInspectorTab(next); document.getElementById(`${next}-tab`)?.focus();
          }}>{id === 'scene' ? 'Scene' : id === 'effects' ? 'Effects' : 'Audio'}</button>)}
        </div>
        <div className="inspector-content" id={`${inspectorTab}-panel`} role="tabpanel" aria-labelledby={`${inspectorTab}-tab`} tabIndex={0}>
          {snapshot ? inspectorTab === 'scene' ? <Parameters snapshot={snapshot} values={values} onChange={onParam} onReset={onReset} /> : inspectorTab === 'effects' ? <EffectsPanel effects={effects} preview={previewEffects} playing={view.playing} saving={!!localEffects && localEffects.dir === projectDir} error={effectsError} onChange={onEffects} onPreview={onEffectsPreview} /> : <AudioPanel key={snapshot.projectDir} snapshot={snapshot} session={session} sound={view.sound} /> : null}
        </div>
        {snapshot ? <FrameReview key={snapshot.projectDir} snapshot={snapshot} session={session} /> : null}
      </aside>
    </main>
    {!exportOpen && snapshot?.render?.state === 'running' ? <ExportProgressToast key={snapshot.render.id} job={snapshot.render} session={session} onOpen={() => showExport(true)} /> : null}
    {exportMounted && snapshot?.scene && snapshot.project ? <ExportDialog key={`${snapshot.projectDir}:${exportGeneration}`} snapshot={snapshot} session={session} open={exportOpen} resume={exportResume} onClose={keepJob => { setExportOpen(false); if (!keepJob) setExportMounted(false); }} /> : null}
  </div>;
}
