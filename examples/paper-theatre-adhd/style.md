# Style — 不聽使喚的燈 ADHD

> Reference film from the paper theatre series (`mografy add paper-theatre-adhd`). Study how it is built, then make your own film; do not copy its story. The raw narration take (`storyboards/narration-source.mp3`) is not shipped: record or generate your own and rerun `storyboards/timing.py` to rebuild the cues.

## Film idea
The same desk paper theatre as 陰影心理學, 格式塔心理學, 美即好用效應 and 林格曼效應. **One theatre spotlight on a brass
track, one rope, one gold dashed ring.** The real 3D light is what is lit; the 2D ring is where the puppet wants to look.
The gap between them is the film: widest in S02, close in S11, almost overlapping and never quite in S13.

## Canvas and timing
1920 × 1080, 16:9, 30 fps, 85.0 s. Param `motion`: 'stop-motion' (default) poses puppets, props, rope and the lamp on 2s
(12 per second, `step(t)` in main.ts); 'smooth' moves them every frame. The camera, focus, 2D layers, type and subtitles
are always smooth. The film opens dark; the lamp snaps on at 0.7 s with one short flicker, and there is no other flashing.
Narration: `assets/narration-adhd.mp3` = the ElevenLabs take laid 1.4 s late (storyboards/timing.py → cues.json; its own
file name, so it never collides with another project's audio in the player).
Performance: lights change intensity only; ropes are chains of cylinders and beams are scaled cones, posed every frame and
never rebuilt; shadow passes of unlit lights are skipped; textures are baked to Cache Storage (see world.ts).

## Layers
1. **3D stage** (scenes/world.ts): box, ink overlay (Act II), proscenium with the gold title, brass track with trolley, yoke
   and spotlight head, rope, pulley, desk with report, window with sky, sun and moon, paper TV, rod puppets with dot eyes,
   hanging labels, 319 + 2 punched tapes, backstage notes, dimmer, partition with slit, curtains, rail, trophy, candy, lock
   pin, cups, tower, stool, clip, digit strips, the under-stage (spools, cut-outs, gears), toolbox, floor pulley, three cards.
2. **2D "wants to look here" layer**: the gold dashed ring, S07's dashed trophy outline.
3. **2D notes**: 後台/前台/很窄的縫, S04's gap bracket, the dimmer arrow, S09's swing arcs.
4. **Paper flats** cover every set change that a camera move cannot carry (kraft in Act III, ink in Act II, punched tape into S04).
5. Post (makePost): depth of field, ACES, warm print grade, vignette .4, grain .04, exposure 1.2.
6. Type: kickers, subtitles, end card.

## Palette
| Role | Value |
| --- | --- |
| Paper wall / floor | #E8DCC4 / #D9C8A8, fibre texture |
| Ink stage (Act II) | wall #2C2824, floor #25211E |
| Light | spot #FFCF94, amber leak #FF9A3C |
| Ring, chalk | gold #E4C06C |
| Kicker, arrows | amber #E8A84A |
| Text | cream #F3EBDD |
| Proscenium | #5B2A22 with gold foil #CFA54E |

## Type
Noto Serif CJK TC 700 for 3D signs, cards and the proscenium title; Noto Sans CJK TC 500 for subtitles (44 px, bottom
centre), kickers (30 px, tracking 10, amber) and chalk (28–40 px). Run `python3 extras/cjk/subset-film-fonts.py
<this project folder>` after every copy change.

## Facts on screen (red lines)
S04: most gaps alike, occasional long gaps (Kofler et al. 2013, 319 studies). S06: the slit stays narrow; youth data, small
average difference (Norman et al. 2023). S07: Jackson & MacKillop 2016. S08: not exclusive to ADHD. S09: the light does not
move; strips improve and not all stay; a boy puppet; small study, 29 boys (Sarver et al. 2015). S11: labels only, no pills;
the light still slips. S12: three criteria, professional assessment. S13: no full overlap. No fast strobing anywhere.
