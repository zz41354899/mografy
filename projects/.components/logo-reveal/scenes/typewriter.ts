import type { FrameContext } from '@mografy/runtime';
import { componentFrame } from './component-frame.js';
import { typewriter } from './components.js';
export { meta, params, setup } from './component-frame.js';
export function renderFrame(ctx: FrameContext, time: number, params: Readonly<Record<string, unknown>>) {
  componentFrame(ctx, time, params, (animationTime, accent) => {
    const text = 'Create.', size = Math.min(ctx.width * (ctx.height > ctx.width ? .23 : .15), ctx.height * .24);
    ctx.draw.textSize(size);
    typewriter(ctx, animationTime, { text, x: ctx.width / 2 - ctx.draw.textWidth(text) / 2, y: ctx.height / 2, size, duration: 1.6, color: accent });
  });
}
