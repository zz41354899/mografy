# Development status

Updated: 2026-10-13

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

Each project currently represents one animation with one scene entrypoint. Multiple compositions in one project, such as 16:9 and 9:16 versions, remain unimplemented; see the plan's open decisions.

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
