# Style — 美即好用效應 Aesthetic-Usability Effect

> Reference film from the paper theatre series (`mografy add paper-theatre-aesthetic-usability`). Study how it is built, then make your own film; do not copy its story. The raw narration take (`storyboards/narration-source.mp3`) is not shipped: record or generate your own and rerun `storyboards/timing.py` to rebuild the cues.

## Film idea
The same desk paper theatre as 陰影心理學 and 格式塔心理學. Two cardboard ATMs do exactly the same thing; only their
faces differ. **Inside the screens is 2D (the interface, what we see); outside is 3D (the paper puppet's reactions, the
light, the halo).** The camera passes through a screen into full-frame 2D twice: S03 peels both skins to show one
skeleton, S11 lifts the pretty skin to show what it hides. In S12 the lamp stands at the viewer's eye (`EYE`), so the
pretty skin's shadow covers the wireframe exactly: seen from the front they are one picture.

## Canvas and timing
1920 × 1080, 16:9, 30 fps, 74.0 s. Param `motion`: 'stop-motion' (default) samples props, the puppet, the halo and the
lamp on 2s (12 per second, `step(t)` in main.ts) with a seeded boil; 'smooth' moves them every frame. The camera, focus,
2D interfaces, type and subtitles are always smooth. The film opens dark; the bulb snaps on at 0.8 s. The acts change in
the dark: the lamp switches off at 26.2 and 48.9 and comes back on in the new set.
Narration: `assets/narration-aesthetic-usability.mp3` = the ElevenLabs take laid 1.2 s late (storyboards/timing.py →
cues.json). Its own file name on purpose: the player keys decoded audio on the URL, so two projects that both use
`assets/narration.mp3` would share one voice when switched in the same window.
Performance: lights never toggle `visible` (a changed light count recompiles every material; use intensity 0), the
ATMs leave the stage by moving outside the box rather than hiding, and the screen textures re-upload only when
`screenKey` changes (no mipmaps).

## Layers
1. **3D stage** (scenes/world.ts): box, ink overlay (Act II), proscenium with the gold header, one brass stand lamp,
   two ATMs (screen = canvas texture, plus a coloured point light that really lights the set), the rod puppet,
   26 screen cards, the gold title card, the gold halo, the two hanging layers, desk props.
2. **2D interface layer** (scenes/ui.ts): one skeleton (title, 2 × 2 buttons, footer), three skins — ugly, pretty,
   wireframe — and animated states: boot, error (ugly shakes, pretty slides up), ok (check draws), crash (torn slices +
   spinner). Painted into the screen textures every frame and drawn full-frame in S03 / S11.
3. **2D hand-drawn layer** (main.ts `marks`): anger mark, tangle, "～", sparks, "...", speed lines, chalk chart,
   vision fan. Jittered brush strokes reseeded every 2 frames (boil).
4. Post (makePost): 40-tap depth of field driven by `focus(t)`, ACES, warm print grade, vignette .4, grain .045.
5. Type: kickers, subtitles, dips, tagline.

## Palette
| Role | Value |
| --- | --- |
| Paper wall / floor | #E8DCC4 / #D9C8A8, fibre texture |
| Ink backstage (Act II) | wall #2C2824, floor #25211E |
| Cream card (ATM bodies, puppet) | #EFE4CF · trim #CFAE80 |
| Gold foil (title card, halo) | #CFA54E metal |
| Proscenium | #5B2A22, header #E4C06C |
| Lamp | brass, light #FFC37A |
| Ugly skin (left screen only) | #12C2D6 → #7A1FD1, buttons #8CFF2E #FF3FD0 #FF8A00 #FFF200, error #EE1111 |
| Pretty skin | bg #F5EFE4, buttons #EADFCB, icons #C98A2E, text #2C2824 |
| 2D type | cream #F3EBDD, amber #E8A84A; on paper (2D shots) dark amber #A86A1C and ink #2C2824 |
| Hand-drawn red | #D2412F |

## Type (two faces, registered weights only)
- Noto Serif CJK TC 700: gold title card, proscenium header, the S03 headline, ugly-skin text.
- Noto Sans CJK TC 500: subtitles 44 px centred at baseline 1000 on a bottom scrim; kickers 30 px tracking 10 at
  (150, 150); tagline 48 px amber; pretty-skin text.
- Subtitles show every narration phrase except S05 (the gold card says it) and the closing two phrases, which build the
  tagline 「好看讓人留步，好用讓人留下。」 phrase by phrase.

## Stop-motion rules
- The puppet walks in hops (one bob per pose pair), presses in three poses, shrugs in two; boil ±0.01 position,
  ±0.03 arm.
- Cards drop in one every 0.165 s from the centre outward; the title card is lowered and wobbles three frames.
- The halo is lowered, swings and settles; when the string snaps it falls, bounces twice and rolls to rest.
- Every hanging prop keeps its string.

## Camera
One camera; every move starts where the last one ended, except the two lamp-off cuts and the two passes through a
screen. Moves: crane down (S01), slide then push into the pretty screen (S02), pull out of card 6 (S04), slow 5 % push
(S05), over-the-shoulder push (S06), truck right with the puppet (S07), side arc (S08), low angle (S09), tilt down with
the falling halo then push into the crashed screen (S10), pull out → orbit 24° and back to the eye (S12), pull-back
reveal on a Bézier past the lamp (S13).
