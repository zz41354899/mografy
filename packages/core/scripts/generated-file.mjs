// Generated files are tracked, and Git on Windows may check them out with CRLF. Rewriting one with LF makes Git report
// it as modified with an empty diff, which blocks `mografy update`, so a file that differs only in line endings is left
// alone. Every generator goes through this comparison.
import { readFileSync, writeFileSync } from 'node:fs';

const lf = text => text.replaceAll('\r\n', '\n');
/** Whether two versions of a generated text file have the same content, whatever their line endings. */
export const sameText = (current, next) => current !== undefined && lf(current) === lf(next);

/** Write `next` unless the file already holds it. Returns whether the file was written. */
export function writeGeneratedSync(path, next) {
  let current;
  try { current = readFileSync(path, 'utf8'); } catch {}
  if (sameText(current, next)) return false;
  writeFileSync(path, next);
  return true;
}
