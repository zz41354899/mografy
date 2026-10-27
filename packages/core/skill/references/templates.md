# Mografy Templates

Mografy Templates is a free (MIT) library of finished, editable templates for product demo videos: hooks, captions,
product screens, callouts, numbers, proof, slides, end cards and transitions. All copy is English. Each template has one
native aspect ratio and one look:

| Aspect | Ids | Look | For |
| --- | --- | --- | --- |
| 9:16 | `hook-impact` … | **Editorial**: a white printed page, black type, one burnt-orange accent; tall Anton headlines that rise letter by letter, header and footer rules, quote marks, hand-drawn underlines, dark picture windows and a carousel swipe. Themes `light` (default) and `dark`. | Threads, Reels, Shorts |
| 16:9 | end in `-wide` | **Montage**: night, light or neon grounds; kinetic Inter type that sharpens out of a blur; the Mografy spectrum (teal, sky, violet, coral, amber) on a word, a pill rim or a comet of light; product windows on tilted planes. | Landing pages, YouTube, Product Hunt, decks |

A template that exists in both ratios has a `pair` (`stat-count` ↔ `stat-count-wide`). Never put a template into a film of
the other ratio. The sources live in [templates/](__REPOSITORY__/templates), with the catalog in
[templates/catalog.json](__REPOSITORY__/templates/catalog.json); every template plays live at https://www.mografy.app/en/docs/templates.

## When to use them

Reach for a template when a brief needs a standard beat of a demo video (an opening hook, subtitles, a phone or laptop
screen, a callout on a feature, a before/after, numbers, testimonials, a closing card). Start from the template, then
adapt its copy, colours and timing to the brief. Build new motion from scratch only when no template fits, or when the
film needs its own visual concept. Use one look per film: the editorial templates for a 9:16 post, the montage templates for
a 16:9 film.

## Add templates

```sh
mografy add hook-impact three-steps cta-endcard projects/<name>
```

- When the folder is not a project yet, `mografy add` creates it: a project with the templates' aspect ratio, a
  `scenes/main.ts` that plays the templates in the order given, output glow and grain off, and review times. This is a
  complete way to start a film; open it with `mografy dev projects/<name>`.
- Without a folder, inside a project, the templates go into that project. Outside a project, the first template names a new
  project in the library. `mografy add` never falls back to another (last opened) project.
- Each template lands in `scenes/templates/<id>.ts` with the shared `kit.ts`, `editorial.ts` and `montage.ts`. Inter
  (500–800) and Anton are copied to `assets/` with their licences and registered under `fonts` in `mografy.json`.
  Files the user changed are kept unless `--force` is passed. If the project already has `scenes/templates/`, read
  and reuse that local copy.
- A project without a `tsconfig.json` gets one for editor support (strict, `@mografy/runtime` resolved to this
  installation's types), so templates open in an editor without "Cannot find module" or implicit `any` errors.
- Templates set `render.glow` and `render.grain` to 0 in new projects: the light that belongs to the montage look is
  drawn in the scene. Keep them at 0 when a film is made of templates.

## Use a template

- **On its own:** set `"scene": "scenes/templates/<id>.ts"` and the matching `"aspectRatio"` in `mografy.json`.
- **In a film:** import the module and play it on the film's timeline. `play` resolves the template's default params
  and applies your overrides; `backdrop: false` draws an overlay template (captions, callouts, lower thirds, end
  cards) over the film's own picture.

```ts
import * as hook from './templates/hook-impact.js';
import * as caption from './templates/caption-highlight.js';
import { play } from './templates/kit.js';

export function renderFrame(ctx: FrameContext, time: number) {
  play(ctx, time, 0, hook, { text: 'Plan the week\nin [one view.]' });
  drawProduct(ctx, time);                                   // the film's own shot
  play(ctx, time, 4, caption, { backdrop: false });
}
```

Every template enters, holds still while it reads, and exits in its last ~0.5 s, so templates chain without empty frames.
Keep the film's quality floor: one world and one camera for shots you write yourself, and hand geometry over at
cuts.

## Edit a template

- Copy and colours are params: the template's strings, `theme` (editorial `light`/`dark`; montage `night`/`light`/`neon`)
  and, for editorial templates, `accent`. In editorial headlines, a word in `[brackets]` takes the accent; in montage
  headlines it takes the spectrum. Change timing and layout in the template file. Keep `renderFrame` pure, and keep
  critical copy inside `safeRect(aspect)` from the kit (`safeGuide: true` shows it in the preview, never in exports).
- Screen templates draw a fictional stand-in product ("Northwind"): `editorialScreen` in 9:16, `appUI` in 16:9.
  Replace it with the real product: redraw the real screens in the same box (see
  [product-walkthrough.md](product-walkthrough.md)), or load a screenshot in `setup` and draw it there. Editorial
  templates that take pictures load `assets/<name>.jpg` with `loadPhoto` (black-and-white, like the look) when the file
  exists; the agent hint names the file.
- Brand templates draw a placeholder mark. Replace it with the real logo (load `assets/logo.png` in `setup` and draw it
  in the same box).
- The fonts are Latin subsets. For Chinese or Japanese copy, add `mografy add cjk` and a CJK font, and check the
  frames for fallback glyphs.
- After editing, run `mografy check` and `mografy review` and look at the stills, as for any scene.

## Catalog

<!-- catalog:start -->
| Template | Aspect | Category | Seconds | Use it for |
| --- | --- | --- | --- | --- |
| `hook-impact` Impact headline | 9:16 | hook | 4 | First 3–4 s of a post. Up to three lines of 1–3 short words, uppercase reads best; mark one word with [brackets]. Not for sentences longer than ~25 characters. |
| `hook-number` Number hook | 9:16 | hook | 3.5 | Open on a single striking figure (1–4 characters: "3", "24", "9.5") with a short unit and a one-line caption under 30 characters. For several figures use stat-count. |
| `hook-question` Question hook | 9:16 | hook | 3.5 | Opening 3–4 s that asks the viewer a pain-point question. Up to three short uppercase lines (≤ 14 characters each); mark the key words with [brackets]; the question mark is drawn for you. |
| `caption-highlight` Highlight caption | 9:16 | caption | 4 | One statement of up to ~40 characters with the key words in [brackets]. Put assets/highlight.jpg in the project for the picture; with backdrop false the caption sits on a white panel over your own footage. |
| `caption-pop` Pop captions | 9:16 | caption | 4 | Punchy spoken line of 2–8 short words; words of up to three letters ride with the next word. Put assets/pop.jpg in the project for the picture, or play it with backdrop false over your own footage (the strip carries the words). |
| `caption-stack` Stacked caption | 9:16 | caption | 4 | A slogan of 2–5 very short lines (1 word each, up to ~6 letters), one per "\n". Put assets/stack.jpg in the project for the picture strip; with backdrop false the stack sits on a white panel. |
| `caption-subtitle` Speaker subtitle | 9:16 | caption | 4.5 | Interview or founder quote: one sentence up to ~60 characters (wraps to two lines) and a "Name · Role" line. Put assets/speaker.jpg in the project for the picture; with backdrop false it draws its own scrim over your footage. |
| `caption-word` Word captions | 9:16 | caption | 5 | Spoken subtitles for a voice-over: 2–3 lines of up to ~24 characters, one per "\n"; mark key words with [brackets] (default: the last word of each line). Put assets/caption.jpg in the project for the picture, or play it with backdrop false over your own footage. |
| `ai-chat-stream` AI chat stream | 9:16 | screen | 6 | Show an AI feature answering. Prompt under ~60 characters, reply under ~200 (about 30 words; longer replies stream too fast to read). Speaker labels are SPEAKERS in the file. |
| `click-zoom` Click zoom | 9:16 | screen | 4 | Highlight one button or control. Label 2–5 words. The editor in the window is a stand-in: redraw `editor` with the real screen and move BTN to the control (keep it in the top half so the leader stays short). |
| `desktop-follow` Desktop follow | 9:16 | screen | 6 | Show a two-click desktop flow in a portrait post. Label 2–5 words, [brackets] mark the orange words. The app is a stand-in 1440 × 1000 dashboard: redraw `app` with the real product and move CLICKS to its targets (the camera follows them). |
| `device-stack` Device stack | 9:16 | screen | 5 | Say the product works everywhere. Title 2–4 words ([brackets] mark orange words), detail one short line. Both screens come from `product` (landscape and portrait layouts of one stand-in dashboard): redraw it, or draw screenshots into the two screen rects. |
| `phone-recording` Phone recording | 9:16 | screen | 5 | Show a mobile app in use. Title 2–4 words. The screen is a stand-in task list: put assets/screen.jpg (portrait, about 9:19) in the project to show a real recording frame, or redraw `phoneScreen`; the tap lands on the second row (TAP_ROW). |
| `type-input` Typed input | 9:16 | screen | 4.5 | Show a prompt or search being typed and answered. Query up to ~60 characters (two lines). The three result rows are stand-ins in RESULTS: replace them with what the real product returns. |
| `before-after` Before and after | 9:16 | explain | 5 | Contrast the old way with the product. Write each label as "KICKER: HEADLINE" (the part after the colon is the big line, 1–3 words). The twelve steps and the checked line are STEPS and RESULT in the file. |
| `callout` Callout | 9:16 | explain | 4.5 | Point at one feature. Title 1–3 words ([brackets] mark orange words), detail one short sentence. Over a film picture (backdrop false) the whole frame dims around FOCUS and the label sits on a white panel; move FOCUS to the element in your picture. |
| `three-steps` Three steps | 9:16 | explain | 7 | Explain a 3-step flow. Step titles 2–4 words, details one short line. The window shows a stand-in screen: put assets/step-1.jpg … step-3.jpg in the project (or redraw `screen`) to show the real product. |
| `review-cards` Review carousel | 9:16 | proof | 6.5 | Social proof for a post: three reviews, one per line as "quote | name | role", quotes up to ~70 characters. Fictional people by default; use real reviews only with permission. |
| `stat-count` Numbers table | 9:16 | data | 4.5 | Three key figures with short labels, one per line as "value | label" (a unit or suffix may follow the value: "4.9/5", "3 MIN"). Values up to 6 digits, labels under ~20 characters; the headline is one line of up to ~22 characters. |
| `cta-endcard` Call to action | 9:16 | end | 5 | Last 3–4 s of a post: a call to action of 1–3 short words (mark one with [brackets]) and a name to search for, under ~16 characters. The picture above the sheet is a stand-in: put assets/endcard.jpg in the project, or play the template with backdrop: false over your own last shot. |
| `logo-tagline` Logo and tagline | 9:16 | end | 5 | Closing logo of a 9:16 post. Brand 1–2 words, tagline under ~28 characters with one [marked] phrase. The N mark is a fictional stand-in: redraw `mark()` with your own logo as two or three flat strokes that grow in order. |
| `push-transition` Vertical push | 9:16 | transition | 2.6 | Between two full-frame pictures or screens of a 9:16 film. Titles 1–4 words. The pictures are stand-in product screens: put assets/from.jpg and assets/to.jpg in the project (or redraw `picture`) so the push carries your own last and next shot. |
| `product-hero-wide` Product hero | 16:9 | hook | 5 | Opening of a landing-page loop, Product Hunt or YouTube demo. Name 1–2 words, tagline under ~40 characters, button labels 1–3 words. The window is a stand-in: redraw it in `appUI` or draw a screenshot into the same 1400 × 860 card. |
| `title-wide` Wide headline | 16:9 | hook | 5 | Opening statement for a landing page, YouTube or a talk: two short lines (under ~26 characters each), the [bracketed] words in the spectrum. Night or neon ground reads best. |
| `caption-subtitle-wide` Wide subtitle | 16:9 | caption | 4 | Subtitle or pull quote over footage in a landscape film: one sentence (wraps to two lines past ~45 characters) and a speaker line. Play it with `backdrop: false` over your own picture; the product screen underneath is only a stand-in. |
| `name-lower-wide` Wide lower third | 16:9 | caption | 4 | Name and role over an interview or talking-head shot in a landscape film. Name 1–3 words, role under ~40 characters. Play it with `backdrop: false` over your footage; the soft-focus speaker underneath is only a stand-in. |
| `ai-chat-stream-wide` AI chat stream | 16:9 | screen | 6 | Show an AI feature answering. Prompt one line (under ~44 characters), reply 1–3 sentences (under ~190 characters). The chat window is a stand-in: restyle `chat()`; never use a real AI brand name or logo. |
| `browser-window-wide` Browser | 16:9 | screen | 5 | Open a website or web-app demo. Keep the URL short (under ~24 characters, no https://). The page is a stand-in: redraw `page()` (1400 × 764 below the bar) or draw a screenshot there; avoid real browser or brand UI. |
| `laptop-frame-wide` Laptop | 16:9 | screen | 5 | Show a desktop product in context. Title under ~26 characters; it breaks after a comma, and [bracketed] words (else the last line) take the spectrum. The screen is a stand-in: redraw `screen()` or draw a 1400 × 860 screenshot into it. |
| `multi-window-wide` Multi-window | 16:9 | screen | 5 | Real-time sync or collaboration. Title under ~28 characters; [bracketed] words (else the last word) take the spectrum. The board is a stand-in: rename the columns and cards in `COLS`, or redraw `board()`. |
| `terminal-wide` Terminal | 16:9 | screen | 5 | CLI, SDK or developer-tool launch. One command under ~34 characters. Output and success copy live in `OUTPUT` and `SUCCESS`; keep them to four short lines and one line. Neon ground reads best. |
| `before-after-wide` Before and after | 16:9 | explain | 5 | Contrast the old way with the product in a landscape film. Write each label as "Kicker: Headline" (headline 1–3 words, under ~16 characters; [brackets] take the spectrum). The twelve steps and the result line are STEPS and the Result param; a full-frame explainer, not an overlay. |
| `callout-wide` Callout | 16:9 | explain | 4.5 | Point at one feature of a product window. Title 1–3 words ([brackets] take the spectrum), detail one short sentence. With backdrop false the window is skipped and the frame dims around FOCUS over your own picture; move FOCUS (a rect in the 1400 × 860 window) to your element, or redraw the window in `appUI`. |
| `feature-grid-wide` Feature grid | 16:9 | explain | 5.5 | Show what a product does in one frame: 3–6 features, one per line as "Name: detail" (name 1–3 words, detail under ~38 characters), headline under ~32 characters with [brackets] for the spectrum. Draw your own icons in `icon()` (one per card, by index). |
| `logo-wall-wide` Logo wall | 16:9 | proof | 4 | Social proof in a landscape film or a talk. The twelve names are fictional stand-ins in `NAMES`: replace them with real customers you may name (or draw their logos inside the chips, keeping the chip and dot). The first number in the headline takes the spectrum. |
| `growth-bars-wide` Growth bars | 16:9 | data | 5 | A single growth story (revenue, users, speed) in a landscape film or a talk. The twelve monthly values are constants in `DATA` and the end label in `LABEL`; keep the headline under ~34 characters. It is a mood chart, not an exact one: no axis values. |
| `stat-count-wide` Wide numbers | 16:9 | data | 4.5 | Traction or results in a landscape film or a talk. Figures are the `stats` param, one "value | label" per line ("4.9/5", "3 min": the text after the number is its unit): keep three, labels under ~18 characters, values up to six digits. Digits sit in fixed slots, so numbers do not jitter while they count. |
| `bullet-points-wide` Morphing points | 16:9 | slides | 6 | Three to four short points for a talk, a pitch or a product walkthrough, one per line (each 1–3 words, under ~18 characters); a fifth point reuses the pill. The shapes read as write (a field), tune (a slider), pulse (a wave) and present (play), so order the points to match. |
| `chapter-title-wide` Chapter title | 16:9 | slides | 3.5 | Section divider for a talk, a course or a long demo: number 1–3 characters, title under ~28 characters, subtitle under ~50. Long titles shrink to fit. Neon or night reads best. |
| `quote-wide` Quote pill | 16:9 | slides | 5.5 | One-sentence quote or principle for a talk, a launch film or a testimonial: under ~60 characters reads on one line, up to ~120 wraps to two. Leave the quote marks out; the template adds them. Neon or night reads best. |
| `cta-endcard-wide` Website end card | 16:9 | end | 4.5 | Closing call to action of a landscape film or a talk: a headline under ~28 characters, an address under ~24 and a button label of 1–3 words. The QR pattern is a stand-in that does not scan: replace the modules in `qrCard()` with your real code image (load it in `setup`, draw it into the same square). |
| `logo-tagline-wide` Logo and tagline | 16:9 | end | 4 | Closing logo of a landscape film. Brand 1–2 words, tagline under ~40 characters. The mark is a fictional stand-in: redraw `markPath()` (a centre line, traced then filled) and `ribbon()` with your own logo, keeping the trace → fill → letters order. Night or neon reads best. |
| `push-transition-wide` Push transition | 16:9 | transition | 2.4 | Cut between two landscape shots. The pictures are stand-ins: draw the outgoing shot in `pictureA` and the incoming one in `pictureB` (each is already offset). With backdrop false only the light edge and its shade are drawn. Titles under ~30 characters; the template ends on picture B, so the next shot starts from it. |
<!-- catalog:end -->
