// Chinese / Japanese typography: vertical text (tategaki) and line breaking for CJK copy.
// Pure functions of time and options. Canvas has no vertical writing mode, so punctuation is
// swapped for Unicode vertical presentation forms, long marks are rotated, and small kana are
// nudged toward the upper right of their cell.
import { clamp, ease, pr } from '@mografy/runtime';
import type { FrameContext } from '@mografy/runtime';

/** Families of the bundled CJK fonts once copied into a project and registered in mografy.json (see the cjk-typography reference). */
export const CJK_SANS = 'Noto Sans CJK TC';
export const CJK_SERIF = 'Noto Serif CJK TC';

const VERTICAL_FORMS: Record<string, string> = {
  '、': '︑', '。': '︒', '，': '︐', '：': '︓', '；': '︔', '！': '︕', '？': '︖',
  '「': '﹁', '」': '﹂', '『': '﹃', '』': '﹄', '（': '︵', '）': '︶', '(': '︵', ')': '︶',
  '【': '︻', '】': '︼', '《': '︽', '》': '︾', '〈': '︿', '〉': '﹀', '｛': '︷', '｝': '︸', '〔': '︹', '〕': '︺',
  '…': '︙', '‥': '︰', '—': '︱', '–': '︲', '＿': '︳',
};
const ROTATE = new Set([...'ー～〜〰―-=＝→←⇒']);
const SMALL = new Set([...'ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶㇰㇱㇲㇳㇴㇵㇶㇷㇸㇹㇺㇻㇼㇽㇾㇿ']);
/** Characters that may not begin a line or column (kinsoku). */
const NO_START = new Set([...'、。，．・：；？！）」』】〕》〉｝)]ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ…‥ゝゞヽヾ々〜～%％,.!?:;']);
/** Characters that may not end a line or column. */
const NO_END = new Set([...'（「『【〔《〈｛([']);

export interface TypeStyle {
  size: number; font?: string; weight?: number; color?: string;
  /** Soft glow behind the glyphs. */
  glow?: string; glowBlur?: number;
  /** Optional outline for legibility on busy images. */
  outline?: string; outlineWidth?: number;
  /** Per-character reveal: start time, gap between characters, duration, travel distance. */
  start?: number; stagger?: number; duration?: number; lift?: number;
  /** Fade everything out over [end - out, end]. */
  end?: number; out?: number;
}
export interface Glyph { char: string; x: number; y: number; rotate: boolean; index: number }

const fontString = (s: TypeStyle) => `${s.weight ?? 700} ${s.size}px "${s.font ?? CJK_SERIF}"`;
function reveal(time: number, i: number, s: TypeStyle) {
  const a = (s.start ?? 0) + i * (s.stagger ?? .07);
  const inn = ease.outCubic(pr(time, a, a + (s.duration ?? .55)));
  const out = s.end === undefined ? 1 : 1 - ease.inOutCubic(pr(time, s.end - (s.out ?? .35), s.end));
  return { inn, alpha: inn * out };
}
function paintGlyph(c: CanvasRenderingContext2D, s: TypeStyle, char: string, x: number, y: number) {
  if (s.outline) { c.lineJoin = 'round'; c.strokeStyle = s.outline; c.lineWidth = s.outlineWidth ?? s.size * .12; c.strokeText(char, x, y); }
  if (s.glow) { c.shadowColor = s.glow; c.shadowBlur = s.glowBlur ?? s.size * .35; }
  c.fillStyle = s.color ?? '#ffffff'; c.fillText(char, x, y);
  c.shadowColor = 'transparent'; c.shadowBlur = 0;
}

/** Split text into units: a run of one or two ASCII digits stays horizontal in one cell (tate-chu-yoko). */
function units(text: string) {
  const out: string[] = [];
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    if (/[0-9]/.test(ch) && /[0-9]/.test(chars[i + 1] ?? '') && !/[0-9]/.test(chars[i + 2] ?? '')) { out.push(ch + chars[i + 1]!); i++; }
    else out.push(ch);
  }
  return out;
}

/**
 * Lay out vertical text. Columns run top to bottom and right to left; `x` is the centre of the
 * first (rightmost) column and `y` its top. `columnHeight` wraps with kinsoku rules; "\n" starts
 * a new column. Returns positioned glyphs and the block size.
 */
export function verticalLayout(text: string, o: { x: number; y: number; size: number; columnHeight?: number; tracking?: number; columnGap?: number }) {
  const step = o.size * (1 + (o.tracking ?? .05)), gap = o.size * (o.columnGap ?? .7), max = o.columnHeight ?? Infinity;
  const glyphs: Glyph[] = [];
  let col = 0, row = 0, index = 0, rows = 0;
  const lines = text.split('\n');
  lines.forEach((line, li) => {
    const u = units(line);
    for (let i = 0; i < u.length; i++) {
      const ch = u[i]!;
      // Wrap when the cell would overflow, keeping forbidden starts on the previous column.
      if ((row + 1) * step > max && row > 0 && !NO_START.has(ch)) {
        const last = glyphs[glyphs.length - 1];
        if (last && NO_END.has(last.char)) { glyphs.pop(); col++; row = 0; glyphs.push({ ...last, x: o.x - col * (o.size + gap), y: o.y + step / 2 }); row = 1; }
        else { col++; row = 0; }
      }
      const vertical = VERTICAL_FORMS[ch];
      glyphs.push({ char: vertical ?? ch, x: o.x - col * (o.size + gap), y: o.y + row * step + step / 2, rotate: !vertical && (ROTATE.has(ch) || /^[A-Za-z]$/.test(ch)), index: index++ });
      row++; rows = Math.max(rows, row);
    }
    if (li < lines.length - 1) { col++; row = 0; }
  });
  return { glyphs, columns: col + 1, width: (col + 1) * o.size + col * gap, height: rows * step };
}

/** Draw vertical Japanese / Chinese text with a per-character reveal. */
export function verticalText(ctx: FrameContext, time: number, o: TypeStyle & { text: string; x: number; y: number; columnHeight?: number; tracking?: number; columnGap?: number }) {
  if (time < (o.start ?? 0) || (o.end !== undefined && time > o.end)) return;
  const layout = verticalLayout(o.text, o);
  ctx.withCanvas(c => {
    c.font = fontString(o); c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const g of layout.glyphs) {
      const { inn, alpha } = reveal(time, g.index, o);
      if (alpha <= .002) continue;
      c.save(); c.globalAlpha = alpha; c.translate(g.x, g.y - (1 - inn) * (o.lift ?? o.size * .25));
      if (SMALL.has(g.char)) c.translate(o.size * .08, -o.size * .08);
      if (g.rotate) c.rotate(Math.PI / 2);
      if (g.char.length === 2 && /^[0-9]{2}$/.test(g.char)) c.scale(.5, 1);
      paintGlyph(c, o, g.char, 0, 0);
      c.restore();
    }
  });
  return layout;
}

/** Break CJK (and mixed Latin) text into lines that fit maxWidth, following kinsoku rules. */
export function wrapCJK(ctx: FrameContext, text: string, maxWidth: number, style: { size: number; font?: string; weight?: number; tracking?: number }) {
  const lines: string[] = [];
  ctx.withCanvas(c => {
    c.font = fontString(style);
    const track = (style.tracking ?? 0) * style.size;
    for (const paragraph of text.split('\n')) {
      // Latin words stay together; every CJK character is its own breakable token.
      const tokens = paragraph.match(/[A-Za-z0-9'’\-]+[.,!?:;]?|\s+|./gu) ?? [];
      let line = '';
      const width = (s: string) => c.measureText(s).width + track * Math.max(0, [...s].length - 1);
      for (const token of tokens) {
        const next = line + token;
        if (line && width(next.trimEnd()) > maxWidth && !NO_START.has([...token][0]!)) {
          let carry = '';
          const chars = [...line];
          while (chars.length > 1 && NO_END.has(chars[chars.length - 1]!)) carry = chars.pop()! + carry;
          lines.push(chars.join('').trimEnd()); line = (carry + token).trimStart();
        } else line = next;
      }
      lines.push(line.trimEnd());
    }
  });
  return lines;
}

/** Horizontal CJK text block with wrapping and a per-character reveal. align: left | center | right. */
export function cjkText(ctx: FrameContext, time: number, o: TypeStyle & { text: string; x: number; y: number; maxWidth?: number; lineHeight?: number; tracking?: number; align?: 'left' | 'center' | 'right' }) {
  if (time < (o.start ?? 0) || (o.end !== undefined && time > o.end)) return;
  const lines = o.maxWidth ? wrapCJK(ctx, o.text, o.maxWidth, o) : o.text.split('\n');
  ctx.withCanvas(c => {
    c.font = fontString(o); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    const track = (o.tracking ?? 0) * o.size, lh = o.size * (o.lineHeight ?? 1.5);
    let index = 0;
    lines.forEach((line, li) => {
      const chars = [...line], widths = chars.map(ch => c.measureText(ch).width);
      const total = widths.reduce((a, b) => a + b, 0) + track * Math.max(0, chars.length - 1);
      let x = o.align === 'center' ? o.x - total / 2 : o.align === 'right' ? o.x - total : o.x;
      chars.forEach((ch, i) => {
        const { inn, alpha } = reveal(time, index++, o);
        if (alpha > .002) { c.globalAlpha = clamp(alpha); paintGlyph(c, o, ch, x, o.y + li * lh + (1 - inn) * (o.lift ?? o.size * .25)); }
        x += widths[i]! + track;
      });
    });
  });
  return lines;
}
