# Style — 陰影心理學 Shadow Psychology

> Reference film from the paper theatre series (`mografy add paper-theatre-shadow`). Study how it is built, then make your own film; do not copy its story. The raw narration take (`storyboards/narration-source.mp3`) is not shipped: record or generate your own and rerun `storyboards/timing.py` to rebuild the cues.

## Film idea
A paper theatre on a desk. One bulb moves and the shadow answers. The shadow is cast for real by the Three.js point
light; the four trait tokens (▲ anger, ■ envy, ● fragility, ☾ desire) live inside the shadow's head and travel
wherever it goes. Act I is inside the lit box, Act II goes through the shadow into the dark backstage, Act III returns
to the box and pulls back to reveal the whole theatre on a desk.

## Canvas and timing
1920 × 1080, 16:9, 30 fps. Param `motion`: 'stop-motion' (default) samples poses and the light on 2s (12 per second, `step(t)`
in main.ts) with a seeded boil; 'smooth' moves everything every frame. Every shot change blends focus, light and the
figure's size, and props leave on their strings (tags pulled up, yarn wound back) instead of vanishing. The camera, focus, type, subtitles and
transitions are always smooth. The film opens pitch black; in a faint cool light the pull cord is tugged and the bulb snaps on at 0.8 s.
Narration: `assets/narration.mp3` = the ElevenLabs take laid 1.0 s late (storyboards/timing.py); 82.0 s total.

## Layers
1. Three.js stage (scenes/world.ts): box, cutouts, bulb, tokens, tags, mask, yarn, backstage props, disc, shell.
2. Post (makePost): 40-tap depth of field driven by `focus(t)` (in-focus pixels skip the gather), 3D layer capped at 1920 × 1080, ACES, warm print grade, vignette .35, grain .045.
3. 2D: bulb glow (screen), kickers, labels, step layout, subtitles, dips and flashes, tagline.

## Palette and materials
| Role | Value |
| --- | --- |
| Paper walls / floor | #EFE6D4 / #E6DBC5, fibre texture |
| Ink card (figure, shadow-side) | #24212C |
| Other person | #A79E90 |
| Bulb / accent | #E3A042, light #FFB866 |
| Brass and gold | metal 0x8A6A3A, gold 0xE2B055 |
| Felt (Act II) | #1B1922 |
| Traits | ▲ #C8643B ■ #7F8C76 ● #B98B7E ☾ #D9A441 |
| 2D type | cream #F3EBDD, amber #E8A84A |

## Type (two faces)
- Noto Serif CJK TC 700: step names 150 px, gold labels 56 px, the theatre header (on set).
- Noto Sans CJK TC 500: subtitles 44 px centred at baseline 1000 on a bottom scrim; kickers 30 px tracking 10 amber top-left
  (150, 150); step descriptors 42 px; tagline 48 px amber.
- Subtitles show every narration phrase except the three steps (their words are the step titles) and the closing line
  (shown as the tagline).

## Stop-motion rules
- Seeded boil per pose: cutouts ±0.35°, ±4 mm; tokens ±0.6°; bulb brightness ±3 %.
- Replacement animation for the turn (edge-on for 2 poses), child → adult, paper → gold (flip over 3 poses).
- Strings stay visible (tags, mask, bulb wire). Pops: 0.55 → 1.18 → 1 over three poses.

## Camera
One camera for the whole film; every move starts where the last one ended. Moves: bulb close-up + pull back (S01), slider + rack
focus (S02), worm's-eye dutch (S03), macro push + rack (S04), overhead (S05), dolly zoom 16° → 34° (S06), orbit +
push-through (S07), backstage truck (S08–S10), macro rise (S11), slow spin (S12), pull-back reveal (S13).
Breaks: black through the shadow at 48.3, amber seam flash at 62.7, short dip at 69.0, fade out at 82.
