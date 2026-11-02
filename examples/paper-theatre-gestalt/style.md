# Style — 格式塔心理學 Gestalt Psychology

> Reference film from the paper theatre series (`mografy add paper-theatre-gestalt`). Study how it is built, then make your own film; do not copy its story. The raw narration take (`storyboards/narration-source.mp3`) is not shipped: record or generate your own and rerun `storyboards/timing.py` to rebuild the cues.

## Film idea
A paper theatre on a desk, the same world as 陰影心理學. A handful of card fragments hang on strings and one brass
lamp lights them. Only from one lamp position (`L_FACE`) do their shadows lock into a face; move the lamp and the face
falls apart. The brain, like the lamp, completes the whole. Every cutout is drawn in wall coordinates and hung on the
ray from its lamp (or, for the three bitten discs, from the camera), so the alignment is real 3D projection, not a 2D
trick. Act I is the lit box, Act II is the same box papered in ink for the six habits, Act III returns to the
fragments and pulls back to reveal the theatre on a desk.

## Canvas and timing
1920 × 1080, 16:9, 30 fps. Param `motion`: 'stop-motion' (default) samples props and lamps on 2s (12 per second,
`step(t)` in main.ts) with a seeded boil; 'smooth' moves them every frame. The camera, focus, type and subtitles are
always smooth. The film opens dark; the bulb snaps on at 0.8 s. The acts change in the dark: the lamp switches off at
25.6 and 59.2 and comes back on in the new set.
Narration: `assets/narration.mp3` = the ElevenLabs take laid 1.4 s late (storyboards/timing.py); 78.0 s total.

## Layers
1. Three.js stage (scenes/world.ts): box, proscenium with the gold header, two brass stand lamps, face fragments,
   phi bird, card with a window + vase, thirty dots, three bitten discs, yarn, fifteen birds, ring + square, desk props.
2. Post (makePost): 40-tap depth of field driven by `focus(t)`, ACES, warm print grade, vignette .4, grain .045.
3. 2D: bulb glow (screen), kickers, the six-habit layout, subtitles, dips, tagline.

## Palette and materials
| Role | Value |
| --- | --- |
| Paper wall / floor | #E8DCC4 / #D9C8A8, fibre texture |
| Card fragments | #CFAE80 · gold foil (Act III) #CFA54E metal |
| Cream cutouts (bird, discs, ring) | #EFE4CF |
| Ink backstage (Act II) | wall #2C2824, floor #25211E |
| Gold dots (S06) | #E6A33A |
| Yarn | #A4523A |
| Proscenium | #5B2A22, header #E4C06C |
| Lamp | brass, light #FFB866 |
| 2D type | cream #F3EBDD, amber #E8A84A |

## Type (two faces)
- Noto Serif CJK TC 700: habit names 150 px, the theatre header (on set).
- Noto Sans CJK TC 500: subtitles 44 px centred at baseline 1000 on a bottom scrim; kickers 30 px tracking 10 amber at
  (150, 150); habit No. 32 px amber + Latin 30 px; descriptors 42 px; tagline 48 px amber.
- Subtitles show every narration phrase except the six habits (their words are the big name and the descriptor) and
  the closing line (shown as the tagline). S10's name is 「簡潔」 with 「PRÄGNANZ · 也叫完形」 on the Latin row, matching
  the narration 「第六，簡潔，也叫完形」.

## Stop-motion rules
- Seeded boil per pose: hanging cutouts ±3 mm (small, so projected shadows stay aligned), birds ±0.02 rad.
- Replacement animation: dots hop in three poses, gold flips in three poses (tilt, edge, gold), the face fragments
  turn gold the same way.
- Strings stay visible and every hanging prop arrives and leaves on its string.
- Two-lamp swaps in S03 snap to the 12 fps grid: every 6 frames, speeding up to every 2.

## Camera
One camera for the whole film; every move starts where the last one ended, except the two lamp-off cuts.
Moves: crane down (S01), slider + rack focus (S02), low truck (S03), push through the card's window (S04),
top-down with a slow roll (S05), crane up (S06), tilt down-to-front then a 40° orbit reveal (S07), track along the yarn
(S08), low-angle tilt up (S09), lock-off (S10), dolly zoom 30° → 58° (S11), orbit (S12), pull-back reveal (S13).
In S05–S10 the subject sits right of centre: the left 900 px hold the habit layout.
