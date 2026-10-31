# Compress an exported video

Use this workflow when a finished render is too large to upload or share, or when the user requests a smaller video. Work from the actual exported video (normally in the project's `renders/` folder). Scene edits, a new render, and a storyboard are unnecessary for compression alone. This helper outputs H.265 MP4 (tagged `hvc1`) by default, or H.264 with `--codec h264`; it does not compress Lottie JSON or SVGA packages, and does not preserve transparency or HDR. Use H.264 when the file goes into a website `<video>`, to Firefox users or to Windows PCs without HEVC support.

## Run the bundled Python helper

Requires Python 3.10+ and FFmpeg with `libx265` (or `libx264` for `--codec h264`), AAC, and `ffprobe` on PATH; the helper stops with a clear message when libx265 is missing. No pip packages are needed. On macOS, `brew install ffmpeg` supplies FFmpeg and ffprobe. The helper accepts `--ffmpeg` / `--ffprobe` or `MOGRAFY_FFMPEG` / `MOGRAFY_FFPROBE` executable overrides; it does not automatically discover Mografy's bundled FFmpeg. If a dependency is absent, report it and use the environment's normal installation process.

Resolve `../scripts/compress-video.py` relative to this reference's local Skill directory, not the animation project's directory. From the owning repository root, these commands invoke the shared Skill copy (quote paths containing spaces):

```sh
# Balanced quality, same dimensions and frame timing; keeps audio when present.
python3 .agents/skills/mografy/scripts/compress-video.py "projects/my-animation/renders/film.mp4"

# Better detail retention; optionally trade encoding time for compression.
python3 .agents/skills/mografy/scripts/compress-video.py "projects/my-animation/renders/film.mp4" --crf 20 --preset slow -o "projects/my-animation/renders/film-share.mp4"

# Fit a landscape video within 1280 x 720 without upscaling or cropping.
python3 .agents/skills/mografy/scripts/compress-video.py "projects/my-animation/renders/film.mp4" --max-width 1280 --max-height 720

# Target a 10 MB upload limit (decimal MB), using two-pass encoding.
python3 .agents/skills/mografy/scripts/compress-video.py "projects/my-animation/renders/film.mp4" --target-mb 10
```

The maintained source is [scripts/compress-video.py](https://github.com/zz41354899/mografy/blob/main/scripts/compress-video.py); `pnpm sync:skills` copies it into the shared Skill's `scripts/` directory. Edit the repository source, then sync, rather than editing the generated copy. For an animation outside this repository, use the absolute path to the loaded Skill's helper and the actual input video.

## Choose settings and verify

- Default: H.265, CRF 23 on the H.264 scale, medium preset, AAC 128 kbps, original frame timing and dimensions (rounded down to even pixels). It preserves the first video and first audio stream; additional streams, selectable subtitles, and attachments are omitted. Burned-in captions remain visible.
- CRF 18–20 keeps more detail; 26–28 trades detail for smaller files. CRF is lossy and does not guarantee a file size or reduction. `--crf` and `--target-mb` are mutually exclusive.
- Use `--target-mb` for a stated upload limit. The budget reserves space for audio and container overhead, then checks actual bytes. An impossible budget or oversize result fails without publishing an output; report that failure rather than promising the limit was met.
- Change resolution only when appropriate to the request. For portrait 720p, use `--max-width 720 --max-height 1280`. Both caps preserve aspect ratio without cropping or upscaling. Small text and fine artwork may need a higher resolution or lower CRF.
- Audio stays unless `--no-audio` is explicitly appropriate; `--audio-kbps 96` can reduce its budget. Do not silently remove narration or music to hit a limit.

The helper never overwrites any existing file or the original export. It defaults to `<stem>-compressed.mp4` beside the input; pass a new `-o` path for another attempt. It encodes in a temporary folder, verifies duration/audio and decodes the result before publishing. Failed or cancelled operations clean up temporary output. If the candidate is larger than or equal to the source, it is discarded and stdout JSON reports `status: "skipped"`, `output: null`, and a reason; no compressed file exists in that case.

Read the stdout JSON and report the actual output path, original/result bytes, and percentage saved. For a skipped result, explain that the original is already smaller with these settings. Inspect the compressed video for text legibility, banding, motion artifacts, and audio sync before delivery; automated decoding does not prove visual quality. Keep the original as the master. Do not automatically replace a website asset or upload a file unless that is part of the user's request.

Option semantics: [FFmpeg documentation](https://ffmpeg.org/ffmpeg.html), [libx265](https://ffmpeg.org/ffmpeg-codecs.html#libx265) and [libx264 encoder options](https://ffmpeg.org/ffmpeg-codecs.html#libx264_002c-libx264rgb).
