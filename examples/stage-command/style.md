# Stage · Command palette — style

**Idea.** Every change is caused by a key: ⌘K opens the palette, typing filters it, Return assigns, ⌘Z undoes. The keycaps at the bottom of the frame are the cursor of this film.

Built with the Stage extra (`scenes/stage.ts`, see the Skill's `ui-stage.md`): a script played over state, one layout function, one look.

## Frame
The newer macOS window (Keel), pinned top-left; the palette dims the page; the camera leans in on the Assignee field after the avatar lands. Keycaps are drawn outside the camera.

## Words
The issue key and title, Status, Assignee, the palette query and its first two commands.

## Look
Tokens come from `look()` in `stage.ts`; the scene never hard-codes a colour the look owns, except the story's own accents. Inter 400 / 500 / 600. Layered shadows, one accent.

## Motion
Palette grows from its top edge (0.4 s); the list filters as characters arrive; the avatar flies from the chosen row into the field (0.5 s, springEase(7.5, 0.8)); keycaps press with a 0.16 s ease.
The loop ends exactly where it began (`play(..., { loop: true })` refuses a script that does not, and `meta.loop` makes `mografy check --motion` compare the last frame with the first).
