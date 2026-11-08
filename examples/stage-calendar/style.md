# Stage · Calendar drag — style

**Idea.** A meeting is carried, not slid: the card lifts under the hand, the drop target jumps from cell to cell, the card lands and the attendees confirm. Dragging it back is the loop.

Built with the Stage extra (`scenes/stage.ts`, see the Skill's `ui-stage.md`): a script played over state, one layout function, one look.

## Frame
A browser window (Plume) pinned top-left, running off the right and bottom; the camera leans in on the two days involved while the drag happens.

## Words
The week, day names, hours, and the one event (Design review with its time). Other events are tinted blocks with a line.

## Look
Tokens come from `look()` in `stage.ts`; the scene never hard-codes a colour the look owns, except the story's own accents. Inter 400 / 500 / 600. Layered shadows, one accent.

## Motion
`drag()` with a grab cursor that closes while carrying; `cursor.lift` (0.18 s up, 0.2 s down) drives tilt, scale and the ghost; the dashed target snaps by cell; attendee checks stagger by 0.25.
The loop ends exactly where it began (`play(..., { loop: true })` refuses a script that does not, and `meta.loop` makes `mografy check --motion` compare the last frame with the first).
