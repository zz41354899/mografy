# Mografy project instructions

This folder is a Mografy animation project. Animation belongs only in scene modules; `mografy.json` contains settings. Use synchronous `renderFrame(ctx, time, params)` with deterministic seeking. Scenes run only in the browser; do not introduce GSAP, SVG scene layers, resvg, clocks, or previous-frame state. Use `ctx.draw` for common drawing and `ctx.withCanvas` for native Canvas scopes.

Read the shared `mografy` Skill before scene work: its `SKILL.md`, then the references its table names for the task. Codex, Claude Code and other agents install it once with `npx skills add mografy/mografy -g`; with the Mografy MCP tools connected, `read_guide` serves the same files. Do not create Skill copies inside animation projects.

`scenes/timeline.json` and `colors` in `mografy.json` hold the user's own changes from the editor: read them before changing the film, and never write them by hand. The project's `style.md` records its design and motion decisions; read it before every change.

Codex storyboards use image generation; Claude uses Artifacts when available, otherwise a standalone HTML/Canvas preview. Write plans and prompts in English and save project-specific boards under `storyboards/`.

Open the player with `mografy dev`. After scene edits, run `mografy check --motion` and `mografy review`, then inspect the generated PNGs. Export with `mografy export --format mp4|webm|mov|lottie|svga` when requested.

Shared Skill: [Mografy](https://github.com/mografy/mografy/blob/main/.agents/skills/mografy/SKILL.md). Inside a Mografy checkout, use its outer `.agents/skills/mografy/` folder. Elsewhere, install it once with `npx skills add mografy/mografy -g` (and keep it current with `npx skills update`).
