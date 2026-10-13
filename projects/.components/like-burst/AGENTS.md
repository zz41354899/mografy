# Mografy project instructions

This folder is a Mografy animation project. Animation belongs only in scene modules; `mografy.json` contains settings. Use synchronous `renderFrame(ctx, time, params)` with deterministic seeking. Scenes run only in the browser; do not introduce GSAP, SVG scene layers, resvg, clocks, or previous-frame state. Use `ctx.draw` for common drawing and `ctx.withCanvas` for native Canvas scopes.

Codex and Claude share the single `mografy` Skill in the Mografy source repository's outer `.agents/skills/mografy/` folder. Read its `SKILL.md` and the local references relevant to the task: scene authoring, storyboards, animation principles, and project development. Do not create Skill copies inside animation projects. The source repository's root `.claude/skills/mografy` entry links Claude to the same Skill.

Codex storyboards use image generation; Claude uses Artifacts when available, otherwise a standalone HTML/Canvas preview. Write plans and prompts in English and save project-specific boards under `storyboards/`.

Open the player with `mografy dev`. After scene edits, run `mografy check` and `mografy review`, then inspect the generated PNGs. Export with `mografy export --format mp4|lottie|svga` when requested.

Shared Skill: [Mografy](/Users/zz41354899/Desktop/mografy/.agents/skills/mografy/SKILL.md). If missing, run `pnpm build` and `pnpm sync:skills` from `/Users/zz41354899/Desktop/mografy`.
