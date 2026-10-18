# Development status

Updated: 2026-10-18

## Source update command (2026-10-18)

- Added `mografy update [--check]`, resolved from the executing installation rather than a scene project. It fetches the tracked upstream, prints commit revisions and applies only fast-forward updates. Local changes, diverged/ahead history, missing upstreams and concurrent updates stop with actionable messages.
- The updater waits for the active export, requests an idle-only shutdown, installs dependencies (including the existing build/Chromium/launcher postinstall), syncs Skill guidance and restarts the same project on the same port using the new CLI process. Browser refresh loads the new interface. Failed setup reports manual recovery commands and leaves the incomplete build stopped.
- README, configuration and changelog document first install, the one-time manual bootstrap for older versions and later updates. User-facing bootstrap steps omit the maintainer-only `pnpm sync:skills`; the updater handles synchronization internally. Updates are exercised against temporary local Git remotes; this development checkout is not pulled or overwritten.
- Validation: `pnpm check` passed all 121 tests, and `pnpm test:browser` passed 17 checks. The twelve updater cases include a real local HTTP export wait and detached process restart, tracked/untracked changes, divergent history, missing upstreams, detached HEADs, concurrent locks and failed installation recovery. Final build/typecheck and all twelve updater cases passed after the startup identity check was tightened. Shared Skill guidance was synchronized.

## WebM video export (2026-10-18)

- Added WebM alongside MP4, Lottie and SVGA in the player, API and CLI (`mografy export [project] --format webm`). WebM uses VP9 video and optional Opus audio at 128 kbps. API/CLI defaults and the initial WebM draft use CRF 32; Draft/Standard/High select CRF 38/32/26. Higher CRF generally makes smaller files with less detail. Constant quality varies bitrate with scene complexity and does not promise a fixed file size or reduction versus every MP4.
- Reuses browser capture, FFV1 intermediates, shared Runtime sampling/effects, cancellation and queued atomic output publication. Both video formats support 720p/1080p landscape/portrait, Fit and up to 60 fps. The player retains per-format settings and plays completed WebM downloads; CLI orientation/resolution flags also accept WebM. Advanced settings retain two-pass target bitrate. Existing saved project settings and MP4 defaults are preserved.
- Updated README, architecture and the generated shared agent guidance with WebM usage and quality behavior.
- Validation: `pnpm check` passed build, typecheck and all 109 tests; `pnpm test:browser` passed all 17 checks. Real FFmpeg tests cover VP9 CRF/two-pass, Opus duration, silent output and frame decoding. CLI and browser tests cover portrait presets, playback/download MIME, frame-rate/dimension limits, cancellation without partial output, CRF defaults, per-format drafts and unchanged manifests. Desktop/390px WebM settings and decoded sample frames were visually reviewed. `pnpm sync:skills` regenerated shared guidance and migrated generated pointers while preserving custom notes.
- Local example: the same twelve-second intro at 640 × 360, 30 fps, one motion sample and no glow/grain exported to MP4 (H.264 two-pass 12 Mbps/AAC 192 kbps) at 852,445 bytes and WebM (VP9 CRF 32/Opus 128 kbps) at 300,321 bytes, a 64.77% reduction. Both decoded to 360 frames. Total export times were 15.89/17.28 seconds; the observed encoding stages were about 0.71/1.51 seconds. These are default-encoding comparisons under local load, not matched-quality measurements or guaranteed savings. Data and decoded frame captures are in `artifacts/webm-export/`.

## Optional extras: camera, transitions and CJK typography (2026-10-17)

- Installation still contains only the sixteen built-in components; the project template, component registry, thumbnails and their fingerprints are unchanged. New helpers live in the tracked `extras/` folder and are copied into a project only when a brief needs them (from the checkout, or downloaded from GitHub).
- `extras/cinema/cinema.ts`: `preparePlate` / `plate` / `move` camera moves on image plates (cover fit, focus-point zoom, pans clamped so edges never show); `crossfade`, `dipTo`, `flash`, `iris`, `slash`, `whip`, `smear` and `particleWipe` (sakura petals by default; star, circle, heart) over `from` / `to` draw callbacks; `glow`, `drift`, `twinkle`, `lightSweep` atmosphere. `cinema-demo.ts` is a fourteen-second tour.
- `extras/cjk/cjk.ts`: `verticalText` / `verticalLayout` (columns right to left, vertical punctuation and bracket forms, rotated long marks and Latin letters, small-kana offsets, tate-chu-yoko digits, kinsoku-aware wrapping) and `cjkText` / `wrapCJK` (horizontal kinsoku wrapping that keeps Latin words whole). `cjk-demo.ts` shows both.
- `extras/cjk/fonts/`: OFL subsets of Noto Sans CJK TC Medium (4.2 MB) and Noto Serif CJK TC Bold (5.3 MB) covering kana, punctuation, vertical forms, Big5 level 1, JIS levels 1–2 and GB2312 level 1, with `OFL.txt`; `subset-cjk-fonts.py` rebuilds them.
- `guide.ts` adds the `camera-transitions.md` and `cjk-typography.md` references with fetch instructions, two SKILL.md routing lines and a built-in reference pointer. `GUIDE_BODY` is unchanged, so legacy-guide detection still matches; the legacy storyboard cleanup ignores the new references. The skill generator reproduced the previous files byte for byte before the change.
- Validation: strict TypeScript checks of all four modules; real Chromium renders through `@mografy/runtime` sources (transition windows, vertical/horizontal CJK with the subset fonts loaded from `mografy.json`) with repeat-render determinism checks. Run `pnpm build`, `pnpm sync:skills`, `pnpm check` and `pnpm test:browser` locally.

## Project and player refactoring (2026-10-16)

- Completed the staged [refactoring plan](refactoring-plan.md), preserving browser-only scenes, the six-package structure, and shared runtime/output effects. `ProjectWatcher`, `ProjectFrames`, and `RenderJobs` own their resources while Project coordinates publication and queued atomic writes.
- Asset filename allocation and writes now share one Project queue operation. Inspection, stills, and the player share runtime identity covering version, seed, canvas, font descriptors, and the audio beat grid. Runtime-affecting API changes trial before persistence; failed disk inputs cannot replace the last working configuration through an unrelated patch. Closing drains in-flight still captures.
- Playback frame subscriptions moved into `Playback`; `Inspector` owns tabs and controls. Session actions remain stable across snapshots, and delayed playhead reports are cancelled on switch/unmount. Superseded or disposed player loads discard their runtimes. Export visibility/job reducers and shared progress/cancellation logic retain hide, resume, retry, completion, and fresh-settings behavior.
- Core owns HTTP request schemas, with malformed envelopes returning 400 and invalid project settings retaining 422. The player uses one JSON/error client. CLI flags, export transport, and terminal progress are separate; failed startup closes an owned Project. Workspace listing is read-only, with explicit component initialization and separate installation/recent-state modules.
- Browser cases are grouped by player, exports, and projects/audio, each owning a temporary project, installation state, server, and browser. `pnpm check` passed build, typecheck, and 94 tests; two additional owned-CLI export/failed-startup tests passed separately, for 96 cases total. `pnpm test:browser` passed 17 checks. Desktop, effects, portrait/export, completion, and background progress captures were visually reviewed.
- In one local 1280 × 800 Chromium comparison using the same current dependencies, App function executions during one second of playback fell from 60 to 0; playback still advanced normally and the paused Canvas hash matched. This measures shell subscription work, not export throughput. Evidence is in `artifacts/refactoring/playback-comparison.json` and adjacent captures.
- Completed the remaining ownership boundaries: App now composes player/keyboard/parameter/effects hooks, Inspector composes separate panels, and export draft transitions and settings presentation are separate from job/modal orchestration. Per-format choices remain independent; strict output sizes exclude preset display metadata and Retry retains submitted settings.
- HTTP transport, parsing, workspace routes, project routes, and Project/lock lifecycle now have separate owners. Request dispatch captures its Project before reading bodies, and player actions carry their displayed project directory. Delayed actions from a previous project receive 409; legacy unscoped API calls remain compatible. Startup failure releases locks, and shutdown is idempotent and rejects later switches.
- Project scaffolding and built-in initialization are separate from listing. Library name selection/creation and recent/active-state updates are serialized. Concurrent identical names create distinct folders; an old server token cannot clear a newer active record. Unavailable recent-history storage remains best effort.
- Completion validation: `pnpm check` passed build/typecheck and all 105 tests, including delayed browser auto-save across a project switch, slow request bodies, lock cleanup, concurrent workspace state, and export drafts. `pnpm test:browser` passed all 17 checks. Additional unused-symbol typechecks and diff checks passed. Fresh desktop player/effects/export and 390px export captures were visually reviewed in `artifacts/refactoring-completion/`; Server/workspace checks were rerun after the final best-effort history safeguard.

## Post-export video compression Skill (2026-10-16)

- The shared `mografy` Skill now routes oversized finished videos to a Python/FFmpeg helper. `packages/core/src/guide.ts` owns the compression instructions; `scripts/compress-video.py` owns the executable, copied into the Skill by `pnpm sync:skills` for both Codex and Claude.
- The helper creates a separate H.264 MP4 with CRF quality or a two-pass decimal MB budget, optional resolution caps without upscaling/cropping, and AAC audio retained by default. Existing files are never overwritten. It validates duration/audio and decodes the result before atomic publication; failures, cancellation, and candidates that do not save bytes leave no new output.
- `pnpm check` passed 81 tests, `pnpm test:browser` passed 17 checks, and `pnpm test:compression` passed eight real-FFmpeg integration checks including SIGINT cleanup. The Skill validator passed and the generated helper matches its maintained source. The existing twelve-second intro shrank from 699,932 to 441,250 bytes (36.96%), retaining 1280 × 720, audio, and duration; a sampled original/compressed frame comparison was visually inspected. Compression remains lossy and target mode reports failure if actual bytes exceed the requested limit.

## Centered portrait component previews (2026-10-14)

- All sixteen installed component projects now use saved 9:16 portrait canvases. New built-ins also default to portrait. Bundled and local previews are regenerated from actual Chromium frames; sidebar thumbnails use 9:16 boxes with contain fitting.
- Component subjects use the exact horizontal and vertical canvas center. Fixed card bounds, the heart silhouette and the count-up lockup align around this point. Chat height adapts to wrapped copy while keeping the complete bubble group centered. Portrait component sizing and landscape export layouts remain available.
- Chromium checks measure the settled subject bounds for all sixteen portrait scenes and verify centered placement, safe padding and random seeking. Player checks cover each component's 1080 × 1920 canvas and portrait thumbnail styling.
- `pnpm check` passed all 81 tests and `pnpm test:browser` passed all 17 checks. Real portrait raw/output frame review and desktop/390px sidebar and player review passed.

## Responsive component layouts (2026-10-14)

- All sixteen built-in scene entries support landscape 16:9 and portrait 9:16. Portrait composition uses subject-specific sizing and social safe margins. Follow badges stack identity and button vertically; chat, notification, profile and lower-third copy uses measured wrapping or bounded lines. Loading dots retain separate circles and progress bars retain their thickness using the canvas short edge.
- Updated the template and the installed component scene modules, preserving saved project orientations and settings. Bundled thumbnail fingerprints were regenerated through Chromium. Shared authoring guidance was regenerated with `pnpm build` and `pnpm sync:skills`.
- Export Fit includes Adapt layout (`reflow`) for responsive scenes. The paused output preview and actual export use the same layout; output changes leave the authored canvas intact. Contain and cover remain available.
- `pnpm check` passed 81 tests; `pnpm test:browser` passed 17 checks. New Chromium coverage checks all sixteen components in both ratios, safe margins, loop and random seeks, matching saved-canvas/reflow pixels, and long English/CJK copy. Real raw/output frame review covers entrances, click/reply states, holds and loop resets.

## Export progress and completion dialog (2026-10-14)

- Starting an export continues in the same modal, with a cute robot on the left (blinking, typing and printing film cards), real capture progress/count and elapsed time. Short stage headings replace explanatory sentences and the repeated stage list. Encoding/package progress stays indeterminate; completion shows the real file and Download/Done without another percentage. Dark green surfaces and reduced-motion support retain the brand style.
- Hide moves running progress to a compact toast with View/Cancel; the top Exporting button also reopens the same job. Closing settings or a terminal result resets the dialog, while background jobs retain their identity and latest state. Cancel cleans up through the existing Server flow. Failed/cancelled local jobs offer Retry and Edit settings; externally started jobs offer settings rather than claiming to repeat unknown overrides.
- Completed MP4s play the actual output file in the modal and all formats provide Download. Completion remains until dismissed. The duplicate success toast was removed. Done closes the modal without a toast. Last export in the top bar reopens the completed file; Export opens fresh settings. Export orientation/Fit and project settings stay unchanged.
- `pnpm check` passed 81 tests and `pnpm test:browser` passed 17 checks. Regression coverage exercises real capture, dismiss/reopen, cancellation without a partial file, an export-only frame failure, source repair, successful retry, playable 720 × 1280 metadata and actual download. Checks also verify that the loading animation moves, reduced-motion stops it, and completion does not produce a second toast. Desktop/390px progress, background toast, failure/cancel and completion captures are in `artifacts/export-dialog/`.

## Portrait canvas and MP4 orientation (2026-10-14)

- The player and new-project UI have no canvas orientation controls. The main preview follows the authored scene. Agents can create native landscape 16:9 or portrait 9:16 scenes. Optional saved `aspectRatio` is configuration in `mografy.json`; animation stays in scenes. The shared Runtime passes the effective canvas to setup and drawing. Canvas changes trial-render before saving, survive reopen, update watched metadata without a new source hash, and invalidate still/thumbnail caches. Small/custom dimensions retain an exact ratio within scene bounds.
- MP4 exports offer 1280 × 720 / 1920 × 1080 landscape and 720 × 1280 / 1080 × 1920 portrait. Orientation icons retain the resolution tier; changing output orientation shows Fit when its ratio differs from the scene: Fit entire scene (default) or Fill and crop, with an actual paused-frame preview. The preview canvas stays authored. Export settings do not overwrite the saved canvas, and portrait default filenames append `-portrait` to preserve the landscape output. CLI supports `--orientation landscape|portrait --resolution 720p|1080p`.
- Portrait Guides reserve conservative social overlay margins. The shared Skill and scene/storyboard references read the saved ratio and requested brief, require native 1080 × 1920 scenes for future 9:16 videos, 9:16 storyboard panels, vertical layout, wrapped copy, and phone-size review. Fixed-coordinate scenes require authoring a responsive layout; the Runtime provides dimensions rather than inventing an arrangement. Guidance was generated with `pnpm build` and `pnpm sync:skills` for both Codex and Claude.
- `pnpm check` passed 63 tests and `pnpm test:browser` passed 17 checks. Real Chromium verifies canvas persistence, failed-change rollback, disk watching, UI icons/keyboard/resolution retention, preview and mobile overflow. FFmpeg decodes all four native MP4 sizes, with portrait setup/drawing and random-seek pixel probes. Desktop and 390px visual review passed; captures and details are in `artifacts/portrait-video/`.

## Immediate built-in thumbnails and cached image loading (2026-10-13)

- All sixteen components ship 480px PNG previews under `packages/server/thumbnails/`, generated from real Chromium scenes by `pnpm thumbnails:generate`. Initialization seeds missing previews of unchanged components in the Project write queue using `atomicWrite`. Fingerprints cover scene modules, assets, seed, params, fonts and audio; customized or invalid components are preserved, along with existing captures.
- Component initialization is reused within the process. Project list and image requests share a one-second catalog cache, invalidated by project switches and scene/settings/thumbnail changes. Versioned image URLs use immutable private caching and content ETags; stale-version URLs use revalidation. Image decoding is asynchronous.
- Live thumbnail capture uses a 300ms debounce instead of 1200ms, directly resizing the rendered Canvas without full-resolution pixel readback. Source/version guards still reject superseded captures before atomically publishing the image and notifying the player.
- A fresh local library showed all sixteen previews without opening the other components: first list including scaffolding took 1.55 seconds, and the next list took 3ms in one local measurement. Desktop visual review found no thumbnail placeholders. Pixel checks match the independently resized raw PNG and verify random seeking; regression coverage verifies first-launch previews, custom/invalid-project preservation, ETags, stale URLs and live updates.
- `pnpm check` passed 56 tests and `pnpm test:browser` passed 17 checks with real Chromium and FFmpeg using `--config.verifyDepsBeforeRun=false`. The final invalid-component safeguard also passed the Server build and all eight Server tests.

## Portable installation paths and GitHub documentation (2026-10-13)

- The CLI launcher now prefers the nearest Mografy checkout from the terminal's current folder, including animation subfolders. A launcher installed by another clone uses the current checkout's build; an unbuilt checkout reports install/build instructions. Installing the launcher no longer initializes a project.
- Recent projects and active-player state are separated per installation under `~/.mografy/installations/<root-hash>/`. The old shared history is preserved but no longer resumed automatically. Project arguments resolve from the user's current folder, exports remain in the opened project's `renders/`, and `MOGRAFY_HOME` / `MOGRAFY_STATE` provide explicit overrides.
- README, generated Skill/reference links, and project instruction pointers use canonical GitHub URLs. Generated guidance is identical across checkout locations. Exact old project pointers migrate even when committed from another computer; custom instructions remain intact.
- README includes the existing twelve-second intro as a GIF preview and an MP4 with audio under `docs/media/`. Its dark-theme logo uses white ink and the original teal ribbon; light mode uses the original logo. Both desktop and 390px layouts were visually reviewed.
- Validation covers cross-clone CLI selection, paths with spaces, missing builds, installation state separation, portable guidance, reference targets, and safe migration. `pnpm check` passed 54 tests and `pnpm test:browser` passed 17 checks with real Chromium and FFmpeg, using `--config.verifyDepsBeforeRun=false` with the installed dependency tree.

## Export frame-rate limits (2026-10-13)

- MP4 exports now allow at most 60 fps; Lottie and SVGA exports allow at most 30 fps. SVGA's 60 fps option was removed at the user's request. Core owns the limits and shared validation used by the request schema, resolved Server settings, and direct render functions.
- The dialog filters frame-rate options by format and caps older MP4 project defaults at 60 fps for this export only. Project settings and scene preview stepping keep their existing ranges. Over-limit API and CLI requests return an explicit format-specific error before capture.
- `pnpm check` passed 52 tests and `pnpm test:browser` passed 17 checks with `--config.verifyDepsBeforeRun=false`. Real exports verify Lottie and SVGA at 30 fps and decoded MP4 at 60 fps. Tests also cover rejected explicit and inherited rates, legacy defaults in the dialog, and cancellation at a valid rate. The running local player was restarted; its menus and API enforce each format's cap.

## Server Node type dependency and editor diagnostics (2026-10-13)

- Server now declares `@types/node` 26.6.5 as a direct development dependency, with its package-local pnpm link and lockfile entry. The existing cached version was reused offline.
- Workspace TypeScript 7.0.2 and VS Code's bundled TypeScript 6.0.3 both validate the Server configuration. Reloading the TypeScript service cleared the editor's cached missing-Node-type diagnostics across the workspace; VS Code's Problems panel shows zero errors.
- `pnpm check` passed 50 tests and `pnpm test:browser` passed 17 checks with `--config.verifyDepsBeforeRun=false`.

## Fixed export sizes (2026-10-13)

- Export Resolution now offers exactly two sizes per format: Lottie 256 × 256 Square / 640 × 360 Landscape; SVGA 375 × 375 Square / 375 × 750 Portrait; MP4 1280 × 720 720p / 1920 × 1080 1080p. Lottie 128 × 128 was removed at the user's request. Each format starts at its first size and retains its selection while the dialog stays open.
- Export requests accept a separate output viewport with width, height, and contain/cover fitting. The shared Runtime preserves logical scene coordinates, centers proportional artwork, and either adds scene-background margins or crops. Sampling and post-processing apply to the output viewport; settings are not saved to the project. Existing requests without a viewport keep their render-scale behavior.
- `pnpm check` passed 50 tests and `pnpm test:browser` passed 17 checks with `--config.verifyDepsBeforeRun=false`. Independent Lottie and SVGA players reproduce shared pixels at all four animation presets, including random seeks. FFmpeg decodes native 720p and 1080p frames. Viewport probes verify fitting, cropping, and deterministic seeking; end-to-end checks cover exact labels, keyboard selection, retained choices, downloads, and unchanged project defaults.
- Desktop and 390px mobile export dialogs passed visual review without horizontal overflow. End-to-end tests now use an ephemeral localhost port to avoid conflicts with other test runs.

## Component and intro references, README, and MIT license (2026-10-13)

- The single shared `mografy` Skill now routes to `references/built-in-components.md` and `references/intro.md`, generated from `packages/core/src/guide.ts`. The catalog links all sixteen source entries and reusable modules; the intro reference covers the actual four beats, assets, subtitle params, timing, and review settings.
- README is rewritten around the current source-installation flow, one shared Skill with Claude's linked entry, working examples, storyboards, scene validation, exports, and package architecture. Legacy workflow history remains in this status document rather than the getting-started guide.
- Added the root MIT license and `license: "MIT"` to the workspace and all six package manifests. Existing third-party asset licenses remain in place.
- `pnpm check` passed 45 tests and `pnpm test:browser` passed 17 checks, using `--config.verifyDepsBeforeRun=false` with the installed dependency tree. Both Skill entry paths passed Skill Creator validation. All six reference documents and README links resolve; the component catalog matches all sixteen registered entries, and all seven manifests declare MIT.

## One shared Mografy Skill and Claude entry (2026-10-13)

- The repository root contains one Skill at `.agents/skills/mografy/`. Product development, scene creation, storyboards, and animation direction share this entrypoint. English details live in `references/project.md`, `scene-authoring.md`, `storyboard.md`, and `animation-principles.md`.
- Claude's `.claude/skills/mografy` entry is a relative symlink to the same folder; root `CLAUDE.md` imports the shared Skill. Codex and Claude read one physical source. The separate generated `mografy-storyboard` Skill is removed.
- `packages/core/src/guide.ts` remains the single source. After a build, `pnpm sync:skills` regenerates the shared Skill and Claude entry and migrates local project guides. Animation subprojects contain only instruction pointers and never create Skill folders. Custom instructions are preserved.
- Codex storyboards invoke image generation. Claude uses Artifacts when available, with a standalone local HTML/Canvas fallback. Plans and prompts stay in English; the twelve principles guide deterministic motion in scene modules.
- `pnpm check` passed 45 tests (core 9, runtime 8, render 10, server 6, end-to-end 12), and `pnpm test:browser` passed 17 checks, using `--config.verifyDepsBeforeRun=false` with the installed dependency tree. Skill Creator validates both entry paths; all English reference links resolve. Claude resolves to the same physical folder, 18 project guides point to the single Skill, and rerunning sync preserves this layout.

## Skill and CLI workflow (2026-10-13)

- Removed `@mografy/mcp`, `mografy mcp`, and `mografy setup-claude`. Claude Code and Codex edit scene files directly using English Skills. The Server watches, compiles, trial-renders in Chromium, and publishes changes.
- The CLI workflow is `mografy dev`, `mografy check`, `mografy review`, and `mografy export`. No subcommand means `dev`; `render` remains a compatibility alias for `export`.
- Initially, new projects generated `.claude/skills/mografy/SKILL.md` and `.agents/skills/mografy/SKILL.md` from `packages/core/src/guide.ts`. The shared outer Skill folder above supersedes that placement while retaining the shared scene and review contract.
- MP4, Lottie, and SVGA exports print the format and destination, frame-capture percentage, and encoding or packaging stage. Outputs use the Project queue and `atomicWrite`; review artifacts also use atomic writes.
- Player exports appear in the `mografy dev` terminal and can be cancelled from the header or progress area. Direct CLI exports support `Ctrl+C`; dev-server exports support `mografy export --cancel`. Cancellation reaches Chromium capture and FFmpeg encoding, cleans up, and ends as cancelled without committing partial files.
- Completed exports show a temporary card above the right panel with the filename, Download, and dismiss controls. It disappears after six seconds. Active progress and cancellation stay in the footer; failures remain visible. End-to-end tests verify the completed card is removed from the DOM.
- `pnpm check` passed (core 9, runtime 8, render 10, server 4, end-to-end 12); `pnpm test:browser` passed 17 checks. Isolated projects also verified player progress in the dev terminal, UI cancellation, and CLI `Ctrl+C`; neither cancellation produced a partial MP4.
- Check fixtures use production built-in components: Lower third for end-to-end startup, Progress bar for export verification, and component scenes for Render and Runtime browser checks. The former starter `scenes/main.ts` is no longer a test fixture; dedicated Runtime probes cover only low-level Canvas contracts.
- Installation, build, full checks, and browser tests passed. Isolated projects exercised `dev`, `check`, `review`, Lottie export, and MP4 export; both original Skills passed Skill Creator validation.

## Right inspector UX (2026-10-12)

- Scene, Effects, and Audio are direct tabs, replacing nested Advanced effects. Scene groups Subtitles, Colors, and Controls; subtitles remain the only editable copy. Removed the edited count and duplicate hints.
- Effects provides percentage inputs, sliders, individual Reset, and Clear effects. Original and With effects distinguish comparison from saved output settings; playback offers Pause to preview.
- Audio prioritizes track and volume, with beat values under Beat sync. Less-used verification controls are under Frame review. Removing audio prevents pending older settings from restoring the track; project switching resets the audio draft.
- Tabs support arrows, Home, and End. Handled keys do not reach playback shortcuts. The inspector has no horizontal overflow at 1600, 1100, 760, and 390px. Review, comparison images, and limitations are in `artifacts/inspector-ux/audit.md`.
- Full checks passed (core 9, runtime 8, render 9, server 4, end-to-end 12), plus 17 browser checks covering groups, direct effects, keyboard navigation, percentage persistence, reset, raw comparison, audio upload, and beat editing.

## Glow visibility fix (2026-10-12)

- Bright-pass extraction now runs per pixel before downsampling, using the brightest channel to retain saturated teal and blue highlights and fine lines. Linear mixing uses display luminance for the threshold.
- Concentrated glow and soft outer glow make slider intensity more visible. Zero preserves the original image; dark regions do not glow on their own. Preview, MP4, Lottie, and SVGA share `post.ts`.
- Full checks passed (core 9, runtime 8, render 9, server 4, end-to-end 11), plus 17 browser checks. Tests cover white, teal, and blue single-pixel highlights and intensity ranges in sRGB and linear mixing. Real-player 0/50/100% comparisons are in `artifacts/glow-visibility/comparison.png`.

## Advanced output effects (2026-10-12)

- Replaced Seed/Random variation in the inspector with Advanced Glow and Grain sliders, descriptions, percentages, Clear effects, and save status.
- Changes pause playback and enable effects preview; Preview effects compares the original image. Playback keeps a live scene preview, while paused frames use shared `renderOutputFrame` sampling, glow, and grain.
- Settings save through the Project queue to existing render settings. All three export formats inherit project effects; failed exports offer Retry. The seed contract remains available to agents and scenes.
- Full checks passed (core 9, runtime 7, render 9, server 4, end-to-end 11), plus 17 browser checks. End-to-end coverage includes consecutive changes, reload, clearing, all three formats, and pixel equality between paused preview and capture at matching sizes. Inspector checks passed at 1600, 1100, and 760px; see `artifacts/advanced-effects/panel.png`.

## Sidebar toggle (2026-10-12)

- Removed the duplicate collapse arrow beside Projects, keeping the upper-left Projects toggle. `P` still toggles the panel; list layout is unchanged.
- Real Chromium checks at 1600, 1100, and 760px verified one toggle, clicking, Enter, and reopening. Full and browser checks passed; images are in `artifacts/projects-panel/`.

## Subtitle editing and text color (2026-10-12)

- The inspector shows only important subtitles explicitly marked `type: 'string', role: 'subtitle'`. Agents edit titles, chat, code, and brand copy in scene source. Other string params remain valid in the contract but have no inspector editor.
- Mografy intro removes the dot grid and exposes five subtitles for opening, playback, scrubbing, chat, and ending. Long and multiline subtitles preview and save automatically; existing chat copy remains.
- Consecutive subtitle edits save together; Reset cannot be overwritten by pending older values. Settings-cleanup notices can be dismissed, while drawing errors remain visible.
- Stagger text replaces unused Accent with white Text color; inspector and drawing share the same param. Installed examples were updated and unused Accent values removed.
- Full checks passed (core 9, runtime 7, render 9, server 4, end-to-end 10), plus 17 browser checks covering subtitle filtering, merged writes, reload, Reset, shortcuts, and all three formats.

## Completed phases

| Phase | Scope | Verification |
| --- | --- | --- |
| 1. Contract, Runtime, player | Core schema, createSceneRuntime with renderScale and guards, tools, example scenes, React player, CLI | Real Chromium: identical pixels for repeated, out-of-order, and reloaded times; renderScale 1/2 mean difference 0.38/255 |
| 2. Server and writes | Single writer, watching and polling, compile/trial/publish, WebSocket, previous-version recovery, param compatibility, Claude/Codex Skills | End-to-end: scene updates retain time; invalid files report errors and keep the previous scene; both host Skills share one source |
| 3. Video export | Parallel segments, browser post-processing, FFV1 join, two-pass encoding, audio, player export | 1080p eight-second output: 240 frames, 12.2 Mbps, BT.709; small-size tests pad audio to eight seconds |
| 4. Review tools | Raw/output still sheets, transition strips, PSNR reports, contact sheets | Browser output versus video PSNR approximately 43–45 dB |

## Earlier test baseline

At this stage, `pnpm check` passed core 9, runtime 8, render 9, server 4, and end-to-end 12 tests; `pnpm test:browser` passed 17 Runtime checks. The Runtime package also gained the explicit esbuild development dependency used by browser tests.

## Canvas drawing API (2026-10-12)

- Added `ctx.draw` for fill/stroke, shapes, Path2D, text, images, opacity, and transforms. Methods can be destructured; each Runtime creates one API over the existing logical-coordinate Canvas.
- The recommended local name is `mografy`: `const mografy = ctx.draw`, followed by calls such as `mografy.fill()`. Scene time is `time`; native context is `canvas = ctx.canvas`.
- `push`/`pop` save native state and fill/stroke switches. Every frame resets switches and stack so seeking or unbalanced pushes cannot contaminate later frames. Native `ctx.canvas` remains for batched paths and clipping.
- Intro and default scenes use the API, with publication through the Project queue, Chromium trial, and `atomicWrite`. Timing and settings stay consistent. `packages/core/src/guide.ts` owns generated instructions for new projects and both hosts.
- All 649 raw/output hash comparisons matched: 390 intro frames and 259 default-scene frames, covering every 30fps time at quarter scale, 1080p key poses, sampling, post-processing, and repeated or out-of-order seeks.
- Chromium compared the API against independent native Canvas drawing at 0.5/1/2 scale: identical pixels for text, gradients, images, Path2D, shadows, and nested push/pop. Tests also cover state cleanup and errors.
- State-pollution probes use independent scenes rather than starter-specific syntax and verify that invalid versions cannot replace the last working scene.

## Naming and built-in components (2026-10-12)

- Scene entrypoints use `renderFrame(ctx, time, params)` with seconds, and `canvas = ctx.canvas` for native drawing. HTTP `t` remains compatible.
- Advanced operations stay on `ctx`: shadow, blur, vignette, synchronous `ctx.clip(path, draw, rule?)`, and `ctx.withCanvas(draw)`. Native Canvas and the drawing API share state; scopes restore it after completion or errors.
- New projects include six pure time components in `scenes/components.ts`: staggerText, typewriter, popCard, progressBar, pulseDots, and logoReveal, plus `scenes/showcase.ts`. Animation stays in scene modules without Runtime animation data or clocks.
- The left Built-in components group retains existing styling. First launch selects Stagger text; returning users resume their last project. Six independent projects initialize under `library/.components/{id}` without creating my-first-motion.
- Initialization uses the `project.ts` queue and `atomicWrite`, publishing the manifest last. Startup and live changes share one writer per path.
- Chromium verified animation, seeking, and high resolution for all six components. Clipping matches native pixels at 0.5/1/2 scale; exceptions restore styles and fill switches. End-to-end coverage includes project creation, all component projects, and returning to the original project.
- Removed the user-selected `~/Mografy/my-first-motion` and `projects/test-motion`, and cleared their Recent entries.

## Export and interface (2026-10-12)

- Retained neutral gray and teal styling. The inspector initially had Scene/Audio and Advanced effects, replacing Seed; removed Final frame and Title/Subtitle controls. Loop and Guides use icons. The later inspector UX entry supersedes this tab layout.
- The top Export dialog selects MP4, Lottie, or SVGA, with dimensions, FPS, quality presets, sampling, and effects. MP4 supports two-pass/CRF, encoding preset, and no audio.
- Lottie uses standard JSON with embedded PNG image layers. SVGA uses zlib-compressed SVGA 2 protobuf with PNGs and complete alpha tables. Both share Runtime post-processing and contain no vector animation or audio. Defaults use smaller dimensions and lower FPS with capacity limits.
- HTTP and CLI support all three formats and per-export overrides. Finished files use the Project queue and `atomicWrite` under `renders/`; MP4 intermediates use system temporary storage.
- Actual lottie-web and SVGAPlayer-Web verified first, last, and out-of-order frames with glow, grain, and sampling against identical shared output pixels. End-to-end tests cover downloads, advanced settings, keyboard/Escape, and unchanged defaults.
- Interface review is in `../design-qa.md`; images are in `../artifacts/ui-export/`.

## Project management

The Projects panel lists recent projects, the `projects/` library, and built-in examples. Switching uses the same player while the Server changes locks and Project and broadcasts the switch. Thumbnails update after publication. `examples/mografy-intro` contains the 12-second introduction animation.

Each project represents one animation with one scene entrypoint. That scene can now draw responsive 16:9 and 9:16 compositions using the shared canvas setting and MP4 export overrides. Independently authored scene variants and multiple entrypoints per project remain open decisions.

## Remaining work (phase 5)

- Package as a single npm distribution; currently run from source with `pnpm install-command` for the launcher.
- Verify installation on Windows.
- Improve export speed when needed: JavaScript post-processing costs roughly one second per 1080p frame on a two-core cloud machine; WebGL glow is a possible improvement.
- Resolve the plan's open decisions, including multiple scenes and version history.

## Six independent component animations (2026-10-12)

Built-in components lists Stagger text, Typewriter, Pop card, Progress bar, Pulse dots, and Logo reveal independently. Each has its own project, scene entry, params, and export, using the gray/teal presentation. First launch creates six projects; the older combined gallery source remains, but startup migrates to Stagger text. Scenes share component-frame.ts and components.ts. The Server copies source without executing animation in Node.

## Minimal full-frame components (2026-10-12)

The six animations remove titles, numbers, descriptions, code, footers, and showcase frames. Text examples keep only Hello./Create.; Pop card uses a checkmark, while the bar and dots are centered. Logo reveal progressively exposes the original white arch and teal ribbon Path2D, without an outer ring or text. Composition uses ctx.width/height for consistent scaling. Browser checks cover whitespace, random seeking, and native-reference brand pixels.

## Sixteen components and refreshed thumbnails (2026-10-12)

Added Social card, YouTube subscribe, AI chat, Like burst, Follow badge, Notification toast, Lower third, Count up, Toggle switch, and Audio wave for 16 independent animations. They retain full-frame compositions and player styling. New components live in social-components.ts and derive their frames from time, with random seeking and primary-color support.

Chromium recaptured all 16 thumbnails as 480px PNGs; the Project queue atomically replaced older images and removed the combined gallery thumbnail. Thumbnail hashes broadcast only after writes complete, fixing early reads. Source or param changes discard stale captures so older frames cannot overwrite newer images.

At this stage, `pnpm check` passed 39 tests and `pnpm test:browser` passed 17 checks, covering all component switches, thumbnail updates, seeking, primary colors, and native-reference Logo pixels at 0.5/1/2 scale. See `artifacts/components-library-16/overview.png` for the gallery.
