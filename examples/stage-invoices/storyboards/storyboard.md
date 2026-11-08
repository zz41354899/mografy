# Storyboard — stage-invoices

7 s loop, 16:9, English UI, light (look param: light, dark, blueprint, minimal).

| Time | Beat | Motion |
| --- | --- | --- |
| 0–1.5 s | Hold, then Mark paid | Cursor rests, arcs to the button, presses; the row lights on hover. |
| 1.5–2.2 s | The cause lands | The badge turns Overdue → Paid, the button leaves, $4,200 flies into the total. |
| 2.2–5.0 s | Payoff | Total rolls $18,400 → $22,600, +$4,200 badge, toast; camera leans in, holds, returns. |
| 5.0–7.0 s | Undo = loop | Cursor clicks Undo, everything reverts, cursor returns to its first position. |

Times come from the script in `scenes/main.ts` (`play()` decides them from cursor distance and holds); `meta.shots` comes from its `mark()` steps.
