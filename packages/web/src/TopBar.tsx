// The top bar: projects toggle, brand, project name, scene facts, connection, batch export, export and settings.
import { ExportIcon } from '@phosphor-icons/react/dist/csr/Export';
import { FilmStripIcon } from '@phosphor-icons/react/dist/csr/FilmStrip';
import { StackIcon } from '@phosphor-icons/react/dist/csr/Stack';
import { basename } from './format.js';
import { useT } from './i18n.js';
import { LOGO_PIECES, LOGO_VIEWBOX } from './logo.js';
import type { Session } from './session.js';
import type { PlayerView } from './player.js';

const short = (v: string | null | undefined) => v ? v.slice(0, 7) : '—';
/** The ribbon-m lockup, traced from the brand artwork. Ink pieces follow the text colour. */
export function Logo() {
  return <svg className="logo" viewBox={LOGO_VIEWBOX} role="img" aria-label="Mografy">
    {LOGO_PIECES.map(p => <path key={p.name} className={p.name === 'ribbon' ? 'ribbon' : undefined} d={p.d} fill={p.name === 'ribbon' ? undefined : 'currentColor'} fillRule="evenodd" />)}
  </svg>;
}

const Gear = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>;

export function TopBar({ session, view, showProjects, onToggleProjects, onExport, onBatch, onSettings }: {
  session: Session; view: PlayerView; showProjects: boolean;
  onToggleProjects(): void; onExport(resume: boolean): void; onBatch(): void; onSettings(): void;
}) {
  const t = useT();
  const { snapshot } = session, meta = snapshot?.scene?.meta;
  const batchLeft = session.queue.jobs.filter(j => j.state === 'queued' || j.state === 'running').length;
  const connection = { connecting: t.connecting, connected: t.live, offline: t.reconnecting }[session.connection];
  return <header className="topbar">
    <button className={`icon-button ${showProjects ? 'on' : ''}`} onClick={onToggleProjects} aria-label={showProjects ? t.hideProjects : t.showProjects} aria-pressed={showProjects} title={`${t.projects} (P)`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M9.5 4.5v15" /></svg>
    </button>
    <span className="brand-lockup"><Logo /></span>
    <span className="project" title={snapshot?.projectDir}>{snapshot?.project?.name ?? t.opening}</span>
    <div className="topbar-end">
      {meta ? <span className="meta">{meta.width} × {meta.height} · {meta.fps} fps{snapshot?.project?.audio ? ` · ${snapshot.project.audio.bpm} BPM` : meta.tempo ? ` · ${meta.tempo.bpm} BPM` : ''}</span> : null}
      <span className={`conn ${session.connection}`} role="status" title={snapshot?.scene ? `${short(view.version)} · ${new Date(snapshot.scene.publishedAt).toLocaleTimeString()}` : undefined}><i />{connection}</span>
      {snapshot?.render && snapshot.render.state !== 'running' ? <button className="last-export" aria-label={t.apLastExport} title={basename(snapshot.render.output)} onClick={() => onExport(true)}><FilmStripIcon size={17} /><span>{snapshot.render.state === 'done' ? t.lastExport : snapshot.render.state === 'failed' ? t.exportFailed : t.exportCancelled}</span></button> : null}
      <button className="export-primary topbar-export" disabled={!snapshot?.scene} aria-label={snapshot?.render?.state === 'running' ? t.apActiveExport : t.export} onClick={() => onExport(snapshot?.render?.state === 'running')}><ExportIcon size={17} />{snapshot?.render?.state === 'running' ? snapshot.render.cancelling ? t.cancelling : t.exporting : t.export}</button>
      <button className={`topbar-secondary batch-button ${batchLeft ? 'busy' : ''}`} onClick={onBatch} aria-label={batchLeft ? t.batchToGoLabel(batchLeft) : t.batchExport} title={t.batchHelp}><StackIcon size={15} />{batchLeft ? t.batchToGo(batchLeft) : t.batch}</button>
      <button className="icon-button gear" aria-label={t.settings} title={t.settings} onClick={onSettings}><Gear /></button>
    </div>
  </header>;
}
