# Stage · Bento — style

**Idea.** One event runs through a bento section planned as one picture: two keys are pressed, a task is done and the list closes up, the weekly count rolls, and the task travels into Done.

Built with the Stage extra (`scenes/stage.ts`, see the Skill's `ui-stage.md`): a script played over state, one layout function, one look.

## Frame
Four tiles on one grid with one gutter: only the tall tile shows the app (and the only window chrome, cropped by its tile); the others are a stat, an object (keycaps) and a diagram, so no two neighbours are the same kind.

## Words
Tile titles, one task name, the count and the three diagram nodes. The rest of the list is lines.

## Look
Tokens come from `look()` in `stage.ts`; the scene never hard-codes a colour the look owns, except the story's own accents. Inter 400 / 500 / 600. Layered shadows, one accent.

## Motion
No cursor (`pointer: false`): the keycaps are the cause. Check 0.42 s; the row strikes, fades and collapses; the count rolls; the chip travels the curve over 1.4 s; everything resets together over 0.6 s.
The loop ends exactly where it began (`play(..., { loop: true })` refuses a script that does not, and `meta.loop` makes `mografy check --motion` compare the last frame with the first).
