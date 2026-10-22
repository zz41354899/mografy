import { useCallback, useEffect, useRef, useState, useReducer } from 'react';
import { useSession } from './session.js';
import { LOGO_PIECES, LOGO_VIEWBOX } from './logo.js';
import { Playback } from './Playback.js';
import { Inspector } from './Inspector.js';
import { usePlayerView } from './usePlayerView.js';
import { useParameters } from './useParameters.js';
import { useEffects } from './useEffects.js';
import { useScenePlayer } from './useScenePlayer.js';
import { usePlayerShortcuts } from './usePlayerShortcuts.js';
import { Projects } from './Projects.js';
import { exportPanelReducer, INITIAL_EXPORT_PANEL } from './export-state.js';
import { ExportDialog } from './ExportDialog.js';
import { ExportProgressToast } from './ExportProgressToast.js';
import { FilmStripIcon } from '@phosphor-icons/react/dist/csr/FilmStrip';
import { ExportIcon } from '@phosphor-icons/react/dist/csr/Export';
import { PresentationIcon } from '@phosphor-icons/react/dist/csr/Presentation';
import { FilmSlateIcon } from '@phosphor-icons/react/dist/csr/FilmSlate';
import { PlayIcon } from '@phosphor-icons/react/dist/csr/Play';
import { usePresentMode } from './usePresentMode.js';
import type { EditorMode } from './usePresentMode.js';
import { SlideControls, SlideRail } from './Slides.js';

const short = (v: string | null | undefined) => v ? v.slice(0, 7) : '—';
/** The ribbon-m lockup, traced from the brand artwork. Ink pieces follow the text colour. */
function Logo() {
  return <svg className="logo" viewBox={LOGO_VIEWBOX} role="img" aria-label="Mografy">
    {LOGO_PIECES.map(p => <path key={p.name} className={p.name === 'ribbon' ? 'ribbon' : undefined} d={p.d} fill={p.name === 'ribbon' ? undefined : 'currentColor'} fillRule="evenodd" />)}
  </svg>;
}

/** Video edits and exports the film; Present builds slides on the same scene and exports a presentation file. */
function ModeSwitch({ mode, builtIn, onChange }: { mode: EditorMode; builtIn: boolean; onChange(mode: EditorMode): void }) {
  const modes = [['video', 'Video', <FilmSlateIcon key="i" size={15} />], ['present', 'Present', <PresentationIcon key="i" size={15} />]] as const;
  return <div className="segmented mode-switch" data-mode={mode} role="radiogroup" aria-label="Editor mode" onKeyDown={e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    const next = e.key === 'Home' ? 'video' : e.key === 'End' ? 'present' : mode === 'video' ? 'present' : 'video';
    onChange(next); e.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next === 'video' ? 0 : 1]?.focus();
  }}>
    {modes.map(([id, label, icon]) => <button key={id} role="radio" aria-checked={mode === id} tabIndex={mode === id ? 0 : -1} className={`${mode === id ? 'on' : ''} ${builtIn && id === 'present' ? 'unavailable' : ''}`}
      aria-disabled={builtIn && id === 'present' ? true : undefined} title={builtIn && id === 'present' ? "Built-in components can't be presented" : undefined} onClick={() => onChange(id)}>{icon}<span className="mode-label">{label}</span></button>)}
  </div>;
}

const ISSUE: Record<string, string> = { removed: 'removed from the scene', 'type-changed': 'changed type', 'out-of-range': 'out of range' };

export function App() {
  const session = useSession(), { snapshot } = session;
  const projectDir = snapshot?.projectDir;
  const stage = useRef<HTMLDivElement>(null);
  const parameters = useParameters(snapshot, session);
  const scene = useScenePlayer(stage, snapshot, parameters.values, session.seek);
  const effects = useEffects(snapshot, session, scene.player);
  const view = usePlayerView(scene.player, 'status');
  const [dismissedIssues, setDismissedIssues] = useState('');
  const [guides, setGuides] = useState(false);
  const [showProjects, setShowProjects] = useState(() => { try { return localStorage.getItem('mografy.projects') !== 'hidden'; } catch { return true; } });
  const toggleGuides = useCallback(() => setGuides(value => !value), []);
  const toggleProjects = useCallback(() => setShowProjects(value => !value), []);
  const present = usePresentMode(snapshot, session, scene.player, view.version), presenting = present.mode === 'present';
  const seekBy = usePlayerShortcuts(scene.player, snapshot?.project?.audio, toggleGuides, toggleProjects, !presenting);
  useEffect(() => { try { localStorage.setItem('mografy.projects', showProjects ? 'shown' : 'hidden'); } catch { /* optional */ } }, [showProjects]);
  const [exportPanel, dispatchExport] = useReducer(exportPanelReducer, INITIAL_EXPORT_PANEL);
  const exportOpen = exportPanel.mode === 'settings' || exportPanel.mode === 'job';
  useEffect(() => { dispatchExport({ type: 'reset' }); }, [projectDir]);
  const showExport = (resume: boolean) => { scene.player?.pause(); dispatchExport({ type: resume ? 'resume' : 'settings' }); };
  const meta = snapshot?.scene?.meta, playerError = view.error;
  const connection = { connecting: 'Connecting', connected: 'Live', offline: 'Reconnecting' }[session.connection];
  const issuesKey = JSON.stringify([projectDir, snapshot?.scene?.version, snapshot?.issues]);

  return <div className="app">
    <header className="topbar">
      <button className={`icon-button ${showProjects ? 'on' : ''}`} onClick={() => setShowProjects(v => !v)} aria-label={presenting ? showProjects ? 'Hide slides' : 'Show slides' : showProjects ? 'Hide projects' : 'Show projects'} aria-pressed={showProjects} title={presenting ? 'Slides' : 'Projects (P)'}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M9.5 4.5v15" /></svg>
      </button>
      <Logo />
      <span className="project" title={snapshot?.projectDir}>{snapshot?.project?.name ?? 'Opening project…'}</span>
      <ModeSwitch mode={present.mode} builtIn={present.builtIn} onChange={present.setMode} />
      <div className="topbar-end">
        {meta ? <span className="meta">{meta.width} × {meta.height}, {meta.fps} fps</span> : null}
        <span className="version" title={snapshot?.scene ? `Published ${new Date(snapshot.scene.publishedAt).toLocaleTimeString()} (${snapshot.scene.reason})` : ''}>{short(view.version)}</span>
        <span className={`conn ${session.connection}`} role="status"><i />{connection}</span>
        {presenting ? <>
          <button className="topbar-secondary" disabled={!snapshot?.scene} onClick={present.start} title="Present full screen: → next, ← back, P speaker view, F full screen, Esc back to the editor"><PlayIcon size={15} />Start</button>
          <button className="export-primary topbar-export presenting-export" disabled={!snapshot?.scene || present.exporting} onClick={() => void present.exportHtml()} title="Write one HTML file that presents offline, and download it"><ExportIcon size={17} />{present.exporting ? 'Exporting…' : 'Export HTML'}</button>
        </> : <>
        {snapshot?.render && snapshot.render.state !== 'running' ? <button className="last-export" aria-label="View last export" title={snapshot.render.output.split(/[\\/]/).pop()} onClick={() => showExport(true)}><FilmStripIcon size={17} /><span>{snapshot.render.state === 'done' ? 'Last export' : snapshot.render.state === 'failed' ? 'Export failed' : 'Export cancelled'}</span></button> : null}
        <button className="export-primary topbar-export" disabled={!snapshot?.scene} aria-label={snapshot?.render?.state === 'running' ? 'View active export' : 'Export'} onClick={() => showExport(snapshot?.render?.state === 'running')}><ExportIcon size={17} />{snapshot?.render?.state === 'running' ? snapshot.render.cancelling ? 'Cancelling…' : 'Exporting…' : 'Export'}</button>
        </>}
      </div>
    </header>

    {snapshot?.error ? <div className="notice error" role="alert">
      <p><strong>Your latest change didn't apply.</strong> {snapshot.scene ? 'The player is still showing the previous version.' : 'There is no working version to show yet.'} Fix the file below, or ask Claude to fix it.</p>
      <pre>{snapshot.error.message}</pre>
    </div> : null}
    {scene.error || playerError ? <div className="notice error" role="alert"><p><strong>The scene stopped while drawing.</strong></p><pre>{scene.error || playerError}</pre></div> : null}
    {snapshot?.issues.length && dismissedIssues !== issuesKey ? <div className="notice warn settings-notice" role="status"><p><strong>Scene settings updated.</strong> Incompatible saved values were cleared: {snapshot.issues.map(i => <span key={i.id} className="issue">{i.id} ({ISSUE[i.reason]})</span>)}</p><button className="text-button" onClick={() => setDismissedIssues(issuesKey)} aria-label="Dismiss settings notice">Dismiss</button></div> : null}

    {present.blocked ? <div className="notice warn" role="status"><p><strong>Built-in components can't be presented.</strong> They are ready-made references. Create your own project, or ask Claude to make one from this component, then switch to Present.</p><button className="text-button" onClick={present.dismissBlocked}>Dismiss</button></div> : null}

    <main className={`workspace ${presenting ? `presenting ${showProjects ? '' : 'rail-hidden'}` : showProjects ? 'with-projects' : ''}`}>
      {presenting && showProjects && snapshot ? <SlideRail snapshot={snapshot} slides={present.slides} selected={present.selected} hasShots={present.hasShots} onSelect={present.show} /> : null}
      {showProjects && !presenting ? <Projects current={projectDir} refreshKey={`${projectDir}|${snapshot?.scene?.version ?? ''}|${snapshot?.project?.name ?? ''}|${snapshot?.thumbnail ?? ''}`} /> : null}
      <Playback player={scene.player} snapshot={snapshot} stage={stage} guides={guides} onGuides={toggleGuides}
        seekBy={seekBy} toast={(presenting && present.error) || parameters.error || scene.message} reportPlayhead={session.reportPlayhead}
        slides={present.builtIn ? undefined : { slides: present.slides, onSelect: i => { const at = present.slides[i]?.at; if (at !== undefined) { scene.player?.pause(); scene.player?.seek(at); } } }}
        presenting={presenting}
        overlay={presenting && present.slides.length ? <SlideControls count={present.slides.length} selected={present.selected} playing={view.playing}
          muted={present.settings?.music === 'off'} hasMusic={Boolean(snapshot?.project?.audio)} onSelect={present.show} onPreview={present.preview}
          onPause={() => scene.player?.pause()} onMute={muted => present.changeDeck({ music: muted ? 'off' : 'duck' })} /> : undefined} />

      {presenting ? null :
      <Inspector snapshot={snapshot} session={session} values={parameters.values} onParam={parameters.onChange} onReset={parameters.onReset}
        effects={effects.values} previewEffects={effects.preview} playing={view.playing} sound={view.sound}
        savingEffects={effects.saving} effectsError={effects.error}
        onEffects={effects.onChange} onEffectsPreview={effects.onPreview} />}
    </main>
    {!exportOpen && snapshot?.render?.state === 'running' ? <ExportProgressToast key={snapshot.render.id} job={snapshot.render} session={session} onOpen={() => showExport(true)} /> : null}
    {exportPanel.mode !== 'closed' && snapshot?.scene && snapshot.project ? <ExportDialog key={`${snapshot.projectDir}:${exportPanel.generation}`} snapshot={snapshot} session={session} open={exportOpen} resume={exportPanel.mode === 'job' || exportPanel.mode === 'hidden'} onClose={keepJob => dispatchExport({ type: 'close', keepJob })} /> : null}
  </div>;
}
