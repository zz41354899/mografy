import { exportFormatSchema } from '@mografy/core';
import type { ExportFormat } from '@mografy/core';

export interface Flags {
  port?: number | undefined;
  open: boolean;
  yes: boolean;
  output?: string | undefined;
  video?: string | undefined;
  /** `html` is the presentation file, written directly rather than as a render job. */
  format?: ExportFormat | 'html' | undefined;
  orientation?: 'landscape' | 'portrait';
  resolution?: '720p' | '1080p';
  cancel: boolean;
  updateCheck: boolean;
  /** `mografy add`: replace files that differ from the extra. */
  force: boolean;
}

export function parse(argv: string[]) {
  const flags: Flags = { open: true, yes: false, cancel: false, updateCheck: false, force: false };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i]!;
    if (value === '--no-open') flags.open = false;
    else if (value === '--yes' || value === '-y') flags.yes = true;
    else if (value === '--cancel') flags.cancel = true;
    else if (value === '--check') flags.updateCheck = true;
    else if (value === '--force') flags.force = true;
    else if (value === '--port') flags.port = Number(argv[++i]);
    else if (value === '--output' || value === '-o') flags.output = argv[++i];
    else if (value === '--video') flags.video = argv[++i];
    else if (value === '--format') { const v = argv[++i]; flags.format = v === 'html' ? 'html' : exportFormatSchema.parse(v); }
    else if (value === '--orientation') { const v = argv[++i]; if (v !== 'landscape' && v !== 'portrait') throw new Error('--orientation must be landscape or portrait'); flags.orientation = v; }
    else if (value === '--resolution') { const v = argv[++i]; if (v !== '720p' && v !== '1080p') throw new Error('--resolution must be 720p or 1080p'); flags.resolution = v; }
    else if (value.startsWith('-') && value !== '-h' && value !== '--help' && value !== '--version') throw new Error(`Unknown option: ${value}`);
    else rest.push(value);
  }
  if (flags.port !== undefined && !(Number.isInteger(flags.port) && flags.port > 0 && flags.port < 65536)) throw new Error('--port must be between 1 and 65535');
  return { flags, rest };
}

