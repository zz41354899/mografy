# Mografy intro reference

Use the existing intro as a reference for multi-shot storytelling, deterministic transitions, responsive text layout, and a branded ending. Read [the project settings](https://github.com/zz41354899/mografy/blob/main/examples/mografy-intro/mografy.json), [scenes/main.ts](https://github.com/zz41354899/mografy/blob/main/examples/mografy-intro/scenes/main.ts), and [scenes/logo.ts](https://github.com/zz41354899/mografy/blob/main/examples/mografy-intro/scenes/logo.ts) before adapting it. The current source is a 1920 × 1080, twelve-second, 30fps Canvas scene on a paper-colored background with ink and teal accents.

## Four implemented beats

| Beat | Active source window | Function | What to learn |
| --- | --- | --- | --- |
| Code becomes an idea | 0.1–2.6 seconds | `beatCode` | Measured colored text segments, time-based typing/caret, and a caption. |
| Playback and scrubbing | 2.4–6.9 seconds | `beatScrub` | A preview frame, playhead, and reverse scrubbing derived from the same absolute time. |
| An external edit updates the player | 6.8–9.9 seconds | `beatChat` | Stable wrapping before typing, a reply, color/timing change, and an update toast. |
| Brand ending | 9.85–12 seconds | `beatLogo` | Original logo pieces revealed with clipping, staggered wordmark letters, and a closing tagline. |

The active windows overlap deliberately during transitions. They describe this implementation rather than a mandatory storyboard schedule. `renderFrame` calls all four beat functions; each derives visibility and motion from time. `window_` combines entrance and exit curves, and `revealPiece` clips the original logo paths. Read the real source when deciding the pose or overlap at a particular instant.

## Assets and copy

- ABeeZee Regular is loaded through `mografy.json`; keep its bundled `assets/OFL.txt` when copying the font. The scene uses Canvas text measurement and `wrap` to fit longer copy.
- The existing music file is `assets/intro-music.mp3`, with a 120 BPM grid, offset −0.1 seconds, four beats per bar, and gain 1. The logo entrance starts around the 9.9-second cue. Preserve the asset and settings when adapting this specific project unless the brief requests a change.
- The five subtitle params are `codeCaption`, `playCaption`, `scrubCaption`, `chatCaption`, and `tagline`. `request` is ordinary scene copy. `accent`, `ink`, and `vignette` affect the image.
- The current film's text mentions Claude. Read the exact scene copy before describing or translating it. For a new brief, adapt the script deliberately; the product workflow also supports Codex.

## Apply the reference

Use its sequence structure to plan setup, demonstration, change, and payoff. Retain relevant motion principles, clear focal points, readable holds, and continuity between shots. Reuse the technique in the selected project's own scene modules, with its assets and proportions. For small reusable motifs, read [built-in-components.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/built-in-components.md).

Save a project-specific English storyboard under `storyboards/` when requested, following [storyboard.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/storyboard.md). Codex creates visual boards with image generation; Claude uses Artifacts or a standalone local HTML/Canvas preview. A new storyboard may require longer text holds than this existing twelve-second film.

## Validation and review

From the owning repository, use:

```sh
mografy dev examples/mografy-intro
mografy check examples/mografy-intro
mografy review examples/mografy-intro
```

The existing review times are 1.8, 3.6, 5.4, 8.9, and 11.8 seconds. Transition strips cover 2.0–3.2, 8.4–9.4, and 9.8–11.4 seconds at 0.1-second steps. Inspect the generated PNGs, including output frames with sampling or effects. Validate repeat and random seeks, caption layout, chat-bubble stability, logo identity, and the final hold. Export only when requested, using `mografy export examples/mografy-intro --format mp4|lottie|svga`.
