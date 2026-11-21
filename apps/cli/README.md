# Mografy

Local Canvas motion design for Claude Code and Codex. Scenes are TypeScript modules drawn as a pure function of time;
`mografy dev` previews them live and `mografy export` writes MP4, WebM, MOV, Lottie or SVGA.

```sh
npm install -g mografy
npx skills add mografy/mografy -g   # the agent Skill, for Claude Code, Codex and others
mografy dev
```

Or try it without installing: `npx mografy dev`.

Projects live in `~/Mografy` (set `MOGRAFY_HOME` to change it). FFmpeg and the headless Chromium shell are not part of
the package: they download the first time a check or export needs them, or ahead of time with `mografy setup`.
Templates, helpers and reference films download from GitHub when `mografy add` needs them.

Documentation, the shared agent Skill and the source: https://github.com/mografy/mografy
