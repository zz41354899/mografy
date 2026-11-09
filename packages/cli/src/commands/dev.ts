// `mografy dev`: start the player, or hand the project to the one already open.
import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import { sendApi } from '@mografy/core';
import { AlreadyRunning, findActive, startServer } from '@mografy/server';
import { displayPath } from '../paths.js';
import { monitorDevExports } from '../progress.js';
import type { Flags } from '../options.js';

export function openBrowser(url: string) {
  if (process.env.MOGRAFY_NO_OPEN) return;
  const [command, args] = platform() === 'darwin' ? ['open', [url]] : platform() === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  const child = spawn(command, args as string[], { stdio: 'ignore', detached: true });
  child.on('error', () => {}); child.unref();
}

/** Ask the player that is already open to show `dir` instead. */
export async function switchActive(dir: string): Promise<string | undefined> {
  const active = await findActive();
  if (!active) return undefined;
  const response = await sendApi(active.url, 'projects/open', 'POST', { dir });
  if (response.ok) return active.url;
  const data = await response.json().catch(() => ({})) as { error?: { url?: string } };
  return data.error?.url;
}

export async function dev(dir: string, flags: Flags) {
  try {
    const server = await startServer(dir, flags.port === undefined ? {} : { port: flags.port });
    const snapshot = server.project.snapshot();
    console.log(`Mografy dev server: ${server.url}`);
    console.log(`Project: ${displayPath(dir)}`);
    console.log(server.hmr ? 'Player: hot reload from source (Vite)' : 'Player: built files (Vite not installed; run `pnpm install` for hot reload)');
    console.log(snapshot.scene
      ? `Scene ${snapshot.scene.version} (${snapshot.scene.meta.width}×${snapshot.scene.meta.height}, ${snapshot.scene.meta.duration}s)`
      : `Scene failed to load:\n${snapshot.error?.message ?? ''}`);
    console.log('\nEdit the scene with Claude or Codex. Mografy will compile and trial-render every saved change.\nExports from the player appear here. Press Ctrl+C to stop.');
    const stopExportMonitor = monitorDevExports(server);
    if (flags.open) openBrowser(server.url);
    const stop = async () => { stopExportMonitor(); await server.close(); process.exit(0); };
    process.once('SIGINT', () => void stop()); process.once('SIGTERM', () => void stop());
  } catch (error) {
    if (error instanceof AlreadyRunning) {
      console.log(`Mografy dev is already running: ${error.url}`);
      if (flags.open) openBrowser(error.url);
      return;
    }
    throw error;
  }
}
