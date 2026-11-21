# Exports

Everything about exporting a film: presets, codecs, sizes, fit, frame rates and compression. The [README](../README.md#export) has the short version.

Export from the player or CLI:

```sh
npx mografy export ./projects/my-animation --format mp4
npx mografy export ./projects/my-animation --format mp4 --codec h264
npx mografy export ./projects/my-animation --preset fast
npx mografy export ./projects/my-animation --preset master
npx mografy export ./projects/my-animation --format webm
npx mografy export ./projects/my-animation --format mp4 --orientation portrait --resolution 1080p
npx mografy export ./projects/my-animation --format lottie -o preview.lottie.json
npx mografy export ./projects/my-animation --format svga -o preview.svga
npx mografy export ./projects/intro ./projects/launch --preset share   # batch: one after another
npx mografy export --all                                             # batch: every project in projects/
```

**Batch export.** Name several projects, or `--all [folder]` for every project in a folder (default: your projects folder; folders starting with `_` are skipped). They export one after another with the same options, share one Chromium, and a project that fails is reported while the rest go on; Ctrl+C stops the batch and prints a summary. In the player, **Batch** next to **Export** opens the batch export dialog: tick films, choose format, encoder, resolution and frame rate (*Use less memory* is a switch), and they queue in the background; a card in the corner follows the queue while the dialog is closed, and switching projects does not stop it.

Four export presets cover most needs (Encoder in the Export dialog, `--preset` on the CLI):

| Preset | Output | Use it for |
| --- | --- | --- |
| `share` | MP4, H.264 8-bit | Any browser, Windows PCs, chat apps and social uploads |
| `high` (default) | MP4, H.265 10-bit | Smallest file at the same look; Apple devices, Chrome and Edge with hardware decoding |
| `fast` | MP4, hardware H.265 10-bit, GPU-drawn | Quick exports: VideoToolbox on macOS, NVIDIA NVENC, Intel Quick Sync or AMD AMF on Windows; software fallback elsewhere |
| `master` | MOV, ProRes 422 HQ 10-bit, PCM audio | Editing in Final Cut, Premiere or DaVinci Resolve |

Constant quality encodes while frames are captured, so there is no separate encoding wait; two-pass target bitrate is under Advanced settings. Audio is 48 kHz. Advanced settings also offer the shutter angle (360° by default, 180° for a film look) and ordered dithering for soft gradients. Exports work the same on macOS, Windows and Linux; the finished file names the encoder that wrote it.

MP4 uses 10-bit H.265 (HEVC) video and 48 kHz AAC audio by default. In tests on a 3D paper-texture film and a 2D motion film, H.265 at the same CRF matched H.264's quality at 50–58 % of the file size and took the same time to encode (Encoder speed Slow uses x265's medium preset, which is as fast as x264's slow). The file is tagged `hvc1`, so it plays in QuickTime, Safari, iOS and Android, Chrome and Edge, and uploads to YouTube, Instagram and TikTok. Firefox and some Windows PCs play HEVC only with hardware support or the HEVC Video Extensions, so for a website `<video>` or files sent to unknown players choose **Encoder → Share · H.264** in the Export dialog, pass `--preset share` (or `--codec h264`), or set `"codec": "h264"` under `render` in `mografy.json`. MP4 CRF and bitrate are on the H.264 scale for both codecs. WebM uses VP9 video and Opus audio at 128 kbps, defaulting to constant quality at CRF 32 rather than the MP4 target bitrate. Both support audio, motion sampling, glow, grain, and encoding controls. Finished files are written under `renders/`.

WebM quality presets:

| Quality | VP9 CRF | Motion samples | Encoder speed |
| --- | --- | --- | --- |
| Draft | 38 | 1 | Very fast |
| Standard | 32 | 4 | Medium |
| High | 26 | 8 | Slow |

The initial WebM draft inherits the project's motion samples and output effects; choosing a quality preset applies the values above. Draft also disables glow and grain. Lower CRF keeps more detail and usually produces larger files; higher CRF favors smaller files. Constant quality varies bitrate with scene complexity and does not guarantee a fixed size. VP9 may encode more slowly than H.264, and size savings depend on the scene and settings. CRF values are codec-specific, so compare actual outputs rather than matching MP4 and WebM numbers. Advanced settings also offer two-pass target bitrate. At equal average bitrate and duration, MP4 and WebM have similar file sizes.

A local comparison of the twelve-second intro at 640 × 360, 30 fps and one motion sample produced an 852,445-byte MP4 and a 300,321-byte WebM (64.77% smaller). Total export times were 15.89 and 17.28 seconds. This compares the formats' default encoding settings, including different audio bitrates; it is not a matched-quality benchmark or a prediction for other scenes. See the [measured comparison](../artifacts/webm-export/comparison.json).

Lottie and SVGA package embedded PNG frames, preserving Canvas artwork and effects without editable vector layers or audio. Lottie output is `.lottie.json`; SVGA output is compressed SVGA 2 protobuf.

If a finished video is too large, ask the shared `mografy` Skill to compress it, or run the Python helper directly (Python 3.10+, FFmpeg and ffprobe on PATH):

```sh
python3 .agents/skills/mografy/scripts/compress-video.py ./projects/my-animation/renders/film.mp4
python3 .agents/skills/mografy/scripts/compress-video.py ./projects/my-animation/renders/film.mp4 --target-mb 10 -o ./projects/my-animation/renders/film-share.mp4
```

The default writes a separate H.265 `film-compressed.mp4` using CRF 23 (H.264 scale) and retains audio; `--codec h264` writes H.264. `--target-mb` uses two passes and checks the actual decimal MB limit. Existing files are never overwritten; candidates that do not reduce size are discarded. See the [compression reference](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/video-compression.md) for quality, resolution, dependency overrides, and result verification. The maintained script is `scripts/compress-video.py`; `pnpm sync:skills` copies it into the shared Skill for both Codex and Claude.

The player's Export dialog offers these output sizes:

| Format | Sizes |
| --- | --- |
| Lottie | 256 × 256 — Square; 640 × 360 — Landscape |
| SVGA | 375 × 375 — Square; 375 × 750 — Portrait |
| MP4 / WebM landscape (16:9) | 1280 × 720 — 720p; 1920 × 1080 — 1080p |
| MP4 / WebM portrait (9:16) | 720 × 1280 — 720p; 1080 × 1920 — 1080p |

MP4 and WebM start in the authored canvas orientation, with icons to switch the output orientation while retaining 720p/1080p quality. A paused-frame preview shows the selected output. Each format remembers its size and Fit selection while the dialog stays open.

When the output aspect differs from the scene, **Fit** appears for all four formats:

| Fit option | Result |
| --- | --- |
| **Fit entire scene** (default) | Center the full artwork, filling extra space with the scene background |
| **Fill and crop** | Fill the output, cropping the centered artwork at the edges |
| **Adapt layout** | Give responsive scene code the output canvas dimensions so it can rearrange the composition |

All sixteen built-in components support landscape and portrait layouts. Choose **Adapt layout** when exporting a component in the other orientation. Custom scenes must use `ctx.width` and `ctx.height` to implement their own responsive layout; selecting this option alone does not rearrange fixed-coordinate artwork.

Output choices leave the main preview and saved project settings intact. Portrait video files default to `name-portrait.mp4` or `name-portrait.webm`. CLI `--orientation` and `--resolution` presets use **Fit entire scene**; `--orientation` alone defaults to 720p, and `--resolution` alone selects landscape. CLI exports without these flags use the project's render scale. Output names supplied with `-o` must be filenames or relative paths inside the project's `renders/` directory.

Mografy exports allow up to **60 fps for MP4 and WebM** and **30 fps for Lottie and SVGA**. SVGA uses its supported rates within this limit. The player, API, CLI, and direct render functions enforce the same limits. The export dialog caps inherited video frame rates at 60 fps without changing saved settings.

After starting a player export, the same dialog shows an animated robot, actual frame-capture progress, and elapsed time. Encoding and packaging use an indeterminate indicator. **Hide** keeps the export running and moves progress into a toast with **View** and **Cancel**; the top **Exporting** button also reopens it.

Completed MP4 and WebM videos can be played and downloaded in the dialog. **Done** dismisses the result, and **Last export** reopens it while the player retains that job. **Export** opens fresh settings. Failed or cancelled jobs offer **Settings** and, for exports started in this dialog, **Retry**.

Progress also appears in the CLI. Cancel a direct CLI export with Ctrl+C, or cancel a player export through the interface or `npx mografy export [project] --cancel`. Cancellation cleans up temporary data before finishing.
