# 3D layers with Three.js

[three.ts](https://github.com/zz41354899/mografy/blob/main/extras/three/three.ts) renders a [Three.js](https://threejs.org/) scene as a layer inside a normal Mografy frame: draw 2D backgrounds first, then the 3D layer, then type and overlays. [three-demo.ts](https://github.com/zz41354899/mografy/blob/main/extras/three/three-demo.ts) is an eight-second tour: a device with a drawn screen orbits into a hero pose among floating shapes.

## When to use it

Use a 3D layer when the brief needs real depth: objects that turn and catch light, product or device models (glTF / GLB), orbiting cameras, depth between layers, reflective or glassy materials. For flat cards, type, UI, flips and parallax, stay in 2D Canvas with the built-in components and `cinema.ts`; they are lighter, sharper for text, and export faster.

## Add to a project

The helper and library are an optional extra, not part of the installed template. If the project already has `scenes/three.ts` and `assets/three.module.js`, read and reuse those local copies. Otherwise copy from the current Mografy checkout (`extras/three/`) or download from GitHub:

```sh
mografy add three projects/<name>
```

`mografy add` copies from this checkout's `extras/` folder, or from GitHub when it is missing, keeps any project file that differs from the extra (`--force` replaces it), and prints the import line. It copies `scenes/three.ts`, `assets/three.module.js` and its licence. Without the `mografy` command, download the same files from `https://raw.githubusercontent.com/zz41354899/mografy/main/extras/three/`.

`three.module.js` is a single minified Three.js r186 bundle (about 0.8 MB, MIT) that also exports `GLTFLoader`, `RoomEnvironment` and `RoundedBoxGeometry`. It lives in `assets/` because scene modules may import only project sources and `@mografy/runtime`; `prepareStage` loads it at runtime from the project. Import the helper locally (`import { prepareStage, stage, orbit } from './three.js'`). Copy `three-demo.ts` too only when the user wants the tour.

## Contract

The scene contract still holds; Three.js only adds where state lives.

- **Build in `setup`, pose in `renderFrame`.** Create every mesh, geometry, material, light, texture and loaded model inside `prepareStage`'s `build` callback and store the stage in `ctx.assets`. In `renderFrame`, only set properties (positions, rotations, scales, colours, opacity, camera) from `time` and params. Creating Three.js objects in `renderFrame` throws, because their ids use `Math.random`.
- **Set everything you animate, every frame.** The scene graph persists between frames, so a property that is only set in some time ranges keeps a stale value after seeking. Write each animated value from `time` on every call, as with any Mografy pose.
- **No animation mixers, clocks or physics.** Do not use `AnimationMixer.update(delta)`, `Clock` or simulation steps. For a glTF animation clip, set `mixer.setTime(time)` from absolute time.
- **Randomness** comes from `ctx.random()` in setup or `ctx.noise()` per frame, never `Math.random`.

## API

| Helper | Use |
| --- | --- |
| `prepareStage(ctx, build, { fov?, width?, height?, antialias?, toneMapping?, exposure?, library? })` | In `setup`: load Three.js, create the WebGL layer, and call `build({ THREE, scene, camera, renderer, setup })`. Whatever `build` returns becomes `stage.objects`. The camera starts at (0, 0, 10) looking at the origin. Tone mapping defaults to ACES filmic. |
| `stage(ctx, stage, pose, { x?, y?, width?, height?, alpha? })` | In `renderFrame`: `pose({ THREE, scene, camera, objects })` sets this frame, then the layer renders at output resolution and is drawn into the frame (default: covering the canvas). |
| `orbit(camera, yaw, pitch, distance, target?)` | Place the camera on a sphere around a target, in radians. Ease yaw, pitch and distance for camera moves. |
| `studioLight(build, intensity?)` | Soft studio reflections (RoomEnvironment) so metal, glass and clearcoat read well without an HDR file. Add one key and one rim `DirectionalLight` for shape. |
| `loadModel(build, path)` | Load an uncompressed glTF / GLB from `assets/`; returns `{ scene, animations }`. Add `scene` to the stage; for a clip, create an `AnimationMixer` in setup and call `mixer.setTime(time)` in the pose. Draco or Meshopt compressed files are not supported. |
| `canvasTexture(THREE, width, height, draw)` | Draw a 2D canvas once in setup and use it as a texture: screens, labels, posters. It uses the project's registered fonts. |

```ts
export async function setup(ctx: SetupContext) {
  ctx.assets.stage = await prepareStage(ctx, b => {
    const { THREE, scene } = b;
    studioLight(b);
    const cube = new THREE.Mesh(new THREE.RoundedBoxGeometry(2, 2, 2, 6, 0.2), new THREE.MeshPhysicalMaterial({ color: 0x7c5cff, roughness: 0.3, clearcoat: 1 }));
    scene.add(cube);
    return { cube };
  });
}

export function renderFrame(ctx: FrameContext, time: number) {
  const s = ctx.assets.stage as Stage<{ cube: ThreeModule }>;
  stage(ctx, s, ({ camera, objects }) => {
    orbit(camera, 0.3 * Math.sin(time * 0.5), 0.15, 8);
    objects.cube.rotation.y = ease.inOutCubic(pr(time, 0, 2)) * Math.PI;
  });
}
```

## Direction

- Keep one hero object and a motivated camera: a slow orbit, a push-in, or a reveal swing that settles. Key the 3D camera on the film's shot table with `keys` (or read the 2D film camera's `cameraPath` so both move as one), and do not let objects drift during reading holds.
- Put headlines and subtitles in 2D after the 3D layer, not on 3D surfaces; Canvas text is sharper and easier to edit. Use `canvasTexture` for text that belongs to an object, such as a phone screen.
- Leave layout room for type: frame the object with the camera target and distance rather than by moving the object off-centre.
- In portrait (1080 × 1920) the layer follows `ctx.width` / `ctx.height`; pull the camera back or narrow the composition so objects fit the width.

## Rendering and review

- 3D renders with WebGL 2 in the player and in exports, so MP4, WebM, Lottie and SVGA all include it. Exports render each sample on the GPU when Chromium has one; on machines without a GPU, Chromium falls back to software rendering, which is correct but slower.
- Review the camera's extreme poses and the first frames of a reveal, check that objects never clip the frame edge or the type, and seek out of order to confirm every animated property is set from time.

## Cost

- A stage costs a WebGL render plus a copy into the 2D frame on every frame it is drawn. Use one stage per film and reuse it across shots; skip `stage()` entirely while the 3D layer is fully hidden.
- Size the layer to the area it covers (`width`, `height`, `x`, `y`) instead of the full frame when the object is small.
- Keep geometry and materials built in `setup`; per frame, only set transforms and uniforms. Large particle fields belong in one `Points` geometry whose positions a shader or one buffer update moves, not in thousands of meshes.
- Bloom and glow around 3D objects go through the runtime's `bloom` on the 2D side, or a single post pass; see [performance.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/performance.md). Run `mografy check` after adding the stage and compare the frame cost with and without it.
