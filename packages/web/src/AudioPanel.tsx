import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Snapshot } from '@mografy/core';
import { MusicNotesIcon } from '@phosphor-icons/react/dist/csr/MusicNotes';
import type { Session } from './session.js';
import { apiPath, projectHeaders, readApiResponse } from './api.js';
import { useDebounced } from './useDebounced.js';
import { Section } from './InspectorSection.js';
import { useT } from './i18n.js';

/** Music for the project: add, replace or remove the file, and set its beat grid and volume. */
export function AudioPanel({ snapshot, session, sound }: { snapshot: Snapshot; session: Session; sound: string }) {
  const t = useT();
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
      const response = await fetch(apiPath(`assets?name=${encodeURIComponent(file.name)}`), { method: 'POST', headers: { 'content-type': 'application/octet-stream', ...projectHeaders(snapshot.projectDir) }, body: file });
      const data = await readApiResponse<{ path: string }>(response);
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
  if (!draft) return <Section title={t.auMusic}>
    {picker}
    <div className="audio-empty"><MusicNotesIcon size={28} aria-hidden="true" /><h3>{t.auAddTitle}</h3><p>{t.auAddHelp}</p><button className="primary" onClick={() => input.current?.click()} disabled={busy}>{busy ? t.auAdding : t.auAdd}</button></div>
    {message ? <p className="error-text" role="alert">{message}</p> : null}
  </Section>;
  return <Section title={t.auMusic} aside={<span className="hint">{sound === 'muted' ? t.auMuted : ''}</span>}>
    {picker}
    <div className="audio-file"><div className="audio-file-name"><MusicNotesIcon size={20} aria-hidden="true" /><span title={draft.path}>{draft.path.split('/').pop()}</span></div><div className="audio-file-actions"><button className="text-button" onClick={() => input.current?.click()} disabled={busy}>{busy ? t.auUploading : t.auReplace}</button><button className="text-button" disabled={busy} onClick={() => void remove()}>{t.auRemove}</button></div></div>
    <div className="param audio-volume"><div className="param-head"><span>{t.auVolume}</span><span className="hint">{Math.round(draft.gain * 100)}%</span></div>
      <input type="range" min={0} max={2} step={0.01} value={draft.gain} onChange={e => change({ gain: e.currentTarget.valueAsNumber })} aria-label={t.auVolume} style={{ '--fill': `${(draft.gain / 2) * 100}%` } as CSSProperties} />
    </div>
    {sound === 'locked' ? <p className="panel-help">{t.auLocked}</p> : null}
    <details className="beat-settings"><summary>{t.auBeat}<span className="hint">{draft.bpm} BPM</span></summary><p className="panel-help">{t.auBeatHelp}</p><div className="audio-grid">
      <label>BPM<input type="number" min={20} max={400} step={0.1} value={draft.bpm} onChange={e => { const n = e.currentTarget.valueAsNumber; if (n > 0 && n <= 1000) change({ bpm: n }); }} /></label>
      <label>{t.auFirstBeat}<input type="number" step={0.01} value={draft.offset} onChange={e => { const n = e.currentTarget.valueAsNumber; if (Number.isFinite(n)) change({ offset: n }); }} /></label>
      <label>{t.auPerBar}<input type="number" min={1} max={32} step={1} value={draft.beatsPerBar} onChange={e => { const n = e.currentTarget.valueAsNumber; if (Number.isInteger(n) && n >= 1 && n <= 32) change({ beatsPerBar: n }); }} /></label>
    </div></details>
    {message ? <p className="error-text" role="alert">{message}</p> : null}
  </Section>;
}

