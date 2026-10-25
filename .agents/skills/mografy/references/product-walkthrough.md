# Product walkthroughs: redraw the app, film the action

[walkthrough.ts](https://github.com/zz41354899/mografy/blob/main/extras/walkthrough/walkthrough.ts) turns a product's screens into a film. Claude or Codex look at screenshots of each step that the user provides, redraw the real UI as large, simplified cards, and film only the action on each card. Every card grows out of the control that was just used, one film camera frames the whole piece while each card pushes in on its own control with a local zoom, and a big cursor (or a finger tap) does the clicking. [walkthrough-demo.ts](https://github.com/zz41354899/mografy/blob/main/extras/walkthrough/walkthrough-demo.ts) is a twelve-second tour: a fictional quoting app goes from an empty list to an AI-drafted quote to a shared link in four cards.

## When to use it

Use it for any film made from a web or mobile app's screens: product demos, feature explainers and tutorials, onboarding and help clips, what's-new shorts, mobile app previews, social cut-downs and landing-page loops. Typical requests: "turn these screenshots into a walkthrough", "redraw the UI simpler and only film the interactions" (重繪、介面簡化、只拍操作細節).

Use plates from `cinema.ts` ([camera-transitions.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/camera-transitions.md)) when the footage itself should stay a screen recording, and `three.ts` ([three-d.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/three-d.md)) when a device model must turn in 3D.

## Add to a project

The helper is an optional extra, not part of the installed template. If the project already has `scenes/walkthrough.ts`, read and reuse it. Otherwise copy it from the current Mografy checkout (`extras/walkthrough/`) or download it:

```sh
mografy add walkthrough projects/<name>
```

`mografy add` copies from this checkout's `extras/` folder, or from GitHub when it is missing, keeps any project file that differs from the extra (`--force` replaces it), and prints the import line. Without the `mografy` command, download the same files from `https://raw.githubusercontent.com/zz41354899/mografy/main/extras/walkthrough/`.

Import it locally (`import { createKit, camAt, withCamera as withCardZoom, cursorAt } from './walkthrough.js'`), and take `springs`, `cameraPath`, `withCamera`, `beats` and `blurText` from `@mografy/runtime`. The extra's `withCamera` is a card-local zoom, so rename it on import to keep it apart from the runtime's film camera. Copy `walkthrough-demo.ts` too when you want a working starting point; it shows every helper in context. For Chinese or Japanese UI copy, add the CJK fonts from [cjk-typography.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/cjk-typography.md) and put `"Noto Sans TC"` (or the project's CJK family) in the theme's `font` stack.

## Choose the scenario first

The same kit serves every scenario; length, pacing, captions and the pointer change.

| Scenario | Length and format | Shots | Pointer | Text on screen | Pace and sound |
| --- | --- | --- | --- | --- | --- |
| Product demo | 20–45 s, 16:9 | Brand title, 4–6 detail shots of the main flow, one result, logo end card | Big cursor | Little: the product's own copy is the text; title at the start, tagline and URL at the end | Calm; clicks on bar lines when there is music |
| Feature explainer or tutorial | 45–90 s, 16:9 | One shot per step, 4–8 s each, every result held long enough to read | Cursor with slower moves (up to 1.1 s) | Big step titles beside or above the card ("1 Describe the job") | Calm; music optional and low |
| What's new / single feature | 8–15 s, 16:9 or 1:1 | Before → the one action → result, two or three shots | Cursor | One headline plus a "New" chip | One musical hit on the result |
| Mobile app preview | 15–30 s, 9:16 (1080 × 1920) or a phone inside 16:9 | Full-bleed screens or a phone frame (`kit.phone`), one gesture per shot | Taps (`tap`), no cursor | Short captions in the top third, inside social safe margins | Brisk; light score |
| Social cut-down | 6–15 s, 9:16 or 1:1 | Show the result in the first second, then the one or two actions that cause it, then the logo | Cursor or taps | Large burned-in captions, since most viewers watch muted | Fast in, hold the payoff |
| Loop for a landing page or docs | 4–10 s, any size | One action that resets: the last frame equals the first | Optional | None | No music; loop on a hold; export a small MP4 or WebM |

When the brief is unclear, ask which scenario it is and for how long; otherwise infer it from the request and say which one you chose.

## Workflow

1. **Collect the screens.** Agree on the steps that tell the story (usually 3–6) and ask the user for a screenshot of every state, with the exact labels and values where they are hard to read. Keep them in `capture/` (numbered PNGs plus a `steps.json` with labels and values). Read the UI tokens from the screenshots or ask for them (primary colour, ink, borders, radius, fonts), and ask for the logo as SVG. Do not operate the user's site or account to collect them.
2. **Choose the fidelity.** A *faithful rebuild* draws the whole app as it looks and films it with a camera; use it when viewers must recognise the real screens. A *simplified redraw* is the default when the user asks to redraw, simplify, or film only the interactions. Both use the real product: its layout logic, labels, colours and the order of states. Never invent features or screens.
3. **Inventory each screenshot.** For every step write three lists: the *target* (the control the action touches: a field, button, row, dialog), the *context* needed to understand it (the card title, one neighbouring row), and *everything else* (navigation, filters, footers, badges, extra columns, tooltips).
4. **Redraw.** Keep the brand tokens, the logo, the real labels and values of the target, its proportions and its state sequence (empty → focus → typing → loading → result → success). Drop everything else, collapse lists to 3–4 rows and tables to the columns the story needs, and turn copy the action does not need into `skeleton` bars. Raise type to about 1.3–1.6× the app's size so it reads at 1080p, give generous padding, and use one card style throughout. Build every step from the same kit parts so the film stays consistent.
5. **Approve before animating.** Render one still per step (from a storyboard page or `mografy review`) and put it beside its screenshot in a sheet: screenshot | redraw. Show it to the user and adjust what to keep or drop before the motion work.
6. **Film one action per shot.** Show the action, not just its arrival: the caret typing, the button squashing, rows sliding in, numbers counting up, a check mark drawing, a status chip changing colour. Hold each result long enough to read it.
7. **Hand off between shots.** The control that finished the step grows into the next card (`kit.grow`): a button into a dialog, the send button into the sent message, a picked row into the field it fills, a copied link into the phone that opens it. Avoid plain cuts and cross-dissolves of text over UI.
8. **One film camera, a local zoom per card.** Lay the cards out in one world and move one `cameraPath` across it ([film-architecture.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/film-architecture.md)); it carries the hand-offs from card to card. Inside each card's own transform, give the card a local zoom from its own `camAt` keys: hold, push in on the control about to be used (zoom 1.3–1.9), click, then pull back as the next card arrives. The cursor keys use functions of time so the pointer stays on its target while either moves.
9. **Opener and ending.** Open on the brand (icon, title) and let its logo match-cut into the logo on the first card. End on the logo, the tagline and the public URL. Ask the user for the official tagline and URL.
10. **Music and timing.** Follow [music.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/music.md) when the film needs a score, and put the clicks on bar lines. To change the length without rushing actions, borrow time from holds.
11. **Verify.** `mografy check`, then `mografy review` with a transition strip over every hand-off. Look for overlapping cards, a push-in that crops the control, blank frames during a camera move, text too small at 1080p, and a cursor that drifts off its target. Show the user a preview with music before the final export.

## API

| Helper | Use |
| --- | --- |
| `createKit(theme)` | Drawing helpers bound to a theme (`primary`, `primaryDark`, `primarySoft`, `ink`, `mute`, `faint`, `line`, `surface`, `card`, `skeleton`, `shadow`, `font`, `mono`, `radius`). Returns `card`, `skeleton`, `chip`, `button`, `field`, `text`, `wrap`, `reveal`, `blurText`, `icon`, `check`, `ring`, `toast`, `grow`, `phone` and primitives (`box`, `hair`, `line`, `dot`, `rr`, `measure`, `mix`). |
| `kit.card(c, rect)` | A floating card: wide soft shadow, contact shadow, hairline. Shadows scale with the current transform. |
| `kit.grow(c, from, to, k, { outgoing, incoming, fromColor, toColor, fromRadius, toRadius })` | Container transform between two screen-space rects. Drive `k` with `springs.pop`. |
| `kit.button(c, rect, label, { kind, hover, time, pressAt, icon })` | Squashes and rings on `pressAt`; `hover` tints it before the click. |
| `kit.field(c, rect, { value, placeholder, size, lines, focus, caret, mono })` | An input with wrapping, focus ring and caret; feed `typed(text, p)` for typing. |
| `kit.reveal(c, s, x, y, size, time, start, span)` | Per-character blur-in for titles and replies (no `c.filter`). For words and lines outside the kit, use the runtime's `blurText` and `blurWords`. |
| `kit.toast`, `kit.check`, `kit.chip`, `kit.skeleton`, `kit.icon` | Notices, a check that draws itself, status pills, stand-in bars, line icons. |
| `kit.phone(c, screenRect, draw)` | A phone body; `draw` paints the screen in its own coordinates. |
| `camAt(keys, time)`, `withCamera(c, view, cam, draw)` | A card's local zoom from `[time, x, y, zoom]` keys, interpolated by `zoomPath` (a pure scale about a fixed point) with `springs.camera`. Import it as `withCardZoom`; the film camera is the runtime's `cameraPath` and `withCamera`. |
| `toScreen`, `rectToScreen`, `scaleRect` | Map layout points and rects through a camera, for hand-offs and cursor targets. |
| `cursorAt(keys, time)`, `drawCursor`, `clickRing`, `tap` | The big cursor (keys may be functions of time), click rings, and finger taps for phone scenes. |
| `springs`, `spring(stiffness, damping)`, `sineInOut`, `press`, `typed`, `countUp`, `blink`, `visible` | Motion values: `springs.out` entrances, `springs.pop` cards and buttons (about 1.5 % overshoot), `springs.camera`, `springs.cursor`. |
| `fluid(c, view, time, colors)`, `flood(c, view, r)` | Brand-colour atmosphere behind the cards, and a soft disc to flood it in or out. |

## Motion that feels calm and expensive

- Springs everywhere, never linear: critically damped for entrances and cameras, a touch of overshoot only for cards and buttons. Keep sine in-out for slow drifts.
- Zoom as a pure scale about one point (`zoomPath`), so the picture never swings sideways while it scales.
- Start camera moves a little before the cursor arrives; never move the camera during a click.
- Give the cursor up to 1.1 s per move on a gentle arc; hold it on the control for the click.
- Users often find the first cut too fast. Hold titles and results longer, and borrow time from static holds rather than speeding up actions.

## Pitfalls

- Hand-off rects are in world space under the film camera, and in screen space only inside a card's local zoom: evaluate the outgoing card's zoom at the click time and the incoming card's zoom at the current time.
- Push-ins belong to the card (its local zoom), not to the film camera; a film camera that zooms into one card crops the next one when they overlap during a hand-off.
- Fade a card with its content through one `layer`, so its rows and shadow do not flash where they overlap.
- Do not use `c.filter` for blur in a scene; use `kit.blurText`, the runtime's `blurText` / `blurLayer`, and the card shadows. The only scratch canvas is `fluid`'s, created once and redrawn every frame; see [performance.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/performance.md).
- Use invented share tokens and demo customers; never show a real customer's data or a working private link.
- When the copy changes, re-subset the CJK fonts so every new character is covered.
- For portrait, lay out in 1080 × 1920 with `Viewport` set to the scene size; cards about 960 px wide, captions in the top third.
