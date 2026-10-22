// Presentation flow over a ScenePlayer: play into a slide, hold at its stop, wait for the presenter.
// The scene never knows; it still only receives t.
import type { DeckSlide } from '@mografy/core';

export interface DeckPlayer {
  playTo(from: number, end: number, loopFrom: number | null, sound: boolean, onArrive?: () => void): void;
  holdAt(at: number, loopFrom: number | null): void;
  seek(t: number): void;
  pause(): void;
}
/** ready: before the first slide plays. moving: the transition into `index` is playing. holding: `index` is on screen. */
export type DeckPhase = 'ready' | 'moving' | 'holding';
export interface DeckState { index: number; phase: DeckPhase }

export class Presentation {
  state: DeckState = { index: 0, phase: 'ready' };
  /** Bumped per move, so a late arrival from an interrupted move is ignored. */
  private move = 0;

  constructor(private player: DeckPlayer, private slides: DeckSlide[], private sound: boolean, private onChange: (state: DeckState) => void = () => {}) {}

  get count() { return this.slides.length; }
  get current() { return this.slides[this.state.index]; }
  get upcoming() { return this.state.phase === 'holding' ? this.slides[this.state.index + 1] : this.current; }

  /** Swap in new slides or music settings (the project changed); keep the place where possible. */
  update(slides: DeckSlide[], sound: boolean) {
    this.slides = slides; this.sound = sound;
    if (!slides.length) { this.restart(); return; }
    if (this.state.index >= slides.length) this.goTo(slides.length - 1);
    else if (this.state.phase === 'holding') this.goTo(this.state.index);
  }

  restart() {
    this.move++;
    this.player.pause(); this.player.seek(0);
    this.set({ index: 0, phase: 'ready' });
  }

  next() {
    const { index, phase } = this.state;
    if (!this.slides.length) return;
    if (phase === 'ready') this.play(index);
    else if (phase === 'moving') this.goTo(index);
    else if (index < this.slides.length - 1) this.play(index + 1);
  }

  previous() {
    const { index, phase } = this.state;
    if (index > 0) this.goTo(index - 1);
    else if (phase !== 'ready') this.restart();
  }

  /** Jump straight to a slide's stop, without its transition. */
  goTo(index: number) {
    const slide = this.slides[Math.min(Math.max(0, index), this.slides.length - 1)];
    if (!slide) return;
    this.move++;
    this.player.holdAt(slide.at, slide.loopFrom);
    this.set({ index: slide.index, phase: 'holding' });
  }

  private play(index: number) {
    const slide = this.slides[index];
    if (!slide) return;
    const move = ++this.move;
    this.set({ index, phase: 'moving' });
    this.player.playTo(slide.start, slide.at, slide.loopFrom, this.sound, () => {
      if (move === this.move) this.set({ index, phase: 'holding' });
    });
  }

  private set(state: DeckState) { this.state = state; this.onChange(state); }
}
