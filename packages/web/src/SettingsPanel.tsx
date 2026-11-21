import { useState } from 'react';
import type { ComponentType } from 'react';
import { useEscape } from './shortcuts.js';
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check';
import { CopyIcon } from '@phosphor-icons/react/dist/csr/Copy';
import { GlobeIcon } from '@phosphor-icons/react/dist/csr/Globe';
import { PlugsConnectedIcon } from '@phosphor-icons/react/dist/csr/PlugsConnected';
import { SlidersHorizontalIcon } from '@phosphor-icons/react/dist/csr/SlidersHorizontal';
import { TextAaIcon } from '@phosphor-icons/react/dist/csr/TextAa';
import { PlayCircleIcon } from '@phosphor-icons/react/dist/csr/PlayCircle';
import { KeyboardIcon } from '@phosphor-icons/react/dist/csr/Keyboard';
import { InfoIcon } from '@phosphor-icons/react/dist/csr/Info';
import { XIcon } from '@phosphor-icons/react/dist/csr/X';
import { useT } from './i18n.js';
import type { Settings } from './settings.js';
import { DEFAULT_SETTINGS, TEXT_SCALES } from './settings.js';
import { readLocal, writeLocal } from './storage.js';
import { mcpCommands, mcpSetupPrompt } from './mcp-prompt.js';
import type { McpTarget } from './mcp-prompt.js';

type Section = 'language' | 'general' | 'playback' | 'text' | 'keys' | 'mcp' | 'about';
/** Per-browser layout the editor remembers outside the settings: panel widths, timeline height, folds. */
const LAYOUT_KEYS = ['mografy.panel.left', 'mografy.panel.right', 'mografy.timeline.rows', 'mografy.timeline.names', 'mografy.projects.folds', 'mografy.projects.scope', 'mografy.projects'];

/** One line of a shell command (or a block, with `block`) with a copy button. */
function Command({ text, block }: { text: string; block?: boolean }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return <div className={block ? 'st-command block' : 'st-command'}>
    {block ? <pre>{text}</pre> : <code>{text}</code>}
    <button className="tl-icon" aria-label={t.copy} title={copied ? t.copied : t.copy} onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {}); }}>{copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}</button>
  </div>;
}

/** The gear: interface language, editor behaviour, text size and how AI tools connect to this project. */
/** The player's own guess; the user can switch, for example to set up a Windows PC from the Mac. */
const detectWindows = () => typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent);

/** Example folders shown in an empty path field. */
const EXAMPLE_FOLDER = { mac: '/Users/you/Desktop/mografy', windows: 'C:\\Users\\you\\Desktop\\mografy' } as const;
const pathKey = (os: 'mac' | 'windows') => `mografy.mcp.path.${os}`;

/**
 * MCP setup for this Mografy: one prompt for the agent, then the same steps by hand, for macOS or Windows. Each system
 * keeps its own folder: the one this player runs from is filled in on its own system; for the other one (setting up a
 * Windows PC from the Mac, say) type its folder once and it is remembered in this browser.
 */
function McpSection({ target }: { target: McpTarget }) {
  const t = useT();
  const here: 'mac' | 'windows' = detectWindows() ? 'windows' : 'mac';
  const [os, setOs] = useState<'mac' | 'windows'>(here);
  const [paths, setPaths] = useState(() => ({ mac: readLocal(pathKey('mac')) ?? '', windows: readLocal(pathKey('windows')) ?? '' }));
  const [copied, setCopied] = useState(false);
  const typed = paths[os].trim();
  const folder = typed || (os === here ? target.folder : '');
  const sep = os === 'windows' ? '\\' : '/';
  // A typed folder is the same kind of installation as this one: its own copy sits in node_modules.
  const custom = folder !== target.folder;
  const shown: McpTarget = custom
    ? { folder, workspace: target.workspace, bin: [folder.replace(/[\\/]+$/, ''), 'node_modules', 'mografy', 'bin', 'mografy.js'].join(sep) }
    : target;
  const windows = os === 'windows';
  const prompt = folder ? mcpSetupPrompt(shown, windows) : '';
  const commands = folder ? mcpCommands(shown, windows) : undefined;
  const setPath = (value: string) => { setPaths(current => ({ ...current, [os]: value })); writeLocal(pathKey(os), value.trim() ? value : null); };
  const copy = () => { void navigator.clipboard?.writeText(prompt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {}); };
  return <div className="st-group">
    <div className="st-row">
      <span><b>{t.mcpOs}</b></span>
      <span className="st-seg" role="radiogroup" aria-label={t.mcpOs}>
        {([['mac', 'macOS'], ['windows', 'Windows']] as const).map(([id, label]) => <button key={id} role="radio" aria-checked={os === id} className={os === id ? 'on' : ''} onClick={() => setOs(id)}>{label}</button>)}
      </span>
    </div>
    <label className="st-row st-path-row">
      <span><b>{t.mcpFolder}</b><small>{os === here ? t.mcpFolderHere : t.mcpFolderOther}</small></span>
      <input className="st-input" spellCheck={false} value={paths[os]} placeholder={os === here ? target.folder : EXAMPLE_FOLDER[os]} onChange={e => setPath(e.currentTarget.value)} />
    </label>
    {commands ? <>
      <div className="st-tool">
        <div className="st-tool-head"><b>{t.mcpPromptTitle}</b><button className="st-button" onClick={copy}>{copied ? t.mcpCopied : t.mcpCopyPrompt}</button></div>
        <small>{t.mcpPromptHelp}</small>
        <pre className="st-prompt">{prompt}</pre>
      </div>
      <p className="st-lead"><b>{t.mcpManual}</b></p>
      <div className="st-tool"><div className="st-tool-head"><b>Claude Code</b></div><small>{t.mcpClaudeHelp}</small><Command text={commands.claude} /></div>
      <div className="st-tool"><div className="st-tool-head"><b>Codex</b></div><small>{t.mcpCodexHelp}</small><Command text={commands.codex} /></div>
      <div className="st-tool"><div className="st-tool-head"><b>{t.mcpDesktop}</b></div><small>{t.mcpDesktopSetup}</small><Command text={commands.desktop} block /></div>
    </> : <p className="st-lead">{t.mcpFolderNeeded}</p>}
  </div>;
}

export function SettingsPanel({ settings, onChange, onClose, projectDir, mcp }: { settings: Settings; onChange(next: Settings): void; onClose(): void; projectDir?: string | undefined; mcp?: McpTarget | undefined }) {
  const t = useT();
  const [section, setSection] = useState<Section>('language');
  useEscape(onClose);
  const set = (change: Partial<Settings>) => onChange({ ...settings, ...change });
  const sections: [Section, string, ComponentType<{ size?: number }>][] = [
    ['language', t.settingsLanguage, GlobeIcon], ['general', t.settingsGeneral, SlidersHorizontalIcon],
    ['playback', t.stPlayback, PlayCircleIcon], ['text', t.stLook, TextAaIcon], ['keys', t.shortcuts, KeyboardIcon],
    ['mcp', t.settingsMcp, PlugsConnectedIcon], ['about', t.stAbout, InfoIcon],
  ];
  const current = sections.find(s => s[0] === section)!;
  const toggle = (label: string, help: string, value: boolean, apply: (v: boolean) => void) => <label className="st-row">
    <span><b>{label}</b><small>{help}</small></span>
    <span className="switch"><input type="checkbox" role="switch" checked={value} onChange={e => apply(e.currentTarget.checked)} /><span className="knob" /></span>
  </label>;

  return <div className="settings-backdrop" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="st" role="dialog" aria-modal="true" aria-label={t.settings}>
      <nav aria-label={t.settings}>
        <h2>{t.settings}</h2>
        {sections.map(([id, label, Icon]) => <button key={id} className={section === id ? 'on' : ''} aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}><Icon size={17} />{label}</button>)}
      </nav>
      <section>
        <header><h3>{current[1]}</h3><button className="tl-icon" aria-label={t.close} title={`${t.close} (Esc)`} onClick={onClose}><XIcon size={17} /></button></header>

        {section === 'language' ? <div className="st-cards" role="radiogroup" aria-label={t.language}>
          {([['zh', '繁體中文', '時間軸、檢視器和選單都用中文。'], ['en', 'English', 'Timeline, inspector and menus in English.']] as const).map(([id, label, sample]) =>
            <button key={id} role="radio" aria-checked={settings.lang === id} className={`st-card ${settings.lang === id ? 'on' : ''}`} onClick={() => set({ lang: id })}>
              <span><b>{label}</b><small>{sample}</small></span>{settings.lang === id ? <CheckIcon size={18} /> : null}
            </button>)}
        </div> : null}

        {section === 'general' ? <div className="st-group">
          {toggle(t.snapping, t.snappingHelp, settings.snapping, v => set({ snapping: v }))}
          {toggle(t.follow, t.followHelp, settings.follow, v => set({ follow: v }))}
          {toggle(t.stBeats, t.stBeatsHelp, settings.beats, v => set({ beats: v }))}
          <div className="st-row">
            <span><b>{t.density}</b><small>{t.densityHelp}</small></span>
            <div className="segmented" role="radiogroup" aria-label={t.density}>
              {(['standard', 'compact'] as const).map(id => <button key={id} role="radio" aria-checked={settings.density === id} className={settings.density === id ? 'on' : ''} onClick={() => set({ density: id })}>{id === 'standard' ? t.standard : t.compact}</button>)}
            </div>
          </div>
        </div> : null}

        {section === 'playback' ? <div className="st-group">
          <div className="st-row">
            <span><b>{t.stTimeFormat}</b><small>{t.stTimeFormatHelp}</small></span>
            <div className="segmented" role="radiogroup" aria-label={t.stTimeFormat}>
              {(['timecode', 'seconds', 'frames'] as const).map(id => <button key={id} role="radio" aria-checked={settings.timeFormat === id} className={settings.timeFormat === id ? 'on' : ''} onClick={() => set({ timeFormat: id })}>{t.stTimeFormats[id]}</button>)}
            </div>
          </div>
          {toggle(t.stLoop, t.stLoopHelp, settings.loop, v => set({ loop: v }))}
        </div> : null}

        {section === 'keys' ? <div className="st-group st-keys">
          {t.keys.map(([group, rows]) => <section key={group}><h4>{group}</h4><dl>{rows.map(([k, v]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>)}</dl></section>)}
          <section><h4>{t.spTitle}</h4><dl><div><dt><kbd>/</kbd></dt><dd>{t.stSpotlight}</dd></div><div><dt><kbd>⌘K</kbd></dt><dd>{t.stSpotlight}</dd></div></dl></section>
        </div> : null}

        {section === 'about' ? <div className="st-group">
          <div className="st-about"><b>Mografy</b><small>{t.stAboutHelp}</small></div>
          <div className="st-row">
            <span><b>{t.stResetLayout}</b><small>{t.stResetLayoutHelp}</small></span>
            <button className="st-button" onClick={() => { for (const key of LAYOUT_KEYS) writeLocal(key, null); location.reload(); }}>{t.stReset}</button>
          </div>
          <div className="st-row">
            <span><b>{t.stResetAll}</b><small>{t.stResetAllHelp}</small></span>
            <button className="st-button" onClick={() => onChange({ lang: settings.lang, ...DEFAULT_SETTINGS })}>{t.stReset}</button>
          </div>
        </div> : null}

        {section === 'text' ? <div className="st-group">
          <div className="st-scale" role="radiogroup" aria-label={t.settingsText}>
            {TEXT_SCALES.map(scale => <button key={scale} role="radio" aria-checked={settings.textScale === scale} className={settings.textScale === scale ? 'on' : ''} onClick={() => set({ textScale: scale })}>
              <span style={{ fontSize: `${13 * scale}px` }}>Aa</span><small>{Math.round(scale * 100)}%</small>
            </button>)}
          </div>
          <p className="st-sample" style={{ fontSize: `${14 * settings.textScale}px` }}>{t.textSample}</p>
          {toggle(t.stReduceMotion, t.stReduceMotionHelp, settings.reduceMotion, v => set({ reduceMotion: v }))}
        </div> : null}

        {section === 'mcp' ? <McpSection target={mcp ?? { folder: projectDir ?? '', workspace: false, bin: 'mografy.js' }} /> : null}
      </section>
    </div>
  </div>;
}
