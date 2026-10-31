"""Shrink a project's fonts to the characters its film actually draws.

Every font in mografy.json is loaded and parsed whenever the project opens, so a 5 MB CJK subset (5,401 common
characters) costs seconds while a film uses a few hundred. This scans the project's text — scenes/, mografy.json,
and JSON / Markdown / text / CSV files under assets/ and storyboards/ — and writes `<font>-film.<ext>` next to each font
with only those characters (plus printable ASCII and the vertical punctuation forms cjk.ts substitutes), then points
mografy.json at the new files. The original fonts stay untouched; run it again after every copy change, since it
always rebuilds from the originals.

Usage:  python3 extras/cjk/subset-film-fonts.py <project> [--extra "字元"] [--dry-run]
Requires fontTools (pip install fonttools).
"""
import argparse, json, pathlib, sys
from fontTools import subset

TEXT_EXT = {'.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.txt', '.csv', '.html'}
DATA_EXT = {'.json', '.md', '.txt', '.csv'}
# cjk.ts swaps these for their vertical presentation forms when it sets vertical text
VERTICAL = {'、': '︑', '。': '︒', '，': '︐', '：': '︓', '；': '︔', '！': '︕', '？': '︖', '「': '﹁', '」': '﹂', '『': '﹃', '』': '﹄',
            '（': '︵', '）': '︶', '(': '︵', ')': '︶', '【': '︻', '】': '︼', '《': '︽', '》': '︾', '〈': '︿', '〉': '﹀', '…': '︙', '—': '︱', '–': '︲'}


def film_text(project: pathlib.Path) -> set[str]:
    files = [project / 'mografy.json']
    for folder, exts in (('scenes', TEXT_EXT), ('assets', DATA_EXT), ('storyboards', DATA_EXT)):   # library code in assets/ is not copy
        root = project / folder
        if root.is_dir(): files += [p for p in root.rglob('*') if p.is_file() and p.suffix.lower() in exts and p.stat().st_size < 4_000_000]
    chars: set[str] = set()
    for f in files:
        try: chars |= set(f.read_text('utf-8'))
        except (UnicodeDecodeError, OSError): pass
    chars = {c for c in chars if ord(c) > 0x7E and c not in '﻿​'}
    chars |= {chr(c) for c in range(0x20, 0x7F)}
    chars |= {VERTICAL[c] for c in list(chars) if c in VERTICAL}
    return chars


def source_of(project: pathlib.Path, path: str) -> pathlib.Path:
    p = project / path
    if p.stem.endswith('-film'):
        original = p.with_name(p.stem[:-5] + p.suffix)
        if original.exists(): return original
    return p


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('project'); ap.add_argument('--extra', default=''); ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    project = pathlib.Path(a.project).resolve()
    manifest_file = project / 'mografy.json'
    manifest = json.loads(manifest_file.read_text('utf-8'))
    fonts = manifest.get('fonts') or []
    if not fonts: print('No fonts in mografy.json; nothing to do.'); return
    chars = film_text(project) | set(a.extra)
    text = ''.join(sorted(chars))
    changed = False
    for font in fonts:
        src = source_of(project, font['path'])
        if not src.exists(): print(f'! {font["path"]}: font file not found, skipped', file=sys.stderr); continue
        out = src.with_name(src.stem + '-film' + src.suffix)
        if a.dry_run: print(f'{src.name}: {len(chars)} characters → {out.name}'); continue
        options = subset.Options(); options.layout_features = ['*']; options.name_IDs = ['*']; options.notdef_outline = True
        options.glyph_names = False; options.hinting = False
        options.flavor = {'.woff2': 'woff2', '.woff': 'woff'}.get(src.suffix.lower())   # keep the source's compression (woff2 needs brotli)
        fnt = subset.load_font(str(src), options)
        missing = [c for c in chars if ord(c) > 0x7E and ord(c) not in fnt.getBestCmap()]
        sub = subset.Subsetter(options); sub.populate(text=text); sub.subset(fnt)
        subset.save_font(fnt, str(out), options)
        rel = out.relative_to(project).as_posix()
        print(f'{src.name} {src.stat().st_size / 1e6:.1f} MB → {out.name} {out.stat().st_size / 1e3:.0f} KB ({len(chars)} characters)')
        if missing: print(f'  ! not in {src.name} (fine if they only appear in code comments): {"".join(sorted(missing))}', file=sys.stderr)
        if font['path'] != rel: font['path'] = rel; changed = True
    if changed:
        manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', 'utf-8')
        print('mografy.json now loads the film subsets.')


if __name__ == '__main__':
    main()
