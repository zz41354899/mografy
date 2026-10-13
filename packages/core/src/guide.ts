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
7. Export with \`mografy export [project] --format mp4|lottie|svga\`. The command prints capture and encoding or packaging progress and writes the finished file under \`renders/\`. Press Ctrl+C to cancel a CLI export. When \`mografy dev\` is running, player exports also print progress in that terminal and can be stopped with \`mografy export [project] --cancel\`.

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
    (kind === 'guide' && repository !== undefined && contents === legacySharedProjectGuide(repository));
}

const STORYBOARD = `# Storyboard planning for Mografy

Read this reference when asked for a storyboard, shot list, or a new animation that needs shot planning. Read the project's scene entry, imported modules, assets, and settings first. Reuse its visual language, dimensions, fonts, palette, and existing characters or brand assets. Write planning documents, shot labels, and tool prompts in English; preserve supplied dialogue and artwork unless translation or redesign is requested.

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

[component-frame.ts](__REPOSITORY__/packages/server/template/scenes/component-frame.ts) supplies the shared 1920 × 1080, eight-second, 30fps scene contract, font selection, speed control, and drawing scopes. \`componentFrame\` evaluates \`time * speed % 4\`; account for that four-second reset before changing timing. \`centeredComponent\` adds a centered design-space transform. [brand-logo.ts](__REPOSITORY__/packages/server/template/scenes/brand-logo.ts) supplies the original mark geometry. [showcase.ts](__REPOSITORY__/packages/server/template/scenes/showcase.ts) demonstrates composition of all sixteen motifs.

## Reuse in a project

- The source library is \`packages/server/template/\`; editable installed copies are under the configured library's \`.components/{id}/\`. When running from source, the default library is \`projects/\`. Read \`scenes/main.ts\` and the manifest of the selected installed project rather than assuming it is identical to the template.
- New projects receive the component modules and scene entries. Import the needed function from the project's local \`scenes/components.ts\` or \`scenes/social-components.ts\`. Preserve required imports, including brand geometry. Do not import files outside the animation project; compilation allows project-local modules and \`@mografy/runtime\` only.
- Copy the useful motion and composition into the selected project's own scene modules. Adapt layout, copy, palette, scale, and timing to its brief. Keep pure time evaluation and isolated Canvas state; retain the project's existing assets and visual identity.
- Use these examples to choose a motif in the storyboard and connect it to a concrete scene function. For a longer sequence with transitions and a brand ending, read [intro.md](intro.md).
- Keep important subtitle params distinct from ordinary scene copy. The source entries may contain string params that are edited by an agent in source rather than shown in the subtitle inspector.

## Review

Open an installed example with \`mografy dev [project]\`. After adapting it, run \`mografy check [project]\` and \`mografy review [project]\`; inspect actual frames at the entrance, extreme, settle, hold, and any loop reset. Verify text measurement, safe margins, clipping, contrast, and out-of-order seeking. The catalog is a source reference, not an acceptance result for a modified scene. Read [scene-authoring.md](scene-authoring.md) and [animation-principles.md](animation-principles.md) for the contract and motion direction.
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

The existing review times are 1.8, 3.6, 5.4, 8.9, and 11.8 seconds. Transition strips cover 2.0–3.2, 8.4–9.4, and 9.8–11.4 seconds at 0.1-second steps. Inspect the generated PNGs, including output frames with sampling or effects. Validate repeat and random seeks, caption layout, chat-bubble stability, logo identity, and the final hold. Export only when requested, using \`mografy export examples/mografy-intro --format mp4|lottie|svga\`.
`;

/** Generated references are colocated with each host's skill for portable relative links. */
export const SKILL_REFERENCES = {
  'scene-authoring.md': GUIDE_BODY,
  'storyboard.md': STORYBOARD,
  'animation-principles.md': ANIMATION_PRINCIPLES,
} as const;

export const SKILL = `---
name: mografy
description: Develop Mografy, plan storyboards, and create, edit, validate, visually review, and export Canvas animations. Use for Mografy repository work, scene projects with mografy.json, and Mografy storyboard requests.
---

# Mografy

Read the project's \`mografy.json\`, configured scene entry, imported local modules, and relevant assets before making changes. Tailor the work to that project's visual language and brief.

- Before editing a scene, read [references/scene-authoring.md](references/scene-authoring.md) for the complete runtime, drawing, validation, review, and export contract.
- For a storyboard or a new animation that needs shot planning, read [references/storyboard.md](references/storyboard.md). Codex uses image generation; Claude uses Artifacts when available, with an explicit local HTML fallback in Claude Code.
- When creating an animation, choosing storyboard motifs, or reusing examples, read [references/built-in-components.md](references/built-in-components.md) for the sixteen scene components and [references/intro.md](references/intro.md) for the existing twelve-second intro. Inspect the relevant original scene code before adapting it.
- For new motion or animation polish, read [references/animation-principles.md](references/animation-principles.md) and apply the relevant principles.
- When developing Mografy itself, read [references/project.md](references/project.md) for this installation's repository path, owning sources, and required checks.

Animation content belongs only in scene modules, never in \`mografy.json\`. Render synchronously from absolute \`time\`, resolved params, and prepared assets; do not use GSAP, SVG scene layers, resvg, clocks, or previous-frame state. Scene code executes only in the browser. Write plans and prompts in English; preserve supplied copy unless translation is requested.

For scene changes, run \`mografy check [project]\`, then \`mografy review [project]\` and inspect the generated PNGs before delivery. A generated storyboard is a concept reference; validate the actual scene separately. Export with \`mografy export [project] --format mp4|lottie|svga\` when requested.
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
export function sharedSkillFiles(repository: string) {
  const project = `# Mografy project reference

This skill was generated for the Mografy repository at \`${repository}\`. Use the current checkout's instructions when another checkout is explicitly selected. For an animation project elsewhere, read that project's settings and assets; do not assume it is inside this repository.

Before product changes, read [AGENTS.md](${repository}/AGENTS.md), [architecture](${repository}/docs/architecture.md), [status](${repository}/docs/STATUS.md), and [usage](${repository}/README.md).

- \`packages/core/src/guide.ts\` owns the English skill entrypoints and references. After changes, run \`pnpm build\` and \`pnpm sync:skills\` in the repository.
- One \`mografy\` Skill lives in the source repository's outer \`.agents/skills/\` folder, with scene, storyboard, animation-principle, and project references. Codex reads it there; the root \`.claude/skills/mografy\` symlink points Claude to the same folder. Root \`CLAUDE.md\` also imports the shared Skill. Never create Skill folders inside animation subprojects.
- Animation code belongs only in scene modules. The Server must never import or evaluate scenes in Node. Do not introduce GSAP, SVG scene layers, or resvg.
- Application writes to projects use \`queueProjectWrite\` in \`packages/server/src/project.ts\` and \`atomicWrite\`. The player and exports share \`@mografy/runtime\`, including \`post.ts\`.
- Run \`pnpm check\` and \`pnpm test:browser\` after repository changes. For scene work, use \`mografy check [project]\`, \`mografy review [project]\`, and inspect the PNGs.

Adapt storyboards to the actual scene and assets. Write plans and prompts in English. Codex invokes image generation; Claude invokes Artifacts when exposed, with a standalone local HTML/Canvas fallback in Claude Code. Read the corresponding local references for details.
`;
  const references = Object.fromEntries(Object.entries({ ...SKILL_REFERENCES,
    'built-in-components.md': BUILTIN_COMPONENTS_REFERENCE.replaceAll('__REPOSITORY__', repository),
    'intro.md': INTRO_REFERENCE.replaceAll('__REPOSITORY__', repository),
    'project.md': project,
  })
    .map(([name, contents]) => [`references/${name}`, contents]));
  return {
    mografy: { 'SKILL.md': SKILL, ...references },
  };
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

Open the player with \`mografy dev\`. After scene edits, run \`mografy check\` and \`mografy review\`, then inspect the generated PNGs. Export with \`mografy export --format mp4|lottie|svga\` when requested.
`;

export function projectGuide(repository: string) {
  return GUIDE + `
Shared Skill: [Mografy](${repository}/.agents/skills/mografy/SKILL.md). If missing, run \`pnpm build\` and \`pnpm sync:skills\` from \`${repository}\`.
`;
}

/** Exact previous generated files, used only to remove the former separate storyboard Skill. */
export function obsoleteStoryboardFiles(repository: string): Record<string, string> {
  const files: Record<string, string> = { ...sharedSkillFiles(repository).mografy, 'SKILL.md': LEGACY_STORYBOARD_SKILL };
  delete files['references/built-in-components.md'];
  delete files['references/intro.md'];
  files['references/project.md'] = files['references/project.md']!.replace(
    "One `mografy` Skill lives in the source repository's outer `.agents/skills/` folder, with scene, storyboard, animation-principle, and project references. Codex reads it there; the root `.claude/skills/mografy` symlink points Claude to the same folder. Root `CLAUDE.md` also imports the shared Skill. Never create Skill folders inside animation subprojects.",
    "Skills live in the source repository's outer `.agents/skills/` folder. Codex and Claude share `mografy` and `mografy-storyboard` there, with local references. Never create Skill folders inside animation subprojects. Root `AGENTS.md` routes Codex; root `CLAUDE.md` imports the same shared Skill for Claude.",
  );
  return files;
}
