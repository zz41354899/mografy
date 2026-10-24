# Contextual music

[score.py](https://github.com/zz41354899/mografy/blob/main/extras/music/score.py) generates a film's score from its context. Instead of finding a track and cutting the animation to it, the agent describes what each part of the film needs in a cue file, `music.json`, and the generator synthesises music that follows it: sections with a mood and an energy level, and hits on the exact seconds where something happens on screen. When the animation's timing changes, update the cues and generate again; the music stays in sync. [music-example.json](https://github.com/zz41354899/mografy/blob/main/extras/music/music-example.json) scores the twelve-second intro.

## When to use it

Use it when the user wants music and has none, or asks for music that fits the film: product intros, logo stings, explainers, and abstract or particle pieces where atmosphere, rhythm and hits matter more than a memorable melody. If the user supplies a track, use theirs and align the scene to `ctx.beat(time)` instead. For a song with vocals or a strong hook, write the same cues as a text brief for an external music tool or library search, and use the generator only as a placeholder.

## Add to a project

The generator is an optional extra, not part of the installed template. It needs Python 3 with numpy; MP3 output uses ffmpeg, and the timeline image uses Pillow. If the project already has `music-src/score.py`, reuse it. Otherwise copy it from the current Mografy checkout (`extras/music/`) or download it:

```sh
mografy add music projects/<name>
```

`mografy add` copies from this checkout's `extras/` folder, or from GitHub when it is missing, keeps any project file that differs from the extra (`--force` replaces it), and prints the import line. It copies `music-src/score.py` and, when the project has none, an example `music-src/music.json` to rewrite for this film. Without the `mografy` command, download the same files from `https://raw.githubusercontent.com/zz41354899/mografy/main/extras/music/`.

`music-src/` is outside `scenes/` and `assets/`: the scene never imports it, and only the generated audio file goes in `assets/`.

## Workflow

1. **Storyboard first.** Write the cues after the shot plan (or after reading an existing scene), so every time comes from the actual animation. For a finished scene, read its source for the real transition and event times rather than the storyboard's approximations.
2. **Write `music-src/music.json`.** One section per shot or phase; choose its mood and energy from the shot's purpose. Add one hit for every on-screen event the audience should hear, at the scene's exact second, with a `note` naming the event. Put the main changes on bar starts where the scene allows it.
3. **Generate:** `python3 music-src/score.py music-src/music.json assets/music.mp3 --timeline storyboards/music-timeline.png`. The output is deterministic for the same cues and seed.
4. **Connect it** in `mografy.json` so the player, `ctx.beat(time)` and exports use it. Copy `bpm`, `offset` and `beatsPerBar` from the cues:

```json
"audio": { "path": "assets/music.mp3", "bpm": 120, "offset": 0, "beatsPerBar": 4, "gain": 1 }
```

5. **Check the timeline image.** Each section is a block whose colour is its mood and height its energy; white lines are hits; the waveform is underneath. Confirm that swells and impacts land on the hit lines and that the loudest passages match the film's climax. You cannot hear the result: say so, and ask the user to listen with the animation in the player.
6. **Iterate from the cues, never the audio file.** When the user says it is too busy, too dark or too loud, or when the scene's timing changes, edit `music.json` and regenerate. Keep the previous audio file under a new name if the user may want to compare.

## Cue file

| Field | Meaning |
| --- | --- |
| `duration`, `bpm`, `beatsPerBar`, `offset` | Length and beat grid; keep them equal to the scene duration and `mografy.json` audio settings. |
| `key`, `mode` | `C` … `B`; `major` or `minor`. One chord per bar. |
| `mood` | Default mood for sections that do not set one. |
| `rhythm` | `pulse` (default): beat pulses and eighth or sixteenth arpeggios. `flowing`: half and quarter notes, one long bass note per bar, soft bells for ticks. Prefer `flowing` for calm, cinematic or particle pieces, and when the user finds the music busy or choppy. |
| `texture` | `particles` adds a shimmer of tiny grains on the chord tones, denser with energy. A section can set its own. |
| `seed` | Fixes the random choices. |
| `sections[]` | `name`, `start`, `end`, `mood`, `energy`, `texture?`, `note`. |
| `hits[]` | `at`, `kind`, `strength?` (1 is normal), kind-specific fields, `note`. |

**Energy** is 0–1, or `[from, to]` for a ramp across the section. Below 0.3 there is only a pad and a sparse motif; from 0.3 bass and a quarter-note pattern enter; from 0.5 eighths (quarters in `flowing`); from 0.75 sixteenths in `pulse`.

**Moods:** `calm`, `warm`, `hopeful`, `playful`, `tech`, `tense` (minor harmony), `cosmic`, `epic`. Each sets the lead instrument (felt piano, pluck or bell), register, pad brightness and reverb.

| Hit | Use for | Fields |
| --- | --- | --- |
| `pop` | Something appears | |
| `burst` | A burst or big transition; includes a riser | `build` (seconds, default 1.5) |
| `impact` | A collision or collapse | `build` (default 0) |
| `gather` | Scattered elements converge on `at` | `length` |
| `swirl` | Elements stream round or morph | `length` |
| `sweep` | A light or wipe crosses the frame | `length` |
| `whoosh` | A camera move or cut | `length` |
| `fall` | Something drops | |
| `sparkle` | Highlights, small reveals | `count`, `every` |
| `ticks` | Typing, letters landing one by one | `count`, `every` |
| `resolve` | The final chord; only its ring-out follows | |

The rhythm drops out for half a second before each `burst` and `impact`, so they land with more weight. Use few hits: one per event the audience should notice, not one per moving element.
