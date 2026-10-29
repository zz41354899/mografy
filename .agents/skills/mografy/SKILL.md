---
name: mografy
description: Make, edit, review and export Mografy Canvas animations (projects with mografy.json), plan their storyboards and scores, and compress exported videos with the bundled Python helper; also develop the Mografy repository. Use when a folder has mografy.json, or the user asks for a motion graphic, product demo from screenshots, teaser, logo reveal, explainer, social video, slides or Present mode, or says 做動畫、動態影片、宣傳片、產品示範、分鏡、動態簡報、配樂、匯出 MP4、壓縮影片.
---

# Mografy

Mografy films are TypeScript scene modules drawn on a Canvas as a pure function of time, previewed with `mografy dev` and exported with `mografy export`. This file holds the hard rules, the vocabulary, which reference to read for which job, and the steps. Details live in `references/`; read a reference when its step comes up, not before.

Precedence: the project's `style.md` overrides the defaults in [references/taste.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/taste.md) and the design guidance; nothing overrides **Never**, the **Contract** or the **Quality floor**. If the checkout has a local skill whose folder ends in `-ref` under `.agents/skills/`, read its `SKILL.md` after this one: it holds the owner's own additions and wins over the defaults here, under the same limits.

## Never

- Put animation, layout or shot descriptions in `mografy.json`. It holds settings, audio and review times; animation lives in scene modules, because the server never evaluates scene code.
- Read a clock, keep state between frames, or use unseeded randomness, GSAP, SVG scene layers or resvg. The player seeks in any order, and `mografy check` renders each time twice to catch state.
- Set `ctx.filter` around many draws or create a canvas in `renderFrame`. Each costs a full pass per draw or per frame; use `blurLayer`, `blurText`, `bloom`, `layer` and `buffer`.
- Operate the user's website or account, or show real customer data or a working private link. Work from screenshots the user provides and invented demo data.
- Copy another brand's copy, marks or music, or edit the films in `examples/` (they are the reference other agents read). Copy one with `mografy add <name>` and change the copy.
- Export, or overwrite a file in `renders/`, unless the user asks for a file.

## Terms

- **film**: the whole animation. **scene**: the module that draws it (`scenes/main.ts` and its imports).
- **shot**: one idea or composition, one row of the shot table. **beat table**: `beats([...])`, the single source of shot times, `meta.shots` and review times.
- **handoff**: the object that ends one shot and starts the next. **hold**: time when nothing moves so the viewer can read. **stop frame**: a shot's settled frame, used for slides and review.
- **card**: one UI panel or piece of content drawn in the film's world. **extra**: an optional helper module added with `mografy add <extra>`. **template**: a ready-made beat added the same way. **reference film**: a finished film in `examples/`.

## Choose the path

| Situation | Read | Start from |
| --- | --- | --- |
| Small fix: copy, one timing, an asset, an export | [scene-authoring.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/scene-authoring.md) only | The existing scene; no new concept or storyboard |
| New film, or redesigning a film's motion | [film-architecture.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/film-architecture.md), [motion-design.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/motion-design.md), [taste.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/taste.md), [examples.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/examples.md) | `mografy add film-starter <folder>`, or the closest reference film |
| Film from an app's screens: demo, tutorial, what's new, mobile preview, 重繪、介面簡化、只拍操作細節 | [product-walkthrough.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/product-walkthrough.md) | `mografy add walkthrough <project>` |
| Short product or social video from standard beats: hook, subtitles, device screen, numbers, end card | [templates.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/templates.md) | `mografy add <template...> <project>` |
| Camera moves on stills or key art, wipes, atmosphere | [camera-transitions.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/camera-transitions.md) | `mografy add cinema <project>` |
| Chinese or Japanese copy, vertical text | [cjk-typography.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/cjk-typography.md) | `mografy add cjk <project>` |
| Real 3D: a product that turns, depth, orbiting camera | [three-d.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/three-d.md) | `mografy add three <project>` |
| Music wanted and no track supplied | [music.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/music.md) | `mografy add music <project>` |
| Slides, 簡報, Present mode, marking shots | [presentations.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/presentations.md) | The scene's beat table |
| Aspect ratio, 9:16, export sizes and formats | [output.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/output.md) | `mografy.json` `aspectRatio` |
| Exported file too large to share | [video-compression.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/video-compression.md) | `scripts/compress-video.py` |
| Slow preview, or `mografy check` warns about frame cost | [performance.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/performance.md) | The slowest time `mografy check` prints |
| Logo sting or short intro; borrowing a built-in motif | [intro.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/intro.md), [built-in-components.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/built-in-components.md) | The component's source file |
| Changing Mografy itself | [project.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/project.md) | The current checkout |

When the request fits more than one row, read every matching reference. When it fits none, follow the steps below with the first two rows' references.

## Steps for a new film

Each step names its output. Skip steps the request does not need, and say which ones you skipped.

1. **Read the project.** `mografy.json`, the scene entry and its imports, `style.md`, `assets/`. If a project with an existing scene has no `style.md`, write one first from what the scene already does (its colour and type tokens, layout, motion character, timing), so your changes keep its look; tell the user you added it. Pick the closest reference film from [examples.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/examples.md) and read the files its table names.
2. **Brief.** Message, audience, length, aspect ratio, language of the on-screen copy (follow the brief; write plans in English), music. Infer what the request implies and state the assumptions. Output: the top of `storyboards/storyboard.md`.
3. **Storyboard.** Read [storyboard.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/storyboard.md) and [animation-principles.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/animation-principles.md). First write the film's idea in one sentence: one visual thing that travels through every shot and causes each change (a thread of light that fills each cup in turn, a line that becomes every card's edge). A row of separate cards with crossfades is not an idea; a film without one looks like a template. Then fix the design system (type roles, palette, the layout repeated shots share) as tokens, following [taste.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/taste.md), and record it with the film's idea in `style.md`. Output: `style.md`, the shot table in `storyboards/storyboard.md` and a visual board (image generation in Codex, an Artifact or `storyboards/storyboard.html` in Claude). **Stop** here when the user asked only for a storyboard; when they asked for the film, continue without an approval step.
4. **Build.** One world, one camera, one beat table ([film-architecture.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/film-architecture.md)). Take motion from `@mografy/runtime` and parts from the extras and templates above. Output: `scenes/`, `mografy.json` with `review.times` and `review.transitions` from the beat table.
5. **Music** (only when wanted). Output: `music-src/music.json`, `assets/music.mp3`, `audio` in `mografy.json`.
6. **Check and review.** Run `mografy check [project]` and fix every warning; run `mografy review [project]` and look at every PNG, including each transition strip. Walk **Before delivery**. Output: the review PNGs and a short note of what you checked.
7. **Export** only when asked: `mografy export [project] --format mp4|webm|lottie|svga` (settings in [output.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/output.md)). Output: a file in `renders/`.

To iterate on a weak range, render it frame by frame, name the problem with a time, fix it and review the same range again. To change the length, take time from holds, never from actions.

## Quality floor

Every film, from a 5 s bumper to a 2 min story, meets these; each can be checked against a frame or a `mografy check` line.

1. **One world, one camera.** One `cameraPath` for the whole film; cards get local transforms inside it, never a second camera; no shot resets to an empty centre.
2. **Every cut hands something over.** The line, card, dot or word a shot ends on is what the next starts from. A wipe or dissolve is a deliberate break, not a cover for a jump.
3. **No empty frames.** The outgoing element finishes its exit under the incoming one (overlap 0.2–0.5 s).
4. **One motion vocabulary.** Long moves and the camera use `keys` / `cameraPath`; entrances use `springs.*` or `spring`; holds do not drift.
5. **Blur a layer, never a group of draws:** `blurLayer`, `blurText` / `blurWords`, `bloom`.
6. **Pooled buffers in film coordinates:** `layer`, `buffer`, `blurLayer`, `bloom`; never sized from the player's canvas.
7. **Groups fade as one** through one `layer`, so overlaps do not flash.
8. **One beat table.** `meta.shots`, review times and handoffs all come from `beats([...])`.

## Before delivery

- [ ] `mografy check` passes with no warnings (frame cost under 100 ms, at most 8 filters per frame, no per-frame canvases).
- [ ] No text overlaps other text or UI, and copy stays inside the safe margins in [taste.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/taste.md).
- [ ] Every caption and result meets the hold times in [taste.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/taste.md).
- [ ] Every transition strip shows the handoff object in every frame, with no jump and no empty frame.
- [ ] Fonts cover every character of the final copy (re-subset after the last copy change).
- [ ] `review.times` match the current beat table.
- [ ] The project has a `style.md` that matches what the film now does.

## Contract

Animation content belongs only in scene modules. Build motion and effects from `@mografy/runtime` (`at`, `win`, `spring`, `springs`, `settle`, `keys`, `cameraPath`, `withCamera`, `beats`, `layer`, `blurLayer`, `bloom`, `blurText`, `riseWords`, `blurWords`, `surface`, `tempoGrid`) instead of re-implementing curves, cameras, layers and text reveals per project; the helpers also run on a plain canvas, so a storyboard page can draw the real film. Render synchronously from absolute `time`, resolved params and prepared assets; scene code runs only in the browser. For a requested 9:16 video, author a native portrait scene (1080 × 1920), respect any saved `aspectRatio`, and plan vertical layout and social safe margins. The main preview follows the scene; orientation icons and Fit belong only to export. A generated storyboard is a concept reference; validate the actual scene separately.
