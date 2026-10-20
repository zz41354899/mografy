# Changelog

Notable changes to Mografy. Installation still contains only the sixteen built-in components; optional extras live in [`extras/`](extras/) on GitHub and are copied into a project only when it needs them.

Update from your Mografy checkout:

```sh
mografy update --check
mografy update
```

Older installations without `update`: stop the player, run `git pull --ff-only` and `pnpm install` once, then reopen with `mografy dev`.

## 2026-10-20

### Added

- **Project style file** — a project can now fix its design and motion decisions in `style.md` at the project root: do and don't rules, motion character, palette, type and tempo choices, composition and reference stills. Values stay in the scene code, defined once and changed there. The shared Skill and storyboard guidance read it before planning or editing. They take precedence over the Skill's default design guidance but never over the scene contract, and the current request still wins. Agents record a decision there only when you state or approve it as lasting. The file is optional; installation and new projects are unchanged.

### Fixed

- **`mografy dev` no longer creates a starter project in the wrong folder** — `mografy dev projects/<name>` typed in another repository's terminal (for example the website's) now opens that project from the Mografy installation. Previously it asked to create an empty starter beside the other repository's files, and answering yes started the player on that empty scene. Creating a missing project outside the Mografy folder now asks with No as the default; `--yes` still creates it.

- **Scene edits no longer get stuck behind a stalled scene** — work inside Chromium now has time limits: setup 30 s, the trial render 20 s, and each export, still or review frame 120 s. Previously an `await` in `setup` that never resolved (for example an image that never loads) or a loop in `renderFrame` that never ended blocked the project forever: every later edit waited silently, the player kept showing the old version and `mografy check` hung until the player was restarted. Now the scene error names the likely cause, the last working version keeps playing, and the next save is picked up normally.
- **Review no longer blocks live updates** — `mografy review` renders outside the project's write queue, so edits keep publishing while sheets render. Review compares against a video only when you pass `--video` or the player's last finished MP4/WebM export is of the current version. Before, any older `renders/<name>.mp4` was compared, decoding the video from the beginning for every sample. That gave meaningless PSNR and could hold up updates for a minute or more.
- **Bursts of saves collapse into one rebuild** — when several files change while a rebuild is running (multi-file edits, an extracted update archive), Mografy runs one follow-up rebuild with the latest files instead of a full compile and Chromium trial for every intermediate save.
- **Faster rebuilds with large assets** — fonts, images and audio are hashed once and reused until the file changes, instead of being reread on every scene save.
- **Playback resumes after a fix** — when `renderFrame` throws during playback, the player still pauses on that frame, and now resumes automatically once a fixed version loads. A player-side setup that never finishes is also limited to 30 s so later versions still appear.
- **`mografy check` uses the running player** — while a player serves the project, `check` asks it to rebuild from disk (new `POST /__mografy/check`) instead of starting a second Chromium, and the player shows the same result.
- **Chromium crash recovery** — a crashed or closed headless Chromium is relaunched for the next page instead of failing every later trial render.

## 2026-10-19

### Added

- **Codex motion-design guidance** — the existing shared `mografy` Skill now links to a Codex-only reference for visual concepts, type hierarchy, key poses, causal choreography, rhythm, continuity and review of actual rendered output. Small edits use only the relevant guidance. Claude keeps its existing workflow.
- **Motion-design example** — [`extras/motion-design.ts`](extras/motion-design.ts) and [rendered key poses](docs/motion-design/poses.png) demonstrate a continuous graphic handoff and a readable final hold. The authoring guidance remains generated from `packages/core/src/guide.ts`.

### Changed

- **Local visual-reference workflow** — private references connect actual frames and timed excerpts to specific design decisions, controlled comparisons and reconstruction practice. Human feedback is recorded for the relevant brief and kept in the local reference Skill. Disposable evaluation projects, comparison pages and test videos were removed after the useful guidance and still-image references were retained.

## 2026-10-18

### Added

- **WebM export** — VP9 video and optional Opus audio, available from the player and CLI with `--format webm`. Constant quality defaults to CRF 32, with Draft/Standard/High presets at 38/32/26. Both video formats support landscape/portrait sizes, Fit, effects, cancellation and completed-file playback. Size varies with scene complexity; CRF does not guarantee a byte budget.
- **Source updates** — `mografy update --check` checks the tracked upstream; `mografy update` fast-forwards a clean installation, installs/builds, synchronizes Skill guidance and restarts the active player on its original project/port. It waits for exports and rejects local changes, concurrent updates and diverged history. Older installations need the one-time manual update above.

## 2026-10-17

### Added

- **Camera and transitions extra** — [`extras/cinema/cinema.ts`](extras/cinema/cinema.ts)
  - Camera moves on photos or key art: push, pull, pan and tilt, never revealing an image edge (`plate`, `move`).
  - Transitions: crossfade, dip to colour, flash, iris, light slash, whip pan, and particle wipes with sakura petals, stars, circles or hearts (`crossfade`, `dipTo`, `flash`, `iris`, `slash`, `whip`, `particleWipe`).
  - Atmosphere: glow, drifting petals or snow, twinkling stars and light sweeps (`glow`, `drift`, `twinkle`, `lightSweep`).
  - [`cinema-demo.ts`](extras/cinema/cinema-demo.ts) is a fourteen-second tour of every transition.
- **Chinese and Japanese typography extra** — [`extras/cjk/cjk.ts`](extras/cjk/cjk.ts)
  - Vertical text (tategaki) with vertical punctuation and brackets, rotated long marks, small-kana placement, two-digit numbers set horizontally (10月17日), and column wrapping that follows kinsoku rules.
  - Horizontal CJK captions that wrap without punctuation at a line start and without splitting English words.
  - [`cjk-demo.ts`](extras/cjk/cjk-demo.ts) shows both.
- **CJK fonts** — [`extras/cjk/fonts/`](extras/cjk/fonts/): OFL-licensed Noto Sans CJK TC Medium and Noto Serif CJK TC Bold subsets covering kana, common Traditional Chinese, Japanese kanji and common Simplified characters.
- **Skill guidance** — new [camera and transitions](.agents/skills/mografy/references/camera-transitions.md) and [CJK typography](.agents/skills/mografy/references/cjk-typography.md) references. The agent fetches an extra on its own when a brief needs it, for example "make a video with sakura transitions" or "add vertical Japanese copy".

### Unchanged

- The project template, the sixteen built-in components, their thumbnails and the install and check commands.
