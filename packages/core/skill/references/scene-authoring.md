# Mografy scene authoring guide

This folder is a Mografy project. Animation content lives only in scene modules (normally `scenes/main.ts`). `mografy.json` stores project settings; never put layers, keyframes, or animation data in it.

Run `mografy dev` to open the player. After a file change passes compilation and a real Chromium trial render, the player switches to the new version and stays at the same time.

## File format

A scene module exports `meta`, `params`, optional `setup`, and synchronous `renderFrame`:

```ts
import { pr, lerp, ease, clamp, colorLerp } from '@mografy/runtime';
import type { FrameContext, SetupContext } from '@mografy/runtime';

export const meta = { width: 1920, height: 1080, duration: 8, fps: 30, background: '#0f1115' };

export const params = {
  subtitle: { name: 'Subtitle', type: 'string' as const, role: 'subtitle' as const, default: 'Hello' },
  accent: { name: 'Accent', type: 'color' as const, default: '#12b5a5' },
  energy: { name: 'Energy', type: 'number' as const, default: 1, min: 0, max: 2, step: 0.01 },
  layout: { name: 'Layout', type: 'enum' as const, default: 'center', options: ['center', 'left'] },
};

export async function setup(ctx: SetupContext) { /* load images or prepare seeded data once */ }

export function renderFrame(ctx: FrameContext, time: number, p: any) {
  const mografy = ctx.draw;
  mografy.fill(p.accent);
  mografy.circle(ctx.width / 2, ctx.height / 2, lerp(20, 160, ease.outExpo(pr(time, 0.2, 1.2))));
}
```

## Landscape and portrait compositions

Read `mografy.json.aspectRatio` before planning or editing. It is `"16:9"` (landscape) or `"9:16"` (portrait); when absent, use the scene's `meta.width / meta.height`. This is canvas configuration only. The main player has no orientation switch: it previews the authored scene at its configured dimensions. Output orientation is chosen only in the Export dialog and never changes the project or the main preview.

When the user requests a future 9:16 video, explicitly record **9:16 portrait** in the brief before authoring. Treat this as the intended composition, not merely an export setting. Create the scene natively in portrait, tell the user that the preview follows the authored scene, and do not rely on fitting or cropping a landscape scene to satisfy a portrait brief. For a native social video, author `meta = { width: 1080, height: 1920, ... }` and set `aspectRatio: "9:16"` in the project. A landscape scene normally uses 1920 × 1080. The shared Runtime applies the saved aspect ratio to the logical canvas before setup and rendering, preserving the scene's short edge; both `SetupContext` and `FrameContext` receive the effective dimensions. Use `ctx.width` and `ctx.height`, never imported meta dimensions, for layout, backgrounds, clipping, and camera bounds. Branch with `const portrait = ctx.height > ctx.width` when the compositions differ. Stack portrait elements vertically, wrap copy to available width, and reposition the focal subject and subtitles. Do not rotate, stretch, or merely shrink a complete landscape shot into the portrait canvas. Fixed-coordinate scenes need a scene-code layout pass; an orientation toggle cannot infer their intended design.

For portrait social layouts, use conservative guides: leave about 8% above, 18% below, 6% on the left, and 12% on the right clear of critical copy and logos. Platform overlays vary; treat these as planning margins, not platform guarantees. Inspect at phone size, including long subtitles, entrances, exits, and transitions. If both outputs are requested, review both complete compositions and random seeks.

MP4 and WebM exports have landscape 1280 × 720 / 1920 × 1080 and portrait 720 × 1280 / 1080 × 1920 presets, selected with orientation icons. If output orientation differs from the authored scene, show Fit: `contain` (Fit entire scene, the default) or `cover` (Fill and crop). These fit the existing artwork without reauthoring the canvas. The dialog shows an actual paused-frame preview of the output. Choose `reflow` (Adapt layout) for deliberately responsive scenes, including all sixteen built-in components: it passes the output canvas dimensions to scene code so portrait sizes, card arrangements, and text wrapping adapt. It is not a player orientation control. Export overrides do not change the saved canvas. CLI: `mografy export [project] --format mp4 --orientation portrait --resolution 1080p` (or `landscape`); without overrides it uses the saved canvas and render scale. WebM uses VP9 video and optional Opus audio, with constant quality (CRF 32) by default; MP4 uses H.264/AAC. Use `--format webm` for WebM. Higher WebM CRF values produce smaller files with less detail. MP4 and VP9 CRF values are codec-specific. Both video formats support the same orientation, resolution, sampling, and output effects. Player, stills, thumbnails, review, and exports share the effective canvas and output effects.

## Required behavior

1. Treat `renderFrame` as a pure function of `time`, resolved params, and assets prepared by `setup`. Do not read a previous frame, accumulate module state, or read a clock. The player may seek in any order, and validation renders the same time twice to detect state leaks.
2. `Math.random`, `Date.now`, and `performance.now` throw inside `renderFrame`. Prepare random choices once with `ctx.random()` in `setup`, and use `ctx.noise(...coordinates)` only for values that must vary per frame (see Randomness below).
3. The runtime resets and fills the canvas before every call. `renderFrame` must finish synchronously.
4. Import only files inside the project and `@mografy/runtime`.
5. Put fonts in `assets/`, list them in `mografy.json` under `fonts`, then select them with `mografy.textFont('Family', 400)`. Only loaded weights are reliable.
6. Express effect distances such as `shadowBlur`, shadow offsets, and filter pixels in logical units. The runtime scales them for output resolution. Use `ctx.vignette(strength)` for a canvas vignette.
7. Expose only important subtitles as `type: 'string', role: 'subtitle'` params. Titles, chat text, buttons, hints, code examples, and brand copy should stay in the scene for the AI to edit. Do not turn every string into an inspector field. Every color or numeric param must control a visible result. Do not add a dot grid unless the user explicitly asks for one.

## Randomness

Decide random things once, in `setup`, and store them in `ctx.assets`: particle positions, sizes, colours, delays, star fields, the order of a scatter. `ctx.random()` is seeded by the project seed, so the same seed always gives the same film, and changing `seed` in mografy.json gives a new but equally stable variation. In `renderFrame`, read those values and move them with `time`:

```ts
import { spring } from '@mografy/runtime';

export function setup(ctx: SetupContext) {
  ctx.assets.dots = Array.from({ length: 120 }, () => ({
    x: ctx.random() * ctx.width, y: ctx.random() * ctx.height,
    size: 4 + ctx.random() * 10, delay: ctx.random() * .6,
  }));
}
export function renderFrame(ctx: FrameContext, time: number) {
  for (const d of ctx.assets.dots as { x: number; y: number; size: number; delay: number }[]) {
    const k = spring(time, .4 + d.delay);
    ctx.draw.circle(d.x, d.y - 40 * (1 - k), d.size * k);
  }
}
```

Use `ctx.noise(...coordinates)` when a value must change over time or space and cannot be listed in advance: flicker, jitter, grain-like texture, shimmer. Pass whole-number or stepped coordinates (`ctx.noise(i, Math.floor(time * 12))` for a 12 fps flicker) and smooth between steps yourself when the motion should glide. Noise is order-independent, so seeking stays exact. Never keep a random generator in module scope and call it during frames.

## Tempo and music

When a film is cut to music, declare its grid once in the scene and build every timing constant from it:

```ts
import { tempoGrid } from '@mografy/runtime';
const tempo = { bpm: 120, beatsPerBar: 4 };
export const grid = tempoGrid(tempo);          // grid.beat = 0.5 s, grid.bar = 2 s
export const meta = { width: 1920, height: 1080, duration: grid.onBar(12), fps: 30, background: '#101114', tempo };
const LOGO_IN = grid.onBar(10, 2);             // bar 10, beat 3
```

`grid.onBar(n, k)` is the start of bar `n` plus `k` beats, `grid.onBeat(n)` a beat, and `grid.snap(t)` the nearest beat to a hand-picked moment. `ctx.beat(time)` returns `{ beat, bar, beatInBar, phase, period }` from the project audio, or from `meta.tempo` when the project has no audio yet, so pulses written against it work before the music exists. Keep `audio.bpm`, `audio.offset` and `audio.beatsPerBar` in mografy.json equal to `meta.tempo`; `mografy check` reports any difference. When the tempo changes, change `meta.tempo` only and every cut moves with it.

## FrameContext

| Member | Purpose |
| --- | --- |
| `ctx.draw` | Common drawing API. Prefer `const mografy = ctx.draw`; methods may be destructured. |
| `ctx.canvas` | Native 2D context in logical coordinates. |
| `ctx.width`, `ctx.height` | Logical canvas dimensions. |
| `ctx.noise(...n)` | Seeded 0–1 noise independent of call order. |
| `ctx.beat(time)` | `{ beat, bar, beatInBar, phase, period }` from the project audio, or `meta.tempo` without audio; otherwise `undefined`. |
| `ctx.shadow(color, blur, x?, y?)`, `ctx.blur(px)`, `ctx.vignette(strength)` | Visual effects. |
| `ctx.withCanvas(canvas => { ... })` | Synchronous scope that restores native state and Mografy fill/stroke state, including after an error. |
| `ctx.clip(path2d, () => { ... }, rule?)` | Synchronous Path2D clipping scope; default rule is `nonzero`. |
| `ctx.assets` | Read-only assets prepared by `setup`. |
| `ctx.seed`, `ctx.renderScale` | Project seed and output scale. |

`SetupContext` provides `ctx.random()`, `ctx.loadImage('assets/x.png')`, `ctx.assets`, `ctx.seed`, `ctx.width`, and `ctx.height`.

## Time and motion helpers

All are pure functions of absolute time, imported from `@mografy/runtime`. Use them instead of writing curves and springs in each project.

| Helper | Use |
| --- | --- |
| `pr(time, start, end)` | Map a time range to 0–1 (clamped). |
| `lerp(a, b, p)`, `clamp(n, min?, max?)`, `colorLerp(a, b, p, 'srgb' or 'linear')`, `hashNoise(seed, ...n)` | Interpolation and seeded hashing. |
| `ease.linear / inQuad / outCubic / inOutCubic / outExpo / outQuart / outQuint / inOutQuart / inOutSine` | Easing curves for p in 0–1. `outQuart` for entrances and moves, `outQuint` for word rises, `inOutCubic` for exits, `inOutSine` for loops and drifts. |
| `at(time, start, end, curve?)` | Eased progress of a time window (default `ease.outCubic`). |
| `win(time, a, b, c, d, enter?, exit?)` | In over [a, b], out over [c, d]: 0 → 1 → 0. |
| `spring(time, start, duration?, bounce?)` | A spring from 0 to 1 that settles exactly on 1 by `start + duration × 1.6` (defaults 0.7 s, bounce 0.18; bounce 0 has no overshoot). |
| `springEase(stiffness?, damping?)`, `springs.out / pop / camera / cursor` | Spring easing curves for p in 0–1, normalised to land on 1; pass them as `curve` to `at`. `pop` overshoots about 1.5 %. |
| `settle(time, start, duration, amplitude, cycles?)` | Follow-through: a decaying wobble around 0 after a landing or impact. |
| `pulse(time, at, width?)` | A bump that peaks at 1 at `at`: presses, flashes, highlights. |
| `stagger(i, count, step, curve?)` | Delay for item `i`; with a curve, the group's delays are eased. |
| `tempoGrid({ bpm, beatsPerBar?, offset? })` | Bar and beat times for timing constants (see Tempo and music). |

## Layer helpers

Common drawing patterns that would otherwise be copied into every film. Each runs in its own canvas scope.

| Helper | Use |
| --- | --- |
| `roundRect(x, y, w, h, radius or [tl, tr, br, bl])` | Rounded-rectangle `Path2D`; a single radius is clamped to half the shorter side. |
| `surface(ctx, path, fill, { elevation?, tint? })` | Fill a path with a soft two-layer shadow: 0 flat, 1 resting card, 2 lifted. |
| `text(ctx, value, x, y, style)`, `measure(ctx, value, style)` | One line with its own `size`, `color`, `family`, `weight`, `align`, `baseline`, `tracking` (letter spacing), `alpha` and `maxWidth`. |
| `riseWords(ctx, line, x, y, style, time, start, { stagger?, duration?, curve?, exit?, colors?, separator? })` | Words rise into a mask one after another (0.07 s apart, 0.8 s each, `ease.outQuint`). Returns each word's `[left, right]` for underlines or cursors. `exit` 0–1 lifts the line out. |
| `blurWords(ctx, line, x, y, style, time, start, { …, blur?, lift? })` | Words come into focus: blur, a small rise and opacity resolve together. |

Pass `separator: ''` to animate CJK copy character by character. For a family, use one registered under `fonts` in mografy.json.

## Drawing API

`ctx.draw` is a thin layer over the native Canvas context. Both APIs share styles, transforms, clipping, and resolution scaling. It is not a p5.js compatibility layer and does not create a draw loop.

| Function | Behavior |
| --- | --- |
| `fill(color)`, `noFill()` | Set and enable or disable fill. A color may be a CSS color, CanvasGradient, or CanvasPattern. |
| `stroke(color)`, `noStroke()` | Set and enable or disable stroke. |
| `strokeWeight(px)`, `strokeCap(value)`, `strokeJoin(value)` | Logical line width and native cap/join values. |
| `opacity(0..1)` | Set current alpha, clamped to 0–1. It does not multiply the previous value. |
| `push()`, `pop()` | Save and restore native state plus Mografy fill/stroke state. Keep pairs balanced. |
| `translate(x,y)`, `rotate(radians)`, `scale(x,y?)` | Transform the coordinate system; omitted `y` means uniform scale. |
| `rect(x,y,w,h,radius?)` | Top-left coordinates, with an optional uniform corner radius. |
| `circle(x,y,diameter)`, `ellipse(x,y,w,h)` | Center coordinates; circles use diameter. |
| `arc(x,y,w,h,start,end)` | Center, size, and radians. An open arc closes implicitly only when filled. |
| `line(x1,y1,x2,y2)` | Uses the active stroke. |
| `triangle(...)`, `path(path2d,rule?)` | Fill and/or stroke. Path fill rule defaults to `nonzero`. |
| `textFont(family,weight?)`, `textSize(px)` | Select loaded type and logical font size. |
| `textAlign(align,baseline?)` | Native horizontal alignment and baseline. |
| `text(value,x,y,maxWidth?)`, `textWidth(value)` | Draw or measure text. `maxWidth` condenses a line; it does not wrap. |
| `image(source,x,y,w?,h?)` | Draw at top-left; provide both width and height or neither. |
| `linearGradient(x1,y1,x2,y2,stops)`, `radialGradient(x,y,radius,stops,inner?)`, `conicGradient(x,y,angle,stops)` | Return a gradient to pass to `fill` or `stroke`. `stops` is `[[0, '#fff'], [1, '#000']]` or evenly spaced colours `['#fff', '#000']`. |
| `background(color)` | Clear and repaint the logical canvas while preserving state. It still respects the current clip. |

At the start of every frame, fill is enabled and stroke is disabled. Call `fill` and `stroke` explicitly. Use the gradient helpers above for fills, and `ctx.canvas` for multiline layout, batched paths, and complex clipping. Do not cross-pair `mografy.push()` with `canvas.restore()`.

```ts
const mografy = ctx.draw;
mografy.push();
mografy.opacity(ease.outCubic(pr(time, 0.2, 0.8)));
mografy.fill(p.accent);
mografy.rect(100, 100, 320, 180, 16);
mografy.fill('#ffffff');
mografy.textFont('ABeeZee', 400);
mografy.textSize(44);
mografy.textAlign('center', 'middle');
mografy.text(p.subtitle, 260, 190);
mografy.pop();
```

## Built-in scene components

New projects include `scenes/components.ts`, `scenes/social-components.ts`, and `scenes/showcase.ts`. Component functions are pure time functions that can be copied or edited; they do not add global runtime animation state.

| Component | Additional options |
| --- | --- |
| `staggerText` | text,x,y,size?,color?,font?,start?,duration?,stagger?,lift? |
| `typewriter` | text,x,y,size?,color?,font?,start?,duration?,caret? |
| `popCard` | x,y,width,height,color?,radius?,start?,duration?,content?(ctx) |
| `progressBar` | x,y,width,height?,target?,color?,track?,start?,duration? |
| `pulseDots` | x,y,color?,diameter?,spacing?,period?,start? |
| `logoReveal` | x,y,color?,ink?,width?,start?,duration? |
| `socialCard` | x,y,color?,start?,name?,avatar?,caption? |
| `youtubeSubscribe` | x,y,color?,start?,label?,subscribed? |
| `aiChat` | x,y,color?,start?,prompt?,reply?,avatar? |
| `likeBurst` | x,y,color?,start? |
| `followBadge` | x,y,color?,start?,name?,avatar?,label?,following? |
| `notificationToast` | x,y,color?,start?,message? |
| `lowerThird` | x,y,color?,start?,name?,subtitle? |
| `countUp` | x,y,color?,start?,value? |
| `toggleSwitch` | x,y,color?,start? |
| `audioWave` | x,y,color?,start?,bars? (3–40) |

## Edit and visual-review workflow

For a new animation, create the project first with `mografy init projects/<name>` (an internal command for agents; it starts as a blank stage with the component modules), then replace `scenes/main.ts` and open it with `mografy dev projects/<name>` so the running player switches to it. `mografy dev` only opens existing projects and fails on a folder without `mografy.json`. Do not tell the user to run `init` themselves.

1. Read `mografy.json`, the configured scene entry, and every local module it imports. Preserve the scene's existing visual language unless the user asks for a redesign.
2. Edit scene source files directly. Keep animation data out of `mografy.json`; use it only for project, parameter, font, audio, render, review, and presentation (`slides`) settings.
3. Run `mografy check [project]`. This compiles the scene and trial-renders it in real Chromium. Fix every reported error before judging the design.
4. Run `mografy review [project]`. Inspect every generated PNG in `renders/`, including raw stills, output frames, and transition strips. Do not approve a scene from source code or a successful build alone.
5. Judge the images for clipping, overlap, safe margins, legibility, hierarchy, spacing, contrast, consistent easing, transition continuity, and whether each important message stays visible long enough. Review the beginning, end, configured key times, and dense transition intervals. Check both raw stills and final output frames when glow, grain, or motion sampling is used.
6. Iterate on the scene and repeat check plus review until the visual problems are resolved. Use `mografy dev [project]` when the user should watch the live result.
7. Export with `mografy export [project] --format mp4|webm|lottie|svga`. The command prints capture and encoding or packaging progress and writes the finished file under `renders/`. Press Ctrl+C to cancel a CLI export. When `mografy dev` is running, player exports also print progress in that terminal and can be stopped with `mografy export [project] --cancel`.

## Presentations

The same project can be presented live, one slide per shot, from the editor's Present mode. Slides come only from the scene: export `meta.shots` (`[{ end, stop?, title? }, …]`) in the scene's `meta`; presentation titles, notes and holds live in `mografy.json` `slides`. To mark shots, follow [presentations.md](presentations.md): read the scene files and `mografy.json`, find each shot, pick a settled stop frame, write `meta.shots`, then `mografy check` and inspect `review-<version>-slides.png` from `mografy review`. Video export ignores shots and `slides`.

Only important subtitles belong in `role: 'subtitle'` params. Let the user edit those in Scene → Subtitles; make other copy changes in source when requested.

## Motion direction

- Show a meaningful element within the first 0.3 seconds.
- Keep important text visible for at least roughly `character count / 4 + 1` seconds.
- Prefer `ease.outExpo` or `ease.outCubic` for entrances and `ease.inOutCubic` for exits.
- Use a consistent curve for related elements and fixed 0.05–0.08 second intervals for a text stagger.
- Preserve whitespace and keep one dominant moving focus at a time.
- With music, declare `meta.tempo` and time major changes from `tempoGrid(tempo).onBar(n)`, so cuts stay on bar starts when the tempo changes; use `ctx.beat(time)` for pulses inside a bar.

## Project style

A project can fix its own design and motion decisions in `style.md` at the project root, so every shot and every later session follows them. The file is optional and lives in the project, never in `mografy.json` or a Skill. Write it in English: do and don't rules, the motion character, palette, type, tempo and timing choices, composition habits, and reference stills (paths under `storyboards/` or `assets/`). Keep each rule short enough to check against a frame.

Values themselves stay in scene code. Define each fixed value (a colour, font family, easing curve, duration, tempo) once, in the scene module or in a shared module the scenes already import, and change it there rather than inline in one shot. Font files are registered under `fonts` in `mografy.json`.

When `style.md` exists, read it before planning a storyboard or editing a scene. Precedence: the user's current request, then `style.md`, then this Skill's default motion and design guidance. The scene contract above (deterministic `renderFrame`, browser-only code, check and review) always applies. If a request conflicts with the style, follow the request for that change and ask whether the style should change too.

Create or update `style.md` only from decisions the user states or approves as lasting ("always", "from now on", "use this for every shot"), not from your own taste or a one-off fix; when the decision is a value, also change it in the scene code. During review, check the frames against the `style.md` rules as well as the general criteria. To reuse a style in another project, copy `style.md` and adapt the values in that project's scene code.
