// Present mode: the slide rail (left) and the playback menu on the stage. Slides are the scene's
// shots (meta.shots), so they are read here, never added. The scene itself is never changed here.
import type { DeckSlide, Snapshot } from '@mografy/core';
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight';
import { PlayIcon } from '@phosphor-icons/react/dist/csr/Play';
import { PauseIcon } from '@phosphor-icons/react/dist/csr/Pause';
import { RepeatIcon } from '@phosphor-icons/react/dist/csr/Repeat';
import { SpeakerHighIcon } from '@phosphor-icons/react/dist/csr/SpeakerHigh';
import { SpeakerSlashIcon } from '@phosphor-icons/react/dist/csr/SpeakerSlash';
import { FilmSlateIcon } from '@phosphor-icons/react/dist/csr/FilmSlate';

export function SlideRail({ snapshot, slides, selected, hasShots, onSelect }: {
  snapshot: Snapshot; slides: DeckSlide[]; selected: number; hasShots: boolean; onSelect(index: number): void;
}) {
  const version = snapshot.scene?.version ?? '';
  return <aside className="slide-rail" aria-label="Slides">
    <header><h2>Slides</h2><span className="slide-total">{slides.length}</span></header>
    <ol>
      {slides.map((slide, i) => <li key={`${slide.shot}:${slide.at}`}>
        <button className={`rail-slide ${i === selected ? 'current' : ''}`} onClick={() => onSelect(i)} aria-current={i === selected ? 'true' : undefined}>
          <span className="rail-number">{i + 1}</span>
          <span className="rail-thumb">{version ? <img src={`/__mografy/still?t=${slide.at}&v=${version}`} alt="" loading="lazy" decoding="async" /> : <i />}{slide.loopFrom !== null ? <RepeatIcon size={12} className="rail-loop" aria-label="Loops" /> : null}</span>
          <span className="rail-title">{slide.title}</span>
        </button>
      </li>)}
    </ol>
    {snapshot.scene?.autoShots ? <p className="rail-hint"><FilmSlateIcon size={14} /> Slides guessed from {snapshot.scene.autoShots === 'storyboard' ? 'the storyboard' : 'the picture'}. To set them exactly, ask Claude to “mark the shots for Present mode”.</p>
      : !hasShots && snapshot.scene ? <p className="rail-hint"><FilmSlateIcon size={14} /> Finding this scene's shots…</p> : null}
  </aside>;
}

/** Present mode's playback menu, floating in the middle of the stage: previous, play, mute, next. */
export function SlideControls({ count, selected, playing, muted, hasMusic, onSelect, onPreview, onPause, onMute }: {
  count: number; selected: number; playing: boolean; muted: boolean; hasMusic: boolean;
  onSelect(index: number): void; onPreview(): void; onPause(): void; onMute(muted: boolean): void;
}) {
  return <div className={`slide-controls ${playing ? 'playing' : ''}`} role="toolbar" aria-label="Slide playback">
    <button className="desk-nav" onClick={() => onSelect(selected - 1)} disabled={selected === 0} aria-label="Previous slide" title="Previous slide (←)"><CaretLeftIcon size={18} /></button>
    <button className="desk-play" onClick={playing ? onPause : onPreview} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play into this slide as the audience will see it (Space)'}>
      {playing ? <PauseIcon size={22} weight="fill" /> : <PlayIcon size={22} weight="fill" />}</button>
    <button className={`desk-mute ${muted ? 'on' : ''}`} onClick={() => onMute(!muted)} disabled={!hasMusic} aria-pressed={muted}
      aria-label="Mute" title={!hasMusic ? 'This project has no music' : muted ? 'Muted: the presentation plays without music' : 'Mute the presentation music'}>
      {muted || !hasMusic ? <SpeakerSlashIcon size={19} /> : <SpeakerHighIcon size={19} />}</button>
    <button className="desk-nav" onClick={() => onSelect(selected + 1)} disabled={selected >= count - 1} aria-label="Next slide" title="Next slide (→)"><CaretRightIcon size={18} /></button>
  </div>;
}
