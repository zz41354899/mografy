# Camera, transition and atmosphere helpers

[cinema.ts](https://github.com/zz41354899/mografy/blob/main/extras/cinema/cinema.ts) gives film-style scenes a shared vocabulary. Every helper is a pure function of time and options, uses `ctx.width` / `ctx.height`, and works in landscape and portrait. [cinema-demo.ts](https://github.com/zz41354899/mografy/blob/main/extras/cinema/cinema-demo.ts) is a fourteen-second tour of six shots joined by six transitions.

## Add to a project

The helpers are an optional extra, not part of the installed template. If the project already has `scenes/cinema.ts`, read and reuse that local copy; it may have been customized. Otherwise copy `extras/cinema/cinema.ts` from the current Mografy checkout into the project's `scenes/` folder, or download it from GitHub:

```sh
curl -fsSL -o scenes/cinema.ts https://raw.githubusercontent.com/zz41354899/mografy/main/extras/cinema/cinema.ts
```

Import it locally (`import { plate, move, particleWipe } from './cinema.js'`). Copy `cinema-demo.ts` too only when the user wants the tour.

## Plates and camera

| Helper | Use |
| --- | --- |
| `preparePlate(ctx, path, softWidth?)` | In `setup`: load an image and prepare a blurred highlights copy for bloom. Store the result in `ctx.assets`. |
| `plate(ctx, plate, camera, { crop?, alpha?, bloom? })` | Draw a plate covering the canvas. `crop` selects a source rectangle for a close-up. |
| `move(time, start, end, from, to, curve?)` | Ease between two framings. A camera is `{ zoom, focusX, focusY, panX, panY }`; `zoom ≥ 1` scales about the focus (0–1 of the canvas); pans are canvas pixels. |

Camera direction: give each shot one motivated move (push in, pull out, pan, tilt) with `ease.inOutCubic` or `ease.outCubic`. Keep zoom ranges small (for example 1.0 → 1.08 over three or four seconds). Pans are clamped to the image, so add zoom headroom before panning. Avoid roll, shake, and bounce unless the brief asks for energy; natural camera work reads as one continuous, decelerating move. Flat key art cannot blink or move limbs; motion comes from camera, light, particles, and type.

## Transitions

Each transition takes `{ start, end, from, to }`. `from` and `to` are callbacks that draw complete frames; the transition calls them inside clips and transforms. Before `start` it draws `from`, after `end` it draws `to`. Clamp each callback's time to its own shot, for example `from: () => shotA(ctx, Math.min(time, cut))`, so the outgoing shot does not continue past its end.

| Helper | Effect | Good for |
| --- | --- | --- |
| `crossfade` | Dissolve | Quiet changes, a breath between sections. |
| `dipTo({ color })` | Fade through a colour, cut at the midpoint | Section changes; a dip to dark when the music drops. |
| `flash(ctx, time, at, { strength, decay })` | Exposure flash overlay (draw after the frame) | Downbeats and hard cuts. |
| `iris({ x, y })` | A circle opens from a point with a glowing rim | Moving from a motif (a moon, an eye, a logo) into the next shot. |
| `slash({ slant })` | A slanted light band wipes across | Bright, energetic cuts. |
| `whip({ direction })` | Both shots travel together with motion smear | Implied camera movement, for example tilting from a face to the feet. |
| `particleWipe({ direction, shape, count, color })` | A gust of growing petals, stars, circles or hearts becomes windows onto the next shot | Sakura-style transitions and themed changes. |

Keep transitions between roughly 0.3 and 0.8 seconds. Place the cut on a beat or bar with `ctx.beat(time)` when the project has audio. Use two or three transition types per film; repeating one signature transition (such as `particleWipe`) ties a piece together better than using every type.

## Atmosphere

| Helper | Use |
| --- | --- |
| `glow(ctx, x, y, radius, color, alpha)` | Soft screen-mode light, for a moon halo or stage light. |
| `drift(ctx, time, { shape, count, amount, wind, fall, size, color })` | Wrapping particles: falling sakura, snow, or sparks. |
| `twinkle(ctx, time, { area, count, size, color })` | Four-point stars that twinkle independently. |
| `lightSweep(ctx, time, { start, end, width, slant, alpha })` | One slanted sheet of light crossing the frame. |
| `smear(ctx, amount, axis)` | Brief directional motion smear of the current frame. |

## Review

Add each transition window to `review.transitions` in `mografy.json` with a small step (0.033–0.05 s) and inspect the strips. Check that clamped shots do not jump at the cut, that particle rims fade before shapes grow large, that flashes do not wash out type, and that the frame never shows an image edge during a move.
