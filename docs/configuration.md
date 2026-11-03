# Configuration

Most people never need these settings. A default installation creates projects in the checkout's `projects/` folder and works without any configuration.

## The mografy command

`install-command` installs a launcher into a writable PATH directory. When run inside a Mografy checkout or its subfolders where `pnpm install` has run (it records the checkout in `~/.mografy/trusted-checkouts`), the command uses that checkout's build, even if the PATH launcher was installed by an older clone. An unbuilt checkout reports the required install/build commands. Outside a checkout, it uses the installation that created the launcher. The launcher itself finds the checkout each time it runs: if the installing checkout was moved or deleted, it still works from inside any other checkout, and outside one it prints the single repair command (`node packages/cli/bin/mografy.js install-command`, run from your Mografy folder) instead of a Node stack trace. It uses `node` from PATH, so upgrading Node does not break it. Run `mografy update --check` to check the installation selected by the launcher, or `mografy update` to update it and restart its active player. The command prints the checkout path and revision. Older installations need a one-time `git pull --ff-only` and `pnpm install` after stopping the player. The updater handles shared Skill synchronization automatically.

Inside the source checkout, `mografy dev` opens the current project when the folder contains `mografy.json`, otherwise the last project used by that installation. First launch opens Stagger text and initializes the sixteen independent built-in animations. Outside the checkout, pass a project path or run the command from a folder containing `mografy.json`.

## Where projects live

Source installations create projects under `projects/` by default. Set `MOGRAFY_HOME` to choose another library directory. The Projects panel switches between projects and built-in animations in the same player.

All paths are resolved on your computer. Explicit project arguments resolve from the terminal's current folder; exports go to that project's `renders/`. To keep new animations in your own library:

```sh
export MOGRAFY_HOME="$HOME/Animations"
mografy dev
```

Each installation keeps its own recent-project and active-player state under `~/.mografy/installations/`.

## Environment variables

| Environment variable | Purpose |
| --- | --- |
| `MOGRAFY_HOME` | Project library directory |
| `MOGRAFY_PROJECT` | Default project when no path is passed; explicit paths take priority |
| `MOGRAFY_STATE` | State directory; using the same override across installations shares their history and active player |
| `MOGRAFY_FFMPEG` | FFmpeg executable override; otherwise use the bundled binary, then `ffmpeg` on PATH. Point it at a build with your GPU's encoders (NVENC, Quick Sync, AMF, VA-API) if the bundled one lacks them; the `fast` preset uses whichever works |
| `MOGRAFY_CANVAS` | `cpu` (default) or `gpu`: canvas backing for headless rendering, checks and review. Video exports follow `render.canvas` instead (the `fast` preset sets `gpu`). `cpu` gives identical pixels on every machine; `gpu` uses Metal on macOS and Direct3D 11 on Windows, and its edges may differ slightly |

## Export settings

Video export settings live under `render` in `mografy.json`; the Export dialog and `mografy export --preset` override them for one export without saving.

| Setting | Default | Purpose |
| --- | --- | --- |
| `codec` | `h265` | MP4 codec: `h265` (10-bit) or `h264` |
| `encoding` | `crf` | `crf` constant quality, `two-pass` target `bitrate`, or `hardware` (the GPU encoder, software fallback) |
| `crf`, `preset`, `bitrate` | `18`, `medium`, `12M` | Software encoder quality and speed; MP4 values are on the H.264 scale |
| `hardwareQuality` | `65` | Hardware encoder quality, 1–100 |
| `canvas` | `cpu` | Where export frames are drawn: `cpu` or `gpu` (macOS and Windows; elsewhere `cpu`) |
| `workers` | `auto` | Parallel capture segments, or a number from 1 to 8 |
| `samples`, `mixing` | `4`, `srgb` | Motion samples per frame and the space they mix in |
| `shutter` | `360` | Shutter angle in degrees; `180` gives shorter, film-like motion blur |
| `sampleWindow` | `after` | `centred` places each frame's samples around its own time, in step with the audio |
| `adaptiveSamples` | `false` | Mix only two samples where a frame barely changes |
| `dither` | `false` | Ordered dither before 8-bit rounding, against banding |
| `glow`, `grain` | `0.12`, `0.008` | Output effects |
| `includeAudio` | `true` | Add the project's audio (48 kHz) |

`shutter`, `sampleWindow`, `adaptiveSamples` and `dither` change the picture, so they are off or at their old values unless a project or export turns them on. Exports work in the project's `.mografy/tmp/`, which the project's `.gitignore` already excludes.
