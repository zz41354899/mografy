# Stage · Two screens — style

**Idea.** One action crosses two screens: a request sent on the web arrives on another person’s phone, is paid with two taps, and comes back as Paid with the total rolling.

Built with the Stage extra (`scenes/stage.ts`, see the Skill's `ui-stage.md`): a script played over state, one layout function, one look.

## Frame
A browser window on the left and a phone overlapping its right edge, cropped by the bottom of the frame. The window steps back (recede) while the phone has the viewer’s attention.

## Words
The split, its total, the collected amount, You and Sam with their rows, the request and payment sheet.

## Look
Tokens come from `look()` in `stage.ts`; the scene never hard-codes a colour the look owns, except the story's own accents. Inter 400 / 500 / 600. Layered shadows, one accent.

## Motion
The cursor works the web; taps (a soft press dot, the cursor never jumps) work the phone. The notification grows into the payment sheet; the window recedes 3.5 % with a dim; the total rolls and the progress bar grows.
The loop ends exactly where it began (`play(..., { loop: true })` refuses a script that does not, and `meta.loop` makes `mografy check --motion` compare the last frame with the first).
