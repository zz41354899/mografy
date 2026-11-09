// Left panel: every project this computer knows about, and a way to start a new one.
// Opening a project switches this same player over to it.
import { useCallback, useEffect, useState } from 'react';
import { apiPath, callApi } from './api.js';
import type { ProjectList, ProjectSummary } from '@mografy/core';
import { useT } from './i18n.js';
import type { T } from './i18n.js';

const GROUPS: ProjectSummary['kind'][] = ['component', 'recent', 'library', 'example'];

function ago(iso: string, t: T) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return t.justNow;
  if (s < 3600) return t.minAgo(Math.floor(s / 60));
  if (s < 86400) return t.hAgo(Math.floor(s / 3600));
  return new Date(iso).toLocaleDateString();
}

export function Projects({ current, refreshKey }: { current: string | undefined; refreshKey: string }) {
  const t = useT();
  const [list, setList] = useState<ProjectList | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const refresh = useCallback(() => { void callApi<ProjectList>('projects').then(setList, e => setError(String(e.message))); }, []);
  useEffect(() => { refresh(); }, [refresh, refreshKey]);
  useEffect(() => { window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); }, [refresh]);

  const open = async (dir: string) => {
    if (dir === current || busy) return;
    setBusy(dir); setError('');
    try { await callApi('projects/open', 'POST', { dir }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };
  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy('new'); setError('');
    try { await callApi('projects/new', 'POST', { name: trimmed }); setCreating(false); setName(''); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  return <nav className="projects" aria-label={t.projects}>
    <header>
      <h2>{t.projects}</h2>
    </header>

    {creating ? <form className="new-project" onSubmit={e => { e.preventDefault(); void create(); }}>
      <input autoFocus type="text" placeholder={t.projectName} value={name} maxLength={80} onChange={e => setName(e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Escape') setCreating(false); }} aria-label={t.newProjectName} />
      <div className="row">
        <button type="submit" className="primary" disabled={!name.trim() || busy === 'new'}>{busy === 'new' ? t.creating : t.create}</button>
        <button type="button" onClick={() => setCreating(false)}>{t.cancel}</button>
      </div>
      {list ? <p className="hint">{t.savedIn(list.library)}</p> : null}
    </form> : <button className="new-button" onClick={() => setCreating(true)}>{t.newProject}</button>}

    {error ? <p className="error-text">{error}</p> : null}

    {GROUPS.map(kind => {
      const items = list?.projects.filter(p => p.kind === kind) ?? [];
      if (!items.length) return null;
      return <section key={kind}>
        <h3>{t.groups[kind]}</h3>
        <ul>
          {items.map(p => <li key={p.dir}>
            <button className={`project-item ${p.kind === 'component' ? 'component-item' : ''} ${p.dir === current ? 'current' : ''}`} onClick={() => void open(p.dir)} disabled={busy !== null && busy !== p.dir} aria-current={p.dir === current ? 'true' : undefined} title={p.dir}>
              <span className="thumb">{p.thumb ? <img src={apiPath(`projects/thumb?dir=${encodeURIComponent(p.dir)}&v=${p.thumb}`)} alt="" loading="lazy" decoding="async" /> : <i />}</span>
              <span className="project-text">
                <span className="project-name">{p.name}</span>
                <span className="project-meta">{busy === p.dir ? t.openingShort : !p.valid ? t.needsFix : p.dir === current ? t.openNow : p.kind === 'component' ? t.readyMade : ago(p.updatedAt, t)}</span>
              </span>
            </button>
          </li>)}
        </ul>
      </section>;
    })}
  </nav>;
}
