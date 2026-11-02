# Style — 海月公主 (72 s, 3D paper puppet theatre)

> Reference film from the paper theatre series (`mografy add paper-theatre-sea-moon`). Study how it is built, then make your own film; do not reuse its characters, story or music in another film.

## Idea
- Light travels: the moon → the castle's windows → darkness → her umbrella → her voice → the jellyfish → the windows, and home to the real moon. 海月 means jellyfish: the sea has moons of its own.
- One world: a full 3D undersea castle (Three.js) with Mirea as a flat printed paper puppet on threads. No 2D insert shots. A pearl shell paper theatre opens and closes the film.

## Structure
- 16:9, 1920 × 1080, 30 fps, 72 s, 14 shots in `BEATS` (`scenes/main.ts`); 100 BPM, bar 2.4 s, every cut on a bar line.
- Handoffs: three scalloped paper sheets wash past the lens into the water, with bubbles behind them (back again at the end); one crane from the surface back and down to the castle, then into the Moon Tower window, whose light swallows the frame; S04 tilts up to the window and dissolves to the moon; S05 tilts down and dissolves to the city; S06 goes to black on its own; the umbrella glow dissolves to the terrace; her last ring of light grows until it fills the frame on the 48 s downbeat; S10 → S13 is one continuous crane from her feet, over the whole city, to the surface. Dissolves render both shots for real (`DISSOLVE` in `scenes/main.ts`).
- The ending mirrors the opening: from 60 s one move (`endCam`) swings round and up over the lit city (S12, chord and rings of light on 62.4), then rises past bubbles, tilts up to the S02 view, the paper disc slides off and the moon returns (S13); the paper waves wash back and the drapes close (S14). The umbrella → jelly idea and the bow were removed at the user's request.
- Purity: every per-frame property is written by `resetWorld` or `pose`, light colours included; time is set before the mirror pass.

## Colour arc
- Cold moon blue (`NIGHT`) → black (`DARK`) → her lilac, pink and aqua (`SONG`). Windows are cool white before the dark and tinted pink, lilac, aqua after it.

## Puppet
- Whole-figure cards swap by emotion (replacement animation): sit, sad, happy, joy, free. Paper backing plane behind each card; threads stay visible in close shots. Pose motion on 2s; camera and light smooth. Keep the card in front of furniture: it must never intersect the chaise.

## Type
- Hai Serif TC (Noto Serif CJK TC Bold subset `assets/NotoSerifTC-Bold-film.otf`) for hanging vertical story cards; re-subset after any copy change. Cards drop on strings with `spring` and hold at least 3 s. No end title: the film ends on the drapes closing.

## Music (`music-src/compose.py` → `assets/music.mp3`)
- Original, deterministic, an anime ballad: one tune grows from a music box to a full orchestra. D major (canon chords), a chorus on IV–V–iii–vi in E from 48 s, staying in E to the end. Music box, harp, piano, flute, formant voice, strings, choir, celesta, soft drums. Every hit time comes from `scenes/main.ts`; timeline in `storyboards/music-timeline.png`.

## Render cost
- Castle shadow map is drawn once. The room's floor and walls do not receive that map (its texels are too coarse there and stair-step). Mirror pass is fixed at 960 × 540. Main pass uses 2× MSAA; depth of field step 3.
