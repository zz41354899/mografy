# Mografy project reference

This skill was generated for the Mografy repository at `/Users/zz41354899/Desktop/mografy`. Use the current checkout's instructions when another checkout is explicitly selected. For an animation project elsewhere, read that project's settings and assets; do not assume it is inside this repository.

Before product changes, read [AGENTS.md](/Users/zz41354899/Desktop/mografy/AGENTS.md), [architecture](/Users/zz41354899/Desktop/mografy/docs/architecture.md), [status](/Users/zz41354899/Desktop/mografy/docs/STATUS.md), and [usage](/Users/zz41354899/Desktop/mografy/README.md).

- `packages/core/src/guide.ts` owns the English skill entrypoints and references. After changes, run `pnpm build` and `pnpm sync:skills` in the repository.
- One `mografy` Skill lives in the source repository's outer `.agents/skills/` folder, with scene, storyboard, animation-principle, and project references. Codex reads it there; the root `.claude/skills/mografy` symlink points Claude to the same folder. Root `CLAUDE.md` also imports the shared Skill. Never create Skill folders inside animation subprojects.
- Animation code belongs only in scene modules. The Server must never import or evaluate scenes in Node. Do not introduce GSAP, SVG scene layers, or resvg.
- Application writes to projects use `queueProjectWrite` in `packages/server/src/project.ts` and `atomicWrite`. The player and exports share `@mografy/runtime`, including `post.ts`.
- Run `pnpm check` and `pnpm test:browser` after repository changes. For scene work, use `mografy check [project]`, `mografy review [project]`, and inspect the PNGs.

Adapt storyboards to the actual scene and assets. Write plans and prompts in English. Codex invokes image generation; Claude invokes Artifacts when exposed, with a standalone local HTML/Canvas fallback in Claude Code. Read the corresponding local references for details.
