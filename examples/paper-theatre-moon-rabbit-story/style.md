# Style — Lunar Pop Club "來自月亮的偶像" (story, 60 s)

> Reference film from the paper theatre series (`mografy add paper-theatre-moon-rabbit-story`). Study how it is built, then make your own film; do not reuse its characters, story or music in another film.

Story version of the paper puppet theatre promo (storyboard v1 in `storyboards/`, built). The theatre, palette, type and motion rules below carry over from the promo.

## Story rules (this film)
- 60 s, 120 BPM, bar 2 s; cut to the all-new score `assets/music.mp3` (`music-src/compose.py`, E♭ major). Shot ends on bars 8, 16, 24, 32, 40, 46, 54, 60 s (`BEATS` in `scenes/main.ts`).
- Moonlight travels: moon → town windows → moonbeam → single spotlight → penlights → full stage. Light level (footlights, lanterns, house dimming) follows the story: dim in the empty hall (24–32), rising with the audience, full on the 40 downbeat.
- Story cards: two-column vertical ivory cards on strings (right column first), gold inner rule, red 月 seal, lowered with a spring and pulled up on strings; each holds ≥ 4.6 s.
- Puppet: moon side = her picture in lavender duotone (the moon rabbit); full-colour face after the flip on 40.0 (back → edge → face over 3 poses). Hops, trembles (boil × 3), sways while singing, steps on the beat as the idol, bows on the final chord (58).
- The hall (riser, two seat rows, rim-lit audience silhouettes with penlights) is one ground row: it sinks into the trap for the chapter cards (45.6–46.2) and returns for the curtain call.
- Chapter cards and the curtain-call marquee reuse the promo's choreography (`scenes/promo.ts`) through a story → promo time map (`toPromo`).

---


2D re-staging of the 25 s moon-rabbit idol promo (the original promo, not included) as a paper toy theatre. Same beats, copy, music and assets; every graphic move of the original becomes a stage mechanism. Values live in `scenes/lib.ts` and `scenes/main.ts`; this file records the rules.

## Idea
- One paper toy theatre seen from the audience; nothing ever happens outside it. One paper moon travels the film: lowered on strings (S03), laid over the painted moon (S04), brought forward and flipped into the chapter card (S05), pulled like a kamishibai card (S06, S07).
- The puppet is one rigid card on a rod: a shadow on the washi screen (S02), its painted lavender back (S03–S04), flipped to the full-colour face on the 12 s downbeat, bows at the curtain call.

## Canvas, timing, motion
- 1920 × 1080, 30 fps, 25 s; 120 BPM, bar 2 s, offset 0 (`tempoGrid`); big changes on downbeats 6, 7, 8, 10, 12, 16, 18, 20, 22 s.
- Param `motion`: `stop-motion` (default) samples props, flats, drapes and the puppet on 2s (12 poses a second) with a seeded boil (±0.3°); `smooth` moves them every frame. Camera, light, type pulses and petals are always smooth.
- Paper never squashes: landings tilt 4° and settle; flips go face → edge → other face over three poses; pops go 0.3 → 0.8 → 1.15 → 1.
- Things leave on their mechanism: cards and tags are pulled up on strings, flats slide back into the wings, the backdrop flies out, the screen rolls up. No dissolves between sets.
- One camera (`cameraPath`): audience seat with slow pushes only (1.00 → 1.12 in S01–S03, pull back to 1.00 for the backdrop, small pushes and a truck following the card, 0.97 at the curtain call).

## Look
- The theatre (v2, "更精緻的舞台"): stacked cardstock layers (plum back card with an arched crown, pink front card, rose opening frame with gold foil and a dotted rule), every layer with a drop shadow, soft-light paper fibre, a lit top edge and a darker thickness edge.
- Crown: a paper moon rising behind the plum rabbit-head plate (ivory ears, gold double rule, LUNAR POP CLUB / 月兔紙劇場 · NO.01), gold rays, auspicious clouds in ivory card with gold curls, small stars; lace scallops along the top rail.
- Pillars: fluted pink shafts with rose capitals (gold volutes) and plinths, a sakura vine climbing each, a pink paper lantern hanging from each capital (they glow with the footlights).
- Valance: plum pelmet with gold diamonds, a back tier of pleated swags, a front tier of scallops with gold fringe and tassels. Drapes: velvet pleats with a thin sheen, gold tie-backs with tassels.
- Apron: wooden stage lip in light perspective, nine gold shell footlights, a plum skirt with a sakura-and-diamond band between gold rules, a plinth standing on a wooden desk; the frame's thickness shows as shadows inside the opening edges.
- Every flat and card has a soft drop shadow on what is behind it; the puppet has a white die-cut edge; strings are thin ivory lines from the flies; rods are brown wood.
- Footlights and pillar lanterns come on at 0.5 s; the header lights (with two flickers) at 12.2 s; multiply paper grain (param `grain`, 0.1) and a soft vignette over the frame.

## Palette (`C` in lib.ts)
- ivory #FFF7EB, sakura pink #F8A3C8, lavender #B99BDD, violet #9977BD, deep plum #30122E, moon yellow #FFE49B, rose #CC528B, gold #E2B055 / #B8862F, rod wood #6E4634, drape #7E2E5E / #5C1D4E, room #160814.

## Type
- LPC Serif TC (Noto Serif CJK TC Bold subset `NotoSerifTC-Bold-paper.otf`): vertical copy, 120 px titles with a soft shadow, 46 px subs, hanging cards 74 / 64 px.
- LPC Numerals (Playfair Display digits, OFL) outlined numerals 150 px; Inter Display SemiBold tracked captions and the header.
- Re-subset the serif after any copy change (characters: 今晚，陪伴著你月亮偶像登場魅力節拍月兔紙劇場).

## Copy
- 今晚， / 陪伴著你 (hanging cards), A / BRIGHTER / NIGHT / WITH / YOU (tags), 月亮偶像 (banner), 登場 · 魅力 · 節拍 with 01 FIRST APPEARANCE / 02 IRRESISTIBLE CHARM / 03 FIND YOUR RHYTHM, MOON RABBIT · CHAPTER 0n labels, 今晚，陪伴著你 ribbon and NO.01 marquee at the curtain call.

## Decisions the user made
- Paper puppet theatre feel, 2D only, built from the existing Lunar Pop Club material; storyboard v1 approved ("蠻讚的耶").

## Defaults, not decisions (Claude's choices)
- The puppet is one rigid card: the single painting has a foreshortened reaching hand, so jointed limbs would show holes; motion comes from hops, rocks, the flip and the bow.
- The original 120 BPM track is reused unchanged.
- Client artwork: keep this film out of shipped skill examples.
