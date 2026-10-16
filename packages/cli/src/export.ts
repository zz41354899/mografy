import { EXPORT_SIZES, MP4_PORTRAIT_SIZES } from '@mografy/core';
import type { RenderStatus } from '@mografy/core';
import { findServer } from '@mografy/server';
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

export async function exportProject(dir: string, flags: Flags) {
  if (flags.cancel) return cancelExport(dir);
  await requireProject(dir);
  const format = flags.format ?? 'mp4';
  if ((flags.orientation || flags.resolution) && format !== 'mp4') throw new Error('--orientation and --resolution are MP4 options');
  const preset = (flags.orientation === 'portrait' ? MP4_PORTRAIT_SIZES : EXPORT_SIZES.mp4)[flags.resolution === '1080p' ? 1 : 0]!;
  const size = flags.orientation || flags.resolution ? { width: preset.width, height: preset.height, fit: 'contain' as const } : undefined;
  const request = { format, ...(size ? { size } : {}), ...(flags.output ? { output: exportOutput(flags.output) } : {}) };
  const connection = await openExportConnection(dir);
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
        if (latest.state === 'failed') { report.stop(); throw new Error(latest.error ?? 'Export failed.'); }
        if (latest.state === 'cancelled') {
          report.stop(); console.log('Export cancelled.'); process.exitCode = interrupted ? 130 : 1; return;
        }
        if (latest.state === 'done') {
          report.finish(latest);
          console.log(`✓ ${formatName(format)} export complete: ${displayPath(latest.output)}`);
          return;
        }
        await delay(200);
      }
    } finally {
      process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt);
      report.stop();
    }
  } finally { await connection.close(); }
}

