// The presentation itself, without React: the audience view in a root element and a speaker
// window it writes into. The editor's presentation window and exported presentation files
// both run this, so a file presents exactly like the editor does.
import { deckSlides } from '@mografy/core';
import type { DeckSlide, ParameterValues, SceneMeta, SceneProject } from '@mografy/core';
import { ScenePlayer } from '../player.js';
import type { PlayerSources } from '../player.js';
import { Presentation } from '../presentation.js';
import type { DeckPhase, DeckState } from '../presentation.js';

export interface DeckSource {
  version: string; project: SceneProject; values: ParameterValues;
  meta: SceneMeta;
}
export interface DeckOptions {
  sources?: PlayerSources | undefined;
  /** The editor's window follows live edits and can lock a version; a file has nothing to follow. */
  live?: boolean;
  /** Leave the presentation (Esc or the back button); a file has nowhere to go back to. */
  onBack?: (() => void) | undefined;
}

const PHASE: Record<DeckPhase, string> = { ready: 'Ready to start', moving: 'Playing transition', holding: 'On this slide' };
const NEXT_KEYS = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'];
const PREVIOUS_KEYS = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'];

/** Without slides in mografy.json the whole scene is one slide. */
export function slidesOf(source: DeckSource): DeckSlide[] {
  return deckSlides(source.meta, source.project.slides);
}

// Phosphor-style 24px line icons, inlined: the file presents offline and without React.
const ICONS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  previous: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  play: '<path d="M8 5.5v13a.6.6 0 0 0 .9.5l10.4-6.5a.6.6 0 0 0 0-1L8.9 5a.6.6 0 0 0-.9.5z" fill="currentColor" stroke="none"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  muted: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  speaker: '<rect x="3.5" y="4.5" width="17" height="12" rx="1.5"/><path d="M8 20h8M12 16.5V20M7.5 8.5h9M7.5 12h5"/>',
  fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
} as const;

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className = '', text = '') {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function iconButton(doc: Document, icon: keyof typeof ICONS, label: string, action: () => void, className = '') {
  const button = el(doc, 'button', `deck-button ${className}`.trim());
  button.type = 'button'; button.title = label; button.setAttribute('aria-label', label);
  button.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[icon]}</svg>`;
  button.addEventListener('click', event => { event.stopPropagation(); action(); });
  return button;
}

export class DeckApp {
  private readonly player: ScenePlayer;
  private readonly deck: Presentation;
  private readonly stage: HTMLDivElement;
  private readonly black: HTMLDivElement;
  private readonly wait: HTMLDivElement;
  // The chrome around the slide: a top bar, the playback menu and slide progress at the bottom.
  // It fades out while the mouse rests, so the audience sees only the slide.
  private readonly top: HTMLElement;
  private readonly heading: HTMLDivElement;
  private readonly lock: HTMLButtonElement;
  private readonly bottom: HTMLElement;
  private readonly progress: HTMLOListElement;
  private readonly playButton: HTMLButtonElement;
  private readonly muteButton: HTMLButtonElement;
  private readonly hint: HTMLDivElement;
  private muted = false;
  private slides: DeckSlide[] = [];
  private shown: DeckSource | null = null;
  private latest: DeckSource | null = null;
  private locked = false;
  private started = false;
  private startedAt: number | null = null;
  private typed = '';
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private presenter: Window | null = null;
  private presenterTimer: ReturnType<typeof setInterval> | undefined;
  private loading: Promise<void> = Promise.resolve();
  private readonly live: boolean;
  private readonly onBack: (() => void) | undefined;

  constructor(private readonly root: HTMLElement, options: DeckOptions = {}) {
    this.live = options.live ?? false;
    this.onBack = options.onBack;
    const doc = root.ownerDocument;
    root.classList.add('deck-root');
    this.stage = el(doc, 'div', 'deck-stage');
    this.stage.dataset.testid = 'present-stage';
    this.black = el(doc, 'div', 'deck-black deck-hidden');
    this.wait = el(doc, 'div', 'deck-wait', 'Loading the presentation…');

    this.top = el(doc, 'header', 'deck-top');
    this.heading = el(doc, 'div', 'deck-heading'); this.heading.setAttribute('role', 'status');
    this.lock = el(doc, 'button', `deck-lock${this.live ? '' : ' deck-hidden'}`, 'Live');
    this.lock.type = 'button'; this.lock.title = 'Lock this version while you keep editing (K)';
    this.lock.addEventListener('click', event => { event.stopPropagation(); this.toggleLock(); });
    const tools = el(doc, 'div', 'deck-tools');
    tools.append(this.lock, iconButton(doc, 'speaker', 'Speaker view (P)', () => this.openPresenter()), iconButton(doc, 'fullscreen', 'Full screen (F)', () => this.toggleFullscreen()));
    if (this.onBack) { const back = iconButton(doc, 'back', 'Back to the editor (Esc)', () => this.back(), 'deck-back'); back.append('Editor'); this.top.append(back); }
    this.top.append(this.heading, tools);

    this.bottom = el(doc, 'footer', 'deck-bottom');
    const menu = el(doc, 'div', 'deck-menu'); menu.setAttribute('role', 'toolbar'); menu.setAttribute('aria-label', 'Presentation');
    this.playButton = iconButton(doc, 'play', 'Next (→ or Space)', () => this.next(), 'deck-play');
    this.muteButton = iconButton(doc, 'sound', 'Mute', () => this.toggleMute(), 'deck-mute');
    menu.append(iconButton(doc, 'previous', 'Previous (←)', () => this.previous()), this.playButton, iconButton(doc, 'next', 'Next slide (→)', () => this.next()), this.muteButton);
    this.progress = el(doc, 'ol', 'deck-progress'); this.progress.setAttribute('aria-label', 'Slides');
    this.hint = el(doc, 'div', 'deck-hint deck-hidden', 'Press → or click to start · P speaker view · F full screen');
    this.bottom.append(this.hint, menu, this.progress);
    for (const part of [this.top, this.bottom]) part.addEventListener('click', event => event.stopPropagation());
    root.append(this.stage, this.black, this.wait, this.top, this.bottom);

    this.player = new ScenePlayer(this.stage, options.sources);
    this.player.setLoop(false);
    this.deck = new Presentation(this.player, [], true, state => this.changed(state));
    this.stage.addEventListener('click', this.onClick);
    this.black.addEventListener('click', this.onClick);
    doc.addEventListener('keydown', this.onKey);
    root.addEventListener('pointermove', this.onPointer);
    doc.addEventListener('pointerdown', this.unlock);
    doc.addEventListener('keydown', this.unlock);
    doc.defaultView?.addEventListener('beforeunload', this.closePresenter);
    this.render();
  }

  /** The project to present. While locked, newer versions wait until unlocked. */
  setSource(source: DeckSource | null) {
    this.latest = source;
    if (!source) { this.wait.textContent = 'The scene has an error. Fix it in the editor.'; this.wait.classList.remove('deck-hidden'); return; }
    if (!this.locked || !this.shown) this.show(source);
    else this.render();
  }

  setError(message: string) { this.wait.textContent = message; this.wait.classList.remove('deck-hidden'); }

  dispose() {
    const doc = this.root.ownerDocument;
    doc.removeEventListener('keydown', this.onKey);
    doc.removeEventListener('pointerdown', this.unlock);
    doc.removeEventListener('keydown', this.unlock);
    doc.defaultView?.removeEventListener('beforeunload', this.closePresenter);
    clearTimeout(this.idleTimer);
    this.closePresenter();
    this.player.dispose();
    this.root.replaceChildren();
    this.root.classList.remove('deck-root', 'idle');
  }

  private show(source: DeckSource) {
    const ratio = `${source.meta.width} / ${source.meta.height}`;
    this.stage.style.setProperty('--ratio', ratio);
    this.stage.style.setProperty('--aspect', String(source.meta.width / source.meta.height));
    this.stage.style.setProperty('--scene-bg', source.meta.background);
    this.shown = source;
    this.slides = slidesOf(source);
    const sound = source.project.slides?.music !== 'off', slides = this.slides;
    const task = async () => {
      if (this.shown !== source) return;
      try { await this.player.load(source.version, source.project, source.values); }
      catch (error) { this.setError(error instanceof Error ? error.message : String(error)); return; }
      if (this.shown !== source) return;
      this.wait.classList.add('deck-hidden');
      this.deck.update(slides, sound);
      if (!this.started) { this.started = true; this.deck.restart(); }
      this.render();
    };
    this.loading = this.loading.then(task, task);
  }

  private changed(state: DeckState) {
    if (state.phase !== 'ready' && this.startedAt === null) this.startedAt = Date.now();
    if (state.phase === 'ready' && state.index === 0) this.startedAt = null;
    this.render();
  }

  private next() { this.black.classList.add('deck-hidden'); this.deck.next(); }
  private previous() { this.black.classList.add('deck-hidden'); this.deck.previous(); }

  private onClick = () => { void this.player.enableSound(); this.next(); };
  private unlock = () => { void this.player.enableSound(); };
  private onPointer = () => {
    this.root.classList.remove('idle');
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.root.classList.add('idle'), 2500);
  };
  private back() { this.closePresenter(); this.onBack?.(); }
  private toggleMute() {
    this.muted = !this.muted;
    void this.player.enableSound();
    this.player.setMuted(this.muted);
    this.render();
  }

  private onKey = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;
    if (/^\d$/.test(key)) { this.typed = (this.typed + key).slice(-3); this.onPointer(); this.render(); return; }
    if (key === 'Enter' && this.typed) { event.preventDefault(); this.deck.goTo(Number(this.typed) - 1); this.typed = ''; this.render(); return; }
    if (this.typed) { this.typed = ''; this.render(); }
    if (NEXT_KEYS.includes(key)) { event.preventDefault(); this.next(); }
    else if (PREVIOUS_KEYS.includes(key)) { event.preventDefault(); this.previous(); }
    else if (key === 'Home') { event.preventDefault(); this.deck.restart(); }
    else if (key === 'End') { event.preventDefault(); this.deck.goTo(this.deck.count - 1); }
    else if (key === 'b' || key === 'B' || key === '.') this.black.classList.toggle('deck-hidden');
    else if (key === 'f' || key === 'F') this.toggleFullscreen();
    else if (key === 'p' || key === 'P') this.openPresenter();
    else if (key === 'm' || key === 'M') this.toggleMute();
    else if ((key === 'k' || key === 'K') && this.live) this.toggleLock();
    else if (key === 'Escape' && this.onBack && !this.root.ownerDocument.fullscreenElement) this.back();
  };

  private toggleFullscreen() {
    const doc = this.root.ownerDocument;
    if (doc.fullscreenElement) void doc.exitFullscreen(); else void doc.documentElement.requestFullscreen().catch(() => {});
  }

  private toggleLock() {
    this.locked = !this.locked;
    if (!this.locked && this.latest && this.latest !== this.shown) this.show(this.latest);
    this.render();
  }

  private render() {
    const doc = this.root.ownerDocument, { index, phase } = this.deck.state, slide = this.slides[index];
    this.stage.dataset.phase = phase; this.stage.dataset.index = String(index);
    this.root.classList.toggle('deck-ready', phase === 'ready');
    this.hint.classList.toggle('deck-hidden', phase !== 'ready' || !this.shown);
    const name = el(doc, 'span', 'deck-name', this.shown?.project.name ?? '');
    const where = el(doc, 'span', 'deck-where');
    if (this.typed) where.textContent = `Go to ${this.typed}…`;
    else if (slide) where.append(el(doc, 'b', '', `${index + 1} / ${this.slides.length}`), ` ${slide.title}`);
    this.heading.replaceChildren(name, where);
    const behind = this.locked && this.latest && this.shown && this.latest.version !== this.shown.version;
    this.lock.textContent = this.locked ? behind ? 'Locked · editor has changes' : 'Locked' : 'Live';
    this.lock.classList.toggle('on', this.locked);
    this.playButton.classList.toggle('moving', phase === 'moving');
    const hasMusic = Boolean(this.shown?.project.audio) && this.shown?.project.slides?.music !== 'off';
    this.muteButton.classList.toggle('deck-hidden', !hasMusic);
    this.muteButton.classList.toggle('on', this.muted);
    this.muteButton.setAttribute('aria-pressed', String(this.muted));
    this.muteButton.title = this.muted ? 'Unmute (M)' : 'Mute (M)';
    this.muteButton.querySelector('svg')!.innerHTML = ICONS[this.muted ? 'muted' : 'sound'];
    if (this.progress.childElementCount !== this.slides.length) {
      this.progress.replaceChildren(...this.slides.map((_, i) => {
        const item = el(doc, 'li'), button = el(doc, 'button');
        button.type = 'button'; button.addEventListener('click', event => { event.stopPropagation(); this.black.classList.add('deck-hidden'); this.deck.goTo(i); });
        item.append(button); return item;
      }));
    }
    [...this.progress.children].forEach((item, i) => {
      const s = this.slides[i]!, button = item.firstElementChild as HTMLButtonElement;
      const label = `${i + 1}. ${s.title}`;
      button.title = label; button.setAttribute('aria-label', label);
      item.className = phase === 'ready' ? '' : i < index ? 'done' : i === index ? phase === 'moving' ? 'current moving' : 'current' : '';
      button.setAttribute('aria-current', phase !== 'ready' && i === index ? 'step' : 'false');
    });
    this.renderPresenter();
  }

  // ------------------------------------------------------------ speaker view

  private openPresenter() {
    const view = this.root.ownerDocument.defaultView;
    if (this.presenter && !this.presenter.closed) { this.presenter.focus(); return; }
    const popup = view?.open('', 'mografy-presenter', 'width=900,height=640');
    if (!popup) return;
    const doc = popup.document;
    doc.title = 'Speaker view';
    doc.documentElement.className = 'deck-page';
    // Same origin (about:blank opened from here): carry this page's styles over.
    const css = [...this.root.ownerDocument.styleSheets].map(sheet => { try { return [...sheet.cssRules].map(rule => rule.cssText).join('\n'); } catch { return ''; } }).join('\n');
    doc.head.replaceChildren(Object.assign(doc.createElement('style'), { textContent: css }));
    doc.body.replaceChildren(el(doc, 'div', 'presenter'));
    doc.addEventListener('keydown', event => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (NEXT_KEYS.includes(event.key)) { event.preventDefault(); this.next(); }
      else if (PREVIOUS_KEYS.includes(event.key)) { event.preventDefault(); this.previous(); }
      else if (event.key === 'Home') this.deck.restart();
    });
    this.presenter = popup;
    clearInterval(this.presenterTimer);
    this.presenterTimer = setInterval(() => this.renderTimer(), 500);
    this.renderPresenter();
  }

  private closePresenter = () => { clearInterval(this.presenterTimer); if (this.presenter && !this.presenter.closed) this.presenter.close(); this.presenter = null; };

  private renderTimer() {
    const timer = this.presenter && !this.presenter.closed ? this.presenter.document.querySelector('.presenter-timer') : null;
    if (!timer) { clearInterval(this.presenterTimer); return; }
    const elapsed = this.startedAt ? Math.max(0, Math.floor((Date.now() - this.startedAt) / 1000)) : 0;
    timer.textContent = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  }

  private renderPresenter() {
    const popup = this.presenter;
    if (!popup || popup.closed) return;
    const doc = popup.document, host = doc.querySelector('.presenter');
    if (!host) return;
    const { index, phase } = this.deck.state, current = this.slides[index], following = this.slides[index + 1];
    const top = el(doc, 'header', 'presenter-top');
    top.append(el(doc, 'span', 'presenter-count', `${index + 1} / ${this.slides.length}`),
      el(doc, 'span', 'presenter-phase', `${PHASE[phase]}${this.locked ? ' · locked version' : ''}`), el(doc, 'span', 'presenter-timer', '0:00'));
    const section = el(doc, 'section');
    section.append(el(doc, 'h1', '', current?.title ?? ''), el(doc, 'p', `presenter-notes${current?.notes ? '' : ' empty'}`, current?.notes || 'No notes for this slide.'));
    const aside = el(doc, 'aside');
    const nextLabel = phase === 'holding' ? following ? following.title : 'End of presentation' : phase === 'moving' ? `${current?.title ?? ''} (arriving)` : current?.title ?? '';
    const list = el(doc, 'ol', 'presenter-list');
    this.slides.forEach((slide, i) => {
      const item = el(doc, 'li', i === index ? 'on' : ''), button = el(doc, 'button', '', slide.title);
      button.addEventListener('click', () => this.deck.goTo(i));
      item.append(button); list.append(item);
    });
    aside.append(el(doc, 'h2', '', 'Next'), el(doc, 'p', 'presenter-next', nextLabel), list);
    const body = el(doc, 'main', 'presenter-body');
    body.append(section, aside);
    const controls = el(doc, 'footer', 'presenter-controls');
    const button = (label: string, action: () => void, className = '') => { const b = el(doc, 'button', className, label); b.addEventListener('click', action); return b; };
    controls.append(button('Restart', () => this.deck.restart()), button('← Previous', () => this.previous()), button('Next →', () => this.next(), 'primary'));
    host.replaceChildren(top, body, controls);
    this.renderTimer();
  }
}
