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
  private running = false;
  private pending = false;

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
    this.debounce = setTimeout(() => this.flush(), 150);
  };

  /**
   * At most one rebuild runs and at most one more is pending. Changes that arrive while a rebuild
   * compiles and trial-renders collapse into a single follow-up that reads the latest files,
   * instead of queueing one full rebuild per intermediate save.
   */
  private flush() {
    if (this.stopped) return;
    if (this.running) { this.pending = true; return; }
    this.running = true;
    void (async () => {
      try {
        do {
          this.pending = false;
          const fingerprint = await this.scan().catch(() => this.fingerprint);
          if (this.stopped) return;
          this.fingerprint = fingerprint;
          await this.rebuild().catch(() => {});
        } while (this.pending && !this.stopped);
      } finally { this.running = false; }
    })();
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    let watching = false;
    try {
      this.watcher = watch(this.dir, { recursive: true }, (_event, name) => {
        const path = String(name ?? '').replaceAll('\\', '/');
        if (!path || IGNORED.has(path.split('/')[0]!) || /(^|\/)\.|~$|\.swp$/.test(path)) return;
        this.trigger();
      });
      // Without filesystem events, fall back to polling every second.
      this.watcher.on('error', () => { this.watcher?.close(); this.watcher = undefined; this.poll(1000); });
      watching = true;
    } catch { /* Polling still works when recursive watching is unavailable. */ }
    void this.scan().then(fingerprint => { if (!this.stopped) this.fingerprint = fingerprint; });
    // Events catch edits at once; the slow poll only covers events the platform drops.
    this.poll(watching ? 10_000 : 1000);
  }

  private poll(ms: number) {
    clearInterval(this.poller);
    if (this.stopped) return;
    this.poller = setInterval(() => {
      if (this.scanning) return;
      this.scanning = true;
      void this.scan().then(fingerprint => {
        if (!this.stopped && fingerprint !== this.fingerprint) { this.fingerprint = fingerprint; this.trigger(); }
      }).catch(() => {}).finally(() => { this.scanning = false; });
    }, ms);
    this.poller.unref();
  }

  close() {
    this.stopped = true;
    this.watcher?.close();
    clearInterval(this.poller);
    clearTimeout(this.debounce);
  }
}
