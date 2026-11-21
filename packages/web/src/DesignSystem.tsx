import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus';
import { XIcon } from '@phosphor-icons/react/dist/csr/X';
import { PencilSimpleIcon } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { ListChecksIcon } from '@phosphor-icons/react/dist/csr/ListChecks';
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight';
import { createSceneRuntime } from '@mografy/runtime';
import type { ParameterValues, Snapshot } from '@mografy/core';
import { useT } from './i18n.js';
import { callApi, projectHeaders } from './api.js';
import { openSceneFrame } from './scene-frame.js';
import type { Session } from './session.js';
import type { TimelineEditor } from './useTimeline.js';
import type { ScenePlayer } from './player.js';

type Swaps = Record<string, string>;
interface Shot { name: string; in: number; out: number }
interface Used { hex: string; share: number }

const HEX = /^#[0-9a-f]{6}$/;
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4) as [number, number, number];
    return .2126 * r + .7152 * g + .0722 * bl;
  };
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
const inkOn = (hex: string) => contrast(hex, '#ffffff') >= contrast(hex, '#111111') ? '#ffffff' : '#111111';
/** Mix towards white (amount > 0) or black (amount < 0). */
function shade(hex: string, amount: number) {
  const to = amount > 0 ? 255 : 0, k = Math.abs(amount);
  return '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k) + to * k).toString(16).padStart(2, '0')).join('');
}

/** The film's shots: the shot layers when the editor has them, else meta.shots, else the whole film. */
function shotsOf(snapshot: Snapshot, editor: TimelineEditor, fallback: string): Shot[] {
  const meta = snapshot.scene!.meta;
  if (editor.meta?.sequence && editor.state?.layers.length) return editor.state.layers.filter(l => !l.hidden).map(l => ({ name: l.name, in: l.in, out: l.out })).sort((a, b) => a.in - b.in);
  if (meta.shots?.length) return meta.shots.map((s, i) => ({ name: s.title ?? `Shot ${i + 1}`, in: i ? meta.shots![i - 1]!.end : 0, out: s.end }));
  return [{ name: fallback, in: 0, out: meta.duration }];
}
/** The shot under the playhead; where shots overlap, the later-starting one shows (as in the player). */
const shotAt = (shots: Shot[], t: number) => {
  let found = -1;
  shots.forEach((s, i) => { if (t >= s.in && t < s.out) found = i; });
  return found >= 0 ? found : t >= (shots.at(-1)?.out ?? 0) ? shots.length - 1 : 0;
};

/**
 * The inspector's Design tab: the shots, the colours the current one draws with (a swap changes the colour across the
 * film, saved as mografy.json `colors`), and the project's style.md as a list of rules the AI follows.
 */
export function DesignPanel({ snapshot, session, editor, player, values, onSeek }: {
  snapshot: Snapshot; session: Session; editor: TimelineEditor; player: ScenePlayer | null; values: ParameterValues; onSeek(t: number): void;
}) {
  const t = useT();
  const project = snapshot.project!, meta = snapshot.scene!.meta, version = snapshot.scene!.version;
  const shots = useMemo(() => shotsOf(snapshot, editor, t.dsWholeFilm), [snapshot, editor.state, editor.meta, t]);
  const [current, setCurrent] = useState(() => shotAt(shots, snapshot.state.playhead));
  const [palettes, setPalettes] = useState<Used[][] | null>(null);
  const [scanError, setScanError] = useState('');
  const [swaps, setSwaps] = useState<Swaps>(() => ({ ...(project.colors ?? {}) }));
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const scanBox = useRef<HTMLDivElement>(null), strip = useRef<HTMLDivElement>(null);
  const latestValues = useRef(values); latestValues.current = values;

  // Follow the playhead: the panel always shows the shot on screen.
  useEffect(() => player?.subscribe(view => setCurrent(shotAt(shots, view.t))), [player, shots]);
  useEffect(() => { strip.current?.querySelector<HTMLElement>('[aria-current=true]')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); setOpen(null); }, [current]);

  // Count the colours each shot draws, in a hidden private runtime with no swaps.
  const ranges = JSON.stringify(shots.map(s => [s.in, s.out]));
  const inputs = JSON.stringify([project.fonts, project.seed, project.aspectRatio]);
  useEffect(() => {
    let cancelled = false, dispose = () => {};
    setPalettes(null); setScanError('');
    void (async () => {
      const frame = await openSceneFrame(scanBox.current!, `/__mografy/scene/${version}.js`, 'dsp-scan');
      if (cancelled) { frame.remove(); return; }
      const usage = new Map<string, number>();
      const runtime = await createSceneRuntime(frame.canvas, frame.scene, {
        seed: project.seed, params: latestValues.current, fonts: project.fonts, aspectRatio: project.aspectRatio,
        assetBase: '/__mografy/files/', renderScale: .25, colorUsage: usage,
      });
      dispose = () => { runtime.dispose(); frame.remove(); };
      if (cancelled) { dispose(); return; }
      const background = meta.background.toLowerCase();
      const found: Used[][] = [];
      for (const shot of shots) {
        usage.clear();
        const samples = Math.max(4, Math.min(12, Math.round((shot.out - shot.in) * 2)));
        for (let i = 0; i < samples; i++) runtime.render(Math.min(meta.duration, shot.in + (i + .5) / samples * (shot.out - shot.in)), latestValues.current);
        const ranked = [...usage.entries()].filter(([hex, n]) => n >= 2 && hex !== background).sort((a, b) => b[1] - a[1]).slice(0, 9);
        // The background fills the frame; give it a fixed large share so the bar stays readable.
        const total = ranked.reduce((sum, [, n]) => sum + n, 0) || 1;
        const list: Used[] = ranked.map(([hex, n]) => ({ hex, share: n / total * .6 }));
        if (HEX.test(background)) list.unshift({ hex: background, share: .4 });
        found.push(list);
        await new Promise(r => setTimeout(r, 0));
        if (cancelled) return;
      }
      dispose(); dispose = () => {};
      setPalettes(found);
    })().catch(error => { if (!cancelled) setScanError(error instanceof Error ? error.message : String(error)); });
    return () => { cancelled = true; dispose(); };
  }, [version, inputs, ranges]);

  // The player follows the draft at once; the swap is saved after a short pause.
  useEffect(() => {
    player?.setColors(swaps);
    if (JSON.stringify(project.colors ?? {}) === JSON.stringify(swaps)) return;
    setSaving('saving');
    const timer = setTimeout(() => {
      session.patchProject({ colors: Object.keys(swaps).length ? swaps : null }).then(() => setSaving('saved'), () => setSaving('error'));
    }, 450);
    return () => clearTimeout(timer);
  }, [swaps]);
  useEffect(() => () => player?.setColors(undefined), [player]);

  const pick = (from: string, to: string) => setSwaps(s => { const next = { ...s }; if (to.toLowerCase() === from) delete next[from]; else next[from] = to.toLowerCase(); return next; });
  const unpick = (from: string) => pick(from, from);
  const index = Math.min(current, shots.length - 1), shot = shots[index]!;
  const colours = palettes?.[Math.min(index, palettes.length - 1)] ?? [];
  const filmColours = useMemo(() => [...new Set((palettes ?? []).flat().map(c => c.hex))], [palettes]);
  const changed = Object.keys(swaps).length;
  const background = meta.background.toLowerCase();

  return <div className="dsp">
    <div ref={scanBox} className="dsp-scanbox" aria-hidden="true" />

    {shots.length > 1 ? <div className="dsp-block">
      <div className="dsp-label"><span>{t.dsShots}</span><small>{index + 1} / {shots.length}</small></div>
      <div className="dsp-shots" ref={strip} role="list">
        {shots.map((s, i) => <button key={`${s.name}-${i}`} role="listitem" aria-current={i === index} className="dsp-shotchip" onClick={() => onSeek(s.in + 1e-3)} title={`${s.name} · ${s.in.toFixed(1)}–${s.out.toFixed(1)} s`}>
          <span className="dsp-shotnum">{String(i + 1).padStart(2, '0')}</span>
          <span className="dsp-shotname">{s.name}</span>
          <span className="dsp-shotdots">{(palettes?.[i] ?? []).slice(0, 4).map(c => <i key={c.hex} style={{ background: swaps[c.hex] ?? c.hex }} />)}</span>
        </button>)}
      </div>
    </div> : null}

    <div className="dsp-block">
      <div className="dsp-label">
        <span>{t.dsShotColours}</span>
        {changed ? <button className="dsp-link" onClick={() => setSwaps({})}><ArrowCounterClockwiseIcon size={12} /> {t.dsResetAll(changed)}</button> : <small>{shot.in.toFixed(1)}–{shot.out.toFixed(1)} s</small>}
      </div>
      {scanError ? <p className="error-text">{scanError}</p> : !palettes ? <div className="dsp-card dsp-loading"><div className="dsp-bar skeleton" /><p>{t.dsScanning}</p></div> :
        <div className="dsp-card">
          <div className="dsp-bar" role="list">
            {colours.map(c => <button key={c.hex} role="listitem" aria-label={c.hex} className={open === c.hex ? 'on' : ''} style={{ flexGrow: c.share, background: swaps[c.hex] ?? c.hex }} onClick={() => setOpen(o => o === c.hex ? null : c.hex)} />)}
          </div>
          <ul className="dsp-colours">
            {colours.map(c => {
              const to = swaps[c.hex], now = to ?? c.hex, isOpen = open === c.hex;
              return <li key={c.hex} className={`${isOpen ? 'open' : ''} ${to ? 'changed' : ''}`}>
                <button className="dsp-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.hex)}>
                  <span className="dsp-chip" style={{ background: now }}>{to ? <i style={{ background: c.hex }} /> : null}</span>
                  <span className="dsp-hex"><code>{now}</code>{c.hex === background ? <small>{t.dsBackground}</small> : to ? <small>{t.dsWas} {c.hex}</small> : null}</span>
                </button>
                {isOpen ? <ColourEditor from={c.hex} now={now} others={filmColours.filter(h => h !== c.hex)} onPick={hex => pick(c.hex, hex)} onReset={to ? () => unpick(c.hex) : undefined} /> : null}
              </li>;
            })}
          </ul>
          <p className="dsp-foot">{saving === 'error' ? <span className="error-text">{t.dsSaveError}</span> : saving === 'saving' ? t.dsSaving : t.dsShotColoursHelp}</p>
        </div>}
    </div>

    <StyleRules key={snapshot.projectDir} projectDir={snapshot.projectDir} />
  </div>;
}

function ColourEditor({ from, now, others, onPick, onReset }: { from: string; now: string; others: string[]; onPick(hex: string): void; onReset?: (() => void) | undefined }) {
  const t = useT();
  const [text, setText] = useState(now);
  useEffect(() => setText(now), [now]);
  const commit = (value: string) => { const v = value.trim().toLowerCase().replace(/^([0-9a-f]{6})$/, '#$1'); if (HEX.test(v)) onPick(v); else setText(now); };
  const tones = [-.45, -.25, .25, .5].map(k => shade(from, k));
  return <div className="dsp-editor">
    <div className="dsp-compare">
      <span style={{ background: from, color: inkOn(from) }}>{t.dsBefore}</span>
      <label style={{ background: now, color: inkOn(now) } as CSSProperties}>
        {t.dsAfter}
        <input type="color" value={now} onChange={e => onPick(e.currentTarget.value)} aria-label={t.dsPick} />
      </label>
    </div>
    <div className="dsp-hexrow">
      <input value={text} spellCheck={false} maxLength={7} aria-label="hex" onChange={e => setText(e.currentTarget.value)} onBlur={e => commit(e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Enter') commit(e.currentTarget.value); }} />
      {onReset ? <button className="dsp-link" onClick={onReset}><ArrowCounterClockwiseIcon size={12} /> {t.dsResetColour}</button> : null}
    </div>
    <div className="dsp-suggest">
      <small>{t.dsTones}</small>
      <div>{tones.map(h => <button key={h} style={{ background: h }} title={h} aria-label={h} onClick={() => onPick(h)} />)}</div>
    </div>
    {others.length ? <div className="dsp-suggest">
      <small>{t.dsFromFilm}</small>
      <div>{others.slice(0, 10).map(h => <button key={h} style={{ background: h }} title={h} aria-label={h} onClick={() => onPick(h)} />)}</div>
    </div> : null}
  </div>;
}

/**
 * style.md, kept out of the panel: one row shows how many rules there are, and opens a window that lists them.
 * In the window a rule is added in one line, removed with ×, or the whole file edited. Saved as soon as it changes.
 */
function StyleRules({ projectDir }: { projectDir: string }) {
  const t = useT();
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [rule, setRule] = useState('');
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    fetch('/__mografy/files/style.md', { headers: projectHeaders(projectDir), cache: 'no-store' })
      .then(r => r.ok ? r.text() : '').then(setText, () => setText(''));
  }, [projectDir]);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  const save = (next: string) => {
    setState('saving');
    return callApi('style', 'PUT', { text: next }, projectDir).then(() => { setText(next); setState('saved'); return true; }, () => { setState('error'); return false; });
  };
  const lines = (text ?? '').split('\n');
  const items = lines.map((line, i) => {
    const heading = /^#{2,6}\s+(.*)$/.exec(line), title = /^#\s/.test(line), bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    return title ? null : heading ? { kind: 'heading' as const, i, text: heading[1]! } : bullet ? { kind: 'rule' as const, i, text: bullet[1]! } : line.trim() ? { kind: 'text' as const, i, text: line.trim() } : null;
  }).filter(x => x !== null);
  const rules = items.filter(x => x.kind === 'rule');
  const add = (value: string) => {
    const v = value.trim(); if (!v) return;
    const base = (text ?? '').trimEnd();
    void save(`${base ? base : '# Style'}\n${base && !/^\s*[-*+]\s/.test(base.split('\n').at(-1)!) ? '\n' : base ? '' : '\n'}- ${v}\n`).then(ok => { if (ok) setRule(''); });
  };
  const remove = (i: number) => void save(lines.filter((_, k) => k !== i).join('\n'));
  let n = 0;

  return <>
    <button className="dsp-entry" onClick={() => setOpen(true)} disabled={text === null}>
      <span className="dsp-entry-icon"><ListChecksIcon size={18} /></span>
      <span className="dsp-entry-text"><b>{t.dsRules}</b><small>{text === null ? '…' : rules.length ? `${t.dsRuleCount(rules.length)} · style.md` : t.dsRulesNone}</small></span>
      {rules.length ? <span className="dsp-entry-peek">{rules.slice(0, 2).map(r => <i key={r.i}>{r.text}</i>)}</span> : null}
      <CaretRightIcon size={14} />
    </button>
    <dialog ref={dialog} className="export-dialog style-dialog" aria-labelledby="style-title" onClose={() => { setOpen(false); setEditing(false); }}
      onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <header className="export-header"><h2 id="style-title">{t.dsRules}</h2><span className="hint">style.md</span>
        {!editing ? <button type="button" className="link-button batch-link" onClick={() => { setDraft(text ?? ''); setEditing(true); }}><PencilSimpleIcon size={13} /> {t.dsEditAll}</button> : null}
        <button type="button" className="icon-button" aria-label={t.close} onClick={() => setOpen(false)}><XIcon size={18} /></button></header>
      <div className="style-body">
        <p className="style-intro">{t.dsStyleIntro}</p>
        {editing ? <textarea className="style-text" value={draft} spellCheck={false} autoFocus onChange={e => setDraft(e.currentTarget.value)}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); void save(draft).then(ok => ok && setEditing(false)); } }} />
        : items.length ? <ol className="style-rules">
          {items.map(item => item.kind === 'heading' ? <li key={item.i} className="style-h">{item.text}</li>
            : item.kind === 'text' ? <li key={item.i} className="style-p">{item.text}</li>
            : <li key={item.i} className="style-rule"><span className="style-n">{String(++n).padStart(2, '0')}</span><span>{item.text}</span>
                <button className="dsp-x" aria-label={`${t.dsRemoveRule}: ${item.text}`} title={t.dsRemoveRule} onClick={() => remove(item.i)}><XIcon size={13} /></button></li>)}
        </ol> : <div className="style-empty">
          <ListChecksIcon size={28} />
          <p>{t.dsRulesEmpty}</p>
          <div>{t.dsRuleIdeas.map(idea => <button key={idea} onClick={() => add(idea)}><PlusIcon size={11} /> {idea}</button>)}</div>
        </div>}
      </div>
      <footer className="export-footer">
        {editing ? <><span>{state === 'error' ? t.dsSaveError : t.dsStyleHelp}</span><div>
          <button type="button" onClick={() => setEditing(false)}>{t.cancel}</button>
          <button type="button" className="export-primary" disabled={draft === text || state === 'saving'} onClick={() => void save(draft).then(ok => ok && setEditing(false))}>{t.dsStyleSave}</button>
        </div></> : <form className="dsp-add" onSubmit={e => { e.preventDefault(); add(rule); }}>
          <PlusIcon size={14} />
          <input value={rule} placeholder={t.dsAddRule} onChange={e => setRule(e.currentTarget.value)} />
          {state === 'saving' ? <small>{t.dsSaving}</small> : state === 'error' ? <small className="error-text">{t.dsSaveError}</small> : null}
          <button type="submit" className="export-primary" disabled={!rule.trim()}>{t.dsAdd}</button>
        </form>}
      </footer>
    </dialog>
  </>;
}
