# Changelog

Notable changes to Mografy. Installation still contains only the sixteen built-in components; optional extras live in [`extras/`](extras/) on GitHub and are copied into a project only when it needs them.

Update from your Mografy checkout:

```sh
mografy update --check
mografy update
```

Older installations without `update`: stop the player, run `git pull --ff-only` and `pnpm install` once, then reopen with `mografy dev`.

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
