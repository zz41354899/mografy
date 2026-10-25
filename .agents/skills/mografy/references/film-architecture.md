# Film architecture: one world, one camera, one table

Read this before writing any animation with more than one shot or a moving camera. It is how a film stays continuous: the viewer follows one thing from the first frame to the last, and nothing resets between shots. The model is the `film-starter` example (`examples/film-starter/scenes/main.ts`, about 270 lines; `mografy add film-starter <folder>` copies the whole project, fonts included): read it before writing a new film and copy its structure, or start the new film from a copy. For finished films at full length (a 60 s promo, a 42 s teaser, a 71 s story), see [examples.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/examples.md).

## The shape of a film module

```ts
import { beats, cameraPath, keys, layer, blurLayer, bloom, springs, at, withCamera } from '@mografy/runtime';
import type { Context2D, FrameContext, SetupContext } from '@mografy/runtime';

// 1. Tokens: every colour, font, size and fixed duration once.
const C = { bg: '#0E1116', ink: '#EEF2F5', accent: '#1BC6B4' };

// 2. One table for timing. Everything else reads its times from here.
export const BEATS = beats([
  { title: 'A point', end: 3.2, stop: 2.4, handoff: .8, note: 'A point draws a line.' },
  { title: 'One idea', end: 7.2, stop: 6.4, handoff: .8 },
  // …
]);
const T = Object.fromEntries(BEATS.list.map(b => [b.title, b.start]));
export const meta = { width: 1920, height: 1080, duration: BEATS.duration, fps: 30, background: C.bg, shots: BEATS.shots };

// 3. Shared geometry: the objects that travel between shots, in world coordinates.
const LINE = { x0: 760, x1: 1160, y: 600 };
const CARD = { x: 960, y: 540, w: 720, h: 420, r: 36 };

// 4. One camera, keyed on the table.
const camera = cameraPath([[0, 760, 600, 2.4], [T['One idea'] + 1, 960, 575, 1], /* … */]);

// 5. The world, drawn from time alone, on any context.
export function drawFilm(c: Context2D, t: number, data: FilmData) { withCamera(c, camera(t), w => world(w, t, data)); }

export function setup(ctx: SetupContext) { ctx.assets.film = prepare(); }
export function renderFrame(ctx: FrameContext, time: number) {
  ctx.withCanvas(c => drawFilm(c, time, ctx.assets.film as FilmData));
}
```

`world(c, t)` draws every element of the film from `t`: each element computes its own state (position, size, opacity, morph) as a function of time over the whole duration, not as "shot 3's version". That is what makes the end of one shot and the start of the next the same picture.

## Continuity rules

**Shared geometry.** Name the objects the viewer follows and keep them in one place (`LINE`, `CARD`, `DOT` above). When a shot changes what an object is, build the next object out of it. Either grow it: in `film-starter` the underline is the middle of the card's top edge, and the outline draws out from it both ways (a window on the outline's evenly spaced points) until its ends meet at the bottom. Or morph it: sample both shapes with the same number of points, ordered so they correspond, and interpolate them; check the in-between frames, because a straight interpolation between unlike shapes passes through ugly ones. Never fade one object out and an unrelated one in at the same spot.

**Overlap exits.** The outgoing element keeps drawing its exit while the incoming one enters: the headline blurs out over 0.7 s while the underline already grows into the card. Starting the next action 0.2–0.5 s before the previous exit ends removes the dead frame at every cut.

**One camera.** `cameraPath([[t, x, y, zoom?, roll?], …])` gives one smooth camera for the whole film: positions and roll follow monotone cubic keys (velocity carries through every inner key, no overshoot) and zoom is interpolated in log space. `withCamera(c, camera(t), draw)` puts the camera's `(x, y)` at the frame centre. Put keys on the shot table (`T['Takes shape'] + 2.4`), start a move up to about 0.5 s before the action it serves, and never move the camera during a click or a reading hold. Cards, phones and UI panels get local transforms inside the world (`c.translate`, `c.scale`) and, if they need a push-in of their own, a local zoom about their own centre. They never get a second camera; two cameras make one card's push-in crop the next.

**Keyed motion.** Long moves that pass through several poses use one `keys([[t, v], …])` curve, never a chain of separately eased segments (each one would come to rest at its end, and the viewer sees the stop). Entrances, pops and settles use `springs.out`, `springs.pop`, `springs.camera`, `spring()` and `settle()`.

**Groups fade as one.** A card with its rows, a UI panel or a whole outgoing shot fades through `layer(c, name, alpha, draw)`. Drawn directly, their alphas multiply where parts overlap and the overlaps flash.

**Deliberate breaks.** A hard cut, a dip to black or a wipe is fine when the story changes register (a new act, a drop in the music). Then make the change itself readable: a cut on the beat, a match on shape or colour. Do not use a transition to hide a jump between two unrelated layouts.

## The shot table

`beats([{ title, end, stop?, handoff?, note? }, …])` takes contiguous shots and returns:

| Field | Use |
| --- | --- |
| `shots` | `meta.shots` for Present mode and slides. |
| `list[i].start / end / stop` | Times to build keys and windows from (`T[title]`). |
| `reviewTimes`, `transitions` | Every stop plus the frames around each handoff; copy them into `mografy.json` `review.times` and `review.transitions`. |
| `at(time)` | The shot at `time`, seconds since it started and its progress. |
| `duration` | The film length for `meta.duration`. |

When a shot is retimed, change its `end` in the table only; every key and window built from `T` moves with it. With music, build the `end` values from `tempoGrid(tempo).onBar(n)` so shots stay on bars.

## Storyboard as code

For films longer than about 15 s, let the storyboard and the film share one source. `drawFilm(c, t, data)` above only needs a 2D context, so a storyboard page can draw the real film at each panel's time:

1. Bundle the scene module for the page with esbuild from the checkout: `node -e "require('esbuild').build({ entryPoints: ['storyboards/board.ts'], bundle: true, format: 'esm', outfile: 'storyboards/board.js', alias: { '@mografy/runtime': '<checkout>/packages/runtime/src/scene.ts' } })"` (run it where `esbuild` resolves, such as `packages/runtime`).
2. In `board.ts`, import `filmFrame` from `@mografy/runtime` and `drawFilm`, `prepare` and `BEATS` from the scene; for each panel, tag its canvas with `filmFrame(c, 1920, 1080)`, scale to the panel, and call `drawFilm(c, beat.stop, prepare())`.
3. Inline `board.js` into the storyboard HTML (or an Artifact) together with the `note` of every beat.

The board then shows the actual pixels of the film at each stop, and the scene is never a second implementation of the board. Edit the scene and rebuild the board; never fork the drawing into the board.

## Review

Add `BEATS.reviewTimes` to `review.times` and `BEATS.transitions` to `review.transitions` (step 0.033 s), run `mografy check` and `mografy review`, and look at every transition strip. For each handoff confirm: the followed object is visible in every frame of the strip, nothing jumps between consecutive frames, no frame is empty, and the camera does not stop at a key that is not a story beat.
