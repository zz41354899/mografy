# Architecture

Design plan: [Mografy rebuild plan](https://claude.ai/code/artifact/41f66790-af5d-4c2f-9f0f-9e7278ae2aba).

## Principles

- Animation content lives only in scene modules. `mografy.json` stores settings, never layers or keyframes.
- Scenes are pure functions of time: `renderFrame(ctx, time, params)` draws from time, params, and data prepared by setup.
- The Server is the application's single project writer. After Claude or Codex edits a scene file, the same Server queue compiles, trial-renders in headless Chromium, and publishes it.
- Scene code runs only in the browser, either the player or headless Chromium; the Server's Node process never executes it.
- The player and exports load the same compiled scene, runtime, and post-processing code.

## Agent guidance and storyboards

`packages/core/src/guide.ts` owns the English scene contract, storyboard workflow, twelve animation principles, and short Skill/project entrypoints. One shared Skill, `mografy`, lives in the outer repository folder `.agents/skills/mografy/`, with local scene-authoring, built-in-component, intro, storyboard, animation-principle, and project references. Product development, scenes, and shot planning all use this entrypoint.

Root `AGENTS.md` routes Codex to the Skill. Root `CLAUDE.md` imports the same Skill, and `.claude/skills/mografy` is a relative symlink to `.agents/skills/mografy` for Claude discovery. Both hosts read the same physical files. Animation subprojects receive only `AGENTS.md` and `CLAUDE.md` pointers through `queueProjectWrite` and `atomicWrite`; they never create Skill folders. Exact generated guides migrate while custom instructions remain intact.

After a build, `pnpm sync:skills` regenerates the shared Skill, removes exact generated files from the former standalone storyboard Skill, ensures the Claude link, and migrates local examples and projects. All mutations run through the write queue; generated text uses `atomicWrite`.

Storyboards are project-specific planning artifacts under `storyboards/`, separate from scene execution and `mografy.json`. Codex invokes available image generation; Claude invokes Artifacts when available or writes a local HTML/Canvas preview. The Skill reports unavailable tools honestly. Motion principles translate into deterministic scene functions, never a runtime physics loop. Generated boards do not replace Chromium validation and actual frame review.

## Drawing interface

`FrameContext.draw` is created once per runtime and wraps common Canvas shapes, text, images, opacity, and transforms. Every method uses the same logical-coordinate context. There is no additional draw loop or global animation state; the scene remains `renderFrame(ctx, time, params)`.

The recommended local name is `const mografy = ctx.draw`, with calls such as `mografy.fill()`. Time is measured in seconds; use `const canvas = ctx.canvas` for the native context. Advanced effects and clipping use `ctx.shadow`, `ctx.blur`, `ctx.vignette`, `ctx.clip`, and `ctx.withCanvas`. Native Canvas operations remain available.

The API tracks fill/stroke switches. `push`/`pop` preserve both switches and native Canvas state. Each frame resets the switches and API stack after resetting the Canvas so out-of-order seeking or unbalanced pushes cannot contaminate the next frame. Methods can be destructured; the API object is not recreated per frame.

`ctx.canvas` retains native drawing and resolution scaling and can be mixed with the API. Do not cross-pair native save/restore with API push/pop. Use native operations for batched paths and complex clipping. This is a Mografy drawing wrapper, not full p5.js compatibility. The scene contract remains in `packages/core/src/guide.ts`.

## Data flow

```text
Claude/Codex + Skill -- edit scene files --> Project folder -- watch --+
Player -- HTTP (params, playhead, exports) ---------------------------+
CLI check/review/export ---------------------------------------------+
                                                                     v
                                                       Mografy Server / Project
                                                     Compile -> trial -> publish
                                                           |              |
                                                     WebSocket     Headless Chromium
                                                           v              v
                                                         Player    raw RGBA -> FFmpeg (MP4)
                                                                   PNG -> Lottie / SVGA 2
```

## Project responsibilities

`Project` coordinates verified publication and remains the sole project writer through `queueProjectWrite` and `atomicWrite`. Asset uploads allocate filenames and save their bytes in the same queued operation, so concurrent different-content uploads cannot overwrite one another. Playhead persistence and cached build files use the same writer.

`ProjectWatcher` owns filesystem events, debounce, and fallback polling. `ProjectFrames` owns serialized access to a cached Chromium page and thumbnail timers; closing waits for in-flight captures before releasing the host. `RenderJobs` owns export progress, cancellation, temporary storage, and cleanup, and receives a Project-owned queued write callback for completed files.

`ProjectSession` owns the active Project, lock, event subscription, catalog invalidation, serialized switches, and shutdown. `http.ts` owns transport startup, static serving, and WebSockets; `http-io.ts` owns body parsing and file responses, while workspace and project routes dispatch separately. Project routes capture their Project before awaiting bodies. Player writes include a project directory header, so a delayed action from a previously displayed project returns 409 rather than modifying the newly opened project; unscoped API clients remain compatible.

The shared `sceneRuntimeKey` identifies compiled version, canvas, seed, font descriptors, and the audio beat grid. Inspection, still pages, and player setup use this identity. Audio gain and output settings update without requiring scene setup. API changes to runtime inputs are trial-rendered before writing, and a failed disk configuration retains the last working runtime inputs. A later unrelated patch must also validate pending disk inputs before publishing them.

## Versions

The version is the first 16 characters of a hash of the compiled scene, its imported modules, and all files under `assets/`. Builds are stored at `.mografy/builds/<version>.js`; the player loads `/__mografy/scene/<version>.js`.

## Composition canvas

Optional project `aspectRatio` (`16:9` or `9:16`) selects the logical canvas independently of animation content. `sceneMetaForAspect` rounds the native short edge to a multiple of nine, within scene bounds, so even small/custom scenes have an exact aspect ratio. The browser Runtime uses the effective dimensions for setup, FrameContext, drawing, and effects. The Player reload key, Server metadata cache, still-page key, and thumbnail fingerprint include the orientation. Agent/API orientation patches trial-render in Chromium before writing through the Project queue; disk edits also republish dimensions when the scene hash stays unchanged. New-project scaffolding accepts the same setting and publishes the manifest last. The player and new-project UI have no canvas orientation controls; the preview follows authored dimensions.

The API's `size.fit: 'reflow'` creates a logical canvas at the requested output aspect, preserving short-edge detail. Responsive scene code performs the actual composition; no rotation, stretching, or implicit crop is used. The MP4 dialog and CLI default to contain. The dialog offers contain/cover and Adapt layout (`reflow`) under Fit when the export ratio differs from the authored scene. All sixteen built-in entries adapt to portrait dimensions with subject-specific sizing, social safe margins, stacked profile cards and measured text wrapping. Output orientation icons never patch the project or change the main preview. A small paused preview in the export dialog uses the same Runtime and output effects. Export overrides stay isolated from the project's saved canvas. Default portrait MP4 names append `-portrait` to preserve both versions.

## Parameters

The scene defines `params`; `mografy.json` stores only user overrides. When a scene changes, incompatible names, types, or ranges are removed from saved values and reported in player state.

## Trial rendering

Headless Chromium renders d/2, 0, d, d/4, and d/2 again. Both d/2 pixel hashes must match; otherwise `renderFrame` depends on previous calls and publication is rejected. `Math.random`, `Date.now`, and `performance.now` throw inside `renderFrame`.

## File watching

Recursive `fs.watch` reacts promptly. A file-fingerprint poll once per second catches missed events, including atomic file replacements on some platforms. Ignore `.mografy/`, `renders/`, `node_modules/`, and dot-prefixed files.

## HTTP API (127.0.0.1, same origin)

Core exports request schemas for project patches, source updates, playhead/seek, review sheets, project creation/opening, export, and cancellation. HTTP parsing validates runtime shapes instead of casting JSON to TypeScript interfaces. Malformed envelopes return 400; invalid project settings retain the existing 422 response. Player requests share one JSON/error client.

| Method and path | Purpose |
| --- | --- |
| `GET /__mografy/snapshot` | Current state |
| `WS /__mografy/events` | State and seek events |
| `GET /__mografy/source`, `POST /__mografy/source` | Read/submit scene source; validate before writing |
| `PATCH /__mografy/project` | Params, seed, audio, render and review settings |
| `PATCH /__mografy/state`, `POST /__mografy/seek` | Playhead position |
| `GET /__mografy/still?t=&kind=raw\|output` | Single PNG frame |
| `POST /__mografy/sheet` | PNG contact sheet |
| `POST /__mografy/render`, `POST /__mografy/render/cancel`, `POST /__mografy/review` | Export/cancel MP4, Lottie, SVGA, and generate review artifacts |
| `GET /__mografy/scene/<version>.js`, `GET /__mografy/files/<path>` | Compiled scene and project files |

## Export jobs

The player shell observes playback status changes, while `Playback` subscribes to frame time and owns the canvas/timeline/transport view. `Inspector` owns its tabs and controls. Session actions retain stable identities across snapshots, and project switches/unmounts cancel delayed playhead reports. Queued player loads skip superseded requests and dispose abandoned runtimes.

Export presentation uses explicit closed/settings/job/hidden transitions and a separate settings/job reducer that retains the submitted preview with its job ID. The dialog and background toast share progress calculation, progress markup, and cancellation handling. CLI parsing, export transport, and terminal progress live in separate modules; owned CLI projects close even when export startup rejects.

The player keeps one native modal across settings, job progress, cancellation/failure, and completion. `startRender` returns the exact job ID; WebSocket snapshots drive actual capture percentages and stages. Encoding/package progress is indeterminate rather than fabricated. The dialog retains the latest snapshot for its job and freezes its output reference inputs at submission. Progress uses the homepage’s teal keyframe mascot with a gentle CSS float loop in both the dialog and background toast; the scene reference is displayed only for completed image-frame formats. Settings closures reset drafts; dismissing a running job hides the dialog without cancelling and preserves it for the background progress toast’s View action or the top Exporting button. The toast shows real capture progress (indeterminate encoding/package), cancellation and connection state only while a running job is hidden. Native close events do not reopen/reset state. Completed MP4s use the actual served file in a video player, with Download and explicit dismissal. The success toast was removed; Last export in the top bar reopens the last result. Done dismisses completion; the primary Export action creates fresh settings even if a hidden job finished in the background. Failed/cancelled local jobs can retry saved settings; externally started jobs can open settings. Short stage headings, one progress metric and two primary actions replace explanatory copy and repeated stage/completion indicators. Reduced-motion mode disables the loading and entry effects.

`POST /__mografy/render` freezes the version, params, seed, and output settings at job start. Render overrides do not write back to `mografy.json`. MP4 capture and encoding run in system temporary storage; Lottie/SVGA are packaged in memory. Finished outputs return to the Project write queue and use `atomicWrite` under `renders/`.

An optional `size: { width, height, fit: 'contain' | 'cover' | 'reflow' }` sets an exact output viewport independently of render scale. Contain/cover retain the scene's logical dimensions and center proportional artwork with background margins or cropping. Reflow gives the scene the output aspect ratio for responsive drawing. Sampling and post-processing run on the output viewport for all three formats. Requests without `size` retain the existing scale behavior. The player offers two fixed sizes per format: Lottie 256 square or 640 × 360 landscape, SVGA 375 square or 375 × 750 portrait, and MP4 720p/1080p in either landscape (1280 × 720, 1920 × 1080) or portrait (720 × 1280, 1080 × 1920), selected using icons.

`POST /__mografy/render/cancel` cancels capture or FFmpeg by job ID. State becomes `cancelling`, then `cancelled` after cleanup. Closing a project also cancels jobs and awaits cleanup without publishing partial files. `mografy dev` observes Project snapshots directly, so player exports also report progress in the terminal.

Canvas scenes have no vector timeline. Lottie uses visible per-frame image layers and base64 PNGs; SVGA uses PNG images and alpha visibility tables inside zlib-compressed MovieEntity data. Neither executes scenes in Node or introduces SVG/GSAP. Identical PNGs are deduplicated, with limits on frames, pixels, and PNG bytes.

Core owns format-specific export frame-rate limits and validation: MP4 up to 60 fps, Lottie up to 30 fps, and SVGA's supported rates up to 30 fps. The export request schema checks explicit overrides; the Server checks resolved project settings; direct render functions validate before capture. The player filters options and caps inherited MP4 defaults without writing them back to the project. Scene preview stepping and project render settings retain their existing ranges.

The player keeps a lightweight raw live preview. All three export formats share `renderOutputFrame`, multisample blending, and post-processing. The Final frame UI was removed; inspect finished frames using output review sheets from `mografy review`.

## Built-in animation components

The CLI entrypoint resolves the nearest Mografy source checkout from the terminal's working directory before importing its build. A global PATH launcher can therefore be installed by another clone without redirecting local development to that clone. Unbuilt checkouts fail with setup instructions. Outside a source checkout, the launcher uses its own installation.

Recent projects and active-server discovery are scoped to the installation root under `~/.mografy/installations/<root-hash>/`. The old shared state is left untouched and is not resumed automatically. `MOGRAFY_STATE` explicitly overrides this scope; `MOGRAFY_HOME` overrides the project library. Exports resolve inside the opened project's `renders/` directory.

Installation paths and recent/active state live in `installation.ts` and `workspace-state.ts`. Component initialization is explicit at player-server startup or default-component selection; `listProjects` only reads existing projects and previews. Browser integration cases each own a temporary library, installation state, server, and browser, grouped into player, export, and project/audio suites.

`project-scaffold.ts` owns creation and generated-file migration; `components.ts` owns built-in initialization. Library name allocation and creation share a parent queue, with project files written under their own Project queues. Recent-state read/modify/write and conditional active-record removal are serialized by installation-state directory.

App composes player lifecycle, parameter persistence, effects persistence, and keyboard hooks. Inspector tabs compose separate panels. ExportDialog handles modal/job orchestration, ExportSettings renders controls, and a pure export-draft reducer retains independent settings for each format. Preset labels stay outside strict export-size requests. Retry retains the submitted output settings while allowing repaired source to render.

The Skill uses [the component reference](../.agents/skills/mografy/references/built-in-components.md) as a catalog of all sixteen source entries, their reusable functions, and adaptation/review rules. [The intro reference](../.agents/skills/mografy/references/intro.md) documents the twelve-second multi-shot example and its actual assets, timing, and review settings. Both are generated from `guide.ts`; agents read the referenced scene code before adapting it.

Starter `scenes/components.ts` and `scenes/social-components.ts` contain pure time functions copied into new projects. `scenes/showcase.ts` retains the gallery. Sixteen independent scene entries share full-frame scopes in `scenes/component-frame.ts`, without presentation labels or borders. Logo reveal draws original brand paths from `scenes/brand-logo.ts` with Canvas Path2D. The runtime provides drawing and synchronous scopes, with no stored component animation state.

First launch creates 16 centered 9:16 portrait projects at `library/.components/{id}`: six basic animations and ten social/UI components. They appear in the component group, with Stagger text selected by default. Current or last-used projects still take priority. Initialization and live updates share the path queue in `project.ts`, use `atomicWrite`, and publish the manifest last.

Sixteen pre-rendered portrait PNGs (480px wide) ship under `packages/server/thumbnails/`. Component initialization seeds missing previews only when the source/asset fingerprint and raw-preview settings match the bundled capture. Existing previews and customized components are preserved. Component rows use a 9:16 thumbnail box with contain fitting so portrait artwork is not cropped into a landscape tile. Initialization runs once per component per server process; image requests share a short-lived project catalog instead of reinitializing and rescanning the library for every image. Versioned thumbnail responses support immutable browser caching and ETags; requests with an old version bypass immutable caching.

After source or param changes, Chromium captures a fresh 480px PNG after a 300ms debounce, directly downsizing the rendered Canvas without a full-resolution pixel readback. The Project queue atomically replaces `.mografy/thumb.png`. If the version or settings change during capture, discard the stale result. Publish the thumbnail hash only after writing; the player then refreshes the project list and thumbnail URL. After changing built-in scene sources or assets, run `pnpm thumbnails:generate` to update the bundled images and fingerprints through real Chromium captures.

## License

Mografy source code and documentation use the root [MIT License](../LICENSE), with `license: "MIT"` in the workspace and all six package manifests. Third-party assets and dependencies keep their original terms, including the bundled ABeeZee font's SIL Open Font License.
