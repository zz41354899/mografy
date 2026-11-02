# Style — 林格曼效應 Ringelmann Effect

> Reference film from the paper theatre series (`mografy add paper-theatre-ringelmann`). Study how it is built, then make your own film; do not copy its story. The raw narration take (`storyboards/narration-source.mp3`) is not shipped: record or generate your own and rerun `storyboards/timing.py` to rebuild the cues.

## Film idea
The same desk paper theatre as 陰影心理學, 格式塔心理學 and 美即好用效應. **One twine rope, one brass dynamometer,
two needles.** The red needle is 3D: what the team really pulls. A gold dashed needle is 2D: what it should read if
nobody held back. The gap between them is the effect. The rope and the dial are in every shot: the camera goes through
the dial glass into full-frame 2D (S06) and back out (S07); the dial turns round into a sound meter (S08) and back
(S09); the rope itself becomes the 2D flat in S10 and unravels into four strands, which return as four short ropes with
four small dials (S11).

## Canvas and timing
1920 × 1080, 16:9, 30 fps, 75.0 s. Param `motion`: 'stop-motion' (default) poses the puppets, the rope, the lamp, the
title card and the dial's turn on 2s (12 per second, `step(t)` in main.ts) with a seeded boil; 'smooth' moves them every
frame. The camera, focus, needles, 2D layers, type and subtitles are always smooth. The film opens dark; the bulb snaps on
at 0.8 s. **Acts change while a full-frame 2D shot covers the stage** (ink on at 30.0, off at 60.0) — never in a
blackout, and every shot change is a camera move or a covering 2D transition (iris on the dial, a paper flat).
Narration: `assets/narration-ringelmann.mp3` = the ElevenLabs take laid 1.2 s late (storyboards/timing.py →
cues.json; its own file name, so it never collides with another project's audio in the player).
Performance: lights never toggle `visible` (intensity only); ropes are chains of cylinder segments posed every frame
(no geometry rebuilt); the see-through "teammates" change opacity only; textures are baked to Cache Storage.

## Layers
1. **3D stage** (scenes/world.ts): box, ink overlay (Act II), proscenium with the gold header, one brass stand lamp,
   eight two-armed rod puppets (blindfold and headphones as parts), one rope of 34 segments, a big dynamometer whose head
   turns round (force face 0–800 front, sound face 0–100 back), four small dials on columns (Act III), the gold title card,
   desk props (twine coils, pencil).
2. **2D "should read" layer** (main.ts `marks`): the gold dashed needle with its label above the dial, the force arrows
   above the pullers (length = that person's share: 100, 93, 85, 49).
3. **2D hand-drawn layer**: Ringelmann's chalk bars, the volume bars, dashed rings round the fakes, sound arcs,
   question marks, "沒差？", "100" with a drawn tick (no ✓ glyph: the CJK subsets lack it). Jittered strokes reseeded every 2 frames (boil).
4. **Full-frame 2D flats**: S06 (effort curves out of step, revealed by an iris from the dial face) and S10 (the rope
   unravelling into four named strands, a paper flat dropped from the fly bar); each tag appears on the word.
5. Post (makePost): depth of field from `focus(t)`, ACES, warm print grade, vignette .4, grain .045. Act III exposure 1.05.
6. Type: kickers, subtitles, the opening dark, tagline built phrase by phrase, credit.

## Palette
| Role | Value |
| --- | --- |
| Paper wall / floor | #E8DCC4 / #D9C8A8, fibre texture |
| Ink backstage (Act II) | wall #2C2824, floor #25211E |
| Twine | #C9A877 with #8A6236 twist |
| Brass | #9A7438 metal |
| Real needle | #B0342A |
| "Should read" needle, chalk numbers | gold #E4C06C |
| Kicker / arrows | amber #E8A84A (on paper: #A86A1C) |
| Puppets | eight paper tones #EFE4CF … #D9C2A0, limbs #CFAE80 |
| Gold foil (title card) | #CFA54E metal |

## Type
Noto Serif CJK TC 700 for the title card, the proscenium header and 2D headlines; Noto Sans CJK TC 500 for subtitles
(44 px, bottom centre), kickers (30 px, tracking 10, amber), chalk (34 px; numbers 700 in gold). Run
`python3 extras/cjk/subset-film-fonts.py <this project folder>` after every copy change.

## Lighting
The lamp stands well in front of the rope (z ≈ 6.5): from the side its light only grazes the puppets' faces and they
turn grey. Act I left-front, Act II right-front (warm on the blindfolded puppet), S09 high centre, Act III far left with a
warm room light; the lamp never crosses the middle of a frame.

## Facts on screen
Ringelmann (1913; data from the 1880s): per person 93 % (2), 85 % (3), 49 % (8) — the table's task is not specified
as rope pulling (Kravitz & Martin 1986), so the narration says "兩個人一起". Ingham et al. 1974: blindfolded, the others
only pretended. Latané, Williams & Harkins 1979: shouting, 82 % with one believed partner, 74 % with five; "social
loafing". Karau & Williams 1993: 78 studies; less loafing when contributions are identifiable, the task meaningful,
the group small, members valued.
