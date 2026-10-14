// Left panel: every project this computer knows about, and a way to start a new one.
// Opening a project switches this same player over to it.
import { useCallback, useEffect, useState } from 'react';
import type { ProjectList, ProjectSummary } from '@mografy/core';

const GROUPS: { kind: ProjectSummary['kind']; title: string }[] = [
  { kind: 'component', title: 'Built-in components' },
  { kind: 'recent', title: 'Recent' },
  { kind: 'library', title: 'Projects folder' },
  { kind: 'example', title: 'Examples' },
];

function ago(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/__mografy/${path}`, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message ?? `HTTP ${response.status}`);
  return data as T;
}

export function Projects({ current, refreshKey }: { current: string | undefined; refreshKey: string }) {
  const [list, setList] = useState<ProjectList | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const refresh = useCallback(() => { void call<ProjectList>('projects').then(setList, e => setError(String(e.message))); }, []);
  useEffect(() => { refresh(); }, [refresh, refreshKey]);
  useEffect(() => { window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); }, [refresh]);

  const open = async (dir: string) => {
    if (dir === current || busy) return;
    setBusy(dir); setError('');
    try { await call('projects/open', { dir }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };
  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy('new'); setError('');
    try { await call('projects/new', { name: trimmed }); setCreating(false); setName(''); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  return <nav className="projects" aria-label="Projects">
    <header>
      <h2>Projects</h2>
    </header>

    {creating ? <form className="new-project" onSubmit={e => { e.preventDefault(); void create(); }}>
      <input autoFocus type="text" placeholder="Project name" value={name} maxLength={80} onChange={e => setName(e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Escape') setCreating(false); }} aria-label="New project name" />
      <div className="row">
        <button type="submit" className="primary" disabled={!name.trim() || busy === 'new'}>{busy === 'new' ? 'Creating…' : 'Create'}</button>
        <button type="button" onClick={() => setCreating(false)}>Cancel</button>
      </div>
      {list ? <p className="hint">Saved in {list.library}</p> : null}
    </form> : <button className="new-button" onClick={() => setCreating(true)}>New project</button>}

    {error ? <p className="error-text">{error}</p> : null}

    {GROUPS.map(group => {
      const items = list?.projects.filter(p => p.kind === group.kind) ?? [];
      if (!items.length) return null;
      return <section key={group.kind}>
        <h3>{group.title}</h3>
        <ul>
          {items.map(p => <li key={p.dir}>
            <button className={`project-item ${p.kind === 'component' ? 'component-item' : ''} ${p.dir === current ? 'current' : ''}`} onClick={() => void open(p.dir)} disabled={busy !== null && busy !== p.dir} aria-current={p.dir === current ? 'true' : undefined} title={p.dir}>
              <span className="thumb">{p.thumb ? <img src={`/__mografy/projects/thumb?dir=${encodeURIComponent(p.dir)}&v=${p.thumb}`} alt="" loading="lazy" decoding="async" /> : <i />}</span>
              <span className="project-text">
                <span className="project-name">{p.name}</span>
                <span className="project-meta">{busy === p.dir ? 'Opening…' : !p.valid ? 'mografy.json needs fixing' : p.dir === current ? 'Open now' : p.kind === 'component' ? 'Ready-to-use animation' : ago(p.updatedAt)}</span>
              </span>
            </button>
          </li>)}
        </ul>
      </section>;
    })}
  </nav>;
}
