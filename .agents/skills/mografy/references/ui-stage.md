# Product UI on a stage: simplified, framed, caused

[stage.ts](https://github.com/zz41354899/mografy/blob/main/extras/stage/stage.ts) makes short product UI films: hero loops for a landing page, feature cards, a phone moment for social, a dashboard insight. It is built around one sentence:

**It reads as a real product, simplified to what the viewer needs, framed with intent, and every motion has a cause.**

Use it when the brief is "show how it feels to use" in one to three actions, 4–12 s, often looping. Use [product-walkthrough.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/product-walkthrough.md) instead for a longer tour through several screens (4–8 steps, cards that grow into each other), and both together when a walkthrough needs a stage-style hero shot.

## Five ways faux UI fails

Agents drift toward the first one. Name the failure when you review a frame. To see each one next to the good version, open `stage-invoices` and switch its **Variant** parameter (`too-much`, `too-little`, `boxed`, `flat`, `bland`); hold your own stills against the pair you are closest to.

| Failure | Looks like | Fix |
| --- | --- | --- |
| **Too much** | Real words in every cell, packed tight, every column filled | Only story strings are words; the rest are placeholder lines (`role: 'filler'`, `bar`, `bars`) |
| **Too little** | A wireframe: grey boxes that do not read as any product | Keep the real chrome, the brand mark, real nav labels and one real number |
| **Boxed** | The whole app shrunk into a floating card, like a pasted screenshot | `pin()` the window to a corner so it runs off two edges; decide the crop first |
| **Flat** | Everything has the same weight | One focal element per beat; everything else quieter (mute type, lines, `recede`) |
| **Bland** | The brief's brand never shows | A look and its tokens: the product's accent, radius, font, light or dark |

## Workflow

Most of it happens before any code. Write the answers at the top of `storyboards/storyboard.md`.

1. **Medium.** Still or animation, loop or play once, where it sits (hero, feature card, social 9:16) and the design size: 1280 × 720 for 16:9, 720 × 1280 for 9:16. `withStage(c, s, draw, ctx.width / designWidth)` scales it to the film, so the kit's sizes read as real UI at about 1.5×.
2. **Look.** `look('light' | 'dark' | 'blueprint' | 'minimal', overrides)`: one accent or mono; the chrome the product really has (`chrome: 'app' | 'browser' | 'tabs' | 'tahoe' | 'card'`), its real icons. Map the product's own tokens (accent, radius, font) onto the look instead of inventing colours.
3. **Story.** How it feels to use, a flow through the app, or what the system does on its own. Three to five beats, one sentence each. The last beat undoes the first **on screen, with a cause** (an Undo, a back tap, a lock button), so a loop has no seam.
4. **Example.** Copy the closest reference film (`mografy add <name> <folder>`, table below) and make it the brief's product: what is cropped, what overlaps what, one gutter. Copying an example that runs a window off the edge works far better than a rule that says to.
5. **Screen.** List the few real strings the story needs; everything else becomes lines. A dashboard needs about six words, an inbox one real row.
6. **Choreograph.** The script decides the timing: holds before actions, overlapping changes, one camera push at most per beat, a loop that ends where it began.
7. **Rehearse.** `mografy check --motion`, `mografy review` with transition strips over every action and the loop seam, then hold your stills next to the example's.

## Reference films

| Film | Shows | Start from it for |
| --- | --- | --- |
| `stage-invoices` | Web app window off two edges, a flight into a rolling total, camera push, toast Undo; four looks; the five failure variants | Any web app hero |
| `stage-phone` | 9:16, a cropped phone driven by taps, a notification that grows into the thread, typing | Mobile and social clips |
| `stage-dashboard` | Dark, the newer macOS window, hover tooltip, one annotation, camera push | Analytics, one insight |
| `stage-bento` | A bento section planned as one picture: one UI tile, a stat, an object, a diagram; no cursor | Homepage feature grids |
| `stage-calendar` | `drag()`: lift, a target that jumps cell to cell, landing, staggered confirmations | Anything dragged: cards, slots, files |
| `stage-upload` | Blueprint diagram, packets per hop, `ui.callout` annotations; no cursor | API docs, architecture, "how it works" |
| `stage-command` | Keyboard only: keycaps as the cause, a filtering palette, ⌘Z | Command palettes, shortcuts |
| `stage-checkout` | Browser with tabs, typing, a spinner, a check that draws | Forms, sign-up, payments |
| `stage-request` | Web and phone in one frame, `recede`, cursor and taps together | Anything that crosses devices |
| `stage-snooze` | Quiet card chrome, hover actions, a menu, a row leaving and the list closing up | Small feature cards |

## Build

```ts
import { play, wait, set, click, tap, type, drag, move, focus, cursor, mark, withStage, createKit, look, pin } from './stage.js';

const W = 1280, H = 720, START: Point = [880, 640];
const initial = { paid: false, total: 18400, toast: false };          // everything that changes is state
const WIN = pin([W, H], [1260, 760], 'tl', [92, 72]);                 // crop first: runs off right and bottom
const layout = (s: typeof initial) => ({ markPaid: [1006, 465, 128, 38], total: [354, 290, 220, 58], ...(s.toast ? { undo: UNDO } : {}) });

const show = play(initial, [
  mark('Mark paid'), wait(0.9),
  click('markPaid', { paid: true }),                                   // the change lands on the press
  wait(0.42), set({ total: 22600, toast: true }),
  focus('total', 1.5, 1.1), wait(2.1), focus(null, 1, 1),
  mark('Undo'), wait(0.5),
  click('undo', { paid: false, total: 18400, toast: false }),          // the cause of the reset
  wait(0.5), move(START), wait(0.7),
], { size: [W, H], layout, start: START, loop: true, cursors: { markPaid: 'pointer' } });

export const meta = { width: 1920, height: 1080, duration: show.duration, fps: 30, background: '#efeeec', shots: show.shots, loop: true };

export function renderFrame(ctx: FrameContext, time: number, p: Values) {
  const ui = createKit(look('light', { accent: p.accent })), s = show.at(time);
  ctx.withCanvas(c => {
    ui.backdrop(c, ctx.width, ctx.height);
    withStage(c, s, g => {
      ui.window(g, WIN, { chrome: 'app', sidebar: 200 }, (w, body) => { /* draw from s.value / s.on / s.is / s.num */ });
      ui.pointer(g, s.cursor);
    }, ctx.width / W);
  });
}
```

### Script steps

| Step | Takes time | Use |
| --- | --- | --- |
| `wait(s)` | yes | Holds: before the first action (0.6–1 s), after a payoff (1.5–2.5 s) |
| `click(name, then?)` | yes (move by distance + 0.1 s dwell + hold) | A cursor click; `then` is applied as the press lands |
| `tap(name, then?)` | yes | Phones: no travelling cursor, a press dot appears |
| `drag(from, to, then?)` | yes | Cards and calendar slots; the cursor closes while carrying |
| `type(key, text, cps?)` | yes | Typing into a state string (22 characters per second) |
| `move(target)` | yes | Back to the start, or to a hover target |
| `set(values, { duration?, curve? })` | no | A change with no click (a reply arrives, a total updates after a flight) |
| `focus(name \| null, zoom?, duration?)` | no | Camera push in on a rect and back; runs beside the next steps |
| `cursor(visible)` | no | Hide the cursor for a beat that runs by itself |
| `mark(title)` | no | Starts a shot for `meta.shots`, Present mode and review |

Cursor moves take 0.3–0.95 s by distance on a shallow arc, like a hand; never time them by hand. `layout(state)` is the single source of rects: the cursor aims at them, the camera focuses on them, and the drawing should use the same constants.

### Sampling state in renderFrame

`s.value(key)` the current value; `s.on(key)` / `s.is(key, v)` 0..1 presence that springs in (0.42 s) and eases out (0.28 s), so parts move instead of popping; `s.num(key)` a number springing between values; `s.pair(key)` for `ui.roll`; `s.since(key)` seconds since the last change, for one-off motions such as a flight; `s.cursor` (`x`, `y`, `press`, `shape`, `visible`, `touch`); `s.camera`. While a `drag()` carries something, `s.cursor.dragging` is true and `s.cursor.lift` (0..1) rises and lands: draw the carried object at the cursor, scaled and tilted by `lift`, and a ghost at home (`stage-calendar`). Taps never move the cursor; their press shows at `s.cursor.tx`, `ty`. `play(..., { pointer: false })` hides the cursor for a film about what the system does on its own.

### Kit

| Part | Use |
| --- | --- |
| `look(name, overrides)`, `LOOKS` | Tokens: backgrounds, window, sidebar, surface, ink / mute / faint, line, accent, bar, shadow, radius, font, `words` |
| `ui.window(c, rect, { chrome, url, tabs, sidebar, recede }, draw)` | The chrome follows from what you pass; `tahoe` is the newer macOS window (large lights, floating sidebar, tall toolbar). `draw` gets `body.content` and `body.sidebar`. Never put an address bar on a native Mac app |
| `pin(size, box, corner, inset)` | A rect pinned to a corner that runs off the opposite edges |
| `ui.nav`, `ui.text`, `ui.bar`, `ui.bars` | Sidebar with brand and real labels; text that becomes a line when the look keeps fewer words; placeholder lines |
| `ui.button`, `ui.badge`, `ui.field`, `ui.menu`, `ui.avatar`, `ui.icon`, `ui.toast` | Controls; pass `press: s.cursor.press` to the pressed one, `k: s.on(...)` to anything that enters |
| `ui.roll(c, from, to, k, x, y, o)` | A number that rolls only the digits that changed |
| `ui.fly(c, fromRect, toRect, k, draw)` | An object flying into a slot on a shallow arc, landing with a settle |
| `ui.phone(c, rect, draw, { time, dark, island })`, `ui.lockScreen`, `ui.notification` | Phones from real proportions; pass a rect that crosses the frame edge so the phone is cropped |
| `ui.shadow`, `ui.card` | Layered shadow (hairline, mid, long soft), cheap under camera zoom; a surface card with hairline and optional lift |
| `ui.key(c, x, y, label, { press })` | A keycap; draw keycaps outside the camera when keys are the cause (`stage-command`) |
| `ui.callout(c, from, to, label, k, { side })` | An annotation: a dashed leader that draws first, then a one-line label |
| `ui.pointer(c, s.cursor, { style })` | `arrow` (default), `large`, `circle`; shapes change over named rects (`cursors` option) |

`words` in a look: `story` (default) draws `ui` and `keep` text, turns `filler` text into lines; `lines` (minimal) turns everything but `keep` into lines; `all` draws every word; `none` is a wireframe, the failure *too little*, kept only for comparisons.

## Rules that hold up

- **Crop first.** Decide what is cut off before drawing anything; do not build what will not be seen. Windows run off two edges; phones off the bottom or a side, never shown whole.
- **Few words.** Real strings only where the story is. A full inbox reads as full with one real row and lines for the rest.
- **One accent, real chrome, real icons.** No fake iOS status bar on a desktop scene; no browser chrome on a native app.
- **Every change has a cause.** A click, a tap, a drag, a typed character, an arriving message. Nothing changes by itself unless the story is "what the system does on its own"; then hide the cursor (`cursor(false)`).
- **Hold the payoff.** 1.5–2.5 s on the result; holds before actions read as intention.
- **One camera move per beat**, in on the thing that changed, back out before the next action.
- **Short transitions.** Most parts enter in 0.3–0.5 s; containers and flights 0.6 s; overshoot only on pops and landings.
- **Loops end where they began.** `play(..., { loop: true })` refuses a script whose final state, cursor or camera differs from the start; add `loop: true` to `meta` so `mografy check --motion` compares the last frame with the first.
- **Text must fit.** `ui.text` with `max` throws when copy overflows its box (the error names the string and both widths); shorten it, widen the box, or pass `fit: 'ellipsis'` on purpose.
- Invent the product, people and figures, as in the reference films. Never draw a real company's interface, mark or customer data.

## Review checklist

- [ ] The first frame says which product this is in one glance (chrome, brand, one real number or row).
- [ ] At most one focal element per beat; everything else is quieter.
- [ ] Count the words: are they all needed by the story?
- [ ] The window or phone is cropped by the frame; nothing floats whole in the middle.
- [ ] Each change in a transition strip follows a visible cause.
- [ ] `mografy check --motion`: no jumps, hard starts or stops, and "loop seam clean" for a loop.
- [ ] Watch it at phone size (a 9:16 export or a 360 px wide preview): the story still reads.
