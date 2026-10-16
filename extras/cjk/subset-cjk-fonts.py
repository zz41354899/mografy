"""Subset Noto Sans / Serif CJK into the optional CJK fonts in extras/cjk/fonts/.

Coverage: ASCII, CJK punctuation, hiragana, katakana, full-width forms, CJK vertical
presentation forms, Big5 level-1 (5,401 common Traditional Chinese characters),
JIS X 0208 levels 1-2 (6,355 Japanese kanji) and GB2312 level-1 (3,755 Simplified).

Usage (fonts from https://github.com/notofonts/noto-cjk, SIL Open Font License 1.1):
  python3 extras/cjk/subset-cjk-fonts.py NotoSansCJK-Medium.ttc "Noto Sans CJK TC" out/NotoSansCJKtc-Medium-subset.otf
  python3 extras/cjk/subset-cjk-fonts.py NotoSerifCJK-Bold.ttc "Noto Serif CJK TC" out/NotoSerifCJKtc-Bold-subset.otf
Use the JP, SC or KR family name for that region's glyph forms. Add characters with --extra.
Requires fontTools (pip install fonttools).
"""
import argparse, os
from fontTools import subset
from fontTools.ttLib import TTCollection


def euc_rows(codec, first, last):
    out = set()
    for hi in range(first, last + 1):
        for lo in range(0xA1, 0xFF):
            try: out.add(bytes([hi, lo]).decode(codec))
            except UnicodeDecodeError: pass
    return out


def big5_level1():
    out = set()
    for hi in range(0xA4, 0xC7):
        for lo in list(range(0x40, 0x7F)) + list(range(0xA1, 0xFF)):
            if hi == 0xC6 and lo > 0x7E: continue
            try: out.add(bytes([hi, lo]).decode('big5'))
            except UnicodeDecodeError: pass
    return out


def charset(extra=''):
    ranges = [(0x20, 0x7F), (0x3000, 0x3100), (0xFF01, 0xFF5F), (0xFE10, 0xFE1A), (0xFE30, 0xFE50)]
    chars = {chr(c) for a, b in ranges for c in range(a, b)}
    chars |= set('·—–‘’“”…‥※→←↑↓○●◎◇◆□■△▲▽▼☆★♪♡♥〜')
    chars |= big5_level1() | euc_rows('euc_jp', 0xB0, 0xF4) | euc_rows('gb2312', 0xB0, 0xD7) | set(extra)
    return chars


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('source'); ap.add_argument('family'); ap.add_argument('output'); ap.add_argument('--extra', default='')
    a = ap.parse_args()
    index = 0
    if a.source.lower().endswith('.ttc'):
        names = [f['name'].getDebugName(1) for f in TTCollection(a.source).fonts]
        index = next(i for i, n in enumerate(names) if n.startswith(a.family))
    o = subset.Options(); o.font_number = index; o.name_IDs = ['*']; o.hinting = False
    o.layout_features = ['vert', 'vrt2', 'palt', 'vpal', 'kern', 'liga', 'locl']
    font = subset.load_font(a.source, o)
    s = subset.Subsetter(o); s.populate(text=''.join(sorted(charset(a.extra)))); s.subset(font)
    os.makedirs(os.path.dirname(a.output) or '.', exist_ok=True)
    subset.save_font(font, a.output, o)
    print('wrote', a.output, os.path.getsize(a.output), 'bytes', font['name'].getDebugName(1))


if __name__ == '__main__':
    main()
