# The twelve principles of animation in Mografy

Use these principles to give movement weight, intention, and personality. Choose the ones that support the scene; do not force all twelve into every shot or add perpetual motion to readable holds. Record the chosen principles and their purpose in the storyboard. Preserve existing typography, logos, and character identity.

| Principle | Application in a Canvas scene | Review criterion |
| --- | --- | --- |
| 1. Squash and stretch | Deform a soft object around its contact or pivot point. Use reciprocal scale factors (sx = s, sy = 1/s) to approximately preserve area. Keep logos and text rigid unless deformation suits the brief. | The object conveys weight without unintended distortion. |
| 2. Anticipation | Add a small opposite move, compression, or brief pause before the main action. Evaluate each phase from absolute time. | The viewer can predict what will happen without a distracting delay. |
| 3. Staging | Use composition, contrast, negative space, and one dominant moving focus. Position secondary objects to support that focus. | The message is clear at key poses and throughout transitions. |
| 4. Straight ahead action and pose to pose | Plan start, extreme, and settle poses; interpolate between them. For organic straight-ahead exploration, precompute seeded samples in setup and index/interpolate them by time. Never integrate from the previous rendered frame. | Random seeks and repeat renders preserve exactly the same pose. |
| 5. Follow through and overlapping action | Let a tail, ribbon, or supporting element settle after the main body. Use delayed time windows or bounded damped oscillation with a defined start. | Parts share a cause but stop at different times; motion ends cleanly. |
| 6. Slow in and slow out | Use `springs.out` for entrances, `keys` for moves that pass through several poses, and `cameraPath` for the camera; keep `ease.inOutCubic` for a single short move. Vary spacing to communicate acceleration and deceleration. | Speed changes feel intentional; related elements use coherent curves. |
| 7. Arcs | Move subjects along analytic curved paths, such as quadratic Bezier positions or a bounded sine arc. Let rotation follow the tangent when useful. | Motion has a coherent path and clears safe margins. |
| 8. Secondary action | Add a restrained blink, tilt, highlight, or small response that supports the primary action. Offset its timing and amplitude. | It reinforces emotion or meaning without competing with the main message. |
| 9. Timing | Allocate anticipation, action, settle, reading hold, and exit in seconds. Use fps to judge frame spacing and ctx.beat(time) for musical cues when audio exists. | Weight, pacing, legibility, and beat alignment work at the requested fps. |
| 10. Exaggeration | Selectively amplify a pose, trajectory, contrast, or overshoot to make the intent readable. Keep amplitudes adjustable and bounded. | The action is expressive without clipping or harming brand recognition. |
| 11. Solid drawing | Keep pivots, proportions, perspective, overlap, and volume coherent with Canvas transforms, gradients, and consistent lighting. For flat graphics, maintain optical balance and silhouette. | Forms stay believable while moving, scaling, and overlapping. |
| 12. Appeal | Build clear silhouettes, harmonious proportions, distinct pose rhythms, and a consistent palette. Use deliberate asymmetry when it adds character. | The scene feels intentional and engaging, with useful visual hierarchy. |

## Deterministic follow-through example

The runtime's `settle(time, start, duration, amplitude, cycles?)` is a bounded wobble that is exactly 0 outside its window; `springs.out`, `springs.pop` and `spring()` cover entrances and overshoot. All are pure functions of time, so seek order never changes a pose:

```ts
import { at, settle, springs } from '@mografy/runtime';
// Evaluate inside renderFrame: the card pops in, then its ribbon lags behind and settles.
const scale = at(time, 0.4, 0.9, springs.pop);
const ribbonAngle = settle(time, 0.8, 1.2, 0.12);
```

Store motion only in scene modules. Do not add a live physics loop, unseeded randomness, a clock, or previous-frame state. Read [scene-authoring.md](scene-authoring.md) for the runtime and drawing contract.

Review the start, extreme, settle, and final hold of each action, plus dense transition strips. Check repeated and out-of-order times with `mografy check`, and inspect both raw and post-processed frames with `mografy review`. When motion sampling, glow, or grain hides a pose or blurs important text, adjust the motion or output settings and review again.
