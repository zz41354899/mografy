# Chinese and Japanese typography

[cjk.ts](https://github.com/zz41354899/mografy/blob/main/extras/cjk/cjk.ts) sets Chinese and Japanese copy: vertical text (tategaki) and horizontal text with CJK line breaking. [cjk-demo.ts](https://github.com/zz41354899/mografy/blob/main/extras/cjk/cjk-demo.ts) shows both.

## Add to a project

The module and fonts are an optional extra, not part of the installed template. If the project already has `scenes/cjk.ts`, read and reuse that local copy. Otherwise copy from the current Mografy checkout (`extras/cjk/`) or download from GitHub:

```sh
curl -fsSL -o scenes/cjk.ts https://raw.githubusercontent.com/zz41354899/mografy/main/extras/cjk/cjk.ts
curl -fsSL -o assets/NotoSansCJKtc-Medium-subset.otf https://raw.githubusercontent.com/zz41354899/mografy/main/extras/cjk/fonts/NotoSansCJKtc-Medium-subset.otf
curl -fsSL -o assets/NotoSerifCJKtc-Bold-subset.otf https://raw.githubusercontent.com/zz41354899/mografy/main/extras/cjk/fonts/NotoSerifCJKtc-Bold-subset.otf
curl -fsSL -o assets/OFL-NotoCJK.txt https://raw.githubusercontent.com/zz41354899/mografy/main/extras/cjk/fonts/OFL.txt
```

Copy only the font the design uses when one is enough. Keep the licence file with the fonts.

## Fonts

The repository provides two OFL-licensed subsets in [extras/cjk/fonts/](https://github.com/zz41354899/mografy/blob/main/extras/cjk/fonts/): `NotoSansCJKtc-Medium-subset.otf` (family `Noto Sans CJK TC`, weight 500) and `NotoSerifCJKtc-Bold-subset.otf` (family `Noto Serif CJK TC`, weight 700). They cover ASCII, kana, CJK punctuation, full-width and vertical presentation forms, 5,401 common Traditional Chinese characters (Big5 level 1), 6,355 Japanese kanji (JIS levels 1–2), and 3,755 Simplified characters (GB2312 level 1). Together they are about 9.5 MB, so they are fetched per project rather than installed. After copying, register them in `mografy.json`:

```json
"fonts": [
  { "family": "Noto Sans CJK TC", "path": "assets/NotoSansCJKtc-Medium-subset.otf", "weight": 500 },
  { "family": "Noto Serif CJK TC", "path": "assets/NotoSerifCJKtc-Bold-subset.otf", "weight": 700 }
]
```

Use the exported `CJK_SANS` and `CJK_SERIF` names with the registered weights. Without registration, the browser falls back to system fonts, so previews may differ between computers and exports. Serif (Mincho / Song) suits titles, poetry and Japanese PV copy; Sans suits subtitles and UI. For a character outside the subsets, or JP / SC / KR glyph forms, regenerate a subset with [subset-cjk-fonts.py](https://github.com/zz41354899/mografy/blob/main/extras/cjk/subset-cjk-fonts.py) from the [Noto CJK](https://github.com/notofonts/noto-cjk) sources (`--extra` adds characters). Check unusual names and rare characters in actual frames.

## Vertical text

`verticalText(ctx, time, { text, x, y, size, columnHeight?, tracking?, columnGap?, font?, weight?, color?, glow?, outline?, start?, stagger?, duration?, lift?, end?, out? })` draws columns top to bottom and right to left. `x` is the centre of the first (rightmost) column, `y` its top. `columnHeight` wraps automatically; `\n` starts a new column. It returns the layout (`glyphs`, `columns`, `width`, `height`) for placing rules or ornaments; `verticalLayout` returns the same without drawing.

Canvas has no vertical writing mode, so the helper:

- swaps punctuation and brackets for Unicode vertical presentation forms (、。，：；！？「」『』（）【】《》〈〉…);
- rotates long marks and dashes (ー, 〜, ―) and single Latin letters by 90°;
- nudges small kana (っ, ゃ, ョ…) toward the upper right of their cell;
- sets one or two consecutive digits horizontally in one cell (tate-chu-yoko), for dates such as 10月17日;
- applies kinsoku when wrapping: closing punctuation, small kana and ー never start a column, and opening brackets never end one.

Longer Latin words read poorly in vertical copy; prefer a separate horizontal label.

## Horizontal text

`cjkText(ctx, time, { text, x, y, size, maxWidth?, lineHeight?, tracking?, align?, ... })` wraps with the same kinsoku rules while keeping Latin words and numbers whole, then reveals characters with the shared stagger options. `wrapCJK` returns the lines without drawing, for layout. `y` is the first baseline; lines advance by `size * lineHeight` (default 1.5).

## Direction

- Keep important copy visible for at least about `characters / 4 + 1` seconds; CJK characters carry more meaning per glyph than Latin letters, so long lines need longer holds.
- Use `stagger` of 0.04–0.08 s for titles and 0.015–0.03 s for longer captions.
- On bright or busy images, add a dark gradient scrim or `outline` (about 0.1 × size) rather than relying on glow alone.
- In portrait, wrap captions to the social safe area and shorten columns with `columnHeight`.
- Expose only important subtitles as `role: 'subtitle'` params; editable copy must stay within the font subset.

## Review

Inspect actual frames: punctuation position in columns, wrapped column starts, digit pairs, long-mark rotation, glyph fallback (a different-looking character usually means it is missing from the subset), contrast, and reading time.
