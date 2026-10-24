// Skill guidance. The Markdown lives in packages/core/skill/ and is bundled into skill-text.ts at build time;
// this module assembles it into the generated Skill files and keeps the legacy texts used to recognise old copies.
import { SKILL_TEXT } from './skill-text.js';

const GUIDE_BODY = SKILL_TEXT['references/scene-authoring.md'];
const STORYBOARD = SKILL_TEXT['references/storyboard.md'];
const ANIMATION_PRINCIPLES = SKILL_TEXT['references/animation-principles.md'];
const CODEX_MOTION_DESIGN = SKILL_TEXT['references/codex-motion-design.md'];
const BUILTIN_COMPONENTS_REFERENCE = SKILL_TEXT['references/built-in-components.md'];
const INTRO_REFERENCE = SKILL_TEXT['references/intro.md'];
const CAMERA_TRANSITIONS_REFERENCE = SKILL_TEXT['references/camera-transitions.md'];
const CJK_TYPOGRAPHY_REFERENCE = SKILL_TEXT['references/cjk-typography.md'];
const THREE_D_REFERENCE = SKILL_TEXT['references/three-d.md'];
const MUSIC_REFERENCE = SKILL_TEXT['references/music.md'];
const WALKTHROUGH_REFERENCE = SKILL_TEXT['references/product-walkthrough.md'];
const PRESENTATIONS_REFERENCE = SKILL_TEXT['references/presentations.md'];
const VIDEO_COMPRESSION_REFERENCE = SKILL_TEXT['references/video-compression.md'];
export const SKILL = SKILL_TEXT['SKILL.md'];
export const GUIDE = SKILL_TEXT['project-guide.md'];


const LEGACY_SKILL = `---
name: mografy
description: Create, edit, validate, visually review, and export Mografy Canvas scene projects. Use when a folder contains mografy.json or the user asks to build or change a Mografy animation.
---

${GUIDE_BODY}`;

/** Exact matches only: custom instructions, including edited generated files, survive upgrades. */
export function isLegacyAgentFile(contents: string, kind: 'guide' | 'skill', repository?: string) {
  const cancellation = ' Press Ctrl+C to cancel a CLI export. When `mografy dev` is running, player exports also print progress in that terminal and can be stopped with `mografy export [project] --cancel`.';
  const previous = kind === 'guide' ? GUIDE_BODY : LEGACY_SKILL;
  return contents === previous || contents === previous.replace(cancellation, '') ||
    contents === (kind === 'guide' ? LEGACY_PROJECT_GUIDE : LEGACY_REPOSITORY_SKILL) ||
    (kind === 'guide' && contents === LEGACY_USER_SCOPE_GUIDE) ||
    (kind === 'guide' && repository !== undefined && contents === legacySharedProjectGuide(repository)) ||
    (kind === 'guide' && (isPreviousProjectPointer(contents) || contents === projectGuide().replaceAll('mp4|webm|lottie|svga', 'mp4|lottie|svga')));
}

/** Generated references are colocated with each host's skill for portable relative links. */
export const SKILL_REFERENCES = {
  'scene-authoring.md': GUIDE_BODY,
  'storyboard.md': STORYBOARD,
  'animation-principles.md': ANIMATION_PRINCIPLES,
  'codex-motion-design.md': CODEX_MOTION_DESIGN,
} as const;


const LEGACY_REPOSITORY_SKILL = `---
name: mografy
description: Develop Mografy itself or create, edit, validate, visually review, and export Mografy Canvas scenes in this repository.
---

Read [packages/core/src/guide.ts](../../../packages/core/src/guide.ts) completely before editing a Mografy scene. Its \`GUIDE_BODY\` is the single source for the scene file format, runtime constraints, direct-file editing workflow, Chromium checks, visual review criteria, and CLI export flow.

For product code changes, also follow the repository's root \`AGENTS.md\`, \`docs/architecture.md\`, and required test commands.
`;

const LEGACY_PROJECT_GUIDE = `# Mografy project instructions

This folder is a Mografy project. Animation lives only in scene modules, normally \`scenes/main.ts\`; \`mografy.json\` contains settings. Render with synchronous \`renderFrame(ctx, time, params)\` and keep seeking deterministic. Scene code runs only in the browser; do not introduce GSAP, SVG scene layers, or resvg.

Read the project Skill in \`.agents/skills/mografy/SKILL.md\` (Codex) or \`.claude/skills/mografy/SKILL.md\` (Claude). Both contain the same English workflow and local references. If skill discovery is unavailable, read these references directly:

- [Scene authoring](.agents/skills/mografy/references/scene-authoring.md): required before scene edits; includes \`ctx.withCanvas\`, drawing APIs, runtime constraints, and CLI review.
- [Storyboards](.agents/skills/mografy/references/storyboard.md): project-specific shot planning, Codex image generation, and Claude Artifacts or a local HTML fallback.
- [Animation principles](.agents/skills/mografy/references/animation-principles.md): the twelve principles applied through deterministic Canvas motion.

Open the player with \`mografy dev\`. After scene edits, run \`mografy check\` and \`mografy review\`, then inspect every generated review PNG. Export with \`mografy export --format mp4|lottie|svga\` when requested. Keep storyboards in \`storyboards/\` and out of project animation settings.
`;

const LEGACY_STORYBOARD_SKILL = `---
name: mografy-storyboard
description: Write project-specific Mografy storyboards and shot lists with visual key poses and animation direction. Use when the user requests a Mografy storyboard, shot breakdown, or visual plan before scene implementation.
---

# Mografy storyboard

Read the project's \`mografy.json\`, scene entry, imported modules, and assets. Use its actual dimensions, palette, fonts, brand artwork, and characters.

- Read [references/storyboard.md](references/storyboard.md) for the English shot list and visual deliverables. In Codex, invoke image generation; in Claude, use Artifacts when available, otherwise write the standalone HTML preview.
- Read [references/animation-principles.md](references/animation-principles.md) to select expressive motion for each shot, with clear anticipation, action, settle, and reading holds.
- Read [references/scene-authoring.md](references/scene-authoring.md) when implementation is requested, and [references/project.md](references/project.md) when working on Mografy itself.

Save the written plan and visual output links under \`storyboards/\`. Keep all plans, shot labels, and prompts in English. Preserve supplied copy and artwork unless the user requests changes. A storyboard-only request delivers the board; implement scene modules when the request also includes animation. Review actual rendered frames separately from conceptual panels.
`;

/** Both hosts read one Mografy Skill from the outer .agents folder. */
function skillFilesWithRepositoryLinks(repository: string, introduction = `This skill was generated for the Mografy repository at \`${repository}\`. Use the current checkout's instructions when another checkout is explicitly selected. For an animation project elsewhere, read that project's settings and assets; do not assume it is inside this repository.`): { mografy: Record<string, string> } {
  const project = `# Mografy project reference

${introduction}

Before product changes, read [AGENTS.md](${repository}/AGENTS.md), [architecture](${repository}/docs/architecture.md), [status](${repository}/docs/STATUS.md), and [usage](${repository}/README.md).

- \`packages/core/skill/\` holds the English Skill entrypoint and references as Markdown; \`packages/core/src/guide.ts\` assembles them. After changes, run \`pnpm build\` in the repository; it ends with \`pnpm sync:skills\`, which regenerates the Skill. \`mografy dev\` also regenerates it when its sources changed since the last sync.
- Use \`mografy update --check\` to check the executing source installation, or \`mografy update\` to fast-forward, install/build, sync guidance and restart its active player. Stop and resolve local changes or diverged history rather than overwriting them. Older installations need a one-time manual update documented in README.
- One \`mografy\` Skill lives in the source repository's outer \`.agents/skills/\` folder, with scene, storyboard, animation-principle, and project references. Codex reads it there; the root \`.claude/skills/mografy\` symlink points Claude to the same folder. Root \`CLAUDE.md\` also imports the shared Skill. Never create Skill folders inside animation subprojects.
- Animation code belongs only in scene modules. The Server must never import or evaluate scenes in Node. Do not introduce GSAP, SVG scene layers, or resvg.
- Application writes to projects use \`queueProjectWrite\` in \`packages/server/src/project.ts\` and \`atomicWrite\`. The player and exports share \`@mografy/runtime\`, including \`post.ts\`.
- Run \`pnpm check\` and \`pnpm test:browser\` after repository changes. For scene work, use \`mografy check [project]\`, \`mografy review [project]\`, and inspect the PNGs.

Adapt storyboards to the actual scene and assets. Write plans and prompts in English. Codex invokes image generation; Claude invokes Artifacts when exposed, with a standalone local HTML/Canvas fallback in Claude Code. Read the corresponding local references for details.
`;
  const references = Object.fromEntries(Object.entries({ ...SKILL_REFERENCES,
    'built-in-components.md': BUILTIN_COMPONENTS_REFERENCE.replaceAll('__REPOSITORY__', repository),
    'intro.md': INTRO_REFERENCE.replaceAll('__REPOSITORY__', repository),
    'camera-transitions.md': CAMERA_TRANSITIONS_REFERENCE.replaceAll('__REPOSITORY__', repository),
    'cjk-typography.md': CJK_TYPOGRAPHY_REFERENCE.replaceAll('__REPOSITORY__', repository),
    'three-d.md': THREE_D_REFERENCE.replaceAll('__REPOSITORY__', repository),
    'music.md': MUSIC_REFERENCE.replaceAll('__REPOSITORY__', repository),
    'product-walkthrough.md': WALKTHROUGH_REFERENCE.replaceAll('__REPOSITORY__', repository),
    'presentations.md': PRESENTATIONS_REFERENCE,
    'video-compression.md': VIDEO_COMPRESSION_REFERENCE.replaceAll('__REPOSITORY__', repository),
    'project.md': project,
  })
    .map(([name, contents]) => [`references/${name}`, contents]));
  return {
    mografy: { 'SKILL.md': SKILL, ...references },
  };
}

const GITHUB_SOURCE = 'https://github.com/zz41354899/mografy/blob/main';

/** Published guidance is identical in every checkout and never embeds a developer's disk paths. */
export function sharedSkillFiles(_repository?: string) {
  const files = skillFilesWithRepositoryLinks(GITHUB_SOURCE,
    'Canonical sources are on [GitHub](https://github.com/zz41354899/mografy). Resolve local files from the current checkout, never from a path in another installation. For an animation project elsewhere, read that project\'s settings and assets; do not assume it is inside this repository.',
  );
  for (const [file, contents] of Object.entries(files.mografy)) {
    const base = `${GITHUB_SOURCE}/.agents/skills/mografy/${file}`;
    files.mografy[file] = contents.replace(/\]\(([^)]+)\)/g, (_, link: string) => `](${new URL(link, base).href})`);
  }
  return files;
}

const LEGACY_USER_SCOPE_GUIDE = `# Mografy project instructions

This folder is a Mografy project. Animation belongs only in scene modules; \`mografy.json\` contains settings. Use synchronous \`renderFrame(ctx, time, params)\` with deterministic seeking. Scenes run only in the browser; do not introduce GSAP, SVG scene layers, resvg, clocks, or previous-frame state. Use \`ctx.draw\` for common drawing and \`ctx.withCanvas\` for native Canvas scopes.

Read the external \`mografy\` Skill at \`~/.agents/skills/mografy/SKILL.md\` in Codex or \`~/.claude/skills/mografy/SKILL.md\` in Claude Code. Its local references contain the scene contract and animation principles. For shot planning, use the external \`mografy-storyboard\` Skill in the same host directory. Codex uses image generation; Claude uses Artifacts when available, otherwise a standalone HTML/Canvas preview. Write plans and prompts in English and save project-specific boards under \`storyboards/\`.

Never create Skill folders inside this project. If the external Skills are missing, run \`pnpm build\` and \`pnpm sync:skills\` from the Mografy source repository to install them.

Open the player with \`mografy dev\`. After scene edits, run \`mografy check\` and \`mografy review\`, then inspect the generated PNGs. Export with \`mografy export --format mp4|lottie|svga\` when requested.
`;

const LEGACY_SHARED_PROJECT_GUIDE = `# Mografy project instructions

This folder is a Mografy animation project. Animation belongs only in scene modules; \`mografy.json\` contains settings. Use synchronous \`renderFrame(ctx, time, params)\` with deterministic seeking. Scenes run only in the browser; do not introduce GSAP, SVG scene layers, resvg, clocks, or previous-frame state. Use \`ctx.draw\` for common drawing and \`ctx.withCanvas\` for native Canvas scopes.

Codex and Claude read the same Skills from the Mografy source repository's outer \`.agents/skills/\` folder. Read \`mografy/SKILL.md\` and its local references before scene work. For shot planning, also read \`mografy-storyboard/SKILL.md\`. The shared Skill root is linked below; do not create Skill copies inside animation projects or install duplicate host-specific folders.

Codex uses image generation; Claude uses Artifacts when available, otherwise a standalone HTML/Canvas preview. Write plans and prompts in English and save project-specific boards under \`storyboards/\`.

Open the player with \`mografy dev\`. After scene edits, run \`mografy check\` and \`mografy review\`, then inspect the generated PNGs. Export with \`mografy export --format mp4|lottie|svga\` when requested.
`;

function legacySharedProjectGuide(repository: string) {
  return LEGACY_SHARED_PROJECT_GUIDE + `
Shared Skills: [Mografy](${repository}/.agents/skills/mografy/SKILL.md) and [Storyboards](${repository}/.agents/skills/mografy-storyboard/SKILL.md). If missing, run \`pnpm build\` and \`pnpm sync:skills\` from \`${repository}\`.
`;
}



function previousProjectGuide(repository: string) {
  return GUIDE + `
Shared Skill: [Mografy](${repository}/.agents/skills/mografy/SKILL.md). If missing, run \`pnpm build\` and \`pnpm sync:skills\` from \`${repository}\`.
`;
}

function isPreviousProjectPointer(contents: string) {
  const match = contents.match(/\nShared Skill: \[Mografy\]\((.+)\/\.agents\/skills\/mografy\/SKILL\.md\)\. If missing, run/);
  if (!match) return false;
  const previous = previousProjectGuide(match[1]!);
  return contents === previous || contents === previous.replaceAll('mp4|webm|lottie|svga', 'mp4|lottie|svga');
}

export function projectGuide(_repository?: string) {
  return GUIDE + `
Shared Skill: [Mografy](${GITHUB_SOURCE}/.agents/skills/mografy/SKILL.md). For local work, use the current installation's outer \`.agents/skills/mografy/\` folder. If missing, run \`pnpm build\` and \`pnpm sync:skills\` from your Mografy checkout.
`;
}

/** Exact previous generated files, used only to remove the former separate storyboard Skill. */
export function obsoleteStoryboardFiles(repository: string): Record<string, string> {
  const files: Record<string, string> = { ...skillFilesWithRepositoryLinks(repository).mografy, 'SKILL.md': LEGACY_STORYBOARD_SKILL };
  delete files['references/built-in-components.md'];
  delete files['references/intro.md'];
  delete files['references/camera-transitions.md'];
  delete files['references/cjk-typography.md'];
  delete files['references/three-d.md'];
  delete files['references/music.md'];
  delete files['references/product-walkthrough.md'];
  delete files['references/presentations.md'];
  delete files['references/codex-motion-design.md'];
  files['references/project.md'] = files['references/project.md']!.replace(
    "One `mografy` Skill lives in the source repository's outer `.agents/skills/` folder, with scene, storyboard, animation-principle, and project references. Codex reads it there; the root `.claude/skills/mografy` symlink points Claude to the same folder. Root `CLAUDE.md` also imports the shared Skill. Never create Skill folders inside animation subprojects.",
    "Skills live in the source repository's outer `.agents/skills/` folder. Codex and Claude share `mografy` and `mografy-storyboard` there, with local references. Never create Skill folders inside animation subprojects. Root `AGENTS.md` routes Codex; root `CLAUDE.md` imports the same shared Skill for Claude.",
  );
  return files;
}
