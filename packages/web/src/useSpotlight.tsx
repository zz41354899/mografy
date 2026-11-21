// The spotlight's contents: "/" or ⌘K opens one search over commands, shots, layers, projects and a time to jump to.
import { useCallback, useEffect, useState } from 'react';
import type { ProjectList, Snapshot } from '@mografy/core';
import { ClockIcon } from '@phosphor-icons/react/dist/csr/Clock';
import { ExportIcon } from '@phosphor-icons/react/dist/csr/Export';
import { FilmSlateIcon } from '@phosphor-icons/react/dist/csr/FilmSlate';
import { FolderSimpleIcon } from '@phosphor-icons/react/dist/csr/FolderSimple';
import { FrameCornersIcon } from '@phosphor-icons/react/dist/csr/FrameCorners';
import { GearSixIcon } from '@phosphor-icons/react/dist/csr/GearSix';
import { PaletteIcon } from '@phosphor-icons/react/dist/csr/Palette';
import { PlayIcon } from '@phosphor-icons/react/dist/csr/Play';
import { SidebarSimpleIcon } from '@phosphor-icons/react/dist/csr/SidebarSimple';
import { StackIcon } from '@phosphor-icons/react/dist/csr/Stack';
import { callApi } from './api.js';
import { basename, clock } from './format.js';
import { useT } from './i18n.js';
import type { PlayerView, ScenePlayer } from './player.js';
import { ignoreKey, useKeydown } from './shortcuts.js';
import type { SpotItem } from './Spotlight.js';
import type { TimelineEditor } from './useTimeline.js';

export interface SpotlightInputs {
  snapshot: Snapshot | null; player: ScenePlayer | null; view: PlayerView; timeline: TimelineEditor;
  showProjects: boolean; seekTo(time: number): void; showExport(resume: boolean): void;
  toggleProjects(): void; toggleGuides(): void; openDesign(): void; openSettings(): void; openBatch(): void;
}

export function useSpotlight({ snapshot, player, view, timeline, showProjects, seekTo, showExport, toggleProjects, toggleGuides, openDesign, openSettings, openBatch }: SpotlightInputs) {
  const t = useT();
  const meta = snapshot?.scene?.meta, projectDir = snapshot?.projectDir;
  const [spotOpen, setSpotOpen] = useState(false);
  const [projectList, setProjectList] = useState<ProjectList | null>(null);
  useKeydown(e => {
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !ignoreKey(e))) { e.preventDefault(); setSpotOpen(true); }
  });
  useEffect(() => { if (spotOpen) void callApi<ProjectList>('projects').then(setProjectList, () => {}); }, [spotOpen]);
  const spotItems = (): SpotItem[] => {
    const duration = meta?.duration ?? 0;
    const commands: SpotItem[] = [
      { id: 'c-play', group: 'command', label: view.playing ? t.pause : t.play, keywords: 'play pause space 播放 暫停', hint: 'Space', icon: <PlayIcon size={16} />, run: () => player?.toggle() },
      ...(snapshot?.scene ? [{ id: 'c-export', group: 'command' as const, label: t.export, keywords: 'export render mp4 匯出', icon: <ExportIcon size={16} />, run: () => showExport(snapshot?.render?.state === 'running') }] : []),
      { id: 'c-batch', group: 'command', label: t.batchExport, keywords: 'batch export queue 批次 匯出', icon: <StackIcon size={16} />, run: openBatch },
      { id: 'c-design', group: 'command', label: t.designSystem, keywords: 'design system colours colors 設計 顏色', icon: <PaletteIcon size={16} />, run: openDesign },
      { id: 'c-settings', group: 'command', label: t.settings, keywords: 'settings preferences language 設定 語言', icon: <GearSixIcon size={16} />, run: openSettings },
      { id: 'c-projects', group: 'command', label: showProjects ? t.hideProjects : t.showProjects, keywords: 'projects sidebar 專案', hint: 'P', icon: <SidebarSimpleIcon size={16} />, run: toggleProjects },
      { id: 'c-guides', group: 'command', label: t.guides, keywords: 'guides safe area 安全框', hint: 'G', icon: <FrameCornersIcon size={16} />, run: toggleGuides },
    ];
    const shots = meta?.shots ?? [];
    const slides = shots.map((shot, i): SpotItem => {
      const start = i ? shots[i - 1]!.end : 0;
      return { id: `s-${i}`, group: 'shot', label: `${i + 1}. ${shot.title ?? `Shot ${i + 1}`}`, hint: `${clock(start)}–${clock(Math.min(shot.end, duration))}`, icon: <FilmSlateIcon size={16} />, run: () => seekTo(start) };
    });
    const layers = (timeline.state?.layers ?? []).map((l): SpotItem => ({
      id: `l-${l.id}`, group: 'layer', label: l.name, keywords: l.id, hint: `${clock(l.in)}–${clock(l.out)}`,
      icon: <i className="spot-swatch" style={{ background: l.colour ?? '#8a8f98' }} />, run: () => { timeline.select(l.id); seekTo(l.in); },
    }));
    const projects = (projectList?.projects ?? []).filter(p => p.dir !== projectDir).map((p): SpotItem => ({
      id: `p-${p.dir}`, group: 'project', label: p.name, keywords: basename(p.dir), hint: t.groups[p.kind], icon: p.kind === 'component' ? <StackIcon size={16} /> : <FolderSimpleIcon size={16} />,
      run: () => { void callApi('projects/open', 'POST', { dir: p.dir }).catch(() => {}); },
    }));
    return [...commands, ...slides, ...layers, ...projects];
  };
  const spotTime = useCallback((seconds: number): SpotItem | null => {
    const duration = meta?.duration ?? 0;
    if (!(seconds >= 0 && seconds <= duration)) return null;
    return { id: 'time', group: 'time', label: t.spJump(clock(seconds)), icon: <ClockIcon size={16} />, run: () => seekTo(seconds) };
  }, [meta?.duration, seekTo, t]);

  return { open: spotOpen, close: () => setSpotOpen(false), items: spotItems, timeItem: spotTime };
}
