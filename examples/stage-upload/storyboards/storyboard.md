# Storyboard — stage-upload

7.4 s loop, 16:9, blueprint (look param: blueprint, light, dark), no cursor.

| Time | Beat | Motion |
| --- | --- | --- |
| 0–2.0 s | Signed URL | The file goes from your app to the Upload API. |
| 2.0–3.4 s | Chunks | Three chunks travel to Storage. |
| 3.4–4.4 s | Edge | Storage to the edge cache. |
| 4.4–7.4 s | Link | The viewer gets a link; hold; fade back. |

Times come from the script in `scenes/main.ts` (`play()` decides them from cursor distance and holds); `meta.shots` comes from its `mark()` steps.
