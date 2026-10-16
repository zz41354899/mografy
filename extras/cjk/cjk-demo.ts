// Vertical Japanese and wrapped Chinese text with cjk.ts. Register the bundled CJK fonts first:
// copy them into assets/ and list "Noto Sans CJK TC" (500) and "Noto Serif CJK TC" (700) in mografy.json.
import { ease, pr } from '@mografy/runtime';
import type { FrameContext } from '@mografy/runtime';
import { verticalText, cjkText, CJK_SANS, CJK_SERIF } from './cjk.js';

export const meta = { width: 1920, height: 1080, duration: 8, fps: 30, background: '#140d1f' };

export const params = {
  verse: { name: 'Vertical copy', type: 'string' as const, role: 'subtitle' as const, default: '月光は、きみに届く。\n「今夜、いっしょに輝こう。」\n10月17日、ステージへ！' },
  caption: { name: 'Caption', type: 'string' as const, role: 'subtitle' as const, default: '這是一段示範中文自動換行的字幕：標點符號「不會」出現在行首，英文單字 Mografy 也不會被切開。' },
  accent: { name: 'Glow', type: 'color' as const, default: '#ff5c96' },
};
type Values = { verse: string; caption: string; accent: string };

export function setup() { /* nothing to prepare: fonts load from mografy.json */ }

export function renderFrame(ctx: FrameContext, time: number, input: Readonly<Record<string, unknown>>) {
  const p = input as Values, W = ctx.width, H = ctx.height, portrait = H > W;
  ctx.withCanvas(c => {
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1d1233'); g.addColorStop(1, '#3b1534');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  });
  const out = 7.7;
  // Columns run right to left from x; the block wraps at columnHeight with kinsoku rules.
  verticalText(ctx, time, {
    text: p.verse, x: portrait ? W * .82 : W * .86, y: H * .12, size: Math.min(W, H) * .07,
    columnHeight: H * (portrait ? .5 : .74), font: CJK_SERIF, weight: 700, glow: p.accent,
    start: .3, stagger: .06, end: out,
  });
  const fade = ease.outCubic(pr(time, 1.6, 2.2)) * (1 - ease.inOutCubic(pr(time, out - .35, out)));
  ctx.withCanvas(c => { c.globalAlpha = fade * .6; c.fillStyle = '#ffd8e6'; c.fillRect(W * .08, portrait ? H * .7 : H * .62, portrait ? W * .6 : W * .42, 2); });
  cjkText(ctx, time, {
    text: p.caption, x: W * .08, y: portrait ? H * .76 : H * .7, size: Math.min(W, H) * .036,
    maxWidth: portrait ? W * .84 : W * .48, lineHeight: 1.6, font: CJK_SANS, weight: 500, color: '#fff4f8',
    start: 1.8, stagger: .018, duration: .4, end: out,
  });
  ctx.vignette(.3);
}
