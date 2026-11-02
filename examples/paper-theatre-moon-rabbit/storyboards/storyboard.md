# Lunar Pop Club No.01 — Paper Puppet Theatre (storyboard v1, built)

A 2D re-staging of the 25 s moon-rabbit idol promo as a paper toy theatre. Same beats, copy, music and assets as the original promo (not included); every graphic move of the original becomes a stage mechanism (curtains, a back-lit washi screen, flats in grooves, a moon on a stick, a puppet that flips over, kamishibai card pulls, a curtain call).

- **Format:** 16:9, 1920 × 1080, 30 fps. Props, puppet and flats animate on 2s (12 poses/s) with a seeded boil (±0.3°); camera, light and type stay smooth.
- **2D only:** pure Canvas 2D, no Three.js. Depth comes from layered flats, parallax and drop shadows on the backdrop.
- **Music:** the original 120 BPM track (`lunar-pop-club-120bpm.wav`, F major, bar 2 s). Big changes on downbeats 6, 7, 8, 10, 12, 16, 18, 20, 22 s. Optional paper foley (curtain swish, screen roll, fan, card pull).
- **Palette:** ivory #FFF7EB, sakura pink #F8A3C8, lavender #B99BDD, violet #9977BD, deep plum #30122E, moon yellow #FFE49B, rose #CC528B, gold #E2B055, rod wood #6E4634.
- **Type:** LPC Serif TC (vertical copy), LPC Numerals (Playfair Display digits, OFL), Inter Display (captions) — same as the original.
- **Assets (reused):** `character.webp` → the puppet: one rigid card with a die-cut white edge on a rod (no jointed limbs: the reaching hand is foreshortened, so cut joints would show holes) and both silhouettes (source-in tints); `portrait-turnaround.png` → chapter 01 (profile) and 02 (front) cards; `character.webp` face crop → chapter 03 card; `end-stage.png` → the painted backdrop (moon centre 832, 332).

## The theatre

A front-on pink paper proscenium on a desk: plum header plate "LUNAR POP CLUB / 月兔紙劇場 · NO.01" with paper rabbit ears, sakura stencils on the pillars, scalloped valance with gold studs, plum drapes tied back with gold cords, a berry apron with 11 paper footlight lanterns. The camera is the audience seat; it only pushes, pulls and trucks.

## Shots

| Shot | Time (s) | Action | Stop-motion | Camera | Transition out | Audio |
| --- | --- | --- | --- | --- | --- | --- |
| S01 開幕 | 0–6 | Black; spotlight snaps on at 0.5. Drapes pulled open on cords 1.0–2.6. Paper moon on a bamboo stick pushed up behind two hill flats 3.0–5.6 with a small overshoot. Cards 今晚， (0.3) and 陪伴著你 (2.0) lowered on strings. | On 2s; card landing 0.55 → 1.18 → 1 over three poses | Locked-off, push 1.00 → 1.04 | 5.6–6.0 a pink washi screen slides in along the floor groove | Lamp click, drape rustle |
| S02 剪影 | 6–8 | 6.0 the screen is back-lit; the plum silhouette hops in from bottom right on its rod, lands at 7.0. Gel swap pink → lavender on 7.0. Caption tags A / BRIGHTER / NIGHT / WITH / YOU drop in on strings. | Hop = 12 poses on an arc; landing tilts 4° and back (paper can't squash) | Push into the screen 1.04 → 1.10 | 7.75–8.2 the screen rolls up like a blind | Hit on 7.0, screen roll |
| S03 夜幕 | 8–10 | Plum night flat, gold stars on strings, big yellow moon lowered on two strings 8.0–8.7. Lavender triangle and pink block flats slide in on the 60° axis. Lavender silhouette at the left third. | Flats 2 poses per step; stars change angle every 4 frames | Hold 1.10 → 1.12 | 9.8–10.3 flats retreat along their axes; the moon stays as the hand-off | Low hit on 8.0, slide |
| S04 登場 | 10–16 | Painted backdrop (`end-stage.png`) flies in 10.0–10.8 and settles. Silhouette glides to the hero mark 10.2–11.6, then **flips over** on 12.0 to its full-colour face. Rocks on each bar and hops on 14. Vertical banner 月亮偶像 pushed up on a stick at 12.2; header lights. Falling paper petals. | Flip in 3 poses (back → edge → face) | Pull back 1.12 → 1.00 | 15.6–16.0 the backdrop moon is pulled out as a round card, brought forward and flipped | Flip "snap" into the chorus |
| S05 第一章 登場 | 16–18 | Pink field, plum bands from bottom-left; round card (profile) with gold rim and pull tab; ivory diamonds; 登場 / 今晚，陪伴著你 rise per character; gold-foil 01; FIRST APPEARANCE; card label MOON RABBIT · CHAPTER 01. Ring hops on each beat. | Stagger 0.07 s; foil 01 flips bright over 3 poses | Push on the card 1.00 → 1.05 | 17.6–18.3 kamishibai pull: the top card slides out right, field swaps to lavender | Soft paper tick per beat |
| S06 第二章 魅力 | 18–20 | Lavender field, plum band top-left → bottom-right; card (front portrait) moves to x 1110; a folded paper fan opens behind it as rays and turns slowly. 魅力 / 月亮偶像 / 02 / IRRESISTIBLE CHARM on the left. | Fan opens over 8 poses, one fold each | Truck with the card | 19.6–20.3 another card pull; field → deep plum, petals warm | Fan "whoosh" |
| S07 第三章 節拍 | 20–22 | Deep plum field, pink geometric lines; card with the winking face crop; pop-up paper sakura spring open around it. 節拍 / 陪伴著你 / pink outline 03 / FIND YOUR RHYTHM. | Pop-ups open over 4 poses, one per beat | Push 1.05 → 1.08 | 21.4–22.0 drapes snap shut (6 poses), closed on the 22.0 downbeat | Drape swish + hit |
| S08 謝幕 | 22–25 | 22.1–22.6 drapes reopen: the painted backdrop, the puppet bowing centre stage behind a ribbon ground row 今晚，陪伴著你; a rabbit-head marquee plaque hangs in front of the moon, its bulbs light one by one, flicker twice, then glow on the beat; NO.01. | Bulbs one per 2 frames; bow 8° over 2 poses and back; petals fall | Curtain call, 1.00 → 0.97 | Hold to the end | Final Fmaj7 at 22 s; optional paper confetti |

## Files

- `storyboards/storyboard.html` + `frames.js` — the visual storyboard; frames are drawn in Canvas 2D with the real assets.
- `storyboards/storyboard-paper-v1-page-1.png`, `-page-2.png` — rendered pages.

## Assumptions

- Kept the original 25 s timing, copy and music so the new version cuts to the same track.
- The puppet stays one rigid card (decided while building): the painting's foreshortened hand can't be cut into a clean joint. A layered PSD would allow jointed arms.
- Blue notes on the frames are storyboard annotations, not part of the film.
