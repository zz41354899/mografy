# Storyboard — stage-request

10 s loop, 16:9, light, web + phone.

| Time | Beat | Motion |
| --- | --- | --- |
| 0–2.2 s | Request | Click Request $40; the row shows Requested. |
| 2.2–4.7 s | On the phone | The request arrives; a tap opens it; a tap pays. |
| 4.7–7.2 s | Paid | The phone settles; the web rolls $40 → $80 and Sam turns Paid. |
| 7.2–10 s | New split | New split resets everything. |

Times come from the script in `scenes/main.ts` (`play()` decides them from cursor distance and holds); `meta.shots` comes from its `mark()` steps.
