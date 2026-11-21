# How-to films: operate the product, film each step

A how-to film teaches one task in a product (create a client, send a quote, edit a card) as a short animation, one shot per step. It is delivered as one clip per step, for help centres, in-app hints, onboarding and slides, plus a full cut that plays the steps in order. The picture is a simplified redraw of the real UI built with the walkthrough kit ([product-walkthrough.md](product-walkthrough.md)), never a screen recording.

The difference from a product walkthrough is the capture: when the user asks for it and gives you a test account, you operate the product yourself with the agent's built-in browser or computer-use tool and capture every state. Without that, ask for screenshots and start at step 3.

## When to use it

Requests such as 操作教學動畫, 教學影片, 使用教學, 新手引導, 說明中心的動畫, "how-to video", "tutorial clips for our help centre", "show users how to do X". For a launch ad or a feature teaser, use [product-walkthrough.md](product-walkthrough.md) instead; for a 4–12 s loop of one action, [ui-stage.md](ui-stage.md).

## Deliverables

| Output | Spec | Where it is used |
| --- | --- | --- |
| One clip per step | 4–8 s, starts and ends on a still frame, MP4 (`share`) and WebM, small | In-app hints, help-centre articles, onboarding |
| Full cut | 45–90 s, 16:9 1080p, big numbered step titles ("1 建立客戶") | Website, slides, YouTube |
| Mobile cut (optional) | 9:16 1080 × 1920, finger taps, captions in the top third | App help, social |
| Step stills | One PNG per step, its result frame | Slides and documents |
| Captions | One line per step, in the brief's language | Muted playback, accessibility |

## Workflow

Two gates need the user's (or their client's) approval: the step script, and the screenshot | redraw sheet.

1. **Brief and step script.** Ask which tasks to teach, the steps of each (3–8), where the clips will live, aspect ratios, language, brand colours and the logo as SVG. Write `brief.md` and `capture/steps.json`: per step a title, the control it touches, the demo data typed, and the expected result. **Gate A:** the user approves the script and gives a test or demo account. Never use a production account with real customers.
2. **Operate and capture.** Only when the user asked you to operate the product and gave the account:
    - Use the agent's own tools, not a scripted browser: in Claude, the Claude app's built-in browser for web apps (`navigate`, `computer` clicks and typing, `screenshot`, `get_page_text` / `read_page`, `javascript_tool`) or computer use for desktop and mobile simulators; in Codex, its built-in browser or computer-use tool. The user signs in themselves; approve each site once when the browser asks.
    - Walk the script one step at a time. Screenshot every state the step passes through: empty, focus, typing, loading, result, success toast. Take each screenshot after the UI settles.
    - Read the exact labels, values and placeholders from the page text, not from the image. Read the tokens with a short script on the page: primary, ink, muted, borders, background, radius, font family. Save `capture/01.png…nn.png`, `capture/steps.json` (labels, values, URL per state) and `capture/tokens.json`.
    - Type only invented demo data (晨光設計, demo@example.com, 0912 000 000). Stop and ask before anything that pays, sends a message or email outside the product, deletes, invites people or changes permissions. When done, list what you created and offer to delete it.
3. **Check the capture.** Make a contact sheet of every state per step. Each step needs a before and an after; recapture missing or blurred states. Note text too small to read and ask for it.
4. **Redraw sheet.** Follow the simplified redraw in [product-walkthrough.md](product-walkthrough.md): per step the target, the context it needs, and everything else to drop; real labels and tokens; type at 1.3–1.6× the app's size. Render one still per step beside its screenshot. **Gate B:** the user approves what stays and what goes.
5. **Storyboard and timing.** One step per shot, 4–8 s each: settle 0.4 s, the action, the result held for the times in [taste.md](taste.md), settle 0.4 s. A shot must make sense alone, so it starts on its own card at rest and ends on its result at rest; the hand-off to the next card begins only after that still. Step title per shot ("1 建立客戶"), held 0.5 s + characters ÷ 4.5. Put every shot in the beat table and `meta.shots`, so the editor shows one layer per step and `npx mografy review` writes the shot sheet.
6. **Build.** `npx mografy add walkthrough <project>`; one card per step from the same kit parts, one action per card, the pressed control grows into the next card, a big cursor (or taps in 9:16), each card's local zoom pushes in on its control. Opener: brand plus the task name; ending: the result of the whole task plus the logo. Run `npx mografy check --motion` and `npx mografy review`, and look at every stop frame: it is the first and last frame of a clip.
7. **Export and split.** Export the full cut once (`--preset share` for the web, the user's own preset otherwise). Cut it into step clips at the beat table's shot starts and ends with the FFmpeg Mografy uses (`npx mografy setup ffmpeg --check` prints its path), re-encoding so every clip starts on its first frame:

    ```sh
    ffmpeg -ss <start> -to <end> -i renders/<film>.mp4 -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart -an renders/steps/01-<step>.mp4
    ```

    Name clips `NN-<step-slug>.mp4`, write the step stills from `npx mografy review`'s shot sheet times, and the captions as `renders/steps/captions.<lang>.srt`. Put everything in `renders/steps/` and list it for the user.

## When the product changes

A redesign touches some steps, not the film: recapture those steps (step 2), redraw them, and re-export. Keep each step's card in its own function so one step can change without moving the others; keep the beat table times when the new step fits the same length.

## Pitfalls

- A clip that starts mid-hand-off shows half of the previous card: keep the still frames at shot boundaries.
- Captured text in a screenshot is a guess; the page text is the truth. Re-read labels after the product's language setting changes.
- Popups, cookie banners and tours on first sign-in are not part of the task: dismiss them before capture, and leave them out of the redraw.
- Never show real customer data, a working share link, a real phone number or an API key in a capture you keep or a frame you render.
