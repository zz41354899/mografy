---
name: mografy
description: Develop Mografy, plan storyboards, create and export Canvas animations, and compress oversized exported videos with the bundled Python helper. Use for Mografy repository work, scene projects with mografy.json, storyboards, and smaller video files for sharing.
---

# Mografy

For scene work, read the project's `mografy.json`, configured scene entry, imported local modules, and relevant assets before making changes. If the project has `style.md`, read it first: it records the project's design and motion decisions and takes precedence over this Skill's default design guidance, though never over the scene contract or the quality floor below. Tailor the work to that project's visual language and brief. Write plans and prompts in English; preserve supplied copy unless translation is requested.

## Quality floor

Every film, from a five-second bumper to a two-minute launch film, meets these. Each can be checked against a frame or a `mografy check` line.

1. **One world, one camera.** A multi-shot film is one world drawn from `time`, seen through one `cameraPath`. Cards and UI get local transforms inside it, never a second camera, and no shot resets to the centre of an empty frame.
2. **Every cut hands something over.** The geometry a shot ends on (a line, a card, a dot, a word) is the geometry the next shot starts from. A wipe or dissolve is a deliberate break, not a way to hide a jump.
3. **No empty frames.** An outgoing element finishes its exit under the incoming one; the frame is never blank between shots.
4. **One motion vocabulary.** Long moves and the camera use `keys` / `cameraPath`; entrances and pops use `springs.*` or `spring`; holds do not drift. Never chain separately eased segments through a pose the viewer should not notice.
5. **Blur a layer, never a group of draws.** `blurLayer` for groups, `blurText` / `blurWords` for type, `bloom` for light. Never set `ctx.filter` around many draws.
6. **Buffers are pooled and sized in film coordinates.** Use `layer`, `buffer`, `blurLayer` and `bloom`; never create a canvas in `renderFrame`, and never size a buffer from the player's canvas.
7. **Groups fade as one.** Parts that fade together (a card and its text, a panel, a whole shot) go into one `layer`, so their overlaps do not flash.
8. **One table for timing.** `beats([...])` is the only source of shot times; `meta.shots`, review times and handoffs come from it.

`mografy check` measures frame cost and warns about slow frames, filter-per-draw blurs and per-frame canvases. Treat its warnings like errors before delivery.

## Read before working

- Before editing a scene, read [references/scene-authoring.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/scene-authoring.md) for the runtime, helpers, drawing API, validation, and review contract.
- For any animation with more than one shot or a camera, read [references/film-architecture.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/film-architecture.md), and start from a copy of the model film (`mografy add film-starter <folder>`) when starting from scratch.
- Before planning a new film, read [references/examples.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/examples.md) and open the reference film closest to the brief (`mografy add` lists them; `mografy add <name>` copies one to build on). Hold your film to the same level.
- Before writing effects (blur, glow, shadows, offscreen layers, particles, 3D) or when `mografy check` reports slow frames, read [references/performance.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/performance.md).
- Before creating an animation or redesigning its motion, read [references/motion-design.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/motion-design.md) for visual concepts, causal choreography, rhythm, continuity, and design review. For a small local fix, apply only the relevant guidance.
- For a storyboard or a new animation that needs shot planning, read [references/storyboard.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/storyboard.md). Codex uses image generation; Claude uses Artifacts when available, with an explicit local HTML fallback in Claude Code.
- For aspect ratio, 9:16 portrait work, and export sizes and formats, read [references/output.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/output.md).
- For new motion or animation polish, read [references/animation-principles.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/animation-principles.md) and apply the relevant principles.
- When creating an animation, choosing storyboard motifs, or reusing examples, read [references/built-in-components.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/built-in-components.md) for the sixteen scene components and [references/intro.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/intro.md) for the existing twelve-second intro. Inspect the relevant original scene code before adapting it.
- For a film-style sequence built from stills or key art (camera moves on plates, transitions such as sakura petal wipes, atmosphere), read [references/camera-transitions.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/camera-transitions.md) and add the optional `cinema.ts` extra with `mografy add cinema <project>`.
- For Chinese or Japanese copy, vertical text (tategaki), or CJK line breaking, read [references/cjk-typography.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/cjk-typography.md) and add the optional `cjk.ts` extra and CJK fonts with `mografy add cjk <project>`.
- For real 3D (objects that turn and catch light, product or device models, orbiting cameras, depth), read [references/three-d.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/three-d.md) and add the optional `three.ts` extra and Three.js bundle with `mografy add three <project>`.
- When the film needs music and the user has no track, or asks for music that fits the film, read [references/music.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/music.md): write the film's context as `music.json` cues and generate a matching score with the optional `score.py` extra (`mografy add music <project>`).
- For a film made from an app's screens (product demo, feature explainer or tutorial, what's-new short, mobile app preview, social cut-down, landing-page loop), or when the user asks to redraw a UI, simplify it, or film only the interactions (重繪、介面簡化、只拍操作細節), read [references/product-walkthrough.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/product-walkthrough.md) and add the optional `walkthrough.ts` extra with `mografy add walkthrough <project>`.
- For a short product demo, social video or landing-page loop that can start from ready-made templates (an opening hook, subtitles, a phone or laptop screen, a callout, before/after, numbers, testimonials, an end card or a transition; 9:16 editorial or 16:9 montage look), read [references/templates.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/templates.md) and add the templates with `mografy add <template...> <project>`.
- When the user asks for slides, a presentation (簡報), Present mode, or to mark shots, read [references/presentations.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/presentations.md): read the scene files and `mografy.json`, mark `meta.shots` with settled stop frames, then check and review the slides sheet.
- When an exported video is too large or the user asks to compress it, read [references/video-compression.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/video-compression.md) and run the bundled `scripts/compress-video.py` on the finished file. Preserve the original, check the reported size, and review the compressed result.
- When developing Mografy itself, read [references/project.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/project.md) for the GitHub sources and required checks. Inspect the current checkout's local files before editing.

## Contract

Animation content belongs only in scene modules, never in `mografy.json`. Build motion and effects from `@mografy/runtime` (`at`, `win`, `spring`, `springs`, `settle`, `keys`, `cameraPath`, `withCamera`, `beats`, `layer`, `blurLayer`, `bloom`, `blurText`, `riseWords`, `blurWords`, `surface`, `tempoGrid`) instead of re-implementing curves, cameras, layers and text reveals in each project. The helpers also work on a plain canvas, so a storyboard page can run the same film code. Render synchronously from absolute `time`, resolved params, and prepared assets; do not use GSAP, SVG scene layers, resvg, clocks, or previous-frame state. Scene code executes only in the browser. For a requested 9:16 video, author a native portrait scene (1080 × 1920), respect any saved `aspectRatio`, and plan vertical layout and social safe margins. The main preview follows the scene; orientation icons and Fit belong only to export. See the output reference.

For scene changes, run `mografy check [project]`, then `mografy review [project]` and inspect the generated PNGs before delivery. A generated storyboard is a concept reference; validate the actual scene separately. Export with `mografy export [project] --format mp4|webm|lottie|svga` when requested.
