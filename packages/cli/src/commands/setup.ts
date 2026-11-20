// `mografy setup [ffmpeg|chromium] [--check]`: download the native tools now instead of on first use, for example
// before going offline or in CI. `--check` only reports what each command would use.
import { chromiumWorks, ensureFfmpeg, FFMPEG, installChromiumShell, listEncoders, REQUIRED_ENCODERS, toolPath } from '@mografy/render';
import { existsSync } from 'node:fs';

const TOOLS = ['ffmpeg', 'chromium'] as const;
type Tool = typeof TOOLS[number];

export function setupTools(args: string[]): Tool[] {
  for (const arg of args) if (!TOOLS.includes(arg as Tool)) throw new Error(`Usage: mografy setup [ffmpeg|chromium] [--check]\nUnknown tool: ${arg}`);
  return args.length ? args as Tool[] : [...TOOLS];
}

async function checkFfmpeg() {
  if (process.env.MOGRAFY_FFMPEG) return `MOGRAFY_FFMPEG: ${process.env.MOGRAFY_FFMPEG}`;
  if (existsSync(toolPath(FFMPEG))) return `downloaded: ${toolPath(FFMPEG)}`;
  const system = await listEncoders('ffmpeg');
  if (!system) return 'not installed; the first video export downloads it (about 25 MB), or run mografy setup ffmpeg';
  const missing = REQUIRED_ENCODERS.filter(name => !system.has(name));
  return missing.length ? `ffmpeg on PATH lacks ${missing.join(', ')}; the first video export downloads a complete one` : 'ffmpeg on PATH (has every encoder Mografy uses)';
}

export async function setup(args: string[], check: boolean) {
  const tools = setupTools(args);
  if (check) {
    if (tools.includes('ffmpeg')) console.log(`FFmpeg:   ${await checkFfmpeg()}`);
    if (tools.includes('chromium')) {
      const result = await chromiumWorks();
      console.log(`Chromium: ${result.ok ? result.detail : `not working (${result.detail}); run mografy setup chromium`}`);
    }
    return;
  }
  if (tools.includes('ffmpeg')) {
    let last = -1;
    const choice = await ensureFfmpeg({
      onProgress: (received, total) => {
        const pct = Math.floor(received / Math.max(1, total) * 100);
        if (pct === last) return; last = pct;
        const line = `Downloading FFmpeg ${(received / 1048576).toFixed(1)}/${(total / 1048576).toFixed(1)} MB (${pct}%)`;
        if (process.stdout.isTTY) process.stdout.write(`\r${line.padEnd(52)}`); else if (pct % 10 === 0) console.log(line);
      },
    });
    if (last >= 0 && process.stdout.isTTY) process.stdout.write('\n');
    const where = { env: 'MOGRAFY_FFMPEG', downloaded: 'downloaded build', bundled: 'ffmpeg-static from an earlier installation', system: 'ffmpeg on PATH', 'system-incomplete': 'ffmpeg on PATH' }[choice.source];
    console.log(`✓ FFmpeg: ${where} (${choice.path})${choice.missing?.length ? `\n  It lacks ${choice.missing.join(', ')}; exports that need them will fail or fall back.` : ''}`);
  }
  if (tools.includes('chromium')) {
    await installChromiumShell();
    const result = await chromiumWorks();
    if (!result.ok) throw new Error(`Chromium does not start: ${result.detail}`);
    console.log(`✓ Chromium: ${result.detail}`);
  }
}
