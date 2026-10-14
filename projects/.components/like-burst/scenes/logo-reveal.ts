import type { FrameContext } from '@mografy/runtime';
import { componentFrame } from './component-frame.js';
import { logoReveal } from './components.js';
export { meta, params, setup } from './component-frame.js';
export function renderFrame(ctx: FrameContext, time: number, params: Readonly<Record<string, unknown>>) {
  componentFrame(ctx, time, params, (animationTime, accent) => {
    logoReveal(ctx, animationTime, { x: ctx.width / 2, y: ctx.height / 2, width: ctx.width * (ctx.height > ctx.width ? .65 : .34), duration: 1.2, color: accent });
  });
}
