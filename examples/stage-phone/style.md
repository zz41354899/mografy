# Stage · Phone reply — style

**Idea.** The notification is the object: it lands on the lock screen, a tap grows it into the conversation, the reply forms out of the field, and the side button locks the phone back to where it began.

Built with the Stage extra (`scenes/stage.ts`, see the Skill's `ui-stage.md`): a script played over state, one layout function, one look.

## Frame
The phone is cropped by the bottom edge (720 × 1280 design stage), a one-line headline above it. No cursor: taps show as a soft press dot.

## Words
Story strings only: the headline, Ava Chen · #launch, the incoming message, the typed reply, Sent → Read. History bubbles are placeholder lines.

## Look
Tokens come from `look()` in `stage.ts`; the scene never hard-codes a colour the look owns. Inter 400 / 500 / 600. Layered shadows (hairline, mid, long soft), one accent.

## Motion
Notification slides in from above (0.42 s spring). The open is a container transform from the card to the full screen (0.62 s, springEase(6.5, 0.85)). Typing at 22 characters per second; the sent bubble rises out of the field. The lock is a side-button press with a 0.7 s sin² dim that hides the swap.
The loop ends exactly where it began (`play(..., { loop: true })` refuses a script that does not, and `meta.loop` makes `mografy check --motion` compare the last frame with the first).
