# Performance: keep every frame cheap

A Mografy scene draws every frame from scratch, so its cost is paid on every frame of the preview and on every sample of an export. The player stays smooth when frames take well under 33 ms at 1920 × 1080; `mografy check` measures the scene and warns above 100 ms, when one frame sets more than eight filters on the frame context, and when re-drawn frames create canvases. Fix those warnings before delivery.

## What costs what on a 2D canvas

| Operation | Cost | Use instead |
| --- | --- | --- |
| `ctx.canvas.filter = 'blur(…)'` around several draws | One blur pass per fill, stroke and glyph run, each over a large area. Dozens per frame takes seconds. | `blurLayer(c, name, radius, draw)`: draw once into a layer, blur the layer once. |
| A filter blur per word or glyph | One pass per word | `blurText` / `blurWords`: the glyph's own shadow, about the cost of sharp text. |
| `shadowBlur` on many shapes | One mask blur each; cheap for a few, costly for hundreds | `surface()` for cards; one shadow on a merged path; or a blurred layer of the silhouettes. |
| Large-radius blur at full resolution | Grows with radius and area | Blur at half or quarter resolution (`blurLayer` does this automatically above 12 and 48 device pixels; `bloom` works at quarter resolution). |
| A full-frame layer for a small object | A full 1920 × 1080 (or 4K) composite | Pass `bounds: [x, y, w, h]` to `layer`, `blurLayer` and `bloom`. |
| `new OffscreenCanvas` / `document.createElement('canvas')` in `renderFrame` | Allocation and garbage collection every frame (33 MB per 4K canvas) | `buffer(name, w, h)` and the layer helpers reuse pooled memory. |
| `getImageData` / `putImageData` per frame | A GPU → CPU copy and a full-frame loop | Precompute in `setup`; use compositing modes instead of pixel loops. |
| `new Path2D(svgString)`, parsing, `measureText` of fixed copy each frame | Repeated parsing and layout | Build paths, glyph widths and layouts once in `setup` (or as module constants) and read them per frame. |
| Thousands of separate `fill()` calls | Per-call overhead | Batch shapes of one style into one path; draw particles as a pre-rendered sprite with `drawImage`. |
| A Three.js stage | A WebGL render plus a GPU → CPU copy into the 2D frame on CPU canvases | One stage per film; skip `stage()` while the 3D layer is invisible; keep its size to the area it covers. |
| `imageSmoothingQuality = 'high'` when scaling a soft buffer up | High-quality resampling of the whole frame | `'low'` for blurred or glow buffers (the layer helpers already do this). |

## Opening and switching speed

Frame cost decides playback; `setup` and the project's files decide how long a project takes to open. The player shows a project as soon as its scene module is read (its trial render runs in the background a few seconds later, and its result is kept in `.mografy/verified.json`, so an unchanged scene reopens without one). It keeps the last two projects loaded, so switching back to one is immediate; what remains is each project's first setup:

| Cost on open | Fix |
| --- | --- |
| Every font in `mografy.json` is fetched and parsed. The CJK subsets are about 4–5 MB each. | `python3 extras/cjk/subset-film-fonts.py <project>` keeps only the characters the film draws (about 9.5 MB → 300 KB) and points `mografy.json` at the result. Run it again after every copy change; it always rebuilds from the original fonts. |
| Procedural textures (paper, wood, noise) drawn pixel by pixel in `setup` | Draw each once and keep it: store the canvas as a PNG in Cache Storage under a key that includes a version number, decode it on later opens, and draw it again when the cache is empty (exports and checks start with none, so frames stay identical). Bump the version when the generator changes. |
| `getImageData` on a canvas you just drew, to add noise | It waits for the GPU and copies the canvas back. Fill a `new ImageData(w, h)` yourself and `putImageData` it, or draw the noise with shapes. |
| A 3D stage: shader compilation and texture uploads | See **Cost** in [three-d.md](three-d.md): keep the light count constant, `compileAsync` in setup, share textures. |

## Coordinates and units

The runtime gives scenes a logical context (`ctx.canvas`, `ctx.withCanvas`) whose units are film pixels: it scales transforms, `shadowBlur`, shadow offsets and filter lengths by the output scale for you. Two things it cannot do:

- **Offscreen contexts are native.** Lengths you set on your own offscreen context (`filter`, `shadowBlur`, `lineWidth` after `setTransform`) are device pixels. Multiply by `devScale(c)` of the context you are copying from, or use the layer helpers, which size and scale for you.
- **Filters and shadows ignore the transform.** A blur set inside a camera zoom of 2 is not doubled. `blurLayer`, `blurText` and `bloom` take their radius in the current units and include the camera; when you set a filter yourself, multiply by `devScale(c)`.

Size every offscreen buffer from the film frame (1920 × 1080 logical × output scale), never from `c.canvas.width`: the player may hand a canvas whose size differs from the frame's transform, and a buffer sized from it clips the picture to a square or a corner. `layer`, `blurLayer`, `bloom` and `buffer` all work in film coordinates; `outputScale(c)` and `devScale(c)` give the factors when you need them.

Inside a `layer`, `blurLayer` or `bloom` callback, draw with the context the callback receives. `blurWords`, `riseWords`, `text` and `surface` accept it as their first argument.

## Measuring

1. Run `mografy check [project]`. It prints `Frame cost at W×H (CPU canvas, N frames): median … ms, slowest … ms at …s` and the warnings.
2. For the slowest times, find the cause by switching parts off: comment out a layer, a blur or a particle system and check again. The cost is almost always one of the rows above.
3. When the preview is slow but `mografy check` is fine, check the player: `MOGRAFY_HMR=0 mografy dev` serves the production build of the player instead of the development one.

Frame cost in the cloud or in CI is several times higher than on a desktop GPU; compare numbers from the same machine, and look at the ratio between frames rather than the absolute value.
