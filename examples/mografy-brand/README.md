# mografy-brand

A self-contained Mografy scene project.

After installing Mografy, run from this folder's parent:

```sh
mografy dev ./mografy-brand
mografy check ./mografy-brand
mografy review ./mografy-brand
mografy export ./mografy-brand --format mp4
```

- Edit `scenes/main.ts` to change the animation; shared easing, spring, cursor and type helpers live in `scenes/kit.ts`.
- `mografy.json` contains project settings only.
- `storyboards/brief.md` preserves the original prompt; `storyboards/storyboard.md` documents the timing.
- `scenes/logo.ts` holds the official logo paths verbatim; do not edit them.
- No audio, tracking, or live social action is included.
