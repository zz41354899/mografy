---
name: mografy
description: Develop Mografy, plan storyboards, create and export Canvas animations, and compress oversized exported videos with the bundled Python helper. Use for Mografy repository work, scene projects with mografy.json, storyboards, and smaller video files for sharing.
---

# Mografy

For scene work, read the project's `mografy.json`, configured scene entry, imported local modules, and relevant assets before making changes. For a requested 9:16 video, create a native portrait scene (1080 × 1920), respect any saved `aspectRatio`, and plan vertical layout and social safe margins. The main preview follows the scene; orientation icons and Fit belong only to export. Read the scene-authoring reference for the full contract. Tailor the work to that project's visual language and brief.

- Before editing a scene, read [references/scene-authoring.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/scene-authoring.md) for the complete runtime, drawing, validation, review, and export contract.
- For a storyboard or a new animation that needs shot planning, read [references/storyboard.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/storyboard.md). Codex uses image generation; Claude uses Artifacts when available, with an explicit local HTML fallback in Claude Code.
- When creating an animation, choosing storyboard motifs, or reusing examples, read [references/built-in-components.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/built-in-components.md) for the sixteen scene components and [references/intro.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/intro.md) for the existing twelve-second intro. Inspect the relevant original scene code before adapting it.
- For new motion or animation polish, read [references/animation-principles.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/animation-principles.md) and apply the relevant principles.
- When an exported video is too large or the user asks to compress it, read [references/video-compression.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/video-compression.md) and run the bundled `scripts/compress-video.py` on the finished file. Preserve the original, check the reported size, and review the compressed result.
- When developing Mografy itself, read [references/project.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/project.md) for the GitHub sources and required checks. Inspect the current checkout's local files before editing.

Animation content belongs only in scene modules, never in `mografy.json`. Render synchronously from absolute `time`, resolved params, and prepared assets; do not use GSAP, SVG scene layers, resvg, clocks, or previous-frame state. Scene code executes only in the browser. Write plans and prompts in English; preserve supplied copy unless translation is requested.

For scene changes, run `mografy check [project]`, then `mografy review [project]` and inspect the generated PNGs before delivery. A generated storyboard is a concept reference; validate the actual scene separately. Export with `mografy export [project] --format mp4|lottie|svga` when requested.
