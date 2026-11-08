# Stage · Dashboard — style

**Idea.** The spike is the only thing that matters: the cursor finds it, the tooltip answers it, the camera leans in while one annotation explains it, then everything eases back.

Built with the Stage extra (`scenes/stage.ts`, see the Skill's `ui-stage.md`): a script played over state, one layout function, one look.

## Frame
The newer macOS window (tahoe: large lights, floating sidebar, tall toolbar) pins top-left and runs off right and bottom; a second card runs off the right edge as context.

## Words
Lumen, the nav labels, Growth, Signups, 5,074, May 21 / 1,284 signups, Launch post went live. Everything else is lines and shapes.

## Look
Tokens come from `look()` in `stage.ts`; the scene never hard-codes a colour the look owns. Inter 400 / 500 / 600. Layered shadows (hairline, mid, long soft), one accent.

## Motion
Crosshair cursor over the chart. Tooltip and guide fade and lift in 0.42 s; the annotation's leader line draws first, the label follows; camera 1.55× over 1.15 s, holds 2.3 s.
The loop ends exactly where it began (`play(..., { loop: true })` refuses a script that does not, and `meta.loop` makes `mografy check --motion` compare the last frame with the first).
