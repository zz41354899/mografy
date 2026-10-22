// Project music through Web Audio. The whole file is decoded up front, so starting at any
// time is exact, and while it plays the audio clock drives the picture (no drift, no seeking).
export type SoundState = 'none' | 'loading' | 'locked' | 'on' | 'muted' | 'error';

export class AudioTrack {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  /** Per-source gain, so a fading source never touches the next one. */
  private fade: GainNode | null = null;
  private src = '';
  private startedCtx = 0;
  private startedT = 0;
  private volume = 1;
  buffer: AudioBuffer | null = null;
  muted = false;
  state: SoundState = 'none';
  error = '';
  onChange: () => void = () => {};

  private context() {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      this.gain = this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
      this.ctx.onstatechange = () => this.refresh();
    }
    return this.ctx;
  }
  private refresh() {
    const next: SoundState = !this.src ? 'none' : this.error ? 'error' : !this.buffer ? 'loading'
      : this.ctx?.state !== 'running' ? 'locked' : this.muted ? 'muted' : 'on';
    if (next !== this.state) { this.state = next; this.onChange(); }
  }
  private applyGain() { if (this.gain) this.gain.gain.value = this.muted ? 0 : Math.min(4, Math.max(0, this.volume)); }

  /** Load (or clear, with '') the project's audio file. Resolves when decoded. */
  async load(src: string, volume = 1) {
    this.volume = volume; this.applyGain();
    if (src === this.src) return;
    this.stop(); this.src = src; this.buffer = null; this.error = ''; this.refresh();
    if (!src) return;
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`Could not load ${decodeURIComponent(src.split('/').pop() ?? src)} (${response.status})`);
      const buffer = await this.context().decodeAudioData(await response.arrayBuffer());
      if (src !== this.src) return;
      this.buffer = buffer;
    } catch (error) {
      if (src !== this.src) return;
      const name = decodeURIComponent(src.split('/').pop() ?? src);
      this.error = error instanceof DOMException && error.name === 'EncodingError'
        ? `This browser cannot decode ${name}. Use an MP3 or WAV file.`
        : error instanceof Error ? error.message : String(error);
    }
    this.refresh();
  }

  /** Browsers only allow sound after a click or key press. */
  async unlock() {
    const ctx = this.context();
    if (ctx.state !== 'running') await ctx.resume().catch(() => {});
    this.refresh();
    return ctx.state === 'running';
  }
  setMuted(muted: boolean) { this.muted = muted; this.applyGain(); this.refresh(); }

  /** Start playing at scene time t, optionally fading in. Returns false when sound cannot play yet. */
  start(t: number, fadeIn = 0) {
    this.stop();
    const ctx = this.ctx, buffer = this.buffer;
    if (!ctx || !buffer || ctx.state !== 'running') return false;
    const source = ctx.createBufferSource(), fade = ctx.createGain();
    source.buffer = buffer; source.connect(fade); fade.connect(this.gain!);
    const at = ctx.currentTime + 0.01;
    if (fadeIn > 0) { fade.gain.setValueAtTime(0, at); fade.gain.linearRampToValueAtTime(1, at + fadeIn); }
    if (t < buffer.duration) source.start(at, Math.max(0, t));
    this.source = source; this.fade = fade; this.startedCtx = at; this.startedT = t;
    return true;
  }
  stop() {
    if (!this.source) return;
    try { this.source.stop(); } catch { /* not started */ }
    this.source.disconnect(); this.fade?.disconnect(); this.source = null; this.fade = null;
  }
  /** Let the current source fade out on its own; the track stops driving the clock at once. */
  fadeOut(seconds: number) {
    const source = this.source, fade = this.fade, ctx = this.ctx;
    if (!source || !fade || !ctx) { this.stop(); return; }
    this.source = null; this.fade = null;
    const now = ctx.currentTime;
    fade.gain.cancelScheduledValues(now); fade.gain.setValueAtTime(fade.gain.value, now); fade.gain.linearRampToValueAtTime(0, now + seconds);
    source.onended = () => { source.disconnect(); fade.disconnect(); };
    try { source.stop(now + seconds + 0.02); } catch { source.disconnect(); fade.disconnect(); }
  }
  /** Scene time by the audio clock while playing, otherwise undefined. */
  now() {
    if (!this.source || !this.ctx) return undefined;
    return this.startedT + Math.max(0, this.ctx.currentTime - this.startedCtx);
  }
  /** Peak per bucket, for the timeline waveform. */
  peaks(buckets: number, duration: number) {
    const buffer = this.buffer; if (!buffer) return null;
    const data = buffer.getChannelData(0), out = new Float32Array(buckets);
    for (let i = 0; i < buckets; i++) {
      const a = Math.floor((i / buckets) * duration * buffer.sampleRate), b = Math.min(data.length, Math.floor(((i + 1) / buckets) * duration * buffer.sampleRate));
      let peak = 0; for (let k = a; k < b; k += 8) peak = Math.max(peak, Math.abs(data[k] ?? 0));
      out[i] = peak;
    }
    return out;
  }
  dispose() { this.stop(); void this.ctx?.close(); this.ctx = null; }
}
