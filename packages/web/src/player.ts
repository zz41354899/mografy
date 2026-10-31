// Playback engine, independent of React: owns the scene frame, the scene runtime and the clock.
// The scene only ever receives t. While music plays, the audio clock advances t;
// otherwise the browser clock does.
import { createSceneRuntime, renderOutputFrame } from '@mografy/runtime';
import { sceneRuntimeKey } from '@mografy/core';
import type { SceneRuntime } from '@mografy/runtime';
import type { ParameterValues, SceneProject } from '@mografy/core';
import { AudioTrack } from './audio.js';
import { openSceneFrame } from './scene-frame.js';
import type { SceneFrame } from './scene-frame.js';
import type { SoundState } from './audio.js';

export interface PlayerView { t: number; playing: boolean; loop: boolean; version: string | null; duration: number; fps: number; finished: boolean; sound: SoundState; error?: string }
type Listener = (view: PlayerView) => void;
const SETUP_TIMEOUT = 30_000;
/** Projects kept loaded after switching away (each keeps its iframe and, for 3D scenes, a WebGL context). */
const KEEP_LOADED = 2;
interface Loaded { runtime: SceneRuntime; canvas: HTMLCanvasElement; stage: SceneFrame; version: string; project: SceneProject; key: string; dir: string }
/** Music fade at presentation stops, in seconds. */
const STOP_FADE = 0.6;
const RESUME_FADE = 0.25;
/** Where scene builds and project files come from. The editor uses the live server; a presentation file embeds them. */
export interface PlayerSources {
  sceneUrl(version: string): string;
  assetBase: string;
  assetUrls?: Record<string, string> | undefined;
}
/** A short, stable tag for a project folder (keeps audio URLs and error messages readable). */
function projectTag(dir: string) { let h = 5381; for (let i = 0; i < dir.length; i++) h = (h * 33) ^ dir.charCodeAt(i); return (h >>> 0).toString(36); }
const SERVER: PlayerSources = { sceneUrl: version => '/__mografy/scene/' + version + '.js', assetBase: '/__mografy/files/' };
interface Segment { end: number; loopFrom: number | null; arrived: boolean; onArrive?: (() => void) | undefined }

export class ScenePlayer {
  private runtime: SceneRuntime | null = null;
  private canvas: HTMLCanvasElement | null = null;
  /** The iframe holding the current version; removing it frees that version's module. */
  private stage: SceneFrame | null = null;
  private params: ParameterValues = {};
  private project: SceneProject | null = null;
  private effects = { glow: 0, grain: 0 };
  private previewEffects = false;
  private listeners = new Set<Listener>();
  private frame = 0;
  private startedAt = 0;
  private startT = 0;
  private loading: Promise<void> = Promise.resolve();
  version: string | null = null;
  t = 0;
  playing = false;
  loop = true;
  readonly audio = new AudioTrack();
  /** The open project's folder; tags its audio URL so projects never share a decoded track. */
  private projectDir = '';
  /** The folder of the project the current runtime belongs to. */
  private loadedDir = '';
  /** Recently shown projects, hidden but still set up, newest last: switching back to one skips its whole setup. */
  private kept = new Map<string, Loaded>();
  /** The saved thumbnail of the project being opened, over the stage until its film appears. */
  private poster: HTMLImageElement | null = null;
  private loadedKey = '';
  private loadRequest = 0;
  private disposed = false;
  /** Playback stopped because renderFrame threw; resume once a working version loads. */
  private resumeAfterError = false;
  error = '';
  /** Presentation only: where playback stops (or starts replaying) instead of running to the end. */
  private segment: Segment | null = null;
  /** Presentation only: play pictures without starting music (holds, silent decks). */
  private silent = false;

  constructor(private container: HTMLElement, private sources: PlayerSources = SERVER) {
    this.audio.onChange = () => {
      // Sound became available mid-play (unlocked or decoded): join in at the current time.
      if (this.playing && !this.silent && this.audio.now() === undefined && this.audio.start(this.t)) this.restartClock();
      this.notify();
    };
  }

  get duration() { return this.runtime?.meta.duration ?? 0; }
  get fps() { return this.runtime?.meta.fps ?? 30; }
  view(): PlayerView { return { t: this.t, playing: this.playing, loop: this.loop, version: this.version, duration: this.duration, fps: this.fps, finished: !this.loop && this.t >= this.duration, sound: this.audio.state, error: this.error }; }
  subscribe(listener: Listener) { this.listeners.add(listener); listener(this.view()); return () => { this.listeners.delete(listener); }; }
  private notify() { const v = this.view(); for (const l of this.listeners) l(v); }

  /**
   * Load a published version into a fresh canvas; swap only once setup is done,
   * so the old version keeps playing until the new one is ready. t is kept.
   */
  load(version: string, project: SceneProject, params: ParameterValues, projectDir = '') {
    this.params = params; this.projectDir = projectDir;
    const request = ++this.loadRequest;
    const task = async () => {
      if (this.disposed || request !== this.loadRequest) return;
      // Version, seed, fonts and the beat grid feed the runtime; anything else (volume, render settings) is applied in place.
      const key = sceneRuntimeKey(version, project);
      if (key === this.loadedKey) { this.project = project; this.syncAudio(project); this.hidePoster(); return; }
      const keptKey = `${projectDir}\n${key}`, kept = this.kept.get(keptKey);
      if (kept) { this.kept.delete(keptKey); this.adopt({ ...kept, version, project }, true); return; }
      for (const [k, old] of this.kept) if (old.dir === projectDir) { this.kept.delete(k); old.runtime.dispose(); old.stage.remove(); }
      const stage = await openSceneFrame(this.container, this.sources.sceneUrl(version), 'stage-frame');
      if (this.disposed || request !== this.loadRequest) { stage.remove(); return; }
      const { scene, canvas } = stage;
      const width = project.aspectRatio === '9:16' ? Math.min(scene.meta.width, scene.meta.height) : scene.meta.width;
      const scale = Math.min(1, Math.max(0.25, Math.ceil(((this.container.clientWidth || 960) * Math.min(2, window.devicePixelRatio || 1)) / width * 4) / 4));
      const creating = createSceneRuntime(canvas, scene, {
        seed: project.seed, renderScale: scale, params, assetBase: this.sources.assetBase, assetUrls: this.sources.assetUrls, fonts: project.fonts, audio: project.audio,
        aspectRatio: project.aspectRatio,
        // The player never reads pixels back, so draw on the GPU: blurs, shadows and 3D layers stay smooth while playing.
        // Exports keep the default CPU canvas for identical output on every machine.
        canvas: 'gpu',
      });
      // A setup that never settles must not hold the load chain: later versions would never appear.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const runtime = await Promise.race([creating, new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          void creating.then(late => late.dispose(), () => {});
          reject(new Error(`Scene setup did not finish within ${SETUP_TIMEOUT / 1000}s in the player. Check setup() for an await that never resolves.`));
        }, SETUP_TIMEOUT);
      })]).finally(() => clearTimeout(timer)).catch(error => { stage.remove(); throw error; });
      if (this.disposed || request !== this.loadRequest) { runtime.dispose(); stage.remove(); return; }
      this.adopt({ runtime, canvas, stage, version, project, key, dir: projectDir }, false);
    };
    const run = this.loading.then(task, task);
    this.loading = run.catch(() => {});
    // A failure of a load that a newer one replaced (a project switched mid-load) is not reported.
    return run.catch(error => { if (request === this.loadRequest) throw error; });
  }

  /**
   * Make a loaded runtime current. The previous one is kept (hidden) when it belongs to another project, so
   * switching back is instant; a previous version of the same project is disposed as before.
   */
  private adopt(next: Loaded, restored: boolean) {
    const previous: Loaded | null = this.runtime && this.stage && this.canvas && this.version && this.project
      ? { runtime: this.runtime, canvas: this.canvas, stage: this.stage, version: this.version, project: this.project, key: this.loadedKey, dir: this.loadedDir } : null;
    const keep = !!previous && !!previous.dir && previous.dir !== next.dir;
    // The previous version stops drawing now; its last frame stays under the new one until the fade ends.
    if (previous && !keep) previous.runtime.dispose();
    this.runtime = next.runtime; this.canvas = next.canvas; this.stage = next.stage; this.version = next.version; this.project = next.project;
    this.loadedKey = next.key; this.loadedDir = next.dir;
    // A kept frame sits under newer ones in the DOM (moving an iframe would reload it), so hide what covers it first.
    if (restored) for (const frame of this.container.querySelectorAll<HTMLIFrameElement>('iframe.stage-frame')) if (frame !== next.stage.frame) frame.style.visibility = 'hidden';
    this.hidePoster();
    void next.stage.show().then(() => {
      if (!previous) return;
      if (keep) { previous.stage.frame.style.visibility = 'hidden'; this.keepLoaded(previous); }
      else previous.stage.remove();
    });
    this.t = Math.min(this.t, next.runtime.meta.duration);
    this.syncAudio(next.project);
    if (this.playing) this.restartClock();
    this.error = '';
    this.draw();
    if (this.resumeAfterError && !this.error) { this.resumeAfterError = false; this.play(); }
    this.notify();
  }
  private keepLoaded(loaded: Loaded) {
    if (this.disposed) { loaded.runtime.dispose(); loaded.stage.remove(); return; }
    this.kept.set(`${loaded.dir}\n${loaded.key}`, loaded);
    while (this.kept.size > KEEP_LOADED) {
      const [k, old] = this.kept.entries().next().value!;
      this.kept.delete(k); old.runtime.dispose(); old.stage.remove();
    }
  }

  /** While a project opens, show its saved thumbnail over the stage instead of the previous film. */
  showPoster(url: string) {
    this.hidePoster(true);
    const img = document.createElement('img');
    img.className = 'stage-poster'; img.alt = ''; img.decoding = 'async';
    img.onerror = () => img.removeAttribute('src');   // no thumbnail yet: the poster stays a plain background
    img.src = url;
    this.container.append(img); this.poster = img;
  }
  hidePoster(now = false) {
    const img = this.poster; if (!img) return;
    this.poster = null;
    if (now || matchMedia('(prefers-reduced-motion: reduce)').matches) { img.remove(); return; }
    void img.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-out' }).finished.catch(() => {}).then(() => img.remove());
  }

  setParams(params: ParameterValues) {
    this.params = params;
    if (!this.playing) { this.draw(); this.notify(); }
  }

  /** Effects use the export pipeline on paused frames; playback keeps its responsive scene preview. */
  setEffects(effects: { glow: number; grain: number }, preview: boolean) {
    const changed = effects.glow !== this.effects.glow || effects.grain !== this.effects.grain || preview !== this.previewEffects;
    this.effects = effects; this.previewEffects = preview;
    if (changed && !this.playing) { this.draw(); this.notify(); }
  }

  private syncAudio(project: SceneProject) {
    const path = project.audio?.path;
    // Every project's files come from the same /__mografy/files/ route, so two projects with the same audio path
    // (assets/narration.mp3) would share one URL and the track would keep the first project's decoded sound.
    // Tag server URLs with the project; the server reads only the path, so the file it sends is unchanged.
    const mapped = path ? this.sources.assetUrls?.[path] : undefined;
    const tag = this.projectDir ? `?project=${projectTag(this.projectDir)}` : '';
    const src = !path ? '' : mapped ?? `${this.sources.assetBase}${path.split('/').map(encodeURIComponent).join('/')}${tag}`;
    void this.audio.load(src, project.audio?.gain ?? 1);
  }
  /** Browsers allow sound only after a click or key press; call this from one. */
  async enableSound() { await this.audio.unlock(); }
  setMuted(muted: boolean) { this.audio.setMuted(muted); }

  draw() {
    const runtime = this.runtime, canvas = this.canvas;
    if (!runtime || !canvas) return;
    try {
      const t = Math.min(Math.max(0, this.t), runtime.meta.duration);
      if (this.previewEffects && !this.playing && this.project) {
        const settings = { ...this.project.render, ...this.effects };
        const k = Math.min(Math.ceil(runtime.meta.duration * settings.fps) - 1, Math.round(t * settings.fps));
        const output = renderOutputFrame(runtime, canvas, k, settings, this.project.seed, this.valuesFor(runtime));
        const context = canvas.getContext('2d')!;
        const image = context.createImageData(canvas.width, canvas.height); image.data.set(output);
        context.putImageData(image, 0, 0);
      } else runtime.render(t, this.valuesFor(runtime));
      this.error = '';
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      const wasPlaying = this.playing;
      this.pause();
      if (wasPlaying) this.resumeAfterError = true;
    }
  }

  /**
   * Values arrive for the version being loaded while the previous one is still on screen (switching
   * projects, or a scene that renamed a parameter). Draw it with only the values it declares.
   */
  private valuesFor(runtime: SceneRuntime) {
    return Object.fromEntries(Object.entries(this.params).filter(([id]) => id in runtime.definitions));
  }

  private restartClock() { this.startedAt = performance.now(); this.startT = this.t; }
  private tick = (now: number) => {
    if (!this.playing) return;
    const d = this.duration;
    let t = this.audio.now() ?? this.startT + (now - this.startedAt) / 1000;
    const segment = this.segment;
    if (segment && t >= segment.end) {
      const arriving = !segment.arrived;
      segment.arrived = true;
      this.audio.fadeOut(STOP_FADE);
      if (segment.loopFrom === null) {
        this.t = segment.end; this.playing = false; this.draw(); this.notify();
        if (arriving) segment.onArrive?.();
        return;
      }
      this.silent = true;
      t = segment.loopFrom + (t - segment.end) % (segment.end - segment.loopFrom);
      this.startT = t; this.startedAt = now;
      if (arriving) segment.onArrive?.();
    } else if (t >= d) {
      if (this.loop && d > 0) { t = t % d; this.t = t; this.restartClock(); this.audio.start(t); }
      else { this.t = d; this.playing = false; this.audio.stop(); this.draw(); this.notify(); return; }
    }
    this.t = t;
    this.draw(); this.notify();
    this.frame = requestAnimationFrame(this.tick);
  };

  play() {
    this.resumeAfterError = false;
    if (this.playing || !this.runtime) return;
    // Plain playback ends a presentation segment (the editor previews slides with playTo).
    this.segment = null; this.silent = false;
    if (!this.loop && this.t >= this.duration) this.t = 0;
    this.playing = true; this.restartClock();
    this.audio.start(this.t);
    this.frame = requestAnimationFrame(this.tick);
    this.notify();
  }
  pause() {
    if (!this.playing) return;
    this.playing = false; cancelAnimationFrame(this.frame);
    this.audio.stop();
    this.draw(); this.notify();
  }
  /** Presentation: play from `from` to the stop at `end`, then hold there (freeze, or replay from loopFrom). */
  playTo(from: number, end: number, loopFrom: number | null, sound: boolean, onArrive?: () => void) {
    if (!this.runtime) return;
    cancelAnimationFrame(this.frame); this.audio.fadeOut(RESUME_FADE);
    this.resumeAfterError = false;
    this.segment = { end, loopFrom, arrived: false, onArrive };
    this.silent = !sound;
    this.t = Math.min(Math.max(0, from), end);
    this.playing = true; this.restartClock();
    if (sound) this.audio.start(this.t, RESUME_FADE);
    this.frame = requestAnimationFrame(this.tick);
    this.notify();
  }
  /** Presentation: show the stop at `at` straight away, held the same way playTo would hold it. */
  holdAt(at: number, loopFrom: number | null) {
    if (!this.runtime) return;
    cancelAnimationFrame(this.frame); this.audio.fadeOut(STOP_FADE);
    this.segment = { end: at, loopFrom, arrived: true };
    this.silent = true;
    if (loopFrom === null) { this.playing = false; this.t = at; this.draw(); this.notify(); return; }
    this.t = loopFrom; this.playing = true; this.restartClock();
    this.frame = requestAnimationFrame(this.tick);
    this.notify();
  }
  toggle() { if (this.playing) this.pause(); else this.play(); }
  seek(t: number) {
    this.t = Math.min(Math.max(0, t), this.duration || t);
    if (this.playing) { this.restartClock(); this.audio.start(this.t); }
    this.draw(); this.notify();
  }
  step(frames: number) {
    this.pause();
    const fps = this.fps, index = Math.round(this.t * fps) + frames;
    this.seek(Math.min(Math.max(0, index), Math.ceil(this.duration * fps) - 1) / fps);
  }
  setLoop(loop: boolean) { this.loop = loop; this.notify(); }
  dispose() { this.disposed = true; this.loadRequest++; this.pause(); this.runtime?.dispose(); for (const kept of this.kept.values()) kept.runtime.dispose(); this.kept.clear(); this.hidePoster(true); for (const frame of this.container.querySelectorAll('iframe.stage-frame')) frame.remove(); this.audio.dispose(); this.listeners.clear(); }
}
