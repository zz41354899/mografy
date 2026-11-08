# Storyboard — stage-phone

7.6 s loop, 9:16, English UI, light (look param: light, dark).

| Time | Beat | Motion |
| --- | --- | --- |
| 0–2.0 s | Message arrives | Lock screen; the notification slides in and holds. |
| 2.0–4.6 s | Open and reply | Tap; the card grows into the thread; the reply is typed. |
| 4.6–6.4 s | Send | Tap send; the bubble forms out of the field, Sent → Read. |
| 6.4–7.6 s | Lock = loop | Side button pressed, dim, lock screen as at the start. |

Times come from the script in `scenes/main.ts` (`play()` decides them from cursor distance and holds); `meta.shots` comes from its `mark()` steps.
