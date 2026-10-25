# follow-interaction

A self-contained Mografy scene project.

After installing Mografy, run from this folder's parent:

```sh
mografy dev ./follow-interaction
mografy check ./follow-interaction
mografy review ./follow-interaction
mografy export ./follow-interaction --format mp4
```

- Edit `scenes/main.ts` to change the animation; shared easing, spring, cursor and type helpers live in `scenes/kit.ts`.
- `mografy.json` contains project settings only.
- `storyboards/brief.md` preserves the original prompt; `storyboards/storyboard.md` documents the timing.
- Inter is bundled in `assets/` with its SIL Open Font License (`Inter-LICENSE.txt`).
- No audio, tracking, or live social action is included.
