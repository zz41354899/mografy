# Built-in component references

The sixteen built-in animations are working scene references for authoring and storyboards. Read the relevant scene entry and its imported modules before reusing a pattern. Paths below refer to the owning Mografy repository in [project.md](project.md). For an existing user project, inspect its local copies first; they may have been customized.

## Source catalog

The reusable implementations live in [components.ts](__REPOSITORY__/packages/server/template/scenes/components.ts) and [social-components.ts](__REPOSITORY__/packages/server/template/scenes/social-components.ts). Each animation has a complete entry under `packages/server/template/scenes/`:

| Component | Entry | Function | Authoring reference |
| --- | --- | --- | --- |
| Stagger text | [stagger-text.ts](__REPOSITORY__/packages/server/template/scenes/stagger-text.ts) | `staggerText` | Measured letters rise with staggered opacity and easing. |
| Typewriter | [typewriter.ts](__REPOSITORY__/packages/server/template/scenes/typewriter.ts) | `typewriter` | Character reveal and a caret computed from time. |
| Pop card | [pop-card.ts](__REPOSITORY__/packages/server/template/scenes/pop-card.ts) | `popCard` | Lift, scale, opacity, and local content drawing. |
| Progress bar | [progress-bar.ts](__REPOSITORY__/packages/server/template/scenes/progress-bar.ts) | `progressBar` | Eased progress clipped inside a rounded track. |
| Pulse dots | [pulse-dots.ts](__REPOSITORY__/packages/server/template/scenes/pulse-dots.ts) | `pulseDots` | Phase-offset loading motion from absolute time. |
| Logo reveal | [logo-reveal.ts](__REPOSITORY__/packages/server/template/scenes/logo-reveal.ts) | `logoReveal` | Staged reveal of original Mografy Path2D artwork. |
| Social card | [social-card.ts](__REPOSITORY__/packages/server/template/scenes/social-card.ts) | `socialCard` | A profile card with avatar, text, and a composed entrance. |
| YouTube subscribe | [youtube-subscribe.ts](__REPOSITORY__/packages/server/template/scenes/youtube-subscribe.ts) | `youtubeSubscribe` | A button interaction with cursor and subscribed state. |
| AI chat | [ai-chat.ts](__REPOSITORY__/packages/server/template/scenes/ai-chat.ts) | `aiChat` | Timed prompt/reply bubbles and text reveal. |
| Like burst | [like-burst.ts](__REPOSITORY__/packages/server/template/scenes/like-burst.ts) | `likeBurst` | An expressive heart response with radial secondary motion. |
| Follow badge | [follow-badge.ts](__REPOSITORY__/packages/server/template/scenes/follow-badge.ts) | `followBadge` | Profile identity and a follow-state transition. |
| Notification toast | [notification-toast.ts](__REPOSITORY__/packages/server/template/scenes/notification-toast.ts) | `notificationToast` | A compact status message with staged reveal. |
| Lower third | [lower-third.ts](__REPOSITORY__/packages/server/template/scenes/lower-third.ts) | `lowerThird` | A clipped title/subtitle reveal and clear hierarchy. |
| Count up | [count-up.ts](__REPOSITORY__/packages/server/template/scenes/count-up.ts) | `countUp` | A deterministic numeric value transition. |
| Toggle switch | [toggle-switch.ts](__REPOSITORY__/packages/server/template/scenes/toggle-switch.ts) | `toggleSwitch` | Coordinated knob position, track color, and cursor response. |
| Audio wave | [audio-wave.ts](__REPOSITORY__/packages/server/template/scenes/audio-wave.ts) | `audioWave` | A procedural wave of bars; actual audio-reactive motion needs scene-specific audio or beat input. |

[component-frame.ts](__REPOSITORY__/packages/server/template/scenes/component-frame.ts) supplies the shared 1920 × 1080, eight-second, 30fps scene contract, font selection, speed control, and drawing scopes. `componentFrame` evaluates `time * speed % 4`; account for that four-second reset before changing timing. `centeredComponent` retains the landscape design-space transform and uses component-specific widths around the exact canvas center in portrait. Installed built-in projects and their bundled thumbnails default to 9:16 portrait. All sixteen entries support both landscape and portrait canvases. Follow badges stack vertically; chat, notification, profile, and lower-third copy use measured wrapping or bounded single lines. Dots and bar thickness use the short edge to preserve spacing and proportions. Select Adapt layout when exporting to the other orientation. [brand-logo.ts](__REPOSITORY__/packages/server/template/scenes/brand-logo.ts) supplies the original mark geometry. [showcase.ts](__REPOSITORY__/packages/server/template/scenes/showcase.ts) demonstrates composition of all sixteen motifs.

## Reuse in a project

- The source library is `packages/server/template/`; editable installed copies are under the configured library's `.components/{id}/`. When running from source, the default library is `projects/`. Read `scenes/main.ts` and the manifest of the selected installed project rather than assuming it is identical to the template.
- New projects receive the component modules and scene entries. Import the needed function from the project's local `scenes/components.ts` or `scenes/social-components.ts`. Preserve required imports, including brand geometry. Do not import files outside the animation project; compilation allows project-local modules and `@mografy/runtime` only.
- Copy the useful motion and composition into the selected project's own scene modules. Adapt layout, copy, palette, scale, and timing to its brief. Keep pure time evaluation and isolated Canvas state; retain the project's existing assets and visual identity.
- Use these examples to choose a motif in the storyboard and connect it to a concrete scene function. For a longer sequence with transitions and a brand ending, read [intro.md](intro.md).
- Optional extras are not installed with Mografy; installation contains only the sixteen built-in components. They live in the repository's [extras/](__REPOSITORY__/extras/) folder on GitHub and are copied into a project when a brief needs them: camera moves and transitions for film-style sequences ([camera-transitions.md](camera-transitions.md)), Chinese / Japanese typography with OFL fonts ([cjk-typography.md](cjk-typography.md)), Three.js 3D layers ([three-d.md](three-d.md)), contextual music generated from the film's cues ([music.md](music.md)), and product walkthroughs that redraw an app's screens as simplified cards ([product-walkthrough.md](product-walkthrough.md)).
- Keep important subtitle params distinct from ordinary scene copy. The source entries may contain string params that are edited by an agent in source rather than shown in the subtitle inspector.

## Review

Open an installed example with `mografy dev [project]`. After adapting it, run `mografy check [project]` and `mografy review [project]`; inspect actual frames at the entrance, extreme, settle, hold, and any loop reset. Verify text measurement, safe margins, clipping, contrast, and out-of-order seeking. The catalog is a source reference, not an acceptance result for a modified scene. Read [scene-authoring.md](scene-authoring.md) and [animation-principles.md](animation-principles.md) for the contract and motion direction.
