# Mografy

Local Canvas motion design for Claude Code and Codex. Scenes are TypeScript modules drawn as a pure function of time;
`npx mografy dev` previews them live and `npx mografy export` writes MP4, WebM, MOV, Lottie or SVGA.

```sh
npx mografy@latest init   # creates ./mografy: a project with Mografy and its agent Skill inside
cd mografy
npx mografy dev           # open the editor (or: npm run dev)
```

Then open Claude Code or Codex in the `mografy` folder and describe the animation. Everything lives in that folder:
nothing is installed globally, and deleting the folder removes it. `npx mografy@latest init my-film` names the folder.
To update, run `npx mografy@latest` inside it.

You don't install FFmpeg or Chromium: Chrome or Edge renders checks and exports, and FFmpeg downloads into the
project the first time you export a video (a Chromium shell too, only without Chrome or Edge), or ahead of time with
`npx mografy setup`. Templates, helpers and reference films download from GitHub
when `npx mografy add` needs them.

Optional, for every folder: `npm install -g mografy` and `npx skills add mografy/mografy -g`.

Documentation and the source: https://github.com/mografy/mografy
