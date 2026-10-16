# Mografy extras

Optional helpers that are **not installed** with Mografy. Installation contains only the sixteen built-in components; these files stay on GitHub and are copied into an animation project when its brief needs them. The shared `mografy` Skill tells the agent when and how to fetch each one.

| Extra | Files | Copy into a project | Reference |
| --- | --- | --- | --- |
| Camera, transitions and atmosphere | `cinema/cinema.ts`, `cinema/cinema-demo.ts` | `scenes/` | [camera-transitions.md](../.agents/skills/mografy/references/camera-transitions.md) |
| Chinese / Japanese typography | `cjk/cjk.ts`, `cjk/cjk-demo.ts` | `scenes/` | [cjk-typography.md](../.agents/skills/mografy/references/cjk-typography.md) |
| CJK fonts (OFL) | `cjk/fonts/*.otf`, `cjk/fonts/OFL.txt` | `assets/`, then register in `mografy.json` | [cjk-typography.md](../.agents/skills/mografy/references/cjk-typography.md) |

From another folder, download a file directly, for example:

```sh
curl -fsSL -o scenes/cinema.ts https://raw.githubusercontent.com/zz41354899/mografy/main/extras/cinema/cinema.ts
```

The scene modules import only `@mografy/runtime` and their local siblings, so they work as soon as they are in a project's `scenes/` folder. `cjk/subset-cjk-fonts.py` rebuilds the font subsets from Noto CJK sources.
