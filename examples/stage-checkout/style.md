# Stage · Checkout — style

**Idea.** A purchase in three causes: the email is typed, Pay is pressed and holds a spinner, the form gives way to a confirmation whose check draws itself. Done returns to the empty form.

Built with the Stage extra (`scenes/stage.ts`, see the Skill's `ui-stage.md`): a script played over state, one layout function, one look.

## Frame
A browser with tabs (Fernleaf), pinned top-left and running off the right; the order summary card sits right of the form.

## Words
Store name, Email and the typed address, the Pay button, the one line item and total, the confirmation. Payment fields are lines, on purpose.

## Look
Tokens come from `look()` in `stage.ts`; the scene never hard-codes a colour the look owns, except the story's own accents. Inter 400 / 500 / 600. Layered shadows, one accent.

## Motion
Text cursor over the field, pointer over buttons; typing at 20 characters per second; spinner 0.95 s; the form lifts away as the confirmation rises; the check draws over 0.5 s.
The loop ends exactly where it began (`play(..., { loop: true })` refuses a script that does not, and `meta.loop` makes `mografy check --motion` compare the last frame with the first).
