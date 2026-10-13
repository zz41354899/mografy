# Selected Mografy website — actual player revision

2026-10-13. User selected the attached airy light English concept and requested the existing designed Mografy editor instead of the invented light editor. Website typography, color, layout and copy are preserved as the design target.

- `selected-reference.png`: user's selected mockup.
- `mografy-player-actual.jpg`: actual running Mografy screenshot at 1280 × 720, Stagger text at approximately 2.10s, Projects shown, Scene tab selected.
- `mografy-website.png`: revised long mockup generated with built-in image_gen using the selected reference and real screenshot as inputs.

The generated long mock is based on the real interface, but image generation can alter small UI text or proportions. During website implementation, use `mografy-player-actual.jpg` directly as the product image rather than a crop of the generated long mock. The player itself was not redesigned or changed. No site implementation or deployment in this revision. No metallic campaign asset was supplied.

## Exact edit prompt

```text
Use case: precise-object-edit / ui-mockup.
EDIT TARGET: Image 1 is the selected full-page Mografy official website mockup, 793 x 1983 px. Preserve this approved website design very faithfully.
SUPPORTING INSERT: Image 2 is an ACTUAL screenshot of the user's Mografy application, 1280 x 720 px. Replace ONLY the fake/light-gray editor illustration in the second website section (currently about x40–756 and y645–972) with this real screenshot. Use the actual dark interface from Image 2, do not redesign it, do not reimagine it, do not substitute a generic editor.
Critical screenshot details to preserve: full top bar Mografy / Stagger text / Live / teal Export button, dark left Projects and Built-in components list with thumbnail rows, central neutral-gray surround and dark Canvas showing 'Hello.' in simple white 2D text, bottom transport with large teal Play circle, timecode and a separate timeline strip with teal playhead and diamond markers, right actual Scene / Effects / Audio tabs and Colors / Text color / Controls / Speed, Frame review at bottom. All these are existing UI; keep them visually as shown in Image 2. Preserve screenshot as a faithful flat embedded image, no drawing extra UI. Maintain its 16:9 aspect ratio with uniform scaling, fit the full screenshot without cropping, stretching or perspective. It can occupy the same website width ~716px, resulting in height ~403px. Reflow that small section as needed for the changed screenshot aspect, move the three numbered workflow labels slightly down and adjust surrounding whitespace, without squashing the rest of the page. A thin subtle 1px gray border and small rounded corners are fine; no device frame, no drop shadow.
ALL OTHER WEBSITE ELEMENTS ARE INVARIANTS: same white/off-white page, thin light sans serif font weights, relaxed type scale and line spacing, generous margins and vertical whitespace, teal buttons, flat 2D circles/rings at hero and footer, example preview cards, export section, navigation, footer, and approved all-English wording. Do not bold the type, change the headline, add sections, add metallic or 3D art, or replace any other illustration. Keep the full page from top nav to footer, output one long image roughly 793 x 2059 px or equivalent 1440-wide full page at natural proportions, no clipped footer. This is a targeted revision of the user's selected design. Brand/editor screenshot must match Image 2 exactly as far as possible. No Chinese text in the rendered page. Do not use any previous metallic brand material.
```

