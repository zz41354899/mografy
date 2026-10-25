# Reference films

Mografy ships finished films in `examples/` as references for quality. The player lists them under Examples. Before planning a new film, read the one whose brief is closest to yours, watch it in the player, and reuse its structure; then compare your own frames against it at review.

They follow the [quality floor](../SKILL.md) and the [film architecture](film-architecture.md): drawing is a pure function of time, one table drives the shot times and `meta.shots`, and the runtime's `keys`, `cameraPath`, `layer`, `blurLayer`, `bloom` and `blurText` do the camera, fades, blur and glow. Each has a composed, sustained score in `music-src/` and its fonts and licences in `assets/`.

## Copy one to work on

```sh
mografy add                           # list the films and the helpers
mografy add film-starter ~/Films/new  # start a new film from the model
mografy add mografy-montage           # copy to the library (projects/mografy-montage when running from source)
mografy add mografy-story ~/Films/x   # or into a folder you choose
```

The copy is an ordinary project: open it with `mografy dev <folder>`, and edit, check, review and export it like any other. Never edit the films in `examples/` themselves; they are the reference other agents read.

## The films

| Film | Length and look | Read it for | Where to look |
| --- | --- | --- | --- |
| [film-starter](__REPOSITORY__/examples/film-starter/scenes/main.ts) | 20 s, 16:9, English, dark | The model every multi-shot film starts from (see [film-architecture.md](film-architecture.md)): one light the eye follows from a point to a line, a card that grows out of the line and plots an ease curve, a ring of light, the last line's full stop | `BEATS` (shot table), `camera`, `spine` (a line growing round the card), `cardFace` (glass card in a `layer`), `ring` (`bloom`), the `blurLayer` defocus in `world` |
| [mografy-montage](__REPOSITORY__/examples/mografy-montage/scenes/montage-world.ts) | 60 s, 16:9, English or Traditional Chinese (`lang` param); dark → light → neon | One continuous camera across three acts; one comet of light drawing every act I shape from shared geometry; a flat UI card turned into a 3D window; kinetic type that sharpens out of blur; a spiral galaxy; the logo drawn by the last dot | `cam1` / `cam2` (`cameraPath`), `headS` (`keys` along one path), `ACT1` / `joinSegs` (shared geometry), `kin` (blurText per glyph), `plane2` / `drawPlane` (3D card), `galaxy`, `logo`; `BEATS` → `SHOTS` |
| [mografy-triangulum](__REPOSITORY__/examples/mografy-triangulum/scenes/world.ts) | 42 s, 16:9, Traditional Chinese, deep space | A launch teaser in ten beats linked by one light trail; Three.js point clouds composited between 2D layers; depth of field and rack focus with `blurLayer`; glass cards; champagne type with a specular sweep | `buildParticles` / `galaxyLayer` / `fieldLayer` (3D), `blurred` (depth of field), `comet` (light trail), `glass`, `title` (mask reveal), `sweepFill`; `SHOTS` → `BEATS` |
| [mografy-story](__REPOSITORY__/examples/mografy-story/scenes/story-world.ts) | 71 s, 16:9, Traditional Chinese captions, dark → light | A narrative film with a turn: twelve shots, captions on their own track, a black box that opens into the light world, product UI redrawn as cards, a brand-logo ending | `SHOTS` (design times, `sx` slow-down, `xf` overlap, `stop`), `frame` (shot lookup and crossfade), `s05` / `cube3` (the box), `s07` / `system` (UI cards and a slider), `caption`, `brandLogo` |
| [mografy-intro](__REPOSITORY__/examples/mografy-intro/scenes/main.ts) | 12 s, 16:9, English | A short product intro in four beats; see [intro.md](intro.md) | `beatCode`, `beatScrub`, `beatChat`, `beatLogo` |
| [analytics-product](__REPOSITORY__/examples/analytics-product/scenes/main.ts) | 8 s loop, 16:9, English UI | A product UI moment: the cursor picks "This week", the number counts up and the bars regrow while the rest of the screen quiets | `focus` (push-in and dimming), the segmented control, the chart, `cursor` |
| [follow-interaction](__REPOSITORY__/examples/follow-interaction/scenes/main.ts) | 8 s loop, 16:9, English UI | One micro-interaction done carefully: a button whose width and label spring between states, a ripple, a confirmation | `state` (spring), the button, the labels, `cursor` |
| [mografy-brand](__REPOSITORY__/examples/mografy-brand/scenes/main.ts) | 8 s, 16:9, logo only | A logo reveal from the official paths: the ribbon drawn by one stroke, the arches rising, the wordmark letter by letter | the three numbered steps in `renderFrame`, `LOGO_PIECES` |

## What to take from them

- **Timing.** One table per film. Change a shot's end there and every key, slide and review time follows.
- **Continuity.** Each shot ends on the geometry the next one starts from: the comet's head becomes the underline, the underline becomes the prompt pill, the pill becomes the window's field. Read the transitions in the montage before designing your own.
- **Camera.** Moves start before the action, ease through every key and never stop on a pose that is not a story beat. Cards and windows have their own local transforms inside the camera.
- **Cost.** Blur goes through layers or the text's shadow, glow through `bloom`, and buffers are pooled. Run `mografy check` on a copy to see what a frame costs, and keep your own film in the same range.
- **Taste.** Calm pacing, big type, still holds, one logo at the end, and sustained music without sharp high sounds. Treat these as defaults; the project's `style.md` overrides them.

Do not copy their copy, brand marks or music into another brand's film. Take the structure and the techniques, and build the new film from its own brief, assets and style.
