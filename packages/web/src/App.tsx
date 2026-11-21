import { useCallback, useEffect, useRef, useState, useReducer } from 'react';
import { useSession } from './session.js';
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
import { DICTS, initialLang, LangContext } from './i18n.js';
import { loadSettings, saveSettings, SettingsContext } from './settings.js';
import type { Settings } from './settings.js';
import { SettingsPanel } from './SettingsPanel.js';
import { PanelHandle, usePanelWidth } from './PanelResize.js';
import { useTimeline } from './useTimeline.js';
import type { CSSProperties } from 'react';
import { Spotlight } from './Spotlight.js';
import { readLocal, writeLocal } from './storage.js';
import { TopBar } from './TopBar.js';
import { Notices } from './Notices.js';
import { useSpotlight } from './useSpotlight.js';
import { useViewport } from './useViewport.js';
import { BatchExportDialog } from './BatchExportDialog.js';
import { BatchToast } from './BatchToast.js';

export function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings(initialLang()));
  const change = (next: Settings) => { setSettings(next); saveSettings(next); };
  useEffect(() => {
    document.documentElement.lang = settings.lang === 'zh' ? 'zh-Hant' : 'en';
    document.documentElement.style.setProperty('--text-scale', String(settings.textScale));
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
  }, [settings.lang, settings.textScale, settings.reduceMotion]);
  return <LangContext.Provider value={settings.lang}><SettingsContext.Provider value={settings}><Editor settings={settings} onSettings={change} /></SettingsContext.Provider></LangContext.Provider>;
}

function Editor({ settings, onSettings }: { settings: Settings; onSettings(next: Settings): void }) {
  const t = DICTS[settings.lang];
  const leftPanel = usePanelWidth('mografy.panel.left', 248, 180, 440), rightPanel = usePanelWidth('mografy.panel.right', 312, 260, 600);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [designRequest, setDesignRequest] = useState(0);
  const session = useSession(), { snapshot } = session;
  const projectDir = snapshot?.projectDir;
  const stage = useRef<HTMLDivElement>(null);
  const parameters = useParameters(snapshot, session);
  const scene = useScenePlayer(stage, snapshot, parameters.values, session.seek);
  const effects = useEffects(snapshot, session, scene.player);
  // Each project opens with the viewer's loop preference.
  useEffect(() => { scene.player?.setLoop(settings.loop); }, [scene.player, projectDir, settings.loop]);
  const timeline = useTimeline(snapshot, session);
  const seekTo = useCallback((time: number) => { scene.player?.pause(); scene.player?.seek(time); }, [scene.player]);
  const view = usePlayerView(scene.player, 'status');
  const [guides, setGuides] = useState(false);
  const [showProjects, setShowProjects] = useState(() => readLocal('mografy.projects') !== 'hidden');
  const toggleGuides = useCallback(() => setGuides(value => !value), []);
  const toggleProjects = useCallback(() => setShowProjects(value => !value), []);
  const viewport = useViewport(stage, snapshot?.scene?.meta.width, false, scene.player, view.playing);
  const seekBy = usePlayerShortcuts(scene.player, snapshot?.project?.audio, toggleGuides, toggleProjects, viewport, !settingsOpen);
  useEffect(() => { writeLocal('mografy.projects', showProjects ? 'shown' : 'hidden'); }, [showProjects]);
  const [exportPanel, dispatchExport] = useReducer(exportPanelReducer, INITIAL_EXPORT_PANEL);
  const exportOpen = exportPanel.mode === 'settings' || exportPanel.mode === 'job';
  useEffect(() => { dispatchExport({ type: 'reset' }); }, [projectDir]);
  const showExport = (resume: boolean) => { scene.player?.pause(); dispatchExport({ type: resume ? 'resume' : 'settings' }); };
  const [batchOpen, setBatchOpen] = useState(false);
  const showBatch = () => { scene.player?.pause(); if (exportOpen) dispatchExport({ type: 'close', keepJob: snapshot?.render?.state === 'running' }); setBatchOpen(true); };
  const playerError = view.error;
  const spot = useSpotlight({ snapshot, player: scene.player, view, timeline, showProjects, seekTo, showExport, toggleProjects, toggleGuides,
    openDesign: () => setDesignRequest(n => n + 1), openSettings: () => setSettingsOpen(true), openBatch: showBatch });

  return <div className="app">
    <TopBar session={session} view={view} showProjects={showProjects} onToggleProjects={toggleProjects} onExport={showExport} onBatch={showBatch} onSettings={() => setSettingsOpen(true)} />
    <Notices snapshot={snapshot} stopped={scene.error || playerError || ''} />

    <main className={`workspace ${showProjects ? 'with-projects' : ''}`} style={{ '--left-w': `${leftPanel.width}px`, '--right-w': `${rightPanel.width}px` } as CSSProperties}>
      {showProjects ? <PanelHandle side="left" panel={leftPanel} label={t.resizeProjects} /> : null}
      <PanelHandle side="right" panel={rightPanel} label={t.resizeInspector} />
      {showProjects ? <Projects current={projectDir} refreshKey={`${projectDir}|${snapshot?.scene?.version ?? ''}|${snapshot?.project?.name ?? ''}|${snapshot?.thumbnail ?? ''}`} /> : null}
      <Playback player={scene.player} snapshot={snapshot} stage={stage} guides={guides} onGuides={toggleGuides} viewport={viewport}
        seekBy={seekBy} toast={parameters.error || scene.message} reportPlayhead={session.reportPlayhead}
        editor={timeline} onTransitions={transitions => session.patchProject({ review: { transitions } })} />

      <Inspector snapshot={snapshot} session={session} values={parameters.values} onParam={parameters.onChange} onReset={parameters.onReset}
        effects={effects.values} previewEffects={effects.preview} playing={view.playing} sound={view.sound}
        savingEffects={effects.saving} effectsError={effects.error}
        onEffects={effects.onChange} onEffectsPreview={effects.onPreview}
        editor={timeline} player={scene.player} onSeek={seekTo} designRequest={designRequest} />
    </main>
    {settingsOpen ? <SettingsPanel settings={settings} onChange={onSettings} onClose={() => setSettingsOpen(false)} projectDir={snapshot?.projectDir} /> : null}
    {spot.open ? <Spotlight items={spot.items()} timeItem={spot.timeItem} onClose={spot.close} /> : null}
    {!exportOpen && snapshot?.render?.state === 'running' ? <ExportProgressToast key={snapshot.render.id} job={snapshot.render} session={session} onOpen={() => showExport(true)} /> : null}
    {exportPanel.mode !== 'closed' && snapshot?.scene && snapshot.project ? <ExportDialog key={`${snapshot.projectDir}:${exportPanel.generation}`} snapshot={snapshot} session={session} open={exportOpen} resume={exportPanel.mode === 'job' || exportPanel.mode === 'hidden'} onClose={keepJob => dispatchExport({ type: 'close', keepJob })} onBatch={showBatch} /> : null}
    {!batchOpen ? <BatchToast jobs={session.queue.jobs} onOpen={showBatch} /> : null}
    {batchOpen ? <BatchExportDialog session={session} current={snapshot?.builtIn ? undefined : projectDir} onClose={() => setBatchOpen(false)} /> : null}
  </div>;
}
