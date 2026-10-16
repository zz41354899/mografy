import { watch } from 'node:fs';
import type { FSWatcher } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const IGNORED = new Set(['.mografy', 'renders', 'node_modules', '.git']);

/** Fast filesystem events plus a fallback poll; owns all watcher timers. */
export class ProjectWatcher {
  private watcher: FSWatcher | undefined;
  private poller: ReturnType<typeof setInterval> | undefined;
  private debounce: ReturnType<typeof setTimeout> | undefined;
  private fingerprint = '';
  private stopped = true;
  private scanning = false;

  constructor(private dir: string, private rebuild: () => Promise<unknown>) {}

  private async scan() {
    const parts: string[] = [];
    const walk = async (rel: string): Promise<void> => {
      const entries = await readdir(join(this.dir, rel), { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (this.stopped) return;
        if (entry.name.startsWith('.') || (!rel && IGNORED.has(entry.name))) continue;
        const path = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) { if (parts.length < 5000) await walk(path); }
        else if (entry.isFile()) {
          const info = await stat(join(this.dir, path)).catch(() => undefined);
          if (info) parts.push(`${path}:${info.size}:${info.mtimeMs}`);
        }
      }
    };
    await walk('');
    return parts.sort().join('|');
  }

  private trigger = () => {
    if (this.stopped) return;
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      void this.scan().then(fingerprint => {
        if (this.stopped) return;
        this.fingerprint = fingerprint;
        return this.rebuild();
      }).catch(() => {});
    }, 150);
  };

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    try {
      this.watcher = watch(this.dir, { recursive: true }, (_event, name) => {
        const path = String(name ?? '').replaceAll('\\', '/');
        if (!path || IGNORED.has(path.split('/')[0]!) || /(^|\/)\.|~$|\.swp$/.test(path)) return;
        this.trigger();
      });
      this.watcher.on('error', () => {});
    } catch { /* Polling still works when recursive watching is unavailable. */ }
    void this.scan().then(fingerprint => { if (!this.stopped) this.fingerprint = fingerprint; });
    this.poller = setInterval(() => {
      if (this.scanning) return;
      this.scanning = true;
      void this.scan().then(fingerprint => {
        if (!this.stopped && fingerprint !== this.fingerprint) { this.fingerprint = fingerprint; this.trigger(); }
      }).catch(() => {}).finally(() => { this.scanning = false; });
    }, 1000);
    this.poller.unref();
  }

  close() {
    this.stopped = true;
    this.watcher?.close();
    clearInterval(this.poller);
    clearTimeout(this.debounce);
  }
}
