# Mografy extras

Optional helpers that are **not installed** with Mografy. Common motion and drawing helpers (springs, easing, eased time windows, tempo grids, rounded surfaces, word reveals, gradients) are part of `@mografy/runtime`; extras build on them. Installation contains only the sixteen built-in components; these files stay on GitHub and are copied into an animation project when its brief needs them. The shared `mografy` Skill tells the agent when and how to fetch each one.

| Extra | Files | Copy into a project | Reference |
| --- | --- | --- | --- |
| Camera, transitions and atmosphere | `cinema/cinema.ts`, `cinema/cinema-demo.ts` | `scenes/` | [camera-transitions.md](../.agents/skills/mografy/references/camera-transitions.md) |
| Chinese / Japanese typography | `cjk/cjk.ts`, `cjk/cjk-demo.ts` | `scenes/` | [cjk-typography.md](../.agents/skills/mografy/references/cjk-typography.md) |
| CJK fonts (OFL) | `cjk/fonts/*.otf`, `cjk/fonts/OFL.txt` | `assets/`, then register in `mografy.json` | [cjk-typography.md](../.agents/skills/mografy/references/cjk-typography.md) |
| 3D layers (Three.js) | `three/three.ts`, `three/three-demo.ts` | `scenes/` | [three-d.md](../.agents/skills/mografy/references/three-d.md) |
| Three.js r186 bundle (MIT) | `three/three.module.js`, `three/LICENSE-three.txt` | `assets/` | [three-d.md](../.agents/skills/mografy/references/three-d.md) |
| Contextual music generator (Python, numpy) | `music/score.py`, `music/music-example.json` | `music-src/` (the generated audio goes in `assets/`) | [music.md](../.agents/skills/mografy/references/music.md) |
| Product walkthroughs (redrawn app screens, detail shots) | `walkthrough/walkthrough.ts`, `walkthrough/walkthrough-demo.ts` | `scenes/` | [product-walkthrough.md](../.agents/skills/mografy/references/product-walkthrough.md) |

Add one to a project with the CLI; it copies from this checkout (or GitHub), registers CJK fonts in `mografy.json`, and keeps files you changed unless you pass `--force`:

```sh
mografy add             # list the extras
mografy add cinema projects/my-film
```

Without the `mografy` command, download a file directly, for example:

```sh
curl -fsSL -o scenes/cinema.ts https://raw.githubusercontent.com/zz41354899/mografy/main/extras/cinema/cinema.ts
```

The scene modules import only `@mografy/runtime` and their local siblings, so they work as soon as they are in a project's `scenes/` folder. `cjk/subset-cjk-fonts.py` rebuilds the font subsets from Noto CJK sources. `three/three.module.js` is Three.js 0.186.1 plus `GLTFLoader`, `RoomEnvironment` and `RoundedBoxGeometry`, bundled and minified with esbuild; it is loaded from `assets/` at runtime because scene modules may import only project sources and `@mografy/runtime`. `music/score.py` is not a scene module: it runs on your machine (`python3 music-src/score.py music-src/music.json assets/music.mp3`) and writes an audio file that `mografy.json` points to.
