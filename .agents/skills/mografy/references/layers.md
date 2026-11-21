# Layers

A layer is one part of the film the user may want to retime, hide, copy, rename, lock or reorder in the timeline: a title, a card, a background, a subtitle. Declare the parts with `timeline(...)` from `@mografy/runtime`. The editor never edits scene code: it writes only its changes (the **edits**) to `scenes/timeline.json`, and the server compiles and trial-renders them like any other edit, so the player, review sheets and exports agree.

## Declare from the beat table

The beat table stays the one source of time. Take each layer's `in` and `out` from `beats([...])`, never from separate numbers:

```ts
import { beats, timeline } from '@mografy/runtime';
import edits from './timeline.json'; // create it as {}; the editor rewrites it

export const BEATS = beats([{ title: 'Open', end: 3 }, { title: 'Offer', end: 8 }, { title: 'Close', end: 12 }]);
const [open, offer, close] = BEATS.list;
export const TIMELINE = timeline([
  // top to bottom, as the timeline lists them
  { id: 'title', name: 'Title', in: open!.start + .4, out: offer!.end, enter: 'fade-up', exit: 'fade', subtitles: ['title'] },
  { id: 'card', name: 'Offer card', in: offer!.start, out: close!.end, enter: 'pop' },
  { id: 'logo', name: 'Logo', in: close!.start, out: close!.end, enter: 'blur-in' },
  { id: 'bg', name: 'Background', in: 0, out: BEATS.duration, still: true, locked: true },
], edits);
export const meta = { /* width, height, duration, fps, background */ shots: BEATS.shots, layers: TIMELINE.meta };
```

- `id`: stable, `[\w-]`, at most 64 characters. Once the project has edits, never rename an id: the user's changes to it would be orphaned.
- `enter` / `exit`: `none`, `fade`, `fade-up`, `pop`, `blur-in`, `wipe` (see [motion-design.md](https://github.com/mografy/mografy/blob/main/.agents/skills/mografy/references/motion-design.md)). Each motion has a fixed length; lengthening a layer lengthens only its hold.
- `locked: true` keeps the editor from moving it (a background, a camera bed). `hidden: true` starts it hidden.
- `still: true` for a part that does not change with time while at rest (a background, a static panel): it is drawn once and its pixels are reused; its motions still apply.
- `subtitles`: the `role: 'subtitle'` parameters the layer shows, so the subtitle list can jump to it.
- `colour`: the layer's track colour in the editor (not the film).

## Draw: pick one of three

| Method | Use when | Editor's reorder applies |
| --- | --- | --- |
| `TIMELINE.draw(c, time, { title: (c, own, look) => …, … }, anchors)` | Each part can be drawn on its own; the usual choice | Yes |
| `TIMELINE.drawFrame(ctx, time, { … }, anchors)` | The scene draws with the FrameContext (`ctx.draw`) | Yes |
| `TIMELINE.each(c, 'title', time, (c, own, look) => …, anchor)` | Parts share a camera, a mask or one pass and must stay in the scene's own order | No |

- The callbacks are keyed by the **base** id: a copy made in the editor has its own id but draws with its original's function.
- `own` is the layer's own time: its declared window stretched onto where the editor put it, so a part keeps its internal timing when the user moves or retimes it. Animate inside a layer from `own`, not from film time.
- `look` holds `opacity`, `y`, `scale`, `blur`, `reveal`, `local` and `progress`; the methods apply it for you (one `layer` so groups fade as one, `blurLayer` for blur, a clip for `wipe`). `anchors` (per base id) is where rise and scale happen; default the frame's centre.
- `TIMELINE.time(id, t)` gives the own time for code outside the three methods; `TIMELINE.visible(t)` lists what is on screen.

## Layering an existing film

1. Name the parts the user would want to adjust; one layer each. Parts that cannot be separated stay one layer.
2. Give each the window it is on screen, from the beat table.
3. Wrap its existing drawing in `draw`, `drawFrame` or `each`, reading time from `own`.
4. Verify the layered film is unchanged: with an empty `timeline.json`, compare frame hashes at 12 times spread over the film against the original (`mografy review` sheets side by side as a fallback). Every frame must match.

## Films without layers

A scene that declares no layers still gets editable layers: the build splits it into one layer per shot (from `meta.shots`, else the older `slides.shots` some `mografy.json` files still carry), and the editor can retime, reorder, copy and give each shot an enter and exit motion. Old projects get this without any change. When a multi-shot film has no `meta.shots`, add them from the beat table (`shots: BEATS.shots`) so the timeline shows its shots. Declare real layers when the user wants to adjust parts inside a shot.

## Edits are the user's

- Never write `timeline.json` by hand to animate. Change the declarations.
- An edit wins over the declaration. When the user asks you to change a time they already dragged, the declaration alone will not show; say so, and tell them they can revert that layer in the editor.
- Read `scenes/timeline.json` before changing a layered film, so you know what the user has adjusted.

## Colours the user changed

The editor's Design tab (right panel) shows the colours of the shot under the playhead and can swap any colour the film draws for another, without touching scene code. The swaps live in `mografy.json` as `"colors": { "#12b5a5": "#e05d44" }` (from → to, `#rrggbb`) and apply in the player, review sheets and every export. Alpha is kept, and gradients and shadows follow.

- Read `colors` before changing a film's palette. A swap wins over the scene: when you change a colour the user already swapped, tell them, and leave the swap alone unless they ask you to fold it into the scene (then write the new value in the scene's tokens and delete that key).
- Keep palette values as tokens in one place in the scene and in `style.md`, so each shot lists a short, clean palette.
- The same tab edits `style.md` in place. Everything else the user decides about the look (motion, timing, type, rules) goes there, not into editor controls: read `style.md` again before every change, because the user may have edited it since your last turn, and apply new rules to the scene code.
