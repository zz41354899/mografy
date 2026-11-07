import { EXPORT_PRESETS, EXPORT_SIZES, isVideoFormat, MP4_PORTRAIT_SIZES } from '@mografy/core';
import type { RenderStatus } from '@mografy/core';
import { findServer, isProject } from '@mografy/server';
import { SharedBrowsers } from '@mografy/render';
import { readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { responseJson } from './api.js';
import { displayPath, requireProject } from './paths.js';
import { formatName, progressReporter } from './progress.js';
import { openExportConnection } from './export-transport.js';
import type { Flags } from './options.js';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function exportOutput(value: string | undefined) {
  if (!value) return undefined;
  const path = value.replaceAll('\\', '/');
  if (path.startsWith('/') || path.split('/').includes('..') || path.includes(':')) throw new Error('--output must be a file inside renders/');
  return path.startsWith('renders/') ? path : `renders/${path}`;
}

async function cancelExport(dir: string) {
  await requireProject(dir);
  const running = await findServer(dir);
  if (!running) throw new Error('No dev server is running for this project. Press Ctrl+C in the terminal that started the export.');
  const before = (await responseJson<{ render: RenderStatus | null }>(await fetch(new URL('/__mografy/snapshot', running.url)))).render;
  if (!before || before.state !== 'running') { console.log('No export is running for this project.'); return; }
  await responseJson<RenderStatus>(await fetch(new URL('/__mografy/render/cancel', running.url), {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: before.id }),
  }));
  console.log(`Cancelling ${formatName(before.format)} export…`);
  for (;;) {
    const current = (await responseJson<{ render: RenderStatus | null }>(await fetch(new URL('/__mografy/snapshot', running.url)))).render;
    if (!current || current.id !== before.id) throw new Error('The export job disappeared.');
    if (current.state === 'cancelled') { console.log('Export cancelled.'); return; }
    if (current.state === 'done') { console.log(`Export already completed: ${displayPath(current.output)}`); return; }
    if (current.state === 'failed') throw new Error(current.error ?? 'Export failed while it was being cancelled.');
    await delay(100);
  }
}

/** How one export ended; a failure throws. */
export type ExportOutcome = { state: 'done'; output: string } | { state: 'cancelled' };

export async function exportProject(dir: string, flags: Flags, browsers?: SharedBrowsers): Promise<ExportOutcome | undefined> {
  if (flags.cancel) { await cancelExport(dir); return undefined; }
  await requireProject(dir);
  if (flags.format === 'html') throw new Error('Presentation files are written by `mografy export --format html`.');
  const preset = flags.preset ? EXPORT_PRESETS[flags.preset] : undefined;
  if (preset && flags.format && flags.format !== preset.format) throw new Error(`--preset ${flags.preset} exports ${preset.format.toUpperCase()}; leave out --format or choose another preset`);
  const format = preset?.format ?? flags.format ?? 'mp4';
  if ((flags.orientation || flags.resolution) && !isVideoFormat(format)) throw new Error('--orientation and --resolution are MP4, WebM and MOV options');
  if (flags.codec && format !== 'mp4') throw new Error('--codec is an MP4 option (WebM is always VP9, MOV always ProRes)');
  const sized = (flags.orientation === 'portrait' ? MP4_PORTRAIT_SIZES : EXPORT_SIZES.mp4)[flags.resolution === '1080p' ? 1 : 0]!;
  const size = flags.orientation || flags.resolution ? { width: sized.width, height: sized.height, fit: 'contain' as const } : undefined;
  const request = { format, ...(size ? { size } : {}), ...(flags.output ? { output: exportOutput(flags.output) } : {}), ...(preset || flags.codec || flags.workers ? { render: { ...preset?.render, ...(flags.codec ? { codec: flags.codec } : {}), ...(flags.workers ? { workers: flags.workers } : {}) } } : {}) };
  const connection = await openExportConnection(dir, browsers);
  try {
    const status = await connection.start(request);
    const current = () => connection.current();
    const cancel = () => connection.cancel(status.id);

    console.log(`Exporting ${formatName(format)}…`);
    console.log(`  Project: ${displayPath(dir)}`);
    console.log(`  Output:  ${displayPath(status.output)}`);
    const report = progressReporter(format);
    let interrupted = false, cancelError: unknown;
    const interrupt = () => {
      if (interrupted) return;
      interrupted = true; report.stop(); console.log('Cancelling export…');
      void cancel().catch(error => { cancelError = error; });
    };
    process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
    try {
      for (;;) {
        if (cancelError) throw cancelError;
        const latest = await current();
        if (!latest || latest.id !== status.id) throw new Error('The export job disappeared.');
        report.update(latest);
        // On Windows, Ctrl+C reaches FFmpeg and Chromium too, so the export may fail just before it is cancelled.
        if (latest.state === 'failed' && !interrupted) { report.stop(); throw new Error(latest.error ?? 'Export failed.'); }
        if (latest.state === 'cancelled' || latest.state === 'failed') {
          report.stop(); console.log('Export cancelled.'); process.exitCode = interrupted ? 130 : 1; return { state: 'cancelled' };
        }
        if (latest.state === 'done') {
          report.finish(latest);
          console.log(`✓ ${formatName(format)} export complete: ${displayPath(latest.output)}${latest.encoder ? ` (${latest.encoder})` : ''}`);
          if (latest.note) console.log(`  ${latest.note}`);
          return { state: 'done', output: latest.output };
        }
        await delay(200);
      }
    } finally {
      process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt);
      report.stop();
    }
  } finally { await connection.close(); }
}


/** Projects directly inside `folder`, by name; folders starting with `_` or `.` (such as `_to_delete`) are left out. */
export async function projectsIn(folder: string) {
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => { throw new Error(`Folder not found: ${displayPath(folder)}`); });
  const dirs: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    if (await isProject(join(folder, entry.name))) dirs.push(join(folder, entry.name));
  }
  if (!dirs.length) throw new Error(`No Mografy projects in ${displayPath(folder)}`);
  return dirs;
}

/** A failure on one summary line (validation errors arrive as multi-line JSON). */
const oneLine = (text: string) => { const flat = text.replace(/\s+/g, ' ').trim(); return flat.length > 140 ? `${flat.slice(0, 139)}…` : flat; };
const elapsed = (ms: number) => { const s = Math.round(ms / 1000); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`; };

/**
 * Batch export: each project in turn with the same options, sharing one Chromium. A project that fails is reported and
 * the batch goes on; Ctrl+C cancels the current export and stops the batch. Ends with a summary of every project.
 */
export async function exportBatch(dirs: string[], flags: Flags) {
  if (flags.cancel) throw new Error('--cancel takes one project: mografy export --cancel <project>');
  if (flags.output) throw new Error('--output names one file; a batch writes each project to its own renders/ folder');
  if (flags.format === 'html') throw new Error('A batch exports videos or animations; presentation files are one project at a time.');
  const unique = [...new Set(dirs)];
  for (const dir of unique) await requireProject(dir);
  console.log(`Batch export: ${unique.length} project${unique.length === 1 ? '' : 's'}, one after another`);
  for (const [i, dir] of unique.entries()) console.log(`  ${i + 1}. ${displayPath(dir)}`);
  const results: { dir: string; state: 'done' | 'failed' | 'cancelled' | 'skipped'; detail?: string | undefined; ms?: number }[] = [];
  const browsers = new SharedBrowsers();
  let stopped = false;
  // Ctrl+C stops the whole batch, even when the current export reports a failure first (Windows sends it to FFmpeg too).
  const stop = () => { stopped = true; };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  try {
    for (const [i, dir] of unique.entries()) {
      if (stopped) { results.push({ dir, state: 'skipped' }); continue; }
      console.log(`\n[${i + 1}/${unique.length}] ${basename(dir)}`);
      const began = Date.now();
      try {
        const outcome = await exportProject(dir, flags, browsers);
        if (outcome?.state === 'cancelled') { results.push({ dir, state: 'cancelled' }); stopped = true; }
        else results.push({ dir, state: 'done', detail: outcome?.output, ms: Date.now() - began });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`✗ ${message}`);
        results.push({ dir, state: 'failed', detail: message, ms: Date.now() - began });
      }
    }
  } finally { process.off('SIGINT', stop); process.off('SIGTERM', stop); await browsers.close(); }
  const done = results.filter(r => r.state === 'done').length, failed = results.filter(r => r.state === 'failed').length;
  console.log(`\nBatch export finished: ${done} done${failed ? `, ${failed} failed` : ''}${stopped ? ', stopped' : ''}`);
  for (const r of results) {
    const mark = r.state === 'done' ? '✓' : r.state === 'failed' ? '✗' : '–';
    const detail = r.state === 'done' ? `${displayPath(r.detail!)} (${elapsed(r.ms!)})` : r.state === 'failed' ? oneLine(r.detail!) : r.state;
    console.log(`  ${mark} ${basename(r.dir)}: ${detail}`);
  }
  if (failed && !process.exitCode) process.exitCode = 1;
}
