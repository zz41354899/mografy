// Playback engine, independent of React: owns the canvas, the scene runtime and the clock.
// The scene only ever receives t. While music plays, the audio clock advances t;
// otherwise the browser clock does.
import { createSceneRuntime, renderOutputFrame } from '@mografy/runtime';
import type { SceneModule, SceneRuntime } from '@mografy/runtime';
import type { ParameterValues, SceneProject } from '@mografy/core';
import { AudioTrack } from './audio.js';
import type { SoundState } from './audio.js';

export interface PlayerView { t: number; playing: boolean; loop: boolean; version: string | null; duration: number; fps: number; finished: boolean; sound: SoundState }
type Listener = (view: PlayerView) => void;

export class ScenePlayer {
  private runtime: SceneRuntime | null = null;
  private canvas: HTMLCanvasElement | null = null;
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
  error = '';

  constructor(private container: HTMLElement) {
    this.audio.onChange = () => {
      // Sound became available mid-play (unlocked or decoded): join in at the current time.
      if (this.playing && this.audio.now() === undefined && this.audio.start(this.t)) this.restartClock();
      this.notify();
    };
  }

  get duration() { return this.runtime?.meta.duration ?? 0; }
  get fps() { return this.runtime?.meta.fps ?? 30; }
  view(): PlayerView { return { t: this.t, playing: this.playing, loop: this.loop, version: this.version, duration: this.duration, fps: this.fps, finished: !this.loop && this.t >= this.duration, sound: this.audio.state }; }
  subscribe(listener: Listener) { this.listeners.add(listener); listener(this.view()); return () => { this.listeners.delete(listener); }; }
  private notify() { const v = this.view(); for (const l of this.listeners) l(v); }

  /**
   * Load a published version into a fresh canvas; swap only once setup is done,
   * so the old version keeps playing until the new one is ready. t is kept.
   */
  load(version: string, project: SceneProject, params: ParameterValues) {
    const task = async () => {
      // Version, seed, fonts and the beat grid feed the runtime; anything else (volume, render settings) is applied in place.
      const key = JSON.stringify([version, project.seed, project.fonts, project.audio && [project.audio.path, project.audio.bpm, project.audio.offset, project.audio.beatsPerBar]]);
      if (key === this.loadedKey) { this.project = project; this.syncAudio(project); return; }
      const url = '/__mografy/scene/' + version + '.js';
      const scene = await import(url) as SceneModule;
      const width = scene.meta?.width ?? 1920;
      const scale = Math.min(1, Math.max(0.25, Math.round(((this.container.clientWidth || 960) * Math.min(2, window.devicePixelRatio || 1)) / width * 4) / 4));
      const canvas = document.createElement('canvas');
      canvas.className = 'stage-canvas';
      const runtime = await createSceneRuntime(canvas, scene, {
        seed: project.seed, renderScale: scale, params, assetBase: '/__mografy/files/', fonts: project.fonts, audio: project.audio,
      });
      this.runtime?.dispose(); this.canvas?.remove();
      this.runtime = runtime; this.canvas = canvas; this.version = version; this.project = project; this.params = params; this.loadedKey = key;
      this.container.append(canvas);
      this.t = Math.min(this.t, runtime.meta.duration);
      this.syncAudio(project);
      if (this.playing) this.restartClock();
      this.error = '';
      this.draw(); this.notify();
    };
    this.loading = this.loading.then(task, task);
    return this.loading;
  }

  setParams(params: ParameterValues) {
    this.params = params;
    if (!this.playing) this.draw();
  }

  /** Effects use the export pipeline on paused frames; playback keeps its responsive scene preview. */
  setEffects(effects: { glow: number; grain: number }, preview: boolean) {
    const changed = effects.glow !== this.effects.glow || effects.grain !== this.effects.grain || preview !== this.previewEffects;
    this.effects = effects; this.previewEffects = preview;
    if (changed && !this.playing) this.draw();
  }

  private syncAudio(project: SceneProject) {
    const src = project.audio ? `/__mografy/files/${project.audio.path.split('/').map(encodeURIComponent).join('/')}` : '';
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
        const output = renderOutputFrame(runtime, canvas, k, settings, this.project.seed, this.params);
        const context = canvas.getContext('2d')!;
        const image = context.createImageData(canvas.width, canvas.height); image.data.set(output);
        context.putImageData(image, 0, 0);
      } else runtime.render(t, this.params);
      this.error = '';
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.pause();
    }
  }

  private restartClock() { this.startedAt = performance.now(); this.startT = this.t; }
  private tick = (now: number) => {
    if (!this.playing) return;
    const d = this.duration;
    let t = this.audio.now() ?? this.startT + (now - this.startedAt) / 1000;
    if (t >= d) {
      if (this.loop && d > 0) { t = t % d; this.t = t; this.restartClock(); this.audio.start(t); }
      else { this.t = d; this.playing = false; this.audio.stop(); this.draw(); this.notify(); return; }
    }
    this.t = t;
    this.draw(); this.notify();
    this.frame = requestAnimationFrame(this.tick);
  };

  play() {
    if (this.playing || !this.runtime) return;
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
  dispose() { this.pause(); this.runtime?.dispose(); this.canvas?.remove(); this.audio.dispose(); this.listeners.clear(); }
}
