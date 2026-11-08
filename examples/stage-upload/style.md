# Stage · Upload diagram — style

**Idea.** A docs diagram that moves only where the reader should look: a file travels from your app to a link, and each hop gets one short annotation.

Built with the Stage extra (`scenes/stage.ts`, see the Skill's `ui-stage.md`): a script played over state, one layout function, one look.

## Frame
A full-frame drawing with a faint grid; five nodes on one line; annotations alternate above and below so they never collide.

## Words
Node names, three annotations, the link. Each node has one placeholder line.

## Look
Tokens come from `look()` in `stage.ts`; the scene never hard-codes a colour the look owns, except the story's own accents. Inter 400 / 500 / 600. Layered shadows, one accent.

## Motion
No cursor. Packets travel each hop (three staggered chunks into Storage); the active node gets an outline; each annotation draws its leader first, then the label; everything fades together at the end.
The loop ends exactly where it began (`play(..., { loop: true })` refuses a script that does not, and `meta.loop` makes `mografy check --motion` compare the last frame with the first).
