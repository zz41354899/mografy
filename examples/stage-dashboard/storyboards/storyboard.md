# Storyboard — stage-dashboard

6.5 s loop, 16:9, English UI, dark (look param: dark, light, blueprint).

| Time | Beat | Motion |
| --- | --- | --- |
| 0–1.6 s | Find the spike | Cursor moves to the spike; guide, point and tooltip appear. |
| 1.6–4.8 s | Explain it | Camera leans in; leader line and label; hold. |
| 4.8–6.5 s | Ease back = loop | Camera returns, label leaves, cursor goes home, tooltip hides. |

Times come from the script in `scenes/main.ts` (`play()` decides them from cursor distance and holds); `meta.shots` comes from its `mark()` steps.
