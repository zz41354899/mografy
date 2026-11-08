# Storyboard — stage-bento

5.7 s loop, 16:9, dark (look param: dark, light), no cursor.

| Time | Beat | Motion |
| --- | --- | --- |
| 0–1.4 s | Keys | ⌘ ↵ press in the object tile. |
| 1.4–2.2 s | Done | The task checks, strikes through, and the list closes up. |
| 2.2–4.6 s | It travels | 12 → 13 rolls; a chip travels Inbox → Today → Done. |
| 4.6–5.7 s | Next week | Everything resets in one quiet move. |

Times come from the script in `scenes/main.ts` (`play()` decides them from cursor distance and holds); `meta.shots` comes from its `mark()` steps.
