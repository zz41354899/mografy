# Stage · Invoices — style

**Idea.** One action carries the story: Mark paid sends the amount flying into this month's total, which rolls up while the camera leans in; the toast's Undo, clicked on screen, puts everything back.

Built with the Stage extra (`scenes/stage.ts`, see the Skill's `ui-stage.md`): a script played over state, one layout function, one look.

## Frame
The Kettle window pins to the top-left (inset 92 × 72 on the 1280 × 720 design stage) and runs off the right and bottom edges. One focal row; the stat cards keep one real number.

## Words
Story strings only: Kettle, the nav labels, Invoices, Collected in May, the total, Northwind Studio / INV-2041 / $4,200, Overdue → Paid, Mark paid, Payment recorded · Undo. Every other cell is a placeholder line.

## Look
Tokens come from `look()` in `stage.ts`; the scene never hard-codes a colour the look owns. Inter 400 / 500 / 600. Layered shadows (hairline, mid, long soft), one accent.

## Motion
Cursor holds 0.9 s, moves on a shallow arc, presses (0.1 s dwell). The chip flies 0.62 s with springEase(7.5, 0.8) and fades on landing; the total rolls only its changed digits right to left; camera pushes to 1.5× over 1.1 s, holds 2.1 s, returns over 1 s.
The loop ends exactly where it began (`play(..., { loop: true })` refuses a script that does not, and `meta.loop` makes `mografy check --motion` compare the last frame with the first).

## Variants: the five failures
The `variant` parameter draws the same story wrong on purpose, for side-by-side comparison: `too-much` (every cell spelled out, extra columns and stats), `too-little` (a wireframe: `words: 'none'`, grey avatars), `boxed` (the whole window shrunk into the middle), `flat` (every row the same weight with its own Mark paid, three equal stats, no camera push) and `bland` (default blue, Arial, square corners, no shadows). `good` is the default and the only one to build from.
