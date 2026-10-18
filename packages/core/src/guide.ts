// The single source for project instructions and shared Claude/Codex skills.
const GUIDE_BODY = `# Mografy scene authoring guide

This folder is a Mografy project. Animation content lives only in scene modules (normally \`scenes/main.ts\`). \`mografy.json\` stores project settings; never put layers, keyframes, or animation data in it.

Run \`mografy dev\` to open the player. After a file change passes compilation and a real Chromium trial render, the player switches to the new version and stays at the same time.

## File format

A scene module exports \`meta\`, \`params\`, optional \`setup\`, and synchronous \`renderFrame\`:

\`\`\`ts
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
\`\`\`

## Landscape and portrait compositions

Read \`mografy.json.aspectRatio\` before planning or editing. It is \`"16:9"\` (landscape) or \`"9:16"\` (portrait); when absent, use the scene's \`meta.width / meta.height\`. This is canvas configuration only. The main player has no orientation switch: it previews the authored scene at its configured dimensions. Output orientation is chosen only in the Export dialog and never changes the project or the main preview.

When the user requests a future 9:16 video, explicitly record **9:16 portrait** in the brief before authoring. Treat this as the intended composition, not merely an export setting. Create the scene natively in portrait, tell the user that the preview follows the authored scene, and do not rely on fitting or cropping a landscape scene to satisfy a portrait brief. For a native social video, author \`meta = { width: 1080, height: 1920, ... }\` and set \`aspectRatio: "9:16"\` in the project. A landscape scene normally uses 1920 × 1080. The shared Runtime applies the saved aspect ratio to the logical canvas before setup and rendering, preserving the scene's short edge; both \`SetupContext\` and \`FrameContext\` receive the effective dimensions. Use \`ctx.width\` and \`ctx.height\`, never imported meta dimensions, for layout, backgrounds, clipping, and camera bounds. Branch with \`const portrait = ctx.height > ctx.width\` when the compositions differ. Stack portrait elements vertically, wrap copy to available width, and reposition the focal subject and subtitles. Do not rotate, stretch, or merely shrink a complete landscape shot into the portrait canvas. Fixed-coordinate scenes need a scene-code layout pass; an orientation toggle cannot infer their intended design.

For portrait social layouts, use conservative guides: leave about 8% above, 18% below, 6% on the left, and 12% on the right clear of critical copy and logos. Platform overlays vary; treat these as planning margins, not platform guarantees. Inspect at phone size, including long subtitles, entrances, exits, and transitions. If both outputs are requested, review both complete compositions and random seeks.

MP4 and WebM exports have landscape 1280 × 720 / 1920 × 1080 and portrait 720 × 1280 / 1080 × 1920 presets, selected with orientation icons. If output orientation differs from the authored scene, show Fit: \`contain\` (Fit entire scene, the default) or \`cover\` (Fill and crop). These fit the existing artwork without reauthoring the canvas. The dialog shows an actual paused-frame preview of the output. Choose \`reflow\` (Adapt layout) for deliberately responsive scenes, including all sixteen built-in components: it passes the output canvas dimensions to scene code so portrait sizes, card arrangements, and text wrapping adapt. It is not a player orientation control. Export overrides do not change the saved canvas. CLI: \`mografy export [project] --format mp4 --orientation portrait --resolution 1080p\` (or \`landscape\`); without overrides it uses the saved canvas and render scale. WebM uses VP9 video and optional Opus audio, with constant quality (CRF 32) by default; MP4 uses H.264/AAC. Use \`--format webm\` for WebM. Higher WebM CRF values produce smaller files with less detail. MP4 and VP9 CRF values are codec-specific. Both video formats support the same orientation, resolution, sampling, and output effects. Player, stills, thumbnails, review, and exports share the effective canvas and output effects.

## Required behavior

1. Treat \`renderFrame\` as a pure function of \`time\`, resolved params, and assets prepared by \`setup\`. Do not read a previous frame, accumulate module state, or read a clock. The player may seek in any order, and validation renders the same time twice to detect state leaks.
2. \`Math.random\`, \`Date.now\`, and \`performance.now\` throw inside \`renderFrame\`. Use \`ctx.noise(...coordinates)\` for order-independent seeded noise, or prepare values with \`ctx.random()\` inside \`setup\`.
3. The runtime resets and fills the canvas before every call. \`renderFrame\` must finish synchronously.
4. Import only files inside the project and \`@mografy/runtime\`.
5. Put fonts in \`assets/\`, list them in \`mografy.json\` under \`fonts\`, then select them with \`mografy.textFont('Family', 400)\`. Only loaded weights are reliable.
6. Express effect distances such as \`shadowBlur\`, shadow offsets, and filter pixels in logical units. The runtime scales them for output resolution. Use \`ctx.vignette(strength)\` for a canvas vignette.
7. Expose only important subtitles as \`type: 'string', role: 'subtitle'\` params. Titles, chat text, buttons, hints, code examples, and brand copy should stay in the scene for the AI to edit. Do not turn every string into an inspector field. Every color or numeric param must control a visible result. Do not add a dot grid unless the user explicitly asks for one.

## FrameContext

| Member | Purpose |
| --- | --- |
| \`ctx.draw\` | Common drawing API. Prefer \`const mografy = ctx.draw\`; methods may be destructured. |
| \`ctx.canvas\` | Native 2D context in logical coordinates. |
| \`ctx.width\`, \`ctx.height\` | Logical canvas dimensions. |
| \`ctx.noise(...n)\` | Seeded 0–1 noise independent of call order. |
| \`ctx.beat(time)\` | With audio: \`{ beat, bar, beatInBar, phase, period }\`; otherwise \`undefined\`. |
| \`ctx.shadow(color, blur, x?, y?)\`, \`ctx.blur(px)\`, \`ctx.vignette(strength)\` | Visual effects. |
| \`ctx.withCanvas(canvas => { ... })\` | Synchronous scope that restores native state and Mografy fill/stroke state, including after an error. |
| \`ctx.clip(path2d, () => { ... }, rule?)\` | Synchronous Path2D clipping scope; default rule is \`nonzero\`. |
| \`ctx.assets\` | Read-only assets prepared by \`setup\`. |
| \`ctx.seed\`, \`ctx.renderScale\` | Project seed and output scale. |

\`SetupContext\` provides \`ctx.random()\`, \`ctx.loadImage('assets/x.png')\`, \`ctx.assets\`, \`ctx.seed\`, \`ctx.width\`, and \`ctx.height\`.

Time helpers: \`pr(time, start, end)\` maps a time range to 0–1; \`lerp(a, b, p)\`; \`ease.linear / inQuad / outCubic / inOutCubic / outExpo\`; \`clamp\`; \`colorLerp(a, b, p, 'srgb' | 'linear')\`; \`hashNoise(seed, ...n)\`.

## Drawing API

\`ctx.draw\` is a thin layer over the native Canvas context. Both APIs share styles, transforms, clipping, and resolution scaling. It is not a p5.js compatibility layer and does not create a draw loop.

| Function | Behavior |
| --- | --- |
| \`fill(color)\`, \`noFill()\` | Set and enable or disable fill. A color may be a CSS color, CanvasGradient, or CanvasPattern. |
| \`stroke(color)\`, \`noStroke()\` | Set and enable or disable stroke. |
| \`strokeWeight(px)\`, \`strokeCap(value)\`, \`strokeJoin(value)\` | Logical line width and native cap/join values. |
| \`opacity(0..1)\` | Set current alpha, clamped to 0–1. It does not multiply the previous value. |
| \`push()\`, \`pop()\` | Save and restore native state plus Mografy fill/stroke state. Keep pairs balanced. |
| \`translate(x,y)\`, \`rotate(radians)\`, \`scale(x,y?)\` | Transform the coordinate system; omitted \`y\` means uniform scale. |
| \`rect(x,y,w,h,radius?)\` | Top-left coordinates, with an optional uniform corner radius. |
| \`circle(x,y,diameter)\`, \`ellipse(x,y,w,h)\` | Center coordinates; circles use diameter. |
| \`arc(x,y,w,h,start,end)\` | Center, size, and radians. An open arc closes implicitly only when filled. |
| \`line(x1,y1,x2,y2)\` | Uses the active stroke. |
| \`triangle(...)\`, \`path(path2d,rule?)\` | Fill and/or stroke. Path fill rule defaults to \`nonzero\`. |
| \`textFont(family,weight?)\`, \`textSize(px)\` | Select loaded type and logical font size. |
| \`textAlign(align,baseline?)\` | Native horizontal alignment and baseline. |
| \`text(value,x,y,maxWidth?)\`, \`textWidth(value)\` | Draw or measure text. \`maxWidth\` condenses a line; it does not wrap. |
| \`image(source,x,y,w?,h?)\` | Draw at top-left; provide both width and height or neither. |
| \`background(color)\` | Clear and repaint the logical canvas while preserving state. It still respects the current clip. |

At the start of every frame, fill is enabled and stroke is disabled. Call \`fill\` and \`stroke\` explicitly. Use \`ctx.canvas\` for gradients, multiline layout, batched paths, and complex clipping. Do not cross-pair \`mografy.push()\` with \`canvas.restore()\`.

\`\`\`ts
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
\`\`\`

## Built-in scene components

New projects include \`scenes/components.ts\`, \`scenes/social-components.ts\`, and \`scenes/showcase.ts\`. Component functions are pure time functions that can be copied or edited; they do not add global runtime animation state.

| Component | Additional options |
| --- | --- |
| \`staggerText\` | text,x,y,size?,color?,font?,start?,duration?,stagger?,lift? |
| \`typewriter\` | text,x,y,size?,color?,font?,start?,duration?,caret? |
| \`popCard\` | x,y,width,height,color?,radius?,start?,duration?,content?(ctx) |
| \`progressBar\` | x,y,width,height?,target?,color?,track?,start?,duration? |
| \`pulseDots\` | x,y,color?,diameter?,spacing?,period?,start? |
| \`logoReveal\` | x,y,color?,ink?,width?,start?,duration? |
| \`socialCard\` | x,y,color?,start?,name?,avatar?,caption? |
| \`youtubeSubscribe\` | x,y,color?,start?,label?,subscribed? |
| \`aiChat\` | x,y,color?,start?,prompt?,reply?,avatar? |
| \`likeBurst\` | x,y,color?,start? |
| \`followBadge\` | x,y,color?,start?,name?,avatar?,label?,following? |
| \`notificationToast\` | x,y,color?,start?,message? |
| \`lowerThird\` | x,y,color?,start?,name?,subtitle? |
| \`countUp\` | x,y,color?,start?,value? |
| \`toggleSwitch\` | x,y,color?,start? |
| \`audioWave\` | x,y,color?,start?,bars? (3–40) |

## Edit and visual-review workflow

1. Read \`mografy.json\`, the configured scene entry, and every local module it imports. Preserve the scene's existing visual language unless the user asks for a redesign.
2. Edit scene source files directly. Keep animation data out of \`mografy.json\`; use it only for project, parameter, font, audio, render, and review settings.
3. Run \`mografy check [project]\`. This compiles the scene and trial-renders it in real Chromium. Fix every reported error before judging the design.
4. Run \`mografy review [project]\`. Inspect every generated PNG in \`renders/\`, including raw stills, output frames, and transition strips. Do not approve a scene from source code or a successful build alone.
5. Judge the images for clipping, overlap, safe margins, legibility, hierarchy, spacing, contrast, consistent easing, transition continuity, and whether each important message stays visible long enough. Review the beginning, end, configured key times, and dense transition intervals. Check both raw stills and final output frames when glow, grain, or motion sampling is used.
6. Iterate on the scene and repeat check plus review until the visual problems are resolved. Use \`mografy dev [project]\` when the user should watch the live result.
7. Export with \`mografy export [project] --format mp4|webm|lottie|svga\`. The command prints capture and encoding or packaging progress and writes the finished file under \`renders/\`. Press Ctrl+C to cancel a CLI export. When \`mografy dev\` is running, player exports also print progress in that terminal and can be stopped with \`mografy export [project] --cancel\`.

Only important subtitles belong in \`role: 'subtitle'\` params. Let the user edit those in Scene → Subtitles; make other copy changes in source when requested.

## Motion direction

- Show a meaningful element within the first 0.3 seconds.
- Keep important text visible for at least roughly \`character count / 4 + 1\` seconds.
- Prefer \`ease.outExpo\` or \`ease.outCubic\` for entrances and \`ease.inOutCubic\` for exits.
- Use a consistent curve for related elements and fixed 0.05–0.08 second intervals for a text stagger.
- Preserve whitespace and keep one dominant moving focus at a time.
- With music, align major changes to bar starts from \`ctx.beat(time)\` when appropriate.
`;

const LEGACY_SKILL = `---
name: mografy
description: Create, edit, validate, visually review, and export Mografy Canvas scene projects. Use when a folder contains mografy.json or the user asks to build or change a Mografy animation.
---

${GUIDE_BODY}`;

/** Exact matches only: custom instructions, including edited generated files, survive upgrades. */
export function isLegacyAgentFile(contents: string, kind: 'guide' | 'skill', repository?: string) {
  const cancellation = ' Press Ctrl+C to cancel a CLI export. When `mografy dev` is running, player exports also print progress in that terminal and can be stopped with `mografy export [project] --cancel`.';
  const previous = kind === 'guide' ? GUIDE_BODY : LEGACY_SKILL;
  return contents === previous || contents === previous.replace(cancellation, '') ||
    contents === (kind === 'guide' ? LEGACY_PROJECT_GUIDE : LEGACY_REPOSITORY_SKILL) ||
    (kind === 'guide' && contents === LEGACY_USER_SCOPE_GUIDE) ||
    (kind === 'guide' && repository !== undefined && contents === legacySharedProjectGuide(repository)) ||
    (kind === 'guide' && (isPreviousProjectPointer(contents) || contents === projectGuide().replaceAll('mp4|webm|lottie|svga', 'mp4|lottie|svga')));
}

const STORYBOARD = `# Storyboard planning for Mografy

Read this reference when asked for a storyboard, shot list, or a new animation that needs shot planning. Read the project's scene entry, imported modules, assets, and settings first. Reuse its visual language, dimensions, fonts, palette, and existing characters or brand assets. Write planning documents, shot labels, and tool prompts in English; preserve supplied dialogue and artwork unless translation or redesign is requested.

For a portrait brief, explicitly label the written plan and every image-generation prompt as **9:16 portrait**, and draw each storyboard panel as a tall 9:16 frame. Read the saved \`aspectRatio\`; design a vertical composition with stacked content, wrapped copy, and social safe margins. A landscape storyboard cropped into tall panels is not a portrait plan. When both ratios are needed, specify the layout changes for each shot and verify both versions against actual frames.

## Deliverables

Save a project-specific plan as \`storyboards/storyboard.md\`. Include the audience, message, aspect ratio, total duration, visual direction, asset inventory, and assumptions. Use one row per shot:

| Shot | Time (seconds) | Purpose | Composition and assets | Action and poses | Camera | Copy / audio | Transition | Principles | Review times |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | 0.0–2.0 | Introduce the mark | Existing logo, centered, generous margins | Anticipation at 0.15; reveal at 0.4; settle by 1.1; hold | Static | Brief logo sound; no copy | Match logo position into S02 | Staging, anticipation, slow in/out | 0.15, 0.4, 1.1, 1.9 |

Number shots in order; make time ranges contiguous and cover the requested duration. Specify entrance, action, settle, hold, and exit where useful. Describe start, extreme, and settle poses rather than writing vague directions such as "make it dynamic." Give each shot a clear focal point and connect transitions through position, color, shape, or meaning. Allow enough reading time for the actual copy; lengthen a shot or shorten copy when the timing is unrealistic.

Link each shot to existing or proposed scene functions and name the assets it needs. Mark missing assets and assumptions clearly. Keep shot descriptions and visual references out of \`mografy.json\`; only review times and transition sampling settings belong in its existing review fields. A storyboard is a planning document, not a runtime format.

## Visual output by host

### Codex: image generation

When creating a storyboard in Codex, invoke the host's available image-generation tool to produce a storyboard contact sheet or individual key poses. Follow its image-generation skill when available. Supply project artwork as references for edits or identity continuity. Describe panel count, aspect ratio, ordered shot IDs, consistent palette and framing, key poses, and the action between panels. Match the board to the written shot list. Keep exact copy and timings in Markdown because generated image labels can be unreliable. Inspect generated panels for identity, composition, cropping, and consistency, then link the result from \`storyboards/storyboard.md\`; save a local copy under \`storyboards/\` when the host exposes one.

Generated panels are conceptual references. They do not prove that the implemented animation renders correctly. If image generation is unavailable, say so and provide the complete written plan plus ready-to-run English image prompts; never claim images were generated.

### Claude: Artifacts

When creating a storyboard in a Claude host with Artifacts, invoke its Artifact capability to present the same plan as an HTML storyboard. Use responsive shot cards with shot ID, time range, Canvas-drawn key poses or existing raster assets, action, transition, and motion notes. Use ordinary HTML/CSS and Canvas; do not add GSAP, SVG scene layers, or resvg. An optional playhead or shot selector may illustrate timing, but label it as a storyboard preview. Keep the artifact self-contained and avoid remote dependencies. Also save the English shot list to the project so Codex can continue from it.

Claude Code environments may not expose Artifacts. Check tool availability; if absent, save \`storyboards/storyboard.html\` as a standalone local preview and report that fallback. Do not claim to have opened a Claude Artifact. The HTML storyboard is separate from the Mografy scene and is never imported by the Server.

## From storyboard to animation

Read [animation-principles.md](animation-principles.md) to choose motion that supports each shot. A storyboard-only request ends with the written and visual board. If implementation is also requested, continue into scene modules without inventing an approval step. Use analytic functions of \`time\` for all poses, camera transforms, secondary motion, and transitions. Validate using \`mografy check\`, then \`mografy review\`; inspect real raw and output frames at the shot's poses, holds, boundaries, and transition intervals against the storyboard. Update the plan if implementation changes timing or composition.
`;

const ANIMATION_PRINCIPLES = `# The twelve principles of animation in Mografy

Use these principles to give movement weight, intention, and personality. Choose the ones that support the scene; do not force all twelve into every shot or add perpetual motion to readable holds. Record the chosen principles and their purpose in the storyboard. Preserve existing typography, logos, and character identity.

| Principle | Application in a Canvas scene | Review criterion |
| --- | --- | --- |
| 1. Squash and stretch | Deform a soft object around its contact or pivot point. Use reciprocal scale factors (sx = s, sy = 1/s) to approximately preserve area. Keep logos and text rigid unless deformation suits the brief. | The object conveys weight without unintended distortion. |
| 2. Anticipation | Add a small opposite move, compression, or brief pause before the main action. Evaluate each phase from absolute time. | The viewer can predict what will happen without a distracting delay. |
| 3. Staging | Use composition, contrast, negative space, and one dominant moving focus. Position secondary objects to support that focus. | The message is clear at key poses and throughout transitions. |
| 4. Straight ahead action and pose to pose | Plan start, extreme, and settle poses; interpolate between them. For organic straight-ahead exploration, precompute seeded samples in setup and index/interpolate them by time. Never integrate from the previous rendered frame. | Random seeks and repeat renders preserve exactly the same pose. |
| 5. Follow through and overlapping action | Let a tail, ribbon, or supporting element settle after the main body. Use delayed time windows or bounded damped oscillation with a defined start. | Parts share a cause but stop at different times; motion ends cleanly. |
| 6. Slow in and slow out | Use ease.outCubic/outExpo for entrances and ease.inOutCubic for shared transitions where appropriate. Vary spacing to communicate acceleration and deceleration. | Speed changes feel intentional; related elements use coherent curves. |
| 7. Arcs | Move subjects along analytic curved paths, such as quadratic Bezier positions or a bounded sine arc. Let rotation follow the tangent when useful. | Motion has a coherent path and clears safe margins. |
| 8. Secondary action | Add a restrained blink, tilt, highlight, or small response that supports the primary action. Offset its timing and amplitude. | It reinforces emotion or meaning without competing with the main message. |
| 9. Timing | Allocate anticipation, action, settle, reading hold, and exit in seconds. Use fps to judge frame spacing and ctx.beat(time) for musical cues when audio exists. | Weight, pacing, legibility, and beat alignment work at the requested fps. |
| 10. Exaggeration | Selectively amplify a pose, trajectory, contrast, or overshoot to make the intent readable. Keep amplitudes adjustable and bounded. | The action is expressive without clipping or harming brand recognition. |
| 11. Solid drawing | Keep pivots, proportions, perspective, overlap, and volume coherent with Canvas transforms, gradients, and consistent lighting. For flat graphics, maintain optical balance and silhouette. | Forms stay believable while moving, scaling, and overlapping. |
| 12. Appeal | Build clear silhouettes, harmonious proportions, distinct pose rhythms, and a consistent palette. Use deliberate asymmetry when it adds character. | The scene feels intentional and engaging, with useful visual hierarchy. |

## Deterministic follow-through example

This function models a bounded settle after a main action. Both calls for the same time return the same value, regardless of seek order:

\`\`\`ts
function settle(time: number, start: number, duration: number, amplitude: number) {
  if (time <= start || time >= start + duration) return 0;
  const u = (time - start) / duration;
  return amplitude * Math.sin(u * Math.PI * 4) * Math.exp(-6 * u) * (1 - u) ** 2;
}
// Evaluate inside renderFrame: a ribbon may lag behind the main object's arrival.
const ribbonAngle = settle(time, 0.8, 1.2, 0.12);
\`\`\`

Store motion only in scene modules. Do not add a live physics loop, unseeded randomness, a clock, or previous-frame state. Read [scene-authoring.md](scene-authoring.md) for the runtime and drawing contract.

Review the start, extreme, settle, and final hold of each action, plus dense transition strips. Check repeated and out-of-order times with \`mografy check\`, and inspect both raw and post-processed frames with \`mografy review\`. When motion sampling, glow, or grain hides a pose or blurs important text, adjust the motion or output settings and review again.
`;

const BUILTIN_COMPONENTS_REFERENCE = `# Built-in component references

The sixteen built-in animations are working scene references for authoring and storyboards. Read the relevant scene entry and its imported modules before reusing a pattern. Paths below refer to the owning Mografy repository in [project.md](project.md). For an existing user project, inspect its local copies first; they may have been customized.

## Source catalog

The reusable implementations live in [components.ts](__REPOSITORY__/packages/server/template/scenes/components.ts) and [social-components.ts](__REPOSITORY__/packages/server/template/scenes/social-components.ts). Each animation has a complete entry under \`packages/server/template/scenes/\`:

| Component | Entry | Function | Authoring reference |
| --- | --- | --- | --- |
| Stagger text | [stagger-text.ts](__REPOSITORY__/packages/server/template/scenes/stagger-text.ts) | \`staggerText\` | Measured letters rise with staggered opacity and easing. |
| Typewriter | [typewriter.ts](__REPOSITORY__/packages/server/template/scenes/typewriter.ts) | \`typewriter\` | Character reveal and a caret computed from time. |
| Pop card | [pop-card.ts](__REPOSITORY__/packages/server/template/scenes/pop-card.ts) | \`popCard\` | Lift, scale, opacity, and local content drawing. |
| Progress bar | [progress-bar.ts](__REPOSITORY__/packages/server/template/scenes/progress-bar.ts) | \`progressBar\` | Eased progress clipped inside a rounded track. |
| Pulse dots | [pulse-dots.ts](__REPOSITORY__/packages/server/template/scenes/pulse-dots.ts) | \`pulseDots\` | Phase-offset loading motion from absolute time. |
| Logo reveal | [logo-reveal.ts](__REPOSITORY__/packages/server/template/scenes/logo-reveal.ts) | \`logoReveal\` | Staged reveal of original Mografy Path2D artwork. |
| Social card | [social-card.ts](__REPOSITORY__/packages/server/template/scenes/social-card.ts) | \`socialCard\` | A profile card with avatar, text, and a composed entrance. |
| YouTube subscribe | [youtube-subscribe.ts](__REPOSITORY__/packages/server/template/scenes/youtube-subscribe.ts) | \`youtubeSubscribe\` | A button interaction with cursor and subscribed state. |
| AI chat | [ai-chat.ts](__REPOSITORY__/packages/server/template/scenes/ai-chat.ts) | \`aiChat\` | Timed prompt/reply bubbles and text reveal. |
| Like burst | [like-burst.ts](__REPOSITORY__/packages/server/template/scenes/like-burst.ts) | \`likeBurst\` | An expressive heart response with radial secondary motion. |
| Follow badge | [follow-badge.ts](__REPOSITORY__/packages/server/template/scenes/follow-badge.ts) | \`followBadge\` | Profile identity and a follow-state transition. |
| Notification toast | [notification-toast.ts](__REPOSITORY__/packages/server/template/scenes/notification-toast.ts) | \`notificationToast\` | A compact status message with staged reveal. |
| Lower third | [lower-third.ts](__REPOSITORY__/packages/server/template/scenes/lower-third.ts) | \`lowerThird\` | A clipped title/subtitle reveal and clear hierarchy. |
| Count up | [count-up.ts](__REPOSITORY__/packages/server/template/scenes/count-up.ts) | \`countUp\` | A deterministic numeric value transition. |
| Toggle switch | [toggle-switch.ts](__REPOSITORY__/packages/server/template/scenes/toggle-switch.ts) | \`toggleSwitch\` | Coordinated knob position, track color, and cursor response. |
| Audio wave | [audio-wave.ts](__REPOSITORY__/packages/server/template/scenes/audio-wave.ts) | \`audioWave\` | A procedural wave of bars; actual audio-reactive motion needs scene-specific audio or beat input. |

[component-frame.ts](__REPOSITORY__/packages/server/template/scenes/component-frame.ts) supplies the shared 1920 × 1080, eight-second, 30fps scene contract, font selection, speed control, and drawing scopes. \`componentFrame\` evaluates \`time * speed % 4\`; account for that four-second reset before changing timing. \`centeredComponent\` retains the landscape design-space transform and uses component-specific widths around the exact canvas center in portrait. Installed built-in projects and their bundled thumbnails default to 9:16 portrait. All sixteen entries support both landscape and portrait canvases. Follow badges stack vertically; chat, notification, profile, and lower-third copy use measured wrapping or bounded single lines. Dots and bar thickness use the short edge to preserve spacing and proportions. Select Adapt layout when exporting to the other orientation. [brand-logo.ts](__REPOSITORY__/packages/server/template/scenes/brand-logo.ts) supplies the original mark geometry. [showcase.ts](__REPOSITORY__/packages/server/template/scenes/showcase.ts) demonstrates composition of all sixteen motifs.

## Reuse in a project

- The source library is \`packages/server/template/\`; editable installed copies are under the configured library's \`.components/{id}/\`. When running from source, the default library is \`projects/\`. Read \`scenes/main.ts\` and the manifest of the selected installed project rather than assuming it is identical to the template.
- New projects receive the component modules and scene entries. Import the needed function from the project's local \`scenes/components.ts\` or \`scenes/social-components.ts\`. Preserve required imports, including brand geometry. Do not import files outside the animation project; compilation allows project-local modules and \`@mografy/runtime\` only.
- Copy the useful motion and composition into the selected project's own scene modules. Adapt layout, copy, palette, scale, and timing to its brief. Keep pure time evaluation and isolated Canvas state; retain the project's existing assets and visual identity.
- Use these examples to choose a motif in the storyboard and connect it to a concrete scene function. For a longer sequence with transitions and a brand ending, read [intro.md](intro.md).
- Optional extras are not installed with Mografy; installation contains only the sixteen built-in components. They live in the repository's [extras/](__REPOSITORY__/extras/) folder on GitHub and are copied into a project when a brief needs them: camera moves and transitions for film-style sequences ([camera-transitions.md](camera-transitions.md)) and Chinese / Japanese typography with OFL fonts ([cjk-typography.md](cjk-typography.md)).
- Keep important subtitle params distinct from ordinary scene copy. The source entries may contain string params that are edited by an agent in source rather than shown in the subtitle inspector.

## Review

Open an installed example with \`mografy dev [project]\`. After adapting it, run \`mografy check [project]\` and \`mografy review [project]\`; inspect actual frames at the entrance, extreme, settle, hold, and any loop reset. Verify text measurement, safe margins, clipping, contrast, and out-of-order seeking. The catalog is a source reference, not an acceptance result for a modified scene. Read [scene-authoring.md](scene-authoring.md) and [animation-principles.md](animation-principles.md) for the contract and motion direction.
`;

const CAMERA_TRANSITIONS_REFERENCE = `# Camera, transition and atmosphere helpers

[cinema.ts](__REPOSITORY__/extras/cinema/cinema.ts) gives film-style scenes a shared vocabulary. Every helper is a pure function of time and options, uses \`ctx.width\` / \`ctx.height\`, and works in landscape and portrait. [cinema-demo.ts](__REPOSITORY__/extras/cinema/cinema-demo.ts) is a fourteen-second tour of six shots joined by six transitions.

## Add to a project

The helpers are an optional extra, not part of the installed template. If the project already has \`scenes/cinema.ts\`, read and reuse that local copy; it may have been customized. Otherwise copy \`extras/cinema/cinema.ts\` from the current Mografy checkout into the project's \`scenes/\` folder, or download it from GitHub:

\`\`\`sh
curl -fsSL -o scenes/cinema.ts https://raw.githubusercontent.com/zz41354899/mografy/main/extras/cinema/cinema.ts
\`\`\`

Import it locally (\`import { plate, move, particleWipe } from './cinema.js'\`). Copy \`cinema-demo.ts\` too only when the user wants the tour.

## Plates and camera

| Helper | Use |
| --- | --- |
| \`preparePlate(ctx, path, softWidth?)\` | In \`setup\`: load an image and prepare a blurred highlights copy for bloom. Store the result in \`ctx.assets\`. |
| \`plate(ctx, plate, camera, { crop?, alpha?, bloom? })\` | Draw a plate covering the canvas. \`crop\` selects a source rectangle for a close-up. |
| \`move(time, start, end, from, to, curve?)\` | Ease between two framings. A camera is \`{ zoom, focusX, focusY, panX, panY }\`; \`zoom ≥ 1\` scales about the focus (0–1 of the canvas); pans are canvas pixels. |

Camera direction: give each shot one motivated move (push in, pull out, pan, tilt) with \`ease.inOutCubic\` or \`ease.outCubic\`. Keep zoom ranges small (for example 1.0 → 1.08 over three or four seconds). Pans are clamped to the image, so add zoom headroom before panning. Avoid roll, shake, and bounce unless the brief asks for energy; natural camera work reads as one continuous, decelerating move. Flat key art cannot blink or move limbs; motion comes from camera, light, particles, and type.

## Transitions

Each transition takes \`{ start, end, from, to }\`. \`from\` and \`to\` are callbacks that draw complete frames; the transition calls them inside clips and transforms. Before \`start\` it draws \`from\`, after \`end\` it draws \`to\`. Clamp each callback's time to its own shot, for example \`from: () => shotA(ctx, Math.min(time, cut))\`, so the outgoing shot does not continue past its end.

| Helper | Effect | Good for |
| --- | --- | --- |
| \`crossfade\` | Dissolve | Quiet changes, a breath between sections. |
| \`dipTo({ color })\` | Fade through a colour, cut at the midpoint | Section changes; a dip to dark when the music drops. |
| \`flash(ctx, time, at, { strength, decay })\` | Exposure flash overlay (draw after the frame) | Downbeats and hard cuts. |
| \`iris({ x, y })\` | A circle opens from a point with a glowing rim | Moving from a motif (a moon, an eye, a logo) into the next shot. |
| \`slash({ slant })\` | A slanted light band wipes across | Bright, energetic cuts. |
| \`whip({ direction })\` | Both shots travel together with motion smear | Implied camera movement, for example tilting from a face to the feet. |
| \`particleWipe({ direction, shape, count, color })\` | A gust of growing petals, stars, circles or hearts becomes windows onto the next shot | Sakura-style transitions and themed changes. |

Keep transitions between roughly 0.3 and 0.8 seconds. Place the cut on a beat or bar with \`ctx.beat(time)\` when the project has audio. Use two or three transition types per film; repeating one signature transition (such as \`particleWipe\`) ties a piece together better than using every type.

## Atmosphere

| Helper | Use |
| --- | --- |
| \`glow(ctx, x, y, radius, color, alpha)\` | Soft screen-mode light, for a moon halo or stage light. |
| \`drift(ctx, time, { shape, count, amount, wind, fall, size, color })\` | Wrapping particles: falling sakura, snow, or sparks. |
| \`twinkle(ctx, time, { area, count, size, color })\` | Four-point stars that twinkle independently. |
| \`lightSweep(ctx, time, { start, end, width, slant, alpha })\` | One slanted sheet of light crossing the frame. |
| \`smear(ctx, amount, axis)\` | Brief directional motion smear of the current frame. |

## Review

Add each transition window to \`review.transitions\` in \`mografy.json\` with a small step (0.033–0.05 s) and inspect the strips. Check that clamped shots do not jump at the cut, that particle rims fade before shapes grow large, that flashes do not wash out type, and that the frame never shows an image edge during a move.
`;

const CJK_TYPOGRAPHY_REFERENCE = `# Chinese and Japanese typography

[cjk.ts](__REPOSITORY__/extras/cjk/cjk.ts) sets Chinese and Japanese copy: vertical text (tategaki) and horizontal text with CJK line breaking. [cjk-demo.ts](__REPOSITORY__/extras/cjk/cjk-demo.ts) shows both.

## Add to a project

The module and fonts are an optional extra, not part of the installed template. If the project already has \`scenes/cjk.ts\`, read and reuse that local copy. Otherwise copy from the current Mografy checkout (\`extras/cjk/\`) or download from GitHub:

\`\`\`sh
curl -fsSL -o scenes/cjk.ts https://raw.githubusercontent.com/zz41354899/mografy/main/extras/cjk/cjk.ts
curl -fsSL -o assets/NotoSansCJKtc-Medium-subset.otf https://raw.githubusercontent.com/zz41354899/mografy/main/extras/cjk/fonts/NotoSansCJKtc-Medium-subset.otf
curl -fsSL -o assets/NotoSerifCJKtc-Bold-subset.otf https://raw.githubusercontent.com/zz41354899/mografy/main/extras/cjk/fonts/NotoSerifCJKtc-Bold-subset.otf
curl -fsSL -o assets/OFL-NotoCJK.txt https://raw.githubusercontent.com/zz41354899/mografy/main/extras/cjk/fonts/OFL.txt
\`\`\`

Copy only the font the design uses when one is enough. Keep the licence file with the fonts.

## Fonts

The repository provides two OFL-licensed subsets in [extras/cjk/fonts/](__REPOSITORY__/extras/cjk/fonts/): \`NotoSansCJKtc-Medium-subset.otf\` (family \`Noto Sans CJK TC\`, weight 500) and \`NotoSerifCJKtc-Bold-subset.otf\` (family \`Noto Serif CJK TC\`, weight 700). They cover ASCII, kana, CJK punctuation, full-width and vertical presentation forms, 5,401 common Traditional Chinese characters (Big5 level 1), 6,355 Japanese kanji (JIS levels 1–2), and 3,755 Simplified characters (GB2312 level 1). Together they are about 9.5 MB, so they are fetched per project rather than installed. After copying, register them in \`mografy.json\`:

\`\`\`json
"fonts": [
  { "family": "Noto Sans CJK TC", "path": "assets/NotoSansCJKtc-Medium-subset.otf", "weight": 500 },
  { "family": "Noto Serif CJK TC", "path": "assets/NotoSerifCJKtc-Bold-subset.otf", "weight": 700 }
]
\`\`\`

Use the exported \`CJK_SANS\` and \`CJK_SERIF\` names with the registered weights. Without registration, the browser falls back to system fonts, so previews may differ between computers and exports. Serif (Mincho / Song) suits titles, poetry and Japanese PV copy; Sans suits subtitles and UI. For a character outside the subsets, or JP / SC / KR glyph forms, regenerate a subset with [subset-cjk-fonts.py](__REPOSITORY__/extras/cjk/subset-cjk-fonts.py) from the [Noto CJK](https://github.com/notofonts/noto-cjk) sources (\`--extra\` adds characters). Check unusual names and rare characters in actual frames.

## Vertical text

\`verticalText(ctx, time, { text, x, y, size, columnHeight?, tracking?, columnGap?, font?, weight?, color?, glow?, outline?, start?, stagger?, duration?, lift?, end?, out? })\` draws columns top to bottom and right to left. \`x\` is the centre of the first (rightmost) column, \`y\` its top. \`columnHeight\` wraps automatically; \`\\n\` starts a new column. It returns the layout (\`glyphs\`, \`columns\`, \`width\`, \`height\`) for placing rules or ornaments; \`verticalLayout\` returns the same without drawing.

Canvas has no vertical writing mode, so the helper:

- swaps punctuation and brackets for Unicode vertical presentation forms (、。，：；！？「」『』（）【】《》〈〉…);
- rotates long marks and dashes (ー, 〜, ―) and single Latin letters by 90°;
- nudges small kana (っ, ゃ, ョ…) toward the upper right of their cell;
- sets one or two consecutive digits horizontally in one cell (tate-chu-yoko), for dates such as 10月17日;
- applies kinsoku when wrapping: closing punctuation, small kana and ー never start a column, and opening brackets never end one.

Longer Latin words read poorly in vertical copy; prefer a separate horizontal label.

## Horizontal text

\`cjkText(ctx, time, { text, x, y, size, maxWidth?, lineHeight?, tracking?, align?, ... })\` wraps with the same kinsoku rules while keeping Latin words and numbers whole, then reveals characters with the shared stagger options. \`wrapCJK\` returns the lines without drawing, for layout. \`y\` is the first baseline; lines advance by \`size * lineHeight\` (default 1.5).

## Direction

- Keep important copy visible for at least about \`characters / 4 + 1\` seconds; CJK characters carry more meaning per glyph than Latin letters, so long lines need longer holds.
- Use \`stagger\` of 0.04–0.08 s for titles and 0.015–0.03 s for longer captions.
- On bright or busy images, add a dark gradient scrim or \`outline\` (about 0.1 × size) rather than relying on glow alone.
- In portrait, wrap captions to the social safe area and shorten columns with \`columnHeight\`.
- Expose only important subtitles as \`role: 'subtitle'\` params; editable copy must stay within the font subset.

## Review

Inspect actual frames: punctuation position in columns, wrapped column starts, digit pairs, long-mark rotation, glyph fallback (a different-looking character usually means it is missing from the subset), contrast, and reading time.
`;

const INTRO_REFERENCE = `# Mografy intro reference

Use the existing intro as a reference for multi-shot storytelling, deterministic transitions, responsive text layout, and a branded ending. Read [the project settings](__REPOSITORY__/examples/mografy-intro/mografy.json), [scenes/main.ts](__REPOSITORY__/examples/mografy-intro/scenes/main.ts), and [scenes/logo.ts](__REPOSITORY__/examples/mografy-intro/scenes/logo.ts) before adapting it. The current source is a 1920 × 1080, twelve-second, 30fps Canvas scene on a paper-colored background with ink and teal accents.

## Four implemented beats

| Beat | Active source window | Function | What to learn |
| --- | --- | --- | --- |
| Code becomes an idea | 0.1–2.6 seconds | \`beatCode\` | Measured colored text segments, time-based typing/caret, and a caption. |
| Playback and scrubbing | 2.4–6.9 seconds | \`beatScrub\` | A preview frame, playhead, and reverse scrubbing derived from the same absolute time. |
| An external edit updates the player | 6.8–9.9 seconds | \`beatChat\` | Stable wrapping before typing, a reply, color/timing change, and an update toast. |
| Brand ending | 9.85–12 seconds | \`beatLogo\` | Original logo pieces revealed with clipping, staggered wordmark letters, and a closing tagline. |

The active windows overlap deliberately during transitions. They describe this implementation rather than a mandatory storyboard schedule. \`renderFrame\` calls all four beat functions; each derives visibility and motion from time. \`window_\` combines entrance and exit curves, and \`revealPiece\` clips the original logo paths. Read the real source when deciding the pose or overlap at a particular instant.

## Assets and copy

- ABeeZee Regular is loaded through \`mografy.json\`; keep its bundled \`assets/OFL.txt\` when copying the font. The scene uses Canvas text measurement and \`wrap\` to fit longer copy.
- The existing music file is \`assets/intro-music.mp3\`, with a 120 BPM grid, offset −0.1 seconds, four beats per bar, and gain 1. The logo entrance starts around the 9.9-second cue. Preserve the asset and settings when adapting this specific project unless the brief requests a change.
- The five subtitle params are \`codeCaption\`, \`playCaption\`, \`scrubCaption\`, \`chatCaption\`, and \`tagline\`. \`request\` is ordinary scene copy. \`accent\`, \`ink\`, and \`vignette\` affect the image.
- The current film's text mentions Claude. Read the exact scene copy before describing or translating it. For a new brief, adapt the script deliberately; the product workflow also supports Codex.

## Apply the reference

Use its sequence structure to plan setup, demonstration, change, and payoff. Retain relevant motion principles, clear focal points, readable holds, and continuity between shots. Reuse the technique in the selected project's own scene modules, with its assets and proportions. For small reusable motifs, read [built-in-components.md](built-in-components.md).

Save a project-specific English storyboard under \`storyboards/\` when requested, following [storyboard.md](storyboard.md). Codex creates visual boards with image generation; Claude uses Artifacts or a standalone local HTML/Canvas preview. A new storyboard may require longer text holds than this existing twelve-second film.

## Validation and review

From the owning repository, use:

\`\`\`sh
mografy dev examples/mografy-intro
mografy check examples/mografy-intro
mografy review examples/mografy-intro
\`\`\`

The existing review times are 1.8, 3.6, 5.4, 8.9, and 11.8 seconds. Transition strips cover 2.0–3.2, 8.4–9.4, and 9.8–11.4 seconds at 0.1-second steps. Inspect the generated PNGs, including output frames with sampling or effects. Validate repeat and random seeks, caption layout, chat-bubble stability, logo identity, and the final hold. Export only when requested, using \`mografy export examples/mografy-intro --format mp4|webm|lottie|svga\`.
`;

const VIDEO_COMPRESSION_REFERENCE = `# Compress an exported video

Use this workflow when a finished render is too large to upload or share, or when the user requests a smaller video. Work from the actual exported video (normally in the project's \`renders/\` folder). Scene edits, a new render, and a storyboard are unnecessary for compression alone. This helper outputs H.264 MP4; it does not compress Lottie JSON or SVGA packages, and does not preserve transparency or HDR.

## Run the bundled Python helper

Requires Python 3.10+ and FFmpeg with \`libx264\`, AAC, and \`ffprobe\` on PATH. No pip packages are needed. On macOS, \`brew install ffmpeg\` supplies FFmpeg and ffprobe. The helper accepts \`--ffmpeg\` / \`--ffprobe\` or \`MOGRAFY_FFMPEG\` / \`MOGRAFY_FFPROBE\` executable overrides; it does not automatically discover Mografy's bundled FFmpeg. If a dependency is absent, report it and use the environment's normal installation process.

Resolve \`../scripts/compress-video.py\` relative to this reference's local Skill directory, not the animation project's directory. From the owning repository root, these commands invoke the shared Skill copy (quote paths containing spaces):

\`\`\`sh
# Balanced quality, same dimensions and frame timing; keeps audio when present.
python3 .agents/skills/mografy/scripts/compress-video.py "projects/my-animation/renders/film.mp4"

# Better detail retention; optionally trade encoding time for compression.
python3 .agents/skills/mografy/scripts/compress-video.py "projects/my-animation/renders/film.mp4" --crf 20 --preset slow -o "projects/my-animation/renders/film-share.mp4"

# Fit a landscape video within 1280 x 720 without upscaling or cropping.
python3 .agents/skills/mografy/scripts/compress-video.py "projects/my-animation/renders/film.mp4" --max-width 1280 --max-height 720

# Target a 10 MB upload limit (decimal MB), using two-pass encoding.
python3 .agents/skills/mografy/scripts/compress-video.py "projects/my-animation/renders/film.mp4" --target-mb 10
\`\`\`

The maintained source is [scripts/compress-video.py](__REPOSITORY__/scripts/compress-video.py); \`pnpm sync:skills\` copies it into the shared Skill's \`scripts/\` directory. Edit the repository source, then sync, rather than editing the generated copy. For an animation outside this repository, use the absolute path to the loaded Skill's helper and the actual input video.

## Choose settings and verify

- Default: CRF 23, medium preset, AAC 128 kbps, original frame timing and dimensions (rounded down to even pixels for H.264). It preserves the first video and first audio stream; additional streams, selectable subtitles, and attachments are omitted. Burned-in captions remain visible.
- CRF 18–20 keeps more detail; 26–28 trades detail for smaller files. CRF is lossy and does not guarantee a file size or reduction. \`--crf\` and \`--target-mb\` are mutually exclusive.
- Use \`--target-mb\` for a stated upload limit. The budget reserves space for audio and container overhead, then checks actual bytes. An impossible budget or oversize result fails without publishing an output; report that failure rather than promising the limit was met.
- Change resolution only when appropriate to the request. For portrait 720p, use \`--max-width 720 --max-height 1280\`. Both caps preserve aspect ratio without cropping or upscaling. Small text and fine artwork may need a higher resolution or lower CRF.
- Audio stays unless \`--no-audio\` is explicitly appropriate; \`--audio-kbps 96\` can reduce its budget. Do not silently remove narration or music to hit a limit.

The helper never overwrites any existing file or the original export. It defaults to \`<stem>-compressed.mp4\` beside the input; pass a new \`-o\` path for another attempt. It encodes in a temporary folder, verifies duration/audio and decodes the result before publishing. Failed or cancelled operations clean up temporary output. If the candidate is larger than or equal to the source, it is discarded and stdout JSON reports \`status: "skipped"\`, \`output: null\`, and a reason; no compressed file exists in that case.

Read the stdout JSON and report the actual output path, original/result bytes, and percentage saved. For a skipped result, explain that the original is already smaller with these settings. Inspect the compressed video for text legibility, banding, motion artifacts, and audio sync before delivery; automated decoding does not prove visual quality. Keep the original as the master. Do not automatically replace a website asset or upload a file unless that is part of the user's request.

Option semantics: [FFmpeg documentation](https://ffmpeg.org/ffmpeg.html) and [libx264 encoder options](https://ffmpeg.org/ffmpeg-codecs.html#libx264_002c-libx264rgb).
`;

const CODEX_MOTION_DESIGN = `# Motion design decisions for Codex

Use this supplement in Codex when creating a Mografy animation or revising its visual concept, choreography, pacing, or transitions. Claude keeps the existing shared workflow; this supplement adds no Claude requirements. A copy correction, asset swap, export, compression, or isolated timing fix needs only the relevant local check, not a new concept or storyboard. Preserve the user's chosen direction and requested scope. Continue authorized implementation without adding an approval gate.

## Establish a visual idea before scene code

Write a compact direction in the existing \`storyboards/storyboard.md\` for a planned sequence, or in a short working note for a small animation. Reuse an existing plan rather than creating parallel briefs. Make these decisions concrete:

- **Message and visual mechanism:** what should the viewer understand, and what visible change expresses it? For example, "independent marks align into one readable signal" defines an action; "premium, smooth, dynamic" does not.
- **Graphic language:** describe the type hierarchy, shape proportions, palette roles, negative space, and framing at the actual aspect ratio. Use supplied artwork and the project's identity. Do not turn a real UI walkthrough into an abstract brand film or redraw a supplied logo to make a transition easier.
- **Attention and rhythm:** name the focal subject and the moments of action, emphasis, and rest. Decide what stays still while the lead moves. Music can supply cues; a film does not need every element to move on every beat.
- **Continuity:** identify what the viewer follows across a shot boundary: the same object, alignment, direction, contour, color field, or a deliberate contrasting cut. Specify its outgoing and incoming states.

Use the nearest public [component](built-in-components.md) or [intro](intro.md), supplied reference, or existing project shot to answer a specific design question. Inspect its source and actual frames or playback when available. Note the useful relationship (such as a playhead causing a visible state change), then adapt it to this brief. A catalog of components is a technical vocabulary, not a shot list. Do not copy private project material into shared guidance.

For a new concept that needs shot planning, follow [storyboard.md](storyboard.md), including Codex image generation. Use those panels to choose composition and hierarchy; keep exact geometry, copy, and timing in the written plan. Generated imagery can suggest something the Canvas implementation never produces. Compare implemented frames with the intended key poses rather than treating the generated board as proof of quality.

## Compose the key poses, then connect them

For each important action, define the before, decisive, and resolved compositions. Specify useful positions or proportions, the dominant scale, the supporting elements, and the held result. A paused key pose should communicate the intended message before decorative movement is added. Check it at the delivered viewing size, especially type and diagrams on a phone.

Translate the action into a causal phrase:

> The leading bar travels to the shared baseline; the other marks align in its wake; their alignment opens space for the headline; the resolved line holds under the words.

This phrase determines order, overlap, and attention. Only then choose durations, paths, pivots, and curves. Write the choreography in scene modules as pure functions of absolute \`time\`; follow the existing runtime contract. Keep layout and motion data out of \`mografy.json\`.

### Worked example: an eight-second "Find your focus." bumper

This is an original teaching example, not a mandatory look, schedule, or component recipe. It needs only Canvas marks and typography. Use another mechanism when the brief calls for one.

The optional [scene source](../../../../extras/motion-design.ts) implements this example; inspect its [actual Chromium key poses](../../../../docs/motion-design/poses.png) alongside the code when using it as a reference. Resolve these files from the current checkout when available. These poses show the implemented Canvas scene, not an image-generated concept board. The example uses a generic system sans-serif; choose project fonts for production work.

| Time | Composition and action | Design reason |
| --- | --- | --- |
| 0.0–1.8 | Three short strokes sit at different heights in the central half of the frame. A longer lead stroke moves toward a common baseline; the other strokes follow with small offsets. Resolve into a single horizontal line by 1.2 and hold it. | The graphic change expresses finding order. One lead attracts the eye; the followers share its cause. |
| 1.8–4.6 | Keep that same line at the same position and thickness at the boundary. It lengthens to the measured headline width while "Find your focus." is exposed directly above it. Settle by 2.8; hold the readable composition. | The existing object becomes typographic structure. The headline gets a distinct reveal and a quiet reading interval. |
| 4.6–8.0 | Keep the headline stable. The line retracts toward its optical center, leaving a short accent; allow a restrained delayed settle in the accent, then hold the complete end composition. | The ending resolves the opening idea. The viewer gets closure without a second competing entrance. |

A weaker version would fade out the strokes, slide in an unrelated title card, and bounce everything until the end. That loses the graphic relationship and the reading hold even if each tween is technically correct. Improve the relationship between states before adding more effects.

## Choose motion by its job

| Job | Decisions that matter | Failure to check in the render |
| --- | --- | --- |
| Reveal or emphasis | Choose what is discovered first: silhouette, word, number, relationship, or result. Use contrast, a mask, spatial change, or a cut when it serves that order. A simple fade is appropriate for a quiet reveal. | Every object fades/slides in with equal prominence, so nothing leads the eye. |
| Explanation | A cause visibly changes its result: a cursor presses a control, a value changes a chart, an object assembles into a system. Preserve real product behavior. | A decorative cursor or chart animates independently of the event it supposedly explains. |
| Typography | Measure and compose the complete text first. Animate words or glyphs only where their order or rhythm adds meaning; keep the reading pose stable. | Text keeps scaling or drifting during its reading hold; long words or CJK copy change wrapping mid-reveal. |
| Transition | Match the outgoing and incoming framing for a handoff, or make a cut whose change in scale, direction, or meaning is intentional. Brief-specific hard cuts and fades remain valid. | Unrelated panels reset to the center and repeat the same entrance; a wipe conceals a jump instead of connecting the scenes. |
| Weight or response | Choose the pivot, contact, acceleration, overshoot, and delayed secondary response for the material. Rigid type and logos usually need different treatment from soft characters. | Every object uses the same spring or sinusoidal bob regardless of weight, material, or story. |
| Held result | Give the message a readable still interval; secondary movement should reinforce it. | Motion continues merely to avoid stillness and competes with the takeaway. |

Treat the easing and text-duration estimates in scene authoring as starting heuristics. Judge actual spacing and reading at the requested pace; do not apply one curve, stagger interval, or shot duration mechanically to every action. If copy cannot be read in the requested duration, resolve that conflict explicitly rather than speeding up the whole film. Choose the relevant [animation principles](animation-principles.md) after deciding the action; listing their names is not a design rationale.

## Review design separately from technical correctness

Run the existing \`mografy check\` and \`mografy review\` workflow. Technical validity, deterministic seeking, loop equality, or successful encoding proves those properties only. Judge the actual rendered animation against the visual direction:

| Criterion | Evidence to inspect |
| --- | --- |
| Hierarchy and composition | At the before, decisive, and held poses, the intended subject reads first; type, spacing, and contrast work at output size. |
| Motion meaning | The viewer can follow the cause and result of the lead action without reading the implementation or an explanation of its intent. |
| Continuity | Inspect the frame before, within, and after each boundary. The promised object or relationship survives the handoff, or the intended cut reads clearly. |
| Rhythm | Inspect the whole sequence at normal speed when playback is available, then dense action/transition samples. Action, emphasis, and rest are distinguishable; the ending has time to resolve. |
| Craft | Check measured text, pivots, paths, contacts, overlap, final poses, and unwanted drift. For characters, inspect contact and passing poses; for graphics, inspect alignment and optical balance. |

Record a concrete observation with a time or frame, its effect on the viewer, and the correction when a criterion fails. "The headline and diagram start together at 2.0s, so neither leads; delay the supporting caption until the diagram resolves" is useful. "Looks premium; all twelve principles applied" is not evidence. Fix the observed issue and review the affected sequence again.

Stills and transition strips show composition and sampled continuity; they do not by themselves establish the experience of continuous playback. If the available tools cannot inspect playback, say which frames and intervals were inspected and leave temporal quality unverified. Likewise, describe reference fidelity only after comparing the actual rendered output with the reference. Do not claim a visual-quality improvement from a successful build or a written plan alone.

## Evaluate this supplement on actual tasks

When evaluating a Skill revision, use the same brief, assets, dimensions, and time budget for the previous and revised guidance. Keep each run's source, plan, actual frames, playable output when available, and critique separate. Do not label the new version as the preferred answer for the reviewer. These focused briefs exercise different decisions:

1. **Motion concept:** "Create an eight-second 16:9 bumper for the fictional wordmark LUMA, using only typography and simple Canvas geometry. Communicate 'Many ideas. One direction.' End on the wordmark."
2. **Explanatory causality:** "Create a six-second 9:16 animation showing a task move from waiting to complete after a button press. Preserve the visible cause/result and let the result read at phone size."
3. **Scope control:** "In this existing animation, change only the last title and lengthen its final hold by half a second. Preserve its established composition and other timings."

For the first two, compare the five criteria above using actual frames and playback. Let a reviewer state which version communicates the brief more clearly and cite the moment that determined the choice; document ties or regressions. For the third, verify that the requested local edit did not trigger a redesign or an unnecessary storyboard/image-generation cycle. Keep prompt-following and technical checks separate from this visual judgment. A rubric or self-score alone does not establish an improvement, and a Codex run does not establish Claude behavior or a general model ranking.
`;

/** Generated references are colocated with each host's skill for portable relative links. */
export const SKILL_REFERENCES = {
  'scene-authoring.md': GUIDE_BODY,
  'storyboard.md': STORYBOARD,
  'animation-principles.md': ANIMATION_PRINCIPLES,
  'codex-motion-design.md': CODEX_MOTION_DESIGN,
} as const;

export const SKILL = `---
name: mografy
description: Develop Mografy, plan storyboards, create and export Canvas animations, and compress oversized exported videos with the bundled Python helper. Use for Mografy repository work, scene projects with mografy.json, storyboards, and smaller video files for sharing.
---

# Mografy

For scene work, read the project's \`mografy.json\`, configured scene entry, imported local modules, and relevant assets before making changes. For a requested 9:16 video, create a native portrait scene (1080 × 1920), respect any saved \`aspectRatio\`, and plan vertical layout and social safe margins. The main preview follows the scene; orientation icons and Fit belong only to export. Read the scene-authoring reference for the full contract. Tailor the work to that project's visual language and brief.

- Before editing a scene, read [references/scene-authoring.md](references/scene-authoring.md) for the complete runtime, drawing, validation, review, and export contract.
- In Codex, before creating an animation or redesigning its motion, read [references/codex-motion-design.md](references/codex-motion-design.md) for visual concepts, causal choreography, rhythm, continuity, and separate design review. For a small local fix, apply only the relevant guidance. Claude keeps the existing shared workflow and skips this Codex supplement.
- For a storyboard or a new animation that needs shot planning, read [references/storyboard.md](references/storyboard.md). Codex uses image generation; Claude uses Artifacts when available, with an explicit local HTML fallback in Claude Code.
- When creating an animation, choosing storyboard motifs, or reusing examples, read [references/built-in-components.md](references/built-in-components.md) for the sixteen scene components and [references/intro.md](references/intro.md) for the existing twelve-second intro. Inspect the relevant original scene code before adapting it.
- For a film-style sequence built from stills or key art (camera moves, transitions such as sakura petal wipes, atmosphere), read [references/camera-transitions.md](references/camera-transitions.md) and add the optional \`cinema.ts\` extra to the project.
- For Chinese or Japanese copy, vertical text (tategaki), or CJK line breaking, read [references/cjk-typography.md](references/cjk-typography.md) and add the optional \`cjk.ts\` extra and CJK fonts to the project.
- For new motion or animation polish, read [references/animation-principles.md](references/animation-principles.md) and apply the relevant principles.
- When an exported video is too large or the user asks to compress it, read [references/video-compression.md](references/video-compression.md) and run the bundled \`scripts/compress-video.py\` on the finished file. Preserve the original, check the reported size, and review the compressed result.
- When developing Mografy itself, read [references/project.md](references/project.md) for the GitHub sources and required checks. Inspect the current checkout's local files before editing.

Animation content belongs only in scene modules, never in \`mografy.json\`. Render synchronously from absolute \`time\`, resolved params, and prepared assets; do not use GSAP, SVG scene layers, resvg, clocks, or previous-frame state. Scene code executes only in the browser. Write plans and prompts in English; preserve supplied copy unless translation is requested.

For scene changes, run \`mografy check [project]\`, then \`mografy review [project]\` and inspect the generated PNGs before delivery. A generated storyboard is a concept reference; validate the actual scene separately. Export with \`mografy export [project] --format mp4|webm|lottie|svga\` when requested.
`;

const LEGACY_REPOSITORY_SKILL = `---
name: mografy
description: Develop Mografy itself or create, edit, validate, visually review, and export Mografy Canvas scenes in this repository.
---

Read [packages/core/src/guide.ts](../../../packages/core/src/guide.ts) completely before editing a Mografy scene. Its \`GUIDE_BODY\` is the single source for the scene file format, runtime constraints, direct-file editing workflow, Chromium checks, visual review criteria, and CLI export flow.

For product code changes, also follow the repository's root \`AGENTS.md\`, \`docs/architecture.md\`, and required test commands.
`;

const LEGACY_PROJECT_GUIDE = `# Mografy project instructions

This folder is a Mografy project. Animation lives only in scene modules, normally \`scenes/main.ts\`; \`mografy.json\` contains settings. Render with synchronous \`renderFrame(ctx, time, params)\` and keep seeking deterministic. Scene code runs only in the browser; do not introduce GSAP, SVG scene layers, or resvg.

Read the project Skill in \`.agents/skills/mografy/SKILL.md\` (Codex) or \`.claude/skills/mografy/SKILL.md\` (Claude). Both contain the same English workflow and local references. If skill discovery is unavailable, read these references directly:

- [Scene authoring](.agents/skills/mografy/references/scene-authoring.md): required before scene edits; includes \`ctx.withCanvas\`, drawing APIs, runtime constraints, and CLI review.
- [Storyboards](.agents/skills/mografy/references/storyboard.md): project-specific shot planning, Codex image generation, and Claude Artifacts or a local HTML fallback.
- [Animation principles](.agents/skills/mografy/references/animation-principles.md): the twelve principles applied through deterministic Canvas motion.

Open the player with \`mografy dev\`. After scene edits, run \`mografy check\` and \`mografy review\`, then inspect every generated review PNG. Export with \`mografy export --format mp4|lottie|svga\` when requested. Keep storyboards in \`storyboards/\` and out of project animation settings.
`;

const LEGACY_STORYBOARD_SKILL = `---
name: mografy-storyboard
description: Write project-specific Mografy storyboards and shot lists with visual key poses and animation direction. Use when the user requests a Mografy storyboard, shot breakdown, or visual plan before scene implementation.
---

# Mografy storyboard

Read the project's \`mografy.json\`, scene entry, imported modules, and assets. Use its actual dimensions, palette, fonts, brand artwork, and characters.

- Read [references/storyboard.md](references/storyboard.md) for the English shot list and visual deliverables. In Codex, invoke image generation; in Claude, use Artifacts when available, otherwise write the standalone HTML preview.
- Read [references/animation-principles.md](references/animation-principles.md) to select expressive motion for each shot, with clear anticipation, action, settle, and reading holds.
- Read [references/scene-authoring.md](references/scene-authoring.md) when implementation is requested, and [references/project.md](references/project.md) when working on Mografy itself.

Save the written plan and visual output links under \`storyboards/\`. Keep all plans, shot labels, and prompts in English. Preserve supplied copy and artwork unless the user requests changes. A storyboard-only request delivers the board; implement scene modules when the request also includes animation. Review actual rendered frames separately from conceptual panels.
`;

/** Both hosts read one Mografy Skill from the outer .agents folder. */
function skillFilesWithRepositoryLinks(repository: string, introduction = `This skill was generated for the Mografy repository at \`${repository}\`. Use the current checkout's instructions when another checkout is explicitly selected. For an animation project elsewhere, read that project's settings and assets; do not assume it is inside this repository.`): { mografy: Record<string, string> } {
  const project = `# Mografy project reference

${introduction}

Before product changes, read [AGENTS.md](${repository}/AGENTS.md), [architecture](${repository}/docs/architecture.md), [status](${repository}/docs/STATUS.md), and [usage](${repository}/README.md).

- \`packages/core/src/guide.ts\` owns the English skill entrypoints and references. After changes, run \`pnpm build\` and \`pnpm sync:skills\` in the repository.
- Use \`mografy update --check\` to check the executing source installation, or \`mografy update\` to fast-forward, install/build, sync guidance and restart its active player. Stop and resolve local changes or diverged history rather than overwriting them. Older installations need a one-time manual update documented in README.
- One \`mografy\` Skill lives in the source repository's outer \`.agents/skills/\` folder, with scene, storyboard, animation-principle, and project references. Codex reads it there; the root \`.claude/skills/mografy\` symlink points Claude to the same folder. Root \`CLAUDE.md\` also imports the shared Skill. Never create Skill folders inside animation subprojects.
- Animation code belongs only in scene modules. The Server must never import or evaluate scenes in Node. Do not introduce GSAP, SVG scene layers, or resvg.
- Application writes to projects use \`queueProjectWrite\` in \`packages/server/src/project.ts\` and \`atomicWrite\`. The player and exports share \`@mografy/runtime\`, including \`post.ts\`.
- Run \`pnpm check\` and \`pnpm test:browser\` after repository changes. For scene work, use \`mografy check [project]\`, \`mografy review [project]\`, and inspect the PNGs.

Adapt storyboards to the actual scene and assets. Write plans and prompts in English. Codex invokes image generation; Claude invokes Artifacts when exposed, with a standalone local HTML/Canvas fallback in Claude Code. Read the corresponding local references for details.
`;
  const references = Object.fromEntries(Object.entries({ ...SKILL_REFERENCES,
    'built-in-components.md': BUILTIN_COMPONENTS_REFERENCE.replaceAll('__REPOSITORY__', repository),
    'intro.md': INTRO_REFERENCE.replaceAll('__REPOSITORY__', repository),
    'camera-transitions.md': CAMERA_TRANSITIONS_REFERENCE.replaceAll('__REPOSITORY__', repository),
    'cjk-typography.md': CJK_TYPOGRAPHY_REFERENCE.replaceAll('__REPOSITORY__', repository),
    'video-compression.md': VIDEO_COMPRESSION_REFERENCE.replaceAll('__REPOSITORY__', repository),
    'project.md': project,
  })
    .map(([name, contents]) => [`references/${name}`, contents]));
  return {
    mografy: { 'SKILL.md': SKILL, ...references },
  };
}

const GITHUB_SOURCE = 'https://github.com/zz41354899/mografy/blob/main';

/** Published guidance is identical in every checkout and never embeds a developer's disk paths. */
export function sharedSkillFiles(_repository?: string) {
  const files = skillFilesWithRepositoryLinks(GITHUB_SOURCE,
    'Canonical sources are on [GitHub](https://github.com/zz41354899/mografy). Resolve local files from the current checkout, never from a path in another installation. For an animation project elsewhere, read that project\'s settings and assets; do not assume it is inside this repository.',
  );
  for (const [file, contents] of Object.entries(files.mografy)) {
    const base = `${GITHUB_SOURCE}/.agents/skills/mografy/${file}`;
    files.mografy[file] = contents.replace(/\]\(([^)]+)\)/g, (_, link: string) => `](${new URL(link, base).href})`);
  }
  return files;
}

const LEGACY_USER_SCOPE_GUIDE = `# Mografy project instructions

This folder is a Mografy project. Animation belongs only in scene modules; \`mografy.json\` contains settings. Use synchronous \`renderFrame(ctx, time, params)\` with deterministic seeking. Scenes run only in the browser; do not introduce GSAP, SVG scene layers, resvg, clocks, or previous-frame state. Use \`ctx.draw\` for common drawing and \`ctx.withCanvas\` for native Canvas scopes.

Read the external \`mografy\` Skill at \`~/.agents/skills/mografy/SKILL.md\` in Codex or \`~/.claude/skills/mografy/SKILL.md\` in Claude Code. Its local references contain the scene contract and animation principles. For shot planning, use the external \`mografy-storyboard\` Skill in the same host directory. Codex uses image generation; Claude uses Artifacts when available, otherwise a standalone HTML/Canvas preview. Write plans and prompts in English and save project-specific boards under \`storyboards/\`.

Never create Skill folders inside this project. If the external Skills are missing, run \`pnpm build\` and \`pnpm sync:skills\` from the Mografy source repository to install them.

Open the player with \`mografy dev\`. After scene edits, run \`mografy check\` and \`mografy review\`, then inspect the generated PNGs. Export with \`mografy export --format mp4|lottie|svga\` when requested.
`;

const LEGACY_SHARED_PROJECT_GUIDE = `# Mografy project instructions

This folder is a Mografy animation project. Animation belongs only in scene modules; \`mografy.json\` contains settings. Use synchronous \`renderFrame(ctx, time, params)\` with deterministic seeking. Scenes run only in the browser; do not introduce GSAP, SVG scene layers, resvg, clocks, or previous-frame state. Use \`ctx.draw\` for common drawing and \`ctx.withCanvas\` for native Canvas scopes.

Codex and Claude read the same Skills from the Mografy source repository's outer \`.agents/skills/\` folder. Read \`mografy/SKILL.md\` and its local references before scene work. For shot planning, also read \`mografy-storyboard/SKILL.md\`. The shared Skill root is linked below; do not create Skill copies inside animation projects or install duplicate host-specific folders.

Codex uses image generation; Claude uses Artifacts when available, otherwise a standalone HTML/Canvas preview. Write plans and prompts in English and save project-specific boards under \`storyboards/\`.

Open the player with \`mografy dev\`. After scene edits, run \`mografy check\` and \`mografy review\`, then inspect the generated PNGs. Export with \`mografy export --format mp4|lottie|svga\` when requested.
`;

function legacySharedProjectGuide(repository: string) {
  return LEGACY_SHARED_PROJECT_GUIDE + `
Shared Skills: [Mografy](${repository}/.agents/skills/mografy/SKILL.md) and [Storyboards](${repository}/.agents/skills/mografy-storyboard/SKILL.md). If missing, run \`pnpm build\` and \`pnpm sync:skills\` from \`${repository}\`.
`;
}


export const GUIDE = `# Mografy project instructions

This folder is a Mografy animation project. Animation belongs only in scene modules; \`mografy.json\` contains settings. Use synchronous \`renderFrame(ctx, time, params)\` with deterministic seeking. Scenes run only in the browser; do not introduce GSAP, SVG scene layers, resvg, clocks, or previous-frame state. Use \`ctx.draw\` for common drawing and \`ctx.withCanvas\` for native Canvas scopes.

Codex and Claude share the single \`mografy\` Skill in the Mografy source repository's outer \`.agents/skills/mografy/\` folder. Read its \`SKILL.md\` and the local references relevant to the task: scene authoring, storyboards, animation principles, and project development. Do not create Skill copies inside animation projects. The source repository's root \`.claude/skills/mografy\` entry links Claude to the same Skill.

Codex storyboards use image generation; Claude uses Artifacts when available, otherwise a standalone HTML/Canvas preview. Write plans and prompts in English and save project-specific boards under \`storyboards/\`.

Open the player with \`mografy dev\`. After scene edits, run \`mografy check\` and \`mografy review\`, then inspect the generated PNGs. Export with \`mografy export --format mp4|webm|lottie|svga\` when requested.
`;

function previousProjectGuide(repository: string) {
  return GUIDE + `
Shared Skill: [Mografy](${repository}/.agents/skills/mografy/SKILL.md). If missing, run \`pnpm build\` and \`pnpm sync:skills\` from \`${repository}\`.
`;
}

function isPreviousProjectPointer(contents: string) {
  const match = contents.match(/\nShared Skill: \[Mografy\]\((.+)\/\.agents\/skills\/mografy\/SKILL\.md\)\. If missing, run/);
  if (!match) return false;
  const previous = previousProjectGuide(match[1]!);
  return contents === previous || contents === previous.replaceAll('mp4|webm|lottie|svga', 'mp4|lottie|svga');
}

export function projectGuide(_repository?: string) {
  return GUIDE + `
Shared Skill: [Mografy](${GITHUB_SOURCE}/.agents/skills/mografy/SKILL.md). For local work, use the current installation's outer \`.agents/skills/mografy/\` folder. If missing, run \`pnpm build\` and \`pnpm sync:skills\` from your Mografy checkout.
`;
}

/** Exact previous generated files, used only to remove the former separate storyboard Skill. */
export function obsoleteStoryboardFiles(repository: string): Record<string, string> {
  const files: Record<string, string> = { ...skillFilesWithRepositoryLinks(repository).mografy, 'SKILL.md': LEGACY_STORYBOARD_SKILL };
  delete files['references/built-in-components.md'];
  delete files['references/intro.md'];
  delete files['references/camera-transitions.md'];
  delete files['references/cjk-typography.md'];
  delete files['references/codex-motion-design.md'];
  files['references/project.md'] = files['references/project.md']!.replace(
    "One `mografy` Skill lives in the source repository's outer `.agents/skills/` folder, with scene, storyboard, animation-principle, and project references. Codex reads it there; the root `.claude/skills/mografy` symlink points Claude to the same folder. Root `CLAUDE.md` also imports the shared Skill. Never create Skill folders inside animation subprojects.",
    "Skills live in the source repository's outer `.agents/skills/` folder. Codex and Claude share `mografy` and `mografy-storyboard` there, with local references. Never create Skill folders inside animation subprojects. Root `AGENTS.md` routes Codex; root `CLAUDE.md` imports the same shared Skill for Claude.",
  );
  return files;
}
