# Storyboard planning for Mografy

Read this reference when asked for a storyboard, shot list, or a new animation that needs shot planning. Read the project's scene entry, imported modules, assets, and settings first, including `style.md` when present. Reuse its visual language, dimensions, fonts, palette, and existing characters or brand assets. Write planning documents, shot labels, and tool prompts in English; preserve supplied dialogue and artwork unless translation or redesign is requested.

For a portrait brief, explicitly label the written plan and every image-generation prompt as **9:16 portrait**, and draw each storyboard panel as a tall 9:16 frame. Read the saved `aspectRatio`; design a vertical composition with stacked content, wrapped copy, and social safe margins. A landscape storyboard cropped into tall panels is not a portrait plan. When both ratios are needed, specify the layout changes for each shot and verify both versions against actual frames.

## Deliverables

Save a project-specific plan as `storyboards/storyboard.md`. Include the audience, message, aspect ratio, total duration, visual direction, asset inventory, and assumptions. Use one row per shot:

| Shot | Time (seconds) | Purpose | Composition and assets | Action and poses | Camera | Copy / audio | Transition | Principles | Review times |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | 0.0–2.0 | Introduce the mark | Existing logo, centered, generous margins | Anticipation at 0.15; reveal at 0.4; settle by 1.1; hold | Static | Brief logo sound; no copy | Match logo position into S02 | Staging, anticipation, slow in/out | 0.15, 0.4, 1.1, 1.9 |

Number shots in order; make time ranges contiguous and cover the requested duration. Specify entrance, action, settle, hold, and exit where useful. Describe start, extreme, and settle poses rather than writing vague directions such as "make it dynamic." Give each shot a clear focal point and connect transitions through position, color, shape, or meaning. Allow enough reading time for the actual copy; lengthen a shot or shorten copy when the timing is unrealistic.

Link each shot to existing or proposed scene functions and name the assets it needs. Mark missing assets and assumptions clearly. Keep shot descriptions and visual references out of `mografy.json`; only review times and transition sampling settings belong in its existing review fields. A storyboard is a planning document, not a runtime format.

## Visual output by host

### Codex: image generation

When creating a storyboard in Codex, invoke the host's available image-generation tool to produce a storyboard contact sheet or individual key poses. Follow its image-generation skill when available. Supply project artwork as references for edits or identity continuity. Describe panel count, aspect ratio, ordered shot IDs, consistent palette and framing, key poses, and the action between panels. Match the board to the written shot list. Keep exact copy and timings in Markdown because generated image labels can be unreliable. Inspect generated panels for identity, composition, cropping, and consistency, then link the result from `storyboards/storyboard.md`; save a local copy under `storyboards/` when the host exposes one.

Generated panels are conceptual references. They do not prove that the implemented animation renders correctly. If image generation is unavailable, say so and provide the complete written plan plus ready-to-run English image prompts; never claim images were generated.

### Claude: Artifacts

When creating a storyboard in a Claude host with Artifacts, invoke its Artifact capability to present the same plan as an HTML storyboard. Use responsive shot cards with shot ID, time range, Canvas-drawn key poses or existing raster assets, action, transition, and motion notes. Use ordinary HTML/CSS and Canvas; do not add GSAP, SVG scene layers, or resvg. An optional playhead or shot selector may illustrate timing, but label it as a storyboard preview. Keep the artifact self-contained and avoid remote dependencies. Also save the English shot list to the project so Codex can continue from it.

Claude Code environments may not expose Artifacts. Check tool availability; if absent, save `storyboards/storyboard.html` as a standalone local preview and report that fallback. Do not claim to have opened a Claude Artifact. The HTML storyboard is separate from the Mografy scene and is never imported by the Server.

## From storyboard to animation

Read [animation-principles.md](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/animation-principles.md) to choose motion that supports each shot. A storyboard-only request ends with the written and visual board. If implementation is also requested, continue into scene modules without inventing an approval step. Use analytic functions of `time` for all poses, camera transforms, secondary motion, and transitions. Validate using `mografy check`, then `mografy review`; inspect real raw and output frames at the shot's poses, holds, boundaries, and transition intervals against the storyboard. Update the plan if implementation changes timing or composition.
