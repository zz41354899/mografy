# Changelog

[English](CHANGELOG.md) | [繁體中文](CHANGELOG.zh-TW.md)

Notable changes to Mografy. Installation still contains only the sixteen built-in components; optional extras live in [`extras/`](extras/) on GitHub and are copied into a project only when it needs them.

Update from your Mografy checkout:

```sh
mografy update --check
mografy update
```

Older installations without `update`: stop the player, run `git pull --ff-only` and `pnpm install` once, then reopen with `mografy dev`.

## 2026-10-29

### Changed

- **Mografy Skill rewritten.** `SKILL.md` now opens with hard rules, a glossary and a table of which reference to read for which job, then numbered steps with their outputs and a checklist before delivery. The description lists the requests that should trigger it, in English and Chinese. A new [`taste.md`](.agents/skills/mografy/references/taste.md) gathers the default taste in numbers, each with its reason: caption and result holds, smooth timing, type sizes and safe margins, and a design system (four type roles, a five-role palette, one layout for repeated shots, about 40 % empty space). A new film starts from one visual idea that travels through every shot.
- **Every project keeps a `style.md`.** The Skill writes it when it plans a new film, or from the scene before changing a project that has none. `mografy check` warns when it is missing.

## 2026-10-27

### Added

- **Mografy Templates** — a free library of 43 ready-made templates for product demo videos in [`templates/`](templates/), all in English: 22 native 9:16 templates for short video (hooks, captions, phone and desktop screens, click zoom, typing, AI chat, callouts, before/after, steps, numbers, reviews, logo, end card, transition) and 21 16:9 templates for landing pages, YouTube and decks (ids ending in `-wide`). The 9:16 templates share an editorial look (white page, black Anton headlines, one orange accent; `light` / `dark` themes) and the 16:9 templates the look of the montage film (`night` / `light` / `neon` grounds, spectrum light and kinetic type). Templates that exist in both ratios point at each other with `pair`. Copy, theme and accent are params, and `safeGuide` shows the social safe area in the preview.
- **`mografy add <template...> [folder]`** — copies templates with the shared `kit.ts`, `editorial.ts` and `montage.ts`, Inter (500–800) and Anton into a project and registers the fonts; templates and helpers can be added in one command. When the folder is not a project yet, it is created with the templates' aspect ratio, a `scenes/main.ts` that plays them in order and output glow and grain off. A project without a `tsconfig.json` gets one for editor support, and every template type-checks in strict mode with no implicit `any`. `play(ctx, time, start, template, params)` plays a template inside a film; `backdrop: false` draws overlay templates over the film's picture.
- **Install and update** — `pnpm install` now ends by suggesting a template command (`mografy add hook-impact cta-endcard projects/my-post`) next to the reference films and helpers. `mografy update` brings new templates with the rest of the checkout and re-syncs the Skill, so nothing extra is needed.
- **Templates reference in the Skill** — `references/templates.md` tells the agent when to start from a template, how to add and edit it, and lists the catalog.
- **Maintainer scripts** — `pnpm templates:preview <id> [--theme=<name>]`, `pnpm templates:sync`, `pnpm templates:media <dir>`, `pnpm templates:web <dir>` (the website's live player) and `pnpm templates:typecheck`.

### Fixed

- **`mografy add` without a project** — adding templates to a new folder (`mografy add hook-impact projects/my-film`) failed with "has no mografy.json", outside a project the error suggested a wrong command, and inside the Mografy folder `add` silently put the files into the last opened project. Templates now create the project they need, `add` never falls back to the last opened project, and helpers without a project fail with the command to run.

## 2026-10-25

### Added

- **Film runtime helpers** — `@mografy/runtime` now includes `keys` (monotone cubic keys), `cameraPath` and `withCamera` (one camera for the whole film), `beats` (one shot table for `meta.shots`, review times and handoffs), pooled `buffer`, `bloom`, and a `bounds` option for `layer` and `blurLayer`. `blurText` blurs type with the glyph's shadow instead of a filter. All of them accept the scene context or a plain 2D canvas, so a storyboard page can draw the real film.
- **Frame cost in `mografy check`** — check prints the median and slowest frame time and warns about frames over 100 ms, more than eight filters in one frame, and canvases created on every frame.
- **`film-starter` example** — `mografy add film-starter <folder>` copies a twenty-second model film, with the Inter subsets it uses, to start a new film from: one light the eye follows from a point to a line, a card that grows out of the line and plots an ease curve, a ring of light and the last line's full stop; one camera, one shot table.
- **Reference films** — `examples/` now holds three finished films: mografy-montage (60 s), mografy-triangulum (42 s) and mografy-story (71 s). They use the new runtime helpers and one shot table each; against their earlier versions they look the same frame for frame, and the montage draws a frame about four times faster. `mografy add <name> [folder]` copies one to build on. The Skill's new `examples.md` says what each one teaches.
- **One `mografy add` for films and helpers** — `mografy add` lists the reference films and the helpers together. `mografy add <film> [folder]` copies a film into your library; `mografy add <helper...> [project]` adds one or more helpers at once (`mografy add film music`). Installation ends by suggesting a few of them.
- **Layers in film units** — inside `layer`, `blurLayer` and `bloom`, shadow and filter lengths are now in film units like on the frame, so cards and glows keep their size on a Retina preview and in 4K exports. `TextStyle.family` accepts a CSS font stack.

### Changed

- **Skill** — `SKILL.md` starts with a quality floor for continuity and performance. New references: film architecture, performance, and output (aspect ratio and export, moved out of scene authoring). The Codex-only motion supplement is now the shared `motion-design.md`, with default taste (calm pacing, still holds, big type, one logo, sustained music). Walkthroughs use one film camera with a local zoom per card.
- **Scenes** — `setup` is optional.
- **cinema** — `crossfade` reuses one pooled buffer instead of creating a canvas per frame.

## 2026-10-24

### Fixed

- **Windows install** — `pnpm install` failed on Windows with `No projects matched the filters`, so no package was built and `sync:skills` then stopped on a missing `@mografy/core/dist/index.js`. pnpm runs scripts through `cmd` on Windows, which does not treat single quotes as quotes. The root `package.json` scripts (`build`, `typecheck`, `test`, `test:browser`, `test:compression`, `install:tool`) now use escaped double quotes, which work on macOS, Linux and Windows. Windows users who hit this: run `mografy update` (or `git pull --ff-only`), then `pnpm install`.
- **Windows install, part 2** — `sync:skills` then stopped with `Preserving an existing custom Claude entry: .claude\skills\mografy`. Git on Windows checks the repository's `.claude/skills/mografy` symlink out as a small text file unless symlinks are enabled. `sync:skills` now recognises that placeholder and leaves it as Git wrote it, so the checkout stays clean for `mografy update`; Claude still reads the Skill through the root `CLAUDE.md`. When the entry is missing on Windows it is recreated as a junction, which needs no administrator rights.
- **Windows `mografy` command** — `install-command` only printed a PowerShell function on Windows, so `mografy` was not found in a new window after installing. It now writes `mografy.cmd` into a writable folder already on `PATH` (`%APPDATA%\npm`, `PNPM_HOME` or `%LOCALAPPDATA%\Microsoft\WindowsApps`), which works in both cmd and PowerShell; the PowerShell function remains the fallback.
- **`mografy update` on Windows** — running `pnpm.cmd` failed with `spawn EINVAL` on current Node versions, which no longer start `.cmd` files without a shell. It now runs through the shell on Windows.
- **Windows checkouts stay clean after a build** — Git on Windows checks text files out with CRLF line endings, so `pnpm build` regenerated `packages/core/src/skill-text.ts` with different line endings and left it modified, after which `mografy update` refused to run ("Local changes found"). The generator now normalises the Skill Markdown to LF.
- **Windows file saves** — a virus scanner or the search indexer can hold a just-written file for a moment; saves into a project now retry briefly instead of failing with `EPERM`.
- **Windows project names** — a project named after a Windows device name (`CON`, `NUL`, `COM1`…) or ending in a dot now gets a folder name Windows can create.

## 2026-10-23

### Added

- **Motion helpers in `@mografy/runtime`** — scenes no longer need a copied kit for the basics. New easing curves `ease.outQuart`, `outQuint`, `inOutQuart` and `inOutSine`; eased time windows `at()` and `win()`; one spring that settles exactly on 1 at a set time, `spring(time, start, duration, bounce)`, and spring easing curves `springEase()` with the presets `springs.out / pop / camera / cursor`; follow-through `settle()`, `pulse()` for presses and flashes, and `stagger()`. The walkthrough extra now uses these, with identical frames.
- **One tempo for picture and music** — a scene can declare `meta.tempo = { bpm, beatsPerBar, offset }` and build its timing constants with `tempoGrid(tempo).onBar(n, k)`. `ctx.beat(time)` falls back to `meta.tempo` before the project has audio, and `mografy check` reports a tempo that differs from the `audio` settings in `mografy.json`.
- **Layer helpers** — `roundRect()`, `surface()` (soft two-layer elevation), `text()` / `measure()` with tracking and alpha, `riseWords()` (words rise into a mask) and `blurWords()` (words come into focus), with `separator: ''` for CJK copy. `ctx.draw` gains `linearGradient()`, `radialGradient()` and `conicGradient()`.
- **`mografy add <extra> [project]`** — copies an optional extra (cinema, cjk, three, music, walkthrough) into a project from this checkout, or from GitHub when `extras/` is missing; registers the CJK fonts in `mografy.json`, keeps files you changed unless `--force`, and prints the import line. `mografy add` lists them. Installation still contains only the sixteen built-in components.

### Documentation

- The scene-authoring reference has new **Randomness** (decide in `setup` with `ctx.random()`, use `ctx.noise()` only for per-frame variation), **Tempo and music**, **Time and motion helpers** and **Layer helpers** sections; the extra references use `mografy add`.

- **Product walkthrough films (optional extra)** — `extras/walkthrough/walkthrough.ts` turns an app's screens into a film: the agent looks at a screenshot of each step, redraws the real UI as a large, simplified card (the control being used and just enough context; everything else dropped or turned into skeleton bars, type about 1.5× larger), and films one action per shot. Each card grows out of the control that was just used, each card has its own camera that pushes in on that control, and a big cursor or a finger tap does the clicking. The kit covers cards, buttons, inputs with typing, per-character blur-in text, count-up numbers, check marks, toasts, a phone frame, spring curves, zoom-about-a-point cameras, a cursor that follows moving cameras, and a brand-colour fluid backdrop. The shared Skill's new `product-walkthrough.md` reference describes the workflow (collect a screenshot of each step, inventory each screen, approve a screenshot-versus-redraw sheet, then animate) and how to adapt it to product demos, feature tutorials, what's-new shorts, mobile app previews, social cut-downs and landing-page loops. `walkthrough-demo.ts` is a twelve-second tour. Nothing is installed: the file is copied into a project's `scenes/` only when it needs one.

### Changed

- **Faster exports that no longer run out of memory** — frames travel from the headless browser as a Blob, which removes a per-frame copy that Playwright kept until the export ended (long 1080p exports could run out of memory) and makes each upload about ten times faster. Sample mixing, glow and grain now run in two workers inside the page while the next frame is drawn, and reuse their buffers. A 1080p frame with 4 samples, linear mixing, glow and grain went from about 1.4 s to about 0.35 s in our test, with memory flat over long exports. The pixels are identical to before.
- **`MOGRAFY_CANVAS=gpu`** — optional switch that draws with GPU acceleration, to compare speed on your machine. The default `cpu` canvas reads frames back cheaply and gives the same pixels on every computer; `gpu` can be faster for blur- and shadow-heavy scenes but its edges may differ slightly.
- **Skill guidance is Markdown** — the Skill entrypoint and references now live in `packages/core/skill/` as Markdown files; the core build bundles them, and `guide.ts` only assembles them. Edit the Markdown, then run `pnpm build`.

## 2026-10-22

### Changed

- **`mografy update` gets you unstuck** — when `main` has lost its GitHub upstream, the updater links it to `origin/main` by itself and carries on. Every other stop now prints the exact commands to run: the changed files plus `git stash -u` for local changes, `git checkout main` and `git branch --set-upstream-to=origin/main main` for another branch or a detached HEAD, and `git remote add origin …` for a folder that is not connected to GitHub.

### Fixed

- **Security hardening** — the `mografy` command now uses a Mografy checkout around the current folder only when it was installed on this computer (`pnpm install` records it in `~/.mografy/trusted-checkouts`); a folder that only imitates one is ignored with a note. The headless export host refuses requests for other hosts or from other sites, Vite's hot-reload socket accepts only the same-origin player, and the player's static files are checked against the folder boundary. The README now says to open only projects you trust, because scene code runs with the editor's access.
- **Lighter editing sessions and presentation files** — the player runs each scene version in its own iframe and removes it when the next version is ready, so long sessions no longer keep every version's code, images and fonts in memory; the runtime also removes the fonts it added when a version closes. Presentation HTML embeds only the files the scene loads (plus fonts and music) instead of all of `assets/`. The file watcher relies on filesystem events and rescans every 10 seconds instead of every second, `.mografy/builds/` keeps the newest 16 builds, a missing player file returns 404 instead of the player page, and the export host refuses uploads over 512 MB.

## 2026-10-21

### Added

- **Presentations** — present a project live instead of playing it as a video. Slides come from the scene's shots: a scene lists them in `meta.shots` (`{ end, stop?, title? }`, from the storyboard) and each shot becomes a slide that waits on a settled frame; a scene without shots is one slide, and the timeline in Video mode marks where each slide stops with a triangle. A **Video / Present** switch at the top of the editor turns it into a slides view of the same scene: slide thumbnails on the left (the panel button hides them) and the stage, with a playback menu in the middle (previous, **Play** into the slide as the audience will see it, **Mute** the presentation music, next). ← / → move between slides. Titles, speaker notes and holds (hold the frame, or keep replaying the last seconds so idle motion continues) are written to `slides` in `mografy.json`; slides are never added by hand, only by marking shots. The sixteen built-in components cannot be presented: the switch explains why and stays in Video. **Start** opens the presentation page: it plays to the next stop and waits for you. A top bar (back to the editor, the slide's title, speaker view, full screen) and a bottom menu (previous, next, mute, slide progress) fade away while the mouse rests. → / Space / click advance, ← and a number then Enter jump straight to a slide, M mutes, F goes full screen, B blacks out the screen, P opens a speaker view with notes, the next slide and a timer, and Esc returns to the editor. Music fades out at each stop and back in on the next transition. The window follows live edits while you rehearse, and K locks the current version while you present. **Export HTML** writes one file, `renders/<name>-presentation.html`, and downloads it, with the scene, fonts, images and music embedded: open it in any browser and it presents the same way, offline (`mografy export --format html` from the terminal). Video exports ignore shots and `slides`. `mografy check` validates the shots and `mografy review` adds a sheet of every slide's stop frame. The Skill's new presentations reference tells Claude and Codex how to read a project and mark its shots.
- **Player hot reload** — in a source checkout, `mografy dev` serves the player from source through Vite, so changes to the player's own code appear in the open browser at once, keeping its state. `pnpm install` installs Vite as a development dependency of the player; without it (or with `MOGRAFY_HMR=0`) the player is served from the built `dist/` as before.
- **Contextual music (optional extra)** — `extras/music/score.py` generates a film's score from its context instead of cutting the animation to a found track. The agent writes `music.json` after the storyboard: sections with a mood (calm, warm, hopeful, playful, tech, tense, cosmic, epic) and an energy level or ramp, and hits on the exact seconds where something happens on screen (bursts, impacts, particles gathering or swirling, light sweeps, typing, the final chord). The generator synthesises matching music with Python and numpy, deterministically, plus a timeline image for checking that swells and impacts land on the picture. `rhythm: "flowing"` gives a smoother, sustained score and `texture: "particles"` adds a shimmer for particle pieces. When the timing changes, edit the cues and generate again. Nothing is installed: the script is copied into a project's `music-src/` only when it needs music, and the shared Skill's new `music.md` reference describes the workflow. `music-example.json` scores the twelve-second intro.
- **3D layers with Three.js (optional extra)** — `extras/three/three.ts` renders a Three.js scene as a layer inside a normal frame: 2D backgrounds before it, type after it. Build meshes, lights, materials and glTF / GLB models once in `setup` with `prepareStage`, then pose them from `time` in `renderFrame` with `stage`; helpers cover orbit cameras, studio reflections, model loading and canvas-drawn textures. It renders with WebGL in the player and in every export format. The Three.js r186 bundle (about 0.8 MB, MIT) is copied into a project's `assets/` only when it needs 3D, so installation and existing projects are unchanged. `three-demo.ts` is an eight-second tour, and the shared Skill's new `three-d.md` reference says when to use 3D and how to keep it deterministic.
- **Project style file** — a project can now fix its design and motion decisions in `style.md` at the project root: do and don't rules, motion character, palette, type and tempo choices, composition and reference stills. Values stay in the scene code, defined once and changed there. The shared Skill and storyboard guidance read it before planning or editing. They take precedence over the Skill's default design guidance but never over the scene contract, and the current request still wins. Agents record a decision there only when you state or approve it as lasting. The file is optional; installation and new projects are unchanged.

### Changed

- **Every project has slides, even unmarked ones** — `pnpm install` and `mografy update` now write slides into each of your projects whose scene lists no `meta.shots`: `slides.shots` in `mografy.json`, marked `"guessedFrom"` (`pnpm sync:slides` runs it on demand; bundled components and examples are left alone). A scene can also keep its shots there instead of in `meta`; the scene's own `meta.shots` still win. Present mode, the presentation page and the exported HTML use them, and the player guesses the same way for anything not written yet: from the shot table in `storyboards/storyboard.md` when it covers the whole scene, otherwise from where the picture changes, and waits on the stillest frame shortly before each shot ends. Existing projects need no hand edits; the slide list says the slides were guessed, `mografy check` reports the guess, and `mografy review` always writes the slides sheet. Shots marked by Claude or Codex still replace the guess.
- **Projects open paused at 0s** — opening a project, switching to another one or reloading the player no longer starts playback, in Video and Present alike: Video starts at 0s instead of the last playhead, Present shows the selected slide's stop frame, and nothing plays until you press Play or Space. Live edits to the open project still keep the playhead where it is.
- **The shared Skill keeps itself current** — `pnpm build` now ends with `pnpm sync:skills`, so `pnpm install`, `mografy update` and every build regenerate `.agents/skills/mografy` (and the Claude link and project pointers) from `guide.ts`, including new references such as `music.md`. `mografy dev` also checks on start whether the Skill's sources changed since the last sync, for example after a `git pull` without `pnpm install`, and regenerates it with one line of output. Custom notes in project guides are preserved as before; nothing to run by hand.

## 2026-10-20

### Fixed

- **The `mografy` command survives a moved or deleted checkout** — the launcher that `install-command` puts on PATH used to hard-code the folder it was installed from, so deleting or moving that copy (for example an old `~/Documents/mografy`) made every `mografy` command fail with a Node `MODULE_NOT_FOUND` stack trace. It now looks for Mografy each time it runs: inside any checkout it uses that checkout; outside one it uses the installed copy, and if that copy is gone it prints the one repair command. It uses `node` from PATH, so Node upgrades do not break it either. Existing launchers are replaced the next time `pnpm install`, `mografy update` or `node packages/cli/bin/mografy.js install-command` runs.
- **`mografy dev` only opens projects; the old starter is retired** — `dev` no longer offers to create a missing project, so a mistyped path or a terminal in another repository (for example the website's) can't leave an empty starter behind. A missing folder now fails and points to `mografy dev` (the player with the built-in animations, ready right after `pnpm install`). A relative path that isn't in the current folder but is a project in the Mografy installation (`mografy dev projects/<name>`) opens that project. `--yes` is deprecated and ignored. No starter project is needed to begin. The internal `mografy init` (used only by agents for a new animation, no longer in `--help` or the README) and the player's New project now create a blank project — an empty stage with one breathing dot — instead of the former 8-second "MOGRAFY" title scene. The component modules are still copied so scenes can import them. Built-in component projects are unchanged. `mografy help` is redesigned around the workflow (Start, Review and export, Manage) with the current product line and the teal brand mark on interactive terminals (`NO_COLOR` turns colour off).

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
