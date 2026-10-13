# Mografy

Mografy is a local Canvas animation tool for Claude Code and Codex. One shared `mografy` Skill helps the agent plan storyboards, adapt working examples, write scenes, review frames, and export the result. The browser player provides playback, scrubbing, subtitles, colors, effects, and audio controls.

Describe the animation in your agent, then watch it in `mografy dev`. The agent edits scene files; Mografy compiles and trial-renders them in Chromium before updating the player at the same time position.

## Get started

Requires Node.js 22.12 or later and pnpm. Run these commands from the repository root:

```sh
pnpm install
pnpm build
pnpm sync:skills
pnpm exec playwright install chromium
pnpm install-command
mografy dev
```

`install-command` installs a launcher into a writable PATH directory. Mografy currently runs from this source workspace. After pulling source changes, repeat `pnpm install`, `pnpm build`, and `pnpm sync:skills`.

The player opens the current project when the folder contains `mografy.json`, otherwise the last project used. First launch opens Stagger text and initializes the sixteen independent built-in animations.

Create an animation or open the bundled intro:

```sh
mografy dev ./projects/my-animation --yes
mografy dev ./examples/mografy-intro
```

Source installations create projects under `projects/` by default. Set `MOGRAFY_HOME` to choose another library directory. The Projects panel switches between projects and built-in animations in the same player.

## One Skill for Codex and Claude

The Skill lives at [`.agents/skills/mografy/SKILL.md`](.agents/skills/mografy/SKILL.md), outside animation subprojects. Claude's `.claude/skills/mografy` entry links to that same folder, and [CLAUDE.md](CLAUDE.md) imports it. Both hosts read one maintained copy.

Its English references cover:

| Reference | Use |
| --- | --- |
| [Project](.agents/skills/mografy/references/project.md) | Repository sources, architecture, and development checks |
| [Scene authoring](.agents/skills/mografy/references/scene-authoring.md) | Scene contract, drawing API, validation, review, and export |
| [Built-in components](.agents/skills/mografy/references/built-in-components.md) | All sixteen working component scenes and how to adapt them |
| [Intro](.agents/skills/mografy/references/intro.md) | The existing twelve-second film, its source, assets, timing, and review points |
| [Storyboards](.agents/skills/mografy/references/storyboard.md) | Shot planning and host-specific visual boards |
| [Animation principles](.agents/skills/mografy/references/animation-principles.md) | The twelve principles applied to deterministic Canvas motion |

[packages/core/src/guide.ts](packages/core/src/guide.ts) owns the generated entrypoint and references. After editing it, run `pnpm build` and `pnpm sync:skills`. Animation projects receive `AGENTS.md` and `CLAUDE.md` pointers to the shared Skill.

## Working examples

The sixteen built-in animations are authoring references as well as playable examples:

- **Text and numbers:** Stagger text, Typewriter, Lower third, Count up.
- **Brand and layout:** Pop card, Logo reveal, Social card, Follow badge.
- **Interactions:** YouTube subscribe, AI chat, Like burst, Notification toast, Toggle switch.
- **Indicators:** Progress bar, Pulse dots, Audio wave.

Reusable functions live in [components.ts](packages/server/template/scenes/components.ts) and [social-components.ts](packages/server/template/scenes/social-components.ts). Each example has its own scene entry, controls, preview, and export. Source copies live under `packages/server/template/scenes/`; editable installed projects live under the library's `.components/{id}/` directory. New projects include the reusable modules and scene entries.

The [component reference](.agents/skills/mografy/references/built-in-components.md) links every entry and explains layout, timing, local imports, and review. Ask the agent to adapt the relevant component to your project's own assets and style.

The [Mografy intro](examples/mografy-intro/scenes/main.ts) is a 1920 × 1080, twelve-second, 30fps example: code introduces the idea, a preview plays and scrubs, an external edit updates the picture, and the original logo completes the sequence. Its [reference](.agents/skills/mografy/references/intro.md) documents the four beats, fonts, music, captions, and transition sampling.

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

Use `ctx.draw` for common drawing, `ctx.canvas` for native Canvas operations, and `ctx.withCanvas` or `ctx.clip` for isolated scopes. Scenes run only in the browser and must render deterministically when seeking in any order. The player and exports share the same runtime and post-processing. See the [scene-authoring reference](.agents/skills/mografy/references/scene-authoring.md) for the full contract.

After editing a scene:

```sh
mografy check ./projects/my-animation
mografy review ./projects/my-animation
```

`check` compiles and trial-renders in real Chromium. `review` creates raw stills, output frames, and transition sheets under `renders/`. Inspect those images for clipping, overlap, legibility, hierarchy, safe margins, reading time, and transition continuity.

## Player and exports

Scene groups Subtitles, Colors, and Controls. Only strings marked `role: 'subtitle'` appear as editable subtitles; the agent edits other copy in source. Effects controls Glow and Grain with percentage inputs, reset, and an Original/With effects comparison. Audio supports a track, volume, and beat-grid settings.

Playback supports Space, frame stepping with arrows, beat stepping with Shift+arrows when audio is present, Loop (`L`), Guides (`G`), and Projects (`P`).

Export from the player or CLI:

```sh
mografy export ./projects/my-animation --format mp4
mografy export ./projects/my-animation --format lottie -o preview.lottie.json
mografy export ./projects/my-animation --format svga -o preview.svga
```

MP4 supports audio, motion sampling, glow, grain, and H.264 encoding settings. Lottie and SVGA package embedded PNG frames, preserving Canvas artwork and effects without editable vector layers or audio. Lottie output is `.lottie.json`; SVGA output is compressed SVGA 2 protobuf. Finished files are written under `renders/`.

Progress appears in the CLI and player. Cancel a direct CLI export with Ctrl+C, or cancel a player export through the interface or `mografy export [project] --cancel`. Cancellation cleans up temporary data before finishing.

## Commands and project structure

| Command | Purpose |
| --- | --- |
| `mografy dev [project]` | Open the player |
| `mografy init [project]` | Create a project |
| `mografy check [project]` | Compile and trial-render |
| `mografy review [project] [--video file.mp4]` | Generate review images and optional video comparisons |
| `mografy export [project] --format mp4\|lottie\|svga` | Export the animation |
| `mografy stop [project]` | Stop the project's player server |

```text
mografy/
  .agents/skills/mografy/       Shared Skill and six reference documents
  .claude/skills/mografy       Link to the same Skill
  packages/server/template/   Source component library and project template
  examples/mografy-intro/      Twelve-second reference animation
  projects/                   Editable animation projects and installed components
  docs/                       Architecture and development status

animation-project/
  mografy.json                 Scene entry, params, fonts, audio, render, review
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

Read [architecture](docs/architecture.md) for the data flow and invariants, [status](docs/STATUS.md) for completed work and remaining tasks, and [AGENTS.md](AGENTS.md) before repository changes.

## License

Mografy source code and documentation use the [MIT License](LICENSE), following the [standard MIT text](https://opensource.org/license/mit). Package manifests declare `MIT`. Third-party dependencies and bundled assets retain their original terms; the bundled ABeeZee font uses the [SIL Open Font License](packages/server/template/assets/OFL.txt).
