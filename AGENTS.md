# Mografy development instructions

- Design and workflow: `docs/architecture.md`; progress: `docs/STATUS.md`; usage: `README.md`.
- Animation content belongs only in scene modules. Never add layers, keyframes, or animation data to `mografy.json`; do not introduce GSAP, SVG scene layers, or resvg.
- `packages/core/skill/` (Markdown) is the single source for scene authoring instructions, storyboard planning, and the twelve principles of animation; `packages/core/src/guide.ts` assembles it into Project AGENTS.md, shared Claude/Codex Skills, and their references. The core build generates `packages/core/src/skill-text.ts` from those files (never edit it by hand). After changing them, run `pnpm build` and `pnpm sync:skills`.
- Keep one shared Skill named `mografy` in this repository's outer `.agents/skills/mografy/` folder. Read [.agents/skills/mografy/SKILL.md](.agents/skills/mografy/SKILL.md) for product, scene, and storyboard work. Its `references/` contains project guidance, scene authoring, the sixteen built-in components, the intro example, storyboards, and animation principles. Claude's root `.claude/skills/mografy` entry links to this same folder. Never create Skill folders inside animation subprojects.
- Keep Skill entrypoints short. Put detailed guidance in local `references/` files for both hosts. Codex storyboards use image generation; Claude storyboards use Artifacts when available, otherwise a standalone local HTML preview. Keep plans and prompts in English.
- Scene code executes only in the browser. The Server must never import or evaluate a scene in Node.
- All application writes to projects go through the queue in `packages/server/src/project.ts` and use `atomicWrite`.
- The player and exports share `@mografy/runtime`, including post-processing in `post.ts`. Changes to output effects must apply to both.
- After changes, run `pnpm check` (including real Chromium and FFmpeg tests) and `pnpm test:browser`.
