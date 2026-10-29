# Default taste

Read this before a storyboard and again before delivery. These are Mografy's defaults when the project's `style.md` and the brief say nothing else; the project's own decisions always win. Each rule gives its reason, so apply the reason to cases the rule does not name. Sizes are for a 1920 × 1080 canvas unless stated.

## Pacing: the viewer reads every word and sees every change

- **Caption hold.** Keep a caption fully readable (after its reveal settles) for at least 0.5 s + characters ÷ 4.5 for Chinese or Japanese, or 0.5 s + words ÷ 3 for English. A 6-character line holds ≥ 1.8 s, a 12-character line ≥ 3.2 s, a 9-word line ≥ 3.5 s. Viewers meet the line for the first time while also watching the picture, and need a beat to take it in after reading it. When the hold does not fit the shot, cut copy before shortening the hold.
- **Result hold.** After a state changes (a number lands, a check draws, a card arrives), hold 0.6–1.0 s before the next move. A change nobody had time to see did not happen.
- **One action per shot**, 2.5–4 s per shot for UI and explanation, longer for a reading hold. Two actions at once split attention and neither reads.
- **Length changes come from holds.** To hit a length, shorten or lengthen still holds; never speed up an action, because a rushed action looks like a glitch. If the copy cannot be read in the requested length, cut copy or say so; do not speed up the whole film.
- **Camera and cursor.** Start a camera move up to 0.5 s before the action it serves; never move the camera during a click or a reading hold. Give a cursor up to 1.1 s per move on a gentle arc and let it rest on the control before clicking. The eye needs to arrive before the event.
- **Smooth, not fast.** A move across more than half the frame takes at least 0.6 s, and an exit at least 0.4 s; ease through every key instead of stopping and starting again. A whip that crosses the frame in a few frames reads as a stutter on most screens, even when every frame renders on time.
- **Overlap cuts.** Start the incoming action 0.2–0.5 s before the outgoing exit ends, so no frame is empty.

## Type and layout: legible at the size it is watched

- **Headlines 96–160 px, body copy ≥ 40 px, nothing under 24 px** except UI detail that is not meant to be read. A 1080p film is often watched in a small window or on a phone, where 24 px is already small.
- **Portrait (1080 × 1920):** headlines ≥ 110 px, captions ≥ 44 px, captions in the top third. Phones are held at arm's length and the bottom is covered by platform UI.
- **Redrawn UI at 1.3–1.6× the app's own type size,** with 3–4 rows per list. A real screen shrunk into a frame is unreadable.
- **Few words at once:** at most about 12 English words or 20 CJK characters on screen outside the product UI. More is a slide, not a film.
- **Safe margins:** keep copy and logos at least 96 px from the sides and 72 px from the top and bottom in 16:9; use the portrait margins in [output.md](output.md). Players and platforms crop and overlay the edges.
- **One card style:** one corner radius, one shadow, one padding (≥ 48 px inside a card) across the film. Mixed styles read as different products.
- **No text over text.** Captions never overlap UI or other captions, and text never cross-dissolves over UI. Overlapping type is unreadable for the overlap's whole duration.

## Design system: decide it once, before the first shot

A film looks designed when every shot is built from the same few decisions. Write them as tokens at the top of the scene (`const C = {…}`, one object per type role) before drawing anything, and draw every shot from them.

- **Four type roles, no more.** A display face for headlines and item names (a serif, or a heavy sans) and a text face for everything else. Portrait sizes as a starting scale: kicker 40–48 px (text face 500, accent colour, tracking 8–12), headline 120–150 px (display 700, tracking 4–8), item name 100–120 px, descriptor 48–56 px (text face 500, muted colour). For 16:9 use about 0.8× these. Contrast between a big display line and a small, wide-tracked kicker is what reads as designed; five sizes that are all similar read as a document.
- **A numbered kicker for lists.** When the film walks through items (products, steps, features), put `No.01`, `No.02`… or a short label above each name in the kicker role. It tells the viewer where they are and gives each shot the same structure.
- **One fixed layout for repeated shots.** Shots that do the same job share one composition: the copy block at the same position (portrait: centred in the top third), the subject at the same spot (portrait: centred around 55–60 % height), the same subject size. Only the content changes, so the eye knows where to look and the cut feels like a page turn, not a new film.
- **Palette: five roles.** A light or dark background with a slightly lighter centre (a soft radial gradient, never flat grey), an ink tinted towards the background's hue (never pure #000 on cream or #FFF on navy), a muted colour for secondary text, one accent for the kicker, highlights and the logo, and the subject colours from one family around the accent. A second accent splits attention.
- **Leave about 40 % of the frame empty.** Big type and one subject on calm space look expensive; filling the frame with surfaces (a dark floor across the bottom third, panels behind every line) makes it look heavy and cheap.
- **Simple, flat illustrations.** When you draw the product or objects yourself, use few geometric shapes, a flat fill or one gentle gradient, one soft contact shadow, and one recurring accent motif (a leaf, a spark, a dot) that can travel between shots. Detail belongs to the subject's one identifying feature (the latte art, the ice), not to everything.
- **The ending is the biggest type in the film.** The wordmark at about 1.2–1.4× the headline size with wide tracking, a small Latin or secondary line under it, the tagline in the accent colour, and, when the film listed items, a small recap of them as a row of icons.

## Look: nothing that competes with the message

- **Still holds.** No idle drift, bobbing or slow zoom while the viewer reads; every motion has a cause and ends. Motion pulls the eye away from the words.
- **No decoration for its own sake.** No dot grids or busy patterns; a quiet gradient, one glow or the brand's colour field. Texture behind type lowers its contrast.
- **The logo once.** The brand mark lands at the end, about 20–30 % of the frame width, held still with the tagline for ≥ 1.5 s; it does not open the film or repeat in every shot. Repetition spends the payoff.
- **On-screen language follows the brief.** Plans, shot labels and prompts stay in English; preserve supplied copy unless translation is requested.

## Sound

- **Sustained, warm music:** long pads, warm piano, one long bass note per bar, few hits on the moments that change the story. Busy patterns fight the picture.
- **No sharp high sounds:** no bells, sparkles, ticks or pops; soft whooshes and low hits instead. They are tiring on repeat and on headphones. Details in [music.md](music.md).
