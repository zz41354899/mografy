# Performance: cheap frames and smooth motion

"It stutters" (卡, 卡卡的, 不順) means one of two different problems. Find out which before changing anything:

| Problem | What you see | How to find it | Fix with |
| --- | --- | --- | --- |
| **Slow frames** | The preview drops frames; the same film exported to MP4 plays smoothly | `mografy check`: frame cost, filters per frame, canvases per frame | The cost tables below |
| **Choppy motion** | The exported MP4 also looks rough: something jumps, starts at full speed or stops dead | `mografy check --motion`: jumps, hard starts and hard stops with their times | **Smooth motion** below, [film-architecture.md](film-architecture.md) and [taste.md](taste.md) |

Most stutter reports on finished films turn out to be choppy motion, not slow frames. Run both checks before delivery.

## Checklist

Slow frames:

- [ ] `mografy check` shows no frame-cost warning: median well under 33 ms at 1920 × 1080 on a desktop, nothing over 100 ms, at most 8 filters per frame, no canvases created per frame.
- [ ] No `ctx.filter` around a group of draws; groups go through `blurLayer`, type through `blurText` / `blurWords`, light through `bloom`.
- [ ] Every `layer`, `blurLayer` and `bloom` smaller than about half the frame has `bounds`.
- [ ] Everything that does not change is made once in `setup`: paths, text layout, UI card textures (cached per visual state), sprites, backgrounds, noise tiles.
- [ ] No `getImageData` per frame; grain is a small tile drawn as a pattern, not a pixel loop.
- [ ] One Three.js stage at most, skipped while hidden.

Choppy motion:

- [ ] `mografy check --motion` reports no jump, hard start or hard stop you did not intend.
- [ ] Each followed object is one track across a handoff: where one shot's version ends, the next one's starts, at the same position, size and colour.
- [ ] Moves through several poses are one `keys` curve, not separately eased segments.
- [ ] Entrances use `springs.*` / `spring()` over their whole duration; no entrance moves on its first frame more than on its second.
- [ ] Fades end at 0, never at a small alpha that then disappears; base colours switch before a wipe finishes covering them.
- [ ] The camera does not reverse direction every second or two, and holds still during clicks and reading.
- [ ] A move across more than half the frame takes at least 0.6 s, an exit at least 0.4 s ([taste.md](taste.md)).

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
| Re-drawing a static UI card (rows, icons, text) every frame | Dozens of fills and glyph runs per card per frame | Draw each card state once into a cached texture and `drawImage` it; a flat card is one draw. |
| Per-pixel grain or noise each frame | A full-frame loop | A small noise tile as a pattern, offset by `Math.round(time * 30)`, at low alpha. |
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

## Smooth motion

`mografy check --motion` draws the whole film at 30 frames per second at quarter size and compares each frame with the next. It reports:

| Report | What it usually is | Fix |
| --- | --- | --- |
| **Jump**: one frame changes far more than the frames around it | Two tracks that do not meet at a handoff (a dot that ends at one place while the ring starts at another); a colour or element that switches in one frame; a hard cut | Make the followed object one track; animate the switch; keep a cut only when it is a deliberate break (a new act, a drop in the music) |
| **Hard start**: motion leaves a still frame at full speed | An entrance with no ease-in; an element that appears already moving; a spring whose first frame jumps | `springs.out` / `spring()`; start the move from rest; let a camera move begin up to 0.5 s before the action |
| **Hard stop**: motion halts at full speed | Separately eased segments chained together; a fade that stops at 0.1 and then vanishes; a spring cut off before it settles; content removed while it is still moving | One `keys` curve through the poses; fade to 0; let springs finish; overlap exits with the next entrance |

Each line lists times: render those frames (`review.times`, or `review.transitions` around them) and look before changing anything. The detector cannot tell a deliberate cut from a mistake, so a cut it reports can stay. It measures change on screen, so a slow move of a large bright shape and a fast move of a small one can read the same; trust the frames, not the number.

Other causes of choppy motion it cannot see: a spring that settles in a third of its duration (the object shoots off, then sits; use the runtime springs), a camera that reverses its zoom every 1.5 s, a ring or caret that hops from letter to letter instead of gliding on a continuous position.

## Canvas gotchas

- `ctx.filter` blur lengths are in destination (device) pixels: scale them by the transform you draw with, not by the buffer's own scale.
- An opaque full-size `fillRect` on a pooled `OffscreenCanvas` can be dropped by Chromium; cap such a fill's alpha at 0.996.
- When a wipe or flood changes the base colour, switch the colour slightly before the wipe reaches 1, or one frame flashes the old colour.

## Measuring

1. Run `mografy check [project]`. It prints `Frame cost at W×H (CPU canvas, N frames): median … ms, slowest … ms at …s` and the warnings. Add `--motion` to scan the motion as well; it draws every frame at quarter size (about 15 s for a 60 s film on a cloud CPU).
2. For the slowest times, find the cause by switching parts off: comment out a layer, a blur or a particle system and check again. The cost is almost always one of the rows above.
3. When the preview is slow but `mografy check` is fine, check the player: `MOGRAFY_HMR=0 mografy dev` serves the production build of the player instead of the development one.

Frame cost in the cloud or in CI is several times higher than on a desktop GPU; compare numbers from the same machine, and look at the ratio between frames rather than the absolute value.
