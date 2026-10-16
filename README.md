<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/mografy-logo-inverse.svg">
    <img src="docs/brand/mografy-logo.svg" alt="Mografy" width="460">
  </picture>
</p>

# Mografy

Mografy is a local Canvas animation tool for Claude Code and Codex. One shared `mografy` Skill helps the agent plan storyboards, adapt working examples, write scenes, review frames, and export the result. The browser player provides playback, scrubbing, subtitles, colors, effects, and audio controls.

Describe the animation in your agent, then watch it in `mografy dev`. The agent edits scene files; Mografy compiles and trial-renders them in Chromium before updating the player at the same time position.

[![Watch the twelve-second Mografy intro](https://github.com/zz41354899/mografy/blob/main/docs/media/mografy-intro.gif)](https://github.com/zz41354899/mografy/raw/refs/heads/main/docs/media/mografy-intro.mp4)

[Watch the intro with audio (MP4)](https://github.com/zz41354899/mografy/raw/refs/heads/main/docs/media/mografy-intro.mp4).

## Latest updates

**2026-10-17** — Optional extras for film-style videos and Chinese / Japanese copy: camera moves, sakura petal and other transitions, vertical Japanese text, and OFL CJK fonts. Ask your agent for "sakura transitions" or "vertical Japanese copy" and it adds what the project needs. Installation is unchanged. See the [changelog](CHANGELOG.md).

## Get started

You need [Node.js](https://nodejs.org/) 22.12 or later. Then run:

```sh
git clone https://github.com/zz41354899/mografy.git
cd mografy
corepack enable
pnpm install
mografy dev
```

`pnpm install` installs dependencies and then, automatically, builds Mografy, downloads the Chromium it uses for checks and exports, and puts the `mografy` command on your PATH. `mografy dev` opens the player with the sixteen built-in animations. If you see them, the installation works.

To update later, run `git pull && pnpm install` in the same folder.

If `corepack enable` reports a permission error, install pnpm with `npm install -g pnpm` instead. Contributors changing Mografy itself also need `pnpm sync:skills`, `pnpm check` and `pnpm test:browser`; see [Development and architecture](#development-and-architecture).

### More setup options

`install-command` installs a launcher into a writable PATH directory. When run inside a Mografy checkout or its subfolders, the command uses that checkout's build, even if the PATH launcher was installed by an older clone. An unbuilt checkout reports the required install/build commands. Outside a checkout, it uses the installation that created the launcher. After pulling source changes, run `pnpm install` again.

Inside the source checkout, `mografy dev` opens the current project when the folder contains `mografy.json`, otherwise the last project used by that installation. First launch opens Stagger text and initializes the sixteen independent built-in animations. Outside the checkout, pass a project path or run the command from a folder containing `mografy.json`.

Create an animation or open the bundled intro:

```sh
mografy dev ./projects/my-animation --yes
mografy dev ./examples/mografy-intro
```

Source installations create projects under `projects/` by default. Set `MOGRAFY_HOME` to choose another library directory. The Projects panel switches between projects and built-in animations in the same player.

All paths are resolved on the user's computer. Explicit project arguments resolve from the terminal's current folder; exports go to that project's `renders/`. To choose your own library and project:

```sh
export MOGRAFY_HOME="$HOME/Animations"
mografy dev "$MOGRAFY_HOME/my-animation" --yes
```

Each installation keeps separate recent-project and active-player state under `~/.mografy/installations/`; the former shared history is not imported.

| Environment variable | Purpose |
| --- | --- |
| `MOGRAFY_HOME` | Project library directory |
| `MOGRAFY_PROJECT` | Default project when no path is passed; explicit paths take priority |
| `MOGRAFY_STATE` | State directory; using the same override across installations shares their history and active player |
| `MOGRAFY_FFMPEG` | FFmpeg executable override; otherwise use the bundled binary, then `ffmpeg` on PATH |

## Create your first animation

1. Run `mografy dev ./projects/my-animation --yes` to create a project and open its player.
2. Open the repository in Codex or Claude Code and describe the animation, naming the project folder. The shared Skill guides scene authoring and review.
3. Watch the player update after each successful compile and Chromium trial render. Scrub to check timing and adjust the exposed scene controls.
4. Run `mografy check ./projects/my-animation` and `mografy review ./projects/my-animation`, then inspect the generated images. Export from the player or CLI when ready.

For example:

> Create an eight-second 9:16 animation in `projects/my-animation`, with a native 1080 × 1920 canvas. Use the Typewriter and Logo reveal components as references. Show “Hello, Mografy.”, then reveal the logo with a teal accent. Review the actual frames and export an MP4.

For a longer sequence, ask for a storyboard first. Scene code determines the composition; the player exposes the parameters declared by that scene.

## One Skill for Codex and Claude

The Skill lives at [`.agents/skills/mografy/SKILL.md`](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/SKILL.md), outside animation subprojects. Claude's `.claude/skills/mografy` entry links to that same folder, and [CLAUDE.md](https://github.com/zz41354899/mografy/blob/main/CLAUDE.md) imports it. Both hosts read one maintained copy.

Its English references cover:

| Reference | Use |
| --- | --- |
| [Project](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/project.md) | Repository sources, architecture, and development checks |
| [Scene authoring](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/scene-authoring.md) | Scene contract, drawing API, validation, review, and export |
| [Built-in components](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/built-in-components.md) | All sixteen working component scenes and how to adapt them |
| [Intro](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/intro.md) | The existing twelve-second film, its source, assets, timing, and review points |
| [Storyboards](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/storyboard.md) | Shot planning and host-specific visual boards |
| [Animation principles](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/animation-principles.md) | The twelve principles applied to deterministic Canvas motion |
| [Camera and transitions](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/camera-transitions.md) | `cinema.ts` camera moves, transitions including sakura particle wipes, and atmosphere |
| [CJK typography](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/cjk-typography.md) | Vertical Japanese / Chinese text, CJK line breaking, and the bundled OFL fonts |
| [Video compression](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/video-compression.md) | Python helper for smaller exported MP4s, quality controls, and upload-size budgets |

[packages/core/src/guide.ts](https://github.com/zz41354899/mografy/blob/main/packages/core/src/guide.ts) owns the generated entrypoint and references. After editing it, run `pnpm build` and `pnpm sync:skills`. Animation projects receive `AGENTS.md` and `CLAUDE.md` pointers to the shared Skill.

## Working examples

The sixteen built-in animations are authoring references as well as playable examples:

- **Text and numbers:** Stagger text, Typewriter, Lower third, Count up.
- **Brand and layout:** Pop card, Logo reveal, Social card, Follow badge.
- **Interactions:** YouTube subscribe, AI chat, Like burst, Notification toast, Toggle switch.
- **Indicators:** Progress bar, Pulse dots, Audio wave.

Reusable functions live in [components.ts](https://github.com/zz41354899/mografy/blob/main/packages/server/template/scenes/components.ts) and [social-components.ts](https://github.com/zz41354899/mografy/blob/main/packages/server/template/scenes/social-components.ts). Each example has its own scene entry, controls, preview, and export. Source copies live under `packages/server/template/scenes/`; editable installed projects live under the library's `.components/{id}/` directory. New projects include the reusable modules and scene entries.

All sixteen built-in component projects default to centered **9:16 portrait** previews. Their bundled thumbnails also show the full portrait canvas, so a new installation can show all sixteen previews before opening their projects. Scene edits refresh the opened project's thumbnail automatically. After changing built-in source scenes or assets, maintainers regenerate the bundled previews with `pnpm thumbnails:generate`.

Optional [extras](https://github.com/zz41354899/mografy/tree/main/extras) are not installed; installation contains only the sixteen built-in components. The agent copies an extra into a project when the brief needs it: [cinema.ts](https://github.com/zz41354899/mografy/blob/main/extras/cinema/cinema.ts) for camera moves on image plates, transitions (crossfade, dip, flash, iris, slash, whip, sakura-style particle wipes) and atmosphere, and [cjk.ts](https://github.com/zz41354899/mografy/blob/main/extras/cjk/cjk.ts) with OFL Noto Sans / Serif CJK TC subsets for vertical Japanese / Chinese text and CJK line breaking. See the [camera and transition](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/camera-transitions.md) and [CJK typography](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/cjk-typography.md) references.

The [component reference](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/built-in-components.md) links every entry and explains layout, timing, local imports, and review. Ask the agent to adapt the relevant component to your project's own assets and style.

The [Mografy intro](https://github.com/zz41354899/mografy/blob/main/examples/mografy-intro/scenes/main.ts) is a 1920 × 1080, twelve-second, 30fps example: code introduces the idea, a preview plays and scrubs, an external edit updates the picture, and the original logo completes the sequence. Its [reference](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/intro.md) documents the four beats, fonts, music, captions, and transition sampling.

## Storyboards and motion direction

For example:

> Create an English storyboard for a twelve-second product intro. Use the Mografy intro as a sequence reference and adapt the logo reveal and lower third components to this project's assets.

The agent writes `storyboards/storyboard.md`, with each shot's time range, purpose, composition, assets, key poses, camera, copy/audio, transition, animation principles, and review times.

Codex invokes image generation for visual panels. Claude uses Artifacts when available, otherwise saves a standalone `storyboards/storyboard.html` preview. Plans and prompts are in English. When implementation is requested, the agent continues into scene modules and validates the actual frames.

The animation reference covers squash and stretch, anticipation, staging, straight ahead action and pose to pose, follow through and overlapping action, slow in and slow out, arcs, secondary action, timing, exaggeration, solid drawing, and appeal. Apply the principles that support each shot and its reading holds.

## Scene model

A scene draws the complete picture from absolute `time`, resolved params, and prepared assets. `mografy.json` stores project settings; animation code lives in scene modules.

```ts
import { ease, lerp, pr } from '@mografy/runtime';
import type { FrameContext } from '@mografy/runtime';

export const meta = { width: 1920, height: 1080, duration: 4, fps: 30, background: '#17191d' };
export const params = {
  accent: { name: 'Accent', type: 'color' as const, default: '#12b5a5' },
};

export function renderFrame(ctx: FrameContext, time: number, params: Readonly<Record<string, unknown>>) {
  const mografy = ctx.draw;
  mografy.fill(String(params.accent));
  mografy.circle(ctx.width / 2, ctx.height / 2, lerp(20, 160, ease.outCubic(pr(time, 0, 0.8))));
}
```

Use `ctx.draw` for common drawing, `ctx.canvas` for native Canvas operations, and `ctx.withCanvas` or `ctx.clip` for isolated scopes. Scenes run only in the browser and must render deterministically when seeking in any order. The player and exports share the same runtime and post-processing. See the [scene-authoring reference](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/scene-authoring.md) for the full contract.

After editing a scene:

```sh
mografy check ./projects/my-animation
mografy review ./projects/my-animation
```

`check` compiles and trial-renders in real Chromium. `review` creates raw stills, output frames, and transition sheets under `renders/`. Inspect those images for clipping, overlap, legibility, hierarchy, safe margins, reading time, and transition continuity.

## Player and exports

The Scene inspector groups Subtitles, Colors, and Controls. Only strings marked `role: 'subtitle'` appear as editable subtitles; the agent edits other copy in source. The Effects inspector provides Glow and Grain with percentage inputs, reset, and an Original/With effects comparison. Audio supports a track, volume, and beat-grid settings.

The main preview follows the authored scene's dimensions and has no orientation switch. For a new **9:16 portrait** video, ask the agent to create a native 1080 × 1920 scene with vertical layout, wrapped text, and social safe margins. The shared Skill records this requirement. An optional saved `aspectRatio` is also read by agents and the Runtime. Portrait Guides reserve conservative space for social overlays.

Playback supports Space, frame stepping with arrows, beat stepping with Shift+arrows when audio is present, Loop (`L`), Guides (`G`), and Projects (`P`).

Export from the player or CLI:

```sh
mografy export ./projects/my-animation --format mp4
mografy export ./projects/my-animation --format mp4 --orientation portrait --resolution 1080p
mografy export ./projects/my-animation --format lottie -o preview.lottie.json
mografy export ./projects/my-animation --format svga -o preview.svga
```

MP4 supports audio, motion sampling, glow, grain, and H.264 encoding settings. Lottie and SVGA package embedded PNG frames, preserving Canvas artwork and effects without editable vector layers or audio. Lottie output is `.lottie.json`; SVGA output is compressed SVGA 2 protobuf. Finished files are written under `renders/`.

If a finished video is too large, ask the shared `mografy` Skill to compress it, or run the Python helper directly (Python 3.10+, FFmpeg and ffprobe on PATH):

```sh
python3 .agents/skills/mografy/scripts/compress-video.py ./projects/my-animation/renders/film.mp4
python3 .agents/skills/mografy/scripts/compress-video.py ./projects/my-animation/renders/film.mp4 --target-mb 10 -o ./projects/my-animation/renders/film-share.mp4
```

The default writes a separate `film-compressed.mp4` using CRF 23 and retains audio. `--target-mb` uses two passes and checks the actual decimal MB limit. Existing files are never overwritten; candidates that do not reduce size are discarded. See the [compression reference](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/video-compression.md) for quality, resolution, dependency overrides, and result verification. The maintained script is `scripts/compress-video.py`; `pnpm sync:skills` copies it into the shared Skill for both Codex and Claude.

The player's Export dialog offers these output sizes:

| Format | Sizes |
| --- | --- |
| Lottie | 256 × 256 — Square; 640 × 360 — Landscape |
| SVGA | 375 × 375 — Square; 375 × 750 — Portrait |
| MP4 landscape (16:9) | 1280 × 720 — 720p; 1920 × 1080 — 1080p |
| MP4 portrait (9:16) | 720 × 1280 — 720p; 1080 × 1920 — 1080p |

MP4 starts in the authored canvas orientation, with icons to switch the output orientation while retaining 720p/1080p quality. A paused-frame preview shows the selected output. Each format remembers its size and Fit selection while the dialog stays open.

When the output aspect differs from the scene, **Fit** appears for all three formats:

| Fit option | Result |
| --- | --- |
| **Fit entire scene** (default) | Center the full artwork, filling extra space with the scene background |
| **Fill and crop** | Fill the output, cropping the centered artwork at the edges |
| **Adapt layout** | Give responsive scene code the output canvas dimensions so it can rearrange the composition |

All sixteen built-in components support landscape and portrait layouts. Choose **Adapt layout** when exporting a component in the other orientation. Custom scenes must use `ctx.width` and `ctx.height` to implement their own responsive layout; selecting this option alone does not rearrange fixed-coordinate artwork.

Output choices leave the main preview and saved project settings intact. Portrait MP4 files default to `name-portrait.mp4`. CLI `--orientation` and `--resolution` presets use **Fit entire scene**; `--orientation` alone defaults to 720p, and `--resolution` alone selects landscape. CLI exports without these flags use the project's render scale. Output names supplied with `-o` must be filenames or relative paths inside the project's `renders/` directory.

Mografy exports allow up to **60 fps for MP4** and **30 fps for Lottie and SVGA**. SVGA uses its supported rates within this limit. The player, API, CLI, and direct render functions enforce the same limits. The export dialog caps older MP4 project defaults at 60 fps without changing saved settings.

After starting a player export, the same dialog shows an animated robot, actual frame-capture progress, and elapsed time. Encoding and packaging use an indeterminate indicator. **Hide** keeps the export running and moves progress into a toast with **View** and **Cancel**; the top **Exporting** button also reopens it.

Completed MP4s can be played and downloaded in the dialog. **Done** dismisses the result, and **Last export** reopens it while the player retains that job. **Export** opens fresh settings. Failed or cancelled jobs offer **Settings** and, for exports started in this dialog, **Retry**.

Progress also appears in the CLI. Cancel a direct CLI export with Ctrl+C, or cancel a player export through the interface or `mografy export [project] --cancel`. Cancellation cleans up temporary data before finishing.

## Commands and project structure

| Command | Purpose |
| --- | --- |
| `mografy dev [project]` | Open the player |
| `mografy init [project]` | Create a project |
| `mografy check [project]` | Compile and trial-render |
| `mografy review [project] [--video file.mp4]` | Generate review images and optional video comparisons |
| `mografy export [project] --format mp4\|lottie\|svga` | Export the animation |
| `mografy stop [project]` | Stop the project's player server |
| `mografy --help` | Show commands and supported options |

Use `mografy dev --yes` to create a missing project without a prompt, `--no-open` to start the player without opening a browser, and `--port <port>` to choose its port (default: 4173, then the next free port). For `dev`, `check`, `review`, `export`, and `stop`, omitted project paths use `MOGRAFY_PROJECT` when set, otherwise the current project or the source checkout's default project. `mografy init` without a path creates a project in the current folder.

```text
mografy/
  .agents/skills/mografy/       Shared Skill, references, and video-compression helper
  .claude/skills/mografy       Link to the same Skill
  packages/server/template/   Source component library and project template
  examples/mografy-intro/      Twelve-second reference animation
  examples/analytics-product/  Eight-second analytics interaction demo
  examples/mografy-brand/      Eight-second brand introduction
  examples/follow-interaction/ Eight-second Follow button interaction
  projects/                   Editable animation projects and installed components
  docs/                       Architecture and development status

animation-project/
  mografy.json                 Scene entry, aspectRatio, params, fonts, audio, render, review
  scenes/                     Animation code and local reusable components
  assets/                     Images, fonts, and audio
  AGENTS.md / CLAUDE.md        Shared Skill pointers
  storyboards/                Written and visual planning outputs
  renders/                    Exports and review images
  .mografy/                   Managed builds and server state
```

## Development and architecture

| Package | Responsibility |
| --- | --- |
| `core` | Settings schema, shared contracts, generated Skill guidance |
| `runtime` | Browser scene execution, drawing, sampling, effects |
| `render` | Compilation, Chromium hosting, exports, frame review |
| `server` | Project write queue, atomic writes, watching, HTTP/WebSocket |
| `web` | Player and inspector |
| `cli` | Development, validation, review, export, project creation |

```sh
pnpm check
pnpm test:browser
pnpm --filter @mografy/web dev
```

Read [architecture](https://github.com/zz41354899/mografy/blob/main/docs/architecture.md) for the data flow and invariants, [status](https://github.com/zz41354899/mografy/blob/main/docs/STATUS.md) for completed work and remaining tasks, and [AGENTS.md](https://github.com/zz41354899/mografy/blob/main/AGENTS.md) before repository changes.

## License

Mografy source code and documentation use the [MIT License](https://github.com/zz41354899/mografy/blob/main/LICENSE), following the [standard MIT text](https://opensource.org/license/mit). Package manifests declare `MIT`. Third-party dependencies and bundled assets retain their original terms; the bundled ABeeZee font uses the [SIL Open Font License](https://github.com/zz41354899/mografy/blob/main/packages/server/template/assets/OFL.txt).
