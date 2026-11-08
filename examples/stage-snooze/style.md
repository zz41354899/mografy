# Stage · Snooze — style

**Idea.** A feature card: hover reveals a row’s actions, the clock opens a small menu, Tomorrow snoozes the email and the list closes up; the toast’s Undo brings it back.

Built with the Stage extra (`scenes/stage.ts`, see the Skill's `ui-stage.md`): a script played over state, one layout function, one look.

## Frame
One quiet card (no chrome), centred, running off the bottom of the frame; the camera leans in on the row and its menu.

## Words
Inbox, the one email (sender and subject), the menu’s three choices, the toast. Every other email is lines.

## Look
Tokens come from `look()` in `stage.ts`; the scene never hard-codes a colour the look owns, except the story's own accents. Inter 400 / 500 / 600. Layered shadows, one accent.

## Motion
Hover state from the cursor position; the menu grows from its top edge; the row slides 60 px and fades, then its height collapses after 35 %; Undo reverses it on screen.
The loop ends exactly where it began (`play(..., { loop: true })` refuses a script that does not, and `meta.loop` makes `mografy check --motion` compare the last frame with the first).
