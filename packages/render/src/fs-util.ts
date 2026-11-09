// File helpers with no heavy dependencies: scripts and the Server's writers load this without loading Chromium.
import { join } from 'node:path';

const LOCKED = ['EPERM', 'EACCES', 'EBUSY'];
export const isLockedError = (error: unknown) => LOCKED.includes((error as NodeJS.ErrnoException).code ?? '');

/**
 * On Windows a virus scanner, the search indexer or an editor can hold a just-written file for a moment, and a rename
 * then fails with EPERM, EACCES or EBUSY. Retry briefly instead of failing.
 */
export async function retryWhileLocked<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await work(); }
    catch (error) {
      if (process.platform !== 'win32' || attempt >= 9 || !isLockedError(error)) throw error;
      await new Promise(done => setTimeout(done, 50 * (attempt + 1)));
    }
  }
}

/** The folder inside each project that holds Mografy's own state. */
export const PROJECT_STATE_DIR = '.mografy';
export function projectPaths(dir: string) {
  const state = join(dir, PROJECT_STATE_DIR);
  return {
    state, builds: join(state, 'builds'), tmp: join(state, 'tmp'), stateFile: join(state, 'state.json'), verified: join(state, 'verified.json'),
    thumb: join(state, 'thumb.png'), thumbInfo: join(state, 'thumb.json'), autoShots: join(state, 'auto-shots.json'), slidesSync: join(state, 'slides-sync.json'), serverLock: join(state, 'server.json'),
  };
}
