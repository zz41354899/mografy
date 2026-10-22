# Presentations: marking slides

A Mografy project can be presented live: the editor's **Video / Present** switch turns the same scene into slides, and each slide plays into its frame and waits for the speaker. Slides are never added by hand. They come from the scene's **shots**, which you mark in the scene's `meta`. Do this whenever the user asks for slides, a presentation, 簡報, Present mode, or to "mark the shots", and offer it after building a multi-shot film.

## The format

```ts
export const meta = {
  width: 1920, height: 1080, duration: 30, fps: 30, background: '#101114',
  // Present mode: one slide per shot; each slide waits on its `stop` frame.
  shots: [
    { end: 4, stop: 3.3, title: 'Opening' },
    { end: 9, stop: 8.2, title: 'Ask anything' },
    { end: 30, stop: 29, title: 'Logo' },
  ],
};
```

- `end`: when the shot ends and the next begins, in seconds. Strictly increasing; the last one is normally `meta.duration`. Shots past the duration are dropped.
- `stop`: the frame the slide waits on, after the previous shot's `end` and no later than its own `end`. Without it, the slide waits one frame before `end` (the last slide waits at the very end).
- `title`: the slide's name, up to 120 characters, in the user's language.
- At most 200 shots. Leave single-shot scenes without them.
- **A scene without `shots` still gets slides automatically.** `pnpm install` and `mografy update` write Mografy's guess into `mografy.json` as `slides.shots` (same format) with `"guessedFrom": "storyboard"` or `"picture"`, and the running player guesses the same way for scenes that have neither. The guess uses the shot table in `storyboards/storyboard.md` when its time ranges run from 0 to the scene's duration (titles from its title, purpose or copy column), otherwise where the picture changes, and stops each slide on the stillest frame shortly before the shot ends. The editor then says "Slides guessed from …". Order of precedence: the scene's `meta.shots`, then `slides.shots`, then the live guess. When asked to mark or fix slides, write `meta.shots` in the scene as below and delete the guessed `slides.shots` and `slides.guessedFrom` (keep `slides.pages`, `hold` and `music`); never edit `.mografy/auto-shots.json`.
- Shots are presentation metadata only. Never change animation timing to fit slides, and video export ignores them.

## Marking the shots of a project

1. **Read the whole project.** Open `mografy.json` (its `scene` entry, `audio`, `review.times`, `review.transitions`, and any existing `slides`), the scene entry file, and every module it imports. Also read the storyboard (`storyboards/`) and `music-src/music.json` when present. Shot timing usually exists already: storyboard shot ranges, time constants or section tables in `renderFrame` (`const SHOTS = [...]`, `seg(t, 4, 8)`, `if (t < 12)`), named review transitions, and music cue times.
2. **Find the boundaries.** A shot is one idea or composition; it ends where the next one starts taking over. A review transition that starts at 9.4 s usually means the previous shot ends there. Prefer the storyboard's shots; merge tiny fragments under about 1.5 s into a neighbour.
3. **Pick each stop frame.** Choose the latest moment where the shot is complete and readable: copy fully typed and on screen, the hero element settled, nothing mid-fade, mid-wipe or blurred by a transition. This is often 0.3–1 s before `end`, because many scenes start fading or moving to the next shot early. For the last shot, stop on the settled end card or logo, before any fade to black.
4. **Name each slide** from its on-screen headline or storyboard shot name.
5. **Write `meta.shots`** into the scene entry's exported `meta` with the comment shown above. Keep the other `meta` fields as they are.
6. **Validate.** `mografy check [project]` must print `✓ N shots, N presentation slides`; fix any shot error it reports. Then run `mografy review [project]` and open `renders/review-<version>-slides.png`: one cell per slide at its stop frame (for a scene without shots, the sheet shows the guessed slides and says so). Move any stop whose cell is blank, faded, half-typed or mid-transition, and review again.
7. **Report** the slide count and titles to the user, plus any slide you were unsure about.

## Presentation settings in mografy.json

Write these when the user asks for them (never invent speaker notes); the editor's mute button also sets `music`:

```json
"slides": {
  "hold": "freeze",
  "music": "duck",
  "pages": [{}, { "title": "Override title", "notes": "What to say", "hold": { "loop": 1.2 } }]
}
```

`pages[i]` belongs to shot `i`; every field is optional. `hold` is `"freeze"` (stop on the frame) or `{ "loop": seconds }`, which keeps replaying the last seconds before the stop so idle motion continues; use it only where those seconds loop cleanly. `music` is `"duck"` (music fades out at each stop and back in on the next transition) or `"off"` (muted).

## What the user sees

- **Video mode:** the timeline's seconds ruler shows a triangle at every slide's stop; clicking one jumps there.
- **Present mode:** slide thumbnails on the left (the panel button hides them) and the stage, with a playback menu in the middle when the mouse is over it: previous, play into the slide, mute, next. ← / → change slides, Space plays. Titles, notes and holds are not edited there: they come from `meta.shots` and `mografy.json` `slides`, which you write.
- **Start** opens the presentation full page: a top bar (back to the editor, slide title, Live/Locked, speaker view, full screen) and a bottom menu with slide progress; both fade while the mouse rests. → / Space / click next, ← previous, a number then Enter jumps, M mute, F full screen, B black screen, P speaker view with notes and timer, K locks the current version while editing continues, Esc returns to the editor.
- **Export HTML** writes and downloads `renders/<name>-presentation.html`: one offline file with the scene, fonts, images and music embedded. Terminal: `mografy export [project] --format html`.
- The sixteen built-in component projects cannot be presented; the switch stays in Video.
