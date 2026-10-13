# Selected Mografy website — navigation, footer and brand refinement

2026-10-13. Revised using built-in image_gen, preserving the selected thin typography, English copy, whitespace, 2D artwork and actual dark-player reference.

User requests: redesign footer and navbar, use standard brand colors for buttons, remove dirty button textures, use the real logo.

- `mografy-website.png`: final long design mockup.
- `mografy-logo.svg`: unchanged copy of `docs/brand/mografy-logo.svg`, the exact implementation asset.
- `mografy-logo-reference.jpg`: browser rendering of that SVG used as image-generation grounding.
- `logo-reference.html`: local reference renderer.

Navigation now has the official full lockup, Examples / Workflow / Docs links and Get started. Footer has brand description and Product / Resources columns plus a quiet copyright row. Standard primary-button specification is **solid #12B5A5**, text **#04201C**, no gradient, grain, texture or shadow. Secondary button is white with a thin gray border. Image generation can leave slight raster variations; implementation must use these exact CSS colors and the original SVG instead of sampling the mockup or cropping its buttons/logo. Use the real player screenshot from selected-v4 directly for product preview.

This is a design artifact, not an implemented or deployed website. The main source and scene code were not changed.

## Initial edit prompt

```text
Use case: precise-object-edit / ui-mockup.
Edit Image 1, the user's approved long Mografy website mockup. Output ONE complete revised long desktop website. Preserve the selected thin/light typography, generous whitespace, all-English copy, 2D circles and preview specimens, section hierarchy and the actual DARK Mografy editor shown in the middle. This is a targeted refinement of header, footer and button fills, not a redesign of the whole website.
Image 2 is the official existing FLAT Mografy logo, rendered directly from docs/brand/mografy-logo.svg. This is the ONLY logo to use for website branding. It contains a black-and-teal curved M mark AND the original black wordmark. Place this actual full lockup in header and footer, preserve letterforms and mark silhouette, proportional scaling, crisp pure colors. Do NOT type a substitute 'Mografy' wordmark in an unrelated font. Do not add textures, gradients, metallic lighting, dimensional ribbon artwork or a different symbol.
Image 3 is the actual product screenshot for grounding. Preserve the established real dark Mografy player, including project thumbnail list, canvas 'Hello.', transport row and timeline beneath, and right Scene / Effects / Audio. Keep it as in Image 1 or use Image 3 faithfully. Do not redesign or lighten the editor.
CHANGES:
1. NAVBAR REDESIGN. On a clean white surface, use a balanced horizontal nav with official full logo left (about 130–150px wide in the 793px concept, corresponding ~235–270px at 1440), enough space before the right-aligned plain text navigation 'Examples' / 'Workflow' / 'Docs' and compact 'Get started' button. Align optical centers. Reserve approximately 100px total header height in the narrow concept, generous side margins matching the page. No pills around navigation links, no cramped logo/navigation collisions, no floating card, no large header panel, no fake glass effect. Nav type regular 400; button 500 at most.
2. EVERY WEBSITE BUTTON MUST BE CLEAN UNIFORM SOLID BRAND TEAL. Exact standard color #12B5A5, perfectly uniform flat fill from edge to edge, no mottling, no shading, no gradient, no grime, no noise, no watercolor, no paper texture, no glossy highlights, no shadow, no dark patches. Button text near-black #04201C, readable medium weight. Rounded rectangular radius about 6px at desktop scale, consistent padding, no excessive pill radius. Header 'Get started', hero 'Read the setup guide', closing 'Get started' all use this ONE identical flat teal + dark text system. Secondary 'Watch a demo' is white with a thin light-gray border and dark text, also clean perfectly flat. The actual embedded product screenshot does not need to be restyled.
3. FOOTER REDESIGN. Replace the tiny squeezed bottom row with a spacious well-composed substantive footer, separated from the closing CTA by an understated fine gray rule and ample padding. White or very light neutral solid background, no teal-filled footer block, no giant logo, no enormous slogan, no decorative gradients. Left 45%: official logo about 150px wide in the narrow concept, below it small regular gray description 'Preview, refine, and export animations.' comfortably spaced in two short lines if necessary. Right two columns titled 'Product' and 'Resources', discreet regular 400 headings and well-spaced link rows. Product links 'Examples' and 'Workflow'. Resources links 'Documentation', 'Setup guide', 'GitHub'. No fake newsletter signup, no invented legal pages, no social media icons. Add a small fine-rule-separated bottom row with left '© 2026 Mografy' and right 'Built for motion.' in subtle gray. Footer should feel polished and complete with 200–240px height in the narrow concept, rather than the previous single 20px row. Maintain relaxed horizontal and vertical spacing, do not crowd the closing CTA.
LAYOUT PRESERVATION: the hero and all central sections retain their approved typography (regular/light 300–400, never bold), copy, ordering, illustration positions and real editor screenshot. Minor reflow may accommodate the new navbar and expanded footer. Increase total image height naturally to around 793 x 2200–2300px, or equivalent 1440-wide full page, rather than squashing other sections. Show the complete footer, never clip. All English. Same sparse flat 2D design. No metallic material. Overall surface should be crisply rendered, clean digital UI, not photographed on paper. The buttons especially MUST have unvarying solid teal pixels with no painted texture. Preserve actual official logo geometry, don't approximate it.
```

## Targeted button cleanup prompt

```text
Edit this image with ONE narrowly scoped correction: make every marketing-website primary button a clean digital UI button with absolutely uniform solid color. The current turquoise button fills are visibly mottled / cloudy / dirty. REMOVE THAT MOTTLED TEXTURE COMPLETELY.
Fill each of these three button shapes with exactly one flat color, sRGB RGB(18,181,165), HEX #12B5A5, uniform at every interior point:
- the top navbar 'Get started' button
- hero 'Read the setup guide' button
- lower 'Get started' button
Inside each shape, there must be NO pattern, no noise, no grain, no clouds, no brush strokes, no gradient, no speckles, no dirty darker/lighter patches, no gloss, no lighting, no shadow. Think pure CSS background-color #12B5A5 printed with completely even ink, not a painted surface. Button text remains crisp very dark #04201C, existing wording and position unchanged. Secondary 'Watch a demo' button is clean solid white with a thin gray border.
Also make solid website backgrounds clean white/very pale neutral, free of analog paper grain; leave circles as clean flat 2D color. Preserve ALL other content exactly: official black-and-teal Mografy logo in both navbar and footer, text weight, layout, spacing, redesigned Product/Resources footer, all-English copy, hero rings, examples, export section, and the actual dark Mografy player image. Do not redraw or restyle the embedded real product screenshot. Do not alter typography or add any content. Same full-page aspect ratio and complete footer. Most important: the three marketing button interiors must be completely flat and untextured, visibly cleaner than this input.
```

