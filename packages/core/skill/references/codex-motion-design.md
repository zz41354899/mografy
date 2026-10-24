# Motion design decisions for Codex

Use this supplement in Codex when creating a Mografy animation or revising its visual concept, choreography, pacing, or transitions. Claude keeps the existing shared workflow; this supplement adds no Claude requirements. A copy correction, asset swap, export, compression, or isolated timing fix needs only the relevant local check, not a new concept or storyboard. Preserve the user's chosen direction and requested scope. Continue authorized implementation without adding an approval gate.

## Establish a visual idea before scene code

Write a compact direction in the existing `storyboards/storyboard.md` for a planned sequence, or in a short working note for a small animation. Reuse an existing plan rather than creating parallel briefs. Make these decisions concrete:

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

This phrase determines order, overlap, and attention. Only then choose durations, paths, pivots, and curves. Write the choreography in scene modules as pure functions of absolute `time`; follow the existing runtime contract. Keep layout and motion data out of `mografy.json`.

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

Run the existing `mografy check` and `mografy review` workflow. Technical validity, deterministic seeking, loop equality, or successful encoding proves those properties only. Judge the actual rendered animation against the visual direction:

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
