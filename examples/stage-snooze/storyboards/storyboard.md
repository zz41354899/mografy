# Storyboard — stage-snooze

8 s loop, 16:9, light (look param: light, dark, minimal), quiet card.

| Time | Beat | Motion |
| --- | --- | --- |
| 0–2.2 s | Hover | The camera leans in; hover reveals the row’s actions. |
| 2.2–3.6 s | Snooze | The clock opens the menu; Tomorrow. |
| 3.6–5.6 s | Gone | The row slides away, the list closes up, the toast appears. |
| 5.6–8 s | Undo | Undo brings the row back; the hand goes home. |

Times come from the script in `scenes/main.ts` (`play()` decides them from cursor distance and holds); `meta.shots` comes from its `mark()` steps.
