import type { FrameContext } from '@mografy/runtime';
import { componentFrame, params as frameParams } from './component-frame.js';
import { staggerText } from './components.js';
export { meta, setup } from './component-frame.js';
export const params = {
  textColor: { name: 'Text color', type: 'color' as const, default: '#f2f4f8' },
  speed: frameParams.speed,
};
export function renderFrame(ctx: FrameContext, time: number, params: Readonly<Record<string, unknown>>) {
  componentFrame(ctx, time, params, animationTime => {
    const text = 'Hello.', size = Math.min(ctx.width * 0.15, ctx.height * 0.24);
    ctx.draw.textSize(size);
    staggerText(ctx, animationTime, { text, color: String(params.textColor), x: (ctx.width - ctx.draw.textWidth(text)) / 2, y: ctx.height / 2, size, lift: size * 0.3 });
  });
}
