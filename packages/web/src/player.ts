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
/** Music fade at presentation stops, in seconds. */
const STOP_FADE = 0.6;
const RESUME_FADE = 0.25;
/** Where scene builds and project files come from. The editor uses the live server; a presentation file embeds them. */
export interface PlayerSources {
  sceneUrl(version: string): string;
  assetBase: string;
  assetUrls?: Record<string, string> | undefined;
}
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
  load(version: string, project: SceneProject, params: ParameterValues) {
    this.params = params;
    const request = ++this.loadRequest;
    const task = async () => {
      if (this.disposed || request !== this.loadRequest) return;
      // Version, seed, fonts and the beat grid feed the runtime; anything else (volume, render settings) is applied in place.
      const key = sceneRuntimeKey(version, project);
      if (key === this.loadedKey) { this.project = project; this.syncAudio(project); return; }
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
      // The previous version stops drawing now; its last frame stays under the new one until the fade ends.
      const previous = this.stage;
      this.runtime?.dispose();
      this.runtime = runtime; this.canvas = canvas; this.stage = stage; this.version = version; this.project = project; this.loadedKey = key;
      void stage.show().then(() => previous?.remove());
      this.t = Math.min(this.t, runtime.meta.duration);
      this.syncAudio(project);
      if (this.playing) this.restartClock();
      this.error = '';
      this.draw();
      if (this.resumeAfterError && !this.error) { this.resumeAfterError = false; this.play(); }
      this.notify();
    };
    const run = this.loading.then(task, task);
    this.loading = run.catch(() => {});
    // A failure of a load that a newer one replaced (a project switched mid-load) is not reported.
    return run.catch(error => { if (request === this.loadRequest) throw error; });
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
    const src = !path ? '' : this.sources.assetUrls?.[path] ?? `${this.sources.assetBase}${path.split('/').map(encodeURIComponent).join('/')}`;
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
  dispose() { this.disposed = true; this.loadRequest++; this.pause(); this.runtime?.dispose(); for (const frame of this.container.querySelectorAll('iframe.stage-frame')) frame.remove(); this.audio.dispose(); this.listeners.clear(); }
}
