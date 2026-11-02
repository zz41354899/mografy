# Style — 來自月亮的偶像 · 3D × 2D (60 s)

> Reference film from the paper theatre series (`mografy add paper-theatre-moon-rabbit-opera`). Study how it is built, then make your own film; do not reuse its characters, story or music in another film.

## Idea
- One paper toy theatre on a desk in an ultramarine room, built in real 3D (Three.js), cut against flat printed 2D inserts. The puppet stays a flat card.
- Moonlight travels: the moon → the town's windows → the moonbeam on the washi screen → one spotlight on an empty stage → the audience's penlights → the full stage → the lit sign at the end.
- Reference language: YOASOBI 「群青」 MV (dir. 牧野惇): ultramarine night, paper cut-outs photographed in real space with real light and shallow focus, velvet drapes and hanging gold stars, tiny figures in big sets against full-frame face close-ups. Language only; no shots copied.

## Structure
- 16:9, 1920 × 1080, 60 s, 13 shots in `BEATS` (`scenes/main.ts`); 120 BPM, bar 2 s, cuts on the bar grid.
- 3D shots: S01, S02, S03, S05, S07, S09, S10, S12 (box), S13. 2D shots: S04 eyes, S06 cloud sea, S08 breath, S11 poster, the chapter cards inside S12.
- S12 cards: the 2D cards sit inside the kamishibai frame exactly as the 3D box shows it at 48.0 (camera z 1.079): 70 px wooden side bars, dark box interior above and below; cards are pulled out sideways under the frame.
- Handoffs: marquee close-up pulls back and tilts up to the dome and chandelier, then down to the stage as the house lights dim, into the continuous camera S01→S02→S03; window glow → 2D eye; two shoji doors close over S04 carrying the 3D screen of 16.0 (they meet on S05's first frame) → which splits into shoji doors that slide open onto S06; cloud wipe out of S06; flicker → white flash → 2D breath; the circle of light irises open into the hall; camera swings to the front on 40; petals cover the cut to the poster; the poster is pulled like a kamishibai card off the 3D box; the camera pushes until the box's card exactly fills the frame (S12 card = 2D card at 48.0); drapes snap shut and reopen for the curtain call; confetti, then the film simply ends on the drapes closing in the opera house (no end title), house lights up, fade to black.

## 3D world (`scenes/world3d.ts`)
- The opera house around the stage (enclosed, so no camera ever sees outside it): a damask proscenium wall with gilt pilasters and a painted moon lunette above the crown; four tiers of opera boxes along both sides (5 bays) and the back (7 bays): arched openings with velvet drapes and gilt frames, fluted balconies with velvet rails, one lamp per box, fans in some boxes; a painted 群青 dome with gilt ribs and a lamp ring; a crystal chandelier with candle bulbs and one warm light; crimson carpet; an orchestra-pit rail. `setHouse` drives all house lights (up for the reveal, down as the drapes open, up again for the curtain call). Cameras stay at z ≤ 4.8 (the back balconies start at 5.0).
- Loaded images go through a canvas before becoming textures (ImageBitmaps ignore flipY).
- Built once in setup; `resetWorld()` writes every animated property on every frame; lights fade by intensity only; castShadow fixed; shadow maps allocated in setup and redrawn once per frame (`autoUpdate = false`).
- Theatre: pink cardstock proscenium (flat with thickness), 3D fluted pillars with gold capitals and paper lanterns, ultramarine velvet drapes (pleated geometry, sheen) with gold hems, two lantern garlands, wave ground row in front, cloud ground row before the backdrop, lacquered wood stage, three velvet swags across the top of the opening with gold band, fringe and tassels; opera boxes either side of the house (cut-out facade, two fluted balconies each, a lamp and two fans per balcony; `setHouse` lights them with the aisle step lights); a hand-painted paper moon (watercolour, the rabbit pounding mochi in the maria, gold-leaf rim) with a halo; a night city in three layers (far hazy skyline with a lattice radio tower and aircraft lights, office blocks with rooftop tanks and billboards, near streets with shop fronts; instanced lit windows, signs on the emissive map), a slender elevated railway between the near and middle layers with a toy train; a continuous street row in front (low wall, trees, lamps) so the stage floor never shows; 26 marquee bulbs as emissive meshes (`setBulbs`: count-up in S01, chase in S13; unlit bulbs stay dark).
- Backdrops (tinted towards 群青): star map (S01–S02, S05–S09), night hills (S03), end-stage moon (from 39.5), red lantern stage (S12).
- Depth of field: layered render (foreground / main / background passes) blurred with `blurLayer`; bloom from the main pass.
- Puppet cards swap by emotion (stop-motion replacement): moon rabbit with mooncake (S02), nervous hands-clasped (S07), holding the glowing bunny (S09, S05 shadow), wink (after the flip on 40), waving (S13). Front = full colour (the idol), back = lavender duotone (the moon rabbit).

## Render cost (export runs headless Chromium with software WebGL)
- Every lit pixel pays for every light, even at intensity 0, so the scene keeps 11 lights (hemi, moon key, warm, spot, rim, 3 footlights, chandelier, 2 penlight fills); sheen/clearcoat only on the drapes and stage; seats don't cast shadows; shadow maps 1024 (warm 1024); empty depth-of-field passes are skipped. Measured on the same frames: 20–30% faster per 3D frame.

## 2D finish (`scenes/paper.ts` FX)
- Foreground sakura branches (S01, S13), dust motes in light, star glints, god rays (S10, kept off her body), light leaks, confetti (from 57.9), film specks and grain, soft-light grade, vignette, halation bloom; camera has a seeded micro-shake (vnoise, ±0.0055). All seeded, no per-frame canvases.

## Motion
- Puppets, props, town steps, windows and 2D inserts on 2s (12 poses/s, `on2`); camera, light and story cards smooth.
- Paper never squashes: flips go back → edge → face over three poses; pops 0.3 → 0.8 → 1.15 → 1; moon lands with one 1.06 overshoot pose.
- Story cards: 2D two-column vertical ivory cards on strings (right column first), dropped with `spring`, pulled up on strings; ≥ 3 s each.

## Palette
- 群青 #0E1A4F / #1C2F7A, drape blue #1F3A9C, moonlight blue #9DB6EE, moon yellow #FFE49B, sakura #F8A3C8, lavender #B99BDD, deep plum #30122E, rose #CC528B, gold #E2B055.

## Type
- LPC Serif TC (Noto Serif CJK TC Bold subset `NotoSerifTC-Bold-3d.otf`) for every card; Inter Display SemiBold for the plate, numbers and captions. Re-subset after any copy change.

## Music (`music-src/compose.py` → `assets/music.mp3`)
- Original, deterministic; E♭ major lifting to E major at 46 s. Music box + celesta prologue, pizzicato town, strings/harp/flute descent, empty-hall piano, vocal-synth verse with one blip per arriving fan, idol chorus (drums, octave bass, side-chained chords, EP stabs, doubled lead, ping-pong delay), chorus II with shakers and a string counter-line, music-box reprise, final chord on 58. Every hit time comes from `scenes/main.ts`; timeline in `storyboards/music-timeline.png`.

## Decisions the user made
- 3D stage + 2D scenes for 來自月亮的偶像, referencing 群青; 60 s; storyboard v2 approved ("沒問題開始製作"); kirameki-catch assets allowed for richer texture; better music; no export.

## Defaults (Claude's choices)
- Kept the story film's 120 BPM bar grid so every cut lands on a bar.
- Client artwork: keep this film out of shipped skill examples.
