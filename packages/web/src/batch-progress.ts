// What the batch export screens share about formats, jobs and the passing of time.
import { useEffect, useState } from 'react';
import type { ExportFormat, QueueJob } from '@mografy/core';
import type { BatchFormat } from './ExportQueue.js';

export const FORMATS: { id: BatchFormat; name: string; spec: string }[] = [
  { id: 'mp4', name: 'MP4', spec: 'H.264 · H.265' },
  { id: 'webm', name: 'WebM', spec: 'VP9' },
  { id: 'mov', name: 'MOV', spec: 'ProRes' },
  { id: 'lottie', name: 'Lottie', spec: 'Web' },
  { id: 'svga', name: 'SVGA', spec: 'App' },
];
export const formatName = (format: ExportFormat) => FORMATS.find(f => f.id === format)?.name ?? format.toUpperCase();
export const isActive = (job: QueueJob) => job.state === 'queued' || job.state === 'running';
export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** Progress of one running job: what the scene, the queue rows and the corner card all show. */
export function jobProgress(job: QueueJob, now: number) {
  const capture = job.state === 'running' && job.stage === 'capture' && job.total > 0;
  const percentage = capture ? Math.min(99, Math.round(job.done / job.total * 100)) : job.state === 'done' ? 100 : 0;
  const elapsed = job.startedAt ? Math.max(0, (now - Date.parse(job.startedAt)) / 1000) : 0;
  const left = capture && job.done > 0 && elapsed > 2 ? elapsed / job.done * (job.total - job.done) : null;
  const stage = job.state === 'running' ? job.stage === 'encode' ? 'Encoding' : job.stage === 'package' ? 'Packaging' : capture ? 'Capturing' : 'Starting' : '';
  return { capture, percentage, elapsed, left, stage };
}

export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}
