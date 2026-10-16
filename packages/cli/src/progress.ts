import type { ExportFormat, RenderStatus } from '@mografy/core';
import type { RunningServer } from '@mografy/server';
import { displayPath } from './paths.js';

export const formatName = (format: ExportFormat) => format === 'mp4' ? 'MP4' : format === 'lottie' ? 'Lottie' : 'SVGA';

export function progressReporter(format: ExportFormat) {
  let lastStage = '', lastBucket = -1, captureComplete = false;
  const finishCapture = (status: RenderStatus) => {
    if (captureComplete) return;
    const line = `Capturing frames ${status.total}/${status.total} (100%)`;
    if (lastBucket < 100) {
      if (process.stdout.isTTY) process.stdout.write(`\r${line.padEnd(52)}\n`); else console.log(line);
    } else if (process.stdout.isTTY && lastStage === 'capture') process.stdout.write('\n');
    lastBucket = 100;
    captureComplete = true;
  };
  const update = (status: RenderStatus) => {
    if (status.stage === 'done') return;
    const pct = status.total ? Math.floor(status.done / status.total * 100) : 0;
    const bucket = process.stdout.isTTY ? pct : Math.floor(pct / 10) * 10;
    if (status.stage === 'capture' && (bucket !== lastBucket || lastStage !== status.stage)) {
      const line = `Capturing frames ${status.done}/${status.total} (${pct}%)`;
      if (process.stdout.isTTY) process.stdout.write(`\r${line.padEnd(52)}`); else console.log(line);
      lastBucket = bucket;
    } else if (status.stage !== lastStage && status.stage === 'encode') {
      finishCapture(status);
      console.log('Encoding MP4…');
    } else if (status.stage !== lastStage && status.stage === 'package') {
      finishCapture(status);
      console.log(`Packaging ${formatName(format)}…`);
    }
    lastStage = status.stage;
  };
  const finish = (status: RenderStatus) => {
    finishCapture(status);
    if (lastStage !== 'encode' && lastStage !== 'package') console.log(format === 'mp4' ? 'Encoding MP4…' : `Packaging ${formatName(format)}…`);
  };
  const stop = () => {
    if (process.stdout.isTTY && lastStage === 'capture' && !captureComplete && lastBucket >= 0) process.stdout.write('\n');
  };
  return { update, finish, stop };
}

export function monitorDevExports(server: RunningServer) {
  let id = '', complete = '', report: ReturnType<typeof progressReporter> | undefined, cancelling = false;
  const tick = () => {
    const status = server.project.snapshot().render;
    if (!status || status.id === complete) return;
    if (status.id !== id) {
      id = status.id; report = progressReporter(status.format); cancelling = false;
      console.log(`\nExporting ${formatName(status.format)} from the player…`);
      console.log(`  Project: ${displayPath(server.project.dir)}`);
      console.log(`  Output:  ${displayPath(status.output)}`);
    }
    if (!status.cancelling) report?.update(status);
    if (status.cancelling && !cancelling) { report?.stop(); console.log('Cancelling export…'); cancelling = true; }
    if (status.state === 'running') return;
    complete = status.id;
    if (status.state === 'done') { report?.finish(status); console.log(`✓ ${formatName(status.format)} export complete: ${displayPath(status.output)}`); }
    else if (status.state === 'cancelled') { report?.stop(); console.log('Export cancelled.'); }
    else { report?.stop(); console.error(`Export failed: ${status.error ?? 'Unknown error'}`); }
  };
  tick();
  const timer = setInterval(tick, 200); timer.unref();
  return () => clearInterval(timer);
}

